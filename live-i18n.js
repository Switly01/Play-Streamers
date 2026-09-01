const SUPPORTED = new Set(["tr", "en", "de", "es", "fr", "ru", "ar", "ja"]);
const CATALOG_VERSION = "2026-09-01.2";
const catalogPromises = new Map();
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
  ".ps59-chart", ".ps69-hourly-chart",
  "[data-language]", "[data-ps15-lang]"
].join(",");
const SKIP_ATTRIBUTE_SELECTOR = [
  "script", "style", "noscript", "code", "pre", "[contenteditable]",
  "[data-no-translate]", ".entries", ".event-message", ".event-detail-message",
  ".name", ".message", ".support-ticket-message", ".ps59-chart", ".ps69-hourly-chart",
  "[data-language]", "[data-ps15-lang]"
].join(",");

export const critical = Object.freeze({
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
Object.entries({
  en: ["LANGUAGE", "2h 48m"], de: ["SPRACHE", "2 Std. 48 Min."],
  es: ["IDIOMA", "2 h 48 min"], fr: ["LANGUE", "2 h 48 min"],
  ru: ["ЯЗЫК", "2 ч 48 мин"], ar: ["اللغة", "ساعتان و48 دقيقة"],
  ja: ["言語", "2時間48分"],
}).forEach(([language, values]) => Object.assign(critical[language], {
  "DİL SEÇİMİ": values[0],
  "2s 48dk": values[1],
}));
Object.entries({
  en: "Play Streamers — Creator Hub", de: "Play Streamers — Creator-Zentrale",
  es: "Play Streamers — Centro para streamers", fr: "Play Streamers — Espace créateur",
  ru: "Play Streamers — Центр стримера", ar: "Play Streamers — مركز صنّاع المحتوى",
  ja: "Play Streamers — クリエイターハブ",
}).forEach(([language, translation]) => {
  critical[language]["Play Streamers — Yayıncı Merkezi"] = translation;
});
Object.assign(critical.en, {
  "Profesyonel Yayıncı Kontrol Platformu": "Professional Creator Control Platform",
  "Canlı analiz · İçerik planlama · Topluluk · Marka · Play Connect": "Live analytics · Content planning · Community · Brand · Play Connect",
  "Analiz, içerik, topluluk ve daha fazlası — yayınını yönetmek için ihtiyacın olan araçlar tek sade uygulamada.": "Analytics, content, community, and more — everything you need to run your stream in one focused app.",
  "SON YAYIN": "LAST STREAM",
  "Ortalama 184 izleyici": "184 average viewers",
  "Önceki yayına göre": "Compared with your previous stream",
  "Sunucu tabanlı yayın geçmişi": "Server-side stream history",
  "Ham sayılar yerine değişimin ne anlama geldiğini gösteren okunabilir yayın özetleri.": "Clear stream summaries that explain the change, not just the raw numbers.",
  "Yayın bittikten sonra da çalışan sistem.": "A system that keeps working after the stream ends.",
  "Yayına başlamak, temel verilerini görmek ve günlük üretim düzenini kurmak için.": "Start streaming, see your core data, and build your daily production routine.",
  "Yayın sırasındaki tüm önemli hareketler tek bir akışta düzenlenir.": "Every important moment during a stream is organized into one timeline.",
  "Yayınını değil,": "Don't just grow your stream,",
  "sistemini büyüt.": "grow your system.",
  "Yayın akışı": "Stream timeline",
  "Yayın kapalı": "Stream offline",
  "Yayın senin.": "Your stream, your way.",
  "Yayın durumu hazırlanıyor": "Preparing stream status",
  "Doğrudan kurulum dosyası Windows yayınevi imzası tamamlanana kadar SmartScreen uyarısı gösterebilir.": "The direct installer may trigger a SmartScreen warning until Windows publisher signing is complete.",
  "Play Streamers, dağınık yayın araçlarını çoğaltmak yerine veriyi, üretimi ve hesap yönetimini tek anlaşılır düzende birleştirir.": "Play Streamers brings stream data, production, and account management into one clear system instead of adding more scattered tools.",
  "Play Streamers; yayın verilerini toplama ve görüntüleme, hesap ve bağlantı yönetimi, içerik ve topluluk araçları, masaüstü çalışma alanları ve desteklenen platformlarla entegrasyon sunar. Bazı özellikler plana, platform izinlerine, işletim sistemine veya üçüncü taraf hizmetlerin kullanılabilirliğine bağlı olabilir.": "Play Streamers provides stream data collection and viewing, account and connection management, content and community tools, desktop workspaces, and integrations with supported platforms. Some features may depend on your plan, platform permissions, operating system, or third-party availability.",
  "Bu koşullar; Play Streamers web sitesi, masaüstü uygulaması, Play Connect eklentisi ve bunlara bağlı hesap, analiz ve bağlantı hizmetlerinin kullanım kurallarını açıklar.": "These terms explain the rules for using the Play Streamers website, desktop app, Play Connect extension, and their related account, analytics, and connection services.",
  "Hizmet ve analizler mevcut haliyle sunulur. Yürürlükteki hukukun izin verdiği ölçüde; yayın geliri, izleyici artışı, platform kararı, veri kaybı veya üçüncü taraf kesintisi konusunda garanti verilmez. Bu hüküm, kanunen sınırlandırılamayan tüketici haklarını ortadan kaldırmaz.": "Services and analytics are provided as available. To the extent permitted by law, we do not guarantee stream revenue, audience growth, platform decisions, freedom from data loss, or uninterrupted third-party services. This does not limit consumer rights that cannot legally be restricted.",
});
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
const systemStatusCopy = Object.freeze({
  en: ["System normal", "No technical issues detected. Login, registration, dashboard, and connection flows are being monitored.", "Refresh scan", "Interface audit", "System under observation", "SW Bot regularly monitors the user area, Dashboard, menus, and data connections in the background."],
  de: ["System normal", "Keine technischen Probleme erkannt. Anmeldung, Registrierung, Übersicht und Verbindungen werden überwacht.", "Prüfung aktualisieren", "Oberflächenprüfung", "System wird überwacht", "SW Bot überwacht den Benutzerbereich, die Übersicht, Menüs und Datenverbindungen regelmäßig im Hintergrund."],
  es: ["Sistema normal", "No se detectaron problemas técnicos. Se supervisan el inicio de sesión, el registro, el panel y las conexiones.", "Actualizar análisis", "Auditoría de interfaz", "Sistema en observación", "SW Bot supervisa periódicamente en segundo plano el área de usuario, el panel, los menús y las conexiones de datos."],
  fr: ["Système normal", "Aucun problème technique détecté. Les flux de connexion, d’inscription, de tableau de bord et de liaison sont surveillés.", "Actualiser l’analyse", "Audit de l’interface", "Système sous surveillance", "SW Bot surveille régulièrement en arrière-plan l’espace utilisateur, le tableau de bord, les menus et les connexions de données."],
  ru: ["Система работает нормально", "Технических проблем не обнаружено. Вход, регистрация, панель управления и подключения находятся под наблюдением.", "Обновить проверку", "Проверка интерфейса", "Система под наблюдением", "SW Bot регулярно проверяет в фоновом режиме пользовательскую область, панель управления, меню и подключения к данным."],
  ar: ["النظام يعمل بصورة طبيعية", "لم يتم اكتشاف مشكلات تقنية. تتم مراقبة تسجيل الدخول والتسجيل ولوحة التحكم ومسارات الاتصال.", "تحديث الفحص", "تدقيق الواجهة", "النظام قيد المراقبة", "يراقب SW Bot بانتظام منطقة المستخدم ولوحة التحكم والقوائم واتصالات البيانات في الخلفية."],
  ja: ["システムは正常です", "技術的な問題は検出されていません。ログイン、登録、ダッシュボード、接続フローを監視しています。", "スキャンを更新", "インターフェース監査", "システム監視中", "SW Bot はユーザー領域、ダッシュボード、メニュー、データ接続をバックグラウンドで定期的に監視します。"],
});
Object.entries(systemStatusCopy).forEach(([language, values]) => Object.assign(critical[language], {
  "Sistem normal": values[0],
  "Teknik sorun görünmüyor. Giriş, kayıt, panel ve bağlantı akışları denetleniyor.": values[1],
  "Taramayı yenile": values[2],
  "Arayüz denetimi": values[3],
  "Sistem gözlemde": values[4],
  "SW Bot; kullanıcı alanını, Dashboard’u, menüleri ve veri bağlantılarını arka planda düzenli olarak denetliyor.": values[5],
}));

const criticalLongFormCopy = Object.freeze({
  en: ["Built for streamers,", "a system that keeps working after the stream ends.", "Important activity during a livestream is tracked on the server, so your history, averages, and changes are ready when you return.", "Play Streamers desktop app preview", "Privacy summary", "Terms summary"],
  de: ["Für Streamer entwickelt,", "ein System, das nach dem Stream weiterarbeitet.", "Wichtige Aktivitäten während eines Streams werden auf dem Server erfasst, damit Verlauf, Durchschnittswerte und Veränderungen bei deiner Rückkehr bereitstehen.", "Vorschau der Play Streamers Desktop-App", "Datenschutzübersicht", "Zusammenfassung der Bedingungen"],
  es: ["Creado para streamers,", "un sistema que sigue funcionando cuando termina la transmisión.", "La actividad importante durante una transmisión se registra en el servidor para que tu historial, promedios y cambios estén listos cuando regreses.", "Vista previa de la aplicación de escritorio Play Streamers", "Resumen de privacidad", "Resumen de condiciones"],
  fr: ["Conçu pour les streamers,", "un système qui continue de fonctionner après la fin du direct.", "Les activités importantes pendant un direct sont suivies sur le serveur afin que votre historique, vos moyennes et vos évolutions soient prêts à votre retour.", "Aperçu de l’application de bureau Play Streamers", "Résumé de confidentialité", "Résumé des conditions"],
  ru: ["Создано для стримеров,", "система, которая продолжает работать после завершения трансляции.", "Важные события во время трансляции отслеживаются на сервере, поэтому история, средние показатели и изменения будут готовы к вашему возвращению.", "Предпросмотр настольного приложения Play Streamers", "Кратко о конфиденциальности", "Кратко об условиях"],
  ar: ["مصمم لصنّاع البث،", "نظام يواصل العمل بعد انتهاء البث.", "تُتابَع الأنشطة المهمة أثناء البث على الخادم، لتكون السجلات والمتوسطات والتغييرات جاهزة عند عودتك.", "معاينة تطبيق Play Streamers لسطح المكتب", "ملخص الخصوصية", "ملخص الشروط"],
  ja: ["配信者のために作られた、", "配信終了後も動き続けるシステム。", "配信中の重要な動きはサーバーで記録されるため、戻ったときには履歴、平均値、変化が確認できます。", "Play Streamers デスクトップアプリのプレビュー", "プライバシーの概要", "利用条件の概要"],
});
const criticalLongFormSources = [
  "Yayıncı için çalışan,",
  "yayın bitince durmayan sistem.",
  "Yayın açıkken oluşan önemli hareketler sunucuda izlenir; daha sonra geri döndüğünde geçmişin, ortalaman ve değişimin hazır olur.",
  "Play Streamers masaüstü uygulaması ön izlemesi",
  "Gizlilik özeti",
  "Koşullar özeti",
];
Object.entries(criticalLongFormCopy).forEach(([language, values]) => {
  criticalLongFormSources.forEach((source, index) => { critical[language][source] = values[index]; });
});

const criticalAccountCopy = Object.freeze({
  en: ["Sign in to your account","Create your SW account","Username or email","Username","Password","Repeat password","Date of birth","Choose date","Security verification is being prepared…","Security verification is ready","or","Continue with Google","Continue with Kick","Support","Email address","Subject","Message","Send","Privacy Policy","Terms of Use"],
  de: ["Bei deinem Konto anmelden","SW-Konto erstellen","Benutzername oder E-Mail","Benutzername","Passwort","Passwort wiederholen","Geburtsdatum","Datum auswählen","Sicherheitsprüfung wird vorbereitet…","Sicherheitsprüfung ist bereit","oder","Mit Google fortfahren","Mit Kick fortfahren","Support","E-Mail-Adresse","Betreff","Nachricht","Senden","Datenschutzerklärung","Nutzungsbedingungen"],
  es: ["Inicia sesión en tu cuenta","Crea tu cuenta SW","Usuario o correo electrónico","Nombre de usuario","Contraseña","Repetir contraseña","Fecha de nacimiento","Elegir fecha","Preparando la verificación de seguridad…","La verificación de seguridad está lista","o","Continuar con Google","Continuar con Kick","Soporte","Correo electrónico","Asunto","Mensaje","Enviar","Política de privacidad","Términos de uso"],
  fr: ["Connectez-vous à votre compte","Créez votre compte SW","Nom d’utilisateur ou e-mail","Nom d’utilisateur","Mot de passe","Répéter le mot de passe","Date de naissance","Choisir une date","Préparation de la vérification de sécurité…","La vérification de sécurité est prête","ou","Continuer avec Google","Continuer avec Kick","Assistance","Adresse e-mail","Objet","Message","Envoyer","Politique de confidentialité","Conditions d’utilisation"],
  ru: ["Войдите в аккаунт","Создайте аккаунт SW","Имя пользователя или эл. почта","Имя пользователя","Пароль","Повторите пароль","Дата рождения","Выберите дату","Подготовка проверки безопасности…","Проверка безопасности готова","или","Продолжить с Google","Продолжить с Kick","Поддержка","Адрес электронной почты","Тема","Сообщение","Отправить","Политика конфиденциальности","Условия использования"],
  ar: ["سجّل الدخول إلى حسابك","أنشئ حساب SW","اسم المستخدم أو البريد الإلكتروني","اسم المستخدم","كلمة المرور","تكرار كلمة المرور","تاريخ الميلاد","اختر التاريخ","جارٍ إعداد التحقق الأمني…","التحقق الأمني جاهز","أو","المتابعة باستخدام Google","المتابعة باستخدام Kick","الدعم","عنوان البريد الإلكتروني","الموضوع","الرسالة","إرسال","سياسة الخصوصية","شروط الاستخدام"],
  ja: ["アカウントにログイン","SWアカウントを作成","ユーザー名またはメール","ユーザー名","パスワード","パスワードを再入力","生年月日","日付を選択","セキュリティ確認を準備中…","セキュリティ確認の準備完了","または","Googleで続行","Kickで続行","サポート","メールアドレス","件名","メッセージ","送信","プライバシーポリシー","利用規約"],
});
const criticalAccountSources = ["Hesabına giriş yap","SW hesabını oluştur","Kullanıcı adı veya e-posta","Kullanıcı adı","Şifre","Şifre tekrar","Doğum tarihi","Tarih seç","Güvenlik doğrulaması hazırlanıyor…","Güvenlik doğrulaması hazır","veya","Google ile devam et","Kick ile devam et","Destek","E-posta adresi","Konu","Mesaj","Gönder","Gizlilik Politikası","Kullanım Koşulları"];
Object.entries(criticalAccountCopy).forEach(([language, values]) => {
  criticalAccountSources.forEach((source, index) => { critical[language][source] = values[index]; });
  critical[language]["Gizlilik Politikası · Play Streamers"] = `${values[18]} · Play Streamers`;
  critical[language]["Kullanım Koşulları · Play Streamers"] = `${values[19]} · Play Streamers`;
});

const criticalMemberSources = [
  "ÇALIŞMA MERKEZİ", "Yayın araçların hazır.", "Canlı akışı ve topluluk hareketlerini tek ekranda izlemek için Dashboard’u aç.",
  "Dashboard’u aç", "Bağlantılarını üst menüdeki durum düğmesinden kontrol edebilirsin.", "BİLDİRİMLER", "Her şey güncel",
  "Yeni bildirimin yok.", "Bildirimleri kapat", "BAĞLANTI DURUMU", "Henüz bağlantı kurulmadı", "MENÜ",
  "GÜNCELLEME NOTLARI", "Tüm güncellemeler", "En yeni sürümden başlayarak bütün yayın notlarını aşağı kaydırarak inceleyebilirsin.",
  "SON SÜRÜM", "HESAP MERKEZİ · VERİLER", "Hesap özeti", "Bağlı Kick profilini ve işlenen kanal hareketlerini tek bakışta gör.",
  "SW IDENTITY · PROFİL", "Merkezi SW profilin", "SW IDENTITY · GÜVENLİK", "E-posta, şifre ve güvenlik",
  "HESAP MERKEZİ · CİHAZLAR", "Oturum açılan cihazlar", "HESAP MERKEZİ · BAĞLANTILAR", "Yayın bağlantıları",
  "HESAP MERKEZİ · DESTEK TALEPLERİ", "Destek konuşmaların", "Dosyayı kaldır",
  "Mesajın destek ekibimize ulaştı. Yanıtı e-posta kutundan kontrol edebilirsin."
];
const criticalMemberCopy = Object.freeze({
  en: ["WORKSPACE", "Your streaming tools are ready.", "Open the Dashboard to monitor the live feed and community activity on one screen.", "Open Dashboard", "Check your connections from the status button in the top menu.", "NOTIFICATIONS", "Everything is up to date", "You have no new notifications.", "Close notifications", "CONNECTION STATUS", "No connection has been established yet", "MENU", "UPDATE NOTES", "All updates", "Browse every release note from newest to oldest by scrolling down.", "LATEST RELEASE", "ACCOUNT CENTER · DATA", "Account overview", "See your connected Kick profile and processed channel activity at a glance.", "SW IDENTITY · PROFILE", "Your central SW profile", "SW IDENTITY · SECURITY", "Email, password and security", "ACCOUNT CENTER · DEVICES", "Signed-in devices", "ACCOUNT CENTER · CONNECTIONS", "Streaming connections", "ACCOUNT CENTER · SUPPORT REQUESTS", "Your support conversations", "Remove file", "Your message reached our support team. Check your email inbox for the reply."],
  de: ["ARBEITSBEREICH", "Deine Streaming-Tools sind bereit.", "Öffne das Dashboard, um Live-Feed und Community-Aktivitäten auf einem Bildschirm zu verfolgen.", "Dashboard öffnen", "Prüfe deine Verbindungen über die Statusschaltfläche im oberen Menü.", "BENACHRICHTIGUNGEN", "Alles ist aktuell", "Du hast keine neuen Benachrichtigungen.", "Benachrichtigungen schließen", "VERBINDUNGSSTATUS", "Noch keine Verbindung hergestellt", "MENÜ", "AKTUALISIERUNGSHINWEISE", "Alle Aktualisierungen", "Scrolle nach unten, um alle Versionshinweise von neu nach alt anzusehen.", "NEUESTE VERSION", "KONTOCENTER · DATEN", "Kontoübersicht", "Sieh dein verbundenes Kick-Profil und verarbeitete Kanalaktivitäten auf einen Blick.", "SW IDENTITY · PROFIL", "Dein zentrales SW-Profil", "SW IDENTITY · SICHERHEIT", "E-Mail, Passwort und Sicherheit", "KONTOCENTER · GERÄTE", "Angemeldete Geräte", "KONTOCENTER · VERBINDUNGEN", "Streaming-Verbindungen", "KONTOCENTER · SUPPORTANFRAGEN", "Deine Support-Unterhaltungen", "Datei entfernen", "Deine Nachricht hat unser Support-Team erreicht. Prüfe dein E-Mail-Postfach auf die Antwort."],
  es: ["ESPACIO DE TRABAJO", "Tus herramientas de streaming están listas.", "Abre el panel para supervisar la actividad en directo y de la comunidad en una sola pantalla.", "Abrir panel", "Comprueba tus conexiones con el botón de estado del menú superior.", "NOTIFICACIONES", "Todo está actualizado", "No tienes notificaciones nuevas.", "Cerrar notificaciones", "ESTADO DE CONEXIÓN", "Todavía no se ha establecido ninguna conexión", "MENÚ", "NOTAS DE ACTUALIZACIÓN", "Todas las actualizaciones", "Desplázate para consultar todas las notas de versión, desde la más reciente.", "ÚLTIMA VERSIÓN", "CENTRO DE CUENTA · DATOS", "Resumen de la cuenta", "Consulta de un vistazo tu perfil de Kick conectado y la actividad procesada del canal.", "SW IDENTITY · PERFIL", "Tu perfil central de SW", "SW IDENTITY · SEGURIDAD", "Correo, contraseña y seguridad", "CENTRO DE CUENTA · DISPOSITIVOS", "Dispositivos con sesión iniciada", "CENTRO DE CUENTA · CONEXIONES", "Conexiones de streaming", "CENTRO DE CUENTA · SOLICITUDES DE SOPORTE", "Tus conversaciones de soporte", "Quitar archivo", "Tu mensaje llegó a nuestro equipo de soporte. Revisa tu bandeja de entrada para ver la respuesta."],
  fr: ["ESPACE DE TRAVAIL", "Vos outils de streaming sont prêts.", "Ouvrez le tableau de bord pour suivre le direct et l’activité de la communauté sur un seul écran.", "Ouvrir le tableau de bord", "Vérifiez vos connexions avec le bouton d’état du menu supérieur.", "NOTIFICATIONS", "Tout est à jour", "Vous n’avez aucune nouvelle notification.", "Fermer les notifications", "ÉTAT DES CONNEXIONS", "Aucune connexion n’a encore été établie", "MENU", "NOTES DE MISE À JOUR", "Toutes les mises à jour", "Faites défiler pour consulter toutes les notes de version, de la plus récente à la plus ancienne.", "DERNIÈRE VERSION", "CENTRE DE COMPTE · DONNÉES", "Aperçu du compte", "Consultez en un coup d’œil votre profil Kick connecté et l’activité traitée de la chaîne.", "SW IDENTITY · PROFIL", "Votre profil SW central", "SW IDENTITY · SÉCURITÉ", "E-mail, mot de passe et sécurité", "CENTRE DE COMPTE · APPAREILS", "Appareils connectés", "CENTRE DE COMPTE · CONNEXIONS", "Connexions de streaming", "CENTRE DE COMPTE · DEMANDES D’ASSISTANCE", "Vos conversations avec l’assistance", "Retirer le fichier", "Votre message est parvenu à notre équipe d’assistance. Consultez votre boîte mail pour la réponse."],
  ru: ["РАБОЧАЯ ОБЛАСТЬ", "Инструменты для трансляции готовы.", "Откройте панель, чтобы видеть прямой эфир и активность сообщества на одном экране.", "Открыть панель", "Проверяйте подключения кнопкой состояния в верхнем меню.", "УВЕДОМЛЕНИЯ", "Всё актуально", "Новых уведомлений нет.", "Закрыть уведомления", "СОСТОЯНИЕ ПОДКЛЮЧЕНИЙ", "Подключения пока нет", "МЕНЮ", "ПРИМЕЧАНИЯ К ОБНОВЛЕНИЯМ", "Все обновления", "Прокрутите вниз, чтобы просмотреть все примечания к выпускам от новых к старым.", "ПОСЛЕДНЯЯ ВЕРСИЯ", "ЦЕНТР АККАУНТА · ДАННЫЕ", "Обзор аккаунта", "Просматривайте подключённый профиль Kick и обработанную активность канала одним взглядом.", "SW IDENTITY · ПРОФИЛЬ", "Ваш единый профиль SW", "SW IDENTITY · БЕЗОПАСНОСТЬ", "Почта, пароль и безопасность", "ЦЕНТР АККАУНТА · УСТРОЙСТВА", "Устройства с активным входом", "ЦЕНТР АККАУНТА · ПОДКЛЮЧЕНИЯ", "Подключения трансляции", "ЦЕНТР АККАУНТА · ОБРАЩЕНИЯ В ПОДДЕРЖКУ", "Ваши обращения в поддержку", "Удалить файл", "Сообщение доставлено нашей службе поддержки. Проверьте почту, чтобы увидеть ответ."],
  ar: ["مساحة العمل", "أدوات البث جاهزة.", "افتح لوحة التحكم لمتابعة البث المباشر ونشاط المجتمع في شاشة واحدة.", "فتح لوحة التحكم", "تحقق من اتصالاتك عبر زر الحالة في القائمة العلوية.", "الإشعارات", "كل شيء محدّث", "لا توجد إشعارات جديدة.", "إغلاق الإشعارات", "حالة الاتصال", "لم يتم إنشاء أي اتصال بعد", "القائمة", "ملاحظات التحديث", "كل التحديثات", "مرّر لعرض جميع ملاحظات الإصدارات من الأحدث إلى الأقدم.", "أحدث إصدار", "مركز الحساب · البيانات", "ملخص الحساب", "اعرض ملف Kick المتصل ونشاط القناة المعالج بنظرة واحدة.", "SW IDENTITY · الملف الشخصي", "ملفك المركزي في SW", "SW IDENTITY · الأمان", "البريد الإلكتروني وكلمة المرور والأمان", "مركز الحساب · الأجهزة", "الأجهزة المسجّل دخولها", "مركز الحساب · الاتصالات", "اتصالات البث", "مركز الحساب · طلبات الدعم", "محادثات الدعم", "إزالة الملف", "وصلت رسالتك إلى فريق الدعم. تحقق من صندوق بريدك الإلكتروني للاطلاع على الرد."],
  ja: ["ワークスペース", "配信ツールの準備ができました。", "ダッシュボードを開くと、ライブフィードとコミュニティの動きを1画面で確認できます。", "ダッシュボードを開く", "上部メニューのステータスボタンから接続を確認できます。", "通知", "すべて最新です", "新しい通知はありません。", "通知を閉じる", "接続状況", "まだ接続されていません", "メニュー", "更新履歴", "すべての更新", "下にスクロールして、新しいものからすべてのリリースノートを確認できます。", "最新リリース", "アカウントセンター · データ", "アカウント概要", "接続済みのKickプロフィールと処理されたチャンネルの動きを一目で確認できます。", "SW IDENTITY · プロフィール", "共通SWプロフィール", "SW IDENTITY · セキュリティ", "メール、パスワード、セキュリティ", "アカウントセンター · デバイス", "ログイン中のデバイス", "アカウントセンター · 接続", "配信接続", "アカウントセンター · サポート依頼", "サポートでのやり取り", "ファイルを削除", "メッセージがサポートチームに届きました。返信はメールの受信箱で確認してください。"]
});
Object.entries(criticalMemberCopy).forEach(([language, values]) => {
  criticalMemberSources.forEach((source, index) => { critical[language][source] = values[index]; });
});

const criticalRuntimeActionSources = ["Doğrula", "İptal et", "Kurlar hazırlanıyor", "Votre demande d’assistance a reçu une réponse"];
const criticalRuntimeActionCopy = Object.freeze({
  en: ["Verify", "Cancel", "Preparing exchange rates", "Your support request received a reply"],
  de: ["Bestätigen", "Abbrechen", "Wechselkurse werden vorbereitet", "Deine Supportanfrage wurde beantwortet"],
  es: ["Verificar", "Cancelar", "Preparando tipos de cambio", "Tu solicitud de soporte fue respondida"],
  fr: ["Vérifier", "Annuler", "Préparation des taux de change", "Une réponse a été apportée à votre demande d’assistance"],
  ru: ["Подтвердить", "Отмена", "Подготовка курсов валют", "Получен ответ на ваше обращение"],
  ar: ["تحقق", "إلغاء", "جارٍ إعداد أسعار الصرف", "تم الرد على طلب الدعم"],
  ja: ["確認", "キャンセル", "為替レートを準備中", "サポート依頼に返信がありました"],
});
Object.entries(criticalRuntimeActionCopy).forEach(([language, values]) => {
  criticalRuntimeActionSources.forEach((source, index) => { critical[language][source] = values[index]; });
});

const criticalVerificationSources = [
  "Güvenlik doğrulaması", "Güvenlik doğrulaması yüklenemedi.", "Doğrulamayı yeniden dene",
  "Güvenlik doğrulaması tamamlanamadı. Aşağıdaki kontrolü yeniden yapıp tekrar dene.",
  "Güvenlik kontrolü yüklenemedi.", "Güvenlik doğrulaması hazırlanamadı.",
  "Güvenlik doğrulaması henüz hazır değil. Lütfen birkaç saniye sonra tekrar dene.",
  "Devam eden bir güvenlik doğrulaması var. Lütfen bekle.", "Güvenlik doğrulamasının süresi doldu.",
  "En fazla 10 dosya · Dosya başına 10 MB · Toplam 25 MB",
];
const criticalVerificationCopy = Object.freeze({
  en: ["Security verification", "Security verification could not be loaded.", "Retry verification", "Security verification could not be completed. Complete the check below and try again.", "Security check could not be loaded.", "Security verification could not be prepared.", "Security verification is not ready yet. Wait a few seconds and try again.", "A security verification is already in progress. Please wait.", "Security verification expired.", "Up to 10 files · 10 MB per file · 25 MB total"],
  de: ["Sicherheitsprüfung", "Die Sicherheitsprüfung konnte nicht geladen werden.", "Prüfung erneut versuchen", "Die Sicherheitsprüfung konnte nicht abgeschlossen werden. Führe die Prüfung unten erneut aus und versuche es noch einmal.", "Die Sicherheitskontrolle konnte nicht geladen werden.", "Die Sicherheitsprüfung konnte nicht vorbereitet werden.", "Die Sicherheitsprüfung ist noch nicht bereit. Warte einige Sekunden und versuche es erneut.", "Eine Sicherheitsprüfung läuft bereits. Bitte warte.", "Die Sicherheitsprüfung ist abgelaufen.", "Bis zu 10 Dateien · 10 MB pro Datei · 25 MB insgesamt"],
  es: ["Verificación de seguridad", "No se pudo cargar la verificación de seguridad.", "Reintentar la verificación", "No se pudo completar la verificación de seguridad. Completa el control de abajo e inténtalo de nuevo.", "No se pudo cargar el control de seguridad.", "No se pudo preparar la verificación de seguridad.", "La verificación de seguridad aún no está lista. Espera unos segundos e inténtalo de nuevo.", "Ya hay una verificación de seguridad en curso. Espera, por favor.", "La verificación de seguridad ha caducado.", "Hasta 10 archivos · 10 MB por archivo · 25 MB en total"],
  fr: ["Vérification de sécurité", "La vérification de sécurité n’a pas pu être chargée.", "Réessayer la vérification", "La vérification de sécurité n’a pas pu être effectuée. Recommencez le contrôle ci-dessous, puis réessayez.", "Le contrôle de sécurité n’a pas pu être chargé.", "La vérification de sécurité n’a pas pu être préparée.", "La vérification de sécurité n’est pas encore prête. Patientez quelques secondes, puis réessayez.", "Une vérification de sécurité est déjà en cours. Veuillez patienter.", "La vérification de sécurité a expiré.", "Jusqu’à 10 fichiers · 10 Mo par fichier · 25 Mo au total"],
  ru: ["Проверка безопасности", "Не удалось загрузить проверку безопасности.", "Повторить проверку", "Не удалось завершить проверку безопасности. Пройдите проверку ниже и повторите попытку.", "Не удалось загрузить контроль безопасности.", "Не удалось подготовить проверку безопасности.", "Проверка безопасности ещё не готова. Подождите несколько секунд и повторите попытку.", "Проверка безопасности уже выполняется. Подождите.", "Срок действия проверки безопасности истёк.", "До 10 файлов · 10 МБ на файл · 25 МБ всего"],
  ar: ["التحقق الأمني", "تعذر تحميل التحقق الأمني.", "إعادة محاولة التحقق", "تعذر إكمال التحقق الأمني. أعد إجراء الفحص أدناه ثم حاول مرة أخرى.", "تعذر تحميل فحص الأمان.", "تعذر إعداد التحقق الأمني.", "التحقق الأمني غير جاهز بعد. انتظر بضع ثوانٍ ثم حاول مرة أخرى.", "يوجد تحقق أمني قيد التنفيذ بالفعل. يرجى الانتظار.", "انتهت صلاحية التحقق الأمني.", "حتى 10 ملفات · 10 ميغابايت لكل ملف · 25 ميغابايت إجمالاً"],
  ja: ["セキュリティ確認", "セキュリティ確認を読み込めませんでした。", "確認を再試行", "セキュリティ確認を完了できませんでした。下の確認をもう一度行ってから再試行してください。", "セキュリティチェックを読み込めませんでした。", "セキュリティ確認を準備できませんでした。", "セキュリティ確認はまだ準備できていません。数秒待ってから再試行してください。", "セキュリティ確認がすでに進行中です。お待ちください。", "セキュリティ確認の有効期限が切れました。", "最大10ファイル · 1ファイル10 MB · 合計25 MB"],
});
Object.entries(criticalVerificationCopy).forEach(([language, values]) => {
  criticalVerificationSources.forEach((source, index) => { critical[language][source] = values[index]; });
});

const criticalStatusSupportSources = [
  "Sistem gözlemde",
  "SW Bot; kullanıcı alanını, Dashboard’u, menüleri ve veri bağlantılarını arka planda düzenli olarak denetliyor.",
  "Sistem normal",
  "Teknik sorun görünmüyor. Giriş, kayıt, panel ve bağlantı akışları denetleniyor.",
  "Taramayı yenile",
  "SW Bot; sayfaları, menüleri, düğmeleri, görselleri, veri bağlantısını ve çalışma zamanı hatalarını denetliyor…",
  "SW Bot tüm denetimleri tamamladı. Sorun tespit edilmedi.",
  "Son kontrol:",
  "Ekibimiz sorun üzerinde çalışıyor.",
  "Bizimle iletişime geçmek için",
  "Destek bağlantısı",
  "Destek e-postası oluştur",
  "En fazla 10 dosya ekleyebilirsin.",
  "Her dosya en fazla 10 MB olabilir.",
  "Eklerin toplam boyutu en fazla 25 MB olabilir.",
  "Gönderiliyor…",
  "Güvenlik kontrolü ve dosyalar hazırlanıyor…",
  "Mesajın gönderildi",
  "Tamam",
  "Mesaj gönderilemedi. Lütfen tekrar dene.",
  "Destek ekibimiz mesajını aldı. Talebini Hesabım › Destek talepleri bölümünden takip edebilirsin.",
  "Güvenlik kontrolünü yeniden yükle",
  "Güvenlik kontrolü yükleniyor…",
  "Güvenlik kontrolü hazırlanamadı. Kutudaki yeniden yükle düğmesini kullanıp tekrar dene.",
];
const criticalStatusSupportCopy = Object.freeze({
  en: [
    "System under observation", "SW Bot regularly checks the member area, Dashboard, menus, and data connections in the background.", "System operational", "No technical issue is visible. Sign-in, registration, dashboard, and connection flows are being checked.", "Scan again", "SW Bot is checking pages, menus, buttons, images, data connections, and runtime errors…", "SW Bot completed every check. No issue was detected.", "Last check:", "Our team is working on the issue.", "To contact us", "Support link", "Create a support email", "You can add up to 10 files.", "Each file can be up to 10 MB.", "Attachments can total up to 25 MB.", "Sending…", "Preparing the security check and files…", "Your message was sent", "Done", "The message could not be sent. Please try again.", "Our support team received your message. You can track it under My Account › Support requests.", "Reload security check", "Loading security check…", "The security check could not be prepared. Use the reload button in the box and try again."
  ],
  de: [
    "System wird beobachtet", "SW Bot prüft den Mitgliederbereich, das Dashboard, Menüs und Datenverbindungen regelmäßig im Hintergrund.", "System normal", "Es ist kein technisches Problem erkennbar. Anmeldung, Registrierung, Dashboard und Verbindungen werden geprüft.", "Erneut prüfen", "SW Bot prüft Seiten, Menüs, Schaltflächen, Bilder, Datenverbindungen und Laufzeitfehler…", "SW Bot hat alle Prüfungen abgeschlossen. Es wurde kein Problem erkannt.", "Letzte Prüfung:", "Unser Team arbeitet an dem Problem.", "So erreichst du uns", "Support-Link", "Support-E-Mail erstellen", "Du kannst bis zu 10 Dateien hinzufügen.", "Jede Datei darf höchstens 10 MB groß sein.", "Anhänge dürfen insgesamt höchstens 25 MB groß sein.", "Wird gesendet…", "Sicherheitsprüfung und Dateien werden vorbereitet…", "Deine Nachricht wurde gesendet", "Fertig", "Die Nachricht konnte nicht gesendet werden. Bitte versuche es erneut.", "Unser Support-Team hat deine Nachricht erhalten. Du kannst sie unter Mein Konto › Supportanfragen verfolgen.", "Sicherheitsprüfung neu laden", "Sicherheitsprüfung wird geladen…", "Die Sicherheitsprüfung konnte nicht vorbereitet werden. Verwende die Schaltfläche zum Neuladen im Feld und versuche es erneut."
  ],
  es: [
    "Sistema en observación", "SW Bot comprueba periódicamente en segundo plano el área de usuario, el Dashboard, los menús y las conexiones de datos.", "Sistema normal", "No se detecta ningún problema técnico. Se están comprobando el inicio de sesión, el registro, el panel y las conexiones.", "Volver a analizar", "SW Bot está comprobando páginas, menús, botones, imágenes, conexiones de datos y errores de ejecución…", "SW Bot completó todas las comprobaciones. No se detectó ningún problema.", "Última comprobación:", "Nuestro equipo está trabajando en el problema.", "Para contactar con nosotros", "Enlace de soporte", "Crear correo de soporte", "Puedes añadir hasta 10 archivos.", "Cada archivo puede ocupar hasta 10 MB.", "Los archivos adjuntos pueden sumar hasta 25 MB.", "Enviando…", "Preparando la verificación de seguridad y los archivos…", "Tu mensaje fue enviado", "Listo", "No se pudo enviar el mensaje. Inténtalo de nuevo.", "Nuestro equipo de soporte recibió tu mensaje. Puedes seguirlo en Mi cuenta › Solicitudes de soporte.", "Volver a cargar la verificación", "Cargando la verificación de seguridad…", "No se pudo preparar la verificación de seguridad. Usa el botón de recarga del cuadro e inténtalo de nuevo."
  ],
  fr: [
    "Système sous surveillance", "SW Bot vérifie régulièrement en arrière-plan l’espace membre, le Dashboard, les menus et les connexions de données.", "Système opérationnel", "Aucun problème technique n’est visible. La connexion, l’inscription, le tableau de bord et les connexions sont vérifiés.", "Relancer l’analyse", "SW Bot vérifie les pages, les menus, les boutons, les images, les connexions de données et les erreurs d’exécution…", "SW Bot a terminé toutes les vérifications. Aucun problème n’a été détecté.", "Dernière vérification :", "Notre équipe travaille sur le problème.", "Pour nous contacter", "Lien d’assistance", "Créer un e-mail d’assistance", "Vous pouvez ajouter jusqu’à 10 fichiers.", "Chaque fichier peut peser jusqu’à 10 Mo.", "Les pièces jointes peuvent totaliser jusqu’à 25 Mo.", "Envoi en cours…", "Préparation du contrôle de sécurité et des fichiers…", "Votre message a été envoyé", "Terminé", "Le message n’a pas pu être envoyé. Veuillez réessayer.", "Notre équipe d’assistance a reçu votre message. Vous pouvez le suivre dans Mon compte › Demandes d’assistance.", "Recharger le contrôle de sécurité", "Chargement du contrôle de sécurité…", "Le contrôle de sécurité n’a pas pu être préparé. Utilisez le bouton de rechargement dans la zone, puis réessayez."
  ],
  ru: [
    "Система под наблюдением", "SW Bot регулярно проверяет в фоне личный раздел, Dashboard, меню и подключения данных.", "Система работает нормально", "Технических проблем не обнаружено. Проверяются вход, регистрация, панель и подключения.", "Проверить снова", "SW Bot проверяет страницы, меню, кнопки, изображения, подключения данных и ошибки выполнения…", "SW Bot завершил все проверки. Проблем не обнаружено.", "Последняя проверка:", "Наша команда работает над проблемой.", "Чтобы связаться с нами", "Ссылка поддержки", "Создать письмо в поддержку", "Можно добавить до 10 файлов.", "Размер каждого файла — не более 10 МБ.", "Общий размер вложений — не более 25 МБ.", "Отправка…", "Подготовка проверки безопасности и файлов…", "Сообщение отправлено", "Готово", "Не удалось отправить сообщение. Повторите попытку.", "Служба поддержки получила ваше сообщение. Его можно отслеживать в разделе Мой аккаунт › Обращения в поддержку.", "Перезагрузить проверку", "Загрузка проверки безопасности…", "Не удалось подготовить проверку безопасности. Нажмите кнопку перезагрузки в поле и повторите попытку."
  ],
  ar: [
    "النظام قيد المراقبة", "يتحقق SW Bot بانتظام في الخلفية من منطقة المستخدم ولوحة المعلومات والقوائم واتصالات البيانات.", "النظام يعمل بصورة طبيعية", "لا تظهر مشكلة تقنية. يجري فحص تسجيل الدخول والتسجيل ولوحة المعلومات ومسارات الاتصال.", "إعادة الفحص", "يفحص SW Bot الصفحات والقوائم والأزرار والصور واتصالات البيانات وأخطاء وقت التشغيل…", "أكمل SW Bot جميع الفحوصات. لم يتم اكتشاف أي مشكلة.", "آخر فحص:", "يعمل فريقنا على حل المشكلة.", "للتواصل معنا", "رابط الدعم", "إنشاء رسالة دعم", "يمكنك إضافة ما يصل إلى 10 ملفات.", "يمكن أن يصل حجم كل ملف إلى 10 ميغابايت.", "يمكن أن يصل إجمالي المرفقات إلى 25 ميغابايت.", "جارٍ الإرسال…", "جارٍ إعداد فحص الأمان والملفات…", "تم إرسال رسالتك", "تم", "تعذر إرسال الرسالة. حاول مرة أخرى.", "استلم فريق الدعم رسالتك. يمكنك متابعتها من حسابي › طلبات الدعم.", "إعادة تحميل فحص الأمان", "جارٍ تحميل فحص الأمان…", "تعذر إعداد فحص الأمان. استخدم زر إعادة التحميل داخل المربع ثم حاول مرة أخرى."
  ],
  ja: [
    "システム監視中", "SW Bot はメンバーエリア、Dashboard、メニュー、データ接続をバックグラウンドで定期的に確認しています。", "システムは正常です", "技術的な問題は見つかっていません。ログイン、登録、ダッシュボード、接続フローを確認しています。", "再スキャン", "SW Bot はページ、メニュー、ボタン、画像、データ接続、実行時エラーを確認しています…", "SW Bot はすべての確認を完了しました。問題は検出されませんでした。", "最終確認：", "チームが問題の解決に取り組んでいます。", "お問い合わせ", "サポートリンク", "サポートメールを作成", "最大10ファイルまで追加できます。", "各ファイルは最大10 MBです。", "添付ファイルの合計は最大25 MBです。", "送信中…", "セキュリティ確認とファイルを準備中…", "メッセージを送信しました", "完了", "メッセージを送信できませんでした。もう一度お試しください。", "サポートチームがメッセージを受け取りました。マイアカウント › サポートリクエストで確認できます。", "セキュリティ確認を再読み込み", "セキュリティ確認を読み込み中…", "セキュリティ確認を準備できませんでした。ボックス内の再読み込みボタンを使って、もう一度お試しください。"
  ],
});
Object.entries(criticalStatusSupportCopy).forEach(([language, values]) => {
  criticalStatusSupportSources.forEach((source, index) => { critical[language][source] = values[index]; });
});

const fixedInterfaceSources = [
  "Akıllı bildirimler", "Alıcı", "araç", "Astronot yukarı çıkıyor", "Ayarlar",
  "Bağlantıyı yenile", "Başlangıç", "Bize yaz", "Bu cihazda",
  "Bu kayıt doğrudan SW Identity hesabını oluşturur; ayrıca bir Play Streamers hesabı açılmaz.",
  "Canlı merkez", "CANLI MERKEZ", "DESTEK MERKEZİ", "E-posta adresin", "Ekle",
  "En az 10 karakter", "Fikir kasası", "Fotoğraf veya dosya ekle",
  "Güvenlik doğrulaması yüklenemedi; tekrar denenecek.", "Hakkımızda · Play Streamers",
  "Henüz veri yok", "Kick yayın durumu kontrol ediliyor…", "Kullanılabilir", "Mesajı gönder",
  "Mesajın ve seçtiğin dosyalar Play Streamers içinden doğrudan destek ekibimize gönderilir.",
  "Nasıl Çalışır? · Play Streamers", "Nasıl yardımcı olabiliriz?", "Planla", "Sıfırla", "Sil",
  "Sunucudan güncel değerler alınıyor…", "SW Identity hesabı oluştur", "Şifreni yeniden yaz",
  "Şu an", "Ürünlerimiz · Play Streamers", "Vazgeç", "Yaşadığın durumu veya önerini yaz...",
  "Yayın akışı", "Yayın kapalı", "Yayın senin.", "Menü", "Kapat",
];
const fixedInterfaceCopy = Object.freeze({
  en: [
    "Smart notifications", "Recipient", "tool", "Astronaut ascending", "Settings",
    "Refresh connection", "Home", "Write to us", "On this device",
    "This registration creates the SW Identity account directly; it does not create a separate Play Streamers account.",
    "Live hub", "LIVE HUB", "SUPPORT CENTER", "Your email address", "Add",
    "At least 10 characters", "Idea vault", "Attach a photo or file",
    "Security verification could not load; it will retry.", "About · Play Streamers",
    "No data yet", "Checking Kick stream status…", "Available", "Send message",
    "Your message and selected files are sent directly to our support team through Play Streamers.",
    "How It Works · Play Streamers", "How can we help?", "Schedule", "Reset", "Delete",
    "Fetching current values from the server…", "Create SW Identity account", "Re-enter your password",
    "Now", "Products · Play Streamers", "Cancel", "Describe the issue or share your suggestion...",
    "Stream flow", "Stream offline", "The stream is yours.", "Menu", "Close",
  ],
  de: [
    "Intelligente Benachrichtigungen", "Empfänger", "Werkzeug", "Astronaut steigt auf", "Einstellungen",
    "Verbindung aktualisieren", "Start", "Schreib uns", "Auf diesem Gerät",
    "Diese Registrierung erstellt direkt das SW Identity-Konto; ein separates Play Streamers-Konto wird nicht erstellt.",
    "Live-Zentrale", "LIVE-ZENTRALE", "SUPPORT-CENTER", "Deine E-Mail-Adresse", "Hinzufügen",
    "Mindestens 10 Zeichen", "Ideenspeicher", "Foto oder Datei anhängen",
    "Die Sicherheitsprüfung konnte nicht geladen werden; ein neuer Versuch folgt.", "Über uns · Play Streamers",
    "Noch keine Daten", "Kick-Streamstatus wird geprüft…", "Verfügbar", "Nachricht senden",
    "Deine Nachricht und die ausgewählten Dateien werden über Play Streamers direkt an unser Support-Team gesendet.",
    "So funktioniert es · Play Streamers", "Wie können wir helfen?", "Planen", "Zurücksetzen", "Löschen",
    "Aktuelle Werte werden vom Server geladen…", "SW Identity-Konto erstellen", "Passwort erneut eingeben",
    "Jetzt", "Produkte · Play Streamers", "Abbrechen", "Beschreibe dein Problem oder deinen Vorschlag...",
    "Stream-Ablauf", "Stream offline", "Dein Stream.", "Menü", "Schließen",
  ],
  es: [
    "Notificaciones inteligentes", "Destinatario", "herramienta", "El astronauta está ascendiendo", "Ajustes",
    "Actualizar conexión", "Inicio", "Escríbenos", "En este dispositivo",
    "Este registro crea directamente la cuenta de SW Identity; no crea una cuenta separada de Play Streamers.",
    "Centro en vivo", "CENTRO EN VIVO", "CENTRO DE SOPORTE", "Tu correo electrónico", "Añadir",
    "Al menos 10 caracteres", "Bóveda de ideas", "Adjuntar foto o archivo",
    "No se pudo cargar la verificación de seguridad; se volverá a intentar.", "Sobre nosotros · Play Streamers",
    "Aún no hay datos", "Comprobando el estado del directo de Kick…", "Disponible", "Enviar mensaje",
    "Tu mensaje y los archivos seleccionados se envían directamente a nuestro equipo de soporte mediante Play Streamers.",
    "Cómo funciona · Play Streamers", "¿Cómo podemos ayudarte?", "Programar", "Restablecer", "Eliminar",
    "Obteniendo los valores actuales del servidor…", "Crear cuenta de SW Identity", "Vuelve a escribir tu contraseña",
    "Ahora", "Productos · Play Streamers", "Cancelar", "Describe el problema o comparte tu sugerencia...",
    "Flujo de transmisión", "Transmisión desconectada", "La transmisión es tuya.", "Menú", "Cerrar",
  ],
  fr: [
    "Notifications intelligentes", "Destinataire", "outil", "L’astronaute remonte", "Paramètres",
    "Actualiser la connexion", "Accueil", "Écrivez-nous", "Sur cet appareil",
    "Cette inscription crée directement le compte SW Identity ; elle ne crée pas de compte Play Streamers distinct.",
    "Centre en direct", "CENTRE EN DIRECT", "CENTRE D’ASSISTANCE", "Votre adresse e-mail", "Ajouter",
    "Au moins 10 caractères", "Boîte à idées", "Joindre une photo ou un fichier",
    "La vérification de sécurité n’a pas pu être chargée ; une nouvelle tentative va être effectuée.", "À propos · Play Streamers",
    "Aucune donnée pour le moment", "Vérification de l’état du direct Kick…", "Disponible", "Envoyer le message",
    "Votre message et les fichiers sélectionnés sont envoyés directement à notre équipe d’assistance via Play Streamers.",
    "Fonctionnement · Play Streamers", "Comment pouvons-nous vous aider ?", "Planifier", "Réinitialiser", "Supprimer",
    "Récupération des valeurs actuelles depuis le serveur…", "Créer un compte SW Identity", "Saisissez à nouveau votre mot de passe",
    "Maintenant", "Produits · Play Streamers", "Annuler", "Décrivez votre problème ou partagez votre suggestion...",
    "Flux du direct", "Direct hors ligne", "Le direct est à vous.", "Menu", "Fermer",
  ],
  ru: [
    "Умные уведомления", "Получатель", "инструмент", "Астронавт поднимается", "Настройки",
    "Обновить подключение", "Главная", "Напишите нам", "На этом устройстве",
    "Эта регистрация создаёт аккаунт SW Identity напрямую; отдельный аккаунт Play Streamers не создаётся.",
    "Центр трансляции", "ЦЕНТР ТРАНСЛЯЦИИ", "ЦЕНТР ПОДДЕРЖКИ", "Ваш адрес электронной почты", "Добавить",
    "Не менее 10 символов", "Хранилище идей", "Прикрепить фото или файл",
    "Не удалось загрузить проверку безопасности; будет выполнена повторная попытка.", "О нас · Play Streamers",
    "Данных пока нет", "Проверяется статус трансляции Kick…", "Доступно", "Отправить сообщение",
    "Ваше сообщение и выбранные файлы отправляются напрямую нашей службе поддержки через Play Streamers.",
    "Как это работает · Play Streamers", "Чем мы можем помочь?", "Запланировать", "Сбросить", "Удалить",
    "Получение актуальных данных с сервера…", "Создать аккаунт SW Identity", "Введите пароль ещё раз",
    "Сейчас", "Продукты · Play Streamers", "Отмена", "Опишите проблему или поделитесь предложением...",
    "Ход трансляции", "Трансляция не ведётся", "Трансляция ваша.", "Меню", "Закрыть",
  ],
  ar: [
    "إشعارات ذكية", "المستلم", "أداة", "رائد الفضاء يصعد", "الإعدادات",
    "تحديث الاتصال", "الرئيسية", "اكتب لنا", "على هذا الجهاز",
    "ينشئ هذا التسجيل حساب SW Identity مباشرةً؛ ولا ينشئ حسابًا منفصلًا في Play Streamers.",
    "مركز البث", "مركز البث", "مركز الدعم", "عنوان بريدك الإلكتروني", "إضافة",
    "10 أحرف على الأقل", "خزنة الأفكار", "إرفاق صورة أو ملف",
    "تعذر تحميل التحقق الأمني؛ ستتم إعادة المحاولة.", "من نحن · Play Streamers",
    "لا توجد بيانات بعد", "جارٍ التحقق من حالة بث Kick…", "متاح", "إرسال الرسالة",
    "تُرسل رسالتك والملفات التي اخترتها مباشرةً إلى فريق الدعم لدينا عبر Play Streamers.",
    "كيف يعمل · Play Streamers", "كيف يمكننا مساعدتك؟", "جدولة", "إعادة تعيين", "حذف",
    "جارٍ جلب القيم الحالية من الخادم…", "إنشاء حساب SW Identity", "أعد كتابة كلمة المرور",
    "الآن", "المنتجات · Play Streamers", "إلغاء", "صِف المشكلة أو شارك اقتراحك...",
    "مسار البث", "البث غير متصل", "البث لك.", "القائمة", "إغلاق",
  ],
  ja: [
    "スマート通知", "受信者", "ツール", "宇宙飛行士が上昇中", "設定",
    "接続を更新", "ホーム", "お問い合わせ", "このデバイスで",
    "この登録ではSW Identityアカウントが直接作成され、別のPlay Streamersアカウントは作成されません。",
    "ライブセンター", "ライブセンター", "サポートセンター", "メールアドレス", "追加",
    "10文字以上", "アイデアボックス", "写真またはファイルを添付",
    "セキュリティ確認を読み込めませんでした。再試行します。", "私たちについて · Play Streamers",
    "データはまだありません", "Kickの配信状態を確認中…", "利用可能", "メッセージを送信",
    "メッセージと選択したファイルは、Play Streamersからサポートチームへ直接送信されます。",
    "仕組み · Play Streamers", "どのようなご用件でしょうか？", "予約", "リセット", "削除",
    "サーバーから最新の値を取得中…", "SW Identityアカウントを作成", "パスワードをもう一度入力",
    "現在", "製品 · Play Streamers", "キャンセル", "問題やご提案を入力してください...",
    "配信フロー", "配信オフライン", "配信の主役はあなたです。", "メニュー", "閉じる",
  ],
});
Object.entries(fixedInterfaceCopy).forEach(([language, values]) => {
  fixedInterfaceSources.forEach((source, index) => { critical[language][source] = values[index]; });
});
Object.assign(critical.en, {
  "Yayın akışı": "Stream timeline",
  "Yayın kapalı": "Stream offline",
  "Yayın senin.": "Your stream, your way.",
});
Object.entries({
  en: ["If you're there, I'm heading out.", "example.user"],
  de: ["Wenn du da bist, mache ich mich auf den Weg.", "beispiel.benutzer"],
  es: ["Si estás ahí, me voy.", "usuario.ejemplo"],
  fr: ["Si vous êtes là, je m’en vais.", "utilisateur.exemple"],
  ru: ["Если вы здесь, я ухожу.", "пример.пользователя"],
  ar: ["إن كنت هنا، فسأغادر.", "مستخدم.مثال"],
  ja: ["そこにいるなら、私は戻ります。", "ユーザー.例"],
}).forEach(([language, values]) => Object.assign(critical[language], {
  "Buradaysan ben gidiyorum.": values[0],
  "ornek.kullanici": values[1],
}));
Object.entries({
  en: ["Sign in with your username or email.", "username or email", "Quick sign-in with your SW account", "PROTECTED BY SW IDENTITY", "SW Identity security and plan infrastructure", "Your password", "Hide password", "Show password"],
  de: ["Melde dich mit deinem Benutzernamen oder deiner E-Mail-Adresse an.", "Benutzername oder E-Mail", "Schnellanmeldung mit deinem SW-Konto", "DURCH SW IDENTITY GESCHÜTZT", "Sicherheits- und Planinfrastruktur von SW Identity", "Dein Passwort", "Passwort ausblenden", "Passwort anzeigen"],
  es: ["Inicia sesión con tu usuario o correo electrónico.", "usuario o correo electrónico", "Inicio rápido con tu cuenta SW", "PROTEGIDO POR SW IDENTITY", "Infraestructura de seguridad y planes de SW Identity", "Tu contraseña", "Ocultar contraseña", "Mostrar contraseña"],
  fr: ["Connectez-vous avec votre nom d’utilisateur ou votre e-mail.", "nom d’utilisateur ou e-mail", "Connexion rapide avec votre compte SW", "PROTÉGÉ PAR SW IDENTITY", "Infrastructure de sécurité et d’offres SW Identity", "Votre mot de passe", "Masquer le mot de passe", "Afficher le mot de passe"],
  ru: ["Войдите с помощью имени пользователя или электронной почты.", "имя пользователя или эл. почта", "Быстрый вход с аккаунтом SW", "ПОД ЗАЩИТОЙ SW IDENTITY", "Инфраструктура безопасности и тарифов SW Identity", "Ваш пароль", "Скрыть пароль", "Показать пароль"],
  ar: ["سجّل الدخول باسم المستخدم أو البريد الإلكتروني.", "اسم المستخدم أو البريد الإلكتروني", "تسجيل دخول سريع بحساب SW", "محمي بواسطة SW IDENTITY", "بنية الأمان والخطط في SW Identity", "كلمة مرورك", "إخفاء كلمة المرور", "إظهار كلمة المرور"],
  ja: ["ユーザー名またはメールアドレスでログインしてください。", "ユーザー名またはメール", "SWアカウントですばやくログイン", "SW IDENTITYにより保護", "SW Identityのセキュリティとプラン基盤", "パスワード", "パスワードを隠す", "パスワードを表示"],
}).forEach(([language, values]) => {
  [
    "Kullanıcı adın veya e-postanla giriş yap.", "kullaniciadi veya e-posta", "SW hesabı ile hızlı giriş",
    "SW IDENTITY İLE KORUNUR", "SW Identity güvenlik ve plan altyapısı", "Şifren", "Şifreyi gizle", "Şifreyi göster",
  ].forEach((source, index) => { critical[language][source] = values[index]; });
});
Object.entries({
  en: ["Developed by", "SERVER DATA PIPELINE", "Reset publisher panel data", "Reset publisher statistics data", "Save workspace", "Saved"],
  de: ["Entwickelt von", "SERVER-DATENLEITUNG", "Daten des Streamer-Panels zurücksetzen", "Streamer-Statistiken zurücksetzen", "Arbeitsstand speichern", "Gespeichert"],
  es: ["Desarrollado por", "CANAL DE DATOS DEL SERVIDOR", "Restablecer los datos del panel del streamer", "Restablecer las estadísticas del streamer", "Guardar trabajo", "Guardado"],
  fr: ["Développé par", "FLUX DE DONNÉES SERVEUR", "Réinitialiser les données du panneau streamer", "Réinitialiser les statistiques du streamer", "Enregistrer le travail", "Enregistré"],
  ru: ["Разработано", "СЕРВЕРНЫЙ КАНАЛ ДАННЫХ", "Сбросить данные панели стримера", "Сбросить статистику стримера", "Сохранить работу", "Сохранено"],
  ar: ["طُوّر بواسطة", "مسار بيانات الخادم", "إعادة ضبط بيانات لوحة البث", "إعادة ضبط إحصاءات البث", "حفظ العمل", "تم الحفظ"],
  ja: ["開発", "サーバーデータパイプライン", "配信者パネルのデータをリセット", "配信者統計をリセット", "作業を保存", "保存しました"],
}).forEach(([language, values]) => {
  ["Developed by", "SUNUCU VERİ HATTI", "Yayıncı paneli verilerini sıfırla", "Yayıncı istatistikleri verilerini sıfırla", "Çalışmayı kaydet", "Kaydedildi"]
    .forEach((source, index) => { critical[language][source] = values[index]; });
});
Object.entries({
  en: ["Automatic server stream analytics", "{hours} h {minutes} min", "{minutes} min", "Waiting for the first stream", "Stream is measured automatically", "Measurement continues while the app is closed", "● LIVE", "READY", "KICK CONNECTION REQUIRED", "Live viewers", "Last stream average", "Server sample per minute", "Peak viewers", "Kick API measurement", "Engagement", "+{count} followers", "Waiting for signed events", "Stream duration", "Server session", "Even if you close the site, app, or extension, the stream session is created on the server while your Kick connection remains active.", "Measurement will retry", "Automatic and server-based", "Server data is currently unavailable", "RETRYING", "OFFLINE", "Your existing stream data is safe. This area refreshes automatically when the connection returns.", "Plan tools"],
  de: ["Automatische Streamanalyse auf dem Server", "{hours} Std. {minutes} Min.", "{minutes} Min.", "Warten auf den ersten Stream", "Stream wird automatisch gemessen", "Messung läuft auch bei geschlossener App", "● LIVE", "BEREIT", "KICK-VERBINDUNG ERFORDERLICH", "Live-Zuschauer", "Durchschnitt des letzten Streams", "Servermessung pro Minute", "Spitzenzuschauer", "Kick-API-Messung", "Interaktionen", "+{count} Follower", "Warten auf signierte Ereignisse", "Streamdauer", "Serversitzung", "Auch wenn du Website, App oder Erweiterung schließt, wird die Stream-Sitzung auf dem Server erstellt, solange deine Kick-Verbindung aktiv bleibt.", "Messung wird erneut versucht", "Automatisch und serverbasiert", "Serverdaten sind derzeit nicht erreichbar", "NEUER VERSUCH", "OFFLINE", "Deine vorhandenen Streamdaten bleiben erhalten. Dieser Bereich wird automatisch aktualisiert, sobald die Verbindung zurückkehrt.", "Plan-Werkzeuge"],
  es: ["Análisis automático de streams en el servidor", "{hours} h {minutes} min", "{minutes} min", "Esperando el primer stream", "El stream se mide automáticamente", "La medición continúa con la aplicación cerrada", "● EN DIRECTO", "LISTO", "SE REQUIERE CONEXIÓN CON KICK", "Espectadores en directo", "Media del último stream", "Muestra del servidor por minuto", "Pico de espectadores", "Medición de la API de Kick", "Interacción", "+{count} seguidores", "Esperando eventos firmados", "Duración del stream", "Sesión del servidor", "Aunque cierres el sitio, la aplicación o la extensión, la sesión del stream se crea en el servidor mientras la conexión con Kick siga activa.", "Se volverá a intentar la medición", "Automático y basado en servidor", "Los datos del servidor no están disponibles ahora", "REINTENTANDO", "SIN CONEXIÓN", "Tus datos de stream existentes están seguros. Esta zona se actualizará automáticamente cuando vuelva la conexión.", "Herramientas del plan"],
  fr: ["Analyse automatique des streams sur le serveur", "{hours} h {minutes} min", "{minutes} min", "En attente du premier stream", "Le stream est mesuré automatiquement", "La mesure continue lorsque l’application est fermée", "● EN DIRECT", "PRÊT", "CONNEXION KICK REQUISE", "Spectateurs en direct", "Moyenne du dernier stream", "Échantillon serveur par minute", "Pic de spectateurs", "Mesure de l’API Kick", "Engagement", "+{count} abonnés", "En attente d’événements signés", "Durée du stream", "Session serveur", "Même si vous fermez le site, l’application ou l’extension, la session de stream est créée sur le serveur tant que la connexion Kick reste active.", "Nouvelle tentative de mesure", "Automatique et basé sur le serveur", "Les données du serveur sont actuellement indisponibles", "NOUVELLE TENTATIVE", "HORS LIGNE", "Vos données de stream existantes sont conservées. Cette zone s’actualisera automatiquement au retour de la connexion.", "Outils de l’offre"],
  ru: ["Автоматическая серверная аналитика трансляций", "{hours} ч {minutes} мин", "{minutes} мин", "Ожидание первой трансляции", "Трансляция измеряется автоматически", "Измерение продолжается при закрытом приложении", "● В ЭФИРЕ", "ГОТОВО", "ТРЕБУЕТСЯ ПОДКЛЮЧЕНИЕ KICK", "Зрители сейчас", "Среднее за последнюю трансляцию", "Ежеминутный серверный замер", "Пиковые зрители", "Измерение через API Kick", "Вовлечённость", "+{count} подписчиков", "Ожидание подписанных событий", "Длительность трансляции", "Серверная сессия", "Даже если закрыть сайт, приложение или расширение, сервер продолжит создавать сессию трансляции, пока подключение Kick активно.", "Измерение будет повторено", "Автоматически на сервере", "Серверные данные сейчас недоступны", "ПОВТОРНАЯ ПОПЫТКА", "НЕ В СЕТИ", "Существующие данные трансляций сохранены. Этот раздел обновится автоматически после восстановления соединения.", "Инструменты тарифа"],
  ar: ["تحليلات بث تلقائية على الخادم", "{hours} س {minutes} د", "{minutes} د", "في انتظار البث الأول", "يُقاس البث تلقائيًا", "يستمر القياس عند إغلاق التطبيق", "● مباشر", "جاهز", "يلزم اتصال KICK", "المشاهدون الآن", "متوسط البث الأخير", "عينة من الخادم كل دقيقة", "ذروة المشاهدين", "قياس عبر واجهة Kick API", "التفاعل", "+{count} متابعين", "في انتظار الأحداث الموقعة", "مدة البث", "جلسة الخادم", "حتى عند إغلاق الموقع أو التطبيق أو الإضافة، تُنشأ جلسة البث على الخادم ما دام اتصال Kick نشطًا.", "ستتم إعادة محاولة القياس", "تلقائي وقائم على الخادم", "بيانات الخادم غير متاحة حاليًا", "إعادة المحاولة", "غير متصل", "بيانات البث الحالية محفوظة. ستتحدث هذه المنطقة تلقائيًا عند عودة الاتصال.", "أدوات الخطة"],
  ja: ["サーバーによる自動配信分析", "{hours}時間{minutes}分", "{minutes}分", "最初の配信を待機中", "配信を自動測定中", "アプリを閉じても測定を継続", "● ライブ", "準備完了", "KICK接続が必要です", "現在の視聴者", "前回配信の平均", "1分ごとのサーバー測定", "最大視聴者数", "Kick APIによる測定", "エンゲージメント", "+{count}フォロワー", "署名済みイベントを待機中", "配信時間", "サーバーセッション", "サイト、アプリ、拡張機能を閉じても、Kick接続が有効な間は配信セッションがサーバー上に作成されます。", "測定を再試行します", "自動・サーバー処理", "現在サーバーデータを取得できません", "再試行中", "オフライン", "既存の配信データは保持されています。接続が戻ると、この領域は自動的に更新されます。", "プランツール"],
}).forEach(([language, values]) => {
  [
    "Sunucudan otomatik yayın analizi", "{hours} sa {minutes} dk", "{minutes} dk", "İlk yayın bekleniyor",
    "Yayın otomatik ölçülüyor", "Uygulama kapalıyken de ölçüm açık", "● CANLI", "HAZIR",
    "KICK BAĞLANTISI GEREKİYOR", "Anlık izleyici", "Son yayın ortalaması", "Dakikalık sunucu örneği",
    "Tepe izleyici", "Kick API ölçümü", "Etkileşim", "+{count} takipçi", "İmzalı olay bekleniyor",
    "Yayın süresi", "Sunucu oturumu",
    "Siteyi, uygulamayı veya eklentiyi kapatsan da Kick bağlantın açık kaldığı sürece yayın oturumu sunucuda oluşur.",
    "Ölçüm yeniden denenecek", "Otomatik ve sunucu tabanlı", "Sunucu verisine şu anda ulaşılamıyor",
    "YENİDEN DENENECEK", "ÇEVRİMDIŞI",
    "Mevcut yayın verilerin kaybolmaz. Bağlantı geri geldiğinde bu alan otomatik olarak yenilenir.", "Plan araçları",
  ].forEach((source, index) => { critical[language][source] = values[index]; });
});
Object.assign(critical.ar, {
  "Örn. 250 takipçi": "مثال: 250 متابعًا",
  "Windows 10/11 masaüstü merkezi": "مركز سطح المكتب لنظام Windows 10/11",
  "Yayın metninden kısa paylaşım taslakları oluştur.": "أنشئ مسودات منشورات قصيرة من نص البث.",
});
Object.entries({
  en: ["Streamer Panel", "Streamer Statistics", "RESET STREAMER PANEL", "RESET STREAMER STATISTICS", "SERVER ONLINE", "New Members", "Follower", "1-Month Subscriber", "2+ Month Subscriber", "Gifted Subscriptions", "This month", "All time"],
  de: ["Streamer-Panel", "Streamer-Statistiken", "STREAMER-PANEL ZURÜCKSETZEN", "STREAMER-STATISTIKEN ZURÜCKSETZEN", "SERVER AKTIV", "Neue Mitglieder", "Follower", "1-Monats-Abonnent", "Abonnent ab 2 Monaten", "Geschenkabos", "Dieser Monat", "Gesamter Zeitraum"],
  es: ["Panel del streamer", "Estadísticas del streamer", "RESTABLECER PANEL DEL STREAMER", "RESTABLECER ESTADÍSTICAS DEL STREAMER", "SERVIDOR ACTIVO", "Nuevos miembros", "Seguidor", "Suscriptor de 1 mes", "Suscriptor de 2+ meses", "Suscripciones regaladas", "Este mes", "Todo el tiempo"],
  fr: ["Panneau streamer", "Statistiques streamer", "RÉINITIALISER LE PANNEAU STREAMER", "RÉINITIALISER LES STATISTIQUES STREAMER", "SERVEUR ACTIF", "Nouveaux membres", "Abonné", "Abonné depuis 1 mois", "Abonné depuis 2 mois ou plus", "Abonnements offerts", "Ce mois-ci", "Toute la période"],
  ru: ["Панель стримера", "Статистика стримера", "СБРОСИТЬ ПАНЕЛЬ СТРИМЕРА", "СБРОСИТЬ СТАТИСТИКУ СТРИМЕРА", "СЕРВЕР АКТИВЕН", "Новые участники", "Подписчик", "Подписчик 1 месяц", "Подписчик 2+ месяца", "Подарочные подписки", "Этот месяц", "За всё время"],
  ar: ["لوحة البث", "إحصاءات البث", "إعادة ضبط لوحة البث", "إعادة ضبط إحصاءات البث", "الخادم نشط", "الأعضاء الجدد", "متابع", "مشترك لمدة شهر", "مشترك لمدة شهرين أو أكثر", "الاشتراكات المُهداة", "هذا الشهر", "كل الوقت"],
  ja: ["配信者パネル", "配信者統計", "配信者パネルをリセット", "配信者統計をリセット", "サーバー稼働中", "新規メンバー", "フォロワー", "1か月購読者", "2か月以上の購読者", "ギフト購読", "今月", "全期間"],
}).forEach(([language, values]) => {
  ["Yayıncı Paneli", "Yayıncı İstatistikleri", "YAYINCI PANELİNİ SIFIRLA", "YAYINCI İSTATİSTİKLERİNİ SIFIRLA", "SUNUCU AKTİF", "Yeni Katılanlar", "Takipçi", "1 Aylık Abone", "2+ Aylık Abone", "Hediye Abonelik", "Bu ay", "Tüm zamanlar"]
    .forEach((source, index) => { critical[language][source] = values[index]; });
});
Object.assign(critical.en, {
  "Anlık görüntü": "Snapshot",
  "Hızlı notlar": "Quick notes",
  "Hızlı notlar ve hedef panosu": "Quick notes and goal board",
  "İçerik dönüştürme": "Content repurposing",
  "İçerik dönüştürme ve akıllı uyarılar": "Content repurposing and smart alerts",
  "Mevcut Dashboard durumunu bu cihazda karşılaştırılabilir bir anlık görüntü olarak sakla.": "Save the current Dashboard state on this device as a comparable snapshot.",
  "Oluşturulan taslak burada görünür.": "The generated draft will appear here.",
  "Plan araçları": "Plan tools",
  "Tarayıcıda çalışan araçlar hesabına özel olarak bu cihazda saklanır. Plan yetkisi olmayan araçlar açıkça kilitli görünür.": "Browser tools are stored on this device for your account. Tools outside your plan are clearly shown as locked.",
  "Veri dışa aktarma": "Data export",
  "Yayın biter. Verin kaybolmaz.": "The stream ends. Your data remains.",
  "Yayın çalışma setin": "Creator toolkit",
  "Yayın metni + teleprompter": "Stream script + teleprompter",
  "Yayın metni, teleprompter ve veri dışa aktarma": "Stream script, teleprompter, and data export",
  "Yayın metninden kısa paylaşım taslakları oluştur.": "Create short social post drafts from your stream script.",
  "Yayın sırasında unutmaman gerekenleri yaz...": "Write down anything you do not want to forget during the stream...",
  "Yayın zamanlayıcısı ve fikir kasası": "Stream timer and idea vault",
  "Yayın zekâsı ve izleyici nabzı": "Stream intelligence and audience pulse",
  "Yayından kısa not:": "Stream highlight:",
  "Yayının kapansa da geçmişin hazır.": "Even after your stream ends, your history is ready.",
  "Yayınını yönet. Üretimini büyüt.": "Manage your stream. Grow your production system.",
});
Object.entries({
  en: ["Live event center and counter", "Quick notes and goal board", "Stream timer and idea vault", "Advanced analytics and after-stream report", "Stream script, teleprompter, and data export", "Brand, vault, and community tools", "Stream intelligence and audience pulse", "Content repurposing and smart alerts", "Media kit, revenue cockpit, and snapshots", "WINDOWS 10/11 · VERSION 0.14.4"],
  de: ["Live-Event-Zentrale und Zähler", "Schnellnotizen und Zieltafel", "Stream-Timer und Ideenspeicher", "Erweiterte Diagramme und Stream-Bericht", "Stream-Skript, Teleprompter und Datenexport", "Marken-, Tresor- und Community-Werkzeuge", "Stream-Intelligenz und Zuschauer-Puls", "Content-Aufbereitung und intelligente Benachrichtigungen", "Medienkit, Umsatz-Cockpit und Momentaufnahmen", "WINDOWS 10/11 · VERSION 0.14.4"],
  es: ["Centro de eventos en directo y contador", "Notas rápidas y panel de objetivos", "Temporizador de emisión y banco de ideas", "Gráficos avanzados e informe del directo", "Guion de emisión, teleprónter y exportación de datos", "Herramientas de marca, archivo y comunidad", "Inteligencia de emisión y pulso de la audiencia", "Reutilización de contenido y alertas inteligentes", "Kit de medios, panel de ingresos e instantáneas", "WINDOWS 10/11 · VERSIÓN 0.14.4"],
  fr: ["Centre d’événements en direct et compteur", "Notes rapides et tableau d’objectifs", "Minuteur de diffusion et boîte à idées", "Graphiques avancés et rapport de diffusion", "Script de diffusion, téléprompteur et export de données", "Outils de marque, coffre et communauté", "Intelligence de diffusion et pouls de l’audience", "Déclinaison de contenu et alertes intelligentes", "Kit média, cockpit des revenus et instantanés", "WINDOWS 10/11 · VERSION 0.14.4"],
  ru: ["Центр событий эфира и счётчик", "Быстрые заметки и доска целей", "Таймер эфира и хранилище идей", "Расширенные графики и отчёт об эфире", "Сценарий эфира, телесуфлёр и экспорт данных", "Инструменты бренда, хранилища и сообщества", "Аналитика эфира и пульс аудитории", "Адаптация контента и умные уведомления", "Медиакит, панель доходов и снимки", "WINDOWS 10/11 · ВЕРСИЯ 0.14.4"],
  ar: ["مركز أحداث البث والعداد", "ملاحظات سريعة ولوحة الأهداف", "مؤقت البث ومستودع الأفكار", "رسوم بيانية متقدمة وتقرير البث", "نص البث والملقن وتصدير البيانات", "أدوات العلامة التجارية والخزنة والمجتمع", "ذكاء البث ومؤشر تفاعل الجمهور", "إعادة توظيف المحتوى والتنبيهات الذكية", "حزمة إعلامية ولوحة الإيرادات واللقطات", "WINDOWS 10/11 · الإصدار 0.14.4"],
  ja: ["ライブイベントセンターとカウンター", "クイックノートと目標ボード", "配信タイマーとアイデア保管庫", "高度なグラフと配信レポート", "配信台本、テレプロンプター、データ書き出し", "ブランド、保管庫、コミュニティツール", "配信インテリジェンスと視聴者パルス", "コンテンツ再活用とスマート通知", "メディアキット、収益コックピット、スナップショット", "WINDOWS 10/11 · バージョン 0.14.4"],
}).forEach(([language, values]) => {
  ["Canlı olay merkezi ve sayaç", "Hızlı notlar ve hedef panosu", "Yayın zamanlayıcısı ve fikir kasası", "Gelişmiş grafikler ve yayın raporu", "Yayın metni, teleprompter ve veri dışa aktarma", "Marka, kasa ve topluluk araçları", "Yayın zekâsı ve izleyici nabzı", "İçerik dönüştürme ve akıllı uyarılar", "Medya kiti, gelir kokpiti ve anlık görüntüler", "WINDOWS 10/11 · SÜRÜM 0.14.4"]
    .forEach((source, index) => { critical[language][source] = values[index]; });
  critical[language]["PLAY STREAMERS WEB · v10.15.0"] = "PLAY STREAMERS WEB · v10.15.0";
});

const criticalMemberSurfaceSources = [
  "Veriler", "SW Profil", "SW Güvenlik", "Cihazlar", "Bağlantılar", "Destek talepleri",
  "BAĞLANTI DURUMU", "Kick hesabın bağlı", "Henüz Kick bağlantısı yok", "bağlı",
  "{count} bağlantı aktif", "Henüz bağlantı kurulmadı", "Kick bağlantısı kur",
  "OTURUMU KAPAT", "Çıkış yapmak istiyor musun?",
  "Bu cihazdaki oturumun kapatılacak. Tekrar giriş yaparak hesabına dönebilirsin.",
  "Vazgeç", "Çıkış yap", "Çıkış yapılıyor…", "Hesap merkezini kapat", "Hesap bölümleri",
  "Yayının kapansa da geçmişin hazır.",
  "Doğrulanmış oturumlar ve izleyici örnekleri sunucuda işlenir.",
  "Kur bilgisi", "GÜNCEL KUR", "Referans kur", "Para birimi",
  "Bağışlar güncel merkez bankası referans kurlarıyla hesaplanır."
];
const criticalMemberSurfaceCopy = Object.freeze({
  en: ["Data", "SW Profile", "SW Security", "Devices", "Connections", "Support requests", "CONNECTION STATUS", "Your Kick account is connected", "No Kick connection yet", "connected", "{count} active connections", "No connection yet", "Connect Kick", "SIGN OUT", "Do you want to sign out?", "Your session on this device will end. You can return to your account by signing in again.", "Stay signed in", "Sign out", "Signing out…", "Close account center", "Account sections", "Even after your stream ends, your history is ready.", "Verified sessions and audience samples are processed on the server.", "Exchange rates", "LIVE RATE", "Reference rate", "Currency", "Donations are calculated using current central-bank reference rates."],
  de: ["Daten", "SW-Profil", "SW-Sicherheit", "Geräte", "Verbindungen", "Supportanfragen", "VERBINDUNGSSTATUS", "Dein Kick-Konto ist verbunden", "Noch keine Kick-Verbindung", "verbunden", "{count} aktive Verbindungen", "Noch keine Verbindung", "Kick verbinden", "ABMELDEN", "Möchtest du dich abmelden?", "Deine Sitzung auf diesem Gerät wird beendet. Du kannst dich erneut anmelden, um zu deinem Konto zurückzukehren.", "Angemeldet bleiben", "Abmelden", "Abmeldung läuft…", "Kontocenter schließen", "Kontobereiche", "Auch nach Ende deines Streams bleibt dein Verlauf verfügbar.", "Verifizierte Sitzungen und Zuschauerstichproben werden auf dem Server verarbeitet.", "Wechselkurse", "LIVE-KURS", "Referenzkurs", "Währung", "Spenden werden mit aktuellen Referenzkursen der Zentralbanken berechnet."],
  es: ["Datos", "Perfil SW", "Seguridad SW", "Dispositivos", "Conexiones", "Solicitudes de soporte", "ESTADO DE CONEXIÓN", "Tu cuenta de Kick está conectada", "Aún no hay conexión con Kick", "conectado", "{count} conexiones activas", "Aún no hay ninguna conexión", "Conectar Kick", "CERRAR SESIÓN", "¿Quieres cerrar sesión?", "Se cerrará la sesión de este dispositivo. Puedes volver a tu cuenta iniciando sesión de nuevo.", "Seguir conectado", "Cerrar sesión", "Cerrando sesión…", "Cerrar centro de cuenta", "Secciones de la cuenta", "Aunque termine tu directo, tu historial seguirá disponible.", "Las sesiones verificadas y las muestras de audiencia se procesan en el servidor.", "Tipos de cambio", "TIPO ACTUAL", "Tipo de referencia", "Moneda", "Las donaciones se calculan con los tipos de referencia actuales de los bancos centrales."],
  fr: ["Données", "Profil SW", "Sécurité SW", "Appareils", "Connexions", "Demandes d’assistance", "ÉTAT DES CONNEXIONS", "Votre compte Kick est connecté", "Aucune connexion Kick pour le moment", "connecté", "{count} connexions actives", "Aucune connexion pour le moment", "Connecter Kick", "SE DÉCONNECTER", "Voulez-vous vous déconnecter ?", "Votre session sur cet appareil sera fermée. Vous pourrez retrouver votre compte en vous reconnectant.", "Rester connecté", "Se déconnecter", "Déconnexion…", "Fermer le centre de compte", "Sections du compte", "Même après la fin du direct, votre historique reste disponible.", "Les sessions vérifiées et les échantillons d’audience sont traités sur le serveur.", "Taux de change", "TAUX ACTUEL", "Taux de référence", "Devise", "Les dons sont calculés selon les taux de référence actuels des banques centrales."],
  ru: ["Данные", "Профиль SW", "Безопасность SW", "Устройства", "Подключения", "Обращения в поддержку", "СОСТОЯНИЕ ПОДКЛЮЧЕНИЙ", "Аккаунт Kick подключён", "Kick ещё не подключён", "подключено", "Активных подключений: {count}", "Подключений пока нет", "Подключить Kick", "ВЫЙТИ", "Выйти из аккаунта?", "Сеанс на этом устройстве будет завершён. Чтобы вернуться в аккаунт, войдите снова.", "Остаться", "Выйти", "Выход…", "Закрыть центр аккаунта", "Разделы аккаунта", "Даже после завершения трансляции история останется доступна.", "Проверенные сеансы и выборки аудитории обрабатываются на сервере.", "Курсы валют", "ТЕКУЩИЙ КУРС", "Справочный курс", "Валюта", "Суммы пожертвований рассчитываются по актуальным справочным курсам центральных банков."],
  ar: ["البيانات", "ملف SW", "أمان SW", "الأجهزة", "الاتصالات", "طلبات الدعم", "حالة الاتصال", "حساب Kick متصل", "لم يتم ربط Kick بعد", "متصل", "اتصالات نشطة: {count}", "لا توجد اتصالات بعد", "ربط Kick", "تسجيل الخروج", "هل تريد تسجيل الخروج؟", "ستنتهي جلستك على هذا الجهاز. يمكنك العودة إلى حسابك بتسجيل الدخول مرة أخرى.", "البقاء مسجّلًا", "تسجيل الخروج", "جارٍ تسجيل الخروج…", "إغلاق مركز الحساب", "أقسام الحساب", "حتى بعد انتهاء البث، سيظل السجل متاحًا.", "تُعالَج الجلسات الموثقة وعينات الجمهور على الخادم.", "أسعار الصرف", "السعر الحالي", "السعر المرجعي", "العملة", "تُحسب التبرعات وفق أحدث الأسعار المرجعية للبنوك المركزية."],
  ja: ["データ", "SWプロフィール", "SWセキュリティ", "デバイス", "接続", "サポート依頼", "接続状況", "Kickアカウントは接続済みです", "Kickはまだ接続されていません", "接続済み", "有効な接続：{count}件", "まだ接続されていません", "Kickを接続", "ログアウト", "ログアウトしますか？", "このデバイスのセッションを終了します。再度ログインするとアカウントに戻れます。", "ログインを続ける", "ログアウト", "ログアウト中…", "アカウントセンターを閉じる", "アカウントのセクション", "配信が終了しても履歴は利用できます。", "確認済みセッションと視聴者サンプルはサーバーで処理されます。", "為替レート", "現在のレート", "基準レート", "通貨", "寄付額は中央銀行の最新の基準レートで換算されます。"]
});
Object.entries(criticalMemberSurfaceCopy).forEach(([language, values]) => {
  criticalMemberSurfaceSources.forEach((source, index) => { critical[language][source] = values[index]; });
});
Object.assign(critical.ar, {
  "01 · CANLI MERKEZ": "01 · المركز المباشر",
  "02 · CANLI ZEKA": "02 · ذكاء البث المباشر",
  "45 HAZIR ARAÇ": "45 أداة جاهزة",
  "AKILLI BİLDİRİMLER": "إشعارات ذكية",
  "Canlı olay merkezi": "مركز الأحداث المباشرة",
  "CMD PENCERESİ YOK": "من دون نافذة CMD",
  "Free, Pro ve Product Pro içinde içerik, topluluk, marka, gelir, analiz ve yerel kasa araçları.": "أدوات للمحتوى والمجتمع والعلامة التجارية والإيرادات والتحليلات والتخزين المحلي ضمن خطط Free وPro وProduct Pro.",
  "Kanıtlı karşılaştırmalar, AI açıklaması, topluluk sistemleri, medya kiti ve doğrulanmış gelir görünümleri.": "مقارنات موثقة وشروحات بالذكاء الاصطناعي وأنظمة للمجتمع وحزمة إعلامية وعروض إيرادات موثقة.",
  "Masaüstü sürüm durumu": "حالة إصدار سطح المكتب",
  "Masaüstü uygulaması özellikleri": "ميزات تطبيق سطح المكتب",
  "PLAY CONNECT DESTEKLERİ": "دعم PLAY CONNECT",
  "Site hesap ve ürün merkezi": "مركز الحساب والمنتجات على الموقع",
  "ÜRÜN AİLESİ": "عائلة المنتجات",
  "WINDOWS MASAÜSTÜ UYGULAMASI": "تطبيق سطح المكتب لنظام WINDOWS",
  "Yayın oturumlarını, etkileşimi ve değişimleri doğrulanmış veriler üzerinden karşılaştır.": "قارن جلسات البث والتفاعل والتغيّرات اعتمادًا على بيانات موثقة."
});
Object.assign(critical.ar, {
  "Bilgi sayfalarındaki giriş/kayıt pencereleri bulunduğu sayfada açılıyor; Google ve Kick sosyal girişleri yeniden yan yana çalışıyor.": "تُفتح نوافذ تسجيل الدخول وإنشاء الحساب داخل صفحة المعلومات الحالية، وعاد تسجيل الدخول عبر Google وKick للعمل جنبًا إلى جنب.",
  "Doğrulama sonrası yinelenen geçiş kaldırıldı; giriş ve kayıt ekranlarındaki Kick ile devam düğmesi kaldırıldı.": "أُزيل الانتقال المتكرر بعد التحقق، كما أُزيل زر المتابعة عبر Kick من شاشتي تسجيل الدخول وإنشاء الحساب.",
  "Donate olaylarının ayrı büyütme simgesi kaldırıldı; ayrıntı artık donate satırının tamamına tıklanarak açılıyor.": "أُزيل رمز التكبير المنفصل لأحداث التبرع؛ ويمكن الآن فتح التفاصيل بالنقر على صف التبرع كاملًا.",
  "Genel arayüz onarımının canlı sayaçlarda tekrar tekrar çalışarak oluşturduğu titreme ve yeniden çizim döngüsü kaldırıldı; Google girişi, dil menüsü ve ikinci ana sayfa tekil etkileşim katmanına alındı.": "أُزيلت حلقة الوميض وإعادة الرسم التي كان يسببها إصلاح الواجهة المتكرر في العدادات المباشرة؛ ووُحّدت تفاعلات تسجيل الدخول عبر Google وقائمة اللغة والصفحة الرئيسية الثانية.",
  "Ko-fi, Buy Me a Coffee, Patreon, Fourthwall, TipeeeStream, DonationAlerts ve Pally.gg global platform listesine eklendi; bütün sağlayıcılara görsel ikon verildi.": "أُضيفت منصات Ko-fi وBuy Me a Coffee وPatreon وFourthwall وTipeeeStream وDonationAlerts وPally.gg إلى القائمة العالمية، وأصبح لكل مزود رمز مرئي.",
  "Play Streamers Donate Connector Chrome eklentisi; ByNoGame, Klasgame, Streamlabs, StreamElements ve Diğerleri platform listesiyle eklendi.": "أُضيفت إضافة Play Streamers Donate Connector لمتصفح Chrome مع قائمة منصات تشمل ByNoGame وKlasgame وStreamlabs وStreamElements وخيار منصات أخرى.",
  "Site ve Chrome eklentisi bağlantı kesme durumu iki yönlü eşitlendi; yinelenen eski Chrome cihaz kayıtları temizlendi.": "تتم الآن مزامنة حالة قطع الاتصال بين الموقع وإضافة Chrome في الاتجاهين، كما حُذفت سجلات أجهزة Chrome القديمة المكررة.",
  "SSB platform seçicisi özel açılır menüyle yenilendi, DAB ve platform logo yedekleri düzeltildi; Play Connect merkezi DAB bağlantılarını artık sade biçimde gösteriyor.": "جُدّد محدد منصات SSB بقائمة منسدلة مخصصة، وأُصلحت بدائل شعارات DAB والمنصات؛ كما يعرض مركز Play Connect اتصالات DAB بصورة أبسط.",
  "Sunucuya doğrudan bağlı platformların eklentide ikinci kez taranması engellendi; tüm kaynaklar aynı D1 olay kaydı, kimlik denetimi ve Dashboard Donate toplamında birleştirildi.": "مُنعت الإضافة من فحص المنصات المتصلة مباشرةً بالخادم مرة ثانية، ووُحّدت جميع المصادر في سجل أحداث D1 نفسه والتحقق من الهوية وإجمالي التبرعات في لوحة التحكم.",
  "TipeeeStream DAB logosu gömülü güvenli kaynağa sabitlendi; Play Connect DAB görünümünün sayfa yüksekliğini bozması engellendi.": "ثُبّت شعار TipeeeStream DAB على مصدر آمن مضمّن، ومُنع عرض Play Connect DAB من التأثير في ارتفاع الصفحة."
});

function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
const TURKISH_TERMS = new Set(["giriş", "kayıt", "hakkımızda", "ürünlerimiz", "nasıl", "çalışır", "içerik", "planlama", "canlı", "analiz", "topluluk", "marka", "araçları", "gelir", "görünümleri", "yayın", "yayıncı", "hesap", "şifre", "doğrula", "indir", "destek", "sistem", "durumu", "ziyaretçi", "şu", "anda", "aktif", "hemen", "başla", "keşfet", "daha", "fazla", "burada", "mısın", "beni", "hatırla"]);
function containsTurkishCopy(value) {
  const source = clean(value);
  // Ö/Ü/Ç are valid in several target languages (especially German and
  // French). Only Turkish-specific letters are a definitive signal; common
  // Latin letters are handled by the word-level check below.
  if (/[ĞİŞğış]/u.test(source)) return true;
  const normalized = source.toLocaleLowerCase("tr-TR");
  const matches = new Set(normalized.split(/[^a-zçğıöşü]+/u).filter(word => TURKISH_TERMS.has(word)));
  return matches.size >= 2;
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

function loadCatalog(language) {
  if (language === "tr" || !SUPPORTED.has(language)) return Promise.resolve({});
  if (catalogPromises.has(language)) return catalogPromises.get(language);
  const request = fetch(`/locales/${language}.json?v=${encodeURIComponent(CATALOG_VERSION)}`, {
    cache: "force-cache",
    credentials: "omit",
  }).then(async response => {
    if (!response.ok) throw new Error(`catalog-${response.status}`);
    const payload = await response.json();
    if (payload?.version !== CATALOG_VERSION || payload?.language !== language || !payload?.translations) {
      throw new Error("catalog-version-mismatch");
    }
    return Object.fromEntries(Object.entries(payload.translations)
      .map(([source, translated]) => [clean(source), clean(translated)])
      .filter(([source, translated]) => source && translationLooksComplete(source, translated, language)));
  }).catch(() => {
    catalogPromises.delete(language);
    return {};
  });
  catalogPromises.set(language, request);
  return request;
}

async function warmCatalogs(activeLanguage, preferredLanguage = "") {
  const languages = [...SUPPORTED].filter(language => language !== "tr" && language !== activeLanguage);
  if (languages.includes(preferredLanguage)) {
    languages.splice(languages.indexOf(preferredLanguage), 1);
    languages.unshift(preferredLanguage);
  }
  const results = [];
  // Dil paketlerini tek karede indirip ayrıştırmak yerine boş ana iş parçacığı
  // dilimlerine yay. Seçilen dil yine `loadCatalog` üzerinden anında öne geçer.
  for (const language of languages) {
    await new Promise(resolve => {
      if (typeof requestIdleCallback === "function") requestIdleCallback(resolve, { timeout: 1400 });
      else window.setTimeout(resolve, 220);
    });
    results.push(await loadCatalog(language));
  }
  return results;
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
      if (typeof window.psSetLocale === "function") await window.psSetLocale(suggested, { source: "auto" });
      else {
        document.documentElement.classList.add("ps-i18n-booting");
        location.reload();
      }
    }
  } catch { /* Browser language remains the privacy-safe fallback. */ }
}

export function installLiveI18n({ localeKey = "ps15-locale", getLocale, root = document.body, catalog = {} } = {}) {
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
    document.documentElement.dataset.psI18nReady = "1";
    return { language, translate(value) { return String(value ?? ""); }, refresh() {}, dispose() {} };
  }

  const cacheKey = `ps-live-i18n-v16:${language}`;
  // Kalıcı paket, eski tarayıcı önbelleğini ezer; elle doğrulanmış kritik
  // metinler ise her zaman en son sözü söyler.
  const cache = { ...cacheRead(cacheKey), ...catalog, ...(critical[language] || {}) };
  const textState = new Map();
  const attributeState = new Map();
  let titleState = null;
  let queued = false;
  let running = false;
  let disposed = false;
  let ready = false;
  const finishBoot = () => {
    if (disposed) return;
    if (ready) return;
    ready = true;
    window.clearTimeout(bootSafetyTimer);
    document.documentElement.classList.remove("ps-i18n-booting");
    document.documentElement.dataset.psI18nReady = "1";
    window.dispatchEvent(new CustomEvent("ps:i18n-ready", { detail: { language } }));
  };
  const bootSafetyTimer = window.setTimeout(finishBoot, 1800);

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
  const applyTitle = (translated, source) => {
    document.title = translated;
    titleState = { source, translated };
  };

  // Dil değişiminde çalışan sayfayı Türkçeden çevirmiyoruz. Arayüz yalnızca
  // yayın öncesinde hazırlanmış, sürümlü dil paketinden boyanır. Böylece İngilizce
  // seçildiğinde ağ/AI beklemesi olmadan doğrudan İngilizce arayüz açılır.
  const requestTranslations = async strings => strings.map(() => "");

  const collect = () => {
    const targets = [];
    const currentTitle = clean(document.title);
    const titleSource = titleState && titleState.translated !== currentTitle ? currentTitle : titleState?.source || currentTitle;
    if (translatable(titleSource) && titleState?.translated !== currentTitle) targets.push({ type: "title", source: titleSource });
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
      if (target.type === "title") return 0;
      const element = target.type === "text" ? target.node.parentElement : target.element;
      if (!element) return 4;
      if (element.closest("#landingAuthModal:not([hidden]),#authOverlay .ps8-home")) return 0;
      if (element.getClientRects().length && !element.closest("[hidden]")) {
        const rect = element.getBoundingClientRect();
        if (rect.bottom >= -24 && rect.top <= innerHeight + 24) return 1;
        return 2;
      }
      return 3;
    };
    return targets.sort((left, right) => priority(left) - priority(right));
  };

  const applyCachedTargets = targets => targets.forEach(target => {
    const translated = cache[target.source];
    if (!translated) return;
    if (target.type === "text" && target.node.isConnected) applyText(target.node, translated);
    else if (target.type === "attribute" && target.element.isConnected) applyAttribute(target.element, target.name, translated, target.source);
    else if (target.type === "title") applyTitle(translated, target.source);
  });

  const translate = async () => {
    if (disposed) return;
    if (running) { queued = true; return; }
    queued = false;
    running = true;
    try {
      const targets = collect();
      // Canlı arayüz yalnızca sürümlü yerel paketten boyanır. Eksik bir metin
      // için sonuç üretmeyen ağ grupları veya tam belge kurtarma turları
      // çalıştırmak, dil seçildikten sonra sayfayı gereksiz yere meşgul ediyordu.
      applyCachedTargets(targets);
      finishBoot();
    } finally {
      running = false;
      if (queued) window.setTimeout(translate, 72);
    }
  };
  const schedule = () => {
    if (disposed || queued) return;
    queued = true;
    // Bir DOM dalgasında yüzlerce metin değişse bile yalnızca tek tarama yap.
    window.setTimeout(translate, 36);
  };
  const mutationNeedsTranslation = record => {
    if (record.type === "characterData") return translatable(clean(record.target.nodeValue));
    if (record.type === "attributes") return translatable(clean(record.target.getAttribute(record.attributeName)));
    return [...record.addedNodes].some(node => {
      if (node.nodeType === Node.TEXT_NODE) return translatable(clean(node.nodeValue));
      if (node.nodeType !== Node.ELEMENT_NODE || node.matches?.(SKIP_TEXT_SELECTOR)) return false;
      return translatable(clean(node.textContent));
    });
  };
  const observer = new MutationObserver(records => {
    if (records.some(mutationNeedsTranslation)) schedule();
  });
  // `hidden` yalnız görünürlüğü değiştirir; metni değiştirmez. Menü, tooltip ve
  // Dashboard kartlarının her açılışında tüm belgeyi yeniden taramamak için bu
  // öznitelik artık çeviri gözlemcisini uyandırmaz.
  observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label", "aria-description", "alt", "data-ps-tooltip"] });
  schedule();
  return {
    language,
    translate(value) { const source = clean(value); return cache[source] || source; },
    refresh: schedule,
    dispose({ restore = false } = {}) {
      disposed = true;
      observer.disconnect();
      window.clearTimeout(bootSafetyTimer);
      if (!restore) return;
      for (const [node, record] of textState) {
        if (!node.isConnected) continue;
        const current = String(node.nodeValue || "");
        const leading = current.match(/^\s*/)?.[0] || "";
        const trailing = current.match(/\s*$/)?.[0] || "";
        node.nodeValue = `${leading}${record.source}${trailing}`;
      }
      for (const [element, records] of attributeState) {
        if (!element.isConnected) continue;
        Object.entries(records).forEach(([name, record]) => element.setAttribute(name, record.source));
      }
      if (titleState) document.title = titleState.source;
    },
  };
}

