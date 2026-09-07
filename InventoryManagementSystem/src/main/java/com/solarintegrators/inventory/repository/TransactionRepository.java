package com.solarintegrators.inventory.repository;

import com.solarintegrators.inventory.model.AssetTransaction;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Persistence for asset transaction history.
 *
 * <p>Replaces the {@code CopyOnWriteArrayList} of the console prototype. The
 * ordering the prototype applied in Java - newest first - is now done by the
 * database, which is what the {@code idx_asset_transactions_asset} index in the
 * V1 migration exists for.</p>
 */
@Repository
public interface TransactionRepository extends JpaRepository<AssetTransaction, UUID> {

    List<AssetTransaction> findByAsset_AssetIdOrderByTimestampDesc(UUID assetId);

    Page<AssetTransaction> findAllByOrderByTimestampDesc(Pageable pageable);

    long countByAsset_AssetId(UUID assetId);
}
