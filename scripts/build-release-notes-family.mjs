import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const input = process.argv[2];
if (!input) throw new Error('Kullanım: node scripts/build-release-notes-family.mjs <güncelleme-notları.md>');

const productKeys = new Map([
  ['Play Streamers Web', 'web'],
  ['Play Streamers App', 'app'],
  ['Play Connect', 'connect'],
  ['SW Identity', 'identity'],
  ['SW Create', 'swcreate'],
]);
// Extend the supplied archive without renumbering any historical release.
const supplemental = JSON.parse(await readFile(new URL('../release-notes-family.supplemental.json', import.meta.url), 'utf8'));

const lines = (await readFile(resolve(input), 'utf8')).replace(/^\uFEFF/, '').split(/\r?\n/);
const products = {};
let product = null;
let entry = null;

for (const rawLine of lines) {
  const line = rawLine.trim();
  const productHeading = line.match(/^##\s+(.+)$/);
  if (productHeading) {
    const key = productKeys.get(productHeading[1]);
    product = key ? { key, name: productHeading[1], description: [], entries: [] } : null;
    entry = null;
    if (product) products[key] = product;
    continue;
  }
  if (!product) continue;
  const releaseHeading = line.match(/^###\s+(.+?)\s+—\s+(.+)$/);
  if (releaseHeading) {
    entry = {
      version: releaseHeading[1],
      title: releaseHeading[2],
      beta: /^Beta\b/i.test(releaseHeading[1]),
      items: [],
    };
    product.entries.push(entry);
    continue;
  }
  const bullet = line.match(/^-\s+(.+)$/);
  if (entry && bullet) entry.items.push(bullet[1]);
  else if (!entry && line && !line.startsWith('**')) product.description.push(line);
}

for (const [key, name] of productKeys.entries()) {
  if (!products[name]?.entries.length) throw new Error(`${key} notları bulunamadı.`);
}

const output = {
  schemaVersion: 1,
  ui: {
    eyebrow: 'ÜRÜN GÜNCELLEME ARŞİVİ',
    title: 'Güncelleme Notları',
    intro: 'Ürünlere göre tüm yenilikleri ve düzeltmeleri en yeni sürümden başlayarak incele.',
    latest: 'SON SÜRÜM',
    beta: 'BETA',
    fullRelease: 'TAM SÜRÜM',
    close: 'Kapat',
    done: 'Tamam',
    expand: 'ayrıntılarını büyüt',
    collapse: 'ayrıntılarını daralt',
    language: 'Dil seçimi',
    memberHome: 'Kullanıcı ana sayfası',
    currentVersion: 'GÜNCEL SÜRÜM',
    loading: 'GÜNCELLEME AĞI HAZIRLANIYOR…',
  },
  productOrder: ['swcreate', 'identity', 'web', 'app', 'connect'],
  products: Object.fromEntries(Object.entries(products).map(([key, value]) => {
    const additions = supplemental.products[key]?.entries || [];
    const entries = [...additions].reverse().concat([...value.entries].reverse());
    if (new Set(entries.map(entry => entry.version)).size !== entries.length) {
      throw new Error(`${value.name}: yinelenen sürüm kaydı.`);
    }
    const current = entries[0].version;
    return [key, {
      name: value.name,
      tabTitle: `${value.name} Güncelleme Notları`,
      summary: value.description.join(' '),
      current,
      entries,
    }];
  })),
};

await writeFile(resolve('release-notes-family.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Birleştirilmiş notlar yazıldı: ${Object.values(output.products).reduce((sum, item) => sum + item.entries.length, 0)} sürüm.`);
