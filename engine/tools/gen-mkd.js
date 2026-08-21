// Генератор configs/mkd.json и configs/mkd-121.json — жилой дом.
//
//   node tools/gen-mkd.js            # оба конфига
//   node tools/gen-mkd.js mkd-121    # только один
//
// Дом ОСТАЁТСЯ параметрическим (поле building{}): план этажа и разрез фасада
// (50-plans.js) питаются planRooms, а их заполняет только ветка МКД в движке.
// Но всё, что ниже отметки 0, описано здесь ДЕКЛАРАТИВНО — движок складывает
// building{} и geometry[] (10-generators.js). Так подвал попадает под линтеры
// blueprint / floaters / flowcheck, которые читают config.geometry.
//
// Зачем подвал: в жилом доме именно там вся инженерия — вводы ХВС и теплосети,
// общедомовые узлы учёта, элеваторный узел, распределительные магистрали с
// подводками к стоякам, канализационные лежаки и выпуски, ВРУ. Раньше маркер
// №3 обещал «техническое подполье с разводкой коммуникаций», а под домом не
// было ничего: дом стоял на плите.
//
// Система координат: X — длина дома, Y — высота (0 = пол первого этажа),
// Z — глубина (лицевой фасад +Z, тыльный −Z). Подвал: пол −2.9, потолок −0.55.
const fs = require('fs');
const path = require('path');
const THREE = require('three');
const P = require('./lib/plant-kit');
const { pipe, flanec, zadvizhka, kran, obratnyi, gryazevik, manometr, gilza, shkaf, svet } = P;

// ---- параметры домов ---------------------------------------------------------
const HOUSES = {
  'mkd': {
    building: { type: 'mkd', floors: 9, floorHeight: 3.0, sections: 3, sectionWidth: 7.0,
                depth: 12.0, windowsPerSection: 3, risers: ['water', 'heat', 'sewer', 'electric'] },
    title: 'Жилой дом (МКД)',
    category: 'ЖКХ · ЖИЛОЙ ФОНД',
    thumbLabel: 'ГОЛОГРАММА · ЗДАНИЕ',
    counter: 'ЖИЛОЙ ДОМ · 6 СИСТЕМ',
    subtitle: 'Многоквартирный жилой дом: несущие конструкции, фасад с лоджиями, входные группы, кровля, инженерные стояки и подвал с вводами, узлами учёта и разводкой.',
    overviewTitle: 'Многоквартирный дом',
    overviewDesc: '9-этажный 3-секционный жилой дом. Всё, чем дом подключён к городу, собрано в подвале: вводы ХВС и теплосети, общедомовые счётчики, элеваторный узел, магистрали с подводками к стоякам и канализационные выпуски. Выберите систему справа или узел на модели; «Разобрать» — разнести дом на 6 систем, «План этажа» и «Разрез фасада» — заглянуть внутрь.',
    specs: [
      ['Тип', 'Многоквартирный жилой дом'],
      ['Этажность', '9'],
      ['Подъездов', '3'],
      ['Квартир', '≈ 108'],
      ['Высота этажа, м', '3.0'],
      ['Конструктив', 'Крупнопанельный'],
      ['Кровля', 'Плоская, рулонная'],
      ['Подвал', 'Технический, высота 2.35 м'],
      ['Отопление', 'Центральное, элеваторный узел'],
      ['Водоснабжение', 'ХВС + ГВС, ОДПУ на вводе'],
      ['Водоотведение', 'Лежаки и выпуски в колодцы'],
      ['Лифт', 'Пассажирский'],
    ],
  },
  'mkd-121': {
    building: { type: 'mkd', floors: 9, floorHeight: 2.75, sections: 3, sectionWidth: 21.0,
                depth: 12.0, windowsPerSection: 7, risers: ['water', 'heat', 'sewer', 'electric', 'trash'] },
    title: 'Панельная 9-этажка (серия 121)',
    category: 'ЖКХ · ЖИЛОЙ ФОНД · СЕРИЯ 111-121',
    thumbLabel: 'СЕРИЯ 121 · 9 ЭТАЖЕЙ',
    counter: 'СЕРИЯ 121 · 8 СИСТЕМ',
    subtitle: 'Крупнопанельный 9-этажный жилой дом серии 111-121 (типовой проект 121-014/1.2): несущий остов, фасад с лоджиями, подъезды, кровля, инженерные стояки, планировки квартир и подвал с вводами и разводкой.',
    overviewTitle: 'Панельная девятиэтажка',
    overviewDesc: 'Три блок-секции серии 111-121: поперечные несущие панели, четыре квартиры на этаже, стояки в санитарных кабинах. В подвале — вводы ХВС и теплосети, общедомовые узлы учёта, элеваторный узел и магистрали с подводками к стоякам. «План этажа» показывает состав 1Б-2Б-3Б-3Б, «Разрез фасада» — квартиры в объёме.',
    specs: [
      ['Серия', '111-121 (121-014/1.2)'],
      ['Этажность', '9'],
      ['Блок-секций', '3'],
      ['Квартир на этаже', '4 (1Б, 2Б, 3Б, 3Б)'],
      ['Высота этажа, м', '2.75'],
      ['Конструктив', 'Крупнопанельный, поперечные стены'],
      ['Шаг несущих стен, м', '2.6 / 3.2'],
      ['Кровля', 'Плоская, рулонная'],
      ['Подвал', 'Технический, высота 2.35 м'],
      ['Отопление', 'Центральное, элеваторный узел'],
      ['Водоснабжение', 'ХВС + ГВС, ОДПУ на вводе'],
      ['Мусоропровод', 'В каждой блок-секции'],
    ],
  },
};

