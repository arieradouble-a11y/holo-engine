  // ---- animated medium-flow arrows (теплоноситель / ГВС / ХВС) --------------
  // CONFIG.flows: [{ kind, color:[r,g,b], speed, count, at:[[fx,fy,fz],…] }].
  // Points are fractional bbox coords (like markers) → model-local via markerNorm,
  // added to this.pivot so they orbit with the model. Bright additive cones follow
  // a Catmull-Rom curve along a faint guide-tube and bloom into glowing flow.
  get hasFlows(){ return !!(this.CONFIG.flows && this.CONFIG.flows.length); }
  buildFlows(THREE){
    if(this.flowGroup || !this.hasFlows) return;
    const g=new THREE.Group(); g.renderOrder=6; this.pivot.add(g); this.flowGroup=g;
    const H=this.norm.height, aLen=Math.max(0.16,H*0.05), aR=Math.max(0.06,H*0.019);
    const kindCol={ heat:[1.0,0.34,0.12], hot:[1.0,0.34,0.12], primary:[1.0,0.34,0.12],
      secondary:[1.0,0.6,0.2], gvs:[1.0,0.6,0.2], heating:[1.0,0.6,0.2],
      cold:[0.4,0.82,1.0], hvs:[0.4,0.82,1.0], water:[0.4,0.82,1.0] };
    this.flows=(this.CONFIG.flows||[]).map(f=>{
      const pts=(f.at||[]).map(a=>{ const p=this.markerNorm(a); return new THREE.Vector3(p[0],p[1],p[2]); });
      if(pts.length<2) return null;
      const curve=new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
      const col=(f.color&&f.color.length===3)? f.color : (kindCol[(f.kind||'heat').toLowerCase()]||[1.0,0.5,0.2]);
      const c3=new THREE.Color(col[0],col[1],col[2]);
      // faint guide tube so the route reads even between arrows
      const tube=new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(28,pts.length*10), aR*0.3, 6, false),
        new THREE.MeshBasicMaterial({color:c3, transparent:true, opacity:0.18, blending:THREE.AdditiveBlending, depthTest:false, depthWrite:false}));
      tube.renderOrder=5; g.add(tube);
      const count=f.count||Math.max(4, Math.round(curve.getLength()/(H*0.7)));
      const geo=new THREE.ConeGeometry(aR, aLen, 10);
      const arrows=[];
      for(let i=0;i<count;i++){
        const m=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:c3, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthTest:false, depthWrite:false}));
        m.renderOrder=6; g.add(m); arrows.push(m);
      }
      return { curve, arrows, count, speed:(f.speed!=null?f.speed:0.09), kind:f.kind||'', color:col };
    }).filter(Boolean);
  }
  // Легенда потоков рисуется ШАБЛОНОМ в правой панели (aside) из flowLegendRows()
  // — см. viewer.html. Раньше это был абсолютный блок в углу сцены: слева внизу он
  // ложился на счётчик «Систем: NN», после переезда панели «⚙ Вид» в левый блок на
  // низких экранах встречался и с ней, а справа внизу — с самим aside (на 590px он
  // тянется до самого низа). В aside легенда — такая же секция, как «Системы» и
  // «Основные узлы», и прокручивается вместе с ними; накладываться ей не на что.
  buildFlowLegend(){ if(this.flowLegendEl){ this.flowLegendEl.remove(); this.flowLegendEl=null; } }
  flowLegendRows(){
    if(!this.flows || !this.flows.length) return [];
    return this.flows.map(fl=>{ const c=fl.color, rgb=Math.round(c[0]*255)+','+Math.round(c[1]*255)+','+Math.round(c[2]*255);
      return { name: fl.kind||'', swStyle: "flex:none;width:18px;height:0;border-top:3px solid rgba("+rgb+",0.95);box-shadow:0 0 7px rgba("+rgb+",0.75);border-radius:2px;" }; });
  }
  get flowLegendOn(){
    return this.state.flow!==false && !!this.hasFlows && (this.explode||0)<0.12 && !this.state.plan && !this.state.cut && (this.progress||0)>0.85;
  }
  updateFlows(t){
    if(!this.flowGroup) return;
    const on = this.state.flow!==false && this.hasFlows && this.explode<0.12 && !this.state.plan && !this.state.cut && this.progress>0.85;
    this.flowGroup.visible=on;
    // Легенда теперь в aside и рисуется React'ом, а условие «показывать» зависит от
    // progress/explode, которые живут вне state. Перерисовываем ТОЛЬКО на переходе
    // (одна перерисовка на включение/выключение, не на каждый кадр).
    if(on!==this._legendShown){ this._legendShown=on; this.setState({legendOn:on}); }
    if(!on || !this.flows) return;
    const T=this.THREE;
    const up=this._flowUp||(this._flowUp=new T.Vector3(0,1,0));
    const tan=this._flowTan||(this._flowTan=new T.Vector3());
    const q=this._flowQ||(this._flowQ=new T.Quaternion());
    this.flows.forEach(fl=>{ const n=fl.count;
      for(let i=0;i<n;i++){ const a=fl.arrows[i];
        let u=(t*fl.speed + i/n)%1; if(u<0) u+=1;
        a.position.copy(fl.curve.getPointAt(u));
        fl.curve.getTangentAt(u, tan); q.setFromUnitVectors(up, tan); a.quaternion.copy(q);
        const puls=0.72+0.28*Math.sin(u*6.28318 - t*3.0);
        a.material.opacity=0.5+0.45*puls;
      }
    });
  }
  toggleFlow=()=>{ this.setState({flow:!(this.state.flow!==false)}); this.lastInteract=performance.now(); };
