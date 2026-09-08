/* ==========================================================================
   api.js - Live API layer (Phase 1)
   --------------------------------------------------------------------------
   This is the ONLY file that screens talk to for data. Every function is
   asynchronous and returns a Promise. No screen code changed when this file
   was switched from mock data to the deployed Spring Boot service.

   WHAT IS LIVE  - calls https://inventory-api-...run.app over HTTP Basic:
     auth          sign-in validated against the real API
     assets        AssetController        /api/assets
     transactions  AssetLifecycleController + TransactionController
     inventory     InventoryController    /api/inventory
     audit         AuditController        /api/audit
     reports       computed client-side from live assets / inventory / locations
     admin.lookups locations come from /api/locations
     admin.users   UserController         /api/users (ADMIN only)
     invitations   InvitationController   /api/invitations, /api/password-reset
                                          - the only unauthenticated calls

   WHAT IS STILL MOCKED - no backend exists for these yet (Phase 2):
     maintenance   work orders   - no MaintenanceController / WorkOrder entity
     reports.maintenanceDue      - depends on work orders
     admin.integrations / purchaseOrders

   Mocked functions still read and write the in-browser Store, so those screens
   behave exactly as they did in the prototype. They are marked MOCK below.

   Business rules are now enforced by the Java service layer, not here. This
   file no longer duplicates them - it surfaces the server's error responses as
   ApiError so the screens' existing error handling keeps working.
   ========================================================================== */

