"use strict";

const crypto = require("node:crypto");
const { cleanText } = require("./provider-config");

const CURRENCY_ALIASES = new Map([
  ["₺", "TRY"],
  ["TL", "TRY"],
  ["TRY", "TRY"],
  ["$", "USD"],
  ["USD", "USD"],
  ["€", "EUR"],
  ["EUR", "EUR"],
  ["£", "GBP"],
  ["GBP", "GBP"]
]);

function detectCurrency(...values) {
  const text = values.map(value => cleanText(value, 800).toUpperCase()).join(" ");
  for (const [marker, currency] of CURRENCY_ALIASES) {
    if (text.includes(marker)) return currency;
  }
  return "";
}

function parseAmountMinor(value) {
  let text = cleanText(value, 120)
    .replace(/[^\d.,+\-]/g, "")
    .replace(/^[+]/, "");
  if (!text || !/\d/.test(text)) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let decimalSeparator = "";
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSeparator = lastComma > lastDot ? "," : ".";
  } else if (lastComma >= 0) {
    const decimals = text.length - lastComma - 1;
    decimalSeparator = decimals > 0 && decimals <= 2 ? "," : "";
  } else if (lastDot >= 0) {
    const decimals = text.length - lastDot - 1;
    decimalSeparator = decimals > 0 && decimals <= 2 ? "." : "";
  }

  if (decimalSeparator) {
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    text = text.split(thousandsSeparator).join("");
    text = text.replace(decimalSeparator, ".");
  } else {
    text = text.replace(/[.,]/g, "");
  }

  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric * 100);
}

function parseEventTime(value, observedAt) {
  const text = cleanText(value, 160);
  if (!text) return null;
  const direct = Date.parse(text);
  if (Number.isFinite(direct)) return direct;

  const timeMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/);
  if (!timeMatch) return null;
  const date = new Date(observedAt);
  date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), Number(timeMatch[3] || 0), 0);
  if (date.getTime() - observedAt > 60 * 60 * 1000) date.setDate(date.getDate() - 1);
  return date.getTime();
}

function stableEventId(providerId, raw) {
  const explicit = cleanText(raw.eventId, 240);
  if (explicit) return `${providerId}:${explicit}`;
  const fingerprint = [
    providerId,
    cleanText(raw.name, 160).toLocaleLowerCase("tr-TR"),
    cleanText(raw.amount, 120),
    cleanText(raw.currency, 20),
    cleanText(raw.message, 500),
    cleanText(raw.time, 160),
    cleanText(raw.rawText, 1000)
  ].join("\u001f");
  return `${providerId}:sha256:${crypto.createHash("sha256").update(fingerprint).digest("hex")}`;
}

function normalizeDonationEvent(provider, rawInput) {
  const raw = rawInput && typeof rawInput === "object" ? rawInput : {};
  const observedAt = Number(raw.observedAt) || Date.now();
  const amountMinor = parseAmountMinor(raw.amount || raw.rawText);
  if (amountMinor === null) throw new Error("Donate tutarı okunamadı.");

  const currency =
    detectCurrency(raw.currency, raw.amount, raw.rawText) ||
    cleanText(provider.defaultCurrency || "TRY", 8).toUpperCase();
  const eventAt = parseEventTime(raw.time, observedAt);
  const normalized = {
    schemaVersion: 1,
    eventId: stableEventId(provider.id, raw),
    providerId: provider.id,
    providerName: provider.name,
    donorName: cleanText(raw.name || "İsimsiz destekçi", 160),
    amountMinor,
    currency,
    message: cleanText(raw.message, 1000),
    eventAt,
    observedAt,
    sourceUrl: cleanText(raw.sourceUrl, 2048),
    source: provider.mode === "alert" ? "local-alert" : "local-history"
  };
  normalized.integrityHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
  return normalized;
}

module.exports = {
  detectCurrency,
  normalizeDonationEvent,
  parseAmountMinor,
  parseEventTime,
  stableEventId
};
