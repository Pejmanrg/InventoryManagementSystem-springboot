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

@RestController
@RequestMapping("/api/assets")
public class AssetLifecycleController {
    private final TransactionService transactionService;

    public AssetLifecycleController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @PostMapping("/{assetId}/checkout")
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','ADMIN')")
    public AssetResponse checkOut(@PathVariable UUID assetId,
                                  @Valid @RequestBody CheckoutRequest request) {
        return transactionService.checkOut(assetId, request);
    }

    @PostMapping("/{assetId}/checkin")
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','ADMIN')")
    public AssetResponse checkIn(@PathVariable UUID assetId,
                                 @RequestBody(required = false) @Valid CheckinRequest request) {
        return transactionService.checkIn(assetId, request);
    }

    @PostMapping("/{assetId}/move")
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','ADMIN')")
    public AssetResponse move(@PathVariable UUID assetId,
                              @Valid @RequestBody MoveAssetRequest request) {
        return transactionService.moveAsset(assetId, request);
    }

    @PostMapping("/{assetId}/maintenance")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public AssetResponse sendToMaintenance(@PathVariable UUID assetId,
                                           @RequestBody(required = false) @Valid StatusChangeRequest request) {
        return transactionService.sendToMaintenance(assetId, request);
    }

    @PostMapping("/{assetId}/lost")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public AssetResponse markLost(@PathVariable UUID assetId,
                                  @RequestBody(required = false) @Valid StatusChangeRequest request) {
        return transactionService.markLost(assetId, request);
    }

    @PostMapping("/{assetId}/recover")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public AssetResponse recover(@PathVariable UUID assetId,
                                 @RequestBody(required = false) @Valid StatusChangeRequest request) {
        return transactionService.recover(assetId, request);
    }

    @PostMapping("/{assetId}/retire")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public AssetResponse retire(@PathVariable UUID assetId,
                                @RequestBody(required = false) @Valid StatusChangeRequest request) {
        return transactionService.dispose(assetId, request);
    }

    @GetMapping("/{assetId}/history")
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','FINANCE','ADMIN')")
    public List<TransactionResponse> getHistory(@PathVariable UUID assetId) {
        return transactionService.getHistory(assetId);
    }
}
