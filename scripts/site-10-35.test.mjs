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
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) found ||= node.getText(ast); ts.forEachChild(node, visit); }
  visit(ast); assert.ok(found, name); return found;
}

test('uploading a custom photo after a preset clears every radio and completes refresh', async () => {
  const start = final.indexOf('if (avatarFile) avatarFile.onchange =');
  const end = final.indexOf('    const emailForm', start);
  const radios = [{ checked: true }, { checked: false }], status = {}, calls = [];
  const s = { settings: { user: { id: 'fixture', picture: 'avatar:orbit-cyan' } } };
  const c = vm.createContext({ avatarFile: { value: 'fixture.png' }, layer: {},
    $: () => status, $$: () => radios, confirmAccountSave: async () => true,
    prepareAccountLogo: async () => 'data:image/png;base64,test',
    accountPost: async () => ({ user: { id: 'fixture' } }), state: () => s,
    saveAccountState: () => calls.push('save'), refreshAccountUser: async () => calls.push('refresh'),
    syncAccountSidebarAvatar: () => calls.push('sidebar'), showAccountCenter: () => calls.push('show') });
  vm.runInContext(final.slice(start, end), c);
  await c.avatarFile.onchange({ target: { files: [{}] } });
  assert.ok(radios.every(radio => !radio.checked));
  assert.deepEqual(calls, ['save','refresh','sidebar','show']);
  assert.equal(c.avatarFile.value, '');
  assert.equal(s.settings.user.picture, 'data:image/png;base64,test');
  assert.notEqual(status.className, 'ps51-account-status error');
});

test('SSB uses the active language even when legacy localStorage says Turkish', () => {
  const c = vm.createContext({ window: { psLiveI18n: { language: 'fr' } }, document: { documentElement: { lang: 'fr' } }, localStorage: { getItem: () => 'tr' } });
  vm.runInContext(declaration(final, 'currentInterfaceLanguage') + declaration(worker, 'donateWebhookTestMessage'), c);
  for (const language of ['en','de','es','fr','ru','ar','ja']) {
    c.window.psLiveI18n.language = language;
    assert.equal(c.currentInterfaceLanguage(), language);
    assert.notEqual(c.donateWebhookTestMessage(c.currentInterfaceLanguage()), c.donateWebhookTestMessage('tr'));
  }
  assert.match(final, /connections\/test', \{ connectionId: connection.id, language: currentInterfaceLanguage\(\)/);
});

test('cron dispatch isolates measurements from audit CPU usage', async () => {
  const ast = ts.createSourceFile('worker.js', worker, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let method;
  function visit(node) { if (ts.isMethodDeclaration(node) && node.name.getText(ast) === 'scheduled') method = node.getText(ast); ts.forEachChild(node, visit); }
  visit(ast);
  const calls = [], c = vm.createContext(Object.fromEntries(['syncScheduledDonateOAuthConnections','syncScheduledLiveSessions','syncScheduledKickMetrics','runScheduledPlayBotAudit'].map(name => [name, async () => calls.push(name)])));
  vm.runInContext('var job = {' + method + '}', c);
  const ctx = { waitUntil: promise => promise };
  await c.job.scheduled({ cron: '* * * * *' }, {}, ctx);
  assert.deepEqual(calls, ['syncScheduledKickMetrics']);
  calls.length = 0;
  await c.job.scheduled({ cron: '*/15 * * * *' }, {}, ctx);
  assert.deepEqual(calls, ['runScheduledPlayBotAudit']);
});

test('scheduled metric sample stores actual zero, never carries forward missing metrics, and avoids history', async () => {
  let official = {}, summary = { followersCount: 0, subscribers_count: 0 };
  const samples = [], sql = [];
  const c = vm.createContext({ URL, logSecurityEvent: () => {}, KICK_API: 'https://api.kick.com', kickRollingMonthStart: () => 0,
    fetchExternal: async (url, init, options) => { assert.equal(options.timeoutMs, 3500); assert.equal(options.retries, undefined); return { ok: true, json: async () => String(url).includes('api.kick.com') ? official : summary }; },
    safeJson: r => r.json(), storeKickMetricSnapshot: async (env, sample) => { samples.push(sample); return false; } });
  vm.runInContext(declaration(worker,'kickSummaryMetric') + declaration(worker,'collectKickMetricSample'), c);
  const env = { DB: { prepare(query) { sql.push(query); return { bind() { return this; }, first: async () => ({ total: 4 }) }; } } };
  const session = { userId:'fixture', accessToken:'test-token', account:{id:123,username:'fixture'} };
  assert.equal((await c.collectKickMetricSample(session, env)).sampled, true);
  assert.equal(samples[0].followersCount, 0); assert.equal(samples[0].subscribersCount, 0);
  assert.equal(samples[0].source, 'kick-server');
  summary = {}; samples.length = 0;
  assert.equal((await c.collectKickMetricSample(session, env)).sampled, false);
  assert.equal(samples.length, 0);
  official = { data: [{ followers_count: 7 }] };
  assert.equal((await c.collectKickMetricSample(session, env)).sampled, true);
  assert.equal(samples[0].followersCount, 7); assert.equal(samples[0].subscribersCount, null);
  assert.ok(sql.every(query => !/kick_metric_hourly|payload_json/.test(query)));
});

test('plan tools offer HTML only and keep scrolling inside their dialog', async () => {
  assert.doesNotMatch(final, /ps134RawExport|Ham JSON verisini indir/);
  assert.match(final, /downloadPlanReport\(state\(\)\)/);
  const css = await readFile(new URL('../site-v7.css',import.meta.url),'utf8');
  assert.match(css, /\.ps115-plan-dialog\s*\{[^}]*overflow:hidden!important/);
  assert.match(css, /\.ps115-plan-grid\s*\{[^}]*overflow-y:auto!important/);
});

test('reviewed UI translations cover every supported foreign language', async () => {
  const reviewed = JSON.parse(await readFile(new URL('./i18n-reviewed.json', import.meta.url),'utf8'));
  assert.deepEqual(reviewed.languages, ['en','de','es','fr','ru','ar','ja']);
  for (const [source,...values] of reviewed.entries) {
    assert.equal(values.length, 7, source);
    assert.ok(values.every(value => value && value !== source), source);
  }
});

test('provider brands cannot be translated as ordinary words', () => {
  const lookup = createCatalogLookup({ Kick: 'Atlat', ByNoGame: 'By No Game' });
  assert.equal(lookup('Kick'), 'Kick'); assert.equal(lookup('ByNoGame'), 'ByNoGame');
  assert.equal(createCatalogLookup({}, [{ Kick: 'Atlat' }])('Atlat'), 'Kick');
});