if (typeof window !== "undefined" && document.body && !location.protocol.startsWith("chrome-extension")) {
  void (async () => {
    const stored = String(localStorage.getItem("ps15-locale") || "").toLowerCase();
    const initialLanguage = SUPPORTED.has(stored) ? stored : browserLocale();
    const initialCatalog = await loadCatalog(initialLanguage);
    let liveI18n = installLiveI18n({ catalog: initialCatalog });
    window.psLiveI18n = liveI18n;
    window.psTranslateInterface = value => liveI18n.translate(value);
    window.psSetLocale = async (nextLanguage, { source = "user" } = {}) => {
      const language = String(nextLanguage || "").toLowerCase();
      if (!SUPPORTED.has(language)) return false;
      localStorage.setItem("ps15-locale", language);
      localStorage.setItem("ps-locale-source", source);
      if (liveI18n.language === language) { liveI18n.refresh(); return true; }
      window.dispatchEvent(new CustomEvent("ps:locale-will-change", { detail: { language, source, previousLanguage: liveI18n.language } }));
      document.documentElement.classList.add("ps-locale-switching");
      delete document.documentElement.dataset.psI18nReady;
      const safety = window.setTimeout(() => {
        document.documentElement.classList.remove("ps-locale-switching", "ps-i18n-booting");
        document.documentElement.dataset.psI18nReady = "1";
        window.psRescueVisibleSurface?.();
      }, 2200);
      try {
        const catalog = await loadCatalog(language);
        liveI18n.dispose({ restore: true });
        liveI18n = installLiveI18n({ getLocale: () => language, catalog });
        window.psLiveI18n = liveI18n;
        liveI18n.refresh();
        window.dispatchEvent(new CustomEvent("ps:locale-change", { detail: { language, source } }));
        return true;
      } finally {
        window.clearTimeout(safety);
        document.documentElement.classList.remove("ps-locale-switching", "ps-i18n-booting");
        document.documentElement.dataset.psI18nReady = "1";
      }
    };
    let catalogWarmPromise = null;
    const warm = preferred => {
      if (!catalogWarmPromise) catalogWarmPromise = warmCatalogs(liveI18n.language, preferred);
      return catalogWarmPromise;
    };
    window.psWarmLocaleCatalogs = preferred => warm(String(preferred || "").toLowerCase());
    window.addEventListener("ps:i18n-refresh", () => liveI18n.refresh());
    window.addEventListener("ps-route-change", () => liveI18n.refresh());
    const warmOnLocaleIntent = event => {
      const target = event.target instanceof Element ? event.target.closest('[data-language],[data-ps15-lang],.ps41-locale-button,.ps15-locale-button') : null;
      if (!target) return;
      document.removeEventListener("pointerover", warmOnLocaleIntent, true);
      document.removeEventListener("focusin", warmOnLocaleIntent, true);
      void warm(target.dataset.language || target.dataset.ps15Lang || "");
    };
    document.addEventListener("pointerover", warmOnLocaleIntent, { capture: true, passive: true });
    document.addEventListener("focusin", warmOnLocaleIntent, true);
    window.setTimeout(() => { void warm(""); }, 8_000);
    void detectCountryLocale(liveI18n.language, "ps15-locale");
  })();
}