// ---- подвал: отметки и оси ---------------------------------------------------
const yFloor = -2.90;                 // пол подвала
const yCeil = -0.55;                  // низ перекрытия над подвалом
const rHeat = 0.032;                  // DN65 — магистрали отопления
const rHvs = 0.027;                   // DN50 — ХВС
const rGvs = 0.022;                   // DN40 — ГВС и циркуляция
const rKan = 0.055;                   // DN110 — канализационный лежак
const rOut = 0.080;                   // DN160 — выпуск в колодец

function basement(b) {
  const sections = b.sections, sw = b.sectionWidth, D = b.depth;
  const W = sections * sw, risers = b.risers;
  const zMain = -D * 0.30;            // ось магистралей отопления (у тыльной стены)
  const zWat = -D * 0.30 + 0.42;      // ось водяных магистралей
  const zRis = -D * 0.16;             // ось стояков — та же, что у движка
  const zKan = -D * 0.16 + 0.55;      // ось канализационного лежака
  const yT1 = -0.95, yT2 = -1.25;     // подающая и обратная магистрали отопления
  const yW = -1.62, yG = -1.90, yGc = -2.10;
  const yK = -2.42;
  const xIn = -W / 2 + 2.4;           // ось вводов (первая секция)
  const g = [];

  // ── строительная часть: подошва, стены, пол, перекрытие, перегородки секций
  g.push({ box: [W + 0.9, 0.35, D + 0.9, 0, yFloor - 0.32, 0, 'podval-dark'] });         // фундаментная плита
  g.push({ box: [W, 0.14, D, 0, yFloor - 0.07, 0, 'podval'] });                          // бетонный пол
  g.push({ box: [W + 0.8, 2.6, 0.4, 0, (yFloor + yCeil) / 2, -D / 2 - 0.2, 'podval'] },  // стены подвала
          { box: [W + 0.8, 2.6, 0.4, 0, (yFloor + yCeil) / 2, D / 2 + 0.2, 'podval'] },
          { box: [0.4, 2.6, D + 0.8, -W / 2 - 0.2, (yFloor + yCeil) / 2, 0, 'podval'] },
          { box: [0.4, 2.6, D + 0.8, W / 2 + 0.2, (yFloor + yCeil) / 2, 0, 'podval'] });
  g.push({ box: [W + 0.4, 0.3, D + 0.4, 0, yCeil - 0.15, 0, 'podval'] });                // перекрытие над подвалом
  // межсекционные стены подвала с проходами
  for (let s = 1; s < sections; s++) {
    const px = -W / 2 + s * sw;
    g.push({ box: [0.3, 2.35, D, px, (yFloor + yCeil) / 2, 0, 'podval'] });
    g.push({ box: [0.34, 2.0, 0.9, px, yFloor + 1.0, zRis - 1.6, 'podval-dark'] });      // проём прохода
  }
  // столбы-опоры под несущими стенами и приямок с дренажным насосом
  for (let x = -W / 2 + sw / 2; x < W / 2; x += sw / 2) {
    g.push({ box: [0.34, 2.35, 0.34, x, (yFloor + yCeil) / 2, D * 0.22, 'podval'] });
  }
  g.push({ box: [1.2, 0.5, 1.2, xIn + 1.0, yFloor - 0.2, D * 0.30, 'podval-dark'] },     // приямок
          { cyl: [0.11, 0.42, xIn + 1.0, yFloor - 0.1, D * 0.30, 'vru', 'y', 12] },      // дренажный насос
          { cyl: [0.035, 1.9, xIn + 1.0, yFloor + 0.9, D * 0.30, 'vru', 'y', 8] });      // напорный шланг
  // светильники под перекрытием
  for (let x = -W / 2 + sw / 2; x <= W / 2; x += sw) g.push(...svet(x, yCeil - 0.32, zRis + 1.4, 'podval'));

  // ── ввод ХВС и общедомовой узел учёта (ОДПУ) с опломбированной обводной
  g.push({ cyl: [rHvs * 3.2, 0.6, -W / 2 - 0.45, yW, zWat, 'hvs', 'x', 14] });          // гильза в стене
  g.push(...pipe([[-W / 2 - 0.7, yW, zWat], [xIn + 3.4, yW, zWat]], rHvs, 'hvs'));
  g.push(...zadvizhka(-W / 2 + 0.75, yW, zWat, rHvs, 'hvs', 'x'));
  g.push({ cyl: [rHvs * 1.7, 0.30, xIn - 1.2, yW, zWat, 'hvs', 'x', 14] },              // фильтр
          { frustum: [rHvs * 0.9, rHvs * 1.7, 0.24, xIn - 1.2, yW - 0.18, zWat, 'hvs'] });
  g.push({ cyl: [rHvs * 1.5, 0.36, xIn, yW, zWat, 'hvs', 'x', 16] },                    // счётчик ОДПУ
          { box: [0.13, 0.11, 0.14, xIn, yW + 0.17, zWat, 'hvs-dark'] },
          { box: [0.09, 0.055, 0.012, xIn, yW + 0.19, zWat + 0.08, 'hvs-lamp'] },
          { cyl: [0.022, 0.05, xIn + 0.12, yW + 0.10, zWat, 'hvs-lamp', 'y', 8] });     // пломба
  g.push(...flanec(xIn - 0.22, yW, zWat, rHvs, 'hvs', 'x'), ...flanec(xIn + 0.22, yW, zWat, rHvs, 'hvs', 'x'));
  g.push(...obratnyi(xIn + 0.9, yW, zWat, rHvs, 'hvs', 'x'));
  g.push(...manometr(xIn - 1.7, yW + rHvs, zWat, 'hvs'), ...manometr(xIn + 1.5, yW + rHvs, zWat, 'hvs'));
  // обводная линия с опломбированной задвижкой — П-образная рамка вокруг счётчика
  g.push(...pipe([[xIn - 1.7, yW, zWat], [xIn - 1.7, yW + 0.42, zWat],
                  [xIn + 1.5, yW + 0.42, zWat], [xIn + 1.5, yW, zWat]], rHvs * 0.8, 'hvs'));
  g.push(...zadvizhka(xIn - 0.1, yW + 0.42, zWat, rHvs * 0.8, 'hvs', 'x'));
  // магистраль ХВС вдоль дома с подводками к стоякам «water»
  g.push(...pipe([[xIn + 3.4, yW, zWat], [W / 2 - 1.0, yW, zWat]], rHvs, 'hvs'));
  // ── ГВС: подача и циркуляция (от теплового узла в сторону стояков)
  g.push(...pipe([[xIn + 4.2, yG, zWat], [W / 2 - 1.0, yG, zWat]], rGvs, 'hvs'));
  g.push(...pipe([[xIn + 4.2, yGc, zWat], [W / 2 - 1.0, yGc, zWat]], rGvs, 'hvs'));
  g.push({ cyl: [rGvs * 1.6, 0.26, xIn + 5.2, yGc, zWat, 'hvs', 'x', 14] });            // счётчик циркуляции

  // ── ввод теплосети, узел учёта тепла и ЭЛЕВАТОРНЫЙ узел
  const xEl = xIn + 3.6;
  g.push({ cyl: [rHeat * 3.0, 0.6, -W / 2 - 0.45, yT1, zMain, 'teplo', 'x', 14] },       // гильзы вводов
          { cyl: [rHeat * 3.0, 0.6, -W / 2 - 0.45, yT2, zMain, 'teplo', 'x', 14] });
  g.push(...pipe([[-W / 2 - 0.7, yT1, zMain], [xEl - 0.55, yT1, zMain]], rHeat, 'teplo'));
  g.push(...pipe([[-W / 2 - 0.7, yT2, zMain], [xEl + 0.75, yT2, zMain]], rHeat, 'teplo'));
  g.push(...zadvizhka(-W / 2 + 0.75, yT1, zMain, rHeat, 'teplo', 'x'));
  g.push(...zadvizhka(-W / 2 + 0.75, yT2, zMain, rHeat, 'teplo', 'x'));
  g.push(...gryazevik(-W / 2 + 1.9, yT1 - 0.12, zMain, rHeat, 'teplo', { h: 0.55, R: 0.16 }));
  g.push(...gryazevik(-W / 2 + 1.9, yT2 - 0.12, zMain - 0.55, rHeat, 'teplo', { h: 0.5, R: 0.15 }));
  // узел учёта тепла: расходомеры на подаче и обратке, гильзы, тепловычислитель
  g.push({ cyl: [rHeat * 1.5, 0.30, xIn + 1.4, yT1, zMain, 'teplo', 'x', 16] },
          { cyl: [rHeat * 1.5, 0.30, xIn + 1.4, yT2, zMain, 'teplo', 'x', 16] },
          { box: [0.14, 0.16, 0.13, xIn + 1.4, yT1 + 0.20, zMain, 'teplo-dark'] },
          { box: [0.14, 0.16, 0.13, xIn + 1.4, yT2 + 0.20, zMain, 'teplo-dark'] });
  g.push(...gilza(xIn + 2.0, yT1 + rHeat, zMain, 'teplo'), ...gilza(xIn + 2.0, yT2 + rHeat, zMain, 'teplo'));
  g.push({ box: [0.08, 0.9, 0.08, xIn + 2.6, yT2 - 0.62, zMain - 0.2, 'teplo'] },        // стойка вычислителя
          { box: [0.30, 0.24, 0.15, xIn + 2.6, yT2 - 0.10, zMain - 0.2, 'teplo-dark'] },
          { box: [0.19, 0.11, 0.012, xIn + 2.6, yT2 - 0.07, zMain - 0.13, 'teplo-lamp'] });
  // элеватор: конус смешения с соплом, фланцы, подводка обратки в горловину
  g.push({ cyl: [rHeat * 1.35, 0.44, xEl, yT1, zMain, 'teplo', 'x', 16] },               // корпус элеватора
          { frustum: [rHeat * 1.35, rHeat * 2.4, 0.26, xEl - 0.34, yT1, zMain, 'teplo', 'x'] },
          { frustum: [rHeat * 2.4, rHeat * 1.05, 0.34, xEl + 0.38, yT1, zMain, 'teplo', 'x'] },
          { cyl: [rHeat * 0.55, 0.16, xEl - 0.20, yT1, zMain, 'teplo-dark', 'x', 12] },  // сопло
          { box: [0.10, 0.12, 0.10, xEl - 0.20, yT1 + 0.16, zMain, 'teplo-dark'] },      // регулировка сопла
          ...flanec(xEl - 0.50, yT1, zMain, rHeat, 'teplo', 'x'),
          ...flanec(xEl + 0.58, yT1, zMain, rHeat, 'teplo', 'x'));
  g.push(...pipe([[xEl + 0.75, yT2, zMain], [xEl, yT2, zMain], [xEl, yT1 - 0.12, zMain]], rHeat * 0.8, 'teplo'));
  g.push(...manometr(xEl - 0.75, yT1 + rHeat, zMain, 'teplo'), ...manometr(xEl + 0.9, yT1 + rHeat, zMain, 'teplo'));
  g.push(...kran(xEl + 0.3, yT1 - 0.34, zMain, rHeat * 0.5, 'teplo', 'y'));              // спускник
  // распределительные магистрали отопления вдоль дома
  g.push(...pipe([[xEl + 0.9, yT1, zMain], [W / 2 - 1.0, yT1, zMain]], rHeat, 'teplo'));
  g.push(...pipe([[xEl + 1.6, yT2, zMain], [W / 2 - 1.0, yT2, zMain]], rHeat, 'teplo'));
  // подвесы магистралей к перекрытию (иначе трубы висят в воздухе)
  for (let x = -W / 2 + 2.0; x < W / 2 - 1.0; x += 3.2) {
    g.push({ box: [0.06, yCeil - 0.3 - yT1, 0.06, x, (yCeil - 0.3 + yT1) / 2, zMain, 'teplo'] },
            { box: [0.34, 0.05, 0.06, x, yT1 - rHeat - 0.03, zMain, 'teplo'] },
            { box: [0.06, yCeil - 0.3 - yW, 0.06, x + 1.1, (yCeil - 0.3 + yW) / 2, zWat, 'hvs'] },
            { box: [0.30, 0.05, 0.06, x + 1.1, yW - rHvs - 0.03, zWat, 'hvs'] });
  }

  // ── подводки к стоякам: у каждого стояка свой набор
  const n = risers.length;
  risers.forEach((sys, i) => {
    const x = -W / 2 + (i + 1) * W / (n + 1);
    if (sys === 'water') {
      g.push(...pipe([[x, yW, zWat], [x, yW + 0.3, zWat], [x, yW + 0.3, zRis], [x, yCeil - 0.05, zRis]], rHvs, 'hvs'));
      g.push(...zadvizhka(x, yW + 0.3, zRis + 0.5, rHvs, 'hvs', 'z'));
      g.push(...pipe([[x + 0.34, yG, zWat], [x + 0.34, yG + 0.25, zWat], [x + 0.34, yG + 0.25, zRis],
                      [x + 0.34, yCeil - 0.05, zRis]], rGvs, 'hvs'));
    } else if (sys === 'heat') {
      g.push(...pipe([[x, yT1, zMain], [x, yT1 + 0.18, zMain], [x, yT1 + 0.18, zRis], [x, yCeil - 0.05, zRis]], rHeat * 0.8, 'teplo'));
      g.push(...pipe([[x + 0.36, yT2, zMain], [x + 0.36, yT2 + 0.2, zMain], [x + 0.36, yT2 + 0.2, zRis],
                      [x + 0.36, yCeil - 0.05, zRis]], rHeat * 0.8, 'teplo'));
      g.push(...kran(x, yT1 + 0.18, zMain + 0.5, rHeat * 0.6, 'teplo', 'z'));
      g.push(...kran(x + 0.36, yT2 + 0.2, zMain + 0.5, rHeat * 0.6, 'teplo', 'z'));
    } else if (sys === 'sewer') {
      g.push(...pipe([[x, yCeil - 0.05, zRis], [x, yK + 0.28, zRis], [x, yK + 0.28, zKan], [x, yK, zKan]], rKan, 'kanal'));
      g.push({ cyl: [rKan * 1.5, 0.16, x, yK + 0.55, zRis, 'kanal-dark', 'y', 14] });    // ревизия на стояке
    } else if (sys === 'electric') {
      g.push(...pipe([[x, yCeil - 0.35, zRis], [x, yCeil - 0.35, zRis + 0.9]], 0.035, 'vru'));
    }
  });

  // ── канализация: лежак с уклоном, ревизии, выпуски в колодцы
  g.push(...pipe([[-W / 2 + 1.0, yK, zKan], [W / 2 - 1.0, yK - 0.12, zKan]].map((p, i) => i ? [p[0], yK, zKan] : p), rKan, 'kanal'));
  for (let s = 0; s < sections; s++) {
    const cx = -W / 2 + (s + 0.5) * sw;
    g.push({ cyl: [rKan * 1.6, 0.18, cx, yK, zKan, 'kanal-dark', 'x', 14] });            // ревизия на лежаке
    g.push({ box: [0.28, 0.05, 0.22, cx, yK - rKan - 0.03, zKan, 'kanal'] },             // опора лежака
            { box: [0.08, yK - rKan - yFloor, 0.08, cx, (yFloor + yK) / 2, zKan, 'kanal'] });
    // выпуск через стену подвала в дворовый колодец
    g.push(...pipe([[cx, yK, zKan], [cx, yK - 0.25, zKan], [cx, yK - 0.25, D / 2 + 1.1]], rOut, 'kanal'));
    g.push({ cyl: [rOut * 2.6, 0.6, cx, yK - 0.25, D / 2 + 0.2, 'kanal', 'z', 14] });    // гильза в стене
    // колодец выведен ЛЮКОМ НА ОТМЕТКУ ЗЕМЛИ (0): иначе он читается бочкой,
    // подвешенной сбоку от дома, а не колодцем во дворе
    g.push({ cyl: [0.62, Math.abs(yK - 0.9) + 0.05, cx, (yK - 0.9 - 0.05) / 2, D / 2 + 1.5, 'kanal', 'y', 16] },
            { cyl: [0.70, 0.12, cx, -0.06, D / 2 + 1.5, 'kanal-dark', 'y', 16] },        // горловина
            { cyl: [0.34, 0.07, cx, 0.03, D / 2 + 1.5, 'kanal-dark', 'y', 14] });        // люк
  }

  // ── ВРУ: ввод кабеля, вводной шкаф со счётчиком, кабельные лотки
  const xVru = -W / 2 + 1.3, zVru = D * 0.26;
  g.push(...shkaf(xVru, yFloor, zVru, 'vru', { w: 1.0, h: 1.9, d: 0.34, doors: 2, floor: yFloor }));
  g.push({ box: [0.6, 0.5, 0.28, xVru + 0.9, yFloor + 1.1, zVru, 'vru'] },               // шкаф учёта
          { box: [0.3, 0.16, 0.014, xVru + 0.9, yFloor + 1.18, zVru + 0.15, 'vru-lamp'] });
  g.push({ cyl: [0.09, 0.7, -W / 2 - 0.5, yFloor + 0.6, zVru, 'vru', 'x', 12] });        // гильза ввода кабеля
  g.push({ tube: [0.028, [[-W / 2 - 0.7, yFloor + 0.6, zVru], [-W / 2 + 0.4, yFloor + 0.55, zVru],
                          [xVru - 0.45, yFloor + 0.5, zVru]], 'vru', 10] });             // кабель ввода
  g.push({ box: [W - 2.2, 0.06, 0.22, 0.4, yCeil - 0.35, zVru, 'vru-dark'] });           // магистральный лоток
  g.push({ box: [0.22, 0.06, Math.abs(zVru - (zRis + 0.9)) , xVru + 1.6, yCeil - 0.35, (zVru + zRis + 0.9) / 2, 'vru-dark'] });
  g.push({ box: [0.08, yCeil - 0.35 - (yFloor + 1.9), 0.08, xVru + 0.5, (yCeil - 0.35 + yFloor + 1.9) / 2, zVru, 'vru'] });
  return g;
}

