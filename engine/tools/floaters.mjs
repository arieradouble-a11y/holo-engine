// Поиск деталей, ВИСЯЩИХ В ВОЗДУХЕ: примитив, чей габарит не соприкасается
// ни с одним другим. Дешёвая проверка по AABB — точного контакта она не считает,
// но обычный «забыл подвинуть на 5 см» ловит железно, а именно он и портит модель.
//
//   node tools/floaters.mjs <prims.json> [--tol 0.03] [--top 40]
//
// Прогонять после КАЖДОЙ правки геометрии: глазами такие детали находятся только
// на удачном ракурсе, а тут они все сразу и с координатами.
import fs from 'node:fs';

const argv = process.argv.slice(2);
const src = argv[0];
const tol = argv.includes('--tol') ? +argv[argv.indexOf('--tol') + 1] : 0.03;
const top = argv.includes('--top') ? +argv[argv.indexOf('--top') + 1] : 40;
if (!src) { console.error('usage: floaters.mjs <prims.json> [--tol 0.03] [--top 40]'); process.exit(1); }

const prims = JSON.parse(fs.readFileSync(src, 'utf8')).prims;

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
