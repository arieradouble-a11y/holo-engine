// Миниатюры голограмм для каталога: открываем собранный бандл, ПРЯЧЕМ весь UI и
// снимаем чистую модель. Именно чистую: в каталоге карточка должна показывать
// объект, а не скриншот интерфейса с нечитаемым мелким текстом.
//
//   node tools/render-thumbs.mjs <out-dir> <file1.html> [file2.html …]
//
// Выход — JPEG ~900×640 (в каталоге масштабируется). JPEG, а не PNG: тёмный
// градиентный фон жмётся отлично, а каталог с 27 PNG весил бы десятки мегабайт.
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [outDir, ...files] = process.argv.slice(2);
if (!outDir || !files.length) {
  console.error('usage: render-thumbs.mjs <out-dir> <file.html> …'); process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const W = 1280, H = 800;
const CLIP = { x: 230, y: 80, width: 820, height: 615 };   // центр канваса, 4:3

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--use-gl=angle',
         '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist',
         '--enable-unsafe-swiftshader'] });

for (const file of files) {
  const name = path.basename(file).replace(/ \(голограмма\)\.html$/, '').replace(/\.html$/, '');
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  try {
    await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'load', timeout: 90000 });
    await new Promise(r => setTimeout(r, 11000));            // сборка модели + первый кадр

    // Камеру НЕ трогаем: вид по умолчанию уже 3/4 и выставлен под габарит модели.
    // Пробный доворот на 120 px уводил длинные объекты почти в торец.

    // прячем ВЕСЬ интерфейс: правую панель, заголовок с кнопками, футер, выноски
    await page.evaluate(() => {
      document.querySelectorAll('aside').forEach(e => (e.style.display = 'none'));
      document.querySelectorAll('div').forEach(d => {
        const z = d.style && d.style.zIndex;
        if (z === '8' || z === '7') d.style.display = 'none';   // панели и слой выносок
      });
    });
    await new Promise(r => setTimeout(r, 400));

    const out = path.join(outDir, name + '.jpg');
    await page.screenshot({ path: out, type: 'jpeg', quality: 74, clip: CLIP });
    const kb = (fs.statSync(out).size / 1024).toFixed(0);
    console.log('  ✓ ' + name + '  (' + kb + ' КБ)');
  } catch (e) {
    console.log('  ✗ ' + name + ': ' + String(e).slice(0, 90));
  }
  await page.close();
}
await browser.close();
console.log('готово →', outDir);