// ---- сборка конфига ----------------------------------------------------------
// bbox считаем ТЕМ ЖЕ движком, что будет строить модель: параметрический дом
// плюс декларативный подвал. Аналитически повторять формулы фасада бессмысленно —
// они живут в 10-generators.js и меняются.
const genSrc = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'modules', '10-generators.js'), 'utf8');
const Gen = new Function('THREE', `return class G {\n${genSrc}\n}`)(THREE);

function modelBBox(config) {
  const g = new Gen();
  g.CONFIG = config; g.meshData = [];
  g.buildProceduralModel(THREE);
  const box = new THREE.Box3(), tmp = new THREE.Box3();
  g.meshData.forEach(md => {
    if (!md.geometry.boundingBox) md.geometry.computeBoundingBox();
    tmp.copy(md.geometry.boundingBox).applyMatrix4(md.matrixWorld);
    box.union(tmp);
  });
  return { min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z],
           size: [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z],
           count: g.meshData.length };
}

function build(id) {
  const h = HOUSES[id], b = h.building;
  const sections = b.sections, sw = b.sectionWidth, D = b.depth, W = sections * sw;
  const H = b.floors * b.floorHeight;
  const zRis = -D * 0.16, zMain = -D * 0.30, zWat = zMain + 0.42, zKan = zRis + 0.55;
  const xIn = -W / 2 + 2.4, xEl = xIn + 3.6;
  const yT1 = -0.95, yT2 = -1.25, yW = -1.62, yK = -2.42;
  const n = b.risers.length;
  const risX = s => -W / 2 + (b.risers.indexOf(s) + 1) * W / (n + 1);

  const geometry = basement(b);
  const parts = [
    { key: 'konstr', name: 'Несущие конструкции', tag: 'ОСТОВ',
      desc: id === 'mkd-121'
        ? 'Наружные ж/б панели 250–400 мм с межпанельными швами, поперечные несущие стены (шаг 2.6/3.2 м), сплошные плиты перекрытий 100/160 мм, цоколь и коробка подвала.'
        : 'Наружные стены с межпанельными швами, межсекционные стены, междуэтажные перекрытия, карниз, цоколь с отливом и коробка подвала: плита, стены, пол, перекрытие.' },
    { key: 'facade', name: id === 'mkd-121' ? 'Фасад, окна, лоджии' : 'Фасад и окна', tag: 'ОГРАЖДАЮЩИЕ КОНСТРУКЦИИ',
      desc: 'Оконные проёмы с коробками, импостами и отливами; лоджии с ограждениями и поручнями на лицевом фасаде.' },
    { key: 'entrance', name: id === 'mkd-121' ? 'Подъезды (входы)' : 'Входные группы', tag: 'ВХОДНЫЕ ГРУППЫ',
      desc: 'По одному входу на секцию: крыльцо со ступенями, пандус с поручнями, козырёк на кронштейнах, светильник, домофон и номер дома.' },
    { key: 'roof', name: id === 'mkd-121' ? 'Кровля и тех. этаж' : 'Кровля', tag: 'ПОКРЫТИЕ',
      desc: 'Плоская рулонная кровля с парапетом и ограждением: машинные помещения лифтов, вентшахты, выходы на кровлю, молниеприёмники и водосточные трубы.' },
    { key: 'systems', name: 'Инженерные стояки', tag: 'СТОЯКИ',
      desc: id === 'mkd-121'
        ? 'Стояки ХВС/ГВС, отопления, канализации, электроснабжения и мусоропровод — на каждую секцию; из подвала до кровли.'
        : 'Вертикальные стояки водоснабжения, отопления, канализации и электроснабжения — от разводки в подвале до фановых вытяжек на кровле.' },
    { key: 'podval', name: 'Подвал: вводы и разводка', tag: 'ТЕХНИЧЕСКОЕ ПОДПОЛЬЕ',
      desc: 'Всё, чем дом подключён к городу: вводы ХВС и теплосети в гильзах, общедомовые узлы учёта воды и тепла, элеваторный узел, распределительные магистрали с подводками к стоякам, канализационные лежаки с ревизиями и выпусками в колодцы, ВРУ с кабельными лотками, дренажный приямок.' },
  ];
  const matRules = [
    { match: ['window', 'balcony'], part: 1 },
    { match: ['entrance'], part: 2 },
    { match: ['roof'], part: 3 },
    { match: b.risers.slice(), part: 4 },
    // Бетон подвала (podval*) правилам НЕ подчиняется и уходит в «Несущие
    // конструкции»: подвал светится янтарём как ИНЖЕНЕРИЯ, а его коробка
    // остаётся конструктивом — так честнее и читается лучше.
    { match: ['hvs', 'teplo', 'kanal', 'vru'], part: 5 },
  ];
  if (id === 'mkd-121') {
    parts.push({ key: 'core', name: 'Лестнично-лифтовой узел', tag: 'ВЕРТИКАЛЬНЫЕ КОММУНИКАЦИИ',
                 desc: 'Лестничная клетка, пассажирский лифт и шахта мусоропровода в центре каждой блок-секции.' },
               { key: 'interior', name: 'Планировки квартир', tag: 'ВНУТРЕННИЕ СТЕНЫ',
                 desc: 'Внутренние перегородки квартир: на этаже блок-секции — четыре квартиры (1Б, 2Б и две 3Б). Нажмите «План этажа» для вида сверху с подписями комнат.' });
    matRules.push({ match: ['core'], part: 6 }, { match: ['partition'], part: 7 });
  }

  const markersM = [
    [1, 'Входная группа', [-W / 2 + sw * 0.5, 1.2, D / 2 + 1.4],
     'Вход в подъезд: крыльцо со ступенями и пандусом, козырёк на кронштейнах, домофон.'],
    [2, 'Кровля и тех. этаж', [0, H + 1.8, -D * 0.2],
     'Плоская рулонная кровля с ограждением, машинное помещение лифта, вентшахты и выход на крышу.'],
    [3, 'Подвал (тех. подполье)', [0, -1.9, D * 0.1],
     'Технический подвал высотой 2,35 м: здесь проходят все вводы, узлы учёта и магистрали разводки.'],
    [4, 'Ввод ХВС и ОДПУ', [xIn, yW + 0.25, zWat],
     'Ввод холодной воды в гильзе: задвижка, фильтр, общедомовой счётчик с прямыми участками и опломбированной обводной, обратный клапан.'],
    [5, 'Ввод теплосети', [-W / 2 + 1.6, yT1 + 0.3, zMain],
     'Подающий и обратный трубопроводы теплосети с задвижками и грязевиками — граница ответственности между сетью и домом.'],
    [6, 'Узел учёта тепла', [xIn + 1.7, yT1 + 0.35, zMain],
     'Расходомеры на подаче и обратке, термопреобразователи в гильзах и тепловычислитель: по нему дом платит за отопление.'],
    [7, 'Элеваторный узел', [xEl, yT1 + 0.35, zMain],
     'Элеватор подмешивает остывшую обратку в горячую сетевую воду: 130 °С на вводе превращаются в 95 °С в батареях. Диаметр сопла задаёт весь режим отопления дома.'],
    [8, 'Магистрали и подводки', [W * 0.18, yT2 - 0.1, zMain],
     'Распределительные магистрали отопления и водоснабжения на подвесах с отводами и кранами к каждому стояку.'],
    [9, 'Канализационные выпуски', [-W / 2 + sw * 0.5, yK - 0.1, D / 2 + 1.0],
     'Лежаки с ревизиями собирают стоки от стояков и уходят выпусками в дворовые колодцы.'],
    [10, 'ВРУ дома', [-W / 2 + 1.3, -1.4, D * 0.26],
     'Вводно-распределительное устройство со счётчиком: граница ответственности по электричеству и начало общедомовых сетей.'],
    [11, 'Стояк водоснабжения', [risX('water'), H * 0.55, zRis],
     'Вертикальный стояк ХВС/ГВС от подвальной магистрали через все этажи.'],
    [12, 'Стояк отопления', [risX('heat'), H * 0.55, zRis],
     'Стояк центрального отопления с подводками к радиаторам; внизу — краны на подводке от магистрали.'],
    [13, 'Канализационный стояк', [risX('sewer'), H * 0.55, zRis],
     'Канализационный стояк с ревизией внизу и фановой вытяжкой на кровле.'],
    [14, 'Электроснабжение', [risX('electric'), H * 0.55, zRis],
     'Электрический стояк от ВРУ и поэтажные щиты.'],
    [15, 'Лоджии', [-W / 2 + sw - 1.0, H * 0.62, D / 2 + 0.5],
     'Стояк лоджий на лицевом фасаде с ограждениями и поручнями, со второго этажа.'],
  ];
  const flowsM = [
    { kind: 'Холодная вода (ввод → стояки)', color: [0.42, 0.82, 1.0], speed: 0.075, count: 6,
      pts: [[-W / 2 - 0.6, yW, zWat], [xIn - 1.2, yW, zWat], [xIn, yW, zWat], [xIn + 3.4, yW, zWat],
            [risX('water'), yW, zWat], [risX('water'), yW + 0.3, zWat], [risX('water'), yW + 0.3, zRis],
            [risX('water'), -0.6, zRis], [risX('water'), H * 0.5, zRis]] },
    { kind: 'Отопление (сеть → элеватор → стояки)', color: [1.0, 0.42, 0.14], speed: 0.08, count: 7,
      pts: [[-W / 2 - 0.6, yT1, zMain], [-W / 2 + 1.9, yT1, zMain], [xIn + 1.4, yT1, zMain],
            [xEl, yT1, zMain], [xEl + 0.9, yT1, zMain], [risX('heat'), yT1, zMain],
            [risX('heat'), yT1 + 0.18, zMain], [risX('heat'), yT1 + 0.18, zRis], [risX('heat'), H * 0.5, zRis],
            [risX('heat') + 0.36, H * 0.5, zRis], [risX('heat') + 0.36, yT2 + 0.2, zRis],
            [risX('heat') + 0.36, yT2 + 0.2, zMain], [risX('heat') + 0.36, yT2, zMain],
            [xEl + 1.6, yT2, zMain], [xEl, yT2, zMain], [-W / 2 - 0.6, yT2, zMain]] },
    { kind: 'Канализация (стояки → колодец)', color: [0.65, 0.85, 0.55], speed: 0.07, count: 5,
      pts: [[risX('sewer'), H * 0.4, zRis], [risX('sewer'), yK + 0.28, zRis], [risX('sewer'), yK + 0.28, zKan],
            [risX('sewer'), yK, zKan], [-W / 2 + sw * 0.5, yK, zKan], [-W / 2 + sw * 0.5, yK - 0.25, zKan],
            [-W / 2 + sw * 0.5, yK - 0.25, D / 2 + 1.1]] },
  ];

  const base = {
    title: h.title, category: h.category, badge: 'ИНТЕРАКТИВНАЯ ГОЛОГРАММА',
    subtitle: h.subtitle, accent: 'cyan', mode: 'structured', source: 'procedural',
    thumbLabel: h.thumbLabel, counter: h.counter, density: 'high',
    building: b,
    hotParts: ['systems', 'podval'],
    hotColor: [1.0, 0.58, 0.16], hotIntensity: 1.9, hotAngle: 44,
    contour: 0.72, fill: 0.34, shellOpacity: 0.30,   // фасад: контур ярче, заливка тише
    bloom: { strength: 0.4, radius: 0.6, threshold: 0.0 },
    geometry,
    parts, matRules, defaultPart: 0,
    explodeDirs: Object.assign(
      { konstr: [0, 0, 0], facade: [0, 0, 2.4], entrance: [0, 0, 3.0], roof: [0, 2.4, 0],
        systems: [2.4, 0, 0], podval: [0, -2.2, 0] },
      id === 'mkd-121' ? { core: [-2.4, 0, 0], interior: [0, 0, -2.4] } : {}),
    specs: { title: id === 'mkd-121' ? 'ХАРАКТЕРИСТИКИ СЕРИИ 121' : 'ХАРАКТЕРИСТИКИ ДОМА', rows: h.specs },
    overview: { tag: 'ЖИЛОЙ ФОНД', title: h.overviewTitle, desc: h.overviewDesc },
    calibrate: true,
  };

  // маркеры и потоки — в долях РЕАЛЬНОГО габарита модели (дом + подвал)
  const M = modelBBox(Object.assign({}, base, { markers: [], flows: [] }));
  const frac = p => [
    +((p[0] - M.min[0]) / M.size[0]).toFixed(4),
    +((p[1] - M.min[1]) / M.size[1]).toFixed(4),
    +((p[2] - M.min[2]) / M.size[2]).toFixed(4)];
  base.markers = markersM.map(([n2, name, p, desc]) => ({ n: n2, name, at: frac(p), desc }));
  base.flows = flowsM.map(f => ({ kind: f.kind, color: f.color, speed: f.speed, count: f.count, at: f.pts.map(frac) }));

  const out = path.resolve(__dirname, '..', 'configs', id + '.json');
  fs.writeFileSync(out, JSON.stringify(base, null, 2), 'utf8');
  const noBase = modelBBox(Object.assign({}, base, { geometry: [] })).count;
  console.log(id.padEnd(9), 'габарит', M.size.map(v => +v.toFixed(1)).join(' × '),
              '· примитивов', M.count, '(дом ' + noBase + ' + подвал ' + (M.count - noBase) + ')',
              '·', (fs.statSync(out).size / 1024).toFixed(0), 'КБ');
}

const only = process.argv[2];
(only ? [only] : Object.keys(HOUSES)).forEach(build);
