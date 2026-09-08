package com.solarintegrators.inventory.service.mail;

/**
 * Sends one message. The whole mail surface of this application.
 *
 * <p>Kept to a single method on purpose. Everything the system emails is a
 * short transactional notice to one recipient, and a narrow interface is what
 * makes it cheap to delete: when Microsoft Entra ID takes over identity
 * (CSC-09) the directory sends the invitations and this goes with it.</p>
 */
public interface MailSender {

    /**
     * Attempts delivery.
     *
     * @return true when the provider accepted the message. False - never an
     *         exception - when mail is not configured or the provider refused,
     *         because no email is worth failing the operation that triggered
     *         it. The caller decides what to tell the user; for invitations it
     *         hands the administrator the link to pass on instead.
     */
    boolean send(String toAddress, String subject, String htmlBody);

    /** Whether delivery is even possible, so callers can say so up front. */
    boolean isConfigured();
}
