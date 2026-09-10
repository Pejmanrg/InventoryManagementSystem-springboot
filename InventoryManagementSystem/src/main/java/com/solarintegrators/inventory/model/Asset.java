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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "assets")
public class Asset {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "asset_id", nullable = false, updatable = false)
    private UUID assetId;

    @Column(name = "tag", nullable = false, length = 64, unique = true)
    private String tag;

    @Column(name = "name", nullable = false, length = 160)
    private String name;

    @Column(name = "category", length = 32)
    private String category;

    @Column(name = "serial_number", length = 120)
    private String serialNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private AssetStatus status = AssetStatus.AVAILABLE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id")
    private Location location;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "custodian_employee_id")
    private Employee custodian;

    @Column(name = "condition_code", length = 32)
    private String condition;

    @Column(name = "purchase_date")
    private LocalDate purchaseDate;

    @Column(name = "purchase_cost", precision = 14, scale = 2)
    private BigDecimal purchaseCost;

    @Column(name = "warranty_end")
    private LocalDate warrantyEnd;

    @Column(name = "notes", length = 2000)
    private String notes;

    @Column(name = "last_transaction_at")
    private Instant lastTransactionAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected Asset() {
        // required by JPA
    }

    public Asset(String tag, String name, Location location) {
        this.tag = tag;
        this.name = name;
        this.location = location;
        this.status = AssetStatus.AVAILABLE;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getAssetId() { return assetId; }

    public String getTag() { return tag; }
    public void setTag(String tag) { this.tag = tag; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getSerialNumber() { return serialNumber; }
    public void setSerialNumber(String serialNumber) { this.serialNumber = serialNumber; }

    public AssetStatus getStatus() { return status; }
    public void setStatus(AssetStatus status) { this.status = status; }

    public Location getLocation() { return location; }
    public void setLocation(Location location) { this.location = location; }

    public Employee getCustodian() { return custodian; }
    public void setCustodian(Employee custodian) { this.custodian = custodian; }

    public String getCondition() { return condition; }
    public void setCondition(String condition) { this.condition = condition; }

    public LocalDate getPurchaseDate() { return purchaseDate; }
    public void setPurchaseDate(LocalDate purchaseDate) { this.purchaseDate = purchaseDate; }

    public BigDecimal getPurchaseCost() { return purchaseCost; }
    public void setPurchaseCost(BigDecimal purchaseCost) { this.purchaseCost = purchaseCost; }

    public LocalDate getWarrantyEnd() { return warrantyEnd; }
    public void setWarrantyEnd(LocalDate warrantyEnd) { this.warrantyEnd = warrantyEnd; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Instant getLastTransactionAt() { return lastTransactionAt; }
    public void setLastTransactionAt(Instant lastTransactionAt) { this.lastTransactionAt = lastTransactionAt; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getVersion() { return version; }

    public UUID getLocationId() {
        return location == null ? null : location.getLocationId();
    }

    public UUID getCustodianEmployeeId() {
        return custodian == null ? null : custodian.getEmployeeId();
    }

    @Override
    public String toString() {
        return String.format("Asset[ID=%s, Tag='%s', Name='%s', Status=%s, Custodian=%s]",
                assetId, tag, name, status, getCustodianEmployeeId());
    }
}
