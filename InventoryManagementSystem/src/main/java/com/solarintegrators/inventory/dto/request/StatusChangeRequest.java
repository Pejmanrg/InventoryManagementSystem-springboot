package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.Size;
import java.util.UUID;

public record StatusChangeRequest(
        UUID locationId,
        @Size(max = 2000) String notes) {
}
