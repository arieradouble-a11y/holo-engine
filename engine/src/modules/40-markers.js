  // ---- numbered callout markers (educational "stand" mode) ------------------
  // Markers are 3D points authored as fractional bbox coords {at:[fx,fy,fz]},
  // so they work even on a single fused mesh that can't be segmented into parts.
  get standMode(){ return this.wholeMode && (this.CONFIG.markers||[]).length>0; }
  markerNorm(at){ const {size,scl}=this.norm; return [ (at[0]-0.5)*size.x*scl, at[1]*size.y*scl, (at[2]-0.5)*size.z*scl ]; }
  // Surface normal for a marker (model-local), used for occlusion facing. Explicit
  // config `nrm` wins; otherwise radial-from-bbox-center — a good proxy for the
  // exterior callouts of vehicles/units, so legacy `at`-only configs occlude too.
  markerNrm(m,pos){
    const {size,scl}=this.norm, T=this.THREE, n=new T.Vector3();
    if(m.nrm && m.nrm.length===3){ n.set(m.nrm[0],m.nrm[1],m.nrm[2]); }
    else { n.set(pos[0], pos[1]-size.y*scl*0.5, pos[2]); }
    if(n.lengthSq()<1e-9) n.set(0,1,0);
    n.normalize(); return [n.x,n.y,n.z];
  }

  buildMarkers(){
    if(!this.labelBox) return;
    // на телефоне 21px под палец мало — точка узла крупнее (48px рекомендация HIG
    // недостижима без каши из номеров, 27px — компромисс, проверенный на 375px)
    const DS=(window.matchMedia&&window.matchMedia(this.HM_MQ).matches)?27:21;
    const M=this.CONFIG.markers||[]; this.markerEls=[];
    if(!M.length) return;
    M.forEach((m,i)=>{
      const pos=this.markerNorm(m.at||[0.5,0.5,0.5]);
      const nrm=this.markerNrm(m,pos);
      const line=document.createElement('div');
      line.style.cssText='position:absolute;height:1px;transform-origin:left center;background:linear-gradient(to right, rgba(56,232,255,0.85), rgba(56,232,255,0.1));pointer-events:none;opacity:0;transition:opacity .15s;z-index:8;';
      const box=document.createElement('div');
      box.style.cssText="position:absolute;transform:translateY(-50%);white-space:nowrap;font:600 11.5px 'IBM Plex Mono',monospace;color:#eafaff;background:rgba(4,16,26,0.88);border:1px solid rgba(56,232,255,0.45);border-radius:6px;padding:3px 8px;pointer-events:none;opacity:0;transition:opacity .15s;backdrop-filter:blur(4px);z-index:9;";
      box.textContent=String(m.n!=null?m.n:i+1).padStart(2,'0')+'  '+(m.name||'');
      const dot=document.createElement('button');
      dot.textContent=String(m.n!=null?m.n:i+1);
      dot.style.cssText="position:absolute;width:"+DS+"px;height:"+DS+"px;border-radius:50%;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;font:700 10.5px 'IBM Plex Mono',monospace;color:#04141f;background:rgba(56,232,255,0.9);border:1.5px solid #bff3ff;box-shadow:0 0 9px rgba(56,232,255,0.6);cursor:pointer;pointer-events:auto;z-index:10;transition:transform .1s,background .1s;";
      dot.onclick=(e)=>{ e.stopPropagation(); this.selectMarker(i); };
      dot.onmouseenter=()=>this.hoverMarker(i);
      dot.onmouseleave=()=>this.hoverMarker(-1);
      this.labelBox.appendChild(line); this.labelBox.appendChild(box); this.labelBox.appendChild(dot);
      this.markerEls.push({line,box,dot,pos,nrm});
    });
  }

  updateMarkers(cam){
    if(!this.markerEls||!this.markerEls.length) return;
    if(this.state.plan||this.state.cut){ this.markerEls.forEach(L=>{ L.dot.style.opacity='0'; L.dot.style.pointerEvents='none'; L.line.style.opacity='0'; L.box.style.opacity='0'; }); return; }
    const THREE=this.THREE, w=this.canvas.clientWidth, h=this.canvas.clientHeight;
    const Y=new THREE.Vector3(0,1,0), wp=new THREE.Vector3(), wn=new THREE.Vector3(), vd=new THREE.Vector3(), v=new THREE.Vector3();
    const vaz=this._viewAz!=null?this._viewAz:this.az;
    const showAll=this.state.calib, sm=THREE.MathUtils.smoothstep;
    this.markerEls.forEach((L,i)=>{
      const sel=this.selMarker===i, hov=this.hovMarker===i, active=sel||hov;
      wp.set(L.pos[0],L.pos[1],L.pos[2]).applyAxisAngle(Y,vaz);
      wn.set(L.nrm[0],L.nrm[1],L.nrm[2]).applyAxisAngle(Y,vaz);
      v.copy(wp).project(cam);
      if(v.z>1){ L.dot.style.opacity='0'; L.dot.style.pointerEvents='none'; L.line.style.opacity='0'; L.box.style.opacity='0'; return; }
      // model-viewer-style occlusion: a marker whose surface normal faces away from
      // the camera sits on the far side of the body -> fade it. Selected/hovered and
      // calibration mode stay fully visible so the leader line is always reachable.
      vd.copy(cam.position).sub(wp).normalize();
      const visK = (showAll||active) ? 1 : sm(wn.dot(vd), -0.12, 0.25);
      const sx=(v.x*0.5+0.5)*w, sy=(-v.y*0.5+0.5)*h;
      L.dot.style.left=sx+'px'; L.dot.style.top=sy+'px';
      L.dot.style.opacity=String((active?1:0.82)*visK);
      L.dot.style.pointerEvents= visK>0.15?'auto':'none';
      L.dot.style.transform='translate(-50%,-50%) scale('+(active?1.28:1)*(0.62+0.38*visK)+')';
      L.dot.style.background=sel?'#bff3ff':(hov?'#7fe6ff':'rgba(56,232,255,0.9)');
      if((active||showAll) && visK>0.05){
        const side=sx>w*0.55?-1:1, len=38, lx=sx+side*len, ly=sy-(active?20:14*(1+(i%3)));
        const ang=Math.atan2(ly-sy,lx-sx)*180/Math.PI, dl=Math.hypot(lx-sx,ly-sy);
        L.line.style.left=sx+'px'; L.line.style.top=sy+'px'; L.line.style.width=dl+'px'; L.line.style.transform='rotate('+ang+'deg)'; L.line.style.opacity=String((active?0.95:0.4)*visK);
        L.box.style.left=(lx+side*6)+'px'; L.box.style.top=ly+'px'; L.box.style.transform=side<0?'translate(-100%,-50%)':'translateY(-50%)'; L.box.style.opacity=String((active?1:0.6)*visK);
      } else { L.line.style.opacity='0'; L.box.style.opacity='0'; }
    });
  }

  selectMarker=(i)=>{ this.selMarker=(this.selMarker===i?-1:i); this.selectedPart=-1; this.setState({selMarker:this.selMarker, selected:-1}); this.lastInteract=performance.now(); };
  hoverMarker=(i)=>{ this.hovMarker=i; this.setState({hovMarker:i}); };
  toggleCalib=()=>{ this.setState({calib:!this.state.calib}); };
  // convert a clicked surface point back to fractional bbox coords for authoring markers
  reportCalib(p,n){
    const THREE=this.THREE, {size,scl}=this.norm, Y=new THREE.Vector3(0,1,0);
    const vaz=this._viewAz!=null?this._viewAz:this.az;
    const v=p.clone().applyAxisAngle(Y, -vaz);
    const f=(x)=>Math.round(x*1000)/1000;
    const fx=f(v.x/(size.x*scl)+0.5), fy=f(v.y/(size.y*scl)), fz=f(v.z/(size.z*scl)+0.5);
    const at='['+fx+', '+fy+', '+fz+']';
    let nrmStr='';
    if(n){ const nl=n.clone().applyAxisAngle(Y, -vaz).normalize(); nrmStr=', "nrm": ['+f(nl.x)+', '+f(nl.y)+', '+f(nl.z)+']'; }
    const next=(this.CONFIG.markers||[]).length+1;
    // model-viewer "editor" pattern: emit a paste-ready hotspot (position + normal)
    console.log('[calib] { "n": '+next+', "name": "", "desc": "", "at": '+at+nrmStr+' },');
    const s=fx+', '+fy+', '+fz; this.calibText=s; this.setState({calibText:s});
  }
