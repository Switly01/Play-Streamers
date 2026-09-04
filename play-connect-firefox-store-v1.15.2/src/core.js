const CURRENCY_SYMBOLS = {
  "₺": "TRY",
  "TL": "TRY",
  "TRY": "TRY",
  "$": "USD",
  "USD": "USD",
  "€": "EUR",
  "EUR": "EUR",
  "£": "GBP",
  "GBP": "GBP"
};

const JSON_KEYS = {
  id: ["eventId", "event_id", "eventUuid", "event_uuid", "donationId", "donation_id", "donateId", "donate_id", "transactionId", "transaction_id", "operationId", "operation_id", "paymentId", "payment_id", "orderId", "order_id", "orderRowId", "opId", "tipId", "tip_id", "supportId", "support_id", "chargeId", "charge_id", "referenceId", "reference_id", "receiptId", "receipt_id", "invoiceId", "invoice_id", "alertId", "alert_id", "uuid", "_id", "id"],
  name: ["donorName", "donor_name", "supporterName", "supporter_name", "payerName", "payer_name", "customerName", "customer_name", "displayName", "display_name", "nickName", "nickname", "username", "sender", "from", "name"],
  amount: ["amount", "donationAmount", "donation_amount", "supportAmount", "support_amount", "tipAmount", "tip_amount", "amountFormatted", "amount_formatted", "total", "gross", "value"],
  minorAmount: ["amountMinor", "amount_minor", "amountCents", "amount_cents", "grossCents", "gross_cents", "totalCents", "total_cents", "valueCents", "value_cents"],
  currency: ["currency", "currencyCode", "currency_code", "currencyIso", "currency_iso"],
  message: ["message", "comment", "note", "description", "supportMessage", "support_message", "donationMessage", "donation_message"],
  time: ["createdAt", "created_at", "createdDate", "created_date", "dateCreated", "date_created", "donationDate", "donation_date", "transactionDate", "transaction_date", "paidAt", "paid_at", "completedAt", "completed_at", "timestamp", "eventAt", "event_at", "date", "time"]
};

export function compactText(value, maximum = 1000) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

export function detectCurrency(value, fallback = "TRY") {
  const text = compactText(value, 120).toUpperCase();
  const code = text.match(/\b(TRY|USD|EUR|GBP|RUB|SAR|JPY|BRL|IDR|PLN|KRW)\b/)?.[1];
  if (code) return code;
  for (const [symbol,currency] of Object.entries({'R$':'BRL','₽':'RUB','₩':'KRW','¥':'JPY'})) {
    if(text.includes(symbol))return currency;
  }
  for (const [marker, currency] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(marker)) return currency;
  }
  return /^[A-Z]{3}$/.test(String(fallback || "").toUpperCase())
    ? String(fallback).toUpperCase()
    : "TRY";
}

export function parseAmountMinor(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  const text = compactText(value, 160)
    .replace(/[^\d.,-]/g, "")
    .replace(/(?!^)-/g, "");
  if (!text || text === "-") return 0;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let decimalIndex = -1;
  if (lastComma >= 0 && lastDot >= 0) {
    decimalIndex = Math.max(lastComma, lastDot);
  } else {
    const separatorIndex = Math.max(lastComma, lastDot);
    const digitsAfter = separatorIndex >= 0 ? text.length - separatorIndex - 1 : 0;
    if (digitsAfter > 0 && digitsAfter <= 2) decimalIndex = separatorIndex;
  }
  const sign = text.startsWith("-") ? -1 : 1;
  const unsigned = text.replace("-", "");
  const integerPart = (decimalIndex >= 0 ? unsigned.slice(0, decimalIndex) : unsigned).replace(/[.,]/g, "") || "0";
  const fractionPart = decimalIndex >= 0
    ? unsigned.slice(decimalIndex + 1).replace(/[.,]/g, "").padEnd(2, "0").slice(0, 2)
    : "00";
  const minor = (Number(integerPart) * 100) + Number(fractionPart);
  return Number.isSafeInteger(minor) ? sign * minor : 0;
}

function firstValue(object, keys) {
  for (const key of keys) {
    if (object?.[key] !== undefined && object?.[key] !== null && object[key] !== "") return object[key];
  }
  return "";
}

