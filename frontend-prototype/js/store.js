
(function (global) {
  'use strict';

  var STATE_KEY   = 'cims.state.v1';
  var SESSION_KEY = 'cims.session.v1';

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
      try { return global.sessionStorage.getItem(key); } catch (e) {  }
    }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }

  function writeRaw(key, value) {
    memory[key] = value;
    if (storageOk) {
      try { global.sessionStorage.setItem(key, value); } catch (e) {  }
    }
  }

  function removeRaw(key) {
    delete memory[key];
    if (storageOk) {
      try { global.sessionStorage.removeItem(key); } catch (e) {  }
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

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
      } catch (e) {  }
    }
    state = seed();
    persist();
    return state;
  }

  function persist() {
    if (!state) { return; }
    try { writeRaw(STATE_KEY, JSON.stringify(state)); } catch (e) {  }
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
