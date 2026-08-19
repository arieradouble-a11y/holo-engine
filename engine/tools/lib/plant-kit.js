// Общий «конструктор станций» — то же, чем lib/kamaz-6x4.js стал для парка техники.
//
// Зачем: здания категории «Здания и станции» строились ХАРДКОДОМ внутри движка
// (src/modules/10-generators.js) и получали 65–130 примитивов на зал 20×6×12 м,
// тогда как ИТП размером 3 м получает 391. Смотрелось это стеклянным аквариумом
// с горсткой коробочек внутри. Теперь станции собираются CAD-путём — своим
// generator'ом gen-<имя>.js в декларативный geometry, — и весь повторяющийся
// «словарь» завода живёт здесь: насос, ПТО, задвижка, гребёнка, шкаф, каркас
// здания, площадки, лестницы.
//
// Все функции возвращают МАССИВ элементов DSL в мировых координатах (метры):
//   { box:[sx,sy,sz, cx,cy,cz, mat] }            { sphere:[r, cx,cy,cz, mat, seg] }
//   { cyl:[r,h, cx,cy,cz, mat, ax, seg] }        { torus:[R,tube, cx,cy,cz, mat, ax] }
//   { frustum:[rT,rB,h, cx,cy,cz, mat, ax] }     { at, rot, repeat, step, items:[…] }
// Материал приходит параметром: каждая станция раскладывает узлы по СВОИМ системам
// (matRules), поэтому имена материалов знает только генератор объекта.
//
// ⚠ Новый материал надо добавить и в таблицу MATS в tools/blender-ilosos.py, иначе
//   на PBR-рендере он будет серым пластиком. Суффикс после дефиса (pump-dark) в
//   движке попадает в ту же систему (matRules матчит подстроку), а Blender берёт
//   по нему цвет — так делаются стёкла, шильды, циферблаты.
// ⚠ Тонкие детали (<10 мм) в BEVELED-список Blender'а не добавлять: фаска 8 мм их съест.

'use strict';

// ── трубы и арматура ─────────────────────────────────────────────────────────

// Жёсткая трасса: прямые участки по осям + сферы-отводы в коленах.
// tube (Catmull-Rom) для трубопровода НЕЛЬЗЯ — «змейка» читается шлангом и роняет
// объект в игрушку (видно только на PBR-рендере). tube оставлен кабелям и рукавам.
// Соседние точки обязаны отличаться ровно по одной оси.
function pipe(pts, r, mat, seg) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ax = Math.abs(d[0]) > 1e-6 ? 'x' : Math.abs(d[1]) > 1e-6 ? 'y' : 'z';
    const len = Math.abs(d[0] || d[1] || d[2]);
    if (len < 1e-6) continue;
    out.push({ cyl: [r, len, (a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2, mat, ax, seg || 12] });
    if (i > 0) out.push({ sphere: [r * 1.14, a[0], a[1], a[2], mat, 10] });   // отвод 90°
  }
  return out;
}

// фланцевое соединение на трубе (пара «воротник + диск»)
function flanec(x, y, z, r, mat, ax) {
  return [{ cyl: [r * 1.62, r * 0.34, x, y, z, mat, ax || 'x', 16] }];
}

// опора трубопровода: стойка от пола + ложемент (хомут). Без опор трубы висят
// в воздухе — floaters.mjs это ловит, но честнее сразу рисовать, чем на чём держится.
function opora(x, y, z, r, mat, opt) {
  const o = opt || {}, y0 = o.floor != null ? o.floor : 0, w = o.w || 0.14;
  return [
    { box: [w, y - r - y0, w, x, (y0 + y - r) / 2, z, mat] },                  // стойка
    { box: [w * 2.4, 0.05, r * 2.6, x, y - r - 0.02, z, mat] },                // подушка
    { torus: [r * 1.12, 0.022, x, y, z, mat, o.ax === 'z' ? 'z' : 'x'] },      // хомут
  ];
}

// клиновая задвижка на трубе: корпус, крышка, шпиндель, маховик (или электропривод)
function zadvizhka(x, y, z, r, mat, ax, opt) {
  const o = opt || {}, up = o.up || 'y';
  const hy = up === 'y' ? y + r * 2.1 : y, hz = up === 'z' ? z + r * 2.1 : z;
  const out = [
    { cyl: [r * 1.5, r * 1.5, x, y, z, mat, ax || 'x', 14] },                  // корпус
    ...flanec(x - (ax === 'x' ? r * 0.95 : 0), y, z - (ax === 'z' ? r * 0.95 : 0), r, mat, ax),
    ...flanec(x + (ax === 'x' ? r * 0.95 : 0), y, z + (ax === 'z' ? r * 0.95 : 0), r, mat, ax),
    { frustum: [r * 0.95, r * 1.45, r * 0.8, x, y + r * 1.1, z, mat] },        // шейка под крышку
    { cyl: [r * 1.05, r * 0.22, x, y + r * 1.55, z, mat, 'y', 14] },           // крышка
    { cyl: [r * 0.16, r * 1.6, x, y + r * 2.2, z, mat, 'y', 8] },              // шпиндель
  ];
  if (o.privod) {                                                              // электропривод
    out.push({ cyl: [r * 0.62, r * 0.9, x, hy + r * 0.9, hz, mat, 'y', 14] },
             { box: [r * 1.5, r * 0.85, r * 1.0, x + r * 0.9, hy + r * 0.9, hz, mat] },
             { box: [r * 0.5, r * 0.4, r * 0.34, x, hy + r * 1.5, hz, mat + '-lamp'] });
  } else {
    out.push({ torus: [r * 1.15, r * 0.13, x, hy + r * 0.5, hz, mat, 'y'] },   // маховик
             { cyl: [r * 0.9, 0.03, x, hy + r * 0.5, hz, mat, 'y', 12] });     // диск маховика
  }
  return out;
}

