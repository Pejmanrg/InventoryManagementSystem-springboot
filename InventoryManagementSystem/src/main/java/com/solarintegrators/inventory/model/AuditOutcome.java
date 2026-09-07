package com.solarintegrators.inventory.model;

/** Result of an audited action. Rejected attempts are recorded, not discarded. */
public enum AuditOutcome {
    SUCCESS,
    DENIED,
    FAILURE
}
