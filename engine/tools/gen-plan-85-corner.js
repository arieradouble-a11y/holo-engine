// Угловой дом серии 85 — как серия собирает дом буквой Г (лист 7 «Схемы блокировок»):
// крыло вдоль X = угловая левая 85-016/1.2 (лист 16) + рядовая 85-012/1.2 (лист 11);
// к выступу угловой за ось Дс перпендикулярно примыкает второе крыло из двух рядовых.
//
//   node tools/gen-plan-85-corner.js && node build.js --config configs/plan-85-corner.json --check
//
// Инженерию обоих крыльев кладёт museum-house-kit: для крыла X — обычным вызовом,
// для крыла Z — на отдельной «прямой» сборке, которая затем целиком поворачивается
// группой rot (интерпретатор, measure и линтеры её понимают). Подробный план — в
// угловой секции; остальные три — оболочка без выдуманных квартир.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const S = require('./lib/s85-section');
const P = require('./lib/plant-kit');
const r = n => Math.round(n * 10000) / 10000;
const { X, zD, zE, W, D, FH, X1_016, NODE_R } = S;
const floors = 9, y9 = floors * FH;
const clone = o => JSON.parse(JSON.stringify(o));
const mat = g => g.box?.[6] || '';
const isEnvelope = (g, corner) => {
  const m = mat(g), b = g.box; if (!b) return false;
  if (/windows|loggia|core|stair|lift|slab|vents/.test(m)) return true;
  if (m !== 'walls') return false;
  const x = b[3] + W / 2, z = b[5] + D / 2;
  return Math.abs(b[3]) >= W / 2 - .3 || Math.abs(b[5]) >= 5.0 || Math.abs(x - X[2]) < .3 || Math.abs(x - X[4]) < .3
    || (corner && (Math.abs(x - X[1]) < .3 || z >= zE - .3 || Math.abs(x - NODE_R) < .3));
};

// ---- одна прямая сборка: список секций слева направо, подробная — по индексу ----
function assemble(variants, detailed, secW) {
  const G = [];
  const push = (w, h, d, x, y, z, m) => G.push({ box: [w, h, d, x, y, z, m].map(v => typeof v === 'number' ? r(v) : v) });
  const n = variants.length, total = variants.reduce((a, v) => a + secW(v), 0);
  let x0 = -total / 2, labels = [], planX = 0;
  variants.forEach((v, s) => {
    const sec = S.build(v), corner = v === '016';
    // угловая построена в кадре рядовой (её ось 1с = 1,9 м кадра): центр кадра ставим так,
    // чтобы локальная 1,9 легла на левую кромку x0
    const cx = corner ? x0 + W / 2 - X1_016 : x0 + W / 2;
    for (let f = 0; f < floors; f++) {
      let items = clone(s === detailed ? sec.geometry : sec.geometry.filter(g => isEnvelope(g, corner)));
      if (f === 0) items = items.filter(g => !/loggia/.test(mat(g)));
      G.push({ at: [cx, f * FH, 0], items });
    }
    if (s === detailed) { labels = sec.labels.map(l => ({ ...l, x: r(l.x + cx) })); planX = cx; }
    // цоколь, вход, кровля
    const xl = corner ? X1_016 - W / 2 : -W / 2, xr = W / 2;
    push(xr - xl + .08, .6, D + .3, cx + (xl + xr) / 2, -.38, 0, 'houseEntry');
    if (corner) push(NODE_R - X1_016 + .08, .6, zE - zD + .3, cx + (X1_016 + NODE_R) / 2 - W / 2, -.38, (zD + zE) / 2, 'houseEntry');
    const ex = corner ? cx + NODE_R + .6 - W / 2 : cx, ez = D / 2 + .12;
    push(2.2, .18, 1.5, ex, 2.35, ez + .6, 'houseEntry');
    push(.12, 2.73, .12, ex - 1.0, .915, ez + 1.2, 'houseEntry'); push(.12, 2.73, .12, ex + 1.0, .915, ez + 1.2, 'houseEntry');
    for (let i = 0; i < 3; i++) push(2.4, (3 - i) * .15, .38, ex, (3 - i) * .075 - .45, ez + .38 * (i + 1), 'houseEntry');
    push(2.4, .18, 1.2, ex, -.4, ez + .57, 'houseEntry');
    push(xr - xl + .08, .22, D + .08, cx + (xl + xr) / 2, y9 + .11, 0, 'houseRoof');
    push(xr - xl + .08, .8, .16, cx + (xl + xr) / 2, y9 + .62, -D / 2, 'houseRoof');
    if (!corner) push(xr - xl + .08, .8, .16, cx + (xl + xr) / 2, y9 + .62, D / 2, 'houseRoof');
    else {
      push(NODE_R - X1_016 + .08, .22, zE - zD + .08, cx + (X1_016 + NODE_R) / 2 - W / 2, y9 + .11, (zD + zE) / 2, 'houseRoof');
      push(NODE_R - X1_016 + .08, .8, .16, cx + (X1_016 + NODE_R) / 2 - W / 2, y9 + .62, zE - D / 2, 'houseRoof');
      push(W - NODE_R + .08, .8, .16, cx + (NODE_R + W) / 2 - W / 2, y9 + .62, D / 2, 'houseRoof');
      push(.16, .8, zE - zD, cx + NODE_R - W / 2, y9 + .62, (zD + zE) / 2 - D / 2, 'houseRoof');
    }
    if (s === 0 || corner) push(.16, .8, corner ? zE : D, cx + xl, y9 + .62, corner ? (zE - D) / 2 : 0, 'houseRoof');
    if (s === n - 1) push(.16, .8, D, cx + xr, y9 + .62, 0, 'houseRoof');
    push(3.2, 2.7, 3.4, cx, y9 + 1.57, 1.6, 'houseRoof');                       // машинное помещение лифта
    push(2.6, 2.3, 2.2, cx - 3.6, y9 + 1.37, 3.2, 'houseRoof');                  // выход на кровлю
    for (const dx of [-9.4, -3.0, 3.0, 9.4]) for (const z of [-4.4, 4.4]) {
      if (corner && dx === -9.4) continue;
      push(.7, 1.1, .7, cx + dx, y9 + .77, z, 'houseRoof'); push(.9, .1, .9, cx + dx, y9 + 1.37, z, 'houseRoof');
    }
    x0 += secW(v);
  });
  return { G, labels, planX, total };
}
const secW = v => v === '016' ? W - X1_016 : W;
const parts = [{ key: 'walls', name: 'Кирпичные стены', tag: 'ОСИ', desc: '' }, { key: 'partitions', name: 'Перегородки', tag: '', desc: '' },
  { key: 'core', name: 'Лестница и лифт', tag: '', desc: '' }, { key: 'wet', name: 'Санузлы', tag: '', desc: '' }, { key: 'kitchen', name: 'Кухни', tag: '', desc: '' },
  { key: 'vents', name: 'Вентблоки', tag: '', desc: '' }, { key: 'slab', name: 'Перекрытие', tag: '', desc: '' }, { key: 'windows', name: 'Окна', tag: '', desc: '' },
  { key: 'loggia', name: 'Лоджии', tag: '', desc: '' }, { key: 'houseRoof', name: 'Кровля', tag: '', desc: '' }, { key: 'houseEntry', name: 'Входы', tag: '', desc: '' }];
