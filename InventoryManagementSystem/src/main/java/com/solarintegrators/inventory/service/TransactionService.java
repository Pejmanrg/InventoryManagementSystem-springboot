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

        auditService.recordEvent("ASSET_CHECKOUT", "ASSET", assetId,
                asset.getTag() + " checked out to " + employee.getName() + ".");

        return AssetResponse.from(assetRepository.save(asset));
    }

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

        auditService.recordEvent("ASSET_CHECKIN", "ASSET", assetId,
                asset.getTag() + " checked in"
                        + (destination != null ? " at " + destination.getName() : "")
                        + (to == AssetStatus.MAINTENANCE ? " and routed to maintenance." : "."));

        return AssetResponse.from(assetRepository.save(asset));
    }

    public AssetResponse moveAsset(UUID assetId, MoveAssetRequest request) {
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

        auditService.recordEvent("ASSET_MOVE", "ASSET", assetId,
                asset.getTag() + " moved to " + destination.getName() + ".");

        return AssetResponse.from(assetRepository.save(asset));
    }

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

        auditService.recordEvent("ASSET_MAINTENANCE", "ASSET", assetId,
                asset.getTag() + " status changed " + from + " to " + AssetStatus.MAINTENANCE
                        + (request != null && request.notes() != null ? ". " + request.notes() : "."));

        return AssetResponse.from(assetRepository.save(asset));
    }

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

        auditService.recordEvent("ASSET_LOST", "ASSET", assetId,
                asset.getTag() + " reported LOST from " + from
                        + (request != null && request.notes() != null ? ". " + request.notes() : "."));

        return AssetResponse.from(assetRepository.save(asset));
    }

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

        auditService.recordEvent("ASSET_RECOVER", "ASSET", assetId,
                asset.getTag() + " returned to AVAILABLE from " + from + ".");

        return AssetResponse.from(assetRepository.save(asset));
    }

    public AssetResponse dispose(UUID assetId, StatusChangeRequest request) {
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

        auditService.recordEvent("ASSET_DISPOSE", "ASSET", assetId,
                asset.getTag() + " retired from " + from + ".");

        return AssetResponse.from(assetRepository.save(asset));
    }

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

    @Transactional(readOnly = true)
    public PageResponse<TransactionResponse> getRecentTransactions(Pageable pageable) {
        return PageResponse.of(transactionRepository.findAllByOrderByTimestampDesc(pageable),
                TransactionResponse::from);
    }

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
