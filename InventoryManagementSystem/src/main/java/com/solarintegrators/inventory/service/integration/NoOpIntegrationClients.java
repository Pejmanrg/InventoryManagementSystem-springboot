package com.solarintegrators.inventory.service.integration;

import com.solarintegrators.inventory.model.Asset;
import java.math.BigDecimal;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class NoOpIntegrationClients {
    private static final Logger log = LoggerFactory.getLogger(NoOpIntegrationClients.class);

    @Bean
    @ConditionalOnMissingBean(HrIntegrationClient.class)
    public HrIntegrationClient noOpHrIntegrationClient() {
        return new HrIntegrationClient() {
            @Override
            public int syncEmployees() {
                log.debug("HR integration not configured - employee sync skipped.");
                return 0;
            }

            @Override
            public void publishAssignment(Asset asset, String externalHrId) {
                log.debug("HR integration not configured - assignment for {} not published.",
                        asset == null ? "unknown" : asset.getTag());
            }

            @Override
            public void publishReturn(Asset asset, String externalHrId) {
                log.debug("HR integration not configured - return for {} not published.",
                        asset == null ? "unknown" : asset.getTag());
            }
        };
    }

    @Bean
    @ConditionalOnMissingBean(AccountingIntegrationClient.class)
    public AccountingIntegrationClient noOpAccountingIntegrationClient() {
        return new AccountingIntegrationClient() {
            @Override
            public int syncOpenPurchaseOrders() {
                log.debug("Accounting integration not configured - PO sync skipped.");
                return 0;
            }

            @Override
            public void publishReceiptStatus(String purchaseOrderNumber, UUID inventoryItemId,
                                             BigDecimal quantityReceived) {
                log.debug("Accounting integration not configured - receipt for {} not published.",
                        purchaseOrderNumber);
            }
        };
    }

    @Bean
    @ConditionalOnMissingBean(ProjectBillingClient.class)
    public ProjectBillingClient noOpProjectBillingClient() {
        return new ProjectBillingClient() {
            @Override
            public void publishAllocation(String projectId, UUID inventoryItemId, BigDecimal quantity) {
                log.debug("Project/billing integration not configured - allocation for {} not published.",
                        projectId);
            }

            @Override
            public void publishShipment(String projectId, UUID assetId) {
                log.debug("Project/billing integration not configured - shipment for {} not published.",
                        projectId);
            }
        };
    }
}
