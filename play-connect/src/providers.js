export const FEATURED_PROVIDER_IDS = [
  "bynogame",
  "klasgame",
  "streamlabs",
  "streamelements"
];

// Play Connect does not force every platform through the same fragile page
// reader.  The profile below declares the best available transport and the
// safe fallbacks for every provider shown in the product.
const CONNECTION_PROFILES = Object.freeze({
  streamlabs: { preferredConnection: "provider-api", connectionStrategies: ["provider-api", "alert-link"], supportLevel: "built-in" },
  streamelements: { preferredConnection: "provider-api", connectionStrategies: ["provider-api", "alert-link"], supportLevel: "built-in" },
  tipeeestream: { preferredConnection: "provider-api", connectionStrategies: ["provider-api", "alert-link"], supportLevel: "built-in" },
  donationalerts: { preferredConnection: "provider-api", connectionStrategies: ["provider-api", "alert-link"], supportLevel: "built-in" },
  pally: { preferredConnection: "provider-api", connectionStrategies: ["provider-api", "alert-link"], supportLevel: "documented" },
  itemsatis: { preferredConnection: "server-webhook", connectionStrategies: ["server-webhook", "alert-link"], supportLevel: "documented" },
  kofi: { preferredConnection: "server-webhook", connectionStrategies: ["server-webhook", "alert-link"], supportLevel: "documented" },
  buymeacoffee: { preferredConnection: "server-webhook", connectionStrategies: ["server-webhook", "alert-link"], supportLevel: "documented" },
  trakteer: { preferredConnection: "server-webhook", connectionStrategies: ["server-webhook", "alert-link"], supportLevel: "documented" },
  sociabuzz: { preferredConnection: "server-webhook", connectionStrategies: ["server-webhook", "alert-link"], supportLevel: "documented" },
  livepix: { preferredConnection: "alert-link", connectionStrategies: ["provider-api", "alert-link"], supportLevel: "documented" }
});

function provider(definition) {
  const connectionProfile = CONNECTION_PROFILES[definition.id] || {
    preferredConnection: "alert-link",
    connectionStrategies: ["alert-link"],
    supportLevel: definition.id === "bynogame" ? "built-in" : "session-dependent"
  };
  return {
    region: "Türkiye",
    integration: "session",
    connectionMode: "alert-link",
    apiLabel: "",
    apiTokenLabel: "",
    apiHelpUrl: "",
    channelIdLabel: "",
    brandColor: "#53fc18",
    preferredConnection: connectionProfile.preferredConnection,
    connectionStrategies: connectionProfile.connectionStrategies,
    supportLevel: connectionProfile.supportLevel,
    ...definition,
    icon: definition.icon || `assets/providers/${definition.id}.png`
  };
}

