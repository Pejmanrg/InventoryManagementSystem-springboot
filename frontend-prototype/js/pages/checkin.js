
(function () {
  'use strict';

  var page = UI.mountShell({ active: 'checkin', title: 'Check In Asset' });
  if (!page) { return; }

  if (!Auth.can('asset.checkin')) {
    page.innerHTML = '<div class="page-head"><div class="page-head__text"><h1>Check in asset</h1></div></div>'
      + UI.denied('the check-in workflow');
    return;
  }

  var D = window.MockData;
  var STEPS = ['Select asset', 'Return details', 'Review & confirm'];
  var state = { step: 1, asset: null, locationId: '', condition: '', notes: '', sendToMaintenance: false, result: null };
  var checkedOut = [];

  page.innerHTML = ''
    + '<div class="page-head">'
    +   '<div class="page-head__text">'
    +     '<h1>Check in asset</h1>'
    +     '<div class="page-head__sub">Return equipment to stock and close out the assignment.</div>'
    +   '</div>'
    +   '<div class="page-head__actions"><a class="btn" href="assets.html?status=CHECKED_OUT">View checked-out assets</a></div>'
    + '</div>'
    + '<div id="formBanner" class="mb-4"></div>'
    + '<section class="card">'
    +   '<div class="stepper" id="stepper"></div>'
    +   '<div id="stepBody">' + UI.loading('Loading checked-out assets…') + '</div>'
    + '</section>';

  var preselect = UI.param('assetId');

  // Locations first - see checkout.js for why.
  API.reference.locations().then(function () {
    return API.assets.list({ status: D.AssetStatus.CHECKED_OUT });
  }).then(function (rows) {
    checkedOut = rows;
    if (preselect) {
      return API.assets.get(preselect).then(function (a) {
        if (a.status !== D.AssetStatus.CHECKED_OUT) {
          UI.showFormError('Asset ' + a.tag + ' is not currently checked out. Current status: ' + a.status + '.', page);
        } else {
          state.asset = a;
          state.locationId = a.locationId;
          state.condition = a.condition;
          state.step = 2;
        }
      }).catch(function () {  });
    }
  }).then(render).catch(function (err) {
    UI.qs('#stepBody').innerHTML = '<div class="card__body"><div class="alert alert--danger">'
      + '<div class="alert__body">' + UI.esc(err.message) + '</div></div></div>';
  });

  function renderStepper(allDone) {
    UI.qs('#stepper').innerHTML = STEPS.map(function (label, i) {
      var n = i + 1;
      var cls = allDone ? 'is-done' : (state.step === n ? 'is-active' : (state.step > n ? 'is-done' : ''));
      return (i ? '<span class="step__arrow" aria-hidden="true">›</span>' : '')
        + '<div class="step ' + cls + '"><span class="step__num">'
        + (allDone || state.step > n ? '✓' : n) + '</span><span>' + UI.esc(label) + '</span></div>';
    }).join('');
  }

  function render() {
    renderStepper(state.step === 4);
    if (state.step === 1) { return renderPick(); }
    if (state.step === 2) { return renderDetails(); }
    if (state.step === 3) { return renderReview(); }
    return renderDone();
  }

  function renderPick() {
    UI.qs('#stepBody').innerHTML = ''
      + '<div class="toolbar">'
      +   '<div class="field field--wide"><label class="field__label" for="pickSearch">Find a checked-out asset</label>'
      +   '<input type="search" id="pickSearch" placeholder="Tag, name, or custodian" autocomplete="off"></div>'
      +   '<div class="spacer"></div><div class="toolbar__count" id="pickCount"></div>'
      + '</div>'
      + '<div id="pickList"></div>';

    function draw(list) {
      UI.qs('#pickCount').textContent = list.length + ' checked out';
      UI.qs('#pickList').innerHTML = list.length
        ? '<div class="pick-list">' + list.map(function (a) {
            return '<button type="button" class="pick" data-id="' + UI.esc(a.assetId) + '">'
              + '<span class="pick__main"><span class="pick__title">' + UI.esc(a.tag) + ' — ' + UI.esc(a.name) + '</span>'
              + '<span class="pick__sub">Held by ' + UI.esc(a.custodianName || 'unassigned')
              + ' · ' + UI.esc(a.locationName) + '</span></span>'
              + '<span class="xsmall subtle nowrap">' + UI.esc(UI.fmtRelative(a.lastTransactionAt)) + '</span>'
              + '</button>';
          }).join('') + '</div>'
        : UI.emptyState('Nothing to check in', 'No checked-out asset matches that search.');

      UI.qsa('#pickList .pick').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.asset = list.filter(function (a) { return a.assetId === btn.dataset.id; })[0];
          state.locationId = state.asset.locationId;
          state.condition = state.asset.condition;
          state.step = 2;
          UI.clearErrors(page);
          render();
        });
      });
    }

    draw(checkedOut);
    UI.qs('#pickSearch').addEventListener('input', function (e) {
      var q = e.target.value.trim().toLowerCase();
      draw(checkedOut.filter(function (a) {
        return !q || (a.tag + ' ' + a.name + ' ' + (a.custodianName || '')).toLowerCase().indexOf(q) !== -1;
      }));
    });
  }

  function renderDetails() {
    var a = state.asset;
    UI.qs('#stepBody').innerHTML = ''
      + '<div class="card__body">'
      +   '<div class="alert alert--info mb-4"><span class="alert__icon" aria-hidden="true">▣</span>'
      +     '<div class="alert__body"><div class="alert__title">' + UI.esc(a.tag) + ' — ' + UI.esc(a.name) + '</div>'
      +     'Currently held by ' + UI.esc(a.custodianName || 'unassigned') + ' at ' + UI.esc(a.locationName)
      +     '</div></div>'
      +   '<div class="form-grid">'
      +     '<div class="field"><label class="field__label" for="locationId">Return location <span class="req">*</span></label>'
      +       '<select id="locationId">' + UI.selectOptions(D.LOCATIONS, 'locationId', 'name', state.locationId) + '</select>'
      +       '<span class="field__hint">Where the asset physically ends up.</span></div>'
      +     '<div class="field"><label class="field__label" for="condition">Condition on return</label>'
      +       '<select id="condition">' + UI.selectOptions(D.CONDITIONS, null, null, state.condition) + '</select></div>'
      +     '<div class="field field--full"><label class="field__label" for="notes">Return notes</label>'
      +       '<textarea id="notes" placeholder="Accessories returned, damage observed, fuel level…">'
              + UI.esc(state.notes) + '</textarea></div>'
      +     '<div class="field field--full">'
      +       '<label class="check"><input type="checkbox" id="toMaint"' + (state.sendToMaintenance ? ' checked' : '') + '>'
      +       '<span><strong>This asset needs service before it is reissued</strong><br>'
      +       '<span class="small muted">Sets the status to MAINTENANCE instead of AVAILABLE and opens a work order.</span>'
      +       '</span></label>'
      +     '</div>'
      +   '</div>'
      +   '<div class="form-actions">'
      +     '<button class="btn" type="button" id="backBtn">Back</button>'
      +     '<div class="spacer"></div>'
      +     '<button class="btn btn--primary" type="button" id="nextBtn">Continue to review</button>'
      +   '</div>'
      + '</div>';

    UI.qs('#backBtn').addEventListener('click', function () {
      state.step = 1; state.asset = null; render();
    });
    UI.qs('#nextBtn').addEventListener('click', function () {
      state.locationId = UI.qs('#locationId').value;
      state.condition = UI.qs('#condition').value;
      state.notes = UI.qs('#notes').value.trim();
      state.sendToMaintenance = UI.qs('#toMaint').checked;
      state.step = 3;
      render();
    });
  }

  function renderReview() {
    var a = state.asset;
    var loc = D.LOCATIONS.filter(function (l) { return l.locationId === state.locationId; })[0];
    var newStatus = state.sendToMaintenance ? D.AssetStatus.MAINTENANCE : D.AssetStatus.AVAILABLE;

    UI.qs('#stepBody').innerHTML = ''
      + '<div class="card__body">'
      +   '<h3 class="mb-4">Review the return</h3>'
      +   '<div class="dl">'
      +     item('Asset', a.tag + ' — ' + a.name)
      +     item('Returned by', a.custodianName || '—')
      +     item('Return location', loc ? loc.name : '—')
      +     item('Condition', UI.titleCase(state.condition))
      +     item('Status after check-in', newStatus)
      +   '</div>'
      +   (state.notes ? '<div class="mt-4"><div class="dl__term">Notes</div><div class="small">'
            + UI.esc(state.notes) + '</div></div>' : '')
      +   (state.sendToMaintenance
          ? '<div class="alert alert--warning mt-4"><span class="alert__icon" aria-hidden="true">!</span>'
            + '<div class="alert__body">A corrective work order will be opened automatically and the asset will '
            + 'not be available for check-out until that work order is closed.</div></div>'
          : '')
      +   '<div class="form-actions">'
      +     '<button class="btn" type="button" id="backBtn2">Back</button>'
      +     '<div class="spacer"></div>'
      +     '<button class="btn btn--primary" type="button" id="commitBtn">Check in asset</button>'
      +   '</div>'
      + '</div>';

    UI.qs('#backBtn2').addEventListener('click', function () { state.step = 2; render(); });
    UI.qs('#commitBtn').addEventListener('click', function () { commit(loc, newStatus); });
  }

  function item(term, value) {
    return '<div class="dl__item"><div class="dl__term">' + UI.esc(term) + '</div>'
      + '<div class="dl__val">' + UI.esc(value) + '</div></div>';
  }

  function commit(loc, newStatus) {
    UI.confirm({
      title: 'Confirm check-in',
      message: 'This clears the custodian assignment and writes a CHECKIN transaction.',
      summary: [
        { label: 'Asset', value: state.asset.tag },
        { label: 'Returned by', value: state.asset.custodianName || '—' },
        { label: 'Return location', value: loc ? loc.name : '—' },
        { label: 'New status', html: UI.badge(newStatus) }
      ],
      confirmLabel: 'Check in'
    }).then(function (ok) {
      if (!ok) { return; }
      var btn = UI.qs('#commitBtn');
      btn.disabled = true;
      btn.textContent = 'Working…';

      return API.transactions.checkIn(state.asset.assetId, {
        locationId: state.locationId,
        condition: state.condition,
        notes: state.notes || 'Returned',
        sendToMaintenance: state.sendToMaintenance
      }).then(function (result) {
        state.result = result;
        state.step = 4;
        UI.toast('Checked in', state.asset.tag + ' returned to ' + (loc ? loc.name : 'stock') + '.', 'success');
        render();
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Check in asset';
        UI.showFormError(err.message, page);
        UI.toast('Check-in rejected', err.message, 'danger');
      });
    });
  }

  function renderDone() {
    var a = state.result.asset;
    // A receipt should never blank the screen, so tolerate a missing transaction.
    var txn = state.result.transaction || {};
    var wo = state.result.workOrder;

    UI.qs('#stepBody').innerHTML = ''
      + '<div class="card__body">'
      +   '<div class="alert alert--success"><span class="alert__icon" aria-hidden="true">✓</span>'
      +     '<div class="alert__body"><div class="alert__title">Check-in complete</div>'
      +     UI.esc(a.tag) + ' is now ' + UI.esc(a.status) + ' at ' + UI.esc(a.locationName) + '.'
      +     '</div></div>'
      +   (wo ? '<div class="alert alert--warning mt-4"><span class="alert__icon" aria-hidden="true">⚙</span>'
            + '<div class="alert__body"><div class="alert__title">Work order ' + UI.esc(wo.number) + ' opened</div>'
            + UI.esc(wo.title) + '</div></div>' : '')
      +   '<div class="dl mt-4">'
      +     item('Transaction ID', txn.transactionId || 'Not recorded')
      +     item('Recorded at', txn.timestamp ? UI.fmtDateTime(txn.timestamp) : '—')
      +     item('Recorded by', Auth.user().name)
      +   '</div>'
      +   '<div class="form-actions">'
      +     '<a class="btn" href="assets.html">Back to assets</a>'
      +     '<div class="spacer"></div>'
      +     '<button class="btn" type="button" id="againBtn">Check in another</button>'
      +     '<a class="btn btn--primary" href="asset-detail.html?id=' + UI.esc(a.assetId) + '">View asset</a>'
      +   '</div>'
      + '</div>';

    UI.qs('#againBtn').addEventListener('click', function () {
      state = { step: 1, asset: null, locationId: '', condition: '', notes: '', sendToMaintenance: false, result: null };
      UI.clearErrors(page);
      API.assets.list({ status: D.AssetStatus.CHECKED_OUT }).then(function (rows) {
        checkedOut = rows;
        render();
      });
    });
  }
})();
