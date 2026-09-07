package com.solarintegrators.inventory.repository;

import com.solarintegrators.inventory.model.InventoryItem;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;

/** Persistence for quantity-managed stock. Replaces the in-memory map. */
@Repository
public interface InventoryRepository
        extends JpaRepository<InventoryItem, UUID>, JpaSpecificationExecutor<InventoryItem> {

    Optional<InventoryItem> findBySkuIgnoreCase(String sku);

    boolean existsBySkuIgnoreCase(String sku);

    /**
     * Loads an item for adjustment under a row lock, so read-modify-write on
     * quantity on hand is atomic across application instances. Replaces the
     * {@code synchronized} modifier on the prototype's adjustQuantity().
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<InventoryItem> findWithLockByInventoryItemId(UUID inventoryItemId);
}