// шаровой кран с рукояткой
function kran(x, y, z, r, mat, ax) {
  const h = ax === 'z' ? [0, 0, 0.16] : ax === 'y' ? [0.16, 0, 0] : [0.16, 0, 0];
  return [
    { cyl: [r * 1.45, r * 2.2, x, y, z, mat, ax || 'x', 12] },
    { cyl: [r * 0.3, r * 1.4, x, y + r * 1.5, z, mat, 'y', 8] },
    { box: [h[0] || r * 0.4, r * 0.3, h[2] || r * 0.4, x, y + r * 2.3, z, mat] },
  ];
}

// обратный клапан (корпус с характерной «шапкой»)
function obratnyi(x, y, z, r, mat, ax) {
  return [
    { cyl: [r * 1.4, r * 1.7, x, y, z, mat, ax || 'x', 14] },
    { frustum: [r * 0.7, r * 1.3, r * 0.9, x, y + r * 1.2, z, mat] },
    ...flanec(x - (ax === 'x' ? r * 1.0 : 0), y, z - (ax === 'z' ? r * 1.0 : 0), r, mat, ax),
    ...flanec(x + (ax === 'x' ? r * 1.0 : 0), y, z + (ax === 'z' ? r * 1.0 : 0), r, mat, ax),
  ];
}

// сильфонный компенсатор: гофр из колец на трубе
function kompensator(x, y, z, r, mat, ax, n) {
  const k = n || 6, st = r * 0.42, ax3 = ax || 'x';
  const step = ax3 === 'x' ? [st, 0, 0] : ax3 === 'z' ? [0, 0, st] : [0, st, 0];
  return [
    { at: [x - step[0] * (k - 1) / 2, y - step[1] * (k - 1) / 2, z - step[2] * (k - 1) / 2],
      repeat: k, step, items: [{ torus: [r * 1.22, r * 0.16, 0, 0, 0, mat, ax3] }] },
    { cyl: [r * 1.05, st * k, x, y, z, mat, ax3, 12] },
    ...flanec(x - (ax3 === 'x' ? st * k / 2 : 0), y, z - (ax3 === 'z' ? st * k / 2 : 0), r, mat, ax3),
    ...flanec(x + (ax3 === 'x' ? st * k / 2 : 0), y, z + (ax3 === 'z' ? st * k / 2 : 0), r, mat, ax3),
  ];
}

// Грязевик (шламоуловитель) — вертикальный сосуд с БОКОВЫМИ патрубками: вход и
// выход на разных отметках, снизу отстойник со спускным краном, сверху люк-ревизия
// и воздушник. Именно ревизия и дренаж делают его грязевиком, а не бочкой.
function gryazevik(x, y, z, r, mat, opt) {
  const o = opt || {}, h = o.h || r * 11, R = o.R || r * 2.2, ax = o.ax || 'x';
  const dx = ax === 'x' ? 1 : 0, dz = ax === 'z' ? 1 : 0;
  return [
    { cyl: [R, h, x, y, z, mat, 'y', 18] },                                    // корпус
    { frustum: [R * 0.35, R, R * 0.5, x, y - h / 2 - R * 0.25, z, mat] },      // конический отстойник
    { cyl: [R * 1.08, 0.05, x, y + h / 2, z, mat, 'y', 18] },                  // фланец крышки
    { at: [x, y + h / 2 + 0.03, z], repeat: 8, rstep: [0, 45, 0], items: [
      { cyl: [0.016, 0.07, R * 0.86, 0, 0, mat, 'y', 6] },                     // шпильки крышки
    ]},
    { cyl: [R * 0.5, 0.1, x, y + h / 2 + 0.09, z, mat, 'y', 14] },             // люк-ревизия
    { cyl: [r * 0.4, 0.22, x, y + h / 2 + 0.2, z, mat, 'y', 8] },              // воздушник
    { cyl: [r, 0.34, x + dx * (R + 0.17), y + h * 0.28, z + dz * (R + 0.17), mat, ax, 14] },
    ...flanec(x + dx * (R + 0.3), y + h * 0.28, z + dz * (R + 0.3), r, mat, ax),   // вход
    { cyl: [r, 0.34, x - dx * (R + 0.17), y - h * 0.06, z - dz * (R + 0.17), mat, ax, 14] },
    ...flanec(x - dx * (R + 0.3), y - h * 0.06, z - dz * (R + 0.3), r, mat, ax),   // выход
    { cyl: [r * 0.45, 0.2, x, y - h / 2 - R * 0.55, z, mat, 'y', 10] },        // спускной штуцер
    { box: [R * 2.2, 0.06, R * 0.6, x, y - h / 2 - R * 0.5, z, mat] },         // лапы-опоры
    { box: [0.1, y - h / 2 - R * 0.5 - (o.floor || 0), R * 0.5, x, ((o.floor || 0) + y - h / 2) / 2, z, mat] },
  ];
}

