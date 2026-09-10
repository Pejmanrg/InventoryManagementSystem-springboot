package com.solarintegrators.inventory.dto.response;

import com.solarintegrators.inventory.model.AppUser;
import com.solarintegrators.inventory.model.UserRole;
import java.time.Instant;
import java.util.UUID;

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
    public static UserResponse breakGlass(String username, UserRole role) {
        return new UserResponse(null, username, null, null, username, null, null,
                role, true, null, null, null);
    }

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
