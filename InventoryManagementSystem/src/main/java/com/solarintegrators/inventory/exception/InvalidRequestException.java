package com.solarintegrators.inventory.exception;

public class InvalidRequestException extends IllegalArgumentException {
    private final String field;

    public InvalidRequestException(String field, String message) {
        super(message);
        this.field = field;
    }

    public static InvalidRequestException required(String field, String message) {
        return new InvalidRequestException(field, message);
    }

    public String getField() {
        return field;
    }
}
