package com.solarintegrators.inventory.controller;

import com.solarintegrators.inventory.dto.response.PageResponse;
import com.solarintegrators.inventory.dto.response.TransactionResponse;
import com.solarintegrators.inventory.service.TransactionService;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {
    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('FIELD','MANAGER','FINANCE','ADMIN')")
    public PageResponse<TransactionResponse> getRecent(
            @PageableDefault(size = 25) Pageable pageable) {
        return transactionService.getRecentTransactions(pageable);
    }
}
