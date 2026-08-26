import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');

test('site 10 assets are cache-busted and use fluid monochrome glass', async () => {
  const [html, css, logo] = await Promise.all([
    read('index.html'),
    read('site-v7.css'),
    read('play-streamers-ps-logo.svg'),
  ]);
  assert.match(html, /play-streamers-build" content="2026-08-26-site-10\.0\.7"/);
  assert.match(html, /site-v7\.css\?v=10\.0\.7/);
  assert.match(html, /app\.js\?v=5\.3\.1/);
  assert.match(html, /site-v7\.js\?v=10\.0\.7/);
  assert.match(html, /app-final\.js\?v=5\.7\.5/);
  assert.match(html, /live-i18n\.js\?v=2\.0/);
  assert.match(css, /html\[data-ps-site-version="8"\]/);
  assert.match(css, /--signal: #f5f5f2/);
  assert.match(css, /@keyframes ps82-meteor/);
  assert.match(css, /@keyframes ps82-marquee/);
  assert.match(css, /@keyframes ps82-window-float/);
  assert.match(css, /@keyframes ps83-title-scan/);
  assert.match(css, /grid-template-columns: repeat\(12,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(logo, /53fc18|ff7043/i);
  assert.match(css, /html\[data-ps-site-version="9"\]/);
  assert.match(css, /#ps9Ambient/);
  assert.match(css, /ps9-surface-in/);
  assert.match(css, /ps9-sw-ai-summary/);
  assert.doesNotMatch(css, /body\.ps-v9\s*>\s*:not\(#ps9Ambient\)/);
  assert.match(logo, /aria-label="Play Streamers akış yörüngesi amblemi"/);
  assert.match(logo, /id="ps10Shell"/);
  assert.match(css, /@keyframes ps92-warp/);
  assert.match(css, /--ps92-glass/);
});

test('public home promotes the desktop app without restoring legacy hero', async () => {
  const source = await read('site-v7.js');
  assert.match(source, /className = 'landing-main ps8-home'/);
  assert.match(source, /Windows için indir/);
  assert.match(source, /Windows 10\/11 · 64 bit/);
  assert.match(source, /APP v0\.14\.2/);
  assert.match(source, /data-ps8-action="register"/);
  assert.match(source, /data-ps8-action="products"/);
  assert.match(source, /id="ps8-about"/);
  assert.match(source, /id="ps8-products"/);
  assert.match(source, /id="ps8-how"/);
  assert.match(source, /window\.psPublicHomeNavigate = navigatePublicHome/);
  assert.match(source, /root\.scrollTo/);
  assert.match(source, /aria-label="PLAY STREAMERS"><span>PLAY<\/span><span>STREAMERS<\/span>/);
  assert.match(source, /class="ps81-showcase"/);
  assert.match(source, /className = 'ps81-nav-download'/);
  assert.match(source, /class="ps82-motion-field"/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /ps83-metrics-empty/);
  assert.match(source, /ensurePremiumAmbient/);
  assert.match(source, /animateNewSurfaces/);
  assert.match(source, /SW Bot denetimde/);
  assert.match(source, /SW Bot \+ SW AI/);
  assert.match(source, /Play Streamers Plans/);
  assert.match(source, /SW Create Plans/);
  assert.match(source, /Play Streamers Product Pro/);
  assert.match(source, /SW Create Product Pro Edition/);
  assert.match(source, /data-ps92-plan-tab="play"/);
  assert.match(source, /class="ps92-warp-field"/);
  assert.match(source, /https:\/\/swcreate\.com/);
  assert.match(source, /Play Streamers Web/);
  assert.match(source, /Play Streamers App/);
  assert.match(source, /scheduleAstronaut/);
  assert.match(source, /Her geleceğin yayıncısı/);
  assert.doesNotMatch(source, />01 · NEDEN VARIZ\?</);
  assert.doesNotMatch(source, /<article class="ps8-feature-large"><span>01<\/span>/);
  assert.match(source, /current\.replaceWith\(home\)/);
  assert.doesNotMatch(source, /className = 'landing-card'/);
});

test('SW Bot audits the whole interface and explains issues with SW AI', async () => {
  const [app, legacyApp, worker] = await Promise.all([read('app-final.js'), read('app.js'), read('cloudflare-worker.js')]);
  assert.match(app, /<b>SW BOT<\/b>/);
  assert.match(app, /classList\.add\('ps44-dialog-layer'\)/);
  assert.match(app, /node\.closest\('\[hidden\],\[inert\]'\)/);
  assert.doesNotMatch(app, /playBotSurface\.append\(googleProbe\)/);
  assert.match(app, /window\.psSwBotOwnsStatus = true/);
  assert.match(app, /button\.dataset\.ps69IssueCount = String\(issues\.length\)/);
  assert.match(app, /getComputedStyle\(ancestor\)\.position === 'fixed'/);
  assert.match(legacyApp, /window\.psSwBotOwnsStatus === true && issue/);
  assert.match(app, /\/api\/sw-bot\/status/);
  assert.match(app, /Ekibimiz sorun üzerinde çalışıyor\./);
  assert.match(app, /unnamedControls/);
  assert.match(app, /inertLinks/);
  assert.match(app, /clippedControls/);
  assert.match(app, /visibleFloaters/);
  assert.match(worker, /sw-bot:global-status:v11/);
  assert.match(worker, /explainSwBotIssuesWithAi/);
  assert.match(worker, /swBotDeterministicReport/);
  assert.match(worker, /site-v7\.css\?v=10\.0\.5/);
  assert.match(worker, /\/api\/i18n\/translate/);
  assert.match(worker, /LEGACY_PLAY_STREAMERS_AUTH_PATHS/);
  assert.match(worker, /SW_IDENTITY_REQUIRED/);
  assert.match(worker, /terms\.html/);
});

test('privacy and terms share the premium legal design', async () => {
  const [privacy, terms, legalCss] = await Promise.all([read('privacy.html'), read('terms.html'), read('legal-v9.css')]);
  assert.match(privacy, /legal-v9\.css\?v=9\.0/);
  assert.match(privacy, /Kullanım Koşulları/);
  assert.match(terms, /play-streamers-build" content="2026-08-26-legal-9\.2"/);
  assert.match(terms, /SW Bot ve SW AI/);
  assert.match(legalCss, /@keyframes legal-stars/);
  assert.match(legalCss, /\.brand-mark img/);
});

test('desktop installer referenced by the public home exists', async () => {
  const installer = await stat(new URL('downloads/Play-Streamers-Setup.exe', root));
  assert.ok(installer.isFile());
  assert.ok(installer.size > 1_000_000);
});
