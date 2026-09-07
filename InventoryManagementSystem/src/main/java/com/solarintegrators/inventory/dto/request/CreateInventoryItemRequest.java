package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

/** Payload for POST /api/inventory. */
public record CreateInventoryItemRequest(
        @NotBlank(message = "SKU is required.")
        @Size(max = 64) String sku,

        @Size(max = 255) String description,
        @Size(max = 64) String category,
        @Size(max = 16) String unitOfMeasure,

        @PositiveOrZero(message = "Initial quantity cannot be negative.")
        BigDecimal initialQuantity,

        @PositiveOrZero(message = "Reorder point cannot be negative.")
        BigDecimal reorderPoint,

        @PositiveOrZero(message = "Unit cost cannot be negative.")
        BigDecimal unitCost,

        UUID locationId) {
}
