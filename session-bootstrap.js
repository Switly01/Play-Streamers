(() => {
  'use strict';

  // GitHub Pages bilinmeyen bir temiz adresi 404.html üzerinden ana belgeye
  // aktarır. Hedef adresi uygulama çizilmeden önce geri yükleyerek yenileme ve
  // doğrudan bağlantıların aynı ekranı açmasını sağlarız.
  try {
    const incoming = new URL(location.href);
    const forwardedRoute = incoming.searchParams.get('ps_route');
    if (forwardedRoute) {
      incoming.searchParams.delete('ps_route');
      const target = new URL(forwardedRoute, location.origin);
      if (target.origin === location.origin && target.pathname.startsWith('/') && !target.pathname.startsWith('//')) {
        history.replaceState(history.state, '', target.pathname + target.search + target.hash);
      } else {
        history.replaceState(history.state, '', incoming.pathname + incoming.search + incoming.hash);
      }
    }
  } catch (_) {
    history.replaceState(history.state, '', '/');
  }

  window.psNavigatePath = (destination, options = {}) => {
    const target = new URL(String(destination || '/'), location.origin);
    if (target.origin !== location.origin) return false;
    const next = target.pathname + target.search + target.hash;
    const current = location.pathname + location.search + location.hash;
    if (next !== current) {
      history[options.replace ? 'replaceState' : 'pushState']({ ...(history.state || {}), psRoute: true }, '', next);
    }
    if (options.apply !== false) {
      window.dispatchEvent(new CustomEvent('ps-route-change', { detail: { path: next, replace: Boolean(options.replace) } }));
    }
    return true;
  };

  try {
    const storedState = JSON.parse(localStorage.getItem('play-streamers-v17-site') || '{}');
    if (storedState.settings?.userSession || storedState.userSession) {
      document.documentElement.classList.add('ps15-session-pending');
      if (sessionStorage.getItem('ps-second-dashboard') === '1') {
        document.documentElement.dataset.psDashboardRestore = '1';
      }
    }
  } catch {
    // Bozuk yerel veri ilk sayfa çizimini engellemez.
  }
})();
