package com.solarintegrators.inventory.dto.response;

import com.solarintegrators.inventory.model.InventoryItem;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * API view of an {@link InventoryItem}.
 *
 * <p>{@code stockState} is derived here rather than stored, so it can never
 * disagree with the quantity it describes.</p>
 */
public record InventoryItemResponse(
        UUID inventoryItemId,
        String sku,
        String description,
        String category,
        String unitOfMeasure,
        BigDecimal quantityOnHand,
        BigDecimal reorderPoint,
        BigDecimal unitCost,
        BigDecimal extendedValue,
        String stockState,
        UUID locationId,
        String locationName,
        Instant lastCountedAt) {

    /** Must be called inside the transaction: it reads the lazy association. */
    public static InventoryItemResponse from(InventoryItem item) {
        BigDecimal quantity = item.getQuantityOnHand() == null ? BigDecimal.ZERO : item.getQuantityOnHand();
        BigDecimal reorder = item.getReorderPoint() == null ? BigDecimal.ZERO : item.getReorderPoint();
        BigDecimal cost = item.getUnitCost();

        String state;
        if (quantity.compareTo(BigDecimal.ZERO) <= 0) {
            state = "CRITICAL";
        } else if (quantity.compareTo(reorder) < 0) {
            state = "LOW";
        } else {
            state = "OK";
        }

        return new InventoryItemResponse(
                item.getInventoryItemId(),
                item.getSku(),
                item.getDescription(),
                item.getCategory(),
                item.getUnitOfMeasure(),
                quantity,
                reorder,
                cost,
                cost == null ? null : quantity.multiply(cost),
                state,
                item.getLocationId(),
                item.getLocation() == null ? null : item.getLocation().getName(),
                item.getLastCountedAt());
    }
}
