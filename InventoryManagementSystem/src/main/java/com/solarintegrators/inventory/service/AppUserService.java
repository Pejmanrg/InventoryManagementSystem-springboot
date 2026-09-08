package com.solarintegrators.inventory.service;

import com.solarintegrators.inventory.dto.request.CreateUserRequest;
import com.solarintegrators.inventory.dto.request.ResetPasswordRequest;
import com.solarintegrators.inventory.dto.request.UpdateUserRequest;
import com.solarintegrators.inventory.dto.response.UserResponse;
import com.solarintegrators.inventory.exception.InvalidRequestException;
import com.solarintegrators.inventory.model.AppUser;
import com.solarintegrators.inventory.model.UserRole;
import com.solarintegrators.inventory.repository.AppUserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Sign-in accounts (CSC-09 Identity &amp; Access).
 *
 * <p>Separate from {@link EmployeeService} on purpose: an employee can hold an
 * asset, a user can operate the system, and most people are only one of the
 * two. See {@link com.solarintegrators.inventory.model.AppUser} for that
 * distinction in full.</p>
 *
 * <p><strong>Lockout guards.</strong> Three operations are refused outright
 * because the interface would otherwise let an administrator remove their own
 * ability to administer: deleting the last active ADMIN, deactivating the last
 * active ADMIN, and demoting the last active ADMIN to another role. An account
 * also cannot deactivate, demote or delete itself - a slower version of the
 * same mistake, and the one people actually make. The configured break-glass
 * accounts would still get you back in, but relying on those for a routine
 * mistake is not a design, it is a rescue.</p>
 *
 * <p>Passwords are hashed with BCrypt before they reach the entity, so no
 * plaintext credential exists past the boundary of the method that received
 * it.</p>
 */
