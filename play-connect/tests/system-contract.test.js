import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = relativePath => readFile(new URL(relativePath, import.meta.url), "utf8");

test("manual page detection controls are removed", async () => {
  const options = await read("../options/options.js");
  const background = await read("../src/background.js");
  const scanner = await read("../src/content-scanner.js");

  assert.doesNotMatch(options, /Gelişmiş bağlantı ve sayfa algılama/);
  assert.doesNotMatch(options, /name="historyUrl"/);
  assert.doesNotMatch(options, /selector_/);
  assert.match(background, /automatic-network-only/);
  assert.match(scanner, /automaticNetworkOnly:\s*true/);
  assert.match(background, /streamer\/donate\/incoming/);
});

test("popup dar tarayici panellerinde tasma ve kaydirma cubugu seridine donusmez", async () => {
  const html = await read("../popup/popup.html");
  const css = await read("../popup/popup.css");

  assert.match(html, /class="narrow-notice"/);
  assert.match(css, /@media\(max-width:319px\)/);
  assert.match(css, /@media\(max-width:139px\)/);
  assert.match(css, /@media\(max-width:48px\)/);
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /\.narrow-notice\{display:grid/);
});

test("OBS alert bağlantısı ve teslimat kuyruğu manifestte etkin", async () => {
  const manifest = JSON.parse(await read("../manifest.json"));
  const background = await read("../src/background.js");

  assert.equal(manifest.incognito, undefined);
  assert.ok(manifest.permissions.includes("tabs"));
  assert.ok(manifest.permissions.includes("webRequest"));
  assert.doesNotMatch(background, /incognito:\s*true/);
  assert.doesNotMatch(background, /OPEN_INCOGNITO_SETTINGS/);
  assert.match(background, /captureMode\s*=\s*"alert-frame"/);
  assert.match(background, /SYNC_ALERT_SOURCES/);
  assert.match(background, /IFRAME_SCRIPTING/);
  assert.doesNotMatch(background, /AUDIO_PLAYBACK/);
  assert.match(await read("../offscreen/offscreen.js"), /frame\.allow\s*=\s*["']autoplay 'none'["']/);
  assert.match(background, /FAST_POLL_INTERVAL_MS\s*=\s*750/);
  assert.match(background, /state\.queue\.push/);
  assert.match(background, /result\?\.accepted\s*!==\s*true/);
  assert.match(background, /latest\.seen\[eventKey\]/);
  const networkBridge = await read("../src/network-bridge.js");
  assert.match(networkBridge, /PlayConnectWebSocket/);
  assert.match(networkBridge, /function silenceAlertFrameAudio/);
  assert.match(networkBridge, /playConnectSilentPlay/);
  assert.match(background, /OBS alert kartı/);
});

test("OBS bağlantısını kaldırma işlemi tasarımlı onay penceresi kullanır", async () => {
  const options = await read("../options/options.js");
  const html = await read("../options/options.html");
  assert.match(options, /askObsDisconnectConfirmation\(provider\.name\)/);
  assert.doesNotMatch(options, /confirm\("Bu platform için bu Chrome profilinde saklanan OBS bağlantısı/);
  assert.match(html, /id="obsDisconnectModal"/);
  assert.match(html, /id="obsDisconnectConfirm"/);
});

test("yeniden yüklenen eklentinin eski sayfa kodu geçersiz bağlam hatası üretmez", async () => {
  const scanner = await read("../src/content-scanner.js");
  const manifest = JSON.parse(await read("../manifest.json"));
  assert.match(scanner, /function extensionContextAvailable/);
  assert.match(scanner, /function safeRuntimeMessage/);
  assert.match(scanner, /extension-context-invalidated/);
  assert.match(scanner, /extension context invalidated/i);
  assert.match(scanner, /chrome\.runtime\.lastError/);
  assert.equal((scanner.match(/chrome\.runtime\.sendMessage/g) || []).length, 1);
  assert.ok(!manifest.host_permissions.some(value => value.includes("github.com")));
  assert.ok(manifest.host_permissions.includes("https://*.livepix.gg/*"));
  assert.ok(manifest.host_permissions.includes("https://*.toon.at/*"));
  for (const script of manifest.content_scripts) {
    assert.equal(script.all_frames, true);
    assert.ok(script.matches.includes("https://*.livepix.gg/*"));
    assert.ok(script.matches.includes("https://*.toon.at/*"));
    assert.ok(!script.matches.some(value => value.includes("github.com")));
  }
});

test("eşleştirme kodu, D1 olayı ve Dashboard Donate kartı aynı kullanıcı zincirinde", async () => {
  const worker = await read("../../cloudflare-worker.js");
  const site = [
    await read("../../index.html"),
    await read("../../app.js"),
    await read("../../app-final.js")
  ].join("\n");

  assert.match(worker, /pairing\.user_id/);
  assert.match(worker, /\/api\/donate-bridge\/events/);
  assert.match(worker, /authenticateDonateBridgeDevice/);
  assert.match(worker, /UNIQUE\(user_id, provider_id, provider_event_id\)/);
  assert.match(worker, /accepted:\s*true/);
  assert.match(site, /\/api\/donate-bridge\/events\?after=/);
  assert.match(site, /PlayStreamers\.addEvent/);
  assert.match(site, /type:\s*['"]donation['"]/);
  assert.match(site, /data-card=['"]donations['"]|listCard\(['"]donations['"]/);
});

test("OBS card keeps donor and message and repeated tests get a new lifecycle", async () => {
  const scanner = await read("../src/content-scanner.js");
  assert.match(scanner, /function inferAlertCopy/);
  assert.match(scanner, /semanticName/);
  assert.match(scanner, /semanticMessage/);
  assert.match(scanner, /alertLifecycleSignal \+= 1/);
  assert.match(scanner, /if \(!hasAbsoluteTime\) item\.time = alertLifecycleAt/);
});

test("new donations and donation clicks preserve the active Dashboard surface", async () => {
  const site = await read("../../app-final.js");

  assert.match(site, /function dashboardIsVisible\(\)/);
  assert.match(site, /function restoreDashboardSurface\(\)/);
  assert.match(site, /bridge\?\.addEvent/);
  assert.match(site, /keepDashboard && hasStoredSession\(\)/);
  assert.match(site, /document\.body\.classList\.remove\('auth-locked'\)/);
  assert.match(site, /if \(donationCard\) restoreDashboardSurface\(\)/);
});

test("Kick günlük takipçi ve aktif abone ölçümü hesapla güvenli biçimde eşleşir", async () => {
  const manifest = JSON.parse(await read("../manifest.json"));
  const background = await read("../src/background.js");
  const worker = await read("../../cloudflare-worker.js");
  const site = await read("../../app-final.js");

  assert.ok(manifest.host_permissions.includes("https://kick.com/*"));
  assert.ok(manifest.host_permissions.includes("https://*.kick.com/*"));
  assert.match(background, /\/api\/donate-bridge\/kick-metrics/);
  assert.match(background, /syncKickChannelMetrics/);
  assert.match(background, /kickSubscriberCountFromPayload/);
  assert.match(background, /subscribersCount/);
  assert.match(worker, /receiveDonateBridgeKickMetrics/);
  assert.match(worker, /CREATE TABLE IF NOT EXISTS kick_metric_snapshots/);
  assert.match(worker, /storedSubscriberCount/);
  assert.match(worker, /dailyMetrics/);
  assert.match(site, /accountMetricDailySeries/);
  assert.match(site, /KICK VERİ GRAFİĞİ · SON 90 GÜN/);
});

test("site geçişleri yükleme videosu oluşturmadan devam eder", async () => {
  const index = await read("../../index.html");
  const app = await read("../../app.js");

  assert.doesNotMatch(index, /id="ps28Loader"/);
  assert.doesNotMatch(index, /src="bootstrap\.js"/);
  assert.match(app, /function loadThen\(action\)[\s\S]{0,300}if\(typeof action==='function'\) action\(\);[\s\S]{0,30}return;/);
});
