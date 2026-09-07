package com.solarintegrators.inventory.config;

import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Phase 1 security.
 *
 * <p>HTTP Basic against an in-memory user store, stateless sessions, and
 * method-level authorization with {@code @PreAuthorize} on the controllers. The
 * roles are the four from the SDD user view: FIELD, MANAGER, FINANCE, ADMIN.</p>
 *
 * <p><strong>What this is not.</strong> It is not the production identity
 * design. Microsoft Entra ID with OpenID Connect is Phase 3 (CSC-09). When that
 * arrives, the change is contained: replace {@code httpBasic} with
 * {@code oauth2ResourceServer(jwt)}, delete
 * {@link #userDetailsService(SecurityProperties, PasswordEncoder)}, and map role
 * claims to authorities. The {@code @PreAuthorize} rules on the controllers are
 * written against role names, so they do not change at all.</p>
 *
 * <p>CSRF is disabled because this is a token-style stateless API with no
 * cookie-based session for a browser to replay - not because CSRF does not
 * matter. If a session cookie is ever introduced, this decision must be
 * revisited.</p>
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain apiFilterChain(HttpSecurity http, SecurityProperties properties) throws Exception {
        http
            .securityMatcher("/**")
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource(properties)))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                    .requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
                    .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                    .requestMatchers("/api/**").authenticated()
                    .anyRequest().denyAll())
            .httpBasic(Customizer.withDefaults());

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Builds the development user store from configuration. Passwords are
     * supplied in plaintext by configuration and hashed here, so no hash is
     * committed to the repository and no plaintext is stored in memory.
     */
    @Bean
    public InMemoryUserDetailsManager userDetailsService(SecurityProperties properties,
                                                         PasswordEncoder passwordEncoder) {
        List<UserDetails> users = properties.getUsers().stream()
                .map(devUser -> (UserDetails) User.withUsername(devUser.getUsername())
                        .password(passwordEncoder.encode(devUser.getPassword()))
                        .roles(devUser.getRole())
                        .build())
                .toList();
        return new InMemoryUserDetailsManager(users);
    }

    private CorsConfigurationSource corsConfigurationSource(SecurityProperties properties) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(properties.getAllowedOrigins());
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }
}
