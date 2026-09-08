package com.solarintegrators.inventory.dto.response;

import com.solarintegrators.inventory.model.InvitationPurpose;
import java.time.Instant;

/**
 * What the set-password page is told about a link before anyone types anything.
 *
 * <p>Deliberately thin. Enough to address the person by name and to word the
 * page for an invitation rather than a reset - and nothing more. It carries no
 * email address, no role and no account id, because this is returned to an
 * unauthenticated caller who has presented only a token.</p>
 */
public record InvitationCheckResponse(
        String username,
        String displayName,
        InvitationPurpose purpose,
        Instant expiresAt) {
}
