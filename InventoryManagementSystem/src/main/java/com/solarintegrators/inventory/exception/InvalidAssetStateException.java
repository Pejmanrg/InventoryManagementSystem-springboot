package com.solarintegrators.inventory.exception;

import com.solarintegrators.inventory.model.AssetStatus;

/**
 * A lifecycle transition was requested that the asset lifecycle state machine
 * does not allow - checking out an asset that is already checked out, checking
 * in one that is not, retiring one that is still assigned. Maps to HTTP 409.
 *
 * <p>Extends {@link IllegalStateException}, matching {@code TransactionService}
 * in the console prototype. No inventory change is committed when it is
 * thrown, which is the alternate flow described in the SDD use case.</p>
 */
public class InvalidAssetStateException extends IllegalStateException implements HasErrorCode {

    private final String code;
    private final AssetStatus currentStatus;

    public InvalidAssetStateException(String code, AssetStatus currentStatus, String message) {
        super(message);
        this.code = code;
        this.currentStatus = currentStatus;
    }

    public static InvalidAssetStateException cannotCheckOut(String tag, AssetStatus status) {
        return new InvalidAssetStateException("ASSET_NOT_AVAILABLE", status,
                "Asset " + tag + " cannot be checked out. Current status: " + status + ".");
    }

    public static InvalidAssetStateException notCheckedOut(String tag, AssetStatus status) {
        return new InvalidAssetStateException("ASSET_NOT_CHECKED_OUT", status,
                "Asset " + tag + " is not currently checked out. Current status: " + status + ".");
    }

    public static InvalidAssetStateException illegalTransition(String tag, AssetStatus from, AssetStatus to) {
        return new InvalidAssetStateException("ASSET_TRANSITION_NOT_ALLOWED", from,
                "Asset " + tag + " cannot move from " + from + " to " + to + ".");
    }

    @Override
    public String getCode() {
        return code;
    }

    public AssetStatus getCurrentStatus() {
        return currentStatus;
    }
}
