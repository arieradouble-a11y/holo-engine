// Скриншот готовой голограммы (self-extracting HTML) через headless Chrome.
//   node render-html.mjs <file.html> <out.png> [waitMs=9000] [size=1000]
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [htmlPath, outPng, waitArg, sizeArg] = process.argv.slice(2);
const waitMs = parseInt(waitArg || '9000', 10);
const size = parseInt(sizeArg || '1000', 10);
const url = pathToFileURL(path.resolve(htmlPath)).href;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox','--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0,200)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0,200)); });
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, waitMs));   // дать движку распаковаться и отрисоваться
  const info = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    return { canvas: !!c, w: c?.width, h: c?.height, vis: document.visibilityState };
  });
  await page.screenshot({ path: outPng });
  console.log('shot', outPng, JSON.stringify(info), errs.length ? ('errs:' + errs.slice(0,4).join(' | ')) : 'clean');
} finally { await browser.close(); }
