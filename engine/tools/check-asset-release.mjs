// Browser smoke check of the collected museum and detailed-house snapshots.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';
import {fork} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const museum=JSON.parse(fs.readFileSync(path.join(root,'examples/mediashtab/golomuzey/museum-glossary-index.json')));
const houses=JSON.parse(fs.readFileSync(path.join(root,'examples/house-detail/houses/catalog.json')));
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
fs.mkdirSync(path.join(root,'reports/local'),{recursive:true});
const rows=process.argv.includes('--web-only')?JSON.parse(fs.readFileSync(path.join(root,'reports/asset-release-browser.json'))).checks.filter(r=>r.kind!=='web-integration'):[];
const base='http://127.0.0.1:8879';
const server=fork(path.join(root,'engine/tools/serve-examples.mjs'),[],{env:{...process.env,PORT:'8879'},silent:true});
try {
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error('Preview server exited: '+code)));});
  if(!process.argv.includes('--web-only')) {
  for(const [kind,files] of [['museum',museum.map(o=>'examples/mediashtab/golomuzey/'+o.file)],['houses',houses.map(o=>'examples/house-detail/houses/'+o.id+'.html')]]) {
    for(const file of files) {
      const page=await browser.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(String(e)));
      await page.setViewport({width:1366,height:800});
      let state;
      try {
        await page.goto(pathToFileURL(path.join(root,file)).href,{waitUntil:'load'});
        await page.waitForFunction('window.__holo?.progress > .99',{timeout:45000});
        state=await page.evaluate(()=>{const h=window.__holo;return {loaded:h.progress,systems:h.PARTDEF.length,webgl:!!h.renderer.getContext(),detailObjects:h.pilotDetails?.length||0};});
      } catch(e) {errors.push(String(e));}
      const pass=!!state?.webgl&&state.systems>0&&!errors.length;
      rows.push({kind,file,pass,...state,errors});await page.close();
      console.log(`${rows.length}/74 ${pass?'PASS':'FAIL'} ${path.basename(file)}`);
    }
  }
  }
  const page=await browser.newPage(),errors=[],missing=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))missing.push(r.url());});
  await page.goto(base+'/golomuzey/');
  await page.waitForFunction('document.querySelector(".dapp")');
  await page.evaluate(()=>[...document.querySelectorAll('.dapp')].find(e=>/Каталог/.test(e.textContent))?.click());
  await page.waitForFunction('document.querySelectorAll(".item").length===60');
  const cards=await page.evaluate(()=>document.querySelectorAll('.item').length);
  await page.goto(base+'/metavselennaya/#glossary?q=КНС');
  await page.waitForSelector('#glossary-query');
  const dictionary=await page.$eval('#glossary-results',e=>e.textContent.includes('Канализационная насосная станция'));
  rows.push({kind:'web-integration',pass:cards===60&&dictionary&&!errors.length&&!missing.length,cards,dictionary,errors,missing});
  await page.screenshot({path:path.join(root,'reports/local/glossary.png')});
} finally {
  server.kill();
  await browser.close();
  fs.mkdirSync(path.join(root,'reports'),{recursive:true});
  fs.writeFileSync(path.join(root,'reports/asset-release-browser.json'),JSON.stringify({date:'2026-10-12',renderer:'SwiftShader; functionality only, not physical-device performance',pass:rows.length===75&&rows.every(r=>r.pass),checks:rows},null,2)+'\n');
}
if(rows.length!==75||rows.some(r=>!r.pass))process.exitCode=1;
