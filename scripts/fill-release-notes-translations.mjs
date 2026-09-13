import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = JSON.parse(await readFile(resolve(root, 'release-notes-family.json'), 'utf8'));
const languages = ['en', 'de', 'es', 'fr', 'ru', 'ar', 'ja'];
const fields = new Set(['eyebrow', 'title', 'intro', 'latest', 'beta', 'fullRelease', 'close', 'done', 'expand', 'collapse', 'language', 'memberHome', 'currentVersion', 'loading', 'name', 'tabTitle', 'summary', 'items']);
const glossary = [
  ['Play Streamers', '{{B0}}'], ['Play Connect', '{{B1}}'], ['SW Identity', '{{B2}}'],
  ['SW Create', '{{B3}}'], ['Dashboard', '{{B4}}'], ['Kick', '{{B5}}'], ['OBS', '{{B6}}'],
];
const protect = value => glossary.reduce((text, [brand, token]) => text.replaceAll(brand, token), value);
const restore = value => glossary.reduce((text, [brand, token]) => text.replaceAll(token, brand), value);
const strings = new Set();

function collect(value, field = '') {
  if (Array.isArray(value)) return value.forEach(item => collect(item, field));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && fields.has(field)) strings.add(value);
    return;
  }
  Object.entries(value).forEach(([key, item]) => collect(item, key));
}
collect(source);

function chunks(values, limit = 3600) {
  const result = []; let current = []; let size = 0;
  for (const value of values) {
    if (current.length && size + value.length > limit) { result.push(current); current = []; size = 0; }
    current.push(value); size += value.length + 32;
  }
  if (current.length) result.push(current);
  return result;
}

const separator = '\n[[[SW_RELEASE_SEPARATOR_94731]]]\n';
for (const language of languages) {
  const path = resolve(root, 'locales', `${language}.json`);
  const catalog = JSON.parse(await readFile(path, 'utf8'));
  const missing = [...strings].filter(value => !catalog.translations?.[value] || catalog.translations[value] === value);
  for (const group of chunks(missing)) {
    const params = new URLSearchParams({ client: 'gtx', sl: 'tr', tl: language, dt: 't', q: group.map(protect).join(separator) });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
    if (!response.ok) throw new Error(`[${language}] çeviri yanıtı: ${response.status}`);
    const payload = await response.json();
    const translated = (payload[0] || []).map(row => row[0] || '').join('').split(separator);
    if (translated.length !== group.length) throw new Error(`[${language}] ayırıcı sayısı eşleşmedi: ${translated.length}/${group.length}`);
    group.forEach((value, index) => { catalog.translations[value] = restore(translated[index].trim()); });
    await new Promise(resolveWait => setTimeout(resolveWait, 550));
  }
  catalog.translations = Object.fromEntries(Object.entries(catalog.translations).sort(([left], [right]) => left.localeCompare(right, 'tr')));
  await writeFile(path, `${JSON.stringify(catalog)}\n`, 'utf8');
  console.log(`[${language}] ${missing.length} eksik güncelleme metni tamamlandı.`);
}
