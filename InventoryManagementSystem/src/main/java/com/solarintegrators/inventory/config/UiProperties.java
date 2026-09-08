package com.solarintegrators.inventory.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Where the front end lives, bound from {@code app.ui}.
 *
 * <p>The API needs this for one reason: an emailed link has to point at a page
 * a person can open, and the API cannot infer that from the request it is
 * handling. Deriving it from the incoming Host or Origin header would be worse
 * than a setting - those are attacker-controlled, and a password link built
 * from a forged header is a password link sent to the wrong site.</p>
 */
@ConfigurationProperties(prefix = "app.ui")
public class UiProperties {

    /** Front-end origin, no trailing slash, e.g. https://inventory.calsolarinc.com */
    private String baseUrl = "http://localhost:5500";

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        /* Tolerate a trailing slash in configuration rather than producing
           links with a doubled one. */
        this.baseUrl = baseUrl == null ? null : baseUrl.replaceAll("/+$", "");
    }

    /** The set-password page, with the token already attached. */
    public String passwordLink(String token) {
        return baseUrl + "/set-password.html?token=" + token;
    }
}
