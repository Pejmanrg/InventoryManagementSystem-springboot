package com.solarintegrators.inventory.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "asset_transactions")
public class AssetTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "transaction_id", nullable = false, updatable = false)
    private UUID transactionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "asset_id", nullable = false, updatable = false)
    private Asset asset;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 24, updatable = false)
    private TransactionType type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", updatable = false)
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", updatable = false)
    private Location location;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_from", length = 24, updatable = false)
    private AssetStatus statusFrom;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_to", length = 24, updatable = false)
    private AssetStatus statusTo;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant timestamp;

    @Column(name = "notes", length = 2000, updatable = false)
    private String notes;

    @Column(name = "performed_by", length = 120, updatable = false)
    private String performedBy;

    protected AssetTransaction() {
        // required by JPA
    }

    public AssetTransaction(Asset asset, TransactionType type, Employee employee, Location location,
                            AssetStatus statusFrom, AssetStatus statusTo, String notes, String performedBy) {
        this.asset = asset;
        this.type = type;
        this.employee = employee;
        this.location = location;
        this.statusFrom = statusFrom;
        this.statusTo = statusTo;
        this.notes = notes;
        this.performedBy = performedBy;
        this.timestamp = Instant.now();
    }

    public UUID getTransactionId() { return transactionId; }
    public Asset getAsset() { return asset; }
    public TransactionType getType() { return type; }
    public Employee getEmployee() { return employee; }
    public Location getLocation() { return location; }
    public AssetStatus getStatusFrom() { return statusFrom; }
    public AssetStatus getStatusTo() { return statusTo; }
    public Instant getTimestamp() { return timestamp; }
    public String getNotes() { return notes; }
    public String getPerformedBy() { return performedBy; }

    public UUID getAssetId() {
        return asset == null ? null : asset.getAssetId();
    }

    public UUID getEmployeeId() {
        return employee == null ? null : employee.getEmployeeId();
    }

    @Override
    public String toString() {
        return String.format("AssetTransaction[ID=%s, Asset=%s, Type=%s, Employee=%s, Time=%s]",
                transactionId, getAssetId(), type, getEmployeeId(), timestamp);
    }
}
