package com.solarintegrators.inventory.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.solarintegrators.inventory.AbstractIntegrationTest;
import com.solarintegrators.inventory.dto.request.CreateAssetRequest;
import com.solarintegrators.inventory.dto.request.UpdateAssetRequest;
import com.solarintegrators.inventory.dto.response.AssetResponse;
import com.solarintegrators.inventory.dto.response.LocationResponse;
import com.solarintegrators.inventory.exception.DuplicateResourceException;
import com.solarintegrators.inventory.exception.InvalidRequestException;
import com.solarintegrators.inventory.exception.ResourceNotFoundException;
import com.solarintegrators.inventory.model.AssetStatus;
import com.solarintegrators.inventory.model.AuditOutcome;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;

/**
 * Asset creation, search, and editing.
 *
 * <p>Covers test case TC-01 (create), TC-02 (search), and TC-07 (duplicate tag)
 * from the SDD test plan - the last of which the design document lists as
 * "Pending: dedicated duplicate-tag test still required".</p>
 */
class AssetServiceTest extends AbstractIntegrationTest {

    @Test
    @DisplayName("TC-01: a new asset is created AVAILABLE with no custodian")
    void createsAssetInAvailableState() {
        LocationResponse warehouse = givenWarehouse();

        AssetResponse asset = givenAvailableAsset(warehouse);

        assertThat(asset.assetId()).isNotNull();
        assertThat(asset.tag()).isEqualTo("IT-10042");
        assertThat(asset.status()).isEqualTo(AssetStatus.AVAILABLE);
        assertThat(asset.custodianEmployeeId()).isNull();
        assertThat(asset.locationName()).isEqualTo("San Diego Warehouse");
    }

    @Test
    @DisplayName("TC-07: a duplicate asset tag is rejected and nothing is stored")
    void rejectsDuplicateAssetTag() {
        LocationResponse warehouse = givenWarehouse();
        givenAvailableAsset(warehouse);

        CreateAssetRequest duplicate = new CreateAssetRequest(
                "IT-10042", "Second Toughbook", "IT", "FZ55-9999999",
                warehouse.locationId(), "NEW", null, null, null, null);

        assertThatThrownBy(() -> assetService.createAsset(duplicate))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("IT-10042")
                .hasMessageContaining("already exists");

        // The rule held: the second asset was not stored.
        assertThat(assetRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("A duplicate tag differing only in case is still a duplicate")
    void rejectsDuplicateAssetTagIgnoringCase() {
        LocationResponse warehouse = givenWarehouse();
        givenAvailableAsset(warehouse);

        CreateAssetRequest duplicate = new CreateAssetRequest(
                "it-10042", "Lowercase duplicate", "IT", null,
                warehouse.locationId(), null, null, null, null, null);

        assertThatThrownBy(() -> assetService.createAsset(duplicate))
                .isInstanceOf(DuplicateResourceException.class);
        assertThat(assetRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("A rejected duplicate is recorded in the audit trail as DENIED")
    void recordsDeniedAuditEventForDuplicateTag() {
        LocationResponse warehouse = givenWarehouse();
        givenAvailableAsset(warehouse);

        CreateAssetRequest duplicate = new CreateAssetRequest(
                "IT-10042", "Second Toughbook", null, null,
                warehouse.locationId(), null, null, null, null, null);

        assertThatThrownBy(() -> assetService.createAsset(duplicate))
                .isInstanceOf(DuplicateResourceException.class);

        assertThat(auditEventRepository.findAll())
                .anySatisfy(event -> {
                    assertThat(event.getAction()).isEqualTo("ASSET_CREATE");
                    assertThat(event.getOutcome()).isEqualTo(AuditOutcome.DENIED);
                });
    }

    @Test
    @DisplayName("A blank tag or name is rejected as a bad request")
    void rejectsMissingRequiredFields() {
        assertThatThrownBy(() -> assetService.createAsset(new CreateAssetRequest(
                "   ", "No tag", null, null, null, null, null, null, null, null)))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Asset tag is required");

        assertThatThrownBy(() -> assetService.createAsset(new CreateAssetRequest(
                "IT-99999", "  ", null, null, null, null, null, null, null, null)))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Asset name is required");

        assertThat(assetRepository.count()).isZero();
    }

    @Test
    @DisplayName("TC-02: search matches on tag, name, and serial number")
    void searchesByTagNameAndSerial() {
        LocationResponse warehouse = givenWarehouse();
        givenAvailableAsset(warehouse);
        givenAsset("TOOL-3312", "Milwaukee M18 Hammer Drill", warehouse);

        var byName = assetService.searchAssets("Toughbook", null, null, null, null, PageRequest.of(0, 10));
        assertThat(byName.totalElements()).isEqualTo(1);
        assertThat(byName.content().get(0).tag()).isEqualTo("IT-10042");

        var byTag = assetService.searchAssets("tool-33", null, null, null, null, PageRequest.of(0, 10));
        assertThat(byTag.totalElements()).isEqualTo(1);

        var bySerial = assetService.searchAssets("FZ55-88", null, null, null, null, PageRequest.of(0, 10));
        assertThat(bySerial.totalElements()).isEqualTo(1);

        var everything = assetService.searchAssets(null, null, null, null, null, PageRequest.of(0, 10));
        assertThat(everything.totalElements()).isEqualTo(2);
    }

    @Test
    @DisplayName("Search filters by status and location")
    void searchesByStatusAndLocation() {
        LocationResponse warehouse = givenWarehouse();
        LocationResponse van = givenVan();
        givenAvailableAsset(warehouse);
        givenAsset("TOOL-3312", "Milwaukee M18 Hammer Drill", van);

        var atVan = assetService.searchAssets(null, null, van.locationId(), null, null, PageRequest.of(0, 10));
        assertThat(atVan.totalElements()).isEqualTo(1);
        assertThat(atVan.content().get(0).tag()).isEqualTo("TOOL-3312");

        var available = assetService.searchAssets(null, AssetStatus.AVAILABLE, null, null, null,
                PageRequest.of(0, 10));
        assertThat(available.totalElements()).isEqualTo(2);

        var checkedOut = assetService.searchAssets(null, AssetStatus.CHECKED_OUT, null, null, null,
                PageRequest.of(0, 10));
        assertThat(checkedOut.totalElements()).isZero();
    }

    @Test
    @DisplayName("An unknown asset id produces a not-found error")
    void unknownAssetIsNotFound() {
        assertThatThrownBy(() -> assetService.getAsset(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("Update changes only the fields supplied and never the tag")
    void updatesOnlySuppliedFields() {
        LocationResponse warehouse = givenWarehouse();
        AssetResponse asset = givenAvailableAsset(warehouse);

        AssetResponse updated = assetService.updateAsset(asset.assetId(), new UpdateAssetRequest(
                "Toughbook FZ-55 (refurbished)", null, null, null, "FAIR",
                null, new BigDecimal("2500.00"), null, null));

        assertThat(updated.tag()).isEqualTo("IT-10042");
        assertThat(updated.name()).isEqualTo("Toughbook FZ-55 (refurbished)");
        assertThat(updated.condition()).isEqualTo("FAIR");
        assertThat(updated.purchaseCost()).isEqualByComparingTo("2500.00");
        // Untouched fields survive.
        assertThat(updated.serialNumber()).isEqualTo("FZ55-8842119");
        assertThat(updated.status()).isEqualTo(AssetStatus.AVAILABLE);
    }
}
