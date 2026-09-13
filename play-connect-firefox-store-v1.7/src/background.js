import {
  FEATURED_PROVIDER_IDS,
  PROVIDERS,
  PROVIDER_BY_ID,
  emptyProviderSettings,
  providerForUrl,
  isProviderUrlAllowed,
  alertLinkInfo,
  isProviderAlertUrlAllowed,
  supportsAlertLink,
  usesAlertLink,
  comparableAlertUrl,
  scoreProviderMonitorUrl,
  isTrustedProviderMonitorUrl
} from "./providers.js";
import { extractJsonCandidates, normalizeCandidate } from "./core.js";
import { LOCALE_CURRENCIES, localeCurrency } from "./locale-settings.js";

const API_ORIGIN = "https://api.pstreamers.com";
const SW_ACTIVITY_ENDPOINT = "https://api.swcreate.com/api/activity/pulse";
const PAIR_ENDPOINT = `${API_ORIGIN}/api/donate-bridge/pair/claim`;
const DEFAULT_EVENT_ENDPOINT = `${API_ORIGIN}/api/donate-bridge/events`;
const DEVICE_STATUS_ENDPOINT = `${API_ORIGIN}/api/donate-bridge/device/status`;
const KICK_METRICS_ENDPOINT = `${API_ORIGIN}/api/donate-bridge/kick-metrics`;
const DEVICE_DISCONNECT_ENDPOINT = `${API_ORIGIN}/api/donate-bridge/device/disconnect`;
const SUPPORT_ENDPOINT = `${API_ORIGIN}/api/donate-bridge/support`;
const BYNOGAME_EVENTS_ENDPOINT = "https://api.bynogame.com/streamer/donate/incoming?filters=status:-1&sort=date:-1&page=1&limit=100";
const APP_VERSION = `firefox-${browser.runtime.getManifest().version}`;
const POLL_ALARM = "play-streamers-donate-poll";
const RETRY_ALARM = "play-streamers-donate-retry";
const MAX_QUEUE = 2000;
const MAX_SEEN = 10000;
const MAX_LOCAL_LOG = 120;
const OFFSCREEN_PATH = "offscreen/offscreen.html";
const PROVIDER_DEFAULTS_VERSION = 11;
const QUEUE_SANITIZER_VERSION = 8;
const DELIVERED_LEDGER_VERSION = 1;
// Firefox ayakta olduğu sürece yeni olayları olabilecek en kısa sürede işler.
// Döngü fastPollRunning kilidiyle korunur; yavaş bir tur bitmeden yenisi başlamaz.
const FAST_POLL_INTERVAL_MS = 750;
const COOKIE_SESSION_SYNC_INTERVAL_MS = 1 * 1000;
const MANAGED_FALLBACK_REFRESH_MS = 10 * 1000;
const MAX_PENDING_EVENT_AGE_MS = 15 * 60 * 1000;
const CONNECTION_STATUS_INTERVAL_MS = 1 * 1000;
const KICK_METRICS_CHECK_INTERVAL_MS = 5 * 1000;
const KICK_METRICS_HEARTBEAT_MS = 5 * 60 * 1000;
const ALERT_EVENT_TIME_TOLERANCE_MS = 15 * 1000;
const MAX_BASELINE_EVENT_IDS = 1000;
let streamElementsSocket = null;
let streamElementsConnectPromise = null;
let streamElementsReconnectTimer = 0;
let streamElementsReconnectAttempts = 0;
let pallySocket = null;
let pallyConnectPromise = null;
let pallyReconnectTimer = 0;
let pallyReconnectAttempts = 0;
let flushQueuePromise = null;
let fastPollTimer = 0;
let fastPollRunning = false;
let stateMutationTail = Promise.resolve();
let lastCookieSessionSyncAt = 0;
let lastSwActivityPulseAt = 0;

function defaultState() {
  return {
    installationId: crypto.randomUUID(),
    connection: {
      paired: false,
      deviceId: "",
      deviceName: "",
      deviceToken: "",
      apiEndpoint: DEFAULT_EVENT_ENDPOINT,
      providerCatalogVersion: 0,
      pairedAt: 0,
      pairingCode: "",
      accountEmail: "",
      lastStatusCheckAt: 0,
      lastDeliveryAttemptAt: 0,
      lastDeliveryAt: 0,
      lastDeliveryHttpStatus: 0,
      lastServerEventCount: 0,
      capturedEventCount: 0,
      deliveredEventCount: 0,
      serverConnectedProviderIds: [],
      kickTarget: null,
      kickFollowersCount: null,
      lastKickMetricCheckAt: 0,
      lastKickMetricSyncAt: 0,
      kickMetricError: "",
      lastError: ""
    },
    managedBrowser: {
      mode: "temporary-login-window",
      incognitoAllowed: true,
      windowId: 0,
      checkedAt: 0,
      lastError: ""
    },
    providers: Object.fromEntries(PROVIDERS.map(provider => [
      provider.id,
      emptyProviderSettings(provider)
    ])),
    queue: [],
    seen: {},
    activity: [],
    queueSanitizerVersion: QUEUE_SANITIZER_VERSION,
    deliveredLedgerVersion: DELIVERED_LEDGER_VERSION
  };
}

function sanitizeQueue(items) {
  const now = Date.now();
  const unique = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const event = item?.event;
    if (!item?.queueId || !event?.providerId || !event?.eventId) continue;
    const hasEventAt = event.eventAt !== null && event.eventAt !== undefined && event.eventAt !== "";
    const eventAt = hasEventAt ? Number(event.eventAt) : NaN;
    if (hasEventAt && (!Number.isFinite(eventAt) || eventAt < now - MAX_PENDING_EVENT_AGE_MS || eventAt > now + 5 * 60 * 1000)) continue;
    const observedAt = Number(event.observedAt);
    const safeEvent = {
      ...event,
      eventAt: hasEventAt ? Math.trunc(eventAt) : null,
      observedAt: Number.isFinite(observedAt) && observedAt <= now + 5 * 60 * 1000
        ? Math.trunc(observedAt)
        : now
    };
    unique.set(`${safeEvent.providerId}:${safeEvent.eventId}`, { ...item, event: safeEvent });
  }
  return [...unique.values()].slice(-MAX_QUEUE);
}

async function readState() {
  const stored = await browser.storage.local.get("playStreamersDonate");
  const initial = defaultState();
  const value = stored.playStreamersDonate || {};
  const providers = { ...initial.providers };
  const storedProviderDefaultsVersion = Number(value.providerDefaultsVersion || 0);
  const shouldEnableProviders = storedProviderDefaultsVersion < 1;
  const shouldResetLegacyGitHubStatus = storedProviderDefaultsVersion < 2;
  const shouldMigrateProviderBaselines = storedProviderDefaultsVersion < 3;
  const shouldMigrateManagedCapture = storedProviderDefaultsVersion < 4;
  const shouldMigrateBackgroundCapture = storedProviderDefaultsVersion < 5;
  const shouldRepairMonitorUrls = storedProviderDefaultsVersion < 6;
  const shouldRemoveManualPageCapture = storedProviderDefaultsVersion < 7;
  const shouldMigrateAlertLinks = storedProviderDefaultsVersion < 8;
  const shouldForceBackgroundEnabled = storedProviderDefaultsVersion < 9;
  const shouldRepairAlertBaselines = storedProviderDefaultsVersion < 10;
  const shouldEnableAlertDomFallback = storedProviderDefaultsVersion < 11;
  const shouldResetLegacyLedger = Number(value.deliveredLedgerVersion || 0) < DELIVERED_LEDGER_VERSION;
  for (const provider of PROVIDERS) {
    providers[provider.id] = {
      ...providers[provider.id],
      ...(value.providers?.[provider.id] || {}),
      selectors: {
        ...providers[provider.id].selectors,
        ...(value.providers?.[provider.id]?.selectors || {})
      }
    };
    if (shouldEnableProviders) providers[provider.id].enabled = true;
    if (shouldForceBackgroundEnabled) providers[provider.id].enabled = true;
    if (shouldResetLegacyGitHubStatus && provider.id === "githubsponsors") {
      providers[provider.id].loginStatus = "unknown";
      providers[provider.id].status = "setup";
      providers[provider.id].lastError = "";
    }
    if (shouldMigrateProviderBaselines && Number(providers[provider.id].lastScanAt || 0) > 0) {
      providers[provider.id].baselineComplete = true;
    }
    if (shouldMigrateManagedCapture && provider.integration === "session") {
      providers[provider.id].captureMode = "managed-private";
      providers[provider.id].managedWindowId = 0;
      providers[provider.id].managedTabId = 0;
      providers[provider.id].lastCaptureError = "";
    }
    if (shouldMigrateBackgroundCapture && provider.integration === "session") {
      providers[provider.id].captureMode = "background-request";
      providers[provider.id].backgroundStatus = providers[provider.id].networkFeedUrl
        ? "ready"
        : "learning-required";
      providers[provider.id].backgroundFailureCount = 0;
      providers[provider.id].managedWindowId = 0;
      providers[provider.id].managedTabId = 0;
    }
    if (shouldRepairMonitorUrls && provider.integration === "session") {
      if (!isTrustedProviderMonitorUrl(provider, providers[provider.id].networkFeedUrl)) {
        providers[provider.id].networkFeedUrl = "";
      }
      if (!isTrustedProviderMonitorUrl(provider, providers[provider.id].historyUrl)) {
        providers[provider.id].historyUrl = "";
      }
      if (!isTrustedProviderMonitorUrl(provider, providers[provider.id].detectedUrl)) {
        providers[provider.id].detectedUrl = "";
      }
      if (provider.id === "bynogame" && providers[provider.id].sessionToken) {
        providers[provider.id].historyUrl = BYNOGAME_EVENTS_ENDPOINT;
        providers[provider.id].detectedUrl = BYNOGAME_EVENTS_ENDPOINT;
      }
      providers[provider.id].monitorUrlConfidence = providers[provider.id].historyUrl
        ? scoreProviderMonitorUrl(provider, providers[provider.id].historyUrl)
        : 0;
    }
    if (shouldRemoveManualPageCapture && provider.integration === "session") {
      providers[provider.id].selectors = emptyProviderSettings(provider).selectors;
      providers[provider.id].detectedUrl = "";
      if (provider.id === "bynogame") {
        providers[provider.id].networkFeedUrl = "";
        providers[provider.id].historyUrl = BYNOGAME_EVENTS_ENDPOINT;
        providers[provider.id].detectedUrl = BYNOGAME_EVENTS_ENDPOINT;
      } else {
        providers[provider.id].historyUrl = providers[provider.id].networkFeedUrl || "";
      }
      providers[provider.id].monitorUrlConfidence = providers[provider.id].historyUrl
        ? scoreProviderMonitorUrl(provider, providers[provider.id].historyUrl)
        : 0;
    }
    if (shouldMigrateAlertLinks && provider.integration === "session") {
      providers[provider.id].alertUrl = "";
      providers[provider.id].alertRenderer = "";
      providers[provider.id].alertFrameStatus = "idle";
      providers[provider.id].alertFrameUpdatedAt = 0;
      providers[provider.id].captureMode = "alert-frame";
      providers[provider.id].backgroundStatus = "link-required";
      providers[provider.id].historyUrl = "";
      providers[provider.id].detectedUrl = "";
      providers[provider.id].networkFeedUrl = "";
      providers[provider.id].sessionToken = "";
      providers[provider.id].sessionTokenCapturedAt = 0;
      providers[provider.id].managedWindowId = 0;
      providers[provider.id].managedTabId = 0;
      providers[provider.id].loginStatus = "unknown";
      providers[provider.id].status = "setup";
      providers[provider.id].lastError = "";
      providers[provider.id].lastCaptureError = "";
      providers[provider.id].baselineComplete = true;
    }
    if (!Array.isArray(providers[provider.id].baselineEventIds)) {
      providers[provider.id].baselineEventIds = [];
    }
    if (shouldRepairAlertBaselines && provider.integration === "session" && providers[provider.id].alertUrl) {
      providers[provider.id].baselineComplete = false;
      providers[provider.id].baselineEventIds = [];
      providers[provider.id].monitoringStartedAt = Date.now();
      providers[provider.id].lastBaselineCount = 0;
    }
    if (shouldEnableAlertDomFallback && provider.integration === "session") {
      providers[provider.id].lastNetworkCandidateAt = 0;
      providers[provider.id].alertDomBaselineComplete = false;
    }
  }
  const result = {
    ...initial,
    ...value,
    providerDefaultsVersion: PROVIDER_DEFAULTS_VERSION,
    connection: { ...initial.connection, ...(value.connection || {}) },
    managedBrowser: { ...initial.managedBrowser, ...(value.managedBrowser || {}) },
    providers,
    queue: sanitizeQueue(value.queue),
    seen: shouldResetLegacyLedger
      ? {}
      : (value.seen && typeof value.seen === "object" ? value.seen : {}),
    activity: Array.isArray(value.activity)
      ? value.activity
        .filter(item => !/Destek zaman[ıi] ge[cç]ersiz/i.test(String(item?.message || "")))
        .slice(0, MAX_LOCAL_LOG)
      : []
  };
  if (shouldRepairAlertBaselines) {
    const repairedProviders = new Set(PROVIDERS
      .filter(provider => provider.integration === "session" && providers[provider.id]?.alertUrl)
      .map(provider => provider.id));
    const previousQueueLength = result.queue.length;
    result.queue = result.queue.filter(item => !(
      repairedProviders.has(item?.event?.providerId)
      && item?.event?.source === "local-alert"
    ));
    const removed = previousQueueLength - result.queue.length;
    if (removed > 0) {
      activity(result, "info", `${removed} eski OBS donate kaydı teslimat kuyruğundan temizlendi.`);
    }
  }
  // Older Play Connect builds could keep a workers.dev or retired endpoint in
  // Firefox storage. Delivery always uses the current first-party API address.
  result.connection.apiEndpoint = DEFAULT_EVENT_ENDPOINT;
  if (/Destek zaman[ıi] ge[cç]ersiz/i.test(String(result.connection.lastError || ""))) {
    result.connection.lastError = "";
  }
  const resetLegacyDeliveryBackoff = Number(value.queueSanitizerVersion || 0) < QUEUE_SANITIZER_VERSION;
  if (resetLegacyDeliveryBackoff) {
    result.queue = result.queue.map(item => ({
      ...item,
      attempts: 0,
      nextAttemptAt: 0,
    }));
  }
  const queueNeedsMigration = Number(value.queueSanitizerVersion || 0) < QUEUE_SANITIZER_VERSION
    || result.queue.length !== (Array.isArray(value.queue) ? value.queue.length : 0);
  result.queueSanitizerVersion = QUEUE_SANITIZER_VERSION;
  result.deliveredLedgerVersion = DELIVERED_LEDGER_VERSION;
  if (shouldEnableProviders || shouldResetLegacyGitHubStatus || shouldMigrateProviderBaselines
    || shouldMigrateManagedCapture || shouldMigrateBackgroundCapture || shouldRepairMonitorUrls
    || shouldMigrateAlertLinks || shouldForceBackgroundEnabled || shouldRepairAlertBaselines
    || shouldEnableAlertDomFallback || shouldResetLegacyLedger || queueNeedsMigration) {
    await browser.storage.local.set({ playStreamersDonate: result });
  }
  return result;
}

