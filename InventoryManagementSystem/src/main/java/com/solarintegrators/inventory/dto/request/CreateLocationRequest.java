package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateLocationRequest(
        @NotBlank(message = "Location code is required.")
        @Size(max = 32) String code,

        @NotBlank(message = "Location name is required.")
        @Size(max = 120) String name,

        @Size(max = 32) String type,
        @Size(max = 255) String address) {
}
