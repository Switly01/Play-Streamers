"use strict";

const { ipcRenderer } = require("electron");

let config = null;
let observer = null;
let scanTimer = null;
const localSeen = new Set();
let selectionCleanup = null;

function safeQuery(root, selector) {
  if (!selector) return null;
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

function safeQueryAll(root, selector) {
  if (!selector) return [];
  try {
    return [...root.querySelectorAll(selector)];
  } catch {
    return [];
  }
}

function textOf(root, selector) {
  const node = selector ? safeQuery(root, selector) : null;
  return String(node?.textContent || node?.getAttribute?.("content") || "").replace(/\s+/g, " ").trim();
}

function valueOf(root, selector) {
  const node = selector ? safeQuery(root, selector) : null;
  if (!node) return "";
  return String(
    node.getAttribute?.("data-id") ||
    node.getAttribute?.("data-event-id") ||
    node.getAttribute?.("datetime") ||
    node.getAttribute?.("content") ||
    node.value ||
    node.textContent ||
    ""
  ).replace(/\s+/g, " ").trim();
}

function rawKey(raw) {
  return [
    raw.eventId,
    raw.name,
    raw.amount,
    raw.currency,
    raw.message,
    raw.time,
    raw.rawText
  ].join("\u001f");
}

function readItem(item) {
  const selectors = config.selectors || {};
  const rawText = String(item.textContent || "").replace(/\s+/g, " ").trim().slice(0, 3000);
  return {
    eventId: valueOf(item, selectors.eventId),
    name: textOf(item, selectors.name),
    amount: textOf(item, selectors.amount) || rawText,
    currency: textOf(item, selectors.currency),
    message: textOf(item, selectors.message),
    time: valueOf(item, selectors.time),
    rawText,
    sourceUrl: location.href,
    observedAt: Date.now()
  };
}

function scan() {
  if (!config?.selectors?.item) return;
  const items = safeQueryAll(document, config.selectors.item).slice(0, config.scanLimit || 150);
  for (const item of items) {
    const raw = readItem(item);
    const key = rawKey(raw);
    if (!raw.rawText || localSeen.has(key)) continue;
    localSeen.add(key);
    if (localSeen.size > 2000) {
      const oldest = localSeen.values().next().value;
      localSeen.delete(oldest);
    }
    ipcRenderer.send("provider:event", raw);
  }
}

function startObserver() {
  observer?.disconnect();
  clearInterval(scanTimer);
  if (!config?.selectors?.item) return;
  observer = new MutationObserver(() => {
    clearTimeout(startObserver.pending);
    startObserver.pending = setTimeout(scan, 120);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: config.mode === "alert"
  });
  scanTimer = setInterval(scan, 3000);
  scan();
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`);
}

function compactClasses(element) {
  return [...element.classList]
    .filter(name => name && !/active|hover|focus|selected|open|show|enter|leave|animation/i.test(name))
    .slice(0, 3);
}

function uniqueSelector(element, boundary = document) {
  if (!(element instanceof Element)) return "";
  if (element.id) {
    const byId = `#${cssEscape(element.id)}`;
    if (safeQueryAll(boundary, byId).length === 1) return byId;
  }

  const segments = [];
  let current = element;
  while (current && current !== boundary.documentElement && current !== boundary.body) {
    let segment = current.localName;
    const classes = compactClasses(current);
    if (classes.length) segment += classes.map(name => `.${cssEscape(name)}`).join("");
    const siblings = current.parentElement
      ? [...current.parentElement.children].filter(node => node.localName === current.localName)
      : [];
    if (siblings.length > 1) segment += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    segments.unshift(segment);
    const candidate = segments.join(" > ");
    if (safeQueryAll(boundary, candidate).length === 1) return candidate;
    current = current.parentElement;
  }
  return segments.join(" > ");
}

function relativeSelector(root, element) {
  if (root === element) return ":scope";
  const segments = [];
  let current = element;
  while (current && current !== root) {
    let segment = current.localName;
    const classes = compactClasses(current);
    if (classes.length) segment += classes.map(name => `.${cssEscape(name)}`).join("");
    const sameTag = current.parentElement
      ? [...current.parentElement.children].filter(node => node.localName === current.localName)
      : [];
    if (sameTag.length > 1) segment += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
    segments.unshift(segment);
    current = current.parentElement;
  }
  return current === root ? segments.join(" > ") : "";
}

function stopSelection() {
  selectionCleanup?.();
  selectionCleanup = null;
}

function beginSelection(field) {
  stopSelection();
  const style = document.createElement("style");
  style.dataset.psBridgePicker = "1";
  style.textContent = `
    .ps-bridge-picker-hover {
      outline: 3px solid #53fc18 !important;
      outline-offset: 3px !important;
      cursor: crosshair !important;
    }
  `;
  document.documentElement.append(style);
  let hovered = null;
  const onMove = event => {
    hovered?.classList.remove("ps-bridge-picker-hover");
    hovered = event.target instanceof Element ? event.target : null;
    hovered?.classList.add("ps-bridge-picker-hover");
  };
  const onClick = event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const element = event.target instanceof Element ? event.target : null;
    if (!element) return;
    let selector = "";
    if (field === "item") {
      selector = uniqueSelector(element);
    } else {
      const root = safeQuery(document, config?.selectors?.item)?.contains(element)
        ? safeQuery(document, config.selectors.item)
        : element.closest(config?.selectors?.item || "__ps_bridge_no_item__");
      selector = root ? relativeSelector(root, element) : uniqueSelector(element);
    }
    ipcRenderer.send("provider:selection-result", {
      field,
      selector,
      preview: String(element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180),
      sourceUrl: location.href
    });
    stopSelection();
  };
  const onKey = event => {
    if (event.key === "Escape") {
      ipcRenderer.send("provider:selection-result", { field, cancelled: true });
      stopSelection();
    }
  };
  document.addEventListener("mouseover", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);
  selectionCleanup = () => {
    hovered?.classList.remove("ps-bridge-picker-hover");
    style.remove();
    document.removeEventListener("mouseover", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
  };
}

ipcRenderer.on("provider:configure", (_event, nextConfig) => {
  config = nextConfig;
  localSeen.clear();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  } else {
    startObserver();
  }
});

ipcRenderer.on("provider:select-field", (_event, field) => beginSelection(field));
window.addEventListener("beforeunload", () => {
  stopSelection();
  observer?.disconnect();
  clearInterval(scanTimer);
});
