// Headless-рендер произвольного GLB через системный Chrome (для осмотра сканов).
//   node render-glb.mjs <model.glb> <out.png> [view=iso|side|front|top] [size=900]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(__dir, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [glbPath, outPng, viewArg, sizeArg] = process.argv.slice(2);
const view = viewArg || 'iso';
const size = parseInt(sizeArg || '900', 10);
// glbPath может быть списком через запятую — соберём все в одну сцену
const glbFiles = glbPath.split(',').map(p => fs.readFileSync(path.resolve(p.trim())));

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#20242b;overflow:hidden}</style>
<script type="importmap">{"imports":{"three":"/tm/three.module.js","three/addons/":"/jsm/"}}</script></head>
<body><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const VIEW=${JSON.stringify(view)}, SIZE=${size};
const scene=new THREE.Scene(); scene.background=new THREE.Color('#20242b');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(SIZE,SIZE); document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0x33383f,0.9));
const key=new THREE.DirectionalLight(0xffffff,1.1); key.position.set(4,6,5); scene.add(key);
const fill=new THREE.DirectionalLight(0xa8c4ff,0.4); fill.position.set(-5,2,-3); scene.add(fill);
const N=${glbFiles.length};
const loader=new GLTFLoader(); let loaded=0; const root=new THREE.Group(); scene.add(root);
for(let i=0;i<N;i++){ loader.load('/model'+i+'.glb',(g)=>{ root.add(g.scene); if(++loaded===N) frame(); },undefined,(e)=>{window.__err=String(e);window.__ready=true;}); }
function frame(){
  const box=new THREE.Box3().setFromObject(root), c=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3());
  const R=Math.max(sz.x,sz.y,sz.z);
  const cam=new THREE.PerspectiveCamera(35,1,0.001,10000);
  const dirs={side:[0,0.15,1],front:[-1,0.15,0.001],top:[0.001,1,0.001],iso:[0.9,0.55,1]};
  const v=dirs[VIEW]||dirs.iso, vn=new THREE.Vector3(v[0],v[1],v[2]).normalize();
  cam.position.copy(c).add(vn.multiplyScalar(R*2.1)); cam.lookAt(c);
  renderer.render(scene,cam);
  window.__dims={x:+sz.x.toFixed(2),y:+sz.y.toFixed(2),z:+sz.z.toFixed(2)};
  window.__ready=true;
}
</script></body></html>`;

const BUILD=path.join(ENGINE,'node_modules/three/build'), JSM=path.join(ENGINE,'node_modules/three/examples/jsm');
const server=http.createServer((req,res)=>{
  const u=req.url.split('?')[0];
  if(u.startsWith('/tm/')){const f=path.join(BUILD,u.slice(4));if(fs.existsSync(f)){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(f));return;}}
  if(u.startsWith('/jsm/')){const f=path.join(JSM,u.slice(5));if(fs.existsSync(f)){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(f));return;}}
  const mm=u.match(/^\/model(\d+)\.glb$/);
  if(mm){res.setHeader('Content-Type','model/gltf-binary');res.end(glbFiles[+mm[1]]);return;}
  if(u==='/'){res.setHeader('Content-Type','text/html');res.end(HARNESS);return;}
  res.statusCode=404;res.end('nf');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
const browser=await puppeteer.launch({executablePath:CHROME,headless:'new',
  args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{
  const page=await browser.newPage(); await page.setViewport({width:size,height:size});
  const errs=[]; page.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'load'});
  await page.waitForFunction('window.__ready===true',{timeout:60000}).catch(()=>{});
  const dims=await page.evaluate(()=>window.__dims||null); const err=await page.evaluate(()=>window.__err||null);
  await page.screenshot({path:outPng});
  console.log('shot',outPng,'dims='+JSON.stringify(dims),err?('ERR:'+err):'', errs.length?('errs:'+errs.slice(0,2).join(' | ')):'');
}finally{await browser.close();server.close();}
