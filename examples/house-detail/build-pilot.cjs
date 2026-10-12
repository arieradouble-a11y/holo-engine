// Reproducible, isolated experiment. Never writes into the canonical engine.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = __dirname, engine = path.join(root, 'engine');
fs.cpSync(path.join(root, 'source'), path.join(engine, 'src'), {recursive:true});
const c = JSON.parse(fs.readFileSync(path.join(engine, 'configs/baseline.json')));
const boxes = [];
const box = (w,h,d,x,y,z,part=1,tier=0,ry=0) => boxes.push({box:[w,h,d,x,y,z],part,tier,ry});
// Aperture positions and sizes follow gen-plan-121.js, traced from sheet 35.
// Fine joinery / flashings are illustrative construction details, not surveyed.
const windows = [
  [1.65,0,1.45,-1],[4.85,0,2.05,-1],[17.55,0,2.05,-1],[20.8,0,1.45,-1],
  [7.7,1.5,1.45,-1],[11.15,1.5,3.7,-1],[14.65,1.5,1.45,-1],
  [2.45,11.52,.70,1],[19.9,11.52,.70,1],
  [4.25,13.02,1.35,1],[8,13.02,1.45,1],[11.1,13.02,1.45,1],[14.45,13.02,1.45,1],[18.05,13.02,1.35,1]
];
for (const sx of [-22.4,0,22.4]) {
  for (let f=0;f<9;f++) {
    const fy=f*2.7;
    for (const [px,pz,w,side] of windows) {
      const x=sx+px-11.2, z=pz-6.51;
      // Deep reveal along the existing aperture, recessed secondary sash,
      // and projecting drip edge. No glazing plane sealing the opening.
      for (const dx of [-w/2+.055,w/2-.055]) box(.065,1.35,.24,x+dx,fy+1.525,z,1,0);
      box(w,.055,.24,x,fy+2.17,z,1,0);
      box(w+.14,.055,.38,x,fy+.83,z+side*.075,1,0);
      box(w+.14,.065,.035,x,fy+.80,z+side*.265,1,1);
      // Transom and split sash; fine tier switches by projected window size.
      box(w-.12,.035,.055,x,fy+1.83,z-side*.065,1,1);
      for (const dx of w>2.5?[-w/6,w/6]:[w*.18]) box(.032,1.25,.055,x+dx,fy+1.52,z-side*.065,1,1);
    }
    if(f>0) {
      // Follow the existing angled, 6.42m loggia parapet exactly. Fine vertical
      // cover strips sit on its outer face, not a second invented railing.
      for(const [lx,ry] of [[3.2,-3.76],[19.2,3.76]]) {
        const x=sx+lx-11.2, z=13.58-6.51,rad=ry*Math.PI/180;
        box(6.44,.065,.18,x,fy+1.065,z,1,0,ry);
        for(let j=0;j<7;j++) {const dx=-2.94+j*.98;
          box(.035,.96,.045,x+dx*Math.cos(rad),fy+.51,z-dx*Math.sin(rad)+.052,1,1,ry);
        }
      }
    }
  }
  // Fine panel joints on the two blank end elevations only.
  if(sx!==0) {
    const x=sx+(sx<0?-11.365:11.365);
    for(const z of [-3.31,-.11,3.09]) box(.025,24.0,.032,x,12.0,z,1,1);
  }
  // Roof coping follows existing perimeter. No new roof equipment invented.
  for(const z of [-6.60,6.60]) box(22.55,.07,.30,sx,26.94,z,3,0);
  // Details attach to the existing canopy / steps; no unsupported doorway.
  box(2.13,.10,.08,sx,2.30,-7.845,2,0);
  for(const x of [sx-.96,sx+.96]) box(.18,.07,.18,x,2.24,-7.66,2,1);
  for(let i=0;i<3;i++)box(2.31,.028,.065,sx,(3-i)*.15-.45,-6.51-.38*(i+1)-.18,2,1);
}
c.pilotDetail={version:1,boxes,windowHeight:1.35};
c.floorStudy.accuracy+=' Пилот детализации: оконные отливы, дополнительные переплёты, накрывки и ограждения показаны условно; их малые размеры не являются обмером или точным воспроизведением узлов проекта.';
fs.writeFileSync(path.join(engine,'configs/pilot.json'),JSON.stringify(c));
fs.copyFileSync(path.join(root,'96-pilot.js'),path.join(engine,'src/modules/96-pilot.js'));
function edit(file,from,to) {
  const p=path.join(engine,'src',file), s=fs.readFileSync(p,'utf8');
  if(!s.includes(from)) throw new Error('Patch anchor missing: '+file+' '+from);
  fs.writeFileSync(p,s.replace(from,to));
}
edit('viewer.html','this.buildShell(THREE);','this.buildShell(THREE);\n      this.buildPilotDetail(THREE);');
edit('viewer.html',"this.onResize(); window.addEventListener('resize',this.onResize);","this.initPilot();\n      this.onResize(); window.addEventListener('resize',this.onResize);");
edit('modules/70-scene.js','const pr=Math.min(window.devicePixelRatio||1,2);','const pr=Math.min(window.devicePixelRatio||1,this.pilotPixelRatio||2);');
edit('modules/70-scene.js','this.bloomComposer.setPixelRatio(pr);','this.bloomComposer.setPixelRatio(pr*(this.pilotBloomScale||1));');
edit('modules/70-scene.js','this.frame++;','const pilotNow=performance.now();\n    if(this.pilotGate && !this.pilotGate(pilotNow)) return;\n    this.frame++;');
edit('modules/70-scene.js','this.renderFrame();','this.updatePilotDetail && this.updatePilotDetail();\n    this.renderFrame();');
edit('modules/30-render.js','if(this.bloomComposer){','if(this.bloomComposer && !this.pilotEconomy){');
edit('modules/30-render.js','this.composer.render();','if(this.bloomMix) this.bloomMix.enabled=!this.pilotEconomy;\n    this.composer.render();');
edit('modules/30-render.js','if(!this.outlineOn||!this.geoRT) return;','if(this.pilotEconomy||!this.outlineOn||!this.geoRT) return;');
// Reference mkd-121 uses toggleExplode's camera (distance 13), without the
// floor-study fit inflating the entire house by every system's displacement.
edit('modules/50-plans.js','fitFloorStudyView(){','fitFloorStudyView(){\n    if(this.state.exploded){this.fitPilotExplodedPhone();return;}\n    if(this.pilotClose&&!this.state.cut)return;');
edit('modules/70-scene.js','toggleExplode=()=>{\n    if(this.wholeMode) return;','toggleExplode=()=>{\n    if(this.wholeMode) return;\n    if(this.pilotClose){this.azTarget=this.azHome;this.elTarget=this.elHome;}\n    this.pilotClose=false;this.fovTarget=42;this._studyViewFrameKey=null;this._pilotExplosionFitKey=null;');
cp.execFileSync(process.execPath,[path.join(engine,'build.js'),'--config',path.join(engine,'configs/pilot.json'),'--check'],{stdio:'inherit'});
cp.execFileSync(process.execPath,[path.join(engine,'build.js'),'--config',path.join(engine,'configs/pilot.json'),'--out',path.join(root,'pilot.html')],{stdio:'inherit'});
console.log('Detail boxes:',boxes.length,'; triangles:',boxes.length*12);
