package com.solarintegrators.inventory.exception;

/**
 * The request was structurally valid but semantically wrong - a zero-quantity
 * adjustment, a blank asset tag. Maps to HTTP 400.
 *
 * <p>Extends {@link IllegalArgumentException}, which is what the console
 * prototype's services threw for the same conditions.</p>
 */
public class InvalidRequestException extends IllegalArgumentException implements HasErrorCode {

    private final String code;
    private final String field;

    public InvalidRequestException(String code, String field, String message) {
        super(message);
        this.code = code;
        this.field = field;
    }

    public static InvalidRequestException required(String field, String message) {
        return new InvalidRequestException("FIELD_REQUIRED", field, message);
    }

    @Override
    public String getCode() {
        return code;
    }

    public String getField() {
        return field;
    }
}
