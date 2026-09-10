
(function (global) {
  'use strict';

  var doc = global.document;

  var Auth = {
    user: function () { return global.Store.getSession(); },

    role: function () {
      var u = Auth.user();
      return u ? global.MockData.ROLES[u.role] : null;
    },

    can: function (capability) {
      var r = Auth.role();
      return !!(r && r.can.indexOf(capability) !== -1);
    },

    require: function () {
      var u = Auth.user();
      if (!u) {
        global.location.replace('index.html');
        return null;
      }
      return u;
    },

    signOut: function () {
      global.API.auth.signOut().then(function () {
        global.location.href = 'index.html';
      });
    }
  };

  var NAV = [
    {
      label: 'Operations',
      items: [
        { id: 'dashboard', href: 'dashboard.html',        icon: '▦', text: 'Dashboard',        cap: 'dashboard.view' },
        { id: 'assets',    href: 'assets.html',           icon: '▣', text: 'Assets',           cap: 'asset.view' },
        { id: 'checkout',  href: 'checkout.html',         icon: '→',  text: 'Check Out',        cap: 'asset.checkout' },
        { id: 'checkin',   href: 'checkin.html',          icon: '←',  text: 'Check In',         cap: 'asset.checkin' },
        { id: 'inventory', href: 'inventory.html',        icon: '≡',  text: 'Inventory',        cap: 'inventory.view' },
        { id: 'adjust',    href: 'inventory-adjust.html', icon: '±',  text: 'Adjust Quantity',  cap: 'inventory.adjust' }
      ]
    },
    {
      label: 'Service & Analysis',
      items: [
        { id: 'maintenance', href: 'maintenance.html', icon: '⚙', text: 'Maintenance', cap: 'maintenance.view' },
        { id: 'reports',     href: 'reports.html',     icon: '◠', text: 'Reports',     cap: 'report.view.basic' }
      ]
    },
    {
      label: 'Administration',
      items: [
        { id: 'admin', href: 'admin.html', icon: '⛭', text: 'Users & Roles', cap: 'admin.view' },
        { id: 'audit', href: 'audit.html', icon: '☷', text: 'Audit History', cap: 'audit.view' }
      ]
    }
  ];

  function esc(value) {
    if (value === null || value === undefined) { return ''; }
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function qs(sel, root) { return (root || doc).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  function param(name) {
    return new URLSearchParams(global.location.search).get(name);
  }

  function initials(name) {
    return String(name || '?').split(/\s+/).slice(0, 2)
      .map(function (p) { return p.charAt(0).toUpperCase(); }).join('');
  }

  function titleCase(value) {
    return String(value || '').replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  /* ---------------------------------------------------------- formatters */

  function fmtDate(value) {
    if (!value) { return '—'; }
    var d = new Date(String(value).length <= 10 ? value + 'T00:00:00' : value);
    if (isNaN(d)) { return esc(value); }
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  }

  function fmtDateTime(value) {
    if (!value) { return '—'; }
    var d = new Date(value);
    if (isNaN(d)) { return esc(value); }
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function fmtRelative(value) {
    if (!value) { return '—'; }
    var then = new Date(value).getTime();
    if (isNaN(then)) { return esc(value); }
    var mins = Math.round((Date.now() - then) / 60000);
    if (mins < 1) { return 'just now'; }
    if (mins < 60) { return mins + ' min ago'; }
    var hrs = Math.round(mins / 60);
    if (hrs < 24) { return hrs + (hrs === 1 ? ' hour ago' : ' hours ago'); }
    var days = Math.round(hrs / 24);
    if (days < 30) { return days + (days === 1 ? ' day ago' : ' days ago'); }
    return fmtDate(value);
  }

  function fmtNumber(value) {
    if (value === null || value === undefined || value === '') { return '—'; }
    return Number(value).toLocaleString('en-US');
  }

  function fmtMoney(value) {
    if (value === null || value === undefined || value === '') { return '—'; }
    return Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  }

  function fmtMoneyShort(value) {
    var n = Number(value || 0);
    if (n >= 1000000) { return '$' + (n / 1000000).toFixed(1) + 'M'; }
    if (n >= 1000) { return '$' + (n / 1000).toFixed(1) + 'K'; }
    return fmtMoney(n);
  }

  /* -------------------------------------------------------------- badges */

  function badge(value, extraClass) {
    if (!value) { return ''; }
    var cls = 'badge badge--' + String(value).toLowerCase() + (extraClass ? ' ' + extraClass : '');
    return '<span class="' + cls + '">' + esc(titleCase(value)) + '</span>';
  }

  function stockBadge(state) {
    var map = { OK: 'In stock', LOW: 'Low stock', CRITICAL: 'Out of stock' };
    return '<span class="badge badge--' + String(state).toLowerCase() + '">' + esc(map[state] || state) + '</span>';
  }

  function priority(value) {
    return '<span class="prio prio--' + String(value).toLowerCase() + '">' + esc(titleCase(value)) + '</span>';
  }

  /* ================================================================ SHELL */

  function buildSidebar(activeId) {
    var user = Auth.user();
    var groups = NAV.map(function (group) {
      var items = group.items.filter(function (i) { return Auth.can(i.cap); });
      if (!items.length) { return ''; }
      return '<div class="nav-group">'
        + '<div class="nav-group__label">' + esc(group.label) + '</div>'
        + items.map(function (i) {
            return '<a class="nav-item" href="' + i.href + '"'
              + (i.id === activeId ? ' aria-current="page"' : '') + '>'
              + '<span class="nav-item__icon" aria-hidden="true">' + i.icon + '</span>'
              + '<span>' + esc(i.text) + '</span></a>';
          }).join('')
        + '</div>';
    }).join('');

    return ''
      + '<div class="sidebar__brand">'
      +   '<div class="sidebar__logo" aria-hidden="true">CI</div>'
      +   '<div><div class="sidebar__title">Cloud Inventory</div>'
      +   '<div class="sidebar__subtitle">Asset &amp; Stock Management</div></div>'
      + '</div>'
      + '<nav class="sidebar__nav" aria-label="Main">' + groups + '</nav>'
      + '<div class="sidebar__footer">'
      +   'Signed in as<br><strong style="color:#fff">' + esc(user ? user.name : '') + '</strong><br>'
      +   esc(Auth.role() ? Auth.role().name : '')
      + '</div>';
  }

  function buildTopbar(title) {
    var user = Auth.user();
    return ''
      + '<button class="nav-toggle" type="button" id="navToggle" aria-label="Open navigation menu" aria-expanded="false">≡</button>'
      + '<div class="topbar__title">' + esc(title) + '</div>'
      + '<div class="topbar__spacer"></div>'
      + '<div class="topbar__search">'
      +   '<label class="visually-hidden" for="globalSearch">Search assets by tag or name</label>'
      +   '<input type="search" id="globalSearch" placeholder="Search tag, name, or serial…" autocomplete="off">'
      + '</div>'
      + '<button class="btn btn--sm" type="button" id="scanBtn" title="Scan a barcode or QR label">'
      +   '<span aria-hidden="true">⌗</span> Scan</button>'
      + '<button class="user-chip" type="button" id="userChip" aria-haspopup="dialog">'
      +   '<span class="avatar" aria-hidden="true">' + esc(initials(user && user.name)) + '</span>'
      +   '<span class="user-chip__meta"><span class="user-chip__name">' + esc(user ? user.name : '') + '</span>'
      +   '<span class="user-chip__role">' + esc(Auth.role() ? Auth.role().short : '') + '</span></span>'
      + '</button>';
  }

  /**
   * Renders the application chrome and returns the #page element the caller
   * should render into.
   * @param {{active:string, title:string}} options
   */
  function mountShell(options) {
    var user = Auth.require();
    if (!user) { return null; }

    doc.body.innerHTML = ''
      + '<a class="skip-link" href="#page">Skip to main content</a>'
      + '<div class="app">'
      +   '<aside class="sidebar" id="sidebar">' + buildSidebar(options.active) + '</aside>'
      +   '<div class="scrim" id="scrim"></div>'
      +   '<header class="topbar">' + buildTopbar(options.title) + '</header>'
      +   '<main class="main"><div class="page" id="page"></div></main>'
      + '</div>'
      + '<div class="toast-region" id="toastRegion" role="status" aria-live="polite"></div>'
      + '<div class="modal-backdrop" id="modalRoot"></div>';

    doc.title = options.title + ' · Cloud Inventory Management System';

    /* Mobile navigation */
    var sidebar = qs('#sidebar');
    var scrim = qs('#scrim');
    var toggle = qs('#navToggle');
    function closeNav() {
      sidebar.classList.remove('is-open');
      scrim.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
    toggle.addEventListener('click', function () {
      var open = sidebar.classList.toggle('is-open');
      scrim.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    scrim.addEventListener('click', closeNav);

    /* Global search jumps to the assets list with the query applied */
    var search = qs('#globalSearch');
    if (search) {
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && search.value.trim()) {
          global.location.href = 'assets.html?query=' + encodeURIComponent(search.value.trim());
        }
      });
    }

    qs('#scanBtn').addEventListener('click', openScanDialog);
    qs('#userChip').addEventListener('click', openAccountDialog);

    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeNav();
        closeModal();
      }
    });

    return qs('#page');
  }

  /* ================================================================ TOAST */

  function toast(title, message, variant) {
    var region = qs('#toastRegion');
    if (!region) { return; }
    var el = doc.createElement('div');
    el.className = 'toast' + (variant ? ' toast--' + variant : '');
    el.innerHTML = '<div><div class="toast__title">' + esc(title) + '</div>'
      + (message ? '<div class="toast__msg">' + esc(message) + '</div>' : '') + '</div>'
      + '<button class="toast__close" type="button" aria-label="Dismiss">×</button>';
    el.querySelector('.toast__close').addEventListener('click', function () { el.remove(); });
    region.appendChild(el);
    global.setTimeout(function () { el.remove(); }, 5200);
  }

  /* ================================================================ MODAL */

  var lastFocused = null;

  function closeModal() {
    var root = qs('#modalRoot');
    if (!root) { return; }
    root.classList.remove('is-open');
    root.innerHTML = '';
    if (lastFocused && lastFocused.focus) { lastFocused.focus(); }
    lastFocused = null;
  }

  /**
   * Generic modal. `options.body` is an HTML string; `options.buttons` is an
   * array of { label, variant, value, autofocus }.
   * Resolves with the clicked button's value, or null when dismissed.
   */
  function modal(options) {
    return new Promise(function (resolve) {
      var root = qs('#modalRoot');
      lastFocused = doc.activeElement;

      var buttons = (options.buttons || [{ label: 'Close', value: null }]).map(function (b, idx) {
        return '<button type="button" class="btn ' + (b.variant ? 'btn--' + b.variant : '')
          + '" data-idx="' + idx + '">' + esc(b.label) + '</button>';
      }).join('');

      root.innerHTML = '<div class="modal ' + (options.wide ? 'modal--wide' : '') + '" role="dialog"'
        + ' aria-modal="true" aria-labelledby="modalTitle">'
        + '<div class="modal__head"><h2 id="modalTitle">' + esc(options.title) + '</h2>'
        + '<button class="modal__close" type="button" aria-label="Close dialog">×</button></div>'
        + '<div class="modal__body">' + (options.body || '') + '</div>'
        + '<div class="modal__foot">' + buttons + '</div>'
        + '</div>';
      root.classList.add('is-open');

      function finish(value) { closeModal(); resolve(value); }

      root.querySelector('.modal__close').addEventListener('click', function () { finish(null); });
      root.addEventListener('click', function (e) { if (e.target === root) { finish(null); } });
      qsa('.modal__foot .btn', root).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var def = (options.buttons || [])[Number(btn.dataset.idx)];
          if (def && typeof def.onClick === 'function') {
            var result = def.onClick(root);
            if (result === false) { return; }   // validation failed - keep open
            finish(result === undefined ? def.value : result);
            return;
          }
          finish(def ? def.value : null);
        });
      });

      if (typeof options.onOpen === 'function') { options.onOpen(root); }

      var focusTarget = root.querySelector('[data-autofocus]')
        || root.querySelector('.modal__foot .btn--primary')
        || root.querySelector('.modal__foot .btn--danger')
        || root.querySelector('.modal__close');
      if (focusTarget) { focusTarget.focus(); }
    });
  }

  /**
   * Confirmation dialog used before every inventory-changing action
   * (SDD 2.1.2: "confirmation for destructive actions").
   * @returns {Promise<boolean>}
   */
  function confirm(options) {
    var summary = '';
    if (options.summary && options.summary.length) {
      summary = '<dl class="confirm-summary">' + options.summary.map(function (row) {
        return '<div class="confirm-summary__row"><dt>' + esc(row.label) + '</dt>'
             + '<dd>' + (row.html || esc(row.value)) + '</dd></div>';
      }).join('') + '</dl>';
    }
    return modal({
      title: options.title,
      body: '<p>' + esc(options.message) + '</p>' + summary
            + (options.warning ? '<div class="alert alert--warning mt-4"><span class="alert__icon">!</span>'
               + '<div class="alert__body">' + esc(options.warning) + '</div></div>' : ''),
      buttons: [
        { label: options.cancelLabel || 'Cancel', value: false },
        { label: options.confirmLabel || 'Confirm', value: true, variant: options.danger ? 'danger' : 'primary' }
      ]
    }).then(function (v) { return v === true; });
  }

  /* Barcode / QR lookup - CSC-07 Mobility. In production this opens the device
     camera; the prototype accepts a typed tag. */
  function openScanDialog() {
    modal({
      title: 'Scan asset label',
      body: '<div class="alert alert--info"><span class="alert__icon" aria-hidden="true">i</span>'
        + '<div class="alert__body">Camera scanning is part of the mobility component and is not '
        + 'active in this prototype. Enter an asset tag to simulate a scan.</div></div>'
        + '<div class="field mt-4"><label class="field__label" for="scanTag">Asset tag</label>'
        + '<input type="text" id="scanTag" placeholder="IT-10042" data-autofocus autocomplete="off">'
        + '<span class="field__hint">Try IT-10042, VEH-204, or TOOL-3312.</span></div>',
      buttons: [
        { label: 'Cancel', value: null },
        {
          label: 'Look up asset', variant: 'primary',
          onClick: function (root) {
            var value = root.querySelector('#scanTag').value.trim();
            if (!value) { return false; }
            return value;
          }
        }
      ]
    }).then(function (tag) {
      if (!tag) { return; }
      return global.API.assets.getByTag(tag).then(function (asset) {
        global.location.href = 'asset-detail.html?id=' + encodeURIComponent(asset.assetId);
      }).catch(function (err) {
        toast('Asset not found', err.message, 'danger');
      });
    });
  }

  function openAccountDialog() {
    var user = Auth.user();
    var role = Auth.role();
    modal({
      title: 'Account',
      body: '<div class="dl">'
        + '<div class="dl__item"><div class="dl__term">Name</div><div class="dl__val">' + esc(user.name) + '</div></div>'
        + '<div class="dl__item"><div class="dl__term">Email</div><div class="dl__val">' + esc(user.email) + '</div></div>'
        + '<div class="dl__item"><div class="dl__term">Role</div><div class="dl__val">' + esc(role.name) + '</div></div>'
        + '<div class="dl__item"><div class="dl__term">Primary site</div><div class="dl__val">' + esc(user.site) + '</div></div>'
        + '</div>'
        + '<p class="prototype-note">Prototype session. Production sign-in is delegated to Microsoft '
        + 'Entra ID (OpenID Connect) and role claims are issued by the identity provider.</p>',
      buttons: [
        { label: 'Reset demo data', value: 'reset' },
        { label: 'Sign out', value: 'signout', variant: 'danger' }
      ]
    }).then(function (action) {
      if (action === 'signout') { Auth.signOut(); }
      if (action === 'reset') {
        global.Store.reset();
        toast('Demo data reset', 'All sample records were restored to their original values.', 'success');
        global.setTimeout(function () { global.location.reload(); }, 700);
      }
    });
  }

  /* =========================================================== VALIDATION */

  function clearErrors(scope) {
    qsa('.field.has-error', scope).forEach(function (f) { f.classList.remove('has-error'); });
    var banner = qs('#formBanner', scope);
    if (banner) { banner.innerHTML = ''; }
  }

  function setFieldError(fieldName, message, scope) {
    var input = qs('[name="' + fieldName + '"]', scope);
    var field = input ? input.closest('.field') : null;
    if (!field) { return false; }
    field.classList.add('has-error');
    var err = qs('.field__error', field);
    if (err) { err.textContent = message; }
    if (input && input.focus) { input.focus(); }
    return true;
  }

  function showFormError(message, scope) {
    var banner = qs('#formBanner', scope);
    if (!banner) { toast('Action failed', message, 'danger'); return; }
    banner.innerHTML = '<div class="alert alert--danger"><span class="alert__icon" aria-hidden="true">!</span>'
      + '<div class="alert__body"><div class="alert__title">The request was not completed</div>'
      + esc(message) + '</div></div>';
    banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /** Routes an ApiError to the field it belongs to, or to the form banner. */
  function handleApiError(err, scope) {
    var message = err && err.message ? err.message : 'Unexpected error.';
    if (err && err.field && setFieldError(err.field, message, scope)) { return; }
    showFormError(message, scope);
  }

  /* ============================================================ RENDERING */

  function emptyState(title, message, actionHtml) {
    return '<div class="empty"><div class="empty__icon" aria-hidden="true">○</div>'
      + '<div class="empty__title">' + esc(title) + '</div>'
      + '<div class="small">' + esc(message) + '</div>'
      + (actionHtml ? '<div class="mt-4">' + actionHtml + '</div>' : '') + '</div>';
  }

  function loading(message) {
    return '<div class="empty"><div class="small">' + esc(message || 'Loading…') + '</div></div>';
  }

  function selectOptions(items, valueKey, labelKey, selected, placeholder) {
    var opts = placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '';
    return opts + items.map(function (i) {
      var v = typeof i === 'string' ? i : i[valueKey];
      var l = typeof i === 'string' ? titleCase(i) : i[labelKey];
      return '<option value="' + esc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>'
        + esc(l) + '</option>';
    }).join('');
  }

  function bar(label, value, max, variant) {
    var pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return '<div class="bar"><div class="bar__top"><span class="bar__label">' + esc(label) + '</span>'
      + '<span class="bar__value">' + esc(fmtNumber(value)) + '</span></div>'
      + '<div class="bar__track"><div class="bar__fill' + (variant ? ' bar__fill--' + variant : '')
      + '" style="width:' + pct + '%"></div></div></div>';
  }

  /** Renders the standard "you do not have access" panel. */
  function denied(page) {
    return '<div class="card"><div class="card__body">'
      + '<div class="alert alert--warning"><span class="alert__icon" aria-hidden="true">!</span>'
      + '<div class="alert__body"><div class="alert__title">Access restricted</div>'
      + 'Your role does not include permission to use ' + esc(page) + '. '
      + 'Contact a system administrator if you need this access.</div></div>'
      + '</div></div>';
  }

  /* ------------------------------------------------------------- exports */

  global.Auth = Auth;
  global.UI = {
    esc: esc, qs: qs, qsa: qsa, param: param, initials: initials, titleCase: titleCase,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime, fmtRelative: fmtRelative,
    fmtNumber: fmtNumber, fmtMoney: fmtMoney, fmtMoneyShort: fmtMoneyShort,
    badge: badge, stockBadge: stockBadge, priority: priority,
    mountShell: mountShell, toast: toast, modal: modal, confirm: confirm, closeModal: closeModal,
    clearErrors: clearErrors, setFieldError: setFieldError, showFormError: showFormError,
    handleApiError: handleApiError,
    emptyState: emptyState, loading: loading, selectOptions: selectOptions, bar: bar, denied: denied,
    NAV: NAV
  };
})(window);
