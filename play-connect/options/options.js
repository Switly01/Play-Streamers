import { installLocaleMenu, currentLocale, translate, translateTree } from "../src/live-i18n.js";
import { CURRENCIES, localeCurrency } from "../src/locale-settings.js";
import { supportsAlertLink, usesAlertLink } from "../src/providers.js";

const $ = (selector, root = document) => root.querySelector(selector);
let state = null;
let activeProviderId = "";
let providerQuery = "";
let activeAlertUrl = "";
let sidebarResizeObserver = null;
let supportAttachments = [];
const CENTRAL_DAB_PROVIDER_IDS = new Set(["streamlabs", "donationalerts", "tipeeestream"]);

async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "Eklenti yanıt vermedi.");
  return response.result;
}

async function loadActiveAlertUrl(providerId = activeProviderId) {
  activeAlertUrl = "";
  const provider = state?.providerCatalog?.find(item => item.id === providerId);
  if (!supportsAlertLink(provider)) return "";
  const result = await send({ type: "GET_PROVIDER_ALERT_URL", providerId }).catch(() => ({ url: "" }));
  if (providerId === activeProviderId) activeAlertUrl = String(result?.url || "");
  return activeAlertUrl;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function replaceSafeMarkup(element, markup) {
  const parsed = new DOMParser().parseFromString(`<body>${String(markup || "")}</body>`, "text/html");
  const fragment = document.createDocumentFragment();
  fragment.append(...Array.from(parsed.body.childNodes, node => document.importNode(node, true)));
  translateTree(fragment);
  element.replaceChildren(fragment);
}

function shortMark(name) {
  return String(name || "PS").replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "").slice(0, 2).toUpperCase();
}

function providerIcon(provider) {
  return `../${provider.icon}`;
}

function providerConnected(provider, config) {
  if (!config?.enabled || config.status !== "connected") return false;
  if (usesAlertLink(provider, config)) return config.hasAlertUrl && config.alertFrameStatus === "active";
  return true;
}

function providerStatus(provider, config) {
  if (config?.status === "error") return "error";
  if (providerConnected(provider, config)) return "enabled";
  if (config?.loginStatus === "required" || config?.loginStatus === "logout-pending") return "disconnected";
  return "";
}

function providerStatusLabel(provider, config) {
  if (config?.hasAlertUrl && config?.alertFrameStatus === "loading") return "Bağlantı açılıyor";
  if (config?.hasAlertUrl && config?.alertFrameStatus !== "active") return "Kontrol gerekli";
  if (config?.loginStatus === "logout-pending") return "Çıkış bekleniyor";
  if (config?.status === "error") return "Kontrol gerekli";
  if (providerConnected(provider, config)) return usesAlertLink(provider, config) ? "OBS bağlantısı aktif" : "Giriş doğrulandı";
  if (config?.loginStatus === "observed") return "Giriş algılandı";
  if (config?.loginStatus === "required") return "Giriş gerekli";
  if (config?.enabled) return "Hazır değil";
  return "Kurulmadı";
}

function syncSidebarHeight() {
  const sidebar = document.querySelector("main > aside");
  const pane = $("#providerPane");
  if (!sidebar || !pane) return;
  if (window.matchMedia("(max-width: 820px)").matches) {
    sidebar.style.removeProperty("height");
    sidebar.style.removeProperty("max-height");
    return;
  }
  const height = Math.max(560, Math.ceil(pane.getBoundingClientRect().height));
  sidebar.style.height = `${height}px`;
  sidebar.style.maxHeight = `${height}px`;
}

function installSidebarSizing() {
  const pane = $("#providerPane");
  if (!pane) return;
  sidebarResizeObserver?.disconnect();
  sidebarResizeObserver = new ResizeObserver(() => requestAnimationFrame(syncSidebarHeight));
  sidebarResizeObserver.observe(pane);
  window.addEventListener("resize", syncSidebarHeight, { passive: true });
  requestAnimationFrame(syncSidebarHeight);
}

