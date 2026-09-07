package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Payload for PUT /api/assets/{id}. Every field is optional; null means "leave
 * unchanged". The asset tag is deliberately absent - transaction history refers
 * to it, so it is set once at creation.
 */
public record UpdateAssetRequest(
        @Size(max = 160) String name,
        @Size(max = 32) String category,
        @Size(max = 120) String serialNumber,
        UUID locationId,
        @Size(max = 32) String condition,
        LocalDate purchaseDate,
        @PositiveOrZero BigDecimal purchaseCost,
        LocalDate warrantyEnd,
        @Size(max = 2000) String notes) {
}
