// Local UI fixture: does not install the extension or contact real accounts.
import { chromium } from 'file:///C:/Users/esatb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PROVIDERS, FEATURED_PROVIDER_IDS } from '../src/providers.js';
const root=path.resolve(import.meta.dirname,'..');
const server=http.createServer(async(req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{const data=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.json')?'application/json':file.endsWith('.svg')?'image/svg+xml':'image/png');res.end(data);}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900},locale:'tr-TR'});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const remoteRequests=[];page.on('request',request=>{if(request.url().startsWith('https:'))remoteRequests.push(request.url());});
let catalogRequests=0;page.on('request',request=>{if(request.url().endsWith('/src/ui-catalog.json'))catalogRequests++;});
await page.route('https://**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"translations":[]}'}));
await page.addInitScript(({providers,featured})=>{
  const configs=Object.fromEntries(providers.map(provider=>[provider.id,{enabled:false,status:'setup'}]));
  const state={connection:{paired:false,serverConnectedProviderIds:[]},providers:configs,providerCatalog:providers,featuredProviderIds:featured,activity:[],queueCount:0};
  window.qaState=state;window.qaMessages=[];
  window.chrome={i18n:{getUILanguage:()=>navigator.language},runtime:{getManifest:()=>({version:'1.15.2'}),getURL:p=>location.origin+'/'+p,sendMessage:async message=>{
    window.qaMessages.push(message);
    if(message.type==='GET_PROVIDER_ALERT_URL')return{ok:true,result:{url:configs[message.providerId].alertUrl||''}};
    if(message.type==='SAVE_PROVIDER'){
      Object.assign(configs[message.providerId],message.config,{hasAlertUrl:!!message.config.alertUrl});
    }
    return{ok:true,result:state};
  }},storage:{session:{get:async()=>({}),remove:async()=>{},set:async()=>{}},onChanged:{addListener(){}}},tabs:{create:async()=>{}}};
},{providers:PROVIDERS,featured:FEATURED_PROVIDER_IDS});
const output=path.resolve(root,'..','output','play-connect-local-test');await fs.mkdir(output,{recursive:true});
try{
  await page.goto(origin+'/options/options.html');await page.waitForSelector('#providerForm');
  await page.screenshot({path:path.join(output,'options-desktop.png'),fullPage:true});
  for(const width of [1280,980,820,780,600,390,320]){
    await page.setViewportSize({width,height:900});
    for(const id of ['streamlabs','streamelements','kofi','donationalerts','tipeeestream','buymeacoffee','pally']){
      await page.getByRole('button').filter({has:page.locator('b').filter({hasText:new RegExp('^'+PROVIDERS.find(p=>p.id===id).name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})}).click();
      await page.waitForFunction(id=>new URL(location.href).searchParams.get('provider')===id,id);
      await page.waitForSelector('[name=alertUrl]');
      const overflow=await page.evaluate(()=>[...document.querySelectorAll('#providerNav button,#providerForm,.provider-head,.pairing-panel')].filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.className||e.id));
      assert.deepEqual(overflow,[],`${width} ${id}: overflow`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`page ${width} ${id}`);
    }
  }
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'options-mobile.png'),fullPage:true});
  await page.locator('#localeButton').click();assert.equal(await page.locator('#localeMenu img').count(),0);
  await page.locator('[data-locale=ar]').click();await page.waitForFunction(()=>document.documentElement.dir==='rtl');
  await page.locator('#localeButton').click();await page.locator('[data-locale=de]').click();await page.waitForFunction(()=>document.documentElement.lang==='de');
  await page.locator('#localeButton').click();await page.locator('[data-locale=tr]').click();await page.waitForFunction(()=>document.documentElement.lang==='tr');
  const untranslated={};
  await page.locator('[name=alertUrl]').fill('https://streamlabs.com/widgets/alertbox/v1/ui-fixture');
  for(const locale of ['en','de','es','fr','ru','ar','ja','tr']){
    await page.locator('#localeButton').click();await page.locator(`[data-locale=${locale}]`).click();
    await page.waitForFunction(locale=>document.documentElement.lang===locale,locale);
    await page.waitForTimeout(150);
    const leftovers=await page.evaluate(async()=>{
      const catalog=await (await fetch('/src/ui-catalog.json')).json();
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),left=[];
      while(walker.nextNode()){const node=walker.currentNode,s=node.nodeValue.trim();if(node.parentElement.closest('script,style,.locale-picker,[data-no-translate],[hidden]'))continue;if(catalog.sources.includes(s)&&/[çğıöşüÇĞİÖŞÜ]/.test(s))left.push(s);}
      return [...new Set(left)];
    });
    untranslated[locale]=leftovers;
    if(locale!=='tr')assert.deepEqual(leftovers.filter(text=>!(locale==='en'&&text==='Türkiye')),[],locale+' untranslated labels');
    assert.equal(await page.locator('[name=alertUrl]').inputValue(),'https://streamlabs.com/widgets/alertbox/v1/ui-fixture');
    if(locale==='en')assert.equal(await page.locator('#pairHeading').textContent(),'Connect the extension to SW Identity');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,locale+' overflow');
    if(['en','ar'].includes(locale))await page.screenshot({path:path.join(output,`options-${locale}.png`),fullPage:true});
  }
  await page.evaluate(async()=>{
    const {installLiveI18n}=await import('/src/live-i18n.js');
    await Promise.all([installLiveI18n({locale:'de'}),installLiveI18n({locale:'ja'}),installLiveI18n({locale:'tr'})]);
  });
  assert.equal(await page.locator('#pairHeading').textContent(),'Eklentiyi SW Identity hesabına bağla');
  assert.deepEqual(remoteRequests,[],'UI translation must remain offline');
  const catalog=JSON.parse(await fs.readFile(path.join(root,'src/ui-catalog.json'),'utf8'));
  for(const locale of ['en','de','es','fr','ru','ar','ja','tr']) {
    await page.locator('#localeButton').click();await page.locator(`[data-locale=${locale}]`).click();
    await page.waitForFunction(locale=>document.documentElement.lang===locale,locale);
    const expected=locale==='tr'?'Bağlantıyı kaydet':catalog.translations[locale]['Bağlantıyı kaydet'];
    await page.evaluate(()=>{window.navBefore=document.querySelector('#providerNav').firstElementChild;window.wrongFrames=[];});
    for(const provider of PROVIDERS) {
      await page.evaluate(({name,expected})=>{
        let active=true;const check=()=>{const text=document.querySelector('#providerForm button[type=submit]')?.textContent;if(text&&text!==expected)window.wrongFrames.push(text);if(active)requestAnimationFrame(check);};requestAnimationFrame(check);
        [...document.querySelectorAll('.provider-nav')].find(b=>b.querySelector('b').textContent===name).click();setTimeout(()=>{active=false;},80);
      },{name:provider.name,expected});
      await page.waitForFunction(name=>document.querySelector('.provider-head h2')?.textContent===name,provider.name);
      assert.equal(await page.locator('#providerForm button[type=submit]').textContent(),expected);
      assert.equal(await page.locator('[name=defaultCurrency]').inputValue(),'auto');
      assert.ok((await page.locator('[name=defaultCurrency] option:checked').textContent()).includes(({tr:'TRY',en:'USD',de:'EUR',es:'EUR',fr:'EUR',ru:'RUB',ar:'SAR',ja:'JPY'})[locale]));
    }
    assert.equal(await page.evaluate(()=>window.navBefore===document.querySelector('#providerNav').firstElementChild),true,'navigation DOM retained');
    await page.waitForTimeout(100);
    assert.deepEqual(await page.evaluate(()=>window.wrongFrames),[],locale+' source-language flash');
  }
  const requestsBeforePopup=catalogRequests;
  await page.setViewportSize({width:392,height:600});await page.goto(origin+'/popup/popup.html');await page.waitForSelector('.provider-card');
  assert.equal(catalogRequests,requestsBeforePopup,'popup reuses persistent catalog without refetch');
  await page.screenshot({path:path.join(output,'popup.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>392),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: 49 layout checks; 208 pretranslated platform views; stable navigation; cached popup reopen; 8 locale currencies; no source-language frames or JS errors.');
} finally{await browser.close();server.close();}
