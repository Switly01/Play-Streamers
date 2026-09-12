import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/esatb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ headless:true, channel:'msedge' });
const context = await browser.newContext({ viewport:{width:1280,height:800} });
await context.route('https://api.pstreamers.com/api/public/creator-pages/test-yayinci', route => route.fulfill({ json:{
  ok:true,
  page:{slug:'test-yayinci',title:'Test <script>window.__xss=1</script>',bio:'Güvenli yayıncı sayfası',profileImageUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',appearance:{backgroundType:'image',backgroundUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='},avatarUrl:'https://api.pstreamers.com/api/public/creator-pages/test-yayinci/avatar',accent:'#8ca8ff',background:'aurora',surface:'glass',radius:24,blocks:[
    {id:'hero-card',type:'hero',title:'Hoş geldin',body:'Takvim ve bağlantılar burada.',url:'',label:'',width:'full',visible:true},
    {id:'calendar-card',type:'schedule',title:'Bu hafta',body:'Pazartesi · 20:00\nCuma · 21:00',url:'',label:'',width:'half',visible:true},
    {id:'unsafe-card',type:'links',title:'Güvensiz bağlantı',body:'HTTP kabul edilmez',url:'http://unsafe.example',label:'Aç',width:'half',visible:true},
    {id:'safe-card',type:'video',title:'Son video',body:'Yeni bölüm',url:'https://example.com/video',label:'İzle',width:'full',visible:true},
  ]},
  live:{status:'live',title:'Canlı test yayını',currentViewers:72},
} }));
await context.route('https://api.pstreamers.com/api/public/creator-pages/test-yayinci/avatar', route => route.fulfill({
  status:200,
  contentType:'image/png',
  body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'),
}));
const page = await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.setContent('<!doctype html><html lang="tr"><body></body></html>');
await page.addScriptTag({ path:fileURLToPath(new URL('../creator-page-public.js',import.meta.url)) });
await page.evaluate(() => window.psCreatorPage.render('test-yayinci'));
await page.locator('.pscp-root').waitFor();
await page.getByRole('heading',{name:'Test <script>window.__xss=1</script>'}).waitFor();
assert.equal(await page.evaluate(()=>window.__xss),undefined);
assert.equal(await page.locator('.pscp-card').count(),4);
assert.equal(await page.locator('.pscp-avatar img').count(),1);
assert.match(await page.locator('.pscp-avatar img').getAttribute('src'),/^data:image\/png;base64,/);
assert.match(await page.locator('.pscp-root').getAttribute('style'),/data:image/);
assert.equal(await page.locator('.pscp-brand a,a.pscp-brand').count(),0);
assert.equal(await page.locator('.pscp-avatar img').getAttribute('alt'),'Yayıncı profil resmi');
assert.equal(await page.getByRole('link',{name:'İzle ↗'}).getAttribute('href'),'https://example.com/video');
assert.equal(await page.getByRole('link',{name:'Aç ↗'}).count(),0);
assert.deepEqual(errors,[]);
await browser.close();
console.log(JSON.stringify({result:'PASS',cards:4,avatar:'synced',xss:'blocked',unsafeUrl:'blocked'}));
