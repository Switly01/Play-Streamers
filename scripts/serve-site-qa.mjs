// Local-only QA fixture: fake accounts and intercepted API requests, never production mutations.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const app = await readFile(path.join(root, 'app.js'), 'utf8');
const openEvent = app.split('\n').find(line => line.startsWith('  function openEvent('));
const closeModal = app.split('\n').find(line => line.startsWith('  function closeModal('));
const itemHtml = app.split('\n').find(line => line.startsWith('  function itemHtml('));
const markup = `<!doctype html><html lang="tr" data-ps-site-version="9"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/site-v7.css?qa=10.33"></head><body class="ps-v9">
<nav id="qaControls" style="position:fixed;bottom:8px;left:8px;z-index:70000;display:flex;gap:6px;background:#181818;padding:8px"><button data-qa="data">Hesap verileri</button><button data-qa="account">Güvenlik</button><button data-qa="connections">Bağlantılar</button><button data-qa="products">Ürünler</button><button data-qa="donation">Bağış kartı</button><select id="qaLanguage" aria-label="Test dili"><option>tr</option><option>en</option><option>de</option><option>es</option><option>fr</option><option>ru</option><option>ar</option><option>ja</option></select></nav>
<main class="app ps13-dashboard"><header class="topbar"><div class="actions"></div></header><div id="panelGrid"></div><div id="statsGrid"></div></main><div id="modal" class="overlay" hidden></div>
<script>
const user={id:'qa-fixture-user',username:'Test yayıncı',email:'qa@example.test',picture:'avatar:orbit-cyan'};
const qaState={settings:{user,userSession:'qa-not-a-real-session',kickSession:'qa-not-a-real-session',kickAccount:{id:'qa-kick',username:'test-channel'},kickInsights:{broadcasterId:'qa-kick',dailyMetrics:[{date:'2026-08-13',followersCount:28},{date:'2026-08-21',followersCount:27},{date:'2026-08-22',followersCount:0}]}},events:{followers:[],subs:{},kicks:[],gifts:[],donations:[]},totals:{followers:0,kicks:0,gifts:0,donations:0},stats:{subs:{},joined:{},gifts:{all:{},month:{}},kicks:{all:{},month:{}},donations:{all:{},month:{}}}};
localStorage.setItem('play-streamers-v17-site',JSON.stringify(qaState));localStorage.setItem('ps15-locale','tr');sessionStorage.setItem('ps-second-dashboard','1');
const nativeFetch=window.fetch.bind(window);window.fetch=async (input,options)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin===location.origin)return nativeFetch(input,options);let data={ok:true,user};
if(url.pathname==='/api/sw-identity/account')data={ok:true,user:{...user,avatar:{type:'preset',value:'orbit-cyan'}},security:{twoFactorEnabled:true}};
if(url.pathname==='/api/donate-bridge/devices')data={ok:true,devices:[],providers:[{id:'bynogame',name:'ByNoGame',serverWebhook:false},{id:'itemsatis',name:'İtemSatış',serverWebhook:true},{id:'kofi',name:'Ko-fi',serverWebhook:true}]};
if(url.pathname==='/api/donate-webhooks/connections')data={ok:true,connections:[{id:'11111111-1111-4111-8111-111111111111',providerId:'kofi',providerName:'Ko-fi',eventCount:0}]};
if(url.pathname==='/api/donate-oauth/connections')data={ok:true,connections:[],providers:[{id:'streamlabs',name:'Streamlabs',configured:true},{id:'donationalerts',name:'DonationAlerts',configured:true},{id:'tipeeestream',name:'TipeeeStream',configured:true}]};
if(url.pathname.includes('/api/kick/events'))data={ok:true,insights:{hourlyMetrics:[]},events:[]};
return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}})};
const $=(s,root=document)=>root.querySelector(s),esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),money=(n,c)=>new Intl.NumberFormat('en',{style:'currency',currency:c||'TRY'}).format(n),donateDt=t=>new Date(t).toLocaleString(),dt=donateDt,eventMessage=esc,hue=()=>120;
${openEvent}\n${closeModal}\n${itemHtml}
const donation={id:'qa-donation',name:'Test destekçi',amount:80,currency:'TRY',at:Date.now(),message:'Uzun bağış mesajı / A long donation message to check spacing and its enclosing border.',sourceLogo:'/assets/providers/bynogame.png',sourceName:'ByNoGame',meta:'TRY 80.00 · 03/09/2026 17:05:22',read:false};
$('#panelGrid').innerHTML='<section class="card amber donate" data-card="donations"><div class="card-body"><div class="card-head"><div class="title"><span class="logo">₺</span><h2>Donate</h2></div><button class="expand" type="button">Büyüt</button></div><ul class="entries">'+itemHtml(donation,'donations')+'</ul></div></section>';
$('#panelGrid li').onclick=()=>openEvent(donation,'donations');
</script><script src="/app-final.js?qa=10.33"></script><script type="module" src="/live-i18n.js?qa=10.33"></script><script>
document.querySelectorAll('[data-qa]').forEach(b=>b.onclick=()=>{const key=b.dataset.qa;if(key==='products')window.psCleanRouteApi.memberProducts();else if(key==='donation')window.psQa.openDashboardCardCopy(document.querySelector('#panelGrid .card'));else window.psQa.showAccountCenter(key)});
document.getElementById('qaLanguage').onchange=e=>window.psSetLocale?.(e.target.value);
</script></body></html>`;
http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/qa') { response.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-store'}); response.end(markup); return; }
    const target = path.resolve(root, '.' + decodeURIComponent(pathname));
    if (!target.startsWith(root) || /(?:^|[\\/])\./.test(path.relative(root,target))) { response.writeHead(403); response.end(); return; }
    let bytes = await readFile(target);
    if (pathname === '/app-final.js') bytes = Buffer.from(bytes.toString().replace('\n})();', '\nwindow.psQa={showAccountCenter,openAccountMetricGraph,openDashboardCardCopy};\n})();'));
    response.writeHead(200, {'cache-control':'no-store','content-type':({'.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.html':'text/html'}[path.extname(target)]||'application/octet-stream')+'; charset=utf-8'});
    response.end(bytes);
  } catch { response.writeHead(404); response.end(); }
}).listen(8766,'127.0.0.1',()=>console.log('QA fixture: http://127.0.0.1:8766/qa'));
