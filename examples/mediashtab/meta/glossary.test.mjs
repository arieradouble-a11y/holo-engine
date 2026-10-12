import test from 'node:test';
import assert from 'node:assert/strict';
import {terms,byId,sources} from './glossary-data.js';
import {splitTerms,searchTerms,glossaryURL} from './glossary-engine.js';
import {glossaryPage} from './glossary-page.js';
test('aliases use full Cyrillic boundaries, longest phrases and exact abbreviation case',()=>{
 const text='УК, ук, стук, МКДшка. ГИС ЖКХ и КР на СОИ; теплообменником, ПРОМЫВКУ.';
 const parts=splitTerms(text,new Set(),10);
 assert.equal(parts.map(p=>p.text).join(''),text);
 assert.deepEqual(parts.filter(p=>p.id).map(p=>p.id),['uk','gis','soi','exchanger','flush']);
});
test('annotation handles ё, whitespace and repeat limits without changing original prose',()=>{
 const text='Индивидуальный прибор учета, теплоноситель и теплоносителя; радиатор и теплоизоляция.';
 const parts=splitTerms(text,new Set(),3);
 assert.deepEqual(parts.filter(p=>p.id).map(p=>p.id),['ipu','coolant','radiator']);
 assert.equal(parts.map(p=>p.text).join(''),text);
});
test('dictionary searches abbreviations, expansions and inflections with category filtering',()=>{
 assert.equal(searchTerms('рсо')[0].id,'rso');
 assert.equal(searchTerms('рсо').length,1);
 assert.equal(searchTerms('ресурсоснабжающая организация')[0].id,'rso');
 assert.equal(searchTerms('опрессовка')[0].id,'pressure-test');
 assert.equal(searchTerms('теплообменником')[0].id,'exchanger');
 assert.equal(searchTerms('рсо','heating').length,0);
 assert.equal(searchTerms('несуществующийтермин').length,0);
});
test('all references are valid; dictionary safely handles malformed deep links and query HTML',()=>{
 assert.equal(byId.size,terms.length);
 for(const term of terms){assert(sources[term.source]);assert(term.related.every(id=>byId.has(id)));assert(term.short.length<260);}
 assert.match(glossaryURL('rso'),/term=rso$/);
 assert.equal(glossaryURL('<script>'),'/metavselennaya/#glossary');
 const html=glossaryPage(new URLSearchParams({q:'<img src=x onerror=alert(1)>',term:'missing',category:'missing'}));
 assert(!html.includes('<img'));assert(html.includes('&lt;img'));assert(html.includes('не найден'));
});
