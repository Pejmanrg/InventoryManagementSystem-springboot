package com.solarintegrators.inventory.exception;

import java.util.NoSuchElementException;

/**
 * A requested record does not exist. Maps to HTTP 404.
 *
 * <p>Extends {@link NoSuchElementException} so the services keep throwing what
 * the console prototype threw; the subclass only adds an error code.</p>
 */
public class ResourceNotFoundException extends NoSuchElementException implements HasErrorCode {

    private final String code;

    public ResourceNotFoundException(String code, String message) {
        super(message);
        this.code = code;
    }

    public static ResourceNotFoundException asset(Object id) {
        return new ResourceNotFoundException("ASSET_NOT_FOUND", "Asset not found: " + id);
    }

    public static ResourceNotFoundException inventoryItem(Object id) {
        return new ResourceNotFoundException("INVENTORY_ITEM_NOT_FOUND", "Inventory item not found: " + id);
    }

    public static ResourceNotFoundException location(Object id) {
        return new ResourceNotFoundException("LOCATION_NOT_FOUND", "Location not found: " + id);
    }

    public static ResourceNotFoundException employee(Object id) {
        return new ResourceNotFoundException("EMPLOYEE_NOT_FOUND", "Employee not found: " + id);
    }

    @Override
    public String getCode() {
        return code;
    }
}
