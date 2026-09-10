package com.solarintegrators.inventory.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_events")
public class AuditEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "event_id", nullable = false, updatable = false)
    private UUID eventId;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    @Column(name = "actor", nullable = false, length = 120, updatable = false)
    private String actor;

    @Column(name = "action", nullable = false, length = 64, updatable = false)
    private String action;

    @Column(name = "entity_type", nullable = false, length = 32, updatable = false)
    private String entityType;

    @Column(name = "entity_id", length = 64, updatable = false)
    private String entityId;

    @Column(name = "summary", nullable = false, length = 500, updatable = false)
    private String summary;

    @Enumerated(EnumType.STRING)
    @Column(name = "outcome", nullable = false, length = 16, updatable = false)
    private AuditOutcome outcome;

    protected AuditEvent() {
        // required by JPA
    }

    public AuditEvent(String actor, String action, String entityType, String entityId,
                      String summary, AuditOutcome outcome) {
        this.actor = actor;
        this.action = action;
        this.entityType = entityType;
        this.entityId = entityId;
        this.summary = summary;
        this.outcome = outcome;
        this.occurredAt = Instant.now();
    }

    public UUID getEventId() { return eventId; }
    public Instant getOccurredAt() { return occurredAt; }
    public String getActor() { return actor; }
    public String getAction() { return action; }
    public String getEntityType() { return entityType; }
    public String getEntityId() { return entityId; }
    public String getSummary() { return summary; }
    public AuditOutcome getOutcome() { return outcome; }

    @Override
    public String toString() {
        return String.format("AuditEvent[%s %s %s %s -> %s]",
                occurredAt, actor, action, entityId, outcome);
    }
}
