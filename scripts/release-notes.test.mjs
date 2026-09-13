import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const source = JSON.parse(await readFile(new URL('release-notes-family.json', root), 'utf8'));
const localized = JSON.parse(await readFile(new URL('release-notes-family.localized.json', root), 'utf8'));
const expectedCounts = { web:18, app:19, connect:17, identity:15, swcreate:19 };
const languages = ['tr','en','de','es','fr','ru','ar','ja'];

test('supplied family history is complete and beta releases are explicitly marked', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(source.products).map(([key, product]) => [key, product.entries.length])), expectedCounts);
  for (const product of Object.values(source.products)) {
    assert.ok(product.entries.some(entry => entry.beta), `${product.name} beta history missing`);
    assert.ok(product.entries.some(entry => !entry.beta), `${product.name} full releases missing`);
    for (const entry of product.entries) {
      assert.ok(entry.title && entry.items.length >= 2, `${product.name} ${entry.version} is incomplete`);
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
