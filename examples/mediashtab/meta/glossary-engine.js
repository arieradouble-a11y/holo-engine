import {terms,byId} from './glossary-data.js';
export const normalize=value=>String(value).toLocaleLowerCase('ru').replaceAll('ё','е').replace(/\s+/g,' ').trim();
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const aliases=[...new Map(terms.flatMap(term=>term.aliases.map(alias=>[normalize(alias),{id:term.id,alias,exact:/^[А-ЯЁA-Z\s-]{2,}$/.test(alias)||(term.caseSensitive&&alias.length<10)}]))).values()].sort((a,b)=>b.alias.length-a.alias.length);
const lookup=new Map(aliases.map(a=>[normalize(a.alias),a]));
const pattern=new RegExp('(?<![\\p{L}\\p{N}_])('+aliases.map(a=>escape(a.alias).replace(/[её]/gi,'[её]').replace(/\s+/g,'\\s+')+( ['DN','PN','Ду'].includes(a.alias)?'(?![\\p{L}_])':'(?![\\p{L}\\p{N}_])')).join('|')+')','giu');
export function splitTerms(text,seen=new Set(),limit=4){
 const parts=[];let end=0,count=0;
 for(const match of text.matchAll(pattern)){
  const entry=lookup.get(normalize(match[0]));
  if(!entry||seen.has(entry.id)||count>=limit||entry.exact&&match[0]!==entry.alias)continue;
  if(match.index>end)parts.push({text:text.slice(end,match.index)});
  parts.push({text:match[0],id:entry.id});seen.add(entry.id);count++;end=match.index+match[0].length;
 }
 if(end<text.length)parts.push({text:text.slice(end)});
 return parts;
}
export function searchTerms(query='',category='all'){
 const q=normalize(query).slice(0,100),words=q.split(' ').filter(Boolean);
 const abbreviation=aliases.find(a=>a.exact&&normalize(a.alias)===q);
 return terms.filter(t=>(category==='all'||t.category===category)&&(!abbreviation||t.id===abbreviation.id)).map(t=>{
  const labels=[t.title,t.full,...t.aliases].map(normalize),body=normalize(t.short+' '+t.detail);
  const score=!q?1:labels.includes(q)?100:labels.some(v=>v.startsWith(q))?80:words.every(w=>labels.some(v=>v.includes(w)))?60:words.every(w=>labels.some(v=>v.includes(w))||body.includes(w))?20:0;
  return {term:t,score};
 }).filter(r=>r.score).sort((a,b)=>b.score-a.score||a.term.title.localeCompare(b.term.title,'ru')).map(r=>r.term);
}
export function glossaryURL(id){return '/metavselennaya/#glossary'+(byId.has(id)?'?term='+encodeURIComponent(id):'');}
