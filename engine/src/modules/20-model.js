  // hybrid mode resolution: even a "structured" config collapses to whole-mode
  // if the material rules end up classifying everything into one bucket.
  resolveMode(){
    if(this.CONFIG.mode==='whole' || this.PARTDEF.length<2){ this._wholeMode=true; this.uniforms.uInner.value=-1; return; }
    const seen=new Set();
    for(const md of this.meshData){ seen.add(this.matToPart(md.mat)); if(seen.size>1) break; }
    this._wholeMode = (this.CONFIG.mode!=='structured') && seen.size<2;
    // amber inner pass: index of the part flagged as "internals" (engine etc.)
    const ik=this.CONFIG.innerPartKey;
    let ii=-1; if(ik && !this._wholeMode){ ii=this.PARTDEF.findIndex(p=>p.key===ik); }
    this.uniforms.uInner.value=ii;
    this.innerIdx=ii;
  }

  // single-mesh scans read as a cyan haze -> push bright structural contours and
  // dim the faint interior fill so the silhouette stays crisp. Tunable per object.
  applyLook(){
    const cfg=this.CONFIG;
    // whole/scan: the crisp lines now come from the screen-space contour pass, so
    // the noisy 3D bold wireframe is dropped (uBold≈0) and the interior wireframe
    // is kept only as a faint holographic ghost (uFill low).
    this.uniforms.uBold.value = cfg.contour!=null ? cfg.contour : (this.wholeMode?0.0:1.0);
    this.uniforms.uFill.value = cfg.fill!=null    ? cfg.fill    : (this.wholeMode?0.15:1.0);
    // whole/scan: whiter, crisper contour; structured: original blue-cyan (reference)
    if(this.wholeMode){ this.uniforms.uBTint.value.setRGB(0.85,0.97,1.0); this.uniforms.uBAmt.value=0.35; }
    else { this.uniforms.uBTint.value.setRGB(0.05,0.45,1.0); this.uniforms.uBAmt.value=0.5; }
    // colour of the "hot" internal systems (red/orange, like an x-ray of the drivetrain)
    if(cfg.hotColor && cfg.hotColor.length===3) this.uniforms.uColor2.value.setRGB(cfg.hotColor[0],cfg.hotColor[1],cfg.hotColor[2]);
  }

  // ---- scan-mesh cleanup ----------------------------------------------------
  // TRELLIS / photogrammetry meshes are noisy and often unwelded, which makes
  // EdgesGeometry draw nearly every triangle edge -> a "crumpled" wireframe.
  // We weld coincident vertices (-> real adjacency) then Laplacian-smooth the
  // positions a few passes to relax surface noise, so only true structure
  // survives the (coarser) edge angle. Defaults on for whole-mode; tunable via
  // CONFIG.smooth (iterations), CONFIG.smoothLambda, CONFIG.weldPrecision.
  prepGeometries(THREE){
    const cfg=this.CONFIG;
    const iters = (cfg.smooth!=null) ? cfg.smooth : (this.wholeMode? 4 : 0);
    const doWeld = this.wholeMode || iters>0 || cfg.weld;
    if(!doWeld) return;
    const prec = cfg.weldPrecision!=null ? cfg.weldPrecision : 4;
    const lambda = cfg.smoothLambda!=null ? cfg.smoothLambda : 0.5;
    this.meshData.forEach(md=>{
      let g=this.weldGeometry(THREE, md.geometry, prec);
      if(iters>0) this.smoothGeometry(g, iters, lambda);
      g.computeVertexNormals(); g.computeBoundingBox();
      md.geometry=g;
    });
  }

  weldGeometry(THREE, geo, prec){
    const src=geo.attributes.position.array, n=src.length/3;
    const f=Math.pow(10,prec), map=new Map(), out=[], remap=new Int32Array(n);
    for(let i=0;i<n;i++){
      const x=src[i*3],y=src[i*3+1],z=src[i*3+2];
      const key=Math.round(x*f)+'|'+Math.round(y*f)+'|'+Math.round(z*f);
      let idx=map.get(key);
      if(idx===undefined){ idx=out.length/3; map.set(key,idx); out.push(x,y,z); }
      remap[i]=idx;
    }
    const srcIdx=geo.index?geo.index.array:null;
    const cnt=srcIdx?srcIdx.length:n;
    const Idx=(out.length/3)>65535?new Uint32Array(cnt):new Uint16Array(cnt);
    for(let i=0;i<cnt;i++){ const oi=srcIdx?srcIdx[i]:i; Idx[i]=remap[oi]; }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out),3));
    g.setIndex(new THREE.BufferAttribute(Idx,1));
    return g;
  }

  // uniform-weight Laplacian smoothing over welded adjacency (in place)
  smoothGeometry(geo, iters, lambda){
    const pos=geo.attributes.position.array, n=pos.length/3, idx=geo.index.array;
    for(let it=0; it<iters; it++){
      const sum=new Float32Array(n*3), cnt=new Uint32Array(n);
      const add=(u,w)=>{ sum[u*3]+=pos[w*3]; sum[u*3+1]+=pos[w*3+1]; sum[u*3+2]+=pos[w*3+2]; cnt[u]++; };
      for(let i=0;i<idx.length;i+=3){
        const a=idx[i],b=idx[i+1],c=idx[i+2];
        add(a,b); add(b,a); add(b,c); add(c,b); add(c,a); add(a,c);
      }
      for(let i=0;i<n;i++){ const c=cnt[i]; if(!c) continue;
        pos[i*3]   += lambda*(sum[i*3]/c   - pos[i*3]);
        pos[i*3+1] += lambda*(sum[i*3+1]/c - pos[i*3+1]);
        pos[i*3+2] += lambda*(sum[i*3+2]/c - pos[i*3+2]);
      }
    }
    geo.attributes.position.needsUpdate=true;
  }
