package com.solarintegrators.inventory.controller;

import com.solarintegrators.inventory.dto.request.CreateEmployeeRequest;
import com.solarintegrators.inventory.dto.response.AssetResponse;
import com.solarintegrators.inventory.dto.response.EmployeeResponse;
import com.solarintegrators.inventory.service.EmployeeService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Employees.
 *
 * <p>There is deliberately no "assign asset to employee" endpoint here.
 * Assignment happens through {@code POST /api/assets/{id}/checkout}, so it
 * always produces a transaction record; assigning by editing an employee would
 * change custody with no history behind it.</p>
 */
@RestController
@RequestMapping("/api/employees")
public class EmployeeController {

    private final EmployeeService employeeService;

    public EmployeeController(EmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    /** GET /api/employees */
    @GetMapping
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','FINANCE','ADMIN')")
    public List<EmployeeResponse> listEmployees() {
        return employeeService.listEmployees();
    }

    /** GET /api/employees/{id} */
    @GetMapping("/{employeeId}")
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','FINANCE','ADMIN')")
    public EmployeeResponse getEmployee(@PathVariable UUID employeeId) {
        return employeeService.getEmployee(employeeId);
    }

    /** GET /api/employees/{id}/assets - everything currently in this person's custody. */
    @GetMapping("/{employeeId}/assets")
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','FINANCE','ADMIN')")
    public List<AssetResponse> getAssignedAssets(@PathVariable UUID employeeId) {
        return employeeService.getAssignedAssets(employeeId);
    }

    /** POST /api/employees */
    @PostMapping
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<EmployeeResponse> createEmployee(@Valid @RequestBody CreateEmployeeRequest request) {
        EmployeeResponse created = employeeService.createEmployee(request);
        return ResponseEntity
                .created(URI.create("/api/employees/" + created.employeeId()))
                .body(created);
    }
}