const baseCfg = (G, labels, sections, secWidth, planBounds) => ({
  source: 'procedural', mode: 'structured', accent: 'cyan', density: 'high', view: { az: 2.35, el: .5 },   // из внутреннего угла двора — видны оба крыла и входы
  building: { type: 'mkd', floors, sections, sectionWidth: secWidth, depth: D, floorHeight: FH, struct: 'brick', lift: true },
  floorStudy: { labels, planBounds, planFloorRange: [1, 8], accuracy: '', sources: [] },
  geometry: G, parts: clone(parts), matRules: parts.map((p, i) => ({ match: [p.key], part: i })), defaultPart: 0, markers: [],
});

// ---- крыло X: угловая + рядовая; подробная — угловая -------------------------
const A = assemble(['016', '012'], 0, secW);
const cfg = baseCfg(A.G, A.labels, 2, (W + secW('016')) / 2,
  { x: r(-A.total / 2 + secW('016') / 2), z: r((zE - D) / 2), width: secW('016') + .3, depth: zE + .3 });
Object.assign(cfg, {
  title: 'Угловой дом серии 85 — сборка секций', category: 'ЖКХ · ЖИЛОЙ ФОНД · ДОМА РАЗНЫХ ЭПОХ', badge: 'ДОМ ПО ПРОЕКТНЫМ ЧЕРТЕЖАМ',
  subtitle: 'Кирпичная девятиэтажка буквой Г · четыре подъезда · план угловой секции',
  overview: { tag: '1980 · КИРПИЧНЫЙ ДОМ', title: 'Дом буквой Г из блок-секций', desc: 'Серия 85 собирает дом из секций: ряд заканчивается угловой 85-016, её спальни вынесены в выступ за лестницу, и к выступу перпендикулярно примыкает второе крыло. «План этажа» открывает угловую секцию.' },
  specs: { rows: [['Проекты', '85-016/1.2 · 85-012/1.2'], ['Институт', 'ЦНИИЭП жилища · 1980'], ['Крылья', '2 + 2 секции · 9 этажей'], ['Угловая секция', '2Б·2Б·3Б·3Б · 36 квартир'], ['Оси', '3,22 и 6,44 м · глубина 13,02 м'], ['Выступ угловой', '2с–4с · до оси Ес (+3,51 м)'], ['Подробный план', 'Угловая секция · четыре квартиры']] },
  counter: '9 ЭТАЖЕЙ · 4 ПОДЪЕЗДА', calibrate: false,
});
cfg.floorStudy.sources = [
  { title: 'Альбом 85-ОМП.2-1 · лист 16 — угловая секция 85-016/1.2, типовой этаж', url: 'https://meganorm.ru/Data2/1/4293783/4293783071.pdf#page=16', note: 'ЦНИИЭП жилища, 1980. Левый пролёт заменён полосой лоджий 1,32 м; спальни трёхкомнатной вынесены в выступ 2с–4с до оси Ес.' },
  { title: 'Лист 7 — схемы блокировок', url: 'https://meganorm.ru/Data2/1/4293783/4293783071.pdf#page=7', note: 'Дома с углом: ряд секций заканчивается угловой 016, перпендикулярное крыло примыкает к её выступу; направление блокировки слева направо.' },
  { title: 'Лист 11 — рядовая секция 85-012/1.2', url: 'https://meganorm.ru/Data2/1/4293783/4293783071.pdf#page=11', note: 'Три остальные секции дома.' },
  { title: 'Лист 19 — разрез', url: 'https://meganorm.ru/Data2/1/4293783/4293783071.pdf#page=19', note: 'Девять этажей, парапет на отметке 27,700.' },
];
cfg.floorStudy.accuracy = 'Учебная реконструкция по листам 16 и 11: оси, глубина корпуса и площади помещений угловой секции взяты с листа, положение перегородок и дверей перенесено по схеме, сантехприборы условны. Узел примыкания крыльев (поворотный элемент 31/32 по листу 7) показан обобщённо: выступ угловой секции доведён до ширины крыла, стык крыльев — сплошной кирпичный объём без проёмов. Подробные квартиры — только в угловой секции; у трёх других показаны наружные стены, окна, лоджии и лестничные узлы.';
require('./lib/museum-house-kit')(cfg, 'plan-85-corner');

