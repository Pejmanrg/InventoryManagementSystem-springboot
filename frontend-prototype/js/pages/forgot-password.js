/* ==========================================================================
   pages/forgot-password.js - Requesting a password reset link
   --------------------------------------------------------------------------
   Runs without a session, like set-password.js, and for the same reason.

   The confirmation this page shows is identical whether or not the account
   exists. That is not vagueness for its own sake: a page that says "no such
   account" is a way for anyone to test whether a given person works here, one
   address at a time. The server answers 202 to everything for the same reason,
   so the two cannot disagree.
   ========================================================================== */

(function () {
  'use strict';

  var panel = document.getElementById('panel');

  var BRAND = ''
    + '<div class="login__brand">'
    +   '<div class="sidebar__logo" aria-hidden="true">CI</div>'
    +   '<div><h1 style="font-size:1.0625rem">Cloud Inventory</h1>'
    +     '<div class="small muted">Asset &amp; Stock Management</div></div>'
    + '</div>';

  render();

  function render() {
    panel.innerHTML = BRAND
      + '<h2 style="margin-bottom:4px">Forgot your password</h2>'
      + '<p class="small muted">Enter your username or work email address and we will '
      +   'send you a link to set a new one.</p>'
      + '<div id="formBanner" class="mb-4" style="margin-top:16px"></div>'
      + '<form id="resetForm" novalidate>'
      +   '<div class="field field--full mb-4">'
      +     '<label class="field__label" for="usernameOrEmail">Username or email'
      +       '<span class="req" aria-hidden="true">*</span></label>'
      +     '<input type="text" id="usernameOrEmail" name="usernameOrEmail" '
      +       'autocomplete="username" autocapitalize="none" autocorrect="off" '
      +       'spellcheck="false" required>'
      +     '<div class="field__error"></div>'
      +   '</div>'
      +   '<button class="btn btn--primary btn--block btn--lg" type="submit" id="submitBtn">'
      +     'Send me a link</button>'
      + '</form>'
      + '<a class="btn btn--block mt-4" href="index.html">Back to sign in</a>';

    document.getElementById('resetForm').addEventListener('submit', function (event) {
      event.preventDefault();
      submit();
    });
  }

  function submit() {
    UI.clearErrors(panel);

    var value = document.getElementById('usernameOrEmail').value.trim();
    if (!value) {
      UI.setFieldError('usernameOrEmail', 'Enter your username or email address.', panel);
      return;
    }

    var button = document.getElementById('submitBtn');
    button.disabled = true;
    button.textContent = 'Sending…';

    /* Both branches show the same thing. A network failure is worth reporting -
       that is about this browser, not about who has an account - but any answer
       from the server means the request was taken, and nothing more is
       disclosed. */
    API.invitations.requestReset(value).then(sent).catch(function (err) {
      if (err && err.status === 0) {
        button.disabled = false;
        button.textContent = 'Send me a link';
        UI.showFormError(err.message, panel);
        return;
      }
      sent();
    });
  }

  function sent() {
    panel.innerHTML = BRAND
      + '<h2 style="margin-bottom:4px">Check your email</h2>'
      + '<div class="alert alert--info mt-4"><span class="alert__icon" aria-hidden="true">i</span>'
      +   '<div class="alert__body">If that username or address belongs to an active '
      +   'account, a link is on its way. It works once and expires after an hour.'
      +   '</div></div>'
      + '<p class="small muted mt-4">Nothing arrived? Check junk mail, then ask an '
      +   'administrator to send you one — the account may have a different address on file.</p>'
      + '<a class="btn btn--primary btn--block mt-4" href="index.html">Back to sign in</a>';
  }
})();
