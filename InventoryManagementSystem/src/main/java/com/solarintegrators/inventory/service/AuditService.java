package com.solarintegrators.inventory.service;

import com.solarintegrators.inventory.dto.response.AuditEventResponse;
import com.solarintegrators.inventory.dto.response.PageResponse;
import com.solarintegrators.inventory.model.AuditEvent;
import com.solarintegrators.inventory.model.AuditOutcome;
import com.solarintegrators.inventory.repository.AuditEventRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes and reads the audit trail (CSC-12 Audit &amp; Monitoring).
 *
 * <p>Every inventory-changing action calls {@link #record}. Rejected attempts
 * call it too, with {@link AuditOutcome#DENIED} - a log of only what succeeded
 * cannot answer whether someone tried.</p>
 *
 * <p>Denied events are written in a {@code REQUIRES_NEW} transaction. The
 * business transaction that rejected the action is about to roll back, and the
 * record that it was attempted must survive that rollback.</p>
 */
@Service
public class AuditService {

    private final AuditEventRepository auditEventRepository;

    public AuditService(AuditEventRepository auditEventRepository) {
        this.auditEventRepository = auditEventRepository;
    }

    /** Records a successful action in the caller's transaction. */
    @Transactional(propagation = Propagation.MANDATORY)
    public AuditEvent record(String action, String entityType, Object entityId, String summary) {
        return auditEventRepository.save(new AuditEvent(
                currentActor(), action, entityType, asText(entityId), truncate(summary), AuditOutcome.SUCCESS));
    }

    /**
     * Records a rejected action in its own transaction so it survives the
     * rollback of the business transaction that refused the request.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AuditEvent recordDenied(String action, String entityType, Object entityId, String summary) {
        return auditEventRepository.save(new AuditEvent(
                currentActor(), action, entityType, asText(entityId), truncate(summary), AuditOutcome.DENIED));
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditEventResponse> search(String entityId, Pageable pageable) {
        if (entityId != null && !entityId.isBlank()) {
            return PageResponse.of(
                    auditEventRepository.findByEntityIdOrderByOccurredAtDesc(entityId, pageable),
                    AuditEventResponse::from);
        }
        return PageResponse.of(
                auditEventRepository.findAllByOrderByOccurredAtDesc(pageable),
                AuditEventResponse::from);
    }

    /**
     * Username of the signed-in principal, or {@code system} for scheduled jobs
     * and integration callbacks that run without a user.
     */
    public String currentActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return "system";
        }
        String name = authentication.getName();
        return (name == null || name.isBlank()) ? "system" : name;
    }

    private static String asText(Object entityId) {
        return entityId == null ? null : String.valueOf(entityId);
    }

    /** The summary column is 500 characters; a long note must not fail the write. */
    private static String truncate(String summary) {
        if (summary == null) {
            return "";
        }
        return summary.length() <= 500 ? summary : summary.substring(0, 497) + "...";
    }
}
