import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveLocale, LOCALES } from '../src/live-i18n.js';
import { normalizeCandidate, detectCurrency } from '../src/core.js';
import { localeCurrency } from '../src/locale-settings.js';
test('system language supports regional tags and manual preference wins',()=>{
  assert.equal(resolveLocale('auto',['de-DE'],'en-US'),'en');
  assert.equal(resolveLocale('auto',['ja-JP'],''),'ja');
  assert.equal(resolveLocale('fr',['de-DE'],'en-US'),'fr');
  assert.equal(resolveLocale('unknown',['xx'],'xx'),'tr');
  assert.equal(resolveLocale(null,['ar-SA'],null),'ar');
  assert.equal(LOCALES.length,8);
});
test('locale sources never call an external translation service',async()=>{
  const script=await readFile(new URL('../src/live-i18n.js',import.meta.url),'utf8');
  assert.doesNotMatch(script,/https:\/\/|i18n\/translate/);
  assert.match(script,/generation/);
  assert.match(script,/selected === 'ar' \? 'rtl' : 'ltr'/);
});
test('bundled translations retain every interpolation placeholder',async()=>{
  const catalog=JSON.parse(await readFile(new URL('../src/ui-catalog.json',import.meta.url),'utf8'));
  for(const [locale,entries]of Object.entries(catalog.translations)){
    assert.ok(Object.keys(entries).length>300,locale);
    for(const [source,output]of Object.entries(entries)){
      assert.ok(output,locale+source);
      for(const key of source.match(/\{\d+\}/g)||[])assert.ok(output.includes(key),locale+source);
      assert.doesNotMatch(output,/918470|98470/);
    }
  }
});
test('locale defaults never replace an explicit donation currency',async()=>{
  for(const locale of ['tr','en','de','es','fr','ru','ar','ja']) {
    for(const currency of ['USD','JPY','RUB','SAR','BRL','IDR','PLN','KRW','MXN']) {
      const event=await normalizeCandidate({id:'fixture',name:'Fixture',integration:'session',defaultCurrency:localeCurrency(locale)},{name:'Test',amount:'10',currency,eventId:'fixture'});
      assert.equal(event.currency,currency);
    }
    assert.equal(detectCurrency('500',localeCurrency(locale)),localeCurrency(locale));
  }
  assert.equal(detectCurrency('R$ 20','SAR'),'BRL');
  assert.equal(detectCurrency('500 RUB','TRY'),'RUB');
});
