// Кирпичная девятиэтажка серии 85 — три рядовые блок-секции 85-012/1.2 (2Б·2Б·3Б·3Б),
// ЦНИИЭП жилища, альбом 85-ОМП.2-1 «9-этажные блок-секции серии 85» (1980).
// Источник: meganorm.ru/Data2/1/4293783/4293783071.pdf — лист 11 (план секции),
// лист 19 (разрез), лист 4 (номенклатура), лист 2 (общие данные).
//
//   node tools/gen-plan-85.js && node build.js --config configs/plan-85.json --check
//
// Сама секция строится в tools/lib/s85-section.js (там же угловая 016 для Г-дома).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const S = require('./lib/s85-section');
const { W, D, FH } = S;
const r = n => Math.round(n * 10000) / 10000;
const clone = o => JSON.parse(JSON.stringify(o));
const mat = g => g.box?.[6] || '';
const sec = S.build('012');
const parts = [
  ['walls', 'Кирпичные стены', 'ОСИ 3,22 М', 'Поперечные несущие стены из кирпича с шагом 3,22 и 6,44 м; наружные — 510 мм. Размеры по осям листа 11 альбома 85-ОМП.2-1.'],
  ['partitions', 'Перегородки квартир', 'ПЛАН', 'Четыре квартиры на площадке: две трёхкомнатные по краям и две двухкомнатные у лестницы.'],
  ['core', 'Лестница, лифт, мусоропровод', 'УЗЕЛ', 'Обычная лестничная клетка с лифтом и мусоропроводом рядом.'],
  ['wet', 'Санузлы', 'МОКРЫЕ ЗОНЫ', 'Раздельные ванная 2,58 и уборная 1,26 у каждой квартиры.'],
  ['kitchen', 'Кухни', 'БЫТ', 'Кухни 8,00 и 7,48 м².'], ['vents', 'Вентблоки', 'ВЫТЯЖКА', 'Вентканалы у кухонь и санузлов.'],
  ['slab', 'Перекрытие', 'ЭТАЖ', 'Сборные плиты по поперечным стенам.'], ['windows', 'Окна', 'ФАСАД', 'Окна и балконные блоки.'],
  ['loggia', 'Лоджии', 'УЛИЦА', 'Лоджии 3,12 и 6,30 м² вдоль фасада 2 и угловые 2,42 на фасаде 1.'],
].map(([key, name, tag, desc]) => ({ key, name, tag, desc }));

const config = {
  title: 'Дом серии 85 — проект 1980 года', category: 'ЖКХ · ЖИЛОЙ ФОНД · ДОМА РАЗНЫХ ЭПОХ', badge: 'ДОМ ПО ПРОЕКТНЫМ ЧЕРТЕЖАМ',
  subtitle: 'Кирпичная девятиэтажка · три подъезда · подробный план внутри',
  source: 'procedural', mode: 'structured', accent: 'cyan', density: 'high', view: { az: .52, el: .38 },
  building: { type: 'mkd', floors: 9, sections: 3, sectionWidth: W, depth: D, floorHeight: FH, struct: 'brick', lift: true },
  floorStudy: {
    labels: [],
    sources: [
      { title: 'Альбом 85-ОМП.2-1 · лист 11 — секция 2Б·2Б·3Б·3Б, типовой этаж', url: 'https://meganorm.ru/Data2/1/4293783/4293783071.pdf#page=11', note: 'ЦНИИЭП жилища, 1980. Оси 1с–7с: 3,22 + 6,44 + 3,22 + 3,22 + 6,40 + 3,22 м; глубина по осям Ас–Дс 13,02 м; площади комнат и квартир.' },
      { title: 'Лист 19 — фрагменты 1 этажа и разрез', url: 'https://meganorm.ru/Data2/1/4293783/4293783071.pdf#page=19', note: 'Разрез основного решения: девять этажей, парапет на отметке 27,700.' },
      { title: 'Лист 4 — номенклатура блок-секций серии 85', url: 'https://meganorm.ru/Data2/1/4293783/4293783071.pdf#page=4', note: 'Рядовые, угловые, меридиональная и с проездом; дом компонуется из них (лист 7).' },
      { title: 'Лист 2 — общие данные', url: 'https://meganorm.ru/Data2/1/4293783/4293783071.pdf#page=2', note: 'Утверждено Госгражданстроем 31.12.1969, корректировки 1975 (/1) и 1980 (/1.2, тепловая эффективность).' },
    ],
    accuracy: 'Учебная реконструкция монтажного плана блок-секции 85-012/1.2. Оси, глубина корпуса, толщины несущих стен и площади помещений взяты с листа 11; положение перегородок и дверей перенесено по схеме, сантехприборы, лестничные детали и переплёты условны. Дом целиком — музейная сборка трёх одинаковых рядовых секций (в проекте рядовые блокируются с угловыми и торцевыми по листу 7). Подробные квартиры показаны в среднем подъезде; у соседних — наружные стены, окна, лоджии и лестничные узлы без выдуманной квартирной нарезки. Высота этажа 2,8 м принята по разрезу (парапет 27,700 при девяти этажах).',
    planFloorRange: [1, 8],
  },
  geometry: [], parts, matRules: parts.map((p, i) => ({ match: [p.key], part: i })), defaultPart: 0,
  overview: { tag: '1980 · КИРПИЧНЫЙ ДОМ', title: 'Кирпичная девятиэтажка', desc: 'Три рядовые секции серии 85: поперечные кирпичные стены с шагом 3,22 м, лифт и мусоропровод у лестницы, лоджии по обоим фасадам. «План этажа» открывает подробную планировку среднего подъезда.' },
  specs: { rows: [['Проект', '85-012/1.2 · ЦНИИЭП жилища'], ['Утверждён', '1969 · корректировка 1980'], ['Этажей / квартир в секции', '9 / 36'], ['Секция в осях', '25,72 × 13,02 м'], ['Шаг поперечных стен', '3,22 и 6,44 м'], ['Высота этажа', '2,8 м'], ['Квартиры на площадке', '2Б · 2Б · 3Б · 3Б'], ['Подробный план', 'Средний подъезд · четыре квартиры']] },
  markers: [], counter: '9 ЭТАЖЕЙ', calibrate: false,
};

