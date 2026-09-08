package com.solarintegrators.inventory.model;

/**
 * Why a single-use link was issued.
 *
 * <p>The two differ in lifetime and in wording, not in mechanism. An invitation
 * is expected to sit in an inbox until someone gets round to it, so it lasts
 * days. A reset is requested by someone who is trying to sign in right now, so
 * it lasts an hour - a long-lived reset link is a standing key to the account
 * for anyone who later reaches that mailbox.</p>
 */
public enum InvitationPurpose {

    /** First password for a newly created account. */
    INVITE,

    /** Replacement password for an account whose holder cannot sign in. */
    RESET
}
