package com.solarintegrators.inventory.service.mail;

import com.solarintegrators.inventory.config.MailProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

@Service
public class GraphMailSender implements MailSender {
    private static final Logger log = LoggerFactory.getLogger(GraphMailSender.class);

    private static final String TOKEN_URL = "https://login.microsoftonline.com/%s/oauth2/v2.0/token";
    private static final String SEND_URL = "https://graph.microsoft.com/v1.0/users/%s/sendMail";
    private static final String SCOPE = "https://graph.microsoft.com/.default";

    private static final Duration EXPIRY_MARGIN = Duration.ofMinutes(2);

    private final MailProperties properties;
    private final RestClient http;

    private volatile String cachedToken;
    private volatile Instant cachedTokenExpiry = Instant.EPOCH;

    public GraphMailSender(MailProperties properties) {
        this.properties = properties;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(15));
        this.http = RestClient.builder().requestFactory(factory).build();

        if (properties.isConfigured()) {
            log.info("Mail enabled: sending through Microsoft Graph as {}.", properties.getSender());
        } else {
            log.warn("Mail is NOT configured (app.mail.*). Invitation and reset links will be "
                    + "returned to the administrator to pass on by hand instead of being emailed.");
        }
    }

    @Override
    public boolean isConfigured() {
        return properties.isConfigured();
    }

    @Override
    public boolean send(String toAddress, String subject, String htmlBody) {
        if (!properties.isConfigured()) {
            return false;
        }
        if (toAddress == null || toAddress.isBlank()) {
            log.warn("Not sending '{}': the account has no email address.", subject);
            return false;
        }

        try {
            String token = accessToken();
            if (token == null) { return false; }

            Map<String, Object> message = Map.of(
                    "message", Map.of(
                            "subject", subject,
                            "body", Map.of("contentType", "HTML", "content", htmlBody),
                            "toRecipients", List.of(
                                    Map.of("emailAddress", Map.of("address", toAddress)))),
                    "saveToSentItems", true);

            http.post()
                    .uri(String.format(SEND_URL, properties.getSender()))
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(message)
                    .retrieve()
                    .toBodilessEntity();

            log.info("Sent '{}' to {}.", subject, toAddress);
            return true;

        } catch (RuntimeException ex) {
            log.error("Graph refused to send '{}' to {}: {}", subject, toAddress, ex.getMessage());
            return false;
        }
    }

    private synchronized String accessToken() {
        if (cachedToken != null && Instant.now().isBefore(cachedTokenExpiry)) {
            return cachedToken;
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", properties.getClientId());
        form.add("client_secret", properties.getClientSecret());
        form.add("scope", SCOPE);
        form.add("grant_type", "client_credentials");

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> body = http.post()
                    .uri(String.format(TOKEN_URL, properties.getTenantId()))
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(Map.class);

            if (body == null || body.get("access_token") == null) {
                log.error("Microsoft returned no access token. Check the tenant, client id and secret.");
                return null;
            }

            cachedToken = String.valueOf(body.get("access_token"));
            long expiresIn = body.get("expires_in") instanceof Number n ? n.longValue() : 3600L;
            cachedTokenExpiry = Instant.now().plusSeconds(expiresIn).minus(EXPIRY_MARGIN);
            return cachedToken;

        } catch (RuntimeException ex) {
            log.error("Could not obtain a Microsoft Graph token: {}", ex.getMessage());
            cachedToken = null;
            cachedTokenExpiry = Instant.EPOCH;
            return null;
        }
    }
}
