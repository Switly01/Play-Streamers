import fs from 'node:fs';
import path from 'node:path';
import ts from '../../swcreate-site/node_modules/typescript/lib/typescript.js';
const root = path.resolve(import.meta.dirname, '..');
const sources = new Set();
function add(value) {
  value=value.replace(/\s+/g,' ').trim();
  if(value.length>1 && value.length<1800 && /[a-zçğıöşü]/i.test(value) && !/^(https?:|[.#][\w-]+$)/.test(value)) sources.add(value);
}
function markup(value) {
  for(const match of value.matchAll(/(?:placeholder|title|aria-label|alt)="([^"]+)"/g)) add(match[1]);
  value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<[^>]+>/g,'\n').split('\n').forEach(add);
}
for(const file of ['options/options.html','popup/popup.html']) markup(fs.readFileSync(path.join(root,file),'utf8'));
for(const file of ['options/options.js','popup/popup.js','src/providers.js','src/background.js']) {
  const source=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true);
  function visit(node){
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)){if(node.text.includes('<'))markup(node.text);else add(node.text);}
    else if(ts.isTemplateExpression(node)){
      const value=node.head.text+node.templateSpans.map((part,i)=>`{${i}}${part.literal.text}`).join('');
      if(value.includes('<'))markup(value);else add(value);
    }
    ts.forEachChild(node,visit);
  }
  visit(source);
}
const catalog={sources:[...sources].sort(),translations:{}};
const previous=JSON.parse(fs.readFileSync(path.join(root,'src','ui-catalog.json'),'utf8'));
const reviewed=JSON.parse(fs.readFileSync(path.join(root,'src','i18n-reviewed.json'),'utf8'));
for(const [key] of reviewed.entries)if(!catalog.sources.includes(key))catalog.sources.push(key);
for(const locale of ['en','de','es','fr','ru','ar','ja']){
  const site=JSON.parse(fs.readFileSync(path.join(root,'..','locales',`${locale}.json`),'utf8')).translations;
  catalog.translations[locale]=Object.fromEntries(catalog.sources.filter(key=>previous.translations[locale]?.[key]||site[key]).map(key=>[key,previous.translations[locale]?.[key]||site[key]]));
  const index=reviewed.languages.indexOf(locale);
  for(const [source,...values]of reviewed.entries)catalog.translations[locale][source]=values[index];
  Object.assign(catalog.translations[locale],reviewed.overrides?.[locale]||{});
}
process.stdout.write(JSON.stringify(catalog));
