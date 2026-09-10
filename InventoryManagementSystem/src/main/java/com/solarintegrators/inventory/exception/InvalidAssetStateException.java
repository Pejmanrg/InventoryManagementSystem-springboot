package com.solarintegrators.inventory.exception;

import com.solarintegrators.inventory.model.AssetStatus;

public class InvalidAssetStateException extends IllegalStateException {
    private final AssetStatus currentStatus;

    public InvalidAssetStateException(AssetStatus currentStatus, String message) {
        super(message);
        this.currentStatus = currentStatus;
    }

    public static InvalidAssetStateException cannotCheckOut(String tag, AssetStatus status) {
        return new InvalidAssetStateException(status,
                "Asset " + tag + " cannot be checked out. Current status: " + status + ".");
    }

    public static InvalidAssetStateException notCheckedOut(String tag, AssetStatus status) {
        return new InvalidAssetStateException(status,
                "Asset " + tag + " is not currently checked out. Current status: " + status + ".");
    }

    public static InvalidAssetStateException illegalTransition(String tag, AssetStatus from, AssetStatus to) {
        return new InvalidAssetStateException(from,
                "Asset " + tag + " cannot move from " + from + " to " + to + ".");
    }

    public AssetStatus getCurrentStatus() {
        return currentStatus;
    }
}
