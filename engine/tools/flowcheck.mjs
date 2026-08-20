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
// Модель строится ТЕМ ЖЕ движком (src/modules/10-generators.js), что и в бандле,
// поэтому линтер одинаково работает и с декларативными объектами, и с домом, у
// которого корпус параметрический (building{}), а подвал — декларативный: доли
// bbox там считаются от ВСЕЙ модели, и по одной декларации их не воспроизвести.
//
// Печатает: для каждой точки — расстояние до ближайшего примитива (по его AABB),
// материал этого примитива и «вне габарита» для точек за пределами bbox модели.
// Правило: точка должна лежать ВНУТРИ трубы, то есть расстояние ≈ 0.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

const argv = process.argv.slice(2);
const cfgPath = argv[0];
const tol = argv.includes('--tol') ? Number(argv[argv.indexOf('--tol') + 1]) : 0.25;
if (!cfgPath) { console.error('usage: flowcheck.mjs <config.json> [--tol 0.25]'); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

const genSrc = fs.readFileSync(path.join('src', 'modules', '10-generators.js'), 'utf8');
const Gen = new Function('THREE', `return class G {\n${genSrc}\n}`)(THREE);
const g = new Gen();
g.CONFIG = cfg; g.meshData = [];
g.buildProceduralModel(THREE);
if (!g.meshData.length) { console.error('модель пуста: у конфига нет ни geometry, ни building'); process.exit(1); }

const boxes = g.meshData.map(md => {
  if (!md.geometry.boundingBox) md.geometry.computeBoundingBox();
  const b = new THREE.Box3().copy(md.geometry.boundingBox).applyMatrix4(md.matrixWorld);
  return { lo: [b.min.x, b.min.y, b.min.z], hi: [b.max.x, b.max.y, b.max.z], mat: md.mat };
});
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
boxes.forEach(b => { for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], b.lo[i]); max[i] = Math.max(max[i], b.hi[i]); } });
const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
const toModel = p => [min[0] + p[0] * size[0], min[1] + p[1] * size[1], min[2] + p[2] * size[2]];
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
    r.m.map(v => v.toFixed(2).padStart(7)).join(' ') + ']  до ближайшего ' + r.d.toFixed(2) + ' м (' + r.mat + ')' + r.out));
});
console.log('\nточек мимо геометрии: ' + bad);
process.exit(bad ? 1 : 0);
