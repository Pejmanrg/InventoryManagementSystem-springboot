package com.solarintegrators.inventory.model;

/**
 * The four roles from the SDD user view.
 *
 * <p>These names are what the {@code @PreAuthorize} guards on the controllers
 * check, via Spring Security's {@code hasAnyRole(...)}. Spring prefixes role
 * names with {@code ROLE_} internally, so a value here maps to the authority
 * {@code ROLE_ADMIN} and so on - the enum deliberately stores the unprefixed
 * form, matching what the annotations are written against.</p>
 *
 * <p>Adding a role means adding it here, to the CHECK constraint on
 * {@code app_users.role}, and to the guards that should accept it. That is
 * intentional friction: a role nobody has authorised anywhere is worse than
 * no role at all.</p>
 */
public enum UserRole {

    /** Warehouse and field staff: scan, check out, check in, move, receive. */
    FIELD,

    /** Managers and supervisors: full operational visibility plus approvals. */
    MANAGER,

    /** Purchasing and finance: cost data, receiving, exports. */
    FINANCE,

    /** System administrators: user accounts, lookups, integrations, audit. */
    ADMIN
}
