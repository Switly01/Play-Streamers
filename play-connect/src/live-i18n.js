const API = "https://api.pstreamers.com/api/i18n/translate";
const LANGUAGES = new Set(["tr", "en", "de", "es", "fr", "ru", "ar", "ja"]);
const records = new WeakMap();
let observer = null;
let timer = 0;
let busy = false;

function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function eligible(value) {
  const text = clean(value);
  return text.length > 1 && text.length <= 240 && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(text)
    && !/^(?:https?:|[\d\s.,:%+\-/]+$)/i.test(text);
}
function readCache(locale) { try { return JSON.parse(localStorage.getItem(`pc-i18n-v2:${locale}`) || "{}"); } catch { return {}; } }
function writeCache(locale, value) { try { localStorage.setItem(`pc-i18n-v2:${locale}`, JSON.stringify(Object.fromEntries(Object.entries(value).slice(-900)))); } catch {} }

export function installLiveI18n({ locale = localStorage.getItem("play-connect-locale") || "tr", root = document.body } = {}) {
  const selected = LANGUAGES.has(locale) ? locale : "tr";
  document.documentElement.lang = selected;
  document.documentElement.dir = "ltr";
  document.documentElement.dataset.pcLocale = selected;
  observer?.disconnect();
  if (selected === "tr" || !root) return { refresh() {} };
  const cache = readCache(selected);
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      const targets = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const host = node.parentElement;
        if (!host || host.closest("script,style,textarea,option,[contenteditable],[data-no-translate],.locale-menu")) continue;
        const value = clean(node.nodeValue);
        const record = records.get(node);
        if (record?.translated === value) continue;
        const source = record?.translated && record.translated !== value ? value : record?.source || value;
        if (eligible(source)) targets.push({ node, source });
      }
      const missing = [...new Set(targets.map(item => item.source).filter(source => !cache[source]))];
      for (let index = 0; index < missing.length; index += 45) {
        const strings = missing.slice(index, index + 45);
        try {
          const response = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: selected, strings }) });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !Array.isArray(result.translations)) continue;
          strings.forEach((source, itemIndex) => { const translated = clean(result.translations[itemIndex]); if (translated) cache[source] = translated; });
          writeCache(selected, cache);
        } catch {}
      }
      targets.forEach(({ node, source }) => {
        const translated = cache[source];
        if (!translated || !node.isConnected) return;
        const raw = String(node.nodeValue || "");
        node.nodeValue = `${raw.match(/^\s*/)?.[0] || ""}${translated}${raw.match(/\s*$/)?.[0] || ""}`;
        records.set(node, { source, translated });
      });
    } finally { busy = false; }
  };
  const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(run, 120); };
  observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  schedule();
  return { refresh: schedule };
}
