package com.solarintegrators.inventory.controller;

import com.solarintegrators.inventory.dto.request.CreateUserRequest;
import com.solarintegrators.inventory.dto.request.ResetPasswordRequest;
import com.solarintegrators.inventory.dto.request.UpdateUserRequest;
import com.solarintegrators.inventory.dto.response.UserResponse;
import com.solarintegrators.inventory.model.UserRole;
import com.solarintegrators.inventory.service.AppUserService;
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

    /**
     * The signed-in account's own profile.
     *
     * <p>Authenticated rather than ADMIN-only, and deliberately so: this is how
     * the interface discovers which role it is running as, and every role needs
     * that. It returns only the caller's own record, so it discloses nothing the
     * caller did not already supply to sign in.</p>
     *
     * <p>A configured break-glass account has no row in {@code app_users}.
     * Returning 404 there would make the interface treat a valid sign-in as a
     * failure, so the role is instead read back from the granted authority and
     * returned with a null {@code userId} - which is also the marker that the
     * profile cannot be edited here, because it lives in configuration.</p>
     *
     * <p>Mapped before {@code /{userId}} by pattern specificity: a literal
     * segment outranks a variable one, so {@code me} never reaches the UUID
     * converter.</p>
     */
    @GetMapping("/me")
    public UserResponse currentUser(Authentication authentication) {
        String username = authentication.getName();
        return appUserService.findByUsername(username)
                .orElseGet(() -> UserResponse.breakGlass(username, roleOf(authentication)));
    }

    /** Reads the role back out of the granted authorities: ROLE_ADMIN -> ADMIN. */
    private static UserRole roleOf(Authentication authentication) {
        for (GrantedAuthority granted : authentication.getAuthorities()) {
            String authority = granted.getAuthority();
            if (authority != null && authority.startsWith("ROLE_")) {
                try {
                    return UserRole.valueOf(authority.substring("ROLE_".length()));
                } catch (IllegalArgumentException ignored) {
                    /* Not one of the four roles - keep looking rather than fail. */
                }
            }
        }
        return UserRole.FIELD;
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