function renderConnection() {
  const connection = state.connection || {};
  const paired = Boolean(connection.paired && connection.hasDeviceToken);
  $("#serverDot").classList.toggle("connected", paired);
  $("#serverTitle").textContent = paired ? "SW Identity hesabı bağlı" : "Hesap bağlantısı yok";
  const responseText = connection.lastDeliveryAttemptAt
    ? (Number(connection.lastDeliveryHttpStatus || 0) > 0
        ? `Son API yanıtı: HTTP ${Number(connection.lastDeliveryHttpStatus)}`
        : "Son API denemesinde ağ yanıtı alınamadı")
    : "Henüz yeni donate kuyruğa alınmadı; bu yüzden API gönderimi başlamadı";
  $("#serverText").textContent = paired
    ? `${connection.deviceName || "Chrome Eklentisi"} · ${responseText} · Sunucuda: ${Number(connection.lastServerEventCount || 0)} · Bekleyen: ${state.queueCount || 0}`
    : "Önce tek kullanımlık kodla eşleştir.";
  $("#pairHeading").textContent = paired ? "Sunucu bağlantısı hazır" : "Eklentiyi SW Identity hesabına bağla";
  $("#pairDescription").textContent = paired
    ? "Platform oturumları ve erişim anahtarları bu Chrome profilinde kalır. Sunucuya yalnızca normalleştirilmiş donate olayları gider."
    : "Hesabım → Bağlantılar bölümündeki tek kullanımlık kodu gir. Platform parolaların ve oturum bilgilerin sunucuya gönderilmez.";
  const pairInput = $("#pairCode");
  const pairButton = $("#pairSubmit");
  pairInput.value = paired ? String(connection.pairingCode || pairInput.value || "") : "";
  pairInput.readOnly = paired;
  pairInput.setAttribute("aria-readonly", String(paired));
  pairButton.disabled = paired;
  pairButton.classList.toggle("is-paired", paired);
  pairButton.setAttribute("aria-label", paired ? "Hesap bağlandı" : "Hesabı bağla");
  $("#disconnect").hidden = !paired;
  syncSupportForm();
}

function syncSupportForm() {
  const paired = Boolean(state?.connection?.paired && state?.connection?.hasDeviceToken);
  const emailField = $("#supportEmailField");
  const email = $("#supportEmail");
  const hint = $("#supportAccountHint");
  if (!emailField || !email || !hint) return;
  emailField.hidden = false;
  email.required = !paired;
  email.readOnly = paired;
  email.setAttribute("aria-readonly", String(paired));
  if (paired) email.value = String(state?.connection?.accountEmail || "");
  else if (email.dataset.accountValue === "1") email.value = "";
  email.dataset.accountValue = paired ? "1" : "0";
  hint.className = paired ? "support-account-connected" : "";
  hint.textContent = paired
    ? "Bağlı SW Identity hesabındaki doğrulanmış e-posta otomatik kullanılacak."
    : "Hesap bağlantısı bulunamadı. Yanıt alabilmek için e-posta adresini yazmalısın.";
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function supportFileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function renderSupportFiles() {
  const list = $("#supportFileList");
  list.replaceChildren(...supportAttachments.map(file => {
    const item = document.createElement("span");
    const name = document.createElement("b");
    name.textContent = `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`;
    name.dataset.noTranslate = "";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `${file.name} dosyasını kaldır`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      const key = supportFileKey(file);
      supportAttachments = supportAttachments.filter(item => supportFileKey(item) !== key);
      renderSupportFiles();
    });
    item.append(name, remove);
    return item;
  }));
}

function renderNavigation() {
  const nav = $("#providerNav");
  const normalizedQuery = providerQuery.trim().toLocaleLowerCase("tr-TR");
  const providers = normalizedQuery
    ? state.providerCatalog.filter(provider => `${provider.name} ${provider.region}`.toLocaleLowerCase("tr-TR").includes(normalizedQuery))
    : state.providerCatalog;
  nav.replaceChildren(...providers.map(provider => {
    const config = state.providers?.[provider.id] || {};
    const serverConnected = (state.connection?.serverConnectedProviderIds || []).includes(provider.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `provider-nav${provider.id === activeProviderId ? " active" : ""}`;
    const connectionLabel = provider.preferredConnection === "server-webhook"
      ? "SSB + OBS bağlantısı"
      : provider.preferredConnection === "provider-api" ? "API + OBS bağlantısı" : "OBS alert bağlantısı";
    const icon = document.createElement("i");
    const image = document.createElement("img");
    image.src = providerIcon(provider);
    image.alt = "";
    image.dataset.fallback = shortMark(provider.name);
    icon.append(image);
    const copy = document.createElement("span");
    const name = document.createElement("b");
    name.textContent = provider.name;
    name.dataset.noTranslate = "";
    const description = document.createElement("small");
    description.append(document.createTextNode(provider.region), document.createTextNode(" · "), document.createTextNode(connectionLabel));
    copy.append(name, description);
    const status = document.createElement("i");
    status.className = serverConnected ? "connected" : providerStatus(provider, config);
    button.append(icon, copy, status);
    button.setAttribute("aria-current", provider.id === activeProviderId ? "page" : "false");
    image?.addEventListener("error", () => {
      image.replaceWith(Object.assign(document.createElement("span"), { textContent: shortMark(provider.name) }));
    }, { once: true });
    button.addEventListener("click", async () => {
      activeProviderId = provider.id;
      history.replaceState(null, "", `?provider=${encodeURIComponent(provider.id)}`);
      nav.querySelectorAll('.provider-nav').forEach(item => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-current', active ? 'page' : 'false');
      });
      await loadActiveAlertUrl(provider.id);
      if (activeProviderId !== provider.id) return;
      renderProvider();
    });
    return translateTree(button);
  }));
  $("#providerSearchEmpty").hidden = providers.length > 0;
}

