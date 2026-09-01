// СНИМОК ИНТЕРФЕЙСА (не модели): весь кадр целиком, вместе с панелями.
//
//   node tools/ui-shot.mjs <out.png> "<file.html>" [--w 1366] [--h 800] [--node 5] [--sys 2]
//
// render-thumbs.mjs прячет интерфейс и снимает голограмму, shot.mjs забирает
// пиксели прямо с канваса — ни тот, ни другой не показывают РАСКЛАДКУ. А именно
// её и ловят замечания вида «кнопки заезжают на объект» и «внизу тексты друг на
// друге»: линтеры читают конфиг, до DOM не добираются вовсе.
//
// Рендер программный (swiftshader) НАМЕРЕННО: с реальной видеокартой headless
// отдаёт чёрный канвас в page.screenshot, и панели снимать было бы не на чем.
// Замеры производительности этим скриптом делать НЕЛЬЗЯ — только раскладку.
//
// --node N выбирает узел из списка «Основные узлы», --sys N — систему: так
// проверяется, видно ли описание выбранного БЕЗ прокрутки.
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const positional = [];
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { i++; continue; } positional.push(argv[i]); }
const [out, file] = positional;
const W = +opt('--w', 1366), H = +opt('--h', 800);
const NODE = +opt('--node', -1), SYS = +opt('--sys', -1), TAB = opt('--tab', ''), TUNE = argv.includes('--tune');
if (!out || !file) { console.error('usage: ui-shot.mjs <out.png> <file.html> [--w N --h N --node N --sys N]'); process.exit(1); }

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--use-gl=angle',
         '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist',
         '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'load', timeout: 90000 });
await new Promise(r => setTimeout(r, 9000));

// клик по узлу/системе — как человек: по кнопке в списке правой панели
if (NODE >= 0 || SYS >= 0) {
  await page.evaluate((n, s) => {
    const aside = document.querySelector('aside'); if (!aside) return;
    const heads = [...aside.querySelectorAll('div')];
    const listAfter = (re) => {
      const h = heads.find(d => re.test(d.textContent || '') && d.children.length === 0);
      let el = h && h.nextElementSibling;
      return el ? [...el.querySelectorAll('button')] : [];
    };
    const btns = n >= 0 ? listAfter(/ОСНОВНЫЕ УЗЛЫ|УЗЛЫ/) : listAfter(/СИСТЕМЫ/);
    const b = btns[(n >= 0 ? n : s)]; if (b) b.click();
  }, NODE, SYS);
  await new Promise(r => setTimeout(r, 900));
}

// панель «⚙ Вид» — раскрыть, как человек: кнопкой в левой колонке
if (TUNE) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[style*="--hm-tools"] button')].find(x => /Вид/.test(x.textContent) && !/настройка/.test(x.textContent));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 600));
}

// телефон: открыть вкладку нижнего листа (кнопки #hmbar), как это делает палец
if (TAB) {
  await page.evaluate((t) => {
    const bar = document.getElementById('hmbar'); if (!bar) return;
    const idx = { parts: 0, info: 1, view: 2 }[t]; const b = bar.querySelectorAll('button')[idx];
    if (b) b.click();
  }, TAB);
  await new Promise(r => setTimeout(r, 700));
}

// что реально стоит в кадре: пересечения панелей ловим замером, а не на глаз
const geom = await page.evaluate(() => {
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null;
    const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const hook = (name) => box(`[style*="${name}"]`);
  const aside = document.querySelector('aside');
  const info = document.querySelector('[style*="--hm-info"]');
  return {
    head: hook('--hm-head'), tools: hook('--hm-tools'), side: aside ? (() => { const r = aside.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() : null,
    foot: hook('--hm-foot'), credf: hook('--hm-credf'),
    infoTop: info ? Math.round(info.getBoundingClientRect().top) : null,
    infoVisible: info ? (() => { const r = info.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; })() : null,
    vp: { w: window.innerWidth, h: window.innerHeight },
  };
});
console.log(JSON.stringify(geom, null, 1));
await page.screenshot({ path: path.resolve(out), type: 'png' });
await browser.close();
console.log('кадр →', out);