export const PROVIDERS = [
  provider({
    id: "bynogame",
    name: "ByNoGame",
    homeUrl: "https://donate.bynogame.com/",
    loginUrl: "https://www.bynogame.com/tr/login",
    domains: ["bynogame.com"],
    defaultCurrency: "TRY",
    brandColor: "#ff8a00"
  }),
  provider({
    id: "klasgame",
    name: "Klasgame",
    homeUrl: "https://www.klasgame.com/",
    loginUrl: "https://www.klasgame.com/giris-yap/?refresh=1",
    domains: ["klasgame.com"],
    defaultCurrency: "TRY",
    brandColor: "#f1c232"
  }),
  provider({
    id: "streamlabs",
    name: "Streamlabs",
    region: "Global",
    integration: "streamlabs-api",
    connectionMode: "login-api",
    homeUrl: "https://streamlabs.com/dashboard",
    loginUrl: "https://streamlabs.com/login",
    domains: ["streamlabs.com"],
    defaultCurrency: "USD",
    apiLabel: "Donation API",
    apiTokenLabel: "Streamlabs erişim anahtarı",
    apiHelpUrl: "https://dev.streamlabs.com/reference/donations",
    brandColor: "#80f5d2"
  }),
  provider({
    id: "streamelements",
    name: "StreamElements",
    region: "Global",
    integration: "streamelements-api",
    connectionMode: "login-api",
    homeUrl: "https://streamelements.com/dashboard",
    loginUrl: "https://streamelements.com/dashboard",
    domains: ["streamelements.com"],
    defaultCurrency: "USD",
    apiLabel: "Canlı tip bağlantısı",
    apiTokenLabel: "StreamElements JWT anahtarı",
    apiHelpUrl: "https://docs.streamelements.com/websockets/topics/channel-tips",
    channelIdLabel: "StreamElements kanal kimliği",
    brandColor: "#5bc4ff"
  }),
  provider({
    id: "pindirim",
    name: "Pindirim",
    homeUrl: "https://www.pindirim.com/",
    loginUrl: "https://www.pindirim.com/giris",
    domains: ["pindirim.com"],
    defaultCurrency: "TRY",
    brandColor: "#7c5cff"
  }),
  provider({
    id: "oyunfor",
    name: "Oyunfor",
    homeUrl: "https://www.oyunfor.com/donate",
    loginUrl: "https://www.oyunfor.com/giris",
    domains: ["oyunfor.com"],
    defaultCurrency: "TRY",
    brandColor: "#ff9c00"
  }),
  provider({
    id: "itemsatis",
    name: "İtemSatış",
    homeUrl: "https://www.itemsatis.com/",
    loginUrl: "https://www.itemsatis.com/",
    domains: ["itemsatis.com"],
    defaultCurrency: "TRY",
    brandColor: "#ff3e61"
  }),
  provider({
    id: "oyuneks",
    name: "Oyuneks",
    homeUrl: "https://oyuneks.com/",
    loginUrl: "https://oyuneks.com/giris-yap",
    domains: ["oyuneks.com"],
    defaultCurrency: "TRY",
    brandColor: "#fa3f47"
  }),
  provider({
    id: "hesap",
    name: "Hesap.com.tr",
    homeUrl: "https://hesap.com.tr/yayincilar",
    loginUrl: "https://hesap.com.tr/login",
    domains: ["hesap.com.tr"],
    defaultCurrency: "TRY",
    brandColor: "#1aa7ff"
  }),
  provider({
    id: "dijipin",
    name: "Dijipin",
    homeUrl: "https://www.dijipin.com/yayincilar",
    loginUrl: "https://www.dijipin.com/",
    domains: ["dijipin.com"],
    defaultCurrency: "TRY",
    brandColor: "#ffbd00"
  }),
  provider({
    id: "epin",
    name: "EPİN",
    homeUrl: "https://epin.com.tr/",
    loginUrl: "https://epin.com.tr/",
    domains: ["epin.com.tr"],
    defaultCurrency: "TRY",
    brandColor: "#ff384c"
  }),
  provider({
    id: "inovapin",
    name: "İnovapin",
    homeUrl: "https://www.inovapin.com/yayinci/inovapin",
    loginUrl: "https://www.inovapin.com/",
    domains: ["inovapin.com"],
    defaultCurrency: "TRY",
    brandColor: "#8ce63f"
  }),
  provider({
    id: "kofi",
    name: "Ko-fi",
    region: "Global",
    homeUrl: "https://ko-fi.com/manage",
    loginUrl: "https://ko-fi.com/account/login",
    domains: ["ko-fi.com"],
    defaultCurrency: "USD",
    brandColor: "#ff5e5b"
  }),
  provider({
    id: "buymeacoffee",
    name: "Buy Me a Coffee",
    region: "Global",
    homeUrl: "https://studio.buymeacoffee.com/",
    loginUrl: "https://www.buymeacoffee.com/login",
    domains: ["buymeacoffee.com"],
    defaultCurrency: "USD",
    brandColor: "#ffdd00"
  }),
  provider({
    id: "tipeeestream",
    name: "TipeeeStream",
    region: "Global",
    integration: "tipeeestream-api",
    connectionMode: "login-api",
    homeUrl: "https://www.tipeeestream.com/dashboard",
    loginUrl: "https://www.tipeeestream.com/login",
    domains: ["tipeeestream.com"],
    defaultCurrency: "EUR",
    apiLabel: "Events API",
    apiTokenLabel: "TipeeeStream API anahtarı",
    apiHelpUrl: "https://api.tipeeestream.com/api-doc/events",
    brandColor: "#20cfcf"
  }),
  provider({
    id: "donationalerts",
    name: "DonationAlerts",
    region: "Global",
    integration: "donationalerts-api",
    connectionMode: "login-api",
    homeUrl: "https://www.donationalerts.com/dashboard",
    loginUrl: "https://www.donationalerts.com/auth/login",
    domains: ["donationalerts.com"],
    defaultCurrency: "USD",
    apiLabel: "Donations API",
    apiTokenLabel: "DonationAlerts erişim anahtarı",
    apiHelpUrl: "https://www.donationalerts.com/apidoc",
    brandColor: "#f57520"
  }),
  provider({
    id: "pally",
    name: "Pally.gg",
    region: "Global",
    integration: "pally-api",
    connectionMode: "login-api",
    homeUrl: "https://pally.gg/dashboard",
    loginUrl: "https://pally.gg/login",
    domains: ["pally.gg"],
    defaultCurrency: "USD",
    apiLabel: "Canlı destek bağlantısı",
    apiTokenLabel: "Pally.gg API anahtarı",
    apiHelpUrl: "https://docs.pally.gg/advanced/websockets",
    brandColor: "#6c72ff"
  }),
  provider({
    id: "streamloots",
    name: "Streamloots",
    region: "Global",
    homeUrl: "https://www.streamloots.com/",
    loginUrl: "https://www.streamloots.com/sign-in",
    domains: ["streamloots.com"],
    defaultCurrency: "USD",
    brandColor: "#9147ff"
  }),
  provider({
    id: "destream",
    name: "DeStream",
    region: "Global",
    homeUrl: "https://destream.net/",
    loginUrl: "https://destream.net/login",
    domains: ["destream.net"],
    defaultCurrency: "USD",
    brandColor: "#ff4b55"
  }),
  provider({
    id: "livepix",
    name: "LivePix",
    region: "Brezilya",
    homeUrl: "https://livepix.gg/",
    loginUrl: "https://livepix.gg/",
    domains: ["livepix.gg"],
    defaultCurrency: "BRL",
    brandColor: "#5bff77"
  }),
  provider({
    id: "saweria",
    name: "Saweria",
    region: "Güneydoğu Asya",
    homeUrl: "https://saweria.co/",
    loginUrl: "https://saweria.co/login",
    domains: ["saweria.co"],
    defaultCurrency: "IDR",
    brandColor: "#faae2b"
  }),
  provider({
    id: "trakteer",
    name: "Trakteer",
    region: "Endonezya",
    homeUrl: "https://trakteer.id/",
    loginUrl: "https://trakteer.id/login",
    domains: ["trakteer.id"],
    defaultCurrency: "IDR",
    brandColor: "#be1e2d"
  }),
  provider({
    id: "sociabuzz",
    name: "SociaBuzz",
    region: "Global",
    homeUrl: "https://www.sociabuzz.com/tribelive",
    loginUrl: "https://sociabuzz.com/login",
    domains: ["sociabuzz.com"],
    defaultCurrency: "IDR",
    brandColor: "#22b573"
  }),
  provider({
    id: "tipply",
    name: "Tipply",
    region: "Polonya",
    homeUrl: "https://tipply.pl/",
    loginUrl: "https://app.tipply.pl/",
    domains: ["tipply.pl"],
    defaultCurrency: "PLN",
    brandColor: "#ffd100"
  }),
  provider({
    id: "toonation",
    name: "Toonation",
    region: "Güney Kore",
    homeUrl: "https://toon.at/",
    loginUrl: "https://toon.at/login",
    domains: ["toon.at"],
    defaultCurrency: "KRW",
    brandColor: "#6c5ce7"
  }),
  provider({
    id: "doneru",
    name: "Doneru",
    region: "Japonya",
    homeUrl: "https://doneru.jp/",
    loginUrl: "https://doneru.jp/login",
    domains: ["doneru.jp"],
    defaultCurrency: "JPY",
    brandColor: "#ff4c63"
  })
];

