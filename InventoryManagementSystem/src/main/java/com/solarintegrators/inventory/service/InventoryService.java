package com.solarintegrators.inventory.service;

import com.solarintegrators.inventory.dto.request.AdjustQuantityRequest;
import com.solarintegrators.inventory.dto.request.CreateInventoryItemRequest;
import com.solarintegrators.inventory.dto.response.AdjustmentResponse;
import com.solarintegrators.inventory.dto.response.InventoryItemResponse;
import com.solarintegrators.inventory.dto.response.PageResponse;
import com.solarintegrators.inventory.exception.DuplicateResourceException;
import com.solarintegrators.inventory.exception.InsufficientStockException;
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

/**
 * Quantity-managed stock (CSC-03).
 *
 * <p>Ported from the console prototype with its central rule unchanged: an
 * adjustment that would leave quantity on hand below zero is refused and nothing
 * is written. The prototype guarded that with a {@code synchronized} method,
 * which only serialises threads inside one JVM. Here the row is locked in the
 * database and a check constraint on the table backs the rule up, so it holds
 * across application instances and against any writer.</p>
 */
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

    /**
     * Creates a stocked item.
     *
     * @throws DuplicateResourceException the SKU is already in use (409)
     */
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
        if (initial.compareTo(BigDecimal.ZERO) < 0) {
            throw new InvalidRequestException("INVENTORY_NEGATIVE_INITIAL", "initialQuantity",
                    "Initial quantity cannot be negative.");
        }

        Location location = resolveLocation(request.locationId());

        InventoryItem item = new InventoryItem(sku, request.description(), initial, location);
        item.setCategory(request.category());
        item.setUnitOfMeasure(request.unitOfMeasure());
        item.setReorderPoint(request.reorderPoint() == null ? BigDecimal.ZERO : request.reorderPoint());
        item.setUnitCost(request.unitCost());
        item.setLastCountedAt(Instant.now());

        InventoryItem saved = inventoryRepository.save(item);
        auditService.record("INVENTORY_CREATE", "INVENTORY", saved.getInventoryItemId(),
                saved.getSku() + " created with quantity " + saved.getQuantityOnHand() + ".");
        return InventoryItemResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public InventoryItemResponse getItem(UUID itemId) {
        return InventoryItemResponse.from(requireItem(itemId));
    }

    /** Current quantity on hand - the prototype's {@code getStock()}. */
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

    /**
     * Applies a signed quantity change.
     *
     * <p>Negative issues stock, positive receives it. The resulting quantity is
     * computed and checked before anything is written; if it would be negative
     * the whole transaction is refused, the attempt is recorded as a denied
     * audit event, and quantity on hand is left exactly as it was.</p>
     *
     * @throws InvalidRequestException     delta is zero or the reason is missing (400)
     * @throws ResourceNotFoundException   the item does not exist (404)
     * @throws InsufficientStockException  the result would be negative (409)
     */
    public AdjustmentResponse adjustQuantity(UUID itemId, AdjustQuantityRequest request) {
        if (request == null || request.delta() == null) {
            throw InvalidRequestException.required("delta", "An adjustment quantity is required.");
        }
        BigDecimal delta = request.delta();
        if (delta.compareTo(BigDecimal.ZERO) == 0) {
            throw new InvalidRequestException("INVENTORY_ZERO_DELTA", "delta",
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
            throw new InsufficientStockException(item.getSku(), previous, delta);
        }

        item.setQuantityOnHand(updated);
        item.setLastCountedAt(Instant.now());
        InventoryItem saved = inventoryRepository.save(item);

        auditService.record("INVENTORY_ADJUST", "INVENTORY", itemId,
                saved.getSku() + " adjusted by " + signed(delta) + " (" + previous + " to " + updated + ")"
                        + ", reason " + reason
                        + (request.reference() != null && !request.reference().isBlank()
                                ? ", reference " + request.reference() : "") + ".");

        return new AdjustmentResponse(InventoryItemResponse.from(saved), previous, delta, updated,
                reason, request.reference());
    }

    /* ------------------------------------------------------------------ */

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
