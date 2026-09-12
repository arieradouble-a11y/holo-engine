'use strict';
// Блок-секции серии 85 (кирпичные 9-этажные, ЦНИИЭП жилища, альбом 85-ОМП.2-1, 1980):
//   '012' — рядовая 85-012/1.2, 2Б·2Б·3Б·3Б, лист 11;
//   '016' — угловая левая 85-016/1.2, лист 16: левый пролёт 1с–2с заменён полосой лоджий,
//           трёхкомнатная у торца развёрнута, её спальни вынесены в ВЫСТУП за ось Дс
//           (2с–4с, до оси Ес) — к нему и примыкает перпендикулярное крыло (лист 7).
// Обе секции строятся в ОДНОЙ системе координат рядовой: X по осям 1с…7с (0…25,72 м),
// Z от оси Ас к Дс (0…13,02 м; у угловой до Ес = 16,53 м), Y — от пола этажа.
// Примитивы отдаются центрированными по рядовой секции (x − W/2, z − D/2).
const r = n => Math.round(n * 10000) / 10000;

const X = [0, 3.22, 9.66, 12.88, 16.10, 22.50, 25.72];      // оси 1с…7с
const zA = 0, zB = 1.32, zV = 7.02, zG = 11.82, zD = 13.02, zE = 16.53;
const W = X[6], D = zD, FH = 2.8, H = FH - 0.2, CX = W / 2;
const X1_016 = 1.9;                                          // у угловой ось 1с = наружная кромка лоджий
const NODE_R = 14.92;                                        // правая грань выступа = ширина крыла 13,02 от 1с

