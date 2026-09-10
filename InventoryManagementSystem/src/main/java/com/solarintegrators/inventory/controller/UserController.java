package com.solarintegrators.inventory.controller;

import com.solarintegrators.inventory.dto.request.CreateUserRequest;
import com.solarintegrators.inventory.dto.request.ResetPasswordRequest;
import com.solarintegrators.inventory.dto.request.UpdateUserRequest;
import com.solarintegrators.inventory.dto.response.InvitationIssuedResponse;
import com.solarintegrators.inventory.dto.response.UserResponse;
import com.solarintegrators.inventory.model.InvitationPurpose;
import com.solarintegrators.inventory.model.UserRole;
import com.solarintegrators.inventory.service.UserRoleService;
import com.solarintegrators.inventory.service.InvitationService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserRoleService userRoleService;
    private final InvitationService invitationService;

    public UserController(UserRoleService userRoleService, InvitationService invitationService) {
        this.userRoleService = userRoleService;
        this.invitationService = invitationService;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<UserResponse> listUsers() {
        return userRoleService.listUsers();
    }

    @GetMapping("/me")
    public UserResponse currentUser(Authentication authentication) {
        String username = authentication.getName();
        return userRoleService.findByUsername(username)
                .orElseGet(() -> UserResponse.breakGlass(username, roleOf(authentication)));
    }

    private static UserRole roleOf(Authentication authentication) {
        for (GrantedAuthority granted : authentication.getAuthorities()) {
            String authority = granted.getAuthority();
            if (authority != null && authority.startsWith("ROLE_")) {
                try {
                    return UserRole.valueOf(authority.substring("ROLE_".length()));
                } catch (IllegalArgumentException ignored) {
                }
            }
        }
        return UserRole.FIELD;
    }

    @GetMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponse getUser(@PathVariable UUID userId) {
        return userRoleService.getUser(userId);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse created = userRoleService.createUser(request);
        return ResponseEntity.created(URI.create("/api/users/" + created.userId())).body(created);
    }

    @PutMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponse updateUser(@PathVariable UUID userId,
                                   @Valid @RequestBody UpdateUserRequest request) {
        return userRoleService.updateUser(userId, request);
    }

    @PostMapping("/{userId}/invite")
    @PreAuthorize("hasRole('ADMIN')")
    public InvitationIssuedResponse invite(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "INVITE") InvitationPurpose purpose) {
        return invitationService.issue(userId, purpose);
    }

    @PostMapping("/{userId}/reset-password")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> resetPassword(@PathVariable UUID userId,
                                              @Valid @RequestBody ResetPasswordRequest request) {
        userRoleService.resetPassword(userId, request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID userId) {
        userRoleService.deleteUser(userId);
        return ResponseEntity.noContent().build();
    }
}
