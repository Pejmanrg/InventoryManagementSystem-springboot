package com.solarintegrators.inventory.dto.response;

import com.solarintegrators.inventory.model.Asset;
import com.solarintegrators.inventory.model.AssetStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

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
