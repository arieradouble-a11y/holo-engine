#!/usr/bin/env node
/* ============================================================================
 *  HOLO ENGINE — build pipeline
 *
 *  Assembles a self-contained, offline-capable holographic viewer (.html) from:
 *    - a GLB model
 *    - a JSON config (title, parts, material rules, explode dirs, accent…)
 *    - a shared runtime (Three.js + addons + Draco + fonts), reused verbatim
 *      from an existing reference bundle (the "Суперкар" file).
 *
 *  The reference bundle already embeds, gzip+base64, the entire runtime:
 *  three.min, GLTFLoader, DRACOLoader, EffectComposer, UnrealBloomPass, the
 *  Draco wasm decoder, the IBM Plex fonts and the DC component framework. We
 *  keep all of that, drop only the reference car model, and splice in the new
 *  model + the generalized viewer body. Output format is byte-compatible with
 *  the reference: an unpacker that decodes assets to blob URLs at load time.
 *
 *  Usage:
 *    node build.js --snapshot                      # once: runtime → engine/runtime.json
 *    node build.js --config configs/ilosos.json --model "../Илосос.glb" \
 *                  --out "../Илосос (голограмма).html"
 *    node build.js --config configs/ctp.json --check   # validate config only
 *
 *  Builds prefer engine/runtime.json (see --snapshot), so the 15MB reference
 *  bundle is only needed to (re)create the snapshot; --runtime overrides.
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

// ---- args ------------------------------------------------------------------
function parseArgs(argv){
  const o = {};
  for (let i = 2; i < argv.length; i++){
    const a = argv[i];
    if (a.startsWith('--')){ o[a.slice(2)] = (argv[i+1] && !argv[i+1].startsWith('--')) ? argv[++i] : true; }
  }
  return o;
}
const args = parseArgs(process.argv);
const ENGINE_DIR = __dirname;
const DEFAULT_RUNTIME = path.resolve(ENGINE_DIR, '..', 'Суперкар (оффлайн).html');
const RUNTIME_SNAPSHOT = path.resolve(ENGINE_DIR, 'runtime.json');

// ---- runtime bundle ----------------------------------------------------------
const REF_CAR_UUID = '3c08dfad-f133-46eb-8d01-d32fcfa01e55'; // reference car model asset, dropped

function readBundle(p){
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  const find = (type) => lines.findIndex(l => l.includes('<script type="' + type + '">'));
  const mi = find('__bundler/manifest');
  const ei = find('__bundler/ext_resources');
  const ti = find('__bundler/template');
  if (mi < 0 || ei < 0 || ti < 0) throw new Error('runtime bundle missing __bundler script tags');
  return {
    prefix:   lines.slice(0, mi).join('\n'),          // unpacker + thumbnail + <head>
    manifest: JSON.parse(lines[mi + 1]),
    ext:      JSON.parse(lines[ei + 1]),
    template: JSON.parse(lines[ti + 1]),
    suffix:   lines.slice(ti + 3).join('\n'),         // trailing </body></html>
  };
}

// The reusable part of the reference bundle: three.js + addons + Draco + fonts +
// unpacker + template head — with the reference car model dropped.
function makeRuntime(bundle){
  const manifest = {};
  for (const [k, v] of Object.entries(bundle.manifest)) if (k !== REF_CAR_UUID) manifest[k] = v;
  const ext = bundle.ext.filter(e => e.id !== 'carModel');
  const cut = bundle.template.indexOf('</helmet>');
  if (cut < 0) throw new Error('reference template has no </helmet> boundary');
  return {
    prefix: bundle.prefix,
    manifest, ext,
    templateHead: bundle.template.slice(0, cut + '</helmet>'.length),
    suffix: bundle.suffix,
  };
}

// --snapshot: extract the runtime ONCE → engine/runtime.json. After that builds
// read the snapshot and no longer need the 15MB reference file at all.
if (args.snapshot){
  const src = path.resolve(typeof args.snapshot === 'string' ? args.snapshot : (args.runtime || DEFAULT_RUNTIME));
  const rt = makeRuntime(readBundle(src));
  rt.meta = { source: path.basename(src), created: new Date().toISOString(), assets: Object.keys(rt.manifest).length };
  fs.writeFileSync(RUNTIME_SNAPSHOT, JSON.stringify(rt));
  console.log('✓ снапшот рантайма:', path.basename(src), '→ runtime.json',
              '(' + (fs.statSync(RUNTIME_SNAPSHOT).size / 1e6).toFixed(1) + 'MB, assets: ' + rt.meta.assets + ')');
  process.exit(0);
}

if (!args.config){
  console.error('Usage: node build.js --config <cfg.json> [--model <model.glb>] [--out <out.html>] [--runtime <bundle.html>] [--check]');
  console.error('       node build.js --snapshot            # извлечь рантайм из референс-бандла в engine/runtime.json');
  process.exit(1);
}
const configPath  = path.resolve(args.config);
const config      = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const procedural  = config.source === 'procedural';

// part-aware import: a folder of per-part GLBs (PartCrafter/PartPacker "path saving").
// Each file becomes one selectable system; keys (partNN) double as material tags so the
// existing structured pipeline (matRules -> matToPart) segments them with no other changes.
const partsMode   = !!args.parts || config.source === 'parts';
let partsDir = null, partFiles = [];
if (partsMode){
  partsDir  = path.resolve(args.parts || config.partsDir || '.');
  if (!fs.existsSync(partsDir) || !fs.statSync(partsDir).isDirectory()){
    console.error('Error: --parts directory not found: ' + partsDir); process.exit(1);
  }
  partFiles = fs.readdirSync(partsDir).filter(f => /\.glb$/i.test(f)).sort();
  if (!partFiles.length){ console.error('Error: no .glb parts found in ' + partsDir); process.exit(1); }
  config.source     = 'parts';
  config.partAssets = partFiles.map((_, i) => 'part' + String(i).padStart(2, '0'));
  if (!config.mode) config.mode = 'structured';
  if (!config.parts || !config.parts.length)
    config.parts = partFiles.map((f, i) => ({ key: config.partAssets[i], name: path.basename(f, path.extname(f)), tag: 'ЧАСТЬ', desc: '' }));
  if (!config.matRules || !config.matRules.length)
    config.matRules = config.partAssets.map((k, i) => ({ match: [k], part: i }));
}

// ---- config validation (ловим ошибки авторинга при сборке, а не в браузере) --
function validateConfig(cfg){
  const errs = [], warns = [];
  const parts = cfg.parts || [];
  const keys = new Set(parts.map(p => p.key));
  parts.forEach((p, i) => { if (!p.key || !p.name) errs.push('parts[' + i + ']: нужны key и name'); });
  if (parts.length){
    (cfg.matRules || []).forEach((r, i) => {
      if (!Array.isArray(r.match) || !r.match.length) errs.push('matRules[' + i + ']: пустой match');
      if (!Number.isInteger(r.part) || r.part < 0 || r.part >= parts.length)
        errs.push('matRules[' + i + ']: part=' + r.part + ' вне диапазона систем 0..' + (parts.length - 1));
    });
    if (cfg.defaultPart != null && (cfg.defaultPart < 0 || cfg.defaultPart >= parts.length))
      errs.push('defaultPart=' + cfg.defaultPart + ' вне диапазона систем');
  }
  (cfg.hotParts || []).forEach(k => { if (!keys.has(k)) errs.push('hotParts: «' + k + '» нет среди parts.key'); });
  if (cfg.innerPartKey && !keys.has(cfg.innerPartKey)) errs.push('innerPartKey: «' + cfg.innerPartKey + '» нет среди parts.key');
  Object.keys(cfg.explodeDirs || {}).forEach(k => { if (!keys.has(k)) warns.push('explodeDirs: «' + k + '» нет среди parts.key — будет проигнорирован'); });
  (cfg.markers || []).forEach((m, i) => {
    const id = 'markers[' + i + '] «' + (m.name || '') + '»';
    if (!Array.isArray(m.at) || m.at.length !== 3 || m.at.some(v => typeof v !== 'number'))
      errs.push(id + ': at должен быть [fx,fy,fz]');
    else if (m.at.some(v => v < -0.05 || v > 1.15))
      warns.push(id + ': at=' + JSON.stringify(m.at) + ' заметно вне bbox [0..1]');
  });
  (cfg.flows || []).forEach((f, i) => {
    const id = 'flows[' + i + '] «' + (f.kind || '') + '»';
    if (!Array.isArray(f.at) || f.at.length < 2) errs.push(id + ': нужно ≥2 точек at');
    else f.at.forEach((p, j) => {
      if (!Array.isArray(p) || p.length !== 3 || p.some(v => typeof v !== 'number')) errs.push(id + '.at[' + j + ']: точка должна быть [fx,fy,fz]');
    });
    if (f.color && (f.color.length !== 3 || f.color.some(v => typeof v !== 'number'))) errs.push(id + ': color должен быть [r,g,b]');
  });
  if (cfg.hotColor && cfg.hotColor.length !== 3) errs.push('hotColor должен быть [r,g,b]');
  // declarative geometry: {box|cyl|frustum:[…]} | {at?,repeat?,step?,items:[…]}
  function checkGeometry(items, at){
    items.forEach((it, i) => {
      const id = at + '[' + i + ']';
      if (Array.isArray(it.items)){
        if (it.repeat != null && (!Number.isInteger(it.repeat) || it.repeat < 1)) errs.push(id + ': repeat должен быть целым ≥1');
        ['at', 'step'].forEach(k => { if (it[k] && (it[k].length !== 3 || it[k].some(v => typeof v !== 'number'))) errs.push(id + ': ' + k + ' должен быть [dx,dy,dz]'); });
        checkGeometry(it.items, id + '.items');
        return;
      }
      const shape = ['box', 'cyl', 'frustum'].find(s => it[s] !== undefined);
      if (!shape){ errs.push(id + ': нужен box | cyl | frustum | items'); return; }
      const a = it[shape];
      if (!Array.isArray(a)){ errs.push(id + '.' + shape + ': должен быть массивом'); return; }
      const matIdx = shape === 'cyl' ? 5 : 6;                       // числа до mat, потом mat (+axis у cyl)
      const lenOk = shape === 'cyl' ? (a.length === 6 || a.length === 7) : a.length === 7;
      if (!lenOk){ errs.push(id + '.' + shape + ': ожидается ' + (shape === 'cyl' ? '6–7' : '7') + ' элементов, получено ' + a.length); return; }
      if (a.slice(0, matIdx).some(v => typeof v !== 'number')) errs.push(id + '.' + shape + ': параметры до mat должны быть числами');
      if (typeof a[matIdx] !== 'string') errs.push(id + '.' + shape + ': mat должен быть строкой');
      if (shape === 'cyl' && a[6] != null && !['x', 'y', 'z'].includes(a[6])) errs.push(id + '.cyl: axis должен быть x|y|z');
    });
  }
  const hasGeometry = Array.isArray(cfg.geometry) && cfg.geometry.length > 0;
  if (cfg.geometry != null && !hasGeometry) errs.push('geometry: должен быть непустым массивом');
  if (hasGeometry) checkGeometry(cfg.geometry, 'geometry');
  if (procedural && !hasGeometry){
    const t = (cfg.building && cfg.building.type) || 'mkd';
    if (!['mkd', 'boiler', 'power', 'ctp'].includes(t)) warns.push('building.type=«' + t + '» неизвестен движку — сработает генератор МКД');
  }
  return { errs, warns };
}
{
  const v = validateConfig(config);
  v.warns.forEach(w => console.warn('  ⚠ ' + w));
  if (v.errs.length){
    v.errs.forEach(e => console.error('  ✗ ' + e));
    console.error('✗ конфиг не прошёл проверку: ' + v.errs.length + ' ошибок');
    process.exit(1);
  }
  if (args.check){
    console.log('✓ конфиг корректен: ' + path.basename(configPath) + (v.warns.length ? ' (предупреждений: ' + v.warns.length + ')' : ''));
    process.exit(0);
  }
}

if (!args.model && !procedural && !partsMode){
  console.error('Error: --model is required (config.source is not "procedural" and --parts not given)');
  process.exit(1);
}
const modelPath   = args.model ? path.resolve(args.model) : null;
const runtimePath = path.resolve(args.runtime || DEFAULT_RUNTIME);
const outDir      = modelPath ? path.dirname(modelPath) : path.resolve(ENGINE_DIR, '..');
const outPath     = path.resolve(args.out || path.join(outDir, (config.title || 'object') + ' (голограмма).html'));

// Тело вьювера: src/viewer.html (шаблон + каркас класса) + src/modules/*.js
// (методы класса по секциям), склейка по алфавиту имён — без бандлера.
function readViewerBody(){
  const shell = fs.readFileSync(path.join(ENGINE_DIR, 'src', 'viewer.html'), 'utf8');
  const TOKEN = '  /* __ENGINE_MODULES__ */';
  if (!shell.includes(TOKEN)) throw new Error('src/viewer.html missing "__ENGINE_MODULES__" token');
  const modDir = path.join(ENGINE_DIR, 'src', 'modules');
  const mods = fs.readdirSync(modDir).filter(f => f.endsWith('.js')).sort();
  if (!mods.length) throw new Error('src/modules is empty');
  return shell.replace(TOKEN, mods.map(f => fs.readFileSync(path.join(modDir, f), 'utf8')).join('\n'));
}