async function writeState(state) {
  await browser.storage.local.set({ playStreamersDonate: state });
}

async function pulseSwProductActivity(force = false) {
  const now = Date.now();
  if (!force && now - lastSwActivityPulseAt < 60_000) return;
  lastSwActivityPulseAt = now;
  const state = await readState();
  await fetch(SW_ACTIVITY_ENDPOINT, {
    method: "POST",
    credentials: "omit",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product: "play-connect", visitor: state.installationId }),
  });
}

function mutateState(mutator) {
  const operation = stateMutationTail.then(async () => {
    const state = await readState();
    const result = await mutator(state);
    await writeState(state);
    return { state, result };
  });
  stateMutationTail = operation.then(() => undefined, () => undefined);
  return operation;
}

function publicState(state) {
  return {
    uiLocale: state.uiLocale || "tr",
    connection: {
      ...state.connection,
      deviceToken: undefined,
      hasDeviceToken: Boolean(state.connection.deviceToken)
    },
    managedBrowser: { ...state.managedBrowser },
    providers: Object.fromEntries(PROVIDERS.map(provider => {
      const config = state.providers[provider.id] || emptyProviderSettings(provider);
      return [provider.id, {
        ...config,
        apiToken: undefined,
        hasApiToken: Boolean(config.apiToken),
        sessionToken: undefined,
        hasSessionToken: Boolean(config.sessionToken),
        networkFeedUrl: undefined,
        hasNetworkFeed: Boolean(config.networkFeedUrl),
        alertUrl: undefined,
        hasAlertUrl: Boolean(config.alertUrl),
        alertHost: alertLinkInfo(provider, config.alertUrl)?.hostname || ""
      }];
    })),
    providerCatalog: PROVIDERS,
    featuredProviderIds: FEATURED_PROVIDER_IDS,
    queueCount: state.queue.length,
    activity: state.activity.slice(0, 20)
  };
}

function connectedProviderIds(state) {
  return PROVIDERS.filter(provider => {
    const config = state.providers?.[provider.id];
    if (!config?.enabled || config.status !== "connected") return false;
    return provider.integration !== "session"
      || (Boolean(config.alertUrl) && config.alertFrameStatus === "active");
  }).map(provider => provider.id);
}

function serverConnectedProviderIds(state) {
  return new Set(Array.isArray(state.connection?.serverConnectedProviderIds)
    ? state.connection.serverConnectedProviderIds
    : []);
}

function activity(state, type, message, providerId = "") {
  state.activity.unshift({
    id: crypto.randomUUID(),
    type,
    message: String(message || "").slice(0, 240),
    providerId,
    at: Date.now()
  });
  state.activity = state.activity.slice(0, MAX_LOCAL_LOG);
}

async function notify(title, message) {
  const state = await readState();
  if (state.notifications === false) return;
  await browser.notifications.create({
    type: "basic",
    iconUrl: browser.runtime.getURL("assets/icon-128.png"),
    title,
    message
  }).catch(() => {});
}

function base64ToBytes(value) {
  const binary = atob(String(value || ""));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function supportAttachmentMime(name, suppliedType) {
  const cleanType = String(suppliedType || "").trim().toLowerCase();
  if (cleanType && cleanType !== "application/octet-stream") return cleanType;
  const extension = String(name || "").toLowerCase().split(".").pop();
  return ({
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    pdf: "application/pdf",
    txt: "text/plain",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  })[extension] || "application/octet-stream";
}

async function sendSupportRequest(input) {
  const state = await readState();
  const paired = Boolean(state.connection.paired && state.connection.deviceToken);
  const email = String(input?.email || "").trim();
  if (!paired && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Hesap bağlı değilken geçerli bir e-posta adresi girmelisin.");
  }
  const form = new FormData();
  form.append("email", paired ? "" : email);
  form.append("subject", String(input?.subject || "").trim());
  form.append("message", String(input?.message || "").trim());
  for (const item of Array.isArray(input?.attachments) ? input.attachments.slice(0, 10) : []) {
    const bytes = base64ToBytes(item.base64);
    const name = String(item.name || "dosya");
    const file = new Blob([bytes], { type: supportAttachmentMime(name, item.type) });
    form.append("attachments", file, name);
  }
  const headers = { "x-play-streamers-bridge": APP_VERSION };
  if (paired) headers.authorization = `Bearer ${state.connection.deviceToken}`;
  const response = await fetch(SUPPORT_ENDPOINT, { method: "POST", headers, body: form });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Destek talebi gönderilemedi.");
  await mutateState(latest => {
    activity(latest, "success", "Play Connect destek talebi gönderildi.");
  });
  return { ...result, accountEmailUsed: paired };
}

function formatPairingCode(value) {
  const normalized = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length === 16) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12)}`;
  }
  if (normalized.length === 12) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8)}`;
  }
  if (normalized.length === 10) {
    return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
  }
  return normalized;
}

async function pairAccount(code) {
  const state = await readState();
  if (state.connection.paired && state.connection.deviceToken) {
    throw new Error("Yeni kod girmeden önce mevcut Play Streamers bağlantısını kaldır.");
  }
  const normalized = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^(?:[A-HJ-NP-Z2-9]{10}|[A-HJ-NP-Z2-9]{12}|[A-HJ-NP-Z2-9]{16})$/.test(normalized)) {
    throw new Error("Play Streamers sitesindeki 16 karakterli eşleştirme kodunu gir.");
  }
  const response = await fetch(PAIR_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-play-streamers-bridge": APP_VERSION
    },
    body: JSON.stringify({
      code: normalized,
      deviceName: "Play Connect",
      clientInstanceId: state.installationId,
      appVersion: APP_VERSION
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.deviceToken) {
    throw new Error(result.error || "Eşleştirme tamamlanamadı.");
  }
  const mutation = await mutateState(latest => {
    latest.connection = {
      ...defaultState().connection,
      paired: true,
      deviceId: String(result.device?.id || ""),
      deviceName: String(result.device?.name || "Firefox Eklentisi"),
      deviceToken: String(result.deviceToken),
      apiEndpoint: String(result.apiEndpoint || DEFAULT_EVENT_ENDPOINT),
      providerCatalogVersion: Number(result.providerCatalogVersion || 0),
      pairedAt: Date.now(),
      pairingCode: formatPairingCode(normalized),
      accountEmail: String(result.accountEmail || ""),
      lastStatusCheckAt: Date.now(),
      lastDeliveryAttemptAt: 0,
      lastDeliveryAt: 0,
      lastDeliveryHttpStatus: 0,
      lastServerEventCount: 0,
      serverConnectedProviderIds: [],
      lastError: ""
    };
    activity(latest, "success", "Play Streamers hesabı güvenli biçimde eşleştirildi.");
  });
  await flushQueue();
  return publicState(await readState());
}

async function clearDisconnectedState(expectedToken, message) {
  const mutation = await mutateState(state => {
    if (expectedToken && state.connection.deviceToken !== expectedToken) return false;
    state.connection = defaultState().connection;
    state.queue = [];
    activity(state, "info", message);
    return true;
  });
  return publicState(mutation.state);
}

