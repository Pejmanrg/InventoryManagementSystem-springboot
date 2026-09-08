/* ==========================================================================
   pages/inventory.js - Screen 8: Inventory list
   --------------------------------------------------------------------------
   Quantity-managed stock. Maps to InventoryService.getStock() and the
   inventory side of CSC-03. Reorder point drives the stock-state badge and
   feeds ReportService.lowStock().
   ========================================================================== */

(function () {
  'use strict';

  var page = UI.mountShell({ active: 'inventory', title: 'Inventory' });
  if (!page) { return; }

  var D = window.MockData;
  var filters = {
    query: UI.param('query') || '',
    locationId: UI.param('locationId') || '',
    category: UI.param('category') || '',
    stockState: UI.param('stockState') || ''
  };
  var rows = [];

  var CATEGORIES = D.INVENTORY.reduce(function (acc, i) {
    if (acc.indexOf(i.category) === -1) { acc.push(i.category); }
    return acc;
  }, []).sort();

  page.innerHTML = ''
    + '<div class="page-head">'
    +   '<div class="page-head__text">'
    +     '<h1>Inventory</h1>'
    +     '<div class="page-head__sub">Consumables and materials tracked by quantity on hand.</div>'
    +   '</div>'
    +   '<div class="page-head__actions">'
    +     (Auth.can('report.export') ? '<button class="btn" type="button" id="exportBtn">Export</button>' : '')
    +     (Auth.can('inventory.adjust')
          ? '<a class="btn btn--primary" href="inventory-adjust.html">Adjust quantity</a>' : '')
    +   '</div>'
    + '</div>'
    + '<div class="grid grid--kpi mb-4" id="tiles"></div>'
    + '<section class="card">'
    +   '<form class="toolbar" id="filterForm" role="search">'
    +     '<div class="field field--wide"><label class="field__label" for="fQuery">Search</label>'
    +       '<input type="search" id="fQuery" placeholder="SKU or description" value="' + UI.esc(filters.query) + '"></div>'
    +     '<div class="field"><label class="field__label" for="fState">Stock state</label>'
    +       '<select id="fState">'
    +         '<option value="">All items</option>'
    +         '<option value="OK">In stock</option>'
    +         '<option value="LOW">Low stock</option>'
    +         '<option value="CRITICAL">Out of stock</option>'
    +       '</select></div>'
    +     '<div class="field"><label class="field__label" for="fCategory">Category</label>'
    +       '<select id="fCategory">' + UI.selectOptions(CATEGORIES, null, null, filters.category, 'All categories') + '</select></div>'
    +     '<div class="field"><label class="field__label" for="fLocation">Location</label>'
    +       '<select id="fLocation">' + UI.selectOptions(D.LOCATIONS, 'locationId', 'name', filters.locationId, 'All locations') + '</select></div>'
    +     '<div class="field" style="flex:0 0 auto"><span class="field__label">&nbsp;</span>'
    +       '<button class="btn" type="button" id="clearBtn">Clear</button></div>'
    +     '<div class="spacer"></div>'
    +     '<div class="toolbar__count" id="resultCount" aria-live="polite"></div>'
    +   '</form>'
    +   '<div id="tableHost">' + UI.loading('Loading inventory…') + '</div>'
    + '</section>';

  UI.qs('#fState').value = filters.stockState;

  function load() {
    UI.qs('#tableHost').innerHTML = UI.loading('Loading inventory…');
    Promise.all([API.inventory.list(filters), API.inventory.list({})]).then(function (r) {
      rows = r[0];
      renderTiles(r[1]);
      renderTable();
    }).catch(function (err) {
      UI.qs('#tableHost').innerHTML = '<div class="card__body"><div class="alert alert--danger">'
        + '<div class="alert__body">' + UI.esc(err.message) + '</div></div></div>';
    });
  }

  function renderTiles(all) {
    var low = all.filter(function (i) { return i.stockState === 'LOW'; }).length;
    var out = all.filter(function (i) { return i.stockState === 'CRITICAL'; }).length;
    var value = all.reduce(function (s, i) { return s + i.extendedValue; }, 0);

    var tiles = [
      tile('Tracked SKUs', UI.fmtNumber(all.length), 'Across all stock locations', 'accent'),
      tile('Below reorder point', UI.fmtNumber(low), 'Replenishment recommended', low ? 'warn' : 'ok'),
      tile('Out of stock', UI.fmtNumber(out), 'Zero quantity on hand', out ? 'danger' : 'ok')
    ];
    if (Auth.can('report.view.all')) {
      tiles.push(tile('Extended value', UI.fmtMoneyShort(value), 'Quantity on hand × unit cost', ''));
    }
    UI.qs('#tiles').innerHTML = tiles.join('');
  }

  function tile(label, value, meta, variant) {
    return '<div class="card kpi' + (variant ? ' kpi--' + variant : '') + '">'
      + '<div class="kpi__label">' + UI.esc(label) + '</div>'
      + '<div class="kpi__value">' + UI.esc(value) + '</div>'
      + '<div class="kpi__meta">' + UI.esc(meta) + '</div></div>';
  }

  function renderTable() {
    UI.qs('#resultCount').textContent = rows.length + (rows.length === 1 ? ' item' : ' items');

    if (!rows.length) {
      UI.qs('#tableHost').innerHTML = UI.emptyState('No inventory items match',
        'Adjust the search text or clear the filters.',
        '<button class="btn" type="button" id="emptyClear">Clear filters</button>');
      UI.qs('#emptyClear').addEventListener('click', clearFilters);
      return;
    }

    var showValue = Auth.can('report.view.all');

    UI.qs('#tableHost').innerHTML = '<div class="table-wrap"><table class="data responsive"><thead><tr>'
      + '<th scope="col">SKU</th><th scope="col">Description</th><th scope="col">Location</th>'
      + '<th class="num" scope="col">On hand</th><th class="num" scope="col">Reorder at</th>'
      + '<th scope="col">State</th>'
      + (showValue ? '<th class="num" scope="col">Value</th>' : '')
      + '<th scope="col"><span class="visually-hidden">Actions</span></th>'
      + '</tr></thead><tbody>'
      + rows.map(function (i) {
          return '<tr>'
            + '<td data-label="SKU"><span class="cell-strong mono">' + UI.esc(i.sku) + '</span></td>'
            + '<td class="wrap" data-label="Description">' + UI.esc(i.description)
            +   '<div class="cell-sub">' + UI.esc(i.category) + '</div></td>'
            + '<td data-label="Location">' + UI.esc(i.locationName) + '</td>'
            + '<td class="num" data-label="On hand"><span class="cell-strong">' + UI.fmtNumber(i.quantityOnHand)
            +   '</span> <span class="subtle xsmall">' + UI.esc(i.uom) + '</span></td>'
            + '<td class="num" data-label="Reorder at">' + UI.fmtNumber(i.reorderPoint) + '</td>'
            + '<td data-label="State">' + UI.stockBadge(i.stockState) + '</td>'
            + (showValue ? '<td class="num" data-label="Value">' + UI.fmtMoney(i.extendedValue) + '</td>' : '')
            + '<td class="actions" data-label="">'
            +   (Auth.can('inventory.adjust')
                ? '<a class="btn btn--sm" href="inventory-adjust.html?itemId=' + UI.esc(i.inventoryItemId) + '">Adjust</a>'
                : '<span class="subtle xsmall">View only</span>')
            + '</td></tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  function syncFromForm() {
    filters.query = UI.qs('#fQuery').value;
    filters.stockState = UI.qs('#fState').value;
    filters.category = UI.qs('#fCategory').value;
    filters.locationId = UI.qs('#fLocation').value;
    load();
  }

  function clearFilters() {
    UI.qs('#fQuery').value = '';
    UI.qs('#fState').value = '';
    UI.qs('#fCategory').value = '';
    UI.qs('#fLocation').value = '';
    syncFromForm();
  }

  var debounce;
  UI.qs('#fQuery').addEventListener('input', function () {
    clearTimeout(debounce);
    debounce = setTimeout(syncFromForm, 220);
  });
  ['#fState', '#fCategory', '#fLocation'].forEach(function (sel) {
    UI.qs(sel).addEventListener('change', syncFromForm);
  });
  UI.qs('#clearBtn').addEventListener('click', clearFilters);
  UI.qs('#filterForm').addEventListener('submit', function (e) { e.preventDefault(); syncFromForm(); });

  var exportBtn = UI.qs('#exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      UI.confirm({
        title: 'Export inventory',
        message: 'The current filter selection will be exported as CSV and the export is written to the audit history.',
        summary: [{ label: 'Rows in export', value: String(rows.length) }],
        confirmLabel: 'Export CSV'
      }).then(function (ok) {
        if (ok) { UI.toast('Export queued', rows.length + ' rows. File delivery is mocked in this prototype.', 'success'); }
      });
    });
  }

  load();
})();
