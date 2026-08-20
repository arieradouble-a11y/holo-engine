// Сколько примитивов движок реально строит для объекта — и из чего они состоят.
//
//   node tools/count-prims.mjs ctp itp mkd …
//
// Работает и для декларативных объектов (geometry в конфиге), и для тех, что ещё
// строятся хардкодом в src/modules/10-generators.js: скрипт подключает модуль как
// тело класса и вызывает buildProceduralModel со стабом meshData. Поэтому им можно
// сравнивать плотность разных объектов между собой — именно так выяснилось, что
// здания получали 65–130 примитивов на зал 20 м, тогда как ИТП размером 3 м — 391.
//
// Печатает: всего примитивов, число материалов и топ материалов по количеству.
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';

const names = process.argv.slice(2);
if (!names.length) { console.error('usage: count-prims.mjs <config-id> [config-id …]'); process.exit(1); }
const src = fs.readFileSync(path.join('src', 'modules', '10-generators.js'), 'utf8');
const Gen = new Function('THREE', `return class G {\n${src}\n}`)(THREE);

for (const name of names) {
  const file = path.join('configs', name.replace(/\.json$/, '') + '.json');
  if (!fs.existsSync(file)) { console.log(name.padEnd(16), 'нет конфига'); continue; }
  const g = new Gen();
  g.CONFIG = JSON.parse(fs.readFileSync(file, 'utf8'));
  g.meshData = [];
  try { g.buildProceduralModel(THREE); }
  catch (e) { console.log(name.padEnd(16), 'ошибка:', String(e).slice(0, 120)); continue; }
  const byMat = {};
  for (const m of g.meshData) byMat[m.mat] = (byMat[m.mat] || 0) + 1;
  const top = Object.entries(byMat).sort((a, b) => b[1] - a[1]);
  console.log(name.padEnd(16), String(g.meshData.length).padStart(6),
    ' материалов:', String(top.length).padStart(3),
    ' ', top.slice(0, 8).map(([k, v]) => k + ':' + v).join(' '));
}
