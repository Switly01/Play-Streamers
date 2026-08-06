(() => {
  const KEY='play-streamers-v17-site'; const API_BASE='https://api.pstreamers.com'; let removalTimers=new Set(); let activeKickSession=''; let activeUserSession=''; let kickConnectionStatus='Giriş yapılmadı'; let liveInfo={state:'idle',message:'Kick bağlantısı bekleniyor'}; let landingMode=true; const resumeAccountFlow=sessionStorage.getItem('play-streamers-account-flow')==='1';
  const empty=()=>({settings:{kickSession:activeKickSession,kickAccount:null,userSession:activeUserSession,user:null},events:{followers:[],subs:{},kicks:[],gifts:[],donations:[]},totals:{followers:0,kicks:0,donations:0,gifts:0},stats:{subs:{},joined:{},gifts:{month:{},all:{}},kicks:{month:{},all:{}},donations:{month:{},all:{}}}});
  let state=JSON.parse(localStorage.getItem(KEY)||'null')||empty(); const stateDefaults=empty();
  state.settings={...stateDefaults.settings,...(state.settings&&typeof state.settings==='object'?state.settings:{})};
  state.events={...stateDefaults.events,...(state.events&&typeof state.events==='object'?state.events:{})};
  state.events.followers=Array.isArray(state.events.followers)?state.events.followers:[];state.events.kicks=Array.isArray(state.events.kicks)?state.events.kicks:[];state.events.gifts=Array.isArray(state.events.gifts)?state.events.gifts:[];state.events.donations=Array.isArray(state.events.donations)?state.events.donations:[];state.events.subs=state.events.subs&&typeof state.events.subs==='object'?state.events.subs:{};
  state.totals={...stateDefaults.totals,...(state.totals&&typeof state.totals==='object'?state.totals:{})};state.stats={...stateDefaults.stats,...(state.stats&&typeof state.stats==='object'?state.stats:{})};state.stats.subs=state.stats.subs&&typeof state.stats.subs==='object'?state.stats.subs:{};state.stats.joined=state.stats.joined&&typeof state.stats.joined==='object'?state.stats.joined:{};['gifts','kicks','donations'].forEach(key=>{const current=state.stats[key]&&typeof state.stats[key]==='object'?state.stats[key]:{};state.stats[key]={month:current.month&&typeof current.month==='object'?current.month:{},all:current.all&&typeof current.all==='object'?current.all:{}};});
  let legacySettingsRemoved=false; if('viewerSamples' in state.stats){delete state.stats.viewerSamples;legacySettingsRemoved=true} ['setupComplete','kickChannelUrl','donationAccounts'].forEach(key=>{if(key in state.settings){delete state.settings[key];legacySettingsRemoved=true}}); activeKickSession=state.settings.kickSession||''; activeUserSession=state.settings.userSession||''; const $=(s,root=document)=>root.querySelector(s); const $$=(s,root=document)=>[...root.querySelectorAll(s)];
  const save=()=>localStorage.setItem(KEY,JSON.stringify(state)); if(legacySettingsRemoved)save(); const oauthResult=new URLSearchParams(location.hash.slice(1)); let kickJustConnected=false; let googleJustConnected=false; if(oauthResult.get('kick_connected')==='1'&&oauthResult.get('kick_session')){activeKickSession=oauthResult.get('kick_session');state.settings.kickSession=activeKickSession;kickJustConnected=true}if(oauthResult.get('google_connected')==='1'&&oauthResult.get('user_session')){activeUserSession=oauthResult.get('user_session');state.settings.userSession=activeUserSession;googleJustConnected=true}if(googleJustConnected&&resumeAccountFlow){landingMode=false;sessionStorage.removeItem('play-streamers-account-flow')}if(kickJustConnected||googleJustConnected){save();history.replaceState(null,'',location.pathname+location.search)} const esc=s=>{const d=document.createElement('div');d.textContent=String(s??'');return d.innerHTML}; const month=()=>new Date().toISOString().slice(0,7); const dt=t=>new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short'}).format(new Date(t||Date.now()));
  const money=(n,c='TRY')=>(c==='TRY'?'₺':c+' ')+Number(n||0).toLocaleString('tr-TR',{maximumFractionDigits:2}); const id=()=>Math.random().toString(36).slice(2)+Date.now().toString(36); const hue=s=>[...String(s)].reduce((a,c)=>(a*31+c.charCodeAt(0))%360,0); const kickProfileUrl=()=>state.settings.kickAccount?.username?`https://kick.com/${encodeURIComponent(state.settings.kickAccount.username)}`:'';
  function notice(title,message,kind='i'){const n=document.createElement('article');n.className='notice';n.innerHTML=`<i>${kind}</i><div><strong>${esc(title)}</strong><p>${esc(message)}</p></div><button>×</button>`;n.querySelector('button').onclick=()=>n.remove();$('#notices').append(n);setTimeout(()=>n.remove(),5000)}
  function startKickLogin(){location.assign(`${API_BASE}/auth/kick/login`)}
  function installKickLoginControls(){}
  function renderKickConnectionStatus(){const row=$('#connectionList .con-row');if(!row)return;const account=state.settings.kickAccount;const small=$('small',row);const button=$('.refresh',row);const connected=Boolean(activeKickSession);small.textContent=connected?(account?.username?`Bağlı · @${account.username}`:kickConnectionStatus):'Giriş yapılmadı';button.textContent=connected?'⟳':'↗';button.title=connected?'Bağlantıyı yenile':'Kick ile giriş yap';button.onclick=()=>connected?refreshKickStatus(true):startKickLogin()}
  async function refreshKickStatus(showNotice=false){if(!activeKickSession){kickConnectionStatus='Giriş yapılmadı';renderKickConnectionStatus();return false}try{const res=await fetch(`${API_BASE}/api/kick/session`,{headers:{Authorization:`Bearer ${activeKickSession}`}});const data=await res.json();if(!res.ok||!data.connected){activeKickSession='';delete state.settings.kickSession;delete state.settings.kickAccount;save();kickConnectionStatus='Oturumun süresi doldu';renderKickConnectionStatus();if(showNotice)notice('Kick bağlantısı sona erdi','Tekrar Kick ile giriş yapmalısın.','!');return false}state.settings.kickAccount=data.account||state.settings.kickAccount||null;state.settings.kickSession=activeKickSession;save();kickConnectionStatus='Bağlı';renderKickConnectionStatus();if(showNotice)notice('Kick bağlantısı aktif',data.account?.username?`@${data.account.username} hesabı bağlı.`:'Hesabın başarıyla bağlandı.','✓');return true}catch{kickConnectionStatus='Bağlantı kontrol edilemedi';renderKickConnectionStatus();if(showNotice)notice('Kontrol başarısız','İnternet bağlantını kontrol edip tekrar dene.','!');return false}}
  function startGoogleLogin(){sessionStorage.setItem('play-streamers-account-flow','1');location.assign(`${API_BASE}/auth/google/login`)}
  function adultBirthDate(){const date=new Date();date.setFullYear(date.getFullYear()-18);return date.toISOString().slice(0,10)}
  function removeLandingAuth(){const modal=$('#landingAuthModal');if(modal)modal.remove()}
  function passwordMatch(form,error){const password=$('[name="password"]',form)?.value||'',repeat=$('[name="passwordRepeat"]',form)?.value||'';if(repeat&&password!==repeat){error.textContent='Şifreler birbiriyle aynı değil.';return false}error.textContent='';return true}
  async function sendAccountRequest(path,payload,session=false){try{const response=await fetch(`${API_BASE}${path}`,{method:'POST',headers:{'content-type':'application/json',...(session?{Authorization:`Bearer ${activeUserSession}`}:{})},body:JSON.stringify(payload)});let data={};try{data=await response.json()}catch{}return{response,data}}catch{return{response:{ok:false},data:{error:'Sunucuya ulaşılamadı. Cloudflare Worker kodunun en güncel sürümünü Deploy ettiğinden emin ol.'}}}}
  function completeSignIn(data,{emailMissing=false}={}){landingMode=false;activeUserSession=data.sessionId||activeUserSession;state.settings.userSession=activeUserSession;state.settings.user=data.user;save();removeLandingAuth();render();if(emailMissing)showEmailMissingNotice()}
  function showEmailMissingNotice(){const existing=$('#emailMissingNotice');if(existing)existing.remove();const layer=document.createElement('div');layer.className='account-blocker email-missing';layer.id='emailMissingNotice';layer.innerHTML='<section class="auth-dialog"><h2>E-postan bağlı değil</h2><p>Hesabın oluşturuldu. Şimdilik kullanıcı adın ve şifrenle giriş yapabilirsin. E-posta bağlama seçeneği daha sonra hesap ayarlarına eklenecek.</p><button class="auth-submit" id="emailMissingOkay">Tamam</button></section>';document.body.append(layer);$('#emailMissingOkay').onclick=()=>layer.remove()}
  function showGoogleCredentialSetup(){if($('#googleProfileSetup'))return;const layer=document.createElement('div');layer.className='account-blocker';layer.id='googleProfileSetup';layer.innerHTML='<section class="auth-dialog"><h2>Hesabını tamamla</h2><p>Google hesabın bağlandı. Panele geçmeden önce kullanıcı adı ve şifre belirlemelisin.</p><form class="auth-form" id="googleProfileForm"><label class="auth-field">Kullanıcı adı<input name="username" autocomplete="username" minlength="3" maxlength="24" required placeholder="ornek.kullanici"></label><label class="auth-field">Şifre<input name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="En az 8 karakter"></label><label class="auth-field">Şifre tekrar<input name="passwordRepeat" type="password" autocomplete="new-password" minlength="8" required placeholder="Şifreni yeniden yaz"></label><p class="auth-error" id="googleProfileError" aria-live="polite"></p><button class="auth-submit" type="submit">Hesabı tamamla</button></form></section>';document.body.append(layer);const form=$('#googleProfileForm'),error=$('#googleProfileError');$$('input[type="password"]',form).forEach(input=>input.oninput=()=>passwordMatch(form,error));form.onsubmit=async event=>{event.preventDefault();if(!passwordMatch(form,error))return;const payload={username:$('[name="username"]',form).value,password:$('[name="password"]',form).value,passwordRepeat:$('[name="passwordRepeat"]',form).value};const {response,data}=await sendAccountRequest('/api/auth/complete-google-profile',payload,true);if(!response.ok){error.textContent=data.error||'Hesap tamamlanamadı.';return}state.settings.user=data.user;save();layer.remove();document.body.classList.remove('onboarding-locked');render();notice('Hesabın hazır','Kullanıcı adı ve şifren kaydedildi.','✓')}}
  function showLandingAuth(mode){removeLandingAuth();const isLogin=mode==='login';const layer=document.createElement('div');layer.className='landing-auth-modal';layer.id='landingAuthModal';const fields=isLogin?'<label class="auth-field">Kullanıcı adı veya e-posta<input name="identity" autocomplete="username" required placeholder="kullaniciadi veya e-posta"></label><label class="auth-field">Şifre<input name="password" type="password" autocomplete="current-password" required placeholder="Şifren"></label>':'<label class="auth-field">Kullanıcı adı<input name="username" autocomplete="username" minlength="3" maxlength="24" required placeholder="ornek.kullanici"></label><label class="auth-field">Şifre<input name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="En az 8 karakter"></label><label class="auth-field">Şifre tekrar<input name="passwordRepeat" type="password" autocomplete="new-password" minlength="8" required placeholder="Şifreni yeniden yaz"></label><label class="auth-field">Doğum tarihi<input name="birthDate" type="date" max="'+adultBirthDate()+'" required></label>';layer.innerHTML=`<section class="auth-dialog"><button class="auth-close" type="button" aria-label="Kapat">×</button><span class="eyebrow">PLAY STREAMERS</span><h2>${isLogin?'Tekrar hoş geldin':'Hesabını oluştur'}</h2><p>${isLogin?'Kullanıcı adın veya bağlı e-posta adresin ile giriş yap.':'Kayıt olmak için en az 18 yaşında olmalısın.'}</p><form class="auth-form" id="landingAuthForm">${fields}<p class="auth-error" id="landingAuthError" aria-live="polite"></p><button class="auth-submit" type="submit">${isLogin?'Giriş yap':'Kayıt ol'}</button><div class="auth-divider">veya</div><button class="auth-secondary" type="button" id="modalGoogle">Google ile ${isLogin?'giriş yap':'kayıt ol'}</button></form></section>`;document.body.append(layer);$('.auth-close',layer).onclick=removeLandingAuth;layer.onclick=event=>{if(event.target===layer)removeLandingAuth()};$('#modalGoogle',layer).onclick=startGoogleLogin;const form=$('#landingAuthForm',layer),error=$('#landingAuthError',layer);if(!isLogin)$$('input[type="password"]',form).forEach(input=>input.oninput=()=>passwordMatch(form,error));form.onsubmit=async event=>{event.preventDefault();if(!isLogin&&!passwordMatch(form,error))return;const payload=isLogin?{identity:$('[name="identity"]',form).value,password:$('[name="password"]',form).value}:{username:$('[name="username"]',form).value,password:$('[name="password"]',form).value,passwordRepeat:$('[name="passwordRepeat"]',form).value,birthDate:$('[name="birthDate"]',form).value};const {response,data}=await sendAccountRequest(isLogin?'/api/auth/login':'/api/auth/register',payload);if(!response.ok){error.textContent=data.error||'İşlem şu an tamamlanamadı.';return}completeSignIn(data,{emailMissing:Boolean(data.emailMissing)})}}
  function openAccountFlow(mode){if(activeUserSession&&state.settings.user){landingMode=false;removeLandingAuth();renderUserAuth();return}showLandingAuth(mode)}
  window.psOpenLandingAuth = openAccountFlow;
  function installUserAuthControls(){if(!$('#googleAccountBtn')){const b=document.createElement('button');b.type='button';b.className='login';b.id='googleAccountBtn';b.onclick=()=>activeUserSession?logoutUser():openAccountFlow('login');$('.actions').prepend(b)}if(!$('#authOverlay')){const overlay=document.createElement('div');overlay.className='overlay';overlay.id='authOverlay';overlay.style.zIndex='120';overlay.innerHTML='<main class="landing-shell"><header class="landing-nav"><div class="landing-brand"><span class="brand-logo">PS</span><span>PLAY STREAMERS</span></div><div class="landing-actions"><button id="landingLogin">Giriş yap</button><button class="signup" id="landingSignup">Kayıt ol</button></div></header><section class="landing-main"><article class="landing-card"><span class="eyebrow">YAYINCILAR İÇİN TASARLANDI</span><h1>Yayınının nabzını tek ekranda gör.</h1><p>Play Streamers; Kick olaylarını, aboneliklerini, hediyelerini ve desteklerini sade ama güçlü bir yayıncı merkezinde toplar. Yayın sürerken neler olduğunu kaçırmadan topluluğuna odaklan.</p><ul class="landing-points"><li><i>✓</i>Canlı yayın durumu</li><li><i>✓</i>Anlık olay akışı</li><li><i>✓</i>Topluluk istatistikleri</li><li><i>✓</i>Kişisel bağlantı merkezi</li></ul><div class="landing-trust"><span>Güvenli oturum</span><span>Kişisel panel</span><span>Yayın odaklı</span></div><p class="landing-cta">Başlamak için sağ üstteki Giriş yap veya Kayıt ol düğmesini kullan.</p></article><aside class="landing-product" aria-label="Play Streamers panel ön izlemesi"><section class="product-window"><header class="product-top"><span>PLAY STREAMERS · CANLI PANEL</span><span class="product-dots"><i></i><i></i><i></i></span></header><div class="product-grid"><article class="preview-card"><span class="preview-kicker">YAYIN DURUMU</span><div class="preview-live"><i></i>YAYIN AÇIK</div><p class="preview-title">Topluluğun burada.</p><p class="preview-copy">Olaylar canlı olarak tek akışta görünür.</p></article><article class="preview-card"><span class="preview-kicker">BUGÜN</span><div class="mini-stat"><strong>248</strong><span>Kicks</span></div><div class="mini-bars"><i style="height:28%"></i><i></i><i></i><i></i><i></i><i></i></div></article><article class="preview-card wide"><span class="preview-kicker">SON OLAYLAR</span><div class="preview-events"><div class="preview-event"><i>K</i><b>Yeni abonelik</b><span>şimdi</span></div><div class="preview-event"><i>✦</i><b>Hediye abonelik</b><span>2 dk</span></div></div></article></div></section></aside></section><section class="landing-update-preview"><article class="landing-update-card"><header><div><span class="eyebrow">SON GÜNCELLEME</span><h2>2.1 · Hesap sistemi</h2><p>Kayıt ve giriş deneyimi artık tek bir hesap merkezinde.</p></div><time>13 Temmuz 2026</time></header><ul><li>Kullanıcı adı ve şifreyle güvenli kayıt/giriş eklendi.</li><li>18 yaş altı kayıtlar engellendi.</li><li>Google hesabıyla kayıt olanlar için zorunlu profil tamamlama ekranı eklendi.</li><li>Normal hesaplarda e-posta bağlı değil bilgilendirmesi eklendi.</li></ul></article></section><footer class="landing-footer"><span>Güvenli bağlantılar · Kişisel panel · Ücretsiz başlangıç</span><span>Developed by <strong>Switly</strong></span></footer></main>';document.body.append(overlay);$('#landingLogin').onclick=()=>openAccountFlow('login');$('#landingSignup').onclick=()=>openAccountFlow('register')}}
  function renderUserAuth(){installUserAuthControls();const button=$('#googleAccountBtn'),user=state.settings.user,ready=Boolean(activeUserSession&&user),needsSetup=Boolean(ready&&user.needsCredentialSetup),showLanding=landingMode||!ready;if(ready){button.innerHTML=`<span>HESABIM</span><strong>${esc(user.username||user.name||user.email||'Hesabım')}</strong>`;button.title='Çıkış yapmak için tıkla'}else if(activeUserSession){button.innerHTML='<span>HESABIM</span><strong>Hesap kontrol ediliyor</strong>';button.title=''}else{button.innerHTML='<span>HESAP</span><strong>Giriş yap</strong>';button.title=''}$('#authOverlay').hidden=!showLanding;document.body.classList.toggle('auth-locked',showLanding);document.body.classList.toggle('onboarding-locked',needsSetup&&!showLanding);if(needsSetup&&!showLanding)showGoogleCredentialSetup();else{$('#googleProfileSetup')?.remove()}}
  async function refreshUserSession(){if(!activeUserSession){renderUserAuth();return false}try{const res=await fetch(`${API_BASE}/api/auth/session`,{headers:{Authorization:`Bearer ${activeUserSession}`}});const data=await res.json();if(!res.ok||!data.signedIn){activeUserSession='';delete state.settings.userSession;delete state.settings.user;save();renderUserAuth();return false}state.settings.userSession=activeUserSession;state.settings.user=data.user;save();renderUserAuth();return true}catch{activeUserSession='';delete state.settings.userSession;delete state.settings.user;save();renderUserAuth();return false}}
  async function logoutUser(){if(!await askConfirm('Hesaptan çıkılsın mı?','Panel ayarların ve olayların cihazında kalır; yalnızca hesabın kapatılır.'))return;try{await fetch(`${API_BASE}/api/auth/logout`,{method:'POST',headers:{Authorization:`Bearer ${activeUserSession}`}})}catch{}landingMode=true;activeUserSession='';delete state.settings.userSession;delete state.settings.user;save();renderUserAuth();notice('Çıkış yapıldı','Hesabınla tekrar giriş yapabilirsin.','✓')}
  const releaseNotes=[{version:'Güncel iyileştirmeler',date:'23 Temmuz 2026',items:['Ana sayfa etkileşimleri ve destek alanı tekil hale getirildi.','Hesap menüsü, güncelleme notları ve ürün sayfası doğru hedeflere bağlandı.','Bağlantı durumu ve yükleme geçişleri güncel hesap durumuna göre düzenlendi.']}];
  releaseNotes[0].items.unshift('Ücretsiz Cloudflare Worker işlem sınırına uygun şifre güvenliği ayarlandı; Google hesabı tamamlama artık Worker sınırına takılmadan devam eder.','Site her açıldığında ana sayfadan başlar; kayıtlı oturum varsa Giriş yap düğmesiyle dashboarda devam edilir.','Hesap tamamlama isteği başarısız olursa Cloudflare bağlantı hatası ekranda açıkça gösterilir.');
  function showUpdates(){const overlay=$('#updatesOverlay');overlay.hidden=false;overlay.innerHTML=`<section class="dialog updates"><button class="close">×</button><span class="eyebrow">PLAY STREAMERS</span><h2>Güncelleme Notları</h2><p>Yalnızca yayındaki güncel değişiklikler gösterilir.</p>${releaseNotes.map((note,index)=>`<article class="update-note ${index===0?'expanded':''}"><button class="update-expand" title="Büyüt">⛶</button><div><strong>${esc(note.version)}</strong><time>${esc(note.date)}</time></div><ul>${note.items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></article>`).join('')}</section>`;$('.close',overlay).onclick=()=>{overlay.hidden=true};$$('.update-expand',overlay).forEach(button=>button.onclick=()=>button.closest('.update-note').classList.toggle('expanded'))}
  function installTopMenu(){const oldInfo=$('#updatesBtn');if(oldInfo)oldInfo.style.display='none';const connection=$('#connectionBtn');if(connection){connection.textContent='📶';connection.title='Bağlantı durumu'}if(!$('#menuBtn')){const button=document.createElement('button');button.className='hamburger-menu';button.id='menuBtn';button.type='button';button.title='Menü';button.textContent='☰';$('.actions').append(button);const menu=document.createElement('aside');menu.className='side-menu';menu.id='sideMenu';menu.hidden=true;menu.innerHTML='<button id="menuUpdates">Güncelleme notları</button><button id="menuConnections">Bağlantı durumu</button>';document.body.append(menu);button.onclick=()=>{menu.hidden=!menu.hidden};$('#menuUpdates').onclick=()=>{menu.hidden=true;showUpdates()};$('#menuConnections').onclick=()=>{menu.hidden=true;$('#connections').hidden=false;renderConnectionHub()}}const foot=$('.foot');if(foot)foot.innerHTML='<a href="https://guns.lol/switly" target="_blank" rel="noopener">Developed by Switly</a>'}
  function eventMessage(v){return esc(v||'').replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank">$1</a>')}
  function listCard(key,title,cls,rows,mapper,emptyText,count){return `<section class="card ${cls}" data-card="${key}"><div class="card-body"><div class="card-head"><div class="title"><span class="logo ${key==='donations'?'donate':''}">${key==='donations'?'₺':'K'}</span><h2>${title}</h2></div><button class="expand">⛶</button><div class="count">${count}</div></div><ul class="entries" id="list-${key}">${rows.map(mapper).join('')}</ul><div class="empty ${rows.length?'':'show'}">${emptyText}</div></div></section>`}
  function itemHtml(item,kind){const icon=item.sourceIcon?`<span class="source-badge">${esc(item.sourceIcon)}</span>`:'';const badge=kind==='subs'?'<span class="sub-badge">K Abone</span>':'';const accent=kind==='gifts'?`style="border-color:hsl(${hue(item.name)} 85% 66%)"`:'';return `<li class="${item.read?'read':'new'}" ${accent} data-kind="${kind}" data-id="${esc(item.id)}"><div class="event-main"><div class="event-top">${icon}<span class="name">${esc(item.name)}</span>${badge}<span class="meta">${esc(item.meta)}</span></div><div class="message">${eventMessage(item.message)}</div></div><button class="event-expand">⛶</button></li>`}
  function panel(){state.events.followers??=[];state.totals.followers??=state.events.followers.length;const followers=state.events.followers,subs=Object.values(state.events.subs);const one=subs.filter(x=>x.months===1).sort((a,b)=>b.at-a.at),multi=subs.filter(x=>x.months>=2).sort((a,b)=>b.at-a.at);const kicks=state.events.kicks,gifts=state.events.gifts,dons=state.events.donations;const mapFollower=x=>itemHtml({id:x.id,name:x.name,meta:dt(x.at),message:x.message,read:x.read,at:x.at,sourceUrl:x.sourceUrl},'followers');const mapSub=x=>itemHtml({id:x.id,name:x.name,meta:dt(x.at),message:x.message,read:x.read,at:x.at,sourceUrl:x.sourceUrl},'subs');const mapKick=x=>itemHtml({id:x.id,name:x.name,meta:`${x.amount} kicks · ${dt(x.at)}`,message:x.message,read:x.read,at:x.at,sourceUrl:x.sourceUrl},'kicks');const mapGift=x=>itemHtml({id:x.id,name:x.name,meta:`${x.count} hediye · ${dt(x.at)}`,message:x.message,read:x.read,at:x.at,sourceUrl:x.sourceUrl},'gifts');const mapDon=x=>itemHtml({id:x.id,name:x.name,meta:`${money(x.amount,x.currency)} · ${dt(x.at)}`,message:x.message,read:x.read,at:x.at,sourceUrl:x.sourceUrl,sourceIcon:x.sourceIcon},'donations');$('#panelGrid').innerHTML=[listCard('followers','Takipçi','cyan',followers,mapFollower,'Yeni takipçiler burada görünür.',state.totals.followers),listCard('onemonth','1 Aylık Abone','violet',one,mapSub,'Yeni abonelikler burada görünür.',one.length),listCard('multimonth','2+ Aylık Abone','magenta',multi,mapSub,'Kümülatif abonelikler burada görünür.',multi.length),listCard('gifts','Hediye Abonelik','cyan',gifts,mapGift,'Hediye abonelikler burada görünür.',state.totals.gifts),listCard('kicks','Kicks','lime',kicks,mapKick,'Kicks olayları burada görünür.',state.totals.kicks),listCard('donations','Donate','amber donate',dons,mapDon,'Bağış olayları burada görünür.',money(state.totals.donations))].join('');bindPanel();const t=[...followers.slice(0,3).map(x=>`＋ ${x.name} — yeni takipçi`),...dons.slice(0,4).map(x=>`💰 ${x.name} — ${money(x.amount,x.currency)}`),...kicks.slice(0,4).map(x=>`⚡ ${x.name} — ${x.amount} kicks`),...gifts.slice(0,3).map(x=>`🎁 ${x.name} — ${x.count} hediye`)];$('#ticker').textContent=t.length?t.join('     •     '):'Henüz olay yok — veri kaynağı bağlandığında burada akacak.'}
  function bindPanel(){$$('.expand').forEach(b=>b.onclick=()=>{const c=b.closest('.card');const on=!c.classList.contains('expanded');$$('.card.expanded').forEach(x=>x.classList.remove('expanded'));if(on)c.classList.add('expanded')});$$('.entries li').forEach(li=>{const kind=li.dataset.kind,item=findEvent(kind,li.dataset.id);li.onclick=e=>{if(e.target.closest('a')||e.target.closest('.event-expand'))return;markRead(kind,item)};li.querySelector('.event-expand').onclick=e=>{e.stopPropagation();openEvent(item,kind)}})}
  function findEvent(kind,eventId){if(kind==='subs')return Object.values(state.events.subs).find(x=>x.id===eventId);return state.events[kind].find(x=>x.id===eventId)}
  function markRead(kind,item){if(!item||item.read)return;item.read=true;item.readAt=Date.now();save();render();scheduleRemove(kind,item)}
  function scheduleRemove(kind,item){const k=kind+item.id;if(removalTimers.has(k))return;removalTimers.add(k);const wait=Math.max(0,60000-(Date.now()-(item.readAt||Date.now())));setTimeout(()=>{if(kind==='subs')delete state.events.subs[item.name.toLowerCase()];else state.events[kind]=state.events[kind].filter(x=>x.id!==item.id);save();removalTimers.delete(k);render()},wait)}
  function openEvent(item,kind){if(!item)return;const donate=kind==='donations';const sourceUrl=String(item.sourceUrl||'').trim();const hasSource=/^https?:\/\//i.test(sourceUrl);const sourceAction=hasSource?`<a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">${donate?(item.sourceName||'Donate'):'Kick'} sitesinde aç ↗</a>`:'<span class="event-source-unavailable">Kaynak bağlantısı yok</span>';$('#modal').hidden=false;$('#modal').innerHTML=`<section class="dialog"><button class="close">×</button><span class="eyebrow">OLAY AYRINTISI</span><h2>${esc(item.name)}</h2><div class="event-message">${eventMessage(item.message)}</div><div class="event-foot"><span>${esc(item.meta||dt(item.at))}</span>${sourceAction}</div></section>`;$('#modal .close').onclick=closeModal;$('#modal').onclick=e=>{if(e.target===$('#modal'))closeModal}}
  function closeModal(){$('#modal').hidden=true;$('#modal').innerHTML=''}
  function askConfirm(title,message){return new Promise(resolve=>{$('#modal').hidden=false;$('#modal').innerHTML=`<section class="dialog"><span class="eyebrow">ONAY GEREKLİ</span><h2>${esc(title)}</h2><p>${esc(message)}</p><div class="form-actions"><button class="secondary" id="confirmNo">Vazgeç</button><button class="primary" id="confirmYes">Onayla</button></div></section>`;$('#confirmNo').onclick=()=>{closeModal();resolve(false)};$('#confirmYes').onclick=()=>{closeModal();resolve(true)}})}
  function leaderboard(obj){return Object.values(obj||{}).sort((a,b)=>b.total-a.total||b.at-a.at).slice(0,10)}
  function rank(rows,fmt){return rows.length?`<ol class="rank">${rows.map((r,i)=>`<li><span class="rank-num">${i+1}</span><span class="rank-name">${esc(r.name)}</span><strong>${esc(fmt(r))}</strong></li>`).join('')}</ol>`:'<div class="empty show">Henüz yeterli veri yok.</div>'}
  function statCard(title,cls,body,donate=false){return `<section class="card ${cls} ${donate?'donate':''}"><div class="card-body"><div class="card-head"><div class="title"><span class="logo ${donate?'donate':''}">${donate?'₺':'K'}</span><h2>${title}</h2></div></div>${body}</div></section>`}
  function periodCard(prefix,stats,fmt){return `<div class="period-tabs"><button class="active" data-period="month">Bu ay</button><button data-period="all">Tüm zamanlar</button></div><div class="period-list" data-period-list="month">${rank(leaderboard(stats.month),fmt)}</div><div class="period-list" data-period-list="all" hidden>${rank(leaderboard(stats.all),fmt)}</div>`}
  function stats(){const joined=Object.values(state.stats.joined[month()]||{}).sort((a,b)=>b.at-a.at).slice(0,10);const sub=leaderboard(state.stats.subs);$('#statsGrid').innerHTML=[statCard('Yeni Katılanlar','violet',`<p class="stats-desc">Bu ay ilk kez 1 aylık abonelik alan kişiler.</p>${rank(joined,()=> 'Yeni abone')}`),statCard('Top Abone','magenta',`<p class="stats-desc">Toplam aylık aboneliği en yüksek ilk 10 kişi.</p>${rank(sub,x=>x.total+' ay')}`),statCard('Top Hediye Abonelik','cyan',periodCard('gift',state.stats.gifts,x=>x.total+' hediye')),statCard('Top Kicks','lime',periodCard('kick',state.stats.kicks,x=>x.total+' kicks')),statCard('Top Donate','amber',periodCard('donate',state.stats.donations,x=>money(x.total)),true)].join('');$$('.period-tabs button').forEach(b=>b.onclick=()=>{const p=b.dataset.period,box=b.closest('.card');$$('.period-tabs button',box).forEach(x=>x.classList.toggle('active',x===b));$$('.period-list',box).forEach(x=>x.hidden=x.dataset.periodList!==p)})}
  function addStat(type,name,amount,at){const key=name.toLowerCase();const set=(bucket)=>{bucket[key]??={name,total:0,at};bucket[key].total+=amount;bucket[key].at=at};if(type==='subs'){set(state.stats.subs);if(amount===1){const m=month();state.stats.joined[m]??={};state.stats.joined[m][key]={name,at}}}else{const target=state.stats[type];set(target.all);target.month[month()]??={};const b=target.month[month()];b[key]??={name,total:0,at};b[key].total+=amount;b[key].at=at}}
  function render(){panel();stats();renderConnectionHub();renderKickConnectionStatus();renderUserAuth();renderLiveStatus()}
  function installLiveStatus(){if($('#streamStatus'))return;const status=document.createElement('section');status.className='live-status';status.id='streamStatus';status.innerHTML='<span class="dot"></span><span>Yayın durumu hazırlanıyor</span>';$('#panelView').before(status)}
  function renderLiveStatus(){installLiveStatus();const box=$('#streamStatus');box.classList.toggle('live',liveInfo.state==='live');box.classList.toggle('offline',liveInfo.state==='offline');box.innerHTML=`<span class="dot"></span><span>${esc(liveInfo.message)}</span><button class="clear" id="clearBtn" type="button">Sıfırla</button>`}
  async function refreshLiveStatus(){if(!activeKickSession){liveInfo={state:'idle',message:'Yayın durumu için önce Kick hesabını bağla'};renderLiveStatus();return}liveInfo={state:'idle',message:'Kick yayın durumu kontrol ediliyor…'};renderLiveStatus();try{const res=await fetch(`${API_BASE}/api/kick/stream-status`,{headers:{Authorization:`Bearer ${activeKickSession}`}});const data=await res.json();if(!res.ok){throw Error('status')}liveInfo=data.live?{state:'live',message:data.title?`Yayın açık · ${data.title}`:'Yayın açık'}:{state:'offline',message:'Yayın kapalı'};renderLiveStatus()}catch{liveInfo={state:'idle',message:'Yayın durumu şu an kontrol edilemiyor'};renderLiveStatus()}}
  function renderConnectionHub(){const box=$('#connectionList');if(!box)return;const kickConnected=Boolean(activeKickSession);box.innerHTML=`<div class="con-row"><span class="con-icon kick">📶</span><p><strong>Kick</strong><small>${kickConnected?(state.settings.kickAccount?.username?`Bağlı · @${state.settings.kickAccount.username}`:'Bağlı'):'Bağlı değil'}</small></p><button class="refresh" id="refreshKickConnection">${kickConnected?'⟳':'↗'}</button></div><div class="con-row"><span class="con-icon">📶</span><p><strong>ByNoGame</strong><small>Bağlantı bekleniyor</small></p><button class="refresh" id="setupBynogameConnection">↗</button></div>`;$('#refreshKickConnection').onclick=()=>kickConnected?refreshKickStatus(true):startKickLogin;$('#setupBynogameConnection').onclick=()=>notice('ByNoGame bekleniyor','Güvenli bağlantı için ByNoGame API/OAuth erişimi gerekiyor.','i')}
  // Hesap bağlantıları API oturumundan gelir; eski tek seferlik kurulum penceresi kaldırıldı.
  $('#connectionBtn').onclick=()=>{$('#connections').hidden=!$('#connections').hidden};$('#clearBtn').onclick=async()=>{if(await askConfirm('Her şeyi sıfırla?','Tüm olaylar, oturum sayaçları ve istatistikler silinecek.')){const settings=state.settings;state=empty();state.settings=settings;save();render();notice('Panel sıfırlandı','Yeni olaylar sıfırdan sayılacak.','✓')}};
  $$('.workspace-tabs button').forEach(b=>b.onclick=()=>{$$('.workspace-tabs button').forEach(x=>x.classList.toggle('active',x===b));$('#panelView').hidden=b.dataset.view!=='panel';$('#statsView').hidden=b.dataset.view!=='stats'});$('#updatesBtn').onclick=()=>{$('#updatesOverlay').hidden=false;$('#updatesOverlay').innerHTML=`<section class="dialog updates"><button class="close">×</button><span class="eyebrow">PLAY STREAMERS</span><h2>Güncelleme Notları</h2><article><div><strong>1.7 · Güncel</strong><time>12 Temmuz 2026</time></div><ul><li>PS marka kimliği ve güncelleme merkezi eklendi.</li><li>Kick yalnızca kurulumda kaydedilen kanalı izler.</li><li>En fazla 5 simgeli Donate Hesabı eklendi.</li><li>Olay tarih/saatleri, dönem sekmeleri ve sabit büyütme düzeltildi.</li></ul></article><article><div><strong>1.6</strong><time>Önceki sürüm</time></div><ul><li>Olay ayrıntıları, okunmuş olay animasyonları ve istatistik ekranı eklendi.</li></ul></article><article><div><strong>1.5</strong><time>Önceki sürüm</time></div><ul><li>Renkli cam panel tasarımı eklendi.</li></ul></article></section>`;$('.close',$('#updatesOverlay')).onclick=()=>{$('#updatesOverlay').hidden=true}};
  document.addEventListener('click',e=>{if(!$('#connections').hidden&&!e.target.closest('#connections')&&!e.target.closest('#connectionBtn'))$('#connections').hidden=true;if(e.target===$('#modal'))closeModal();if(e.target===$('#updatesOverlay'))$('#updatesOverlay').hidden=true});document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();$('#updatesOverlay').hidden=true;$$('.card.expanded').forEach(x=>x.classList.remove('expanded'))}});
  window.PlayStreamers={addEvent(event){const at=Number(event.at)||Date.now(),type=event.type;state.events.followers??=[];state.totals.followers??=state.events.followers.length;if(type==='follower'){const row={id:event.id||id(),name:event.name,message:event.message||`${event.name} takip etti.`,at,sourceUrl:event.sourceUrl||kickProfileUrl(),read:false};state.events.followers.unshift(row);state.totals.followers+=1}if(type==='subscription'){const key=event.name.toLowerCase(),old=state.events.subs[key],row={id:event.id||id(),name:event.name,months:(old?.months||0)+(event.months||1),message:event.message||`${event.name} abone oldu.`,at,sourceUrl:event.sourceUrl||kickProfileUrl(),read:false};state.events.subs[key]=row;addStat('subs',event.name,event.months||1,at)}if(type==='kicks'){const row={id:event.id||id(),name:event.name,amount:+event.amount||0,message:event.message||'',at,sourceUrl:event.sourceUrl||kickProfileUrl(),read:false};state.events.kicks.unshift(row);state.totals.kicks+=row.amount;addStat('kicks',row.name,row.amount,at)}if(type==='gift'){const row={id:event.id||id(),name:event.name,count:+event.count||1,message:event.message||'',at,sourceUrl:event.sourceUrl||kickProfileUrl(),read:false};state.events.gifts.unshift(row);state.totals.gifts+=row.count;addStat('gifts',row.name,row.count,at)}if(type==='donation'){const row={id:event.id||id(),name:event.name,amount:+event.amount||0,currency:event.currency||'TRY',message:event.message||'',sourceIcon:event.sourceIcon||'₺',sourceName:event.sourceName||'Donate',sourceUrl:event.sourceUrl||'',at,read:false};state.events.donations.unshift(row);state.totals.donations+=row.amount;addStat('donations',row.name,row.amount,at)}save();render()},startBroadcast(){state.events={followers:[],subs:{},kicks:[],gifts:[],donations:[]};state.totals={followers:0,kicks:0,donations:0,gifts:0};state.stats={subs:{},joined:{},gifts:{month:{},all:{}},kicks:{month:{},all:{}},donations:{month:{},all:{}}};save();render()}};
  installKickLoginControls();
  installUserAuthControls();
  installTopMenu();
  document.addEventListener('click',e=>{const menu=$('#sideMenu'),button=$('#menuBtn');if(menu&&!menu.hidden&&!e.target.closest('#sideMenu')&&e.target!==button)menu.hidden=true});
  $('#connectionBtn').onclick=()=>{$('#connections').hidden=!$('#connections').hidden;if(!$('#connections').hidden)void refreshKickStatus(false)};
  render();
  if(kickJustConnected)notice('Kick hesabın bağlandı','Bağlantı durumu simgesinden hesabını kontrol edebilirsin.','✓');
  if(googleJustConnected)notice('Hesabın oluşturuldu','Google hesabınla Play Streamers’a giriş yaptın.','✓');
  if(activeKickSession)void refreshKickStatus(false);
  if(activeKickSession)void refreshLiveStatus();
  void refreshUserSession();
})();

/* Play Streamers 2.2 Beta progressive interface layer */
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const originalFetch = window.fetch.bind(window);
  window.fetch = (resource, options = {}) => {
    const url = typeof resource === 'string' ? resource : resource?.url || '';
    if (url.includes('/api/auth/register') && options.body) {
      try {
        const body = JSON.parse(options.body);
        const email = $('#landingAuthModal [name="email"]')?.value.trim();
        if (email) options = { ...options, body: JSON.stringify({ ...body, email }) };
      } catch { /* Original request handling continues unchanged. */ }
    }
    return originalFetch(resource, options);
  };

  function addBeta(brand) {
    if (!brand || $('.beta-badge', brand)) return;
    const badge = document.createElement('span');
    badge.className = 'beta-badge';
    badge.textContent = 'BETA';
    brand.append(badge);
  }

  function addPasswordToggles(root = document) {
    $$('input[type="password"]', root).forEach(input => {
      if (input.closest('.password-control')) return;
      const shell = document.createElement('span');
      shell.className = 'password-control';
      input.parentNode.insertBefore(shell, input);
      shell.append(input);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'password-toggle';
      toggle.setAttribute('aria-label', 'Şifreyi göster');
      toggle.title = 'Şifreyi göster';
      toggle.textContent = '◉';
      toggle.onclick = () => {
        const reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        toggle.textContent = reveal ? '◌' : '◉';
        toggle.title = reveal ? 'Şifreyi gizle' : 'Şifreyi göster';
        toggle.setAttribute('aria-label', toggle.title);
      };
      shell.append(toggle);
    });
  }

  function addRegistrationEmail() {
    // 1.6: Kullanıcı adı, şifre ve doğum tarihi kayıt için yeterlidir.
    // E-posta daha sonra Hesabım alanından isteğe bağlı bağlanır.
    return;
  }

  function installAccountSwitch() {
    const setup = $('#googleProfileSetup');
    if (!setup) return;
    const dialog = $('.auth-dialog', setup);
    if (!dialog || $('.account-switch', dialog)) return;

    const hint = document.createElement('p');
    hint.className = 'account-switch-hint';
    hint.textContent = 'Bu kullanıcı adı başka bir hesaba aitse mevcut hesabınla giriş yapabilirsin.';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'auth-secondary account-switch';
    button.textContent = 'Mevcut hesabımla giriş yap';
    button.onclick = async () => {
      const storageKey = 'play-streamers-v17-site';
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { /* Empty state is safe. */ }
      const session = saved?.settings?.userSession;
      if (session) {
        try {
          await originalFetch('https://api.pstreamers.com/api/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session}` }
          });
        } catch { /* The local session is still cleared below. */ }
      }
      if (saved?.settings) {
        delete saved.settings.userSession;
        delete saved.settings.user;
      }
      localStorage.setItem(storageKey, JSON.stringify(saved));
      window.location.assign('https://pstreamers.com/');
    };

    dialog.append(hint, button);
  }

  function installCarousel(root) {
    const host = $('.landing-product', root);
    if (!host || host.dataset.beta22 === '1') return;
    host.dataset.beta22 = '1';
    host.innerHTML = `<section class="product-window" aria-label="Play Streamers canlı panel ön izlemesi">
      <header class="product-top"><span>PLAY STREAMERS · CANLI PANEL</span><span class="product-dots"><i></i><i></i><i></i></span></header>
      <div class="product-carousel">
        <section class="product-page" data-page="0">
          <div class="preview-hero"><div><span class="preview-kicker">YAYIN DURUMU · ŞİMDİ</span><h3>Topluluğun canlı, kontrol sende.</h3><p>Olaylar, destekler ve yayın nabzı tek akışta görünür.</p><div class="preview-live"><i></i>YAYIN AÇIK</div></div><div class="preview-stat-stack"><div><b>248</b><span>bugünün kicks sayısı</span></div><div><b>19</b><span>yeni topluluk olayı</span></div></div></div>
          <div class="preview-columns"><article class="preview-panel"><span class="preview-kicker">SON OLAYLAR</span><h4>Canlı akış</h4><div class="preview-event"><i>K</i><b>Yeni abonelik</b><span>şimdi</span></div><div class="preview-event"><i>✦</i><b>3 hediye abonelik</b><span>2 dk</span></div><div class="preview-event"><i>₺</i><b>Yeni destek</b><span>5 dk</span></div></article><article class="preview-panel"><span class="preview-kicker">YAYIN RİTMİ</span><h4>Son 6 saat</h4><div class="preview-bars"><i style="height:28%"></i><i></i><i></i><i></i><i></i><i></i></div></article></div>
        </section>
        <section class="product-page" data-page="1" hidden>
          <div class="preview-hero"><div><span class="preview-kicker">TOPLULUK İSTATİSTİKLERİ</span><h3>Kimler yanında?</h3><p>Aylık yükselişleri ve sadık izleyicileri tek bakışta keşfet.</p></div><div class="preview-stat-stack"><div><b>+64</b><span>bu ay katılan</span></div><div><b>87%</b><span>etkileşim</span></div></div></div>
          <div class="preview-columns"><article class="preview-panel"><span class="preview-kicker">TOP ABONELER</span><h4>Bu ay öne çıkanlar</h4><div class="preview-rank"><div><span>1. <b>yayınsever</b></span><strong>18 ay</strong></div><div><span>2. <b>oyuncukedi</b></span><strong>12 ay</strong></div><div><span>3. <b>chatustası</b></span><strong>9 ay</strong></div></div></article><article class="preview-panel"><span class="preview-kicker">HEDİYE ABONELİKLER</span><h4>Bu ay</h4><div class="preview-bars"><i style="height:40%"></i><i style="height:68%"></i><i style="height:51%"></i><i style="height:92%"></i><i style="height:77%"></i><i style="height:58%"></i></div></article></div>
        </section>
        <section class="product-page" data-page="2" hidden>
          <div class="preview-donate"><div><span class="preview-kicker">DESTEK MERKEZİ</span><strong>Her katkı görünür.</strong><p>Kick olaylarını ve bağış platformlarını bir arada takip et; yayın sırasında hiçbir teşekkürü kaçırma.</p></div><div class="preview-source-list"><span>Kick <b>Bağlı</b></span><span>Donate hesapları <b>Hazır</b></span><span>Olay geçmişi <b>Arşivde</b></span></div></div>
          <div class="preview-columns"><article class="preview-panel"><span class="preview-kicker">SON DESTEKLER</span><h4>Teşekkür sırası</h4><div class="preview-event"><i>₺</i><b>GeceYayını</b><span>₺250</span></div><div class="preview-event"><i>₺</i><b>PixelRuhu</b><span>₺100</span></div><div class="preview-event"><i>₺</i><b>mavikedi</b><span>₺75</span></div></article><article class="preview-panel"><span class="preview-kicker">KONTROL</span><h4>Hazır olduğunda yayına odaklan.</h4><p style="color:#aec0d4;font-size:12px;line-height:1.6">Bağlantılarını doğrula, canlı durumu izle ve tüm olayları kendi panelinde topla.</p></article></div>
        </section>
        <div class="carousel-controls"><button type="button" class="carousel-prev" aria-label="Önceki panel">‹</button><div class="carousel-dots"><button type="button" class="active" aria-label="1. panel"></button><button type="button" aria-label="2. panel"></button><button type="button" aria-label="3. panel"></button></div><button type="button" class="carousel-next" aria-label="Sonraki panel">›</button></div>
      </div>
    </section>`;
    const pages = $$('.product-page', host);
    const dots = $$('.carousel-dots button', host);
    let current = 0;
    const show = index => {
      current = (index + pages.length) % pages.length;
      pages.forEach((page, pageIndex) => { page.hidden = pageIndex !== current; });
      dots.forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === current));
    };
    $('.carousel-prev', host).onclick = () => show(current - 1);
    $('.carousel-next', host).onclick = () => show(current + 1);
    dots.forEach((dot, index) => { dot.onclick = () => show(index); });
  }

  function enhanceLanding() {
    const overlay = $('#authOverlay');
    if (!overlay) return;
    addBeta($('.landing-brand', overlay));
    installCarousel(overlay);
    const trust = $('.landing-trust', overlay);
    if (trust && !$('.landing-feature-grid', overlay)) {
      const features = document.createElement('section');
      features.className = 'landing-feature-grid';
      features.innerHTML = '<article><b>CANLI TAKİP</b><span>Yayın açık mı, olaylar nasıl ilerliyor anında gör.</span></article><article><b>TOPLULUK</b><span>Abonelik, hediye ve kicks verilerini düzenle.</span></article><article><b>ODAĞIN YAYIN</b><span>Bilgiler tek merkezde, yayın akışın kesintisiz.</span></article>';
      trust.after(features);
    }
    const footer = $('.landing-footer', overlay);
    if (footer && !$('.switly-link', footer)) footer.lastElementChild.innerHTML = 'Developed by <a class="switly-link" href="https://guns.lol/switly">Switly</a>';
    const update = $('.landing-update-card', overlay);
    if (update && update.dataset.beta22 !== '1') {
      update.dataset.beta22 = '1';
      const title = $('h2', update); if (title) title.textContent = '2.2 Beta · Yayıncı Karşılama Merkezi';
      const description = $('p', update); if (description) description.textContent = 'Daha güçlü bir ilk izlenim ve güvenli hesap deneyimi için yenilendi.';
      const list = $('ul', update); if (list) list.innerHTML = '<li>Geniş içerikli ana sayfa ve üç bölümlü canlı panel ön izlemesi eklendi.</li><li>Kayıt formuna e-posta alanı; e-posta ve kullanıcı adı tekrar kullanım kontrolü eklendi.</li><li>Google hesabında kullanıcı adı çakışırsa mevcut hesapla giriş ekranına dönme seçeneği eklendi.</li><li>Şifre alanlarına görünürlük düğmesi, Türkçe kullanıcı adı desteği ve Beta etiketleri eklendi.</li><li>Switly imzası guns.lol/switly adresine bağlandı.</li>';
    }
  }

  function enhanceUpdateNotes() {
    const updates = $('.updates');
    if (!updates) return;
    $$('.update-note strong', updates).forEach(title => { if (!/\bBeta\b/i.test(title.textContent)) title.textContent = title.textContent.replace(/^(\d+(?:\.\d+)?)/, '$1 Beta'); });
    if ($('[data-beta22-note]', updates)) return;
    const note = document.createElement('article');
    note.className = 'update-note expanded';
    note.dataset.beta22Note = '1';
    note.innerHTML = '<button class="update-expand" title="Büyüt">⛶</button><div><strong>2.2 Beta · Yayıncı Karşılama Merkezi</strong><time>13 Temmuz 2026</time></div><ul><li>Genişletilmiş ana sayfa, carousel ön izleme ve yeni tipografi eklendi.</li><li>E-posta ile kayıt, tekrar e-posta ve kullanıcı adı koruması eklendi.</li><li>Google hesabında kullanıcı adı çakışırsa mevcut hesapla girişe dönme seçeneği eklendi.</li><li>Şifre görünürlüğü, Türkçe kullanıcı adı ve Beta etiketleri eklendi.</li></ul>';
    const first = $('.update-note', updates);
    if (first) updates.insertBefore(note, first); else updates.append(note);
    $('.update-expand', note).onclick = () => note.classList.toggle('expanded');
  }

  function apply() {
    $$('.brand').forEach(addBeta);
    enhanceLanding();
    addRegistrationEmail();
    addPasswordToggles();
    installAccountSwitch();
    enhanceUpdateNotes();
  }

  /* Performans: ilk kurulum yeterli; her DOM değişiminde yeniden çalıştırma kapatıldı. */
  apply();
})();

/* 1.0 Tam Sürüm: güvenli arayüz ve hesap kontrolleri. */
(() => {
  'use strict';
  const KEY = 'play-streamers-v17-site';
  const API = 'https://api.pstreamers.com';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const fullNotes = [
    'Kayıtlı oturumlarda Dashboard yerine giriş sonrası 2. ana sayfa açılır.',
    'Giriş, kayıt, Google hesabı ve hesap tamamlama alanlarına görünür şifre düğmeleri eklendi.',
    'Beni hatırla seçeneği, açık bırakıldığında hesabını sonraki ziyaretlerinde tanır.',
    'Güncelleme merkezi taşma sorunu olmadan yenilendi; yalnızca güncel notlar korunur.',
    'Hesap merkezi ile kullanıcı adı, e-posta, şifre ve profil fotoğrafı yönetimi eklendi.',
    'Kullanıcı adı değişikliği 60 gün, e-posta ve şifre değişiklikleri 90 gün aralıklıdır.',
    'Bağlantı simgesi, araç ipuçları, Dashboard kısayolu ve yayın durumu yanındaki sıfırlama düzenlendi.',
    'İkinci ana sayfaya Neler yeni, sunduklarımız, hesap durumu ve geliştirme alanı eklendi.'
  ];
  const avatarChoices = [
    ['avatar:male-1', '🧑🏻', 'Erkek profil 1'], ['avatar:male-2', '🧔🏻', 'Erkek profil 2'], ['avatar:male-3', '🧑🏽', 'Erkek profil 3'],
    ['avatar:female-1', '👩🏻', 'Kadın profil 1'], ['avatar:female-2', '👩🏽', 'Kadın profil 2'], ['avatar:female-3', '👩🏾', 'Kadın profil 3']
  ];
  function readState() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
  function writeState(state) { localStorage.setItem(KEY, JSON.stringify(state)); }
  function settings() { return readState().settings || {}; }
  function signedIn() { const data = settings(); return Boolean(data.userSession && data.user && !data.user.needsCredentialSetup); }
  function escapeHtml(value) { const span = document.createElement('span'); span.textContent = String(value || ''); return span.innerHTML; }
  function toast(title, text, good = false) { const previous = $('#psToast'); if (previous) previous.remove(); const element = document.createElement('aside'); element.id = 'psToast'; element.className = `ps-toast${good ? ' good' : ''}`; element.innerHTML = `<button aria-label="Kapat">×</button><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p>`; document.body.append(element); $('button', element).onclick = () => element.remove(); window.setTimeout(() => element.remove(), 6000); }
  function eyeIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.8"></circle></svg>'; }
  function addPasswordEyes(root = document) {
    $$('input[type="password"]', root).forEach(input => {
      if (input.dataset.psEye === '1') return;
      input.dataset.psEye = '1';
      let holder = input.closest('.ps-password');
      if (!holder) { holder = document.createElement('span'); holder.className = 'ps-password'; input.parentNode.insertBefore(holder, input); holder.append(input); }
      const button = document.createElement('button'); button.type = 'button'; button.className = 'ps-eye'; button.setAttribute('aria-label', 'Şifreyi göster'); button.setAttribute('aria-pressed', 'false'); button.innerHTML = eyeIcon(); button.onclick = () => { const visible = input.type === 'text'; input.type = visible ? 'password' : 'text'; button.setAttribute('aria-label', visible ? 'Şifreyi göster' : 'Şifreyi gizle'); button.setAttribute('aria-pressed', String(!visible)); }; holder.append(button);
    });
  }
  function normalizeRemember() {
    const state = readState(); const data = state.settings;
    if (!data?.userSession || !data.user) return;
    const choice = sessionStorage.getItem('psRememberChoice');
    if (choice !== null) { data.rememberUser = choice === '1'; writeState(state); sessionStorage.setItem('psCurrentSession', '1'); sessionStorage.removeItem('psRememberChoice'); return; }
    if (data.rememberUser === false && !sessionStorage.getItem('psCurrentSession')) { const sessionId = data.userSession; sessionStorage.setItem('ps48ForgetPending', '1'); sessionStorage.setItem('ps48LogoutToken', sessionId); delete data.user; delete data.userSession; writeState(state); $('#psSecondHome')?.setAttribute('hidden', ''); $('#authOverlay')?.removeAttribute('hidden'); document.body.classList.add('auth-locked'); return; }
    if (typeof data.rememberUser === 'undefined') { data.rememberUser = true; writeState(state); }
  }
  function decorateAuth() {
    const form = $('#landingAuthForm');
    if (form && !$('.ps-remember', form)) {
      const label = document.createElement('label'); label.className = 'ps-remember'; label.innerHTML = '<input type="checkbox" name="remember" checked><span>Beni hatırla</span>'; const submit = $('button[type="submit"]', form); submit?.before(label);
      form.addEventListener('submit', () => { sessionStorage.setItem('psRememberChoice', $('[name="remember"]', form)?.checked ? '1' : '0'); sessionStorage.setItem('psCurrentSession', '1'); }, true);
    }
    const google = $('#modalGoogle');
    if (google && google.dataset.psGoogle !== '1') { google.dataset.psGoogle = '1'; google.classList.add('google-button'); google.innerHTML = `<span class="ps-google-mark" aria-hidden="true">G</span><span>${google.textContent.trim()}</span>`; google.addEventListener('click', () => { const check = $('[name="remember"]', $('#landingAuthForm') || document); sessionStorage.setItem('psRememberChoice', check?.checked ? '1' : '0'); sessionStorage.setItem('psCurrentSession', '1'); }, true); }
    $$('input[type="date"]').forEach(input => input.classList.add('ps-date-input'));
    addPasswordEyes(document);
  }
  function showOverlay(title, body) {
    let overlay = $('#psReleaseOverlay'); if (!overlay) { overlay = document.createElement('div'); overlay.id = 'psReleaseOverlay'; overlay.className = 'ps-release-overlay'; document.body.append(overlay); }
    overlay.hidden = false; overlay.innerHTML = `<section class="ps-release-dialog"><button class="ps-release-close" aria-label="Kapat">×</button>${body || `<span class="ps-second-kicker">PLAY STREAMERS</span><h2>${escapeHtml(title)}</h2>`}</section>`; $('.ps-release-close', overlay).onclick = () => overlay.hidden = true; overlay.onclick = event => { if (event.target === overlay) overlay.hidden = true; }; return overlay;
  }
  function showNotes() {
    showOverlay('', '<span class="ps-second-kicker">GÜNCELLEME MERKEZİ</span><h2>Güncel iyileştirmeler</h2><p>Eski sürüm arşivleri kaldırıldı; yalnızca yayındaki güncel değişiklikler gösterilir.</p><article class="ps-release-note"><h3>23 Temmuz 2026 <span class="ps-release-pill">GÜNCEL</span></h3><ul><li>Ana sayfa etkileşimleri ve destek alanı tekil hale getirildi.</li><li>Hesap menüsü, güncelleme notları ve ürün sayfası doğru hedeflere bağlandı.</li><li>Bağlantı durumu ve yükleme geçişleri güncel hesap durumuna göre düzenlendi.</li></ul></article>');
  }
  function displayDate(value, interval) { if (!value) return `${interval} gün sonra tekrar değiştirebilirsin.`; const date = new Date(value); return `Bir sonraki değişiklik: ${date.toLocaleString('tr-TR')}`; }
  function avatarMarkup(user) { const state = readState(); const local = state.settings?.localAvatarUserId === user.id ? state.settings?.localAvatar : ''; if (local) return `<img src="${escapeHtml(local)}" alt="Profil fotoğrafı">`; const choice = avatarChoices.find(item => item[0] === user.picture); return choice ? choice[1] : '🧑'; }
  async function accountRequest(path, payload) {
    const current = settings(); if (!current.userSession) throw new Error('Oturumun bulunamadı. Lütfen tekrar giriş yap.');
    let response; try { response = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${current.userSession}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch { throw new Error('Sunucuya ulaşılamadı. Cloudflare Worker sürümünü Deploy ettiğinden emin ol.'); }
    let data = {}; try { data = await response.json(); } catch { /* empty response */ }
    if (!response.ok) throw new Error(data.error || 'İşlem şu anda tamamlanamadı.');
    if (data.user) { const state = readState(); state.settings ||= {}; state.settings.user = data.user; writeState(state); }
    return data;
  }
  function openAccountCenter() {
    if (!signedIn()) { toast('Oturum gerekli', 'Hesap ayarlarını görmek için önce giriş yapmalısın.'); return; }
    const user = settings().user; const avatar = avatarMarkup(user);
    const overlay = showOverlay('', `<span class="ps-second-kicker">HESAP MERKEZİ</span><h2>Hesabını yönet</h2><div class="ps-account-head"><div class="ps-account-avatar">${avatar}</div><div><b>${escapeHtml(user.username || user.name || 'Play Streamers kullanıcısı')}</b><span>${escapeHtml(user.email || 'E-posta bağlı değil')}</span></div></div><article class="ps-setting"><h3>Kullanıcı adı</h3><p>${escapeHtml(displayDate(user.usernameChangeAvailableAt, 60))}</p><form id="psUsernameForm"><input name="username" value="${escapeHtml(user.username || '')}" minlength="3" maxlength="24" required><button class="ps-account-save">Kullanıcı adını güncelle</button></form></article><article class="ps-setting"><h3>E-posta adresi</h3><p>${escapeHtml(displayDate(user.emailChangeAvailableAt, 90))} Güvenlik için mevcut şifren gerekir.</p><form id="psEmailForm"><input type="email" name="email" value="${escapeHtml(user.email || '')}" placeholder="e-posta@ornek.com" required><input type="password" name="currentPassword" placeholder="Mevcut şifren" required><button class="ps-account-save">E-postayı güncelle</button></form></article><article class="ps-setting"><h3>Şifre</h3><p>${escapeHtml(displayDate(user.passwordChangeAvailableAt, 90))}</p><form id="psPasswordForm"><input type="password" name="currentPassword" placeholder="Mevcut şifren" required><input type="password" name="password" placeholder="Yeni şifre · en az 8 karakter" minlength="8" required><input type="password" name="passwordRepeat" placeholder="Yeni şifre tekrar" minlength="8" required><button class="ps-account-save">Şifreyi güncelle</button></form></article><article class="ps-setting"><h3>Profil fotoğrafı</h3><p>3 kadın ve 3 erkek varsayılan profil fotoğrafından birini seçebilir ya da kendi fotoğrafını yalnızca bu cihazda kullanabilirsin.</p><div class="ps-avatar-grid">${avatarChoices.map(item => `<button type="button" class="ps-avatar-choice${user.picture === item[0] ? ' active' : ''}" data-avatar="${item[0]}" title="${item[2]}">${item[1]}</button>`).join('')}</div><label class="ps-avatar-upload">Kendi fotoğrafını seç<input type="file" id="psAvatarFile" accept="image/png,image/jpeg,image/webp"></label></article>`);
    const bind = (selector, path, payload) => { $(selector, overlay).onsubmit = async event => { event.preventDefault(); try { await accountRequest(path, payload(new FormData(event.currentTarget))); toast('Hesap güncellendi', 'Değişikliklerin kaydedildi.', true); openAccountCenter(); } catch (error) { toast('İşlem yapılamadı', error.message); } }; };
    bind('#psUsernameForm', '/api/account/update-username', form => ({ username: form.get('username') }));
    bind('#psEmailForm', '/api/account/update-email', form => ({ email: form.get('email'), currentPassword: form.get('currentPassword') }));
    bind('#psPasswordForm', '/api/account/update-password', form => ({ currentPassword: form.get('currentPassword'), password: form.get('password'), passwordRepeat: form.get('passwordRepeat') }));
    $$('.ps-avatar-choice', overlay).forEach(button => button.onclick = async () => { try { await accountRequest('/api/account/update-avatar', { avatar: button.dataset.avatar }); const state = readState(); if (state.settings) { delete state.settings.localAvatar; delete state.settings.localAvatarUserId; writeState(state); } toast('Profil fotoğrafı güncellendi', 'Varsayılan fotoğrafın kaydedildi.', true); openAccountCenter(); } catch (error) { toast('Profil fotoğrafı kaydedilemedi', error.message); } });
    $('#psAvatarFile', overlay).onchange = event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 750 * 1024) { toast('Fotoğraf çok büyük', 'Lütfen 750 KB veya daha küçük bir dosya seç.'); return; } const reader = new FileReader(); reader.onload = () => { const state = readState(); state.settings ||= {}; state.settings.localAvatar = reader.result; state.settings.localAvatarUserId = user.id; writeState(state); toast('Profil fotoğrafı seçildi', 'Bu fotoğraf yalnızca bu cihazda saklanır.', true); openAccountCenter(); }; reader.onerror = () => toast('Fotoğraf okunamadı', 'PNG, JPG veya WebP biçiminde başka bir dosya dene.'); reader.readAsDataURL(file); };
    addPasswordEyes(overlay);
  }
  function openSecondHome(section) { sessionStorage.removeItem('ps-second-dashboard'); const brand = $('#psSecondBrand'); if (brand) brand.click(); if (section === 'offers') window.setTimeout(() => $('#psSecondOffers')?.click(), 20); }
  function logoutFromMenu() { const account = $('#googleAccountBtn'); if (account) { account.click(); return; } if (!window.confirm('Çıkış yapmak istediğine emin misin?')) return; const state = readState(); state.settings ||= {}; delete state.settings.user; delete state.settings.userSession; state.settings.rememberUser = false; writeState(state); sessionStorage.removeItem('psCurrentSession'); $('#psSecondHome')?.setAttribute('hidden', ''); $('#authOverlay')?.removeAttribute('hidden'); document.body.classList.add('auth-locked'); }
  function decorateSecondHome() {
    const home = $('#psSecondHome'); if (!home || home.hidden || !signedIn()) return;
    const user = settings().user; const line = $('.ps-second-account .ps-second-line', home); if (line) { const linked = Boolean(user.email || user.googleConnected); line.innerHTML = `<span class="ps-second-tick" style="${linked ? '' : 'background:#8d293b;color:#ffe5e8'}">${linked ? '✓' : '×'}</span><span><b>Gmail hesabı ${linked ? 'bağlı' : 'bağlı değil'}</b><br><small>${escapeHtml(user.email || 'Henüz e-posta bağlantısı yok')}</small></span>`; }
    const actions = $('.ps-second-nav-actions', home); if (actions && !$('#psSecondMenuButton', home)) { const button = document.createElement('button'); button.id = 'psSecondMenuButton'; button.type = 'button'; button.className = 'ps-tip'; button.dataset.psTip = 'Menü'; button.setAttribute('aria-label', 'Menü'); button.textContent = '☰'; actions.prepend(button); const menu = document.createElement('aside'); menu.id = 'psSecondMenu'; menu.className = 'ps-second-menu'; menu.hidden = true; menu.innerHTML = '<button id="psSecondMenuAccount">Hesabım</button><button id="psSecondMenuUpdates">Güncelleme notları</button><button id="psSecondMenuProducts">Ürünlerimiz</button><button id="psSecondMenuLogout" class="danger">Çıkış yap</button>'; actions.append(menu); button.onclick = event => { event.stopPropagation(); menu.hidden = !menu.hidden; }; $('#psSecondMenuAccount', menu).onclick = () => { menu.hidden = true; openAccountCenter(); }; $('#psSecondMenuUpdates', menu).onclick = () => { menu.hidden = true; showNotes(); }; $('#psSecondMenuProducts', menu).onclick = () => { menu.hidden = true; $('#psSecondOffers')?.click(); }; $('#psSecondMenuLogout', menu).onclick = () => { menu.hidden = true; logoutFromMenu(); }; document.addEventListener('click', event => { if (!menu.contains(event.target) && event.target !== button) menu.hidden = true; }); }
    $('#psSecondAccount', home).onclick = openAccountCenter; $('#psSecondAccountButton', home).onclick = openAccountCenter;
  }
  function decorateDashboard() {
    const actions = $('.topbar .actions'); if (actions) { const account = $('#googleAccountBtn'); if (account) account.hidden = true; if (!$('#psDashboardShortcut')) { const button = document.createElement('button'); button.id = 'psDashboardShortcut'; button.className = 'ps-dashboard-shortcut ps-tip'; button.dataset.psTip = 'Yayıncı Dashboard'; button.textContent = 'Dashboard'; button.onclick = () => { sessionStorage.setItem('ps-second-dashboard', '1'); $('#psSecondHome')?.setAttribute('hidden', ''); }; actions.append(button); } const connection = $('#connectionBtn'); if (connection) { connection.classList.add('ps-tip'); connection.dataset.psTip = 'Bağlantı durumu'; if (connection.dataset.psIcon !== '1') { connection.dataset.psIcon = '1'; connection.innerHTML = '<span class="ps-connection-symbol">⌁</span>'; } } }
    const status = $('#streamStatus'); const clear = $('#clearBtn'); if (status && clear && clear.parentElement !== status) { status.append(clear); clear.classList.add('ps-tip'); clear.dataset.psTip = 'Panel verilerini sıfırla'; }
    const menu = $('#sideMenu'); if (menu && menu.dataset.psReleaseMenu !== '1') { menu.dataset.psReleaseMenu = '1'; menu.innerHTML = '<button id="psMenuAccount">Hesabım</button><button id="psMenuUpdates">Güncelleme notları</button><button id="psMenuProducts">Ürünlerimiz</button><button id="psMenuLogout" class="ps-danger">Çıkış yap</button>'; $('#psMenuAccount', menu).onclick = () => { menu.hidden = true; openAccountCenter(); }; $('#psMenuUpdates', menu).onclick = () => { menu.hidden = true; showNotes(); }; $('#psMenuProducts', menu).onclick = () => { menu.hidden = true; openSecondHome('offers'); }; $('#psMenuLogout', menu).onclick = () => { menu.hidden = true; logoutFromMenu(); }; }
    const info = $('#updatesBtn'); if (info) info.onclick = showNotes;
  }
  function refresh() { normalizeRemember(); decorateAuth(); decorateSecondHome(); decorateDashboard(); }
  let queued = false; /* Performans: sürekli DOM izleme kapatıldı. */
  window.addEventListener('unhandledrejection', event => { if (event.reason?.message) toast('Beklenmeyen hata', 'İşlem tamamlanamadı. Lütfen tekrar dene.'); });
  refresh();
})();

/* 1.1 · Akış ve Görünüm */
(() => {
  'use strict';
  const KEY = 'play-streamers-v17-site';
  const API = 'https://api.pstreamers.com';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const esc = value => { const span = document.createElement('span'); span.textContent = String(value || ''); return span.innerHTML; };
  const updateItems = [
    'Çıkış akışı doğrudan Cloudflare oturumunu kapatacak ve ardından 1. ana sayfaya dönecek şekilde düzeltildi.',
    '2. ana sayfanın arka planı, marka yapısı ve yazı düzeni yenilendi.',
    'İkinci ana sayfa; hızlı kartlar, geliştirme alanı ve alt bilgiyle daha dolu hale getirildi.',
    '1.0 Tam Sürüm yayımlandı bandı 1. ana sayfa, 2. ana sayfa ve Dashboard üstüne animasyonlu eklendi.',
    'Neler yeni kartına güncelleme merkezini açan animasyonlu ok eklendi.',
    'Kart, menü ve tıklanabilir alanların basma/hover animasyonları iyileştirildi.'
  ];
  function signed() { const data = read().settings || {}; return Boolean(data.userSession && data.user && !data.user.needsCredentialSetup); }
  function closeNotes() { $('#ps11Notes')?.setAttribute('hidden', ''); }
  function showNotes() { let overlay = $('#ps11Notes'); if (!overlay) { overlay = document.createElement('div'); overlay.id = 'ps11Notes'; overlay.className = 'ps11-overlay'; document.body.append(overlay); } overlay.hidden = false; overlay.innerHTML = `<section class="ps11-dialog"><button class="ps11-close" aria-label="Kapat">×</button><span class="ps-second-kicker">GÜNCELLEME MERKEZİ</span><h2>Güncel iyileştirmeler</h2><p>Eski sürüm arşivleri kaldırıldı; yalnızca yayındaki değişiklikler gösterilir.</p><article class="ps11-update"><h3>23 Temmuz 2026 <em>GÜNCEL</em></h3><ul><li>Ana sayfa, hesap menüsü ve bağlantı kontrolleri tekil hale getirildi.</li><li>Yükleme sırası ve Dashboard görünümü düzeltildi.</li></ul></article></section>`; $('.ps11-close', overlay).onclick = closeNotes; overlay.onclick = event => { if (event.target === overlay) closeNotes(); }; }
  function addTicker(host, id) { if (!host || $(`#${id}`)) return; const ticker = document.createElement('div'); ticker.id = id; ticker.className = 'ps-release-marquee'; ticker.innerHTML = '<i></i><span>1.0 TAM SÜRÜM YAYINLANDI · PLAY STREAMERS YAYINCI DENEYİMİ</span>'; host.prepend(ticker); }
  function addTickers() { addTicker($('.landing-shell', $('#authOverlay') || document), 'psPublicRelease'); const second = $('#psSecondHome .ps-second-shell'); addTicker(second, 'psSecondRelease'); }
  function directLogout() { if (!window.confirm('Hesaptan çıkmak istediğine emin misin?')) return; const state = read(); const session = state.settings?.userSession; if (session) fetch(`${API}/api/auth/logout`, { method: 'POST', keepalive: true, headers: { Authorization: `Bearer ${session}` } }).catch(() => {}); state.settings ||= {}; delete state.settings.user; delete state.settings.userSession; state.settings.rememberUser = false; delete state.settings.localAvatar; delete state.settings.localAvatarUserId; localStorage.setItem(KEY, JSON.stringify(state)); sessionStorage.removeItem('psCurrentSession'); sessionStorage.removeItem('ps-second-dashboard'); window.location.replace(window.location.href.split('#')[0]); }
  function decorateSecond() { const home = $('#psSecondHome'); if (!home || home.hidden || !signed()) return; $('#psSecondAccountButton', home)?.remove(); const firstCard = $('.ps-second-grid .ps-second-card', home); if (firstCard && !$('#psSecondNotesArrow', firstCard)) { const title = $('h2', firstCard); if (title) { const row = document.createElement('div'); row.className = 'ps11-notes-head'; title.before(row); row.append(title); const arrow = document.createElement('button'); arrow.id = 'psSecondNotesArrow'; arrow.className = 'ps11-note-arrow'; arrow.type = 'button'; arrow.title = 'Güncelleme notlarını aç'; arrow.setAttribute('aria-label', 'Güncelleme notlarını aç'); arrow.textContent = '→'; arrow.onclick = showNotes; row.append(arrow); } }
    const main = $('.ps-second-main', home); if (main && !$('#psSecondExtra', main)) { const extra = document.createElement('section'); extra.id = 'psSecondExtra'; extra.className = 'ps11-extra'; extra.innerHTML = '<button class="ps11-quick-card" data-open="notes"><b>GÜNCEL KAL</b><h3>Güncelleme merkezi</h3><p>Yayındaki en son geliştirmeleri tek yerde incele.</p></button><button class="ps11-quick-card" data-open="dashboard"><b>HIZLI BAŞLA</b><h3>Yayına hazırlan</h3><p>Canlı durumu, bağlantıları ve olaylarını görmek için Dashboard&#39;a geç.</p></button><button class="ps11-quick-card" data-open="products"><b>ÜRETİYORUZ</b><h3>Yeni araçlar yolda</h3><p>Bağış platformları ve yayıncı istatistikleri için geliştirmeler devam ediyor.</p></button>'; main.append(extra); $$('.ps11-quick-card', extra).forEach(button => button.onclick = () => { if (button.dataset.open === 'notes') showNotes(); else if (button.dataset.open === 'dashboard') $('#psSecondDashboard', home)?.click(); else $('#psSecondOffers', home)?.click(); }); }
    const development = $$('.ps-second-card', home).find(card => $('h2', card)?.textContent.includes('Sıradaki')); if (development && !$('#ps11Development', development)) { const list = document.createElement('div'); list.id = 'ps11Development'; list.className = 'ps11-dev-list'; list.innerHTML = '<div><b>Kanal filtresi</b>Kick olaylarının yalnızca bağlı yayıncı kanalından gelmesini daha sıkı kontrol ediyoruz.</div><div><b>Bağış merkezi</b>Farklı destek platformlarını tek bağlantı düzeninde toplamaya hazırlanıyoruz.</div><div><b>Olay geçmişi</b>Dashboard içindeki eski olayları daha hızlı, daha okunur ve filtrelenebilir hale getiriyoruz.</div>'; development.append(list); }
    if (!$('#psSecondFooter', home)) { const footer = document.createElement('footer'); footer.id = 'psSecondFooter'; footer.className = 'ps11-footer'; footer.innerHTML = '<span>Play Streamers · Yayıncıların kontrol merkezi</span><a href="https://guns.lol/switly" target="_blank" rel="noopener">Developed by Switly</a>'; $('.ps-second-main', home)?.append(footer); }
    $('#psSecondMenuUpdates', home).onclick = () => { $('#psSecondMenu', home).hidden = true; showNotes(); }; $('#psSecondMenuLogout', home).onclick = () => { $('#psSecondMenu', home).hidden = true; directLogout(); }; $('#psSecondNew', home).onclick = showNotes;
  }
  function decorateDashboard() { $('#psMenuUpdates').onclick = () => { $('#sideMenu').hidden = true; showNotes(); }; $('#psMenuLogout').onclick = () => { $('#sideMenu').hidden = true; directLogout(); }; }
  function refresh() { addTickers(); decorateSecond(); decorateDashboard(); }
  let waiting = false; /* Performans: sürekli DOM izleme kapatıldı. */
  refresh();
})();

/* 1.2 · Vitrin ve Akış */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => { const node = document.createElement('span'); node.textContent = String(value || ''); return node.innerHTML; };
  const footerHtml = '<span>Güvenli bağlantılar · Kişisel panel · Ücretsiz başlangıç</span><span>Developed by <a href="https://guns.lol/switly" target="_blank" rel="noopener"><strong>Switly</strong></a></span>';
  const latestItems = [
    '1. ana sayfanın son güncelleme alanı 1.2 · Vitrin ve Akış sürümü ile yenilendi.',
    'Ortak Switly alt bilgisi tüm ana yüzeylere eklendi.',
    'Canlı panel ön izlemesi daha dengeli boyuta çekildi ve sayfa geçişleri hareketlendirildi.',
    'Yeni tıklanabilir bilgi kartları ile Play Streamers hakkında daha fazla ayrıntı eklendi.',
    'Giriş ve kayıt pencereleri animasyonlu açılır hale getirildi; giriş alanı metni düzeltildi.'
  ];
  function closeInfo() { $('#ps12Info')?.setAttribute('hidden', ''); }
  function showInfo(title, text) { let layer = $('#ps12Info'); if (!layer) { layer = document.createElement('div'); layer.id = 'ps12Info'; layer.className = 'ps12-info'; document.body.append(layer); } layer.hidden = false; layer.innerHTML = `<section><button aria-label="Kapat">×</button><span class="ps-second-kicker">PLAY STREAMERS</span><h2>${esc(title)}</h2><p>${esc(text)}</p></section>`; $('button', layer).onclick = closeInfo; layer.onclick = event => { if (event.target === layer) closeInfo(); }; }
  function updateLanding() { const overlay = $('#authOverlay'); if (!overlay) return; const nav = $('.landing-nav', overlay); const release = $('#psPublicRelease'); if (nav && release && release.previousElementSibling !== nav) nav.after(release); const update = $('.landing-update-card', overlay); if (update && update.dataset.ps12 !== '1') { const title = $('h2', update); const description = $('p', update); const list = $('ul', update); if (title) title.textContent = '1.2 · Vitrin ve Akış'; if (description) description.textContent = 'Daha canlı, daha açıklayıcı ve daha akıcı bir Play Streamers ana sayfası.'; if (list) list.innerHTML = latestItems.map(item => `<li>${esc(item)}</li>`).join(''); update.dataset.ps12 = '1'; }
    if (!$('#ps12Discover', overlay)) { const section = document.createElement('section'); section.id = 'ps12Discover'; section.className = 'ps12-discover'; section.innerHTML = '<button data-info="flow"><b>01 · AKIŞ</b><h3>Yayın sırasında ne olur?</h3><p>Olaylar, destekler ve topluluk hareketleri kişisel Dashboard alanında bir araya gelir.</p><span>Nasıl çalışır? →</span></button><button data-info="privacy"><b>02 · GÜVEN</b><h3>Hesabın senin kontrolünde.</h3><p>Oturum bilgileri güvenli altyapıda tutulur; profil ve bağlantılarını tek merkezden yönetirsin.</p><span>Güvenliği keşfet →</span></button><button data-info="community"><b>03 · TOPLULUK</b><h3>Topluluğunu daha iyi tanı.</h3><p>Abonelik, hediye, kicks ve destek hareketleri için gelişen istatistik alanları burada.</p><span>Topluluğu incele →</span></button>'; const footer = $('.landing-footer', overlay); (footer || overlay.lastElementChild).before(section); $$('.ps12-discover button', section).forEach(button => button.onclick = () => { const info = { flow: ['Akış nasıl çalışır?', 'Giriş yaptıktan sonra 2. ana sayfadan Dashboard alanına geçersin. Yayın açıkken oluşan olaylar panelde toplanır ve istatistiklere dönüşür.'], privacy: ['Güvenlik ve kontrol', 'Hesap, oturum ve bağlantı bilgileri kişisel alanın için saklanır. İstersen profil bilgilerini Hesabım ekranından güncelleyebilirsin.'], community: ['Topluluk görünümü', 'Abonelikler, hediyeler, kicks ve destek hareketleri tek yayıncı deneyiminde görünür olacak şekilde geliştiriliyor.'] }[button.dataset.info]; showInfo(info[0], info[1]); }); }
    const footer = $('.landing-footer', overlay); if (footer && footer.dataset.ps12Footer !== '1') { footer.classList.add('ps12-footer'); footer.innerHTML = footerHtml; footer.dataset.ps12Footer = '1'; }
    const identity = $('[name="identity"]', overlay); if (identity) { const label = identity.closest('label'); if (label?.firstChild?.nodeType === Node.TEXT_NODE) label.firstChild.textContent = 'Kullanıcı adı veya e-posta'; identity.placeholder = 'kullanıcı adın veya e-posta adresin'; }
  }
  function updateGlobalFooters() { const second = $('#psSecondFooter'); if (second && second.dataset.ps12Footer !== '1') { second.className = 'ps12-footer'; second.innerHTML = footerHtml; second.dataset.ps12Footer = '1'; } const dashboard = $('.foot'); if (dashboard && dashboard.dataset.ps12Footer !== '1') { dashboard.classList.add('ps12-footer'); dashboard.innerHTML = footerHtml; dashboard.dataset.ps12Footer = '1'; } }
  function animateCarousel() { const host = $('.product-carousel', $('#authOverlay') || document); if (!host || host.dataset.ps12Carousel === '1') return; host.dataset.ps12Carousel = '1'; $$('.carousel-controls button', host).forEach(button => button.addEventListener('click', () => { window.setTimeout(() => { const active = $('.product-page:not([hidden])', host); if (!active) return; active.style.animation = 'none'; active.offsetHeight; active.style.animation = ''; }, 0); }, true)); }
  function updateNotes() { const dialog = $('#ps11Notes .ps11-dialog'); if (!dialog || $('#ps12ReleaseNote', dialog)) return; const note = document.createElement('article'); note.id = 'ps12ReleaseNote'; note.className = 'ps11-update'; note.innerHTML = `<h3>1.2 · Vitrin ve Akış <em>GÜNCEL</em></h3><ul>${latestItems.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`; const first = $('article', dialog); if (first) first.before(note); else dialog.append(note); }
  function refresh() { updateLanding(); updateGlobalFooters(); animateCarousel(); updateNotes(); }
  let queued = false; /* Performans: sürekli DOM izleme kapatıldı. */
  refresh();
})();

/* 1.3 · Odak ve Tanıtım */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => { const node = document.createElement('span'); node.textContent = String(value || ''); return node.innerHTML; };
  const updateItems = [
    'Google ile devam düğmeleri gerçek Google simgesiyle sadeleştirildi; giriş ve kayıt metinleri kaldırıldı.',
    'Doğum tarihi alanındaki takvim simgesi belirginleştirildi.',
    'Ana sayfadaki beta etiketleri kaldırıldı; tam sürüm bandı büyütüldü.',
    'Hakkımızda, Ürünlerimiz ve Nasıl? tanıtım alanları eklendi.',
    'Canlı panel ön izlemesi kısaltıldı; açılır alanlara giriş ve çıkış animasyonları eklendi.'
  ];
  function googleIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.2-.2-1.72H12v3.54h5.52c-.11.88-.7 2.2-2.02 3.09l-.02.12 2.94 2.28.2.02c1.85-1.71 2.98-4.22 2.98-7.33Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.89 6.62-2.42l-3.15-2.44c-.84.59-1.96 1-3.47 1a6 6 0 0 1-5.67-4.13l-.11.01-3.06 2.37-.04.11A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.33 14.01A6.2 6.2 0 0 1 6 12c0-.7.12-1.38.32-2.01v-.14L3.22 7.46l-.1.05A10 10 0 0 0 2 12c0 1.61.39 3.13 1.12 4.49l3.21-2.48Z"/><path fill="#EA4335" d="M12 5.88c1.9 0 3.19.82 3.92 1.5l2.86-2.79C16.96 2.9 14.7 2 12 2A10 10 0 0 0 3.12 7.51l3.2 2.48A6 6 0 0 1 12 5.88Z"/></svg>'; }
  function closeInfo() { $('#ps13Info')?.setAttribute('hidden', ''); }
  function showInfo(title, text) { let layer = $('#ps13Info'); if (!layer) { layer = document.createElement('div'); layer.id = 'ps13Info'; layer.className = 'ps13-info'; document.body.append(layer); } layer.hidden = false; layer.innerHTML = `<section class="ps13-pop"><button aria-label="Kapat">×</button><span class="ps-second-kicker">PLAY STREAMERS</span><h2>${esc(title)}</h2><p>${esc(text)}</p></section>`; $('button', layer).onclick = () => { const card = $('section', layer); card?.classList.add('ps13-leave'); setTimeout(closeInfo, 170); }; layer.onclick = event => { if (event.target === layer) closeInfo(); }; }
  function decorateGoogle() { const button = $('#landingAuthModal #modalGoogle'); if (!button || button.dataset.ps13Google === '1') return; button.dataset.ps13Google = '1'; button.classList.add('ps13-google'); button.setAttribute('aria-label', 'Google ile devam et'); button.title = 'Google ile devam et'; button.innerHTML = googleIcon(); }
  function addAbout() { const overlay = $('#authOverlay'); if (!overlay || $('#ps13About', overlay)) return; const section = document.createElement('section'); section.id = 'ps13About'; section.className = 'ps13-about'; section.innerHTML = '<button data-info="about"><b>01 · HAKKIMIZDA</b><h3>Yayıncıların yanında.</h3><p>Play Streamers, yayın sırasında dağınık kalan olayları, topluluk hareketlerini ve bağlantıları anlaşılır bir kontrol merkezinde buluşturur.</p><span>Bizi tanı →</span></button><button data-info="products"><b>02 · ÜRÜNLERİMİZ</b><h3>Tek merkez, büyüyen araçlar.</h3><p>Canlı Dashboard, yayıncı istatistikleri, bağlantı kontrolü ve geliştirilen destek merkezi aynı ürün ailesinin parçalarıdır.</p><span>Ürünleri keşfet →</span></button><button data-info="how"><b>03 · NASIL?</b><h3>Basit çalışma mantığı.</h3><p>Hesabınla giriş yap, kişisel alanını aç, bağlantılarını kontrol et ve hazır olduğunda yayınının akışını Dashboard üzerinden yönet.</p><span>Nasıl çalışır? →</span></button>'; const update = $('.landing-update-preview', overlay); if (update) update.before(section); else overlay.append(section); $$('.ps13-about button', section).forEach(button => button.onclick = () => { const info = { about: ['Hakkımızda', 'Play Streamers; yayıncıların canlı akışta ihtiyacı olan bilgiyi sade, hızlı ve kişisel bir deneyimde buluşturmak için geliştirilen ücretsiz bir yayıncı merkezidir.'], products: ['Ürünlerimiz', 'Canlı Dashboard olayları, yayıncı istatistikleri, hesap merkezi, bağlantı kontrolü ve ileride eklenecek bağış platformu desteği ürün ailesini oluşturur.'], how: ['Nasıl çalışır?', 'Önce hesabınla giriş yaparsın. Ardından ikinci ana sayfanda hesabını ve yenilikleri görür, Dashboard alanında yayın durumunu ve olaylarını yönetirsin.'] }[button.dataset.info]; showInfo(info[0], info[1]); }); }
  function updateDevelopment() { const box = $('#ps11Development'); if (!box || box.dataset.ps13Development === '1') return; box.dataset.ps13Development = '1'; box.innerHTML = '<div><b>Bağlantı doğruluğu</b>Kick olaylarının yalnızca bağlı yayıncı kanalından gelmesini daha kesin hale getiriyoruz.</div><div><b>Akıllı bildirimler</b>Önemli olayları ayırt eden, okunmuş olayları düzenli arşivleyen bir bildirim yapısı hazırlıyoruz.</div><div><b>Hızlı yayın hazırlığı</b>Yayın öncesi bağlantı ve hesap kontrolünü tek bakışta tamamlayan daha kısa bir hazırlık akışı geliştiriyoruz.</div>'; }
  function updateNotes() { const dialog = $('#ps11Notes .ps11-dialog'); if (!dialog || $('#ps13ReleaseNote', dialog)) return; const note = document.createElement('article'); note.id = 'ps13ReleaseNote'; note.className = 'ps11-update'; note.innerHTML = `<h3>1.3 · Odak ve Tanıtım <em>GÜNCEL</em></h3><ul>${updateItems.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`; const first = $('article', dialog); if (first) first.before(note); else dialog.append(note); }
  function toggleAnimated(menu) { if (!menu) return; if (menu.hidden) { menu.hidden = false; menu.classList.remove('ps13-leave'); menu.classList.add('ps13-menu-open'); setTimeout(() => menu.classList.remove('ps13-menu-open'), 240); return; } menu.classList.add('ps13-leave'); setTimeout(() => { menu.hidden = true; menu.classList.remove('ps13-leave'); }, 170); }
  function animateSurface() { const menuButton = $('#menuBtn'), menu = $('#sideMenu'); if (menuButton && menu && menuButton.dataset.ps13Toggle !== '1') { menuButton.dataset.ps13Toggle = '1'; menuButton.onclick = () => toggleAnimated(menu); } const secondButton = $('#psSecondMenuButton'), secondMenu = $('#psSecondMenu'); if (secondButton && secondMenu && secondButton.dataset.ps13Toggle !== '1') { secondButton.dataset.ps13Toggle = '1'; secondButton.onclick = event => { event.stopPropagation(); toggleAnimated(secondMenu); }; } const auth = $('#landingAuthModal'); if (auth && auth.dataset.ps13Surface !== '1') { auth.dataset.ps13Surface = '1'; auth.classList.add('ps13-pop'); const close = $('.auth-close', auth); if (close) close.onclick = () => { auth.classList.add('ps13-leave'); setTimeout(() => auth.remove(), 170); }; } $$('.ps11-overlay,.ps12-info,.ps13-info').forEach(layer => { if (!layer.hidden && layer.dataset.ps13Surface !== '1') { layer.dataset.ps13Surface = '1'; $('section', layer)?.classList.add('ps13-pop'); } }); }
  function refresh() { decorateGoogle(); addAbout(); updateDevelopment(); updateNotes(); animateSurface(); }
  let queued = false; /* Performans: sürekli DOM izleme kapatıldı. */
  refresh();
})();

/* 1.4 · Akış ve Keşif */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => { const node = document.createElement('span'); node.textContent = String(value || ''); return node.innerHTML; };
  const updateItems = [
    'Son güncelleme alanı 1.4 · Akış ve Keşif sürümüne taşındı.',
    'Akış, güven ve topluluk kartlarının açıklamaları daha ayrıntılı hale getirildi.',
    'Ana gezintiye Hakkımızda, Ürünlerimiz ve Nasıl çalışır başlıkları eklendi.',
    'Canlı panel ön izlemesine hızlı durum özetleri eklendi ve başlıklar büyütüldü.',
    'Kayıt sırasında e-posta isteme zorunluluğu kaldırıldı; kullanıcı adı ve şifreyle devam edebilirsin.'
  ];
  const detail = {
    flow: ['Akış nasıl çalışır?', 'Hesabınla giriş yaptığında yayın durumunu, yeni abonelikleri, hediye abonelikleri, kicks ve destek hareketlerini tek bir zaman çizelgesinde takip edersin. Her olayın kaynağı, zamanı ve varsa ilgili bağlantısı görünür; okuduğun olaylar daha sakin görünür ve panel düzeni yayın boyunca odağını korur.'],
    privacy: ['Güvenlik ve kontrol', 'Oturumun yalnızca sana ait olacak şekilde saklanır. Kullanıcı adı ve şifren sunucuda güvenli biçimde doğrulanır; bağlantı verileri kişisel paneline göre ayrılır. Aynı kullanıcı adı tekrar kullanılamaz ve gelecekte hesap değişiklikleri belirli sürelerle korunur.'],
    community: ['Topluluk görünümü', 'Topluluğundaki abonelik, hediye, kicks ve destek hareketlerini ayrı alanlarda okuyabilirsin. Aylık ve tüm zamanlar görünümü; yeni katılanları, öne çıkan destekçileri ve yayınındaki hareketliliği daha anlamlı karşılaştırmana yardımcı olur.'],
    about: ['Hakkımızda', 'Play Streamers, canlı yayın sırasında dağınık kalan bilgileri tek bir yayıncı merkezinde toplayan ücretsiz bir platformdur. Amacımız; yayıncıların teknik ayrıntılara daha az zaman ayırıp topluluklarıyla daha rahat ilgilenebilmesidir.'],
    products: ['Ürünlerimiz', 'Canlı Dashboard, yayıncı istatistikleri, bağlantı kontrolü, hesap merkezi ve gelişen destek platformu yapısı Play Streamers ürün ailesinin parçalarıdır. Her araç, yayın akışını sadeleştirmek için aynı tasarım diliyle hazırlanır.'],
    how: ['Nasıl çalışır?', 'Bir hesap oluşturur veya giriş yaparsın. Ardından kişisel alanında yenilikleri ve bağlantı durumunu görür, Dashboard düğmesiyle canlı yayın yönetimine geçersin. Sistem yalnızca kendi hesabın ve bağlı kanalların için anlamlı veri göstermeyi hedefler.']
  };
  function closeInfo() { $('#ps14Info')?.setAttribute('hidden', ''); }
  function showInfo(key) { const data = detail[key]; if (!data) return; let layer = $('#ps14Info'); if (!layer) { layer = document.createElement('div'); layer.id = 'ps14Info'; layer.className = 'ps14-info'; document.body.append(layer); } layer.hidden = false; layer.innerHTML = `<section><button type="button" aria-label="Kapat">×</button><span class="ps-second-kicker">PLAY STREAMERS · 1.4</span><h2>${esc(data[0])}</h2><p>${esc(data[1])}</p></section>`; $('button', layer).onclick = closeInfo; layer.onclick = event => { if (event.target === layer) closeInfo(); }; }
  function updateLanding() {
    const overlay = $('#authOverlay'); if (!overlay) return;
    const update = $('.landing-update-card', overlay);
    if (update && update.dataset.ps14 !== '1') { const title = $('h2', update); const description = $('p', update); const list = $('ul', update); if (title) title.textContent = '1.4 · Akış ve Keşif'; if (description) description.textContent = 'Daha açıklayıcı bir ilk sayfa, sade kayıt akışı ve yayıncı odaklı keşif alanları.'; if (list) list.innerHTML = updateItems.map(item => `<li>${esc(item)}</li>`).join(''); update.dataset.ps14 = '1'; }
    const nav = $('.landing-nav', overlay); const actions = $('.landing-actions', nav);
    if (nav && actions && !$('#ps14NavLinks', nav)) { const links = document.createElement('nav'); links.id = 'ps14NavLinks'; links.className = 'ps14-nav-links'; links.setAttribute('aria-label', 'Sayfa bağlantıları'); links.innerHTML = '<button type="button" data-info="about">Hakkımızda</button><button type="button" data-info="products">Ürünlerimiz</button><button type="button" data-info="how">Nasıl çalışır?</button>'; nav.insertBefore(links, actions); $$('button', links).forEach(button => button.onclick = () => { $('#ps13About', overlay)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => showInfo(button.dataset.info), 220); }); }
    const product = $('.product-carousel', overlay);
    if (product && !$('#ps14PanelSummary', product)) { const summary = document.createElement('section'); summary.id = 'ps14PanelSummary'; summary.className = 'ps14-panel-summary'; summary.setAttribute('aria-label', 'Panel hızlı özeti'); summary.innerHTML = '<div><b>3 olay</b>Şimdi sırada</div><div><b>Doğrulandı</b>Bağlantı kontrolü</div><div><b>24/7</b>Yayın akışı görünümü</div>'; const controls = $('.carousel-controls', product); if (controls) product.insertBefore(summary, controls); else product.append(summary); }
  }
  function removeRegistrationEmail() { const form = $('#landingAuthForm'); if (!form || !$('[name="birthDate"]', form)) return; const field = $('[name="email"]', form); if (!field) return; field.required = false; field.disabled = true; const shell = field.closest('label') || field.parentElement; if (shell) shell.hidden = true; }
  function improveDiscover() { const overlay = $('#authOverlay'); const discover = $('#ps12Discover', overlay); if (!discover || discover.dataset.ps14 !== '1') { if (!discover) return; discover.dataset.ps14 = '1'; const cards = { flow: ['Yayın sırasındaki tüm önemli hareketler tek bir akışta düzenlenir.', 'Abonelik, hediye, kicks ve destek bildirimleri zaman bilgisiyle görünür; yayının ritmini kaçırmadan takip edebilirsin.'], privacy: ['Hesabın ve yayın akışın kendi kontrol alanında kalır.', 'Güvenli oturum, kullanıcı adı koruması ve bağlantı kontrolleri; kişisel panelini daha sakin ve güvenilir kullanmana yardımcı olur.'], community: ['Topluluğunun büyümesini daha anlaşılır okumak için tasarlandı.', 'Yeni katılanları, destek hareketlerini ve öne çıkan katkıları ayrı istatistik alanlarında karşılaştırabilirsin.'] }; $$('button', discover).forEach(button => { const info = cards[button.dataset.info]; if (!info) return; const h = $('h3', button), p = $('p', button); if (h) h.textContent = info[0]; if (p) p.textContent = info[1]; button.onclick = () => showInfo(button.dataset.info); }); } }
  function updateNotesAndDevelopment() { const dialog = $('#ps11Notes .ps11-dialog'); if (dialog && !$('#ps14ReleaseNote', dialog)) { const note = document.createElement('article'); note.id = 'ps14ReleaseNote'; note.className = 'ps11-update'; note.innerHTML = `<h3>1.4 · Akış ve Keşif <em>GÜNCEL</em></h3><ul>${updateItems.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`; const first = $('article', dialog); if (first) first.before(note); else dialog.append(note); }
    const development = $('#ps11Development'); if (development && development.dataset.ps14 !== '1') { development.dataset.ps14 = '1'; development.innerHTML = '<div><b>Akış ayrıntıları</b>Canlı olayların kaynak, zaman ve okunma durumunu daha anlaşılır göstermeye devam ediyoruz.</div><div><b>Bağlantı merkezi</b>Farklı destek platformlarını güvenli ve düzenli şekilde tek yayıncı alanında toplamaya hazırlanıyoruz.</div><div><b>Topluluk içgörüleri</b>Yayın sonrası hareketliliği aylık ve tüm zamanlar karşılaştırmalarıyla daha faydalı hale getiriyoruz.</div>'; }
  }
  function ensureSwitlyLink() { $$('a[href="https://guns.lol/switly"]').forEach(link => { link.target = '_blank'; link.rel = 'noopener noreferrer'; link.title = 'Switly profilini yeni sekmede aç'; }); }
  function refresh() { updateLanding(); removeRegistrationEmail(); improveDiscover(); updateNotesAndDevelopment(); ensureSwitlyLink(); }
  let queued = false; /* Performans: sürekli DOM izleme kapatıldı. */
  refresh();
})();

/* 1.5 · Canlı Merkez */
(() => {
  'use strict';
  const API = 'https://api.pstreamers.com';
  const STORE = 'play-streamers-v17-site';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => { const node = document.createElement('span'); node.textContent = String(value || ''); return node.innerHTML; };
  const readState = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } };
  const writeState = value => localStorage.setItem(STORE, JSON.stringify(value));
  const updates = [
    'Ana sayfadaki kayan tam sürüm metni yerine daha sakin bir yayıncı mesajı getirildi ve akış yavaşlatıldı.',
    'Canlı panel ön izlemesi; olay listesi, yayın hedefleri, bağlantı özeti ve hızlı istatistiklerle genişletildi.',
    'Hakkımızda, Ürünlerimiz ve Nasıl çalışır alanları yalnızca üst gezintide tutuldu.',
    'Google simgesinin yanına Kick ile devam seçeneği eklendi; Kick hesabıyla açılan yeni hesaplar artık saklanır.',
    'Bilgi pencereleri, kayıt penceresi ve dışarı tıklama davranışları animasyonlu hale getirildi.'
  ];
  const details = {
    flow: ['01 · Akış', 'Play Streamers yayın başladığında yeni olayları sıraya koyar; abonelik, hediye abonelik, kicks ve bağış türleri birbirine karışmadan ayrı işaretlerle görünür. Her kayıtta zaman, kaynak ve mümkünse ilgili kanal bilgisi bulunur. Böylece yayın sırasında sadece son olayı değil, günün genel temposunu da takip edersin. Okunan olayların daha sakin görünmesi ve önemli olayların öne çıkması için bu akış sürekli geliştiriliyor.'],
    privacy: ['02 · Güven', 'Giriş işlemleri doğrudan güvenli sunucu üzerinden doğrulanır; şifren düz metin olarak saklanmaz. Kullanıcı adları tekrar kullanılmaz, hesap değişiklikleri belirli bekleme süreleriyle korunur ve her kullanıcı kendi oturumuna ait bilgileri görür. Kick veya Google ile devam edildiğinde hizmet sağlayıcının izin ekranı açılır; Play Streamers şifreni bu platformlardan istemez.'],
    community: ['03 · Topluluk', 'Topluluk alanı yalnızca sayılardan oluşmaz: yeni katılanlar, en çok destek verenler, hediye abonelik hareketleri ve yayınındaki anlık katılım aynı hikâyenin parçalarıdır. Aylık görünüm kısa vadeli yükselişi, tüm zamanlar görünümü ise kalıcı topluluk katkısını karşılaştırmana yardım eder. Bu sayede hangi yayınlarda etkileşimin arttığını daha rahat okuyabilirsin.'],
    about: ['Hakkımızda', 'Play Streamers, yayıncıların yayın esnasında dağınık kalan bilgileri tek bir sade merkezden görebilmesi için tasarlanmış ücretsiz bir araçtır. Amacımız, teknik takibi arka plana alıp yayıncı ile topluluğu arasındaki iletişime daha fazla alan bırakmaktır.'],
    products: ['Ürünlerimiz', 'Canlı Dashboard, olay akışı, yayıncı istatistikleri, hesap merkezi ve bağlantı kontrolleri Play Streamers ailesinin temel parçalarıdır. Bu araçlar aynı görsel dil ve aynı kullanım mantığıyla bir arada çalışır.'],
    how: ['Nasıl çalışır?', 'Hesabınla giriş yaptıktan sonra Play Streamers kişisel alanını açar. Buradan bağlantılarını kontrol eder, yenilikleri inceler ve Dashboard alanında yayın verilerini takip edersin. Gereksiz adımları azaltıp önemli bilgileri tek bakışta göstermeye odaklanıyoruz.']
  };
  function closeLayer(layer, remove = false) { if (!layer || layer.dataset.ps15Closing === '1') return; layer.dataset.ps15Closing = '1'; layer.classList.add('ps15-leave'); setTimeout(() => { if (remove) layer.remove(); else layer.hidden = true; layer.classList.remove('ps15-leave'); delete layer.dataset.ps15Closing; }, 200); }
  function showDetail(key) { const info = details[key]; if (!info) return; let layer = $('#ps15Info'); if (!layer) { layer = document.createElement('div'); layer.id = 'ps15Info'; layer.className = 'ps15-info'; document.body.append(layer); } layer.hidden = false; layer.innerHTML = `<section><button class="ps15-close" type="button" aria-label="Kapat">×</button><span class="ps-second-kicker">PLAY STREAMERS · 1.5</span><h2>${esc(info[0])}</h2><p>${esc(info[1])}</p></section>`; $('.ps15-close', layer).onclick = () => closeLayer(layer); layer.onclick = event => { if (event.target === layer) closeLayer(layer); }; }
  function updatePublicPage() {
    const overlay = $('#authOverlay'); if (!overlay) return;
    // 1.6 ve sonraki sürümler ana sayfa bandının metnini yönetir.
    const update = $('.landing-update-card', overlay); if (update && update.dataset.ps15 !== '1') { const title = $('h2', update), intro = $('p', update), list = $('ul', update); if (title) title.textContent = '1.5 · Canlı Merkez'; if (intro) intro.textContent = 'Daha yoğun bir canlı panel, Kick ile hesap başlangıcı ve daha sakin bir ana sayfa.'; if (list) list.innerHTML = updates.map(item => `<li>${esc(item)}</li>`).join(''); update.dataset.ps15 = '1'; }
    const about = $('#ps13About', overlay); if (about) about.hidden = true;
    $$('.ps14-nav-links button', overlay).forEach(button => button.onclick = () => showDetail(button.dataset.info));
    const discover = $('#ps12Discover', overlay); if (discover) $$('button', discover).forEach(button => button.onclick = () => showDetail(button.dataset.info));
    const product = $('.product-carousel', overlay); if (product && !$('#ps15RichPanel', product)) { const panel = document.createElement('section'); panel.id = 'ps15RichPanel'; panel.className = 'ps15-panel-grid'; panel.innerHTML = '<article class="ps15-panel-card"><b>CANLI OLAY SIRASI</b><div class="ps15-event-line"><i>★</i><span>Yeni takip hareketi</span><time>şimdi</time></div><div class="ps15-event-line"><i>K</i><span>Abonelik bildirimi</span><time>1 dk</time></div><div class="ps15-event-line"><i>₺</i><span>Destek platformu olayı</span><time>4 dk</time></div></article><article class="ps15-panel-card"><b>YAYIN HEDEFLERİ</b><div class="ps15-mini-progress"><div><small>Topluluk</small><span><i style="width:72%"></i></span><small>72%</small></div><div><small>Abonelik</small><span><i style="width:48%"></i></span><small>48%</small></div><div><small>Destek</small><span><i style="width:86%"></i></span><small>86%</small></div></div></article>'; const controls = $('.carousel-controls', product); if (controls) product.insertBefore(panel, controls); else product.append(panel); }
  }
  function stripEmailField() { const form = $('#landingAuthForm'); if (!form) return; const input = $('[name="email"]', form); if (!input || !$('[name="birthDate"]', form)) return; input.required = false; input.disabled = true; const holder = input.closest('label') || input.parentElement; if (holder) holder.hidden = true; }
  function kickIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 3h9v3h3v3h-3v2h4v10h-4v-4h-3v4H4V3Zm5 4v4h3V7H9Zm0 8v3h3v-3H9Z"/></svg>'; }
  function addPasswordEyes(root) { $$('input[type="password"]', root).forEach(input => { if (!input.closest('.password-control')) { const shell = document.createElement('span'); shell.className = 'password-control'; input.parentNode.insertBefore(shell, input); shell.append(input); const button = document.createElement('button'); button.type = 'button'; button.className = 'password-toggle'; shell.append(button); } const button = $('.password-toggle', input.closest('.password-control')); if (!button || button.dataset.ps15Eye === '1') return; button.dataset.ps15Eye = '1'; button.textContent = '👁'; button.title = 'Şifreyi göster'; button.setAttribute('aria-label', button.title); button.onclick = () => { const show = input.type === 'password'; input.type = show ? 'text' : 'password'; button.textContent = show ? '◉' : '👁'; button.title = show ? 'Şifreyi gizle' : 'Şifreyi göster'; button.setAttribute('aria-label', button.title); }; }); }
  function decorateProviderButtons() { const form = $('#landingAuthForm'); if (!form) return; const google = $('#modalGoogle', form); if (!google) return; let row = $('.ps15-provider-row,.ps55-provider-pair', form); if (!row) { row = document.createElement('div'); row.className = 'ps15-provider-row'; google.parentNode.insertBefore(row, google); row.append(google); } }
  function bindAuthDismiss() { const layer = $('#landingAuthModal'); if (!layer || layer.dataset.ps15Dismiss === '1') return; layer.dataset.ps15Dismiss = '1'; const close = $('.auth-close', layer); if (close) close.onclick = () => closeLayer(layer, true); layer.addEventListener('click', event => { if (event.target !== layer) return; event.preventDefault(); event.stopImmediatePropagation(); closeLayer(layer, true); }, true); }
  async function captureKickAccountResult() { const params = new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : ''); const sessionId = params.get('user_session'); if (params.get('kick_account_connected') !== '1' || !sessionId || sessionStorage.getItem('ps15KickCaptured') === sessionId) return; sessionStorage.setItem('ps15KickCaptured', sessionId); try { const response = await fetch(`${API}/api/auth/session`, { headers: { Authorization: `Bearer ${sessionId}` } }); const data = await response.json().catch(() => ({})); if (!response.ok || !data.user) throw new Error('Kick oturumu doğrulanamadı.'); const state = readState(); const remember = sessionStorage.getItem('ps-remember-intent') === '1'; state.settings ||= {}; state.settings.userSession = sessionId; state.settings.user = data.user; state.settings.rememberUser = remember; if (remember) state.settings.rememberUntil = Date.now() + 30 * 24 * 60 * 60 * 1000; else delete state.settings.rememberUntil; sessionStorage.setItem('ps48CurrentVisit', '1'); const kickSession = params.get('kick_account_session'); if (kickSession) state.settings.kickSession = kickSession; writeState(state); history.replaceState(null, '', location.pathname + location.search); location.replace(location.pathname + location.search); } catch (error) { sessionStorage.removeItem('ps15KickCaptured'); }
  }
  function resolveKickProfileSurface() { const user = readState().settings?.user; if (!user?.kickConnected || !user.needsCredentialSetup) return; $('#googleProfileSetup')?.remove(); document.body.classList.remove('onboarding-locked'); }
  function showKickCredentialSetup() {
    const state = readState();
    const user = state.settings?.user;
    if (!user?.kickConnected || !user.needsCredentialSetup || $('#ps15KickSetup')) return;

    const maximumBirthDate = () => {
      const date = new Date();
      date.setFullYear(date.getFullYear() - 18);
      return date.toISOString().slice(0, 10);
    };
    const layer = document.createElement('div');
    layer.id = 'ps15KickSetup';
    layer.className = 'ps15-kick-setup';
    layer.innerHTML = `<section>
      <span class="ps-second-kicker">PLAY STREAMERS</span>
      <h2>Hesabını tamamla</h2>
      <p>Hesabın hazır. Devam etmek için kullanıcı adını, şifreni ve doğum tarihini belirle.</p>
      <form class="auth-form" id="kickProfileForm">
        <label class="auth-field">Kullanıcı adı<input name="username" minlength="3" maxlength="24" required placeholder="ornek.kullanici"></label>
        <label class="auth-field">Şifre<input name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="En az 8 karakter"></label>
        <label class="auth-field">Şifre tekrar<input name="passwordRepeat" type="password" autocomplete="new-password" minlength="8" required placeholder="Şifreni yeniden yaz"></label>
        <label class="auth-field ps38-completion-age">Doğum tarihi (18+)<input name="birthDate" type="date" required max="${maximumBirthDate()}" aria-label="Doğum tarihi"></label>
        <p class="ps15-error" aria-live="polite"></p>
        <button class="auth-submit" type="submit">Hesabı tamamla</button>
        <button class="ps38-completion-logout" type="button" data-ps38-completion-logout="1">Çıkış yap</button>
      </form>
    </section>`;
    document.body.append(layer);

    const form = $('form', layer);
    const error = $('.ps15-error', layer);
    addPasswordEyes(form);
    $('[data-ps38-completion-logout]', form).onclick = () => {
      const latest = readState();
      const sessionId = latest.settings?.userSession || '';
      if (sessionId) fetch(`${API}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${sessionId}` }, keepalive: true }).catch(() => {});
      latest.settings ||= {};
      delete latest.settings.user;
      delete latest.settings.userSession;
      latest.settings.rememberUser = false;
      writeState(latest);
      const done = () => location.replace(location.pathname + location.search);
      if (typeof window.psUnifiedLoad === 'function') window.psUnifiedLoad(done); else done();
    };
    form.onsubmit = async event => {
      event.preventDefault();
      const password = $('[name="password"]', form).value;
      const repeat = $('[name="passwordRepeat"]', form).value;
      const birthDate = $('[name="birthDate"]', form).value;
      if (password !== repeat) { error.textContent = 'Şifreler birbiriyle aynı değil.'; return; }
      if (!birthDate || birthDate > maximumBirthDate()) { error.textContent = 'Devam etmek için en az 18 yaşında olmalısın.'; return; }
      try {
        const response = await fetch(`${API}/api/auth/complete-kick-profile`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${state.settings.userSession}`, 'content-type': 'application/json' },
          body: JSON.stringify({ username: $('[name="username"]', form).value, password, passwordRepeat: repeat, birthDate })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Hesap tamamlanamadı.');
        const latest = readState();
        latest.settings ||= {};
        latest.settings.user = data.user;
        writeState(latest);
        sessionStorage.setItem('ps15KickEmailNotice', '1');
        closeLayer(layer, true);
        setTimeout(() => location.replace(location.pathname + location.search), 210);
      } catch (requestError) { error.textContent = requestError.message || 'Hesap tamamlanamadı.'; }
    };
  }
  function showKickEmailNotice() { if (sessionStorage.getItem('ps15KickEmailNotice') !== '1' || $('#ps15EmailMissing')) return; sessionStorage.removeItem('ps15KickEmailNotice'); const layer = document.createElement('div'); layer.id = 'ps15EmailMissing'; layer.className = 'ps15-email-missing'; layer.innerHTML = '<section><button class="ps15-close" type="button" aria-label="Kapat">×</button><span class="ps-second-kicker">HESAP BİLGİSİ</span><h2>E-postan bağlı değil</h2><p>Kick ile oluşturulan hesabın hazır. Şimdilik kullanıcı adın ve şifrenle giriş yapabilirsin; e-posta adresini daha sonra Hesabım alanından bağlayabilirsin.</p><button class="auth-submit" type="button">Tamam</button></section>'; document.body.append(layer); $('.ps15-close', layer).onclick = () => closeLayer(layer, true); $('.auth-submit', layer).onclick = () => closeLayer(layer, true); layer.onclick = event => { if (event.target === layer) closeLayer(layer, true); }; }
  function updateNotes() { const dialog = $('#ps11Notes .ps11-dialog'); if (dialog && !$('#ps15ReleaseNote', dialog)) { const note = document.createElement('article'); note.id = 'ps15ReleaseNote'; note.className = 'ps11-update'; note.innerHTML = `<h3>1.5 · Canlı Merkez <em>GÜNCEL</em></h3><ul>${updates.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`; const first = $('article', dialog); if (first) first.before(note); else dialog.append(note); } const development = $('#ps11Development'); if (development && development.dataset.ps15 !== '1') { development.dataset.ps15 = '1'; development.innerHTML = '<div><b>Kick hesap başlangıcı</b>Kick ile devam eden yayıncıların hesaplarını güvenli biçimde kişisel kullanıcı adı ve şifre adımıyla tamamlıyoruz.</div><div><b>Daha zengin canlı panel</b>Olay sırası, yayın hedefleri ve bağlantı özeti gibi bilgileri tek ön izlemede daha okunur hale getiriyoruz.</div><div><b>Topluluk ritmi</b>Yayın içi hareketleri daha anlamlı karşılaştırabilmen için aylık ve tüm zamanlar özetlerini geliştiriyoruz.</div>'; } }
  function refresh() { updatePublicPage(); stripEmailField(); decorateProviderButtons(); bindAuthDismiss(); updateNotes(); resolveKickProfileSurface(); showKickCredentialSetup(); showKickEmailNotice(); }
  captureKickAccountResult();
  let queued = false; /* Performans: sürekli DOM izleme kapatıldı. */
  refresh();
})();

/* 1.6 · Sahne ve Bağlantı */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => { const node = document.createElement('span'); node.textContent = String(value || ''); return node.innerHTML; };
  const updates = [
    'Ana sayfa bandı 1.0 Tam Sürüm mesajına döndü ve daha sakin bir hızla akmaya başladı.',
    'Canlı panelin üç ön izleme sayfasına birbirinden farklı ek yayın, topluluk ve destek ayrıntıları eklendi.',
    'Kick ile hesap açıldığında Kick bağlantısı da otomatik olarak kişisel panele kaydediliyor.',
    'Kayıt ekranındaki e-posta alanını ekleyen eski davranış tamamen kaldırıldı; beyaz özel takvim düğmesi eklendi.',
    'Hakkımızda, Ürünlerimiz ve Nasıl çalışır açıklamaları artık sağdan kayan ayrı bir sayfa deneyiminde açılıyor.'
  ];
  const drawerContent = {
    about: ['Hakkımızda', 'Play Streamers, yayıncıların canlı yayın esnasında ihtiyaç duyduğu bilgileri daha sakin ve anlaşılır bir merkezde toplamayı amaçlar. Olayları, topluluk hareketlerini ve bağlantı kontrollerini tek yerde göstererek yayıncının dikkatini sohbetinden ayırmadan kontrol sağlamasına yardımcı olur.'],
    products: ['Ürünlerimiz', 'Canlı Dashboard; anlık olayların, yayın durumunun ve hızlı kontrollerin bulunduğu alandır. Yayıncı istatistikleri topluluğundaki değişimi anlamana yardım eder. Hesap merkezi ise oturum, profil ve bağlantı bilgilerini senin kontrolünde tutar. Yeni bağış platformları ve gelişmiş geçmiş görünümü sıradaki ürün parçalarıdır.'],
    how: ['Nasıl çalışır?', 'Bir hesap oluşturduğunda veya giriş yaptığında kişisel alanın açılır. Kick ile devam edersen Kick oturumun otomatik olarak hesabına bağlanır; tekrar bağlantı kurmana gerek kalmaz. Ardından Dashboard alanından yayın akışını, olayları ve gelişen istatistikleri takip edebilirsin.']
  };
  function closeDrawer() { const drawer = $('#ps16Drawer'); if (!drawer || drawer.dataset.closing === '1') return; drawer.dataset.closing = '1'; drawer.classList.add('ps16-close-out'); setTimeout(() => { drawer.hidden = true; drawer.classList.remove('ps16-close-out'); delete drawer.dataset.closing; }, 230); }
  function showDrawer(key) { const data = drawerContent[key]; if (!data) return; let drawer = $('#ps16Drawer'); if (!drawer) { drawer = document.createElement('div'); drawer.id = 'ps16Drawer'; drawer.className = 'ps16-drawer'; document.body.append(drawer); } drawer.hidden = false; drawer.innerHTML = `<section><button type="button" class="ps16-close" aria-label="Kapat">×</button><span class="ps-second-kicker">PLAY STREAMERS · 1.6</span><h2>${esc(data[0])}</h2><p>${esc(data[1])}</p></section>`; $('.ps16-close', drawer).onclick = closeDrawer; drawer.onclick = event => { if (event.target === drawer) closeDrawer(); }; }
  function calendarIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v3h6V2h2v3h2a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h2V2Zm13 8H4v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9ZM7 13h3v3H7v-3Zm5 0h3v3h-3v-3Z"/></svg>'; }
  function makeWhiteCalendar() { const form = $('#landingAuthForm'); if (!form) return; const input = $('[name="birthDate"]', form); if (!input || input.closest('.ps16-date-control')) return; const shell = document.createElement('span'); shell.className = 'ps16-date-control'; input.parentNode.insertBefore(shell, input); shell.append(input); const button = document.createElement('button'); button.type = 'button'; button.className = 'ps16-calendar-button'; button.setAttribute('aria-label', 'Takvimi aç'); button.innerHTML = calendarIcon(); button.onclick = () => { try { input.showPicker(); } catch { input.focus(); } }; shell.append(button); }
  function updatePublicSurface() { const overlay = $('#authOverlay'); if (!overlay) return; const ticker = $('#psPublicRelease'); const text = ticker ? $('span', ticker) : null; const message = '1.0 TAM SÜRÜM YAYINLANDI · PLAY STREAMERS İLE YAYINCILIK DENEYİMİ'; if (text && text.textContent !== message) text.textContent = message; const card = $('.landing-update-card', overlay); if (card && card.dataset.ps16 !== '1') { const title = $('h2', card), intro = $('p', card), list = $('ul', card); if (title) title.textContent = '1.6 · Sahne ve Bağlantı'; if (intro) intro.textContent = 'Daha dolu bir canlı panel, otomatik Kick bağlantısı ve kayan bilgi sayfaları.'; if (list) list.innerHTML = updates.map(item => `<li>${esc(item)}</li>`).join(''); card.dataset.ps16 = '1'; }
    const brand = $('.landing-brand', overlay); if (brand && brand.dataset.ps16 !== '1') { brand.dataset.ps16 = '1'; brand.tabIndex = 0; brand.setAttribute('role', 'button'); brand.title = 'Ana sayfaya dön'; brand.onclick = () => location.assign(location.pathname + location.search); brand.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); brand.click(); } }; }
    $$('.ps14-nav-links button', overlay).forEach(button => button.onclick = () => showDrawer(button.dataset.info));
    $$('#ps12Discover button', overlay).forEach(button => button.onclick = () => showDrawer(button.dataset.info));
  }
  function enrichPanelPages() { const host = $('.product-carousel', $('#authOverlay') || document); if (!host) return; const extras = { '0': '<div><b>SOHBET NABZI</b>146 aktif izleyici</div><div class="purple"><b>SONRAKİ HEDEF</b>12 yeni takip</div><div class="gold"><b>YAYIN SÜRESİ</b>02:48:16</div>', '1': '<div><b>YENİ KATILANLAR</b>Bu hafta +64 kişi</div><div class="purple"><b>SADAKAT</b>87% geri dönüş</div><div class="gold"><b>TOPLULUK PUANI</b>1.248 etkileşim</div>', '2': '<div><b>BUGÜNÜN DESTEĞİ</b>₺425 toplam</div><div class="purple"><b>BAĞLI KAYNAKLAR</b>Kick · Donate</div><div class="gold"><b>TEŞEKKÜR SIRASI</b>3 yeni mesaj</div>' }; $$('.product-page', host).forEach(page => { if ($('.ps16-page-extra', page)) return; const extra = document.createElement('section'); extra.className = 'ps16-page-extra'; extra.innerHTML = extras[page.dataset.page] || ''; page.append(extra); }); }
  function fixAuthControls() { const form = $('#landingAuthForm'); if (!form) return; const email = $('[name="email"]', form); if (email) { email.required = false; email.disabled = true; const holder = email.closest('label') || email.parentElement; if (holder) holder.remove(); } makeWhiteCalendar(); }
  function updateNotes() { const dialog = $('#ps11Notes .ps11-dialog'); if (dialog && !$('#ps16ReleaseNote', dialog)) { const note = document.createElement('article'); note.id = 'ps16ReleaseNote'; note.className = 'ps11-update'; note.innerHTML = `<h3>1.6 · Sahne ve Bağlantı <em>GÜNCEL</em></h3><ul>${updates.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`; const first = $('article', dialog); if (first) first.before(note); else dialog.append(note); } const development = $('#ps11Development'); if (development && development.dataset.ps16 !== '1') { development.dataset.ps16 = '1'; development.innerHTML = '<div><b>Otomatik bağlantı</b>Kick ile giriş yapan yayıncıların bağlantı durumunu tekrar kurulum istemeden güvenli biçimde koruyoruz.</div><div><b>Panel sayfaları</b>Canlı yayın, topluluk ve destek alanlarını daha kapsamlı ama kolay okunur ayrı ön izlemelere dönüştürüyoruz.</div><div><b>Hızlı keşif</b>Bilgi sayfalarını panelden ayrılmadan inceleyebileceğin daha akıcı gezinti deneyimleri geliştiriyoruz.</div>'; } }
  function refresh() { updatePublicSurface(); fixAuthControls(); enrichPanelPages(); updateNotes(); }
  let queued = false; /* Performans: sürekli DOM izleme kapatıldı. */
  refresh();
})();

/* 1.1 Anasayfa · Birleşik Güncelleme */
(() => {
  'use strict';
  const API = 'https://api.pstreamers.com';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => { const node = document.createElement('span'); node.textContent = String(value || ''); return node.innerHTML; };
  const summary = [
    '1.1–1.6 arasındaki ana sayfa düzenleri tek “1.1 Anasayfa Güncellemesi” altında birleştirildi.',
    'Giriş, kayıt, beni hatırla, Google ve Kick ile devam altyapısı geliştirildi; e-posta artık kayıt sırasında zorunlu değil.',
    'Kullanıcı adı, şifre, profil, oturum ve bağlantı yönetimi için hesap merkezi güçlendirildi.',
    'Canlı panel; yayın, topluluk ve destek için farklı ön izleme sayfaları, olay akışı ve istatistik özetleriyle genişletildi.',
    'Hakkımızda, Ürünlerimiz ve Nasıl çalışır alanları; üst gezintide ayrı sayfalara dönüştürüldü.',
    'Açılır pencereler, bilgi kartları, göz simgeleri ve takvim davranışları sadeleştirilip animasyonlu hale getirildi.',
    'Kick ile hesap başlangıcında bağlantının otomatik kaydedilmesi ve durum takibinin iyileştirilmesi eklendi.'
  ];
  const cardInfo = {
    flow: ['01 · Akış', 'Yayın başladığında olaylar zamana göre sıraya girer; abonelikler, hediyeler, kicks ve bağışlar kendi simgeleriyle ayrışır. Her kayıtta zaman ve kaynak bilgisi görünür. Böylece yeni bir olay olduğunda ne olduğunu hızlıca anlayabilir, yayın ritmini tek bir yerde takip edebilirsin.'],
    privacy: ['02 · Güven', 'Hesap oturumun sunucu tarafından doğrulanır ve şifreler düz metin olarak saklanmaz. Kullanıcı adları tekrar kullanılamaz; hesap değişiklikleri belirli bekleme süreleriyle korunur. Google veya Kick ile devam edildiğinde izin işlemi doğrudan ilgili platformun kendi ekranında yapılır.'],
    community: ['03 · Topluluk', 'Topluluk görünümü yeni katılanları, hediye abonelik hareketlerini, destekçileri ve yayın etkileşimini anlamlı şekilde bir araya getirir. Aylık özetler kısa vadeli değişimi, tüm zamanlar verisi ise kalıcı katkıyı görmene yardım eder.']
  };
  function eyeSvg(hidden) { return hidden ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.8 10.9a3 3 0 0 0 4.2 4.2M9.9 5.1A10.9 10.9 0 0 1 12 4c5.6 0 9.6 4.7 10 8-.2 1.5-1.1 3.1-2.6 4.5M6.4 6.4C4.3 7.8 2.6 10.1 2 12c.7 3.4 4.5 8 10 8 1 0 2-.2 2.9-.6"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-8 10-8 10 8 10 8-3.6 8-10 8S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>'; }
  function standardEyes() { $$('.password-toggle').forEach(button => { const control = button.closest('.password-control'); if (!control) return; const input = $('input', control); if (!input || button.dataset.ps17Eye === '1') return; button.dataset.ps17Eye = '1'; const paint = () => { const visible = input.type === 'text'; button.innerHTML = eyeSvg(visible); button.title = visible ? 'Şifreyi gizle' : 'Şifreyi göster'; button.setAttribute('aria-label', button.title); }; paint(); button.onclick = () => { input.type = input.type === 'password' ? 'text' : 'password'; paint(); }; }); }
  function kickSvg() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#53fc18" d="M3 2h6v6h3V4h9v6h-4v4h4v6h-9v-5H9v7H3V2Zm6 8v5h3v-5H9Z"/></svg>'; }
  function fixKickIcon() { const button = $('#ps15KickAuth'); if (!button || button.dataset.ps17Kick === '1') return; button.dataset.ps17Kick = '1'; button.innerHTML = kickSvg(); button.title = 'Kick ile devam et'; }
  function fixCalendar() { const form = $('#landingAuthForm'); if (!form) return; const input = $('[name="birthDate"]', form); if (!input) return; const field = input.closest('label') || input.parentElement; $$('.date-picker-button', field).forEach(button => button.remove()); const custom = $('.ps16-calendar-button', field); if (custom) { custom.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v3h6V2h2v3h2a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h2V2Zm13 8H4v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9ZM7 13h3v3H7v-3Zm5 0h3v3h-3v-3Z"/></svg>'; }
  }
  function showCardInfo(key) { const data = cardInfo[key]; if (!data) return; let layer = $('#ps17CardInfo'); if (!layer) { layer = document.createElement('div'); layer.id = 'ps17CardInfo'; layer.className = 'ps17-card-info'; document.body.append(layer); } layer.hidden = false; layer.innerHTML = `<section><button type="button" aria-label="Kapat">×</button><span class="ps-second-kicker">PLAY STREAMERS · ANASAYFA</span><h2>${esc(data[0])}</h2><p>${esc(data[1])}</p></section>`; $('button', layer).onclick = () => layer.hidden = true; layer.onclick = event => { if (event.target === layer) layer.hidden = true; }; }
  function showInfoPage(key) { const label = { about: 'Hakkımızda', products: 'Ürünlerimiz', how: 'Nasıl çalışır?' }[key]; if (!label) return; let page = $('#ps17InfoPage'); if (!page) { page = document.createElement('section'); page.id = 'ps17InfoPage'; page.className = 'ps17-info-page'; document.body.append(page); } page.hidden = false; page.innerHTML = `<header><button class="ps17-page-brand" type="button" aria-label="Ana sayfaya dön"><span class="brand-logo">PS</span><span>PLAY STREAMERS</span></button><button class="ps17-page-back" type="button">Ana sayfaya dön</button></header><h1 class="ps17-page-title">${esc(label)}</h1>`; $('.ps17-page-brand', page).onclick = () => page.hidden = true; $('.ps17-page-back', page).onclick = () => page.hidden = true; }
  function setStatus(button, level, message) { button.className = `ps17-system-status ${level}`; button.dataset.level = level; button.dataset.message = message; button.textContent = '!'; button.title = 'Sistem durumu'; }
  function showStatus(button) { let panel = $('#ps17StatusPanel'); if (!panel) { panel = document.createElement('aside'); panel.id = 'ps17StatusPanel'; panel.className = 'ps17-status-panel'; document.body.append(panel); } panel.hidden = false; const level = button.dataset.level || 'yellow'; const headings = { green: 'Sistem normal', yellow: 'Küçük bilgi', orange: 'Kısmi işlev sorunu', red: 'Sistem sorunu' }; panel.innerHTML = `<button type="button" aria-label="Kapat">×</button><h3><span class="${level}">!</span>${esc(headings[level])}</h3><p>${esc(button.dataset.message || 'Sistem durumu kontrol ediliyor.')}</p>`; $('button', panel).onclick = () => panel.hidden = true; }
  function installStatus() { const actions = $('.landing-actions', $('#authOverlay') || document); if (!actions || $('#ps17SystemStatus', actions)) return; const button = document.createElement('button'); button.id = 'ps17SystemStatus'; button.type = 'button'; setStatus(button, 'yellow', 'Sistem durumu kontrol ediliyor.'); button.onclick = () => showStatus(button); const signup = $('#landingSignup', actions); actions.insertBefore(button, signup || null); if (!navigator.onLine) { setStatus(button, 'red', 'İnternet bağlantısı yok. Giriş, kayıt ve canlı veriler şu anda kullanılamaz.'); return; } if (location.protocol === 'file:') { setStatus(button, 'yellow', 'Yerel önizlemedesin. Tasarımı inceleyebilirsin; Google ve Kick ile giriş yalnızca yayınlanmış sitede çalışır.'); return; } fetch(`${API}/health`, { cache: 'no-store' }).then(response => response.json().then(data => ({ response, data }))).then(({ response, data }) => { if (!response.ok || !data?.ok) throw new Error('health'); if (data.version !== '1.6') { setStatus(button, 'orange', 'Cloudflare Worker güncel görünmüyor. Kick ile hesap açma gibi yeni işlevler çalışmayabilir; Worker kodunu yükleyip Deploy et.'); return; } setStatus(button, 'green', 'Sistem normal görünüyor. Giriş, kayıt ve canlı panel bağlantıları kullanılabilir.'); }).catch(() => setStatus(button, 'red', 'Cloudflare Worker’a ulaşılamıyor. Giriş, kayıt ve canlı veri işlevleri şu anda kullanılamaz.')); }
  function updateReleaseNotes() { const dialog = $('#ps11Notes .ps11-dialog'); if (!dialog) return; let note = $('#ps17ReleaseNote', dialog); if (!note) { note = document.createElement('article'); note.id = 'ps17ReleaseNote'; note.className = 'ps11-update'; note.innerHTML = `<h3>1.1 Anasayfa Güncellemesi <em>GÜNCEL</em></h3><ul>${summary.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`; dialog.prepend(note); } $$('article', dialog).forEach(article => { if (article !== note) article.hidden = true; }); note.hidden = false; }
  function updatePublicRelease() { const overlay = $('#authOverlay'); if (!overlay) return; const update = $('.landing-update-card', overlay); if (update && update.dataset.ps17 !== '1') { const title = $('h2', update), intro = $('p', update), list = $('ul', update); if (title) title.textContent = '1.1 · Anasayfa Güncellemesi'; if (intro) intro.textContent = 'Önceki ana sayfa geliştirmeleri, tek ve daha stabil bir sürüm altında toplandı.'; if (list) list.innerHTML = summary.slice(0, 5).map(item => `<li>${esc(item)}</li>`).join(''); update.dataset.ps17 = '1'; }
    const ticker = $('#psPublicRelease'); const span = ticker ? $('span', ticker) : null; const message = '1.0 TAM SÜRÜM YAYINLANDI · PLAY STREAMERS İLE YAYINCILIK DENEYİMİ'; if (span && span.textContent !== message) span.textContent = message;
    $$('.ps14-nav-links button', overlay).forEach(button => button.onclick = () => showInfoPage(button.dataset.info)); $$('#ps12Discover button', overlay).forEach(button => button.onclick = () => showCardInfo(button.dataset.info)); }
  function refresh() { updatePublicRelease(); standardEyes(); fixKickIcon(); fixCalendar(); installStatus(); updateReleaseNotes(); }
  let queued = false; /* Performans: sürekli DOM izleme kapatıldı. */
  refresh();
})();

/* 1.1 Anasayfa · Kullanılabilirlik ve Geçişler */
(() => {
  'use strict';
  const API = 'https://api.pstreamers.com';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => { const node = document.createElement('span'); node.textContent = String(value || ''); return node.innerHTML; };
  const runtimeIssues = [];
  let currentPage = 'home';
  window.addEventListener('error', event => { if (event.message && !runtimeIssues.includes(event.message)) { runtimeIssues.push(event.message); refreshStatus(); } });
  window.addEventListener('unhandledrejection', event => { const message = String(event.reason?.message || event.reason || 'Bilinmeyen istek hatası'); if (!runtimeIssues.includes(message)) { runtimeIssues.push(message); refreshStatus(); } });
  function stateMessage(level, title, items) { return { level, title, items }; }
  function applyStatus(button, status) { button.className = `ps17-system-status ${status.level}`; button.dataset.ps18Level = status.level; button.dataset.ps18Title = status.title; button.dataset.ps18Items = JSON.stringify(status.items); button.textContent = '!'; button.title = status.title; }
  function evaluateLocal() { const critical = [['#authOverlay', 'Ana sayfa kabuğu'], ['#landingLogin', 'Giriş düğmesi'], ['#landingSignup', 'Kayıt düğmesi'], ['.product-carousel', 'Canlı panel ön izlemesi'], ['#ps12Discover', 'Akış kartları']].filter(([selector]) => !$(selector)); if (critical.length) return stateMessage('red', 'Sistem sorunu', critical.map(([, name]) => `${name} yüklenemedi; ana sayfa eksik çalışır.`)); if (!navigator.onLine) return stateMessage('red', 'Sistem sorunu', ['İnternet bağlantısı yok. Giriş, kayıt ve canlı veriler kullanılamaz.']); if (location.protocol === 'file:') return stateMessage('yellow', 'Yerel önizleme bilgisi', ['Tasarım kullanılabilir. Google ve Kick ile giriş yalnızca GitHub’daki yayınlanmış sitede çalışır.']); if (runtimeIssues.length) return stateMessage('orange', 'Kısmi işlev sorunu', runtimeIssues.slice(-3).map(message => `Tarayıcı bildirimi: ${message}`)); return null; }
  function openStatus(button) { let layer = $('#ps18StatusLayer'); if (!layer) { layer = document.createElement('div'); layer.id = 'ps18StatusLayer'; layer.className = 'ps18-status-layer'; document.body.append(layer); } const level = button.dataset.ps18Level || 'yellow'; let items = []; try { items = JSON.parse(button.dataset.ps18Items || '[]'); } catch { items = ['Durum ayrıntıları okunamadı.']; } layer.hidden = false; layer.innerHTML = `<section><button type="button" class="ps18-close" aria-label="Kapat">×</button><h3><span class="${level}">!</span>${esc(button.dataset.ps18Title || 'Sistem durumu')}</h3><p>Bu alan, ana sayfanın kullanılabilirliğini ve bağlantı durumunu kontrol eder.</p><ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section>`; const close = () => { if (layer.dataset.closing === '1') return; layer.dataset.closing = '1'; layer.classList.add('ps18-status-out'); setTimeout(() => { layer.hidden = true; layer.classList.remove('ps18-status-out'); delete layer.dataset.closing; }, 200); }; $('.ps18-close', layer).onclick = close; layer.onclick = event => { if (event.target === layer) close(); }; }
  function refreshStatus() { const button = $('#ps17SystemStatus'); if (!button) return; const local = evaluateLocal(); if (local) { applyStatus(button, local); return; } applyStatus(button, stateMessage('yellow', 'Sistem kontrol ediliyor', ['Cloudflare Worker sürümü ve erişimi denetleniyor.'])); fetch(`${API}/health`, { cache: 'no-store' }).then(response => response.json().then(data => ({ response, data }))).then(({ response, data }) => { if (!response.ok || !data?.ok) throw new Error('Sağlık denetimi başarısız.'); if (data.version !== '1.6') { applyStatus(button, stateMessage('orange', 'Kısmi işlev sorunu', ['Cloudflare Worker güncel değil. Kick ile hesap açma gibi yeni işlevler çalışmayabilir.', 'Worker kodunu güncelleyip Deploy et.'])); return; } applyStatus(button, stateMessage('green', 'Sistem normal', ['Ana sayfa bileşenleri yüklendi.', 'Cloudflare Worker güncel ve erişilebilir görünüyor.', 'Giriş, kayıt ve bağlantı alanları kullanıma hazır.'])); }).catch(() => applyStatus(button, stateMessage('red', 'Sistem sorunu', ['Cloudflare Worker’a ulaşılamıyor.', 'Giriş, kayıt ve canlı veri işlevleri şu anda kullanılamaz.']))); }
  function installStatus() { const actions = $('.landing-actions', $('#authOverlay') || document); if (!actions) return; let button = $('#ps17SystemStatus', actions); if (!button) { button = document.createElement('button'); button.id = 'ps17SystemStatus'; button.type = 'button'; actions.append(button); } const login = $('#landingLogin', actions); if (login && button.previousElementSibling !== login) actions.insertBefore(button, login); button.onclick = () => openStatus(button); refreshStatus(); }
  function closeCardInfo() { const layer = $('#ps17CardInfo'); if (!layer || layer.dataset.closing === '1') return; layer.dataset.closing = '1'; layer.classList.add('ps18-info-out'); setTimeout(() => { layer.hidden = true; layer.classList.remove('ps18-info-out'); delete layer.dataset.closing; }, 210); }
  function enhanceCardInfo() { const layer = $('#ps17CardInfo'); if (!layer || layer.dataset.ps18Close === '1') return; layer.dataset.ps18Close = '1'; $('button', layer).onclick = closeCardInfo; layer.onclick = event => { if (event.target === layer) closeCardInfo(); }; }
  function officialKickMark() { return '<img src="https://kick.com/favicon.ico" alt="Kick" referrerpolicy="no-referrer">'; }
  function fixKickMark() { const button = $('#ps15KickAuth'); if (!button || button.dataset.ps18Kick === '1') return; button.dataset.ps18Kick = '1'; button.innerHTML = officialKickMark(); button.title = 'Kick ile devam et'; }
  function removeExtraCalendar() { const form = $('#landingAuthForm'); if (!form) return; const input = $('[name="birthDate"]', form); if (!input) return; const field = input.closest('label') || input.parentElement; $$('.date-picker-button', field).forEach(button => button.remove()); input.style.colorScheme = 'dark'; }
  function renameFooter() { $$('a[href="https://guns.lol/switly"]').forEach(link => { const strong = $('strong', link); if (strong) strong.textContent = 'SW CREATE'; else link.textContent = 'SW CREATE'; link.title = 'SW CREATE profilini aç'; }); }
  function detailFor(key) { return { flow: ['01 · Akış', 'Yayın açıkken abonelik, hediye abonelik, kicks ve destek hareketleri zaman sırasıyla tek akışta toplanır. Her tür kendi simgesi ve kısa açıklamasıyla görünür. Önemli olaylar öne çıkar, okunan olaylar daha sakin durur; böylece yayın sırasında sohbetten kopmadan neler olduğunu anlayabilirsin.'], privacy: ['02 · Güven', 'Oturum bilgilerin yalnızca kişisel hesabın için kullanılır. Şifren düz metin olarak saklanmaz; kullanıcı adları tekrarlanamaz ve hesap değişiklikleri belirli sürelerle korunur. Google ve Kick izinleri kendi resmi giriş ekranlarında verilir, Play Streamers bu hesapların şifrelerini görmez.'], community: ['03 · Topluluk', 'Yeni katılanlar, abonelikler, hediye hareketleri, kicks ve destekçiler ayrı türlerde değerlendirilir. Aylık görünüm güncel yükselişi, tüm zamanlar görünümü ise topluluğunun uzun vadeli katkısını görmene yardım eder. Bu veriler, yayınlarının hangi anlarda daha fazla etkileşim aldığını anlamanı kolaylaştırır.'] }[key]; }
  function showDetailedCard(key) { const data = detailFor(key); if (!data) return; let layer = $('#ps17CardInfo'); if (!layer) { layer = document.createElement('div'); layer.id = 'ps17CardInfo'; layer.className = 'ps17-card-info'; document.body.append(layer); } layer.hidden = false; layer.dataset.ps18Close = '1'; layer.innerHTML = `<section><button type="button" aria-label="Kapat">×</button><span class="ps-second-kicker">PLAY STREAMERS · ANASAYFA</span><h2>${esc(data[0])}</h2><p>${esc(data[1])}</p></section>`; $('button', layer).onclick = closeCardInfo; layer.onclick = event => { if (event.target === layer) closeCardInfo(); }; }
  function pageIndex(key) { return ['home', 'about', 'products', 'how'].indexOf(key); }
  function renderPageView(page, key, direction) { const labels = { about: 'Hakkımızda', products: 'Ürünlerimiz', how: 'Nasıl çalışır?' }; const view = document.createElement('section'); view.className = `ps18-page-view ${direction === 'left' ? 'ps18-enter-left' : 'ps18-enter-right'}`; view.innerHTML = `<header><button class="ps18-page-brand" type="button" aria-label="Ana sayfaya dön"><span class="brand-logo">PS</span><span>PLAY STREAMERS</span></button><nav class="ps18-page-nav"><button data-page="about" class="${key === 'about' ? 'active' : ''}">Hakkımızda</button><button data-page="products" class="${key === 'products' ? 'active' : ''}">Ürünlerimiz</button><button data-page="how" class="${key === 'how' ? 'active' : ''}">Nasıl çalışır?</button></nav></header><h1 class="ps18-page-title">${esc(labels[key])}</h1>`; $('.ps18-page-brand', view).onclick = () => navigatePage('home'); $$('.ps18-page-nav button', view).forEach(button => button.onclick = () => navigatePage(button.dataset.page)); page.append(view); }
  function navigatePage(target) { const page = $('#ps18InfoPage'); const from = currentPage; const direction = pageIndex(target) > pageIndex(from) ? 'right' : 'left'; if (target === 'home') { if (!page || page.hidden) return; const view = $('.ps18-page-view', page); if (view) { view.classList.add('ps18-out-right'); setTimeout(() => { page.hidden = true; view.remove(); }, 250); } else page.hidden = true; currentPage = 'home'; return; } if (!page) { const created = document.createElement('section'); created.id = 'ps18InfoPage'; created.className = 'ps18-info-page'; document.body.append(created); currentPage = 'home'; return navigatePage(target); } if (page.hidden) { page.hidden = false; page.innerHTML = ''; renderPageView(page, target, 'right'); currentPage = target; return; } const old = $('.ps18-page-view', page); if (old) { old.classList.add(direction === 'right' ? 'ps18-out-left' : 'ps18-out-right'); setTimeout(() => old.remove(), 250); } renderPageView(page, target, direction); currentPage = target; }
  function bindPageNavigation() { const overlay = $('#authOverlay'); if (!overlay) return; $$('.ps14-nav-links button', overlay).forEach(button => button.onclick = () => navigatePage(button.dataset.info)); $$('#ps12Discover button', overlay).forEach(button => button.onclick = () => showDetailedCard(button.dataset.info)); }
  function refresh() { installStatus(); enhanceCardInfo(); fixKickMark(); removeExtraCalendar(); renameFooter(); bindPageNavigation(); }
  let queued = false; /* Performans: sürekli DOM izleme kapatıldı. */
  refresh();
})();

(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const order = ['home', 'about', 'products', 'how'];
  let active = 'home';
  let transitionBusy = false;
  let pendingPage = null;
  const pages = {
    about: { kicker: 'SW CREATE · HAKKIMIZDA', title: 'SW CREATE; fikirleri yaşayan dijital ürünlere dönüştürür.', text: 'SW CREATE; yayıncılar ve topluluklar için sade yazılımlar, hızlı web siteleri ve güçlü dijital kimlikler üreten bağımsız bir yazılım ve site tasarım kuruluşudur. Küçük fikirleri, kullanılabilir ve güven veren ürünlere dönüştürmeyi seviyoruz.', caption: 'SW CREATE · Dijital ürün atölyesi', cards: [['Neden bu site?', 'Yayın sırasında dağınık kalan bilgileri ve bağlantıları tek, sakin bir deneyimde toplamak istedik. Play Streamers bu amaçla doğdu.'], ['Nasıl çalışıyoruz?', 'Önce gerçek kullanıcı akışını dinliyor, sonra tasarım ve yazılımı aynı masada sadeleştiriyoruz.'], ['Birlikte üretelim', 'SW CREATE hakkında daha fazlası için <a href="https://guns.lol/switly" target="_blank" rel="noopener">guns.lol/switly</a> adresini ziyaret edebilirsin.'], ['Amacımız', 'Her yayının arkasındaki emeği daha görünür, teknik tarafını ise daha kolay yönetilir hale getirmek.']] },
    products: { kicker: 'SW CREATE · ÜRÜNLERİMİZ', title: 'Tek amaç: daha rahat üretmek ve yayın yapmak.', text: 'Play Streamers, SW CREATE ürün ailesinin yayıncılara ayrılmış ilk merkezi. Büyüyen araçlarımız; profil, yayın kontrolü, topluluk ritmi ve tasarım ihtiyaçlarını aynı kalite anlayışıyla ele alır.', caption: 'SW CREATE · Ürün ailesi', cards: [['Play Streamers', 'Kişisel yayın akışını, hesap durumunu ve gelişen istatistikleri tek merkezde buluşturur.'], ['Tasarım hizmetleri', 'Yayıncı ve topluluklar için sade arayüz, marka kimliği ve web deneyimi üzerinde çalışıyoruz.'], ['Yakında', 'Yeni araçlar eklendikçe burada ürün kartları, kısa açıklamalar ve bağlantılar yer alacak.']] },
    how: { kicker: 'SW CREATE · NASIL ÇALIŞIR?', title: 'Bağlantılar izinle gelir, veriler anlamlı bir akışa dönüşür.', text: 'Hesabınla giriş yaptığında kişisel oturumun açılır. Bağladığın servislerin izin verdiği bilgiler HTTPS üzerinden API katmanına ulaşır; ardından yalnızca senin hesabınla ilişkili olaylar ve özetler panelde gösterilir.', caption: 'SW CREATE · Güvenli akış', cards: [['1 · İzin ve bağlantı', 'Bir servis bağlandığında yalnızca gerekli izinler kullanılır. Bağlantıların kişisel hesabınla eşleştirilir.'], ['2 · Doğrulama', 'API katmanı gelen isteği ve oturumu doğrular; böylece başka yayıncıların hareketleri kendi alanına karışmaz.'], ['3 · Anlamlandırma', 'Uygun veriler olay, zaman bilgisi ve istatistik görünümüne dönüşür; panelde okunması kolay hale gelir.'], ['4 · Kontrol sende', 'Bağlantı durumunu görür, hesabını yönetir ve ihtiyaç duyduğunda yayın paneline geçersin.']] }
  };
  function normalizeKick() { const button = $('#ps15KickAuth'); if (!button) return; button.innerHTML = '<span class="ps23-kick-mark" aria-hidden="true">K</span>'; button.title = 'Kick ile devam et'; button.setAttribute('aria-label', 'Kick ile devam et'); }
  function markReady() { const button = $('#ps17SystemStatus'); if (!button) return; button.className = 'ps17-system-status green'; button.dataset.ps18Level = 'green'; button.dataset.ps18Items = JSON.stringify(['Teknik sorun yok.']); normalizeKick(); }
  function updateNotes() { const list = $('#ps17ReleaseNote ul'); if (!list || list.dataset.ps23Notes === '1') return; ['Bilgi sayfaları tek aktif katman kuralına geçirildi: aynı sekmeye tekrar basmak yeni sayfa açmaz, sayfa değiştiğinde önceki görünüm tamamen kaldırılır.', 'Ünlem durum kutusunun hidden davranışı düzeltildi; kutu çarpıdan veya dışına tıklanınca kapanır.', 'SW CREATE için siyah zeminli neon monogram logo eklendi; Hakkımızda, Ürünlerimiz ve Nasıl çalışır alanları bu logoyla ve genişletilmiş içerikle yenilendi.'].forEach(text => { const item = document.createElement('li'); item.textContent = text; list.append(item); }); list.dataset.ps23Notes = '1'; }
  function closeIssues() { const panel = $('#ps23Issues'); if (!panel || panel.hidden || panel.dataset.closing === '1') return; panel.dataset.closing = '1'; panel.classList.add('ps23-issues-closing'); window.setTimeout(() => { panel.hidden = true; panel.classList.remove('ps23-issues-closing'); delete panel.dataset.closing; }, 190); }
  function openIssues(button) { let panel = $('#ps23Issues'); if (!panel) { panel = document.createElement('aside'); panel.id = 'ps23Issues'; panel.className = 'ps23-issues'; document.body.append(panel); } const rect = button.getBoundingClientRect(); const message = button.dataset.ps11StatusMessage || 'Teknik sorun yok.'; panel.hidden = false; panel.classList.remove('ps23-issues-closing'); panel.style.left = `${Math.max(12, Math.min(window.innerWidth - 324, rect.right - 300))}px`; panel.style.top = `${rect.bottom + 8}px`; panel.innerHTML = `<button class="ps23-close" type="button" aria-label="Kapat">×</button><h3><b>!</b> Sistem durumu</h3><p>${message}</p>`; $('.ps23-close', panel).onclick = closeIssues; }
  function clearLegacyPages() { ['#ps17InfoPage', '#ps18InfoPage', '#ps19InfoPage', '#ps20InfoPage', '#ps21InfoPage', '#ps22InfoPage'].forEach(selector => { const old = $(selector); if (old) { old.hidden = true; old.innerHTML = ''; old.style.display = 'none'; } }); }
  function afterMotion(node, done) { let finished = false; const finish = event => { if (event && event.target !== node) return; if (finished) return; finished = true; node.removeEventListener('animationend', finish); done(); }; node.addEventListener('animationend', finish); window.setTimeout(finish, 230); }
  function finishTransition() { transitionBusy = false; const next = pendingPage; pendingPage = null; if (next === 'home') { closePage(); return; } if (next && next !== active) openPage(next); }
  function closePage() { const page = $('#ps23InfoPage'); if (!page || page.hidden) { active = 'home'; return; } if (transitionBusy) { pendingPage = 'home'; return; } const view = $('.ps23-view', page); if (!view) { page.hidden = true; page.innerHTML = ''; active = 'home'; return; } transitionBusy = true; pendingPage = null; view.classList.remove('ps23-enter-from-right', 'ps23-enter-from-left', 'ps23-exit-to-right', 'ps23-exit-to-left'); view.classList.add('ps23-exit-to-right'); afterMotion(view, () => { page.hidden = true; page.innerHTML = ''; active = 'home'; finishTransition(); }); }
  function openAuth(mode) { closePage(); window.setTimeout(() => (mode === 'login' ? $('#landingLogin') : $('#landingSignup'))?.click(), 430); }
  function cloneFrame(source, className) { const clone = source.cloneNode(true); clone.classList.add('ps23-frame', className); clone.querySelectorAll('[id]').forEach(node => { if (!['landingLogin', 'landingSignup', 'ps17SystemStatus'].includes(node.id)) node.removeAttribute('id'); }); const rect = source.getBoundingClientRect(); clone.style.cssText = `position:absolute!important;left:${rect.left}px!important;top:${rect.top}px!important;width:${rect.width}px!important;height:${rect.height}px!important;margin:0!important`; return { clone, rect }; }
  function makeContent(key) { const data = pages[key]; const productExtra = key === 'products' ? '<div class="ps23-notice">ABONELİKLER KAPALI<small>Abonelik sistemi henüz hazırlanıyor. Açıldığında bu alan durum ve plan bilgilerini gösterecek.</small></div><div class="ps23-empty">SİTELERİMİZ · YAKINDA BURADA</div>' : ''; const cards = data.cards.map(card => `<section class="ps23-card"><h2>${card[0]}</h2><p>${card[1]}</p></section>`).join(''); return `<article class="ps23-content solo"><div class="ps23-copy"><p class="ps23-kicker">${data.kicker}</p><h1>${data.title}</h1><p>${data.text}</p><div class="ps23-grid">${productExtra || cards}</div></div></article>`; }
  function buildView(host, key) { const overlay = $('#authOverlay'); const navSource = $('.landing-nav', overlay); const releaseSource = $('#psPublicRelease'); const footerSource = $('.landing-footer', overlay); if (!navSource || !releaseSource || !footerSource) return null; const view = document.createElement('section'); view.className = 'ps23-view'; const nav = cloneFrame(navSource, 'ps23-nav'); const release = cloneFrame(releaseSource, 'ps23-release'); const footer = cloneFrame(footerSource, 'ps23-footer'); const edge = Math.max(18, nav.rect.left); const contentTop = Math.max(nav.rect.bottom + 62, release.rect.bottom + 28); footer.clone.style.cssText = `position:absolute!important;left:${edge}px!important;right:${edge}px!important;bottom:20px!important;top:auto!important;width:auto!important;height:auto!important;margin:0!important`; const brand = $('.landing-brand', nav.clone); if (brand) brand.classList.add('ps23-home'); const status = $('.ps17-system-status', nav.clone); if (status) { status.removeAttribute('id'); status.className = 'ps17-system-status green ps23-status'; } const login = $('[id="landingLogin"]', nav.clone); if (login) { login.removeAttribute('id'); login.dataset.ps23Auth = 'login'; } const signup = $('[id="landingSignup"]', nav.clone); if (signup) { signup.removeAttribute('id'); signup.dataset.ps23Auth = 'register'; } $$('.ps14-nav-links button', nav.clone).forEach(button => { button.dataset.ps23Page = button.dataset.info; button.classList.toggle('active', button.dataset.ps23Page === key); }); const holder = document.createElement('div'); holder.innerHTML = makeContent(key); const content = holder.firstElementChild; content.style.left = `${edge}px`; content.style.right = `${edge}px`; content.style.top = `${contentTop}px`; content.style.bottom = '76px'; view.append(nav.clone, release.clone, content, footer.clone); host.append(view); return view; }
  function openPage(key) { if (!pages[key]) return; const existing = $('#ps23InfoPage'); if (transitionBusy) { pendingPage = key; return; } if (active === key && existing && !existing.hidden) return; clearLegacyPages(); let page = existing; if (!page) { page = document.createElement('section'); page.id = 'ps23InfoPage'; page.className = 'ps23-info-page'; document.body.append(page); } page.hidden = false; page.style.display = ''; const direction = order.indexOf(key) > order.indexOf(active) ? 'right' : 'left'; const exitClass = direction === 'right' ? 'ps23-exit-to-left' : 'ps23-exit-to-right'; const enterClass = direction === 'right' ? 'ps23-enter-from-right' : 'ps23-enter-from-left'; const previous = $('.ps23-view', page); transitionBusy = true; pendingPage = null; const showNext = () => { page.innerHTML = ''; const next = buildView(page, key); if (!next) { transitionBusy = false; return; } next.classList.add(enterClass); active = key; afterMotion(next, () => { next.classList.remove(enterClass); finishTransition(); }); }; if (!previous) { showNext(); return; } previous.classList.remove('ps23-enter-from-right', 'ps23-enter-from-left', 'ps23-exit-to-right', 'ps23-exit-to-left'); previous.classList.add(exitClass); afterMotion(previous, () => { previous.remove(); showNext(); }); }
  window.addEventListener('click', event => { const target = event.target instanceof Element ? event.target : null; if (!target) return; const issuePanel = $('#ps23Issues'); const close = target.closest('#ps23Issues .ps23-close'); const issue = target.closest('#authOverlay .landing-actions .ps17-system-status, #ps23InfoPage .ps23-status'); if (close || target === issuePanel) { event.preventDefault(); event.stopImmediatePropagation(); closeIssues(); return; } if (issuePanel && !issuePanel.hidden && !issuePanel.contains(target) && !issue) closeIssues(); if (issue) { event.preventDefault(); event.stopImmediatePropagation(); openIssues(issue); return; } const auth = target.closest('#ps23InfoPage [data-ps23-auth]'); if (auth) { event.preventDefault(); event.stopImmediatePropagation(); openAuth(auth.dataset.ps23Auth); return; } const home = target.closest('#ps23InfoPage .ps23-home'); if (home) { event.preventDefault(); event.stopImmediatePropagation(); closePage(); return; } const nav = target.closest('#authOverlay .ps14-nav-links button, #ps23InfoPage .ps14-nav-links button'); if (nav) { const key = nav.dataset.ps23Page || nav.dataset.info; if (pages[key]) { event.preventDefault(); event.stopImmediatePropagation(); openPage(key); } } }, true);
  markReady(); updateNotes(); /* Performans: sürekli DOM izleme kapatıldı. */
})();

(() => {
  'use strict';
  const API = 'https://api.pstreamers.com';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const googleMark = '<span class="ps11-google-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.23-.2-1.76H12v3.35h5.37a4.55 4.55 0 0 1-1.98 2.98l2.88 2.24c1.69-1.56 2.66-3.86 2.66-6.81Z"/><path fill="#34A853" d="M12 21.7c2.62 0 4.82-.87 6.43-2.36l-2.88-2.24c-.8.54-1.83.86-3.55.86-2.52 0-4.66-1.7-5.43-4.01l-2.98 2.3A9.71 9.71 0 0 0 12 21.7Z"/><path fill="#FBBC05" d="M6.57 13.95A5.84 5.84 0 0 1 6.27 12c0-.68.12-1.34.3-1.95l-2.98-2.3A9.69 9.69 0 0 0 2.3 12c0 1.56.37 3.04 1.29 4.25l2.98-2.3Z"/><path fill="#EA4335" d="M12 6.04c1.86 0 3.14.8 3.86 1.48l2.9-2.83C16.8 2.86 14.62 1.7 12 1.7a9.71 9.71 0 0 0-8.41 6.05l2.98 2.3C7.34 7.74 9.48 6.04 12 6.04Z"/></svg></span>';

  function closeAuthModal(layer) {
    if (!layer || layer.dataset.ps11Closing === '1') return;
    layer.dataset.ps11Closing = '1';
    layer.classList.add('ps11-auth-closing');
    window.setTimeout(() => layer.remove(), 220);
  }

  function decorateAuthModal() {
    const layer = $('#landingAuthModal');
    const form = $('#standaloneAuthForm, #landingAuthForm', layer || document);
    const google = $('#modalGoogle', form || document);
    if (!layer || !form || !google) return;

    google.classList.add('ps11-google-auth');
    if (google.dataset.ps11Decorated !== '1') {
      google.dataset.ps11Decorated = '1';
      google.innerHTML = `${googleMark}<span>Google ile devam et</span>`;
    }

    let row = $('.ps11-provider-row,.ps55-provider-pair', form);
    if (!row) {
      row = document.createElement('div');
      row.className = 'ps11-provider-row';
      google.parentNode.insertBefore(row, google);
      row.append(google);
    }


    const close = $('.auth-close', layer);
    if (close) close.onclick = () => closeAuthModal(layer);
    layer.onclick = event => { if (event.target === layer) closeAuthModal(layer); };
  }

  function applyFooterBranding() {
    $$('.landing-footer').forEach(footer => {
      const label = footer.querySelector('strong, a[href="https://guns.lol/switly"]');
      if (!label) return;
      label.textContent = 'SW CREATE';
      label.style.color = 'var(--lime)';
    });
  }

  function setSystemStatus(level, message) {
    $$('#ps17SystemStatus').forEach(button => {
      button.className = `ps17-system-status ${level}`;
      button.textContent = '!';
      button.dataset.ps11StatusMessage = message;
      button.dataset.ps18Level = level;
      button.dataset.ps18Items = JSON.stringify([message]);
      button.title = 'Sistem durumu';
    });
  }

  function scanInterface() {
    const checks = [
      ['#authOverlay', 'Ana sayfa'],
      ['#landingLogin', 'Giriş düğmesi'],
      ['#landingSignup', 'Kayıt düğmesi'],
      ['.landing-brand', 'Play Streamers logosu'],
      ['.ps14-nav-links', 'Bilgi sekmeleri']
    ];
    const missing = checks.filter(([selector]) => !$(selector)).map(([, name]) => name);
    const extraPages = ['#ps19InfoPage', '#ps20InfoPage', '#ps21InfoPage', '#ps22InfoPage'].filter(selector => {
      const page = $(selector); return page && !page.hidden && page.style.display !== 'none';
    });
    if (missing.length || extraPages.length) {
      setSystemStatus('red', `Kontrol gerekli: ${missing.length ? `${missing.join(', ')} yüklenemedi.` : 'Eski bir sayfa katmanı açık görünüyor.'}`);
      return;
    }
    if (location.protocol === 'file:') {
      setSystemStatus('yellow', 'Yerel önizleme açık. Tasarımı inceleyebilirsin; Google ve Kick ile giriş yalnızca yayınlanmış sitede çalışır.');
      return;
    }
    setSystemStatus('yellow', 'Sistem bağlantısı kontrol ediliyor.');
    fetch(`${API}/health`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => {
        if (!data?.ok) throw new Error('health');
        setSystemStatus('green', 'Teknik sorun yok. Ana sayfa, giriş/kayıt akışı ve sunucu bağlantısı kullanılabilir görünüyor.');
      })
      .catch(() => setSystemStatus('orange', 'Sunucu bağlantısı şu an doğrulanamadı. Tasarımı kullanabilirsin; giriş veya kayıt işlemini tekrar denemeden önce Worker bağlantısını kontrol et.'));
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const layer = target.closest('#landingAuthModal');
    if (layer && (target === layer || target.closest('.auth-close'))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeAuthModal(layer);
      return;
    }
    if (target.closest('#landingLogin, #landingSignup')) window.setTimeout(decorateAuthModal, 0);
    if (target.closest('.ps14-nav-links button, .ps23-home')) window.setTimeout(applyFooterBranding, 280);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeAuthModal($('#landingAuthModal'));
  }, true);

  applyFooterBranding();
  scanInterface();
})();

(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const wifi = '<svg class="ps13-wifi" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9.5a13 13 0 0 1 17 0"/><path d="M6.7 13a8.4 8.4 0 0 1 10.6 0"/><path d="M10 16.5a3.4 3.4 0 0 1 4 0"/><path d="M12 20h.01"/></svg>';
  const icons = { onemonth: '<svg viewBox="0 0 24 24"><path d="M12 3v18M7.8 7.2 12 3l4.2 4.2M7.8 16.8 12 21l4.2-4.2"/><path d="M5 9.5h14M5 14.5h14"/></svg>', multimonth: '<svg viewBox="0 0 24 24"><path d="M6 5.5h12v13H6z"/><path d="M8.5 3v5M15.5 3v5M8.5 12h7M8.5 15.5h4"/></svg>', kicks: '<svg viewBox="0 0 24 24"><path d="M13.5 2.8 5.8 13h5l-.3 8.2L18.2 11h-5z"/></svg>', gifts: '<svg viewBox="0 0 24 24"><path d="M4 10h16v10H4zM3 6h18v4H3zM12 6v14"/><path d="M12 6c-4.5 0-5.5-4-3-4 1.8 0 3 2 3 4Zm0 0c4.5 0 5.5-4 3-4-1.8 0-3 2-3 4Z"/></svg>', donations: '<svg viewBox="0 0 24 24"><path d="M12 3v18M16 7.5c-.7-1-2.1-1.7-4-1.7-2.4 0-4 1.2-4 3s1.5 2.7 4.1 3.3c2.6.6 3.9 1.5 3.9 3.3s-1.6 3-4 3c-2 0-3.5-.7-4.3-1.8"/></svg>' };
  let switching = false;
  let closeTimer = 0;
  function iconifyCards() { $$('.card[data-card]').forEach(card => { const logo = $('.logo', card); const svg = icons[card.dataset.card]; if (logo && svg && logo.dataset.ps13Icon !== '1') { logo.dataset.ps13Icon = '1'; logo.classList.add('ps13-event-icon'); logo.innerHTML = svg; } }); }
  function ensureRelease() { /* Dashboard duyuru şeridi kaldırıldı. */ }
  function decorateFooter() { const foot = $('.app > .foot'); if (!foot) return; foot.className = 'foot ps13-footer'; foot.innerHTML = '<span>Güvenli bağlantılar · Kişisel panel · Ücretsiz başlangıç</span><span>Developed by <a href="https://guns.lol/switly" target="_blank" rel="noopener">SW CREATE</a></span>'; }
  function positionUnder(button, panel, width) { const rect = button.getBoundingClientRect(); panel.style.top = `${Math.min(window.innerHeight - 260, Math.round(rect.bottom + 9))}px`; panel.style.right = `${Math.max(12, Math.round(window.innerWidth - rect.right))}px`; panel.style.left = 'auto'; if (width) panel.style.width = `${width}px`; }
  function closeAnimated(panel) { if (!panel || panel.hidden || panel.classList.contains('ps13-closing')) return; panel.classList.remove('ps13-opening'); panel.classList.add('ps13-closing'); panel.hidden = true; window.clearTimeout(closeTimer); closeTimer = window.setTimeout(() => panel.classList.remove('ps13-closing'), 190); }
  function decorateConnections() { const button = $('#connectionBtn'); const panel = $('#connections'); if (!button || !panel) return; button.classList.add('ps13-connection-button'); button.innerHTML = wifi; button.title = 'Bağlantı durumu'; panel.classList.add('ps13-connection-surface'); $$('.con-row', panel).forEach((row, index) => { const icon = $('.con-icon', row); if (!icon) return; icon.className = `ps13-platform-icon ${index === 0 ? 'kick' : 'bynogame'}`; icon.textContent = index === 0 ? 'K' : 'B'; }); button.onclick = event => { event.preventDefault(); event.stopPropagation(); if (!panel.hidden) { closeAnimated(panel); return; } positionUnder(button, panel, 286); panel.hidden = false; panel.classList.remove('ps13-closing'); panel.classList.add('ps13-opening'); window.setTimeout(() => panel.classList.remove('ps13-opening'), 210); $$('.con-row', panel).forEach((row, index) => { const icon = $('.con-icon', row); if (icon) { icon.className = `ps13-platform-icon ${index === 0 ? 'kick' : 'bynogame'}`; icon.textContent = index === 0 ? 'K' : 'B'; } }); }; }
  function toggleMenu(button) { const menu = $('#sideMenu'); if (!menu) return; menu.classList.add('ps13-menu-surface'); if (!menu.hidden) { closeAnimated(menu); return; } positionUnder(button, menu, 250); menu.hidden = false; menu.classList.remove('ps13-closing'); menu.classList.add('ps13-opening'); window.setTimeout(() => menu.classList.remove('ps13-opening'), 210); }
  function setupMenu() { const button = $('#menuBtn'); if (!button) return; button.classList.add('ps13-dashboard-menu'); }
  function setupViewTransitions() { const tabs = $('.workspace-tabs'); const panel = $('#panelView'); const stats = $('#statsView'); if (!tabs || !panel || !stats) return; let stage = $('#ps13ViewStage'); if (!stage) { stage = document.createElement('section'); stage.id = 'ps13ViewStage'; tabs.after(stage); stage.append(panel, stats); } $$('.workspace-tabs button', tabs).forEach(button => { button.onclick = () => switchView(button.dataset.view); }); }
  function switchView(name) { if (switching) return; const stage = $('#ps13ViewStage'); const panel = $('#panelView'); const stats = $('#statsView'); const target = name === 'stats' ? stats : panel; const source = target === panel ? stats : panel; if (!target || !source || !stage || !target.hidden) return; switching = true; const direction = name === 'stats' ? 'right' : 'left'; target.hidden = false; const height = Math.max(source.getBoundingClientRect().height, target.getBoundingClientRect().height); stage.style.minHeight = `${height}px`; source.classList.add('ps13-view-layer', direction === 'right' ? 'ps13-leave-left' : 'ps13-leave-right'); target.classList.add('ps13-view-layer', direction === 'right' ? 'ps13-enter-right' : 'ps13-enter-left'); $$('.workspace-tabs button').forEach(button => button.classList.toggle('active', button.dataset.view === name)); window.setTimeout(() => { source.hidden = true; source.classList.remove('ps13-view-layer', 'ps13-leave-left', 'ps13-leave-right'); target.classList.remove('ps13-view-layer', 'ps13-enter-right', 'ps13-enter-left'); stage.style.minHeight = ''; switching = false; }, 380); }
  function memberConnection() { const home = $('#psSecondHome'); if (!home || home.hidden) return; const actions = $('.ps-second-nav-actions', home); if (!actions || $('#ps13MemberConnection', home)) return; const button = document.createElement('button'); button.id = 'ps13MemberConnection'; button.className = 'ps13-member-connection'; button.type = 'button'; button.title = 'Bağlantı durumu'; button.setAttribute('aria-label', 'Bağlantı durumu'); button.innerHTML = wifi; actions.prepend(button); button.onclick = event => { event.preventDefault(); event.stopPropagation(); let panel = $('#ps13MemberConnections'); if (!panel) { panel = document.createElement('aside'); panel.id = 'ps13MemberConnections'; panel.className = 'ps13-member-connections'; document.body.append(panel); } if (!panel.hidden) { closeAnimated(panel); return; } panel.innerHTML = '<div class="con-row"><span class="ps13-platform-icon kick">K</span><p><b>Kick</b><small>Bağlantı durumunu Dashboard üzerinden kontrol et.</small></p></div><div class="con-row"><span class="ps13-platform-icon bynogame">B</span><p><b>ByNoGame</b><small>Bağlantı bekleniyor.</small></p></div>'; positionUnder(button, panel, 286); panel.hidden = false; panel.classList.remove('ps13-closing'); panel.classList.add('ps13-opening'); window.setTimeout(() => panel.classList.remove('ps13-opening'), 210); }; }
  function enhance() { const app = $('.app'); if (!app) return; app.classList.add('ps13-dashboard'); ensureRelease(); iconifyCards(); decorateConnections(); setupMenu(); setupViewTransitions(); decorateFooter(); memberConnection(); }
  function watchDashboard() { [$('#panelGrid'), $('#connectionList')].filter(Boolean).forEach(node => new MutationObserver(() => { iconifyCards(); decorateConnections(); }).observe(node, { childList: true })); }
  function watchUserHome() { const attach = home => { if (!home || home.dataset.ps13ConnectionWatch === '1') return; home.dataset.ps13ConnectionWatch = '1'; new MutationObserver(() => memberConnection()).observe(home, { childList: true, subtree: true }); }; const home = $('#psSecondHome'); if (home) { attach(home); return; } new MutationObserver(() => { const next = $('#psSecondHome'); if (next) attach(next); }).observe(document.body, { childList: true }); }
  window.addEventListener('click', event => { const target = event.target instanceof Element ? event.target : null; if (!target) return; const menuButton = target.closest('#menuBtn'); if (menuButton) { event.preventDefault(); event.stopPropagation(); toggleMenu(menuButton); return; } const connections = $('#connections'); if (connections && !connections.hidden && !connections.contains(target) && !target.closest('#connectionBtn')) { connections.classList.add('ps13-closing'); window.setTimeout(() => connections.classList.remove('ps13-closing'), 190); } const menu = $('#sideMenu'); if (menu && !menu.hidden && !menu.contains(target) && !target.closest('#menuBtn')) { menu.classList.add('ps13-closing'); window.setTimeout(() => menu.classList.remove('ps13-closing'), 190); } if (target.closest('#ps12HomeBrand')) window.setTimeout(enhance, 0); }, true);
  window.addEventListener('resize', () => { const panel = $('#connections'); if (panel && !panel.hidden) closeAnimated(panel); const menu = $('#sideMenu'); if (menu && !menu.hidden) closeAnimated(menu); });
  window.setTimeout(() => { enhance(); watchDashboard(); watchUserHome(); }, 0);
})();

(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const labels = { onemonth: '1 Aylık Abone', multimonth: '2+ Aylık Abone', kicks: 'Kicks', gifts: 'Hediye Abonelik', donations: 'Donate' };
  const logos = { kick: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Kick.com_icon_logo.svg', bynogame: 'https://cdn.bynogame.com/logo/beyaz-kirmizi-png-1699381647670.png' };
  function renameCards() { $$('.card[data-card]').forEach(card => { const heading = $('.title h2', card); if (heading && labels[card.dataset.card]) heading.textContent = labels[card.dataset.card]; }); }
  function applyLogo(icon, type) { if (!icon) return; icon.className = `ps13-platform-icon ps13-image-logo ${type}`; icon.innerHTML = `<img src="${logos[type]}" alt="${type === 'kick' ? 'Kick' : 'ByNoGame'} logosu">`; }
  function installConnectionLogos(root = document) { $$('.con-row', root).forEach(row => { const text = $('strong, b', row)?.textContent?.trim().toLowerCase() || ''; const icon = $('.con-icon, .ps13-platform-icon', row); if (text === 'kick') applyLogo(icon, 'kick'); if (text === 'bynogame') applyLogo(icon, 'bynogame'); }); }
  function positionMenuRight(button, menu) { const rect = button.getBoundingClientRect(); const width = 250; menu.style.top = `${Math.min(window.innerHeight - 280, Math.round(rect.bottom + 9))}px`; menu.style.left = `${Math.max(12, Math.min(Math.round(rect.left), window.innerWidth - width - 12))}px`; menu.style.right = 'auto'; menu.style.width = `${width}px`; }
  function toggleStats(card, button) { const open = !card.classList.contains('ps13-stat-expanded'); $$('.card.ps13-stat-expanded').forEach(item => { item.classList.remove('ps13-stat-expanded'); $('.ps13-stats-expand', item)?.setAttribute('aria-label', 'Kartı büyüt'); }); if (open) { card.classList.add('ps13-stat-expanded'); button.setAttribute('aria-label', 'Kartı kapat'); } }
  function installStatExpanders() { $$('#statsGrid .card').forEach(card => { const head = $('.card-head', card); if (!head || $('.ps13-stats-expand', head)) return; const button = document.createElement('button'); button.type = 'button'; button.className = 'ps13-stats-expand'; button.title = 'Kartı büyüt'; button.setAttribute('aria-label', 'Kartı büyüt'); button.textContent = '⤢'; button.onclick = event => { event.preventDefault(); event.stopPropagation(); toggleStats(card, button); }; head.append(button); }); }
  function positionLiveStatus() { const topbar = $('.topbar'); const status = $('#streamStatus'); if (topbar && status && status.previousElementSibling !== topbar) topbar.after(status); }
  function refresh() { if(document.documentElement.dataset.ps53DashboardOwner==='1')return; $('#ps13DashboardRelease')?.remove(); positionLiveStatus(); renameCards(); installConnectionLogos(); installStatExpanders(); }
  function watch(selector) { /* Eski gözlemci her yenilemede kart metnini tekrar yazıp döngü oluşturuyordu. */ }
  window.addEventListener('click', event => { const target = event.target instanceof Element ? event.target : null; if (!target) return; const menuButton = target.closest('#menuBtn'); const menu = $('#sideMenu'); if (menuButton && menu) { window.setTimeout(() => positionMenuRight(menuButton, menu), 0); } if (!target.closest('#statsGrid .card')) { $$('.card.ps13-stat-expanded').forEach(card => card.classList.remove('ps13-stat-expanded')); } }, true);
  window.addEventListener('keydown', event => { if (event.key === 'Escape') $$('.card.ps13-stat-expanded').forEach(card => card.classList.remove('ps13-stat-expanded')); });
  window.setTimeout(() => { refresh(); ['#panelGrid', '#statsGrid', '#connectionList'].forEach(watch); }, 20);
})();

(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const subscriptionIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4.5 21c.9-4 3.4-6 7.5-6s6.6 2 7.5 6"/><path d="m17.2 7.1 1.1 1.1 2.2-2.3"/></svg>';
  const kickIcon = '<img src="https://upload.wikimedia.org/wikipedia/commons/6/69/Kick.com_icon_logo.svg" alt="KICKS" referrerpolicy="no-referrer">';
  function refreshPanelIcons() { const one = $('#panelGrid .card[data-card="onemonth"] .logo'); const multi = $('#panelGrid .card[data-card="multimonth"] .logo'); const kicks = $('#panelGrid .card[data-card="kicks"] .logo'); if (one) { one.classList.add('ps13-event-icon'); if (one.innerHTML !== subscriptionIcon) one.innerHTML = subscriptionIcon; } if (multi) { multi.classList.add('ps13-event-icon'); if (multi.innerHTML !== subscriptionIcon) multi.innerHTML = subscriptionIcon; } if (kicks) { kicks.classList.add('ps13-event-icon','ps13-kicks-logo'); if (kicks.innerHTML !== kickIcon) kicks.innerHTML = kickIcon; } }
  function closeCopy() { const layer = $('#ps13CardCopy'); if (!layer || layer.classList.contains('ps13-copy-closing')) return; layer.classList.add('ps13-copy-closing'); window.setTimeout(() => layer.remove(), 185); }
  function openCopy(card) { if (!card) return; $('#ps13CardCopy')?.remove(); const layer = document.createElement('section'); layer.id = 'ps13CardCopy'; layer.setAttribute('aria-label','Büyütülmüş panel kartı'); const copy = card.cloneNode(true); copy.classList.remove('expanded','ps13-stat-expanded'); copy.classList.add('ps13-card-copy'); copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id')); const closeButton = $('.expand, .ps13-stats-expand', copy); if (closeButton) { closeButton.onclick = event => { event.preventDefault(); event.stopPropagation(); closeCopy(); }; closeButton.title = 'Kartı kapat'; closeButton.setAttribute('aria-label','Kartı kapat'); } layer.append(copy); layer.onclick = event => { if (event.target === layer) closeCopy(); }; document.body.append(layer); }
  function wireCopyExpanders() { $$('#panelGrid .expand').forEach(button => { button.dataset.ps13Copy = '1'; button.onclick = event => { event.preventDefault(); event.stopPropagation(); openCopy(button.closest('.card')); }; }); $$('#statsGrid .ps13-stats-expand').forEach(button => { button.dataset.ps13Copy = '1'; button.onclick = event => { event.preventDefault(); event.stopPropagation(); openCopy(button.closest('.card')); }; }); }
  function positionConnectionRight() { const button = $('#connectionBtn'); const panel = $('#connections'); if (!button || !panel) return; const rect = button.getBoundingClientRect(); const width = 286; panel.style.top = `${Math.min(window.innerHeight - 260, Math.round(rect.bottom + 9))}px`; panel.style.left = `${Math.max(12, Math.min(Math.round(rect.left), window.innerWidth - width - 12))}px`; panel.style.right = 'auto'; panel.style.width = `${width}px`; }
  function closeConnection() { const panel = $('#connections'); if (!panel || panel.hidden || panel.classList.contains('ps13-closing')) return; panel.classList.remove('ps13-opening'); panel.classList.add('ps13-closing'); panel.hidden = true; window.setTimeout(() => panel.classList.remove('ps13-closing'), 190); }
  function setupConnection() { const button = $('#connectionBtn'); const panel = $('#connections'); if (!button || !panel) return; button.onclick = event => { event.preventDefault(); event.stopPropagation(); if (!panel.hidden) { closeConnection(); return; } positionConnectionRight(); panel.hidden = false; panel.classList.remove('ps13-closing'); panel.classList.add('ps13-opening'); window.setTimeout(() => panel.classList.remove('ps13-opening'), 210); }; }
  function refresh() { if(document.documentElement.dataset.ps53DashboardOwner==='1')return; refreshPanelIcons(); wireCopyExpanders(); setupConnection(); }
  function watch(selector) { /* Sürekli ikon yeniden çizimi kartları ve performansı bozuyordu. */ }
  window.addEventListener('click', event => { const target = event.target instanceof Element ? event.target : null; if (!target) return; const button = target.closest('#connectionBtn'); if (button) { event.preventDefault(); event.stopPropagation(); const panel = $('#connections'); if (!panel) return; if (!panel.hidden) { closeConnection(); return; } positionConnectionRight(); panel.hidden = false; panel.classList.remove('ps13-closing'); panel.classList.add('ps13-opening'); window.setTimeout(() => panel.classList.remove('ps13-opening'), 210); return; } const panel = $('#connections'); if (panel && !panel.hidden && !panel.contains(target)) closeConnection(); }, true);
  window.addEventListener('keydown', event => { if (event.key === 'Escape') closeCopy(); });
  window.setTimeout(() => { refresh(); ['#panelGrid','#statsGrid','#connectionList'].forEach(watch); }, 35);
})();

(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const staleLayers = [
    '#ps17InfoPage', '#ps18InfoPage', '#ps19InfoPage', '#ps20InfoPage',
    '#ps21InfoPage', '#ps22InfoPage', '#ps17CardInfo', '#ps18StatusLayer',
    '#ps17StatusPanel', '#ps21Issues', '#ps23Issues', '#ps12ContextPopover'
  ];

  function closeStaleLayers() {
    staleLayers.forEach(selector => {
      const layer = $(selector);
      if (!layer) return;
      layer.hidden = true;
      layer.classList.remove('ps13-opening', 'ps13-closing', 'ps18-status-out', 'ps23-issues-closing', 'closing');
    });
  }

  function makePublicHomeTouchable() {
    const home = $('#authOverlay');
    if (!home || home.hidden) return;
    home.style.pointerEvents = 'auto';
    $$('.landing-actions button, .ps14-nav-links button, #ps12Discover button, .landing-brand', home)
      .forEach(control => {
        control.style.pointerEvents = 'auto';
        control.style.touchAction = 'manipulation';
      });
  }

  function recover() {
    closeStaleLayers();
    makePublicHomeTouchable();
  }

  /* Run after every earlier enhancement script has completed its startup work. */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', recover, { once:true });
  else recover();
  window.addEventListener('pageshow', recover);

  /* Fallback for the two essential first-home actions if an old layer reassigned them. */
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const home = $('#authOverlay');
    if (!home || home.hidden || !home.contains(target)) return;
    const login = target.closest('#landingLogin');
    const signup = target.closest('#landingSignup');
    if (login || signup) {
      window.setTimeout(() => {
        if (!$('#landingAuthModal')) {
          const action = login ? login.onclick : signup.onclick;
          if (typeof action === 'function') action.call(login || signup, new MouseEvent('click'));
        }
      }, 0);
    }
  }, false);
})();

(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const byNoGameLogo = 'https://cdn.bynogame.com/logo/beyaz-kirmizi-png-1699381647670.png';
  const kickMark = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#53fc18" d="M3 2h6v6h3V4h9v6h-4v4h4v6h-9v-5H9v7H3V2Zm6 8v5h3v-5H9Z"/></svg>';
  const cardIcons = {
    onemonth: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4.5 21c.9-4 3.4-6 7.5-6s6.6 2 7.5 6"/><path d="m17.2 7.1 1.1 1.1 2.2-2.3"/></svg>',
    multimonth: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"/><path d="M7.8 7.2 12 3l4.2 4.2M7.8 16.8 12 21l4.2-4.2"/><path d="M5 9.5h14M5 14.5h14"/></svg>',
    gifts: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v10H4zM3 6h18v4H3zM12 6v14"/><path d="M12 6c-4.5 0-5.5-4-3-4 1.8 0 3 2 3 4Zm0 0c4.5 0 5.5-4 3-4-1.8 0-3 2-3 4Z"/></svg>',
    kicks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.7 2.7 5.5 13h5.3l-.4 8.3L18.6 11h-5.3z"/><path d="M4 20.2h16"/></svg>',
    donations: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M16 7.5c-.7-1-2.1-1.7-4-1.7-2.4 0-4 1.2-4 3s1.5 2.7 4.1 3.3c2.6.6 3.9 1.5 3.9 3.3s-1.6 3-4 3c-2 0-3.5-.7-4.3-1.8"/></svg>'
  };
  const statCardType = heading => {
    const text = String(heading || '').toLocaleLowerCase('tr-TR');
    if (text.includes('hediye')) return 'gifts';
    if (text.includes('kick')) return 'kicks';
    if (text.includes('donate')) return 'donations';
    if (text.includes('top abone')) return 'multimonth';
    return 'onemonth';
  };

  let closeTimer = 0;
  let iconFrame = 0;
  function closeConnections() {
    const panel = $('#connections');
    if (!panel || panel.hidden || panel.dataset.ps13RefineClosing === '1') return;
    panel.dataset.ps13RefineClosing = '1';
    panel.classList.remove('ps13-opening');
    panel.classList.add('ps13-closing');
    panel.style.pointerEvents = 'none';
    panel.hidden = true;
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      panel.classList.remove('ps13-closing');
      panel.style.removeProperty('pointer-events');
      delete panel.dataset.ps13RefineClosing;
    }, 210);
  }

  function applyProviderIcons(root = document) {
    $$('.con-row', root).forEach(row => {
      const name = $('strong, b', row)?.textContent?.trim().toLocaleLowerCase('tr-TR');
      const icon = $('.con-icon, .ps13-platform-icon', row);
      if (!icon) return;
      if (name === 'kick') {
        icon.className = 'ps13-platform-icon ps13-provider-kick';
        if (icon.innerHTML !== kickMark) icon.innerHTML = kickMark;
      }
      if (name === 'bynogame') {
        icon.className = 'ps13-platform-icon ps13-provider-bynogame';
        const image = `<img src="${byNoGameLogo}" alt="ByNoGame logosu">`; if (icon.innerHTML !== image) icon.innerHTML = image;
      }
    });
  }

  function applyIcon(card, type) {
    const icon = $('.logo', card);
    if (!icon || !cardIcons[type]) return;
    icon.classList.add('ps13-event-icon', 'ps13-consistent-icon');
    icon.classList.toggle('ps13-kicks-icon', type === 'kicks');
    if (icon.innerHTML !== cardIcons[type]) icon.innerHTML = cardIcons[type];
  }

  function synchronizeCardIcons() {
    $$('#panelGrid .card[data-card]').forEach(card => {
      const type = card.dataset.card;
      const heading = $('.title h2', card); if (type === 'kicks' && heading && heading.textContent !== 'Kicks') heading.textContent = 'Kicks';
      applyIcon(card, type);
    });
    $$('#statsGrid .card').forEach(card => applyIcon(card, statCardType($('.title h2', card)?.textContent)));
    $$('#ps13CardCopy .card').forEach(card => {
      const type = card.dataset.card || statCardType($('.title h2', card)?.textContent);
      applyIcon(card, type);
    });
  }

  function removeDashboardRelease() {
    $('#ps13DashboardRelease')?.remove();
    $('#psDashboardRelease')?.remove();
    $$('.app .ticker, .app section').forEach(node => {
      if (node.id || !/1\.0\s+TAM\s+SÜRÜM\s+YAYINLANDI/i.test(node.textContent || '')) return;
      node.remove();
    });
  }

  function refresh() {
    if(document.documentElement.dataset.ps53DashboardOwner==='1')return;
    removeDashboardRelease();
    applyProviderIcons($('#connections') || document);
    applyProviderIcons($('#ps13MemberConnections') || document);
    synchronizeCardIcons();
  }
  function queueRefresh() {
    if (iconFrame) return;
    iconFrame = window.requestAnimationFrame(() => { iconFrame = 0; refresh(); });
  }
  function observe(selector, marker) {
    const node = $(selector);
    if (!node || node.dataset[marker] === '1') return;
    node.dataset[marker] = '1';
    new MutationObserver(queueRefresh).observe(node, { childList:true });
  }

  /* Any navigation away from the connection button closes its panel. */
  window.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('#connectionBtn')) {
      /* The older dashboard code rewrites these icons while opening the panel. */
      window.setTimeout(refresh, 0);
      return;
    }
    if (target.closest('#connections')) return;
    closeConnections();
  }, true);
  window.addEventListener('keydown', event => { if (event.key === 'Escape') closeConnections(); });
  window.addEventListener('hashchange', closeConnections);

  window.setTimeout(() => {
    refresh();
    observe('#panelGrid', 'ps13RefinePanelWatch');
    observe('#statsGrid', 'ps13RefineStatsWatch');
    observe('#connectionList', 'ps13RefineConnectionWatch');
    observe('.app', 'ps13RefineReleaseWatch');
  }, 70);
})();

(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const icons = {
    onemonth: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.9-4 3.4-6 7.5-6s6.6 2 7.5 6"/></svg>',
    multimonth: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.9-4 3.4-6 7.5-6s6.6 2 7.5 6"/></svg>',
    gifts: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v10H4zM3 6h18v4H3zM12 6v14"/><path d="M12 6c-4.5 0-5.5-4-3-4 1.8 0 3 2 3 4Zm0 0c4.5 0 5.5-4 3-4-1.8 0-3 2-3 4Z"/></svg>',
    kicks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.7 2.7 5.5 13h5.3l-.4 8.3L18.6 11h-5.3z"/></svg>',
    donations: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M16 7.5c-.7-1-2.1-1.7-4-1.7-2.4 0-4 1.2-4 3s1.5 2.7 4.1 3.3c2.6.6 3.9 1.5 3.9 3.3s-1.6 3-4 3c-2 0-3.5-.7-4.3-1.8"/></svg>'
  };
  const classByType = { onemonth:'ps13-one-month', multimonth:'ps13-multi-month', gifts:'ps13-gift', kicks:'ps13-kicks', donations:'ps13-donate' };
  const typeFromHeading = value => {
    const text = String(value || '').toLocaleLowerCase('tr-TR');
    if (text.includes('hediye')) return 'gifts';
    if (text.includes('kick')) return 'kicks';
    if (text.includes('donate')) return 'donations';
    if (text.includes('top abone') || text.includes('2+')) return 'multimonth';
    return 'onemonth';
  };

  let menuTimer = 0;
  let connectionTimer = 0;
  let frame = 0;

  function closeAnimated(selector, className, property) {
    const panel = $(selector);
    if (!panel || panel.hidden || panel.dataset[property] === '1') return;
    panel.dataset[property] = '1';
    panel.classList.remove('ps13-opening');
    panel.classList.add('ps13-closing');
    panel.hidden = true;
    const timer = property === 'ps13FinalMenuClosing' ? menuTimer : connectionTimer;
    window.clearTimeout(timer);
    const nextTimer = window.setTimeout(() => {
      panel.classList.remove('ps13-closing');
      delete panel.dataset[property];
    }, 210);
    if (property === 'ps13FinalMenuClosing') menuTimer = nextTimer;
    else connectionTimer = nextTimer;
  }
  const closeMenu = () => closeAnimated('#sideMenu', 'ps13-menu-surface', 'ps13FinalMenuClosing');
  const closeConnections = () => closeAnimated('#connections', 'ps13-connection-surface', 'ps13FinalConnectionClosing');

  function applyConnectionLetters(root = document) {
    $$('.con-row', root).forEach(row => {
      const label = $('strong, b', row)?.textContent?.trim().toLocaleLowerCase('tr-TR');
      const icon = $('.con-icon, .ps13-platform-icon', row);
      if (!icon) return;
      if (label === 'kick') {
        icon.className = 'ps13-platform-icon ps13-final-kick';
        if (icon.textContent !== 'K') icon.textContent = 'K';
      } else if (label === 'bynogame') {
        icon.className = 'ps13-platform-icon ps13-final-bynogame';
        if (icon.textContent !== 'B') icon.textContent = 'B';
      }
    });
  }
  function applyCardIcon(card, type) {
    const icon = $('.logo', card);
    if (!icon || !icons[type]) return;
    icon.classList.remove('ps13-one-month', 'ps13-multi-month', 'ps13-gift', 'ps13-kicks', 'ps13-donate');
    icon.classList.add('ps13-event-icon', 'ps13-consistent-icon', 'ps13-final-icon', classByType[type]);
    if (icon.innerHTML !== icons[type]) icon.innerHTML = icons[type];
  }
  function synchronizeIcons() {
    $$('#panelGrid .card[data-card]').forEach(card => {
      const type = card.dataset.card;
      if (type === 'kicks') {
        const heading = $('.title h2', card);
        if (heading && heading.textContent !== 'Kicks') heading.textContent = 'Kicks';
      }
      applyCardIcon(card, type);
    });
    $$('#statsGrid .card').forEach(card => applyCardIcon(card, typeFromHeading($('.title h2', card)?.textContent)));
    $$('#ps13CardCopy .card').forEach(card => applyCardIcon(card, card.dataset.card || typeFromHeading($('.title h2', card)?.textContent)));
  }
  function removeDashboardAnnouncement() {
    $('#ps13DashboardRelease')?.remove();
    $('#psDashboardRelease')?.remove();
  }
  function ensureDashboardAnnouncement() {
    const app = $('.app');
    const topbar = app ? $('.topbar', app) : null;
    if (!app || !topbar) return;
    return;
    let release = $('#ps13DashboardHomeRelease');
    if (!release) {
      release = document.createElement('section');
      release.id = 'ps13DashboardHomeRelease';
      release.setAttribute('aria-label', 'Tam sürüm duyurusu');
      release.innerHTML = '<span>1.0 TAM SÜRÜM YAYINLANDI · PLAY STREAMERS YAYINCI DENEYİMİ</span>';
    }
    /* `after` keeps the location identical to the 2. ana sayfa: header first, release below. */
    /* Dashboard duyurusu kaldırıldı; artık DOM'a eklenmez. */
    return;
  }
  function repair() {
    if(document.documentElement.dataset.ps53DashboardOwner==='1')return;
    removeDashboardAnnouncement();
    ensureDashboardAnnouncement();
    applyConnectionLetters($('#connections') || document);
    applyConnectionLetters($('#ps13MemberConnections') || document);
    synchronizeIcons();
  }
  function queueRepair() {
    if (frame) return;
    frame = window.requestAnimationFrame(() => { frame = 0; repair(); });
  }
  function watch(selector, mark) {
    const node = $(selector);
    if (!node || node.dataset[mark] === '1') return;
    node.dataset[mark] = '1';
    new MutationObserver(queueRepair).observe(node, { childList:true });
  }

  /* Closing either floating surface before another dashboard action avoids stale panels. */
  window.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('#menuBtn')) { closeConnections(); return; }
    if (target.closest('#connectionBtn')) { closeMenu(); window.setTimeout(repair, 0); return; }
    if (!target.closest('#sideMenu')) closeMenu();
    if (!target.closest('#connections')) closeConnections();
  }, true);
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeMenu(); closeConnections(); }
  });
  window.addEventListener('hashchange', () => { closeMenu(); closeConnections(); });

  window.setTimeout(() => {
    repair();
    watch('#panelGrid', 'ps13FinalPanelWatch');
    watch('#statsGrid', 'ps13FinalStatsWatch');
    watch('#connectionList', 'ps13FinalConnectionWatch');
    watch('.app', 'ps13FinalAnnouncementWatch');
    if (!document.body.dataset.ps13FinalBodyWatch) {
      document.body.dataset.ps13FinalBodyWatch = '1';
      new MutationObserver(queueRepair).observe(document.body, { childList:true });
    }
  }, 90);
})();

(() => {
  'use strict';
  const API = 'https://api.pstreamers.com';
  const KEY = 'play-streamers-v17-site';
  const $ = (selector, host = document) => host.querySelector(selector);
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const save = value => localStorage.setItem(KEY, JSON.stringify(value));
  const activeSession = () => read().settings?.userSession || '';
  const escapeHtml = value => { const node = document.createElement('span'); node.textContent = String(value || ''); return node.innerHTML; };

  async function api(path, payload, session = '') {
    let response;
    try {
      response = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(session ? { Authorization: `Bearer ${session}` } : {}) }, body: JSON.stringify(payload) });
    } catch {
      throw new Error('Sunucuya ulaşılamadı. Cloudflare Worker’ı güncel kodla Deploy ettiğinden emin ol.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'İşlem şu anda tamamlanamadı.');
    return data;
  }

  function persistSession(sessionId, user, remember) {
    const state = read(); state.settings ||= {}; state.settings.userSession = sessionId; state.settings.user = user; state.settings.rememberUser = remember !== false; save(state);
  }

  function closeMailModal() { $('#psEmailFlow')?.remove(); }
  function showEmailCode({ email, purpose, title, intro, session = '' }) {
    closeMailModal();
    const layer = document.createElement('div'); layer.id = 'psEmailFlow'; layer.className = 'psmail-overlay';
    layer.innerHTML = `<section class="psmail-dialog"><button class="psmail-close" type="button" aria-label="Kapat">×</button><span class="psmail-kicker">E-POSTA DOĞRULAMA</span><h2>${escapeHtml(title || 'Kodunu gir')}</h2><p>${escapeHtml(intro || `${email} adresine 6 haneli bir kod gönderdik.`)}</p><form class="psmail-form"><label class="psmail-field">Doğrulama kodu<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required></label><p class="psmail-error" aria-live="polite"></p><button class="psmail-submit" type="submit">Doğrula</button><button class="psmail-secondary" type="button" data-resend>Kodu tekrar gönder</button><p class="psmail-note">Kod 10 dakika geçerlidir. Kodu kimseyle paylaşma.</p></form></section>`;
    document.body.append(layer);
    const close = () => closeMailModal();
    $('.psmail-close', layer).onclick = close;
    layer.onclick = event => { if (event.target === layer && purpose !== 'registration') close(); };
    const form = $('form', layer); const error = $('.psmail-error', form);
    form.onsubmit = async event => {
      event.preventDefault(); error.textContent = '';
      try {
        const data = await api('/api/auth/verify-email', { email, code: $('[name="code"]', form).value, purpose }, session || activeSession());
        if (data.user && activeSession()) persistSession(activeSession(), data.user, read().settings?.rememberUser !== false);
        closeMailModal();
        window.location.reload();
      } catch (failure) { error.textContent = failure.message || 'Kod doğrulanamadı.'; }
    };
    $('[data-resend]', layer).onclick = async () => {
      error.textContent = '';
      try {
        if (purpose === 'registration') await api('/api/auth/request-email-verification', {}, session || activeSession());
        else throw new Error('Bu işlem için yeni e-posta adresini tekrar girmen gerekiyor.');
        error.style.color = '#b8ff9f'; error.textContent = 'Yeni kod gönderildi.'; window.setTimeout(() => { error.textContent = ''; error.style.color = ''; }, 2600);
      } catch (failure) { error.style.color = ''; error.textContent = failure.message || 'Kod gönderilemedi.'; }
    };
  }

  function showForgotPassword() {
    closeMailModal();
    const layer = document.createElement('div'); layer.id = 'psEmailFlow'; layer.className = 'psmail-overlay';
    layer.innerHTML = `<section class="psmail-dialog"><button class="psmail-close" type="button" aria-label="Kapat">×</button><span class="psmail-kicker">ŞİFRE SIFIRLAMA</span><h2>Şifreni yenile</h2><p>Bağlı e-posta adresini yaz. Sana bir doğrulama kodu göndereceğiz.</p><form class="psmail-form" id="psForgotStart"><label class="psmail-field">E-posta adresi<input name="email" type="email" autocomplete="email" placeholder="ornek@mail.com" required></label><p class="psmail-error" aria-live="polite"></p><button class="psmail-submit" type="submit">Kod gönder</button></form></section>`;
    document.body.append(layer); $('.psmail-close', layer).onclick = closeMailModal; layer.onclick = event => { if (event.target === layer) closeMailModal(); };
    $('#psForgotStart', layer).onsubmit = async event => { event.preventDefault(); const form = event.currentTarget; const error = $('.psmail-error', form); error.textContent = ''; const email = $('[name="email"]', form).value.trim(); try { await api('/api/auth/request-password-reset', { email }); showResetPassword(email); } catch (failure) { error.textContent = failure.message || 'Kod gönderilemedi.'; } };
  }

  function showResetPassword(email) {
    closeMailModal(); const layer = document.createElement('div'); layer.id = 'psEmailFlow'; layer.className = 'psmail-overlay';
    layer.innerHTML = `<section class="psmail-dialog"><button class="psmail-close" type="button" aria-label="Kapat">×</button><span class="psmail-kicker">ŞİFRE SIFIRLAMA</span><h2>Yeni şifre belirle</h2><p><b>${escapeHtml(email)}</b> adresine gönderilen 6 haneli kodu ve yeni şifreni yaz.</p><form class="psmail-form" id="psResetForm"><label class="psmail-field">Doğrulama kodu<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required></label><label class="psmail-field">Yeni şifre<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label class="psmail-field">Yeni şifre tekrar<input name="passwordRepeat" type="password" autocomplete="new-password" minlength="8" required></label><p class="psmail-error" aria-live="polite"></p><button class="psmail-submit" type="submit">Şifreyi yenile</button></form></section>`;
    document.body.append(layer); $('.psmail-close', layer).onclick = closeMailModal; layer.onclick = event => { if (event.target === layer) closeMailModal(); };
    $('#psResetForm', layer).onsubmit = async event => { event.preventDefault(); const form = event.currentTarget; const error = $('.psmail-error', form); error.textContent = ''; const password = $('[name="password"]', form).value; if (password !== $('[name="passwordRepeat"]', form).value) { error.textContent = 'Yeni şifreler birbiriyle aynı değil.'; return; } try { await api('/api/auth/reset-password', { email, code: $('[name="code"]', form).value, password, passwordRepeat: $('[name="passwordRepeat"]', form).value }); closeMailModal(); window.alert('Şifren yenilendi. Yeni şifrenle giriş yapabilirsin.'); } catch (failure) { error.textContent = failure.message || 'Şifre yenilenemedi.'; } };
  }

  function bindStandaloneAuth(form) {
    if (!form || form.dataset.psMailBound === '1') return;
    form.dataset.psMailBound = '1';
    const login = Boolean($('[name="identity"]', form));
    if (login && !$('.psmail-forgot', form)) { const forgotten = document.createElement('button'); forgotten.type = 'button'; forgotten.className = 'psmail-forgot'; forgotten.textContent = 'Şifremi unuttum'; forgotten.onclick = showForgotPassword; $('.auth-error', form)?.before(forgotten); }
    form.onsubmit = async event => {
      event.preventDefault(); const error = $('.auth-error', form) || $('.ps30-error', form); if (error) error.textContent = '';
      const password = $('[name="password"]', form)?.value || ''; const repeat = $('[name="passwordRepeat"]', form)?.value || '';
      const remember = $('[name="remember"]', form)?.checked !== false;
      const payload = login ? { identity: $('[name="identity"]', form)?.value || '', password } : { email: $('[name="email"]', form)?.value || '', username: $('[name="username"]', form)?.value || '', password, passwordRepeat: repeat, birthDate: $('[name="birthDate"]', form)?.value || '' };
      if (!login && password !== repeat) { if (error) error.textContent = 'Şifreler birbiriyle aynı değil.'; return; }
      try {
        const data = await api(`/api/auth/${login ? 'login' : 'register'}`, payload);
        persistSession(data.sessionId, data.user, remember);
        $('#landingAuthModal')?.remove();
        if (!login && data.verificationRequired) { showEmailCode({ email: data.verificationEmail, purpose: 'registration', title: 'E-posta adresini doğrula', intro: `${data.verificationEmail} adresine 6 haneli kod gönderdik. Hesabını açmak için kodu gir.`, session: data.sessionId }); return; }
        window.location.reload();
      } catch (failure) { if (error) error.textContent = failure.message || 'İşlem tamamlanamadı.'; }
    };
  }

  function bindAccountEmail(form) {
    if (!form || form.dataset.psMailBound === '1') return;
    form.dataset.psMailBound = '1';
    if (!$('.psmail-forgot', form)) { const forgotten = document.createElement('button'); forgotten.type = 'button'; forgotten.className = 'psmail-forgot'; forgotten.textContent = 'Şifremi unuttum'; forgotten.onclick = showForgotPassword; form.append(forgotten); }
    form.onsubmit = async event => { event.preventDefault(); const email = $('[name="email"]', form)?.value.trim(); const currentPassword = $('[name="currentPassword"]', form)?.value || ''; try { await api('/api/account/request-email-change', { email, currentPassword }, activeSession()); showEmailCode({ email, purpose: 'email_change', title: 'Yeni e-postanı doğrula', intro: `${email} adresine doğrulama kodu gönderdik.`, session: activeSession() }); } catch (failure) { window.alert(failure.message || 'E-posta doğrulaması başlatılamadı.'); } };
  }

  function bindExistingForms() { bindStandaloneAuth($('#standaloneAuthForm')); bindAccountEmail($('#psEmailForm')); }
  new MutationObserver(bindExistingForms).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', event => { const button = event.target.closest?.('[data-psmail-forgot]'); if (button) { event.preventDefault(); showForgotPassword(); } });
  bindExistingForms();
})();

(()=>{
  'use strict';
  const API='https://api.pstreamers.com';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const storeKey='play-streamers-v17-site';
  let loaderTimer=0;
  const tr={tr:{login:'Giriş yap',register:'Kayıt ol',dashboard:'Dashboard'},en:{login:'Sign in',register:'Sign up',dashboard:'Dashboard'},de:{login:'Anmelden',register:'Registrieren',dashboard:'Dashboard'},es:{login:'Iniciar sesión',register:'Registrarse',dashboard:'Panel'},fr:{login:'Connexion',register:'Créer un compte',dashboard:'Tableau'},ru:{login:'Войти',register:'Регистрация',dashboard:'Панель'},ar:{login:'دخول',register:'تسجيل',dashboard:'لوحة التحكم'},ja:{login:'ログイン',register:'登録',dashboard:'ダッシュボード'}};
  function state(){try{return JSON.parse(localStorage.getItem(storeKey)||'{}')}catch{return{}}}
  function save(p){const s=state();Object.assign(s,p);localStorage.setItem(storeKey,JSON.stringify(s));return s}
  function session(){return state().settings?.userSession||state().userSession||''}
  async function api(path,body,token=session()){const h={'Content-Type':'application/json'};if(token)h.Authorization=`Bearer ${token}`;const res=await fetch(API+path,{method:'POST',headers:h,body:JSON.stringify(body||{})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Sunucu işlemi tamamlayamadı.');return data}
  function loader(on=true){let el=$('#ps14Loader');if(!el){el=document.createElement('div');el.id='ps14Loader';el.className='ps14-loader';el.innerHTML='<div class="ps14-loader-box"><i class="ps14-loader-mark"></i><span>PLAY STREAMERS YÜKLENİYOR</span></div>';document.body.append(el)}clearTimeout(loaderTimer);el.classList.toggle('show',on);if(on)loaderTimer=setTimeout(()=>loader(false),2800)}
  function closeDialog(node){if(!node)return;node.classList.remove('show');setTimeout(()=>node.remove(),190)}
  function dialog(title,text,content,actions){const layer=document.createElement('div');layer.className='ps14-dialog-backdrop';layer.innerHTML=`<section class="ps14-dialog" role="dialog" aria-modal="true"><h2>${title}</h2><p>${text}</p>${content||''}<div class="ps14-dialog-actions">${actions||'<button type="button" data-close>Tamam</button>'}</div></section>`;document.body.append(layer);requestAnimationFrame(()=>layer.classList.add('show'));layer.addEventListener('click',e=>{if(e.target===layer||e.target.closest('[data-close]'))closeDialog(layer)});return layer}
  function addAge(form){if(!form||$('[name="birthDate"]',form))return;const error=$('.auth-error,.ps30-error',form);const label=document.createElement('label');label.className='auth-field';label.innerHTML=`Doğum tarihi<input name="birthDate" type="date" max="${adultDate()}" required>`;(error||form.lastElementChild).before(label)}
  function adultDate(){const d=new Date();d.setFullYear(d.getFullYear()-18);return d.toISOString().slice(0,10)}
  function eyes(root=document){$$('input[type="password"]',root).forEach(input=>{const host=input.parentElement;if(!host||host.dataset.ps14Eye)return;host.dataset.ps14Eye='1';host.classList.add('ps14-eye-host');const b=document.createElement('button');b.type='button';b.className='ps14-eye';b.setAttribute('aria-label','Şifreyi göster');b.innerHTML='◉';b.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';b.innerHTML=show?'◌':'◉';b.setAttribute('aria-label',show?'Şifreyi gizle':'Şifreyi göster')});host.append(b)})}
  function continueExisting(form){if(!form||$('[data-ps14-existing]',form)||$('[name="identity"]',form))return;const b=document.createElement('button');b.type='button';b.dataset.ps14Existing='1';b.className='auth-secondary ps14-existing';b.textContent='Mevcut hesapla devam et';b.onclick=()=>{$('#landingAuthModal')?.remove();$('#standaloneAuthModal')?.remove();$('#landingLogin')?.click();setTimeout(()=>$('#psStandaloneLogin')?.click(),0)};($('.auth-error,.ps30-error',form)||form.lastElementChild).after(b)}
  function emailMissing(){const layer=dialog('E-posta bağlı değil','Hesabın oluşturuldu. Güvenlik ve şifre sıfırlama için bir e-posta adresi bağlamanı öneriyoruz.','<label>E-posta adresi<input name="email" type="email" autocomplete="email" placeholder="ornek@mail.com"></label><label>Mevcut şifren<input name="password" type="password" autocomplete="current-password"></label><p class="ps14-error" aria-live="polite"></p>','<button type="button" data-close>Daha sonra</button><button type="button" class="primary" data-send>Kod gönder</button>');eyes(layer);$('[data-send]',layer).onclick=async()=>{const e=$('[name="email"]',layer).value.trim(),p=$('[name="password"]',layer).value,err=$('.ps14-error',layer);try{await api('/api/account/request-email-change',{email:e,currentPassword:p});closeDialog(layer);emailCode(e,'email_change','E-posta adresini doğrula')}catch(x){err.textContent=x.message}}}
  function emailCode(email,purpose,title){const layer=dialog(title||'E-posta doğrulama',`${email} adresine gönderilen altı haneli kodu gir.`,'<label>Doğrulama kodu<input name="code" inputmode="numeric" maxlength="6" placeholder="123456"></label><p class="ps14-error" aria-live="polite"></p>','<button type="button" data-close>Vazgeç</button><button type="button" class="primary" data-verify>Doğrula</button>');$('[data-verify]',layer).onclick=async()=>{try{await api('/api/auth/verify-email',{email,code:$('[name="code"]',layer).value.trim(),purpose});closeDialog(layer);location.reload()}catch(x){$('.ps14-error',layer).textContent=x.message}}}
  function show14Notes(){dialog('1.4 · Hata ve Gereklilik','Bu sürümde hesap akışını ve günlük kullanımda sorun çıkaran noktaları sağlamlaştırdık.','<ul style="margin:0;padding-left:19px;color:#c7d9e9;line-height:1.7"><li>Kullanıcı adıyla kayıt sonrasında e-posta bağlama uyarısı eklendi.</li><li>Google ve Kick hesabı tamamlarken doğum tarihi zorunlu hale getirildi.</li><li>Yükleme ekranları; giriş, kullanıcı alanı ve Dashboard geçişlerine eklendi.</li><li>Hesap silme, şifre görünürlüğü, oturum geri yükleme ve bağlantı paneli iyileştirildi.</li><li>Yaygın sakıncalı kullanıcı adı türevleri engellendi; dil seçici eklendi.</li></ul>')}
  function bindAuth(form){if(!form||form.dataset.ps14Bound)return;form.dataset.ps14Bound='1';const login=!!$('[name="identity"]',form);if(!login){addAge(form);continueExisting(form)}eyes(form);form.addEventListener('submit',async event=>{event.preventDefault();event.stopImmediatePropagation();const err=$('.auth-error,.ps30-error',form);if(err)err.textContent='';const p=$('[name="password"]',form)?.value||'',repeat=$('[name="passwordRepeat"]',form)?.value||'';if(!login&&p!==repeat){if(err)err.textContent='Şifreler aynı olmalı.';return}const body=login?{identity:$('[name="identity"]',form)?.value||'',password:p}:{username:$('[name="username"]',form)?.value||'',password:p,passwordRepeat:repeat,birthDate:$('[name="birthDate"]',form)?.value||'',email:$('[name="email"]',form)?.value||''};try{loader();const data=await api('/api/auth/'+(login?'login':'register'),body);save({settings:{...(state().settings||{}),userSession:data.sessionId,user:data.user,remember:true},userSession:data.sessionId});loader(false);$('#landingAuthModal')?.remove();$('#standaloneAuthModal')?.remove();if(data.verificationRequired){emailCode(data.verificationEmail,'registration','E-posta adresini doğrula');return}if(data.emailMissing)emailMissing();else moveToMember();}catch(x){loader(false);if(err)err.textContent=x.message||'İşlem tamamlanamadı.'}} ,true)}
  function bindComplete(form){if(!form||form.dataset.ps14Complete)return;form.dataset.ps14Complete='1';addAge(form);eyes(form);form.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();const err=$('.auth-error,.ps30-error',form),p=$('[name="password"]',form)?.value||'',r=$('[name="passwordRepeat"]',form)?.value||'';if(p!==r){if(err)err.textContent='Şifreler aynı olmalı.';return}try{loader();const endpoint=form.id.toLowerCase().includes('kick')?'/api/auth/complete-kick-profile':'/api/auth/complete-google-profile';const data=await api(endpoint,{username:$('[name="username"]',form)?.value||'',password:p,passwordRepeat:r,birthDate:$('[name="birthDate"]',form)?.value||''});save({settings:{...(state().settings||{}),userSession:data.sessionId||session(),user:data.user||state().settings?.user,remember:true}});loader(false);$('#googleProfileSetup')?.remove();$('#kickProfileSetup')?.remove();moveToMember()}catch(x){loader(false);if(err)err.textContent=x.message}} ,true)}
  function moveToMember(){loader();const go=()=>{const second=$('#psSecondHome');const auth=$('#authOverlay');if(second){second.hidden=false;auth&&(auth.hidden=true);document.body.classList.remove('auth-locked','onboarding-locked');setTimeout(()=>loader(false),230);return true}return false};if(!go())setTimeout(()=>{go();loader(false)},600)}
  function restore(){const token=session();if(!token)return;fetch(API+'/api/auth/session',{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{save({settings:{...(state().settings||{}),userSession:token,user:data.user,remember:true}});setTimeout(moveToMember,80)}).catch(()=>{const s=state();if(s.settings){delete s.settings.userSession;delete s.userSession;localStorage.setItem(storeKey,JSON.stringify(s))}})}
  function position(button,panel){const r=button.getBoundingClientRect(),w=Math.min(286,innerWidth-22);panel.style.width=w+'px';panel.style.top=Math.min(r.bottom+8,innerHeight-200)+'px';panel.style.left=Math.max(11,Math.min(innerWidth-w-11,r.right-w))+'px'}
  function closePop(panel){if(!panel||panel.hidden)return;panel.classList.add('ps14-close');setTimeout(()=>{panel.hidden=true;panel.classList.remove('ps14-close')},175)}
  function memberConnection(){const home=$('#psSecondHome'),actions=$('.ps-second-nav-actions',home||document);if(!home||!actions)return;let button=$('#ps14MemberConnection',home);if(!button){button=document.createElement('button');button.id='ps14MemberConnection';button.type='button';button.className='ps13-member-connection ps14-member-connection';button.title='Bağlantı durumu';button.setAttribute('aria-label','Bağlantı durumu');button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9.5a12.3 12.3 0 0 1 17 0M6.8 13a7.5 7.5 0 0 1 10.4 0M10.1 16.4a2.8 2.8 0 0 1 3.8 0M12 20h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';actions.prepend(button)}let panel=$('#ps14MemberConnections');if(!panel){panel=document.createElement('aside');panel.id='ps14MemberConnections';panel.className='ps13-member-connections ps14-popover';panel.hidden=true;document.body.append(panel)}const cfg=state().settings||{};const kick=Boolean(cfg.kickSession||cfg.kickAccount||cfg.user?.kickConnected);const donate=Boolean(cfg.donateAccounts?.length||cfg.donateAccount);panel.innerHTML=`<div class="con-row"><span class="ps13-platform-icon kick">K</span><p><b>Kick</b><small>${kick?'Bağlı':'Bağlı değil'}</small></p></div><div class="con-row"><span class="ps13-platform-icon bynogame">B</span><p><b>Donate</b><small>${donate?'Bağlı':'Bağlı değil'}</small></p></div>`;button.onclick=e=>{e.preventDefault();e.stopPropagation();if(!panel.hidden){closePop(panel);return}position(button,panel);panel.hidden=false;panel.classList.remove('ps14-close');panel.classList.add('ps14-open');setTimeout(()=>panel.classList.remove('ps14-open'),190)};if(!panel.dataset.ps14Outside){panel.dataset.ps14Outside='1';document.addEventListener('click',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!button.contains(e.target))closePop(panel)},{capture:true})}}
  function dashboardButtons(){const targets=$$('#memberDashboard,#psSecondDashboard,#psDashboardShortcut,#ps12Dashboard,[data-ps14-dashboard]');targets.forEach(b=>{if(b.dataset.ps14Dash)return;b.dataset.ps14Dash='1';b.classList.add('ps14-member-dashboard');b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();loader();const app=$('.app'),second=$('#psSecondHome'),auth=$('#authOverlay');if(app){app.hidden=false;app.style.display='';app.classList.add('ps13-dashboard')}if(second)second.hidden=true;if(auth)auth.hidden=true;setTimeout(()=>loader(false),260)},true)})}
  function accountDelete(){const form=$('#psEmailForm')||$('#psPasswordForm');if(!form||$('[data-ps14-delete]',form.parentElement))return;const b=document.createElement('button');b.type='button';b.dataset.ps14Delete='1';b.className='ps14-delete';b.textContent='Hesabımı sil';b.onclick=()=>{const layer=dialog('Hesabı sil','Bu işlem geri alınamaz. Devam etmek için mevcut şifreni gir ve kutuya SİL yaz.','<label>Mevcut şifre<input name="currentPassword" type="password"></label><label>Onay<input name="confirmation" placeholder="SİL"></label><p class="ps14-error"></p>','<button data-close type="button">Vazgeç</button><button class="danger" type="button" data-delete>Hesabı sil</button>');eyes(layer);$('[data-delete]',layer).onclick=async()=>{try{await api('/api/account/delete',{currentPassword:$('[name="currentPassword"]',layer).value,confirmation:$('[name="confirmation"]',layer).value});localStorage.removeItem(storeKey);closeDialog(layer);location.href='/'}catch(x){$('.ps14-error',layer).textContent=x.message}}};form.parentElement.append(b)}
  function language(){if($('#ps14Language'))return;const host=$('.landing-actions')||$('.ps-second-nav-actions')||$('.topbar .actions');if(!host)return;const sel=document.createElement('select');sel.id='ps14Language';sel.className='ps14-language';sel.setAttribute('aria-label','Dil seçimi');sel.innerHTML='<option value="tr">Türkçe</option><option value="en">English</option><option value="de">Deutsch</option><option value="es">Español</option><option value="fr">Français</option><option value="ru">Русский</option><option value="ar">العربية</option><option value="ja">日本語</option>';sel.value=localStorage.getItem('ps14-language')||'tr';sel.onchange=()=>{localStorage.setItem('ps14-language',sel.value);document.documentElement.lang=sel.value;const d=tr[sel.value]||tr.tr;$$('button').forEach(b=>{const t=b.textContent.trim();if(t==='Giriş yap'||t==='Sign in')b.textContent=d.login;if(t==='Kayıt ol'||t==='Sign up')b.textContent=d.register;if(t==='Dashboard')b.textContent=d.dashboard})};host.prepend(sel);sel.onchange()}
  function release14(){const home=$('#psSecondHome');if(home){const h=$('.ps12-notes-heading h2',home);if(h)h.textContent='1.4 · Hata ve Gereklilik';const list=$('.ps12-notes-heading')?.parentElement?.querySelector('ul');if(list)list.innerHTML='<li>Kayıt ve eksik e-posta akışı daha güvenli hale getirildi.</li><li>Oturum yenileme, bağlantı kontrolü ve Dashboard geçişleri sağlamlaştırıldı.</li><li>Hesap silme, yaş kontrolü, şifre görünürlüğü ve dil seçimi eklendi.</li>'}const publicTitle=$('.landing-update-card h2');if(publicTitle)publicTitle.textContent='1.4 · Hata ve Gereklilik'}
  function repair(){eyes();bindAuth($('#landingAuthForm'));bindAuth($('#standaloneAuthForm'));bindComplete($('#googleProfileForm'));bindComplete($('#kickProfileForm'));continueExisting($('#landingAuthForm'));if($('#psSecondHome')&&!$('#ps14MemberConnection'))memberConnection();dashboardButtons();accountDelete();language();/* Sürüm notlarını tekrar yazmak DOM gözlemcisini döngüye sokuyordu. */if(!document.body.dataset.ps14ReleaseApplied){document.body.dataset.ps14ReleaseApplied='1';release14();}$('#ps13DashboardHomeRelease')?.remove()}
  document.addEventListener('click',e=>{const t=e.target instanceof Element?e.target:null;if(!t)return;if(t.closest('#ps12NotesArrow')){e.preventDefault();e.stopImmediatePropagation();show14Notes();return}if(t.closest('#menuBtn,.hamburger-menu'))setTimeout(()=>{$('#sideMenu')?.classList.add('ps14-popover','ps14-open')},0);if(t.closest('#landingLogin,#landingSignup,.auth-close,[data-close]'))setTimeout(repair,60);if(t.closest('[data-logout],#psMenuLogout,#psSecondMenuLogout')){loader();setTimeout(()=>loader(false),450)}},true);
  let repairFrame=0;new MutationObserver(()=>{if(repairFrame)return;repairFrame=requestAnimationFrame(()=>{repairFrame=0;repair()})}).observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('pageshow',()=>{loader(false);repair();restore()});
  addEventListener('error',()=>loader(false));
  repair();restore();
})();

(() => {
  'use strict';
  const API = 'https://api.pstreamers.com';
  const STORE = 'play-streamers-v17-site';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const openEye = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/></svg>';
  const shutEye = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.8 10.8 0 0 1 12 6c6.1 0 9.5 6 9.5 6a17.6 17.6 0 0 1-3.1 3.8M6.4 6.4C3.9 8.2 2.5 12 2.5 12s3.4 6 9.5 6a9.8 9.8 0 0 0 3.1-.5M9.8 9.8a3.1 3.1 0 0 0 4.4 4.4"/></svg>';
  const langs = {
    tr:{flag:'🇹🇷',name:'Türkçe'}, en:{flag:'🇬🇧',name:'English'}, de:{flag:'🇩🇪',name:'Deutsch'}, es:{flag:'🇪🇸',name:'Español'},
    fr:{flag:'🇫🇷',name:'Français'}, ru:{flag:'🇷🇺',name:'Русский'}, ar:{flag:'🇸🇦',name:'العربية'}, ja:{flag:'🇯🇵',name:'日本語'}
  };
  const words = {
    tr:{'Giriş yap':'Giriş yap','Kayıt ol':'Kayıt ol','Dashboard':'Dashboard','Hakkımızda':'Hakkımızda','Ürünlerimiz':'Ürünlerimiz','Nasıl çalışır?':'Nasıl çalışır?','Sistem durumu':'Sistem durumu','Kullanıcı adı':'Kullanıcı adı','Kullanıcı adı veya e-posta':'Kullanıcı adı veya e-posta','Şifre':'Şifre','Şifre tekrar':'Şifre tekrar','Doğum tarihi':'Doğum tarihi','Hesabını tamamla':'Hesabını tamamla','E-posta adresi':'E-posta adresi','Hesabımı sil':'Hesabımı sil','Vazgeç':'Vazgeç','Tamam':'Tamam','Kod gönder':'Kod gönder','Doğrula':'Doğrula','Şifremi unuttum':'Şifremi unuttum','Mevcut hesapla devam et':'Mevcut hesapla devam et','Bağlantı durumu':'Bağlantı durumu'},
    en:{'Giriş yap':'Sign in','Kayıt ol':'Sign up','Dashboard':'Dashboard','Hakkımızda':'About','Ürünlerimiz':'Products','Nasıl çalışır?':'How it works','Sistem durumu':'System status','Kullanıcı adı':'Username','Kullanıcı adı veya e-posta':'Username or email','Şifre':'Password','Şifre tekrar':'Repeat password','Doğum tarihi':'Date of birth','Hesabını tamamla':'Complete account','E-posta adresi':'Email address','Hesabımı sil':'Delete my account','Vazgeç':'Cancel','Tamam':'OK','Kod gönder':'Send code','Doğrula':'Verify','Şifremi unuttum':'Forgot password','Mevcut hesapla devam et':'Continue with an existing account','Bağlantı durumu':'Connection status'},
    de:{'Giriş yap':'Anmelden','Kayıt ol':'Registrieren','Dashboard':'Dashboard','Hakkımızda':'Über uns','Ürünlerimiz':'Produkte','Nasıl çalışır?':'So funktioniert es','Sistem durumu':'Systemstatus','Kullanıcı adı':'Benutzername','Kullanıcı adı veya e-posta':'Benutzername oder E-Mail','Şifre':'Passwort','Şifre tekrar':'Passwort wiederholen','Doğum tarihi':'Geburtsdatum','Hesabını tamamla':'Konto abschließen','E-posta adresi':'E-Mail-Adresse','Hesabımı sil':'Konto löschen','Vazgeç':'Abbrechen','Tamam':'OK','Kod gönder':'Code senden','Doğrula':'Bestätigen','Şifremi unuttum':'Passwort vergessen','Mevcut hesapla devam et':'Mit bestehendem Konto fortfahren','Bağlantı durumu':'Verbindungsstatus'},
    es:{'Giriş yap':'Iniciar sesión','Kayıt ol':'Registrarse','Dashboard':'Panel','Hakkımızda':'Sobre nosotros','Ürünlerimiz':'Productos','Nasıl çalışır?':'Cómo funciona','Sistem durumu':'Estado del sistema','Kullanıcı adı':'Nombre de usuario','Kullanıcı adı veya e-posta':'Usuario o correo','Şifre':'Contraseña','Şifre tekrar':'Repetir contraseña','Doğum tarihi':'Fecha de nacimiento','Hesabını tamamla':'Completar cuenta','E-posta adresi':'Correo electrónico','Hesabımı sil':'Eliminar mi cuenta','Vazgeç':'Cancelar','Tamam':'Aceptar','Kod gönder':'Enviar código','Doğrula':'Verificar','Şifremi unuttum':'Olvidé mi contraseña','Mevcut hesapla devam et':'Continuar con una cuenta existente','Bağlantı durumu':'Estado de conexión'},
    fr:{'Giriş yap':'Connexion','Kayıt ol':'Créer un compte','Dashboard':'Tableau de bord','Hakkımızda':'À propos','Ürünlerimiz':'Produits','Nasıl çalışır?':'Fonctionnement','Sistem durumu':'État du système','Kullanıcı adı':'Nom d’utilisateur','Kullanıcı adı veya e-posta':'Nom d’utilisateur ou e-mail','Şifre':'Mot de passe','Şifre tekrar':'Répéter le mot de passe','Doğum tarihi':'Date de naissance','Hesabını tamamla':'Finaliser le compte','E-posta adresi':'Adresse e-mail','Hesabımı sil':'Supprimer mon compte','Vazgeç':'Annuler','Tamam':'OK','Kod gönder':'Envoyer le code','Doğrula':'Vérifier','Şifremi unuttum':'Mot de passe oublié','Mevcut hesapla devam et':'Continuer avec un compte existant','Bağlantı durumu':'État de la connexion'},
    ru:{'Giriş yap':'Войти','Kayıt ol':'Регистрация','Dashboard':'Панель','Hakkımızda':'О нас','Ürünlerimiz':'Продукты','Nasıl çalışır?':'Как это работает','Sistem durumu':'Статус системы','Kullanıcı adı':'Имя пользователя','Kullanıcı adı veya e-posta':'Имя пользователя или e-mail','Şifre':'Пароль','Şifre tekrar':'Повторите пароль','Doğum tarihi':'Дата рождения','Hesabını tamamla':'Завершить аккаунт','E-posta adresi':'Эл. почта','Hesabımı sil':'Удалить аккаунт','Vazgeç':'Отмена','Tamam':'OK','Kod gönder':'Отправить код','Doğrula':'Подтвердить','Şifremi unuttum':'Забыли пароль','Mevcut hesapla devam et':'Продолжить с существующим аккаунтом','Bağlantı durumu':'Статус подключения'},
    ar:{'Giriş yap':'تسجيل الدخول','Kayıt ol':'إنشاء حساب','Dashboard':'لوحة التحكم','Hakkımızda':'من نحن','Ürünlerimiz':'المنتجات','Nasıl çalışır?':'كيف يعمل','Sistem durumu':'حالة النظام','Kullanıcı adı':'اسم المستخدم','Kullanıcı adı veya e-posta':'اسم المستخدم أو البريد','Şifre':'كلمة المرور','Şifre tekrar':'تأكيد كلمة المرور','Doğum tarihi':'تاريخ الميلاد','Hesabını tamamla':'إكمال الحساب','E-posta adresi':'البريد الإلكتروني','Hesabımı sil':'حذف حسابي','Vazgeç':'إلغاء','Tamam':'حسنًا','Kod gönder':'إرسال الرمز','Doğrula':'تحقق','Şifremi unuttum':'نسيت كلمة المرور','Mevcut hesapla devam et':'المتابعة بحساب موجود','Bağlantı durumu':'حالة الاتصال'},
    ja:{'Giriş yap':'ログイン','Kayıt ol':'登録','Dashboard':'ダッシュボード','Hakkımızda':'私たちについて','Ürünlerimiz':'製品','Nasıl çalışır?':'仕組み','Sistem durumu':'システム状態','Kullanıcı adı':'ユーザー名','Kullanıcı adı veya e-posta':'ユーザー名またはメール','Şifre':'パスワード','Şifre tekrar':'パスワードを再入力','Doğum tarihi':'生年月日','Hesabını tamamla':'アカウントを完了','E-posta adresi':'メールアドレス','Hesabımı sil':'アカウントを削除','Vazgeç':'キャンセル','Tamam':'OK','Kod gönder':'コードを送信','Doğrula':'確認','Şifremi unuttum':'パスワードを忘れた','Mevcut hesapla devam et':'既存のアカウントで続行','Bağlantı durumu':'接続状態'}
  };
  function readState(){ try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } }
  function writeState(value){ localStorage.setItem(STORE, JSON.stringify(value)); }
  function token(){ const s=readState(); return s.settings?.userSession || s.userSession || ''; }
  function loader(on=true){ const el=$('#ps14Loader'); if(!el) return; el.classList.toggle('show',on); }
  async function api(path, body, auth=token()) {
    const headers={'content-type':'application/json'}; if(auth) headers.Authorization=`Bearer ${auth}`;
    let res; try { res=await fetch(API+path,{method:'POST',headers,body:JSON.stringify(body||{})}); } catch { throw new Error('Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.'); }
    const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.error||'İşlem şu anda tamamlanamadı.'); return data;
  }
  function close(node){ if(!node) return; node.classList.remove('show'); setTimeout(()=>node.remove(),180); }
  function modal(title,copy,content,actions){ const layer=document.createElement('div'); layer.className='ps14-dialog-backdrop ps15-code-dialog'; layer.innerHTML=`<section class="ps14-dialog" role="dialog" aria-modal="true"><h2>${title}</h2><p>${copy}</p>${content||''}<div class="ps14-dialog-actions">${actions||'<button type="button" data-close>Tamam</button>'}</div></section>`; document.body.append(layer); requestAnimationFrame(()=>layer.classList.add('show')); layer.addEventListener('click',event=>{if(event.target===layer||event.target.closest('[data-close]')) close(layer)}); return layer; }
  function standardEyes(root=document){
    $$('input[type="password"]',root).forEach(input=>{
      let host=input.parentElement; if(!host) return;
      if(!host.matches('.password-control,.ps14-eye-host,.ps15-eye-host')){ const wrapper=document.createElement('span'); wrapper.className='ps15-eye-host'; host.insertBefore(wrapper,input); wrapper.append(input); host=wrapper; }
      host.classList.add('ps15-eye-host');
      const old=$$('.ps14-eye,.password-toggle,.ps30-eye,.ps11-eye,.ps15-eye',host); old.forEach(button=>{if(button.classList.contains('ps15-eye')) return; button.remove();});
      let button=$('.ps15-eye',host); if(!button){button=document.createElement('button');button.type='button';button.className='ps15-eye';host.append(button);}
      const draw=()=>{ const shown=input.type==='text';button.innerHTML=shown?shutEye:openEye;button.setAttribute('aria-label',shown?'Şifreyi gizle':'Şifreyi göster');button.title=button.getAttribute('aria-label');};
      if(!button.dataset.ps15Eye){button.dataset.ps15Eye='1';button.addEventListener('click',()=>{input.type=input.type==='password'?'text':'password';draw()});} draw();
    });
  }
  function currentLang(){return localStorage.getItem('ps15-locale')||localStorage.getItem('ps14-language')||'tr'}
  function translate(lang=currentLang()){
    const dict=words[lang]||words.tr; document.documentElement.lang=lang; document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    $$('button,label,h1,h2,h3,h4,p,span,small,b,strong,li,a').forEach(node=>{
      if(node.children.length) return; const original=node.dataset.ps15Source || node.textContent.trim(); if(!original) return;
      if(!node.dataset.ps15Source) node.dataset.ps15Source=original;
      const next=dict[original]||original; if(node.textContent.trim()!==next) node.textContent=next;
    });
    $$('[placeholder]').forEach(input=>{ const original=input.dataset.ps15Placeholder||input.getAttribute('placeholder')||''; if(!input.dataset.ps15Placeholder) input.dataset.ps15Placeholder=original; input.setAttribute('placeholder',dict[original]||original); });
    standardEyes();
  }
  function menuClose(menu){ if(!menu||menu.hidden||menu.dataset.ps15Closing) return; menu.dataset.ps15Closing='1';menu.classList.remove('ps15-open');menu.classList.add('ps15-closing');setTimeout(()=>{menu.hidden=true;menu.classList.remove('ps15-closing');delete menu.dataset.ps15Closing;},165); }
  function localeMenu(button){
    let menu=$('#ps15LocaleMenu'); if(!menu){menu=document.createElement('aside');menu.id='ps15LocaleMenu';menu.className='ps15-locale-menu';menu.hidden=true;document.body.append(menu);}
    if(!menu.hidden){menuClose(menu);return;}
    const lang=currentLang();menu.innerHTML=`<span class="ps15-locale-title">DİL SEÇİMİ</span>${Object.entries(langs).map(([code,item])=>`<button type="button" data-ps15-lang="${code}" ${code===lang?'aria-current="true"':''}><span class="ps15-locale-flag">${item.flag}</span>${item.name}</button>`).join('')}`;
    const rect=button.getBoundingClientRect(), width=Math.min(245,innerWidth-24); menu.style.width=width+'px';menu.style.left=Math.max(12,Math.min(innerWidth-width-12,rect.left))+'px';menu.style.top=Math.min(innerHeight-215,rect.bottom+8)+'px';menu.hidden=false;menu.classList.remove('ps15-closing');menu.classList.add('ps15-open');setTimeout(()=>menu.classList.remove('ps15-open'),180);
    $$('[data-ps15-lang]',menu).forEach(item=>item.onclick=()=>{ const selected=item.dataset.ps15Lang; localStorage.setItem('ps15-locale',selected); loader(true); menuClose(menu); setTimeout(()=>{translate(selected);loader(false);},330); });
  }
  function localeButton(root=document){
    /* Keep the old select hidden in DOM so older repair code does not recreate it. */
    const legacyLanguage=$('#ps14Language',root); if(legacyLanguage) legacyLanguage.disabled=true;
    const actions=$('.landing-actions',root); if(!actions) return;
    let button=$('.ps15-locale-button',actions); if(!button){button=document.createElement('button');button.type='button';button.className='ps15-locale-button';button.dataset.ps15Locale='1';button.setAttribute('aria-label','Dil seçimi');button.title='Dil seçimi';button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.5 2.5 3.7 5.5 3.7 9S14.5 18.5 12 21M12 3C9.5 5.5 8.3 8.5 8.3 12S9.5 18.5 12 21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'; const status=$('#ps17SystemStatus',actions); (status?status:actions.firstElementChild)?.before(button);}
  }
  function pruneLegacy(){
    ['#ps10-second-home','#play-streamers-second-home','#ps30StableRoot','#ps17InfoPage','#ps18InfoPage','#ps19InfoPage','#ps20InfoPage','#ps21InfoPage','#ps22InfoPage'].forEach(selector=>$(selector)?.remove());
    /* These are the real panel/statistics nodes during their slide animation; never delete them. */
    $('#ps13MemberConnection')?.remove();
  }
  function ensureCurrentAuth(){
    const page=$('#ps23InfoPage'); if(!page) return;
    $$('.ps23-home',page).forEach(button=>button.onclick=()=>location.hash='');
  }
  function secureAccountForms(){
    const emailForm=$('#psEmailForm')||$('#emailChangeForm');
    if(emailForm && emailForm.dataset.ps15Secure!=='email'){
      emailForm.dataset.ps15Secure='email';
      emailForm.onsubmit=async event=>{event.preventDefault(); const email=$('[name="email"]',emailForm)?.value.trim(), currentPassword=$('[name="currentPassword"]',emailForm)?.value||''; try{await api('/api/account/request-email-change',{email,currentPassword}); codeFlow({kind:'email',email});}catch(error){alert(error.message);}};
    }
    const passwordForm=$('#psPasswordForm')||$('#passwordChangeForm');
    if(passwordForm && passwordForm.dataset.ps15Secure!=='password'){
      passwordForm.dataset.ps15Secure='password';
      passwordForm.onsubmit=async event=>{event.preventDefault();const currentPassword=$('[name="currentPassword"]',passwordForm)?.value||'', password=$('[name="password"]',passwordForm)?.value||'', passwordRepeat=$('[name="passwordRepeat"]',passwordForm)?.value||'';if(password!==passwordRepeat){alert('Yeni şifreler aynı değil.');return;}try{await api('/api/account/request-password-change',{currentPassword});codeFlow({kind:'password',password,passwordRepeat});}catch(error){alert(error.message);}};
    }
    const holder=(emailForm||passwordForm)?.parentElement;
    if(holder){
      const button=$('[data-ps14-delete]',holder)||$('.ps15-delete-account',holder)||document.createElement('button');
      if(!button.parentElement){button.type='button';button.dataset.ps14Delete='1';holder.append(button);}
      button.className='ps15-delete-account';button.dataset.ps15Delete='1';button.innerHTML='⌫ Hesabımı e-posta koduyla sil';
      button.onclick=async()=>{try{await api('/api/account/request-delete',{});codeFlow({kind:'delete'});}catch(error){alert(error.message);}};
    }
  }
  function codeFlow(options){
    const title=options.kind==='delete'?'Hesabı silme kodu':options.kind==='password'?'Şifre değişim kodu':'E-posta değişim kodu';
    const copy=options.kind==='delete'?'Bağlı e-posta adresine gelen 6 haneli kodu yaz. Onaylandığında hesabına ait veriler kalıcı olarak silinir.':options.kind==='password'?'Bağlı e-posta adresine gelen 6 haneli kodu yaz.':'Yeni e-posta adresine gelen 6 haneli kodu yaz.';
    const layer=modal(title,copy,`<label>Doğrulama kodu<input class="ps15-code" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" required></label><p class="ps14-error" aria-live="polite"></p>`,'<button type="button" data-close>Vazgeç</button><button type="button" class="primary" data-confirm>Onayla</button>');
    $('[data-confirm]',layer).onclick=async()=>{const error=$('.ps14-error',layer),code=$('[name="code"]',layer).value.trim();try{
      if(options.kind==='delete'){await api('/api/account/delete',{code});localStorage.removeItem(STORE);close(layer);loader(true);setTimeout(()=>{location.href='/';},220);return;}
      if(options.kind==='password') await api('/api/account/confirm-password-change',{code,password:options.password,passwordRepeat:options.passwordRepeat});
      else await api('/api/auth/verify-email',{email:options.email,code,purpose:'email_change'});
      close(layer);alert(options.kind==='password'?'Şifren güncellendi.':'E-posta adresin doğrulandı ve güncellendi.');location.reload();
    }catch(failure){error.textContent=failure.message||'Kod doğrulanamadı.';}};
  }
  function repairStats(){
    const panel=$('#panelView'), stats=$('#statsView'), grid=$('#statsGrid'); if(!panel||!stats||!grid) return;
    $$('.workspace-tabs button').forEach(button=>{if(button.dataset.ps15StatsBound)return;button.dataset.ps15StatsBound='1';button.addEventListener('click',()=>{if(button.dataset.view!=='stats')return;setTimeout(()=>{stats.hidden=false;panel.hidden=true;stats.style.pointerEvents='auto';grid.style.pointerEvents='auto';$$('.card',grid).forEach(card=>{card.hidden=false;card.style.pointerEvents='auto';card.style.visibility='visible';});},410);},true);});
  }
  async function restoreWithoutFlash(){
    const value=token(); if(!value) return;
    document.documentElement.classList.add('ps15-session-pending');
    const controller=new AbortController();const timeout=window.setTimeout(()=>controller.abort(),4000);
    try{
      const response=await fetch(API+'/api/auth/session',{headers:{Authorization:`Bearer ${value}`},signal:controller.signal});
      if(!response.ok) throw new Error('session');
      const data=await response.json();const state=readState();state.settings||={};state.settings.userSession=value;state.settings.user=data.user;if(typeof state.settings.rememberUser!=='boolean')state.settings.rememberUser=false;writeState(state);
      const home=$('#psSecondHome'),auth=$('#authOverlay');if(home){home.hidden=false;if(auth)auth.hidden=true;}
    }catch(_){/* Zaman aşımı veya geçici rate limit durumunda görünür ana sayfa korunur. */}
    finally{window.clearTimeout(timeout);document.documentElement.classList.remove('ps15-session-pending');}
  }
  function repair(){pruneLegacy();localeButton();standardEyes();secureAccountForms();repairStats();translate(currentLang());ensureCurrentAuth();}
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;if(!target)return;
    const locale=target.closest('[data-ps15-locale]');if(locale){event.preventDefault();event.stopPropagation();localeMenu(locale);return;}
    const languageLayer=$('#ps15LocaleMenu');if(languageLayer&&!languageLayer.hidden&&!languageLayer.contains(target))menuClose(languageLayer);
    const auth=target.closest('#ps23InfoPage [data-ps23-auth]');if(auth){const mode=auth.dataset.ps23Auth;setTimeout(()=>{if($('#landingAuthModal')||$('.auth-dialog'))return;const trigger=mode==='login'?$('#landingLogin'):$('#landingSignup');trigger?.click();},520);}
  },true);
  addEventListener('keydown',event=>{if(event.key==='Escape')menuClose($('#ps15LocaleMenu'));});
  let frame=0;new MutationObserver(()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;repair();});}).observe(document.body,{childList:true,subtree:true});
  repair();restoreWithoutFlash();
})();

(() => {
  'use strict';
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];

  function closeFloating(){
    ['#ps13MemberConnections','#ps14MemberConnections','#connections','#sideMenu'].forEach(selector=>{
      const node=$(selector); if(!node) return;
      node.hidden=true; node.classList.remove('show','ps13-opening','ps13-closing','ps14-open','ps14-popover');
    });
  }
  function normalizeSecondHome(){
    const home=$('#psSecondHome');
    if(!home) return;
    /* Eski, sade kullanıcı ana sayfası seçildiyse bu onarım onun sınıflarını ezmez. */
    if(home.dataset.ps17Legacy==='1'){
      $$('#ps13MemberConnection',home).forEach(node=>node.remove());
      return;
    }
    home.classList.add('ps12-user-home','ps16-member-home');
    /* PS13 eski katmanı ikinci ana sayfaya ikinci Wi-Fi tuşu ekliyordu. */
    $$('#ps13MemberConnection',home).forEach(node=>node.remove());
    const actions=$('.ps-second-nav-actions',home);
    if(actions){
      const buttons=$$('#ps14MemberConnection',actions);
      buttons.slice(1).forEach(node=>node.remove());
    }
    const app=$('.app');
    if(!home.hidden && app){ app.hidden=true; app.style.display='none'; }
  }
  function openDashboard(){
    const home=$('#psSecondHome'), app=$('.app');
    closeFloating();
    if(home) home.hidden=true;
    if(app){ app.hidden=false; app.style.removeProperty('display'); }
    sessionStorage.setItem('ps-second-dashboard','1');
  }
  function openMemberHome(){
    const home=$('#psSecondHome'), app=$('.app');
    closeFloating();
    if(app){ app.hidden=true; app.style.display='none'; }
    if(home) home.hidden=false;
    sessionStorage.removeItem('ps-second-dashboard');
    normalizeSecondHome();
  }
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null; if(!target) return;
    const dashboard=target.closest('#psSecondHome #ps12Dashboard');
    if(dashboard){ event.preventDefault(); event.stopImmediatePropagation(); openDashboard(); return; }
    const brand=target.closest('#psSecondHome #ps12HomeBrand');
    if(brand){ event.preventDefault(); event.stopImmediatePropagation(); openMemberHome(); return; }
    const memberMenu=target.closest('#psSecondHome #ps12DashboardMenu');
    if(memberMenu){ event.preventDefault(); event.stopImmediatePropagation(); $('#menuBtn')?.click(); return; }
  },true);
  let queued=0;
  const repair=()=>{ if(queued) return; queued=requestAnimationFrame(()=>{queued=0;normalizeSecondHome();}); };
  new MutationObserver(repair).observe(document.body,{childList:true,subtree:true});
  addEventListener('pageshow',normalizeSecondHome);
  normalizeSecondHome();
})();

(() => {
  'use strict';
  const KEY='play-streamers-v17-site';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
  const esc=value=>{const n=document.createElement('span');n.textContent=String(value||'');return n.innerHTML};
  const settings=()=>read().settings||{};
  const active=()=>{const s=settings();return Boolean(s.userSession&&s.user&&!s.user.needsCredentialSetup)};
  const details={panel:['Canlı Dashboard','Yayın açık veya kapalı durumunu, gelen olayları ve sayaçları tek noktadan takip edersin.'],stats:['Yayıncı istatistikleri','Abonelik, hediye, kicks ve destek hareketlerini ayrı bölümlerde daha rahat okursun.'],connections:['Bağlantılar','Gmail, Kick ve destek hesaplarının bağlantı durumunu tek bir merkezden kontrol edersin.']};
  function loader(show){let node=$('#ps20Loader');if(!node){node=document.createElement('aside');node.id='ps20Loader';node.innerHTML='<div><i></i><span>PLAY STREAMERS YÜKLENİYOR</span></div>';document.body.append(node)}node.classList.toggle('show',show)}
  function info(title,copy){let node=$('#ps20Info');if(!node){node=document.createElement('section');node.id='ps20Info';document.body.append(node)}node.hidden=false;node.innerHTML=`<article><button type="button" aria-label="Kapat">×</button><span class="ps20-kicker">PLAY STREAMERS</span><h2>${esc(title)}</h2><p>${esc(copy)}</p></article>`;$('button',node).onclick=()=>node.hidden=true;node.onclick=e=>{if(e.target===node)node.hidden=true}}
  function closePop(node){if(!node||node.hidden||node.classList.contains('ps20-closing'))return;node.classList.add('ps20-closing');setTimeout(()=>{node.hidden=true;node.classList.remove('ps20-closing')},180)}
  function closeFloats(){['#ps20ConnectionPopover','#ps20Menu'].forEach(id=>closePop($(id)))}
  function closeInfo(){const node=$('#ps20Info');if(!node||node.hidden||node.classList.contains('ps20-closing'))return;node.classList.add('ps20-closing');setTimeout(()=>{node.hidden=true;node.classList.remove('ps20-closing')},180)}
  function showPs20Info(title,copy){let node=$('#ps20Info');if(!node){node=document.createElement('section');node.id='ps20Info';document.body.append(node)}node.classList.remove('ps20-closing');node.hidden=false;node.innerHTML=`<article><button type="button" aria-label="Kapat">×</button><span class="ps20-kicker">PLAY STREAMERS</span><h2>${esc(title)}</h2><p>${esc(copy)}</p></article>`;$('button',node).onclick=closeInfo;node.onclick=e=>{if(e.target===node)closeInfo()}}
  async function signOut(){if(!window.confirm('Hesaptan çıkmak istediğine emin misin?'))return;const state=read(),token=state.settings?.userSession||'';try{if(token)await fetch('https://api.pstreamers.com/api/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`}})}catch{}state.settings||={};delete state.settings.userSession;delete state.settings.user;state.settings.rememberUser=false;localStorage.setItem(KEY,JSON.stringify(state));['ps-second-dashboard','ps-signed-in-now','play-streamers-account-flow'].forEach(key=>sessionStorage.removeItem(key));const home=$('#psSecondHome'),app=$('.app'),auth=$('#authOverlay');if(home)home.hidden=true;if(app){app.hidden=true;app.style.display='none'}if(auth)auth.hidden=false;setTimeout(()=>location.replace(location.pathname+location.search),120)}
  function openDashboardPs20(event){event?.preventDefault();event?.stopPropagation();closeFloats();loader(true);sessionStorage.setItem('ps-second-dashboard','1');const home=$('#psSecondHome'),app=$('.app');setTimeout(()=>{if(home)home.hidden=true;if(app){app.hidden=false;app.style.removeProperty('display')}const panel=$('#panelView'),stats=$('#statsView');if(panel)panel.hidden=false;if(stats)stats.hidden=true;$$('.workspace-tabs button').forEach(button=>button.classList.toggle('active',button.dataset.view==='panel'));loader(false)},290)}
  function statusLine(name,connected,copy){return `<article class="ps20-connection"><i class="ps20-status ${connected?'':'off'}">${connected?'✓':'×'}</i><span><b>${name} hesabı ${connected?'bağlı':'bağlı değil'}</b><small>${esc(copy)}</small></span></article>`}
  function showDashboard(event){event?.preventDefault();event?.stopPropagation();closeFloats();loader(true);sessionStorage.setItem('ps-second-dashboard','1');const home=$('#psSecondHome'),app=$('.app');setTimeout(()=>{if(home)home.hidden=true;if(app){app.hidden=false;app.style.removeProperty('display')}loader(false)},260)}
  function render(withLoader=false){
    if(!active()||sessionStorage.getItem('ps-second-dashboard')==='1')return false;
    const s=settings(),user=s.user||{},home=$('#psSecondHome')||document.createElement('section');
    if(!home.id){home.id='psSecondHome';document.body.append(home)}
    const gmail=Boolean(user.googleConnected||user.google_connected||user.googleId||user.google_id||user.provider==='google'||user.authProvider==='google');
    const kick=Boolean(user.kickConnected||user.kick_connected||user.kickId||user.kick_id);
    const gmailCopy=gmail?(user.email||'Google hesabın doğrulandı'):'Henüz Gmail bağlantısı yok';
    const kickCopy=kick?(s.kickAccount?.username?`@${s.kickAccount.username}`:'Kick hesabın etkin'):'Henüz Kick bağlantısı yok';
    home.className='ps-second-home ps17-old-second-home ps20-member-home ps20-enter';home.dataset.ps17Legacy='1';home.dataset.ps20Design='1';
    home.innerHTML=`<main class="ps20-shell"><header class="ps20-nav"><button class="ps20-brand" id="ps20Brand" type="button"><b class="ps20-logo"><span>PS</span></b><span>PLAY STREAMERS</span></button><nav class="ps20-actions"><button id="ps20Connection" type="button" aria-label="Bağlantı durumu" title="Bağlantı durumu"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3.5 9.5a13 13 0 0 1 17 0"/><path d="M6.7 13a8.4 8.4 0 0 1 10.6 0"/><path d="M10 16.5a3.4 3.4 0 0 1 4 0"/><path d="M12 20h.01"/></svg></button><button class="ps20-dashboard" id="ps17Dashboard" type="button">✦ Dashboard</button><button id="ps20MenuButton" type="button" aria-label="Menü">☰</button></nav></header><section class="ps20-release"><i></i><b>1.0 TAM SÜRÜM YAYINLANDI · PLAY STREAMERS İLE YAYINCILIK DENEYİMİ</b></section><section class="ps20-hero"><div class="ps20-hero-copy"><span class="ps20-kicker">KİŞİSEL YAYIN ALANI · HOŞ GELDİN, ${esc(user.username||user.name||'Yayıncı')}</span><h1>Yayın senin.<br>Ritim sende.</h1><p>Yayın akışını, topluluk hareketlerini ve hesap bağlantılarını tek noktadan yönetebileceğin kişisel Play Streamers alanındasın. Hazır olduğunda Dashboard ile yayın moduna geçebilirsin.</p></div><aside class="ps20-connections">${statusLine('Gmail',gmail,gmailCopy)}${statusLine('Kick',kick,kickCopy)}</aside></section><section class="ps20-grid"><article class="ps20-card"><span class="ps20-kicker">NELER YENİ?</span><button class="ps20-update-arrow" id="ps20Updates" type="button" aria-label="Güncelleme notlarını aç">→</button><h2>1.4 · Hata ve Gereklilik</h2><p>Hesap akışı, ekran geçişleri ve günlük kullanımda önemli olan bağlantı noktaları yenilendi.</p><ul class="ps20-list"><li>Giriş ve hesap ekranlarındaki parola kontrolleri düzenlendi.</li><li>Kullanıcı alanı, Dashboard ve bağlantı ekranları birbirinden ayrıldı.</li><li>Oturum geri yükleme ile sayfa yenileme akışı iyileştirildi.</li></ul></article><article class="ps20-card"><span class="ps20-kicker">NELER SUNUYORUZ?</span><h2>Yayıncı araçları.</h2><p>Her kart, yayınındaki farklı bir alan için hazırlanmış kontrol merkezini anlatır.</p><div class="ps20-offers"><button data-ps20-info="panel" type="button"><strong>Canlı Dashboard</strong><span>Yayın ve olay akışının merkezi.</span></button><button data-ps20-info="stats" type="button"><strong>İstatistikler</strong><span>Topluluk hareketlerinin özeti.</span></button><button data-ps20-info="connections" type="button"><strong>Bağlantılar</strong><span>Hesap ve platform durumları.</span></button></div></article><article class="ps20-card wide"><span class="ps20-kicker">NELERİ GELİŞTİRİYORUZ?</span><h2>Sıradaki adımlar.</h2><p>Yayın deneyimini daha okunur, bağlantıları daha güvenli ve topluluk özetlerini daha hızlı hâle getirmek için çalışıyoruz.</p><div class="ps20-roadmap"><article><b>Bağlantı merkezi</b><p>Kick ve destek platformlarının durumunu daha açık ve tekil biçimde gösteren yeni kontrol alanı.</p></article><article><b>Olay geçmişi</b><p>Abonelik, hediye, kicks ve destekleri filtrelenebilir bir zaman çizelgesinde toplama çalışması.</p></article><article><b>Yayın özeti</b><p>Her yayın için başlangıçtan itibaren sayılan değerleri daha hızlı okunur istatistiklere dönüştürme hedefi.</p></article></div></article></section><footer class="ps20-footer"><span>Güvenli bağlantılar · Kişisel panel · Ücretsiz başlangıç</span><span>Developed by <a href="https://guns.lol/switly" target="_blank" rel="noopener">SW CREATE</a></span></footer></main>`;
    home.hidden=false;home.scrollTop=0;$('#authOverlay')?.setAttribute('hidden','');const app=$('.app');if(app){app.hidden=true;app.style.display='none'};
    if(withLoader){loader(true);setTimeout(()=>loader(false),430)}
    setTimeout(()=>home.classList.remove('ps20-enter'),560);
    $('#ps20Brand',home).onclick=()=>{sessionStorage.removeItem('ps-second-dashboard');render(true)};
    $('#ps17Dashboard',home).onclick=showDashboard;
    $('#ps20Connection',home).onclick=event=>{event.stopPropagation();let panel=$('#ps20ConnectionPopover');if(!panel){panel=document.createElement('aside');panel.id='ps20ConnectionPopover';document.body.append(panel)}if(!panel.hidden){panel.hidden=true;return}panel.innerHTML=statusLine('Gmail',gmail,gmailCopy)+statusLine('Kick',kick,kickCopy);const r=event.currentTarget.getBoundingClientRect();panel.style.top=`${r.bottom+9}px`;panel.style.left=`${Math.max(12,Math.min(innerWidth-292,r.right-280))}px`;panel.hidden=false};
    $('#ps20MenuButton',home).onclick=event=>{event.stopPropagation();let menu=$('#ps20Menu');if(!menu){menu=document.createElement('aside');menu.id='ps20Menu';document.body.append(menu)}if(!menu.hidden){menu.hidden=true;return}menu.innerHTML='<button type="button" data-ps20-menu="account">Hesabım</button><button type="button" data-ps20-menu="updates">Güncelleme notları</button><button type="button" data-ps20-menu="products">Ürünlerimiz</button><button type="button" class="danger" data-ps20-menu="logout">Çıkış yap</button>';const r=event.currentTarget.getBoundingClientRect();menu.style.top=`${r.bottom+9}px`;menu.style.left=`${Math.max(12,Math.min(innerWidth-292,r.right-280))}px`;menu.hidden=false;$$('[data-ps20-menu]',menu).forEach(button=>button.onclick=()=>{const action=button.dataset.ps20Menu;menu.hidden=true;if(action==='updates')return $('#ps20Updates',home).click();if(action==='products')return info('Ürünlerimiz','Canlı Dashboard, yayıncı istatistikleri, bağlantı merkezi ve yeni yayın araçları aynı Play Streamers deneyiminin parçalarıdır.');if(action==='account')return $('#menuAccountFull,#psMenuAccount')?.click();if(action==='logout')return $('#menuLogoutFull,#psMenuLogout')?.click()})};
    $('#ps20Updates',home).onclick=()=>{const target=$('#psMenuUpdates,#menuUpdatesFull');if(target)target.click();else info('Güncelleme notları','1.4 sürümünde hesap akışı, ekran geçişleri, bağlantı kontrolü ve oturum geri yükleme iyileştirildi.')};
    /* Eski katmanların olayları yerine bu ekranın tekil etkileşimleri kullanılır. */
    const greeting=$('.ps20-hero-copy .ps20-kicker',home);if(greeting)greeting.textContent=`HOŞ GELDİN, ${user.username||user.name||'Yayıncı'}`;
    $('.ps20-logo',home)?.classList.add('brand-logo');
    $('#ps20Brand',home).onclick=()=>{sessionStorage.removeItem('ps-second-dashboard');render(true)};
    $('#ps17Dashboard',home).onclick=openDashboardPs20;
    $('#ps20Connection',home).onclick=event=>{event.preventDefault();event.stopPropagation();let panel=$('#ps20ConnectionPopover');if(!panel){panel=document.createElement('aside');panel.id='ps20ConnectionPopover';document.body.append(panel)}if(!panel.hidden){closePop(panel);return}panel.classList.remove('ps20-closing');panel.innerHTML=statusLine('Gmail',gmail,gmailCopy)+statusLine('Kick',kick,kickCopy);const r=event.currentTarget.getBoundingClientRect();panel.style.top=`${r.bottom+10}px`;panel.style.left=`${Math.max(12,Math.min(innerWidth-304,r.right-292))}px`;panel.hidden=false};
    $('#ps20MenuButton',home).onclick=event=>{event.preventDefault();event.stopPropagation();let menu=$('#ps20Menu');if(!menu){menu=document.createElement('aside');menu.id='ps20Menu';document.body.append(menu)}if(!menu.hidden){closePop(menu);return}menu.classList.remove('ps20-closing');menu.innerHTML='<button type="button" data-ps20-menu="account">Hesabım</button><button type="button" data-ps20-menu="updates">Güncelleme notları</button><button type="button" data-ps20-menu="products">Ürünlerimiz</button><button type="button" class="danger" data-ps20-menu="logout">Çıkış yap</button>';const r=event.currentTarget.getBoundingClientRect();menu.style.top=`${r.bottom+10}px`;menu.style.left=`${Math.max(12,Math.min(innerWidth-304,r.right-292))}px`;menu.hidden=false;$$('[data-ps20-menu]',menu).forEach(button=>button.onclick=()=>{const action=button.dataset.ps20Menu;closePop(menu);if(action==='updates')return $('#ps20Updates',home).click();if(action==='products')return showPs20Info('Ürünlerimiz','Canlı Dashboard, yayıncı istatistikleri, bağlantı merkezi ve yeni yayın araçları aynı Play Streamers deneyiminin parçalarıdır.');if(action==='account'){const target=$('#menuAccountFull,#psMenuAccount');return target?target.click():showPs20Info('Hesabım','Hesap ayrıntılarını ve bağlantılarını Dashboard menüsünden yönetebilirsin.')}if(action==='logout')return signOut()})};
    $('#ps20Updates',home).onclick=()=>{const target=$('#psMenuUpdates,#menuUpdatesFull');if(target)target.click();else showPs20Info('Güncelleme notları','1.4 sürümünde hesap akışı, ekran geçişleri, bağlantı kontrolü ve oturum geri yükleme iyileştirildi.')};
    $$('[data-ps20-info]',home).forEach(button=>button.onclick=()=>{const item=details[button.dataset.ps20Info];showPs20Info(item[0],item[1])});
    return true;
  }
  document.addEventListener('click',event=>{if(!event.target.closest('#ps20Connection')&&!event.target.closest('#ps20ConnectionPopover')&&!event.target.closest('#ps20MenuButton')&&!event.target.closest('#ps20Menu'))closeFloats()},true);
  window.__psClassicSecondHome=render;
  addEventListener('load',()=>setTimeout(()=>render(true),180));
  addEventListener('pageshow',()=>setTimeout(()=>render(false),30));
  render(true);
})();

(() => {
  'use strict';
  const STORE='play-streamers-v17-site';
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const state=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch{return {}}};
  const escape=value=>{const node=document.createElement('span');node.textContent=String(value||'');return node.innerHTML};
  const close=node=>{if(!node||node.hidden||node.classList.contains('ps20-closing'))return;node.classList.add('ps20-closing');setTimeout(()=>{node.hidden=true;node.classList.remove('ps20-closing')},180)};
  const closePanels=()=>['#ps20ConnectionPopover','#ps20Menu'].forEach(selector=>close($(selector)));
  function accountStatus(){const settings=state().settings||{},user=settings.user||{};const gmail=Boolean(user.googleConnected||user.google_connected||user.googleId||user.google_id||user.provider==='google'||user.authProvider==='google');const kick=Boolean(user.kickConnected||user.kick_connected||user.kickId||user.kick_id);return {gmail,kick,user,settings}}
  function connectionCard(platform,connected,copy){const icon=platform==='Gmail'?'<span class="ps21-platform-logo google">G</span>':'<span class="ps21-platform-logo kick">K</span>';return `<article class="ps21-connection-card">${icon}<span class="ps21-connection-copy"><b>${platform}</b><small>${escape(copy)}</small></span><i class="ps21-connection-state ${connected?'':'off'}">${connected?'✓':'×'}</i></article>`}
  function connectionMarkup(){const {gmail,kick,user,settings}=accountStatus();const gmailText=gmail?(user.email||'Google hesabın doğrulandı'):'Henüz Gmail bağlantısı yok';const kickText=kick?(settings.kickAccount?.username?`@${settings.kickAccount.username}`:'Kick hesabın etkin'):'Henüz Kick bağlantısı yok';return `<header class="ps21-connection-head">BAĞLANTI DURUMU</header><div class="ps21-connection-list">${connectionCard('Gmail',gmail,gmailText)}${connectionCard('Kick',kick,kickText)}</div>`}
  function openConnection(event){event.preventDefault();event.stopPropagation();let panel=$('#ps20ConnectionPopover');if(!panel){panel=document.createElement('aside');panel.id='ps20ConnectionPopover';document.body.append(panel)}if(!panel.hidden){close(panel);return}panel.classList.remove('ps20-closing');panel.innerHTML=connectionMarkup();const rect=event.currentTarget.getBoundingClientRect();panel.style.top=`${Math.round(rect.bottom+9)}px`;panel.style.right=`${Math.max(12,Math.round(innerWidth-rect.right))}px`;panel.style.left='auto';panel.hidden=false}
  function menuMarkup(){return '<button type="button" data-ps21-menu="account">Hesabım</button><button type="button" data-ps21-menu="updates">Güncelleme notları</button><button type="button" data-ps21-menu="products">Ürünlerimiz</button><button type="button" class="danger" data-ps21-menu="logout">Çıkış yap</button>'}
  function openMenu(event){event.preventDefault();event.stopPropagation();let menu=$('#ps20Menu');if(!menu){menu=document.createElement('aside');menu.id='ps20Menu';document.body.append(menu)}if(!menu.hidden){close(menu);return}menu.classList.remove('ps20-closing');menu.innerHTML=menuMarkup();const rect=event.currentTarget.getBoundingClientRect();menu.style.top=`${Math.round(rect.bottom+9)}px`;menu.style.right=`${Math.max(12,Math.round(innerWidth-rect.right))}px`;menu.style.left='auto';menu.hidden=false;$$('[data-ps21-menu]',menu).forEach(button=>button.onclick=()=>{const action=button.dataset.ps21Menu;close(menu);if(action==='updates')return $('#ps20Updates')?.click();if(action==='products')return $('#ps20Updates')?.click();if(action==='account')return $('#menuAccountFull,#psMenuAccount')?.click();if(action==='logout')return $('#menuLogoutFull,#psMenuLogout')?.click()})}
  function bind(){const home=$('#psSecondHome.ps20-member-home');if(!home)return;const connection=$('#ps20Connection',home),menu=$('#ps20MenuButton',home);if(connection)connection.onclick=openConnection;if(menu)menu.onclick=openMenu}
  document.addEventListener('click',event=>{const target=event.target;if(!(target instanceof Element))return;if(!target.closest('#ps20Connection,#ps20ConnectionPopover,#ps20MenuButton,#ps20Menu'))closePanels()},true);
  new MutationObserver(()=>requestAnimationFrame(bind)).observe(document.body,{childList:true,subtree:true});
  addEventListener('load',bind);addEventListener('pageshow',bind);bind();
})();

(() => {
  'use strict';
  const API='https://api.pstreamers.com';
  const KEY='play-streamers-v17-site';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=value=>{const n=document.createElement('span');n.textContent=String(value||'');return n.innerHTML};
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
  const write=value=>localStorage.setItem(KEY,JSON.stringify(value));
  const settings=()=>read().settings||{};
  const token=()=>String(settings().userSession||'');
  async function api(path,payload={},session=token()){
    const response=await fetch(API+path,{method:'POST',headers:{'content-type':'application/json',...(session?{Authorization:`Bearer ${session}`}:{})},body:JSON.stringify(payload)});
    let data={};try{data=await response.json()}catch{}
    if(!response.ok)throw new Error(data.error||'İşlem şu anda tamamlanamadı.');
    return data;
  }
  function setError(form,message){let node=$('.ps27-form-error',form)||$('.ps14-error,.psmail-error,.ps30-error',form);if(!node){node=document.createElement('p');node.className='ps27-form-error';form.append(node)}node.textContent=message||'';node.style.color=message?'#ff9da6':'';node.style.fontWeight='800';}
  const eyeSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-5.5 9.5-5.5S21.5 12 21.5 12 18.2 17.5 12 17.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.7"/></svg>';
  const calendarSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 10h17"/></svg>';
  function decoratePassword(input){if(!input||input.dataset.ps27Eye==='1')return;input.dataset.ps27Eye='1';const host=input.parentElement;if(!host)return;host.classList.add('ps27-password-field');const button=document.createElement('button');button.type='button';button.className='ps27-password-eye';button.setAttribute('aria-label','Şifreyi göster');button.innerHTML=eyeSvg;button.onclick=()=>{const visible=input.type==='text';input.type=visible?'password':'text';button.setAttribute('aria-label',visible?'Şifreyi göster':'Şifreyi gizle')};host.append(button)}
  function dateControl(form){if(!form)return;let input=$('[name="birthDate"]',form);if(!input){const submit=$('button[type="submit"],.ps30-submit,.primary',form);const field=document.createElement('label');field.className='ps27-date-field';field.innerHTML=`Doğum tarihi<div class="ps27-date-wrap"><input name="birthDate" type="date" required aria-label="Doğum tarihi"><button type="button" class="ps27-date-open" aria-label="Takvimi aç">${calendarSvg}</button></div>`;(submit?submit.parentElement:form).before(field);input=$('[name="birthDate"]',field)}input.type='date';input.required=true;const adult=new Date();adult.setFullYear(adult.getFullYear()-18);input.max=adult.toISOString().slice(0,10);let wrap=input.closest('.ps27-date-wrap');if(!wrap){wrap=document.createElement('div');wrap.className='ps27-date-wrap';input.before(wrap);wrap.append(input)}if($('.ps27-date-open',wrap))return;const open=document.createElement('button');open.type='button';open.className='ps27-date-open';open.setAttribute('aria-label','Takvimi aç');open.innerHTML=calendarSvg;open.onclick=()=>{if(typeof input.showPicker==='function')input.showPicker();else{input.focus();input.click()}};wrap.append(open)}
  function isCompletionForm(form){return form instanceof HTMLFormElement&&(form.dataset.ps27Completion==='1'||/^(googleProfileForm|kickProfileForm|ps30CompleteForm)$/i.test(form.id)||/hesabını tamamla/i.test(form.textContent||''));}
  function prepareCompletion(form){if(!isCompletionForm(form)||form.dataset.ps27Prepared==='1')return;const oldId=form.id;form.dataset.ps27Prepared='1';form.dataset.ps27Completion='1';form.dataset.ps27Provider=/kick/i.test(oldId)||/kick/i.test(form.closest('[id]')?.id||'')?'kick':'google';form.dataset.ps27OriginalId=oldId;if(oldId)form.id=`ps27Complete-${form.dataset.ps27Provider}`;dateControl(form);$$('input[type="password"]',form).forEach(decoratePassword)}
  function validAdult(value){const date=new Date(`${value}T00:00:00`);if(Number.isNaN(date.getTime()))return false;const now=new Date();let years=now.getFullYear()-date.getFullYear();const m=now.getMonth()-date.getMonth();if(m<0||(m===0&&now.getDate()<date.getDate()))years--;return years>=18}
  function fieldValue(form,names){for(const name of names){const input=$(`[name="${name}"]`,form);if(input)return String(input.value??'')}return ''}
  async function submitCompletion(form){const password=fieldValue(form,['password','newPassword','pass']),repeat=fieldValue(form,['passwordRepeat','repeatPassword','password_confirmation','confirmPassword']),birthDate=fieldValue(form,['birthDate','dateOfBirth','birthday']);if(!password||!repeat){setError(form,'Şifre ve şifre tekrar alanlarını doldur.');return}if(password!==repeat){setError(form,'Şifreler aynı değil. İki alana da aynı şifreyi yaz.');return}if(!validAdult(birthDate)){setError(form,'Devam etmek için doğum tarihini girmen ve en az 18 yaşında olman gerekir.');return}setError(form,'');const button=$('button[type="submit"],.ps30-submit',form);if(button){button.disabled=true;button.dataset.ps27Text=button.textContent;button.textContent='Kaydediliyor…'}try{const result=await api(form.dataset.ps27Provider==='kick'?'/api/auth/complete-kick-profile':'/api/auth/complete-google-profile',{username:fieldValue(form,['username','userName']).trim(),password,passwordRepeat:repeat,birthDate});const state=read();state.settings||={};state.settings.userSession=token();state.settings.user=result.user;if(typeof state.settings.rememberUser!=='boolean')state.settings.rememberUser=false;write(state);history.replaceState(null,'',location.pathname+location.search);location.replace(location.pathname+location.search)}catch(error){setError(form,error.message)}finally{if(button){button.disabled=false;button.textContent=button.dataset.ps27Text||'Hesabı tamamla'}}}
  function closePanel(node){if(!node||(node.hidden&&node.dataset.ps27Open!=='1')||node.dataset.ps27Closing==='1')return;node.dataset.ps27Closing='1';node.classList.remove('ps27-panel-opening');node.classList.add('ps27-panel-closing');setTimeout(()=>{node.hidden=true;node.dataset.ps27Open='0';node.classList.remove('ps27-panel-closing');delete node.dataset.ps27Closing},175)}
  function closePanels(){closePanel($('#ps20ConnectionPopover'));closePanel($('#ps20Menu'))}
  function place(button,panel){const r=button.getBoundingClientRect();panel.style.top=`${Math.round(r.bottom+9)}px`;panel.style.right=`${Math.max(12,Math.round(innerWidth-r.right))}px`;panel.style.left='auto'}
  function panel(selector){const id=String(selector).replace(/^#/,'');let node=document.getElementById(id);if(!node){node=document.createElement('aside');node.id=id;node.hidden=true;document.body.append(node)}return node}
  function kickStatus(){const s=settings(),u=s.user||{};const connected=Boolean(u.kickConnected||u.kick_connected||u.kickId||u.kick_id);return {connected,copy:connected?(s.kickAccount?.username?`@${s.kickAccount.username}`:'Kick hesabın bağlı'):'Bağlantı kurmak için Kick hesabınla devam et'}}
  function openConnection(button){const node=panel('#ps20ConnectionPopover');if(node.dataset.ps27Open==='1'){closePanel(node);return}closePanel($('#ps20Menu'));const kick=kickStatus();node.innerHTML=`<header class="ps21-connection-head">BAĞLANTI DURUMU</header><div class="ps21-connection-list"><article class="ps21-connection-card"><span class="ps21-platform-logo kick">K</span><span class="ps21-connection-copy"><b>Kick</b><small>${esc(kick.copy)}</small></span>${kick.connected?'<i class="ps21-connection-state">✓</i>':'<button class="ps22-connect-kick" type="button" aria-label="Kick bağlantısı kur">→</button>'}</article></div>`;place(button,node);node.hidden=false;node.dataset.ps27Open='1';node.classList.remove('ps27-panel-closing');node.classList.add('ps27-panel-opening');$('.ps22-connect-kick',node)?.addEventListener('click',()=>{closePanel(node);sessionStorage.setItem('play-streamers-account-flow','kick');location.assign(`${API}/auth/kick/login`)})}
  function signOut(){const s=read(),session=s.settings?.userSession||'';fetch(API+'/api/auth/logout',{method:'POST',headers:session?{Authorization:`Bearer ${session}`}:{}}).catch(()=>{});clearClient(false);location.replace(location.pathname+location.search)}
  function openMenu(button){const node=panel('#ps20Menu');if(node.dataset.ps27Open==='1'){closePanel(node);return}closePanel($('#ps20ConnectionPopover'));node.innerHTML='<button type="button" data-ps27-menu="account">Hesabım</button><button type="button" data-ps27-menu="updates">Güncelleme notları</button><button type="button" data-ps27-menu="products">Ürünlerimiz</button><button type="button" class="danger" data-ps27-menu="logout">Çıkış yap</button>';place(button,node);node.hidden=false;node.dataset.ps27Open='1';node.classList.remove('ps27-panel-closing');node.classList.add('ps27-panel-opening');$$('[data-ps27-menu]',node).forEach(item=>item.onclick=()=>{const action=item.dataset.ps27Menu;closePanel(node);if(action==='logout')return signOut();if(action==='updates')return $('#psMenuUpdates,#menuUpdatesFull,#ps20Updates')?.click();if(action==='account')return $('#psMenuAccount,#menuAccountFull')?.click();if(action==='products')return $('#ps20Updates')?.click()})}
  // Earlier historical layers also listen for click events on these same IDs.
  // On pointer-up we briefly give the pressed control the popover's ID. The
  // old handlers therefore treat the following compatibility click as already
  // inside a popover and cannot immediately close the panel we just opened.
  function shieldLegacyClick(button,popoverId){const original=button.id;const release=()=>{if(button.id!==original)return;button.id=popoverId;requestAnimationFrame(()=>{button.id=original})};window.addEventListener('pointerup',release,{capture:true,once:true});setTimeout(()=>{if(button.id===popoverId)button.id=original},800)}
  function showLoaderThen(action){if(typeof window.ps28Load==='function'){window.ps28Load(action);return}const loaders=$$('#ps20Loader,.ps14-loader');loaders.forEach(node=>node.classList.add('show'));let done=false;const finish=()=>{if(done)return;done=true;action()};const video=$('.ps22-loading-video');if(video){video.currentTime=0;video.addEventListener('ended',finish,{once:true});video.play().catch(()=>setTimeout(finish,700))}else setTimeout(finish,700);setTimeout(finish,9000)}
  function clearClient(removeAll=true){if(removeAll){Object.keys(localStorage).filter(key=>key==='play-streamers-v17-site'||key.startsWith('play-streamers-')||key.startsWith('ps-second')||key.startsWith('ps-signed')).forEach(key=>localStorage.removeItem(key))}else{const state=read();state.settings||={};delete state.settings.userSession;delete state.settings.user;state.settings.rememberUser=false;write(state)}Object.keys(sessionStorage).filter(key=>key.includes('play-streamers')||key.includes('ps-second')||key.includes('ps-dashboard')||key.includes('ps-signed')).forEach(key=>sessionStorage.removeItem(key))}
  function resendControl(host,request){let button=$('.ps27-resend,[data-resend]',host);if(button?.dataset.ps27Resend==='1')return;const existing=Boolean(button);if(!button){button=document.createElement('button');button.type='button';button.className='ps27-resend';const destination=$('.ps27-dialog-actions',host)||$('form',host)||host;destination.before(button)}button.dataset.ps27Resend='1';button.classList.add('ps27-resend');let remaining=40,interval=0;const update=()=>{button.disabled=remaining>0;button.textContent=remaining>0?`Kodu tekrar gönder (${remaining} sn)`:'Kodu tekrar gönder'};const begin=()=>{clearInterval(interval);remaining=40;update();interval=setInterval(()=>{remaining--;update();if(remaining<=0)clearInterval(interval)},1000)};begin();button.onclick=async()=>{try{await request();begin()}catch(error){const errorNode=$('.ps27-dialog-error,.ps14-error,.psmail-error',host);if(errorNode)errorNode.textContent=error.message||'Kod tekrar gönderilemedi.'}};if(existing)button.removeAttribute('data-resend')}
  function codeDialog(options){const layer=document.createElement('section');layer.className='ps27-dialog-layer';layer.innerHTML=`<article class="ps27-dialog"><button type="button" class="ps27-dialog-close" aria-label="Kapat">×</button><span class="ps27-kicker">E-POSTA DOĞRULAMA</span><h2>${esc(options.title)}</h2><p>${esc(options.copy)}</p><form class="ps27-code-form"><label>Doğrulama kodu<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required></label><p class="ps27-dialog-error" aria-live="polite"></p><div class="ps27-dialog-actions"><button class="ps27-cancel" type="button">Vazgeç</button><button class="${options.danger?'ps27-danger':'ps27-confirm'}" type="submit">${esc(options.confirmText||'Onayla')}</button></div></form></article>`;document.body.append(layer);const close=()=>{layer.style.opacity='0';setTimeout(()=>layer.remove(),160)};$('.ps27-dialog-close',layer).onclick=close;$('.ps27-cancel',layer).onclick=close;layer.onclick=e=>{if(e.target===layer)close()};resendControl(layer,options.resend);$('form',layer).onsubmit=async event=>{event.preventDefault();const error=$('.ps27-dialog-error',layer),code=$('[name="code"]',layer).value.replace(/\s/g,'');if(!/^\d{6}$/.test(code)){error.textContent='E-postana gelen 6 haneli kodu gir.';return}try{await options.verify(code);close();options.success?.()}catch(failure){error.textContent=failure.message||'Kod doğrulanamadı.'}};return layer}
  async function beginDelete(){try{const result=await api('/api/account/request-delete',{});codeDialog({title:'Hesabını sil',copy:`${result.email||'Bağlı e-posta adresin'} adresine gelen kodu gir. Kod 10 dakika geçerli kalır; bu ekranı kapatsan da tekrar kullanabilirsin.`,danger:true,confirmText:'Hesabı kalıcı olarak sil',resend:()=>api('/api/account/request-delete',{forceResend:true}),verify:code=>api('/api/account/delete',{code}),success:()=>{clearClient(true);showLoaderThen(()=>location.replace(location.pathname+location.search))}})}catch(error){window.alert(error.message||'Hesap silme kodu gönderilemedi.')}}
  function showEmailSuccess(){const layer=document.createElement('section');layer.className='ps27-dialog-layer';layer.innerHTML='<article class="ps27-dialog"><span class="ps27-kicker">E-POSTA GÜNCELLENDİ</span><h2>Yeni e-posta adresin doğrulandı.</h2><p>Hesap bildirimleri ve güvenlik kodları artık yeni e-posta adresine gönderilecek.</p><div class="ps27-dialog-actions"><button class="ps27-confirm" type="button">Tamam</button></div></article>';document.body.append(layer);$('.ps27-confirm',layer).onclick=()=>{layer.remove();location.reload()}}
  async function submitEmailChange(form){const email=$('[name="email"]',form)?.value.trim()||'',currentPassword=$('[name="currentPassword"]',form)?.value||'';try{await api('/api/account/request-email-change',{email,currentPassword});codeDialog({title:'Yeni e-postanı doğrula',copy:`${email} adresine bir doğrulama kodu gönderdik.`,resend:()=>api('/api/account/resend-code',{purpose:'email_change',forceResend:true}),verify:code=>api('/api/auth/verify-email',{email,code,purpose:'email_change'}),success:showEmailSuccess})}catch(error){setError(form,error.message)}}
  function completionListener(event){const form=event.target instanceof HTMLFormElement?event.target:null;if(!form||!isCompletionForm(form))return;prepareCompletion(form);event.preventDefault();event.stopImmediatePropagation();submitCompletion(form)}
  function formListener(event){const form=event.target instanceof HTMLFormElement?event.target:null;if(!form)return;if(form.matches('#psEmailForm,#emailChangeForm')){event.preventDefault();event.stopImmediatePropagation();submitEmailChange(form)}}
  function decorateLegacyCodeLayers(){$$('#psEmailFlow,.ps14-dialog-backdrop').forEach(layer=>{if(layer.dataset.ps27Codes==='1'||!$('[name="code"]',layer))return;layer.dataset.ps27Codes='1';const text=layer.textContent||'';const email=(text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)||[])[0]||'';let resend=null;if(/şifre sıfırlama/i.test(text)&&email)resend=()=>api('/api/auth/request-password-reset',{email},'');else if(/şifre değiş/i.test(text))resend=()=>api('/api/account/resend-code',{purpose:'password_change',forceResend:true});else if(/hesab(?:ını|ı)\s*sil/i.test(text))resend=()=>api('/api/account/request-delete',{forceResend:true});else if(/e-posta değiş/i.test(text))resend=()=>api('/api/account/resend-code',{purpose:'email_change',forceResend:true});else if(/e-posta/i.test(text)&&email)resend=()=>api('/api/auth/request-email-verification',{forceResend:true});if(resend)resendControl(layer,resend);$$('input[type="password"]',layer).forEach(decoratePassword)})}
  function refreshSecondHome(){const current=token();if(!current)return;fetch(API+'/api/auth/session',{headers:{Authorization:`Bearer ${current}`}}).then(r=>r.ok?r.json():null).then(data=>{if(!data?.signedIn||!data.user)return;const state=read();state.settings||={};state.settings.userSession=current;state.settings.user=data.user;write(state);const home=$('#psSecondHome');if(!home)return;const emailOn=Boolean(data.user.googleConnected||data.user.emailLinked),kickOn=Boolean(data.user.kickConnected||data.user.kick_connected||data.user.kickId||data.user.kick_id);$$('.ps20-connection',home).forEach(row=>{const name=$('b',row)?.textContent||'';const on=/gmail/i.test(name)?emailOn:/kick/i.test(name)?kickOn:null;if(on===null)return;const icon=$('.ps20-status',row);if(icon){icon.textContent=on?'✓':'×';icon.classList.toggle('off',!on)}const label=$('b',row);if(label)label.textContent=/gmail/i.test(name)?`Gmail hesabı ${on?'bağlı':'bağlı değil'}`:`Kick hesabı ${on?'bağlı':'bağlı değil'}`;const note=$('small',row);if(note)note.textContent=/gmail/i.test(name)?(on?(data.user.email||'Gmail hesabın bağlı'):'Henüz Gmail bağlantısı yok'):(on?'Kick hesabın bağlı':'Henüz Kick bağlantısı yok')})}).catch(()=>{})}
  function authMode(button){const form=button.closest('form');return form&&$('[name="identity"]',form)?'login':'register'}
  function socialButton(provider){const node=document.createElement('button');node.type='button';node.className=`ps27-social ps27-social-${provider}`;node.dataset.ps27Social=provider;node.setAttribute('aria-label',provider==='google'?'Google ile devam et':'Kick ile devam et');node.title=node.getAttribute('aria-label');node.innerHTML=provider==='google'?'G':'K';return node}
  function decorateSocialButtons(){$$('form.auth-form,#landingAuthForm,#standaloneAuthForm').forEach(form=>{let row=$('.ps27-social-row,.ps55-provider-pair',form);if(!row){row=document.createElement('div');row.className='ps27-social-row';const existing=$('#modalGoogle,.google-button',form);if(existing){existing.classList.add('ps27-social','ps27-social-google');existing.dataset.ps27Social='google';existing.setAttribute('aria-label','Google ile devam et');existing.title='Google ile devam et';existing.textContent='G';row.append(existing)}else row.append(socialButton('google'));const divider=$('.auth-divider',form);(divider||form.lastElementChild).after(row)}})}
  function startSocial(provider,button){const mode=authMode(button),form=button.closest('form'),remember=$('[name="remember"]',form||document)?.checked===true;sessionStorage.setItem('ps-remember-intent',remember?'1':'0');sessionStorage.setItem('psRememberChoice',remember?'1':'0');sessionStorage.setItem('ps48RememberChoice',remember?'1':'0');sessionStorage.setItem('psCurrentSession','1');sessionStorage.setItem('ps48CurrentVisit','1');sessionStorage.setItem('ps-signed-in-now','1');const path=provider==='kick'?'/auth/kick/account-login':'/auth/google/login';location.assign(`${API}${path}?mode=${mode}&remember=${remember?'1':'0'}`)}
  // DOM repairs run after visual changes. Keep this local-only: calling the
  // account API from a MutationObserver creates an avoidable request loop.
  function repair(){ $$('form').forEach(form=>{if(isCompletionForm(form))prepareCompletion(form)}); $$('input[type="password"]').forEach(decoratePassword);decorateSocialButtons();decorateLegacyCodeLayers() }
  let lastPointer=0;
  window.addEventListener('pointerdown',event=>{const target=event.target instanceof Element?event.target:null;if(!target)return;const connection=target.closest('#ps20Connection'),menu=target.closest('#ps20MenuButton'),remove=target.closest('[data-ps14-delete],[data-ps15-delete]'),social=target.closest('[data-ps27-social]');if(connection||menu||remove||social){lastPointer=Date.now();event.preventDefault();event.stopImmediatePropagation();if(connection){if(typeof window.ps28OpenConnection==='function')window.ps28OpenConnection(connection);else{openConnection(connection);shieldLegacyClick(connection,'ps20ConnectionPopover')}}else if(menu){if(typeof window.ps28OpenMenu==='function')window.ps28OpenMenu(menu);else{openMenu(menu);shieldLegacyClick(menu,'ps20Menu')}}else if(remove)beginDelete();else startSocial(social.dataset.ps27Social,social);return}if(!target.closest('#ps20ConnectionPopover,#ps20Menu'))closePanels()},true);
  window.addEventListener('click',event=>{const target=event.target instanceof Element?event.target:null;if(!target)return;if((target.closest('#ps20Connection')||target.closest('#ps20MenuButton')||target.closest('[data-ps14-delete],[data-ps15-delete]')||target.closest('[data-ps27-social]'))&&Date.now()-lastPointer<750){event.preventDefault();event.stopImmediatePropagation()}},true);
  window.addEventListener('submit',completionListener,true);window.addEventListener('submit',formListener,true);window.addEventListener('pagehide',closePanels);window.addEventListener('visibilitychange',()=>{if(document.hidden)closePanels()});
  new MutationObserver(()=>requestAnimationFrame(repair)).observe(document.body,{childList:true,subtree:true});
  repair();refreshSecondHome();
  window.addEventListener('pageshow',()=>refreshSecondHome());
  window.addEventListener('focus',()=>refreshSecondHome());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSecondHome()});
})();

(() => {
  'use strict';
  const API='https://api.pstreamers.com';
  const KEY='play-streamers-v17-site';
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const esc=value=>{const node=document.createElement('span');node.textContent=String(value||'');return node.innerHTML};
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
  const session=()=>String(read().settings?.userSession||'');
  const eyeSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-5.5 9.5-5.5S21.5 12 21.5 12 18.2 17.5 12 17.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.7"/></svg>';

  document.body.classList.add('ps28-stable-loaders');

  function notify(title,message,kind='info'){
    let layer=$('#ps28NotificationLayer');
    if(!layer){layer=document.createElement('section');layer.id='ps28NotificationLayer';layer.setAttribute('aria-live','polite');document.body.append(layer)}
    const note=document.createElement('article');
    note.className='ps28-notification ps28-'+kind;
    const icon=kind==='error'?'!':kind==='success'?'✓':'i';
    note.innerHTML='<i class="ps28-notice-icon">'+icon+'</i><div><strong>'+esc(title)+'</strong><p>'+esc(message)+'</p></div><button type="button" aria-label="Bildirimi kapat">×</button>';
    const close=()=>{note.style.opacity='0';note.style.transform='translateY(10px) scale(.97)';setTimeout(()=>note.remove(),180)};
    $('button',note).onclick=close;layer.append(note);setTimeout(close,7000);return note;
  }
  window.psNotify=notify;

  let lastFault='';
  function reportFault(){
    const now=Date.now();if(now-Number(lastFault||0)<2500)return;lastFault=String(now);
    notify('İşlem tamamlanamadı','Beklenmeyen bir sorun oluştu. Lütfen işlemi tekrar dene.','error');
  }
  window.addEventListener('error',event=>{if(event?.error)reportFault()});
  window.addEventListener('unhandledrejection',()=>reportFault());

  let loaderBusy=false;
  let loaderNextAction=null;
  function loaderNode(){
    let node=$('#ps28Loader');
    if(node)return node;
    node=document.createElement('aside');node.id='ps28Loader';node.hidden=true;
    node.innerHTML='<div class="ps28-loader-card"><video muted playsinline preload="metadata" aria-label="Play Streamers yükleniyor"><source src="play-streamers-loading.webm" type="video/webm"></video><b>PLAY STREAMERS YÜKLENİYOR</b></div>';
    document.body.append(node);return node;
  }
  function loadThen(action){
    /* Açık bir yükleyicinin bitiş işlemi daha sonra gelen onarım çağrılarıyla
       değiştirilmemeli. Aksi halde asıl sayfa açma işlemi kaybolup bütün ana
       yüzeyler kapalı kalabiliyor. */
    if(document.documentElement.classList.contains('ps42-initial-loading')){
      window.ps53CloseFloatingSurfaces?.();
      try{if(typeof action==='function')action()}finally{window.psDismissInitialLoaderSafely?.()}
      return;
    }
    if(loaderBusy)return;
    loaderNextAction=typeof action==='function'?action:null;
    window.ps53CloseFloatingSurfaces?.();
    ['ps20ConnectionPopover','ps20Menu','psSecondMenu','connections','sideMenu','ps13MemberConnections','ps14MemberConnections','ps28DashboardConnection','ps28DashboardMenu','ps44HomeConnection','ps44HomeMenu'].forEach(id=>{const panel=document.getElementById(id);if(panel)panel.hidden=true});
    loaderBusy=true;
    const node=loaderNode(),video=$('video',node);
    document.documentElement.classList.remove('ps42-initial-loading');
    node.classList.remove('ps42-initial-loader','ps42-initial-leaving');
    node.hidden=false;node.classList.add('is-open');
    let finished=false;
    const finish=()=>{if(finished)return;finished=true;node.classList.remove('is-open');setTimeout(()=>{node.hidden=true;loaderBusy=false;const next=loaderNextAction;loaderNextAction=null;next?.()},210)};
    video.onended=finish;video.onerror=()=>setTimeout(finish,700);
    try{video.currentTime=0;const attempt=video.play();if(attempt?.catch)attempt.catch(()=>setTimeout(finish,800))}catch{setTimeout(finish,800)}
    setTimeout(finish,15000);
  }
  window.ps28Load=loadThen;

  function panel(id){
    let node=document.getElementById(id);
    if(!node){node=document.createElement('aside');node.id=id;node.hidden=true;document.body.append(node)}
    node.classList.add('ps28-panel');return node;
  }
  function closePanel(node){
    if(!node||node.hidden||node.dataset.ps28Closing==='1')return;
    node.dataset.ps28Closing='1';node.classList.remove('ps28-opening');node.classList.add('ps28-closing');
    setTimeout(()=>{node.hidden=true;node.classList.remove('ps28-closing');node.dataset.ps28Open='0';delete node.dataset.ps28Closing},180);
  }
  function closeAllPanels(except){
    ['ps20ConnectionPopover','ps20Menu','ps28DashboardConnection','ps28DashboardMenu'].forEach(id=>{const node=document.getElementById(id);if(node&&node!==except)closePanel(node)});
  }
  function placeUnder(button,node){
    const rect=button.getBoundingClientRect(),width=Math.min(312,innerWidth-24);
    const desiredRight=Math.max(12,Math.round(innerWidth-rect.right));
    const left=innerWidth-desiredRight-width;
    node.style.top=Math.round(Math.min(innerHeight-300,rect.bottom+9))+'px';
    node.style.left=Math.max(12,left)+'px';node.style.right='auto';
  }
  function openPanel(button,node,html){
    if(node.dataset.ps28Open==='1'){closePanel(node);return}
    closeAllPanels(node);node.innerHTML=html;placeUnder(button,node);node.hidden=false;node.dataset.ps28Open='1';node.classList.remove('ps28-closing');node.classList.add('ps28-opening');setTimeout(()=>node.classList.remove('ps28-opening'),220);
  }
  function shield(button,temporaryId){
    const original=button.id;
    const release=()=>{if(button.id!==original)return;button.id=temporaryId;requestAnimationFrame(()=>{if(button.id===temporaryId)button.id=original})};
    window.addEventListener('pointerup',release,{capture:true,once:true});
    setTimeout(()=>{if(button.id===temporaryId)button.id=original},650);
  }
  function kickInfo(){
    const state=read().settings||{},user=state.user||{};
    const connected=Boolean(user.kickConnected||user.kick_connected||user.kickId||user.kick_id);
    return {connected,copy:connected?(state.kickAccount?.username?'@'+state.kickAccount.username:'Kick hesabın bağlı'):'Bağlantı kurmak için Kick hesabınla devam et'};
  }
  function connectionHtml(){
    const state=read().settings||{},user=state.user||{};
    const gmail=Boolean(user.googleConnected||user.google_connected||user.googleId||user.google_id||user.provider==='google'||user.authProvider==='google');
    const kick=kickInfo(),action=kick.connected?'<i class="ps28-state">✓</i>':'<button type="button" class="ps28-platform-action" data-ps28-kick aria-label="Kick bağlantısı kur">→</button>';
    const gmailCopy=gmail?(user.email||'Gmail hesabın bağlı'):'Henüz Gmail bağlantısı yok';
    const gmailState=gmail?'<i class="ps28-state">✓</i>':'<i class="ps28-state off">×</i>';
    return '<span class="ps28-panel-title">HESAP BAĞLILIĞI</span><article class="ps28-platform-card"><i class="ps28-platform-mark">G</i><span class="ps28-platform-copy"><b>Gmail</b><small>'+esc(gmailCopy)+'</small></span>'+gmailState+'</article><article class="ps28-platform-card"><i class="ps28-platform-mark">K</i><span class="ps28-platform-copy"><b>Kick</b><small>'+esc(kick.copy)+'</small></span>'+action+'</article>';
  }
  function menuHtml(scope){
    return '<span class="ps28-panel-title">MENÜ</span><button type="button" class="ps28-menu-button" data-ps28-action="account">Hesabım</button><button type="button" class="ps28-menu-button" data-ps28-action="updates">Güncelleme notları</button><button type="button" class="ps28-menu-button" data-ps28-action="products">Ürünlerimiz</button><button type="button" class="ps28-menu-button ps28-danger" data-ps28-action="logout">Çıkış yap</button>';
  }
  function connectKick(node){
    closePanel(node);sessionStorage.setItem('play-streamers-account-flow','kick');location.assign(API+'/auth/kick/account-login?mode=login');
  }
  function openConnection(button){
    $('#sideMenu')?.setAttribute('hidden','');
    const node=panel('ps20ConnectionPopover');
    openPanel(button,node,connectionHtml());
    $('[data-ps28-kick]',node)?.addEventListener('click',()=>connectKick(node));
    shield(button,'ps20ConnectionPopover');
  }
  function openMenu(button){
    $('#sideMenu')?.setAttribute('hidden','');
    const node=panel('ps20Menu');
    openPanel(button,node,menuHtml('home'));
    bindMenu(node);shield(button,'ps20Menu');
  }
  function openDashboardConnection(button){
    if(typeof window.ps44OpenConnection==='function'){window.ps44OpenConnection(button,'dashboard');return}
    $('#connections')?.setAttribute('hidden','');
    const node=panel('ps28DashboardConnection');
    openPanel(button,node,connectionHtml());
    $('[data-ps28-kick]',node)?.addEventListener('click',()=>connectKick(node));
    shield(button,'ps28DashboardConnection');
  }
  function openDashboardMenu(button){
    if(typeof window.ps44OpenMenu==='function'){window.ps44OpenMenu(button,'dashboard');return}
    $('#sideMenu')?.setAttribute('hidden','');
    const node=panel('ps28DashboardMenu');
    openPanel(button,node,menuHtml('dashboard'));
    bindMenu(node);shield(button,'ps28DashboardMenu');
  }
  window.ps28OpenConnection=openConnection;
  window.ps28OpenMenu=openMenu;
  function publicUrl(){return location.origin==='null'?location.href.split('#')[0]:location.origin+location.pathname}
  function signOut(){
    if(!window.confirm('Hesabından çıkmak istediğine emin misin?'))return;
    const state=read(),current=String(state.settings?.userSession||'');
    fetch(API+'/api/auth/logout',{method:'POST',headers:current?{Authorization:'Bearer '+current}:{}}).catch(()=>{});
    Object.keys(localStorage).filter(key=>key==='play-streamers-v17-site'||key.startsWith('play-streamers-')||key.startsWith('ps-')).forEach(key=>localStorage.removeItem(key));
    Object.keys(sessionStorage).filter(key=>key.startsWith('play-streamers')||key.startsWith('ps-')).forEach(key=>sessionStorage.removeItem(key));
    closeAllPanels();loadThen(()=>location.replace(publicUrl()));
  }
  function bindMenu(node){
    $$('[data-ps28-action]',node).forEach(button=>button.addEventListener('click',event=>{
      event.preventDefault();const action=button.dataset.ps28Action;closePanel(node);
      if(action==='logout'){signOut();return}
      if(action==='updates'){const target=$('#psMenuUpdates,#menuUpdatesFull,#ps20Updates');if(target)target.click();else notify('Güncelleme notları','Sürüm notları menüden görüntülenebilir.');return}
      if(action==='account'){const target=$('#psMenuAccount,#menuAccountFull');if(target)target.click();else notify('Hesabım','Hesap ayarları kısa süre içinde açılacak.');return}
      const home=$('#psSecondHome');if(home){const target=$('#ps20Updates',home);if(target)target.click()}
    }));
  }

  function normalizeEyes(){
    $$('input[type="password"]').forEach(input=>{
      const host=input.parentElement;if(!host)return;
      host.querySelectorAll('.ps14-eye,.ps15-eye,.ps27-password-eye').forEach(button=>button.remove());
      host.classList.add('ps28-password-host');
      if(host.querySelector('.ps28-eye'))return;
      input.dataset.ps28Eye='1';
      const button=document.createElement('button');button.type='button';button.className='ps28-eye';button.setAttribute('aria-label','Şifreyi göster');button.innerHTML=eyeSvg;
      button.addEventListener('click',event=>{event.preventDefault();const visible=input.type==='text';input.type=visible?'password':'text';button.setAttribute('aria-label',visible?'Şifreyi göster':'Şifreyi gizle')});
      host.append(button);
    });
  }
  let eyeFrame=0;
  function queueEyes(){if(eyeFrame)return;eyeFrame=requestAnimationFrame(()=>{eyeFrame=0;normalizeEyes()})}

  function ensureDashboardRelease(){
    $$('#ps13DashboardRelease,#psDashboardRelease,#ps13DashboardHomeRelease,#ps28DashboardRelease,.ps12-home-release').forEach(node=>node.remove());
  }
  function showDashboard(){
    closeAllPanels();loadThen(()=>{
      sessionStorage.setItem('ps-second-dashboard','1');
      $('#psSecondHome')?.setAttribute('hidden','');
      const app=$('.app');if(!app)return;
      app.hidden=false;app.style.removeProperty('display');app.classList.add('ps13-dashboard');
      const panel=$('#panelView'),stats=$('#statsView');if(panel)panel.hidden=false;if(stats)stats.hidden=true;
      $$('.workspace-tabs button').forEach(button=>button.classList.toggle('active',button.dataset.view==='panel'));
      ensureDashboardRelease();window.scrollTo({top:0,behavior:'instant'});
    });
  }
  function switchDashboardView(name){
    const panel=$('#panelView'),stats=$('#statsView');if(!panel||!stats)return;
    const entering=name==='stats'?stats:panel,leaving=name==='stats'?panel:stats;
    leaving.hidden=true;leaving.classList.remove('ps28-view-enter','ps28-from-left');
    entering.hidden=false;entering.classList.remove('ps28-view-enter','ps28-from-left');
    entering.classList.add('ps28-view-enter');if(name==='panel')entering.classList.add('ps28-from-left');
    requestAnimationFrame(()=>setTimeout(()=>entering.classList.remove('ps28-view-enter','ps28-from-left'),260));
    $$('.workspace-tabs button').forEach(button=>button.classList.toggle('active',button.dataset.view===name));
  }
  function dashboardControls(){
    const app=$('.app');if(!app)return;
    const connection=$('#connectionBtn'),menu=$('#menuBtn');
    if(connection){connection.title='Bağlantı durumu';connection.setAttribute('aria-label','Bağlantı durumu')}
    if(menu)menu.title='Menü';
    ensureDashboardRelease();
  }

  let lastPress=0;
  window.addEventListener('pointerdown',event=>{
    const target=event.target instanceof Element?event.target:null;if(!target)return;
    const dash=target.closest('#ps17Dashboard'),dashConnection=target.closest('#connectionBtn'),dashMenu=target.closest('#menuBtn');
    if(dash){lastPress=Date.now();event.preventDefault();event.stopImmediatePropagation();showDashboard();return}
    if(dashConnection){lastPress=Date.now();event.preventDefault();event.stopImmediatePropagation();openDashboardConnection(dashConnection);return}
    if(dashMenu){lastPress=Date.now();event.preventDefault();event.stopImmediatePropagation();openDashboardMenu(dashMenu);return}
    if(!target.closest('#ps20ConnectionPopover,#ps20Menu,#ps28DashboardConnection,#ps28DashboardMenu'))closeAllPanels();
  },true);
  window.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;if(!target)return;
    if((target.closest('#ps17Dashboard,#connectionBtn,#menuBtn'))&&Date.now()-lastPress<800){event.preventDefault();event.stopImmediatePropagation()}
  },true);
  document.addEventListener('click',event=>{
    const button=event.target instanceof Element?event.target.closest('.workspace-tabs button[data-view]'):null;
    if(!button)return;event.preventDefault();event.stopImmediatePropagation();switchDashboardView(button.dataset.view);
  },true);
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;if(!target)return;
    if(target.closest('#ps17Dashboard')){event.preventDefault();event.stopImmediatePropagation();showDashboard()}
  },true);
  window.addEventListener('resize',()=>closeAllPanels());
  window.addEventListener('pagehide',()=>closeAllPanels());
  new MutationObserver(()=>{queueEyes();dashboardControls()}).observe(document.body,{childList:true,subtree:true});
  normalizeEyes();dashboardControls();window.addEventListener('pageshow',dashboardControls);
})();

(() => {
  const nativeFetch = window.fetch.bind(window);
  const sessionCache = new Map();
  const SESSION_PATH = '/api/auth/session';
  const CACHE_MS = 5 * 60 * 1000;

  const getUrl = input => typeof input === 'string' ? input : (input && input.url) || '';
  const getMethod = (input, init) => String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
  const getAuthorization = (input, init) => {
    try {
      const headers = (init && init.headers) || (input && input.headers);
      return headers ? new Headers(headers).get('authorization') || '' : '';
    } catch { return ''; }
  };

  window.fetch = function protectedFetch(input, init) {
    const url = getUrl(input);
    if (!url.includes(SESSION_PATH) || getMethod(input, init) !== 'GET') {
      return nativeFetch(input, init);
    }

    const key = `${url}|${getAuthorization(input, init)}`;
    const now = Date.now();
    const saved = sessionCache.get(key);
    if (saved && saved.response && saved.expiresAt > now) {
      return Promise.resolve(saved.response.clone());
    }
    if (saved && saved.pending) {
      return saved.pending.then(response => response.clone());
    }

    const pending = nativeFetch(input, init).then(response => {
      if (response.ok) {
        sessionCache.set(key, { response: response.clone(), expiresAt: Date.now() + CACHE_MS });
      } else {
        sessionCache.delete(key);
      }
      return response;
    }).catch(error => {
      sessionCache.delete(key);
      throw error;
    });
    sessionCache.set(key, { pending, expiresAt: now + CACHE_MS });
    return pending;
  };
})();

(() => {
  const API = 'https://api.pstreamers.com';
  const protectedPaths = new Set([
    '/api/auth/register', '/api/auth/login', '/api/auth/request-email-verification',
    '/api/auth/verify-email', '/api/auth/request-password-reset', '/api/auth/reset-password',
    '/api/auth/complete-google-profile', '/api/auth/complete-kick-profile', '/api/account/update-email',
    '/api/account/request-email-change', '/api/account/request-password-change',
    '/api/account/confirm-password-change', '/api/account/update-password', '/api/account/request-delete',
    '/api/account/resend-code', '/api/account/delete'
  ]);
  const nativeFetch = window.fetch.bind(window);
  const state = { enabled: false, siteKey: '', widgetId: null, ready: null, pending: null };

  // Turnstile's script "load" event can fire slightly before its render API is
  // ready.  Waiting for render() prevents intermittent first-click failures.
  function waitForTurnstile(resolve, reject) {
    let attempts = 0;
    const check = () => {
      if (window.turnstile && typeof window.turnstile.render === 'function') {
        try {
          if (typeof window.turnstile.ready === 'function') {
            window.turnstile.ready(() => resolve());
          } else {
            resolve();
          }
        } catch { resolve(); }
        return;
      }
      if (attempts++ >= 100) {
        reject(new Error('Güvenlik doğrulaması yüklenemedi. Lütfen reklam engelleyiciyi kapatıp tekrar dene.'));
        return;
      }
      setTimeout(check, 100);
    };
    check();
  }

  function loadScript() {
    if (window.turnstile && typeof window.turnstile.render === 'function') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const finish = () => waitForTurnstile(resolve, reject);
      const old = document.querySelector('script[data-ps32-turnstile]');
      if (old) {
        old.addEventListener('load', finish, { once: true });
        old.addEventListener('error', () => reject(new Error('Güvenlik doğrulaması yüklenemedi.')), { once: true });
        finish();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = false;
      script.dataset.ps32Turnstile = '1';
      script.onload = finish;
      script.onerror = () => reject(new Error('Güvenlik doğrulaması yüklenemedi. Lütfen bağlantını kontrol et.'));
      document.head.append(script);
    });
  }

  async function configure() {
    try {
      const response = await nativeFetch(`${API}/api/public-config`, { cache: 'no-store' });
      const config = await response.json().catch(() => ({}));
      if (!response.ok || !config.turnstileEnabled || !config.turnstileSiteKey) return;
      state.siteKey = config.turnstileSiteKey;
      // The visible login verifier and the background verifier must use the
      // same key. This small public object only contains the public site key.
      window.__psTurnstileConfig = { enabled: true, siteKey: state.siteKey };
      await loadScript();
      let host = document.getElementById('ps32-turnstile-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'ps32-turnstile-host';
        host.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;min-height:65px';
        document.body.append(host);
      }
      state.widgetId = window.turnstile.render(host, {
        sitekey: state.siteKey,
        theme: 'dark',
        size: 'invisible',
        appearance: 'interaction-only',
        callback(token) { if (state.pending) state.pending.resolve(token); state.pending = null; },
        'error-callback'() { if (state.pending) state.pending.reject(new Error('Güvenlik kontrolü yüklenemedi.')); state.pending = null; },
        'expired-callback'() { if (state.pending) state.pending.reject(new Error('Güvenlik doğrulamasının süresi doldu.')); state.pending = null; },
      });
      state.enabled = true;
    } catch (error) {
      console.warn('Turnstile yapılandırması yüklenemedi.', error);
    }
  }

  async function getToken() {
    if (!state.enabled) return null;
    if (!window.turnstile || state.widgetId === null) throw new Error('Güvenlik doğrulaması henüz hazır değil. Lütfen birkaç saniye sonra tekrar dene.');
    if (state.pending) throw new Error('Devam eden bir güvenlik doğrulaması var. Lütfen bekle.');
    return new Promise((resolve, reject) => {
      state.pending = { resolve, reject };
      try { window.turnstile.reset(state.widgetId); window.turnstile.execute(state.widgetId); }
      catch (error) { state.pending = null; reject(error); }
    });
  }

  function isProtectedRequest(input, init) {
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (method !== 'POST') return false;
    const value = typeof input === 'string' ? input : (input && input.url) || '';
    try { return protectedPaths.has(new URL(value, location.href).pathname); }
    catch { return false; }
  }

  window.fetch = async function turnstileFetch(input, init = {}) {
    const protectedRequest = isProtectedRequest(input, init);
    // The public configuration is requested as soon as the page opens. Waiting
    // for that one request means a very fast click on "Giriş yap" can never
    // bypass the client token and be rejected by the Worker unnecessarily.
    if (protectedRequest && state.ready) await state.ready;
    if (!state.enabled || !protectedRequest) return nativeFetch(input, init);
    try {
      const headers = new Headers(init.headers || (input && input.headers) || {});
      headers.set('content-type', headers.get('content-type') || 'application/json');
      const raw = init.body || '{}';
      let body = {};
      try { body = typeof raw === 'string' ? JSON.parse(raw || '{}') : {}; } catch { body = {}; }
      // If a visible widget has already given us a token, preserve it instead
      // of triggering a second invisible verification during the same login.
      let token = String(body.turnstileToken || headers.get('X-Turnstile-Token') || '').trim();
      if (!token) token = await getToken();
      if (!token) throw new Error('Güvenlik doğrulaması tamamlanamadı.');
      body.turnstileToken = token;
      // Keep the token in a header too.  This gives the Worker a reliable
      // fallback if a browser extension or intermediary alters a JSON body.
      headers.set('X-Turnstile-Token', token);
      return nativeFetch(input, { ...init, headers, body: JSON.stringify(body) });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message || 'Güvenlik doğrulaması tamamlanamadı.' }), {
        status: 503, headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    }
  };

  state.ready = configure();
  window.ps32RequestTurnstileToken = async () => {
    if (state.ready) await state.ready;
    return state.enabled ? getToken() : null;
  };
})();

(() => {
  const LEGACY_API = 'https://api.pstreamers.com';
  const API = 'https://api.pstreamers.com';
  const STORE_KEY = 'play-streamers-v17-site';
  const SEEN_KEY = 'play-streamers-kick-live-event-ids-v1';
  const STREAM_START_KEY = 'play-streamers-kick-stream-start-v1';
  const ACTIVE_BROADCASTER_KEY = 'play-streamers-kick-active-broadcaster-v1';
  // Canlı olaylar yalnızca Dashboard görünürken kontrol edilir. Eski 25 saniyelik
  // sorgu, açık kalan bir sekmenin tek başına günde yüzlerce Worker çağrısı
  // üretmesine neden oluyordu. İki dakikalık aralık canlı kullanım için yeterli,
  // boşta kalan hesaplar için ise çok daha hafiftir.
  const POLL_MS = 120_000;

  // Old interface modules are intentionally kept alive. This small bridge sends
  // their existing API calls to the protected custom API domain without
  // changing each legacy module one by one.
  const previousFetch = window.fetch.bind(window);
  window.fetch = function playStreamersApiDomain(input, init) {
    const replaceUrl = (value) => typeof value === 'string' && value.startsWith(LEGACY_API)
      ? API + value.slice(LEGACY_API.length)
      : value;
    if (typeof input === 'string') return previousFetch(replaceUrl(input), init);
    if (input instanceof Request && input.url.startsWith(LEGACY_API)) {
      return previousFetch(new Request(replaceUrl(input.url), input), init);
    }
    return previousFetch(input, init);
  };

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch { return fallback; }
  }
  function eventTime(value) {
    const time = Date.parse(value || '');
    return Number.isFinite(time) ? time : Date.now();
  }
  function seenIds() {
    const ids = readJson(SEEN_KEY, []);
    return Array.isArray(ids) ? ids : [];
  }
  function saveSeen(ids) {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-500)));
  }
  function kickUrl(account) {
    const username = String(account?.username || '').trim();
    return username ? `https://kick.com/${encodeURIComponent(username)}` : 'https://kick.com';
  }
  function mapEvent(event, account) {
    const payload = event?.payload || {};
    const at = eventTime(event.occurredAt || event.receivedAt);
    if (event.type === 'channel.followed') {
      const person = payload.follower || {};
      const name = person.username || 'Yeni takipçi';
      return {
        type: 'follower', id: `kick:${event.id}`, name,
        message: `${name}, kanalı takip etmeye başladı.`,
        sourceUrl: kickUrl(account), at,
      };
    }
    if (event.type === 'channel.subscription.new' || event.type === 'channel.subscription.renewal') {
      const person = payload.subscriber || {};
      const name = person.username || 'Yeni abone';
      const months = Math.max(1, Number(payload.duration || 1));
      return {
        type: 'subscription', id: `kick:${event.id}`, name, months,
        message: event.type.endsWith('.renewal')
          ? `${name}, aboneliğini ${months}. aya yeniledi.`
          : `${name}, ${months} aylık abone oldu.`,
        sourceUrl: kickUrl(account), at,
      };
    }
    if (event.type === 'channel.subscription.gifts') {
      const person = payload.gifter || {};
      const name = person.username || 'Anonim izleyici';
      const count = Array.isArray(payload.giftees) ? payload.giftees.length : 1;
      return {
        type: 'gift', id: `kick:${event.id}`, name, count: Math.max(1, count),
        message: `${name}, ${Math.max(1, count)} kişiye hediye abonelik gönderdi.`,
        sourceUrl: kickUrl(account), at,
      };
    }
    if (event.type === 'kicks.gifted') {
      const person = payload.sender || {};
      const gift = payload.gift || {};
      const name = person.username || 'Anonim izleyici';
      const amount = Math.max(0, Number(gift.amount || 0));
      return {
        type: 'kicks', id: `kick:${event.id}`, name, amount,
        message: gift.message || (gift.name ? `${gift.name} gönderdi.` : 'Kicks gönderdi.'),
        sourceUrl: kickUrl(account), at,
      };
    }
    return null;
  }
  function installBroadcastGuard() {
    if (!window.PlayStreamers || window.PlayStreamers.__liveEventGuard) return;
    const start = window.PlayStreamers.startBroadcast;
    if (typeof start !== 'function') return;
    window.PlayStreamers.startBroadcast = function startNewBroadcast() {
      localStorage.setItem(STREAM_START_KEY, String(Date.now()));
      localStorage.removeItem(SEEN_KEY);
      return start.apply(this, arguments);
    };
    window.PlayStreamers.__liveEventGuard = true;
  }
  let syncing = false;
  function dashboardIsActive() {
    const dashboard = document.querySelector('.app');
    const memberHome = document.querySelector('#psSecondHome');
    if (!dashboard || dashboard.hidden || (memberHome && !memberHome.hidden)) return false;
    return window.getComputedStyle(dashboard).display !== 'none';
  }
  async function syncKickEvents() {
    // Arka plandaki sekmelerde canlı olay sorgusu gerekmez. Kullanıcı sekmeye
    // döndüğünde hemen tek bir yenileme yapılır; boşuna Worker isteği oluşmaz.
    if (document.visibilityState !== 'visible' || navigator.onLine === false || !dashboardIsActive()) return;
    if (syncing || !window.PlayStreamers?.addEvent) return;
    const state = readJson(STORE_KEY, null);
    const token = state?.settings?.kickSession;
    if (!token) return;
    syncing = true;
    try {
      const response = await window.fetch(`${API}/api/kick/events`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = await response.json();
      const broadcasterId = String(data.broadcasterId || '');
      const previousBroadcasterId = localStorage.getItem(ACTIVE_BROADCASTER_KEY) || '';
      const accountChanged = Boolean(broadcasterId && broadcasterId !== previousBroadcasterId);
      if (accountChanged) {
        window.PlayStreamers.startBroadcast();
        localStorage.removeItem(STREAM_START_KEY);
        localStorage.removeItem(SEEN_KEY);
        localStorage.setItem(ACTIVE_BROADCASTER_KEY, broadcasterId);
      }
      const known = new Set(seenIds());
      const streamStartedAt = accountChanged ? 0 : Number(localStorage.getItem(STREAM_START_KEY) || 0);
      const additions = (Array.isArray(data.events) ? data.events : [])
        .filter((event) => !known.has(event.id))
        .filter((event) => !streamStartedAt || eventTime(event.occurredAt || event.receivedAt) >= streamStartedAt)
        .reverse();
      if (!additions.length) return;
      for (const event of additions) {
        known.add(event.id);
        const mapped = mapEvent(event, state.settings?.kickAccount);
        if (mapped) window.PlayStreamers.addEvent(mapped);
      }
      saveSeen([...known]);
    } catch (error) {
      console.warn('Kick canlı olayları eşitlenemedi.', error);
    } finally {
      syncing = false;
    }
  }
  installBroadcastGuard();
  window.setTimeout(syncKickEvents, 1800);
  window.setInterval(syncKickEvents, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') window.setTimeout(syncKickEvents, 350);
  });
  window.addEventListener('online', () => window.setTimeout(syncKickEvents, 350));
})();

(() => {
  'use strict';
  const API = 'https://api.pstreamers.com';
  const STORE = 'play-streamers-v17-site';
  const CURSOR_PREFIX = 'play-streamers-donate-connector-cursor:';
  const SEEN_PREFIX = 'play-streamers-donate-connector-seen:';
  // Only a visible signed-in page polls. A short 1.5s interval keeps the
  // extension -> Worker -> dashboard path responsive without background reads.
  const POLL_MS = 1500;
  const PROVIDER_URLS = {
    bynogame: 'https://donate.bynogame.com/',
    klasgame: 'https://www.klasgame.com/',
    streamlabs: 'https://streamlabs.com/dashboard',
    streamelements: 'https://streamelements.com/dashboard',
    pindirim: 'https://www.pindirim.com/',
    oyunfor: 'https://www.oyunfor.com/donate',
    itemsatis: 'https://www.itemsatis.com/',
    oyuneks: 'https://oyuneks.com/',
    hesap: 'https://hesap.com.tr/yayincilar',
    dijipin: 'https://www.dijipin.com/yayincilar',
    epin: 'https://epin.com.tr/',
    inovapin: 'https://www.inovapin.com/',
    livepix: 'https://livepix.gg/',
    saweria: 'https://saweria.co/',
    trakteer: 'https://trakteer.id/',
    sociabuzz: 'https://www.sociabuzz.com/tribelive',
    tipply: 'https://tipply.pl/',
    toonation: 'https://toon.at/',
    doneru: 'https://doneru.jp/'
  };
  let syncing = false;

  function readState() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; }
  }
  function userKeys(current) {
    const userId = String(current?.settings?.user?.id || current?.settings?.user?.email || '');
    return userId ? {
      cursor: `${CURSOR_PREFIX}${userId}`,
      seen: `${SEEN_PREFIX}${userId}`
    } : null;
  }
  function readSeen(key) {
    try {
      const rows = JSON.parse(localStorage.getItem(key) || '[]');
      return new Set(Array.isArray(rows) ? rows.slice(-1000) : []);
    } catch { return new Set(); }
  }
  function eventKey(event) {
    return `${event.providerId || ''}:${event.providerEventId || event.id || ''}`;
  }
  function sourceIcon(name) {
    const letters = String(name || 'D').replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '').slice(0, 2);
    return letters ? letters.toUpperCase() : '₺';
  }
  async function syncDonateEvents() {
    if (syncing || document.visibilityState !== 'visible' || navigator.onLine === false) return;
    if (!window.PlayStreamers?.addEvent) return;
    const current = readState();
    const token = String(current?.settings?.userSession || current?.userSession || '');
    const keys = userKeys(current);
    if (!token || !keys) return;
    syncing = true;
    try {
      let cursor = Number(localStorage.getItem(keys.cursor) || 0);
      const seen = readSeen(keys.seen);
      for (let page = 0; page < 4; page += 1) {
        const response = await window.fetch(`${API}/api/donate-bridge/events?after=${encodeURIComponent(cursor)}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) return;
        const result = await response.json();
        const events = Array.isArray(result.events) ? result.events : [];
        for (const event of events) {
          const key = eventKey(event);
          if (key && !seen.has(key)) {
            window.PlayStreamers.addEvent({
              id: `donate-connector:${event.id}`,
              type: 'donation',
              name: event.donorName || 'İsimsiz destekçi',
              amount: Number(event.amountMinor || 0) / 100,
              currency: event.currency || 'TRY',
              message: event.message || '',
              sourceIcon: sourceIcon(event.providerName),
              sourceName: event.providerName || 'Donate',
              sourceUrl: PROVIDER_URLS[event.providerId] || '',
              at: Number(event.eventAt || event.receivedAt || Date.now())
            });
            window.dispatchEvent(new CustomEvent('ps:donate-connector-updated', {
              detail: { providerId: event.providerId || '', receivedAt: Number(event.receivedAt || Date.now()) }
            }));
            if (key) seen.add(key);
          }
          cursor = Math.max(cursor, Number(event.receivedAt || 0));
        }
        localStorage.setItem(keys.cursor, String(Math.max(cursor, Number(result.nextAfter || 0))));
        localStorage.setItem(keys.seen, JSON.stringify([...seen].slice(-1000)));
        if (!result.hasMore || !events.length) break;
      }
    } catch (error) {
      console.warn('Donate Connector olayları eşitlenemedi.', error);
    } finally {
      syncing = false;
    }
  }
  window.setTimeout(syncDonateEvents, 800);
  window.setInterval(syncDonateEvents, POLL_MS);
  window.psSyncDonateEvents = syncDonateEvents;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') window.setTimeout(syncDonateEvents, 400);
  });
  window.addEventListener('focus', () => window.setTimeout(syncDonateEvents, 250));
  window.addEventListener('online', () => window.setTimeout(syncDonateEvents, 400));
})();

/*
 * The API still accepts the existing bearer token while older saved browser
 * sessions are being migrated. This wrapper also sends the safer first-party
 * HttpOnly session cookie and its CSRF companion on pstreamers.com.
 */
(() => {
  const apiOrigin = 'https://api.pstreamers.com';
  const originalFetch = window.fetch.bind(window);
  const readCookie = (name) => {
    const prefix = name + '=';
    const item = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
    return item ? item.slice(prefix.length) : '';
  };
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url;
    let target;
    try { target = new URL(url, window.location.href); } catch { return originalFetch(input, init); }
    if (target.origin !== apiOrigin) return originalFetch(input, init);
    const method = String(init.method || (typeof input !== 'string' ? input.method : 'GET') || 'GET').toUpperCase();
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !headers.has('Authorization')) {
      const csrf = readCookie('ps_csrf');
      if (csrf && !headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', csrf);
    }
    return originalFetch(input, { ...init, headers, credentials: 'include' });
  };
})();

(() => {
  const apiOrigin = 'https://api.pstreamers.com';
  const previousFetch = window.fetch.bind(window);
  const retryableStatuses = new Set([408, 429, 502, 503, 504]);
  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  window.fetch = async function playStreamersResilientFetch(input, init = {}) {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    let target;
    try { target = new URL(rawUrl, window.location.href); }
    catch { return previousFetch(input, init); }

    const requestMethod = typeof input === 'string' ? '' : input?.method;
    const method = String(init.method || requestMethod || 'GET').toUpperCase();
    const canRetry = target.origin === apiOrigin && (method === 'GET' || method === 'HEAD') && !init.signal;
    if (!canRetry) return previousFetch(input, init);

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await previousFetch(input, { ...init, signal: controller.signal });
        if (attempt === 0 && retryableStatuses.has(response.status)) {
          await wait(260);
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt === 1 || navigator.onLine === false) throw error;
        await wait(260);
      } finally {
        window.clearTimeout(timeout);
      }
    }
    throw lastError || new Error('API isteği tamamlanamadı.');
  };
})();

/* 1.9.3 — Tek yükleme ekranı + kalıcı oturum yönlendirmesi */
(() => {
  'use strict';

  const STORAGE_KEY = 'play-streamers-v17-site';
  const API_ORIGIN = 'https://api.pstreamers.com';
  let restoring = null;
  let lastRestoreAt = 0;
  let suppressBrandClickUntil = 0;

  const readState = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  };
  const writeState = (state) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (_) {}
  };
  const hasFinishedAccount = (state = readState()) => {
    const settings = state.settings || {};
    return Boolean(settings.user && !settings.user.needsCredentialSetup);
  };
  const appIsVisible = () => {
    const app = document.querySelector('.app');
    return Boolean(app && !app.hidden && getComputedStyle(app).display !== 'none');
  };

  /* Eski yükleyiciler CSS ile gizlenir; aktif tüm geçişler bu tek video
     yükleyicisini kullanır. Ortak isim, sonradan eklenen akışlar için de hazırdır. */
  window.psUnifiedLoad = (next) => {
    if (typeof window.ps28Load === 'function') return window.ps28Load(next);
    if (typeof next === 'function') next();
  };

  function prepareDashboardBrand() {
    const brand = document.querySelector('.app .topbar .brand');
    if (!brand || brand.dataset.ps37HomeLink === '1') return;
    brand.dataset.ps37HomeLink = '1';
    brand.setAttribute('role', 'button');
    brand.setAttribute('tabindex', '0');
    brand.setAttribute('aria-label', 'Kullanıcı ana sayfasına dön');
    brand.setAttribute('title', 'Kullanıcı ana sayfasına dön');
    brand.style.cursor = 'pointer';
  }

  function showMemberHome(useLoader = false) {
    if (!hasFinishedAccount()) return false;
    const reveal = () => {
      sessionStorage.removeItem('ps-second-dashboard');
      if (typeof window.ps53CloseFloatingSurfaces === 'function') window.ps53CloseFloatingSurfaces();
      const overlay = document.getElementById('authOverlay');
      const app = document.querySelector('.app');
      let home = document.getElementById('psSecondHome');

      /* Kayıtlı eski oturumlarda boş bir #psSecondHome kalabiliyor. Önce üye
         ekranını hazırla; başarılı olmadan giriş ekranını kapatma. */
      if ((!home || !home.innerHTML.trim()) && typeof window.__psClassicSecondHome === 'function') {
        try { window.__psClassicSecondHome(); } catch (_) {}
        home = document.getElementById('psSecondHome');
      }

      if (!home || !home.innerHTML.trim()) {
        if (app) {
          app.hidden = true;
          app.style.setProperty('display', 'none', 'important');
        }
        if (overlay) {
          overlay.hidden = false;
          overlay.removeAttribute('hidden');
          overlay.style.removeProperty('display');
          overlay.style.removeProperty('visibility');
        }
        document.body.classList.add('auth-locked');
        document.body.classList.remove('onboarding-locked');
        document.documentElement.classList.remove('ps15-session-pending');
        return false;
      }

      home.hidden = false;
      home.removeAttribute('hidden');
      home.style.removeProperty('display');
      home.style.removeProperty('visibility');
      if (overlay) overlay.setAttribute('hidden', '');
      document.body.classList.remove('auth-locked', 'onboarding-locked');
      if (app) {
        app.hidden = true;
        app.style.setProperty('display', 'none', 'important');
      }
      prepareDashboardBrand();
      window.scrollTo({ top: 0, behavior: 'instant' });
      return true;
    };

    if (useLoader) window.psUnifiedLoad(reveal);
    else reveal();
    return true;
  }

  async function restoreSignedInHome() {
    if (sessionStorage.getItem('ps48ForgetPending') === '1') {
      const home = document.getElementById('psSecondHome');
      const app = document.querySelector('.app');
      const overlay = document.getElementById('authOverlay');
      if (home) home.hidden = true;
      if (app) { app.hidden = true; app.style.setProperty('display', 'none', 'important'); }
      if (overlay) overlay.hidden = false;
      document.body.classList.add('auth-locked');
      return false;
    }
    const now = Date.now();
    if (restoring || now - lastRestoreAt < 800) return restoring;
    lastRestoreAt = now;

    const revealRestoredSurface = preferDashboard => {
      if (!preferDashboard) return showMemberHome(false);
      const home = document.getElementById('psSecondHome');
      const app = document.querySelector('.app');
      const overlay = document.getElementById('authOverlay');
      sessionStorage.setItem('ps-second-dashboard', '1');
      if (home) { home.hidden = true; home.style.setProperty('display', 'none', 'important'); }
      if (app) { app.hidden = false; app.style.removeProperty('display'); app.classList.add('ps13-dashboard'); }
      if (overlay) { overlay.hidden = true; overlay.style.setProperty('display', 'none', 'important'); }
      document.body.classList.remove('auth-locked');
      if (typeof window.ps53CloseFloatingSurfaces === 'function') window.ps53CloseFloatingSurfaces();
      return true;
    };

    restoring = (async () => {
      const restoreDashboard = sessionStorage.getItem('ps-second-dashboard') === '1';
      const state = readState();
      const settings = state.settings || {};
      /* Üye ekranı, oturum sunucuda doğrulanmadan gösterilmez. Böylece süresi
         dolmuş bir oturum ikinci ana sayfayı veya Dashboard'u kısa süreli açmaz. */
      const headers = { Accept: 'application/json' };
      if (settings.userSession) headers.Authorization = `Bearer ${settings.userSession}`;

      try {
        const response = await fetch(`${API_ORIGIN}/api/auth/session`, {
          method: 'GET',
          headers,
          credentials: 'include',
          cache: 'no-store'
        });
        const payload = await response.json().catch(() => null);
        if (response.ok && payload && payload.signedIn && payload.user) {
          const merged = readState();
          merged.settings = {
            ...(merged.settings || {}),
            user: payload.user
          };
          writeState(merged);
          if (!payload.user.needsCredentialSetup) revealRestoredSurface(restoreDashboard);
          return;
        }
        if (response.status === 401) {
          const expired = readState();
          expired.settings ||= {};
          delete expired.settings.userSession;
          delete expired.settings.user;
          delete expired.settings.rememberUntil;
          expired.settings.rememberUser = false;
          delete expired.userSession;
          writeState(expired);
          ['ps-second-dashboard','ps-signed-in-now','psCurrentSession','ps48CurrentVisit'].forEach(key => sessionStorage.removeItem(key));
          const home = document.getElementById('psSecondHome');
          const app = document.querySelector('.app');
          const overlay = document.getElementById('authOverlay');
          if (home) home.hidden = true;
          if (app) { app.hidden = true; app.style.setProperty('display', 'none', 'important'); }
          if (overlay) overlay.hidden = false;
          document.body.classList.add('auth-locked');
          return;
        }
      } catch (_) {
        /* Ağ kısa süreli yanıt vermezse kayıtlı, geçerli kullanıcıyı giriş ekranına atma. */
      }

      if (hasFinishedAccount(state)) revealRestoredSurface(restoreDashboard);
    })().finally(() => { restoring = null; });
    return restoring;
  }

  document.addEventListener('pointerdown', (event) => {
    const brand = event.target.closest && event.target.closest('.app .topbar .brand');
    if (!brand || !appIsVisible()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressBrandClickUntil = Date.now() + 900;
    showMemberHome(true);
  }, true);

  document.addEventListener('click', (event) => {
    const brand = event.target.closest && event.target.closest('.app .topbar .brand');
    if (brand && Date.now() < suppressBrandClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const brand = event.target.closest && event.target.closest('.app .topbar .brand');
    if (!brand || !appIsVisible()) return;
    event.preventDefault();
    showMemberHome(true);
  }, true);

  const boot = () => {
    prepareDashboardBrand();
    void restoreSignedInHome();
  };

  const surfaceIsVisible = (node) => {
    if (!node || node.hidden) return false;
    const style = getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
  };
  const transitionIsVisible = () => [
    document.getElementById('ps28Loader'),
    document.getElementById('ps20Loader'),
    document.getElementById('ps15SessionLoader')
  ].some(surfaceIsVisible);
  const rescueVisibleSurface = (attempt = 0) => {
    const home = document.getElementById('psSecondHome');
    const app = document.querySelector('.app');
    const overlay = document.getElementById('authOverlay');
    if (surfaceIsVisible(home) || surfaceIsVisible(app) || surfaceIsVisible(overlay)) return true;
    if (transitionIsVisible() && attempt < 2) {
      window.setTimeout(() => rescueVisibleSurface(attempt + 1), 1400);
      return false;
    }

    /* Hiçbir ana yüzey görünmüyorsa oturum verisini silmeden kamusal ana
       sayfayı geri getir. Böylece eski önbellek/oturum durumu boş ekrana dönmez. */
    if (home) home.hidden = true;
    if (app) {
      app.hidden = true;
      app.style.setProperty('display', 'none', 'important');
    }
    if (overlay) {
      overlay.hidden = false;
      overlay.removeAttribute('hidden');
      overlay.style.removeProperty('display');
      overlay.style.removeProperty('visibility');
      overlay.style.removeProperty('opacity');
    }
    document.documentElement.classList.remove('ps15-session-pending', 'ps42-initial-loading');
    document.body.classList.add('auth-locked');
    document.body.classList.remove('onboarding-locked');
    return false;
  };
  const scheduleSurfaceRescue = () => window.setTimeout(() => rescueVisibleSurface(), 5200);
  window.psRescueVisibleSurface = rescueVisibleSurface;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  if (document.readyState === 'complete') scheduleSurfaceRescue();
  else window.addEventListener('load', scheduleSurfaceRescue, { once: true });
  window.addEventListener('pageshow', () => { setTimeout(boot, 0); scheduleSurfaceRescue(); });
  let dashboardBrandQueued = false;
  new MutationObserver(() => {
    if (dashboardBrandQueued) return;
    dashboardBrandQueued = true;
    requestAnimationFrame(() => { dashboardBrandQueued = false; prepareDashboardBrand(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();

/* Hesap tamamlama ekranı yalnızca kimlik bilgilerini ister; sağlayıcı simgeleri
   burada yer almaz. Yaş doğrulaması sunucunun beklediği doğum tarihiyle yapılır. */
(() => {
  'use strict';
  const STORE = 'play-streamers-v17-site';
  const API = 'https://api.pstreamers.com';

  const adultDate = () => {
    const value = new Date();
    value.setFullYear(value.getFullYear() - 18);
    return value.toISOString().slice(0, 10);
  };
  const currentState = () => {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; }
    catch (_) { return {}; }
  };
  const clearSession = () => {
    const state = currentState();
    if (state.settings) {
      delete state.settings.userSession;
      delete state.settings.user;
      state.settings.rememberUser = false;
    }
    delete state.userSession;
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (_) {}
    ['ps-remember-intent', 'ps-signed-in-now', 'ps-second-dashboard'].forEach((key) => sessionStorage.removeItem(key));
  };
  const signOutFromCompletion = () => {
    const sessionId = currentState().settings?.userSession || '';
    if (sessionId) {
      fetch(`${API}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionId}` },
        credentials: 'include',
        keepalive: true
      }).catch(() => {});
    }
    const finish = () => {
      clearSession();
      location.replace(location.pathname + location.search);
    };
    if (typeof window.psUnifiedLoad === 'function') window.psUnifiedLoad(finish);
    else finish();
  };

  function addAgeField(form) {
    let input = form.querySelector('[name="birthDate"]');
    if (!input) {
      const field = document.createElement('label');
      field.className = 'auth-field ps38-completion-age';
      field.innerHTML = 'Doğum tarihi (18+)<input name="birthDate" type="date" required aria-label="Doğum tarihi">';
      const error = form.querySelector('.auth-error,.ps30-error,.ps14-error,.psmail-error');
      (error || form.lastElementChild).before(field);
      input = field.querySelector('input');
    }
    input.type = 'date';
    input.required = true;
    input.max = adultDate();
  }

  function polishCompletion(form) {
    if (!(form instanceof HTMLFormElement)) return;
    const isCompletion = form.id === 'ps30CompleteForm' || /^(googleProfileForm|kickProfileForm)$/i.test(form.id) || Boolean(form.closest('#ps15KickSetup')) || form.dataset.ps38DetectedCompletion === '1' || /hesabını tamamla/i.test(form.closest('section,div')?.textContent || '');
    if (!isCompletion) return;

    const dialog = form.closest('.ps30-dialog,.auth-dialog,#ps15KickSetup section,section') || form.parentElement;
    const provider = dialog?.querySelector('.ps30-kicker,.eyebrow,.ps-second-kicker');
    if (provider && (/google|kick/i.test(provider.textContent || '') || form.closest('#ps15KickSetup'))) provider.textContent = 'PLAY STREAMERS';
    dialog?.querySelectorAll('.ps30-socials,.auth-secondary,.auth-divider,[data-provider-icon]').forEach((node) => node.remove());
    dialog?.querySelectorAll('button').forEach((button) => {
      const label = `${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`.trim();
      if (/google|kick/i.test(label) || /^(g|k)$/i.test(label)) button.remove();
    });

    addAgeField(form);
    if (!form.querySelector('[data-ps38-completion-logout],[data-ps30-action="logout"]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ps38-completion-logout';
      button.dataset.ps38CompletionLogout = '1';
      button.textContent = 'Çıkış yap';
      button.addEventListener('click', signOutFromCompletion);
      form.append(button);
    }

    // The historical Kick form had its own submit routine and did not include
    // the required birth date. Replace it once so every completion surface
    // sends the same payload to the current API.
    if (form.dataset.ps38CompletionSubmit !== '1') {
      form.dataset.ps38CompletionSubmit = '1';
      form.onsubmit = null;
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const error = form.querySelector('.auth-error,.ps30-error,.ps15-error,.ps14-error,.psmail-error');
        const username = form.querySelector('[name="username"]')?.value.trim() || '';
        const password = form.querySelector('[name="password"]')?.value || '';
        const passwordRepeat = form.querySelector('[name="passwordRepeat"]')?.value || '';
        const birthDate = form.querySelector('[name="birthDate"]')?.value || '';
        if (password !== passwordRepeat) {
          if (error) error.textContent = 'Şifreler birbiriyle aynı değil.';
          return;
        }
        if (!birthDate) {
          if (error) error.textContent = 'Doğum tarihini girmen gerekiyor.';
          return;
        }
        if (new Date(birthDate) > new Date(`${adultDate()}T23:59:59`)) {
          if (error) error.textContent = 'Devam etmek için en az 18 yaşında olmalısın.';
          return;
        }
        if (error) error.textContent = '';
        const kick = Boolean(form.closest('#ps15KickSetup')) || /kick/i.test(form.id || '') || form.dataset.provider === 'kick';
        const sessionId = currentState().settings?.userSession || '';
        try {
          const response = await fetch(`${API}${kick ? '/api/auth/complete-kick-profile' : '/api/auth/complete-google-profile'}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(sessionId ? { Authorization: `Bearer ${sessionId}` } : {}) },
            body: JSON.stringify({ username, password, passwordRepeat, birthDate })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Hesap tamamlanamadı.');
          const state = currentState();
          state.settings ||= {};
          state.settings.user = data.user || state.settings.user;
          if (data.sessionId) state.settings.userSession = data.sessionId;
          if (typeof state.settings.rememberUser !== 'boolean') state.settings.rememberUser = false;
          localStorage.setItem(STORE, JSON.stringify(state));
          if (kick) sessionStorage.setItem('ps15KickEmailNotice', '1');
          const finish = () => location.replace(location.pathname + location.search);
          if (typeof window.psUnifiedLoad === 'function') window.psUnifiedLoad(finish); else finish();
        } catch (requestError) {
          if (error) error.textContent = requestError?.message || 'Hesap tamamlanamadı.';
        }
      }, true);
    }
  }

  function scan() {
    // Eski dosyalardan kalmış farklı id'ler olsa bile aynı üç alanı taşıyan
    // her "hesap tamamlama" formunu yakala. Böylece sağlayıcıya göre farklı
    // görünen eski ekranlar yaş alanını ya da çıkış düğmesini atlayamaz.
    document.querySelectorAll('form').forEach((form) => {
      const hasCredentialFields = Boolean(
        form.querySelector('[name="username"]') &&
        form.querySelector('[name="password"]') &&
        form.querySelector('[name="passwordRepeat"]')
      );
      const knownCompletion = form.matches('#ps30CompleteForm,#googleProfileSetup form,#kickProfileSetup form,#ps15KickSetup form,[data-ps27-completion="1"]');
      const parentText = form.parentElement?.textContent || '';
      if (knownCompletion || (hasCredentialFields && /hesab.{0,12}tamamla/i.test(parentText))) {
        form.dataset.ps38DetectedCompletion = '1';
        polishCompletion(form);
      }
    });
  }

  scan();
  // Büyük arayüz geçişleri çok sayıda DOM değişikliği üretir. Her değişiklikte
  // tüm formları yeniden taramak yerine bir sonraki karede tek tarama yap.
  let scanQueued = false;
  new MutationObserver(() => {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => { scanQueued = false; scan(); });
  }).observe(document.documentElement, { childList:true, subtree:true });
})();

/* Güvenlik koruması arka arkaya denemeyi engellediğinde kullanıcıya teknik
   hata yerine kısa, geri sayımlı bir bekleme bilgisi gösterir. */
(() => {
  'use strict';
  const authPaths = new Set([
    '/api/auth/login', '/api/auth/register', '/api/auth/request-email-verification',
    '/api/auth/verify-email', '/api/auth/request-password-reset', '/api/auth/reset-password'
  ]);
  let until = 0;
  let timer = null;

  function targetPath(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url || '';
      return new URL(raw, location.href).pathname;
    } catch (_) { return ''; }
  }
  function authForms() {
    return [...document.querySelectorAll('#landingAuthForm,.landing-auth-modal form')]
      .filter((form) => !form.closest('#googleProfileSetup,#kickProfileSetup,#ps15KickSetup,#ps30Modal'));
  }
  function updateForm(form) {
    const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    let notice = form.querySelector('.ps39-auth-wait');
    const submit = form.querySelector('button[type="submit"]');
    if (!remaining) {
      if (submit) submit.disabled = false;
      if (notice && !notice.classList.contains('ps39-out')) {
        notice.classList.add('ps39-out');
        setTimeout(() => notice?.remove(), 210);
      }
      return;
    }
    const login = Boolean(form.querySelector('[name="identity"]'));
    const action = login ? 'Giriş yapmak' : 'Kayıt olmak';
    if (!notice) {
      notice = document.createElement('p');
      notice.className = 'ps39-auth-wait';
      const error = form.querySelector('.auth-error');
      (error || submit || form.lastElementChild).before(notice);
    }
    notice.innerHTML = `<i></i><span>${action} için ${remaining} saniye bekleyin.</span>`;
    if (submit) submit.disabled = true;
  }
  function renderCooldown() {
    authForms().forEach(updateForm);
    if (Date.now() >= until) {
      clearInterval(timer);
      timer = null;
    }
  }
  function beginCooldown(seconds = 10) {
    until = Math.max(until, Date.now() + seconds * 1000);
    renderCooldown();
    if (!timer) timer = setInterval(renderCooldown, 250);
  }
  const previousFetch = window.fetch.bind(window);
  window.fetch = async function ps39CooldownFetch(input, init = {}) {
    const path = targetPath(input);
    const response = await previousFetch(input, init);
    // Only apply the short client-side cooldown after a real rate-limit
    // response. Security, network and Turnstile errors must stay visible
    // instead of incorrectly telling the user to wait 10 seconds.
    if (authPaths.has(path) && response.status === 429) {
      response.clone().json().catch(() => ({})).then((data) => {
        const error = String(data?.error || '');
        if (/güvenlik doğrulaması|güvenlik kodu|çok fazla|rate|limit/i.test(error)) beginCooldown(10);
      });
    }
    return response;
  };
  new MutationObserver(() => { if (until > Date.now()) renderCooldown(); })
    .observe(document.documentElement, { childList:true, subtree:true });
})();

(() => {
  'use strict';
  const STORE = 'play-streamers-v17-site';
  const AUTH_PATHS = new Set(['/api/auth/login','/api/auth/register','/api/auth/request-password-reset','/api/auth/verify-email','/api/auth/request-email-verification']);
  const $ = (selector, root = document) => root.querySelector(selector);
  if (sessionStorage.getItem('ps40-member-routing') === '1') sessionStorage.removeItem('ps40-member-routing');
  const readState = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } };
  const routePath = value => {
    try { return new URL(typeof value === 'string' ? value : value?.url || '', location.origin).pathname; }
    catch { return ''; }
  };
  function timeoutNotice(form, text = 'Bağlantı zaman aşımına uğradı. Lütfen kısa süre sonra tekrar dene.') {
    if (!form || !document.contains(form)) return;
    let note = $('.ps40-timeout-notice', form);
    if (!note) {
      note = document.createElement('p');
      note.className = 'ps40-timeout-notice';
      const target = $('.auth-error', form) || $('button[type="submit"]', form) || form.lastElementChild;
      target?.before(note);
    }
    note.innerHTML = `<i></i><span>${text}</span>`;
  }
  function clearTimeoutNotice(form) { $('.ps40-timeout-notice', form)?.remove(); }
  function isFinishedLogin() {
    const settings = readState().settings || {};
    return Boolean(settings.userSession && settings.user && !settings.user.needsCredentialSetup);
  }
  function goToMemberHome() {
    if (sessionStorage.getItem('ps40-member-routing') === '1') return;
    sessionStorage.setItem('ps40-member-routing', '1');
    const go = () => location.replace(`${location.pathname}${location.search}`);
    if (typeof window.psUnifiedLoad === 'function') window.psUnifiedLoad(go);
    else go();
  }
  function watchCredentialLogin(form) {
    if (form.dataset.ps40Watching === '1') return;
    form.dataset.ps40Watching = '1';
    clearTimeoutNotice(form);
    const started = Date.now();
    const timer = setInterval(() => {
      if (!document.contains(form)) return clearInterval(timer);
      if (isFinishedLogin()) {
        clearInterval(timer);
        return goToMemberHome();
      }
      // Do not overwrite a real server response with a fabricated 10-second
      // timeout. OAuth, password hashing and security verification can take
      // longer than the old 16-second watcher allowed.
      if (Date.now() - started > 60000) {
        clearInterval(timer);
        form.dataset.ps40Watching = '';
      }
    }, 150);
  }
  function cleanCompletion(root = document) {
    const forms = root instanceof HTMLFormElement ? [root] : [...root.querySelectorAll('form')];
    forms.forEach(form => {
      const wrapper = form.closest('#ps15KickSetup,.ps30-dialog,.account-blocker,.auth-modal,[role="dialog"]');
      const text = `${form.id} ${wrapper?.textContent || ''}`;
      if (!/hesabını tamamla|hesabini tamamla|kickprofile|googleprofile|ps30complete/i.test(text)) return;
      wrapper?.querySelectorAll('.ps30-socials,.auth-secondary,.auth-divider,[data-provider-icon],.provider-buttons').forEach(node => node.remove());
      wrapper?.querySelectorAll('button').forEach(button => {
        const label = String(button.textContent || '').trim();
        if (/^(google|kick|g|k)$/i.test(label) || /google ile|kick ile/i.test(label)) button.remove();
      });
      const heading = wrapper?.querySelector('h1,h2');
      if (heading && /kick/i.test(heading.textContent || '')) heading.textContent = 'Hesabını tamamla';
      wrapper?.querySelectorAll('p').forEach(paragraph => {
        if (/kick hesab/i.test(paragraph.textContent || '')) paragraph.textContent = 'Play Streamers hesabını tamamlamak için kullanıcı adı, şifre ve doğum tarihini belirle.';
      });
    });
  }
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.querySelector('[name="identity"]')) return;
    watchCredentialLogin(form);
  }, true);
  const inheritedFetch = window.fetch.bind(window);
  window.fetch = async function ps40LoginFetch(input, init = {}) {
    const path = routePath(input);
    try {
      const response = await inheritedFetch(input, init);
      if (AUTH_PATHS.has(path) && [408, 504, 524].includes(response.status)) {
        queueMicrotask(() => document.querySelectorAll('form').forEach(form => {
          if (form.querySelector('[name="identity"]')) timeoutNotice(form);
        }));
      }
      return response;
    } catch (error) {
      // A generic network/CORS/validation error is not a timeout. Showing a
      // forced "wait 10 seconds" message here hid the actual login error and
      // made a successful verification look broken. Only surface this notice
      // for a real aborted/timed-out browser request.
      const actualTimeout = error?.name === 'AbortError' || /timeout|timed out/i.test(String(error?.message || ''));
      if (AUTH_PATHS.has(path) && actualTimeout) queueMicrotask(() => document.querySelectorAll('form').forEach(form => {
        if (form.querySelector('[name="identity"]')) timeoutNotice(form);
      }));
      throw error;
    }
  };
  cleanCompletion();
  new MutationObserver(records => {
    for (const record of records) {
      record.addedNodes.forEach(node => {
        if (node.nodeType === 1) cleanCompletion(node);
      });
    }
  }).observe(document.documentElement, { childList:true, subtree:true });
})();

(() => {
  'use strict';
  const API = 'https://api.pstreamers.com';
  const STORE = 'play-streamers-v17-site';
  const LOGIN_PATH = '/api/auth/login';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const safeState = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (_) { return {}; } };
  const routePath = input => { try { return new URL(typeof input === 'string' ? input : input?.url || '', location.href).pathname; } catch (_) { return ''; } };

  // Preserve a token obtained from the visible verification sheet. ps32 will
  // preserve it as well, so one login is checked once instead of twice.
  const previousFetch = window.fetch.bind(window);
  window.fetch = async function ps41VerifiedLoginFetch(input, init = {}) {
    const path = routePath(input);
    const ticket = window.__ps41TurnstileTicket;
    if (path === LOGIN_PATH && ticket && ticket.expiresAt > Date.now()) {
      const headers = new Headers(init.headers || (input && input.headers) || {});
      const raw = init.body || '{}';
      let body = {};
      try { body = typeof raw === 'string' ? JSON.parse(raw || '{}') : {}; } catch (_) {}
      body.turnstileToken ||= ticket.token;
      headers.set('X-Turnstile-Token', body.turnstileToken);
      headers.set('content-type', headers.get('content-type') || 'application/json');
      // Turnstile tickets are single-use. Remove this one before the request
      // completes so a second password attempt always opens a fresh check.
      delete window.__ps41TurnstileTicket;
      const response = await previousFetch(input, { ...init, headers, body: JSON.stringify(body) });
      if (response.ok) queueMemberHomeAfterLogin();
      return response;
    }
    return previousFetch(input, init);
  };

  function queueMemberHomeAfterLogin() {
    if (sessionStorage.getItem('ps41-login-routing') === '1') return;
    sessionStorage.setItem('ps41-login-routing', '1');
    setTimeout(() => {
      /* The verified-login handler may already have completed the transition.
         In that case it clears this marker so the legacy fetch observer cannot
         start a second loader and briefly leave the page without a surface. */
      if (sessionStorage.getItem('ps41-login-routing') !== '1') return;
      const state = safeState();
      if (!state?.settings?.userSession) { sessionStorage.removeItem('ps41-login-routing'); return; }
      const go = () => {
        sessionStorage.removeItem('ps41-login-routing');
        if (typeof window.psRevealMemberHomeSurface === 'function') window.psRevealMemberHomeSurface();
        else location.replace(`${location.pathname}${location.search}`);
      };
      if (typeof window.psUnifiedLoad === 'function') window.psUnifiedLoad(go); else go();
    }, 40);
  }

  async function turnstileConfig() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const config = window.__psTurnstileConfig;
      if (config?.enabled && config.siteKey && window.turnstile?.render) return config;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Güvenlik doğrulaması hazırlanamadı. Lütfen sayfayı yenileyip tekrar dene.');
  }

  async function verifyCredentialLogin() {
    const config = await turnstileConfig();
    return new Promise((resolve, reject) => {
      const layer = document.createElement('section');
      layer.id = 'ps41Verify';
      layer.innerHTML = `<div class="ps41-verify-card"><b>PLAY STREAMERS</b><h2>Kısa bir güvenlik kontrolü</h2><p>Girişini tamamlamadan önce gerçek bir ziyaretçi olduğunu doğruluyoruz.</p><div id="ps41Turnstile"></div><div class="ps41-verify-status" aria-live="polite">Doğrulama bekleniyor…</div></div>`;
      document.body.append(layer);
      const host = $('#ps41Turnstile', layer);
      const status = $('.ps41-verify-status', layer);
      let done = false;
      const remove = () => {
        if (!layer.isConnected) return;
        layer.classList.add('ps41-leave');
        setTimeout(() => layer.remove(), 70);
      };
      const fail = message => {
        if (done) return;
        status.classList.add('error');
        status.textContent = message;
        if (!$('.ps41-verify-retry', layer)) {
          const retry = document.createElement('button');
          retry.type = 'button'; retry.className = 'ps41-verify-retry'; retry.textContent = 'Tekrar dene';
          retry.onclick = () => { remove(); verifyCredentialLogin().then(resolve, reject); };
          status.after(retry);
        }
      };
      try {
        window.turnstile.render(host, {
          sitekey: config.siteKey,
          theme: 'dark',
          appearance: 'always',
          callback(token) {
            if (done) return;
            done = true;
            status.textContent = 'Doğrulama tamamlandı. Giriş hazırlanıyor…';
            remove();
            resolve(token);
          },
          'error-callback'() { fail('Güvenlik doğrulaması yüklenemedi. Reklam engelleyicini kapatıp tekrar dene.'); },
          'expired-callback'() { fail('Güvenlik doğrulamasının süresi doldu. Tekrar doğrulama yap.'); }
        });
      } catch (_) { fail('Güvenlik doğrulaması başlatılamadı. Lütfen sayfayı yenile.'); }
    });
  }

  // Every active username/email login form uses this hook before its normal
  // submit handler. The existing handler is then replayed once with the
  // visible Turnstile ticket, so its session and member-home logic stay intact.
  function isCredentialLoginForm(form) {
    if (!(form instanceof HTMLFormElement)) return false;
    if (form.dataset.mode === 'login' && form.id === 'ps30AuthForm') return true;
    return form.id === 'landingAuthForm' || form.id === 'standaloneAuthForm';
  }

  // Complete credential login here, instead of replaying the submit event
  // through several legacy form listeners. That replay was the source of the
  // intermittent timeout/second-submit behaviour seen on the public page.
  function completeTwoFactorLogin(challenge, remember = sessionStorage.getItem('ps-remember-intent') === '1') {
    return new Promise((resolve, reject) => {
      $('#ps56TwoFactorLogin')?.remove();
      const layer = document.createElement('div');
      layer.id = 'ps56TwoFactorLogin';
      layer.className = 'landing-auth-modal';
      layer.style.zIndex = '4600';
      layer.innerHTML = `<section class="auth-dialog"><button class="auth-close" type="button" aria-label="Kapat">×</button><span class="eyebrow">İKİ ADIMLI DOĞRULAMA</span><h2>Girişini doğrula</h2><p>Authenticator uygulamasındaki 6 haneli kodu veya daha önce kaydettiğin kurtarma kodlarından birini gir.</p><form class="auth-form"><label class="auth-field">Authenticator veya kurtarma kodu<input name="code" autocomplete="one-time-code" minlength="6" maxlength="9" required placeholder="123456 veya XXXX-XXXX"></label><p class="auth-error" aria-live="polite"></p><button class="auth-submit" type="submit">Girişi tamamla</button></form></section>`;
      document.body.append(layer);
      const cancel = () => { layer.remove(); reject(new Error('İki adımlı doğrulama iptal edildi.')); };
      $('.auth-close', layer).onclick = cancel;
      layer.onclick = event => { if (event.target === layer) cancel(); };
      const form = $('form', layer);
      $('input', form)?.focus();
      form.onsubmit = async event => {
        event.preventDefault();
        const status = $('.auth-error', form), submit = $('.auth-submit', form);
        const code = String(form.elements.code.value || '').trim();
        if (!/^\d{6}$/.test(code) && !/^[A-Za-z2-7]{4}-?[A-Za-z2-7]{4}$/.test(code)) { status.textContent = '6 haneli Authenticator kodunu veya kurtarma kodunu gir.'; return; }
        submit.disabled = true; status.textContent = 'Kod doğrulanıyor…';
        try {
          const response = await window.fetch(`${API}/api/auth/verify-two-factor`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ challengeId: challenge.challengeId, code, remember: Boolean(remember) })
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result.sessionId || !result.user) {
            if ([400, 409].includes(response.status)) throw new Error('Kod hatalı.');
            throw new Error(result.error || 'Kod hatalı.');
          }
          layer.remove();
          resolve(result);
        } catch (error) {
          submit.disabled = false;
          status.textContent = error?.message || 'Kod hatalı.';
        }
      };
    });
  }

  function saveCredentialSession(form, data) {
    if (!data?.sessionId || !data?.user) throw new Error('Giriş şu anda tamamlanamadı. Lütfen tekrar dene.');
    const state = safeState();
    state.settings ||= {};
    state.settings.userSession = data.sessionId;
    state.settings.user = data.user;
    if (data.kickAccountSession) state.settings.kickSession = data.kickAccountSession;
    const remember = form
      ? $('[name="remember"]', form)?.checked === true
      : sessionStorage.getItem('ps-remember-intent') === '1';
    state.settings.rememberUser = remember;
    if (remember) state.settings.rememberUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;
    else delete state.settings.rememberUntil;
    state.userSession = data.sessionId;
    localStorage.setItem(STORE, JSON.stringify(state));
    sessionStorage.setItem('psCurrentSession', '1');
    sessionStorage.setItem('ps48CurrentVisit', '1');
    sessionStorage.removeItem('ps41-login-routing');
    $('#landingAuthModal')?.remove();
    $('#standaloneAuthModal')?.remove();
    $('#ps30Modal')?.remove();
    $('#ps56TwoFactorLogin')?.remove();
    const go = () => {
      if (typeof window.psRevealMemberHomeSurface === 'function') window.psRevealMemberHomeSurface();
      else location.replace(`${location.pathname}${location.search}`);
    };
    if (typeof window.psUnifiedLoad === 'function') window.psUnifiedLoad(go);
    else go();
  }

  async function continueOAuthTwoFactorFromHash() {
    const params = new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : '');
    const challengeId = String(params.get('challenge_id') || '').trim();
    if (params.get('two_factor_required') !== '1' || !challengeId) return;
    const provider = params.get('oauth_provider') === 'kick' ? 'Kick' : 'Google';
    history.replaceState(null, '', location.pathname + location.search);
    if (typeof window.psDismissInitialLoaderSafely === 'function') window.psDismissInitialLoaderSafely();
    try {
      const result = await completeTwoFactorLogin({ challengeId, provider }, sessionStorage.getItem('ps-remember-intent') === '1');
      saveCredentialSession(null, result);
    } catch (error) {
      const overlay = $('#authOverlay');
      if (overlay) {
        overlay.hidden = false;
        overlay.removeAttribute('hidden');
        overlay.style.removeProperty('display');
      }
      document.body.classList.add('auth-locked');
      window.setTimeout(() => window.psOpenLandingAuth?.('login'), 120);
    }
  }

  async function completeVerifiedCredentialLogin(form, identity, password, token) {
    const remember = $('[name="remember"]', form)?.checked === true;
    let response;
    try {
      response = await previousFetch(`${API}${LOGIN_PATH}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'X-Turnstile-Token': token },
        body: JSON.stringify({ identity, password, remember, turnstileToken: token })
      });
    } catch (_) {
      throw new Error('Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.');
    }
    let data = await response.json().catch(() => ({}));
    if (response.status === 202 && data?.twoFactorRequired && data?.challengeId) {
      data = await completeTwoFactorLogin(data, remember);
      saveCredentialSession(form, data);
      return;
    }
    if (!response.ok || !data?.sessionId || !data?.user) {
      throw new Error(data?.error || 'Giriş şu anda tamamlanamadı. Lütfen tekrar dene.');
    }
    saveCredentialSession(form, data);
  }

  window.ps41InterceptCredentialLogin = (form, event) => {
    if (!isCredentialLoginForm(form)) return false;
    if (form.dataset.ps41Verified === '1') { delete form.dataset.ps41Verified; return false; }
    event.preventDefault();
    event.stopImmediatePropagation();
    const error = $('.ps30-error,.auth-error', form);
    if (error) error.textContent = '';
    const identity = $('[name="identity"]', form)?.value?.trim();
    const password = $('[name="password"]', form)?.value || '';
    if (!identity || !password) {
      if (error) error.textContent = 'Kullanıcı adı veya e-posta ile şifre alanlarını doldur.';
      return true;
    }
    if (form.dataset.ps41Verifying === '1') return true;
    form.dataset.ps41Verifying = '1';
    verifyCredentialLogin().then(token => completeVerifiedCredentialLogin(form, identity, password, token)).then(() => {
      delete form.dataset.ps41Verifying;
    }).catch(problem => {
      delete form.dataset.ps41Verifying;
      if (error) error.textContent = problem?.message || 'Güvenlik doğrulaması tamamlanamadı.';
    });
    return true;
  };

  // The original landing and standalone forms attach their own handlers to the
  // form element. Capturing at document level lets us place verification ahead
  // of both handlers without replacing their account/session implementation.
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id === 'ps30AuthForm') return;
    window.ps41InterceptCredentialLogin(form, event);
  }, true);

  window.setTimeout(() => { continueOAuthTwoFactorFromHash().catch(() => {}); }, 0);

  function ps41LocaleMenu(button) {
    let menu = $('#ps41LocaleMenu');
    if (!menu) { menu = document.createElement('aside'); menu.id = 'ps41LocaleMenu'; menu.className = 'ps15-locale-menu'; menu.hidden = true; document.body.append(menu); }
    if (!menu.hidden) { menu.hidden = true; return; }
    const choices = [['tr','🇹🇷','Türkçe'],['en','🇬🇧','English'],['de','🇩🇪','Deutsch'],['es','🇪🇸','Español'],['fr','🇫🇷','Français'],['ru','🇷🇺','Русский'],['ar','🇸🇦','العربية'],['ja','🇯🇵','日本語']];
    const selected = localStorage.getItem('ps15-locale') || 'tr';
    menu.innerHTML = `<span class="ps15-locale-title">DİL SEÇİMİ</span>${choices.map(([code, flag, label]) => `<button type="button" data-language="${code}" ${selected === code ? 'aria-current="true"' : ''}><span class="ps15-locale-flag">${flag}</span>${label}</button>`).join('')}`;
    const rect = button.getBoundingClientRect();
    menu.style.left = `${Math.max(12, Math.min(innerWidth - 257, rect.left))}px`;
    menu.style.top = `${rect.bottom + 8}px`;
    menu.hidden = false;
    menu.classList.add('ps15-open');
    $$('[data-language]', menu).forEach(choice => choice.onclick = () => {
      localStorage.setItem('ps15-locale', choice.dataset.language);
      if (typeof window.psUnifiedLoad === 'function') window.psUnifiedLoad(() => location.reload()); else location.reload();
    });
  }
  function globeMarkup() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.5 2.5 3.7 5.5 3.7 9S14.5 18.5 12 21M12 3C9.5 5.5 8.3 8.5 8.3 12S9.5 18.5 12 21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'; }
  function moveLanguageButton() {
    $$('.landing-actions,.ps30-actions,.landing-nav .actions').forEach(actions => {
      let globe = $('.ps15-locale-button,.ps41-locale-button', actions);
      if (!globe) {
        globe = document.createElement('button');
        globe.type = 'button'; globe.className = 'ps15-locale-button ps41-locale-button'; globe.title = 'Dil seçimi'; globe.setAttribute('aria-label', 'Dil seçimi'); globe.innerHTML = globeMarkup();
        globe.onclick = event => { event.preventDefault(); event.stopPropagation(); ps41LocaleMenu(globe); };
      }
      const login = $$('button', actions).find(button => /^(giriş yap|sign in|anmelden|iniciar sesión|connexion|войти|دخول|ログイン)$/i.test((button.textContent || '').trim()));
      if (globe && login && globe.nextElementSibling !== login) login.before(globe);
    });
  }

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]);
  function entry(name, meta, message) {
    return `<li class="read"><div class="event-main"><div class="event-top"><span class="name">${escapeHtml(name)}</span><span class="meta">${escapeHtml(meta)}</span></div><div class="message">${escapeHtml(message)}</div></div><button class="event-expand" type="button" aria-label="Büyüt">⛶</button></li>`;
  }
  function card(key, title, color, count, copy, icon) {
    return `<section class="card ${color}" data-card="${key}"><div class="card-body"><div class="card-head"><div class="title"><span class="logo">${icon}</span><h2>${title}</h2></div><button class="expand" type="button" aria-label="Kartı büyüt">⛶</button><div class="count">${count}</div></div><ul class="entries">${entry('Henüz olay yok', 'hazır', copy)}</ul><div class="empty show">${copy}</div></div></section>`;
  }
  function bindRepairedCards(root) {
    $$('.expand', root).forEach(button => {
      button.onclick = () => {
        const current = button.closest('.card');
        const opening = !current.classList.contains('expanded');
        $$('.card.expanded', document).forEach(node => node.classList.remove('expanded'));
        if (opening) current.classList.add('expanded');
      };
    });
  }
  function observeDashboardGrid(grid) {
    if (!grid || grid.dataset.ps41GridObserved === '1') return;
    grid.dataset.ps41GridObserved = '1';
    const observer = new MutationObserver(() => {
      if (grid.dataset.ps41Repairing === '1') return;
      requestAnimationFrame(recoverDashboardCards);
    });
    observer.observe(grid, { childList: true });
  }
  function recoverDashboardCards() {
    const state = safeState();
    const events = state.events || {};
    const subscriptions = Object.values(events.subs || {});
    const one = subscriptions.filter(item => Number(item.months || 1) === 1).length;
    const multi = subscriptions.filter(item => Number(item.months || 1) >= 2).length;
    const kicks = (events.kicks || []).length;
    const gifts = (events.gifts || []).length;
    const donations = (events.donations || []).length;
    const panelGrid = $('#panelGrid');
    observeDashboardGrid(panelGrid);
    // A late render race could leave these grids partially empty. Rebuild only
    // when the live UI has fewer than its five expected cards; healthy cards
    // are never replaced.
    if (panelGrid && panelGrid.querySelectorAll(':scope > .card').length < 5) {
      panelGrid.dataset.ps41Repairing = '1';
      panelGrid.innerHTML = [
        card('onemonth','1 Aylık Abone','violet',one,'Yeni abonelikler burada görünür.','◔'),
        card('multimonth','2+ Aylık Abone','magenta',multi,'Kümülatif abonelikler burada görünür.','◔'),
        card('gifts','Hediye Abonelik','cyan',gifts,'Hediye abonelik olayları burada görünür.','✦'),
        card('kicks','Kicks','lime',kicks,'Kicks olayları burada görünür.','K'),
        card('donations','Donate','amber',donations,'Donate olayları burada görünür.','₺')
      ].join('');
      bindRepairedCards(panelGrid);
      queueMicrotask(() => delete panelGrid.dataset.ps41Repairing);
    }
    const statsGrid = $('#statsGrid');
    observeDashboardGrid(statsGrid);
    if (statsGrid && statsGrid.querySelectorAll(':scope > .card').length < 5) {
      statsGrid.dataset.ps41Repairing = '1';
      statsGrid.innerHTML = [
        card('joined','Bu Ay Aramıza Katılanlar','violet',0,'Bu ayın yeni aboneleri burada sıralanır.','◔'),
        card('tops','Top Aboneler','magenta',0,'En yüksek abonelik süreleri burada görünür.','◔'),
        card('gifts-stats','Hediye Abonelikler','cyan',gifts,'Aylık ve tüm zamanlar hediye abonelik özeti.','✦'),
        card('kicks-stats','Kicks Gönderenler','lime',kicks,'Aylık ve tüm zamanlar Kicks özeti.','K'),
        card('donate-stats','Donate Gönderenler','amber',donations,'Aylık ve tüm zamanlar Donate özeti.','₺')
      ].join('');
      bindRepairedCards(statsGrid);
      queueMicrotask(() => delete statsGrid.dataset.ps41Repairing);
    }
    const panelView = $('#panelView');
    const statsView = $('#statsView');
    $$('.workspace-tabs button').forEach(button => {
      if (button.dataset.ps41Bound === '1') return;
      button.dataset.ps41Bound = '1';
      button.addEventListener('click', () => {
        const showStats = button.dataset.view === 'stats';
        if (panelView) panelView.hidden = showStats;
        if (statsView) statsView.hidden = !showStats;
        $$('.workspace-tabs button').forEach(tab => tab.classList.toggle('active', tab === button));
        setTimeout(recoverDashboardCards, 30);
      });
    });
  }

  let repairRuns = 0;
  const repairTimer = setInterval(() => {
    moveLanguageButton();
    recoverDashboardCards();
    repairRuns += 1;
    if (repairRuns >= 12) clearInterval(repairTimer);
  }, 350);
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest('.workspace-tabs,#ps17Dashboard,#ps20Dashboard,[data-ps30-action="dashboard"],button,a');
    const label = (target?.textContent || '').trim().toLocaleLowerCase('tr');
    if (target?.matches('.workspace-tabs,#ps17Dashboard,#ps20Dashboard,[data-ps30-action="dashboard"]') || /dashboard|yayıncı paneli|yayıncı istatistikleri/.test(label)) {
      setTimeout(recoverDashboardCards, 180);
    }
  }, true);
})();

(() => {
  'use strict';
  const STORE = 'play-streamers-v17-site';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const readState = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (_) { return {}; } };
  const hasConnection = (user, platform) => platform === 'gmail'
    ? Boolean(user?.googleConnected || user?.google_connected || user?.googleId || user?.google_id || user?.provider === 'google' || user?.authProvider === 'google')
    : Boolean(user?.kickConnected || user?.kick_connected || user?.kickId || user?.kick_id);

  function primarySurfaceReady() {
    const visible = node => {
      if (!node || node.hidden) return false;
      const style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
    };
    return [$('#psSecondHome'), $('.app'), $('#authOverlay')].some(visible);
  }

  function dismissInitialLoader(attempt = 0) {
    const loader = $('#ps28Loader.ps42-initial-loader');
    if (!loader) return;
    const sessionPending = document.documentElement.classList.contains('ps15-session-pending');
    if ((sessionPending || !primarySurfaceReady()) && attempt < 40) {
      window.setTimeout(() => dismissInitialLoader(attempt + 1), 125);
      return;
    }
    if (!primarySurfaceReady() && typeof window.psRescueVisibleSurface === 'function') {
      window.psRescueVisibleSurface();
    }
    if (!document.documentElement.classList.contains('ps42-initial-loading')) {
      loader.hidden = true;
      loader.classList.remove('ps42-initial-loader', 'ps42-initial-leaving', 'is-open');
      return;
    }
    if (loader.dataset.ps42Dismissing === '1') return;
    loader.dataset.ps42Dismissing = '1';
    const video = $('video', loader);
    try { video?.play?.(); } catch (_) { /* Autoplay may be unavailable; the same loader remains visible. */ }
    window.setTimeout(() => {
      loader.classList.add('ps42-initial-leaving');
      window.setTimeout(() => {
        loader.hidden = true;
        loader.classList.remove('ps42-initial-loader', 'ps42-initial-leaving', 'is-open');
        delete loader.dataset.ps42Dismissing;
        document.documentElement.classList.remove('ps42-initial-loading');
        document.documentElement.dataset.ps42InitialLoader = 'done';
        document.documentElement.dataset.ps42InitialLoaderEndedAt = String(Date.now());
      }, 250);
    }, 650);
  }
  window.psDismissInitialLoaderSafely = dismissInitialLoader;

  function closeLocaleMenu() {
    const menu = $('#ps41LocaleMenu');
    if (!menu || menu.hidden) return;
    menu.classList.remove('ps15-open');
    menu.hidden = true;
  }

  function normalizePublicHome() {
    $$('.landing-actions').forEach(actions => {
      const globe = $('.ps41-locale-button,.ps15-locale-button', actions);
      const status = $('#ps17SystemStatus', actions);
      if (globe && status && globe.nextElementSibling !== status) status.before(globe);
      if (status) {
        if (status.textContent !== '!') status.textContent = '!';
        status.classList.remove('orange', 'yellow', 'red');
        status.classList.add('green');
        status.dataset.ps18Level = 'green';
        status.dataset.ps18Title = 'Sistem normal';
        status.dataset.ps18Items = JSON.stringify(['Teknik sorun yok.']);
      }
    });
  }

  function normalizeAuthProviders() {
    $$('#landingAuthModal, #standaloneAuthModal, #ps30Modal').forEach(modal => {
    });
  }

  function updateConnectionCopy(root = document) {
    const user = readState().settings?.user || {};
    const gmail = hasConnection(user, 'gmail');
    const kick = hasConnection(user, 'kick');
    const statuses = { Gmail: gmail, Kick: kick };
    $$('.ps20-connection', root).forEach(row => {
      const label = $('b', row);
      const key = /gmail/i.test(label?.textContent || '') ? 'Gmail' : /kick/i.test(label?.textContent || '') ? 'Kick' : '';
      if (!key) return;
      const connected = statuses[key];
      const indicator = $('.ps20-status', row);
      if (indicator) { indicator.textContent = connected ? '✓' : '×'; indicator.classList.toggle('off', !connected); }
      if (label) label.textContent = `${key} hesabı ${connected ? 'bağlı' : 'bağlı değil'}`;
      const detail = $('small', row);
      if (detail) detail.textContent = connected ? (key === 'Gmail' ? (user.email || 'Gmail hesabın bağlı') : 'Kick hesabın bağlı') : `Henüz ${key} bağlantısı yok`;
    });
    $$('.ps21-connection-head,.ps28-panel-title', root).forEach(node => { node.textContent = 'HESAP BAĞLILIĞI'; });
  }

  function closeUpdatesDialog() {
    const dialog = $('#ps42UpdatesDialog');
    if (!dialog || dialog.hidden || dialog.dataset.closing === '1') return;
    dialog.dataset.closing = '1';
    dialog.classList.remove('ps42-open');
    window.setTimeout(() => { dialog.hidden = true; delete dialog.dataset.closing; }, 220);
  }

  function showUpdatesDialog() {
    let dialog = $('#ps42UpdatesDialog');
    if (!dialog) {
      dialog = document.createElement('section');
      dialog.id = 'ps42UpdatesDialog';
      dialog.hidden = true;
      dialog.innerHTML = '<article role="dialog" aria-modal="true" aria-labelledby="ps42UpdatesTitle"><button class="ps42-close" type="button" aria-label="Kapat">×</button><span class="ps42-kicker">GÜNCELLEME MERKEZİ</span><h2 id="ps42UpdatesTitle">Neler yeni?</h2><p>Son sürümdeki önemli iyileştirmeler.</p><ul><li>Hesap bağlılığı artık yalnızca sunucudan doğrulanan hesapları bağlı gösterir.</li><li>Kullanıcı ana sayfası, Dashboard ve menü geçişleri daha tutarlı çalışır.</li><li>Yükleme ekranı ilk açılışta ve hesap alanına geçişlerde tek akışta gösterilir.</li></ul></article>';
      document.body.append(dialog);
      $('.ps42-close', dialog).onclick = closeUpdatesDialog;
      dialog.onclick = event => { if (event.target === dialog) closeUpdatesDialog(); };
    }
    dialog.hidden = false;
    delete dialog.dataset.closing;
    requestAnimationFrame(() => dialog.classList.add('ps42-open'));
  }

  function openMenuUpdates() {
    const target = $('#psMenuUpdates') || $('#menuUpdatesFull') || $('#menuUpdates');
    if (target) { target.click(); return; }
    const menu = $('#ps20Menu');
    const button = $('#ps20MenuButton');
    if (button && (!menu || menu.hidden)) button.click();
    window.setTimeout(() => {
      const openMenu = $('#ps20Menu');
      if (openMenu) $('[data-ps20-menu="updates"]', openMenu)?.click();
    }, 0);
  }

  function hideHistoricalPanels() {
    $$('#connections,#sideMenu,#ps13MemberConnections,#ps14MemberConnections,#ps13MemberConnection,#ps14MemberConnection').forEach(node => { node.hidden = true; });
  }

  function bindMemberHome() {
    const home = $('#psSecondHome.ps20-member-home');
    if (!home) return;
    const brand = $('#ps20Brand', home);
    if (brand) { brand.setAttribute('aria-disabled', 'true'); brand.setAttribute('tabindex', '-1'); brand.onclick = event => { event.preventDefault(); event.stopImmediatePropagation(); }; }
    const connection = $('#ps20Connection', home);
    if (connection) { connection.title = 'Bağlantı durumu'; connection.setAttribute('aria-label', 'Bağlantı durumu'); }
    const updates = $('#ps20Updates', home);
    if (updates) updates.onclick = event => { event.preventDefault(); event.stopImmediatePropagation(); openMenuUpdates(); };
    hideHistoricalPanels();
    updateConnectionCopy(home);
  }

  function normalizeDashboard() {
    const app = $('.app');
    const dashboardActive = Boolean(app && !app.hidden && app.classList.contains('ps13-dashboard'));
    document.body.classList.toggle('ps42-dashboard-active', dashboardActive);
    hideHistoricalPanels();
    updateConnectionCopy();
  }

  document.addEventListener('pointerdown', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('#ps41LocaleMenu,.ps41-locale-button,.ps15-locale-button')) closeLocaleMenu();
  }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeLocaleMenu(); closeUpdatesDialog(); } }, true);

  let queued = false;
  const repair = () => {
    queued = false;
    normalizePublicHome();
    normalizeAuthProviders();
    bindMemberHome();
    normalizeDashboard();
  };
  const queueRepair = () => { if (!queued) { queued = true; requestAnimationFrame(repair); } };
  new MutationObserver(queueRepair).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pageshow', queueRepair);
  window.addEventListener('resize', () => { $('#ps20ConnectionPopover')?.setAttribute('hidden', ''); $('#ps20Menu')?.setAttribute('hidden', ''); });
  repair();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dismissInitialLoader, { once: true });
  else dismissInitialLoader();
})();
