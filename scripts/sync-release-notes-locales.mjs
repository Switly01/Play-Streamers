import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourcePath = resolve(root, 'release-notes-family.json');
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const languages = ['tr', 'en', 'de', 'es', 'fr', 'ru', 'ar', 'ja'];
const translatableFields = new Set(['eyebrow', 'title', 'intro', 'latest', 'beta', 'fullRelease', 'close', 'done', 'expand', 'collapse', 'language', 'memberHome', 'currentVersion', 'loading', 'name', 'tabTitle', 'summary']);

const catalogs = Object.fromEntries(await Promise.all(languages.slice(1).map(async language => {
  const value = JSON.parse(await readFile(resolve(root, 'locales', `${language}.json`), 'utf8'));
  return [language, value.translations || {}];
})));
const passthrough = new Set(['Play Streamers Web', 'Play Streamers App', 'Play Connect', 'SW Identity', 'SW Create']);
const updateNotesLabels = {
  tr:'Güncelleme Notları', en:'Update Notes', de:'Aktualisierungshinweise', es:'Notas de actualización',
  fr:'Notes de mise à jour', ru:'Примечания к обновлению', ar:'ملاحظات التحديث', ja:'更新情報',
};
const reviewedUi = {
  en: { eyebrow:'PRODUCT UPDATE ARCHIVE', title:'Update Notes', intro:'Explore every new feature and fix by product, starting with the latest release.', latest:'LATEST RELEASE', beta:'BETA', fullRelease:'STABLE RELEASE', close:'Close', done:'Done', expand:'Expand details', collapse:'Collapse details', language:'Language selection', memberHome:'Member home', currentVersion:'CURRENT VERSION', loading:'PREPARING UPDATE ARCHIVE…' },
  de: { eyebrow:'PRODUKT-UPDATE-ARCHIV', title:'Aktualisierungshinweise', intro:'Alle Neuerungen und Korrekturen nach Produkt sortiert – beginnend mit der neuesten Version.', latest:'NEUESTE VERSION', beta:'BETA', fullRelease:'STABILE VERSION', close:'Schließen', done:'Fertig', expand:'Details einblenden', collapse:'Details ausblenden', language:'Sprachauswahl', memberHome:'Mitglieder-Startseite', currentVersion:'AKTUELLE VERSION', loading:'UPDATE-ARCHIV WIRD VORBEREITET…' },
  es: { eyebrow:'ARCHIVO DE ACTUALIZACIONES DE PRODUCTOS', title:'Notas de actualización', intro:'Consulta todas las novedades y correcciones por producto, empezando por la versión más reciente.', latest:'VERSIÓN MÁS RECIENTE', beta:'BETA', fullRelease:'VERSIÓN ESTABLE', close:'Cerrar', done:'Listo', expand:'Ampliar detalles', collapse:'Ocultar detalles', language:'Selección de idioma', memberHome:'Inicio del usuario', currentVersion:'VERSIÓN ACTUAL', loading:'PREPARANDO EL ARCHIVO DE ACTUALIZACIONES…' },
  fr: { eyebrow:'ARCHIVES DES MISES À JOUR PRODUIT', title:'Notes de mise à jour', intro:'Découvrez toutes les nouveautés et corrections par produit, en commençant par la version la plus récente.', latest:'DERNIÈRE VERSION', beta:'BÊTA', fullRelease:'VERSION STABLE', close:'Fermer', done:'Terminé', expand:'Afficher les détails', collapse:'Masquer les détails', language:'Sélection de la langue', memberHome:'Accueil membre', currentVersion:'VERSION ACTUELLE', loading:'PRÉPARATION DES ARCHIVES DE MISE À JOUR…' },
  ru: { eyebrow:'АРХИВ ОБНОВЛЕНИЙ ПРОДУКТОВ', title:'Примечания к обновлению', intro:'Ознакомьтесь со всеми новыми функциями и исправлениями по продуктам, начиная с последней версии.', latest:'ПОСЛЕДНЯЯ ВЕРСИЯ', beta:'БЕТА', fullRelease:'СТАБИЛЬНАЯ ВЕРСИЯ', close:'Закрыть', done:'Готово', expand:'Показать подробности', collapse:'Скрыть подробности', language:'Выбор языка', memberHome:'Главная страница пользователя', currentVersion:'ТЕКУЩАЯ ВЕРСИЯ', loading:'ПОДГОТОВКА АРХИВА ОБНОВЛЕНИЙ…' },
  ar: { eyebrow:'أرشيف تحديثات المنتجات', title:'ملاحظات التحديث', intro:'استعرض جميع الميزات الجديدة والإصلاحات حسب المنتج، بدءًا من أحدث إصدار.', latest:'أحدث إصدار', beta:'إصدار تجريبي', fullRelease:'إصدار مستقر', close:'إغلاق', done:'تم', expand:'عرض التفاصيل', collapse:'إخفاء التفاصيل', language:'اختيار اللغة', memberHome:'الصفحة الرئيسية للعضو', currentVersion:'الإصدار الحالي', loading:'جارٍ إعداد أرشيف التحديثات…' },
  ja: { eyebrow:'製品アップデートアーカイブ', title:'更新情報', intro:'製品ごとの新機能と修正内容を、最新バージョンから確認できます。', latest:'最新リリース', beta:'ベータ', fullRelease:'正式リリース', close:'閉じる', done:'完了', expand:'詳細を表示', collapse:'詳細を閉じる', language:'言語選択', memberHome:'メンバーホーム', currentVersion:'現在のバージョン', loading:'更新アーカイブを準備しています…' },
};
const reviewedSummaries = {
  en: {
    web:'A browser-based streaming hub for managing stream data, community activity, connections, and account actions.',
    app:'A Windows desktop workspace for stream preparation, analytics, content, branding, revenue, and account management.',
    connect:'A free Chrome/Chromium and Firefox extension that sends events from supported support and donation platforms to your Play Streamers account.',
    identity:'The shared account, secure sign-in, and product-access system used by SW Create and Play Streamers.',
    swcreate:'A brand and user hub for discovering products, managing the shared SW account, checking product access, and getting support.',
  },
  de: {
    web:'Browserbasierte Streaming-Zentrale zur Verwaltung von Stream-Daten, Community-Aktivitäten, Verbindungen und Kontovorgängen.',
    app:'Windows-Desktop-Arbeitsbereich für Stream-Vorbereitung, Analysen, Inhalte, Marke, Einnahmen und Kontoverwaltung.',
    connect:'Kostenlose Chrome/Chromium- und Firefox-Erweiterung, die Ereignisse unterstützter Support- und Spendenplattformen an das Play Streamers-Konto übermittelt.',
    identity:'Gemeinsames Konto-, Anmelde- und Produktzugriffssystem für SW Create und Play Streamers.',
    swcreate:'Marken- und Benutzerzentrale zum Entdecken von Produkten, Verwalten des gemeinsamen SW-Kontos, Prüfen von Produktzugriffen und Abrufen von Support.',
  },
  es: {
    web:'Centro de streaming en el navegador para gestionar datos de emisión, actividad de la comunidad, conexiones y operaciones de la cuenta.',
    app:'Espacio de trabajo de Windows para preparar emisiones y gestionar análisis, contenido, marca, ingresos y cuenta.',
    connect:'Extensión gratuita para Chrome/Chromium y Firefox que envía a tu cuenta de Play Streamers los eventos de las plataformas de apoyo y donaciones compatibles.',
    identity:'Sistema compartido de cuenta, inicio de sesión seguro y acceso a productos utilizado por SW Create y Play Streamers.',
    swcreate:'Centro de marca y usuario para descubrir productos, gestionar la cuenta SW compartida, consultar accesos y obtener asistencia.',
  },
  fr: {
    web:'Centre de streaming dans le navigateur pour gérer les données de diffusion, l’activité de la communauté, les connexions et le compte.',
    app:'Espace de travail Windows pour préparer les diffusions et gérer les analyses, le contenu, la marque, les revenus et le compte.',
    connect:'Extension gratuite pour Chrome/Chromium et Firefox qui transmet à votre compte Play Streamers les événements des plateformes de soutien et de dons compatibles.',
    identity:'Système partagé de compte, de connexion sécurisée et d’accès aux produits utilisé par SW Create et Play Streamers.',
    swcreate:'Centre de marque et d’utilisateur pour découvrir les produits, gérer le compte SW partagé, vérifier les accès et obtenir de l’aide.',
  },
  ru: {
    web:'Браузерный центр для управления данными трансляций, активностью сообщества, подключениями и действиями с аккаунтом.',
    app:'Рабочее пространство Windows для подготовки трансляций и управления аналитикой, контентом, брендом, доходами и аккаунтом.',
    connect:'Бесплатное расширение для Chrome/Chromium и Firefox, которое передаёт события поддерживаемых платформ поддержки и пожертвований в аккаунт Play Streamers.',
    identity:'Единая система аккаунта, безопасного входа и доступа к продуктам SW Create и Play Streamers.',
    swcreate:'Центр бренда и пользователя для поиска продуктов, управления общим аккаунтом SW, проверки доступа и получения поддержки.',
  },
  ar: {
    web:'مركز بث عبر المتصفح لإدارة بيانات البث ونشاط المجتمع والاتصالات وإجراءات الحساب.',
    app:'مساحة عمل على Windows لإعداد البث وإدارة التحليلات والمحتوى والعلامة التجارية والإيرادات والحساب.',
    connect:'إضافة مجانية لمتصفحي Chrome/Chromium وFirefox تنقل أحداث منصات الدعم والتبرعات المتوافقة إلى حساب Play Streamers.',
    identity:'نظام الحساب المشترك وتسجيل الدخول الآمن والوصول إلى المنتجات المستخدم في SW Create وPlay Streamers.',
    swcreate:'مركز للعلامة التجارية والمستخدم لاكتشاف المنتجات وإدارة حساب SW المشترك والتحقق من الوصول والحصول على الدعم.',
  },
  ja: {
    web:'配信データ、コミュニティ活動、接続、アカウント操作をブラウザで管理するための配信ハブです。',
    app:'配信準備、分析、コンテンツ、ブランド、収益、アカウント管理を行うWindowsデスクトップワークスペースです。',
    connect:'対応する支援・寄付プラットフォームのイベントをPlay Streamersアカウントへ送信する、Chrome/ChromiumおよびFirefox向けの無料拡張機能です。',
    identity:'SW CreateとPlay Streamersで共通利用する、アカウント、安全なログイン、製品アクセスのためのシステムです。',
    swcreate:'製品の検索、共通SWアカウントの管理、製品アクセスの確認、サポート利用のためのブランド・ユーザーハブです。',
  },
};

