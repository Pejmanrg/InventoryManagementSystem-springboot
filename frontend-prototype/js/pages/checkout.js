
(function () {
  'use strict';

  var page = UI.mountShell({ active: 'checkout', title: 'Check Out Asset' });
  if (!page) { return; }

  if (!Auth.can('asset.checkout')) {
    page.innerHTML = '<div class="page-head"><div class="page-head__text"><h1>Check out asset</h1></div></div>'
      + UI.denied('the check-out workflow');
    return;
  }

  var D = window.MockData;
  var state = { step: 1, asset: null, employeeId: '', locationId: '', dueDate: '', notes: '', result: null };
  var available = [];

  page.innerHTML = ''
    + '<div class="page-head">'
    +   '<div class="page-head__text">'
    +     '<h1>Check out asset</h1>'
    +     '<div class="page-head__sub">Assign a single tracked asset to an employee. To issue a '
    +       'quantity of a stocked item, use Issue stock instead.</div>'
    +   '</div>'
    +   '<div class="page-head__actions">'
    +     '<a class="btn" href="inventory-adjust.html">Issue stock instead</a>'
    +     '<a class="btn" href="assets.html">Asset list</a>'
    +   '</div>'
    + '</div>'
    + '<div id="formBanner" class="mb-4"></div>'
    + '<section class="card">'
    +   '<div class="stepper" id="stepper"></div>'
    +   '<div id="stepBody">' + UI.loading('Loading available assets…') + '</div>'
    + '</section>';

  var preselect = UI.param('assetId');

  // Locations and employees first. Both dropdowns submit ids, and sending a
  // value the API cannot read as a UUID fails the whole check-out.
  Promise.all([API.reference.locations(), API.reference.employees()]).then(function () {
    return API.assets.list({ status: D.AssetStatus.AVAILABLE });
  }).then(function (rows) {
    available = rows;
    if (preselect) {
      return API.assets.get(preselect).then(function (a) {
        if (a.status !== D.AssetStatus.AVAILABLE) {
          UI.showFormError('Asset ' + a.tag + ' cannot be checked out. Current status: ' + a.status + '.', page);
        } else {
          state.asset = a;
          state.locationId = a.locationId;
          state.step = 2;
        }
      }).catch(function () {  });
    }
  }).then(render).catch(function (err) {
    UI.qs('#stepBody').innerHTML = '<div class="card__body"><div class="alert alert--danger">'
      + '<div class="alert__body">' + UI.esc(err.message) + '</div></div></div>';
  });

  var STEPS = ['Select asset', 'Assign employee', 'Review & confirm'];

  function renderStepper() {
    UI.qs('#stepper').innerHTML = STEPS.map(function (label, i) {
      var n = i + 1;
      var cls = state.step === n ? 'is-active' : (state.step > n ? 'is-done' : '');
      return (i ? '<span class="step__arrow" aria-hidden="true">›</span>' : '')
        + '<div class="step ' + cls + '"><span class="step__num">' + (state.step > n ? '✓' : n) + '</span>'
        + '<span>' + UI.esc(label) + '</span></div>';
    }).join('');
  }

  function render() {
    renderStepper();
    if (state.step === 1) { return renderPick(); }
    if (state.step === 2) { return renderAssign(); }
    if (state.step === 3) { return renderReview(); }
    return renderDone();
  }

  function renderPick() {
    UI.qs('#stepBody').innerHTML = ''
      + '<div class="toolbar">'
      +   '<div class="field field--wide"><label class="field__label" for="pickSearch">Find an available asset</label>'
      +   '<input type="search" id="pickSearch" placeholder="Tag, name, or serial number" autocomplete="off"></div>'
      +   '<div class="spacer"></div>'
      +   '<div class="toolbar__count" id="pickCount"></div>'
      + '</div>'
      + '<div id="pickList"></div>';

    function draw(list) {
      UI.qs('#pickCount').textContent = list.length + ' available';
      UI.qs('#pickList').innerHTML = list.length
        ? '<div class="pick-list">' + list.map(function (a) {
            return '<button type="button" class="pick" data-id="' + UI.esc(a.assetId) + '">'
              + '<span class="pick__main"><span class="pick__title">' + UI.esc(a.tag) + ' — ' + UI.esc(a.name) + '</span>'
              + '<span class="pick__sub">' + UI.esc(a.categoryName) + ' · ' + UI.esc(a.locationName) + '</span></span>'
              + UI.badge(a.status) + '</button>';
          }).join('') + '</div>'
        : UI.emptyState('No available assets match', 'Everything matching that search is checked out, in maintenance, or retired.');

      UI.qsa('#pickList .pick').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.asset = list.filter(function (a) { return a.assetId === btn.dataset.id; })[0];
          state.locationId = state.asset.locationId;
          state.step = 2;
          UI.clearErrors(page);
          render();
        });
      });
    }

    draw(available);

    UI.qs('#pickSearch').addEventListener('input', function (e) {
      var q = e.target.value.trim().toLowerCase();
      draw(available.filter(function (a) {
        return !q || (a.tag + ' ' + a.name + ' ' + a.serialNumber).toLowerCase().indexOf(q) !== -1;
      }));
    });
  }

  function renderAssign() {
    var a = state.asset;
    UI.qs('#stepBody').innerHTML = ''
      + '<div class="card__body">'
      +   '<div class="alert alert--info mb-4"><span class="alert__icon" aria-hidden="true">▣</span>'
      +     '<div class="alert__body"><div class="alert__title">' + UI.esc(a.tag) + ' — ' + UI.esc(a.name) + '</div>'
      +     UI.esc(a.categoryName) + ' · currently at ' + UI.esc(a.locationName) + ' · ' + UI.badge(a.status)
      +     '</div></div>'
      +   '<div class="form-grid">'
      +     '<div class="field">'
      +       '<label class="field__label" for="employeeId">Receiving employee <span class="req">*</span></label>'
      +       '<select id="employeeId" name="employeeId" aria-required="true">'
      +         UI.selectOptions(D.EMPLOYEES.filter(function (e) { return e.status === 'ACTIVE'; }),
                                 'employeeId', 'name', state.employeeId, 'Select an employee')
      +       '</select>'
      +       '<span class="field__hint">Employee records are synchronized from the HR platform.</span>'
      +       '<span class="field__error" role="alert"><span aria-hidden="true">✕</span><span class="msg"></span></span>'
      +     '</div>'
      +     '<div class="field">'
      +       '<label class="field__label" for="locationId">Destination location</label>'
      +       '<select id="locationId" name="locationId">'
      +         UI.selectOptions(D.LOCATIONS, 'locationId', 'name', state.locationId) + '</select>'
      +       '<span class="field__hint">Where the asset will be while assigned.</span>'
      +     '</div>'
      +     '<div class="field">'
      +       '<label class="field__label" for="dueDate">Expected return</label>'
      +       '<input type="date" id="dueDate" name="dueDate" value="' + UI.esc(state.dueDate) + '">'
      +       '<span class="field__hint">Optional. Used by the overdue-assignment report.</span>'
      +     '</div>'
      +     '<div class="field field--full">'
      +       '<label class="field__label" for="notes">Notes</label>'
      +       '<textarea id="notes" name="notes" placeholder="Job number, crew, accessories issued…">'
                + UI.esc(state.notes) + '</textarea>'
      +     '</div>'
      +   '</div>'
      +   '<div class="form-actions">'
      +     '<button class="btn" type="button" id="backBtn">Back</button>'
      +     '<div class="spacer"></div>'
      +     '<button class="btn btn--primary" type="button" id="nextBtn">Continue to review</button>'
      +   '</div>'
      + '</div>';

    UI.qs('#backBtn').addEventListener('click', function () {
      state.step = 1;
      state.asset = null;
      render();
    });

    UI.qs('#nextBtn').addEventListener('click', function () {
      var sel = UI.qs('#employeeId');
      if (!sel.value) {
        var f = sel.closest('.field');
        f.classList.add('has-error');
        UI.qs('.field__error .msg', f).textContent = 'A receiving employee is required for checkout.';
        sel.focus();
        return;
      }
      state.employeeId = sel.value;
      state.locationId = UI.qs('#locationId').value;
      state.dueDate = UI.qs('#dueDate').value;
      state.notes = UI.qs('#notes').value.trim();
      state.step = 3;
      render();
    });

    UI.qs('#employeeId').addEventListener('change', function (e) {
      e.target.closest('.field').classList.remove('has-error');
    });
  }

  function renderReview() {
    var a = state.asset;
    var emp = D.EMPLOYEES.filter(function (e) { return e.employeeId === state.employeeId; })[0];
    var loc = D.LOCATIONS.filter(function (l) { return l.locationId === state.locationId; })[0];

    UI.qs('#stepBody').innerHTML = ''
      + '<div class="card__body">'
      +   '<h3 class="mb-4">Review the check-out</h3>'
      +   '<div class="dl">'
      +     item('Asset', a.tag + ' — ' + a.name)
      +     item('Category', a.categoryName)
      +     item('Receiving employee', emp.name + ' (' + emp.title + ')')
      +     item('Destination', loc ? loc.name : '—')
      +     item('Expected return', state.dueDate ? UI.fmtDate(state.dueDate) : 'Not specified')
      +     item('Status after checkout', 'CHECKED_OUT')
      +   '</div>'
      +   (state.notes ? '<div class="mt-4"><div class="dl__term">Notes</div><div class="small">'
            + UI.esc(state.notes) + '</div></div>' : '')
      +   '<div class="alert alert--info mt-4"><span class="alert__icon" aria-hidden="true">i</span>'
      +     '<div class="alert__body">Confirming writes a CHECKOUT transaction and an audit event. '
      +     'The asset record and its history are updated together.</div></div>'
      +   '<div class="form-actions">'
      +     '<button class="btn" type="button" id="backBtn2">Back</button>'
      +     '<div class="spacer"></div>'
      +     '<button class="btn btn--primary" type="button" id="commitBtn">Check out asset</button>'
      +   '</div>'
      + '</div>';

    UI.qs('#backBtn2').addEventListener('click', function () { state.step = 2; render(); });
    UI.qs('#commitBtn').addEventListener('click', function () { commit(emp, loc); });
  }

  function item(term, value) {
    return '<div class="dl__item"><div class="dl__term">' + UI.esc(term) + '</div>'
      + '<div class="dl__val">' + UI.esc(value) + '</div></div>';
  }

  function commit(emp, loc) {
    UI.confirm({
      title: 'Confirm check-out',
      message: 'This changes the asset status and creates a permanent transaction record.',
      summary: [
        { label: 'Asset', value: state.asset.tag },
        { label: 'To employee', value: emp.name },
        { label: 'Destination', value: loc ? loc.name : '—' },
        { label: 'New status', html: UI.badge(D.AssetStatus.CHECKED_OUT) }
      ],
      confirmLabel: 'Check out'
    }).then(function (ok) {
      if (!ok) { return; }
      var btn = UI.qs('#commitBtn');
      btn.disabled = true;
      btn.textContent = 'Working…';

      return API.transactions.checkOut(state.asset.assetId, state.employeeId, {
        locationId: state.locationId,
        notes: state.notes || ('Checked out to ' + emp.name
                + (state.dueDate ? '; expected return ' + state.dueDate : ''))
      }).then(function (result) {
        state.result = result;
        state.step = 4;
        UI.toast('Checked out', state.asset.tag + ' assigned to ' + emp.name + '.', 'success');
        render();
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Check out asset';
        UI.showFormError(err.message, page);
        UI.toast('Check-out rejected', err.message, 'danger');
      });
    });
  }

  function renderDone() {
    UI.qs('#stepper').innerHTML = STEPS.map(function (label, i) {
      return (i ? '<span class="step__arrow" aria-hidden="true">›</span>' : '')
        + '<div class="step is-done"><span class="step__num">✓</span><span>' + UI.esc(label) + '</span></div>';
    }).join('');

    var a = state.result.asset;
    // A receipt should never blank the screen, so tolerate a missing transaction.
    var txn = state.result.transaction || {};
    UI.qs('#stepBody').innerHTML = ''
      + '<div class="card__body">'
      +   '<div class="alert alert--success"><span class="alert__icon" aria-hidden="true">✓</span>'
      +     '<div class="alert__body"><div class="alert__title">Check-out complete</div>'
      +     UI.esc(a.tag) + ' is now assigned to ' + UI.esc(a.custodianName) + ' at ' + UI.esc(a.locationName) + '.'
      +     '</div></div>'
      +   '<div class="dl mt-4">'
      +     item('Transaction ID', txn.transactionId || 'Not recorded')
      +     item('Recorded at', txn.timestamp ? UI.fmtDateTime(txn.timestamp) : '—')
      +     item('Recorded by', Auth.user().name)
      +   '</div>'
      +   '<div class="form-actions">'
      +     '<a class="btn" href="assets.html">Back to assets</a>'
      +     '<div class="spacer"></div>'
      +     '<button class="btn" type="button" id="againBtn">Check out another</button>'
      +     '<a class="btn btn--primary" href="asset-detail.html?id=' + UI.esc(a.assetId) + '">View asset</a>'
      +   '</div>'
      + '</div>';

    UI.qs('#againBtn').addEventListener('click', function () {
      state = { step: 1, asset: null, employeeId: '', locationId: '', dueDate: '', notes: '', result: null };
      UI.clearErrors(page);
      API.assets.list({ status: D.AssetStatus.AVAILABLE }).then(function (rows) {
        available = rows;
        render();
      });
    });
  }
})();
