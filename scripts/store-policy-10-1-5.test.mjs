import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const officialStoreUrl = 'https://apps.microsoft.com/detail/9NWZ0TF5K999';

const siteFiles = ['index.html', 'app-final.js', 'site-v7.js'];
const siteSource = (await Promise.all(siteFiles.map(read))).join('\n');
assert.doesNotMatch(siteSource, /get\.microsoft\.com\/installer\/download/i);
assert.doesNotMatch(siteSource, /WINDOWS_STORE_INSTALLER_URL/);
assert.match(siteSource, new RegExp(officialStoreUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

const appFinal = await read('app-final.js');
const publicInfoStart = appFinal.indexOf('const infoContent =');
const accountOnlyStoreStart = appFinal.indexOf('const PLAY_CONNECT_STORES');
assert.ok(publicInfoStart >= 0 && accountOnlyStoreStart > publicInfoStart);
const publicInfoSource = appFinal.slice(publicInfoStart, accountOnlyStoreStart);
assert.doesNotMatch(publicInfoSource, /chromewebstore\.google\.com|addons\.mozilla\.org|PLAY_CONNECT_STORES|playConnect\.href/);
assert.doesNotMatch(await read('site-v7.js'), /chromewebstore\.google\.com|addons\.mozilla\.org/);

const storeDir = new URL('../play-streamers-desktop/store/', import.meta.url);
const listingFiles = (await readdir(storeDir)).filter(file => /^listing-[a-z]{2}-[A-Z]{2}\.md$/.test(file));
assert.equal(listingFiles.length, 8);
const listingSource = (await Promise.all(listingFiles.map(file => read(`play-streamers-desktop/store/${file}`)))).join('\n');
assert.doesNotMatch(listingSource, /outside (?:the )?Microsoft Store|Microsoft Store dışında|außerhalb des Microsoft Store|fuera de Microsoft Store|hors du Microsoft Store|вне Microsoft Store|Microsoft Store 外|خارج Microsoft Store/i);

const certificationNotes = await read('play-streamers-desktop/store/certification-notes.md');
assert.match(certificationNotes, /Policy 10\.1\.5 remediation/);
assert.match(certificationNotes, /MSIX package revision is 1\.9\.1\.0/);
assert.match(certificationNotes, /customer-facing Microsoft Store release is 1\.9/);

console.log('Microsoft Store policy 10.1.5 remediation contract: OK');
