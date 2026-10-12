const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
const {default:puppeteer}=await import('../../engine/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js');
const b=await puppeteer.launch({executablePath:process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
const p=await b.newPage();await p.setViewport({width:800,height:600});
await p.goto(pathToFileURL(path.join(__dirname,'pilot.html')).href);await p.waitForFunction('window.__holo?.progress>.99',{timeout:90000});
const result=await p.evaluate(async()=>{
const h=window.__holo;h.stopped=true;await new Promise(r=>setTimeout(r,150));h.setPilotQuality('economy');
const r=h.renderer,gl=r.getContext(),rows=[];
const settle=()=>{h.az=h.azTarget;h.el=h.elTarget;h.dist=h.distTarget;h.explode=h.explodeTarget;h.tgt={...h.tgtGoal};h.camera.fov=h.fovTarget||42;h.camera.updateProjectionMatrix();h.uniforms.uTime.value=10;h.uniforms.uExplode.value=h.explode;h.uniforms.uSelected.value=h.selectedPart;h.pivot.rotation.y=h.az;h.updateShellExplode(h.explode);h.camera.position.set(h.tgt.x,h.tgt.y+Math.sin(h.el)*h.dist,h.tgt.z+Math.cos(h.el)*h.dist);h.camera.lookAt(h.tgt.x,h.tgt.y,h.tgt.z);h.updatePilotDetail();};
const pixels=()=>{h.renderFrame();h.renderOutline();const arr=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,arr);return arr;};
for(const mode of ['overview','plan','cut','exploded','interior']){
if(mode==='plan')h.togglePlan();if(mode==='cut')h.toggleCut();if(mode==='exploded')h.toggleExplode();if(mode==='interior'){h.toggleExplode();h.selectPart(7);}
settle();const geos=[...new Set([h.lines.geometry,h.boldLines.geometry,h.innerLines.geometry])];
const saved=geos.map(g=>({g,index:g.index,count:g.drawRange.count}));const optimized=pixels();
saved.forEach(({g})=>{g.setIndex(null);g.setDrawRange(0,Infinity);});const original=pixels();
saved.forEach(({g,index,count})=>{g.setIndex(index);g.setDrawRange(0,count);});
let changed=0,max=0,nonblack=0;
for(let i=0;i<original.length;i++){const d=Math.abs(original[i]-optimized[i]);if(d)changed++;max=Math.max(max,d);if(i%4!==3&&original[i]>8)nonblack++;}
rows.push({mode,changedBytes:changed,maxChannelDifference:max,nonblackChannels:nonblack,pass:changed===0&&nonblack>100,submittedVertices:saved.reduce((s,x)=>s+x.count,0),fullVertices:geos.reduce((s,g)=>s+g.attributes.position.count,0)});
}
h.pilotEnabled=true;h.dist=2;h.updatePilotDetail();pixels();
const countBefore=r.info.memory.geometries;
for(let i=0;i<20;i++){h.pilotEnabled=!h.pilotEnabled;h.dist=i%2?3:20;h.updatePilotDetail();pixels();}
const countAfter=r.info.memory.geometries;
return {pixelEquivalence:rows,resourceStability:{before:countBefore,after:countAfter,pass:countAfter===countBefore},pass:rows.every(x=>x.pass)&&countAfter===countBefore};
});
fs.writeFileSync(path.join(__dirname,'qa/invariants.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;
}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
