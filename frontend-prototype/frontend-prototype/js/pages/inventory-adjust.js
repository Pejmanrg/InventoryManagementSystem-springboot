/* ==========================================================================
   pages/inventory-adjust.js - Screen 9: Inventory adjustment
   --------------------------------------------------------------------------
   Maps to InventoryService.adjustQuantity() (CSC-03). The screen shows the
   resulting quantity before anything is committed and blocks a change that
   would drive stock below zero - the same guard the service enforces
   (requirement REQ-INV-02, test case TC-09).
   ========================================================================== */

(function () {
  'use strict';

  var page = UI.mountShell({ active: 'adjust', title: 'Inventory Adjustment' });
  if (!page) { return; }

  if (!Auth.can('inventory.adjust')) {
    page.innerHTML = '<div class="page-head"><div class="page-head__text"><h1>Adjust quantity</h1></div></div>'
      + UI.denied('inventory adjustments');
    return;
  }

  var D = window.MockData;
  var items = [];
  var selected = null;

  page.innerHTML = ''
    + '<div class="breadcrumb"><a href="inventory.html">Inventory</a><span>/</span>Adjust quantity</div>'
    + '<div class="page-head">'
    +   '<div class="page-head__text">'
    +     '<h1>Adjust quantity</h1>'
    +     '<div class="page-head__sub">Record a receipt, issue, correction, or scrap against a stocked item.</div>'
    +   '</div>'
    + '</div>'
    + '<div id="formBanner" class="mb-4"></div>'
    + '<div class="grid grid--split">'
    +   '<section class="card">'
    +     '<div class="card__head"><h2>Adjustment</h2></div>'
    +     '<div class="card__body" id="formHost">' + UI.loading('Loading items…') + '</div>'
    +   '</section>'
    +   '<div class="stack">'
    +     '<section class="card"><div class="card__head"><h2>Item summary</h2></div>'
    +       '<div class="card__body" id="summaryHost">'
    +         '<div class="small muted">Select an item to see its current position.</div></div></section>'
    +     '<section class="card"><div class="card__head"><h2>Recent adjustments</h2></div>'
    +       '<div class="card__body card__body--flush" id="recentHost"></div></section>'
    +   '</div>'
    + '</div>';

  Promise.all([API.inventory.list({}), API.inventory.adjustments(null, 8)]).then(function (r) {
    items = r[0];
    renderForm();
    renderRecent(r[1]);

    var preselect = UI.param('itemId');
    if (preselect) {
      UI.qs('#itemId').value = preselect;
      onItemChange();
    }
  }).catch(function (err) {
    UI.qs('#formHost').innerHTML = '<div class="alert alert--danger"><div class="alert__body">'
      + UI.esc(err.message) + '</div></div>';
  });

  /* ---------------------------------------------------------------- form */

  function renderForm() {
    UI.qs('#formHost').innerHTML = ''
      + '<form id="adjForm" novalidate>'
      +   '<div class="form-grid form-grid--single">'
      +     '<div class="field">'
      +       '<label class="field__label" for="itemId">Inventory item <span class="req">*</span></label>'
      +       '<select id="itemId" name="itemId" aria-required="true">'
      +         '<option value="">Select an item</option>'
      +         items.map(function (i) {
                  return '<option value="' + UI.esc(i.inventoryItemId) + '">' + UI.esc(i.sku)
                    + ' — ' + UI.esc(i.description) + ' (' + i.quantityOnHand + ' ' + UI.esc(i.uom) + ')</option>';
                }).join('')
      +       '</select>'
      +       '<span class="field__error" role="alert"><span aria-hidden="true">✕</span><span class="msg"></span></span>'
      +     '</div>'
      +   '</div>'

      +   '<div class="form-grid mt-4">'
      +     '<div class="field">'
      +       '<label class="field__label" for="direction">Direction <span class="req">*</span></label>'
      +       '<select id="direction" name="direction">'
      +         '<option value="-1">Decrease (issue, scrap, correction)</option>'
      +         '<option value="1">Increase (receipt, return to stock)</option>'
      +       '</select>'
      +     '</div>'
      +     '<div class="field">'
      +       '<label class="field__label" for="amount">Quantity <span class="req">*</span></label>'
      +       '<input type="number" id="amount" name="delta" min="1" step="1" placeholder="0" aria-required="true">'
      +       '<span class="field__hint" id="uomHint">Whole units.</span>'
      +       '<span class="field__error" role="alert"><span aria-hidden="true">✕</span><span class="msg"></span></span>'
      +     '</div>'
      +     '<div class="field">'
      +       '<label class="field__label" for="reason">Reason <span class="req">*</span></label>'
      +       '<select id="reason" name="reason" aria-required="true">'
      +         UI.selectOptions(D.ADJUSTMENT_REASONS, 'code', 'label', 'ISSUE_TO_JOB', 'Select a reason')
      +       '</select>'
      +       '<span class="field__error" role="alert"><span aria-hidden="true">✕</span><span class="msg"></span></span>'
      +     '</div>'
      +     '<div class="field">'
      +       '<label class="field__label" for="reference">Reference</label>'
      +       '<input type="text" id="reference" name="reference" placeholder="JOB-2291 or PO-8841">'
      +       '<span class="field__hint">Job, purchase order, or cycle-count number.</span>'
      +     '</div>'
      +     '<div class="field field--full">'
      +       '<label class="field__label" for="notes">Notes</label>'
      +       '<textarea id="notes" name="notes" placeholder="Explain the change for the audit record"></textarea>'
      +     '</div>'
      +   '</div>'

      +   '<div id="preview" class="mt-4"></div>'

      +   '<div class="form-actions">'
      +     '<a class="btn" href="inventory.html">Cancel</a>'
      +     '<div class="spacer"></div>'
      +     '<button class="btn btn--primary" type="submit" id="submitBtn">Review adjustment</button>'
      +   '</div>'
      + '</form>';

    UI.qs('#itemId').addEventListener('change', onItemChange);
    UI.qs('#amount').addEventListener('input', renderPreview);
    UI.qs('#direction').addEventListener('change', renderPreview);
    UI.qs('#adjForm').addEventListener('submit', onSubmit);
  }

  function onItemChange() {
    var id = UI.qs('#itemId').value;
    selected = items.filter(function (i) { return i.inventoryItemId === id; })[0] || null;
    UI.qs('#itemId').closest('.field').classList.remove('has-error');
    UI.qs('#uomHint').textContent = selected
      ? 'Quantity in ' + selected.uom + '. Current on hand: ' + selected.quantityOnHand + '.'
      : 'Whole units.';
    renderSummary();
    renderPreview();
  }

  function renderSummary() {
    var host = UI.qs('#summaryHost');
    if (!selected) {
      host.innerHTML = '<div class="small muted">Select an item to see its current position.</div>';
      return;
    }
    host.innerHTML = '<div class="dl" style="grid-template-columns:1fr 1fr">'
      + dl('SKU', selected.sku)
      + dl('On hand', UI.fmtNumber(selected.quantityOnHand) + ' ' + selected.uom)
      + dl('Reorder point', UI.fmtNumber(selected.reorderPoint) + ' ' + selected.uom)
      + dl('Location', selected.locationName)
      + dl('Last counted', UI.fmtDate(selected.lastCountedAt))
      + '<div class="dl__item"><div class="dl__term">State</div><div class="dl__val">'
        + UI.stockBadge(selected.stockState) + '</div></div>'
      + '</div>'
      + '<div class="mt-4 small muted">' + UI.esc(selected.description) + '</div>';
  }

  function dl(term, value) {
    return '<div class="dl__item"><div class="dl__term">' + UI.esc(term) + '</div>'
      + '<div class="dl__val">' + UI.esc(value) + '</div></div>';
  }

  function currentDelta() {
    var amount = Number(UI.qs('#amount').value);
    var dir = Number(UI.qs('#direction').value);
    if (!isFinite(amount) || amount <= 0) { return null; }
    return dir * amount;
  }

  /** Live preview - shows the resulting balance and blocks negative stock. */
  function renderPreview() {
    var host = UI.qs('#preview');
    var delta = currentDelta();
    if (!selected || delta === null) { host.innerHTML = ''; return; }

    var after = selected.quantityOnHand + delta;

    if (after < 0) {
      host.innerHTML = '<div class="alert alert--danger"><span class="alert__icon" aria-hidden="true">✕</span>'
        + '<div class="alert__body"><div class="alert__title">This adjustment would create negative stock</div>'
        + 'On hand is ' + UI.fmtNumber(selected.quantityOnHand) + ' ' + UI.esc(selected.uom)
        + '. The largest decrease allowed is ' + UI.fmtNumber(selected.quantityOnHand) + '.</div></div>';
      return;
    }

    var crossesReorder = after < selected.reorderPoint && selected.quantityOnHand >= selected.reorderPoint;
    host.innerHTML = '<div class="alert alert--' + (after === 0 ? 'warning' : 'info') + '">'
      + '<span class="alert__icon" aria-hidden="true">=</span><div class="alert__body">'
      + '<div class="alert__title">Resulting quantity: ' + UI.fmtNumber(after) + ' ' + UI.esc(selected.uom) + '</div>'
      + UI.fmtNumber(selected.quantityOnHand) + ' ' + (delta > 0 ? '+ ' + delta : '− ' + Math.abs(delta))
      + ' = ' + UI.fmtNumber(after)
      + (after === 0 ? '. This item will be out of stock.'
         : (crossesReorder ? '. This drops the item below its reorder point of '
            + UI.fmtNumber(selected.reorderPoint) + '.' : '.'))
      + '</div></div>';
  }

  /* -------------------------------------------------------------- submit */

  function fieldError(id, message) {
    var el = UI.qs('#' + id);
    var f = el.closest('.field');
    f.classList.add('has-error');
    UI.qs('.field__error .msg', f).textContent = message;
    el.focus();
  }

  function onSubmit(e) {
    e.preventDefault();
    UI.clearErrors(page);

    if (!selected) { return fieldError('itemId', 'Select the inventory item to adjust.'); }

    var delta = currentDelta();
    if (delta === null) { return fieldError('amount', 'Enter an adjustment quantity greater than zero.'); }

    var reason = UI.qs('#reason').value;
    if (!reason) { return fieldError('reason', 'An adjustment reason is required.'); }

    var after = selected.quantityOnHand + delta;
    if (after < 0) {
      return fieldError('amount', 'Adjustment failed: stock cannot be negative. On hand '
        + selected.quantityOnHand + '.');
    }

    var reasonLabel = D.ADJUSTMENT_REASONS.filter(function (r) { return r.code === reason; })[0].label;
    var reference = UI.qs('#reference').value.trim();

    UI.confirm({
      title: 'Confirm inventory adjustment',
      message: 'Quantity changes are permanent and are written to the audit history with your user name.',
      summary: [
        { label: 'Item', value: selected.sku },
        { label: 'Change', value: (delta > 0 ? '+' : '') + delta + ' ' + selected.uom },
        { label: 'On hand after', value: UI.fmtNumber(after) + ' ' + selected.uom },
        { label: 'Reason', value: reasonLabel },
        { label: 'Reference', value: reference || '—' }
      ],
      warning: after === 0 ? 'This item will be left with zero quantity on hand.' : '',
      confirmLabel: 'Post adjustment'
    }).then(function (ok) {
      if (!ok) { return; }
      var btn = UI.qs('#submitBtn');
      btn.disabled = true;
      btn.textContent = 'Posting…';

      return API.inventory.adjust(selected.inventoryItemId, delta, {
        reason: reason,
        reference: reference,
        notes: UI.qs('#notes').value.trim()
      }).then(function (result) {
        UI.toast('Adjustment posted',
          result.item.sku + ': ' + result.previousQuantity + ' → ' + result.item.quantityOnHand
          + ' ' + result.item.uom + '.', 'success');

        return Promise.all([API.inventory.list({}), API.inventory.adjustments(null, 8)]).then(function (r) {
          items = r[0];
          renderForm();
          renderRecent(r[1]);
          UI.qs('#itemId').value = result.item.inventoryItemId;
          onItemChange();
        });
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Review adjustment';
        if (err.field === 'delta') { fieldError('amount', err.message); }
        else if (err.field === 'reason') { fieldError('reason', err.message); }
        else { UI.showFormError(err.message, page); }
        UI.toast('Adjustment rejected', err.message, 'danger');
      });
    });
  }

  /* ------------------------------------------------------------- recent */

  function renderRecent(list) {
    UI.qs('#recentHost').innerHTML = list.length
      ? '<div class="table-wrap"><table class="data responsive"><thead><tr>'
        + '<th scope="col">When</th><th scope="col">SKU</th><th class="num" scope="col">Change</th>'
        + '<th class="num" scope="col">After</th><th scope="col">Reason</th><th scope="col">By</th>'
        + '</tr></thead><tbody>'
        + list.map(function (a) {
            return '<tr>'
              + '<td data-label="When">' + UI.esc(UI.fmtRelative(a.timestamp)) + '</td>'
              + '<td data-label="SKU"><span class="mono">' + UI.esc(a.sku) + '</span></td>'
              + '<td class="num" data-label="Change"><span class="cell-strong" style="color:'
                + (a.delta > 0 ? 'var(--c-success)' : 'var(--c-danger)') + '">'
                + (a.delta > 0 ? '+' : '') + UI.fmtNumber(a.delta) + '</span></td>'
              + '<td class="num" data-label="After">' + UI.fmtNumber(a.quantityAfter) + '</td>'
              + '<td data-label="Reason">' + UI.esc(UI.titleCase(a.reason))
                + (a.reference ? '<div class="cell-sub">' + UI.esc(a.reference) + '</div>' : '') + '</td>'
              + '<td data-label="By">' + UI.esc(a.performedByName) + '</td>'
              + '</tr>';
          }).join('')
        + '</tbody></table></div>'
      : UI.emptyState('No adjustments yet', 'Posted adjustments appear here and in the audit history.');
  }
})();