function alertFields(provider) {
  const config = state.providers[provider.id] || {};
  return `<label class="wide">OBS / Alert Box bağlantısı
    <input name="alertUrl" type="password" inputmode="url" autocomplete="off" value="${esc(config.hasAlertUrl ? activeAlertUrl : "")}" placeholder="${config.hasAlertUrl ? "OBS bağlantısı kayıtlı" : "https://…"}" ${config.hasAlertUrl ? 'readonly aria-readonly="true"' : ""}>
    <small>${config.hasAlertUrl ? "Bağlantı kilitli; değiştirmek için önce aşağıdaki OBS bağlantısını kaldır düğmesini kullan." : "Bu bağlantı bir şifre gibi gizlidir; yalnızca bu Chrome profilinde tutulur ve Play Streamers sunucusuna gönderilmez."}</small>
  </label>`;
}

function infoFor(provider) {
  if (CENTRAL_DAB_PROVIDER_IDS.has(provider.id) || usesAlertLink(provider, state.providers[provider.id])) {
    return { title: "OBS / Alert Box bağlantısı", description: "Yayıncı panelinden OBS Browser Source, Alert Box veya Overlay bağlantısını alıp aşağıya yapıştır.", fields: alertFields(provider) };
  }
  if (provider.integration === "streamlabs-api") {
    return {
      title: "API bağlantısı",
      description: "Önce Streamlabs hesabına giriş yap. Ardından erişim anahtarını ekleyerek sayfa açık olmasa da donate verilerini güvenli biçimde al.",
      fields: `
        <label class="wide">${esc(provider.apiTokenLabel)}
          <input name="apiToken" type="password" autocomplete="off" placeholder="Yeni anahtar gir veya kayıtlı anahtarı değiştirme">
          <small>Kayıtlı anahtar ekranda gösterilmez ve Play Streamers sunucusuna gönderilmez. <a href="${esc(provider.apiHelpUrl)}" target="_blank" rel="noreferrer">API belgesi ↗</a></small>
        </label>`
    };
  }
  if (provider.integration === "streamelements-api") {
    return {
      title: "Canlı tip bağlantısı",
      description: "Önce StreamElements hesabına giriş yap. JWT anahtarı ve kanal kimliğiyle channel.tips akışına bağlan; platform sayfası açık olmasa da olayları anlık al.",
      fields: `
        <label>${esc(provider.apiTokenLabel)}
          <input name="apiToken" type="password" autocomplete="off" placeholder="Yeni anahtar gir veya boş bırak">
          <small>Kayıtlı anahtar güvenlik nedeniyle gösterilmez ve sunucuya gönderilmez. <a href="${esc(provider.apiHelpUrl)}" target="_blank" rel="noreferrer">API belgesi ↗</a></small>
        </label>
        <label>${esc(provider.channelIdLabel)}
          <input name="channelId" value="${esc(state.providers[provider.id]?.channelId || "")}" placeholder="StreamElements channel ID">
          <small>StreamElements hesap/kanal ayarlarında görünen kimlik.</small>
        </label>`
    };
  }
  if (["tipeeestream-api", "donationalerts-api", "pally-api"].includes(provider.integration)) {
    return {
      title: provider.apiLabel,
      description: `Önce ${provider.name} hesabına giriş yap. Ardından erişim anahtarını ekleyerek platform sayfası kapalıyken de yeni donate hareketlerini kontrol et.`,
      fields: `
        <label class="wide">${esc(provider.apiTokenLabel)}
          <input name="apiToken" type="password" autocomplete="off" placeholder="Yeni anahtar gir veya kayıtlı anahtarı değiştirme">
          <small>Anahtar yalnızca bu Chrome profilinde saklanır. <a href="${esc(provider.apiHelpUrl)}" target="_blank" rel="noreferrer">API belgesi ↗</a></small>
        </label>`
    };
  }
  return {
    title: "Sekmesiz Play Connect bağlantısı",
    description: `${provider.name} bağlantısını kur.`,
    fields: ""
  };
}

