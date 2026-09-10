
(function () {
  'use strict';

  var page = UI.mountShell({ active: 'reports', title: 'Reports' });
  if (!page) { return; }

  var REPORTS = [
    { id: 'site',        label: 'Assets by site',     method: 'assetsBySite',    cap: 'report.view.basic' },
    { id: 'employee',    label: 'Assets by employee', method: 'assetsByEmployee', cap: 'report.view.all' },
    { id: 'lowstock',    label: 'Low stock',          method: 'lowStock',        cap: 'report.view.basic' },
    { id: 'maintenance', label: 'Maintenance due',    method: 'maintenanceDue',  cap: 'report.view.basic' }
  ].filter(function (r) { return Auth.can(r.cap); });

  var active = REPORTS[0];
  var currentRows = [];

  page.innerHTML = ''
    + '<div class="page-head">'
    +   '<div class="page-head__text">'
    +     '<h1>Reports</h1>'
    +     '<div class="page-head__sub">Operational views over the same records used by the transaction screens.</div>'
    +   '</div>'
    +   '<div class="page-head__actions">'
    +     (Auth.can('report.export') ? '<button class="btn" type="button" id="exportBtn">Export current report</button>' : '')
    +   '</div>'
    + '</div>'
    + '<div class="grid grid--kpi mb-4" id="tiles">' + UI.loading('Loading…') + '</div>'
    + '<section class="card">'
    +   '<div class="card__head" id="tabs" role="tablist"></div>'
    +   '<div id="reportHost">' + UI.loading('Loading report…') + '</div>'
    + '</section>';

  API.reports.summary().then(function (s) {
    UI.qs('#tiles').innerHTML = [
      tile('Assets tracked', UI.fmtNumber(s.assetTotal), s.checkedOut + ' assigned right now', 'accent'),
      tile('Utilisation', s.assetTotal ? Math.round((s.checkedOut / s.assetTotal) * 100) + '%' : '—',
           'Checked out ÷ total assets', ''),
      tile('Items below reorder', UI.fmtNumber(s.lowStock + s.outOfStock), 'Across all locations',
           (s.lowStock + s.outOfStock) ? 'warn' : 'ok'),
      tile('Open work orders', UI.fmtNumber(s.openWorkOrders), s.overdueWorkOrders + ' overdue',
           s.overdueWorkOrders ? 'danger' : 'ok')
    ].join('');
  });

  function tile(label, value, meta, variant) {
    return '<div class="card kpi' + (variant ? ' kpi--' + variant : '') + '">'
      + '<div class="kpi__label">' + UI.esc(label) + '</div>'
      + '<div class="kpi__value">' + UI.esc(value) + '</div>'
      + '<div class="kpi__meta">' + UI.esc(meta) + '</div></div>';
  }

  function renderTabs() {
    UI.qs('#tabs').innerHTML = REPORTS.map(function (r) {
      return '<button type="button" role="tab" class="btn btn--sm' + (r.id === active.id ? ' btn--primary' : '')
        + '" data-report="' + r.id + '" aria-selected="' + (r.id === active.id) + '">' + UI.esc(r.label) + '</button>';
    }).join('');

    UI.qsa('#tabs [data-report]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        active = REPORTS.filter(function (r) { return r.id === btn.dataset.report; })[0];
        renderTabs();
        loadReport();
      });
    });
  }

  function loadReport() {
    UI.qs('#reportHost').innerHTML = UI.loading('Running ' + active.label.toLowerCase() + '…');
    API.reports[active.method]().then(function (rows) {
      currentRows = rows;
      var render = { site: renderSite, employee: renderEmployee, lowstock: renderLowStock, maintenance: renderMaintenance };
      UI.qs('#reportHost').innerHTML = render[active.id](rows);
    }).catch(function (err) {
      UI.qs('#reportHost').innerHTML = '<div class="card__body"><div class="alert alert--danger">'
        + '<div class="alert__body">' + UI.esc(err.message) + '</div></div></div>';
    });
  }

  function renderSite(rows) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.total; }).concat([1]));
    return '<div class="card__body">'
      + '<div class="bars">' + rows.map(function (r) {
          return UI.bar(r.locationName + '  (' + r.available + ' available)', r.total, max, 'info');
        }).join('') + '</div></div>'
      + '<div class="table-wrap"><table class="data responsive"><thead><tr>'
      + '<th scope="col">Location</th><th scope="col">Type</th><th class="num" scope="col">Total</th>'
      + '<th class="num" scope="col">Available</th><th class="num" scope="col">Checked out</th>'
      + '<th class="num" scope="col">Maintenance</th><th class="num" scope="col">Lost / retired</th>'
      + '</tr></thead><tbody>'
      + rows.map(function (r) {
          return '<tr>'
            + '<td data-label="Location"><a class="row-link" href="assets.html?locationId=' + UI.esc(r.locationId) + '">'
              + UI.esc(r.locationName) + '</a></td>'
            + '<td data-label="Type">' + UI.esc(UI.titleCase(r.type)) + '</td>'
            + '<td class="num" data-label="Total"><span class="cell-strong">' + r.total + '</span></td>'
            + '<td class="num" data-label="Available">' + r.available + '</td>'
            + '<td class="num" data-label="Checked out">' + r.checkedOut + '</td>'
            + '<td class="num" data-label="Maintenance">' + r.maintenance + '</td>'
            + '<td class="num" data-label="Lost / retired">' + r.other + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  function renderEmployee(rows) {
    if (!rows.length) { return UI.emptyState('Nothing assigned', 'No employee currently holds a tagged asset.'); }
    var showValue = Auth.can('report.view.all');
    return '<div class="table-wrap"><table class="data responsive"><thead><tr>'
      + '<th scope="col">Employee</th><th scope="col">Title</th><th scope="col">Site</th>'
      + '<th class="num" scope="col">Assets held</th><th scope="col">Tags</th>'
      + (showValue ? '<th class="num" scope="col">Acquisition value</th>' : '')
      + '</tr></thead><tbody>'
      + rows.map(function (r) {
          return '<tr>'
            + '<td data-label="Employee"><span class="cell-strong">' + UI.esc(r.name) + '</span></td>'
            + '<td data-label="Title">' + UI.esc(r.title) + '</td>'
            + '<td data-label="Site">' + UI.esc(r.site) + '</td>'
            + '<td class="num" data-label="Assets held">' + r.count + '</td>'
            + '<td class="wrap" data-label="Tags">' + r.tags.map(function (t) {
                return '<span class="pill">' + UI.esc(t) + '</span>';
              }).join(' ') + '</td>'
            + (showValue ? '<td class="num" data-label="Acquisition value">' + UI.fmtMoney(r.value) + '</td>' : '')
            + '</tr>';
        }).join('')
      + '</tbody></table></div>'
      + '<div class="card__foot"><span class="small muted">Employee records come from the HR platform. '
      + 'Only assignment-relevant fields are shown, in line with the least-privilege requirement.</span></div>';
  }

  function renderLowStock(rows) {
    if (!rows.length) {
      return UI.emptyState('Stock levels are healthy', 'No SKU is at or below its reorder point.');
    }
    return '<div class="table-wrap"><table class="data responsive"><thead><tr>'
      + '<th scope="col">SKU</th><th scope="col">Description</th><th scope="col">Location</th>'
      + '<th class="num" scope="col">On hand</th><th class="num" scope="col">Reorder at</th>'
      + '<th class="num" scope="col">Shortfall</th><th scope="col">State</th>'
      + '</tr></thead><tbody>'
      + rows.map(function (i) {
          var shortfall = Math.max(0, i.reorderPoint - i.quantityOnHand);
          return '<tr>'
            + '<td data-label="SKU"><span class="cell-strong mono">' + UI.esc(i.sku) + '</span></td>'
            + '<td class="wrap" data-label="Description">' + UI.esc(i.description) + '</td>'
            + '<td data-label="Location">' + UI.esc(i.locationName) + '</td>'
            + '<td class="num" data-label="On hand">' + UI.fmtNumber(i.quantityOnHand) + ' ' + UI.esc(i.uom) + '</td>'
            + '<td class="num" data-label="Reorder at">' + UI.fmtNumber(i.reorderPoint) + '</td>'
            + '<td class="num" data-label="Shortfall"><span class="cell-strong">' + UI.fmtNumber(shortfall) + '</span></td>'
            + '<td data-label="State">' + UI.stockBadge(i.stockState) + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  function renderMaintenance(rows) {
    if (!rows.length) { return UI.emptyState('Nothing scheduled', 'There are no open work orders.'); }
    return '<div class="table-wrap"><table class="data responsive"><thead><tr>'
      + '<th scope="col">Work order</th><th scope="col">Asset</th><th scope="col">Title</th>'
      + '<th scope="col">Priority</th><th scope="col">Status</th><th scope="col">Due</th><th scope="col">Vendor</th>'
      + '</tr></thead><tbody>'
      + rows.map(function (w) {
          return '<tr>'
            + '<td data-label="Work order"><span class="cell-strong">' + UI.esc(w.number) + '</span></td>'
            + '<td data-label="Asset">' + UI.esc(w.assetTag) + '</td>'
            + '<td class="wrap" data-label="Title">' + UI.esc(w.title) + '</td>'
            + '<td data-label="Priority">' + UI.priority(w.priority) + '</td>'
            + '<td data-label="Status">' + UI.badge(w.status) + '</td>'
            + '<td data-label="Due">' + (w.overdue
                ? '<span class="badge badge--critical">Overdue</span> '
                : '') + UI.esc(w.dueDate ? UI.fmtDate(w.dueDate) : '—') + '</td>'
            + '<td data-label="Vendor">' + UI.esc(w.vendor) + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  var exportBtn = UI.qs('#exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      UI.confirm({
        title: 'Export report',
        message: 'Exports contain business data and are written to the audit history with your user name.',
        summary: [
          { label: 'Report', value: active.label },
          { label: 'Rows', value: String(currentRows.length) },
          { label: 'Format', value: 'CSV' }
        ],
        confirmLabel: 'Export'
      }).then(function (ok) {
        if (ok) {
          UI.toast('Export queued', active.label + ' — ' + currentRows.length
            + ' rows. File delivery is mocked in this prototype.', 'success');
        }
      });
    });
  }

  renderTabs();
  loadReport();
})();
