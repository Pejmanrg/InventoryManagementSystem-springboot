package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record UpdateAssetRequest(
        @Size(max = 160) String name,
        @Size(max = 32) String category,
        @Size(max = 120) String serialNumber,
        UUID locationId,
        @Size(max = 32) String condition,
        LocalDate purchaseDate,
        @PositiveOrZero BigDecimal purchaseCost,
        LocalDate warrantyEnd,
        @Size(max = 2000) String notes) {
}
