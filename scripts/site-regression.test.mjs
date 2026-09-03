import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(new URL('../swcreate-site/package.json', import.meta.url));
const ts = require('typescript');
const root = new URL('../', import.meta.url);
const app = await readFile(new URL('app.js', root), 'utf8');
const final = await readFile(new URL('app-final.js', root), 'utf8');
const worker = await readFile(new URL('cloudflare-worker.js', root), 'utf8');
export function declaration(source, name) {
  const ast = ts.createSourceFile('source.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let result;
  const visit = node => {
    if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name?.getText(ast) === name) result ??= node.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(result, `Missing declaration: ${name}`);
  return result;
}
const plain = value => JSON.parse(JSON.stringify(value));
const empty = () => ({ settings: {}, events: { followers: [], subs: {}, kicks: [], gifts: [], donations: [] }, totals: { followers: 0, kicks: 0, gifts: 0, donations: 0 }, stats: { subs: {}, joined: {}, gifts: { month: {}, all: {} }, kicks: { month: {}, all: {} }, donations: { month: {}, all: {} } } });
function dashboard(initial = empty()) {
  const context = vm.createContext({ state: initial, window: {}, save() {}, render() {}, localeCurrency: () => 'USD', interfaceLocale: () => 'en-US', kickProfileUrl: () => '', id: () => 'test-event', convertMoney: (value, from, to) => value / ({ TRY: 40, USD: 1, EUR: .8 }[from]) * ({ TRY: 40, USD: 1, EUR: .8 }[to]) });
  vm.runInContext(['syncDashboardState', 'addStat', 'addDonationCurrencyStat', 'ensureDonationCurrencyHistory', 'convertedDonationStats'].map(name => declaration(app, name)).join('\n'), context);
  vm.runInContext(app.split('\n').find(line => line.startsWith('  window.PlayStreamers={addEvent')), context);
  return context;
}
test('panel reset preserves every statistics bucket, including currency-aware Top Donate', () => {
  const c = dashboard(), api = c.window.PlayStreamers, at = Date.now() - 2000;
  api.addEvent({ type: 'donation', name: 'Viewer', amount: 80, currency: 'TRY', at });
  api.addEvent({ type: 'donation', name: 'Viewer', amount: 8, currency: 'EUR', at });
  api.addEvent({ type: 'kicks', name: 'Viewer', amount: 15, at });
  api.addEvent({ type: 'gift', name: 'Viewer', count: 3, at });
  api.addEvent({ type: 'subscription', name: 'Viewer', months: 2, at });
  const before = plain(c.state.stats);
  assert.equal(c.convertedDonationStats().all.viewer.total, 12);
  api.resetPanel();
  assert.deepEqual(plain(c.state.stats), before);
  assert.equal(c.state.events.donations.length, 0);
  assert.equal(c.convertedDonationStats().all.viewer.total, 12);
  api.addEvent({ type: 'donation', name: 'Viewer', amount: 1, currency: 'USD', at: Date.now() + 10 });
  assert.equal(c.convertedDonationStats().all.viewer.total, 13);
});
test('statistics reset preserves feed and cannot repopulate Top Donate from old events', () => {
  const c = dashboard(), api = c.window.PlayStreamers, at = Date.now() - 2000;
  api.addEvent({ type: 'donation', name: 'Viewer', amount: 80, currency: 'TRY', at });
  const events = plain(c.state.events);
  api.resetStats();
  assert.deepEqual(plain(c.state.events), events);
  assert.deepEqual(plain(c.convertedDonationStats()), { all: {}, month: {} });
  api.addEvent({ type: 'donation', name: 'Late event', amount: 5, currency: 'USD', at });
  assert.equal(c.state.events.donations.length, 2);
  assert.deepEqual(plain(c.convertedDonationStats().all), {});
});
test('a late event after panel reset still updates independent statistics', () => {
  const c = dashboard(), api = c.window.PlayStreamers;
  api.resetPanel();
  api.addEvent({ type: 'kicks', name: 'Viewer', amount: 5, at: Date.now() - 2000 });
  assert.equal(c.state.events.kicks.length, 0);
  assert.equal(c.state.stats.kicks.all.viewer.total, 5);
});
test('legacy migration keeps the visible amounts once and survives reload', () => {
  const initial = empty();
  initial.events.donations.push({ name: 'Viewer', at: Date.now(), amount: 80, currency: 'TRY' });
  const c = dashboard(initial);
  assert.equal(c.convertedDonationStats().all.viewer.total, 2);
  c.window.PlayStreamers.resetPanel();
  const reloaded = dashboard(plain(c.state));
  assert.equal(reloaded.convertedDonationStats().all.viewer.total, 2);
});
test('feed mutations preserve newly saved avatars and server-provided statistics', () => {
  const c = dashboard();
  let stored = empty();
  stored.settings.user = { id: 'qa', picture: 'avatar:node-violet' };
  stored.stats.kicks.all.viewer = { name: 'Viewer', total: 500, at: Date.now() };
  c.KEY = 'test';
  c.localStorage = { getItem: () => JSON.stringify(stored) };
  c.save = () => { stored = plain(c.state); };
  c.window.PlayStreamers.addEvent({ type: 'donation', name: 'Viewer', amount: 5, currency: 'USD', at: Date.now() });
  c.window.PlayStreamers.resetPanel();
  assert.equal(stored.settings.user.picture, 'avatar:node-violet');
  assert.equal(stored.stats.kicks.all.viewer.total, 500);
  assert.equal(c.convertedDonationStats().all.viewer.total, 5);
});
function analytics() {
  const now = Date.parse('2026-09-03T14:00:00+03:00');
  class FrozenDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const c = vm.createContext({ Date: FrozenDate, document: { documentElement: { lang: 'en' } }, esc: value => String(value ?? ''), ui: value => value });
  vm.runInContext(['accountMetricDateKey', 'accountMetricDailySeries', 'accountMetricSvg'].map(name => declaration(final, name)).join('\n'), c);
  return c;
}
test('all 90 dates exist, missing days stay null, and the daily view has no chart', () => {
  const c = analytics(), current = { settings: { kickInsights: { dailyMetrics: [
    { date: '2026-08-13', followersCount: 28 }, { date: '2026-08-21', followersCount: 27 },
    { date: '2026-08-22', followersCount: 0 }, { date: '2026-08-23', followersCount: null },
  ] } } };
  const series = c.accountMetricDailySeries('followers', current, {});
  assert.equal(series.length, 90);
  assert.equal(series.at(-1).key, '2026-09-02');
  assert.equal(new Set(series.map(day => day.key)).size, 90);
  assert.equal(series.find(day => day.key === '2026-08-14').value, null);
  assert.equal(series.find(day => day.key === '2026-08-23').value, null);
  const html = c.accountMetricSvg(series, 'Followers', 'followers');
  assert.equal((html.match(/class="ps133-calendar-day/g) || []).length, 90);
  assert.doesNotMatch(html, /<svg|<rect|<canvas/);
  assert.match(html, /2026-08-22[^>]*data-ps69-value="0"/);
});
test('even an entirely unmeasured account gets the full 90-day calendar', () => {
  const c = analytics(), points = c.accountMetricDailySeries('followers', { settings: {} }, {});
  const html = c.accountMetricSvg(points, 'Followers', 'followers');
  assert.equal((html.match(/class="ps133-calendar-day is-missing"/g) || []).length, 90);
  assert.doesNotMatch(html, /<rect/);
});
test('SSB tests are generated in all supported languages with a safe fallback', () => {
  const c = vm.createContext({});
  vm.runInContext(declaration(worker, 'donateWebhookTestMessage'), c);
  const messages = ['tr','en','de','es','fr','ru','ar','ja'].map(c.donateWebhookTestMessage);
  assert.equal(new Set(messages).size, 8);
  assert.equal(c.donateWebhookTestMessage('fr-FR'), messages[4]);
  assert.equal(c.donateWebhookTestMessage('unsupported'), messages[1]);
  assert.equal(c.donateWebhookTestMessage('__proto__'), messages[1]);
  assert.ok(messages.every(message => !message.includes('undefined')));
});
test('email form precedes two-factor management without nested forms', () => {
  const c = vm.createContext({ swIdentityAccount: { security: { twoFactorEnabled: true } }, esc: String, ui: String });
  vm.runInContext(declaration(final, 'swIdentitySecurityMarkup'), c);
  const markup = c.swIdentitySecurityMarkup({ email: 'qa@example.test' });
  assert.ok(markup.indexOf('</form>') < markup.indexOf('class="ps132-two-factor-card"'));
  assert.ok(markup.indexOf('class="ps132-two-factor-card"') > markup.indexOf('id="ps121SwPasswordForm"'));
  assert.equal((markup.match(/id="ps56TwoFactorToggle"/g) || []).length, 1);
});
test('a saved product photo takes precedence over a central preset', () => {
  const photo = 'data:image/png;base64,aGVsbG8=';
  const c = vm.createContext({ state: () => ({ settings: {} }), esc: String, swIdentityAccount: { user: { avatar: { type: 'preset', value: 'orbit-cyan' } } }, identityAvatarObjectUrl: '' });
  vm.runInContext(['accountAvatars','swProfileAvatars'].map(name => `const ${declaration(final,name)};`).join('\n') + '\n' + declaration(final, 'accountAvatar'), c);
  assert.match(c.accountAvatar({ id: 'qa', picture: photo }), /<img src="data:image\/png/);
  assert.match(c.accountAvatar({ id: 'qa', picture: 'avatar:orbit-cyan' }), /<svg/);
});
test('tab surfaces and hidden provider fallback icons cannot inherit legacy backgrounds', async () => {
  const css = await readFile(new URL('site-v7.css', root), 'utf8');
  assert.match(css, /#ps49InfoPage \.ps49-info-content > :is\(article,section\):not\(\.ps131-product-panel\)/);
  assert.match(css, /\.ps119-account-user>\.ps129-account-avatar[^}]+background:#15181e!important/);
  assert.match(css, /\.ps66-provider-option-mark\)>\[hidden\] \{ display:none!important/);
  assert.match(css, /#modal\.ps133-event-overlay:not\(\[hidden\]\)[^}]+z-index:60000!important/);
});
