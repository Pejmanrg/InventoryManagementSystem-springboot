package com.solarintegrators.inventory.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * An account that can sign in to the application.
 *
 * <p>Distinct from {@link Employee} on purpose. An employee is someone who can
 * hold custody of an asset; a user is someone who can operate the system. Most
 * employees never sign in, and some users - an auditor, a systems
 * administrator - never hold equipment. Conflating them would force a fake
 * employee record for every administrator and a fake login for every field
 * worker.</p>
 *
 * <p>The password is stored only as a BCrypt hash, is never returned by the
 * API, and has no getter that exposes it for serialisation - it is read solely
 * by the authentication path.</p>
 *
 * <p>Phase 3 note: when Microsoft Entra ID (CSC-09) becomes the identity
 * provider, {@code passwordHash} disappears and this table keeps only the
 * application-side profile - role, job title, active flag - keyed by the
 * external subject claim.</p>
 */
@Entity
@Table(name = "app_users")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @Column(name = "first_name", length = 80)
    private String firstName;

    @Column(name = "last_name", length = 80)
    private String lastName;

    @Column(name = "email", length = 160)
    private String email;

    @Column(name = "job_title", length = 120)
    private String jobTitle;

    /**
     * Stored as the enum name rather than its ordinal: an ordinal would silently
     * remap every existing row if the enum's declaration order ever changed.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 16)
    private UserRole role;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected AppUser() {
        // required by JPA
    }

    public AppUser(String username, UserRole role, String passwordHash) {
        this.username = username;
        this.role = role;
        this.passwordHash = passwordHash;
    }

    /** Display name for the interface; falls back to the username. */
    public String getDisplayName() {
        String first = firstName == null ? "" : firstName.trim();
        String last = lastName == null ? "" : lastName.trim();
        String full = (first + " " + last).trim();
        return full.isEmpty() ? username : full;
    }

    public UUID getUserId() { return userId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getJobTitle() { return jobTitle; }
    public void setJobTitle(String jobTitle) { this.jobTitle = jobTitle; }

    public UserRole getRole() { return role; }
    public void setRole(UserRole role) { this.role = role; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public Instant getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(Instant lastLoginAt) { this.lastLoginAt = lastLoginAt; }

    public Instant getCreatedAt() { return createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    /** Deliberately omits the hash so it cannot reach a log line. */
    @Override
    public String toString() {
        return String.format("AppUser[ID=%s, Username='%s', Role=%s]", userId, username, role);
    }
}
