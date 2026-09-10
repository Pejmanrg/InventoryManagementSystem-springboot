package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record MoveAssetRequest(
        @NotNull(message = "A destination location is required.")
        UUID locationId,
        @Size(max = 2000) String notes) {
}