// Мембранный расширительный бак: корпус, купол, ниппель воздушной камеры,
// три опорные лапы, патрубок и отсечной кран — подводка в контур рисуется трассой.
function rasshiritel(x, z, mat, opt) {
  const o = opt || {}, r = o.r || 0.38, h = o.h || 1.3, y0 = o.floor || 0, lap = o.lap || 0.16;
  const yc = y0 + lap + h / 2;
  return [
    { cyl: [r, h, x, yc, z, mat, 'y', 18] },                                   // корпус
    { frustum: [r * 0.22, r, r * 0.45, x, y0 + lap + h + r * 0.2, z, mat] },   // купол
    { cyl: [r * 0.12, 0.09, x, y0 + lap + h + r * 0.46, z, mat, 'y', 8] },     // ниппель воздушной камеры
    { at: [x, y0 + lap / 2, z], repeat: 3, rstep: [0, 120, 0], items: [
      { box: [0.06, lap, r * 0.7, r * 0.72, 0, 0, mat] },                      // лапа
    ]},
    { cyl: [r * 0.14, lap * 0.9, x, y0 + lap * 0.5, z, mat, 'y', 10] },        // патрубок снизу
    { cyl: [r * 0.2, 0.1, x, y0 + 0.06, z, mat, 'y', 12] },                    // отсечной кран
  ];
}

// манометр на импульсной трубке с трёхходовым краном
function manometr(x, y, z, mat, ax) {
  return [
    { cyl: [0.012, 0.16, x, y + 0.08, z, mat, 'y', 8] },
    { box: [0.05, 0.05, 0.05, x, y + 0.18, z, mat] },
    { cyl: [0.055, 0.028, x, y + 0.26, z, mat, ax || 'z', 18] },
    { cyl: [0.048, 0.01, x, y + 0.26, z + (ax === 'x' ? 0 : 0.02), mat + '-lamp', ax || 'z', 18] },
  ];
}

// термопреобразователь в защитной гильзе
function gilza(x, y, z, mat) {
  return [
    { cyl: [0.02, 0.12, x, y + 0.06, z, mat, 'y', 10] },
    { cyl: [0.035, 0.07, x, y + 0.15, z, mat, 'y', 12] },
    { cyl: [0.017, 0.05, x, y + 0.21, z, mat, 'y', 8] },
  ];
}

// ── машины ───────────────────────────────────────────────────────────────────

// Консольный центробежный насос на раме: улитка со «спиралью», всасывающий и
// напорный патрубки с фланцами, кожух муфты, двигатель с рёбрами и клеммной
// коробкой, опорная рама с анкерами. dn — условный диаметр патрубка (м).
// Ось агрегата вдоль X (всасывание слева −X, напор вверх +Y), если ax не задан.
function nasos(x, y, z, mat, opt) {
  const o = opt || {}, dn = o.dn || 0.15, k = o.scale || 1;
  const bodyR = dn * 2.6 * k, mR = dn * 1.5 * k, mLen = dn * 4.2 * k;
  const fy = y;                                   // отметка оси насоса
  const frameH = o.frameH != null ? o.frameH : 0.22;
  const y0 = fy - bodyR - frameH;                 // низ рамы (пол/фундамент)
  const out = [
    // рама и виброопоры
    { box: [dn * 9 * k, frameH * 0.55, dn * 4.2 * k, x + dn * 1.2 * k, y0 + frameH * 0.3, z, mat + '-dark'] },
    { at: [x - dn * 2.4 * k, y0 + frameH * 0.05, z - dn * 1.7 * k], repeat: 2, step: [0, 0, dn * 3.4 * k], items: [
      { at: [0, 0, 0], repeat: 2, step: [dn * 7.2 * k, 0, 0], items: [
        { cyl: [dn * 0.34 * k, frameH * 0.22, 0, 0, 0, mat + '-dark', 'y', 8] },     // анкер
      ]},
    ]},
    // улитка: корпус + спиральный отвод
    { cyl: [bodyR, dn * 1.9 * k, x, fy, z, mat, 'x', 18] },
    { torus: [bodyR * 0.78, dn * 0.95 * k, x, fy, z, mat, 'x'] },
    { cyl: [bodyR * 0.62, dn * 0.5 * k, x - dn * 1.15 * k, fy, z, mat, 'x', 16] },   // крышка улитки
    // всасывающий патрубок (в торец) и напорный (вверх)
    { cyl: [dn * 0.62, dn * 1.5 * k, x - dn * 2.0 * k, fy, z, mat, 'x', 14] },
    ...flanec(x - dn * 2.7 * k, fy, z, dn * 0.62, mat, 'x'),
    { cyl: [dn * 0.55, bodyR * 1.5, x, fy + bodyR * 1.0, z, mat, 'y', 14] },
    ...flanec(x, fy + bodyR * 1.7, z, dn * 0.55, mat, 'y'),
    // кожух муфты + двигатель с рёбрами и клеммной коробкой
    { box: [dn * 1.5 * k, mR * 1.5, mR * 1.5, x + bodyR * 1.15, fy, z, mat + '-dark'] },
    { cyl: [mR, mLen, x + bodyR * 1.15 + dn * 0.75 * k + mLen / 2, fy, z, mat, 'x', 16] },
    { at: [x + bodyR * 1.15 + dn * 1.1 * k, fy, z], repeat: 6, step: [mLen / 6.5, 0, 0], items: [
      { torus: [mR * 1.06, mR * 0.05, 0, 0, 0, mat, 'x'] },                          // рёбра охлаждения
    ]},
    { cyl: [mR * 0.55, dn * 0.5 * k, x + bodyR * 1.15 + dn * 0.75 * k + mLen + dn * 0.2, fy, z, mat, 'x', 12] },
    { box: [mR * 0.9, mR * 0.6, mR * 0.75, x + bodyR * 1.15 + mLen * 0.45, fy + mR * 1.05, z, mat + '-dark'] },
    { cyl: [mR * 0.62, dn * 0.35 * k, x + bodyR * 1.15 + mLen * 1.02, fy, z, mat + '-dark', 'x', 12] },  // крыльчатка вентилятора
    // лапы двигателя до рамы
    { box: [mLen * 0.5, frameH * 0.7, mR * 1.7, x + bodyR * 1.15 + mLen * 0.5, y0 + frameH * 0.75, z, mat + '-dark'] },
  ];
  return out;
}

