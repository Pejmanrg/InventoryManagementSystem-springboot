package com.solarintegrators.inventory.model;

/**
 * Types of transaction recorded against a tagged asset.
 *
 * <p>Values are unchanged from the Module 2 console prototype. Quantity changes
 * to {@code InventoryItem} records are not asset transactions; they are recorded
 * as audit events with action {@code INVENTORY_ADJUST}.</p>
 */
public enum TransactionType {
    CHECKOUT,
    CHECKIN,
    MOVE,
    DISPOSE,
    RECOVER
}
