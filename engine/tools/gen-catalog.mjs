// Генератор «Каталог голограмм ЖКХ.html» — единая витрина всех собранных объектов.
//
//   node tools/gen-catalog.mjs [--thumbs ../catalog-thumbs] [--out "../Каталог голограмм ЖКХ.html"]
//
// Каталог самодостаточен: миниатюры зашиты как base64-JPEG, данные объектов взяты
// из configs/*.json. Сами голограммы НЕ встраиваются — они лежат рядом и
// открываются по относительной ссылке (в iframe предпросмотра или новой вкладкой).
// Так каталог весит ~2 МБ вместо 45, а бандлы остаются самостоятельными файлами.
//
// Список объектов курируемый (CATALOG ниже): в папке лежат и старые эксперименты
// со сканами, им в витрине не место.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const THUMBS = opt('--thumbs', '../catalog-thumbs');
const MUSEUM = argv.includes('--museum');   // брендинг раздела медиаштабжкх.рф/golomuzey/
const SITE_NAME = MUSEUM ? 'Голографический музей ЖКХ' : 'Holo Engine';
const OUT = opt('--out', '../Каталог голограмм ЖКХ.html');
const ROOT = path.resolve('..');

// группа → объекты: { конфиг, файл бандла }
const CATALOG = [
  ['Коммунальная техника', 'Машины на общем шасси КамАЗ 6×4: разбираются на системы, потоки среды показывают рабочий цикл.', [
    // ilosos-cad (чисто процедурная версия со старой коробчатой кабиной) в витрине НЕ показываем:
    // это исходник для ilosos-kamaz (gen-ilosos-kamaz.js читает ilosos-cad.json), а весь парк
    // ездит на донорской кабине КамАЗ — рядом с ним старая кабина читается как недоделка.
    ['ilosos-kamaz',    'Илосос КО-560 (КамАЗ)'],
    ['ko512',           'Каналопромывочная КО-512 (КамАЗ)'],
    ['musorovoz-cad',   'Мусоровоз с задней загрузкой (КамАЗ)'],
    ['kdm',             'КДМ — комбинированная дорожная (КамАЗ)'],
    ['polivomoika-cad', 'Поливомоечная машина (КамАЗ)'],
    ['agp-cad',         'Автовышка АГП-22 (КамАЗ)'],
    ['bunkervoz',       'Бункеровоз-мультилифт (КамАЗ)'],
    ['letuchka',        'Аварийная летучка (КамАЗ)'],
    ['cisterna',        'Автоцистерна питьевой воды (КамАЗ)'],
    ['ekskavator-cad',  'Экскаватор-погрузчик на раскопке'],
    ['traktor',         'Коммунальный трактор (отвал и щётка)'],
  ]],
  ['Оборудование и узлы', 'Учебные стенды крупным планом: «Разобрать» показывает то, что в жизни видно только при вскрытии.', [
    ['nasos',       'Насосный агрегат (центробежный)'],
    ['shu',         'Шкаф управления насосной станцией'],
    ['itp',         'Тепловой пункт (ИТП)'],
    ['zadvizhka',   'Задвижка с электроприводом'],
    ['gidrant',     'Пожарный гидрант с колонкой'],
    ['uchet-vody',  'Узел учёта воды (ОДПУ)'],
    ['lebedka',     'Лифтовая лебёдка'],
    ['kns',         'Канализационная насосная станция'],
    ['vru',         'ВРУ жилого дома'],
    ['radiator',    'Радиаторный узел квартиры'],
    ['reg-klapan',  'Регулирующий клапан'],
    ['grpsh',       'ГРПШ — газорегуляторный пункт'],
    ['ktp',         'КТП — трансформаторная подстанция'],
    ['lift',        'Пассажирский лифт в шахте'],
    ['ploshadka',   'Контейнерная площадка ТКО'],
    ['musorprovod', 'Мусоропровод в разрезе'],
    ['pvu',         'Приточная вентустановка'],
    ['teplotrassa', 'Теплотрасса в разрезе'],
  ]],
  ['Жилые дома', 'Пять домов разных эпох — от послевоенного кирпича до монолитной высотки. У каждого своя инженерия; у всех работают «План этажа» и «Разрез фасада».', [
    ['mkd-stalin',   'Кирпичный дом 1950-х (сталинка)'],
    ['mkd-447',      'Кирпичная пятиэтажка (серия 1-447)'],
    ['mkd',          'Жилой дом (МКД)'],
    ['mkd-121',      'Панельная 9-этажка (121 серия)'],
    ['mkd-p44',      'Панельная 17-этажка (серия П-44)'],
    ['zhk',          'Жилой комплекс с крышной котельной'],
  ]],
  ['Здания и станции', 'Станции собраны так же, как техника: тысяча с лишним примитивов, соединённых трубопроводами.', [
    ['boiler',       'Котельная'],
    ['kotelnaya-kr', 'Крышная котельная'],
    ['power',     'Электростанция ТЭЦ'],
    ['ctp',       'ЦТП'],
    ['vns',       'Насосная станция (ВНС II подъёма)'],
    ['vodozabor', 'Речной водозабор'],
    ['velizh',    'Подземный водозабор'],
    ['osk',       'Очистные сооружения канализации'],
    ['tko',       'Полигон и сортировка ТКО'],
    ['bashnya',   'Водонапорная башня и скважина'],
    ['ps110',     'Подстанция 110-10 кВ'],
    ['grs',       'ГРС — газораспределительная станция'],
  ]],
];

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : Math.round(n / 1024) + ' КБ';

