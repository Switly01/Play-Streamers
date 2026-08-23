import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  detectCurrency,
  extractJsonCandidates,
  normalizeCandidate,
  parseAmountMinor
} from "../src/core.js";
import {
  FEATURED_PROVIDER_IDS,
  PROVIDERS,
  PROVIDER_BY_ID,
  providerForUrl
} from "../src/providers.js";

test("Türkçe ve uluslararası tutarları kuruşa dönüştürür", () => {
  assert.equal(parseAmountMinor("1.234,56 TL"), 123456);
  assert.equal(parseAmountMinor("₺250"), 25000);
  assert.equal(parseAmountMinor("$12.50"), 1250);
  assert.equal(parseAmountMinor(9.25), 925);
});

test("para birimini metinden algılar", () => {
  assert.equal(detectCurrency("125 ₺", "USD"), "TRY");
  assert.equal(detectCurrency("9.99 EUR", "TRY"), "EUR");
  assert.equal(detectCurrency("20", "USD"), "USD");
});

test("JSON içindeki donate nesnelerini bulur", () => {
  const candidates = extractJsonCandidates({
    data: {
      donations: [
        { id: "d-1", donor_name: "Esat", amount: "42,50", currency: "TRY", message: "İyi yayınlar" }
      ]
    }
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].name, "Esat");
  assert.equal(candidates[0].amount, "42,50");
});

test("platformlara özgü işlem ve kuruş alanlarını ortak biçime çevirir", async () => {
  const candidates = extractJsonCandidates({
    activities: [{
      supportId: "support-900",
      supporterName: "Ortak destekçi",
      amountCents: 1875,
      currencyIso: "EUR",
      supportMessage: "Çoklu platform testi",
      completedAt: "2026-07-30T20:00:00Z"
    }]
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].eventId, "support-900");
  assert.equal(candidates[0].name, "Ortak destekçi");
  const event = await normalizeCandidate(PROVIDER_BY_ID.get("kofi"), candidates[0]);
  assert.equal(event.amountMinor, 1875);
  assert.equal(event.currency, "EUR");
});

test("ham olayı sunucu şemasına dönüştürür", async () => {
  const provider = PROVIDER_BY_ID.get("bynogame");
  const event = await normalizeCandidate(provider, {
    eventId: "donate-42",
    name: "Destekçi",
    amount: "125,50 TL",
    message: "İyi yayınlar",
    time: "2026-07-25T12:00:00Z"
  }, Date.parse("2026-07-25T12:01:00Z"));
  assert.equal(event.amountMinor, 12550);
  assert.equal(event.currency, "TRY");
  assert.equal(event.source, "local-alert");
  assert.match(event.eventId, /^donate-42:[a-f0-9]{24}$/);
});

test("aynı sağlayıcı kimliğiyle gelen ayrı saniyedeki test donateleri ayrılır", async () => {
  const provider = PROVIDER_BY_ID.get("bynogame");
  const base = { eventId: "test-donate", name: "Esat", amount: "10 TL", message: "Test" };
  const first = await normalizeCandidate(provider, { ...base, time: "2026-08-07T10:00:00Z" });
  const repeated = await normalizeCandidate(provider, { ...base, time: "2026-08-07T10:00:00Z" });
  const next = await normalizeCandidate(provider, { ...base, time: "2026-08-07T10:00:01Z" });
  assert.equal(first.eventId, repeated.eventId);
  assert.notEqual(first.eventId, next.eventId);
});

test("alan adına göre doğru sağlayıcıyı seçer", () => {
  assert.equal(providerForUrl("https://donate.bynogame.com/dashboard").id, "bynogame");
  assert.equal(providerForUrl("https://www.inovapin.com/account").id, "inovapin");
  assert.equal(providerForUrl("https://ko-fi.com/manage/supporters").id, "kofi");
  assert.equal(providerForUrl("https://www.donationalerts.com/dashboard").id, "donationalerts");
  assert.equal(providerForUrl("https://example.com"), null);
});

