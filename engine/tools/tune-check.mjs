// СТРАЖ ПАНЕЛИ «⚙ Вид»: значения ползунков обязаны совпадать с настоящими.
//
//   node tools/tune-check.mjs "<file.html>"
//
// Панель собирается из buildEdges, то есть ДО того, как в init() создан composer
// с блумом, — и до 22.08.2026 ползунок «Свечение (bloom)» всегда показывал 0 при
// живом strength 0.4-0.5. Пользователь это увидел так: «блум стоит ноль, как
// только его подвинешь — блум выключается». Проверка открывает панель как человек
// (toggleTune), читает подписи и сравнивает их с движком, затем двигает ползунок
// и проверяет, что значение доехало.
// Проверка панели «⚙ Вид»: значения ползунков против настоящих значений движка.
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser=await puppeteer.launch({executablePath:CHROME,headless:'new',
  args:['--no-sandbox','--allow-file-access-from-files','--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist']});
const page=await browser.newPage(); await page.setViewport({width:1366,height:800,deviceScaleFactor:1});
const errs=[]; page.on('pageerror',e=>errs.push(String(e).slice(0,160)));
await page.goto(pathToFileURL(path.resolve(process.argv[2])).href,{waitUntil:'load',timeout:90000});
await page.waitForFunction('window.__holo && window.__holo.progress>0.99',{timeout:90000});
await new Promise(r=>setTimeout(r,1200));
const out=await page.evaluate(async()=>{
  const h=window.__holo; h.toggleTune();                       // открыть панель, как это делает пользователь
  await new Promise(r=>setTimeout(r,300));
  const rows=[...h.tuneEl.querySelectorAll('input[type=range]')].map((inp,i)=>{
    const lab=inp.parentElement.querySelector('span+span');
    return {имя:inp.parentElement.querySelector('span').textContent, ползунок:+inp.value, подпись:lab.textContent};
  });
  const truth={bloom:h.bloom?h.bloom.strength:null, пьедестал:h.groundPlane?h.groundPlane.material.opacity:null,
               оболочка:h.uniforms.uShellOp.value, отражение:h.uniforms.uRefl.value};
  // подвинуть «Свечение» на 0.8 и проверить, что доехало до движка
  const bl=rows.findIndex(r=>/Свечение/.test(r.имя));
  const inp=[...h.tuneEl.querySelectorAll('input[type=range]')][bl];
  inp.value=0.8; inp.oninput();
  return {rows, truth, послеСдвига:h.bloom.strength};
});
console.log(JSON.stringify(out,null,1)); console.log(errs.length?'ОШИБКИ: '+errs.join(' | '):'ошибок нет');
await browser.close();
