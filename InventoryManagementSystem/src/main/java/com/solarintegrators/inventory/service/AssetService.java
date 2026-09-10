package com.solarintegrators.inventory.service;

import com.solarintegrators.inventory.dto.request.CreateAssetRequest;
import com.solarintegrators.inventory.dto.request.UpdateAssetRequest;
import com.solarintegrators.inventory.dto.response.AssetResponse;
import com.solarintegrators.inventory.dto.response.PageResponse;
import com.solarintegrators.inventory.exception.DuplicateResourceException;
import com.solarintegrators.inventory.exception.InvalidRequestException;
import com.solarintegrators.inventory.exception.ResourceNotFoundException;
import com.solarintegrators.inventory.model.Asset;
import com.solarintegrators.inventory.model.AssetStatus;
import com.solarintegrators.inventory.model.Location;
import com.solarintegrators.inventory.repository.AssetRepository;
import com.solarintegrators.inventory.repository.AssetSpecifications;
import com.solarintegrators.inventory.repository.LocationRepository;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AssetService {
    private final AssetRepository assetRepository;
    private final LocationRepository locationRepository;
    private final AuditService auditService;

    public AssetService(AssetRepository assetRepository,
                        LocationRepository locationRepository,
                        AuditService auditService) {
        this.assetRepository = assetRepository;
        this.locationRepository = locationRepository;
        this.auditService = auditService;
    }

    public AssetResponse createAsset(CreateAssetRequest request) {
        String tag = trimToNull(request.tag());
        String name = trimToNull(request.name());

        if (tag == null) {
            throw InvalidRequestException.required("tag", "Asset tag is required.");
        }
        if (name == null) {
            throw InvalidRequestException.required("name", "Asset name is required.");
        }
        if (assetRepository.existsByTagIgnoreCase(tag)) {
            auditService.recordDenied("ASSET_CREATE", "ASSET", tag,
                    "Create rejected - tag " + tag + " already exists.");
            throw DuplicateResourceException.assetTag(tag);
        }

        Location location = resolveLocation(request.locationId());

        Asset asset = new Asset(tag, name, location);
        asset.setCategory(request.category());
        asset.setSerialNumber(request.serialNumber());
        asset.setCondition(request.condition() != null ? request.condition() : "NEW");
        asset.setPurchaseDate(request.purchaseDate());
        asset.setPurchaseCost(request.purchaseCost());
        asset.setWarrantyEnd(request.warrantyEnd());
        asset.setNotes(request.notes());

        Asset saved = assetRepository.save(asset);
        auditService.recordEvent("ASSET_CREATE", "ASSET", saved.getAssetId(),
                saved.getTag() + " created with status " + AssetStatus.AVAILABLE + ".");
        return AssetResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public AssetResponse getAsset(UUID assetId) {
        return AssetResponse.from(requireAsset(assetId));
    }

    @Transactional(readOnly = true)
    public AssetResponse getAssetByTag(String tag) {
        return assetRepository.findByTagIgnoreCase(tag)
                .map(AssetResponse::from)
                .orElseThrow(() -> ResourceNotFoundException.asset(tag));
    }

    @Transactional(readOnly = true)
    public PageResponse<AssetResponse> searchAssets(String query,
                                                    AssetStatus status,
                                                    UUID locationId,
                                                    String category,
                                                    UUID custodianEmployeeId,
                                                    Pageable pageable) {
        Specification<Asset> spec = null;
        spec = and(spec, AssetSpecifications.textMatches(query));
        spec = and(spec, AssetSpecifications.hasStatus(status));
        spec = and(spec, AssetSpecifications.atLocation(locationId));
        spec = and(spec, AssetSpecifications.inCategory(category));
        spec = and(spec, AssetSpecifications.heldBy(custodianEmployeeId));

        var page = (spec == null)
                ? assetRepository.findAll(pageable)
                : assetRepository.findAll(spec, pageable);

        return PageResponse.of(page, AssetResponse::from);
    }

    private static <T> Specification<T> and(Specification<T> base, Specification<T> next) {
        if (next == null) {
            return base;
        }
        return base == null ? next : base.and(next);
    }

    public AssetResponse updateAsset(UUID assetId, UpdateAssetRequest request) {
        Asset asset = requireAsset(assetId);

        if (trimToNull(request.name()) != null) {
            asset.setName(request.name().trim());
        }
        if (request.category() != null) {
            asset.setCategory(request.category());
        }
        if (request.serialNumber() != null) {
            asset.setSerialNumber(request.serialNumber());
        }
        if (request.condition() != null) {
            asset.setCondition(request.condition());
        }
        if (request.purchaseDate() != null) {
            asset.setPurchaseDate(request.purchaseDate());
        }
        if (request.purchaseCost() != null) {
            asset.setPurchaseCost(request.purchaseCost());
        }
        if (request.warrantyEnd() != null) {
            asset.setWarrantyEnd(request.warrantyEnd());
        }
        if (request.notes() != null) {
            asset.setNotes(request.notes());
        }
        if (request.locationId() != null) {
            asset.setLocation(resolveLocation(request.locationId()));
        }

        Asset saved = assetRepository.save(asset);
        auditService.recordEvent("ASSET_UPDATE", "ASSET", saved.getAssetId(),
                saved.getTag() + " details updated.");
        return AssetResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public Asset requireAsset(UUID assetId) {
        return assetRepository.findById(assetId)
                .orElseThrow(() -> ResourceNotFoundException.asset(assetId));
    }

    private Location resolveLocation(UUID locationId) {
        if (locationId == null) {
            return null;
        }
        return locationRepository.findById(locationId)
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
