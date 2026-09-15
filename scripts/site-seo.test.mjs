import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/esatb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const routes = [
  ['about', '/about', 'Hakkımızda · Play Streamers'],
  ['products', '/products', 'Ürünlerimiz · Play Streamers'],
  ['how-it-works', '/how-it-works', 'Nasıl Çalışır? · Play Streamers'],
  ['play-connect', '/play-connect', 'Play Connect · Play Streamers']
];

const index = await read('index.html');
const notFound = await read('404.html');
const robots = await read('robots.txt');
const sitemap = await read('sitemap.xml');
assert.match(index, /rel="canonical" href="https:\/\/pstreamers\.com\/"/);
assert.match(index, /property="og:image" content="https:\/\/pstreamers\.com\/play-streamers-social-card\.png"/);
assert.match(index, /name="twitter:card" content="summary_large_image"/);
assert.match(index, /"@type": "Organization"/);
assert.match(index, /"@type": "SoftwareApplication"/);
assert.match(notFound, /<meta name="robots" content="noindex,nofollow">/);
assert.match(notFound, /<title>Sayfa bulunamadı · Play Streamers<\/title>/);
assert.match(notFound, /<h1[^>]*>Bu yayın burada değil\.<\/h1>/);
assert.match(notFound, /href="\/"[^>]*>Ana sayfaya dön<\/a>/);
assert.match(notFound, /\^\\\/@\[a-z0-9_-\]\{2,40\}/);
assert.match(robots, /Sitemap: https:\/\/pstreamers\.com\/sitemap\.xml/);
assert.doesNotMatch(robots, /Disallow: \/$/m);
for (const [, route] of routes) assert.match(sitemap, new RegExp(`<loc>https://pstreamers\\.com${route}<\\/loc>`));

for (const [directory, route, title] of routes) {
  const html = await read(`${directory}/index.html`);
  assert.match(html, new RegExp(`<title>${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/title>`));
  assert.match(html, new RegExp(`rel="canonical" href="https://pstreamers\\.com${route}"`));
  assert.match(html, new RegExp(`property="og:url" content="https://pstreamers\\.com${route}"`));
  const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
  assert.ok(jsonLd.length >= 2, `${route} must include site and WebPage structured data`);
}

const png = await readFile(new URL('../play-streamers-social-card.png', import.meta.url));
assert.equal(png.readUInt32BE(16), 1200);
assert.equal(png.readUInt32BE(20), 630);

