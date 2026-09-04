import { installLocaleMenu, currentLocale, translateTree } from "../src/live-i18n.js";
import { usesAlertLink } from "../src/providers.js";

const $ = selector => document.querySelector(selector);
let latestState = null;
let providerQuery = "";

async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "Eklenti yanıt vermedi.");
  return response.result;
}

function providerStatus(provider, config) {
  if ((latestState?.connection?.serverConnectedProviderIds || []).includes(provider.id)) return "connected";
  if (config?.status === "error") return "error";
  const connected = config?.enabled && config?.status === "connected"
    && (!usesAlertLink(provider, config) || (config?.hasAlertUrl && config?.alertFrameStatus === "active"));
  if (connected) return "connected";
  if (config?.loginStatus === "required" || config?.loginStatus === "logout-pending") return "disconnected";
  return "";
}

async function openPanel(providerId = "") {
  if (providerId) await chrome.storage.session?.set?.({ openProviderId: providerId }).catch(() => {});
  const query = providerId ? `?provider=${encodeURIComponent(providerId)}` : "";
  const url = chrome.runtime.getURL(`options/options.html${query}`);
  try {
    await chrome.tabs.create({ url, active: true });
    window.close();
  } catch {
    await chrome.runtime.openOptionsPage();
  }
}

async function openProvider(providerId) {
  try { await openPanel(providerId); }
  catch (error) {
    $("#pairStatus").className = "status error";
    $("#pairStatus").textContent = error?.message || "Play Connect paneli açılamadı.";
  }
}

function renderProvider(provider, config, compact = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = compact ? "provider-row" : "provider-card";
  const image = document.createElement("img");
  image.src = `../${provider.icon}`;
  image.alt = "";
  const copy = document.createElement(compact ? "b" : "span");
  const name = document.createElement("b");
  name.textContent = provider.name;
  name.dataset.noTranslate = "";
  const description = document.createElement("small");
  if (compact) description.textContent = provider.region;
  else if (providerStatus(provider, config) === "connected") description.textContent = "Bağlı";
  else if (config?.status === "error") description.textContent = "Kontrol gerekli";
  else description.append(document.createTextNode(provider.region), document.createTextNode(" · "), document.createTextNode("Giriş yap"));
  copy.append(name, description);
  const status = document.createElement("i");
  status.className = providerStatus(provider, config);
  button.append(image, copy, status);
  button.addEventListener("click", () => openProvider(provider.id));
  return translateTree(button);
}

function dateText(value) {
  const time = Number(value || 0);
  return time ? new Date(time).toLocaleString(currentLocale(), { dateStyle: "short", timeStyle: "short" }) : "";
}

