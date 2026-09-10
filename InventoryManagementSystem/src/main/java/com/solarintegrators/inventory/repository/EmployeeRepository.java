package com.solarintegrators.inventory.repository;

import com.solarintegrators.inventory.model.Employee;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, UUID> {
    Optional<Employee> findByExternalHrId(String externalHrId);

    boolean existsByEmailIgnoreCase(String email);

    List<Employee> findAllByOrderByNameAsc();
}
