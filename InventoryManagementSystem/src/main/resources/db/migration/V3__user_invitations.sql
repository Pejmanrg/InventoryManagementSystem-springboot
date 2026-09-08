-- ---------------------------------------------------------------------
-- V3 - invitations and password resets
--
-- Until now the only way to give someone a password was for an
-- administrator to type one and pass it on, which means the administrator
-- knows every password in the system. This table backs the alternative:
-- a single-use link, emailed to the account holder, that lets them set
-- their own password without anyone else ever seeing it.
--
-- One table serves both directions because they are the same mechanism
-- with different lifetimes - an invitation for a new account, a reset for
-- an existing one. Splitting them would duplicate the token handling,
-- which is the part that has to be right.
--
-- Removed with the rest of local identity handling when Microsoft Entra ID
-- arrives (CSC-09): the directory issues credentials then, and this
-- application never sees a password at all.
-- ---------------------------------------------------------------------
CREATE TABLE user_invitations (
    invitation_id uuid         NOT NULL,
    user_id       uuid         NOT NULL,

    -- SHA-256 of the token, hex encoded. The token itself is generated,
    -- put in one email, and never written down anywhere - not here, not in
    -- a log. A leaked database backup therefore yields nothing usable: the
    -- hash cannot be replayed, and finding a preimage is the whole point of
    -- using a hash. This is the same reasoning as app_users.password_hash.
    token_hash    varchar(64)  NOT NULL,

    purpose       varchar(16)  NOT NULL,

    -- The address the link was actually sent to, recorded at issue time.
    -- If the account's email is later corrected, the trail still shows
    -- where the old link went - which is exactly what you need to know.
    issued_to     varchar(160),

    expires_at    timestamptz  NOT NULL,

    -- Single use. Set the moment a token is redeemed, so a link that is
    -- forwarded, cached by a mail scanner, or replayed from history cannot
    -- set a second password.
    consumed_at   timestamptz,

    created_at    timestamptz  NOT NULL DEFAULT now(),
    created_by    varchar(64),

    CONSTRAINT pk_user_invitations PRIMARY KEY (invitation_id),

    -- Deleting an account must not leave a live link that would recreate a
    -- way into it. Cascade rather than restrict: a pending invitation is
    -- not a reason to refuse a deletion.
    CONSTRAINT fk_user_invitations_user FOREIGN KEY (user_id)
        REFERENCES app_users (user_id) ON DELETE CASCADE,

    CONSTRAINT ck_user_invitations_purpose CHECK (purpose IN ('INVITE', 'RESET'))
);

CREATE UNIQUE INDEX uq_user_invitations_token ON user_invitations (token_hash);

-- Issuing a new link supersedes any outstanding one for that account, so
-- the lookup is always "this user's unconsumed invitations".
CREATE INDEX ix_user_invitations_pending ON user_invitations (user_id)
    WHERE consumed_at IS NULL;

COMMENT ON COLUMN user_invitations.token_hash IS 'SHA-256 hex of the emailed token. The token itself is never stored.';
COMMENT ON COLUMN user_invitations.purpose IS 'INVITE for a new account, RESET for a forgotten password. Differ only in lifetime and wording.';
COMMENT ON COLUMN user_invitations.consumed_at IS 'Set on redemption. A non-null value makes the token permanently unusable.';
