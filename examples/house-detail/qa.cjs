const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=__dirname;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const {default:puppeteer}=await import('../../engine/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js');
const hardware=process.argv.includes('--gpu');
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--allow-file-access-from-files','--enable-webgl','--ignore-gpu-blocklist',...(hardware?['--enable-gpu','--use-angle=d3d11']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])]});
const results=[];
try{
for(const [name,file,w,h,dpr] of hardware?[['baseline','baseline.html',1366,800,1],['pilot','pilot.html',1366,800,1],['mobile','pilot.html',390,844,3]]:[['baseline','baseline.html',1366,800,1],['pilot','pilot.html',1366,800,1],['mobile','index.html',390,844,1]]){
const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,250));});
await p.setViewport({width:w,height:h,deviceScaleFactor:dpr,isMobile:w<500,hasTouch:w<500});
await p.goto(pathToFileURL(path.join(root,file)).href,{waitUntil:'load',timeout:90000});
const frame=file==='index.html'?await (await p.$('iframe')).contentFrame():p;
await frame.waitForFunction('window.__holo && window.__holo.progress>.99',{timeout:90000});await sleep(1500);
const settle=async()=>{await sleep(300);await frame.evaluate(()=>{const h=window.__holo;h.az=h.azTarget;h.el=h.elTarget;h.dist=h.distTarget;h.explode=h.explodeTarget;h.tgt={...h.tgtGoal};if(h.fovTarget)h.camera.fov=h.fovTarget;h.camera.updateProjectionMatrix();});await frame.evaluate(async()=>{const h=window.__holo,n=h.frame;await new Promise(resolve=>{const tick=()=>h.frame>n?resolve():requestAnimationFrame(tick);requestAnimationFrame(tick);});});};
await settle();
const inspect=()=>frame.evaluate(()=>{const h=window.__holo,r=h.renderer,g=r.getContext(),dbg=g.getExtension('WEBGL_debug_renderer_info');return{gpu:dbg?g.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'unknown',canvas:[r.domElement.width,r.domElement.height],profile:h.pilotProfile,detailMeshes:h.pilotDetails?.length||0,fine:h.pilotFine,visibleDetail:h.pilotDetails?.filter(d=>d.obj.visible).length||0,shellMeshes:h.shellMeshes.length,geometryCount:r.info.memory.geometries,revision:h.THREE.REVISION};});
const measure=()=>frame.evaluate(async()=>{const h=window.__holo,r=h.renderer;const save=h.stopped;h.stopped=true;await new Promise(r=>setTimeout(r,100));r.info.autoReset=false;r.info.reset();h.updatePilotDetail?.();h.renderFrame();h.renderOutline();const counts={...r.info.render};r.info.autoReset=true;h.stopped=save;h.animate();const start=h.frame,t=performance.now();await new Promise(r=>setTimeout(r,3000));return{...counts,actualRenderedFPS:+((h.frame-start)*1000/(performance.now()-t)).toFixed(1)};});
const row={name,...await inspect(),errors};
if(hardware){row.initial=await measure();if(name!=='baseline'){await frame.evaluate(()=>window.__holo.setPilotQuality('economy'));await sleep(800);row.economy={...await inspect(),...await measure()};await frame.evaluate(()=>window.__holo.setPilotQuality('high'));await sleep(800);row.high={...await inspect(),...await measure()};}}
else {
await p.screenshot({path:path.join(root,'qa',name+'-overview.png')});
if(name==='pilot'){
await frame.evaluate(()=>{const h=window.__holo;h.setPilotQuality('normal');h.showPilotClose();});await settle();
await p.screenshot({path:path.join(root,'qa/after-close.png')});row.close=await inspect();
await frame.evaluate(()=>window.__holo.pilotEnabled=false);await sleep(400);await p.screenshot({path:path.join(root,'qa/before-close.png')});
await frame.evaluate(()=>{const h=window.__holo;h.pilotEnabled=true;h.togglePlan();});await settle();await p.screenshot({path:path.join(root,'qa/plan.png')});row.plan=await frame.evaluate(()=>({plan:window.__holo.state.plan,details:window.__holo.pilotDetails.filter(d=>d.obj.visible).length}));
await frame.evaluate(()=>window.__holo.toggleCut());await settle();await p.screenshot({path:path.join(root,'qa/cut.png')});row.cut=await frame.evaluate(()=>({cut:window.__holo.state.cut,details:window.__holo.pilotDetails.filter(d=>d.obj.visible).length}));
await frame.evaluate(()=>window.__holo.toggleExplode());await settle();await p.screenshot({path:path.join(root,'qa/explode.png')});
row.transitions=await frame.evaluate(()=>{const h=window.__holo;return{exploded:h.state.exploded,detailVisible:h.pilotDetails.filter(d=>d.obj.visible).length,indices:h.lines.geometry.drawRange.count,fullVertices:h.lines.geometry.attributes.position.count};});
}
if(name==='mobile'){
await p.click('#before');await sleep(300);row.before=await frame.evaluate(()=>window.__holo.pilotEnabled);
await p.click('#after');await p.select('#quality','economy');await sleep(300);row.after=await inspect();
await p.click('#close');await settle();await p.screenshot({path:path.join(root,'qa/mobile-close.png')});
await p.click('#reset');await settle();row.reset=await frame.evaluate(()=>({close:window.__holo.pilotClose,flow:window.__holo.state.flow}));
}
}
results.push(row);console.log(JSON.stringify(row));await p.close();
}
}finally{await browser.close();fs.writeFileSync(path.join(root,'qa',hardware?'gpu.json':'visual.json'),JSON.stringify(results,null,2));}
if(results.some(r=>r.errors.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
