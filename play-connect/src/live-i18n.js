import { localeCurrency } from './locale-settings.js';
export const LOCALES = [["tr","Türkçe"],["en","English"],["de","Deutsch"],["es","Español"],["fr","Français"],["ru","Русский"],["ar","العربية"],["ja","日本語"]];
const supported = new Set(LOCALES.map(([code]) => code));
const CACHE_VERSION = 'pc-ui-cache-2026-09-04.2';
const records = new WeakMap(), attributes = new WeakMap();
const ignored = 'script,style,textarea,[contenteditable],[data-no-translate],.locale-picker';
const attributeNames = ['placeholder','title','aria-label','aria-description','alt'];
let observer, generation = 0, selected = 'tr', catalog = {sources:[],translations:{}}, catalogPromise;
let dictionary = {}, patterns = [], sourceSet = new Set(), refreshMenu = () => {};
const resultCaches = new Map();
const clean = value => String(value || '').replace(/\s+/g,' ').trim();
const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key,value) => { try { localStorage.setItem(key,value); } catch {} };
export function resolveLocale(preference, languages = globalThis.navigator?.languages || [], uiLanguage = globalThis.chrome?.i18n?.getUILanguage?.()) {
  if (supported.has(preference)) return preference;
  return [uiLanguage, ...languages].map(value => String(value || '').toLowerCase().split(/[-_]/)[0]).find(value => supported.has(value)) || 'tr';
}
export function currentLocale() { return selected; }
function preference() { return read('play-connect-locale') || 'auto'; }
function compile(source) {
  const names=[], parts=source.split(/(\{\d+\})/g);
  if(parts.length<3 || source.replace(/\{\d+\}/g,'').trim().length<5)return null;
  const regex=parts.map(part=>/^\{\d+\}$/.test(part)?(names.push(part),'(.+?)'):part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('');
  return {source,names,regex:new RegExp('^'+regex+'$')};
}
function identify(text) {
  if(sourceSet.has(text))return {source:text,values:{}};
  for(const pattern of patterns) {
    const match=text.match(pattern.regex);
    if(match)return {source:pattern.source,values:Object.fromEntries(pattern.names.map((name,i)=>[name,match[i+1]]))};
  }
  return null;
}
export function translate(text,depth=0) {
  if(selected==='tr')return text;
  const cache=resultCaches.get(selected);
  if(cache?.has(text))return cache.get(text);
  const match=identify(clean(text));
  if(!match || !dictionary[match.source])return text;
  const output=dictionary[match.source].replace(/\{\d+\}/g,key=>{
    const value=match.values[key]??key;
    return depth<3 && identify(value)?translate(value,depth+1):value;
  });
  // Persisted cache holds only shipped strings. Dynamic values stay in bounded memory.
  if(cache){if(cache.size>=1500)cache.delete(cache.keys().next().value);cache.set(text,output);}
  return output;
}
async function loadCatalog() {
  catalogPromise ||= (async()=>{
    let data;
    try{data=JSON.parse(read(CACHE_VERSION)||'null');}catch{}
    if(!Array.isArray(data?.sources) || !data.sources.every(s=>typeof s==='string') || !LOCALES.slice(1).every(([l])=>data?.translations?.[l] && Object.values(data.translations[l]).every(s=>typeof s==='string'))) {
      const response=await fetch(new URL('./ui-catalog.json',import.meta.url));
      if(!response.ok)throw new Error('Language catalog unavailable');
      data=await response.json();
      write(CACHE_VERSION,JSON.stringify(data));
    }
    catalog=data;sourceSet=new Set(data.sources);
    patterns=data.sources.map(compile).filter(Boolean).sort((a,b)=>b.source.length-a.source.length);
    for(const [locale,translations]of Object.entries(data.translations))resultCaches.set(locale,new Map(Object.entries(translations)));
  })();
  return catalogPromise;
}
function translateText(node) {
  if(!node.parentElement || node.parentElement.closest(ignored))return;
  const old=records.get(node),source=old?.output===node.nodeValue?old.source:node.nodeValue;
  const value=clean(source);
  if(!identify(value))return;
  const output=selected==='tr'?source:source.replace(value,()=>translate(value));
  if(node.nodeValue!==output)node.nodeValue=output;
  records.set(node,{source,output});
}
function translateAttributes(element) {
  if(element.closest(ignored))return;
  const map=attributes.get(element)||{};
  for(const name of attributeNames){
    if(!element.hasAttribute(name))continue;
    const value=element.getAttribute(name),source=map[name]?.output===value?map[name].source:value;
    if(!identify(clean(source)))continue;
    const output=selected==='tr'?source:translate(source);
    if(value!==output)element.setAttribute(name,output);
    map[name]={source,output};
  }
  attributes.set(element,map);
}
export function translateTree(root) {
  if(!root)return root;
  if(root.nodeType===3){translateText(root);return root;}
  if(root.nodeType===1){if(root.closest(ignored))return root;translateAttributes(root);}
  const doc=root.ownerDocument||document;
  const walker=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let node=walker.nextNode();node;node=walker.nextNode())translateText(node);
  root.querySelectorAll?.('[placeholder],[title],[aria-label],[aria-description],[alt]').forEach(translateAttributes);
  return root;
}
export async function installLiveI18n({locale=preference(),root=document.body}={}) {
  const ticket=++generation;selected=resolveLocale(locale);observer?.disconnect();
  try { await loadCatalog(); } catch {
    catalogPromise = null;
    if(ticket!==generation)return;
    selected='tr';
  }
  if(ticket!==generation || !root)return;
  dictionary=catalog.translations[selected]||{};
  document.documentElement.lang=selected;
  document.documentElement.dir=selected === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dataset.pcLocale=selected;
  translateTree(root);
  observer=new MutationObserver(changes=>{
    // Mutation callbacks run before paint. Never rescan the unchanged document.
    observer.disconnect();
    const nodes=new Set();
    for(const change of changes){
      if(change.type==='attributes')translateAttributes(change.target);
      else if(change.type==='characterData')nodes.add(change.target);
      else change.addedNodes.forEach(node=>nodes.add(node));
    }
    for(const node of nodes)if(node.isConnected)translateTree(node);
    observe();
  });
  const observe=()=>observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:attributeNames});
  observe();
  document.documentElement.classList.remove('pc-i18n-loading');
  refreshMenu();
  window.dispatchEvent(new CustomEvent('pc-locale-change',{detail:{locale:selected,currency:localeCurrency(selected)}}));
}
export function installLocaleMenu() {
  const button=document.querySelector('#localeButton'), menu=document.querySelector('#localeMenu');
  if(!button || !menu) return;
  const close=()=>{menu.hidden=true;button.setAttribute('aria-expanded','false');};
  refreshMenu=()=>{
    const pref=preference();
    button.textContent=selected.toUpperCase();
    button.setAttribute('aria-label',translate('Dil seçimi'));
    menu.querySelectorAll('button').forEach(item=>{
      item.classList.toggle('active',item.dataset.locale===pref);
      item.setAttribute('aria-pressed',String(item.dataset.locale===pref));
    });
  };
  const autoNames={tr:'Sistem dili',en:'System language',de:'Systemsprache',es:'Idioma del sistema',fr:'Langue du système',ru:'Язык системы',ar:'لغة النظام',ja:'システム言語'};
  const build=()=>{
    menu.replaceChildren(...[['auto',autoNames[selected]],...LOCALES].map(([code,label])=>{
      const item=document.createElement('button');item.type='button';item.dataset.locale=code;
      const name=document.createElement('b');name.textContent=label;
      const tag=document.createElement('em');tag.textContent=code==='auto' ? selected.toUpperCase() : code.toUpperCase();
      item.append(name,tag);
      item.addEventListener('click',()=>{write('play-connect-locale',code);close();void apply();button.focus();});
      return item;
    }));
    refreshMenu();
  };
  const apply=async()=>{
    const promise=installLiveI18n();build();await promise;build();
    await globalThis.chrome?.runtime?.sendMessage?.({type:'SET_UI_LOCALE',locale:selected});
  };
  button.setAttribute('aria-controls','localeMenu');
  button.addEventListener('click',()=>{menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)(menu.querySelector('.active')||menu.querySelector('button')).focus();});
  document.addEventListener('click',event=>{if(!event.target.closest('.locale-picker'))close();});
  menu.addEventListener('keydown',event=>{
    const items=[...menu.querySelectorAll('button')], index=items.indexOf(document.activeElement);
    if(event.key==='Escape'){close();button.focus();event.preventDefault();}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();
    }
  });
  window.addEventListener('storage',event=>{if(event.key==='play-connect-locale')void apply();});
  window.addEventListener('languagechange',()=>{if(preference()==='auto')void apply();});
  return apply();
}
