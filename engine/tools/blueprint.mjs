// Ортогональный «чертёж» декларативной геометрии: три вида (бок / фас / план)
// прямо из configs/*.json — без движка, без камеры, без угадывания ракурса.
// Повторяет матричную математику genDeclarative, поэтому показывает ровно то,
// что увидит движок. Сразу пишет PNG через headless Chrome.
//
//   node blueprint.mjs <config.json> <out.png> [--only mat1,mat2] [--zoom x0,x1,y0,y1] [--scale 108]
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2);
const cfgPath = argv[0], outPng = argv[1];
const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const only = opt('--only') ? new Set(opt('--only').split(',')) : null;
const zoom = opt('--zoom') ? opt('--zoom').split(',').map(Number) : null;
if (!cfgPath || !outPng) { console.error('usage: blueprint.mjs <config.json> <out.png> [--only mats] [--zoom x0,x1,y0,y1]'); process.exit(1); }
const geometry = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).geometry;

// ---- матрицы (те же, что в gen-ilosos.js / genDeclarative) --------------------
const D = Math.PI / 180;
const mMul = (a, b) => a.map(row => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)));
const mI = () => [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
const mT = (x, y, z) => [[1,0,0,x],[0,1,0,y],[0,0,1,z],[0,0,0,1]];
const mRX = t => { const c=Math.cos(t), s=Math.sin(t); return [[1,0,0,0],[0,c,-s,0],[0,s,c,0],[0,0,0,1]]; };
const mRY = t => { const c=Math.cos(t), s=Math.sin(t); return [[c,0,s,0],[0,1,0,0],[-s,0,c,0],[0,0,0,1]]; };
const mRZ = t => { const c=Math.cos(t), s=Math.sin(t); return [[c,-s,0,0],[s,c,0,0],[0,0,1,0],[0,0,0,1]]; };
const mEuler = r => mMul(mRX(r[0]*D), mMul(mRY(r[1]*D), mRZ(r[2]*D)));
const ap = (m, p) => [0,1,2].map(i => m[i][0]*p[0] + m[i][1]*p[1] + m[i][2]*p[2] + m[i][3]);
const axisM = (m, ax) => ax === 'x' ? mMul(m, mRZ(Math.PI/2)) : ax === 'z' ? mMul(m, mRX(Math.PI/2)) : m;
const ringM = (m, ax) => ax === 'x' ? mMul(m, mRY(Math.PI/2)) : ax === 'z' ? m : mMul(m, mRX(Math.PI/2));

// ---- каркас примитивов в локальных координатах → мировые отрезки --------------
const segs = [];                                    // {a:[x,y,z], b:[...], mat}
const push = (m, mat, pts) => segs.push({ a: ap(m, pts[0]), b: ap(m, pts[1]), mat });
const ring = (m, mat, r, y, n) => {                 // окружность в плоскости XZ на высоте y
  for (let i = 0; i < n; i++) {
    const t0 = i / n * 2 * Math.PI, t1 = (i + 1) / n * 2 * Math.PI;
    push(m, mat, [[Math.cos(t0)*r, y, Math.sin(t0)*r], [Math.cos(t1)*r, y, Math.sin(t1)*r]]);
  }
};
function boxWire(m, mat, sx, sy, sz) {
  const X = sx/2, Y = sy/2, Z = sz/2;
  const c = [[-X,-Y,-Z],[X,-Y,-Z],[X,-Y,Z],[-X,-Y,Z],[-X,Y,-Z],[X,Y,-Z],[X,Y,Z],[-X,Y,Z]];
  [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]
    .forEach(([i, j]) => push(m, mat, [c[i], c[j]]));
}
function tubeWire(m, mat, rT, rB, h, n) {           // цилиндр / усечённый конус (three: ось Y)
  ring(m, mat, rT, h/2, n); ring(m, mat, rB, -h/2, n);
  for (let i = 0; i < 4; i++) { const t = i / 4 * 2 * Math.PI;
    push(m, mat, [[Math.cos(t)*rT, h/2, Math.sin(t)*rT], [Math.cos(t)*rB, -h/2, Math.sin(t)*rB]]); }
}
function walk(items, base) {
  const trs = (cx, cy, cz, rot) => { let m = mT(cx, cy, cz); if (rot) m = mMul(m, mEuler(rot)); return mMul(base, m); };
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
    if (it.box)          { const a = it.box;     boxWire(trs(a[3],a[4],a[5],r), a[6], a[0],a[1],a[2]); }
    else if (it.cyl)     { const a = it.cyl;     tubeWire(axisM(trs(a[2],a[3],a[4],r), a[6]), a[5], a[0],a[0],a[1], 12); }
    else if (it.frustum) { const a = it.frustum; tubeWire(axisM(trs(a[3],a[4],a[5],r), a[7]), a[6], a[0],a[1],a[2], 12); }
    else if (it.sphere)  { const a = it.sphere, m = trs(a[1],a[2],a[3],r);
      ring(m, a[4], a[0], 0, 12); ring(mMul(m, mRX(Math.PI/2)), a[4], a[0], 0, 12); ring(mMul(m, mRZ(Math.PI/2)), a[4], a[0], 0, 12); }
    else if (it.torus)   { const a = it.torus, m = ringM(trs(a[2],a[3],a[4],r), a[6]);
      // three-тор лежит в XY (нормаль Z) — приводим к нашей XZ-функции
      const m2 = mMul(m, mRX(Math.PI/2));
      ring(m2, a[5], a[0]+a[1], 0, 16); ring(m2, a[5], a[0]-a[1], 0, 16); }
    else if (it.capsule) { const a = it.capsule; tubeWire(axisM(trs(a[2],a[3],a[4],r), a[6]), a[5], a[0],a[0],a[1], 12); }
    else if (it.tube)    { const a = it.tube, m = trs(0,0,0,r);
      for (let i = 0; i + 1 < a[1].length; i++) push(m, a[2], [a[1][i], a[1][i+1]]); }
  });
}
walk(geometry, mI());

