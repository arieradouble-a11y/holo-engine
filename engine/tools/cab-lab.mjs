// Стенд кабины: гоняет ТОЛЬКО кабину, оставляя весь остальной илосос как фон.
// Кабину видно в контексте (колесо, рама, цистерна) — иначе пропорции уплывают.
//
//   node tools/cab-lab.mjs <variant.cjs|current> <tag> [quick|preview]
//
// Вариант — CommonJS-модуль, экспортирующий функцию ctx => [ ...примитивы DSL... ]:
//
//   module.exports = ({ mir, axF, frameY, wr, trF, xF }) => {
//     const cX1 = 3.95;                       // свои константы кабины — внутри
//     return [ { box: [1.0, 0.5, 2.0, cX1, 2.0, 0, 'kabina'] }, ... ];
//   };
//
// Палитра кабины (иные имена дадут серый пластик и не попадут в деталь «Кабина»):
//   kabina · kabina-dark · kabina-chrome · kabina-grille · kabina-lamp · kabina-amber · glass
//
// На выходе: render_out/cab-lab/<tag>/{quick,preview}_{cab34,cabfront,cabside,cabtop}.png
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, '..');
const ROOT = path.resolve(ENGINE, '..');
const LAB = path.join(ROOT, 'render_out', 'cab-lab');
const CONFIG = path.join(ENGINE, 'configs', 'ilosos-cad.json');
const BLENDER = process.env.BLENDER || 'C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe';
const CAB_MATS = 'kabina,glass';

const [variantArg, tag = 'v', mode = 'quick'] = process.argv.slice(2);
if (!variantArg) {
  console.error('usage: cab-lab.mjs <variant.cjs|current> <tag> [quick|preview]');
  process.exit(1);
}
const outDir = path.join(LAB, tag);
fs.mkdirSync(outDir, { recursive: true });
const node = (args) => execFileSync(process.execPath, args, { cwd: ENGINE, encoding: 'utf8' });

// ---- 1. фон: весь илосос БЕЗ кабины (кэш — геометрия шасси тут не меняется) ----
const ctxPrims = path.join(LAB, '_ctx-prims.json');
if (!fs.existsSync(ctxPrims) || fs.statSync(CONFIG).mtimeMs > fs.statSync(ctxPrims).mtimeMs) {
  node([path.join(HERE, 'decl-dump.mjs'), CONFIG, ctxPrims, '--skip', CAB_MATS]);
  console.log('фон пересобран (илосос без кабины)');
}

// ---- 2. кабина: либо текущая из конфига, либо из файла-варианта ----------------
const cabPrims = path.join(outDir, '_cab-prims.json');
if (variantArg === 'current') {
  node([path.join(HERE, 'decl-dump.mjs'), CONFIG, cabPrims, '--only', CAB_MATS]);
} else {
  const variantPath = path.resolve(variantArg);
  const build = createRequire(import.meta.url)(variantPath);
  // mir(): честное зеркалирование поддерева по Z — repeat/step так не умеет
  const ZI = { box: 5, cyl: 4, frustum: 5, sphere: 3, torus: 4, capsule: 4 };
  const negZ = (it) => {
    const o = {};
    for (const k of Object.keys(it)) {
      if (k === 'items') o.items = it.items.map(negZ);
      else if (k === 'at' || k === 'step') o[k] = [it[k][0], it[k][1], -it[k][2]];
      else if (k === 'rot' || k === 'rstep') o[k] = [-it[k][0], -it[k][1], it[k][2]];
      else if (k === 'tube') o.tube = [it.tube[0], it.tube[1].map(p => [p[0], p[1], -p[2]]), ...it.tube.slice(2)];
      else if (ZI[k] != null) { const a = it[k].slice(); a[ZI[k]] = -a[ZI[k]]; o[k] = a; }
      else o[k] = it[k];
    }
    return o;
  };
  const mir = items => [...items, ...items.map(negZ)];
  // константы шасси — из того же места, что у генератора (кабина обязана на них сесть)
  const geometry = build({ mir, negZ, xF: +4.26, axF: 2.94, frameY: 1.05, wr: 0.54, trF: 1.02 });
  if (!Array.isArray(geometry)) throw new Error('вариант должен вернуть массив примитивов');
  const tmpCfg = path.join(outDir, '_cab-config.json');
  fs.writeFileSync(tmpCfg, JSON.stringify({ geometry }));
  node([path.join(HERE, 'decl-dump.mjs'), tmpCfg, cabPrims]);
}

// ---- 3. склейка: примитивы уже в мировых матрицах, достаточно конкатенации -----
const merged = path.join(outDir, '_prims.json');
const prims = [...JSON.parse(fs.readFileSync(ctxPrims, 'utf8')).prims,
               ...JSON.parse(fs.readFileSync(cabPrims, 'utf8')).prims];
fs.writeFileSync(merged, JSON.stringify({ prims }));

// ---- 4. рендер стендовых ракурсов ----------------------------------------------
const log = execFileSync(BLENDER,
  ['-b', '--factory-startup', '-P', path.join(HERE, 'blender-ilosos.py'), '--',
   merged, outDir, mode, '--cams', 'cab'],
  { encoding: 'utf8' });
const rendered = log.split('\n').filter(l => l.startsWith('RENDERED')).map(l => l.slice(9).trim());
if (!rendered.length) { console.error(log.slice(-3000)); process.exit(1); }
const cabCount = JSON.parse(fs.readFileSync(cabPrims, 'utf8')).prims.length;
console.log(`кабина: ${cabCount} примитивов · режим ${mode}`);
rendered.forEach(p => console.log('  ' + p));
