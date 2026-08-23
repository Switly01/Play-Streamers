import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PROVIDERS } from "../src/providers.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

test("every catalog provider has an explicit low-friction connection plan", () => {
  assert.equal(PROVIDERS.length, 26);
  for (const provider of PROVIDERS) {
    assert.ok(["provider-api", "server-webhook", "alert-link"].includes(provider.preferredConnection), provider.id);
    assert.ok(Array.isArray(provider.connectionStrategies) && provider.connectionStrategies.length > 0, provider.id);
    assert.ok(provider.connectionStrategies.includes(provider.preferredConnection), provider.id);
  }
});

test("documented server providers keep an OBS alert-link fallback", () => {
  const ids = ["itemsatis", "kofi", "buymeacoffee", "trakteer", "sociabuzz"];
  for (const id of ids) {
    const provider = PROVIDERS.find(item => item.id === id);
    assert.equal(provider?.preferredConnection, "server-webhook", id);
    assert.ok(provider?.connectionStrategies.includes("alert-link"), id);
  }
});

test("Pally uses its documented background WebSocket instead of page scraping", () => {
  const provider = PROVIDERS.find(item => item.id === "pally");
  assert.equal(provider?.integration, "pally-api");
  const background = fs.readFileSync(path.join(root, "play-streamers-donate-extension", "src", "background.js"), "utf8");
  assert.match(background, /wss:\/\/events\.pally\.gg/);
  assert.match(background, /campaigntip\.notify/);
});

test("Worker exposes revocable per-account webhook delivery with D1 dedupe", () => {
  const worker = fs.readFileSync(path.join(root, "cloudflare-worker.js"), "utf8");
  assert.match(worker, /\/api\/donate-webhooks\/connections\/create/);
  assert.match(worker, /\/api\/donate-webhooks\/connections\/revoke/);
  assert.match(worker, /receiveDonateProviderWebhook/);
  assert.match(worker, /provider-webhook/);
  assert.match(worker, /UNIQUE\(user_id, provider_id, provider_event_id\)/);
  assert.match(worker, /non-payment-event/);
  assert.match(worker, /itemsatis/);
  assert.match(worker, /buymeacoffee/);
  assert.match(worker, /DONATE_PROVIDER_CATALOG_VERSION = 9/);
  assert.match(worker, /livepix/);
});
