
(function () {
  'use strict';

  var page = UI.mountShell({ active: 'admin', title: 'User Profile' });
  if (!page) { return; }

  if (!Auth.can('admin.view')) {
    page.innerHTML = '<div class="page-head"><div class="page-head__text"><h1>User profile</h1></div></div>'
      + UI.denied('the administration area');
    return;
  }

  var D = window.MockData;
  var ROLE_LIST = Object.keys(D.ROLES).map(function (k) { return { code: k, label: D.ROLES[k].name }; });
  var STATUS_LIST = [{ code: 'true', label: 'Active' }, { code: 'false', label: 'Disabled' }];

  var userId = UI.param('id');
  var canEdit = Auth.can('admin.roles');
  var signedInAs = (Auth.user() || {}).username || '';

  if (!userId) {
    page.innerHTML = UI.emptyState('No account selected', 'Open an account from the users list.',
      '<a class="btn btn--primary" href="admin.html">Go to users</a>');
    return;
  }

  render();

  function render() {
    page.innerHTML = UI.loading('Loading account…');

    API.admin.getUser(userId).then(function (u) {
      var isSelf = !!signedInAs && signedInAs.toLowerCase() === String(u.username).toLowerCase();

      page.innerHTML = ''
        + '<div class="breadcrumb"><a href="admin.html">Administration</a><span>/</span>'
        +   UI.esc(u.name) + '</div>'
        + '<div class="page-head">'
        +   '<div class="page-head__text">'
        +     '<h1>' + UI.esc(u.name) + '</h1>'
        +     '<div class="page-head__sub"><span class="mono">' + UI.esc(u.username) + '</span> · '
        +       UI.esc(u.roleName) + ' · '
        +       (u.active ? '<span class="badge badge--ok">Active</span>'
                          : '<span class="badge badge--neutral">Disabled</span>')
        +     '</div>'
        +   '</div>'
        +   '<div class="page-head__actions"><a class="btn" href="admin.html">Back to users</a></div>'
        + '</div>'
        + '<div id="formBanner" class="mb-4"></div>'
        + (isSelf ? selfNotice() : '')
        + '<div class="grid grid--split">'
        +   '<div class="stack">' + profileCard(u, isSelf) + '</div>'
        +   '<div class="stack">' + accountCard(u) + passwordCard(u) + dangerCard(u, isSelf) + '</div>'
        + '</div>';

      wire(u, isSelf);
    }).catch(function (err) {
      page.innerHTML = UI.emptyState('Account not available', err.message,
        '<a class="btn btn--primary" href="admin.html">Back to users</a>');
    });
  }

  function selfNotice() {
    return '<div class="alert alert--info mb-4"><span class="alert__icon" aria-hidden="true">i</span>'
      + '<div class="alert__body"><div class="alert__title">This is your own account</div>'
      + 'You can edit your name, email and job title. Changing your own role, disabling yourself '
      + 'or deleting the account are blocked - ask another administrator to do those.</div></div>';
  }

  function profileCard(u, isSelf) {
    var lockRole = !canEdit || isSelf;
    var lockStatus = !canEdit || isSelf;

    return '<section class="card"><div class="card__head"><h2>Profile</h2></div>'
      + '<div class="card__body">'
      +   '<div class="grid grid--2">'
      +     field('firstName', 'First name', input('firstName', u.firstName))
      +     field('lastName', 'Last name', input('lastName', u.lastName))
      +     field('email', 'Email', input('email', u.email, 'email'))
      +     field('jobTitle', 'Job title', input('jobTitle', u.jobTitle))
      +     field('role', 'Role',
              '<select id="f_role" name="role"' + (lockRole ? ' disabled' : '') + '>'
              + UI.selectOptions(ROLE_LIST, 'code', 'label', u.role) + '</select>',
              lockRole ? (isSelf ? 'You cannot change your own role.' : 'Your role cannot change roles.') : '')
      +     field('active', 'Status',
              '<select id="f_active" name="active"' + (lockStatus ? ' disabled' : '') + '>'
              + UI.selectOptions(STATUS_LIST, 'code', 'label', String(!!u.active)) + '</select>',
              lockStatus ? (isSelf ? 'You cannot disable your own account.' : '') : '')
      +   '</div>'
      + '</div>'
      + (canEdit
          ? '<div class="card__foot"><div class="spacer"></div>'
            + '<button class="btn btn--primary" type="button" id="saveProfile">Save changes</button></div>'
          : '<div class="card__foot"><span class="small muted">Your role can view accounts but not change them.</span></div>')
      + '</section>';
  }

  function accountCard(u) {
    return '<section class="card"><div class="card__head"><h2>Account</h2></div>'
      + '<div class="card__body">'
      +   '<div class="dl" style="grid-template-columns:1fr">'
      +     row('Username', '<span class="mono">' + UI.esc(u.username) + '</span>')
      +     row('Account id', '<span class="mono xsmall">' + UI.esc(u.userId) + '</span>')
      +     row('Last sign-in', UI.esc(u.lastSignIn ? UI.fmtDateTime(u.lastSignIn) : 'Never'))
      +     row('Created', UI.esc(u.createdAt ? UI.fmtDateTime(u.createdAt) : '—'))
      +     row('Last updated', UI.esc(u.updatedAt ? UI.fmtDateTime(u.updatedAt) : '—'))
      +   '</div>'
      +   '<p class="prototype-note">The username is fixed once the account exists. It is what the '
      +   'audit trail records as the actor, so changing it would rewrite history that has already '
      +   'been read and acted on.</p>'
      + '</div></section>';
  }

  function row(term, html) {
    return '<div class="dl__item"><div class="dl__term">' + UI.esc(term) + '</div>'
      + '<div class="dl__val">' + html + '</div></div>';
  }

  function passwordCard(u) {
    if (!canEdit) { return ''; }

    return '<section class="card"><div class="card__head"><h2>Password</h2></div>'
      + '<div class="card__body">'
      +   '<p class="small">Email ' + UI.esc(u.name) + ' a single-use link so they can set their '
      +   'own password. Nobody else ever sees it, including you.</p>'
      +   (u.email
          ? '<p class="small muted">Goes to <span class="mono">' + UI.esc(u.email) + '</span>. '
            + 'The link works once and expires after an hour.</p>'
          : '<div class="alert alert--warning"><span class="alert__icon" aria-hidden="true">!</span>'
            + '<div class="alert__body">This account has no email address, so the link cannot be '
            + 'sent. It will be shown here instead for you to pass on. Adding an address above is '
            + 'the better fix.</div></div>')
      + '</div>'
      + '<div class="card__foot"><div class="spacer"></div>'
      +   '<button class="btn btn--primary" type="button" id="sendLink">Email a password link</button>'
      + '</div>'

      + '<div class="card__body" style="border-top:1px solid var(--c-border)">'
      +   '<details>'
      +     '<summary class="small">Set a password directly instead</summary>'
      +     '<p class="small muted mt-4">For an account with no working mailbox - a shared '
      +     'warehouse login, someone not yet provisioned. You will know the password, and you '
      +     'still have to get it to them somehow.</p>'
      +     field('newPassword', 'New password',
              '<input id="f_newPassword" name="newPassword" type="text" autocomplete="new-password">',
              'At least 10 characters. Shown in plain text so you can read it out.')
      +     '<button class="btn" type="button" id="resetPassword">Set password</button>'
      +   '</details>'
      + '</div>'
      + '</section>';
  }

  function dangerCard(u, isSelf) {
    if (!canEdit) { return ''; }
    var blocked = isSelf;
    return '<section class="card"><div class="card__head"><h2>Delete account</h2></div>'
      + '<div class="card__body">'
      +   '<p class="small">Deleting removes the sign-in account permanently. Audit entries stay, '
      +   'recorded against the username. Disabling is almost always the better choice - it keeps '
      +   'the account recoverable and the name resolvable.</p>'
      +   (blocked ? '<p class="small muted">You cannot delete your own account.</p>' : '')
      + '</div>'
      + '<div class="card__foot"><div class="spacer"></div>'
      +   '<button class="btn btn--danger" type="button" id="deleteUser"'
      +   (blocked ? ' disabled' : '') + '>Delete account</button></div>'
      + '</section>';
  }

  function wire(u, isSelf) {
    var save = UI.qs('#saveProfile');
    if (save) { save.addEventListener('click', function () { saveProfile(u, isSelf); }); }

    var send = UI.qs('#sendLink');
    if (send) { send.addEventListener('click', function () { sendLink(u); }); }

    var reset = UI.qs('#resetPassword');
    if (reset) { reset.addEventListener('click', function () { resetPassword(u); }); }

    var del = UI.qs('#deleteUser');
    if (del && !del.disabled) { del.addEventListener('click', function () { removeUser(u); }); }
  }

  function saveProfile(u, isSelf) {
    UI.clearErrors(page);

    var lockRole = !canEdit || isSelf;
    var lockStatus = !canEdit || isSelf;

    var payload = {
      firstName: val('firstName') || null,
      lastName: val('lastName') || null,
      email: val('email') || null,
      jobTitle: val('jobTitle') || null,
      role: lockRole ? u.role : UI.qs('#f_role').value,
      active: lockStatus ? u.active : (UI.qs('#f_active').value === 'true')
    };

    var demotingAdmin = u.role === 'ADMIN' && payload.role !== 'ADMIN';
    var disabling = u.active && !payload.active;

    var proceed = (demotingAdmin || disabling)
      ? UI.confirm({
          title: disabling ? 'Disable this account?' : 'Change this role?',
          message: disabling
            ? 'A disabled account cannot sign in until an administrator re-enables it.'
            : 'This account will immediately lose administrator access.',
          summary: [
            { label: 'User', value: u.name },
            { label: 'Role', value: D.ROLES[u.role] ? D.ROLES[u.role].name : u.role }
          ].concat(demotingAdmin
            ? [{ label: 'New role', value: D.ROLES[payload.role] ? D.ROLES[payload.role].name : payload.role }]
            : []),
          warning: 'The server refuses this if it would leave no active administrator.',
          confirmLabel: disabling ? 'Disable account' : 'Change role',
          danger: true
        })
      : Promise.resolve(true);

    proceed.then(function (ok) {
      if (!ok) { return; }
      return API.admin.updateUser(u.userId, payload).then(function (saved) {
        UI.toast('Profile saved', saved.name + ' updated.', 'success');
        render();
      });
    }).catch(function (err) { UI.handleApiError(err, page); });
  }

  function sendLink(u) {
    var button = UI.qs('#sendLink');
    var restore = function () {
      if (button) { button.disabled = false; button.textContent = 'Email a password link'; }
    };
    if (button) { button.disabled = true; button.textContent = 'Sending…'; }

    API.admin.invite(u.userId, 'RESET').then(function (invitation) {
      restore();
      if (invitation && invitation.sent) {
        UI.toast('Link sent', 'A password link was emailed to ' + invitation.sentTo + '.', 'success');
        return;
      }
      UI.modal({
        title: 'Pass this link to ' + u.name,
        body: '<div class="alert alert--warning"><span class="alert__icon" aria-hidden="true">!</span>'
          + '<div class="alert__body"><div class="alert__title">No email was sent</div>'
          + 'Mail is not configured, or this account has no address on file.</div></div>'
          + '<div class="field mt-4"><label class="field__label" for="resetLink">Password link</label>'
          + '<input id="resetLink" name="resetLink" type="text" readonly data-autofocus value="'
          + UI.esc(invitation ? invitation.link : '') + '"></div>'
          + '<p class="small muted">Treat it like a password. It works once and expires on '
          + UI.esc(invitation ? UI.fmtDateTime(invitation.expiresAt) : '') + '.</p>',
        buttons: [{ label: 'Done', value: null, variant: 'primary' }],
        onOpen: function (root) {
          var input = root.querySelector('#resetLink');
          if (input) { input.select(); }
        }
      });
    }, function (err) {
      restore();
      UI.handleApiError(err, page);
    });
  }

  function resetPassword(u) {
    UI.clearErrors(page);
    var input = UI.qs('#f_newPassword');
    var value = input ? input.value : '';

    if (value.length < 10) {
      UI.setFieldError('newPassword', 'Use at least 10 characters.', page);
      return;
    }

    UI.confirm({
      title: 'Set a new password',
      message: 'The current password stops working immediately.',
      summary: [{ label: 'User', value: u.name }, { label: 'Username', value: u.username }],
      confirmLabel: 'Set password'
    }).then(function (ok) {
      if (!ok) { return; }
      return API.admin.resetPassword(u.userId, value).then(function () {
        input.value = '';
        UI.toast('Password set', 'Give the new password to ' + u.name + '.', 'success');
      });
    }).catch(function (err) { UI.handleApiError(err, page); });
  }

  function removeUser(u) {
    UI.confirm({
      title: 'Delete this account?',
      message: 'This cannot be undone. Consider disabling the account instead.',
      summary: [
        { label: 'User', value: u.name },
        { label: 'Username', value: u.username },
        { label: 'Role', value: u.roleName }
      ],
      warning: 'Audit history is kept and stays attributed to this username.',
      confirmLabel: 'Delete account',
      danger: true
    }).then(function (ok) {
      if (!ok) { return; }
      return API.admin.deleteUser(u.userId).then(function () {
        window.location.href = 'admin.html';
      });
    }).catch(function (err) { UI.handleApiError(err, page); });
  }

  function val(name) {
    var el = UI.qs('#f_' + name);
    return el ? el.value.trim() : '';
  }

  function input(name, value, type) {
    return '<input id="f_' + name + '" name="' + name + '" type="' + (type || 'text') + '"'
      + ' value="' + UI.esc(value || '') + '"' + (canEdit ? '' : ' disabled') + '>';
  }

  function field(name, label, control, hint) {
    return '<div class="field"><label class="field__label" for="f_' + name + '">' + UI.esc(label) + '</label>'
      + control
      + (hint ? '<div class="xsmall muted">' + UI.esc(hint) + '</div>' : '')
      + '<div class="field__error" role="alert"></div></div>';
  }
})();