let missThumb = 0, missBundle = 0;
const groups = CATALOG.map(([name, note, items]) => ({
  name, note,
  items: items.map(([cfg, base]) => {
    const c = JSON.parse(fs.readFileSync(path.join('configs', cfg + '.json'), 'utf8'));
    const bundle = base + ' (голограмма).html';
    const bundlePath = path.join(ROOT, bundle);
    const has = fs.existsSync(bundlePath);
    if (!has) { missBundle++; console.log('  ⚠ нет бандла: ' + bundle); }
    const thumbPath = path.join(THUMBS, base + '.jpg');
    let thumb = '';
    if (fs.existsSync(thumbPath)) thumb = fs.readFileSync(thumbPath).toString('base64');
    else { missThumb++; console.log('  ⚠ нет миниатюры: ' + base); }
    return {
      cfg, file: bundle, thumb,
      title: c.title, tag: c.category, hook: (c.overview && c.overview.title) || c.title,
      desc: (c.overview && c.overview.desc) || c.subtitle || '',
      sub: c.subtitle || '',
      parts: (c.parts || []).map(p => ({ n: p.name, t: p.tag, d: p.desc })),
      markers: (c.markers || []).length,
      keys: (c.markers || []).slice(0, 3).map(m => ({ n: m.name, d: m.desc })),
      flows: (c.flows || []).map(f => f.kind),
      specs: (c.specs && c.specs.rows) || [],
      size: has ? fs.statSync(bundlePath).size : 0,
      mode: c.source === 'parts' ? 'parts' : (c.source === 'procedural' ? 'procedural' : 'GLB'),
    };
  }),
}));

const all = groups.flatMap(g => g.items);
const totalSystems = all.reduce((s, o) => s + o.parts.length, 0);
const totalMarkers = all.reduce((s, o) => s + o.markers, 0);
const totalSize = all.reduce((s, o) => s + o.size, 0);

// данные для клиента: миниатюры отдельно, чтобы JSON объектов оставался читаемым
const DATA = groups.map(g => ({ name: g.name, note: g.note, items: g.items.map(o => ({
  file: o.file, title: o.title, tag: o.tag, hook: o.hook, desc: o.desc, sub: o.sub,
  parts: o.parts, markers: o.markers, keys: o.keys, flows: o.flows, specs: o.specs,
  size: kb(o.size), mode: o.mode, cfg: o.cfg,
})) }));
const THUMB_MAP = {};
groups.forEach(g => g.items.forEach(o => { if (o.thumb) THUMB_MAP[o.file] = o.thumb; }));

const json = o => JSON.stringify(o).replace(/</g, '\u003c');

