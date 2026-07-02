// Minimal static server for previewing built hologram bundles.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');           // the 3d/ directory
const PORT = Number(process.env.PORT) || 8777;
const DEFAULT_FILE = process.env.HOLO_FILE || 'Илосос (голограмма).html';

const TYPES = {
  '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.json':'application/json',
  '.glb':'model/gltf-binary', '.wasm':'application/wasm', '.png':'image/png', '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg', '.woff2':'font/woff2', '.svg':'image/svg+xml',
};

http.createServer((req, res) => {
  try {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/' || rel === '') rel = '/' + DEFAULT_FILE;
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); return res.end('not found: ' + rel); }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': st.size,
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(file).pipe(res);
    });
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(PORT, () => console.log('holo preview on http://localhost:' + PORT + '/'));
