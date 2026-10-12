const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
const {default:puppeteer}=await import('../../engine/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js');
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
for(const [name,file,w,h,close] of [
['reference',path.join(__dirname,'../mediashtab/golomuzey/Панельная 9-этажка (121 серия) (голограмма).html'),1366,800,false],
['before','qa/explode-before.html',1366,800,false],
['after','pilot.html',1366,800,false],
['from-close','pilot.html',1366,800,true],
['mobile','pilot.html',390,712,false]]){
const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
await p.setViewport({width:w,height:h,deviceScaleFactor:1,isMobile:w<500,hasTouch:w<500});
await p.goto(pathToFileURL(path.isAbsolute(file)?file:path.join(__dirname,file)).href);
await p.waitForFunction('window.__holo?.progress>.99',{timeout:90000});
await p.evaluate(close=>{const h=window.__holo;if(close)h.showPilotClose();h.toggleExplode();},close);
await new Promise(r=>setTimeout(r,400));
await p.evaluate(()=>{const h=window.__holo;h.az=h.azTarget;h.el=h.elTarget;h.dist=h.distTarget;h.explode=h.explodeTarget;h.tgt={...h.tgtGoal};h.camera.fov=h.fovTarget||42;h.camera.updateProjectionMatrix();});
await p.waitForFunction('Math.abs(window.__holo.dist-window.__holo.distTarget)<.001 && Math.abs(window.__holo.explode-1)<.001');
await p.screenshot({path:path.join(__dirname,'qa/explode-'+name+'.png')});
const state=await p.evaluate(()=>{const h=window.__holo;return{distance:h.distTarget,fov:h.camera.fov,az:h.azTarget,el:h.elTarget,center:h.tgtGoal,dirs:h.partDirs,exploded:h.state.exploded};});
await p.evaluate(()=>window.__holo.toggleExplode());await new Promise(r=>setTimeout(r,300));
state.assembled=await p.evaluate(()=>({exploded:window.__holo.state.exploded,dist:window.__holo.distTarget,close:window.__holo.pilotClose}));
results.push({name,...state,errors});console.log(JSON.stringify(results.at(-1)));await p.close();
}
}finally{await browser.close();fs.writeFileSync(path.join(__dirname,'qa/explode-comparison.json'),JSON.stringify(results,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