config.modelKey = config.modelKey || 'objModel';

// ---- helpers ---------------------------------------------------------------
// glTF binary JSON-chunk inspector (no three.js needed in node)
function inspectGLB(buf){
  if (buf.readUInt32LE(0) !== 0x46546C67) return { error: 'not a GLB' };
  let off = 12, json = null;
  while (off < buf.length){
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4); off += 8;
    if (type === 0x4E4F534A) json = JSON.parse(buf.slice(off, off + len).toString('utf8'));
    off += len;
  }
  if (!json) return { error: 'no JSON chunk' };
  const meshes = json.meshes || [], mats = json.materials || [];
  let prims = 0, verts = 0;
  meshes.forEach(m => (m.primitives || []).forEach(pr => {
    prims++;
    const a = json.accessors && json.accessors[pr.attributes && pr.attributes.POSITION];
    if (a) verts += a.count || 0;
  }));
  return {
    meshes: meshes.length, primitives: prims, materials: mats.length,
    nodes: (json.nodes || []).length, verts,
    draco: (json.extensionsUsed || []).includes('KHR_draco_mesh_compression'),
    matNames: mats.map(m => m.name || '').filter(Boolean),
  };
}

// generic holographic loading thumbnail (replaces the car-specific one)
function genericThumb(label){
  const t = (label || 'ГОЛОГРАММА').toUpperCase().slice(0, 40);
  return `<svg viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="800" fill="#02060d"></rect>
    <g fill="none" stroke="#38e8ff" stroke-width="3" opacity="0.85">
      <ellipse cx="600" cy="430" rx="250" ry="84"></ellipse>
      <ellipse cx="600" cy="430" rx="170" ry="57" opacity="0.6"></ellipse>
      <ellipse cx="600" cy="430" rx="90" ry="30" opacity="0.4"></ellipse>
      <line x1="600" y1="180" x2="600" y2="660" opacity="0.25"></line>
      <line x1="320" y1="430" x2="880" y2="430" opacity="0.25"></line>
    </g>
    <circle cx="600" cy="430" r="7" fill="#38e8ff"></circle>
    <text x="600" y="730" text-anchor="middle" fill="#6fcfe6" font-family="monospace" font-size="30" letter-spacing="6">${t}</text>
  </svg>`;
}

