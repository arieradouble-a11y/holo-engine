#!/usr/bin/env node
/* ============================================================================
 *  HOLO ENGINE — image → 3D (GLB) через локальный ComfyUI + TRELLIS.2
 *
 *  Референс-картинка → ComfyUI API → GLB на диске → (опц.) build.js → голограмма.
 *  Zero-dependency: Node ≥18 (fetch/FormData), ComfyUI слушает 127.0.0.1:8188.
 *
 *  Воркфлоу хранится в UI-формате (как экспортирует ComfyUI «Save»); драйвер
 *  сам конвертирует его в API-формат по /object_info — не нужно вручную
 *  поддерживать два JSON.
 *
 *  Usage:
 *    node tools/image-to-3d.js --image "../Картинки/насос.jpg" --name nasos
 *         [--workflow comfyui/workflows/MeshOnly_HighQuality.ui.json]
 *         [--comfy http://127.0.0.1:8188] [--seed 12345] [--timeout 1800]
 *         [--out "../nasos.glb"]
 *         [--config configs/nasos.json --build]   # сразу собрать голограмму
 * ========================================================================== */
const fs = require('fs');
const path = require('path');

function parseArgs(argv){
  const o = {};
  for (let i = 2; i < argv.length; i++){
    const a = argv[i];
    if (a.startsWith('--')){ o[a.slice(2)] = (argv[i+1] && !argv[i+1].startsWith('--')) ? argv[++i] : true; }
  }
  return o;
}
const args = parseArgs(process.argv);
const ENGINE_DIR = path.resolve(__dirname, '..');
const COMFY = (args.comfy || 'http://127.0.0.1:8188').replace(/\/$/, '');
// Дефолт — NoCascade: HR-каскад (1536³) на sdpa-бэкенде не влезает в 16GB VRAM
// (flash_attn под Windows/Blackwell нет) и роняет сервер; база 1024 даёт то же
// практическое качество для голограмм. Каскадный HQ можно передать через --workflow.
// Мультивью: --front/--back/--left/--right (front обязателен). Даёт заметно
// вернее форму (зеркала/кабину/зад), т.к. сеть их ВИДИТ, а не додумывает.
const MV_VIEWS = { front: args.front, back: args.back, left: args.left, right: args.right };
const IS_MV = !!args.front;
const WORKFLOW = path.resolve(ENGINE_DIR, args.workflow ||
  (IS_MV ? 'comfyui/workflows/MeshOnly_MultiView.ui.json' : 'comfyui/workflows/MeshOnly_HighQuality_NoCascade.ui.json'));
const TIMEOUT_S = Number(args.timeout || 1800);

if (!args.image && !IS_MV){
  console.error('Usage (одно фото):    node tools/image-to-3d.js --image <файл> [--name <имя>] [--seed N] [--faces N] [--out <glb>] [--config <cfg.json> --build]');
  console.error('Usage (мультивью):    node tools/image-to-3d.js --front <f> --back <b> --left <l> --right <r> --name <имя> [--faces N] [--out <glb>]');
  process.exit(1);
}
const imagePath = args.image ? path.resolve(args.image) : path.resolve(args.front);
if (!fs.existsSync(imagePath)){ console.error('✗ картинка не найдена: ' + imagePath); process.exit(1); }
const NAME = String(args.name || path.basename(imagePath, path.extname(imagePath))).replace(/[^\w\-а-яА-ЯёЁ]/g, '_');

// ---- ComfyUI HTTP helpers ----------------------------------------------------
async function api(p, opts){
  const r = await fetch(COMFY + p, opts);
  if (!r.ok) throw new Error('ComfyUI ' + p + ' → HTTP ' + r.status + ': ' + (await r.text()).slice(0, 400));
  return r;
}
const apiJSON = async (p, opts) => (await api(p, opts)).json();

// ---- UI-формат → API-формат ---------------------------------------------------
// По /object_info: обходим required+optional входы класса по порядку; вход-виджет
// потребляет очередное значение widgets_values (seed-виджеты — ещё и служебное
// значение control_after_generate), вход-связь берётся из links. Виджет,
// «сконвертированный во вход» (есть link) — связь важнее значения.
const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN']);
const SKIP_CLASSES = new Set(['Note', 'MarkdownNote', 'Preview3D', 'PreviewImage', 'Reroute']);
const CTRL_VALUES = new Set(['fixed', 'increment', 'decrement', 'randomize']);