// Пластинчатый разборный теплообменник: неподвижная плита, пакет пластин,
// прижимная плита на стяжных шпильках, четыре патрубка на неподвижной плите.
// Шаг пластин НАМЕРЕННО крупнее натурного: у бокса рёбра 90°, четыре десятка
// пластин сливаются в светящееся пятно, которое не разбирает никакой hotAngle.
function pto(x, y, z, mat, opt) {
  const o = opt || {}, h = o.h || 1.8, w = o.w || 0.8, n = o.n || 14, st = o.st || 0.055;
  const packLen = n * st, yc = y + h / 2, x1 = x + 0.11 + packLen;
  const yHi = y + h * 0.78, yLo = y + h * 0.22, zo = w * 0.27, r = o.dn || 0.075;
  return [
    { box: [0.10, h, w, x, yc, z, mat] },                                      // неподвижная плита
    { at: [x + 0.09, yc, z], repeat: n, step: [st, 0, 0], items: [
      { box: [0.012, h - 0.12, w - 0.08, 0, 0, 0, mat + '-plate'] },
    ]},
    { box: [0.085, h, w, x1, yc, z, mat] },                                    // прижимная плита
    { at: [(x + x1) / 2, y + 0.09, z - w / 2 + 0.07], repeat: 2, step: [0, h - 0.18, 0], items: [
      { at: [0, 0, 0], repeat: 2, step: [0, 0, w - 0.14], items: [
        { cyl: [0.018, packLen + 0.3, 0, 0, 0, mat, 'x', 8] },                 // стяжная шпилька
      ]},
    ]},
    ...[[yHi, zo], [yLo, zo], [yHi, -zo], [yLo, -zo]].flatMap(([yy, dz]) => ([
      { cyl: [r, 0.2, x - 0.14, yy, z + dz, mat, 'x', 14] },
      ...flanec(x - 0.23, yy, z + dz, r, mat, 'x'),
    ])),
    { box: [0.12, y - (o.floor || 0), w * 0.8, x, ((o.floor || 0) + y) / 2, z, mat] },   // опоры
    { box: [0.12, y - (o.floor || 0), w * 0.8, x1, ((o.floor || 0) + y) / 2, z, mat] },
    { box: [0.16, 0.03, 0.11, x + 0.03, y + h + 0.02, z, mat + '-lamp'] },     // шильд
  ];
}

// Вертикальная ёмкость (бак-аккумулятор, РЧВ, фильтр): обечайка, днища,
// люк-лаз, штуцеры, наружная лестница-стремянка с ограждением.
function bak(x, y, z, mat, opt) {
  const o = opt || {}, r = o.r || 1.6, h = o.h || 4.0, y0 = o.floor != null ? o.floor : 0;
  const yc = y0 + h / 2;
  const out = [
    { cyl: [r, h, x, yc, z, mat, 'y', o.seg || 20] },                          // обечайка
    { frustum: [r * 0.14, r * 1.02, r * 0.42, x, y0 + h + r * 0.2, z, mat] },  // коническая крыша
    { cyl: [r * 1.06, 0.08, x, y0 + 0.04, z, mat, 'y', 20] },                  // днище на подкладном листе
    { at: [x, y0 + h * 0.28, z], repeat: 3, step: [0, h * 0.3, 0], items: [
      { torus: [r * 1.02, 0.035, 0, 0, 0, mat, 'y'] },                         // пояса жёсткости
    ]},
    { cyl: [0.26, 0.16, x + r * 0.55, y0 + h + r * 0.3, z, mat, 'y', 14] },    // люк-лаз
    { cyl: [0.09, 0.5, x - r * 0.6, y0 + h + r * 0.35, z, mat, 'y', 10] },     // вентиляционный патрубок
  ];
  if (o.ladder !== false) {                                                    // стремянка с дугами
    const lx = x - r - 0.12;
    out.push({ box: [0.05, h + 0.5, 0.05, lx, y0 + (h + 0.5) / 2, z - 0.22, mat] },
             { box: [0.05, h + 0.5, 0.05, lx, y0 + (h + 0.5) / 2, z + 0.22, mat] },
             { at: [lx, y0 + 0.35, z], repeat: Math.max(3, Math.round(h / 0.35)), step: [0, 0.35, 0], items: [
               { cyl: [0.018, 0.44, 0, 0, 0, mat, 'z', 6] },                   // ступень
             ]},
             { at: [lx - 0.34, y0 + h * 0.45, z], repeat: 4, step: [0, 0.5, 0], items: [
               { torus: [0.36, 0.02, 0, 0, 0, mat, 'x'] },                     // дуги ограждения
             ]});
  }
  return out;
}

