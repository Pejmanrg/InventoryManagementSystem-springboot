package com.solarintegrators.inventory.service.integration;

import com.solarintegrators.inventory.model.Asset;

/**
 * Placeholder for the HR platform integration (CSC-13, Phase 3).
 *
 * <p>Not implemented in Phase 1. The interface exists now so that the point
 * where employee data enters the system, and where assignment events leave it,
 * is a named boundary rather than something discovered later inside a service.
 * The HR platform stays the source of truth for employment status; this
 * application stays the source of truth for who is holding what.</p>
 */
public interface HrIntegrationClient {

    /** Pulls employee records inbound, matched on external HR identifier. */
    int syncEmployees();

    /** Publishes an assignment outbound so HR offboarding can see open equipment. */
    void publishAssignment(Asset asset, String externalHrId);

    /** Publishes a return outbound. */
    void publishReturn(Asset asset, String externalHrId);
}
