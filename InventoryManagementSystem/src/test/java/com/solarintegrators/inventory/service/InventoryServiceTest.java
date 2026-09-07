package com.solarintegrators.inventory.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.solarintegrators.inventory.AbstractIntegrationTest;
import com.solarintegrators.inventory.dto.request.AdjustQuantityRequest;
import com.solarintegrators.inventory.dto.request.CreateInventoryItemRequest;
import com.solarintegrators.inventory.dto.response.AdjustmentResponse;
import com.solarintegrators.inventory.dto.response.InventoryItemResponse;
import com.solarintegrators.inventory.exception.DuplicateResourceException;
import com.solarintegrators.inventory.exception.InsufficientStockException;
import com.solarintegrators.inventory.exception.InvalidRequestException;
import com.solarintegrators.inventory.exception.ResourceNotFoundException;
import com.solarintegrators.inventory.model.AuditOutcome;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;

/**
 * Quantity-managed stock.
 *
 * <p>Covers TC-06 (adjustment) and TC-09 (adjustment below zero) - the second
 * being the boundary case the SDD records as implemented but not yet
 * executed.</p>
 */
class InventoryServiceTest extends AbstractIntegrationTest {

    @Test
    @DisplayName("TC-06: an adjustment of -50 against 500 leaves 450")
    void adjustsQuantityDownwards() {
        InventoryItemResponse item = givenStockedItem(new BigDecimal("500"));

        AdjustmentResponse result = inventoryService.adjustQuantity(item.inventoryItemId(),
                new AdjustQuantityRequest(new BigDecimal("-50"), "ISSUE_TO_JOB", "JOB-2291",
                        "Issued to Riverside array string work."));

        assertThat(result.previousQuantity()).isEqualByComparingTo("500");
        assertThat(result.newQuantity()).isEqualByComparingTo("450");
        assertThat(result.item().quantityOnHand()).isEqualByComparingTo("450");
        assertThat(inventoryService.getStock(item.inventoryItemId())).isEqualByComparingTo("450");
    }

    @Test
    @DisplayName("A positive adjustment receives stock")
    void adjustsQuantityUpwards() {
        InventoryItemResponse item = givenStockedItem(new BigDecimal("500"));

        AdjustmentResponse result = inventoryService.adjustQuantity(item.inventoryItemId(),
                new AdjustQuantityRequest(new BigDecimal("2000"), "RECEIPT", "PO-8841", null));

        assertThat(result.newQuantity()).isEqualByComparingTo("2500");
    }

    @Test
    @DisplayName("TC-09: an adjustment that would go below zero is rejected and stock is unchanged")
    void rejectsNegativeStock() {
        InventoryItemResponse item = givenStockedItem(new BigDecimal("500"));

        assertThatThrownBy(() -> inventoryService.adjustQuantity(item.inventoryItemId(),
                new AdjustQuantityRequest(new BigDecimal("-600"), "ISSUE_TO_JOB", null, null)))
                .isInstanceOf(InsufficientStockException.class)
                .hasMessageContaining("cannot be negative");

        // The critical assertion: the rejection left the balance alone.
        assertThat(inventoryService.getStock(item.inventoryItemId())).isEqualByComparingTo("500");
    }

    @Test
    @DisplayName("Reducing stock to exactly zero is allowed")
    void allowsAdjustmentToExactlyZero() {
        InventoryItemResponse item = givenStockedItem(new BigDecimal("40"));

        AdjustmentResponse result = inventoryService.adjustQuantity(item.inventoryItemId(),
                new AdjustQuantityRequest(new BigDecimal("-40"), "ISSUE_TO_JOB", "JOB-2280", null));

        assertThat(result.newQuantity()).isEqualByComparingTo("0");
        assertThat(result.item().stockState()).isEqualTo("CRITICAL");
    }

