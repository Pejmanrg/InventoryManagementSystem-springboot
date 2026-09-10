package com.solarintegrators.inventory;

import com.solarintegrators.inventory.dto.request.CreateAssetRequest;
import com.solarintegrators.inventory.dto.request.CreateEmployeeRequest;
import com.solarintegrators.inventory.dto.request.CreateInventoryItemRequest;
import com.solarintegrators.inventory.dto.request.CreateLocationRequest;
import com.solarintegrators.inventory.dto.response.AssetResponse;
import com.solarintegrators.inventory.dto.response.EmployeeResponse;
import com.solarintegrators.inventory.dto.response.InventoryItemResponse;
import com.solarintegrators.inventory.dto.response.LocationResponse;
import com.solarintegrators.inventory.repository.AssetRepository;
import com.solarintegrators.inventory.repository.AuditEventRepository;
import com.solarintegrators.inventory.repository.EmployeeRepository;
import com.solarintegrators.inventory.repository.InventoryRepository;
import com.solarintegrators.inventory.repository.LocationRepository;
import com.solarintegrators.inventory.repository.TransactionRepository;
import com.solarintegrators.inventory.service.AssetService;
import com.solarintegrators.inventory.service.EmployeeService;
import com.solarintegrators.inventory.service.InventoryService;
import com.solarintegrators.inventory.service.LocationService;
import com.solarintegrators.inventory.service.TransactionService;
import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.context.SecurityContextHolder;

@SpringBootTest
public abstract class AbstractIntegrationTest {
    @Autowired protected AssetService assetService;
    @Autowired protected TransactionService transactionService;
    @Autowired protected InventoryService inventoryService;
    @Autowired protected LocationService locationService;
    @Autowired protected EmployeeService employeeService;

    @Autowired protected AssetRepository assetRepository;
    @Autowired protected InventoryRepository inventoryRepository;
    @Autowired protected TransactionRepository transactionRepository;
    @Autowired protected LocationRepository locationRepository;
    @Autowired protected EmployeeRepository employeeRepository;
    @Autowired protected AuditEventRepository auditEventRepository;

    @BeforeEach
    void resetDatabase() {
        SecurityContextHolder.clearContext();

        // Order matters: children before parents.
        transactionRepository.deleteAll();
        assetRepository.deleteAll();
        inventoryRepository.deleteAll();
        employeeRepository.deleteAll();
        locationRepository.deleteAll();
        auditEventRepository.deleteAll();
    }

    protected LocationResponse givenWarehouse() {
        return locationService.createLocation(new CreateLocationRequest(
                "WH-SD", "San Diego Warehouse", "WAREHOUSE", "2210 Kettner Blvd, San Diego, CA"));
    }

    protected LocationResponse givenVan() {
        return locationService.createLocation(new CreateLocationRequest(
                "VAN-12", "Van 12 (Mobile)", "VEHICLE", "Mobile - assigned crew"));
    }

    protected EmployeeResponse givenTechnician() {
        return employeeService.createEmployee(new CreateEmployeeRequest(
                "Maria Alvarez", "malvarez@example-solar.com", "Lead Field Technician", null, "HR-4471"));
    }

    protected AssetResponse givenAvailableAsset(LocationResponse location) {
        return assetService.createAsset(new CreateAssetRequest(
                "IT-10042", "Field Laptop Toughbook FZ-55", "IT", "FZ55-8842119",
                location == null ? null : location.locationId(),
                "GOOD", null, new BigDecimal("3120.00"), null, null));
    }

    protected AssetResponse givenAsset(String tag, String name, LocationResponse location) {
        return assetService.createAsset(new CreateAssetRequest(
                tag, name, "TOOL", null,
                location == null ? null : location.locationId(),
                "GOOD", null, null, null, null));
    }

    protected InventoryItemResponse givenStockedItem(BigDecimal quantity) {
        return inventoryService.createItem(new CreateInventoryItemRequest(
                "SOL-MC4-100", "MC4 Solar Cable Connectors", "Electrical", "PR",
                quantity, new BigDecimal("200"), new BigDecimal("1.85"), null));
    }
}