test("ana dört platformu ve Diğerleri listesini eksiksiz tutar", () => {
  assert.deepEqual(FEATURED_PROVIDER_IDS, [
    "bynogame",
    "klasgame",
    "streamlabs",
    "streamelements"
  ]);
  assert.equal(PROVIDERS.length, 26);
  assert.ok(PROVIDER_BY_ID.has("inovapin"));
  assert.ok(PROVIDER_BY_ID.has("kofi"));
  assert.ok(PROVIDER_BY_ID.has("tipeeestream"));
  assert.ok(PROVIDER_BY_ID.has("donationalerts"));
  assert.ok(PROVIDER_BY_ID.has("streamloots"));
  assert.ok(PROVIDER_BY_ID.has("destream"));
  for (const id of ["livepix", "saweria", "trakteer", "sociabuzz", "tipply", "toonation", "doneru"]) {
    assert.ok(PROVIDER_BY_ID.has(id), id);
  }
  for (const id of ["gamesatis", "itemsultan", "patreon", "fourthwall", "throne", "boosty", "tiltify", "liberapay", "tipeee", "paypal", "gumroad", "githubsponsors", "givebutter", "donorbox"]) {
    assert.ok(!PROVIDER_BY_ID.has(id), id);
  }
  assert.equal(new Set(PROVIDERS.map(provider => provider.id)).size, PROVIDERS.length);
});

test("ortak ağ katmanı listedeki bütün platformların gerekli sayfalarında çalışır", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const networkEntry = manifest.content_scripts.find(entry => entry.world === "MAIN"
    && entry.js?.includes("src/network-bridge.js"));
  assert.ok(networkEntry);
  for (const provider of PROVIDERS) {
    for (const domain of provider.domains) {
      const match = `https://*.${domain}/*`;
      assert.ok(
        networkEntry.matches.includes(match),
        `${provider.name} ağ yakalama izninde eksik`
      );
    }
  }
});

test("API sağlayıcılarının olay kaynağını API olarak işaretler", async () => {
  const provider = PROVIDER_BY_ID.get("tipeeestream");
  const event = await normalizeCandidate(provider, {
    eventId: "tip-1",
    name: "Global destekçi",
    amount: "5.00",
    currency: "EUR"
  });
  assert.equal(event.source, "provider-api");
});

test("kimliği olmayan aynı donate aynı saniyede tek, farklı saniyede yeni kimlik alır", async () => {
  const provider = PROVIDER_BY_ID.get("klasgame");
  const candidate = {
    name: "Aynı destekçi",
    amount: "50 TL",
    message: "İyi yayınlar",
    rawText: "Aynı destekçi 50 TL İyi yayınlar"
  };
  const first = await normalizeCandidate(provider, candidate, Date.parse("2026-07-25T12:00:00Z"));
  const repeated = await normalizeCandidate(provider, candidate, Date.parse("2026-07-25T12:00:00.800Z"));
  const second = await normalizeCandidate(provider, candidate, Date.parse("2026-07-25T12:00:01Z"));
  assert.equal(first.eventId, repeated.eventId);
  assert.notEqual(first.eventId, second.eventId);
});

test("göreli süreli ayrı donate olayları farklı saniyelerde yeni kimlik alır", async () => {
  const provider = PROVIDER_BY_ID.get("bynogame");
  const first = await normalizeCandidate(provider, {
    name: "Tekrarlanmayan destekçi",
    amount: "75 TL",
    message: "Başarılar",
    time: "1 dakika önce",
    rawText: "Tekrarlanmayan destekçi 75 TL Başarılar 1 dakika önce"
  }, Date.parse("2026-07-30T10:01:00Z"));
  const second = await normalizeCandidate(provider, {
    name: "Tekrarlanmayan destekçi",
    amount: "75 TL",
    message: "Başarılar",
    time: "2 dakika önce",
    rawText: "Tekrarlanmayan destekçi 75 TL Başarılar 2 dakika önce"
  }, Date.parse("2026-07-30T10:02:00Z"));
  assert.notEqual(first.eventId, second.eventId);
  assert.equal(first.integrityHash, second.integrityHash);
});

test("aynı içerikteki ayrı donate oluşumları farklı yerel olay kimliği alır", async () => {
  const provider = PROVIDER_BY_ID.get("klasgame");
  const shared = {
    name: "Aynı destekçi",
    amount: "50 TL",
    message: "Aynı mesaj",
    rawText: "Aynı destekçi 50 TL Aynı mesaj"
  };
  const first = await normalizeCandidate(provider, { ...shared, occurrenceIndex: 1 });
  const second = await normalizeCandidate(provider, { ...shared, occurrenceIndex: 2 });
  const repeatedFirst = await normalizeCandidate(provider, { ...shared, occurrenceIndex: 1 });
  assert.notEqual(first.eventId, second.eventId);
  assert.equal(first.eventId, repeatedFirst.eventId);
});
