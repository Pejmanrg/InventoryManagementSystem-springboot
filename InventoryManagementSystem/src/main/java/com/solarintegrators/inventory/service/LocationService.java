package com.solarintegrators.inventory.service;

import com.solarintegrators.inventory.dto.request.CreateLocationRequest;
import com.solarintegrators.inventory.dto.response.LocationResponse;
import com.solarintegrators.inventory.exception.DuplicateResourceException;
import com.solarintegrators.inventory.exception.InvalidRequestException;
import com.solarintegrators.inventory.exception.ResourceNotFoundException;
import com.solarintegrators.inventory.model.Location;
import com.solarintegrators.inventory.repository.LocationRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class LocationService {
    private final LocationRepository locationRepository;
    private final AuditService auditService;

    public LocationService(LocationRepository locationRepository, AuditService auditService) {
        this.locationRepository = locationRepository;
        this.auditService = auditService;
    }

    public LocationResponse createLocation(CreateLocationRequest request) {
        String code = trimToNull(request.code());
        String name = trimToNull(request.name());

        if (code == null) {
            throw InvalidRequestException.required("code", "Location code is required.");
        }
        if (name == null) {
            throw InvalidRequestException.required("name", "Location name is required.");
        }
        if (locationRepository.existsByCodeIgnoreCase(code)) {
            auditService.recordDenied("LOCATION_CREATE", "LOCATION", code,
                    "Create rejected - location code " + code + " already exists.");
            throw DuplicateResourceException.locationCode(code);
        }

        Location saved = locationRepository.save(
                new Location(code, name, request.type(), request.address()));
        auditService.recordEvent("LOCATION_CREATE", "LOCATION", saved.getLocationId(),
                "Location " + saved.getCode() + " (" + saved.getName() + ") created.");
        return LocationResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<LocationResponse> listLocations() {
        return locationRepository.findAllByOrderByNameAsc().stream()
                .map(LocationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public LocationResponse getLocation(UUID locationId) {
        return locationRepository.findById(locationId)
                .map(LocationResponse::from)
                .orElseThrow(() -> ResourceNotFoundException.location(locationId));
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