function renderProvider() {
  const provider = state.providerCatalog.find(item => item.id === activeProviderId) || state.providerCatalog[0];
  if (!provider) return;
  activeProviderId = provider.id;
  const config = state.providers?.[provider.id] || {};
  const serverConnected = (state.connection?.serverConnectedProviderIds || []).includes(provider.id);
  const info = infoFor(provider);
  const loginComplete = config.loginStatus === "observed";
  const connected = serverConnected || providerConnected(provider, config);
  const managedSession = CENTRAL_DAB_PROVIDER_IDS.has(provider.id) || usesAlertLink(provider, config);
  const learningActive = Boolean(config.managedWindowId && config.managedTabId);
  const backgroundActive = managedSession
    ? config.alertFrameStatus === "active" && Boolean(config.hasAlertUrl)
    : config.backgroundStatus === "active";
  const activity = (state.activity || []).filter(item => !item.providerId || item.providerId === provider.id).slice(0, 6);
  let centralCard = "";
  if (CENTRAL_DAB_PROVIDER_IDS.has(provider.id) || provider.preferredConnection === "server-webhook") {
    centralCard = `<section class="central-dab-card">
      <span><b>${CENTRAL_DAB_PROVIDER_IDS.has(provider.id) ? "DAB bağlantısı" : "SSB bağlantısı"}</b><small>Merkezi bağlantıyı siteden yönetebilir veya aşağıya alternatif OBS bağlantısı ekleyebilirsin. Merkezi bağlantı aktifken kayıtlı link beklemede kalır; aynı olay iki kez okunmaz.</small></span>
      <button id="openCentralDab" type="button">Hesap bağlantılarını aç ↗</button>
    </section>`;
  }
  $("#providerPane").classList.remove("is-central-dab");
  const loginCopy = config.loginStatus === "observed"
    ? `Chrome oturumu algılandı · donate veri akışı otomatik bağlandı${config.lastPageAt ? ` · ${new Date(config.lastPageAt).toLocaleString(currentLocale())}` : ""}`
    : config.loginStatus === "required"
      ? "Platform yeniden giriş istiyor"
      : config.loginStatus === "logout-pending"
        ? "Platform çıkış sayfasında işlemin tamamlanması bekleniyor"
      : config.loginStatus === "waiting"
        ? "Açılan sekmede girişin tamamlanması bekleniyor"
        : "Henüz doğrulanmış bir platform oturumu yok";
  const managedHealth = managedSession
    ? `<section class="managed-health ${backgroundActive ? "is-active" : (config.alertFrameStatus === "error" ? "is-error" : "is-ready")}">
        <i aria-hidden="true">${backgroundActive ? "✓" : (config.alertFrameStatus === "error" ? "!" : "●")}</i>
        <span><b>${backgroundActive ? "OBS bağlantısı görünmeyen arka planda çalışıyor" : (config.alertFrameStatus === "loading" ? "OBS bağlantısı yükleniyor" : (config.hasAlertUrl ? "OBS bağlantısını doğrula" : "OBS / Alert Box bağlantısı gerekli"))}</b>
        <small>${backgroundActive
          ? `${esc(config.alertRenderer || provider.name)} bağlantısı Chrome açıkken görünür sekme olmadan yeni donate olaylarını dinliyor.`
          : (config.hasAlertUrl ? "Bağlantıyı doğrula düğmesiyle arka plan kaynağını yeniden başlatabilirsin." : "Yayıncı panelinden OBS Browser Source, Alert Box veya Overlay bağlantısını alıp aşağıya yapıştır.")}</small></span>
      </section>`
    : "";
  const serverHealth = serverConnected
    ? `<section class="managed-health is-active"><i aria-hidden="true">✓</i><span><b>Sunucu bağlantısı aktif</b><small>${esc(provider.name)} olayları doğrudan Play Streamers sunucusuna geliyor. Çift kayıt oluşmaması için bu cihazdaki sayfa taraması otomatik durduruldu.</small></span></section>`
    : "";
  replaceSafeMarkup($("#providerPane"), `
    <div class="provider-head">
      <span class="provider-logo" style="--provider-color:${esc(provider.brandColor)}"><img src="${esc(providerIcon(provider))}" alt="${esc(provider.name)} ikonu"><i>${esc(shortMark(provider.name))}</i></span>
      <span><h2 data-no-translate>${esc(provider.name)}</h2><p>${esc(info.description)}</p></span>
      <span class="status-pill ${serverConnected ? "connected" : providerStatus(provider, config)}">${esc(serverConnected ? "Sunucu bağlantısı aktif" : providerStatusLabel(provider, config))}</span>
    </div>
    ${centralCard}
    ${serverHealth || managedHealth}
    <div class="login-flow">
      ${managedSession ? `
        <article class="login-step is-primary ${config.hasAlertUrl ? "is-complete" : ""}">
          <i>1</i><span><b>OBS bağlantısını yayıncı panelinden kopyala</b><small>Platform içinde OBS, Browser Source, Alert Box, bildirim bağlantısı veya Overlay adıyla verilen gizli adresi kullan.</small></span>
        </article>
        <article class="login-step ${connected ? "is-complete" : ""}">
          <i>2</i><span><b>Bağlantıyı kaydet ve doğrula</b><small>Play Connect bağlantı adresinden sağlayıcıyı otomatik tanır; platform oturumu veya parola istemez.</small></span>
          <button id="testProvider" type="button">${connected ? "✓ Yeniden doğrula" : "Bağlantıyı doğrula"}</button>
        </article>` : `
        <article class="login-step is-primary ${loginComplete ? "is-complete" : ""}">
          <i>1</i><span><b>${esc(provider.name)} hesabına giriş yap</b><small>API anahtarını almak için platformun kendi güvenli sayfası açılır; parolan Play Streamers tarafından görülmez.</small></span>
          <span class="provider-session-actions"><button id="openProvider" class="primary ${loginComplete ? "is-verified" : ""}" type="button" ${loginComplete ? "disabled" : ""}>${loginComplete ? "✓ Giriş yapıldı" : "Platforma giriş yap ↗"}</button>${loginComplete ? '<button id="logoutProvider" class="danger subtle-logout" type="button">Platformdan çıkış yap ↗</button>' : ""}</span>
        </article>
        <article class="login-step ${config.loginStatus === "observed" ? "is-complete" : ""}">
          <i>2</i><span><b>API bağlantısını doğrula</b><small>${esc(loginCopy)}</small></span>
          <button id="testProvider" type="button">${connected ? "✓ Yeniden doğrula" : "Bağlantıyı doğrula"}</button>
        </article>`}
    </div>
    <form id="providerForm" class="provider-form">
      <div class="field-grid">
        ${info.fields}
        ${!managedSession && supportsAlertLink(provider) ? `<label class="wide connection-alternative"><b>Alternatif OBS bağlantısı</b><small>Link kaydedildiğinde yerel API yerine OBS bağlantısı kullanılır. API ayarların korunur.</small></label>${alertFields(provider)}` : ""}
        <label>Varsayılan para birimi
          <select name="defaultCurrency">
            <option value="auto" ${config.currencyMode !== "manual" ? "selected" : ""}>${esc(`Dil varsayılanı: ${localeCurrency(currentLocale())}`)}</option>
            ${CURRENCIES.map(currency => `<option value="${currency}" ${config.currencyMode === "manual" && currency === config.defaultCurrency ? "selected" : ""}>${currency}</option>`).join("")}
          </select>
        </label>
      </div>
      <p id="providerMessage" class="form-message ${config.lastCaptureError ? "error" : ""}" aria-live="polite">${esc(config.lastCaptureError || config.lastError || "")}</p>
      <div class="capture-diagnostics"><span><b>Sunucuya işlendi</b>${Number(config.deliveredEventCount || 0)}</span><span><b>Son gerçek olay</b>${config.lastEventAt ? new Date(config.lastEventAt).toLocaleString(currentLocale()) : "Henüz yok"}</span><span><b>Kaynak</b>${esc(config.lastCaptureSource || "Bekleniyor")}</span></div>
      <div class="form-actions">
        <button class="primary" type="submit">Bağlantıyı kaydet</button>
        <button id="checkDonates" type="button">Yeni donate var mı kontrol et</button>
        ${config.hasApiToken ? '<button id="clearToken" class="danger" type="button">Kayıtlı anahtarı sil</button>' : ""}
        ${config.hasAlertUrl ? '<button id="clearAlertUrl" class="danger" type="button">OBS bağlantısını kaldır</button>' : ""}
      </div>
    </form>
    <section class="activity-box">
      <h3>Son işlemler</h3>
      ${activity.length ? activity.map(item => `<div class="activity-row"><span>${esc(item.message)}</span><time>${new Date(item.at).toLocaleString(currentLocale())}</time></div>`).join("") : '<div class="activity-row"><span>Bu platform için henüz işlem yok.</span></div>'}
    </section>`);
  const providerLogo = $(".provider-logo", $("#providerPane"));
  const providerImage = $("img", providerLogo);
  providerImage?.addEventListener("error", () => providerLogo?.classList.add("fallback"), { once: true });
  bindProviderForm(provider);
  $("#openCentralDab")?.addEventListener("click", () => window.open("https://pstreamers.com/#account-connections", "_blank", "noopener"));
  requestAnimationFrame(syncSidebarHeight);
}

