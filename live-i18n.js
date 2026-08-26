const API = "https://api.pstreamers.com/api/i18n/translate";
const SUPPORTED = new Set(["tr", "en", "de", "es", "fr", "ru", "ar", "ja"]);
const SKIP_TEXT_SELECTOR = [
  "script", "style", "noscript", "code", "pre", "textarea",
  "[contenteditable]", "[data-no-translate]", ".entries", ".event-message",
  ".event-detail-message", ".name", ".message", ".support-ticket-message",
  ".ps59-chart", ".ps69-hourly-chart"
].join(",");
const SKIP_ATTRIBUTE_SELECTOR = [
  "script", "style", "noscript", "code", "pre", "[contenteditable]",
  "[data-no-translate]", ".entries", ".event-message", ".event-detail-message",
  ".name", ".message", ".support-ticket-message", ".ps59-chart", ".ps69-hourly-chart"
].join(",");

const critical = Object.freeze({
  en: { "Giriş yap": "Sign in", "Kayıt ol": "Create account", "Beni hatırla": "Remember me", "Hakkımızda": "About", "Ürünlerimiz": "Products", "Nasıl çalışır?": "How it works", "Windows için indir": "Download for Windows", "Sistem durumu": "System status", "Dil seçimi": "Language", "Her şey tek platformda.": "Everything in one platform.", "Canlı site verileri": "Live site data", "Toplam ziyaretçi": "Total visitors", "Kayıtlı hesap": "Registered accounts", "Şu anda aktif": "Active now", "Hey, geleceğin yayıncısı burada mısın?": "Hey, future streamer, are you there?", "Buradaysan ben gidiyorum.": "If you're there, I'm heading out." },
  de: { "Giriş yap": "Anmelden", "Kayıt ol": "Konto erstellen", "Beni hatırla": "Angemeldet bleiben", "Hakkımızda": "Über uns", "Ürünlerimiz": "Produkte", "Nasıl çalışır?": "So funktioniert es", "Windows için indir": "Für Windows herunterladen", "Sistem durumu": "Systemstatus", "Dil seçimi": "Sprache", "Her şey tek platformda.": "Alles auf einer Plattform.", "Canlı site verileri": "Live-Sitedaten", "Toplam ziyaretçi": "Besucher insgesamt", "Kayıtlı hesap": "Registrierte Konten", "Şu anda aktif": "Jetzt aktiv" },
  es: { "Giriş yap": "Iniciar sesión", "Kayıt ol": "Crear cuenta", "Beni hatırla": "Recordarme", "Hakkımızda": "Sobre nosotros", "Ürünlerimiz": "Productos", "Nasıl çalışır?": "Cómo funciona", "Windows için indir": "Descargar para Windows", "Sistem durumu": "Estado del sistema", "Dil seçimi": "Idioma", "Her şey tek platformda.": "Todo en una sola plataforma.", "Canlı site verileri": "Datos del sitio en vivo", "Toplam ziyaretçi": "Visitantes totales", "Kayıtlı hesap": "Cuentas registradas", "Şu anda aktif": "Activos ahora" },
  fr: { "Giriş yap": "Se connecter", "Kayıt ol": "Créer un compte", "Beni hatırla": "Se souvenir de moi", "Hakkımızda": "À propos", "Ürünlerimiz": "Produits", "Nasıl çalışır?": "Fonctionnement", "Windows için indir": "Télécharger pour Windows", "Sistem durumu": "État du système", "Dil seçimi": "Langue", "Her şey tek platformda.": "Tout sur une seule plateforme.", "Canlı site verileri": "Données du site en direct", "Toplam ziyaretçi": "Visiteurs au total", "Kayıtlı hesap": "Comptes inscrits", "Şu anda aktif": "Actifs maintenant" },
  ru: { "Giriş yap": "Войти", "Kayıt ol": "Создать аккаунт", "Beni hatırla": "Запомнить меня", "Hakkımızda": "О нас", "Ürünlerimiz": "Продукты", "Nasıl çalışır?": "Как это работает", "Windows için indir": "Скачать для Windows", "Sistem durumu": "Состояние системы", "Dil seçimi": "Язык", "Her şey tek platformda.": "Всё на одной платформе.", "Canlı site verileri": "Данные сайта в реальном времени", "Toplam ziyaretçi": "Всего посетителей", "Kayıtlı hesap": "Зарегистрированные аккаунты", "Şu anda aktif": "Сейчас активны" },
  ar: { "Giriş yap": "تسجيل الدخول", "Kayıt ol": "إنشاء حساب", "Beni hatırla": "تذكرني", "Hakkımızda": "من نحن", "Ürünlerimiz": "منتجاتنا", "Nasıl çalışır?": "كيف يعمل", "Windows için indir": "تنزيل لنظام Windows", "Sistem durumu": "حالة النظام", "Dil seçimi": "اللغة", "Her şey tek platformda.": "كل شيء في منصة واحدة.", "Canlı site verileri": "بيانات الموقع المباشرة", "Toplam ziyaretçi": "إجمالي الزوار", "Kayıtlı hesap": "الحسابات المسجلة", "Şu anda aktif": "النشطون الآن" },
  ja: { "Giriş yap": "ログイン", "Kayıt ol": "アカウント作成", "Beni hatırla": "ログイン状態を保持", "Hakkımızda": "私たちについて", "Ürünlerimiz": "製品", "Nasıl çalışır?": "仕組み", "Windows için indir": "Windows版をダウンロード", "Sistem durumu": "システム状態", "Dil seçimi": "言語", "Her şey tek platformda.": "すべてを一つのプラットフォームで。", "Canlı site verileri": "サイトのライブデータ", "Toplam ziyaretçi": "総訪問者数", "Kayıtlı hesap": "登録アカウント", "Şu anda aktif": "現在アクティブ" },
});

