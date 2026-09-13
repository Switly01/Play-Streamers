import { access, copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'play-connect');
const version = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8')).version;
const chromeTarget = path.join(root, `play-connect-chrome-store-v${version}`);
const firefoxTarget = path.join(root, `play-connect-firefox-store-v${version}`);
const firefoxTemplate = path.join(root, 'play-connect-firefox-store-v1.15.3');

for (const target of [chromeTarget, firefoxTarget]) {
  await access(target).then(
    () => { throw new Error(`Hedef zaten var; üzerine yazılmadı: ${target}`); },
    () => undefined
  );
  await mkdir(target, { recursive: true });
}

const sharedDirectories = ['_locales', 'assets'];
for (const directory of sharedDirectories) {
  await cp(path.join(source, directory), path.join(chromeTarget, directory), { recursive: true });
  await cp(path.join(source, directory), path.join(firefoxTarget, directory), { recursive: true });
}

for (const relativePath of ['LOCAL_TEST.md', 'src/i18n-reviewed.json']) {
  await copyRelative(relativePath, source, firefoxTarget);
}
for (const directory of ['scripts', 'store-listing']) {
  await cp(path.join(source, directory), path.join(firefoxTarget, directory), { recursive: true });
}

const runtimeFiles = [
  'manifest.json',
  'release-notes-family.localized.json',
  'offscreen/offscreen.html', 'offscreen/offscreen.js',
  'options/options.css', 'options/options.html', 'options/options.js',
  'popup/glass-popup.css', 'popup/popup.css', 'popup/popup.html', 'popup/popup.js',
  'src/background.js', 'src/content-scanner.js', 'src/core.js', 'src/liquid-glass.css',
  'src/live-i18n.js', 'src/locale-settings.js', 'src/network-bridge.js', 'src/providers.js', 'src/ui-catalog.json',
];

async function copyRelative(relativePath, from, to) {
  const target = path.join(to, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(from, relativePath), target);
}

for (const relativePath of runtimeFiles) {
  await copyRelative(relativePath, source, chromeTarget);
  if (!['manifest.json', 'offscreen/offscreen.js', 'options/options.html', 'options/options.js', 'popup/popup.js', 'src/background.js', 'src/content-scanner.js'].includes(relativePath)) {
    await copyRelative(relativePath, source, firefoxTarget);
  }
}

for (const relativePath of ['firefox/background.html', 'offscreen/offscreen.js', 'src/background.js', 'src/content-scanner.js']) {
  await copyRelative(relativePath, firefoxTemplate, firefoxTarget);
}

for (const relativePath of ['options/options.html', 'options/options.js', 'popup/popup.js']) {
  const chromeText = await readFile(path.join(source, relativePath), 'utf8');
  const firefoxText = chromeText.replaceAll('chrome.', 'browser.').replaceAll('Chrome', 'Firefox');
  const target = path.join(firefoxTarget, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, firefoxText, 'utf8');
}

const firefoxManifest = JSON.parse(await readFile(path.join(firefoxTemplate, 'manifest.json'), 'utf8'));
firefoxManifest.version = version;
await writeFile(path.join(firefoxTarget, 'manifest.json'), `${JSON.stringify(firefoxManifest, null, 2)}\n`, 'utf8');

console.log(`Play Connect ${version} mağaza klasörleri hazırlandı.`);
