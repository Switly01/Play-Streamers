(() => {
  'use strict';

  function visible(selector) {
    return [...document.querySelectorAll(selector)].some((node) => !node.hidden && node.getAttribute('aria-hidden') !== 'true');
  }

  function normalizePublicMetrics() {
    const metrics = document.querySelector('#authOverlay .ps61-site-metrics');
    if (!metrics) return;
    const values = [...metrics.querySelectorAll('.ps61-metric :is(strong,b)')]
      .map((node) => String(node.textContent || '').trim());
    const hasValue = values.some((value) => value && value !== '—' && value !== '-');
    metrics.classList.toggle('ps83-metrics-empty', !hasValue);
  }

  function ensurePremiumAmbient() {
    let ambient = document.getElementById('ps9Ambient');
    if (!ambient) {
      ambient = document.createElement('div');
      ambient.id = 'ps9Ambient';
      ambient.setAttribute('aria-hidden', 'true');
      ambient.innerHTML = '<i></i><i></i><i></i><span></span><span></span><b></b>';
      document.body.prepend(ambient);
    }
    if (document.documentElement.dataset.ps9MotionBound === '1') return;
    document.documentElement.dataset.ps9MotionBound = '1';
    let pointerFrame = 0;
    document.addEventListener('pointermove', (event) => {
      if (!matchMedia('(pointer:fine)').matches || pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        document.documentElement.style.setProperty('--ps9-pointer-x', `${((event.clientX / Math.max(innerWidth, 1)) * 100).toFixed(2)}%`);
        document.documentElement.style.setProperty('--ps9-pointer-y', `${((event.clientY / Math.max(innerHeight, 1)) * 100).toFixed(2)}%`);
        document.documentElement.style.setProperty('--ps9-drift-x', `${(((event.clientX / Math.max(innerWidth, 1)) - .5) * 18).toFixed(2)}px`);
        document.documentElement.style.setProperty('--ps9-drift-y', `${(((event.clientY / Math.max(innerHeight, 1)) - .5) * 12).toFixed(2)}px`);
      });
    }, { passive: true });
    let scrollFrame = 0;
    window.addEventListener('scroll', () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        document.documentElement.style.setProperty('--ps9-page-scroll', `${Math.min(120, scrollY * .055).toFixed(2)}px`);
      });
    }, { passive: true });
  }

  function animateNewSurfaces(root = document) {
    root.querySelectorAll?.([
      '#psSecondHome .ps20-hero', '#psSecondHome .ps20-card',
      '.app .workspace-tabs', '.app .ticker', '.app .card',
      '#ps49InfoPage .ps49-info-content > *', '#ps51AccountCenter .ps51-account-pane',
      '.auth-dialog', '.ps27-dialog', '.ps44-dialog', '.psmail-dialog',
      '#ps44StatusPopover', '#ps44HomeMenu', '#ps44HomeConnection'
    ].join(',')).forEach((node) => {
      if (node.dataset.ps9Animated === '1' || node.hidden || !node.getClientRects().length) return;
      node.dataset.ps9Animated = '1';
      node.classList.add('ps9-surface-enter');
      window.setTimeout(() => node.classList.remove('ps9-surface-enter'), 520);
    });
  }

  function normalizeLegalLinks(root = document) {
    root.querySelectorAll?.('.ps73-privacy-slot').forEach((slot) => {
      let privacy = slot.querySelector('.ps72-privacy-link');
      if (privacy) privacy.textContent = 'Gizlilik';
      else {
        privacy = document.createElement('a');
        privacy.className = 'ps72-privacy-link';
        privacy.href = './privacy.html';
        privacy.textContent = 'Gizlilik';
        slot.append(privacy);
      }
      if (!slot.querySelector('.ps72-terms-link')) {
        const terms = document.createElement('a');
        terms.className = 'ps72-terms-link';
        terms.href = './terms.html';
        terms.textContent = 'Kullanım Koşulları';
        slot.append(terms);
      }
    });
  }

  function activatePublicMotion(home) {
    if (!home || home.dataset.ps82Motion === '1') return;
    home.dataset.ps82Motion = '1';
    const revealNodes = home.querySelectorAll([
      '.ps81-showcase > header', '.ps81-showcase .ps8-app-stage',
      '.ps8-section-head', '.ps8-boundary-grid article',
      '.ps8-features > header', '.ps8-feature-grid article',
      '.ps8-steps > div', '.ps8-steps li',
      '.ps8-final-cta > *'
    ].join(','));
    revealNodes.forEach((node, index) => {
      node.classList.add('ps82-reveal');
      node.style.setProperty('--ps82-delay', `${(index % 6) * 70}ms`);
    });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      }, { threshold: .12, rootMargin: '0px 0px -5% 0px' });
      revealNodes.forEach((node) => observer.observe(node));
    } else {
      revealNodes.forEach((node) => node.classList.add('is-visible'));
    }

    const hero = home.querySelector('.ps81-hero');
    if (!hero || !matchMedia('(pointer:fine)').matches) return;
    let pointerFrame = 0;
    hero.addEventListener('pointermove', (event) => {
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      pointerFrame = requestAnimationFrame(() => {
        const rect = hero.getBoundingClientRect();
        hero.style.setProperty('--ps82-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
        hero.style.setProperty('--ps82-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
        hero.style.setProperty('--ps83-px', `${((((event.clientX - rect.left) / rect.width) - .5) * 28).toFixed(2)}px`);
        hero.style.setProperty('--ps83-py', `${((((event.clientY - rect.top) / rect.height) - .5) * 20).toFixed(2)}px`);
      });
    }, { passive: true });
    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--ps82-x', '50%');
      hero.style.setProperty('--ps82-y', '42%');
      hero.style.setProperty('--ps83-px', '0px');
      hero.style.setProperty('--ps83-py', '0px');
    }, { passive: true });
    let scrollFrame = 0;
    const syncScrollMotion = () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        const rect = hero.getBoundingClientRect();
        const progress = Math.max(-1, Math.min(1, -rect.top / Math.max(rect.height, 1)));
        hero.style.setProperty('--ps83-scroll', `${(progress * 38).toFixed(2)}px`);
      });
    };
    window.addEventListener('scroll', syncScrollMotion, { passive: true });
    syncScrollMotion();
  }

  function ensurePublicHome() {
    const root = document.getElementById('authOverlay');
    const shell = root?.querySelector('.landing-shell');
    const current = shell?.querySelector('.landing-main');
    if (!root || !shell || !current) return;
    const navActions = root.querySelector('.landing-actions');
    if (navActions && !navActions.querySelector('.ps81-nav-download')) {
      const navDownload = document.createElement('a');
      navDownload.className = 'ps81-nav-download';
      navDownload.href = './downloads/Play-Streamers-Setup.exe';
      navDownload.setAttribute('download', '');
      navDownload.innerHTML = '<span>Windows için indir</span><i>↓</i>';
      navActions.prepend(navDownload);
    }
    if (current.classList.contains('ps8-home')) {
      activatePublicMotion(current);
      return;
    }
    const home = document.createElement('section');
    home.className = 'landing-main ps8-home';
    home.innerHTML = `
      <section class="ps8-hero ps81-hero" aria-labelledby="ps8-title">
        <div class="ps8-dot-field" aria-hidden="true"></div>
        <div class="ps81-star-layer ps81-stars-one" aria-hidden="true"></div>
        <div class="ps81-star-layer ps81-stars-two" aria-hidden="true"></div>
        <div class="ps82-motion-field" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><span></span><span></span></div>
        <div class="ps82-orbits" aria-hidden="true"><i></i><i></i></div>
        <div class="ps8-hero-copy">
          <span class="ps8-version"><i></i> SÜRÜM 0.13.0</span>
          <h1 id="ps8-title">PLAY<span>.</span>STREAMERS</h1>
          <h2>Profesyonel Yayıncı Kontrol Platformu</h2>
          <p>Canlı analiz · İçerik planlama · Topluluk · Marka · Play Connect</p>
          <div class="ps8-hero-actions">
            <a class="ps8-download" href="./downloads/Play-Streamers-Setup.exe" download>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4.5 10.5 3v8.2H3V4.5Zm8.5-1.7L21 1v10.2h-9.5V2.8ZM3 12.2h7.5V21L3 19.5v-7.3Zm8.5 0H21V23l-9.5-1.8v-9Z"/></svg>
              <span><b>Windows için indir</b><small>Windows 10/11 · 64 bit</small></span>
              <i>↓</i>
            </a>
          </div>
          <div class="ps8-proof" aria-label="Ürün bilgileri"><span>Ücretsiz</span><i>•</i><span>3.1 MB</span><i>•</i><span>Windows 10/11</span></div>
          <button class="ps81-hero-account" type="button" data-ps8-action="register">Ücretsiz hesap oluştur <span>↗</span></button>
        </div>
        <div class="ps81-scroll-cue" aria-hidden="true"><i></i><span>KEŞFET</span></div>
      </section>

      <div class="ps8-marquee" aria-label="Play Streamers yetenekleri"><div class="ps82-marquee-track"><span class="ps82-marquee-group"><b>CANLI ANALİZ</b><i>✦</i><b>İÇERİK PLANLAMA</b><i>✦</i><b>PLAY CONNECT</b><i>✦</i><b>TOPLULUK</b><i>✦</i><b>MARKA ARAÇLARI</b><i>✦</i><b>GELİR GÖRÜNÜMLERİ</b><i>✦</i></span><span class="ps82-marquee-group" aria-hidden="true"><b>CANLI ANALİZ</b><i>✦</i><b>İÇERİK PLANLAMA</b><i>✦</i><b>PLAY CONNECT</b><i>✦</i><b>TOPLULUK</b><i>✦</i><b>MARKA ARAÇLARI</b><i>✦</i><b>GELİR GÖRÜNÜMLERİ</b><i>✦</i></span></div></div>

      <section class="ps81-showcase" aria-labelledby="ps81-showcase-title">
        <header><span>MASAÜSTÜ UYGULAMASI</span><h2 id="ps81-showcase-title">Her şey tek platformda.</h2><p>Analiz, içerik, topluluk ve daha fazlası — yayınını yönetmek için ihtiyacın olan araçlar tek sade uygulamada.</p></header>
        <div class="ps8-app-stage" aria-label="Play Streamers masaüstü uygulaması ön izlemesi">
          <div class="ps8-app-halo" aria-hidden="true"></div>
          <article class="ps8-app-window">
            <header><span class="ps8-window-brand"><img src="./play-streamers-ps-logo.svg?v=9.0" alt=""><b>PLAY STREAMERS</b></span><span class="ps8-window-controls">— □ ×</span></header>
            <div class="ps8-app-body">
              <aside><i class="active"></i><i></i><i></i><i></i><i></i><i></i></aside>
              <div class="ps8-app-content">
                <div class="ps8-app-top"><span><small>GÜNAYDIN</small><b>Üretim Merkezi</b></span><em>ÜRÜN DEMOSU</em></div>
                <div class="ps8-app-grid">
                  <article class="wide"><small>SON YAYIN</small><b>2s 48dk</b><span>Ortalama 184 izleyici</span><div class="ps8-chart"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
                  <article><small>ETKİLEŞİM</small><b>+18%</b><span>Önceki yayına göre</span></article>
                  <article><small>TOPLULUK</small><b>24.8K</b><span>Toplam erişim</span></article>
                  <article class="wide ps8-flow"><small>ÇALIŞMA ALANLARI</small><div><span>İçerik</span><span>Analiz</span><span>Topluluk</span><span>Marka</span></div></article>
                </div>
              </div>
            </div>
          </article>
          <span class="ps8-float ps8-float-top"><i></i> Sunucu senkronize</span>
          <span class="ps8-float ps8-float-bottom"><b>45</b> araç tek uygulamada</span>
          <span class="ps9-float-chip ps9-chip-left"><i></i> SW Bot denetimde</span>
          <span class="ps9-float-chip ps9-chip-right"><b>AI</b> Açıklama hazır</span>
        </div>
      </section>

      <section class="ps8-boundary" aria-labelledby="ps8-boundary-title">
        <div class="ps8-section-head"><span>WEB + DESKTOP</span><h2 id="ps8-boundary-title">Doğru araç,<br>doğru yerde.</h2><p>Her şeyi siteye sıkıştırmıyoruz. Tarayıcı hızlı hesap işlemlerini, masaüstü uygulaması ise günlük üretim akışını taşır.</p></div>
        <div class="ps8-boundary-grid">
          <article class="light"><span>01 · PStreamers.com</span><h3>Hesabın ve bağlantıların.</h3><p>SW Identity, plan yönetimi, güvenlik, Kick ve Play Connect bağlantıları.</p><button type="button" data-ps8-action="register">Web merkezini aç <i>↗</i></button></article>
          <article class="dark"><span>02 · Play Streamers Desktop</span><h3>Üretim sisteminin tamamı.</h3><p>Canlı merkez, yayın analizi, içerik, topluluk, marka, gelir ve yerel kasa araçları.</p><a href="./downloads/Play-Streamers-Setup.exe" download>Uygulamayı indir <i>↓</i></a></article>
        </div>
      </section>

      <section class="ps8-features" aria-labelledby="ps8-features-title">
        <header><span>CREATOR OPERATING SYSTEM</span><h2 id="ps8-features-title">Yayın bittikten sonra da çalışan sistem.</h2></header>
        <div class="ps8-feature-grid">
          <article class="ps8-feature-large"><span>01</span><h3>Sunucu tabanlı yayın geçmişi</h3><p>Site, uygulama ve eklenti kapalı olsa bile uygun platform bağlantısından yayın oturumları işlenmeye devam eder.</p><div class="ps8-signal"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
          <article><span>02</span><h3>Anlaşılır analiz</h3><p>Ham sayılar yerine değişimin ne anlama geldiğini gösteren okunabilir yayın özetleri.</p><b class="ps8-big-number">+18<small>%</small></b></article>
          <article><span>03</span><h3>Play Connect</h3><p>Chrome ve Firefox üzerinden destek, olay ve platform bağlantıları tek hesaba ulaşır.</p><div class="ps8-connect"><i>PC</i><b>Bağlı</b></div></article>
          <article><span>04</span><h3>İçerik ve topluluk</h3><p>Fikir kasasından yayın planına, topluluk ritminden marka araçlarına kadar aynı çalışma alanı.</p><div class="ps8-tags"><i>PLAN</i><i>TOPLULUK</i><i>MARKA</i></div></article>
          <article class="ps9-swbot-feature"><span>05</span><h3>SW Bot + SW AI</h3><p>Arayüzü, bağlantıları ve canlı dosyaları denetler; teknik sorunları anlaşılır bir Türkçe açıklamaya dönüştürür.</p><div class="ps9-scan-line"><i></i><b>SİSTEM TARAMASI</b></div></article>
          <article class="ps8-feature-wide"><span>06</span><h3>Free'den Product Pro'ya tek deneyim.</h3><p>Planın büyüdüğünde yeni bir uygulama öğrenmezsin; ihtiyaç duyduğun çalışma alanları aynı sade sistem içinde açılır.</p><button type="button" data-ps8-action="products">Planları ve ürünleri incele <i>→</i></button></article>
        </div>
      </section>

      <section class="ps8-steps" aria-labelledby="ps8-steps-title">
        <div><span>BAŞLANGIÇ</span><h2 id="ps8-steps-title">Üç adım.<br>Sonrası otomatik.</h2></div>
        <ol><li><i>01</i><span><b>Hesabını oluştur</b><small>SW Identity ile güvenli merkezini aç.</small></span></li><li><i>02</i><span><b>Platformunu bağla</b><small>Kick ve Play Connect bağlantılarını tamamla.</small></span></li><li><i>03</i><span><b>Uygulamayı indir</b><small>Tüm araçlarına masaüstünden eriş.</small></span></li></ol>
      </section>

      <section class="ps8-final-cta" aria-labelledby="ps8-final-title">
        <img src="./play-streamers-ps-logo.svg?v=9.0" alt="Play Streamers PS logosu">
        <span>WINDOWS 10/11 · SÜRÜM 0.13.0</span>
        <h2 id="ps8-final-title">Yayınını değil,<br>sistemini büyüt.</h2>
        <p>Hesabını ücretsiz oluştur. Play Streamers Desktop'ı indir ve üretim araçlarını tek sade merkezde kullanmaya başla.</p>
        <div><a href="./downloads/Play-Streamers-Setup.exe" download>Uygulamayı ücretsiz indir <i>↓</i></a><button type="button" data-ps8-action="register">Hesap oluştur</button></div>
        <small>Doğrudan kurulum dosyası Windows yayınevi imzası tamamlanana kadar SmartScreen uyarısı gösterebilir.</small>
      </section>`;
    current.replaceWith(home);
    activatePublicMotion(home);
    root.querySelector('.landing-update-preview')?.setAttribute('aria-hidden', 'true');
  }

  function normalize(root = document) {
    document.documentElement.dataset.psSiteVersion = '9';
    document.body.classList.remove('ps-v7');
    document.body.classList.add('ps-v8', 'ps-v9');
    ensurePremiumAmbient();
    ensurePublicHome();
    normalizePublicMetrics();
    normalizeLegalLinks(root);
    animateNewSurfaces(root);
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
    const action = event.target instanceof Element ? event.target.closest('[data-ps8-action]') : null;
    if (action) {
      const key = action.dataset.ps8Action;
      if (key === 'register') {
        event.preventDefault();
        document.getElementById('landingSignup')?.click();
        return;
      }
      if (key === 'products') {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.psCleanRouteApi?.publicInfo?.('products');
        if (location.pathname !== '/products') history.pushState(null, '', '/products');
        document.title = 'Ürünlerimiz · Play Streamers';
        return;
      }
    }
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
