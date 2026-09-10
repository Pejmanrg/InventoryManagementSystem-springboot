package com.solarintegrators.inventory.service;

import com.solarintegrators.inventory.dto.request.AdjustQuantityRequest;
import com.solarintegrators.inventory.dto.request.CreateInventoryItemRequest;
import com.solarintegrators.inventory.dto.response.AdjustmentResponse;
import com.solarintegrators.inventory.dto.response.InventoryItemResponse;
import com.solarintegrators.inventory.dto.response.PageResponse;
import com.solarintegrators.inventory.exception.DuplicateResourceException;
import com.solarintegrators.inventory.exception.InvalidRequestException;
import com.solarintegrators.inventory.exception.ResourceNotFoundException;
import com.solarintegrators.inventory.model.InventoryItem;
import com.solarintegrators.inventory.model.Location;
import com.solarintegrators.inventory.repository.InventoryRepository;
import com.solarintegrators.inventory.repository.InventorySpecifications;
import com.solarintegrators.inventory.repository.LocationRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class InventoryService {
    private final InventoryRepository inventoryRepository;
    private final LocationRepository locationRepository;
    private final AuditService auditService;

    public InventoryService(InventoryRepository inventoryRepository,
                            LocationRepository locationRepository,
                            AuditService auditService) {
        this.inventoryRepository = inventoryRepository;
        this.locationRepository = locationRepository;
        this.auditService = auditService;
    }

    public InventoryItemResponse createItem(CreateInventoryItemRequest request) {
        String sku = trimToNull(request.sku());
        if (sku == null) {
            throw InvalidRequestException.required("sku", "SKU is required.");
        }
        if (inventoryRepository.existsBySkuIgnoreCase(sku)) {
            auditService.recordDenied("INVENTORY_CREATE", "INVENTORY", sku,
                    "Create rejected - SKU " + sku + " already exists.");
            throw DuplicateResourceException.sku(sku);
        }

        BigDecimal initial = request.initialQuantity() == null ? BigDecimal.ZERO : request.initialQuantity();
        requireWholeUnits(initial, "initialQuantity", "Initial quantity");
        if (initial.compareTo(BigDecimal.ZERO) < 0) {
            throw new InvalidRequestException("initialQuantity",
                    "Initial quantity cannot be negative.");
        }

        Location location = resolveLocation(request.locationId());

        InventoryItem item = new InventoryItem(sku, request.description(), initial, location);
        item.setCategory(request.category());
        item.setUnitOfMeasure(request.unitOfMeasure());
        BigDecimal reorder = request.reorderPoint() == null ? BigDecimal.ZERO : request.reorderPoint();
        requireWholeUnits(reorder, "reorderPoint", "Reorder point");
        item.setReorderPoint(reorder);
        item.setUnitCost(request.unitCost());
        item.setLastCountedAt(Instant.now());

        InventoryItem saved = inventoryRepository.save(item);
        auditService.recordEvent("INVENTORY_CREATE", "INVENTORY", saved.getInventoryItemId(),
                saved.getSku() + " created with quantity " + saved.getQuantityOnHand() + ".");
        return InventoryItemResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public InventoryItemResponse getItem(UUID itemId) {
        return InventoryItemResponse.from(requireItem(itemId));
    }

    @Transactional(readOnly = true)
    public BigDecimal getStock(UUID itemId) {
        return requireItem(itemId).getQuantityOnHand();
    }

    @Transactional(readOnly = true)
    public PageResponse<InventoryItemResponse> listItems(String query,
                                                         UUID locationId,
                                                         String category,
                                                         Boolean lowStockOnly,
                                                         Pageable pageable) {
        Specification<InventoryItem> spec = null;
        spec = and(spec, InventorySpecifications.textMatches(query));
        spec = and(spec, InventorySpecifications.atLocation(locationId));
        spec = and(spec, InventorySpecifications.inCategory(category));
        spec = and(spec, InventorySpecifications.belowReorderPoint(lowStockOnly));

        var page = (spec == null)
                ? inventoryRepository.findAll(pageable)
                : inventoryRepository.findAll(spec, pageable);

        return PageResponse.of(page, InventoryItemResponse::from);
    }

    public AdjustmentResponse adjustQuantity(UUID itemId, AdjustQuantityRequest request) {
        if (request == null || request.delta() == null) {
            throw InvalidRequestException.required("delta", "An adjustment quantity is required.");
        }
        BigDecimal delta = request.delta();
        requireWholeUnits(delta, "delta", "Adjustment quantity");
        if (delta.compareTo(BigDecimal.ZERO) == 0) {
            throw new InvalidRequestException("delta",
                    "Enter an adjustment quantity other than zero.");
        }
        String reason = trimToNull(request.reason());
        if (reason == null) {
            throw InvalidRequestException.required("reason", "An adjustment reason is required.");
        }

        InventoryItem item = inventoryRepository.findWithLockByInventoryItemId(itemId)
                .orElseThrow(() -> ResourceNotFoundException.inventoryItem(itemId));

        BigDecimal previous = item.getQuantityOnHand() == null ? BigDecimal.ZERO : item.getQuantityOnHand();
        BigDecimal updated = previous.add(delta);

        if (updated.compareTo(BigDecimal.ZERO) < 0) {
            auditService.recordDenied("INVENTORY_ADJUST", "INVENTORY", itemId,
                    "Adjustment rejected - " + item.getSku() + " would fall below zero ("
                            + previous + " " + signed(delta) + ").");
            throw new IllegalStateException("Adjustment failed: stock cannot be negative. "
                    + item.getSku() + " has " + previous + " on hand and the requested change is "
                    + delta + ".");
        }

        item.setQuantityOnHand(updated);
        item.setLastCountedAt(Instant.now());
        InventoryItem saved = inventoryRepository.save(item);

        auditService.recordEvent("INVENTORY_ADJUST", "INVENTORY", itemId,
                saved.getSku() + " adjusted by " + signed(delta) + " (" + previous + " to " + updated + ")"
                        + ", reason " + reason
                        + (request.reference() != null && !request.reference().isBlank()
                                ? ", reference " + request.reference() : "") + ".");

        return new AdjustmentResponse(InventoryItemResponse.from(saved), previous, delta, updated,
                reason, request.reference());
    }

    public InventoryItemResponse setThreshold(UUID itemId, BigDecimal reorderPoint) {
        if (reorderPoint == null || reorderPoint.compareTo(BigDecimal.ZERO) < 0) {
            throw InvalidRequestException.required("reorderPoint", "A reorder point of zero or more is required.");
        }
        requireWholeUnits(reorderPoint, "reorderPoint", "Reorder point");

        InventoryItem item = requireItem(itemId);
        item.setReorderPoint(reorderPoint);
        InventoryItem saved = inventoryRepository.save(item);

        auditService.recordEvent("INVENTORY_THRESHOLD", "INVENTORY_ITEM", saved.getInventoryItemId(),
                "Reorder point for " + saved.getSku() + " set to " + reorderPoint + ".");
        return InventoryItemResponse.from(saved);
    }

    private static void requireWholeUnits(BigDecimal value, String field, String label) {
        if (value != null && value.stripTrailingZeros().scale() > 0) {
            throw new InvalidRequestException(field,
                    label + " must be a whole number - stock is counted in whole units.");
        }
    }

    private InventoryItem requireItem(UUID itemId) {
        return inventoryRepository.findById(itemId)
                .orElseThrow(() -> ResourceNotFoundException.inventoryItem(itemId));
    }

    private Location resolveLocation(UUID locationId) {
        if (locationId == null) {
            return null;
        }
        return locationRepository.findById(locationId)
                .orElseThrow(() -> ResourceNotFoundException.location(locationId));
    }

    private static <T> Specification<T> and(Specification<T> base, Specification<T> next) {
        if (next == null) {
            return base;
        }
        return base == null ? next : base.and(next);
    }

    private static String signed(BigDecimal value) {
        return value.compareTo(BigDecimal.ZERO) > 0 ? "+" + value.toPlainString() : value.toPlainString();
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