function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function translatable(value) {
  const text = clean(value);
  if (text.length < 2 || text.length > 240 || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(text)) return false;
  if (/^(https?:|www\.|[\w.+-]+@[\w.-]+\.|[\d\s.,:%+\-/]+$)/i.test(text)) return false;
  return true;
}
function cacheRead(key) { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; } }
function cacheWrite(key, value) {
  try {
    const entries = Object.entries(value).slice(-1200);
    localStorage.setItem(key, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* Translation remains usable without persistent cache. */ }
}

export function installLiveI18n({ localeKey = "ps15-locale", getLocale, root = document.body } = {}) {
  const selected = String(getLocale?.() || localStorage.getItem(localeKey) || "tr").toLowerCase();
  const language = SUPPORTED.has(selected) ? selected : "tr";
  document.documentElement.lang = language;
  document.documentElement.dir = "ltr";
  document.documentElement.dataset.psLiveLocale = language;
  if (language === "tr" || !root) return { language, refresh() {} };

  const cacheKey = `ps-live-i18n-v4-3:${language}`;
  const cache = { ...(critical[language] || {}), ...cacheRead(cacheKey) };
  const textState = new WeakMap();
  const attributeState = new WeakMap();
  let queued = false;
  let running = false;

  const applyText = (node, translated) => {
    const current = String(node.nodeValue || "");
    const leading = current.match(/^\s*/)?.[0] || "";
    const trailing = current.match(/\s*$/)?.[0] || "";
    node.nodeValue = `${leading}${translated}${trailing}`;
    textState.set(node, { source: clean(current), translated });
  };
  const applyAttribute = (element, name, translated, source) => {
    element.setAttribute(name, translated);
    const record = attributeState.get(element) || {};
    record[name] = { source, translated };
    attributeState.set(element, record);
  };

  const requestTranslations = async (strings, depth = 0) => {
    if (!strings.length) return [];
    try {
      const response = await fetch(API, {
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language, strings }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(result.translations) && result.translations.length === strings.length) {
        return result.translations.map(value => clean(value));
      }
      // Küçük modeller uzun JSON listelerinde zaman zaman eksik bir öğe
      // döndürebiliyor. 429 durumunda bekleriz; diğer geçersiz yanıtlarda paketi
      // kontrollü biçimde bölerek görünür metinlerin yarım kalmasını önleriz.
      if (response.status === 429 || strings.length === 1 || depth >= 3) return strings.map(() => "");
    } catch {
      if (strings.length === 1 || depth >= 3) return strings.map(() => "");
    }
    const middle = Math.ceil(strings.length / 2);
    const left = await requestTranslations(strings.slice(0, middle), depth + 1);
    const right = await requestTranslations(strings.slice(middle), depth + 1);
    return [...left, ...right];
  };

  const collect = () => {
    const targets = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP_TEXT_SELECTOR)) continue;
      const value = clean(node.nodeValue);
      const previous = textState.get(node);
      if (previous?.translated === value) continue;
      const source = previous && previous.translated !== value ? value : previous?.source || value;
      if (!translatable(source)) continue;
      targets.push({ type: "text", node, source });
    }
    root.querySelectorAll("[placeholder],[title],[aria-label],[value]").forEach(element => {
      if (element.closest(SKIP_ATTRIBUTE_SELECTOR)) return;
      ["placeholder", "title", "aria-label", "value"].forEach(name => {
        if (!element.hasAttribute(name)) return;
        if (name === "value" && !element.matches('input[type="button"],input[type="submit"],input[type="reset"]')) return;
        const value = clean(element.getAttribute(name));
        const previous = attributeState.get(element)?.[name];
        if (previous?.translated === value) return;
        const source = previous && previous.translated !== value ? value : previous?.source || value;
        if (translatable(source)) targets.push({ type: "attribute", element, name, source });
      });
    });
    const priority = target => {
      const element = target.type === "text" ? target.node.parentElement : target.element;
      if (!element) return 3;
      if (element.closest("#landingAuthModal:not([hidden]),#authOverlay .ps8-home")) return 0;
      if (element.getClientRects().length && !element.closest("[hidden]")) return 1;
      return 2;
    };
    return targets.sort((left, right) => priority(left) - priority(right));
  };

  const translate = async () => {
    if (running) { queued = true; return; }
    queued = false;
    running = true;
    try {
      const targets = collect();
      // Statik sözlükte veya önceki ziyaret önbelleğinde bulunan metinleri ağ
      // isteğini bekletmeden ilk karede uygula. Böylece büyük sayfalarda
      // görünür bölüm, arka plandaki uzun çeviri kuyruğunun arkasında kalmaz.
      targets.forEach(target => {
        const translated = cache[target.source];
        if (!translated) return;
        if (target.type === "text" && target.node.isConnected) applyText(target.node, translated);
        else if (target.type === "attribute" && target.element.isConnected) applyAttribute(target.element, target.name, translated, target.source);
      });
      const missing = [...new Set(targets.map(item => item.source).filter(source => !cache[source]))];
      // On iki öğelik paketler hem AI JSON yanıtını güvenilir tutar hem de ilk
      // ekranın çevirisini büyük bir paketin tamamlanmasını beklemeden gösterir.
      const chunks = [];
      for (let index = 0; index < missing.length; index += 12) chunks.push(missing.slice(index, index + 12));
      // Dört küçük paket paralel çalışır. Böylece ilk kez dil değiştiren kişi
      // bütün sayfanın çevrilmesi için dakikalarca beklemez; Worker'ın sınırını
      // aşmadan görünür içerik yaklaşık bir ekran yenileme süresinde tamamlanır.
      for (let groupIndex = 0; groupIndex < chunks.length; groupIndex += 4) {
        const group = chunks.slice(groupIndex, groupIndex + 4);
        const translatedGroups = await Promise.all(group.map(strings => requestTranslations(strings)));
        const groupSources = new Set(group.flat());
        group.forEach((strings, chunkIndex) => {
          const translations = translatedGroups[chunkIndex] || [];
          strings.forEach((source, itemIndex) => {
            const value = clean(translations[itemIndex]);
            if (value) cache[source] = value;
          });
        });
        cacheWrite(cacheKey, cache);
        targets.forEach(target => {
          const translated = cache[target.source];
          if (!translated || !groupSources.has(target.source)) return;
          if (target.type === "text" && target.node.isConnected) applyText(target.node, translated);
          else if (target.type === "attribute" && target.element.isConnected) applyAttribute(target.element, target.name, translated, target.source);
        });
      }
      targets.forEach(target => {
        const translated = cache[target.source];
        if (!translated) return;
        if (target.type === "text" && target.node.isConnected) applyText(target.node, translated);
        else if (target.type === "attribute" && target.element.isConnected) applyAttribute(target.element, target.name, translated, target.source);
      });
    } finally {
      running = false;
      if (queued) window.setTimeout(translate, 120);
    }
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    window.setTimeout(translate, 140);
  };
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label", "hidden"] });
  schedule();
  return { language, refresh: schedule };
}

if (typeof window !== "undefined" && document.body && !location.protocol.startsWith("chrome-extension")) {
  installLiveI18n();
}
