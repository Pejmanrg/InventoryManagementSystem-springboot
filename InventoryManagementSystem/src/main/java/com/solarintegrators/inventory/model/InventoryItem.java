package com.solarintegrators.inventory.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
import java.util.UUID;

@Entity
@Table(name = "inventory_items")
public class InventoryItem {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "inventory_item_id", nullable = false, updatable = false)
    private UUID inventoryItemId;

    @Column(name = "sku", nullable = false, length = 64, unique = true)
    private String sku;

    @Column(name = "description", length = 255)
    private String description;

    @Column(name = "category", length = 64)
    private String category;

    @Column(name = "unit_of_measure", length = 16)
    private String unitOfMeasure;

    @Column(name = "quantity_on_hand", nullable = false, precision = 18, scale = 4)
    private BigDecimal quantityOnHand = BigDecimal.ZERO;

    @Column(name = "reorder_point", precision = 18, scale = 4)
    private BigDecimal reorderPoint = BigDecimal.ZERO;

    @Column(name = "unit_cost", precision = 14, scale = 4)
    private BigDecimal unitCost;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id")
    private Location location;

    @Column(name = "last_counted_at")
    private Instant lastCountedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected InventoryItem() {
        // required by JPA
    }

    public InventoryItem(String sku, String description, BigDecimal initialQuantity, Location location) {
        this.sku = sku;
        this.description = description;
        this.quantityOnHand = initialQuantity != null ? initialQuantity : BigDecimal.ZERO;
        this.location = location;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getInventoryItemId() { return inventoryItemId; }

    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getUnitOfMeasure() { return unitOfMeasure; }
    public void setUnitOfMeasure(String unitOfMeasure) { this.unitOfMeasure = unitOfMeasure; }

    public BigDecimal getQuantityOnHand() { return quantityOnHand; }
    public void setQuantityOnHand(BigDecimal quantityOnHand) { this.quantityOnHand = quantityOnHand; }

    public BigDecimal getReorderPoint() { return reorderPoint; }
    public void setReorderPoint(BigDecimal reorderPoint) { this.reorderPoint = reorderPoint; }

    public BigDecimal getUnitCost() { return unitCost; }
    public void setUnitCost(BigDecimal unitCost) { this.unitCost = unitCost; }

    public Location getLocation() { return location; }
    public void setLocation(Location location) { this.location = location; }

    public Instant getLastCountedAt() { return lastCountedAt; }
    public void setLastCountedAt(Instant lastCountedAt) { this.lastCountedAt = lastCountedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getVersion() { return version; }

    public UUID getLocationId() {
        return location == null ? null : location.getLocationId();
    }

    @Override
    public String toString() {
        return String.format("InventoryItem[ID=%s, SKU='%s', Qty=%s]", inventoryItemId, sku, quantityOnHand);
    }
}
