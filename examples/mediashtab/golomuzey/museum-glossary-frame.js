import {annotateText} from '/metavselennaya/glossary.js?v=20260916-2';
// The native hologram renderer replaces text on selection. Observe only its
// explanatory DOM, never geometry, canvas labels or interactive controls.
let queued=false;
function sync(){
 queued=false;
 document.querySelectorAll('[style*="--hm-info"],[style*="--hm-sub"]').forEach(root=>annotateText(root,8));
 document.querySelectorAll('[style*="--hm-scroll"] span,[style*="--hm-scroll"] div').forEach(root=>{if(!root.children.length&&!root.closest('button,a'))annotateText(root,4);});
}
new MutationObserver(records=>{
 if(records.every(r=>r.target.closest?.('.gkh-term-card')))return;
 if(queued)return;queued=true;requestAnimationFrame(sync);
}).observe(document,{childList:true,subtree:true,characterData:true});
sync();
