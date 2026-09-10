package com.solarintegrators.inventory.service.integration;

import java.math.BigDecimal;
import java.util.UUID;

public interface AccountingIntegrationClient {
    int syncOpenPurchaseOrders();

    void publishReceiptStatus(String purchaseOrderNumber, UUID inventoryItemId, BigDecimal quantityReceived);
}
