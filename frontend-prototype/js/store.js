/* ==========================================================================
   store.js - Client-side state container for the prototype
   --------------------------------------------------------------------------
   Holds the working copy of the mock dataset so that actions performed on one
   screen (check out an asset, adjust stock, open a work order) are visible on
   the other screens during a demonstration.

   Persistence strategy:
     1st choice  sessionStorage - survives page-to-page navigation in one tab
     fallback    in-memory object - used when storage is unavailable or blocked
   Nothing is written to localStorage, and nothing leaves the browser.

   When the Spring Boot API is introduced this whole file disappears: the
   server becomes the state container and api.js calls it directly.
   ========================================================================== */

(function (global) {
  'use strict';

  var STATE_KEY   = 'cims.state.v1';
  var SESSION_KEY = 'cims.session.v1';

  /* In-memory fallback used when sessionStorage throws or is unavailable. */
  var memory = {};
  var storageOk = (function () {
    try {
      var k = '__cims_probe__';
      global.sessionStorage.setItem(k, '1');
      global.sessionStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  })();

  function readRaw(key) {
    if (storageOk) {
      try { return global.sessionStorage.getItem(key); } catch (e) { /* fall through */ }
    }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }

  function writeRaw(key, value) {
    memory[key] = value;
    if (storageOk) {
      try { global.sessionStorage.setItem(key, value); } catch (e) { /* keep memory copy */ }
    }
  }

  function removeRaw(key) {
    delete memory[key];
    if (storageOk) {
      try { global.sessionStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /* ------------------------------------------------------- dataset state */

  function seed() {
    var d = global.MockData;
    return {
      assets:        clone(d.ASSETS),
      inventory:     clone(d.INVENTORY),
      transactions:  clone(d.TRANSACTIONS),
      adjustments:   clone(d.ADJUSTMENTS),
      workOrders:    clone(d.WORK_ORDERS),
      users:         clone(d.USERS),
      audit:         clone(d.AUDIT),
      integrations:  clone(d.INTEGRATIONS),
      purchaseOrders:clone(d.PURCHASE_ORDERS),
      seq: 100
    };
  }

  var state = null;

  function load() {
    if (state) { return state; }
    var raw = readRaw(STATE_KEY);
    if (raw) {
      try {
        state = JSON.parse(raw);
        if (state && state.assets && state.assets.length) { return state; }
      } catch (e) { /* corrupt - reseed below */ }
    }
    state = seed();
    persist();
    return state;
  }

  function persist() {
    if (!state) { return; }
    try { writeRaw(STATE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function reset() {
    state = seed();
    persist();
    return state;
  }

  function nextId(prefix) {
    var s = load();
    s.seq += 1;
    persist();
    return prefix + '-' + String(s.seq).padStart(4, '0');
  }

  /* ------------------------------------------------------- session state */

  function getSession() {
    var raw = readRaw(SESSION_KEY);
    if (!raw) { return null; }
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function setSession(session) {
    writeRaw(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    removeRaw(SESSION_KEY);
  }

  global.Store = {
    load: load,
    persist: persist,
    reset: reset,
    nextId: nextId,
    clone: clone,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    storageAvailable: storageOk
  };
})(window);
