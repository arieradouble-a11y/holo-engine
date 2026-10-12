const fs=require('fs'),p=require('path');
const cfg=JSON.parse(fs.readFileSync('museum-housing/engine/configs/plan-gp18.json','utf8'));
const step=.05,minX=-13.3,minZ=-13.6,nx=533,nz=545;
const entries=[[9.3,5.12,'z'],[15.9,5.12,'z'],[15.9,12,'z'],[15.9,13.85,'z'],[17.4,15.88,'z'],[14.4,17,'x'],[10.8,17,'x'],[7.8,15.88,'z'],[9.3,13.85,'z'],[9.3,12,'z']];
function audit(close,floorIndex=1){
 const floorY=cfg.floorStudy.floorLevels?.[floorIndex]||0;
 const solid=new Uint8Array(nx*nz);
 function rect(x,z,w,d){const a=Math.max(0,Math.floor((x-w/2-minX)/step)),b=Math.min(nx-1,Math.ceil((x+w/2-minX)/step)),c=Math.max(0,Math.floor((z-d/2-minZ)/step)),e=Math.min(nz-1,Math.ceil((z+d/2-minZ)/step));for(let j=c;j<=e;j++)solid.fill(1,j*nx+a,j*nx+b+1);}
 for(const g of cfg.geometry){if(!g.box)continue;const[w,h,d,x,y,z,mat]=g.box;if(mat==='door'||mat==='base')continue;if(y-h/2<=floorY+.20&&y+h/2>=floorY+.20)rect(x,z,w,d);}
 if(close)for(const[x,z,axis]of entries)rect(x-12.6,z-12.9,axis==='x'?1.2:.30,axis==='z'?1.2:.30);
 const comp=new Int32Array(nx*nz),q=new Int32Array(nx*nz);let count=0;
 for(let s=0;s<comp.length;s++)if(!solid[s]&&!comp[s]){let lo=0,hi=1;q[0]=s;comp[s]=++count;while(lo<hi){const v=q[lo++],x=v%nx;for(const b of [x>0?v-1:-1,x<nx-1?v+1:-1,v-nx,v+nx])if(b>=0&&b<comp.length&&!solid[b]&&!comp[b]){comp[b]=count;q[hi++]=b;}}}
 function at(x,z){const i=Math.round((x-minX)/step),j=Math.round((z-minZ)/step);return comp[j*nx+i];}
 const ap=cfg.floorStudy.labels.filter(x=>x.apt).map(x=>({name:x.name,component:at(x.x,x.z)}));
 const hall=at(12.6-12.6,16.25-12.9);const stats={};for(let i=0;i<comp.length;i++){const c=comp[i];if(!c)continue;const s=stats[c]||(stats[c]={area:0,x:0,z:0});s.area++;s.x+=(i%nx)*step+minX+12.6;s.z+=Math.floor(i/nx)*step+minZ+12.9;}const regions=Object.entries(stats).map(([id,s])=>({id:Number(id),area:+(s.area*step*step).toFixed(2),x:+(s.x/s.area).toFixed(2),z:+(s.z/s.area).toFixed(2)}));return{floor:floorIndex+1,close,count,apartments:ap,hall,regions,pass:close?ap.every(x=>x.component>0&&x.component!==hall)&&new Set(ap.map(x=>x.component)).size===10:ap.every(x=>x.component===hall)};
}
const result={method:'5 cm pedestrian-plane raster at 0.20 m above each residential floor; open door leaves omitted; apartment isolation tested by sealing only ten entry gaps; not a building-code audit',floors:Array.from({length:17},(_,i)=>({open:audit(false,i+1),closed:audit(true,i+1)}))};
fs.writeFileSync('museum-housing/evidence/modern/gp18-connectivity.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result.floors.map(f=>({floor:f.open.floor,accessible:f.open.pass,isolated:f.closed.pass})),null,2));if(result.floors.some(f=>!f.open.pass||!f.closed.pass))process.exitCode=1;


