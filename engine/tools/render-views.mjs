// Несколько ракурсов одной голограммы: тянем мышью по канвасу (az += dx*0.008,
// el += dy*0.006) и жмём кнопки по тексту.
//   node render-views.mjs <file.html> <out-prefix>
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [htmlPath, prefix] = process.argv.slice(2);
const url = pathToFileURL(path.resolve(htmlPath)).href;
const W = 1600, H = 900;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox','--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await new Promise(r => setTimeout(r, 11000));

const wait = ms => new Promise(r => setTimeout(r, ms));
async function drag(dx, dy) {                       // относительный поворот камеры
  const x0 = 520, y0 = 520;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  const N = 12;
  for (let i = 1; i <= N; i++) await page.mouse.move(x0 + dx * i / N, y0 + dy * i / N);
  await page.mouse.up();
  await wait(2200);
}
async function clickText(txt) {
  const ok = await page.evaluate(t => {
    const el = [...document.querySelectorAll('button, [role=button], .btn')]
      .find(b => (b.textContent || '').includes(t));
    if (el) { el.click(); return true; } return false;
  }, txt);
  await wait(2600);
  return ok;
}
const shot = async name => { await page.screenshot({ path: `${prefix}-${name}.png` }); console.log('  ✓', name); };

await shot('01-default');                            // az 0.60  el 0.42
await drag(-75, -48);   await shot('02-profile');    // az ~0     el ~0.13  — вид сбоку
await drag(-100, 12);   await shot('03-front34');
await drag(430, 10);    await shot('04-rear34');
console.log('  разобрать:', await clickText('Разобрать'));
await shot('05-exploded');

console.log(errs.length ? 'errs: ' + errs.slice(0, 4).join(' | ') : 'clean');
await browser.close();
