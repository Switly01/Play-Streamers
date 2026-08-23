"use strict";

const api = window.psBridge;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let state = null;
let editingProviderId = "";

const statusLabels = {
  starting: "Başlatılıyor",
  watching: "Takip ediliyor",
  paused: "Durduruldu",
  warning: "Kontrol gerekli",
  error: "Bağlantı hatası",
  blocked: "Sayfa engellendi"
};

const fieldInputNames = {
  item: "selectorItem",
  eventId: "selectorEventId",
  name: "selectorName",
  amount: "selectorAmount",
  currency: "selectorCurrency",
  message: "selectorMessage",
  time: "selectorTime"
};

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message, error = false) {
  const node = document.createElement("div");
  node.className = `toast${error ? " error" : ""}`;
  node.textContent = message;
  $("#toastStack").append(node);
  setTimeout(() => node.remove(), 4200);
}

function formatTime(value) {
  if (!value) return "Henüz yok";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatMoney(minor, currency) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: currency || "TRY"
    }).format((Number(minor) || 0) / 100);
  } catch {
    return `${((Number(minor) || 0) / 100).toFixed(2)} ${currency || ""}`;
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url || "—";
  }
}

function renderHeader() {
  const active = state.providers.filter(provider => provider.enabled).length;
  const healthy = state.providers.filter(provider => provider.enabled && provider.runtime.status === "watching").length;
  $("#activeProviderCount").textContent = active;
  $("#eventCount").textContent = state.events.length;
  $("#queueCount").textContent = state.queueCount;
  const status = $("#globalStatus");
  status.classList.toggle("warning", active > healthy);
  $("span", status).textContent = active === 0
    ? "Bağlantı bekleniyor"
    : active === healthy
      ? `${healthy} bağlantı arka planda aktif`
      : `${healthy}/${active} bağlantı aktif`;
}

function providerCard(provider) {
  const runtime = provider.runtime || {};
  const status = provider.enabled
    ? runtime.status || "starting"
    : "paused";
  const lastEvent = state.events.find(event => event.providerId === provider.id);
  const configured = provider.configured;
  return `
    <article class="provider-card" data-provider-id="${esc(provider.id)}">
      <div class="provider-card-head">
        <span class="provider-letter">${esc(provider.name.slice(0, 1).toLocaleUpperCase("tr-TR"))}</span>
        <span>
          <h3>${esc(provider.name)}</h3>
          <p>${esc(hostOf(provider.watchUrl))}</p>
        </span>
        <label class="connection-toggle" title="${provider.enabled ? "Takibi durdur" : "Takibi başlat"}">
          <input type="checkbox" data-action="toggle"${provider.enabled ? " checked" : ""}${configured ? "" : " disabled"}>
          <i></i>
        </label>
      </div>
      <div class="provider-details">
        <span><small>DURUM</small><b><i class="status-pill ${esc(status)}">${esc(configured ? statusLabels[status] || status : "Kurulum eksik")}</i></b></span>
        <span><small>TAKİP TÜRÜ</small><b>${provider.mode === "alert" ? "Canlı bildirim" : "İşlem geçmişi"}</b></span>
        <span><small>SON OLAY</small><b>${esc(formatTime(lastEvent?.observedAt))}</b></span>
        <span><small>SON TESLİMAT</small><b>${esc(formatTime(runtime.lastDeliveredAt))}</b></span>
      </div>
      <p class="provider-error">${esc(runtime.lastError || runtime.deliveryError || (!configured ? "Takip sayfasını açıp donate satırını seçmelisin." : ""))}</p>
      <div class="provider-actions">
        <button type="button" data-action="login">${provider.loginUrl ? "Giriş yap" : "Sayfayı aç"}</button>
        <button type="button" data-action="watch">Takip sayfası</button>
        <button type="button" data-action="edit">Alanları düzenle</button>
        <button type="button" data-action="reload">Yeniden yükle</button>
        <button type="button" data-action="test">Test olayı</button>
        <button type="button" data-action="export">Şablonu dışa aktar</button>
        <button type="button" class="danger" data-action="remove">Kaldır</button>
      </div>
    </article>
  `;
}

