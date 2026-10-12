import fs from 'node:fs';
import * as T from '../../../engine/node_modules/three/build/three.module.js';
const generator=fs.readFileSync(new URL('source/modules/10-generators.js',import.meta.url),'utf8');
const Model=new Function('return class { '+generator+' }')();
const rounded=x=>Math.round(x*1000)/1000;
export const ids=['plan-121','plan-228','plan-467','plan-85','plan-85-corner','plan-83','plan-brusnika-2019','plan-gp18','mkd','mkd-121','mkd-447','mkd-p44','mkd-stalin','zhk'];
export function author(c,id){
  const model=new Model();model.CONFIG=c;model.meshData=[];model.buildProceduralModel(T);
  const md=model.meshData, part=mat=>{
    for(const r of c.matRules||[])if(r.match.some(k=>mat.includes(k)))return r.part;
    return c.defaultPart||0;
  };
  const facade=c.parts.findIndex(p=>p.key==='facade');
  const recs=md.filter(m=>m.geometry.type==='BoxGeometry').map(m=>{
    const p=m.geometry.parameters, pos=new T.Vector3().setFromMatrixPosition(m.matrixWorld);
    return {w:p.width,h:p.height,d:p.depth,m:m.matrixWorld,mat:m.mat,part:part(m.mat),pos};
  });
  const frames=recs.filter(r=>r.part===facade), windows=[],groups=new Map();
  const addWindow=(w,h,m,kind)=>{if(h<.55||h>3.5||w<.35||w>5.2)return;windows.push({w,h,m,kind});};
  // Parameter-built houses have explicit glazing panels (0.08m thick). Their
  // positions come from the same generator as the displayed model.
  if(!c.floorStudy){
    for(const r of frames)if(r.mat==='window'&&Math.abs(r.d-.08)<.0001&&r.w>.4&&r.h>.55){
      addWindow(r.w,r.h,r.m.clone().multiply(new T.Matrix4().makeTranslation(0,-r.h/2,0)),'glazing');
    }
  }else{
    // Pair existing horizontal frame rails. Their complete world transform
    // preserves L-shaped sections and windows on perpendicular elevations.
    for(const r of frames){
      if(r.h>.105||r.h<.025)continue;
      const alongZ=r.d>r.w,w=alongZ?r.d:r.w,thick=alongZ?r.w:r.d;
      if(w<.35||w>5.2||thick>.15)continue;
      const m=r.m.clone();if(alongZ)m.multiply(new T.Matrix4().makeRotationY(Math.PI/2));
      const x=new T.Vector3().setFromMatrixColumn(m,0),z=new T.Vector3().setFromMatrixColumn(m,2);
      if(Math.abs(x.y)>.01||Math.abs(z.y)>.01)continue;
      const key=[r.pos.x,r.pos.z,w,x.x,x.z].map(rounded).join('/');
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push({...r,m,width:w});
    }
    for(const group of groups.values()){
      group.sort((a,b)=>a.pos.y-b.pos.y);
      for(let i=0;i+1<group.length;i++){
        const a=group[i],b=group[i+1],height=b.pos.y-a.pos.y;
        if(height<.6||height>2.85)continue;
        // A real frame must contain a vertical jamb/mullion at its midpoint.
        const center=new T.Vector3(0,height/2,0).applyMatrix4(a.m);
        const axis=new T.Vector3().setFromMatrixColumn(a.m,0);
        const normal=new T.Vector3().setFromMatrixColumn(a.m,2);
        const vertical=frames.some(r=>r.w<.16&&r.d<.16&&Math.abs(r.h-height)<.17&&Math.abs(r.pos.y-center.y)<.10&&Math.abs(r.pos.clone().sub(center).dot(normal))<.12&&Math.abs(r.pos.clone().sub(center).dot(axis))<=a.width/2+.10);
        if(!vertical)continue;
        addWindow(a.width,height,a.m.clone(),'frame');i++;
      }
    }
    // The simplified courtyard wings use real wall apertures with a central
    // mullion but no frame rails. Recover opening bounds from sill/lintel boxes.
    if(id==='plan-brusnika-2019'){
      const structure=recs.filter(r=>r.part===0);
      for(const r of structure){
        const alongZ=r.w>.3&&r.w<.4&&r.d>.06&&r.d<.075;
        const alongX=r.d>.3&&r.d<.4&&r.w>.06&&r.w<.075;
        if((!alongZ&&!alongX)||r.h<1||r.h>2.5)continue;
        const m=r.m.clone();if(alongZ)m.multiply(new T.Matrix4().makeRotationY(Math.PI/2));
        const sill=structure.find(s=>Math.abs(s.pos.x-r.pos.x)<.01&&Math.abs(s.pos.z-r.pos.z)<.01&&Math.abs(s.pos.y+s.h/2-(r.pos.y-r.h/2))<.02&&(alongZ?s.d:s.w)>.7&&(alongZ?s.d:s.w)<3.0);
        if(sill)addWindow(alongZ?sill.d:sill.w,r.h,m.multiply(new T.Matrix4().makeTranslation(0,-r.h/2,0)),'aperture');
      }
    }
  }
  const seen=new Set();const unique=windows.filter(w=>{const p=new T.Vector3().setFromMatrixPosition(w.m),x=new T.Vector3().setFromMatrixColumn(w.m,0);const key=[p.x,p.y,p.z,w.w,w.h,x.x,x.z].map(rounded).join('/');if(seen.has(key))return false;seen.add(key);return true;});
  // Floor plates tell which side of a facade is indoors, including courtyard
  // windows. This avoids assuming every window faces away from the site centre.
  const plates=recs.filter(r=>r.h<.65&&r.w>.6&&r.d>.6).map(r=>({...r,inverse:r.m.clone().invert()}));
  const boxes=[];const style=c.building.struct||(id==='plan-228'?'brick':id.includes('brusnika')?'monolith':'panel');
  const depth=style==='brick'?.30:style==='monolith'?.16:.22;
  const bounds=new T.Box3();recs.forEach(r=>bounds.expandByPoint(r.pos));const centre=bounds.getCenter(new T.Vector3());
  const emit=(win,w,h,d,x,y,z,tier=0,pi=facade)=>{
    const matrix=win.m.clone().multiply(new T.Matrix4().makeTranslation(x,y,z));
    boxes.push({box:[w,h,d,0,0,0],matrix:matrix.elements.map(n=>+n.toFixed(6)),part:pi,tier});
  };
  const dirs={plus:0,minus:0,fallback:0};
  for(const win of unique){
    const p=new T.Vector3().setFromMatrixPosition(win.m),normal=new T.Vector3().setFromMatrixColumn(win.m,2);
    const floor=(side)=>{const q=p.clone().addScaledVector(normal,side*.85);return plates.some(s=>{if(s.pos.y>p.y+.1||s.pos.y<p.y-1.6)return false;const v=q.clone();v.y=s.pos.y;v.applyMatrix4(s.inverse);return Math.abs(v.x)<s.w/2&&Math.abs(v.z)<s.d/2&&Math.abs(v.y)<s.h/2+.01;});};
    const a=floor(1),b=floor(-1);let sign;
    if(a!==b){sign=a?-1:1;dirs[sign===1?'plus':'minus']++;}
    else {sign=normal.dot(p.clone().sub(centre))>=0?1:-1;dirs.fallback++;}
    win.sign=sign;
    // Recess trim connects to the existing frame. Brick frames have deeper
    // reveals; modern glazing uses a slimmer profile. Existing apertures stay open.
    for(const x of [-win.w/2+.028,win.w/2-.028])emit(win,.055,win.h,depth,x,win.h/2,0);
    emit(win,win.w,.055,depth,0,win.h-.025,0);
    emit(win,win.w+.12,.045,depth+.12,0,-.035,sign*.065);
    emit(win,win.w+.12,.045,.025,0,-.070,sign*(depth/2+.125),1);
    emit(win,win.w-.10,.03,.05,0,win.h*.72,-sign*.035,1);
    if(win.w>1.7)for(const x of [-win.w/6,win.w/6])emit(win,.028,win.h-.08,.045,x,win.h/2,-sign*.035,1);
    else emit(win,.028,win.h-.08,.045,win.w*.17,win.h/2,-sign*.035,1);
    if(style==='brick')emit(win,win.w+.16,.09,.10,0,win.h+.06,sign*.075,1);
  }
  // Add a shallow top cap to existing solid balcony parapets; no new balconies,
  // no glazing invented. Their original transforms and explosion systems stay.
  let parapets=0;
  for(const r of frames){
    const alongZ=r.d>r.w,w=alongZ?r.d:r.w,th=alongZ?r.w:r.d;
    if(r.h<.65||r.h>1.22||w<1.2||w>7||th>.16)continue;
    // Solid glazing in parameter houses may have this height; only balconies.
    if(!c.floorStudy&&!r.mat.includes('balcony'))continue;
    const m=r.m.clone();if(alongZ)m.multiply(new T.Matrix4().makeRotationY(Math.PI/2));
    emit({m},w+.025,.045,th+.065,0,r.h/2+.013,0,0);parapets++;
  }
  // Small folded edges attach to existing canopy/roof plates, including slopes.
  let caps=0;
  for(const r of recs){
    const key=c.parts[r.part]?.key;
    if(!['roof','entrance'].includes(key)||r.h>.24||r.h<.055||r.w<1.2||r.d<.65||r.pos.y<1.8)continue;
    if(key==='roof'&&r.pos.y<c.building.floors*c.building.floorHeight-.5)continue;
    for(const sign of [-1,1])emit({m:r.m},r.w,.035,.08,0,r.h/2+.01,sign*(r.d/2-.025),0,r.part);
    caps+=2;
  }
  if(!unique.length)throw new Error(id+': no verified window anchors');
  if(boxes.length>13000)throw new Error(id+': detail budget exceeded');
  const note='Дополнения детализации: отливы, профили рам, накрывки и мелкие стыки показаны условно по существующим проёмам модели; это не обмер конструктивных узлов.';
  if(c.floorStudy)c.floorStudy.accuracy+=' '+note;
  else {c.overview||={title:c.title,desc:''};c.overview.desc+=' '+note;}
  c.pilotDetail={version:2,boxes,windowHeight:unique.map(w=>w.h).sort((a,b)=>a-b)[Math.floor(unique.length/2)],style};
  const anchors=unique.map(w=>({width:w.w,height:w.h,matrix:w.m.elements.map(rounded),outward:w.sign,source:w.kind}));
  md.forEach(m=>m.geometry.dispose());
  return {config:c,report:{id,title:c.title,style,windows:unique.length,parapets,caps,boxes:boxes.length,triangles:boxes.length*12,directions:dirs,anchors}};
}
