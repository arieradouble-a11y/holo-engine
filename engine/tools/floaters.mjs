// Поиск деталей, ВИСЯЩИХ В ВОЗДУХЕ: примитив, чей габарит не соприкасается
// ни с одним другим. Дешёвая проверка по AABB — точного контакта она не считает,
// но обычный «забыл подвинуть на 5 см» ловит железно, а именно он и портит модель.
//
//   node tools/floaters.mjs <prims.json> [--tol 0.03] [--top 40] [--parts ../<папка>]
//
// ⚠ --parts ОБЯЗАТЕЛЕН У ДОНОРСКИХ ОБЪЕКТОВ. Линтер читает config.geometry, то
// есть только ДЕКЛАРАТИВНУЮ половину модели: у машины на донорском теле фары,
// кронштейны и навеска крепятся к GLB, которого он не видит, и все они честно
// числятся висящими. С --parts у каждой «висящей» детали дополнительно
// проверяется расстояние до ближайшей вершины донора — как это давно делает
// flowcheck. На экскаваторе-погрузчике так снялись 9 ложных срабатываний из 9.
//
// Прогонять после КАЖДОЙ правки геометрии: глазами такие детали находятся только
// на удачном ракурсе, а тут они все сразу и с координатами.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const src = argv[0];
const tol = argv.includes('--tol') ? +argv[argv.indexOf('--tol') + 1] : 0.03;
const top = argv.includes('--top') ? +argv[argv.indexOf('--top') + 1] : 40;
const partsIdx = argv.indexOf('--parts');
const partsDir = partsIdx >= 0 ? argv[partsIdx + 1] : null;
if (!src) { console.error('usage: floaters.mjs <prims.json> [--tol 0.03] [--top 40]'); process.exit(1); }

const prims = JSON.parse(fs.readFileSync(src, 'utf8')).prims;

// ---- вершины донорских parts (тот же разбор, что во flowcheck) ---------------
function glbVerts(file, step = 7) {
  const buf = fs.readFileSync(file);
  const jsonLen = buf.readUInt32LE(12);
  const js = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  const binOff = 20 + jsonLen + 8;
  const mul = (m, n) => { const o = new Array(16);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++)
      o[r * 4 + c] = m[r * 4] * n[c] + m[r * 4 + 1] * n[4 + c] + m[r * 4 + 2] * n[8 + c] + m[r * 4 + 3] * n[12 + c];
    return o; };
  const trs = n => {
    if (n.matrix) { const m = n.matrix; return [m[0],m[4],m[8],m[12], m[1],m[5],m[9],m[13],
      m[2],m[6],m[10],m[14], m[3],m[7],m[11],m[15]]; }
    const t = n.translation || [0,0,0], q = n.rotation || [0,0,0,1], sc = n.scale || [1,1,1];
    const [x,y,z,w] = q;
    const R = [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w),
               2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w),
               2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)];
    return [R[0]*sc[0], R[1]*sc[1], R[2]*sc[2], t[0],
            R[3]*sc[0], R[4]*sc[1], R[5]*sc[2], t[1],
            R[6]*sc[0], R[7]*sc[1], R[8]*sc[2], t[2], 0,0,0,1];
  };
  const out = [];
  const walk = (ni, M) => {
    const n = js.nodes[ni], m = mul(M, trs(n));
    if (n.mesh != null) for (const pr of js.meshes[n.mesh].primitives) {
      const acc = js.accessors[pr.attributes.POSITION];
      const bv = js.bufferViews[acc.bufferView];
      const base = binOff + (bv.byteOffset || 0) + (acc.byteOffset || 0);
      const stride = bv.byteStride || 12;
      for (let i = 0; i < acc.count; i += step) {
        const o = base + i * stride;
        const v = [buf.readFloatLE(o), buf.readFloatLE(o + 4), buf.readFloatLE(o + 8)];
        out.push([m[0]*v[0] + m[1]*v[1] + m[2]*v[2] + m[3],
                  m[4]*v[0] + m[5]*v[1] + m[6]*v[2] + m[7],
                  m[8]*v[0] + m[9]*v[1] + m[10]*v[2] + m[11]]);
      }
    }
    (n.children || []).forEach(c => walk(c, m));
  };
  (js.scenes[js.scene || 0].nodes || []).forEach(n => walk(n, [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]));
  return out;
}
let donorVerts = [];
if (partsDir) {
  for (const f of fs.readdirSync(partsDir).filter(f => /.glb$/i.test(f)).sort())
    donorVerts = donorVerts.concat(glbVerts(path.join(partsDir, f)));
  console.log('донорских вершин (прорежено): ' + donorVerts.length);
}
// деталь опирается на донора, если хоть одна его вершина попала в её AABB + допуск
const onDonor = ([lo, hi]) => {
  for (const v of donorVerts) {
    if (v[0] >= lo[0] - tol && v[0] <= hi[0] + tol &&
        v[1] >= lo[1] - tol && v[1] <= hi[1] + tol &&
        v[2] >= lo[2] - tol && v[2] <= hi[2] + tol) return true;
  }
  return false;
};

