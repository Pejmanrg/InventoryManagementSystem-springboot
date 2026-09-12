package com.solarintegrators.inventory.dto.response;

import java.math.BigDecimal;

public record AdjustmentResponse(
        InventoryItemResponse item,
        BigDecimal previousQuantity,
        BigDecimal delta,
        BigDecimal newQuantity,
        String reason,
        String reference,
        String employeeName) {
}
