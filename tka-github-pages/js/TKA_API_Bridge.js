/**
 * TKA API Bridge
 * Menjembatani pemanggilan google.script.run dari frontend GitHub Pages
 * ke Cloudflare Worker. Shared secret TIDAK boleh ditaruh di browser.
 */
(function () {
  'use strict';

  const TKA_WORKER_URL = 'https://tka-smpn14-api.satria-tu39.workers.dev';

  function invoke(method, args, success, failure) {
    fetch(TKA_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: method,
        args: Array.from(args || []),
        client: 'tka-web'
      })
    })
    .then(async response => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || payload.message || `Permintaan gagal (${response.status})`);
      }
      return Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
    })
    .then(data => { if (typeof success === 'function') success(data); })
    .catch(err => {
      if (typeof failure === 'function') failure(err);
      else console.error('[TKA API]', err);
    });
  }

  function makeRunner(successHandler, failureHandler) {
    return new Proxy({}, {
      get(_target, property) {
        if (property === 'withSuccessHandler') return callback => makeRunner(callback, failureHandler);
        if (property === 'withFailureHandler') return callback => makeRunner(successHandler, callback);
        if (property === 'withUserObject') return () => makeRunner(successHandler, failureHandler);
        if (typeof property === 'string') return (...args) => invoke(property, args, successHandler, failureHandler);
        return undefined;
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = makeRunner(null, null);
})();