function formConfig(form, clearApiToken = false, clearAlertUrl = false) {
  const data = new FormData(form);
  return {
    enabled: true,
    apiToken: data.get("apiToken") || "",
    channelId: data.has("channelId") ? data.get("channelId") : undefined,
    alertUrl: data.get("alertUrl") || "",
    defaultCurrency: data.get("defaultCurrency") === "auto" ? localeCurrency(currentLocale()) : data.get("defaultCurrency"),
    currencyMode: data.get("defaultCurrency") === "auto" ? "locale" : "manual",
    clearApiToken,
    clearAlertUrl
  };
}

function providerScanResult(result) {
  if (result?.serverConnection) return "Merkezi bağlantı aktif; kayıtlı OBS bağlantısı yedek olarak bekliyor.";
  const accepted = Number(result?.accepted || 0);
  const candidates = Number(result?.candidateCount || 0);
  const duplicates = Number(result?.duplicateCount || 0);
  const invalid = Number(result?.invalidCount || 0);
  if (result?.alertFrame) {
    return result.alertFrame === "active"
      ? `${result.renderer || "OBS"} bağlantısı doğrulandı; yeni donate geldiğinde anlık olarak Play Streamers'a gönderilecek.`
      : "OBS bağlantısı arka planda başlatıldı; ilk yükleme tamamlanıyor.";
  }
  if (accepted > 0) {
    return `${accepted} yeni donate bulundu; teslimat kuyruğu ve sunucu onayı çalıştırıldı.`;
  }
  if (duplicates > 0) {
    return `${candidates} hareket okundu; ${duplicates} tanesinin işlem kimliği daha önce gönderildiği için tekrar kuyruğa alınmadı.`;
  }
  if (invalid > 0) {
    return `${candidates} hareket okundu; ${invalid} kayıtta geçerli tutar veya işlem alanı bulunamadı.`;
  }
  return `Bağlantı başarılı. ${candidates} hareket okundu; yeni donate yok.`;
}

