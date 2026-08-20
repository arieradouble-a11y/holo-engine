  // ---- ТЕЛЕФОН: панели уезжают в нижний лист с вкладками ---------------------
  // Десктопная раскладка кладёт текст ПОВЕРХ модели: слева блок 48vw, справа
  // aside 42vw. На 375px это 180 + 158 из 375 — от модели остаётся полоска в
  // 14 пикселей, то есть «выбираешь объект, а самой модели не видно»
  // (замечание пользователя 20.08.2026). Здесь на ширине ≤640px:
  //   · экран целиком отдан модели, сверху только строка счётчика;
  //   · весь текст — в листе снизу, который открывают три вкладки
  //     «Системы» (список систем/узлов) · «Инфо» (описание, характеристики,
  //     атрибуция) · «Вид» (кнопки, плотность, настройка вида);
  //   · лист закрыт по умолчанию — первым делом человек видит голограмму;
  //   · выбрал систему в списке — лист сам переключается на «Инфо», чтобы
  //     подсвеченная деталь была видна вместе со своим описанием.
  // Раскладку целиком делает CSS по html[data-hm], поэтому перерисовка
  // компонента (DOM пересоздаётся на каждый setState) ничего не ломает:
  // состояние вкладки живёт на <html>, а не на узлах шаблона.
  HM_BAR = 54;
  HM_MQ = '(max-width:640px),(max-height:520px) and (pointer:coarse)';

  get hmOn(){ return !!(this._hmMQ && this._hmMQ.matches); }

  hmStyles(){ return [
    '@media '+this.HM_MQ+'{',
    ':root{--hm-bar:calc(54px + env(safe-area-inset-bottom,0px));}',
    /* шапка: только счётчик и (в отдельной вкладке — нет) заголовок */
    '[style*=\"--hm-head\"]{top:0!important;left:0!important;right:0!important;max-width:none!important;',
      'max-height:none!important;overflow:visible!important;padding:9px 150px 12px 13px!important;',
      'background:linear-gradient(to bottom,rgba(2,8,15,.82),rgba(2,8,15,0))!important;pointer-events:none!important;}',
    '[style*=\"--hm-badge\"],[style*=\"--hm-cat\"],[style*=\"--hm-sub\"],[style*=\"--hm-credf\"],[style*=\"--hm-hint\"],[style*=\"--hm-sep\"]{display:none!important;}',
    '[style*=\"--hm-title\"]{font-size:17px!important;line-height:1.15!important;white-space:nowrap;overflow:hidden;',
      'text-overflow:ellipsis;text-shadow:0 1px 10px rgba(0,0,0,.8)!important;}',
    /* счётчик — в правый верхний угол, где его не закрывает лист */
    '[style*=\"--hm-foot\"]{position:fixed!important;top:11px!important;right:12px!important;left:auto!important;',
      'bottom:auto!important;gap:0!important;max-width:38vw;}',
    '[style*=\"--hm-count\"]{font-size:10.5px!important;color:#9fd3e6!important;text-align:right;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    /* два листа: инструменты (из левого блока) и панель систем/инфо (aside) */
    '[style*=\"--hm-tools\"],[style*=\"--hm-side\"]{position:fixed!important;left:0!important;right:0!important;top:auto!important;',
      'bottom:var(--hm-bar)!important;width:auto!important;max-width:none!important;',
      'max-height:min(46vh,430px)!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch;',
      'border-radius:16px 16px 0 0!important;border:0!important;border-top:1px solid rgba(56,232,255,.24)!important;',
      'background:rgba(4,14,24,.95)!important;backdrop-filter:blur(14px)!important;',
      '-webkit-backdrop-filter:blur(14px)!important;box-shadow:0 -14px 34px rgba(0,0,0,.5)!important;',
      'padding:14px 14px 18px!important;pointer-events:auto!important;display:none!important;z-index:12!important;}',
    'html[data-hm="view"] [style*=\"--hm-tools\"]{display:block!important;}',
    'html[data-hm="parts"] [style*=\"--hm-side\"],html[data-hm="info"] [style*=\"--hm-side\"]{display:block!important;}',
    /* вкладка «Системы»: только списки; «Инфо»: только описание */
    'html[data-hm="parts"] [style*=\"--hm-info\"],html[data-hm="parts"] [style*=\"--hm-spec\"],html[data-hm="parts"] [style*=\"--hm-credm\"]{display:none!important;}',
    'html[data-hm="info"] [style*=\"--hm-ph\"],html[data-hm="info"] [style*=\"--hm-pl\"],html[data-hm="info"] [style*=\"--hm-lh\"],',
      'html[data-hm="info"] [style*=\"--hm-ll\"],html[data-hm="info"] [style*=\"--hm-fh\"],html[data-hm="info"] [style*=\"--hm-fl\"]{display:none!important;}',
    'html[data-hm="info"] [style*=\"--hm-info\"]{margin-top:0!important;padding-top:0!important;border-top:0!important;}',
    'html[data-hm="info"] [style*=\"--hm-credm\"]{display:block!important;}',
    /* пальцем в список попадать легче, чем мышью */
    '[style*=\"--hm-item\"]{padding:11px 12px!important;font-size:14px!important;}',
    '[style*=\"--hm-btn\"]{padding:11px 15px!important;font-size:13px!important;}',
    /* заголовок дублирует шапку окна каталога — в iframe его прячем */
    'html[data-hm-embed] [style*=\"--hm-title\"]{display:none!important;}',
    'html[data-hm-embed] [style*=\"--hm-head\"]{background:none!important;padding-top:0!important;}',
    // альбомный телефон: высоты 375px хватает только на невысокий лист
    '@media (max-height:520px){[style*=\"--hm-tools\"],[style*=\"--hm-side\"]{max-height:min(56vh,200px)!important;}}',
    '#hmbar{display:flex!important;}',
    '}',
    '#hmbar{position:fixed;left:0;right:0;bottom:0;z-index:30;display:none;align-items:stretch;',
      'height:var(--hm-bar,54px);padding-bottom:env(safe-area-inset-bottom,0px);',
      'background:rgba(3,11,19,.96);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
      'border-top:1px solid rgba(56,232,255,.18);}',
    "#hmbar button{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;",
      "gap:3px;background:none;border:0;padding:0;cursor:pointer;color:#6f9db1;",
      "font:600 10.5px 'IBM Plex Sans',sans-serif;-webkit-tap-highlight-color:transparent;}",
    '#hmbar button svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.7;',
      'stroke-linecap:round;stroke-linejoin:round;}',
    '#hmbar button.on{color:#38e8ff;}',
    '#hmbar button.on svg{filter:drop-shadow(0 0 6px rgba(56,232,255,.55));}',
    '#hmbar button[hidden]{display:none;}',
  ].join(''); }

  hmIcons(){ return {
    parts:'<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="1.6"/><circle cx="14" cy="12" r="1.6"/><circle cx="10" cy="18" r="1.6"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.6"/></svg>',
    view: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 3.6v2.6M12 17.8v2.6M3.6 12h2.6M17.8 12h2.6M6.1 6.1l1.9 1.9M16 16l1.9 1.9M17.9 6.1L16 8M8 16l-1.9 1.9"/></svg>',
  }; }

  hmInit(){
    if(this._hmReady) return; this._hmReady=true;
    try{ this._hmMQ=window.matchMedia(this.HM_MQ); }catch(_){ this._hmMQ={matches:false,addEventListener(){}}; }
    const st=document.createElement('style'); st.id='hm-css'; st.textContent=this.hmStyles();
    document.head.appendChild(st);
    const root=document.documentElement;
    root.dataset.hm='';
    // в iframe каталога заголовок объекта уже написан в шапке окна
    if(window.top!==window.self) root.dataset.hmEmbed='1';

    const bar=document.createElement('div'); bar.id='hmbar';
    const ic=this.hmIcons();
    this._hmTabs={};
    [['parts','Системы',ic.parts],['info','Инфо',ic.info],['view','Вид',ic.view]].forEach(([k,label,svg])=>{
      const b=document.createElement('button'); b.type='button';
      b.innerHTML=svg+'<em style="font-style:normal">'+label+'</em>';
      b.onclick=()=>this.hmSet(k);
      bar.appendChild(b); this._hmTabs[k]=b;
    });
    document.body.appendChild(bar); this._hmBar=bar;
    this._hmMQ.addEventListener && this._hmMQ.addEventListener('change',()=>{ this.hmSet(''); this.hmShift(); });
  }

  // вкладка: повторное нажатие по активной — закрыть лист (экран снова модели)
  hmSet=(k)=>{
    const root=document.documentElement;
    root.dataset.hm = (root.dataset.hm===k) ? '' : (k||'');
    this.hmPaint();
    // высота листа известна только после того, как он показан
    this.hmShift();
    this.lastInteract=performance.now();
  };

  hmPaint(){
    if(!this._hmTabs) return;
    const cur=document.documentElement.dataset.hm||'';
    Object.keys(this._hmTabs).forEach(k=>{ this._hmTabs[k].classList.toggle('on', k===cur); });
    // «Системы» нет у цельной модели без нумерованных узлов
    const hasList=(!this.wholeMode && this.PARTDEF.length>1) || this.standMode;
    this._hmTabs.parts.hidden=!hasList;
    this._hmTabs.parts.querySelector('em').textContent=this.standMode?'Узлы':'Системы';
    if(this._hmBar) this._hmBar.style.visibility=this.state.loading?'hidden':'visible';
  }

  // Сдвиг кадра вверх на половину «съеденной» высоты: иначе центр модели
  // оказывается ровно под открытым листом. setViewOffset двигает саму проекцию,
  // поэтому выноски и клики по модели остаются на своих местах.
  hmShift(){ try{ this.hmShift_(); }catch(_){} }
  hmShift_(){
    const cam=this.camera, c=this.canvas; if(!cam||!c) return;
    const w=c.clientWidth, h=c.clientHeight; if(!w||!h) return;
    if(!this.hmOn){ cam.clearViewOffset(); return; }
    const tab=document.documentElement.dataset.hm||'';
    let sheet=0;
    if(tab){
      const n=document.querySelector(tab==='view'?'[style*=\"--hm-tools\"]':'[style*=\"--hm-side\"]');
      if(n) sheet=Math.max(0, n.getBoundingClientRect().height);
    }
    cam.setViewOffset(w,h,0,Math.round((this.HM_BAR+sheet)*0.5),w,h);
  }

  // Зовётся из renderVals на каждой перерисовке: дешёвая синхронизация вкладок
  // (DOM панели пересоздаётся, а панель вкладок живёт в body и переживает всё).
  // ⚠ Под try/catch, и hmShift тоже: обе живут внутри рендера (renderVals) и
  // внутри кадра (onResize), а исключение оттуда гасит вьювер целиком — ровно
  // так однажды тултип уронил карту на главной. Вкладки — украшение, падать
  // из-за них голограмма не должна; сообщение печатаем один раз.
  hmSync(){ try{ this.hmSync_(); }catch(e){ if(!this._hmWarned){ this._hmWarned=1; console.warn('mobile ui:', e); } } }
  hmSync_(){
    if(!this._hmReady) this.hmInit();
    this.hmPaint();
    if(!this.hmOn) return;
    // выбрал систему/узел — показываем описание выбранного, а не список
    const sel=this.state.selected, sm=this.state.selMarker;
    const key=sel+'/'+sm;
    if(this._hmSel!==undefined && this._hmSel!==key && (sel>=0||sm>=0)
       && document.documentElement.dataset.hm==='parts'){
      document.documentElement.dataset.hm='info';
      setTimeout(()=>{ this.hmPaint(); this.hmShift(); },0);
    }
    this._hmSel=key;
  }
