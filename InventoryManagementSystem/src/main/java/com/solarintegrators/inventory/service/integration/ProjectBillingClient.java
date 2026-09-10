package com.solarintegrators.inventory.service.integration;

import java.math.BigDecimal;
import java.util.UUID;

public interface ProjectBillingClient {
    void publishAllocation(String projectId, UUID inventoryItemId, BigDecimal quantity);

    void publishShipment(String projectId, UUID assetId);
}
