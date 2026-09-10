package com.solarintegrators.inventory.service;

import com.solarintegrators.inventory.dto.request.CreateUserRequest;
import com.solarintegrators.inventory.dto.request.ResetPasswordRequest;
import com.solarintegrators.inventory.dto.request.UpdateUserRequest;
import com.solarintegrators.inventory.dto.response.UserResponse;
import com.solarintegrators.inventory.exception.DuplicateResourceException;
import com.solarintegrators.inventory.exception.InvalidRequestException;
import com.solarintegrators.inventory.exception.ResourceNotFoundException;
import com.solarintegrators.inventory.model.AppUser;
import com.solarintegrators.inventory.model.UserRole;
import com.solarintegrators.inventory.repository.AppUserRepository;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class UserRoleService {
    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public UserRoleService(AppUserRepository appUserRepository,
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

    @Transactional(readOnly = true)
    public Optional<UserResponse> findByUsername(String username) {
        if (username == null || username.isBlank()) {
            return Optional.empty();
        }
        return appUserRepository.findByUsernameIgnoreCase(username).map(UserResponse::from);
    }

    @Transactional(readOnly = true)
    public UserResponse assignRole(UUID userId, UserRole role) {
        if (role == null) {
            throw InvalidRequestException.required("role", "A role is required.");
        }
        AppUser user = require(userId);
        UserRole previous = user.getRole();
        if (previous == UserRole.ADMIN && role != UserRole.ADMIN) {
            guardSelf(user, "change your own role");
            guardLastAdmin(user, "change the role of the last active administrator");
        }
        user.setRole(role);
        user.setUpdatedAt(Instant.now());
        AppUser saved = appUserRepository.save(user);

        auditService.recordEvent("USER_ROLE_ASSIGN", "USER", saved.getUserId(),
                "Role for " + saved.getUsername() + " changed from " + previous + " to " + role + ".");
        return UserResponse.from(saved);
    }

    // Removing a role does not remove the account; it drops to the least
    // privileged one, because an account with no role at all could not sign in
    // and would look identical to a broken record.
    public UserResponse removeRole(UUID userId) {
        return assignRole(userId, UserRole.FIELD);
    }

    @Transactional(readOnly = true)
    public boolean authorize(String username, UserRole required) {
        if (username == null || required == null) return false;
        return appUserRepository.findByUsernameIgnoreCase(username)
                .filter(AppUser::isActive)
                .map(user -> user.getRole() == required || user.getRole() == UserRole.ADMIN)
                .orElse(false);
    }

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
            throw new DuplicateResourceException("username",
                    "An account with the username " + username + " already exists.");
        }

        String email = trimToNull(request.email());
        if (email != null && appUserRepository.existsByEmailIgnoreCase(email)) {
            auditService.recordDenied("USER_CREATE", "USER", username,
                    "Create rejected - email " + email + " already in use.");
            throw new DuplicateResourceException("email",
                    "An account with the email address " + email + " already exists.");
        }

        String password = request.password();
        boolean awaitingInvitation = password == null || password.isBlank();

        AppUser user = new AppUser(username, request.role(),
                awaitingInvitation ? unusablePassword() : passwordEncoder.encode(password));
        user.setFirstName(trimToNull(request.firstName()));
        user.setLastName(trimToNull(request.lastName()));
        user.setEmail(email);
        user.setJobTitle(trimToNull(request.jobTitle()));
        user.setActive(request.active() == null || request.active());

        AppUser saved = appUserRepository.save(user);
        auditService.recordEvent("USER_CREATE", "USER", saved.getUserId(),
                "Account " + saved.getUsername() + " created with role " + saved.getRole()
                        + (awaitingInvitation
                            ? ", awaiting an invitation to set a password."
                            : ", with a password set by " + auditService.currentActor() + "."));
        return UserResponse.from(saved);
    }

    public UserResponse updateUser(UUID userId, UpdateUserRequest request) {
        AppUser user = require(userId);

        String email = trimToNull(request.email());
        if (email != null && appUserRepository.existsByEmailIgnoreCaseAndUserIdNot(email, userId)) {
            auditService.recordDenied("USER_UPDATE", "USER", userId,
                    "Update rejected - email " + email + " already in use.");
            throw new DuplicateResourceException("email",
                    "Another account already uses the email address " + email + ".");
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
        auditService.recordEvent("USER_UPDATE", "USER", saved.getUserId(), summary.toString());

        return UserResponse.from(saved);
    }

    public void resetPassword(UUID userId, ResetPasswordRequest request) {
        AppUser user = require(userId);
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setUpdatedAt(Instant.now());
        appUserRepository.save(user);
        auditService.recordEvent("USER_PASSWORD_RESET", "USER", user.getUserId(),
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

        auditService.recordEvent("USER_DELETE", "USER", username,
                "Account " + username + " deleted.");
    }

    private AppUser require(UUID userId) {
        return appUserRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No account found with id " + userId + "."));
    }

    private String unusablePassword() {
        byte[] noise = new byte[32];
        new SecureRandom().nextBytes(noise);
        return passwordEncoder.encode(Base64.getEncoder().encodeToString(noise));
    }

    private void guardLastAdmin(AppUser user, String action) {
        long remaining = appUserRepository.findAllByOrderByUsernameAsc().stream()
                .filter(AppUser::isActive)
                .filter(u -> u.getRole() == UserRole.ADMIN)
                .filter(u -> !u.getUserId().equals(user.getUserId()))
                .count();

        if (remaining == 0) {
            auditService.recordDenied("USER_UPDATE", "USER", user.getUserId(),
                    "Rejected - would " + action + ".");
            throw new IllegalStateException("You cannot " + action
                    + ". Create or activate another administrator first.");
        }
    }

    private void guardSelf(AppUser user, String action) {
        String actor = auditService.currentActor();
        if (actor != null && actor.equalsIgnoreCase(user.getUsername())) {
            auditService.recordDenied("USER_UPDATE", "USER", user.getUserId(),
                    "Rejected - attempt to " + action + ".");
            throw new IllegalStateException(
                    "You cannot " + action + ". Ask another administrator to do it.");
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
