import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { critical, translationLooksComplete } from '../live-i18n.js';
import { createRequire } from 'node:module';

const ts = createRequire(new URL('../swcreate-site/package.json', import.meta.url))('typescript');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(root, 'locales');
const version = '2026-09-04.2';
const languages = ['en', 'de', 'es', 'fr', 'ru', 'ar', 'ja'];
const sourceFiles = ['index.html', 'privacy.html', 'terms.html', 'app.js', 'app-final.js', 'site-v7.js', 'server-analytics.js'];
const extractionFiles = new Set(sourceFiles);
const dryRun = process.argv.includes('--dry-run');
const noGenerate = process.argv.includes('--no-generate');
const refreshAll = process.argv.includes('--refresh-all');
const localTranslator = join(root, 'scripts', 'local-i18n-translator.py');
const localOverrides = JSON.parse(readFileSync(join(root, 'scripts', 'i18n-overrides.json'), 'utf8'));
const reviewed = JSON.parse(readFileSync(join(root, 'scripts', 'i18n-reviewed.json'), 'utf8'));
for (const [source, ...values] of reviewed.entries) {
  if (values.length !== reviewed.languages.length) throw new Error(`Incomplete reviewed translation: ${source}`);
  reviewed.languages.forEach((language, index) => { localOverrides[language][source] = values[index]; });
}

const clean = value => String(value || '').replace(/\\n|\\r|\\t/g, ' ').replace(/\s+/g, ' ').trim();
const decode = value => clean(String(value || '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>'));
const passthrough = value => /^(?:(?:PLAY STREAMERS|SW CREATE)(?:\s+(?:APP|WEB|PLANS|FREE|PRO|PRODUCT PRO|FREE EDITION|PRO EDITION|PRODUCT PRO EDITION))?|PLAY CONNECT|PLAY|STREAMERS|SW IDENTITY|SW BOT|SW AI|PRODUCT PRO|FREE|PRO|DONATE|PC|PS|APP|WEB|CONNECT|HTTP|HTTPS|API|OBS|KICK|WINDOWS)$/i.test(clean(value))
  || /^(?:ps\d+[a-z0-9-]*|Developed by)$/i.test(clean(value))
  || /^(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.|(?:api\.)?[a-z0-9-]+(?:\.[a-z0-9-]+){1,}|chrome\.storage\.local$)/i.test(clean(value))
  || /^(?:cookies|notifications|offscreen|storage|webRequest):$/i.test(clean(value))
  || /^(?:ByNoGame|Dashboard|English|Language|Menü|Windows 10\/11|PRO EDITION|Pro Edition|Product Pro Edition|SW Bot \+ SW AI|PLAY STREAMERS · SW CREATE|Play Connect · SW Create)$/i.test(clean(value))
  || /^(?:©\s*\d{4}\s+SW Create\s*·\s*Play Streamers|APP\s+v[\d.]+\s*·\s*Windows\s+10\/11\s*·\s*64\s*bit)$/i.test(clean(value))
  || /^[\d\s.,:%+\-/–—()]+(?:MB|KB|GB|K)?$/i.test(clean(value));
