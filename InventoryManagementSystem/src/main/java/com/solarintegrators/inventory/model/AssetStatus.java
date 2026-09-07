package com.solarintegrators.inventory.model;

/**
 * Lifecycle states of a uniquely tagged asset.
 *
 * <p>Values are unchanged from the Module 2 console prototype and are persisted
 * as strings so the database stays readable and stable if the order changes.
 * The permitted transitions are documented in the SDD asset lifecycle state
 * machine and enforced by {@code TransactionService}.</p>
 */
public enum AssetStatus {
    AVAILABLE,
    CHECKED_OUT,
    MAINTENANCE,
    LOST,
    RETIRED
}
