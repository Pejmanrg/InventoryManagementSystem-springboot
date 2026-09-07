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

/**
 * Persistence for tagged assets.
 *
 * <p>Replaces the {@code ConcurrentHashMap} store of the console prototype. The
 * behaviours the prototype implemented by hand - {@code findByTag} and
 * {@code search} - are preserved: the first as a derived query, the second
 * through {@link JpaSpecificationExecutor} with the predicates assembled in
 * {@link AssetSpecifications}.</p>
 */
@Repository
public interface AssetRepository extends JpaRepository<Asset, UUID>, JpaSpecificationExecutor<Asset> {

    Optional<Asset> findByTagIgnoreCase(String tag);

    boolean existsByTagIgnoreCase(String tag);

    long countByStatus(AssetStatus status);

    /**
     * Loads an asset for a lifecycle change, holding a row lock until the
     * transaction commits.
     *
     * <p>This is what replaces the {@code synchronized} keyword on the console
     * prototype's service methods. A JVM monitor only serialises threads inside
     * one process; two application instances behind a load balancer would both
     * pass the status check and both write a CHECKOUT. A database row lock is
     * what actually makes "check the status, then change it" atomic.</p>
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Asset> findWithLockByAssetId(UUID assetId);
}
