
(function () {
  'use strict';

  var page = UI.mountShell({ active: 'assets', title: 'Assets' });
  if (!page) { return; }

  var D = window.MockData;
  var filters = {
    query: UI.param('query') || '',
    status: UI.param('status') || '',
    locationId: UI.param('locationId') || '',
    category: UI.param('category') || ''
  };
  var sort = { key: 'tag', dir: 1 };
  var rows = [];

  page.innerHTML = ''
    + '<div class="page-head">'
    +   '<div class="page-head__text">'
    +     '<h1>Assets</h1>'
    +     '<div class="page-head__sub">Uniquely tagged equipment, vehicles, and IT hardware.</div>'
    +   '</div>'
    +   '<div class="page-head__actions">'
    +     (Auth.can('report.export') ? '<button class="btn" type="button" id="exportBtn">Export</button>' : '')
    +     (Auth.can('asset.create') ? '<a class="btn btn--primary" href="asset-new.html">Create asset</a>' : '')
    +   '</div>'
    + '</div>'
    + '<section class="card">'
    +   '<form class="toolbar" id="filterForm" role="search">'
    +     field('Search', '<input type="search" name="query" id="fQuery" placeholder="Tag, name, or serial number" value="'
            + UI.esc(filters.query) + '">', 'field--wide')
    +     field('Status', '<select name="status" id="fStatus">'
            + UI.selectOptions(Object.keys(D.AssetStatus), null, null, filters.status, 'All statuses') + '</select>')
    +     field('Location', '<select name="locationId" id="fLocation">'
            + UI.selectOptions(D.LOCATIONS, 'locationId', 'name', filters.locationId, 'All locations') + '</select>')
    +     field('Category', '<select name="category" id="fCategory">'
            + UI.selectOptions(D.CATEGORIES, 'code', 'name', filters.category, 'All categories') + '</select>')
    +     '<div class="field" style="flex:0 0 auto"><span class="field__label">&nbsp;</span>'
    +       '<button class="btn" type="button" id="clearBtn">Clear</button></div>'
    +     '<div class="spacer"></div>'
    +     '<div class="toolbar__count" id="resultCount" aria-live="polite"></div>'
    +   '</form>'
    +   '<div id="tableHost">' + UI.loading('Loading assets…') + '</div>'
    + '</section>';

  function field(label, control, extra) {
    return '<div class="field ' + (extra || '') + '">'
      + '<label class="field__label">' + UI.esc(label) + '</label>' + control + '</div>';
  }

  function load() {
    UI.qs('#tableHost').innerHTML = UI.loading('Loading assets…');
    API.assets.list(filters).then(function (result) {
      rows = result;
      renderTable();
    }).catch(function (err) {
      UI.qs('#tableHost').innerHTML = '<div class="card__body"><div class="alert alert--danger">'
        + '<div class="alert__body">' + UI.esc(err.message) + '</div></div></div>';
    });
  }

  function sorted() {
    return rows.slice().sort(function (a, b) {
      var x = a[sort.key], y = b[sort.key];
      if (x === null || x === undefined) { x = ''; }
      if (y === null || y === undefined) { y = ''; }
      return String(x).localeCompare(String(y), undefined, { numeric: true }) * sort.dir;
    });
  }

  function renderTable() {
    UI.qs('#resultCount').textContent = rows.length + (rows.length === 1 ? ' asset' : ' assets');

    if (!rows.length) {
      UI.qs('#tableHost').innerHTML = UI.emptyState(
        'No assets match these filters',
        'Adjust the search text or clear the filters to see more results.',
        '<button class="btn" type="button" id="emptyClear">Clear filters</button>');
      var ec = UI.qs('#emptyClear');
      if (ec) { ec.addEventListener('click', clearFilters); }
      return;
    }

    var cols = [
      { key: 'tag', label: 'Tag' },
      { key: 'name', label: 'Asset' },
      { key: 'status', label: 'Status' },
      { key: 'locationName', label: 'Location' },
      { key: 'custodianName', label: 'Custodian' },
      { key: 'lastTransactionAt', label: 'Last activity' }
    ];

    UI.qs('#tableHost').innerHTML = '<div class="table-wrap"><table class="data responsive">'
      + '<thead><tr>'
      + cols.map(function (c) {
          var ind = sort.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : '';
          return '<th class="sortable" data-key="' + c.key + '" scope="col">' + UI.esc(c.label)
            + '<span class="sort-ind">' + ind + '</span></th>';
        }).join('')
      + '<th scope="col"><span class="visually-hidden">Actions</span></th>'
      + '</tr></thead><tbody>'
      + sorted().map(function (a) {
          return '<tr>'
            + td('Tag', '<a class="row-link" href="asset-detail.html?id=' + UI.esc(a.assetId) + '">' + UI.esc(a.tag) + '</a>')
            + td('Asset', '<span class="cell-strong">' + UI.esc(a.name) + '</span>'
                 + '<div class="cell-sub">' + UI.esc(a.categoryName)
                 + (a.serialNumber ? ' · S/N ' + UI.esc(a.serialNumber) : '') + '</div>')
            + td('Status', UI.badge(a.status))
            + td('Location', UI.esc(a.locationName))
            + td('Custodian', a.custodianName ? UI.esc(a.custodianName) : '<span class="subtle">—</span>')
            + td('Last activity', UI.esc(UI.fmtRelative(a.lastTransactionAt)))
            + '<td class="actions" data-label="">' + rowActions(a) + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';

    UI.qsa('#tableHost th.sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.dataset.key;
        sort.dir = (sort.key === key) ? -sort.dir : 1;
        sort.key = key;
        renderTable();
      });
    });
  }

  function td(label, html) {
    return '<td data-label="' + UI.esc(label) + '">' + html + '</td>';
  }

  function rowActions(a) {
    var S = D.AssetStatus;
    if (a.status === S.AVAILABLE && Auth.can('asset.checkout')) {
      return '<a class="btn btn--sm" href="checkout.html?assetId=' + UI.esc(a.assetId) + '">Check out</a>';
    }
    if (a.status === S.CHECKED_OUT && Auth.can('asset.checkin')) {
      return '<a class="btn btn--sm" href="checkin.html?assetId=' + UI.esc(a.assetId) + '">Check in</a>';
    }
    return '<a class="btn btn--sm" href="asset-detail.html?id=' + UI.esc(a.assetId) + '">Open</a>';
  }

  function syncFromForm() {
    filters.query = UI.qs('#fQuery').value;
    filters.status = UI.qs('#fStatus').value;
    filters.locationId = UI.qs('#fLocation').value;
    filters.category = UI.qs('#fCategory').value;
    load();
  }

  function clearFilters() {
    UI.qs('#fQuery').value = '';
    UI.qs('#fStatus').value = '';
    UI.qs('#fLocation').value = '';
    UI.qs('#fCategory').value = '';
    syncFromForm();
  }

  var debounce;
  UI.qs('#fQuery').addEventListener('input', function () {
    clearTimeout(debounce);
    debounce = setTimeout(syncFromForm, 220);
  });
  ['#fStatus', '#fLocation', '#fCategory'].forEach(function (sel) {
    UI.qs(sel).addEventListener('change', syncFromForm);
  });
  UI.qs('#clearBtn').addEventListener('click', clearFilters);
  UI.qs('#filterForm').addEventListener('submit', function (e) { e.preventDefault(); syncFromForm(); });

  var exportBtn = UI.qs('#exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      UI.confirm({
        title: 'Export filtered assets',
        message: 'The current filter selection will be exported as CSV. Exports are recorded in the audit history.',
        summary: [
          { label: 'Rows in export', value: String(rows.length) },
          { label: 'Status filter', value: filters.status || 'All statuses' },
          { label: 'Location filter', value: locationName(filters.locationId) }
        ],
        confirmLabel: 'Export CSV'
      }).then(function (ok) {
        if (!ok) { return; }
        UI.toast('Export queued', rows.length + ' rows. File delivery is mocked in this prototype.', 'success');
      });
    });
  }

  function locationName(id) {
    if (!id) { return 'All locations'; }
    var l = D.LOCATIONS.filter(function (x) { return x.locationId === id; })[0];
    return l ? l.name : id;
  }

  load();
})();
