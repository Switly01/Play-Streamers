import test from "node:test";
import assert from "node:assert/strict";

test("API'siz platform OBS alert bağlantısını görünür sekme açmadan çalıştırır", async () => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const originalFetch = globalThis.fetch;
  globalThis.setInterval = () => 0;
  globalThis.clearInterval = () => {};
  globalThis.fetch = async () => new Response("", { status: 404 });

  let messageListener = null;
  let stored = { playStreamersDonate: { providerDefaultsVersion: 8, queueSanitizerVersion: 7, deliveredLedgerVersion: 1 } };
  const offscreenMessages = [];
  globalThis.chrome = {
    runtime: {
      id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      getManifest: () => ({ version: "1.7.0" }),
      getURL: path => `chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/${path}`,
      getContexts: async () => [],
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      onMessage: { addListener(listener) { messageListener = listener; } },
      async sendMessage(message) {
        if (message?.target === "offscreen") offscreenMessages.push(structuredClone(message));
        return { ok: true, active: message?.sources?.length || 0 };
      }
    },
    storage: {
      local: {
        async get() { return structuredClone(stored); },
        async set(value) { stored = { ...stored, ...structuredClone(value) }; }
      }
    },
    alarms: { async create() {}, onAlarm: { addListener() {} } },
    notifications: { async create() {} },
    windows: { onRemoved: { addListener() {} } },
    tabs: { onRemoved: { addListener() {} } },
    offscreen: { async createDocument() {} }
  };

  await import(`../src/background.js?alert-link=${Date.now()}`);
  assert.equal(typeof messageListener, "function");
  const send = (message, sender = {}) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Eklenti mesajı zaman aşımına uğradı.")), 2000);
    messageListener(message, sender, response => {
      clearTimeout(timeout);
      resolve(response);
    });
  });

  const alertUrl = "https://streamlabs.com/widgets/alertbox/v1/secret-token";
  const saved = await send({
    type: "SAVE_PROVIDER",
    providerId: "klasgame",
    config: { enabled: false, alertUrl, defaultCurrency: "TRY" }
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.result.providers.klasgame.enabled, true);
  assert.equal(saved.result.providers.klasgame.hasAlertUrl, true);
  assert.equal(saved.result.providers.klasgame.alertUrl, undefined);
  assert.equal(saved.result.providers.klasgame.alertHost, "streamlabs.com");
  assert.ok(offscreenMessages.some(message => message.type === "SYNC_ALERT_SOURCES"
    && message.sources.some(source => source.providerId === "klasgame" && source.url === alertUrl)));

  const loaded = await send({ type: "ALERT_FRAME_STATUS", providerId: "klasgame", status: "active" });
  assert.equal(loaded.ok, true);
  const active = await send({ type: "GET_STATE" });
  assert.equal(active.result.providers.klasgame.alertFrameStatus, "active");
  assert.equal(active.result.providers.klasgame.status, "connected");
  const settled = await send({ type: "ALERT_FRAME_STATUS", providerId: "klasgame", status: "settled" });
  assert.equal(settled.ok, true);
  assert.equal(stored.playStreamersDonate.providers.klasgame.baselineComplete, true);
  const domBaseline = await send({
    type: "PAGE_CANDIDATES",
    providerId: "klasgame",
    candidates: []
  }, { url: alertUrl });
  assert.equal(domBaseline.ok, true);
  assert.equal(domBaseline.result.baseline, true);
  assert.equal(stored.playStreamersDonate.providers.klasgame.alertDomBaselineComplete, true);

  const captured = await send({
    type: "NETWORK_CANDIDATES",
    providerId: "klasgame",
    sourceUrl: "wss://sockets.streamlabs.com/alerts",
    method: "WS",
    candidates: [{ eventId: "live-1", name: "Destekçi", amount: "25 TRY", message: "İyi yayınlar" }]
  }, { url: alertUrl });
  assert.equal(captured.ok, true);
  assert.equal(captured.result.accepted, 1);
  assert.equal(stored.playStreamersDonate.queue.length, 1);
  assert.equal(stored.playStreamersDonate.queue[0].event.source, "local-alert");

  const networkPreferred = await send({
    type: "PAGE_CANDIDATES",
    providerId: "klasgame",
    candidates: [{ eventId: "dom-copy", name: "Destekçi", amount: "25 TRY", message: "İyi yayınlar" }]
  }, { url: alertUrl });
  assert.equal(networkPreferred.result.reason, "network-capture-preferred");
  stored.playStreamersDonate.providers.klasgame.lastNetworkCandidateAt = 0;
  const domCaptured = await send({
    type: "PAGE_CANDIDATES",
    providerId: "klasgame",
    candidates: [{ eventId: "dom-live-1", name: "Kart destekçisi", amount: "30 TRY", message: "Karttan yakalandı" }]
  }, { url: alertUrl });
  assert.equal(domCaptured.ok, true);
  assert.equal(domCaptured.result.accepted, 1);
  assert.equal(stored.playStreamersDonate.queue.length, 2);

  // DAB/API and SSB providers use the same validated, local-only alert transport.
  for (const providerId of ["streamlabs", "donationalerts", "tipeeestream", "streamelements", "pally", "kofi", "itemsatis", "buymeacoffee", "trakteer", "sociabuzz"]) {
    const url = `https://streamlabs.com/widgets/alertbox/v1/fixture-${providerId}`;
    const response = await send({ type: "SAVE_PROVIDER", providerId, config: { alertUrl: url } });
    assert.equal(response.ok, true, providerId);
    assert.equal(response.result.providers[providerId].hasAlertUrl, true, providerId);
    assert.equal(response.result.providers[providerId].alertUrl, undefined);
    assert.ok(offscreenMessages.at(-1).sources.some(source => source.providerId === providerId && source.url === url));
    await send({ type: "ALERT_FRAME_STATUS", providerId, status: "settled" });
    const event = {type:"NETWORK_CANDIDATES",providerId,sourceUrl:"wss://sockets.streamlabs.com/alerts",method:"WS",candidates:[{eventId:`fixture-${providerId}`,name:"Test",amount:"5 USD",message:"Fixture"}]};
    assert.equal((await send(event,{url})).result.accepted,1,providerId);
    const rejected = await send({type:"SAVE_PROVIDER",providerId,config:{alertUrl:"https://untrusted.example/alert"}});
    assert.equal(rejected.ok,false);
    const locked = await send({type:"SAVE_PROVIDER",providerId,config:{alertUrl:`${url}-other`}});
    assert.equal(locked.ok,false);
    stored.playStreamersDonate.connection.serverConnectedProviderIds = [providerId];
    const standby = await send({type:"TEST_PROVIDER",providerId});
    assert.equal(standby.result.serverConnection,true);
    assert.equal((await send(event,{url})).result.reason,"server-connection-active");
    await send({type:"SAVE_PROVIDER",providerId,config:{alertUrl:url}});
    assert.ok(!offscreenMessages.at(-1).sources.some(source=>source.providerId===providerId));
    stored.playStreamersDonate.connection.serverConnectedProviderIds = [];
    const cleared=await send({type:"SAVE_PROVIDER",providerId,config:{clearAlertUrl:true}});
    assert.equal(cleared.result.providers[providerId].hasAlertUrl,false);
    assert.ok(!offscreenMessages.at(-1).sources.some(source=>source.providerId===providerId));
  }

  const uiSender = {id:chrome.runtime.id,url:chrome.runtime.getURL('options/options.html')};
  assert.equal((await send({type:'SET_UI_LOCALE',locale:'ja'},{url:'https://untrusted.example'})).ok,false);
  assert.equal((await send({type:'SET_UI_LOCALE',locale:'invalid'},uiSender)).ok,false);
  for (const [locale,currency] of Object.entries({tr:'TRY',en:'USD',de:'EUR',es:'EUR',fr:'EUR',ru:'RUB',ar:'SAR',ja:'JPY'})) {
    const response=await send({type:'SET_UI_LOCALE',locale},uiSender);
    assert.equal(response.ok,true);
    for(const config of Object.values(stored.playStreamersDonate.providers)) {
      if(config.currencyMode!=='manual')assert.equal(config.defaultCurrency,currency);
    }
    assert.equal(stored.playStreamersDonate.providers.klasgame.defaultCurrency,'TRY','manual setting retained');
  }
  await send({type:'SAVE_PROVIDER',providerId:'streamlabs',config:{alertUrl:'https://streamlabs.com/widgets/alertbox/v1/currency-fixture'}});
  await send({type:'ALERT_FRAME_STATUS',providerId:'streamlabs',status:'settled'});
  await send({type:'NETWORK_CANDIDATES',providerId:'streamlabs',sourceUrl:'wss://sockets.streamlabs.com/alerts',method:'WS',candidates:[
    {eventId:'currency-fallback',name:'Test',amount:'500'},
    {eventId:'currency-explicit',name:'Test',amount:'5 USD'}
  ]},{url:'https://streamlabs.com/widgets/alertbox/v1/currency-fixture'});
  const events=stored.playStreamersDonate.queue.map(item=>item.event);
  assert.equal(events.find(event=>event.eventId==='currency-fallback').currency,'JPY');
  assert.equal(events.find(event=>event.eventId==='currency-explicit').currency,'USD');
  await send({type:'SAVE_PROVIDER',providerId:'streamlabs',config:{currencyMode:'manual',defaultCurrency:'GBP'}});
  await send({type:'SET_UI_LOCALE',locale:'tr'},uiSender);
  assert.equal(stored.playStreamersDonate.providers.streamlabs.defaultCurrency,'GBP');
  await send({type:'SAVE_PROVIDER',providerId:'streamlabs',config:{currencyMode:'locale',defaultCurrency:'GBP'}});
  assert.equal(stored.playStreamersDonate.providers.streamlabs.defaultCurrency,'TRY');

  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
  globalThis.fetch = originalFetch;
});
