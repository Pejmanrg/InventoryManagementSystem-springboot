package com.solarintegrators.inventory.dto.response;

import com.solarintegrators.inventory.model.AuditEvent;
import com.solarintegrators.inventory.model.AuditOutcome;
import java.time.Instant;
import java.util.UUID;

/** API view of an {@link AuditEvent}. */
public record AuditEventResponse(
        UUID eventId,
        Instant occurredAt,
        String actor,
        String action,
        String entityType,
        String entityId,
        String summary,
        AuditOutcome outcome) {

    public static AuditEventResponse from(AuditEvent event) {
        return new AuditEventResponse(
                event.getEventId(),
                event.getOccurredAt(),
                event.getActor(),
                event.getAction(),
                event.getEntityType(),
                event.getEntityId(),
                event.getSummary(),
                event.getOutcome());
    }
}
