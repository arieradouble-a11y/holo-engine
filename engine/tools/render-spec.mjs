// Headless-рендер ObjectSculptSpec (img2threejs) в PNG через системный Chrome.
// Обходит скрытый превью-пейн: реальный WebGL в headless-браузере, скриншот на диск.
//   node render-spec.mjs <spec.json> <out.png> [view=side|iso|front|rear|top] [size=900]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(__dir, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const [specPath, outPng, viewArg, sizeArg] = process.argv.slice(2);
if (!specPath || !outPng) { console.error('usage: render-spec.mjs <spec.json> <out.png> [view] [size]'); process.exit(1); }
const view = viewArg || 'iso';
const size = parseInt(sizeArg || '900', 10);
const specText = fs.readFileSync(specPath, 'utf8');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#20242b;overflow:hidden}canvas{display:block}
</style>
<script type="importmap">{"imports":{"three":"/tm/three.module.js"}}</script></head>
<body><script type="module">
import * as THREE from 'three';
const SPEC = ${specText};
const VIEW = ${JSON.stringify(view)};
const SIZE = ${size};

const scene = new THREE.Scene();
scene.background = new THREE.Color('#20242b');
const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
renderer.setSize(SIZE, SIZE); renderer.setPixelRatio(1);
document.body.appendChild(renderer.domElement);

const mats = {};
(SPEC.materials||[]).forEach(m=>mats[m.id]=new THREE.MeshStandardMaterial({
  color:new THREE.Color(m.baseColor||m.color||'#9aa3ab'), metalness:0.25, roughness:0.65}));
const matFor = id => mats[id] || new THREE.MeshStandardMaterial({color:0x9aa3ab, metalness:0.25, roughness:0.65});

function geoFor(c){
  const d=c.dimensions||{}, w=d.width??1, h=d.height??1, dp=d.depth??1;
  switch(c.primitive){
    case 'cylinder': return new THREE.CylinderGeometry(w, w, h, 48);
    case 'cone':     return new THREE.ConeGeometry(w, h, 48);
    case 'sphere':   return new THREE.SphereGeometry(w, 48, 32);
    case 'capsule':  return new THREE.CapsuleGeometry(w, h, 16, 32);
    case 'torus':    return new THREE.TorusGeometry(w, dp||w*0.15, 20, 48);
    case 'ellipsoid':{const g=new THREE.SphereGeometry(1,48,32); g.scale(w,h,dp); return g;}
    default:         return new THREE.BoxGeometry(w, h, dp);
  }
}
const root = new THREE.Group();
(SPEC.componentTree||[]).filter(c=>c.id!=='root').forEach(c=>{
  const mesh=new THREE.Mesh(geoFor(c), matFor(c.material));
  const t=c.transform||{}, p=t.position||[0,0,0], r=t.rotation||[0,0,0], s=t.scale||[1,1,1];
  mesh.position.set(p[0],p[1],p[2]); mesh.rotation.set(r[0],r[1],r[2]);
  if(c.primitive==='cylinder'||c.primitive==='cone'||c.primitive==='capsule'){
    if(c.cylAxis==='x') mesh.rotateZ(Math.PI/2); else if(c.cylAxis==='z') mesh.rotateX(Math.PI/2);
  }
  if(c.primitive==='torus' && c.cylAxis==='x') mesh.rotateY(Math.PI/2);
  mesh.scale.set(s[0],s[1],s[2]);
  root.add(mesh);
});
scene.add(root);

// свет
scene.add(new THREE.HemisphereLight(0xffffff, 0x33383f, 0.75));
const key=new THREE.DirectionalLight(0xffffff,1.0); key.position.set(4,6,5); scene.add(key);
const fill=new THREE.DirectionalLight(0xa8c4ff,0.35); fill.position.set(-5,2,-3); scene.add(fill);

// камера по bbox
const box=new THREE.Box3().setFromObject(root); const c=box.getCenter(new THREE.Vector3());
const sz=box.getSize(new THREE.Vector3()); const R=Math.max(sz.x,sz.y,sz.z);
const cam=new THREE.PerspectiveCamera(35,1,0.01,1000);
const dist=R*2.1;
const dirs={
  side:[0,0.15,1], rear:[1,0.15,0.001], front:[-1,0.15,0.001],
  top:[0.001,1,0.001], iso:[0.9,0.55,1]
};
const v=dirs[VIEW]||dirs.iso; const vn=new THREE.Vector3(v[0],v[1],v[2]).normalize();
cam.position.copy(c).add(vn.multiplyScalar(dist)); cam.lookAt(c);
renderer.render(scene,cam);
window.__ready=true;
</script></body></html>`;

// --- статический сервер: three + harness ---
const BUILD = path.join(ENGINE, 'node_modules/three/build');
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url.startsWith('/tm/')) {
    const f = path.join(BUILD, url.slice(4).replace(/[^a-zA-Z0-9._-]/g, ''));
    if (fs.existsSync(f)) { res.setHeader('Content-Type','text/javascript'); res.end(fs.readFileSync(f)); return; }
  }
  if (url === '/' || url.startsWith('/index')) { res.setHeader('Content-Type','text/html'); res.end(HARNESS); return; }
  if (url !== '/favicon.ico') console.error('  404:', url);
  res.statusCode = 404; res.end('nf');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  const errs=[]; page.on('pageerror',e=>errs.push(String(e))); page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__ready===true', { timeout: 20000 }).catch(()=>{});
  const canvas = await page.$('canvas');
  if (!canvas) throw new Error('no canvas; errs=' + errs.join(' | '));
  await canvas.screenshot({ path: outPng });
  console.log('rendered', outPng, 'view='+view, errs.length?('warns:'+errs.slice(0,3).join(' | ')):'');
} finally { await browser.close(); server.close(); }
