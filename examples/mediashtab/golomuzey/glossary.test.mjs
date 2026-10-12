import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {byId} from '../meta/glossary-data.js';
import {museumLinks} from '../meta/glossary-museum-links.js';
import {splitTerms,searchTerms} from '../meta/glossary-engine.js';
import {termMatch} from '../meta/glossary-museum-search.js';
import {integrateBundle,stripIntegration,injection} from './integrate-glossary.mjs';
test('abbreviation search cannot match an unrelated word such as вручную',()=>{
 assert.equal(termMatch({terms:['vru']},'ВРУ'),true);
 assert.equal(termMatch({terms:['grpsh']},'вру'),false);
 assert.equal(termMatch({terms:['vru']},'вводно-распределительное устройство'),true);
 assert.equal(termMatch({terms:['vru']},'обычный поиск'),null);
});

test('new equipment abbreviations have exact boundaries and contextual museum links',()=>{
 const parts=splitTerms('БМК, ХВО, ОПУ, GSM-модем; ОПУЩЕНЫ, ДОПУСК.',new Set(),99);
 assert.deepEqual(parts.filter(p=>p.id).map(p=>p.id),['bmk','hvo','opu','gsm']);
 for(const id of ['bmk','hvo','opu','gsm'])assert(museumLinks[id]);
 assert.equal(searchTerms('химическая водоочистка')[0].id,'hvo');
});

test('standalone integration preserves every bundle payload and is idempotent',async()=>{
 const objects=JSON.parse(await readFile(new URL('museum-glossary-index.json',import.meta.url),'utf8'));
 for(const object of objects){
  const html=await readFile(new URL(object.file,import.meta.url),'utf8');
  assert.equal(html.split('id="museum-glossary-bootstrap"').length,2,object.file);
  assert(integrateBundle(html)===html,object.file+' idempotence');
  const original=stripIntegration(html);
  assert(integrateBundle(original)===html,object.file+' roundtrip');
  assert(html.indexOf('<meta charset="utf-8">')<1024,object.file+' encoding declaration');
  for(const kind of ['manifest','template']){
   const pattern=new RegExp('<script type="__bundler/'+kind+'">([\\s\\S]*?)<\\/script>');
   assert.equal(html.match(pattern)?.[1],original.match(pattern)?.[1],object.file+' '+kind);
   assert(original.match(pattern)?.[1],object.file+' missing '+kind);
  }
 }
 assert(injection.includes('https?:$')); // Do not load site services in offline file:// viewers.
});
test('museum symbols keep boundaries, case and longest notation',()=>{
 const s='DN200 PN16 Ду50, кВт·ч, кВт, кВ, МПа; PEN PE; TN-C-S; ТТ и TT. ИТПшка, Pe, ком.';
 const parts=splitTerms(s,new Set(),99);
 assert.equal(parts.map(p=>p.text).join(''),s);
 assert.deepEqual(parts.filter(p=>p.id).map(p=>p.id),['dn','pn','kwh','kw','kv','mpa','pen','pe','tncs','tt']);
 assert.equal(searchTerms('КНС')[0].full,'Канализационная насосная станция');
 assert.equal(searchTerms('автоматический ввод резерва')[0].id,'avr');
 assert.equal(searchTerms('квт·ч')[0].id,'kwh');
});
test('every museum object has valid contextual terms and real deep-link targets',async()=>{
 const objects=JSON.parse(await readFile(new URL('museum-glossary-index.json',import.meta.url),'utf8'));
 assert.equal(objects.length,60);assert.equal(new Set(objects.map(o=>o.file)).size,60);
 assert(objects.filter(o=>o.terms.length).length>=55);
 for(const o of objects){assert(o.terms.every(id=>byId.has(id)));assert(o.titleTerms.every(id=>o.terms.includes(id)));await access(new URL(o.file,import.meta.url));}
 for(const [id,file] of Object.entries(museumLinks)){assert(byId.has(id));assert(objects.some(o=>o.file===file&&o.terms.includes(id)));}
});
