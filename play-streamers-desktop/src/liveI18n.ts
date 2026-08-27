const API = "https://api.pstreamers.com/api/i18n/translate";
const supported = new Set(["tr", "en", "de", "es", "fr", "ru", "ar", "ja"]);
const sourceByText = new WeakMap<Text, string>();
const sourceByAttribute = new WeakMap<Element, Record<string, string>>();

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
  if (selected === "tr") {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      const source = sourceByText.get(node);
      if (source) node.nodeValue = source;
    }
    document.body.querySelectorAll("*").forEach(element => {
      const record = sourceByAttribute.get(element);
      if (record) Object.entries(record).forEach(([name, source]) => element.setAttribute(name, source));
    });
    return () => {};
  }
  const cacheKey = `ps-desktop-i18n-v3:${selected}`;
  let cache: Record<string, string> = {};
  try { cache = JSON.parse(localStorage.getItem(cacheKey) || "{}"); } catch { cache = {}; }
  let timer = 0;
  let busy = false;
  let rerun = false;
  let recoveryPasses = 0;
  const run = async () => {
    if (busy) { rerun = true; return; }
    busy = true;
    try {
      const targets: Array<{ node: Text; source: string }> = [];
      const attributes: Array<{ element: Element; name: string; source: string }> = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script,style,input,textarea,option,[contenteditable],.local-list,.profile-row,[data-no-translate]")) continue;
        const value = clean(node.nodeValue);
        const source = sourceByText.get(node) || value;
        sourceByText.set(node, source);
        if (eligible(source)) targets.push({ node, source });
      }
      document.body.querySelectorAll("[placeholder],[title],[aria-label],[aria-description],[data-tooltip]").forEach(element => {
        if (element.closest("[data-no-translate],.profile-row")) return;
        for (const name of ["placeholder", "title", "aria-label", "aria-description", "data-tooltip"]) {
          const value = clean(element.getAttribute(name));
          if (!eligible(value)) continue;
          const record = sourceByAttribute.get(element) || {};
          record[name] ||= value;
          sourceByAttribute.set(element, record);
          attributes.push({ element, name, source: record[name] });
        }
      });
      const allSources = [...targets.map(item => item.source), ...attributes.map(item => item.source)];
      targets.forEach(({ node, source }) => {
        const translated = cache[source];
        if (!translated || !node.isConnected) return;
        const raw = String(node.nodeValue || "");
        node.nodeValue = `${raw.match(/^\s*/)?.[0] || ""}${translated}${raw.match(/\s*$/)?.[0] || ""}`;
      });
      attributes.forEach(({ element, name, source }) => { const translated = cache[source]; if (translated && element.isConnected) element.setAttribute(name, translated); });
      const missing = [...new Set(allSources.filter(source => !cache[source]))];
      const chunks: string[][] = [];
      for (let index = 0; index < missing.length; index += 16) chunks.push(missing.slice(index, index + 16));
      for (let index = 0; index < chunks.length; index += 6) {
        await Promise.all(chunks.slice(index, index + 6).map(async strings => {
          try {
            const response = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: selected, strings }) });
            const result = await response.json() as { translations?: string[] };
            if (!response.ok || !Array.isArray(result.translations) || result.translations.length !== strings.length) return;
            strings.forEach((source, itemIndex) => { const translated = clean(result.translations?.[itemIndex]); if (translated) cache[source] = translated; });
            localStorage.setItem(cacheKey, JSON.stringify(Object.fromEntries(Object.entries(cache).slice(-1600))));
          } catch { /* A later mutation retries untranslated interface copy. */ }
        }));
      }
      targets.forEach(({ node, source }) => {
        const translated = cache[source];
        if (!translated || !node.isConnected) return;
        const raw = String(node.nodeValue || "");
        node.nodeValue = `${raw.match(/^\s*/)?.[0] || ""}${translated}${raw.match(/\s*$/)?.[0] || ""}`;
      });
      attributes.forEach(({ element, name, source }) => { const translated = cache[source]; if (translated && element.isConnected) element.setAttribute(name, translated); });
      const unresolved = allSources.some(source => !cache[source]);
      if (unresolved && recoveryPasses < 3) {
        recoveryPasses += 1;
        window.setTimeout(schedule, 900 * recoveryPasses);
      } else if (!unresolved) {
        recoveryPasses = 0;
      }
    } finally { busy = false; if (rerun) { rerun = false; schedule(); } }
  };
  const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(() => void run(), 130); };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  schedule();
  return () => { observer.disconnect(); window.clearTimeout(timer); };
}
