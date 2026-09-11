(() => {
  'use strict';
  const API = 'https://api.pstreamers.com';
  const allowed = new Set(['hero','links','schedule','live','announcement','video','equipment','text','support']);
  let root = null;

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  };
  const safeLink = value => {
    try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.toString() : ''; }
    catch { return ''; }
  };
  const label = type => ({hero:'Yayıncı sayfası',links:'Bağlantılar',schedule:'Yayın takvimi',live:'Canlı durum',announcement:'Duyuru',video:'Video ve klip',equipment:'Ekipman',text:'Özel içerik',support:'Destek'})[type] || 'Bölüm';

  function destroy() {
    root?.remove();
    root = null;
    document.documentElement.classList.remove('ps-creator-page-open');
  }

  function card(block, live) {
    const article = node('article', `pscp-card ${block.width === 'half' ? 'half' : 'full'}`);
    const liveNow = block.type === 'live' && live?.status === 'live';
    article.append(node('small', liveNow ? 'live' : '', liveNow ? '● ŞİMDİ CANLI' : label(block.type).toLocaleUpperCase('tr-TR')));
    article.append(node('h2', '', liveNow && live.title ? live.title : block.title));
    const body = node('p');
    String(liveNow && Number.isFinite(live.currentViewers) ? `${live.currentViewers} izleyici yayında\n${block.body || ''}` : block.body || '').split('\n').forEach((line, index) => {
      if (index) body.append(document.createElement('br'));
      body.append(document.createTextNode(line));
    });
    article.append(body);
    const href = safeLink(block.url);
    if (href) {
      const anchor = node('a', '', `${block.label || 'Aç'} ↗`);
      anchor.href = href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      article.append(anchor);
    }
    return article;
  }

  async function render(slug) {
    destroy();
    document.documentElement.classList.add('ps-creator-page-open');
    root = node('main', 'pscp-root');
    root.append(node('div', 'pscp-loading', 'Yayıncı sayfası hazırlanıyor…'));
    document.body.append(root);
    try {
      const response = await fetch(`${API}/api/public/creator-pages/${encodeURIComponent(slug)}`, { cache: 'no-store', credentials: 'omit' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.page) throw new Error(payload?.error || 'Yayıncı sayfası bulunamadı.');
      const page = payload.page;
      root.className = `pscp-root background-${['aurora','midnight','sunset','mono'].includes(page.background) ? page.background : 'aurora'} surface-${page.surface === 'solid' ? 'solid' : 'glass'}`;
      root.style.setProperty('--pscp-accent', /^#[0-9a-f]{6}$/i.test(page.accent) ? page.accent : '#8ca8ff');
      root.style.setProperty('--pscp-radius', `${Math.min(36, Math.max(8, Number(page.radius) || 24))}px`);
      root.replaceChildren();
      const shell = node('div', 'pscp-shell');
      const brand = node('a', 'pscp-brand'); brand.href = '/'; brand.append(node('span', '', 'PS'), node('strong', '', 'PLAY STREAMERS'), node('small', '', `@${page.slug || slug}`));
      const intro = node('header', 'pscp-intro');
      const avatar = node('span', 'pscp-avatar', String(page.title || 'Y').slice(0,1).toLocaleUpperCase('tr-TR'));
      const avatarUrl = safeLink(page.avatarUrl);
      if (avatarUrl) {
        const image = node('img'); image.src = avatarUrl; image.alt = 'Yayıncı profil resmi';
        image.addEventListener('error', () => image.remove(), { once:true }); avatar.append(image);
      }
      intro.append(avatar);
      const copy = node('div'); copy.append(node('h1', '', page.title || 'Yayıncı sayfası'), node('p', '', page.bio || '')); intro.append(copy);
      const grid = node('section', 'pscp-grid');
      (Array.isArray(page.blocks) ? page.blocks : []).filter(block => block?.visible !== false && allowed.has(block?.type)).slice(0,24).forEach(block => grid.append(card(block, payload.live)));
      shell.append(brand, intro, grid, node('footer', '', 'PLAY STREAMERS İLE HAZIRLANDI'));
      root.append(node('div', 'pscp-orb one'), node('div', 'pscp-orb two'), shell);
      document.title = `${page.title || slug} · Play Streamers`;
    } catch (error) {
      root.replaceChildren();
      const empty = node('section', 'pscp-error'); empty.append(node('span', '', 'PS'), node('h1', '', 'Bu sayfa henüz yayında değil.'), node('p', '', error instanceof Error ? error.message : 'Yayıncı sayfası alınamadı.'));
      const back = node('a', '', 'Play Streamers ana sayfasına dön'); back.href = '/'; empty.append(back); root.append(empty);
    }
  }

  window.psCreatorPage = { render, destroy };
})();
