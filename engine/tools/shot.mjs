// ДЕТЕРМИНИРОВАННЫЙ КАДР: цикл остановлен, время в шейдерах зафиксировано.
//
//   node tools/shot.mjs <out.png> "<file.html>"      HOLO_EX=1 — снять разобранным
//
// КРУПНЫЙ ПЛАН: HOLO_AZ / HOLO_EL (радианы), HOLO_DIST, HOLO_TX / HOLO_TY / HOLO_TZ
// (точка, куда смотрит камера, в НОРМАЛИЗОВАННЫХ единицах: x,z от центра модели,
// y от её низа). Без них ракурс прежний — расчётный azHome/elHome. Нужны, чтобы
// смотреть УЗЕЛ, а не всю модель: дефект потока у автокрана (30.08) на общем плане
// читался как «немного мимо», и только крупный план на оголовке показал, что трасса
// уходит вниз за 2.8 м до конца стрелы. HOLO_AZ=0 даёт строгий бок (камера на +Z).
//
// Это единственный способ честно ответить «не испортилась ли картинка»: обычная
// миниатюра пляшет на скан-полосе, и контрольное сравнение ДВУХ ПРОГОНОВ ОДНОГО
// файла давало 3-8% несовпавших пикселей — на таком фоне реальная регрессия
// неотличима от шума. С остановленным временем сравнение даёт ровно 0.
// Нужен, чтобы сравнивать сборки попиксельно — обычная миниатюра пляшет на
// скан-полосе (контроль «два прогона одного файла» давал 3-8% расхождения).
//
//   node tools/shot.mjs <out.png> "<file.html>"
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [out, file] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox','--allow-file-access-from-files','--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'] });
const page = await browser.newPage();
// ⚠ Каждой линии каркаса при сборке достаётся aSeed=Math.random() — от него
// зависят дрожание вершины и мерцание яркости. Поэтому ДВА ПРОГОНА ОДНОГО И
// ТОГО ЖЕ файла давали 2-3 единицы среднего расхождения и ~5% несовпавших
// пикселей: сравнивать сборки на таком фоне бессмысленно. Подменяем генератор
// на детерминированный ДО загрузки страницы — тогда контроль даёт ровно 0,
// и всё, что осталось, — настоящая разница.
// ⚠ Параметры НЕ через #hash в URL: рантайм на хеше монтирует компонент ВТОРОЙ
// раз, две сцены рисуют в два канваса поверх друг друга, и кадр становится ровно
// вдвое ярче (15.88 → 31.97 на одном и том же файле). Кладём в глобальную
// переменную до загрузки страницы.
await page.evaluateOnNewDocument((p) => { window.__SHOT = p; }, { az:+(process.env.HOLO_AZ??-99), el:+(process.env.HOLO_EL??-99), dist:+(process.env.HOLO_DIST??0), tx:+(process.env.HOLO_TX??0), ty:+(process.env.HOLO_TY??-99), tz:+(process.env.HOLO_TZ??0), ex: +(process.env.HOLO_EX||0), op: +(process.env.HOLO_OP||0), bt: +(process.env.HOLO_BT||-1), bs: +(process.env.HOLO_BS||0), rf: +(process.env.HOLO_RF||-1), gp: process.env.HOLO_GP!=null? +process.env.HOLO_GP : -1 });
await page.evaluateOnNewDocument(() => {
  let s = 123456789;
  Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
});
await page.setViewport({ width: 1280, height: 800 });
await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__holo && window.__holo.progress > 0.99', { timeout: 90000 });
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => {
  const h = window.__holo;
  h.stopped = true;                         // цикл больше не перерисовывает
  document.querySelectorAll('aside').forEach(e => (e.style.display = 'none'));
  document.querySelectorAll('div').forEach(d => { const z = d.style && d.style.zIndex; if (z === '8' || z === '7') d.style.display = 'none'; });
  const bar = document.getElementById('hmbar'); if (bar) bar.style.display = 'none';
});
await new Promise(r => setTimeout(r, 300));
await page.evaluate(() => {
  const h = window.__holo;
  // фиксируем ВСЁ, что зависит от времени: скан-полоса, сборка, разлёт, камера
  const OP = (window.__SHOT && window.__SHOT.op) || 0;
  if (OP > 0) h.uniforms.uShellOp.value = OP;
  const S = window.__SHOT || {};
  if (h.bloom) { if (S.bt >= 0) h.bloom.threshold = S.bt; if (S.bs > 0) h.bloom.strength = S.bs; }
  if (S.rf >= 0) h.uniforms.uRefl.value = S.rf;             // яркость отражения (0 = выключить)
  // пьедестал: HOLO_GP — прозрачность 0..1 (0 = выключить совсем), -1 = не трогать
  if (S.gp >= 0 && h.groundPlane) { h.groundPlane.material.opacity = S.gp; h.groundPlane.visible = S.gp > 0.001; }
  h.uniforms.uTime.value = 2.5;
  h.uniforms.uScan.value = h.scanMin + 0.42 * (h.scanMax - h.scanMin);
  h.uniforms.uProgress.value = 1; h.progress = 1;
  const EX = (window.__SHOT && window.__SHOT.ex) || 0;
  h.uniforms.uExplode.value = EX; h.explode = EX; h.explodeTarget = EX; h.updateShellExplode(EX);
  if (EX > 0) h.dist = Math.max(13, h.norm.height * 3.4);   // как в toggleExplode
  if (h.outUniforms) { h.outUniforms.uProgress.value = 1; h.outUniforms.uHover.value = 0; }
  // ⚠ Ракурс берём ТОТ, КОТОРЫЙ ВИДИТ ЧЕЛОВЕК (azHome/elHome — расчётный под
  // пропорции объекта), а не жёсткие 0.6/0.42: с хардкодом инструмент мерил
  // камеру, которой в жизни уже нет, и «завал» у широких домов оставался в
  // замере даже после того, как его починили в движке.
  h.az = (S.az > -90 ? S.az : (h.azHome != null ? h.azHome : 0.6));
  h.el = (S.el > -90 ? S.el : (h.elHome != null ? h.elHome : 0.42));
  h.dist = (S.dist > 0 ? S.dist : Math.max(8.5, h.norm.height * 2.4));
  h.parallaxAz = 0; h.parallaxEl = 0; h._viewAz = h.az;
  h.pivot.rotation.y = h.az;
  h.camera.fov = 42; h.camera.updateProjectionMatrix();
  const T = h.tgt = { x: (S.tx||0), y: (S.ty > -90 ? S.ty : h.norm.height * 0.5), z: (S.tz||0) };
  h.camera.position.set(T.x, T.y + Math.sin(h.el) * h.dist, T.z + Math.cos(h.el) * h.dist);
  h.camera.lookAt(T.x, T.y, T.z);
  // ⚠ Стрелки потоков — чистая функция времени, но замирают там, где их застал
  // stopped=true, то есть в РАЗНОЙ фазе от прогона к прогону. Без этой строки
  // контроль «один файл дважды» давал 2-5% несовпавших пикселей, и на таком фоне
  // настоящая разница неотличима от шума.
  h.updateFlows(2.5);
  if (h.renderFrame) h.renderFrame(); else h.composer.render();
  h.renderOutline();
});
// ⚠ page.screenshot при РЕАЛЬНОЙ видеокарте в headless отдаёт ЧЁРНЫЙ кадр:
// композитор не забирает содержимое WebGL-канваса (render-thumbs.mjs работает
// только потому, что гоняет программный растеризатор). Первая версия этого
// инструмента из-за этого сравнивала пустые картинки и радостно показывала
// «отклонение 0» на чём угодно. Забираем пиксели прямо с канваса —
// preserveDrawingBuffer у рендерера включён, toDataURL отдаёт настоящий кадр.
await new Promise(r => setTimeout(r, 200));
const dataUrl = await page.evaluate(() => window.__holo.renderer.domElement.toDataURL('image/png'));
fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
{ // страж: пустой кадр — это сломанный замер, а не «всё совпало»
  const png = fs.readFileSync(out);
  if (png.length < 20000) { console.error('  ✗ кадр подозрительно пуст: ' + png.length + ' Б'); process.exitCode = 1; }
}
console.log('  ✓', path.basename(out));
await browser.close();
