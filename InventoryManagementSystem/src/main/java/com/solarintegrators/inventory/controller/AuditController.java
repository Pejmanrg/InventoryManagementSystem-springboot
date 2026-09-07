package com.solarintegrators.inventory.controller;

import com.solarintegrators.inventory.dto.response.AuditEventResponse;
import com.solarintegrators.inventory.dto.response.PageResponse;
import com.solarintegrators.inventory.service.AuditService;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read access to the audit trail.
 *
 * <p>Read-only by design: there is no endpoint that writes, edits, or deletes an
 * audit record. Records are written by the services as a side effect of the
 * actions they audit, which is what makes them worth anything as evidence.</p>
 *
 * <p>Restricted to supervisory roles - the trail names people and what they
 * did.</p>
 */
@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    /**
     * GET /api/audit - newest first.
     *
     * <p>{@code entityId} narrows the trail to one record; passing an asset id
     * returns its full lifecycle, including the MAINTENANCE and LOST transitions
     * that have no transaction type of their own.</p>
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('MANAGER','FINANCE','ADMIN')")
    public PageResponse<AuditEventResponse> search(
            @RequestParam(required = false) String entityId,
            @PageableDefault(size = 50) Pageable pageable) {
        return auditService.search(entityId, pageable);
    }
}