async function syncConnectionStatus(force = false) {
  const state = await readState();
  if (!state.connection.paired || !state.connection.deviceToken) return publicState(state);
  const expectedToken = state.connection.deviceToken;
  if (!force && Date.now() - Number(state.connection.lastStatusCheckAt || 0) < CONNECTION_STATUS_INTERVAL_MS) {
    return publicState(state);
  }
  try {
    const response = await fetch(DEVICE_STATUS_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${state.connection.deviceToken}`,
        "content-type": "application/json",
        "x-play-streamers-bridge": APP_VERSION
      },
      body: JSON.stringify({ connectedProviders: connectedProviderIds(state) })
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 404 || response.status === 410) {
      return clearDisconnectedState(expectedToken, "Site tarafında kaldırılan hesap eşleştirmesi bu eklentiden de kapatıldı.");
    }
    if (!response.ok || !result.paired) {
      throw new Error(result.error || `Bağlantı durumu alınamadı (${response.status}).`);
    }
    const mutation = await mutateState(latest => {
      if (latest.connection.deviceToken !== expectedToken) return false;
      latest.connection.lastStatusCheckAt = Date.now();
      latest.connection.lastError = "";
      if (result.device?.name) latest.connection.deviceName = String(result.device.name);
      latest.connection.accountEmail = String(result.accountEmail || latest.connection.accountEmail || "");
      latest.connection.kickTarget = result.kickTarget?.slug ? {
        broadcasterId: String(result.kickTarget.broadcasterId || ""),
        slug: String(result.kickTarget.slug || "")
      } : null;
      latest.connection.serverConnectedProviderIds = Array.isArray(result.serverConnectedProviderIds)
        ? result.serverConnectedProviderIds.filter(id => PROVIDER_BY_ID.has(id))
        : [];
      return true;
    });
    const central = serverConnectedProviderIds(mutation.state);
    if (central.has("streamelements")) closeStreamElementsSocket();
    if (central.has("pally")) closePallySocket();
    await syncAlertSources(mutation.state).catch(() => {});
    return publicState(mutation.state);
  } catch (error) {
    const mutation = await mutateState(latest => {
      if (latest.connection.deviceToken !== expectedToken) return false;
      latest.connection.lastStatusCheckAt = Date.now();
      latest.connection.lastError = String(error?.message || "Bağlantı durumu kontrol edilemedi.").slice(0, 240);
      return true;
    });
    return publicState(mutation.state);
  }
}

function kickFollowerCountFromPayload(payload) {
  const channel = payload?.channel || payload?.data || payload || {};
  const raw = channel.followers_count ?? channel.followersCount ?? channel.follower_count
    ?? channel.followerCount ?? channel.followers ?? channel?.livestream?.channel?.followers_count;
  const count = Number(raw);
  return raw !== null && raw !== undefined && Number.isFinite(count) && count >= 0
    ? Math.floor(count)
    : null;
}

function kickSubscriberCountFromPayload(payload) {
  const channel = payload?.channel || payload?.data || payload || {};
  const raw = channel.active_subscribers_count ?? channel.activeSubscribersCount
    ?? channel.subscribers_count ?? channel.subscribersCount
    ?? channel.subscriber_count ?? channel.subscriberCount
    ?? channel?.livestream?.channel?.active_subscribers_count;
  const count = Number(raw);
  return raw !== null && raw !== undefined && Number.isFinite(count) && count >= 0
    ? Math.floor(count)
    : null;
}

async function syncKickChannelMetrics(force = false) {
  const state = await readState();
  const target = state.connection?.kickTarget;
  if (!state.connection?.paired || !state.connection?.deviceToken || !target?.slug) return false;
  const now = Date.now();
  if (!force && now - Number(state.connection.lastKickMetricCheckAt || 0) < KICK_METRICS_CHECK_INTERVAL_MS) return false;
  let followersCount = null;
  let subscribersCount = null;
  let lastError = "";
  for (const endpoint of [
    `https://kick.com/api/v2/channels/${encodeURIComponent(target.slug)}`,
    `https://kick.com/api/v1/channels/${encodeURIComponent(target.slug)}`,
  ]) {
    try {
      const response = await fetch(endpoint, {
        headers: { accept: "application/json", "x-requested-with": "XMLHttpRequest" },
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        lastError = `Kick kanal özeti alınamadı (${response.status}).`;
        continue;
      }
      const payload = await response.json();
      followersCount ??= kickFollowerCountFromPayload(payload);
      subscribersCount ??= kickSubscriberCountFromPayload(payload);
      if (followersCount !== null && subscribersCount !== null) break;
      lastError = "Kick kanal özetinde takipçi veya aktif abone sayısı bulunamadı.";
    } catch (error) {
      lastError = String(error?.message || "Kick takipçi sayısı okunamadı.").slice(0, 180);
    }
  }
  if (followersCount === null && subscribersCount === null) {
    await mutateState(latest => {
      latest.connection.lastKickMetricCheckAt = now;
      latest.connection.kickMetricError = lastError || "Kick takipçi ve aktif abone sayısı okunamadı.";
    });
    return false;
  }
  const changed = (followersCount !== null && Number(state.connection.kickFollowersCount) !== followersCount)
    || (subscribersCount !== null && Number(state.connection.kickSubscribersCount) !== subscribersCount);
  const heartbeatDue = now - Number(state.connection.lastKickMetricSyncAt || 0) >= KICK_METRICS_HEARTBEAT_MS;
  if (force || changed || heartbeatDue) {
    const response = await fetch(KICK_METRICS_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${state.connection.deviceToken}`,
        "content-type": "application/json",
        "x-play-streamers-bridge": APP_VERSION,
      },
      body: JSON.stringify({
        broadcasterId: String(target.broadcasterId || ""),
        slug: String(target.slug),
        followersCount,
        subscribersCount,
        observedAt: now,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || `Kick takipçi sayısı sunucuya iletilemedi (${response.status}).`);
  }
  await mutateState(latest => {
    latest.connection.lastKickMetricCheckAt = now;
    if (followersCount !== null) latest.connection.kickFollowersCount = followersCount;
    if (subscribersCount !== null) latest.connection.kickSubscribersCount = subscribersCount;
    if (force || changed || heartbeatDue) latest.connection.lastKickMetricSyncAt = now;
    latest.connection.kickMetricError = "";
  });
  return true;
}

function providerLoginLaunchUrl(provider) {
  const url = new URL(provider.loginUrl);
  if (/(?:^|\/)(?:login|signin|sign-in|auth|giris|giriş|oturum)(?:\/|$)/i.test(url.pathname)) {
    return url.toString();
  }
  url.searchParams.set("ps_open_login", "1");
  return url.toString();
}

async function refreshManagedBrowserStatus() {
  const mutation = await mutateState(state => {
    state.managedBrowser.mode = "temporary-login-window";
    state.managedBrowser.incognitoAllowed = true;
    state.managedBrowser.checkedAt = Date.now();
    state.managedBrowser.lastError = "";
    return true;
  });
  if (Number(mutation.state.managedBrowser.windowId || 0)) {
    const liveWindow = await existingManagedWindow(Number(mutation.state.managedBrowser.windowId));
    if (!liveWindow) {
      const stale = await mutateState(state => {
        const staleWindowId = Number(state.managedBrowser.windowId || 0);
        state.managedBrowser.windowId = 0;
        state.managedBrowser.lastError = "Önceki Play Connect özel penceresi artık açık değil.";
        for (const provider of PROVIDERS.filter(item => item.integration === "session")) {
          const config = state.providers[provider.id];
          if (Number(config?.managedWindowId || 0) !== staleWindowId) continue;
          config.managedWindowId = 0;
          config.managedTabId = 0;
          if (config.backgroundStatus !== "active") {
            config.loginStatus = "required";
            config.status = "setup";
            config.lastCaptureError = state.managedBrowser.lastError;
          }
        }
      });
      return { allowed: true, state: stale.state };
    }
  }
  return { allowed: true, state: mutation.state };
}

function managedSenderAllowed(provider, config, sender) {
  if (provider.integration !== "session" || config?.captureMode !== "login-learning") return true;
  const expectedWindowId = Number(config.managedWindowId || 0);
  const expectedTabId = Number(config.managedTabId || 0);
  if (!expectedWindowId && !expectedTabId) return true;
  return Number(sender.tab.windowId || 0) === expectedWindowId || Number(sender.tab.id || 0) === expectedTabId;
}

async function existingManagedWindow(windowId) {
  if (!windowId || !browser.windows?.get) return null;
  try {
    const browserWindow = await browser.windows.get(windowId, { populate: true });
    return browserWindow || null;
  } catch {
    return null;
  }
}

async function openManagedProvider(provider, targetUrl) {
  if (provider.integration !== "session") {
    await browser.tabs.create({ url: targetUrl });
    return { managed: false };
  }
  await refreshManagedBrowserStatus();

  const current = await readState();
  let browserWindow = await existingManagedWindow(Number(current.managedBrowser.windowId || 0));
  let tab = null;
  if (browserWindow) {
    const storedTabId = Number(current.providers[provider.id]?.managedTabId || 0);
    tab = browserWindow.tabs?.find(item => Number(item.id || 0) === storedTabId) || null;
    if (tab?.id) {
      tab = await browser.tabs.update(tab.id, { url: targetUrl, active: true });
    } else {
      tab = await browser.tabs.create({ windowId: browserWindow.id, url: targetUrl, active: true });
    }
    await browser.windows.update(browserWindow.id, { focused: true }).catch(() => {});
  } else {
    browserWindow = await browser.windows.create({
      url: targetUrl,
      incognito: false,
      type: "popup",
      focused: true,
      width: 1180,
      height: 820
    });
    tab = browserWindow?.tabs?.[0] || null;
  }
  if (!browserWindow?.id || !tab?.id) {
    throw new Error("Play Connect geçici giriş penceresi oluşturulamadı.");
  }

  const mutation = await mutateState(state => {
    const config = state.providers[provider.id] || emptyProviderSettings(provider);
    state.managedBrowser.windowId = browserWindow.id;
    state.managedBrowser.mode = "temporary-login-window";
    state.managedBrowser.incognitoAllowed = true;
    state.managedBrowser.checkedAt = Date.now();
    state.managedBrowser.lastError = "";
    config.captureMode = "login-learning";
    config.backgroundStatus = "learning";
    config.managedWindowId = browserWindow.id;
    config.managedTabId = tab.id;
    config.managedStartedAt = Date.now();
    config.loginStatus = "waiting";
    config.status = "setup";
    config.lastError = "";
    config.lastCaptureError = "";
    state.providers[provider.id] = config;
    activity(state, "info", `${provider.name} için geçici giriş penceresi açıldı. Sekmesiz veri bağlantısı öğrenildiğinde pencere otomatik kapanacak.`, provider.id);
  });
  return { managed: true, windowId: browserWindow.id, tabId: tab.id, state: mutation.state };
}

async function managedCookieStoreId(tabId) {
  if (!tabId || !browser.cookies?.getAllCookieStores) return "";
  const stores = await browser.cookies.getAllCookieStores().catch(() => []);
  return String(stores.find(store => (store.tabIds || []).includes(tabId))?.id || "");
}

async function closeLearningSurface(providerId) {
  const mutation = await mutateState(state => {
    const provider = PROVIDER_BY_ID.get(providerId);
    if (!provider) return null;
    const config = state.providers[providerId] || emptyProviderSettings(provider);
    const tabId = Number(config.managedTabId || 0);
    const windowId = Number(config.managedWindowId || 0);
    config.captureMode = "background-request";
    config.backgroundStatus = "active";
    config.backgroundVerifiedAt = Date.now();
    config.backgroundLastSuccessAt = Date.now();
    config.backgroundFailureCount = 0;
    config.managedTabId = 0;
    config.managedWindowId = 0;
    config.lastCaptureError = "";
    config.status = "connected";
    config.loginStatus = "observed";
    state.providers[providerId] = config;
    const anotherLearningTab = PROVIDERS.some(item => (
      item.id !== providerId
      && Number(state.providers[item.id]?.managedWindowId || 0) === windowId
    ));
    if (!anotherLearningTab && Number(state.managedBrowser.windowId || 0) === windowId) {
      state.managedBrowser.windowId = 0;
    }
    activity(state, "success", `${provider.name} sekmesiz arka plan bağlantısına geçti; geçici giriş sekmesi kapatıldı.`, provider.id);
    return { tabId };
  });
  const tabId = Number(mutation.result?.tabId || 0);
  if (tabId && browser.tabs?.remove) await browser.tabs.remove(tabId).catch(() => {});
  return publicState(mutation.state);
}

function byNoGameTokenFromCookie(rawValue) {
  const payloads = [];
  let current = String(rawValue || "").trim();
  for (let attempt = 0; current && attempt < 3; attempt += 1) {
    if (!payloads.includes(current)) payloads.push(current);
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  for (const payload of payloads) {
    const bearer = payload.match(/(?:^|\s)Bearer\s+([^\s"']{20,4096})/i)?.[1] || "";
    if (bearer) return bearer;
    if (/^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/.test(payload)) return payload;
    try {
      const parsed = JSON.parse(payload);
      const queue = [parsed];
      const visited = new Set();
      while (queue.length && visited.size < 80) {
        const value = queue.shift();
        if (!value || typeof value !== "object" || visited.has(value)) continue;
        visited.add(value);
        for (const [key, item] of Object.entries(value)) {
          if (/^(?:token|accessToken|access_token|idToken|id_token)$/i.test(key)
            && typeof item === "string"
            && item.length >= 20
            && item.length <= 4096
            && !/\s/.test(item)) {
            return item;
          }
          if (item && typeof item === "object") queue.push(item);
        }
      }
    } catch {}
  }
  return "";
}

async function syncByNoGameCookieSession(force = false) {
  if (!browser.cookies?.getAll) return { detected: false, changed: false };
  const now = Date.now();
  if (!force && now - lastCookieSessionSyncAt < COOKIE_SESSION_SYNC_INTERVAL_MS) {
    return { detected: false, changed: false, skipped: true };
  }
  lastCookieSessionSyncAt = now;
  const snapshot = await readState();
  const byNoGameConfig = snapshot.providers.bynogame || emptyProviderSettings(PROVIDER_BY_ID.get("bynogame"));
  const managedTabId = Number(byNoGameConfig.managedTabId || 0);
  const storeId = managedTabId ? await managedCookieStoreId(managedTabId) : "";
  const cookieQuery = { domain: "bynogame.com" };
  if (storeId) cookieQuery.storeId = storeId;
  const cookies = await browser.cookies.getAll(cookieQuery).catch(() => []);
  const ordered = [...cookies].sort((left, right) => {
    const score = name => (/^auth$/i.test(name) ? 3 : /auth|access.?token|login/i.test(name) ? 2 : /token/i.test(name) ? 1 : 0);
    return score(right.name) - score(left.name);
  });
  const hasAuthCookie = ordered.some(cookie => (
    /auth|access.?token|login|token/i.test(String(cookie?.name || ""))
    && String(cookie?.value || "").length > 0
  ));
  let token = "";
  for (const cookie of ordered) {
    if (!/auth|access.?token|login|token/i.test(String(cookie?.name || ""))) continue;
    token = byNoGameTokenFromCookie(cookie?.value);
    if (token) break;
  }
  if (!token && !hasAuthCookie) {
    const logoutMutation = await mutateState(state => {
      const provider = PROVIDER_BY_ID.get("bynogame");
      const config = state.providers.bynogame || emptyProviderSettings(provider);
      if (!config.cookieSessionObserved) return false;
      config.cookieSessionObserved = false;
      config.sessionToken = "";
      config.sessionTokenCapturedAt = 0;
      config.loginStatus = "required";
      config.status = "setup";
      config.networkFeedUrl = "";
      config.lastNetworkAt = 0;
      config.monitoringStartedAt = 0;
      config.lastError = "";
      state.providers.bynogame = config;
      activity(state, "info", "ByNoGame oturumunun kapandığı algılandı; giriş düğmesi yeniden etkinleştirildi.", "bynogame");
      return true;
    });
    return { detected: false, changed: false, loggedOut: logoutMutation.result === true };
  }
  const mutation = await mutateState(state => {
    const provider = PROVIDER_BY_ID.get("bynogame");
    const config = state.providers.bynogame || emptyProviderSettings(provider);
    const hadSession = Boolean(config.sessionToken);
    const wasObserved = config.loginStatus === "observed";
    if (config.loginStatus === "logout-pending") {
      config.cookieSessionObserved = true;
      state.providers.bynogame = config;
      return { changed: false, logoutPending: true };
    }
    const hadDirectSession = hadSession || Number(config.sessionTokenCapturedAt || 0) > 0;
    const changed = Boolean(token) && config.sessionToken !== token;
    if (token) config.sessionToken = token;
    config.loginStatus = "observed";
    config.cookieSessionObserved = true;
    config.status = token ? "connected" : (config.status === "setup" ? "ready" : config.status);
    config.lastError = "";
    config.lastPageAt = now;
    // The public donate landing page contains example donor cards. The
    // authenticated ByNoGame stream endpoint is the only authoritative source.
    config.detectedUrl = BYNOGAME_EVENTS_ENDPOINT;
    config.historyUrl = BYNOGAME_EVENTS_ENDPOINT;
    config.autoConfiguredAt = now;
    if (!Number(config.monitoringStartedAt || 0)) config.monitoringStartedAt = now;
    if (changed) {
      config.sessionTokenCapturedAt = now;
      if (!hadDirectSession) config.baselineComplete = false;
    }
    state.providers.bynogame = config;
    if (!hadSession && token) {
      activity(state, "success", "ByNoGame oturumu tarayıcıda doğrulandı; oturum bilgisi yalnız bu Firefox profilinde tutuluyor.", "bynogame");
    } else if (!hadSession && hasAuthCookie && !wasObserved) {
      activity(state, "success", "ByNoGame oturumu tarayıcıda algılandı; donate veri akışı doğrulanmayı bekliyor.", "bynogame");
    }
    return { changed };
  });
  if (mutation.result.changed) scanProvider("bynogame").catch(() => {});
  return { detected: true, changed: mutation.result.changed };
}

function providerLogoutLaunchUrl(provider) {
  const url = new URL(provider.logoutUrl || provider.homeUrl);
  url.searchParams.set("ps_open_logout", "1");
  return url.toString();
}

async function disconnectAccount() {
  const state = await readState();
  const expectedToken = state.connection.deviceToken;
  if (state.connection.paired && state.connection.deviceToken) {
    const response = await fetch(DEVICE_DISCONNECT_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${state.connection.deviceToken}`,
        "content-type": "application/json",
        "x-play-streamers-bridge": APP_VERSION
      },
      body: "{}"
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok && ![401, 404, 410].includes(response.status)) {
      throw new Error(result.error || "Site bağlantısı kesilemedi. Bağlantını kontrol edip tekrar dene.");
    }
  }
  return clearDisconnectedState(expectedToken, "Hesap eşleştirmesi eklenti ve Play Streamers sitesinde birlikte kaldırıldı.");
}

async function ensureOffscreenDocument() {
  // Firefox sürümünde ayrıştırıcı ve görünmeyen OBS iframe'leri kalıcı arka
  // plan sayfasının DOM'unda çalışır; ayrıca bir offscreen belge oluşturulmaz.
  if (typeof globalThis.__PLAY_CONNECT_OFFSCREEN__?.dispatch !== "function") {
    throw new Error("Firefox arka plan ayrıştırıcısı başlatılamadı.");
  }
}

function alertSources(state) {
  const serverProviders = serverConnectedProviderIds(state);
  return PROVIDERS
    .filter(supportsAlertLink)
    .map(provider => ({ provider, config: state.providers?.[provider.id] }))
    .filter(({ provider, config }) => config?.enabled
      && !serverProviders.has(provider.id)
      && alertLinkInfo(provider, config.alertUrl))
    .map(({ provider, config }) => ({ providerId: provider.id, url: config.alertUrl }));
}

