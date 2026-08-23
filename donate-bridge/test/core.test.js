"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  detectCurrency,
  normalizeDonationEvent,
  parseAmountMinor,
  stableEventId
} = require("../src/core/event-normalizer");
const { validateProviderConfig } = require("../src/core/provider-config");
const { FileStore } = require("../src/core/file-store");
const {
  claimPairingCode,
  deliverDonationEvent,
  normalizePairingCode
} = require("../src/core/delivery-client");

test("Türkçe ve uluslararası tutarları kuruşa çevirir", () => {
  assert.equal(parseAmountMinor("1.234,56 TL"), 123456);
  assert.equal(parseAmountMinor("₺250"), 25000);
  assert.equal(parseAmountMinor("$12.50"), 1250);
  assert.equal(parseAmountMinor("2,500.75 USD"), 250075);
});

test("para birimini görünen metinden algılar", () => {
  assert.equal(detectCurrency("125 ₺"), "TRY");
  assert.equal(detectCurrency("9.99 EUR"), "EUR");
  assert.equal(detectCurrency("$20"), "USD");
});

test("açık işlem kimliği olmayan kayıtlar kararlı kimlik üretir", () => {
  const raw = { name: "Esat", amount: "25 TL", message: "Başarılar", time: "18:30" };
  assert.equal(stableEventId("test", raw), stableEventId("test", raw));
});

test("genel sağlayıcı tanımını doğrular", () => {
  const provider = validateProviderConfig({
    name: "Örnek Donate",
    watchUrl: "https://example.com/history",
    loginUrl: "https://example.com/login",
    mode: "history",
    selectors: { item: ".donation", amount: ".amount" }
  });
  assert.equal(provider.name, "Örnek Donate");
  assert.deepEqual(provider.allowedHosts, ["example.com"]);
});

test("ham donate olayını ortak biçime dönüştürür", () => {
  const provider = validateProviderConfig({
    id: "sample",
    name: "Örnek",
    watchUrl: "https://example.com/history",
    mode: "history",
    selectors: { item: ".donation" }
  });
  const event = normalizeDonationEvent(provider, {
    name: "Destekçi",
    amount: "42,50 ₺",
    message: "İyi yayınlar",
    observedAt: 1_700_000_000_000
  });
  assert.equal(event.amountMinor, 4250);
  assert.equal(event.currency, "TRY");
  assert.equal(event.donorName, "Destekçi");
});

test("yerel kuyruk aynı olayı ikinci kez eklemez", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "ps-donate-bridge-"));
  try {
    const localStore = new FileStore(path.join(folder, "state.json"));
    const event = {
      eventId: "sample:1",
      providerId: "sample",
      observedAt: Date.now()
    };
    assert.equal(localStore.addEvent(event), true);
    assert.equal(localStore.addEvent(event), false);
    assert.equal(localStore.state.events.length, 1);
    assert.equal(localStore.state.queue.length, 1);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test("site eşleştirme kodunu tek biçime getirip cihaz bilgisini doğru gönderir", async () => {
  let captured;
  const result = await claimPairingCode({
    code: "abcde-23456",
    deviceName: "Yayın PC",
    appVersion: "0.2.0",
    fetchImpl: async (url, init) => {
      captured = { url, init, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({
        ok: true,
        deviceToken: "x".repeat(64),
        apiEndpoint: "https://api.pstreamers.com/api/donate-bridge/events",
        device: { id: "113f21ef-8d67-4cb3-8f71-28b8ea4cd460", name: "Yayın PC" }
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });
  assert.equal(normalizePairingCode("abcde-23456"), "ABCDE23456");
  assert.equal(captured.url, "https://api.pstreamers.com/api/donate-bridge/pair/claim");
  assert.equal(captured.init.method, "POST");
  assert.deepEqual(captured.body, {
    code: "ABCDE23456",
    deviceName: "Yayın PC",
    appVersion: "0.2.0"
  });
  assert.equal(result.device.name, "Yayın PC");
});

test("normalize edilmiş donate bilgisini yetkili API isteğinde değiştirmeden gönderir", async () => {
  const provider = validateProviderConfig({
    id: "sample",
    name: "Örnek Donate",
    watchUrl: "https://example.com/history",
    mode: "history",
    selectors: { item: ".donation" }
  });
  const event = normalizeDonationEvent(provider, {
    eventId: "donate-42",
    name: "Destekçi",
    amount: "125,50 TL",
    currency: "TRY",
    message: "İyi yayınlar",
    observedAt: Date.now()
  });
  let captured;
  const result = await deliverDonationEvent({
    endpoint: "https://api.pstreamers.com/api/donate-bridge/events",
    token: "device-token",
    event,
    appVersion: "0.2.0",
    fetchImpl: async (url, init) => {
      captured = { url, init, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({
        ok: true,
        accepted: true,
        duplicate: false,
        event: {
          eventId: event.eventId,
          donorName: event.donorName,
          amountMinor: event.amountMinor,
          currency: event.currency
        }
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });
  assert.equal(captured.url, "https://api.pstreamers.com/api/donate-bridge/events");
  assert.equal(captured.init.headers.Authorization, "Bearer device-token");
  assert.deepEqual(captured.body, { event });
  assert.equal(captured.body.event.amountMinor, 12550);
  assert.equal(captured.body.event.currency, "TRY");
  assert.equal(captured.body.event.donorName, "Destekçi");
  assert.equal(result.accepted, true);
});
