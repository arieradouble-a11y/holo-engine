// Живая проверка собранного бандла и каталога в headless-браузере.
// Линтеры (floaters/flowcheck/build --check) читают КОНФИГ и до рантайма не
// добираются: примитив, которого нет в three r134 бандла, они пропускают
// (так молча падал CapsuleGeometry). Поэтому каждый объект перед заливкой
// обязан подняться живьём.
//
//   node tools/smoke.mjs "../Объект (голограмма).html" [ещё файлы…]
//   node tools/smoke.mjs --catalog "…/golomuzey/index.html"
//
// Что проверяется у бандла: создаётся ли WebGL-контекст, дошла ли загрузка до
// конца, сколько систем и узлов прочитал движок, есть ли ошибки в консоли.
// У каталога: открывается ли окно по доку, сколько карточек построилось и как
// они разложены по группам (кэш карточек живёт в окне — открыть надо кликом,
// как человек).
//
// ⚠ ДВЕ ОШИБКИ CORS НА file:// — ЭТО НОРМА, А НЕ РЕГРЕСС: бандл сам себя
// фетчит для «⧉ в конфиг», и по file:// браузер это запрещает. Проверять
// стоит РАЗНИЦУ с заведомо рабочим бандлом, а не ноль в абсолюте.
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const argv = process.argv.slice(2);
const CATALOG = argv.includes('--catalog');
const files = argv.filter(a => !a.startsWith('--'));
if (!files.length) { console.error('usage: smoke.mjs <bundle.html…> | --catalog <index.html>'); process.exit(1); }

const EXE = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CORS = /has been blocked by CORS policy|net::ERR_FAILED/;

const browser = await puppeteer.launch({
  executablePath: EXE, headless: 'new',
  // те же флаги, что у съёмки: без них headless рендерит программным
  // растеризатором и замеры/кадры перестают что-либо значить
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});

let bad = 0;
for (const f of files) {
  const page = await browser.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !CORS.test(m.text())) errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.setViewport({ width: 1366, height: 800 });
  await page.goto(pathToFileURL(path.resolve(f)).href, { waitUntil: 'load', timeout: 90000 });

  let info;
  if (CATALOG) {
    await new Promise(r => setTimeout(r, 1200));
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.dapp')].find(e => /Каталог/.test(e.textContent));
      if (b) b.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    info = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.item')];
      return {
        карточек: cards.length,
        видимых: cards.filter(c => c.offsetParent !== null).length,
        группы: [...document.querySelectorAll('.gtitle')].map(e => e.textContent.trim()).filter(t => /·/.test(t)),
      };
    });
  } else {
    await page.waitForFunction('window.__holo && window.__holo.progress > 0.99', { timeout: 90000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1800));
    info = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const h = window.__holo, C = (h && h.CONFIG) || {};
      return {
        webgl: !!(c && (c.getContext('webgl2') || c.getContext('webgl'))),
        готово: !!(h && h.progress > 0.99),
        систем: (C.parts || []).length,
        узлов: (C.markers || []).length,
        потоков: (C.flows || []).length,
      };
    });
  }
  if (errs.length) bad++;
  console.log(path.basename(f).slice(0, 46).padEnd(46), JSON.stringify(info), 'ошибок', errs.length, errs.slice(0, 2).join(' | '));
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
