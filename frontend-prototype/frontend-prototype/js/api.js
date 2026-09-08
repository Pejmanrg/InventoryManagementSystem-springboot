/* ==========================================================================
   api.js - Mock API layer
   --------------------------------------------------------------------------
   This is the ONLY file that screens talk to for data. Every function is
   asynchronous and returns a Promise, exactly like a real `fetch()` call, and
   every function is annotated with the REST endpoint it will become once the
   Spring Boot service exists.

   To connect the real backend later, replace each function body with a fetch
   against the documented endpoint. No screen code has to change.

     Example replacement:
       list: function (params) {
         return http('GET', '/api/v1/assets', null, params);
       }

   Business rules enforced here mirror the Java service layer exactly:
     AssetService.createAsset()      - tag and name required, tag unique
     TransactionService.checkOut()   - employee required, asset must be AVAILABLE
     TransactionService.checkIn()    - asset must be CHECKED_OUT
     InventoryService.adjustQuantity() - resulting quantity cannot be negative
   ========================================================================== */

(function (global) {
  'use strict';

  var LATENCY = 220; // simulated round trip, milliseconds

  /* ------------------------------------------------------------- helpers */

  /** Mirrors a Spring `ProblemDetail` / @ResponseStatus error response. */
  function ApiError(status, message, field) {
    this.name = 'ApiError';
    this.status = status;     // 400 | 403 | 404 | 409
    this.message = message;
    this.field = field || null;
  }
  ApiError.prototype = Object.create(Error.prototype);

  function respond(producer) {
    return new Promise(function (resolve, reject) {
      global.setTimeout(function () {
        try { resolve(producer()); }
        catch (err) { reject(err); }
      }, LATENCY);
    });
  }

  function db() { return global.Store.load(); }
  function commit() { global.Store.persist(); }
  function nowIso() { return new Date().toISOString().slice(0, 19); }
  function clone(v) { return global.Store.clone(v); }

  function currentUserId() {
    var s = global.Store.getSession();
    return s ? s.userId : 'system';
  }

  /** AuditService.recordEvent() - CSC-12 */
  function audit(action, entityType, entityId, summary, outcome) {
    var s = db();
    s.audit.unshift({
      eventId: global.Store.nextId('aud'),
      timestamp: nowIso(),
      actor: currentUserId(),
      action: action,
      entityType: entityType,
      entityId: entityId,
      summary: summary,
      outcome: outcome || 'SUCCESS',
      ip: '10.20.4.18'
    });
    commit();
  }

  function byId(list, key, value) {
    for (var i = 0; i < list.length; i++) {
      if (list[i][key] === value) { return list[i]; }
    }
    return null;
  }

  function contains(haystack, needle) {
    return String(haystack || '').toLowerCase().indexOf(needle) !== -1;
  }

  /* ================================================================= AUTH */
  /* Production: the browser is redirected to Microsoft Entra ID (OIDC) and the
     API validates the returned token - AuthenticationService.validateToken(),
     getClaims(), requireRole() (CSC-09). The prototype simply selects a demo
     account so each role's screens can be demonstrated. */

  var auth = {
    /** POST /api/v1/auth/session  (prototype stand-in for the OIDC callback) */
    signIn: function (userId) {
      return respond(function () {
        var user = byId(db().users, 'userId', userId);
        if (!user) { throw new ApiError(404, 'Account not found.'); }
        if (user.status !== 'ACTIVE') {
          throw new ApiError(403, 'This account is disabled. Contact a system administrator.');
        }
        var session = {
          userId: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
          employeeId: user.employeeId,
          site: user.site,
          signedInAt: nowIso()
        };
        global.Store.setSession(session);
        audit('AUTH_SIGN_IN', 'USER', user.userId, user.name + ' signed in (prototype sign-in).');
        return clone(session);
      });
    },

    /** DELETE /api/v1/auth/session */
    signOut: function () {
      return respond(function () {
        var s = global.Store.getSession();
        if (s) { audit('AUTH_SIGN_OUT', 'USER', s.userId, s.name + ' signed out.'); }
        global.Store.clearSession();
        return true;
      });
    },

    /** GET /api/v1/auth/session */
    session: function () { return global.Store.getSession(); }
  };

  /* =============================================================== ASSETS */
  /* AssetController / AssetService (CSC-03) */

  function decorateAsset(a) {
    var d = global.MockData;
    var loc = byId(d.LOCATIONS, 'locationId', a.locationId);
    var emp = a.custodianEmployeeId ? byId(d.EMPLOYEES, 'employeeId', a.custodianEmployeeId) : null;
    var cat = byId(d.CATEGORIES, 'code', a.category);
    var out = clone(a);
    out.locationName  = loc ? loc.name : 'Unassigned';
    out.locationCode  = loc ? loc.code : '-';
    out.custodianName = emp ? emp.name : null;
    out.categoryName  = cat ? cat.name : a.category;
    return out;
  }

  var assets = {
    /** GET /api/v1/assets?query=&status=&locationId=&category= */
    list: function (params) {
      params = params || {};
      return respond(function () {
        var q = String(params.query || '').trim().toLowerCase();
        var rows = db().assets.filter(function (a) {
          if (params.status && a.status !== params.status) { return false; }
          if (params.locationId && a.locationId !== params.locationId) { return false; }
          if (params.category && a.category !== params.category) { return false; }
          if (params.custodianEmployeeId && a.custodianEmployeeId !== params.custodianEmployeeId) { return false; }
          if (!q) { return true; }
          /* Mirrors AssetRepository.search(): name or tag contains query. */
          return contains(a.name, q) || contains(a.tag, q) || contains(a.serialNumber, q);
        });
        return rows.map(decorateAsset);
      });
    },

    /** GET /api/v1/assets/{assetId} */
    get: function (assetId) {
      return respond(function () {
        var a = byId(db().assets, 'assetId', assetId);
        if (!a) { throw new ApiError(404, 'Asset not found: ' + assetId); }
        return decorateAsset(a);
      });
    },

    /** GET /api/v1/assets/tag/{tag}  - used by the barcode / QR lookup */
    getByTag: function (tag) {
      return respond(function () {
        var needle = String(tag || '').trim().toLowerCase();
        var a = db().assets.filter(function (x) { return x.tag.toLowerCase() === needle; })[0];
        if (!a) { throw new ApiError(404, 'No asset found with tag "' + tag + '".'); }
        return decorateAsset(a);
      });
    },

    /** POST /api/v1/assets  - AssetService.createAsset() */
    create: function (dto) {
      return respond(function () {
        var s = db();
        var tag = String(dto.tag || '').trim();
        var name = String(dto.name || '').trim();

        if (!tag)  { throw new ApiError(400, 'Asset tag is required.', 'tag'); }
        if (!name) { throw new ApiError(400, 'Asset name is required.', 'name'); }

        var dupe = s.assets.filter(function (a) { return a.tag.toLowerCase() === tag.toLowerCase(); })[0];
        if (dupe) {
          throw new ApiError(409, 'Asset with tag ' + tag + ' already exists.', 'tag');
        }

        var asset = {
          assetId: global.Store.nextId('ast'),
          tag: tag,
          name: name,
          category: dto.category || 'TOOL',
          serialNumber: dto.serialNumber || '',
          status: global.MockData.AssetStatus.AVAILABLE,
          locationId: dto.locationId || 'loc-100',
          custodianEmployeeId: null,
          condition: dto.condition || 'NEW',
          purchaseDate: dto.purchaseDate || '',
          purchaseCost: dto.purchaseCost === '' || dto.purchaseCost == null ? null : Number(dto.purchaseCost),
          warrantyEnd: dto.warrantyEnd || '',
          lastTransactionAt: nowIso(),
          notes: dto.notes || ''
        };
        s.assets.unshift(asset);
        commit();
        audit('ASSET_CREATE', 'ASSET', asset.assetId, tag + ' created with status AVAILABLE.');
        return decorateAsset(asset);
      });
    },

    /** PUT /api/v1/assets/{assetId}  - AssetService.updateAsset() */
    update: function (assetId, dto) {
      return respond(function () {
        var a = byId(db().assets, 'assetId', assetId);
        if (!a) { throw new ApiError(404, 'Asset not found: ' + assetId); }
        ['name', 'category', 'serialNumber', 'condition', 'notes', 'locationId'].forEach(function (k) {
          if (dto[k] !== undefined && dto[k] !== '') { a[k] = dto[k]; }
        });
        commit();
        audit('ASSET_UPDATE', 'ASSET', a.assetId, a.tag + ' details updated.');
        return decorateAsset(a);
      });
    },

    /** GET /api/v1/assets/{assetId}/transactions - TransactionRepository.getHistory() */
    history: function (assetId) {
      return respond(function () {
        var d = global.MockData;
        return db().transactions
          .filter(function (t) { return t.assetId === assetId; })
          .sort(function (x, y) { return y.timestamp.localeCompare(x.timestamp); })
          .map(function (t) {
            var emp = byId(d.EMPLOYEES, 'employeeId', t.employeeId);
            var loc = byId(d.LOCATIONS, 'locationId', t.locationId);
            var out = clone(t);
            out.employeeName = emp ? emp.name : '-';
            out.locationName = loc ? loc.name : '-';
            return out;
          });
      });
    }
  };

  /* ========================================================= TRANSACTIONS */
  /* TransactionController / TransactionService (CSC-04) */

  function pushTransaction(assetId, type, employeeId, notes, locationId) {
    var s = db();
    var txn = {
      transactionId: global.Store.nextId('txn'),
      assetId: assetId,
      type: type,
      employeeId: employeeId,
      timestamp: nowIso(),
      notes: notes || '',
      locationId: locationId,
      performedBy: currentUserId()
    };
    s.transactions.unshift(txn);
    commit();
    return txn;
  }

  var transactions = {
    /** POST /api/v1/assets/{assetId}/checkout - TransactionService.checkOut() */
    checkOut: function (assetId, employeeId, options) {
      options = options || {};
      return respond(function () {
        var A = global.MockData.AssetStatus;
        var asset = byId(db().assets, 'assetId', assetId);
        if (!asset) { throw new ApiError(404, 'Asset not found: ' + assetId); }
        if (!employeeId) {
          throw new ApiError(400, 'A receiving employee is required for checkout.', 'employeeId');
        }
        if (asset.status !== A.AVAILABLE) {
          audit('ASSET_CHECKOUT', 'ASSET', assetId,
                'Checkout rejected - asset status is ' + asset.status + '.', 'DENIED');
          throw new ApiError(409, 'Asset ' + asset.tag + ' cannot be checked out. Current status: '
                                  + asset.status + '.', 'status');
        }

        asset.status = A.CHECKED_OUT;
        asset.custodianEmployeeId = employeeId;
        if (options.locationId) { asset.locationId = options.locationId; }
        asset.lastTransactionAt = nowIso();
        commit();

        var txn = pushTransaction(assetId, global.MockData.TransactionType.CHECKOUT,
                                  employeeId, options.notes || 'Checked out to employee', asset.locationId);
        var emp = byId(global.MockData.EMPLOYEES, 'employeeId', employeeId);
        audit('ASSET_CHECKOUT', 'ASSET', assetId,
              asset.tag + ' checked out to ' + (emp ? emp.name : employeeId) + '.');
        return { asset: decorateAsset(asset), transaction: clone(txn) };
      });
    },

    /** POST /api/v1/assets/{assetId}/checkin - TransactionService.checkIn() */
    checkIn: function (assetId, options) {
      options = options || {};
      return respond(function () {
        var A = global.MockData.AssetStatus;
        var asset = byId(db().assets, 'assetId', assetId);
        if (!asset) { throw new ApiError(404, 'Asset not found: ' + assetId); }
        if (asset.status !== A.CHECKED_OUT) {
          audit('ASSET_CHECKIN', 'ASSET', assetId,
                'Check-in rejected - asset status is ' + asset.status + '.', 'DENIED');
          throw new ApiError(409, 'Asset ' + asset.tag + ' is not currently checked out.', 'status');
        }

        var previousCustodian = asset.custodianEmployeeId;
        asset.custodianEmployeeId = null;
        asset.locationId = options.locationId || asset.locationId;
        asset.lastTransactionAt = nowIso();
        if (options.condition) { asset.condition = options.condition; }

        /* A returned asset that needs service goes to MAINTENANCE instead of
           AVAILABLE; this matches the asset lifecycle state machine in the SDD
           (Figure 6) rather than adding a new workflow. */
        var toMaintenance = !!options.sendToMaintenance;
        asset.status = toMaintenance ? A.MAINTENANCE : A.AVAILABLE;
        commit();

        var txn = pushTransaction(assetId, global.MockData.TransactionType.CHECKIN,
                                  previousCustodian, options.notes || 'Returned', asset.locationId);
        audit('ASSET_CHECKIN', 'ASSET', assetId,
              asset.tag + ' checked in at ' + (byId(global.MockData.LOCATIONS, 'locationId', asset.locationId) || {}).name
              + (toMaintenance ? ' and routed to maintenance.' : '.'));

        var workOrder = null;
        if (toMaintenance) {
          workOrder = createWorkOrderInternal({
            assetId: assetId,
            title: options.maintenanceTitle || ('Service required after check-in - ' + asset.tag),
            type: 'CORRECTIVE',
            priority: 'MEDIUM',
            assignedTo: 'emp-2002',
            vendor: 'In-house',
            dueDate: '',
            notes: options.notes || ''
          });
        }
        return { asset: decorateAsset(asset), transaction: clone(txn), workOrder: workOrder };
      });
    },

    /** POST /api/v1/assets/{assetId}/move - TransactionService.moveAsset() */
    move: function (assetId, locationId, notes) {
      return respond(function () {
        var asset = byId(db().assets, 'assetId', assetId);
        if (!asset) { throw new ApiError(404, 'Asset not found: ' + assetId); }
        if (!locationId) { throw new ApiError(400, 'A destination location is required.', 'locationId'); }
        asset.locationId = locationId;
        asset.lastTransactionAt = nowIso();
        commit();
        var txn = pushTransaction(assetId, global.MockData.TransactionType.MOVE,
                                  asset.custodianEmployeeId, notes || 'Location transfer', locationId);
        var loc = byId(global.MockData.LOCATIONS, 'locationId', locationId);
        audit('ASSET_MOVE', 'ASSET', assetId, asset.tag + ' moved to ' + (loc ? loc.name : locationId) + '.');
        return { asset: decorateAsset(asset), transaction: clone(txn) };
      });
    },

    /** POST /api/v1/assets/{assetId}/dispose - TransactionService.dispose() */
    dispose: function (assetId, notes) {
      return respond(function () {
        var A = global.MockData.AssetStatus;
        var asset = byId(db().assets, 'assetId', assetId);
        if (!asset) { throw new ApiError(404, 'Asset not found: ' + assetId); }
        if (asset.status === A.RETIRED) {
          throw new ApiError(409, 'Asset ' + asset.tag + ' is already retired.', 'status');
        }
        if (asset.status === A.CHECKED_OUT) {
          throw new ApiError(409, 'Check in ' + asset.tag + ' before retiring it.', 'status');
        }
        asset.status = A.RETIRED;
        asset.custodianEmployeeId = null;
        asset.lastTransactionAt = nowIso();
        commit();
        var txn = pushTransaction(assetId, global.MockData.TransactionType.DISPOSE, null, notes || 'Disposed', asset.locationId);
        audit('ASSET_DISPOSE', 'ASSET', assetId, asset.tag + ' retired / disposed.');
        return { asset: decorateAsset(asset), transaction: clone(txn) };
      });
    },

    /** POST /api/v1/assets/{assetId}/recover - TransactionService.recover() */
    recover: function (assetId, notes) {
      return respond(function () {
        var A = global.MockData.AssetStatus;
        var asset = byId(db().assets, 'assetId', assetId);
        if (!asset) { throw new ApiError(404, 'Asset not found: ' + assetId); }
        if (asset.status !== A.LOST) {
          throw new ApiError(409, 'Only an asset marked LOST can be recovered. Current status: ' + asset.status + '.', 'status');
        }
        asset.status = A.AVAILABLE;
        asset.custodianEmployeeId = null;
        asset.lastTransactionAt = nowIso();
        commit();
        var txn = pushTransaction(assetId, global.MockData.TransactionType.RECOVER, null, notes || 'Recovered', asset.locationId);
        audit('ASSET_RECOVER', 'ASSET', assetId, asset.tag + ' recovered and returned to AVAILABLE.');
        return { asset: decorateAsset(asset), transaction: clone(txn) };
      });
    },

    /** POST /api/v1/assets/{assetId}/report-lost */
    markLost: function (assetId, notes) {
      return respond(function () {
        var A = global.MockData.AssetStatus;
        var asset = byId(db().assets, 'assetId', assetId);
        if (!asset) { throw new ApiError(404, 'Asset not found: ' + assetId); }
        if (asset.status === A.RETIRED) {
          throw new ApiError(409, 'A retired asset cannot be reported lost.', 'status');
        }
        asset.status = A.LOST;
        asset.lastTransactionAt = nowIso();
        commit();
        audit('ASSET_STATUS_CHANGE', 'ASSET', assetId, asset.tag + ' reported LOST. ' + (notes || ''));
        return { asset: decorateAsset(asset) };
      });
    },

    /** GET /api/v1/transactions?limit= - recent activity feed */
    recent: function (limit) {
      return respond(function () {
        var s = db();
        var d = global.MockData;
        return s.transactions
          .slice()
          .sort(function (x, y) { return y.timestamp.localeCompare(x.timestamp); })
          .slice(0, limit || 10)
          .map(function (t) {
            var asset = byId(s.assets, 'assetId', t.assetId);
            var emp = byId(d.EMPLOYEES, 'employeeId', t.employeeId);
            var out = clone(t);
            out.assetTag = asset ? asset.tag : '-';
            out.assetName = asset ? asset.name : '-';
            out.employeeName = emp ? emp.name : '-';
            return out;
          });
      });
    }
  };

  /* ============================================================ INVENTORY */
  /* InventoryService (CSC-03) */

  function decorateItem(i) {
    var loc = byId(global.MockData.LOCATIONS, 'locationId', i.locationId);
    var out = clone(i);
    out.locationName = loc ? loc.name : '-';
    out.stockState = i.quantityOnHand <= 0 ? 'CRITICAL'
                   : (i.quantityOnHand < i.reorderPoint ? 'LOW' : 'OK');
    out.extendedValue = Number((i.quantityOnHand * i.unitCost).toFixed(2));
    return out;
  }

  var inventory = {
    /** GET /api/v1/inventory?query=&locationId=&stockState= */
    list: function (params) {
      params = params || {};
      return respond(function () {
        var q = String(params.query || '').trim().toLowerCase();
        return db().inventory.map(decorateItem).filter(function (i) {
          if (params.locationId && i.locationId !== params.locationId) { return false; }
          if (params.category && i.category !== params.category) { return false; }
          if (params.stockState && i.stockState !== params.stockState) { return false; }
          if (!q) { return true; }
          return contains(i.sku, q) || contains(i.description, q);
        });
      });
    },

    /** GET /api/v1/inventory/{itemId}  - InventoryService.getStock() */
    get: function (itemId) {
      return respond(function () {
        var i = byId(db().inventory, 'inventoryItemId', itemId);
        if (!i) { throw new ApiError(404, 'Inventory item not found: ' + itemId); }
        return decorateItem(i);
      });
    },

    /** POST /api/v1/inventory/{itemId}/adjust - InventoryService.adjustQuantity() */
    adjust: function (itemId, delta, meta) {
      meta = meta || {};
      return respond(function () {
        var item = byId(db().inventory, 'inventoryItemId', itemId);
        if (!item) { throw new ApiError(404, 'Inventory item not found: ' + itemId); }

        var d = Number(delta);
        if (!isFinite(d) || d === 0) {
          throw new ApiError(400, 'Enter an adjustment quantity other than zero.', 'delta');
        }
        if (!meta.reason) {
          throw new ApiError(400, 'An adjustment reason is required.', 'reason');
        }

        var updated = item.quantityOnHand + d;
        if (updated < 0) {
          audit('INVENTORY_ADJUST', 'INVENTORY', itemId,
                'Adjustment rejected - would reduce ' + item.sku + ' below zero.', 'DENIED');
          throw new ApiError(409,
            'Adjustment failed: stock cannot be negative. On hand ' + item.quantityOnHand
            + ', requested change ' + (d > 0 ? '+' : '') + d + '.', 'delta');
        }

        var before = item.quantityOnHand;
        item.quantityOnHand = updated;
        item.lastCountedAt = nowIso().slice(0, 10);

        var adj = {
          adjustmentId: global.Store.nextId('adj'),
          inventoryItemId: itemId,
          delta: d,
          reason: meta.reason,
          reference: meta.reference || '',
          quantityAfter: updated,
          timestamp: nowIso(),
          performedBy: currentUserId(),
          notes: meta.notes || ''
        };
        db().adjustments.unshift(adj);
        commit();

        audit('INVENTORY_ADJUST', 'INVENTORY', itemId,
              item.sku + ' adjusted by ' + (d > 0 ? '+' : '') + d
              + ' (' + before + ' -> ' + updated + ')'
              + (meta.reference ? ', ' + meta.reference : '') + '.');

        return { item: decorateItem(item), adjustment: clone(adj), previousQuantity: before };
      });
    },

    /** GET /api/v1/inventory/{itemId}/adjustments  (omit id for all) */
    adjustments: function (itemId, limit) {
      return respond(function () {
        var s = db();
        return s.adjustments
          .filter(function (a) { return !itemId || a.inventoryItemId === itemId; })
          .sort(function (x, y) { return y.timestamp.localeCompare(x.timestamp); })
          .slice(0, limit || 200)
          .map(function (a) {
            var item = byId(s.inventory, 'inventoryItemId', a.inventoryItemId);
            var user = byId(s.users, 'userId', a.performedBy);
            var out = clone(a);
            out.sku = item ? item.sku : '-';
            out.description = item ? item.description : '-';
            out.uom = item ? item.uom : '';
            out.performedByName = user ? user.name : a.performedBy;
            return out;
          });
      });
    }
  };

  /* ========================================================== MAINTENANCE */
  /* MaintenanceService (CSC-05) */

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
    audit('WORKORDER_CREATE', 'WORKORDER', wo.workOrderId, wo.number + ' opened.');
    return clone(wo);
  }

  function decorateWorkOrder(w) {
    var s = db();
    var asset = w.assetId ? byId(s.assets, 'assetId', w.assetId) : null;
    var emp = w.assignedTo ? byId(global.MockData.EMPLOYEES, 'employeeId', w.assignedTo) : null;
    var out = clone(w);
    out.assetTag = asset ? asset.tag : '-';
    out.assetName = asset ? asset.name : 'Not asset-specific';
    out.assignedToName = emp ? emp.name : 'Unassigned';
    out.overdue = !!(w.dueDate && w.status !== 'CLOSED' && w.dueDate < nowIso().slice(0, 10));
    return out;
  }

  var maintenance = {
    /** GET /api/v1/work-orders?status=&priority=&query= */
    list: function (params) {
      params = params || {};
      return respond(function () {
        var q = String(params.query || '').trim().toLowerCase();
        return db().workOrders.map(decorateWorkOrder).filter(function (w) {
          if (params.status && w.status !== params.status) { return false; }
          if (params.priority && w.priority !== params.priority) { return false; }
          if (params.type && w.type !== params.type) { return false; }
          if (!q) { return true; }
          return contains(w.number, q) || contains(w.title, q) || contains(w.assetTag, q);
        });
      });
    },

    /** POST /api/v1/work-orders - MaintenanceService.createWorkOrder() */
    create: function (dto) {
      return respond(function () {
        if (!dto.title || !String(dto.title).trim()) {
          throw new ApiError(400, 'A work order title is required.', 'title');
        }
        var wo = createWorkOrderInternal(dto);

        /* Opening a corrective work order takes the asset out of service, which
           is the AVAILABLE -> MAINTENANCE transition in the SDD state machine. */
        if (dto.assetId && dto.takeOutOfService) {
          var asset = byId(db().assets, 'assetId', dto.assetId);
          if (asset && asset.status === global.MockData.AssetStatus.AVAILABLE) {
            asset.status = global.MockData.AssetStatus.MAINTENANCE;
            commit();
            audit('ASSET_STATUS_CHANGE', 'ASSET', asset.assetId,
                  asset.tag + ' status changed AVAILABLE -> MAINTENANCE (' + wo.number + ').');
          }
        }
        return decorateWorkOrder(byId(db().workOrders, 'workOrderId', wo.workOrderId));
      });
    },

    /** PATCH /api/v1/work-orders/{id} - MaintenanceService.updateWorkOrder() */
    update: function (workOrderId, dto) {
      return respond(function () {
        var w = byId(db().workOrders, 'workOrderId', workOrderId);
        if (!w) { throw new ApiError(404, 'Work order not found: ' + workOrderId); }
        ['title', 'priority', 'status', 'assignedTo', 'vendor', 'dueDate', 'notes'].forEach(function (k) {
          if (dto[k] !== undefined && dto[k] !== '') { w[k] = dto[k]; }
        });
        commit();
        audit('WORKORDER_UPDATE', 'WORKORDER', w.workOrderId, w.number + ' updated.');
        return decorateWorkOrder(w);
      });
    },

    /** POST /api/v1/work-orders/{id}/close - MaintenanceService.closeWorkOrder() */
    close: function (workOrderId, options) {
      options = options || {};
      return respond(function () {
        var s = db();
        var w = byId(s.workOrders, 'workOrderId', workOrderId);
        if (!w) { throw new ApiError(404, 'Work order not found: ' + workOrderId); }
        if (w.status === 'CLOSED') { throw new ApiError(409, w.number + ' is already closed.'); }

        w.status = 'CLOSED';
        w.closedAt = nowIso();
        if (options.notes) { w.notes = options.notes; }
        commit();
        audit('WORKORDER_CLOSE', 'WORKORDER', w.workOrderId, w.number + ' closed.');

        /* Returning the asset to service: MAINTENANCE -> AVAILABLE. */
        if (options.returnToService && w.assetId) {
          var asset = byId(s.assets, 'assetId', w.assetId);
          var stillOpen = s.workOrders.filter(function (o) {
            return o.assetId === w.assetId && o.status !== 'CLOSED';
          }).length;
          if (asset && asset.status === global.MockData.AssetStatus.MAINTENANCE && stillOpen === 0) {
            asset.status = global.MockData.AssetStatus.AVAILABLE;
            asset.condition = 'GOOD';
            commit();
            audit('ASSET_STATUS_CHANGE', 'ASSET', asset.assetId,
                  asset.tag + ' status changed MAINTENANCE -> AVAILABLE (' + w.number + ' closed).');
          }
        }
        return decorateWorkOrder(w);
      });
    }
  };

  /* ============================================================== REPORTS */
  /* ReportService (CSC-06) */

  var reports = {
    /** GET /api/v1/reports/assets-by-site */
    assetsBySite: function () {
      return respond(function () {
        var s = db();
        return global.MockData.LOCATIONS.map(function (loc) {
          var rows = s.assets.filter(function (a) { return a.locationId === loc.locationId; });
          return {
            locationId: loc.locationId,
            locationName: loc.name,
            type: loc.type,
            total: rows.length,
            available: rows.filter(function (a) { return a.status === 'AVAILABLE'; }).length,
            checkedOut: rows.filter(function (a) { return a.status === 'CHECKED_OUT'; }).length,
            maintenance: rows.filter(function (a) { return a.status === 'MAINTENANCE'; }).length,
            other: rows.filter(function (a) { return a.status === 'LOST' || a.status === 'RETIRED'; }).length
          };
        }).sort(function (x, y) { return y.total - x.total; });
      });
    },

    /** GET /api/v1/reports/assets-by-employee */
    assetsByEmployee: function () {
      return respond(function () {
        var s = db();
        return global.MockData.EMPLOYEES.map(function (emp) {
          var rows = s.assets.filter(function (a) { return a.custodianEmployeeId === emp.employeeId; });
          return {
            employeeId: emp.employeeId,
            name: emp.name,
            title: emp.title,
            site: emp.site,
            count: rows.length,
            value: Number(rows.reduce(function (sum, a) { return sum + (a.purchaseCost || 0); }, 0).toFixed(2)),
            tags: rows.map(function (a) { return a.tag; })
          };
        }).filter(function (r) { return r.count > 0; })
          .sort(function (x, y) { return y.count - x.count; });
      });
    },

    /** GET /api/v1/reports/low-stock */
    lowStock: function () {
      return respond(function () {
        return db().inventory.map(decorateItem)
          .filter(function (i) { return i.stockState !== 'OK'; })
          .sort(function (x, y) {
            return (x.quantityOnHand / (x.reorderPoint || 1)) - (y.quantityOnHand / (y.reorderPoint || 1));
          });
      });
    },

    /** GET /api/v1/reports/maintenance-due */
    maintenanceDue: function () {
      return respond(function () {
        return db().workOrders.map(decorateWorkOrder)
          .filter(function (w) { return w.status !== 'CLOSED'; })
          .sort(function (x, y) { return String(x.dueDate).localeCompare(String(y.dueDate)); });
      });
    },

    /** GET /api/v1/reports/summary  - dashboard tiles */
    summary: function () {
      return respond(function () {
        var s = db();
        var A = global.MockData.AssetStatus;
        function count(st) { return s.assets.filter(function (a) { return a.status === st; }).length; }
        var items = s.inventory.map(decorateItem);
        return {
          assetTotal: s.assets.length,
          available: count(A.AVAILABLE),
          checkedOut: count(A.CHECKED_OUT),
          maintenance: count(A.MAINTENANCE),
          lost: count(A.LOST),
          retired: count(A.RETIRED),
          inventorySkus: items.length,
          lowStock: items.filter(function (i) { return i.stockState === 'LOW'; }).length,
          outOfStock: items.filter(function (i) { return i.stockState === 'CRITICAL'; }).length,
          inventoryValue: Number(items.reduce(function (sum, i) { return sum + i.extendedValue; }, 0).toFixed(2)),
          openWorkOrders: s.workOrders.filter(function (w) { return w.status !== 'CLOSED'; }).length,
          overdueWorkOrders: s.workOrders.map(decorateWorkOrder).filter(function (w) { return w.overdue; }).length,
          openPos: s.purchaseOrders.filter(function (p) { return p.status !== 'RECEIVED'; }).length
        };
      });
    }
  };

  /* ================================================================ ADMIN */
  /* UserRoleService (CSC-06) + integration settings (CSC-13) */

  var admin = {
    /** GET /api/v1/admin/users */
    users: function () {
      return respond(function () {
        return db().users.map(function (u) {
          var out = clone(u);
          out.roleName = global.MockData.ROLES[u.role] ? global.MockData.ROLES[u.role].name : u.role;
          return out;
        });
      });
    },

    /** PUT /api/v1/admin/users/{userId}/role - UserRoleService.assignRole() */
    assignRole: function (userId, role) {
      return respond(function () {
        var u = byId(db().users, 'userId', userId);
        if (!u) { throw new ApiError(404, 'User not found: ' + userId); }
        if (!global.MockData.ROLES[role]) { throw new ApiError(400, 'Unknown role: ' + role, 'role'); }
        var previous = u.role;
        u.role = role;
        commit();
        audit('ROLE_ASSIGN', 'USER', userId,
              u.name + ' role changed ' + previous + ' -> ' + role + '.');
        return clone(u);
      });
    },

    /** PUT /api/v1/admin/users/{userId}/status */
    setStatus: function (userId, status) {
      return respond(function () {
        var u = byId(db().users, 'userId', userId);
        if (!u) { throw new ApiError(404, 'User not found: ' + userId); }
        u.status = status;
        commit();
        audit('USER_STATUS_CHANGE', 'USER', userId, u.name + ' set to ' + status + '.');
        return clone(u);
      });
    },

    /** GET /api/v1/admin/integrations */
    integrations: function () {
      return respond(function () { return clone(db().integrations); });
    },

    /** GET /api/v1/lookups */
    lookups: function () {
      return respond(function () {
        return {
          locations: clone(global.MockData.LOCATIONS),
          categories: clone(global.MockData.CATEGORIES),
          conditions: clone(global.MockData.CONDITIONS),
          adjustmentReasons: clone(global.MockData.ADJUSTMENT_REASONS)
        };
      });
    },

    /** GET /api/v1/purchase-orders */
    purchaseOrders: function () {
      return respond(function () { return clone(db().purchaseOrders); });
    }
  };

  /* ================================================================ AUDIT */
  /* AuditService.searchEvents() / exportAudit() (CSC-12) */

  var auditApi = {
    /** GET /api/v1/audit?query=&action=&outcome=&from=&to= */
    search: function (params) {
      params = params || {};
      return respond(function () {
        var s = db();
        var q = String(params.query || '').trim().toLowerCase();
        return s.audit.filter(function (e) {
          if (params.action && e.action !== params.action) { return false; }
          if (params.outcome && e.outcome !== params.outcome) { return false; }
          if (params.entityType && e.entityType !== params.entityType) { return false; }
          if (params.from && e.timestamp < params.from) { return false; }
          if (params.to && e.timestamp > params.to + 'T23:59:59') { return false; }
          if (!q) { return true; }
          return contains(e.summary, q) || contains(e.action, q) || contains(e.entityId, q);
        }).map(function (e) {
          var user = byId(s.users, 'userId', e.actor);
          var out = clone(e);
          out.actorName = user ? user.name : (e.actor === 'system' ? 'System / integration job' : e.actor);
          return out;
        }).sort(function (x, y) { return y.timestamp.localeCompare(x.timestamp); });
      });
    },

    /** GET /api/v1/audit/export - returns CSV text (download is mocked) */
    exportCsv: function (rows) {
      return respond(function () {
        var header = 'timestamp,actor,action,entityType,entityId,outcome,summary';
        var body = rows.map(function (r) {
          return [r.timestamp, r.actorName, r.action, r.entityType, r.entityId, r.outcome,
                  '"' + String(r.summary).replace(/"/g, '""') + '"'].join(',');
        }).join('\n');
        return header + '\n' + body;
      });
    }
  };

  /* ------------------------------------------------------------- exports */

  global.API = {
    ApiError: ApiError,
    auth: auth,
    assets: assets,
    transactions: transactions,
    inventory: inventory,
    maintenance: maintenance,
    reports: reports,
    admin: admin,
    audit: auditApi
  };
})(window);
