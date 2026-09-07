package com.solarintegrators.inventory.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

/**
 * The single JSON error shape returned by every failing endpoint.
 *
 * <pre>
 * {
 *   "timestamp": "2026-09-06T12:34:56Z",
 *   "status": 409,
 *   "error": "Conflict",
 *   "code": "ASSET_NOT_AVAILABLE",
 *   "message": "Asset IT-10042 cannot be checked out. Current status: CHECKED_OUT.",
 *   "path": "/api/assets/.../checkout",
 *   "fieldErrors": [ { "field": "employeeId", "message": "..." } ]
 * }
 * </pre>
 *
 * <p>{@code code} is the part a client should branch on; {@code message} is for
 * people. {@code fieldErrors} is present only when validation failed.</p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiErrorResponse(
        Instant timestamp,
        int status,
        String error,
        String code,
        String message,
        String path,
        List<FieldError> fieldErrors) {

    public record FieldError(String field, String message) {
    }

    public static ApiErrorResponse of(int status, String error, String code, String message, String path) {
        return new ApiErrorResponse(Instant.now(), status, error, code, message, path, null);
    }

    public static ApiErrorResponse validation(String message, String path, List<FieldError> fieldErrors) {
        return new ApiErrorResponse(Instant.now(), 400, "Bad Request", "VALIDATION_FAILED",
                message, path, fieldErrors);
    }
}
