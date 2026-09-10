package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CheckoutRequest(
        @NotNull(message = "A receiving employee is required for checkout.")
        UUID employeeId,

        UUID locationId,

        @Size(max = 2000) String notes) {
}
