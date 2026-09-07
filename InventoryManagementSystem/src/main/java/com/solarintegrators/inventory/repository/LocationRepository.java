package com.solarintegrators.inventory.repository;

import com.solarintegrators.inventory.model.Location;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Persistence for locations: warehouses, yards, vehicles, job sites, offices. */
@Repository
public interface LocationRepository extends JpaRepository<Location, UUID> {

    Optional<Location> findByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCase(String code);

    List<Location> findAllByOrderByNameAsc();
}
