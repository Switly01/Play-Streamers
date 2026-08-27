const API = "https://api.pstreamers.com/api/i18n/translate";
const SUPPORTED = new Set(["tr", "en", "de", "es", "fr", "ru", "ar", "ja"]);
const COUNTRY_LOCALES = Object.freeze({
  TR: "tr", JP: "ja", DE: "de", AT: "de", CH: "de", LI: "de",
  FR: "fr", BE: "fr", LU: "fr", MC: "fr",
  ES: "es", MX: "es", AR: "es", CL: "es", CO: "es", PE: "es", VE: "es", UY: "es", PY: "es", BO: "es", EC: "es", CR: "es", PA: "es", GT: "es", HN: "es", SV: "es", NI: "es", DO: "es", CU: "es",
  RU: "ru", BY: "ru", KZ: "ru",
  SA: "ar", AE: "ar", QA: "ar", KW: "ar", BH: "ar", OM: "ar", YE: "ar", EG: "ar", JO: "ar", LB: "ar", IQ: "ar", SY: "ar", DZ: "ar", MA: "ar", TN: "ar", LY: "ar", SD: "ar",
});
const SKIP_TEXT_SELECTOR = [
  "script", "style", "noscript", "code", "pre", "textarea",
  "[contenteditable]", "[data-no-translate]", ".entries", ".event-message",
  ".event-detail-message", ".name", ".message", ".support-ticket-message",
  ".ps59-chart", ".ps69-hourly-chart", "#ps41LocaleMenu", "#ps15LocaleMenu",
  "[data-language]", "[data-ps15-lang]"
].join(",");
const SKIP_ATTRIBUTE_SELECTOR = [
  "script", "style", "noscript", "code", "pre", "[contenteditable]",
  "[data-no-translate]", ".entries", ".event-message", ".event-detail-message",
  ".name", ".message", ".support-ticket-message", ".ps59-chart", ".ps69-hourly-chart",
  "#ps41LocaleMenu", "#ps15LocaleMenu", "[data-language]", "[data-ps15-lang]"
].join(",");

