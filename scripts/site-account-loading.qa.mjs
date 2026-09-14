// Local fake-account UI regression; no production account writes.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/esatb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = new URL('../', import.meta.url);
const output = new URL('../output/site-account-loading-qa/', import.meta.url);
const server = spawn(process.execPath, ['scripts/serve-site-qa.mjs'], {cwd:root,stdio:'ignore'});
let browser;
try {
  for (let i=0;i<60;i++) { try { if ((await fetch('http://127.0.0.1:8766/qa')).ok) break; } catch {} await new Promise(resolve=>setTimeout(resolve,100)); }
  await mkdir(output,{recursive:true});
  browser = await chromium.launch({headless:true,channel:'msedge'});
  const page = await browser.newPage({viewport:{width:1440,height:960}});
  const errors = []; page.on('pageerror', error=>errors.push(error.message));
  const image = await readFile(new URL('../assets/providers/kofi.png',import.meta.url));
  await page.route('https://qa.example.test/kick-avatar.png', route=>route.fulfill({contentType:'image/png',body:image}));
  await page.goto('http://127.0.0.1:8766/qa');
  await page.locator('[data-qa="data"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-ps59-card="followers"] b')?.textContent==='27');
  assert.equal(await page.locator('[data-ps59-card="subscribers"] b').textContent(),'2');
  assert.equal(await page.locator('[data-ps59-card="monthFollowers"] b').textContent(),'9');
  assert.equal(await page.locator('.ps54-kick-avatar img').getAttribute('src'),'https://qa.example.test/kick-avatar.png');
  await page.screenshot({path:new URL('account-data.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  for (const tab of ['profile','account','devices']) {
    await page.locator(`[data-ps51-tab="${tab}"]`).click();
    await page.locator('.ps135-central-account').waitFor();
    assert.equal(await page.locator('.ps51-account-pane form,.ps51-account-pane input').count(),0);
    assert.equal(await page.locator('.ps135-central-account a').first().getAttribute('href'),`https://swcreate.com/center/?view=${tab==='account'?'security':tab}`);
  }
  await page.screenshot({path:new URL('account-settings.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  await page.evaluate(()=>window.psCleanRouteApi.updates());
  await page.locator('#ps44UpdatesDialog').waitFor();
  const heading = page.locator('#ps44UpdatesDialog .ps50-version-heading').first();
  assert.equal(await heading.evaluate(node=>getComputedStyle(node).display),'flex');
  assert.equal(await heading.evaluate(node=>getComputedStyle(node).gap),'12px');
  await page.screenshot({path:new URL('updates-desktop.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  await page.setViewportSize({width:390,height:844});
  const badge = await heading.locator('.ps50-latest-badge').boundingBox();
  assert.ok(badge && badge.x>=0 && badge.x+badge.width<=390);
  await page.screenshot({path:new URL('updates-mobile.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  assert.deepEqual(errors,[]);
  console.log('PASS: server-owned Kick photo, 27/2/9 official fixtures, SW-only settings, desktop/mobile release badge spacing; no runtime errors.');
} finally { await browser?.close(); server.kill(); }