// обои рабочего стола — кадр одной из голограмм: размывается и затемняется в CSS
const WALL = all.find(o => /ТЭЦ|Жилой дом|Котельная/.test(o.title)) || all[0];
const WALLPAPER = WALL && WALL.thumb ? WALL.thumb : '';
const html = `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${MUSEUM ? '<meta name="robots" content="noindex,nofollow">' : ''}
<title>${MUSEUM ? SITE_NAME : 'Каталог голограмм ЖКХ'}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2302060d'/%3E%3Ccircle cx='16' cy='16' r='7' fill='none' stroke='%2338e8ff' stroke-width='2'/%3E%3Ccircle cx='16' cy='16' r='2.5' fill='%2338e8ff'/%3E%3C/svg%3E">
<style>
/* ─────────────────────────────────────────────────────────────────────────
   Liquid Glass (macOS 26/27): стекло = полупрозрачный фон + blur с saturate,
   светлая внутренняя окантовка сверху, мягкая тень и волосяная граница.
   Значения сняты с референса: blur(28px) saturate(1.7), радиусы 12–24,
   тень 0 10px 34px rgba(0,0,0,.28) + 0 0 0 .5px.
   ───────────────────────────────────────────────────────────────────────── */
:root{
  --glass:rgba(28,30,36,0.62); --glass2:rgba(18,20,26,0.80); --hair:rgba(255,255,255,0.10);
  --hi:rgba(255,255,255,0.16); --txt:#f2f6fa; --dim:rgba(236,244,250,0.68); --dim2:rgba(236,244,250,0.44);
  --accent:#38e8ff; --shadow:0 10px 34px rgba(0,0,0,0.46), 0 0 0 0.5px rgba(0,0,0,0.35);
  --sans:'IBM Plex Sans','SF Pro Display','Segoe UI',system-ui,-apple-system,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,'SF Mono',Consolas,monospace;
  --rw:16px;
}
body.light{
  --glass:rgba(248,248,250,0.74); --glass2:rgba(252,252,254,0.88); --hair:rgba(0,0,0,0.09);
  --hi:rgba(255,255,255,0.85); --txt:#12161c; --dim:rgba(20,26,34,0.70); --dim2:rgba(20,26,34,0.46);
  --shadow:0 10px 34px rgba(0,0,0,0.26), 0 0 0 0.5px rgba(0,0,0,0.12);
}
*{box-sizing:border-box; -webkit-font-smoothing:antialiased}
html,body{margin:0; height:100%; overflow:hidden; font-family:var(--sans); color:var(--txt)}
#wall{position:fixed; inset:-6%; z-index:0; background-size:cover; background-position:center;
  filter:blur(26px) saturate(1.45) brightness(.86); transform:scale(1.06)}
body.light #wall{filter:blur(30px) saturate(1.35) brightness(1.05)}
#wall::after{content:''; position:absolute; inset:0;
  background:radial-gradient(120% 90% at 50% 6%, rgba(16,64,104,.30), rgba(2,8,16,.62) 72%)}
body.light #wall::after{background:radial-gradient(120% 90% at 50% 6%, rgba(255,255,255,.42), rgba(176,198,220,.58) 72%)}

/* ── меню-бар ─────────────────────────────────────────────────────────── */
#menubar{position:fixed; top:0; left:0; right:0; height:30px; z-index:40; display:flex; align-items:center;
  gap:20px; padding:0 14px; font:500 13px var(--sans); background:rgba(22,24,30,0.55);
  backdrop-filter:blur(22px) saturate(1.6); -webkit-backdrop-filter:blur(22px) saturate(1.6);
  border-bottom:0.5px solid var(--hair)}
body.light #menubar{background:rgba(250,250,252,0.66)}
#menubar .logo{display:flex; align-items:center; gap:7px; font-weight:700}
#menubar .logo i{width:9px; height:9px; border-radius:50%; background:var(--accent); box-shadow:0 0 12px var(--accent)}
.mi{opacity:.78; cursor:pointer} .mi:hover{opacity:1}
#menubar .right{margin-left:auto; display:flex; align-items:center; gap:16px; font-size:12.5px; opacity:.86}
.mbtn{border:0; background:transparent; color:inherit; font:inherit; cursor:pointer; padding:2px 7px; border-radius:7px}
.mbtn:hover{background:rgba(255,255,255,.14)}

/* ── окна ─────────────────────────────────────────────────────────────── */
#desk{position:fixed; inset:30px 0 0 0; z-index:10}
/* У окна фон 0.80–0.88 — blur под ним почти не читается, а стоит дорого: каждый
   кадр композитинга пересчитывается на всей площади, и при живой голограмме
   (WebGL рисует непрерывно) именно это даёт рывки. Стекло оставлено там, где
   оно видно и дёшево: меню-бар и док. */
.win{position:absolute; display:flex; flex-direction:column; border-radius:var(--rw); overflow:hidden;
  background:var(--glass2); border:0.5px solid var(--hair); contain:layout paint;
  box-shadow:var(--shadow), inset 0 1px 0 var(--hi); animation:winIn .26s cubic-bezier(.2,.8,.25,1)}
.win.drag{transition:none; box-shadow:0 6px 18px rgba(0,0,0,.42); will-change:left,top}
.win.drag .stage{pointer-events:none}
@keyframes winIn{from{opacity:0; transform:scale(.955) translateY(10px)} to{opacity:1; transform:none}}
.win.closing{animation:winOut .18s ease forwards}
@keyframes winOut{to{opacity:0; transform:scale(.96)}}
.win.min{animation:winMin .26s cubic-bezier(.4,0,.6,1) forwards}
@keyframes winMin{to{opacity:0; transform:translateY(55vh) scale(.2)}}
.bar{height:40px; display:flex; align-items:center; gap:10px; padding:0 12px; flex:none;
  border-bottom:0.5px solid var(--hair); user-select:none}
.lights{display:flex; gap:8px; align-items:center}
.lights b{width:12px; height:12px; border-radius:50%; display:block; cursor:pointer;
  box-shadow:inset 0 0 0 .5px rgba(0,0,0,.2)}
.lights .c{background:#ff5f57} .lights .m{background:#febc2e} .lights .z{background:#28c840}
/* Явная кнопка закрытия: macOS-светофоры многим незнакомы, а прятать выход за
   12-пиксельным кружком без подписи — невежливо. Красная, с крестиком и словом,
   справа в шапке окна, где её ждут пользователи Windows. */
.xbtn{display:inline-flex; align-items:center; gap:6px; border:0; cursor:pointer; flex:none;
  height:28px; padding:0 11px 0 9px; border-radius:9px; color:#fff; font:600 12.5px var(--sans);
  background:#e5484d; box-shadow:0 1px 0 rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.22);
  transition:.15s}
.xbtn:hover{background:#f25c60; transform:translateY(-1px)}
.xbtn:active{transform:none; background:#cf3e43}
.xbtn svg{width:13px; height:13px; stroke:#fff; stroke-width:2.6; fill:none; stroke-linecap:round}
.bar .tools{gap:8px}
.title{flex:1; text-align:center; font:600 13.5px var(--sans); opacity:.92; pointer-events:none;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.tools{display:flex; gap:8px; align-items:center}
.tbtn{border:0.5px solid var(--hair); background:rgba(255,255,255,.08); color:var(--txt); cursor:pointer;
  font:600 12px var(--sans); padding:6px 11px; border-radius:9px; transition:.18s; white-space:nowrap;
  text-decoration:none; display:inline-block}
.tbtn:hover{background:rgba(255,255,255,.18); transform:translateY(-1px)}
.tbtn.on{background:rgba(56,232,255,.22); border-color:rgba(56,232,255,.42)}
.wbody{flex:1; display:flex; min-height:0; position:relative}
.rsz{position:absolute; right:0; bottom:0; width:18px; height:18px; cursor:nwse-resize; z-index:3}

/* ── окно каталога ────────────────────────────────────────────────────── */
.side{width:210px; flex:none; padding:12px 10px; border-right:0.5px solid var(--hair); overflow-y:auto}
.side .sec{font:600 10.5px var(--mono); letter-spacing:.14em; color:var(--dim2); margin:8px 8px 6px}
.side button{display:flex; align-items:center; gap:9px; width:100%; border:0; background:transparent;
  color:var(--txt); font:500 13.5px var(--sans); padding:7px 9px; border-radius:9px; cursor:pointer; text-align:left}
.side button:hover{background:rgba(255,255,255,.09)}
.side button[aria-pressed=true]{background:rgba(56,232,255,.20)}
.side button i{width:18px; display:grid; place-items:center; font-style:normal; opacity:.9}
.side button span{margin-left:auto; font:500 11px var(--mono); color:var(--dim2)}
.content{flex:1; overflow-y:auto; padding:16px 18px 24px}
.content::-webkit-scrollbar,.side::-webkit-scrollbar,.info::-webkit-scrollbar{width:9px}
.content::-webkit-scrollbar-thumb,.side::-webkit-scrollbar-thumb,.info::-webkit-scrollbar-thumb{
  background:rgba(160,190,210,.22); border-radius:9px}
.gtitle{margin:4px 0 12px; font:600 11px var(--mono); letter-spacing:.15em; color:var(--dim2)}
.grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:14px; margin-bottom:26px;
  content-visibility:auto; contain-intrinsic-size:auto 320px}
.hidden{display:none !important}
.item{border:0; background:transparent; color:inherit; cursor:pointer; padding:9px; border-radius:14px;
  text-align:center; font:inherit; transition:.2s cubic-bezier(.2,.8,.25,1)}
.item:hover{background:rgba(255,255,255,.09); transform:translateY(-3px)}
.item .ic{position:relative; border-radius:22.37%; overflow:hidden; aspect-ratio:1; margin-bottom:9px;
  background:#04080f; box-shadow:0 8px 22px rgba(0,0,0,.42), inset 0 0 0 .5px rgba(255,255,255,.18)}
.item .ic img{width:100%; height:100%; object-fit:cover; display:block;
  transition:transform .45s cubic-bezier(.2,.8,.25,1)}
.item:hover .ic img{transform:scale(1.07)}
.item .nm{display:block; font:600 13px/1.3 var(--sans)}
.item .hk{display:-webkit-box; margin-top:3px; font:400 11.5px/1.35 var(--sans); color:var(--dim2);
  -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden}
.srch{display:flex; align-items:center; gap:7px; padding:5px 10px; border-radius:9px;
  background:rgba(255,255,255,.10); border:0.5px solid var(--hair)}
.srch input{border:0; background:transparent; color:var(--txt); font:400 13px var(--sans); outline:none; width:180px}

/* ── окно объекта ─────────────────────────────────────────────────────── */
.stage{flex:1; position:relative; background:#02060d; min-width:0}
.stage iframe{position:absolute; inset:0; width:100%; height:100%; border:0}
.stage .load{position:absolute; inset:0; display:grid; place-items:center; color:var(--dim2);
  font:500 11px var(--mono); letter-spacing:.18em}
.sleep{position:absolute; inset:0; display:grid; place-items:center; align-content:center; gap:14px;
  background:#04080f center/cover no-repeat; text-align:center; padding:20px}
.sleep::before{content:''; position:absolute; inset:0; background:rgba(2,6,13,.66)}
.sleep p{position:relative; margin:0; max-width:260px; font:500 12px/1.5 var(--sans); color:var(--dim)}
.sleep button{position:relative}
.info{width:0; flex:none; overflow:hidden; border-left:0.5px solid var(--hair);
  transition:width .28s cubic-bezier(.2,.8,.25,1)}
.info.open{width:316px; overflow-y:auto}
.info .pad{width:316px; padding:16px 18px 22px}
.info h4{margin:18px 0 8px; font:600 10.5px var(--mono); letter-spacing:.15em; color:var(--dim2)}
.info h4:first-child{margin-top:0}
.info p{margin:0; font:400 13.5px/1.55 var(--sans); color:var(--dim)}
.info .lede{margin-bottom:2px; font:600 15px/1.4 var(--sans); color:var(--txt)}
.info .k{padding:10px 12px; margin-bottom:8px; border:0.5px solid var(--hair); border-radius:11px;
  background:rgba(255,255,255,.05)}
.info .k b{display:block; margin-bottom:4px; font:600 13px var(--sans)}
.info .k p{font-size:12.5px}
.pill{display:inline-block; padding:4px 9px; margin:0 5px 5px 0; border-radius:8px; color:var(--dim);
  border:0.5px solid var(--hair); background:rgba(255,255,255,.06); font:500 10.5px var(--mono)}

/* ── док ──────────────────────────────────────────────────────────────── */
#dock{position:fixed; left:50%; bottom:12px; transform:translateX(-50%); z-index:35; display:flex;
  align-items:flex-end; gap:9px; padding:9px 12px; border-radius:24px; background:var(--glass);
  backdrop-filter:blur(30px) saturate(1.8); -webkit-backdrop-filter:blur(30px) saturate(1.8);
  border:0.5px solid var(--hair); box-shadow:var(--shadow), inset 0 1px 0 var(--hi)}
.dapp{position:relative; width:50px; height:50px; padding:0; border:0; border-radius:22.37%; cursor:pointer;
  display:grid; place-items:center; color:#eafcff; background:linear-gradient(160deg,#1e6a86,#0c2637);
  box-shadow:0 6px 16px rgba(0,0,0,.42), inset 0 0 0 .5px rgba(255,255,255,.22);
  transition:transform .22s cubic-bezier(.2,.8,.25,1)}
.dapp:hover{transform:translateY(-9px) scale(1.14)}
.dapp[data-run="1"]::after{content:''; position:absolute; bottom:-6px; left:50%; transform:translateX(-50%);
  width:5px; height:5px; border-radius:50%; background:var(--txt); opacity:.75}
.dapp em{position:absolute; bottom:calc(100% + 10px); left:50%; transform:translateX(-50%) scale(.9);
  padding:5px 10px; border-radius:9px; background:var(--glass2); border:0.5px solid var(--hair);
  backdrop-filter:blur(20px); font:500 12px var(--sans); font-style:normal; white-space:nowrap;
  opacity:0; pointer-events:none; transition:.18s}
.dapp:hover em{opacity:1; transform:translateX(-50%) scale(1)}
.dsep{width:1px; height:38px; margin:0 3px; background:var(--hair)}
.hintbar{position:fixed; left:50%; bottom:88px; transform:translateX(-50%); z-index:34; pointer-events:none;
  font:500 11px var(--mono); letter-spacing:.1em; color:rgba(255,255,255,.42)}
body.light .hintbar{color:rgba(0,0,0,.40)}
@media (max-width:900px){ .side{display:none} .info.open{width:100%} }
/* ── Телефон (≤640px): не окна, а экраны ─────────────────────────────────
   Оконная метафора с перетаскиванием, стопкой и доком-«ракетой» на телефоне не
   живёт. Здесь: каждое окно — полноэкранный лист, док — нижняя панель вкладок
   с подписями, сетка объектов в две колонки.
   Первая версия просто растягивала окно — кнопка «Закрыть» уезжала за край
   (375px → правый край 441), боковая панель категорий пропадала без замены.
   ⚠ Панель «Инфо» здесь НЕ раскрывается по умолчанию: у самой голограммы с
   20.08.2026 есть свои вкладки внизу («Системы · Инфо · Вид»), и два листа
   с описанием друг над другом съедали экран, ради которого всё и затевалось. */
@media (max-width:640px),(max-height:520px) and (pointer:coarse){
  :root{--rw:0px}
  #menubar{height:44px; padding:0 12px; font-size:12.5px}
  #menubar .logo{font-size:13px}
  #menubar .mi:not(.logo){display:none}
  #menubar .right{gap:10px}
  #menubar .right span:not(#clock){display:none}
  #desk{inset:44px 0 0 0}
  .win{left:0 !important; top:0 !important; width:100vw !important;
    height:calc(100% - 64px) !important; border-radius:0; animation:none; border:0}
  .win.drag{box-shadow:none}
  .bar{height:46px; padding:0 10px; gap:8px}
  .lights{display:none}
  .title{text-align:left; font-size:14px}
  .tools{gap:6px}
  .tbtn{padding:7px 10px; font-size:12px}
  .xbtn{height:32px; padding:0 10px 0 8px; font-size:13px}
  .rsz{display:none}
  /* каталог: боковую панель категорий заменяет горизонтальная лента чипов сверху */
  .wbody{flex-direction:column}
  .side{width:100%; display:flex; gap:6px; padding:8px 10px; overflow-x:auto; overflow-y:hidden;
    border-right:0; border-bottom:0.5px solid var(--hair); flex:none; scrollbar-width:none}
  .side::-webkit-scrollbar{display:none}
  .side .sec{display:none}
  .side button{width:auto; flex:none; padding:7px 12px; border-radius:999px; font-size:12.5px;
    border:0.5px solid var(--hair); background:rgba(255,255,255,.06); white-space:nowrap}
  .side button span{margin-left:6px}
  .srch input{width:110px}
  .content{padding:12px 12px 18px}
  .grid{grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:18px}
  .item{padding:6px}
  .item .ic{border-radius:18%}
  .item .nm{font-size:12.5px}
  .item .hk{font-size:11px; -webkit-line-clamp:2}
  /* объект: голограмма во весь лист, описание выезжает снизу по кнопке «Инфо» */
  .stage{min-height:0}
  /* В column-flex у flex-элемента min-height:auto = высота контента, и height:0
     не держит — панель раздвигалась обратно до 342px. Поэтому min-height:0 и
     размер через flex-basis. ⚠ Обе стороны перехода — В ОДНИХ ЕДИНИЦАХ (%):
     transition 52% → 0px браузер интерполировать не может и ВИСИТ на старте
     бесконечно (getAnimations() показывал живую анимацию спустя 2 с), панель
     так и не схлопывалась — это и был весь баг. */
  .info{width:100% !important; border-left:0; border-top:0.5px solid var(--hair);
    transition:flex-basis .28s cubic-bezier(.2,.8,.25,1); height:auto; min-height:0;
    flex:0 0 0%; overflow:hidden}
  .info.open{flex-basis:52%; overflow-y:auto}
  .info .pad{width:100%; padding:14px 16px 20px}
  .sleep p{max-width:220px}
  /* док → нижняя панель вкладок с подписями */
  #dock{left:0; right:0; bottom:0; transform:none; border-radius:0; padding:6px 4px 10px;
    gap:0; justify-content:space-around; border:0; border-top:0.5px solid var(--hair)}
  .dsep{display:none}
  .dapp{width:auto; min-width:58px; height:auto; padding:4px 6px; border-radius:10px;
    background:transparent; box-shadow:none; color:var(--dim); flex-direction:column; gap:3px}
  .dapp:hover{transform:none}
  .dapp svg{width:22px; height:22px}
  .dapp em{position:static; transform:none; opacity:1; padding:0; border:0; background:transparent;
    backdrop-filter:none; font:600 10px var(--sans); color:inherit; white-space:nowrap}
  .dapp[data-run="1"]{color:var(--accent)}
  .dapp[data-run="1"]::after{display:none}
  .dapp em[data-short]{font-size:0}
  .dapp em[data-short]::after{content:attr(data-short); font-size:10px}
  .hintbar{display:none}
  /* объект на весь экран: док прячем, окно занимает всю высоту (см. applyFocus) */
  body.objfull #dock{display:none}
  body.objfull .win{height:100% !important}
}
@media (max-height:520px) and (pointer:coarse){
  .info.open{flex-basis:70%}
  .grid{grid-template-columns:repeat(3,1fr)}
}
</style>
</head><body class="dark">
<div id="wall" style="background-image:url('data:image/jpeg;base64,${WALLPAPER}')"></div>

<div id="menubar">
  <span class="logo"><i></i>${SITE_NAME}</span>
  <span class="mi" id="mCat">Каталог</span>
  <span class="mi" id="mRand">Случайный объект</span>
  <span class="mi" id="mAbout">О проекте</span>
  ${MUSEUM ? '<a class="mi" href="/metavselennaya/" style="color:inherit;text-decoration:none">← Энциклопедия ЖКХ</a>' : ''}
  <span class="right">
    <button class="mbtn" id="theme" title="Светлая / тёмная тема">☾</button>
    <span><b>${all.length}</b> объектов</span>
    <span id="clock"></span>
  </span>
</div>

<div id="desk"></div>

<div id="dock">
  <button class="dapp" data-act="catalog"><em>Каталог</em>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
      <path d="M3 7.5A1.5 1.5 0 014.5 6h4l1.6 2H19.5A1.5 1.5 0 0121 9.5v8A1.5 1.5 0 0119.5 19h-15A1.5 1.5 0 013 17.5z"/></svg></button>
  <div class="dsep"></div>
  <button class="dapp" data-group="Коммунальная техника"><em>Техника</em>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
      <path d="M2 15V8h11v7M13 11h4l3 3v1M2 15h2m4 0h8m4 0h2"/><circle cx="6" cy="16.5" r="1.8"/><circle cx="17" cy="16.5" r="1.8"/></svg></button>
  <button class="dapp" data-group="Оборудование и узлы"><em data-short="Узлы">Оборудование</em>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
      <circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg></button>
  <button class="dapp" data-group="Здания и станции"><em data-short="Здания">Здания и станции</em>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
      <path d="M4 21V6l6-3v18M14 21V10l6 3v8M2 21h20M7 9v.01M7 13v.01M7 17v.01M17 15v.01M17 18v.01"/></svg></button>
  <div class="dsep"></div>
  <button class="dapp" data-act="search"><em>Поиск</em>
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg></button>
  <button class="dapp" data-act="random"><em data-short="Случайный">Случайный объект</em>
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
      <rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/>
      <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg></button>
</div>
<div class="hintbar">перетаскивайте окна за заголовок · «Закрыть» или Esc — закрыть окно · / — поиск · ← → — соседний объект</div>

<script>
const GROUPS = ${json(DATA)};
const THUMBS = ${json(THUMB_MAP)};
const STATS = { systems: ${totalSystems}, markers: ${totalMarkers} };
const FLAT = GROUPS.flatMap(g => g.items.map(o => Object.assign({}, o, { group: g.name })));
// тот же запрос, что в CSS ниже: ширина ИЛИ низкий экран под пальцем (альбом)
const PHONE = '(max-width:640px),(max-height:520px) and (pointer:coarse)';
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const short = (t, n) => { n = n || 320; t = String(t || ''); if (t.length <= n) return t;
  const c = t.slice(0, n), d = Math.max(c.lastIndexOf('. '), c.lastIndexOf('; '));
  return d > n * 0.5 ? c.slice(0, d + 1) : c.trimEnd() + '…'; };
// base64 в атрибуте src браузер декодирует ЗАНОВО при каждой вставке в DOM:
// 27 карточек по ~50 КБ — это 1,4 МБ строк на каждую перерисовку сетки. Один раз
// переводим в Blob URL: ссылка короткая, декодированный кадр кэшируется браузером.
const BLOBS = {};
(function makeBlobs(){
  for (const f in THUMBS){
    const bin = atob(THUMBS[f]); const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    BLOBS[f] = URL.createObjectURL(new Blob([a], { type: 'image/jpeg' }));
    THUMBS[f] = null;
  }
})();
const src = f => BLOBS[f] || '';
const desk = document.getElementById('desk');
let zTop = 10, wins = [], filter = 'Все', query = '', finder = null;

/* ── фабрика окон: traffic lights, перетаскивание, зум, свёртывание ───── */
function makeWin(opt){
  const el = document.createElement('div');
  el.className = 'win ' + (opt.cls || '');
  const W = Math.min(opt.w, innerWidth - 40), H = Math.min(opt.h, innerHeight - 110);
  const off = (wins.length % 4) * 24;
  el.style.width = W + 'px'; el.style.height = H + 'px';
  el.style.left = Math.max(8, (innerWidth - W) / 2 + off) + 'px';
  el.style.top = Math.max(10, (innerHeight - H) / 2 - 44 + off) + 'px';
  el.style.zIndex = ++zTop;
  el.innerHTML = '<div class="bar"><div class="lights">' +
      '<b class="c" title="Закрыть"></b><b class="m" title="Свернуть"></b><b class="z" title="Развернуть"></b>' +
    '</div><div class="title">' + esc(opt.title) + '</div><div class="tools"></div>' +
    '<button class="xbtn" title="Закрыть окно (Esc)" aria-label="Закрыть">' +
      '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>Закрыть</button></div>' +
    '<div class="wbody"></div><div class="rsz"></div>';
  const bar = el.querySelector('.bar');
  el.addEventListener('mousedown', () => { el.style.zIndex = ++zTop; applyFocus(); });
  el.addEventListener('mouseenter', () => { if (el.dataset.idx) applyFocus(el); });
  bar.querySelector('.c').onclick = e => { e.stopPropagation(); closeWin(el); };
  bar.querySelector('.xbtn').onclick = e => { e.stopPropagation(); closeWin(el); };
  bar.querySelector('.m').onclick = e => { e.stopPropagation(); el.classList.add('min');
    setTimeout(() => { el.style.display = 'none'; el.classList.remove('min'); sleepWin(el); }, 260); };
  bar.querySelector('.z').onclick = e => { e.stopPropagation(); zoomWin(el); };
  if (!matchMedia(PHONE).matches) bar.ondblclick = () => zoomWin(el);
  drag(bar, el, 'move'); drag(el.querySelector('.rsz'), el, 'size');
  desk.appendChild(el); wins.push(el); syncDock();
  return el;
}
function drag(handle, el, mode){
  handle.addEventListener('mousedown', e => {
    if (mode === 'move' && e.target.closest('.lights, .tools, .xbtn')) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const ox = parseFloat(el.style.left), oy = parseFloat(el.style.top);
    const ow = el.offsetWidth, oh = el.offsetHeight;
    el.classList.add('drag');
    const mv = ev => {
      if (mode === 'move'){
        el.style.left = Math.max(-ow + 140, ox + ev.clientX - sx) + 'px';
        el.style.top = Math.max(0, oy + ev.clientY - sy) + 'px';
      } else {
        el.style.width = Math.max(460, ow + ev.clientX - sx) + 'px';
        el.style.height = Math.max(300, oh + ev.clientY - sy) + 'px';
      }
    };
    const up = () => { el.classList.remove('drag');
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  });
}
function zoomWin(el){
  if (el.dataset.zoom){
    const p = el.dataset.zoom.split(',');
    el.style.left = p[0]; el.style.top = p[1]; el.style.width = p[2]; el.style.height = p[3];
    delete el.dataset.zoom; return;
  }
  el.dataset.zoom = [el.style.left, el.style.top, el.style.width, el.style.height].join(',');
  el.style.left = '8px'; el.style.top = '8px';
  el.style.width = (innerWidth - 16) + 'px'; el.style.height = (innerHeight - 100) + 'px';
}
function closeWin(el){
  el.classList.add('closing');
  setTimeout(() => { el.remove(); wins = wins.filter(w => w !== el);
    // ⚠ Карточки сетки кэшируются в CARDS/HEADS и живут В ЭТОМ окне. Если их не
    // сбросить, следующий openCatalog() создаст новое окно, renderGrid() решит,
    // что сетка уже построена, и переключит классы у осиротевших узлов —
    // каталог откроется ПУСТЫМ (и упадёт на finder.querySelector('.empty')).
    if (el === finder){ finder = null; CARDS = null; HEADS = {}; }
    syncDock(); applyFocus(); }, 180);
}
function topWin(){
  return wins.filter(w => w.style.display !== 'none')
             .sort((a, b) => (+b.style.zIndex) - (+a.style.zIndex))[0];
}
function syncDock(){
  document.querySelectorAll('.dapp').forEach(d => { d.dataset.run = '0'; });
  const c = document.querySelector('[data-act=catalog]');
  if (finder && document.body.contains(finder)) c.dataset.run = '1';
}

/* ── окно каталога ────────────────────────────────────────────────────── */
const ICONS = { 'Все': '▦', 'Коммунальная техника': '🚛', 'Оборудование и узлы': '⚙', 'Жилые дома': '🏠', 'Здания и станции': '🏢' };
function openCatalog(group){
  if (group) filter = group;
  if (finder && document.body.contains(finder)){
    finder.style.display = ''; finder.style.zIndex = ++zTop; renderSide(); renderGrid(); return finder;
  }
  const el = makeWin({ title: '${MUSEUM ? 'Каталог музея' : 'Каталог голограмм'}', w: Math.round(innerWidth * 0.74), h: Math.round(innerHeight * 0.78), cls: 'finder' });
  el.querySelector('.tools').innerHTML =
    '<div class="srch"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>' +
    '<input id="q" type="search" placeholder="Поиск по системам и ТТХ" autocomplete="off"></div>';
  el.querySelector('.wbody').innerHTML = '<div class="side"></div><div class="content"></div>';
  el.querySelector('#q').addEventListener('input', e => { query = e.target.value; renderGrid(); });
  finder = el; renderSide(); renderGrid(); syncDock();
  return el;
}
function renderSide(){
  if (!finder) return;
  const s = finder.querySelector('.side');
  s.innerHTML = '<div class="sec">КАТЕГОРИИ</div>';
  ['Все'].concat(GROUPS.map(g => g.name)).forEach(n => {
    const cnt = n === 'Все' ? FLAT.length : GROUPS.filter(g => g.name === n)[0].items.length;
    const b = document.createElement('button');
    b.setAttribute('aria-pressed', String(n === filter));
    b.innerHTML = '<i>' + ICONS[n] + '</i>' + esc(n) + '<span>' + cnt + '</span>';
    b.onclick = () => { filter = n; renderSide(); renderGrid(); };
    s.appendChild(b);
  });
}
const hay = o => [o.title, o.hook, o.sub, o.desc, o.tag]
  .concat(o.parts.map(p => p.n + ' ' + p.t + ' ' + p.d))
  .concat(o.flows).concat(o.specs.map(r => r.join(' '))).join(' ').toLowerCase();
let CARDS = null, HEADS = {};        // карточки строятся один раз и переиспользуются
function buildGrid(){
  const c = finder.querySelector('.content');
  c.innerHTML = ''; CARDS = []; HEADS = {};
  GROUPS.forEach(g => {
    const sec = document.createElement('div');
    const h = document.createElement('div'); h.className = 'gtitle';
    const grid = document.createElement('div'); grid.className = 'grid';
    g.items.forEach(o => {
      const b = document.createElement('button'); b.className = 'item';
      const img = new Image();
      img.loading = 'lazy'; img.decoding = 'async'; img.alt = ''; img.src = src(o.file);
      const ic = document.createElement('div'); ic.className = 'ic'; ic.appendChild(img);
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = o.title;
      const hk = document.createElement('span'); hk.className = 'hk'; hk.textContent = o.hook;
      b.appendChild(ic); b.appendChild(nm); b.appendChild(hk);
      let idx = -1; FLAT.forEach((x, i) => { if (x.file === o.file) idx = i; });
      b.onclick = () => openObject(idx);
      grid.appendChild(b);
      CARDS.push({ el: b, group: g.name, hay: hay(o) });
    });
    sec.appendChild(h); sec.appendChild(grid); c.appendChild(sec);
    HEADS[g.name] = { h: h, sec: sec };
  });
  const empty = document.createElement('div');
  empty.className = 'gtitle empty hidden'; empty.textContent = 'НИЧЕГО НЕ НАЙДЕНО';
  c.appendChild(empty);
}
function renderGrid(){
  if (!finder) return;
  if (!CARDS) buildGrid();
  const q = query.trim().toLowerCase(), counts = {};
  CARDS.forEach(c => {
    const ok = (filter === 'Все' || filter === c.group) && (!q || c.hay.indexOf(q) >= 0);
    c.el.classList.toggle('hidden', !ok);
    if (ok) counts[c.group] = (counts[c.group] || 0) + 1;
  });
  let total = 0;
  GROUPS.forEach(g => {
    const H = HEADS[g.name], n = counts[g.name] || 0; total += n;
    H.sec.classList.toggle('hidden', !n);
    H.h.textContent = g.name.toUpperCase() + ' · ' + n;
  });
  finder.querySelector('.empty').classList.toggle('hidden', !!total);
}

/* ── окно объекта: слева живая голограмма, справа выезжающий путеводитель ── */
function openObject(i){
  if (i < 0 || i >= FLAT.length) return;
  const o = FLAT[i];
  const el = makeWin({ title: o.title, w: Math.round(innerWidth * 0.88), h: Math.round(innerHeight * 0.86) });
  el.dataset.idx = String(i);
  el.querySelector('.tools').innerHTML =
    '<button class="tbtn info-t">Инфо</button>' +
    '<a class="tbtn" href="' + encodeURI(o.file) + '" target="_blank" rel="noopener">Открыть ↗</a>';
  el.querySelector('.wbody').innerHTML =
    '<div class="stage"></div><div class="info"><div class="pad">' + infoHTML(o) + '</div></div>';
  const info = el.querySelector('.info');
  el.querySelector('.info-t').onclick = function(){ info.classList.toggle('open'); this.classList.toggle('on'); };
  wake(el); keepAlive(el);
  return el;
}
function infoHTML(o){
  return '<p class="lede">' + esc(o.hook) + '</p>' +
    '<h4>СУТЬ</h4><p>' + esc(short(o.desc)) + '</p>' +
    (o.keys.length ? '<h4>ЧТО ЗДЕСЬ СМОТРЕТЬ</h4>' +
      o.keys.map(k => '<div class="k"><b>' + esc(k.n) + '</b><p>' + esc(k.d) + '</p></div>').join('') : '') +
    (o.flows.length ? '<h4>ПОТОКИ СРЕДЫ</h4>' +
      o.flows.map(f => '<span class="pill">' + esc(f) + '</span>').join('') : '') +
    '<h4>В ОБЪЕКТЕ</h4>' +
    '<span class="pill">' + o.parts.length + ' СИСТЕМ</span>' +
    '<span class="pill">' + o.markers + ' УЗЛОВ</span>' +
    '<span class="pill">' + esc(o.size) + '</span>' +
    '<span class="pill">' + esc(o.mode) + '</span>';
}
/* Каждая голограмма — свой WebGL-контекст, рисующий непрерывно, даже когда окно
   перекрыто. Три открытых объекта = три сцены на GPU, и интерфейс дёргается.
   Живыми держим не больше двух: остальные усыпляются — iframe выгружается,
   остаётся кадр-миниатюра с кнопкой «Возобновить». */
const LIVE_MAX = 3;
/* Живой рендер — только у верхнего окна: остальным шлём паузу. Движок бандла
   слушает postMessage и перестаёт рисовать, пока его не разбудят. Без этого
   одна фоновая голограмма роняла каталог со 166 до 20 fps. */
function applyFocus(force){
  // Верхним считаем ЛЮБОЕ окно, включая каталог: пока человек листает список,
  // ни одна голограмма рисовать не должна — иначе список дёргается.
  const vis = wins.filter(w => w.style.display !== 'none');
  const top = force || vis.slice().sort((a, b) => (+b.style.zIndex) - (+a.style.zIndex))[0];
  document.body.classList.toggle('objfull', !!(top && top.dataset.idx));
  vis.forEach(w => {
    if (!w.dataset.idx) return;
    const fr = w.querySelector('iframe');
    if (!fr || !fr.contentWindow) return;
    try { fr.contentWindow.postMessage({ holo: w === top ? 'resume' : 'pause' }, '*'); } catch (e) {}
  });
}
// Тема. Голограмма — аддитивное свечение на тёмном, и «белой» она не станет,
// но движок умеет смягчать тёмную виньетку по краям, чтобы окно не читалось
// чёрной дырой в светлом интерфейсе. Сигнал надо ПОСЛАТЬ: приёмник в бандле
// (viewer.html, holo:'theme') был, а отправителя не было — тема внутри окна
// модели не менялась вовсе.
function isLight(){ return document.body.classList.contains('light'); }
function sendTheme(fr){
  try { fr && fr.contentWindow && fr.contentWindow.postMessage({ holo: 'theme', light: isLight() }, '*'); } catch (e) {}
}
function pushTheme(){ wins.forEach(w => sendTheme(w.querySelector('iframe'))); }

function wake(el){
  const o = FLAT[+el.dataset.idx], stage = el.querySelector('.stage');
  stage.innerHTML = '<div class="load">ЗАГРУЗКА ГОЛОГРАММЫ…</div>';
  const fr = document.createElement('iframe');
  fr.src = encodeURI(o.file);
  fr.onload = () => { const l = stage.querySelector('.load'); if (l) l.remove(); applyFocus(); sendTheme(fr); };
  stage.appendChild(fr);
  el.dataset.live = '1';
}
function sleepWin(el){
  if (el.dataset.live !== '1') return;
  const o = FLAT[+el.dataset.idx], stage = el.querySelector('.stage');
  stage.innerHTML = '';
  const d = document.createElement('div');
  d.className = 'sleep'; d.style.backgroundImage = 'url(' + src(o.file) + ')';
  const p = document.createElement('p');
  p.textContent = 'Голограмма приостановлена, чтобы не занимать видеокарту';
  const b = document.createElement('button');
  b.className = 'tbtn'; b.textContent = 'Возобновить';
  b.onclick = () => { wake(el); keepAlive(el); };
  d.appendChild(p); d.appendChild(b); stage.appendChild(d);
  el.dataset.live = '0';
}
function keepAlive(el){
  const live = wins.filter(w => w.dataset.live === '1' && w !== el);
  live.sort((a, b) => (+a.style.zIndex) - (+b.style.zIndex));
  while (live.length >= LIVE_MAX) sleepWin(live.shift());
}
function stepObject(d){
  const t = topWin();
  if (!t || !t.dataset.idx) return;
  // раньше окно закрывалось и создавалось заново: прыжок позиции и лишний кадр
  const i = ((+t.dataset.idx) + d + FLAT.length) % FLAT.length, o = FLAT[i];
  t.dataset.idx = String(i);
  t.querySelector('.title').textContent = o.title;
  t.querySelector('.tools a').href = encodeURI(o.file);
  t.querySelector('.info .pad').innerHTML = infoHTML(o);
  wake(t); keepAlive(t);
}

/* ── док, меню, клавиатура, часы ──────────────────────────────────────── */
document.querySelectorAll('.dapp').forEach(b => {
  b.onclick = () => {
    const g = b.dataset.group, a = b.dataset.act;
    if (g) openCatalog(g);
    else if (a === 'catalog') openCatalog('Все');
    else if (a === 'search'){ openCatalog(); setTimeout(() => { const q = finder.querySelector('#q'); if (q) q.focus(); }, 80); }
    else if (a === 'random') openObject(Math.floor(Math.random() * FLAT.length));
  };
});
document.getElementById('mCat').onclick = () => openCatalog('Все');
document.getElementById('mRand').onclick = () => openObject(Math.floor(Math.random() * FLAT.length));
document.getElementById('mAbout').onclick = () => {
  const el = makeWin({ title: 'О проекте', w: 560, h: 400 });
  el.querySelector('.wbody').innerHTML = '<div class="content" style="padding:22px 26px">' +
    '<p style="font:600 17px var(--sans); margin:0 0 10px">${MUSEUM ? SITE_NAME : 'Holo Engine — голограммы объектов ЖКХ'}</p>' +
    '<p style="color:var(--dim); font:400 13.5px/1.6 var(--sans); margin:0">Движок превращает CAD-описание ' +
    'объекта в самодостаточный офлайн-файл: рентген-каркас, разборка на системы, потоки среды и нумерованные ' +
    'узлы. Каждый объект открывается двойным кликом и работает без интернета — здесь они собраны в одну витрину.</p>' +
    '<p style="margin:16px 0 0"><span class="pill">' + FLAT.length + ' ОБЪЕКТОВ</span>' +
    '<span class="pill">' + STATS.systems + ' СИСТЕМ</span>' +
    '<span class="pill">' + STATS.markers + ' УЗЛОВ</span></p></div>';
};
document.getElementById('theme').onclick = function(){
  document.body.classList.toggle('light');
  this.textContent = isLight() ? '☀' : '☾';
  pushTheme();
};
addEventListener('keydown', e => {
  if (e.key === 'Escape'){ const t = topWin(); if (t) closeWin(t); return; }
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT'){
    e.preventDefault(); openCatalog();
    setTimeout(() => { const q = finder.querySelector('#q'); if (q) q.focus(); }, 80); return;
  }
  if (e.key === 'ArrowLeft') stepObject(-1);
  if (e.key === 'ArrowRight') stepObject(1);
});
function tick(){
  const d = new Date();
  document.getElementById('clock').textContent =
    d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }) + '  ' +
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
tick(); setInterval(tick, 20000);
openCatalog('Все');
</script>
</body></html>`;

fs.writeFileSync(path.resolve(OUT), html, 'utf8');
const size = fs.statSync(path.resolve(OUT)).size;
console.log('объектов:', all.length, '· систем:', totalSystems, '· бандлов:', kb(totalSize));
if (missThumb) console.log('без миниатюр:', missThumb);
if (missBundle) console.log('без бандлов:', missBundle);
console.log('✓', OUT, '(' + kb(size) + ')');
