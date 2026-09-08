package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Redeems an invitation or reset link by setting a password.
 *
 * <p>No current password and no username: possession of the single-use token
 * is the proof of identity, which is the entire point - the person using this
 * cannot sign in, so they have nothing else to prove it with.</p>
 */
public record AcceptInvitationRequest(

        @NotBlank(message = "A password is required.")
        @Size(min = 10, max = 100, message = "A password must be at least 10 characters.")
        String newPassword) {
}
