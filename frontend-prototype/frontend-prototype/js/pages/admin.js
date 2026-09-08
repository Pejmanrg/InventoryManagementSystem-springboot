/* ==========================================================================
   pages/admin.js - Screen 12: Administration (users, roles, lookups,
                    integrations)
   --------------------------------------------------------------------------
   Maps to UserRoleService.assignRole() / removeRole() (CSC-06) and the
   External Integration Gateway settings (CSC-13). Role changes are
   confirmed, then written to the audit history.
   ========================================================================== */

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
    +     '<div class="spacer"></div><span class="pill" id="userCount"></span></div>'
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

  renderRoles();
  loadUsers();
  loadLookups();
  loadIntegrations();

  /* --------------------------------------------------------------- users */

  function loadUsers() {
    API.admin.users().then(function (users) {
      UI.qs('#userCount').textContent = users.length + ' accounts';
      UI.qs('#usersHost').innerHTML = '<div class="table-wrap"><table class="data responsive"><thead><tr>'
        + '<th scope="col">User</th><th scope="col">Email</th><th scope="col">Role</th>'
        + '<th scope="col">Primary site</th><th scope="col">Status</th><th scope="col">Last sign-in</th>'
        + '<th scope="col"><span class="visually-hidden">Actions</span></th>'
        + '</tr></thead><tbody>'
        + users.map(function (u) {
            return '<tr>'
              + '<td data-label="User"><span class="cell-strong">' + UI.esc(u.name) + '</span>'
              +   '<div class="cell-sub mono">' + UI.esc(u.userId) + '</div></td>'
              + '<td data-label="Email">' + UI.esc(u.email) + '</td>'
              + '<td data-label="Role">' + UI.esc(u.roleName) + '</td>'
              + '<td data-label="Primary site">' + UI.esc(u.site) + '</td>'
              + '<td data-label="Status">' + (u.status === 'ACTIVE'
                  ? '<span class="badge badge--ok">Active</span>'
                  : '<span class="badge badge--neutral">Disabled</span>') + '</td>'
              + '<td data-label="Last sign-in">' + UI.esc(UI.fmtDateTime(u.lastSignIn)) + '</td>'
              + '<td class="actions" data-label="">'
              +   (Auth.can('admin.roles')
                  ? '<button class="btn btn--sm" type="button" data-role="' + UI.esc(u.userId) + '">Change role</button> '
                    + '<button class="btn btn--sm" type="button" data-status="' + UI.esc(u.userId) + '">'
                    + (u.status === 'ACTIVE' ? 'Disable' : 'Enable') + '</button>'
                  : '<span class="subtle xsmall">View only</span>')
              + '</td></tr>';
          }).join('')
        + '</tbody></table></div>';

      UI.qsa('#usersHost [data-role]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          changeRole(users.filter(function (u) { return u.userId === btn.dataset.role; })[0]);
        });
      });
      UI.qsa('#usersHost [data-status]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          toggleStatus(users.filter(function (u) { return u.userId === btn.dataset.status; })[0]);
        });
      });
    });
  }

  function changeRole(u) {
    UI.modal({
      title: 'Change role for ' + u.name,
      body: '<p class="small muted">Roles are issued as claims by the identity provider in production. '
        + 'This screen represents the application-side role mapping.</p>'
        + '<div class="field mt-4"><label class="field__label" for="newRole">Role</label>'
        + '<select id="newRole" data-autofocus>' + UI.selectOptions(ROLE_LIST, 'code', 'label', u.role) + '</select></div>'
        + '<div id="roleDesc" class="alert alert--info mt-4"><div class="alert__body"></div></div>',
      buttons: [
        { label: 'Cancel', value: null },
        { label: 'Assign role', variant: 'primary',
          onClick: function (root) { return root.querySelector('#newRole').value; } }
      ],
      onOpen: function (root) {
        var sel = root.querySelector('#newRole');
        function describe() {
          var r = D.ROLES[sel.value];
          root.querySelector('#roleDesc .alert__body').innerHTML =
            '<div class="alert__title">' + UI.esc(r.name) + '</div>' + UI.esc(r.description)
            + '<div class="xsmall mt-4">' + r.can.length + ' capabilities granted.</div>';
        }
        sel.addEventListener('change', describe);
        describe();
      }
    }).then(function (role) {
      if (!role || role === u.role) { return; }
      return UI.confirm({
        title: 'Confirm role change',
        message: 'Changing a role immediately changes what this user can see and do.',
        summary: [
          { label: 'User', value: u.name },
          { label: 'Current role', value: D.ROLES[u.role].name },
          { label: 'New role', value: D.ROLES[role].name }
        ],
        warning: role === 'ADMIN' ? 'System Administrator includes audit export and integration settings.' : '',
        confirmLabel: 'Assign role'
      }).then(function (ok) {
        if (!ok) { return; }
        return API.admin.assignRole(u.userId, role).then(function () {
          UI.toast('Role updated', u.name + ' is now ' + D.ROLES[role].name + '.', 'success');
          loadUsers();
        });
      });
    }).catch(function (err) { UI.toast('Role change failed', err.message, 'danger'); });
  }

  function toggleStatus(u) {
    var next = u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    UI.confirm({
      title: (next === 'DISABLED' ? 'Disable' : 'Enable') + ' account',
      message: next === 'DISABLED'
        ? 'A disabled account cannot sign in. Existing asset assignments are not changed.'
        : 'The user will be able to sign in again with their existing role.',
      summary: [{ label: 'User', value: u.name }, { label: 'New status', value: next }],
      confirmLabel: next === 'DISABLED' ? 'Disable account' : 'Enable account',
      danger: next === 'DISABLED'
    }).then(function (ok) {
      if (!ok) { return; }
      return API.admin.setStatus(u.userId, next).then(function () {
        UI.toast('Account updated', u.name + ' is now ' + next.toLowerCase() + '.', 'success');
        loadUsers();
      });
    }).catch(function (err) { UI.toast('Update failed', err.message, 'danger'); });
  }

  /* -------------------------------------------------- role capabilities */

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

  /* ------------------------------------------------------------ lookups */

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

  /* ------------------------------------------------------- integrations */

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
