// Линтер потоков: проверяет, что точки flows идут ПО геометрии, а не по воздуху.
//
//   node tools/flowcheck.mjs configs/<объект>.json [--tol 0.25]
//
// Зачем: стрелки потока рисуются по ломаной из config.flows[].at (доли bbox).
// Если точку поставили «на глаз», среда летит мимо трубы, а на длинных объектах
// вылетает за наружную стену — на голограмме это видно только при разборке, и
// поймать глазом почти невозможно. Аудит старого ЦТП нашёл именно это: точки
// висели в 0.7–1.2 м от ближайшего тела, часть уходила за стену здания.
//
// Печатает: для каждой точки — расстояние до ближайшего примитива (по его AABB),
// материал этого примитива и «вне габарита» для точек за пределами bbox модели.
// Правило: точка должна лежать ВНУТРИ трубы, то есть расстояние ≈ 0.
import fs from 'node:fs';
import * as THREE from 'three';

const argv = process.argv.slice(2);
const cfgPath = argv[0];
const tol = argv.includes('--tol') ? Number(argv[argv.indexOf('--tol') + 1]) : 0.25;
if (!cfgPath) { console.error('usage: flowcheck.mjs <config.json> [--tol 0.25]'); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
if (!Array.isArray(cfg.geometry) || !cfg.geometry.length) {
  console.error('в конфиге нет декларативной geometry — линтер применим только к CAD-объектам'); process.exit(1);
}

// ---- разворачиваем geometry в список AABB (та же математика, что в movie/decl-dump) ----
const D = Math.PI / 180;
const boxes = [];
const addBox = (m, hx, hy, hz, mat) => {
  // мировой AABB локальной коробки: 8 углов через матрицу
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const v = new THREE.Vector3();
  for (const sx of [-hx, hx]) for (const sy of [-hy, hy]) for (const sz of [-hz, hz]) {
    v.set(sx, sy, sz).applyMatrix4(m);
    lo[0] = Math.min(lo[0], v.x); hi[0] = Math.max(hi[0], v.x);
    lo[1] = Math.min(lo[1], v.y); hi[1] = Math.max(hi[1], v.y);
    lo[2] = Math.min(lo[2], v.z); hi[2] = Math.max(hi[2], v.z);
  }
  boxes.push({ lo, hi, mat });
};
const trs = (base, cx, cy, cz, rot) => {
  const m = new THREE.Matrix4().makeTranslation(cx, cy, cz);
  if (rot) m.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0]*D, rot[1]*D, rot[2]*D, 'XYZ')));
  return base.clone().multiply(m);
};
const axisM = (m, ax) => ax === 'x' ? m.multiply(new THREE.Matrix4().makeRotationZ(Math.PI/2))
                       : ax === 'z' ? m.multiply(new THREE.Matrix4().makeRotationX(Math.PI/2)) : m;
function walk(items, base) {
  items.forEach(it => {
    const r = it.rot;
    if (Array.isArray(it.items)) {
      const at = it.at || [0,0,0], n = it.repeat || 1, st = it.step || [0,0,0], rs = it.rstep;
      for (let i = 0; i < n; i++) {
        const rot = (r || rs) ? [(r?r[0]:0)+(rs?rs[0]*i:0), (r?r[1]:0)+(rs?rs[1]*i:0), (r?r[2]:0)+(rs?rs[2]*i:0)] : null;
        walk(it.items, trs(base, at[0]+st[0]*i, at[1]+st[1]*i, at[2]+st[2]*i, rot));
      }
      return;
    }
    if (it.box) { const a = it.box; addBox(trs(base, a[3], a[4], a[5], r), a[0]/2, a[1]/2, a[2]/2, a[6]); }
    else if (it.cyl) { const a = it.cyl; addBox(axisM(trs(base, a[2], a[3], a[4], r), a[6]), a[0], a[1]/2, a[0], a[5]); }
    else if (it.frustum) { const a = it.frustum, R = Math.max(a[0], a[1]); addBox(axisM(trs(base, a[3], a[4], a[5], r), a[7]), R, a[2]/2, R, a[6]); }
    else if (it.sphere) { const a = it.sphere; addBox(trs(base, a[1], a[2], a[3], r), a[0], a[0], a[0], a[4]); }
    else if (it.torus) { const a = it.torus, R = a[0] + a[1]; addBox(axisM(trs(base, a[2], a[3], a[4], r), a[6] === 'x' ? 'x' : a[6] === 'z' ? 'z' : 'y'), R, a[1], R, a[5]); }
    else if (it.capsule) { const a = it.capsule; addBox(axisM(trs(base, a[2], a[3], a[4], r), a[6]), a[0], a[1]/2 + a[0], a[0], a[5]); }
    else if (it.tube) { const a = it.tube; a[1].forEach(p => addBox(trs(base, p[0], p[1], p[2], null), a[0], a[0], a[0], a[2])); }
  });
}
walk(cfg.geometry, new THREE.Matrix4());

const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
boxes.forEach(b => { for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], b.lo[i]); max[i] = Math.max(max[i], b.hi[i]); } });
const size = [max[0]-min[0], max[1]-min[1], max[2]-min[2]];
const toModel = p => [min[0] + p[0]*size[0], min[1] + p[1]*size[1], min[2] + p[2]*size[2]];
const dist = p => {
  let best = Infinity, mat = '';
  for (const b of boxes) {
    let d = 0;
    for (let i = 0; i < 3; i++) { const o = Math.max(b.lo[i] - p[i], 0, p[i] - b.hi[i]); d += o * o; }
    d = Math.sqrt(d);
    if (d < best) { best = d; mat = b.mat; if (d === 0) break; }
  }
  return { d: best, mat };
};

console.log('примитивов:', boxes.length, '· bbox', size.map(v => +v.toFixed(2)).join(' × '), '· допуск', tol, 'м');
let bad = 0;
(cfg.flows || []).forEach(f => {
  const pts = f.at || [];
  const rows = pts.map((p, i) => {
    const m = toModel(p);
    const { d, mat } = dist(m);
    const out = p.some(v => v < -0.002 || v > 1.002) ? '  ⚠ вне габарита' : '';
    return { i, m, d, mat, out };
  });
  const worst = rows.filter(r => r.d > tol);
  bad += worst.length;
  console.log('\n' + (f.kind || '(поток)') + ' — точек ' + pts.length + (worst.length ? ('   ✗ мимо геометрии: ' + worst.length) : '   ✓'));
  worst.forEach(r => console.log('  т.' + String(r.i + 1).padStart(2) + '  [' +
    r.m.map(v => v.toFixed(2).padStart(6)).join(' ') + ']  до ближайшего ' + r.d.toFixed(2) + ' м (' + r.mat + ')' + r.out));
});
console.log('\nточек мимо геометрии: ' + bad);
process.exit(bad ? 1 : 0);