function render(state) {
  latestState = state;
  const connection = state.connection || {};
  const paired = Boolean(connection.paired && connection.hasDeviceToken);
  $("#connectionDot").classList.toggle("connected", paired);
  $("#pairCard").classList.toggle("connected", paired);
  $("#pairTitle").textContent = paired ? "SW Identity hesabı bağlı" : "SW Identity hesabını bağla";
  $("#pairText").textContent = paired
    ? `${connection.deviceName || "Chrome Eklentisi"} · Platform giriş bilgilerin bu cihazda kalır.`
    : "Sitede Hesabım → Bağlantılar bölümünden bir kod oluştur ve buraya gir.";
  const pairInput = $("#pairCode");
  const pairButton = $("#pairSubmit");
  pairInput.value = paired ? String(connection.pairingCode || pairInput.value || "") : "";
  pairInput.readOnly = paired;
  pairInput.setAttribute("aria-readonly", String(paired));
  pairButton.disabled = paired;
  pairButton.classList.toggle("is-paired", paired);
  pairButton.setAttribute("aria-label", paired ? "Hesap bağlandı" : "Hesabı bağla");

  const featured = new Set(state.featuredProviderIds || []);
  const normalizedQuery = providerQuery.trim().toLocaleLowerCase("tr-TR");
  const catalog = normalizedQuery
    ? state.providerCatalog.filter(provider => `${provider.name} ${provider.region}`.toLocaleLowerCase("tr-TR").includes(normalizedQuery))
    : state.providerCatalog;
  $("#featuredGrid").replaceChildren(...state.providerCatalog
    .filter(provider => featured.has(provider.id) && catalog.includes(provider))
    .map(provider => renderProvider(provider, state.providers?.[provider.id])));
  const others = catalog.filter(provider => !featured.has(provider.id));
  $("#othersGrid").replaceChildren(...others.map(provider => renderProvider(provider, state.providers?.[provider.id], true)));
  $("#othersCount").textContent = others.length;
  $("#othersToggle").hidden = Boolean(normalizedQuery);
  $("#othersGrid").hidden = normalizedQuery
    ? false
    : $("#othersToggle").getAttribute("aria-expanded") !== "true";
  $("#searchEmpty").hidden = catalog.length > 0;

  const enabled = Object.values(state.providers || {}).filter(config => config.enabled).length;
  if (!paired) {
    $("#deliveryTitle").textContent = "Hesap eşleştirilmedi";
    $("#deliveryText").textContent = `${enabled} platform etkin · olaylar bağlanana kadar cihazda bekletilir.`;
  } else if (connection.lastError) {
    $("#deliveryTitle").textContent = "Teslimat tekrar denenecek";
    const responseText = Number(connection.lastDeliveryHttpStatus || 0) > 0
      ? `HTTP ${Number(connection.lastDeliveryHttpStatus)} · `
      : "";
    $("#deliveryText").textContent = `${responseText}${connection.lastError} · Kuyruk: ${state.queueCount || 0}`;
  } else if (connection.lastDeliveryAt) {
    $("#deliveryTitle").textContent = "Sunucu bağlantısı çalışıyor";
    const responseText = Number(connection.lastDeliveryHttpStatus || 0) > 0
      ? `HTTP ${Number(connection.lastDeliveryHttpStatus)} · `
      : "";
    $("#deliveryText").textContent = `${responseText}Son teslimat: ${dateText(connection.lastDeliveryAt)} · Sunucuda: ${Number(connection.lastServerEventCount || 0)} · Bekleyen: ${state.queueCount || 0}`;
  } else {
    $("#deliveryTitle").textContent = "Sunucu bağlantısı hazır";
    const responseText = connection.lastDeliveryAttemptAt
      ? (Number(connection.lastDeliveryHttpStatus || 0) > 0
          ? `Son API yanıtı: HTTP ${Number(connection.lastDeliveryHttpStatus)}`
          : "Son API denemesinde ağ yanıtı alınamadı")
      : "Henüz yeni donate kuyruğa alınmadı; bu yüzden API gönderimi başlamadı";
    $("#deliveryText").textContent = `${enabled} platform etkin · ${responseText} · Kuyruk: ${state.queueCount || 0}`;
  }
}

async function load() {
  await installLocaleMenu();
  try {
    $("#extensionVersion").textContent = `v${chrome.runtime.getManifest().version}`;
    render(await send({ type: "GET_STATE" }));
  } catch (error) {
    $("#pairStatus").className = "status error";
    $("#pairStatus").textContent = error.message;
  }
}

$("#pairForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter || $("#pairSubmit");
  if (!button) return;
  button.disabled = true;
  $("#pairStatus").className = "status";
  $("#pairStatus").textContent = "Hesap güvenli biçimde eşleştiriliyor…";
  try {
    const state = await send({ type: "PAIR_ACCOUNT", code: $("#pairCode").value });
    $("#pairStatus").textContent = "";
    render(state);
  } catch (error) {
    $("#pairStatus").className = "status error";
    $("#pairStatus").textContent = error.message;
  } finally {
    if (button.isConnected && !latestState?.connection?.paired) button.disabled = false;
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

$("#othersToggle").addEventListener("click", () => {
  const expanded = $("#othersToggle").getAttribute("aria-expanded") === "true";
  $("#othersToggle").setAttribute("aria-expanded", String(!expanded));
  $("#othersGrid").hidden = expanded;
});

$("#providerSearch").addEventListener("input", event => {
  providerQuery = event.currentTarget.value;
  if (latestState) render(latestState);
});

$("#scanNow").addEventListener("click", async () => {
  const button = $("#scanNow");
  button.disabled = true;
  button.classList.add("busy");
  try { render(await send({ type: "POLL_NOW" })); } catch {}
  button.classList.remove("busy");
  button.disabled = false;
});

$("#openSettings").addEventListener("click", () => { void openPanel().catch(error => {
  $("#pairStatus").className = "status error";
  $("#pairStatus").textContent = error?.message || "Play Connect paneli açılamadı.";
}); });
load();
