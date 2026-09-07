package com.solarintegrators.inventory.exception;

import java.math.BigDecimal;

/**
 * An inventory adjustment would have driven quantity on hand below zero.
 * Maps to HTTP 409.
 *
 * <p>Preserves the rule and the message shape of
 * {@code InventoryService.adjustQuantity()} in the console prototype. The same
 * rule is reinforced by a check constraint on the {@code inventory_items}
 * table, so it holds even for writes that bypass this service.</p>
 */
public class InsufficientStockException extends IllegalStateException implements HasErrorCode {

    private final BigDecimal quantityOnHand;
    private final BigDecimal requestedDelta;

    public InsufficientStockException(String sku, BigDecimal quantityOnHand, BigDecimal requestedDelta) {
        super("Adjustment failed: stock cannot be negative. " + sku + " has " + quantityOnHand
                + " on hand and the requested change is " + requestedDelta + ".");
        this.quantityOnHand = quantityOnHand;
        this.requestedDelta = requestedDelta;
    }

    @Override
    public String getCode() {
        return "INVENTORY_NEGATIVE_STOCK";
    }

    public BigDecimal getQuantityOnHand() {
        return quantityOnHand;
    }

    public BigDecimal getRequestedDelta() {
        return requestedDelta;
    }
}