export const PROVIDER_BY_ID = new Map(PROVIDERS.map(item => [item.id, item]));

// OBS Browser Source links are bearer-like secrets.  They may point either to
// the donate platform itself or to a well-known alert renderer selected by the
// platform.  The URL is validated locally and is never included in public
// extension state or sent to Play Streamers.
const SHARED_ALERT_DOMAINS = Object.freeze([
  "streamlabs.com",
  "streamelements.com"
]);

function hostnameMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function alertLinkInfo(item, rawUrl) {
  try {
    const url = new URL(String(rawUrl || "").trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    const ownPlatform = item.domains.some(domain => hostnameMatches(hostname, domain));
    const sharedRenderer = SHARED_ALERT_DOMAINS.find(domain => hostnameMatches(hostname, domain)) || "";
    if (!ownPlatform && !sharedRenderer) return null;
    return {
      url: url.href.slice(0, 4096),
      hostname,
      renderer: sharedRenderer === "streamlabs.com"
        ? "Streamlabs"
        : sharedRenderer === "streamelements.com" ? "StreamElements" : item.name
    };
  } catch {
    return null;
  }
}

export function isProviderAlertUrlAllowed(item, rawUrl) {
  return Boolean(alertLinkInfo(item, rawUrl));
}

export function comparableAlertUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

export function providerForUrl(rawUrl) {
  let hostname = "";
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  return PROVIDERS.find(item => item.domains.some(domain => (
    hostname === domain || hostname.endsWith(`.${domain}`)
  ))) || null;
}

export function isProviderUrlAllowed(item, rawUrl) {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return item.domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

const MONITOR_DONATE_INTENT = /donat|donation|bağış|bagis|tips?|supporters?|destekçiler|destekciler|contributions?|pledges?|sponsors?|alerts?/i;
const MONITOR_LEDGER_INTENT = /transactions?|payments?|ödemeler|odemeler|işlemler|islemler|history|geçmiş|gecmis|income|revenue|gelir|kazanç|kazanc|activity|events?|orders?|outgoing|incoming/i;
const MONITOR_ACCOUNT_INTENT = /api|graphql|dashboard|panel|account|hesab|manage|creator|streamer|member|wallet|balance/i;
const MONITOR_REJECT_INTENT = /login|signin|sign-in|giriş|giris|logout|signout|çıkış|cikis|help|yardım|yardim|contact|iletişim|iletisim|checkout|sepet|product|ürün|urun|pricing|search|(?:^|[/\s])ara(?:ma)?(?:[/\s?#]|$)/i;

// A provider landing page can contain sample donor cards and amounts.  It is
// never a safe monitoring source by itself.  A usable source must also carry
// account/history/API evidence so that page demos and store orders are not
// mistaken for real donations.
export function scoreProviderMonitorUrl(item, rawUrl, label = "") {
  if (!item || !isProviderUrlAllowed(item, rawUrl)) return -100;
  try {
    const url = new URL(rawUrl);
    const pathname = url.pathname.replace(/\/{2,}/g, "/");
    const evidence = decodeURIComponent(`${pathname} ${url.search} ${label}`);
    if (MONITOR_REJECT_INTENT.test(evidence)) return -100;
    const donateIntent = MONITOR_DONATE_INTENT.test(evidence);
    const ledgerIntent = MONITOR_LEDGER_INTENT.test(evidence);
    const accountIntent = MONITOR_ACCOUNT_INTENT.test(evidence) || /^api\./i.test(url.hostname);
    const publicLanding = /^\/(?:donate|donation|tips?|support)?\/?$/i.test(pathname);
    if ((!donateIntent && !ledgerIntent) || (publicLanding && !accountIntent && !ledgerIntent)) return -100;
    let score = 0;
    if (donateIntent) score += 18;
    if (ledgerIntent) score += 14;
    if (accountIntent) score += 12;
    if (/api|graphql/i.test(evidence) || /^api\./i.test(url.hostname)) score += 8;
    if (/outgoing|incoming|history|geçmiş|gecmis|transactions?|payments?|activity|events?/i.test(evidence)) score += 8;
    if ([...url.searchParams.keys()].some(key => /page|limit|sort|filter|cursor|offset/i.test(key))) score += 3;
    if (publicLanding) score -= 35;
    return score;
  } catch {
    return -100;
  }
}

export function isTrustedProviderMonitorUrl(item, rawUrl, label = "") {
  return scoreProviderMonitorUrl(item, rawUrl, label) >= 22;
}

export function emptyProviderSettings(item) {
  return {
    enabled: true,
    historyUrl: "",
    detectedUrl: "",
    networkFeedUrl: "",
    lastNetworkAt: 0,
    lastNetworkCandidateAt: 0,
    monitoringStartedAt: 0,
    loginStatus: "unknown",
    lastPageAt: 0,
    apiToken: "",
    sessionToken: "",
    sessionTokenCapturedAt: 0,
    cookieSessionObserved: false,
    autoConfiguredAt: 0,
    alertUrl: "",
    alertRenderer: "",
    alertFrameStatus: "idle",
    alertFrameUpdatedAt: 0,
    captureMode: item.integration === "session" ? "alert-frame" : "provider-api",
    backgroundStatus: item.integration === "session" ? "link-required" : "not-needed",
    backgroundVerifiedAt: 0,
    backgroundLastSuccessAt: 0,
    backgroundFailureCount: 0,
    managedWindowId: 0,
    managedTabId: 0,
    managedStartedAt: 0,
    monitorDiscoveryAt: 0,
    monitorUrlConfidence: 0,
    lastAutoNavigationAt: 0,
    lastManagedRefreshAt: 0,
    lastCaptureAt: 0,
    lastCaptureSource: "",
    lastCaptureError: "",
    capturedEventCount: 0,
    deliveredEventCount: 0,
    channelId: "",
    selectors: {
      item: "",
      eventId: "",
      name: "",
      amount: "",
      currency: "",
      message: "",
      time: ""
    },
    status: "setup",
    lastError: "",
    lastScanAt: 0,
    lastEventAt: 0,
    lastEventName: "",
    lastCandidateCount: 0,
    lastAcceptedCount: 0,
    lastDuplicateCount: 0,
    lastInvalidCount: 0,
    lastOverflowCount: 0,
    lastBaselineCount: 0,
    baselineEventIds: [],
    baselineComplete: false,
    alertDomBaselineComplete: false,
    defaultCurrency: item.defaultCurrency
  };
}
