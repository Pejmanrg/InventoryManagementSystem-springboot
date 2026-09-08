/* ==========================================================================
   pages/audit.js - Screen 13: Audit history
   --------------------------------------------------------------------------
   Maps to AuditService.searchEvents() and exportAudit() (CSC-12 Audit &
   Monitoring). Every inventory-changing action, security event, and
   integration job in this prototype writes a record that lands here,
   including the actions that were REJECTED - which is what makes the
   non-repudiation requirement in the STRIDE analysis testable.
   ========================================================================== */

(function () {
  'use strict';

  var page = UI.mountShell({ active: 'audit', title: 'Audit History' });
  if (!page) { return; }

  if (!Auth.can('audit.view')) {
    page.innerHTML = '<div class="page-head"><div class="page-head__text"><h1>Audit history</h1></div></div>'
      + UI.denied('the audit history');
    return;
  }

  var filters = { query: '', action: '', outcome: '', entityType: '', from: '', to: '' };
  var rows = [];

  var ACTIONS = [
    'AUTH_SIGN_IN', 'AUTH_SIGN_OUT', 'ASSET_CREATE', 'ASSET_UPDATE', 'ASSET_CHECKOUT',
    'ASSET_CHECKIN', 'ASSET_MOVE', 'ASSET_DISPOSE', 'ASSET_RECOVER', 'ASSET_STATUS_CHANGE',
    'INVENTORY_ADJUST', 'WORKORDER_CREATE', 'WORKORDER_UPDATE', 'WORKORDER_CLOSE',
    'PO_RECEIVE', 'ROLE_ASSIGN', 'USER_STATUS_CHANGE', 'BULK_IMPORT', 'INTEGRATION_SYNC'
  ];

  page.innerHTML = ''
    + '<div class="page-head">'
    +   '<div class="page-head__text">'
    +     '<h1>Audit history</h1>'
    +     '<div class="page-head__sub">Timestamped record of security events and inventory-changing actions.</div>'
    +   '</div>'
    +   '<div class="page-head__actions">'
    +     (Auth.can('audit.export') ? '<button class="btn" type="button" id="exportBtn">Export audit</button>' : '')
    +   '</div>'
    + '</div>'
    + '<div class="grid grid--kpi mb-4" id="tiles"></div>'
    + '<section class="card">'
    +   '<form class="toolbar" id="filterForm" role="search">'
    +     '<div class="field field--wide"><label class="field__label" for="fQuery">Search</label>'
    +       '<input type="search" id="fQuery" placeholder="Summary, action, or record ID"></div>'
    +     '<div class="field"><label class="field__label" for="fAction">Action</label>'
    +       '<select id="fAction">' + UI.selectOptions(ACTIONS, null, null, '', 'All actions') + '</select></div>'
    +     '<div class="field"><label class="field__label" for="fOutcome">Outcome</label>'
    +       '<select id="fOutcome">'
    +         '<option value="">All outcomes</option><option value="SUCCESS">Success</option>'
    +         '<option value="DENIED">Denied</option></select></div>'
    +     '<div class="field"><label class="field__label" for="fFrom">From</label>'
    +       '<input type="date" id="fFrom"></div>'
    +     '<div class="field"><label class="field__label" for="fTo">To</label>'
    +       '<input type="date" id="fTo"></div>'
    +     '<div class="field" style="flex:0 0 auto"><span class="field__label">&nbsp;</span>'
    +       '<button class="btn" type="button" id="clearBtn">Clear</button></div>'
    +     '<div class="spacer"></div>'
    +     '<div class="toolbar__count" id="resultCount" aria-live="polite"></div>'
    +   '</form>'
    +   '<div id="tableHost">' + UI.loading('Loading audit records…') + '</div>'
    +   '<div class="card__foot">'
    +     '<span class="small muted">Audit records are append-only. They cannot be edited or deleted from the '
    +     'user interface, which is what makes them usable as evidence in a dispute.</span>'
    +   '</div>'
    + '</section>';

  function load() {
    Promise.all([API.audit.search(filters), API.audit.search({})]).then(function (r) {
      rows = r[0];
      renderTiles(r[1]);
      renderTable();
    }).catch(function (err) {
      UI.qs('#tableHost').innerHTML = '<div class="card__body"><div class="alert alert--danger">'
        + '<div class="alert__body">' + UI.esc(err.message) + '</div></div></div>';
    });
  }

  function renderTiles(all) {
    var denied = all.filter(function (e) { return e.outcome === 'DENIED'; }).length;
    var today = new Date().toISOString().slice(0, 10);
    var todayCount = all.filter(function (e) { return e.timestamp.slice(0, 10) === today; }).length;
    var inventoryChanges = all.filter(function (e) {
      return ['ASSET_CHECKOUT', 'ASSET_CHECKIN', 'ASSET_MOVE', 'ASSET_DISPOSE',
              'ASSET_RECOVER', 'INVENTORY_ADJUST'].indexOf(e.action) !== -1;
    }).length;

    UI.qs('#tiles').innerHTML = [
      tile('Total events', UI.fmtNumber(all.length), 'Retained for the audit period', 'accent'),
      tile('Inventory changes', UI.fmtNumber(inventoryChanges), 'Check-outs, returns, moves, adjustments', ''),
      tile('Denied actions', UI.fmtNumber(denied), 'Rejected by authorization or state rules',
           denied ? 'warn' : 'ok'),
      tile('Recorded today', UI.fmtNumber(todayCount), 'Since midnight local time', '')
    ].join('');
  }

  function tile(label, value, meta, variant) {
    return '<div class="card kpi' + (variant ? ' kpi--' + variant : '') + '">'
      + '<div class="kpi__label">' + UI.esc(label) + '</div>'
      + '<div class="kpi__value">' + UI.esc(value) + '</div>'
      + '<div class="kpi__meta">' + UI.esc(meta) + '</div></div>';
  }

  function renderTable() {
    UI.qs('#resultCount').textContent = rows.length + (rows.length === 1 ? ' event' : ' events');

    if (!rows.length) {
      UI.qs('#tableHost').innerHTML = UI.emptyState('No audit records match',
        'Widen the date range or clear the filters.',
        '<button class="btn" type="button" id="emptyClear">Clear filters</button>');
      UI.qs('#emptyClear').addEventListener('click', clearFilters);
      return;
    }

    UI.qs('#tableHost').innerHTML = '<div class="table-wrap"><table class="data responsive"><thead><tr>'
      + '<th scope="col">Timestamp</th><th scope="col">Actor</th><th scope="col">Action</th>'
      + '<th scope="col">Record</th><th scope="col">Summary</th><th scope="col">Outcome</th>'
      + '<th scope="col">Source IP</th>'
      + '</tr></thead><tbody>'
      + rows.map(function (e) {
          return '<tr>'
            + '<td data-label="Timestamp">' + UI.esc(UI.fmtDateTime(e.timestamp))
            +   '<div class="cell-sub">' + UI.esc(UI.fmtRelative(e.timestamp)) + '</div></td>'
            + '<td data-label="Actor">' + UI.esc(e.actorName) + '</td>'
            + '<td data-label="Action"><span class="pill">' + UI.esc(e.action) + '</span></td>'
            + '<td data-label="Record">' + linkForEntity(e) + '</td>'
            + '<td class="wrap" data-label="Summary">' + UI.esc(e.summary) + '</td>'
            + '<td data-label="Outcome">' + (e.outcome === 'SUCCESS'
                ? '<span class="badge badge--ok">Success</span>'
                : '<span class="badge badge--critical">Denied</span>') + '</td>'
            + '<td data-label="Source IP"><span class="mono xsmall">' + UI.esc(e.ip) + '</span></td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  function linkForEntity(e) {
    if (e.entityType === 'ASSET') {
      return '<a class="row-link" href="asset-detail.html?id=' + UI.esc(e.entityId) + '">'
        + UI.esc(e.entityId) + '</a>';
    }
    if (e.entityType === 'INVENTORY' && Auth.can('inventory.view')) {
      return '<a class="row-link" href="inventory.html">' + UI.esc(e.entityId) + '</a>';
    }
    return '<span class="mono xsmall">' + UI.esc(e.entityType) + ' · ' + UI.esc(e.entityId) + '</span>';
  }

  /* ------------------------------------------------------------- filters */

  function syncFromForm() {
    filters.query = UI.qs('#fQuery').value;
    filters.action = UI.qs('#fAction').value;
    filters.outcome = UI.qs('#fOutcome').value;
    filters.from = UI.qs('#fFrom').value;
    filters.to = UI.qs('#fTo').value;
    load();
  }

  function clearFilters() {
    ['#fQuery', '#fAction', '#fOutcome', '#fFrom', '#fTo'].forEach(function (s) { UI.qs(s).value = ''; });
    syncFromForm();
  }

  var debounce;
  UI.qs('#fQuery').addEventListener('input', function () {
    clearTimeout(debounce);
    debounce = setTimeout(syncFromForm, 220);
  });
  ['#fAction', '#fOutcome', '#fFrom', '#fTo'].forEach(function (s) {
    UI.qs(s).addEventListener('change', syncFromForm);
  });
  UI.qs('#clearBtn').addEventListener('click', clearFilters);
  UI.qs('#filterForm').addEventListener('submit', function (e) { e.preventDefault(); syncFromForm(); });

  var exportBtn = UI.qs('#exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      UI.confirm({
        title: 'Export audit history',
        message: 'Audit exports contain user names, IP addresses, and record identifiers.',
        summary: [
          { label: 'Rows in export', value: String(rows.length) },
          { label: 'Action filter', value: filters.action || 'All actions' },
          { label: 'Format', value: 'CSV' }
        ],
        warning: 'The export itself is recorded as an audit event.',
        confirmLabel: 'Export CSV'
      }).then(function (ok) {
        if (!ok) { return; }
        return API.audit.exportCsv(rows).then(function (csv) {
          UI.toast('Export prepared', rows.length + ' rows, ' + csv.split('\n').length
            + ' lines. File delivery is mocked in this prototype.', 'success');
        });
      });
    });
  }

  load();
})();