const critical = Object.freeze({
  en: { "Giriş yap": "Sign in", "Kayıt ol": "Create account", "Beni hatırla": "Remember me", "Hakkımızda": "About", "Ürünlerimiz": "Products", "Nasıl çalışır?": "How it works", "Windows için indir": "Download for Windows", "Sistem durumu": "System status", "Dil seçimi": "Language", "Her şey tek platformda.": "Everything in one platform.", "Canlı site verileri": "Live site data", "Toplam ziyaretçi": "Total visitors", "Kayıtlı hesap": "Registered accounts", "Şu anda aktif": "Active now", "Hey, geleceğin yayıncısı burada mısın?": "Hey, future streamer, are you there?", "Buradaysan ben gidiyorum.": "If you're there, I'm heading out.", "Site hesap ve bağlantıları, masaüstü uygulaması günlük üretimi, Play Connect ise tarayıcı akışını taşır. Hepsi aynı SW Identity hesabında birleşir.": "The website handles accounts and connections, the desktop app handles daily production, and Play Connect handles the browser flow. Everything comes together under the same SW Identity account.", "Derin analiz, SW AI açıklamaları ve gelişmiş iş akışlarıyla veriyi karara çevirmek için.": "Turn data into decisions with deep analytics, SW AI explanations, and advanced workflows.", "SW Identity ile güvenli merkezini aç.": "Open your secure hub with SW Identity.", "Gizlilik": "Privacy", "Kullanım Koşulları": "Terms of Use", "Güvenli bağlantılar · Kişisel panel · Ücretsiz başlangıç": "Secure connections · Personal dashboard · Free start" },
  de: { "Giriş yap": "Anmelden", "Kayıt ol": "Konto erstellen", "Beni hatırla": "Angemeldet bleiben", "Hakkımızda": "Über uns", "Ürünlerimiz": "Produkte", "Nasıl çalışır?": "So funktioniert es", "Windows için indir": "Für Windows herunterladen", "Sistem durumu": "Systemstatus", "Dil seçimi": "Sprache", "Her şey tek platformda.": "Alles auf einer Plattform.", "Canlı site verileri": "Live-Sitedaten", "Toplam ziyaretçi": "Besucher insgesamt", "Kayıtlı hesap": "Registrierte Konten", "Şu anda aktif": "Jetzt aktiv", "Site hesap ve bağlantıları, masaüstü uygulaması günlük üretimi, Play Connect ise tarayıcı akışını taşır. Hepsi aynı SW Identity hesabında birleşir.": "Die Website verwaltet Konto und Verbindungen, die Desktop-App die tägliche Produktion und Play Connect den Browser-Ablauf. Alles läuft im selben SW Identity-Konto zusammen.", "Derin analiz, SW AI açıklamaları ve gelişmiş iş akışlarıyla veriyi karara çevirmek için.": "Verwandle Daten mit detaillierten Analysen, SW AI-Erklärungen und erweiterten Workflows in Entscheidungen.", "SW Identity ile güvenli merkezini aç.": "Öffne deine sichere Zentrale mit SW Identity.", "Gizlilik": "Datenschutz", "Kullanım Koşulları": "Nutzungsbedingungen", "Güvenli bağlantılar · Kişisel panel · Ücretsiz başlangıç": "Sichere Verbindungen · Persönliches Dashboard · Kostenloser Einstieg" },
  es: { "Giriş yap": "Iniciar sesión", "Kayıt ol": "Crear cuenta", "Beni hatırla": "Recordarme", "Hakkımızda": "Sobre nosotros", "Ürünlerimiz": "Productos", "Nasıl çalışır?": "Cómo funciona", "Windows için indir": "Descargar para Windows", "Sistem durumu": "Estado del sistema", "Dil seçimi": "Idioma", "Her şey tek platformda.": "Todo en una sola plataforma.", "Canlı site verileri": "Datos del sitio en vivo", "Toplam ziyaretçi": "Visitantes totales", "Kayıtlı hesap": "Cuentas registradas", "Şu anda aktif": "Activos ahora", "Site hesap ve bağlantıları, masaüstü uygulaması günlük üretimi, Play Connect ise tarayıcı akışını taşır. Hepsi aynı SW Identity hesabında birleşir.": "El sitio gestiona la cuenta y las conexiones, la aplicación de escritorio la producción diaria y Play Connect el flujo del navegador. Todo se reúne en la misma cuenta de SW Identity.", "Derin analiz, SW AI açıklamaları ve gelişmiş iş akışlarıyla veriyi karara çevirmek için.": "Convierte los datos en decisiones con análisis profundos, explicaciones de SW AI y flujos de trabajo avanzados.", "SW Identity ile güvenli merkezini aç.": "Abre tu centro seguro con SW Identity.", "Gizlilik": "Privacidad", "Kullanım Koşulları": "Términos de uso", "Güvenli bağlantılar · Kişisel panel · Ücretsiz başlangıç": "Conexiones seguras · Panel personal · Inicio gratuito" },
  fr: { "Giriş yap": "Se connecter", "Kayıt ol": "Créer un compte", "Beni hatırla": "Se souvenir de moi", "Hakkımızda": "À propos", "Ürünlerimiz": "Produits", "Nasıl çalışır?": "Fonctionnement", "Windows için indir": "Télécharger pour Windows", "Sistem durumu": "État du système", "Dil seçimi": "Langue", "Her şey tek platformda.": "Tout sur une seule plateforme.", "Canlı site verileri": "Données du site en direct", "Toplam ziyaretçi": "Visiteurs au total", "Kayıtlı hesap": "Comptes inscrits", "Şu anda aktif": "Actifs maintenant", "Site hesap ve bağlantıları, masaüstü uygulaması günlük üretimi, Play Connect ise tarayıcı akışını taşır. Hepsi aynı SW Identity hesabında birleşir.": "Le site gère le compte et les connexions, l’application de bureau la production quotidienne et Play Connect le flux du navigateur. Tout est réuni dans le même compte SW Identity.", "Derin analiz, SW AI açıklamaları ve gelişmiş iş akışlarıyla veriyi karara çevirmek için.": "Transformez les données en décisions grâce aux analyses approfondies, aux explications de SW AI et aux flux de travail avancés.", "SW Identity ile güvenli merkezini aç.": "Ouvrez votre espace sécurisé avec SW Identity.", "Gizlilik": "Confidentialité", "Kullanım Koşulları": "Conditions d’utilisation", "Güvenli bağlantılar · Kişisel panel · Ücretsiz başlangıç": "Connexions sécurisées · Tableau de bord personnel · Démarrage gratuit" },
  ru: { "Giriş yap": "Войти", "Kayıt ol": "Создать аккаунт", "Beni hatırla": "Запомнить меня", "Hakkımızda": "О нас", "Ürünlerimiz": "Продукты", "Nasıl çalışır?": "Как это работает", "Windows için indir": "Скачать для Windows", "Sistem durumu": "Состояние системы", "Dil seçimi": "Язык", "Her şey tek platformda.": "Всё на одной платформе.", "Canlı site verileri": "Данные сайта в реальном времени", "Toplam ziyaretçi": "Всего посетителей", "Kayıtlı hesap": "Зарегистрированные аккаунты", "Şu anda aktif": "Сейчас активны", "Site hesap ve bağlantıları, masaüstü uygulaması günlük üretimi, Play Connect ise tarayıcı akışını taşır. Hepsi aynı SW Identity hesabında birleşir.": "Сайт управляет учётной записью и подключениями, настольное приложение — ежедневной работой, а Play Connect — потоком в браузере. Всё объединено в одной учётной записи SW Identity.", "Derin analiz, SW AI açıklamaları ve gelişmiş iş akışlarıyla veriyi karara çevirmek için.": "Превращайте данные в решения с помощью глубокого анализа, пояснений SW AI и расширенных рабочих процессов.", "SW Identity ile güvenli merkezini aç.": "Откройте защищённый центр с помощью SW Identity.", "Gizlilik": "Конфиденциальность", "Kullanım Koşulları": "Условия использования", "Güvenli bağlantılar · Kişisel panel · Ücretsiz başlangıç": "Безопасные подключения · Личная панель · Бесплатный старт" },
  ar: { "Giriş yap": "تسجيل الدخول", "Kayıt ol": "إنشاء حساب", "Beni hatırla": "تذكرني", "Hakkımızda": "من نحن", "Ürünlerimiz": "منتجاتنا", "Nasıl çalışır?": "كيف يعمل", "Windows için indir": "تنزيل لنظام Windows", "Sistem durumu": "حالة النظام", "Dil seçimi": "اللغة", "Her şey tek platformda.": "كل شيء في منصة واحدة.", "Canlı site verileri": "بيانات الموقع المباشرة", "Toplam ziyaretçi": "إجمالي الزوار", "Kayıtlı hesap": "الحسابات المسجلة", "Şu anda aktif": "النشطون الآن", "Site hesap ve bağlantıları, masaüstü uygulaması günlük üretimi, Play Connect ise tarayıcı akışını taşır. Hepsi aynı SW Identity hesabında birleşir.": "يتولى الموقع إدارة الحساب والاتصالات، ويتولى تطبيق سطح المكتب الإنتاج اليومي، بينما يدير Play Connect تدفق المتصفح. يجتمع كل ذلك في حساب SW Identity نفسه.", "Derin analiz, SW AI açıklamaları ve gelişmiş iş akışlarıyla veriyi karara çevirmek için.": "حوّل البيانات إلى قرارات عبر التحليلات المتعمقة وشروحات SW AI وسير العمل المتقدم.", "SW Identity ile güvenli merkezini aç.": "افتح مركزك الآمن باستخدام SW Identity.", "Gizlilik": "الخصوصية", "Kullanım Koşulları": "شروط الاستخدام", "Güvenli bağlantılar · Kişisel panel · Ücretsiz başlangıç": "اتصالات آمنة · لوحة شخصية · بداية مجانية" },
  ja: { "Giriş yap": "ログイン", "Kayıt ol": "アカウント作成", "Beni hatırla": "ログイン状態を保持", "Hakkımızda": "私たちについて", "Ürünlerimiz": "製品", "Nasıl çalışır?": "仕組み", "Windows için indir": "Windows版をダウンロード", "Sistem durumu": "システム状態", "Dil seçimi": "言語", "Her şey tek platformda.": "すべてを一つのプラットフォームで。", "Canlı site verileri": "サイトのライブデータ", "Toplam ziyaretçi": "総訪問者数", "Kayıtlı hesap": "登録アカウント", "Şu anda aktif": "現在アクティブ", "Site hesap ve bağlantıları, masaüstü uygulaması günlük üretimi, Play Connect ise tarayıcı akışını taşır. Hepsi aynı SW Identity hesabında birleşir.": "サイトはアカウントと接続、デスクトップアプリは日々の制作、Play Connectはブラウザの流れを担います。すべて同じSW Identityアカウントに集約されます。", "Derin analiz, SW AI açıklamaları ve gelişmiş iş akışlarıyla veriyi karara çevirmek için.": "詳細な分析、SW AIの説明、高度なワークフローでデータを意思決定につなげます。", "SW Identity ile güvenli merkezini aç.": "SW Identityで安全な拠点を開きましょう。", "Gizlilik": "プライバシー", "Kullanım Koşulları": "利用規約", "Güvenli bağlantılar · Kişisel panel · Ücretsiz başlangıç": "安全な接続 · 個人用ダッシュボード · 無料で開始" },
});

