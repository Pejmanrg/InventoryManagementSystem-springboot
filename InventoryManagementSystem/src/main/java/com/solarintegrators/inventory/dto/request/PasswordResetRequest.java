package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * "I have forgotten my password." Unauthenticated by necessity.
 *
 * <p>One field, accepting either a username or an email address, because
 * someone who cannot sign in often cannot remember which of the two they were
 * given. The endpoint answers identically whether or not the account exists -
 * see {@code InvitationController} for why that matters.</p>
 */
public record PasswordResetRequest(

        @NotBlank(message = "Enter your username or email address.")
        @Size(max = 160, message = "That value is too long.")
        String usernameOrEmail) {
}
