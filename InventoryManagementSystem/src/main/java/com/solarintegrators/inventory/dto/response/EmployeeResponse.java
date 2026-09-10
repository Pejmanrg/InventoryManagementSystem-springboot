package com.solarintegrators.inventory.dto.response;

import com.solarintegrators.inventory.model.Employee;
import java.util.UUID;

public record EmployeeResponse(
        UUID employeeId,
        String externalHrId,
        String name,
        String email,
        String jobTitle,
        UUID homeLocationId,
        String homeLocationName,
        boolean active) {
    public static EmployeeResponse from(Employee employee) {
        if (employee == null) {
            return null;
        }
        return new EmployeeResponse(
                employee.getEmployeeId(),
                employee.getExternalHrId(),
                employee.getName(),
                employee.getEmail(),
                employee.getJobTitle(),
                employee.getHomeLocation() == null ? null : employee.getHomeLocation().getLocationId(),
                employee.getHomeLocation() == null ? null : employee.getHomeLocation().getName(),
                employee.isActive());
    }
}
