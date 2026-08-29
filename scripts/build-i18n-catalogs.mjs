import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { critical } from '../live-i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(root, 'locales');
const version = '2026-08-29.7';
const languages = ['en', 'de', 'es', 'fr', 'ru', 'ar', 'ja'];
const sourceFiles = ['index.html', 'privacy.html', 'terms.html', 'app.js', 'app-final.js', 'site-v7.js'];
const extractionFiles = new Set(['index.html', 'privacy.html', 'terms.html', 'site-v7.js']);
const dryRun = process.argv.includes('--dry-run');
const noGenerate = process.argv.includes('--no-generate');
const refreshAll = process.argv.includes('--refresh-all');
const localTranslator = join(root, 'scripts', 'local-i18n-translator.py');
const localOverrides = JSON.parse(readFileSync(join(root, 'scripts', 'i18n-overrides.json'), 'utf8'));

const clean = value => String(value || '').replace(/\\n|\\r|\\t/g, ' ').replace(/\s+/g, ' ').trim();
const decode = value => clean(String(value || '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>'));
const passthrough = value => /^(?:(?:PLAY STREAMERS|SW CREATE)(?:\s+(?:APP|WEB|PLANS|FREE|PRO|PRODUCT PRO|FREE EDITION|PRO EDITION|PRODUCT PRO EDITION))?|PLAY CONNECT|PLAY|STREAMERS|SW IDENTITY|SW BOT|SW AI|PRODUCT PRO|FREE|PRO|PC|PS|APP|WEB|CONNECT|HTTP|HTTPS|API|OBS|KICK|WINDOWS)(?:\s*[·+:/-].*)?$/i.test(clean(value))
  || /^(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.|(?:api\.)?[a-z0-9-]+(?:\.[a-z0-9-]+){1,}|chrome\.storage\.local$)/i.test(clean(value))
  || /^(?:cookies|notifications|offscreen|storage|webRequest):$/i.test(clean(value))
  || /^(?:ByNoGame|Dashboard|English|Language|Menü|Windows 10\/11|PRO EDITION|Pro Edition|Product Pro Edition)$/i.test(clean(value))
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
const turkishInterfaceTerms = new Set('ana geri dön giriş kayıt hesap şifre kullanıcı eposta doğum tarih güvenlik doğrulama destek mesaj konu gönder gizlilik kullanım koşulları sistem durum güncelleme bildirim bağlantı yayın yayıncı içerik topluluk marka araç veri ziyaretçi aktif ücretsiz indir oluştur keşfet hemen başla kapat tamam iptal hata başarısız bekleniyor hazır yükleniyor görünür ayar menü ürün plan canlı analiz ekler talepler eski yeni son önce sonraki beni hatırla'.split(' '));
function looksLikeTurkishInterface(value) {
  const text = clean(value);
  if (!translatable(text) || /^[.#/[{(]/.test(text) || /[{}=;]|=>|\b(?:const|function|return|querySelector|classList|dataset)\b/.test(text)) return false;
  if (/[ÇĞİÖŞÜçğıöşü]/u.test(text)) return true;
  const words = text.toLocaleLowerCase('tr-TR').split(/[^a-zçğıöşü]+/u).filter(Boolean);
  return words.some(word => turkishInterfaceTerms.has(word));
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
  const source = String(value || '');
  const addLiteral = literal => {
    const decoded = String(literal || '').replace(/\\([\\"'`])/g, '$1').replace(/\\n|\\r|\\t/g, ' ');
    if (decoded.includes('<')) addMarkupStrings(decoded, target, { requireTurkish: true });
    else if (looksLikeTurkishInterface(decoded)) target.add(clean(decoded));
  };
  const skipQuoted = (start, quote) => {
    let index = start + 1;
    for (; index < source.length; index += 1) {
      if (source[index] === '\\') { index += 1; continue; }
      if (source[index] === quote) return index + 1;
    }
    return index;
  };
  let index = 0;
  while (index < source.length) {
    if (source[index] === '/' && source[index + 1] === '/') { index = source.indexOf('\n', index + 2); if (index < 0) break; continue; }
    if (source[index] === '/' && source[index + 1] === '*') { index = source.indexOf('*/', index + 2); index = index < 0 ? source.length : index + 2; continue; }
    if (source[index] === '"' || source[index] === "'") {
      const quote = source[index], end = skipQuoted(index, quote);
      addLiteral(source.slice(index + 1, Math.max(index + 1, end - 1)));
      index = end;
      continue;
    }
    if (source[index] === '`') {
      index += 1;
      let chunk = '';
      while (index < source.length) {
        if (source[index] === '\\') { chunk += source.slice(index, index + 2); index += 2; continue; }
        if (source[index] === '`') { addLiteral(chunk); index += 1; break; }
        if (source[index] === '$' && source[index + 1] === '{') {
          addLiteral(chunk); chunk = ''; index += 2;
          let depth = 1;
          while (index < source.length && depth > 0) {
            if (source[index] === '"' || source[index] === "'" || source[index] === '`') { index = skipQuoted(index, source[index]); continue; }
            if (source[index] === '{') depth += 1;
            else if (source[index] === '}') depth -= 1;
            index += 1;
          }
          continue;
        }
        chunk += source[index]; index += 1;
      }
      continue;
    }
    index += 1;
  }
}

function addActiveRuntimeStrings(file, source, target) {
  const ranges = file === 'app.js' ? [
    ['function refreshInterfaceLanguage', 'window.psOpenLandingAuth'],
    ["home.className='ps-second-home", 'return true;'],
  ] : file === 'app-final.js' ? [
    ['function renderConnectionPanel', 'const infoContent'],
    ['function accountDataCard', 'function updateNotifications'],
    ['function accountDevicesPaneHtml', 'function bindAccountPane'],
    ['function supportPaneHtml', 'function showAccountCenter'],
    ['function showAccountCenter', 'window.ps28OpenConnection'],
    ['function ensureSupport', 'function normalizeTooltips'],
    ['function ensureMemberExtras', 'function ensurePrivacyLinks'],
  ] : [];
  ranges.forEach(([startMarker, endMarker]) => {
    const start = source.indexOf(startMarker);
    if (start < 0) return;
    const end = source.indexOf(endMarker, start + startMarker.length);
    addJavaScriptStrings(source.slice(start, end > start ? end : source.length), target);
  });
}

function printStats(extracted, rows) {
  console.log(`Arayüz kaynağı: ${extracted.size} benzersiz metin.`);
  const requestedMissing = String(process.argv.find(value => value.startsWith('--missing=')) || '').split('=')[1] || '';
  for (const language of languages) {
    const available = new Map(rows.filter(row => row.language === language).map(row => [clean(row.source_text), clean(row.translation)]));
    Object.entries(critical[language] || {}).forEach(([source, translation]) => available.set(clean(source), clean(translation)));
    const ready = [...extracted].filter(source => translationValid(source, available.get(source), language));
    const missing = [...extracted].filter(source => !translationValid(source, available.get(source), language) && !passthrough(source));
    console.log(`[${language}] hazır ${ready.length}, eksik ${missing.length}`);
    if (requestedMissing === language) console.log(missing.sort((left, right) => left.localeCompare(right, 'tr')).join('\n'));
  }
}

function translationValid(source, translation, language) {
  const output = clean(translation);
  if (!output || clean(source).localeCompare(output, undefined, { sensitivity: 'base' }) === 0) return passthrough(source);
  if (language === 'ar' && !/[\u0600-\u06ff]/u.test(output)) return false;
  if (language === 'ru' && !/[\u0400-\u04ff]/u.test(output)) return false;
  if (language === 'ja' && !/[\u3040-\u30ff\u3400-\u9fff]/u.test(output)) return false;
  return true;
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
