package com.solarintegrators.inventory.dto.response;

import com.solarintegrators.inventory.model.AssetStatus;
import com.solarintegrators.inventory.model.AssetTransaction;
import com.solarintegrators.inventory.model.TransactionType;
import java.time.Instant;
import java.util.UUID;

/** API view of an {@link AssetTransaction} - one row of an asset's history. */
public record TransactionResponse(
        UUID transactionId,
        UUID assetId,
        String assetTag,
        TransactionType type,
        UUID employeeId,
        String employeeName,
        UUID locationId,
        String locationName,
        AssetStatus statusFrom,
        AssetStatus statusTo,
        Instant timestamp,
        String notes,
        String performedBy) {

    /** Must be called inside the transaction: it reads the lazy associations. */
    public static TransactionResponse from(AssetTransaction transaction) {
        return new TransactionResponse(
                transaction.getTransactionId(),
                transaction.getAssetId(),
                transaction.getAsset() == null ? null : transaction.getAsset().getTag(),
                transaction.getType(),
                transaction.getEmployeeId(),
                transaction.getEmployee() == null ? null : transaction.getEmployee().getName(),
                transaction.getLocation() == null ? null : transaction.getLocation().getLocationId(),
                transaction.getLocation() == null ? null : transaction.getLocation().getName(),
                transaction.getStatusFrom(),
                transaction.getStatusTo(),
                transaction.getTimestamp(),
                transaction.getNotes(),
                transaction.getPerformedBy());
    }
}