// ---- три ортогональные проекции ----------------------------------------------
// Цвет по материалу. Знакомые имена держат свои цвета (чтобы чертежи машин не
// «перекрашивались» от правки к правке), незнакомые получают цвет из палитры по
// порядку появления — так работает любой объект, а не только техника.
// Суффикс после дефиса (pto-plate, reg-lamp) наследует цвет базового материала:
// это одна система, и в чертеже она должна читаться одним цветом.
const KNOWN = { shassi: '#5ad1ff', kabina: '#ffd166', glass: '#8be9fd', tank: '#7ee787',
                hatch: '#a5d6a7', pump: '#ff9f43', hydro: '#ff6b6b', boom: '#c792ea', hose: '#79c0ff' };
const PALETTE = ['#5ad1ff', '#ffd166', '#7ee787', '#ff9f43', '#ff6b6b', '#c792ea',
                 '#79c0ff', '#f78fb3', '#9ae6b4', '#ffc4a3', '#8be9fd', '#d0a0ff'];
const MAT_COLOR = {};
let nextColor = 0;
for (const s of segs) {
  const base = s.mat.split('-')[0];
  if (MAT_COLOR[base]) continue;
  MAT_COLOR[base] = KNOWN[base] || PALETTE[nextColor++ % PALETTE.length];
}
const colorOf = mat => MAT_COLOR[mat.split('-')[0]] || '#888';
const shown = segs.filter(s => !only || only.has(s.mat));
const VIEWS = [
  { name: 'БОК  (X→ / Y↑)',  px: s => [s.a[0], s.a[1]], py: s => [s.b[0], s.b[1]] },
  { name: 'ФАС  (Z→ / Y↑)',  px: s => [s.a[2], s.a[1]], py: s => [s.b[2], s.b[1]] },
  { name: 'ПЛАН (X→ / Z↑)',  px: s => [s.a[0], s.a[2]], py: s => [s.b[0], s.b[2]] },
];
const SC = +(opt('--scale') || 108), PAD = 34;       // пикселей на метр (--scale для мелких узлов)
const panels = VIEWS.map(v => {
  const L = shown.map(s => ({ p: v.px(s), q: v.py(s), mat: s.mat }));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  L.forEach(({ p, q }) => { x0 = Math.min(x0, p[0], q[0]); x1 = Math.max(x1, p[0], q[0]);
                            y0 = Math.min(y0, p[1], q[1]); y1 = Math.max(y1, p[1], q[1]); });
  if (zoom) { [x0, x1, y0, y1] = zoom; }
  const W = (x1 - x0) * SC + PAD * 2, H = (y1 - y0) * SC + PAD * 2;
  const X = u => PAD + (u - x0) * SC, Y = u => H - PAD - (u - y0) * SC;   // Y вверх
  const lines = L.map(({ p, q, mat }) =>
    `<line x1="${X(p[0]).toFixed(1)}" y1="${Y(p[1]).toFixed(1)}" x2="${X(q[0]).toFixed(1)}" y2="${Y(q[1]).toFixed(1)}" stroke="${colorOf(mat)}"/>`).join('');
  // сетка по метру + подпись габарита
  let grid = '';
  for (let u = Math.ceil(x0); u <= x1; u++) grid += `<line x1="${X(u)}" y1="${PAD}" x2="${X(u)}" y2="${H-PAD}" stroke="#1d2b34"/>`;
  for (let u = Math.ceil(y0); u <= y1; u++) grid += `<line x1="${PAD}" y1="${Y(u)}" x2="${W-PAD}" y2="${Y(u)}" stroke="#1d2b34"/>`;
  return `<div class="p"><div class="t">${v.name} &nbsp;·&nbsp; ${(x1-x0).toFixed(2)} × ${(y1-y0).toFixed(2)} м</div>
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${grid}<g stroke-width="1" fill="none">${lines}</g></svg></div>`;
}).join('');

const legend = Object.entries(MAT_COLOR).map(([m, c]) =>
  `<span><i style="background:${c}"></i>${m}</span>`).join('');
const html = `<!doctype html><meta charset="utf-8"><style>
body{background:#0a1116;color:#8fa6b4;font:12px ui-monospace,Consolas,monospace;margin:0;padding:14px}
.p{margin-bottom:16px}.t{color:#cfe6f5;letter-spacing:.08em;margin:0 0 4px 2px}
.l{margin:2px 0 12px}.l span{margin-right:14px}.l i{display:inline-block;width:9px;height:9px;margin-right:5px}
</style><div class="l">${legend}</div>${panels}`;
const tmp = path.join(path.dirname(path.resolve(outPng)), '_blueprint.html');
fs.writeFileSync(tmp, html);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1200, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
await page.screenshot({ path: outPng, fullPage: true });
await browser.close();
console.log('отрезков:', shown.length, '->', outPng);