function build(variant = '012') {
  const corner = variant === '016';
  const geometry = [], labels = [];
  const box = (w, h, d, x, y, z, mat) => {
    if (w <= 0 || h <= 0 || d <= 0) throw new Error('non-positive primitive ' + mat + ' ' + [w, h, d]);
    geometry.push({ box: [w, h, d, x - W / 2, y, z - D / 2, mat].map(v => typeof v === 'number' ? r(v) : v) });
  };
  const label = (x, z, name, apt = false) => labels.push({ x: r(x - W / 2), z: r(z - D / 2), name, ...(apt ? { apt: true } : {}) });
  function wall(x1, z1, x2, z2, t, mat = 'walls', open = []) {
    const horiz = z1 === z2, len = Math.hypot(x2 - x1, z2 - z1);
    const emit = (a, b, y, h) => { if (b - a < .001 || h < .001) return; const c = (a + b) / 2;
      box(horiz ? b - a : t, h, horiz ? t : b - a, horiz ? x1 + c : x1, y, horiz ? z1 : z1 + c, mat); };
    let end = 0;
    for (const o of [...open].sort((a, b) => a.at - b.at)) {
      const a = o.at - o.w / 2, b = o.at + o.w / 2;
      if (a < end - .001 || b > len + .001) throw new Error(`opening outside wall ${mat} at ${o.at} (len ${len.toFixed(2)})`);
      emit(end, Math.max(end, a), H / 2, H);
      if (o.sill) emit(a, b, o.sill / 2, o.sill);
      const top = (o.sill || 0) + (o.h || 2.05);
      emit(a, b, (top + H) / 2, H - top);
      if (o.sill) {
        const cx = horiz ? x1 + o.at : x1, cz = horiz ? z1 : z1 + o.at;
        box(horiz ? o.w : .07, .07, horiz ? .07 : o.w, cx, o.sill, cz, 'windows');
        box(horiz ? o.w : .07, .07, horiz ? .07 : o.w, cx, top, cz, 'windows');
        for (const k of [-.5, 0, .5]) box(.05, o.h, .05, horiz ? cx + k * o.w : cx, o.sill + o.h / 2, horiz ? cz : cz + k * o.w, 'windows');
      }
      end = b;
    }
    emit(end, len, H / 2, H);
  }
  const door = (at, w = .9) => ({ at, w, h: 2.05 });
  const win = (at, w = 1.5, sill = .8, h = 1.5) => ({ at, w, sill, h });
  const bdoor = (at, w = 2.4) => ({ at, w, sill: 0, h: 2.2 });
  const gap = (at, w = .85) => ({ at, w, h: H });

  // ---- перекрытие ---------------------------------------------------------
  const xl = corner ? X1_016 : 0;
  box(X[2] - xl, .16, zG - zB, (xl + X[2]) / 2, -.08, (zB + zG) / 2, 'slab');
  box(W - X[4], .16, zG - zB, (X[4] + W) / 2, -.08, (zB + zG) / 2, 'slab');
  box(X[4] - X[2], .16, 7.2 - zA, CX, -.08, (zA + 7.2) / 2, 'slab');
  box(X[4] - X[2], .16, zG + 1.2 - 9.9, CX, -.08, (9.9 + zG + 1.2) / 2, 'slab');
  box(1.0, .16, 9.9 - 7.2, X[2] + .5, -.08, (7.2 + 9.9) / 2, 'core');
  box(1.0, .16, 9.9 - 7.2, X[4] - .5, -.08, (7.2 + 9.9) / 2, 'core');
  if (corner) box(NODE_R - xl, .16, zE - zD, (xl + NODE_R) / 2, -.08, (zD + zE) / 2, 'slab');   // выступ

  // ---- наружные стены (кирпич 510); проёмы — ОТ НАЧАЛА стены -------------
  if (corner) wall(X[1], zB, X[2], zB, .51, 'walls', [bdoor(2.09, 2.4), win(5.14, 1.2)]);
  else wall(-.11, zB, X[2], zB, .51, 'walls', [win(1.68), bdoor(5.31, 2.4), win(8.36, 1.2)]);
  wall(X[4], zB, W + .11, zB, .51, 'walls', [win(1.37, 1.2), bdoor(4.42, 2.4), win(8.05)]);
  wall(X[2], zA + .2, X[4], zA + .2, .51, 'walls', [win(1.6, 1.5), win(X[4] - X[2] - 1.6, 1.5)]);
  wall(X[2], zA + .2, X[2], zB, .51); wall(X[4], zA + .2, X[4], zB, .51);
  if (!corner) wall(-.11, zG, X[2], zG, .51, 'walls', [bdoor(1.68, 1.8), win(5.41, 1.8), win(8.48, 1.2)]);
  wall(X[4], zG, W + .11, zG, .51, 'walls', [win(1.37, 1.2), win(4.42, 1.8), bdoor(8.05, 1.8)]);
  if (corner) {
    // торец 2с — теперь фасад: окно гостиной 17,93, балконный блок гостиной 17,71 на лоджию 6,30,
    // окно кухни 7,59, балконный блок спальни 11,54 на лоджию 3,12
    wall(X[1], zB, X[1], zE, .51, 'walls', [win(2.68), bdoor(8.08, 2.0), win(10.68, 1.2), bdoor(13.78, 1.8)]);
    wall(xl, zE, NODE_R, zE, .51, 'walls', [win(5.3 - xl), win(11.5 - xl)]);      // ось Ес: окна спален 11,54 и 9,74
    wall(NODE_R, zD, NODE_R, zE, .51);                                             // правая грань выступа
    wall(X[2], zD, NODE_R, zD, .38);                                               // стена между площадкой и спальней 9,74
    wall(NODE_R, zD, X[4], zD, .51, 'walls', [door(.58, 1.0)]);                    // вход в подъезд у внутреннего угла
    wall(X[1], zG, X[1], zD, .51);
  } else {
    wall(X[2], zD, X[4], zD, .51, 'walls', [win(1.02, 1.2), door(CX - X[2], 1.4), win(5.42, 1.2)]);
    wall(0, zB, 0, zG, .38);
  }
  wall(X[2], zG, X[2], zD, .51); wall(X[4], zG, X[4], zD, .51);
  wall(W, zB, W, zG, .38);

  // ---- поперечные несущие стены 2с…6с (кирпич 380) ------------------------
  if (!corner) wall(X[1], zB, X[1], zG, .38, 'walls', [door(2.18), door(6.18)]);
  wall(X[5], zB, X[5], zG, .38, 'walls', [door(2.18), door(6.18)]);
  wall(X[2], zB, X[2], zG, .38, 'walls', corner ? [door(4.88), door(9.9)] : [door(4.88), door(6.18)]);
  wall(X[4], zB, X[4], zG, .38, 'walls', [door(4.88), door(6.18)]);
  wall(X[3], zA + .2, X[3], 7.2, .38);

  // ---- квартиры -------------------------------------------------------------
  for (const m of [false, true]) {
    const xx = x => m ? W - x : x;
    const wx = (z, a, b, t, mat, o = []) => wall(Math.min(xx(a), xx(b)), z, Math.max(xx(a), xx(b)), z, t, mat,
      o.map(q => ({ ...q, at: m ? Math.abs(b - a) - q.at : q.at })));
    const wz = (x, a, b, t, mat, o = []) => wall(xx(x), a, xx(x), b, t, mat, o);
    const has3B = !corner || m;   // у угловой левая трёхкомнатная построена отдельно
    if (has3B) {
      wx(8.44, .11, X[1], .12, 'partitions', [door(2.29, .8)]);
      wz(1.61, 5.67, 8.44, .08, 'wet', [door(.5, .7), door(1.9, .7)]);
      wx(6.57, .11, 1.61, .08, 'wet');
      wx(5.52, .11, X[1], .12, 'partitions', [door(2.29, .8)]);
      wz(7.19, 8.12, zG, .12, 'kitchen', [door(1.5, .8)]);
      wx(8.12, X[1], X[2], .12, 'partitions', [gap(2.0, 1.2), door(5.0, .8)]);
      box(.7, .5, 1.55, xx(.5), .25, 7.5, 'wet'); box(.45, .42, .6, xx(1.2), .21, 6.0, 'wet');
      box(.6, .85, .6, xx(7.6), .425, 11.4, 'kitchen'); box(.6, .85, .6, xx(8.9), .425, 11.4, 'kitchen');
      box(.28, H, .3, xx(9.4), H / 2, 9.0, 'vents');
      label(xx(1.57), 10.1, 'Спальня 9,74'); label(xx(5.3), 9.9, 'Гостиная 17,22'); label(xx(8.37), 9.9, 'Кухня 8,00');
      label(xx(.86), 7.5, 'Санузел'); label(xx(2.3), 7.0, 'Холл'); label(xx(1.57), 3.5, 'Спальня 11,54');
      label(xx(5.3), 7.5, m ? '3Б · правая' : '3Б · левая', true);
      const lz = (z0, z1, a, b) => box(Math.abs(b - a), .16, z1 - z0, (xx(a) + xx(b)) / 2, -.08, (z0 + z1) / 2, 'loggia');
      lz(zA + .1, zB, .11, 2.5); lz(zG, zD - .1, .11, 2.2);
      box(2.39, 1.05, .06, xx(1.305), .525, zA + .1, 'loggia');
      box(.06, 1.05, zB - zA - .1, xx(2.5), .525, (zA + zB) / 2, 'loggia');
      box(.06, 1.05, zD - zG - .1, xx(2.2), .525, (zG + zD) / 2, 'loggia');
      box(2.09, 1.05, .06, xx(1.155), .525, zD - .1, 'loggia');
    }
    wx(6.95, X[1], X[2], .12, 'partitions');                                 // холл 3Б | гостиная 17,93 и санузлы 2Б
    wz(7.04, zB, 6.95, .12, 'partitions', [door(4.9, .85)]);
    wx(4.6, 7.04, X[2], .08, 'kitchen', [door(1.7, .8)]);
    wx(5.9, 7.04, 8.6, .08, 'wet'); wz(8.6, 4.6, 6.95, .08, 'wet', [door(.7, .65), door(1.85, .65)]);
    wx(5.25, 7.04, 8.6, .065, 'wet');
    box(.7, .5, 1.5, xx(7.45), .25, 6.2, 'wet'); box(.45, .42, .6, xx(8.2), .21, 4.95, 'wet');
    box(.6, .85, .6, xx(7.4), .425, 1.9, 'kitchen'); box(.6, .85, .6, xx(9.1), .425, 1.9, 'kitchen');
    box(.28, H, .3, xx(9.4), H / 2, 4.4, 'vents');
    label(xx(5.2), 4.0, 'Гостиная 17,93'); label(xx(8.25), 3.0, 'Кухня 7,48'); label(xx(7.8), 6.4, 'Санузел');
    label(xx(5.2), 2.0, m ? '2Б · правая' : '2Б · левая', true);
    const lz2 = (z0, z1, a, b) => box(Math.abs(b - a), .16, z1 - z0, (xx(a) + xx(b)) / 2, -.08, (z0 + z1) / 2, 'loggia');
    lz2(zA + .1, zB, 3.6, 8.4);
    box(4.8, 1.05, .06, xx(6.0), .525, zA + .1, 'loggia');
    box(.06, 1.05, zB - zA - .1, xx(3.6), .525, (zA + zB) / 2, 'loggia'); box(.06, 1.05, zB - zA - .1, xx(8.4), .525, (zA + zB) / 2, 'loggia');
    label(xx(X[2] + 1.46), 2.2, 'Спальня 11,75');
  }
  if (corner) {
    // 3Б угловой секции: гостиная 17,71 у торца, кухня 7,59 и холл 6,44 в полосе Гс–Дс,
    // спальни 11,54 и 9,74 с санузлами — в выступе Дс–Ес (лист 16)
    wall(X[1], 10.85, X[2], 10.85, .12, 'partitions', [door(5.18, .9)]);           // гостиная | кухня-холл
    wall(6.9, 10.85, 6.9, zD, .12, 'kitchen', [door(1.05, .8)]);                   // кухня | холл 6,44
    wall(X[1], zD, X[2], zD, .12, 'partitions', [door(5.38, .9)]);                 // холл 6,44 | холл 3,24 выступа
    wall(7.37, zD, 7.37, zE, .12, 'partitions', [door(.58, .8)]);                  // спальня 11,54 | холл/санузлы
    wall(10.08, zD, 10.08, zE, .12, 'partitions', [door(.58, .8)]);                // холл/санузлы | спальня 9,74
    wall(7.37, 14.25, 10.08, 14.25, .08, 'wet', [door(.47, .65), door(1.81, .65)]); // холл 3,24 | уборная и ванная
    wall(8.29, 14.25, 8.29, zE, .065, 'wet');
    wall(X[3], zD, X[3], zE, .12, 'partitions');                                   // спальня 9,74 | поворотный элемент
    box(.7, .5, 1.5, 9.2, .25, 15.4, 'wet'); box(.45, .42, .6, 7.85, .21, 15.9, 'wet');
    box(.6, .85, .6, 3.7, .425, 12.66, 'kitchen'); box(.6, .85, .6, 5.0, .425, 12.66, 'kitchen');   // плита и мойка вплотную к перегородке холла
    box(.28, H, .3, 6.7, H / 2, 12.6, 'vents'); box(.28, H, .3, 8.29, H / 2, 16.2, 'vents');
    // лоджии торца: 6,30 у гостиной 17,71 и 3,12 у спальни 11,54 (полоса 1с–2с)
    box(X[1] - xl - .1, .16, zG - zV, (xl + X[1]) / 2, -.08, (zV + zG) / 2, 'loggia');
    box(X[1] - xl - .1, .16, 16.3 - 13.9, (xl + X[1]) / 2, -.08, 15.1, 'loggia');
    box(.06, 1.05, zG - zV, xl + .1, .525, (zV + zG) / 2, 'loggia'); box(.06, 1.05, 2.4, xl + .1, .525, 15.1, 'loggia');
    box(X[1] - xl, 1.05, .06, (xl + X[1]) / 2, .525, zV, 'loggia'); box(X[1] - xl, 1.05, .06, (xl + X[1]) / 2, .525, zG, 'loggia');
    box(X[1] - xl, 1.05, .06, (xl + X[1]) / 2, .525, 13.9, 'loggia'); box(X[1] - xl, 1.05, .06, (xl + X[1]) / 2, .525, 16.3, 'loggia');
    label(5.7, 8.9, 'Гостиная 17,71'); label(5.1, 11.9, 'Кухня 7,59'); label(8.3, 11.9, 'Холл 6,44');
    label(5.3, 14.8, 'Спальня 11,54'); label(8.7, 13.6, 'Холл'); label(8.7, 15.4, 'Санузел'); label(11.5, 14.8, 'Спальня 9,74');
    label(5.7, 10.0, '3Б · угловая', true); label(13.9, 14.8, 'Поворотный элемент');
  }
  label(CX, 10.4, 'Лестница'); label(CX, 8.3, 'Лифт'); label(CX, 5.6, 'Мусоропровод');
  label(X[2] + 1.6, 6.3, 'Прихожая'); label(X[4] - 1.6, 6.3, 'Прихожая');

  // ---- лестнично-лифтовой узел ---------------------------------------------
  wall(X[2], 7.2, X[4], 7.2, .25, 'core', [door(1.4, .9), door(X[4] - X[2] - 1.4, .9)]);
  wall(X[2], 9.9, X[3] - .9, 9.9, .25, 'core'); wall(X[3] + .9, 9.9, X[4], 9.9, .25, 'core');
  wall(X[3] - .95, 7.2, X[3] - .95, 9.5, .18, 'lift'); wall(X[3] + .95, 7.2, X[3] + .95, 9.5, .18, 'lift');
  wall(X[3] - .95, 9.5, X[3] + .95, 9.5, .18, 'lift', [door(.95, 1.0)]);
  box(.34, H, .34, X[3] - 2.0, H / 2, 6.0, 'vents');
  for (let i = 0; i < 9; i++) {
    const y = (i + 1) * .155;
    box(1.25, y, .3, X[3] + 2.0, y / 2, 12.2 - i * .28, 'stair');
    const yy = 1.4 + (i + 1) * .155;
    box(1.25, yy, .3, X[3] - 2.0, yy / 2, 9.95 + i * .28, 'stair');
  }
  box(2.9, .18, 1.0, X[3] + 1.35, 1.31, 12.5, 'stair');
  box(.05, 1.0, .05, X[3] + 2.6, 1.9, 12.3, 'stair'); box(.05, 1.0, .05, X[3] - 2.6, 3.2, 12.3, 'stair');

  return { geometry, labels };
}

module.exports = { build, X, zA, zB, zV, zG, zD, zE, W, D, FH, H, CX, X1_016, NODE_R };
