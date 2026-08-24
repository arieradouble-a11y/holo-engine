  // ---- live look-tuning panel («⚙ Вид») -------------------------------------
  // Ползунки пишут прямо в uniforms/bloom — вид меняется мгновенно, без
  // пересборки. «⧉ в конфиг» копирует текущие значения JSON-сниппетом для
  // вставки в configs/*.json. Панель пересоздаётся при каждом buildEdges
  // (labelBox очищается), состояние «открыта/закрыта» живёт в this._tuneOpen.
  tuneDefs(){
    const U=this.uniforms, O=()=>this.outUniforms;
    // Контурные ползунки показываем ТОЛЬКО когда контурный проход есть: у объектов
    // без него (structured-режим) они висели на нуле и ничего не делали — та же
    // ловушка «ползунок врёт», что была у блума.
    return (!this.outlineOn?[]:[
      { key:'outlineIntensity',      name:'Контур внешний',    min:0, max:4,   get:()=>O()?O().uInt.value:0,  set:v=>{ if(O()) O().uInt.value=v; } },
      { key:'outlineInnerIntensity', name:'Контур внутренний', min:0, max:2.5, get:()=>O()?O().uIntN.value:0, set:v=>{ if(O()) O().uIntN.value=v; } },
    ]).concat([
      // «детализация нутра» — обратная величина порога uNorm: правее = больше
      // внутренних линий (uNorm 3.0→0.6). key даёт готовый contourNormal для конфига.
      { key:'contourNormal', name:'Детализация нутра', min:0, max:1, inv:true,
        get:()=>{ const n=O()?O().uNorm.value:1.4; return (3.0-n)/2.4; },
        set:v=>{ if(O()) O().uNorm.value=3.0-v*2.4; }, cfg:()=>O()?+O().uNorm.value.toFixed(2):1.4 },
      { key:'fill',                  name:'Заливка каркаса',   min:0, max:1.5, get:()=>U.uFill.value,         set:v=>{ U.uFill.value=v; } },
      { key:'shellOpacity',          name:'Оболочка',          min:0, max:1,   get:()=>U.uShellOp.value,      set:v=>{ U.uShellOp.value=v; } },
      { key:'reflect',               name:'Отражение',         min:0, max:0.3, get:()=>U.uRefl.value,         set:v=>{ U.uRefl.value=v; } },
      // Пьедестал = светящаяся «лужа» под моделью (аддитивный градиент). Ползунка
      // у неё не было вовсе, а на глаз она читается как блум/отражение — и когда
      // просили «убрать блум», крутить было нечего.
      { key:'ground', name:'Пьедестал', min:0, max:1,
        get:()=>this.groundPlane?this.groundPlane.material.opacity:0,
        set:v=>{ if(this.groundPlane){ this.groundPlane.material.opacity=v; this.groundPlane.visible=v>0.001; } } },
      { key:'bloomStrength',         name:'Свечение (bloom)',  min:0, max:1.5, get:()=>this.bloom?this.bloom.strength:0, set:v=>{ if(this.bloom) this.bloom.strength=v; } },
    // ползунки голо-роя сняты вместе с кнопкой (19.08.2026); вернутся, если рой
    // включат в конфиге — тогда и uniforms из ensureSwarmU() снова пригодятся.
    ].concat(!(this.CONFIG.particles&&this.CONFIG.particles.on)?[]:[
      { key:'particlesIntensity', name:'Рой: яркость',  min:0, max:2, get:()=>this.ensureSwarmU().uPAmt.value,   set:v=>{ this.ensureSwarmU().uPAmt.value=v; } },
      { key:'particlesSwirl',     name:'Рой: кружение', min:0, max:1, get:()=>this.ensureSwarmU().uSwirl.value,  set:v=>{ this.ensureSwarmU().uSwirl.value=v; } },
      { key:'particlesBreath',    name:'Рой: дыхание',  min:0, max:1, get:()=>this.ensureSwarmU().uBreath.value, set:v=>{ this.ensureSwarmU().uBreath.value=v; } },
    ]));
  }
  buildTunePanel(){
    if(this.tuneEl){ this.tuneEl.remove(); this.tuneEl=null; }
    if(!this.labelBox && !this.tuneSlot) return;
    // Панель живёт В ПОТОКЕ левого блока, под кнопками (слот tuneSlot в viewer.html),
    // а не прибита к нижнему краю: в углу она наезжала снизу на кнопки и сверху на
    // легенду потоков и строку счётчика (замечание пользователя 19.08.2026,
    // скриншот — ползунки под кнопками «Разобрать/Потоки»). В потоке ей никто не
    // мешает и она не мешает никому; на низком экране левый блок просто прокрутится.
    const host=this.tuneSlot||this.labelBox;
    const box=document.createElement('div');
    box.style.cssText="width:238px;margin-top:12px;padding:11px 13px;border-radius:11px;background:rgba(4,16,26,0.82);border:1px solid rgba(56,232,255,0.25);backdrop-filter:blur(8px);pointer-events:auto;display:"+(this._tuneOpen?'block':'none')+";";
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
    host.appendChild(box); this.tuneEl=box;
  }
  // ⚠ ПАНЕЛЬ ПЕРЕСОБИРАЕТСЯ ПРИ КАЖДОМ ОТКРЫТИИ — иначе она показывает значения,
  // снятые в момент СБОРКИ, а собирается она из buildEdges, то есть ДО того, как
  // в init() создан composer с блумом. Из-за этого ползунок «Свечение (bloom)»
  // всегда стоял на нуле при живом strength 0.4-0.5: панель врала, а первое же
  // касание ставило настоящий ноль и свечение пропадало совсем («блум стоит ноль,
  // как только его подвинешь — выключается», замечание пользователя 22.08.2026).
  // Баг был и до селективного блума — проверено на сборке прошлого коммита.
  toggleTune=()=>{ this._tuneOpen=!this._tuneOpen;
    if(this._tuneOpen) this.buildTunePanel();          // значения — живые, на момент открытия
    else if(this.tuneEl) this.tuneEl.style.display='none';
    this.setState({tune:this._tuneOpen}); this.lastInteract=performance.now(); };
