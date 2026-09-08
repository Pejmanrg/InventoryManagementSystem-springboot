-- ---------------------------------------------------------------------
-- V2 - application users
--
-- Phase 1 authenticated four accounts from application.yml through an
-- InMemoryUserDetailsManager. That cannot be administered without a
-- redeploy, so accounts move here.
--
-- The configuration accounts are deliberately NOT removed by this
-- migration. They remain as a break-glass path in SecurityConfig: if this
-- table is empty, unreachable, or holds a bad hash, an administrator can
-- still sign in and repair it. That fallback is a Phase 1 transition
-- measure and is removed with the rest of the local identity handling when
-- Microsoft Entra ID arrives (CSC-09).
--
-- No account is seeded here on purpose. Seeding would mean committing a
-- BCrypt hash to the repository, and the configuration fallback already
-- guarantees a way in.
-- ---------------------------------------------------------------------
CREATE TABLE app_users (
    user_id       uuid         NOT NULL,
    username      varchar(64)  NOT NULL,
    first_name    varchar(80),
    last_name     varchar(80),
    email         varchar(160),
    job_title     varchar(120),
    role          varchar(16)  NOT NULL,
    password_hash varchar(100) NOT NULL,
    active        boolean      NOT NULL DEFAULT true,
    last_login_at timestamptz,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT pk_app_users PRIMARY KEY (user_id),

    -- Constrained to the UserRole enum for the same reason assets.status is:
    -- an invalid role must not be writable by any route, including SQL run
    -- by hand against the database.
    CONSTRAINT ck_app_users_role CHECK (role IN ('FIELD', 'MANAGER', 'FINANCE', 'ADMIN'))
);

-- Usernames are compared case-insensitively at sign-in, so uniqueness has to
-- be enforced the same way. Without lower(), 'Admin' and 'admin' would both
-- be insertable and either could match a login attempt.
CREATE UNIQUE INDEX uq_app_users_username ON app_users (lower(username));

CREATE UNIQUE INDEX uq_app_users_email ON app_users (lower(email))
    WHERE email IS NOT NULL;

COMMENT ON COLUMN app_users.password_hash IS 'BCrypt hash. Never a plaintext password, and never returned by the API.';
COMMENT ON COLUMN app_users.role IS 'One of FIELD, MANAGER, FINANCE, ADMIN - the four roles in the SDD user view.';
COMMENT ON COLUMN app_users.last_login_at IS 'Set on each successful authentication; null until the account is first used.';
