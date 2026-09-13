import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/esatb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(import.meta.dirname, '..');
const evidenceDir = path.join(root, 'output', 'release-notes-qa');

async function waitFor(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Sunucu hazır olmadı: ${url}`);
}

const siteServer = spawn(process.execPath, ['scripts/serve-site-qa.mjs'], { cwd: root, stdio: 'ignore' });
const swServer = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4180'], {
  cwd: path.join(root, 'swcreate-site'),
  stdio: 'ignore'
});

try {
  await Promise.all([
    waitFor('http://127.0.0.1:8766/qa'),
    waitFor('http://127.0.0.1:4180/updates/')
  ]);
  await mkdir(evidenceDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

  const site = await context.newPage();
  await site.addInitScript(() => {
    localStorage.setItem('ps15-locale', 'tr');
    localStorage.setItem('ps-locale-source', 'user');
  });
  await site.goto('http://127.0.0.1:8766/qa');
  await site.evaluate(() => window.psCleanRouteApi.updates());
  await site.locator('#ps44UpdatesDialog').waitFor({ state: 'visible' });
  assert.deepEqual(await site.locator('.ps-release-product-tabs button').allTextContents(), [
    'Play Streamers Web Güncelleme Notları',
    'Play Streamers App Güncelleme Notları',
    'Play Connect Güncelleme Notları'
  ]);
  assert.equal(await site.locator('.ps-release-product-tabs button').count(), 3);
  assert.ok(await site.locator('#ps44UpdatesDialog .beta-release').count() > 0);
  const siteStableBorder = await site.locator('#ps44UpdatesDialog .stable-release').first().evaluate(node => getComputedStyle(node).borderColor);
  const siteBetaBorder = await site.locator('#ps44UpdatesDialog .beta-release').first().evaluate(node => getComputedStyle(node).borderColor);
  assert.notEqual(siteStableBorder, siteBetaBorder);
  await site.locator('.ps-release-product-tabs button').filter({hasText:'Play Connect'}).click();
  for (const version of ['1.7','1.8','1.9','2.0']) {
    assert.ok((await site.locator('#ps44UpdatesDialog').innerText()).includes(version), `${version} missing from website UI`);
  }
  await site.screenshot({ path: path.join(evidenceDir, 'play-streamers-web.png'), fullPage: true });

  const connect = await context.newPage();
  await connect.addInitScript(() => {
    const listeners = [];
    globalThis.chrome = {
      i18n: { getUILanguage: () => 'tr-TR' },
      runtime: {
        getManifest: () => ({ version: '2.1', version_name: '2.1' }),
        sendMessage: async message => message?.type === 'GET_STATE'
          ? { ok: true, result: {
              connection: { paired: false, serverConnectedProviderIds: [] },
              providerCatalog: [{ id: 'kofi', name: 'Ko-fi', region: 'Global', icon: 'assets/providers/kofi.png' }],
              providers: { kofi: {} }, featuredProviderIds: ['kofi'], activity: [], queueCount: 0
            } }
          : { ok: true, result: {} }
      },
      storage: {
        session: { get: async () => ({}), remove: async () => undefined },
        onChanged: { addListener: listener => listeners.push(listener) }
      }
    };
  });
  await connect.goto('http://127.0.0.1:8766/play-connect/options/options.html');
  assert.equal(await connect.locator('#extensionVersion').textContent(), 'v2.1');
  await connect.locator('#updateNotesButton').click();
  await connect.locator('#updateNotesModal').waitFor({ state: 'visible' });
  assert.equal(await connect.locator('#updateNotesTitle').textContent(), 'Play Connect Güncelleme Notları');
  assert.equal(await connect.locator('#updateNotesList article').count(), 21);
  for (const version of ['1.7','1.8','1.9','2.0']) {
    assert.ok((await connect.locator('#updateNotesList').innerText()).includes(version), `${version} missing from Connect UI`);
  }
  assert.ok(await connect.locator('#updateNotesList .beta-release').count() > 0);
  const connectStableBorder = await connect.locator('#updateNotesList .stable-release').first().evaluate(node => getComputedStyle(node).borderColor);
  const connectBetaBorder = await connect.locator('#updateNotesList .beta-release').first().evaluate(node => getComputedStyle(node).borderColor);
  assert.notEqual(connectStableBorder, connectBetaBorder);
  await connect.locator('#updateNotesClose').click();
  await connect.locator('#localeButton').click();
  await connect.locator('#localeMenu button[data-locale="en"]').click();
  await connect.locator('#updateNotesButton').click();
  await connect.locator('#updateNotesTitle').waitFor({ state: 'visible' });
  assert.equal(await connect.locator('#updateNotesTitle').textContent(), 'Play Connect Update Notes');
  await connect.screenshot({ path: path.join(evidenceDir, 'play-connect-english.png'), fullPage: true });

  const sw = await context.newPage();
  await sw.route('**/api/account', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, user: { id: 'qa', email: 'qa@example.test' } })
  }));
  await sw.goto('http://127.0.0.1:4180/updates/');
  await sw.locator('.sw-update-tabs').waitFor({ state: 'visible' });
  assert.deepEqual(await sw.locator('.sw-update-tabs button strong').allTextContents(), [
    'SW Create Güncelleme Notları',
    'SW Identity Güncelleme Notları',
    'Play Streamers Web Güncelleme Notları',
    'Play Streamers App Güncelleme Notları',
    'Play Connect Güncelleme Notları'
  ]);
  assert.equal(await sw.locator('.sw-update-tabs button').count(), 5);
  await sw.locator('.sw-update-tabs button').filter({hasText:'Play Connect'}).click();
  for (const version of ['1.7','1.8','1.9','2.0']) {
    assert.ok((await sw.locator('.sw-update-notes').innerText()).includes(version), `${version} missing from SW Create UI`);
  }
  assert.ok(await sw.locator('.sw-update-notes .beta-release').count() > 0);
  const swStableBorder = await sw.locator('.sw-update-notes .stable-release').first().evaluate(node => getComputedStyle(node).borderBottomColor);
  const swBetaBorder = await sw.locator('.sw-update-notes .beta-release').first().evaluate(node => getComputedStyle(node).borderColor);
  assert.notEqual(swStableBorder, swBetaBorder);
  const languageSelect = sw.locator('.sw-updates-header-actions select');
  await languageSelect.selectOption('en');
  assert.deepEqual(await sw.locator('.sw-update-tabs button strong').allTextContents(), [
    'SW Create Update Notes',
    'SW Identity Update Notes',
    'Play Streamers Web Update Notes',
    'Play Streamers App Update Notes',
    'Play Connect Update Notes'
  ]);
  await languageSelect.selectOption('ar');
  assert.equal(await sw.locator('html').getAttribute('dir'), 'rtl');
  await sw.screenshot({ path: path.join(evidenceDir, 'sw-create-arabic.png'), fullPage: true });

  await browser.close();
  console.log('Release notes UI QA passed: web=3 tabs, Play Connect=21 releases, SW Create=5 tabs, missing versions restored, beta styling and locale switches verified.');
} finally {
  siteServer.kill();
  swServer.kill();
}
