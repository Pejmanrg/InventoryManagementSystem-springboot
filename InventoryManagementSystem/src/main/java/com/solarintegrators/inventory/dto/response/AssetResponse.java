package com.solarintegrators.inventory.dto.response;

import com.solarintegrators.inventory.model.Asset;
import com.solarintegrators.inventory.model.AssetStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * API view of an {@link Asset}.
 *
 * <p>Associations are flattened to identifier plus display name so a client can
 * render a row without a second request, and so the JSON shape stays stable if
 * the entity mapping changes.</p>
 */
public record AssetResponse(
        UUID assetId,
        String tag,
        String name,
        String category,
        String serialNumber,
        AssetStatus status,
        UUID locationId,
        String locationName,
        UUID custodianEmployeeId,
        String custodianName,
        String condition,
        LocalDate purchaseDate,
        BigDecimal purchaseCost,
        LocalDate warrantyEnd,
        String notes,
        Instant lastTransactionAt,
        Instant createdAt,
        Instant updatedAt) {

    /** Must be called inside the transaction: it reads the lazy associations. */
    public static AssetResponse from(Asset asset) {
        return new AssetResponse(
                asset.getAssetId(),
                asset.getTag(),
                asset.getName(),
                asset.getCategory(),
                asset.getSerialNumber(),
                asset.getStatus(),
                asset.getLocationId(),
                asset.getLocation() == null ? null : asset.getLocation().getName(),
                asset.getCustodianEmployeeId(),
                asset.getCustodian() == null ? null : asset.getCustodian().getName(),
                asset.getCondition(),
                asset.getPurchaseDate(),
                asset.getPurchaseCost(),
                asset.getWarrantyEnd(),
                asset.getNotes(),
                asset.getLastTransactionAt(),
                asset.getCreatedAt(),
                asset.getUpdatedAt());
    }
}