(function (global) {
  'use strict';

  /* ============================================================== CONFIG */

  /** Deployed Cloud Run service. Change this one line to point elsewhere. */
  var API_BASE = 'https://inventory-api-173479193959.us-west2.run.app';

  /**
   * Marks a call that must carry no Authorization header at all.
   *
   * Not the same as simply having no session. Spring's Basic authentication
   * filter runs before the authorization rules, so a stale or wrong credential
   * left in sessionStorage is rejected with 401 even on a path the server
   * permits anonymously - which would break the password-reset page for exactly
   * the person most likely to have a wrong credential saved.
   */
  var ANONYMOUS = { anonymous: true };

  /** Page size used for screens that render a full list rather than paging. */
  var PAGE_SIZE = 500;

  /* ============================================================== HELPERS */

  /** Mirrors a Spring `ProblemDetail` / ApiErrorResponse. Unchanged contract. */
  function ApiError(status, message, field) {
    this.name = 'ApiError';
    this.status = status;     // 400 | 401 | 403 | 404 | 409
    this.message = message;
    this.field = field || null;
  }
  ApiError.prototype = Object.create(Error.prototype);

  function db() { return global.Store.load(); }
  function commit() { global.Store.persist(); }
  function nowIso() { return new Date().toISOString().slice(0, 19); }
  function clone(v) { return global.Store.clone(v); }

  function byId(list, key, value) {
    for (var i = 0; i < list.length; i++) {
      if (list[i][key] === value) { return list[i]; }
    }
    return null;
  }

  function contains(haystack, needle) {
    return String(haystack || '').toLowerCase().indexOf(needle) !== -1;
  }

  function currentUserId() {
    var s = global.Store.getSession();
    return s ? s.userId : 'system';
  }

  /** The Basic credential is kept on the session object Store already persists. */
  function authHeader() {
    var s = global.Store.getSession();
    return s && s.basic ? ('Basic ' + s.basic) : null;
  }

  function buildQuery(params) {
    if (!params) { return ''; }
    var parts = [];
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') { return; }
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? ('?' + parts.join('&')) : '';
  }

  /**
   * Single point of contact with the API.
   *
   * Translates a non-2xx response into ApiError using the server's
   * ApiErrorResponse body (status, message, fieldErrors[0].field) so screens
   * keep showing field-level validation exactly as they did against the mock.
   */
  function http(method, path, body, params, credentialOverride) {
    var headers = { 'Accept': 'application/json' };
    var cred = credentialOverride === ANONYMOUS ? null : (credentialOverride || authHeader());
    if (cred) { headers['Authorization'] = cred; }
    if (body !== undefined && body !== null) {
      headers['Content-Type'] = 'application/json';
    }

    var init = { method: method, headers: headers, mode: 'cors' };
    if (body !== undefined && body !== null) { init.body = JSON.stringify(body); }

    return global.fetch(API_BASE + path + buildQuery(params), init)
      .then(function (res) {
        if (res.status === 204) { return null; }

        return res.text().then(function (text) {
          var payload = null;
          if (text) {
            try { payload = JSON.parse(text); } catch (e) { payload = null; }
          }

          if (res.ok) { return payload; }

          if (res.status === 401) {
            throw new ApiError(401, 'Your session is not valid. Please sign in again.');
          }
          if (res.status === 403) {
            throw new ApiError(403, 'Your role does not permit this action.');
          }

          var message = (payload && payload.message)
            || (payload && payload.error)
            || ('Request failed (' + res.status + ').');
          var field = null;
          if (payload && payload.fieldErrors && payload.fieldErrors.length) {
            field = payload.fieldErrors[0].field;
            message = payload.fieldErrors[0].message || message;
          }
          throw new ApiError(res.status, message, field);
        });
      }, function (networkError) {
        /* fetch() rejects only on network / CORS failure, never on HTTP status. */
        throw new ApiError(0,
          'Cannot reach the inventory service. Check your connection and that the API is running.');
      });
  }

  /** PageResponse<T> -> plain array; bare List<T> passes through untouched. */
  function unwrap(payload) {
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'content')
        && Array.isArray(payload.content)) {
      return payload.content;
    }
    return Array.isArray(payload) ? payload : [];
  }

  /* ------------------------------------------------- reference data cache */
  /* Locations and employees are small, change rarely, and are needed to
     decorate rows the API returns by id only. Fetched once per page load. */

  var cache = { locations: null, employees: null };

  function locations() {
    if (cache.locations) { return Promise.resolve(cache.locations); }
    return http('GET', '/api/locations').then(function (rows) {
      cache.locations = unwrap(rows);
      return cache.locations;
    });
  }

  function employees() {
    if (cache.employees) { return Promise.resolve(cache.employees); }
    return http('GET', '/api/employees').then(function (rows) {
      cache.employees = unwrap(rows);
      return cache.employees;
    });
  }

  function invalidateCache() { cache.locations = null; cache.employees = null; }

  /**
   * The API supplies locationName and custodianName already. It does not supply
   * locationCode or categoryName, which some screens render, so those are
   * derived here - falling back to the raw code rather than showing blanks.
   */
  function decorateAsset(a, locs) {
    if (!a) { return a; }
    var loc = locs ? byId(locs, 'locationId', a.locationId) : null;
    var cat = byId(global.MockData.CATEGORIES || [], 'code', a.category);
    a.locationName = a.locationName || (loc ? loc.name : 'Unassigned');
    a.locationCode = loc ? loc.code : '-';
    a.categoryName = cat ? cat.name : a.category;
    a.custodianName = a.custodianName || null;
    return a;
  }

  /* ================================================================= AUTH */
  /* LIVE. The backend uses HTTP Basic, so "signing in" means proving the
     credential works and then keeping it for subsequent requests. There is no
     session endpoint and no token to obtain - GET /api/users/me is called as a
     cheap probe that every authenticated role may make, and it answers the one
     question the UI cannot answer for itself: which role am I? Before this
     endpoint existed the role was guessed from the username, which was only
     ever correct for the four accounts in application.yml. */

  var auth = {
    /**
     * Validates username + password against the API, then stores the
     * credential on the session so every later request can send it.
     *
     * The credential is held in sessionStorage via Store, which means it is
     * gone when the tab closes and never written to localStorage. It is still
     * readable by any script on this origin - acceptable for Basic auth in
     * Phase 1, and the reason Phase 3 moves to a short-lived OIDC token.
     */
    signIn: function (username, password) {
      username = String(username || '').trim();
      password = String(password == null ? '' : password);

      if (!username) {
        return Promise.reject(new ApiError(400, 'Enter your username.', 'username'));
      }
      if (!password) {
        return Promise.reject(new ApiError(400, 'Enter your password.', 'password'));
      }

      var basic;
      try {
        /* btoa handles Latin-1 only; encodeURIComponent/unescape widens it so a
           non-ASCII password does not throw before it reaches the server. */
        basic = global.btoa(unescape(encodeURIComponent(username + ':' + password)));
      } catch (e) {
        return Promise.reject(new ApiError(400, 'That username or password contains characters the browser cannot encode.'));
      }

      return http('GET', '/api/users/me', null, null, 'Basic ' + basic)
        .then(function (me) {
          me = me || {};
          /* The server is the only authority on role. An unrecognised value
             falls back to the least-privileged role rather than an empty menu;
             the server re-checks every action either way, so a wrong guess here
             can only ever hide something, never permit it. */
          var role = global.MockData.ROLES[me.role] ? me.role : 'FIELD';
          var session = {
            userId: me.userId || username,
            username: me.username || username,
            name: me.displayName || me.username || username,
            email: me.email || '',
            jobTitle: me.jobTitle || '',
            role: role,
            /* Null for a configured break-glass account: it has no row in
               app_users, so there is no /api/users/{id} profile to open. */
            accountId: me.userId || null,
            employeeId: null,
            site: '',
            signedInAt: nowIso(),
            basic: basic
          };
          global.Store.setSession(session);
          invalidateCache();
          return clone(session);
        })
        .catch(function (err) {
          if (err.status === 401) {
            throw new ApiError(401, 'Incorrect username or password.', 'password');
          }
          if (err.status === 403) {
            throw new ApiError(403, 'That account is not permitted to use this application.');
          }
          throw err;
        });
    },

    signOut: function () {
      global.Store.clearSession();
      invalidateCache();
      return Promise.resolve(true);
    },

    session: function () { return global.Store.getSession(); }
  };

  /* =============================================================== ASSETS */
  /* LIVE - AssetController /api/assets */

  var assets = {
    /** GET /api/assets */
    list: function (params) {
      params = params || {};
      var query = { page: 0, size: PAGE_SIZE };
      if (params.query) { query.query = params.query; }
      if (params.status) { query.status = params.status; }
      if (params.locationId) { query.locationId = params.locationId; }
      if (params.category) { query.category = params.category; }

      return Promise.all([http('GET', '/api/assets', null, query), locations()])
        .then(function (results) {
          var rows = unwrap(results[0]);
          var locs = results[1];
          var q = String(params.query || '').trim().toLowerCase();

          /* Filtered again client-side: the server's parameter names are not
             guaranteed to match every filter the screens send, and an ignored
             query parameter would silently return unfiltered rows. */
          return rows.filter(function (a) {
            if (params.status && a.status !== params.status) { return false; }
            if (params.locationId && a.locationId !== params.locationId) { return false; }
            if (params.category && a.category !== params.category) { return false; }
            if (params.custodianEmployeeId && a.custodianEmployeeId !== params.custodianEmployeeId) { return false; }
            if (!q) { return true; }
            return contains(a.name, q) || contains(a.tag, q) || contains(a.serialNumber, q);
          }).map(function (a) { return decorateAsset(a, locs); });
        });
    },

    /** GET /api/assets/{assetId} */
    get: function (assetId) {
      return Promise.all([http('GET', '/api/assets/' + encodeURIComponent(assetId)), locations()])
        .then(function (r) { return decorateAsset(r[0], r[1]); });
    },

    /** GET /api/assets/by-tag/{tag} - barcode / QR lookup */
    getByTag: function (tag) {
      return Promise.all([
        http('GET', '/api/assets/by-tag/' + encodeURIComponent(String(tag || '').trim())),
        locations()
      ]).then(function (r) { return decorateAsset(r[0], r[1]); });
    },

    /** POST /api/assets - validation is now enforced by the Java service. */
    create: function (dto) {
      var body = {
        tag: dto.tag,
        name: dto.name,
        category: dto.category || 'TOOL',
        serialNumber: dto.serialNumber || null,
        locationId: dto.locationId || null,
        condition: dto.condition || 'NEW',
        purchaseDate: dto.purchaseDate || null,
        purchaseCost: (dto.purchaseCost === '' || dto.purchaseCost == null) ? null : Number(dto.purchaseCost),
        warrantyEnd: dto.warrantyEnd || null,
        notes: dto.notes || null
      };
      return Promise.all([http('POST', '/api/assets', body), locations()])
        .then(function (r) { return decorateAsset(r[0], r[1]); });
    },

    /** PUT /api/assets/{assetId} - MANAGER or ADMIN only. */
    update: function (assetId, dto) {
      var body = {};
      ['name', 'category', 'serialNumber', 'condition', 'notes', 'locationId'].forEach(function (k) {
        if (dto[k] !== undefined && dto[k] !== '') { body[k] = dto[k]; }
      });
      return Promise.all([
        http('PUT', '/api/assets/' + encodeURIComponent(assetId), body),
        locations()
      ]).then(function (r) { return decorateAsset(r[0], r[1]); });
    },

    /** GET /api/assets/{assetId}/history - returns a bare List. */
    history: function (assetId) {
      return http('GET', '/api/assets/' + encodeURIComponent(assetId) + '/history')
        .then(unwrap);
    }
  };

  /* ========================================================= TRANSACTIONS */
  /* LIVE - AssetLifecycleController. Note the lifecycle endpoints return the
     updated AssetResponse only, not the transaction that caused it. The mock
     returned { asset, transaction }; that shape is preserved with a null
     transaction so calling screens do not break. Screens that displayed the
     returned transaction should read the asset's history instead. */

  function lifecycle(assetId, action, body) {
    return Promise.all([
      http('POST', '/api/assets/' + encodeURIComponent(assetId) + '/' + action, body || {}),
      locations()
    ]).then(function (r) {
      return { asset: decorateAsset(r[0], r[1]), transaction: null };
    });
  }

  var transactions = {
    /** POST /api/assets/{assetId}/checkout */
    checkOut: function (assetId, employeeId, options) {
      options = options || {};
      if (!employeeId) {
        return Promise.reject(new ApiError(400, 'A receiving employee is required for checkout.', 'employeeId'));
      }
      return lifecycle(assetId, 'checkout', {
        employeeId: employeeId,
        locationId: options.locationId || null,
        notes: options.notes || 'Checked out to employee'
      });
    },

    /** POST /api/assets/{assetId}/checkin, then /maintenance if requested. */
    checkIn: function (assetId, options) {
      options = options || {};
      return lifecycle(assetId, 'checkin', {
        locationId: options.locationId || null,
        condition: options.condition || null,
        notes: options.notes || 'Returned'
      }).then(function (result) {
        if (!options.sendToMaintenance) {
          result.workOrder = null;
          return result;
        }
        /* Two calls because the backend models these as separate transitions. */
        return lifecycle(assetId, 'maintenance', {
          notes: options.maintenanceTitle || 'Service required after check-in'
        }).then(function (afterMaintenance) {
          afterMaintenance.workOrder = null; // work orders are Phase 2
          return afterMaintenance;
        });
      });
    },

    /** POST /api/assets/{assetId}/move */
    move: function (assetId, locationId, notes) {
      if (!locationId) {
        return Promise.reject(new ApiError(400, 'A destination location is required.', 'locationId'));
      }
      return lifecycle(assetId, 'move', { locationId: locationId, notes: notes || 'Location transfer' });
    },

    /** POST /api/assets/{assetId}/retire  (the mock called this dispose) */
    dispose: function (assetId, notes) {
      return lifecycle(assetId, 'retire', { notes: notes || 'Disposed' });
    },

    /** POST /api/assets/{assetId}/recover */
    recover: function (assetId, notes) {
      return lifecycle(assetId, 'recover', { notes: notes || 'Recovered' });
    },

    /** POST /api/assets/{assetId}/lost  (the mock called this markLost) */
    markLost: function (assetId, notes) {
      return lifecycle(assetId, 'lost', { notes: notes || 'Reported lost' });
    },

    /** GET /api/transactions - recent activity feed, PageResponse. */
    recent: function (limit) {
      return http('GET', '/api/transactions', null, { page: 0, size: limit || 10 })
        .then(function (payload) {
          return unwrap(payload).map(function (t) {
            /* TransactionResponse carries assetTag but not assetName. */
            t.assetName = t.assetName || t.assetTag || '-';
            t.employeeName = t.employeeName || '-';
            return t;
          });
        });
    }
  };

  /* ============================================================ INVENTORY */
  /* LIVE - InventoryController. stockState and extendedValue are computed
     server-side in InventoryItemResponse, so nothing is recomputed here. */

  function normaliseItem(i) {
    if (!i) { return i; }
    /* The prototype screens read `uom`; the DTO field is unitOfMeasure. */
    i.uom = i.uom || i.unitOfMeasure || '';
    return i;
  }

  var inventory = {
    /** GET /api/inventory */
    list: function (params) {
      params = params || {};
      var query = { page: 0, size: PAGE_SIZE };
      if (params.query) { query.query = params.query; }
      if (params.locationId) { query.locationId = params.locationId; }
      if (params.category) { query.category = params.category; }

      return http('GET', '/api/inventory', null, query).then(function (payload) {
        var q = String(params.query || '').trim().toLowerCase();
        return unwrap(payload).map(normaliseItem).filter(function (i) {
          if (params.locationId && i.locationId !== params.locationId) { return false; }
          if (params.category && i.category !== params.category) { return false; }
          if (params.stockState && i.stockState !== params.stockState) { return false; }
          if (!q) { return true; }
          return contains(i.sku, q) || contains(i.description, q);
        });
      });
    },

    /** GET /api/inventory/{itemId} */
    get: function (itemId) {
      return http('GET', '/api/inventory/' + encodeURIComponent(itemId)).then(normaliseItem);
    },

    /**
     * POST /api/inventory/{itemId}/adjust
     *
     * Returns AdjustmentResponse { item, previousQuantity, delta, newQuantity,
     * reason, reference }. Reshaped to the mock's { item, adjustment,
     * previousQuantity } so screens keep working.
     */
    adjust: function (itemId, delta, meta) {
      meta = meta || {};
      var d = Number(delta);
      if (!isFinite(d) || d === 0) {
        return Promise.reject(new ApiError(400, 'Enter an adjustment quantity other than zero.', 'delta'));
      }
      if (!meta.reason) {
        return Promise.reject(new ApiError(400, 'An adjustment reason is required.', 'reason'));
      }

      return http('POST', '/api/inventory/' + encodeURIComponent(itemId) + '/adjust', {
        delta: d,
        reason: meta.reason,
        reference: meta.reference || null,
        notes: meta.notes || null
      }).then(function (r) {
        return {
          item: normaliseItem(r.item),
          previousQuantity: Number(r.previousQuantity),
          adjustment: {
            adjustmentId: null,
            inventoryItemId: itemId,
            delta: Number(r.delta),
            reason: r.reason,
            reference: r.reference || '',
            quantityAfter: Number(r.newQuantity),
            timestamp: nowIso(),
            performedBy: currentUserId(),
            notes: meta.notes || ''
          }
        };
      });
    },

    /**
     * MOCK. There is no GET /api/inventory/{id}/adjustments endpoint; the
     * adjustment ledger is only visible through the audit trail in Phase 1.
     * Falls back to filtering audit events for this item.
     */
    adjustments: function (itemId, limit) {
      return auditApi.search({ entityType: 'INVENTORY', action: 'INVENTORY_ADJUST' })
        .then(function (events) {
          return events
            .filter(function (e) { return !itemId || e.entityId === String(itemId); })
            .slice(0, limit || 200)
            .map(function (e) {
              return {
                adjustmentId: e.eventId,
                inventoryItemId: e.entityId,
                timestamp: e.timestamp,
                performedByName: e.actorName,
                performedBy: e.actor,
                reason: '',
                reference: '',
                sku: '-',
                description: e.summary,
                uom: '',
                delta: null,
                quantityAfter: null
              };
            });
        });
    }
  };

  /* ================================================================ AUDIT */
  /* LIVE - AuditController. AuditEventResponse uses occurredAt, not timestamp,
     and carries no actor display name or IP; those are filled in here. */

  var auditApi = {
    /** GET /api/audit */
    search: function (params) {
      params = params || {};
      var query = { page: 0, size: PAGE_SIZE };
      if (params.action) { query.action = params.action; }
      if (params.outcome) { query.outcome = params.outcome; }
      if (params.entityType) { query.entityType = params.entityType; }
      if (params.from) { query.from = params.from; }
      if (params.to) { query.to = params.to; }

      return http('GET', '/api/audit', null, query).then(function (payload) {
        var q = String(params.query || '').trim().toLowerCase();
        return unwrap(payload).map(function (e) {
          e.timestamp = e.timestamp || e.occurredAt;
          e.actorName = e.actor;
          e.ip = e.ip || '-';
          return e;
        }).filter(function (e) {
          if (params.action && e.action !== params.action) { return false; }
          if (params.outcome && e.outcome !== params.outcome) { return false; }
          if (params.entityType && e.entityType !== params.entityType) { return false; }
          if (!q) { return true; }
          return contains(e.summary, q) || contains(e.action, q) || contains(e.entityId, q);
        }).sort(function (x, y) {
          return String(y.timestamp).localeCompare(String(x.timestamp));
        });
      });
    },

    /** Client-side CSV build - there is no export endpoint. */
    exportCsv: function (rows) {
      return Promise.resolve((function () {
        var header = 'timestamp,actor,action,entityType,entityId,outcome,summary';
        var body = rows.map(function (r) {
          return [r.timestamp, r.actorName, r.action, r.entityType, r.entityId, r.outcome,
                  '"' + String(r.summary).replace(/"/g, '""') + '"'].join(',');
        }).join('\n');
        return header + '\n' + body;
      })());
    }
  };

  /* ========================================================== MAINTENANCE */
  /* MOCK - no MaintenanceController, WorkOrder entity or table exists yet.
     These read and write the in-browser Store exactly as the prototype did.
     Delete this block and point at /api/work-orders once Phase 2 lands. */

  function createWorkOrderInternal(dto) {
    var s = db();
    var year = new Date().getFullYear();
    var seqNo = 143 + s.workOrders.filter(function (w) { return w.number.indexOf('WO-' + year) === 0; }).length;
    var wo = {
      workOrderId: global.Store.nextId('wo'),
      number: 'WO-' + year + '-' + String(seqNo).padStart(4, '0'),
      assetId: dto.assetId || null,
      title: dto.title,
      type: dto.type || 'CORRECTIVE',
      priority: dto.priority || 'MEDIUM',
      status: 'OPEN',
      assignedTo: dto.assignedTo || null,
      vendor: dto.vendor || 'In-house',
      openedAt: nowIso(),
      dueDate: dto.dueDate || '',
      closedAt: null,
      estimatedCost: dto.estimatedCost ? Number(dto.estimatedCost) : 0,
      notes: dto.notes || ''
    };
    s.workOrders.unshift(wo);
    commit();
    return clone(wo);
  }

  function decorateWorkOrder(w) {
    var emp = w.assignedTo ? byId(global.MockData.EMPLOYEES, 'employeeId', w.assignedTo) : null;
    var out = clone(w);
    out.assetTag = '-';
    out.assetName = w.assetId ? 'Asset ' + w.assetId : 'Not asset-specific';
    out.assignedToName = emp ? emp.name : 'Unassigned';
    out.overdue = !!(w.dueDate && w.status !== 'CLOSED' && w.dueDate < nowIso().slice(0, 10));
    return out;
  }

  function mockRespond(producer) {
    return new Promise(function (resolve, reject) {
      global.setTimeout(function () {
        try { resolve(producer()); } catch (err) { reject(err); }
      }, 120);
    });
  }

  var maintenance = {
    /** MOCK */
    list: function (params) {
      params = params || {};
      return mockRespond(function () {
        var q = String(params.query || '').trim().toLowerCase();
        return db().workOrders.map(decorateWorkOrder).filter(function (w) {
          if (params.status && w.status !== params.status) { return false; }
          if (params.priority && w.priority !== params.priority) { return false; }
          if (params.type && w.type !== params.type) { return false; }
          if (!q) { return true; }
          return contains(w.number, q) || contains(w.title, q);
        });
      });
    },

    /** MOCK */
    create: function (dto) {
      return mockRespond(function () {
        if (!dto.title || !String(dto.title).trim()) {
          throw new ApiError(400, 'A work order title is required.', 'title');
        }
        var wo = createWorkOrderInternal(dto);
        return decorateWorkOrder(byId(db().workOrders, 'workOrderId', wo.workOrderId));
      }).then(function (wo) {
        /* If the work order takes the asset out of service, that transition IS
           backed by the API, so it is applied for real. */
        if (dto.assetId && dto.takeOutOfService) {
          return lifecycle(dto.assetId, 'maintenance', { notes: dto.title })
            .then(function () { return wo; })
            .catch(function () { return wo; });
        }
        return wo;
      });
    },

    /** MOCK */
    update: function (workOrderId, dto) {
      return mockRespond(function () {
        var w = byId(db().workOrders, 'workOrderId', workOrderId);
        if (!w) { throw new ApiError(404, 'Work order not found: ' + workOrderId); }
        ['title', 'priority', 'status', 'assignedTo', 'vendor', 'dueDate', 'notes'].forEach(function (k) {
          if (dto[k] !== undefined && dto[k] !== '') { w[k] = dto[k]; }
        });
        commit();
        return decorateWorkOrder(w);
      });
    },

    /** MOCK */
    close: function (workOrderId, options) {
      options = options || {};
      return mockRespond(function () {
        var s = db();
        var w = byId(s.workOrders, 'workOrderId', workOrderId);
        if (!w) { throw new ApiError(404, 'Work order not found: ' + workOrderId); }
        if (w.status === 'CLOSED') { throw new ApiError(409, w.number + ' is already closed.'); }
        w.status = 'CLOSED';
        w.closedAt = nowIso();
        if (options.notes) { w.notes = options.notes; }
        commit();
        return decorateWorkOrder(w);
      });
    }
  };

  /* ============================================================== REPORTS */
  /* Computed from LIVE data, except maintenanceDue which needs work orders. */

  var reports = {
    /** Aggregated from GET /api/assets + GET /api/locations. */
    assetsBySite: function () {
      return Promise.all([assets.list({}), locations()]).then(function (r) {
        var rows = r[0];
        return r[1].map(function (loc) {
          var mine = rows.filter(function (a) { return a.locationId === loc.locationId; });
          function count(st) { return mine.filter(function (a) { return a.status === st; }).length; }
          return {
            locationId: loc.locationId,
            locationName: loc.name,
            type: loc.type,
            total: mine.length,
            available: count('AVAILABLE'),
            checkedOut: count('CHECKED_OUT'),
            maintenance: count('MAINTENANCE'),
            other: count('LOST') + count('RETIRED')
          };
        }).sort(function (x, y) { return y.total - x.total; });
      });
    },

    /** Aggregated from GET /api/assets + GET /api/employees. */
    assetsByEmployee: function () {
      return Promise.all([assets.list({}), employees()]).then(function (r) {
        var rows = r[0];
        return r[1].map(function (emp) {
          var mine = rows.filter(function (a) { return a.custodianEmployeeId === emp.employeeId; });
          return {
            employeeId: emp.employeeId,
            name: emp.name,
            title: emp.jobTitle,
            site: emp.homeLocationName,
            count: mine.length,
            value: Number(mine.reduce(function (sum, a) { return sum + (Number(a.purchaseCost) || 0); }, 0).toFixed(2)),
            tags: mine.map(function (a) { return a.tag; })
          };
        }).filter(function (x) { return x.count > 0; })
          .sort(function (x, y) { return y.count - x.count; });
      });
    },

    /** stockState is computed server-side; this just filters. */
    lowStock: function () {
      return inventory.list({}).then(function (items) {
        return items.filter(function (i) { return i.stockState !== 'OK'; })
          .sort(function (x, y) {
            var rx = Number(x.reorderPoint) || 1, ry = Number(y.reorderPoint) || 1;
            return (Number(x.quantityOnHand) / rx) - (Number(y.quantityOnHand) / ry);
          });
      });
    },

    /** MOCK - work orders are Phase 2. */
    maintenanceDue: function () {
      return maintenance.list({}).then(function (rows) {
        return rows.filter(function (w) { return w.status !== 'CLOSED'; })
          .sort(function (x, y) { return String(x.dueDate).localeCompare(String(y.dueDate)); });
      });
    },

    /** Dashboard tiles. Asset and inventory figures are live; work-order and
        purchase-order figures still come from the Store. */
    summary: function () {
      return Promise.all([assets.list({}), inventory.list({})]).then(function (r) {
        var rows = r[0], items = r[1], s = db();
        function count(st) { return rows.filter(function (a) { return a.status === st; }).length; }
        return {
          assetTotal: rows.length,
          available: count('AVAILABLE'),
          checkedOut: count('CHECKED_OUT'),
          maintenance: count('MAINTENANCE'),
          lost: count('LOST'),
          retired: count('RETIRED'),
          inventorySkus: items.length,
          lowStock: items.filter(function (i) { return i.stockState === 'LOW'; }).length,
          outOfStock: items.filter(function (i) { return i.stockState === 'CRITICAL'; }).length,
          inventoryValue: Number(items.reduce(function (sum, i) {
            return sum + (Number(i.extendedValue) || 0);
          }, 0).toFixed(2)),
          openWorkOrders: s.workOrders.filter(function (w) { return w.status !== 'CLOSED'; }).length,
          overdueWorkOrders: s.workOrders.map(decorateWorkOrder).filter(function (w) { return w.overdue; }).length,
          openPos: s.purchaseOrders.filter(function (p) { return p.status !== 'RECEIVED'; }).length
        };
      });
    }
  };

  /* ================================================================ ADMIN */
  /* Users are LIVE - UserController /api/users, ADMIN only except /me.
     lookups.locations is LIVE. Integrations and purchase orders remain MOCK:
     no backend table exists for either in Phase 1. */

  /**
   * Adds the fields the screens display.
   *
   * The API returns an account as it is stored; `name`, `roleName`, `status`
   * and `lastSignIn` are presentation of that same data. Deriving them once
   * here keeps every screen showing a role the same way.
   */
  function decorateUser(u) {
    if (!u) { return u; }
    var role = global.MockData.ROLES[u.role];
    u.name = u.displayName || u.username;
    u.roleName = role ? role.name : u.role;
    u.status = u.active ? 'ACTIVE' : 'DISABLED';
    u.lastSignIn = u.lastLoginAt || null;
    return u;
  }

  /**
   * The exact set of fields PUT /api/users/{id} replaces.
   *
   * It is a replace, not a patch, so anything omitted here is cleared on the
   * server. Username and password are absent on purpose - neither can be
   * changed through this route.
   */
  function userProfilePayload(u, overrides) {
    var payload = {
      firstName: u.firstName || null,
      lastName: u.lastName || null,
      email: u.email || null,
      jobTitle: u.jobTitle || null,
      role: u.role,
      active: u.active
    };
    Object.keys(overrides || {}).forEach(function (k) { payload[k] = overrides[k]; });
    return payload;
  }

  var admin = {
    /** LIVE - GET /api/users */
    users: function () {
      return http('GET', '/api/users').then(function (rows) {
        return unwrap(rows).map(decorateUser);
      });
    },

    /** LIVE - GET /api/users/{id} */
    getUser: function (userId) {
      return http('GET', '/api/users/' + encodeURIComponent(userId)).then(decorateUser);
    },

    /** LIVE - GET /api/users/me. The only user endpoint any role may call. */
    me: function () {
      return http('GET', '/api/users/me').then(decorateUser);
    },

    /** LIVE - POST /api/users */
    createUser: function (payload) {
      return http('POST', '/api/users', payload).then(decorateUser);
    },

    /** LIVE - PUT /api/users/{id}. Send the whole profile; see userProfilePayload. */
    updateUser: function (userId, payload) {
      return http('PUT', '/api/users/' + encodeURIComponent(userId), payload).then(decorateUser);
    },

    /**
     * LIVE - POST /api/users/{id}/invite.
     *
     * Emails a single-use link so the account holder sets their own password.
     * `purpose` is INVITE for a new account or RESET for an existing one; they
     * differ only in wording and lifetime. Resolves to
     * { sent, sentTo, expiresAt, link } - `sent` false means mail is not
     * configured or was refused, and the link has to be passed on by hand.
     */
    invite: function (userId, purpose) {
      return http('POST', '/api/users/' + encodeURIComponent(userId) + '/invite',
        null, { purpose: purpose || 'INVITE' });
    },

    /** LIVE - POST /api/users/{id}/reset-password. Answers 204, so no body. */
    resetPassword: function (userId, newPassword) {
      return http('POST', '/api/users/' + encodeURIComponent(userId) + '/reset-password',
        { newPassword: newPassword });
    },

    /** LIVE - DELETE /api/users/{id} */
    deleteUser: function (userId) {
      return http('DELETE', '/api/users/' + encodeURIComponent(userId));
    },

    /**
     * LIVE - a role change, expressed as the profile replacement it really is.
     *
     * The current profile is read first so the other fields survive the PUT.
     * Reading first also means the server's last-administrator guard judges the
     * account's real current state rather than whatever the list happened to be
     * showing when it was last refreshed.
     */
    assignRole: function (userId, role) {
      return admin.getUser(userId).then(function (u) {
        return admin.updateUser(userId, userProfilePayload(u, { role: role }));
      });
    },

    /** LIVE - enable / disable, by the same read-then-replace as assignRole. */
    setStatus: function (userId, status) {
      return admin.getUser(userId).then(function (u) {
        return admin.updateUser(userId, userProfilePayload(u, { active: status === 'ACTIVE' }));
      });
    },

    /** MOCK */
    integrations: function () {
      return mockRespond(function () { return clone(db().integrations); });
    },

    /** Locations are LIVE; the other lists have no backend table yet. */
    lookups: function () {
      return locations().then(function (locs) {
        return {
          locations: locs,
          categories: clone(global.MockData.CATEGORIES),
          conditions: clone(global.MockData.CONDITIONS),
          adjustmentReasons: clone(global.MockData.ADJUSTMENT_REASONS)
        };
      });
    },

    /** MOCK */
    purchaseOrders: function () {
      return mockRespond(function () { return clone(db().purchaseOrders); });
    },

    /** LIVE - GET /api/employees, used by the checkout screen. */
    employees: function () { return employees(); }
  };

  /* ========================================================== INVITATIONS */
  /* LIVE and deliberately unauthenticated - InvitationController. Every caller
     here is someone who cannot sign in, so a credential is not available to
     send. Possession of a single-use token stands in for one. */

  var invitations = {
    /** GET /api/invitations/{token} - who the link belongs to, and why it exists. */
    check: function (token) {
      return http('GET', '/api/invitations/' + encodeURIComponent(token),
        null, null, ANONYMOUS);
    },

    /** POST /api/invitations/{token} - sets the password and burns the link. */
    accept: function (token, newPassword) {
      return http('POST', '/api/invitations/' + encodeURIComponent(token),
        { newPassword: newPassword }, null, ANONYMOUS);
    },

    /**
     * POST /api/password-reset - "I forgot my password".
     *
     * Resolves for every input the server accepts, including usernames that do
     * not exist. The endpoint answers 202 regardless by design; a caller that
     * distinguished the cases would undo that.
     */
    requestReset: function (usernameOrEmail) {
      return http('POST', '/api/password-reset',
        { usernameOrEmail: usernameOrEmail }, null, ANONYMOUS);
    }
  };

  /* ------------------------------------------------------------- exports */

  global.API = {
    ApiError: ApiError,
    API_BASE: API_BASE,
    auth: auth,
    assets: assets,
    transactions: transactions,
    inventory: inventory,
    maintenance: maintenance,
    reports: reports,
    admin: admin,
    audit: auditApi,
    invitations: invitations
  };
})(window);
