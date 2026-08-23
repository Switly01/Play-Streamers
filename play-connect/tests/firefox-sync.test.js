import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const chromeRoot = resolve(testDirectory, "..");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function walk(root, current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, fullPath));
    else files.push(relative(root, fullPath).replaceAll("\\", "/"));
  }
  return files;
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

test("Firefox paketi Chrome surumu ve ortak kaynaklarla senkron kalir", async () => {
  const chromeManifest = await readJson(join(chromeRoot, "manifest.json"));
  const firefoxRoot = resolve(chromeRoot, `../play-connect-firefox-store-v${chromeManifest.version}`);
  const firefoxManifest = await readJson(join(firefoxRoot, "manifest.json"));

  assert.equal(firefoxManifest.version, chromeManifest.version);
  assert.equal(firefoxManifest.manifest_version, 2);
  assert.equal(firefoxManifest.background.page, "firefox/background.html");
  assert.equal(firefoxManifest.browser_specific_settings.gecko.id, "play-connect@pstreamers.com");
  assert.equal(firefoxManifest.browser_specific_settings.gecko.strict_min_version, "142.0");
  assert.ok(firefoxManifest.permissions.includes("https://api.pstreamers.com/*"));
  assert.ok(firefoxManifest.permissions.includes("https://api.swcreate.com/*"));
  assert.ok(firefoxManifest.permissions.includes("webRequest"));
  assert.ok(firefoxManifest.content_scripts.some(script => script.world === "MAIN"));

  const expectedDifferent = new Set([
    "offscreen/offscreen.js",
    "options/options.html",
    "options/options.js",
    "popup/popup.js",
    "src/background.js",
    "src/content-scanner.js"
  ]);
  const excluded = new Set([".gitignore", "manifest.json", "package.json", "pnpm-lock.yaml", "README.md"]);
  const chromeFiles = (await walk(chromeRoot))
    .filter(path => !path.startsWith("node_modules/"))
    .filter(path => !path.startsWith("tests/"))
    .filter(path => !excluded.has(path));

  for (const path of chromeFiles) {
    const firefoxPath = join(firefoxRoot, path);
    if (expectedDifferent.has(path)) continue;
    assert.equal(
      await sha256(join(chromeRoot, path)),
      await sha256(firefoxPath),
      `${path} Firefox paketinde Chrome kaynagindan ayrilmis.`
    );
  }

  for (const path of ["options/options.html", "options/options.js", "popup/popup.js"]) {
    const chromeText = await readFile(join(chromeRoot, path), "utf8");
    const firefoxText = await readFile(join(firefoxRoot, path), "utf8");
    assert.equal(chromeText.replaceAll("chrome.", "browser.").replaceAll("Chrome", "Firefox"), firefoxText);
  }
});

