import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createCatalogLookup } from '../live-i18n.js';
const ts = createRequire(new URL('../swcreate-site/package.json', import.meta.url))('typescript');
const final = await readFile(new URL('../app-final.js', import.meta.url), 'utf8');
const worker = await readFile(new URL('../cloudflare-worker.js', import.meta.url), 'utf8');
function declaration(source, name) {
  const ast = ts.createSourceFile('source.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let found;
  const visit = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === name) found ||= node.getText(ast); ts.forEachChild(node, visit); };
  visit(ast); assert.ok(found, name); return found;
}
test('background sampler runs independently of browser measurements and refreshes expired credentials', async () => {
  const calls = [], queries = [];
  const env = { DB: { prepare(sql) { queries.push(sql); return { bind(...args) { calls.push({ sql, args }); return this; }, async all() { return { results: [{ id: 'opaque-session', user_id: 'opaque-user' }] }; }, async run() { return {}; } }; } } };
  const c = vm.createContext({ ensureUsersSchema: async () => {}, ensureKickMetricsSchemaInD1: async () => {}, getKickSession: async () => ({ expiresAt: 0 }), refreshKickSessionSafely: async () => ({ session: { userId: 'opaque-user' } }), getKickChannelInsights: async (session, binding, options) => { assert.equal(options.collectOnly, true); assert.equal(session.userId, 'opaque-user'); return { sampled: true }; }, kickMetricHourKey: () => '2026-09-03T06', logSecurityEvent: (name, value) => calls.push({ name, value }) });
  vm.runInContext(declaration(worker, 'syncScheduledKickMetrics'), c);
  await c.syncScheduledKickMetrics(env);
  assert.ok(queries.some(sql => sql.includes('next_attempt_at')));
  assert.ok(queries.every(sql => !sql.includes('kick_metric_hourly')));
  assert.equal(calls.find(call => call.name === 'kick_metrics_scheduled_sync').value.checked, 1);
  assert.ok(calls.some(call => call.sql?.includes('last_success_at')));
});
test('rolling month handles short months and leap years equally on client and server', () => {
  const c = vm.createContext({});
  vm.runInContext(declaration(final, 'rollingMonthStart') + declaration(worker, 'kickRollingMonthStart'), c);
  for (const [from, to] of [['2026-03-31T12:00:00Z','2026-02-28T12:00:00Z'],['2024-03-31T12:00:00Z','2024-02-29T12:00:00Z'],['2026-09-03T12:00:00Z','2026-08-03T12:00:00Z']]) {
    assert.equal(c.rollingMonthStart(Date.parse(from)), Date.parse(to));
    assert.equal(c.kickRollingMonthStart(Date.parse(from)), Date.parse(to));
  }
  assert.match(worker, /julianday\(COALESCE\(event_at, received_at\)\) >= julianday\(\?2\)/);
  assert.match(worker, /strftime\('%H', COALESCE\(event_at, received_at\), '\+3 hours'\)/);
});
test('dynamic translations retain values and move between previously rendered languages', () => {
  const en = { '{0} cihaz bağlı.': '{0} devices connected.', 'SW IDENTITY · PROFİL': 'SW IDENTITY · PROFILE' };
  const fr = { '{0} cihaz bağlı.': '{0} appareils connectés.', 'SW IDENTITY · PROFİL': 'SW IDENTITY · PROFIL' };
  const lookup = createCatalogLookup(fr, [en]);
  assert.equal(lookup('5 cihaz bağlı.'), '5 appareils connectés.');
  assert.equal(lookup('5 devices connected.'), '5 appareils connectés.');
  assert.equal(lookup('SW IDENTITY · PROFILE'), 'SW IDENTITY · PROFIL');
  assert.equal(createCatalogLookup({}, [en])('5 devices connected.'), '5 cihaz bağlı.');
  assert.equal(lookup('My own donation message'), 'My own donation message');
});
test('generated drafts localize their headings, preserve user input and contain three usable versions', () => {
  const c = vm.createContext({ ui: text => 'EN:' + text });
  vm.runInContext(declaration(final, 'createContentDrafts'), c);
  const result = c.createContentDrafts('Hello <world>! Second part.', '100 members');
  assert.ok(result.includes('EN:Kısa paylaşım'));
  assert.ok(result.includes('EN:Yayın duyurusu'));
  assert.ok(result.includes('EN:Topluluğa soru'));
  assert.ok(result.includes('Hello <world>!'));
  assert.ok(result.includes('100 members'));
  assert.equal(c.createContentDrafts('', ''), 'EN:Önce yayın metnine bir içerik ekle.');
});
test('readable report exports localized tables without session information or executable user markup', () => {
  const c = vm.createContext({ esc: value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') });
  vm.runInContext(declaration(final, 'buildPlanReport'), c);
  const report = c.buildPlanReport({ settings: { userSession: 'MUST_NOT_EXPORT' }, events: { donations: [{ name: 'Viewer', at: 1, amount: 12, currency: 'EUR', message: '<script>alert(1)</script>' }] }, stats: {} }, text => 'FR:' + text, 'fr');
  assert.match(report, /<html lang="fr" dir="ltr">/);
  assert.match(report, /FR:Dashboard raporu/);
  assert.match(report, /FR:Kullanıcı/);
  assert.match(report, /&lt;script&gt;/);
  assert.doesNotMatch(report, /MUST_NOT_EXPORT|<script>/);
});
test('custom photo is not silently replaced when saving the profile again', () => {
  assert.match(final, /!customPicture && selectedAvatar === value \? ' checked'/);
  assert.match(final, /\.\.\.\(avatarPreset \? \{ avatarPreset \} : \{\}\)/);
  assert.match(worker, /input\?\.avatarPreset &&/);
  assert.match(final, /picture: avatar/);
});
test('avatar writes invalidate the old session photo and explicit fresh reads bypass cache', async () => {
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const start = source.indexOf("(() => {\n  const nativeFetch = window.fetch.bind(window);\n  const sessionCache");
  const end = source.indexOf('\n})();', start) + 6;
  let reads = 0, picture = 'old';
  const c = vm.createContext({ Headers, Response, window: { fetch: async (url, init) => {
    if (init?.method === 'POST') { picture = 'new'; return new Response('{}'); }
    reads += 1; return new Response(JSON.stringify({ picture }));
  } } });
  vm.runInContext(source.slice(start, end), c);
  const url = 'https://api.pstreamers.com/api/auth/session';
  await c.window.fetch(url); await c.window.fetch(url);
  assert.equal(reads, 1);
  await c.window.fetch('https://api.pstreamers.com/api/account/update-avatar', { method: 'POST' });
  assert.equal((await (await c.window.fetch(url)).json()).picture, 'new');
  assert.equal(reads, 2);
  await c.window.fetch(url, { cache: 'no-store' });
  assert.equal(reads, 3);
});
test('navigation recovery reads the shared application state without an undefined helper', () => {
  assert.doesNotMatch(final, /\breadState\s*\(/);
  assert.match(final, /function stabilizeAfterNavigation\(\)[\s\S]*?const current = state\(\)/);
  assert.match(final, /function routeExtensionMemberHome\(\)[\s\S]*?const current = state\(\)/);
});
