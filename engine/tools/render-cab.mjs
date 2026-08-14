// Прицельные ракурсы кабины: фас, фас-3/4 и фокус на системе «Кабина»
// (клик по системе в списке сам наводит камеру — 70-scene.js selectPart).
//   node render-cab.mjs <file.html> <out-prefix>
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [htmlPath, prefix] = process.argv.slice(2);
const url = pathToFileURL(path.resolve(htmlPath)).href;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox','--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await new Promise(r => setTimeout(r, 11000));

const wait = ms => new Promise(r => setTimeout(r, ms));
async function drag(dx, dy) {
  const x0 = 520, y0 = 480;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x0 + dx * i / 12, y0 + dy * i / 12);
  await page.mouse.up();
  await wait(2200);
}
async function zoom(notches) {                       // deltaY<0 — приблизить
  for (let i = 0; i < Math.abs(notches); i++) {
    await page.mouse.move(520, 480);
    await page.mouse.wheel({ deltaY: notches < 0 ? -120 : 120 });
    await wait(160);
  }
  await wait(1800);
}
async function clickText(txt) {
  const ok = await page.evaluate(t => {
    const cand = [...document.querySelectorAll('button,li,[role=button],.btn,.part,.sys')]
      .filter(e => (e.textContent || '').includes(t));
    const el = cand.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
    if (el) { el.click(); return true; } return false;
  }, txt);
  await wait(2800);
  return ok;
}
const shot = async n => { await page.screenshot({ path: `${prefix}-${n}.png` }); console.log('  ✓', n); };

// сначала изолируем кабину — иначе свечение «горячего» насоса просвечивает
// сквозь полупрозрачную оболочку и забивает фас
console.log('  выбор системы «Кабина»:', await clickText('Кабина'));
await drag(-262, -45);  await shot('cab-front');     // az ~ -1.50  el ~ 0.15 — фас
await zoom(-5);         await shot('cab-front-zoom');
await drag(85, 8);      await shot('cab-front34');   // az ~ -0.82 — фас-3/4 крупно
await drag(85, 0);      await shot('cab-side34');    // az ~ -0.14 — почти профиль

console.log(errs.length ? 'errs: ' + errs.slice(0, 3).join(' | ') : 'clean');
await browser.close();
