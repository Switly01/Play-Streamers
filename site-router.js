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
    '/play-connect': 'Play Connect · Play Streamers',
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
  const PUBLIC_ORIGIN = 'https://pstreamers.com';
  const SOCIAL_IMAGE = `${PUBLIC_ORIGIN}/play-streamers-social-card.png`;
  const PUBLIC_ROUTE_SEO = Object.freeze({
    '/': {
      title: TITLES['/'],
      description: 'Play Streamers; yayın geçmişini, izleyici ritmini ve üretim araçlarını tek güvenli merkezde birleştiren yayıncı platformu.'
    },
    '/about': {
      title: TITLES['/about'],
      description: 'Play Streamers ve SW CREATE’in yayıncılar için geliştirdiği güvenli, sade ve uzun ömürlü ürün yaklaşımını keşfet.'
    },
    '/products': {
      title: TITLES['/products'],
      description: 'Play Streamers Desktop, Play Connect ve yayıncı araçlarını incele; yayın verini tek çalışma alanında yönet.'
    },
    '/how-it-works': {
      title: TITLES['/how-it-works'],
      description: 'Play Streamers’ın yayın verisini nasıl topladığını, hesapları nasıl koruduğunu ve bağlantıları nasıl yönettiğini öğren.'
    },
    '/play-connect': {
      title: TITLES['/play-connect'],
      description: 'Play Connect’i Chrome, Microsoft Edge veya Firefox’a ekle; yayın platformlarını Play Streamers hesabına güvenle bağla.'
    }
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
  const setMeta = (selector, attribute, value) => {
    const node = document.querySelector(selector);
    if (node && value) node.setAttribute(attribute, value);
  };
  const setRouteMetadata = path => {
    const seo = PUBLIC_ROUTE_SEO[path];
    document.title = seo?.title || TITLES[path] || 'Play Streamers';
    setMeta('meta[name="robots"]', 'content', seo ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,nofollow');
    if (!seo) return;
    const canonicalUrl = `${PUBLIC_ORIGIN}${path === '/' ? '/' : path}`;
    setMeta('link[rel="canonical"]', 'href', canonicalUrl);
    setMeta('meta[name="description"]', 'content', seo.description);
    setMeta('meta[property="og:type"]', 'content', 'website');
    setMeta('meta[property="og:title"]', 'content', seo.title);
    setMeta('meta[property="og:description"]', 'content', seo.description);
    setMeta('meta[property="og:url"]', 'content', canonicalUrl);
    setMeta('meta[property="og:image"]', 'content', SOCIAL_IMAGE);
    setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'content', seo.title);
    setMeta('meta[name="twitter:description"]', 'content', seo.description);
    setMeta('meta[name="twitter:image"]', 'content', SOCIAL_IMAGE);
  };
  const setTitle = path => setRouteMetadata(path);
  function navigatePath(destination, options = {}) {
    try {
      const target = new URL(String(destination || '/'), location.origin);
      if (target.origin !== location.origin) return false;
      const next = `${target.pathname}${target.search}${target.hash}`;
      const current = `${location.pathname}${location.search}${location.hash}`;
      if (next !== current) history[options.replace ? 'replaceState' : 'pushState'](null, '', next);
      if (options.apply !== false) window.dispatchEvent(new CustomEvent('ps-route-change', { detail: { path: next } }));
      return true;
    } catch (_) {
      return false;
    }
  }
  if (typeof window.psNavigatePath !== 'function') window.psNavigatePath = navigatePath;
  window.psSetRouteMetadata = setRouteMetadata;
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
    const url = new URL(location.href);
    const recoveredRoute = url.searchParams.get('ps_route');
    if (url.pathname === '/' && recoveredRoute) {
      try {
        const recoveredUrl = new URL(recoveredRoute, location.origin);
        const recoveredPath = normalizePath(recoveredUrl.pathname);
        const knownRoute = Object.prototype.hasOwnProperty.call(TITLES, recoveredPath) || recoveredPath === '/login' || recoveredPath === '/register';
        const creatorRoute = /^\/@[a-z0-9_-]{2,40}$/i.test(recoveredPath);
        if (recoveredUrl.origin === location.origin && (knownRoute || creatorRoute)) {
          history.replaceState(null, '', `${recoveredUrl.pathname}${recoveredUrl.search}${recoveredUrl.hash}`);
          url.href = location.href;
        }
      } catch (_) {}
    }
    if (window.psIdentityCallbackPending || hasOAuthReturn(url)) {
      scheduleRoute(300);
      return;
    }

    let path = normalizePath(url.pathname);
    if (path === '/login' || path === '/register') {
      const mode = path === '/register' ? 'register' : 'login';
      replaceRoute(`/account?mode=${mode}`);
      path = '/account';
    }

    const creatorMatch = path.match(/^\/@([a-z0-9_-]{2,40})$/i);
    if (creatorMatch) {
      window.ps125ReleaseFirstPaint?.();
      window.psCreatorPage?.render(creatorMatch[1].toLowerCase());
      return;
    }
    window.psCreatorPage?.destroy();

    const api = routeApi();
    if (!api) {
      if (retryCount++ < 150) scheduleRoute();
      return;
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
      else if (path === '/play-connect') api.publicInfo('connect');
      else if (path === '/home') api.memberHome();
      else if (path === '/dashboard') api.dashboard();
      else if (path === '/updates') api.updates();
      else if (path === '/account') {
        if (url.searchParams.get('two_factor') === '1' && document.querySelector('#landingAuthModal [name="code"]')) {
          // OAuth callback already owns this challenge; do not replace it with a login form.
        } else if (signedIn) {
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
  window.addEventListener('ps:identity-settled', () => scheduleRoute(0));
  new MutationObserver(observeAuthDismissal).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scheduleRoute(0), { once: true });
  else scheduleRoute(0);
  scheduleRoute(250);
})();
