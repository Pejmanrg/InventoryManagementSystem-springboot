package com.solarintegrators.inventory.service.mail;

public interface MailSender {
    boolean send(String toAddress, String subject, String htmlBody);

    boolean isConfigured();
}