async function syncAlertSources(stateInput = null) {
  const state = stateInput || await readState();
  const sources = alertSources(state);
  await ensureOffscreenDocument();
  const payload = {
    target: "offscreen",
    type: "SYNC_ALERT_SOURCES",
    sources
  };
  const directDispatch = globalThis.__PLAY_CONNECT_OFFSCREEN__?.dispatch;
  if (typeof directDispatch === "function") return Promise.resolve(directDispatch(payload));
  return browser.runtime.sendMessage(payload);
}

function isSafeAlertDataUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    return ["https:", "wss:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function alertProviderForSender(state, rawSenderUrl, requestedProviderId = "") {
  const senderComparable = comparableAlertUrl(rawSenderUrl);
  if (!senderComparable) return null;
  const requested = requestedProviderId ? PROVIDER_BY_ID.get(requestedProviderId) : null;
  if (supportsAlertLink(requested)) {
    const config = state.providers?.[requested.id];
    if (config?.enabled && config?.alertUrl && isProviderAlertUrlAllowed(requested, rawSenderUrl)) {
      try {
        const configuredHost = new URL(config.alertUrl).hostname.toLowerCase();
        const senderHost = new URL(senderComparable).hostname.toLowerCase();
        if (configuredHost === senderHost || comparableAlertUrl(config.alertUrl) === senderComparable) return requested;
      } catch {}
    }
  }
  const exact = PROVIDERS.filter(provider => {
    const config = state.providers?.[provider.id];
    return supportsAlertLink(provider)
      && config?.enabled
      && config?.alertUrl
      && comparableAlertUrl(config.alertUrl) === senderComparable;
  });
  if (exact.length === 1) return exact[0];
  const senderHost = (() => {
    try { return new URL(senderComparable).hostname.toLowerCase(); } catch { return ""; }
  })();
  const sameHost = PROVIDERS.filter(provider => {
    const config = state.providers?.[provider.id];
    if (!supportsAlertLink(provider) || !config?.enabled || !config?.alertUrl) return false;
    try { return new URL(config.alertUrl).hostname.toLowerCase() === senderHost; } catch { return false; }
  });
  return sameHost.length === 1 ? sameHost[0] : null;
}

async function testAlertProvider(providerId) {
  const provider = PROVIDER_BY_ID.get(providerId);
  if (!supportsAlertLink(provider)) throw new Error("OBS bağlantısı bu platform için kullanılamıyor.");
  let state = await readState();
  if (serverConnectedProviderIds(state).has(providerId)) {
    return { ok: true, serverConnection: true, alertFrame: "standby" };
  }
  const config = state.providers[providerId];
  if (!config?.enabled) throw new Error("Önce arka planda etkin tut seçeneğini aç.");
  if (!alertLinkInfo(provider, config.alertUrl)) throw new Error("Önce geçerli OBS / Alert Box bağlantısını kaydet.");
  await syncAlertSources(state);
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 200));
    state = await readState();
    if (state.providers[providerId]?.alertFrameStatus === "active") break;
  }
  const latest = state.providers[providerId] || {};
  if (latest.alertFrameStatus === "error") {
    throw new Error(latest.lastCaptureError || "OBS bağlantısı arka planda yüklenemedi.");
  }
  return {
    ok: true,
    accepted: 0,
    candidateCount: 0,
    duplicateCount: Number(latest.lastDuplicateCount || 0),
    invalidCount: Number(latest.lastInvalidCount || 0),
    alertFrame: latest.alertFrameStatus || "loading",
    renderer: latest.alertRenderer || provider.name
  };
}

async function parseHtml(providerId, html, pageUrl, selectors) {
  await ensureOffscreenDocument();
  const payload = {
    target: "offscreen",
    type: "PARSE_DONATE_HTML",
    providerId,
    html,
    pageUrl,
    selectors
  };
  const directDispatch = globalThis.__PLAY_CONNECT_OFFSCREEN__?.dispatch;
  if (typeof directDispatch === "function") return Promise.resolve(directDispatch(payload));
  return browser.runtime.sendMessage(payload);
}

async function fetchSessionCandidates(provider, config) {
  const sourceUrl = String(config.historyUrl || config.detectedUrl || "").trim();
  if (!sourceUrl || !isProviderUrlAllowed(provider, sourceUrl)) {
    throw new Error("Önce “Platforma giriş yap” düğmesini kullan ve giriş tamamlandıktan sonra bağlantıyı doğrula.");
  }
  const response = await fetch(sourceUrl, {
    credentials: "include",
    cache: "no-store",
    redirect: "follow",
    headers: {
      accept: "text/html,application/json;q=0.9,*/*;q=0.7"
    }
  });
  if (!response.ok) {
    throw new Error(`Platform ${response.status} yanıtı verdi. Firefox oturumunu kontrol et.`);
  }
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return extractJsonCandidates(await response.json());
  }
  const html = await response.text();
  const parsed = await parseHtml(provider.id, html, response.url || sourceUrl, config.selectors);
  if (!parsed?.ok) throw new Error(parsed?.error || "Donate geçmişi sayfası okunamadı.");
  if (parsed.loginRequired) {
    throw new Error("Platform oturumu bulunamadı. Platforma Firefox üzerinden bir kez giriş yap.");
  }
  return parsed.candidates || [];
}

function safeNetworkFeedUrl(provider, rawUrl, method = "GET") {
  if (String(method || "GET").toUpperCase() !== "GET") return "";
  try {
    const url = new URL(String(rawUrl || ""));
    if (url.protocol !== "https:" || !isTrustedProviderMonitorUrl(provider, url.href)) return "";
    for (const key of url.searchParams.keys()) {
      if (/token|auth|secret|signature|session|password|api.?key/i.test(key)) return "";
    }
    url.hash = "";
    return url.href.slice(0, 1800);
  } catch {
    return "";
  }
}

function bearerTokenFromRequestHeaders(headers) {
  const authorization = (Array.isArray(headers) ? headers : [])
    .find(header => String(header?.name || "").toLowerCase() === "authorization")?.value || "";
  const match = String(authorization).trim().match(/^Bearer\s+([^\s]{20,4096})$/i);
  return match?.[1] || "";
}

function providerRequestPatterns() {
  return [...new Set(PROVIDERS.flatMap(provider => provider.domains.flatMap(domain => [
    `https://${domain}/*`,
    `https://*.${domain}/*`
  ])))];
}

function rememberPageBearer(details) {
  if (!Number.isInteger(details?.tabId) || details.tabId < 0) return;
  const provider = providerForUrl(details.url || "");
  if (!provider || provider.integration !== "session") return;
  const token = bearerTokenFromRequestHeaders(details.requestHeaders);
  if (!token) return;
  mutateState(state => {
    const config = state.providers[provider.id] || emptyProviderSettings(provider);
    if (config.captureMode !== "login-learning" || Number(config.managedTabId || 0) !== details.tabId) return;
    config.sessionToken = token;
    config.sessionTokenCapturedAt = Date.now();
    config.backgroundStatus = "learning";
    config.lastCaptureError = "";
    state.providers[provider.id] = config;
  }).catch(() => {});
}

async function fetchNetworkFeedCandidates(provider, config) {
  const endpoint = safeNetworkFeedUrl(provider, config.networkFeedUrl, "GET");
  if (!endpoint) return [];
  const headers = { accept: "application/json" };
  const sessionToken = String(config.sessionToken || "").trim();
  if (sessionToken) headers.authorization = `Bearer ${sessionToken}`;
  const response = await fetch(endpoint, {
    credentials: "include",
    cache: "no-store",
    headers
  });
  if (!response.ok) {
    const error = new Error(`${provider.name} veri akışı ${response.status} yanıtı verdi.`);
    error.status = response.status;
    throw error;
  }
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("json")) {
    const error = new Error(`${provider.name} arka plan adresi JSON veri vermedi.`);
    error.status = response.status;
    throw error;
  }
  return extractJsonCandidates(await response.json());
}

async function fetchByNoGameCandidates(config) {
  const token = String(config.sessionToken || "").trim();
  const headers = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(BYNOGAME_EVENTS_ENDPOINT, {
    credentials: "include",
    cache: "no-store",
    headers
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || result.error || `ByNoGame donate akışı alınamadı (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  const rows = Array.isArray(result?.data?.data)
    ? result.data.data
    : (Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []));
  return rows
    .filter(item => !/cancel|refund|fail|declin|reject|void|expired/i.test(String(item?.status || "")))
    .map(item => ({
    eventId: String(item?.opId || item?.orderRowId || item?.paymentId || item?.orderId || item?.id || ""),
    name: String(item?.nickName || item?.nickname || item?.donorName || item?.username || "İsimsiz destekçi"),
    amount: item?.amount,
    currency: String(item?.currency || "TRY"),
    message: String(item?.message || ""),
    time: item?.createdAt || item?.date || "",
    rawText: JSON.stringify({
      opId: item?.opId || "",
      orderRowId: item?.orderRowId || "",
      nickName: item?.nickName || "",
      amount: item?.amount,
      message: item?.message || "",
      createdAt: item?.createdAt || item?.date || "",
      status: item?.status
    })
    }));
}

async function fetchStreamlabsCandidates(config) {
  if (!config.apiToken) {
    throw new Error("Streamlabs kişisel erişim anahtarını eklenti ayarlarına ekle.");
  }
  const response = await fetch("https://streamlabs.com/api/v2.0/donations?limit=100", {
    cache: "no-store",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.apiToken}`
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || result.error || "Streamlabs verileri alınamadı.");
  }
  return extractJsonCandidates(result);
}

async function fetchTipeeeStreamCandidates(config) {
  if (!config.apiToken) {
    throw new Error("TipeeeStream hesabındaki API anahtarını ekle.");
  }
  const endpoint = new URL("https://api.tipeeestream.com/v1.0/events.json");
  endpoint.searchParams.set("apiKey", config.apiToken);
  endpoint.searchParams.append("type[]", "donation");
  endpoint.searchParams.set("limit", "100");
  endpoint.searchParams.set("sort", "createdAt");
  endpoint.searchParams.set("order", "desc");
  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: { accept: "application/json" }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || String(result.message || "").toLowerCase() === "error") {
    throw new Error(result.message || "TipeeeStream verileri alınamadı.");
  }
  return (Array.isArray(result.events) ? result.events : [])
    .filter(item => String(item?.type || "").toLowerCase() === "donation")
    .map(item => {
      const parameters = item?.parameters || {};
      return {
        eventId: String(item?.id || item?.ref || ""),
        name: String(parameters.username || "İsimsiz destekçi"),
        amount: parameters.amount ?? item?.["parameters.amount"] ?? "",
        currency: String(parameters.currency || ""),
        message: String(parameters.message || parameters.formattedMessage || ""),
        time: item?.created_at || item?.inserted_at || "",
        rawText: JSON.stringify(item)
      };
    });
}

