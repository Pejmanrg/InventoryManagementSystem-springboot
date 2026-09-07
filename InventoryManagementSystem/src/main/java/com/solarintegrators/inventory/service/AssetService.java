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

/**
 * Creation, retrieval, search, and editing of tagged assets (CSC-03).
 *
 * <p>Ported from the console prototype with its rules intact: an asset needs a
 * tag and a name, the tag must be unique, and a new asset starts AVAILABLE with
 * no custodian. What changed is where the data lives and that the checks now run
 * inside a transaction.</p>
 *
 * <p>Status is deliberately not editable here. Every status change goes through
 * {@link TransactionService} so a transaction record and an audit event are
 * always written with it - a status field that anything can set is a status
 * field with no history behind it.</p>
 */
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

    /**
     * Registers a new asset.
     *
     * @throws InvalidRequestException     tag or name missing (400)
     * @throws DuplicateResourceException  the tag is already in use (409)
     * @throws ResourceNotFoundException   the location does not exist (404)
     */
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
        auditService.record("ASSET_CREATE", "ASSET", saved.getAssetId(),
                saved.getTag() + " created with status " + AssetStatus.AVAILABLE + ".");
        return AssetResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public AssetResponse getAsset(UUID assetId) {
        return AssetResponse.from(requireAsset(assetId));
    }

    /** Tag lookup - the path a barcode or QR scan takes. */
    @Transactional(readOnly = true)
    public AssetResponse getAssetByTag(String tag) {
        return assetRepository.findByTagIgnoreCase(tag)
                .map(AssetResponse::from)
                .orElseThrow(() -> ResourceNotFoundException.asset(tag));
    }

    /**
     * Filtered search. Every parameter is optional; passing none returns every
     * asset, one page at a time.
     */
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

    /** Combines two optional specifications, either of which may be null. */
    private static <T> Specification<T> and(Specification<T> base, Specification<T> next) {
        if (next == null) {
            return base;
        }
        return base == null ? next : base.and(next);
    }

    /**
     * Updates descriptive fields. Null fields are left unchanged, and neither
     * the tag nor the status can be changed here.
     */
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
        auditService.record("ASSET_UPDATE", "ASSET", saved.getAssetId(),
                saved.getTag() + " details updated.");
        return AssetResponse.from(saved);
    }

    /* ------------------------------------------------------------------ *
     * Shared with TransactionService                                      *
     * ------------------------------------------------------------------ */

    /** Loads an asset or throws 404. Package-visible for the lifecycle service. */
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