function uiToApi(ui, objectInfo){
  const linkSrc = {};                                  // linkId -> [srcNodeId, srcSlot]
  (ui.links || []).forEach(l => { linkSrc[l[0]] = [String(l[1]), l[2]]; });
  const present = new Set((ui.nodes || []).filter(n => !SKIP_CLASSES.has(n.type)).map(n => String(n.id)));
  const graph = {};
  for (const node of ui.nodes || []){
    if (SKIP_CLASSES.has(node.type)) continue;
    const info = objectInfo[node.type];
    if (!info) throw new Error('нода «' + node.type + '» не зарегистрирована в ComfyUI (/object_info)');
    const spec = Object.assign({}, (info.input || {}).required || {}, (info.input || {}).optional || {});
    const linkByName = {};
    (node.inputs || []).forEach(inp => { if (inp.link != null && linkSrc[inp.link]) linkByName[inp.name] = linkSrc[inp.link]; });
    const wv = Array.isArray(node.widgets_values) ? node.widgets_values.slice() : [];
    let wi = 0;
    const inputs = {};
    for (const [name, s] of Object.entries(spec)){
      const kind = Array.isArray(s) ? s[0] : null;                       // "INT" | [...combo] | "IMAGE" | …
      const isWidget = Array.isArray(kind) || WIDGET_TYPES.has(kind);
      if (isWidget){
        const val = wv[wi++];
        // seed-подобные INT несут дополнительный ui-виджет 'fixed/randomize/…'
        const ctrl = (s[1] && s[1].control_after_generate) || /(^|_)seed$/.test(name);
        if (ctrl && CTRL_VALUES.has(wv[wi])) wi++;
        inputs[name] = linkByName[name] || val;
      } else if (linkByName[name]){
        inputs[name] = linkByName[name];
      }
      // связь-вход без link (optional) — не пишем вовсе
    }
    // связи на выброшенные ноды (Preview3D) не встречаются как ВХОДЫ рабочих нод,
    // но на всякий случай зачистим битые ссылки
    for (const [k, v] of Object.entries(inputs))
      if (Array.isArray(v) && v.length === 2 && !present.has(String(v[0]))) delete inputs[k];
    graph[String(node.id)] = { class_type: node.type, inputs };
  }
  return graph;
}

