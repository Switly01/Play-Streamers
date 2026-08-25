(() => {
  'use strict';
  const API = 'https://api.pstreamers.com';
  const STORAGE_KEY = 'play-streamers-v17-site';
  let pending = null;
  let lastRefresh = 0;
  let lastData = null;

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
    return hours ? `${hours} sa ${minutes} dk` : `${minutes} dk`;
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
    card.setAttribute('aria-label', 'Sunucudan otomatik yayın analizi');
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
    const ended = latest?.endedAt ? new Date(latest.endedAt).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'İlk yayın bekleniyor';

    card.replaceChildren();
    const header = document.createElement('header');
    const title = document.createElement('div');
    const kicker = document.createElement('span');
    const heading = document.createElement('b');
    const state = document.createElement('i');
    kicker.textContent = 'SUNUCU VERİ HATTI';
    heading.textContent = isLive ? (monitor.title || 'Yayın otomatik ölçülüyor') : 'Uygulama kapalıyken de ölçüm açık';
    state.className = `ps-server-state${isLive ? ' live' : ''}`;
    state.textContent = isLive ? '● CANLI' : monitor.connected ? 'HAZIR' : 'KICK BAĞLANTISI GEREKİYOR';
    title.append(kicker, heading);
    header.append(title, state);

    const metrics = document.createElement('div');
    metrics.className = 'ps-server-metrics';
    metrics.append(
      metric(isLive ? 'Anlık izleyici' : 'Son yayın ortalaması', isLive ? String(monitor.currentViewers || 0) : (latest ? String(average) : '—'), isLive ? 'Dakikalık sunucu örneği' : ended),
      metric('Tepe izleyici', latest ? String(latest.peakViewers || 0) : '—', 'Kick API ölçümü'),
      metric('Etkileşim', latest ? String(latest.interactions || 0) : '—', latest ? `+${latest.followersGained || 0} takipçi` : 'İmzalı olay bekleniyor'),
      metric('Yayın süresi', latest ? durationLabel(latest.summary?.durationSeconds || ((latest.endedAt - latest.startedAt) / 1000)) : '—', 'Sunucu oturumu')
    );

    const footer = document.createElement('div');
    footer.className = 'ps-server-foot';
    const copy = document.createElement('span');
    const health = document.createElement('strong');
    copy.textContent = 'Siteyi, uygulamayı veya eklentiyi kapatsan da Kick bağlantın açık kaldığı sürece yayın oturumu sunucuda oluşur.';
    health.textContent = monitor.healthy === false ? 'Ölçüm yeniden denenecek' : 'Otomatik ve sunucu tabanlı';
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
    kicker.textContent = 'SUNUCU VERİ HATTI';
    heading.textContent = message;
    state.className = 'ps-server-state error';
    state.textContent = navigator.onLine ? 'YENİDEN DENENECEK' : 'ÇEVRİMDIŞI';
    title.append(kicker, heading);
    header.append(title, state);
    const copy = document.createElement('p');
    copy.className = 'ps-server-empty';
    copy.textContent = 'Mevcut yayın verilerin kaybolmaz. Bağlantı geri geldiğinde bu alan otomatik olarak yenilenir.';
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
  window.setInterval(() => { if (!document.hidden) void refresh(); }, 60_000);
  void refresh(true);
})();
