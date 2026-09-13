import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ts = createRequire(new URL('../swcreate-site/package.json', import.meta.url))('typescript');
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const worker = await readFile(new URL('../cloudflare-worker.js', import.meta.url), 'utf8');
function declaration(source, name) {
  const ast = ts.createSourceFile('source.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let result;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node.getText(ast); ts.forEachChild(node, visit); }
  visit(ast); assert.ok(result, name); return result;
}
for (const provider of ['google', 'kick']) for (const mode of ['login', 'register']) for (const remember of [true, false]) {
  test(`${provider}: ${mode}, remember=${remember} continues with existing or first-time identity`, () => {
    let target;
    const c = vm.createContext({ URL, Uint8Array, crypto: globalThis.crypto, SW_IDENTITY_ORIGIN: 'https://api.swcreate.com', SW_IDENTITY_REDIRECT: 'https://pstreamers.com/identity/callback',
      $: selector => selector.includes('remember') ? { checked: remember } : { dataset: { mode } },
      sessionStorage: { setItem() {} }, location: { assign: value => { target = new URL(value); } } });
    vm.runInContext(['identityProductRequest', 'identityAuthorizePath', 'startSwIdentityLogin'].map(name => declaration(app, name)).join('\n'), c);
    c.startSwIdentityLogin(provider);
    assert.equal(target.origin, 'https://api.swcreate.com'); assert.equal(target.pathname, `/api/auth/oauth/${provider}/start`);
    assert.equal(target.searchParams.get('mode'), 'register'); assert.equal(target.searchParams.get('remember'), remember ? '1' : '0');
    const product = new URL(target.searchParams.get('return_to'), target.origin);
    assert.equal(product.searchParams.get('client_id'), 'play-streamers');
    assert.equal(product.searchParams.get('redirect_uri'), 'https://pstreamers.com/identity/callback');
    assert.match(product.searchParams.get('state'), /^[a-f0-9]{48}$/);
  });
}
function callback({ validState = true, twoFactor = false, newUser = false, fail = false } = {}) {
  const url = new URL('https://pstreamers.com/?sw_identity_callback=1&state=expected&code=' + 'a'.repeat(64));
  if (twoFactor) { url.searchParams.set('two_factor_required', '1'); url.searchParams.set('challenge_id', 'b'.repeat(64)); }
  const calls = [], timers = new Map(); let resolveFetch;
  const c = vm.createContext({ URL, Event, AbortController, location: { href: url.href },
    window: { setTimeout: fn => { timers.set(1, fn); return 1; }, clearTimeout: id => timers.delete(id), dispatchEvent: event => calls.push(event.type) },
    sessionStorage: { getItem: () => validState ? 'expected' : 'wrong', removeItem: key => calls.push(key) },
    history: { replaceState: (a,b,path) => calls.push(path) }, notice: (...args) => calls.push(args), $: () => ({}),
    showLandingAuthV101: mode => calls.push(mode), showInlineTwoFactor: (form,id) => calls.push(id), SW_IDENTITY_REDIRECT: 'https://pstreamers.com/identity/callback', API_BASE: 'https://api.pstreamers.com',
    state: { settings: {} }, save() {}, render() {}, refreshInterfaceLanguage() {}, adoptAuthenticatedUser(user) { c.state.settings.user = user; },
    fetch: () => { calls.push('fetch'); return new Promise(resolve => { resolveFetch = () => resolve({ ok: !fail, json: async () => fail ? { error: 'fixture failure' } : { sessionId: 'fixture-only', user: { id: 'fixture' }, isNewUser: newUser } }); }); } });
  vm.runInContext(declaration(app, 'completeSwIdentityCallback'), c);
  return { c, calls, timers, finish: () => resolveFetch() };
}
test('callback removes codes before exchange and holds routing until session adoption', async () => {
  const { c, calls, finish, timers } = callback({ newUser: true }); const pending = c.completeSwIdentityCallback();
  assert.equal(c.window.psIdentityCallbackPending, true); assert.equal(calls[0], '/account?mode=login');
  finish(); await pending;
  assert.equal(c.state.settings.playConnectWelcomePending, true); assert.equal(c.window.psIdentityCallbackPending, false);
  assert.ok(calls.includes('/home')); assert.equal(timers.size, 0);
});
test('existing-account exchange does not create welcome intent', async () => {
  const { c, finish } = callback(); const pending = c.completeSwIdentityCallback(); finish(); await pending;
  assert.equal(c.state.settings.playConnectWelcomePending, undefined);
});
test('invalid state never reaches exchange and releases routing', async () => {
  const { c, calls } = callback({ validState: false }); await c.completeSwIdentityCallback();
  assert.ok(!calls.includes('fetch')); assert.equal(c.window.psIdentityCallbackPending, false);
});
test('two-factor return keeps the product state and never exchanges prematurely', async () => {
  const { c, calls } = callback({ twoFactor: true }); await c.completeSwIdentityCallback();
  assert.ok(calls.includes('/account?mode=login&two_factor=1')); assert.ok(calls.includes('b'.repeat(64)));
  assert.ok(!calls.includes('fetch')); assert.ok(!calls.includes('ps-sw-identity-state'));
});
test('failed exchange shows recoverable login and never adopts a session', async () => {
  const { c, finish, calls } = callback({ fail: true }); const pending = c.completeSwIdentityCallback(); finish(); await pending;
  assert.equal(c.state.settings.userSession, undefined); assert.equal(c.window.psIdentityCallbackPending, false); assert.ok(!calls.includes('/home'));
});
for (const existing of [true, false]) test(`first-account signal is server-derived, existing=${existing}`, async () => {
  const c = vm.createContext({ isPublicEmail: () => true, normalizeEmail: s => s, randomBase64Url: () => 'fixture-new-user', getUserById: async id => ({ id }),
    env: { DB: { prepare: () => ({ bind() { return this; }, first: async () => existing ? { id: 'fixture-old-user', swIdentityUserId: 'identity-fixture' } : null, run: async () => ({}) }) } } });
  vm.runInContext(declaration(worker, 'upsertSwIdentityUser'), c);
  const result = await c.upsertSwIdentityUser({ id: 'identity-fixture', email: 'fixture@example.test' }, c.env);
  assert.equal(result.isNewUser, !existing); assert.equal(result.user.id, existing ? 'fixture-old-user' : 'fixture-new-user');
});
test('public creator analytics rejects a burst without storing raw addresses', async () => {
  let now = 1_780_000_000_000;
  class FrozenDate extends Date { static now() { return now; } }
  const buckets = new Map(), calls = [];
  const env = { AUTH_PEPPER: 'fixture-pepper', DB: { prepare(sql) { return { bind(rateKey, bucket) { calls.push({ sql, rateKey, bucket }); this.rateKey = rateKey; this.bucket = bucket; return this; }, async run() { const key = `${this.rateKey}:${this.bucket}`, count = buckets.get(key) || 0; if (count >= 60) return { meta: { changes: 0 } }; buckets.set(key, count + 1); return { meta: { changes: 1 } }; } }; } } };
  const c = vm.createContext({ Date: FrozenDate, sha256Hex: async value => `hash:${value.length}` });
  vm.runInContext(declaration(worker, 'allowCreatorPageAnalyticsRequest'), c);
  const request = { headers: { get: key => key === 'CF-Connecting-IP' ? '203.0.113.7' : null } };
  for (let index = 0; index < 60; index += 1) assert.equal(await c.allowCreatorPageAnalyticsRequest(request, 'fixture', env), true);
  assert.equal(await c.allowCreatorPageAnalyticsRequest(request, 'fixture', env), false);
  assert.ok(calls.every(call => !call.rateKey.includes('203.0.113.7')));
  now += 60000;
  assert.equal(await c.allowCreatorPageAnalyticsRequest(request, 'fixture', env), true);
});
