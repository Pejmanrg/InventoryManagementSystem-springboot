package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** Payload for POST /api/assets/{id}/checkout. */
public record CheckoutRequest(
        @NotNull(message = "A receiving employee is required for checkout.")
        UUID employeeId,

        /** Where the asset will be while assigned. Null keeps the current location. */
        UUID locationId,

        @Size(max = 2000) String notes) {
}
