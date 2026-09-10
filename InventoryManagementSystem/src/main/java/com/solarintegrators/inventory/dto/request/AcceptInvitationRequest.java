package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AcceptInvitationRequest(

        @NotBlank(message = "A password is required.")
        @Size(min = 10, max = 100, message = "A password must be at least 10 characters.")
        String newPassword) {
}