async function fetchDonationAlertsCandidates(config) {
  if (!config.apiToken) {
    throw new Error("DonationAlerts resmî erişim anahtarını ekle.");
  }
  const response = await fetch("https://www.donationalerts.com/api/v1/alerts/donations", {
    cache: "no-store",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.apiToken}`
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || result.error || "DonationAlerts verileri alınamadı.");
  }
  return (Array.isArray(result.data) ? result.data : []).map(item => ({
    eventId: String(item?.id || ""),
    name: String(item?.username || "İsimsiz destekçi"),
    amount: item?.amount,
    currency: String(item?.currency || ""),
    message: String(item?.message || ""),
    time: item?.created_at || "",
    rawText: JSON.stringify(item)
  }));
}

function streamElementsCandidate(message) {
  const data = message?.data || {};
  const donation = data.donation || {};
  if (String(data.approved || "").toLowerCase() === "rejected") return null;
  return {
    eventId: String(data._id || data.transactionId || message.id || ""),
    name: String(donation.user?.username || donation.user?.name || "İsimsiz destekçi"),
    amount: donation.amount,
    currency: String(donation.currency || ""),
    message: String(donation.message || ""),
    time: data.createdAt || message.ts || "",
    rawText: JSON.stringify(data)
  };
}

function closeStreamElementsSocket() {
  clearTimeout(streamElementsReconnectTimer);
  streamElementsReconnectTimer = 0;
  streamElementsReconnectAttempts = 0;
  const socket = streamElementsSocket;
  streamElementsSocket = null;
  streamElementsConnectPromise = null;
  if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "configuration changed");
}

function scheduleStreamElementsReconnect() {
  clearTimeout(streamElementsReconnectTimer);
  const delay = Math.min(60_000, 1000 * (2 ** streamElementsReconnectAttempts));
  streamElementsReconnectAttempts += 1;
  streamElementsReconnectTimer = setTimeout(async () => {
    const state = await readState();
    const config = state.providers.streamelements;
    if (!config?.enabled || !config.apiToken || !config.channelId || config.alertUrl || serverConnectedProviderIds(state).has("streamelements")) return;
    connectStreamElements(config).catch(() => {});
  }, delay);
}

async function connectStreamElements(config) {
  if (!config.apiToken || !config.channelId) {
    throw new Error("StreamElements JWT anahtarını ve kanal kimliğini ekle.");
  }
  if (streamElementsSocket?.readyState === WebSocket.OPEN && streamElementsSocket.playStreamersReady) {
    return { connected: true };
  }
  if (streamElementsConnectPromise) return streamElementsConnectPromise;
  streamElementsConnectPromise = new Promise((resolve, reject) => {
    let settled = false;
    const nonce = crypto.randomUUID();
    const socket = new WebSocket("wss://astro.streamelements.com/");
    streamElementsSocket = socket;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("StreamElements bağlantısı zaman aşımına uğradı."));
      }
      socket.close();
    }, 12_000);

    const complete = (error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve({ connected: true });
    };

    socket.addEventListener("message", event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === "welcome") {
        socket.send(JSON.stringify({
          type: "subscribe",
          nonce,
          data: {
            topic: "channel.tips",
            room: config.channelId,
            token: config.apiToken,
            token_type: "jwt"
          }
        }));
        return;
      }
      if (message.type === "response" && message.nonce === nonce) {
        if (message.error) {
          complete(new Error(message.data?.message || `StreamElements bağlantısı reddedildi: ${message.error}`));
        } else {
          socket.playStreamersReady = true;
          streamElementsReconnectAttempts = 0;
          complete();
        }
        return;
      }
      if (message.type === "message" && message.topic === "channel.tips") {
        const candidate = streamElementsCandidate(message);
        if (candidate) {
          const provider = PROVIDER_BY_ID.get("streamelements");
          acceptCandidates(provider, [candidate], "StreamElements canlı", { live: true }).catch(() => {});
        }
        return;
      }
      if (message.type === "reconnect") {
        socket.close(1012, "server reconnect");
      }
    });
    socket.addEventListener("error", () => {
      complete(new Error("StreamElements WebSocket bağlantısı kurulamadı."));
    });
    socket.addEventListener("close", () => {
      clearTimeout(timeout);
      if (streamElementsSocket === socket) streamElementsSocket = null;
      streamElementsConnectPromise = null;
      if (!settled) complete(new Error("StreamElements bağlantısı kapandı."));
      scheduleStreamElementsReconnect();
    });
  });
  return streamElementsConnectPromise;
}

async function fetchStreamElementsCandidates(config) {
  await connectStreamElements(config);
  return [];
}

function pallyCandidate(message) {
  if (String(message?.type || "") !== "campaigntip.notify") return null;
  const tip = message?.payload?.campaignTip || {};
  return {
    eventId: String(tip.id || ""),
    name: String(tip.displayName || "İsimsiz destekçi"),
    amountMinor: Number(tip.grossAmountInCents || tip.netAmountInCents || 0),
    currency: String(tip.currency || "USD"),
    message: String(tip.message || ""),
    time: tip.createdAt || "",
    rawText: JSON.stringify(message)
  };
}

function closePallySocket() {
  clearTimeout(pallyReconnectTimer);
  pallyReconnectTimer = 0;
  pallyReconnectAttempts = 0;
  const socket = pallySocket;
  pallySocket = null;
  pallyConnectPromise = null;
  if (socket?.playConnectHeartbeat) clearInterval(socket.playConnectHeartbeat);
  if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "configuration changed");
}

function schedulePallyReconnect() {
  clearTimeout(pallyReconnectTimer);
  const delay = Math.min(60_000, 1000 * (2 ** pallyReconnectAttempts));
  pallyReconnectAttempts += 1;
  pallyReconnectTimer = setTimeout(async () => {
    const state = await readState();
    const config = state.providers.pally;
    if (!config?.enabled || !config.apiToken || config.alertUrl || serverConnectedProviderIds(state).has("pally")) return;
    connectPally(config).catch(() => {});
  }, delay);
}

async function connectPally(config) {
  if (!config.apiToken) throw new Error("Pally.gg hesabındaki API anahtarını ekle.");
  if (pallySocket?.readyState === WebSocket.OPEN) return { connected: true };
  if (pallyConnectPromise) return pallyConnectPromise;
  pallyConnectPromise = new Promise((resolve, reject) => {
    let settled = false;
    const endpoint = new URL("wss://events.pally.gg/");
    endpoint.searchParams.set("auth", config.apiToken);
    endpoint.searchParams.set("channel", "firehose");
    const socket = new WebSocket(endpoint.toString());
    pallySocket = socket;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Pally.gg canlı bağlantısı zaman aşımına uğradı."));
      }
      socket.close();
    }, 12_000);
    const complete = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve({ connected: true });
    };
    socket.addEventListener("open", () => {
      pallyReconnectAttempts = 0;
      socket.playConnectHeartbeat = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
      }, 55_000);
      complete();
    });
    socket.addEventListener("message", event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (String(message?.type || "") === "ping") {
        socket.send(JSON.stringify({ type: "pong" }));
        return;
      }
      const candidate = pallyCandidate(message);
      if (candidate) acceptCandidates(PROVIDER_BY_ID.get("pally"), [candidate], "Pally.gg canlı", { live: true }).catch(() => {});
    });
    socket.addEventListener("error", () => complete(new Error("Pally.gg canlı bağlantısı kurulamadı.")));
    socket.addEventListener("close", () => {
      clearTimeout(timeout);
      if (socket.playConnectHeartbeat) clearInterval(socket.playConnectHeartbeat);
      if (pallySocket === socket) pallySocket = null;
      pallyConnectPromise = null;
      if (!settled) complete(new Error("Pally.gg canlı bağlantısı kapandı."));
      schedulePallyReconnect();
    });
  });
  return pallyConnectPromise;
}

async function fetchPallyCandidates(config) {
  await connectPally(config);
  return [];
}

async function providerCandidates(provider, config) {
  if (provider.id === "bynogame") return fetchByNoGameCandidates(config);
  if (provider.integration === "streamlabs-api") return fetchStreamlabsCandidates(config);
  if (provider.integration === "streamelements-api") return fetchStreamElementsCandidates(config);
  if (provider.integration === "tipeeestream-api") return fetchTipeeeStreamCandidates(config);
  if (provider.integration === "donationalerts-api") return fetchDonationAlertsCandidates(config);
  if (provider.integration === "pally-api") return fetchPallyCandidates(config);
  if (config.networkFeedUrl) {
    return fetchNetworkFeedCandidates(provider, config);
  }
  return fetchSessionCandidates(provider, config);
}

function pruneSeen(seen) {
  const entries = Object.entries(seen).sort((a, b) => Number(b[1]) - Number(a[1]));
  return Object.fromEntries(entries.slice(0, MAX_SEEN));
}

function hasAbsoluteCandidateTime(candidate) {
  const value = candidate?.time;
  if (typeof value === "number") return Number.isFinite(value);
  const text = String(value || "").trim();
  return Boolean(text) && Number.isFinite(Date.parse(text));
}

async function acceptCandidates(provider, candidates, sourceLabel = "background", options = {}) {
  const sorted = Array.isArray(candidates) ? candidates.slice(-150) : [];
  const mutation = await mutateState(async state => {
    const config = state.providers[provider.id] || emptyProviderSettings(provider);
    const firstIdentityPass = !config.baselineComplete;
    const pendingKeys = new Set(state.queue.map(item => `${item.event?.providerId || ""}:${item.event?.eventId || ""}`));
    const baselineIds = new Set(Array.isArray(config.baselineEventIds) ? config.baselineEventIds : []);
    const monitoringStartedAt = Number(config.monitoringStartedAt || 0);
    let accepted = 0;
    let duplicates = 0;
    let invalid = 0;
    let overflow = 0;
    let baselined = 0;
    for (const candidate of sorted) {
      const event = await normalizeCandidate({ ...provider, defaultCurrency: config.defaultCurrency || provider.defaultCurrency }, candidate);
      if (!event) {
        invalid += 1;
        continue;
      }
      const key = `${provider.id}:${event.eventId}`;
      if (state.seen[key] || pendingKeys.has(key) || baselineIds.has(event.eventId)) {
        duplicates += 1;
        continue;
      }
      const predatesConnection = supportsAlertLink(provider)
        && Boolean(config.alertUrl)
        && monitoringStartedAt > 0
        && hasAbsoluteCandidateTime(candidate)
        && Number(event.eventAt || 0) < monitoringStartedAt - ALERT_EVENT_TIME_TOLERANCE_MS;
      const initialSnapshot = options.baselineOnly === true
        || (firstIdentityPass && options.live !== true);
      if (predatesConnection || initialSnapshot) {
        baselineIds.add(event.eventId);
        baselined += 1;
        continue;
      }
      if (state.queue.length >= MAX_QUEUE) {
        overflow += 1;
        continue;
      }
      state.queue.push({
        queueId: crypto.randomUUID(),
        eventKey: key,
        event,
        attempts: 0,
        nextAttemptAt: 0,
        queuedAt: Date.now()
      });
      pendingKeys.add(key);
      accepted += 1;
    }
    config.lastCandidateCount = sorted.length;
    config.lastAcceptedCount = accepted;
    config.lastDuplicateCount = duplicates;
    config.lastInvalidCount = invalid;
    config.lastOverflowCount = overflow;
    config.lastBaselineCount = baselined;
    config.baselineEventIds = [...baselineIds].slice(-MAX_BASELINE_EVENT_IDS);
    if (firstIdentityPass) {
      config.baselineComplete = true;
      config.lastScanAt = Date.now();
      state.providers[provider.id] = config;
      activity(state, "info", baselined
        ? `${provider.name}: ${baselined} eski donate başlangıç kaydı olarak işaretlendi; bundan sonra yalnız yeni olaylar gönderilecek.`
        : `${provider.name}: canlı donate takibi boş bir başlangıçla hazırlandı; ilk yeni olay doğrudan gönderilecek.`, provider.id);
    }
    if (accepted) {
      config.lastEventAt = Date.now();
      config.lastEventName = `${accepted} yeni donate`;
      config.lastCaptureAt = Date.now();
      config.lastCaptureSource = sourceLabel;
      config.lastCaptureError = "";
      config.capturedEventCount = Number(config.capturedEventCount || 0) + accepted;
      state.connection.capturedEventCount = Number(state.connection.capturedEventCount || 0) + accepted;
      if (options.networkAlert === true) config.lastNetworkCandidateAt = Date.now();
      activity(state, "success", `${provider.name}: ${accepted} yeni donate bulundu (${sourceLabel}).`, provider.id);
    }
    if (overflow) {
      config.lastCaptureError = `${overflow} olay, teslimat kuyruğu dolu olduğu için beklemeye alınamadı.`;
      activity(state, "error", `${provider.name}: teslimat kuyruğu dolu; önce bekleyen olaylar gönderilecek.`, provider.id);
    }
    return accepted;
  });
  const accepted = mutation.result;
  if (accepted) {
    const delivery = await flushQueue();
    const deliveryText = Number(delivery?.inserted || 0) > 0
      ? `${accepted} yeni hareket Play Streamers hesabına gönderildi.`
      : `${accepted} yeni hareket güvenli teslimat kuyruğuna alındı.`;
    if (Number(delivery?.inserted || 0) > 0 || Number(delivery?.remaining || 0) > 0) {
      await notify("Yeni donate bulundu", `${provider.name}: ${deliveryText}`);
    }
  }
  return accepted;
}

async function scanProvider(providerId, manual = false) {
  const provider = PROVIDER_BY_ID.get(providerId);
  if (!provider) throw new Error("Platform bulunamadı.");
  const state = await readState();
  const config = state.providers[providerId];
  if (!config?.enabled && !manual) return { skipped: true };
  if (serverConnectedProviderIds(state).has(providerId)) {
    return { skipped: true, serverConnection: true, reason: "server-connection-active" };
  }
  if (supportsAlertLink(provider) && config?.alertUrl) {
    if (!manual) return { skipped: true, reason: "live-alert-frame" };
    return testAlertProvider(providerId);
  }
  const hasDirectSessionFeed = provider.id === "bynogame" && Boolean(config.sessionToken);
  if (provider.integration === "session" && !hasDirectSessionFeed) {
    const hasBackgroundSource = Boolean(config.networkFeedUrl || config.historyUrl || config.detectedUrl);
    if (hasBackgroundSource) {
      try {
        const candidates = await providerCandidates(provider, config);
        const accepted = await acceptCandidates(provider, candidates, manual ? "sekmesiz test" : "sekmesiz arka plan");
        await mutateState(latest => {
          const current = latest.providers[providerId];
          current.captureMode = "background-request";
          current.backgroundStatus = "active";
          current.backgroundVerifiedAt = Number(current.backgroundVerifiedAt || 0) || Date.now();
          current.backgroundLastSuccessAt = Date.now();
          current.backgroundFailureCount = 0;
          current.status = "connected";
          current.loginStatus = "observed";
          current.lastError = "";
          current.lastCaptureError = "";
          current.lastScanAt = Date.now();
          current.lastCaptureSource = "sekmesiz arka plan";
          if (!accepted && manual) {
            activity(latest, "info", `${provider.name}: sekmesiz bağlantı çalışıyor, yeni donate bulunamadı.`, provider.id);
          }
        });
        const latest = (await readState()).providers[providerId] || {};
        if (Number(latest.managedTabId || 0)) await closeLearningSurface(providerId);
        return {
          ok: true,
          accepted,
          candidateCount: candidates.length,
          duplicateCount: Number(latest.lastDuplicateCount || 0),
          invalidCount: Number(latest.lastInvalidCount || 0),
          background: true
        };
      } catch (backgroundError) {
        await mutateState(latest => {
          const current = latest.providers[providerId];
          const failureCount = Number(current.backgroundFailureCount || 0) + 1;
          current.backgroundFailureCount = failureCount;
          current.backgroundStatus = [401, 403].includes(Number(backgroundError?.status || 0))
            ? "login-required"
            : (failureCount >= 3 ? "unsupported" : "blocked");
          current.status = failureCount >= 3 ? "error" : "setup";
          if ([401, 403].includes(Number(backgroundError?.status || 0))) current.loginStatus = "required";
          current.lastCaptureError = String(backgroundError?.message || "Sekmesiz bağlantı kurulamadı.").slice(0, 240);
        });
        if (!config.managedTabId) {
          if (!manual) return { skipped: true, reason: "background-login-required" };
          throw new Error(`${provider.name} sekmesiz bağlantısı yeniden giriş istiyor. “Platforma giriş yap” ile bir kez giriş yap.`);
        }
      }
    }
    if (!config.managedTabId) {
      if (!manual) return { skipped: true, reason: "background-learning-required" };
      throw new Error("Önce platform hesabına bir kez giriş yap; Play Connect veri adresini öğrendiğinde giriş sekmesini otomatik kapatır.");
    }
    const beforeCaptured = Number(config.capturedEventCount || 0);
    try {
      const pageResult = await browser.tabs.sendMessage(config.managedTabId, { type: "PLAY_CONNECT_SCAN_NOW" });
      if (pageResult?.ok === false) throw new Error(pageResult.error || "Platform sayfası taranamadı.");
      await flushQueue();
      const latest = (await readState()).providers[providerId] || {};
      const accepted = Math.max(0, Number(latest.capturedEventCount || 0) - beforeCaptured);
      const shouldRefreshManagedPage = latest.loginStatus === "observed"
        && Boolean(latest.managedTabId)
        && Date.now() - Number(latest.lastNetworkAt || 0) >= MANAGED_FALLBACK_REFRESH_MS
        && Date.now() - Number(latest.lastManagedRefreshAt || 0) >= MANAGED_FALLBACK_REFRESH_MS;
      if (shouldRefreshManagedPage && browser.tabs?.reload) {
        await mutateState(currentState => {
          currentState.providers[providerId].lastManagedRefreshAt = Date.now();
        });
        await browser.tabs.reload(latest.managedTabId).catch(() => {});
      }
      return {
        ok: true,
        accepted,
        candidateCount: Number(latest.lastCandidateCount || 0),
        duplicateCount: Number(latest.lastDuplicateCount || 0),
        invalidCount: Number(latest.lastInvalidCount || 0),
        learning: true
      };
    } catch (error) {
      await mutateState(latest => {
        const current = latest.providers[providerId];
        current.status = "error";
        current.lastCaptureError = String(error?.message || "Geçici giriş sayfası taranamadı.").slice(0, 240);
        current.lastError = current.lastCaptureError;
        activity(latest, "error", `${provider.name}: ${current.lastCaptureError}`, provider.id);
      });
      throw error;
    }
  }
  try {
    const candidates = await providerCandidates(provider, config);
    const accepted = await acceptCandidates(provider, candidates, manual ? "test" : "arka plan");
    await mutateState(latest => {
      latest.providers[providerId].status = "connected";
      latest.providers[providerId].lastError = "";
      latest.providers[providerId].lastScanAt = Date.now();
      if (provider.integration === "session") {
        latest.providers[providerId].captureMode = "background-request";
        latest.providers[providerId].backgroundStatus = "active";
        latest.providers[providerId].backgroundVerifiedAt = Number(latest.providers[providerId].backgroundVerifiedAt || 0) || Date.now();
        latest.providers[providerId].backgroundLastSuccessAt = Date.now();
        latest.providers[providerId].backgroundFailureCount = 0;
        latest.providers[providerId].lastCaptureSource = "sekmesiz arka plan";
      }
      if (!accepted && manual) {
        activity(latest, "info", `${provider.name}: bağlantı başarılı, yeni donate bulunamadı.`, provider.id);
      }
    });
    const refreshed = (await readState()).providers[providerId] || {};
    if (provider.integration === "session" && Number(refreshed.managedTabId || 0)) {
      await closeLearningSurface(providerId);
    }
    const diagnostics = (await readState()).providers[providerId] || {};
    return {
      ok: true,
      accepted,
      candidateCount: candidates.length,
      duplicateCount: Number(diagnostics.lastDuplicateCount || 0),
      invalidCount: Number(diagnostics.lastInvalidCount || 0),
      baselineCount: Number(diagnostics.lastBaselineCount || 0)
    };
  } catch (error) {
    await mutateState(latest => {
      const config = latest.providers[providerId];
      const confirmedSessionFailure = provider.id === "bynogame" && [401, 403].includes(Number(error?.status || 0));
      config.status = confirmedSessionFailure ? "setup" : "error";
      config.loginStatus = confirmedSessionFailure ? "required" : config.loginStatus;
      config.lastError = String(error?.message || "Bağlantı hatası").slice(0, 240);
      config.lastScanAt = Date.now();
      if (confirmedSessionFailure) {
        config.sessionToken = "";
        config.sessionTokenCapturedAt = 0;
        config.monitoringStartedAt = 0;
        config.baselineComplete = false;
      }
      activity(latest, "error", `${provider.name}: ${config.lastError}`, provider.id);
    });
    throw error;
  }
}

async function scanAll() {
  await syncByNoGameCookieSession().catch(() => {});
  const state = await readState();
  const serverProviders = serverConnectedProviderIds(state);
  for (const provider of PROVIDERS) {
    const config = state.providers[provider.id];
    if (!config?.enabled) continue;
    if (serverProviders.has(provider.id)) continue;
    if (supportsAlertLink(provider) && config.alertUrl) continue;
    const ready = provider.integration === "session"
      ? config.loginStatus === "observed"
        && Boolean(provider.id === "bynogame"
          ? (config.sessionToken || config.networkFeedUrl || config.historyUrl || config.detectedUrl)
          : (config.networkFeedUrl || config.historyUrl || config.detectedUrl))
      : Boolean(config.apiToken) && (provider.id !== "streamelements" || Boolean(config.channelId));
    if (!ready) continue;
    await scanProvider(provider.id).catch(() => {});
  }
}

async function postQueuedItem(item, connection) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8 * 1000);
  try {
    const response = await fetch(connection.apiEndpoint || DEFAULT_EVENT_ENDPOINT, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${connection.deviceToken}`,
        "content-type": "application/json",
        "x-play-streamers-bridge": APP_VERSION
      },
      body: JSON.stringify({ event: item.event })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.ok !== true || result?.accepted !== true) {
      const error = new Error(result.error || `Play Streamers sunucusu teslimatı onaylamadı (${response.status}).`);
      error.status = response.status || 502;
      throw error;
    }
    return { ...result, httpStatus: response.status };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Play Streamers sunucusu 8 saniye içinde yanıt vermedi.");
      timeoutError.status = 0;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function flushQueueInternal() {
  const snapshot = await readState();
  if (!snapshot.connection.paired || !snapshot.connection.deviceToken || !snapshot.queue.length) {
    return { delivered: 0, remaining: snapshot.queue.length };
  }
  const now = Date.now();
  const deliveredIds = new Set();
  const deliveredKeys = new Map();
  const retryUpdates = new Map();
  let delivered = 0;
  let inserted = 0;
  let duplicates = 0;
  let discarded = 0;
  let disconnected = false;
  let lastError = "";
  let lastServerEventCount = null;
  let attempted = 0;
  let lastDeliveryHttpStatus = 0;
  for (const item of snapshot.queue) {
    if (item.nextAttemptAt && item.nextAttemptAt > now) {
      continue;
    }
    attempted += 1;
    try {
      const receipt = await postQueuedItem(item, snapshot.connection);
      lastDeliveryHttpStatus = Number(receipt.httpStatus || 200);
      deliveredIds.add(item.queueId);
      const duplicate = receipt.duplicate === true;
      deliveredKeys.set(item.queueId, {
        eventKey: item.eventKey || `${item.event.providerId}:${item.event.eventId}`,
        duplicate
      });
      delivered += 1;
      if (duplicate) duplicates += 1;
      else inserted += 1;
      if (Number.isFinite(Number(receipt.deviceEventCount))) {
        lastServerEventCount = Math.max(Number(lastServerEventCount || 0), Number(receipt.deviceEventCount));
      }
    } catch (error) {
      const attempts = Number(item.attempts || 0) + 1;
      const status = Number(error.status || 0);
      lastDeliveryHttpStatus = status;
      lastError = String(error?.message || "Teslimat hatası").slice(0, 240);
      if ([401, 404, 410].includes(status)) {
        disconnected = true;
        break;
      }
      const retryDelay = status === 429
        ? 5 * 1000
        : Math.min(60 * 1000, (2 ** Math.min(attempts - 1, 5)) * 2 * 1000);
      retryUpdates.set(item.queueId, {
        ...item,
        attempts,
        nextAttemptAt: Date.now() + retryDelay
      });
    }
  }
  const mutation = await mutateState(latest => {
    if (disconnected && latest.connection.deviceToken === snapshot.connection.deviceToken) {
      latest.connection = defaultState().connection;
      latest.queue = [];
      activity(latest, "info", "Site tarafında kaldırılan hesap eşleştirmesi eklentiden de kapatıldı.");
    } else {
      for (const [queueId, receipt] of deliveredKeys) {
        const eventKey = receipt.eventKey;
        latest.seen[eventKey] = Date.now();
        const deliveredItem = snapshot.queue.find(item => item.queueId === queueId);
        const providerId = deliveredItem?.event?.providerId;
        if (!receipt.duplicate && providerId && latest.providers[providerId]) {
          latest.providers[providerId].deliveredEventCount = Number(latest.providers[providerId].deliveredEventCount || 0) + 1;
        }
      }
      latest.seen = pruneSeen(latest.seen);
      latest.queue = latest.queue
        .filter(item => !deliveredIds.has(item.queueId))
        .map(item => retryUpdates.get(item.queueId) || item)
        .slice(-MAX_QUEUE);
      if (attempted) {
        latest.connection.lastDeliveryAttemptAt = Date.now();
        latest.connection.lastDeliveryHttpStatus = lastDeliveryHttpStatus;
      }
      if (delivered) {
        latest.connection.lastDeliveryAt = Date.now();
        latest.connection.deliveredEventCount = Number(latest.connection.deliveredEventCount || 0) + inserted;
        if (lastServerEventCount !== null) {
          latest.connection.lastServerEventCount = lastServerEventCount;
        }
        latest.connection.lastError = "";
        const duplicateText = duplicates ? ` ${duplicates} olay daha önce teslim edildiği için tekrar yazılmadı.` : "";
        activity(latest, "success", `${inserted} yeni donate olayı Play Streamers'a gönderildi.${duplicateText}`);
      } else if (lastError) {
        latest.connection.lastError = lastError;
        activity(latest, "error", `Donate teslimatı bekliyor: ${lastError}`);
      }
    }
  });
  return { delivered, inserted, duplicates, discarded, remaining: mutation.state.queue.length, disconnected };
}

