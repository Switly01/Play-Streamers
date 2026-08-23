import test from "node:test";
import assert from "node:assert/strict";

test("algılanan donate yalnızca açık sunucu onayından sonra kuyruktan düşer", async () => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const originalFetch = globalThis.fetch;
  globalThis.setInterval = () => 0;
  globalThis.clearInterval = () => {};

  let messageListener = null;
  let deliveryMode = "accepted";
  let serverEventCount = 0;
  let byNoGameApiEvents = [];
  const deliveredEvents = [];
  const deviceToken = "A".repeat(48);
  let stored = {
    playStreamersDonate: {
      installationId: "delivery-test-installation",
      connection: {
        paired: true,
        deviceId: "delivery-test-device",
        deviceName: "Play Connect Test",
        deviceToken,
        apiEndpoint: "https://api.pstreamers.com/api/donate-bridge/events",
        pairedAt: Date.now(),
        lastStatusCheckAt: Date.now()
      },
      providers: {
        bynogame: {
          enabled: true,
          status: "connected",
          loginStatus: "unknown",
          baselineComplete: true,
          selectors: {}
        }
      },
      queue: [],
      seen: {},
      activity: [],
      providerDefaultsVersion: 4,
      queueSanitizerVersion: 6,
      deliveredLedgerVersion: 1
    }
  };

  globalThis.chrome = {
    runtime: {
      id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      getManifest: () => ({ version: "1.0.0" }),
      getURL: path => `chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/${path}`,
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      onMessage: { addListener(listener) { messageListener = listener; } },
      sendMessage: async () => ({ ok: true })
    },
    storage: {
      local: {
        async get() { return structuredClone(stored); },
        async set(value) { stored = { ...stored, ...structuredClone(value) }; }
      }
    },
    alarms: {
      async create() {},
      onAlarm: { addListener() {} }
    },
    notifications: { async create() {} },
    tabs: { async create() {} },
    offscreen: { async createDocument() {} }
  };

  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.startsWith("https://api.bynogame.com/streamer/donate/incoming")) {
      assert.equal(options.headers.authorization, `Bearer ${"B".repeat(48)}`);
      assert.equal(options.credentials, "include");
      return new Response(JSON.stringify({
        data: {
          data: byNoGameApiEvents
        }
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (target.endsWith("/api/donate-bridge/events")) {
      const payload = JSON.parse(String(options.body || "{}"));
      deliveredEvents.push(payload.event);
      if (deliveryMode === "missing-ack") {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (deliveryMode === "duplicate") {
        return new Response(JSON.stringify({
          ok: true,
          accepted: true,
          duplicate: true,
          deviceEventCount: serverEventCount
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      serverEventCount += 1;
      return new Response(JSON.stringify({
        ok: true,
        accepted: true,
        duplicate: false,
        deviceEventCount: serverEventCount
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (target.endsWith("/api/donate-bridge/device/status")) {
      return new Response(JSON.stringify({
        ok: true,
        paired: true,
        device: { name: "Play Connect Test" }
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response("", { status: 404 });
  };

  await import(`../src/background.js?delivery-test=${Date.now()}`);
  assert.equal(typeof messageListener, "function");

  const send = (message, sender = {}) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Eklenti mesajı zaman aşımına uğradı.")), 2000);
    messageListener(message, sender, response => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
  const sender = {
    url: "https://donate.bynogame.com/history",
    tab: { id: 41, windowId: 9, incognito: true }
  };
  const candidate = eventId => ({
    eventId,
    name: "Test destekçisi",
    amount: "12,50 TL",
    currency: "TRY",
    message: "Teslimat testi",
    time: new Date().toISOString(),
    rawText: `Test destekçisi 12,50 TL ${eventId}`
  });

  const first = await send({
    type: "NETWORK_CANDIDATES",
    sourceUrl: "https://api.bynogame.com/streamer/donate/incoming?filters=status:-1&page=1",
    method: "GET",
    candidates: [candidate("delivery-test-1")]
  }, sender);
  assert.equal(first.ok, true);
  assert.equal(first.result.accepted, 1);
  assert.equal(deliveredEvents.length, 1);
  assert.equal(stored.playStreamersDonate.queue.length, 0);
  assert.equal(stored.playStreamersDonate.connection.lastServerEventCount, 1);
  assert.equal(stored.playStreamersDonate.connection.lastDeliveryHttpStatus, 200);
  assert.ok(stored.playStreamersDonate.connection.lastDeliveryAttemptAt > 0);
  assert.ok(stored.playStreamersDonate.connection.lastDeliveryAt > 0);

  deliveryMode = "missing-ack";
  const second = await send({
    type: "NETWORK_CANDIDATES",
    sourceUrl: "https://api.bynogame.com/streamer/donate/incoming?filters=status:-1&page=1",
    method: "GET",
    candidates: [candidate("delivery-test-2")]
  }, sender);
  assert.equal(second.ok, true);
  assert.equal(second.result.accepted, 1);
  assert.equal(stored.playStreamersDonate.queue.length, 1);
  const queuedSecondId = stored.playStreamersDonate.queue[0].event.eventId;
  assert.match(queuedSecondId, /^delivery-test-2:/);
  assert.equal(stored.playStreamersDonate.seen[`bynogame:${queuedSecondId}`], undefined);
  assert.match(stored.playStreamersDonate.connection.lastError, /teslimatı onaylamadı/i);

  deliveryMode = "accepted";
  stored.playStreamersDonate.queue[0].nextAttemptAt = 0;
  const retry = await send({ type: "POLL_NOW" });
  assert.equal(retry.ok, true);
  assert.equal(stored.playStreamersDonate.queue.length, 0);
  assert.ok(stored.playStreamersDonate.seen[`bynogame:${queuedSecondId}`] > 0);
  assert.equal(stored.playStreamersDonate.connection.lastServerEventCount, 2);

  deliveryMode = "duplicate";
  const deliveredBeforeDuplicateReceipt = stored.playStreamersDonate.connection.deliveredEventCount;
  const serverDuplicate = await send({
    type: "NETWORK_CANDIDATES",
    sourceUrl: "https://api.bynogame.com/streamer/donate/incoming?filters=status:-1&page=1",
    method: "GET",
    candidates: [candidate("delivery-already-on-server")]
  }, sender);
  assert.equal(serverDuplicate.ok, true);
  assert.equal(serverDuplicate.result.accepted, 1);
  assert.equal(stored.playStreamersDonate.queue.length, 0);
  assert.ok(Object.keys(stored.playStreamersDonate.seen).some(key => key.startsWith("bynogame:delivery-already-on-server:")));
  assert.equal(stored.playStreamersDonate.connection.deliveredEventCount, deliveredBeforeDuplicateReceipt);
  assert.equal(stored.playStreamersDonate.connection.lastServerEventCount, 2);
  deliveryMode = "accepted";

  const oldByNoGameEvent = {
    opId: "bynogame-old-op",
    orderRowId: "bynogame-old-row",
    nickName: "Eski destekçi",
    amount: 10,
    message: "Başlangıç hareketi",
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    status: 1
  };
  byNoGameApiEvents = [oldByNoGameEvent];
  const sessionCapture = await send({
    type: "PAGE_SESSION_TOKEN",
    providerId: "bynogame",
    token: "B".repeat(48)
  }, sender);
  assert.equal(sessionCapture.ok, true);
  await send({ type: "POLL_NOW" });
  assert.equal(stored.playStreamersDonate.connection.lastServerEventCount, 2);

  byNoGameApiEvents = [oldByNoGameEvent, {
    opId: "bynogame-op-1",
    orderRowId: "bynogame-row-1",
    nickName: "ByNoGame destekçisi",
    amount: 25,
    message: "ByNoGame doğrudan veri akışı",
    createdAt: new Date().toISOString(),
    status: 1
  }];
  const byNoGameDelivery = await send({ type: "POLL_NOW" });
  assert.equal(byNoGameDelivery.ok, true);
  assert.equal(stored.playStreamersDonate.queue.length, 0);
  assert.equal(stored.playStreamersDonate.connection.lastServerEventCount, 3);
  assert.match(deliveredEvents.at(-1).eventId, /^bynogame-op-1:/);
  assert.equal(deliveredEvents.at(-1).donorName, "ByNoGame destekçisi");
  assert.equal(deliveredEvents.at(-1).amountMinor, 2500);

  const weakLoginSignal = await send({
    type: "PAGE_STATUS",
    providerId: "bynogame",
    authenticated: false,
    loginRequired: true,
    strongLoginRequired: false,
    accountLike: false,
    historyLike: false
  }, sender);
  assert.equal(weakLoginSignal.ok, true);
  assert.equal(weakLoginSignal.result.loginStatus, "observed");
  assert.equal(stored.playStreamersDonate.providers.bynogame.sessionToken, "B".repeat(48));
  assert.equal(stored.playStreamersDonate.providers.bynogame.baselineComplete, true);

  const publicState = await send({ type: "GET_STATE" });
  assert.equal(publicState.ok, true);
  assert.equal(publicState.result.providers.bynogame.sessionToken, undefined);
  assert.equal(publicState.result.providers.bynogame.hasSessionToken, true);

  const networkCandidate = (eventId, name, amountMinor, time = new Date().toISOString()) => ({
    eventId,
    name,
    amount: "",
    amountMinor,
    currency: "TRY",
    message: "Ortak platform veri akışı",
    time,
    rawText: `${eventId}:${name}:${amountMinor}`
  });
  const klasSender = {
    url: "https://www.klasgame.com/hesabim/donate",
    tab: { id: 42, windowId: 9, incognito: true }
  };
  const klasBaseline = await send({
    type: "NETWORK_CANDIDATES",
    sourceUrl: "https://api.klasgame.com/donations?page=1",
    method: "GET",
    candidates: [networkCandidate("klas-old", "Eski Klasgame destekçisi", 1000, new Date(Date.now() - 60 * 60 * 1000).toISOString())]
  }, klasSender);
  assert.equal(klasBaseline.result.accepted, 1);
  assert.equal(stored.playStreamersDonate.providers.klasgame.historyUrl, "https://api.klasgame.com/donations?page=1");
  assert.ok(stored.playStreamersDonate.providers.klasgame.autoConfiguredAt > 0);
  const klasNew = await send({
    type: "NETWORK_CANDIDATES",
    sourceUrl: "https://api.klasgame.com/donations?page=1",
    method: "GET",
    candidates: [networkCandidate("klas-new", "Yeni Klasgame destekçisi", 4500)]
  }, klasSender);
  assert.equal(klasNew.result.accepted, 1);
  assert.equal(deliveredEvents.at(-1).providerId, "klasgame");
  assert.equal(deliveredEvents.at(-1).amountMinor, 4500);

  stored.playStreamersDonate.providers.klasgame.lastNetworkAt = Date.now() - 20_000;
  const klasLogout = await send({
    type: "PAGE_STATUS",
    providerId: "klasgame",
    authenticated: false,
    loginRequired: true,
    strongLoginRequired: false,
    accountLike: false,
    historyLike: false
  }, klasSender);
  assert.equal(klasLogout.ok, true);
  assert.equal(klasLogout.result.loginStatus, "required");

  const kofiSender = {
    url: "https://ko-fi.com/manage/supporters",
    tab: { id: 43, windowId: 9, incognito: true }
  };
  await send({
    type: "NETWORK_CANDIDATES",
    sourceUrl: "https://ko-fi.com/api/donations?page=1",
    method: "GET",
    candidates: [networkCandidate("kofi-old", "Eski Ko-fi destekçisi", 500, new Date(Date.now() - 60 * 60 * 1000).toISOString())]
  }, kofiSender);
  const kofiNew = await send({
    type: "NETWORK_CANDIDATES",
    sourceUrl: "https://ko-fi.com/api/donations?page=1",
    method: "GET",
    candidates: [networkCandidate("kofi-new", "Yeni Ko-fi destekçisi", 900)]
  }, kofiSender);
  assert.equal(kofiNew.result.accepted, 1);
  assert.equal(deliveredEvents.at(-1).providerId, "kofi");
  assert.equal(deliveredEvents.at(-1).amountMinor, 900);
  assert.equal(stored.playStreamersDonate.connection.lastServerEventCount, 7);

  const pindirimSender = {
    url: "https://www.pindirim.com/panel/donations",
    tab: { id: 44, windowId: 9, incognito: true }
  };
  const emptyBaseline = await send({
    type: "NETWORK_CANDIDATES",
    sourceUrl: "https://www.pindirim.com/api/donations?page=1",
    method: "GET",
    candidates: []
  }, pindirimSender);
  assert.equal(emptyBaseline.ok, true);
  assert.equal(emptyBaseline.result.accepted, 0);
  assert.equal(stored.playStreamersDonate.providers.pindirim.baselineComplete, true);

  const firstRealDonation = await send({
    type: "NETWORK_CANDIDATES",
    sourceUrl: "https://www.pindirim.com/api/donations?page=1",
    method: "GET",
    candidates: [networkCandidate("pindirim-new", "Yeni Pindirim destekçisi", 2750)]
  }, pindirimSender);
  assert.equal(firstRealDonation.ok, true);
  assert.equal(firstRealDonation.result.accepted, 1);
  assert.equal(deliveredEvents.at(-1).providerId, "pindirim");
  assert.match(deliveredEvents.at(-1).eventId, /^pindirim-new:/);
  assert.equal(stored.playStreamersDonate.connection.lastServerEventCount, 8);

  const livepixSender = {
    url: "https://app.livepix.gg/dashboard",
    tab: { id: 45, windowId: 9, incognito: true }
  };
  const freshFirstBatch = await send({
    type: "NETWORK_CANDIDATES",
    sourceUrl: "https://app.livepix.gg/api/donations?page=1",
    method: "GET",
    candidates: [networkCandidate("livepix-first-new", "Yeni LivePix destekçisi", 3250)]
  }, livepixSender);
  assert.equal(freshFirstBatch.ok, true);
  assert.equal(freshFirstBatch.result.accepted, 1);
  assert.equal(deliveredEvents.at(-1).providerId, "livepix");
  assert.match(deliveredEvents.at(-1).eventId, /^livepix-first-new:/);
  assert.equal(stored.playStreamersDonate.connection.lastServerEventCount, 9);

  const alertUrl = "https://streamlabs.com/widgets/alert-box/v1/play-connect-test";
  const savedAlert = await send({
    type: "SAVE_PROVIDER",
    providerId: "pindirim",
    config: { alertUrl, defaultCurrency: "TRY" }
  });
  assert.equal(savedAlert.ok, true);
  assert.equal(stored.playStreamersDonate.providers.pindirim.alertUrl, alertUrl);
  assert.equal(stored.playStreamersDonate.providers.pindirim.baselineComplete, false);

  const optionsSender = {
    id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    url: "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/options/options.html"
  };
  const savedSecret = await send({ type: "GET_PROVIDER_ALERT_URL", providerId: "pindirim" }, optionsSender);
  assert.equal(savedSecret.ok, true);
  assert.equal(savedSecret.result.url, alertUrl);

  const replacement = await send({
    type: "SAVE_PROVIDER",
    providerId: "pindirim",
    config: {
      alertUrl: "https://streamlabs.com/widgets/alert-box/v1/replacement",
      defaultCurrency: "TRY"
    }
  });
  assert.equal(replacement.ok, false);
  assert.match(replacement.error, /önce mevcut OBS bağlantısını kaldır/i);

  const alertSender = { url: alertUrl };
  const initialAlertHistory = await send({
    type: "NETWORK_CANDIDATES",
    providerId: "pindirim",
    sourceUrl: "https://streamlabs.com/api/v1/donations/history",
    method: "GET",
    candidates: [networkCandidate(
      "pindirim-alert-old",
      "Eski OBS destekçisi",
      1600,
      new Date(Date.now() - 60 * 60 * 1000).toISOString()
    )]
  }, alertSender);
  assert.equal(initialAlertHistory.ok, true);
  assert.equal(initialAlertHistory.result.accepted, 0);
  assert.equal(stored.playStreamersDonate.providers.pindirim.lastBaselineCount, 1);
  assert.equal(stored.playStreamersDonate.queue.length, 0);
  assert.equal(stored.playStreamersDonate.connection.lastServerEventCount, 9);

  const liveAlertDonation = await send({
    type: "NETWORK_CANDIDATES",
    providerId: "pindirim",
    sourceUrl: "wss://streamlabs.com/socket",
    method: "WS",
    candidates: [networkCandidate("pindirim-alert-new", "Canlı OBS destekçisi", 4200)]
  }, alertSender);
  assert.equal(liveAlertDonation.ok, true);
  assert.equal(liveAlertDonation.result.accepted, 1);
  assert.equal(stored.playStreamersDonate.queue.length, 0);
  assert.match(deliveredEvents.at(-1).eventId, /^pindirim-alert-new:/);
  assert.equal(stored.playStreamersDonate.connection.lastServerEventCount, 10);

  globalThis.fetch = originalFetch;
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
});