// ---- build -----------------------------------------------------------------
// Рантайм: приоритет у снапшота engine/runtime.json (см. --snapshot); явный
// --runtime <бандл> заставляет читать референс-файл напрямую.
const useSnapshot = !args.runtime && fs.existsSync(RUNTIME_SNAPSHOT);
console.log('· runtime :', useSnapshot ? 'runtime.json (снапшот)' : path.basename(runtimePath));
console.log('· config  :', path.basename(configPath));

let glb = null;
if (procedural){
  console.log('· source  : procedural (' + ((config.building&&config.building.type)||'building') + ') — no GLB');
  console.log('· mode    :', config.mode || 'structured', '| parts:'+((config.parts||[]).length));
} else if (partsMode){
  console.log('· source  : parts (' + partFiles.length + ' GLB) —', partsDir);
  console.log('· parts   :', partFiles.join(', '));
} else {
  console.log('· model   :', path.basename(modelPath));
  glb = fs.readFileSync(modelPath);
  const stats = inspectGLB(glb);
  console.log('· GLB     :', (glb.length/1e6).toFixed(1)+'MB',
              '| meshes:'+stats.meshes, 'materials:'+stats.materials, 'verts:'+(stats.verts||'?'),
              stats.draco?'| draco':'');
  if (stats.matNames && stats.matNames.length) console.log('· mats    :', stats.matNames.slice(0,20).join(', '));
}