// Шкаф (щит, ЧРП, КИПиА): корпус, дверь с ручкой и петлями, козырёк, шильд,
// цоколь. doors=2 — двустворчатый.
function shkaf(x, y, z, mat, opt) {
  const o = opt || {}, w = o.w || 0.8, h = o.h || 2.0, d = o.d || 0.4;
  const y0 = o.floor != null ? o.floor : 0, yc = y0 + h / 2 + 0.06;
  const doors = o.doors || 1, dw = w / doors;
  const out = [
    { box: [w, 0.12, d, x, y0 + 0.06, z, mat + '-dark'] },                     // цоколь
    { box: [w, h, d, x, yc, z, mat] },                                         // корпус
    { box: [w + 0.1, 0.05, d + 0.12, x, y0 + h + 0.085, z + 0.02, mat] },      // козырёк
    { at: [x - w / 2 + dw / 2, yc, z + d / 2 + 0.012], repeat: doors, step: [dw, 0, 0], items: [
      { box: [dw - 0.03, h - 0.1, 0.02, 0, 0, 0, mat + '-dark'] },             // полотно двери
      { box: [0.035, 0.16, 0.05, dw / 2 - 0.09, 0, 0.03, mat] },               // ручка-замок
      { at: [-dw / 2 + 0.03, h * 0.32, 0], repeat: 2, step: [0, -h * 0.64, 0], items: [
        { cyl: [0.016, 0.08, 0, 0, 0, mat, 'y', 8] },                          // петля
      ]},
    ]},
    { box: [w * 0.42, 0.09, 0.012, x, y0 + h - 0.16, z + d / 2 + 0.03, mat + '-lamp'] },  // шильд
  ];
  if (o.lamps !== false) {
    out.push({ at: [x - w * 0.22, y0 + h * 0.78, z + d / 2 + 0.03], repeat: 3, step: [w * 0.22, 0, 0], items: [
      { cyl: [0.022, 0.02, 0, 0, 0, mat + '-lamp', 'z', 10] },                 // сигнальные лампы
    ]});
  }
  return out;
}

// Распределительная гребёнка (коллектор): труба, эллиптические днища, опорные
// стойки, отводы вниз с фланцами. pts — X-координаты отводов.
function grebenka(x, y, z, r, len, mat, pts, opt) {
  const o = opt || {}, dir = o.down === false ? 1 : -1, dl = o.dl || 0.8, dr = o.dr || r * 0.42;
  const out = [
    { cyl: [r, len, x, y, z, mat, 'x', 18] },
    { sphere: [r, x - len / 2, y, z, mat, 14] },
    { sphere: [r, x + len / 2, y, z, mat, 14] },
  ];
  (o.stoyki !== false ? [-0.34, 0, 0.34] : []).forEach(s => {
    out.push({ box: [0.16, y - r - (o.floor || 0), 0.16, x + s * len, ((o.floor || 0) + y - r) / 2, z, mat] });
  });
  (pts || []).forEach(px => {
    out.push({ cyl: [dr, dl, px, y + dir * (r + dl / 2), z, mat, 'y', 12] });
    out.push(...flanec(px, y + dir * (r + dl * 0.92), z, dr, mat, 'y'));
  });
  return out;
}

// ── строительная часть ───────────────────────────────────────────────────────

