package com.solarintegrators.inventory.dto.response;

import com.solarintegrators.inventory.model.Employee;
import java.util.UUID;

/**
 * API view of an {@link Employee}.
 *
 * <p>Deliberately narrow: name, role, and work location are what an asset
 * assignment needs. Wider personnel data stays in the HR platform, which is the
 * least-privilege position taken in the SDD user view.</p>
 */
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