Object.entries({
  en: "Dashboard", de: "Übersicht", es: "Panel", fr: "Tableau de bord",
  ru: "Панель управления", ar: "لوحة التحكم", ja: "ダッシュボード",
}).forEach(([language, translation]) => { critical[language].Dashboard = translation; });
Object.assign(critical.fr, {
  "ETKİLEŞİM": "INTERACTION",
  "TOPLULUK": "COMMUNAUTÉ",
  "MARKA ARAÇLARI": "OUTILS DE MARQUE",
  "MASAÜSTÜ UYGULAMASI": "APPLICATION DE BUREAU",
  "ÇALIŞMA ALANLARI": "ESPACES DE TRAVAIL",
});
const criticalStatus = Object.freeze({
  en: ["SW Bot completed all checks. No issues were detected.", "Last check:", "Our team is working on the issue."],
  de: ["SW Bot hat alle Prüfungen abgeschlossen. Es wurden keine Probleme erkannt.", "Letzte Prüfung:", "Unser Team arbeitet an dem Problem."],
  es: ["SW Bot completó todas las comprobaciones. No se detectaron problemas.", "Última comprobación:", "Nuestro equipo está trabajando en el problema."],
  fr: ["SW Bot a terminé toutes les vérifications. Aucun problème n’a été détecté.", "Dernière vérification :", "Notre équipe travaille sur le problème."],
  ru: ["SW Bot завершил все проверки. Проблем не обнаружено.", "Последняя проверка:", "Наша команда работает над проблемой."],
  ar: ["أكمل SW Bot جميع عمليات التحقق. لم يتم اكتشاف أي مشكلة.", "آخر تحقق:", "يعمل فريقنا على حل المشكلة."],
  ja: ["SW Bot はすべてのチェックを完了しました。問題は検出されませんでした。", "最終チェック:", "チームが問題の解決に取り組んでいます。"],
});
Object.entries(criticalStatus).forEach(([language, values]) => Object.assign(critical[language], {
  "SW Bot tüm denetimleri tamamladı. Sorun tespit edilmedi.": values[0],
  "Son kontrol:": values[1],
  "Ekibimiz sorun üzerinde çalışıyor.": values[2],
}));
const swBotFeatureCopy = Object.freeze({
  en: ["It audits the interface, connections, and live files, then turns technical issues into clear explanations.", "SYSTEM SCAN"],
  de: ["Es prüft die Oberfläche, Verbindungen und Live-Dateien und erklärt technische Probleme verständlich.", "SYSTEMSCAN"],
  es: ["Audita la interfaz, las conexiones y los archivos activos, y convierte los problemas técnicos en explicaciones claras.", "ANÁLISIS DEL SISTEMA"],
  fr: ["Il contrôle l’interface, les connexions et les fichiers en ligne, puis transforme les problèmes techniques en explications claires.", "ANALYSE DU SYSTÈME"],
  ru: ["Он проверяет интерфейс, подключения и рабочие файлы, а затем понятно объясняет технические проблемы.", "ПРОВЕРКА СИСТЕМЫ"],
  ar: ["يفحص الواجهة والاتصالات والملفات المباشرة، ثم يحوّل المشكلات التقنية إلى شروحات واضحة.", "فحص النظام"],
  ja: ["インターフェース、接続、公開ファイルを監査し、技術的な問題を分かりやすく説明します。", "システムスキャン"],
});
Object.entries(swBotFeatureCopy).forEach(([language, values]) => Object.assign(critical[language], {
  "Arayüzü, bağlantıları ve canlı dosyaları denetler; teknik sorunları anlaşılır bir Türkçe açıklamaya dönüştürür.": values[0],
  "SİSTEM TARAMASI": values[1],
}));

