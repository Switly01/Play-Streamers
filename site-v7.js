(() => {
  'use strict';

  function visible(selector) {
    return [...document.querySelectorAll(selector)].some((node) => !node.hidden && node.getAttribute('aria-hidden') !== 'true');
  }

  function setText(root, selector, value) {
    const node = root?.querySelector(selector);
    if (node && node.textContent !== value) node.textContent = value;
  }

  function normalizePublicCopy() {
    const root = document.getElementById('authOverlay');
    const hero = root?.querySelector('.landing-card');
    const update = root?.querySelector('.landing-update-card');
    if (!root || !hero) return;
    setText(hero, '.eyebrow', 'PLAY STREAMERS · YAYINCI MERKEZİ');
    setText(hero, 'h1', 'Yayın biter. Verin kaybolmaz.');
    setText(hero, ':scope > p', 'Yayın geçmişin, izleyici ritmin ve topluluk hareketlerin site ya da uygulama açık olmasa da sunucuda işlenir. Hesabını burada yönet; üretim araçlarının tamamına masaüstü uygulamasından ulaş.');
    setText(hero, '.landing-cta', 'Hesabını oluştur, Kick bağlantını kur ve bir sonraki yayınından itibaren geçmişini otomatik toplamaya başla.');
    setText(root, '.product-top > span:first-child', 'PLAY STREAMERS · CREATOR WORKSPACE');
    const product = root.querySelector('.landing-product');
    if (product) product.setAttribute('aria-label', 'Play Streamers masaüstü ve sunucu veri merkezi ön izlemesi');
    if (update) {
      setText(update, '.eyebrow', 'SİSTEM DURUMU');
      setText(update, 'h2', '7.0 · Control Room');
      setText(update, 'header p', 'Eski görsel katmanlar devreden çıkarıldı; tüm site tek bir kontrol odası tasarım sistemine geçti.');
      setText(update, 'time', '25 Ağustos 2026');
    }
  }

  function normalize(root = document) {
    document.documentElement.dataset.psSiteVersion = '7';
    document.body.classList.add('ps-v7');
    normalizePublicCopy();
    const publicSurface = document.getElementById('authOverlay');
    const infoSurface = document.getElementById('ps49InfoPage');
    const publicInfoOpen = Boolean(infoSurface && !infoSurface.hidden && getComputedStyle(infoSurface).display !== 'none' && document.body.classList.contains('auth-locked'));
    if (publicSurface && document.body.classList.contains('auth-locked')) {
      publicSurface.hidden = publicInfoOpen;
      publicSurface.inert = publicInfoOpen;
      if (publicInfoOpen) publicSurface.setAttribute('aria-hidden', 'true');
      else publicSurface.removeAttribute('aria-hidden');
    }
    document.body.classList.toggle('ps-v7-dialog-open', visible('.landing-auth-modal,.account-blocker,.ps44-dialog-layer,.ps27-dialog-layer,#ps30Modal'));
    if (!visible('#ps51AccountCenter')) document.body.classList.remove('ps54-account-open');
    root.querySelectorAll?.('button:not([aria-label])').forEach((button) => {
      const ownText = String(button.textContent || '').replace(/\s+/g, ' ').trim();
      const label = button.dataset.psTooltip || button.dataset.psTip || button.getAttribute('title');
      if (!ownText && label) button.setAttribute('aria-label', label);
    });
  }

  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; normalize(); });
  };
  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden','aria-hidden'] });
  const infoPaths = { about: '/about', products: '/products', how: '/how-it-works' };
  document.addEventListener('click', (event) => {
    const homeTrigger = event.target instanceof Element
      ? event.target.closest('#ps49InfoPage .landing-brand[aria-label="Birinci ana sayfaya dön"]')
      : null;
    if (homeTrigger && typeof window.psCleanRouteApi?.publicHome === 'function') {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.psCleanRouteApi.publicHome();
      if (location.pathname !== '/') history.pushState(null, '', '/');
      document.title = 'Play Streamers — Yayıncı Merkezi';
      return;
    }
    const button = event.target instanceof Element
      ? event.target.closest('#authOverlay .ps14-nav-links button,#authOverlay [data-info],#ps49InfoPage .ps14-nav-links button')
      : null;
    if (!button) return;
    const key = button.dataset.ps49Info || button.dataset.info;
    const path = infoPaths[key];
    if (!path || typeof window.psCleanRouteApi?.publicInfo !== 'function') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.psCleanRouteApi.publicInfo(key);
    if (location.pathname !== path) history.pushState(null, '', path);
    document.title = ({ about: 'Hakkımızda · Play Streamers', products: 'Ürünlerimiz · Play Streamers', how: 'Nasıl Çalışır? · Play Streamers' })[key];
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const homeTrigger = event.target instanceof Element
      ? event.target.closest('#ps49InfoPage .landing-brand[aria-label="Birinci ana sayfaya dön"]')
      : null;
    if (!homeTrigger || typeof window.psCleanRouteApi?.publicHome !== 'function') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.psCleanRouteApi.publicHome();
    if (location.pathname !== '/') history.pushState(null, '', '/');
    document.title = 'Play Streamers — Yayıncı Merkezi';
  }, true);
  window.addEventListener('pageshow', queue);
  window.addEventListener('popstate', queue);
  normalize();
})();
