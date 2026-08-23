"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("psBridge", {
  getState: () => ipcRenderer.invoke("state:get"),
  saveProvider: provider => ipcRenderer.invoke("provider:save", provider),
  removeProvider: id => ipcRenderer.invoke("provider:remove", id),
  toggleProvider: (id, enabled) => ipcRenderer.invoke("provider:toggle", { id, enabled }),
  showProvider: (id, purpose) => ipcRenderer.invoke("provider:show", { id, purpose }),
  hideProvider: id => ipcRenderer.invoke("provider:hide", id),
  reloadProvider: id => ipcRenderer.invoke("provider:reload", id),
  selectField: (id, field) => ipcRenderer.invoke("provider:select-field", { id, field }),
  exportProvider: id => ipcRenderer.invoke("provider:export", id),
  importProvider: () => ipcRenderer.invoke("provider:import"),
  addTestEvent: id => ipcRenderer.invoke("provider:test-event", id),
  saveSettings: settings => ipcRenderer.invoke("settings:save", settings),
  saveDeliveryToken: token => ipcRenderer.invoke("settings:token", token),
  pairAccount: code => ipcRenderer.invoke("settings:pair", code),
  disconnectAccount: () => ipcRenderer.invoke("settings:disconnect"),
  retryQueue: () => ipcRenderer.invoke("queue:retry"),
  showDataFolder: () => ipcRenderer.invoke("app:show-data-folder"),
  quit: () => ipcRenderer.invoke("app:quit"),
  onState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("state:changed", listener);
    return () => ipcRenderer.removeListener("state:changed", listener);
  },
  onSelection: callback => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on("provider:selection", listener);
    return () => ipcRenderer.removeListener("provider:selection", listener);
  }
});
