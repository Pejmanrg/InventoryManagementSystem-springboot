package com.solarintegrators.inventory.exception;

import java.util.NoSuchElementException;

public class ResourceNotFoundException extends NoSuchElementException {

    public ResourceNotFoundException(String message) {
        super(message);
    }

    public static ResourceNotFoundException asset(Object id) {
        return new ResourceNotFoundException("Asset not found: " + id);
    }

    public static ResourceNotFoundException inventoryItem(Object id) {
        return new ResourceNotFoundException("Inventory item not found: " + id);
    }

    public static ResourceNotFoundException location(Object id) {
        return new ResourceNotFoundException("Location not found: " + id);
    }

    public static ResourceNotFoundException employee(Object id) {
        return new ResourceNotFoundException("Employee not found: " + id);
    }
}
