  // Pilot detail: six batched shell meshes maximum, one line draw per LOD tier.
  buildPilotDetail(T){
    const cfg=this.CONFIG.pilotDetail;
    if(!cfg) return;
    this.pilotEnabled=true; this.pilotDetails=[]; this.pilotLineTiers=[];
    // A restrained contour makes the added joinery readable. The original
    // interior-fill shader is intentionally too faint for facade details.
    this.pilotLineMaterial=this.matBold.clone();
    this.pilotLineMaterial.uniforms={...this.uniforms,uBold:{value:.45},uBAmt:{value:.18}};
    const n=this.norm, bins=new Map(), md=[[],[]];
    const N=new T.Matrix4().makeTranslation(-n.center.x*n.scl,-n.minY*n.scl,-n.center.z*n.scl).multiply(new T.Matrix4().makeScale(n.scl,n.scl,n.scl));
    for(const d of cfg.boxes){
      const [w,h,z,x,y,zz]=d.box, g=new T.BoxGeometry(w,h,z), m=new T.Matrix4().makeTranslation(x,y,zz).multiply(new T.Matrix4().makeRotationY((d.ry||0)*Math.PI/180));
      md[d.tier].push({geometry:g,matrixWorld:m,mat:this.PARTDEF[d.part].key});
      const key=d.part+'/'+d.tier;
      if(!bins.has(key)) bins.set(key,{part:d.part,tier:d.tier,geos:[]});
      const transformed=g.clone().applyMatrix4(new T.Matrix4().copy(N).multiply(m));
      bins.get(key).geos.push(transformed.toNonIndexed());transformed.dispose();
    }
    for(const b of bins.values()){
      const g=new T.BufferGeometry();
      for(const a of ['position','normal']){
        const arr=new Float32Array(b.geos.reduce((s,g)=>s+g.attributes[a].array.length,0));
        let at=0; for(const geo of b.geos){arr.set(geo.attributes[a].array,at);at+=geo.attributes[a].array.length;}
        g.setAttribute(a,new T.BufferAttribute(arr,3));
      }
      b.geos.forEach(g=>g.dispose()); g.computeBoundingSphere();
      const m=new T.Mesh(g,this.matShell); m.matrixAutoUpdate=false; m.frustumCulled=false;
      this.shellGroup.add(m);
      this.shellMeshes.push({m,base:new T.Matrix4(),dir:this.partDirs[b.part]});
      this.pilotDetails.push({obj:m,tier:b.tier});
    }
    const original=this.meshData;
    try {
      for(let tier=0;tier<2;tier++){
        this.meshData=md[tier];
        const g=this.buildEdgeGeo(T,30,this.partDirs,null);
        const m=new T.LineSegments(g,this.pilotLineMaterial);m.renderOrder=3;this.pivot.add(m);
        this.pilotDetails.push({obj:m,tier});this.pilotLineTiers.push(m);
      }
    } finally {this.meshData=original;md.flat().forEach(m=>m.geometry.dispose());}
  }
  initPilot(){
    if(!this.CONFIG.pilotDetail) return;
    this.pilotQuality='auto'; this.pilotFine=false; this.pilotLastFrame=0;
    this.pilotSlow=0;this.pilotSamples=[];
    this.setPilotQuality('auto');
    this._pilotReceive=e=>{
      if(e.source!==parent||!e.data||e.data.pilot!==true) return;
      if(e.data.action==='detail') this.pilotEnabled=!!e.data.value;
      if(e.data.action==='quality'&&['auto','economy','normal','high'].includes(e.data.value)) this.setPilotQuality(e.data.value);
      if(e.data.action==='reset'){this.pilotClose=false;this.setState({flow:true});this.resetView();this._studyViewFrameKey=null;}
      if(e.data.action==='close')this.showPilotClose();
      this.updatePilotDetail();this.pilotPublish();
    };
    window.addEventListener('message',this._pilotReceive);
    this.pilotPublish();
  }
  setPilotQuality(q){
    this.pilotQuality=q;
    // Conservative initial choice; auto can step down from measured frame time.
    const small=matchMedia('(pointer:coarse)').matches||innerWidth<700;
    this.pilotProfile=q==='auto'?(small?'economy':'normal'):q;
    this.applyPilotProfile();
  }
  fitPilotExplodedPhone(){
    const w=this.canvas.clientWidth,h=this.canvas.clientHeight,phone=this.hmOn,tab=document.documentElement.dataset.hm||'';
    if(!phone&&w/h>=1.5)return;
    const key=[w,h,phone,tab].join('/');if(key===this._pilotExplosionFitKey)return;
    this._pilotExplosionFitKey=key;
    const T=this.THREE,n=this.norm;
    if(!this._pilotExplosionCorners){
      const bins=new Map(),tmp=new T.Box3();
      for(const md of this.meshData){
        const part=this.matToPart(md.mat);
        if(!bins.has(part))bins.set(part,new T.Box3());
        tmp.copy(md.geometry.boundingBox).applyMatrix4(md.matrixWorld);bins.get(part).union(tmp);
      }
      const points=[];
      for(const [part,b] of bins){const d=this.partDirs[part];
        for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])
          points.push([(x-n.center.x)*n.scl+d[0],(y-n.minY)*n.scl+d[1],(z-n.center.z)*n.scl+d[2]]);
      }
      this._pilotExplosionCorners=points;
    }
    const ca=Math.cos(this.azTarget),sa=Math.sin(this.azTarget),ce=Math.cos(this.elTarget),se=Math.sin(this.elTarget);
    const points=this._pilotExplosionCorners.map(([x,y,z])=>{const xx=x*ca+z*sa,zz=-x*sa+z*ca,yy=y-n.height/2;return[xx,ce*yy-se*zz,se*yy+ce*zz];});
    const cx=(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2;
    const cy=(Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2;
    const sheet=phone&&tab?document.querySelector(tab==='view'?'[style*="--hm-tools"]':'aside'):null;
    const occupied=phone?this.HM_BAR+(sheet?sheet.getBoundingClientRect().height:0):40;
    const side=phone?0:Math.min(360,w*.32);
    const freeW=Math.max(120,w-side-32),freeH=Math.max(140,h-occupied-70),vt=Math.tan(42*Math.PI/360);
    // Fit real displaced systems, not an inflated box around the whole house.
    let dist=13;
    for(const [x,y,z] of points)dist=Math.max(dist,z+Math.abs(x-cx)*h/(vt*freeW),z+Math.abs(y-cy)*h/(vt*freeH));
    this.distTarget=dist*1.04;
    this.tgtGoal={x:cx+side/h*this.distTarget*vt,y:n.height/2+cy*ce,z:-cy*se};this.hmShift();
  }
  showPilotClose(){
    if(this.state.plan){this.setState({plan:false});this.applyPlan();}
    if(this.state.cut){this.setState({cut:false});this.applyCut();}
    this.pilotClose=true;
    this.setState({flow:false,selected:-1,exploded:false});this.selectedPart=-1;this.explodeTarget=0;
    this.azTarget=.10;this.elTarget=.12;this.fovTarget=34;
    this.distTarget=this.canvas.clientWidth<700?3.0:4.7;
    this.tgtGoal={x:0,y:1.30,z:0};
    this.lastInteract=performance.now();
  }
  applyPilotProfile(){
    const p=this.pilotProfile;
    this.pilotEconomy=p==='economy';
    this.pilotPixelRatio={economy:1,normal:1.25,high:1.75}[p];
    this.pilotBloomScale=p==='high'?1:.5;
    // Keep disabled postprocessing targets tiny as well as skipping their work.
    if(this.pilotEconomy)this.pilotBloomScale=.1;
    this.pilotSamples=[];this.pilotSlow=0;this.pilotLastFrame=0;
    this.onResize();this.pilotPublish();
  }
  pilotGate(now){
    if(!this.CONFIG.pilotDetail)return true;
    if(this.pilotEconomy){
      const step=1000/30, elapsed=now-(this.pilotDue||0);
      if(elapsed<step)return false;
      this.pilotDue=now-(elapsed%step);
    }
    const dt=now-this.pilotLastFrame;this.pilotLastFrame=now;
    if(dt>0&&dt<250&&this.progress>.99){
      this.pilotSamples.push(dt);if(this.pilotSamples.length>90)this.pilotSamples.shift();
      // Sustained overload only; a loading/resize spike cannot switch quality.
      this.pilotSlow=dt>38?this.pilotSlow+1:Math.max(0,this.pilotSlow-1);
      if(this.pilotQuality==='auto'&&!this.pilotEconomy&&this.pilotSlow>50){this.pilotProfile='economy';this.applyPilotProfile();}
    }
    if(!this.pilotLastReport||now-this.pilotLastReport>1000){this.pilotLastReport=now;this.pilotPublish();}
    return true;
  }
  updatePilotDetail(){
    if(!this.pilotDetails)return;
    this.updatePilotEdgeRanges();
    const n=this.norm, scale=this.canvas.clientHeight/(2*Math.tan(this.camera.fov*Math.PI/360)*Math.max(this.dist,.01));
    const px=this.CONFIG.pilotDetail.windowHeight*n.scl*scale;
    // Hysteresis stops detail flickering at the transition. Never rebuild geometry.
    const threshold=this.pilotEconomy?26:17;
    if(px>threshold+3)this.pilotFine=true;
    if(px<threshold-3)this.pilotFine=false;
    const visible=this.pilotEnabled&&!this.state.plan&&!this.state.cut;
    for(const d of this.pilotDetails)d.obj.visible=visible&&(d.tier===0||this.pilotFine);
    if(this.reflect)this.reflect.visible=!this.pilotEconomy&&!this.state.plan&&!this.state.cut;
  }
  updatePilotEdgeRanges(){
    // The original shader discards quiet apartment geometry. Keep those same
    // segments out of vertex processing as well, including the reflection.
    // Only the overview is filtered. Inspection modes retain every original
    // segment: CPU clipping at floor boundaries can differ from rasterization.
    const u=this.uniforms, plan=!!this.state.plan;
    const quiet=new Set((this.CONFIG.quietParts||[]).map(k=>this.PARTDEF.findIndex(p=>p.key===k)));
    const reveal=this.state.cut||this.explode>.01||quiet.has(this.selectedPart);
    const full=plan||reveal;
    const key=full?'full':'overview';
    const geos=new Set([this.lines?.geometry,this.boldLines?.geometry,this.innerLines?.geometry]);
    for(const g of geos){
      if(!g||g.userData.pilotRange===key)continue;
      const cache=g.userData.pilotIndices||(g.userData.pilotIndices=new Map());
      let index=cache.get(key);
      if(!index){
        const a=g.attributes.aPart.array,out=[];
        for(let i=0;i<a.length;i+=2){
          if(!full&&quiet.has(Math.round(a[i])))continue;
          out.push(i,i+1);
        }
        index=new this.THREE.BufferAttribute(new Uint32Array(out),1);
        // Only the current mode's index lives on the GPU; cache raw indices so
        // repeated changes do not leave unowned WebGL buffers behind.
        if(cache.size>12)cache.clear();
        cache.set(key,index.array);
      }
      const raw=index.array||index;
      // Reuse one preallocated attribute; Three.js updates its existing buffer.
      if(!g.index)g.setIndex(new this.THREE.BufferAttribute(new Uint32Array(g.attributes.position.count),1).setUsage(this.THREE.DynamicDrawUsage));
      g.index.array.set(raw);g.index.needsUpdate=true;g.setDrawRange(0,raw.length);
      g.userData.pilotRange=key;
    }
  }
  pilotPublish(){
    if(parent===window)return;
    const a=(this.pilotSamples||[]).slice().sort((a,b)=>a-b);
    parent.postMessage({pilot:true,event:'status',enabled:this.pilotEnabled,quality:this.pilotQuality,profile:this.pilotProfile,fine:this.pilotFine,fps:a.length?Math.round(1000/a[Math.floor(a.length/2)]):null},location.origin==='null'?'*':location.origin);
  }
