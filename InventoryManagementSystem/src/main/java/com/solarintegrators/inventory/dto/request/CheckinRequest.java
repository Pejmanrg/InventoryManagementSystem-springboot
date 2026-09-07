package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Payload for POST /api/assets/{id}/checkin.
 *
 * <p>{@code sendToMaintenance} takes the returned asset to MAINTENANCE instead
 * of AVAILABLE. That is the CHECKED_OUT to MAINTENANCE edge of the asset
 * lifecycle state machine, not a separate workflow.</p>
 */
public record CheckinRequest(
        UUID locationId,
        @Size(max = 32) String condition,
        @Size(max = 2000) String notes,
        boolean sendToMaintenance) {
}