// Каркас здания вместо одного box'а-«аквариума»: колонны по шагу, стропильные
// фермы (пояса + раскосы), прогоны, стеновые панели со швами, цоколь.
// Именно это отличает «здание» от стеклянной коробки: у оболочки появляется
// структура, и контурный пасс рисует не 12 рёбер, а конструктив.
function karkas(W, H, D, mat, opt) {
  const o = opt || {}, step = o.step || 6.0, matPanel = o.panel || mat, y0 = o.floor || 0;
  const nx = Math.max(2, Math.round(W / step) + 1), sx = W / (nx - 1);
  const col = o.col || 0.34, out = [];
  // фундаментная плита и цоколь
  out.push({ box: [W + 0.9, 0.5, D + 0.9, 0, y0 - 0.25, 0, mat + '-dark'] });
  out.push({ box: [W + 0.3, 0.55, D + 0.3, 0, y0 + 0.27, 0, mat] });
  // колонны по двум продольным осям + фермы поперёк
  for (let i = 0; i < nx; i++) {
    const cx = -W / 2 + i * sx;
    [-D / 2, D / 2].forEach(cz => {
      out.push({ box: [col, H, col, cx, y0 + H / 2, cz, mat] });               // колонна
      out.push({ box: [col * 1.5, 0.12, col * 1.5, cx, y0 + 0.06, cz, mat + '-dark'] });  // база колонны
    });
    // ферма: нижний пояс, верхний пояс со скатом, раскосы
    out.push({ box: [col * 0.8, 0.18, D, cx, y0 + H, 0, mat] });
    out.push({ box: [col * 0.7, 0.16, D * 0.52, cx, y0 + H + (o.rise || 0.5) * 0.5, -D * 0.24, mat], rot: [ -Math.atan2((o.rise || 0.5), D / 2) * 180 / Math.PI, 0, 0] });
    out.push({ box: [col * 0.7, 0.16, D * 0.52, cx, y0 + H + (o.rise || 0.5) * 0.5,  D * 0.24, mat], rot: [  Math.atan2((o.rise || 0.5), D / 2) * 180 / Math.PI, 0, 0] });
    out.push({ at: [cx, y0 + H + (o.rise || 0.5) * 0.28, -D * 0.3], repeat: 3, step: [0, 0, D * 0.3], items: [
      { box: [col * 0.5, (o.rise || 0.5) * 0.55, 0.1, 0, 0, 0, mat] },         // стойки фермы
    ]});
  }
  // продольные прогоны по фермам и связи по колоннам
  out.push({ at: [0, y0 + H + 0.12, -D * 0.4], repeat: 5, step: [0, 0, D * 0.2], items: [
    { box: [W, 0.1, 0.12, 0, 0, 0, mat] },                                     // прогон по фермам
  ]});
  out.push({ at: [0, y0 + H * 0.55, -D / 2], repeat: 2, step: [0, 0, D], items: [
    { box: [W, 0.12, 0.12, 0, 0, 0, mat] },                                    // распорка по колоннам
  ]});
  // Стеновое ограждение: СПЛОШНАЯ панель на стену (здание должно быть закрытым)
  // + вертикальные швы панелей по осям колонн и подкарнизный пояс. Ряды панелей
  // по высоте не набирать: их длинные горизонтальные рёбра дают в голограмме
  // «клетку» поверх оборудования, а одна плита стены стоит те же 12 рёбер.
  const Hw = H + (o.rise || 0.5) + 0.1;                                        // стена до настила кровли
  out.push({ box: [W + 0.16, Hw, 0.16, 0, y0 + Hw / 2, -D / 2 - 0.08, matPanel] },
           { box: [W + 0.16, Hw, 0.16, 0, y0 + Hw / 2,  D / 2 + 0.08, matPanel] },
           { box: [0.16, Hw, D + 0.16, -(W / 2 + 0.08), y0 + Hw / 2, 0, matPanel] },
           { box: [0.16, Hw, D + 0.16,  (W / 2 + 0.08), y0 + Hw / 2, 0, matPanel] });
  out.push({ box: [W + 0.34, 0.2, 0.2, 0, y0 + Hw - 0.1, -D / 2 - 0.1, matPanel] },
           { box: [W + 0.34, 0.2, 0.2, 0, y0 + Hw - 0.1,  D / 2 + 0.1, matPanel] },
           { box: [0.2, 0.2, D + 0.34, -(W / 2 + 0.1), y0 + Hw - 0.1, 0, matPanel] },
           { box: [0.2, 0.2, D + 0.34,  (W / 2 + 0.1), y0 + Hw - 0.1, 0, matPanel] });
  for (let i = 0; i < nx; i++) {                                               // швы панелей
    const cx = -W / 2 + i * sx;
    [-D / 2 - 0.17, D / 2 + 0.17].forEach(cz => out.push(
      { box: [0.1, Hw - 0.24, 0.06, cx, y0 + (Hw - 0.24) / 2, cz, matPanel] }));
  }
  const nz2 = Math.max(2, Math.round(D / step) + 1), sz2 = D / (nz2 - 1);
  for (let i = 0; i < nz2; i++) {
    const cz = -D / 2 + i * sz2;
    [-(W / 2 + 0.17), W / 2 + 0.17].forEach(cx => out.push(
      { box: [0.06, Hw - 0.24, 0.1, cx, y0 + (Hw - 0.24) / 2, cz, matPanel] }));
  }
  return out;
}

