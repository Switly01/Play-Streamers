import test from "node:test";
import assert from "node:assert/strict";
import {
  PROVIDER_BY_ID,
  isTrustedProviderMonitorUrl,
  scoreProviderMonitorUrl
} from "../src/providers.js";

test("açık platform ana sayfası donate izleme kaynağı sayılmaz", () => {
  const bynogame = PROVIDER_BY_ID.get("bynogame");
  assert.equal(isTrustedProviderMonitorUrl(bynogame, "https://donate.bynogame.com/"), false);
  assert.ok(scoreProviderMonitorUrl(bynogame, "https://donate.bynogame.com/") < 0);
});

test("hesap geçmişi ve doğrulanmış veri uçları yüksek güvenle seçilir", () => {
  const bynogame = PROVIDER_BY_ID.get("bynogame");
  const klasgame = PROVIDER_BY_ID.get("klasgame");
  assert.equal(isTrustedProviderMonitorUrl(
    bynogame,
    "https://api.bynogame.com/streamer/donate/incoming?filters=status:-1&page=1"
  ), true);
  assert.equal(isTrustedProviderMonitorUrl(
    klasgame,
    "https://api.klasgame.com/account/donations/history?page=1"
  ), true);
  assert.equal(isTrustedProviderMonitorUrl(klasgame, "https://www.klasgame.com/giris-yap/"), false);
});
