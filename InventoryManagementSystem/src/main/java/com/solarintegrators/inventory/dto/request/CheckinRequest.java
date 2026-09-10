package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CheckinRequest(
        UUID locationId,
        @Size(max = 32) String condition,
        @Size(max = 2000) String notes,
        boolean sendToMaintenance) {
}
