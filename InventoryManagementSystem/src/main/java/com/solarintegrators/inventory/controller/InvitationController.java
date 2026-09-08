package com.solarintegrators.inventory.controller;

import com.solarintegrators.inventory.dto.request.AcceptInvitationRequest;
import com.solarintegrators.inventory.dto.request.PasswordResetRequest;
import com.solarintegrators.inventory.dto.response.InvitationCheckResponse;
import com.solarintegrators.inventory.service.InvitationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The only unauthenticated endpoints in the application (CSC-09).
 *
 * <p>They have to be. Every person these serve is someone who cannot sign in -
 * a new joiner with no password yet, or someone who has forgotten theirs.
 * Requiring authentication would make them unreachable by exactly the people
 * they exist for.</p>
 *
 * <p><strong>What stands in for authentication.</strong> A 256-bit single-use
 * token, delivered to an address the account already had on file. Possession of
 * the token is the claim; control of the mailbox is what backs it. Nothing here
 * accepts a username as identification, and nothing here returns anything about
 * an account that the token holder did not already have.</p>
 *
 * <p><strong>Enumeration.</strong> {@code /password-reset} answers 202 for
 * every input - real account, unknown account, disabled account, malformed
 * address. It has to: a public endpoint that responds differently for accounts
 * that exist is a directory of who works here, queryable by anyone.</p>
 *
 * <p><strong>Known gap.</strong> There is no per-address rate limit, only a
 * short cooldown that stops the same account being mailed repeatedly. Someone
 * determined could still cycle through many addresses. A real limiter belongs
 * in front of the service - Cloud Armor - rather than in application code that
 * would have to coordinate across Cloud Run instances to work at all.</p>
 */
@RestController
@RequestMapping("/api")
public class InvitationController {

    private final InvitationService invitationService;

    public InvitationController(InvitationService invitationService) {
        this.invitationService = invitationService;
    }

    /**
     * Describes a link so the page can be worded correctly before anyone types.
     *
     * <p>Returns the username and display name only. It is a GET, so the token
     * is in the URL and therefore in browser history and any intermediary's
     * logs - which is a reason to keep the response thin and the lifetime
     * short, and the reason the token is single-use.</p>
     */
    @GetMapping("/invitations/{token}")
    public InvitationCheckResponse check(@PathVariable String token) {
        return invitationService.check(token);
    }

    /** Sets the password and burns the link. 204: nothing to return, by design. */
    @PostMapping("/invitations/{token}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void accept(@PathVariable String token,
                       @Valid @RequestBody AcceptInvitationRequest request) {
        invitationService.accept(token, request.newPassword());
    }

    /**
     * "I forgot my password."
     *
     * <p>Always 202 Accepted, never 404 and never 200-with-a-body. Accepted is
     * the honest status: the request has been taken, and whether anything was
     * sent is deliberately not disclosed.</p>
     */
    @PostMapping("/password-reset")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void requestReset(@Valid @RequestBody PasswordResetRequest request) {
        invitationService.requestReset(request.usernameOrEmail());
    }
}
