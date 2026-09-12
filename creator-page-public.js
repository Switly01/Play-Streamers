(() => {
  'use strict';
  const API = 'https://api.pstreamers.com';
  const allowed = new Set(['hero','links','schedule','live','announcement','video','equipment','text','support','socials','music','location','countdown','gallery']);
  const labels = {hero:'Yayıncı sayfası',links:'Bağlantı kartı',schedule:'Yayın takvimi',live:'Canlı durum',announcement:'Duyuru',video:'Video ve klip',equipment:'Yayın kurulumu',text:'Serbest bölüm',support:'Destek kartı',socials:'Sosyal simgeler',music:'Müzik çalar',location:'Konum ve saat',countdown:'Geri sayım',gallery:'Görsel galeri'};
  let root = null;
  const node = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = String(text); return element; };
  const safeLink = value => { try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.toString() : ''; } catch { return ''; } };
  const validColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
  const within = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;

  function appearance(page) {
    const source = page.appearance && typeof page.appearance === 'object' ? page.appearance : { accent:page.accent, background:page.background, radius:page.radius, cardOpacity:page.surface === 'solid' ? 100 : 62, cardBlur:page.surface === 'solid' ? 0 : 24 };
    const pick = (value, choices, fallback) => choices.includes(value) ? value : fallback;
    return {
      layout:pick(source.layout,['centered','split','compact','portfolio'],'centered'), background:pick(source.background,['aurora','midnight','sunset','mono','ocean','neon'],'aurora'), backgroundType:pick(source.backgroundType,['preset','image','video'],'preset'), backgroundUrl:safeLink(source.backgroundUrl), backgroundColor:validColor(source.backgroundColor,'#070a11'), accent:validColor(source.accent,'#8ca8ff'), secondary:validColor(source.secondary,'#a05cff'), textColor:validColor(source.textColor,'#f6f8ff'), mutedColor:validColor(source.mutedColor,'#b7c0d0'), cardColor:validColor(source.cardColor,'#121724'), cardOpacity:within(source.cardOpacity,10,100,62), cardBlur:within(source.cardBlur,0,42,24), radius:within(source.radius,4,40,24), contentWidth:within(source.contentWidth,680,1320,1040), alignment:pick(source.alignment,['left','center'],'left'), font:pick(source.font,['modern','rounded','editorial','mono'],'modern'), buttonStyle:pick(source.buttonStyle,['solid','glass','outline'],'solid'), effect:pick(source.effect,['orbs','stars','waves','plasma','spotlight','none'],'orbs'), effectIntensity:within(source.effectIntensity,0,100,65), motionSpeed:within(source.motionSpeed,0,100,55), animatedBorder:source.animatedBorder !== false, monochromeIcons:source.monochromeIcons === true, titleEffect:pick(source.titleEffect,['none','typewriter','glow'],'none'), cursor:pick(source.cursor,['default','glow','ring'],'glow'), avatarShape:pick(source.avatarShape,['rounded','circle','square'],'rounded'), showBranding:source.showBranding !== false,
    };
  }
  function destroy() { root?.remove(); root = null; document.documentElement.classList.remove('ps-creator-page-open'); }
  function lines(value) { const body = node('p'); String(value || '').split('\n').forEach((line,index) => { if (index) body.append(document.createElement('br')); body.append(document.createTextNode(line)); }); return body; }
  function countdown(value) { const target = Date.parse(String(value || '').trim()); if (!Number.isFinite(target)) return 'Tarih eklenmedi'; const total = Math.max(0,target-Date.now()); return `${Math.floor(total/86400000)} gün · ${Math.floor(total/3600000)%24} saat · ${Math.floor(total/60000)%60} dakika`; }
  function linkButton(block) { const href=safeLink(block.url); if (!href || ['socials','gallery','music'].includes(block.type)) return null; const anchor=node('a','pscp-link',`${block.label || 'Aç'} ↗`); anchor.href=href; anchor.target='_blank'; anchor.rel='noopener noreferrer'; return anchor; }
  function socialList(page) {
    const list=node('div','pscp-socials');
    (Array.isArray(page.socials)?page.socials:[]).filter(item=>item?.visible!==false).slice(0,24).forEach(item=>{
      const icon=node('i','',String(item.platform||'W').slice(0,1).toUpperCase());
      if(item.mode==='copy') { const button=node('button',''); button.type='button'; button.append(icon,node('span','',item.label||item.platform||'Kopyala')); button.addEventListener('click',()=>navigator.clipboard?.writeText(String(item.value||'')).then(()=>{button.lastChild.textContent='Kopyalandı';setTimeout(()=>button.lastChild.textContent=item.label||item.platform||'Kopyala',1200)}).catch(()=>{})); list.append(button); }
      else { const href=safeLink(item.url); if(!href)return; const anchor=node('a',''); anchor.href=href; anchor.target='_blank'; anchor.rel='noopener noreferrer'; anchor.append(icon,node('span','',item.label||item.platform||'Aç')); list.append(anchor); }
    }); return list;
  }
  function card(block, page, live) {
    const article=node('article',`pscp-card ${block.width==='half'?'half':'full'} type-${block.type}`), liveNow=block.type==='live'&&live?.status==='live';
    article.append(node('small',liveNow?'live':'',liveNow?'● ŞİMDİ CANLI':String(labels[block.type]||'Bölüm').toLocaleUpperCase('tr-TR')),node('h2','',liveNow&&live.title?live.title:block.title));
    if(block.type==='socials') article.append(socialList(page));
    else if(block.type==='gallery') { const gallery=node('div','pscp-gallery'); String(block.body||'').split(/\r?\n/).map(safeLink).filter(Boolean).slice(0,8).forEach(url=>{const image=node('img');image.src=url;image.alt='Galeri görseli';image.loading='lazy';gallery.append(image)}); article.append(gallery); }
    else if(block.type==='countdown') article.append(node('strong','pscp-countdown',countdown(block.body)),lines(block.label));
    else if(block.type==='music') article.append(lines(page.audio?.enabled?page.audio.title:'Müzik çalar kapalı'));
    else article.append(lines(liveNow&&Number.isFinite(live.currentViewers)?`${live.currentViewers} izleyici yayında\n${block.body||''}`:block.body));
    const link=linkButton(block); if(link)article.append(link); return article;
  }
  function setMeta(page) {
    document.title=`${page.seo?.title||page.title||'Yayıncı sayfası'} · Play Streamers`;
    const set=(selector,attribute,value)=>{if(!value)return;let item=document.head.querySelector(selector);if(!item){item=document.createElement('meta');document.head.append(item)}item.setAttribute(attribute,value)};
    set('meta[name="description"]','content',String(page.seo?.description||page.bio||'').slice(0,220));
    set('meta[property="og:title"]','content',String(page.seo?.title||page.title||'').slice(0,80));
    set('meta[property="og:description"]','content',String(page.seo?.description||page.bio||'').slice(0,220));
    set('meta[property="og:image"]','content',safeLink(page.seo?.imageUrl));
    const favicon=safeLink(page.seo?.faviconUrl);if(favicon){let link=document.head.querySelector('link[rel="icon"]');if(!link){link=document.createElement('link');link.rel='icon';document.head.append(link)}link.href=favicon}
  }
  function track(slug,event,key='') {
    void fetch(`${API}/api/public/creator-pages/${encodeURIComponent(slug)}/analytics`,{method:'POST',credentials:'omit',keepalive:true,signal:AbortSignal.timeout(2500),headers:{'content-type':'application/json'},body:JSON.stringify({event,key})}).catch(()=>{});
  }
  async function render(slug) {
    destroy(); document.documentElement.classList.add('ps-creator-page-open'); root=node('main','pscp-root'); root.append(node('div','pscp-loading','Yayıncı sayfası hazırlanıyor…')); document.body.append(root);
    try {
      const response=await fetch(`${API}/api/public/creator-pages/${encodeURIComponent(slug)}`,{cache:'no-store',credentials:'omit'}),payload=await response.json().catch(()=>null); if(!response.ok||!payload?.page)throw new Error(payload?.error||'Yayıncı sayfası bulunamadı.');
      const page=payload.page,a=appearance(page),font={modern:'"Plus Jakarta Sans","Segoe UI",sans-serif',rounded:'Nunito,"Segoe UI",sans-serif',editorial:'Georgia,"Times New Roman",serif',mono:'"JetBrains Mono",Consolas,monospace'}[a.font];
      root.className=['pscp-root',`layout-${a.layout}`,`background-${a.background}`,`effect-${a.effect}`,`align-${a.alignment}`,`buttons-${a.buttonStyle}`,`cursor-${a.cursor}`,a.animatedBorder?'animated-border':'',a.monochromeIcons?'mono-icons':''].filter(Boolean).join(' ');
      [['--pscp-accent',a.accent],['--pscp-secondary',a.secondary],['--pscp-text',a.textColor],['--pscp-muted',a.mutedColor],['--pscp-card',a.cardColor],['--pscp-card-opacity',`${a.cardOpacity}%`],['--pscp-blur',`${a.cardBlur}px`],['--pscp-radius',`${a.radius}px`],['--pscp-width',`${a.contentWidth}px`],['--pscp-effect-opacity',`${a.effectIntensity/100}`],['--pscp-motion',`${Math.max(3,16-a.motionSpeed*.11)}s`],['--pscp-font',font]].forEach(([key,value])=>root.style.setProperty(key,value)); root.style.backgroundColor=a.backgroundColor;
      if(a.backgroundType==='image'&&a.backgroundUrl)root.style.backgroundImage=`linear-gradient(#05070a55,#05070a99),url(${JSON.stringify(a.backgroundUrl)})`;
      root.replaceChildren(); if(a.backgroundType==='video'&&a.backgroundUrl){const video=node('video','pscp-background-video');video.src=a.backgroundUrl;video.autoplay=true;video.muted=true;video.loop=true;video.playsInline=true;root.append(video)} root.append(node('div','pscp-shade'));
      const effects=node('div','pscp-effects');for(let i=0;i<5;i++)effects.append(node('i'));root.append(effects);
      const shell=node('div','pscp-shell'),brand=node('a','pscp-brand');brand.href='/';brand.append(node('span','','PS'),node('strong','','PLAY STREAMERS'),node('small','',`@${page.slug||slug}`));shell.append(brand);
      const banner=safeLink(page.bannerUrl);if(banner){const item=node('div','pscp-banner');item.style.backgroundImage=`url(${JSON.stringify(banner)})`;shell.append(item)}
      const intro=node('header','pscp-intro'),avatar=node('span',`pscp-avatar avatar-${a.avatarShape}`,String(page.title||'Y').slice(0,1).toLocaleUpperCase('tr-TR')),avatarUrl=safeLink(page.profileImageUrl)||safeLink(page.avatarUrl);if(avatarUrl){const image=node('img');image.src=avatarUrl;image.alt='Yayıncı profil resmi';image.addEventListener('error',()=>image.remove(),{once:true});avatar.append(image)} intro.append(avatar);const copy=node('div');copy.append(node('h1',`title-${a.titleEffect}`,page.title||'Yayıncı sayfası'),node('p','',page.bio||''));intro.append(copy);shell.append(intro);
      const grid=node('section','pscp-grid');(Array.isArray(page.blocks)?page.blocks:[]).filter(block=>block?.visible!==false&&allowed.has(block?.type)).slice(0,32).forEach(block=>grid.append(card(block,page,payload.live)));shell.append(grid);if(a.showBranding)shell.append(node('footer','','PLAY STREAMERS İLE HAZIRLANDI'));root.append(shell);
      if(page.audio?.enabled&&safeLink(page.audio.url)){const dock=node('div','pscp-audio'),cover=node('span','',page.audio.coverUrl?'':'♫');if(safeLink(page.audio.coverUrl)){const image=node('img');image.src=safeLink(page.audio.coverUrl);image.alt='';cover.append(image)}const info=node('div');info.append(node('strong','',page.audio.title||'Sayfa müziği'),node('small','',`Sayfa müziği · ${within(page.audio.volume,0,100,45)}%`));const audio=node('audio');audio.controls=true;audio.loop=page.audio.loop!==false;audio.src=safeLink(page.audio.url);audio.volume=within(page.audio.volume,0,100,45)/100;dock.append(cover,info,audio);root.append(dock)}
      if(page.entrance?.enabled){const entrance=node('div','pscp-entrance'),box=node('div');box.append(node('span','','PS'),node('h2','',page.entrance.title||'Yayınıma hoş geldin'),node('p','',page.entrance.subtitle||'Sayfaya girmek için dokun'));const button=node('button','',page.entrance.button||'Sayfaya gir');button.addEventListener('click',()=>entrance.remove());box.append(button);entrance.append(box);root.append(entrance)} setMeta(page);
      const viewKey=`pscp:view:${slug}`;try{if(!sessionStorage.getItem(viewKey)){sessionStorage.setItem(viewKey,'1');track(slug,'view')}}catch{track(slug,'view')}root.addEventListener('click',event=>{const target=event.target instanceof Element?event.target.closest('a,.pscp-socials button'):null;if(!target||target.classList.contains('pscp-brand'))return;const key=String(target.textContent||'link').trim().toLowerCase().replace(/[^a-z0-9ğüşöçı:_-]+/g,'-').slice(0,80)||'link';track(slug,'click',key)});
    } catch(error) { root.replaceChildren();const empty=node('section','pscp-error');empty.append(node('span','','PS'),node('h1','','Bu sayfa henüz yayında değil.'),node('p','',error instanceof Error?error.message:'Yayıncı sayfası alınamadı.'));const back=node('a','','Play Streamers ana sayfasına dön');back.href='/';empty.append(back);root.append(empty); }
  }
  window.psCreatorPage={render,destroy};
})();
