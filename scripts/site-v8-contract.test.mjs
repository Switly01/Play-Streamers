import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');

test('site 8.1 assets are cache-busted and monochrome', async () => {
  const [html, css, logo] = await Promise.all([
    read('index.html'),
    read('site-v7.css'),
    read('play-streamers-ps-logo.svg'),
  ]);
  assert.match(html, /play-streamers-build" content="2026-08-25-site-8\.1"/);
  assert.match(html, /site-v7\.css\?v=8\.1/);
  assert.match(html, /site-v7\.js\?v=8\.1/);
  assert.match(css, /html\[data-ps-site-version="8"\]/);
  assert.match(css, /--signal: #f5f5f2/);
  assert.doesNotMatch(logo, /53fc18|ff7043/i);
  assert.match(logo, /aria-label="Play Streamers keskin PS monogramı"/);
  assert.doesNotMatch(logo, /stroke-linecap="round"|rx="/);
});

test('public home promotes the desktop app without restoring legacy hero', async () => {
  const source = await read('site-v7.js');
  assert.match(source, /className = 'landing-main ps8-home'/);
  assert.match(source, /Windows için indir/);
  assert.match(source, /Windows 10\/11 · 64 bit/);
  assert.match(source, /data-ps8-action="register"/);
  assert.match(source, /data-ps8-action="products"/);
  assert.match(source, /PLAY<span>\.<\/span>STREAMERS/);
  assert.match(source, /class="ps81-showcase"/);
  assert.match(source, /className = 'ps81-nav-download'/);
  assert.match(source, /current\.replaceWith\(home\)/);
  assert.doesNotMatch(source, /className = 'landing-card'/);
});

test('desktop installer referenced by the public home exists', async () => {
  const installer = await stat(new URL('downloads/Play-Streamers-Setup.exe', root));
  assert.ok(installer.isFile());
  assert.ok(installer.size > 1_000_000);
});
