import {byId} from '/metavselennaya/glossary-data.js';
import {annotateText} from '/metavselennaya/glossary.js?v=20260916-2';
import {termMatch} from '/metavselennaya/glossary-museum-search.js';
const objects=await fetch('./museum-glossary-index.json?v=20260916-1').then(r=>{if(!r.ok)throw new Error('Museum glossary index unavailable');return r.json();});
const byTitle=new Map(objects.map(o=>[o.title,o]));
const makeTerm=id=>{const t=byId.get(id),b=document.createElement('button');b.type='button';b.className='gkh-term';b.dataset.gkhTerm=id;b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-expanded','false');b.setAttribute('aria-label',t.title+' — справка');b.textContent=t.title;return b;};
function sync(){
 document.querySelectorAll('.grid .item').forEach(button=>{
  if(button.parentElement.classList.contains('museum-card'))return;
  const o=byTitle.get(button.querySelector('.nm')?.textContent);if(!o)return;
  const wrapper=document.createElement('div');wrapper.className='museum-card';button.before(wrapper);wrapper.append(button);
  if(o.titleTerms.length){const row=document.createElement('div');row.className='museum-card-terms';row.setAttribute('aria-label','Справки к названию');for(const id of o.titleTerms)row.append(makeTerm(id));wrapper.append(row);}
 });
 document.querySelectorAll('.win[data-idx]').forEach(win=>{
  const o=objects[Number(win.dataset.idx)],pad=win.querySelector('.info .pad');if(!o||!pad)return;
  // stepObject reuses the window, so rebuild its term list when the object changes.
  const old=pad.querySelector('.museum-object-terms');
  if(old?.dataset.file!==o.file){old?.remove();const section=document.createElement('section');section.className='museum-object-terms';section.dataset.file=o.file;section.hidden=!o.terms.length;section.dataset.noGlossary='';const heading=document.createElement('h4');heading.textContent='СОКРАЩЕНИЯ И ПОНЯТИЯ';section.append(heading);const p=document.createElement('p');p.textContent='Нажмите на обозначение, чтобы прочитать справку.';section.append(p);const list=document.createElement('div');list.className='museum-term-list';for(const id of o.terms)list.append(makeTerm(id));section.append(list);pad.prepend(section);}
  pad.querySelectorAll('p,.k>b,.pill').forEach(p=>{if(!p.closest('[data-no-glossary]'))annotateText(p,6);});
 });
}
let queued=false;
const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync();});};
const desk=document.getElementById('desk');
if(desk)new MutationObserver(schedule).observe(desk,{childList:true,subtree:true,attributes:true,attributeFilter:['data-idx']});
// Expand the existing search corpus after the asynchronously loaded glossary arrives.
window.museumGlossarySearch=o=>byTitle.get(o.title)?.search||'';
window.museumGlossaryMatches=(o,q)=>termMatch(byTitle.get(o.title),q);
dispatchEvent(new Event('museum:glossary-ready'));
sync();
