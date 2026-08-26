const API = "https://api.pstreamers.com/api/i18n/translate";
const supported = new Set(["tr", "en", "de", "es", "fr", "ru", "ar", "ja"]);

function clean(value: unknown) { return String(value || "").replace(/\s+/g, " ").trim(); }
function eligible(value: string) {
  return value.length > 1 && value.length <= 240 && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(value)
    && !/^(?:https?:|[\d\s.,:%+\-/]+$)/i.test(value);
}

export function installLiveI18n(locale: string) {
  const selected = supported.has(locale) ? locale : "tr";
  document.documentElement.lang = selected;
  document.documentElement.dir = "ltr";
  document.documentElement.dataset.liveLocale = selected;
  if (selected === "tr") return () => {};
  const cacheKey = `ps-desktop-i18n-v2:${selected}`;
  let cache: Record<string, string> = {};
  try { cache = JSON.parse(localStorage.getItem(cacheKey) || "{}"); } catch { cache = {}; }
  const state = new WeakMap<Text, { source: string; translated: string }>();
  let timer = 0;
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      const targets: Array<{ node: Text; source: string }> = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script,style,input,textarea,option,[contenteditable],.local-list,.profile-row,[data-no-translate]")) continue;
        const value = clean(node.nodeValue);
        const previous = state.get(node);
        if (previous?.translated === value) continue;
        const source = previous?.translated && previous.translated !== value ? value : previous?.source || value;
        if (eligible(source)) targets.push({ node, source });
      }
      const missing = [...new Set(targets.map(item => item.source).filter(source => !cache[source]))];
      for (let index = 0; index < missing.length; index += 45) {
        const strings = missing.slice(index, index + 45);
        try {
          const response = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: selected, strings }) });
          const result = await response.json() as { translations?: string[] };
          if (!response.ok || !Array.isArray(result.translations)) continue;
          strings.forEach((source, itemIndex) => { const translated = clean(result.translations?.[itemIndex]); if (translated) cache[source] = translated; });
          localStorage.setItem(cacheKey, JSON.stringify(Object.fromEntries(Object.entries(cache).slice(-1200))));
        } catch { /* A later mutation retries untranslated interface copy. */ }
      }
      targets.forEach(({ node, source }) => {
        const translated = cache[source];
        if (!translated || !node.isConnected) return;
        const raw = String(node.nodeValue || "");
        node.nodeValue = `${raw.match(/^\s*/)?.[0] || ""}${translated}${raw.match(/\s*$/)?.[0] || ""}`;
        state.set(node, { source, translated });
      });
    } finally { busy = false; }
  };
  const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(() => void run(), 130); };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  schedule();
  return () => { observer.disconnect(); window.clearTimeout(timer); };
}
