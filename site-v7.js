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
    metrics.classList.remove('ps83-metrics-empty');
    metrics.classList.toggle('is-loading', !hasValue);
    metrics.dataset.metricsReady = hasValue ? '1' : '0';
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
    root.querySelectorAll?.('a[href="https://guns.lol/switly"]').forEach((link) => {
      link.href = 'https://swcreate.com';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
    root.querySelectorAll?.('.ps73-privacy-slot').forEach((slot) => {
      let privacy = slot.querySelector('.ps72-privacy-link');
      if (!privacy) {
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
      '.ps8-about > header', '.ps8-about-grid article',
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
    let lantern = hero.querySelector('.ps106-pointer-lantern');
    if (!lantern) {
      lantern = document.createElement('span');
      lantern.className = 'ps106-pointer-lantern';
      lantern.setAttribute('aria-hidden', 'true');
      hero.prepend(lantern);
    }
    let pointerFrame = 0;
    hero.addEventListener('pointermove', (event) => {
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      pointerFrame = requestAnimationFrame(() => {
        const rect = hero.getBoundingClientRect();
        hero.style.setProperty('--ps82-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
        hero.style.setProperty('--ps82-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
        hero.style.setProperty('--ps83-px', `${((((event.clientX - rect.left) / rect.width) - .5) * 28).toFixed(2)}px`);
        hero.style.setProperty('--ps83-py', `${((((event.clientY - rect.top) / rect.height) - .5) * 20).toFixed(2)}px`);
        lantern.style.transform = `translate3d(${(event.clientX - rect.left).toFixed(1)}px,${(event.clientY - rect.top).toFixed(1)}px,0) translate3d(-50%,-50%,0)`;
        lantern.classList.add('is-active');
      });
    }, { passive: true });
    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--ps82-x', '50%');
      hero.style.setProperty('--ps82-y', '42%');
      hero.style.setProperty('--ps83-px', '0px');
      hero.style.setProperty('--ps83-py', '0px');
      lantern.classList.remove('is-active');
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

  const publicSectionTargets = {
    about: 'ps8-about',
    products: 'ps8-products',
    how: 'ps8-how',
  };

  function navigatePublicHome(key, smooth = true) {
    const targetId = publicSectionTargets[key];
    const root = document.getElementById('authOverlay');
    const target = targetId ? document.getElementById(targetId) : null;
    if (!root || !target) return false;
    const info = document.getElementById('ps49InfoPage');
    if (info) {
      info.hidden = true;
      info.classList.remove('ps49-info-closing');
    }
    root.hidden = false;
    root.inert = false;
    root.removeAttribute('aria-hidden');
    root.style.removeProperty('display');
    document.body.classList.add('auth-locked');
    document.body.classList.remove('ps-v7-dialog-open', 'ps54-account-open');
    root.style.overflowY = 'auto';
    const navHeight = root.querySelector('.landing-nav')?.getBoundingClientRect().height || 76;
    const top = Math.max(0, target.offsetTop - navHeight - 20);
    root.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    root.querySelectorAll('.ps14-nav-links button').forEach((button) => {
      const buttonKey = button.dataset.info || button.dataset.ps49Info;
      button.classList.toggle('active', buttonKey === key);
      if (buttonKey === key) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
    });
    const hash = ({ about: '#hakkimizda', products: '#urunlerimiz', how: '#nasil-calisir' })[key];
    if (hash && location.hash !== hash) history.pushState(null, '', `/${hash}`);
    document.title = ({ about: 'Hakkımızda · Play Streamers', products: 'Ürünlerimiz · Play Streamers', how: 'Nasıl Çalışır? · Play Streamers' })[key];
    return true;
  }

  window.psPublicHomeNavigate = navigatePublicHome;

  function activatePlanTabs(home) {
    const tabs = [...home.querySelectorAll('[data-ps92-plan-tab]')];
    const panels = [...home.querySelectorAll('[data-ps92-plan-panel]')];
    if (!tabs.length || home.dataset.ps92PlanTabs === '1') return;
    home.dataset.ps92PlanTabs = '1';
    const select = (key, focus = false) => {
      tabs.forEach((tab) => {
        const active = tab.dataset.ps92PlanTab === key;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        if (active && focus) tab.focus();
      });
      panels.forEach((panel) => {
        const active = panel.dataset.ps92PlanPanel === key;
        panel.hidden = !active;
        panel.classList.toggle('active', active);
      });
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab.dataset.ps92PlanTab));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === 'Home' ? 0
          : event.key === 'End' ? tabs.length - 1
            : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        select(tabs[nextIndex].dataset.ps92PlanTab, true);
      });
    });
    select(tabs.find((tab) => tab.classList.contains('active'))?.dataset.ps92PlanTab || 'play');
  }

  function scheduleAstronaut(home) {
    if (!home || home.dataset.ps10AstronautScheduled === '1') return;
    home.dataset.ps10AstronautScheduled = '1';
    const delay = new URL(location.href).searchParams.get('astronaut') === '1' ? 1200 : 300000;
    const position = () => {
      const astronaut = home.querySelector('.ps10-astronaut-visitor');
      const hero = home.querySelector('.ps81-hero');
      if (!astronaut || !hero) return;
      const heroBox = hero.getBoundingClientRect();
      astronaut.style.top = 'auto';
      astronaut.style.bottom = `${Math.max(180, Math.min(224, heroBox.height * .2))}px`;
      astronaut.style.left = `${Math.max(58, Math.min(98, heroBox.width * .066))}px`;
    };
    const reveal = () => {
      const root = document.getElementById('authOverlay');
      if (!home.isConnected || !root || root.hidden || document.hidden || root.scrollTop > (home.querySelector('.ps81-hero')?.offsetHeight || 800)) {
        window.setTimeout(reveal, 15000);
        return;
      }
      const astronaut = home.querySelector('.ps10-astronaut-visitor');
      if (!astronaut || astronaut.classList.contains('is-visible')) return;
      position();
      astronaut.classList.add('is-visible');
      astronaut.setAttribute('aria-hidden', 'false');
      astronaut.tabIndex = 0;
      window.setTimeout(() => { if (astronaut.classList.contains('is-visible')) astronaut.classList.add('is-settled'); }, 2500);
      const depart = () => {
        if (astronaut.classList.contains('is-departing')) return;
        const bubble = astronaut.querySelector('.ps10-astronaut-bubble');
        if (bubble) bubble.textContent = 'Buradaysan ben gidiyorum.';
        astronaut.classList.add('is-leaving-message');
        astronaut.setAttribute('aria-label', 'Astronot yukarı çıkıyor');
        window.setTimeout(() => astronaut.classList.add('is-hook-returning'), 850);
        window.setTimeout(() => astronaut.classList.add('is-departing'), 1800);
        window.setTimeout(() => {
          astronaut.classList.remove('is-visible', 'is-settled', 'is-leaving-message', 'is-hook-returning', 'is-departing');
          astronaut.setAttribute('aria-hidden', 'true');
          astronaut.tabIndex = -1;
        }, 4100);
      };
      if (astronaut.dataset.ps10DepartBound !== '1') {
        astronaut.dataset.ps10DepartBound = '1';
        astronaut.addEventListener('click', depart);
        astronaut.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          depart();
        });
      }
      window.addEventListener('resize', position, { passive: true });
    };
    window.setTimeout(reveal, delay);
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
      activatePlanTabs(current);
      scheduleAstronaut(current);
      return;
    }
    const warpStars = Array.from({ length: 40 }, (_, index) => {
      const x = (5 + ((index * 37) % 91)).toFixed(2);
      const y = (7 + ((index * 53) % 86)).toFixed(2);
      const delay = (-((index * .73) % 11)).toFixed(2);
      const duration = (6.4 + (index % 11) * .92).toFixed(2);
      const size = (index % 9 === 0 ? 3 : index % 4 === 0 ? 2 : 1).toFixed(0);
      const drift = (-24 + (index * 17) % 49).toFixed(0);
      return `<i style="--ps10-x:${x}%;--ps10-y:${y}%;--ps10-delay:${delay}s;--ps10-duration:${duration}s;--ps10-size:${size}px;--ps10-drift:${drift}px"></i>`;
    }).join('');
    const home = document.createElement('section');
    home.className = 'landing-main ps8-home';
    home.innerHTML = `
      <section class="ps8-hero ps81-hero" aria-labelledby="ps8-title">
        <div class="ps8-dot-field" aria-hidden="true"></div>
        <div class="ps81-star-layer ps81-stars-one" aria-hidden="true"></div>
        <div class="ps81-star-layer ps81-stars-two" aria-hidden="true"></div>
        <div class="ps92-warp-field" aria-hidden="true">${warpStars}</div>
        <div class="ps10-space-detail" aria-hidden="true"><i class="ps10-moon"></i><i class="ps10-orbital-ring"></i><span class="ps10-constellation"><b></b><b></b><b></b><b></b><b></b></span><span class="ps10-spacecraft"><i></i><b></b></span><em class="ps10-nebula"></em></div>
        <div class="ps82-motion-field" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><span></span><span></span></div>
        <div class="ps82-orbits" aria-hidden="true"><i></i><i></i></div>
        <div class="ps8-hero-copy">
          <span class="ps8-version"><i></i> PLAY STREAMERS WEB · v10.6.0</span>
          <h1 id="ps8-title" aria-label="PLAY STREAMERS"><span>PLAY</span><span>STREAMERS</span></h1>
          <h2>Profesyonel Yayıncı Kontrol Platformu</h2>
          <p>Canlı analiz · İçerik planlama · Topluluk · Marka · Play Connect</p>
          <div class="ps8-hero-actions">
            <a class="ps8-download" href="./downloads/Play-Streamers-Setup.exe" download>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4.5 10.5 3v8.2H3V4.5Zm8.5-1.7L21 1v10.2h-9.5V2.8ZM3 12.2h7.5V21L3 19.5v-7.3Zm8.5 0H21V23l-9.5-1.8v-9Z"/></svg>
              <span><b>Windows için indir</b><small>APP v0.14.4 · Windows 10/11 · 64 bit</small></span>
              <i>↓</i>
            </a>
          </div>
          <div class="ps8-proof" aria-label="Ürün bilgileri"><span>Ücretsiz</span><i>•</i><span>3.1 MB</span><i>•</i><span>Windows 10/11</span></div>
          <button class="ps81-hero-account" type="button" data-ps8-action="register">Ücretsiz hesap oluştur <span>↗</span></button>
        </div>
        <button class="ps10-astronaut-visitor" type="button" aria-hidden="true" aria-label="Astronotu yukarı gönder" tabindex="-1">
          <span class="ps10-astronaut-rope" aria-hidden="true"></span>
          <span class="ps10-astronaut-bubble">Hey, geleceğin yayıncısı burada mısın?</span>
          <img src="./assets/play-streamers-pixel-astronaut-v2.png?v=10.2" alt="El sallayan piksel astronot">
        </button>
        <div class="ps81-scroll-cue" aria-hidden="true"><i></i><span>KEŞFET</span></div>
      </section>

      <div class="ps8-marquee" aria-label="Play Streamers yetenekleri"><div class="ps82-marquee-track"><span class="ps82-marquee-group"><b>CANLI ANALİZ</b><i>✦</i><b>İÇERİK PLANLAMA</b><i>✦</i><b>PLAY CONNECT</b><i>✦</i><b>TOPLULUK</b><i>✦</i><b>MARKA ARAÇLARI</b><i>✦</i><b>GELİR GÖRÜNÜMLERİ</b><i>✦</i></span><span class="ps82-marquee-group" aria-hidden="true"><b>CANLI ANALİZ</b><i>✦</i><b>İÇERİK PLANLAMA</b><i>✦</i><b>PLAY CONNECT</b><i>✦</i><b>TOPLULUK</b><i>✦</i><b>MARKA ARAÇLARI</b><i>✦</i><b>GELİR GÖRÜNÜMLERİ</b><i>✦</i></span></div></div>

      <section class="ps81-showcase" aria-labelledby="ps81-showcase-title">
        <header><span>MASAÜSTÜ UYGULAMASI</span><h2 id="ps81-showcase-title">Her şey tek platformda.</h2><p>Analiz, içerik, topluluk ve daha fazlası — yayınını yönetmek için ihtiyacın olan araçlar tek sade uygulamada.</p></header>
        <div class="ps8-app-stage" aria-label="Play Streamers masaüstü uygulaması ön izlemesi">
          <div class="ps8-app-halo" aria-hidden="true"></div>
          <article class="ps8-app-window">
            <header><span class="ps8-window-brand"><img src="./play-streamers-ps-logo.svg?v=10.6" alt=""><b>PLAY STREAMERS</b></span><span class="ps8-window-controls">— □ ×</span></header>
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


      <section class="ps8-about" id="ps8-about" aria-labelledby="ps8-about-title">
        <header><span>HAKKIMIZDA</span><h2 id="ps8-about-title">Yayıncı için çalışan,<br>yayın bitince durmayan sistem.</h2><p>Play Streamers, dağınık yayın araçlarını çoğaltmak yerine veriyi, üretimi ve hesap yönetimini tek anlaşılır düzende birleştirir.</p></header>
        <div class="ps8-about-grid">
          <article class="ps8-about-manifesto"><span>NEDEN VARIZ?</span><h3>Yayıncının dikkatini pencerelere değil, topluluğuna geri vermek için.</h3><p>Yayın açıkken oluşan önemli hareketler sunucuda izlenir; daha sonra geri döndüğünde geçmişin, ortalaman ve değişimin hazır olur.</p><div><b>OTOMATİK</b><b>ANLAŞILIR</b><b>YAYINCI ODAKLI</b></div></article>
          <article class="ps8-about-system"><span>TEK EKOSİSTEM</span><div class="ps8-about-orbit" aria-hidden="true"><i><img src="./play-streamers-ps-logo.svg?v=10.6" alt=""></i><b>WEB</b><b>APP</b><b>CONNECT</b></div><p>Site hesap ve bağlantıları, masaüstü uygulaması günlük üretimi, Play Connect ise tarayıcı akışını taşır. Hepsi aynı SW Identity hesabında birleşir.</p></article>
        </div>
      </section>

      <section class="ps8-boundary ps92-plans" id="ps8-products" aria-labelledby="ps8-boundary-title">
        <div class="ps8-section-head"><span>ÜRÜNLERİMİZ</span><h2 id="ps8-boundary-title">İhtiyacın kadar başla.<br>Sisteminle birlikte büyü.</h2><p>Web hesabın, Play Connect ve masaüstü uygulaman aynı ürün ailesinde; plan değiştirdiğinde yeniden öğrenmen gerekmez.</p></div>
        <div class="ps92-plan-tabs" role="tablist" aria-label="Ürün planları">
          <button id="ps92-tab-play" class="active" type="button" role="tab" aria-selected="true" aria-controls="ps92-panel-play" data-ps92-plan-tab="play">Play Streamers Plans</button>
          <button id="ps92-tab-create" type="button" role="tab" aria-selected="false" aria-controls="ps92-panel-create" data-ps92-plan-tab="create">SW Create Plans</button>
        </div>
        <div id="ps92-panel-play" class="ps92-plan-panel active" role="tabpanel" aria-labelledby="ps92-tab-play" data-ps92-plan-panel="play">
          <article><span>FREE</span><h3>Play Streamers Free</h3><p>Yayına başlamak, temel verilerini görmek ve günlük üretim düzenini kurmak için.</p><b>Ücretsiz başlangıç</b><button type="button" data-ps8-action="register">Hesap oluştur <i>↗</i></button></article>
          <article class="featured"><span>PRO</span><h3>Play Streamers Pro</h3><p>İçerik, topluluk ve marka araçlarını daha düzenli bir üretim sistemine dönüştürmek için.</p><b>Üretim sistemi</b><button type="button" data-ps8-action="register">Pro'yu keşfet <i>↗</i></button></article>
          <article><span>PRODUCT PRO</span><h3>Play Streamers Product Pro</h3><p>Derin analiz, SW AI açıklamaları ve gelişmiş iş akışlarıyla veriyi karara çevirmek için.</p><b>Tam ürün deneyimi</b><button type="button" data-ps8-action="register">Product Pro'yu keşfet <i>↗</i></button></article>
        </div>
        <div id="ps92-panel-create" class="ps92-plan-panel" role="tabpanel" aria-labelledby="ps92-tab-create" data-ps92-plan-panel="create" hidden>
          <article><span>FREE EDITION</span><h3>SW Create Free Edition</h3><p>SW Create ekosistemini ve ortak kimlik merkezini kullanmaya başlamak için.</p><b>Temel ekosistem</b><a href="https://swcreate.com" target="_blank" rel="noopener noreferrer">SW Create'e git <i>↗</i></a></article>
          <article class="featured"><span>PRO EDITION</span><h3>SW Create Pro Edition</h3><p>Birden fazla üretim aracını ortak hesap, güvenlik ve plan yapısında birleştirmek için.</p><b>Gelişmiş üretim</b><a href="https://swcreate.com" target="_blank" rel="noopener noreferrer">Pro Edition <i>↗</i></a></article>
          <article><span>PRODUCT PRO EDITION</span><h3>SW Create Product Pro Edition</h3><p>SW Create ürün ailesindeki en kapsamlı araçlara ve akıllı sistemlere erişmek için.</p><b>Tam ekosistem</b><a href="https://swcreate.com" target="_blank" rel="noopener noreferrer">Product Pro Edition <i>↗</i></a></article>
        </div>
        <nav class="ps92-brand-directory" aria-label="Play Streamers ürün bağlantıları">
          <a class="ps92-swcreate-link" href="https://swcreate.com" target="_blank" rel="noopener noreferrer"><span>GELİŞTİREN EKOSİSTEM</span><b>SW CREATE</b><i>↗</i></a>
          <div><a href="https://pstreamers.com">Play Streamers Web <i>↗</i></a><a href="./play-connect-v1.15.1.zip" download>Play Connect <i>↓</i></a><a href="./downloads/Play-Streamers-Setup.exe" download>Play Streamers App <i>↓</i></a></div>
        </nav>
      </section>

      <section class="ps8-features" aria-labelledby="ps8-features-title">
        <header><span>CREATOR OPERATING SYSTEM</span><h2 id="ps8-features-title">Yayın bittikten sonra da çalışan sistem.</h2></header>
        <div class="ps8-feature-grid">
          <article class="ps8-feature-large"><h3>Sunucu tabanlı yayın geçmişi</h3><p>Site, uygulama ve eklenti kapalı olsa bile uygun platform bağlantısından yayın oturumları işlenmeye devam eder.</p><div class="ps8-signal"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
          <article><h3>Anlaşılır analiz</h3><p>Ham sayılar yerine değişimin ne anlama geldiğini gösteren okunabilir yayın özetleri.</p><b class="ps8-big-number">+18<small>%</small></b></article>
          <article><h3>Play Connect</h3><p>Chrome ve Firefox üzerinden destek, olay ve platform bağlantıları tek hesaba ulaşır.</p><div class="ps8-connect"><i>PC</i><b>Bağlı</b></div></article>
          <article><h3>İçerik ve topluluk</h3><p>Fikir kasasından yayın planına, topluluk ritminden marka araçlarına kadar aynı çalışma alanı.</p><div class="ps8-tags"><i>PLAN</i><i>TOPLULUK</i><i>MARKA</i></div></article>
          <article class="ps9-swbot-feature"><h3>SW Bot + SW AI</h3><p>Arayüzü, bağlantıları ve canlı dosyaları denetler; teknik sorunları anlaşılır bir Türkçe açıklamaya dönüştürür.</p><div class="ps9-scan-line"><i></i><b>SİSTEM TARAMASI</b></div></article>
          <article class="ps8-feature-wide"><h3>Free'den Product Pro'ya tek deneyim.</h3><p>Planın büyüdüğünde yeni bir uygulama öğrenmezsin; ihtiyaç duyduğun çalışma alanları aynı sade sistem içinde açılır.</p><button type="button" data-ps8-action="products">Planları ve ürünleri incele <i>→</i></button></article>
        </div>
      </section>

      <section class="ps8-steps" id="ps8-how" aria-labelledby="ps8-steps-title">
        <div><span>BAŞLANGIÇ</span><h2 id="ps8-steps-title">Üç adım.<br>Sonrası otomatik.</h2></div>
        <ol><li><i>01</i><span><b>Hesabını oluştur</b><small>SW Identity ile güvenli merkezini aç.</small></span></li><li><i>02</i><span><b>Platformunu bağla</b><small>Kick ve Play Connect bağlantılarını tamamla.</small></span></li><li><i>03</i><span><b>Uygulamayı indir</b><small>Tüm araçlarına masaüstünden eriş.</small></span></li></ol>
      </section>

      <section class="ps8-final-cta" aria-labelledby="ps8-final-title">
        <img src="./play-streamers-ps-logo.svg?v=10.6" alt="Play Streamers PS logosu">
        <span>WINDOWS 10/11 · SÜRÜM 0.14.4</span>
        <h2 id="ps8-final-title">Yayınını değil,<br>sistemini büyüt.</h2>
        <p>Hesabını ücretsiz oluştur. Play Streamers Desktop'ı indir ve üretim araçlarını tek sade merkezde kullanmaya başla.</p>
        <div><a href="./downloads/Play-Streamers-Setup.exe" download>Uygulamayı ücretsiz indir <i>↓</i></a><button type="button" data-ps8-action="register">Hesap oluştur</button></div>
        <small>Doğrudan kurulum dosyası Windows yayınevi imzası tamamlanana kadar SmartScreen uyarısı gösterebilir.</small>
      </section>`;
    current.replaceWith(home);
    activatePublicMotion(home);
    activatePlanTabs(home);
    scheduleAstronaut(home);
    root.querySelector('.landing-update-preview')?.setAttribute('aria-hidden', 'true');
  }

  function normalize(root = document) {
    document.documentElement.dataset.psSiteVersion = '9';
    document.body.classList.remove('ps-v7');
    document.body.classList.add('ps-v8', 'ps-v9');
    ensurePremiumAmbient();
    ensurePublicHome();
    normalizePublicMetrics();
    const publicMetrics = document.querySelector('#authOverlay .ps61-site-metrics');
    const hero = document.querySelector('#authOverlay .ps81-hero');
    if (publicMetrics && hero && publicMetrics.parentElement !== hero) {
      publicMetrics.classList.add('ps10-hero-metrics');
      hero.append(publicMetrics);
    }
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
    if (publicSurface && !publicSurface.hidden && document.body.classList.contains('auth-locked')) {
      publicSurface.style.overflowY = 'auto';
      publicSurface.style.touchAction = 'pan-y';
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
  const normalizationObserver = new MutationObserver((records) => {
    const relevant = records.some((record) => {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (!target) return false;
      if (target.closest('.ps61-site-metrics,#ps44StatusPopover,#ps55Notifications,.ps-tooltip')) return false;
      if (record.type === 'attributes') return target.matches('#authOverlay,#psSecondHome,.app,#ps49InfoPage,#ps51AccountCenter,.landing-auth-modal');
      return [...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE && (node.matches?.('#authOverlay,#psSecondHome,.app,#ps49InfoPage,#ps51AccountCenter,.landing-auth-modal') || node.querySelector?.('#authOverlay,#psSecondHome,.app,#ps49InfoPage,#ps51AccountCenter,.landing-auth-modal')));
    });
    if (relevant) queue();
  });
  normalizationObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden','aria-hidden'] });
  const infoPaths = { about: '#hakkimizda', products: '#urunlerimiz', how: '#nasil-calisir' };
  document.addEventListener('click', (event) => {
    const publicBrand = event.target instanceof Element ? event.target.closest('#authOverlay .landing-brand') : null;
    if (publicBrand) {
      const root = document.getElementById('authOverlay');
      if (root && !root.hidden) {
        event.preventDefault();
        event.stopImmediatePropagation();
        publicBrand.classList.remove('ps10-brand-return');
        void publicBrand.offsetWidth;
        publicBrand.classList.add('ps10-brand-return');
        root.querySelectorAll('.ps14-nav-links button').forEach((button) => {
          button.classList.remove('active');
          button.removeAttribute('aria-current');
        });
        root.scrollTo({ top: 0, behavior: 'smooth' });
        history.pushState(null, '', '/');
        document.title = 'Play Streamers — Yayıncı Merkezi';
        window.setTimeout(() => publicBrand.classList.remove('ps10-brand-return'), 650);
        return;
      }
    }
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
        navigatePublicHome('products');
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
    if (!path) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    navigatePublicHome(key);
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
