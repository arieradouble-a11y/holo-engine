  // ---- floor-plan mode (top-down, single floor isolated) -------------------
  get planMode(){ return !!(this.CONFIG.building) && (this.planRooms&&this.planRooms.length>0); }
  buildRoomLabels(){
    if(!this.labelBox || !this.planRooms || !this.planRooms.length) return;
    this.roomEls=this.planRooms.map(r=>{
      const el=document.createElement('div');
      el.style.cssText="position:absolute;transform:translate(-50%,-50%);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s;z-index:9;"+
        (r.apt? "font:700 12px 'IBM Plex Mono',monospace;color:#04141f;background:rgba(56,232,255,0.92);border-radius:6px;padding:2px 7px;box-shadow:0 0 8px rgba(56,232,255,0.5);"
              : "font:500 10px 'IBM Plex Sans',sans-serif;color:#cdeefc;");
      el.textContent=r.name;
      this.labelBox.appendChild(el); return el;
    });
  }
  updateRoomLabels(cam){
    if(!this.roomEls) return;
    const on=this.state.plan, THREE=this.THREE;
    if(!on){ this.roomEls.forEach(e=>e.style.opacity='0'); return; }
    const w=this.canvas.clientWidth, h=this.canvas.clientHeight, {center,minY,scl}=this.norm;
    const yM=(this.state.planFloor*this.planFloorH + this.planFloorH*0.5);
    const ny=(yM-minY)*scl, v=new THREE.Vector3(), Y=new THREE.Vector3(0,1,0);
    this.planRooms.forEach((r,i)=>{
      const e=this.roomEls[i]; if(!e) return;
      v.set((r.x-center.x)*scl, ny, (r.z-center.z)*scl).applyAxisAngle(Y,this._viewAz!=null?this._viewAz:this.az).project(cam);
      if(v.z>1){ e.style.opacity='0'; return; }
      e.style.left=((v.x*0.5+0.5)*w)+'px'; e.style.top=((-v.y*0.5+0.5)*h)+'px'; e.style.opacity= r.apt?'1':'0.9';
    });
  }
  applyPlan(){
    const on=this.state.plan;
    this.uniforms.uPlan.value=on?1:0;
    if(on) this.uniforms.uCut.value=0;   // plan and cutaway are mutually exclusive
    // hide filled/мешающие слои в плане: оболочка перекрывает вид сверху, отражение
    // и «пол» только мешают. Остаётся чистый каркас перегородок.
    if(this.shellGroup) this.shellGroup.visible=!on;
    if(this.reflect) this.reflect.visible=!on;
    if(this.groundPlane) this.groundPlane.visible=!on;
    const {minY,scl}=this.norm, fh=this.planFloorH;
    const yM=(this.state.planFloor*fh + fh*0.5);
    this.uniforms.uPlanY.value=(yM-minY)*scl;
    this.uniforms.uPlanH.value=fh*0.5*scl;
    if(on){
      // near-ortho top-down (narrow fov from far), eased in cinematically. el just shy
      // of vertical (86°) keeps up=+Y (no gimbal/roll), so the whole move — az→0, tilt
      // to top, fov→10, dolly — glides smoothly into a clean floor plan.
      this.fovTarget=10;
      this.elTarget=1.50; const b=this.CONFIG.building||{};
      const sw=(b.sectionWidth||21), sections=(b.sections||3), center=this.norm.center;
      const vt=Math.tan(10*Math.PI/360), asp=this.camera.aspect||1.6;
      const nW=sw*scl, nD=(b.depth||12)*scl;
      // План разворачиваем ДЛИННОЙ стороной секции по горизонтали: у узкой секции
      // (7 м при глубине 12) кадр диктует глубина, и на экран влезал весь дом —
      // план переставал быть планом секции. Поворот на 90° даёт секции весь кадр.
      const turn = nW < nD*0.85;
      this.azTarget = turn ? Math.PI/2 : 0;
      const fitX = turn ? nD : nW, fitZ = turn ? nW : nD;
      // Панель «Системы и узлы» лежит ПОВЕРХ канваса справа, поэтому вписываем
      // секцию в СВОБОДНУЮ часть кадра и сдвигаем цель — иначе половина плана
      // уезжает под панель, а по центру экрана остаётся пустое место.
      const cw=this.canvas.clientWidth||1600, ch=this.canvas.clientHeight||900;
      const aEl=document.querySelector('aside');
      const aw=(aEl&&aEl.offsetWidth)?aEl.offsetWidth+48:0;
      const freeW=Math.max(cw*0.45, cw-aw), aspFree=freeW/ch;
      this.distTarget=Math.max((fitX*0.5)/(vt*aspFree), (fitZ*0.5)/vt)*1.18;
      // Кадрируем ИМЕННО типовую блок-секцию — ту, для которой построены подписи
      // комнат (labelSec в 10-generators.js), а не центр габарита: при чётном числе
      // секций это разные точки. Цель камеры — в МИРОВЫХ координатах, а модель
      // крутит pivot.rotation.y, поэтому точку доворачиваем на тот же угол.
      const secX=-(sections*sw)/2 + (Math.floor(sections/2)+0.5)*sw;
      const px=(secX-center.x)*scl, pz=(0-center.z)*scl, ca=Math.cos(this.azTarget), sa=Math.sin(this.azTarget);
      const dx=((cw-freeW)/2)/(cw/2)*(this.distTarget*vt*asp);   // увести модель из-под панели
      this.tgtGoal={x:px*ca+pz*sa+dx, y:(yM-minY)*scl, z:-px*sa+pz*ca};
      // соседние секции гасим маской по X: у узкой секции (7 м) кадр всё равно
      // диктует глубина дома, и в него влезает весь дом — план переставал быть
      // планом секции и читался мешаниной стен
      this.uniforms.uPlanX.value=(secX-center.x)*scl;
      // ровно полуширина секции: соседняя начинается сразу за ней, и при большем
      // радиусе её ближняя половина оставалась яркой
      this.uniforms.uPlanW.value=nW*0.5;
      this.explodeTarget=0;
    } else { this.fovTarget=42; this.resetView(); }
    this.lastInteract=performance.now();
  }
  // ---- facade cutaway ("dollhouse": front wall removed, rooms in 3D) -------
  applyCut(){
    const on=this.state.cut, {center,scl}=this.norm, b=this.CONFIG.building||{};
    if(this.cutZ==null){ const frontN=((b.depth||12)/2 - center.z)*scl; this.cutZ=frontN*0.18; } // peel ~front 40%
    // entering cut implies plan off — clear any plan camera/uniform state
    this.uniforms.uPlan.value=0; this.camera.up.set(0,1,0); this.fovTarget=42;
    this.uniforms.uCut.value=on?1:0; this.uniforms.uCutZ.value=this.cutZ;
    if(this.shellGroup) this.shellGroup.visible=!on;   // оболочка мешает заглянуть внутрь
    if(this.reflect) this.reflect.visible=!on;
    if(on){
      this.azTarget=0.32; this.elTarget=0.55; this.explodeTarget=0; this.selectedPart=-1;
      this.distTarget=Math.max(8.5, this.norm.height*2.3);
      this.tgtGoal={x:0,y:this.norm.height*0.5,z:0};
    } else { this.resetView(); }
    this.lastInteract=performance.now();
  }
  toggleCut=()=>{ const c=!this.state.cut; this.selectedPart=-1; this.selMarker=-1; this.setState({cut:c, plan:false, selected:-1, selMarker:-1, exploded:false}); this.applyCut(); };
  cutStep=(d)=>{ if(!this.state.cut) return; const {center,scl}=this.norm, b=this.CONFIG.building||{}; const frontN=((b.depth||12)/2 - center.z)*scl;
    this.cutZ=Math.max(-frontN*0.7, Math.min(frontN*0.95, (this.cutZ||0)+d*frontN*0.18)); this.uniforms.uCutZ.value=this.cutZ; this.lastInteract=performance.now(); };

  togglePlan=()=>{ const p=!this.state.plan; this.selectedPart=-1; this.selMarker=-1;
    const pf = (p && !this._planSeen) ? Math.min(4,(this.planFloors||9)-1) : this.state.planFloor;
    if(p) this._planSeen=true;
    this.setState({plan:p, planFloor:pf, selected:-1, selMarker:-1, exploded:false, cut:false}); this.applyPlan(); };
  planStep=(d)=>{ if(!this.state.plan) return; const n=this.planFloors||9; let f=this.state.planFloor+d; if(f<0)f=0; if(f>=n)f=n-1; this.setState({planFloor:f}); this.applyPlan(); };
