  // ---- crisp contour pass (screen-space normal + depth edges) ---------------
  // EdgesGeometry on a noisy scan mesh either speckles or breaks up. Instead we
  // render the solid shell's view-space normal (rgb) + depth (a) to an offscreen
  // buffer, then draw a bright line where the normal breaks or depth jumps,
  // thresholded so micro surface-noise is ignored. Gives clean feature contours
  // AND the outer silhouette (depth jump to background) in one pass, view-stable
  // regardless of triangle density.
  buildOutline(THREE){
    const cfg=this.CONFIG;
    this.outlineOn = cfg.outline!=null ? !!cfg.outline : this.wholeMode;
    if(!this.outlineOn) return;
    const acc=this.ACCENTS[cfg.accent]||this.ACCENTS.cyan;
    this.geoRT=new THREE.WebGLRenderTarget(2,2,{depthBuffer:true, minFilter:THREE.NearestFilter, magFilter:THREE.NearestFilter});
    this.geoMat=new THREE.ShaderMaterial({ side:THREE.DoubleSide,
      vertexShader:`varying vec3 vN; varying float vZ; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vZ=-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader:`varying vec3 vN; varying float vZ; void main(){ gl_FragColor=vec4(normalize(vN)*0.5+0.5, clamp(vZ/40.0,0.0,1.0)); }`
    });
    this.outUniforms={
      tGeo:{value:this.geoRT.texture}, uRes:{value:new THREE.Vector2(2,2)},
      uThick:{value: cfg.outlineWidth!=null?cfg.outlineWidth:1.4 },
      uNorm:{value: cfg.contourNormal!=null?cfg.contourNormal:0.9 },   // normal-break threshold (sum of 4 neighbours)
      uDepth:{value: cfg.contourDepth!=null?cfg.contourDepth:0.012 },  // depth-jump threshold (silhouette/overlap)
      uColor:{value:new THREE.Color().setRGB(Math.min(1,acc.a[0]*1.1+0.15),Math.min(1,acc.a[1]*1.05+0.05),1.0)},
      uInt:{value: cfg.outlineIntensity!=null?cfg.outlineIntensity:1.0 }, uProgress:{value:0}
    };
    const quadMat=new THREE.ShaderMaterial({
      uniforms:this.outUniforms, transparent:true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending,
      vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
      fragmentShader:`
        uniform sampler2D tGeo; uniform vec2 uRes; uniform float uThick,uNorm,uDepth,uInt,uProgress; uniform vec3 uColor;
        varying vec2 vUv;
        float nd(vec3 a, vec4 s){ return 1.0-clamp(dot(a,s.rgb*2.0-1.0),0.0,1.0); }
        void main(){
          vec2 px=uThick/uRes;
          vec4 c=texture2D(tGeo,vUv); vec3 nC=c.rgb*2.0-1.0; float dC=c.a;
          vec4 sR=texture2D(tGeo,vUv+vec2(px.x,0.0)),  sL=texture2D(tGeo,vUv+vec2(-px.x,0.0));
          vec4 sU=texture2D(tGeo,vUv+vec2(0.0,px.y)),  sD=texture2D(tGeo,vUv+vec2(0.0,-px.y));
          vec4 sA=texture2D(tGeo,vUv+vec2(px.x,px.y)), sB=texture2D(tGeo,vUv+vec2(-px.x,px.y));
          vec4 sC=texture2D(tGeo,vUv+vec2(px.x,-px.y)),sE=texture2D(tGeo,vUv+vec2(-px.x,-px.y));
          // 8-tap, averaged so thresholds stay intuitive
          float ne=(nd(nC,sR)+nd(nC,sL)+nd(nC,sU)+nd(nC,sD)+nd(nC,sA)+nd(nC,sB)+nd(nC,sC)+nd(nC,sE))*0.5;
          float de=(abs(dC-sR.a)+abs(dC-sL.a)+abs(dC-sU.a)+abs(dC-sD.a)+abs(dC-sA.a)+abs(dC-sB.a)+abs(dC-sC.a)+abs(dC-sE.a))*0.5;
          float onObj=step(0.0001, dC+sR.a+sL.a+sU.a+sD.a+sA.a+sB.a+sC.a+sE.a); // skip pure background
          // slope-компенсация порога глубины: на пологих к лучу зрения участках
          // (|n.z|→0) глубина между соседними пикселями меняется быстро и при
          // фиксированном пороге даёт ложные «лучи» по поверхности. Настоящий
          // силуэт (перепад в фон/перекрытие) на порядок больше и остаётся.
          float slope=1.0/max(abs(nC.z),0.18);
          float dth=uDepth*slope;
          float nEdge=smoothstep(uNorm, uNorm*1.7, ne);
          float dEdge=smoothstep(dth, dth*2.5, de);
          float edge=max(nEdge,dEdge)*onObj;
          float a=edge*uInt*smoothstep(0.0,1.0,uProgress);
          if(a<=0.004) discard;
          gl_FragColor=vec4(uColor,a);
        }`
    });
    this.outlineScene=new THREE.Scene();
    this.outlineCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.outlineQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),quadMat);
    this.outlineQuad.frustumCulled=false; this.outlineScene.add(this.outlineQuad);
  }

  renderOutline(){
    if(!this.outlineOn||!this.geoRT) return;
    const r=this.renderer, sc=this.scene, cam=this.camera;
    // 1) render the solid shell's normal+depth to the offscreen buffer
    const bg=sc.background; sc.background=null;
    const hide=[this.lines,this.boldLines,this.innerLines,this.reflect,this.groundPlane];
    const vis=hide.map(o=>o&&o.visible); hide.forEach(o=>{ if(o) o.visible=false; });
    sc.overrideMaterial=this.geoMat;
    r.setRenderTarget(this.geoRT); r.setClearColor(0x808080,0); r.clear();   // bg: normal 0, depth 0
    r.render(sc,cam);
    r.setRenderTarget(null);
    sc.overrideMaterial=null; sc.background=bg; hide.forEach((o,i)=>{ if(o) o.visible=vis[i]; });
    r.setClearColor(0x000000,0);
    // 2) draw detected edges over the already-composited frame
    this.outUniforms.uProgress.value=this.progress;
    const ac=r.autoClear; r.autoClear=false; r.render(this.outlineScene,this.outlineCam); r.autoClear=ac;
  }

  // final image pass: ACES filmic tone-map (rolls off the additive highlights so
  // bright cores read as light instead of pure white) + a subtle cool colour grade.
  addGradePass(THREE, composer){
    const SP=THREE.ShaderPass; if(!SP) return;
    const g=this.CONFIG.grade||{};
    this.gradePass=new SP({
      uniforms:{ tDiffuse:{value:null},
        uExp:{value: g.exposure!=null?g.exposure:1.06 },
        uContrast:{value: g.contrast!=null?g.contrast:1.06 },
        uSat:{value: g.saturation!=null?g.saturation:1.12 } },
      vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader:`
        uniform sampler2D tDiffuse; uniform float uExp,uContrast,uSat; varying vec2 vUv;
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
        void main(){
          vec3 c=texture2D(tDiffuse,vUv).rgb*uExp;
          c=aces(c);
          c=(c-0.5)*uContrast+0.5;
          float l=dot(c, vec3(0.2126,0.7152,0.0722));
          c=mix(vec3(l), c, uSat);
          c.b+=0.012; c.g+=0.004;            // gentle cool lift -> holographic blue
          gl_FragColor=vec4(clamp(c,0.0,1.0), 1.0);
        }`
    });
    composer.addPass(this.gradePass);
  }

  computeNorm(THREE){
    const box=new THREE.Box3(), tmp=new THREE.Box3();
    this.meshData.forEach(md=>{ if(!md.geometry.boundingBox) md.geometry.computeBoundingBox(); tmp.copy(md.geometry.boundingBox).applyMatrix4(md.matrixWorld); box.union(tmp); });
    const size=new THREE.Vector3(); box.getSize(size);
    const center=new THREE.Vector3(); box.getCenter(center);
    const maxDim=Math.max(size.x,size.y,size.z)||1;
    const scl=5.5/maxDim;
    this.norm={ center, minY:box.min.y, scl, height:size.y*scl, size:size.clone() };
    this.uniforms.uGround.value=-0.05;
    this.scanMin=0; this.scanMax=size.y*scl+0.3;
  }

  buildShell(THREE){
    const {center,minY,scl}=this.norm;
    const N=new THREE.Matrix4().makeTranslation(-scl*center.x,-scl*minY,-scl*center.z).multiply(new THREE.Matrix4().makeScale(scl,scl,scl));
    if(this.shellGroup){ this.pivot.remove(this.shellGroup); }
    this.shellGroup=new THREE.Group();
    this.meshData.forEach(md=>{
      if(!md.geometry.attributes.normal){ md.geometry.computeVertexNormals(); }
      const m=new THREE.Mesh(md.geometry, this.matShell);
      m.matrixAutoUpdate=false; m.matrix.copy(N).multiply(md.matrixWorld); m.matrixWorldNeedsUpdate=true;
      m.frustumCulled=false; m.renderOrder=0; this.shellGroup.add(m);
    });
    this.pivot.add(this.shellGroup);
  }

  buildEdgeGeo(THREE, angle, dirs, accum){
    const {center,minY,scl}=this.norm;
    const pos=[], mats=[];
    const v=new THREE.Vector3();
    this.meshData.forEach(md=>{
      const eg=new THREE.EdgesGeometry(md.geometry, angle);
      const arr=eg.attributes.position.array;
      const m=md.matrixWorld;
      for(let i=0;i<arr.length;i+=3){ v.set(arr[i],arr[i+1],arr[i+2]).applyMatrix4(m); pos.push(v.x,v.y,v.z); mats.push(md.mat); }
      eg.dispose();
    });
    const N=pos.length/3;
    const part=new Float32Array(N), seed=new Float32Array(N), expl=new Float32Array(pos.length), hot=new Float32Array(N);
    const hotSet=this.hotSet;
    const norm=new Float32Array(pos.length);
    for(let i=0;i<pos.length;i+=3){ norm[i]=(pos[i]-center.x)*scl; norm[i+1]=(pos[i+1]-minY)*scl; norm[i+2]=(pos[i+2]-center.z)*scl; }
    for(let i=0;i<N;i+=2){
      const pi=this.matToPart(mats[i]); const s=Math.random(); const d=dirs[pi]||[0,1,0]; const hv=(hotSet&&hotSet.has(pi))?1:0;
      for(const j of [i,i+1]){ if(j>=N) break; part[j]=pi; seed[j]=s; hot[j]=hv; const o=j*3; expl[o]=d[0]; expl[o+1]=d[1]; expl[o+2]=d[2]; if(accum){ const a=accum[pi]; if(a){ a.x+=norm[o]; a.y+=norm[o+1]; a.z+=norm[o+2]; a.n++; } } }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(norm,3));
    g.setAttribute('aSeed',new THREE.BufferAttribute(seed,1));
    g.setAttribute('aPart',new THREE.BufferAttribute(part,1));
    g.setAttribute('aHot',new THREE.BufferAttribute(hot,1));
    g.setAttribute('aExplode',new THREE.BufferAttribute(expl,3));
    g.computeBoundingSphere();
    return g;
  }

  buildEdges(THREE, angle){
    if(this.lines){ this.pivot.remove(this.lines); this.lines.geometry.dispose(); }
    if(this.boldLines){ this.pivot.remove(this.boldLines); this.boldLines.geometry.dispose(); }
    if(this.innerLines){ this.pivot.remove(this.innerLines); if(this.hotGeo){ this.hotGeo.dispose(); this.hotGeo=null; } }
    if(this.reflect){ this.pivot.remove(this.reflect); }
    if(this.groundPlane){ this.pivot.remove(this.groundPlane); }

    // explosion directions per part (normalized space). CONFIG.explodeDirs keyed
    // by part.key; default = radial fan so even unconfigured parts separate.
    const ed=this.CONFIG.explodeDirs||{};
    const n=Math.max(1,this.PARTDEF.length);
    const dirs=this.PARTDEF.map((p,i)=>{
      if(ed[p.key]) return ed[p.key].slice();
      const a=(i/n)*Math.PI*2; return [Math.cos(a)*1.6, 0.6, Math.sin(a)*1.6];
    });
    if(!dirs.length) dirs.push([0,1,0]);
    this.partDirs=dirs;

    // "hot" systems (engine/drivetrain/wheels…) render in the red inner colour
    this.hotSet=new Set((this.CONFIG.hotParts||[]).map(k=>this.PARTDEF.findIndex(p=>p.key===k)).filter(i=>i>=0));

    const accum=this.PARTDEF.map(()=>({x:0,y:0,z:0,n:0}));
    const denseGeo=this.buildEdgeGeo(THREE, angle, dirs, accum);
    const boldGeo=this.buildEdgeGeo(THREE, this.wholeMode?44:this.boldAngle, dirs, null);
    // hot/internal systems get their OWN coarse-angle edges so dense wheels/engine
    // read as clean red rings (not a saturated white disc under additive blending).
    const hotAngle=this.CONFIG.hotAngle!=null?this.CONFIG.hotAngle:30;
    const hotGeo=(this.hotSet&&this.hotSet.size)? this.buildEdgeGeo(THREE, hotAngle, dirs, null) : denseGeo;
    this.hotGeo=(hotGeo!==denseGeo)?hotGeo:null;
    this.geometry=denseGeo;

    const H=this.norm.height;
    this.partCents=accum.map(a=> a.n? [a.x/a.n,a.y/a.n,a.z/a.n] : [0,H*0.5,0]);

    window.__holo=this;
    this.lines=new THREE.LineSegments(denseGeo,this.mat); this.lines.renderOrder=2; this.pivot.add(this.lines);
    this.boldLines=new THREE.LineSegments(boldGeo,this.matBold); this.boldLines.renderOrder=3; this.pivot.add(this.boldLines);
    this.innerLines=new THREE.LineSegments(hotGeo,this.matInner); this.innerLines.renderOrder=5; this.pivot.add(this.innerLines);
    this.reflect=new THREE.LineSegments(denseGeo,this.matRefl); this.reflect.scale.y=-1; this.reflect.position.y=-0.1; this.reflect.renderOrder=-1; this.pivot.add(this.reflect);
    this.addGround(THREE);
    this.target=new THREE.Vector3(0,H*0.5,0);
    this.dist=this.distTarget=Math.max(8.5, H*2.4);
    this.tgt={x:0,y:H*0.5,z:0}; this.tgtGoal={x:0,y:H*0.5,z:0};
    this.buildLabels();
    this.buildMarkers();
    this.buildRoomLabels();
    this.buildFlows(THREE); this.buildFlowLegend();   // guide-tube arrows once; legend re-attaches after labelBox clear
    this.progress=0; this.uniforms.uProgress.value=0; this.startTime=performance.now();
  }
