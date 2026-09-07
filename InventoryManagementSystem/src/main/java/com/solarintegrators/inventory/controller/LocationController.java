package com.solarintegrators.inventory.controller;

import com.solarintegrators.inventory.dto.request.CreateLocationRequest;
import com.solarintegrators.inventory.dto.response.LocationResponse;
import com.solarintegrators.inventory.service.LocationService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Locations. Reference data, so the list is returned unpaged. */
@RestController
@RequestMapping("/api/locations")
public class LocationController {

    private final LocationService locationService;

    public LocationController(LocationService locationService) {
        this.locationService = locationService;
    }

    /** GET /api/locations */
    @GetMapping
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','FINANCE','ADMIN')")
    public List<LocationResponse> listLocations() {
        return locationService.listLocations();
    }

    /** GET /api/locations/{id} */
    @GetMapping("/{locationId}")
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','FINANCE','ADMIN')")
    public LocationResponse getLocation(@PathVariable UUID locationId) {
        return locationService.getLocation(locationId);
    }

    /** POST /api/locations */
    @PostMapping
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<LocationResponse> createLocation(@Valid @RequestBody CreateLocationRequest request) {
        LocationResponse created = locationService.createLocation(request);
        return ResponseEntity
                .created(URI.create("/api/locations/" + created.locationId()))
                .body(created);
    }
}
