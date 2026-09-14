import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ts = createRequire(new URL('../swcreate-site/package.json', import.meta.url))('typescript');
const app = await readFile(new URL('../app-final.js', import.meta.url), 'utf8');
const worker = await readFile(new URL('../cloudflare-worker.js', import.meta.url), 'utf8');
function declaration(source, name) {
  const ast = ts.createSourceFile('source.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let result;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node.getText(ast); ts.forEachChild(node, visit); }
  visit(ast); assert.ok(result, name); return result;
}

for (const scenario of ['direct','linked','expired','foreign','anonymous','missing']) test(`Kick profile resolves the product-owned connection: ${scenario}`, async () => {
  const calls = [];
  const session = { userId: scenario === 'foreign' ? 'other' : 'user', account: { id: 'kick-id' }, expiresAt: scenario === 'expired' ? 0 : Date.now() + 3600000 };
  const c = vm.createContext({
    readSession: async () => scenario === 'direct' ? { sessionId: 'direct-token', session } : null,
    readUserSession: async () => scenario === 'anonymous' ? null : { session: { user: { id: 'user' } } },
    getKickSession: async () => session,
    refreshKickSessionSafely: async id => { calls.push('refresh'); return { sessionId: id, session }; },
    env: { DB: { prepare(sql) { assert.match(sql, /WHERE user_id = \?1/); return { bind(id) { assert.equal(id, 'user'); return this; }, first: async () => scenario === 'missing' ? null : { id: 'linked-token' } }; } } }
  });
  vm.runInContext(declaration(worker, 'readLinkedKickSession'), c);
  const result = await c.readLinkedKickSession({}, c.env);
  if (['foreign','anonymous','missing'].includes(scenario)) assert.equal(result, null);
  else assert.equal(result.sessionId, scenario === 'direct' ? 'direct-token' : 'linked-token');
  assert.equal(calls.includes('refresh'), scenario === 'expired');
});

function summary(insights) {
  const c = vm.createContext({ esc: String, safeKickPicture: value => value || '', rollingMonthStart: () => 0 });
  vm.runInContext(declaration(app, 'kickAccountSummary'), c);
  return c.kickAccountSummary({ settings: { kickAccount: { id: 'kick', username: 'actual', profilePicture: 'https://example.test/kick.png' }, kickInsights: insights }, totals: { followers: 200 }, events: { followers: [{at:1}], subs: { old: {} } } }, true);
}
test('unknown totals do not become zero or local event counts', () => {
  const result = summary({ broadcasterId: 'kick' });
  assert.equal(result.activeFollowerCount, '—'); assert.equal(result.activeSubscribers, '—'); assert.equal(result.followedThisMonth, '—');
  assert.match(result.profile, /https:\/\/example.test\/kick.png/);
});
test('verified totals, including actual zero, take priority over old local events', () => {
  const result = summary({ broadcasterId:'kick', activeFollowers:0, activeSubscribers:0, followedThisMonth:0, followersSource:'kick-api', subscribersSource:'kick-api' });
  assert.equal(result.activeFollowerCount, 0); assert.equal(result.activeSubscribers, 0); assert.equal(result.followedThisMonth, 0);
});
test('partial subscription events are not presented as an official active total', () => {
  assert.equal(summary({ broadcasterId:'kick', activeSubscribers:3, subscribersSource:'recorded-events' }).activeSubscribers, '—');
  assert.equal(summary({ broadcasterId:'different', activeFollowers:5 }).activeFollowerCount, '—');
});
for (const lang of ['tr','en','de','es','fr','ru','ar','ja']) test(`account settings link to SW Create, without local credential forms: ${lang}`, () => {
  const c = vm.createContext({ currentInterfaceLanguage: () => lang, esc: String, ui: String });
  vm.runInContext(declaration(app, 'accountCenterText') + declaration(app, 'centralAccountMarkup'), c);
  for (const view of ['profile','security','devices']) {
    const markup = c.centralAccountMarkup(view);
    assert.match(markup, new RegExp(`https://swcreate.com/center/\\?view=${view}`));
    assert.doesNotMatch(markup, /<form|<input|type="password"|ps55DeleteAccount/);
    assert.match(markup, /rel="noopener noreferrer"/);
  }
});
test('account reads time out and release the timer, without mixing account responses', async () => {
  let userId = 'first', callback, cleared = false;
  const c = vm.createContext({ AbortController, state: () => ({settings:{userSession:'fixture-token',user:{id:userId}}}),
    window: {setTimeout(fn) { callback = fn; return 1; },clearTimeout() { cleared = true; }},
    fetch: async (url, init) => new Promise((resolve,reject) => init.signal.addEventListener('abort', () => reject(new Error('timeout')))) });
  vm.runInContext(declaration(app, 'accountGet'), c);
  const pending = c.accountGet('/api/kick/session'); callback();
  await assert.rejects(pending, /timeout/); assert.equal(cleared, true);
  c.fetch = async () => { userId = 'second'; return {ok:true,json:async()=>({connected:true})}; };
  await assert.rejects(c.accountGet('/api/kick/session'), /Oturum değişti/);
});
test('root loader recovery works even without a loader node, and leaves OAuth untouched', () => {
  let now = 1000, rescued = 0;
  const flags = new Set(['ps15-session-pending']);
  const c = vm.createContext({ Date:{now:()=>now},rootLoadingSince:0,loaderOpenedAt:new WeakMap(), $:()=>null,$$:()=>[],
    document:{documentElement:{classList:{contains:n=>flags.has(n),remove:(...names)=>names.forEach(n=>flags.delete(n))}}},
    window:{psRescueVisibleSurface:()=>rescued++} });
  vm.runInContext(declaration(app, 'dismissStaleLoaders'), c);
  c.dismissStaleLoaders(); now += 9000; c.dismissStaleLoaders();
  assert.equal(flags.size,0); assert.equal(rescued,1);
  flags.add('ps15-session-pending'); c.window.psIdentityCallbackPending=true; c.dismissStaleLoaders(true);
  assert.equal(flags.has('ps15-session-pending'),true);
});
