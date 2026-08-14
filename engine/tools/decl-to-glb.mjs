// Декларативная геометрия конфига → GLB (по материалу на систему).
// Нужен, чтобы ту же самую модель, что крутится в голограмме, отдать в Blender
// под PBR-рендер. Матрицы — те же, что в genDeclarative.
//   node decl-to-glb.mjs <config.json> <out.glb>
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';

if (typeof globalThis.FileReader === 'undefined') {           // GLTFExporter рассчитан на браузер
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then(ab => { this.result = ab; this.onloadend?.(); this.onload?.(); }); }
    readAsDataURL(blob) { blob.arrayBuffer().then(ab => { this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(ab).toString('base64'); this.onloadend?.(); this.onload?.(); }); }
  };
}
const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

const argv = process.argv.slice(2);
const [cfgPath, outGlb] = argv;
// --skip a,b — не эмитить материалы с такими префиксами (снять кабину/переднее
// колесо/крыло перед пересадкой донорского передка)
const skipIdx = argv.indexOf('--skip');
const skip = skipIdx >= 0 ? argv[skipIdx + 1].split(',') : [];
const onlyIdx = argv.indexOf('--only');
const only = onlyIdx >= 0 ? argv[onlyIdx + 1].split(',') : null;
const skipped = new Set();
const isSkipped = name => {
  if (only && !only.some(p => name.startsWith(p))) return true;
  return skip.some(p => name.startsWith(p)) && (skipped.add(name), true);
};
if (!cfgPath || !outGlb) { console.error('usage: decl-to-glb.mjs <config.json> <out.glb> [--skip mat,mat]'); process.exit(1); }
const geometry = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).geometry;

const D = Math.PI / 180;
const mats = {};
const matFor = name => mats[name] || (mats[name] = new THREE.MeshStandardMaterial({ name, color: 0xcccccc }));
const root = new THREE.Group();
const add = (geo, m, name) => { if (isSkipped(name)) return;
  const mesh = new THREE.Mesh(geo, matFor(name)); mesh.applyMatrix4(m); root.add(mesh); };
const axisM = (m, ax) => ax === 'x' ? m.multiply(new THREE.Matrix4().makeRotationZ(Math.PI/2))
                       : ax === 'z' ? m.multiply(new THREE.Matrix4().makeRotationX(Math.PI/2)) : m;
const ringM = (m, ax) => ax === 'x' ? m.multiply(new THREE.Matrix4().makeRotationY(Math.PI/2))
                       : ax === 'z' ? m : m.multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));

function walk(items, base) {
  const trs = (cx, cy, cz, rot) => {
    const m = new THREE.Matrix4().makeTranslation(cx, cy, cz);
    if (rot) m.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0]*D, rot[1]*D, rot[2]*D, 'XYZ')));
    return base.clone().multiply(m);
  };
  items.forEach(it => {
    const r = it.rot;
    if (Array.isArray(it.items)) {
      const at = it.at || [0,0,0], n = it.repeat || 1, st = it.step || [0,0,0], rs = it.rstep;
      for (let i = 0; i < n; i++) {
        const rot = (r || rs) ? [(r?r[0]:0)+(rs?rs[0]*i:0), (r?r[1]:0)+(rs?rs[1]*i:0), (r?r[2]:0)+(rs?rs[2]*i:0)] : null;
        walk(it.items, trs(at[0]+st[0]*i, at[1]+st[1]*i, at[2]+st[2]*i, rot));
      }
      return;
    }
    if (it.box)          { const a = it.box;     add(new THREE.BoxGeometry(a[0],a[1],a[2]), trs(a[3],a[4],a[5],r), a[6]); }
    else if (it.cyl)     { const a = it.cyl;     add(new THREE.CylinderGeometry(a[0],a[0],a[1],a[7]||14,1), axisM(trs(a[2],a[3],a[4],r), a[6]), a[5]); }
    else if (it.frustum) { const a = it.frustum; add(new THREE.CylinderGeometry(a[0],a[1],a[2],16,1), axisM(trs(a[3],a[4],a[5],r), a[7]), a[6]); }
    else if (it.sphere)  { const a = it.sphere;  add(new THREE.SphereGeometry(a[0],a[5]||16,(a[5]||16)>>1), trs(a[1],a[2],a[3],r), a[4]); }
    else if (it.torus)   { const a = it.torus;   add(new THREE.TorusGeometry(a[0],a[1],10,24), ringM(trs(a[2],a[3],a[4],r), a[6]), a[5]); }
    else if (it.capsule) { const a = it.capsule; add(new THREE.CapsuleGeometry(a[0],a[1],6,14), axisM(trs(a[2],a[3],a[4],r), a[6]), a[5]); }
    else if (it.tube)    { const a = it.tube;
      const curve = new THREE.CatmullRomCurve3(a[1].map(p => new THREE.Vector3(p[0],p[1],p[2])));
      add(new THREE.TubeGeometry(curve, a[3]||24, a[0], 10, false), trs(0,0,0,r), a[2]); }
  });
}
walk(geometry, new THREE.Matrix4());

const buf = await new Promise((res, rej) => new GLTFExporter().parse(root, r => res(Buffer.from(r)), rej, { binary: true }));
fs.mkdirSync(path.dirname(path.resolve(outGlb)), { recursive: true });
fs.writeFileSync(outGlb, buf);
if (skipped.size) console.log('пропущено материалов:', [...skipped].join(', '));
console.log('мешей:', root.children.length, '· материалов:', Object.keys(mats).length, '->', outGlb, (buf.length/1048576).toFixed(1) + 'MB');
