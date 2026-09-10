package com.solarintegrators.inventory.controller;

import com.solarintegrators.inventory.dto.request.CreateAssetRequest;
import com.solarintegrators.inventory.dto.request.UpdateAssetRequest;
import com.solarintegrators.inventory.dto.response.AssetResponse;
import com.solarintegrators.inventory.dto.response.PageResponse;
import com.solarintegrators.inventory.model.AssetStatus;
import com.solarintegrators.inventory.service.AssetService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/assets")
public class AssetController {
    private final AssetService assetService;

    public AssetController(AssetService assetService) {
        this.assetService = assetService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','FINANCE','ADMIN')")
    public PageResponse<AssetResponse> searchAssets(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) AssetStatus status,
            @RequestParam(required = false) UUID locationId,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) UUID custodianEmployeeId,
            @PageableDefault(size = 25, sort = "tag", direction = Sort.Direction.ASC) Pageable pageable) {
        return assetService.searchAssets(query, status, locationId, category, custodianEmployeeId, pageable);
    }

    @GetMapping("/{assetId}")
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','FINANCE','ADMIN')")
    public AssetResponse getAsset(@PathVariable UUID assetId) {
        return assetService.getAsset(assetId);
    }

    @GetMapping("/by-tag/{tag}")
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','FINANCE','ADMIN')")
    public AssetResponse getAssetByTag(@PathVariable String tag) {
        return assetService.getAssetByTag(tag);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','ADMIN')")
    public ResponseEntity<AssetResponse> createAsset(@Valid @RequestBody CreateAssetRequest request) {
        AssetResponse created = assetService.createAsset(request);
        return ResponseEntity
                .created(URI.create("/api/assets/" + created.assetId()))
                .body(created);
    }

    @PutMapping("/{assetId}")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public AssetResponse updateAsset(@PathVariable UUID assetId,
                                     @Valid @RequestBody UpdateAssetRequest request) {
        return assetService.updateAsset(assetId, request);
    }
}
