package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PasswordResetRequest(

        @NotBlank(message = "Enter your username or email address.")
        @Size(max = 160, message = "That value is too long.")
        String usernameOrEmail) {
}
