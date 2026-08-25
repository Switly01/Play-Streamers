(() => {
  'use strict';

  const ACCOUNT_TABS = Object.freeze({
    '/account/data': 'data',
    '/account/profile': 'profile',
    '/account/security': 'account',
    '/account/devices': 'devices',
    '/account/connections': 'connections',
    '/account/support': 'support'
  });
  const TITLES = Object.freeze({
    '/': 'Play Streamers — Yayıncı Merkezi',
    '/about': 'Hakkımızda · Play Streamers',
    '/products': 'Ürünlerimiz · Play Streamers',
    '/how-it-works': 'Nasıl Çalışır? · Play Streamers',
    '/account': 'Hesap · Play Streamers',
    '/account/data': 'Veriler · Play Streamers',
    '/account/profile': 'Profil · Play Streamers',
    '/account/security': 'Hesap Güvenliği · Play Streamers',
    '/account/devices': 'Cihazlar · Play Streamers',
    '/account/connections': 'Bağlantılar · Play Streamers',
    '/account/support': 'Destek Talepleri · Play Streamers',
    '/home': 'Ana Sayfa · Play Streamers',
    '/dashboard': 'Dashboard · Play Streamers',
    '/updates': 'Güncelleme Notları · Play Streamers'
  });
  const PRIVATE_ROUTES = new Set(['/home', '/dashboard', ...Object.keys(ACCOUNT_TABS)]);
  let applying = false;
  let retryCount = 0;
  let retryTimer = 0;
  let authModalWasOpen = false;

  const normalizePath = value => {
    const path = String(value || '/').replace(/\/{2,}/g, '/');
    return path.length > 1 ? path.replace(/\/+$/, '') : '/';
  };
  const routeApi = () => window.psCleanRouteApi;
  const hasOAuthReturn = url => (
    (url.searchParams.has('code') && url.searchParams.has('state')) ||
    url.searchParams.has('kick_auth') ||
    url.searchParams.has('donate_oauth')
  );
  const setTitle = path => { document.title = TITLES[path] || 'Play Streamers'; };
  const scheduleRoute = (delay = 60) => {
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(applyCurrentRoute, delay);
  };

  function replaceRoute(destination) {
    window.psNavigatePath?.(destination, { replace: true, apply: false });
  }

  function requireAccount(path, api) {
    const target = `${path}${location.search}${location.hash}`;
    replaceRoute(`/account?mode=login&next=${encodeURIComponent(target)}`);
    api.auth('login');
    setTitle('/account');
  }

  function applyCurrentRoute() {
    if (applying) return;
    const api = routeApi();
    if (!api) {
      if (retryCount++ < 150) scheduleRoute();
      return;
    }

    const url = new URL(location.href);
    if (hasOAuthReturn(url)) {
      scheduleRoute(300);
      return;
    }

    let path = normalizePath(url.pathname);
    if (path === '/login' || path === '/register') {
      const mode = path === '/register' ? 'register' : 'login';
      replaceRoute(`/account?mode=${mode}`);
      path = '/account';
    }

    const signedIn = api.hasSession();
    if (PRIVATE_ROUTES.has(path) && !signedIn) {
      requireAccount(path, api);
      return;
    }

    applying = true;
    try {
      if (path === '/') {
        if (signedIn) {
          path = '/home';
          replaceRoute(path);
          api.memberHome();
        } else api.publicHome();
      } else if (path === '/about') api.publicInfo('about');
      else if (path === '/products') signedIn ? api.memberProducts() : api.publicInfo('products');
      else if (path === '/how-it-works') api.publicInfo('how');
      else if (path === '/home') api.memberHome();
      else if (path === '/dashboard') api.dashboard();
      else if (path === '/updates') api.updates();
      else if (path === '/account') {
        if (signedIn) {
          path = '/account/data';
          replaceRoute(path);
          api.account('data');
        } else api.auth(url.searchParams.get('mode') === 'register' ? 'register' : 'login');
      } else if (ACCOUNT_TABS[path]) api.account(ACCOUNT_TABS[path]);
      else {
        path = signedIn ? '/home' : '/';
        replaceRoute(path);
        signedIn ? api.memberHome() : api.publicHome();
      }
      setTitle(path);
    } finally {
      applying = false;
    }
  }

  function observeAuthDismissal() {
    const modalOpen = Boolean(document.getElementById('landingAuthModal'));
    if (authModalWasOpen && !modalOpen && location.pathname === '/account') {
      const api = routeApi();
      if (api?.hasSession()) return;
      const returnPath = window.psGetPublicAuthReturnPath?.() || '/';
      window.psNavigatePath?.(returnPath, { replace: true });
    }
    authModalWasOpen = modalOpen;
  }

  window.addEventListener('popstate', applyCurrentRoute);
  window.addEventListener('ps-route-change', applyCurrentRoute);
  new MutationObserver(observeAuthDismissal).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scheduleRoute(0), { once: true });
  else scheduleRoute(0);
  scheduleRoute(250);
})();
