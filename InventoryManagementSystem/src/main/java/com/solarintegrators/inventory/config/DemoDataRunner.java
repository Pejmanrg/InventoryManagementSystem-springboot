package com.solarintegrators.inventory.config;

import com.solarintegrators.inventory.dto.request.AdjustQuantityRequest;
import com.solarintegrators.inventory.dto.request.CheckinRequest;
import com.solarintegrators.inventory.dto.request.CheckoutRequest;
import com.solarintegrators.inventory.dto.request.CreateAssetRequest;
import com.solarintegrators.inventory.dto.request.CreateEmployeeRequest;
import com.solarintegrators.inventory.dto.request.CreateInventoryItemRequest;
import com.solarintegrators.inventory.dto.request.CreateLocationRequest;
import com.solarintegrators.inventory.dto.response.AdjustmentResponse;
import com.solarintegrators.inventory.dto.response.AssetResponse;
import com.solarintegrators.inventory.dto.response.EmployeeResponse;
import com.solarintegrators.inventory.dto.response.InventoryItemResponse;
import com.solarintegrators.inventory.dto.response.LocationResponse;
import com.solarintegrators.inventory.repository.AssetRepository;
import com.solarintegrators.inventory.service.AssetService;
import com.solarintegrators.inventory.service.EmployeeService;
import com.solarintegrators.inventory.service.InventoryService;
import com.solarintegrators.inventory.service.LocationService;
import com.solarintegrators.inventory.service.TransactionService;
import java.math.BigDecimal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

@Configuration
@Profile("demo")
public class DemoDataRunner {
    private static final Logger log = LoggerFactory.getLogger(DemoDataRunner.class);

    @Bean
    public ApplicationRunner seedDemoData(AssetService assetService,
                                          TransactionService transactionService,
                                          InventoryService inventoryService,
                                          LocationService locationService,
                                          EmployeeService employeeService,
                                          AssetRepository assetRepository) {
        return args -> {
            if (assetRepository.count() > 0) {
                log.info("Demo profile active but data already present - skipping seed.");
                return;
            }

            // The services write an audit event for every action and read the
            // actor from the security context. A startup runner has no HTTP
            // request behind it, so it authenticates itself explicitly rather
            // than being recorded as an anonymous change.
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken("demo-seed", null,
                            java.util.List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));

            try {
                log.info("=== Seeding Module 2 demonstration data ===");

                LocationResponse warehouse = locationService.createLocation(new CreateLocationRequest(
                        "WH-SD", "San Diego Warehouse", "WAREHOUSE", "2210 Kettner Blvd, San Diego, CA"));
                LocationResponse van = locationService.createLocation(new CreateLocationRequest(
                        "VAN-12", "Van 12 (Mobile)", "VEHICLE", "Mobile - assigned crew"));

                EmployeeResponse technician = employeeService.createEmployee(new CreateEmployeeRequest(
                        "Maria Alvarez", "malvarez@example-solar.com", "Lead Field Technician",
                        warehouse.locationId(), "HR-4471"));

                // 1. Asset creation and search
                AssetResponse laptop = assetService.createAsset(new CreateAssetRequest(
                        "IT-10042", "Field Laptop Toughbook FZ-55", "IT", "FZ55-8842119",
                        warehouse.locationId(), "GOOD", null, new BigDecimal("3120.00"), null,
                        "Primary field laptop for the PV commissioning crew."));
                log.info("1. Created: {}", laptop.tag());
                log.info("   Search 'Toughbook' returned {} asset(s).",
                        assetService.searchAssets("Toughbook", null, null, null, null,
                                org.springframework.data.domain.PageRequest.of(0, 10)).totalElements());

                // 2. Checkout and check-in
                AssetResponse checkedOut = transactionService.checkOut(laptop.assetId(),
                        new CheckoutRequest(technician.employeeId(), van.locationId(),
                                "Checked out for Riverside commissioning week."));
                log.info("2. After checkout: status={} custodian={}",
                        checkedOut.status(), checkedOut.custodianName());

                AssetResponse checkedIn = transactionService.checkIn(laptop.assetId(),
                        new CheckinRequest(warehouse.locationId(), "GOOD",
                                "Returned in good condition.", false));
                log.info("   After check-in:  status={} custodian={}",
                        checkedIn.status(), checkedIn.custodianName());
                log.info("   Transaction history: {} record(s).",
                        transactionService.getHistory(laptop.assetId()).size());

                // 3. Inventory quantity adjustment
                InventoryItemResponse connectors = inventoryService.createItem(new CreateInventoryItemRequest(
                        "SOL-MC4-100", "MC4 Solar Cable Connectors", "Electrical", "PR",
                        new BigDecimal("500"), new BigDecimal("200"), new BigDecimal("1.85"),
                        warehouse.locationId()));
                log.info("3. Initial stock: {}", connectors.quantityOnHand());

                AdjustmentResponse adjusted = inventoryService.adjustQuantity(
                        connectors.inventoryItemId(),
                        new AdjustQuantityRequest(new BigDecimal("-50"), "ISSUE_TO_JOB",
                                "JOB-2291", "Issued to Riverside array string work."));
                log.info("   Stock after usage (-50): {}", adjusted.newQuantity());

                log.info("=== Demonstration data seeded successfully ===");
            } finally {
                SecurityContextHolder.clearContext();
            }
        };
    }
}
