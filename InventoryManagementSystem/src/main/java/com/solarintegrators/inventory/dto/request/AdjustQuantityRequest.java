package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record AdjustQuantityRequest(
        @NotNull(message = "An adjustment quantity is required.")
        BigDecimal delta,

        @NotBlank(message = "An adjustment reason is required.")
        @Size(max = 32) String reason,

        @Size(max = 64) String reference,

        @Size(max = 2000) String notes) {
}
