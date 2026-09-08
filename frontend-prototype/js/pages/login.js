/* ==========================================================================
   pages/login.js - Screen 1: Login
   --------------------------------------------------------------------------
   Maps to CSC-09 Identity & Access.

   Phase 1 signs in with a username and password, sent to the API as HTTP
   Basic over HTTPS. The credential is validated by API.auth.signIn(), which
   makes a real request before any session is stored - so a wrong password
   fails here rather than on the first screen after the redirect.

   Phase 3 replaces this form with a redirect to Microsoft Entra ID (OIDC).
   The "Sign in with Microsoft" button is present but disabled so the intended
   production path stays visible in the interface.
   ========================================================================== */

(function () {
  'use strict';

  /* Already signed in - skip straight to the application. */
  if (window.Store.getSession()) {
    window.location.replace('dashboard.html');
    return;
  }

  var form          = UI.qs('#loginForm');
  var usernameInput = UI.qs('#username');
  var passwordInput = UI.qs('#password');
  var signInBtn     = UI.qs('#signInBtn');

  var busy = false;

  function setBusy(state) {
    busy = state;
    signInBtn.disabled    = state;
    signInBtn.textContent = state ? 'Signing in…' : 'Sign in';
    usernameInput.disabled = state;
    passwordInput.disabled = state;
  }

  function signIn() {
    if (busy) { return; }
    UI.clearErrors(document);

    var username = usernameInput.value.trim();
    var password = passwordInput.value;

    /* Checked here as well as in api.js so an empty field is reported
       immediately, without a network round trip. */
    if (!username) {
      UI.handleApiError(new API.ApiError(400, 'Enter your username.', 'username'), document);
      return;
    }
    if (!password) {
      UI.handleApiError(new API.ApiError(400, 'Enter your password.', 'password'), document);
      return;
    }

    setBusy(true);

    API.auth.signIn(username, password)
      .then(function () {
        window.location.href = 'dashboard.html';
      })
      .catch(function (err) {
        setBusy(false);
        /* Clear the password but keep the username: a mistyped password is the
           common case, and retyping both is needless friction. */
        passwordInput.value = '';
        UI.handleApiError(err, document);
        passwordInput.focus();
      });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    signIn();
  });

  usernameInput.focus();
})();
