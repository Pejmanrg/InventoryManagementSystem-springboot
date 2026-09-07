package com.solarintegrators.inventory.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.solarintegrators.inventory.AbstractIntegrationTest;
import com.solarintegrators.inventory.dto.request.CheckinRequest;
import com.solarintegrators.inventory.dto.request.CheckoutRequest;
import com.solarintegrators.inventory.dto.request.MoveAssetRequest;
import com.solarintegrators.inventory.dto.request.StatusChangeRequest;
import com.solarintegrators.inventory.dto.response.AssetResponse;
import com.solarintegrators.inventory.dto.response.EmployeeResponse;
import com.solarintegrators.inventory.dto.response.LocationResponse;
import com.solarintegrators.inventory.dto.response.TransactionResponse;
import com.solarintegrators.inventory.exception.InvalidAssetStateException;
import com.solarintegrators.inventory.exception.InvalidRequestException;
import com.solarintegrators.inventory.exception.ResourceNotFoundException;
import com.solarintegrators.inventory.model.AssetStatus;
import com.solarintegrators.inventory.model.AuditOutcome;
import com.solarintegrators.inventory.model.TransactionType;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Asset lifecycle transitions and history.
 *
 * <p>Covers TC-03 (checkout), TC-04 (check-in), TC-05 (history), TC-08
 * (checkout of an already checked-out asset) and TC-10 (checkout with no
 * employee). TC-08 and TC-10 are the two the SDD lists as pending.</p>
 */
class TransactionServiceTest extends AbstractIntegrationTest {

    @Test
    @DisplayName("TC-03: checkout assigns the custodian and sets CHECKED_OUT")
    void checksOutAvailableAsset() {
        LocationResponse warehouse = givenWarehouse();
        LocationResponse van = givenVan();
        EmployeeResponse technician = givenTechnician();
        AssetResponse asset = givenAvailableAsset(warehouse);

        AssetResponse result = transactionService.checkOut(asset.assetId(),
                new CheckoutRequest(technician.employeeId(), van.locationId(), "Riverside commissioning."));

        assertThat(result.status()).isEqualTo(AssetStatus.CHECKED_OUT);
        assertThat(result.custodianEmployeeId()).isEqualTo(technician.employeeId());
        assertThat(result.custodianName()).isEqualTo("Maria Alvarez");
        assertThat(result.locationName()).isEqualTo("Van 12 (Mobile)");
        assertThat(result.lastTransactionAt()).isNotNull();
    }

    @Test
    @DisplayName("TC-08: checking out an asset that is already out is rejected")
    void rejectsDuplicateCheckout() {
        LocationResponse warehouse = givenWarehouse();
        EmployeeResponse technician = givenTechnician();
        AssetResponse asset = givenAvailableAsset(warehouse);

        transactionService.checkOut(asset.assetId(),
                new CheckoutRequest(technician.employeeId(), null, null));

        assertThatThrownBy(() -> transactionService.checkOut(asset.assetId(),
                new CheckoutRequest(technician.employeeId(), null, null)))
                .isInstanceOf(InvalidAssetStateException.class)
                .hasMessageContaining("cannot be checked out")
                .hasMessageContaining("CHECKED_OUT");

        // The existing custody and status are untouched, and no second
        // CHECKOUT transaction was written.
        AssetResponse unchanged = assetService.getAsset(asset.assetId());
        assertThat(unchanged.status()).isEqualTo(AssetStatus.CHECKED_OUT);
        assertThat(unchanged.custodianEmployeeId()).isEqualTo(technician.employeeId());
        assertThat(transactionRepository.countByAsset_AssetId(asset.assetId())).isEqualTo(1);
    }

    @Test
    @DisplayName("The rejected checkout is recorded in the audit trail as DENIED")
    void recordsDeniedAuditEventForInvalidCheckout() {
        LocationResponse warehouse = givenWarehouse();
        EmployeeResponse technician = givenTechnician();
        AssetResponse asset = givenAvailableAsset(warehouse);
        transactionService.checkOut(asset.assetId(), new CheckoutRequest(technician.employeeId(), null, null));

        assertThatThrownBy(() -> transactionService.checkOut(asset.assetId(),
                new CheckoutRequest(technician.employeeId(), null, null)))
                .isInstanceOf(InvalidAssetStateException.class);

        assertThat(auditEventRepository.findAll())
                .anySatisfy(event -> {
                    assertThat(event.getAction()).isEqualTo("ASSET_CHECKOUT");
                    assertThat(event.getOutcome()).isEqualTo(AuditOutcome.DENIED);
                });
    }

