package com.solarintegrators.inventory.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.solarintegrators.inventory.AbstractIntegrationTest;
import com.solarintegrators.inventory.dto.request.AdjustQuantityRequest;
import com.solarintegrators.inventory.dto.request.CheckoutRequest;
import com.solarintegrators.inventory.dto.request.CreateAssetRequest;
import com.solarintegrators.inventory.dto.response.AssetResponse;
import com.solarintegrators.inventory.dto.response.EmployeeResponse;
import com.solarintegrators.inventory.dto.response.InventoryItemResponse;
import com.solarintegrators.inventory.dto.response.LocationResponse;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Web-layer tests: the HTTP status codes and the JSON error contract.
 *
 * <p>The service tests prove the rules hold. These prove that a client sees the
 * right thing when a rule fires - a 409 rather than a 500, and a body with a
 * machine-readable code rather than a stack trace. Those two failures are what
 * make an API painful to integrate against, and neither is visible from a
 * service test.</p>
 */
@AutoConfigureMockMvc
class AssetApiIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    /* -------------------------------------------------------- happy path -- */

    @Test
    @DisplayName("POST /api/assets returns 201 with a Location header")
    void createsAssetOverHttp() throws Exception {
        LocationResponse warehouse = givenWarehouse();

        String body = objectMapper.writeValueAsString(new CreateAssetRequest(
                "IT-10042", "Field Laptop Toughbook FZ-55", "IT", "FZ55-8842119",
                warehouse.locationId(), "GOOD", null, new BigDecimal("3120.00"), null, null));

        mockMvc.perform(post("/api/assets")
                        .with(httpBasic("manager", "manager123"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", org.hamcrest.Matchers.containsString("/api/assets/")))
                .andExpect(jsonPath("$.tag").value("IT-10042"))
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.custodianEmployeeId").doesNotExist());
    }

    @Test
    @DisplayName("GET /api/assets returns a paged envelope")
    void listsAssets() throws Exception {
        LocationResponse warehouse = givenWarehouse();
        givenAvailableAsset(warehouse);

        mockMvc.perform(get("/api/assets").with(httpBasic("field", "field123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.page").value(0));
    }

    @Test
    @DisplayName("The full checkout, history, check-in cycle works over HTTP")
    void completesLifecycleOverHttp() throws Exception {
        LocationResponse warehouse = givenWarehouse();
        EmployeeResponse technician = givenTechnician();
        AssetResponse asset = givenAvailableAsset(warehouse);

        mockMvc.perform(post("/api/assets/" + asset.assetId() + "/checkout")
                        .with(httpBasic("field", "field123"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CheckoutRequest(technician.employeeId(), null, "Crew assignment."))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CHECKED_OUT"))
                .andExpect(jsonPath("$.custodianName").value("Maria Alvarez"));

        mockMvc.perform(get("/api/assets/" + asset.assetId() + "/history")
                        .with(httpBasic("field", "field123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].type").value("CHECKOUT"))
                .andExpect(jsonPath("$[0].statusFrom").value("AVAILABLE"))
                .andExpect(jsonPath("$[0].statusTo").value("CHECKED_OUT"));

        mockMvc.perform(post("/api/assets/" + asset.assetId() + "/checkin")
                        .with(httpBasic("field", "field123"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AVAILABLE"));
    }

    /* ------------------------------------------------------ error shapes -- */

    @Test
    @DisplayName("400: a missing required field returns the field-level error list")
    void validationFailureReturns400() throws Exception {
        String body = objectMapper.writeValueAsString(new CreateAssetRequest(
                "", "", null, null, null, null, null, null, null, null));

        mockMvc.perform(post("/api/assets")
                        .with(httpBasic("manager", "manager123"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.length()").value(2))
                .andExpect(jsonPath("$.path").value("/api/assets"));
    }

    @Test
    @DisplayName("400: a malformed UUID in the path is a bad request, not a 500")
    void malformedUuidReturns400() throws Exception {
        mockMvc.perform(get("/api/assets/not-a-uuid").with(httpBasic("field", "field123")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("404: an unknown asset id returns the not-found error code")
    void unknownAssetReturns404() throws Exception {
        mockMvc.perform(get("/api/assets/" + UUID.randomUUID()).with(httpBasic("field", "field123")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.code").value("ASSET_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Asset not found")));
    }

    @Test
    @DisplayName("409: a duplicate tag returns ASSET_TAG_DUPLICATE")
    void duplicateTagReturns409() throws Exception {
        LocationResponse warehouse = givenWarehouse();
        givenAvailableAsset(warehouse);

        String body = objectMapper.writeValueAsString(new CreateAssetRequest(
                "IT-10042", "Second Toughbook", null, null,
                warehouse.locationId(), null, null, null, null, null));

        mockMvc.perform(post("/api/assets")
                        .with(httpBasic("manager", "manager123"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.code").value("ASSET_TAG_DUPLICATE"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("tag"));
    }

    @Test
    @DisplayName("409: checking out an asset that is already out returns ASSET_NOT_AVAILABLE")
    void duplicateCheckoutReturns409() throws Exception {
        LocationResponse warehouse = givenWarehouse();
        EmployeeResponse technician = givenTechnician();
        AssetResponse asset = givenAvailableAsset(warehouse);
        String checkoutBody = objectMapper.writeValueAsString(
                new CheckoutRequest(technician.employeeId(), null, null));

        mockMvc.perform(post("/api/assets/" + asset.assetId() + "/checkout")
                        .with(httpBasic("field", "field123"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/assets/" + asset.assetId() + "/checkout")
                        .with(httpBasic("field", "field123"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ASSET_NOT_AVAILABLE"));
    }

    @Test
    @DisplayName("409: an adjustment below zero returns INVENTORY_NEGATIVE_STOCK")
    void negativeStockReturns409() throws Exception {
        InventoryItemResponse item = givenStockedItem(new BigDecimal("500"));

        mockMvc.perform(post("/api/inventory/" + item.inventoryItemId() + "/adjust")
                        .with(httpBasic("field", "field123"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AdjustQuantityRequest(
                                new BigDecimal("-600"), "ISSUE_TO_JOB", null, null))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVENTORY_NEGATIVE_STOCK"));

        assertThat(inventoryService.getStock(item.inventoryItemId())).isEqualByComparingTo("500");
    }

    /* --------------------------------------------------------- security -- */

    @Test
    @DisplayName("401: an unauthenticated request is refused")
    void unauthenticatedRequestIsRejected() throws Exception {
        mockMvc.perform(get("/api/assets"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("403: a finance user may read assets but not create them")
    void readOnlyRoleCannotWrite() throws Exception {
        LocationResponse warehouse = givenWarehouse();

        mockMvc.perform(get("/api/assets").with(httpBasic("finance", "finance123")))
                .andExpect(status().isOk());

        String body = objectMapper.writeValueAsString(new CreateAssetRequest(
                "IT-99999", "Should not be created", null, null,
                warehouse.locationId(), null, null, null, null, null));

        mockMvc.perform(post("/api/assets")
                        .with(httpBasic("finance", "finance123"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        assertThat(assetRepository.count()).isZero();
    }

    @Test
    @DisplayName("403: a field user may not read the audit trail")
    void auditTrailIsRestricted() throws Exception {
        mockMvc.perform(get("/api/audit").with(httpBasic("field", "field123")))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/audit").with(httpBasic("admin", "admin123")))
                .andExpect(status().isOk());
    }
}
