package com.solarintegrators.inventory.service;

import com.solarintegrators.inventory.config.SecurityProperties;
import com.solarintegrators.inventory.model.AppUser;
import com.solarintegrators.inventory.repository.AppUserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import com.solarintegrators.inventory.model.UserRole;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

@Service
public class AuthenticationService implements UserDetailsService {
    private static final Logger log = LoggerFactory.getLogger(AuthenticationService.class);

    private static final Duration LAST_LOGIN_REFRESH_INTERVAL = Duration.ofMinutes(15);

    private final AppUserRepository appUserRepository;

    private final Map<String, ConfiguredAccount> configuredUsers = new LinkedHashMap<>();

    private record ConfiguredAccount(String username, String encodedPassword, String role) {
    }

    public AuthenticationService(AppUserRepository appUserRepository,
                                      SecurityProperties properties,
                                      PasswordEncoder passwordEncoder) {
        this.appUserRepository = appUserRepository;

        properties.getUsers().forEach(devUser -> {
            if (devUser.getUsername() == null || devUser.getPassword() == null) {
                return;
            }
            configuredUsers.put(devUser.getUsername().toLowerCase(),
                    new ConfiguredAccount(devUser.getUsername(),
                            passwordEncoder.encode(devUser.getPassword()),
                            devUser.getRole()));
        });

        log.info("Authentication ready: database accounts first, {} configured break-glass account(s).",
                configuredUsers.size());
    }

    // CSC-09. The controllers express this as @PreAuthorize; these two make the
    // same check available to code that is not an annotated controller method.
    public void requireRole(UserRole role) {
        if (!hasRole(role)) {
            throw new AccessDeniedException("This action requires the " + role + " role.");
        }
    }

    public boolean hasRole(UserRole role) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) return false;
        String wanted = "ROLE_" + role.name();
        return authentication.getAuthorities().stream()
                .anyMatch(granted -> wanted.equals(granted.getAuthority()));
    }

    public Map<String, Object> getClaims() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) return Map.of();
        List<String> roles = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(authority -> authority.startsWith("ROLE_"))
                .map(authority -> authority.substring("ROLE_".length()))
                .toList();
        return Map.of("username", authentication.getName(), "roles", roles);
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) {
        Optional<AppUser> stored = appUserRepository.findByUsernameIgnoreCase(username);

        if (stored.isPresent()) {
            AppUser user = stored.get();
            return User.withUsername(user.getUsername())
                    .password(user.getPasswordHash())
                    .roles(user.getRole().name())
                    .disabled(!user.isActive())
                    .build();
        }

        ConfiguredAccount configured = username == null
                ? null
                : configuredUsers.get(username.toLowerCase());

        if (configured != null) {
            log.debug("Authenticated '{}' from configuration - no database account with that username.", username);
            return User.withUsername(configured.username())
                    .password(configured.encodedPassword())
                    .roles(configured.role())
                    .build();
        }

        throw new UsernameNotFoundException("Bad credentials");
    }

    @EventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onAuthenticationSuccess(AuthenticationSuccessEvent event) {
        String username = event.getAuthentication().getName();
        if (username == null || username.isBlank()) {
            return;
        }
        try {
            appUserRepository.findByUsernameIgnoreCase(username).ifPresent(user -> {
                Instant last = user.getLastLoginAt();
                if (last == null || last.isBefore(Instant.now().minus(LAST_LOGIN_REFRESH_INTERVAL))) {
                    user.setLastLoginAt(Instant.now());
                    appUserRepository.save(user);
                }
            });
        } catch (RuntimeException ex) {
            log.warn("Could not update last_login_at for '{}': {}", username, ex.getMessage());
        }
    }
}
