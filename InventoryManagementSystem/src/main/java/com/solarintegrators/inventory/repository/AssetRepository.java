package com.solarintegrators.inventory.repository;

import com.solarintegrators.inventory.model.Asset;
import com.solarintegrators.inventory.model.AssetStatus;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;

@Repository
public interface AssetRepository extends JpaRepository<Asset, UUID>, JpaSpecificationExecutor<Asset> {
    Optional<Asset> findByTagIgnoreCase(String tag);

    boolean existsByTagIgnoreCase(String tag);

    long countByStatus(AssetStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Asset> findWithLockByAssetId(UUID assetId);
}