function localize(value, language, field = '') {
  if (Array.isArray(value)) return value.map(item => localize(item, language, field));
  if (!value || typeof value !== 'object') {
    if (language === 'tr' || typeof value !== 'string') return value;
    if (field !== 'items' && !translatableFields.has(field)) return value;
    const translated = catalogs[language][value];
    if (!translated || (translated === value && !passthrough.has(value))) throw new Error(`[${language}] eksik güncelleme çevirisi: ${value}`);
    return translated;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localize(item, language, key)]));
}

const localizedLocales = Object.fromEntries(languages.map(language => [language, localize(source, language)]));
for (const language of languages) {
  if (reviewedUi[language]) Object.assign(localizedLocales[language].ui, reviewedUi[language]);
  for (const [key, product] of Object.entries(source.products)) {
    localizedLocales[language].products[key].name = product.name;
    localizedLocales[language].products[key].tabTitle = `${product.name} ${updateNotesLabels[language]}`;
    if (reviewedSummaries[language]?.[key]) localizedLocales[language].products[key].summary = reviewedSummaries[language][key];
  }
}
const localized = {
  schemaVersion: source.schemaVersion,
  locales: localizedLocales,
};
const outputPath = resolve(root, 'release-notes-family.localized.json');
await writeFile(outputPath, `${JSON.stringify(localized, null, 2)}\n`, 'utf8');

for (const target of [
  resolve(root, 'play-connect', 'release-notes-family.localized.json'),
  resolve(root, 'play-streamers-desktop', 'src', 'release-notes-family.localized.json'),
  resolve(root, 'swcreate-site', 'src', 'release-notes-family.localized.json'),
]) {
  await mkdir(dirname(target), { recursive: true });
  await copyFile(outputPath, target);
}
console.log(`Güncelleme notları ${languages.length} dilde eşitlendi.`);
