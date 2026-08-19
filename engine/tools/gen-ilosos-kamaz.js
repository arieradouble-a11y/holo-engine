// Генератор configs/ilosos-kamaz.json — ПРОТОТИП: та же машина, что в ilosos-cad,
// но КАБИНА взята готовой моделью (КамАЗ-55111, Sketchfab CC-BY, mamontnikita62).
// Всё остальное — наша процедурная геометрия, разложенная по GLB на систему.
//
// Отличие от ilosos55.json: там донором было ВСЁ шасси целиком (и колёса уезжали
// на 19% крупнее натуры при растяжке до нашей длины). Здесь донор — только кабина,
// шасси остаётся нашим, с правильной базой 3600+1440.
//
// ВАЖНО: в parts-режиме движок сопоставляет GLB с системой по имени ассета
// (20-model.js: PARTDEF.findIndex(p => p.key === assetKey)), поэтому
// parts[].key ОБЯЗАН быть part00…partNN в порядке сортировки файлов.
//
// Сборка частей (из engine/):
//   node tools/decl-to-glb.mjs configs/ilosos-cad.json ../ilosos-kamaz-parts/part00.glb --only shassi,tyre,rim,ftyre,frim
//   ... part02 tank, part03 hatch, part04 pump, part05 hydro, part06 boom, part07 hose
//   blender -b -P tools/blender-ilosos.py -- <nocab-prims.json> <tmp> quick \
//     --cab-glb ../kamaz-cab-donor.glb --cab-cut 1.40 --cab-cut-x 1.98 --cab-top 3.07 \
//     --cab-tris 45000 --export-cab ../ilosos-kamaz-parts/part01.glb
//   node tools/gen-ilosos-kamaz.js && node build.js --config configs/ilosos-kamaz.json --parts ../ilosos-kamaz-parts
const fs = require('fs');
const path = require('path');

const src = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'configs', 'ilosos-cad.json'), 'utf8'));
const by = k => src.parts.find(p => p.key === k) || {};

// порядок обязан совпадать с сортировкой файлов part00.glb…part07.glb
const PARTS = [
  ['part00', 'Шасси и ходовая',    'КамАЗ-6520 6×4', by('shassi').desc],
  ['part01', 'Кабина',             'КАМАЗ',          'Дневная кабина КамАЗ: облицовка с решёткой и шильдом, круглые блок-фары, бампер, зеркала на выносных кронштейнах, подножки и люк в крыше.'],
  ['part02', 'Цистерна 12 м³',     'ЁМКОСТЬ',        by('cisterna').desc],
  ['part03', 'Задняя крышка',      'ВЫГРУЗКА',       by('lyuk').desc],
  ['part04', 'Вакуумный насос',    'PVT400',         by('nasos').desc],
  ['part05', 'Гидропривод',        'ПРИВОД',         by('gidro').desc],
  ['part06', 'Стрела-манипулятор', 'МАНИПУЛЯТОР',    by('strela').desc],
  ['part07', 'Всасывающий рукав',  'РУКАВ ⌀150',     by('rukav').desc],
];

// разлёт при «Разобрать» — те же направления, что в процедурной версии
const EXPLODE = { shassi: 'part00', kabina: 'part01', cisterna: 'part02', lyuk: 'part03',
                  nasos: 'part04', gidro: 'part05', strela: 'part06', rukav: 'part07' };
const explodeDirs = {};
Object.entries(src.explodeDirs).forEach(([k, v]) => { if (EXPLODE[k]) explodeDirs[EXPLODE[k]] = v; });

const config = {
  title: 'Илосос КО-560 (КамАЗ)',
  category: src.category,
  badge: src.badge,
  // атрибуцию держим в subtitle: поле credits движок НЕ отображает (проверено)
  subtitle: 'Вакуумная илососная машина: цистерна 12 м³, вакуумный насос PVT400, гидропривод, стрела-манипулятор и рукав ⌀150.',
  accent: src.accent,
  mode: 'structured',
  source: 'parts',
  thumbLabel: src.thumbLabel,
  counter: 'ИЛОСОС · 8 СИСТЕМ',
  density: 'med',

  hotParts: ['part04', 'part05'],
  hotColor: src.hotColor,
  hotIntensity: src.hotIntensity,
  // донорская кабина — плотный меш, рёбер кратно больше, чем у наших примитивов.
  // Стартуем с процедурных значений: если кабина зарябит, глушить contour здесь.
  contour: src.contour,
  fill: src.fill,
  shellOpacity: src.shellOpacity,
  bloom: src.bloom,
  grade: src.grade,

  parts: PARTS.map(([key, name, tag, desc]) => ({ key, name, tag, desc })),
  explodeDirs,

  specs: src.specs,
  overview: src.overview,
  calibrate: true,
  flows: src.flows,
  markers: src.markers,
  credits: 'Модель кабины: КамАЗ-55111 © mamontnikita62 (Sketchfab), лицензия CC BY 4.0.',
};

fs.writeFileSync(path.resolve(__dirname, '..', 'configs', 'ilosos-kamaz.json'), JSON.stringify(config, null, 2));
console.log('систем:', PARTS.length, '· ✓ configs/ilosos-kamaz.json written');
