package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Payload shared by the lifecycle endpoints that need no more than a note and
 * an optional destination: /maintenance, /lost, /recover, /retire.
 */
public record StatusChangeRequest(
        UUID locationId,
        @Size(max = 2000) String notes) {
}