function candidateFromObject(object) {
  if (!object || typeof object !== "object" || Array.isArray(object)) return null;
  const amount = firstValue(object, JSON_KEYS.amount);
  const amountMinor = firstValue(object, JSON_KEYS.minorAmount);
  const id = firstValue(object, JSON_KEYS.id);
  const name = firstValue(object, JSON_KEYS.name);
  const message = firstValue(object, JSON_KEYS.message);
  if ((amount === "" && amountMinor === "") || (!id && !name && !message)) return null;
  return {
    eventId: compactText(id, 320),
    name: compactText(name, 160),
    amount,
    amountMinor,
    currency: compactText(firstValue(object, JSON_KEYS.currency), 16),
    message: compactText(message, 1000),
    time: firstValue(object, JSON_KEYS.time),
    rawText: compactText(JSON.stringify(object), 3000)
  };
}

export function extractJsonCandidates(payload, maximum = 150) {
  const results = [];
  const visited = new Set();
  const mapped = new Set();
  const queue = [payload];
  while (queue.length && results.length < maximum) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    if (Array.isArray(current)) {
      for (const item of current) {
        const candidate = candidateFromObject(item);
        if (candidate) {
          results.push(candidate);
          mapped.add(item);
        }
        if (item && typeof item === "object") queue.push(item);
        if (results.length >= maximum) break;
      }
    } else {
      const candidate = mapped.has(current) ? null : candidateFromObject(current);
      if (candidate) results.push(candidate);
      for (const value of Object.values(current)) {
        if (value && typeof value === "object") queue.push(value);
      }
    }
  }
  return results;
}

function parseEventTime(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 10_000_000_000 ? Math.trunc(value * 1000) : Math.trunc(value);
  }
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stableCandidateText(value, maximum = 1000) {
  return compactText(value, maximum)
    .replace(/\b(?:az önce|just now)\b/gi, "")
    .replace(/\b\d+\s*(?:saniye|dakika|saat|gün|hafta|ay|yıl|seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s*(?:önce|ago)?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stableEventTime(value, parsedValue) {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.floor(parsedValue / 1000));
  const raw = compactText(value, 160);
  if (!raw) return "";
  return Number.isFinite(Date.parse(raw)) ? String(Math.floor(parsedValue / 1000)) : stableCandidateText(raw, 160);
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function normalizeCandidate(provider, rawInput, observedAt = Date.now()) {
  const raw = rawInput && typeof rawInput === "object" ? rawInput : {};
  const explicitCurrency = compactText(raw.currency, 16).toUpperCase();
  const currency = /^[A-Z]{3}$/.test(explicitCurrency) ? explicitCurrency : detectCurrency(`${raw.currency || ""} ${raw.amount || ""}`, provider.defaultCurrency);
  const suppliedMinor = Number(raw.amountMinor);
  const amountMinor = Number.isSafeInteger(suppliedMinor) && suppliedMinor > 0
    ? suppliedMinor
    : parseAmountMinor(raw.amount);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return null;
  const donorName = compactText(raw.name, 160) || "İsimsiz destekçi";
  const message = compactText(raw.message, 1000);
  const eventAt = parseEventTime(raw.time, observedAt);
  const explicitId = compactText(raw.eventId, 320);
  const occurrenceIndex = Math.max(1, Math.min(500, Math.trunc(Number(raw.occurrenceIndex || 1)) || 1));
  const stableIntegrityFingerprint = [
    provider.id,
    donorName,
    amountMinor,
    currency,
    message,
    stableCandidateText(raw.rawText, 1000)
  ].join("\u001f");
  const eventSecond = stableEventTime(raw.time, eventAt) || String(Math.floor(observedAt / 1000));
  const fingerprint = [
    stableIntegrityFingerprint,
    `second:${eventSecond}`,
    `occurrence:${occurrenceIndex}`
  ].join("\u001f");
  const fingerprintHash = await sha256Hex(fingerprint);
  const providerEventId = explicitId && raw.time === undefined
    ? explicitId
    : (explicitId ? `${explicitId}:${fingerprintHash.slice(0, 24)}` : `sha256:${fingerprintHash}`);
  return {
    schemaVersion: 1,
    eventId: providerEventId,
    providerId: provider.id,
    providerName: provider.name,
    donorName,
    amountMinor,
    currency,
    message,
    eventAt,
    observedAt,
    source: provider.integration.endsWith("-api")
      ? "provider-api"
      : (provider.connectionMode === "alert-link" ? "local-alert" : "browser-session"),
    integrityHash: await sha256Hex(stableIntegrityFingerprint)
  };
}