const RT = useSnapshot ? JSON.parse(fs.readFileSync(RUNTIME_SNAPSHOT, 'utf8'))
                       : makeRuntime(readBundle(runtimePath));

// 1) viewer body with config injected
let body = readViewerBody();
if (body.indexOf('"__ENGINE_CONFIG__"') < 0) throw new Error('viewer body missing "__ENGINE_CONFIG__" token');
body = body.replace('"__ENGINE_CONFIG__"', JSON.stringify(config));

// 2) new template = runtime head (libs + fonts + base styles, through </helmet>) + our body
const newTemplate = RT.templateHead + '\n' + body;

// 3) model assets: the runtime carries no model (car already dropped) — add ours
//    (gzip + base64). Procedural builds stay runtime-only (libs/fonts/draco).
const newManifest = Object.assign({}, RT.manifest);
let newExt = RT.ext.slice();
if (partsMode){
  // one embedded asset per part; its ext id (partNN) is what the viewer resolves + tags
  partFiles.forEach((f, i) => {
    const buf = fs.readFileSync(path.join(partsDir, f));
    const uuid = crypto.randomUUID();
    newManifest[uuid] = { data: zlib.gzipSync(buf, { level: 9 }).toString('base64'), mime: 'model/gltf-binary', compressed: true };
    newExt = newExt.concat([{ id: config.partAssets[i], uuid }]);
  });
} else if (!procedural){
  const modelUuid = crypto.randomUUID();
  newManifest[modelUuid] = { data: zlib.gzipSync(glb, { level: 9 }).toString('base64'), mime: 'model/gltf-binary', compressed: true };
  newExt = newExt.concat([{ id: config.modelKey, uuid: modelUuid }]);
}

// 4) generic loading thumbnail + page title
let prefix = RT.prefix
  .replace(/<svg viewBox="0 0 1200 800"[\s\S]*?<\/svg>/, genericThumb(config.thumbLabel || config.category || config.title))
  .replace(/<title>[\s\S]*?<\/title>/, '<title>' + (config.title || 'Голограмма') + '</title>');

// 5) recompose. Encode "</" as "</" inside the JSON-stringified template so
//    the inner <script type="text/x-dc"> does not close the bundler template tag.
function tmplJSON(s){ return JSON.stringify(s).split('</').join('<\\u002F'); }
const out =
  prefix + '\n' +
  '  <script type="__bundler/manifest">\n' + JSON.stringify(newManifest) + '\n  </' + 'script>\n\n' +
  '  <script type="__bundler/ext_resources">\n' + JSON.stringify(newExt) + '\n  </' + 'script>\n\n' +
  '  <script type="__bundler/template">\n' + tmplJSON(newTemplate) + '\n  </' + 'script>\n' +
  RT.suffix;

fs.writeFileSync(outPath, out);
console.log('· out     :', path.basename(outPath), '('+(out.length/1e6).toFixed(1)+'MB)');
console.log('✓ built');
