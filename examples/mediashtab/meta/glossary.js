import {byId} from './glossary-data.js';
import {glossaryURL,splitTerms} from './glossary-engine.js';

// One shared non-modal help card; React owns story text and never gets DOM rewrites.
let card,anchor,timer,dismissed;
function ensureCard(){
 if(card){if(!card.isConnected)document.body.append(card);return card;}
 card=document.createElement('aside');card.id='gkh-term-card';card.className='gkh-term-card';card.setAttribute('role','dialog');card.setAttribute('aria-labelledby','gkh-term-title');card.hidden=true;
 card.innerHTML='<button type="button" class="gkh-term-close" aria-label="Закрыть справку">×</button><span class="gkh-term-eyebrow">КОРОТКО О ТЕРМИНЕ</span><h2 id="gkh-term-title"></h2><p class="gkh-term-full"></p><p class="gkh-term-definition" id="gkh-term-definition"></p><a class="gkh-term-more">Подробнее в словаре →</a>';
 document.body.append(card);
 card.querySelector('button').addEventListener('click',()=>close(true));
 card.addEventListener('pointerenter',()=>clearTimeout(timer));
 card.addEventListener('pointerleave',laterClose);
 card.addEventListener('focusout',e=>{if(!card.contains(e.relatedTarget)&&e.relatedTarget!==anchor)close();});
 return card;
}
function place(){
 if(!anchor||!anchor.isConnected)return close();
 const r=anchor.getBoundingClientRect(),w=document.documentElement.clientWidth,h=innerHeight;
 if(r.bottom<0||r.top>h)return close();
 const box=card.getBoundingClientRect();
 card.style.left=Math.max(10,Math.min(r.left,w-box.width-10))+'px';
 const below=r.bottom+8;
 card.style.top=Math.max(10,below+box.height<h-10?below:r.top-box.height-8)+'px';
}
function close(restore=false){
 clearTimeout(timer);const old=anchor;anchor=null;
 if(old){old.setAttribute('aria-expanded','false');old.removeAttribute('aria-describedby');}
 if(card)card.hidden=true;
 if(restore&&old?.isConnected){dismissed=old;old.focus({preventScroll:true});}
}
function open(button,focus=false){
 if(!button||dismissed===button&&!focus)return;
 const term=byId.get(button.dataset.gkhTerm);if(!term)return;
 clearTimeout(timer);
 if(anchor&&anchor!==button)close();
 anchor=button;ensureCard();
 card.querySelector('h2').textContent=term.title;
 card.querySelector('.gkh-term-full').textContent=term.full;
 card.querySelector('.gkh-term-full').hidden=!term.full;
 card.querySelector('.gkh-term-definition').textContent=term.short;
 card.querySelector('a').href=glossaryURL(term.id);
 card.querySelector('a').target=window.top!==window.self?'_top':'_self';
 button.setAttribute('aria-expanded','true');button.setAttribute('aria-controls',card.id);button.setAttribute('aria-describedby','gkh-term-definition');
 card.hidden=false;place();if(focus)card.querySelector('a').focus({preventScroll:true});
}
function laterClose(){clearTimeout(timer);timer=setTimeout(()=>{if(!card?.matches(':hover')&&!card?.contains(document.activeElement)&&anchor!==document.activeElement)close();},180);}
const target=e=>e.target instanceof Element?e.target.closest('button[data-gkh-term]'):null;
document.addEventListener('pointerover',e=>{const button=target(e);if(button&&e.pointerType==='mouse'&&!button.contains(e.relatedTarget))open(button);});
document.addEventListener('pointerout',e=>{const button=target(e);if(button&&!button.contains(e.relatedTarget)){dismissed=null;laterClose();}});
document.addEventListener('focusin',e=>{const button=target(e);if(button)open(button);else if(!card?.contains(e.target))close();});
document.addEventListener('focusout',e=>{if(target(e)&&!card?.contains(e.relatedTarget)){dismissed=null;laterClose();}});
document.addEventListener('click',e=>{const button=target(e);if(button){dismissed=null;open(button,true);}else if(!card?.contains(e.target))close();});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&anchor){e.preventDefault();e.stopPropagation();close(true);}
 else if(anchor===document.activeElement&&(e.key==='ArrowDown'||e.key==='Tab'&&!e.shiftKey)){e.preventDefault();card.querySelector('a').focus();}
 else if(card?.contains(e.target)&&e.target===card.querySelector('a')&&e.key==='Tab'&&!e.shiftKey){close(true);}
 else if(card?.contains(e.target)&&e.key==='Tab'&&e.shiftKey&&e.target===card.querySelector('button')){e.preventDefault();close(true);}
},true);
addEventListener('scroll',()=>anchor&&place(),true);addEventListener('resize',()=>anchor&&place());addEventListener('hashchange',()=>close());
new MutationObserver(()=>{if(anchor&&!anchor.isConnected)close();}).observe(document.documentElement,{childList:true,subtree:true});

// Native museum/portal text only. Never use on React-owned story roots.
export function annotateText(root,limit=4){
 const seen=new Set([...root.querySelectorAll('[data-gkh-term]')].map(n=>n.dataset.gkhTerm));
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let node;
 while(node=walker.nextNode())if(!node.parentElement.closest('a,button,input,textarea,select,script,style,svg,canvas,[aria-hidden="true"],[data-no-glossary],.gkh-term-card'))nodes.push(node);
 for(const node of nodes){const parts=splitTerms(node.textContent,seen,Math.max(0,limit-seen.size));if(!parts.some(p=>p.id))continue;const fragment=document.createDocumentFragment();for(const part of parts){if(!part.id)fragment.append(part.text);else{const b=document.createElement('button');b.type='button';b.className='gkh-term';b.dataset.gkhTerm=part.id;b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-expanded','false');b.setAttribute('aria-label',part.text+' — справка');b.textContent=part.text;fragment.append(b);}}node.replaceWith(fragment);}
}

// Only the non-React portal uses this explicit, once-per-render text annotation.
export function annotatePortal(root){
 for(const paragraph of root.querySelectorAll('p,dd')){
  if(paragraph.closest('a,button,dialog,[data-no-glossary],.glossary-page,.gkh-term-card'))continue;
  const seen=new Set();const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);const nodes=[];let node;
  while(node=walker.nextNode())if(!node.parentElement.closest('a,button,script,style,svg,[aria-hidden="true"],[data-no-glossary]'))nodes.push(node);
  for(const node of nodes){const parts=splitTerms(node.textContent,seen,Math.max(0,4-seen.size));if(!parts.some(p=>p.id))continue;const fragment=document.createDocumentFragment();for(const part of parts){if(!part.id)fragment.append(part.text);else{const button=document.createElement('button');button.type='button';button.className='gkh-term';button.dataset.gkhTerm=part.id;button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label',part.text+' — справка');button.textContent=part.text;fragment.append(button);}}node.replaceWith(fragment);}
 }
}
