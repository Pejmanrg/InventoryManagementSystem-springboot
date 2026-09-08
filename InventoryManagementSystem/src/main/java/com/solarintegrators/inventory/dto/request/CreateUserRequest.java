package com.solarintegrators.inventory.dto.request;

import com.solarintegrators.inventory.model.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Creates a sign-in account.
 *
 * <p>The password arrives in plaintext over HTTPS and is hashed before it
 * reaches the database; it is never stored, logged, or returned. The minimum
 * length is enforced here rather than only in the browser, because the API is
 * reachable directly and a client-side rule is a convenience, not a control.</p>
 */
public record CreateUserRequest(

        /*
         * Restricted to characters that survive a URL path segment and an HTTP
         * Basic credential without escaping. A colon in particular would break
         * Basic auth, which joins username and password with one.
         */
        @NotBlank(message = "A username is required.")
        @Size(max = 64, message = "A username may be at most 64 characters.")
        @Pattern(regexp = "^[A-Za-z0-9._@-]+$",
                message = "A username may contain letters, digits, and . _ @ - only.")
        String username,

        @Size(max = 80, message = "A first name may be at most 80 characters.")
        String firstName,

        @Size(max = 80, message = "A last name may be at most 80 characters.")
        String lastName,

        @Email(message = "Enter a valid email address.")
        @Size(max = 160, message = "An email address may be at most 160 characters.")
        String email,

        @Size(max = 120, message = "A job title may be at most 120 characters.")
        String jobTitle,

        @NotNull(message = "A role is required.")
        UserRole role,

        @NotBlank(message = "A password is required.")
        @Size(min = 10, max = 100, message = "A password must be at least 10 characters.")
        String password,

        /** Null is treated as active; an account is usually wanted immediately. */
        Boolean active) {
}
