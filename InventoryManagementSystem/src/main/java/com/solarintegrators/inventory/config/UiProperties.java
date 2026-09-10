package com.solarintegrators.inventory.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.ui")
public class UiProperties {
    private String baseUrl = "http://localhost:5500";

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl == null ? null : baseUrl.replaceAll("/+$", "");
    }

    public String passwordLink(String token) {
        return baseUrl + "/set-password.html?token=" + token;
    }
}
