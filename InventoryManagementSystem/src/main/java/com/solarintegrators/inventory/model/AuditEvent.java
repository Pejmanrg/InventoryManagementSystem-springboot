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

/**
 * A record of who did what, to which record, and when.
 *
 * <p>Rejected attempts are stored with outcome {@link AuditOutcome#DENIED} as
 * well as successful ones. A log that only records what succeeded cannot answer
 * "did someone try?", which is the question the repudiation and elevation-of-
 * privilege rows of the SDD threat model care about.</p>
 *
 * <p>Append-only, like {@link AssetTransaction}: no setters, no update path.</p>
 */
@Entity
@Table(name = "audit_events")
public class AuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "event_id", nullable = false, updatable = false)
    private UUID eventId;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    /** Username of the actor, or "system" for scheduled and integration jobs. */
    @Column(name = "actor", nullable = false, length = 120, updatable = false)
    private String actor;

    /** ASSET_CHECKOUT, INVENTORY_ADJUST, ROLE_ASSIGN, and similar. */
    @Column(name = "action", nullable = false, length = 64, updatable = false)
    private String action;

    @Column(name = "entity_type", nullable = false, length = 32, updatable = false)
    private String entityType;

    /**
     * Identifier of the affected record. Held as text rather than UUID because
     * some audited actions refer to batches and external references that are
     * not database keys.
     */
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