const server = spawn(process.execPath, ['scripts/serve-site-qa.mjs'], { cwd: root, stdio: 'ignore' });
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch('http://127.0.0.1:8766/play-connect')).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'tr-TR' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('ps15-locale', 'tr');
    localStorage.setItem('ps-locale-source', 'user');
  });
  const notFoundResponse = await page.goto('http://127.0.0.1:8766/404.html');
  assert.equal(notFoundResponse.status(), 200);
  assert.equal(await page.title(), 'Sayfa bulunamadı · Play Streamers');
  assert.equal(await page.locator('h1').innerText(), 'Bu yayın burada değil.');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex,nofollow');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  const notFoundHeadings = {
    tr: 'Bu yayın burada değil.',
    en: "This stream isn't here.",
    de: 'Dieser Stream ist nicht hier.',
    es: 'Esta transmisión no está aquí.',
    fr: 'Ce stream n’est pas ici.',
    ru: 'Этой трансляции здесь нет.',
    ar: 'هذا البث غير موجود هنا.',
    ja: 'この配信はここにはありません。'
  };
  for (const [language, heading] of Object.entries(notFoundHeadings)) {
    await page.locator('#pageLanguage').selectOption(language);
    assert.equal(await page.locator('h1').innerText(), heading);
    assert.equal(await page.locator('html').getAttribute('lang'), language);
    assert.equal(await page.locator('html').getAttribute('dir'), language === 'ar' ? 'rtl' : 'ltr');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const language of ['de', 'ru', 'ar', 'ja']) {
    await page.locator('#pageLanguage').selectOption(language);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#pageLanguage').selectOption('tr');
  await page.route(/^https:\/\/(?!127\.0\.0\.1).*/, route => {
    const type = route.request().resourceType();
    if (type === 'stylesheet') return route.fulfill({ contentType: 'text/css', body: '' });
    if (type === 'script') return route.fulfill({ contentType: 'text/javascript', body: '' });
    return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
  });
  await page.goto('http://127.0.0.1:8766/play-connect');
  await page.locator('#ps49InfoPage h1').filter({ hasText: 'Play Connect' }).waitFor({ timeout: 12000 });
  assert.equal(await page.title(), 'Play Connect · Play Streamers');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://pstreamers.com/play-connect');
  assert.equal(await page.locator('.ps-connect-store-actions a').count(), 1);
  assert.equal(await page.locator('.ps-connect-store-actions a').getAttribute('href'), '/');
  assert.equal(await page.locator('a[href*="chromewebstore.google.com"],a[href*="addons.mozilla.org"]').count(), 0);
  assert.ok(await page.locator('.ps-public-seo-links a[href="/about"]').count());
  await page.locator('#ps49InfoPage .ps-public-seo-links a[href="/about"]').click();
  await page.locator('#ps49InfoPage h1').filter({ hasText: 'Hakkımızda' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/about');
  assert.equal(await page.title(), 'Hakkımızda · Play Streamers');
  await page.locator('#ps49InfoPage .ps14-nav-links button[data-info="products"]').click();
  await page.locator('#ps49InfoPage h1').filter({ hasText: 'Yayınını yönet' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/products');
  assert.equal(await page.title(), 'Ürünlerimiz · Play Streamers');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:8766/play-connect');
  await page.locator('.ps-connect-store-actions a').first().waitFor({ state: 'visible' });
  assert.equal(await page.locator('.ps-connect-store-actions a').count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  await page.goto('http://127.0.0.1:8766/?ps_route=%2Fhow-it-works');
  await page.locator('#ps49InfoPage h1').filter({ hasText: 'Nasıl çalışır?' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/how-it-works');
  for (const [, route, title] of routes) {
    const response = await page.goto(`http://127.0.0.1:8766${route}`);
    assert.equal(response.status(), 200);
    await page.locator('#ps49InfoPage h1').waitFor({ state: 'visible' });
    assert.equal(await page.title(), title);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://pstreamers.com${route}`);
  }
  await page.goto('http://127.0.0.1:8766/?ps_route=https%3A%2F%2Fevil.example%2Fabout');
  await page.waitForTimeout(500);
  assert.equal(new URL(page.url()).origin, 'http://127.0.0.1:8766');
  assert.equal(new URL(page.url()).pathname, '/');
  await mkdir(new URL('../output/site-seo-qa/', import.meta.url), { recursive: true });
  for (const [name, width, height] of [['desktop', 1440, 960], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:8766/play-connect');
    await page.locator('#ps49InfoPage h1').waitFor({ state: 'visible' });
    // Check the settled surface too, not only the first animation frame.
    await page.waitForTimeout(5000);
    const settled = await page.locator('#ps49InfoPage .ps49-info-content').evaluate(node => ({
      opacity: getComputedStyle(node).opacity,
      filter: getComputedStyle(node).filter
    }));
    assert.equal(settled.opacity, '1');
    assert.equal(settled.filter, 'none');
    await page.screenshot({ path: fileURLToPath(new URL(`../output/site-seo-qa/play-connect-${name}.png`, import.meta.url)), fullPage: true });
  }
  await page.evaluate(() => {
    window.psDesktopNavigate = () => {};
    window.psCleanRouteApi.publicHome();
    window.psCleanRouteApi.publicInfo('connect');
  });
  let documentRequests = 0;
  page.on('request', request => { if (request.isNavigationRequest()) documentRequests += 1; });
  await page.locator('#ps49InfoPage .ps-public-seo-links a[href="/about"]').click();
  await page.locator('#ps49InfoPage h1').filter({ hasText: 'Hakkımızda' }).waitFor();
  await page.locator('#ps49InfoPage .ps-public-seo-links a[href="/play-connect"]').click();
  await page.locator('#ps49InfoPage h1').filter({ hasText: 'Play Connect' }).waitFor();
  assert.equal(documentRequests, 0, 'desktop public links must stay inside the bundled application');
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  server.kill();
}

console.log('SEO routes, metadata, structured data, social card and public navigation: OK');
