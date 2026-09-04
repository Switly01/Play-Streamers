import { chromium } from 'file:///C:/Users/esatb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PROVIDERS, FEATURED_PROVIDER_IDS } from '../play-connect/src/providers.js';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const extensionRoot = path.join(repositoryRoot, 'play-connect');
const outputRoot = path.join(repositoryRoot, 'chrome-web-store-assets');
const browserPath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const mimeType = file => file.endsWith('.js') ? 'text/javascript'
  : file.endsWith('.css') ? 'text/css'
    : file.endsWith('.html') ? 'text/html'
      : file.endsWith('.json') ? 'application/json'
        : file.endsWith('.svg') ? 'image/svg+xml'
          : 'image/png';

const server = http.createServer(async (request, response) => {
  const requestedPath = new URL(request.url, 'http://localhost').pathname;
  const file = path.resolve(extensionRoot, `.${requestedPath}`);
  if (!file.startsWith(`${extensionRoot}${path.sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    response.setHeader('Content-Type', mimeType(file));
    response.end(await fs.readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: browserPath, headless: true });

const commonState = () => {
  const providers = Object.fromEntries(PROVIDERS.map(provider => [provider.id, {
    enabled: false,
    status: 'setup',
    defaultCurrency: 'TRY',
    currencyMode: 'locale'
  }]));
  Object.assign(providers.bynogame, {
    enabled: true,
    status: 'connected',
    hasAlertUrl: true,
    alertFrameStatus: 'active',
    capturedEventCount: 24,
    deliveredCount: 24,
    lastRealEventAt: Date.now() - 48_000
  });
  Object.assign(providers.streamlabs, {
    enabled: true,
    status: 'connected',
    hasAlertUrl: true,
    alertFrameStatus: 'active',
    capturedEventCount: 18,
    deliveredCount: 18,
    lastRealEventAt: Date.now() - 92_000
  });
  Object.assign(providers.itemsatis, {
    enabled: true,
    status: 'connected',
    hasAlertUrl: true,
    alertFrameStatus: 'active',
    capturedEventCount: 7,
    deliveredCount: 7,
    lastRealEventAt: Date.now() - 180_000
  });
  return {
    uiLocale: 'tr',
    connection: {
      paired: true,
      hasDeviceToken: true,
      deviceName: 'Play Connect Chrome',
      accountEmail: 'yayinci@pstreamers.com',
      lastDeliveryAttemptAt: Date.now() - 48_000,
      lastDeliveryHttpStatus: 202,
      lastServerEventCount: 49,
      serverConnectedProviderIds: ['streamlabs']
    },
    providers,
    providerCatalog: PROVIDERS,
    featuredProviderIds: FEATURED_PROVIDER_IDS,
    activity: [
      { type: 'success', message: 'Bağış güvenli biçimde Play Streamers hesabına aktarıldı.', providerId: 'bynogame', at: Date.now() - 48_000 },
      { type: 'success', message: 'OBS / Alert Box bağlantısı doğrulandı.', providerId: 'streamlabs', at: Date.now() - 92_000 }
    ],
    queueCount: 0
  };
};

async function installFixture(page) {
  await page.route('https://**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.addInitScript(state => {
    window.storeState = state;
    window.chrome = {
      i18n: { getUILanguage: () => navigator.language },
      runtime: {
        id: 'play-connect-store-preview',
        getManifest: () => ({ version: '1.15.2' }),
        getURL: value => `${location.origin}/${value}`,
        sendMessage: async message => {
          if (message.type === 'GET_PROVIDER_ALERT_URL') {
            return { ok: true, result: { url: state.providers[message.providerId]?.hasAlertUrl ? 'https://streamlabs.com/widgets/alertbox/v1/store-preview' : '' } };
          }
          return { ok: true, result: state };
        }
      },
      storage: {
        session: { get: async () => ({}), remove: async () => {}, set: async () => {} },
        onChanged: { addListener() {} }
      },
      tabs: { create: async () => {} }
    };
  }, commonState());
}

async function screenshotOptions(fileName, providerId, locale = 'tr', zoom = '0.91') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: locale === 'tr' ? 'tr-TR' : 'en-US', deviceScaleFactor: 1 });
  await installFixture(page);
  await page.goto(`${origin}/options/options.html?provider=${providerId}`);
  await page.waitForSelector('#providerForm');
  if (locale !== 'tr') {
    await page.locator('#localeButton').click();
    await page.locator(`[data-locale="${locale}"]`).click();
    await page.waitForFunction(expected => document.documentElement.lang === expected, locale);
  }
  await page.evaluate(previewZoom => {
    document.documentElement.style.setProperty('--store-preview', '1');
    document.body.style.zoom = previewZoom;
  }, zoom);
  await page.screenshot({ path: path.join(outputRoot, fileName) });
  await page.close();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function asDataUrl(file) {
  const extension = path.extname(file).slice(1);
  return `data:image/${extension === 'svg' ? 'svg+xml' : extension};base64,${(await fs.readFile(file)).toString('base64')}`;
}

async function renderPromo({ width, height, fileName, eyebrow, title, detail, screenshotFile, compact = false }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const background = await asDataUrl(path.join(outputRoot, 'play-connect-liquid-glass-background-v2.png'));
  const logo = await asDataUrl(path.join(extensionRoot, 'assets', 'play-connect-pc-logo.svg'));
  const screenshot = await asDataUrl(path.join(outputRoot, screenshotFile));
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#050506;color:#f8f8fa;font-family:Inter,Arial,sans-serif}
    body{position:relative;background-image:linear-gradient(105deg,rgba(0,0,0,.97) 0%,rgba(0,0,0,.84) 48%,rgba(0,0,0,.3) 100%),url('${background}');background-size:cover;background-position:center}
    body:after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 42%,rgba(255,255,255,.10) 50%,transparent 58%);opacity:.25}
    .brand{position:absolute;z-index:2;left:${compact ? 26 : 64}px;top:${compact ? 24 : 46}px;display:flex;align-items:center;gap:${compact ? 10 : 16}px}.brand img{width:${compact ? 40 : 58}px;height:${compact ? 40 : 58}px}.brand b{font-size:${compact ? 20 : 30}px;letter-spacing:-.04em}.brand small{display:block;color:#a6a9b1;font-size:${compact ? 9 : 14}px;margin-top:4px;letter-spacing:.03em}
    .copy{position:absolute;z-index:3;left:${compact ? 26 : 66}px;top:${compact ? 92 : 168}px;width:${compact ? 205 : 570}px}.eyebrow{font-weight:800;letter-spacing:.24em;font-size:${compact ? 9 : 17}px;color:#c9ccd3;text-transform:uppercase}.copy h1{margin:${compact ? 10 : 16}px 0 ${compact ? 9 : 16}px;font-size:${compact ? 31 : 58}px;line-height:.96;letter-spacing:-.065em;max-width:600px}.copy p{margin:0;color:#c8cad0;line-height:1.45;font-size:${compact ? 12 : 21}px;max-width:${compact ? 210 : 545}px}.chips{display:flex;gap:8px;margin-top:${compact ? 14 : 22}px;flex-wrap:wrap}.chips span{border:1px solid rgba(255,255,255,.25);background:rgba(12,12,14,.62);backdrop-filter:blur(14px);border-radius:999px;padding:${compact ? '6px 9px' : '9px 14px'};font-weight:700;font-size:${compact ? 8 : 13}px}
    .shot{position:absolute;z-index:2;left:${compact ? 242 : 690}px;top:${compact ? 70 : 84}px;width:${compact ? 360 : 820}px;height:${compact ? 230 : 520}px;transform:${compact ? 'rotate(-3deg)' : 'rotate(-2deg)'};border:1px solid rgba(255,255,255,.25);border-radius:${compact ? 14 : 24}px;overflow:hidden;background:#0b0b0d;box-shadow:0 34px 90px rgba(0,0,0,.74),0 0 0 8px rgba(255,255,255,.025)}.shot img{width:100%;height:100%;object-fit:cover;object-position:top left;filter:contrast(1.04)}
    .version{position:absolute;z-index:4;right:${compact ? 18 : 38}px;top:${compact ? 16 : 26}px;border:1px solid rgba(255,255,255,.24);border-radius:999px;padding:${compact ? '6px 9px' : '9px 14px'};background:rgba(0,0,0,.68);font-weight:800;font-size:${compact ? 9 : 13}px}
  </style></head><body>
    <div class="brand"><img src="${logo}"><div><b>Play Connect</b><small>Play Streamers bağlantı paneli</small></div></div>
    <div class="copy"><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p><div class="chips"><span>8 DİL</span><span>AKILLI PARA BİRİMİ</span><span>YEREL ÖNBELLEK</span></div></div>
    <div class="shot"><img src="${screenshot}"></div><div class="version">v1.15.2</div>
  </body></html>`);
  await page.screenshot({ path: path.join(outputRoot, fileName) });
  await page.close();
}

await fs.mkdir(outputRoot, { recursive: true });

try {
  await screenshotOptions('01-play-connect-panel.png', 'bynogame');
  await screenshotOptions('02-obs-baglantisi.png', 'streamlabs');
  await screenshotOptions('03-dogrulanmis-bagislar.png', 'itemsatis', 'en', '0.82');

  await renderPromo({
    width: 440,
    height: 280,
    fileName: '04-kucuk-tanitim-440x280.png',
    eyebrow: 'BAĞLANTI · ÇEVİRİ · GÜVENLİK',
    title: 'Tüm platformlar. Tek akıcı panel.',
    detail: 'Yeni sıvı cam arayüz, çevrimdışı dil önbelleği ve otomatik para birimi.',
    screenshotFile: '01-play-connect-panel.png',
    compact: true
  });
  await renderPromo({
    width: 1400,
    height: 560,
    fileName: '05-kayan-tanitim-1400x560.png',
    eyebrow: 'BAĞLANTILAR · ÇEVİRİ · GÜVENLİK',
    title: 'Yayın bağlantıların artık daha akıcı.',
    detail: 'Destek platformlarını OBS / Alert Box bağlantısıyla ekle. Sekiz dilde, seçilen dile uygun para birimiyle ve yeniden çeviri beklemeden yönet.',
    screenshotFile: '02-obs-baglantisi.png'
  });
  console.log('Play Connect mağaza görselleri güncellendi.');
} finally {
  await browser.close();
  server.close();
}
