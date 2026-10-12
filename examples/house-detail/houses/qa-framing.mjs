import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import puppeteer from '../../../engine/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--allow-file-access-from-files','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ids=process.argv.length>2?process.argv.slice(2):JSON.parse(fs.readFileSync(path.join(root,'catalog.json'))).map(x=>x.id),rows=[];
try{for(const id of ids){const p=await browser.newPage();await p.setViewport({width:1366,height:800});await p.goto(pathToFileURL(path.join(root,id+'.html')).href);await p.waitForFunction('window.__holo?.progress>.99');
await p.evaluate(()=>{const h=window.__holo;h.showPilotClose();h.toggleExplode();});
await p.waitForFunction('Math.abs(window.__holo.dist-window.__holo.distTarget)<.005 && Math.abs(window.__holo.tgt.y-window.__holo.tgtGoal.y)<.005 && window.__holo.explode>.999',{timeout:30000});
const data=await p.evaluate(()=>{const h=window.__holo,T=h.THREE;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;const v=new T.Vector3();
for(const obj of [h.lines,...h.pilotLineTiers]){const g=obj.geometry,ps=g.attributes.position.array,ds=g.attributes.aExplode.array;
for(let i=0;i<ps.length;i+=3){v.set(ps[i]+ds[i],ps[i+1]+ds[i+1],ps[i+2]+ds[i+2]).applyMatrix4(obj.matrixWorld).project(h.camera);const x=(v.x+1)*683,y=(1-v.y)*400;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
return {distance:h.distTarget,actualBounds:{minX,minY,maxX,maxY},pass:minX>=0&&minY>=0&&maxX<=1366&&maxY<=800};});
rows.push({id,...data});await p.screenshot({path:path.join(root,'qa',id+'-explode.png')});console.log(JSON.stringify(rows.at(-1)));await p.close();}}finally{await browser.close();fs.writeFileSync(path.join(root,'qa/framing.json'),JSON.stringify(rows,null,2));}
if(rows.some(x=>!x.pass))process.exitCode=1;
