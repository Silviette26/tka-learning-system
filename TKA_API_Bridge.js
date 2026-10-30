/**
 * TKA API BRIDGE
 * Tujuan: mempertahankan pemanggilan google.script.run pada JS lama,
 * tetapi mengarahkannya ke Cloudflare Worker melalui fetch().
 *
 * Pasang file ini di frontend dan muat SEBELUM JS TKA utama.
 * Isi TKA_WORKER_URL dengan URL Worker setelah Worker di-deploy.
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
        // Untuk tahap awal kompatibilitas. Jangan kirim shared secret dari browser.
        // Identitas pengguna diteruskan sebagai argumen sesuai fungsi lama.
        client: 'tka-web'
      })
    })
    .then(async response => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `Permintaan gagal (${response.status})`);
      }
      return payload.data;
    })
    .then(data => { if (typeof success === 'function') success(data); })
    .catch(err => { if (typeof failure === 'function') failure(err); else console.error(err); });
  }


  function makeRunner(successHandler, failureHandler) {
    return new Proxy({}, {
      get(_target, property) {
        if (property === 'withSuccessHandler') {
          return callback => makeRunner(callback, failureHandler);
        }
        if (property === 'withFailureHandler') {
          return callback => makeRunner(successHandler, callback);
        }
        if (property === 'withUserObject') {
          return () => makeRunner(successHandler, failureHandler);
        }
        if (typeof property === 'string') {
          return (...args) => invoke(property, args, successHandler, failureHandler);
        }
        return undefined;
      }
    });
  }
  const runner = makeRunner(null, null);

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = runner;
})();
