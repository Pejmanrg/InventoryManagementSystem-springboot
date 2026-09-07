package com.solarintegrators.inventory.service.integration;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Placeholder for the accounting / ERP integration (CSC-13, Phase 3).
 *
 * <p>Not implemented in Phase 1. The accounting platform remains authoritative
 * for purchase orders; this application becomes authoritative for physical
 * receipt. Nothing here touches the accounting database directly - the contract
 * is a versioned API in both directions.</p>
 */
public interface AccountingIntegrationClient {

    /** Pulls open purchase orders inbound. */
    int syncOpenPurchaseOrders();

    /** Publishes a receipt against a purchase order line outbound. */
    void publishReceiptStatus(String purchaseOrderNumber, UUID inventoryItemId, BigDecimal quantityReceived);
}
