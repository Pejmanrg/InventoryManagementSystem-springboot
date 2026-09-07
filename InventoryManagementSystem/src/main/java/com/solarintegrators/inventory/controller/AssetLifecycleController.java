package com.solarintegrators.inventory.controller;

import com.solarintegrators.inventory.dto.request.CheckinRequest;
import com.solarintegrators.inventory.dto.request.CheckoutRequest;
import com.solarintegrators.inventory.dto.request.MoveAssetRequest;
import com.solarintegrators.inventory.dto.request.StatusChangeRequest;
import com.solarintegrators.inventory.dto.response.AssetResponse;
import com.solarintegrators.inventory.dto.response.TransactionResponse;
import com.solarintegrators.inventory.service.TransactionService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Asset lifecycle transitions and transaction history.
 *
 * <p>This is the HTTP face of the prototype's {@code TransactionController}.
 * Each endpoint is a verb on an existing asset, so each is a POST to a
 * sub-resource rather than a PATCH of a status field: "check this out" is an
 * operation with rules and consequences, not an attribute assignment.</p>
 *
 * <p>Every one of them returns the updated asset, so a client never has to
 * follow up with a GET to find out what state the asset ended in.</p>
 */
@RestController
@RequestMapping("/api/assets")
public class AssetLifecycleController {

    private final TransactionService transactionService;

    public AssetLifecycleController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    /**
     * POST /api/assets/{id}/checkout - assigns the asset to an employee.
     * 409 if the asset is not AVAILABLE.
     */
    @PostMapping("/{assetId}/checkout")
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','ADMIN')")
    public AssetResponse checkOut(@PathVariable UUID assetId,
                                  @Valid @RequestBody CheckoutRequest request) {
        return transactionService.checkOut(assetId, request);
    }

    /**
     * POST /api/assets/{id}/checkin - returns the asset to stock, or to
     * maintenance when the body sets {@code sendToMaintenance}.
     * 409 if the asset is not CHECKED_OUT.
     */
    @PostMapping("/{assetId}/checkin")
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','ADMIN')")
    public AssetResponse checkIn(@PathVariable UUID assetId,
                                 @RequestBody(required = false) @Valid CheckinRequest request) {
        return transactionService.checkIn(assetId, request);
    }

    /** POST /api/assets/{id}/move - transfers the asset between locations. */
    @PostMapping("/{assetId}/move")
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','ADMIN')")
    public AssetResponse move(@PathVariable UUID assetId,
                              @Valid @RequestBody MoveAssetRequest request) {
        return transactionService.move(assetId, request);
    }

    /** POST /api/assets/{id}/maintenance - takes an available asset out of service. */
    @PostMapping("/{assetId}/maintenance")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public AssetResponse sendToMaintenance(@PathVariable UUID assetId,
                                           @RequestBody(required = false) @Valid StatusChangeRequest request) {
        return transactionService.sendToMaintenance(assetId, request);
    }

    /** POST /api/assets/{id}/lost - reports the asset missing. */
    @PostMapping("/{assetId}/lost")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public AssetResponse markLost(@PathVariable UUID assetId,
                                  @RequestBody(required = false) @Valid StatusChangeRequest request) {
        return transactionService.markLost(assetId, request);
    }

    /** POST /api/assets/{id}/recover - returns a lost or serviced asset to AVAILABLE. */
    @PostMapping("/{assetId}/recover")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public AssetResponse recover(@PathVariable UUID assetId,
                                 @RequestBody(required = false) @Valid StatusChangeRequest request) {
        return transactionService.recover(assetId, request);
    }

    /** POST /api/assets/{id}/retire - retires the asset permanently. */
    @PostMapping("/{assetId}/retire")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public AssetResponse retire(@PathVariable UUID assetId,
                                @RequestBody(required = false) @Valid StatusChangeRequest request) {
        return transactionService.retire(assetId, request);
    }

    /** GET /api/assets/{id}/history - full transaction history, newest first. */
    @GetMapping("/{assetId}/history")
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','FINANCE','ADMIN')")
    public List<TransactionResponse> getHistory(@PathVariable UUID assetId) {
        return transactionService.getHistory(assetId);
    }
}
