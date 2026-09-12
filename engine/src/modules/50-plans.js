  // ---- floor-plan mode (top-down, single floor isolated) -------------------
  get planMode(){ return !!(this.CONFIG.building) && (this.planRooms&&this.planRooms.length>0); }
  get planRange(){ return (this.CONFIG.floorStudy&&this.CONFIG.floorStudy.planFloorRange)||[0,(this.planFloors||9)-1]; }
  planLevel(f=this.state.planFloor){
    const levels=this.CONFIG.floorStudy&&this.CONFIG.floorStudy.floorLevels;
    const low=levels?levels[f]:f*this.planFloorH, high=levels?levels[f+1]:(f+1)*this.planFloorH;
    return {low,high,mid:(low+high)/2,height:high-low};
  }
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
    if(this.CONFIG.floorStudy){
      if(on){ this._studyViewFrameKey=null; this.fitFloorStudyPlan(); }
      else this.fitFloorStudyView();
    }
    if(!on){ this.roomEls.forEach(e=>e.style.opacity='0'); return; }
    const w=this.canvas.clientWidth, h=this.canvas.clientHeight, {center,minY,scl}=this.norm;
    const yM=this.planLevel().mid;
    const ny=(yM-minY)*scl, v=new THREE.Vector3(), Y=new THREE.Vector3(0,1,0);
    this.planRooms.forEach((r,i)=>{
      const e=this.roomEls[i]; if(!e) return;
      const bounds=this.CONFIG.floorStudy&&this.CONFIG.floorStudy.planBounds;
      if(bounds&&(Math.abs(r.x-bounds.x)>bounds.width/2||Math.abs(r.z-bounds.z)>bounds.depth/2)){e.style.opacity='0';return;}
      v.set((r.x-center.x)*scl, ny, (r.z-center.z)*scl).applyAxisAngle(Y,this._viewAz!=null?this._viewAz:this.az).project(cam);
      if(v.z>1){ e.style.opacity='0'; return; }
      e.style.left=((v.x*0.5+0.5)*w)+'px'; e.style.top=((-v.y*0.5+0.5)*h)+'px'; e.style.opacity= r.apt?'1':'0.9';
    });
  }
  // У изучаемой секции важен весь план: обе настольные колонки и телефонный
  // лист исключаются из доступного кадра. Пересчитываем только при изменении
  // размеров/вкладки, чтобы ручной масштаб не сбрасывался на каждом кадре.
  fitFloorStudyPlan(force=false){
    const c=this.canvas, b=this.CONFIG.building||{};
    if(!c||!this.state.plan) return;
    const cw=c.clientWidth, ch=c.clientHeight, phone=this.hmOn;
    if(!cw||!ch) return;
    const tab=phone?(document.documentElement.dataset.hm||''):'';
    const key=[cw,ch,phone,tab,this.state.planFloor,!!this._moreOpen,!!this._tuneOpen].join('/');
    if(!force&&this._studyPlanFrameKey===key) return;
    this._studyPlanFrameKey=key;
    const cr=c.getBoundingClientRect();
    const visibleBox=sel=>{
      const el=document.querySelector(sel);
      return el&&el.getClientRects().length?el.getBoundingClientRect():null;
    };
    let left=16, right=cw-16, top=24, bottom=ch-70, occluded=0;
    if(phone){
      const sheet=tab?visibleBox(tab==='view'?'[style*="--hm-tools"]':'aside'):null;
      occluded=this.HM_BAR+(sheet?sheet.height:0);
      top=42; bottom=ch-occluded-14;
      this.hmShift();
    }else{
      const head=visibleBox('[style*="--hm-head"]'), aside=visibleBox('aside');
      if(head) left=Math.max(left,head.right-cr.left+18);
      if(aside) right=Math.min(right,aside.left-cr.left-18);
    }
    const freeW=Math.max(96,right-left), freeH=Math.max(110,bottom-top);
    const midX=(left+right)/2, midY=(top+bottom)/2;
    const {center,minY,scl}=this.norm, bounds=this.CONFIG.floorStudy.planBounds;
    // У балкона и наружной лестницы свой вылет: кадр охватывает весь габарит,
    // а не только оси несущих стен из building.
    const nW=(bounds?bounds.width:this.norm.size.x)*scl;
    const nD=(bounds?bounds.depth:this.norm.size.z)*scl;
    // Выбираем поворот, который крупнее вписывается именно в свободную область.
    const vt=Math.tan(10*Math.PI/360);
    const fit=(w,d)=>Math.max(w*ch/(2*vt*freeW),d*ch/(2*vt*freeH));
    // У почти квадратного окна одинаково хорошо помещаются оба поворота,
    // но длинные подписи соседних комнат могут слиться в одном из них.
    // Сначала сохраняем читаемость подписей, затем выбираем больший масштаб.
    const labelCost=(turn,distance)=>{
      const pxPerM=scl*ch/(2*vt*distance*1.10);
      const rects=this.planRooms.map((r,i)=>{
        const el=this.roomEls&&this.roomEls[i];
        const x=(turn?r.z:r.x)*pxPerM, y=(turn?-r.x:r.z)*pxPerM;
        return {x,y,w:(el?el.offsetWidth:0)+3,h:(el?el.offsetHeight:0)+3};
      });
      let overlap=0;
      for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
        const a=rects[i],b=rects[j];
        const w=(a.w+b.w)/2-Math.abs(a.x-b.x),h=(a.h+b.h)/2-Math.abs(a.y-b.y);
        if(w>0&&h>0)overlap+=w*h;
      }
      return overlap;
    };
    const straightFit=fit(nW,nD),turnedFit=fit(nD,nW);
    const straightCost=labelCost(false,straightFit),turnedCost=labelCost(true,turnedFit);
    const turn=Math.abs(straightCost-turnedCost)>1?turnedCost<straightCost:turnedFit<straightFit;
    this.azTarget=turn?Math.PI/2:0; this.elTarget=1.50; this.fovTarget=10;
    this.distTarget=fit(turn?nD:nW,turn?nW:nD)*1.10;
    const ca=Math.cos(this.azTarget), sa=Math.sin(this.azTarget);
    const px=bounds?(bounds.x-center.x)*scl:0, pz=bounds?(bounds.z-center.z)*scl:0;
    const dx=(cw/2-midX)*2/ch*this.distTarget*vt;
    // hmShift уже поднимает проекцию на половину нижнего листа.
    const dz=((ch-occluded)/2-midY)*2/ch*this.distTarget*vt/Math.sin(this.elTarget);
    this.tgtGoal={x:px*ca+pz*sa+dx,y:(this.planLevel().mid-minY)*scl,z:-px*sa+pz*ca+dz};
    this.uniforms.uPlanX.value=px;
    this.uniforms.uPlanW.value=nW*0.5;
    this.uniforms.uPlanZ.value=pz;
    this.uniforms.uPlanD.value=nD*0.5;
    this.explodeTarget=0;
  }
  // Целый дом должен помещаться в свободный кадр до включения плана.
  // У старых домов остаётся прежнее кадрирование; здесь учитываем перспективу
  // восьми углов габарита и свободное место между панелями.
  fitFloorStudyView(){
    if(!this.canvas||this.state.selected>=0||this.state.spin){this._studyViewFrameKey=null;return;}
    const cw=this.canvas.clientWidth,ch=this.canvas.clientHeight,phone=this.hmOn;
    const tab=phone?(document.documentElement.dataset.hm||''):'';
    const key=[cw,ch,phone,tab,!!this.state.cut,!!this.state.exploded,!!this._moreOpen,!!this._tuneOpen].join('/');
    if(!cw||!ch||this._studyViewFrameKey===key)return;
    this._studyViewFrameKey=key;
    const cr=this.canvas.getBoundingClientRect();
    const rect=sel=>{const e=document.querySelector(sel);return e&&e.getClientRects().length?e.getBoundingClientRect():null;};
    let left=16,right=cw-16,top=36,bottom=ch-70,occluded=0;
    if(phone){
      const sheet=tab?rect(tab==='view'?'[style*="--hm-tools"]':'aside'):null;
      occluded=this.HM_BAR+(sheet?sheet.height:0);bottom=ch-occluded-16;this.hmShift();
    }else{
      const head=rect('[style*="--hm-head"]'),aside=rect('aside');
      if(head)left=Math.max(left,head.right-cr.left+18);
      if(aside)right=Math.min(right,aside.left-cr.left-18);
    }
    const freeW=Math.max(96,right-left),freeH=Math.max(110,bottom-top);
    const az=this.azTarget,el=this.elTarget,ca=Math.cos(az),sa=Math.sin(az),ce=Math.cos(el),se=Math.sin(el);
    const {size,scl,height}=this.norm,vt=Math.tan(42*Math.PI/360);
    const spread=[0,0,0],ex=this.explodeTarget||0;
    for(const dir of this.partDirs||[])for(let axis=0;axis<3;axis++)spread[axis]=Math.max(spread[axis],Math.abs(dir[axis]||0)*ex);
    let d=0;
    for(const x0 of [-size.x*scl/2-spread[0],size.x*scl/2+spread[0]])for(const y of [-height/2-spread[1],height/2+spread[1]])for(const z0 of [-size.z*scl/2-spread[2],size.z*scl/2+spread[2]]){
      const x=x0*ca+z0*sa,z=-x0*sa+z0*ca,up=ce*y-se*z,depth=se*y+ce*z;
      d=Math.max(d,depth+Math.abs(x)*ch/(vt*freeW),depth+Math.abs(up)*ch/(vt*freeH));
    }
    this.distTarget=d*1.12;
    const dx=(cw/2-(left+right)/2)*2/ch*this.distTarget*vt;
    const du=((top+bottom)/2-(ch-occluded)/2)*2/ch*this.distTarget*vt;
    this.tgtGoal={x:dx,y:height/2+du*ce,z:-du*se};
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
    const {minY,scl}=this.norm, level=this.planLevel(), fh=level.height;
    const yM=level.mid;
    this.uniforms.uPlanY.value=(yM-minY)*scl;
    this.uniforms.uPlanH.value=fh*0.5*scl;
    if(on&&this.CONFIG.floorStudy){
      this.fitFloorStudyPlan(true);
      this.lastInteract=performance.now();
      return;
    }
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
    const [min,max]=this.planRange;
    const pf = (p && !this._planSeen) ? (this.CONFIG.floorStudy?min:Math.min(4,(this.planFloors||9)-1)) : Math.max(min,Math.min(max,this.state.planFloor));
    if(p) this._planSeen=true;
    this.setState({plan:p, planFloor:pf, selected:-1, selMarker:-1, exploded:false, cut:false}); this.applyPlan(); };
  planStep=(d)=>{ if(!this.state.plan) return; const [min,max]=this.planRange; const f=Math.max(min,Math.min(max,this.state.planFloor+d)); this.setState({planFloor:f}); this.applyPlan(); };