function bindProviderForm(provider) {
  const form = $("#providerForm");
  const status = $("#providerMessage");
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.submitter || form.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = true;
    status.className = "form-message";
    status.textContent = "Ayarlar kaydediliyor…";
    try {
      state = await send({ type: "SAVE_PROVIDER", providerId: provider.id, config: formConfig(form) });
      await loadActiveAlertUrl(provider.id);
      status.textContent = "Ayarlar bu Chrome profilinde güvenli biçimde kaydedildi.";
      renderNavigation();
      setTimeout(renderProvider, 500);
    } catch (error) {
      status.className = "form-message error";
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  $("#testProvider").addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    status.className = "form-message";
    status.textContent = "Platform bağlantısı kontrol ediliyor…";
    try {
      state = await send({ type: "SAVE_PROVIDER", providerId: provider.id, config: formConfig(form) });
      await loadActiveAlertUrl(provider.id);
      const result = await send({ type: "TEST_PROVIDER", providerId: provider.id });
      state = await send({ type: "GET_STATE" });
      const successText = providerScanResult(result);
      renderNavigation();
      renderProvider();
      $("#providerMessage").textContent = successText;
    } catch (error) {
      status.className = "form-message error";
      status.textContent = error.message;
      state = await send({ type: "GET_STATE" }).catch(() => state);
      renderNavigation();
    } finally {
      button.disabled = false;
    }
  });
  $("#openProvider")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    status.className = "form-message";
    status.textContent = provider.integration === "session"
      ? `${provider.name} geçici giriş penceresinde açılıyor. Sekmesiz veri bağlantısı doğrulanınca pencere otomatik kapanacak.`
      : `Açılan ${provider.name} sekmesinde giriş yap. Giriş tamamlanınca bu ayar sayfasına dön.`;
    try {
      await send({ type: "OPEN_PROVIDER_LOGIN", providerId: provider.id });
      state = await send({ type: "GET_STATE" });
      renderNavigation();
    } catch (error) {
      status.className = "form-message error";
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  $("#logoutProvider")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    status.className = "form-message";
    status.textContent = `${provider.name} çıkış sayfası açılıyor…`;
    try {
      state = await send({ type: "OPEN_PROVIDER_LOGOUT", providerId: provider.id });
      renderNavigation();
      renderProvider();
      $("#providerMessage").textContent = "Açılan platform sayfasında çıkış işlemini tamamla.";
    } catch (error) {
      if (button.isConnected) button.disabled = false;
      status.className = "form-message error";
      status.textContent = error.message;
    }
  });
  $("#checkDonates")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    status.className = "form-message";
    status.textContent = "Yeni donate hareketleri kontrol ediliyor…";
    try {
      const result = await send({ type: "TEST_PROVIDER", providerId: provider.id });
      state = await send({ type: "GET_STATE" });
      const resultText = providerScanResult(result);
      renderNavigation();
      renderProvider();
      $("#providerMessage").textContent = resultText;
    } catch (error) {
      button.disabled = false;
      status.className = "form-message error";
      status.textContent = error.message;
    }
  });
  $("#clearToken")?.addEventListener("click", async event => {
    if (!confirm(translate("Bu platform için bu Chrome profilinde saklanan erişim anahtarı silinsin mi?"))) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      state = await send({ type: "SAVE_PROVIDER", providerId: provider.id, config: formConfig(form, true) });
      renderProvider();
      renderNavigation();
    } catch (error) {
      status.className = "form-message error";
      status.textContent = error.message;
      if (button.isConnected) button.disabled = false;
    }
  });
  $("#clearAlertUrl")?.addEventListener("click", async event => {
    if (!await askObsDisconnectConfirmation(provider.name)) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      state = await send({ type: "SAVE_PROVIDER", providerId: provider.id, config: formConfig(form, false, true) });
      activeAlertUrl = "";
      renderProvider();
      renderNavigation();
    } catch (error) {
      status.className = "form-message error";
      status.textContent = error.message;
      if (button.isConnected) button.disabled = false;
    }
  });
}