    @Test
    @DisplayName("A rejected adjustment is recorded in the audit trail as DENIED")
    void recordsDeniedAuditEventForNegativeStock() {
        InventoryItemResponse item = givenStockedItem(new BigDecimal("500"));

        assertThatThrownBy(() -> inventoryService.adjustQuantity(item.inventoryItemId(),
                new AdjustQuantityRequest(new BigDecimal("-600"), "ISSUE_TO_JOB", null, null)))
                .isInstanceOf(InsufficientStockException.class);

        assertThat(auditEventRepository.findAll())
                .anySatisfy(event -> {
                    assertThat(event.getAction()).isEqualTo("INVENTORY_ADJUST");
                    assertThat(event.getOutcome()).isEqualTo(AuditOutcome.DENIED);
                });
    }

    @Test
    @DisplayName("A successful adjustment is recorded in the audit trail")
    void recordsAuditEventForSuccessfulAdjustment() {
        InventoryItemResponse item = givenStockedItem(new BigDecimal("500"));

        inventoryService.adjustQuantity(item.inventoryItemId(),
                new AdjustQuantityRequest(new BigDecimal("-50"), "ISSUE_TO_JOB", "JOB-2291", null));

        assertThat(auditEventRepository.findAll())
                .anySatisfy(event -> {
                    assertThat(event.getAction()).isEqualTo("INVENTORY_ADJUST");
                    assertThat(event.getOutcome()).isEqualTo(AuditOutcome.SUCCESS);
                    assertThat(event.getSummary()).contains("SOL-MC4-100").contains("500").contains("450");
                });
    }

    @Test
    @DisplayName("A zero-quantity adjustment is a bad request")
    void rejectsZeroDelta() {
        InventoryItemResponse item = givenStockedItem(new BigDecimal("500"));

        assertThatThrownBy(() -> inventoryService.adjustQuantity(item.inventoryItemId(),
                new AdjustQuantityRequest(BigDecimal.ZERO, "CYCLE_COUNT", null, null)))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("other than zero");
    }

    @Test
    @DisplayName("An adjustment without a reason is a bad request")
    void rejectsMissingReason() {
        InventoryItemResponse item = givenStockedItem(new BigDecimal("500"));

        assertThatThrownBy(() -> inventoryService.adjustQuantity(item.inventoryItemId(),
                new AdjustQuantityRequest(new BigDecimal("-1"), "  ", null, null)))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("reason is required");
    }

    @Test
    @DisplayName("Adjusting an unknown item is a not-found error")
    void rejectsAdjustmentOfUnknownItem() {
        assertThatThrownBy(() -> inventoryService.adjustQuantity(UUID.randomUUID(),
                new AdjustQuantityRequest(new BigDecimal("-1"), "ISSUE_TO_JOB", null, null)))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("A duplicate SKU is rejected")
    void rejectsDuplicateSku() {
        givenStockedItem(new BigDecimal("500"));

        assertThatThrownBy(() -> inventoryService.createItem(new CreateInventoryItemRequest(
                "SOL-MC4-100", "Duplicate", null, "EA", BigDecimal.TEN, null, null, null)))
                .isInstanceOf(DuplicateResourceException.class);

        assertThat(inventoryRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("Stock state is derived from quantity against the reorder point")
    void derivesStockState() {
        InventoryItemResponse healthy = givenStockedItem(new BigDecimal("500"));
        assertThat(healthy.stockState()).isEqualTo("OK");

        AdjustmentResponse low = inventoryService.adjustQuantity(healthy.inventoryItemId(),
                new AdjustQuantityRequest(new BigDecimal("-350"), "ISSUE_TO_JOB", null, null));
        assertThat(low.item().stockState()).isEqualTo("LOW");
    }

    @Test
    @DisplayName("The low-stock filter returns only items at or below the reorder point")
    void filtersLowStockItems() {
        InventoryItemResponse item = givenStockedItem(new BigDecimal("500"));
        inventoryService.createItem(new CreateInventoryItemRequest(
                "CLMP-END", "IronRidge End Clamp", "Racking", "EA",
                new BigDecimal("180"), new BigDecimal("400"), new BigDecimal("2.35"), null));

        var lowStock = inventoryService.listItems(null, null, null, true, PageRequest.of(0, 10));

        assertThat(lowStock.totalElements()).isEqualTo(1);
        assertThat(lowStock.content().get(0).sku()).isEqualTo("CLMP-END");
        assertThat(item.quantityOnHand()).isEqualByComparingTo("500");
    }
}
