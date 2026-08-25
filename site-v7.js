(() => {
  'use strict';

  function visible(selector) {
    return [...document.querySelectorAll(selector)].some((node) => !node.hidden && node.getAttribute('aria-hidden') !== 'true');
  }

  function ensurePublicHome() {
    const root = document.getElementById('authOverlay');
    const shell = root?.querySelector('.landing-shell');
    const current = shell?.querySelector('.landing-main');
    if (!root || !shell || !current || current.classList.contains('ps8-home')) return;
    const home = document.createElement('section');
    home.className = 'landing-main ps8-home';
    home.innerHTML = `
      <section class="ps8-hero" aria-labelledby="ps8-title">
        <div class="ps8-dot-field" aria-hidden="true"></div>
        <div class="ps8-hero-copy">
          <span class="ps8-version"><i></i> PLAY STREAMERS DESKTOP · 0.13.0</span>
          <h1 id="ps8-title"><span>YAYININ.</span><span class="ps8-outline">VERİN.</span><span>KONTROLÜN.</span></h1>
          <p>Yayın verilerin sunucuda otomatik toplansın. Hesabını web'de yönet; analiz, içerik, topluluk ve üretim araçlarının tamamını sade masaüstü uygulamasında kullan.</p>
          <div class="ps8-hero-actions">
            <a class="ps8-download" href="./downloads/Play-Streamers-Setup.exe" download>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4.5 10.5 3v8.2H3V4.5Zm8.5-1.7L21 1v10.2h-9.5V2.8ZM3 12.2h7.5V21L3 19.5v-7.3Zm8.5 0H21V23l-9.5-1.8v-9Z"/></svg>
              <span><b>Windows için indir</b><small>Windows 10/11 · 64 bit</small></span>
              <i>↓</i>
            </a>
            <button class="ps8-account" type="button" data-ps8-action="register">Ücretsiz hesap oluştur <span>↗</span></button>
          </div>
          <div class="ps8-proof" aria-label="Ürün bilgileri"><span><b>45</b> hazır araç</span><span><b>7/24</b> sunucu ölçümü</span><span><b>1</b> sade merkez</span></div>
        </div>
        <div class="ps8-app-stage" aria-label="Play Streamers masaüstü uygulaması ön izlemesi">
          <div class="ps8-app-halo" aria-hidden="true"></div>
          <article class="ps8-app-window">
            <header><span class="ps8-window-brand"><img src="./play-streamers-ps-logo.svg?v=8.1" alt=""><b>PLAY STREAMERS</b></span><span class="ps8-window-controls">— □ ×</span></header>
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
        </div>
      </section>

      <div class="ps8-marquee" aria-label="Play Streamers yetenekleri"><div><span>CANLI ANALİZ</span><i>✦</i><span>İÇERİK PLANLAMA</span><i>✦</i><span>PLAY CONNECT</span><i>✦</i><span>TOPLULUK</span><i>✦</i><span>MARKA ARAÇLARI</span><i>✦</i><span>GELİR GÖRÜNÜMLERİ</span></div></div>

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
          <article class="ps8-feature-wide"><span>05</span><h3>Free'den Product Pro'ya tek deneyim.</h3><p>Planın büyüdüğünde yeni bir uygulama öğrenmezsin; ihtiyaç duyduğun çalışma alanları aynı sade sistem içinde açılır.</p><button type="button" data-ps8-action="products">Planları ve ürünleri incele <i>→</i></button></article>
        </div>
      </section>

      <section class="ps8-steps" aria-labelledby="ps8-steps-title">
        <div><span>BAŞLANGIÇ</span><h2 id="ps8-steps-title">Üç adım.<br>Sonrası otomatik.</h2></div>
        <ol><li><i>01</i><span><b>Hesabını oluştur</b><small>SW Identity ile güvenli merkezini aç.</small></span></li><li><i>02</i><span><b>Platformunu bağla</b><small>Kick ve Play Connect bağlantılarını tamamla.</small></span></li><li><i>03</i><span><b>Uygulamayı indir</b><small>Tüm araçlarına masaüstünden eriş.</small></span></li></ol>
      </section>

      <section class="ps8-final-cta" aria-labelledby="ps8-final-title">
        <img src="./play-streamers-ps-logo.svg?v=8.1" alt="Play Streamers PS logosu">
        <span>WINDOWS 10/11 · SÜRÜM 0.13.0</span>
        <h2 id="ps8-final-title">Yayınını değil,<br>sistemini büyüt.</h2>
        <p>Hesabını ücretsiz oluştur. Play Streamers Desktop'ı indir ve üretim araçlarını tek sade merkezde kullanmaya başla.</p>
        <div><a href="./downloads/Play-Streamers-Setup.exe" download>Uygulamayı ücretsiz indir <i>↓</i></a><button type="button" data-ps8-action="register">Hesap oluştur</button></div>
        <small>Doğrudan kurulum dosyası Windows yayınevi imzası tamamlanana kadar SmartScreen uyarısı gösterebilir.</small>
      </section>`;
    current.replaceWith(home);
    root.querySelector('.landing-update-preview')?.setAttribute('aria-hidden', 'true');
  }

  function normalize(root = document) {
    document.documentElement.dataset.psSiteVersion = '8';
    document.body.classList.remove('ps-v7');
    document.body.classList.add('ps-v8');
    ensurePublicHome();
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
