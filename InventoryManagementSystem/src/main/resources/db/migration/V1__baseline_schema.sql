-- =====================================================================
--  V1 - Baseline schema for the Cloud Inventory Management System
--  Target: PostgreSQL 14+
--
--  Replaces the in-memory ConcurrentHashMap / CopyOnWriteArrayList stores
--  of the Module 2 console prototype.
--
--  Two principles drive the constraints below:
--
--   1. The database repeats the rules the service layer enforces. A rule
--      that lives only in Java holds for callers that go through Java.
--      Unique tags, non-negative stock, and valid enum values are
--      declared here as well, so they hold for a migration script, a
--      support query, or a future second service.
--
--   2. History is append-only. asset_transactions and audit_events have
--      no updated_at and no application code that writes to them twice.
-- =====================================================================


-- ---------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------
CREATE TABLE locations (
    location_id  uuid         NOT NULL,
    code         varchar(32)  NOT NULL,
    name         varchar(120) NOT NULL,
    type         varchar(32),
    address      varchar(255),
    active       boolean      NOT NULL DEFAULT true,
    created_at   timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT pk_locations PRIMARY KEY (location_id)
);

-- Case-insensitive uniqueness, matching LocationRepository.existsByCodeIgnoreCase().
CREATE UNIQUE INDEX uq_locations_code ON locations (lower(code));

COMMENT ON TABLE locations IS 'Warehouses, yards, vehicles, job sites, and offices.';


