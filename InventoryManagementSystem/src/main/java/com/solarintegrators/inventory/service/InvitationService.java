package com.solarintegrators.inventory.service;

import com.solarintegrators.inventory.config.UiProperties;
import com.solarintegrators.inventory.dto.response.InvitationCheckResponse;
import com.solarintegrators.inventory.dto.response.InvitationIssuedResponse;
import com.solarintegrators.inventory.exception.ResourceNotFoundException;
import com.solarintegrators.inventory.model.AppUser;
import com.solarintegrators.inventory.model.InvitationPurpose;
import com.solarintegrators.inventory.model.UserInvitation;
import com.solarintegrators.inventory.repository.AppUserRepository;
import com.solarintegrators.inventory.repository.UserInvitationRepository;
import com.solarintegrators.inventory.service.mail.MailSender;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class InvitationService {
    private static final Logger log = LoggerFactory.getLogger(InvitationService.class);

    private static final Duration INVITE_TTL = Duration.ofDays(7);
    private static final Duration RESET_TTL = Duration.ofHours(1);

    private static final Duration RESET_COOLDOWN = Duration.ofMinutes(2);

    private static final int TOKEN_BYTES = 32;

    private static final DateTimeFormatter WHEN =
            DateTimeFormatter.ofPattern("d MMMM yyyy 'at' h:mm a").withZone(ZoneId.of("America/Los_Angeles"));

    private final SecureRandom random = new SecureRandom();

    private final UserInvitationRepository invitationRepository;
    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailSender mailSender;
    private final UiProperties uiProperties;
    private final AuditService auditService;

    public InvitationService(UserInvitationRepository invitationRepository,
                             AppUserRepository appUserRepository,
                             PasswordEncoder passwordEncoder,
                             MailSender mailSender,
                             UiProperties uiProperties,
                             AuditService auditService) {
        this.invitationRepository = invitationRepository;
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailSender = mailSender;
        this.uiProperties = uiProperties;
        this.auditService = auditService;
    }

    public InvitationIssuedResponse issue(UUID userId, InvitationPurpose purpose) {
        AppUser user = appUserRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No account found with id " + userId + "."));
        return issueFor(user, purpose);
    }

    public void requestReset(String usernameOrEmail) {
        String value = usernameOrEmail == null ? "" : usernameOrEmail.trim();
        if (value.isEmpty()) { return; }

        Optional<AppUser> found = appUserRepository.findByUsernameIgnoreCase(value);
        if (found.isEmpty()) {
            found = appUserRepository.findByEmailIgnoreCase(value);
        }

        if (found.isEmpty()) {
            log.info("Password reset requested for an account that does not exist. Ignored.");
            return;
        }

        AppUser user = found.get();
        if (!user.isActive()) {
            log.info("Password reset requested for disabled account {}. Ignored.", user.getUsername());
            return;
        }
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            log.info("Password reset requested for {}, which has no email address. Ignored.", user.getUsername());
            return;
        }

        boolean issuedRecently = invitationRepository
                .findByUserIdAndConsumedAtIsNull(user.getUserId()).stream()
                .anyMatch(invitation -> invitation.getPurpose() == InvitationPurpose.RESET
                        && invitation.getCreatedAt().isAfter(Instant.now().minus(RESET_COOLDOWN)));
        if (issuedRecently) {
            log.info("Password reset for {} requested again within the cooldown. Ignored.",
                    user.getUsername());
            return;
        }

        issueFor(user, InvitationPurpose.RESET);
    }

    private InvitationIssuedResponse issueFor(AppUser user, InvitationPurpose purpose) {
        Instant now = Instant.now();

        List<UserInvitation> outstanding =
                invitationRepository.findByUserIdAndConsumedAtIsNull(user.getUserId());
        if (!outstanding.isEmpty()) {
            outstanding.forEach(invitation -> invitation.consume(now));
            invitationRepository.saveAll(outstanding);
        }

        String token = newToken();
        Instant expiresAt = now.plus(purpose == InvitationPurpose.INVITE ? INVITE_TTL : RESET_TTL);

        invitationRepository.save(new UserInvitation(user.getUserId(), hash(token), purpose,
                user.getEmail(), expiresAt, auditService.currentActor()));

        String link = uiProperties.passwordLink(token);
        boolean sent = mailSender.send(user.getEmail(), subjectFor(purpose),
                bodyFor(user, purpose, link, expiresAt));

        auditService.recordEvent(purpose == InvitationPurpose.INVITE ? "USER_INVITE" : "USER_RESET_REQUEST",
                "USER", user.getUserId(),
                (purpose == InvitationPurpose.INVITE ? "Invitation" : "Password reset link")
                        + " issued for " + user.getUsername()
                        + (sent ? " and emailed to " + user.getEmail() + "."
                                : " but not emailed - mail is unavailable or the account has no address."));

        return new InvitationIssuedResponse(sent, sent ? user.getEmail() : null, expiresAt, link);
    }

    @Transactional(readOnly = true)
    public InvitationCheckResponse check(String token) {
        UserInvitation invitation = requireUsable(token);
        AppUser user = requireUser(invitation.getUserId());
        return new InvitationCheckResponse(user.getUsername(), user.getDisplayName(),
                invitation.getPurpose(), invitation.getExpiresAt());
    }

    public void accept(String token, String newPassword) {
        UserInvitation invitation = requireUsable(token);
        AppUser user = requireUser(invitation.getUserId());

        if (!user.isActive()) {
            throw new IllegalStateException(
                    "This account is not active. Ask an administrator to enable it first.");
        }

        Instant now = Instant.now();

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setUpdatedAt(now);
        appUserRepository.save(user);

        invitation.consume(now);
        invitationRepository.save(invitation);

        List<UserInvitation> others =
                invitationRepository.findByUserIdAndConsumedAtIsNull(user.getUserId());
        if (!others.isEmpty()) {
            others.forEach(other -> other.consume(now));
            invitationRepository.saveAll(others);
        }

        auditService.recordEvent("USER_PASSWORD_SET", "USER", user.getUserId(),
                "Password set by the account holder for " + user.getUsername()
                        + " using a " + invitation.getPurpose() + " link.");

        log.info("Password set for {} via {} link.", user.getUsername(), invitation.getPurpose());
    }

    private UserInvitation requireUsable(String token) {
        if (token == null || token.isBlank()) {
            throw new ResourceNotFoundException("This link is not valid.");
        }

        UserInvitation invitation = invitationRepository.findByTokenHash(hash(token))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "This link is not valid. Ask an administrator for a new one."));

        if (invitation.getConsumedAt() != null) {
            throw new IllegalStateException("This link has already been used. Ask for a new one.");
        }
        if (!invitation.getExpiresAt().isAfter(Instant.now())) {
            throw new IllegalStateException("This link has expired. Ask for a new one.");
        }
        return invitation;
    }

    private AppUser requireUser(UUID userId) {
        return appUserRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "This link is no longer valid."));
    }

    private String newToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(64);
            for (byte b : digest) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16))
                   .append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable on this JVM.", ex);
        }
    }

    private static String subjectFor(InvitationPurpose purpose) {
        return purpose == InvitationPurpose.INVITE
                ? "Set up your Cal Solar Inventory account"
                : "Reset your Cal Solar Inventory password";
    }

    private String bodyFor(AppUser user, InvitationPurpose purpose, String link, Instant expiresAt) {
        boolean invite = purpose == InvitationPurpose.INVITE;

        String greeting = (user.getFirstName() != null && !user.getFirstName().isBlank())
                ? "Hello " + esc(user.getFirstName()) + ","
                : "Hello,";

        String lead = invite
                ? "An account has been created for you in the Cal Solar Inventory Management System. "
                  + "Choose a password to finish setting it up."
                : "A password reset was requested for your Cal Solar Inventory account. "
                  + "If that was you, choose a new password.";

        return ""
            + "<div style=\"font-family:Segoe UI,Arial,sans-serif;font-size:15px;color:#1f2933;"
            +   "line-height:1.5;max-width:520px\">"
            + "<p>" + greeting + "</p>"
            + "<p>" + lead + "</p>"
            + "<p style=\"margin:24px 0\">"
            +   "<a href=\"" + esc(link) + "\" style=\"background:#1b4f8a;color:#ffffff;"
            +     "padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block\">"
            +   (invite ? "Set your password" : "Choose a new password") + "</a></p>"
            + "<p style=\"font-size:13px;color:#52606d\">Your username is "
            +   "<strong>" + esc(user.getUsername()) + "</strong>."
            +   " This link works once and expires on " + esc(WHEN.format(expiresAt)) + " Pacific time.</p>"
            + "<p style=\"font-size:13px;color:#52606d\">If the button does not work, copy this address into "
            +   "your browser:<br><span style=\"word-break:break-all\">" + esc(link) + "</span></p>"
            + "<p style=\"font-size:13px;color:#52606d\">"
            + (invite
                ? "If you were not expecting this, you can ignore this message - the link expires on its own "
                  + "and no account is usable until a password is set."
                : "If you did not ask for this, ignore this message. Your current password still works and "
                  + "nothing changes unless the link above is used.")
            + "</p></div>";
    }

    private static String esc(String value) {
        if (value == null) { return ""; }
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                    .replace("\"", "&quot;");
    }
}
