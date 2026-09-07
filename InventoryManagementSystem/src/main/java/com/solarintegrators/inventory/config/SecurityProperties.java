package com.solarintegrators.inventory.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Phase 1 authentication settings, bound from {@code app.security} in
 * application.yml.
 *
 * <p>These accounts exist so the API can be run and demonstrated before the
 * Microsoft Entra ID integration is built. They are development credentials:
 * override them with environment variables in any shared environment, and
 * delete the block entirely once OpenID Connect is in place.</p>
 */
@ConfigurationProperties(prefix = "app.security")
public class SecurityProperties {

    /** Accounts to register in the in-memory user store. */
    private List<DevUser> users = new ArrayList<>();

    /** Origins allowed to call the API from a browser (the front-end prototype). */
    private List<String> allowedOrigins = new ArrayList<>();

    public List<DevUser> getUsers() {
        return users;
    }

    public void setUsers(List<DevUser> users) {
        this.users = users;
    }

    public List<String> getAllowedOrigins() {
        return allowedOrigins;
    }

    public void setAllowedOrigins(List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    /** One development account: username, plaintext password, and role name. */
    public static class DevUser {
        private String username;
        private String password;
        private String role;

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }

        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }

        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
    }
}
