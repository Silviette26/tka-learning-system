/**
 * TKA API Bridge — GitHub Pages -> Cloudflare Worker -> Google Apps Script
 * Mempertahankan pola google.script.run pada JS_TKA_Tahap3_fixed8.
 * Jangan pernah menaruh GAS_SHARED_SECRET / TKA_GATEWAY_SECRET di file ini.
 */
(function () {
  'use strict';
  const TKA_WORKER_URL = 'https://tka-smpn14-api.satria-tu39.workers.dev';

  function invoke(method, args, success, failure, userObject) {
    fetch(TKA_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, args: Array.from(args || []), client: 'tka-web' })
    })
    .then(async response => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || payload.message || `Permintaan gagal (${response.status})`);
      }
      return Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
    })
    .then(data => { if (typeof success === 'function') success(data, userObject); })
    .catch(err => {
      if (typeof failure === 'function') failure(err, userObject);
      else console.error('[TKA API]', err);
    });
  }

  function makeRunner(successHandler, failureHandler, userObject) {
    return new Proxy({}, {
      get(_target, property) {
        if (property === 'withSuccessHandler') return cb => makeRunner(cb, failureHandler, userObject);
        if (property === 'withFailureHandler') return cb => makeRunner(successHandler, cb, userObject);
        if (property === 'withUserObject') return obj => makeRunner(successHandler, failureHandler, obj);
        if (typeof property === 'string') {
          return (...args) => invoke(property, args, successHandler, failureHandler, userObject);
        }
        return undefined;
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = makeRunner(null, null, undefined);
})();
