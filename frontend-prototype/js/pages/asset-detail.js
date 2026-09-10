
(function () {
  'use strict';

  var page = UI.mountShell({ active: 'assets', title: 'Asset Detail' });
  if (!page) { return; }

  var D = window.MockData;
  var S = D.AssetStatus;
  var assetId = UI.param('id');

  if (!assetId) {
    page.innerHTML = UI.emptyState('No asset selected', 'Open an asset from the assets list.',
      '<a class="btn btn--primary" href="assets.html">Go to assets</a>');
    return;
  }

  render();

  function render() {
    page.innerHTML = UI.loading('Loading asset…');

    Promise.all([
      API.assets.get(assetId),
      API.assets.history(assetId),
      API.maintenance.list({})
    ]).then(function (r) {
      var a = r[0], history = r[1];
      var workOrders = r[2].filter(function (w) { return w.assetId === assetId; });

      page.innerHTML = ''
        + '<div class="breadcrumb"><a href="assets.html">Assets</a><span>/</span>' + UI.esc(a.tag) + '</div>'
        + '<div class="page-head">'
        +   '<div class="page-head__text">'
        +     '<h1>' + UI.esc(a.tag) + ' — ' + UI.esc(a.name) + '</h1>'
        +     '<div class="page-head__sub">' + UI.badge(a.status) + ' · ' + UI.esc(a.categoryName)
        +       ' · ' + UI.esc(a.locationName) + '</div>'
        +   '</div>'
        +   '<div class="page-head__actions" id="actions"></div>'
        + '</div>'
        + '<div id="formBanner" class="mb-4"></div>'
        + '<div class="grid grid--split">'
        +   '<div class="stack">'
        +     detailsCard(a)
        +     historyCard(history)
        +   '</div>'
        +   '<div class="stack">'
        +     custodyCard(a)
        +     workOrderCard(workOrders)
        +   '</div>'
        + '</div>';

      renderActions(a);
    }).catch(function (err) {
      page.innerHTML = UI.emptyState('Asset not found', err.message,
        '<a class="btn btn--primary" href="assets.html">Back to assets</a>');
    });
  }

  function detailsCard(a) {
    return '<section class="card"><div class="card__head"><h2>Asset details</h2>'
      + '<div class="spacer"></div>'
      + (Auth.can('asset.edit') ? '<button class="btn btn--sm" type="button" id="editBtn">Edit</button>' : '')
      + '</div><div class="card__body"><div class="dl">'
      + dl('Asset tag', a.tag)
      + dl('Serial number', a.serialNumber || '—')
      + dl('Category', a.categoryName)
      + dl('Condition', UI.titleCase(a.condition))
      + dl('Location', a.locationName + ' (' + a.locationCode + ')')
      + dl('Purchase date', UI.fmtDate(a.purchaseDate))
      + (Auth.can('report.view.all') ? dl('Purchase cost', UI.fmtMoney(a.purchaseCost)) : '')
      + dl('Warranty end', UI.fmtDate(a.warrantyEnd))
      + dl('Internal ID', a.assetId, 'dl__val--mono')
      + '</div>'
      + (a.notes ? '<div class="mt-4"><div class="dl__term">Notes</div><div class="small">'
          + UI.esc(a.notes) + '</div></div>' : '')
      + '</div></section>';
  }

  function dl(term, value, cls) {
    return '<div class="dl__item"><div class="dl__term">' + UI.esc(term) + '</div>'
      + '<div class="dl__val ' + (cls || '') + '">' + UI.esc(value) + '</div></div>';
  }

  function custodyCard(a) {
    return '<section class="card"><div class="card__head"><h2>Current custody</h2></div>'
      + '<div class="card__body">'
      + '<div class="dl" style="grid-template-columns:1fr">'
      + dl('Status', UI.titleCase(a.status))
      + dl('Custodian', a.custodianName || 'Not assigned')
      + dl('Location', a.locationName)
      + dl('Last activity', UI.fmtDateTime(a.lastTransactionAt))
      + '</div></div></section>';
  }

  function historyCard(history) {
    return '<section class="card"><div class="card__head"><h2>Transaction history</h2>'
      + '<div class="spacer"></div><span class="pill">' + history.length + ' records</span></div>'
      + '<div class="card__body card__body--flush">'
      + (history.length
        ? '<div class="table-wrap"><table class="data responsive"><thead><tr>'
          + '<th scope="col">Date</th><th scope="col">Type</th><th scope="col">Employee</th>'
          + '<th scope="col">Location</th><th scope="col">Notes</th></tr></thead><tbody>'
          + history.map(function (t) {
              return '<tr>'
                + '<td data-label="Date">' + UI.esc(UI.fmtDateTime(t.timestamp)) + '</td>'
                + '<td data-label="Type">' + UI.badge(t.type) + '</td>'
                + '<td data-label="Employee">' + UI.esc(t.employeeName) + '</td>'
                + '<td data-label="Location">' + UI.esc(t.locationName) + '</td>'
                + '<td class="wrap" data-label="Notes">' + UI.esc(t.notes || '—') + '</td>'
                + '</tr>';
            }).join('')
          + '</tbody></table></div>'
        : UI.emptyState('No transactions yet', 'History is written whenever this asset is checked out, returned, moved, disposed, or recovered.'))
      + '</div></section>';
  }

  function workOrderCard(list) {
    return '<section class="card"><div class="card__head"><h2>Maintenance</h2>'
      + '<div class="spacer"></div>'
      + (Auth.can('maintenance.create')
          ? '<a class="btn btn--sm" href="maintenance.html?assetId=' + UI.esc(assetId) + '&new=1">New work order</a>' : '')
      + '</div><div class="card__body card__body--flush">'
      + (list.length
        ? '<ul class="timeline">' + list.map(function (w) {
            return '<li><span class="timeline__body"><strong>' + UI.esc(w.number) + '</strong> '
              + UI.badge(w.status) + '<div class="xsmall subtle">' + UI.esc(w.title) + '</div></span>'
              + '<span class="timeline__when">' + UI.esc(UI.fmtDate(w.dueDate)) + '</span></li>';
          }).join('') + '</ul>'
        : UI.emptyState('No work orders', 'This asset has no maintenance history recorded.'))
      + '</div></section>';
  }

  function renderActions(a) {
    var buttons = [];

    if (a.status === S.AVAILABLE && Auth.can('asset.checkout')) {
      buttons.push('<a class="btn btn--primary" href="checkout.html?assetId=' + UI.esc(a.assetId) + '">Check out</a>');
    }
    if (a.status === S.CHECKED_OUT && Auth.can('asset.checkin')) {
      buttons.push('<a class="btn btn--primary" href="checkin.html?assetId=' + UI.esc(a.assetId) + '">Check in</a>');
    }
    if (a.status !== S.RETIRED && Auth.can('asset.move')) {
      buttons.push('<button class="btn" type="button" data-act="move">Move</button>');
    }
    if (a.status === S.LOST && Auth.can('asset.recover')) {
      buttons.push('<button class="btn" type="button" data-act="recover">Mark recovered</button>');
    }
    if ([S.AVAILABLE, S.CHECKED_OUT, S.MAINTENANCE].indexOf(a.status) !== -1 && Auth.can('asset.edit')) {
      buttons.push('<button class="btn" type="button" data-act="lost">Report lost</button>');
    }
    if (a.status !== S.RETIRED && Auth.can('asset.dispose')) {
      buttons.push('<button class="btn btn--danger" type="button" data-act="dispose">Retire / dispose</button>');
    }

    UI.qs('#actions').innerHTML = buttons.join('');

    UI.qsa('#actions [data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () { handle(btn.dataset.act, a); });
    });

    var edit = UI.qs('#editBtn');
    if (edit) { edit.addEventListener('click', function () { openEdit(a); }); }
  }

  function handle(action, a) {
    if (action === 'move') { return openMove(a); }

    if (action === 'recover') {
      return UI.confirm({
        title: 'Mark asset recovered',
        message: 'This returns the asset to AVAILABLE and records a RECOVER transaction.',
        summary: [{ label: 'Asset', value: a.tag + ' — ' + a.name },
                  { label: 'New status', html: UI.badge(S.AVAILABLE) }],
        confirmLabel: 'Mark recovered'
      }).then(function (ok) {
        if (!ok) { return; }
        return API.transactions.recover(a.assetId, 'Recovered and returned to stock.')
          .then(done('Asset recovered', a.tag + ' is available again.'));
      }).catch(fail);
    }

    if (action === 'lost') {
      return UI.confirm({
        title: 'Report asset lost',
        message: 'The asset will be marked LOST and remain visible for recovery or write-off.',
        summary: [{ label: 'Asset', value: a.tag + ' — ' + a.name },
                  { label: 'Last known location', value: a.locationName },
                  { label: 'New status', html: UI.badge(S.LOST) }],
        warning: 'Managers are notified and the change is written to the audit history.',
        confirmLabel: 'Report lost', danger: true
      }).then(function (ok) {
        if (!ok) { return; }
        return API.transactions.markLost(a.assetId, 'Reported lost from asset detail screen.')
          .then(done('Asset reported lost', a.tag + ' is now marked LOST.'));
      }).catch(fail);
    }

    if (action === 'dispose') {
      return UI.confirm({
        title: 'Retire and dispose asset',
        message: 'Retiring an asset removes it from operational availability. History is preserved and cannot be edited.',
        summary: [{ label: 'Asset', value: a.tag + ' — ' + a.name },
                  { label: 'Current status', html: UI.badge(a.status) },
                  { label: 'New status', html: UI.badge(S.RETIRED) }],
        warning: 'This action cannot be undone from the user interface.',
        confirmLabel: 'Retire asset', danger: true
      }).then(function (ok) {
        if (!ok) { return; }
        return API.transactions.dispose(a.assetId, 'Retired from asset detail screen.')
          .then(done('Asset retired', a.tag + ' was moved to RETIRED.'));
      }).catch(fail);
    }
  }

  function openMove(a) {
    UI.modal({
      title: 'Move asset to another location',
      body: '<p class="small muted">A move records a MOVE transaction and keeps the current custodian assignment.</p>'
        + '<div class="field mt-4"><label class="field__label" for="moveLoc">Destination location <span class="req">*</span></label>'
        + '<select id="moveLoc" data-autofocus>'
        + UI.selectOptions(D.LOCATIONS.filter(function (l) { return l.locationId !== a.locationId; }),
                           'locationId', 'name', '', 'Select a location') + '</select></div>'
        + '<div class="field mt-4"><label class="field__label" for="moveNotes">Notes</label>'
        + '<textarea id="moveNotes" placeholder="Reason for the transfer"></textarea></div>',
      buttons: [
        { label: 'Cancel', value: null },
        {
          label: 'Move asset', variant: 'primary',
          onClick: function (root) {
            var loc = root.querySelector('#moveLoc').value;
            if (!loc) {
              root.querySelector('#moveLoc').focus();
              return false;
            }
            return { locationId: loc, notes: root.querySelector('#moveNotes').value };
          }
        }
      ]
    }).then(function (result) {
      if (!result) { return; }
      return API.transactions.move(a.assetId, result.locationId, result.notes)
        .then(done('Asset moved', a.tag + ' location updated.'));
    }).catch(fail);
  }

  function openEdit(a) {
    UI.modal({
      title: 'Edit asset details',
      wide: true,
      body: '<div class="form-grid">'
        + '<div class="field"><label class="field__label" for="eName">Asset name</label>'
        + '<input type="text" id="eName" value="' + UI.esc(a.name) + '" data-autofocus></div>'
        + '<div class="field"><label class="field__label" for="eSerial">Serial number</label>'
        + '<input type="text" id="eSerial" value="' + UI.esc(a.serialNumber) + '"></div>'
        + '<div class="field"><label class="field__label" for="eCondition">Condition</label>'
        + '<select id="eCondition">' + UI.selectOptions(D.CONDITIONS, null, null, a.condition) + '</select></div>'
        + '<div class="field"><label class="field__label" for="eCategory">Category</label>'
        + '<select id="eCategory">' + UI.selectOptions(D.CATEGORIES, 'code', 'name', a.category) + '</select></div>'
        + '<div class="field field--full"><label class="field__label" for="eNotes">Notes</label>'
        + '<textarea id="eNotes">' + UI.esc(a.notes) + '</textarea></div>'
        + '</div>'
        + '<p class="prototype-note">The asset tag is immutable once created because transaction history references it.</p>',
      buttons: [
        { label: 'Cancel', value: null },
        {
          label: 'Save changes', variant: 'primary',
          onClick: function (root) {
            var name = root.querySelector('#eName').value.trim();
            if (!name) { root.querySelector('#eName').focus(); return false; }
            return {
              name: name,
              serialNumber: root.querySelector('#eSerial').value.trim(),
              condition: root.querySelector('#eCondition').value,
              category: root.querySelector('#eCategory').value,
              notes: root.querySelector('#eNotes').value
            };
          }
        }
      ]
    }).then(function (dto) {
      if (!dto) { return; }
      return API.assets.update(a.assetId, dto).then(done('Asset updated', 'Changes saved.'));
    }).catch(fail);
  }

  function done(title, message) {
    return function () {
      UI.toast(title, message, 'success');
      render();
    };
  }

  function fail(err) {
    UI.handleApiError(err, document);
    UI.toast('Action rejected', err.message, 'danger');
  }
})();
