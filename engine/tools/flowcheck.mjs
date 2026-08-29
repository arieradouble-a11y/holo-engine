// Линтер потоков: проверяет, что точки flows идут ПО геометрии, а не по воздуху.
//
//   node tools/flowcheck.mjs configs/<объект>.json [--tol 0.25] [--parts ../<папка>]
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
const partsIdx = argv.indexOf('--parts');
const partsDir = partsIdx >= 0 ? argv[partsIdx + 1] : null;
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

// ---- вершины донорских parts ------------------------------------------------
// ⚠ У объекта в режиме "parts" половина геометрии живёт в GLB, а не в config.geometry:
// линтер видел только декларацию и честно объявлял «мимо» поток, идущий вдоль
// донорской стрелы. Поэтому при --parts подгружаются сами файлы: из каждого
// primitive берётся POSITION, прогоняется через матрицы узлов и прореживается —
// расстояние до точки считается до БЛИЖАЙШЕЙ ВЕРШИНЫ, а не до габаритной коробки
// (у диагональной стрелы её AABB накрыл бы полкадра и пропустил бы что угодно).
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
const donorPts = [];
if (partsDir && fs.existsSync(partsDir)) {
  for (const f of fs.readdirSync(partsDir).filter(f => f.endsWith('.glb')).sort()) {
    const v = glbVerts(path.join(partsDir, f));
    donorPts.push({ file: f, v });
  }
  console.log('донорских parts:', donorPts.length,
    '· вершин (прорежено):', donorPts.reduce((s, d) => s + d.v.length, 0));
}

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
donorPts.forEach(dp => dp.v.forEach(v => { for (let i = 0; i < 3; i++) {
  min[i] = Math.min(min[i], v[i]); max[i] = Math.max(max[i], v[i]); } }));
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
  for (const dp of donorPts) {
    for (const v of dp.v) {
      const d = Math.hypot(v[0] - p[0], v[1] - p[1], v[2] - p[2]);
      if (d < best) { best = d; mat = dp.file; }
    }
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
