
(function (global) {
  'use strict';

  var API_BASE = 'https://inventory-api-173479193959.us-west2.run.app';

  var ANONYMOUS = { anonymous: true };

  var PAGE_SIZE = 500;

  function ApiError(status, message, field) {
    this.name = 'ApiError';
    this.status = status;     // 400 | 401 | 403 | 404 | 409
    this.message = message;
    this.field = field || null;
  }
  ApiError.prototype = Object.create(Error.prototype);

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
        throw new ApiError(0,
          'Cannot reach the inventory service. Check your connection and that the API is running.');
      });
  }

  function unwrap(payload) {
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'content')
        && Array.isArray(payload.content)) {
      return payload.content;
    }
    return Array.isArray(payload) ? payload : [];
  }

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

  var auth = {
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
        basic = global.btoa(unescape(encodeURIComponent(username + ':' + password)));
      } catch (e) {
        return Promise.reject(new ApiError(400, 'That username or password contains characters the browser cannot encode.'));
      }

      return http('GET', '/api/users/me', null, null, 'Basic ' + basic)
        .then(function (me) {
          me = me || {};
          var role = global.MockData.ROLES[me.role] ? me.role : 'FIELD';
          var session = {
            userId: me.userId || username,
            username: me.username || username,
            name: me.displayName || me.username || username,
            email: me.email || '',
            jobTitle: me.jobTitle || '',
            role: role,
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

  var assets = {
    list: function (params) {
      params = params || {};
      var query = { page: 0, size: PAGE_SIZE };
      if (params.query) { query.query = params.query; }
      if (params.status) { query.status = params.status; }
      if (params.locationId) { query.locationId = params.locationId; }
      if (params.category) { query.category = params.category; }

      return Promise.all([http('GET', '/api/assets', null, query), locations()])
        .then(function (results) {
          var locs = results[1];
          // Query, status, location and category are filtered by the API.
          // Custodian is not a parameter it accepts, so that one is applied here.
          return unwrap(results[0])
            .filter(function (a) {
              return !params.custodianEmployeeId
                  || a.custodianEmployeeId === params.custodianEmployeeId;
            })
            .map(function (a) { return decorateAsset(a, locs); });
        });
    },

    get: function (assetId) {
      return Promise.all([http('GET', '/api/assets/' + encodeURIComponent(assetId)), locations()])
        .then(function (r) { return decorateAsset(r[0], r[1]); });
    },

    getByTag: function (tag) {
      return Promise.all([
        http('GET', '/api/assets/by-tag/' + encodeURIComponent(String(tag || '').trim())),
        locations()
      ]).then(function (r) { return decorateAsset(r[0], r[1]); });
    },

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

    history: function (assetId) {
      return http('GET', '/api/assets/' + encodeURIComponent(assetId) + '/history')
        .then(unwrap);
    }
  };

  // The lifecycle endpoints return the updated asset, not the transaction they
  // wrote, but the check-out and check-in receipts need the transaction id. The
  // history is newest first, so the first row is the one this call just created.
  function lifecycle(assetId, action, body) {
    return http('POST', '/api/assets/' + encodeURIComponent(assetId) + '/' + action, body || {})
      .then(function (asset) {
        return Promise.all([locations(), assets.history(assetId)]).then(function (r) {
          return { asset: decorateAsset(asset, r[0]), transaction: r[1][0] || null };
        });
      });
  }

  var transactions = {
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

    checkIn: function (assetId, options) {
      options = options || {};
      return lifecycle(assetId, 'checkin', {
        locationId: options.locationId || null,
        condition: options.condition || null,
        notes: options.notes || 'Returned'
      }).then(function (result) {
        // A return flagged "needs service" is a second lifecycle call, so the
        // asset lands in MAINTENANCE instead of AVAILABLE.
        if (!options.sendToMaintenance) { return result; }
        return lifecycle(assetId, 'maintenance', {
          notes: options.notes || 'Service required after check-in'
        });
      });
    },

    move: function (assetId, locationId, notes) {
      if (!locationId) {
        return Promise.reject(new ApiError(400, 'A destination location is required.', 'locationId'));
      }
      return lifecycle(assetId, 'move', { locationId: locationId, notes: notes || 'Location transfer' });
    },

    dispose: function (assetId, notes) {
      return lifecycle(assetId, 'retire', { notes: notes || 'Disposed' });
    },

    recover: function (assetId, notes) {
      return lifecycle(assetId, 'recover', { notes: notes || 'Recovered' });
    },

    markLost: function (assetId, notes) {
      return lifecycle(assetId, 'lost', { notes: notes || 'Reported lost' });
    },

    recent: function (limit) {
      return http('GET', '/api/transactions', null, { page: 0, size: limit || 10 })
        .then(function (payload) {
          return unwrap(payload).map(function (t) {
            t.assetName = t.assetName || t.assetTag || '-';
            t.employeeName = t.employeeName || '-';
            return t;
          });
        });
    }
  };

  function normaliseItem(i) {
    if (!i) { return i; }
    i.uom = i.uom || i.unitOfMeasure || '';
    return i;
  }

  var inventory = {
    list: function (params) {
      params = params || {};
      var query = { page: 0, size: PAGE_SIZE };
      if (params.query) { query.query = params.query; }
      if (params.locationId) { query.locationId = params.locationId; }
      if (params.category) { query.category = params.category; }

      return http('GET', '/api/inventory', null, query).then(function (payload) {
        // stockState is derived from the quantity, so the API cannot filter on it.
        return unwrap(payload).map(normaliseItem).filter(function (i) {
          return !params.stockState || i.stockState === params.stockState;
        });
      });
    },

    get: function (itemId) {
      return http('GET', '/api/inventory/' + encodeURIComponent(itemId)).then(normaliseItem);
    },

    adjust: function (itemId, delta, meta) {
      meta = meta || {};
      var d = Number(delta);
      if (!isFinite(d) || d === 0) {
        return Promise.reject(new ApiError(400, 'Enter an adjustment quantity other than zero.', 'delta'));
      }
      if (Math.floor(d) !== d) {
        return Promise.reject(new ApiError(400,
          'Stock is counted in whole units - an adjustment cannot be a fraction.', 'delta'));
      }
      if (!meta.reason) {
        return Promise.reject(new ApiError(400, 'An adjustment reason is required.', 'reason'));
      }

      return http('POST', '/api/inventory/' + encodeURIComponent(itemId) + '/adjust', {
        delta: d,
        reason: meta.reason,
        reference: meta.reference || null,
        notes: meta.notes || null,
        employeeId: meta.employeeId || null
      }).then(function (r) {
        return {
          item: normaliseItem(r.item),
          previousQuantity: Number(r.previousQuantity),
          employeeName: r.employeeName || '',
          adjustment: {
            adjustmentId: null,
            inventoryItemId: itemId,
            delta: Number(r.delta),
            reason: r.reason,
            reference: r.reference || '',
            quantityAfter: Number(r.newQuantity),
            timestamp: nowIso(),
            performedBy: currentUserId(),
            employeeName: r.employeeName || '',
            notes: meta.notes || ''
          }
        };
      });
    },

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

  var auditApi = {
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


  /* Every figure below is computed from live API data. */

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

    /** Dashboard and report tiles. */
    summary: function () {
      return Promise.all([assets.list({}), inventory.list({})]).then(function (r) {
        var rows = r[0], items = r[1];
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
          }, 0).toFixed(2))
        };
      });
    }
  };

  /* ================================================================ ADMIN */
  /* Users are LIVE - UserController /api/users, ADMIN only except /me.
     lookups.locations is LIVE; the remaining lists are fixed code values. */

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

    /** Locations are LIVE; the other lists are fixed code values. */
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

  /* =========================================================== REFERENCE */

  /* Locations are a live lookup, not prototype data. The screens build their
     dropdowns from MockData.LOCATIONS, which used to hold ids like "loc-100";
     the API returns the same shape with real UUIDs, so loading once and
     replacing the list fixes every dropdown without each screen needing to
     know where the rows came from. */

  var reference = {
    locations: function () {
      return locations().then(function (rows) {
        global.MockData.LOCATIONS = rows;
        return rows;
      });
    },

    /* Employees need reshaping as well as replacing: the API says active,
       jobTitle and homeLocationName where the screens were written against
       status, title and site. Mapping here keeps every screen working instead
       of editing each one. */
    employees: function () {
      return employees().then(function (rows) {
        global.MockData.EMPLOYEES = rows.map(function (e) {
          return {
            employeeId: e.employeeId,
            externalHrId: e.externalHrId,
            name: e.name,
            email: e.email,
            title: e.jobTitle,
            site: e.homeLocationName,
            homeLocationId: e.homeLocationId,
            status: e.active ? 'ACTIVE' : 'INACTIVE'
          };
        });
        return global.MockData.EMPLOYEES;
      });
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
    reports: reports,
    admin: admin,
    audit: auditApi,
    invitations: invitations,
    reference: reference
  };
})(window);
