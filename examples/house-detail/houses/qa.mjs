import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import puppeteer from '../../../engine/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const root=path.dirname(fileURLToPath(import.meta.url)),catalog=JSON.parse(fs.readFileSync(path.join(root,'catalog.json')));
const gpu=process.argv.includes('--gpu'),mobileOnly=process.argv.includes('--mobile-only'),only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--allow-file-access-from-files','--enable-webgl','--ignore-gpu-blocklist',...(gpu?['--enable-gpu','--use-angle=d3d11']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])]});
const rows=[],pause=ms=>new Promise(r=>setTimeout(r,ms));
try{
for(const item of catalog.filter(x=>!only||only.includes(x.id))){
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,250));});
  const start=Date.now();await p.setViewport({width:1366,height:800,deviceScaleFactor:1});
  await p.goto(pathToFileURL(path.join(root,item.id+'.html')).href);
  await p.waitForFunction('window.__holo?.progress>.99',{timeout:90000});
  const settle=async()=>{await pause(80);for(let i=0;i<3;i++){await p.evaluate(()=>{const h=window.__holo;h.az=h.azTarget;h.el=h.elTarget;h.dist=h.distTarget;h.explode=h.explodeTarget;h.tgt={...h.tgtGoal};if(h.fovTarget)h.camera.fov=h.fovTarget;h.camera.updateProjectionMatrix();});await p.evaluate(async()=>{const h=window.__holo,n=h.frame;await new Promise(r=>{const tick=()=>h.frame>n?r():requestAnimationFrame(tick);requestAnimationFrame(tick);});});}};
  const stats=()=>p.evaluate(()=>{const h=window.__holo,r=h.renderer,g=r.getContext(),dbg=g.getExtension('WEBGL_debug_renderer_info');return{gpu:dbg?g.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'unknown',canvas:[r.domElement.width,r.domElement.height],profile:h.pilotProfile,geometries:r.info.memory.geometries,detailObjects:h.pilotDetails.length,detailVisible:h.pilotDetails.filter(d=>d.obj.visible).length,fine:h.pilotFine,detailsPartIds:[...new Set(h.pilotLineTiers.flatMap(o=>Array.from(o.geometry.attributes.aPart.array)))],validDetails:h.pilotLineTiers.every(o=>Array.from(o.geometry.attributes.position.array).every(Number.isFinite)&&Array.from(o.geometry.attributes.aPart.array).every(x=>Number.isInteger(x)&&x>=0&&x<h.PARTDEF.length)),view:{exploded:h.state.exploded,plan:h.state.plan,cut:h.state.cut,distance:h.distTarget}};});
  const count=()=>p.evaluate(()=>{const h=window.__holo,r=h.renderer;h.updatePilotDetail();r.info.autoReset=false;r.info.reset();h.renderFrame();h.renderOutline();const result={calls:r.info.render.calls,triangles:r.info.render.triangles,lines:r.info.render.lines};r.info.autoReset=true;return result;});
  await settle();const row={id:item.id,loadMs:Date.now()-start,overview:await stats(),errors};
  if(mobileOnly){
    await p.setViewport({width:390,height:780,deviceScaleFactor:2,isMobile:true,hasTouch:true});
    await p.waitForFunction('window.__holo?.progress>.99',{timeout:90000});await settle();row.mobile=await stats();
    await p.screenshot({path:path.join(root,'qa',item.id+'-mobile.png')});
  }else if(gpu){
    await p.evaluate(()=>window.__holo.setPilotQuality('normal'));await settle();row.normal=await count();
    await p.evaluate(()=>{const h=window.__holo;h.pilotEnabled=false;h.pilotEconomy=false;h.pilotPixelRatio=2;h.pilotBloomScale=1;h.onResize();});await settle();row.originalEffectsWithoutDetails=await count();
    await p.evaluate(()=>{const h=window.__holo;h.pilotEnabled=true;h.setPilotQuality('economy');});await settle();row.economy=await count();
  }else{
    await p.screenshot({path:path.join(root,'qa',item.id+'-overview.png')});
    await p.evaluate(()=>window.__holo.showPilotClose());await settle();row.close=await stats();await p.screenshot({path:path.join(root,'qa',item.id+'-close.png')});
    await p.evaluate(()=>window.__holo.pilotEnabled=false);await settle();await p.screenshot({path:path.join(root,'qa',item.id+'-before.png')});
    await p.evaluate(()=>{const h=window.__holo;h.pilotEnabled=true;h.toggleExplode();});await settle();row.exploded=await stats();await p.screenshot({path:path.join(root,'qa',item.id+'-explode.png')});
    // New detail line shifts must exactly equal the shell system's shift.
    row.explodeConsistent=await p.evaluate(()=>{const h=window.__holo;return h.pilotLineTiers.every(o=>{const g=o.geometry,p=g.attributes.aPart.array,d=g.attributes.aExplode.array;return Array.from(p).every((part,i)=>h.partDirs[part].every((x,a)=>Math.abs(x-d[i*3+a])<1e-5));});});
    if(await p.evaluate(()=>!!window.__holo.planMode)){
      await p.evaluate(()=>window.__holo.togglePlan());await settle();row.plan=await stats();await p.screenshot({path:path.join(root,'qa',item.id+'-plan.png')});
    }
    await p.evaluate(()=>window.__holo.toggleCut());await settle();row.cut=await stats();
    await p.evaluate(()=>{const h=window.__holo;h.toggleCut();h.pilotClose=false;h.resetView();h._studyViewFrameKey=null;h.setPilotQuality('economy');});
    await p.setViewport({width:390,height:780,deviceScaleFactor:2,isMobile:true,hasTouch:true});await p.waitForFunction('window.__holo?.progress>.99',{timeout:90000});await settle();row.mobile=await stats();await p.screenshot({path:path.join(root,'qa',item.id+'-mobile.png')});
  }
  row.pass=errors.length===0&&row.overview.validDetails&&row.overview.detailVisible>0&&(!row.mobile||(row.mobile.validDetails&&row.mobile.profile==='economy'))&&(!row.plan||row.plan.detailVisible===0)&&(!row.cut||row.cut.detailVisible===0)&&(gpu||mobileOnly||row.explodeConsistent);
  rows.push(row);console.log(item.id+' '+JSON.stringify({pass:row.pass,loadMs:row.loadMs,objects:row.overview.detailObjects,close:row.close?.fine,parts:row.overview.detailsPartIds,normal:row.normal,economy:row.economy,errors}));await p.close();
}
}finally{await browser.close();const file=path.join(root,'qa',mobileOnly?'mobile.json':gpu?'gpu.json':'visual.json');const old=only&&fs.existsSync(file)?JSON.parse(fs.readFileSync(file)).filter(r=>!rows.some(x=>x.id===r.id)):[];fs.writeFileSync(file,JSON.stringify([...old,...rows].sort((a,b)=>catalog.findIndex(x=>x.id===a.id)-catalog.findIndex(x=>x.id===b.id)),null,2));}
if(rows.some(r=>!r.pass))process.exitCode=1;