function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
const TURKISH_TERMS = new Set(["giriş", "kayıt", "hakkımızda", "ürünlerimiz", "nasıl", "çalışır", "içerik", "planlama", "canlı", "analiz", "topluluk", "marka", "araçları", "gelir", "görünümleri", "yayın", "yayıncı", "hesap", "şifre", "doğrula", "indir", "destek", "sistem", "durumu", "ziyaretçi", "şu", "anda", "aktif", "hemen", "başla", "keşfet", "daha", "fazla", "burada", "mısın", "beni", "hatırla"]);
function containsTurkishCopy(value) {
  const source = clean(value);
  if (/[ÇĞİÖŞÜçğıöşü]/u.test(source)) return true;
  const normalized = source.toLocaleLowerCase("tr-TR");
  return normalized.split(/[^a-zçğıöşü]+/u).some(word => TURKISH_TERMS.has(word));
}
function isPassthroughCopy(value) {
  const source = clean(value);
  return /^(?:PLAY STREAMERS|PLAY CONNECT|PLAY|STREAMERS|SW CREATE|SW IDENTITY|SW BOT|SW AI|PRODUCT PRO|FREE|PRO|PC|PS|APP|WEB|CONNECT|HTTP|HTTPS|API|OBS|KICK|WINDOWS)(?:\s*[·+:/-].*)?$/i.test(source)
    || /^(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.)/i.test(source)
    || /^[\d\s.,:%+\-/–—()]+$/.test(source);
}
function needsTranslation(value) { return !isPassthroughCopy(value); }
function translationLooksComplete(source, translated, language) {
  const output = clean(translated);
  if (!output) return false;
  if (!needsTranslation(source)) return true;
  if (clean(source).localeCompare(output, undefined, { sensitivity: "base" }) === 0) return false;
  if (containsTurkishCopy(output)) return false;
  if (language === "ar" && !/[\u0600-\u06ff]/u.test(output)) return false;
  if (language === "ru" && !/[\u0400-\u04ff]/u.test(output)) return false;
  if (language === "ja" && !/[\u3040-\u30ff\u3400-\u9fff]/u.test(output)) return false;
  return true;
}
function translatable(value) {
  const text = clean(value);
  if (isPassthroughCopy(text)) return false;
  if (text.length < 2 || text.length > 1200 || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(text)) return false;
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

function browserLocale() {
  return (navigator.languages || [navigator.language || ""])
    .map(value => String(value).toLowerCase().split("-")[0])
    .find(value => SUPPORTED.has(value)) || "en";
}

async function detectCountryLocale(current, localeKey) {
  if (localStorage.getItem("ps-locale-source") === "user" || sessionStorage.getItem("ps-country-locale-checked") === "1") return;
  sessionStorage.setItem("ps-country-locale-checked", "1");
  try {
    const response = await fetch("https://api.pstreamers.com/api/public-config", { cache: "no-store", credentials: "omit" });
    const config = await response.json().catch(() => ({}));
    const country = String(config.country || "").toUpperCase();
    const suggested = SUPPORTED.has(config.suggestedLocale) ? config.suggestedLocale : (COUNTRY_LOCALES[country] || "en");
    localStorage.setItem("ps-locale-source", "auto");
    if (suggested && suggested !== current) {
      localStorage.setItem(localeKey, suggested);
      document.documentElement.classList.add("ps-i18n-booting");
      location.reload();
    }
  } catch { /* Browser language remains the privacy-safe fallback. */ }
}

export function installLiveI18n({ localeKey = "ps15-locale", getLocale, root = document.body } = {}) {
  const stored = String(getLocale?.() || localStorage.getItem(localeKey) || "").toLowerCase();
  const language = SUPPORTED.has(stored) ? stored : browserLocale();
  if (!SUPPORTED.has(stored)) {
    localStorage.setItem(localeKey, language);
    localStorage.setItem("ps-locale-source", "auto");
  }
  document.documentElement.lang = language;
  document.documentElement.dir = "ltr";
  document.documentElement.dataset.psLiveLocale = language;
  if (language === "tr" || !root) {
    document.documentElement.classList.remove("ps-i18n-booting");
    return { language, refresh() {} };
  }

  const cacheKey = `ps-live-i18n-v8:${language}`;
  const cache = { ...cacheRead(cacheKey), ...(critical[language] || {}) };
  const textState = new WeakMap();
  const attributeState = new WeakMap();
  let queued = false;
  let running = false;
  let ready = false;
  let recoveryPasses = 0;
  let needsRecovery = false;
  let initialHold = true;
  const finishBoot = () => {
    if (ready) return;
    ready = true;
    window.clearTimeout(bootSafetyTimer);
    document.documentElement.classList.remove("ps-i18n-booting");
    document.documentElement.dataset.psI18nReady = "1";
    window.dispatchEvent(new CustomEvent("ps:i18n-ready", { detail: { language } }));
  };
  const bootSafetyTimer = window.setTimeout(finishBoot, 900);

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

  const requestTranslations = async (strings, depth = 0, retry = 0) => {
    if (!strings.length) return [];
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 22000);
    try {
      const response = await fetch(API, {
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language, strings }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const result = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(result.translations) && result.translations.length === strings.length) {
        const translated = result.translations.map(value => clean(value));
        const invalid = translated
          .map((value, index) => translationLooksComplete(strings[index], value, language) ? -1 : index)
          .filter(index => index >= 0);
        if (!invalid.length) return translated;
        if (retry < 2) {
          const repaired = await Promise.all(invalid.map(index => requestTranslations([strings[index]], depth + 1, retry + 1)));
          invalid.forEach((index, repairIndex) => { translated[index] = clean(repaired[repairIndex]?.[0]); });
        }
        return translated.map((value, index) => translationLooksComplete(strings[index], value, language) ? value : "");
      }
      // Küçük modeller uzun JSON listelerinde zaman zaman eksik bir öğe
      // döndürebiliyor. 429 durumunda bekleriz; diğer geçersiz yanıtlarda paketi
      // kontrollü biçimde bölerek görünür metinlerin yarım kalmasını önleriz.
      if (response.status === 429 && retry < 2) {
        await new Promise(resolve => window.setTimeout(resolve, 900 * (retry + 1)));
        return requestTranslations(strings, depth, retry + 1);
      }
      if (strings.length === 1 && retry < 2) {
        await new Promise(resolve => window.setTimeout(resolve, 350 * (retry + 1)));
        return requestTranslations(strings, depth + 1, retry + 1);
      }
      if (strings.length === 1 || depth >= 3) return strings.map(() => "");
    } catch {
      window.clearTimeout(timeout);
      if (strings.length === 1 && retry < 2) {
        await new Promise(resolve => window.setTimeout(resolve, 350 * (retry + 1)));
        return requestTranslations(strings, depth + 1, retry + 1);
      }
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
      if (parent.closest("template")) continue;
      const value = clean(node.nodeValue);
      const previous = textState.get(node);
      if (previous?.translated === value) continue;
      const source = previous && previous.translated !== value ? value : previous?.source || value;
      if (!translatable(source)) continue;
      targets.push({ type: "text", node, source });
    }
    root.querySelectorAll("[placeholder],[title],[aria-label],[aria-description],[alt],[data-ps-tooltip],[value]").forEach(element => {
      if (element.closest(SKIP_ATTRIBUTE_SELECTOR)) return;
      if (element.closest("template")) return;
      ["placeholder", "title", "aria-label", "aria-description", "alt", "data-ps-tooltip", "value"].forEach(name => {
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

  const applyCachedTargets = targets => targets.forEach(target => {
    const translated = cache[target.source];
    if (!translated) return;
    if (target.type === "text" && target.node.isConnected) applyText(target.node, translated);
    else if (target.type === "attribute" && target.element.isConnected) applyAttribute(target.element, target.name, translated, target.source);
  });

  const translate = async () => {
    if (running) { applyCachedTargets(collect()); queued = true; return; }
    queued = false;
    running = true;
    needsRecovery = false;
    try {
      const targets = collect();
      // Statik sözlükte veya önceki ziyaret önbelleğinde bulunan metinleri ağ
      // isteğini bekletmeden ilk karede uygula. Böylece büyük sayfalarda
      // görünür bölüm, arka plandaki uzun çeviri kuyruğunun arkasında kalmaz.
      applyCachedTargets(targets);
      const missing = [...new Set(targets.map(item => item.source).filter(source => !cache[source]))];
      // Küçük paketler hem AI JSON yanıtını güvenilir tutar hem de ilk
      // ekranın çevirisini büyük bir paketin tamamlanmasını beklemeden gösterir.
      const chunks = [];
      for (let index = 0; index < missing.length; index += 20) chunks.push(missing.slice(index, index + 20));
      // Aktif yüzeyin küçük paketleri aynı anda çevrilir. Gizli panel ve
      // pencereler açıldıkları anda ayrıca işlendiği için bu istek grubu hem
      // sınırlı kalır hem de dil değişiminden sonra ilk ekranı tek dalgada bitirir.
      if (!chunks.length) finishBoot();
      for (let groupIndex = 0; groupIndex < chunks.length; groupIndex += 4) {
        const group = chunks.slice(groupIndex, groupIndex + 4);
        await Promise.all(group.map(async strings => {
          const translations = await requestTranslations(strings);
          strings.forEach((source, itemIndex) => {
            const value = clean(translations[itemIndex]);
            if (value) cache[source] = value;
          });
          cacheWrite(cacheKey, cache);
          const chunkSources = new Set(strings);
          targets.forEach(target => {
            const translated = cache[target.source];
            if (!translated || !chunkSources.has(target.source)) return;
            if (target.type === "text" && target.node.isConnected) applyText(target.node, translated);
            else if (target.type === "attribute" && target.element.isConnected) applyAttribute(target.element, target.name, translated, target.source);
          });
        }));
        if (groupIndex === 0) finishBoot();
      }
      applyCachedTargets(targets);
      const unresolved = targets.some(target => !cache[target.source]);
      needsRecovery = unresolved;
      if (unresolved && recoveryPasses < 3) {
        recoveryPasses += 1;
        queued = true;
      } else if (!unresolved) {
        recoveryPasses = 0;
      }
    } finally {
      running = false;
      if (!needsRecovery || recoveryPasses >= 3) finishBoot();
      if (queued) window.setTimeout(translate, recoveryPasses ? 1600 : 120);
    }
  };
  const schedule = () => {
    if (initialHold) { queued = true; return; }
    if (queued) return;
    queued = true;
    window.setTimeout(translate, 140);
  };
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label", "hidden"] });
  window.setTimeout(() => {
    initialHold = false;
    queued = false;
    schedule();
  }, 80);
  return { language, refresh: schedule, dispose() { window.clearTimeout(bootSafetyTimer); } };
}

if (typeof window !== "undefined" && document.body && !location.protocol.startsWith("chrome-extension")) {
  const liveI18n = installLiveI18n();
  window.psLiveI18n = liveI18n;
  window.addEventListener("ps:i18n-refresh", () => liveI18n.refresh());
  void detectCountryLocale(liveI18n.language, "ps15-locale");
}
