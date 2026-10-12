// Adapt the imported pilot's machine-specific dependency paths.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  const f=path.join(dir,e.name);if(e.isDirectory()){walk(f);continue;}
  if(!/\.(?:cjs|mjs)$/.test(e.name))continue;
  const before=fs.readFileSync(f,'utf8');
  const relative=path.relative(path.dirname(f),path.join(root,'engine/node_modules')).replaceAll('\\','/');
  let after=before.replaceAll('file:///C:/Users/rage2/Desktop/3d/engine/node_modules',relative)
    .replaceAll("executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'", "executablePath:process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'");
  after=after.replace("'C:/Users/rage2/Desktop/3d/Панельная 9-этажка (121 серия) (голограмма).html'", "path.join(__dirname,'../mediashtab/golomuzey/Панельная 9-этажка (121 серия) (голограмма).html')");
  if(after!==before)fs.writeFileSync(f,after);
}}
walk(path.join(root,'examples/house-detail'));
