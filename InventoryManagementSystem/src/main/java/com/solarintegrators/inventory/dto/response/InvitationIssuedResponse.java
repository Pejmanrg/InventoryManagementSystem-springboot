package com.solarintegrators.inventory.dto.response;

import java.time.Instant;

public record InvitationIssuedResponse(
        boolean sent,
        String sentTo,
        Instant expiresAt,
        String link) {
}
