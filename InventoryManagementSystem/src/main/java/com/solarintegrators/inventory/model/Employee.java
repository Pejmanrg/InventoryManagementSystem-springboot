package com.solarintegrators.inventory.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * A person who can hold custody of an asset.
 *
 * <p>{@code externalHrId} is the placeholder for the later HR integration
 * (CSC-13): once employee records are synchronised, that column carries the
 * source system's stable identifier and this table stops being maintained by
 * hand. Only assignment-relevant fields are stored - no wider HR data.</p>
 */
@Entity
@Table(name = "employees")
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "employee_id", nullable = false, updatable = false)
    private UUID employeeId;

    @Column(name = "external_hr_id", length = 64, unique = true)
    private String externalHrId;

    @Column(name = "name", nullable = false, length = 160)
    private String name;

    @Column(name = "email", length = 160, unique = true)
    private String email;

    @Column(name = "job_title", length = 120)
    private String jobTitle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "home_location_id")
    private Location homeLocation;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Employee() {
        // required by JPA
    }

    public Employee(String name, String email, String jobTitle, Location homeLocation) {
        this.name = name;
        this.email = email;
        this.jobTitle = jobTitle;
        this.homeLocation = homeLocation;
    }

    public UUID getEmployeeId() { return employeeId; }
    public String getExternalHrId() { return externalHrId; }
    public void setExternalHrId(String externalHrId) { this.externalHrId = externalHrId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getJobTitle() { return jobTitle; }
    public void setJobTitle(String jobTitle) { this.jobTitle = jobTitle; }
    public Location getHomeLocation() { return homeLocation; }
    public void setHomeLocation(Location homeLocation) { this.homeLocation = homeLocation; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }

    @Override
    public String toString() {
        return String.format("Employee[ID=%s, Name='%s']", employeeId, name);
    }
}