async function initialize() {
  try {
    await installLocaleMenu();
    $("#extensionVersion").textContent = `v${chrome.runtime.getManifest().version}`;
    state = await send({ type: "GET_STATE" });
    const sessionRequest = await chrome.storage.session?.get?.("openProviderId").catch(() => ({}));
    const requested = new URLSearchParams(location.search).get("provider")
      || sessionRequest?.openProviderId;
    activeProviderId = state.providerCatalog.some(item => item.id === requested)
      ? requested
      : state.featuredProviderIds[0];
    await loadActiveAlertUrl(activeProviderId);
    chrome.storage.session?.remove?.("openProviderId").catch(() => {});
    renderConnection();
    renderNavigation();
    renderProvider();
    installSidebarSizing();
  } catch (error) {
    $("#pairStatus").className = "form-status error";
    $("#pairStatus").textContent = error.message;
  }
}

$("#pairForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter || $("#pairSubmit");
  if (!button) return;
  button.disabled = true;
  $("#pairStatus").className = "form-status";
  $("#pairStatus").textContent = "Hesap eşleştiriliyor…";
  try {
    state = await send({ type: "PAIR_ACCOUNT", code: $("#pairCode").value });
    $("#pairStatus").textContent = "Eşleştirme tamamlandı.";
    renderConnection();
  } catch (error) {
    $("#pairStatus").className = "form-status error";
    $("#pairStatus").textContent = error.message;
  } finally {
    if (button.isConnected && !state?.connection?.paired) button.disabled = false;
  }
});

function askDisconnectConfirmation() {
  const modal = $("#disconnectModal");
  const cancel = $("#disconnectCancel");
  const confirmButton = $("#disconnectConfirm");
  modal.hidden = false;
  confirmButton.focus();
  return new Promise(resolve => {
    const finish = answer => {
      modal.hidden = true;
      modal.removeEventListener("click", onLayerClick);
      document.removeEventListener("keydown", onKeyDown);
      cancel.removeEventListener("click", onCancel);
      confirmButton.removeEventListener("click", onConfirm);
      resolve(answer);
    };
    const onCancel = () => finish(false);
    const onConfirm = () => finish(true);
    const onLayerClick = event => {
      if (event.target === modal) finish(false);
    };
    const onKeyDown = event => {
      if (event.key === "Escape") finish(false);
    };
    cancel.addEventListener("click", onCancel);
    confirmButton.addEventListener("click", onConfirm);
    modal.addEventListener("click", onLayerClick);
    document.addEventListener("keydown", onKeyDown);
  });
}

function askObsDisconnectConfirmation(providerName) {
  const modal = $("#obsDisconnectModal");
  const cancel = $("#obsDisconnectCancel");
  const confirmButton = $("#obsDisconnectConfirm");
  const providerLabel = $("#obsDisconnectProvider");
  if (!modal || !cancel || !confirmButton) return Promise.resolve(false);
  if (providerLabel) providerLabel.textContent = providerName || "Platform";
  modal.hidden = false;
  confirmButton.focus();
  return new Promise(resolve => {
    const finish = answer => {
      modal.hidden = true;
      modal.removeEventListener("click", onLayerClick);
      document.removeEventListener("keydown", onKeyDown);
      cancel.removeEventListener("click", onCancel);
      confirmButton.removeEventListener("click", onConfirm);
      resolve(answer);
    };
    const onCancel = () => finish(false);
    const onConfirm = () => finish(true);
    const onLayerClick = event => {
      if (event.target === modal) finish(false);
    };
    const onKeyDown = event => {
      if (event.key === "Escape") finish(false);
    };
    cancel.addEventListener("click", onCancel);
    confirmButton.addEventListener("click", onConfirm);
    modal.addEventListener("click", onLayerClick);
    document.addEventListener("keydown", onKeyDown);
  });
}

$("#disconnect").addEventListener("click", async event => {
  const button = event.currentTarget;
  if (!await askDisconnectConfirmation()) return;
  button.disabled = true;
  try {
    state = await send({ type: "DISCONNECT_ACCOUNT" });
    renderConnection();
    $("#pairStatus").className = "form-status";
    $("#pairStatus").textContent = "Site ve eklenti bağlantısı birlikte kaldırıldı.";
  } catch (error) {
    $("#pairStatus").className = "form-status error";
    $("#pairStatus").textContent = error.message;
  } finally {
    if (button.isConnected) button.disabled = false;
  }
});

$("#pairCode").addEventListener("input", event => {
  if (event.currentTarget.readOnly) return;
  const normalized = event.currentTarget.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 16);
  event.currentTarget.value = normalized.length > 12
    ? `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12)}`
    : normalized.length > 8
      ? `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8)}`
    : normalized.length > 4
      ? `${normalized.slice(0, 4)}-${normalized.slice(4)}`
      : normalized;
});

function closeSupport() {
  $("#supportModal").hidden = true;
}

