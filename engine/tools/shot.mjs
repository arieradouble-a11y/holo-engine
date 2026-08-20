// ДЕТЕРМИНИРОВАННЫЙ КАДР: цикл остановлен, время в шейдерах зафиксировано.
//
//   node tools/shot.mjs <out.png> "<file.html>"      HOLO_EX=1 — снять разобранным
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
import { pathToFileURL } from 'node:url';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [out, file] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox','--allow-file-access-from-files','--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto(pathToFileURL(path.resolve(file)).href + (process.env.HOLO_EX ? '#ex=' + process.env.HOLO_EX : ''), { waitUntil: 'load', timeout: 90000 });
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
  h.uniforms.uTime.value = 2.5;
  h.uniforms.uScan.value = h.scanMin + 0.42 * (h.scanMax - h.scanMin);
  h.uniforms.uProgress.value = 1; h.progress = 1;
  const EX = +(new URLSearchParams(location.hash.slice(1)).get('ex') || 0);
  h.uniforms.uExplode.value = EX; h.explode = EX; h.explodeTarget = EX; h.updateShellExplode(EX);
  if (EX > 0) h.dist = Math.max(13, h.norm.height * 3.4);   // как в toggleExplode
  if (h.outUniforms) { h.outUniforms.uProgress.value = 1; h.outUniforms.uHover.value = 0; }
  h.az = 0.6; h.el = 0.42; h.dist = Math.max(8.5, h.norm.height * 2.4);
  h.parallaxAz = 0; h.parallaxEl = 0; h._viewAz = h.az;
  h.pivot.rotation.y = h.az;
  h.camera.fov = 42; h.camera.updateProjectionMatrix();
  const T = h.tgt = { x: 0, y: h.norm.height * 0.5, z: 0 };
  h.camera.position.set(T.x, T.y + Math.sin(h.el) * h.dist, T.z + Math.cos(h.el) * h.dist);
  h.camera.lookAt(T.x, T.y, T.z);
  h.composer.render(); h.renderOutline();
});
await new Promise(r => setTimeout(r, 200));
await page.screenshot({ path: out, type: 'png', clip: { x: 230, y: 80, width: 820, height: 615 } });
console.log('  ✓', path.basename(out));
await browser.close();
