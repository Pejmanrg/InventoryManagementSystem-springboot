package com.solarintegrators.inventory.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Payload for POST /api/employees.
 *
 * <p>{@code externalHrId} is accepted now so that records created by hand today
 * can be matched to the HR platform when that integration is built, without a
 * data migration.</p>
 */
public record CreateEmployeeRequest(
        @NotBlank(message = "Employee name is required.")
        @Size(max = 160) String name,

        @Email(message = "Email must be a valid address.")
        @Size(max = 160) String email,

        @Size(max = 120) String jobTitle,
        UUID homeLocationId,
        @Size(max = 64) String externalHrId) {
}
