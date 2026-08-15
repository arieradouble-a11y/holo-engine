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
const OUT = opt('--out', '../Каталог голограмм ЖКХ.html');
const ROOT = path.resolve('..');

// группа → объекты: { конфиг, файл бандла }
const CATALOG = [
  ['Коммунальная техника', 'Машины на общем шасси КамАЗ 6×4: разбираются на системы, потоки среды показывают рабочий цикл.', [
    ['ilosos-cad',      'Илосос КО-560 (КамАЗ-6520)'],
    ['ilosos-kamaz',    'Илосос КО-560 (КамАЗ)'],
    ['ko512',           'Каналопромывочная КО-512 (КамАЗ)'],
    ['musorovoz-cad',   'Мусоровоз с задней загрузкой (КамАЗ)'],
    ['kdm',             'КДМ — комбинированная дорожная (КамАЗ)'],
    ['polivomoika-cad', 'Поливомоечная машина (КамАЗ)'],
    ['agp-cad',         'Автовышка АГП-22 (КамАЗ)'],
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
    ['pvu',         'Приточная вентустановка'],
  ]],
  ['Здания и станции', 'Объекты без модели: геометрия строится из параметров, есть план этажа и разрез фасада.', [
    ['mkd',       'Жилой дом (МКД)'],
    ['mkd-121',   'Панельная 9-этажка (121 серия)'],
    ['boiler',    'Котельная'],
    ['power',     'Электростанция ТЭЦ'],
    ['ctp',       'ЦТП'],
    ['vns',       'Насосная станция (ВНС II подъёма)'],
    ['vodozabor', 'Метелёвский водозабор'],
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

const html = `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Каталог голограмм ЖКХ</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2302060d'/%3E%3Ccircle cx='16' cy='16' r='7' fill='none' stroke='%2338e8ff' stroke-width='2'/%3E%3Ccircle cx='16' cy='16' r='2.5' fill='%2338e8ff'/%3E%3C/svg%3E">
<style>
  :root{
    --bg:#02060d; --bg2:#061320; --line:rgba(56,232,255,0.18); --line2:rgba(56,232,255,0.34);
    --txt:#e8f6ff; --dim:#8fb6c8; --dim2:#5d93a8; --cyan:#38e8ff; --amber:#ffa63d;
    --card:rgba(6,18,30,0.62);
    --mono:'IBM Plex Mono','JetBrains Mono',ui-monospace,Consolas,monospace;
    --sans:'IBM Plex Sans','Segoe UI',system-ui,-apple-system,sans-serif;
  }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{
    background:
      radial-gradient(120% 80% at 50% 100%, rgba(20,96,128,0.22), rgba(2,6,13,0) 60%),
      radial-gradient(90% 70% at 50% 0%, rgba(12,60,90,0.30), rgba(2,6,13,0) 55%),
      var(--bg);
    color:var(--txt); font-family:var(--sans); -webkit-font-smoothing:antialiased;
    min-height:100%;
  }
  body::before{ /* скан-линии как в самих голограммах */
    content:''; position:fixed; inset:0; pointer-events:none; z-index:2; opacity:.30;
    background:repeating-linear-gradient(to bottom, rgba(150,230,255,0.05) 0px, rgba(150,230,255,0.05) 1px, transparent 1px, transparent 3px);
  }
  body::after{ content:''; position:fixed; inset:0; pointer-events:none; z-index:2;
    box-shadow:inset 0 0 240px 60px rgba(0,0,0,0.66); }
  .wrap{position:relative; z-index:3; max-width:1560px; margin:0 auto; padding:34px 30px 90px}

  /* ── шапка ───────────────────────────────────────────────────────────── */
  header{margin-bottom:26px}
  .brand{display:flex; align-items:center; gap:10px; margin-bottom:14px}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--cyan);box-shadow:0 0 14px var(--cyan);animation:pulse 2.4s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.82)}}
  .brand span{font:600 12px var(--mono); letter-spacing:.18em; color:#6fcfe6}
  h1{margin:0; font:700 clamp(30px,4.4vw,52px)/1.02 var(--sans); letter-spacing:-0.02em;
     text-shadow:0 0 30px rgba(56,232,255,0.22)}
  .lead{margin:12px 0 0; max-width:760px; font:400 15.5px/1.55 var(--sans); color:var(--dim)}
  .stats{display:flex; flex-wrap:wrap; gap:26px; margin-top:22px; padding-top:20px; border-top:1px solid var(--line)}
  .stat b{display:block; font:700 26px var(--sans); color:#f1fbff; letter-spacing:-0.01em}
  .stat span{font:500 11px var(--mono); letter-spacing:.14em; color:var(--dim2)}

  /* ── панель фильтров ─────────────────────────────────────────────────── */
  .bar{position:sticky; top:0; z-index:6; display:flex; flex-wrap:wrap; gap:12px; align-items:center;
       margin:24px 0 22px; padding:12px 0; background:linear-gradient(to bottom, rgba(2,6,13,0.96) 70%, rgba(2,6,13,0));
       backdrop-filter:blur(6px)}
  .chips{display:flex; flex-wrap:wrap; gap:8px}
  .chip{padding:8px 15px; border-radius:999px; border:1px solid var(--line); background:rgba(6,18,30,0.55);
        color:var(--dim); font:600 12px var(--mono); letter-spacing:.06em; cursor:pointer;
        transition:.22s cubic-bezier(.2,.7,.3,1)}
  .chip:hover{border-color:var(--line2); color:var(--txt); transform:translateY(-1px)}
  .chip[aria-pressed="true"]{background:rgba(56,232,255,0.14); border-color:var(--cyan); color:#eafcff;
        box-shadow:0 0 18px rgba(56,232,255,0.18)}
  .search{position:relative; flex:1; min-width:230px; max-width:380px}
  .search input{width:100%; padding:10px 14px 10px 36px; border-radius:11px; border:1px solid var(--line);
        background:rgba(6,18,30,0.62); color:var(--txt); font:400 14px var(--sans); outline:none;
        transition:.2s}
  .search input:focus{border-color:var(--cyan); box-shadow:0 0 0 3px rgba(56,232,255,0.10)}
  .search svg{position:absolute; left:12px; top:11px; opacity:.55}
  .found{margin-left:auto; font:500 12px var(--mono); color:var(--dim2); letter-spacing:.1em}

  /* ── группы и сетка ──────────────────────────────────────────────────── */
  .group{margin:0 0 40px}
  .ghead{display:flex; align-items:baseline; gap:14px; margin-bottom:6px}
  .ghead h2{margin:0; font:600 20px var(--sans); letter-spacing:-0.01em}
  .ghead em{font:500 11px var(--mono); font-style:normal; letter-spacing:.14em; color:var(--dim2)}
  .gnote{margin:0 0 18px; font:400 13.5px/1.5 var(--sans); color:var(--dim); max-width:820px}
  .grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(316px,1fr)); gap:18px}

  /* ── карточка ────────────────────────────────────────────────────────── */
  .card{position:relative; border:1px solid var(--line); border-radius:16px; overflow:hidden;
        background:var(--card); cursor:pointer; text-align:left; padding:0; color:inherit; font:inherit;
        transition:transform .28s cubic-bezier(.2,.7,.3,1), border-color .28s, box-shadow .28s;
        animation:rise .5s cubic-bezier(.2,.7,.3,1) backwards}
  @keyframes rise{from{opacity:0; transform:translateY(14px)}to{opacity:1; transform:none}}
  .card:hover{transform:translateY(-4px); border-color:var(--line2);
        box-shadow:0 18px 46px rgba(0,0,0,0.55), 0 0 32px rgba(56,232,255,0.10)}
  .card:focus-visible{outline:2px solid var(--cyan); outline-offset:3px}
  .shot{position:relative; aspect-ratio:4/3; overflow:hidden; background:#020509}
  .shot img{width:100%; height:100%; object-fit:cover; display:block;
        transition:transform .5s cubic-bezier(.2,.7,.3,1), filter .4s; filter:saturate(1.05)}
  .card:hover .shot img{transform:scale(1.055); filter:saturate(1.18) brightness(1.06)}
  .shot::after{content:''; position:absolute; inset:0;
        background:linear-gradient(to top, rgba(6,18,30,0.92) 2%, rgba(6,18,30,0) 42%)}
  .beam{position:absolute; left:0; right:0; height:2px; top:-10%; opacity:0; z-index:2;
        background:linear-gradient(90deg, transparent, rgba(56,232,255,0.85), transparent)}
  .card:hover .beam{animation:sweep 1.5s cubic-bezier(.4,0,.2,1) infinite}
  @keyframes sweep{0%{top:-4%; opacity:0}12%{opacity:.9}100%{top:104%; opacity:0}}
  .body{position:relative; padding:14px 16px 16px; margin-top:-38px; z-index:2}
  .tag{font:600 10px var(--mono); letter-spacing:.16em; color:#6fcfe6; opacity:.92}
  .name{margin:6px 0 0; font:600 17.5px/1.25 var(--sans); letter-spacing:-0.01em}
  .hook{margin:7px 0 0; font:400 13px/1.45 var(--sans); color:var(--dim); min-height:37px}
  .meta{display:flex; flex-wrap:wrap; gap:6px; margin-top:13px}
  .pill{padding:4px 9px; border-radius:7px; border:1px solid rgba(56,232,255,0.14);
        background:rgba(56,232,255,0.05); font:500 10.5px var(--mono); letter-spacing:.06em; color:#9fd6e8}

  /* ── оверлей объекта ─────────────────────────────────────────────────── */
  .ov{position:fixed; inset:0; z-index:20; display:none; background:rgba(1,4,9,0.82); backdrop-filter:blur(10px)}
  .ov.on{display:flex; animation:fade .28s ease}
  @keyframes fade{from{opacity:0}to{opacity:1}}
  .sheet{display:flex; flex:1; margin:24px; border:1px solid var(--line2); border-radius:20px; overflow:hidden;
         background:linear-gradient(180deg, rgba(6,18,30,0.96), rgba(2,8,15,0.98));
         box-shadow:0 40px 120px rgba(0,0,0,0.7); animation:pop .34s cubic-bezier(.2,.7,.3,1)}
  @keyframes pop{from{transform:translateY(18px) scale(.985); opacity:0}to{transform:none; opacity:1}}
  .stage{flex:1.55; position:relative; background:#02060d; border-right:1px solid var(--line)}
  .stage iframe{position:absolute; inset:0; width:100%; height:100%; border:0}
  .stage .load{position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
        font:500 12px var(--mono); letter-spacing:.16em; color:var(--dim2)}
  .side{flex:1; max-width:400px; display:flex; flex-direction:column; min-width:330px}
  .shead{padding:20px 22px 16px; border-bottom:1px solid var(--line)}
  .shead .tag{display:block; margin-bottom:8px}
  .shead h3{margin:0; font:700 23px/1.2 var(--sans); letter-spacing:-0.01em}
  .scroll{flex:1; overflow-y:auto; padding:18px 22px 24px}
  .scroll::-webkit-scrollbar{width:9px} .scroll::-webkit-scrollbar-thumb{background:rgba(56,232,255,0.18); border-radius:9px}
  .scroll h4{margin:22px 0 10px; font:600 11px var(--mono); letter-spacing:.16em; color:#6fcfe6}
  .scroll h4:first-child{margin-top:0}
  .scroll p{margin:0; font:400 14px/1.6 var(--sans); color:var(--dim)}
  .scroll .lede{margin:0 0 4px; font:600 16px/1.4 var(--sans); color:var(--txt)}
  .scroll .tip{margin-top:16px; padding-top:14px; border-top:1px solid var(--line);
        font:400 12px/1.55 var(--sans); color:var(--dim2)}
  .scroll .meta{display:flex; flex-wrap:wrap; gap:6px}
  .sys{display:flex; flex-direction:column; gap:8px}
  .sys div{padding:10px 12px; border:1px solid var(--line); border-radius:10px; background:rgba(56,232,255,0.035)}
  .sys b{display:block; font:600 13.5px var(--sans); color:var(--txt)}
  .sys em{display:block; margin-top:3px; font:500 10px var(--mono); font-style:normal; letter-spacing:.14em; color:var(--dim2)}
  .sys p{margin-top:6px; font-size:12.5px; line-height:1.5}
  table{width:100%; border-collapse:collapse; font:400 13px var(--sans)}
  td{padding:7px 0; border-bottom:1px solid rgba(56,232,255,0.10); color:var(--dim)}
  td:last-child{text-align:right; color:var(--txt); font-family:var(--mono); font-size:12px}
  .acts{display:flex; gap:10px; padding:16px 22px; border-top:1px solid var(--line)}
  .btn{flex:1; padding:11px 12px; border-radius:11px; border:1px solid var(--line2); cursor:pointer;
       background:rgba(56,232,255,0.10); color:#eafcff; font:600 12.5px var(--sans); text-align:center;
       text-decoration:none; transition:.2s}
  .btn:hover{background:rgba(56,232,255,0.20); transform:translateY(-1px)}
  .btn.sec{background:rgba(6,18,30,0.6); color:var(--dim)}
  .nav{position:absolute; top:50%; transform:translateY(-50%); z-index:3; width:42px; height:42px;
       border-radius:50%; border:1px solid var(--line2); background:rgba(2,8,15,0.72); color:var(--txt);
       cursor:pointer; font-size:18px; line-height:1; transition:.2s}
  .nav:hover{background:rgba(56,232,255,0.18)}
  .nav.prev{left:14px} .nav.next{left:auto; right:calc(400px + 14px)}
  .hint{margin-top:26px; font:500 11px var(--mono); letter-spacing:.1em; color:var(--dim2); text-align:center}
  @media (max-width:1080px){ .sheet{flex-direction:column; margin:12px} .side{max-width:none; min-width:0}
    .stage{min-height:46vh; border-right:0; border-bottom:1px solid var(--line)} .nav{display:none} }
</style>
</head><body>
<div class="wrap">
  <header>
    <div class="brand"><i class="dot"></i><span>HOLO ENGINE · КАТАЛОГ</span></div>
    <h1>Голограммы объектов ЖКХ</h1>
    <p class="lead">Интерактивные рентген-модели коммунальной техники, инженерного оборудования и зданий.
      Каждый объект — самодостаточный офлайн-файл: открывается двойным кликом, работает без интернета,
      разбирается на системы и показывает потоки среды.</p>
    <div class="stats">
      <div class="stat"><b>${all.length}</b><span>ОБЪЕКТОВ</span></div>
      <div class="stat"><b>${groups.length}</b><span>КАТЕГОРИИ</span></div>
      <div class="stat"><b>${totalSystems}</b><span>СИСТЕМ</span></div>
      <div class="stat"><b>${totalMarkers}</b><span>УЗЛОВ-ВЫНОСОК</span></div>
      <div class="stat"><b>${kb(totalSize)}</b><span>ОФЛАЙН-ДАННЫХ</span></div>
    </div>
  </header>

  <div class="bar">
    <div class="chips" id="chips"></div>
    <label class="search">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6fcfe6" stroke-width="2">
        <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="q" type="search" placeholder="Поиск: насос, тормоз, пломба, ОДН…" autocomplete="off">
    </label>
    <div class="found" id="found"></div>
  </div>

  <main id="list"></main>
  <div class="hint">/ — поиск · Esc — закрыть · ← → — соседний объект</div>
</div>

<div class="ov" id="ov">
  <button class="nav prev" id="prev" title="Предыдущий">‹</button>
  <button class="nav next" id="next" title="Следующий">›</button>
  <div class="sheet">
    <div class="stage"><div class="load">ЗАГРУЗКА ГОЛОГРАММЫ…</div></div>
    <div class="side">
      <div class="shead"><span class="tag" id="ovTag"></span><h3 id="ovTitle"></h3></div>
      <div class="scroll" id="ovBody"></div>
      <div class="acts">
        <a class="btn" id="ovOpen" target="_blank" rel="noopener">Открыть в новой вкладке</a>
        <button class="btn sec" id="ovClose">Закрыть</button>
      </div>
    </div>
  </div>
</div>

<script>
const GROUPS = ${json(DATA)};
const THUMBS = ${json(THUMB_MAP)};
const FLAT = GROUPS.flatMap(g => g.items.map(o => ({...o, group: g.name})));
const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
// полный текст «как это работает» живёт в самой голограмме; в каталоге — аннотация
const short = (t, n = 340) => { t = String(t || ''); if (t.length <= n) return t;
  const cut = t.slice(0, n); const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return (dot > n * 0.5 ? cut.slice(0, dot + 1) : cut.trimEnd() + '…'); };

let filter = 'Все', query = '';
const chips = document.getElementById('chips');
['Все', ...GROUPS.map(g => g.name)].forEach(n => {
  const b = document.createElement('button');
  b.className = 'chip'; b.textContent = n; b.setAttribute('aria-pressed', n === 'Все');
  b.onclick = () => { filter = n; [...chips.children].forEach(c => c.setAttribute('aria-pressed', c === b)); render(); };
  chips.appendChild(b);
});

const hay = o => [o.title, o.hook, o.sub, o.desc, o.tag, ...o.parts.map(p => p.n + ' ' + p.t + ' ' + p.d),
                  ...o.flows, ...o.specs.map(r => r.join(' '))].join(' ').toLowerCase();

function render(){
  const q = query.trim().toLowerCase();
  const list = document.getElementById('list');
  let shown = 0; list.innerHTML = '';
  GROUPS.forEach(g => {
    if (filter !== 'Все' && filter !== g.name) return;
    const items = g.items.filter(o => !q || hay(o).includes(q));
    if (!items.length) return;
    shown += items.length;
    const sec = document.createElement('section'); sec.className = 'group';
    sec.innerHTML = '<div class="ghead"><h2>' + esc(g.name) + '</h2><em>' + items.length + ' ОБЪ.</em></div>'
                  + '<p class="gnote">' + esc(g.note) + '</p><div class="grid"></div>';
    const grid = sec.querySelector('.grid');
    items.forEach((o, i) => {
      const card = document.createElement('button');
      card.className = 'card'; card.style.animationDelay = Math.min(i * 45, 400) + 'ms';
      const src = THUMBS[o.file] ? 'data:image/jpeg;base64,' + THUMBS[o.file] : '';
      card.innerHTML =
        '<div class="shot"><i class="beam"></i>' +
        (src ? '<img loading="lazy" alt="" src="' + src + '">' : '') + '</div>' +
        '<div class="body"><div class="tag">' + esc(o.tag) + '</div>' +
        '<div class="name">' + esc(o.title) + '</div>' +
        '<div class="hook">' + esc(o.hook) + '</div>' +
        '<div class="meta">' +
          '<span class="pill">' + o.parts.length + ' СИСТЕМ</span>' +
          '<span class="pill">' + o.markers + ' УЗЛОВ</span>' +
          (o.flows.length ? '<span class="pill">' + o.flows.length + ' ПОТОКА</span>' : '') +
          '<span class="pill">' + esc(o.size) + '</span>' +
        '</div></div>';
      card.onclick = () => open(FLAT.indexOf(FLAT.find(x => x.file === o.file)));
      grid.appendChild(card);
    });
    list.appendChild(sec);
  });
  if (!shown) list.innerHTML = '<p class="gnote">Ничего не найдено. Попробуйте другой запрос.</p>';
  document.getElementById('found').textContent = shown + ' / ' + FLAT.length;
}

// ── оверлей ───────────────────────────────────────────────────────────────
const ov = document.getElementById('ov'), stage = ov.querySelector('.stage');
let cur = -1;
function open(i){
  if (i < 0 || i >= FLAT.length) return;
  cur = i; const o = FLAT[i];
  document.getElementById('ovTag').textContent = o.tag;
  document.getElementById('ovTitle').textContent = o.title;
  document.getElementById('ovOpen').href = o.file;
  // Панель НЕ повторяет правую колонку самой голограммы (там уже есть системы и
  // ТТХ) — здесь путеводитель: чему объект учит и что в нём стоит открыть.
  document.getElementById('ovBody').innerHTML =
    '<p class="lede">' + esc(o.hook) + '</p>' +
    '<h4>СУТЬ</h4><p>' + esc(short(o.desc)) + '</p>' +
    (o.keys.length ? '<h4>ЧТО ЗДЕСЬ СМОТРЕТЬ</h4><div class="sys">' +
      o.keys.map(k => '<div><b>' + esc(k.n) + '</b><p>' + esc(k.d) + '</p></div>').join('') + '</div>' : '') +
    (o.flows.length ? '<h4>ПОТОКИ СРЕДЫ</h4><div class="sys">' +
      o.flows.map(f => '<div><b>' + esc(f) + '</b></div>').join('') + '</div>' : '') +
    '<h4>В ОБЪЕКТЕ</h4><div class="meta">' +
      '<span class="pill">' + o.parts.length + ' СИСТЕМ</span>' +
      '<span class="pill">' + o.markers + ' УЗЛОВ</span>' +
      '<span class="pill">' + esc(o.size) + '</span>' +
      '<span class="pill">' + esc(o.mode) + '</span>' +
    '</div>' +
    '<p class="tip">Внутри: «Разобрать» — разнести на системы · «Потоки» — движение среды · ' +
    '«Вид» — настройка картинки · тяните мышью — поворот.</p>';
  stage.innerHTML = '<div class="load">ЗАГРУЗКА ГОЛОГРАММЫ…</div>';
  const fr = document.createElement('iframe');
  fr.src = o.file; fr.loading = 'eager';
  fr.onload = () => { const l = stage.querySelector('.load'); if (l) l.remove(); };
  stage.appendChild(fr);
  ov.classList.add('on'); document.body.style.overflow = 'hidden';
}
function close(){ ov.classList.remove('on'); stage.innerHTML = ''; document.body.style.overflow = ''; cur = -1; }
document.getElementById('ovClose').onclick = close;
document.getElementById('prev').onclick = () => open((cur - 1 + FLAT.length) % FLAT.length);
document.getElementById('next').onclick = () => open((cur + 1) % FLAT.length);
ov.addEventListener('click', e => { if (e.target === ov) close(); });

document.getElementById('q').addEventListener('input', e => { query = e.target.value; render(); });
addEventListener('keydown', e => {
  if (e.key === 'Escape' && cur >= 0) return close();
  if (e.key === '/' && document.activeElement.id !== 'q'){ e.preventDefault(); document.getElementById('q').focus(); }
  if (cur >= 0 && e.key === 'ArrowLeft') open((cur - 1 + FLAT.length) % FLAT.length);
  if (cur >= 0 && e.key === 'ArrowRight') open((cur + 1) % FLAT.length);
});
render();
</script>
</body></html>`;

fs.writeFileSync(path.resolve(OUT), html, 'utf8');
const size = fs.statSync(path.resolve(OUT)).size;
console.log('объектов:', all.length, '· систем:', totalSystems, '· бандлов:', kb(totalSize));
if (missThumb) console.log('без миниатюр:', missThumb);
if (missBundle) console.log('без бандлов:', missBundle);
console.log('✓', OUT, '(' + kb(size) + ')');
