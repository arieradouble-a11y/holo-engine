  // ---- live look-tuning panel («⚙ Вид») -------------------------------------
  // Ползунки пишут прямо в uniforms/bloom — вид меняется мгновенно, без
  // пересборки. «⧉ в конфиг» копирует текущие значения JSON-сниппетом для
  // вставки в configs/*.json. Панель пересоздаётся при каждом buildEdges
  // (labelBox очищается), состояние «открыта/закрыта» живёт в this._tuneOpen.
  tuneDefs(){
    const U=this.uniforms, O=()=>this.outUniforms;
    return [
      { key:'outlineIntensity',      name:'Контур внешний',    min:0, max:4,   get:()=>O()?O().uInt.value:0,  set:v=>{ if(O()) O().uInt.value=v; } },
      { key:'outlineInnerIntensity', name:'Контур внутренний', min:0, max:2.5, get:()=>O()?O().uIntN.value:0, set:v=>{ if(O()) O().uIntN.value=v; } },
      // «детализация нутра» — обратная величина порога uNorm: правее = больше
      // внутренних линий (uNorm 3.0→0.6). key даёт готовый contourNormal для конфига.
      { key:'contourNormal', name:'Детализация нутра', min:0, max:1, inv:true,
        get:()=>{ const n=O()?O().uNorm.value:1.4; return (3.0-n)/2.4; },
        set:v=>{ if(O()) O().uNorm.value=3.0-v*2.4; }, cfg:()=>O()?+O().uNorm.value.toFixed(2):1.4 },
      { key:'fill',                  name:'Заливка каркаса',   min:0, max:1.5, get:()=>U.uFill.value,         set:v=>{ U.uFill.value=v; } },
      { key:'shellOpacity',          name:'Оболочка',          min:0, max:1,   get:()=>U.uShellOp.value,      set:v=>{ U.uShellOp.value=v; } },
      { key:'bloomStrength',         name:'Свечение (bloom)',  min:0, max:1.5, get:()=>this.bloom?this.bloom.strength:0, set:v=>{ if(this.bloom) this.bloom.strength=v; } },
    ];
  }
  buildTunePanel(){
    if(this.tuneEl){ this.tuneEl.remove(); this.tuneEl=null; }
    if(!this.labelBox) return;
    const box=document.createElement('div');
    box.style.cssText="position:absolute;left:30px;bottom:64px;width:238px;padding:11px 13px;border-radius:11px;background:rgba(4,16,26,0.82);border:1px solid rgba(56,232,255,0.25);backdrop-filter:blur(8px);pointer-events:auto;z-index:11;display:"+(this._tuneOpen?'block':'none')+";";
    const title=document.createElement('div');
    title.style.cssText="display:flex;justify-content:space-between;align-items:center;font:600 10px 'IBM Plex Mono',monospace;letter-spacing:.14em;color:#6fcfe6;margin-bottom:9px;";
    title.textContent='НАСТРОЙКА ВИДА';
    const copy=document.createElement('button');
    copy.textContent='⧉ в конфиг';
    copy.style.cssText="cursor:pointer;font:600 9.5px 'IBM Plex Mono',monospace;color:#9fdcef;background:rgba(56,232,255,0.10);border:1px solid rgba(56,232,255,0.3);border-radius:6px;padding:2px 7px;";
    copy.onclick=()=>{
      const s={}; this.tuneDefs().forEach(d=>{ if(d.key==='bloomStrength'){ s.bloom=Object.assign({},this.CONFIG.bloom,{strength:+d.get().toFixed(2)}); } else s[d.key]= d.cfg? d.cfg() : +d.get().toFixed(2); });
      const txt=JSON.stringify(s,null,2).replace(/^\{\n|\n\}$/g,'');
      console.log('[настройка вида]\n'+txt);
      try{ navigator.clipboard.writeText(txt); copy.textContent='✓ скопировано'; }catch(_){ copy.textContent='→ в консоли'; }
      setTimeout(()=>{ copy.textContent='⧉ в конфиг'; },1400);
    };
    title.appendChild(copy); box.appendChild(title);
    this.tuneDefs().forEach(d=>{
      const row=document.createElement('div'); row.style.cssText='margin-bottom:7px;';
      const lab=document.createElement('div');
      lab.style.cssText="display:flex;justify-content:space-between;font:500 10.5px 'IBM Plex Sans',sans-serif;color:#bfe2ef;margin-bottom:2px;";
      const nameEl=document.createElement('span'); nameEl.textContent=d.name;
      const valEl=document.createElement('span'); valEl.style.cssText="font-family:'IBM Plex Mono',monospace;color:#7fd6ec;"; valEl.textContent=d.get().toFixed(2);
      lab.appendChild(nameEl); lab.appendChild(valEl);
      const inp=document.createElement('input');
      inp.type='range'; inp.min=d.min; inp.max=d.max; inp.step=0.01; inp.value=d.get();
      inp.style.cssText='width:100%;height:14px;accent-color:#38e8ff;cursor:pointer;';
      inp.oninput=()=>{ const v=parseFloat(inp.value); d.set(v); valEl.textContent=v.toFixed(2); };
      row.appendChild(lab); row.appendChild(inp); box.appendChild(row);
    });
    this.labelBox.appendChild(box); this.tuneEl=box;
  }
  toggleTune=()=>{ this._tuneOpen=!this._tuneOpen; if(this.tuneEl) this.tuneEl.style.display=this._tuneOpen?'block':'none'; else this.buildTunePanel(); this.setState({tune:this._tuneOpen}); this.lastInteract=performance.now(); };
