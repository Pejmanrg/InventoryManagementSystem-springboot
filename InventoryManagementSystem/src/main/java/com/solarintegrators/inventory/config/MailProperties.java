package com.solarintegrators.inventory.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.mail")
public class MailProperties {
    private String tenantId;

    private String clientId;

    private String clientSecret;

    private String sender;

    private String fromName = "Cal Solar Inventory";

    public boolean isConfigured() {
        return notBlank(tenantId) && notBlank(clientId) && notBlank(clientSecret) && notBlank(sender);
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getClientSecret() { return clientSecret; }
    public void setClientSecret(String clientSecret) { this.clientSecret = clientSecret; }

    public String getSender() { return sender; }
    public void setSender(String sender) { this.sender = sender; }

    public String getFromName() { return fromName; }
    public void setFromName(String fromName) { this.fromName = fromName; }
}
