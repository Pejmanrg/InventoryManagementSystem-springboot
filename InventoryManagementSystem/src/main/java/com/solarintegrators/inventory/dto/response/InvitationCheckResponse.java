package com.solarintegrators.inventory.dto.response;

import com.solarintegrators.inventory.model.InvitationPurpose;
import java.time.Instant;

public record InvitationCheckResponse(
        String username,
        String displayName,
        InvitationPurpose purpose,
        Instant expiresAt) {
}