function renderProviders() {
  $("#providerGrid").innerHTML = state.providers.map(providerCard).join("");
  $("#providerGrid").hidden = state.providers.length === 0;
  $("#providerEmpty").hidden = state.providers.length > 0;
}

function renderEvents() {
  $("#eventList").innerHTML = state.events.map(event => `
    <article class="event-item">
      <span class="event-provider">${esc(event.providerName.slice(0, 1).toLocaleUpperCase("tr-TR"))}</span>
      <span class="event-copy">
        <b>${esc(event.donorName)}</b>
        <p>${esc(event.message || `${event.providerName} üzerinden algılandı`)}</p>
      </span>
      <strong class="event-amount">${esc(formatMoney(event.amountMinor, event.currency))}</strong>
      <time class="event-time">${esc(formatTime(event.eventAt || event.observedAt))}</time>
    </article>
  `).join("");
  $("#eventEmpty").hidden = state.events.length > 0;
}

function renderSettings() {
  $("#autoStart").checked = state.settings.autoStart;
  $("#closeToTray").checked = state.settings.closeToTray;
  $("#apiEndpoint").value = state.settings.apiEndpoint || "";
  $("#deliveryEnabled").checked = state.settings.deliveryEnabled;
  const paired = Boolean(state.settings.hasDeliveryToken && state.settings.deviceId);
  const pairingState = $("#pairingState");
  pairingState.classList.toggle("connected", paired && state.settings.deliveryEnabled);
  pairingState.innerHTML = paired
    ? `<b>${state.settings.deliveryEnabled ? "Play Streamers hesabına bağlı" : "Bağlantı yeniden doğrulanmalı"}</b><small>${esc(state.settings.deviceName || "Windows cihazı")} · ${state.settings.deliveryEnabled ? "Donate olayları güvenli biçimde gönderiliyor." : "Siteden yeni bir kod oluşturup tekrar bağla."}</small>`
    : "<b>Henüz bir hesaba bağlı değil</b><small>Siteden oluşturduğun tek kullanımlık kodu aşağıya gir.</small>";
  $("#disconnectDelivery").hidden = !paired;
  $("#pairDelivery").textContent = paired ? "Yeni kodla tekrar bağla" : "Hesabı bağla";
  $("#deliveryToken").placeholder = state.settings.hasDeliveryToken
    ? "Güvenli anahtar kayıtlı · değiştirmek için yaz"
    : "Henüz eşleştirme anahtarı yok";
}

function render() {
  if (!state) return;
  renderHeader();
  renderProviders();
  renderEvents();
  renderSettings();
}

function providerFormData() {
  const form = $("#providerForm");
  const data = new FormData(form);
  return {
    id: String(data.get("id") || ""),
    name: String(data.get("name") || ""),
    watchUrl: String(data.get("watchUrl") || ""),
    loginUrl: String(data.get("loginUrl") || ""),
    mode: String(data.get("mode") || "history"),
    defaultCurrency: String(data.get("defaultCurrency") || "TRY"),
    scanLimit: Number(data.get("scanLimit")) || 150,
    enabled: data.get("enabled") === "on",
    selectors: {
      item: String(data.get("selectorItem") || ""),
      eventId: String(data.get("selectorEventId") || ""),
      name: String(data.get("selectorName") || ""),
      amount: String(data.get("selectorAmount") || ""),
      currency: String(data.get("selectorCurrency") || ""),
      message: String(data.get("selectorMessage") || ""),
      time: String(data.get("selectorTime") || "")
    }
  };
}

function fillProviderForm(provider = null) {
  const form = $("#providerForm");
  form.reset();
  editingProviderId = provider?.id || "";
  form.elements.id.value = provider?.id || "";
  form.elements.name.value = provider?.name || "";
  form.elements.watchUrl.value = provider?.watchUrl || "";
  form.elements.loginUrl.value = provider?.loginUrl || "";
  form.elements.mode.value = provider?.mode || "history";
  form.elements.defaultCurrency.value = provider?.defaultCurrency || "TRY";
  form.elements.scanLimit.value = provider?.scanLimit || 150;
  form.elements.enabled.checked = provider ? provider.enabled : true;
  for (const [field, inputName] of Object.entries(fieldInputNames)) {
    form.elements[inputName].value = provider?.selectors?.[field] || "";
  }
  $("#providerModalTitle").textContent = provider ? `${provider.name} bağlantısını düzenle` : "Site bağlantısı oluştur";
  $("#providerFormError").textContent = "";
  $$("[data-select-field]", form).forEach(button => {
    button.disabled = !provider;
    button.title = provider ? "" : "Önce taslak olarak kaydet";
  });
}

