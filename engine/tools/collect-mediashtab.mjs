// Collect authored museum assets without modifying the source checkout.
// node engine/tools/collect-mediashtab.mjs C:/path/to/mediashtabgkh
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {museumSnapshot} from './museum-snapshot.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (!process.argv[2]) throw new Error('Pass the Mediashtab source checkout');
const source = path.resolve(process.argv[2]);
const records = [];
function copy(relative, destination, filter = () => true) {
  const from = path.join(source, relative), to = path.join(root, destination);
  if (fs.statSync(from).isDirectory()) {
    for (const item of fs.readdirSync(from)) {
      if (filter(item)) copy(path.posix.join(relative, item), path.posix.join(destination, item), filter);
    }
    return;
  }
  fs.mkdirSync(path.dirname(to), {recursive: true});
  const original = fs.readFileSync(from);
  const bytes = destination.startsWith('examples/mediashtab/golomuzey/') && /\.(html|js)$/.test(destination)
    ? Buffer.from(museumSnapshot(destination,original.toString('utf8'))) : original;
  fs.writeFileSync(to, bytes);
  records.push({source: relative, file: destination, bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex')});
}
const clean = name => !['node_modules', '__pycache__', '.git'].includes(name)
  && !name.endsWith('.log') && !name.endsWith('.pyc');
copy('style-test/golomuzey', 'examples/mediashtab/golomuzey', name => clean(name)
  && !/^(publish-|stage-|upload_|make_thumbs)/.test(name) && !name.includes('glossary'));
for (const name of ['theme.css', 'theme.js', 'model-theme.css', 'museum-atlas.svg']) {
  copy('style-test/meta/' + name, 'examples/mediashtab/meta/' + name);
}
copy('zhkh-map/public/shared', 'examples/mediashtab/shared', clean);
copy('zhkh-map/src/app/icon.svg', 'examples/mediashtab/icon.svg');
copy('artifacts/holo-detail-121-2026-09-20', 'examples/house-detail', clean);
copy('museum-housing/evidence', 'assets/housing-evidence', clean);
copy('museum-housing/README.md', 'assets/housing-evidence/RECONSTRUCTION.md');
fs.mkdirSync(path.join(root, 'docs'), {recursive:true});
fs.writeFileSync(path.join(root, 'docs/mediashtab-import.json'), JSON.stringify({
  collected: '2026-10-12', sourceRepository: 'arieradouble-a11y/Mediashtabzkh',
  note: 'Hashes record original imported bytes before explicitly documented portability edits. Historical QA is not a fresh test run.',
  files: records.sort((a,b) => a.file.localeCompare(b.file))
}, null, 2) + '\n');
console.log(JSON.stringify({files:records.length, bytes:records.reduce((n,f)=>n+f.bytes,0)}));
