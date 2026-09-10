package com.solarintegrators.inventory.dto.request;

import com.solarintegrators.inventory.model.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateUserRequest(

        @NotBlank(message = "A username is required.")
        @Size(max = 64, message = "A username may be at most 64 characters.")
        @Pattern(regexp = "^[A-Za-z0-9._@-]+$",
                message = "A username may contain letters, digits, and . _ @ - only.")
        String username,

        @Size(max = 80, message = "A first name may be at most 80 characters.")
        String firstName,

        @Size(max = 80, message = "A last name may be at most 80 characters.")
        String lastName,

        @Email(message = "Enter a valid email address.")
        @Size(max = 160, message = "An email address may be at most 160 characters.")
        String email,

        @Size(max = 120, message = "A job title may be at most 120 characters.")
        String jobTitle,

        @NotNull(message = "A role is required.")
        UserRole role,

        @Size(min = 10, max = 100, message = "A password must be at least 10 characters.")
        String password,

        Boolean active) {
}
