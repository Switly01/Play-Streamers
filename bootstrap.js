(() => {
  'use strict';
  let timer = 0;
  const release = () => {
    window.clearTimeout(timer);
    timer = 0;
    const root = document.documentElement;
    if (!root.classList.contains('ps15-session-pending')) return;
    root.classList.remove('ps15-session-pending');
    const loader = document.getElementById('ps28Loader');
    if (loader) { loader.hidden = true; loader.classList.remove('is-open', 'ps42-initial-leaving'); }
  };
  const arm = () => {
    window.clearTimeout(timer);
    if (document.documentElement.classList.contains('ps15-session-pending')) timer = window.setTimeout(release, 4500);
  };
  window.ps53ReleaseSessionPending = release;
  window.addEventListener('pageshow', arm, true);
  window.addEventListener('load', arm, { once: true });
  arm();
})();

(() => {
  'use strict';
  const API_ORIGIN = 'https://api.pstreamers.com';
  const SESSION_PATH = `${API_ORIGIN}/api/auth/session`;
  const HEALTH_PATH = `${API_ORIGIN}/health`;
  const SESSION_TTL_MS = 5 * 60 * 1000;
  const HEALTH_TTL_MS = 60 * 1000;
  const nativeFetch = window.fetch.bind(window);
  const cache = new Map();

  const urlOf = input => typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url || '';
  const methodOf = (input, init) => String(init?.method || input?.method || 'GET').toUpperCase();
  const authorizationOf = (input, init) => {
    try {
      const headers = init?.headers || input?.headers;
      return headers ? new Headers(headers).get('authorization') || '' : '';
    } catch {
      return '';
    }
  };

  window.fetch = function governedFetch(input, init = {}) {
    const url = urlOf(input);
    if (methodOf(input, init) !== 'GET' || (url !== SESSION_PATH && url !== HEALTH_PATH)) {
      return nativeFetch(input, init);
    }

    const isSession = url === SESSION_PATH;
    const key = isSession ? `session:${authorizationOf(input, init)}` : 'health';
    const ttl = isSession ? SESSION_TTL_MS : HEALTH_TTL_MS;
    const now = Date.now();
    const saved = cache.get(key);
    if (saved?.response && saved.expiresAt > now) return Promise.resolve(saved.response.clone());
    if (saved?.pending) return saved.pending.then(response => response.clone());

    const pending = nativeFetch(input, init)
      .then(response => {
        if (response.ok) cache.set(key, { response: response.clone(), expiresAt: Date.now() + ttl });
        else cache.delete(key);
        return response;
      })
      .catch(error => {
        cache.delete(key);
        throw error;
      });
    cache.set(key, { pending, expiresAt: now + ttl });
    return pending;
  };
})();

try {
    /* Aynı marka yükleyicisi ziyaretçi, OAuth dönüşü ve kayıtlı üye yenilemesi
       dahil bütün ilk sayfa açılışlarında görünür. */
    document.documentElement.classList.add('ps42-initial-loading');
    document.documentElement.dataset.ps42InitialLoader = 'active';
  } catch (_) { document.documentElement.classList.add('ps42-initial-loading'); }