    @Test
    @DisplayName("TC-10: checkout without a receiving employee is a bad request")
    void rejectsCheckoutWithoutEmployee() {
        LocationResponse warehouse = givenWarehouse();
        AssetResponse asset = givenAvailableAsset(warehouse);

        assertThatThrownBy(() -> transactionService.checkOut(asset.assetId(),
                new CheckoutRequest(null, null, null)))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("receiving employee is required");

        assertThat(assetService.getAsset(asset.assetId()).status()).isEqualTo(AssetStatus.AVAILABLE);
    }

    @Test
    @DisplayName("Checkout of an unknown asset is a not-found error")
    void rejectsCheckoutOfUnknownAsset() {
        EmployeeResponse technician = givenTechnician();

        assertThatThrownBy(() -> transactionService.checkOut(UUID.randomUUID(),
                new CheckoutRequest(technician.employeeId(), null, null)))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("TC-04: check-in clears the custodian and returns the asset to AVAILABLE")
    void checksInCheckedOutAsset() {
        LocationResponse warehouse = givenWarehouse();
        EmployeeResponse technician = givenTechnician();
        AssetResponse asset = givenAvailableAsset(warehouse);
        transactionService.checkOut(asset.assetId(), new CheckoutRequest(technician.employeeId(), null, null));

        AssetResponse result = transactionService.checkIn(asset.assetId(),
                new CheckinRequest(warehouse.locationId(), "GOOD", "Returned in good condition.", false));

        assertThat(result.status()).isEqualTo(AssetStatus.AVAILABLE);
        assertThat(result.custodianEmployeeId()).isNull();
        assertThat(result.condition()).isEqualTo("GOOD");
        assertThat(result.locationName()).isEqualTo("San Diego Warehouse");
    }

    @Test
    @DisplayName("Check-in flagged as needing service moves the asset to MAINTENANCE")
    void checksInToMaintenance() {
        LocationResponse warehouse = givenWarehouse();
        EmployeeResponse technician = givenTechnician();
        AssetResponse asset = givenAvailableAsset(warehouse);
        transactionService.checkOut(asset.assetId(), new CheckoutRequest(technician.employeeId(), null, null));

        AssetResponse result = transactionService.checkIn(asset.assetId(),
                new CheckinRequest(warehouse.locationId(), "NEEDS_SERVICE", "Screen cracked.", true));

        assertThat(result.status()).isEqualTo(AssetStatus.MAINTENANCE);
        assertThat(result.custodianEmployeeId()).isNull();
    }

    @Test
    @DisplayName("Checking in an asset that is not checked out is rejected")
    void rejectsInvalidCheckIn() {
        LocationResponse warehouse = givenWarehouse();
        AssetResponse asset = givenAvailableAsset(warehouse);

        assertThatThrownBy(() -> transactionService.checkIn(asset.assetId(),
                new CheckinRequest(null, null, null, false)))
                .isInstanceOf(InvalidAssetStateException.class)
                .hasMessageContaining("not currently checked out");

        assertThat(assetService.getAsset(asset.assetId()).status()).isEqualTo(AssetStatus.AVAILABLE);
        assertThat(transactionRepository.countByAsset_AssetId(asset.assetId())).isZero();
    }

    @Test
    @DisplayName("TC-05: checkout and check-in both appear in history, newest first")
    void recordsTransactionHistory() {
        LocationResponse warehouse = givenWarehouse();
        EmployeeResponse technician = givenTechnician();
        AssetResponse asset = givenAvailableAsset(warehouse);

        transactionService.checkOut(asset.assetId(),
                new CheckoutRequest(technician.employeeId(), null, "Weekly crew assignment."));
        transactionService.checkIn(asset.assetId(),
                new CheckinRequest(warehouse.locationId(), "GOOD", "Returned.", false));

        List<TransactionResponse> history = transactionService.getHistory(asset.assetId());

        assertThat(history).hasSize(2);
        assertThat(history.get(0).type()).isEqualTo(TransactionType.CHECKIN);
        assertThat(history.get(1).type()).isEqualTo(TransactionType.CHECKOUT);

        // Each row carries the transition it represents.
        assertThat(history.get(1).statusFrom()).isEqualTo(AssetStatus.AVAILABLE);
        assertThat(history.get(1).statusTo()).isEqualTo(AssetStatus.CHECKED_OUT);
        assertThat(history.get(0).statusFrom()).isEqualTo(AssetStatus.CHECKED_OUT);
        assertThat(history.get(0).statusTo()).isEqualTo(AssetStatus.AVAILABLE);

        // And the employee on both sides of the assignment.
        assertThat(history.get(1).employeeName()).isEqualTo("Maria Alvarez");
        assertThat(history.get(0).employeeName()).isEqualTo("Maria Alvarez");

        // Newest first.
        assertThat(history.get(0).timestamp()).isAfterOrEqualTo(history.get(1).timestamp());
    }

    @Test
    @DisplayName("History for an unknown asset is a not-found error, not an empty list")
    void historyOfUnknownAssetIsNotFound() {
        assertThatThrownBy(() -> transactionService.getHistory(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("Move records a MOVE transaction and keeps the custodian")
    void movesAssetBetweenLocations() {
        LocationResponse warehouse = givenWarehouse();
        LocationResponse van = givenVan();
        EmployeeResponse technician = givenTechnician();
        AssetResponse asset = givenAvailableAsset(warehouse);
        transactionService.checkOut(asset.assetId(), new CheckoutRequest(technician.employeeId(), null, null));

        AssetResponse moved = transactionService.move(asset.assetId(),
                new MoveAssetRequest(van.locationId(), "Transferred to Van 12."));

        assertThat(moved.locationName()).isEqualTo("Van 12 (Mobile)");
        assertThat(moved.custodianEmployeeId()).isEqualTo(technician.employeeId());
        assertThat(moved.status()).isEqualTo(AssetStatus.CHECKED_OUT);
        assertThat(transactionService.getHistory(asset.assetId()).get(0).type())
                .isEqualTo(TransactionType.MOVE);
    }

    @Test
    @DisplayName("Maintenance, then recover, returns the asset to service")
    void sendsToMaintenanceAndRecovers() {
        LocationResponse warehouse = givenWarehouse();
        AssetResponse asset = givenAvailableAsset(warehouse);

        AssetResponse inService = transactionService.sendToMaintenance(asset.assetId(),
                new StatusChangeRequest(null, "Chuck slipping under load."));
        assertThat(inService.status()).isEqualTo(AssetStatus.MAINTENANCE);

        AssetResponse recovered = transactionService.recover(asset.assetId(),
                new StatusChangeRequest(warehouse.locationId(), "Service complete."));
        assertThat(recovered.status()).isEqualTo(AssetStatus.AVAILABLE);
        assertThat(transactionService.getHistory(asset.assetId()).get(0).type())
                .isEqualTo(TransactionType.RECOVER);
    }

    @Test
    @DisplayName("A checked-out asset cannot be sent to maintenance without being returned")
    void rejectsMaintenanceWhileCheckedOut() {
        LocationResponse warehouse = givenWarehouse();
        EmployeeResponse technician = givenTechnician();
        AssetResponse asset = givenAvailableAsset(warehouse);
        transactionService.checkOut(asset.assetId(), new CheckoutRequest(technician.employeeId(), null, null));

        assertThatThrownBy(() -> transactionService.sendToMaintenance(asset.assetId(),
                new StatusChangeRequest(null, null)))
                .isInstanceOf(InvalidAssetStateException.class);
    }

    @Test
    @DisplayName("Lost then recovered returns the asset to AVAILABLE")
    void marksLostAndRecovers() {
        LocationResponse warehouse = givenWarehouse();
        AssetResponse asset = givenAvailableAsset(warehouse);

        AssetResponse lost = transactionService.markLost(asset.assetId(),
                new StatusChangeRequest(null, "Missing from site container."));
        assertThat(lost.status()).isEqualTo(AssetStatus.LOST);

        AssetResponse recovered = transactionService.recover(asset.assetId(),
                new StatusChangeRequest(warehouse.locationId(), "Found in Van 07."));
        assertThat(recovered.status()).isEqualTo(AssetStatus.AVAILABLE);
    }

    @Test
    @DisplayName("Retire writes a DISPOSE transaction; a retired asset is terminal")
    void retiresAsset() {
        LocationResponse warehouse = givenWarehouse();
        AssetResponse asset = givenAvailableAsset(warehouse);

        AssetResponse retired = transactionService.retire(asset.assetId(),
                new StatusChangeRequest(null, "E-waste certificate EW-88213."));

        assertThat(retired.status()).isEqualTo(AssetStatus.RETIRED);
        assertThat(transactionService.getHistory(asset.assetId()).get(0).type())
                .isEqualTo(TransactionType.DISPOSE);

        assertThatThrownBy(() -> transactionService.retire(asset.assetId(),
                new StatusChangeRequest(null, null)))
                .isInstanceOf(InvalidAssetStateException.class);
    }

    @Test
    @DisplayName("A checked-out asset cannot be retired before it is returned")
    void rejectsRetireWhileCheckedOut() {
        LocationResponse warehouse = givenWarehouse();
        EmployeeResponse technician = givenTechnician();
        AssetResponse asset = givenAvailableAsset(warehouse);
        transactionService.checkOut(asset.assetId(), new CheckoutRequest(technician.employeeId(), null, null));

        assertThatThrownBy(() -> transactionService.retire(asset.assetId(),
                new StatusChangeRequest(null, null)))
                .isInstanceOf(InvalidAssetStateException.class);

        assertThat(assetService.getAsset(asset.assetId()).status()).isEqualTo(AssetStatus.CHECKED_OUT);
    }
}
