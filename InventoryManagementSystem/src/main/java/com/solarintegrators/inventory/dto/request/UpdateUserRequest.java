package com.solarintegrators.inventory.dto.request;

import com.solarintegrators.inventory.model.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(

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

        @NotNull(message = "Specify whether the account is active.")
        Boolean active) {
}
