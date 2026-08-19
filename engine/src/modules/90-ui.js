  // Светлая тема хозяина (каталога): голограмма — аддитивное свечение на тёмном,
  // на белом её не существует, поэтому сцена остаётся тёмным «экраном», а вот
  // рамка вокруг — тёмно-синяя виньетка по краям — ослабляется, чтобы окно не
  // выглядело чёрной дырой в светлом интерфейсе. Сигнал: postMessage {holo:'theme',light}.
  setLightFrame(on){
    this._lightFrame=!!on;
    const root=this.canvas&&this.canvas.parentElement; if(!root) return;
    const vign=root.children[3];   // inset box-shadow виньетка: canvas(0), labels(1), сканлайны(2), она(3)
    if(vign) vign.style.boxShadow=on?'inset 0 0 160px 20px rgba(0,0,0,0.35)':'inset 0 0 240px 50px rgba(0,0,0,0.7)';
  }
  renderVals(){
    const C=this.CONFIG, whole=this.wholeMode, sel=this.state.selected;
    const ctrlBase="cursor:pointer;font:600 12.5px 'IBM Plex Sans',sans-serif;padding:9px 15px;border-radius:10px;transition:all .15s;backdrop-filter:blur(8px);";
    const ctrlN=ctrlBase+"color:#dff6ff;background:rgba(6,18,30,0.6);border:1px solid rgba(56,232,255,0.3);";
    const ctrlM=ctrlBase+"color:#9fc6d8;background:rgba(6,18,30,0.45);border:1px solid rgba(56,232,255,0.16);";
    const controls=[];
    if(!whole) controls.push({label:this.state.exploded?'⊞  Собрать':'⊟  Разобрать', style:ctrlN, onClick:this.toggleExplode});
    if(this.hasFlows) controls.push({label:(this.state.flow!==false)?'⇢  Потоки: ВКЛ':'⇢  Потоки: ВЫКЛ', style:(this.state.flow!==false)?ctrlN:ctrlM, onClick:this.toggleFlow});
    // «Рой» (36-particles) с кнопок снят 19.08.2026 — по замечанию пользователя
    // эффект сейчас не нужен; модуль и конфиг-ключ particles остаются, включается
    // только явно: particles:{on:true} в конфиге.
    controls.push({label:this.state.spin?'↻  Вращение: ВКЛ':'↻  Вращение', style:this.state.spin?ctrlN:ctrlM, onClick:this.toggleSpin});
    controls.push({label:this._tuneOpen?'⚙  Вид: настройка':'⚙  Вид', style:this._tuneOpen?ctrlN:ctrlM, onClick:this.toggleTune});
    controls.push({label:'↺  Сбросить вид', style:ctrlM, onClick:this.resetView});
    if(this.planMode) controls.push({label:this.state.plan?'⊠  Выйти из плана':'▦  План этажа', style:ctrlN, onClick:this.togglePlan});
    if(this.state.plan){ controls.push({label:'▲ выше', style:ctrlM, onClick:()=>this.planStep(1)}); controls.push({label:'▼ ниже', style:ctrlM, onClick:()=>this.planStep(-1)}); }
    if(this.planMode) controls.push({label:this.state.cut?'⊠  Собрать фасад':'◫  Разрез фасада', style:ctrlN, onClick:this.toggleCut});
    if(this.state.cut){ controls.push({label:'⟩ глубже', style:ctrlM, onClick:()=>this.cutStep(1)}); controls.push({label:'⟨ меньше', style:ctrlM, onClick:()=>this.cutStep(-1)}); }
    if((C.markers&&C.markers.length) && C.calibrate!==false && !this.state.plan && !this.state.cut) controls.push({label:this.state.calib?'⊙  калибровка: ВКЛ':'⊕  калибровка', style:ctrlM, onClick:this.toggleCalib});

    const dBtn=(k,on)=>`cursor:pointer;font:600 10px 'IBM Plex Mono',monospace;letter-spacing:.06em;padding:5px 10px;border-radius:7px;border:none;transition:all .15s;${on?'background:rgba(56,232,255,0.9);color:#04141f;':'background:transparent;color:#7fb3c8;'}`;
    const densBtns=Object.keys(this.densMap).map(k=>({label:this.densMap[k].label, style:dBtn(k,this.state.density===k), onClick:()=>this.setDensity(k)}));

    const partStyle=a=>`display:flex;align-items:center;gap:11px;width:100%;text-align:left;cursor:pointer;font:500 13.5px 'IBM Plex Sans',sans-serif;padding:9px 11px;border-radius:10px;transition:all .15s;border:1px solid ${a?'rgba(56,232,255,0.5)':'rgba(56,232,255,0.12)'};background:${a?'rgba(56,232,255,0.12)':'rgba(6,18,30,0.4)'};color:${a?'#eafaff':'#b4d4e2'};`;
    const numStyle=a=>`flex:none;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:6px;font:600 11px 'IBM Plex Mono',monospace;background:${a?'rgba(56,232,255,0.9)':'rgba(56,232,255,0.12)'};color:${a?'#04141f':'#7fd6ec'};`;
    const parts=whole?[]:this.PARTDEF.map((p,i)=>({ name:p.name, num:String(i+1).padStart(2,'0'), style:partStyle(i===sel), numStyle:numStyle(i===sel), onClick:()=>this.selectPart(i), onEnter:()=>this.setHover(i), onLeave:()=>this.setHover(-1) }));

    const headHide=whole?'display:none;':'';
    const std=this.standMode, M=C.markers||[], selm=this.state.selMarker, calib=this.state.calib;
    const hasMarkers=M.length>0, hasSpecs=!!(C.specs&&C.specs.rows);
    const markersList = std? M.map((m,i)=>({ name:m.name||'', num:String(m.n!=null?m.n:i+1).padStart(2,'0'), style:partStyle(i===selm), numStyle:numStyle(i===selm), onClick:()=>this.selectMarker(i), onEnter:()=>this.hoverMarker(i), onLeave:()=>this.hoverMarker(-1) })) : [];
    const curM = (selm>=0)? M[selm] : null;
    const specRows = hasSpecs? C.specs.rows.map(r=>({k:r[0], v:r[1]})) : [];
    const cur = (!whole && sel>=0) ? this.PARTDEF[sel] : null;
    const overview = C.overview || {};
    const infoSep = std || !whole || hasSpecs;
    return {
      onCanvas:this.onCanvas, onLabels:this.onLabels, onTuneSlot:this.onTuneSlot,
      badge: C.badge || 'ИНТЕРАКТИВНАЯ ГОЛОГРАММА',
      category: C.category || '',
      title: C.title || 'Объект',
      subtitle: C.subtitle || '',
      loading:this.state.loading, loadingText:this.state.loadingText,
      controls, densBtns, parts, markersList, specRows,
      partsHeadStyle: `font:600 11px 'IBM Plex Mono',monospace;letter-spacing:.16em;color:#6fcfe6;margin-bottom:12px;${headHide}`,
      partsListStyle: `display:${whole?'none':'flex'};flex-direction:column;gap:6px;`,
      legendHeadStyle: `font:600 11px 'IBM Plex Mono',monospace;letter-spacing:.16em;color:#6fcfe6;margin-bottom:12px;display:${std?'block':'none'};`,
      legendListStyle: `display:${std?'flex':'none'};flex-direction:column;gap:6px;`,
      specWrapStyle: `display:${hasSpecs?'block':'none'};margin-top:15px;padding-top:14px;border-top:1px solid rgba(56,232,255,0.14);`,
      specTitle: (C.specs&&C.specs.title)||'ОБЩИЕ ХАРАКТЕРИСТИКИ',
      infoWrapStyle: `margin-top:${infoSep?'15':'0'}px;padding-top:${infoSep?'15':'0'}px;border-top:${infoSep?'1px solid rgba(56,232,255,0.14)':'none'};`,
      infoTag: curM? ('УЗЕЛ '+String(curM.n!=null?curM.n:selm+1).padStart(2,'0')) : (cur? cur.tag : (overview.tag||'ОБЗОР')),
      infoTitle: curM? curM.name : (cur? cur.name : (overview.title|| (whole? C.title : (this.PARTDEF.length+' основных систем')))),
      infoDesc: curM? (curM.desc||'') : (cur? cur.desc : (overview.desc||C.subtitle||'')),
      credits: C.credits||'',
      flowLegend: this.flowLegendRows(), flowLegendOn: this.flowLegendOn,
      counter: this.state.plan ? ('ПЛАН · ЭТАЖ '+(this.state.planFloor+1)+' / '+(this.planFloors||9))
               : this.state.cut ? 'РАЗРЕЗ ФАСАДА · КВАРТИРЫ В ОБЪЁМЕ'
               : calib ? ('КАЛИБР: '+(this.state.calibText||'кликните по модели'))
               : selm>=0 ? ('Узел '+String((curM&&curM.n!=null?curM.n:selm+1)).padStart(2,'0')+' / '+String(M.length).padStart(2,'0'))
               : (!whole && sel>=0) ? ('Система '+String(sel+1).padStart(2,'0')+' / '+String(this.PARTDEF.length).padStart(2,'0'))
               : std ? ('Узлов: '+String(M.length).padStart(2,'0'))
               : whole ? (C.counter||'ГОЛОГРАММА') : ('Систем: '+String(this.PARTDEF.length).padStart(2,'0')),
      hint: this.state.cut ? 'разрез фасада · ⟨/⟩ — глубина среза · тяните — поворот'
            : this.state.plan ? 'план типовой блок-секции · ▲/▼ — этаж · 1Б-2Б-3Б-3Б'
            : calib ? 'КАЛИБРОВКА: клик по модели → координаты узла (консоль + строка снизу)'
            : std ? 'клик по номеру или в списке — узел · тяните — поворот · колесо — масштаб'
            : whole ? 'тяните — поворот · колесо — масштаб'
            : (this.state.exploded?'наведите на систему в списке · колесо — масштаб':'тяните — поворот · клик по системе или номеру · колесо — масштаб'),
    };
  }