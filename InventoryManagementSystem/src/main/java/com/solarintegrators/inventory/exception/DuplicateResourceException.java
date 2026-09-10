package com.solarintegrators.inventory.exception;

public class DuplicateResourceException extends IllegalStateException {
    private final String field;

    public DuplicateResourceException(String field, String message) {
        super(message);
        this.field = field;
    }

    public static DuplicateResourceException assetTag(String tag) {
        return new DuplicateResourceException("tag",
                "Asset with tag " + tag + " already exists.");
    }

    public static DuplicateResourceException sku(String sku) {
        return new DuplicateResourceException("sku",
                "Inventory item with SKU " + sku + " already exists.");
    }

    public static DuplicateResourceException locationCode(String code) {
        return new DuplicateResourceException("code",
                "Location with code " + code + " already exists.");
    }

    public static DuplicateResourceException employeeEmail(String email) {
        return new DuplicateResourceException("email",
                "Employee with email " + email + " already exists.");
    }

    public String getField() {
        return field;
    }
}
