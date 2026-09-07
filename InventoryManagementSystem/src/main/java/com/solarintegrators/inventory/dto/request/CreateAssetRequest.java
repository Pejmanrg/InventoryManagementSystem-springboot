package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Payload for POST /api/assets.
 *
 * <p>The two rules the console prototype enforced by hand - tag required, name
 * required - are declared here so the framework rejects the request before it
 * reaches the service, and the service still checks them so the rule holds for
 * any other caller.</p>
 */
public record CreateAssetRequest(
        @NotBlank(message = "Asset tag is required.")
        @Size(max = 64, message = "Asset tag must be 64 characters or fewer.")
        String tag,

        @NotBlank(message = "Asset name is required.")
        @Size(max = 160, message = "Asset name must be 160 characters or fewer.")
        String name,

        @Size(max = 32) String category,
        @Size(max = 120) String serialNumber,
        UUID locationId,
        @Size(max = 32) String condition,
        LocalDate purchaseDate,
        @PositiveOrZero(message = "Purchase cost cannot be negative.") BigDecimal purchaseCost,
        LocalDate warrantyEnd,
        @Size(max = 2000) String notes) {
}