$("#supportShortcut").addEventListener("click", () => {
  syncSupportForm();
  $("#supportModal").hidden = false;
  (state?.connection?.paired
    ? $("#supportForm [name='subject']")
    : $("#supportEmail"))?.focus();
});
$("#supportClose").addEventListener("click", closeSupport);
$("#supportCancel").addEventListener("click", closeSupport);
$("#supportModal").addEventListener("click", event => {
  if (event.target === $("#supportModal")) closeSupport();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !$("#supportModal").hidden) closeSupport();
});
$("#supportFiles").addEventListener("change", event => {
  const selected = [...event.currentTarget.files];
  const existing = new Map(supportAttachments.map(file => [supportFileKey(file), file]));
  selected.forEach(file => existing.set(supportFileKey(file), file));
  supportAttachments = [...existing.values()].slice(0, 10);
  event.currentTarget.value = "";
  renderSupportFiles();
});
$("#supportForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = $("#supportSubmit");
  const status = $("#supportStatus");
  const files = [...supportAttachments];
  if (files.length > 10) {
    status.className = "form-message error";
    status.textContent = "En fazla 10 dosya ekleyebilirsin.";
    return;
  }
  if (files.some(file => file.size > 10 * 1024 * 1024)) {
    status.className = "form-message error";
    status.textContent = "Her dosya en fazla 10 MB olabilir.";
    return;
  }
  if (files.reduce((total, file) => total + file.size, 0) > 25 * 1024 * 1024) {
    status.className = "form-message error";
    status.textContent = "Dosyaların toplam boyutu en fazla 25 MB olabilir.";
    return;
  }
  submit.disabled = true;
  status.className = "form-message";
  status.textContent = "Destek talebi gönderiliyor…";
  try {
    const attachments = [];
    for (const file of files) {
      attachments.push({
        name: file.name,
        type: file.type,
        base64: bytesToBase64(new Uint8Array(await file.arrayBuffer()))
      });
    }
    const result = await send({
      type: "SEND_SUPPORT",
      payload: {
        email: $("#supportEmail").value,
        subject: form.elements.subject.value,
        message: form.elements.message.value,
        attachments
      }
    });
    status.textContent = result.accountEmailUsed
      ? "Talep Play Connect adıyla gönderildi ve hesabındaki Destek talepleri bölümüne eklendi."
      : "Talep gönderildi. Yanıt için e-postanı kontrol et.";
    form.elements.subject.value = "";
    form.elements.message.value = "";
    $("#supportFiles").value = "";
    supportAttachments = [];
    renderSupportFiles();
  } catch (error) {
    status.className = "form-message error";
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

$("#providerSearch").addEventListener("input", event => {
  providerQuery = event.currentTarget.value;
  if (state) renderNavigation();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.playStreamersDonate?.newValue || !state) return;
  const stored = changes.playStreamersDonate.newValue;
  const previousProvider = state.providers?.[activeProviderId] || {};
  const nextProvider = stored.providers?.[activeProviderId] || {};
  const connectionChanged = Boolean(stored.connection?.paired) !== Boolean(state.connection?.paired)
    || String(stored.connection?.accountEmail || "") !== String(state.connection?.accountEmail || "");
  const providerChanged = previousProvider.loginStatus !== nextProvider.loginStatus
    || previousProvider.status !== nextProvider.status
    || previousProvider.lastCaptureError !== nextProvider.lastCaptureError
    || Number(previousProvider.lastEventAt || 0) !== Number(nextProvider.lastEventAt || 0)
    || Number(previousProvider.lastCaptureAt || 0) !== Number(nextProvider.lastCaptureAt || 0)
    || Number(previousProvider.capturedEventCount || 0) !== Number(nextProvider.capturedEventCount || 0)
    || Number(previousProvider.deliveredEventCount || 0) !== Number(nextProvider.deliveredEventCount || 0);
  if (!connectionChanged && !providerChanged) return;
  send({ type: "GET_STATE" }).then(async nextState => {
    state = nextState;
    await loadActiveAlertUrl(activeProviderId);
    renderConnection();
    renderNavigation();
    renderProvider();
  }).catch(() => {});
});

window.addEventListener("focus", () => {
  if (!state) return;
  send({ type: "GET_STATE" }).then(async nextState => {
    state = nextState;
    await loadActiveAlertUrl(activeProviderId);
    renderConnection();
    renderNavigation();
    renderProvider();
  }).catch(() => {});
});

initialize();

window.addEventListener('pc-locale-change', () => {
  const field = document.querySelector('[name="defaultCurrency"]');
  if (field) {
    const option = field.querySelector('[value="auto"]');
    option.textContent = `Dil varsayılanı: ${localeCurrency(currentLocale())}`;
    translateTree(option);
  }
  if (state) for (const config of Object.values(state.providers || {})) {
    if (config.currencyMode !== 'manual') config.defaultCurrency = localeCurrency(currentLocale());
  }
});
