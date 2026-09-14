
(function () {
  'use strict';

  var page = UI.mountShell({ active: 'dashboard', title: 'Dashboard' });
  if (!page) { return; }

  var user = Auth.user();
  var role = Auth.role();

  page.innerHTML = ''
    + '<div class="page-head">'
    +   '<div class="page-head__text">'
    +     '<h1>Good day, ' + UI.esc(user.name.split(' ')[0]) + '</h1>'
    +     '<div class="page-head__sub">' + UI.esc(role.name) + ' · ' + UI.esc(user.site) + '</div>'
    +   '</div>'
    +   '<div class="page-head__actions" id="quickActions"></div>'
    + '</div>'
    + '<div id="kpis" class="grid grid--kpi mb-4">' + UI.loading('Loading summary…') + '</div>'
    + '<div class="grid grid--split">'
    +   '<div class="stack" id="colMain"></div>'
    +   '<div class="stack" id="colSide"></div>'
    + '</div>';

  var actions = [];
  if (Auth.can('asset.checkout')) { actions.push('<a class="btn btn--primary" href="checkout.html">Check out asset</a>'); }
  if (Auth.can('asset.checkin'))  { actions.push('<a class="btn" href="checkin.html">Check in asset</a>'); }
  if (Auth.can('inventory.adjust')) { actions.push('<a class="btn" href="inventory-adjust.html">Adjust quantity</a>'); }
  if (Auth.can('asset.create'))   { actions.push('<a class="btn" href="asset-new.html">New asset</a>'); }
  if (!actions.length && Auth.can('report.view.all')) { actions.push('<a class="btn btn--primary" href="reports.html">Open reports</a>'); }
  UI.qs('#quickActions').innerHTML = actions.join('');

  Promise.all([
    API.reports.summary(),
    API.transactions.recent(8),
    API.reports.lowStock(),
    API.assets.list({ custodianEmployeeId: user.employeeId })
  ]).then(function (results) {
    var s = results[0], recent = results[1], low = results[2], mine = results[3];

    var tiles = [
      tile('Total assets', UI.fmtNumber(s.assetTotal), s.available + ' available · ' + s.checkedOut + ' checked out', 'accent'),
      tile('Checked out', UI.fmtNumber(s.checkedOut), 'Currently assigned to employees', ''),
      tile('In maintenance', UI.fmtNumber(s.maintenance), 'Out of service for repair', s.maintenance ? 'warn' : 'ok'),
      tile('Low / out of stock', UI.fmtNumber(s.lowStock + s.outOfStock),
           s.outOfStock + ' SKUs at zero on hand', (s.lowStock + s.outOfStock) ? 'danger' : 'ok')
    ];
    if (Auth.can('report.view.all')) {
      tiles.push(tile('Inventory value', UI.fmtMoneyShort(s.inventoryValue), s.inventorySkus + ' tracked SKUs', ''));
    }
    if (s.lost) {
      tiles.push(tile('Reported lost', UI.fmtNumber(s.lost), 'Awaiting recovery or write-off', 'danger'));
    }
    UI.qs('#kpis').innerHTML = tiles.join('');

    var main = [];

    main.push(card('Asset status distribution', ''
      + '<div class="bars">'
      + UI.bar('Available', s.available, s.assetTotal, 'success')
      + UI.bar('Checked out', s.checkedOut, s.assetTotal, 'info')
      + UI.bar('In maintenance', s.maintenance, s.assetTotal, 'warning')
      + UI.bar('Lost', s.lost, s.assetTotal, 'danger')
      + UI.bar('Retired', s.retired, s.assetTotal, '')
      + '</div>',
      '<a class="btn btn--sm" href="assets.html">View all assets</a>'));

    main.push(card('Recent transaction activity',
      recent.length
        ? '<ul class="timeline">' + recent.map(function (t) {
            return '<li><span class="timeline__when">' + UI.esc(UI.fmtRelative(t.timestamp)) + '</span>'
              + '<span class="timeline__body">' + UI.badge(t.type) + ' '
              + '<a href="asset-detail.html?id=' + UI.esc(t.assetId) + '"><strong>' + UI.esc(t.assetTag) + '</strong></a> '
              + UI.esc(t.assetName)
              + (t.employeeName && t.employeeName !== '-' ? ' · ' + UI.esc(t.employeeName) : '')
              + (t.notes ? '<div class="xsmall subtle">' + UI.esc(t.notes) + '</div>' : '')
              + '</span></li>';
          }).join('') + '</ul>'
        : UI.emptyState('No activity yet', 'Transactions appear here as equipment moves.'),
      Auth.can('audit.view') ? '<a class="btn btn--sm" href="audit.html">Open audit history</a>' : '',
      true));

    UI.qs('#colMain').innerHTML = main.join('');

    var side = [];

    if (mine.length) {
      side.push(card('Assigned to you (' + mine.length + ')',
        '<ul class="timeline">' + mine.map(function (a) {
          return '<li><span class="timeline__body"><a href="asset-detail.html?id=' + UI.esc(a.assetId) + '">'
            + '<strong>' + UI.esc(a.tag) + '</strong></a> ' + UI.esc(a.name)
            + '<div class="xsmall subtle">' + UI.esc(a.locationName) + '</div></span>'
            + '<span class="timeline__when">' + UI.badge(a.status) + '</span></li>';
        }).join('') + '</ul>',
        Auth.can('asset.checkin') ? '<a class="btn btn--sm" href="checkin.html">Check something in</a>' : '',
        true));
    }

    side.push(card('Reorder attention (' + low.length + ')',
      low.length
        ? '<ul class="timeline">' + low.slice(0, 6).map(function (i) {
            return '<li><span class="timeline__body"><strong>' + UI.esc(i.sku) + '</strong>'
              + '<div class="xsmall subtle">' + UI.esc(i.description) + '</div></span>'
              + '<span class="timeline__when text-right">' + UI.fmtNumber(i.quantityOnHand) + ' ' + UI.esc(i.uom)
              + '<div>' + UI.stockBadge(i.stockState) + '</div></span></li>';
          }).join('') + '</ul>'
        : UI.emptyState('Stock levels are healthy', 'No SKU is below its reorder point.'),
      '<a class="btn btn--sm" href="inventory.html?stockState=LOW">Review inventory</a>',
      true));

    UI.qs('#colSide').innerHTML = side.join('');
  }).catch(function (err) {
    page.innerHTML = '<div class="alert alert--danger"><div class="alert__body">'
      + UI.esc(err.message) + '</div></div>';
  });

  function tile(label, value, meta, variant) {
    return '<div class="card kpi' + (variant ? ' kpi--' + variant : '') + '">'
      + '<div class="kpi__label">' + UI.esc(label) + '</div>'
      + '<div class="kpi__value">' + UI.esc(value) + '</div>'
      + '<div class="kpi__meta">' + UI.esc(meta) + '</div></div>';
  }

  function card(title, body, action, flush) {
    return '<section class="card">'
      + '<div class="card__head"><h2>' + UI.esc(title) + '</h2><div class="spacer"></div>' + (action || '') + '</div>'
      + '<div class="card__body' + (flush ? ' card__body--flush' : '') + '">' + body + '</div>'
      + '</section>';
  }
})();
