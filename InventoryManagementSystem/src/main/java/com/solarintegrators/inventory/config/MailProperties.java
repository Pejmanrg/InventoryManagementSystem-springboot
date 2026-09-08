package com.solarintegrators.inventory.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Microsoft Graph mail settings, bound from {@code app.mail}.
 *
 * <p><strong>Why Graph and not SMTP.</strong> Cloud Run blocks outbound port 25
 * and there is no way to open it, so an SMTP client cannot work from here at
 * all. Cal Solar is already on Microsoft 365, so sending through Graph as a
 * mailbox that exists in the tenant avoids introducing a second mail vendor and
 * keeps the sent items where the business can see them.</p>
 *
 * <p><strong>Unconfigured is a supported state.</strong> When these values are
 * absent the application starts normally and invitations still work - the link
 * is returned to the administrator who issued it, to pass on by hand. That is
 * what makes it possible to build and test the flow before the Entra
 * application registration exists, and it is the fallback on the day Graph is
 * refusing calls.</p>
 */
@ConfigurationProperties(prefix = "app.mail")
public class MailProperties {

    /** Directory (tenant) ID of the Microsoft 365 tenant. */
    private String tenantId;

    /** Application (client) ID of the Entra app registration. */
    private String clientId;

    /** Client secret. Never in application.yml - injected from Secret Manager. */
    private String clientSecret;

    /**
     * The mailbox to send as, e.g. no-reply@calsolarinc.com.
     *
     * <p>Graph's Mail.Send application permission grants access to every mailbox
     * in the tenant by default. Restrict it to this one address with an
     * application access policy, or the registration can send as anyone in the
     * company.</p>
     */
    private String sender;

    /** Display name on the From line. */
    private String fromName = "Cal Solar Inventory";

    /** True when every value needed to reach Graph is present. */
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