// ---- крыло Z: две рядовые, оболочка; своя инженерия китом, затем поворот -----
const B = assemble(['012', '012'], -1, secW);
const cB = baseCfg(B.G, [], 2, W, { x: 0, z: 0, width: W, depth: D });
cB.floorStudy.accuracy = '—'; cB.floorStudy.sources = [{ title: 'x', url: 'https://meganorm.ru/' }];
cB.title = 'крыло'; cB.overview = { title: '', desc: '' };
require('./lib/museum-house-kit')(cB, 'plan-85-corner');
// поворот на +90° вокруг Y: local (x,z) → (z, −x); стык — правая грань выступа угловой
const nodeX0 = -A.total / 2;                                      // левая кромка дома = ось 1с угловой
const wingCx = nodeX0 + (NODE_R - X1_016) / 2;                    // центр крыла Z по X (ширина 13,02)
const wingZ0 = zE - D / 2;                                        // ось Ес угловой в мировых координатах
cfg.geometry.push({ at: [r(wingCx), 0, r(wingZ0 + W)], rot: [0, 90, 0], items: cB.geometry });
// узлы и потоки кита нормированы по габариту крыла X — пересчитываем в полный габарит
const mA = P.measure(cfg.geometry.filter(g => !g.rot)), mF = P.measure(cfg.geometry);
const renorm = fr => mF.frac([mA.min[0] + fr[0] * mA.size[0], mA.min[1] + fr[1] * mA.size[1], mA.min[2] + fr[2] * mA.size[2]]);
cfg.markers = cfg.markers.map(m => ({ ...m, at: renorm(m.at) }));
cfg.flows = (cfg.flows || []).map(f => ({ ...f, at: f.at.map(renorm) }));
cfg.markers.push({ n: cfg.markers.length + 1, name: 'Стык крыльев', at: mF.frac([wingCx, y9 * .5, wingZ0]), desc: 'Второе крыло примыкает к выступу угловой секции. В серии стык решают поворотные элементы 31 и 32 (лист 7); здесь он показан сплошным кирпичным объёмом без проёмов.' });
cfg.counter = '9 ЭТАЖЕЙ · 4 ПОДЪЕЗДА';
cfg.subtitle = 'Кирпичная девятиэтажка буквой Г · четыре подъезда · план угловой секции';
const out = path.join(__dirname, '../configs/plan-85-corner.json');
fs.writeFileSync(out, JSON.stringify(cfg, null, 2) + '\n');
console.log(`plan-85-corner: wing X ${A.G.length} groups, wing Z ${B.G.length} groups, ${cfg.floorStudy.labels.length} labels -> ${out}`);
