package com.solarintegrators.inventory.service;

import com.solarintegrators.inventory.dto.request.CreateEmployeeRequest;
import com.solarintegrators.inventory.dto.response.AssetResponse;
import com.solarintegrators.inventory.dto.response.EmployeeResponse;
import com.solarintegrators.inventory.exception.DuplicateResourceException;
import com.solarintegrators.inventory.exception.InvalidRequestException;
import com.solarintegrators.inventory.exception.ResourceNotFoundException;
import com.solarintegrators.inventory.model.Employee;
import com.solarintegrators.inventory.model.Location;
import com.solarintegrators.inventory.repository.AssetRepository;
import com.solarintegrators.inventory.repository.AssetSpecifications;
import com.solarintegrators.inventory.repository.EmployeeRepository;
import com.solarintegrators.inventory.repository.LocationRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Employees that assets can be assigned to.
 *
 * <p>Maintained by hand in Phase 1. When the HR integration is built (CSC-13)
 * this becomes a projection of the HR platform, matched on
 * {@code externalHrId}; that column exists now so records created today can be
 * reconciled later without a migration.</p>
 *
 * <p>Assets are assigned to employees through the check-out workflow rather than
 * by editing an employee, so every assignment produces a transaction record.
 * {@link #getAssignedAssets} is the read side of that relationship.</p>
 */
@Service
@Transactional
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final LocationRepository locationRepository;
    private final AssetRepository assetRepository;
    private final AuditService auditService;

    public EmployeeService(EmployeeRepository employeeRepository,
                           LocationRepository locationRepository,
                           AssetRepository assetRepository,
                           AuditService auditService) {
        this.employeeRepository = employeeRepository;
        this.locationRepository = locationRepository;
        this.assetRepository = assetRepository;
        this.auditService = auditService;
    }

    public EmployeeResponse createEmployee(CreateEmployeeRequest request) {
        String name = trimToNull(request.name());
        if (name == null) {
            throw InvalidRequestException.required("name", "Employee name is required.");
        }

        String email = trimToNull(request.email());
        if (email != null && employeeRepository.existsByEmailIgnoreCase(email)) {
            auditService.recordDenied("EMPLOYEE_CREATE", "EMPLOYEE", email,
                    "Create rejected - email " + email + " already exists.");
            throw DuplicateResourceException.employeeEmail(email);
        }

        Location homeLocation = null;
        if (request.homeLocationId() != null) {
            homeLocation = locationRepository.findById(request.homeLocationId())
                    .orElseThrow(() -> ResourceNotFoundException.location(request.homeLocationId()));
        }

        Employee employee = new Employee(name, email, request.jobTitle(), homeLocation);
        employee.setExternalHrId(trimToNull(request.externalHrId()));

        Employee saved = employeeRepository.save(employee);
        auditService.record("EMPLOYEE_CREATE", "EMPLOYEE", saved.getEmployeeId(),
                "Employee " + saved.getName() + " created.");
        return EmployeeResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<EmployeeResponse> listEmployees() {
        return employeeRepository.findAllByOrderByNameAsc().stream()
                .map(EmployeeResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public EmployeeResponse getEmployee(UUID employeeId) {
        return employeeRepository.findById(employeeId)
                .map(EmployeeResponse::from)
                .orElseThrow(() -> ResourceNotFoundException.employee(employeeId));
    }

    /** Every asset currently in this employee's custody. */
    @Transactional(readOnly = true)
    public List<AssetResponse> getAssignedAssets(UUID employeeId) {
        if (!employeeRepository.existsById(employeeId)) {
            throw ResourceNotFoundException.employee(employeeId);
        }
        return assetRepository.findAll(AssetSpecifications.heldBy(employeeId)).stream()
                .map(AssetResponse::from)
                .toList();
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
