package com.solarintegrators.inventory.exception;

import com.solarintegrators.inventory.dto.response.ApiErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import java.util.NoSuchElementException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Turns every exception the API can raise into one JSON error shape.
 *
 * <p>The status mapping follows the exception types the console prototype
 * already threw, so the rules did not have to be rewritten to get correct HTTP
 * semantics:</p>
 *
 * <ul>
 *   <li>{@link IllegalArgumentException} - the caller sent something invalid - 400</li>
 *   <li>{@link NoSuchElementException} - the record does not exist - 404</li>
 *   <li>{@link IllegalStateException} - the record exists but the operation is not
 *       allowed in its current state, or a uniqueness rule was violated - 409</li>
 * </ul>
 *
 * <p>The specific subclasses in this package are handled first so their error
 * codes reach the client; the plain JDK types are the safety net for anything
 * thrown from code that has not been updated.</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /* ------------------------------------------------------------ 400 --- */

    /** Bean Validation failure on a request body: reports every bad field at once. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException ex,
                                                             HttpServletRequest request) {
        List<ApiErrorResponse.FieldError> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> new ApiErrorResponse.FieldError(error.getField(), error.getDefaultMessage()))
                .toList();

        return ResponseEntity.badRequest().body(ApiErrorResponse.validation(
                "The request contains " + fieldErrors.size()
                        + (fieldErrors.size() == 1 ? " invalid field." : " invalid fields."),
                request.getRequestURI(),
                fieldErrors));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConstraintViolation(ConstraintViolationException ex,
                                                                      HttpServletRequest request) {
        List<ApiErrorResponse.FieldError> fieldErrors = ex.getConstraintViolations().stream()
                .map(violation -> new ApiErrorResponse.FieldError(
                        String.valueOf(violation.getPropertyPath()), violation.getMessage()))
                .toList();

        return ResponseEntity.badRequest().body(ApiErrorResponse.validation(
                "The request contains invalid parameters.", request.getRequestURI(), fieldErrors));
    }

    /** Malformed JSON, or a body that could not be parsed into the expected type. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleUnreadable(HttpMessageNotReadableException ex,
                                                              HttpServletRequest request) {
        return ResponseEntity.badRequest().body(ApiErrorResponse.of(400, "Bad Request", "MALFORMED_REQUEST_BODY",
                "The request body could not be read as JSON.", request.getRequestURI()));
    }

    /** A path variable or query parameter of the wrong type - usually a malformed UUID. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex,
                                                                HttpServletRequest request) {
        return ResponseEntity.badRequest().body(ApiErrorResponse.validation(
                "Parameter '" + ex.getName() + "' has an invalid value.",
                request.getRequestURI(),
                List.of(new ApiErrorResponse.FieldError(ex.getName(),
                        "Expected a value of type " + (ex.getRequiredType() == null
                                ? "unknown" : ex.getRequiredType().getSimpleName()) + "."))));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiErrorResponse> handleMissingParameter(MissingServletRequestParameterException ex,
                                                                    HttpServletRequest request) {
        return ResponseEntity.badRequest().body(ApiErrorResponse.validation(
                "A required parameter is missing.",
                request.getRequestURI(),
                List.of(new ApiErrorResponse.FieldError(ex.getParameterName(), "This parameter is required."))));
    }

    /** Application-level bad request, carrying its own error code. */
    @ExceptionHandler(InvalidRequestException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidRequest(InvalidRequestException ex,
                                                                  HttpServletRequest request) {
        List<ApiErrorResponse.FieldError> fieldErrors = ex.getField() == null
                ? null
                : List.of(new ApiErrorResponse.FieldError(ex.getField(), ex.getMessage()));

        return ResponseEntity.badRequest().body(new ApiErrorResponse(
                java.time.Instant.now(), 400, "Bad Request", ex.getCode(), ex.getMessage(),
                request.getRequestURI(), fieldErrors));
    }

    /** Safety net for any remaining IllegalArgumentException. */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalArgument(IllegalArgumentException ex,
                                                                   HttpServletRequest request) {
        return ResponseEntity.badRequest().body(ApiErrorResponse.of(400, "Bad Request", "INVALID_REQUEST",
                ex.getMessage(), request.getRequestURI()));
    }

    /* ------------------------------------------------------------ 403 --- */

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(AccessDeniedException ex,
                                                                HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiErrorResponse.of(403, "Forbidden",
                "ACCESS_DENIED", "Your role does not permit this operation.", request.getRequestURI()));
    }

    /* ------------------------------------------------------------ 404 --- */

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNotFound(ResourceNotFoundException ex,
                                                            HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiErrorResponse.of(404, "Not Found",
                ex.getCode(), ex.getMessage(), request.getRequestURI()));
    }

    /** Safety net: the prototype's services threw the plain JDK type. */
    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ApiErrorResponse> handleNoSuchElement(NoSuchElementException ex,
                                                                 HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiErrorResponse.of(404, "Not Found",
                "RESOURCE_NOT_FOUND", ex.getMessage(), request.getRequestURI()));
    }

    /* ------------------------------------------------------------ 409 --- */

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ApiErrorResponse> handleDuplicate(DuplicateResourceException ex,
                                                             HttpServletRequest request) {
        List<ApiErrorResponse.FieldError> fieldErrors = ex.getField() == null
                ? null
                : List.of(new ApiErrorResponse.FieldError(ex.getField(), ex.getMessage()));

        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(
                java.time.Instant.now(), 409, "Conflict", ex.getCode(), ex.getMessage(),
                request.getRequestURI(), fieldErrors));
    }

    @ExceptionHandler(InvalidAssetStateException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidState(InvalidAssetStateException ex,
                                                                HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiErrorResponse.of(409, "Conflict",
                ex.getCode(), ex.getMessage(), request.getRequestURI()));
    }

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<ApiErrorResponse> handleInsufficientStock(InsufficientStockException ex,
                                                                     HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(
                java.time.Instant.now(), 409, "Conflict", ex.getCode(), ex.getMessage(),
                request.getRequestURI(),
                List.of(new ApiErrorResponse.FieldError("delta", ex.getMessage()))));
    }

    /**
     * A database constraint refused the write - most often the unique index on
     * asset tag or SKU winning a race that the service-level check could not
     * see, or the non-negative quantity check.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleDataIntegrity(DataIntegrityViolationException ex,
                                                                 HttpServletRequest request) {
        log.warn("Database constraint violation on {}: {}", request.getRequestURI(), ex.getMostSpecificCause().getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiErrorResponse.of(409, "Conflict",
                "CONSTRAINT_VIOLATION",
                "The change conflicts with an existing record or a database rule.",
                request.getRequestURI()));
    }

    /** Two writers changed the same row; the loser is asked to retry. */
    @ExceptionHandler({OptimisticLockingFailureException.class, PessimisticLockingFailureException.class})
    public ResponseEntity<ApiErrorResponse> handleLockFailure(Exception ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiErrorResponse.of(409, "Conflict",
                "CONCURRENT_MODIFICATION",
                "This record was changed by someone else. Reload it and try again.",
                request.getRequestURI()));
    }

    /** Safety net: the prototype's services threw the plain JDK type. */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalState(IllegalStateException ex,
                                                                HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiErrorResponse.of(409, "Conflict",
                "INVALID_STATE", ex.getMessage(), request.getRequestURI()));
    }

    /* ------------------------------------------------------------ 500 --- */

    /**
     * Anything unforeseen. The detail goes to the log, not to the response:
     * stack traces and SQL fragments in an error body are an information
     * disclosure finding, and the client can do nothing with them anyway.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception on {}", request.getRequestURI(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiErrorResponse.of(500,
                "Internal Server Error", "INTERNAL_ERROR",
                "The request could not be completed. The error has been logged.",
                request.getRequestURI()));
    }
}
