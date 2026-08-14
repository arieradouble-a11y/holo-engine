// Композит: кадр видео + инфографика-оверлей (голо-стиль) через headless Chrome.
//   node render-overlay.mjs <video> <out.png> <time_s> [overlay.html|-] [w] [h]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [video, out, timeArg, overlayArg, wArg, hArg] = process.argv.slice(2);
const t = parseFloat(timeArg || '3');
const W = parseInt(wArg || '1280', 10), H = parseInt(hArg || '720', 10);
const overlay = overlayArg && overlayArg !== '-' ? fs.readFileSync(overlayArg, 'utf8') : '';
const vurl = pathToFileURL(path.resolve(video)).href;

const html = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#000;font-family:'Segoe UI',system-ui,sans-serif}
  #v{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  #ov{position:absolute;inset:0}
</style>
<video id="v" src="${vurl}" muted></video>
<div id="ov">${overlay}</div>
<script>
  const v=document.getElementById('v');
  v.addEventListener('loadeddata',()=>{ v.currentTime=${t}; });
  v.addEventListener('seeked',()=>{ requestAnimationFrame(()=>{ window.__ready=true; }); });
  v.addEventListener('error',()=>{ window.__err='video error '+(v.error&&v.error.code); window.__ready=true; });
</script>`;

const tmp = path.join(path.dirname(out), '_overlay_page.html');
fs.writeFileSync(tmp, html);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox','--allow-file-access-from-files','--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready===true', { timeout: 30000 }).catch(()=>{});
  const err = await page.evaluate(()=>window.__err||null);
  await page.screenshot({ path: out });
  console.log('shot', out, err ? ('ERR:'+err) : 'ok');
} finally { await browser.close(); }
