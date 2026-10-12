  // ---- голо-рой: живое облако частиц по поверхности модели -------------------
  // Позиция каждой частицы = функция (цель, время, seed) — подход Casberry:
  // сборка из сферического разлёта (uProgress), curl-дрейф вдоль поверхности,
  // «дыхание» по нормали, мерцание + скан-полоса. Цели сэмплируются по площади
  // треугольников meshData в нормализованном пространстве; aPart/aHot наследуют
  // разбивку систем — рой сам красит «горячие» узлы янтарным и реагирует на
  // выбор системы, разборку, план этажа и разрез фасада (общие uniforms).
  // CONFIG.particles: { on, count, intensity, swirl, breath, size } | false.
  get swarmOn(){
    const p=this.CONFIG.particles;
    return this.state.swarm!=null ? !!this.state.swarm : !!(p&&p.on);
  }
  // ключи читаются и плоско (particlesSwirl — так их экспортирует «⧉ в конфиг»),
  // и вложенно (particles.swirl)
  pCfg(k,dflt){
    const flat=this.CONFIG['particles'+k[0].toUpperCase()+k.slice(1)];
    if(flat!=null) return flat;
    const p=this.CONFIG.particles;
    return (p&&typeof p==='object'&&p[k]!=null)?p[k]:dflt;
  }
  ensureSwarmU(){
    if(this.swarmU) return this.swarmU;
    const U=this.uniforms;
    this.swarmU={
      uTime:U.uTime, uProgress:U.uProgress, uExplode:U.uExplode, uSelected:U.uSelected,
      uScan:U.uScan, uPlan:U.uPlan, uPlanY:U.uPlanY, uPlanH:U.uPlanH, uCut:U.uCut, uCutZ:U.uCutZ,
      uColor:U.uColor, uColor2:U.uColor2,
      uSwirl:{value:this.pCfg('swirl',0.42)}, uBreath:{value:this.pCfg('breath',0.35)},
      uPAmt:{value:this.pCfg('intensity',1.0)}, uSize:{value:this.pCfg('size',40)},
      uPix:{value:this.renderer?this.renderer.getPixelRatio():1},
      uAmp:{value:(this.norm&&this.norm.height)||5.5},
    };
    return this.swarmU;
  }
  get vSwarmShader(){ return `
    uniform float uTime,uExplode,uProgress,uSelected,uSwirl,uBreath,uSize,uPix,uAmp;
    attribute vec3 aNorm,aExplode; attribute float aSeed,aPart,aHot;
    varying float vSel,vSeed,vHot,vY,vMZ,vTw;
    void main(){
      vSeed=aSeed; vHot=aHot; vMZ=position.z;
      vSel=(uSelected>=0.0 && abs(aPart-uSelected)<0.5)?1.0:0.0;
      vec3 formed=position+aExplode*uExplode;
      float h1=fract(sin(aSeed*91.17)*43758.5453);
      float h2=fract(sin(aSeed*45.23+1.0)*24634.6345);
      float u=h1*2.0-1.0; float th=h2*6.2831; float s=sqrt(max(0.0,1.0-u*u));
      vec3 scat=position+vec3(cos(th)*s,u,sin(th)*s)*uAmp*0.5;
      vec3 base=mix(scat,formed,smoothstep(0.0,1.0,uProgress));
      vec3 sw=vec3(
        sin(position.y*2.3+uTime*0.8+aSeed*30.0)+0.5*sin(position.x*3.1-uTime*0.6+aSeed*11.0),
        cos(position.x*2.7-uTime*0.7+aSeed*23.0)+0.5*cos(position.z*3.3+uTime*0.5+aSeed*7.0),
        sin(position.z*2.9+uTime*0.9+aSeed*17.0)+0.5*sin(position.y*3.7-uTime*0.4+aSeed*41.0));
      float br=0.5+0.5*sin(uTime*0.9+aSeed*20.0);
      vec3 p=base+(sw*uAmp*0.008*uSwirl + aNorm*br*uAmp*0.016*uBreath)*smoothstep(0.2,1.0,uProgress);
      vY=p.y;
      vec4 mv=modelViewMatrix*vec4(p,1.0);
      gl_Position=projectionMatrix*mv;
      vTw=0.55+0.45*sin(uTime*3.4+aSeed*40.0);
      gl_PointSize=uSize*uPix*(1.0+0.9*aHot)*(0.7+0.6*vTw)/max(0.4,-mv.z);
    }`; }
  get fSwarmShader(){ return `
    uniform vec3 uColor,uColor2;
    uniform float uScan,uSelected,uProgress,uPAmt,uPlan,uPlanY,uPlanH,uCut,uCutZ;
    varying float vSel,vSeed,vHot,vY,vMZ,vTw;
    void main(){
      if(uCut>0.5 && vMZ>uCutZ) discard;   // разрез фасада — как основные пассы
      vec2 dd=gl_PointCoord-0.5; float rr=dot(dd,dd);
      if(rr>0.25) discard;                 // мягкий круглый спрайт
      float core=smoothstep(0.25,0.0,rr);
      float halo=smoothstep(0.25,0.02,rr)*0.5;
      float band=smoothstep(0.35,0.0,abs(vY-uScan));
      float sel = uSelected<0.0 ? 1.0 : (vSel>0.5?1.9:0.15);
      vec3 col=mix(uColor,uColor2*1.15,vHot);
      col=mix(col, vec3(0.94,1.0,1.0), vSel*0.85);
      col*=1.0+band*0.8+vHot*0.5+vSel*1.4;
      float a=(core*0.9+halo)*(0.30+0.70*vTw)*sel*uPAmt*smoothstep(0.0,1.0,uProgress);
      a*=mix(0.55,1.0,vHot)*(1.0+band*0.5);
      if(uPlan>0.5) a*=1.0-smoothstep(uPlanH,uPlanH*2.0,abs(vY-uPlanY));
      gl_FragColor=vec4(col,a);
    }`; }
  buildParticles(THREE){
    if(this.swarm){ this.swarm.visible=this.swarmOn; return; }
    if(!this.meshData || !this.meshData.length || !this.norm) return;
    const {center,minY,scl}=this.norm;
    // 1) все треугольники -> нормализованное пространство + индекс системы.
    //    Точный преаллок: считаем треугольники заранее (сканы бывают по 350k).
    let nT=0;
    this.meshData.forEach(md=>{ const g=md.geometry; nT+=((g.index?g.index.count:g.attributes.position.count)/3)|0; });
    const T=new Float32Array(nT*13), cum=new Float64Array(nT);
    const A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3(),
          AB=new THREE.Vector3(),AC=new THREE.Vector3(),Nv=new THREE.Vector3();
    let w=0, areaTot=0;
    this.meshData.forEach(md=>{
      const g=md.geometry, pos=g.attributes.position, idx=g.index?g.index.array:null, m=md.matrixWorld;
      const pi=this.matToPart(md.mat);
      const cnt=((idx?idx.length:pos.count)/3)|0;
      for(let t=0;t<cnt;t++){
        const i0=idx?idx[t*3]:t*3, i1=idx?idx[t*3+1]:t*3+1, i2=idx?idx[t*3+2]:t*3+2;
        A.fromBufferAttribute(pos,i0).applyMatrix4(m);
        B.fromBufferAttribute(pos,i1).applyMatrix4(m);
        C.fromBufferAttribute(pos,i2).applyMatrix4(m);
        A.set((A.x-center.x)*scl,(A.y-minY)*scl,(A.z-center.z)*scl);
        B.set((B.x-center.x)*scl,(B.y-minY)*scl,(B.z-center.z)*scl);
        C.set((C.x-center.x)*scl,(C.y-minY)*scl,(C.z-center.z)*scl);
        AB.subVectors(B,A); AC.subVectors(C,A); Nv.crossVectors(AB,AC);
        const ar=Nv.length()*0.5;
        if(ar>1e-9){ areaTot+=ar; Nv.multiplyScalar(0.5/ar); }
        const o=w*13;
        T[o]=A.x;T[o+1]=A.y;T[o+2]=A.z; T[o+3]=AB.x;T[o+4]=AB.y;T[o+5]=AB.z;
        T[o+6]=AC.x;T[o+7]=AC.y;T[o+8]=AC.z; T[o+9]=Nv.x;T[o+10]=Nv.y;T[o+11]=Nv.z; T[o+12]=pi;
        cum[w]=areaTot; w++;
      }
    });
    if(!areaTot) return;
    // 2) равномерный сэмплинг по накопленной площади (бинарный поиск на частицу)
    const N=Math.max(1000,Math.min(120000, this.pCfg('count',45000)|0));
    const P=new Float32Array(N*3), NR=new Float32Array(N*3), EX=new Float32Array(N*3),
          SD=new Float32Array(N), PT=new Float32Array(N), HT=new Float32Array(N);
    const dirs=this.partDirs&&this.partDirs.length?this.partDirs:[[0,1,0]];
    const hotSet=this.hotSet||new Set();
    for(let k=0;k<N;k++){
      const r=Math.random()*areaTot;
      let lo=0,hi=w-1;
      while(lo<hi){ const mid=(lo+hi)>>1; if(cum[mid]<r) lo=mid+1; else hi=mid; }
      const o=lo*13;
      let u=Math.random(),v=Math.random(); if(u+v>1){u=1-u;v=1-v;}
      P[k*3]  =T[o]  +u*T[o+3]+v*T[o+6];
      P[k*3+1]=T[o+1]+u*T[o+4]+v*T[o+7];
      P[k*3+2]=T[o+2]+u*T[o+5]+v*T[o+8];
      NR[k*3]=T[o+9]; NR[k*3+1]=T[o+10]; NR[k*3+2]=T[o+11];
      const pi=T[o+12]|0;
      SD[k]=Math.random(); PT[k]=pi; HT[k]=hotSet.has(pi)?1:0;
      const d=dirs[pi]||[0,1,0]; EX[k*3]=d[0]; EX[k*3+1]=d[1]; EX[k*3+2]=d[2];
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(P,3));
    g.setAttribute('aNorm',new THREE.BufferAttribute(NR,3));
    g.setAttribute('aExplode',new THREE.BufferAttribute(EX,3));
    g.setAttribute('aSeed',new THREE.BufferAttribute(SD,1));
    g.setAttribute('aPart',new THREE.BufferAttribute(PT,1));
    g.setAttribute('aHot',new THREE.BufferAttribute(HT,1));
    g.computeBoundingSphere();
    const mat=new THREE.ShaderMaterial({uniforms:this.ensureSwarmU(),
      vertexShader:this.vSwarmShader, fragmentShader:this.fSwarmShader,
      transparent:true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending});
    this.swarm=new THREE.Points(g,mat);
    this.swarm.renderOrder=4;        // между контуром (3) и горячим пассом (5)
    this.swarm.frustumCulled=false;  // разлёт/дрейф выходят за bounding sphere
    this.swarm.visible=this.swarmOn;
    this.pivot.add(this.swarm);
  }
  toggleSwarm=()=>{
    const on=!this.swarmOn;
    if(on && !this.swarm && this.THREE) this.buildParticles(this.THREE);
    if(this.swarm) this.swarm.visible=on;
    this.setState({swarm:on}); this.lastInteract=performance.now();
  };
