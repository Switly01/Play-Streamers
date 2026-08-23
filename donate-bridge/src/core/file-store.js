"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_STATE = Object.freeze({
  version: 1,
  settings: {
    autoStart: true,
    closeToTray: true,
    apiEndpoint: "https://api.pstreamers.com/api/donate-bridge/events",
    deliveryEnabled: false,
    deviceId: "",
    deviceName: "",
    pairedAt: 0
  },
  providers: [],
  events: [],
  queue: [],
  seenEventIds: [],
  providerRuntime: {}
});

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

class FileStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = cloneDefaultState();
    this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      this.state = {
        ...cloneDefaultState(),
        ...parsed,
        settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) },
        providers: Array.isArray(parsed.providers) ? parsed.providers : [],
        events: Array.isArray(parsed.events) ? parsed.events : [],
        queue: Array.isArray(parsed.queue) ? parsed.queue : [],
        seenEventIds: Array.isArray(parsed.seenEventIds) ? parsed.seenEventIds : [],
        providerRuntime: parsed.providerRuntime && typeof parsed.providerRuntime === "object"
          ? parsed.providerRuntime
          : {}
      };
    } catch (error) {
      if (error.code !== "ENOENT") {
        const backup = `${this.filePath}.broken-${Date.now()}`;
        try {
          fs.copyFileSync(this.filePath, backup);
        } catch {
          // If backup creation fails, continue with a clean local state.
        }
      }
      this.state = cloneDefaultState();
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(this.state, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600
    });
    fs.renameSync(temporary, this.filePath);
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }

  mutate(callback) {
    callback(this.state);
    this.save();
    return this.snapshot();
  }

  addEvent(event) {
    if (this.state.seenEventIds.includes(event.eventId)) return false;
    this.mutate(state => {
      state.seenEventIds.unshift(event.eventId);
      state.seenEventIds = state.seenEventIds.slice(0, 20000);
      state.events.unshift(event);
      state.events = state.events.slice(0, 5000);
      state.queue.push({
        event,
        attempts: 0,
        nextAttemptAt: Date.now(),
        queuedAt: Date.now()
      });
      state.queue = state.queue.slice(-10000);
      state.providerRuntime[event.providerId] = {
        ...(state.providerRuntime[event.providerId] || {}),
        lastEventAt: event.observedAt,
        lastError: ""
      };
    });
    return true;
  }
}

module.exports = { DEFAULT_STATE, FileStore };
