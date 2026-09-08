package com.solarintegrators.inventory.dto.response;

import java.time.Instant;

/**
 * The result of issuing an invitation or reset, returned to the administrator.
 *
 * <p><strong>Why the link is included.</strong> It is a live credential, so
 * including it deserves an argument. The argument is that the caller is an
 * administrator who can already set this account's password outright - the link
 * grants them nothing they did not have. What it buys is a system that still
 * works when mail does not: a wrong address, a tenant misconfiguration, a
 * mailbox full. Without it, the first failed send would leave an account
 * nobody can get into and no way to fix it short of a database edit.</p>
 *
 * <p>{@code sent} says whether it actually went out, so the interface can tell
 * an administrator to pass the link on by hand rather than letting them assume
 * an email is on its way.</p>
 */
public record InvitationIssuedResponse(
        boolean sent,
        String sentTo,
        Instant expiresAt,
        String link) {
}
