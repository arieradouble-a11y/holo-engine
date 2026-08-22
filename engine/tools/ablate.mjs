// РАЗБОР КАДРА ПО СЛОЯМ: выключаем по одному и смотрим, сколько времени вернулось.
//
//   node tools/ablate.mjs "<file.html>" [--dpr=2] [--soft]
//
// Этим инструментом 20.08.2026 нашли, что 99% кадра у зданий — оболочка (без неё
// 0.3 мс вместо 22.3), а каркас/отражение/потоки/свечение вместе стоят 0.3 мс.
// Гадать, «что тут тяжёлое», по коду бесполезно — надо гасить слои по одному.
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DPR = +(process.argv.find(a => a.startsWith('--dpr='))?.slice(6) || 1);
// --soft: программный растеризатор вместо видеокарты. RTX 5080 упирается в пол
// измерения (всё 0.3 мс) и не отвечает на вопрос «что тяжело на слабой машине»;
// SwiftShader считает пиксели и вершины на процессоре и расставляет слои по цене.
const SOFT = process.argv.includes('--soft');
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox','--allow-file-access-from-files','--enable-gpu',SOFT ? '--use-angle=swiftshader' : '--use-angle=d3d11',
         SOFT ? '--enable-unsafe-swiftshader' : '--enable-gpu',
         '--ignore-gpu-blocklist','--disable-frame-rate-limit'] });

for (const file of process.argv.slice(2).filter(a => !a.startsWith('--'))) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: DPR });
  const t0 = Date.now();
  await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__holo && window.__holo.progress > 0.99', { timeout: 90000 });
  const load = Date.now() - t0;
  await new Promise(r => setTimeout(r, 1200));
  const out = await page.evaluate(async () => {
    const h = window.__holo, r = h.renderer;
    r.info.autoReset = false;
    // ⚠ На программном рендерере кадр идёт сотнями миллисекунд: замер «по времени»
    // собирал ноль-один отсчёт и падал на медиане. Ждём и время, И минимум кадров.
    const time = async (ms, minFrames = 8) => {
      r.info.reset(); const t = [];
      await new Promise(res => { let last = performance.now(), t0 = last, n = 0;
        const tick = () => { const now = performance.now(); if (n++) t.push(now - last); last = now;
          if (now - t0 < ms || t.length < minFrames) requestAnimationFrame(tick); else res(); };
        requestAnimationFrame(tick); });
      t.sort((a, b) => a - b);
      return +t[t.length >> 1].toFixed(2);
    };
    const set = (o, v) => { if (o) o.visible = v; };
    const res = { _v: { dense: h.lines.geometry.attributes.position.count,
                        bold: h.boldLines.geometry.attributes.position.count,
                        hot: h.innerLines.geometry.attributes.position.count,
                        hotShared: h.innerLines.geometry === h.lines.geometry,
                        canvas: [r.domElement.width, r.domElement.height] } };
    res['всё'] = await time(2500);
    set(h.shellGroup, false); res['без оболочки'] = await time(1500); set(h.shellGroup, true);
    set(h.reflect, false);    res['без отражения'] = await time(1500); set(h.reflect, true);
    set(h.innerLines, false); res['без внутр. каркаса'] = await time(1500); set(h.innerLines, true);
    set(h.boldLines, false);  res['без жирного каркаса'] = await time(1500); set(h.boldLines, true);
    set(h.lines, false);      res['без осн. каркаса'] = await time(1500); set(h.lines, true);
    set(h.flowGroup, false);  res['без потоков'] = await time(1500); set(h.flowGroup, true);
    const bloom = h.bloom || h.composer.passes.find(p => p.constructor.name === 'UnrealBloomPass');
    if (bloom) { bloom.enabled = false; res['без свечения'] = await time(1500); bloom.enabled = true; }
    const grade = h.composer.passes[h.composer.passes.length - 1];
    grade.enabled = false; res['без грейда'] = await time(1500); grade.enabled = true;
    ['shellGroup','reflect','innerLines','boldLines','lines','flowGroup','groundPlane'].forEach(k => set(h[k], false));
    res['пустая сцена (только пассы)'] = await time(1500);
    ['shellGroup','reflect','innerLines','boldLines','lines','flowGroup','groundPlane'].forEach(k => set(h[k], true));
    return res;
  });
  const v = out._v; delete out._v;
  const base = out['всё'];
  console.log(`${path.basename(file).replace(/ \(голограмма\)\.html$/, '')}  ·  загрузка до первого кадра ${(load/1000).toFixed(1)} с  ·  канвас ${v.canvas.join('×')}`);
  console.log(`  вершин линий: основной ${v.dense}, жирный ${v.bold}, внутренний ${v.hot}${v.hotShared ? ' (та же геометрия, что основной)' : ''}`);
  for (const [k, ms] of Object.entries(out))
    console.log(`  ${k.padEnd(28)} ${String(ms).padStart(6)} мс` + (k === 'всё' ? '' : `   (−${(base - ms).toFixed(2)} мс, ${Math.round((1 - ms / base) * 100)}%)`));
  await page.close();
}
await browser.close();
