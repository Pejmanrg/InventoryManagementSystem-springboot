/* ==========================================================================
   pages/login.js - Screen 1: Login
   --------------------------------------------------------------------------
   Maps to CSC-09 Identity & Access. Production sign-in redirects to Microsoft
   Entra ID (OIDC); the prototype selects one of the demo accounts so each
   role's version of the application can be demonstrated.
   ========================================================================== */

(function () {
  'use strict';

  var selected = 'usr-1002'; // Manager - the broadest read-only starting view

  /* If a session already exists, skip the login screen. */
  if (window.Store.getSession()) {
    window.location.replace('dashboard.html');
    return;
  }

  var DEMO_ACCOUNTS = window.MockData.USERS.filter(function (u) {
    return ['usr-1001', 'usr-1002', 'usr-1003', 'usr-1004'].indexOf(u.userId) !== -1;
  });

  function render() {
    var picker = UI.qs('#rolePicker');
    picker.innerHTML = DEMO_ACCOUNTS.map(function (u) {
      var role = window.MockData.ROLES[u.role];
      return '<button type="button" role="radio" class="role-option' + (u.userId === selected ? ' is-selected' : '')
        + '" data-user="' + UI.esc(u.userId) + '" aria-checked="' + (u.userId === selected) + '">'
        + '<span class="avatar" aria-hidden="true">' + UI.esc(UI.initials(u.name)) + '</span>'
        + '<span><span class="role-option__name">' + UI.esc(role.name) + '</span>'
        + '<span class="role-option__desc">' + UI.esc(u.name) + ' — ' + UI.esc(role.description) + '</span></span>'
        + '</button>';
    }).join('');

    UI.qsa('.role-option', picker).forEach(function (btn) {
      btn.addEventListener('click', function () {
        selected = btn.dataset.user;
        render();
      });
    });
  }

  function signIn() {
    UI.clearErrors(document);
    var buttons = UI.qsa('#ssoBtn, #continueBtn');
    buttons.forEach(function (b) { b.disabled = true; });

    API.auth.signIn(selected)
      .then(function () { window.location.href = 'dashboard.html'; })
      .catch(function (err) {
        UI.showFormError(err.message, document);
        buttons.forEach(function (b) { b.disabled = false; });
      });
  }

  render();
  UI.qs('#ssoBtn').addEventListener('click', signIn);
  UI.qs('#continueBtn').addEventListener('click', signIn);
})();
