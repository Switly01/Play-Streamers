import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { critical } from '../live-i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = join(root, 'swcreate-site', 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const config = join(root, 'wrangler.play-streamers.jsonc');
const outputDirectory = join(root, 'locales');
const api = 'https://api.pstreamers.com/api/i18n/translate';
const version = '2026-08-29.3';
const languages = ['en', 'de', 'es', 'fr', 'ru', 'ar', 'ja'];
const sourceFiles = ['index.html', 'privacy.html', 'terms.html', 'app.js', 'app-final.js', 'site-v7.js'];
const extractionFiles = new Set(['index.html', 'privacy.html', 'terms.html', 'site-v7.js']);
const dryRun = process.argv.includes('--dry-run');

const clean = value => String(value || '').replace(/\\n|\\r|\\t/g, ' ').replace(/\s+/g, ' ').trim();
const decode = value => clean(String(value || '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>'));
const passthrough = value => /^(?:PLAY STREAMERS|PLAY CONNECT|PLAY|STREAMERS|SW CREATE|SW IDENTITY|SW BOT|SW AI|PRODUCT PRO|FREE|PRO|PC|PS|APP|WEB|CONNECT|HTTP|HTTPS|API|OBS|KICK|WINDOWS)(?:\s*[·+:/-].*)?$/i.test(clean(value))
  || /^(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.)/i.test(clean(value))
  || /^[\d\s.,:%+\-/–—()]+$/.test(clean(value));
const translatable = value => {
  const text = clean(value);
  if (passthrough(text) || text.length < 2 || text.length > 1200) return false;
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

function readRemoteCache() {
  try {
    const stdout = execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'play-streamers-users', '--remote', '--json', '--config', config, '--command', 'SELECT language, source_text, translation FROM interface_translation_cache ORDER BY language, source_text;'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    const payload = JSON.parse(stdout);
    return payload.flatMap(result => Array.isArray(result.results) ? result.results : []);
  } catch (error) {
    console.warn('Uzak çeviri önbelleğine erişilemedi; mevcut yerel paketler temel alınıyor.');
    return languages.flatMap(language => {
      try {
        const catalog = JSON.parse(readFileSync(join(outputDirectory, `${language}.json`), 'utf8'));
        return Object.entries(catalog.translations || {}).map(([source_text, translation]) => ({ language, source_text, translation }));
      } catch (_) { return []; }
    });
  }
}

async function translateMissing(language, sources) {
  const completed = new Map();
  const chunks = [];
  for (let index = 0; index < sources.length; index += 16) chunks.push(sources.slice(index, index + 16));
  for (let offset = 0; offset < chunks.length; offset += 3) {
    await Promise.all(chunks.slice(offset, offset + 3).map(async strings => {
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch(api, {
            method: 'POST',
            headers: { 'content-type': 'application/json', origin: 'https://pstreamers.com' },
            body: JSON.stringify({ language, strings }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !Array.isArray(result.translations) || result.translations.length !== strings.length) throw new Error(result.error || `HTTP ${response.status}`);
          strings.forEach((source, index) => {
            const translation = clean(result.translations[index]);
            if (translationValid(source, translation, language)) completed.set(source, translation);
          });
          return;
        } catch (error) {
          lastError = error;
          await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
        }
      }
      console.warn(`[${language}] paket çevrilemedi: ${lastError?.message || 'bilinmeyen hata'}`);
    }));
  }
  return completed;
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
  }
  const corpus = corpusParts.join('\n');
  for (const dictionary of Object.values(critical)) {
    for (const source of Object.keys(dictionary)) {
      if (corpus.includes(source)) extracted.add(clean(source));
    }
  }
  const rows = readRemoteCache();
  for (const row of rows) {
    const source = clean(row.source_text);
    if (source && corpus.includes(source)) extracted.add(source);
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
    if (!source || (!extracted.has(source) && !corpus.includes(source))) continue;
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
  }

  await mkdir(outputDirectory, { recursive: true });
  for (const language of languages) {
    const translations = byLanguage[language];
    const missing = [...extracted].filter(source => !translations.has(source) && !passthrough(source));
    if (missing.length) {
      console.log(`[${language}] ${translations.size} hazır, ${missing.length} eksik çeviri hazırlanıyor.`);
      const generated = await translateMissing(language, missing);
      generated.forEach((translation, source) => translations.set(source, translation));
    }
    const ordered = Object.fromEntries([...translations.entries()].sort(([left], [right]) => left.localeCompare(right, 'tr')));
    const catalog = { version, sourceLanguage: 'tr', language, translations: ordered };
    await writeFile(join(outputDirectory, `${language}.json`), `${JSON.stringify(catalog)}\n`, 'utf8');
    console.log(`[${language}] ${Object.keys(ordered).length} hazır çeviri yazıldı.`);
  }
}

await main();
