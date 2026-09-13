import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const locales = ['ar', 'de', 'en', 'es', 'fr', 'ja', 'ru', 'tr'];
const json = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));

test('store metadata covers all eight interface languages', async () => {
  const manifest = await json('manifest.json');
  const listings = await json('store-listing/locales.json');
  assert.equal(manifest.default_locale, 'tr');
  assert.deepEqual(Object.keys(listings).sort(), locales);
  assert.deepEqual((await readdir(new URL('_locales/', root))).sort(), locales);
  for (const locale of locales) {
    const messages = await json(`_locales/${locale}/messages.json`);
    for (const token of JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)) {
      assert.ok(messages[token[1]]?.message, `${locale}: missing ${token[1]}`);
    }
    assert.equal(messages.extensionName.message, 'Play Connect');
    assert.ok(messages.extensionDescription.message.length <= 132, `${locale}: description length`);
    assert.ok(listings[locale].summary.length <= 250, `${locale}: summary length`);
    assert.ok(listings[locale].descriptionLines.join('\n').length <= 16000);
    assert.equal(listings[locale].screenshotCaptions.length, 3);
    for (const file of ['01-play-connect-panel.png', '02-obs-alert-box.png', '03-donation-events.png']) {
      const png = await readFile(new URL(`../chrome-web-store-assets/locales/${locale}/${file}`, root));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.equal(png.readUInt32BE(16), 1280);
      assert.equal(png.readUInt32BE(20), 800);
    }
  }
});