// ---- шаги пайплайна ------------------------------------------------------------
async function main(){
  // 0) сервер жив?
  try { await apiJSON('/system_stats'); }
  catch (e){
    console.error('✗ ComfyUI не отвечает на ' + COMFY);
    console.error('  Запустите: Desktop\\ComfyUI_cu128_50XX\\ComfyUI_cu128_50XX\\run_nvidia_gpu.bat');
    process.exit(1);
  }
  console.log('· comfy   :', COMFY, '(жив)');

  // 1) загрузка картинки(ок)
  async function uploadFile(p){
    const name = 'holo_' + Date.now() + '_' + Math.random().toString(36).slice(2,7) + '_' + path.basename(p).replace(/[^\w.\-]/g, '_');
    const fd = new FormData();
    fd.append('image', new Blob([fs.readFileSync(path.resolve(p))]), name);
    fd.append('type', 'input');
    return (await apiJSON('/upload/image', { method: 'POST', body: fd })).name;
  }
  const uploaded = {};
  if (IS_MV){
    for (const [k, v] of Object.entries(MV_VIEWS)) if (v){ uploaded[k] = await uploadFile(v); }
    console.log('· views   :', Object.keys(uploaded).join(', '), '(front обязателен)');
  } else {
    uploaded.single = await uploadFile(imagePath);
    console.log('· image   :', path.basename(imagePath), '→', uploaded.single);
  }

  // 2) воркфлоу UI → API
  const ui = JSON.parse(fs.readFileSync(WORKFLOW, 'utf8'));
  const objectInfo = await apiJSON('/object_info');
  const graph = uiToApi(ui, objectInfo);

  // мультивью-разводка: front/back уже связаны в воркфлоу; left/right (если даны)
  // достраиваем, клонируя цепочку LoadImage→PreProcess переднего вида.
  let loaded = false, prefixed = false, rembg = false;
  if (IS_MV){
    const genEntry = Object.entries(graph).find(([, n]) => n.class_type === 'Trellis2ImageCondMultiViewGenerator');
    if (!genEntry) throw new Error('в мультивью-воркфлоу нет Trellis2ImageCondMultiViewGenerator');
    const gen = genEntry[1];
    const loadIdFor = (viewKey) => { const pre = gen.inputs[viewKey + '_image']; if (!Array.isArray(pre)) return null;
      const preNode = graph[pre[0]]; const img = preNode && preNode.inputs.image; return { preId: pre[0], loadId: Array.isArray(img) ? img[0] : null }; };
    const front = loadIdFor('front');
    if (!front || !front.loadId) throw new Error('не найдена цепочка переднего вида (front_image) в воркфлоу');
    let nid = 900;
    for (const viewKey of ['front','back','left','right']){
      if (!uploaded[viewKey]) continue;
      const slot = gen.inputs[viewKey + '_image'];
      if (!Array.isArray(slot)){ // достроить цепочку по образцу переднего вида
        const nl = String(nid++), np = String(nid++);
        graph[nl] = { class_type: graph[front.loadId].class_type, inputs: Object.assign({}, graph[front.loadId].inputs) };
        graph[np] = { class_type: graph[front.preId].class_type, inputs: Object.assign({}, graph[front.preId].inputs, { image: [nl, 0] }) };
        gen.inputs[viewKey + '_image'] = [np, 0];
        graph[nl].inputs.image = uploaded[viewKey];
      } else { const info = loadIdFor(viewKey); if (info && info.loadId) graph[info.loadId].inputs.image = uploaded[viewKey]; }
    }
    loaded = true;
  }

  // подстановки: входная картинка, вырезание фона, префикс результата, seed
  for (const node of Object.values(graph)){
    if (!IS_MV && (node.class_type === 'Trellis2LoadImageWithTransparency' || node.class_type === 'LoadImage')){
      node.inputs.image = uploaded.single; loaded = true;
    }
    // JPEG/фото без альфа-канала валят препроцесс — включаем встроенное
    // вырезание фона (--no-rembg вернёт значение из воркфлоу, для PNG с прозрачностью)
    if (node.class_type === 'Trellis2PreProcessImage' && !args['no-rembg']){
      node.inputs.remove_background = true; rembg = true;
    }
    // flash_attn не собирается под Windows-портативку, а xformers на Blackwell
    // (RTX 50XX) насмерть роняет CUDA (внутри вызывает Hopper-ядра flash-attention).
    // Нативный sdpa работает везде: sparse-код Trellis2 умеет sdpa из коробки,
    // пункт "sdpa" добавлен нами в combo sparse_backend ноды (см. comfyui/README).
    if (node.class_type === 'Trellis2LoadModel'){
      if (String(node.inputs.backend).startsWith('flash_attn')) node.inputs.backend = 'sdpa';
      if (node.inputs.sparse_backend === 'flash_attn' || node.inputs.sparse_backend === 'xformers')
        node.inputs.sparse_backend = 'sdpa';
    }
    if (node.class_type === 'Trellis2ExportMesh'){
      const fn = node.inputs.filename_prefix != null ? 'filename_prefix' : 'filename';
      const v = node.inputs[fn];
      if (Array.isArray(v) && graph[v[0]] && graph[v[0]].class_type === 'PrimitiveString'){
        graph[v[0]].inputs.value = 'holo_' + NAME; prefixed = true;
      } else if (typeof v === 'string'){ node.inputs[fn] = 'holo_' + NAME; prefixed = true; }
    }
    if (args.seed != null && 'seed' in node.inputs && !Array.isArray(node.inputs.seed))
      node.inputs.seed = Number(args.seed);
  }
  // Упрощение меша: TRELLIS выдаёт 0.5–1 млн полигонов — для проволочной
  // голограммы это избыток, шум триангуляции читается как «ржавая» поверхность.
  // Нам нужна чистая основа, а не сверхдетализация → режем целевое число граней.
  // target_face_num обоих Trellis2SimplifyMesh запитан от одного PrimitiveInt.
  const FACES = Number(args.faces != null ? args.faces : 250000);
  let facesSet = 0;
  for (const node of Object.values(graph)){
    if (node.class_type === 'Trellis2SimplifyMesh'){
      const t = node.inputs.target_face_num;
      if (Array.isArray(t) && graph[t[0]] && graph[t[0]].class_type === 'PrimitiveInt'){ graph[t[0]].inputs.value = FACES; facesSet++; }
      else { node.inputs.target_face_num = FACES; facesSet++; }
    }
  }
  if (!loaded) throw new Error('в воркфлоу нет ноды загрузки изображения');
  console.log('· graph   :', Object.keys(graph).length, 'нод | префикс: holo_' + NAME + (prefixed ? '' : ' (не подставился!)') + (rembg ? ' | rembg: on' : '') + (facesSet ? ' | грани≤' + FACES : ''));

  // 3) постановка в очередь
  const q = await apiJSON('/prompt', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: graph, client_id: 'holo-engine' }),
  }).catch(async e => { throw new Error('валидация графа: ' + e.message); });
  const pid = q.prompt_id;
  console.log('· queued  :', pid);

  // 4) ожидание (первый прогон грузит веса с диска — это долго, до ~10 мин)
  const t0 = Date.now();
  let lastMsg = '';
  for (;;){
    if ((Date.now() - t0) / 1000 > TIMEOUT_S) throw new Error('таймаут ' + TIMEOUT_S + 'с');
    const h = await apiJSON('/history/' + pid);
    const rec = h[pid];
    if (rec){
      const st = rec.status || {};
      if (st.status_str === 'error'){
        const msgs = (st.messages || []).filter(m => m[0] === 'execution_error').map(m => JSON.stringify(m[1]).slice(0, 600));
        throw new Error('ошибка выполнения: ' + (msgs[0] || 'см. консоль ComfyUI'));
      }
      if (st.completed){
        // 5) найти GLB: сначала файловые outputs (SaveGLB-подобные ноды)…
        const files = [];
        for (const out of Object.values(rec.outputs || {}))
          for (const arr of Object.values(out))
            if (Array.isArray(arr)) arr.forEach(f => { if (f && typeof f === 'object' && /\.glb$/i.test(f.filename || '')) files.push(f); });
        let fname = files.length ? files[files.length - 1].filename : null;
        let sub = files.length ? (files[files.length - 1].subfolder || '') : '';
        // …иначе перебор счётчика ComfyUI: Trellis2ExportMesh пишет
        // <префикс>_00001_.glb на диск, не сообщая файл в history. Наибольший
        // существующий индекс = самый свежий (счётчик монотонный).
        if (!fname){
          const probe = async (fn) => (await fetch(COMFY + '/view?filename=' + encodeURIComponent(fn) + '&type=output', { headers: { Range: 'bytes=0-0' } })).ok;
          let best = 0;
          for (let i = 1; i <= 200; i++){
            if (await probe('holo_' + NAME + '_' + String(i).padStart(5, '0') + '_.glb')) best = i;
            else if (best > 0 || i > 20) break;   // счётчик непрерывный
          }
          if (!best) throw new Error('GLB не найден ни в outputs, ни перебором holo_' + NAME + '_NNNNN_.glb');
          fname = 'holo_' + NAME + '_' + String(best).padStart(5, '0') + '_.glb';
        }
        const r = await api('/view?filename=' + encodeURIComponent(fname) + '&subfolder=' + encodeURIComponent(sub) + '&type=output');
        const buf = Buffer.from(await r.arrayBuffer());
        const outPath = path.resolve(args.out || path.join(ENGINE_DIR, '..', NAME + '.glb'));
        fs.writeFileSync(outPath, buf);
        const dt = ((Date.now() - t0) / 1000).toFixed(0);
        console.log('✓ GLB     :', outPath, '(' + (buf.length / 1e6).toFixed(1) + 'MB, ' + dt + 'с | ' + fname + ')');
        return outPath;
      }
    }
    // прогресс из очереди
    const queue = await apiJSON('/queue').catch(() => null);
    if (queue){
      const running = (queue.queue_running || []).some(e => e[1] === pid);
      const pending = (queue.queue_pending || []).findIndex(e => e[1] === pid);
      const msg = running ? 'выполняется' : pending >= 0 ? ('в очереди #' + (pending + 1)) : 'ожидание истории';
      if (msg !== lastMsg){ console.log('· status  :', msg, '(' + ((Date.now() - t0) / 1000).toFixed(0) + 'с)'); lastMsg = msg; }
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}

main().then(async glbPath => {
  if (args.build && args.config){
    console.log('· build   : запускаю сборку голограммы…');
    const { execFileSync } = require('child_process');
    execFileSync(process.execPath, [path.join(ENGINE_DIR, 'build.js'), '--config', args.config, '--model', glbPath], { stdio: 'inherit', cwd: ENGINE_DIR });
  } else {
    console.log('  дальше:  node build.js --config configs/<имя>.json --model "' + glbPath + '"');
  }
}).catch(e => { console.error('✗ ' + (e && e.message || e)); process.exit(1); });
