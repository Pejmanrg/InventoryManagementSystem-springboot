
(function () {
  'use strict';

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
