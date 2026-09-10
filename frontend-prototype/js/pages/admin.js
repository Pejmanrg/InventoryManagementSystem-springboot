
(function () {
  'use strict';

  var page = UI.mountShell({ active: 'admin', title: 'Users & Roles' });
  if (!page) { return; }

  if (!Auth.can('admin.view')) {
    page.innerHTML = '<div class="page-head"><div class="page-head__text"><h1>Administration</h1></div></div>'
      + UI.denied('the administration area');
    return;
  }

  var D = window.MockData;
  var ROLE_LIST = Object.keys(D.ROLES).map(function (k) { return { code: k, label: D.ROLES[k].name }; });

  page.innerHTML = ''
    + '<div class="page-head">'
    +   '<div class="page-head__text">'
    +     '<h1>Administration</h1>'
    +     '<div class="page-head__sub">Users and roles, lookup values, and integration settings.</div>'
    +   '</div>'
    + '</div>'
    + '<div class="stack">'
    +   '<section class="card"><div class="card__head"><h2>Users and roles</h2>'
    +     '<div class="spacer"></div><span class="pill" id="userCount"></span>'
    +     (Auth.can('admin.roles')
          ? ' <button class="btn btn--primary btn--sm" type="button" id="newUser">New user</button>'
          : '')
    +     '</div>'
    +     '<div id="formBanner"></div>'
    +     '<div id="usersHost">' + UI.loading('Loading users…') + '</div></section>'
    +   '<div class="grid grid--2">'
    +     '<section class="card"><div class="card__head"><h2>Role capabilities</h2></div>'
    +       '<div class="card__body" id="rolesHost"></div></section>'
    +     '<section class="card"><div class="card__head"><h2>Lookup values</h2></div>'
    +       '<div class="card__body" id="lookupHost">' + UI.loading('Loading…') + '</div></section>'
    +   '</div>'
    +   '<section class="card"><div class="card__head"><h2>External integrations</h2>'
    +     '<div class="spacer"></div>'
    +     '<span class="small muted">CSC-13 External Integration Gateway</span></div>'
    +     '<div id="integrationHost">' + UI.loading('Loading…') + '</div></section>'
    + '</div>';

  var newUserBtn = UI.qs('#newUser');
  if (newUserBtn) { newUserBtn.addEventListener('click', function () { createUser(); }); }

  renderRoles();
  loadUsers();
  loadLookups();
  loadIntegrations();

  function loadUsers() {
    API.admin.users().then(function (users) {
      UI.qs('#userCount').textContent = users.length + (users.length === 1 ? ' account' : ' accounts');

      if (!users.length) {
        UI.qs('#usersHost').innerHTML = UI.emptyState(
          'No accounts yet',
          'You are signed in with a break-glass account defined in the server configuration. '
            + 'Create a real account so day-to-day sign-in no longer depends on it.',
          Auth.can('admin.roles')
            ? '<button class="btn btn--primary" type="button" id="firstUser">Create the first account</button>'
            : '');
        var first = UI.qs('#firstUser');
        if (first) { first.addEventListener('click', function () { createUser(); }); }
        return;
      }

      UI.qs('#usersHost').innerHTML = '<div class="table-wrap"><table class="data responsive"><thead><tr>'
        + '<th scope="col">User</th><th scope="col">Email</th><th scope="col">Job title</th>'
        + '<th scope="col">Role</th><th scope="col">Status</th><th scope="col">Last sign-in</th>'
        + '<th scope="col"><span class="visually-hidden">Actions</span></th>'
        + '</tr></thead><tbody>'
        + users.map(function (u) {
            var href = 'user-detail.html?id=' + encodeURIComponent(u.userId);
            return '<tr>'
              + '<td data-label="User"><a class="cell-strong" href="' + href + '">' + UI.esc(u.name) + '</a>'
              +   '<div class="cell-sub mono">' + UI.esc(u.username) + '</div></td>'
              + '<td data-label="Email">' + UI.esc(u.email || '—') + '</td>'
              + '<td data-label="Job title">' + UI.esc(u.jobTitle || '—') + '</td>'
              + '<td data-label="Role">' + UI.esc(u.roleName) + '</td>'
              + '<td data-label="Status">' + (u.active
                  ? '<span class="badge badge--ok">Active</span>'
                  : '<span class="badge badge--neutral">Disabled</span>') + '</td>'
              + '<td data-label="Last sign-in">'
              +   UI.esc(u.lastSignIn ? UI.fmtDateTime(u.lastSignIn) : 'Never') + '</td>'
              + '<td class="actions" data-label="">'
              +   '<a class="btn btn--sm" href="' + href + '">Open</a>'
              +   (Auth.can('admin.roles')
                  ? ' <button class="btn btn--sm" type="button" data-status="' + UI.esc(u.userId) + '">'
                    + (u.active ? 'Disable' : 'Enable') + '</button>'
                  : '')
              + '</td></tr>';
          }).join('')
        + '</tbody></table></div>';

      UI.qsa('#usersHost [data-status]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          toggleStatus(users.filter(function (u) { return u.userId === btn.dataset.status; })[0]);
        });
      });
    }).catch(function (err) {
      UI.qs('#usersHost').innerHTML = UI.emptyState('Users could not be loaded', err.message, '');
    });
  }

  function field(name, label, control, hint) {
    return '<div class="field"><label class="field__label" for="f_' + name + '">' + UI.esc(label) + '</label>'
      + control
      + (hint ? '<div class="xsmall muted">' + UI.esc(hint) + '</div>' : '')
      + '<div class="field__error" role="alert"></div></div>';
  }

  function inputFor(name, value, type) {
    return '<input id="f_' + name + '" name="' + name + '" type="' + (type || 'text') + '"'
      + ' value="' + UI.esc(value || '') + '" autocomplete="off">';
  }

  function createUser(prefill) {
    if (!prefill || typeof prefill.preventDefault === 'function') { prefill = {}; }

    UI.modal({
      title: 'New user',
      wide: true,
      body: ''
        + '<div class="grid grid--2">'
        +   field('username', 'Username',
              '<input id="f_username" name="username" type="text" autocomplete="off" data-autofocus'
              + ' value="' + UI.esc(prefill.username || '') + '">',
              'Letters, digits and . _ - @ only. This cannot be changed later.')
        +   field('firstName', 'First name', inputFor('firstName', prefill.firstName))
        +   field('lastName', 'Last name', inputFor('lastName', prefill.lastName))
        +   field('email', 'Email', inputFor('email', prefill.email, 'email'))
        +   field('jobTitle', 'Job title', inputFor('jobTitle', prefill.jobTitle))
        +   field('role', 'Role', '<select id="f_role" name="role">'
              + UI.selectOptions(ROLE_LIST, 'code', 'label', prefill.role || 'FIELD') + '</select>')
        + '</div>'
        + '<div class="alert alert--info mt-4"><div class="alert__body">'
        + 'No password is set here. The new account is emailed a single-use link and chooses its '
        + 'own, so nobody else - including you - ever knows it. Give an email address, or the link '
        + 'will have to be passed on by hand.'
        + '</div></div>',
      buttons: [
        { label: 'Cancel', value: null },
        { label: 'Create account', variant: 'primary',
          onClick: function (root) {
            var payload = {
              username: root.querySelector('#f_username').value.trim(),
              firstName: root.querySelector('#f_firstName').value.trim(),
              lastName: root.querySelector('#f_lastName').value.trim(),
              email: root.querySelector('#f_email').value.trim(),
              jobTitle: root.querySelector('#f_jobTitle').value.trim(),
              role: root.querySelector('#f_role').value,
              active: true
            };
            UI.clearErrors(root);
            if (!payload.username) {
              UI.setFieldError('username', 'Enter a username.', root);
              return false;
            }
            return payload;
          } }
      ]
    }).then(function (payload) {
      if (!payload) { return; }

      return API.admin.createUser(payload).then(function (created) {
        return invite(created);
      }, function (err) {
        UI.toast('Account not created', err.message, 'danger');
        createUser(payload);
      });
    });
  }

  function invite(created) {
    return API.admin.invite(created.userId, 'INVITE').then(function (invitation) {
      loadUsers();
      showInvitation(created, invitation);
    }, function (err) {
      loadUsers();
      UI.showFormError('Account ' + created.username + ' was created, but the invitation could '
        + 'not be issued: ' + err.message + ' Open the account and send it again.');
    });
  }

  function showInvitation(user, invitation) {
    if (invitation && invitation.sent) {
      UI.modal({
        title: 'Invitation sent',
        body: '<p>' + UI.esc(user.name) + ' has been emailed a link to set their own password, at '
          + '<strong>' + UI.esc(invitation.sentTo) + '</strong>.</p>'
          + '<p class="small muted">It works once and expires on '
          + UI.esc(UI.fmtDateTime(invitation.expiresAt)) + '. Until they use it, the account '
          + 'exists but cannot sign in.</p>',
        buttons: [{ label: 'Done', value: null, variant: 'primary' }]
      });
      return;
    }

    UI.modal({
      title: 'Account created - pass this link on',
      body: '<div class="alert alert--warning"><span class="alert__icon" aria-hidden="true">!</span>'
        + '<div class="alert__body"><div class="alert__title">No email was sent</div>'
        + 'Either mail is not configured or this account has no address on file. Give '
        + UI.esc(user.name) + ' the link below yourself.</div></div>'
        + '<div class="field mt-4"><label class="field__label" for="inviteLink">Invitation link</label>'
        + '<input id="inviteLink" name="inviteLink" type="text" readonly data-autofocus value="'
        + UI.esc(invitation ? invitation.link : '') + '"></div>'
        + '<p class="small muted">Treat it like a password: anyone holding it can set this '
        + 'account\'s password once, until '
        + UI.esc(invitation ? UI.fmtDateTime(invitation.expiresAt) : '') + '.</p>',
      buttons: [{ label: 'Done', value: null, variant: 'primary' }],
      onOpen: function (root) {
        var input = root.querySelector('#inviteLink');
        if (input) { input.select(); }
      }
    });
  }

  function toggleStatus(u) {
    var disabling = u.active;
    UI.confirm({
      title: (disabling ? 'Disable' : 'Enable') + ' account',
      message: disabling
        ? 'A disabled account cannot sign in. Asset assignments and audit history are unchanged.'
        : 'The account will be able to sign in again with its existing role and password.',
      summary: [
        { label: 'User', value: u.name },
        { label: 'Username', value: u.username },
        { label: 'Role', value: u.roleName }
      ],
      warning: disabling && u.role === 'ADMIN'
        ? 'This is an administrator. The server refuses to disable the last active one.'
        : '',
      confirmLabel: disabling ? 'Disable account' : 'Enable account',
      danger: disabling
    }).then(function (ok) {
      if (!ok) { return; }
      return API.admin.setStatus(u.userId, disabling ? 'DISABLED' : 'ACTIVE').then(function () {
        UI.toast('Account updated', u.name + ' is now ' + (disabling ? 'disabled' : 'active') + '.', 'success');
        loadUsers();
      });
    }).catch(function (err) { UI.showFormError(err.message); });
  }

  function renderRoles() {
    UI.qs('#rolesHost').innerHTML = Object.keys(D.ROLES).map(function (key) {
      var r = D.ROLES[key];
      return '<div style="padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid var(--c-border)">'
        + '<div class="strong">' + UI.esc(r.name) + '</div>'
        + '<div class="small muted mb-4">' + UI.esc(r.description) + '</div>'
        + '<div>' + r.can.map(function (c) { return '<span class="pill">' + UI.esc(c) + '</span> '; }).join('') + '</div>'
        + '</div>';
    }).join('')
    + '<p class="prototype-note">The interface hides functions a role cannot use. The server repeats every '
    + 'check because hiding a button is not an authorization control.</p>';
  }

  function loadLookups() {
    API.admin.lookups().then(function (l) {
      UI.qs('#lookupHost').innerHTML = ''
        + group('Locations', l.locations.map(function (x) { return x.code + ' — ' + x.name; }))
        + group('Asset categories', l.categories.map(function (x) { return x.name; }))
        + group('Conditions', l.conditions.map(UI.titleCase))
        + group('Adjustment reasons', l.adjustmentReasons.map(function (x) { return x.label; }))
        + '<p class="prototype-note">Lookup maintenance (add, rename, retire) is an administrator function in the '
        + 'target design and is display-only in this prototype.</p>';
    });
  }

  function group(title, values) {
    return '<div class="mb-4"><div class="dl__term">' + UI.esc(title) + '</div><div>'
      + values.map(function (v) { return '<span class="pill">' + UI.esc(v) + '</span> '; }).join('')
      + '</div></div>';
  }

  function loadIntegrations() {
    API.admin.integrations().then(function (list) {
      UI.qs('#integrationHost').innerHTML = '<div class="table-wrap"><table class="data responsive"><thead><tr>'
        + '<th scope="col">System</th><th scope="col">Direction</th><th scope="col">Purpose</th>'
        + '<th scope="col">Owner</th><th scope="col">Status</th><th scope="col">Last sync</th>'
        + '</tr></thead><tbody>'
        + list.map(function (i) {
            return '<tr>'
              + '<td data-label="System"><span class="cell-strong">' + UI.esc(i.name) + '</span></td>'
              + '<td data-label="Direction">' + UI.esc(i.direction) + '</td>'
              + '<td class="wrap" data-label="Purpose">' + UI.esc(i.purpose) + '</td>'
              + '<td data-label="Owner">' + UI.esc(i.owner) + '</td>'
              + '<td data-label="Status">' + (i.status === 'CONNECTED'
                  ? '<span class="badge badge--ok">Connected</span>'
                  : '<span class="badge badge--neutral">Not configured</span>') + '</td>'
              + '<td data-label="Last sync">' + UI.esc(i.lastSync ? UI.fmtDateTime(i.lastSync) : '—') + '</td>'
              + '</tr>';
          }).join('')
        + '</tbody></table></div>'
        + '<div class="card__foot"><span class="small muted">External systems never reach the database directly. '
        + 'All exchange happens through versioned APIs behind the integration gateway.</span></div>';
    });
  }
})();
