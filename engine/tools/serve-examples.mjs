import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const aliases=[['/golomuzey','examples/mediashtab/golomuzey'],['/metavselennaya','examples/mediashtab/meta'],['/shared','examples/mediashtab/shared'],['/houses','examples/house-detail/houses'],['/pilot','examples/house-detail'],['/catalog','engine/out/catalog']];
http.createServer((req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
    if(url.pathname==='/icon.svg'){res.writeHead(200,{'Content-Type':mime['.svg']});res.end(fs.readFileSync(path.join(root,'examples/mediashtab/icon.svg')));return;}
    if(url.pathname==='/'){res.writeHead(302,{Location:'/golomuzey/'});res.end();return;}
    const p=decodeURIComponent(url.pathname),match=aliases.find(([prefix])=>p===prefix||p.startsWith(prefix+'/'));
    if(!match){res.writeHead(404);res.end('Not found');return;}
    const base=path.resolve(root,match[1]);
    let file=path.resolve(base,'.'+p.slice(match[0].length));
    if(file!==base&&!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
    if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    const bytes=fs.readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT||8778),'127.0.0.1',()=>console.log('Museum http://127.0.0.1:'+(process.env.PORT||8778)+'/golomuzey/ ; detailed houses /houses/ ; rebuilt catalog /catalog/'));
