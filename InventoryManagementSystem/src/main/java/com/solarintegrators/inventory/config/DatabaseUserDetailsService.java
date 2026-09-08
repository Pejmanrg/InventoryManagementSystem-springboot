package com.solarintegrators.inventory.config;

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

/**
 * Authenticates against the {@code app_users} table, falling back to the
 * accounts in application.yml.
 *
 * <p><strong>Why this is the only UserDetailsService bean.</strong> Spring
 * Security auto-configures its authentication provider only when exactly one
 * {@code UserDetailsService} bean exists; with two it wires none at all and
 * every credential is rejected. The configured accounts are therefore built
 * here as a private map rather than published as a second bean. Marking one
 * {@code @Primary} does not help - the check counts beans, not precedence.</p>
 *
 * <p><strong>Why a fallback exists.</strong> Moving accounts into the database
 * makes the database a single point of failure for getting in at all. An empty
 * table after a fresh migration, a bad hash written by hand, or a deleted last
 * administrator would otherwise lock everyone out, with a redeploy as the only
 * repair. The configuration accounts remain as a break-glass path for exactly
 * those cases.</p>
 *
 * <p><strong>Precedence.</strong> The database wins whenever the username exists
 * there. Configuration is consulted only for usernames the database does not
 * know, so creating a database account named {@code admin} takes over that name
 * rather than being shadowed - otherwise changing a password in the interface
 * would appear to work while the old configured credential still authenticated.
 * A disabled database account is rejected outright rather than falling through,
 * so deactivating a user cannot silently re-enable them under their configured
 * password.</p>
 *
 * <p>Phase 3 removes this class entirely: Entra ID issues a token and no
 * password is verified by this application at all.</p>
 */
@Service
public class DatabaseUserDetailsService implements UserDetailsService {

    private static final Logger log = LoggerFactory.getLogger(DatabaseUserDetailsService.class);

    /**
     * Sign-in is stateless HTTP Basic, so every request re-authenticates.
     * Writing last_login_at on each one would add a database write to every API
     * call for a column that only needs to be roughly right, so it is refreshed
     * at most once per interval per account.
     */
    private static final Duration LAST_LOGIN_REFRESH_INTERVAL = Duration.ofMinutes(15);

    private final AppUserRepository appUserRepository;

    /** Break-glass accounts, hashed once at startup. Keyed by lower-cased username. */
    private final Map<String, UserDetails> configuredUsers = new LinkedHashMap<>();

    public DatabaseUserDetailsService(AppUserRepository appUserRepository,
                                      SecurityProperties properties,
                                      PasswordEncoder passwordEncoder) {
        this.appUserRepository = appUserRepository;

        properties.getUsers().forEach(devUser -> {
            if (devUser.getUsername() == null || devUser.getPassword() == null) {
                return;
            }
            configuredUsers.put(devUser.getUsername().toLowerCase(),
                    User.withUsername(devUser.getUsername())
                            .password(passwordEncoder.encode(devUser.getPassword()))
                            .roles(devUser.getRole())
                            .build());
        });

        log.info("Authentication ready: database accounts first, {} configured break-glass account(s).",
                configuredUsers.size());
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

        UserDetails configured = username == null
                ? null
                : configuredUsers.get(username.toLowerCase());

        if (configured != null) {
            log.debug("Authenticated '{}' from configuration - no database account with that username.", username);
            return configured;
        }

        /* Neutral message: whether a username exists is not something an
           unauthenticated caller should be able to probe. */
        throw new UsernameNotFoundException("Bad credentials");
    }

    /**
     * Records when an account was last used.
     *
     * <p>Runs in its own transaction so a failure here can never fail the
     * request that just authenticated successfully - a bookkeeping column is not
     * worth rejecting a valid sign-in over.</p>
     */
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
