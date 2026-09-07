package com.solarintegrators.inventory.repository;

import com.solarintegrators.inventory.model.Employee;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Persistence for the employee records assets can be assigned to.
 *
 * <p>{@code findByExternalHrId} is the hook the later HR synchronisation
 * (CSC-13) will use to match inbound records without depending on our own
 * primary keys.</p>
 */
@Repository
public interface EmployeeRepository extends JpaRepository<Employee, UUID> {

    Optional<Employee> findByExternalHrId(String externalHrId);

    boolean existsByEmailIgnoreCase(String email);

    List<Employee> findAllByOrderByNameAsc();
}
