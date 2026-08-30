(() => {
  'use strict';
  const API = 'https://api.pstreamers.com';
  const STORAGE_KEY = 'play-streamers-v17-site';
  let pending = null;
  let lastRefresh = 0;
  let lastData = null;

  const ui = (source) => typeof window.psTranslateInterface === 'function'
    ? window.psTranslateInterface(source)
    : source;
  const interfaceLocale = () => ({ tr:'tr-TR', en:'en-US', de:'de-DE', es:'es-ES', fr:'fr-FR', ru:'ru-RU', ar:'ar-SA', ja:'ja-JP' })[
    String(localStorage.getItem('ps15-locale') || document.documentElement.lang || 'tr').split('-')[0]
  ] || 'en-US';
  const interpolate = (template, values) => Object.entries(values).reduce(
    (output, [key, value]) => output.replaceAll(`{${key}}`, String(value)),
    template
  );

  function readSession() {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return String(state?.settings?.userSession || state?.userSession || '');
    } catch {
      return '';
    }
  }

  function durationLabel(seconds) {
    const value = Math.max(0, Number(seconds || 0));
    if (!value) return '—';
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    return hours
      ? interpolate(ui('{hours} sa {minutes} dk'), { hours, minutes })
      : interpolate(ui('{minutes} dk'), { minutes });
  }

  function metric(label, value, detail) {
    const article = document.createElement('article');
    const name = document.createElement('span');
    const number = document.createElement('strong');
    const note = document.createElement('small');
    name.textContent = label;
    number.textContent = value;
    note.textContent = detail;
    article.append(name, number, note);
    return article;
  }

  function ensureCard() {
    const home = document.querySelector('#psSecondHome.ps20-member-home');
    const grid = home?.querySelector('.ps20-grid');
    if (!grid) return null;
    let card = grid.querySelector('.ps-server-analytics');
    if (card) return card;
    card = document.createElement('section');
    card.className = 'ps-server-analytics';
    card.setAttribute('aria-label', ui('Sunucudan otomatik yayın analizi'));
    grid.prepend(card);
    return card;
  }

  function homeIsVisible() {
    const home = document.querySelector('#psSecondHome.ps20-member-home');
    return Boolean(home && !home.hidden && getComputedStyle(home).display !== 'none');
  }

  function paint(data) {
    const card = ensureCard();
    if (!card) return;
    const monitor = data?.streamMonitor || {};
    const sessions = Array.isArray(data?.recentSessions) ? data.recentSessions : [];
    const latest = sessions.find((item) => Number(item?.endedAt || 0) > 0) || null;
    const isLive = monitor.status === 'live';
    const average = Number(latest?.summary?.averageViewers || 0);
    const ended = latest?.endedAt ? new Date(latest.endedAt).toLocaleString(interfaceLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ui('İlk yayın bekleniyor');

    card.replaceChildren();
    const header = document.createElement('header');
    const title = document.createElement('div');
    const kicker = document.createElement('span');
    const heading = document.createElement('b');
    const state = document.createElement('i');
    card.setAttribute('aria-label', ui('Sunucudan otomatik yayın analizi'));
    kicker.textContent = ui('SUNUCU VERİ HATTI');
    heading.textContent = isLive ? (monitor.title || ui('Yayın otomatik ölçülüyor')) : ui('Uygulama kapalıyken de ölçüm açık');
    state.className = `ps-server-state${isLive ? ' live' : ''}`;
    state.textContent = isLive ? ui('● CANLI') : monitor.connected ? ui('HAZIR') : ui('KICK BAĞLANTISI GEREKİYOR');
    title.append(kicker, heading);
    header.append(title, state);

    const metrics = document.createElement('div');
    metrics.className = 'ps-server-metrics';
    metrics.append(
      metric(ui(isLive ? 'Anlık izleyici' : 'Son yayın ortalaması'), isLive ? String(monitor.currentViewers || 0) : (latest ? String(average) : '—'), isLive ? ui('Dakikalık sunucu örneği') : ended),
      metric(ui('Tepe izleyici'), latest ? String(latest.peakViewers || 0) : '—', ui('Kick API ölçümü')),
      metric(ui('Etkileşim'), latest ? String(latest.interactions || 0) : '—', latest ? interpolate(ui('+{count} takipçi'), { count: latest.followersGained || 0 }) : ui('İmzalı olay bekleniyor')),
      metric(ui('Yayın süresi'), latest ? durationLabel(latest.summary?.durationSeconds || ((latest.endedAt - latest.startedAt) / 1000)) : '—', ui('Sunucu oturumu'))
    );

    const footer = document.createElement('div');
    footer.className = 'ps-server-foot';
    const copy = document.createElement('span');
    const health = document.createElement('strong');
    copy.textContent = ui('Siteyi, uygulamayı veya eklentiyi kapatsan da Kick bağlantın açık kaldığı sürece yayın oturumu sunucuda oluşur.');
    health.textContent = monitor.healthy === false ? ui('Ölçüm yeniden denenecek') : ui('Otomatik ve sunucu tabanlı');
    footer.append(copy, health);
    card.append(header, metrics, footer);
  }

  function paintError(message = 'Sunucu verisine şu anda ulaşılamıyor') {
    const card = ensureCard();
    if (!card || lastData) return;
    card.replaceChildren();
    const header = document.createElement('header');
    const title = document.createElement('div');
    const kicker = document.createElement('span');
    const heading = document.createElement('b');
    const state = document.createElement('i');
    card.setAttribute('aria-label', ui('Sunucudan otomatik yayın analizi'));
    kicker.textContent = ui('SUNUCU VERİ HATTI');
    heading.textContent = ui(message);
    state.className = 'ps-server-state error';
    state.textContent = navigator.onLine ? ui('YENİDEN DENENECEK') : ui('ÇEVRİMDIŞI');
    title.append(kicker, heading);
    header.append(title, state);
    const copy = document.createElement('p');
    copy.className = 'ps-server-empty';
    copy.textContent = ui('Mevcut yayın verilerin kaybolmaz. Bağlantı geri geldiğinde bu alan otomatik olarak yenilenir.');
    card.append(header, copy);
  }

  async function refresh(force = false) {
    const token = readSession();
    if (!token || !ensureCard()) return;
    if (!homeIsVisible()) return;
    if (!force && Date.now() - lastRefresh < 45_000) return;
    if (pending) return pending;
    pending = fetch(`${API}/api/platform/bootstrap`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (response) => {
      const data = await response.json().catch(() => null);
      if (response.ok && data?.signedIn) {
        lastRefresh = Date.now();
        lastData = data;
        paint(data);
      } else if (response.status !== 401) {
        paintError();
      }
    }).catch(() => paintError()).finally(() => { pending = null; });
    return pending;
  }

  let mutationRefreshQueued = false;
  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      if (mutation.type === 'attributes') return mutation.target.id === 'psSecondHome';
      return [...mutation.addedNodes].some((node) => node.nodeType === 1 && (node.matches?.('#psSecondHome,.ps20-grid') || node.querySelector?.('#psSecondHome,.ps20-grid')));
    });
    if (!relevant || mutationRefreshQueued) return;
    mutationRefreshQueued = true;
    window.requestAnimationFrame(() => {
      mutationRefreshQueued = false;
      if (ensureCard() && homeIsVisible()) void refresh();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(true); });
  window.addEventListener('online', () => { lastData = null; void refresh(true); });
  window.addEventListener('offline', () => { if (homeIsVisible()) paintError(); });
  const repaintForLocale = () => {
    if (lastData) paint(lastData);
    else if (homeIsVisible()) paintError();
  };
  window.addEventListener('ps:locale-change', repaintForLocale);
  window.addEventListener('ps:i18n-ready', repaintForLocale);
  window.setInterval(() => { if (!document.hidden) void refresh(); }, 60_000);
  void refresh(true);
})();
