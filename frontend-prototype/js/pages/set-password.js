
(function () {
  'use strict';

  var panel = document.getElementById('panel');
  var token = UI.param('token');

  var BRAND = ''
    + '<div class="login__brand">'
    +   '<div class="sidebar__logo" aria-hidden="true">CI</div>'
    +   '<div><h1 style="font-size:1.0625rem">Cloud Inventory</h1>'
    +     '<div class="small muted">Asset &amp; Stock Management</div></div>'
    + '</div>';

  if (!token) {
    panel.innerHTML = BRAND + problem('This link is incomplete',
      'Open the link from your email exactly as it was sent. It needs the whole '
      + 'address, including everything after the question mark - some mail apps '
      + 'shorten long links when you copy them.');
    return;
  }

  panel.innerHTML = BRAND + '<div style="margin-top:24px">' + UI.loading('Checking your link…') + '</div>';

  API.invitations.check(token).then(renderForm).catch(function (err) {
    panel.innerHTML = BRAND + problem('This link cannot be used', err.message);
  });

  function renderForm(info) {
    var invite = info.purpose === 'INVITE';

    panel.innerHTML = BRAND
      + '<h2 style="margin-bottom:4px">' + (invite ? 'Set your password' : 'Choose a new password') + '</h2>'
      + '<p class="small muted">'
      +   (invite ? 'Welcome, ' : 'For ')
      +   '<strong>' + UI.esc(info.displayName || info.username) + '</strong>'
      +   ' — you will sign in as <span class="mono">' + UI.esc(info.username) + '</span>.'
      + '</p>'
      + '<div id="formBanner" class="mb-4" style="margin-top:16px"></div>'
      + '<form id="pwForm" novalidate>'
      +   passwordField('newPassword', 'New password')
      +   passwordField('confirmPassword', 'Confirm password')
      +   '<button class="btn btn--primary btn--block btn--lg" type="submit" id="submitBtn">'
      +     (invite ? 'Set password and continue' : 'Change my password')
      +   '</button>'
      + '</form>'
      + '<p class="prototype-note">At least 10 characters. This link stops working '
      + 'as soon as you use it, so you will not be able to reuse it later.</p>';

    document.getElementById('pwForm').addEventListener('submit', function (event) {
      event.preventDefault();
      submit(info);
    });
  }

  function passwordField(name, label) {
    return '<div class="field field--full mb-4">'
      + '<label class="field__label" for="' + name + '">' + UI.esc(label)
      +   '<span class="req" aria-hidden="true">*</span></label>'
      + '<input type="password" id="' + name + '" name="' + name + '" '
      +   'autocomplete="new-password" required>'
      + '<div class="field__error"></div>'
      + '</div>';
  }

  function submit(info) {
    UI.clearErrors(panel);

    var value = document.getElementById('newPassword').value;
    var again = document.getElementById('confirmPassword').value;

    if (value.length < 10) {
      UI.setFieldError('newPassword', 'Use at least 10 characters.', panel);
      return;
    }
    if (value !== again) {
      UI.setFieldError('confirmPassword', 'These two do not match.', panel);
      return;
    }

    setBusy(true);
    API.invitations.accept(token, value).then(function () {
      panel.innerHTML = BRAND + succeeded(info);
    }).catch(function (err) {
      setBusy(false);
      UI.handleApiError(err, panel);
    });
  }

  function setBusy(busy) {
    var button = document.getElementById('submitBtn');
    if (!button) { return; }
    button.disabled = busy;
    button.textContent = busy ? 'Saving…' : 'Set password and continue';
  }

  function succeeded(info) {
    return ''
      + '<h2 style="margin-bottom:4px">Your password is set</h2>'
      + '<div class="alert alert--success mt-4"><span class="alert__icon" aria-hidden="true">✓</span>'
      +   '<div class="alert__body">You can now sign in as '
      +   '<span class="mono">' + UI.esc(info.username) + '</span>.</div></div>'
      + '<a class="btn btn--primary btn--block btn--lg mt-4" href="index.html">Go to sign in</a>';
  }

  function problem(title, message) {
    return ''
      + '<h2 style="margin-bottom:4px">' + UI.esc(title) + '</h2>'
      + '<div class="alert alert--danger mt-4"><span class="alert__icon" aria-hidden="true">!</span>'
      +   '<div class="alert__body">' + UI.esc(message) + '</div></div>'
      + '<a class="btn btn--primary btn--block mt-4" href="forgot-password.html">Request a new link</a>'
      + '<a class="btn btn--block mt-4" href="index.html">Back to sign in</a>';
  }
})();
