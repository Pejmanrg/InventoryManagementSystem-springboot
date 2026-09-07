package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Payload for POST /api/inventory/{id}/adjust.
 *
 * <p>{@code delta} is signed: negative issues stock, positive receives it. A
 * zero delta is rejected as a bad request - it would write an audit record
 * describing a change that did not happen.</p>
 */
public record AdjustQuantityRequest(
        @NotNull(message = "An adjustment quantity is required.")
        BigDecimal delta,

        @NotBlank(message = "An adjustment reason is required.")
        @Size(max = 32) String reason,

        /** Job number, purchase order, or cycle-count reference. */
        @Size(max = 64) String reference,

        @Size(max = 2000) String notes) {
}
