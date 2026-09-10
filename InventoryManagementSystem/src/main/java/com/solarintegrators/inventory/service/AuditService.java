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
import org.springframework.data.domain.Sort;

@Service
public class AuditService {
    private final AuditEventRepository auditEventRepository;

    public AuditService(AuditEventRepository auditEventRepository) {
        this.auditEventRepository = auditEventRepository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public AuditEvent recordEvent(String action, String entityType, Object entityId, String summary) {
        return auditEventRepository.save(new AuditEvent(
                currentActor(), action, entityType, asText(entityId), truncate(summary), AuditOutcome.SUCCESS));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AuditEvent recordDenied(String action, String entityType, Object entityId, String summary) {
        return auditEventRepository.save(new AuditEvent(
                currentActor(), action, entityType, asText(entityId), truncate(summary), AuditOutcome.DENIED));
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditEventResponse> searchEvents(String entityId, Pageable pageable) {
        if (entityId != null && !entityId.isBlank()) {
            return PageResponse.of(
                    auditEventRepository.findByEntityIdOrderByOccurredAtDesc(entityId, pageable),
                    AuditEventResponse::from);
        }
        return PageResponse.of(
                auditEventRepository.findAllByOrderByOccurredAtDesc(pageable),
                AuditEventResponse::from);
    }

    @Transactional(readOnly = true)
    public String exportAudit() {
        StringBuilder csv = new StringBuilder("occurredAt,actor,action,entityType,entityId,outcome,summary\n");
        for (AuditEvent event : auditEventRepository.findAll(Sort.by(Sort.Direction.DESC, "occurredAt"))) {
            csv.append(event.getOccurredAt()).append(',')
               .append(quote(event.getActor())).append(',')
               .append(quote(event.getAction())).append(',')
               .append(quote(event.getEntityType())).append(',')
               .append(quote(event.getEntityId())).append(',')
               .append(event.getOutcome()).append(',')
               .append(quote(event.getSummary())).append('\n');
        }
        return csv.toString();
    }

    // A comma or a quote inside a summary would otherwise shift every later column.
    private static String quote(String value) {
        if (value == null) return "";
        return '"' + value.replace("\"", "\"\"") + '"';
    }

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

    private static String truncate(String summary) {
        if (summary == null) {
            return "";
        }
        return summary.length() <= 500 ? summary : summary.substring(0, 497) + "...";
    }
}
