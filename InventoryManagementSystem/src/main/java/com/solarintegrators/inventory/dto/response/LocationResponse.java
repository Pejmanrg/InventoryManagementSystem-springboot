package com.solarintegrators.inventory.dto.response;

import com.solarintegrators.inventory.model.Location;
import java.util.UUID;

public record LocationResponse(
        UUID locationId,
        String code,
        String name,
        String type,
        String address,
        boolean active) {
    public static LocationResponse from(Location location) {
        if (location == null) {
            return null;
        }
        return new LocationResponse(location.getLocationId(), location.getCode(), location.getName(),
                location.getType(), location.getAddress(), location.isActive());
    }
}