async function flushQueue() {
  if (flushQueuePromise) return flushQueuePromise;
  flushQueuePromise = flushQueueInternal().finally(() => {
    flushQueuePromise = null;
  });
  return flushQueuePromise;
}

async function saveProvider(providerId, nextInput) {
  const provider = PROVIDER_BY_ID.get(providerId);
  if (!provider) throw new Error("Platform bulunamadı.");
  const historyUrl = provider.integration === "session"
    ? null
    : String(nextInput.historyUrl || "").trim();
  if (historyUrl && !isProviderUrlAllowed(provider, historyUrl)) {
    throw new Error(`${provider.name} için yalnızca kendi alan adındaki bir adres kullanılabilir.`);
  }
  const submittedAlertUrl = String(nextInput.alertUrl || "").trim();
  const clearAlertUrl = Boolean(nextInput.clearAlertUrl);
  const alertInfo = supportsAlertLink(provider) && submittedAlertUrl
    ? alertLinkInfo(provider, submittedAlertUrl)
    : null;
  if (submittedAlertUrl && !alertInfo) {
    throw new Error(`${provider.name} için kendi OBS bağlantısını, Streamlabs Alert Box bağlantısını veya StreamElements Overlay bağlantısını kullan.`);
  }
  const mutation = await mutateState(state => {
    const previous = state.providers[providerId] || emptyProviderSettings(provider);
    if (supportsAlertLink(provider)
      && previous.alertUrl
      && submittedAlertUrl
      && comparableAlertUrl(submittedAlertUrl) !== comparableAlertUrl(previous.alertUrl)
      && !clearAlertUrl) {
      throw new Error("OBS bağlantısı etkinken link değiştirilemez. Önce mevcut OBS bağlantısını kaldır.");
    }
    const nextAlertUrl = supportsAlertLink(provider)
      ? (clearAlertUrl ? "" : (previous.alertUrl || alertInfo?.url || ""))
      : "";
    const alertUrlChanged = comparableAlertUrl(nextAlertUrl) !== comparableAlertUrl(previous.alertUrl);
    state.providers[providerId] = {
      ...previous,
      enabled: true,
      historyUrl: historyUrl === null ? previous.historyUrl : historyUrl,
      apiToken: String(nextInput.apiToken || "").trim() || previous.apiToken || "",
      channelId: String(nextInput.channelId ?? previous.channelId ?? "").trim(),
      currencyMode: nextInput.currencyMode === "locale" ? "locale" : (nextInput.defaultCurrency ? "manual" : previous.currencyMode || "locale"),
      defaultCurrency: nextInput.currencyMode === "locale" ? localeCurrency(state.uiLocale) : /^[A-Z]{3}$/.test(String(nextInput.defaultCurrency || "").toUpperCase())
        ? String(nextInput.defaultCurrency).toUpperCase()
        : previous.defaultCurrency || localeCurrency(state.uiLocale),
      selectors: provider.integration === "session"
        ? emptyProviderSettings(provider).selectors
        : previous.selectors,
      status: previous.status,
      lastError: previous.lastError
    };
    if (supportsAlertLink(provider) && (usesAlertLink(provider, previous) || nextAlertUrl || clearAlertUrl)) {
      const current = state.providers[providerId];
      current.alertUrl = nextAlertUrl;
      current.alertRenderer = nextAlertUrl ? (alertLinkInfo(provider, nextAlertUrl)?.renderer || provider.name) : "";
      current.captureMode = "alert-frame";
      current.historyUrl = "";
      current.detectedUrl = "";
      current.networkFeedUrl = "";
      current.sessionToken = "";
      current.sessionTokenCapturedAt = 0;
      current.managedWindowId = 0;
      current.managedTabId = 0;
      if (alertUrlChanged) {
        current.baselineComplete = false;
        current.baselineEventIds = [];
        current.monitoringStartedAt = nextAlertUrl ? Date.now() : 0;
        current.lastBaselineCount = 0;
      }
      if (!nextAlertUrl) {
        current.alertFrameStatus = "idle";
        current.backgroundStatus = provider.integration === "session" ? "link-required" : "idle";
        current.loginStatus = "unknown";
        current.status = "setup";
        current.lastCaptureError = "";
      } else if (alertUrlChanged || current.alertFrameStatus !== "active") {
        current.alertFrameStatus = "loading";
        current.alertFrameUpdatedAt = Date.now();
        current.backgroundStatus = "loading";
        current.loginStatus = "observed";
        current.status = "ready";
        current.lastCaptureError = "";
        current.lastError = "";
      }
    }
    if (nextInput.clearApiToken) state.providers[providerId].apiToken = "";
    activity(state, "info", `${provider.name} ayarları kaydedildi.`, providerId);
  });
  if (providerId === "streamelements") closeStreamElementsSocket();
  if (providerId === "pally") closePallySocket();
  await syncAlertSources(mutation.state).catch(async error => {
    if (!supportsAlertLink(provider)) return;
    await mutateState(state => {
      const config = state.providers[providerId];
      config.alertFrameStatus = "error";
      config.backgroundStatus = "blocked";
      config.status = "error";
      config.lastCaptureError = String(error?.message || "OBS bağlantısı başlatılamadı.").slice(0, 240);
    });
  });
  return publicState(await readState());
}