function openProviderModal(provider = null) {
  fillProviderForm(provider);
  $("#providerModal").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeProviderModal() {
  $("#providerModal").hidden = true;
  document.body.style.overflow = "";
  editingProviderId = "";
}

async function saveProvider(options = {}) {
  const payload = providerFormData();
  if (!payload.selectors.item) payload.enabled = false;
  try {
    const result = await api.saveProvider(payload);
    if (!result.ok) throw new Error(result.error || "Bağlantı kaydedilemedi.");
    editingProviderId = result.provider.id;
    state = await api.getState();
    render();
    if (!options.keepOpen) {
      closeProviderModal();
      toast(payload.selectors.item ? "Donate bağlantısı kaydedildi." : "Taslak kaydedildi. Şimdi sayfadan alanları seçebilirsin.");
    } else {
      fillProviderForm(state.providers.find(item => item.id === result.provider.id));
    }
    return result.provider;
  } catch (error) {
    $("#providerFormError").textContent = error.message;
    if (!options.keepOpen) toast(error.message, true);
    return null;
  }
}

async function ensureSavedForSelection() {
  if (editingProviderId) return state.providers.find(provider => provider.id === editingProviderId);
  return saveProvider({ keepOpen: true });
}

async function handleProviderAction(providerId, action, target) {
  const provider = state.providers.find(item => item.id === providerId);
  if (!provider) return;
  try {
    if (action === "toggle") {
      const result = await api.toggleProvider(providerId, target.checked);
      if (!result.ok) {
        target.checked = !target.checked;
        throw new Error(result.error || "Bağlantı durumu değiştirilemedi.");
      }
    } else if (action === "login") {
      await api.showProvider(providerId, "login");
    } else if (action === "watch") {
      await api.showProvider(providerId, "watch");
    } else if (action === "edit") {
      openProviderModal(provider);
    } else if (action === "reload") {
      await api.reloadProvider(providerId);
      toast("Takip sayfası yeniden yükleniyor.");
    } else if (action === "test") {
      await api.addTestEvent(providerId);
      toast("Test donate olayı oluşturuldu.");
    } else if (action === "export") {
      const result = await api.exportProvider(providerId);
      if (result.ok) toast("Sağlayıcı şablonu dışa aktarıldı.");
    } else if (action === "remove") {
      const result = await api.removeProvider(providerId);
      if (result.ok) toast("Donate bağlantısı kaldırıldı.");
    }
  } catch (error) {
    toast(error.message, true);
  }
}

function bindEvents() {
  $$(".tabs button").forEach(button => {
    button.addEventListener("click", () => {
      $$(".tabs button").forEach(node => node.classList.toggle("active", node === button));
      $$(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === button.dataset.tab));
    });
  });

  for (const id of ["addProvider", "emptyAddProvider"]) {
    $(`#${id}`).addEventListener("click", () => openProviderModal());
  }
  $$("[data-close-modal]").forEach(button => button.addEventListener("click", closeProviderModal));
  $("#providerModal").addEventListener("mousedown", event => {
    if (event.target === $("#providerModal")) closeProviderModal();
  });

  $("#providerForm").addEventListener("submit", event => {
    event.preventDefault();
    saveProvider();
  });

  $("#providerForm").addEventListener("click", async event => {
    const button = event.target.closest("[data-select-field]");
    if (!button) return;
    const provider = await ensureSavedForSelection();
    if (!provider) return;
    const result = await api.showProvider(provider.id, "watch");
    if (!result.ok) return toast(result.error, true);
    const selectResult = await api.selectField(provider.id, button.dataset.selectField);
    if (!selectResult.ok) toast(selectResult.error, true);
    else toast("Açılan sayfada ilgili alanın üzerine gelip tıkla. İptal için Esc.");
  });

  $("#providerGrid").addEventListener("click", event => {
    const actionNode = event.target.closest("[data-action]");
    const card = event.target.closest("[data-provider-id]");
    if (!actionNode || !card) return;
    handleProviderAction(card.dataset.providerId, actionNode.dataset.action, actionNode);
  });
  $("#providerGrid").addEventListener("change", event => {
    const actionNode = event.target.closest('[data-action="toggle"]');
    const card = event.target.closest("[data-provider-id]");
    if (actionNode && card) handleProviderAction(card.dataset.providerId, "toggle", actionNode);
  });

  $("#importProvider").addEventListener("click", async () => {
    try {
      const result = await api.importProvider();
      if (result.ok) toast("Sağlayıcı şablonu taslak olarak eklendi.");
    } catch (error) {
      toast(error.message, true);
    }
  });

  $("#retryQueue").addEventListener("click", async () => {
    await api.retryQueue();
    toast("Bekleyen kayıtlar yeniden sıraya alındı.");
  });

  $("#saveBehavior").addEventListener("click", async () => {
    await api.saveSettings({
      autoStart: $("#autoStart").checked,
      closeToTray: $("#closeToTray").checked,
      deliveryEnabled: state.settings.deliveryEnabled,
      apiEndpoint: state.settings.apiEndpoint
    });
    toast("Windows davranışı kaydedildi.");
  });

  $("#saveDelivery").addEventListener("click", async () => {
    try {
      const token = $("#deliveryToken").value.trim();
      if (token) {
        const tokenResult = await api.saveDeliveryToken(token);
        if (!tokenResult.ok) throw new Error(tokenResult.error);
      }
      await api.saveSettings({
        autoStart: state.settings.autoStart,
        closeToTray: state.settings.closeToTray,
        deliveryEnabled: $("#deliveryEnabled").checked,
        apiEndpoint: $("#apiEndpoint").value.trim()
      });
      $("#deliveryToken").value = "";
      toast("API teslimat ayarları kaydedildi.");
    } catch (error) {
      toast(error.message, true);
    }
  });

  $("#pairingCode").addEventListener("input", event => {
    const raw = String(event.target.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    event.target.value = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
  });

  $("#pairDelivery").addEventListener("click", async () => {
    const button = $("#pairDelivery");
    const code = $("#pairingCode").value.trim();
    try {
      button.disabled = true;
      button.textContent = "Güvenli bağlantı kuruluyor…";
      const result = await api.pairAccount(code);
      if (!result.ok) throw new Error(result.error || "Hesap bağlantısı kurulamadı.");
      $("#pairingCode").value = "";
      toast(`${result.device?.name || "Bu cihaz"} Play Streamers hesabına bağlandı.`);
    } catch (error) {
      toast(error.message, true);
    } finally {
      button.disabled = false;
      renderSettings();
    }
  });

  $("#disconnectDelivery").addEventListener("click", async () => {
    if (!window.confirm("Bu bilgisayardaki Play Streamers teslimat bağlantısı kaldırılsın mı?")) return;
    await api.disconnectAccount();
    toast("Bu bilgisayardaki bağlantı kaldırıldı.");
  });

  $("#showDataFolder").addEventListener("click", () => api.showDataFolder());

  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && !$("#providerModal").hidden) closeProviderModal();
  });

  api.onState(nextState => {
    state = nextState;
    render();
  });

  api.onSelection(async result => {
    if (result.cancelled) return toast("Alan seçimi iptal edildi.");
    const provider = state.providers.find(item => item.id === result.providerId);
    if (!provider) return;
    if ($("#providerModal").hidden || editingProviderId !== provider.id) openProviderModal(provider);
    const inputName = fieldInputNames[result.field];
    if (inputName) $("#providerForm").elements[inputName].value = result.selector || "";
    const saved = await saveProvider({ keepOpen: true });
    if (saved) toast(`${result.preview || "Alan"} seçildi ve kaydedildi.`);
  });
}

async function start() {
  bindEvents();
  state = await api.getState();
  render();
}

start().catch(error => toast(error.message || String(error), true));
