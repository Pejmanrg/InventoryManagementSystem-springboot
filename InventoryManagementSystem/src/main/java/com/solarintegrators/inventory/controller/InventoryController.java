package com.solarintegrators.inventory.controller;

import com.solarintegrators.inventory.dto.request.AdjustQuantityRequest;
import com.solarintegrators.inventory.dto.request.CreateInventoryItemRequest;
import com.solarintegrators.inventory.dto.response.AdjustmentResponse;
import com.solarintegrators.inventory.dto.response.InventoryItemResponse;
import com.solarintegrators.inventory.dto.response.PageResponse;
import com.solarintegrators.inventory.service.InventoryService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Quantity-managed stock. */
@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    /** GET /api/inventory - filtered, paged list. {@code lowStockOnly=true} drives the reorder report. */
    @GetMapping
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','FINANCE','ADMIN')")
    public PageResponse<InventoryItemResponse> listItems(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) UUID locationId,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Boolean lowStockOnly,
            @PageableDefault(size = 25, sort = "sku", direction = Sort.Direction.ASC) Pageable pageable) {

        return inventoryService.listItems(query, locationId, category, lowStockOnly, pageable);
    }

    /** GET /api/inventory/{id} */
    @GetMapping("/{itemId}")
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','FINANCE','ADMIN')")
    public InventoryItemResponse getItem(@PathVariable UUID itemId) {
        return inventoryService.getItem(itemId);
    }

    /** POST /api/inventory */
    @PostMapping
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','FINANCE','ADMIN')")
    public ResponseEntity<InventoryItemResponse> createItem(
            @Valid @RequestBody CreateInventoryItemRequest request) {
        InventoryItemResponse created = inventoryService.createItem(request);
        return ResponseEntity
                .created(URI.create("/api/inventory/" + created.inventoryItemId()))
                .body(created);
    }

    /**
     * POST /api/inventory/{id}/adjust - applies a signed quantity change.
     *
     * <p>409 with code {@code INVENTORY_NEGATIVE_STOCK} when the result would be
     * below zero; nothing is written in that case.</p>
     */
    @PostMapping("/{itemId}/adjust")
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','ADMIN')")
    public AdjustmentResponse adjustQuantity(@PathVariable UUID itemId,
                                             @Valid @RequestBody AdjustQuantityRequest request) {
        return inventoryService.adjustQuantity(itemId, request);
    }
}