async function configureAlarms() {
  await browser.alarms.create(POLL_ALARM, { periodInMinutes: 0.5 });
  await browser.alarms.create(RETRY_ALARM, { periodInMinutes: 0.5 });
}

function startFastPolling() {
  clearInterval(fastPollTimer);
  const runFastCycle = async () => {
    if (fastPollRunning) return;
    fastPollRunning = true;
    try {
      await pulseSwProductActivity();
      await flushQueue();
      await syncConnectionStatus();
      await syncKickChannelMetrics().catch(() => {});
      await scanAll();
      await flushQueue();
    } catch (_) {
      // The alarm fallback retries transient browser/network failures.
    } finally {
      fastPollRunning = false;
    }
  };
  runFastCycle().catch(() => {});
  fastPollTimer = setInterval(runFastCycle, FAST_POLL_INTERVAL_MS);
}

browser.runtime.onInstalled.addListener(() => {
  configureAlarms().catch(() => {});
  startFastPolling();
  refreshManagedBrowserStatus()
    .then(result => {
      if (!result.allowed && browser.runtime.openOptionsPage) return browser.runtime.openOptionsPage();
      return undefined;
    })
    .catch(() => {});
  scanAll().catch(() => {});
  syncAlertSources().catch(() => {});
  flushQueue().catch(() => {});
  pulseSwProductActivity(true).catch(() => {});
});

browser.runtime.onStartup.addListener(() => {
  configureAlarms().catch(() => {});
  startFastPolling();
  refreshManagedBrowserStatus().catch(() => {});
  syncConnectionStatus(true).catch(() => {});
  scanAll().catch(() => {});
  syncAlertSources().catch(() => {});
  flushQueue().catch(() => {});
  pulseSwProductActivity(true).catch(() => {});
});

browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === POLL_ALARM) {
    (async () => {
      await pulseSwProductActivity();
      await syncConnectionStatus();
      await scanAll();
      await flushQueue();
    })().catch(() => {});
  }
  if (alarm.name === RETRY_ALARM) flushQueue().catch(() => {});
});

try {
  browser.webRequest?.onBeforeSendHeaders?.addListener(
    rememberPageBearer,
    { urls: providerRequestPatterns() },
    ["requestHeaders", "extraHeaders"]
  );
} catch (_) {
  // Firefox sürümü extraHeaders seçeneğini sunmuyorsa temel başlık görünümüyle devam et.
  try {
    browser.webRequest?.onBeforeSendHeaders?.addListener(
      rememberPageBearer,
      { urls: providerRequestPatterns() },
      ["requestHeaders"]
    );
  } catch {}
}

browser.tabs?.onRemoved?.addListener(tabId => {
  mutateState(state => {
    for (const provider of PROVIDERS.filter(item => item.integration === "session")) {
      const config = state.providers[provider.id];
      if (Number(config?.managedTabId || 0) !== Number(tabId)) continue;
      config.managedTabId = 0;
      config.loginStatus = "required";
      config.status = "setup";
      config.backgroundStatus = "learning-required";
      config.lastCaptureError = "Sekmesiz bağlantı öğrenilmeden geçici giriş sekmesi kapatıldı.";
      activity(state, "error", `${provider.name} giriş sekmesi bağlantı öğrenilmeden kapatıldı. Yeniden giriş yaparak kurulumu tamamla.`, provider.id);
    }
  }).catch(() => {});
});

browser.windows?.onRemoved?.addListener(windowId => {
  mutateState(state => {
    if (Number(state.managedBrowser.windowId || 0) !== Number(windowId)) return;
    state.managedBrowser.windowId = 0;
    state.managedBrowser.lastError = "Play Connect geçici giriş penceresi bağlantı öğrenilmeden kapatıldı.";
    for (const provider of PROVIDERS.filter(item => item.integration === "session")) {
      const config = state.providers[provider.id];
      if (Number(config?.managedWindowId || 0) !== Number(windowId)) continue;
      config.managedWindowId = 0;
      config.managedTabId = 0;
      config.loginStatus = "required";
      config.status = "setup";
      config.backgroundStatus = "learning-required";
      config.lastCaptureError = state.managedBrowser.lastError;
    }
    activity(state, "error", state.managedBrowser.lastError);
  }).catch(() => {});
});

async function handleAlertFrameStatus(message) {
  const provider = PROVIDER_BY_ID.get(message.providerId);
  if (!supportsAlertLink(provider)) return { ok: false, ignored: true };
  const reportedStatus = ["loading", "active", "settled", "error"].includes(message.status) ? message.status : "error";
  const status = reportedStatus === "settled" ? "active" : reportedStatus;
  const mutation = await mutateState(state => {
    const config = state.providers[provider.id] || emptyProviderSettings(provider);
    if (!config.enabled || !config.alertUrl || serverConnectedProviderIds(state).has(provider.id)) {
      return { ignored: true };
    }
    config.alertFrameStatus = status;
    config.alertFrameUpdatedAt = Date.now();
    config.captureMode = "alert-frame";
    config.backgroundStatus = status === "active" ? "active" : (status === "loading" ? "loading" : "blocked");
    config.loginStatus = status === "active" ? "observed" : config.loginStatus;
    config.status = status === "active" ? "connected" : (status === "loading" ? "ready" : "error");
    config.lastCaptureError = status === "error"
      ? String(message.detail || "OBS bağlantısı arka planda yüklenemedi.").slice(0, 240)
      : "";
    if (reportedStatus === "settled" && !config.baselineComplete) {
      config.baselineComplete = true;
      config.lastScanAt = Date.now();
      activity(state, "info", `${provider.name}: OBS başlangıç taraması tamamlandı; yeni donate olayları anında gönderilecek.`, provider.id);
    }
    config.lastError = config.lastCaptureError;
    state.providers[provider.id] = config;
    return { ignored: false };
  });
  return { ok: true, status, ...mutation.result };
}

