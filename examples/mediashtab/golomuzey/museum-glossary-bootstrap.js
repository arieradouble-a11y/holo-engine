// Bundled viewers replace documentElement during startup. Observe the document
// and wait for the actual viewer before importing its glossary module.
(()=>{
 if(!/^https?:$/.test(location.protocol))return;
 function attach(){
  if(!document.head||!document.querySelector('[style*="--hm-info"]'))return false;
  for(const [id,href] of [
   ['museum-glossary-css','/metavselennaya/glossary.css?v=20260916-2'],
   ['museum-glossary-local-css','/golomuzey/museum-glossary.css?v=20260916-1'],
  ])if(!document.getElementById(id)){
   const link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href=href;document.head.append(link);
  }
  if(!document.getElementById('museum-glossary-runtime')){
   const script=document.createElement('script');script.id='museum-glossary-runtime';script.type='module';script.src='/golomuzey/museum-glossary-frame.js?v=20260916-1';document.head.append(script);
  }
  return true;
 }
 if(attach())return;
 const observer=new MutationObserver(()=>{if(attach())observer.disconnect();});
 observer.observe(document,{childList:true,subtree:true});
})();
