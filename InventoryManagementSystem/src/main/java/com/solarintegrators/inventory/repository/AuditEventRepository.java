package com.solarintegrators.inventory.repository;

import com.solarintegrators.inventory.model.AuditEvent;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditEventRepository
        extends JpaRepository<AuditEvent, UUID>, JpaSpecificationExecutor<AuditEvent> {
    Page<AuditEvent> findAllByOrderByOccurredAtDesc(Pageable pageable);

    Page<AuditEvent> findByEntityIdOrderByOccurredAtDesc(String entityId, Pageable pageable);
}