// Кровля: настил, парапет по периметру, аэраторы, воронки внутреннего водостока.
function krovlya(W, H, D, mat, opt) {
  const o = opt || {}, y0 = o.floor || 0, rise = o.rise != null ? o.rise : 0.5;
  const out = [
    { box: [W + 0.4, 0.1, D + 0.4, 0, y0 + H + rise + 0.05, 0, mat] },         // настил кровли
    { box: [W + 0.7, 0.5, 0.18, 0, y0 + H + rise + 0.42, -(D + 0.6) / 2, mat] },
    { box: [W + 0.7, 0.5, 0.18, 0, y0 + H + rise + 0.42,  (D + 0.6) / 2, mat] },
    { box: [0.18, 0.5, D + 0.7, -(W + 0.6) / 2, y0 + H + rise + 0.42, 0, mat] },
    { box: [0.18, 0.5, D + 0.7,  (W + 0.6) / 2, y0 + H + rise + 0.42, 0, mat] },
  ];
  const na = o.aeratory || 4;
  out.push({ at: [-W * 0.32, y0 + H + rise + 0.35, -D * 0.22], repeat: na, step: [W * 0.64 / Math.max(1, na - 1), 0, 0], items: [
    { cyl: [0.16, 0.5, 0, 0, 0, mat, 'y', 12] },                               // аэратор
    { cyl: [0.24, 0.06, 0, 0.3, 0, mat, 'y', 12] },                            // зонт
  ]});
  out.push({ at: [-W * 0.28, y0 + H + rise + 0.15, D * 0.26], repeat: 2, step: [W * 0.56, 0, 0], items: [
    { cyl: [0.2, 0.1, 0, 0, 0, mat, 'y', 12] },                                // воронка водостока
  ]});
  return out;
}

// Проём в стене, набранный ПАНЕЛЯМИ ВОКРУГ дыры (тёмная наклейка на сплошной
// стене читается как наклейка — проверено на кабине КамАЗа).
function proem(x, y, z, w, h, mat, opt) {
  const o = opt || {}, t = o.t || 0.18, fr = o.frame || 0.12, nz = o.z || 0.02;
  return [
    { box: [w + fr * 2, fr, t + nz, x, y + h / 2 + fr / 2, z, mat] },          // перемычка
    { box: [w + fr * 2, fr, t + nz, x, y - h / 2 - fr / 2, z, mat] },          // порог
    { box: [fr, h + fr * 2, t + nz, x - w / 2 - fr / 2, y, z, mat] },          // откосы
    { box: [fr, h + fr * 2, t + nz, x + w / 2 + fr / 2, y, z, mat] },
  ];
}

// Распашные ворота: рама-проём + два полотна с ребордами
function vorota(x, y, z, w, h, mat, opt) {
  const o = opt || {}, s = o.sign || 1;
  return [
    ...proem(x, y + h / 2, z, w, h, mat, o),
    { at: [x - w / 4, y + h / 2, z + s * 0.05], repeat: 2, step: [w / 2, 0, 0], items: [
      { box: [w / 2 - 0.04, h - 0.06, 0.07, 0, 0, 0, mat + '-dark'] },
      { at: [0, -h * 0.3, 0.05], repeat: 3, step: [0, h * 0.3, 0], items: [
        { box: [w / 2 - 0.12, 0.06, 0.03, 0, 0, 0, mat] },                     // реборда
      ]},
    ]},
  ];
}

// Ленточное окно / витраж: рама + импосты (стекло отдельным материалом -glass)
function okno(x, y, z, w, h, mat, opt) {
  const o = opt || {}, n = o.n || Math.max(2, Math.round(w / 1.6));
  return [
    ...proem(x, y, z, w, h, mat, o),
    { box: [w, h, 0.03, x, y, z, mat + '-glass'] },
    { at: [x - w / 2 + w / n, y, z + 0.03], repeat: Math.max(1, n - 1), step: [w / n, 0, 0], items: [
      { box: [0.06, h, 0.05, 0, 0, 0, mat] },                                  // импост
    ]},
  ];
}

// Площадка обслуживания: настил, ограждение (стойки + поручень + бортик), опоры.
function ploshchadka(x, y, z, w, d, mat, opt) {
  const o = opt || {}, y0 = o.floor != null ? o.floor : 0, np = Math.max(2, Math.round(w / 1.2));
  const out = [
    { box: [w, 0.08, d, x, y, z, mat] },                                       // настил
    { box: [w, 0.12, 0.04, x, y + 0.06, z - d / 2, mat] },                     // бортик
    { box: [w, 0.12, 0.04, x, y + 0.06, z + d / 2, mat] },
  ];
  [-1, 1].forEach(s => {
    if (o.open === (s > 0 ? 'front' : 'back')) return;
    out.push({ at: [x - w / 2, y + 0.55, z + s * d / 2], repeat: np, step: [w / (np - 1), 0, 0], items: [
      { box: [0.05, 1.1, 0.05, 0, 0, 0, mat] },                                // стойка ограждения
    ]});
    out.push({ box: [w, 0.05, 0.05, x, y + 1.1, z + s * d / 2, mat] },         // поручень
             { box: [w, 0.04, 0.04, x, y + 0.62, z + s * d / 2, mat] });       // промежуточный
  });
  (o.opory !== false ? [-0.4, 0.4] : []).forEach(f => {
    [-1, 1].forEach(s => out.push({ box: [0.1, y - y0, 0.1, x + f * w, y0 + (y - y0) / 2, z + s * d * 0.4, mat] }));
  });
  return out;
}

