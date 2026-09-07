package com.solarintegrators.inventory.dto.response;

import java.math.BigDecimal;

/**
 * Result of an inventory adjustment.
 *
 * <p>Returns the before and after quantities together so the caller can display
 * "500 to 450" without keeping the previous value client-side and hoping it is
 * still current.</p>
 */
public record AdjustmentResponse(
        InventoryItemResponse item,
        BigDecimal previousQuantity,
        BigDecimal delta,
        BigDecimal newQuantity,
        String reason,
        String reference) {
}
