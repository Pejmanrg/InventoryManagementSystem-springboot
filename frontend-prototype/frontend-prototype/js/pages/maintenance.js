/* ==========================================================================
   pages/maintenance.js - Screen 10: Maintenance
   --------------------------------------------------------------------------
   Maps to MaintenanceService.createWorkOrder(), updateWorkOrder(), and
   closeWorkOrder() (CSC-05 Maintenance & Purchasing). Opening a corrective
   work order can take an asset out of service; closing the last open work
   order can return it to service. Both directions are confirmed first.
   ========================================================================== */

(function () {
  'use strict';

  var page = UI.mountShell({ active: 'maintenance', title: 'Maintenance' });
  if (!page) { return; }

  var D = window.MockData;
  var filters = { status: '', priority: '', type: '', query: '' };
  var rows = [];
  var assets = [];

  page.innerHTML = ''
    + '<div class="page-head">'
    +   '<div class="page-head__text">'
    +     '<h1>Maintenance</h1>'
    +     '<div class="page-head__sub">Preventive and corrective work orders against tagged assets.</div>'
    +   '</div>'
    +   '<div class="page-head__actions">'
    +     (Auth.can('maintenance.create')
          ? '<button class="btn btn--primary" type="button" id="newBtn">New work order</button>' : '')
    +   '</div>'
    + '</div>'
    + '<div class="grid grid--kpi mb-4" id="tiles"></div>'
    + '<div id="formBanner" class="mb-4"></div>'
    + '<section class="card">'
    +   '<form class="toolbar" id="filterForm" role="search">'
    +     '<div class="field field--wide"><label class="field__label" for="fQuery">Search</label>'
    +       '<input type="search" id="fQuery" placeholder="Work order, asset tag, or title"></div>'
    +     '<div class="field"><label class="field__label" for="fStatus">Status</label>'
    +       '<select id="fStatus">'
    +         UI.selectOptions(['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED'], null, null, '', 'All statuses')
    +       '</select></div>'
    +     '<div class="field"><label class="field__label" for="fPriority">Priority</label>'
    +       '<select id="fPriority">'
    +         UI.selectOptions(['HIGH', 'MEDIUM', 'LOW'], null, null, '', 'All priorities')
    +       '</select></div>'
    +     '<div class="field"><label class="field__label" for="fType">Type</label>'
    +       '<select id="fType">'
    +         UI.selectOptions(['PREVENTIVE', 'CORRECTIVE'], null, null, '', 'All types')
    +       '</select></div>'
    +     '<div class="spacer"></div>'
    +     '<div class="toolbar__count" id="resultCount" aria-live="polite"></div>'
    +   '</form>'
    +   '<div id="tableHost">' + UI.loading('Loading work orders…') + '</div>'
    + '</section>';

  function load() {
    return Promise.all([
      API.maintenance.list(filters),
      API.maintenance.list({}),
      API.assets.list({})
    ]).then(function (r) {
      rows = r[0];
      assets = r[2];
      renderTiles(r[1]);
      renderTable();
    }).catch(function (err) {
      UI.qs('#tableHost').innerHTML = '<div class="card__body"><div class="alert alert--danger">'
        + '<div class="alert__body">' + UI.esc(err.message) + '</div></div></div>';
    });
  }

  function renderTiles(all) {
    var open = all.filter(function (w) { return w.status !== 'CLOSED'; });
    var overdue = open.filter(function (w) { return w.overdue; });
    var high = open.filter(function (w) { return w.priority === 'HIGH'; });
    var outOfService = assets.filter(function (a) { return a.status === D.AssetStatus.MAINTENANCE; }).length;

    UI.qs('#tiles').innerHTML = [
      tile('Open work orders', UI.fmtNumber(open.length), 'Not yet closed', 'accent'),
      tile('Overdue', UI.fmtNumber(overdue.length), 'Past the scheduled due date', overdue.length ? 'danger' : 'ok'),
      tile('High priority', UI.fmtNumber(high.length), 'Requires immediate scheduling', high.length ? 'warn' : 'ok'),
      tile('Assets out of service', UI.fmtNumber(outOfService), 'Status MAINTENANCE', outOfService ? 'warn' : 'ok')
    ].join('');
  }

  function tile(label, value, meta, variant) {
    return '<div class="card kpi' + (variant ? ' kpi--' + variant : '') + '">'
      + '<div class="kpi__label">' + UI.esc(label) + '</div>'
      + '<div class="kpi__value">' + UI.esc(value) + '</div>'
      + '<div class="kpi__meta">' + UI.esc(meta) + '</div></div>';
  }

  function renderTable() {
    UI.qs('#resultCount').textContent = rows.length + (rows.length === 1 ? ' work order' : ' work orders');

    if (!rows.length) {
      UI.qs('#tableHost').innerHTML = UI.emptyState('No work orders match',
        'Clear the filters to see the full list.');
      return;
    }

    UI.qs('#tableHost').innerHTML = '<div class="table-wrap"><table class="data responsive"><thead><tr>'
      + '<th scope="col">Work order</th><th scope="col">Asset</th><th scope="col">Title</th>'
      + '<th scope="col">Type</th><th scope="col">Priority</th><th scope="col">Status</th>'
      + '<th scope="col">Assigned</th><th scope="col">Due</th>'
      + '<th scope="col"><span class="visually-hidden">Actions</span></th>'
      + '</tr></thead><tbody>'
      + rows.map(function (w) {
          return '<tr>'
            + '<td data-label="Work order"><span class="cell-strong">' + UI.esc(w.number) + '</span>'
            +   '<div class="cell-sub">' + UI.esc(UI.fmtDate(w.openedAt)) + '</div></td>'
            + '<td data-label="Asset">' + (w.assetId
                ? '<a class="row-link" href="asset-detail.html?id=' + UI.esc(w.assetId) + '">' + UI.esc(w.assetTag) + '</a>'
                : '<span class="subtle">—</span>') + '</td>'
            + '<td class="wrap" data-label="Title">' + UI.esc(w.title)
            +   '<div class="cell-sub">' + UI.esc(w.vendor) + '</div></td>'
            + '<td data-label="Type">' + UI.esc(UI.titleCase(w.type)) + '</td>'
            + '<td data-label="Priority">' + UI.priority(w.priority) + '</td>'
            + '<td data-label="Status">' + UI.badge(w.status) + '</td>'
            + '<td data-label="Assigned">' + UI.esc(w.assignedToName) + '</td>'
            + '<td data-label="Due">' + (w.overdue
                ? '<span class="badge badge--critical">' + UI.esc(UI.fmtDate(w.dueDate)) + '</span>'
                : UI.esc(w.dueDate ? UI.fmtDate(w.dueDate) : '—')) + '</td>'
            + '<td class="actions" data-label="">' + actionsFor(w) + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';

    UI.qsa('#tableHost [data-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeWorkOrder(rows.filter(function (w) { return w.workOrderId === btn.dataset.close; })[0]);
      });
    });
    UI.qsa('#tableHost [data-start]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        API.maintenance.update(btn.dataset.start, { status: 'IN_PROGRESS' }).then(function (w) {
          UI.toast('Work order updated', w.number + ' is now in progress.', 'success');
          load();
        }).catch(function (err) { UI.toast('Update failed', err.message, 'danger'); });
      });
    });
  }

  function actionsFor(w) {
    if (w.status === 'CLOSED') { return '<span class="subtle xsmall">Closed ' + UI.esc(UI.fmtDate(w.closedAt)) + '</span>'; }
    if (!Auth.can('maintenance.close')) { return '<span class="subtle xsmall">View only</span>'; }
    var out = '';
    if (w.status === 'OPEN') {
      out += '<button class="btn btn--sm" type="button" data-start="' + UI.esc(w.workOrderId) + '">Start</button> ';
    }
    out += '<button class="btn btn--sm" type="button" data-close="' + UI.esc(w.workOrderId) + '">Close</button>';
    return out;
  }

  /* --------------------------------------------------------- close a WO */

  function closeWorkOrder(w) {
    var asset = assets.filter(function (a) { return a.assetId === w.assetId; })[0];
    var canReturn = asset && asset.status === D.AssetStatus.MAINTENANCE;

    UI.modal({
      title: 'Close ' + w.number,
      body: '<p class="small muted">' + UI.esc(w.title) + '</p>'
        + '<div class="confirm-summary">'
        + '<div class="confirm-summary__row"><dt>Asset</dt><dd>' + UI.esc(w.assetTag) + '</dd></div>'
        + '<div class="confirm-summary__row"><dt>Opened</dt><dd>' + UI.esc(UI.fmtDate(w.openedAt)) + '</dd></div>'
        + '<div class="confirm-summary__row"><dt>Vendor</dt><dd>' + UI.esc(w.vendor) + '</dd></div>'
        + '</div>'
        + '<div class="field mt-4"><label class="field__label" for="closeNotes">Completion notes</label>'
        + '<textarea id="closeNotes" data-autofocus placeholder="Work performed, parts used, results">'
        + UI.esc(w.notes || '') + '</textarea></div>'
        + (canReturn
          ? '<label class="check mt-4"><input type="checkbox" id="returnSvc" checked>'
            + '<span><strong>Return ' + UI.esc(w.assetTag) + ' to service</strong><br>'
            + '<span class="small muted">Sets the asset status back to AVAILABLE if no other work order is open.</span>'
            + '</span></label>'
          : ''),
      buttons: [
        { label: 'Cancel', value: null },
        {
          label: 'Close work order', variant: 'primary',
          onClick: function (root) {
            var rs = root.querySelector('#returnSvc');
            return { notes: root.querySelector('#closeNotes').value.trim(), returnToService: !!(rs && rs.checked) };
          }
        }
      ]
    }).then(function (result) {
      if (!result) { return; }
      return API.maintenance.close(w.workOrderId, result).then(function (closed) {
        UI.toast('Work order closed', closed.number
          + (result.returnToService ? ' — asset returned to service.' : '.'), 'success');
        load();
      });
    }).catch(function (err) {
      UI.toast('Close failed', err.message, 'danger');
    });
  }

  /* ---------------------------------------------------- create a new WO */

  function openCreate(presetAssetId) {
    var selectable = assets.filter(function (a) { return a.status !== D.AssetStatus.RETIRED; });

    UI.modal({
      title: 'New work order',
      wide: true,
      body: '<div class="form-grid">'
        + '<div class="field field--full"><label class="field__label" for="woTitle">Title <span class="req">*</span></label>'
        + '<input type="text" id="woTitle" data-autofocus placeholder="Brake service, annual calibration, blade replacement…">'
        + '<span class="field__error" role="alert"><span aria-hidden="true">✕</span><span class="msg"></span></span></div>'
        + '<div class="field"><label class="field__label" for="woAsset">Asset</label>'
        + '<select id="woAsset">'
        + '<option value="">Not asset-specific</option>'
        + selectable.map(function (a) {
            return '<option value="' + UI.esc(a.assetId) + '"' + (a.assetId === presetAssetId ? ' selected' : '') + '>'
              + UI.esc(a.tag) + ' — ' + UI.esc(a.name) + '</option>';
          }).join('')
        + '</select></div>'
        + '<div class="field"><label class="field__label" for="woType">Type</label>'
        + '<select id="woType">' + UI.selectOptions(['CORRECTIVE', 'PREVENTIVE'], null, null, 'CORRECTIVE') + '</select></div>'
        + '<div class="field"><label class="field__label" for="woPriority">Priority</label>'
        + '<select id="woPriority">' + UI.selectOptions(['HIGH', 'MEDIUM', 'LOW'], null, null, 'MEDIUM') + '</select></div>'
        + '<div class="field"><label class="field__label" for="woAssignee">Assigned to</label>'
        + '<select id="woAssignee">'
        + UI.selectOptions(D.EMPLOYEES, 'employeeId', 'name', 'emp-2002', 'Unassigned') + '</select></div>'
        + '<div class="field"><label class="field__label" for="woVendor">Vendor</label>'
        + '<input type="text" id="woVendor" value="In-house"></div>'
        + '<div class="field"><label class="field__label" for="woDue">Due date</label>'
        + '<input type="date" id="woDue"></div>'
        + '<div class="field field--full"><label class="field__label" for="woNotes">Notes</label>'
        + '<textarea id="woNotes"></textarea></div>'
        + '<div class="field field--full"><label class="check">'
        + '<input type="checkbox" id="woOutOfService"><span><strong>Take the asset out of service</strong><br>'
        + '<span class="small muted">Changes an AVAILABLE asset to MAINTENANCE so it cannot be checked out.</span>'
        + '</span></label></div>'
        + '</div>',
      buttons: [
        { label: 'Cancel', value: null },
        {
          label: 'Create work order', variant: 'primary',
          onClick: function (root) {
            var titleEl = root.querySelector('#woTitle');
            if (!titleEl.value.trim()) {
              var f = titleEl.closest('.field');
              f.classList.add('has-error');
              f.querySelector('.field__error .msg').textContent = 'A work order title is required.';
              titleEl.focus();
              return false;
            }
            return {
              title: titleEl.value.trim(),
              assetId: root.querySelector('#woAsset').value || null,
              type: root.querySelector('#woType').value,
              priority: root.querySelector('#woPriority').value,
              assignedTo: root.querySelector('#woAssignee').value || null,
              vendor: root.querySelector('#woVendor').value.trim() || 'In-house',
              dueDate: root.querySelector('#woDue').value,
              notes: root.querySelector('#woNotes').value.trim(),
              takeOutOfService: root.querySelector('#woOutOfService').checked
            };
          }
        }
      ]
    }).then(function (dto) {
      if (!dto) { return; }
      return API.maintenance.create(dto).then(function (wo) {
        UI.toast('Work order created', wo.number + ' opened for ' + wo.assetTag + '.', 'success');
        load();
      });
    }).catch(function (err) {
      UI.toast('Could not create work order', err.message, 'danger');
    });
  }

  /* -------------------------------------------------------------- wiring */

  var newBtn = UI.qs('#newBtn');
  if (newBtn) { newBtn.addEventListener('click', function () { openCreate(null); }); }

  var debounce;
  UI.qs('#fQuery').addEventListener('input', function (e) {
    clearTimeout(debounce);
    filters.query = e.target.value;
    debounce = setTimeout(load, 220);
  });
  ['#fStatus', '#fPriority', '#fType'].forEach(function (sel) {
    UI.qs(sel).addEventListener('change', function (e) {
      filters[sel === '#fStatus' ? 'status' : sel === '#fPriority' ? 'priority' : 'type'] = e.target.value;
      load();
    });
  });
  UI.qs('#filterForm').addEventListener('submit', function (e) { e.preventDefault(); load(); });

  load().then(function () {
    if (UI.param('new') && Auth.can('maintenance.create')) {
      openCreate(UI.param('assetId'));
    }
  });
})();
