/* Style the model document even when an asynchronous bundle replaces its DOM. */
(()=>{
 const frames=new WeakMap();
 const css=`
html[data-museum-atlas=light]{color-scheme:light;background:#faf7ed}
html[data-museum-atlas=light] body,html[data-museum-atlas=light] [data-atlas-scene]{background:#faf7ed!important}
/* Standard CSS filters work on mobile canvas; never filter the iframe or panels. */
html[data-museum-atlas=light] [data-atlas-ink]{filter:invert(1) hue-rotate(180deg) saturate(.65) brightness(.98)}
html[data-museum-atlas=light] [data-atlas-overlay]{opacity:0!important;pointer-events:none!important}
html[data-museum-atlas=light] :is([style*="--hm-head"],[style*="--hm-side"],[style*="--hm-foot"],#hmbar){color:#243f42!important;text-shadow:none!important}
html[data-museum-atlas=light] :is([style*="--hm-head"],[style*="--hm-side"],[style*="--hm-foot"]) [style*="color:"]{color:#314f54!important;text-shadow:none!important}
html[data-museum-atlas=light] :is([style*="--hm-title"],[style*="--hm-count"]){color:#183e43!important;text-shadow:none!important}
html[data-museum-atlas=light] :is([style*="--hm-side"],[style*="--hm-tools"],#hmbar){background:#f5f4ed!important;border-color:#b8cbc2!important;box-shadow:0 3px 20px #234c4118!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
html[data-museum-atlas=light] [style*="--hm-info"]{background:#e8eee5!important;border-color:#b8cbc2!important}
html[data-museum-atlas=light] :is([style*="--hm-head"],[style*="--hm-side"]) :is(button,select,input){color:#27494f!important;background:#eef2e9!important;border-color:#adc4b9!important;text-shadow:none!important;accent-color:#236b64}
html[data-museum-atlas=light] :is([style*="--hm-head"],[style*="--hm-side"]) button:hover{background:#dce9dd!important}
html[data-museum-atlas=light] :is([style*="--hm-head"],[style*="--hm-side"]) a{color:#17635d!important}
html[data-museum-atlas=light] #hmbar button{color:#3e5b60!important;background:transparent!important}
html[data-museum-atlas=light] #hmbar button.on{color:#125b50!important;background:#dce9dd!important;box-shadow:inset 0 3px #31776b}
html[data-museum-atlas=light] #hmbar button svg{filter:none!important}
html[data-museum-atlas=light] #hmbar em{color:inherit!important}
@media(max-width:640px){
html[data-museum-atlas=light] [style*="--hm-head"]{background:none!important}
html[data-museum-atlas=light] [style*="--hm-info"]{background:transparent!important}
}
`;
 function apply(frame,state){
  try{
   if(new URL(frame.src,location.href).origin!==location.origin)return;
   const doc=frame.contentDocument;if(!doc)return;
   if(state.doc!==doc){
    state.observer?.disconnect();state.doc=doc;
    state.observer=new MutationObserver(()=>schedule(frame,state));
    state.observer.observe(doc,{childList:true,subtree:true,attributes:true,attributeFilter:['data-hm']});
   }
   if(!doc.head)return;
   if(!doc.getElementById('museum-atlas-controls')){
    const style=doc.createElement('style');style.id='museum-atlas-controls';style.textContent=css;doc.head.append(style);
   }
   const theme=document.body.classList.contains('light')?'light':'dark';
   if(doc.documentElement.dataset.museumAtlas!==theme)doc.documentElement.dataset.museumAtlas=theme;
   const tab=doc.documentElement.dataset.hm||'';
   const info=doc.querySelector('[style*="--hm-info"]')?.textContent||'';
   if(tab!==state.tab||(tab==='info'&&info!==state.info)){
    doc.querySelectorAll('[style*="--hm-side"],[style*="--hm-tools"],[style*="--hm-info"]').forEach(panel=>{panel.scrollTop=0;});
   }
   state.tab=tab;state.info=info;
   doc.querySelectorAll('canvas').forEach(canvas=>{
    canvas.dataset.atlasInk='';
    const scene=canvas.parentElement;if(!scene)return;
    scene.dataset.atlasScene='';
    const labels=canvas.nextElementSibling;
    if(labels?.style.pointerEvents==='none')labels.dataset.atlasInk='';
    Array.from(scene.children).forEach(el=>{
     if(el.style.pointerEvents==='none'&&(el.style.background.includes('repeating-linear-gradient')||el.style.boxShadow.includes('inset')))el.dataset.atlasOverlay='';
    });
   });
  }catch{/* Cross-origin models retain their native styling. */}
 }
 function schedule(frame,state){if(state.queued)return;state.queued=true;requestAnimationFrame(()=>{state.queued=false;if(frame.isConnected)apply(frame,state);else state.observer?.disconnect();});}
 function sync(){document.querySelectorAll('.stage iframe').forEach(frame=>{
  let state=frames.get(frame);
  if(!state){state={};frames.set(frame,state);frame.addEventListener('load',()=>apply(frame,state));}
  apply(frame,state);
 });}
 function start(){sync();const desk=document.getElementById('desk');if(desk)new MutationObserver(sync).observe(desk,{childList:true,subtree:true});new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});addEventListener('encyclopedia:theme',sync);}
 if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
