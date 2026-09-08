package com.solarintegrators.inventory.controller;

import com.solarintegrators.inventory.dto.request.CreateUserRequest;
import com.solarintegrators.inventory.dto.request.ResetPasswordRequest;
import com.solarintegrators.inventory.dto.request.UpdateUserRequest;
import com.solarintegrators.inventory.dto.response.UserResponse;
import com.solarintegrators.inventory.service.AppUserService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Account administration (CSC-09 Identity &amp; Access).
 *
 * <p>Every endpoint here is ADMIN-only, without exception. Unlike the asset and
 * inventory controllers - where FIELD and MANAGER share most reads - there is
 * no read that is safe to widen: the list alone tells a caller which accounts
 * exist and which of them hold ADMIN, which is reconnaissance rather than
 * information a warehouse user needs.</p>
 *
 * <p>Phase 3 note: when Microsoft Entra ID becomes the identity provider,
 * account creation and deactivation move to the directory and this controller
 * narrows to the application-side profile - role and job title - rather than
 * disappearing entirely.</p>
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AppUserService appUserService;

    public UserController(AppUserService appUserService) {
        this.appUserService = appUserService;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<UserResponse> listUsers() {
        return appUserService.listUsers();
    }

    @GetMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponse getUser(@PathVariable UUID userId) {
        return appUserService.getUser(userId);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse created = appUserService.createUser(request);
        return ResponseEntity.created(URI.create("/api/users/" + created.userId())).body(created);
    }

    @PutMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponse updateUser(@PathVariable UUID userId,
                                   @Valid @RequestBody UpdateUserRequest request) {
        return appUserService.updateUser(userId, request);
    }

    /**
     * Sets a new password. Returns 204 rather than the user, so that no part of
     * a password-changing response can be mistaken for the credential itself.
     */
    @PostMapping("/{userId}/reset-password")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> resetPassword(@PathVariable UUID userId,
                                              @Valid @RequestBody ResetPasswordRequest request) {
        appUserService.resetPassword(userId, request);
        return ResponseEntity.noContent().build();
    }

    /**
     * Permanently removes an account.
     *
     * <p>The audit trail records the actor by username as free text, so deleting
     * an account does not orphan its history. Deactivating is still the better
     * habit - {@code PUT} with {@code active: false} - and the service refuses
     * to delete the last remaining administrator either way.</p>
     */
    @DeleteMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID userId) {
        appUserService.deleteUser(userId);
        return ResponseEntity.noContent().build();
    }
}
