// Замер цены кадра голограммы в НАСТОЯЩЕМ браузере с видеокартой.
//
//   node tools/perf.mjs "<file.html>" [ещё файлы…]  [--w 1280 --h 800] [--dpr 1]
//
// Панель браузера в сессии Claude Code скрыта → канвас 0×0, rAF заморожен, и
// любые тайминги оттуда — выдумка. Здесь puppeteer поднимает Chrome с ANGLE/D3D11
// (флаги те же, что у съёмки роликов), даёт канвасу реальный размер и меряет:
//   · медиану времени кадра по rAF (это и есть «сколько жуёт комп»),
//   · draw calls / треугольники / линии за кадр (renderer.info),
//   · сколько мешей в оболочке и вершин в каркасе.
// Второй прогон в четверть площади отвечает на главный вопрос оптимизации:
// упираемся в ЗАЛИВКУ (полноэкранные пассы) или в ГЕОМЕТРИЮ И ВЫЗОВЫ.
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? +argv[i + 1] : d; };
const files = argv.filter(a => !a.startsWith('--') && !/^\d+$/.test(a));
const W = opt('--w', 1280), H = opt('--h', 800), DPR = opt('--dpr', 1);
if (!files.length) { console.error('usage: perf.mjs "<file.html>" […]'); process.exit(1); }

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--enable-gpu',
         '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl',
         '--disable-frame-rate-limit'],   // иначе rAF режется до 60 и потолок не виден
});

// Замер внутри страницы: ждём готовности, гоняем rAF, снимаем renderer.info.
async function measure(page, ms) {
  return page.evaluate(async (ms) => {
    const h = window.__holo, r = h.renderer;
    r.info.autoReset = false; r.info.reset();
    const times = [];
    await new Promise(res => {
      let last = performance.now(), t0 = last, n = 0;
      const tick = () => {
        const now = performance.now();
        if (n++) times.push(now - last);
        last = now;
        if (now - t0 < ms) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    const info = { calls: r.info.render.calls, tris: r.info.render.triangles, lines: r.info.render.lines };
    times.sort((a, b) => a - b);
    const q = p => +times[Math.floor(times.length * p)].toFixed(2);
    return {
      frames: times.length, med: q(0.5), p90: q(0.9),
      fps: +(1000 / q(0.5)).toFixed(1),
      callsPerFrame: Math.round(info.calls / (times.length + 1)),
      trisPerFrame: Math.round(info.tris / (times.length + 1)),
      linesPerFrame: Math.round(info.lines / (times.length + 1)),
    };
  }, ms);
}

const rows = [];
for (const file of files) {
  const name = path.basename(file).replace(/ \(голограмма\)\.html$/, '');
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR });
  const t0 = Date.now();
  try {
    await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction('window.__holo && window.__holo.progress > 0.99', { timeout: 90000 });
    const load = ((Date.now() - t0) / 1000).toFixed(1);
    await new Promise(r => setTimeout(r, 1200));           // сборка модели доиграла

    const geo = await page.evaluate(() => {
      const h = window.__holo, r = h.renderer;
      const cnt = o => (o && o.geometry) ? o.geometry.attributes.position.count : 0;
      return {
        meshes: h.shellMeshes ? h.shellMeshes.length : 0,
        vDense: cnt(h.lines), vBold: cnt(h.boldLines), vHot: cnt(h.innerLines),
        outline: !!h.outlineOn, flows: h.flowGroup ? h.flowGroup.children.length : 0,
        labels: h.labelBox ? h.labelBox.children.length : 0,
        canvas: [r.domElement.width, r.domElement.height],
        gpu: (() => { const g = r.getContext(), d = g.getExtension('WEBGL_debug_renderer_info');
                      return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL).slice(0, 42) : '?'; })(),
      };
    });
    const full = await measure(page, 3500);
    await page.evaluate(() => { const h = window.__holo; h.renderer.setSize(innerWidth / 2, innerHeight / 2, false); h.onResize && h.onResize(); });
    const quarter = await measure(page, 2000);

    rows.push({ name, load, ...geo, full, quarter });
    if (process.env.HOLO_SHORT) { console.log(`${name}	${full.med}	${full.callsPerFrame}	${geo.meshes}	${geo.vDense + geo.vBold + geo.vHot}	${load}`); await page.close(); continue; }
    console.log(`${name}
  мешей оболочки ${geo.meshes}  ·  вершин каркаса ${geo.vDense}+${geo.vBold}+${geo.vHot}  ·  контур-пасс ${geo.outline ? 'ДА' : 'нет'}  ·  потоков ${geo.flows}
  ${W}×${H}: ${full.med} мс (${full.fps} fps), p90 ${full.p90} · вызовов/кадр ${full.callsPerFrame} · тр ${full.trisPerFrame} · лин ${full.linesPerFrame}
  четверть площади: ${quarter.med} мс (${quarter.fps} fps)   → ${(full.med / quarter.med).toFixed(2)}× (близко к 1 = упираемся в вызовы/геометрию, к 3-4 = в заливку)`);
  } catch (e) {
    console.log(`  ✗ ${name}: ${String(e).slice(0, 120)}`);
  }
  await page.close();
}
await browser.close();
console.log('\nGPU:', rows[0] && rows[0].gpu);
