import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('../swcreate-site/node_modules/typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/esatb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const final = await readFile(new URL('../app-final.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../site-v7.css', import.meta.url), 'utf8');
const ast = ts.createSourceFile('app-final.js', final, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let declaration;
(function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'showPlayConnectWelcome') declaration = node.getText(ast);
  ts.forEachChild(node, visit);
})(ast);
assert.ok(declaration, 'showPlayConnectWelcome');

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 720 } });
  await page.setContent(`<!doctype html><html lang="tr"><head><style>${css}</style></head><body><button id="before">Önceki</button><main id="psSecondHome">Üye ana sayfası</main></body></html>`);
  await page.evaluate(source => {
    const bootstrap = `
      let fixtureState={settings:{userSession:'fixture-session',playConnectWelcomePending:true,user:{id:'fixture-user'}}};
      const PLAY_CONNECT_STORES={chromium:'https://chromewebstore.google.com/detail/play-connect/mpebmfjcdkflgiloecjonopfknojdaip',firefox:'https://addons.mozilla.org/en-US/firefox/addon/play-connect/'};
      const state=()=>fixtureState,$=selector=>document.querySelector(selector),esc=value=>String(value),ui=value=>value;
      const saveAccountState=next=>{fixtureState=next;window.fixtureState=next};
      ${source}
      window.fixtureState=fixtureState;window.showFixture=showPlayConnectWelcome;
    `;
    eval(bootstrap);
  }, declaration);
  await page.focus('#before');
  await page.evaluate(() => window.showFixture());
  const dialog = page.locator('#psConnectWelcome [role="dialog"]');
  await dialog.waitFor();
  assert.equal(await dialog.getAttribute('aria-modal'), 'true');
  assert.match(await dialog.locator('a').first().getAttribute('href'), /^https:\/\/chromewebstore\.google\.com\//);
  assert.match(await dialog.locator('a').nth(1).getAttribute('href'), /^https:\/\/addons\.mozilla\.org\//);
  const box = await dialog.boundingBox();
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 720, 'dialog fits mobile viewport');
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'A');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.className), 'ps-connect-welcome-dismiss');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#psConnectWelcome').count(), 0);
  assert.equal(await page.evaluate(() => window.fixtureState.settings.playConnectWelcomePending), false);
  await page.evaluate(() => window.showFixture());
  assert.equal(await page.locator('#psConnectWelcome').count(), 0, 'dismissal remains scoped to the account');
  await page.evaluate(() => { window.fixtureState.settings.playConnectWelcomePending = true; window.showFixture(); document.addEventListener('click', event => event.preventDefault(), true); });
  await page.locator('#psConnectWelcome a').first().click();
  assert.equal(await page.locator('#psConnectWelcome').count(), 0, 'opening the official store also marks the notice as seen');
  assert.equal(await page.evaluate(() => window.fixtureState.settings.playConnectWelcomePending), false);
  console.log('PASS: first-account Play Connect dialog is accessible, responsive and uses official stores');
} finally {
  await browser.close();
}