// мировой AABB примитива: локальные полуразмеры через матрицу (8 углов),
// ровно как это делает движок в measure()
const mApply = (w, p) => [
  w[0] * p[0] + w[4] * p[1] + w[8]  * p[2] + w[12],
  w[1] * p[0] + w[5] * p[1] + w[9]  * p[2] + w[13],
  w[2] * p[0] + w[6] * p[1] + w[10] * p[2] + w[14],
];
function aabb(p) {
  if (p.s === 'tube') {                       // труба уже в мировых точках
    const lo = [0, 1, 2].map(k => Math.min(...p.pts.map(q => q[k])) - p.r);
    const hi = [0, 1, 2].map(k => Math.max(...p.pts.map(q => q[k])) + p.r);
    return [lo, hi];
  }
  let h;
  if (p.s === 'box') h = [p.d[0] / 2, p.d[1] / 2, p.d[2] / 2];
  else if (p.s === 'cyl') h = [p.r, p.h / 2, p.r];
  else if (p.s === 'frustum') { const R = Math.max(p.rt, p.rb); h = [R, p.h / 2, R]; }
  else if (p.s === 'sphere') h = [p.r, p.r, p.r];
  else if (p.s === 'torus') h = [p.R + p.t, p.R + p.t, p.t];
  else if (p.s === 'capsule') h = [p.r, p.h / 2 + p.r, p.r];
  else h = [0.01, 0.01, 0.01];
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < 8; i++) {
    const q = mApply(p.w, [i & 1 ? h[0] : -h[0], i & 2 ? h[1] : -h[1], i & 4 ? h[2] : -h[2]]);
    for (let k = 0; k < 3; k++) { if (q[k] < lo[k]) lo[k] = q[k]; if (q[k] > hi[k]) hi[k] = q[k]; }
  }
  return [lo, hi];
}

const boxes = prims.map(aabb);
const touch = (a, b) => [0, 1, 2].every(k => a[0][k] - tol <= b[1][k] && b[0][k] - tol <= a[1][k]);

// разбиение по ячейкам, чтобы не гонять N² на крупных сборках
const CELL = 0.5, grid = new Map();
const keyOf = (x, y, z) => x + ',' + y + ',' + z;
boxes.forEach(([lo, hi], i) => {
  for (let x = Math.floor((lo[0] - tol) / CELL); x <= Math.floor((hi[0] + tol) / CELL); x++)
    for (let y = Math.floor((lo[1] - tol) / CELL); y <= Math.floor((hi[1] + tol) / CELL); y++)
      for (let z = Math.floor((lo[2] - tol) / CELL); z <= Math.floor((hi[2] + tol) / CELL); z++) {
        const k = keyOf(x, y, z);
        (grid.get(k) || grid.set(k, []).get(k)).push(i);
      }
});

const floaters = [];
boxes.forEach(([lo, hi], i) => {
  const seen = new Set();
  for (let x = Math.floor((lo[0] - tol) / CELL); x <= Math.floor((hi[0] + tol) / CELL); x++)
    for (let y = Math.floor((lo[1] - tol) / CELL); y <= Math.floor((hi[1] + tol) / CELL); y++)
      for (let z = Math.floor((lo[2] - tol) / CELL); z <= Math.floor((hi[2] + tol) / CELL); z++)
        (grid.get(keyOf(x, y, z)) || []).forEach(j => seen.add(j));
  for (const j of seen) if (j !== i && touch(boxes[i], boxes[j])) return;
  if (donorVerts.length && onDonor(boxes[i])) return;      // держится на донорской части
  // ближайший сосед — чтобы сразу видеть, НАСКОЛЬКО деталь оторвалась
  let best = Infinity, bestMat = '';
  boxes.forEach(([l2, h2], j) => {
    if (j === i) return;
    const d = Math.hypot(...[0, 1, 2].map(k => Math.max(0, Math.max(l2[k] - hi[k], lo[k] - h2[k]))));
    if (d < best) { best = d; bestMat = prims[j].mat; }
  });
  const c = [0, 1, 2].map(k => +((lo[k] + hi[k]) / 2).toFixed(2));
  floaters.push({ i, mat: prims[i].mat, s: prims[i].s, at: c, gap: +best.toFixed(3), near: bestMat });
});

// console.log НЕ понимает ширину в стиле %-14s — выравниваем руками
floaters.sort((a, b) => b.gap - a.gap);
console.log(`примитивов: ${prims.length} · допуск касания: ${tol} м · ВИСЯТ В ВОЗДУХЕ: ${floaters.length}`);
floaters.slice(0, top).forEach(f => console.log(
  '  ' + f.mat.padEnd(14) + f.s.padEnd(9) +
  ('[' + f.at.map(v => v.toFixed(2).padStart(6)).join(' ') + ']').padEnd(24) +
  'зазор ' + f.gap.toFixed(3).padStart(6) + ' м   ближайшее: ' + f.near));
if (floaters.length > top) console.log(`  … и ещё ${floaters.length - top}`);
