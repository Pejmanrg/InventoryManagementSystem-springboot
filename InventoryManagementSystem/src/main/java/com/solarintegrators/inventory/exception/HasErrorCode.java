package com.solarintegrators.inventory.exception;

/** Exposes a stable, machine-readable code that clients can branch on. */
public interface HasErrorCode {
    String getCode();
}