test("Firefox arka planinda eslestirme, OBS kaynagi ve sunucu teslimati calisir", async () => {
  const chromeManifest = await readJson(join(chromeRoot, "manifest.json"));
  const firefoxRoot = resolve(chromeRoot, `../play-connect-firefox-store-v${chromeManifest.version}`);
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const originalFetch = globalThis.fetch;
  globalThis.setInterval = () => 0;
  globalThis.clearInterval = () => {};

  let messageListener = null;
  const offscreenCalls = [];
  const delivered = [];
  let stored = {
    playStreamersDonate: {
      installationId: "firefox-sync-installation",
      connection: {
        paired: true,
        deviceId: "firefox-sync-device",
        deviceName: "Play Connect Firefox Test",
        deviceToken: "A".repeat(48),
        apiEndpoint: "https://api.pstreamers.com/api/donate-bridge/events",
        pairedAt: Date.now(),
        lastStatusCheckAt: Date.now()
      },
      providers: {
        bynogame: {
          enabled: true,
          status: "connected",
          loginStatus: "observed",
          baselineComplete: true,
          selectors: {}
        }
      },
      queue: [],
      seen: {},
      activity: [],
      providerDefaultsVersion: 12,
      queueSanitizerVersion: 7,
      deliveredLedgerVersion: 1
    }
  };

  const noOpEvent = { addListener() {} };
  globalThis.browser = {
    runtime: {
      id: "play-connect@pstreamers.com",
      getManifest: () => ({ version: chromeManifest.version }),
      getURL: path => `moz-extension://play-connect/${path}`,
      onInstalled: noOpEvent,
      onStartup: noOpEvent,
      onMessage: { addListener(listener) { messageListener = listener; } },
      openOptionsPage: async () => {},
      sendMessage: async message => globalThis.__PLAY_CONNECT_OFFSCREEN__.dispatch(message)
    },
    storage: {
      local: {
        async get() { return structuredClone(stored); },
        async set(value) { stored = { ...stored, ...structuredClone(value) }; }
      }
    },
    alarms: { async create() {}, onAlarm: noOpEvent },
    notifications: { async create() {} },
    cookies: {
      async getAllCookieStores() { return []; },
      async getAll() { return []; }
    },
    webRequest: {
      onBeforeSendHeaders: { addListener() {} }
    },
    tabs: {
      onRemoved: noOpEvent,
      async create(details) { return { id: 101, ...details }; },
      async update(id, details) { return { id, ...details }; },
      async reload() {},
      async remove() {},
      async sendMessage() { return { ok: true }; }
    },
    windows: {
      onRemoved: noOpEvent,
      async get() { throw new Error("window-not-found"); },
      async create(details) { return { id: 202, tabs: [{ id: 101 }], ...details }; },
      async update() {}
    }
  };
  globalThis.__PLAY_CONNECT_OFFSCREEN__ = {
    async dispatch(message) {
      offscreenCalls.push(structuredClone(message));
      if (message.type === "SYNC_ALERT_SOURCES") {
        return { ok: true, active: message.sources?.length || 0 };
      }
      if (message.type === "ALERT_FRAME_STATUS") return { ok: true, status: "active" };
      return { ok: true };
    }
  };

  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.endsWith("/api/donate-bridge/events")) {
      const payload = JSON.parse(String(options.body || "{}"));
      delivered.push(payload);
      return new Response(JSON.stringify({
        ok: true,
        accepted: true,
        duplicate: false,
        deviceEventCount: delivered.length
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (target.endsWith("/api/donate-bridge/device/status")) {
      return new Response(JSON.stringify({ ok: true, paired: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (target.endsWith("/api/activity/pulse")) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response("", { status: 404 });
  };

  try {
    const backgroundUrl = pathToFileURL(join(firefoxRoot, "src/background.js"));
    await import(`${backgroundUrl.href}?firefox-sync=${Date.now()}`);
    assert.equal(typeof messageListener, "function");

    const send = (message, sender = {}) => new Promise((resolveMessage, reject) => {
      const timeout = setTimeout(() => reject(new Error("Firefox mesaji zaman asimina ugradi.")), 2500);
      messageListener(message, sender, response => {
        clearTimeout(timeout);
        resolveMessage(response);
      });
    });

    const alertUrl = "https://streamlabs.com/widgets/alertbox/v1/firefox-test";
    const saved = await send({
      type: "SAVE_PROVIDER",
      providerId: "klasgame",
      config: { enabled: false, alertUrl, defaultCurrency: "TRY" }
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.result.providers.klasgame.enabled, true);
    assert.equal(saved.result.providers.klasgame.hasAlertUrl, true);
    assert.ok(offscreenCalls.some(call => call.type === "SYNC_ALERT_SOURCES"
      && call.sources?.some(source => source.providerId === "klasgame" && source.url === alertUrl)));

    const candidate = {
      eventId: "firefox-live-event",
      name: "Firefox destekcisi",
      amount: "15 TRY",
      currency: "TRY",
      message: "Gecko teslimat testi",
      time: new Date().toISOString()
    };
    const captured = await send({
      type: "NETWORK_CANDIDATES",
      sourceUrl: "https://api.bynogame.com/streamer/donate/incoming?page=1",
      method: "GET",
      candidates: [candidate]
    }, {
      url: "https://donate.bynogame.com/history",
      tab: { id: 41, windowId: 9 }
    });
    assert.equal(captured.ok, true);
    assert.equal(captured.result.accepted, 1);
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0].event.source, "local-alert");
    assert.equal(typeof browser.runtime.getManifest().version, "string");
    assert.equal(delivered[0].event.donorName, "Firefox destekcisi");
    assert.equal(delivered[0].event.message, "Gecko teslimat testi");
    assert.equal(stored.playStreamersDonate.queue.length, 0);

    const state = await send({ type: "GET_STATE" });
    assert.equal(state.ok, true);
    assert.equal(state.result.connection.paired, true);
    assert.equal(state.result.providers.klasgame.alertUrl, undefined);
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
    globalThis.fetch = originalFetch;
    delete globalThis.browser;
    delete globalThis.__PLAY_CONNECT_OFFSCREEN__;
  }
});
