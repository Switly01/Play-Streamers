"use strict";

const PAIRING_ENDPOINT = "https://api.pstreamers.com/api/donate-bridge/pair/claim";
const EVENTS_ENDPOINT = "https://api.pstreamers.com/api/donate-bridge/events";

function normalizePairingCode(value) {
  const code = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-HJ-NP-Z2-9]{10}$/.test(code) ? code : "";
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function claimPairingCode({
  code,
  deviceName,
  appVersion,
  fetchImpl = fetch,
  endpoint = PAIRING_ENDPOINT
}) {
  const normalizedCode = normalizePairingCode(code);
  if (!normalizedCode) throw new Error("Sitedeki 10 karakterli eşleştirme kodunu gir.");
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Play-Streamers-Bridge": String(appVersion || "")
    },
    body: JSON.stringify({
      code: normalizedCode,
      deviceName: String(deviceName || "Windows cihazı").slice(0, 60),
      appVersion: String(appVersion || "").slice(0, 24)
    }),
    signal: AbortSignal.timeout(12000)
  });
  const result = await responseJson(response);
  if (!response.ok || !result.deviceToken || !result.device?.id) {
    throw new Error(result.error || `Eşleştirme tamamlanamadı (API ${response.status}).`);
  }
  return result;
}

async function deliverDonationEvent({
  endpoint = EVENTS_ENDPOINT,
  token,
  event,
  appVersion,
  fetchImpl = fetch
}) {
  if (!/^https:\/\//i.test(String(endpoint || ""))) throw new Error("API adresi HTTPS olmalıdır.");
  if (!String(token || "").trim()) throw new Error("Donate Bridge cihaz anahtarı bulunamadı.");
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${String(token).trim()}`,
      "X-Play-Streamers-Bridge": String(appVersion || "")
    },
    body: JSON.stringify({ event }),
    signal: AbortSignal.timeout(12000)
  });
  const result = await responseJson(response);
  if (!response.ok || result.accepted !== true) {
    const error = new Error(result.error || `API ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return result;
}

module.exports = {
  EVENTS_ENDPOINT,
  PAIRING_ENDPOINT,
  claimPairingCode,
  deliverDonationEvent,
  normalizePairingCode
};
