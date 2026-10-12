import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const marker=/<script id="museum-glossary-bootstrap">[\s\S]*?<\/script>\r?\n?/g;
// Inline the small observer so replacing documentElement cannot cancel a
// pending bootstrap download. The large model payload remains untouched.
export const injection='<script id="museum-glossary-bootstrap">'+await readFile(new URL('museum-glossary-bootstrap.js',import.meta.url),'utf8')+'</script>\n';
export const stripIntegration=html=>html.replace(marker,'');
export function integrateBundle(html){
 const original=stripIntegration(html);
 if(!original.includes('type="__bundler/manifest"')||!original.includes('--hm-info'))throw new Error('Not a supported museum viewer');
 const head=/<head\b[^>]*>\r?\n?/i.exec(original);
 if(!head)throw new Error('Missing head');
 // Keep the existing encoding declaration within the first 1024 bytes.
 const charset=/<meta\b[^>]*charset[^>]*>\r?\n?/i.exec(original);
 const position=charset?charset.index+charset[0].length:head.index+head[0].length;
 return original.slice(0,position)+injection+original.slice(position);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const catalog=await readFile(new URL('index.html',import.meta.url),'utf8');
 const objects=JSON.parse(catalog.match(/const GROUPS = (\[.*\]);/)[1]).flatMap(g=>g.items);
 const audit=[];
 for(const object of objects){
  const url=new URL(object.file,import.meta.url),before=await readFile(url);
  const original=before.toString('utf8');
  if(!Buffer.from(original).equals(before))throw new Error('Non-UTF8 bundle: '+object.file);
  const updated=integrateBundle(original);
  if(stripIntegration(updated)!==stripIntegration(original))throw new Error('Bundle payload changed: '+object.file);
  if(integrateBundle(updated)!==updated)throw new Error('Non-idempotent integration');
  if(updated!==original)await writeFile(url,updated);
  audit.push({file:object.file,changed:updated!==original,payloadSha256:createHash('sha256').update(stripIntegration(original)).digest('hex'),payloadUnchanged:true});
 }
 const directory=new URL('../../artifacts/museum-standalone-glossary-2026-09-16/',import.meta.url);
 await mkdir(directory,{recursive:true});
 await writeFile(new URL('bundle-audit.json',directory),JSON.stringify(audit,null,2)+'\n');
 console.log(`${audit.length} bundles integrated; original content preserved byte for byte after removing the loader`);
}
