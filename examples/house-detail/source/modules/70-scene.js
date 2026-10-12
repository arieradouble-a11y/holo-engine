  addGround(THREE){
    const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d');
    const g=x.createRadialGradient(128,128,4,128,128,128);
    g.addColorStop(0,'rgba(70,210,255,0.5)'); g.addColorStop(0.4,'rgba(45,170,225,0.16)'); g.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=g; x.fillRect(0,0,256,256);
    const tex=new THREE.CanvasTexture(c);
    // ПЬЕДЕСТАЛ — САМ ПО СЕБЕ ИСТОЧНИК СВЕТА, А НЕ ОТРАЖЕНИЕ. Это аддитивный
    // радиальный градиент под моделью; замер 22.08.2026 показал, что именно он
    // даёт почти половину свечения в нижней трети кадра (у котельной ореол там
    // 8.14% → 4.34% при его выключении), тогда как ЗЕРКАЛЬНОЕ отражение каркаса
    // (uRefl) не даёт вообще ничего. Селективный блум убрал ореол ВОКРУГ модели,
    // но лужу под ней не трогал — отсюда «блум так и не ушёл».
    const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      opacity: this.CONFIG.ground!=null?this.CONFIG.ground:0.15});
    const r=this.norm.height*1.4;
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(r,r),mat);
    plane.rotation.x=-Math.PI/2; plane.position.y=-0.04; this.groundPlane=plane; this.pivot.add(plane);
  }

  buildLabels(){
    if(!this.labelBox) return;
    this.labelBox.innerHTML='';
    if(this.wholeMode){ this.labelEls=[]; return; }
    this.labelEls=this.PARTDEF.map((p,i)=>{
      const line=document.createElement('div');
      line.style.cssText='position:absolute;height:1px;transform-origin:left center;background:linear-gradient(to right, rgba(56,232,255,0.7), rgba(56,232,255,0.15));pointer-events:none;opacity:0;transition:opacity .2s;';
      const dot=document.createElement('div');
      dot.style.cssText='position:absolute;width:7px;height:7px;border-radius:50%;background:#38e8ff;box-shadow:0 0 10px #38e8ff;transform:translate(-50%,-50%);pointer-events:none;opacity:0;transition:opacity .2s;';
      const box=document.createElement('div');
      box.style.cssText="position:absolute;transform:translateY(-50%);white-space:nowrap;font:600 12px 'IBM Plex Mono',monospace;color:#eafaff;background:rgba(4,16,26,0.8);border:1px solid rgba(56,232,255,0.4);border-radius:7px;padding:4px 9px;pointer-events:none;opacity:0;transition:opacity .2s;backdrop-filter:blur(4px);";
      box.textContent=String(i+1).padStart(2,'0')+'  '+p.name;
      this.labelBox.appendChild(line); this.labelBox.appendChild(dot); this.labelBox.appendChild(box);
      return {line,dot,box};
    });
  }

  bgTexture(THREE){
    const c=document.createElement('canvas'); c.width=c.height=512; const x=c.getContext('2d');
    const g=x.createRadialGradient(256,360,40,256,300,420);
    g.addColorStop(0,'#0b2433'); g.addColorStop(0.45,'#06141f'); g.addColorStop(1,'#02060d');
    x.fillStyle=g; x.fillRect(0,0,512,512);
    const t=new THREE.CanvasTexture(c); if('colorSpace' in t && THREE.SRGBColorSpace){ t.colorSpace=THREE.SRGBColorSpace; } else { t.encoding=THREE.sRGBEncoding; } return t;
  }

  // ---- actions ----
  selectPart=(i)=>{ if(this.wholeMode) return; const n=(this.selectedPart===i)?-1:i; this.selectedPart=n; this.selMarker=-1; this.setState({selected:n, selMarker:-1});
    const H=this.norm.height;
    if(n>=0){ const c=this.partCents[n]; const d=this.partDirs[n]; const e=this.explode; const cy=H*0.5;
      this.tgtGoal={x:(c[0]+d[0]*e)*0.6, y:cy+((c[1]+d[1]*e)-cy)*0.6, z:(c[2]+d[2]*e)*0.6}; this.distTarget=Math.max(8, H*2.1); }
    else { this.tgtGoal={x:0,y:H*0.5,z:0}; this.distTarget=Math.max(8.5,H*2.4); }
    this.lastInteract=performance.now(); };
  toggleExplode=()=>{
    if(this.wholeMode) return;
    if(this.CONFIG.floorStudy&&(this.state.plan||this.state.cut)){
      this.setState({plan:false,cut:false}); this.uniforms.uCut.value=0; this.applyPlan();
    }
    const ex=!this.state.exploded; this.explodeTarget=ex?1:0;
    if(ex){ this.selectedPart=-1; this.tgtGoal={x:0,y:this.norm.height*0.5,z:0}; this.distTarget=Math.max(13,this.norm.height*3.4); this.setState({exploded:true,selected:-1}); }
    else { this.tgtGoal={x:0,y:this.norm.height*0.5,z:0}; this.distTarget=Math.max(8.5,this.norm.height*2.4); this.setState({exploded:false}); }
    this.lastInteract=performance.now();
  };
  resetView=()=>{ this.azTarget=this.azHome!=null?this.azHome:0.6; this.elTarget=this.elHome!=null?this.elHome:0.42; this.fovTarget=42; this.explodeTarget=0; this.selectedPart=-1; this.tgtGoal={x:0,y:this.norm.height*0.5,z:0}; this.distTarget=Math.max(8.5,this.norm.height*2.4); this.setState({exploded:false,selected:-1}); this.lastInteract=performance.now(); };
  toggleSpin=()=>{ this.setState({spin:!this.state.spin}); this.lastInteract=performance.now(); };
  setDensity=(d)=>{ if(d===this.state.density) return; this.setState({density:d}); this.buildEdges(this.THREE,this.angleFor(d)); this.lastInteract=performance.now(); };
  setHover=(i)=>{ this.hovered=i; };

  onResize=()=>{ if(!this.renderer||!this.canvas) return;
    const w=this.canvas.clientWidth||window.innerWidth, h=this.canvas.clientHeight||window.innerHeight;
    const pr=Math.min(window.devicePixelRatio||1,2);
    this.renderer.setPixelRatio(pr); this.renderer.setSize(w,h,false);
    this.camera.aspect=w/h; this.camera.updateProjectionMatrix();
    // ⚠ Блуму размер НЕ задаём вручную. EffectComposer.setSize сам зовёт
    // pass.setSize(w*pixelRatio, h*pixelRatio) у всех пассов, а строка
    // `this.bloom.setSize(w,h)` шла ПОСЛЕ и перетирала это размером БЕЗ
    // плотности пикселей: на экране с dpr 1.5-2 мип-цепочка блума оказывалась
    // в 1.5-2 раза мельче кадра, и свечение размазывалось во столько же раз
    // шире задуманного. На dpr 1 (моя машина) разницы нет вовсе — отсюда
    // «у меня нормально, а на проде блума многовато».
    if(this.composer){ this.composer.setPixelRatio(pr); this.composer.setSize(w,h); }
    if(this.bloomComposer){ this.bloomComposer.setPixelRatio(pr); this.bloomComposer.setSize(w,h); }
    if(this.geoRT){ this.geoRT.setSize(Math.floor(w*pr),Math.floor(h*pr)); this.outUniforms.uRes.value.set(Math.floor(w*pr),Math.floor(h*pr)); }
    this.hmShift();   // сдвиг кадра из-под нижнего листа (телефон)
  };

  attachPointer(){
    const c=this.canvas;
    // Щипок двумя пальцами = масштаб: на телефоне события wheel не бывает, и без
    // этого модель нельзя было ни приблизить, ни отдалить вовсе.
    const pts=new Map();
    const pinchDist=()=>{ const a=[...pts.values()]; return Math.hypot(a[0].x-a[1].x, a[0].y-a[1].y); };
    const drop=e=>{ pts.delete(e.pointerId); if(pts.size<2) this._pinch=0; };
    c.addEventListener('pointerdown',e=>{ pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pts.size===2){ this._pinch=pinchDist(); this.dragging=false; } });
    c.addEventListener('pointerup',drop); c.addEventListener('pointercancel',drop); c.addEventListener('pointerleave',drop);
    c.addEventListener('pointermove',e=>{
      if(!pts.has(e.pointerId)) return;
      pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pts.size<2 || !this._pinch) return;
      const d=pinchDist(); if(d>4){ this.distTarget=Math.max(4,Math.min(30,this.distTarget*this._pinch/d)); this._pinch=d; }
      this.dragging=false; this.lastInteract=performance.now();
    });
    c.addEventListener('pointerdown',e=>{ if(pts.size>1) return; this.dragging=true; this.lastX=e.clientX; this.lastY=e.clientY; this.moved=0; this.lastInteract=performance.now(); c.style.cursor='grabbing'; try{c.setPointerCapture(e.pointerId);}catch(_){} });
    c.addEventListener('pointermove',e=>{ const r=c.getBoundingClientRect(); this.mouseNDC.x=((e.clientX-r.left)/r.width)*2-1; this.mouseNDC.y=-((e.clientY-r.top)/r.height)*2+1; this.pointerScreen={x:e.clientX-r.left,y:e.clientY-r.top};
      if(this.dragging && pts.size<2){ const dx=e.clientX-this.lastX, dy=e.clientY-this.lastY; this.moved+=Math.abs(dx)+Math.abs(dy); this.lastX=e.clientX; this.lastY=e.clientY; this.azTarget+=dx*0.008; this.elTarget=Math.max(0.08,Math.min(1.4,this.elTarget+dy*0.006)); this.lastInteract=performance.now(); } });
    // one-shot pick on click (continuous hover-raycast is too costly for a dense model)
    const up=()=>{
      const clicked=this.dragging&&this.moved<6;
      // calibration: print fractional bbox coords of the clicked surface point for marker authoring
      if(clicked && this.state.calib && this.shellGroup){
        this.raycaster.setFromCamera(this.mouseNDC,this.camera);
        const hit=this.raycaster.intersectObjects(this.shellGroup.children,true);
        if(hit.length){
          const THREE=this.THREE; let nrm=null;
          if(hit[0].face){ nrm=hit[0].face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit[0].object.matrixWorld)).normalize(); }
          this.reportCalib(hit[0].point, nrm);
        }
      } else if(clicked && !this.wholeMode && this.explode<0.06 && this.lines && this.progress>0.8){
        this.raycaster.setFromCamera(this.mouseNDC,this.camera); const hit=this.raycaster.intersectObject(this.lines);
        if(hit.length){ const idx=hit[0].index; if(idx!=null){ const pi=this.geometry.attributes.aPart.array[idx]|0; this.selectPart(pi); } }
      }
      this.dragging=false; c.style.cursor='grab';
    };
    c.addEventListener('pointerup',up); c.addEventListener('pointercancel',()=>{this.dragging=false;});
    c.addEventListener('pointerenter',()=>{ this.hovering=true; });
    c.addEventListener('pointerleave',()=>{ this.hovering=false; this.dragging=false; c.style.cursor='grab'; });
    c.addEventListener('wheel',e=>{ e.preventDefault(); this.distTarget=Math.max(4,Math.min(30,this.distTarget*(1+Math.sign(e.deltaY)*0.08))); this.lastInteract=performance.now(); },{passive:false});
  }

  animate=()=>{
    if(this.stopped) return; requestAnimationFrame(this.animate);
    // ПАУЗА РЕНДЕРА. Сцена рисует непрерывно, и когда бандл открыт в iframe
    // (каталог), даже одна фоновая голограмма забирает почти весь кадровый
    // бюджет страницы-хозяина: 166 fps → 20 fps на списке объектов. Рисуем
    // только когда вкладка видима И нас не усыпил родитель через postMessage.
    if(document.hidden || this.paused) return;
    this.frame++;
    const t=performance.now()*0.001; this.uniforms.uTime.value=t;
    // авто-вращение только по кнопке «↻ Вращение» (state.spin)
    if(this.state.spin && !this.dragging && this.selectedPart<0 && !this.state.plan && !this.state.cut) this.azTarget+=0.0028;
    this.az+=(this.azTarget-this.az)*0.08; this.el+=(this.elTarget-this.el)*0.08;
    this.dist+=(this.distTarget-this.dist)*0.08;
    if(this.fovTarget!=null && Math.abs(this.camera.fov-this.fovTarget)>0.01){ this.camera.fov+=(this.fovTarget-this.camera.fov)*0.1; this.camera.updateProjectionMatrix(); }
    this.explode+=(this.explodeTarget-this.explode)*0.09;
    this.progress=Math.min(1,(performance.now()-(this.startTime||performance.now()))/850);
    this.tgt.x+=(this.tgtGoal.x-this.tgt.x)*0.1; this.tgt.y+=(this.tgtGoal.y-this.tgt.y)*0.1; this.tgt.z+=(this.tgtGoal.z-this.tgt.z)*0.1;
    // реакция на курсор: лёгкий параллакс камеры + подсветка контуров при наведении
    const px = (this.hovering && !this.dragging && !this.state.plan && !this.state.cut) ? 1 : 0;
    const pxAz = px ? this.mouseNDC.x*0.13 : 0, pxEl = px ? -this.mouseNDC.y*0.05 : 0;
    this.parallaxAz=(this.parallaxAz||0)+(pxAz-(this.parallaxAz||0))*0.07;
    this.parallaxEl=(this.parallaxEl||0)+(pxEl-(this.parallaxEl||0))*0.07;
    this.uHoverV=(this.uHoverV||0)+((px?1:0)-(this.uHoverV||0))*0.08;
    if(this.outUniforms) this.outUniforms.uHover.value=this.uHoverV;
    this._viewAz=this.az+this.parallaxAz;
    if(this.pivot) this.pivot.rotation.y=this._viewAz;
    this.uniforms.uExplode.value=this.explode;
    this.updateShellExplode(this.explode);   // оболочка+контур едут вместе с каркасом
    this.uniforms.uProgress.value=this.progress;
    this.uniforms.uSelected.value=this.selectedPart;
    const span=this.scanMax-this.scanMin; this.uniforms.uScan.value=this.scanMin+((t*0.3)%1)*span;

    const cam=this.camera, T=this.tgt, el=this.el+(this.parallaxEl||0);
    cam.position.set(T.x, T.y+Math.sin(el)*this.dist, T.z+Math.cos(el)*this.dist);
    cam.lookAt(T.x,T.y,T.z);

    this.updateLabels(cam);
    this.updateMarkers(cam);
    this.updateRoomLabels(cam);
    this.updateFlows(t);
    this.renderFrame();
    this.renderOutline();
  };

  updateLabels(cam){
    if(!this.labelEls||!this.labelEls.length) return;
    const THREE=this.THREE, w=this.canvas.clientWidth, h=this.canvas.clientHeight;
    const v=new THREE.Vector3();
    const showAll=this.explode>0.12;
    const study=!!this.CONFIG.floorStudy,focus=this.hovered>=0?this.hovered:this.selectedPart;
    this.PARTDEF.forEach((p,i)=>{
      const L=this.labelEls[i]; if(!L) return;
      const vis = study ? (!this.state.plan&&i===focus) : (showAll || this.selectedPart===i || this.hovered===i);
      if(!vis){ L.line.style.opacity='0'; L.dot.style.opacity='0'; L.box.style.opacity='0'; return; }
      const c=this.partCents[i], d=this.partDirs[i], e=this.explode;
      v.set(c[0]+d[0]*e,c[1]+d[1]*e,c[2]+d[2]*e);
      v.applyAxisAngle(new THREE.Vector3(0,1,0), this._viewAz!=null?this._viewAz:this.az);
      v.project(cam);
      if(v.z>1){ L.line.style.opacity='0'; L.dot.style.opacity='0'; L.box.style.opacity='0'; return; }
      const sx=(v.x*0.5+0.5)*w, sy=(-v.y*0.5+0.5)*h;
      const side = sx>w*0.5 ? 1 : -1;
      const len=46, lx=sx+side*len, ly=sy- (i%2?22:-22);
      L.dot.style.left=sx+'px'; L.dot.style.top=sy+'px'; L.dot.style.opacity='1';
      const ang=Math.atan2(ly-sy, lx-sx)*180/Math.PI, dl=Math.hypot(lx-sx,ly-sy);
      L.line.style.left=sx+'px'; L.line.style.top=sy+'px'; L.line.style.width=dl+'px'; L.line.style.transform='rotate('+ang+'deg)'; L.line.style.opacity='0.9';
      L.box.style.left=(lx+side*6)+'px'; L.box.style.top=ly+'px'; L.box.style.transform=side<0?'translate(-100%,-50%)':'translateY(-50%)'; L.box.style.opacity='1';
      if(study){
        const cr=this.canvas.getBoundingClientRect();
        const rect=sel=>{const e=document.querySelector(sel);return e&&e.getClientRects().length?e.getBoundingClientRect():null;};
        let left=12,right=w-12,top=40,bottom=h-70;
        if(this.hmOn){
          const tab=document.documentElement.dataset.hm||'',sheet=tab?rect(tab==='view'?'[style*="--hm-tools"]':'aside'):null;
          bottom=sheet?sheet.top-cr.top-12:h-this.HM_BAR-12;
        }else{
          const head=rect('[style*="--hm-head"]'),aside=rect('aside');
          if(head)left=Math.max(left,head.right-cr.left+12);
          if(aside)right=Math.min(right,aside.left-cr.left-12);
        }
        L.box.style.boxSizing='border-box';L.box.style.maxWidth=Math.max(40,right-left)+'px';
        L.box.style.overflow='hidden';L.box.style.textOverflow='ellipsis';
        const bw=L.box.offsetWidth,bh=L.box.offsetHeight;
        const bx=Math.max(left,Math.min(right-bw,side<0?lx-6-bw:lx+6));
        const by=Math.max(top,Math.min(bottom-bh,ly-bh/2));
        L.box.style.left=bx+'px';L.box.style.top=by+'px';L.box.style.transform='none';
        const endX=Math.max(bx,Math.min(bx+bw,sx)),endY=Math.max(by,Math.min(by+bh,sy));
        L.line.style.width=Math.hypot(endX-sx,endY-sy)+'px';
        L.line.style.transform='rotate('+(Math.atan2(endY-sy,endX-sx)*180/Math.PI)+'deg)';
      }
      const seld=this.selectedPart===i;
      L.box.style.borderColor=seld?'rgba(238,255,255,0.95)':'rgba(56,232,255,0.4)';
      L.box.style.boxShadow=seld?'0 0 10px rgba(210,250,255,0.55)':'none';
    });
  }
