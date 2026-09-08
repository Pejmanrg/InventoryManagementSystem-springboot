package com.solarintegrators.inventory.dto.response;

import com.solarintegrators.inventory.model.AppUser;
import com.solarintegrators.inventory.model.UserRole;
import java.time.Instant;
import java.util.UUID;

/**
 * An account as the interface sees it.
 *
 * <p>There is no password field and no hash field, by construction rather than
 * by convention: the record has nowhere to put one, so no future change to the
 * service can accidentally serialise a credential.</p>
 */
public record UserResponse(
        UUID userId,
        String username,
        String firstName,
        String lastName,
        String displayName,
        String email,
        String jobTitle,
        UserRole role,
        boolean active,
        Instant lastLoginAt,
        Instant createdAt,
        Instant updatedAt) {

    public static UserResponse from(AppUser user) {
        if (user == null) {
            return null;
        }
        return new UserResponse(
                user.getUserId(),
                user.getUsername(),
                user.getFirstName(),
                user.getLastName(),
                user.getDisplayName(),
                user.getEmail(),
                user.getJobTitle(),
                user.getRole(),
                user.isActive(),
                user.getLastLoginAt(),
                user.getCreatedAt(),
                user.getUpdatedAt());
    }
}
