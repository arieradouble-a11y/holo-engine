/* Shared preference; no network requests or query logging. Runs before paint. */
(()=>{
 const key='encyclopedia-theme';let current='light';
 // Одна тема с сайтом (03.10.2026): сайт хранит выбор в 'theme' (chronicle / chronicle-dark,
 // а также тёплые варианты). Он главный; свой ключ энциклопедии — только если сайт ещё не выбирал.
 const SITE='theme';
 const fromSite=()=>{try{const v=localStorage.getItem(SITE);return v?(/dark|ops|nebula/.test(v)?'dark':'light'):null;}catch{return null;}};
 const modelAssets=new Map(['house-autumn.webp','house-spring.webp','house-summer.webp','house-winter.webp','series-meter-v1.webp','series-entrance-v1.webp','series-plant-v2.webp','series-roof-v1.webp','series-apartment-v1.webp','heating-room-v1.webp','leak-bathroom-realistic-v2.png','roles-dispatch-v1.webp','lift-lobby-v1.webp','ventilation-kitchen-v1.webp','water-bathroom-v1.webp','electricity-hallway-v1.webp','sewer-kitchen-v1.webp','gas-kitchen-v1.webp'].map(name=>[name,name.replace(/\.png$/,'.webp')]));
 const originalImages=new WeakMap();
 const tourImages=new WeakMap();
 const tourAssets=new Map(['polet','tec','voda','pns','kns','kos','mkd','energo','gaz','ctp','tko','veliz','ads','lift','tech'].map(id=>[`/${id}-preview/poster/${id==='polet'?'f1_oblast':'hero'}.jpg`,id]));
 const imageSurfaces='.m-stage,.chapter-visual,.card.story .card-art,.home-hero .hero-art,.hero,.m-hero,.e-hero,.l-hero,.cold-hero,.o-hero,.r-hero,.k-hero,.g-hero';
 function modelImages(){
  document.querySelectorAll('.card.tour .card-art img').forEach(img=>{
   const value=img.getAttribute('src');if(!value)return;
   if(!value.includes('/metavselennaya/light-tours/'))tourImages.set(img,value);
   const original=tourImages.get(img);if(!original)return;
   let id;try{id=tourAssets.get(new URL(original,document.baseURI).pathname);}catch{return;}
   if(!id)return;
   const next=current==='light'?`/metavselennaya/light-tours/${id}.webp`:original;
   if(value!==next)img.setAttribute('src',next);
  });
  document.querySelectorAll('.museum-visual>img,.museum-row>img').forEach(img=>{
   const frame=document.createElement('span');frame.className='museum-atlas-frame';frame.setAttribute('aria-hidden','true');
   img.replaceWith(frame);frame.append(img);
  });
  document.querySelectorAll(`:is(${imageSurfaces}) :is(img,image)`).forEach(el=>{
   const attribute=el.tagName.toLowerCase()==='image'?'href':'src',value=el.getAttribute(attribute);
   if(!value)return;
   if(!value.includes('/metavselennaya/light-models/'))originalImages.set(el,value);
   const original=originalImages.get(el);if(!original)return;
   const name=original.split('/').pop().split('?')[0];if(!modelAssets.has(name))return;
   const next=current==='light'?'/metavselennaya/light-models/'+modelAssets.get(name):original;
   if(value!==next)el.setAttribute(attribute,next);
  });
 }
 try{const site=fromSite(),saved=localStorage.getItem(key);current=site||(saved==='light'||saved==='dark'?saved:'light');}catch{}
 function apply(value,save=false){
  current=value==='light'?'light':'dark';document.documentElement.dataset.encyclopediaTheme=current;
  if(save)try{localStorage.setItem(key,current);const was=localStorage.getItem(SITE)||'chronicle',warm=/warm/.test(was);localStorage.setItem(SITE,current==='dark'?(warm?'chronicle-warm-dark':'chronicle-dark'):(warm?'chronicle-warm':'chronicle'));}catch{}
  document.querySelectorAll('[data-encyclopedia-theme-select]').forEach(el=>{el.value=current;});
  modelImages();
  window.dispatchEvent(new CustomEvent('encyclopedia:theme',{detail:{theme:current}}));
 }
 window.encyclopediaTheme={set:value=>apply(value,true),get:()=>current};apply(current);
 addEventListener('storage',e=>{if(e.key===key)apply(e.newValue);else if(e.key===SITE){const v=fromSite();if(v)apply(v);}});
 // Знак «Штаб ЖКХ» — путь на главную сайта с любой страницы энциклопедии, истории, тура и музея.
 // С 09.10.2026 знак — логотип заказчика (тот же /icon.svg, что у сайта) и подпись «Штаб ЖКХ / Тюменская область».
 const BRAND_HTML='<span class="shtab-brand-mark"><img src="/icon.svg" alt="" width="32" height="31"></span><span class="shtab-brand-text"><b>Штаб <i>ЖКХ</i></b><small>Тюменская область</small></span>';
 function brand(){const a=document.createElement('a');a.className='shtab-brand';a.href='/';a.setAttribute('aria-label','Штаб ЖКХ — на главную сайта');
  a.innerHTML=BRAND_HTML;return a;}
 // Знак, вписанный в разметку страницы прежним пульсом (хаб), приводим к новому.
 function upgradeBrands(){document.querySelectorAll('a.shtab-brand').forEach(a=>{if(!a.querySelector('.shtab-brand-text'))a.innerHTML=BRAND_HTML;});}
 function mount(){
  upgradeBrands();
  if(document.querySelector('[data-encyclopedia-theme-control]'))return;
  const control=document.createElement('label');control.className='encyclopedia-theme-control';control.dataset.encyclopediaThemeControl='';
  control.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><select aria-label="Цветовая тема" data-encyclopedia-theme-select><option value="light">Светлая</option><option value="dark">Тёмная</option></select>';
  control.querySelector('select').value=current;control.querySelector('select').addEventListener('change',e=>apply(e.target.value,true));
  const portal=document.querySelector('.header-inner'),story=document.querySelector('.site-header,.m-header');
  const hasBrand=!!document.querySelector('.shtab-brand');
  if(portal){control.classList.add('theme-in-portal');portal.insertBefore(control,portal.querySelector('nav'));}
  else if(story){control.classList.add('theme-in-story');story.insertBefore(control,story.lastElementChild);if(!hasBrand){const b=brand();b.classList.add('shtab-brand-story');story.insertBefore(b,control);}}
  else if(document.querySelector('#menubar .right')){document.querySelector('#theme')?.setAttribute('hidden','');document.querySelector('#menubar .right').prepend(control);if(!hasBrand){const b=brand();b.classList.add('shtab-brand-menubar');document.querySelector('#menubar .right').prepend(b);}}
  else{const box=document.createElement('div');box.className='theme-floating shtab-floating';if(!hasBrand)box.append(brand());box.append(control);document.body.append(box);}
  apply(current);
  const root=document.getElementById('root')||document.getElementById('content');
  if(root){let queued=false;new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;modelImages();});}}).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href']});}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{
  // React mounts after the HTML document is parsed; observe only until its header exists.
  if(document.querySelector('#root')&&!document.querySelector('.site-header,.m-header')){
   const observer=new MutationObserver(()=>{if(document.querySelector('.site-header,.m-header')){observer.disconnect();mount();}});observer.observe(document.getElementById('root'),{childList:true,subtree:true});
  }else mount();
 });else mount();
})();
