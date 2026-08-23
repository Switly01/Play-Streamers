"use strict";

const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  safeStorage,
  shell,
  Tray
} = require("electron");
const { FileStore } = require("./core/file-store");
const {
  publicProviderConfig,
  validateProviderConfig
} = require("./core/provider-config");
const { normalizeDonationEvent } = require("./core/event-normalizer");
const {
  claimPairingCode,
  deliverDonationEvent
} = require("./core/delivery-client");

const APP_VERSION = require("../package.json").version;
const providerWindows = new Map();
const providerByWebContents = new Map();
let store;
let mainWindow;
let tray;
let isQuitting = false;
let deliveryTimer;

function assetPath(fileName) {
  return path.resolve(__dirname, "..", "assets", fileName);
}

function iconImage() {
  const source = assetPath("play-streamers-ps-logo.png");
  const image = nativeImage.createFromPath(source);
  return image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 32, height: 32 });
}

function updateLoginItem(enabled) {
  const executable = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  app.setLoginItemSettings({
    openAtLogin: enabled === true,
    path: executable
  });
}

function runtimeFor(providerId) {
  return store.state.providerRuntime[providerId] || {};
}

function publicState() {
  return {
    version: APP_VERSION,
    settings: {
      autoStart: store.state.settings.autoStart !== false,
      closeToTray: store.state.settings.closeToTray !== false,
      apiEndpoint: store.state.settings.apiEndpoint,
      deliveryEnabled: store.state.settings.deliveryEnabled === true,
      hasDeliveryToken: Boolean(store.state.settings.deliveryTokenEncrypted),
      deviceId: store.state.settings.deviceId || "",
      deviceName: store.state.settings.deviceName || "",
      pairedAt: Number(store.state.settings.pairedAt || 0)
    },
    providers: store.state.providers.map(provider => ({
      ...publicProviderConfig(provider),
      runtime: {
        ...(runtimeFor(provider.id)),
        windowOpen: Boolean(providerWindows.get(provider.id) && !providerWindows.get(provider.id).isDestroyed())
      }
    })),
    events: store.state.events.slice(0, 200),
    queueCount: store.state.queue.length,
    dataFile: store.filePath
  };
}

function broadcastState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("state:changed", publicState());
  }
  updateTrayMenu();
}

