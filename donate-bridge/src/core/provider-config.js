"use strict";

const crypto = require("node:crypto");

const PROVIDER_MODES = new Set(["history", "alert"]);
const FIELD_NAMES = ["item", "eventId", "name", "amount", "currency", "message", "time"];

function cleanText(value, max = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeHttpUrl(value, label) {
  const text = cleanText(value, 2048);
  if (!text) {
    if (label === "Takip adresi") throw new Error(`${label} zorunludur.`);
    return "";
  }
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(`${label} geçerli bir web adresi olmalıdır.`);
  }
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error(`${label} yalnızca http veya https kullanabilir.`);
  }
  return parsed.toString();
}

function cleanSelector(value) {
  const selector = cleanText(value, 800);
  if (!selector) return "";
  if (selector.includes("\0") || selector.includes("<") || selector.includes(">")) {
    throw new Error("Seçici geçersiz karakter içeriyor.");
  }
  return selector;
}

function allowedHostsFor(config) {
  const hosts = new Set();
  for (const value of [config.watchUrl, config.loginUrl]) {
    if (!value) continue;
    try {
      hosts.add(new URL(value).hostname.toLowerCase());
    } catch {
      // Validation reports malformed URLs before this helper is used.
    }
  }
  for (const value of Array.isArray(config.allowedHosts) ? config.allowedHosts : []) {
    const host = cleanText(value, 253).toLowerCase();
    if (/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host)) {
      hosts.add(host);
    }
  }
  return [...hosts];
}

function validateProviderConfig(input, existingId = "") {
  const value = input && typeof input === "object" ? input : {};
  const name = cleanText(value.name, 80);
  if (name.length < 2) throw new Error("Site adı en az 2 karakter olmalıdır.");

  const watchUrl = normalizeHttpUrl(value.watchUrl, "Takip adresi");
  const loginUrl = normalizeHttpUrl(value.loginUrl, "Giriş adresi");
  const mode = PROVIDER_MODES.has(value.mode) ? value.mode : "history";
  const selectors = {};
  for (const field of FIELD_NAMES) selectors[field] = cleanSelector(value.selectors?.[field]);
  if (!selectors.item && value.enabled !== false) {
    throw new Error("Bağlantıyı açmadan önce donate satırı/bildirim alanı seçilmelidir.");
  }

  const id = existingId || cleanText(value.id, 80) || crypto.randomUUID();
  const result = {
    id,
    name,
    watchUrl,
    loginUrl,
    mode,
    enabled: Boolean(selectors.item) && value.enabled !== false,
    configured: Boolean(selectors.item),
    selectors,
    defaultCurrency: cleanText(value.defaultCurrency || "TRY", 8).toUpperCase(),
    scanLimit: Math.min(500, Math.max(10, Number(value.scanLimit) || 150)),
    createdAt: Number(value.createdAt) || Date.now(),
    updatedAt: Date.now()
  };
  result.allowedHosts = allowedHostsFor({ ...result, allowedHosts: value.allowedHosts });
  return result;
}

function publicProviderConfig(provider) {
  return {
    id: provider.id,
    name: provider.name,
    watchUrl: provider.watchUrl,
    loginUrl: provider.loginUrl,
    mode: provider.mode,
    enabled: provider.enabled,
    configured: Boolean(provider.selectors?.item),
    selectors: { ...provider.selectors },
    defaultCurrency: provider.defaultCurrency,
    scanLimit: provider.scanLimit,
    allowedHosts: [...provider.allowedHosts],
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt
  };
}

module.exports = {
  FIELD_NAMES,
  allowedHostsFor,
  cleanText,
  publicProviderConfig,
  validateProviderConfig
};
