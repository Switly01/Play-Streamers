import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const source = JSON.parse(await readFile(new URL('release-notes-family.json', root), 'utf8'));
const localized = JSON.parse(await readFile(new URL('release-notes-family.localized.json', root), 'utf8'));
const expectedCounts = { web:18, app:19, connect:21, identity:15, swcreate:19 };
const expectedVersions = { web:'1.8', app:'1.9', connect:'2.1', identity:'1.5', swcreate:'1.9' };
const languages = ['tr','en','de','es','fr','ru','ar','ja'];

test('Connect 2.1 preserves the full stable history, including 1.7, 1.8 and 1.9', async () => {
  const versions = ['2.1','2.0', ...Array.from({ length:10 }, (_, index) => `1.${9-index}`)];
  assert.deepEqual(source.products.connect.entries.filter(entry => !entry.beta).map(entry => entry.version), versions);
  assert.equal(source.products.connect.entries.find(entry => entry.version === '1.7').title, 'Birleşik Bağlantı');
  for (const language of languages) {
    const entries = localized.locales[language].products.connect.entries;
    assert.deepEqual(entries.filter(entry => !entry.beta).map(entry => entry.version), versions);
    for (const version of ['1.7','1.8','1.9','2.0','2.1']) {
      const translated = entries.find(entry => entry.version === version);
      const original = source.products.connect.entries.find(entry => entry.version === version);
      assert.equal(translated.items.length, original.items.length);
      if (language !== 'tr') translated.items.forEach((item,index) => assert.notEqual(item,original.items[index], `${language}/${version}/${index}`));
    }
  }
  const manifest = JSON.parse(await readFile(new URL('play-connect/manifest.json',root),'utf8'));
  assert.equal(manifest.version,'2.1');
  assert.equal(manifest.version_name,'2.1');
  assert.deepEqual(source.products.connect.entries[0].items,['Genel performans düzeltmeleri yapıldı.']);
});

test('all shipped source surfaces embed the exact same archive', async () => {
  for (const path of ['play-connect/release-notes-family.localized.json','play-streamers-desktop/src/release-notes-family.localized.json','swcreate-site/src/release-notes-family.localized.json']) {
    assert.deepEqual(JSON.parse(await readFile(new URL(path,root),'utf8')),localized,path);
  }
});

test('supplied family history is complete and beta releases are explicitly marked', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(source.products).map(([key, product]) => [key, product.entries.length])), expectedCounts);
  assert.deepEqual(Object.fromEntries(Object.entries(source.products).map(([key, product]) => [key, product.current])), expectedVersions);
  for (const product of Object.values(source.products)) {
    assert.equal(product.entries[0].version, product.current, `${product.name} current version does not match its newest note`);
    assert.ok(product.entries.some(entry => entry.beta), `${product.name} beta history missing`);
    assert.ok(product.entries.some(entry => !entry.beta), `${product.name} full releases missing`);
    for (const entry of product.entries) {
      assert.ok(entry.title && entry.items.length >= (product.name === 'Play Connect' && entry.version === '2.1' ? 1 : 2), `${product.name} ${entry.version} is incomplete`);
      assert.equal(entry.beta, /^Beta\b/.test(entry.version));
    }
  }
});

test('all eight locale archives preserve every release and translate user copy', () => {
  assert.deepEqual(Object.keys(localized.locales), languages);
  for (const language of languages) {
    const archive = localized.locales[language];
    for (const [key, count] of Object.entries(expectedCounts)) {
      assert.equal(archive.products[key].entries.length, count, `${language}/${key}`);
      assert.equal(archive.products[key].current, expectedVersions[key], `${language}/${key} current version`);
      assert.match(archive.products[key].tabTitle, /Play Streamers|Play Connect|SW Identity|SW Create/);
    }
    if (language !== 'tr') {
      assert.notEqual(archive.ui.intro, source.ui.intro, `${language} intro untranslated`);
      assert.notEqual(archive.products.connect.entries[0].items[0], source.products.connect.entries[0].items[0], `${language} release copy untranslated`);
    }
  }
});

test('every requested surface uses product-specific headings and beta styling', async () => {
  const [site, siteCss, desktop, desktopCss, connect, connectCss, sw, swCss] = await Promise.all([
    readFile(new URL('app-final.js', root), 'utf8'),
    readFile(new URL('site-v7.css', root), 'utf8'),
    readFile(new URL('play-streamers-desktop/src/App.tsx', root), 'utf8'),
    readFile(new URL('play-streamers-desktop/src/application-vivid.css', root), 'utf8'),
    readFile(new URL('play-connect/options/options.js', root), 'utf8'),
    readFile(new URL('play-connect/options/options.css', root), 'utf8'),
    readFile(new URL('swcreate-site/src/UpdateNotesPage.tsx', root), 'utf8'),
    readFile(new URL('swcreate-site/app/globals.css', root), 'utf8'),
  ]);
  assert.match(site, /\['web', 'app', 'connect'\]/);
  assert.match(desktop, /\['web','app','connect'\]/);
  assert.match(connect, /products\.connect/);
  assert.match(sw, /\["swcreate", "identity", "web", "app", "connect"\]/);
  for (const css of [siteCss, desktopCss, connectCss, swCss]) assert.match(css, /beta-release/);
});
