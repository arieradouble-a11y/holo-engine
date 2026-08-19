// Пересборка ВСЕХ объектов витрины одной командой.
//
//   node tools/build-catalog.mjs [--out <папка>] [--only <id,id>]
//
// До этого 26 бандлов собирали по одному руками (каждый — своя строка build.js
// с --parts или без), и любая правка движка означала 26 ручных запусков. Карта
// «конфиг → источник → имя файла» здесь ЕДИНСТВЕННАЯ; gen-catalog.mjs берёт
// список объектов из неё же, чтобы витрина и сборка не разъезжались.
//
// Шесть машин собираются из папок per-part GLB (донорская кабина КамАЗ + детали),
// остальные 20 — процедурные (геометрия из конфига, модель не нужна).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(opt('--out', '..'));
const ONLY = (opt('--only', '') || '').split(',').map(s => s.trim()).filter(Boolean);

// id конфига → [человеческое имя файла, папка parts (или null = процедурный)]
export const BUILD_MAP = [
  ['ilosos-kamaz',    'Илосос КО-560 (КамАЗ)',                  '../ilosos-kamaz-parts'],
  ['ko512',           'Каналопромывочная КО-512 (КамАЗ)',       '../ko512-parts'],
  ['musorovoz-cad',   'Мусоровоз с задней загрузкой (КамАЗ)',   '../musorovoz-cad-parts'],
  ['kdm',             'КДМ — комбинированная дорожная (КамАЗ)', '../kdm-parts'],
  ['polivomoika-cad', 'Поливомоечная машина (КамАЗ)',           '../polivomoika-parts'],
  ['agp-cad',         'Автовышка АГП-22 (КамАЗ)',               '../agp-parts'],
  ['nasos',           'Насосный агрегат (центробежный)',        null],
  ['shu',             'Шкаф управления насосной станцией',      null],
  ['itp',             'Тепловой пункт (ИТП)',                   null],
  ['zadvizhka',       'Задвижка с электроприводом',             null],
  ['gidrant',         'Пожарный гидрант с колонкой',            null],
  ['uchet-vody',      'Узел учёта воды (ОДПУ)',                 null],
  ['lebedka',         'Лифтовая лебёдка',                       null],
  ['kns',             'Канализационная насосная станция',       null],
  ['vru',             'ВРУ жилого дома',                        null],
  ['radiator',        'Радиаторный узел квартиры',              null],
  ['reg-klapan',      'Регулирующий клапан',                    null],
  ['grpsh',           'ГРПШ — газорегуляторный пункт',          null],
  ['pvu',             'Приточная вентустановка',                null],
  ['mkd',             'Жилой дом (МКД)',                        null],
  ['mkd-121',         'Панельная 9-этажка (121 серия)',         null],
  ['boiler',          'Котельная',                              null],
  ['power',           'Электростанция ТЭЦ',                     null],
  ['ctp',             'ЦТП',                                    null],
  ['vns',             'Насосная станция (ВНС II подъёма)',      null],
  ['vodozabor',       'Метелёвский водозабор',                  null],
];

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const engine = path.resolve(here, '..');
let ok = 0, fail = 0;
for (const [id, name, parts] of BUILD_MAP) {
  if (ONLY.length && !ONLY.includes(id)) continue;
  const out = path.join(OUT, `${name} (голограмма).html`);
  const args = ['build.js', '--config', `configs/${id}.json`, '--out', out];
  if (parts) args.push('--parts', parts);
  try {
    execFileSync('node', args, { cwd: engine, stdio: ['ignore', 'pipe', 'pipe'] });
    const kb = Math.round(fs.statSync(out).size / 1024);
    console.log(`  ✓ ${name.padEnd(42)} ${String(kb).padStart(5)} KB`);
    ok++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${String(e.stderr || e.message).trim().split('\n').pop()}`);
    fail++;
  }
}
console.log(`\nсобрано ${ok}, ошибок ${fail} → ${OUT}`);
process.exit(fail ? 1 : 0);