const translatable = value => {
  const text = clean(value);
  if (passthrough(text) || text.length < 2 || text.length > 1200 || /^(?:["']?>)+/.test(text)) return false;
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(text)) return false;
  if (/^(?:https?:|www\.|[\w.+-]+@[\w.-]+\.|[\d\s.,:%+\-/]+$)/i.test(text)) return false;
  if (/^(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|SELECT|INSERT|UPDATE|CREATE|DROP)\b/i.test(text)) return false;
  return true;
};
const turkishInterfaceTerms = new Set('ana geri dön giriş kayıt hesap şifre kullanıcı eposta doğum tarih güvenlik doğrulama doğrulamayı aşamalı etkinleştir kurtarma kod kodları kodlarını yenile destek mesaj konu gönder gizlilik kullanım koşulları sistem durum güncelleme bildirim bağlantı yayın yayıncı içerik topluluk marka araç veri ziyaretçi aktif ücretsiz indir oluştur keşfet hemen başla kapat tamam iptal hata başarısız bekleniyor hazır yükleniyor görünür ayar menü ürün ürünler abonelik abonelikler masaüstü uygulama uygulaması plan canlı analiz ekler talepler eski yeni son önce sonraki beni hatırla'.split(' '));
function looksLikeTurkishInterface(value) {
  const text = clean(value);
  const literal = text.replace(/\{\d+\}/g, '');
  if (!translatable(text) || /^[.#/[({]/.test(literal.trim()) || /[{}=]|=>|\b(?:const|function|return|querySelector|classList|dataset)\b/.test(literal) || /^ps\d+-/.test(text)) return false;
  if (/[ÇĞİÖŞÜçğıöşü]/u.test(text)) return true;
  const words = text.toLocaleLowerCase('tr-TR').split(/[^a-zçğıöşü]+/u).filter(Boolean);
  return words.some(word => turkishInterfaceTerms.has(word) || ['raporu', 'kaydı', 'kaydet', 'bölüm'].includes(word));
}

function addMarkupStrings(value, target, { requireTurkish = false } = {}) {
  const withoutCode = String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/\$\{[\s\S]*?\}/g, ' __DYNAMIC__ ');
  const attributes = /\b(?:placeholder|title|aria-label|aria-description|alt|value)\s*=\s*(["'])([\s\S]*?)\1/gi;
  for (const match of withoutCode.matchAll(attributes)) {
    const candidate = decode(match[2]);
    if (!candidate.includes('__DYNAMIC__') && (requireTurkish ? looksLikeTurkishInterface(candidate) : translatable(candidate))) target.add(candidate);
  }
  const text = withoutCode.replace(/<[^>]*>/g, '\n');
  for (const part of text.split(/\n+/)) {
    const candidate = decode(part);
    if (!candidate.includes('__DYNAMIC__') && (requireTurkish ? looksLikeTurkishInterface(candidate) : translatable(candidate))) target.add(candidate);
  }
}

function addJavaScriptStrings(value, target) {
  // Parse real JS tokens: quotes in regexes and nested templates must not hide later UI strings.
  const ast = ts.createSourceFile('interface.js', String(value || ''), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const add = text => {
    if (text.includes('<')) addMarkupStrings(text, target, { requireTurkish: true });
    else if (!text.includes('__DYNAMIC__') && looksLikeTurkishInterface(text)) target.add(clean(text));
  };
  const visit = node => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text);
    else if (ts.isTemplateExpression(node)) add(node.head.text + node.templateSpans.map((span, index) => '{' + index + '}' + span.literal.text).join(''));
    ts.forEachChild(node, visit);
  };
  visit(ast);
}

function addActiveRuntimeStrings(file, source, target) {
  const ranges = file === 'app.js' ? [
    ['function refreshInterfaceLanguage', 'window.psOpenLandingAuth'],
    ["home.className='ps-second-home", 'return true;'],
  ] : file === 'app-final.js' ? [
    ['function showUpdates', 'function restorePublicLandingSurface'],
    ['function renderConnectionPanel', 'const infoContent'],
    ['function accountDataCard', 'function updateNotifications'],
    ['function accountDevicesPaneHtml', 'function bindAccountPane'],
    ['function supportPaneHtml', 'function showAccountCenter'],
    ['function showAccountCenter', 'window.ps28OpenConnection'],
    ['function ensureSupport', 'function normalizeTooltips'],
    ['function showPlanTools', 'function ensurePrivacyLinks'],
  ] : [];
  ranges.forEach(([startMarker, endMarker]) => {
    const start = source.indexOf(startMarker);
    if (start < 0) return;
    const end = source.indexOf(endMarker, start + startMarker.length);
    addJavaScriptStrings(source.slice(start, end > start ? end : source.length), target);
  });
  if (file === 'app-final.js') {
    const historyStart = source.indexOf('const history = [');
    const historyEnd = source.indexOf('const notes =', historyStart);
    const historySource = historyStart >= 0 ? source.slice(historyStart, historyEnd > historyStart ? historyEnd : source.length) : '';
    for (const match of historySource.matchAll(/'((?:\\.|[^'\\])*)'/g)) {
      const candidate = clean(match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
      if (candidate.length > 30 && translatable(candidate)) target.add(candidate);
    }
  }
}

function printStats(extracted, rows) {
  console.log(`Arayüz kaynağı: ${extracted.size} benzersiz metin.`);
  const requestedMissing = String(process.argv.find(value => value.startsWith('--missing=')) || '').split('=')[1] || '';
  for (const language of languages) {
    const available = new Map(rows.filter(row => row.language === language).map(row => [clean(row.source_text), clean(row.translation)]));
    Object.entries(critical[language] || {}).forEach(([source, translation]) => available.set(clean(source), clean(translation)));
    Object.entries(localOverrides[language] || {}).forEach(([source, translation]) => available.set(clean(source), clean(translation)));
    const ready = [...extracted].filter(source => translationValid(source, available.get(source), language));
    const missing = [...extracted].filter(source => !translationValid(source, available.get(source), language) && !passthrough(source));
    console.log(`[${language}] hazır ${ready.length}, eksik ${missing.length}`);
    if (requestedMissing === language) console.log(missing.sort((left, right) => left.localeCompare(right, 'tr')).join('\n'));
  }
}

function translationValid(source, translation, language) {
  const output = clean(translation);
  const tokens = value => [...value.matchAll(/\{\d+\}/g)].map(match => match[0]).sort().join(',');
  if (tokens(source) !== tokens(output)) return false;
  if (!output || clean(source).localeCompare(output, undefined, { sensitivity: 'base' }) === 0) return passthrough(source);
  return passthrough(source) || translationLooksComplete(source, output, language);
}

function readLocalCatalogs() {
  return languages.flatMap(language => {
    try {
      const catalog = JSON.parse(readFileSync(join(outputDirectory, `${language}.json`), 'utf8'));
      return Object.entries(catalog.translations || {}).map(([source_text, translation]) => ({ language, source_text, translation }));
    } catch (_) { return []; }
  });
}

function pythonCommand() {
  const configured = String(process.env.I18N_PYTHON || '').trim();
  if (configured) return { command: configured, args: [] };
  if (process.platform === 'win32') return { command: 'py', args: ['-3'] };
  return { command: 'python3', args: [] };
}

async function translateLocally(requests) {
  const workDirectory = await mkdtemp(join(tmpdir(), 'play-streamers-i18n-'));
  const input = join(workDirectory, 'input.json');
  const output = join(workDirectory, 'output.json');
  await writeFile(input, JSON.stringify({ sourceLanguage: 'tr', requests }), 'utf8');
  const python = pythonCommand();
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(python.command, [...python.args, localTranslator, '--input', input, '--output', output], {
        cwd: root,
        env: process.env,
        stdio: ['ignore', 'inherit', 'inherit'],
      });
      child.once('error', error => reject(new Error(`Yerel çeviri motoru başlatılamadı: ${error.message}. I18N_PYTHON ile Python yolunu belirt.`)));
      child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Yerel çeviri motoru ${code} koduyla durdu.`)));
    });
    return JSON.parse(await readFile(output, 'utf8'))?.translations || {};
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const extracted = new Set();
  const corpusParts = [];
  for (const file of sourceFiles) {
    const source = await readFile(join(root, file), 'utf8');
    corpusParts.push(source);
    if (extractionFiles.has(file)) {
      if (file.endsWith('.html')) addMarkupStrings(source, extracted);
      else addJavaScriptStrings(source, extracted);
    }
    addActiveRuntimeStrings(file, source, extracted);
  }
  const corpus = corpusParts.join('\n');
  // Reviewed labels may be assembled dynamically (for example tool counts).
  for (const [source] of reviewed.entries) extracted.add(clean(source));
  for (const dictionary of Object.values(critical)) {
    for (const source of Object.keys(dictionary)) {
      if (corpus.includes(source)) extracted.add(clean(source));
    }
  }
  const rows = readLocalCatalogs();
  for (const row of rows) {
    const source = clean(row.source_text);
    if (source && (translatable(source) || passthrough(source)) && corpus.includes(source)) extracted.add(source);
  }
  if (dryRun) {
    printStats(extracted, rows);
    if (process.argv.includes('--list')) console.log([...extracted].sort((left, right) => left.localeCompare(right, 'tr')).join('\n'));
    return;
  }
  const byLanguage = Object.fromEntries(languages.map(language => [language, new Map()]));
  for (const row of rows) {
    if (!byLanguage[row.language]) continue;
    const source = clean(row.source_text);
    const translation = clean(row.translation);
    if (!source || (!translatable(source) && !passthrough(source)) || (!extracted.has(source) && !corpus.includes(source))) continue;
    if (translationValid(source, translation, row.language)) byLanguage[row.language].set(source, translation);
    extracted.add(source);
  }

  for (const language of languages) {
    for (const [source, translation] of Object.entries(critical[language] || {})) {
      const normalizedSource = clean(source);
      const normalizedTranslation = clean(translation);
      if ((!extracted.has(normalizedSource) && !corpus.includes(normalizedSource))
        || !translationValid(normalizedSource, normalizedTranslation, language)) continue;
      extracted.add(normalizedSource);
      byLanguage[language].set(normalizedSource, normalizedTranslation);
    }
    for (const [source, translation] of Object.entries(localOverrides[language] || {})) {
      const normalizedSource = clean(source);
      const normalizedTranslation = clean(translation);
      if ((!extracted.has(normalizedSource) && !corpus.includes(normalizedSource))
        || !translationValid(normalizedSource, normalizedTranslation, language)) continue;
      extracted.add(normalizedSource);
      byLanguage[language].set(normalizedSource, normalizedTranslation);
    }
  }

  const generationByLanguage = {};
  for (const language of languages) {
    const translations = byLanguage[language];
    const missing = [...extracted].filter(source => !translations.has(source) && !passthrough(source));
    const protectedSources = new Set([
      ...Object.keys(critical[language] || {}),
      ...Object.keys(localOverrides[language] || {}),
    ].map(clean));
    const generationTargets = refreshAll
      ? [...extracted].filter(source => !passthrough(source) && !protectedSources.has(source))
      : missing;
    if (generationTargets.length && !noGenerate) {
      generationByLanguage[language] = generationTargets;
      console.log(`[${language}] ${translations.size} hazır, ${generationTargets.length} metin yerel çeviri motoruyla hazırlanacak.`);
    }
  }
  if (Object.keys(generationByLanguage).length) {
    const generatedByLanguage = await translateLocally(generationByLanguage);
    for (const [language, sources] of Object.entries(generationByLanguage)) {
      const generated = Array.isArray(generatedByLanguage[language]) ? generatedByLanguage[language] : [];
      sources.forEach((source, index) => {
        const translation = clean(generated[index]);
        if (translationValid(source, translation, language)) byLanguage[language].set(source, translation);
      });
    }
  }

  await mkdir(outputDirectory, { recursive: true });
  for (const language of languages) {
    const translations = byLanguage[language];
    const ordered = Object.fromEntries([...translations.entries()].sort(([left], [right]) => left.localeCompare(right, 'tr')));
    const catalog = { version, sourceLanguage: 'tr', language, translations: ordered };
    await writeFile(join(outputDirectory, `${language}.json`), `${JSON.stringify(catalog)}\n`, 'utf8');
    console.log(`[${language}] ${Object.keys(ordered).length} hazır çeviri yazıldı.`);
  }
}

await main();