// Маршевая лестница со ступенями и перилами (подъём вдоль +X, поворот через rot).
function lestnica(x, y0, z, h, mat, opt) {
  const o = opt || {}, n = Math.max(3, Math.round(h / 0.19)), run = o.run || h * 0.85;
  const dx = run / n, dy = h / n, ang = Math.atan2(h, run) * 180 / Math.PI;
  const out = [
    { at: [x + dx / 2, y0 + dy, z], repeat: n, step: [dx, dy, 0], items: [
      { box: [dx * 0.95, 0.04, o.w || 0.9, 0, 0, 0, mat] },                    // ступень
    ]},
    { box: [Math.hypot(run, h), 0.12, 0.05, x + run / 2, y0 + h / 2, z - (o.w || 0.9) / 2, mat], rot: [0, 0, ang] },
    { box: [Math.hypot(run, h), 0.12, 0.05, x + run / 2, y0 + h / 2, z + (o.w || 0.9) / 2, mat], rot: [0, 0, ang] },
    { box: [Math.hypot(run, h), 0.05, 0.05, x + run / 2, y0 + h / 2 + 1.0, z - (o.w || 0.9) / 2, mat], rot: [0, 0, ang] },
    { box: [Math.hypot(run, h), 0.05, 0.05, x + run / 2, y0 + h / 2 + 1.0, z + (o.w || 0.9) / 2, mat], rot: [0, 0, ang] },
  ];
  const ns = Math.max(2, Math.round(run / 1.0));
  [-1, 1].forEach(s => out.push({ at: [x + run / (ns + 1), y0, z + s * (o.w || 0.9) / 2], repeat: ns, step: [run / (ns + 1), h / (ns + 1), 0], items: [
    { box: [0.05, 1.0, 0.05, 0, 0.5, 0, mat] },                                // стойка перил
  ]}));
  return out;
}

// Светильник промышленный под кровлей (даёт масштаб залу)
function svet(x, y, z, mat) {
  return [
    { cyl: [0.03, 0.35, x, y + 0.17, z, mat, 'y', 6] },                        // подвес
    { frustum: [0.3, 0.16, 0.22, x, y - 0.05, z, mat] },                       // отражатель
    { cyl: [0.15, 0.04, x, y - 0.17, z, mat + '-lamp', 'y', 12] },             // лампа
  ];
}

// bbox по элементам DSL — повторяет extents хелперов движка (для маркеров/потоков).
function measure(items) {
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const ext = (c, d) => { for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], c[i] - d[i]); max[i] = Math.max(max[i], c[i] + d[i]); } };
  const walk = (list, ox, oy, oz) => list.forEach(it => {
    if (Array.isArray(it.items)) {
      const at = it.at || [0, 0, 0], n = it.repeat || 1, st = it.step || [0, 0, 0];
      for (let i = 0; i < n; i++) walk(it.items, ox + at[0] + st[0] * i, oy + at[1] + st[1] * i, oz + at[2] + st[2] * i);
      return;
    }
    if (it.box) { const a = it.box; ext([ox + a[3], oy + a[4], oz + a[5]], [a[0] / 2, a[1] / 2, a[2] / 2]); }
    else if (it.cyl) { const a = it.cyl, r = a[0], h = a[1], ax = a[6] || 'y';
      ext([ox + a[2], oy + a[3], oz + a[4]], ax === 'x' ? [h / 2, r, r] : ax === 'z' ? [r, r, h / 2] : [r, h / 2, r]); }
    else if (it.frustum) { const a = it.frustum, R = Math.max(a[0], a[1]), ax = a[7] || 'y';
      ext([ox + a[3], oy + a[4], oz + a[5]], ax === 'x' ? [a[2] / 2, R, R] : ax === 'z' ? [R, R, a[2] / 2] : [R, a[2] / 2, R]); }
    else if (it.sphere) { const a = it.sphere; ext([ox + a[1], oy + a[2], oz + a[3]], [a[0], a[0], a[0]]); }
    else if (it.torus) { const a = it.torus, R = a[0] + a[1], ax = a[6] || 'y';
      ext([ox + a[2], oy + a[3], oz + a[4]], ax === 'x' ? [a[1], R, R] : ax === 'z' ? [R, R, a[1]] : [R, a[1], R]); }
    else if (it.capsule) { const a = it.capsule, r = a[0], h = a[1] + 2 * r, ax = a[6] || 'y';
      ext([ox + a[2], oy + a[3], oz + a[4]], ax === 'x' ? [h / 2, r, r] : ax === 'z' ? [r, r, h / 2] : [r, h / 2, r]); }
    else if (it.tube) { const a = it.tube; a[1].forEach(p => ext([ox + p[0], oy + p[1], oz + p[2]], [a[0], a[0], a[0]])); }
  });
  walk(items, 0, 0, 0);
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return { min, max, size, frac: p => [
    +((p[0] - min[0]) / size[0]).toFixed(3),
    +((p[1] - min[1]) / size[1]).toFixed(3),
    +((p[2] - min[2]) / size[2]).toFixed(3)] };
}

module.exports = {
  pipe, flanec, opora, zadvizhka, kran, obratnyi, kompensator, gryazevik, manometr, gilza,
  nasos, pto, bak, shkaf, grebenka, rasshiritel,
  karkas, krovlya, proem, vorota, okno, ploshchadka, lestnica, svet,
  measure,
};