function setRuntime(providerId, values) {
  store.mutate(state => {
    state.providerRuntime[providerId] = {
      ...(state.providerRuntime[providerId] || {}),
      ...values
    };
  });
  broadcastState();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 790,
    minWidth: 940,
    minHeight: 650,
    backgroundColor: "#07101c",
    icon: assetPath("play-streamers-ps-logo.png"),
    show: false,
    title: "Play Streamers Donate Bridge",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("close", event => {
    if (!isQuitting && store.state.settings.closeToTray !== false) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
  mainWindow.show();
  mainWindow.focus();
}

function updateTrayMenu() {
  if (!tray) return;
  const enabledProviders = store.state.providers.filter(provider => provider.enabled).length;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Play Streamers Donate Bridge", enabled: false },
    { label: `${enabledProviders} bağlantı izleniyor`, enabled: false },
    { label: `${store.state.queue.length} olay gönderilmeyi bekliyor`, enabled: false },
    { type: "separator" },
    { label: "Uygulamayı aç", click: showMainWindow },
    {
      label: "Bağlantıları yeniden yükle",
      click: () => {
        for (const provider of store.state.providers.filter(item => item.enabled)) {
          createOrGetProviderWindow(provider, { show: false, reload: true });
        }
      }
    },
    { type: "separator" },
    {
      label: "Tamamen kapat",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
}

function createTray() {
  tray = new Tray(iconImage());
  tray.setToolTip("Play Streamers Donate Bridge");
  tray.on("double-click", showMainWindow);
  updateTrayMenu();
}

function providerForId(id) {
  return store.state.providers.find(provider => provider.id === id) || null;
}

function isAllowedProviderPage(provider, rawUrl) {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return provider.allowedHosts.some(allowed => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function configureProviderWindow(provider, window) {
  if (window.isDestroyed()) return;
  window.webContents.send("provider:configure", publicProviderConfig(provider));
  setRuntime(provider.id, {
    status: "watching",
    currentUrl: window.webContents.getURL(),
    lastConnectedAt: Date.now(),
    lastError: ""
  });
}

function createOrGetProviderWindow(provider, options = {}) {
  let window = providerWindows.get(provider.id);
  const targetUrl = options.purpose === "login" && provider.loginUrl
    ? provider.loginUrl
    : provider.watchUrl;
  if (window && !window.isDestroyed()) {
    if (options.reload || window.webContents.getURL() !== targetUrl) window.loadURL(targetUrl);
    if (options.show) {
      window.show();
      window.focus();
    }
    return window;
  }

  window = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    show: Boolean(options.show),
    title: `${provider.name} · Play Streamers Bridge`,
    backgroundColor: "#07101c",
    icon: assetPath("play-streamers-ps-logo.png"),
    webPreferences: {
      partition: `persist:ps-donate-${provider.id}`,
      preload: path.join(__dirname, "provider-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      backgroundThrottling: false
    }
  });
  window.removeMenu();
  const webContentsId = window.webContents.id;
  providerWindows.set(provider.id, window);
  providerByWebContents.set(webContentsId, provider.id);
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          parent: window,
          autoHideMenuBar: true,
          backgroundColor: "#07101c",
          webPreferences: {
            partition: `persist:ps-donate-${provider.id}`,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true
          }
        }
      };
    }
    if (url) shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("did-finish-load", () => configureProviderWindow(provider, window));
  window.webContents.on("did-fail-load", (_event, code, description, validatedUrl, isMainFrame) => {
    if (!isMainFrame) return;
    setRuntime(provider.id, {
      status: "error",
      currentUrl: validatedUrl,
      lastError: `${description} (${code})`
    });
  });
  window.on("close", event => {
    if (!isQuitting && providerForId(provider.id)) {
      event.preventDefault();
      window.hide();
      setRuntime(provider.id, { status: provider.enabled ? "watching" : "paused" });
    }
  });
  window.on("closed", () => {
    providerWindows.delete(provider.id);
    providerByWebContents.delete(webContentsId);
    broadcastState();
  });
  window.loadURL(targetUrl);
  return window;
}

function stopProvider(id, destroy = false) {
  const window = providerWindows.get(id);
  if (!window || window.isDestroyed()) return;
  if (destroy) {
    providerWindows.delete(id);
    providerByWebContents.delete(window.webContents.id);
    window.destroy();
  } else {
    window.hide();
  }
}

function startEnabledProviders() {
  for (const provider of store.state.providers) {
    if (provider.enabled) createOrGetProviderWindow(provider, { show: false });
  }
}

function notifyDonation(event) {
  if (!Notification.isSupported()) return;
  new Notification({
    title: `${event.providerName} · Yeni donate`,
    body: `${event.donorName} · ${(event.amountMinor / 100).toLocaleString("tr-TR", {
      style: "currency",
      currency: event.currency
    })}${event.message ? `\n${event.message}` : ""}`,
    icon: assetPath("play-streamers-ps-logo.png"),
    silent: false
  }).show();
}

function encryptedToken() {
  const encoded = store.state.settings.deliveryTokenEncrypted;
  if (!encoded || !safeStorage.isEncryptionAvailable()) return "";
  try {
    return safeStorage.decryptString(Buffer.from(encoded, "base64"));
  } catch {
    return "";
  }
}

async function deliverQueue() {
  clearTimeout(deliveryTimer);
  const settings = store.state.settings;
  const token = encryptedToken();
  if (!settings.deliveryEnabled || !settings.apiEndpoint || !token || !store.state.queue.length) {
    deliveryTimer = setTimeout(deliverQueue, 15000);
    return;
  }

  const item = store.state.queue.find(candidate => candidate.nextAttemptAt <= Date.now());
  if (!item) {
    deliveryTimer = setTimeout(deliverQueue, 5000);
    return;
  }

  try {
    await deliverDonationEvent({
      endpoint: settings.apiEndpoint,
      token,
      event: item.event,
      appVersion: APP_VERSION
    });
    store.mutate(state => {
      state.queue = state.queue.filter(candidate => candidate.event.eventId !== item.event.eventId);
      state.providerRuntime[item.event.providerId] = {
        ...(state.providerRuntime[item.event.providerId] || {}),
        lastDeliveredAt: Date.now(),
        deliveryError: ""
      };
    });
  } catch (error) {
    store.mutate(state => {
      if (error.status === 401 || error.status === 403) {
        state.settings.deliveryEnabled = false;
      }
      const queued = state.queue.find(candidate => candidate.event.eventId === item.event.eventId);
      if (queued) {
        queued.attempts += 1;
        queued.nextAttemptAt = Date.now() + Math.min(15 * 60 * 1000, 5000 * 2 ** Math.min(queued.attempts, 8));
      }
      state.providerRuntime[item.event.providerId] = {
        ...(state.providerRuntime[item.event.providerId] || {}),
        deliveryError: String(error.message || error)
      };
    });
  }
  broadcastState();
  deliveryTimer = setTimeout(deliverQueue, 1000);
}

function registerIpc() {
  ipcMain.handle("state:get", () => publicState());

  ipcMain.handle("provider:save", (_event, input) => {
    const existing = providerForId(input?.id);
    const provider = validateProviderConfig(input, existing?.id || "");
    store.mutate(state => {
      const index = state.providers.findIndex(item => item.id === provider.id);
      if (index >= 0) state.providers[index] = { ...provider, createdAt: state.providers[index].createdAt };
      else state.providers.push(provider);
      state.providerRuntime[provider.id] = {
        ...(state.providerRuntime[provider.id] || {}),
        status: provider.enabled ? "starting" : "paused"
      };
    });
    stopProvider(provider.id, true);
    if (provider.enabled) createOrGetProviderWindow(provider, { show: false });
    broadcastState();
    return { ok: true, provider: publicProviderConfig(provider) };
  });

  ipcMain.handle("provider:remove", async (_event, id) => {
    const provider = providerForId(id);
    if (!provider) return { ok: false, error: "Bağlantı bulunamadı." };
    const answer = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      buttons: ["Vazgeç", "Bağlantıyı kaldır"],
      defaultId: 0,
      cancelId: 0,
      title: "Donate bağlantısını kaldır",
      message: `${provider.name} bağlantısı kaldırılsın mı?`,
      detail: "Yerel oturum bölümü uygulama verilerinde kalabilir; parola veya çerez Play Streamers sunucusuna gönderilmez."
    });
    if (answer.response !== 1) return { ok: false, cancelled: true };
    stopProvider(id, true);
    store.mutate(state => {
      state.providers = state.providers.filter(item => item.id !== id);
      delete state.providerRuntime[id];
    });
    broadcastState();
    return { ok: true };
  });

  ipcMain.handle("provider:toggle", (_event, { id, enabled }) => {
    const provider = providerForId(id);
    if (!provider) return { ok: false, error: "Bağlantı bulunamadı." };
    store.mutate(state => {
      const target = state.providers.find(item => item.id === id);
      target.enabled = Boolean(enabled);
      target.updatedAt = Date.now();
      state.providerRuntime[id] = {
        ...(state.providerRuntime[id] || {}),
        status: target.enabled ? "starting" : "paused"
      };
    });
    if (enabled) createOrGetProviderWindow(providerForId(id), { show: false, reload: true });
    else stopProvider(id, true);
    broadcastState();
    return { ok: true };
  });

  ipcMain.handle("provider:show", (_event, { id, purpose }) => {
    const provider = providerForId(id);
    if (!provider) return { ok: false, error: "Bağlantı bulunamadı." };
    createOrGetProviderWindow(provider, { show: true, purpose, reload: purpose === "login" });
    return { ok: true };
  });

  ipcMain.handle("provider:hide", (_event, id) => {
    stopProvider(id, false);
    return { ok: true };
  });

  ipcMain.handle("provider:reload", (_event, id) => {
    const provider = providerForId(id);
    if (!provider) return { ok: false, error: "Bağlantı bulunamadı." };
    createOrGetProviderWindow(provider, { show: false, reload: true });
    return { ok: true };
  });

  ipcMain.handle("provider:select-field", (_event, { id, field }) => {
    const provider = providerForId(id);
    const window = providerWindows.get(id);
    if (!provider || !window || window.isDestroyed()) {
      return { ok: false, error: "Önce takip sayfasını açmalısın." };
    }
    window.show();
    window.focus();
    if (window.webContents.isLoadingMainFrame()) {
      window.webContents.once("did-finish-load", () => {
        if (!window.isDestroyed()) window.webContents.send("provider:select-field", field);
      });
    } else {
      window.webContents.send("provider:select-field", field);
    }
    return { ok: true };
  });

  ipcMain.handle("provider:export", async (_event, id) => {
    const provider = providerForId(id);
    if (!provider) return { ok: false, error: "Bağlantı bulunamadı." };
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Sağlayıcı şablonunu dışa aktar",
      defaultPath: `${provider.name.replace(/[^\p{L}\p{N}-]+/gu, "-").toLowerCase()}-ps-provider.json`,
      filters: [{ name: "Play Streamers sağlayıcı şablonu", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) return { ok: false, cancelled: true };
    fs.writeFileSync(result.filePath, `${JSON.stringify({
      format: "play-streamers-provider",
      version: 1,
      provider: publicProviderConfig(provider)
    }, null, 2)}\n`, "utf8");
    return { ok: true };
  });

  ipcMain.handle("provider:import", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Sağlayıcı şablonu içe aktar",
      properties: ["openFile"],
      filters: [{ name: "Play Streamers sağlayıcı şablonu", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true };
    const parsed = JSON.parse(fs.readFileSync(result.filePaths[0], "utf8"));
    if (parsed.format !== "play-streamers-provider" || parsed.version !== 1) {
      throw new Error("Bu dosya desteklenen bir sağlayıcı şablonu değil.");
    }
    const provider = validateProviderConfig({ ...parsed.provider, id: "", enabled: false });
    store.mutate(state => {
      state.providers.push(provider);
      state.providerRuntime[provider.id] = { status: "paused" };
    });
    broadcastState();
    return { ok: true, provider: publicProviderConfig(provider) };
  });

  ipcMain.handle("provider:test-event", (_event, id) => {
    const provider = providerForId(id);
    if (!provider) return { ok: false, error: "Bağlantı bulunamadı." };
    const event = normalizeDonationEvent(provider, {
      eventId: `test-${Date.now()}`,
      name: "Test destekçisi",
      amount: "10,00 TRY",
      message: "Bağlantı testi",
      observedAt: Date.now(),
      sourceUrl: provider.watchUrl
    });
    store.addEvent(event);
    notifyDonation(event);
    broadcastState();
    return { ok: true };
  });

  ipcMain.handle("settings:save", (_event, input) => {
    store.mutate(state => {
      state.settings.autoStart = input.autoStart !== false;
      state.settings.closeToTray = input.closeToTray !== false;
      state.settings.deliveryEnabled = input.deliveryEnabled === true;
      if (input.apiEndpoint) {
        const url = new URL(input.apiEndpoint);
        if (url.protocol !== "https:") throw new Error("API adresi HTTPS olmalıdır.");
        state.settings.apiEndpoint = url.toString();
      }
    });
    updateLoginItem(store.state.settings.autoStart === true);
    broadcastState();
    deliverQueue();
    return { ok: true };
  });

  ipcMain.handle("settings:token", (_event, tokenInput) => {
    const token = String(tokenInput || "").trim();
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, error: "Windows güvenli depolama alanı kullanılamıyor." };
    }
    store.mutate(state => {
      state.settings.deliveryTokenEncrypted = token
        ? safeStorage.encryptString(token).toString("base64")
        : "";
    });
    broadcastState();
    deliverQueue();
    return { ok: true };
  });

  ipcMain.handle("settings:pair", async (_event, codeInput) => {
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, error: "Windows güvenli depolama alanı kullanılamıyor." };
    }
    try {
      const result = await claimPairingCode({
        code: codeInput,
        deviceName: os.hostname() || "Windows cihazı",
        appVersion: APP_VERSION
      });
      store.mutate(state => {
        state.settings.deliveryTokenEncrypted = safeStorage
          .encryptString(result.deviceToken)
          .toString("base64");
        state.settings.deliveryEnabled = true;
        state.settings.apiEndpoint = result.apiEndpoint;
        state.settings.deviceId = result.device.id;
        state.settings.deviceName = result.device.name;
        state.settings.pairedAt = Date.parse(result.device.pairedAt) || Date.now();
      });
      broadcastState();
      deliverQueue();
      return { ok: true, device: result.device };
    } catch (error) {
      return { ok: false, error: String(error.message || error) };
    }
  });

  ipcMain.handle("settings:disconnect", () => {
    store.mutate(state => {
      state.settings.deliveryTokenEncrypted = "";
      state.settings.deliveryEnabled = false;
      state.settings.deviceId = "";
      state.settings.deviceName = "";
      state.settings.pairedAt = 0;
    });
    broadcastState();
    return { ok: true };
  });

  ipcMain.handle("queue:retry", () => {
    store.mutate(state => {
      for (const item of state.queue) item.nextAttemptAt = Date.now();
    });
    deliverQueue();
    broadcastState();
    return { ok: true };
  });

  ipcMain.handle("app:show-data-folder", () => shell.showItemInFolder(store.filePath));
  ipcMain.handle("app:quit", () => {
    isQuitting = true;
    app.quit();
    return { ok: true };
  });

  ipcMain.on("provider:event", (ipcEvent, raw) => {
    const providerId = providerByWebContents.get(ipcEvent.sender.id);
    const provider = providerForId(providerId);
    if (!provider || !provider.enabled) return;
    if (!isAllowedProviderPage(provider, ipcEvent.sender.getURL())) {
      setRuntime(provider.id, {
        status: "blocked",
        lastError: "Takip sayfası izin verilen siteyle eşleşmiyor."
      });
      return;
    }
    try {
      const event = normalizeDonationEvent(provider, raw);
      if (store.addEvent(event)) {
        notifyDonation(event);
        broadcastState();
        deliverQueue();
      }
    } catch (error) {
      setRuntime(provider.id, {
        status: "warning",
        lastError: String(error.message || error),
        lastScanAt: Date.now()
      });
    }
  });

  ipcMain.on("provider:selection-result", (ipcEvent, result) => {
    const providerId = providerByWebContents.get(ipcEvent.sender.id);
    if (!providerId || !mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("provider:selection", { providerId, ...result });
    showMainWindow();
  });
}

app.whenReady().then(() => {
  store = new FileStore(path.join(app.getPath("userData"), "bridge-state.json"));
  app.setAppUserModelId("com.pstreamers.donatebridge");
  updateLoginItem(store.state.settings.autoStart === true);
  registerIpc();
  createMainWindow();
  createTray();
  startEnabledProviders();
  deliverQueue();
});

app.on("activate", showMainWindow);
app.on("window-all-closed", event => event?.preventDefault?.());
app.on("before-quit", () => {
  isQuitting = true;
  clearTimeout(deliveryTimer);
});