-- ---------------------------------------------------------------------
-- employees
--
-- Only assignment-relevant fields. Wider personnel data stays in the HR
-- platform; external_hr_id is the key the Phase 3 integration will match
-- on, so records created by hand today can be reconciled later without a
-- data migration.
-- ---------------------------------------------------------------------
CREATE TABLE employees (
    employee_id      uuid         NOT NULL,
    external_hr_id   varchar(64),
    name             varchar(160) NOT NULL,
    email            varchar(160),
    job_title        varchar(120),
    home_location_id uuid,
    active           boolean      NOT NULL DEFAULT true,
    created_at       timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT pk_employees PRIMARY KEY (employee_id),
    CONSTRAINT fk_employees_home_location FOREIGN KEY (home_location_id)
        REFERENCES locations (location_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX uq_employees_external_hr_id ON employees (external_hr_id)
    WHERE external_hr_id IS NOT NULL;
CREATE UNIQUE INDEX uq_employees_email ON employees (lower(email))
    WHERE email IS NOT NULL;

COMMENT ON COLUMN employees.external_hr_id IS 'Stable identifier from the HR platform (Phase 3 integration).';


-- ---------------------------------------------------------------------
-- assets
--
-- Uniquely tagged items. status is constrained to the AssetStatus enum
-- so an invalid value cannot be written by any route.
-- ---------------------------------------------------------------------
CREATE TABLE assets (
    asset_id              uuid         NOT NULL,
    tag                   varchar(64)  NOT NULL,
    name                  varchar(160) NOT NULL,
    category              varchar(32),
    serial_number         varchar(120),
    status                varchar(24)  NOT NULL DEFAULT 'AVAILABLE',
    location_id           uuid,
    custodian_employee_id uuid,
    condition_code        varchar(32),
    purchase_date         date,
    purchase_cost         numeric(14,2),
    warranty_end          date,
    notes                 varchar(2000),
    last_transaction_at   timestamptz,
    created_at            timestamptz  NOT NULL DEFAULT now(),
    updated_at            timestamptz  NOT NULL DEFAULT now(),
    version               bigint       NOT NULL DEFAULT 0,

    CONSTRAINT pk_assets PRIMARY KEY (asset_id),
    CONSTRAINT fk_assets_location FOREIGN KEY (location_id)
        REFERENCES locations (location_id) ON DELETE SET NULL,
    CONSTRAINT fk_assets_custodian FOREIGN KEY (custodian_employee_id)
        REFERENCES employees (employee_id) ON DELETE SET NULL,
    CONSTRAINT ck_assets_status CHECK (
        status IN ('AVAILABLE', 'CHECKED_OUT', 'MAINTENANCE', 'LOST', 'RETIRED')),
    CONSTRAINT ck_assets_purchase_cost CHECK (purchase_cost IS NULL OR purchase_cost >= 0),

    -- An asset is either checked out to somebody, or it has no custodian.
    -- This is the invariant TransactionService maintains; declaring it here
    -- means a bad write fails instead of quietly producing a record that
    -- says an available asset is in someone's hands.
    CONSTRAINT ck_assets_custody CHECK (
        (status = 'CHECKED_OUT' AND custodian_employee_id IS NOT NULL)
        OR (status <> 'CHECKED_OUT'))
);

CREATE UNIQUE INDEX uq_assets_tag ON assets (lower(tag));
CREATE INDEX idx_assets_status ON assets (status);
CREATE INDEX idx_assets_location ON assets (location_id);
CREATE INDEX idx_assets_custodian ON assets (custodian_employee_id);
CREATE INDEX idx_assets_category ON assets (category);

COMMENT ON TABLE assets IS 'Uniquely tagged company assets: IT equipment, vehicles, tools, safety gear.';


-- ---------------------------------------------------------------------
-- inventory_items
--
-- The non-negative check is the database half of the rule enforced by
-- InventoryService.adjustQuantity(). Requirement REQ-INV-02.
-- ---------------------------------------------------------------------
CREATE TABLE inventory_items (
    inventory_item_id uuid          NOT NULL,
    sku               varchar(64)   NOT NULL,
    description       varchar(255),
    category          varchar(64),
    unit_of_measure   varchar(16),
    quantity_on_hand  numeric(18,4) NOT NULL DEFAULT 0,
    reorder_point     numeric(18,4) DEFAULT 0,
    unit_cost         numeric(14,4),
    location_id       uuid,
    last_counted_at   timestamptz,
    created_at        timestamptz   NOT NULL DEFAULT now(),
    updated_at        timestamptz   NOT NULL DEFAULT now(),
    version           bigint        NOT NULL DEFAULT 0,

    CONSTRAINT pk_inventory_items PRIMARY KEY (inventory_item_id),
    CONSTRAINT fk_inventory_items_location FOREIGN KEY (location_id)
        REFERENCES locations (location_id) ON DELETE SET NULL,
    CONSTRAINT ck_inventory_quantity_non_negative CHECK (quantity_on_hand >= 0),
    CONSTRAINT ck_inventory_reorder_non_negative CHECK (reorder_point IS NULL OR reorder_point >= 0),
    CONSTRAINT ck_inventory_unit_cost_non_negative CHECK (unit_cost IS NULL OR unit_cost >= 0)
);

CREATE UNIQUE INDEX uq_inventory_items_sku ON inventory_items (lower(sku));
CREATE INDEX idx_inventory_items_location ON inventory_items (location_id);

COMMENT ON CONSTRAINT ck_inventory_quantity_non_negative ON inventory_items
    IS 'Stock cannot go negative - REQ-INV-02, also enforced in InventoryService.';


-- ---------------------------------------------------------------------
-- asset_transactions
--
-- Append-only history. type is constrained to the five TransactionType
-- values carried over from the Module 2 model.
-- ---------------------------------------------------------------------
CREATE TABLE asset_transactions (
    transaction_id uuid         NOT NULL,
    asset_id       uuid         NOT NULL,
    type           varchar(24)  NOT NULL,
    employee_id    uuid,
    location_id    uuid,
    status_from    varchar(24),
    status_to      varchar(24),
    occurred_at    timestamptz  NOT NULL DEFAULT now(),
    notes          varchar(2000),
    performed_by   varchar(120),

    CONSTRAINT pk_asset_transactions PRIMARY KEY (transaction_id),

    -- RESTRICT, not CASCADE: deleting an asset must not silently erase the
    -- evidence of what happened to it. Retire assets; do not delete them.
    CONSTRAINT fk_asset_transactions_asset FOREIGN KEY (asset_id)
        REFERENCES assets (asset_id) ON DELETE RESTRICT,
    CONSTRAINT fk_asset_transactions_employee FOREIGN KEY (employee_id)
        REFERENCES employees (employee_id) ON DELETE SET NULL,
    CONSTRAINT fk_asset_transactions_location FOREIGN KEY (location_id)
        REFERENCES locations (location_id) ON DELETE SET NULL,
    CONSTRAINT ck_asset_transactions_type CHECK (
        type IN ('CHECKOUT', 'CHECKIN', 'MOVE', 'DISPOSE', 'RECOVER')),
    CONSTRAINT ck_asset_transactions_status_from CHECK (
        status_from IS NULL OR status_from IN
        ('AVAILABLE', 'CHECKED_OUT', 'MAINTENANCE', 'LOST', 'RETIRED')),
    CONSTRAINT ck_asset_transactions_status_to CHECK (
        status_to IS NULL OR status_to IN
        ('AVAILABLE', 'CHECKED_OUT', 'MAINTENANCE', 'LOST', 'RETIRED'))
);

-- Supports "history for this asset, newest first" without a sort.
CREATE INDEX idx_asset_transactions_asset ON asset_transactions (asset_id, occurred_at DESC);
CREATE INDEX idx_asset_transactions_occurred ON asset_transactions (occurred_at DESC);
CREATE INDEX idx_asset_transactions_employee ON asset_transactions (employee_id);

COMMENT ON TABLE asset_transactions IS 'Append-only asset lifecycle history. Never updated or deleted.';


-- ---------------------------------------------------------------------
-- audit_events
--
-- Who did what, to which record, when, and whether it was allowed.
-- Denied attempts are stored too - a log of only what succeeded cannot
-- answer whether someone tried.
-- ---------------------------------------------------------------------
CREATE TABLE audit_events (
    event_id    uuid         NOT NULL,
    occurred_at timestamptz  NOT NULL DEFAULT now(),
    actor       varchar(120) NOT NULL,
    action      varchar(64)  NOT NULL,
    entity_type varchar(32)  NOT NULL,
    entity_id   varchar(64),
    summary     varchar(500) NOT NULL,
    outcome     varchar(16)  NOT NULL,

    CONSTRAINT pk_audit_events PRIMARY KEY (event_id),
    CONSTRAINT ck_audit_events_outcome CHECK (outcome IN ('SUCCESS', 'DENIED', 'FAILURE'))
);

CREATE INDEX idx_audit_events_occurred ON audit_events (occurred_at DESC);
CREATE INDEX idx_audit_events_entity ON audit_events (entity_id);
CREATE INDEX idx_audit_events_actor ON audit_events (actor);
CREATE INDEX idx_audit_events_action ON audit_events (action);

COMMENT ON TABLE audit_events IS 'Append-only audit trail, including rejected attempts.';