@Service
@Transactional
public class AppUserService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public AppUserService(AppUserRepository appUserRepository,
                          PasswordEncoder passwordEncoder,
                          AuditService auditService) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<UserResponse> listUsers() {
        return appUserRepository.findAllByOrderByUsernameAsc().stream()
                .map(UserResponse::from)
                .toList();
    }

    /**
     * Looks an account up by the name it signs in with.
     *
     * <p>Returns empty rather than throwing: the only caller is
     * {@code /api/users/me}, where "no row" is the ordinary case for a
     * configured break-glass account, not an error.</p>
     */
    @Transactional(readOnly = true)
    public Optional<UserResponse> findByUsername(String username) {
        if (username == null || username.isBlank()) {
            return Optional.empty();
        }
        return appUserRepository.findByUsernameIgnoreCase(username).map(UserResponse::from);
    }

    @Transactional(readOnly = true)
    public UserResponse getUser(UUID userId) {
        return UserResponse.from(require(userId));
    }

    public UserResponse createUser(CreateUserRequest request) {
        String username = trimToNull(request.username());
        if (username == null) {
            throw InvalidRequestException.required("username", "A username is required.");
        }

        if (appUserRepository.existsByUsernameIgnoreCase(username)) {
            auditService.recordDenied("USER_CREATE", "USER", username,
                    "Create rejected - username " + username + " already exists.");
            throw conflict("An account with the username " + username + " already exists.");
        }

        String email = trimToNull(request.email());
        if (email != null && appUserRepository.existsByEmailIgnoreCase(email)) {
            auditService.recordDenied("USER_CREATE", "USER", username,
                    "Create rejected - email " + email + " already in use.");
            throw conflict("An account with the email address " + email + " already exists.");
        }

        AppUser user = new AppUser(username, request.role(),
                passwordEncoder.encode(request.password()));
        user.setFirstName(trimToNull(request.firstName()));
        user.setLastName(trimToNull(request.lastName()));
        user.setEmail(email);
        user.setJobTitle(trimToNull(request.jobTitle()));
        user.setActive(request.active() == null || request.active());

        AppUser saved = appUserRepository.save(user);
        auditService.record("USER_CREATE", "USER", saved.getUserId(),
                "Account " + saved.getUsername() + " created with role " + saved.getRole() + ".");
        return UserResponse.from(saved);
    }

    public UserResponse updateUser(UUID userId, UpdateUserRequest request) {
        AppUser user = require(userId);

        String email = trimToNull(request.email());
        if (email != null && appUserRepository.existsByEmailIgnoreCaseAndUserIdNot(email, userId)) {
            auditService.recordDenied("USER_UPDATE", "USER", userId,
                    "Update rejected - email " + email + " already in use.");
            throw conflict("Another account already uses the email address " + email + ".");
        }

        UserRole previousRole = user.getRole();
        boolean wasActive = user.isActive();
        boolean losingAdmin = previousRole == UserRole.ADMIN && request.role() != UserRole.ADMIN;
        boolean beingDisabled = wasActive && !request.active();

        if (losingAdmin || beingDisabled) {
            guardSelf(user, losingAdmin ? "change your own role" : "deactivate your own account");
        }
        if (previousRole == UserRole.ADMIN && (losingAdmin || beingDisabled)) {
            guardLastAdmin(user, losingAdmin
                    ? "change the role of the last active administrator"
                    : "deactivate the last active administrator");
        }

        user.setFirstName(trimToNull(request.firstName()));
        user.setLastName(trimToNull(request.lastName()));
        user.setEmail(email);
        user.setJobTitle(trimToNull(request.jobTitle()));
        user.setRole(request.role());
        user.setActive(request.active());
        user.setUpdatedAt(Instant.now());

        AppUser saved = appUserRepository.save(user);

        StringBuilder summary = new StringBuilder("Account " + saved.getUsername() + " updated.");
        if (previousRole != saved.getRole()) {
            summary.append(" Role ").append(previousRole).append(" -> ").append(saved.getRole()).append('.');
        }
        if (wasActive != saved.isActive()) {
            summary.append(saved.isActive() ? " Reactivated." : " Deactivated.");
        }
        auditService.record("USER_UPDATE", "USER", saved.getUserId(), summary.toString());

        return UserResponse.from(saved);
    }

    /**
     * Sets a new password.
     *
     * <p>The audit entry deliberately records only that a reset happened. Length,
     * strength and any hint of the value itself stay out of the trail - an audit
     * log is read by more people than the account it describes.</p>
     */
    public void resetPassword(UUID userId, ResetPasswordRequest request) {
        AppUser user = require(userId);
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setUpdatedAt(Instant.now());
        appUserRepository.save(user);
        auditService.record("USER_PASSWORD_RESET", "USER", user.getUserId(),
                "Password reset for " + user.getUsername() + ".");
    }

    public void deleteUser(UUID userId) {
        AppUser user = require(userId);
        guardSelf(user, "delete your own account");
        if (user.getRole() == UserRole.ADMIN && user.isActive()) {
            guardLastAdmin(user, "delete the last active administrator");
        }

        String username = user.getUsername();
        appUserRepository.delete(user);

        /* Recorded after the delete and keyed by username rather than id: the
           id no longer resolves to anything, but the username is what the rest
           of the trail records as the actor, so the history stays joinable. */
        auditService.record("USER_DELETE", "USER", username,
                "Account " + username + " deleted.");
    }

    /* ------------------------------------------------------------ helpers */

    private AppUser require(UUID userId) {
        return appUserRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "No account found with id " + userId + "."));
    }

    /** Refuses an action that would remove the only way back in. */
    private void guardLastAdmin(AppUser user, String action) {
        long remaining = appUserRepository.findAllByOrderByUsernameAsc().stream()
                .filter(AppUser::isActive)
                .filter(u -> u.getRole() == UserRole.ADMIN)
                .filter(u -> !u.getUserId().equals(user.getUserId()))
                .count();

        if (remaining == 0) {
            auditService.recordDenied("USER_UPDATE", "USER", user.getUserId(),
                    "Rejected - would " + action + ".");
            throw conflict("You cannot " + action
                    + ". Create or activate another administrator first.");
        }
    }

    /** Refuses an action an administrator is taking against their own account. */
    private void guardSelf(AppUser user, String action) {
        String actor = auditService.currentActor();
        if (actor != null && actor.equalsIgnoreCase(user.getUsername())) {
            auditService.recordDenied("USER_UPDATE", "USER", user.getUserId(),
                    "Rejected - attempt to " + action + ".");
            throw conflict("You cannot " + action + ". Ask another administrator to do it.");
        }
    }

    private static ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
