package com.solarintegrators.inventory.service.integration;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Placeholder for the project / billing integration (CSC-13, Phase 3).
 *
 * <p>Not implemented in Phase 1. Publishes allocation and shipment events so
 * accounts receivable can evaluate whether contractual billing conditions have
 * been met.</p>
 */
public interface ProjectBillingClient {

    void publishAllocation(String projectId, UUID inventoryItemId, BigDecimal quantity);

    void publishShipment(String projectId, UUID assetId);
}
