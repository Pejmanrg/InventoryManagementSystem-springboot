package com.solarintegrators.inventory.controller;

import com.solarintegrators.inventory.dto.request.AcceptInvitationRequest;
import com.solarintegrators.inventory.dto.request.PasswordResetRequest;
import com.solarintegrators.inventory.dto.response.InvitationCheckResponse;
import com.solarintegrators.inventory.service.InvitationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class InvitationController {
    private final InvitationService invitationService;

    public InvitationController(InvitationService invitationService) {
        this.invitationService = invitationService;
    }

    @GetMapping("/invitations/{token}")
    public InvitationCheckResponse check(@PathVariable String token) {
        return invitationService.check(token);
    }

    @PostMapping("/invitations/{token}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void accept(@PathVariable String token,
                       @Valid @RequestBody AcceptInvitationRequest request) {
        invitationService.accept(token, request.newPassword());
    }

    @PostMapping("/password-reset")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void requestReset(@Valid @RequestBody PasswordResetRequest request) {
        invitationService.requestReset(request.usernameOrEmail());
    }
}
