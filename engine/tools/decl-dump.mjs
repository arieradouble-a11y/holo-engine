// Декларативная геометрия конфига → плоский JSON примитивов с мировыми матрицами.
// Для Blender-пайплайна: blender-ilosos.py читает этот дамп и строит настоящие
// меши (bevel, shade smooth, PBR) — вместо запечённого GLB.
// Матрицы и семантика осей — те же, что в genDeclarative / decl-to-glb.mjs.
//   node tools/decl-dump.mjs configs/ilosos-cad.json out.json [--skip mat,mat]
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const [cfgPath, outJson] = argv;
const skipIdx = argv.indexOf('--skip');
const skip = skipIdx >= 0 ? argv[skipIdx + 1].split(',') : [];
const onlyIdx = argv.indexOf('--only');
const only = onlyIdx >= 0 ? argv[onlyIdx + 1].split(',') : null;
if (!cfgPath || !outJson) { console.error('usage: decl-dump.mjs <config.json> <out.json> [--skip mat,mat] [--only mat,mat]'); process.exit(1); }
const geometry = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).geometry;

const D = Math.PI / 180;
const prims = [];
const isSkipped = name => (only && !only.some(p => name.startsWith(p))) || skip.some(p => name.startsWith(p));
// .elements у THREE — column-major; так и пишем, Python перевернёт
const add = (rec, m, name) => { if (!isSkipped(name)) prims.push({ ...rec, mat: name, w: m.elements.map(v => +v.toFixed(6)) }); };
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
    if (it.box)          { const a = it.box;     add({ s:'box', d:[a[0],a[1],a[2]] }, trs(a[3],a[4],a[5],r), a[6]); }
    else if (it.cyl)     { const a = it.cyl;     add({ s:'cyl', r:a[0], h:a[1], seg:a[7]||14 }, axisM(trs(a[2],a[3],a[4],r), a[6]), a[5]); }
    else if (it.frustum) { const a = it.frustum; add({ s:'frustum', rt:a[0], rb:a[1], h:a[2] }, axisM(trs(a[3],a[4],a[5],r), a[7]), a[6]); }
    else if (it.sphere)  { const a = it.sphere;  add({ s:'sphere', r:a[0], seg:a[5]||16 }, trs(a[1],a[2],a[3],r), a[4]); }
    else if (it.torus)   { const a = it.torus;   add({ s:'torus', R:a[0], t:a[1] }, ringM(trs(a[2],a[3],a[4],r), a[6]), a[5]); }
    else if (it.capsule) { const a = it.capsule; add({ s:'capsule', r:a[0], h:a[1] }, axisM(trs(a[2],a[3],a[4],r), a[6]), a[5]); }
    else if (it.tube)    { const a = it.tube;
      // Catmull-Rom сэмплируем здесь же — Blender получит готовую гладкую полилинию
      const curve = new THREE.CatmullRomCurve3(a[1].map(p => new THREE.Vector3(...p)));
      const m = trs(0,0,0,r);
      const pts = curve.getPoints((a[3]||24)*2).map(v => v.applyMatrix4(m)).map(v => [+v.x.toFixed(5), +v.y.toFixed(5), +v.z.toFixed(5)]);
      if (!isSkipped(a[2])) prims.push({ s:'tube', r:a[0], pts, mat:a[2] });
    }
  });
}
walk(geometry, new THREE.Matrix4());

fs.mkdirSync(path.dirname(path.resolve(outJson)), { recursive: true });
fs.writeFileSync(outJson, JSON.stringify({ prims }));
const byMat = {};
prims.forEach(p => byMat[p.mat] = (byMat[p.mat]||0)+1);
console.log('примитивов:', prims.length, '→', outJson);
console.log(Object.entries(byMat).map(([k,v]) => k+':'+v).join(' '));
