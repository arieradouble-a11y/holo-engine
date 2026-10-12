import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {author,ids} from './author.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),engine=path.join(root,'engine');
fs.cpSync(path.join(root,'source'),path.join(engine,'src'),{recursive:true});
function edit(file,from,to){const p=path.join(engine,'src',file),s=fs.readFileSync(p,'utf8');if(!s.includes(from))throw new Error('Missing anchor '+file);fs.writeFileSync(p,s.replace(from,to));}
edit('modules/96-pilot.js',"m=new T.Matrix4().makeTranslation(x,y,zz).multiply(new T.Matrix4().makeRotationY((d.ry||0)*Math.PI/180));","m=d.matrix?new T.Matrix4().fromArray(d.matrix):new T.Matrix4().makeTranslation(x,y,zz).multiply(new T.Matrix4().makeRotationY((d.ry||0)*Math.PI/180));");
// A semantic system key need not itself match the original generator's material
// aliases. Preserve the explicit part id for the new edge geometry.
edit('modules/96-pilot.js',"mat:this.PARTDEF[d.part].key","mat:'__detail_part_'+d.part");
// Keep the box vertices indexed instead of expanding every triangle corner.
edit('modules/96-pilot.js','bins.get(key).geos.push(transformed.toNonIndexed());transformed.dispose();','bins.get(key).geos.push(transformed);');
edit('modules/96-pilot.js','b.geos.forEach(g=>g.dispose()); g.computeBoundingSphere();',`const indices=[],baseCounts=b.geos.map(g=>g.attributes.position.count);let offset=0;
      b.geos.forEach((geo,i)=>{for(const v of geo.index.array)indices.push(v+offset);offset+=baseCounts[i];});
      g.setIndex(indices);b.geos.forEach(g=>g.dispose()); g.computeBoundingSphere();`);
edit('modules/30-render.js','const pi=this.matToPart(mats[i]);',"const pi=String(mats[i]).startsWith('__detail_part_')?Number(String(mats[i]).slice(14)):this.matToPart(mats[i]);");
edit('modules/96-pilot.js',"const reveal=this.state.cut||this.explode>.01||quiet.has(this.selectedPart);","if(!quiet.size)return;\n    const reveal=this.state.cut||this.explode>.01||quiet.has(this.selectedPart);");
edit('modules/96-pilot.js',"this.updatePilotEdgeRanges();","this.updatePilotEdgeRanges();\n    if(!this.CONFIG.floorStudy && this.selectedPart<0){if(this.state.exploded)this.fitPilotExplodedPhone();else this.fitPilotOverviewPhone();}");
edit('modules/70-scene.js','this._pilotExplosionFitKey=null;','this._pilotExplosionFitKey=null;this._pilotOverviewFitKey=null;');
edit('modules/70-scene.js','resetView=()=>{','resetView=()=>{ this._pilotOverviewFitKey=null;');
edit('modules/96-pilot.js','  showPilotClose(){',`  fitPilotOverviewPhone(){
    const w=this.canvas.clientWidth,h=this.canvas.clientHeight;
    if((w>=700&&w/h>=1.5)||this.pilotClose||this.state.cut||this.state.plan)return;
    const key=[w,h].join('/');if(this._pilotOverviewFitKey===key)return;this._pilotOverviewFitKey=key;
    const n=this.norm,ca=Math.cos(this.azTarget),sa=Math.sin(this.azTarget),ce=Math.cos(this.elTarget),se=Math.sin(this.elTarget);
    const side=w<700?0:Math.min(360,w*.32);
    const vt=Math.tan(42*Math.PI/360),freeW=Math.max(120,w-side-32),freeH=Math.max(140,h-(w<700?this.HM_BAR:40)-70);
    let dist=Math.max(8.5,n.height*2.4);
    for(const x of [-n.size.x*n.scl/2,n.size.x*n.scl/2])for(const y of [-n.height/2,n.height/2])for(const z of [-n.size.z*n.scl/2,n.size.z*n.scl/2]){
      const xx=x*ca+z*sa,zz=-x*sa+z*ca,yy=ce*y-se*zz,depth=se*y+ce*zz;
      dist=Math.max(dist,depth+Math.abs(xx)*h/(vt*freeW),depth+Math.abs(yy)*h/(vt*freeH));
    }
    this.distTarget=dist*1.03;this.tgtGoal={x:side/h*this.distTarget*vt,y:n.height/2,z:0};this.hmShift();
  }
  showPilotClose(){`);
// Wide courtyard models also need fitting to their actual displaced systems.
// Keep the accepted first house's desktop camera unchanged.
edit('modules/96-pilot.js','if(!phone&&w/h>=1.5)return;','if(this.CONFIG.pilotDetail.version===1&&!phone&&w/h>=1.5)return;');
edit('modules/96-pilot.js','this._pilotExplosionCorners=points;',`if(this.CONFIG.pilotDetail.version>1){
        const detailBins=new Map(),v=new T.Vector3();
        for(const obj of this.pilotLineTiers){const g=obj.geometry,p=g.attributes.position.array,a=g.attributes.aPart.array;
          for(let i=0;i<a.length;i++){const part=a[i];if(!detailBins.has(part))detailBins.set(part,new T.Box3());
            detailBins.get(part).expandByPoint(v.fromArray(p,i*3));}}
        for(const [part,b] of detailBins){const d=this.partDirs[part];
          for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])points.push([x+d[0],y+d[1],z+d[2]]);}
      }
      this._pilotExplosionCorners=points;`);
edit('modules/96-pilot.js',"this.distTarget=this.canvas.clientWidth<700?3.0:4.7;\n    this.tgtGoal={x:0,y:1.30,z:0};","const n=this.norm;\n    this.distTarget=this.CONFIG.pilotDetail.version===1?(this.canvas.clientWidth<700?3:4.7):Math.max(this.canvas.clientWidth<700?3:4.7,n.height*1.3);\n    this.tgtGoal={x:0,y:n.height*.54,z:0};");
const reports=[],catalog=[];
for(const id of ids){
 let config,report;
 if(id==='plan-121'){
   config=JSON.parse(fs.readFileSync(path.join(root,'../engine/configs/pilot.json')));
   report={id,title:config.title,style:'panel',boxes:config.pilotDetail.boxes.length,triangles:config.pilotDetail.boxes.length*12,acceptedPilot:true};
 }else{
   ({config,report}=author(JSON.parse(fs.readFileSync(path.join(root,'source-configs',id+'.json'))),id));
 }
 const file=path.join(engine,'configs',id+'.json');fs.writeFileSync(file,JSON.stringify(config));
 reports.push(report);catalog.push({id,title:config.title,style:report.style,details:report.boxes,floors:config.building.floors});
 console.log(id,JSON.stringify({...report,anchors:undefined}));
 if(!process.argv.includes('--author-only'))cp.execFileSync(process.execPath,[path.join(engine,'build.js'),'--config',file,'--out',path.join(root,id+'.html')],{stdio:'pipe'});
}
fs.writeFileSync(path.join(root,'qa/authoring.json'),JSON.stringify(reports,null,2));
fs.writeFileSync(path.join(root,'catalog.json'),JSON.stringify(catalog,null,2));
console.log('Built '+reports.length+' houses');