// offscreen.js Firefox'ta aynı kalıcı arka plan sayfasında çalışır. OBS iframe
// durumunu runtime mesaj döngüsüne girmeden doğrudan bu işleyiciye iletir.
globalThis.__PLAY_CONNECT_REPORT_ALERT_FRAME__ = handleAlertFrameStatus;

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target === "offscreen") return false;
  (async () => {
    switch (message?.type) {
      case "SET_UI_LOCALE": {
        const allowed = ["options/", "popup/"].some(path => String(sender?.url || "").startsWith(browser.runtime.getURL(path)));
        if (sender?.id !== browser.runtime.id || !allowed) throw new Error("İşlem tamamlanamadı.");
        if (!Object.hasOwn(LOCALE_CURRENCIES, message.locale)) throw new Error("İşlem tamamlanamadı.");
        await mutateState(state => {
          state.uiLocale = message.locale;
          for (const config of Object.values(state.providers)) {
            if (config.currencyMode === "manual") continue;
            config.currencyMode = "locale";
            config.defaultCurrency = localeCurrency(message.locale);
          }
        });
        return { locale: message.locale, currency: localeCurrency(message.locale) };
      }
      case "GET_STATE":
        await refreshManagedBrowserStatus().catch(() => {});
        await syncByNoGameCookieSession(true).catch(() => {});
        return syncConnectionStatus();
      case "GET_PROVIDER_ALERT_URL": {
        const optionsRoot = browser.runtime.getURL("options/");
        if (sender?.id !== browser.runtime.id || !String(sender?.url || "").startsWith(optionsRoot)) {
          throw new Error("OBS bağlantısı yalnız Play Connect ayar ekranında görüntülenebilir.");
        }
        const provider = PROVIDER_BY_ID.get(message.providerId);
        if (!supportsAlertLink(provider)) return { url: "" };
        const state = await readState();
        return { url: String(state.providers?.[provider.id]?.alertUrl || "") };
      }
      case "PAIR_ACCOUNT":
        return pairAccount(message.code);
      case "DISCONNECT_ACCOUNT":
        return disconnectAccount();
      case "SAVE_PROVIDER":
        return saveProvider(message.providerId, message.config || {});
      case "TEST_PROVIDER":
        if (PROVIDER_BY_ID.get(message.providerId)?.integration === "session") {
          return testAlertProvider(message.providerId);
        }
        if (message.providerId === "bynogame") await syncByNoGameCookieSession(true).catch(() => {});
        return scanProvider(message.providerId, true);
      case "POLL_NOW":
        await syncByNoGameCookieSession(true).catch(() => {});
        await scanAll();
        await flushQueue();
        return publicState(await readState());
      case "SEND_SUPPORT":
        return sendSupportRequest(message.payload || {});
      case "RESOLVE_PAGE_PROVIDER": {
        const snapshot = await readState();
        const alertProvider = alertProviderForSender(snapshot, sender?.url || "", message.providerId || "");
        const provider = alertProvider || providerForUrl(sender?.url || "");
        return { providerId: provider?.id || "", alertFrame: Boolean(alertProvider) };
      }
      case "ALERT_FRAME_STATUS": {
        return handleAlertFrameStatus(message);
      }
      case "OPEN_PROVIDER_LOGIN": {
        const provider = PROVIDER_BY_ID.get(message.providerId);
        if (!provider) throw new Error("Platform bulunamadı.");
        if (provider.integration === "session") {
          const opened = await openManagedProvider(provider, providerLoginLaunchUrl(provider));
          return publicState(opened.state);
        }
        await mutateState(state => {
          state.providers[provider.id].loginStatus = "waiting";
          state.providers[provider.id].lastError = "";
          activity(state, "info", `${provider.name} giriş sayfası kullanıcı isteğiyle açıldı.`, provider.id);
        });
        await browser.tabs.create({ url: providerLoginLaunchUrl(provider) });
        return { ok: true };
      }
      case "OPEN_PROVIDER_LOGOUT": {
        const provider = PROVIDER_BY_ID.get(message.providerId);
        if (!provider) throw new Error("Platform bulunamadı.");
        if (provider.integration === "session") {
          await openManagedProvider(provider, providerLogoutLaunchUrl(provider));
        }
        const mutation = await mutateState(state => {
          const config = state.providers[provider.id] || emptyProviderSettings(provider);
          config.loginStatus = "logout-pending";
          config.lastError = "";
          config.networkFeedUrl = "";
          config.lastNetworkAt = 0;
          config.monitoringStartedAt = 0;
          if (provider.id === "bynogame") {
            config.sessionToken = "";
            config.sessionTokenCapturedAt = 0;
            config.baselineComplete = false;
          }
          if (provider.integration === "session") config.status = "setup";
          state.providers[provider.id] = config;
          activity(state, "info", `${provider.name} çıkış sayfası kullanıcı isteğiyle açıldı.`, provider.id);
        });
        if (provider.integration !== "session") {
          await browser.tabs.create({ url: providerLogoutLaunchUrl(provider) });
        }
        return publicState(mutation.state);
      }
      case "PAGE_STATUS": {
        const provider = PROVIDER_BY_ID.get(message.providerId);
        if (!provider || !sender?.url || !isProviderUrlAllowed(provider, sender.url)) {
          return { ok: false, ignored: true };
        }
        const statusSnapshot = await readState();
        if (!managedSenderAllowed(provider, statusSnapshot.providers[provider.id], sender)) {
          return { ok: false, ignored: true, reason: "login-learning-window-required" };
        }
        const mutation = await mutateState(state => {
          const config = state.providers[provider.id] || emptyProviderSettings(provider);
          const wasWaitingForLogin = config.loginStatus === "waiting";
          const explicitlyAuthenticated = message.authenticated === true;
          const explicitlyLoggedOut = message.authenticated === false || message.loginRequired === true;
          const strongLoginRequired = message.strongLoginRequired === true;
          const recentNetworkEvidence = Date.now() - Number(config.lastNetworkAt || 0) < 15_000;
          const verifiedSessionEvidence = Boolean(config.sessionToken) || recentNetworkEvidence;
          const preserveVerifiedSession = explicitlyLoggedOut && !strongLoginRequired && verifiedSessionEvidence;
          let loginStatus = config.loginStatus || "unknown";
          if (preserveVerifiedSession) {
            loginStatus = "observed";
          } else if (explicitlyLoggedOut) {
            loginStatus = "required";
            config.networkFeedUrl = "";
            config.lastNetworkAt = 0;
            config.monitoringStartedAt = 0;
          } else if (config.loginStatus !== "logout-pending"
            && (explicitlyAuthenticated || (wasWaitingForLogin && (message.accountLike || message.historyLike)))) {
            loginStatus = "observed";
          }
          config.loginStatus = loginStatus;
          config.lastPageAt = Date.now();
          config.lastCaptureError = "";
          if (loginStatus === "observed") {
            config.autoConfiguredAt = Date.now();
          }
          if (loginStatus === "observed") {
            if (!Number(config.monitoringStartedAt || 0)) config.monitoringStartedAt = Date.now();
            config.lastError = "";
            if (config.status === "setup") config.status = "ready";
          } else if (loginStatus === "required") {
            config.status = "setup";
          }
          state.providers[provider.id] = config;
          return {
            loginStatus,
            detectedUrl: config.detectedUrl,
            historyUrlDetected: false,
            shouldNavigate: false
          };
        });
        return {
          ok: true,
          ...mutation.result
        };
      }
      case "PAGE_MONITOR_DISCOVERY": {
        return { ok: true, ignored: true, reason: "automatic-network-only" };
        const provider = PROVIDER_BY_ID.get(message.providerId);
        if (!provider || provider.integration !== "session" || !sender?.url || !isProviderUrlAllowed(provider, sender.url)) {
          return { ok: false, ignored: true };
        }
        const snapshot = await readState();
        if (!managedSenderAllowed(provider, snapshot.providers[provider.id], sender)) {
          return { ok: false, ignored: true, reason: "login-learning-window-required" };
        }
        const monitorUrl = String(message.url || "").trim();
        if (!monitorUrl || !isTrustedProviderMonitorUrl(provider, monitorUrl)) {
          return { ok: false, error: "Bulunan izleme adresi platform alan adıyla eşleşmiyor." };
        }
        const confidence = Math.max(
          scoreProviderMonitorUrl(provider, monitorUrl),
          Math.max(0, Math.min(100, Number(message.confidence || 0)))
        );
        const mutation = await mutateState(state => {
          const config = state.providers[provider.id] || emptyProviderSettings(provider);
          const now = Date.now();
          const currentUrl = String(sender.url || "");
          const currentConfidence = Number(config.monitorUrlConfidence || 0);
          config.monitorDiscoveryAt = now;
          config.autoConfiguredAt = now;
          config.lastCaptureError = "";
          if (confidence >= 22 && confidence >= currentConfidence) {
            config.monitorUrlConfidence = confidence;
            if (!config.networkFeedUrl) config.historyUrl = monitorUrl;
            config.detectedUrl = monitorUrl;
          }
          const shouldNavigate = confidence >= 22
            && confidence >= currentConfidence
            && currentUrl !== monitorUrl
            && now - Number(config.lastAutoNavigationAt || 0) >= 10 * 1000;
          if (shouldNavigate) config.lastAutoNavigationAt = now;
          state.providers[provider.id] = config;
          return { shouldNavigate, monitorUrl, confidence };
        });
        if (mutation.result.shouldNavigate && sender.tab?.id) {
          await browser.tabs.update(sender.tab.id, { url: mutation.result.monitorUrl, active: true }).catch(() => {});
        }
        return { ok: true, ...mutation.result };
      }
      case "PAGE_SESSION_TOKEN": {
        const provider = PROVIDER_BY_ID.get(message.providerId);
        if (provider?.id !== "bynogame" || !sender?.url || !isProviderUrlAllowed(provider, sender.url)) {
          return { ok: false, ignored: true };
        }
        const tokenSnapshot = await readState();
        if (!managedSenderAllowed(provider, tokenSnapshot.providers[provider.id], sender)) {
          return { ok: false, ignored: true, reason: "login-learning-window-required" };
        }
        const token = String(message.token || "").trim();
        if (token.length < 20 || token.length > 4096 || /\s/.test(token)) {
          return { ok: false, ignored: true };
        }
        const mutation = await mutateState(state => {
          const config = state.providers[provider.id] || emptyProviderSettings(provider);
          const changed = config.sessionToken !== token;
          const hadSession = Boolean(config.sessionToken);
          const hadDirectSession = hadSession || Number(config.sessionTokenCapturedAt || 0) > 0;
          config.sessionToken = token;
          config.loginStatus = "observed";
          config.status = "connected";
          config.detectedUrl = BYNOGAME_EVENTS_ENDPOINT;
          config.historyUrl = BYNOGAME_EVENTS_ENDPOINT;
          config.lastError = "";
          if (changed) {
            config.sessionTokenCapturedAt = Date.now();
            if (!Number(config.monitoringStartedAt || 0)) config.monitoringStartedAt = config.sessionTokenCapturedAt;
            if (!hadDirectSession) config.baselineComplete = false;
            if (!hadSession) activity(state, "success", "ByNoGame oturumlu donate veri akışı bağlandı.", provider.id);
          }
          state.providers[provider.id] = config;
          return { changed };
        });
        if (mutation.result.changed) {
          scanProvider(provider.id).catch(() => {});
        }
        return { ok: true, connected: true };
      }
      case "NETWORK_CANDIDATES": {
        const snapshot = await readState();
        const alertProvider = alertProviderForSender(snapshot, sender?.url || "", message.providerId || "");
        const provider = alertProvider || providerForUrl(sender?.url || "");
        const senderAllowed = alertProvider
          ? isProviderAlertUrlAllowed(alertProvider, sender?.url || "")
          : Boolean(provider && sender?.url && isProviderUrlAllowed(provider, sender.url));
        if (!provider || !senderAllowed) {
          return { ok: false, ignored: true };
        }
        const sourceUrl = String(message.sourceUrl || "").slice(0, 1800);
        if (alertProvider ? !isSafeAlertDataUrl(sourceUrl) : !isTrustedProviderMonitorUrl(provider, sourceUrl)) {
          return { ok: true, accepted: 0, ignored: true, reason: "untrusted-data-source" };
        }
        const monitoringMutation = await mutateState(latest => {
          const latestConfig = latest.providers[provider.id] || emptyProviderSettings(provider);
          if (!Number(latestConfig.monitoringStartedAt || 0)) latestConfig.monitoringStartedAt = Date.now();
          latest.providers[provider.id] = latestConfig;
        });
        const state = monitoringMutation.state;
        const config = state.providers[provider.id];
        if (!config?.enabled) return { ok: false, ignored: true };
        if (serverConnectedProviderIds(state).has(provider.id)) {
          return { ok: true, accepted: 0, ignored: true, reason: "server-connection-active" };
        }
        if (!alertProvider && !managedSenderAllowed(provider, config, sender)) {
          return { ok: false, ignored: true, reason: "login-learning-window-required" };
        }
        const directConnectionActive = (provider.id === "bynogame" && Boolean(config.sessionToken))
          || (provider.integration !== "session" && Boolean(config.apiToken));
        const accepted = await acceptCandidates(
          provider,
          message.candidates || [],
          alertProvider ? "OBS canlı bağlantısı" : "platform veri akışı",
          {
            live: ["WS", "SSE"].includes(String(message.method || "").toUpperCase()),
            networkAlert: Boolean(alertProvider)
          }
        );
        if (alertProvider) {
          await mutateState(latest => {
            const latestConfig = latest.providers[provider.id] || emptyProviderSettings(provider);
            latestConfig.lastNetworkAt = Date.now();
            latestConfig.lastCaptureAt = Date.now();
            latestConfig.lastCaptureSource = "OBS canlı bağlantısı";
            latestConfig.lastCaptureError = "";
            latestConfig.alertFrameStatus = "active";
            latestConfig.alertFrameUpdatedAt = Date.now();
            latestConfig.captureMode = "alert-frame";
            latestConfig.backgroundStatus = "active";
            latestConfig.loginStatus = "observed";
            latestConfig.status = "connected";
            latestConfig.lastError = "";
            latest.providers[provider.id] = latestConfig;
          });
          return { ok: true, accepted, liveAlert: true };
        }
        const networkFeedUrl = safeNetworkFeedUrl(provider, sourceUrl, message.method);
        await mutateState(latest => {
          const latestConfig = latest.providers[provider.id] || emptyProviderSettings(provider);
          if (networkFeedUrl) latestConfig.networkFeedUrl = networkFeedUrl;
          if (networkFeedUrl) latestConfig.historyUrl = networkFeedUrl;
          latestConfig.lastNetworkAt = Date.now();
          latestConfig.autoConfiguredAt = Date.now();
          latestConfig.lastCaptureAt = Date.now();
          latestConfig.lastCaptureSource = "network-json";
          latestConfig.lastCaptureError = "";
          latestConfig.loginStatus = "observed";
          latestConfig.status = "connected";
          latestConfig.lastError = "";
          latest.providers[provider.id] = latestConfig;
        });
        let backgroundVerified = false;
        if (networkFeedUrl && provider.integration === "session") {
          try {
            const verification = await scanProvider(provider.id);
            backgroundVerified = verification?.background === true || verification?.ok === true;
          } catch (_) {
            // Giriş sekmesi yalnız öğrenme için açık kalır; kullanıcıdan gizli
            // kalıcı bir uzak sekme oluşturulmaz.
          }
        }
        return {
          ok: true,
          accepted,
          directConnectionActive,
          feedRemembered: Boolean(networkFeedUrl),
          backgroundVerified
        };
      }
      case "PAGE_CANDIDATES": {
        const alertSnapshot = await readState();
        const domAlertProvider = alertProviderForSender(
          alertSnapshot,
          sender?.url || "",
          message.providerId || ""
        );
        if (domAlertProvider) {
          const domAlertConfig = alertSnapshot.providers[domAlertProvider.id]
            || emptyProviderSettings(domAlertProvider);
          if (!domAlertConfig.enabled || serverConnectedProviderIds(alertSnapshot).has(domAlertProvider.id)) {
            return { ok: true, accepted: 0, ignored: true, reason: "server-connection-active" };
          }
          const firstDomSnapshot = domAlertConfig.alertDomBaselineComplete !== true;
          const recentNetworkCapture = Date.now() - Number(domAlertConfig.lastNetworkCandidateAt || 0) < 2_500;
          if (recentNetworkCapture && !firstDomSnapshot) {
            return { ok: true, accepted: 0, ignored: true, reason: "network-capture-preferred" };
          }
          const domAccepted = await acceptCandidates(
            domAlertProvider,
            message.candidates || [],
            "OBS alert kartı",
            { live: true }
          );
          await mutateState(latest => {
            const latestConfig = latest.providers[domAlertProvider.id]
              || emptyProviderSettings(domAlertProvider);
            latestConfig.alertDomBaselineComplete = true;
            latestConfig.lastCaptureAt = Date.now();
            if (domAccepted) latestConfig.lastCaptureSource = "OBS alert kartı";
            latestConfig.lastCaptureError = "";
            latestConfig.alertFrameStatus = "active";
            latestConfig.alertFrameUpdatedAt = Date.now();
            latestConfig.captureMode = "alert-frame";
            latestConfig.backgroundStatus = "active";
            latestConfig.loginStatus = "observed";
            latestConfig.status = "connected";
            latestConfig.lastError = "";
            latest.providers[domAlertProvider.id] = latestConfig;
          });
          return { ok: true, accepted: domAccepted, alertDom: true, baseline: firstDomSnapshot };
        }
        return { ok: true, accepted: 0, ignored: true, reason: "automatic-network-only" };
        const provider = PROVIDER_BY_ID.get(message.providerId);
        if (!provider || !sender?.url || !isProviderUrlAllowed(provider, sender.url)) {
          return { ok: false, ignored: true };
        }
        const state = await readState();
        if (!state.providers[provider.id]?.enabled) return { ok: false, ignored: true };
        if (!managedSenderAllowed(provider, state.providers[provider.id], sender)) {
          return { ok: false, ignored: true, reason: "login-learning-window-required" };
        }
        const useByNoGameApi = provider.id === "bynogame" && Boolean(state.providers[provider.id]?.sessionToken);
        const useRecentNetworkFeed = Date.now() - Number(state.providers[provider.id]?.lastNetworkAt || 0) < 10 * 60 * 1000;
        const trustedPage = isTrustedProviderMonitorUrl(provider, sender.url);
        if (!trustedPage || useByNoGameApi || useRecentNetworkFeed) {
          return { ok: true, accepted: 0, ignored: true, directApi: useByNoGameApi, networkFeed: useRecentNetworkFeed };
        }
        const accepted = await acceptCandidates(provider, message.candidates || [], "doğrulanmış donate sayfası");
        const observedUrl = String(sender.url || "").slice(0, 1800);
        await mutateState(latest => {
          if (observedUrl && isTrustedProviderMonitorUrl(provider, observedUrl)) {
            latest.providers[provider.id].detectedUrl = observedUrl;
            latest.providers[provider.id].historyUrl = observedUrl;
            latest.providers[provider.id].autoConfiguredAt = Date.now();
          }
          latest.providers[provider.id].lastCaptureAt = Date.now();
          latest.providers[provider.id].lastCaptureSource = "page-dom";
          latest.providers[provider.id].lastCaptureError = "";
          latest.providers[provider.id].loginStatus = "observed";
          latest.providers[provider.id].status = "connected";
          latest.providers[provider.id].lastError = "";
          latest.providers[provider.id].lastScanAt = Date.now();
        });
        return { ok: true, accepted, directApi: useByNoGameApi, networkFeed: useRecentNetworkFeed };
      }
      case "CAPTURE_DIAGNOSTIC": {
        const provider = providerForUrl(sender?.url || "");
        if (!provider || !sender?.url || !isProviderUrlAllowed(provider, sender.url)) {
          return { ok: false, ignored: true };
        }
        const snapshot = await readState();
        if (!managedSenderAllowed(provider, snapshot.providers[provider.id], sender)) {
          return { ok: false, ignored: true, reason: "login-learning-window-required" };
        }
        const diagnostic = String(message.message || "Sayfa algılama hatası.").slice(0, 240);
        await mutateState(state => {
          const config = state.providers[provider.id] || emptyProviderSettings(provider);
          config.lastCaptureError = diagnostic;
          config.lastCaptureAt = Date.now();
          config.lastCaptureSource = String(message.source || "content-scanner").slice(0, 80);
          config.status = "error";
          config.lastError = diagnostic;
          state.providers[provider.id] = config;
          activity(state, "error", `${provider.name}: ${diagnostic}`, provider.id);
        });
        return { ok: true, recorded: true };
      }
      default:
        return { ok: false, error: "Bilinmeyen eklenti isteği." };
    }
  })()
    .then(result => sendResponse({ ok: true, result }))
    .catch(error => sendResponse({ ok: false, error: String(error?.message || "İşlem tamamlanamadı.") }));
  return true;
});

configureAlarms().catch(() => {});
startFastPolling();
scanAll().catch(() => {});
syncAlertSources().catch(() => {});
flushQueue().catch(() => {});
readState().then(state => {
  const config = state.providers.streamelements;
  if (config?.enabled && config.apiToken && config.channelId && !config.alertUrl && !serverConnectedProviderIds(state).has("streamelements")) connectStreamElements(config).catch(() => {});
}).catch(() => {});