const sections = 3, floors = 9, detailed = 1;
const centers = Array.from({ length: sections }, (_, i) => (i - (sections - 1) / 2) * W);
const envelope = sec.geometry.filter(g => {
  const m = mat(g), b = g.box; if (!b) return false;
  if (/windows|loggia|core|stair|lift|slab|vents/.test(m)) return true;
  if (m === 'walls') return Math.abs(b[3]) >= W / 2 - .3 || Math.abs(b[5]) >= 5.0 || Math.abs(b[3] + W / 2 - S.X[2]) < .3 || Math.abs(b[3] + W / 2 - S.X[4]) < .3;
  return false;
});
const G = [];
const push = (w, h, d, x, y, z, m) => G.push({ box: [w, h, d, x, y, z, m].map(v => typeof v === 'number' ? r(v) : v) });
for (let s = 0; s < sections; s++) {
  const x = centers[s];
  for (let f = 0; f < floors; f++) {
    let floor = clone(s === detailed ? sec.geometry : envelope);
    if (f === 0) floor = floor.filter(g => !/loggia/.test(mat(g)));
    G.push({ at: [x, f * FH, 0], items: floor });
  }
  push(W + .08, .6, D + .3, x, -.38, 0, 'houseEntry');
  const ez = D / 2 + .12;
  push(2.2, .18, 1.5, x, 2.35, ez + .6, 'houseEntry');
  push(.12, 2.73, .12, x - 1.0, .915, ez + 1.2, 'houseEntry'); push(.12, 2.73, .12, x + 1.0, .915, ez + 1.2, 'houseEntry');
  for (let i = 0; i < 3; i++) push(2.4, (3 - i) * .15, .38, x, (3 - i) * .075 - .45, ez + .38 * (i + 1), 'houseEntry');
  push(2.4, .18, 1.2, x, -.4, ez + .57, 'houseEntry');
  const y = floors * FH;
  push(W + .08, .22, D + .08, x, y + .11, 0, 'houseRoof');
  for (const z of [-D / 2, D / 2]) push(W + .08, .8, .16, x, y + .62, z, 'houseRoof');
  for (const xx of [x - W / 2, x + W / 2]) push(.16, .8, D, xx, y + .62, 0, 'houseRoof');
  push(3.2, 2.7, 3.4, x, y + 1.57, 1.6, 'houseRoof');
  push(2.6, 2.3, 2.2, x - 3.6, y + 1.37, 3.2, 'houseRoof');
  for (const dx of [-9.4, -3.0, 3.0, 9.4]) for (const z of [-4.4, 4.4]) { push(.7, 1.1, .7, x + dx, y + .77, z, 'houseRoof'); push(.9, .1, .9, x + dx, y + 1.37, z, 'houseRoof'); }
}
config.geometry = G;
config.floorStudy.labels = sec.labels.map(l => ({ ...l, x: r(l.x + centers[detailed]) }));
config.floorStudy.planBounds = { x: centers[detailed], z: 0, width: W + .3, depth: D + .3 };
config.parts.push(
  { key: 'houseRoof', name: 'Кровля и машинное помещение', tag: 'ДОМ ЦЕЛИКОМ', desc: 'Плоская кровля с парапетом, машинное помещение лифта над каждым узлом, выходы на кровлю и вентшахты.' },
  { key: 'houseEntry', name: 'Входы и цоколь', tag: 'ДОМ ЦЕЛИКОМ', desc: 'Три входа со стороны лестничных узлов, крыльца с козырьками.' },
);
config.matRules = config.parts.map((p, i) => ({ match: [p.key], part: i }));
require('./lib/museum-house-kit')(config, 'plan-85');
const out = path.join(__dirname, '../configs/plan-85.json');
fs.writeFileSync(out, JSON.stringify(config, null, 2) + '\n');
console.log(`plan-85: ${sec.geometry.length} primitives in section, ${G.length} groups, ${sec.labels.length} labels -> ${out}`);
