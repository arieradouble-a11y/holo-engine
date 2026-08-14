// Мостик img2threejs → движок голограмм.
// Читает ObjectSculptSpec (spec.json) от img2threejs и эмитит по одному GLB на
// систему верхнего уровня (componentTree, parent=root) — прямо в формат
// `build.js --parts <dir>`: имя файла partNN + world-позиции сохраняются, чтобы
// детали собирались в общей сцене. Так структура (дерево узлов) переезжает в
// разборную голограмму без ручной пересборки.
//
//   node sculptspec-to-parts.mjs <spec.json> <out-parts-dir>
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';

// GLTFExporter рассчитан на браузер: полифиллим FileReader (Node его не даёт),
// используется при упаковке бинарных буферов. Текстур нет — только геометрия.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then(ab => { this.result = ab; this.onloadend?.(); this.onload?.(); }); }
    readAsDataURL(blob) { blob.arrayBuffer().then(ab => { this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(ab).toString('base64'); this.onloadend?.(); this.onload?.(); }); }
  };
}
const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

// Режимы:
//   <spec.json> <out-dir>                     — по GLB на систему (для build.js --parts)
//   <spec.json> --combined <out.glb> [--offset x,y,z]  — вся под-сборка в один GLB (узел)
const argv = process.argv.slice(2);
const specPath = argv[0];
const combinedIdx = argv.indexOf('--combined');
const combined = combinedIdx >= 0 ? argv[combinedIdx + 1] : null;
const offIdx = argv.indexOf('--offset');
const offset = offIdx >= 0 ? argv[offIdx + 1].split(',').map(Number) : [0, 0, 0];
const outDir = combined ? null : argv[1];
if (!specPath || (!combined && !outDir)) { console.error('usage: sculptspec-to-parts.mjs <spec.json> <out-dir> | <spec.json> --combined <out.glb> [--offset x,y,z]'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
if (outDir) fs.mkdirSync(outDir, { recursive: true });

const mats = Object.fromEntries((spec.materials || []).map(m => [m.id,
  new THREE.MeshStandardMaterial({ color: new THREE.Color(m.baseColor || m.color || '#999') })]));
const matFor = id => mats[id] || new THREE.MeshStandardMaterial({ color: 0x888888 });

function geoFor(c) {
  const d = c.dimensions || {}, w = d.width ?? 1, h = d.height ?? 1, dp = d.depth ?? 1;
  switch (c.primitive) {                                     // width=radius для тел вращения
    case 'cylinder':  return new THREE.CylinderGeometry(w, w, h, 40);
    case 'cone':      return new THREE.ConeGeometry(w, h, 40);
    case 'sphere':    return new THREE.SphereGeometry(w, 40, 24);
    case 'capsule':   return new THREE.CapsuleGeometry(w, h, 12, 24);
    case 'torus':     return new THREE.TorusGeometry(w, dp || w * 0.15, 16, 40);
    case 'ellipsoid': { const g = new THREE.SphereGeometry(1, 40, 24); g.scale(w, h, dp); return g; }
    default:          return new THREE.BoxGeometry(w, h, dp);
  }
}
function buildMesh(c) {
  const t = c.transform || {};
  const mesh = new THREE.Mesh(geoFor(c), matFor(c.material));
  mesh.name = c.id;
  const p = t.position || [0, 0, 0], r = t.rotation || [0, 0, 0], s = t.scale || [1, 1, 1];
  mesh.position.set(p[0], p[1], p[2]);
  mesh.rotation.set(r[0], r[1], r[2]);
  // ось тел вращения: three по умолчанию Y; развернуть под x/z
  if (['cylinder', 'cone', 'capsule'].includes(c.primitive)) {
    if (c.cylAxis === 'x') mesh.rotateZ(Math.PI / 2);
    else if (c.cylAxis === 'z') mesh.rotateX(Math.PI / 2);
  }
  if (c.primitive === 'torus' && c.cylAxis === 'x') mesh.rotateY(Math.PI / 2);
  mesh.scale.set(s[0], s[1], s[2]);
  return mesh;
}

const systems = (spec.componentTree || []).filter(c => c.id !== 'root');
const exporter = new GLTFExporter();
const exportGLB = obj => new Promise((res, rej) =>
  exporter.parse(obj, r => res(Buffer.from(r)), rej, { binary: true }));

if (combined) {                        // вся под-сборка → один GLB (один узел движка)
  const g = new THREE.Group();
  g.position.set(offset[0], offset[1], offset[2]);
  for (const c of systems) g.add(buildMesh(c));
  fs.mkdirSync(path.dirname(combined), { recursive: true });
  fs.writeFileSync(combined, await exportGLB(g));
  console.log('combined', systems.length, 'узлов ->', combined, 'offset', offset.join(','));
  process.exit(0);
}

let i = 0;
for (const c of systems) {
  const g = new THREE.Group();          // identity-группа: world-позиция меша сохраняется
  g.add(buildMesh(c));
  const buf = await exportGLB(g);
  const fn = 'part' + String(i).padStart(2, '0') + '.glb';
  fs.writeFileSync(path.join(outDir, fn), buf);
  console.log(fn.padEnd(11), '<-', c.id.padEnd(10), c.name);
  i++;
}
// заодно карта partNN → система (для конфига движка)
const map = systems.map((c, n) => ({ part: 'part' + String(n).padStart(2, '0'), id: c.id, name: c.name, material: c.material }));
fs.writeFileSync(path.join(outDir, '_map.json'), JSON.stringify(map, null, 2));
console.log('\n' + systems.length + ' систем -> ' + outDir);
