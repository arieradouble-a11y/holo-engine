// Разведка донорской модели БЕЗ Blender: что внутри GLB и как его резать.
//
//   node tools/glb-info.mjs <file.glb> [ещё файлы…]
//
// Печатает: меши, примитивы, треугольники, материалы, узлы, габарит по min/max
// POSITION и — главное — АТРИБУЦИЮ из asset.extras. У моделей со Sketchfab там
// лежат автор, лицензия и ссылка: их нужно перенести в поле credits конфига,
// CC-BY без указания авторства нарушается.
//
// Дальше модель режется на per-part GLB инструментом donor-split.py (Blender).
import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  const b = fs.readFileSync(f);
  const jsonLen = b.readUInt32LE(12);
  const js = JSON.parse(b.slice(20, 20 + jsonLen).toString('utf8'));
  const prims = (js.meshes || []).flatMap(m => m.primitives || []);
  let tris = 0;
  for (const p of prims) {
    const acc = js.accessors[p.indices != null ? p.indices : p.attributes.POSITION];
    tris += acc.count / 3;
  }
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) {
    const a = js.accessors[p.attributes.POSITION];
    if (!a.min) continue;
    for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], a.min[i]); mx[i] = Math.max(mx[i], a.max[i]); }
  }
  const names = (js.nodes || []).map(n => n.name).filter(Boolean);
  const mats = (js.materials || []).map(m => m.name).filter(Boolean);
  console.log('\n' + f.split(/[\/]/).pop());
  console.log('  мешей', (js.meshes || []).length, '· примитивов', prims.length,
    '· треугольников', Math.round(tris).toLocaleString('ru'),
    '· материалов', (js.materials || []).length, '· текстур', (js.images || []).length,
    '· узлов', (js.nodes || []).length);
  console.log('  габарит (в единицах файла):', mn.map((v, i) => (mx[i] - v).toFixed(2)).join(' × '));
  console.log('  материалы:', mats.slice(0, 12).join(', ').slice(0, 200));
  console.log('  узлы:', names.slice(0, 12).join(', ').slice(0, 200));
  const ex = (js.asset && js.asset.extras) || {};
  if (ex.author) console.log('  автор:', ex.author, '· лицензия:', ex.license || '—');
  if (ex.source) console.log('  источник:', ex.source);
}
