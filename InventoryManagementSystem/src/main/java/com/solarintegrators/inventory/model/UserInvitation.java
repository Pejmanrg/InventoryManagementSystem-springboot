package com.solarintegrators.inventory.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * A single-use link that lets someone set their own password.
 *
 * <p><strong>The token is not here.</strong> This entity holds only its
 * SHA-256 hash. The token exists in exactly two places for its lifetime: the
 * email that was sent, and the URL the recipient clicks. It is never persisted,
 * never logged, and cannot be recovered from this row - so an administrator
 * reading the database still cannot use someone else's invitation.</p>
 *
 * <p><strong>Why single use.</strong> Mail is copied more than people expect:
 * forwarded threads, backup mailboxes, security scanners that follow links.
 * Consuming the token on redemption means all of those copies are inert the
 * moment the real recipient uses theirs.</p>
 */
@Entity
@Table(name = "user_invitations")
public class UserInvitation {

    @Id
    @Column(name = "invitation_id", nullable = false, updatable = false)
    private UUID invitationId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "token_hash", nullable = false, updatable = false, length = 64)
    private String tokenHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", nullable = false, updatable = false, length = 16)
    private InvitationPurpose purpose;

    @Column(name = "issued_to", length = 160, updatable = false)
    private String issuedTo;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "created_by", length = 64, updatable = false)
    private String createdBy;

    protected UserInvitation() {
        /* JPA */
    }

    public UserInvitation(UUID userId, String tokenHash, InvitationPurpose purpose,
                          String issuedTo, Instant expiresAt, String createdBy) {
        this.invitationId = UUID.randomUUID();
        this.userId = userId;
        this.tokenHash = tokenHash;
        this.purpose = purpose;
        this.issuedTo = issuedTo;
        this.expiresAt = expiresAt;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
    }

    /** True when this link can still be redeemed: not used, not expired. */
    public boolean isUsable(Instant now) {
        return consumedAt == null && expiresAt.isAfter(now);
    }

    public void consume(Instant when) {
        this.consumedAt = when;
    }

    public UUID getInvitationId() { return invitationId; }
    public UUID getUserId() { return userId; }
    public String getTokenHash() { return tokenHash; }
    public InvitationPurpose getPurpose() { return purpose; }
    public String getIssuedTo() { return issuedTo; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getConsumedAt() { return consumedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public String getCreatedBy() { return createdBy; }

    /** Deliberately omits the hash - a toString is the easiest way to leak one. */
    @Override
    public String toString() {
        return "UserInvitation{" + purpose + " for " + userId
                + ", expires " + expiresAt + (consumedAt != null ? ", consumed" : "") + '}';
    }
}
