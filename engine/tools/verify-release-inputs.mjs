// Verify the staged release, imported museum bytes, and GLB headers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024});
const tracked=new Set(git('ls-files','-z').split('\0').filter(Boolean));
const files=git('diff','--cached','--name-only','--diff-filter=ACM','-z').split('\0').filter(f=>f&&f!=='reports/asset-release-inputs.json');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/mediashtab-import.json')));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const failures=[],rows=[];
for(const file of files){
  const b=fs.readFileSync(path.join(root,file));
  if(b.length>=100*1024*1024)failures.push('GitHub size limit: '+file);
  if(/(^|\/)(node_modules|__pycache__|private)(\/|$)|\.key$|(^|\/)\.env($|\.)/.test(file))failures.push('Excluded data: '+file);
  if(file.endsWith('.glb')&&(b.toString('ascii',0,4)!=='glTF'||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length))failures.push('Invalid GLB: '+file);
  if(/\.(js|cjs|mjs|json|md|html|css|py|ps1|txt)$/.test(file)){
    const text=b.toString('utf8');
    if(/BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY|gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{40,}|sk-[a-zA-Z0-9]{24,}|vk1\.a\.[a-zA-Z0-9_-]{40,}|[0-9]{8,}:[a-zA-Z0-9_-]{35}/.test(text))failures.push('Credential pattern: '+file);
  }
  rows.push({file,bytes:b.length,sha256:sha(b)});
}
for(const f of manifest.files.filter(f=>f.file.startsWith('examples/mediashtab/')||f.file.startsWith('assets/'))){
  if(!tracked.has(f.file))failures.push('Missing staged import: '+f.file);
  else if(sha(fs.readFileSync(path.join(root,f.file)))!==f.sha256)failures.push('Changed museum/evidence snapshot: '+f.file);
}
const build=fs.readFileSync(path.join(root,'engine/tools/build-catalog.mjs'),'utf8');
const parts=[...new Set([...build.matchAll(/'\.\.\/([^']+parts[^']*)'/g)].map(m=>m[1]))];
for(const dir of parts)for(const file of fs.readdirSync(path.join(root,dir)).filter(f=>f.endsWith('.glb'))){
  if(!tracked.has(dir+'/'+file))failures.push('Missing catalog GLB: '+dir+'/'+file);
}
const result={date:'2026-10-12',pass:!failures.length,files:rows.length,bytes:rows.reduce((n,r)=>n+r.bytes,0),catalogPartSets:parts.length,credentialScan:'Known private-key/token patterns and sensitive filenames; not a general security audit',failures,inventory:rows};
fs.mkdirSync(path.join(root,'reports'),{recursive:true});
fs.writeFileSync(path.join(root,'reports/asset-release-inputs.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,inventory:undefined}));
if(failures.length)process.exitCode=1;
