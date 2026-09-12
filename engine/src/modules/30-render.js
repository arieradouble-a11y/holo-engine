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
    // HalfFloat обязателен: в 8-битном таргете глубина в альфе квантуется с шагом
    // 1/256≈0.004 — сопоставимо с порогом uDepth, и «ступени» квантования сами
    // рисуются как полосы по гладким поверхностям (артефакт «лучей»/«масла»).
    this.geoRT=new THREE.WebGLRenderTarget(2,2,{depthBuffer:true, type:THREE.HalfFloatType, minFilter:THREE.NearestFilter, magFilter:THREE.NearestFilter});
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
      uInt:{value: cfg.outlineIntensity!=null?cfg.outlineIntensity:1.0 }, uProgress:{value:0},
      // внутренние (по перелому нормали) контуры — своя, приглушённая яркость
      // И свой цвет (по умолчанию янтарный): устройство читается, силуэт остаётся
      // главным, а тёплый янтарь визуально отделяет «нутро» от голубого силуэта.
      uIntN:{value: cfg.outlineInnerIntensity!=null?cfg.outlineInnerIntensity:(cfg.outlineIntensity!=null?cfg.outlineIntensity:1.0)*0.45 },
      uColorN:{value:new THREE.Color().fromArray(cfg.outlineInnerColor||[1.0,0.62,0.18])},
      uHover:{value:0}   // подсветка при наведении курсора (0..1)
    };
    const quadMat=new THREE.ShaderMaterial({
      uniforms:this.outUniforms, transparent:true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending,
      vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
      fragmentShader:`
        uniform sampler2D tGeo; uniform vec2 uRes; uniform float uThick,uNorm,uDepth,uInt,uIntN,uProgress,uHover; uniform vec3 uColor,uColorN;
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
          // силуэт/перекрытия — цветом uColor полной яркостью; внутренние переломы —
          // тёплым uColorN своей (приглушённой) яркостью. Наведение курсора (uHover)
          // мягко добавляет обоим яркости — модель «оживает» под мышкой.
          float prog=smoothstep(0.0,1.0,uProgress);
          float so=dEdge*uInt*(1.0+0.45*uHover);   // outer strength
          float si=nEdge*uIntN*(1.0+0.6*uHover);    // inner strength
          float m=max(so,si)*onObj;
          if(m*prog<=0.004) discard;
          vec3 col=(uColor*so + uColorN*si)*onObj*prog;   // аддитивный бленд (src.a=1)
          gl_FragColor=vec4(col, 1.0);
        }`
    });
    this.outlineScene=new THREE.Scene();
    this.outlineCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.outlineQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),quadMat);
    this.outlineQuad.frustumCulled=false; this.outlineScene.add(this.outlineQuad);
  }

  // Кадр в два прохода. (1) Блум-композер видит только светящееся: отражение,
  // пьедестал и фон выключены, оболочка подменена чёрным непрозрачным дублёром
  // (заслоняет линии за собой ровно как настоящая — depthWrite у обеих; уровень
  // «Оболочка» и режимы план/разрез наследуются сами: ползунок меняет лишь
  // альфу, а план/разрез прячут shellGroup целиком, что видно обоим проходам).
  // (2) Основной композер рисует полную сцену и подмешивает готовый блум.
  renderFrame(){
    if(!this.composer) return;
    if(this.bloomComposer){
      const sc=this.scene, bg=sc.background; sc.background=null;
      const hide=[this.reflect,this.groundPlane];
      const vis=hide.map(o=>o&&o.visible); hide.forEach(o=>{ if(o) o.visible=false; });
      if(this.shellGroup&&this.matShellDark) this.shellGroup.traverse(o=>{ if(o.isMesh) o.material=this.matShellDark; });
      this.bloomComposer.render();
      if(this.shellGroup&&this.matShell) this.shellGroup.traverse(o=>{ if(o.isMesh) o.material=this.matShell; });
      hide.forEach((o,i)=>{ if(o) o.visible=vis[i]; });
      sc.background=bg;
      // текстуру берём каждый кадр: setSize пересоздаёт таргеты блума
      if(this.bloomMix&&this.bloom&&this.bloom.renderTargetsHorizontal) this.bloomMix.uniforms.tBloom.value=this.bloom.renderTargetsHorizontal[0].texture;
    }
    this.composer.render();
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
    if(this.CONFIG.museumHouse && this.CONFIG.floorStudy){
      const study=this.CONFIG.floorStudy, range=study.planFloorRange||[0,0];
      const f=Math.floor((range[0]+range[1])/2), levels=study.floorLevels;
      const fh=this.CONFIG.building.floorHeight;
      const lo=levels?levels[f]:f*fh, hi=levels?levels[f+1]:(f+1)*fh;
      this.uniforms.uDetailY.value=((lo+hi)/2-box.min.y)*scl;
      this.uniforms.uDetailH.value=(hi-lo)*scl/2;
    }
    this.uniforms.uGround.value=-0.05;
    this.scanMin=0; this.scanMax=size.y*scl+0.3;
    this.resolveHomeView(size);
  }

  // ПОДЪЁМ КАМЕРЫ ЗАВИСИТ ОТ ПРОПОРЦИЙ. Единый ракурс (az 0.6 / el 0.42) хорош
  // для компактных узлов, но ШИРОКИЙ объект с него выглядит ЗАВАЛЕННЫМ: камера
  // стоит выше модели, поэтому у ближнего торца вниз уезжает и верхняя, и нижняя
  // кромка сразу — силуэт поворачивается целиком. Замер 9-этажки (66×32×15) на
  // умолчании: верх −84 px, низ −106 px на 580 px ширины, обе в одну сторону —
  // ровно то, что пользователь описал как «МКД наклонён вправо» (22.08.2026).
  // Сама модель при этом идеально ровная: в строгом фасе (az=0, el=0) наклон
  // кромок 0 px, поворотов у пивота нет — то есть чинить надо ракурс, а не геометрию.
  // При el≈0.20 кромки снова РАСХОДЯТСЯ (верх −18, низ −92) и читаются как
  // глубина, а не как крен: дом стоит.
  // spread = во сколько раз объект шире своей высоты; компактным ракурс не трогаем.
  resolveHomeView(size){
    const v=this.CONFIG.view||{};
    const spread=Math.max(size.x,size.z)/Math.max(size.y,1e-6);
    const t=Math.min(1, Math.max(0, (spread-1.4)/0.8));      // 1.4 → 0 ; 2.2 → 1
    this.elHome = v.el!=null ? v.el : 0.42 - t*0.24;          // 0.42 … 0.18
    this.azHome = v.az!=null ? v.az : 0.6;
    this.el=this.elTarget=this.elHome; this.az=this.azTarget=this.azHome;
  }

  // ОБОЛОЧКА СЛИТА ПО СИСТЕМАМ. Раньше на каждый примитив конфига заводился свой
  // THREE.Mesh: у 9-этажки это 2390 мешей, и кадр стоил 22.7 мс (44 fps) даже на
  // RTX 5080 — «обычный рабочий комп с трудом жуёт» (замечание пользователя
  // 20.08.2026). Разбор кадра по слоям показал, что 99% времени — именно оболочка:
  // без неё 0.3 мс, вызовов 41 вместо 4821. Причина двойная: (1) вызовов ровно
  // столько же, сколько мешей, и (2) three r134 при transparent+DoubleSide рисует
  // КАЖДЫЙ меш ДВАЖДЫ (задняя сторона, потом передняя), переставляя material.side
  // и material.needsUpdate между ними — то есть ещё и дёргая состояние шейдера
  // на каждый объект. Отсюда 4821 вызов на 2390 мешей.
  //
  // Геометрия при слиянии НЕ меняется: базовая матрица примитива запекается в
  // вершины и нормали, а матрица меша остаётся под разлёт — он и так один на всю
  // систему (partDirs[pi]), поэтому «Разобрать» работает ровно как прежде.
  // Замер после: 9-этажка 22.7 → 0.3 мс, вызовов 4821 → 57, мешей 2390 → 8;
  // МКД 14.8 → 0.3 мс. DoubleSide НЕ трогаем: на слитой оболочке двойной проход
  // стоит копейки, а односторонняя оболочка выглядит жиже (это видимая потеря).
  buildShell(THREE){
    const {center,minY,scl}=this.norm;
    const N=new THREE.Matrix4().makeTranslation(-scl*center.x,-scl*minY,-scl*center.z).multiply(new THREE.Matrix4().makeScale(scl,scl,scl));
    if(this.shellGroup){
      this.shellGroup.traverse(o=>{ if(o.isMesh && o.geometry && o.geometry.userData.merged) o.geometry.dispose(); });
      this.pivot.remove(this.shellGroup);
    }
    this.shellGroup=new THREE.Group();
    this.shellMeshes=[];

    // примитивы → корзины по системе: у системы один вектор разлёта
    const bins=new Map();
    this.meshData.forEach(md=>{
      if(!md.geometry.attributes.normal){ md.geometry.computeVertexNormals(); }
      const pi=this.matToPart(md.mat);
      // Detailed apartments retain their edges in plans/cuts/selection, but do
      // not add another translucent surface over the engineering overview.
      if((this.CONFIG.quietParts||[]).includes(this.CONFIG.parts?.[pi]?.key)) return;
      let b=bins.get(pi);
      if(!b){ b={ dir:(this.partDirs&&this.partDirs[pi])||[0,0,0], items:[] }; bins.set(pi,b); }
      b.items.push({ geo:md.geometry, m:new THREE.Matrix4().copy(N).multiply(md.matrixWorld) });
    });

    const v=new THREE.Vector3(), nm=new THREE.Matrix3();
    for(const bin of bins.values()){
      // Склейка ИНДЕКСИРОВАННАЯ. Де-индексировать было проще, но у моделей из GLB
      // вершины переиспользуются: у илососа это 229 тыс. вершин против 1.37 млн
      // после разбора треугольников — +22 МБ буферов на телефоне на ровном месте.
      let nv=0, ni=0;
      for(const it of bin.items){
        nv+=it.geo.attributes.position.count;
        ni+=it.geo.index? it.geo.index.count : it.geo.attributes.position.count;
      }
      const pos=new Float32Array(nv*3), nrm=new Float32Array(nv*3);
      const idx=(nv>65535)? new Uint32Array(ni) : new Uint16Array(ni);
      let o=0, io_=0, base=0;
      for(const it of bin.items){
        const g=it.geo, P=g.attributes.position.array, NR=g.attributes.normal.array;
        nm.getNormalMatrix(it.m);
        for(let i=0;i<P.length;i+=3){
          v.set(P[i],P[i+1],P[i+2]).applyMatrix4(it.m);
          pos[o]=v.x; pos[o+1]=v.y; pos[o+2]=v.z;
          v.set(NR[i],NR[i+1],NR[i+2]).applyMatrix3(nm).normalize();
          nrm[o]=v.x; nrm[o+1]=v.y; nrm[o+2]=v.z; o+=3;
        }
        const cnt=g.attributes.position.count;
        if(g.index){ const I=g.index.array; for(let i=0;i<I.length;i++) idx[io_++]=base+I[i]; }
        else { for(let i=0;i<cnt;i++) idx[io_++]=base+i; }
        base+=cnt;
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(pos,3));
      g.setAttribute('normal',new THREE.BufferAttribute(nrm,3));
      g.setIndex(new THREE.BufferAttribute(idx,1));
      g.computeBoundingSphere();   // нужен лучу калибровки
      g.userData.merged=true;
      const m=new THREE.Mesh(g,this.matShell);
      m.matrixAutoUpdate=false; m.matrix.identity(); m.matrixWorldNeedsUpdate=true;
      m.frustumCulled=false; m.renderOrder=0;
      this.shellGroup.add(m);
      // base — единичная: базовые матрицы уже запечены в вершины, снаружи
      // остаётся только сдвиг разлёта (updateShellExplode)
      this.shellMeshes.push({m, base:new THREE.Matrix4(), dir:bin.dir});
    }
    this.pivot.add(this.shellGroup);
    this._shellEx=0;
  }
  // сдвиг оболочки (и её контура) по вектору разлёта каждой детали в нормализованном
  // пространстве — тем же, что aExplode у каркаса; вызывается из animate.
  updateShellExplode(ex){
    if(!this.shellMeshes || this._shellEx===ex) return;
    this._shellEx=ex; const T=this.THREE, t=new T.Matrix4();
    for(const s of this.shellMeshes){
      t.makeTranslation(s.dir[0]*ex, s.dir[1]*ex, s.dir[2]*ex);
      s.m.matrix.copy(t).multiply(s.base); s.m.matrixWorldNeedsUpdate=true;
    }
  }

  // only — набор систем, из которых строить рёбра (остальные пропускаем).
  // Внутренний («горячий») каркас раньше строился по ВСЕЙ модели, а шейдер
  // fShaderInner первой же строкой делает `if(vHot<0.5) discard` — то есть мы
  // гоняли через вершинный конвейер десятки и сотни тысяч вершин, чтобы тут же
  // их выбросить, и держали под них третий полный буфер. Картинка от фильтра
  // не меняется ни на пиксель (проверено попиксельно), зато у 9-этажки внутренний
  // каркас 63052 → 6132 вершины, и третий проход EdgesGeometry при загрузке
  // идёт только по стоякам.
  buildEdgeGeo(THREE, angle, dirs, accum, only){
    const {center,minY,scl}=this.norm;
    const pos=[], mats=[];
    const v=new THREE.Vector3();
    this.meshData.forEach(md=>{
      if(only && !only.has(this.matToPart(md.mat))) return;
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
    const hotGeo=(this.hotSet&&this.hotSet.size)? this.buildEdgeGeo(THREE, hotAngle, dirs, null, this.hotSet) : denseGeo;
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
    if(this.swarmOn) this.buildParticles(THREE);      // голо-рой (36-particles): лениво, живёт между пересборками рёбер
    this.buildTunePanel();                            // ползунки «⚙ Вид» — тоже живут в labelBox
    this.progress=0; this.uniforms.uProgress.value=0; this.startTime=performance.now();
  }
