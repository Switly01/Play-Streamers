import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createCatalogLookup } from '../live-i18n.js';
const ts = createRequire(new URL('../swcreate-site/package.json', import.meta.url))('typescript');
const source = await readFile(new URL('../app-final.js', import.meta.url),'utf8');
function declaration(name) {
  const ast = ts.createSourceFile('app.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS); let found;
  function visit(n) { if(ts.isFunctionDeclaration(n) && n.name?.text===name) found=n.getText(ast); ts.forEachChild(n,visit); }
  visit(ast); assert.ok(found,name);return found;
}
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
for (const lang of ['en','de','es','fr','ru','ar','ja']) {
  const {translations} = JSON.parse(await readFile(new URL(`../locales/${lang}.json`,import.meta.url),'utf8'));
  const translate=createCatalogLookup(translations);
  test(`${lang}: member slogan and generated draft scaffolding use the selected language`, () => {
    assert.notEqual(translate('Ritim sende.'),'Ritim sende.');
    const c=vm.createContext({});vm.runInContext(declaration('createContentDrafts'),c);
    const text=c.createContentDrafts('Original viewer topic', '',translate,{format:'announcement',length:140,locale:lang});
    assert.ok(text.includes(translate('Yayında görüşmek üzere!')));
    assert.ok(text.includes('Original viewer topic'));
    assert.ok(!text.includes('──────────'));
  });
  test(`${lang}: exported report localizes labels, counts and direction without exporting internal keys`, () => {
    const c=vm.createContext({esc});vm.runInContext(declaration('buildPlanReport'),c);
    const report=c.buildPlanReport({events:{donations:[{name:'Viewer',amount:1234.5,currency:'EUR',at:1,message:'<b>original</b>'}]},stats:{donations:{all:{private_internal_key:{name:'Viewer',total:1234.5}}}}},translate,lang);
    assert.ok(report.includes(translate('Bağışlar')));
    assert.ok(report.includes(translate('Kullanıcı')));
    assert.ok(report.includes(new Intl.NumberFormat(lang).format(1234.5)));
    assert.ok(report.includes(`dir="${lang==='ar'?'rtl':'ltr'}"`));
    assert.ok(!report.includes('private_internal_key'));
    assert.ok(report.includes('&lt;b&gt;original&lt;/b&gt;'));
    assert.ok(!report.includes('<th>Kullanıcı</th>'));
  });
}
test('draft shortening does not split emoji grapheme clusters or decimal sentence fragments',()=>{
  const c=vm.createContext({});vm.runInContext(declaration('createContentDrafts'),c);
  const result=c.createContentDrafts('👩‍💻'.repeat(160),'',s=>s,{format:'short',length:140,locale:'en'}).split('\n')[1];
  assert.equal([...new Intl.Segmenter('en',{granularity:'grapheme'}).segment(result)].length,140);
  assert.ok(result.endsWith('👩‍💻…'));
  assert.ok(c.createContentDrafts('Version 2.5 is here. Join us.','',s=>s,{format:'announcement'}).includes('Version 2.5 is here.'));
});
test('export waits for the language catalog and preserves the chosen locale',async()=>{
  let waited=false, received;
  const c=vm.createContext({currentInterfaceLanguage:()=> 'de',window:{psGetInterfaceTranslator:async locale=>{assert.equal(locale,'de');await Promise.resolve();waited=true;return s=>'DE:'+s;}},buildPlanReport:(current,translate,locale)=>{assert.ok(waited);assert.equal(locale,'de');return translate('test');},downloadPlanFile:(...args)=>{received=args;}});
  vm.runInContext(declaration('downloadPlanReport'),c);await c.downloadPlanReport({});
  assert.deepEqual(received,['DE:test','html','text/html','de']);
});
