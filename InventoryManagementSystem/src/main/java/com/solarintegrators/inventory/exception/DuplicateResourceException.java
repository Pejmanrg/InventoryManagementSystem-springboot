package com.solarintegrators.inventory.exception;

/**
 * A uniqueness rule was violated - a duplicate asset tag, SKU, location code,
 * or employee email. Maps to HTTP 409.
 *
 * <p>Extends {@link IllegalStateException}, which is what
 * {@code AssetService.createAsset()} threw in the console prototype.</p>
 */
public class DuplicateResourceException extends IllegalStateException implements HasErrorCode {

    private final String code;
    private final String field;

    public DuplicateResourceException(String code, String field, String message) {
        super(message);
        this.code = code;
        this.field = field;
    }

    public static DuplicateResourceException assetTag(String tag) {
        return new DuplicateResourceException("ASSET_TAG_DUPLICATE", "tag",
                "Asset with tag " + tag + " already exists.");
    }

    public static DuplicateResourceException sku(String sku) {
        return new DuplicateResourceException("INVENTORY_SKU_DUPLICATE", "sku",
                "Inventory item with SKU " + sku + " already exists.");
    }

    public static DuplicateResourceException locationCode(String code) {
        return new DuplicateResourceException("LOCATION_CODE_DUPLICATE", "code",
                "Location with code " + code + " already exists.");
    }

    public static DuplicateResourceException employeeEmail(String email) {
        return new DuplicateResourceException("EMPLOYEE_EMAIL_DUPLICATE", "email",
                "Employee with email " + email + " already exists.");
    }

    @Override
    public String getCode() {
        return code;
    }

    public String getField() {
        return field;
    }
}
