package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Sets a new password for an account.
 *
 * <p>An administrator reset, not a self-service change: it does not ask for the
 * current password, which is why the endpoint is guarded to ADMIN. A
 * self-service "change my password" flow would need the existing password and
 * is a separate, later concern.</p>
 */
public record ResetPasswordRequest(

        @NotBlank(message = "A new password is required.")
        @Size(min = 10, max = 100, message = "A password must be at least 10 characters.")
        String newPassword) {
}
