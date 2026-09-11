
(function () {
  'use strict';

  var page = UI.mountShell({ active: 'assets', title: 'Create Asset' });
  if (!page) { return; }

  if (!Auth.can('asset.create')) {
    page.innerHTML = '<div class="page-head"><div class="page-head__text"><h1>Create asset</h1></div></div>'
      + UI.denied('asset creation');
    return;
  }

  var D = window.MockData;

  page.innerHTML = ''
    + '<div class="breadcrumb"><a href="assets.html">Assets</a><span>/</span>New asset</div>'
    + '<div class="page-head">'
    +   '<div class="page-head__text">'
    +     '<h1>Create asset</h1>'
    +     '<div class="page-head__sub">Register a uniquely tagged item. New assets start with status AVAILABLE.</div>'
    +   '</div>'
    + '</div>'
    + '<div id="formBanner" class="mb-4"></div>'
    + '<form class="card" id="assetForm" novalidate>'
    +   '<div class="card__body">'

    +     '<fieldset class="fieldset">'
    +       '<legend class="fieldset__legend">Identification</legend>'
    +       '<div class="form-grid">'
    +         textField('tag', 'Asset tag', true, 'IT-10045', 'Printed on the barcode or QR label. Must be unique.')
    +         textField('name', 'Asset name', true, 'Panasonic Toughbook FZ-55', 'Model or common name used by crews.')
    +         selectField('category', 'Category', UI.selectOptions(D.CATEGORIES, 'code', 'name', 'IT'))
    +         textField('serialNumber', 'Serial number', false, 'FZ55-8842119', 'Manufacturer serial, if available.')
    +       '</div>'
    +     '</fieldset>'

    +     '<fieldset class="fieldset">'
    +       '<legend class="fieldset__legend">Assignment</legend>'
    +       '<div class="form-grid">'
    +         selectField('locationId', 'Home location', '')
    +         selectField('condition', 'Condition', UI.selectOptions(D.CONDITIONS, null, null, 'NEW'))
    +       '</div>'
    +       '<div class="alert alert--info mt-4"><span class="alert__icon" aria-hidden="true">i</span>'
    +         '<div class="alert__body">A new asset has no custodian. Assign it to an employee through the '
    +         '<a href="checkout.html">check-out workflow</a> so the assignment is recorded as a transaction.</div></div>'
    +     '</fieldset>'

    +     '<fieldset class="fieldset">'
    +       '<legend class="fieldset__legend">Purchase &amp; warranty</legend>'
    +       '<div class="form-grid">'
    +         dateField('purchaseDate', 'Purchase date')
    +         numberField('purchaseCost', 'Purchase cost (USD)', '0.00')
    +         dateField('warrantyEnd', 'Warranty end date')
    +       '</div>'
    +     '</fieldset>'

    +     '<fieldset class="fieldset" style="margin-bottom:0">'
    +       '<legend class="fieldset__legend">Notes</legend>'
    +       '<div class="form-grid form-grid--single">'
    +         '<div class="field"><label class="field__label" for="notes">Internal notes</label>'
    +         '<textarea id="notes" name="notes" placeholder="Accessories included, inspection intervals, restrictions…"></textarea>'
    +         '<span class="field__hint">Visible to any user who can view this asset.</span></div>'
    +       '</div>'
    +     '</fieldset>'

    +     '<div class="form-actions">'
    +       '<a class="btn" href="assets.html">Cancel</a>'
    +       '<div class="spacer"></div>'
    +       '<label class="check"><input type="checkbox" id="createAnother"> <span>Create another after saving</span></label>'
    +       '<button class="btn btn--primary" type="submit" id="submitBtn">Create asset</button>'
    +     '</div>'
    +   '</div>'
    + '</form>';

  function wrap(name, label, required, control, hint) {
    return '<div class="field">'
      + '<label class="field__label" for="' + name + '">' + UI.esc(label)
      + (required ? ' <span class="req" aria-hidden="true">*</span>' : '') + '</label>'
      + control
      + (hint ? '<span class="field__hint">' + UI.esc(hint) + '</span>' : '')
      + '<span class="field__error" role="alert"><span aria-hidden="true">✕</span><span class="msg"></span></span>'
      + '</div>';
  }

  function textField(name, label, required, placeholder, hint) {
    return wrap(name, label, required,
      '<input type="text" id="' + name + '" name="' + name + '" placeholder="' + UI.esc(placeholder || '') + '"'
      + (required ? ' aria-required="true"' : '') + ' autocomplete="off">', hint);
  }

  function numberField(name, label, placeholder) {
    return wrap(name, label, false,
      '<input type="number" id="' + name + '" name="' + name + '" min="0" step="0.01" placeholder="'
      + UI.esc(placeholder || '') + '">');
  }

  function dateField(name, label) {
    return wrap(name, label, false, '<input type="date" id="' + name + '" name="' + name + '">');
  }

  function selectField(name, label, options) {
    return wrap(name, label, false, '<select id="' + name + '" name="' + name + '">' + options + '</select>');
  }

  function setError(name, message) {
    var input = UI.qs('[name="' + name + '"]');
    var field = input.closest('.field');
    field.classList.add('has-error');
    field.classList.remove('is-valid');
    UI.qs('.field__error .msg', field).textContent = message;
    return input;
  }

  function clearError(name) {
    var input = UI.qs('[name="' + name + '"]');
    var field = input.closest('.field');
    field.classList.remove('has-error');
  }

  function markValid(name) {
    var input = UI.qs('[name="' + name + '"]');
    input.closest('.field').classList.add('is-valid');
  }

  UI.qs('#tag').addEventListener('blur', function (e) {
    var value = e.target.value.trim();
    if (!value) { return; }
    API.assets.getByTag(value)
      .then(function (existing) {
        setError('tag', 'Asset with tag ' + existing.tag + ' already exists (' + existing.name + ').');
      })
      .catch(function () { clearError('tag'); markValid('tag'); });
  });

  ['tag', 'name'].forEach(function (n) {
    UI.qs('#' + n).addEventListener('input', function () { clearError(n); });
  });

  UI.qs('#assetForm').addEventListener('submit', function (e) {
    e.preventDefault();
    UI.clearErrors(page);

    var dto = {
      tag: UI.qs('#tag').value.trim(),
      name: UI.qs('#name').value.trim(),
      category: UI.qs('#category').value,
      serialNumber: UI.qs('#serialNumber').value.trim(),
      locationId: UI.qs('#locationId').value,
      condition: UI.qs('#condition').value,
      purchaseDate: UI.qs('#purchaseDate').value,
      purchaseCost: UI.qs('#purchaseCost').value,
      warrantyEnd: UI.qs('#warrantyEnd').value,
      notes: UI.qs('#notes').value.trim()
    };

    if (!dto.tag)  { setError('tag', 'Asset tag is required.').focus(); return; }
    if (!dto.name) { setError('name', 'Asset name is required.').focus(); return; }
    if (dto.warrantyEnd && dto.purchaseDate && dto.warrantyEnd < dto.purchaseDate) {
      setError('warrantyEnd', 'Warranty end cannot be earlier than the purchase date.').focus();
      return;
    }

    var btn = UI.qs('#submitBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    API.assets.create(dto).then(function (asset) {
      UI.toast('Asset created', asset.tag + ' registered with status AVAILABLE.', 'success');
      if (UI.qs('#createAnother').checked) {
        UI.qs('#assetForm').reset();
        UI.qsa('.field').forEach(function (f) { f.classList.remove('is-valid', 'has-error'); });
        UI.qs('#tag').focus();
        btn.disabled = false;
        btn.textContent = 'Create asset';
      } else {
        window.location.href = 'asset-detail.html?id=' + encodeURIComponent(asset.assetId);
      }
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = 'Create asset';
      if (err.field) {
        setError(err.field, err.message).focus();
      } else {
        UI.showFormError(err.message, page);
      }
    });
  });

  // The form is built before the API answers, so the home-location list is
  // filled in when it arrives - empty until then, rather than offering ids the
  // API would reject.
  API.reference.locations().then(function (locs) {
    UI.qs('#locationId').innerHTML = UI.selectOptions(locs, 'locationId', 'name');
  });

  UI.qs('#tag').focus();
})();
