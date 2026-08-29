/**
 * Play Streamers - Cloudflare Worker
 *
 * Required bindings:
 *   KICK_CLIENT_ID     -> Text variable
 *   KICK_CLIENT_SECRET -> Secret variable
 *   DB                 -> D1 database
 *   GOOGLE_CLIENT_ID   -> Text variable
 *   GOOGLE_CLIENT_SECRET -> Secret variable
 *   RESEND_API_KEY      -> Secret variable (e-posta doğrulama ve şifre sıfırlama)
 *   TOTP_ENCRYPTION_KEY -> Secret variable (Authenticator anahtarlarını AES-GCM ile şifreleme)
 *
 * Donate OAuth secrets stay in Worker secrets: DONATE_OAUTH_ENCRYPTION_KEY,
 * STREAMLABS_CLIENT_ID/SECRET, DONATIONALERTS_CLIENT_ID/SECRET and
 * TIPEEESTREAM_CLIENT_ID/SECRET.
 *
 * This Worker intentionally has no Workers KV binding. Authentication and
 * short-lived security data are stored in D1 so normal browser traffic cannot
 * consume KV operations.
 */

const FRONTEND_URL = "https://pstreamers.com/";
const FRONTEND_ORIGIN = new URL(FRONTEND_URL).origin;
const ALLOWED_FRONTEND_ORIGINS = new Set([
  FRONTEND_ORIGIN,
  "https://switly01.github.io",
  "https://www.pstreamers.com",
]);
const ALLOWED_DESKTOP_ORIGINS = new Set([
  "playstreamers://app",
  "http://localhost:4178",
  "http://tauri.localhost",
  "https://tauri.localhost",
]);
// OAuth dönüşleri artık Cloudflare üzerinden korunan özel API alan adında kalır.
const API_ORIGIN = "https://api.pstreamers.com";
const REDIRECT_URI = `${API_ORIGIN}/auth/kick/callback`;
const GOOGLE_REDIRECT_URI = `${API_ORIGIN}/auth/google/callback`;
const DONATE_OAUTH_REDIRECT_URIS = Object.freeze({
  streamlabs: `${API_ORIGIN}/auth/streamlabs/callback`,
  donationalerts: `${API_ORIGIN}/auth/donationalerts/callback`,
  tipeeeestream: `${API_ORIGIN}/auth/tipeeestream/callback`,
});
const DONATE_OAUTH_PROVIDERS = Object.freeze({
  streamlabs: Object.freeze({
    id: "streamlabs",
    name: "Streamlabs",
    authorizeUrl: "https://streamlabs.com/api/v2.0/authorize",
    tokenUrl: "https://streamlabs.com/api/v2.0/token",
    profileUrl: "https://streamlabs.com/api/v2.0/user",
    eventsUrl: "https://streamlabs.com/api/v2.0/donations",
    scope: "donations.read",
    clientIdVariable: "STREAMLABS_CLIENT_ID",
    clientSecretVariable: "STREAMLABS_CLIENT_SECRET",
  }),
  donationalerts: Object.freeze({
    id: "donationalerts",
    name: "DonationAlerts",
    authorizeUrl: "https://www.donationalerts.com/oauth/authorize",
    tokenUrl: "https://www.donationalerts.com/oauth/token",
    profileUrl: "https://www.donationalerts.com/api/v1/user/oauth",
    eventsUrl: "https://www.donationalerts.com/api/v1/alerts/donations",
    scope: "oauth-user-show oauth-donation-index oauth-donation-subscribe",
    clientIdVariable: "DONATIONALERTS_CLIENT_ID",
    clientSecretVariable: "DONATIONALERTS_CLIENT_SECRET",
  }),
  tipeeeestream: Object.freeze({
    id: "tipeeestream",
    name: "TipeeeStream",
    authorizeUrl: "https://api.tipeeestream.com/oauth/v2/auth",
    tokenUrl: "https://api.tipeeestream.com/oauth/v2/token",
    refreshUrl: "https://api.tipeeestream.com/oauth/v2/refresh-token",
    profileUrl: "https://api.tipeeestream.com/v1.0/me",
    apiKeyUrl: "https://api.tipeeestream.com/v1.0/me/api",
    eventsUrl: "https://api.tipeeestream.com/v1.0/events.json",
    scope: "",
    clientIdVariable: "TIPEEESTREAM_CLIENT_ID",
    clientSecretVariable: "TIPEEESTREAM_CLIENT_SECRET",
  }),
});
const CURRENT_RELEASE_VERSION = "6.3";
const CURRENT_RELEASE_PUBLISHED_AT = "2026-08-29T18:59:46+03:00";
const SW_IDENTITY_ORIGIN = "https://api.swcreate.com";
const DESKTOP_IDENTITY_REDIRECT = "playstreamers://identity/callback";
const WEB_IDENTITY_REDIRECTS = new Set([
  "https://pstreamers.com/identity/callback",
  "https://www.pstreamers.com/identity/callback",
]);
const PLAY_STREAMERS_FEATURES = Object.freeze([
  ["home-command-center", "free"], ["quick-notes", "free"], ["stream-timer", "free"],
  ["live-events", "free"], ["goal-board", "free"], ["basic-stats", "free"],
  ["idea-vault", "free"],
  ["advanced-graphs", "pro"], ["after-stream-report", "pro"], ["data-export", "pro"],
  ["channel-memory", "pro"], ["stream-script", "pro"], ["teleprompter", "pro"],
  ["clip-markers", "pro"], ["stream-challenges", "pro"], ["silence-rescuer", "pro"],
  ["stream-bingo", "pro"], ["overlay-studio", "pro"], ["soundboard", "pro"],
  ["file-vault", "pro"], ["equipment-log", "pro"], ["music-license-log", "pro"],
  ["wellbeing", "pro"], ["layouts", "pro"], ["themes", "pro"], ["insider", "pro"],
  ["stream-intelligence", "product-pro"], ["audience-pulse", "product-pro"],
  ["smart-alerts", "product-pro"], ["goal-route", "product-pro"],
  ["content-repurpose", "product-pro"], ["speech-coach", "product-pro"],
  ["secret-codes", "product-pro"], ["community-seasons", "product-pro"],
  ["no-code-minigames", "product-pro"], ["interactive-story", "product-pro"],
  ["time-capsule", "product-pro"], ["brand-kit", "product-pro"],
  ["motion-identity", "product-pro"], ["emote-badge-studio", "product-pro"],
  ["media-kit", "product-pro"], ["supporter-map", "product-pro"],
  ["revenue-cockpit", "product-pro"], ["monetization-gates", "product-pro"],
  ["snapshots", "product-pro"],
]);
const PLAN_TIER_RANK = Object.freeze({ free: 0, pro: 1, "product-pro": 2 });

const KICK_OAUTH = "https://id.kick.com";
const KICK_API = "https://api.kick.com";
const KICK_SCOPES = "user:read channel:read events:subscribe kicks:read";
const KICK_EVENT_SUBSCRIPTIONS_URL = `${KICK_API}/public/v1/events/subscriptions`;
const KICK_WEBHOOK_PATH = "/api/webhooks/kick";
const KICK_EVENT_TYPES = [
  { name: "channel.followed", version: 1 },
  { name: "channel.subscription.new", version: 1 },
  { name: "channel.subscription.renewal", version: 1 },
  { name: "channel.subscription.gifts", version: 1 },
  { name: "kicks.gifted", version: 1 },
  { name: "livestream.status.updated", version: 1 },
];
const GOOGLE_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_SCOPES = "openid email profile";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const OAUTH_STATE_TTL_SECONDS = 10 * 60;
const USER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const EMAIL_CODE_TTL_MINUTES = 10;
// The interface enables its resend control after forty seconds.  Keeping the
// API on the same limit prevents a second code from invalidating the first one
// while the e-mail is still on its way.
const EMAIL_CODE_RESEND_SECONDS = 40;
const EMAIL_CODE_MAX_ATTEMPTS = 5;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_SETUP_TTL_SECONDS = 10 * 60;
const TOTP_LOGIN_TTL_SECONDS = 5 * 60;
const TOTP_MAX_ATTEMPTS = 5;
const TOTP_RECOVERY_CODE_COUNT = 8;
const TWO_FACTOR_TRUST_TTL_SECONDS = 60 * 60 * 24 * 30;
const SITE_ACTIVITY_ACTIVE_WINDOW_MS = 30 * 1000;
const SITE_ACTIVITY_WRITE_INTERVAL_MS = 8 * 1000;
const DONATE_BRIDGE_PAIRING_TTL_MS = 10 * 60 * 1000;
const DONATE_BRIDGE_MAX_ACTIVE_DEVICES = 5;
const DONATE_BRIDGE_DEVICE_TOUCH_INTERVAL_MS = 5 * 1000;
const DONATE_BRIDGE_MAX_EVENTS_PER_MINUTE = 120;
const DONATE_BRIDGE_MAX_EVENT_AGE_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const DONATE_OAUTH_SYNC_MIN_INTERVAL_MS = 5 * 1000;
const DONATE_OAUTH_EVENT_LIMIT = 100;
const DONATE_PROVIDER_CATALOG_VERSION = 9;
const DONATE_PROVIDER_CONNECTION_PROFILES = Object.freeze({
  streamlabs: { preferredConnection: "provider-api", strategies: ["provider-api", "alert-link"], supportLevel: "built-in" },
  streamelements: { preferredConnection: "provider-api", strategies: ["provider-api", "alert-link"], supportLevel: "built-in" },
  tipeeestream: { preferredConnection: "provider-api", strategies: ["provider-api", "alert-link"], supportLevel: "built-in" },
  donationalerts: { preferredConnection: "provider-api", strategies: ["provider-api", "alert-link"], supportLevel: "built-in" },
  pally: { preferredConnection: "provider-api", strategies: ["provider-api", "alert-link"], supportLevel: "built-in" },
  itemsatis: { preferredConnection: "server-webhook", strategies: ["server-webhook", "alert-link"], supportLevel: "documented", setupUrl: "https://www.itemsatis.com/webhook-ayarlari.html" },
  kofi: { preferredConnection: "server-webhook", strategies: ["server-webhook", "alert-link"], supportLevel: "documented", setupUrl: "https://ko-fi.com/manage/webhooks" },
  buymeacoffee: { preferredConnection: "server-webhook", strategies: ["server-webhook", "alert-link"], supportLevel: "documented", setupUrl: "https://studio.buymeacoffee.com/webhooks" },
  trakteer: { preferredConnection: "server-webhook", strategies: ["server-webhook", "alert-link"], supportLevel: "documented", setupUrl: "https://help.trakteer.id/help-center/articles/70/panduan-webhook" },
  sociabuzz: { preferredConnection: "server-webhook", strategies: ["server-webhook", "alert-link"], supportLevel: "documented", setupUrl: "https://sociabuzz.com/blog/info/tribe-webhook/" },
  livepix: { preferredConnection: "alert-link", strategies: ["provider-api", "alert-link"], supportLevel: "documented", apiAvailable: true, setupUrl: "https://docs.livepix.gg/" },
});
const DONATE_PROVIDER_CATALOG = Object.freeze([
  { id: "bynogame", name: "ByNoGame", region: "Türkiye", connection: "alert-link" },
  { id: "klasgame", name: "Klasgame", region: "Türkiye", connection: "alert-link" },
  { id: "streamlabs", name: "Streamlabs", region: "Global", connection: "official-api" },
  { id: "streamelements", name: "StreamElements", region: "Global", connection: "official-websocket" },
  { id: "pindirim", name: "Pindirim", region: "Türkiye", connection: "alert-link" },
  { id: "oyunfor", name: "Oyunfor", region: "Türkiye", connection: "alert-link" },
  { id: "itemsatis", name: "İtemSatış", region: "Türkiye", connection: "alert-link" },
  { id: "oyuneks", name: "Oyuneks", region: "Türkiye", connection: "alert-link" },
  { id: "hesap", name: "Hesap.com.tr", region: "Türkiye", connection: "alert-link" },
  { id: "dijipin", name: "Dijipin", region: "Türkiye", connection: "alert-link" },
  { id: "epin", name: "EPİN", region: "Türkiye", connection: "alert-link" },
  { id: "inovapin", name: "İnovapin", region: "Türkiye", connection: "alert-link" },
  { id: "kofi", name: "Ko-fi", region: "Global", connection: "alert-link" },
  { id: "buymeacoffee", name: "Buy Me a Coffee", region: "Global", connection: "alert-link" },
  { id: "tipeeestream", name: "TipeeeStream", region: "Global", connection: "official-api" },
  { id: "donationalerts", name: "DonationAlerts", region: "Global", connection: "official-api" },
  { id: "pally", name: "Pally.gg", region: "Global", connection: "official-websocket" },
  { id: "streamloots", name: "Streamloots", region: "Global", connection: "alert-link" },
  { id: "destream", name: "DeStream", region: "Global", connection: "alert-link" },
  { id: "livepix", name: "LivePix", region: "Brezilya", connection: "alert-link", defaultCurrency: "BRL" },
  { id: "saweria", name: "Saweria", region: "Güneydoğu Asya", connection: "alert-link" },
  { id: "trakteer", name: "Trakteer", region: "Endonezya", connection: "server-webhook", defaultCurrency: "IDR" },
  { id: "sociabuzz", name: "SociaBuzz", region: "Global", connection: "server-webhook", defaultCurrency: "IDR" },
  { id: "tipply", name: "Tipply", region: "Polonya", connection: "alert-link" },
  { id: "toonation", name: "Toonation", region: "Güney Kore", connection: "alert-link" },
  { id: "doneru", name: "Doneru", region: "Japonya", connection: "alert-link" },
].map(provider => Object.freeze({
  ...provider,
  ...(DONATE_PROVIDER_CONNECTION_PROFILES[provider.id] || {
    preferredConnection: "alert-link",
    strategies: ["alert-link"],
    supportLevel: provider.id === "bynogame" ? "built-in" : "session-dependent",
  }),
  serverWebhook: DONATE_PROVIDER_CONNECTION_PROFILES[provider.id]?.preferredConnection === "server-webhook",
})));
const DONATE_PROVIDER_BY_ID = new Map(DONATE_PROVIDER_CATALOG.map(provider => [provider.id, provider]));
const MAX_JSON_BODY_BYTES = 24 * 1024;
const MAX_DONATE_WEBHOOK_BODY_BYTES = 96 * 1024;
const MAX_KICK_WEBHOOK_BODY_BYTES = 64 * 1024;
// 25 MB of raw attachments stays below Resend's 40 MB final-message limit
// after Base64 expansion, while leaving room for the message body/headers.
const MAX_SUPPORT_BODY_BYTES = 28 * 1024 * 1024;
const MAX_SUPPORT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_SUPPORT_ATTACHMENT_TOTAL_BYTES = 25 * 1024 * 1024;
const MAX_SUPPORT_ATTACHMENTS = 10;
const SUPPORT_EMAIL_RECIPIENT = "swcreate.info@gmail.com";
const SUPPORT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const SUPPORT_RATE_LIMIT_MAX = 5;
const SUPPORT_RATE_LIMIT_COOLDOWN_MS = 30 * 1000;
const SUPPORT_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
// The mail logo is embedded with a Content-ID attachment. Keeping the compact
// PNG in the Worker prevents Gmail and other clients from showing a broken
// external-image placeholder before remote images are allowed.
const EMAIL_LOGO_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAAAn1BMVEVMaXGWc3aojniprm4OIxxLsg5c0BQRLAZAnApHRFMvNUN4V22jjXilj3lmT2WIaXOsxGqeg3innHWqq3Kqtm4scAUFBwYEBgUAAAUFBgZq7BJo6hIGCgZt9xNw/BNr8RIDAwUiUgUdQQip216f+UsIEAWE/iyk9FFVxRBRuhAXMwcoXwk5gwpj4RIPIgY/kQszcwun61h7+SOT/zs1ewkq90vCAAAAFnRSTlMAk9T1Ev7+Bv4zJljByUh0/anZ6fH9kYJg0AAAAAlwSFlzAAALEwAACxMBAJqcGAAABZhJREFUeNrtWWlz4jgQHWYM2I4xZ2QJy1icARNggPz/37aSrKNtKHzsl61aXpIiRKSf+pS6/evXG2+88cZ/G30OpwriQ+2kO47vfQw7lRh+eL7TmKTv+GEnmI7WNTCaBsOQczSR7/gf49n1fpv3aiC+3a+zcdiAoe94ndnX7fCZnbdlUA75Cv6WfXZvm1nHc2rvPwzWu+6KYMwYISyH+UW+0S/yF/65zN2tg9CpK39wTY8ME0pRPVCE8fL0NanHIOSfVpj/F+H/S0hJGJHfKF8yi5TirLcZ1LFS3xuv5ytMhRwpTMixNPKNeKtfFCeh+Hy6jv1KT/f94eh2xBTsVsiMCDE7Jjlybvs5ilfJaOhUG2iycaV8ouxDpHitiXlVWzcqCR2+7xOvSgW/M0qzXAGjPdKigSeMf7Qh+RfbntZVKvS9gVAAuFbuL9J7VrREmw0pP8hFrsJmUOEF5+PPbokpCBlkXUpsUFlWqBte3WZhBcFwND+zQkSqYCFEhyZwAwGaiU9V28gfr3uRsU+k7Y+QlUOIfVXcZj/scB07r4M0uB4Y0uGot0wkl95wbhJiDWRdjt2vsV/h468u1tFDdJhqgyNikk1GL9KBq4KNYncTvPRy3/stCYgWYqxhNi4Jcv9GkZKu3SQIBl4dApE2jwCh+3y1AQE35yMim2pPVpsREJStHrDFKlx56XxYzEhOUM8H3Jz7JC0hOWwZN0TE5RznpbX5QgRfEw04wbyEeCEYRNk8cong7zH/SbpMhunmd3sCycAPIrxM07i8JAloc4LYQjFEXP48Li5xGIJmJkoXBjnf4sIPLrl/sCRWuQ8aE8Rxerq4ChdX7DtOXJzJ7Scnt4i/kXKy34AgOYA4/0kBQXrKHvKAtCFgeYZycNNwsyuCeMFPpWISi0OqsYm4BuZeIgjmluCCH4pI4yh6RrBQBGnvDM1DVYVqGEWQAFmCk3Ry72LgikOWENTKRMYKzPhAZnEMwzRRF6k2GkTGDEcRRcK57iIu56BiaKPB9qjwE6swJUgxgEIxT4+4JUGWaMx19JCoyBAbhjZRlBVr0Z7faXhBdQu1XFZTXa6bE8xjWzL3ZyxvJxQeNT1puy5raSJYMbl8mp9pMAkymYHdqB3BKuGVUoZislDykSoeOospV6FVuZYE578WQr6oOOXrxL8igMZg+X2pXEYzmYGtCeBW8yZgWcRRO7kRATME4AafX96yNClChylpem2x1dS0e/JKFJeOY5NoBLUlAD0sLWQGLBU0J6h1ohFFsOjiQoOMpIlOcRlSfuNyza9yly0DsnMv8Oq0KCNtVa4XvSVmsK/Mc4ydvx+w1G1pA4Jtr7uVZrWdmmqkyPObdX7sNSBYRYxq60CSx0zOM8SYqMLJA9MfINt/W5ZCp4ZgY4vMveh1jxZoAqpsDmYGtp8yjZOdvSCiE+11Gxtc9wx24WYggWxDCAYApVlPdZfpdNanLSuPiCJDZPpv0zAXwPbXjlPV6d8yPUogcFxBCOhubcMMbITENKRqoOOE0/unHbbY0ZaZTpXabziC4a3JbloxVuNevu4pKRYIsFlgIfRgIe7jr6Bi2tJ3wMDL7D4qjw+eDvN4mbpVj7wcngk92U3a2EfA4mBU9+jibkUe54E6nN1djCgpGgnMXIgZMgBDiST43M2qZ3Z84DIe7b7FVLOgPxg92lEMtD/38G3d8WvMlx0+19xdEIZjWWgXUtBNi2f4eFsH9abLjscnywfegz0beTwFYvgsZss1p9d8Nj4ebVJ39Wzk8RTs/HO6j8YNpuP+cLLe3HqXz2UNHL8P6X09Gfq15Qslws5kdN3cdzVw31xHk07Y7AmFsNOwE0ymf6ownU6C8dBzmj/IkQ9xvDAMP16AL4f8EY7T7jlR/hyqCKf/BO8Hdm+88cb/Hv8A9L+try+ZBvYAAAAASUVORK5CYII=";
const EXTERNAL_REQUEST_TIMEOUT_MS = 8_000;
const EXTERNAL_GET_RETRIES = 1;
const GOOGLE_JWKS_CACHE_TTL_SECONDS = 60 * 60;
const KICK_REFRESH_LOCK_TTL_MS = 15_000;
const KICK_REFRESH_WAIT_MS = 4_000;
const KICK_SUBSCRIPTION_VERSION = 2;
// D1'de yalnızca aktif güvenlik kayıtlarının kalması için yapılan hafif
// bakım işlemi. Her Worker örneğinde en fazla yarım saatte bir çalışır.
const SECURITY_MAINTENANCE_INTERVAL_MS = 30 * 60 * 1000;
const SESSION_COOKIE_NAME = "ps_session";
const CSRF_COOKIE_NAME = "ps_csrf";
const TWO_FACTOR_TRUST_COOKIE_NAME = "ps_2fa_trust";
const LOGIN_DEVICE_TOUCH_INTERVAL_MS = 10 * 1000;
let kickWebhookPublicKeyPromise = null;
const kickFollowerCountCache = new Map();
const kickSubscriberCountCache = new Map();
// OAuth states, persistent sessions and other authentication records live in
// the existing D1 database.
let usersSchemaReady = false;
let usersSchemaPromise = null;
let desktopPlatformSchemaReady = false;
let desktopPlatformSchemaPromise = null;
let nextSecurityMaintenanceAt = 0;
// Deliberately a conservative, language-agnostic moderation list. Normalisation
// below also catches punctuation and common number substitutions.
const BLOCKED_USERNAME_FRAGMENTS = [
  "admin", "administrator", "moderator", "support", "owner", "staff",
  "fuck", "fuk", "shit", "bitch", "dick", "cunt", "asshole",
  "porno", "porn", "sex", "nazi", "hitler", "terror", "terrorist",
  "sik", "sok", "amcik", "amk", "orospu", "pic", "yarrak", "ibne",
  "puta", "mierda", "joder", "merde", "scheisse", "hurensohn",
  "blyat", "suka", "ху", "пизд", "сука", "бляд",
];
// Existing accounts remain verifiable at the legacy cost. New and changed
// passwords use a modestly stronger cost that stays inside Workers Free CPU.
// This is a versioned migration path; it never locks older accounts out.
const PASSWORD_HASH_ITERATIONS_LEGACY = 10_000;
const PASSWORD_HASH_ITERATIONS_CURRENT = 15_000;
const LEGACY_PLAY_STREAMERS_AUTH_PATHS = new Set([
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/verify-two-factor",
  "/api/auth/request-email-verification",
  "/api/auth/verify-email",
  "/api/auth/request-password-reset",
  "/api/auth/reset-password",
  "/api/auth/complete-google-profile",
  "/api/auth/complete-kick-profile",
  "/api/auth/oauth/start",
  "/auth/oauth/continue",
  "/auth/google/login",
  "/auth/kick/account-login",
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return apiResponse(request, null, 204);
    }

    try {
      if (url.pathname === "/") {
        return new Response("Play Streamers API is running.", {
          headers: workerPageHeaders("text/plain; charset=utf-8"),
        });
      }

      if (url.pathname === "/health") {
        return apiResponse(request, {
          ok: true,
          service: "Play Streamers API",
          version: CURRENT_RELEASE_VERSION,
          identityProvider: "sw-identity",
          turnstileEnabled: isTurnstileEnabled(env),
          aiEnabled: Boolean(env.AI || env.OPENAI_API_KEY),
        });
      }

      if (url.pathname === "/api/sw-identity/login" && request.method === "POST") {
        return proxySwIdentityCredentialRequest(request, "login");
      }

      if (url.pathname === "/api/sw-identity/register" && request.method === "POST") {
        return proxySwIdentityCredentialRequest(request, "register");
      }

      if (url.pathname === "/api/sw-identity/two-factor/verify" && request.method === "POST") {
        return proxySwIdentityCredentialRequest(request, "two-factor/verify");
      }

      if (LEGACY_PLAY_STREAMERS_AUTH_PATHS.has(url.pathname)) {
        return apiResponse(request, {
          error: "Play Streamers hesap girişi SW Identity'ye taşındı.",
          code: "SW_IDENTITY_REQUIRED",
          identityUrl: "https://swcreate.com/account",
        }, 410);
      }

      if (["/api/sw-bot/status", "/api/play-bot/status"].includes(url.pathname) && request.method === "GET") {
        return readGlobalPlayBotStatus(request, env);
      }

      if (url.pathname === "/api/public-config" && request.method === "GET") {
        const country = String(request.cf?.country || request.headers.get("CF-IPCountry") || "").trim().toUpperCase();
        return apiResponse(request, {
          turnstileEnabled: isTurnstileEnabled(env),
          turnstileSiteKey: isTurnstileEnabled(env) ? env.TURNSTILE_SITE_KEY : null,
          country: /^[A-Z]{2}$/.test(country) ? country : null,
          suggestedLocale: INTERFACE_COUNTRY_LOCALES[country] || "en",
        });
      }

      if (url.pathname === "/api/i18n/translate" && request.method === "POST") {
        return translateInterfaceStrings(request, env, ctx);
      }

      if (url.pathname === "/api/site/activity" && request.method === "POST") {
        return updateSiteActivity(request, env);
      }

      if (url.pathname === "/api/site/activity" && request.method === "GET") {
        return readSiteActivity(request, env);
      }

      if (url.pathname === "/api/auth/sw/exchange" && request.method === "POST") {
        return exchangeDesktopSwIdentity(request, env);
      }

      if (url.pathname === "/api/platform/bootstrap" && request.method === "GET") {
        return desktopPlatformBootstrap(request, env);
      }

      if (url.pathname === "/api/platform/settings" && ["GET", "PUT"].includes(request.method)) {
        return desktopFeatureSettings(request, env);
      }

      if (url.pathname === "/api/platform/stream-sessions" && ["GET", "POST"].includes(request.method)) {
        return desktopStreamSessions(request, env);
      }

      if (url.pathname === "/api/platform/live-context" && request.method === "GET") {
        return desktopLiveContext(request, env);
      }

      const desktopSessionMatch = url.pathname.match(/^\/api\/platform\/stream-sessions\/([A-Za-z0-9-]{20,64})$/);
      if (desktopSessionMatch && request.method === "PATCH") {
        return finishDesktopStreamSession(request, env, desktopSessionMatch[1]);
      }

      if (url.pathname === "/api/ai/insight" && request.method === "POST") {
        return createDesktopInsight(request, env);
      }

      // Donate Bridge uses a short-lived one-time code to obtain a dedicated
      // device credential. These desktop endpoints authenticate themselves
      // before the browser-only CSRF and Turnstile layers below.
      if (url.pathname === "/api/donate-bridge/pair/claim" && request.method === "POST") {
        return claimDonateBridgePairingCode(request, env);
      }

      if (url.pathname === "/api/donate-bridge/events" && request.method === "POST") {
        return receiveDonateBridgeEvent(request, env);
      }

      if (url.pathname === "/api/donate-bridge/device/status" && request.method === "POST") {
        return getDonateBridgeDeviceStatus(request, env);
      }

      if (url.pathname === "/api/donate-bridge/kick-metrics" && request.method === "POST") {
        return receiveDonateBridgeKickMetrics(request, env);
      }

      if (url.pathname === "/api/donate-bridge/device/disconnect" && request.method === "POST") {
        return disconnectDonateBridgeDevice(request, env);
      }

      if (url.pathname === "/api/donate-bridge/support" && request.method === "POST") {
        await ensureUsersSchema(env);
        const suppliedDeviceToken = getBearerToken(request);
        const device = suppliedDeviceToken
          ? await authenticateDonateBridgeDevice(request, env)
          : null;
        if (suppliedDeviceToken && !device) {
          return apiResponse(request, { error: "Play Connect hesap bağlantısı geçersiz veya kaldırılmış." }, 401);
        }
        return sendSupportEmail(request, env, { source: "play-connect", device, skipTurnstile: true });
      }

      if (url.pathname === "/api/donate-bridge/providers" && request.method === "GET") {
        return apiResponse(request, {
          ok: true,
          version: DONATE_PROVIDER_CATALOG_VERSION,
          providers: DONATE_PROVIDER_CATALOG,
        });
      }

      const donateWebhookMatch = url.pathname.match(/^\/api\/donate-webhooks\/incoming\/([a-z0-9-]+)\/([A-Za-z0-9_-]{40,160})$/);
      if (donateWebhookMatch && request.method === "POST") {
        return receiveDonateProviderWebhook(request, env, donateWebhookMatch[1], donateWebhookMatch[2]);
      }

      const donateOAuthCallbackMatch = url.pathname.match(/^\/auth\/(streamlabs|donationalerts|tipeeestream)\/callback$/);
      if (donateOAuthCallbackMatch && request.method === "GET") {
        return finishDonateOAuth(request, url, env, donateOAuthCallbackMatch[1]);
      }

      // This endpoint is deliberately outside Turnstile: Kick servers cannot
      // complete a browser challenge. Incoming messages are instead verified
      // with Kick's signed webhook headers below.
      if (url.pathname === KICK_WEBHOOK_PATH && request.method === "POST") {
        return receiveKickWebhook(request, env);
      }

      // Resend signs this endpoint itself, so it must stay outside browser
      // CSRF and Turnstile checks. The handler verifies the untouched body.
      if (url.pathname === "/api/webhooks/resend" && request.method === "POST") {
        return receiveResendWebhook(request, env);
      }

      if (requiresCsrfProtection(url.pathname, request)) {
        return apiResponse(request, { error: "Güvenlik doğrulaması geçersiz. Sayfayı yenileyip tekrar dene." }, 403);
      }

      if (url.pathname === "/api/donate-bridge/pairing-code" && request.method === "POST") {
        return createDonateBridgePairingCode(request, env);
      }

      if (url.pathname === "/api/donate-bridge/devices" && request.method === "GET") {
        return listDonateBridgeDevices(request, env);
      }

      if (url.pathname === "/api/donate-bridge/events" && request.method === "GET") {
        return listDonateBridgeEvents(request, env, url);
      }

      if (url.pathname === "/api/donate-bridge/devices/revoke" && request.method === "POST") {
        return revokeDonateBridgeDevice(request, env);
      }

      if (url.pathname === "/api/donate-webhooks/connections/create" && request.method === "POST") {
        return createDonateWebhookConnection(request, env);
      }

      if (url.pathname === "/api/donate-webhooks/connections/revoke" && request.method === "POST") {
        return revokeDonateWebhookConnection(request, env);
      }

      if (url.pathname === "/api/donate-webhooks/connections/test" && request.method === "POST") {
        return testDonateWebhookConnection(request, env);
      }

      if (url.pathname === "/api/donate-oauth/connections" && request.method === "GET") {
        return listDonateOAuthConnections(request, env);
      }

      if (url.pathname === "/api/donate-oauth/start" && request.method === "POST") {
        return beginDonateOAuth(request, env);
      }

      if (url.pathname === "/api/donate-oauth/disconnect" && request.method === "POST") {
        return disconnectDonateOAuth(request, env);
      }

      if (url.pathname === "/api/donate-oauth/sync" && request.method === "POST") {
        return syncDonateOAuthConnections(request, env);
      }

      if (url.pathname === "/api/account/devices" && request.method === "GET") {
        return listAccountDevices(request, env);
      }

      if (url.pathname === "/api/account/devices/revoke" && request.method === "POST") {
        return revokeAccountDevice(request, env);
      }

      if (url.pathname === "/api/account/devices/remove" && request.method === "POST") {
        return deleteClosedAccountDevice(request, env);
      }

      if (url.pathname === "/api/support/send" && request.method === "POST") {
        return await sendSupportEmail(request, env);
      }

      if (url.pathname === "/api/support/tickets" && request.method === "GET") {
        return listSupportTickets(request, env);
      }

      if (url.pathname === "/api/notifications/sync" && request.method === "GET") {
        return syncNotifications(request, env);
      }

      if (url.pathname.startsWith("/api/support/attachments/") && request.method === "GET") {
        return downloadSupportAttachment(request, env, url);
      }

      if (requiresTurnstile(url.pathname, request.method)) {
        const input = await requestJson(request.clone());
        const verification = await verifyTurnstile(input, request, env);
        if (!verification.ok) return apiResponse(request, { error: verification.error }, verification.status);
      }

      if (url.pathname === "/auth/kick/login" && request.method === "GET") {
        return beginOAuthFromBrowser(request, env, "kick", "connection", url.searchParams.get("mode") || "register");
      }

      if (url.pathname === "/auth/kick/account-login" && request.method === "GET") {
        return beginOAuthFromBrowser(request, env, "kick", "account", url.searchParams.get("mode") || "register");
      }

      if (url.pathname === "/auth/kick/callback" && request.method === "GET") {
        return finishKickLogin(request, url, env);
      }

      if (url.pathname === "/auth/google/login" && request.method === "GET") {
        return beginOAuthFromBrowser(request, env, "google", "account", url.searchParams.get("mode") || "register");
      }

      if (url.pathname === "/api/auth/oauth/start" && request.method === "POST") {
        return beginProtectedOAuth(request, env);
      }

      // Browser OAuth begins on the API domain.  This form endpoint is kept
      // separate from the JSON API so a successful Turnstile result can go
      // straight to Google/Kick without a second client-side fetch step.
      if (url.pathname === "/auth/oauth/continue" && request.method === "POST") {
        return continueProtectedOAuthInBrowser(request, env);
      }

      if (url.pathname === "/auth/google/callback" && request.method === "GET") {
        return finishGoogleLogin(request, url, env);
      }

      if (url.pathname === "/api/auth/register" && request.method === "POST") {
        return registerWithPassword(request, env);
      }

      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        return loginWithPassword(request, env);
      }

      if (url.pathname === "/api/auth/verify-two-factor" && request.method === "POST") {
        return verifyLoginTwoFactor(request, env);
      }

      if (url.pathname === "/api/auth/request-email-verification" && request.method === "POST") {
        return resendRegistrationEmailCode(request, env);
      }

      if (url.pathname === "/api/auth/verify-email" && request.method === "POST") {
        return verifyEmailAddress(request, env);
      }

      if (url.pathname === "/api/auth/request-password-reset" && request.method === "POST") {
        return requestPasswordReset(request, env);
      }

      if (url.pathname === "/api/auth/reset-password" && request.method === "POST") {
        return resetForgottenPassword(request, env);
      }

      if (url.pathname === "/api/auth/complete-google-profile" && request.method === "POST") {
        return completeGoogleProfile(request, env);
      }

      if (url.pathname === "/api/auth/complete-kick-profile" && request.method === "POST") {
        return completeKickProfile(request, env);
      }

      if (url.pathname === "/api/auth/session" && request.method === "GET") {
        const current = await readUserSession(request, env);
        if (!current) {
          return apiResponse(request, { signedIn: false }, 401);
        }
        const user = await getUserById(current.session.user.id, env);
        if (!user) {
          await deleteUserSession(current.sessionId, env);
          return apiResponse(request, { signedIn: false }, 401);
        }
        await touchAccountDevice(request, current, env).catch(error => {
          logSecurityEvent("account_device_touch_failed", { reason: error?.name || "unknown" });
        });
        // This endpoint is polled by the browser to learn the current account
        // state. It must stay read-only: refreshing a session TTL on every
        // page visit would create unnecessary database writes. Reissuing the
        // existing cookie does not write to D1 and lets a subsequent full-page
        // Kick OAuth navigation retain the already authenticated site account.
        return withSessionCookies(apiResponse(request, { signedIn: true, user }), current.sessionId);
      }

      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        requireBaseConfiguration(env);
        const sessionId = getBearerToken(request);
        if (sessionId) {
          await deleteUserSession(sessionId, env);
        }
        return withSessionCookies(apiResponse(request, { signedIn: false }), null, { clear: true });
      }

      if (url.pathname === "/api/account/update-username" && request.method === "POST") {
        return updateUsername(request, env);
      }

      if (url.pathname === "/api/account/verify-password" && request.method === "POST") {
        return verifyAccountPassword(request, env);
      }

      if (url.pathname === "/api/account/update-email" && request.method === "POST") {
        // Legacy clients are redirected to the verified e-mail flow.
        return requestEmailChange(request, env);
      }

      if (url.pathname === "/api/account/request-email-change" && request.method === "POST") {
        return requestEmailChange(request, env);
      }

      if (url.pathname === "/api/account/request-password-change" && request.method === "POST") {
        return requestPasswordChange(request, env);
      }

      if (url.pathname === "/api/account/confirm-password-change" && request.method === "POST") {
        return confirmPasswordChange(request, env);
      }

      if (url.pathname === "/api/account/request-delete" && request.method === "POST") {
        return requestAccountDeletion(request, env);
      }

      if (url.pathname === "/api/account/totp/setup" && request.method === "POST") {
        return beginTotpSetup(request, env);
      }

      if (url.pathname === "/api/account/totp/confirm" && request.method === "POST") {
        return confirmTotpSetup(request, env);
      }

      if (url.pathname === "/api/account/totp/disable" && request.method === "POST") {
        return disableTotp(request, env);
      }

      if (url.pathname === "/api/account/totp/recovery-codes" && request.method === "POST") {
        return regenerateTotpRecoveryCodes(request, env);
      }

      if (url.pathname === "/api/account/resend-code" && request.method === "POST") {
        return resendAccountCode(request, env);
      }

      if (url.pathname === "/api/account/update-password" && request.method === "POST") {
        // Password changes now always require a code delivered to the linked e-mail.
        return requestPasswordChange(request, env);
      }

      if (url.pathname === "/api/account/update-avatar" && request.method === "POST") {
        return updateAvatar(request, env);
      }

      if (url.pathname === "/api/account/delete" && request.method === "POST") {
        return deleteAccount(request, env);
      }

      if (url.pathname === "/api/kick/session" && request.method === "GET") {
        const current = await readSession(request, env);
        if (!current) {
          return apiResponse(request, { connected: false }, 401);
        }

        if (Number(current.session.subscriptionVersion || 0) < KICK_SUBSCRIPTION_VERSION) {
          const subscription = await ensureKickEventSubscriptions(current.session, env);
          if (subscription.ok) {
            await markKickSubscriptionVersion(current.sessionId, env);
            current.session.subscriptionVersion = KICK_SUBSCRIPTION_VERSION;
          }
        }

        const account = current.session.account || null;
        const profileCheckedAt = Number(account?.profileCheckedAt || 0);
        const shouldRefreshProfile = !profileCheckedAt || !account?.username || (!account?.profilePicture && Date.now() - profileCheckedAt > 24 * 60 * 60 * 1000);
        if (account?.id && shouldRefreshProfile) {
          const refreshedAccount = await getKickAccount(current.session.accessToken);
          current.session.account = refreshedAccount
            ? { ...account, ...refreshedAccount }
            : { ...account, profileCheckedAt: Date.now() };
          await saveKickSession(current.sessionId, current.session, env);
        }

        return apiResponse(request, {
          connected: true,
          account: current.session.account || null,
          expiresAt: current.session.expiresAt,
          scopes: current.session.scopes || [],
        });
      }

      if (url.pathname === "/api/kick/logout" && request.method === "POST") {
        const sessionId = getBearerToken(request);
        if (sessionId) {
          await deleteKickSession(sessionId, env);
        }
        return apiResponse(request, { connected: false });
      }

      if (url.pathname === "/api/account/kick/disconnect" && request.method === "POST") {
        return disconnectAccountKick(request, env);
      }

      if (url.pathname === "/api/kick/me" && request.method === "GET") {
        const current = await readSession(request, env);
        if (!current) {
          return apiResponse(request, { error: "Bağlantı bulunamadı." }, 401);
        }

        const kickResponse = await fetchExternal(`${KICK_API}/public/v1/users`, {
          headers: { Authorization: `Bearer ${current.session.accessToken}` },
        }, { operation: "kick-me", retries: EXTERNAL_GET_RETRIES });
        const data = await safeJson(kickResponse);
        return apiResponse(request, data, kickResponse.status);
      }

      if (url.pathname === "/api/kick/stream-status" && request.method === "GET") {
        const current = await readSession(request, env);
        if (!current) {
          return apiResponse(request, { connected: false, live: false }, 401);
        }
        const stream = await getKickStreamStatus(current.session);
        return apiResponse(request, { connected: true, ...stream });
      }

      if (url.pathname === "/api/kick/events" && request.method === "GET") {
        return listKickEvents(request, env);
      }

      return apiResponse(request, { error: "Sayfa bulunamadı." }, 404);
    } catch (error) {
      logSecurityEvent("worker_unhandled_error", { reason: error?.code || error?.name || "unknown" });
      if (error?.code === "BODY_TOO_LARGE") {
        return apiResponse(request, {
          error: "Bu istek çok büyük. Lütfen daha küçük veriyle tekrar dene.",
          code: "BODY_TOO_LARGE",
        }, 413);
      }
      return apiResponse(request, { error: "Sunucu tarafında bir hata oluştu." }, 500);
    }
  },
  async scheduled(_controller, env, context) {
    context.waitUntil(Promise.all([
      syncScheduledDonateOAuthConnections(env),
      syncScheduledKickMetrics(env),
      syncScheduledLiveSessions(env),
      runScheduledPlayBotAudit(env),
    ]));
  },
};

const PLAY_BOT_GLOBAL_STATUS_KEY = "sw-bot:global-status:v13";

async function ensurePlayBotMetadataStorage(env) {
  if (!env.DB) throw new Error("Worker is missing the DB binding");
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS play_streamers_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
}

async function readGlobalPlayBotStatus(request, env) {
  await ensurePlayBotMetadataStorage(env);
  let row = await env.DB.prepare("SELECT value, updated_at FROM play_streamers_metadata WHERE key = ?1 LIMIT 1")
    .bind(PLAY_BOT_GLOBAL_STATUS_KEY)
    .first();
  if (!row) {
    await runScheduledPlayBotAudit(env);
    row = await env.DB.prepare("SELECT value, updated_at FROM play_streamers_metadata WHERE key = ?1 LIMIT 1")
      .bind(PLAY_BOT_GLOBAL_STATUS_KEY)
      .first();
  }
  let stored = null;
  try { stored = row?.value ? JSON.parse(row.value) : null; } catch (_) { stored = null; }
  return apiResponse(request, {
    ok: true,
    checkedAt: stored?.checkedAt || row?.updated_at || null,
    issues: Array.isArray(stored?.issues) ? stored.issues : [],
    reports: Array.isArray(stored?.reports) ? stored.reports : [],
    assistant: stored?.assistant || "deterministic",
    pending: !stored,
  });
}

async function runScheduledPlayBotAudit(env) {
  await ensurePlayBotMetadataStorage(env);
  const resources = [
    ["Ana sayfa", "https://pstreamers.com/", "document"],
    ["Ana uygulama betiği", "https://pstreamers.com/app.js?v=5.4.8", "script"],
    ["Uygulama betiği", "https://pstreamers.com/app-final.js?v=5.11.0", "script"],
    ["Site davranış betiği", "https://pstreamers.com/site-v7.js?v=10.13.0", "script"],
    ["Canlı çeviri betiği", "https://pstreamers.com/live-i18n.js?v=9.5.0", "script"],
    ["İngilizce dil paketi", "https://pstreamers.com/locales/en.json?v=2026-08-29.5", "json"],
    ["Almanca dil paketi", "https://pstreamers.com/locales/de.json?v=2026-08-29.5", "json"],
    ["İspanyolca dil paketi", "https://pstreamers.com/locales/es.json?v=2026-08-29.5", "json"],
    ["Fransızca dil paketi", "https://pstreamers.com/locales/fr.json?v=2026-08-29.5", "json"],
    ["Rusça dil paketi", "https://pstreamers.com/locales/ru.json?v=2026-08-29.5", "json"],
    ["Arapça dil paketi", "https://pstreamers.com/locales/ar.json?v=2026-08-29.5", "json"],
    ["Japonca dil paketi", "https://pstreamers.com/locales/ja.json?v=2026-08-29.5", "json"],
    ["Premium stil dosyası", "https://pstreamers.com/site-v7.css?v=10.13.0", "style"],
    ["Oturum başlangıç betiği", "https://pstreamers.com/session-bootstrap.js?v=1.1", "script"],
    ["Site yönlendiricisi", "https://pstreamers.com/site-router.js?v=1.1", "script"],
    ["Sunucu analiz betiği", "https://pstreamers.com/server-analytics.js?v=6.0", "script"],
    ["Gizlilik sayfası", "https://pstreamers.com/privacy.html", "document"],
    ["Kullanım koşulları", "https://pstreamers.com/terms.html", "document"],
    ["Kimlik dönüş sayfası", "https://pstreamers.com/identity/callback/", "document"],
    ["404 yönlendirme sayfası", "https://pstreamers.com/404.html", "document"],
    ["SW Identity sağlığı", "https://api.swcreate.com/api/health", "json"],
    ["PS marka amblemi", "https://pstreamers.com/play-streamers-ps-logo.svg?v=10.11", "image"],
    ["Kick giriş amblemi", "https://pstreamers.com/assets/kick-logo.svg", "image"],
    ["SW Create amblemi", "https://pstreamers.com/swcreate-sw-logo-transparent.png", "image"],
    ["Windows kurucusu", "https://pstreamers.com/downloads/Play-Streamers-Setup.exe", "binary"],
    ["Windows güncelleme bildirimi", "https://pstreamers.com/downloads/latest.json", "json"],
    ["Play Connect paketi", "https://pstreamers.com/play-connect-v1.15.1.zip", "binary"],
    ["Türkçe bayrağı", "https://pstreamers.com/assets/flags/tr.svg", "image"],
    ["İngilizce bayrağı", "https://pstreamers.com/assets/flags/gb.svg", "image"],
    ["Almanca bayrağı", "https://pstreamers.com/assets/flags/de.svg", "image"],
    ["İspanyolca bayrağı", "https://pstreamers.com/assets/flags/es.svg", "image"],
    ["Fransızca bayrağı", "https://pstreamers.com/assets/flags/fr.svg", "image"],
    ["Rusça bayrağı", "https://pstreamers.com/assets/flags/ru.svg", "image"],
    ["Arapça bayrağı", "https://pstreamers.com/assets/flags/sa.svg", "image"],
    ["Japonca bayrağı", "https://pstreamers.com/assets/flags/jp.svg", "image"],
  ];
  const issues = [];
  // Zamanlanmış görev bu Worker'ın kendisidir. Kendi özel alan adına HTTP ile
  // geri dönmek Cloudflare'da döngü/522 üretebildiği için sağlık denetimini
  // doğrudan Worker'ın zorunlu D1 bağı üzerinden yapıyoruz. Tarayıcı aynı
  // denetimi ikinci kez çalıştırmaz; bu sonuç tüm kullanıcılara sunulur.
  try {
    const internalHealth = await env.DB.prepare("SELECT 1 AS ok").first();
    if (Number(internalHealth?.ok) !== 1) issues.push("Play Streamers API iç sağlık denetimi geçerli bir sonuç döndürmüyor.");
  } catch (_) {
    issues.push("Play Streamers API D1 bağlantısı kullanılamıyor.");
  }
  const results = await Promise.all(resources.map(async ([label, url, type]) => {
    try {
      const response = await fetchExternal(url, { method: type === "binary" ? "HEAD" : "GET", headers: { accept: "*/*" } }, {
        operation: `play-bot-${type}`,
        timeoutMs: 5_000,
        retries: 1,
      });
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      let body = "";
      let byteLength = 0;
      let signature = "";
      if (response.ok && (type === "script" || type === "document" || type === "json" || type === "style")) body = await response.text();
      else if (response.ok && type === "image") {
        const bytes = new Uint8Array(await response.arrayBuffer());
        byteLength = bytes.byteLength;
        signature = [...bytes.slice(0, 8)].map(value => value.toString(16).padStart(2, "0")).join("");
      }
      return { label, url, type, ok: response.ok, status: response.status, contentType, body, byteLength, signature };
    } catch (_) {
      return { label, url, type, ok: false, status: 0, contentType: "", body: "" };
    }
  }));
  for (const result of results) {
    if (!result.ok) {
      issues.push(`${result.label} sunucudan yüklenemiyor (HTTP ${result.status || "bağlantı yok"}).`);
      continue;
    }
    if (result.type === "image" && !/image\/(?:svg\+xml|png|webp|jpeg)/.test(result.contentType)) {
      issues.push(`${result.label} görsel yerine geçersiz bir içerik döndürüyor.`);
    }
    if (result.type === "image" && result.byteLength < 128) issues.push(`${result.label} boş veya eksik bir görsel dosyası döndürüyor.`);
    if (result.type === "json") {
      let payload = null;
      try { payload = JSON.parse(result.body); } catch (_) { payload = null; }
      const updaterPlatforms = payload?.platforms;
      const hasUpdaterPlatforms = Array.isArray(updaterPlatforms)
        ? updaterPlatforms.length > 0
        : Boolean(updaterPlatforms && typeof updaterPlatforms === "object" && Object.keys(updaterPlatforms).length);
      const localeCatalog = /dil paketi$/i.test(result.label);
      const validPayload = result.label === "Windows güncelleme bildirimi"
        ? Boolean(payload?.version && hasUpdaterPlatforms)
        : localeCatalog
          ? Boolean(payload?.version === "2026-08-29.5" && payload?.sourceLanguage === "tr" && payload?.language && Object.keys(payload?.translations || {}).length >= 350)
          : Boolean(payload?.ok);
      if (!validPayload) issues.push(`${result.label} geçerli bir JSON yanıtı döndürmüyor.`);
    }
  }
  const homeDocument = results.find(result => result.type === "document");
  if (homeDocument?.ok) {
    const documentContracts = [
      ["site-v7.css?v=10.13.0", "Güncel premium stil dosyası"],
      ["app.js?v=5.4.8", "Güncel ana uygulama betiği"],
      ["app-final.js?v=5.11.0", "Güncel onarım betiği"],
      ["site-v7.js?v=10.13.0", "Güncel site davranış betiği"],
      ["live-i18n.js?v=9.5.0", "Güncel sabit paket çeviri betiği"],
      ["play-streamers-build\" content=\"2026-08-29-site-10.13.0", "Site 10.13.0 sürüm işareti"],
    ];
    for (const [token, label] of documentContracts) {
      if (!homeDocument.body.includes(token)) issues.push(`${label} canlı ana sayfaya bağlanmamış.`);
    }
  }
  const appScript = results.find(result => result.label === "Uygulama betiği");
  if (appScript?.ok) {
    const contracts = [
      ["data-ps70-embedded-icon", "TipeeeStream embedded single-layer icon marker"],
      ["data-ps72-tipeee-logo", "TipeeeStream resmî logo katmanı"],
      ["normalizeTipeeeStreamDabLogo", "Eski TipeeeStream TI metnini kaldıran onarım"],
      ["dab:tipeeeestream-fallback", "Legacy TipeeeStream TI fallback audit"],
      ["setUpdateExpanded", "Güncelleme notlarının +/− durumu"],
      ["ps70-update-symbol", "Güncelleme notlarının canlı +/− simgesi"],
      ["openAccountMetricDay", "24 saatlik veri grafiği"],
      ["accountMetricDateKey", "Grafiklerde İstanbul gün sınırı"],
      ["normalizeAccountMetricZeroes", "Aktif abone boş değer koruması"],
      ["syncDashboardResetControl", "Dashboard sıfırlama düğmesi"],
      ["repositionOpenFloatingSurfaces", "Açılır pencerelerin ekran boyutuna uyumu"],
      ["ResizeObserver(scheduleFloatingSurfaceReposition)", "Açık pencerelerin yerleşim değişimini izlemesi"],
      ["data-ps70-provider-icon", "DAB platform logoları"],
      ["ps11-google-mark", "Google giriş simgesi"],
      ["localeFlagMarkup", "Gerçek dil bayrakları"],
      ["rememberIntentForProvider", "Google ve Kick sosyal girişlerinde Beni hatırla tercihi"],
      ["/api/account/devices/remove", "Kapalı cihaz kaydını silme akışı"],
      ["TIPEEESTREAM_OFFICIAL_ICON_DATA", "Gömülü resmî TipeeeStream logo kaynağı"],
      ["isEmbeddedTipeeeStreamLogo", "TipeeeStream gömülü logo doğrulaması"],
      ["donateProviderIconSource", "DAB platform logo çözümleyicisi"],
      ["runPlayBotDetachedTemplateAudits", "Kullanıcıdan bağımsız DAB arayüz denetimi"],
      ["ps71StableOrder", "İstatistik kartlarının sabit DOM sırası"],
      ["ps71ResetLabelGuard", "Sıfırlama etiketinin aktif sekmeyle senkron kalması"],
      ["ps69DayNavigation", "24 saatlik grafik açma sözleşmesi"],
      ["Yayıncı istatistikleri verilerini sıfırla", "İstatistik ekranı sıfırlama etiketi"],
      ["SITE_METRICS_LEASE_KEY", "Canlı site verilerinde sekmeler arası istek kilidi"],
      ["siteMetricsRenderedAt", "Canlı site verilerinde eski cevabı engelleme"],
      ["ps61DisplayedValue", "Canlı site sayacının ekrandaki değerden devam etmesi"],
      ["SW BOT", "SW Bot kullanıcı arayüzü"],
      ["/api/sw-bot/status", "SW Bot sunucu denetimi"],
      ["<b>SW AI</b>", "SW AI anlaşılır sorun açıklaması"],
      ["unlabeledFields", "Form alanı erişilebilirlik denetimi"],
      ["unsafeExternalLinks", "Yeni sekme bağlantı güvenliği denetimi"],
      ["Kullanım Koşulları", "Yasal koşullar bağlantısı"],
      ["window.psSetLocale", "Sayfa yenilemeden çalışan dil seçimi"],
      ["setSelectionRange", "Şifre gözünde imleç konumunu koruma"],
      ["method: 'GET'", "Canlı site verilerinde salt okunur yedek akış"],
    ];
    for (const [token, label] of contracts) {
      if (!appScript.body.includes(token)) issues.push(`${label} canlı uygulama betiğinde bulunamadı.`);
    }
  }
  const mainScript = results.find(result => result.label === "Ana uygulama betiği");
  if (mainScript?.ok) {
    const contracts = [
      ["if(small)small.textContent", "Kick bağlantı metninde güvenli DOM erişimi"],
      ["if(error)error.textContent", "Kimlik doğrulama hata metninde güvenli DOM erişimi"],
    ];
    for (const [token, label] of contracts) {
      if (!mainScript.body.includes(token)) issues.push(`${label} canlı ana uygulama betiğinde bulunamadı.`);
    }
  }
  const styleSheet = results.find(result => result.label === "Premium stil dosyası");
  if (styleSheet?.ok) {
    const contracts = [
      ["html[data-ps-site-version=\"9\"]", "Site 9.0 ortak tasarım sistemi"],
      ["#ps9Ambient", "Site geneli hareket katmanı"],
      ["ps106-pointer-lantern", "Yıldız alanı imleç feneri"],
      ["--ps106-liquid-edge", "Site geneli sıvı cam katmanı"],
      ["ps9-surface-in", "Ekran geçiş animasyonu"],
      ["ps9-sw-ai-summary", "SW AI sorun açıklama kartı"],
    ];
    for (const [token, label] of contracts) {
      if (!styleSheet.body.includes(token)) issues.push(`${label} canlı stil dosyasında bulunamadı.`);
    }
  }
  const uniqueIssues = [...new Set(issues)].slice(0, 20);
  let previousStatus = null;
  try {
    const previousRow = await env.DB.prepare("SELECT value FROM play_streamers_metadata WHERE key = ?1 LIMIT 1")
      .bind(PLAY_BOT_GLOBAL_STATUS_KEY).first();
    previousStatus = previousRow?.value ? JSON.parse(previousRow.value) : null;
  } catch { previousStatus = null; }
  const unchanged = JSON.stringify(previousStatus?.issues || []) === JSON.stringify(uniqueIssues);
  const cachedReports = unchanged && Array.isArray(previousStatus?.reports) ? previousStatus.reports : null;
  const aiReports = !cachedReports && uniqueIssues.length ? await explainSwBotIssuesWithAi(uniqueIssues, env).catch(() => null) : null;
  const reports = cachedReports || (Array.isArray(aiReports?.reports) && aiReports.reports.length
    ? aiReports.reports
    : uniqueIssues.map(swBotDeterministicReport));
  const status = {
    checkedAt: new Date().toISOString(),
    issues: uniqueIssues,
    reports,
    assistant: cachedReports ? (previousStatus?.assistant || "deterministic") : aiReports?.model ? "sw-ai" : "deterministic",
  };
  await env.DB.prepare(`INSERT INTO play_streamers_metadata (key, value, updated_at)
    VALUES (?1, ?2, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .bind(PLAY_BOT_GLOBAL_STATUS_KEY, JSON.stringify(status))
    .run();
  return status;
}

function swBotDeterministicReport(issue) {
  const text = String(issue || "Bilinmeyen bir sorun bulundu.").slice(0, 500);
  let category = "interface";
  let title = "Arayüz denetimi";
  let action = "Ekibimiz sorun üzerinde çalışıyor.";
  if (/API|sunucu|D1|bağlantı|yüklenemiyor/i.test(text)) {
    category = "connection";
    title = "Veri bağlantısı";
    action = "Ekibimiz sorun üzerinde çalışıyor.";
  } else if (/görsel|logo|bayrak|image/i.test(text)) {
    category = "asset";
    title = "Görsel kaynak";
    action = "Ekibimiz sorun üzerinde çalışıyor.";
  } else if (/giriş|kayıt|doğrulama|OAuth|Google|Kick/i.test(text)) {
    category = "account";
    title = "Hesap erişimi";
    action = "Ekibimiz sorun üzerinde çalışıyor.";
  } else if (/stil|taşıyor|yerleşim|arayüz/i.test(text)) {
    category = "layout";
    title = "Ekran yerleşimi";
    action = "Ekibimiz sorun üzerinde çalışıyor.";
  } else if (/kurucu|indir/i.test(text)) {
    category = "download";
    title = "Uygulama indirmesi";
    action = "Ekibimiz sorun üzerinde çalışıyor.";
  }
  return { issue: text, category, title, summary: text, action };
}

function validSwBotReports(value, issues) {
  if (!value || !Array.isArray(value.reports)) return null;
  const allowed = new Set(issues);
  const reports = value.reports.filter(report => report
    && allowed.has(String(report.issue || ""))
    && typeof report.title === "string" && report.title.length <= 90
    && typeof report.summary === "string" && report.summary.length <= 360
    && typeof report.action === "string" && report.action.length <= 240)
    .map(report => ({
      issue: String(report.issue),
      category: String(report.category || "system").slice(0, 32),
      title: String(report.title),
      summary: String(report.summary),
      action: String(report.action),
    }));
  if (!reports.length) return null;
  const byIssue = new Map(reports.map(report => [report.issue, report]));
  return issues.map(issue => byIssue.get(issue) || swBotDeterministicReport(issue));
}

async function explainSwBotIssuesWithAi(issues, env) {
  if (!env.AI || typeof env.AI.run !== "function" || !issues.length) return null;
  const model = "@cf/meta/llama-3.1-8b-instruct-fp8";
  const payload = await env.AI.run(model, {
    messages: [
      {
        role: "system",
        content: "Sen SW AI'sın. SW Bot'un teknik site denetimlerini son kullanıcı için sade Türkçeye çevirirsin. Sorunun nedenini kanıt yoksa uydurma. Kullanıcıya ayar değiştirmesini, sayfayı yenilemesini veya başka bir işlem yapmasını söyleme. Yalnız sorunun ne olduğunu ve etkisini açıkla. action alanını daima 'Ekibimiz sorun üzerinde çalışıyor.' yap. Yalnız geçerli JSON döndür.",
      },
      {
        role: "user",
        content: `Sorunlar: ${JSON.stringify(issues)}\nHer issue metnini aynen koru. Yalnız şu biçimi döndür: {"reports":[{"issue":"aynı sorun","category":"kısa kategori","title":"en fazla 90 karakter","summary":"anlaşılır açıklama, en fazla 360 karakter","action":"güvenli sonraki adım, en fazla 240 karakter"}]}`,
      },
    ],
    max_tokens: 1400,
    temperature: 0.15,
  });
  const text = typeof payload?.response === "string"
    ? payload.response
    : typeof payload?.result?.response === "string"
      ? payload.result.response
      : typeof payload?.choices?.[0]?.message?.content === "string"
        ? payload.choices[0].message.content
        : "";
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed = null;
  try { parsed = JSON.parse(cleaned.slice(start, end + 1)); } catch { parsed = null; }
  const reports = validSwBotReports(parsed, issues);
  return reports ? { reports, model } : null;
}

const INTERFACE_LANGUAGES = Object.freeze({
  en: "English", de: "German", es: "Spanish", fr: "French",
  ru: "Russian", ar: "Arabic", ja: "Japanese",
});
const INTERFACE_COUNTRY_LOCALES = Object.freeze({
  TR: "tr", JP: "ja", DE: "de", AT: "de", CH: "de", LI: "de",
  FR: "fr", BE: "fr", LU: "fr", MC: "fr",
  ES: "es", MX: "es", AR: "es", CL: "es", CO: "es", PE: "es", VE: "es", UY: "es", PY: "es", BO: "es", EC: "es", CR: "es", PA: "es", GT: "es", HN: "es", SV: "es", NI: "es", DO: "es", CU: "es",
  RU: "ru", BY: "ru", KZ: "ru",
  SA: "ar", AE: "ar", QA: "ar", KW: "ar", BH: "ar", OM: "ar", YE: "ar", EG: "ar", JO: "ar", LB: "ar", IQ: "ar", SY: "ar", DZ: "ar", MA: "ar", TN: "ar", LY: "ar", SD: "ar",
});
const INTERFACE_LANGUAGE_REQUIREMENTS = Object.freeze({
  en: "English", de: "German (Deutsch)", es: "Spanish (Español)", fr: "French (Français)",
  ru: "Russian written in Cyrillic (Русский)", ar: "Modern Standard Arabic written in Arabic script (العربية)",
  ja: "Japanese written in Japanese script (日本語)",
});
const TURKISH_INTERFACE_TERMS = new Set(["giriş", "kayıt", "hakkımızda", "ürünlerimiz", "nasıl", "çalışır", "içerik", "planlama", "canlı", "analiz", "topluluk", "marka", "araçları", "gelir", "görünümleri", "yayın", "yayıncı", "hesap", "şifre", "doğrula", "indir", "destek", "sistem", "durumu", "ziyaretçi", "şu", "anda", "aktif", "hemen", "başla", "keşfet", "daha", "fazla", "burada", "mısın", "beni", "hatırla"]);
const interfaceTranslationRateBuckets = new Map();
let interfaceTranslationSchemaReady = false;
let interfaceTranslationSchemaPromise = null;
function containsTurkishInterfaceCopy(value) {
  const source = String(value || "");
  if (/[ĞİŞğış]/u.test(source)) return true;
  const normalized = source.toLocaleLowerCase("tr-TR");
  const matches = new Set(normalized.split(/[^a-zçğıöşü]+/u).filter(word => TURKISH_INTERFACE_TERMS.has(word)));
  return matches.size >= 2;
}

function isInterfaceTranslationPassthrough(value) {
  const source = String(value || "").replace(/\s+/g, " ").trim();
  return /^(?:PLAY STREAMERS|PLAY CONNECT|PLAY|STREAMERS|SW CREATE|SW IDENTITY|SW BOT|SW AI|PRODUCT PRO|FREE|PRO|PC|PS|APP|WEB|CONNECT|HTTP|HTTPS|API|OBS|KICK|WINDOWS)(?:\s*[·+:/-].*)?$/i.test(source)
    || /^(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.)/i.test(source)
    || /^[\d\s.,:%+\-/–—()]+$/.test(source);
}

function interfaceTranslationText(value) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  for (const key of ["translation", "text", "value", "content"]) {
    if (typeof value[key] === "string") return value[key].trim();
  }
  return "";
}

function validInterfaceTranslation(source, value, language) {
  const translated = interfaceTranslationText(value);
  if (!translated || translated.length > 1600) return false;
  if (!isInterfaceTranslationPassthrough(source)) {
    if (String(source).trim().localeCompare(translated, undefined, { sensitivity: "base" }) === 0 || containsTurkishInterfaceCopy(translated)) return false;
    if (language === "ar" && !/[\u0600-\u06ff]/u.test(translated)) return false;
    if (language === "ru" && !/[\u0400-\u04ff]/u.test(translated)) return false;
    if (language === "ja" && !/[\u3040-\u30ff\u3400-\u9fff]/u.test(translated)) return false;
  }
  return true;
}

async function generateInterfaceTranslations(env, language, sources) {
  if (!sources.length) return [];
  const payload = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
    messages: [
      {
        role: "system",
        content: `You are a professional software localization engine. Translate every Turkish UI string into ${INTERFACE_LANGUAGE_REQUIREMENTS[language]}. Context: Play Streamers is a livestreaming creator dashboard. Use these meanings: yayıncı = streamer/content creator; yayın = livestream/broadcast; topluluk = community; marka araçları = brand tools; masaüstü uygulaması = desktop app; etkileşim = engagement; çalışma alanları = workspaces; panel = dashboard. Preserve Play Streamers, Play Connect, SW Create, SW Identity, SW Bot, SW AI, Product Pro, URLs, versions, numbers and shortcuts exactly. Translate headings and uppercase labels naturally, keep punctuation and item order, never summarize, and leave no Turkish UI wording. Return only valid JSON.`,
      },
      {
        role: "user",
        content: `Return {"translations":["..."]} for this array: ${JSON.stringify(sources)}`,
      },
    ],
    max_completion_tokens: Math.min(7000, Math.max(1400, sources.length * 460)),
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        type: "object",
        properties: { translations: { type: "array", items: { type: "string" } } },
        required: ["translations"],
      },
    },
  });
  const structured = payload?.response && typeof payload.response === "object" && !Array.isArray(payload.response)
    ? payload.response
    : payload?.result?.response && typeof payload.result.response === "object" && !Array.isArray(payload.result.response)
      ? payload.result.response : null;
  if (Array.isArray(structured?.translations) && structured.translations.length === sources.length) {
    return structured.translations.map((value, index) => validInterfaceTranslation(sources[index], value, language) ? interfaceTranslationText(value) : "");
  }
  const text = typeof payload?.response === "string" ? payload.response
    : typeof payload?.result?.response === "string" ? payload.result.response
      : typeof payload?.choices?.[0]?.message?.content === "string" ? payload.choices[0].message.content : "";
  if (!text) console.warn("i18n ai response has no text", Object.keys(payload || {}), typeof payload?.choices?.[0]?.message?.content);
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  let generated = null;
  try { generated = JSON.parse(cleaned.slice(start, end + 1))?.translations; } catch { generated = null; }
  if (!Array.isArray(generated) || generated.length !== sources.length) return null;
  return generated.map((value, index) => validInterfaceTranslation(sources[index], value, language) ? interfaceTranslationText(value) : "");
}

async function translateInterfaceStrings(request, env, ctx) {
  const input = await requestJson(request);
  const language = String(input?.language || "").toLowerCase();
  const rawStrings = Array.isArray(input?.strings) ? input.strings : [];
  if (!INTERFACE_LANGUAGES[language]) return apiResponse(request, { error: "Desteklenmeyen arayüz dili." }, 400);
  if (!rawStrings.length || rawStrings.length > 60) return apiResponse(request, { error: "Çeviri paketi 1 ile 60 metin içermelidir." }, 400);
  const strings = rawStrings.map(value => String(value || "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim());
  if (strings.some(value => !value || value.length > 1200)) return apiResponse(request, { error: "Çevrilecek arayüz metni geçersiz." }, 400);
  if (!(await allowInterfaceTranslationRequest(request, env, language))) {
    return apiResponse(request, { error: "Canlı çeviri sınırına ulaşıldı. Kısa süre sonra yeniden dene." }, 429);
  }
  const cacheKeys = await Promise.all(strings.map(source => sha256Hex(`i18n:v9:${language}:${source}`)));
  const cachedByKey = new Map();
  const cachedCreatedAtByKey = new Map();
  if (env.DB) {
    try {
      await ensureInterfaceTranslationStorage(env);
      // Cache sürümü yalnız yeni yazımların kimliğini belirler. Okuma kaynak
      // metin + dil üzerinden yapılır; böylece önceki sürümlerde üretilmiş
      // geçerli çeviriler tekrar AI çağrısı yapılmadan bütün site tarafından
      // paylaşılır.
      const placeholders = strings.map((_, index) => `?${index + 2}`).join(",");
      const cachedRows = await env.DB.prepare(`SELECT source_text, translation, created_at FROM interface_translation_cache
        WHERE language = ?1 AND source_text IN (${placeholders}) ORDER BY created_at DESC`)
        .bind(language, ...strings)
        .all();
      const sourceIndexByText = new Map(strings.map((source, index) => [source, index]));
      for (const row of cachedRows?.results || []) {
        const sourceIndex = sourceIndexByText.get(String(row.source_text));
        const translation = interfaceTranslationText(row.translation);
        const cacheKey = sourceIndex === undefined ? "" : cacheKeys[sourceIndex];
        // Rows arrive newest first. Keep the first valid row so a current AI
        // translation is never overwritten in memory by an older fallback.
        if (cacheKey && !cachedByKey.has(cacheKey) && validInterfaceTranslation(strings[sourceIndex], translation, language)) {
          cachedByKey.set(cacheKey, translation);
          cachedCreatedAtByKey.set(cacheKey, String(row.created_at || ""));
        }
      }
    } catch (_) { cachedByKey.clear(); }
  }
  const translations = strings.map((_, index) => cachedByKey.get(cacheKeys[index]) || "");
  const missingIndexes = translations.map((value, index) => value ? -1 : index).filter(index => index >= 0);
  const fallbackIndexes = translations
    .map((value, index) => value && cachedCreatedAtByKey.get(cacheKeys[index]) < "2021-01-01" ? index : -1)
    .filter(index => index >= 0);
  if (!missingIndexes.length) {
    // Offline translations guarantee an immediate result when the AI daily
    // allowance is unavailable. Upgrade a tiny number in the background on
    // later visits without delaying the language switch or consuming KV.
    if (fallbackIndexes.length && ctx?.waitUntil && env.AI && env.DB) {
      ctx.waitUntil(refreshInterfaceTranslationFallbacks(env, language, strings, cacheKeys, fallbackIndexes.slice(0, 2)));
    }
    return apiResponse(request, { ok: true, language, translations, cached: true, cache: "d1" });
  }
  if (!env.AI || typeof env.AI.run !== "function") return apiResponse(request, { error: "Canlı çeviri şu anda kullanılamıyor." }, 503);
  const missingStrings = missingIndexes.map(index => strings[index]);
  const generated = new Array(missingStrings.length).fill("");
  const groups = [];
  for (let index = 0; index < missingStrings.length; index += 8) groups.push({ index, sources: missingStrings.slice(index, index + 8) });
  await Promise.all(groups.map(async group => {
    const values = await generateInterfaceTranslations(env, language, group.sources).catch(error => {
      console.error("i18n ai generation failed", error instanceof Error ? error.message : String(error));
      return null;
    });
    if (values) values.forEach((value, offset) => { generated[group.index + offset] = value; });
  }));
  const retryIndexes = generated.map((value, index) => value ? -1 : index).filter(index => index >= 0);
  for (let index = 0; index < retryIndexes.length; index += 4) {
    await Promise.all(retryIndexes.slice(index, index + 4).map(async generatedIndex => {
      const values = await generateInterfaceTranslations(env, language, [missingStrings[generatedIndex]]).catch(() => null);
      if (values?.[0]) generated[generatedIndex] = values[0];
    }));
  }
  missingIndexes.forEach((sourceIndex, generatedIndex) => { translations[sourceIndex] = generated[generatedIndex]; });
  if (env.DB) {
    const writes = missingIndexes
      .map((sourceIndex, generatedIndex) => ({ sourceIndex, value: generated[generatedIndex] }))
      .filter(item => item.value)
      .map(item => env.DB.prepare(`INSERT INTO interface_translation_cache (cache_key, language, source_text, translation, created_at)
        VALUES (?1, ?2, ?3, ?4, datetime('now'))
        ON CONFLICT(cache_key) DO UPDATE SET translation = excluded.translation, created_at = excluded.created_at`)
        .bind(cacheKeys[item.sourceIndex], language, strings[item.sourceIndex], item.value));
    if (writes.length) await env.DB.batch(writes).catch(() => {});
  }
  return apiResponse(request, { ok: true, language, translations, partial: translations.some(value => !value), cached: false, cache: "d1" });
}

async function refreshInterfaceTranslationFallbacks(env, language, strings, cacheKeys, sourceIndexes) {
  if (!sourceIndexes.length) return;
  const sources = sourceIndexes.map(index => strings[index]);
  const values = await generateInterfaceTranslations(env, language, sources).catch(() => null);
  if (!values) return;
  const writes = sourceIndexes
    .map((sourceIndex, valueIndex) => ({ sourceIndex, value: values[valueIndex] }))
    .filter(item => item.value)
    .map(item => env.DB.prepare(`INSERT INTO interface_translation_cache (cache_key, language, source_text, translation, created_at)
      VALUES (?1, ?2, ?3, ?4, datetime('now'))
      ON CONFLICT(cache_key) DO UPDATE SET translation = excluded.translation, created_at = excluded.created_at`)
      .bind(cacheKeys[item.sourceIndex], language, strings[item.sourceIndex], item.value));
  if (writes.length) await env.DB.batch(writes).catch(() => {});
}

async function ensureInterfaceTranslationStorage(env) {
  if (interfaceTranslationSchemaReady || !env.DB) return;
  if (!interfaceTranslationSchemaPromise) {
    interfaceTranslationSchemaPromise = env.DB.prepare(`CREATE TABLE IF NOT EXISTS interface_translation_cache (
      cache_key TEXT PRIMARY KEY,
      language TEXT NOT NULL,
      source_text TEXT NOT NULL,
      translation TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`).run().then(() => { interfaceTranslationSchemaReady = true; }).finally(() => { interfaceTranslationSchemaPromise = null; });
  }
  await interfaceTranslationSchemaPromise;
}

async function allowInterfaceTranslationRequest(request, _env, language) {
  const minute = Math.floor(Date.now() / 60000);
  const client = await sha256Hex(`${request.headers.get("CF-Connecting-IP") || "unknown"}:${language}:${minute}`);
  const current = interfaceTranslationRateBuckets.get(client);
  // Tek sayfa; görünür arayüz, açılır pencereler ve erişilebilirlik metinleriyle
  // birkaç kontrollü kurtarma turu çalıştırabilir. 80 istek bu normal akışı
  // yarıda kesiyordu; 240 hâlâ dakikalık kötüye kullanım sınırı bırakırken tam
  // sayfa çevirisinin D1 önbelleğini ilk ziyarette doldurmasına izin verir.
  if (Number(current?.count || 0) >= 240) return false;
  interfaceTranslationRateBuckets.set(client, { count: Number(current?.count || 0) + 1, minute });
  if (interfaceTranslationRateBuckets.size > 2000) {
    for (const [key, bucket] of interfaceTranslationRateBuckets) {
      if (Number(bucket?.minute || 0) < minute - 1) interfaceTranslationRateBuckets.delete(key);
    }
    while (interfaceTranslationRateBuckets.size > 2000) interfaceTranslationRateBuckets.delete(interfaceTranslationRateBuckets.keys().next().value);
  }
  return true;
}

// External providers occasionally respond slowly or fail temporarily.  This
// wrapper gives every call a bounded lifetime and only retries safe GET
// requests.  OAuth code exchanges, refresh tokens and e-mail sends are never
// retried automatically because repeating those operations can invalidate a
// one-time code or send a duplicate message.
async function fetchExternal(url, init = {}, options = {}) {
  const operation = String(options.operation || "external-request");
  const timeoutMs = Math.max(1_000, Number(options.timeoutMs || EXTERNAL_REQUEST_TIMEOUT_MS));
  const retries = Math.max(0, Number(options.retries || 0));
  const method = String(init.method || "GET").toUpperCase();
  const canRetry = method === "GET" && retries > 0;
  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const retryableStatus = response.status === 408 || response.status === 429 || response.status >= 500;
      if (canRetry && retryableStatus && attempt < retries) {
        logSecurityEvent("external_retry", { operation, status: response.status, attempt: attempt + 1 });
        attempt += 1;
        await wait(180 * attempt);
        continue;
      }
      return response;
    } catch (error) {
      const reason = error?.name === "AbortError" ? "timeout" : "network";
      if (canRetry && attempt < retries) {
        logSecurityEvent("external_retry", { operation, reason, attempt: attempt + 1 });
        attempt += 1;
        await wait(180 * attempt);
        continue;
      }
      logSecurityEvent("external_failure", { operation, reason });
      const wrapped = new Error(`${operation}:${reason}`);
      wrapped.code = reason === "timeout" ? "EXTERNAL_TIMEOUT" : "EXTERNAL_NETWORK_ERROR";
      throw wrapped;
    } finally {
      clearTimeout(timer);
    }
  }
}

async function proxySwIdentityCredentialRequest(request, route) {
  const origin = String(request.headers.get("Origin") || "");
  if (!["https://pstreamers.com", "https://www.pstreamers.com"].includes(origin)) {
    return apiResponse(request, { error: "Bu hesap isteğinin kaynağı doğrulanamadı." }, 403);
  }
  const payload = await requestJson(request);
  const headers = new Headers({
    "content-type": "application/json",
    "origin": origin,
  });
  const turnstileToken = String(request.headers.get("X-Turnstile-Token") || payload.turnstileToken || "").trim();
  const flowId = String(request.headers.get("X-SW-Flow-ID") || "").trim();
  if (turnstileToken) headers.set("X-Turnstile-Token", turnstileToken);
  if (flowId) headers.set("X-SW-Flow-ID", flowId.slice(0, 160));
  try {
    const response = await fetchExternal(`https://api.swcreate.com/api/auth/${route}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }, { operation: `sw-identity-${route.replaceAll("/", "-")}`, timeoutMs: 20_000 });
    const data = await response.json().catch(() => ({ error: "SW Identity yanıtı okunamadı." }));
    return apiResponse(request, data, response.status);
  } catch (error) {
    logSecurityEvent("sw_identity_proxy_failed", { route, reason: error?.code || error?.name || "unknown" });
    return apiResponse(request, { error: "Güvenli hesap bağlantısı şu anda tamamlanamadı. Lütfen tekrar dene." }, 503);
  }
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

// Keep logs useful without ever printing OAuth codes, access tokens, passwords
// or entire provider responses into Workers Logs.
function logSecurityEvent(event, fields = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(fields)) {
    if (/token|secret|password|authorization|cookie|code|email|body/i.test(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    safe[key] = typeof value === "string" ? value.slice(0, 120) : value;
  }
  console.log(JSON.stringify({ event: String(event), at: new Date().toISOString(), ...safe }));
}

function isTurnstileEnabled(env) {
  return Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
}

function requiresTurnstile(pathname, method) {
  if (method !== "POST") return false;
  return new Set([
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/request-email-verification",
    "/api/auth/verify-email",
    "/api/auth/request-password-reset",
    "/api/auth/reset-password",
    "/api/auth/complete-google-profile",
    "/api/auth/complete-kick-profile",
    "/api/account/update-email",
    "/api/account/request-email-change",
    "/api/account/request-password-change",
    "/api/account/confirm-password-change",
    "/api/account/update-password",
    "/api/account/request-delete",
    "/api/account/resend-code",
    "/api/account/delete",
  ]).has(pathname);
}

async function verifyTurnstile(input, request, env) {
  // Keeping this transitional bypass means the new code can be deployed before
  // the dashboard keys are added. Protection becomes mandatory immediately when
  // both Turnstile bindings are present.
  if (!isTurnstileEnabled(env)) return { ok: true };
  const token = String(input?.turnstileToken || request.headers.get("X-Turnstile-Token") || "").trim();
  if (!token) return { ok: false, status: 403, error: "Güvenlik doğrulaması gerekli. Lütfen tekrar dene." };

  try {
    // The visitor IP is optional. Omitting it avoids a false mismatch when the
    // visitor is behind a mobile carrier, VPN, or another reverse proxy.
    const body = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
    });
    const response = await fetchExternal(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    }, { operation: "turnstile-verify" });
    const result = await safeJson(response);
    if (!response.ok || !result?.success) {
      const errorCodes = Array.isArray(result?.["error-codes"])
        ? result["error-codes"].map((code) => String(code)).join(", ")
        : "unknown";
      logSecurityEvent("turnstile_rejected", { errorCodes });
      const messages = {
        "invalid-input-secret": "Sunucudaki Turnstile gizli anahtarı bu doğrulama kutusuyla eşleşmiyor. Yönetici ayarını güncellemelidir.",
        "missing-input-secret": "Turnstile gizli anahtarı sunucuda bulunamadı.",
        "invalid-input-response": "Güvenlik kodu geçerli değil. Sayfayı yenileyip tekrar dene.",
        "missing-input-response": "Güvenlik kodu alınamadı. Lütfen tekrar dene.",
        "timeout-or-duplicate": "Güvenlik kodunun süresi doldu veya daha önce kullanıldı. Sayfayı yenileyip tekrar dene.",
        "bad-request": "Güvenlik doğrulama isteği geçersiz bulundu. Sayfayı yenileyip tekrar dene.",
        "internal-error": "Güvenlik doğrulama servisi geçici olarak yanıt veremedi. Lütfen tekrar dene.",
      };
      const firstCode = errorCodes.split(",")[0].trim();
      // The code is intentionally shown only after a failed verification. It
      // contains no token or secret and makes a wrong dashboard configuration
      // (such as an unrelated secret key) diagnosable from the browser.
      const fallback = errorCodes !== "unknown"
        ? `Güvenlik doğrulaması tamamlanamadı. Hata kodu: ${errorCodes}.`
        : "Güvenlik doğrulaması tamamlanamadı. Turnstile yanıtı hata kodu içermedi.";
      return { ok: false, status: 403, error: messages[firstCode] || fallback };
    }
    return { ok: true };
  } catch (error) {
    logSecurityEvent("turnstile_verification_unavailable", { reason: error?.code || error?.name || "unknown" });
    return { ok: false, status: 503, error: "Güvenlik doğrulama servisine şu anda ulaşılamıyor. Lütfen tekrar dene." };
  }
}

async function beginOAuthFromBrowser(request, env, provider, purpose, mode) {
  const remember = new URL(request.url).searchParams.get("remember") === "1";
  if (!isTurnstileEnabled(env)) {
    const linkUserId = provider === "kick" && purpose === "connection"
      ? (await readUserSession(request, env))?.session?.user?.id || null
      : null;
    const authorizeUrl = provider === "kick"
      ? await beginKickLogin(env, purpose, mode, linkUserId, remember)
      : await beginGoogleLogin(env, mode, remember);
    return Response.redirect(authorizeUrl, 302);
  }
  return turnstileOAuthPage(provider, purpose, mode, env, remember);
}

async function beginProtectedOAuth(request, env) {
  const input = await requestJson(request);
  const verification = await verifyTurnstile(input, request, env);
  if (!verification.ok) return apiResponse(request, { error: verification.error }, verification.status);
  const provider = String(input.provider || "").toLowerCase();
  const purpose = input.purpose === "connection" ? "connection" : "account";
  const mode = input.mode === "login" ? "login" : "register";
  const remember = input.remember === true || input.remember === "1";
  if (!['google', 'kick'].includes(provider)) {
    return apiResponse(request, { error: "Geçersiz giriş sağlayıcısı." }, 400);
  }
  const linkUserId = provider === "kick" && purpose === "connection"
    ? (await readUserSession(request, env))?.session?.user?.id || null
    : null;
  const authorizeUrl = provider === "kick"
    ? await beginKickLogin(env, purpose, mode, linkUserId, remember)
    : await beginGoogleLogin(env, mode, remember);
  return apiResponse(request, { ok: true, authorizeUrl });
}

async function continueProtectedOAuthInBrowser(request, env) {
  let input = {};
  try {
    const form = await request.formData();
    input = {
      provider: String(form.get("provider") || ""),
      purpose: String(form.get("purpose") || "account"),
      mode: String(form.get("mode") || "register"),
      remember: String(form.get("remember") || "0"),
      // Turnstile also injects cf-turnstile-response into forms.  Prefer the
      // value we set in the success callback, then use that native field.
      turnstileToken: String(form.get("turnstileToken") || form.get("cf-turnstile-response") || ""),
    };
  } catch {
    return oauthFailurePage("Güvenlik kontrolü okunamadı. Sayfayı yenileyip tekrar dene.");
  }

  const provider = String(input.provider || "").toLowerCase();
  const purpose = input.purpose === "connection" ? "connection" : "account";
  const mode = input.mode === "login" ? "login" : "register";
  const remember = input.remember === "1";
  if (!["google", "kick"].includes(provider)) {
    return oauthFailurePage("Geçersiz giriş sağlayıcısı. Play Streamers sayfasından tekrar dene.");
  }

  const verification = await verifyTurnstile(input, request, env);
  if (!verification.ok) return oauthFailurePage(verification.error, provider, mode, purpose);

  try {
    const linkUserId = provider === "kick" && purpose === "connection"
      ? (await readUserSession(request, env))?.session?.user?.id || null
      : null;
    const authorizeUrl = provider === "kick"
      ? await beginKickLogin(env, purpose, mode, linkUserId, remember)
      : await beginGoogleLogin(env, mode, remember);
    return Response.redirect(authorizeUrl, 302);
  } catch (error) {
    logSecurityEvent("oauth_browser_preparation_failed", { provider, reason: error?.code || error?.name || "unknown" });
    return oauthFailurePage("Giriş bağlantısı hazırlanamadı. Lütfen kısa süre sonra tekrar dene.", provider, mode, purpose);
  }
}

function oauthFailurePage(message, provider = "google", mode = "register", purpose = "account") {
  const safeProvider = provider === "kick" ? "kick" : "google";
  const safePurpose = purpose === "connection" ? "connection" : "account";
  const safeMode = mode === "login" ? "login" : "register";
  const retryUrl = `/auth/${safeProvider}/${safePurpose === "connection" && safeProvider === "kick" ? "login" : safeProvider === "kick" ? "account-login" : "login"}?mode=${safeMode}`;
  const safeMessage = String(message || "İşlem tamamlanamadı.").replace(/[<>&"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[character]));
  return new Response(`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Play Streamers güvenlik kontrolü</title><body style="margin:0;display:grid;min-height:100vh;place-items:center;padding:20px;background:radial-gradient(circle at 80% 0,#202020,transparent 38%),#050505;color:#f5f5f2;font-family:'Segoe UI',Arial,sans-serif"><main style="width:min(440px,calc(100vw - 40px));padding:34px;border:1px solid #ffffff38;border-radius:24px;background:linear-gradient(145deg,#191919f2,#090909f5);box-shadow:0 28px 90px #000b,inset 0 1px 0 #ffffff16"><b style="color:#f5f5f2;letter-spacing:.16em;font:900 11px/1 'Courier New',monospace">PLAY STREAMERS · GÜVENLİK</b><h1 style="font-size:28px;letter-spacing:-.04em;margin:18px 0 10px">Giriş bağlantısı hazırlanamadı</h1><p style="color:#bdbdb8;line-height:1.65">${safeMessage}</p><a href="${retryUrl}" style="display:inline-block;margin-top:12px;padding:13px 17px;border:1px solid #fff;border-radius:11px;background:#f5f5f2;color:#070707;font-weight:850;text-decoration:none">Tekrar dene</a></main></body></html>`, { headers: workerPageHeaders() });
}

function legacyTurnstileOAuthPage(provider, purpose, mode, env) {
  const safeProvider = provider === "kick" ? "Kick" : "Google";
  const payload = JSON.stringify({ provider, purpose, mode });
  const siteKey = String(env.TURNSTILE_SITE_KEY || "").replace(/[<>&"']/g, "");
  return new Response(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Play Streamers güvenlik kontrolü</title><script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script></head><body style="margin:0;display:grid;min-height:100vh;place-items:center;padding:20px;background:radial-gradient(circle at 80% 0,#202020,transparent 38%),#050505;color:#f5f5f2;font-family:'Segoe UI',Arial,sans-serif"><main style="width:min(440px,calc(100vw - 40px));padding:34px;border:1px solid #ffffff38;border-radius:24px;background:linear-gradient(145deg,#191919f2,#090909f5);box-shadow:0 28px 90px #000b,inset 0 1px 0 #ffffff16"><b style="color:#f5f5f2;letter-spacing:.16em;font:900 11px/1 'Courier New',monospace">PLAY STREAMERS · GÜVENLİK</b><h1 style="font-size:28px;letter-spacing:-.04em;margin:18px 0 10px">Kısa bir güvenlik kontrolü</h1><p style="color:#bdbdb8;line-height:1.65">${safeProvider} bağlantısını başlatmadan önce gerçek bir ziyaretçi olduğunu doğruluyoruz.</p><div id="turnstile" style="min-height:65px;margin:22px 0;border:1px solid #ffffff20;border-radius:15px;padding:12px;background:#ffffff08"></div><p id="status" style="min-height:20px;color:#bdbdb8"></p></main><script>const payload=${payload};const status=document.getElementById('status');function start(token){status.textContent='Bağlantı hazırlanıyor...';fetch('/api/auth/oauth/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...payload,turnstileToken:token})}).then(async r=>({ok:r.ok,data:await r.json().catch(()=>({}))})).then(({ok,data})=>{if(!ok)throw new Error(data.error||'Güvenlik doğrulaması tamamlanamadı.');location.replace(data.authorizeUrl)}).catch(e=>{status.textContent=e.message||'İşlem tamamlanamadı. Lütfen sayfayı yenile.';window.turnstile?.reset()})}let turnstileRendered=false;let turnstileAttempts=0;function renderTurnstile(){if(turnstileRendered)return;if(window.turnstile&&typeof window.turnstile.render==='function'){turnstileRendered=true;window.turnstile.render('#turnstile',{sitekey:'${siteKey}',theme:'dark',callback:start,'error-callback':()=>{status.textContent='Güvenlik kontrolü yüklenemedi. Lütfen tekrar dene.';turnstileRendered=false}});return}if(turnstileAttempts++<80){setTimeout(renderTurnstile,100)}else{status.textContent='Güvenlik kontrolü yüklenemedi. Lütfen sayfayı yenile.'}}window.addEventListener('load',renderTurnstile);setTimeout(renderTurnstile,100);</script></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

// OAuth doğrulama sayfası statik bir sayfa olduğu için Turnstile'ın implicit
// (otomatik) render yöntemi kullanılır. Bu yöntem, script'in yüklenme anı ile
// render çağrısının yarışmasına bağlı "yüklenemedi" hatasını önler.
function turnstileOAuthPage(provider, purpose, mode, env, remember = false) {
  const safeProvider = provider === "kick" ? "Kick" : "Google";
  const siteKey = String(env.TURNSTILE_SITE_KEY || "").replace(/[<>&"']/g, "");
  return new Response(`<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Play Streamers · Güvenlik doğrulaması</title>
  <meta name="ps-worker-build" content="5.2-sw-bot-premium">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath d='M12 5h40a7 7 0 0 1 7 7v40a7 7 0 0 1-7 7H19L5 48V12a7 7 0 0 1 7-7Z' fill='%23050a08' stroke='%2353fc18' stroke-width='3'/%3E%3Ctext x='32' y='41' text-anchor='middle' fill='%2353fc18' font-family='Arial,sans-serif' font-size='27' font-weight='900'%3EPS%3C/text%3E%3C/svg%3E">
  <link rel="preconnect" href="https://challenges.cloudflare.com" crossorigin>
  <link rel="dns-prefetch" href="//challenges.cloudflare.com">
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" defer fetchpriority="high"></script>
  <style>
    :root{color-scheme:dark;--ink:#f5f5f2;--muted:#adada8;--lime:#f5f5f2;--line:rgba(255,255,255,.16);--panel:rgba(15,15,15,.84)}
    *{box-sizing:border-box}html,body{min-height:100%;margin:0}body{position:relative;display:grid;min-height:100vh;place-items:center;overflow:hidden;padding:28px;color:var(--ink);background:#050505;font-family:"Plus Jakarta Sans","Segoe UI",Arial,sans-serif}
    body:before,body:after{position:fixed;z-index:-2;width:65vmax;height:65vmax;border-radius:50%;content:"";filter:blur(18px);opacity:.72;pointer-events:none}body:before{top:-37vmax;right:-18vmax;background:radial-gradient(circle,rgba(255,255,255,.11),transparent 63%)}body:after{bottom:-42vmax;left:-25vmax;background:radial-gradient(circle,rgba(255,255,255,.055),transparent 62%)}
    .grid{position:fixed;z-index:-1;inset:0;opacity:.3;background-image:radial-gradient(circle,#fff 0 1px,transparent 1.5px),linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:127px 143px,48px 48px,48px 48px;mask-image:radial-gradient(circle at 50% 48%,black,transparent 78%);pointer-events:none;animation:worker-stars 12s linear infinite}
    @keyframes worker-stars{to{background-position:127px 143px,48px 48px,48px 48px}}
    .halo{position:absolute;top:50%;left:50%;z-index:-1;width:min(720px,82vw);height:min(720px,82vw);border:1px solid rgba(255,255,255,.11);transform:translate(-50%,-50%) rotate(45deg);box-shadow:0 0 0 44px rgba(255,255,255,.018),0 0 0 90px rgba(255,255,255,.012);animation:worker-orbit 25s linear infinite}@keyframes worker-orbit{to{transform:translate(-50%,-50%) rotate(405deg)}}
    .card{width:min(506px,100%);overflow:hidden;border:1px solid rgba(255,255,255,.28);border-radius:24px;padding:clamp(23px,5vw,40px);background:linear-gradient(142deg,rgba(25,25,25,.94),rgba(8,8,8,.9) 67%,rgba(17,17,17,.9));box-shadow:0 32px 95px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.1);backdrop-filter:blur(28px) saturate(125%);-webkit-backdrop-filter:blur(28px) saturate(125%)}
    .top{display:flex;align-items:center;justify-content:space-between;gap:12px}.brand{display:flex;align-items:center;gap:10px;color:#f5f5f2;font:900 11px/1 "Courier New",monospace;letter-spacing:.14em}.brand-mark{position:relative;display:grid;place-items:center;width:42px;height:42px;overflow:hidden;clip-path:polygon(20% 0,76% 0,100% 24%,100% 76%,76% 100%,20% 100%,0 80%,0 20%);color:#050505;background:linear-gradient(145deg,#fff,#8e8e8b);box-shadow:none;font-size:0}.brand-mark:after{position:absolute;inset:3px;display:grid;place-items:center;clip-path:inherit;color:#f5f5f2;background:#080808;content:"PS";font:900 20px/1 Inter,"Segoe UI",Arial,sans-serif;letter-spacing:-.14em}.secure{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:7px 9px;color:#c8c8c4;background:rgba(255,255,255,.035);font:800 9px/1 "Courier New",monospace;letter-spacing:.1em}.secure i{display:block;width:6px;height:6px;border-radius:50%;background:var(--lime);box-shadow:0 0 11px rgba(255,255,255,.55)}
    .symbol{display:grid;place-items:center;width:58px;height:58px;margin:29px 0 18px;border:1px solid rgba(255,255,255,.28);border-radius:16px;color:var(--lime);background:linear-gradient(145deg,rgba(255,255,255,.1),rgba(255,255,255,.025));box-shadow:inset 0 0 24px rgba(255,255,255,.045)}.symbol svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .eyebrow{margin:0 0 9px;color:#f5f5f2;font:900 10px/1.2 "Courier New",monospace;letter-spacing:.17em}.card h1{max-width:390px;margin:0;color:#f5f5f2;font:800 clamp(28px,5vw,38px)/1.08 "Plus Jakarta Sans","Segoe UI",sans-serif;letter-spacing:-.045em}.copy{max-width:406px;margin:15px 0 0;color:var(--muted);font:500 14px/1.65 "Plus Jakarta Sans","Segoe UI",sans-serif}
    .challenge{margin-top:25px;border:1px solid var(--line);border-radius:17px;padding:14px;background:rgba(255,255,255,.025);box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}.challenge-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:11px;color:#dededa;font:800 11px/1 "Plus Jakarta Sans","Segoe UI",sans-serif}.challenge-head span:first-child{display:flex;align-items:center;gap:8px}.challenge-head span:first-child:before{display:block;width:7px;height:7px;border-radius:50%;background:var(--lime);box-shadow:0 0 12px rgba(255,255,255,.55);content:""}.challenge-label{border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:5px 7px;color:#dededa;background:rgba(255,255,255,.045);font:800 8px/1 "Courier New",monospace;letter-spacing:.09em}.cf-turnstile{display:flex;min-height:65px;justify-content:center;overflow:hidden;border-radius:10px}
    #status{min-height:20px;margin:15px 2px 0;color:#bdbdb8;font:600 12px/1.5 "Plus Jakarta Sans","Segoe UI",sans-serif}#status[data-state="working"]{color:#fff}#status[data-state="error"]{color:#ffb5bc}.fine-print{margin:15px 2px 0;color:#777774;font:500 10px/1.55 "Plus Jakarta Sans","Segoe UI",sans-serif}
    @media(max-width:480px){body{padding:16px}.card{border-radius:24px;padding:25px 22px}.secure{font-size:8px}.symbol{margin-top:24px}.card h1{font-size:30px}.copy{font-size:13px}.challenge{padding:12px 8px}.cf-turnstile{justify-content:flex-start;transform:scale(.94);transform-origin:left center;width:106.4%}}
  </style>
</head>
<body>
  <div class="grid"></div><div class="halo"></div>
  <main class="card" aria-labelledby="verification-title">
    <header class="top"><div class="brand"><span class="brand-mark">PS</span><span>PLAY STREAMERS</span></div><span class="secure"><i></i>GÜVENLİ BAĞLANTI</span></header>
    <div class="symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.5 19 6v5.5c0 4.4-3 7.9-7 9-4-1.1-7-4.6-7-9V6l7-2.5Z"/><path d="m8.8 11.8 2.1 2.1 4.5-4.5"/></svg></div>
    <p class="eyebrow">KISA BİR GÜVENLİK KONTROLÜ</p>
    <h1 id="verification-title">Devam etmeden önce<br>kısaca doğrulayalım.</h1>
    <p class="copy">${safeProvider} bağlantısını güvenle başlatabilmek için gerçek bir ziyaretçi olduğunu doğruluyoruz. Bu işlem yalnızca birkaç saniye sürer.</p>
    <form id="oauth-form" method="post" action="/auth/oauth/continue">
      <input type="hidden" name="provider" value="${provider}">
      <input type="hidden" name="purpose" value="${purpose}">
      <input type="hidden" name="mode" value="${mode}">
      <input type="hidden" name="remember" value="${remember ? "1" : "0"}">
      <input id="turnstile-token" type="hidden" name="turnstileToken" value="">
      <section class="challenge" aria-label="Güvenlik doğrulaması"><div class="challenge-head"><span>Doğrulama</span><span class="challenge-label">KORUMALI</span></div><div class="cf-turnstile" data-sitekey="${siteKey}" data-theme="dark" data-callback="psTurnstileStart" data-error-callback="psTurnstileError" data-unsupported-callback="psTurnstileUnsupported"></div></section>
    </form>
    <p id="status" aria-live="polite">Güvenlik kontrolü hazırlanıyor...</p>
    <p class="fine-print">Bu doğrulama Play Streamers hesabını ve bağlantılarını otomatik isteklerden korur.</p>
  </main>
  <script>
    const status=document.getElementById('status');
    const form=document.getElementById('oauth-form');
    const tokenField=document.getElementById('turnstile-token');
    let completed=false;
    window.psTurnstileStart=async function(token){
      if(completed)return;
      completed=true;
      tokenField.value=token;
      status.textContent='Bağlantı hazırlanıyor...';
      status.dataset.state='working';
      // Form navigation avoids an extra JavaScript fetch between a successful
      // Turnstile result and the OAuth redirect. It is more resilient to
      // browser privacy extensions and proxy-injected non-JSON responses.
      form.requestSubmit();
    };
    window.psTurnstileError=function(code){completed=false;status.dataset.state='error';status.textContent='Güvenlik kontrolü tamamlanamadı. Lütfen tekrar dene.'+(code?' ('+code+')':'');};
    window.psTurnstileUnsupported=function(){status.dataset.state='error';status.textContent='Bu tarayıcı güvenlik kontrolünü desteklemiyor. Güncel bir tarayıcıyla tekrar dene.';};
    // Do not inspect Turnstile's iframe after it has rendered. The challenge
    // can live inside a shadow tree, so a document query can incorrectly say
    // it is missing and overwrite a genuine success message after 20 seconds.
  </script>
</body>
</html>`, { headers: workerPageHeaders() });
}

async function beginKickLogin(env, purpose = "connection", mode = "register", linkUserId = null, remember = false) {
  requireKickConfiguration(env);

  const state = randomBase64Url(32);
  const verifier = randomBase64Url(64);
  const challenge = await sha256Base64Url(verifier);

  await saveOAuthState("kick", state, {
    verifier,
    purpose,
    mode: mode === "login" ? "login" : "register",
    remember: Boolean(remember),
    linkUserId: purpose === "connection" && linkUserId ? String(linkUserId) : null,
    createdAt: Date.now(),
  }, env);

  const authorizeUrl = new URL(`${KICK_OAUTH}/oauth/authorize`);
  authorizeUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: env.KICK_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: KICK_SCOPES,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  }).toString();

  return authorizeUrl.toString();
}

async function finishKickLogin(request, url, env) {
  requireKickConfiguration(env);

  if (url.searchParams.get("error")) {
    return htmlPage("Kick bağlantısı iptal edildi", "Kick hesabına erişim izni verilmedi.", false);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return htmlPage("Bağlantı tamamlanamadı", "Kick doğrulama bilgisi eksik geldi.", false);
  }

  const savedState = await consumeOAuthState("kick", state, env);
  if (!savedState) {
    return htmlPage("Bağlantı süresi doldu", "Lütfen Play Streamers sayfasından tekrar giriş yap.", false);
  }

  const { verifier } = savedState;
  const tokenResponse = await fetchExternal(`${KICK_OAUTH}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env.KICK_CLIENT_ID,
      client_secret: env.KICK_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      code,
    }),
  }, { operation: "kick-token-exchange", timeoutMs: 10_000 });

  const token = await safeJson(tokenResponse);
  if (!tokenResponse.ok || !token?.access_token || !token?.refresh_token) {
    logSecurityEvent("kick_token_exchange_rejected", { status: tokenResponse.status });
    return htmlPage("Bağlantı tamamlanamadı", "Kick erişim anahtarı oluşturulamadı. Tekrar dene.", false);
  }

  const account = await getKickAccount(token.access_token);
  if (savedState.purpose === "account") {
    try {
      if (!account?.id) throw new Error("Kick account details were missing");
      await ensureUsersSchema(env);
      let user = await getUserByKickId(String(account.id), env);
      if (!user && savedState.mode === "login") {
        return htmlPage("Hesap bulunamadı", "Bu Kick hesabıyla oluşturulmuş bir Play Streamers hesabı yok. Kayıt ol seçeneğini kullanarak yeni hesap açabilirsin.", false);
      }
      if (!user) user = await upsertKickUser(account, env);
      const kickSessionId = randomBase64Url(48);
      const expiresIn = Math.max(Number(token.expires_in) || 0, 60);
      const kickSession = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + expiresIn * 1000,
        scopes: String(token.scope || "").split(" ").filter(Boolean),
        account,
        userId: user.id,
        createdAt: Date.now(),
      };
      // Subscriptions are registered per connected Kick broadcaster. This is
      // safe to repeat; existing events are left untouched.
      const subscription = await ensureKickEventSubscriptions(kickSession, env);
      kickSession.subscriptionVersion = subscription.ok ? KICK_SUBSCRIPTION_VERSION : 0;
      await saveKickSession(kickSessionId, kickSession, env);
      const remember = savedState.remember === true;
      const trusted = remember && await hasTrustedTwoFactorDevice(request, user.id, env);
      const challenge = trusted ? { required: false } : await createLoginTwoFactorChallenge(user.id, env, {
        provider: "kick",
        kickAccountSession: kickSessionId,
        remember,
      });
      if (challenge.required) {
        if (challenge.error) return htmlPage("Giriş tamamlanamadı", challenge.error, false);
        const resultUrl = new URL(FRONTEND_URL);
        resultUrl.hash = new URLSearchParams({
          two_factor_required: "1",
          challenge_id: challenge.challengeId,
          oauth_provider: "kick",
        }).toString();
        return Response.redirect(resultUrl.toString(), 302);
      }
      const userSessionId = await createUserSession(user, env);
      const resultUrl = new URL(FRONTEND_URL);
      resultUrl.hash = new URLSearchParams({
        kick_account_connected: "1",
        user_session: userSessionId,
        kick_account_session: kickSessionId,
      }).toString();
      return redirectWithUserSession(resultUrl.toString(), userSessionId);
    } catch (error) {
      logSecurityEvent("kick_account_login_failed", { reason: error?.code || error?.name || "unknown" });
      return htmlPage("Giriş tamamlanamadı", "Kick hesabın doğrulanamadı. Lütfen tekrar dene.", false);
    }
  }

  let linkedUserId = null;
  if (savedState.purpose === "connection" && savedState.linkUserId) {
    try {
      if (!account?.id) throw new Error("Kick account details were missing");
      await ensureUsersSchema(env);
      const siteUser = await getUserById(String(savedState.linkUserId), env);
      if (!siteUser) {
        return htmlPage("Oturum sona erdi", "Kick hesabını bağlamak için Play Streamers hesabına yeniden giriş yap.", false);
      }
      const existingLink = await getUserByKickId(String(account.id), env);
      const now = new Date().toISOString();
      const kickUsername = String(account.username || "Kick kullanıcısı").trim().slice(0, 120) || "Kick kullanıcısı";
      const kickUserId = String(account.id);
      const statements = [
        env.DB.prepare(`DELETE FROM kick_refresh_locks WHERE session_id IN
          (SELECT id FROM kick_sessions WHERE user_id = ?1 OR CAST(json_extract(account_json, '$.id') AS TEXT) = ?2)`)
          .bind(siteUser.id, kickUserId),
        env.DB.prepare("DELETE FROM kick_sessions WHERE user_id = ?1 OR CAST(json_extract(account_json, '$.id') AS TEXT) = ?2")
          .bind(siteUser.id, kickUserId),
      ];
      if (existingLink && existingLink.id !== siteUser.id) {
        /* OAuth dönüşündeki Kick hesabının sahibi doğrulanmıştır. Önceki
           Play Streamers kaydı artık kullanılamayan/eski bir eşleşmeyse bu
           doğrulanmış hesap güvenli biçimde yeni kullanıcıya taşınır. */
        statements.push(
          env.DB.prepare(`DELETE FROM kick_refresh_locks WHERE session_id IN
            (SELECT id FROM kick_sessions WHERE user_id = ?1)`).bind(existingLink.id),
          env.DB.prepare("DELETE FROM kick_sessions WHERE user_id = ?1").bind(existingLink.id),
          env.DB.prepare("UPDATE users SET kick_user_id = NULL, kick_username = NULL, updated_at = ?1 WHERE id = ?2")
            .bind(now, existingLink.id),
        );
      }
      statements.push(
        env.DB.prepare("UPDATE users SET kick_user_id = ?1, kick_username = ?2, updated_at = ?3 WHERE id = ?4")
          .bind(kickUserId, kickUsername, now, siteUser.id),
      );
      await env.DB.batch(statements);
      if (existingLink && existingLink.id !== siteUser.id) {
        logSecurityEvent("kick_account_reassigned", { verifiedByOAuth: true });
      }
      linkedUserId = siteUser.id;
    } catch (error) {
      logSecurityEvent("kick_account_link_failed", { reason: error?.code || error?.name || "unknown" });
      return htmlPage("Bağlantı tamamlanamadı", "Kick hesabı mevcut hesabına bağlanamadı. Lütfen tekrar dene.", false);
    }
  }
  const sessionId = randomBase64Url(48);
  const expiresIn = Math.max(Number(token.expires_in) || 0, 60);
  const session = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + expiresIn * 1000,
    scopes: String(token.scope || "").split(" ").filter(Boolean),
    account,
    userId: linkedUserId,
    createdAt: Date.now(),
  };

  const subscription = await ensureKickEventSubscriptions(session, env);
  session.subscriptionVersion = subscription.ok ? KICK_SUBSCRIPTION_VERSION : 0;
  await saveKickSession(sessionId, session, env);

  // The random session ID is passed only once in the URL fragment. Fragments are
  // not sent to GitHub Pages. The browser app removes it immediately after saving.
  const resultUrl = new URL(FRONTEND_URL);
  resultUrl.hash = new URLSearchParams({
    kick_connected: "1",
    kick_session: sessionId,
  }).toString();
  return Response.redirect(resultUrl.toString(), 302);
}

async function readSession(request, env) {
  requireKickConfiguration(env);
  const sessionId = getBearerToken(request);
  if (!sessionId) return null;

  const session = await getKickSession(sessionId, env);
  if (!session) return null;

  if (Date.now() >= Number(session.expiresAt) - 60_000) {
    return refreshKickSessionSafely(sessionId, env);
  }

  return { sessionId, session };
}

// A refresh token is single-use on many OAuth providers.  Two simultaneous
// dashboard requests must therefore never refresh the same Kick session at
// the same time.  The short D1 lock lets the first request refresh while the
// others wait for its saved result.
async function refreshKickSessionSafely(sessionId, env, allowRetry = true) {
  const acquired = await acquireKickRefreshLock(sessionId, env);
  if (!acquired) {
    const deadline = Date.now() + KICK_REFRESH_WAIT_MS;
    while (Date.now() < deadline) {
      await wait(200);
      const latest = await getKickSession(sessionId, env);
      if (latest && Date.now() < Number(latest.expiresAt) - 60_000) {
        return { sessionId, session: latest };
      }
    }
    if (allowRetry) return refreshKickSessionSafely(sessionId, env, false);
    throw new Error("Kick session refresh is already in progress");
  }

  try {
    const latest = await getKickSession(sessionId, env);
    if (!latest) return null;
    if (Date.now() < Number(latest.expiresAt) - 60_000) {
      return { sessionId, session: latest };
    }
    const refreshed = await refreshKickToken(latest, env);
    await saveKickSession(sessionId, refreshed, env);
    logSecurityEvent("kick_token_refreshed");
    return { sessionId, session: refreshed };
  } finally {
    await releaseKickRefreshLock(sessionId, env);
  }
}

async function beginGoogleLogin(env, mode = "register", remember = false) {
  requireGoogleConfiguration(env);

  const state = randomBase64Url(32);
  const verifier = randomBase64Url(64);
  const nonce = randomBase64Url(32);
  const challenge = await sha256Base64Url(verifier);

  await saveOAuthState("google", state, {
    verifier,
    nonce,
    mode: mode === "login" ? "login" : "register",
    remember: Boolean(remember),
    createdAt: Date.now(),
  }, env);

  const authorizeUrl = new URL(GOOGLE_AUTHORIZE);
  authorizeUrl.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  return authorizeUrl.toString();
}

async function finishGoogleLogin(request, url, env) {
  requireGoogleConfiguration(env);

  if (url.searchParams.get("error")) {
    return htmlPage("Google girişi iptal edildi", "Hesabına erişim izni verilmedi.", false);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return htmlPage("Giriş tamamlanamadı", "Google doğrulama bilgisi eksik geldi.", false);
  }

  const saved = await consumeOAuthState("google", state, env);
  if (!saved) {
    return htmlPage("Giriş süresi doldu", "Lütfen Play Streamers sayfasından tekrar giriş yap.", false);
  }

  try {
    const { verifier, nonce, mode = "register" } = saved;
    const tokenResponse = await fetchExternal(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    }, { operation: "google-token-exchange", timeoutMs: 10_000 });
    const token = await safeJson(tokenResponse);
    if (!tokenResponse.ok || !token?.id_token) {
      logSecurityEvent("google_token_exchange_rejected", { status: tokenResponse.status });
      return htmlPage("Giriş tamamlanamadı", "Google oturum bilgisi oluşturulamadı. Tekrar dene.", false);
    }

    const googleUser = await verifyGoogleIdToken(token.id_token, env, nonce);
    await ensureUsersSchema(env);
    let user = await getUserByGoogleIdentity(googleUser.sub, googleUser.email, env);
    if (!user && mode === "login") {
      return htmlPage("Hesap bulunamadı", "Bu Google hesabıyla oluşturulmuş bir Play Streamers hesabı yok. Kayıt ol seçeneğini kullanarak yeni hesap açabilirsin.", false);
    }
    if (!user) user = await upsertGoogleUser(googleUser, env);
    const remember = saved.remember === true;
    const trusted = remember && await hasTrustedTwoFactorDevice(request, user.id, env);
    const challenge = trusted ? { required: false } : await createLoginTwoFactorChallenge(user.id, env, {
      provider: "google",
      remember,
    });
    if (challenge.required) {
      if (challenge.error) return htmlPage("Giriş tamamlanamadı", challenge.error, false);
      const resultUrl = new URL(FRONTEND_URL);
      resultUrl.hash = new URLSearchParams({
        two_factor_required: "1",
        challenge_id: challenge.challengeId,
        oauth_provider: "google",
      }).toString();
      return Response.redirect(resultUrl.toString(), 302);
    }
    const sessionId = await createUserSession(user, env);

    // The token is returned once in the URL fragment, which is never sent to GitHub Pages.
    const resultUrl = new URL(FRONTEND_URL);
    resultUrl.hash = new URLSearchParams({
      google_connected: "1",
      user_session: sessionId,
    }).toString();
    return redirectWithUserSession(resultUrl.toString(), sessionId);
  } catch (error) {
    logSecurityEvent("google_login_failed", { reason: error?.code || error?.name || "unknown" });
    return htmlPage("Giriş tamamlanamadı", "Google hesabın güvenli şekilde doğrulanamadı. Tekrar dene.", false);
  }
}

async function readUserSession(request, env) {
  requireAccountConfiguration(env);
  const sessionId = getBearerToken(request);
  if (!sessionId) return null;

  await ensureUsersSchema(env);
  const row = await env.DB.prepare(`SELECT user_id, session_version, expires_at, created_at
    FROM user_sessions WHERE id = ?1 LIMIT 1`).bind(sessionId).first();
  if (!row) return null;

  const session = {
    userId: String(row.user_id || ""),
    sessionVersion: Number(row.session_version || 1),
    expiresAt: Number(row.expires_at || 0),
    createdAt: Number(row.created_at || 0),
  };
  if (!session.userId || Date.now() >= session.expiresAt) {
    await deleteUserSession(sessionId, env);
    return null;
  }
  const currentVersion = await getUserSessionVersion(session.userId, env);
  if (session.sessionVersion !== currentVersion) {
    await deleteUserSession(sessionId, env);
    return null;
  }
  return { sessionId, session: { ...session, user: { id: session.userId } } };
}

async function readSiteActivity(request, env) {
  const origin = request.headers.get("Origin");
  if (origin && !ALLOWED_FRONTEND_ORIGINS.has(origin)) {
    return apiResponse(request, { error: "Bu istek izin verilen site kaynağından gelmiyor." }, 403);
  }
  await ensureUsersSchema(env);
  const now = Date.now();
  const counts = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM site_visitors) AS total_visitors,
      (SELECT COUNT(*) FROM users WHERE username IS NOT NULL AND trim(username) <> '') AS registered_users,
      (SELECT COUNT(DISTINCT CASE
        WHEN user_id IS NOT NULL THEN 'user:' || user_id
        ELSE 'visitor:' || visitor_hash
      END) FROM site_visitors WHERE last_seen_at >= ?1) AS active_users`)
    .bind(now - SITE_ACTIVITY_ACTIVE_WINDOW_MS)
    .first();
  return apiResponse(request, {
    ok: true,
    totalVisitors: Number(counts?.total_visitors || 0),
    registeredUsers: Number(counts?.registered_users || 0),
    activeUsers: Number(counts?.active_users || 0),
    updatedAt: new Date(now).toISOString(),
    activeWindowSeconds: Math.floor(SITE_ACTIVITY_ACTIVE_WINDOW_MS / 1000),
    snapshot: true,
  });
}

async function updateSiteActivity(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || !ALLOWED_FRONTEND_ORIGINS.has(origin)) {
    return apiResponse(request, { error: "Bu istek izin verilen site kaynağından gelmiyor." }, 403);
  }
  await ensureUsersSchema(env);
  const input = await requestJson(request);
  const visitorId = String(input.visitorId || "").trim();
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(visitorId)) {
    return apiResponse(request, { error: "Ziyaretçi kimliği geçersiz." }, 400);
  }

  let userId = null;
  if (getBearerToken(request)) {
    const current = await readUserSession(request, env);
    userId = current?.session?.user?.id || null;
  }
  const visitorHash = await sha256Base64Url(`site-visitor:${visitorId}`);
  const now = Date.now();
  const activityWrite = env.DB.prepare(`INSERT INTO site_visitors
      (visitor_hash, first_seen_at, last_seen_at, user_id, authenticated)
      VALUES (?1, ?2, ?2, ?3, ?4)
      ON CONFLICT(visitor_hash) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        user_id = COALESCE(excluded.user_id, site_visitors.user_id),
        authenticated = MAX(site_visitors.authenticated, excluded.authenticated)
      WHERE site_visitors.last_seen_at <= ?5
        OR (excluded.user_id IS NOT NULL AND site_visitors.user_id IS NOT excluded.user_id)`)
    .bind(visitorHash, now, userId, userId ? 1 : 0, now - SITE_ACTIVITY_WRITE_INTERVAL_MS);
  const activityCounts = env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM site_visitors) AS total_visitors,
      (SELECT COUNT(*) FROM users WHERE username IS NOT NULL AND trim(username) <> '') AS registered_users,
      (SELECT COUNT(DISTINCT CASE
        WHEN user_id IS NOT NULL THEN 'user:' || user_id
        ELSE 'visitor:' || visitor_hash
      END) FROM site_visitors WHERE last_seen_at >= ?1) AS active_users`)
    .bind(now - SITE_ACTIVITY_ACTIVE_WINDOW_MS);
  const [, countResult] = await env.DB.batch([activityWrite, activityCounts]);
  const counts = countResult?.results?.[0] || {};

  return apiResponse(request, {
    ok: true,
    totalVisitors: Number(counts?.total_visitors || 0),
    registeredUsers: Number(counts?.registered_users || 0),
    activeUsers: Number(counts?.active_users || 0),
    updatedAt: new Date(now).toISOString(),
    activeWindowSeconds: Math.floor(SITE_ACTIVITY_ACTIVE_WINDOW_MS / 1000),
  });
}

function desktopRequestOriginAllowed(request) {
  const origin = request.headers.get("Origin");
  return !origin || ALLOWED_DESKTOP_ORIGINS.has(origin) || ALLOWED_FRONTEND_ORIGINS.has(origin);
}

function normalizePlanTier(value) {
  return Object.prototype.hasOwnProperty.call(PLAN_TIER_RANK, value) ? value : "free";
}

function enabledDesktopFeatures(tier) {
  const rank = PLAN_TIER_RANK[normalizePlanTier(tier)];
  return PLAY_STREAMERS_FEATURES.filter(([, required]) => rank >= PLAN_TIER_RANK[required]).map(([id]) => id);
}

async function desktopEntitlement(userId, env) {
  await ensureUsersSchema(env);
  const row = await env.DB.prepare(`SELECT tier, status, identity_version AS identityVersion,
      expires_at AS expiresAt, synced_at AS syncedAt
    FROM ps_user_entitlements WHERE user_id = ?1 LIMIT 1`).bind(userId).first();
  const expired = row?.expiresAt && Number(row.expiresAt) <= Math.floor(Date.now() / 1000);
  const tier = expired || row?.status !== "active" ? "free" : normalizePlanTier(row?.tier);
  return {
    tier,
    label: tier === "product-pro" ? "Product Pro" : tier === "pro" ? "Pro" : "Free",
    status: expired ? "expired" : row?.status || "active",
    identityVersion: row?.identityVersion || null,
    expiresAt: row?.expiresAt || null,
    syncedAt: row?.syncedAt || null,
  };
}

async function upsertSwIdentityUser(identity, env) {
  const swUserId = String(identity?.id || "").trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(swUserId)) throw new Error("SW_IDENTITY_INVALID_USER");
  const publicEmail = isPublicEmail(identity?.email) ? normalizeEmail(identity.email) : null;
  const displayName = String(identity?.displayName || identity?.username || "SW kullanıcısı").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 120) || "SW kullanıcısı";
  const existing = await env.DB.prepare(`SELECT id, sw_identity_user_id AS swIdentityUserId FROM users
    WHERE sw_identity_user_id = ?1 OR (?2 IS NOT NULL AND email_linked = 1 AND lower(email) = lower(?2))
    LIMIT 1`).bind(swUserId, publicEmail).first();
  const now = new Date().toISOString();
  if (existing) {
    if (existing.swIdentityUserId && existing.swIdentityUserId !== swUserId) throw new Error("SW_IDENTITY_EMAIL_CONFLICT");
    await env.DB.prepare(`UPDATE users SET sw_identity_user_id = ?1,
      display_name = CASE WHEN username IS NULL THEN ?2 ELSE display_name END,
      updated_at = ?3 WHERE id = ?4`).bind(swUserId, displayName, now, existing.id).run();
    return getUserById(existing.id, env);
  }
  const id = randomBase64Url(24);
  const email = publicEmail || `sw-${swUserId.slice(0, 48)}-${id.slice(0, 8)}@local.play-streamers.invalid`;
  await env.DB.prepare(`INSERT INTO users
    (id, google_sub, sw_identity_user_id, email, email_linked, username, display_name, avatar_url, created_at, updated_at)
    VALUES (?1, NULL, ?2, ?3, ?4, NULL, ?5, NULL, ?6, ?6)`)
    .bind(id, swUserId, email, publicEmail ? 1 : 0, displayName, now).run();
  return getUserById(id, env);
}

async function exchangeDesktopSwIdentity(request, env) {
  if (!desktopRequestOriginAllowed(request)) return apiResponse(request, { error: "Masaüstü giriş kaynağı geçersiz." }, 403);
  if (!env.SW_PRODUCT_SSO_SECRET) return apiResponse(request, { error: "SW Identity ürün köprüsü yapılandırılmamış." }, 503);
  await ensureUsersSchema(env);
  const input = await requestJson(request);
  const code = String(input.code || "").trim();
  const redirectUri = String(input.redirectUri || DESKTOP_IDENTITY_REDIRECT).trim();
  if (!/^[a-f0-9]{64}$/i.test(code)) return apiResponse(request, { error: "SW Identity giriş kodu geçersiz." }, 400);
  if (redirectUri !== DESKTOP_IDENTITY_REDIRECT && !WEB_IDENTITY_REDIRECTS.has(redirectUri)) {
    return apiResponse(request, { error: "SW Identity dönüş adresi geçersiz." }, 400);
  }
  const identityResponse = await fetch(`${SW_IDENTITY_ORIGIN}/api/internal/auth/product/exchange`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.SW_PRODUCT_SSO_SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ code, clientId: "play-streamers", redirectUri }),
  });
  const identity = await safeJson(identityResponse);
  if (!identityResponse.ok || !identity?.ok || !identity?.user) {
    return apiResponse(request, { error: identity?.error || "SW Identity giriş kodu doğrulanamadı." }, identityResponse.status === 401 ? 401 : 502);
  }
  let user;
  try {
    user = await upsertSwIdentityUser(identity.user, env);
  } catch (error) {
    if (error?.message === "SW_IDENTITY_EMAIL_CONFLICT") return apiResponse(request, { error: "Bu e-posta başka bir SW Identity hesabına bağlı." }, 409);
    throw error;
  }
  const tier = normalizePlanTier(identity?.product?.tier);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`INSERT INTO ps_user_entitlements
    (user_id, tier, status, identity_version, source, expires_at, synced_at)
    VALUES (?1, ?2, ?3, ?4, 'sw-identity', ?5, ?6)
    ON CONFLICT(user_id) DO UPDATE SET tier = excluded.tier, status = excluded.status,
      identity_version = excluded.identity_version, source = excluded.source,
      expires_at = excluded.expires_at, synced_at = excluded.synced_at`)
    .bind(user.id, tier, identity?.product?.status || "active", identity?.identityVersion || null, identity?.product?.expiresAt || null, now).run();
  const sessionId = await createUserSession(user, env);
  const plan = await desktopEntitlement(user.id, env);
  const payload = {
    ok: true,
    signedIn: true,
    sessionId,
    user,
    plan,
    features: enabledDesktopFeatures(plan.tier),
    identityProvider: "sw-identity",
  };
  return WEB_IDENTITY_REDIRECTS.has(redirectUri)
    ? authenticatedApiResponse(request, payload, 200, sessionId)
    : apiResponse(request, payload);
}

async function desktopPlatformBootstrap(request, env) {
  if (!desktopRequestOriginAllowed(request)) return apiResponse(request, { error: "Masaüstü uygulama kaynağı geçersiz." }, 403);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { signedIn: false }, 401);
  const user = await getUserById(current.session.user.id, env);
  if (!user) return apiResponse(request, { signedIn: false }, 401);
  const plan = await desktopEntitlement(user.id, env);
  const [settingsResult, sessionsResult, monitorResult] = await env.DB.batch([
    env.DB.prepare(`SELECT feature_id AS featureId, value_json AS valueJson, updated_at AS updatedAt
      FROM ps_feature_settings WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 100`).bind(user.id),
    env.DB.prepare(`SELECT id, platform, title, started_at AS startedAt, ended_at AS endedAt,
      peak_viewers AS peakViewers, interactions, followers_gained AS followersGained,
      revenue_minor AS revenueMinor, summary_json AS summaryJson
      FROM ps_stream_sessions WHERE user_id = ?1 ORDER BY started_at DESC LIMIT 12`).bind(user.id),
    env.DB.prepare(`SELECT m.last_checked_at AS lastCheckedAt,
      m.last_subscription_check_at AS lastSubscriptionCheckAt, m.last_error AS lastError,
      r.status, r.session_id AS sessionId, r.last_observed_at AS lastObservedAt,
      s.title, s.started_at AS startedAt, s.peak_viewers AS peakViewers,
      (SELECT viewer_count FROM ps_stream_samples sm WHERE sm.session_id = r.session_id
        ORDER BY sm.sample_minute DESC LIMIT 1) AS currentViewers
      FROM ps_kick_monitor_state m
      LEFT JOIN ps_stream_runtime r ON r.user_id = m.user_id
      LEFT JOIN ps_stream_sessions s ON s.id = r.session_id
      WHERE m.user_id = ?1 LIMIT 1`).bind(user.id),
  ]);
  const monitor = monitorResult?.results?.[0] || null;
  return apiResponse(request, {
    signedIn: true,
    user,
    plan,
    features: enabledDesktopFeatures(plan.tier),
    settings: (settingsResult?.results || []).map(desktopSettingPayload),
    recentSessions: (sessionsResult?.results || []).map(desktopSessionPayload),
    streamMonitor: monitor ? {
      connected: true,
      status: monitor.status || "offline",
      sessionId: monitor.sessionId || null,
      title: monitor.title || "",
      startedAt: monitor.startedAt == null ? null : Number(monitor.startedAt),
      currentViewers: Number(monitor.currentViewers || 0),
      peakViewers: Number(monitor.peakViewers || 0),
      lastCheckedAt: Number(monitor.lastCheckedAt || 0),
      lastObservedAt: Number(monitor.lastObservedAt || 0),
      lastSubscriptionCheckAt: Number(monitor.lastSubscriptionCheckAt || 0),
      healthy: !monitor.lastError,
    } : { connected: false, status: "not-connected", healthy: true },
  });
}

function desktopSettingPayload(row) {
  let value = null;
  try { value = JSON.parse(row?.valueJson || "null"); } catch { value = null; }
  return { featureId: row?.featureId || "", value, updatedAt: Number(row?.updatedAt || 0) };
}

function desktopSessionPayload(row) {
  let summary = null;
  try { summary = row?.summaryJson ? JSON.parse(row.summaryJson) : null; } catch { summary = null; }
  return {
    id: row?.id || "",
    platform: row?.platform || "",
    title: row?.title || "",
    startedAt: Number(row?.startedAt || 0),
    endedAt: row?.endedAt == null ? null : Number(row.endedAt),
    peakViewers: Number(row?.peakViewers || 0),
    interactions: Number(row?.interactions || 0),
    followersGained: Number(row?.followersGained || 0),
    revenueMinor: Number(row?.revenueMinor || 0),
    summary,
  };
}

function validDesktopFeatureId(value) {
  const id = String(value || "").trim();
  return PLAY_STREAMERS_FEATURES.some(([featureId]) => featureId === id) ? id : "";
}

async function desktopFeatureSettings(request, env) {
  if (!desktopRequestOriginAllowed(request)) return apiResponse(request, { error: "Masaüstü uygulama kaynağı geçersiz." }, 403);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const userId = current.session.user.id;
  if (request.method === "GET") {
    const rows = await env.DB.prepare(`SELECT feature_id AS featureId, value_json AS valueJson, updated_at AS updatedAt
      FROM ps_feature_settings WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 100`).bind(userId).all();
    return apiResponse(request, { ok: true, settings: (rows?.results || []).map(desktopSettingPayload) });
  }
  const input = await requestJson(request);
  const featureId = validDesktopFeatureId(input?.featureId);
  if (!featureId) return apiResponse(request, { error: "Özellik kimliği geçersiz." }, 400);
  const plan = await desktopEntitlement(userId, env);
  if (!enabledDesktopFeatures(plan.tier).includes(featureId)) return apiResponse(request, { error: "Bu özellik mevcut planında açık değil." }, 403);
  let valueJson;
  try { valueJson = JSON.stringify(input?.value ?? null); } catch { return apiResponse(request, { error: "Ayar verisi geçersiz." }, 400); }
  if (valueJson.length > 20_000) return apiResponse(request, { error: "Ayar verisi çok büyük." }, 413);
  const updatedAt = Date.now();
  await env.DB.prepare(`INSERT INTO ps_feature_settings (user_id, feature_id, value_json, updated_at)
    VALUES (?1, ?2, ?3, ?4)
    ON CONFLICT(user_id, feature_id) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`)
    .bind(userId, featureId, valueJson, updatedAt).run();
  return apiResponse(request, { ok: true, setting: { featureId, value: input?.value ?? null, updatedAt } });
}

async function desktopStreamSessions(request, env) {
  if (!desktopRequestOriginAllowed(request)) return apiResponse(request, { error: "Masaüstü uygulama kaynağı geçersiz." }, 403);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const userId = current.session.user.id;
  if (request.method === "GET") {
    const rows = await env.DB.prepare(`SELECT id, platform, title, started_at AS startedAt, ended_at AS endedAt,
      peak_viewers AS peakViewers, interactions, followers_gained AS followersGained,
      revenue_minor AS revenueMinor, summary_json AS summaryJson
      FROM ps_stream_sessions WHERE user_id = ?1 ORDER BY started_at DESC LIMIT 50`).bind(userId).all();
    return apiResponse(request, { ok: true, sessions: (rows?.results || []).map(desktopSessionPayload) });
  }
  const input = await requestJson(request);
  const platform = String(input?.platform || "Özel RTMPS").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 40);
  const title = String(input?.title || "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 160);
  if (!platform) return apiResponse(request, { error: "Yayın platformu geçersiz." }, 400);
  const id = crypto.randomUUID();
  const startedAt = Date.now();
  await env.DB.prepare(`INSERT INTO ps_stream_sessions
    (id, user_id, platform, title, started_at, ended_at, peak_viewers, interactions, followers_gained, revenue_minor, summary_json)
    VALUES (?1, ?2, ?3, ?4, ?5, NULL, 0, 0, 0, 0, NULL)`)
    .bind(id, userId, platform, title || null, startedAt).run();
  return apiResponse(request, { ok: true, session: desktopSessionPayload({ id, platform, title, startedAt }) }, 201);
}

async function finishDesktopStreamSession(request, env, sessionId) {
  if (!desktopRequestOriginAllowed(request)) return apiResponse(request, { error: "Masaüstü uygulama kaynağı geçersiz." }, 403);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  let summaryJson = null;
  if (input?.summary != null) {
    try { summaryJson = JSON.stringify(input.summary); } catch { return apiResponse(request, { error: "Yayın özeti geçersiz." }, 400); }
    if (summaryJson.length > 20_000) return apiResponse(request, { error: "Yayın özeti çok büyük." }, 413);
  }
  const endedAt = Date.now();
  const result = await env.DB.prepare(`UPDATE ps_stream_sessions SET ended_at = ?1,
      peak_viewers = ?2, interactions = ?3, followers_gained = ?4, revenue_minor = ?5, summary_json = ?6
    WHERE id = ?7 AND user_id = ?8 AND ended_at IS NULL`)
    .bind(
      endedAt,
      boundedInsightMetric(input?.peakViewers),
      boundedInsightMetric(input?.interactions),
      boundedInsightMetric(input?.followersGained),
      boundedInsightMetric(input?.revenueMinor, 1_000_000_000),
      summaryJson,
      sessionId,
      current.session.user.id,
    ).run();
  if (!Number(result?.meta?.changes || 0)) return apiResponse(request, { error: "Açık yayın oturumu bulunamadı." }, 404);
  return apiResponse(request, { ok: true, id: sessionId, endedAt });
}

async function desktopLiveContext(request, env) {
  if (!desktopRequestOriginAllowed(request)) return apiResponse(request, { error: "Masaüstü uygulama kaynağı geçersiz." }, 403);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const url = new URL(request.url);
  const sessionId = String(url.searchParams.get("sessionId") || "");
  if (!/^[A-Za-z0-9-]{20,64}$/.test(sessionId)) return apiResponse(request, { error: "Yayın oturumu geçersiz." }, 400);
  const session = await env.DB.prepare(`SELECT id, started_at AS startedAt FROM ps_stream_sessions
    WHERE id = ?1 AND user_id = ?2 AND ended_at IS NULL LIMIT 1`)
    .bind(sessionId, current.session.user.id).first();
  if (!session) return apiResponse(request, { error: "Açık yayın oturumu bulunamadı." }, 404);

  const startedAt = Number(session.startedAt || Date.now());
  const startedIso = new Date(startedAt).toISOString();
  const kickRow = await env.DB.prepare(`SELECT id FROM kick_sessions
    WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1`).bind(current.session.user.id).first();
  const kickSession = kickRow?.id ? await getKickSession(String(kickRow.id), env) : null;
  const broadcasterId = String(kickSession?.account?.id || "");
  const [kickResult, donateResult, stream] = await Promise.all([
    broadcasterId
      ? env.DB.prepare(`SELECT event_type AS type, payload_json AS payloadJson, received_at AS receivedAt
          FROM kick_webhook_events WHERE broadcaster_user_id = ?1 AND received_at >= ?2
          ORDER BY received_at DESC LIMIT 2000`).bind(broadcasterId, startedIso).all()
      : Promise.resolve({ results: [] }),
    env.DB.prepare(`SELECT amount_minor AS amountMinor, currency, received_at AS receivedAt
      FROM donate_bridge_events WHERE user_id = ?1 AND received_at >= ?2
      ORDER BY received_at DESC LIMIT 2000`).bind(current.session.user.id, startedAt).all(),
    kickSession ? getKickStreamStatus(kickSession).catch(() => null) : Promise.resolve(null),
  ]);
  const kickEvents = kickResult?.results || [];
  const donateEvents = donateResult?.results || [];
  const now = Date.now();
  const parseReceivedAt = value => {
    const parsed = typeof value === "number" ? value : Date.parse(String(value || ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const eventWeight = row => {
    if (row.type === "channel.subscription.gifts") {
      try {
        const payload = JSON.parse(row.payloadJson || "{}");
        return Math.max(1, Math.min(1000, Number(payload?.giftees?.length || payload?.gifted_subscriptions || 1)));
      } catch { return 1; }
    }
    return 1;
  };
  const followersGained = kickEvents.filter(row => row.type === "channel.followed").reduce((sum, row) => sum + eventWeight(row), 0);
  const subscriptions = kickEvents.filter(row => String(row.type || "").startsWith("channel.subscription") || row.type === "kicks.gifted")
    .reduce((sum, row) => sum + eventWeight(row), 0);
  const revenueByCurrency = donateEvents.reduce((totals, row) => {
    const currency = /^[A-Z]{3}$/.test(String(row.currency || "").toUpperCase()) ? String(row.currency).toUpperCase() : "OTHER";
    totals[currency] = (totals[currency] || 0) + boundedInsightMetric(row.amountMinor, 100_000_000);
    return totals;
  }, {});
  const revenueCurrencies = Object.keys(revenueByCurrency);
  // Farklı para birimleri kur bilgisi olmadan tek bir toplamda birleştirilmez.
  const revenueCurrency = revenueCurrencies.length === 1 ? revenueCurrencies[0] : "";
  const revenueMinor = revenueCurrency ? revenueByCurrency[revenueCurrency] : 0;
  const interactions = kickEvents.reduce((sum, row) => sum + eventWeight(row), 0) + donateEvents.length;
  const currentInteractions = kickEvents.filter(row => parseReceivedAt(row.receivedAt) >= now - 5 * 60_000).reduce((sum, row) => sum + eventWeight(row), 0)
    + donateEvents.filter(row => parseReceivedAt(row.receivedAt) >= now - 5 * 60_000).length;
  const previousInteractions = kickEvents.filter(row => {
    const at = parseReceivedAt(row.receivedAt);
    return at >= now - 10 * 60_000 && at < now - 5 * 60_000;
  }).reduce((sum, row) => sum + eventWeight(row), 0) + donateEvents.filter(row => {
    const at = parseReceivedAt(row.receivedAt);
    return at >= now - 10 * 60_000 && at < now - 5 * 60_000;
  }).length;
  const activeViewers = boundedInsightMetric(stream?.viewer_count ?? stream?.viewerCount ?? stream?.viewers);
  const insight = deterministicInsight({
    current: { minutes: 5, interactions: currentInteractions, activeViewers },
    previous: { minutes: 5, interactions: previousInteractions },
  });
  return apiResponse(request, {
    ok: true,
    sessionId,
    observedAt: now,
    metrics: { activeViewers, interactions, followersGained, subscriptions, revenueMinor, revenueCurrency, revenueByCurrency },
    insight,
    verification: {
      kick: broadcasterId ? "signed-webhook-and-oauth" : "not-connected",
      donations: donateEvents.length ? "play-connect-or-provider" : "no-events",
    },
  });
}

function kickLivestreamPayloadState(payload) {
  const livestream = payload?.livestream && typeof payload.livestream === "object" ? payload.livestream : {};
  const rawLive = payload?.is_live ?? payload?.isLive ?? livestream?.is_live ?? livestream?.isLive;
  const rawStatus = String(payload?.status ?? livestream?.status ?? "").trim().toLowerCase();
  let live = null;
  if (typeof rawLive === "boolean") live = rawLive;
  else if (["live", "started", "online", "active"].includes(rawStatus)) live = true;
  else if (["offline", "ended", "stopped", "inactive"].includes(rawStatus)) live = false;
  const startedAt = Date.parse(String(payload?.started_at ?? payload?.startedAt ?? livestream?.started_at ?? livestream?.startedAt ?? ""));
  const endedAt = Date.parse(String(payload?.ended_at ?? payload?.endedAt ?? livestream?.ended_at ?? livestream?.endedAt ?? ""));
  const viewerCount = boundedInsightMetric(
    payload?.viewer_count ?? payload?.viewerCount ?? payload?.viewers
      ?? livestream?.viewer_count ?? livestream?.viewerCount ?? livestream?.viewers,
  );
  const title = String(payload?.title ?? payload?.session_title ?? livestream?.title ?? livestream?.session_title ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 160);
  return {
    live,
    title,
    viewerCount,
    startedAt: Number.isFinite(startedAt) ? startedAt : null,
    endedAt: Number.isFinite(endedAt) ? endedAt : null,
  };
}

function automaticStreamEventWeight(row) {
  if (String(row?.event_type || row?.type || "") !== "channel.subscription.gifts") return 1;
  try {
    const payload = typeof row?.payload_json === "string" ? JSON.parse(row.payload_json) : row?.payload || {};
    const recipients = payload?.giftees || payload?.recipients || payload?.subscriptions || payload?.gifted_subscriptions || [];
    return Math.max(1, Math.min(1000, Array.isArray(recipients) ? recipients.length : Number(payload?.gifted_subscriptions || 1)));
  } catch {
    return 1;
  }
}

async function latestKnownFollowerCount(userId, env) {
  const row = await env.DB.prepare(`SELECT followers_count FROM kick_metric_hourly
    WHERE user_id = ?1 AND followers_count IS NOT NULL
    ORDER BY metric_hour DESC LIMIT 1`).bind(String(userId)).first();
  return row?.followers_count == null ? null : Math.max(0, Number(row.followers_count));
}

async function ensureAutomaticStreamSession(env, kickSessionId, kickSession, stream, observedAt = Date.now()) {
  if (!kickSession?.userId || !kickSession?.account?.id) return null;
  await ensureDesktopPlatformSchema(env);
  const userId = String(kickSession.userId);
  const broadcasterId = String(kickSession.account.id);
  const active = await env.DB.prepare(`SELECT r.session_id AS sessionId, s.started_at AS startedAt
    FROM ps_stream_runtime r JOIN ps_stream_sessions s ON s.id = r.session_id
    WHERE r.user_id = ?1 AND r.status = 'live' AND s.ended_at IS NULL LIMIT 1`).bind(userId).first();
  let sessionId = String(active?.sessionId || "");
  let startedAt = Number(active?.startedAt || 0);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    startedAt = Math.min(observedAt, Math.max(observedAt - 12 * 60 * 60 * 1000, Number(stream?.startedAt || observedAt)));
    const title = String(stream?.title || "Kick yayını").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 160) || "Kick yayını";
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO ps_stream_sessions
        (id, user_id, platform, title, started_at, ended_at, peak_viewers, interactions, followers_gained, revenue_minor, summary_json)
        VALUES (?1, ?2, 'Kick', ?3, ?4, NULL, 0, 0, 0, 0, ?5)`)
        .bind(sessionId, userId, title, startedAt, JSON.stringify({ collector: "server-automatic", status: "live", broadcasterId })),
      env.DB.prepare(`INSERT INTO ps_stream_runtime
        (user_id, session_id, kick_session_id, broadcaster_user_id, status, last_observed_at,
         last_subscription_check_at, last_error, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, 'live', ?5, 0, NULL, ?5, ?5)
        ON CONFLICT(user_id) DO UPDATE SET session_id = excluded.session_id,
          kick_session_id = excluded.kick_session_id, broadcaster_user_id = excluded.broadcaster_user_id,
          status = 'live', last_observed_at = excluded.last_observed_at, last_error = NULL,
          created_at = excluded.created_at, updated_at = excluded.updated_at`)
        .bind(userId, sessionId, String(kickSessionId), broadcasterId, observedAt),
    ]);
  } else {
    await env.DB.prepare(`UPDATE ps_stream_runtime SET kick_session_id = ?1,
      broadcaster_user_id = ?2, last_observed_at = ?3, last_error = NULL, updated_at = ?3
      WHERE user_id = ?4`).bind(String(kickSessionId), broadcasterId, observedAt, userId).run();
    if (stream?.title) {
      await env.DB.prepare(`UPDATE ps_stream_sessions SET title = ?1 WHERE id = ?2 AND ended_at IS NULL`)
        .bind(String(stream.title).slice(0, 160), sessionId).run();
    }
  }
  const viewerCount = boundedInsightMetric(stream?.viewer_count ?? stream?.viewerCount ?? stream?.viewers);
  const sampleMinute = Math.floor(observedAt / 60_000);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO ps_stream_samples (session_id, sample_minute, viewer_count, observed_at)
      VALUES (?1, ?2, ?3, ?4)
      ON CONFLICT(session_id, sample_minute) DO UPDATE SET
        viewer_count = MAX(ps_stream_samples.viewer_count, excluded.viewer_count),
        observed_at = MAX(ps_stream_samples.observed_at, excluded.observed_at)`)
      .bind(sessionId, sampleMinute, viewerCount, observedAt),
    env.DB.prepare(`UPDATE ps_stream_sessions SET peak_viewers = MAX(peak_viewers, ?1)
      WHERE id = ?2 AND ended_at IS NULL`).bind(viewerCount, sessionId),
  ]);
  return { sessionId, startedAt, viewerCount };
}

async function finalizeAutomaticStreamSession(env, userId, endedAt = Date.now()) {
  await ensureDesktopPlatformSchema(env);
  const runtime = await env.DB.prepare(`SELECT r.session_id AS sessionId,
      r.broadcaster_user_id AS broadcasterId, s.started_at AS startedAt, s.peak_viewers AS peakViewers
    FROM ps_stream_runtime r JOIN ps_stream_sessions s ON s.id = r.session_id
    WHERE r.user_id = ?1 AND r.status = 'live' AND s.ended_at IS NULL LIMIT 1`).bind(String(userId)).first();
  if (!runtime?.sessionId) return null;
  const startedAt = Number(runtime.startedAt || endedAt);
  const safeEndedAt = Math.max(startedAt + 1000, Math.min(Date.now() + 60_000, Number(endedAt) || Date.now()));
  const startedIso = new Date(startedAt).toISOString();
  const endedIso = new Date(safeEndedAt).toISOString();
  const [sampleRow, eventRows, donateRows, followerStart] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS sampleCount, MAX(viewer_count) AS peakViewers,
      AVG(viewer_count) AS averageViewers, MIN(viewer_count) AS minimumViewers
      FROM ps_stream_samples WHERE session_id = ?1`).bind(String(runtime.sessionId)).first(),
    env.DB.prepare(`SELECT event_type, payload_json, event_at, received_at
      FROM kick_webhook_events WHERE broadcaster_user_id = ?1
        AND COALESCE(event_at, received_at) >= ?2 AND COALESCE(event_at, received_at) <= ?3
      ORDER BY COALESCE(event_at, received_at) ASC LIMIT 10000`)
      .bind(String(runtime.broadcasterId), startedIso, endedIso).all(),
    env.DB.prepare(`SELECT amount_minor AS amountMinor, currency, event_at AS eventAt, received_at AS receivedAt
      FROM donate_bridge_events WHERE user_id = ?1
        AND COALESCE(event_at, received_at) >= ?2 AND COALESCE(event_at, received_at) <= ?3
      ORDER BY COALESCE(event_at, received_at) ASC LIMIT 10000`)
      .bind(String(userId), startedAt, safeEndedAt).all(),
    latestKnownFollowerCount(userId, env).catch(() => null),
  ]);
  const kickEvents = eventRows?.results || [];
  const donateEvents = donateRows?.results || [];
  const followersGained = kickEvents.filter(row => row.event_type === "channel.followed")
    .reduce((sum, row) => sum + automaticStreamEventWeight(row), 0);
  const subscriptions = kickEvents.filter(row => String(row.event_type || "").startsWith("channel.subscription"))
    .reduce((sum, row) => sum + automaticStreamEventWeight(row), 0);
  const kicksEvents = kickEvents.filter(row => row.event_type === "kicks.gifted");
  const interactions = kickEvents.filter(row => row.event_type !== "livestream.status.updated")
    .reduce((sum, row) => sum + automaticStreamEventWeight(row), 0) + donateEvents.length;
  const revenueByCurrency = donateEvents.reduce((totals, row) => {
    const currency = /^[A-Z]{3}$/.test(String(row.currency || "").toUpperCase()) ? String(row.currency).toUpperCase() : "OTHER";
    totals[currency] = (totals[currency] || 0) + boundedInsightMetric(row.amountMinor, 100_000_000);
    return totals;
  }, {});
  const revenueCurrencies = Object.keys(revenueByCurrency);
  const revenueCurrency = revenueCurrencies.length === 1 ? revenueCurrencies[0] : "";
  const revenueMinor = revenueCurrency ? revenueByCurrency[revenueCurrency] : 0;
  const peakViewers = Math.max(Number(runtime.peakViewers || 0), Number(sampleRow?.peakViewers || 0));
  const averageViewers = Number(Number(sampleRow?.averageViewers || 0).toFixed(2));
  const durationSeconds = Math.max(1, Math.round((safeEndedAt - startedAt) / 1000));
  const summary = {
    collector: "server-automatic",
    status: "completed",
    broadcasterId: String(runtime.broadcasterId),
    durationSeconds,
    sampleCount: Number(sampleRow?.sampleCount || 0),
    averageViewers,
    minimumViewers: Math.max(0, Number(sampleRow?.minimumViewers || 0)),
    peakViewers,
    followersGained,
    subscriptions,
    kicksEvents: kicksEvents.length,
    donationEvents: donateEvents.length,
    revenueByCurrency,
    revenueCurrency,
    followerTotalAtClose: followerStart,
    verification: {
      stream: "kick-api-minute-samples",
      engagement: "kick-signed-webhooks",
      donations: donateEvents.length ? "provider-or-play-connect-events" : "no-events",
    },
    completedAt: safeEndedAt,
  };
  await env.DB.batch([
    env.DB.prepare(`UPDATE ps_stream_sessions SET ended_at = ?1, peak_viewers = ?2,
      interactions = ?3, followers_gained = ?4, revenue_minor = ?5, summary_json = ?6
      WHERE id = ?7 AND user_id = ?8 AND ended_at IS NULL`)
      .bind(safeEndedAt, peakViewers, interactions, followersGained, revenueMinor, JSON.stringify(summary), String(runtime.sessionId), String(userId)),
    env.DB.prepare(`UPDATE ps_stream_runtime SET status = 'ended', last_observed_at = ?1,
      last_error = NULL, updated_at = ?1 WHERE user_id = ?2 AND session_id = ?3`)
      .bind(safeEndedAt, String(userId), String(runtime.sessionId)),
  ]);
  return { sessionId: String(runtime.sessionId), ...summary };
}

async function applyKickLivestreamEvent(env, broadcasterId, payload, eventAt) {
  const state = kickLivestreamPayloadState(payload);
  if (state.live === null) return null;
  const row = await env.DB.prepare(`SELECT id FROM kick_sessions
    WHERE user_id IS NOT NULL AND CAST(json_extract(account_json, '$.id') AS TEXT) = ?1
    ORDER BY created_at DESC LIMIT 1`).bind(String(broadcasterId)).first();
  if (!row?.id) return null;
  const session = await getKickSession(String(row.id), env);
  if (!session?.userId) return null;
  const observedAt = Number(eventAt) || Date.now();
  if (state.live) {
    return ensureAutomaticStreamSession(env, String(row.id), session, {
      title: state.title,
      viewer_count: state.viewerCount,
      startedAt: state.startedAt || observedAt,
    }, observedAt);
  }
  return finalizeAutomaticStreamSession(env, session.userId, state.endedAt || observedAt);
}

async function syncScheduledLiveSessions(env) {
  try {
    await ensureUsersSchema(env);
    await ensureDesktopPlatformSchema(env);
    const rows = await env.DB.prepare(`SELECT ks.id, ks.user_id,
        CASE WHEN r.status = 'live' THEN 1 ELSE 0 END AS is_active,
        COALESCE(m.last_checked_at, r.last_observed_at, 0) AS last_observed_at,
        COALESCE(m.last_subscription_check_at, 0) AS last_subscription_check_at
      FROM kick_sessions ks
      INNER JOIN (SELECT user_id, MAX(created_at) AS newest FROM kick_sessions
        WHERE user_id IS NOT NULL GROUP BY user_id) latest
        ON latest.user_id = ks.user_id AND latest.newest = ks.created_at
      LEFT JOIN ps_stream_runtime r ON r.user_id = ks.user_id
      LEFT JOIN ps_kick_monitor_state m ON m.user_id = ks.user_id
      ORDER BY is_active DESC, last_observed_at ASC LIMIT 80`).all();
    let checked = 0;
    let live = 0;
    let completed = 0;
    let failed = 0;
    for (const row of rows?.results || []) {
      try {
        let session = await getKickSession(String(row.id), env);
        if (!session?.userId) continue;
        if (Date.now() >= Number(session.expiresAt || 0) - 60_000) {
          const refreshed = await refreshKickSessionSafely(String(row.id), env);
          session = refreshed?.session || null;
        }
        if (!session?.userId) continue;
        const now = Date.now();
        await env.DB.prepare(`INSERT INTO ps_kick_monitor_state
          (user_id, kick_session_id, broadcaster_user_id, last_checked_at,
           last_subscription_check_at, last_error, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?4)
          ON CONFLICT(user_id) DO UPDATE SET kick_session_id = excluded.kick_session_id,
            broadcaster_user_id = excluded.broadcaster_user_id,
            last_checked_at = excluded.last_checked_at, last_error = NULL,
            updated_at = excluded.updated_at`)
          .bind(String(session.userId), String(row.id), String(session.account?.id || ""), now,
            Number(row.last_subscription_check_at || 0)).run();
        if (now - Number(row.last_subscription_check_at || 0) >= 24 * 60 * 60 * 1000) {
          const subscription = await ensureKickEventSubscriptions(session, env).catch(() => ({ ok: false }));
          if (subscription?.ok) {
            await env.DB.prepare(`UPDATE ps_kick_monitor_state SET last_subscription_check_at = ?1,
              updated_at = MAX(updated_at, ?1) WHERE user_id = ?2`).bind(now, String(session.userId)).run();
          }
        }
        const stream = await getKickStreamStatus(session);
        checked += 1;
        if (stream?.live) {
          await ensureAutomaticStreamSession(env, String(row.id), session, stream, now);
          live += 1;
        } else {
          const result = await finalizeAutomaticStreamSession(env, session.userId, now);
          if (result) completed += 1;
        }
      } catch (error) {
        failed += 1;
        if (row.user_id) {
          await env.DB.prepare(`INSERT INTO ps_kick_monitor_state
            (user_id, kick_session_id, broadcaster_user_id, last_checked_at,
             last_subscription_check_at, last_error, updated_at)
            VALUES (?1, ?2, '', 0, 0, ?3, ?4)
            ON CONFLICT(user_id) DO UPDATE SET last_error = excluded.last_error,
              updated_at = excluded.updated_at`)
            .bind(String(row.user_id), String(row.id), String(error?.message || "Yayın ölçümü başarısız.").slice(0, 240), Date.now())
            .run().catch(() => {});
        }
      }
    }
    logSecurityEvent("automatic_stream_sync", { checked, live, completed, failed });
  } catch (error) {
    logSecurityEvent("automatic_stream_sync_failed", { reason: error?.code || error?.name || "unknown" });
  }
}

function boundedInsightMetric(value, maximum = 10_000_000) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(maximum, Math.round(number))) : 0;
}

function deterministicInsight(input) {
  const currentMinutes = Math.max(1, boundedInsightMetric(input?.current?.minutes, 24 * 60));
  const previousMinutes = Math.max(1, boundedInsightMetric(input?.previous?.minutes, 24 * 60));
  const currentInteractions = boundedInsightMetric(input?.current?.interactions);
  const previousInteractions = boundedInsightMetric(input?.previous?.interactions);
  const currentRate = currentInteractions / currentMinutes;
  const previousRate = previousInteractions / previousMinutes;
  const percentChange = previousRate > 0 ? Math.round(((currentRate - previousRate) / previousRate) * 100) : currentRate > 0 ? 100 : 0;
  const direction = percentChange >= 10 ? "rising" : percentChange <= -10 ? "falling" : "steady";
  const periodLabel = `${currentMinutes} dakikada ${currentInteractions} etkileşim`;
  const comparison = previousInteractions > 0
    ? `Önceki bölümde dakikada ${previousRate.toFixed(1)}, bu bölümde ${currentRate.toFixed(1)} etkileşim oluştu.`
    : "Karşılaştırma için önceki bölümde yeterli etkileşim yok.";
  const title = direction === "rising" ? "Etkileşim belirgin biçimde yükseliyor" : direction === "falling" ? "Etkileşim hızı düşüyor" : "Etkileşim dengeli ilerliyor";
  return {
    title,
    summary: `${periodLabel}. ${comparison}`,
    evidence: [
      `Etkileşim hızı: ${currentRate.toFixed(1)}/dk`,
      `Önceki bölüme göre değişim: ${percentChange > 0 ? "+" : ""}${percentChange}%`,
      `Aktif izleyici: ${boundedInsightMetric(input?.current?.activeViewers)}`,
    ],
    nextAction: direction === "rising" ? "İşe yarayan konu veya etkinliği birkaç dakika daha sürdür." : direction === "falling" ? "Yeni bir soru, hedef veya yayın bölümüyle ritmi değiştir." : "Akışı bozma; bir sonraki bölümde aynı ölçümü yeniden karşılaştır.",
    direction,
    percentChange,
    currentRate: Number(currentRate.toFixed(2)),
    previousRate: Number(previousRate.toFixed(2)),
  };
}

function responseOutputText(payload) {
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

function validAiInsight(value) {
  return value && typeof value.title === "string" && value.title.length <= 100
    && typeof value.summary === "string" && value.summary.length <= 500
    && Array.isArray(value.evidence) && value.evidence.length >= 1 && value.evidence.length <= 3
    && value.evidence.every(item => typeof item === "string" && item.length <= 180)
    && typeof value.nextAction === "string" && value.nextAction.length <= 240;
}

function parseAiInsightText(text, model) {
  if (typeof text !== "string") return null;
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return validAiInsight(parsed) ? { ...parsed, model } : null;
  } catch {
    return null;
  }
}

async function explainInsightWithOpenAi(summary, env) {
  if (!env.OPENAI_API_KEY) return null;
  const model = String(env.OPENAI_MODEL || "gpt-5.6-luna");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: "Sen Play Streamers yayın analiz yardımcısısın. Yalnız verilen sayısal özeti kullan. Türkçe, sakin, kısa ve kanıt gösteren bir açıklama yaz. Kesin neden bilinmiyorsa neden uydurma. Kişisel veri isteme veya üretme.",
      input: JSON.stringify(summary),
      max_output_tokens: 400,
      text: { format: {
        type: "json_schema",
        name: "play_streamers_insight",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", maxLength: 100 },
            summary: { type: "string", maxLength: 500 },
            evidence: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", maxLength: 180 } },
            nextAction: { type: "string", maxLength: 240 },
          },
          required: ["title", "summary", "evidence", "nextAction"],
        },
      } },
    }),
  });
  if (!response.ok) return null;
  const payload = await safeJson(response);
  const text = responseOutputText(payload);
  return parseAiInsightText(text, model);
}

async function explainInsightWithWorkersAi(summary, env) {
  if (!env.AI || typeof env.AI.run !== "function") return null;
  const model = "@cf/meta/llama-3.1-8b-instruct-fp8";
  const payload = await env.AI.run(model, {
    messages: [
      {
        role: "system",
        content: "Sen Play Streamers yayın analiz yardımcısısın. Yalnız verilen sayısal özeti kullan. Türkçe, sakin, kısa ve kanıt gösteren bir açıklama yaz. Kesin neden bilinmiyorsa neden uydurma. Kişisel veri isteme veya üretme. Yalnız geçerli JSON döndür.",
      },
      {
        role: "user",
        content: `Şu sayısal yayın özetini açıkla: ${JSON.stringify(summary)}\nYalnız bu JSON biçimini döndür: {"title":"en fazla 100 karakter","summary":"en fazla 500 karakter","evidence":["1-3 kısa kanıt"],"nextAction":"en fazla 240 karakter"}`,
      },
    ],
    max_tokens: 400,
    temperature: 0.2,
  });
  const text = typeof payload?.response === "string"
    ? payload.response
    : typeof payload?.result?.response === "string"
      ? payload.result.response
      : typeof payload?.choices?.[0]?.message?.content === "string"
        ? payload.choices[0].message.content
        : null;
  return parseAiInsightText(text, model);
}

async function explainInsightWithAi(summary, env) {
  const openAiResult = await explainInsightWithOpenAi(summary, env).catch(() => null);
  if (openAiResult) return openAiResult;
  return explainInsightWithWorkersAi(summary, env).catch(() => null);
}

async function createDesktopInsight(request, env) {
  if (!desktopRequestOriginAllowed(request)) return apiResponse(request, { error: "Masaüstü uygulama kaynağı geçersiz." }, 403);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const plan = await desktopEntitlement(current.session.user.id, env);
  const input = await requestJson(request);
  const numericSummary = {
    current: {
      minutes: boundedInsightMetric(input?.current?.minutes, 24 * 60),
      interactions: boundedInsightMetric(input?.current?.interactions),
      activeViewers: boundedInsightMetric(input?.current?.activeViewers),
      supporters: boundedInsightMetric(input?.current?.supporters),
    },
    previous: {
      minutes: boundedInsightMetric(input?.previous?.minutes, 24 * 60),
      interactions: boundedInsightMetric(input?.previous?.interactions),
      activeViewers: boundedInsightMetric(input?.previous?.activeViewers),
      supporters: boundedInsightMetric(input?.previous?.supporters),
    },
  };
  const fallback = deterministicInsight(numericSummary);
  if (plan.tier !== "product-pro") return apiResponse(request, { ok: true, ai: false, planRequired: "product-pro", insight: fallback });
  const inputHash = await sha256Hex(JSON.stringify(numericSummary));
  const now = Math.floor(Date.now() / 1000);
  const cached = await env.DB.prepare(`SELECT result_json AS resultJson, model FROM ps_ai_insights
    WHERE user_id = ?1 AND insight_type = 'engagement' AND input_hash = ?2 AND expires_at > ?3 LIMIT 1`)
    .bind(current.session.user.id, inputHash, now).first();
  if (cached?.resultJson) {
    try { return apiResponse(request, { ok: true, ai: Boolean(cached.model), cached: true, insight: JSON.parse(cached.resultJson) }); } catch { /* rebuild below */ }
  }
  const recent = await env.DB.prepare(`SELECT COUNT(*) AS total FROM ps_ai_insights
    WHERE user_id = ?1 AND model IS NOT NULL AND created_at >= ?2`).bind(current.session.user.id, now - 60 * 60).first();
  const aiResult = Number(recent?.total || 0) < 20 ? await explainInsightWithAi({ ...numericSummary, calculated: fallback }, env).catch(() => null) : null;
  const insight = aiResult ? { ...fallback, ...aiResult } : fallback;
  await env.DB.prepare(`INSERT INTO ps_ai_insights
    (id, user_id, insight_type, input_hash, result_json, model, created_at, expires_at)
    VALUES (?1, ?2, 'engagement', ?3, ?4, ?5, ?6, ?7)
    ON CONFLICT(user_id, insight_type, input_hash) DO UPDATE SET result_json = excluded.result_json,
      model = excluded.model, created_at = excluded.created_at, expires_at = excluded.expires_at`)
    .bind(crypto.randomUUID(), current.session.user.id, inputHash, JSON.stringify(insight), aiResult?.model || null, now, now + 15 * 60).run();
  return apiResponse(request, { ok: true, ai: Boolean(aiResult), cached: false, insight });
}

function normalizeDonateBridgePairingCode(value) {
  const code = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Sixteen-character codes are the current format. Previously issued 10/12
  // character one-time codes remain claimable only until their normal expiry.
  return /^(?:[A-HJ-NP-Z2-9]{10}|[A-HJ-NP-Z2-9]{12}|[A-HJ-NP-Z2-9]{16})$/.test(code) ? code : "";
}

function createDonateBridgePairingValue() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const raw = [...bytes].map(byte => alphabet[byte % alphabet.length]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12)}`;
}

function donateBridgeText(value, maximum, fallback = "") {
  const text = String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, maximum);
}

async function donateBridgePairingHash(code) {
  return sha256Base64Url(`donate-bridge-pairing:${code}`);
}

async function donateBridgeDeviceTokenHash(token) {
  return sha256Base64Url(`donate-bridge-device:${token}`);
}

async function authenticateDonateBridgeDevice(request, env, { includeRevoked = false } = {}) {
  const authorization = String(request.headers.get("Authorization") || "");
  const deviceToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!/^[A-Za-z0-9_-]{40,160}$/.test(deviceToken)) return null;
  const tokenHash = await donateBridgeDeviceTokenHash(deviceToken);
  const device = await env.DB.prepare(`SELECT id, user_id, name, app_version, last_seen_at, revoked_at
    FROM donate_bridge_devices WHERE token_hash = ?1 ${includeRevoked ? "" : "AND revoked_at IS NULL"} LIMIT 1`)
    .bind(tokenHash).first();
  return device ? { ...device, tokenHash } : null;
}

async function getDonateBridgeDeviceStatus(request, env) {
  await ensureUsersSchema(env);
  const device = await authenticateDonateBridgeDevice(request, env);
  if (!device) return apiResponse(request, { error: "Play Connect bağlantısı siteden kaldırılmış." }, 401);
  const now = Date.now();
  const reportedVersion = donateBridgeText(request.headers.get("x-play-streamers-bridge"), 24);
  const input = await requestJson(request);
  const connectedProviders = [...new Set((Array.isArray(input.connectedProviders) ? input.connectedProviders : [])
    .map(value => donateBridgeText(value, 80))
    .filter(value => DONATE_PROVIDER_BY_ID.has(value))
    .slice(0, DONATE_PROVIDER_CATALOG.length))];
  if (!device.last_seen_at || now - Number(device.last_seen_at) >= DONATE_BRIDGE_DEVICE_TOUCH_INTERVAL_MS || connectedProviders.length || (reportedVersion && reportedVersion !== String(device.app_version || ""))) {
    await env.DB.prepare(`UPDATE donate_bridge_devices
      SET last_seen_at = ?1, provider_status_json = ?2, app_version = COALESCE(?3, app_version) WHERE id = ?4`)
      .bind(now, JSON.stringify(connectedProviders), reportedVersion || null, device.id).run();
  }
  const serverConnections = await env.DB.prepare(`SELECT provider_id FROM donate_webhook_connections
    WHERE user_id = ?1 AND revoked_at IS NULL ORDER BY created_at DESC`)
    .bind(device.user_id).all();
  const account = await getUserById(device.user_id, env);
  const kickAccount = await env.DB.prepare("SELECT kick_user_id, kick_username FROM users WHERE id = ?1 LIMIT 1")
    .bind(device.user_id).first();
  return apiResponse(request, {
    ok: true,
    paired: true,
    device: {
      id: String(device.id),
      name: String(device.name || "Chrome Eklentisi"),
      appVersion: reportedVersion || (device.app_version ? String(device.app_version) : null),
      active: true,
    },
    serverConnectedProviderIds: (serverConnections?.results || [])
      .map(row => String(row.provider_id || ""))
      .filter(id => DONATE_PROVIDER_BY_ID.get(id)?.serverWebhook),
    accountEmail: String(account?.email || ""),
    kickTarget: kickAccount?.kick_user_id && kickAccount?.kick_username ? {
      broadcasterId: String(kickAccount.kick_user_id),
      slug: String(kickAccount.kick_username),
    } : null,
  });
}

async function receiveDonateBridgeKickMetrics(request, env) {
  await ensureUsersSchema(env);
  const device = await authenticateDonateBridgeDevice(request, env);
  if (!device) return apiResponse(request, { error: "Play Connect bağlantısı geçersiz veya kaldırılmış." }, 401);
  const account = await env.DB.prepare("SELECT kick_user_id, kick_username FROM users WHERE id = ?1 LIMIT 1")
    .bind(device.user_id).first();
  if (!account?.kick_user_id || !account?.kick_username) {
    return apiResponse(request, { error: "Bu Play Streamers hesabına bağlı bir Kick kanalı bulunamadı." }, 409);
  }
  const input = await requestJson(request);
  const slug = donateBridgeText(input.slug, 100);
  const broadcasterId = donateBridgeText(input.broadcasterId, 80);
  if (slug && slug.toLocaleLowerCase("tr-TR") !== String(account.kick_username).toLocaleLowerCase("tr-TR")) {
    return apiResponse(request, { error: "Kick kanal adı eşleşmedi." }, 403);
  }
  if (broadcasterId && broadcasterId !== String(account.kick_user_id)) {
    return apiResponse(request, { error: "Kick yayıncı kimliği eşleşmedi." }, 403);
  }
  const followers = Number(input.followersCount);
  const subscribers = Number(input.subscribersCount);
  const hasFollowers = input.followersCount !== null && input.followersCount !== undefined
    && Number.isFinite(followers) && followers >= 0 && followers <= 2_000_000_000;
  const hasSubscribers = input.subscribersCount !== null && input.subscribersCount !== undefined
    && Number.isFinite(subscribers) && subscribers >= 0 && subscribers <= 2_000_000_000;
  if (!hasFollowers && !hasSubscribers) {
    return apiResponse(request, { error: "Geçerli bir Kick takipçi veya aktif abone sayısı bulunamadı." }, 400);
  }
  await storeKickMetricSnapshot(env, {
    userId: device.user_id,
    broadcasterId: account.kick_user_id,
    slug: account.kick_username,
    followersCount: hasFollowers ? followers : null,
    subscribersCount: hasSubscribers ? subscribers : null,
    source: "play-connect-kick-summary",
    observedAt: Number(input.observedAt) || Date.now(),
  });
  return apiResponse(request, {
    ok: true,
    followersCount: hasFollowers ? Math.floor(followers) : null,
    subscribersCount: hasSubscribers ? Math.floor(subscribers) : null,
    metricDate: kickMetricDateKey(Number(input.observedAt) || Date.now()),
  });
}

async function disconnectDonateBridgeDevice(request, env) {
  await ensureUsersSchema(env);
  const device = await authenticateDonateBridgeDevice(request, env, { includeRevoked: true });
  if (!device) return apiResponse(request, { error: "Play Connect bağlantısı bulunamadı." }, 401);
  if (device.revoked_at) return apiResponse(request, { ok: true, revoked: true, alreadyRevoked: true });
  await env.DB.prepare("UPDATE donate_bridge_devices SET revoked_at = ?1 WHERE id = ?2 AND revoked_at IS NULL")
    .bind(Date.now(), device.id).run();
  return apiResponse(request, { ok: true, revoked: true });
}

async function createDonateBridgePairingCode(request, env) {
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const userId = current.session.user.id;
  const input = await requestJson(request);
  const deviceName = donateBridgeText(input.deviceName, 60, "Play Streamers Donate Bridge");
  const now = Date.now();

  const recent = await env.DB.prepare(`SELECT COUNT(*) AS total FROM donate_bridge_pairing_codes
    WHERE user_id = ?1 AND created_at >= ?2`).bind(userId, now - DONATE_BRIDGE_PAIRING_TTL_MS).first();
  if (Number(recent?.total || 0) >= 6) {
    return apiResponse(request, { error: "Çok sık eşleştirme kodu oluşturdun. Birkaç dakika sonra tekrar dene." }, 429);
  }

  await env.DB.prepare(`UPDATE donate_bridge_pairing_codes SET expires_at = ?2
    WHERE user_id = ?1 AND claimed_at IS NULL AND expires_at > ?2`).bind(userId, now).run();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = createDonateBridgePairingValue();
    const codeHash = await donateBridgePairingHash(normalizeDonateBridgePairingCode(code));
    try {
      await env.DB.prepare(`INSERT INTO donate_bridge_pairing_codes
        (code_hash, user_id, device_name, expires_at, created_at, claimed_at)
        VALUES (?1, ?2, ?3, ?4, ?5, NULL)`)
        .bind(codeHash, userId, deviceName, now + DONATE_BRIDGE_PAIRING_TTL_MS, now)
        .run();
      await env.DB.prepare(`UPDATE donate_bridge_devices SET revoked_at = ?2
        WHERE user_id = ?1 AND revoked_at IS NULL`).bind(userId, now).run();
      return apiResponse(request, {
        ok: true,
        code,
        expiresAt: new Date(now + DONATE_BRIDGE_PAIRING_TTL_MS).toISOString(),
        expiresInSeconds: Math.floor(DONATE_BRIDGE_PAIRING_TTL_MS / 1000),
      });
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  return apiResponse(request, { error: "Eşleştirme kodu oluşturulamadı." }, 500);
}

async function claimDonateBridgePairingCode(request, env) {
  await ensureUsersSchema(env);
  const input = await requestJson(request);
  const code = normalizeDonateBridgePairingCode(input.code);
  if (!code) return apiResponse(request, { error: "Eşleştirme kodu geçersiz." }, 400);
  const codeHash = await donateBridgePairingHash(code);
  const now = Date.now();
  const pairing = await env.DB.prepare(`SELECT user_id, device_name, expires_at, claimed_at
    FROM donate_bridge_pairing_codes WHERE code_hash = ?1 LIMIT 1`).bind(codeHash).first();
  if (!pairing || Number(pairing.expires_at || 0) <= now) {
    return apiResponse(request, { error: "Eşleştirme kodunun süresi dolmuş veya kod geçersiz." }, 410);
  }
  if (pairing.claimed_at !== null && pairing.claimed_at !== undefined) {
    return apiResponse(request, { error: "Bu eşleştirme kodu daha önce kullanılmış." }, 409);
  }

  const active = await env.DB.prepare(`SELECT COUNT(*) AS total FROM donate_bridge_devices
    WHERE user_id = ?1 AND revoked_at IS NULL`).bind(pairing.user_id).first();
  if (Number(active?.total || 0) >= DONATE_BRIDGE_MAX_ACTIVE_DEVICES) {
    return apiResponse(request, { error: "Bu hesapta aktif cihaz sınırına ulaşıldı." }, 409);
  }

  const deviceId = crypto.randomUUID();
  const deviceToken = randomBase64Url(48);
  const tokenHash = await donateBridgeDeviceTokenHash(deviceToken);
  const deviceName = donateBridgeText(input.deviceName, 60, pairing.device_name || "Windows cihazı");
  const clientInstanceId = /^[0-9a-f-]{36}$/i.test(String(input.clientInstanceId || "").trim())
    ? String(input.clientInstanceId).trim().toLowerCase()
    : null;
  const appVersion = donateBridgeText(input.appVersion, 24);
  const consumed = await env.DB.prepare(`UPDATE donate_bridge_pairing_codes
    SET claimed_at = ?1 WHERE code_hash = ?2 AND claimed_at IS NULL AND expires_at > ?1`)
    .bind(now, codeHash).run();
  if (Number(consumed?.meta?.changes || 0) !== 1) {
    return apiResponse(request, { error: "Eşleştirme kodu aynı anda başka bir cihazda kullanıldı." }, 409);
  }

  try {
    if (clientInstanceId) {
      await env.DB.prepare(`UPDATE donate_bridge_devices SET revoked_at = ?1
        WHERE user_id = ?2 AND client_instance_id = ?3 AND revoked_at IS NULL`)
        .bind(now, pairing.user_id, clientInstanceId).run();
    }
    await env.DB.prepare(`INSERT INTO donate_bridge_devices
      (id, user_id, name, token_hash, app_version, client_instance_id, created_at, last_seen_at, revoked_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL)`)
      .bind(deviceId, pairing.user_id, deviceName, tokenHash, appVersion || null, clientInstanceId, now)
      .run();
  } catch (error) {
    await env.DB.prepare(`UPDATE donate_bridge_pairing_codes
      SET claimed_at = NULL WHERE code_hash = ?1 AND claimed_at = ?2`).bind(codeHash, now).run().catch(() => {});
    throw error;
  }

  const account = await getUserById(pairing.user_id, env);
  return apiResponse(request, {
    ok: true,
    paired: true,
    deviceToken,
    apiEndpoint: `${API_ORIGIN}/api/donate-bridge/events`,
    providerCatalogVersion: DONATE_PROVIDER_CATALOG_VERSION,
    accountEmail: String(account?.email || ""),
    device: {
      id: deviceId,
      name: deviceName,
      appVersion: appVersion || null,
      pairedAt: new Date(now).toISOString(),
    },
  });
}

async function donateWebhookTokenHash(token) {
  return sha256Base64Url(`donate-provider-webhook:${token}`);
}

async function listActiveDonateWebhookConnections(userId, env) {
  const result = await env.DB.prepare(`SELECT id, provider_id, created_at, last_event_at, event_count
    FROM donate_webhook_connections
    WHERE user_id = ?1 AND revoked_at IS NULL
    ORDER BY created_at DESC`).bind(userId).all();
  return (result?.results || []).map(row => {
    const provider = DONATE_PROVIDER_BY_ID.get(String(row.provider_id || ""));
    return {
      id: String(row.id || ""),
      providerId: String(row.provider_id || ""),
      providerName: String(provider?.name || row.provider_id || "Donate"),
      setupUrl: String(provider?.setupUrl || ""),
      supportLevel: String(provider?.supportLevel || "conditional"),
      connectedAt: new Date(Number(row.created_at || 0)).toISOString(),
      lastEventAt: row.last_event_at ? new Date(Number(row.last_event_at)).toISOString() : null,
      eventCount: Number(row.event_count || 0),
      active: true,
    };
  });
}

function donateOAuthProviderConfig(providerId, env) {
  const provider = DONATE_OAUTH_PROVIDERS[providerId];
  if (!provider) return null;
  const clientId = String(env?.[provider.clientIdVariable] || "").trim();
  const clientSecret = String(env?.[provider.clientSecretVariable] || "").trim();
  return {
    ...provider,
    clientId,
    clientSecret,
    redirectUri: DONATE_OAUTH_REDIRECT_URIS[providerId],
    configured: Boolean(clientId && clientSecret && isDonateOAuthEncryptionConfigured(env)),
  };
}

async function syncScheduledDonateOAuthConnections(env) {
  try {
    await ensureUsersSchema(env);
    const result = await env.DB.prepare(`SELECT * FROM donate_oauth_connections
      WHERE revoked_at IS NULL
      ORDER BY COALESCE(last_sync_at, 0) ASC
      LIMIT 20`).all();
    const connections = result?.results || [];
    let inserted = 0;
    let failed = 0;
    for (const connection of connections) {
      try {
        const outcome = await syncOneDonateOAuthConnection(connection, env);
        inserted += Number(outcome.inserted || 0);
      } catch (error) {
        failed += 1;
        await recordDonateOAuthError(connection.id, error, env);
      }
    }
    logSecurityEvent("donate_oauth_scheduled_sync", { checked: connections.length, inserted, failed });
  } catch (error) {
    logSecurityEvent("donate_oauth_scheduled_sync_failed", { reason: error?.code || error?.name || "unknown" });
  }
}

async function syncScheduledKickMetrics(env) {
  try {
    await ensureUsersSchema(env);
    await ensureKickMetricsSchemaInD1(env);
    const hourKey = kickMetricHourKey();
    /* Her hesabın saatlik ölçümünü ayrı denetle. Böylece bir hesabın başarılı
       olması diğer hesapların cron turunu kilitlemez; başarısız olan hesap bir
       sonraki turda yeniden denenir. */
    const rows = await env.DB.prepare(`SELECT ks.id, ks.user_id
      FROM kick_sessions ks
      INNER JOIN (
        SELECT user_id, MAX(created_at) AS newest
        FROM kick_sessions WHERE user_id IS NOT NULL GROUP BY user_id
      ) latest ON latest.user_id = ks.user_id AND latest.newest = ks.created_at
      WHERE NOT EXISTS (
        SELECT 1 FROM kick_metric_hourly km
        WHERE km.user_id = ks.user_id AND km.metric_hour = ?1
      )
      ORDER BY ks.created_at DESC LIMIT 40`).bind(hourKey).all();
    let checked = 0;
    let failed = 0;
    for (const row of rows?.results || []) {
      try {
        let session = await getKickSession(String(row.id), env);
        if (!session) continue;
        if (Date.now() >= Number(session.expiresAt || 0) - 60_000) {
          const refreshed = await refreshKickSessionSafely(String(row.id), env);
          session = refreshed?.session || null;
        }
        if (!session) continue;
        await getKickChannelInsights(session, env);
        const stored = await env.DB.prepare(`SELECT 1 AS ok FROM kick_metric_hourly
          WHERE user_id = ?1 AND metric_hour = ?2 LIMIT 1`)
          .bind(String(row.user_id || session.userId || ""), hourKey).first();
        if (stored?.ok) checked += 1;
        else failed += 1;
      } catch (_) {
        failed += 1;
      }
    }
    logSecurityEvent("kick_metrics_scheduled_sync", { checked, failed, hour: hourKey });
  } catch (error) {
    logSecurityEvent("kick_metrics_scheduled_sync_failed", { reason: error?.code || error?.name || "unknown" });
  }
}

function isDonateOAuthEncryptionConfigured(env) {
  return Boolean(env?.DONATE_OAUTH_ENCRYPTION_KEY && String(env.DONATE_OAUTH_ENCRYPTION_KEY).length >= 32);
}

function requireDonateOAuthProvider(providerId, env) {
  requireAccountConfiguration(env);
  const provider = donateOAuthProviderConfig(providerId, env);
  if (!provider) {
    const error = new Error("Bu donate platformu merkezi OAuth bağlantısını desteklemiyor.");
    error.code = "DONATE_OAUTH_PROVIDER_UNSUPPORTED";
    throw error;
  }
  if (!provider.configured) {
    const error = new Error(`${provider.name} bağlantı ayarları Worker'da tamamlanmamış.`);
    error.code = "DONATE_OAUTH_NOT_CONFIGURED";
    throw error;
  }
  return provider;
}

function donateOAuthResultRedirect(providerId, status, detail = "") {
  const target = new URL(FRONTEND_URL);
  target.searchParams.set("donate_oauth", status);
  target.searchParams.set("provider", providerId);
  if (detail) target.searchParams.set("detail", String(detail).slice(0, 180));
  return Response.redirect(target.toString(), 302);
}

async function beginDonateOAuth(request, env) {
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const providerId = donateBridgeText(input.providerId, 80);
  let provider;
  try {
    provider = requireDonateOAuthProvider(providerId, env);
  } catch (error) {
    return apiResponse(request, { error: error?.message || "Platform bağlantısı hazırlanamadı." }, error?.code === "DONATE_OAUTH_PROVIDER_UNSUPPORTED" ? 400 : 503);
  }
  const state = randomBase64Url(32);
  await saveOAuthState(`donate:${providerId}`, state, {
    userId: current.session.user.id,
    providerId,
    createdAt: Date.now(),
  }, env);
  const authorizeUrl = new URL(provider.authorizeUrl);
  authorizeUrl.searchParams.set("client_id", provider.clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", provider.redirectUri);
  authorizeUrl.searchParams.set("state", state);
  if (provider.scope) authorizeUrl.searchParams.set("scope", provider.scope);
  return apiResponse(request, {
    ok: true,
    providerId,
    providerName: provider.name,
    authorizeUrl: authorizeUrl.toString(),
  });
}

async function finishDonateOAuth(request, url, env, providerId) {
  let provider;
  try {
    await ensureUsersSchema(env);
    provider = requireDonateOAuthProvider(providerId, env);
    const providerError = String(url.searchParams.get("error") || "").trim();
    if (providerError) {
      return donateOAuthResultRedirect(providerId, "cancelled", "Platform izni verilmedi.");
    }
    const state = String(url.searchParams.get("state") || "").trim();
    const code = String(url.searchParams.get("code") || "").trim();
    if (!state || !code) return donateOAuthResultRedirect(providerId, "error", "OAuth dönüş bilgisi eksik.");
    const pending = await consumeOAuthState(`donate:${providerId}`, state, env);
    if (!pending?.userId || pending.providerId !== providerId) {
      return donateOAuthResultRedirect(providerId, "error", "Bağlantı isteğinin süresi dolmuş.");
    }
    const user = await getUserById(String(pending.userId), env);
    if (!user) return donateOAuthResultRedirect(providerId, "error", "Play Streamers hesabı bulunamadı.");
    const tokens = await exchangeDonateOAuthCode(provider, code);
    const identity = await fetchDonateOAuthIdentity(provider, tokens.accessToken);
    const connection = await saveDonateOAuthConnection(user.id, provider, tokens, identity, env);
    try {
      await syncOneDonateOAuthConnection(connection, env, { force: true, seedOnly: true });
    } catch (error) {
      await recordDonateOAuthError(connection.id, error, env);
    }
    return donateOAuthResultRedirect(providerId, "success");
  } catch (error) {
    logSecurityEvent("donate_oauth_callback_failed", { provider: providerId, reason: error?.code || error?.name || "unknown" });
    return donateOAuthResultRedirect(providerId, "error", provider?.name ? `${provider.name} bağlantısı tamamlanamadı.` : "Platform bağlantısı tamamlanamadı.");
  }
}

async function exchangeDonateOAuthCode(provider, code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    redirect_uri: provider.redirectUri,
    code,
  });
  const response = await fetchExternal(provider.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  }, { operation: `donate-oauth-token-${provider.id}` });
  const result = await safeJson(response);
  if (!response.ok || !result?.access_token) {
    const error = new Error(`${provider.name} erişim anahtarı alınamadı.`);
    error.code = `DONATE_OAUTH_TOKEN_${response.status}`;
    throw error;
  }
  return {
    accessToken: String(result.access_token),
    refreshToken: result.refresh_token ? String(result.refresh_token) : "",
    expiresAt: Number(result.expires_in) > 0 ? Date.now() + Number(result.expires_in) * 1000 : null,
    scopes: String(result.scope || provider.scope || "").split(/\s+/).filter(Boolean),
  };
}

async function fetchDonateOAuthIdentity(provider, accessToken) {
  const response = await fetchExternal(provider.profileUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  }, { operation: `donate-oauth-profile-${provider.id}`, retries: EXTERNAL_GET_RETRIES });
  const result = await safeJson(response);
  if (!response.ok || !result) {
    const error = new Error(`${provider.name} hesap bilgisi alınamadı.`);
    error.code = `DONATE_OAUTH_PROFILE_${response.status}`;
    throw error;
  }
  const data = result?.data && typeof result.data === "object" ? result.data : result;
  const primary = provider.id === "streamlabs" && data?.streamlabs && typeof data.streamlabs === "object"
    ? data.streamlabs
    : data;
  const providerUserId = String(primary?.id || primary?._id || data?.id || data?.user_id || data?.username || "").slice(0, 160);
  const displayName = String(
    primary?.display_name || primary?.displayName || primary?.name || primary?.username
      || data?.name || data?.username || data?.code || provider.name,
  ).slice(0, 160);
  let providerApiKey = "";
  if (provider.id === "tipeeestream") {
    const apiKeyResponse = await fetchExternal(provider.apiKeyUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    }, { operation: "donate-oauth-tipeee-api-key", retries: EXTERNAL_GET_RETRIES });
    const apiKeyResult = await safeJson(apiKeyResponse);
    providerApiKey = String(
      apiKeyResult?.apiKey || apiKeyResult?.api_key || apiKeyResult?.key
        || apiKeyResult?.data?.apiKey || apiKeyResult?.data?.api_key || apiKeyResult?.data?.key || "",
    ).trim();
    if (!apiKeyResponse.ok || !providerApiKey) {
      const error = new Error("TipeeeStream olay anahtarı alınamadı.");
      error.code = `DONATE_OAUTH_API_KEY_${apiKeyResponse.status}`;
      throw error;
    }
  }
  return { providerUserId, displayName, providerApiKey };
}

async function saveDonateOAuthConnection(userId, provider, tokens, identity, env) {
  const now = Date.now();
  const id = crypto.randomUUID();
  const accessCiphertext = await encryptDonateOAuthSecret(tokens.accessToken, env, `${provider.id}:access`);
  const refreshCiphertext = tokens.refreshToken
    ? await encryptDonateOAuthSecret(tokens.refreshToken, env, `${provider.id}:refresh`)
    : null;
  const apiKeyCiphertext = identity.providerApiKey
    ? await encryptDonateOAuthSecret(identity.providerApiKey, env, `${provider.id}:api-key`)
    : null;
  const cursor = JSON.stringify({ initialized: false, connectedAt: now, seenEventIds: [] });
  await env.DB.batch([
    env.DB.prepare(`UPDATE donate_oauth_connections SET revoked_at = ?1, updated_at = ?1,
      access_token_ciphertext = 'revoked', refresh_token_ciphertext = NULL,
      provider_api_key_ciphertext = NULL
      WHERE user_id = ?2 AND provider_id = ?3 AND revoked_at IS NULL`).bind(now, userId, provider.id),
    env.DB.prepare(`INSERT INTO donate_oauth_connections
      (id, user_id, provider_id, provider_user_id, provider_display_name,
        access_token_ciphertext, refresh_token_ciphertext, provider_api_key_ciphertext,
        token_expires_at, scopes_json, cursor_json, created_at, updated_at,
        last_sync_at, last_event_at, event_count, last_error, revoked_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12, NULL, NULL, 0, NULL, NULL)`)
      .bind(id, userId, provider.id, identity.providerUserId || null, identity.displayName || provider.name,
        accessCiphertext, refreshCiphertext, apiKeyCiphertext, tokens.expiresAt,
        JSON.stringify(tokens.scopes || []), cursor, now),
  ]);
  return getDonateOAuthConnectionById(id, env);
}

async function getDonateOAuthConnectionById(id, env) {
  return env.DB.prepare(`SELECT id, user_id, provider_id, provider_user_id, provider_display_name,
      access_token_ciphertext, refresh_token_ciphertext, provider_api_key_ciphertext,
      token_expires_at, scopes_json, cursor_json, created_at, updated_at,
      last_sync_at, last_event_at, event_count, last_error, revoked_at
    FROM donate_oauth_connections WHERE id = ?1 LIMIT 1`).bind(id).first();
}

async function listDonateOAuthConnections(request, env) {
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const result = await env.DB.prepare(`SELECT id, provider_id, provider_user_id, provider_display_name,
      token_expires_at, created_at, updated_at, last_sync_at, last_event_at, event_count, last_error
    FROM donate_oauth_connections
    WHERE user_id = ?1 AND revoked_at IS NULL
    ORDER BY updated_at DESC`).bind(current.session.user.id).all();
  return apiResponse(request, {
    ok: true,
    providers: Object.keys(DONATE_OAUTH_PROVIDERS).map(providerId => {
      const provider = donateOAuthProviderConfig(providerId, env);
      return { id: providerId, name: provider.name, configured: provider.configured };
    }),
    connections: (result?.results || []).map(row => {
      const provider = DONATE_OAUTH_PROVIDERS[String(row.provider_id || "")];
      return {
        id: String(row.id || ""),
        providerId: String(row.provider_id || ""),
        providerName: provider?.name || String(row.provider_id || "Donate"),
        accountId: row.provider_user_id ? String(row.provider_user_id) : null,
        accountName: row.provider_display_name ? String(row.provider_display_name) : null,
        connectedAt: new Date(Number(row.created_at || 0)).toISOString(),
        lastSyncAt: row.last_sync_at ? new Date(Number(row.last_sync_at)).toISOString() : null,
        lastEventAt: row.last_event_at ? new Date(Number(row.last_event_at)).toISOString() : null,
        eventCount: Number(row.event_count || 0),
        lastError: row.last_error ? String(row.last_error) : null,
        active: true,
      };
    }),
  });
}

async function disconnectDonateOAuth(request, env) {
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const providerId = donateBridgeText(input.providerId, 80);
  if (!DONATE_OAUTH_PROVIDERS[providerId]) return apiResponse(request, { error: "Platform bilgisi geçersiz." }, 400);
  const now = Date.now();
  const result = await env.DB.prepare(`UPDATE donate_oauth_connections
    SET revoked_at = ?1, updated_at = ?1, access_token_ciphertext = 'revoked',
      refresh_token_ciphertext = NULL, provider_api_key_ciphertext = NULL
    WHERE user_id = ?2 AND provider_id = ?3 AND revoked_at IS NULL`)
    .bind(now, current.session.user.id, providerId).run();
  if (Number(result?.meta?.changes || 0) !== 1) return apiResponse(request, { error: "Aktif API bağlantısı bulunamadı." }, 404);
  return apiResponse(request, { ok: true, disconnected: true, providerId });
}

async function syncDonateOAuthConnections(request, env) {
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const requestedProviderId = donateBridgeText(input.providerId, 80);
  const force = Boolean(input.force);
  if (requestedProviderId && !DONATE_OAUTH_PROVIDERS[requestedProviderId]) {
    return apiResponse(request, { error: "Platform bilgisi geçersiz." }, 400);
  }
  const query = requestedProviderId
    ? env.DB.prepare(`SELECT * FROM donate_oauth_connections WHERE user_id = ?1 AND provider_id = ?2 AND revoked_at IS NULL`).bind(current.session.user.id, requestedProviderId)
    : env.DB.prepare(`SELECT * FROM donate_oauth_connections WHERE user_id = ?1 AND revoked_at IS NULL`).bind(current.session.user.id);
  const result = await query.all();
  const connections = result?.results || [];
  const outcomes = [];
  for (const connection of connections) {
    try {
      outcomes.push(await syncOneDonateOAuthConnection(connection, env, { force }));
    } catch (error) {
      await recordDonateOAuthError(connection.id, error, env);
      outcomes.push({ providerId: String(connection.provider_id || ""), ok: false, error: "Platform verisi şu anda alınamadı." });
    }
  }
  return apiResponse(request, {
    ok: outcomes.every(item => item.ok !== false),
    inserted: outcomes.reduce((total, item) => total + Number(item.inserted || 0), 0),
    outcomes,
  });
}

async function syncOneDonateOAuthConnection(connection, env, options = {}) {
  const providerId = String(connection.provider_id || "");
  const provider = requireDonateOAuthProvider(providerId, env);
  const now = Date.now();
  if (!options.force && connection.last_sync_at && now - Number(connection.last_sync_at) < DONATE_OAUTH_SYNC_MIN_INTERVAL_MS) {
    return { providerId, ok: true, inserted: 0, skipped: true };
  }
  connection = await refreshDonateOAuthAccessTokenIfNeeded(connection, provider, env);
  const accessToken = await decryptDonateOAuthSecret(connection.access_token_ciphertext, env, `${providerId}:access`);
  const providerApiKey = connection.provider_api_key_ciphertext
    ? await decryptDonateOAuthSecret(connection.provider_api_key_ciphertext, env, `${providerId}:api-key`)
    : "";
  const events = await fetchDonateOAuthEvents(provider, accessToken, providerApiKey);
  let cursor = {};
  try { cursor = JSON.parse(String(connection.cursor_json || "{}")); } catch { cursor = {}; }
  const seenIds = new Set(Array.isArray(cursor.seenEventIds) ? cursor.seenEventIds.map(String) : []);
  const fetchedIds = events.map(event => String(event.providerEventId || "")).filter(Boolean);
  if (options.seedOnly || cursor.initialized !== true) {
    const nextCursor = {
      initialized: true,
      connectedAt: Number(cursor.connectedAt || connection.created_at || now),
      seenEventIds: [...new Set([...fetchedIds, ...seenIds])].slice(0, 250),
    };
    await env.DB.prepare(`UPDATE donate_oauth_connections
      SET cursor_json = ?1, last_sync_at = ?2, updated_at = ?2, last_error = NULL WHERE id = ?3`)
      .bind(JSON.stringify(nextCursor), now, connection.id).run();
    return { providerId, ok: true, inserted: 0, initialized: true };
  }
  const connectedAt = Number(cursor.connectedAt || connection.created_at || now);
  const freshEvents = events.filter(event => !seenIds.has(String(event.providerEventId))
    && Number(event.eventAt || now) >= connectedAt - 2 * 60 * 1000);
  const statements = freshEvents.map(event => {
    const id = crypto.randomUUID();
    return env.DB.prepare(`INSERT OR IGNORE INTO donate_bridge_events
      (id, user_id, device_id, provider_id, provider_name, provider_event_id, donor_name,
        amount_minor, currency, message, event_at, observed_at, source, integrity_hash, received_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`)
      .bind(id, connection.user_id, `oauth:${connection.id}`, providerId, provider.name,
        event.providerEventId, event.donorName, event.amountMinor, event.currency,
        event.message || null, event.eventAt, now, "provider-api", event.integrityHash || null, now);
  });
  const results = statements.length ? await env.DB.batch(statements) : [];
  const inserted = results.reduce((total, result) => total + Number(result?.meta?.changes || 0), 0);
  const newestEventAt = freshEvents.reduce((latest, event) => Math.max(latest, Number(event.eventAt || 0)), 0);
  const nextCursor = {
    initialized: true,
    connectedAt,
    seenEventIds: [...new Set([...fetchedIds, ...seenIds])].slice(0, 250),
  };
  await env.DB.prepare(`UPDATE donate_oauth_connections SET cursor_json = ?1,
      last_sync_at = ?2, last_event_at = CASE WHEN ?3 > 0 THEN ?3 ELSE last_event_at END,
      event_count = event_count + ?4, updated_at = ?2, last_error = NULL WHERE id = ?5`)
    .bind(JSON.stringify(nextCursor), now, newestEventAt, inserted, connection.id).run();
  return { providerId, ok: true, inserted };
}

async function refreshDonateOAuthAccessTokenIfNeeded(connection, provider, env) {
  const expiresAt = Number(connection.token_expires_at || 0);
  if (!expiresAt || expiresAt > Date.now() + 60 * 1000) return connection;
  if (!connection.refresh_token_ciphertext) {
    const error = new Error(`${provider.name} erişim izninin süresi dolmuş. Bağlantıyı yeniden kur.`);
    error.code = "DONATE_OAUTH_REFRESH_MISSING";
    throw error;
  }
  const refreshToken = await decryptDonateOAuthSecret(connection.refresh_token_ciphertext, env, `${provider.id}:refresh`);
  const body = new URLSearchParams({
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    refresh_token: refreshToken,
  });
  if (provider.id !== "tipeeestream") body.set("grant_type", "refresh_token");
  if (provider.id === "streamlabs") body.set("redirect_uri", provider.redirectUri);
  if (provider.id === "donationalerts" && provider.scope) body.set("scope", provider.scope);
  const response = await fetchExternal(provider.refreshUrl || provider.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  }, { operation: `donate-oauth-refresh-${provider.id}` });
  const result = await safeJson(response);
  if (!response.ok || !result?.access_token) {
    const error = new Error(`${provider.name} erişim izni yenilenemedi. Bağlantıyı yeniden kur.`);
    error.code = `DONATE_OAUTH_REFRESH_${response.status}`;
    throw error;
  }
  const accessCiphertext = await encryptDonateOAuthSecret(String(result.access_token), env, `${provider.id}:access`);
  const refreshCiphertext = result.refresh_token
    ? await encryptDonateOAuthSecret(String(result.refresh_token), env, `${provider.id}:refresh`)
    : connection.refresh_token_ciphertext;
  const nextExpiresAt = Number(result.expires_in) > 0 ? Date.now() + Number(result.expires_in) * 1000 : null;
  await env.DB.prepare(`UPDATE donate_oauth_connections SET access_token_ciphertext = ?1,
      refresh_token_ciphertext = ?2, token_expires_at = ?3, updated_at = ?4, last_error = NULL WHERE id = ?5`)
    .bind(accessCiphertext, refreshCiphertext, nextExpiresAt, Date.now(), connection.id).run();
  return { ...connection, access_token_ciphertext: accessCiphertext, refresh_token_ciphertext: refreshCiphertext, token_expires_at: nextExpiresAt };
}

async function fetchDonateOAuthEvents(provider, accessToken, providerApiKey) {
  const target = new URL(provider.eventsUrl);
  if (provider.id === "streamlabs") target.searchParams.set("limit", String(DONATE_OAUTH_EVENT_LIMIT));
  if (provider.id === "tipeeestream") {
    target.searchParams.set("apiKey", providerApiKey);
    target.searchParams.append("type[]", "donation");
    target.searchParams.set("limit", String(DONATE_OAUTH_EVENT_LIMIT));
    target.searchParams.set("order", "desc");
  }
  const headers = { Accept: "application/json" };
  if (provider.id !== "tipeeestream") headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetchExternal(target.toString(), { headers }, {
    operation: `donate-oauth-events-${provider.id}`,
    retries: EXTERNAL_GET_RETRIES,
  });
  const result = await safeJson(response);
  if (!response.ok || !result) {
    const error = new Error(`${provider.name} donate verileri alınamadı.`);
    error.code = `DONATE_OAUTH_EVENTS_${response.status}`;
    throw error;
  }
  const rows = Array.isArray(result) ? result
    : Array.isArray(result.data) ? result.data
      : Array.isArray(result.events) ? result.events : [];
  const normalized = [];
  for (const row of rows.slice(0, DONATE_OAUTH_EVENT_LIMIT)) {
    const event = await normalizeDonateOAuthEvent(provider, row);
    if (event) normalized.push(event);
  }
  return normalized;
}

async function normalizeDonateOAuthEvent(provider, row) {
  if (!row || typeof row !== "object") return null;
  if (provider.id === "tipeeestream" && String(row.type || "").toLowerCase() !== "donation") return null;
  const parameters = row.parameters && typeof row.parameters === "object" ? row.parameters : {};
  const rawId = row.donation_id ?? row.id ?? row._id ?? row.event_id ?? row.ref;
  const donorName = donateBridgeText(
    row.username ?? row.name ?? row.from ?? parameters.username ?? parameters.name ?? row.user?.username,
    160,
    "İsimsiz destekçi",
  );
  const rawAmount = row.amount ?? row.amount_value ?? row.amountValue ?? parameters.amount ?? row["parameters.amount"] ?? 0;
  const amount = Number(String(rawAmount).replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) return null;
  const currency = String(row.currency ?? row.currency_code ?? parameters.currency ?? parameters.currency_code ?? "EUR")
    .trim().toUpperCase().slice(0, 3);
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  const message = donateBridgeText(row.message ?? row.comment ?? parameters.message ?? parameters.comment, 1000);
  const timeValue = row.created_at ?? row.createdAt ?? row.inserted_at ?? row.insertedAt ?? row.timestamp ?? row.date;
  const numericTime = Number(timeValue);
  const parsedTime = Number.isFinite(numericTime) && numericTime > 0
    ? (numericTime < 10_000_000_000 ? numericTime * 1000 : numericTime)
    : Date.parse(String(timeValue || ""));
  const eventAt = Number.isFinite(parsedTime) ? parsedTime : Date.now();
  const providerEventId = donateBridgeText(rawId, 320)
    || await sha256Base64Url([provider.id, donorName, amount, currency, message, eventAt].join("\u001f"));
  return {
    providerEventId,
    donorName,
    amountMinor: Math.round(amount * 100),
    currency,
    message,
    eventAt,
    integrityHash: await sha256Hex(JSON.stringify(row)),
  };
}

async function recordDonateOAuthError(connectionId, error, env) {
  const message = String(error?.message || "Platform verisi alınamadı.").slice(0, 240);
  await env.DB.prepare(`UPDATE donate_oauth_connections SET last_error = ?1,
    last_sync_at = ?2, updated_at = ?2 WHERE id = ?3`).bind(message, Date.now(), connectionId).run();
}

async function donateOAuthEncryptionKey(env) {
  if (!isDonateOAuthEncryptionConfigured(env)) throw new Error("Worker is missing the donate OAuth encryption configuration");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(env.DONATE_OAUTH_ENCRYPTION_KEY)));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptDonateOAuthSecret(value, env, context) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await donateOAuthEncryptionKey(env);
  const additionalData = new TextEncoder().encode(`play-streamers:donate-oauth:v1:${context}`);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    key,
    new TextEncoder().encode(String(value)),
  );
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

async function decryptDonateOAuthSecret(value, env, context) {
  const parts = String(value || "").split(".");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("Invalid donate OAuth secret");
  const key = await donateOAuthEncryptionKey(env);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64UrlToBytes(parts[1]),
      additionalData: new TextEncoder().encode(`play-streamers:donate-oauth:v1:${context}`),
    },
    key,
    base64UrlToBytes(parts[2]),
  );
  return new TextDecoder().decode(plaintext);
}

async function createDonateWebhookConnection(request, env) {
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const providerId = donateBridgeText(input.providerId, 80);
  const provider = DONATE_PROVIDER_BY_ID.get(providerId);
  if (!provider?.serverWebhook) {
    return apiResponse(request, { error: "Bu platform doğrudan bildirim bağlantısını desteklemiyor." }, 400);
  }
  const userId = current.session.user.id;
  const now = Date.now();
  const recent = await env.DB.prepare(`SELECT COUNT(*) AS total FROM donate_webhook_connections
    WHERE user_id = ?1 AND created_at >= ?2`).bind(userId, now - 10 * 60 * 1000).first();
  if (Number(recent?.total || 0) >= 12) {
    return apiResponse(request, { error: "Çok sık bağlantı oluşturdun. Birkaç dakika sonra tekrar dene." }, 429);
  }
  const id = crypto.randomUUID();
  const token = randomBase64Url(48);
  const tokenHash = await donateWebhookTokenHash(token);
  await env.DB.batch([
    env.DB.prepare(`UPDATE donate_webhook_connections SET revoked_at = ?1
      WHERE user_id = ?2 AND provider_id = ?3 AND revoked_at IS NULL`).bind(now, userId, providerId),
    env.DB.prepare(`INSERT INTO donate_webhook_connections
      (id, user_id, provider_id, token_hash, created_at, last_event_at, event_count, revoked_at)
      VALUES (?1, ?2, ?3, ?4, ?5, NULL, 0, NULL)`)
      .bind(id, userId, providerId, tokenHash, now),
  ]);
  return apiResponse(request, {
    ok: true,
    connection: {
      id,
      providerId,
      providerName: provider.name,
      webhookUrl: `${API_ORIGIN}/api/donate-webhooks/incoming/${providerId}/${token}`,
      webhookToken: providerId === "sociabuzz" ? token : "",
      setupUrl: provider.setupUrl || "",
      supportLevel: provider.supportLevel,
      connectedAt: new Date(now).toISOString(),
    },
  });
}

async function revokeDonateWebhookConnection(request, env) {
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const connectionId = String(input.connectionId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(connectionId)) {
    return apiResponse(request, { error: "Bağlantı kimliği geçersiz." }, 400);
  }
  const result = await env.DB.prepare(`UPDATE donate_webhook_connections SET revoked_at = ?1
    WHERE id = ?2 AND user_id = ?3 AND revoked_at IS NULL`)
    .bind(Date.now(), connectionId, current.session.user.id).run();
  if (Number(result?.meta?.changes || 0) !== 1) {
    return apiResponse(request, { error: "Aktif sunucu bağlantısı bulunamadı." }, 404);
  }
  return apiResponse(request, { ok: true, revoked: true });
}

async function testDonateWebhookConnection(request, env) {
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const connectionId = String(input.connectionId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(connectionId)) {
    return apiResponse(request, { error: "Bağlantı kimliği geçersiz." }, 400);
  }
  const connection = await env.DB.prepare(`SELECT id, user_id, provider_id FROM donate_webhook_connections
    WHERE id = ?1 AND user_id = ?2 AND revoked_at IS NULL LIMIT 1`)
    .bind(connectionId, current.session.user.id).first();
  if (!connection) return apiResponse(request, { error: "Aktif sunucu bağlantısı bulunamadı." }, 404);
  const provider = DONATE_PROVIDER_BY_ID.get(String(connection.provider_id || ""));
  if (!provider) return apiResponse(request, { error: "Platform bilgisi bulunamadı." }, 404);
  const now = Date.now();
  const providerEventId = `connection-test:${crypto.randomUUID()}`;
  const source = "provider-webhook-test";
  const integrityHash = await sha256Hex(`${connection.id}:${providerEventId}:${now}`);
  const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO donate_bridge_events
    (id, user_id, device_id, provider_id, provider_name, provider_event_id, donor_name,
      amount_minor, currency, message, event_at, observed_at, source, integrity_hash, received_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11, ?12, ?13, ?11)`)
    .bind(
      crypto.randomUUID(),
      current.session.user.id,
      `webhook:${connection.id}`,
      provider.id,
      provider.name,
      providerEventId,
      "Play Streamers Test",
      100,
      provider.region === "Türkiye" ? "TRY" : "USD",
      "SSB başarıyla doğrulandı.",
      now,
      source,
      integrityHash,
    ).run();
  if (Number(inserted?.meta?.changes || 0) !== 1) {
    return apiResponse(request, { error: "Test olayı oluşturulamadı." }, 409);
  }
  await env.DB.prepare(`UPDATE donate_webhook_connections
    SET last_event_at = ?1, event_count = event_count + 1 WHERE id = ?2`)
    .bind(now, connection.id).run();
  return apiResponse(request, { ok: true, accepted: true, eventId: providerEventId });
}

async function readDonateWebhookPayload(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_DONATE_WEBHOOK_BODY_BYTES) {
    const error = new Error("Donate bildirimi çok büyük.");
    error.code = "BODY_TOO_LARGE";
    throw error;
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_DONATE_WEBHOOK_BODY_BYTES) {
    const error = new Error("Donate bildirimi çok büyük.");
    error.code = "BODY_TOO_LARGE";
    throw error;
  }
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  let payload = {};
  if (contentType.includes("application/json")) {
    try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
  } else {
    const form = Object.fromEntries(new URLSearchParams(raw));
    const nested = form.data || form.payload;
    if (nested) {
      try { payload = { ...form, ...JSON.parse(nested) }; } catch { payload = form; }
    } else {
      payload = form;
    }
  }
  return { payload: payload && typeof payload === "object" ? payload : {}, raw };
}

function donateWebhookNodes(payload) {
  const nodes = [];
  const queue = [payload];
  const visited = new Set();
  while (queue.length && nodes.length < 250) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || visited.has(value)) continue;
    visited.add(value);
    if (!Array.isArray(value)) nodes.push(value);
    for (const child of Array.isArray(value) ? value : Object.values(value)) {
      if (child && typeof child === "object") queue.push(child);
    }
  }
  return nodes;
}

function firstDonateWebhookValue(nodes, keys) {
  for (const node of nodes) {
    for (const key of keys) {
      const value = node?.[key];
      if (value !== undefined && value !== null && value !== "" && typeof value !== "object") return value;
    }
  }
  return "";
}

function parseDonateWebhookAmountMinor(providerId, nodes) {
  const minor = Number(firstDonateWebhookValue(nodes, [
    "amount_minor", "amountMinor", "amount_cents", "amountCents", "grossAmountInCents",
    "netAmountInCents", "monthly_price_in_cents", "currently_entitled_amount_cents", "price_cents"
  ]));
  if (Number.isSafeInteger(minor) && minor > 0) return minor;
  const coffeePrice = Number(firstDonateWebhookValue(nodes, ["support_coffee_price"]));
  const coffeeCount = Number(firstDonateWebhookValue(nodes, ["support_coffees"]));
  if (coffeePrice > 0 && coffeeCount > 0) return Math.round(coffeePrice * coffeeCount * 100);
  const raw = String(firstDonateWebhookValue(nodes, [
    "amount", "value", "total", "gross", "donation_amount", "support_amount", "price", "net_amount"
  ]) || "").replace(/[^\d,.-]/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",") && !raw.includes(".") ? raw.replace(",", ".") : raw.replace(/,/g, "");
  const decimal = Number(normalized);
  return Number.isFinite(decimal) && decimal > 0 ? Math.round(decimal * 100) : 0;
}

function donateWebhookEventHint(request, payload) {
  const nodes = donateWebhookNodes(payload);
  return [
    firstDonateWebhookValue(nodes, ["event_type", "eventType", "event", "type", "topic"]),
    firstDonateWebhookValue(nodes, ["action", "status", "payment_status", "paymentStatus"]),
  ].filter(Boolean).join(" ").trim().toLowerCase();
}

function donateWebhookEventAllowed(providerId, request, payload) {
  const hint = donateWebhookEventHint(request, payload);
  if (!hint) return true;
  if (/(refund|refunded|refunds|fail|failed|failure|cancel|cancelled|canceled|delete|deleted|revoke|revoked|decline|declined|expire|expired|chargeback|dispute)/i.test(hint)) {
    return false;
  }
  return true;
}

async function normalizeDonateWebhookEvent(provider, payload, raw, now) {
  const nodes = donateWebhookNodes(payload);
  const amountMinor = parseDonateWebhookAmountMinor(provider.id, nodes);
  if (!amountMinor) return null;
  const explicitId = donateBridgeText(firstDonateWebhookValue(nodes, [
    "message_id", "event_id", "eventId", "donation_id", "donationId", "transaction_id",
    "transactionId", "sale_id", "support_id", "payment_id", "order_id", "webhookId", "id"
  ]), 320);
  const donorName = donateBridgeText(firstDonateWebhookValue(nodes, [
    "from_name", "displayName", "supporter_name", "supporterName", "username", "payer_name",
    "customer_name", "full_name", "name", "email", "sender"
  ]), 160, "İsimsiz destekçi");
  const message = donateBridgeText(firstDonateWebhookValue(nodes, [
    "message", "supporter_message", "support_note", "note", "comment", "description"
  ]), 1000);
  const currency = String(firstDonateWebhookValue(nodes, ["currency", "currency_code", "currencyCode"]) || provider.defaultCurrency || (provider.region === "Türkiye" ? "TRY" : "USD")).toUpperCase().slice(0, 3);
  const timeValue = firstDonateWebhookValue(nodes, ["created_at", "createdAt", "timestamp", "paid_at", "event_at", "date"]);
  const parsedTime = Date.parse(String(timeValue || ""));
  const eventAt = Number.isFinite(parsedTime) ? parsedTime : now;
  const identity = explicitId || await sha256Base64Url([
    provider.id, donorName, amountMinor, currency, message,
    Number.isFinite(parsedTime) ? eventAt : "", raw.slice(0, 4000)
  ].join("\u001f"));
  return {
    schemaVersion: 1,
    eventId: identity,
    providerId: provider.id,
    providerName: provider.name,
    donorName,
    amountMinor,
    currency,
    message,
    eventAt,
    observedAt: now,
    source: "provider-webhook",
    integrityHash: await sha256Hex(raw || JSON.stringify(payload)),
  };
}

async function receiveDonateProviderWebhook(request, env, providerId, token) {
  await ensureUsersSchema(env);
  const provider = DONATE_PROVIDER_BY_ID.get(providerId);
  if (!provider?.serverWebhook) return apiResponse(request, { error: "Platform bağlantısı desteklenmiyor." }, 404);
  const tokenHash = await donateWebhookTokenHash(token);
  const connection = await env.DB.prepare(`SELECT id, user_id, provider_id
    FROM donate_webhook_connections WHERE token_hash = ?1 AND provider_id = ?2 AND revoked_at IS NULL LIMIT 1`)
    .bind(tokenHash, providerId).first();
  if (!connection) return apiResponse(request, { error: "Donate bildirim bağlantısı geçersiz veya kapatılmış." }, 404);
  let decoded;
  try {
    decoded = await readDonateWebhookPayload(request);
  } catch (error) {
    return apiResponse(request, { error: error?.message || "Donate bildirimi okunamadı." }, error?.code === "BODY_TOO_LARGE" ? 413 : 400);
  }
  if (!donateWebhookEventAllowed(providerId, request, decoded.payload)) {
    return apiResponse(request, { ok: true, accepted: false, ignored: true, reason: "non-payment-event" });
  }
  const now = Date.now();
  const normalized = await normalizeDonateWebhookEvent(provider, decoded.payload, decoded.raw, now);
  if (!normalized) {
    return apiResponse(request, { ok: true, accepted: false, ignored: true, reason: "payment-event-not-found" });
  }
  const validation = validateDonateBridgeEvent(normalized, now);
  if (validation.error) return apiResponse(request, { error: validation.error }, 400);
  const event = validation.event;
  const recent = await env.DB.prepare(`SELECT COUNT(*) AS total FROM donate_bridge_events
    WHERE device_id = ?1 AND received_at >= ?2`).bind(`webhook:${connection.id}`, now - 60 * 1000).first();
  if (Number(recent?.total || 0) >= DONATE_BRIDGE_MAX_EVENTS_PER_MINUTE) {
    return apiResponse(request, { error: "Platform çok hızlı veri gönderiyor. Kısa süre sonra yeniden dene." }, 429);
  }
  const id = crypto.randomUUID();
  const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO donate_bridge_events
    (id, user_id, device_id, provider_id, provider_name, provider_event_id, donor_name,
      amount_minor, currency, message, event_at, observed_at, source, integrity_hash, received_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`)
    .bind(id, connection.user_id, `webhook:${connection.id}`, event.providerId, event.providerName,
      event.providerEventId, event.donorName, event.amountMinor, event.currency, event.message || null,
      event.eventAt, event.observedAt, event.source, event.integrityHash, now).run();
  const duplicate = Number(inserted?.meta?.changes || 0) === 0;
  if (!duplicate) {
    await env.DB.prepare(`UPDATE donate_webhook_connections
      SET last_event_at = ?1, event_count = event_count + 1 WHERE id = ?2`)
      .bind(now, connection.id).run();
  }
  return apiResponse(request, { ok: true, accepted: true, duplicate, eventId: event.providerEventId });
}

async function listDonateBridgeDevices(request, env) {
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const result = await env.DB.prepare(`SELECT
      d.id, d.name, d.app_version, d.created_at, d.last_seen_at, d.revoked_at, d.provider_status_json,
      COUNT(e.id) AS event_count,
      COUNT(DISTINCT e.provider_id) AS provider_count,
      GROUP_CONCAT(DISTINCT e.provider_name) AS provider_names,
      MAX(e.received_at) AS last_event_at,
      (SELECT e2.provider_name FROM donate_bridge_events e2
        WHERE e2.device_id = d.id ORDER BY e2.received_at DESC LIMIT 1) AS last_provider
    FROM donate_bridge_devices d
    LEFT JOIN donate_bridge_events e ON e.device_id = d.id
    WHERE d.user_id = ?1 AND d.revoked_at IS NULL
    GROUP BY d.id
    ORDER BY d.created_at DESC
    LIMIT 20`).bind(current.session.user.id).all();
  const webhookConnections = await listActiveDonateWebhookConnections(current.session.user.id, env);
  return apiResponse(request, {
    ok: true,
    providerCatalogVersion: DONATE_PROVIDER_CATALOG_VERSION,
    providers: DONATE_PROVIDER_CATALOG,
    webhookConnections,
    devices: (result?.results || []).map(row => {
      let connectedProviderIds = [];
      try { connectedProviderIds = JSON.parse(String(row.provider_status_json || "[]")); } catch { connectedProviderIds = []; }
      connectedProviderIds = connectedProviderIds.filter(id => DONATE_PROVIDER_BY_ID.has(id));
      const eventProviderNames = String(row.provider_names || "").split(",").map(value => value.trim()).filter(Boolean);
      const connectedProviderNames = connectedProviderIds.map(id => DONATE_PROVIDER_BY_ID.get(id)?.name).filter(Boolean);
      const providerNames = [...new Set([...connectedProviderNames, ...eventProviderNames])].slice(0, 33);
      return {
        id: String(row.id || ""),
        name: String(row.name || "Windows cihazı"),
        appVersion: row.app_version ? String(row.app_version) : null,
        pairedAt: new Date(Number(row.created_at || 0)).toISOString(),
        lastSeenAt: row.last_seen_at ? new Date(Number(row.last_seen_at)).toISOString() : null,
        revokedAt: row.revoked_at ? new Date(Number(row.revoked_at)).toISOString() : null,
        active: !row.revoked_at,
        eventCount: Number(row.event_count || 0),
        providerCount: providerNames.length,
        providerNames,
        connectedProviderIds,
        connectedProviderNames,
        lastEventAt: row.last_event_at ? new Date(Number(row.last_event_at)).toISOString() : null,
        lastProvider: row.last_provider ? String(row.last_provider) : null,
      };
    }),
  });
}

async function listDonateBridgeEvents(request, env, url) {
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const afterValue = Number(url.searchParams.get("after") || 0);
  const after = Number.isSafeInteger(afterValue) && afterValue > 0 ? afterValue : 0;
  const result = await env.DB.prepare(`SELECT
      id, provider_id, provider_name, provider_event_id, donor_name, amount_minor,
      currency, message, event_at, observed_at, source, received_at
    FROM donate_bridge_events
    WHERE user_id = ?1 AND received_at > ?2
    ORDER BY received_at ASC
    LIMIT 200`).bind(current.session.user.id, after).all();
  const events = (result?.results || []).map(row => ({
    id: String(row.id || ""),
    providerId: String(row.provider_id || ""),
    providerName: String(row.provider_name || "Donate"),
    providerEventId: String(row.provider_event_id || ""),
    donorName: String(row.donor_name || "İsimsiz destekçi"),
    amountMinor: Number(row.amount_minor || 0),
    currency: String(row.currency || "TRY"),
    message: row.message ? String(row.message) : "",
    eventAt: row.event_at ? Number(row.event_at) : null,
    observedAt: Number(row.observed_at || 0),
    source: String(row.source || ""),
    receivedAt: Number(row.received_at || 0),
  }));
  return apiResponse(request, {
    ok: true,
    events,
    nextAfter: events.length ? events[events.length - 1].receivedAt : after,
    hasMore: events.length === 200,
  });
}

async function revokeDonateBridgeDevice(request, env) {
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const deviceId = String(input.deviceId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(deviceId)) {
    return apiResponse(request, { error: "Cihaz kimliği geçersiz." }, 400);
  }
  const result = await env.DB.prepare(`UPDATE donate_bridge_devices SET revoked_at = ?1
    WHERE id = ?2 AND user_id = ?3 AND revoked_at IS NULL`)
    .bind(Date.now(), deviceId, current.session.user.id).run();
  if (Number(result?.meta?.changes || 0) !== 1) {
    return apiResponse(request, { error: "Aktif Donate Bridge cihazı bulunamadı." }, 404);
  }
  return apiResponse(request, { ok: true, revoked: true });
}

function validateDonateBridgeEvent(input, now) {
  const value = input && typeof input === "object" ? input : {};
  if (Number(value.schemaVersion) !== 1) return { error: "Destek olayı şema sürümü desteklenmiyor." };
  const providerId = donateBridgeText(value.providerId, 80);
  const catalogProvider = DONATE_PROVIDER_BY_ID.get(providerId);
  const providerName = catalogProvider?.name || donateBridgeText(value.providerName, 80);
  const providerEventId = donateBridgeText(value.eventId, 320);
  const donorName = donateBridgeText(value.donorName, 160, "İsimsiz destekçi");
  const message = donateBridgeText(value.message, 1000);
  const amountMinor = Number(value.amountMinor);
  const currency = String(value.currency || "").trim().toUpperCase();
  const source = String(value.source || "");
  const observedAt = Number(value.observedAt);
  const rawEventAt = value.eventAt === null || value.eventAt === undefined ? null : Number(value.eventAt);
  const eventAt = Number.isFinite(rawEventAt) ? Math.trunc(rawEventAt) : null;
  const integrityHash = String(value.integrityHash || "").trim().toLowerCase();

  if (!providerId || !providerName || !providerEventId) return { error: "Sağlayıcı veya olay kimliği eksik." };
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || amountMinor > 1_000_000_000) {
    return { error: "Destek tutarı geçersiz." };
  }
  if (!/^[A-Z]{3}$/.test(currency)) return { error: "Para birimi geçersiz." };
  if (!["local-history", "local-alert", "browser-session", "provider-api", "provider-webhook"].includes(source)) {
    return { error: "Olay kaynağı geçersiz." };
  }
  if (!Number.isSafeInteger(observedAt) || observedAt > now + 5 * 60 * 1000 || observedAt < now - DONATE_BRIDGE_MAX_EVENT_AGE_MS) {
    return { error: "Olay zamanı geçersiz." };
  }
  if (eventAt !== null && (eventAt > now + 5 * 60 * 1000 || eventAt < now - DONATE_BRIDGE_MAX_EVENT_AGE_MS)) {
    return { error: "Destek zamanı geçersiz." };
  }
  if (integrityHash && !/^[a-f0-9]{64}$/.test(integrityHash)) return { error: "Olay bütünlük özeti geçersiz." };
  return {
    event: {
      providerId,
      providerName,
      providerEventId,
      donorName,
      amountMinor,
      currency,
      message,
      eventAt,
      observedAt: Math.trunc(observedAt),
      source,
      integrityHash: integrityHash || null,
    },
  };
}

async function receiveDonateBridgeEvent(request, env) {
  await ensureUsersSchema(env);
  const device = await authenticateDonateBridgeDevice(request, env);
  if (!device) return apiResponse(request, { error: "Donate Bridge bağlantısı bulunamadı veya iptal edilmiş." }, 401);

  const now = Date.now();
  const input = await requestJson(request);
  const validation = validateDonateBridgeEvent(input.event, now);
  if (validation.error) return apiResponse(request, { error: validation.error }, 400);
  const event = validation.event;

  const recent = await env.DB.prepare(`SELECT COUNT(*) AS total FROM donate_bridge_events
    WHERE device_id = ?1 AND received_at >= ?2`).bind(device.id, now - 60 * 1000).first();
  if (Number(recent?.total || 0) >= DONATE_BRIDGE_MAX_EVENTS_PER_MINUTE) {
    return apiResponse(request, { error: "Donate Bridge çok hızlı veri gönderiyor. Kısa süre sonra yeniden denenecek." }, 429);
  }

  const id = crypto.randomUUID();
  const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO donate_bridge_events
    (id, user_id, device_id, provider_id, provider_name, provider_event_id, donor_name,
      amount_minor, currency, message, event_at, observed_at, source, integrity_hash, received_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`)
    .bind(
      id, device.user_id, device.id, event.providerId, event.providerName, event.providerEventId,
      event.donorName, event.amountMinor, event.currency, event.message || null, event.eventAt,
      event.observedAt, event.source, event.integrityHash, now,
    ).run();
  if (!device.last_seen_at || now - Number(device.last_seen_at) >= DONATE_BRIDGE_DEVICE_TOUCH_INTERVAL_MS) {
    await env.DB.prepare("UPDATE donate_bridge_devices SET last_seen_at = ?1, app_version = COALESCE(?2, app_version) WHERE id = ?3")
      .bind(now, donateBridgeText(request.headers.get("X-Play-Streamers-Bridge"), 24) || null, device.id)
      .run();
  }
  const duplicate = Number(inserted?.meta?.changes || 0) === 0;
  const deviceTotal = await env.DB.prepare(`SELECT COUNT(*) AS total FROM donate_bridge_events
    WHERE device_id = ?1`).bind(device.id).first();
  return apiResponse(request, {
    ok: true,
    accepted: true,
    duplicate,
    deviceEventCount: Number(deviceTotal?.total || 0),
    event: {
      id: duplicate ? null : id,
      providerId: event.providerId,
      providerName: event.providerName,
      eventId: event.providerEventId,
      donorName: event.donorName,
      amountMinor: event.amountMinor,
      currency: event.currency,
      message: event.message,
      eventAt: event.eventAt ? new Date(event.eventAt).toISOString() : null,
      receivedAt: new Date(now).toISOString(),
    },
  });
}

async function upsertGoogleUser(googleUser, env) {
  await ensureUsersSchema(env);
  const now = new Date().toISOString();
  let user = await env.DB
    .prepare("SELECT id FROM users WHERE google_sub = ?1 OR (email_linked = 1 AND email = ?2) LIMIT 1")
    .bind(googleUser.sub, googleUser.email)
    .first();

  if (user) {
    await env.DB
      .prepare("UPDATE users SET google_sub = ?1, email = ?2, display_name = ?3, avatar_url = ?4, updated_at = ?5 WHERE id = ?6")
      .bind(googleUser.sub, googleUser.email, googleUser.name, googleUser.picture, now, user.id)
      .run();
  } else {
    user = {
      id: randomBase64Url(24),
    };
    await env.DB
      .prepare("INSERT INTO users (id, google_sub, email, email_linked, display_name, avatar_url, created_at, updated_at) VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?6)")
      .bind(user.id, googleUser.sub, googleUser.email, googleUser.name, googleUser.picture, now)
      .run();
  }

  return getUserById(user.id, env);
}

async function upsertKickUser(kickUser, env) {
  await ensureUsersSchema(env);
  const kickId = String(kickUser?.id || "").trim();
  if (!kickId) throw new Error("Kick user identifier was missing");

  const now = new Date().toISOString();
  const kickUsername = String(kickUser?.username || "Kick kullanıcısı").trim().slice(0, 120) || "Kick kullanıcısı";
  let user = await env.DB
    .prepare("SELECT id FROM users WHERE kick_user_id = ?1 LIMIT 1")
    .bind(kickId)
    .first();

  if (user) {
    await env.DB
      .prepare("UPDATE users SET kick_username = ?1, display_name = CASE WHEN username IS NULL THEN ?1 ELSE display_name END, updated_at = ?2 WHERE id = ?3")
      .bind(kickUsername, now, user.id)
      .run();
  } else {
    user = { id: randomBase64Url(24) };
    const internalEmail = `kick-${kickId}-${user.id.slice(0, 8)}@local.play-streamers.invalid`;
    await env.DB
      .prepare("INSERT INTO users (id, google_sub, kick_user_id, kick_username, email, email_linked, display_name, avatar_url, created_at, updated_at) VALUES (?1, NULL, ?2, ?3, ?4, 0, ?3, NULL, ?5, ?5)")
      .bind(user.id, kickId, kickUsername, internalEmail, now)
      .run();
  }

  return getUserById(user.id, env);
}

// These lookups deliberately return the same public shape used by the rest of
// the app. They allow the OAuth buttons in the sign-in dialog to distinguish
// an existing account from a new registration without exposing private fields.
async function getUserByGoogleIdentity(googleSub, email, env) {
  const row = await env.DB
    .prepare("SELECT id FROM users WHERE google_sub = ?1 OR (email_linked = 1 AND lower(email) = lower(?2)) LIMIT 1")
    .bind(String(googleSub || ""), String(email || ""))
    .first();
  return row?.id ? getUserById(row.id, env) : null;
}

async function getUserByKickId(kickId, env) {
  const row = await env.DB
    .prepare("SELECT id FROM users WHERE kick_user_id = ?1 LIMIT 1")
    .bind(String(kickId || ""))
    .first();
  return row?.id ? getUserById(row.id, env) : null;
}

async function ensureUsersSchema(env) {
  if (!env.DB) throw new Error("Worker is missing the DB binding");
  if (usersSchemaReady) {
    await ensureDesktopPlatformSchema(env);
    await maintainSecurityStorage(env);
    return;
  }
  if (!usersSchemaPromise) {
    usersSchemaPromise = ensureUsersSchemaInD1(env).finally(() => {
      usersSchemaPromise = null;
    });
  }
  await usersSchemaPromise;
  await ensureDesktopPlatformSchema(env);
  await maintainSecurityStorage(env);
}

async function ensureDesktopPlatformSchema(env) {
  if (desktopPlatformSchemaReady) return;
  if (!desktopPlatformSchemaPromise) {
    desktopPlatformSchemaPromise = ensureDesktopPlatformSchemaInD1(env).finally(() => {
      desktopPlatformSchemaPromise = null;
    });
  }
  await desktopPlatformSchemaPromise;
}

async function ensureDesktopPlatformSchemaInD1(env) {
  await addColumnIfMissing(env, "sw_identity_user_id TEXT");
  await env.DB.batch([
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_sw_identity_user_id ON users(sw_identity_user_id) WHERE sw_identity_user_id IS NOT NULL"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ps_user_entitlements (
      user_id TEXT PRIMARY KEY NOT NULL,
      tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'product-pro')),
      status TEXT NOT NULL,
      identity_version TEXT,
      source TEXT NOT NULL,
      expires_at INTEGER,
      synced_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ps_feature_settings (
      user_id TEXT NOT NULL,
      feature_id TEXT NOT NULL,
      value_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, feature_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ps_stream_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      title TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      peak_viewers INTEGER NOT NULL DEFAULT 0,
      interactions INTEGER NOT NULL DEFAULT 0,
      followers_gained INTEGER NOT NULL DEFAULT 0,
      revenue_minor INTEGER NOT NULL DEFAULT 0,
      summary_json TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ps_stream_sessions_user_started ON ps_stream_sessions(user_id, started_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ps_stream_runtime (
      user_id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL UNIQUE,
      kick_session_id TEXT NOT NULL,
      broadcaster_user_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('live', 'ended')),
      last_observed_at INTEGER NOT NULL,
      last_subscription_check_at INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES ps_stream_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ps_stream_runtime_status_observed ON ps_stream_runtime(status, last_observed_at)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ps_stream_samples (
      session_id TEXT NOT NULL,
      sample_minute INTEGER NOT NULL,
      viewer_count INTEGER NOT NULL,
      observed_at INTEGER NOT NULL,
      PRIMARY KEY (session_id, sample_minute),
      FOREIGN KEY (session_id) REFERENCES ps_stream_sessions(id) ON DELETE CASCADE
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ps_stream_samples_session_observed ON ps_stream_samples(session_id, observed_at)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ps_kick_monitor_state (
      user_id TEXT PRIMARY KEY NOT NULL,
      kick_session_id TEXT NOT NULL,
      broadcaster_user_id TEXT,
      last_checked_at INTEGER NOT NULL DEFAULT 0,
      last_subscription_check_at INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ps_kick_monitor_state_checked ON ps_kick_monitor_state(last_checked_at)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ps_ai_insights (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      insight_type TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      result_json TEXT NOT NULL,
      model TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_ps_ai_insights_cache ON ps_ai_insights(user_id, insight_type, input_hash)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ps_ai_insights_expires ON ps_ai_insights(expires_at)"),
  ]);
  desktopPlatformSchemaReady = true;
}

async function ensureUsersSchemaInD1(env) {
  const schemaMarker = "schema:play-streamers-users:v14";
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS play_streamers_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await ensureSupportSchemaInD1(env);
  const twoFactorSchemaReady = await ensureTwoFactorSchemaInD1(env);
  const totpSchemaReady = await ensureTotpSchemaInD1(env);
  const trustedTwoFactorSchemaReady = await ensureTrustedTwoFactorSchemaInD1(env);
  const siteMetricsSchemaReady = await ensureSiteMetricsSchemaInD1(env);
  const donateBridgeSchemaReady = await ensureDonateBridgeSchemaInD1(env);
  const kickMetricsSchemaReady = await ensureKickMetricsSchemaInD1(env);
  const donateOAuthSchemaReady = await ensureDonateOAuthSchemaInD1(env);
  const accountDevicesSchemaReady = await ensureAccountDevicesSchemaInD1(env);
  const current = await env.DB.prepare("SELECT value FROM play_streamers_metadata WHERE key = ?1 LIMIT 1")
    .bind(schemaMarker).first();
  if (current?.value === "1" && twoFactorSchemaReady && totpSchemaReady && trustedTwoFactorSchemaReady && siteMetricsSchemaReady && donateBridgeSchemaReady && kickMetricsSchemaReady && donateOAuthSchemaReady && accountDevicesSchemaReady) {
    usersSchemaReady = true;
    return;
  }

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_sub TEXT UNIQUE,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  // Existing databases keep their data. These additions support password,
  // Kick and e-mail accounts without weakening the original Google records.
  await addColumnIfMissing(env, "username TEXT");
  await addColumnIfMissing(env, "password_hash TEXT");
  await addColumnIfMissing(env, "password_salt TEXT");
  await addColumnIfMissing(env, "password_iterations INTEGER NOT NULL DEFAULT 10000");
  await addColumnIfMissing(env, "birth_date TEXT");
  await addColumnIfMissing(env, "email_linked INTEGER NOT NULL DEFAULT 1");
  await addColumnIfMissing(env, "username_changed_at TEXT");
  await addColumnIfMissing(env, "email_changed_at TEXT");
  await addColumnIfMissing(env, "password_changed_at TEXT");
  await addColumnIfMissing(env, "session_version INTEGER NOT NULL DEFAULT 1");
  await addColumnIfMissing(env, "kick_user_id TEXT");
  await addColumnIfMissing(env, "kick_username TEXT");
  await addColumnIfMissing(env, "two_factor_enabled INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(env, "totp_secret_ciphertext TEXT");
  await addColumnIfMissing(env, "totp_last_counter INTEGER NOT NULL DEFAULT -1");
  await env.DB.batch([
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub)"),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_kick_user_id ON users(kick_user_id) WHERE kick_user_id IS NOT NULL"),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(lower(username)) WHERE username IS NOT NULL"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS email_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      used_at TEXT
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_email_codes_lookup ON email_codes(email, purpose, created_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS kick_webhook_events (
      message_id TEXT PRIMARY KEY,
      broadcaster_user_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_version INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      event_at TEXT,
      received_at TEXT NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_kick_webhook_events_broadcaster_received ON kick_webhook_events(broadcaster_user_id, received_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_version INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS kick_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      scopes_json TEXT NOT NULL,
      account_json TEXT,
      subscription_version INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_kick_sessions_expires_at ON kick_sessions(expires_at)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS kick_refresh_locks (
      session_id TEXT PRIMARY KEY,
      locked_until INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_kick_refresh_locks_expires_at ON kick_refresh_locks(locked_until)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_email_log (
      id TEXT PRIMARY KEY,
      rate_key_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_support_email_log_rate_created ON support_email_log(rate_key_hash, created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_support_email_log_created ON support_email_log(created_at)"),
  ]);
  try {
    await env.DB.prepare("ALTER TABLE kick_sessions ADD COLUMN subscription_version INTEGER NOT NULL DEFAULT 0").run();
  } catch (error) {
    if (!String(error instanceof Error ? error.message : error).toLowerCase().includes("duplicate column")) throw error;
  }
  try {
    await env.DB.prepare("ALTER TABLE kick_sessions ADD COLUMN user_id TEXT").run();
  } catch (error) {
    if (!String(error instanceof Error ? error.message : error).toLowerCase().includes("duplicate column")) throw error;
  }
  const migratedAt = new Date().toISOString();
  // v14 is the requested one-time global cooldown reset. The schema marker and
  // reset are committed together, so normal requests never repeat this write.
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET username_changed_at = NULL, email_changed_at = NULL, password_changed_at = NULL"),
    env.DB.prepare(`INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
      VALUES (?1, ?2, ?3)`).bind(schemaMarker, "1", migratedAt),
  ]);
  await ensureTwoFactorSchemaInD1(env);
  await ensureTotpSchemaInD1(env);
  await ensureTrustedTwoFactorSchemaInD1(env);
  await ensureSiteMetricsSchemaInD1(env);
  await ensureDonateBridgeSchemaInD1(env);
  await ensureKickMetricsSchemaInD1(env);
  await ensureDonateOAuthSchemaInD1(env);
  await ensureAccountDevicesSchemaInD1(env);
  usersSchemaReady = true;
}

async function ensureAccountDevicesSchemaInD1(env) {
  const schemaMarker = "schema:play-streamers-account-devices:v2";
  const current = await env.DB.prepare("SELECT value FROM play_streamers_metadata WHERE key = ?1 LIMIT 1")
    .bind(schemaMarker).first();
  if (current?.value === "1") return true;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS account_login_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    browser_name TEXT,
    operating_system TEXT,
    network_hash TEXT,
    city TEXT,
    country TEXT,
    latitude REAL,
    longitude REAL,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    revoked_at INTEGER
  )`).run();
  const columns = await env.DB.prepare("PRAGMA table_info(account_login_devices)").all();
  if (!(columns?.results || []).some(row => String(row.name || "") === "network_hash")) {
    await env.DB.prepare("ALTER TABLE account_login_devices ADD COLUMN network_hash TEXT").run();
  }
  await env.DB.batch([
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_account_login_devices_user_seen ON account_login_devices(user_id, last_seen_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_account_login_devices_user_network ON account_login_devices(user_id, network_hash, last_seen_at DESC)"),
    env.DB.prepare(`INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
      VALUES (?1, ?2, ?3)`).bind(schemaMarker, "1", new Date().toISOString()),
  ]);
  return true;
}

async function ensureSiteMetricsSchemaInD1(env) {
  const schemaMarker = "schema:play-streamers-site-metrics:v1";
  const current = await env.DB.prepare("SELECT value FROM play_streamers_metadata WHERE key = ?1 LIMIT 1")
    .bind(schemaMarker).first();
  if (current?.value === "1") return true;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_visitors (
      visitor_hash TEXT PRIMARY KEY,
      first_seen_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      user_id TEXT,
      authenticated INTEGER NOT NULL DEFAULT 0
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_site_visitors_last_seen ON site_visitors(last_seen_at)"),
    env.DB.prepare(`INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
      VALUES (?1, ?2, ?3)`).bind(schemaMarker, "1", new Date().toISOString()),
  ]);
  return true;
}

async function ensureDonateOAuthSchemaInD1(env) {
  const schemaMarker = "schema:play-streamers-donate-oauth:v1";
  const current = await env.DB.prepare("SELECT value FROM play_streamers_metadata WHERE key = ?1 LIMIT 1")
    .bind(schemaMarker).first();
  if (current?.value === "1") return true;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS donate_oauth_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_user_id TEXT,
      provider_display_name TEXT,
      access_token_ciphertext TEXT NOT NULL,
      refresh_token_ciphertext TEXT,
      provider_api_key_ciphertext TEXT,
      token_expires_at INTEGER,
      scopes_json TEXT NOT NULL DEFAULT '[]',
      cursor_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_sync_at INTEGER,
      last_event_at INTEGER,
      event_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      revoked_at INTEGER
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_donate_oauth_connections_user ON donate_oauth_connections(user_id, updated_at DESC)"),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_donate_oauth_connections_active_provider ON donate_oauth_connections(user_id, provider_id) WHERE revoked_at IS NULL"),
    env.DB.prepare(`INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
      VALUES (?1, ?2, ?3)`).bind(schemaMarker, "1", new Date().toISOString()),
  ]);
  return true;
}

async function ensureDonateBridgeSchemaInD1(env) {
  const schemaMarker = "schema:play-streamers-donate-bridge:v5";
  const current = await env.DB.prepare("SELECT value FROM play_streamers_metadata WHERE key = ?1 LIMIT 1")
    .bind(schemaMarker).first();
  if (current?.value === "1") return true;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS donate_bridge_pairing_codes (
      code_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      claimed_at INTEGER
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_donate_bridge_pairing_user ON donate_bridge_pairing_codes(user_id, created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_donate_bridge_pairing_expiry ON donate_bridge_pairing_codes(expires_at)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS donate_bridge_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      app_version TEXT,
      client_instance_id TEXT,
      provider_status_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER,
      revoked_at INTEGER
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_donate_bridge_devices_user ON donate_bridge_devices(user_id, created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_donate_bridge_devices_token ON donate_bridge_devices(token_hash)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS donate_bridge_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      provider_event_id TEXT NOT NULL,
      donor_name TEXT NOT NULL,
      amount_minor INTEGER NOT NULL,
      currency TEXT NOT NULL,
      message TEXT,
      event_at INTEGER,
      observed_at INTEGER NOT NULL,
      source TEXT NOT NULL,
      integrity_hash TEXT,
      received_at INTEGER NOT NULL,
      UNIQUE(user_id, provider_id, provider_event_id)
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_donate_bridge_events_user_received ON donate_bridge_events(user_id, received_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_donate_bridge_events_device_received ON donate_bridge_events(device_id, received_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS donate_webhook_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_event_at INTEGER,
      event_count INTEGER NOT NULL DEFAULT 0,
      revoked_at INTEGER
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_donate_webhook_connections_user ON donate_webhook_connections(user_id, created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_donate_webhook_connections_token ON donate_webhook_connections(token_hash)"),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_donate_webhook_connections_active_provider ON donate_webhook_connections(user_id, provider_id) WHERE revoked_at IS NULL"),
  ]);
  try {
    await env.DB.prepare("ALTER TABLE donate_bridge_devices ADD COLUMN client_instance_id TEXT").run();
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).toLowerCase();
    if (!message.includes("duplicate column")) throw error;
  }
  try {
    await env.DB.prepare("ALTER TABLE donate_bridge_devices ADD COLUMN provider_status_json TEXT NOT NULL DEFAULT '[]'").run();
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).toLowerCase();
    if (!message.includes("duplicate column")) throw error;
  }
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_donate_bridge_devices_instance ON donate_bridge_devices(user_id, client_instance_id)"),
    // Older Connector builds could leave the previous token active after a
    // re-pair. Keep only the newest identical Chrome device once during v2.
    env.DB.prepare(`UPDATE donate_bridge_devices AS older SET revoked_at = ?1
      WHERE older.revoked_at IS NULL AND older.app_version LIKE 'chrome-%'
        AND EXISTS (
          SELECT 1 FROM donate_bridge_devices AS newer
          WHERE newer.user_id = older.user_id
            AND newer.name = older.name
            AND COALESCE(newer.app_version, '') = COALESCE(older.app_version, '')
            AND newer.revoked_at IS NULL
            AND (newer.created_at > older.created_at
              OR (newer.created_at = older.created_at AND newer.id > older.id))
        )`).bind(now),
    // v0.2 used the old product name and could remain active beside a newer
    // Play Connect installation. Legacy credentials are retired once the same
    // account has a current Play Connect device.
    env.DB.prepare(`UPDATE donate_bridge_devices AS legacy SET revoked_at = ?1
      WHERE legacy.revoked_at IS NULL
        AND (legacy.name = 'Play Streamers Chrome Eklentisi'
          OR legacy.name = 'Play Streamers Donate Connector'
          OR legacy.app_version = 'chrome-0.2.0')
        AND EXISTS (
          SELECT 1 FROM donate_bridge_devices AS current_device
          WHERE current_device.user_id = legacy.user_id
            AND current_device.id != legacy.id
            AND current_device.revoked_at IS NULL
            AND current_device.name = 'Play Connect'
        )`).bind(now),
    env.DB.prepare(`INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
      VALUES (?1, ?2, ?3)`).bind(schemaMarker, "1", new Date(now).toISOString()),
  ]);
  return true;
}

function kickMetricDateKey(value = Date.now()) {
  const date = new Date(Number(value) || Date.now());
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const key = `${values.year}-${values.month}-${values.day}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  } catch {
    /* UTC anahtarı eski Worker çalışma zamanlarında güvenli yedektir. */
  }
  return date.toISOString().slice(0, 10);
}

function kickMetricHourKey(value = Date.now()) {
  const date = new Date(Number(value) || Date.now());
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const key = `${values.year}-${values.month}-${values.day}T${values.hour}`;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(key)) return key;
  } catch {
    /* UTC saat anahtarı eski Worker çalışma zamanlarında güvenli yedektir. */
  }
  return date.toISOString().slice(0, 13);
}

async function ensureKickMetricsSchemaInD1(env) {
  const schemaMarker = "schema:play-streamers-kick-metrics:v2";
  const current = await env.DB.prepare("SELECT value FROM play_streamers_metadata WHERE key = ?1 LIMIT 1")
    .bind(schemaMarker).first();
  if (current?.value === "1") return true;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS kick_metric_snapshots (
      user_id TEXT NOT NULL,
      metric_date TEXT NOT NULL,
      broadcaster_user_id TEXT NOT NULL,
      kick_slug TEXT,
      followers_count INTEGER,
      subscribers_count INTEGER,
      source TEXT NOT NULL,
      observed_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, metric_date)
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_kick_metric_snapshots_user_date ON kick_metric_snapshots(user_id, metric_date DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_kick_metric_snapshots_broadcaster_date ON kick_metric_snapshots(broadcaster_user_id, metric_date DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS kick_metric_hourly (
      user_id TEXT NOT NULL,
      metric_hour TEXT NOT NULL,
      metric_date TEXT NOT NULL,
      broadcaster_user_id TEXT NOT NULL,
      kick_slug TEXT,
      followers_count INTEGER,
      subscribers_count INTEGER,
      month_followers_count INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      observed_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, metric_hour)
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_kick_metric_hourly_user_date ON kick_metric_hourly(user_id, metric_date, metric_hour)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_kick_metric_hourly_broadcaster_date ON kick_metric_hourly(broadcaster_user_id, metric_date, metric_hour)"),
    env.DB.prepare(`INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
      VALUES (?1, ?2, ?3)`).bind(schemaMarker, "1", new Date().toISOString()),
  ]);
  return true;
}

async function storeKickMetricSnapshot(env, {
  userId,
  broadcasterId,
  slug = "",
  followersCount = null,
  subscribersCount = null,
  monthFollowersCount = 0,
  source = "kick-api",
  observedAt = Date.now(),
} = {}) {
  const followers = Number(followersCount);
  const subscribers = Number(subscribersCount);
  const safeFollowers = followersCount === null || followersCount === undefined || !Number.isFinite(followers)
    ? null
    : Math.max(0, Math.floor(followers));
  const safeSubscribers = subscribersCount === null || subscribersCount === undefined || !Number.isFinite(subscribers)
    ? null
    : Math.max(0, Math.floor(subscribers));
  const safeMonthFollowers = Math.max(0, Math.floor(Number(monthFollowersCount) || 0));
  if (!userId || !broadcasterId || (safeFollowers === null && safeSubscribers === null)) return false;
  await ensureKickMetricsSchemaInD1(env);
  const now = Date.now();
  const safeObservedAt = Math.min(now + 60_000, Math.max(now - 10 * 60_000, Number(observedAt) || now));
  const metricDate = kickMetricDateKey(safeObservedAt);
  const metricHour = kickMetricHourKey(safeObservedAt);
  const [existing, hourlyExisting] = await Promise.all([
    env.DB.prepare(`SELECT followers_count, subscribers_count, updated_at
      FROM kick_metric_snapshots WHERE user_id = ?1 AND metric_date = ?2 LIMIT 1`)
      .bind(String(userId), metricDate).first(),
    env.DB.prepare(`SELECT updated_at FROM kick_metric_hourly
      WHERE user_id = ?1 AND metric_hour = ?2 LIMIT 1`)
      .bind(String(userId), metricHour).first(),
  ]);
  const followerUnchanged = safeFollowers === null || Number(existing?.followers_count) === safeFollowers;
  const subscriberUnchanged = safeSubscribers === null || Number(existing?.subscribers_count) === safeSubscribers;
  if (existing && hourlyExisting && followerUnchanged && subscriberUnchanged
      && now - Number(hourlyExisting.updated_at || 0) < 5 * 60_000) {
    return false;
  }
  await env.DB.prepare(`INSERT INTO kick_metric_snapshots (
      user_id, metric_date, broadcaster_user_id, kick_slug, followers_count,
      subscribers_count, source, observed_at, created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
    ON CONFLICT(user_id, metric_date) DO UPDATE SET
      broadcaster_user_id = excluded.broadcaster_user_id,
      kick_slug = COALESCE(excluded.kick_slug, kick_metric_snapshots.kick_slug),
      followers_count = COALESCE(excluded.followers_count, kick_metric_snapshots.followers_count),
      subscribers_count = COALESCE(excluded.subscribers_count, kick_metric_snapshots.subscribers_count),
      source = excluded.source,
      observed_at = MAX(kick_metric_snapshots.observed_at, excluded.observed_at),
      updated_at = excluded.updated_at`)
    .bind(
      String(userId),
      metricDate,
      String(broadcasterId),
      donateBridgeText(slug, 100) || null,
      safeFollowers,
      safeSubscribers,
      donateBridgeText(source, 60, "kick-api"),
      safeObservedAt,
      now,
    ).run();
  await env.DB.prepare(`INSERT INTO kick_metric_hourly (
      user_id, metric_hour, metric_date, broadcaster_user_id, kick_slug,
      followers_count, subscribers_count, month_followers_count, source,
      observed_at, created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)
    ON CONFLICT(user_id, metric_hour) DO UPDATE SET
      broadcaster_user_id = excluded.broadcaster_user_id,
      kick_slug = COALESCE(excluded.kick_slug, kick_metric_hourly.kick_slug),
      followers_count = CASE
        WHEN excluded.followers_count IS NULL THEN kick_metric_hourly.followers_count
        WHEN kick_metric_hourly.followers_count IS NULL THEN excluded.followers_count
        ELSE MAX(kick_metric_hourly.followers_count, excluded.followers_count)
      END,
      subscribers_count = CASE
        WHEN excluded.subscribers_count IS NULL THEN kick_metric_hourly.subscribers_count
        WHEN kick_metric_hourly.subscribers_count IS NULL THEN excluded.subscribers_count
        ELSE MAX(kick_metric_hourly.subscribers_count, excluded.subscribers_count)
      END,
      month_followers_count = MAX(kick_metric_hourly.month_followers_count, excluded.month_followers_count),
      source = excluded.source,
      observed_at = MAX(kick_metric_hourly.observed_at, excluded.observed_at),
      updated_at = excluded.updated_at`)
    .bind(
      String(userId), metricHour, metricDate, String(broadcasterId),
      donateBridgeText(slug, 100) || null, safeFollowers, safeSubscribers,
      safeMonthFollowers, donateBridgeText(source, 60, "kick-api"),
      safeObservedAt, now,
    ).run();
  return true;
}

async function ensureTwoFactorSchemaInD1(env) {
  const schemaMarker = "schema:play-streamers-two-factor:v1";
  const current = await env.DB.prepare("SELECT value FROM play_streamers_metadata WHERE key = ?1 LIMIT 1")
    .bind(schemaMarker).first();
  if (current?.value === "1") return true;
  try {
    await env.DB.prepare("ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0").run();
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).toLowerCase();
    if (message.includes("no such table")) return false;
    if (!message.includes("duplicate column")) throw error;
  }
  await env.DB.prepare(`INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
    VALUES (?1, ?2, ?3)`).bind(schemaMarker, "1", new Date().toISOString()).run();
  return true;
}

async function ensureTotpSchemaInD1(env) {
  const schemaMarker = "schema:play-streamers-totp:v1";
  const current = await env.DB.prepare("SELECT value FROM play_streamers_metadata WHERE key = ?1 LIMIT 1")
    .bind(schemaMarker).first();
  if (current?.value === "1") return true;
  for (const definition of [
    "totp_secret_ciphertext TEXT",
    "totp_last_counter INTEGER NOT NULL DEFAULT -1",
  ]) {
    try {
      await env.DB.prepare(`ALTER TABLE users ADD COLUMN ${definition}`).run();
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error).toLowerCase();
      if (message.includes("no such table")) return false;
      if (!message.includes("duplicate column")) throw error;
    }
  }
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS totp_setups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      secret_ciphertext TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_totp_setups_user ON totp_setups(user_id, created_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS totp_login_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      used_at INTEGER
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_totp_login_challenges_expiry ON totp_login_challenges(expires_at)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS totp_recovery_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_totp_recovery_hash ON totp_recovery_codes(user_id, code_hash)"),
    // The previously deployed e-mail-code 2FA had no authenticator secret.
    // Reset only that legacy state so users can enrol in TOTP deliberately.
    env.DB.prepare("UPDATE users SET two_factor_enabled = 0, totp_secret_ciphertext = NULL, totp_last_counter = -1 WHERE totp_secret_ciphertext IS NULL"),
    env.DB.prepare(`INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
      VALUES (?1, ?2, ?3)`).bind(schemaMarker, "1", new Date(now).toISOString()),
  ]);
  return true;
}

async function ensureTrustedTwoFactorSchemaInD1(env) {
  const schemaMarker = "schema:play-streamers-trusted-two-factor:v1";
  const current = await env.DB.prepare("SELECT value FROM play_streamers_metadata WHERE key = ?1 LIMIT 1")
    .bind(schemaMarker).first();
  if (current?.value === "1") return true;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS two_factor_trusted_devices (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_version INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at INTEGER
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_two_factor_trusted_user ON two_factor_trusted_devices(user_id, expires_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_two_factor_trusted_expiry ON two_factor_trusted_devices(expires_at)"),
    env.DB.prepare(`INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
      VALUES (?1, ?2, ?3)`).bind(schemaMarker, "1", new Date().toISOString()),
  ]);
  return true;
}

async function ensureSupportSchemaInD1(env) {
  const schemaMarker = "schema:play-streamers-support:v2";
  const current = await env.DB.prepare("SELECT value FROM play_streamers_metadata WHERE key = ?1 LIMIT 1")
    .bind(schemaMarker).first();
  if (current?.value === "1") return;

  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'play-streamers',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_reply_at TEXT
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_support_tickets_user_updated ON support_tickets(user_id, updated_at DESC)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_messages (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      body TEXT NOT NULL,
      attachments_json TEXT,
      external_id TEXT UNIQUE,
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created ON support_messages(ticket_id, created_at)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_webhook_events (
      svix_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    )`),
  ]);
  try {
    await env.DB.prepare("ALTER TABLE kick_sessions ADD COLUMN user_id TEXT").run();
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).toLowerCase();
    if (!message.includes("duplicate column") && !message.includes("no such table")) throw error;
  }
  try {
    await env.DB.prepare("ALTER TABLE support_tickets ADD COLUMN source TEXT NOT NULL DEFAULT 'play-streamers'").run();
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).toLowerCase();
    if (!message.includes("duplicate column")) throw error;
  }
  await env.DB.prepare(`INSERT OR REPLACE INTO play_streamers_metadata (key, value, updated_at)
    VALUES (?1, ?2, ?3)`).bind(schemaMarker, "1", new Date().toISOString()).run();
}

async function addColumnIfMissing(env, definition) {
  try {
    await env.DB.prepare(`ALTER TABLE users ADD COLUMN ${definition}`).run();
  } catch (error) {
    // D1 reports an error when a previously deployed database already has it.
    if (!String(error instanceof Error ? error.message : error).toLowerCase().includes("duplicate column")) throw error;
  }
}

// Expired OAuth states, sessions, one-time codes and abandoned refresh locks
// are never useful after their validity period. Keeping these tables compact
// makes the indexed account lookups remain quick without touching active users.
async function maintainSecurityStorage(env) {
  const now = Date.now();
  if (now < nextSecurityMaintenanceAt) return;
  nextSecurityMaintenanceAt = now + SECURITY_MAINTENANCE_INTERVAL_MS;
  const expiredCodeCutoff = new Date(now).toISOString();
  const usedCodeCutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  try {
    const results = await env.DB.batch([
      env.DB.prepare("DELETE FROM oauth_states WHERE expires_at <= ?1").bind(now),
      env.DB.prepare("DELETE FROM user_sessions WHERE expires_at <= ?1").bind(now),
      env.DB.prepare("DELETE FROM email_codes WHERE expires_at <= ?1 OR (used_at IS NOT NULL AND used_at <= ?2)")
        .bind(expiredCodeCutoff, usedCodeCutoff),
      env.DB.prepare("DELETE FROM totp_setups WHERE expires_at <= ?1").bind(now),
      env.DB.prepare("DELETE FROM totp_login_challenges WHERE expires_at <= ?1 OR (used_at IS NOT NULL AND used_at <= ?2)")
        .bind(now, now - 24 * 60 * 60 * 1000),
      env.DB.prepare("DELETE FROM two_factor_trusted_devices WHERE expires_at <= ?1 OR revoked_at IS NOT NULL").bind(now),
      env.DB.prepare("DELETE FROM kick_refresh_locks WHERE locked_until <= ?1").bind(now),
      env.DB.prepare("DELETE FROM support_email_log WHERE created_at <= ?1").bind(now - 7 * 24 * 60 * 60 * 1000),
      env.DB.prepare("DELETE FROM donate_bridge_pairing_codes WHERE expires_at <= ?1 OR claimed_at IS NOT NULL").bind(now),
    ]);
    const removed = results.reduce((total, result) => total + Number(result?.meta?.changes || 0), 0);
    if (removed > 0) logSecurityEvent("security_storage_pruned", { removed });
  } catch (error) {
    // Maintenance must never interrupt a login. Try again sooner if D1 was
    // momentarily unavailable and keep the error log free of user data.
    nextSecurityMaintenanceAt = now + 5 * 60 * 1000;
    logSecurityEvent("security_storage_prune_failed", { reason: error?.name || "unknown" });
  }
}

async function saveOAuthState(provider, state, payload, env) {
  await ensureUsersSchema(env);
  const now = Date.now();
  await env.DB.prepare(`INSERT OR REPLACE INTO oauth_states
    (state, provider, payload_json, expires_at, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5)`)
    .bind(state, provider, JSON.stringify(payload), now + OAUTH_STATE_TTL_SECONDS * 1000, now)
    .run();
}

async function consumeOAuthState(provider, state, env) {
  await ensureUsersSchema(env);
  const row = await env.DB.prepare(`SELECT payload_json, expires_at FROM oauth_states
    WHERE state = ?1 AND provider = ?2 LIMIT 1`).bind(state, provider).first();
  if (!row) return null;
  await env.DB.prepare("DELETE FROM oauth_states WHERE state = ?1").bind(state).run();
  if (Date.now() > Number(row.expires_at || 0)) return null;
  try {
    return JSON.parse(String(row.payload_json || ""));
  } catch {
    return null;
  }
}

async function saveKickSession(sessionId, session, env) {
  await ensureUsersSchema(env);
  await env.DB.prepare(`INSERT OR REPLACE INTO kick_sessions
    (id, user_id, access_token, refresh_token, expires_at, scopes_json, account_json, subscription_version, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
    .bind(
      sessionId,
      session.userId ? String(session.userId) : null,
      String(session.accessToken || ""),
      String(session.refreshToken || ""),
      Number(session.expiresAt || 0),
      JSON.stringify(Array.isArray(session.scopes) ? session.scopes : []),
      session.account ? JSON.stringify(session.account) : null,
      Number(session.subscriptionVersion || 0),
      Number(session.createdAt || Date.now()),
    )
    .run();
}

async function getKickSession(sessionId, env) {
  await ensureUsersSchema(env);
  const row = await env.DB.prepare(`SELECT user_id, access_token, refresh_token, expires_at, scopes_json, account_json, subscription_version, created_at
    FROM kick_sessions WHERE id = ?1 LIMIT 1`).bind(sessionId).first();
  if (!row) return null;
  try {
    return {
      userId: row.user_id ? String(row.user_id) : null,
      accessToken: String(row.access_token || ""),
      refreshToken: String(row.refresh_token || ""),
      expiresAt: Number(row.expires_at || 0),
      scopes: JSON.parse(String(row.scopes_json || "[]")),
      account: row.account_json ? JSON.parse(String(row.account_json)) : null,
      subscriptionVersion: Number(row.subscription_version || 0),
      createdAt: Number(row.created_at || 0),
    };
  } catch {
    await deleteKickSession(sessionId, env);
    return null;
  }
}

async function markKickSubscriptionVersion(sessionId, env) {
  if (!sessionId || !env.DB) return;
  await env.DB.prepare("UPDATE kick_sessions SET subscription_version = ?1 WHERE id = ?2")
    .bind(KICK_SUBSCRIPTION_VERSION, sessionId)
    .run();
}

async function deleteKickSession(sessionId, env) {
  if (!sessionId || !env.DB) return;
  await ensureUsersSchema(env);
  await env.DB.prepare("DELETE FROM kick_sessions WHERE id = ?1").bind(sessionId).run();
}

async function disconnectAccountKick(request, env) {
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const userId = String(current.session.user.id || "");
  const user = await getPrivateUserById(userId, env);
  if (!user) return apiResponse(request, { error: "Hesap bulunamadı." }, 404);
  const kickUserId = String(user.kick_user_id || "");
  const now = new Date().toISOString();
  const statements = [
    env.DB.prepare(`DELETE FROM kick_refresh_locks WHERE session_id IN
      (SELECT id FROM kick_sessions WHERE user_id = ?1)`).bind(userId),
    env.DB.prepare("DELETE FROM kick_sessions WHERE user_id = ?1").bind(userId),
    env.DB.prepare("DELETE FROM oauth_states WHERE CAST(json_extract(payload_json, '$.linkUserId') AS TEXT) = ?1").bind(userId),
    env.DB.prepare("UPDATE users SET kick_user_id = NULL, kick_username = NULL, updated_at = ?1 WHERE id = ?2")
      .bind(now, userId),
  ];
  if (kickUserId) {
    statements.unshift(
      env.DB.prepare(`DELETE FROM kick_refresh_locks WHERE session_id IN
        (SELECT id FROM kick_sessions WHERE CAST(json_extract(account_json, '$.id') AS TEXT) = ?1)`).bind(kickUserId),
      env.DB.prepare("DELETE FROM kick_sessions WHERE CAST(json_extract(account_json, '$.id') AS TEXT) = ?1").bind(kickUserId),
    );
  }
  await env.DB.batch(statements);
  return apiResponse(request, { ok: true, connected: false, user: await getUserById(userId, env) });
}

async function acquireKickRefreshLock(sessionId, env) {
  await ensureUsersSchema(env);
  const now = Date.now();
  await env.DB.prepare("DELETE FROM kick_refresh_locks WHERE locked_until <= ?1").bind(now).run();
  const result = await env.DB.prepare(`INSERT OR IGNORE INTO kick_refresh_locks
    (session_id, locked_until, created_at) VALUES (?1, ?2, ?3)`)
    .bind(sessionId, now + KICK_REFRESH_LOCK_TTL_MS, now)
    .run();
  return Number(result?.meta?.changes || 0) > 0;
}

async function releaseKickRefreshLock(sessionId, env) {
  if (!sessionId || !env.DB) return;
  await env.DB.prepare("DELETE FROM kick_refresh_locks WHERE session_id = ?1").bind(sessionId).run();
}

async function deleteUserSession(sessionId, env) {
  if (!sessionId || !env.DB) return;
  await ensureUsersSchema(env);
  await env.DB.prepare("DELETE FROM user_sessions WHERE id = ?1").bind(sessionId).run();
}

async function accountDeviceId(sessionId) {
  return sha256Base64Url(`play-streamers-account-device:${sessionId}`);
}

async function accountDeviceNetworkHash(request, userId) {
  const ipAddress = String(request.headers.get("CF-Connecting-IP") || "").trim();
  if (!ipAddress || ipAddress.length > 64) return null;
  return sha256Base64Url(`play-streamers-account-network:v1:${userId}:${ipAddress}`);
}

async function accountDeviceGroupKey(row, userId) {
  const networkHash = String(row.network_hash || "").trim();
  if (networkHash) return `network:${networkHash}`;
  const legacyFingerprint = [
    String(row.device_name || ""),
    String(row.browser_name || ""),
    String(row.operating_system || ""),
    String(row.city || ""),
    String(row.country || ""),
  ].join("|");
  return `legacy:${await sha256Base64Url(`play-streamers-account-legacy-network:${userId}:${legacyFingerprint}`)}`;
}

async function groupAccountDeviceRows(rows, userId, activeIds, currentRawDeviceId) {
  const groups = new Map();
  for (const row of rows) {
    const key = await accountDeviceGroupKey(row, userId);
    const existing = groups.get(key);
    const rowId = String(row.id || "");
    const rowSeenAt = Number(row.last_seen_at || 0);
    if (!existing) {
      groups.set(key, {
        key,
        rows: [row],
        latest: row,
        createdAt: Number(row.created_at || 0),
        lastSeenAt: rowSeenAt,
        active: !row.revoked_at && activeIds.has(rowId),
        current: rowId === currentRawDeviceId,
      });
      continue;
    }
    existing.rows.push(row);
    existing.createdAt = Math.min(existing.createdAt || Number(row.created_at || 0), Number(row.created_at || 0));
    existing.lastSeenAt = Math.max(existing.lastSeenAt, rowSeenAt);
    existing.active ||= !row.revoked_at && activeIds.has(rowId);
    existing.current ||= rowId === currentRawDeviceId;
    if (rowSeenAt >= Number(existing.latest.last_seen_at || 0)) existing.latest = row;
  }
  const grouped = [];
  for (const group of groups.values()) {
    const latest = group.latest;
    grouped.push({
      id: `device-group-${await sha256Base64Url(`play-streamers-account-group:${userId}:${group.key}`)}`,
      memberIds: group.rows.map(row => String(row.id || "")).filter(Boolean),
      name: String(latest.device_name || "Bilinmeyen cihaz"),
      browser: String(latest.browser_name || "Tarayıcı"),
      operatingSystem: String(latest.operating_system || "Bilinmeyen sistem"),
      city: latest.city ? String(latest.city) : null,
      country: latest.country ? String(latest.country) : null,
      latitude: latest.latitude === null || latest.latitude === undefined ? null : Number(latest.latitude),
      longitude: latest.longitude === null || latest.longitude === undefined ? null : Number(latest.longitude),
      firstSignedInAt: new Date(group.createdAt).toISOString(),
      lastActiveAt: new Date(group.lastSeenAt).toISOString(),
      active: group.active,
      current: group.current,
      sessionCount: group.rows.length,
    });
  }
  return grouped.sort((left, right) => Date.parse(right.lastActiveAt) - Date.parse(left.lastActiveAt));
}

function describeAccountDevice(userAgent) {
  const value = String(userAgent || "");
  const browser = /Edg\/[\d.]+/i.test(value) ? "Microsoft Edge"
    : /OPR\/[\d.]+/i.test(value) ? "Opera"
      : /Firefox\/[\d.]+/i.test(value) ? "Firefox"
        : /Chrome\/[\d.]+/i.test(value) ? "Google Chrome"
          : /Version\/[\d.]+.*Safari\//i.test(value) ? "Safari"
            : "Tarayıcı";
  const operatingSystem = /Windows NT/i.test(value) ? "Windows"
    : /Android/i.test(value) ? "Android"
      : /iPhone|iPad|iPod/i.test(value) ? "iOS / iPadOS"
        : /Mac OS X/i.test(value) ? "macOS"
          : /Linux/i.test(value) ? "Linux"
            : "Bilinmeyen sistem";
  const mobile = /Mobile|Android|iPhone|iPad/i.test(value);
  return {
    browser,
    operatingSystem,
    deviceName: `${browser} · ${operatingSystem}${mobile ? " mobil" : ""}`,
  };
}

async function touchAccountDevice(request, current, env, force = false) {
  if (!current?.sessionId || !current?.session?.user?.id) return null;
  const id = await accountDeviceId(current.sessionId);
  const networkHash = await accountDeviceNetworkHash(request, current.session.user.id);
  const now = Date.now();
  if (!force) {
    const existing = await env.DB.prepare(`SELECT last_seen_at FROM account_login_devices
      WHERE id = ?1 AND user_id = ?2 LIMIT 1`).bind(id, current.session.user.id).first();
    if (existing && Number(existing.last_seen_at || 0) > now - LOGIN_DEVICE_TOUCH_INTERVAL_MS) return id;
  }
  const description = describeAccountDevice(request.headers.get("User-Agent"));
  const cf = request.cf || {};
  const city = String(cf.city || "").trim().slice(0, 100) || null;
  const country = String(cf.country || "").trim().slice(0, 8) || null;
  const latitudeValue = cf.latitude === undefined || cf.latitude === null || cf.latitude === "" ? NaN : Number(cf.latitude);
  const longitudeValue = cf.longitude === undefined || cf.longitude === null || cf.longitude === "" ? NaN : Number(cf.longitude);
  const latitude = Number.isFinite(latitudeValue) ? latitudeValue : null;
  const longitude = Number.isFinite(longitudeValue) ? longitudeValue : null;
  await env.DB.prepare(`INSERT INTO account_login_devices
      (id, user_id, device_name, browser_name, operating_system, network_hash, city, country,
       latitude, longitude, created_at, last_seen_at, revoked_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11, NULL)
      ON CONFLICT(id) DO UPDATE SET
        device_name = excluded.device_name,
        browser_name = excluded.browser_name,
        operating_system = excluded.operating_system,
        network_hash = COALESCE(excluded.network_hash, account_login_devices.network_hash),
        city = COALESCE(excluded.city, account_login_devices.city),
        country = COALESCE(excluded.country, account_login_devices.country),
        latitude = COALESCE(excluded.latitude, account_login_devices.latitude),
        longitude = COALESCE(excluded.longitude, account_login_devices.longitude),
        last_seen_at = excluded.last_seen_at,
        revoked_at = NULL`)
    .bind(
      id,
      current.session.user.id,
      description.deviceName,
      description.browser,
      description.operatingSystem,
      networkHash,
      city,
      country,
      latitude,
      longitude,
      now,
    )
    .run();
  return id;
}

async function activeAccountDeviceIds(userId, env) {
  const result = await env.DB.prepare(`SELECT id FROM user_sessions
    WHERE user_id = ?1 AND expires_at > ?2 ORDER BY created_at DESC LIMIT 100`)
    .bind(userId, Date.now())
    .all();
  const ids = await Promise.all((result?.results || []).map(row => accountDeviceId(String(row.id || ""))));
  return new Set(ids);
}

async function listAccountDevices(request, env) {
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const currentRawDeviceId = await touchAccountDevice(request, current, env, true);
  const result = await env.DB.prepare(`SELECT id, device_name, browser_name, operating_system,
      network_hash, city, country, latitude, longitude, created_at, last_seen_at, revoked_at
    FROM account_login_devices
    WHERE user_id = ?1
    ORDER BY last_seen_at DESC
    LIMIT 60`).bind(current.session.user.id).all();
  const activeIds = await activeAccountDeviceIds(current.session.user.id, env);
  const devices = await groupAccountDeviceRows(
    result?.results || [],
    current.session.user.id,
    activeIds,
    currentRawDeviceId,
  );
  const currentDeviceId = devices.find(device => device.current)?.id || "";
  return apiResponse(request, {
    ok: true,
    currentDeviceId,
    devices: devices.map(({ memberIds, ...device }) => device),
  });
}

async function revokeAccountDevice(request, env) {
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const deviceId = String(input.deviceId || "").trim();
  if (!/^device-group-[A-Za-z0-9_-]{32,128}$/.test(deviceId)) {
    return apiResponse(request, { error: "Cihaz kaydı geçersiz." }, 400);
  }
  const deviceRows = await env.DB.prepare(`SELECT id, device_name, browser_name, operating_system,
      network_hash, city, country, latitude, longitude, created_at, last_seen_at, revoked_at
    FROM account_login_devices WHERE user_id = ?1 LIMIT 100`)
    .bind(current.session.user.id).all();
  const activeIds = await activeAccountDeviceIds(current.session.user.id, env);
  const currentRawDeviceId = await accountDeviceId(current.sessionId);
  const groupedDevices = await groupAccountDeviceRows(
    deviceRows?.results || [],
    current.session.user.id,
    activeIds,
    currentRawDeviceId,
  );
  const device = groupedDevices.find(item => item.id === deviceId);
  if (!device) return apiResponse(request, { error: "Cihaz bulunamadı." }, 404);
  const memberIds = new Set(device.memberIds);
  const sessions = await env.DB.prepare(`SELECT id FROM user_sessions
    WHERE user_id = ?1 LIMIT 100`).bind(current.session.user.id).all();
  const matchingSessionIds = [];
  for (const row of sessions?.results || []) {
    const sessionId = String(row.id || "");
    if (sessionId && memberIds.has(await accountDeviceId(sessionId))) matchingSessionIds.push(sessionId);
  }
  const statements = matchingSessionIds.map(sessionId => (
    env.DB.prepare("DELETE FROM user_sessions WHERE id = ?1 AND user_id = ?2")
      .bind(sessionId, current.session.user.id)
  ));
  for (const memberId of memberIds) {
    statements.push(env.DB.prepare(`UPDATE account_login_devices SET revoked_at = ?1
      WHERE id = ?2 AND user_id = ?3`).bind(Date.now(), memberId, current.session.user.id));
  }
  await env.DB.batch(statements);
  return apiResponse(request, {
    ok: true,
    revoked: true,
    currentDevice: memberIds.has(currentRawDeviceId),
  });
}

async function deleteClosedAccountDevice(request, env) {
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const deviceId = String(input.deviceId || "").trim();
  if (!/^device-group-[A-Za-z0-9_-]{32,128}$/.test(deviceId)) {
    return apiResponse(request, { error: "Cihaz kaydı geçersiz." }, 400);
  }
  const deviceRows = await env.DB.prepare(`SELECT id, device_name, browser_name, operating_system,
      network_hash, city, country, latitude, longitude, created_at, last_seen_at, revoked_at
    FROM account_login_devices WHERE user_id = ?1 LIMIT 100`)
    .bind(current.session.user.id).all();
  const activeIds = await activeAccountDeviceIds(current.session.user.id, env);
  const currentRawDeviceId = await accountDeviceId(current.sessionId);
  const groupedDevices = await groupAccountDeviceRows(
    deviceRows?.results || [],
    current.session.user.id,
    activeIds,
    currentRawDeviceId,
  );
  const device = groupedDevices.find(item => item.id === deviceId);
  if (!device) return apiResponse(request, { error: "Cihaz bulunamadı." }, 404);
  if (device.active) return apiResponse(request, { error: "Açık oturumu bulunan cihaz kaydı silinemez. Önce cihazdaki oturumu kapat." }, 409);
  const statements = device.memberIds.map(memberId => (
    env.DB.prepare("DELETE FROM account_login_devices WHERE id = ?1 AND user_id = ?2")
      .bind(memberId, current.session.user.id)
  ));
  if (statements.length) await env.DB.batch(statements);
  return apiResponse(request, { ok: true, deleted: true });
}

async function registerWithPassword(request, env) {
  requireAccountConfiguration(env);
  await ensureUsersSchema(env);
  const input = await requestJson(request);
  const validation = validateCredentials(input, { requireBirthDate: true, requireEmail: false });
  if (!validation.ok) return apiResponse(request, { error: validation.error }, 400);

  if (validation.email) requireEmailConfiguration(env);

  const emailOwner = validation.email ? await env.DB
    .prepare("SELECT id FROM users WHERE lower(email) = lower(?1) LIMIT 1")
    .bind(validation.email)
    .first() : null;
  if (emailOwner) return apiResponse(request, { error: "Bu e-posta adresiyle daha önce bir hesap oluşturulmuş." }, 409);

  const existing = await env.DB
    .prepare("SELECT id FROM users WHERE lower(username) = lower(?1) LIMIT 1")
    .bind(validation.username)
    .first();
  if (existing) return apiResponse(request, { error: "Bu kullanıcı adı zaten kullanılıyor. Kayıtlı hesabın sana aitse giriş yap ekranından kullanıcı adı/e-posta ve şifrenle devam et." }, 409);

  const now = new Date().toISOString();
  const id = randomBase64Url(24);
  const emailLinked = 0;
  // D1 tablosunda e-posta sütunu zorunlu olduğundan, e-posta girmeyen hesaplar
  // için kullanıcıya gösterilmeyen benzersiz bir dahili adres saklanır.
  const storedEmail = validation.email || `${id}@local.play-streamers.invalid`;
  const salt = randomBase64Url(24);
  const passwordHash = await hashPassword(validation.password, salt, PASSWORD_HASH_ITERATIONS_CURRENT);
  await env.DB
    .prepare("INSERT INTO users (id, google_sub, email, email_linked, username, password_hash, password_salt, password_iterations, birth_date, display_name, avatar_url, created_at, updated_at) VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?4, NULL, ?9, ?9)")
    .bind(id, storedEmail, emailLinked, validation.username, passwordHash, salt, PASSWORD_HASH_ITERATIONS_CURRENT, validation.birthDate, now)
    .run();

  const user = await getUserById(id, env);
  const sessionId = await createUserSession(user, env);
  if (validation.email) {
    const delivery = await issueEmailCode({ userId: id, email: validation.email, purpose: "registration" }, env);
    if (!delivery.ok) return apiResponse(request, { error: delivery.error }, delivery.status);
  }
  return authenticatedApiResponse(request, {
    signedIn: true,
    sessionId,
    user,
    emailMissing: !validation.email,
    verificationRequired: Boolean(validation.email),
    verificationEmail: validation.email || null,
  }, 201, sessionId);
}

async function loginWithPassword(request, env) {
  requireAccountConfiguration(env);
  await ensureUsersSchema(env);
  const input = await requestJson(request);
  const identityRaw = String(input.identity || "").trim();
  const identity = identityRaw.includes("@") ? identityRaw.toLowerCase() : identityRaw.toLocaleLowerCase("tr-TR");
  const password = String(input.password || "");
  const remember = input.remember === true;
  if (!identity || !password) return apiResponse(request, { error: "Kullanıcı adı/e-posta ve şifre zorunludur." }, 400);

  const user = await env.DB
    .prepare("SELECT id, email, email_linked, password_hash, password_salt, password_iterations, two_factor_enabled, totp_secret_ciphertext FROM users WHERE lower(username) = ?1 OR (email_linked = 1 AND lower(email) = ?1) LIMIT 1")
    .bind(identity)
    .first();
  if (!user?.password_hash || !user.password_salt) {
    return apiResponse(request, { error: "Bu hesap için şifre girişi kullanılamıyor. Google ile giriş yapabilirsin." }, 401);
  }

  const candidate = await hashPassword(password, user.password_salt, user.password_iterations);
  if (!constantTimeEqual(candidate, user.password_hash)) {
    return apiResponse(request, { error: "Kullanıcı adı/e-posta veya şifre hatalı." }, 401);
  }

  const trusted = remember && await hasTrustedTwoFactorDevice(request, user.id, env);
  const challenge = trusted
    ? { required: false }
    : await createLoginTwoFactorChallenge(user.id, env, { provider: "password", remember });
  if (challenge.required) {
    if (challenge.error) return apiResponse(request, { error: challenge.error }, challenge.status);
    return apiResponse(request, {
      signedIn: false,
      twoFactorRequired: true,
      twoFactorType: "totp",
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt,
    }, 202);
  }

  const publicUser = await getUserById(user.id, env);
  const sessionId = await createUserSession(publicUser, env);
  return authenticatedApiResponse(request, { signedIn: true, sessionId, user: publicUser, emailMissing: !publicUser.emailLinked }, 200, sessionId);
}

async function createLoginTwoFactorChallenge(userId, env, continuation = null) {
  const privateUser = await getPrivateUserById(userId, env);
  if (!privateUser || Number(privateUser.two_factor_enabled) !== 1) {
    return { required: false };
  }
  if (!isTotpConfigured(env)) {
    return {
      required: true,
      status: 503,
      error: "Doğrulama uygulaması sunucu anahtarı eksik. Yönetici TOTP_ENCRYPTION_KEY secret değerini eklemelidir.",
    };
  }
  if (!privateUser.totp_secret_ciphertext) {
    return {
      required: true,
      status: 409,
      error: "Authenticator kurulumu eksik. Hesap desteğiyle iletişime geç.",
    };
  }
  const challengeId = randomBase64Url(32);
  const now = Date.now();
  const expiresAt = now + TOTP_LOGIN_TTL_SECONDS * 1000;
  await env.DB.prepare(`INSERT INTO totp_login_challenges
    (id, user_id, expires_at, attempts, created_at, used_at)
    VALUES (?1, ?2, ?3, 0, ?4, NULL)`)
    .bind(challengeId, privateUser.id, expiresAt, now)
    .run();
  if (continuation && typeof continuation === "object") {
    await saveOAuthState("totp-login", `totp:${challengeId}`, {
      ...continuation,
      userId: String(privateUser.id),
      createdAt: now,
    }, env);
  }
  return {
    required: true,
    challengeId,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

async function verifyLoginTwoFactor(request, env) {
  if (!isTotpConfigured(env)) {
    return apiResponse(request, { error: "Doğrulama uygulaması sunucu anahtarı eksik. Yönetici TOTP_ENCRYPTION_KEY secret değerini eklemelidir." }, 503);
  }
  await ensureUsersSchema(env);
  const input = await requestJson(request);
  const challengeId = String(input.challengeId || "").trim();
  const code = normalizeTotpOrRecoveryCode(input.code);
  if (!challengeId || !code) {
    return apiResponse(request, { error: "Authenticator kodunu veya kurtarma kodunu gir." }, 400);
  }
  const challenge = await env.DB.prepare(`SELECT id, user_id, expires_at, attempts
    FROM totp_login_challenges WHERE id = ?1 AND used_at IS NULL LIMIT 1`)
    .bind(challengeId).first();
  if (!challenge || Number(challenge.expires_at) <= Date.now()) {
    return apiResponse(request, { error: "Giriş doğrulamasının süresi dolmuş. Yeniden giriş yap." }, 400);
  }
  if (Number(challenge.attempts) >= TOTP_MAX_ATTEMPTS) {
    return apiResponse(request, { error: "Çok fazla hatalı deneme yapıldı. Yeniden giriş yap." }, 429);
  }
  const privateUser = await getPrivateUserById(challenge.user_id, env);
  if (!privateUser || Number(privateUser.two_factor_enabled) !== 1 || !privateUser.totp_secret_ciphertext) {
    return apiResponse(request, { error: "Bu iki adımlı doğrulama isteği artık geçerli değil." }, 400);
  }
  const verification = await verifyAndConsumeTotpOrRecovery(privateUser, code, env);
  if (!verification.ok) {
    await env.DB.prepare("UPDATE totp_login_challenges SET attempts = attempts + 1 WHERE id = ?1")
      .bind(challenge.id).run();
    return apiResponse(request, { error: verification.error }, verification.status || 400);
  }
  const consumed = await env.DB.prepare("UPDATE totp_login_challenges SET used_at = ?1 WHERE id = ?2 AND used_at IS NULL")
    .bind(Date.now(), challenge.id).run();
  if (Number(consumed?.meta?.changes || 0) !== 1) {
    return apiResponse(request, { error: "Bu giriş doğrulaması daha önce kullanılmış." }, 409);
  }
  const user = await getUserById(challenge.user_id, env);
  if (!user) return apiResponse(request, { error: "Hesap bulunamadı." }, 404);
  const continuation = await consumeOAuthState("totp-login", `totp:${challenge.id}`, env);
  const safeContinuation = continuation && String(continuation.userId || "") === String(challenge.user_id)
    ? continuation
    : null;
  const sessionId = await createUserSession(user, env);
  let response = authenticatedApiResponse(request, {
    signedIn: true,
    sessionId,
    user,
    emailMissing: !user.emailLinked,
    oauthProvider: ["google", "kick"].includes(safeContinuation?.provider) ? safeContinuation.provider : null,
    kickAccountSession: safeContinuation?.kickAccountSession || null,
  }, 200, sessionId);
  if (input.remember === true || safeContinuation?.remember === true) {
    response = await withIssuedTwoFactorTrustCookie(response, user.id, env);
  }
  return response;
}

async function completeGoogleProfile(request, env) {
  requireAccountConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);

  const dbUser = await env.DB
    .prepare("SELECT id, google_sub FROM users WHERE id = ?1 LIMIT 1")
    .bind(current.session.user.id)
    .first();
  if (!dbUser?.google_sub) return apiResponse(request, { error: "Bu işlem yalnızca Google ile açılan hesaplar içindir." }, 400);

  const input = await requestJson(request);
  const validation = validateCredentials(input, { requireBirthDate: true, requireEmail: false });
  if (!validation.ok) return apiResponse(request, { error: validation.error }, 400);
  const existing = await env.DB
    .prepare("SELECT id FROM users WHERE lower(username) = lower(?1) AND id != ?2 LIMIT 1")
    .bind(validation.username, dbUser.id)
    .first();
  if (existing) return apiResponse(request, { error: "Bu kullanıcı adı başka bir hesapta kayıtlı. Farklı bir kullanıcı adı seç veya mevcut hesabınla giriş yap." }, 409);

  const salt = randomBase64Url(24);
  const passwordHash = await hashPassword(validation.password, salt, PASSWORD_HASH_ITERATIONS_CURRENT);
  await env.DB
    .prepare("UPDATE users SET username = ?1, password_hash = ?2, password_salt = ?3, password_iterations = ?4, birth_date = ?5, updated_at = ?6 WHERE id = ?7")
    .bind(validation.username, passwordHash, salt, PASSWORD_HASH_ITERATIONS_CURRENT, validation.birthDate, new Date().toISOString(), dbUser.id)
    .run();

  const user = await getUserById(dbUser.id, env);
  return apiResponse(request, { signedIn: true, user });
}

async function completeKickProfile(request, env) {
  requireAccountConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);

  const dbUser = await env.DB
    .prepare("SELECT id, kick_user_id FROM users WHERE id = ?1 LIMIT 1")
    .bind(current.session.user.id)
    .first();
  if (!dbUser?.kick_user_id) return apiResponse(request, { error: "Bu işlem yalnızca Kick ile açılan hesaplar içindir." }, 400);

  const input = await requestJson(request);
  const validation = validateCredentials(input, { requireBirthDate: true, requireEmail: false });
  if (!validation.ok) return apiResponse(request, { error: validation.error }, 400);
  const existing = await env.DB
    .prepare("SELECT id FROM users WHERE lower(username) = lower(?1) AND id != ?2 LIMIT 1")
    .bind(validation.username, dbUser.id)
    .first();
  if (existing) return apiResponse(request, { error: "Bu kullanıcı adı başka bir hesapta kayıtlı. Farklı bir kullanıcı adı seç." }, 409);

  const salt = randomBase64Url(24);
  const passwordHash = await hashPassword(validation.password, salt, PASSWORD_HASH_ITERATIONS_CURRENT);
  await env.DB
    .prepare("UPDATE users SET username = ?1, password_hash = ?2, password_salt = ?3, password_iterations = ?4, birth_date = ?5, updated_at = ?6 WHERE id = ?7")
    .bind(validation.username, passwordHash, salt, PASSWORD_HASH_ITERATIONS_CURRENT, validation.birthDate, new Date().toISOString(), dbUser.id)
    .run();

  const user = await getUserById(dbUser.id, env);
  return apiResponse(request, { signedIn: true, user, emailMissing: true });
}

async function createUserSession(user, env) {
  const sessionId = randomBase64Url(48);
  const sessionVersion = await getUserSessionVersion(user.id, env);
  const now = Date.now();
  await ensureUsersSchema(env);
  await env.DB.prepare(`INSERT INTO user_sessions
    (id, user_id, session_version, expires_at, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5)`)
    .bind(sessionId, user.id, sessionVersion, now + USER_SESSION_TTL_SECONDS * 1000, now)
    .run();
  return sessionId;
}

async function resendRegistrationEmailCode(request, env) {
  requireAccountConfiguration(env);
  requireEmailConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const user = await env.DB.prepare("SELECT id, email, email_linked FROM users WHERE id = ?1 LIMIT 1")
    .bind(current.session.user.id).first();
  if (!user) return apiResponse(request, { error: "Hesap bulunamadı." }, 404);
  if (Number(user.email_linked) === 1) return apiResponse(request, { error: "Bu e-posta adresi zaten doğrulanmış." }, 400);
  if (!isPublicEmail(user.email)) return apiResponse(request, { error: "Doğrulanacak bir e-posta adresi bulunamadı." }, 400);
  const input = await requestJson(request);
  const delivery = await issueEmailCode({
    userId: user.id,
    email: user.email,
    purpose: "registration",
    forceResend: Boolean(input.forceResend),
  }, env);
  if (!delivery.ok) return apiResponse(request, { error: delivery.error, retryAfter: delivery.retryAfter || null }, delivery.status);
  return apiResponse(request, { ok: true, email: user.email, expiresInMinutes: EMAIL_CODE_TTL_MINUTES });
}

async function requestEmailChange(request, env) {
  requireAccountConfiguration(env);
  requireEmailConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const email = normalizeEmail(input.email);
  if (!email) return apiResponse(request, { error: "Geçerli bir e-posta adresi girmen gerekiyor." }, 400);
  const user = await getPrivateUserById(current.session.user.id, env);
  if (!user) return apiResponse(request, { error: "Hesap bulunamadı." }, 404);
  const passwordError = await requireCurrentPassword(user, input.currentPassword);
  if (passwordError) return apiResponse(request, { error: passwordError }, 401);
  const cooldown = changeCooldown(user.email_changed_at, 90, "E-posta");
  if (cooldown) return apiResponse(request, { error: cooldown.error, availableAt: cooldown.availableAt }, 429);
  const existing = await env.DB.prepare("SELECT id FROM users WHERE lower(email) = lower(?1) AND id != ?2 LIMIT 1")
    .bind(email, user.id).first();
  if (existing) return apiResponse(request, { error: "Bu e-posta adresi başka bir hesapta kayıtlı." }, 409);
  const delivery = await issueEmailCode({ userId: user.id, email, purpose: "email_change" }, env);
  if (!delivery.ok) return apiResponse(request, { error: delivery.error, retryAfter: delivery.retryAfter || null }, delivery.status);
  return apiResponse(request, { ok: true, email, expiresInMinutes: EMAIL_CODE_TTL_MINUTES });
}

async function requestPasswordChange(request, env) {
  requireAccountConfiguration(env);
  requireEmailConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const user = await getPrivateUserById(current.session.user.id, env);
  if (!user || !isPublicEmail(user.email)) return apiResponse(request, { error: "Şifre değiştirmek için önce e-posta adresini bağlamalısın." }, 400);
  const passwordError = await requireCurrentPassword(user, input.currentPassword);
  if (passwordError) return apiResponse(request, { error: passwordError }, 401);
  const cooldown = changeCooldown(user.password_changed_at, 90, "Şifre");
  if (cooldown) return apiResponse(request, { error: cooldown.error, availableAt: cooldown.availableAt }, 429);
  const delivery = await issueEmailCode({ userId: user.id, email: user.email, purpose: "password_change" }, env);
  if (!delivery.ok) return apiResponse(request, { error: delivery.error, retryAfter: delivery.retryAfter || null }, delivery.status);
  return apiResponse(request, { ok: true, email: user.email, expiresInMinutes: EMAIL_CODE_TTL_MINUTES });
}

async function confirmPasswordChange(request, env) {
  requireAccountConfiguration(env);
  requireEmailConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const user = await getPrivateUserById(current.session.user.id, env);
  if (!user || !isPublicEmail(user.email)) return apiResponse(request, { error: "Bağlı e-posta adresi bulunamadı." }, 400);
  const code = String(input.code || "").replace(/\s/g, "");
  const password = String(input.password || "");
  const repeat = String(input.passwordRepeat || "");
  if (!/^\d{6}$/.test(code)) return apiResponse(request, { error: "6 haneli doğrulama kodunu gir." }, 400);
  if (password.length < 8 || password.length > 128) return apiResponse(request, { error: "Yeni şifre 8 ile 128 karakter arasında olmalıdır." }, 400);
  if (password !== repeat) return apiResponse(request, { error: "Yeni şifreler aynı değil." }, 400);
  const verification = await consumeEmailCode({ email: user.email, code, purpose: "password_change" }, env);
  if (!verification.ok || verification.userId !== user.id) return apiResponse(request, { error: verification.error || "Kod bu hesap için geçerli değil." }, verification.status || 400);
  const salt = randomBase64Url(24);
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password, salt, PASSWORD_HASH_ITERATIONS_CURRENT);
  await env.DB.prepare("UPDATE users SET password_hash = ?1, password_salt = ?2, password_iterations = ?3, password_changed_at = ?4, updated_at = ?4, session_version = session_version + 1 WHERE id = ?5")
    .bind(passwordHash, salt, PASSWORD_HASH_ITERATIONS_CURRENT, now, user.id).run();
  // Revoke every pre-change session, then keep only the browser which
  // completed the e-mail-code challenge signed in with the new version.
  await env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ?1").bind(user.id).run();
  const publicUser = await getUserById(user.id, env);
  const sessionId = await createUserSession(publicUser, env);
  return authenticatedApiResponse(request, { ok: true, signedIn: true, sessionId, user: publicUser }, 200, sessionId);
}

async function beginTotpSetup(request, env) {
  if (!isTotpConfigured(env)) {
    return apiResponse(request, { error: "İki adımlı doğrulamayı açmak için Cloudflare Worker'a TOTP_ENCRYPTION_KEY adında en az 32 karakterlik bir Secret eklenmelidir." }, 503);
  }
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const user = await getPrivateUserById(current.session.user.id, env);
  if (!user) return apiResponse(request, { error: "Hesap bulunamadı." }, 404);
  if (Number(user.two_factor_enabled) === 1 && user.totp_secret_ciphertext) {
    return apiResponse(request, { error: "İki adımlı doğrulama zaten açık." }, 400);
  }
  const secret = base32Encode(crypto.getRandomValues(new Uint8Array(20)));
  const secretCiphertext = await encryptTotpSecret(secret, env);
  const setupId = randomBase64Url(32);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM totp_setups WHERE user_id = ?1").bind(user.id),
    env.DB.prepare(`INSERT INTO totp_setups
      (id, user_id, secret_ciphertext, expires_at, attempts, created_at)
      VALUES (?1, ?2, ?3, ?4, 0, ?5)`)
      .bind(setupId, user.id, secretCiphertext, now + TOTP_SETUP_TTL_SECONDS * 1000, now),
  ]);
  const accountLabel = String(user.email || user.username || user.id).slice(0, 120);
  const issuer = "Play Streamers";
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const otpauthUri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
  return apiResponse(request, {
    ok: true,
    setupId,
    secret,
    formattedSecret: secret.match(/.{1,4}/g)?.join(" ") || secret,
    otpauthUri,
    issuer,
    account: accountLabel,
    expiresAt: new Date(now + TOTP_SETUP_TTL_SECONDS * 1000).toISOString(),
  });
}

async function confirmTotpSetup(request, env) {
  if (!isTotpConfigured(env)) {
    return apiResponse(request, { error: "Doğrulama uygulaması sunucu anahtarı eksik. TOTP_ENCRYPTION_KEY secret değerini ekleyip Worker'ı yeniden yayınla." }, 503);
  }
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const setupId = String(input.setupId || "").trim();
  const code = String(input.code || "").replace(/\s/g, "");
  if (!setupId || !/^\d{6}$/.test(code)) {
    return apiResponse(request, { error: "Doğrulama uygulamasındaki 6 haneli kodu gir." }, 400);
  }
  const setup = await env.DB.prepare(`SELECT id, user_id, secret_ciphertext, expires_at, attempts
    FROM totp_setups WHERE id = ?1 AND user_id = ?2 LIMIT 1`)
    .bind(setupId, current.session.user.id).first();
  if (!setup || Number(setup.expires_at) <= Date.now()) {
    return apiResponse(request, { error: "Authenticator kurulumunun süresi dolmuş. Yeniden başlat." }, 400);
  }
  if (Number(setup.attempts) >= TOTP_MAX_ATTEMPTS) {
    return apiResponse(request, { error: "Çok fazla hatalı deneme yapıldı. Kurulumu yeniden başlat." }, 429);
  }
  const secret = await decryptTotpSecret(setup.secret_ciphertext, env);
  const verification = await verifyTotpCode(secret, code);
  if (!verification.ok) {
    await env.DB.prepare("UPDATE totp_setups SET attempts = attempts + 1 WHERE id = ?1").bind(setup.id).run();
    return apiResponse(request, { error: "Authenticator kodu doğru değil. Telefon saatinin otomatik olduğundan emin ol." }, 400);
  }
  const recoveryCodes = generateTotpRecoveryCodes();
  const createdAt = Date.now();
  const recoveryStatements = [];
  for (const recoveryCode of recoveryCodes) {
    const codeHash = await totpRecoveryCodeHash(setup.user_id, recoveryCode);
    recoveryStatements.push(
      env.DB.prepare(`INSERT INTO totp_recovery_codes (id, user_id, code_hash, used_at, created_at)
        VALUES (?1, ?2, ?3, NULL, ?4)`)
        .bind(randomBase64Url(18), setup.user_id, codeHash, createdAt),
    );
  }
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET two_factor_enabled = 1, totp_secret_ciphertext = ?1,
      totp_last_counter = ?2, updated_at = ?3, session_version = session_version + 1 WHERE id = ?4`)
      .bind(setup.secret_ciphertext, verification.counter, now, setup.user_id),
    env.DB.prepare("DELETE FROM totp_recovery_codes WHERE user_id = ?1").bind(setup.user_id),
    env.DB.prepare("DELETE FROM totp_setups WHERE user_id = ?1").bind(setup.user_id),
    env.DB.prepare("DELETE FROM totp_login_challenges WHERE user_id = ?1").bind(setup.user_id),
    env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ?1").bind(setup.user_id),
    ...recoveryStatements,
  ]);
  const user = await getUserById(setup.user_id, env);
  const sessionId = await createUserSession(user, env);
  return authenticatedApiResponse(request, {
    ok: true,
    signedIn: true,
    sessionId,
    user,
    twoFactorEnabled: true,
    recoveryCodes,
  }, 200, sessionId);
}

async function disableTotp(request, env) {
  if (!isTotpConfigured(env)) {
    return apiResponse(request, { error: "Doğrulama uygulaması sunucu anahtarı eksik. TOTP_ENCRYPTION_KEY secret değerini ekleyip Worker'ı yeniden yayınla." }, 503);
  }
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const code = normalizeTotpOrRecoveryCode(input.code);
  if (!code) return apiResponse(request, { error: "Authenticator kodunu veya kurtarma kodunu gir." }, 400);
  const privateUser = await getPrivateUserById(current.session.user.id, env);
  if (!privateUser || Number(privateUser.two_factor_enabled) !== 1 || !privateUser.totp_secret_ciphertext) {
    return apiResponse(request, { error: "İki adımlı doğrulama açık değil." }, 400);
  }
  const verification = await verifyAndConsumeTotpOrRecovery(privateUser, code, env);
  if (!verification.ok) return apiResponse(request, { error: verification.error }, verification.status || 400);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET two_factor_enabled = 0, totp_secret_ciphertext = NULL,
      totp_last_counter = -1, updated_at = ?1, session_version = session_version + 1 WHERE id = ?2`)
      .bind(now, privateUser.id),
    env.DB.prepare("DELETE FROM totp_recovery_codes WHERE user_id = ?1").bind(privateUser.id),
    env.DB.prepare("DELETE FROM totp_setups WHERE user_id = ?1").bind(privateUser.id),
    env.DB.prepare("DELETE FROM totp_login_challenges WHERE user_id = ?1").bind(privateUser.id),
    env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ?1").bind(privateUser.id),
  ]);
  const user = await getUserById(privateUser.id, env);
  const sessionId = await createUserSession(user, env);
  return authenticatedApiResponse(request, {
    ok: true,
    signedIn: true,
    sessionId,
    user,
    twoFactorEnabled: false,
  }, 200, sessionId);
}

async function regenerateTotpRecoveryCodes(request, env) {
  if (!isTotpConfigured(env)) {
    return apiResponse(request, { error: "Doğrulama uygulaması sunucu anahtarı eksik. TOTP_ENCRYPTION_KEY secret değerini ekleyip Worker'ı yeniden yayınla." }, 503);
  }
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const code = normalizeTotpOrRecoveryCode(input.code);
  if (!code) return apiResponse(request, { error: "Authenticator kodunu veya geçerli bir kurtarma kodunu gir." }, 400);
  const privateUser = await getPrivateUserById(current.session.user.id, env);
  if (!privateUser || Number(privateUser.two_factor_enabled) !== 1 || !privateUser.totp_secret_ciphertext) {
    return apiResponse(request, { error: "İki adımlı doğrulama açık değil." }, 400);
  }
  const verification = await verifyAndConsumeTotpOrRecovery(privateUser, code, env);
  if (!verification.ok) return apiResponse(request, { error: verification.error }, verification.status || 400);

  const recoveryCodes = generateTotpRecoveryCodes();
  const createdAt = Date.now();
  const replacementStatements = [
    env.DB.prepare("DELETE FROM totp_recovery_codes WHERE user_id = ?1").bind(privateUser.id),
  ];
  for (const recoveryCode of recoveryCodes) {
    const codeHash = await totpRecoveryCodeHash(privateUser.id, recoveryCode);
    replacementStatements.push(
      env.DB.prepare(`INSERT INTO totp_recovery_codes (id, user_id, code_hash, used_at, created_at)
        VALUES (?1, ?2, ?3, NULL, ?4)`)
        .bind(randomBase64Url(18), privateUser.id, codeHash, createdAt),
    );
  }
  await env.DB.batch(replacementStatements);
  return apiResponse(request, {
    ok: true,
    recoveryCodes,
    replacedAt: new Date(createdAt).toISOString(),
  });
}

async function requestAccountDeletion(request, env) {
  requireAccountConfiguration(env);
  requireEmailConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const user = await getPrivateUserById(current.session.user.id, env);
  if (!user || !isPublicEmail(user.email)) return apiResponse(request, { error: "Hesabını silmek için önce doğrulanmış bir e-posta adresi bağlamalısın." }, 400);
  const input = await requestJson(request);
  // Closing the confirmation window must not make the received code useless.
  // Reuse an active code for its full 10-minute lifetime; a deliberate resend
  // creates a replacement only after the normal resend cooldown has passed.
  const active = await findActiveEmailCode({ userId: user.id, email: user.email, purpose: "account_delete" }, env);
  if (active && !input.forceResend) {
    return apiResponse(request, {
      ok: true,
      email: user.email,
      reused: true,
      expiresAt: active.expires_at,
      expiresInMinutes: Math.max(1, Math.ceil((Date.parse(active.expires_at) - Date.now()) / 60000)),
    });
  }
  const delivery = await issueEmailCode({
    userId: user.id,
    email: user.email,
    purpose: "account_delete",
    forceResend: Boolean(input.forceResend),
  }, env);
  if (!delivery.ok) return apiResponse(request, { error: delivery.error, retryAfter: delivery.retryAfter || null }, delivery.status);
  return apiResponse(request, { ok: true, email: user.email, expiresInMinutes: EMAIL_CODE_TTL_MINUTES });
}

async function resendAccountCode(request, env) {
  requireAccountConfiguration(env);
  requireEmailConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const purpose = String(input.purpose || "");
  if (!["email_change", "password_change", "account_delete"].includes(purpose)) {
    return apiResponse(request, { error: "Geçersiz kod isteği." }, 400);
  }
  const user = await getPrivateUserById(current.session.user.id, env);
  if (!user) return apiResponse(request, { error: "Hesap bulunamadı." }, 404);
  let email = user.email;
  if (purpose === "email_change") {
    const pending = await findActiveEmailCode({ userId: user.id, purpose }, env);
    if (!pending) return apiResponse(request, { error: "Doğrulanacak bekleyen e-posta isteği bulunamadı." }, 400);
    email = pending.email;
  }
  if (!isPublicEmail(email)) return apiResponse(request, { error: "Kod gönderilecek e-posta adresi bulunamadı." }, 400);
  const delivery = await issueEmailCode({
    userId: user.id,
    email,
    purpose,
    forceResend: Boolean(input.forceResend),
  }, env);
  if (!delivery.ok) return apiResponse(request, { error: delivery.error, retryAfter: delivery.retryAfter || null }, delivery.status);
  return apiResponse(request, { ok: true, email, expiresInMinutes: EMAIL_CODE_TTL_MINUTES });
}

async function verifyEmailAddress(request, env) {
  requireAccountConfiguration(env);
  requireEmailConfiguration(env);
  await ensureUsersSchema(env);
  const input = await requestJson(request);
  const email = normalizeEmail(input.email);
  const code = String(input.code || "").replace(/\s/g, "");
  const purpose = String(input.purpose || "registration");
  if (!email || !/^\d{6}$/.test(code)) return apiResponse(request, { error: "E-posta adresini ve 6 haneli doğrulama kodunu gir." }, 400);
  if (!["registration", "email_change"].includes(purpose)) return apiResponse(request, { error: "Geçersiz doğrulama isteği." }, 400);
  const current = purpose === "email_change" ? await readUserSession(request, env) : null;
  if (purpose === "email_change" && !current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  if (current) {
    const pending = await findActiveEmailCode({ userId: current.session.user.id, email, purpose }, env);
    if (!pending) return apiResponse(request, { error: "Kod bu hesap için geçerli değil." }, 400);
  }
  const verification = await consumeEmailCode({ email, code, purpose }, env);
  if (!verification.ok) return apiResponse(request, { error: verification.error }, verification.status);
  if (current && current.session.user.id !== verification.userId) {
    return apiResponse(request, { error: "Kod bu hesap için geçerli değil." }, 403);
  }
  const now = new Date().toISOString();
  const duplicate = await env.DB.prepare("SELECT id FROM users WHERE lower(email) = lower(?1) AND id != ?2 LIMIT 1")
    .bind(email, verification.userId).first();
  if (duplicate) return apiResponse(request, { error: "Bu e-posta adresi başka bir hesapta kayıtlı." }, 409);
  const query = purpose === "email_change"
    ? "UPDATE users SET email = ?1, email_linked = 1, email_changed_at = ?2, updated_at = ?2, session_version = session_version + 1 WHERE id = ?3"
    : "UPDATE users SET email = ?1, email_linked = 1, updated_at = ?2 WHERE id = ?3";
  await env.DB.prepare(query).bind(email, now, verification.userId).run();
  const user = await getUserById(verification.userId, env);
  if (purpose === "email_change") {
    await env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ?1").bind(verification.userId).run();
    const sessionId = await createUserSession(user, env);
    return authenticatedApiResponse(request, { ok: true, signedIn: true, sessionId, user, message: "E-posta adresin doğrulandı." }, 200, sessionId);
  }
  return apiResponse(request, { ok: true, user, message: "E-posta adresin doğrulandı." });
}

async function requestPasswordReset(request, env) {
  requireAccountConfiguration(env);
  requireEmailConfiguration(env);
  await ensureUsersSchema(env);
  const input = await requestJson(request);
  const email = normalizeEmail(input.email);
  if (!email) return apiResponse(request, { error: "Geçerli bir e-posta adresi girmen gerekiyor." }, 400);
  const user = await env.DB.prepare("SELECT id FROM users WHERE email_linked = 1 AND lower(email) = lower(?1) LIMIT 1")
    .bind(email).first();
  // Account enumeration is avoided: the outward response is identical either way.
  if (user) await issueEmailCode({ userId: user.id, email, purpose: "password_reset", quiet: true }, env);
  return apiResponse(request, { ok: true, message: "Bu e-posta adresi kayıtlıysa doğrulama kodu gönderildi." });
}

async function resetForgottenPassword(request, env) {
  requireAccountConfiguration(env);
  requireEmailConfiguration(env);
  await ensureUsersSchema(env);
  const input = await requestJson(request);
  const email = normalizeEmail(input.email);
  const code = String(input.code || "").replace(/\s/g, "");
  const password = String(input.password || "");
  const repeat = String(input.passwordRepeat || "");
  if (!email || !/^\d{6}$/.test(code)) return apiResponse(request, { error: "E-posta adresini ve 6 haneli kodu gir." }, 400);
  if (password.length < 8 || password.length > 128) return apiResponse(request, { error: "Yeni şifre 8 ile 128 karakter arasında olmalıdır." }, 400);
  if (password !== repeat) return apiResponse(request, { error: "Yeni şifreler birbiriyle aynı değil." }, 400);
  const verification = await consumeEmailCode({ email, code, purpose: "password_reset" }, env);
  if (!verification.ok) return apiResponse(request, { error: verification.error }, verification.status);
  const salt = randomBase64Url(24);
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password, salt, PASSWORD_HASH_ITERATIONS_CURRENT);
  await env.DB.prepare("UPDATE users SET password_hash = ?1, password_salt = ?2, password_iterations = ?3, password_changed_at = ?4, updated_at = ?4, session_version = session_version + 1 WHERE id = ?5")
    .bind(passwordHash, salt, PASSWORD_HASH_ITERATIONS_CURRENT, now, verification.userId).run();
  return apiResponse(request, { ok: true, message: "Şifren yenilendi. Yeni şifrenle giriş yapabilirsin." });
}

async function findActiveEmailCode({ userId, email, purpose }, env) {
  const clauses = ["user_id = ?1", "purpose = ?2", "used_at IS NULL", "expires_at > ?3"];
  const values = [userId, purpose, new Date().toISOString()];
  if (email) {
    clauses.splice(1, 0, "lower(email) = lower(?4)");
    values.push(email);
  }
  return env.DB.prepare(`SELECT id, user_id, email, purpose, expires_at, created_at FROM email_codes WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT 1`)
    .bind(...values).first();
}

async function issueEmailCode({ userId, email, purpose, quiet = false, forceResend = false }, env) {
  const now = Date.now();
  const recent = await env.DB.prepare("SELECT created_at FROM email_codes WHERE lower(email) = lower(?1) AND purpose = ?2 ORDER BY created_at DESC LIMIT 1")
    .bind(email, purpose).first();
  const elapsed = recent?.created_at ? now - Date.parse(recent.created_at) : Infinity;
  if (Number.isFinite(elapsed) && elapsed < EMAIL_CODE_RESEND_SECONDS * 1000) {
    const retryAfter = Math.ceil((EMAIL_CODE_RESEND_SECONDS * 1000 - elapsed) / 1000);
    return { ok: false, status: 429, retryAfter, error: `Yeni kod istemeden önce ${retryAfter} saniye bekle.` };
  }
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + EMAIL_CODE_TTL_MINUTES * 60 * 1000).toISOString();
  const codeHash = await sha256Base64Url(`${purpose}:${email}:${code}`);
  const challengeId = randomBase64Url(24);
  await env.DB.prepare("INSERT INTO email_codes (id, user_id, email, purpose, code_hash, expires_at, attempts, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)")
    .bind(challengeId, userId, email, purpose, codeHash, expiresAt, createdAt).run();
  const sent = await sendEmailCode(email, code, purpose, env);
  if (!sent.ok) {
    await env.DB.prepare("DELETE FROM email_codes WHERE id = ?1").bind(challengeId).run();
    logSecurityEvent("resend_email_delivery_failed", { status: sent.status });
    return quiet ? { ok: true } : { ok: false, status: 502, error: "Doğrulama e-postası gönderilemedi. Birkaç dakika sonra tekrar dene." };
  }
  return { ok: true, challengeId, expiresAt };
}

async function consumeEmailCode({ email, code, purpose }, env) {
  const record = await env.DB.prepare("SELECT id, user_id, code_hash, expires_at, attempts FROM email_codes WHERE lower(email) = lower(?1) AND purpose = ?2 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1")
    .bind(email, purpose).first();
  if (!record) return { ok: false, status: 400, error: "Geçerli bir doğrulama kodu bulunamadı. Yeni kod iste." };
  if (Date.parse(record.expires_at) <= Date.now()) return { ok: false, status: 400, error: "Bu kodun süresi dolmuş. Yeni kod iste." };
  if (Number(record.attempts) >= EMAIL_CODE_MAX_ATTEMPTS) return { ok: false, status: 429, error: "Çok fazla hatalı deneme yapıldı. Yeni kod iste." };
  const candidate = await sha256Base64Url(`${purpose}:${email}:${code}`);
  if (!constantTimeEqual(candidate, record.code_hash)) {
    await env.DB.prepare("UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?1").bind(record.id).run();
    return { ok: false, status: 400, error: "Doğrulama kodu doğru değil." };
  }
  await env.DB.prepare("UPDATE email_codes SET used_at = ?1 WHERE id = ?2").bind(new Date().toISOString(), record.id).run();
  return { ok: true, userId: record.user_id };
}

async function consumeEmailCodeChallenge({ challengeId, code, purpose }, env) {
  const record = await env.DB.prepare(`SELECT id, user_id, email, code_hash, expires_at, attempts
    FROM email_codes
    WHERE id = ?1 AND purpose = ?2 AND used_at IS NULL
    LIMIT 1`)
    .bind(challengeId, purpose)
    .first();
  if (!record) return { ok: false, status: 400, error: "Geçerli bir doğrulama isteği bulunamadı. İşlemi yeniden başlat." };
  if (Date.parse(record.expires_at) <= Date.now()) {
    return { ok: false, status: 400, error: "Bu kodun süresi dolmuş. İşlemi yeniden başlat." };
  }
  if (Number(record.attempts) >= EMAIL_CODE_MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: "Çok fazla hatalı deneme yapıldı. İşlemi yeniden başlat." };
  }
  const candidate = await sha256Base64Url(`${purpose}:${record.email}:${code}`);
  if (!constantTimeEqual(candidate, record.code_hash)) {
    await env.DB.prepare("UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?1").bind(record.id).run();
    return { ok: false, status: 400, error: "Doğrulama kodu doğru değil." };
  }
  await env.DB.prepare("UPDATE email_codes SET used_at = ?1 WHERE id = ?2")
    .bind(new Date().toISOString(), record.id)
    .run();
  return { ok: true, userId: record.user_id };
}

function escapeEmailHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailLogoAttachment() {
  return {
    filename: "play-streamers-logo.png",
    content: EMAIL_LOGO_BASE64,
    content_id: "play-streamers-logo",
  };
}

function formatEmailFileSize(value) {
  const bytes = Math.max(0, Number(value || 0));
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function supportAttachmentListHtml(attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return "";
  return `<section style="margin-top:18px;border:1px solid #29415f;border-radius:13px;padding:14px;background:#081727">
    <p style="margin:0 0 10px;color:#9fb5ca;font-size:11px;font-weight:800;letter-spacing:1.2px">EKLER · ${attachments.length}</p>
    ${attachments.map(item => `<p style="margin:6px 0;color:#e7f1fa;font-size:13px">📎 ${escapeEmailHtml(item.filename || "dosya")} <span style="color:#8299b0">· ${escapeEmailHtml(formatEmailFileSize(item.size))}</span></p>`).join("")}
  </section>`;
}

function playStreamersEmailHtml({ eyebrow, title, bodyHtml, note = "" }) {
  return `<main style="margin:0;padding:32px 16px;background:#07101d;color:#e8f1ff;font-family:Arial,sans-serif">
    <section style="max-width:570px;margin:auto;overflow:hidden;border:1px solid #2f6f37;border-radius:22px;background:#0d1d33;box-shadow:0 18px 46px rgba(0,0,0,.28)">
      <header style="padding:24px 28px;border-bottom:1px solid #263d59;background:linear-gradient(135deg,#112742,#0b192c)">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:54px;height:54px;border:1px solid #53fc18;border-radius:14px;text-align:center;vertical-align:middle;background:#050a08;overflow:hidden"><img src="cid:play-streamers-logo" width="54" height="54" alt="PS" style="display:block;width:54px;height:54px;border:0;border-radius:13px"></td>
        <td style="padding-left:15px"><strong style="display:block;color:#f0f8ff;font-size:14px;letter-spacing:2px">PLAY STREAMERS</strong><span style="display:block;margin-top:5px;color:#8ea5bb;font-size:11px">Destek ve hesap merkezi</span></td>
      </tr></table>
      </header>
      <div style="padding:28px">
        <p style="margin:0;color:#53fc18;font-size:11px;font-weight:800;letter-spacing:1.8px">${escapeEmailHtml(eyebrow)}</p>
        <h1 style="margin:9px 0 18px;color:#f4f8ff;font-size:26px;line-height:1.2">${escapeEmailHtml(title)}</h1>
        <div style="color:#d3dfed;font-size:15px;line-height:1.65">${bodyHtml}</div>
        ${note ? `<p style="margin:24px 0 0;border-top:1px solid #263b55;padding-top:18px;color:#9eb0c5;font-size:12px;line-height:1.55">${escapeEmailHtml(note)}</p>` : ""}
      </div>
    </section>
  </main>`;
}

async function sendEmailCode(email, code, purpose, env) {
  const labels = {
    registration: "e-posta adresini doğrulama",
    email_change: "yeni e-posta adresini doğrulama",
    password_reset: "şifre sıfırlama",
    password_change: "şifre değiştirme",
    account_delete: "hesap silme",
    login_2fa: "iki adımlı giriş doğrulama",
    two_factor_enable: "iki adımlı doğrulamayı açma",
    two_factor_disable: "iki adımlı doğrulamayı kapatma",
  };
  const subject = purpose === "password_reset" ? "Play Streamers şifre sıfırlama kodun"
    : purpose === "password_change" ? "Play Streamers şifre değiştirme kodun"
    : purpose === "account_delete" ? "Play Streamers hesap silme kodun"
    : purpose === "login_2fa" ? "Play Streamers giriş doğrulama kodun"
    : purpose === "two_factor_enable" ? "Play Streamers iki adımlı doğrulamayı açma kodun"
    : purpose === "two_factor_disable" ? "Play Streamers iki adımlı doğrulamayı kapatma kodun"
    : "Play Streamers doğrulama kodun";
  const response = await fetchExternal("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "Play Streamers <noreply@pstreamers.com>",
      to: [email],
      subject,
      text: `Play Streamers ${labels[purpose] || "doğrulama"} kodun: ${code}\n\nBu kod ${EMAIL_CODE_TTL_MINUTES} dakika geçerlidir. Kodu kimseyle paylaşma.`,
      html: playStreamersEmailHtml({
        eyebrow: "GÜVENLİK DOĞRULAMASI",
        title: "Doğrulama kodun",
        bodyHtml: `<p style="margin:0 0 16px">${escapeEmailHtml(labels[purpose] || "Bu işlem")} için aşağıdaki kodu kullan:</p><p style="margin:0;color:#53fc18;font-size:34px;font-weight:900;letter-spacing:7px">${escapeEmailHtml(code)}</p>`,
        note: `Kod ${EMAIL_CODE_TTL_MINUTES} dakika geçerlidir. Kodu kimseyle paylaşma.`,
      }),
      attachments: [emailLogoAttachment()],
    }),
  }, { operation: "resend-email-code", timeoutMs: 10_000 });
  return { ok: response.ok, status: response.status };
}

function resendAttachmentItems(payload) {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.attachments)
        ? payload.attachments
        : [];
  return items.filter(item => !isPlayStreamersEmailLogoAttachment(item));
}

function isPlayStreamersEmailLogoAttachment(item) {
  const filename = sanitizeAttachmentFilename(item?.filename || item?.name || "").toLowerCase();
  const contentId = String(item?.content_id || item?.contentId || "")
    .replace(/[<>]/g, "")
    .trim()
    .toLowerCase();
  return !["play-streamers-logo.png", "play-streamers-email-logo.png"].includes(filename)
    ? contentId === "play-streamers-logo"
    : true;
}

function normalizeSupportAttachments(items, externalId, sender) {
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const normalized = {
      ...item,
      filename: sanitizeAttachmentFilename(item?.filename || item?.name || "dosya"),
      size: Math.max(0, Number(item?.size || 0)),
      type: String(item?.type || item?.content_type || ""),
    };
    if (sender !== "support" && externalId) {
      normalized.emailId = String(item?.emailId || externalId);
      normalized.source = "resend-sent";
      if (!normalized.id) {
        normalized.id = `legacy-${index}`;
        normalized.legacyLookup = true;
      }
    }
    return normalized;
  });
}

async function getResendSentAttachments(emailId, env) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchExternal(
      `https://api.resend.com/emails/${encodeURIComponent(emailId)}/attachments`,
      { headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, Accept: "application/json" } },
      { operation: "resend-sent-attachments", retries: EXTERNAL_GET_RETRIES },
    );
    const payload = await safeJson(response);
    const items = response.ok ? resendAttachmentItems(payload) : [];
    if (items.length) return items;
    if (attempt === 0) await wait(250);
  }
  const emailResponse = await fetchExternal(
    `https://api.resend.com/emails/${encodeURIComponent(emailId)}`,
    { headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, Accept: "application/json" } },
    { operation: "resend-sent-email", retries: EXTERNAL_GET_RETRIES },
  );
  const emailPayload = await safeJson(emailResponse);
  return emailResponse.ok ? resendAttachmentItems(emailPayload) : [];
}

async function saveSupportTicketRecord(env, input) {
  if (!input?.ticketId || !input?.userId) return false;
  const now = new Date().toISOString();
  const status = input.status === "failed" ? "failed" : "open";
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO support_tickets
        (id, user_id, email, subject, source, status, created_at, updated_at, last_reply_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, NULL)`)
        .bind(input.ticketId, input.userId, input.email, input.subject, input.source === "play-connect" ? "play-connect" : "play-streamers", status, now),
      env.DB.prepare(`INSERT INTO support_messages
        (id, ticket_id, sender, body, attachments_json, external_id, created_at)
        VALUES (?1, ?2, 'user', ?3, ?4, ?5, ?6)`)
        .bind(
          randomBase64Url(18),
          input.ticketId,
          input.message,
          JSON.stringify(Array.isArray(input.attachments) ? input.attachments : []),
          input.externalId || null,
          now,
        ),
    ]);
    return true;
  } catch (error) {
    logSecurityEvent("support_ticket_storage_failed", { status, reason: error?.code || error?.name || "unknown" });
    return false;
  }
}

async function sendSupportEmail(request, env, options = {}) {
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("multipart/form-data;")) {
    return apiResponse(request, { error: "Destek formu okunamadı. Sayfayı yenileyip tekrar dene." }, 415);
  }
  const rawLength = request.headers.get("content-length");
  const contentLength = rawLength === null ? null : Number(rawLength);
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_SUPPORT_BODY_BYTES) {
    const error = new Error("Request body too large");
    error.code = "BODY_TOO_LARGE";
    throw error;
  }
  requireEmailConfiguration(env);
  await ensureUsersSchema(env);

  let form;
  try {
    form = await readLimitedFormData(request, MAX_SUPPORT_BODY_BYTES);
  } catch (error) {
    if (error?.code === "BODY_TOO_LARGE") throw error;
    return apiResponse(request, { error: "Destek formundaki alanlar okunamadı. Dosyaları kontrol edip tekrar dene." }, 400);
  }

  if (!options.skipTurnstile) {
    const verification = await verifyTurnstile({
      turnstileToken: String(form.get("turnstileToken") || ""),
    }, request, env);
    if (!verification.ok) return apiResponse(request, { error: verification.error }, verification.status);
  }

  const suppliedSession = options.device ? null : getBearerToken(request);
  const current = suppliedSession ? await readUserSession(request, env) : null;
  if (suppliedSession && !current) {
    return apiResponse(request, { error: "Oturumun sona ermiş. Sayfayı yenileyip tekrar giriş yap." }, 401);
  }
  const ticketOwnerId = options.device?.user_id || current?.session?.user?.id || null;
  const user = ticketOwnerId ? await getUserById(ticketOwnerId, env) : null;
  const source = options.source === "play-connect" ? "play-connect" : "play-streamers";
  const sourceLabel = source === "play-connect" ? "Play Connect" : "Play Streamers";
  const accountEmail = user && isPublicEmail(user.email) ? normalizeEmail(user.email) : null;
  const senderEmail = accountEmail || normalizeEmail(form.get("email"));
  const subject = String(form.get("subject") || "").trim();
  const message = String(form.get("message") || "").trim();

  if (!senderEmail) return apiResponse(request, { error: "Geçerli bir e-posta adresi girmelisin." }, 400);
  if (subject.length < 3 || subject.length > 120) {
    return apiResponse(request, { error: "Konu 3 ile 120 karakter arasında olmalıdır." }, 400);
  }
  if (message.length < 10 || message.length > 3000) {
    return apiResponse(request, { error: "Mesaj 10 ile 3000 karakter arasında olmalıdır." }, 400);
  }

  const files = form.getAll("attachments").filter(value => (
    value && typeof value === "object" && typeof value.arrayBuffer === "function"
  ));
  if (files.length > MAX_SUPPORT_ATTACHMENTS) {
    return apiResponse(request, { error: `En fazla ${MAX_SUPPORT_ATTACHMENTS} dosya ekleyebilirsin.` }, 400);
  }
  let attachmentTotal = 0;
  for (const file of files) {
    const size = Number(file.size || 0);
    const type = String(file.type || "").toLowerCase();
    if (!size) return apiResponse(request, { error: "Boş dosyalar gönderilemez." }, 400);
    if (size > MAX_SUPPORT_ATTACHMENT_BYTES) {
      return apiResponse(request, { error: `Her dosya en fazla ${MAX_SUPPORT_ATTACHMENT_BYTES / 1024 / 1024} MB olabilir.` }, 413);
    }
    if (!SUPPORT_ATTACHMENT_TYPES.has(type)) {
      return apiResponse(request, { error: "Bu dosya türü desteklenmiyor. Görsel, PDF, metin, Word veya Excel dosyası kullan." }, 415);
    }
    attachmentTotal += size;
  }
  if (attachmentTotal > MAX_SUPPORT_ATTACHMENT_TOTAL_BYTES) {
    return apiResponse(request, { error: `Eklerin toplam boyutu en fazla ${MAX_SUPPORT_ATTACHMENT_TOTAL_BYTES / 1024 / 1024} MB olabilir.` }, 413);
  }

  const rateKeySource = options.device
    ? `play-connect-device:${options.device.id}`
    : current
      ? `user:${current.session.user.id}`
    : `public:${request.headers.get("CF-Connecting-IP") || "unknown"}:${senderEmail}`;
  const rateKeyHash = await sha256Base64Url(rateKeySource);
  const reservation = await reserveSupportEmailSlot(rateKeyHash, env);
  if (!reservation.ok) {
    return apiResponse(request, { error: reservation.error, retryAfter: reservation.retryAfter }, 429);
  }

  const ticketId = user ? randomBase64Url(18) : null;
  const originalAttachmentMetadata = files.map(file => ({
    filename: sanitizeAttachmentFilename(file.name),
    size: Number(file.size || 0),
    type: String(file.type || ""),
  }));

  try {
    const attachments = [];
    let attachmentMetadata = originalAttachmentMetadata;
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const filename = sanitizeAttachmentFilename(file.name);
      attachments.push({
        filename,
        content: bytesToBase64(bytes),
      });
    }

    const inboundDomain = String(env.SUPPORT_INBOUND_DOMAIN || "").trim().toLowerCase();
    const replyAddress = ticketId && inboundDomain && env.RESEND_WEBHOOK_SECRET
      ? `support+${ticketId}@${inboundDomain}`
      : senderEmail;

    const senderIdentity = supportSenderIdentity(user, senderEmail);
    const supportText = `Kaynak: ${sourceLabel}\nGönderen: ${senderEmail}\nHesap durumu: ${user ? "Oturum doğrulandı" : "Ziyaretçi"}\n${attachmentMetadata.length ? `Ekler: ${attachmentMetadata.map(item => item.filename).join(", ")}\n` : ""}\n${message}`;
    const supportHtml = source === "play-connect"
      ? `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#172033">
          <h2 style="margin:0 0 18px">Play Connect destek talebi</h2>
          <p style="margin:0 0 6px"><strong>Gönderen:</strong> ${escapeEmailHtml(senderEmail)}</p>
          <p style="margin:0 0 18px"><strong>Konu:</strong> ${escapeEmailHtml(subject)}</p>
          <div style="border-left:3px solid #53fc18;padding:12px 15px;background:#f5f8fb">${escapeEmailHtml(message).replaceAll("\n", "<br>")}</div>
          ${supportAttachmentListHtml(attachmentMetadata)}
        </div>`
      : playStreamersEmailHtml({
          eyebrow: ticketId ? `DESTEK TALEBİ · ${ticketId}` : "ZİYARETÇİ MESAJI",
          title: subject,
          bodyHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr>
              <td style="width:50%;padding:12px;border:1px solid #29415f;border-radius:11px 0 0 11px;background:#091828"><span style="display:block;color:#8299b0;font-size:10px;font-weight:800;letter-spacing:1px">GÖNDEREN</span><strong style="display:block;margin-top:5px;color:#eaf4ff;font-size:13px">${escapeEmailHtml(senderEmail)}</strong></td>
              <td style="width:50%;padding:12px;border:1px solid #29415f;border-left:0;border-radius:0 11px 11px 0;background:#091828"><span style="display:block;color:#8299b0;font-size:10px;font-weight:800;letter-spacing:1px">KAYNAK · HESAP</span><strong style="display:block;margin-top:5px;color:${user ? "#53fc18" : "#f5c96b"};font-size:13px">${sourceLabel} · ${user ? "Doğrulandı" : "Ziyaretçi"}</strong></td>
            </tr></table>
            <div style="border-left:3px solid #53fc18;border-radius:0 12px 12px 0;padding:15px 17px;background:#071522;color:#edf6ff">${escapeEmailHtml(message).replaceAll("\n", "<br>")}</div>
            ${supportAttachmentListHtml(attachmentMetadata)}`,
          note: `Bu mesaj ${sourceLabel} destek formu üzerinden gönderildi.`,
        });
    const response = await fetchExternal("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
        "idempotency-key": `support-${reservation.id}`,
      },
      body: JSON.stringify({
        // Arbitrary visitor addresses cannot be used as the SMTP From address
        // without domain verification. Show the verified account identity in
        // the friendly name while keeping DMARC-aligned pstreamers.com mail.
        from: env.RESEND_FROM_EMAIL || (source === "play-connect"
          ? "Play Connect Destek <noreply@pstreamers.com>"
          : `${senderIdentity} via Play Streamers <noreply@pstreamers.com>`),
        to: [SUPPORT_EMAIL_RECIPIENT],
        reply_to: replyAddress,
        subject: `${ticketId ? `[Talep ${ticketId}] ` : ""}[${sourceLabel} Destek] ${subject}`,
        text: supportText,
        html: supportHtml,
        attachments: source === "play-connect" ? attachments : [emailLogoAttachment(), ...attachments],
      }),
    }, { operation: "resend-support-email", timeoutMs: 15_000 });
    const result = await safeJson(response);
    if (!response.ok) {
      await releaseSupportEmailSlot(reservation.id, env);
      if (ticketId && user) {
        await saveSupportTicketRecord(env, {
          ticketId,
          userId: user.id,
          email: senderEmail,
          subject,
          message,
          attachments: originalAttachmentMetadata,
          status: "failed",
          source,
        });
      }
      logSecurityEvent("support_email_delivery_failed", { status: response.status });
      return apiResponse(request, { error: "Mesaj şu anda gönderilemedi. Birkaç dakika sonra tekrar dene." }, 502);
    }
    if (user && result?.id && attachmentMetadata.length) {
      attachmentMetadata = normalizeSupportAttachments(attachmentMetadata, result.id, "user");
      try {
        const sentFiles = await getResendSentAttachments(result.id, env);
        if (sentFiles.length) {
          attachmentMetadata = normalizeSupportAttachments(sentFiles.slice(0, MAX_SUPPORT_ATTACHMENTS).map(item => ({
            id: String(item?.id || "").slice(0, 180),
            emailId: String(result.id),
            filename: sanitizeAttachmentFilename(item?.filename || "dosya"),
            size: Math.max(0, Number(item?.size || 0)),
            type: String(item?.content_type || ""),
            source: "resend-sent",
          })), result.id, "user");
        }
      } catch {
        // The support e-mail is already accepted. Filename/size metadata still
        // keeps the attachment visible even if Resend's listing is transient.
      }
    }
    let savedTicketId = null;
    if (ticketId && user) {
      const saved = await saveSupportTicketRecord(env, {
        ticketId,
        userId: user.id,
        email: senderEmail,
        subject,
        message,
        attachments: attachmentMetadata,
        externalId: result?.id || null,
        status: "open",
        source,
      });
      if (saved) savedTicketId = ticketId;
    }
    logSecurityEvent("support_email_sent", { attachmentCount: attachments.length });
    return apiResponse(request, { ok: true, sent: true, id: result?.id || null, ticketId: savedTicketId }, 201);
  } catch (error) {
    await releaseSupportEmailSlot(reservation.id, env);
    if (ticketId && user) {
      await saveSupportTicketRecord(env, {
        ticketId,
        userId: user.id,
        email: senderEmail,
        subject,
        message,
        attachments: originalAttachmentMetadata,
        status: "failed",
        source,
      });
    }
    logSecurityEvent("support_email_delivery_unavailable", { reason: error?.code || error?.name || "unknown" });
    return apiResponse(request, { error: "Mesaj şu anda gönderilemedi. Bağlantını kontrol edip tekrar dene." }, 503);
  }
}

async function listSupportTickets(request, env) {
  requireAccountConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);

  const result = await env.DB.prepare(`SELECT
      t.id AS ticket_id, t.subject, t.source, t.status, t.created_at AS ticket_created_at,
      t.updated_at, t.last_reply_at,
      m.id AS message_id, m.sender, m.body, m.attachments_json, m.external_id,
      m.created_at AS message_created_at
    FROM support_tickets t
    LEFT JOIN support_messages m ON m.ticket_id = t.id
    WHERE t.user_id = ?1
    ORDER BY t.updated_at DESC, m.created_at ASC
    LIMIT 500`).bind(current.session.user.id).all();

  const grouped = new Map();
  for (const row of result.results || []) {
    let ticket = grouped.get(row.ticket_id);
    if (!ticket) {
      ticket = {
        id: row.ticket_id,
        subject: row.subject,
        source: row.source === "play-connect" ? "play-connect" : "play-streamers",
        status: row.status,
        createdAt: row.ticket_created_at,
        updatedAt: row.updated_at,
        lastReplyAt: row.last_reply_at || null,
        messages: [],
      };
      grouped.set(row.ticket_id, ticket);
    }
    if (row.message_id) {
      let attachments = [];
      try { attachments = JSON.parse(String(row.attachments_json || "[]")); } catch { attachments = []; }
      attachments = normalizeSupportAttachments(attachments, row.external_id, row.sender);
      ticket.messages.push({
        id: row.message_id,
        sender: row.sender === "support" ? "support" : "user",
        body: row.body,
        attachments: Array.isArray(attachments) ? attachments : [],
        createdAt: row.message_created_at,
      });
    }
  }
  return apiResponse(request, { ok: true, tickets: [...grouped.values()] });
}

async function syncNotifications(request, env) {
  requireAccountConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const row = await env.DB.prepare(`SELECT MAX(last_reply_at) AS last_reply_at
    FROM support_tickets WHERE user_id = ?1`)
    .bind(current.session.user.id)
    .first();
  const lastReplyAt = row?.last_reply_at ? String(row.last_reply_at) : null;
  const signature = await sha256Base64Url(`notifications:${current.session.user.id}:${CURRENT_RELEASE_VERSION}:${lastReplyAt || "none"}`);
  if (request.headers.get("If-None-Match") === `W/"${signature}"`) {
    const headers = new Headers({
      "cache-control": "private, no-store",
      etag: `W/"${signature}"`,
    });
    const origin = request.headers.get("Origin");
    if (origin && ALLOWED_FRONTEND_ORIGINS.has(origin)) {
      headers.set("access-control-allow-origin", origin);
      headers.set("access-control-allow-credentials", "true");
      headers.set("access-control-expose-headers", "ETag");
      headers.set("vary", "Origin");
    }
    return new Response(null, { status: 304, headers });
  }
  const response = apiResponse(request, {
    ok: true,
    latestVersion: CURRENT_RELEASE_VERSION,
    latestPublishedAt: CURRENT_RELEASE_PUBLISHED_AT,
    lastReplyAt,
  });
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-store");
  headers.set("etag", `W/"${signature}"`);
  headers.set("access-control-expose-headers", "ETag");
  return new Response(response.body, { status: response.status, headers });
}

function isSafeResendAttachmentUrl(value) {
  let url;
  try { url = value instanceof URL ? value : new URL(value); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host || host === "localhost" || host.endsWith(".localhost")
    || host.endsWith(".local") || host.endsWith(".internal")
    || host.endsWith(".test") || host.endsWith(".example") || host.endsWith(".invalid")
  ) return false;
  if (host.includes(":") && (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:"))) return false;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some(value => value > 255)) return false;
    if (
      octets[0] === 0 || octets[0] === 10 || octets[0] === 127
      || (octets[0] === 169 && octets[1] === 254)
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168)
      || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)
      || (octets[0] === 192 && octets[1] === 0)
      || (octets[0] === 198 && (octets[1] === 18 || octets[1] === 19))
      || (octets[0] === 198 && octets[1] === 51 && octets[2] === 100)
      || (octets[0] === 203 && octets[1] === 0 && octets[2] === 113)
      || octets[0] >= 224
    ) return false;
  }
  return true;
}

async function fetchSafeSupportAttachment(initialUrl) {
  let currentUrl = initialUrl instanceof URL ? initialUrl : new URL(initialUrl);
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    if (!isSafeResendAttachmentUrl(currentUrl)) {
      const error = new Error("attachment-url-rejected");
      error.code = "ATTACHMENT_URL_REJECTED";
      throw error;
    }
    const response = await fetchExternal(
      currentUrl.href,
      { redirect: "manual" },
      { operation: "resend-attachment-download", timeoutMs: 15_000 },
    );
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location || redirectCount === 3) {
      const error = new Error("attachment-redirect-invalid");
      error.code = "ATTACHMENT_REDIRECT_INVALID";
      throw error;
    }
    try {
      currentUrl = new URL(location, currentUrl);
    } catch {
      const error = new Error("attachment-redirect-invalid");
      error.code = "ATTACHMENT_REDIRECT_INVALID";
      throw error;
    }
  }
  const error = new Error("attachment-redirect-limit");
  error.code = "ATTACHMENT_REDIRECT_INVALID";
  throw error;
}

async function downloadSupportAttachment(request, env, url) {
  requireAccountConfiguration(env);
  requireEmailConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const parts = url.pathname.split("/").filter(Boolean);
  const messageId = decodeURIComponent(parts[3] || "");
  const attachmentId = decodeURIComponent(parts[4] || "");
  if (!messageId || !attachmentId || parts.length !== 5) {
    return apiResponse(request, { error: "Dosya bağlantısı geçersiz." }, 400);
  }
  const row = await env.DB.prepare(`SELECT m.attachments_json, m.external_id, m.sender
    FROM support_messages m
    JOIN support_tickets t ON t.id = m.ticket_id
    WHERE m.id = ?1 AND t.user_id = ?2
    LIMIT 1`)
    .bind(messageId, current.session.user.id).first();
  if (!row) return apiResponse(request, { error: "Dosya bulunamadı." }, 404);
  let attachments = [];
  try { attachments = JSON.parse(String(row.attachments_json || "[]")); } catch { attachments = []; }
  attachments = normalizeSupportAttachments(attachments, row.external_id, row.sender);
  const attachment = attachments.find(item => (
    String(item?.id || "") === attachmentId
      && (item?.source === "resend-inbound" || item?.source === "resend-sent")
      && item?.emailId
  ));
  if (!attachment) return apiResponse(request, { error: "Bu dosya indirilmeye uygun değil." }, 404);
  let providerAttachmentId = attachmentId;
  if (attachment.source === "resend-sent" && (attachment.legacyLookup || attachmentId.startsWith("legacy-"))) {
    let sentFiles = [];
    try {
      sentFiles = await getResendSentAttachments(attachment.emailId, env);
    } catch {
      sentFiles = [];
    }
    const wantedFilename = sanitizeAttachmentFilename(attachment.filename || "dosya");
    const wantedSize = Math.max(0, Number(attachment.size || 0));
    const fallbackIndex = Math.max(0, Number.parseInt(attachmentId.replace("legacy-", ""), 10) || 0);
    const matched = sentFiles.find(item => (
      sanitizeAttachmentFilename(item?.filename || "dosya") === wantedFilename
      && (!wantedSize || !Number(item?.size) || Number(item.size) === wantedSize)
    )) || sentFiles[fallbackIndex];
    providerAttachmentId = String(matched?.id || "");
    if (!providerAttachmentId) {
      return apiResponse(request, { error: "Dosya kaydı Resend üzerinde bulunamadı." }, 502);
    }
  }
  const attachmentEndpoint = attachment.source === "resend-inbound"
    ? `https://api.resend.com/emails/receiving/${encodeURIComponent(attachment.emailId)}/attachments/${encodeURIComponent(providerAttachmentId)}`
    : `https://api.resend.com/emails/${encodeURIComponent(attachment.emailId)}/attachments/${encodeURIComponent(providerAttachmentId)}`;
  const metadataResponse = await fetchExternal(
    attachmentEndpoint,
    { headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, Accept: "application/json" } },
    { operation: "resend-received-attachment", retries: EXTERNAL_GET_RETRIES },
  );
  const metadata = await safeJson(metadataResponse);
  if (!metadataResponse.ok || !metadata?.download_url) {
    return apiResponse(request, { error: "Dosya bağlantısı şu anda hazırlanamadı." }, 502);
  }
  let downloadUrl;
  try { downloadUrl = new URL(metadata.download_url); } catch { return apiResponse(request, { error: "Dosya bağlantısı geçersiz." }, 502); }
  if (!isSafeResendAttachmentUrl(downloadUrl)) {
    return apiResponse(request, { error: "Dosya kaynağı doğrulanamadı." }, 502);
  }
  let fileResponse;
  try {
    fileResponse = await fetchSafeSupportAttachment(downloadUrl);
  } catch (error) {
    logSecurityEvent("support_attachment_download_failed", { reason: error?.code || error?.name || "unknown" });
    const message = error?.code === "ATTACHMENT_URL_REJECTED"
      ? "Dosya kaynağı güvenlik kontrolünden geçemedi."
      : "Dosya bağlantısı şu anda açılamadı.";
    return apiResponse(request, { error: message }, 502);
  }
  if (!fileResponse.ok || !fileResponse.body) {
    return apiResponse(request, { error: "Dosya şu anda indirilemedi." }, 502);
  }
  const filename = sanitizeAttachmentFilename(metadata.filename || attachment.filename || "dosya");
  const headers = new Headers({
    "cache-control": "private, no-store",
    "content-type": String(metadata.content_type || attachment.type || fileResponse.headers.get("content-type") || "application/octet-stream"),
    "content-disposition": `attachment; filename="dosya"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "x-content-type-options": "nosniff",
  });
  const origin = request.headers.get("Origin");
  if (origin && ALLOWED_FRONTEND_ORIGINS.has(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.set("access-control-expose-headers", "Content-Disposition");
    headers.set("vary", "Origin");
  }
  return new Response(fileResponse.body, { status: 200, headers });
}

async function receiveResendWebhook(request, env) {
  if (!env.RESEND_WEBHOOK_SECRET || !env.RESEND_API_KEY) {
    return apiResponse(request, { error: "Resend webhook yapılandırması eksik." }, 503);
  }
  const rawLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(rawLength) && rawLength > 256 * 1024) {
    return apiResponse(request, { error: "Webhook gövdesi çok büyük." }, 413);
  }
  const rawBody = await request.text();
  const verification = await verifyResendWebhook(rawBody, request.headers, env.RESEND_WEBHOOK_SECRET);
  if (!verification.ok) return apiResponse(request, { error: "Webhook imzası geçersiz." }, 401);

  let event;
  try { event = JSON.parse(rawBody); } catch { return apiResponse(request, { error: "Webhook gövdesi geçersiz." }, 400); }
  if (event?.type !== "email.received") return apiResponse(request, { ok: true, ignored: true });

  await ensureUsersSchema(env);
  const svixId = String(request.headers.get("svix-id") || "").slice(0, 180);
  const duplicate = await env.DB.prepare("SELECT svix_id FROM support_webhook_events WHERE svix_id = ?1 LIMIT 1")
    .bind(svixId).first();
  if (duplicate) return apiResponse(request, { ok: true, duplicate: true });

  const sender = normalizeMailbox(event?.data?.from);
  const allowedSenders = new Set([
    SUPPORT_EMAIL_RECIPIENT,
    ...String(env.SUPPORT_REPLY_SENDERS || "").split(",").map(normalizeMailbox).filter(Boolean),
  ]);
  if (!sender || !allowedSenders.has(sender)) {
    return apiResponse(request, { ok: true, ignored: true });
  }

  const recipients = Array.isArray(event?.data?.to) ? event.data.to : [];
  const ticketId = supportTicketIdFromRecipients(recipients)
    || supportTicketIdFromSubject(event?.data?.subject);
  if (!ticketId) return apiResponse(request, { ok: true, ignored: true });
  const ticket = await env.DB.prepare("SELECT id, user_id, email, subject FROM support_tickets WHERE id = ?1 LIMIT 1")
    .bind(ticketId).first();
  if (!ticket) return apiResponse(request, { ok: true, ignored: true });

  const emailId = String(event?.data?.email_id || "");
  if (!emailId) return apiResponse(request, { error: "Gelen e-posta kimliği eksik." }, 400);
  const emailResponse = await fetchExternal(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, Accept: "application/json", "user-agent": "PlayStreamers-Worker/2.2" },
  }, { operation: "resend-received-email", retries: EXTERNAL_GET_RETRIES });
  const email = await safeJson(emailResponse);
  if (!emailResponse.ok) {
    logSecurityEvent("support_reply_content_failed", { status: emailResponse.status });
    return apiResponse(request, { error: "Gelen e-posta içeriği alınamadı." }, 502);
  }

  const body = cleanSupportReply(email?.text || plainTextFromHtml(email?.html) || event?.data?.subject || "Destek ekibi talebini yanıtladı.");
  const attachments = (Array.isArray(email?.attachments) ? email.attachments : [])
    .filter(item => !isPlayStreamersEmailLogoAttachment(item))
    .slice(0, MAX_SUPPORT_ATTACHMENTS)
    .map(item => ({
      id: String(item?.id || "").slice(0, 180),
      emailId,
      filename: sanitizeAttachmentFilename(item?.filename || "dosya"),
      size: Math.max(0, Number(item?.size || 0)),
      type: String(item?.content_type || ""),
      source: "resend-inbound",
    }));
  const receivedAt = new Date(email?.created_at || event?.data?.created_at || "");
  const now = Number.isFinite(receivedAt.getTime()) ? receivedAt.toISOString() : new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO support_messages
      (id, ticket_id, sender, body, attachments_json, external_id, created_at)
      VALUES (?1, ?2, 'support', ?3, ?4, ?5, ?6)`)
      .bind(randomBase64Url(18), ticket.id, body, JSON.stringify(attachments), emailId, now),
    env.DB.prepare("UPDATE support_tickets SET status = 'answered', updated_at = ?1, last_reply_at = ?1 WHERE id = ?2")
      .bind(now, ticket.id),
    env.DB.prepare("INSERT INTO support_webhook_events (svix_id, created_at) VALUES (?1, ?2)")
      .bind(svixId, now),
  ]);
  return apiResponse(request, { ok: true });
}

async function verifyResendWebhook(payload, headers, webhookSecret) {
  const id = String(headers.get("svix-id") || "");
  const timestamp = String(headers.get("svix-timestamp") || "");
  const signatures = String(headers.get("svix-signature") || "").split(/\s+/).filter(Boolean);
  const timestampSeconds = Number(timestamp);
  if (!id || !Number.isFinite(timestampSeconds) || !signatures.length) return { ok: false };
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > 5 * 60) return { ok: false };
  try {
    const rawSecret = String(webhookSecret).startsWith("whsec_")
      ? String(webhookSecret).slice(6)
      : String(webhookSecret);
    const encodedSecret = rawSecret.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(rawSecret.length / 4) * 4, "=");
    const key = await crypto.subtle.importKey(
      "raw",
      base64ToBytes(encodedSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signed = new TextEncoder().encode(`${id}.${timestamp}.${payload}`);
    const expected = bytesToBase64(new Uint8Array(await crypto.subtle.sign("HMAC", key, signed)));
    return { ok: signatures.some(value => value.startsWith("v1,") && constantTimeEqual(value.slice(3), expected)) };
  } catch {
    return { ok: false };
  }
}

function supportTicketIdFromRecipients(recipients) {
  for (const recipient of recipients) {
    const match = String(recipient || "").match(/support\+([A-Za-z0-9_-]{16,80})@/i);
    if (match) return match[1];
  }
  return null;
}

function supportTicketIdFromSubject(subject) {
  const match = String(subject || "").match(/\[Talep\s+([A-Za-z0-9_-]{16,80})\]/i);
  return match ? match[1] : null;
}

function cleanSupportReply(value) {
  const normalized = String(value || "").replace(/\r\n?/g, "\n");
  const quoteHeaders = [
    /\n\s*On\b[\s\S]{0,1400}?\bwrote:\s*/iu,
    /\n\s*[\s\S]{0,1400}?\btarihinde\b[\s\S]{0,700}?\b(?:şunu\s+)?yazdı:\s*/iu,
    /\n\s*(?:From|Kimden):\s+/iu,
    /\n\s*>/u,
  ];
  let cutAt = normalized.length;
  for (const pattern of quoteHeaders) {
    const match = pattern.exec(normalized);
    if (match && match.index < cutAt) cutAt = match.index;
  }
  return normalized.slice(0, cutAt).trim().slice(0, 10_000) || "Destek ekibi talebini yanıtladı.";
}

function plainTextFromHtml(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"');
}

async function readLimitedFormData(request, maxBytes) {
  const rawLength = request.headers.get("content-length");
  const contentLength = rawLength === null ? null : Number(rawLength);
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > maxBytes) {
    const error = new Error("Request body too large");
    error.code = "BODY_TOO_LARGE";
    throw error;
  }
  if (!request.body) return new FormData();

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel("Support request body limit exceeded");
      const error = new Error("Request body too large");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const contentType = request.headers.get("content-type") || "";
  return new Response(body, { headers: { "content-type": contentType } }).formData();
}

async function reserveSupportEmailSlot(rateKeyHash, env) {
  const now = Date.now();
  const record = await env.DB.prepare(`SELECT COUNT(*) AS request_count, MAX(created_at) AS latest
    FROM support_email_log WHERE rate_key_hash = ?1 AND created_at > ?2`)
    .bind(rateKeyHash, now - SUPPORT_RATE_LIMIT_WINDOW_MS)
    .first();
  const latest = Number(record?.latest || 0);
  if (latest && now - latest < SUPPORT_RATE_LIMIT_COOLDOWN_MS) {
    const retryAfter = Math.max(1, Math.ceil((SUPPORT_RATE_LIMIT_COOLDOWN_MS - (now - latest)) / 1000));
    return { ok: false, retryAfter, error: `Yeni mesaj göndermeden önce ${retryAfter} saniye bekle.` };
  }
  if (Number(record?.request_count || 0) >= SUPPORT_RATE_LIMIT_MAX) {
    return { ok: false, retryAfter: 3600, error: "Saatlik destek mesajı sınırına ulaştın. Bir süre sonra tekrar dene." };
  }
  const id = randomBase64Url(24);
  await env.DB.prepare("INSERT INTO support_email_log (id, rate_key_hash, created_at) VALUES (?1, ?2, ?3)")
    .bind(id, rateKeyHash, now)
    .run();
  return { ok: true, id };
}

async function releaseSupportEmailSlot(id, env) {
  if (!id) return;
  await env.DB.prepare("DELETE FROM support_email_log WHERE id = ?1").bind(id).run();
}

function sanitizeAttachmentFilename(value) {
  const clean = String(value || "dosya")
    .normalize("NFKC")
    .replace(/[\\/\u0000-\u001f\u007f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return clean || "dosya";
}

function supportSenderIdentity(user, senderEmail) {
  const raw = String(user?.username || user?.name || senderEmail || "Kullanıcı")
    .normalize("NFKC")
    .replace(/[<>"\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  const email = String(senderEmail || "").replace(/[<>"\r\n]/g, "").slice(0, 120);
  return `\"${raw || "Kullanıcı"} · ${email}\"`;
}

async function updateUsername(request, env) {
  requireAccountConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const username = validateUsername(input.username);
  if (!username.ok) return apiResponse(request, { error: username.error }, 400);
  const user = await getPrivateUserById(current.session.user.id, env);
  if (!user) return apiResponse(request, { error: "Hesap bulunamadı." }, 404);
  const cooldown = changeCooldown(user.username_changed_at, 60, "Kullanıcı adı");
  if (cooldown) return apiResponse(request, { error: cooldown.error, availableAt: cooldown.availableAt }, 429);
  const existing = await env.DB.prepare("SELECT id FROM users WHERE lower(username) = lower(?1) AND id != ?2 LIMIT 1")
    .bind(username.value, user.id).first();
  if (existing) return apiResponse(request, { error: "Bu kullanıcı adı zaten kullanılıyor." }, 409);
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE users SET username = ?1, display_name = ?1, username_changed_at = ?2, updated_at = ?2 WHERE id = ?3")
    .bind(username.value, now, user.id).run();
  return accountUpdateResponse(request, current, env);
}

async function updateEmail(request, env) {
  requireAccountConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const email = String(input.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return apiResponse(request, { error: "Geçerli bir e-posta adresi girmen gerekiyor." }, 400);
  const user = await getPrivateUserById(current.session.user.id, env);
  if (!user) return apiResponse(request, { error: "Hesap bulunamadı." }, 404);
  const passwordError = await requireCurrentPassword(user, input.currentPassword);
  if (passwordError) return apiResponse(request, { error: passwordError }, 401);
  const cooldown = changeCooldown(user.email_changed_at, 90, "E-posta");
  if (cooldown) return apiResponse(request, { error: cooldown.error, availableAt: cooldown.availableAt }, 429);
  const existing = await env.DB.prepare("SELECT id FROM users WHERE lower(email) = lower(?1) AND id != ?2 LIMIT 1")
    .bind(email, user.id).first();
  if (existing) return apiResponse(request, { error: "Bu e-posta adresi başka bir hesapta kayıtlı." }, 409);
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE users SET email = ?1, email_linked = 1, email_changed_at = ?2, updated_at = ?2 WHERE id = ?3")
    .bind(email, now, user.id).run();
  return accountUpdateResponse(request, current, env);
}

async function updatePassword(request, env) {
  requireAccountConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const user = await getPrivateUserById(current.session.user.id, env);
  if (!user) return apiResponse(request, { error: "Hesap bulunamadı." }, 404);
  const passwordError = await requireCurrentPassword(user, input.currentPassword);
  if (passwordError) return apiResponse(request, { error: passwordError }, 401);
  const cooldown = changeCooldown(user.password_changed_at, 90, "Şifre");
  if (cooldown) return apiResponse(request, { error: cooldown.error, availableAt: cooldown.availableAt }, 429);
  const password = String(input.password || "");
  if (password.length < 8 || password.length > 128) return apiResponse(request, { error: "Yeni şifre 8 ile 128 karakter arasında olmalıdır." }, 400);
  if (password !== String(input.passwordRepeat || "")) return apiResponse(request, { error: "Yeni şifreler birbiriyle aynı değil." }, 400);
  const salt = randomBase64Url(24);
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password, salt, PASSWORD_HASH_ITERATIONS_CURRENT);
  await env.DB.prepare("UPDATE users SET password_hash = ?1, password_salt = ?2, password_iterations = ?3, password_changed_at = ?4, updated_at = ?4 WHERE id = ?5")
    .bind(passwordHash, salt, PASSWORD_HASH_ITERATIONS_CURRENT, now, user.id).run();
  return accountUpdateResponse(request, current, env);
}

async function updateAvatar(request, env) {
  requireAccountConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const avatar = String(input.avatar || "").trim();
  if (!/^avatar:[a-z0-9-]{2,32}$/.test(avatar) && !/^https:\/\/[^\s]{1,2000}$/.test(avatar)) {
    return apiResponse(request, { error: "Geçerli bir profil fotoğrafı seçmen gerekiyor." }, 400);
  }
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE users SET avatar_url = ?1, updated_at = ?2 WHERE id = ?3")
    .bind(avatar, now, current.session.user.id).run();
  return accountUpdateResponse(request, current, env);
}

async function deleteAccount(request, env) {
  requireAccountConfiguration(env);
  requireEmailConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const user = await getPrivateUserById(current.session.user.id, env);
  if (!user) return apiResponse(request, { error: "Hesap bulunamadı." }, 404);
  if (!isPublicEmail(user.email)) return apiResponse(request, { error: "Hesabını silmek için doğrulanmış e-posta adresi gerekiyor." }, 400);
  const code = String(input.code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return apiResponse(request, { error: "E-postana gelen 6 haneli silme kodunu gir." }, 400);
  const verification = await consumeEmailCode({ email: user.email, code, purpose: "account_delete" }, env);
  if (!verification.ok || verification.userId !== user.id) {
    return apiResponse(request, { error: verification.error || "Kod bu hesap için geçerli değil." }, verification.status || 400);
  }
  // Send this before removing the address from the database.  A failed
  // notification must never stop the user from deleting their account.
  await sendAccountDeletedEmail(user.email, env).catch(error => logSecurityEvent("account_deleted_email_failed", {
    reason: error?.code || error?.name || "unknown",
  }));
  const supportRateKeyHash = await sha256Base64Url(`user:${user.id}`);
  const deleteStatements = [
    env.DB.prepare("DELETE FROM support_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id = ?1)").bind(user.id),
    env.DB.prepare("DELETE FROM support_tickets WHERE user_id = ?1").bind(user.id),
    env.DB.prepare("DELETE FROM support_email_log WHERE rate_key_hash = ?1").bind(supportRateKeyHash),
    env.DB.prepare("DELETE FROM oauth_states WHERE CAST(json_extract(payload_json, '$.linkUserId') AS TEXT) = ?1").bind(user.id),
    env.DB.prepare("DELETE FROM kick_refresh_locks WHERE session_id IN (SELECT id FROM kick_sessions WHERE user_id = ?1)").bind(user.id),
    env.DB.prepare("DELETE FROM kick_sessions WHERE user_id = ?1").bind(user.id),
    env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ?1").bind(user.id),
    env.DB.prepare("DELETE FROM email_codes WHERE user_id = ?1").bind(user.id),
    env.DB.prepare("DELETE FROM totp_setups WHERE user_id = ?1").bind(user.id),
    env.DB.prepare("DELETE FROM totp_login_challenges WHERE user_id = ?1").bind(user.id),
    env.DB.prepare("DELETE FROM totp_recovery_codes WHERE user_id = ?1").bind(user.id),
    env.DB.prepare("DELETE FROM account_login_devices WHERE user_id = ?1").bind(user.id),
    env.DB.prepare("DELETE FROM donate_bridge_events WHERE user_id = ?1").bind(user.id),
    env.DB.prepare("DELETE FROM donate_bridge_devices WHERE user_id = ?1").bind(user.id),
    env.DB.prepare("DELETE FROM donate_bridge_pairing_codes WHERE user_id = ?1").bind(user.id),
    env.DB.prepare("DELETE FROM kick_metric_snapshots WHERE user_id = ?1").bind(user.id),
    env.DB.prepare("DELETE FROM kick_metric_hourly WHERE user_id = ?1").bind(user.id),
  ];
  if (user.kick_user_id) {
    deleteStatements.push(
      env.DB.prepare("DELETE FROM kick_webhook_events WHERE broadcaster_user_id = ?1").bind(String(user.kick_user_id)),
      env.DB.prepare("DELETE FROM kick_refresh_locks WHERE session_id IN (SELECT id FROM kick_sessions WHERE CAST(json_extract(account_json, '$.id') AS TEXT) = ?1)").bind(String(user.kick_user_id)),
      env.DB.prepare("DELETE FROM kick_sessions WHERE CAST(json_extract(account_json, '$.id') AS TEXT) = ?1").bind(String(user.kick_user_id)),
    );
  }
  deleteStatements.push(env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(user.id));
  await env.DB.batch(deleteStatements);
  return withSessionCookies(apiResponse(request, { ok: true, deleted: true }), null, { clear: true });
}

async function sendAccountDeletedEmail(email, env) {
  if (!isPublicEmail(email) || !env.RESEND_API_KEY) return { ok: false, skipped: true };
  const response = await fetchExternal("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "Play Streamers <noreply@pstreamers.com>",
      to: [email],
      subject: "Play Streamers hesabın silindi",
      text: "Play Streamers hesabın talebin üzerine silindi. Bu işlemden sonra hesabına ait veriler ve oturumun kaldırıldı. Bu işlemi sen yapmadıysan bizimle iletişime geç.",
      html: playStreamersEmailHtml({
        eyebrow: "HESAP GÜVENLİĞİ",
        title: "Hesabın silindi",
        bodyHtml: "<p style=\"margin:0\">Hesabın talebin üzerine silindi. Hesabına ait veriler ve açık oturumun kaldırıldı.</p>",
        note: "Bu işlemi sen yapmadıysan bizimle iletişime geç.",
      }),
      attachments: [emailLogoAttachment()],
    }),
  }, { operation: "resend-account-deleted", timeoutMs: 10_000 });
  return { ok: response.ok, status: response.status };
}

async function accountUpdateResponse(request, current, env) {
  const user = await getUserById(current.session.user.id, env);
  return apiResponse(request, { ok: true, user });
}

async function getPrivateUserById(id, env) {
  return env.DB.prepare("SELECT id, username, email, kick_user_id, password_hash, password_salt, password_iterations, username_changed_at, email_changed_at, password_changed_at, two_factor_enabled, totp_secret_ciphertext, totp_last_counter FROM users WHERE id = ?1 LIMIT 1")
    .bind(id).first();
}

function validateUsername(value) {
  const username = String(value || "").trim();
  if (!/^[A-Za-z0-9_.ÇĞİÖŞÜçğıöşü]{3,24}$/u.test(username)) {
    return { ok: false, error: "Kullanıcı adı 3-24 karakter olmalı; Türkçe harfler, rakamlar, alt çizgi ve nokta kullanabilirsin." };
  }
  if (containsBlockedUsernameFragment(username)) {
    return { ok: false, error: "Bu kullanıcı adı topluluk kurallarına uygun değil. Farklı bir kullanıcı adı seç." };
  }
  return { ok: true, value: username };
}

function containsBlockedUsernameFragment(username) {
  const normalized = String(username || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[01345789]/g, character => ({ 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b", 9: "g" })[character])
    .replace(/[^\p{L}]/gu, "");
  return BLOCKED_USERNAME_FRAGMENTS.some(fragment => normalized.includes(fragment));
}

async function requireCurrentPassword(user, password) {
  if (!user.password_hash || !user.password_salt) return "Bu işlem için önce Google hesabındaki şifre kurulumunu tamamlamalısın.";
  const candidate = await hashPassword(String(password || ""), user.password_salt, user.password_iterations);
  return constantTimeEqual(candidate, user.password_hash) ? null : "Mevcut şifren doğru değil.";
}

async function verifyAccountPassword(request, env) {
  requireAccountConfiguration(env);
  await ensureUsersSchema(env);
  const current = await readUserSession(request, env);
  if (!current) return apiResponse(request, { error: "Oturum bulunamadı." }, 401);
  const input = await requestJson(request);
  const user = await getPrivateUserById(current.session.user.id, env);
  if (!user) return apiResponse(request, { error: "Hesap bulunamadı." }, 404);
  const passwordError = await requireCurrentPassword(user, input.password);
  if (passwordError) return apiResponse(request, { error: passwordError }, 401);
  return apiResponse(request, { ok: true });
}

function changeCooldown(changedAt, days, label) {
  if (!changedAt) return null;
  const changed = Date.parse(changedAt);
  if (!Number.isFinite(changed)) return null;
  const available = changed + days * 24 * 60 * 60 * 1000;
  if (Date.now() >= available) return null;
  return { error: `${label} ${new Date(available).toLocaleString("tr-TR")} tarihine kadar değiştirilemez.`, availableAt: new Date(available).toISOString() };
}

async function getUserSessionVersion(id, env) {
  await ensureUsersSchema(env);
  const row = await env.DB.prepare("SELECT session_version FROM users WHERE id = ?1 LIMIT 1").bind(id).first();
  if (!row) return 0;
  return Math.max(1, Number(row.session_version || 1));
}

async function getUserById(id, env) {
  await ensureUsersSchema(env);
  const user = await env.DB
    .prepare("SELECT id, google_sub, kick_user_id, sw_identity_user_id, email, email_linked, username, password_hash, display_name, avatar_url, username_changed_at, email_changed_at, password_changed_at, two_factor_enabled FROM users WHERE id = ?1 LIMIT 1")
    .bind(id)
    .first();
  if (!user) return null;
  return {
    id: user.id,
    email: Number(user.email_linked) === 1 ? user.email : null,
    name: user.username || user.display_name || user.email,
    username: user.username || null,
    picture: user.avatar_url || null,
    emailLinked: Number(user.email_linked) === 1,
    googleConnected: Boolean(user.google_sub),
    kickConnected: Boolean(user.kick_user_id),
    swIdentityConnected: Boolean(user.sw_identity_user_id),
    usernameChangeAvailableAt: cooldownAvailableAt(user.username_changed_at, 60),
    emailChangeAvailableAt: cooldownAvailableAt(user.email_changed_at, 90),
    passwordChangeAvailableAt: cooldownAvailableAt(user.password_changed_at, 90),
    twoFactorEnabled: Number(user.two_factor_enabled) === 1,
    twoFactorType: Number(user.two_factor_enabled) === 1 ? "totp" : null,
    needsCredentialSetup: Boolean((user.google_sub || user.kick_user_id) && !user.password_hash),
  };
}

function cooldownAvailableAt(changedAt, days) {
  if (!changedAt) return null;
  const changed = Date.parse(changedAt);
  if (!Number.isFinite(changed)) return null;
  const available = changed + days * 24 * 60 * 60 * 1000;
  return Date.now() < available ? new Date(available).toISOString() : null;
}

function validateCredentials(input, { requireBirthDate, requireEmail = false }) {
  const username = String(input.username || "").trim();
  const password = String(input.password || "");
  const passwordRepeat = String(input.passwordRepeat || "");
  if (!/^[A-Za-z0-9_.ÇĞİÖŞÜçğıöşü]{3,24}$/u.test(username)) {
    return { ok: false, error: "Kullanıcı adı 3-24 karakter olmalı; Türkçe harfler, harfler, rakamlar, alt çizgi ve nokta kullanabilirsin." };
  }
  if (containsBlockedUsernameFragment(username)) {
    return { ok: false, error: "Bu kullanıcı adı topluluk kurallarına uygun değil. Farklı bir kullanıcı adı seç." };
  }
  if (password.length < 8 || password.length > 128) {
    return { ok: false, error: "Şifre 8 ile 128 karakter arasında olmalıdır." };
  }
  if (password !== passwordRepeat) return { ok: false, error: "Şifreler birbiriyle aynı değil." };
  const birthDate = String(input.birthDate || "");
  if (requireBirthDate && !isAtLeast18(birthDate)) {
    return { ok: false, error: "Play Streamers'a kayıt olmak için en az 18 yaşında olmalısın." };
  }
  const email = String(input.email || "").trim().toLowerCase();
  if (requireEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Geçerli bir e-posta adresi girmen gerekiyor." };
  }
  return { ok: true, username, password, birthDate, email };
}

function isAtLeast18(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const birth = new Date(Date.UTC(year, month - 1, day));
  if (birth.getUTCFullYear() !== year || birth.getUTCMonth() !== month - 1 || birth.getUTCDate() !== day) return false;
  const today = new Date();
  const eighteenthBirthday = new Date(Date.UTC(year + 18, month - 1, day));
  return eighteenthBirthday <= Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
}

async function verifyGoogleIdToken(idToken, env, expectedNonce) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid Google ID token");

  const header = parseBase64UrlJson(parts[0]);
  const claims = parseBase64UrlJson(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unexpected Google token algorithm");

  let keysBody = await getGoogleJwks();
  let jwk = keysBody?.keys?.find((key) => key.kid === header.kid);
  // Google rotates signing keys. A forced one-time refresh keeps a valid
  // freshly-issued token from failing because the edge cache is stale.
  if (!jwk) {
    keysBody = await getGoogleJwks(true);
    jwk = keysBody?.keys?.find((key) => key.kid === header.kid);
  }
  if (!jwk) throw new Error("Google signing key was not found");

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    publicKey,
    base64UrlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) throw new Error("Google token signature check failed");

  const allowedIssuers = ["https://accounts.google.com", "accounts.google.com"];
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const emailVerified = claims.email_verified === true || claims.email_verified === "true";
  if (
    !allowedIssuers.includes(claims.iss) ||
    !audiences.includes(env.GOOGLE_CLIENT_ID) ||
    Number(claims.exp) <= Math.floor(Date.now() / 1000) ||
    claims.nonce !== expectedNonce ||
    !emailVerified ||
    typeof claims.sub !== "string" ||
    typeof claims.email !== "string"
  ) {
    throw new Error("Google token claims check failed");
  }

  return {
    sub: claims.sub,
    email: claims.email,
    name: typeof claims.name === "string" && claims.name.trim() ? claims.name : claims.email.split("@")[0],
    picture: typeof claims.picture === "string" ? claims.picture : null,
  };
}

async function getGoogleJwks(forceRefresh = false) {
  const cacheKey = new Request(`${API_ORIGIN}/_internal/google-jwks`);
  if (!forceRefresh) {
    try {
      const cached = await caches.default.match(cacheKey);
      const cachedBody = cached ? await safeJson(cached) : null;
      if (Array.isArray(cachedBody?.keys)) return cachedBody;
    } catch {
      // Cache is an optimisation only. Continue safely without it.
    }
  }

  const response = await fetchExternal(GOOGLE_JWKS, {
    headers: { Accept: "application/json" },
  }, { operation: "google-jwks", retries: EXTERNAL_GET_RETRIES });
  const body = await safeJson(response);
  if (!response.ok || !Array.isArray(body?.keys)) {
    throw new Error("Google signing keys were unavailable");
  }

  try {
    await caches.default.put(cacheKey, new Response(JSON.stringify(body), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": `public, max-age=${GOOGLE_JWKS_CACHE_TTL_SECONDS}`,
      },
    }));
  } catch {
    logSecurityEvent("google_jwks_cache_write_skipped");
  }
  return body;
}

async function refreshKickToken(session, env) {
  const response = await fetchExternal(`${KICK_OAUTH}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.KICK_CLIENT_ID,
      client_secret: env.KICK_CLIENT_SECRET,
      refresh_token: session.refreshToken,
    }),
  }, { operation: "kick-token-refresh", timeoutMs: 10_000 });
  const token = await safeJson(response);

  if (!response.ok || !token?.access_token || !token?.refresh_token) {
    throw new Error("Kick token refresh failed");
  }

  return {
    ...session,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + Math.max(Number(token.expires_in) || 0, 60) * 1000,
    scopes: String(token.scope || session.scopes?.join(" ") || "").split(" ").filter(Boolean),
  };
}

async function getKickAccount(accessToken) {
  try {
    const response = await fetchExternal(`${KICK_API}/public/v1/users`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }, { operation: "kick-account", retries: EXTERNAL_GET_RETRIES });
    if (!response.ok) return null;

    const body = await safeJson(response);
    const user = Array.isArray(body?.data) ? body.data[0] : body?.data || body;
    if (!user || typeof user !== "object") return null;

    return {
      id: user.user_id || user.id || null,
      username: user.username || user.slug || user.name || null,
      profilePicture: user.profile_picture || null,
      profileCheckedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function getKickStreamStatus(session) {
  const broadcasterId = session.account?.id;
  if (!broadcasterId) {
    return { live: false, title: null };
  }

  const livestreamsUrl = new URL(`${KICK_API}/public/v1/livestreams`);
  livestreamsUrl.searchParams.append("broadcaster_user_id", String(broadcasterId));
  const response = await fetchExternal(livestreamsUrl, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  }, { operation: "kick-stream-status", retries: EXTERNAL_GET_RETRIES });
  const body = await safeJson(response);
  if (!response.ok) throw new Error("Kick livestream lookup failed");

  const streams = Array.isArray(body?.data) ? body.data : [];
  const stream = streams[0];
  return {
    live: Boolean(stream),
    title: stream?.session_title || stream?.title || null,
    viewer_count: boundedInsightMetric(stream?.viewer_count ?? stream?.viewerCount ?? stream?.viewers),
    startedAt: (() => {
      const parsed = Date.parse(String(stream?.started_at ?? stream?.startedAt ?? stream?.created_at ?? ""));
      return Number.isFinite(parsed) ? parsed : null;
    })(),
  };
}

async function getKickFollowerCount(session) {
  const broadcasterId = String(session?.account?.id || '');
  const slug = String(session?.account?.username || '').trim().toLowerCase();
  if (!broadcasterId && !slug) return null;
  const cacheKey = broadcasterId || slug;
  const cached = kickFollowerCountCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const candidates = [];
  if (slug && /^[a-z0-9_.-]{1,80}$/.test(slug)) {
    /* Kick'in resmi Public API kanal yanıtı toplam takipçi sayısını şu an
       sunmuyor. Önce Kick web kanalının güncel, salt-okunur özetini; ardından
       eski kanal özetini deneriz. Kullanıcı parolası veya tarayıcı oturumu
       kullanılmaz. */
    candidates.push({ url: `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, headers: { Accept: 'application/json' } });
    candidates.push({ url: `https://kick.com/api/v1/channels/${encodeURIComponent(slug)}`, headers: { Accept: 'application/json' } });
  }
  if (broadcasterId && /^\d+$/.test(broadcasterId)) {
    const officialChannelsUrl = new URL(`${KICK_API}/public/v1/channels`);
    officialChannelsUrl.searchParams.set('broadcaster_user_id', broadcasterId);
    candidates.push({ url: officialChannelsUrl.toString(), headers: { Accept: 'application/json', ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}) } });
  }

  let value = null;
  for (const candidate of candidates) {
    try {
      const response = await fetchExternal(candidate.url, { headers: candidate.headers }, { operation: 'kick-follower-count', retries: EXTERNAL_GET_RETRIES });
      if (!response.ok) continue;
      const body = await safeJson(response);
      const first = Array.isArray(body?.data) ? body.data[0] : body?.data;
      const raw = body?.followersCount ?? body?.followers_count ?? body?.followerCount ?? body?.follower_count ?? body?.followers
        ?? first?.followersCount ?? first?.followers_count ?? first?.followerCount ?? first?.follower_count ?? first?.followers
        ?? body?.count ?? first?.count;
      const count = Number(raw);
      if (raw !== null && raw !== undefined && Number.isFinite(count) && count >= 0) { value = Math.floor(count); break; }
    } catch {
      /* Kick'in takipçi özeti herkese açık uçta geçici olarak kapalı olabilir. */
    }
  }
  if (kickFollowerCountCache.size > 100) kickFollowerCountCache.clear();
  /* Başarısız sorguyu uzun süre kilitleme; Kick geçici hata verdiyse sonraki
     canlı kontrolde hızla yeniden denensin. */
  kickFollowerCountCache.set(cacheKey, { value, expiresAt: Date.now() + (value === null ? 10_000 : 60_000) });
  return value;
}

async function getKickSubscriberCount(session) {
  const broadcasterId = String(session?.account?.id || '');
  const slug = String(session?.account?.username || '').trim().toLowerCase();
  if (!broadcasterId && !slug) return null;
  const cacheKey = broadcasterId || slug;
  const cached = kickSubscriberCountCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const candidates = [];
  if (slug && /^[a-z0-9_.-]{1,80}$/.test(slug)) {
    candidates.push(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`);
    candidates.push(`https://kick.com/api/v1/channels/${encodeURIComponent(slug)}`);
  }
  let value = null;
  for (const url of candidates) {
    try {
      const response = await fetchExternal(url, { headers: { Accept: 'application/json' } }, { operation: 'kick-subscriber-count', retries: EXTERNAL_GET_RETRIES });
      if (!response.ok) continue;
      const body = await safeJson(response);
      const data = Array.isArray(body?.data) ? body.data[0] : body?.data;
      const raw = body?.active_subscribers_count ?? body?.activeSubscribersCount ?? body?.subscribers_count
        ?? body?.subscriber_count ?? body?.subscribersCount ?? body?.subscription_count
        ?? data?.active_subscribers_count ?? data?.activeSubscribersCount ?? data?.subscribers_count
        ?? data?.subscriber_count ?? data?.subscribersCount ?? data?.subscription_count;
      const count = Number(raw);
      if (raw !== null && raw !== undefined && raw !== '' && Number.isFinite(count) && count >= 0) {
        value = Math.floor(count);
        break;
      }
    } catch {
      /* Kick'in web kanal ozeti gecici olarak erisilemez olabilir. */
    }
  }
  if (kickSubscriberCountCache.size > 100) kickSubscriberCountCache.clear();
  kickSubscriberCountCache.set(cacheKey, { value, expiresAt: Date.now() + (value === null ? 10_000 : 60_000) });
  return value;
}

async function getKickChannelInsights(session, env, { hourlyDate = "" } = {}) {
  const broadcasterId = session?.account?.id;
  if (!session?.accessToken || !broadcasterId) return null;
  const headers = { Authorization: `Bearer ${session.accessToken}`, Accept: "application/json" };
  const channelsUrl = new URL(`${KICK_API}/public/v1/channels`);
  channelsUrl.searchParams.append("broadcaster_user_id", String(broadcasterId));
  const kicksUrl = new URL(`${KICK_API}/public/v1/kicks/leaderboard`);
  kicksUrl.searchParams.set("top", "10");
  const [channelsResponse, kicksResponse, activeFollowers] = await Promise.all([
    fetchExternal(channelsUrl, { headers }, { operation: "kick-channel-insights", retries: EXTERNAL_GET_RETRIES }).catch(() => null),
    fetchExternal(kicksUrl, { headers }, { operation: "kick-kicks-leaderboard", retries: EXTERNAL_GET_RETRIES }).catch(() => null),
    getKickFollowerCount(session).catch(() => null),
  ]);
  const channelsBody = channelsResponse?.ok ? await safeJson(channelsResponse) : null;
  const kicksBody = kicksResponse?.ok ? await safeJson(kicksResponse) : null;
  const channel = Array.isArray(channelsBody?.data) ? channelsBody.data[0] : null;
  const channelFollowerRaw = channel?.followers_count ?? channel?.follower_count ?? channel?.followersCount ?? channel?.followerCount ?? channel?.followers;
  const channelFollowerCount = Number(channelFollowerRaw);
  const channelSubscriberRaw = channel?.active_subscribers_count ?? channel?.subscribers_count ?? channel?.subscriber_count;
  // Resmi yanit degeri verdiyse eski web kanal ucunu hic bekleme. Bu hem
  // Hesabim acilisini hizlandirir hem de gecici web ucu hatalarini etkisiz kilar.
  const activeSubscribers = channelSubscriberRaw === null || channelSubscriberRaw === undefined
    ? await getKickSubscriberCount(session).catch(() => null)
    : null;
  // Kick'in resmi channel yaniti aktif abone sayisini dogrudan veriyorsa onu
  // her zaman oncele. Eski web ucu yalnizca geriye donuk uyumluluk yedegidir;
  // gecici olarak 0 dondurmesi resmi degeri ezmemelidir.
  const officialSubscriberRaw = channelSubscriberRaw ?? activeSubscribers;
  const officialSubscriberCount = Number(officialSubscriberRaw);
  const directFollowerCount = activeFollowers ?? (channelFollowerRaw !== null && channelFollowerRaw !== undefined && Number.isFinite(channelFollowerCount)
    ? Math.max(0, Math.floor(channelFollowerCount))
    : null);
  let storedFollowerCount = null;
  let storedSubscriberCount = null;
  let dailyMetrics = [];
  let hourlyMetrics = [];
  let followedThisMonth = 0;
  let webhookSubscriberCount = 0;
  if (env?.DB && session.userId) {
    await ensureKickMetricsSchemaInD1(env);
    const monthPrefix = kickMetricDateKey().slice(0, 7);
    const historyStartDate = kickMetricDateKey(Date.now() - 92 * 24 * 60 * 60 * 1000);
    const [latestFollowers, latestSubscribers, monthFollowersRow, dailyFollowerRows, subscriptionRows] = await Promise.all([
      env.DB.prepare(`SELECT followers_count FROM kick_metric_snapshots
        WHERE user_id = ?1 AND followers_count IS NOT NULL ORDER BY metric_date DESC, observed_at DESC LIMIT 1`)
        .bind(String(session.userId)).first(),
      env.DB.prepare(`SELECT subscribers_count FROM kick_metric_snapshots
        WHERE user_id = ?1 AND subscribers_count IS NOT NULL ORDER BY metric_date DESC, observed_at DESC LIMIT 1`)
        .bind(String(session.userId)).first(),
      env.DB.prepare(`SELECT COUNT(*) AS total FROM kick_webhook_events
        WHERE broadcaster_user_id = ?1 AND event_type = 'channel.followed'
          AND substr(COALESCE(event_at, received_at), 1, 7) = ?2`)
        .bind(String(broadcasterId), monthPrefix).first(),
      env.DB.prepare(`SELECT substr(COALESCE(event_at, received_at), 1, 10) AS event_date, COUNT(*) AS total
        FROM kick_webhook_events
        WHERE broadcaster_user_id = ?1 AND event_type = 'channel.followed'
          AND substr(COALESCE(event_at, received_at), 1, 10) >= ?2
        GROUP BY event_date ORDER BY event_date ASC`)
        .bind(String(broadcasterId), historyStartDate).all(),
      env.DB.prepare(`SELECT event_type, payload_json, event_at, received_at
        FROM kick_webhook_events
        WHERE broadcaster_user_id = ?1 AND event_type IN ('channel.subscription.new','channel.subscription.renewal','channel.subscription.gifts')
        ORDER BY COALESCE(event_at, received_at) DESC LIMIT 5000`)
        .bind(String(broadcasterId)).all(),
    ]);
    followedThisMonth = Math.max(0, Number(monthFollowersRow?.total || 0));
    const activeSubscriptionKeys = new Map();
    const subscriptionFallbackCutoff = Date.now() - 35 * 24 * 60 * 60 * 1000;
    for (const row of subscriptionRows?.results || []) {
      let payload = {};
      try { payload = JSON.parse(String(row.payload_json || "{}")); } catch { payload = {}; }
      const occurredAt = Date.parse(String(row.event_at || row.received_at || ""));
      const addSubscriber = (subscriber, index = 0) => {
        const key = String(subscriber?.user_id || subscriber?.id || subscriber?.username || subscriber?.user_name || `${row.event_type}:${row.event_at || row.received_at}:${index}`);
        if (!key) return;
        const expiresAt = Date.parse(String(subscriber?.expires_at || payload?.expires_at || ""));
        const active = Number.isFinite(expiresAt) ? expiresAt >= Date.now() : (Number.isFinite(occurredAt) && occurredAt >= subscriptionFallbackCutoff);
        if (active && !activeSubscriptionKeys.has(key)) activeSubscriptionKeys.set(key, occurredAt || Date.now());
      };
      if (row.event_type === 'channel.subscription.gifts') {
        const recipients = payload?.giftees || payload?.recipients || payload?.subscriptions || payload?.gifted_subscriptions || [];
        if (Array.isArray(recipients)) recipients.forEach(addSubscriber);
      } else {
        addSubscriber(payload?.subscriber || payload?.user || payload);
      }
    }
    webhookSubscriberCount = activeSubscriptionKeys.size;
    if (latestFollowers?.followers_count !== null && latestFollowers?.followers_count !== undefined && Number.isFinite(Number(latestFollowers.followers_count))) {
      storedFollowerCount = Math.max(0, Number(latestFollowers.followers_count));
    }
    if (latestSubscribers?.subscribers_count !== null && latestSubscribers?.subscribers_count !== undefined && Number.isFinite(Number(latestSubscribers.subscribers_count))) {
      storedSubscriberCount = Math.max(0, Number(latestSubscribers.subscribers_count));
    }
    await storeKickMetricSnapshot(env, {
      userId: session.userId,
      broadcasterId,
      slug: session?.account?.username || "",
      followersCount: directFollowerCount,
      subscribersCount: officialSubscriberRaw !== null && officialSubscriberRaw !== undefined && Number.isFinite(officialSubscriberCount)
        ? officialSubscriberCount
        : Math.max(webhookSubscriberCount, Number(storedSubscriberCount || 0)),
      monthFollowersCount: followedThisMonth,
      source: directFollowerCount !== null ? "kick-api" : "kick-api+play-connect",
      observedAt: Date.now(),
    });
    const history = await env.DB.prepare(`SELECT metric_date,
        MAX(followers_count) AS followers_count,
        MAX(subscribers_count) AS subscribers_count,
        MAX(month_followers_count) AS month_followers_count,
        MAX(source) AS source,
        MAX(observed_at) AS observed_at
      FROM kick_metric_hourly WHERE user_id = ?1 AND metric_date >= ?2
      GROUP BY metric_date ORDER BY metric_date ASC`)
      .bind(String(session.userId), historyStartDate).all();
    dailyMetrics = (history?.results || []).map(row => ({
      date: String(row.metric_date),
      followersCount: row.followers_count === null ? null : Math.max(0, Number(row.followers_count)),
      subscribersCount: row.subscribers_count === null ? null : Math.max(0, Number(row.subscribers_count)),
      monthFollowersCount: Math.max(0, Number(row.month_followers_count || 0)),
      source: String(row.source || "kick-api"),
      observedAt: Number(row.observed_at || 0),
    }));
    if (!dailyMetrics.length) {
      const legacyHistory = await env.DB.prepare(`SELECT metric_date, followers_count, subscribers_count, source, observed_at
        FROM kick_metric_snapshots WHERE user_id = ?1 AND metric_date >= ?2 ORDER BY metric_date ASC`)
        .bind(String(session.userId), historyStartDate).all();
      dailyMetrics = (legacyHistory?.results || []).map(row => ({
        date: String(row.metric_date),
        followersCount: row.followers_count === null ? null : Math.max(0, Number(row.followers_count)),
        subscribersCount: row.subscribers_count === null ? null : Math.max(0, Number(row.subscribers_count)),
        monthFollowersCount: 0,
        source: String(row.source || "kick-api"),
        observedAt: Number(row.observed_at || 0),
      }));
    }
    const dailyFollowerCounts = new Map((dailyFollowerRows?.results || []).map(row => [String(row.event_date || ''), Math.max(0, Number(row.total || 0))]));
    const dailyMetricMap = new Map(dailyMetrics.map(row => [row.date, row]));
    for (const [date, count] of dailyFollowerCounts) {
      const existing = dailyMetricMap.get(date);
      if (existing) existing.monthFollowersCount = count;
      else dailyMetricMap.set(date, { date, followersCount: null, subscribersCount: null, monthFollowersCount: count, source: 'kick-webhook', observedAt: 0 });
    }
    dailyMetrics = [...dailyMetricMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    if (/^\d{4}-\d{2}-\d{2}$/.test(hourlyDate)) {
      const [hourly, hourlyFollowerRows] = await Promise.all([
        env.DB.prepare(`SELECT metric_hour, followers_count, subscribers_count,
            month_followers_count, source, observed_at
          FROM kick_metric_hourly WHERE user_id = ?1 AND metric_date = ?2
          ORDER BY metric_hour ASC`)
          .bind(String(session.userId), hourlyDate).all(),
        env.DB.prepare(`SELECT substr(COALESCE(event_at, received_at), 12, 2) AS event_hour, COUNT(*) AS total
          FROM kick_webhook_events
          WHERE broadcaster_user_id = ?1 AND event_type = 'channel.followed'
            AND substr(COALESCE(event_at, received_at), 1, 10) = ?2
          GROUP BY event_hour ORDER BY event_hour ASC`)
          .bind(String(broadcasterId), hourlyDate).all(),
      ]);
      hourlyMetrics = (hourly?.results || []).map(row => ({
        hour: String(row.metric_hour || "").slice(-2),
        followersCount: row.followers_count === null ? null : Math.max(0, Number(row.followers_count)),
        subscribersCount: row.subscribers_count === null ? null : Math.max(0, Number(row.subscribers_count)),
        monthFollowersCount: Math.max(0, Number(row.month_followers_count || 0)),
        source: String(row.source || "kick-api"),
        observedAt: Number(row.observed_at || 0),
      }));
      const hourlyFollowerCounts = new Map((hourlyFollowerRows?.results || []).map(row => [String(row.event_hour || '').padStart(2, '0'), Math.max(0, Number(row.total || 0))]));
      const hourlyMetricMap = new Map(hourlyMetrics.map(row => [String(row.hour).padStart(2, '0'), row]));
      for (const [hour, count] of hourlyFollowerCounts) {
        const existing = hourlyMetricMap.get(hour);
        if (existing) existing.monthFollowersCount = count;
        else hourlyMetricMap.set(hour, { hour, followersCount: null, subscribersCount: null, monthFollowersCount: count, source: 'kick-webhook', observedAt: 0 });
      }
      hourlyMetrics = [...hourlyMetricMap.values()].sort((a, b) => a.hour.localeCompare(b.hour));
    }
  }
  const leaderboard = kicksBody?.data && typeof kicksBody.data === "object" ? kicksBody.data : {};
  const normalizeKicks = (items) => (Array.isArray(items) ? items : []).slice(0, 10).map((item) => ({
    userId: item?.user_id === null || item?.user_id === undefined ? null : String(item.user_id),
    username: String(item?.username || "Anonim izleyici").slice(0, 80),
    amount: Math.max(0, Number(item?.gifted_amount || 0)),
    rank: Math.max(1, Number(item?.rank || 1)),
  }));
  return {
    activeFollowers: directFollowerCount ?? storedFollowerCount,
    activeSubscribers: officialSubscriberRaw !== null && officialSubscriberRaw !== undefined && Number.isFinite(officialSubscriberCount)
      ? Math.max(0, officialSubscriberCount)
      : Math.max(webhookSubscriberCount, Number(storedSubscriberCount || 0)),
    canceledSubscribers: Number.isFinite(Number(channel?.canceled_subscribers_count)) ? Math.max(0, Number(channel.canceled_subscribers_count)) : null,
    topKicks: {
      month: normalizeKicks(leaderboard.month),
      lifetime: normalizeKicks(leaderboard.lifetime),
    },
    followedThisMonth,
    dailyMetrics,
    hourlyMetrics,
    checkedAt: new Date().toISOString(),
  };
}

async function ensureKickEventSubscriptions(session, env) {
  const broadcasterId = session?.account?.id;
  if (!session?.accessToken || !broadcasterId) {
    return { ok: false, reason: "missing-kick-session" };
  }

  try {
    const headers = {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/json",
    };
    let existing = [];
    const listUrl = new URL(KICK_EVENT_SUBSCRIPTIONS_URL);
    listUrl.searchParams.set("broadcaster_user_id", String(broadcasterId));
    const listResponse = await fetchExternal(listUrl, { headers }, {
      operation: "kick-event-subscriptions-list",
      retries: EXTERNAL_GET_RETRIES,
    });
    if (listResponse.ok) {
      const listBody = await safeJson(listResponse);
      existing = Array.isArray(listBody?.data) ? listBody.data : [];
    }

    const active = new Set(existing.map((item) => {
      const name = item?.name || item?.event || item?.event_name || "";
      return `${name}:${Number(item?.version || 1)}`;
    }));
    const missingEvents = KICK_EVENT_TYPES.filter((event) => !active.has(`${event.name}:${event.version}`));
    if (!missingEvents.length) return { ok: true, alreadySubscribed: true };

    const response = await fetchExternal(KICK_EVENT_SUBSCRIPTIONS_URL, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ method: "webhook", events: missingEvents }),
    }, { operation: "kick-event-subscriptions-create", timeoutMs: 10_000 });
    const body = await safeJson(response);
    if (!response.ok) {
      logSecurityEvent("kick_event_subscription_rejected", { status: response.status });
      return { ok: false, status: response.status };
    }
    return { ok: true, created: missingEvents.length };
  } catch (error) {
    // A temporary Kick API error must never prevent a user from signing in.
    logSecurityEvent("kick_event_subscription_unavailable", { reason: error?.code || error?.name || "unknown" });
    return { ok: false, reason: "kick-api-unavailable" };
  }
}

async function receiveKickWebhook(request, env) {
  requireKickConfiguration(env);
  requireAccountConfiguration(env);

  let rawBody;
  try {
    rawBody = await readKickWebhookBody(request);
  } catch (error) {
    if (error?.code === "WEBHOOK_BODY_TOO_LARGE") {
      return apiResponse(request, { error: "Webhook verisi çok büyük." }, 413);
    }
    throw error;
  }

  const verification = await verifyKickWebhookSignature(request, rawBody);
  if (!verification.ok) {
    return apiResponse(request, { error: "Geçersiz Kick webhook isteği." }, 401);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return apiResponse(request, { error: "Kick webhook verisi okunamadı." }, 400);
  }

  // Only store the event types this product uses. A signed but unsupported
  // message still receives 2xx so Kick does not retry it continuously.
  const supported = KICK_EVENT_TYPES.some((event) => event.name === verification.eventType && event.version === verification.eventVersion);
  if (!supported) {
    return apiResponse(request, { ok: true, ignored: true }, 202);
  }

  const broadcasterId = String(payload?.broadcaster?.user_id || "");
  if (!broadcasterId) {
    return apiResponse(request, { error: "Kick webhook yayıncı bilgisi eksik." }, 400);
  }

  await ensureUsersSchema(env);
  const receivedAt = new Date().toISOString();
  const eventAt = payload?.created_at || payload?.started_at || payload?.ended_at || null;
  const write = await env.DB.prepare(`INSERT OR IGNORE INTO kick_webhook_events (
      message_id, broadcaster_user_id, event_type, event_version, payload_json, event_at, received_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
    .bind(
      verification.messageId,
      broadcasterId,
      verification.eventType,
      verification.eventVersion,
      JSON.stringify(payload),
      eventAt ? String(eventAt) : null,
      receivedAt,
    )
    .run();

  if (Number(write?.meta?.changes || 0) > 0 && verification.eventType === "livestream.status.updated") {
    const eventTime = Date.parse(String(eventAt || receivedAt));
    await applyKickLivestreamEvent(env, broadcasterId, payload, Number.isFinite(eventTime) ? eventTime : Date.now()).catch((error) => {
      logSecurityEvent("automatic_stream_webhook_failed", { reason: error?.code || error?.name || "unknown" });
    });
  }

  return apiResponse(request, {
    ok: true,
    duplicate: Number(write?.meta?.changes || 0) === 0,
  }, 202);
}

async function listKickEvents(request, env) {
  let current = await readSession(request, env);
  if (!current?.session?.account?.id) {
    const userSession = await readUserSession(request, env);
    if (userSession?.session?.user?.id) {
      const row = await env.DB.prepare(`SELECT id FROM kick_sessions
        WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1`)
        .bind(String(userSession.session.user.id)).first();
      if (row?.id) {
        const linked = await getKickSession(String(row.id), env);
        if (linked) current = { sessionId: String(row.id), session: linked };
      }
    }
  }
  if (!current?.session?.account?.id) {
    return apiResponse(request, { connected: false, events: [] }, 401);
  }

  await ensureUsersSchema(env);
  const broadcasterId = String(current.session.account.id);
  const requestUrl = new URL(request.url);
  const historyRequested = requestUrl.searchParams.get("history") === "1";
  const insightsRequested = requestUrl.searchParams.get("insights") === "1";
  const hourlyDate = String(requestUrl.searchParams.get("date") || "");
  const eventLimit = historyRequested ? 5000 : 250;
  const [result, stream, insights] = await Promise.all([
    env.DB.prepare(`SELECT
        message_id, event_type, event_version, payload_json, event_at, received_at
      FROM kick_webhook_events
      WHERE broadcaster_user_id = ?1
      ORDER BY received_at DESC
      LIMIT ?2`)
      .bind(broadcasterId, eventLimit)
      .all(),
    getKickStreamStatus(current.session).catch(() => null),
    insightsRequested ? getKickChannelInsights(current.session, env, { hourlyDate }).catch(() => null) : Promise.resolve(null),
  ]);

  const events = (result?.results || []).map((row) => {
    let payload = null;
    try { payload = JSON.parse(row.payload_json); } catch { payload = null; }
    return {
      id: row.message_id,
      type: row.event_type,
      version: Number(row.event_version || 1),
      occurredAt: row.event_at || row.received_at,
      receivedAt: row.received_at,
      payload,
    };
  });
  return apiResponse(request, {
    connected: true,
    broadcasterId,
    events,
    live: Boolean(stream?.live),
    insights,
  });
}

async function readKickWebhookBody(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(length) && length > MAX_KICK_WEBHOOK_BODY_BYTES) {
    const error = new Error("Kick webhook body too large");
    error.code = "WEBHOOK_BODY_TOO_LARGE";
    throw error;
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_KICK_WEBHOOK_BODY_BYTES) {
    const error = new Error("Kick webhook body too large");
    error.code = "WEBHOOK_BODY_TOO_LARGE";
    throw error;
  }
  return rawBody;
}

async function verifyKickWebhookSignature(request, rawBody) {
  const messageId = request.headers.get("Kick-Event-Message-Id") || "";
  const timestamp = request.headers.get("Kick-Event-Message-Timestamp") || "";
  const signature = request.headers.get("Kick-Event-Signature") || "";
  const eventType = request.headers.get("Kick-Event-Type") || "";
  const eventVersion = Number(request.headers.get("Kick-Event-Version") || 0);
  if (!messageId || !timestamp || !signature || !eventType || !Number.isInteger(eventVersion)) {
    return { ok: false };
  }

  try {
    const publicKey = await getKickWebhookPublicKey();
    const signedMessage = `${messageId}.${timestamp}.${rawBody}`;
    const verified = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      publicKey,
      base64ToBytes(signature),
      new TextEncoder().encode(signedMessage),
    );
    return { ok: verified, messageId, eventType, eventVersion };
  } catch (error) {
    logSecurityEvent("kick_webhook_signature_failed", { reason: error?.code || error?.name || "unknown" });
    return { ok: false };
  }
}

async function getKickWebhookPublicKey() {
  if (!kickWebhookPublicKeyPromise) {
    kickWebhookPublicKeyPromise = (async () => {
      const response = await fetchExternal(`${KICK_API}/public/v1/public-key`, {
        headers: { Accept: "application/json" },
      }, { operation: "kick-webhook-public-key", retries: EXTERNAL_GET_RETRIES });
      const body = await safeJson(response);
      const pem = body?.data?.public_key || body?.public_key || body?.data?.key || body?.key;
      if (!response.ok || typeof pem !== "string" || !pem.includes("BEGIN PUBLIC KEY")) {
        throw new Error("Kick public key was unavailable");
      }
      return crypto.subtle.importKey(
        "spki",
        pemToBytes(pem),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
    })().catch((error) => {
      kickWebhookPublicKeyPromise = null;
      throw error;
    });
  }
  return kickWebhookPublicKeyPromise;
}

function pemToBytes(pem) {
  const base64 = String(pem)
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
  return base64ToBytes(base64).buffer;
}

function base64ToBytes(value) {
  const binary = atob(String(value).replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function requireBaseConfiguration(env) {
  if (!env.DB) {
    throw new Error("Worker is missing a required binding or variable");
  }
}

function requireKickConfiguration(env) {
  requireBaseConfiguration(env);
  if (!env.KICK_CLIENT_ID || !env.KICK_CLIENT_SECRET) {
    throw new Error("Worker is missing the Kick configuration");
  }
}

function requireGoogleConfiguration(env) {
  requireBaseConfiguration(env);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Worker is missing the Google configuration");
  }
}

function requireAccountConfiguration(env) {
  requireBaseConfiguration(env);
}

function requireEmailConfiguration(env) {
  requireAccountConfiguration(env);
  if (!env.RESEND_API_KEY) {
    throw new Error("Worker is missing the Resend configuration");
  }
}

function isTotpConfigured(env) {
  return Boolean(env?.DB && env.TOTP_ENCRYPTION_KEY && String(env.TOTP_ENCRYPTION_KEY).length >= 32);
}

function requireTotpConfiguration(env) {
  requireAccountConfiguration(env);
  if (!isTotpConfigured(env)) {
    throw new Error("Worker is missing the TOTP encryption configuration");
  }
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function maskEmail(value) {
  const email = normalizeEmail(value);
  if (!email) return "";
  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function normalizeMailbox(value) {
  const raw = String(value || "").trim();
  const angleAddress = raw.match(/<([^<>]+)>/);
  return normalizeEmail(angleAddress ? angleAddress[1] : raw);
}

function isPublicEmail(value) {
  return Boolean(normalizeEmail(value)) && !String(value).endsWith("@local.play-streamers.invalid");
}

function getCookie(request, name) {
  const encodedName = `${name}=`;
  for (const item of String(request.headers.get("Cookie") || "").split(";")) {
    const value = item.trim();
    if (value.startsWith(encodedName)) return decodeURIComponent(value.slice(encodedName.length));
  }
  return null;
}

function getBearerToken(request) {
  const value = request.headers.get("Authorization") || "";
  if (value.startsWith("Bearer ")) return value.slice(7).trim();
  return getCookie(request, SESSION_COOKIE_NAME);
}

function requiresCsrfProtection(pathname, request) {
  if (request.method !== "POST") return false;
  // OAuth continuation is a short-lived browser form which is already guarded
  // by Turnstile and its own signed OAuth state. It cannot send our custom
  // X-CSRF header during the full-page form navigation. Leaving it in the
  // generic cookie-CSRF check caused a successful Turnstile challenge to be
  // rejected whenever an older session cookie was present.
  if (
    pathname === "/auth/oauth/continue"
    || pathname === "/api/auth/oauth/start"
    || pathname === "/api/auth/login"
    || pathname === "/api/auth/verify-two-factor"
  ) return false;
  // Bearer-token clients remain supported while the website transitions to
  // HttpOnly session cookies. CSRF only applies to cookie-authenticated calls.
  if (request.headers.get("Authorization")) return false;
  const session = getCookie(request, SESSION_COOKIE_NAME);
  if (!session) return false;
  const csrfCookie = getCookie(request, CSRF_COOKIE_NAME);
  const csrfHeader = request.headers.get("X-CSRF-Token");
  return !csrfCookie || !csrfHeader || !constantTimeEqual(csrfCookie, csrfHeader);
}

function sessionCookie(value, maxAge) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(value || "")}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function csrfCookie(value, maxAge) {
  return `${CSRF_COOKIE_NAME}=${encodeURIComponent(value || "")}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax`;
}

function twoFactorTrustCookie(value, maxAge) {
  return `${TWO_FACTOR_TRUST_COOKIE_NAME}=${encodeURIComponent(value || "")}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function withTwoFactorTrustCookie(response, token, maxAge = TWO_FACTOR_TRUST_TTL_SECONDS) {
  const headers = new Headers(response.headers);
  headers.append("set-cookie", twoFactorTrustCookie(token, maxAge));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function twoFactorTrustTokenHash(token) {
  return sha256Base64Url(`two-factor-trust:${token}`);
}

async function hasTrustedTwoFactorDevice(request, userId, env) {
  const token = getCookie(request, TWO_FACTOR_TRUST_COOKIE_NAME);
  if (!/^[A-Za-z0-9_-]{40,160}$/.test(String(token || ""))) return false;
  const tokenHash = await twoFactorTrustTokenHash(token);
  const row = await env.DB.prepare(`SELECT d.token_hash, d.session_version, d.expires_at, u.session_version AS current_version
    FROM two_factor_trusted_devices d
    JOIN users u ON u.id = d.user_id
    WHERE d.token_hash = ?1 AND d.user_id = ?2 AND d.revoked_at IS NULL
      AND d.expires_at > ?3 LIMIT 1`)
    .bind(tokenHash, String(userId), Date.now()).first();
  if (!row || Number(row.session_version) !== Number(row.current_version)) return false;
  await env.DB.prepare("UPDATE two_factor_trusted_devices SET last_used_at = ?1 WHERE token_hash = ?2")
    .bind(Date.now(), tokenHash).run();
  return true;
}

async function withIssuedTwoFactorTrustCookie(response, userId, env) {
  const sessionVersion = await getUserSessionVersion(userId, env);
  if (!sessionVersion) return response;
  const token = randomBase64Url(48);
  const tokenHash = await twoFactorTrustTokenHash(token);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO two_factor_trusted_devices
      (token_hash, user_id, session_version, expires_at, created_at, last_used_at, revoked_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?5, NULL)`)
      .bind(tokenHash, String(userId), sessionVersion, now + TWO_FACTOR_TRUST_TTL_SECONDS * 1000, now),
    env.DB.prepare(`DELETE FROM two_factor_trusted_devices
      WHERE expires_at <= ?1 OR (user_id = ?2 AND token_hash NOT IN (
        SELECT token_hash FROM two_factor_trusted_devices
        WHERE user_id = ?2 AND revoked_at IS NULL
        ORDER BY created_at DESC LIMIT 8
      ))`).bind(now, String(userId)),
  ]);
  return withTwoFactorTrustCookie(response, token);
}

function withSessionCookies(response, sessionId, { clear = false } = {}) {
  const headers = new Headers(response.headers);
  if (clear || !sessionId) {
    headers.append("set-cookie", sessionCookie("", 0));
    headers.append("set-cookie", csrfCookie("", 0));
  } else {
    headers.append("set-cookie", sessionCookie(sessionId, USER_SESSION_TTL_SECONDS));
    headers.append("set-cookie", csrfCookie(randomBase64Url(24), USER_SESSION_TTL_SECONDS));
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function authenticatedApiResponse(request, data, status, sessionId) {
  return withSessionCookies(apiResponse(request, data, status), sessionId);
}

function redirectWithUserSession(url, sessionId) {
  return withSessionCookies(Response.redirect(url, 302), sessionId);
}

// Worker tarafından sunulan küçük doğrulama ve bilgi sayfaları için ortak,
// tarayıcı tarafında etkisiz ama güvenliği güçlendiren başlıklar.
function workerPageHeaders(contentType = "text/html; charset=utf-8") {
  return {
    "content-type": contentType,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    "cross-origin-opener-policy": "same-origin",
  };
}

function isChromeDonateConnectorRequest(request, origin) {
  if (!/^chrome-extension:\/\/[a-p]{32}$/.test(String(origin || ""))) return false;
  const path = new URL(request.url).pathname;
  if (![
    "/api/donate-bridge/pair/claim",
    "/api/donate-bridge/events",
    "/api/donate-bridge/device/status",
    "/api/donate-bridge/kick-metrics",
    "/api/donate-bridge/device/disconnect",
    "/api/donate-bridge/support",
  ].includes(path)) return false;
  const method = request.method === "OPTIONS"
    ? String(request.headers.get("Access-Control-Request-Method") || "").toUpperCase()
    : request.method;
  return method === "POST";
}

function isExtensionTranslationRequest(request, origin) {
  if (new URL(request.url).pathname !== "/api/i18n/translate") return false;
  if (!/^(?:chrome|moz)-extension:\/\/[A-Za-z0-9-]{16,128}$/.test(String(origin || ""))) return false;
  const method = request.method === "OPTIONS"
    ? String(request.headers.get("Access-Control-Request-Method") || "").toUpperCase()
    : request.method;
  return method === "POST";
}

function apiResponse(request, data, status = 200) {
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-site",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  });
  const origin = request.headers.get("Origin");
  const donateConnectorOrigin = isChromeDonateConnectorRequest(request, origin);
  const extensionTranslationOrigin = isExtensionTranslationRequest(request, origin);
  const desktopOrigin = ALLOWED_DESKTOP_ORIGINS.has(origin);
  if (origin && (ALLOWED_FRONTEND_ORIGINS.has(origin) || ALLOWED_DESKTOP_ORIGINS.has(origin) || donateConnectorOrigin || extensionTranslationOrigin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    headers.set("access-control-allow-headers", "Authorization, Content-Type, If-None-Match, X-Turnstile-Token, X-CSRF-Token, X-Play-Streamers-Bridge");
    if (!donateConnectorOrigin && !extensionTranslationOrigin) headers.set("access-control-allow-credentials", "true");
    if (donateConnectorOrigin || extensionTranslationOrigin || desktopOrigin) headers.set("cross-origin-resource-policy", "cross-origin");
    headers.set("vary", "Origin");
  }
  return new Response(status === 204 ? null : JSON.stringify(data), { status, headers });
}

function htmlPage(title, message, success) {
  const stateColor = success ? "#f5f5f2" : "#ffb4bb";
  return new Response(`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Play Streamers</title><body style="margin:0;display:grid;min-height:100vh;place-items:center;padding:20px;background:radial-gradient(circle at 80% 0,#202020,transparent 38%),#050505;color:#f5f5f2;font-family:'Segoe UI',Arial,sans-serif"><main style="width:min(440px,calc(100vw - 40px));padding:34px;border:1px solid #ffffff38;border-radius:24px;background:linear-gradient(145deg,#191919f2,#090909f5);box-shadow:0 28px 90px #000b,inset 0 1px 0 #ffffff16"><div style="font:900 11px/1 'Courier New',monospace;color:${stateColor};letter-spacing:.16em">PLAY STREAMERS · ${success ? "TAMAMLANDI" : "BİLGİ"}</div><h1 style="font-size:28px;letter-spacing:-.04em;margin:18px 0 10px">${title}</h1><p style="line-height:1.65;color:#bdbdb8">${message}</p><a style="display:inline-block;margin-top:12px;padding:13px 17px;border:1px solid #fff;border-radius:11px;background:#f5f5f2;color:#070707;font-weight:850;text-decoration:none" href="${FRONTEND_URL}">Panele dön</a></main></body></html>`, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    },
  });
}

function randomBase64Url(byteLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return bytesToBase64Url(bytes);
}

async function sha256Base64Url(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToBase64Url(new Uint8Array(hash));
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...hash].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function bytesToBase64(bytes) {
  // 24 KiB is divisible by three, so independently encoded chunks can be
  // concatenated without introducing padding in the middle of the payload.
  const chunkSize = 24 * 1024;
  let encoded = "";
  for (let start = 0; start < bytes.length; start += chunkSize) {
    const chunk = bytes.subarray(start, Math.min(bytes.length, start + chunkSize));
    let binary = "";
    for (const byte of chunk) binary += String.fromCharCode(byte);
    encoded += btoa(binary);
  }
  return encoded;
}

function base64UrlToBytes(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function base32Encode(bytes) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(value || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let buffer = 0;
  const output = [];
  for (const character of clean) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid Base32 secret");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

async function totpEncryptionKey(env) {
  requireTotpConfiguration(env);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(env.TOTP_ENCRYPTION_KEY)));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptTotpSecret(secret, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await totpEncryptionKey(env);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode("play-streamers:totp:v1") },
    key,
    new TextEncoder().encode(secret),
  );
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

async function decryptTotpSecret(value, env) {
  const parts = String(value || "").split(".");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("Invalid TOTP secret");
  const key = await totpEncryptionKey(env);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64UrlToBytes(parts[1]),
      additionalData: new TextEncoder().encode("play-streamers:totp:v1"),
    },
    key,
    base64UrlToBytes(parts[2]),
  );
  return new TextDecoder().decode(plaintext);
}

async function totpAtCounter(secret, counter) {
  const message = new Uint8Array(8);
  let remaining = BigInt(counter);
  for (let index = 7; index >= 0; index -= 1) {
    message[index] = Number(remaining & 255n);
    remaining >>= 8n;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    base32Decode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24)
    | (digest[offset + 1] << 16)
    | (digest[offset + 2] << 8)
    | digest[offset + 3];
  return String(binary % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, "0");
}

async function verifyTotpCode(secret, code, at = Date.now()) {
  const currentCounter = Math.floor(at / 1000 / TOTP_PERIOD_SECONDS);
  for (const drift of [-1, 0, 1]) {
    const counter = currentCounter + drift;
    const candidate = await totpAtCounter(secret, counter);
    if (constantTimeEqual(candidate, code)) return { ok: true, counter };
  }
  return { ok: false };
}

function normalizeTotpOrRecoveryCode(value) {
  const raw = String(value || "").trim().toUpperCase().replace(/\s/g, "");
  if (/^\d{6}$/.test(raw)) return raw;
  const compact = raw.replaceAll("-", "");
  return /^[A-Z2-7]{8}$/.test(compact) ? compact : "";
}

function generateTotpRecoveryCodes() {
  return Array.from({ length: TOTP_RECOVERY_CODE_COUNT }, () => {
    const compact = base32Encode(crypto.getRandomValues(new Uint8Array(5))).slice(0, 8);
    return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  });
}

async function totpRecoveryCodeHash(userId, code) {
  const normalized = String(code || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  return sha256Base64Url(`totp-recovery:${userId}:${normalized}`);
}

async function verifyAndConsumeTotpOrRecovery(user, code, env) {
  if (/^\d{6}$/.test(code)) {
    const secret = await decryptTotpSecret(user.totp_secret_ciphertext, env);
    const verification = await verifyTotpCode(secret, code);
    if (!verification.ok) return { ok: false, error: "Authenticator kodu doğru değil." };
    if (verification.counter <= Number(user.totp_last_counter ?? -1)) {
      return { ok: false, status: 409, error: "Bu Authenticator kodu daha önce kullanılmış. Yeni kodu bekle." };
    }
    const updated = await env.DB.prepare(`UPDATE users SET totp_last_counter = ?1
      WHERE id = ?2 AND (totp_last_counter IS NULL OR totp_last_counter < ?1)`)
      .bind(verification.counter, user.id).run();
    if (Number(updated?.meta?.changes || 0) !== 1) {
      return { ok: false, status: 409, error: "Bu Authenticator kodu daha önce kullanılmış. Yeni kodu bekle." };
    }
    return { ok: true, type: "totp", counter: verification.counter };
  }
  const codeHash = await totpRecoveryCodeHash(user.id, code);
  const recovery = await env.DB.prepare(`SELECT id FROM totp_recovery_codes
    WHERE user_id = ?1 AND code_hash = ?2 AND used_at IS NULL LIMIT 1`)
    .bind(user.id, codeHash).first();
  if (!recovery) return { ok: false, error: "Kurtarma kodu geçersiz veya daha önce kullanılmış." };
  const consumed = await env.DB.prepare("UPDATE totp_recovery_codes SET used_at = ?1 WHERE id = ?2 AND used_at IS NULL")
    .bind(Date.now(), recovery.id).run();
  if (Number(consumed?.meta?.changes || 0) !== 1) {
    return { ok: false, status: 409, error: "Bu kurtarma kodu daha önce kullanılmış." };
  }
  return { ok: true, type: "recovery" };
}

function parseBase64UrlJson(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

async function requestJson(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    const error = new Error("Request body too large");
    error.code = "BODY_TOO_LARGE";
    throw error;
  }
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) {
      const error = new Error("Request body too large");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    const body = text ? JSON.parse(text) : {};
    return body && typeof body === "object" ? body : {};
  } catch (error) {
    if (error?.code === "BODY_TOO_LARGE") throw error;
    return {};
  }
}

async function hashPassword(password, salt, iterations = PASSWORD_HASH_ITERATIONS_LEGACY) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: base64UrlToBytes(salt),
      iterations: Math.max(PASSWORD_HASH_ITERATIONS_LEGACY, Number(iterations) || PASSWORD_HASH_ITERATIONS_LEGACY),
      hash: "SHA-256",
    },
    material,
    256,
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  let difference = left.length ^ right.length;
  const longest = Math.max(left.length, right.length);
  for (let index = 0; index < longest; index += 1) {
    difference |= (index < left.length ? left.charCodeAt(index) : 0) ^ (index < right.length ? right.charCodeAt(index) : 0);
  }
  return difference === 0;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
