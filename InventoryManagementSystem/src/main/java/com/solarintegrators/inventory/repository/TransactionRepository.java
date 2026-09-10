package com.solarintegrators.inventory.repository;

import com.solarintegrators.inventory.model.AssetTransaction;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TransactionRepository extends JpaRepository<AssetTransaction, UUID> {
    List<AssetTransaction> findByAsset_AssetIdOrderByTimestampDesc(UUID assetId);

    Page<AssetTransaction> findAllByOrderByTimestampDesc(Pageable pageable);

    long countByAsset_AssetId(UUID assetId);
}
