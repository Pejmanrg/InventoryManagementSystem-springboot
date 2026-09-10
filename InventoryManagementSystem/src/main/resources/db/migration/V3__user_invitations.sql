-- V3 - single-use invitation and password-reset links. Only the token hash is stored.

CREATE TABLE user_invitations (
    invitation_id uuid         NOT NULL,
    user_id       uuid         NOT NULL,
    token_hash    varchar(64)  NOT NULL,

    purpose       varchar(16)  NOT NULL,
    issued_to     varchar(160),

    expires_at    timestamptz  NOT NULL,
    consumed_at   timestamptz,

    created_at    timestamptz  NOT NULL DEFAULT now(),
    created_by    varchar(64),

    CONSTRAINT pk_user_invitations PRIMARY KEY (invitation_id),
    CONSTRAINT fk_user_invitations_user FOREIGN KEY (user_id)
        REFERENCES app_users (user_id) ON DELETE CASCADE,

    CONSTRAINT ck_user_invitations_purpose CHECK (purpose IN ('INVITE', 'RESET'))
);

CREATE UNIQUE INDEX uq_user_invitations_token ON user_invitations (token_hash);
CREATE INDEX ix_user_invitations_pending ON user_invitations (user_id)
    WHERE consumed_at IS NULL;

COMMENT ON COLUMN user_invitations.token_hash IS 'SHA-256 hex of the emailed token. The token itself is never stored.';
COMMENT ON COLUMN user_invitations.purpose IS 'INVITE for a new account, RESET for a forgotten password. Differ only in lifetime and wording.';
COMMENT ON COLUMN user_invitations.consumed_at IS 'Set on redemption. A non-null value makes the token permanently unusable.';
