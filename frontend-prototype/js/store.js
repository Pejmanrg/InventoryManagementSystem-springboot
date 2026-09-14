
(function (global) {
  'use strict';

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
    clone: clone,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    storageAvailable: storageOk
  };
})(window);
