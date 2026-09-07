package com.solarintegrators.inventory.service;

import com.solarintegrators.inventory.dto.request.CheckinRequest;
import com.solarintegrators.inventory.dto.request.CheckoutRequest;
import com.solarintegrators.inventory.dto.request.MoveAssetRequest;
import com.solarintegrators.inventory.dto.request.StatusChangeRequest;
import com.solarintegrators.inventory.dto.response.AssetResponse;
import com.solarintegrators.inventory.dto.response.PageResponse;
import com.solarintegrators.inventory.dto.response.TransactionResponse;
import com.solarintegrators.inventory.exception.InvalidAssetStateException;
import com.solarintegrators.inventory.exception.InvalidRequestException;
import com.solarintegrators.inventory.exception.ResourceNotFoundException;
import com.solarintegrators.inventory.model.Asset;
import com.solarintegrators.inventory.model.AssetStatus;
import com.solarintegrators.inventory.model.AssetTransaction;
import com.solarintegrators.inventory.model.Employee;
import com.solarintegrators.inventory.model.Location;
import com.solarintegrators.inventory.model.TransactionType;
import com.solarintegrators.inventory.repository.AssetRepository;
import com.solarintegrators.inventory.repository.EmployeeRepository;
import com.solarintegrators.inventory.repository.LocationRepository;
import com.solarintegrators.inventory.repository.TransactionRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Asset lifecycle operations and transaction history (CSC-04).
 *
 * <p>Ported from the console prototype. {@code checkOut} and {@code checkIn}
 * keep their original rules exactly - an asset must be AVAILABLE to go out and
 * CHECKED_OUT to come back - and the remaining transitions from the SDD asset
 * lifecycle state machine are implemented alongside them.</p>
 *
 * <p>Every operation follows the same shape, which is the sequence in SDD
 * Figure 3: load the asset under a row lock, validate the transition, change
 * the asset, write the history row, write the audit event. All of it in one
 * transaction, so a failure part-way through leaves no partial state - the
 * "avoid saving a partial state" requirement of the process view.</p>
 *
 * <h2>Note on transaction types</h2>
 * <p>{@code TransactionType} keeps the five values of the original model, so
 * the transitions to MAINTENANCE and LOST have no type of their own. Those two
 * are recorded as audit events (actions {@code ASSET_MAINTENANCE} and
 * {@code ASSET_LOST}) and are retrievable with
 * {@code GET /api/audit?entityId={assetId}}. If the team decides they belong in
 * the typed history instead, add MAINTENANCE and LOST to the enum, widen the
 * {@code type} check constraint in a new migration, and pass the new values in
 * {@link #sendToMaintenance} and {@link #markLost}. See README section 8.</p>
 */
@Service
@Transactional
public class TransactionService {

    private final AssetRepository assetRepository;
    private final TransactionRepository transactionRepository;
    private final EmployeeRepository employeeRepository;
    private final LocationRepository locationRepository;
    private final AuditService auditService;

    public TransactionService(AssetRepository assetRepository,
                              TransactionRepository transactionRepository,
                              EmployeeRepository employeeRepository,
                              LocationRepository locationRepository,
                              AuditService auditService) {
        this.assetRepository = assetRepository;
        this.transactionRepository = transactionRepository;
        this.employeeRepository = employeeRepository;
        this.locationRepository = locationRepository;
        this.auditService = auditService;
    }

    /* ================================================================== *
     * Check out                                                          *
     * ================================================================== */

    /**
     * Assigns an available asset to an employee.
     *
     * @throws InvalidRequestException      no receiving employee given (400)
     * @throws ResourceNotFoundException    asset or employee unknown (404)
     * @throws InvalidAssetStateException   the asset is not AVAILABLE (409)
     */
    public AssetResponse checkOut(UUID assetId, CheckoutRequest request) {
        if (request == null || request.employeeId() == null) {
            throw InvalidRequestException.required("employeeId",
                    "A receiving employee is required for checkout.");
        }

        Asset asset = lockAsset(assetId);
        AssetStatus from = asset.getStatus();

        if (from != AssetStatus.AVAILABLE) {
            auditService.recordDenied("ASSET_CHECKOUT", "ASSET", assetId,
                    "Checkout rejected - " + asset.getTag() + " status is " + from + ".");
            throw InvalidAssetStateException.cannotCheckOut(asset.getTag(), from);
        }

        Employee employee = requireEmployee(request.employeeId());
        Location destination = request.locationId() != null
                ? requireLocation(request.locationId())
                : asset.getLocation();

        asset.setStatus(AssetStatus.CHECKED_OUT);
        asset.setCustodian(employee);
        asset.setLocation(destination);
        touch(asset);

        String notes = defaultText(request.notes(), "Checked out to " + employee.getName());
        writeTransaction(asset, TransactionType.CHECKOUT, employee, destination, from,
                AssetStatus.CHECKED_OUT, notes);

        auditService.record("ASSET_CHECKOUT", "ASSET", assetId,
                asset.getTag() + " checked out to " + employee.getName() + ".");

        return AssetResponse.from(assetRepository.save(asset));
    }

    /* ================================================================== *
     * Check in                                                           *
     * ================================================================== */

    /**
     * Returns a checked-out asset to stock, or to maintenance when the return
     * is flagged as needing service.
     *
     * @throws InvalidAssetStateException the asset is not CHECKED_OUT (409)
     */
    public AssetResponse checkIn(UUID assetId, CheckinRequest request) {
        CheckinRequest safe = request == null
                ? new CheckinRequest(null, null, null, false)
                : request;

        Asset asset = lockAsset(assetId);
        AssetStatus from = asset.getStatus();

        if (from != AssetStatus.CHECKED_OUT) {
            auditService.recordDenied("ASSET_CHECKIN", "ASSET", assetId,
                    "Check-in rejected - " + asset.getTag() + " status is " + from + ".");
            throw InvalidAssetStateException.notCheckedOut(asset.getTag(), from);
        }

        Employee previousCustodian = asset.getCustodian();
        Location destination = safe.locationId() != null
                ? requireLocation(safe.locationId())
                : asset.getLocation();
        AssetStatus to = safe.sendToMaintenance() ? AssetStatus.MAINTENANCE : AssetStatus.AVAILABLE;

        asset.setStatus(to);
        asset.setCustodian(null);
        asset.setLocation(destination);
        if (safe.condition() != null && !safe.condition().isBlank()) {
            asset.setCondition(safe.condition());
        }
        touch(asset);

        writeTransaction(asset, TransactionType.CHECKIN, previousCustodian, destination, from, to,
                defaultText(safe.notes(), "Returned"));

        auditService.record("ASSET_CHECKIN", "ASSET", assetId,
                asset.getTag() + " checked in"
                        + (destination != null ? " at " + destination.getName() : "")
                        + (to == AssetStatus.MAINTENANCE ? " and routed to maintenance." : "."));

        return AssetResponse.from(assetRepository.save(asset));
    }

    /* ================================================================== *
     * Move                                                               *
     * ================================================================== */

    /** Transfers an asset between locations, keeping any custodian assignment. */
    public AssetResponse move(UUID assetId, MoveAssetRequest request) {
        if (request == null || request.locationId() == null) {
            throw InvalidRequestException.required("locationId", "A destination location is required.");
        }

        Asset asset = lockAsset(assetId);
        AssetStatus status = asset.getStatus();

        if (status == AssetStatus.RETIRED) {
            auditService.recordDenied("ASSET_MOVE", "ASSET", assetId,
                    "Move rejected - " + asset.getTag() + " is retired.");
            throw InvalidAssetStateException.illegalTransition(asset.getTag(), status, status);
        }

        Location destination = requireLocation(request.locationId());
        asset.setLocation(destination);
        touch(asset);

        writeTransaction(asset, TransactionType.MOVE, asset.getCustodian(), destination, status, status,
                defaultText(request.notes(), "Location transfer"));

        auditService.record("ASSET_MOVE", "ASSET", assetId,
                asset.getTag() + " moved to " + destination.getName() + ".");

        return AssetResponse.from(assetRepository.save(asset));
    }

    /* ================================================================== *
     * Maintenance                                                        *
     * ================================================================== */

    /**
     * Takes an asset out of service. Allowed from AVAILABLE; an asset that is
     * still checked out must be returned first, which is what keeps the
     * custodian record honest.
     */
    public AssetResponse sendToMaintenance(UUID assetId, StatusChangeRequest request) {
        Asset asset = lockAsset(assetId);
        AssetStatus from = asset.getStatus();

        if (from != AssetStatus.AVAILABLE) {
            auditService.recordDenied("ASSET_MAINTENANCE", "ASSET", assetId,
                    "Maintenance rejected - " + asset.getTag() + " status is " + from + ".");
            throw InvalidAssetStateException.illegalTransition(asset.getTag(), from, AssetStatus.MAINTENANCE);
        }

        asset.setStatus(AssetStatus.MAINTENANCE);
        if (request != null && request.locationId() != null) {
            asset.setLocation(requireLocation(request.locationId()));
        }
        touch(asset);

        auditService.record("ASSET_MAINTENANCE", "ASSET", assetId,
                asset.getTag() + " status changed " + from + " to " + AssetStatus.MAINTENANCE
                        + (request != null && request.notes() != null ? ". " + request.notes() : "."));

        return AssetResponse.from(assetRepository.save(asset));
    }

    /* ================================================================== *
     * Lost                                                               *
     * ================================================================== */

    /**
     * Reports an asset missing. Allowed from any state except RETIRED. The
     * custodian is kept, because knowing who last held it is the point.
     */
    public AssetResponse markLost(UUID assetId, StatusChangeRequest request) {
        Asset asset = lockAsset(assetId);
        AssetStatus from = asset.getStatus();

        if (from == AssetStatus.RETIRED || from == AssetStatus.LOST) {
            auditService.recordDenied("ASSET_LOST", "ASSET", assetId,
                    "Report-lost rejected - " + asset.getTag() + " status is " + from + ".");
            throw InvalidAssetStateException.illegalTransition(asset.getTag(), from, AssetStatus.LOST);
        }

        asset.setStatus(AssetStatus.LOST);
        touch(asset);

        auditService.record("ASSET_LOST", "ASSET", assetId,
                asset.getTag() + " reported LOST from " + from
                        + (request != null && request.notes() != null ? ". " + request.notes() : "."));

        return AssetResponse.from(assetRepository.save(asset));
    }

    /* ================================================================== *
     * Recover                                                            *
     * ================================================================== */

    /**
     * Brings an asset back into service: found after being lost, or returned
     * from maintenance. Both are RECOVER transactions because both end the same
     * way - the asset is available again and the record says why.
     */
    public AssetResponse recover(UUID assetId, StatusChangeRequest request) {
        Asset asset = lockAsset(assetId);
        AssetStatus from = asset.getStatus();

        if (from != AssetStatus.LOST && from != AssetStatus.MAINTENANCE) {
            auditService.recordDenied("ASSET_RECOVER", "ASSET", assetId,
                    "Recover rejected - " + asset.getTag() + " status is " + from + ".");
            throw InvalidAssetStateException.illegalTransition(asset.getTag(), from, AssetStatus.AVAILABLE);
        }

        Location destination = (request != null && request.locationId() != null)
                ? requireLocation(request.locationId())
                : asset.getLocation();

        asset.setStatus(AssetStatus.AVAILABLE);
        asset.setCustodian(null);
        asset.setLocation(destination);
        touch(asset);

        writeTransaction(asset, TransactionType.RECOVER, null, destination, from, AssetStatus.AVAILABLE,
                defaultText(request == null ? null : request.notes(),
                        from == AssetStatus.LOST ? "Recovered" : "Returned to service"));

        auditService.record("ASSET_RECOVER", "ASSET", assetId,
                asset.getTag() + " returned to AVAILABLE from " + from + ".");

        return AssetResponse.from(assetRepository.save(asset));
    }

    /* ================================================================== *
     * Retire / dispose                                                   *
     * ================================================================== */

    /**
     * Retires an asset permanently. An asset that is still checked out must be
     * returned first; RETIRED is a terminal state.
     */
    public AssetResponse retire(UUID assetId, StatusChangeRequest request) {
        Asset asset = lockAsset(assetId);
        AssetStatus from = asset.getStatus();

        if (from == AssetStatus.RETIRED || from == AssetStatus.CHECKED_OUT) {
            auditService.recordDenied("ASSET_DISPOSE", "ASSET", assetId,
                    "Retire rejected - " + asset.getTag() + " status is " + from + ".");
            throw InvalidAssetStateException.illegalTransition(asset.getTag(), from, AssetStatus.RETIRED);
        }

        asset.setStatus(AssetStatus.RETIRED);
        asset.setCustodian(null);
        touch(asset);

        writeTransaction(asset, TransactionType.DISPOSE, null, asset.getLocation(), from,
                AssetStatus.RETIRED, defaultText(request == null ? null : request.notes(), "Disposed"));

        auditService.record("ASSET_DISPOSE", "ASSET", assetId,
                asset.getTag() + " retired from " + from + ".");

        return AssetResponse.from(assetRepository.save(asset));
    }

    /* ================================================================== *
     * History                                                            *
     * ================================================================== */

    /** Full transaction history for one asset, newest first. */
    @Transactional(readOnly = true)
    public List<TransactionResponse> getHistory(UUID assetId) {
        if (!assetRepository.existsById(assetId)) {
            throw ResourceNotFoundException.asset(assetId);
        }
        return transactionRepository.findByAsset_AssetIdOrderByTimestampDesc(assetId)
                .stream()
                .map(TransactionResponse::from)
                .toList();
    }

    /** Recent activity across all assets - the dashboard feed. */
    @Transactional(readOnly = true)
    public PageResponse<TransactionResponse> getRecentTransactions(Pageable pageable) {
        return PageResponse.of(transactionRepository.findAllByOrderByTimestampDesc(pageable),
                TransactionResponse::from);
    }

    /* ================================================================== *
     * Internals                                                          *
     * ================================================================== */

    /**
     * Loads the asset with a row lock held to the end of the transaction, so
     * that "check the status, then change it" cannot interleave with another
     * request doing the same thing.
     */
    private Asset lockAsset(UUID assetId) {
        return assetRepository.findWithLockByAssetId(assetId)
                .orElseThrow(() -> ResourceNotFoundException.asset(assetId));
    }

    private Employee requireEmployee(UUID employeeId) {
        return employeeRepository.findById(employeeId)
                .orElseThrow(() -> ResourceNotFoundException.employee(employeeId));
    }

    private Location requireLocation(UUID locationId) {
        return locationRepository.findById(locationId)
                .orElseThrow(() -> ResourceNotFoundException.location(locationId));
    }

    private void writeTransaction(Asset asset, TransactionType type, Employee employee, Location location,
                                  AssetStatus from, AssetStatus to, String notes) {
        transactionRepository.save(new AssetTransaction(
                asset, type, employee, location, from, to, notes, auditService.currentActor()));
    }

    private static void touch(Asset asset) {
        asset.setLastTransactionAt(Instant.now());
    }

    private static String defaultText(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value.trim();
    }
}
