-- V2 - application user accounts. Roles match the four actors in the SDD user view.

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
    CONSTRAINT ck_app_users_role CHECK (role IN ('FIELD', 'MANAGER', 'FINANCE', 'ADMIN'))
);
CREATE UNIQUE INDEX uq_app_users_username ON app_users (lower(username));

CREATE UNIQUE INDEX uq_app_users_email ON app_users (lower(email))
    WHERE email IS NOT NULL;

COMMENT ON COLUMN app_users.password_hash IS 'BCrypt hash. Never a plaintext password, and never returned by the API.';
COMMENT ON COLUMN app_users.role IS 'One of FIELD, MANAGER, FINANCE, ADMIN - the four roles in the SDD user view.';
COMMENT ON COLUMN app_users.last_login_at IS 'Set on each successful authentication; null until the account is first used.';
