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

@RestController
@RequestMapping("/api/audit")
public class AuditController {
    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MANAGER','FINANCE','ADMIN')")
    public PageResponse<AuditEventResponse> search(
            @RequestParam(required = false) String entityId,
            @PageableDefault(size = 50) Pageable pageable) {
        return auditService.searchEvents(entityId, pageable);
    }
}
