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
  assert.match(html, /play-streamers-build" content="2026-08-31-site-10\.21\.0"/);
  assert.match(html, /site-v7\.css\?v=10\.21\.0/);
  assert.match(html, /app\.js\?v=5\.7\.0/);
  assert.match(html, /site-v7\.js\?v=10\.15\.1/);
  assert.match(html, /app-final\.js\?v=5\.19\.0/);
  assert.match(html, /live-i18n\.js\?v=10\.2\.0/);
  assert.match(css, /html\[data-ps-site-version="8"\]/);
  assert.match(css, /--signal: #f5f5f2/);
  assert.match(css, /@keyframes ps82-meteor/);
  assert.match(css, /@keyframes ps82-marquee/);
  assert.match(css, /@keyframes ps82-window-float/);
  assert.match(css, /@keyframes ps83-title-scan/);
  assert.match(css, /grid-template-columns: repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(logo, /53fc18|ff7043/i);
  assert.match(css, /html\[data-ps-site-version="9"\]/);
  assert.match(css, /#ps9Ambient/);
  assert.match(css, /ps9-surface-in/);
  assert.match(css, /ps9-sw-ai-summary/);
  assert.doesNotMatch(css, /body\.ps-v9\s*>\s*:not\(#ps9Ambient\)/);
  assert.match(logo, /Tek beyaz beşgen çerçeve/);
  assert.equal((logo.match(/stroke-width="13\.5"/g) || []).length, 2);
  assert.match(logo, /M35 120V42h18/);
  assert.match(logo, /M126 50c-7-5-14-8-21-8/);
  assert.match(css, /@keyframes ps109-loader-logo/);
  assert.match(css, /@keyframes ps110-logo-flight/);
  assert.match(css, /\.ps110-loader-emblem/);
  assert.match(logo, /stroke-linecap="round"/);
  assert.match(logo, /M80 8 147 56 122 145H38L13 56 80 8Z/);
  assert.doesNotMatch(logo, /linearGradient|circle|polygon/);
  assert.match(css, /@keyframes ps92-warp/);
  assert.match(css, /--ps92-glass/);
  assert.match(css, /@keyframes ps101-astronaut-descend/);
  assert.match(css, /\.ps10-space-detail/);
  assert.match(css, /\.ps-identity-credential-form/);
  assert.match(css, /Site 10\.3 final precedence layer/);
  assert.match(css, /Site 10\.6/);
  assert.match(css, /\.ps106-pointer-lantern/);
  assert.match(css, /backdrop-filter:blur\(21px\)/);
  assert.match(css, /Site 10\.12/);
  assert.match(css, /html\.ps-locale-switching/);
  assert.match(css, /Site 10\.20/);
  assert.match(css, /Site 10\.21/);
  assert.match(css, /\.ps63-provider-chip>img\[hidden\]/);
  assert.match(css, /\.ps57-ticket-image-loading\[hidden\]/);
  assert.match(css, /width:84px!important;height:58px!important/);
  assert.match(css, /#panelGrid>\.card \{ grid-column:span 4/);
  assert.match(css, /Site 10\.17/);
  assert.match(css, /#ps117ExchangePanel/);
  assert.match(css, /body\.ps-v9 > #ps49InfoPage\.ps53-products-copy/);
  assert.match(css, /@keyframes ps117-logo-pulse/);
  assert.match(html, /ps-i18n-booting/);
  assert.doesNotMatch(html, /translate\(-50%,-5[37]%\)/);
});

test('public home promotes the desktop app without restoring legacy hero', async () => {
  const source = await read('site-v7.js');
  assert.match(source, /className = 'landing-main ps8-home'/);
  assert.match(source, /Windows için indir/);
  assert.match(source, /Windows 10\/11 · 64 bit/);
  assert.match(source, /APP v0\.14\.4/);
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
  assert.match(source, /Hey, geleceğin yayıncısı burada mısın\?/);
  assert.match(source, /Buradaysan ben gidiyorum\./);
  assert.match(source, /psAstronautSource/);
  assert.match(source, /play-streamers-pixel-astronaut-v2\.png/);
  assert.doesNotMatch(source, />01 · NEDEN VARIZ\?</);
  assert.doesNotMatch(source, /<article class="ps8-feature-large"><span>01<\/span>/);
  assert.match(source, /current\.replaceWith\(home\)/);
  assert.doesNotMatch(source, /className = 'landing-card'/);
});

test('SW Bot audits deterministically and translation generation is release-only', async () => {
  const [app, legacyApp, worker] = await Promise.all([read('app-final.js'), read('app.js'), read('cloudflare-worker.js')]);
  assert.match(app, /<b>SW BOT<\/b>/);
  assert.match(app, /classList\.add\('ps44-dialog-layer'\)/);
  assert.match(app, /node\.closest\('\[hidden\],\[inert\]'\)/);
  assert.doesNotMatch(app, /playBotSurface\.append\(googleProbe\)/);
  assert.match(app, /window\.psSwBotOwnsStatus = true/);
  assert.match(app, /button\.dataset\.ps69IssueCount = String\(issues\.length\)/);
  assert.match(app, /getComputedStyle\(node\)\.position === 'fixed'/);
  assert.match(legacyApp, /window\.psSwBotOwnsStatus === true && issue/);
  assert.match(app, /\/api\/sw-bot\/status/);
  assert.match(app, /Ekibimiz sorun üzerinde çalışıyor\./);
  assert.match(app, /unnamedControls/);
  assert.match(app, /inertLinks/);
  assert.match(app, /clippedControls/);
  assert.match(app, /visibleFloaters/);
  assert.match(app, /captureLocaleSurface/);
  assert.match(app, /restoreLocaleSurface/);
  assert.match(app, /data-ps119-exchange/);
  assert.match(app, /surface: 'member'/);
  assert.match(app, /surface: 'dashboard'/);
  assert.match(app, /ps119ExchangePanel/);
  assert.match(app, /let lastRatePointerPress = 0/);
  assert.match(app, /Date\.now\(\) - lastRatePointerPress > 700/);
  assert.doesNotMatch(app, /Açıkken 5 saniyede bir kontrol edilir/);
  assert.match(app, /ps119-account-shell/);
  assert.match(app, /ps119-account-user/);
  assert.match(app, /localizeAccountNavigation/);
  assert.match(worker, /sw-bot:global-status:v15/);
  assert.doesNotMatch(worker, /explainSwBotIssuesWithAi/);
  assert.match(worker, /swBotDeterministicReport/);
  assert.match(worker, /resolveSwBotReports/);
  assert.match(worker, /sw_bot_issue_reports/);
  assert.match(worker, /site-v7\.css\?v=10\.21\.0/);
  assert.match(worker, /site-v7\.js\?v=10\.15\.1/);
  assert.match(worker, /\/api\/i18n\/translate/);
  assert.match(worker, /i18n:v9/);
  assert.match(worker, /translationProvider: "local-static-build"/);
  assert.match(worker, /STATIC_I18N_ONLY/);
  assert.doesNotMatch(worker, /GOOGLE_TRANSLATE_API_KEY/);
  assert.doesNotMatch(worker, /translation\.googleapis\.com/);
  assert.match(worker, /\/api\/public\/exchange-rates/);
  assert.match(worker, /api\.frankfurter\.dev\/v2\/rates/);
  assert.match(worker, /EXCHANGE_CACHE_SECONDS/);
  assert.doesNotMatch(worker, /EXCHANGE.*KV/);
  assert.match(worker, /Fransızca dil paketi/);
  assert.match(worker, /locales\/fr\.json\?v=2026-08-31\.1/);
  assert.match(worker, /content-security-policy/);
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(worker, /strict-transport-security/);
  assert.doesNotMatch(worker, /env\.SESSIONS/);
  assert.match(worker, /LEGACY_PLAY_STREAMERS_AUTH_PATHS/);
  assert.match(worker, /SW_IDENTITY_REQUIRED/);
  assert.match(worker, /terms\.html/);
});

test('SW Identity owns direct login and registration without legacy account leakage', async () => {
  const [app, identityWorker, i18n, identityAccount, callback] = await Promise.all([
    read('app.js'),
    read('swcreate-site/cloudflare-worker.js'),
    read('live-i18n.js'),
    read('swcreate-site/src/AccountPage.tsx'),
    read('identity/callback/index.html'),
  ]);
  assert.match(app, /showLandingAuthV101/);
  assert.match(app, /name=\"identity\"/);
  assert.match(app, /name=\"passwordRepeat\"/);
  assert.match(app, /name=\"birthDate\"/);
  assert.match(app, /data-provider=\"sw\"/);
  assert.match(app, /submitSwIdentityCredentials/);
  assert.match(app, /data-turnstile-slot/);
  assert.match(app, /appearance: 'always'/);
  assert.match(app, /execution: 'render'/);
  assert.match(app, /PUBLIC_SITE_KEY_FALLBACK/);
  assert.doesNotMatch(app, /turnstile\.execute/);
  assert.match(app, /retry: 'auto'/);
  assert.match(app, /language: state\.language/);
  assert.match(app, /ps:turnstile-language-change/);
  assert.match(app, /data-auth-turnstile-retry/);
  assert.match(app, /Güvenlik kontrolünü yeniden yükle/);
  assert.doesNotMatch(app, /ps-auth-verification-state/);
  assert.match(app, /\/api\/sw-identity\/\$\{isLogin\?'login':'register'\}/);
  assert.match(app, /window\.psSetLocale/);
  assert.match(app, /adoptAuthenticatedUser\(data\.user\);state\.settings\.userSession=activeUserSession/);
  assert.match(identityWorker, /hostname === \"pstreamers\.com\"/);
  assert.match(app, /installIdentityCalendar/);
  assert.match(app, /productRedirectUrl/);
  assert.match(identityWorker, /SW_IDENTITY_VERSION = "1\.8\.2"/);
  assert.match(identityWorker, /createProductHandoffTarget/);
  assert.match(identityWorker, /handleInternalProductAccount/);
  assert.match(identityWorker, /\/api\/internal\/account\/profile/);
  assert.match(identityWorker, /\/api\/internal\/account\/security\/challenge/);
  assert.match(i18n, /ps-live-i18n-v16/);
  assert.match(i18n, /criticalVerificationSources/);
  assert.match(i18n, /\/locales\/\$\{language\}\.json/);
  assert.match(i18n, /warmCatalogs/);
  assert.match(i18n, /window\.psSetLocale/);
  assert.match(i18n, /Her şey tek platformda\./);
  assert.doesNotMatch(i18n, /api\/i18n\/translate/);
  assert.match(i18n, /sürümlü dil paketinden boyanır/);
  assert.match(i18n, /Eksik bir metin/);
  assert.doesNotMatch(i18n, /Promise\.all\(group\.map\(async strings =>/);
  assert.match(i18n, /ps-locale-switching/);
  assert.match(i18n, /SKIP_ATTRIBUTE_SELECTOR/);
  assert.match(identityAccount, /https:\/\/pstreamers\.com/);
  assert.match(callback, /sw_identity_callback/);
  const worker = await read('cloudflare-worker.js');
  assert.match(worker, /proxySwIdentityCredentialRequest/);
  assert.match(worker, /proxySwIdentityAccountRequest/);
  assert.match(worker, /\/api\/sw-identity\/login/);
  assert.match(worker, /\/api\/sw-identity\/account\/profile/);
});

test('privacy and terms share the premium legal design', async () => {
  const [privacy, terms, legalCss] = await Promise.all([read('privacy.html'), read('terms.html'), read('legal-v9.css')]);
  assert.match(privacy, /legal-v9\.css\?v=10\.5\.0/);
  assert.match(privacy, /Kullanım Koşulları/);
  assert.match(terms, /play-streamers-build" content="2026-08-29-legal-10\.11\.2"/);
  assert.match(terms, /SW Bot ve SW AI/);
  assert.match(legalCss, /@keyframes legal-stars/);
  assert.match(legalCss, /\.brand-mark img/);
});

test('versioned locale catalogs cover public, account, support and legal surfaces', async () => {
  const requiredSources = [
    'Giriş yap', 'Kullanım Koşulları', 'Gizlilik Politikası', 'Destek',
    'SW Identity hesabı oluştur', 'Yayın akışı', 'ÇALIŞMA MERKEZİ',
    'Yayın araçların hazır.', 'BİLDİRİMLER', 'HESAP MERKEZİ · VERİLER',
    'HESAP MERKEZİ · DESTEK TALEPLERİ', 'Dosyayı kaldır',
    'SUNUCU VERİ HATTI', 'Uygulama kapalıyken de ölçüm açık', 'Tepe izleyici', 'Sunucu oturumu',
    'Doğrulanmış oturumlar ve izleyici örnekleri sunucuda işlenir.',
    'BAĞLANTI DURUMU', 'Çıkış yapmak istiyor musun?', 'Veriler', 'Destek talepleri',
    'Hedef panosu', 'Hedef adı', 'İlerleme', 'Dashboard verisini indir',
    'Taslak oluştur', 'Anlık görüntü kaydet', 'Henüz anlık görüntü yok.',
    'E-posta adresini değiştir', 'Şifreyi güncelle', 'Kodu gönder',
    'Profil görünümü', 'Profili kaydet', 'E-posta', 'Doğrulanmış',
    'Play Bot, SW Bot oldu; canlı dosyalar, arayüz kontrolleri, bağlantılar ve katman çakışmaları daha geniş kapsamda denetleniyor.',
  ];
  for (const language of ['en', 'de', 'es', 'fr', 'ru', 'ar', 'ja']) {
    const catalog = JSON.parse(await read(`locales/${language}.json`));
    assert.equal(catalog.version, '2026-08-31.1');
    assert.equal(catalog.sourceLanguage, 'tr');
    assert.equal(catalog.language, language);
    assert.ok(Object.keys(catalog.translations).length >= 1000);
    requiredSources.forEach(source => assert.ok(catalog.translations[source], `${language}: ${source}`));
    assert.ok(catalog.translations['DİL SEÇİMİ'], `${language}: DİL SEÇİMİ`);
    assert.ok(catalog.translations['2s 48dk'], `${language}: 2s 48dk`);
    assert.ok(catalog.translations['Hey, geleceğin yayıncısı burada mısın?'], `${language}: astronot selamlaması`);
    assert.ok(catalog.translations['Buradaysan ben gidiyorum.'], `${language}: astronot vedası`);
  }
});

test('desktop installer referenced by the public home exists', async () => {
  const installer = await stat(new URL('downloads/Play-Streamers-Setup.exe', root));
  assert.ok(installer.isFile());
  assert.ok(installer.size > 1_000_000);
});
