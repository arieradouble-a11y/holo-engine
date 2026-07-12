  // ---- procedural buildings (no GLB) ---------------------------------------
  // Generate a multi-storey apartment block (МКД) from parameters into meshData.
  // Every element is a thin box so the shared EdgesGeometry pipeline yields clean
  // architectural lines; material names map to systems via CONFIG.matRules, and
  // the engineering risers are flagged "hot" so they glow in the inner colour.
  buildProceduralModel(THREE){
    const b=this.CONFIG.building||{};
    const floors=b.floors||9, fh=b.floorHeight||2.75, sections=b.sections||3,
          sw=b.sectionWidth||21.0, D=b.depth||12.0, winCols=b.windowsPerSection||7;
    const W=sections*sw, H=floors*fh;
    const md=this.meshData;
    this.planRooms=[]; this.planFloors=floors; this.planFloorH=fh;
    const box=(sx,sy,sz,cx,cy,cz,mat)=>{ const g=new THREE.BoxGeometry(sx,sy,sz); md.push({name:mat,mat,geometry:g,matrixWorld:new THREE.Matrix4().makeTranslation(cx,cy,cz)}); };
    // cylinder helper (axis 'y'|'x'|'z') — for tanks, boilers, chimney, manifolds
    const cyl=(r,h,cx,cy,cz,mat,axis)=>{ const g=new THREE.CylinderGeometry(r,r,h,14,1); const m=new THREE.Matrix4().makeTranslation(cx,cy,cz);
      if(axis==='x') m.multiply(new THREE.Matrix4().makeRotationZ(Math.PI/2)); else if(axis==='z') m.multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
      md.push({name:mat,mat,geometry:g,matrixWorld:m}); };
    // truncated cone (radiusTop != radiusBottom) — for cooling-tower silhouette
    const frustum=(rT,rB,h,cx,cy,cz,mat)=>{ const g=new THREE.CylinderGeometry(rT,rB,h,16,1); md.push({name:mat,mat,geometry:g,matrixWorld:new THREE.Matrix4().makeTranslation(cx,cy,cz)}); };

    // Declarative geometry: the object is described as DATA in the config
    // (list of primitives / repeat-groups) — new facilities need no engine code.
    if(Array.isArray(this.CONFIG.geometry) && this.CONFIG.geometry.length){ this.genDeclarative(box,cyl,frustum,this.CONFIG.geometry,0,0,0); return; }
    if(b.type==='power'){ this.genPowerPlant(box,cyl,frustum,b); return; }
    if(b.type==='boiler'){ this.genBoilerHouse(box,cyl,b); return; }
    if(b.type==='ctp'){ this.genCTP(box,cyl,b); return; }

    box(W*1.03, 0.5, D*1.04, 0, -0.25, 0, 'base');                                 // цоколь / плита
    box(W, H, D, 0, H/2, 0, 'shell');                                              // несущая оболочка
    for(let f=1; f<floors; f++) box(W*1.002, 0.10, D*1.002, 0, f*fh, 0, 'slab');   // междуэтажные перекрытия
    for(let s=1; s<sections; s++) box(0.14, H, D, -W/2 + s*sw, H/2, 0, 'wall');    // межсекционные стены
    box(W, 0.5, D, 0, H+0.25, 0, 'roof'); box(W*1.02, 0.7, D*1.02, 0, H+0.35, 0, 'roof'); // кровля + парапет

    const winW=Math.min(1.4, sw/(winCols+1.2)), winH=fh*0.5, step=sw/(winCols+0.4);
    for(let s=0; s<sections; s++){
      const scx=-W/2 + (s+0.5)*sw;
      box(3.0, H, 4.4, scx, H/2, -D*0.20, 'core');         // лестнично-лифтовой узел (лифт + лестница)
      const loggiaCol=winCols-1;                            // правый ряд секции — стояк лоджий (характерно для 121)
      for(let f=0; f<floors; f++){
        const cy=f*fh + fh*0.55;
        for(let c=0; c<winCols; c++){
          const cx=scx + (c-(winCols-1)/2)*step;
          if(f===0 && c===((winCols-1)/2|0)){
            box(1.4, 2.3, 0.18, cx, 1.15, D/2, 'entrance');     // дверь подъезда
            box(2.1, 0.14, 1.1, cx, 2.4, D/2+0.5, 'entrance');  // козырёк
            continue;
          }
          if(c===loggiaCol){
            if(f>=1){ box(step*0.92, winH*1.5, 0.10, cx, f*fh+fh*0.5, D/2, 'balcony');   // проём лоджии
                      box(step*0.92, 0.10, 1.2,  cx, f*fh+0.08, D/2-0.4, 'balcony'); }   // утопленная плита лоджии
            else box(winW, winH, 0.14, cx, cy, D/2, 'window');
            box(winW, winH, 0.14, cx, cy, -D/2, 'window');
            continue;
          }
          box(winW, winH, 0.14, cx, cy, D/2,  'window');  // лицевой фасад
          box(winW, winH, 0.14, cx, cy, -D/2, 'window');  // тыльный фасад
        }
      }
    }

    // ---- внутренние планировки квартир (схема состава 1Б-2Б-3Б-3Б на секцию) ----
    const pHalf=1.6, svc=2.4, labelSec=Math.floor(sections/2), labelFloor=Math.min(floors-1,4);
    const wallX=(ax0,ax1,z,y)=>box(Math.abs(ax1-ax0),fh*0.94,0.10,(ax0+ax1)/2,y+fh*0.5,z,'partition');
    const wallZ=(az0,az1,x,y)=>box(0.10,fh*0.94,Math.abs(az1-az0),x,y+fh*0.5,(az0+az1)/2,'partition');
    const apt=(x0,x1,zc,zf,name,nLiv,y,lbl)=>{
      const sgn=Math.sign(zf-zc), sb=zc+sgn*svc;
      wallX(x0,x1,sb,y);                                              // служебная зона | жилые комнаты
      for(let k=1;k<nLiv;k++) wallZ(sb,zf,x0+k*(x1-x0)/nLiv,y);       // деление жилой зоны на комнаты
      const sm1=x0+(x1-x0)*0.42, sm2=x0+(x1-x0)*0.72;
      wallZ(zc,sb,sm1,y); wallZ(zc,sb,sm2,y);                         // кухня | с/у | прихожая
      if(lbl){ const lw=(x1-x0)/nLiv;
        for(let k=0;k<nLiv;k++) this.planRooms.push({x:x0+(k+0.5)*lw,z:(sb+zf)/2,name:'Комната'});
        this.planRooms.push({x:(x0+sm1)/2,z:(zc+sb)/2,name:'Кухня'});
        this.planRooms.push({x:(sm1+sm2)/2,z:(zc+sb)/2,name:'С/у'});
        this.planRooms.push({x:(sm2+x1)/2,z:(zc+sb)/2,name:'Прихож.'});
        this.planRooms.push({x:(x0+x1)/2,z:(zc+zf)/2,name:name,apt:true});
      }
    };
    for(let s=0;s<sections;s++){
      const scx=-W/2+(s+0.5)*sw, lbl=(s===labelSec);
      for(let f=0;f<floors;f++){
        const y=f*fh, L=lbl&&(f===labelFloor);
        wallX(scx-sw/2,scx-pHalf,0,y); wallX(scx+pHalf,scx+sw/2,0,y);                 // коридор: фронт|тыл
        wallZ(-D/2,1.2,scx-pHalf,y); wallZ(-D/2,1.2,scx+pHalf,y); wallX(scx-pHalf,scx+pHalf,1.2,y); // стены ядра
        apt(scx-sw/2,scx-pHalf, 0, D/2,  '3Б',3,y,L);   // фронт-лево
        apt(scx+pHalf,scx+sw/2, 0, D/2,  '3Б',3,y,L);   // фронт-право
        apt(scx-sw/2,scx-pHalf, 0,-D/2,  '2Б',2,y,L);   // тыл-лево
        apt(scx+pHalf,scx+sw/2, 0,-D/2,  '1Б',1,y,L);   // тыл-право
      }
    }

    // инженерные стояки (горячие): ХВС/ГВС, отопление, канализация, электрика, мусоропровод
    const risers=b.risers||['water','heat','sewer','electric','trash'];
    risers.forEach((sys,i)=>{ const x=-W/2 + (i+1)*W/(risers.length+1); box(0.22, H, 0.22, x, H/2, -D*0.16, sys);
      if(sys==='trash'||sys==='sewer') box(0.32, 1.2, 0.32, x, H+0.6, -D*0.16, sys); }); // вытяжка над кровлей
  }

  // Водогрейная котельная (БМК) — компоновка по реальному тепломеханическому залу:
  // котлы КВ-ГМ-типа (рама, корпус, верхний коллектор, газовый короб, горелка РГМГ
  // с улиткой дутьевого вентилятора и газовой рампой), индивидуальные газоходы и
  // дымовые трубы-«сэндвич» сквозь кровлю, распределительные гребёнки (подающий/
  // обратный коллекторы со стойками и отводами), ряд сетевых насосов «улитка+мотор»,
  // пластинчатые теплообменники ГВС, водоподготовка (Na-фильтры, солевой бак,
  // деаэратор с баком-аккумулятором, расширительный бак), щиты КИПиА и ГРУ, а также
  // магистральные трубопроводы под кровлей. Котлы у тыльной стены, вспомогательное
  // оборудование — у фронта; ХВО слева, автоматика/газ справа.
  genBoilerHouse(box, cyl, b){
    const W=b.width||26, H=b.height||9, D=b.depth||13, nB=b.boilers||3, chH=b.chimneyHeight||20;
    const bz=-D*0.20;          // ось ряда котлов (тыльная треть зала), горелки смотрят в зал (+Z)
    const fz=D*0.40;           // фронтальная зона: насосы у входной стены
    const mz=D*0.02;           // ось распределительных гребёнок (центр зала)

    // ---- ограждающие конструкции -------------------------------------------
    box(W*1.03,0.5,D*1.04, 0,-0.25,0,'base');           // фундаментная плита
    box(W,H,D, 0,H/2,0,'shell');                        // тепляк (блок-модуль)
    box(W,0.5,D, 0,H+0.25,0,'roof');                    // кровля
    box(W*1.02,0.55,D*1.02, 0,H+0.45,0,'roof');         // парапет
    box(2.2,2.5,0.16, W*0.30,1.25,D/2,'base');          // распашные ворота (фронт)

    // ---- котлы КВ-ГМ-типа ---------------------------------------------------
    const bxs=[];
    for(let i=0;i<nB;i++){ const x=-W/2+(i+1)*W/(nB+1); bxs.push(x);
      box(3.8,0.5,5.2, x,0.25,bz,'base');               // опорная рама котла
      box(3.4,2.8,4.6, x,1.9,bz,'boiler');              // корпус (топка + конвективная часть)
      cyl(0.5,4.4, x,3.5,bz,'boiler','z');              // верхний коллектор (барабан)
      const ff=bz+2.5;                                  // плоскость фронта котла
      box(1.8,1.8,0.5, x,1.7,ff,'boiler');              // воздушный короб
      cyl(0.45,1.1, x,1.7,ff+0.7,'boiler','z');         // ствол горелки РГМГ
      cyl(0.6,0.95, x+1.15,1.7,ff+0.15,'boiler','x');   // улитка дутьевого вентилятора
      box(0.95,1.1,0.9, x+1.55,1.5,ff+0.15,'boiler');   // эл.двигатель вентилятора
      cyl(0.13,1.5, x-1.25,1.0,ff+0.4,'boiler','y');    // стойка газовой рампы
      cyl(0.13,1.6, x-1.25,1.7,ff+0.7,'boiler','z');    // газовая рампа к горелке
      box(0.42,0.42,0.42, x-0.6,1.7,ff+0.85,'boiler');  // газовый клапан
      const cz=bz-1.85;                                 // ось газохода/трубы (за котлом)
      cyl(0.38,(H-3.4), x,(3.4+H)/2,cz,'flue','y');     // газоход вверх к трубе
      cyl(0.42,(chH-H), x,(H+chH)/2,cz,'chimney','y');  // дымовая труба-«сэндвич» над кровлей
      cyl(0.52,0.4, x,chH-0.15,cz,'chimney','y');       // оголовок (зонт) трубы
    }
    // газовый ввод (общий коллектор низкого давления) вдоль фронта котлов
    cyl(0.18, (bxs[nB-1]-bxs[0])+2.4, (bxs[0]+bxs[nB-1])/2, 2.7, bz+3.1, 'boiler','x');

    // ---- распределительные гребёнки (подающий / обратный коллекторы) --------
    const colLen=W*0.60;
    cyl(0.5, colLen, 0, 2.7, mz,      'pipes','x');      // подающий коллектор
    cyl(0.5, colLen, 0, 1.8, mz+0.95, 'pipes','x');      // обратный коллектор
    [-1,0,1].forEach(s=>box(0.3,2.7,0.3, s*colLen*0.34,1.35,mz+0.45,'pipes')); // опорные стойки
    const pxs=[-3.6,-1.2,1.2,3.6];
    pxs.forEach(px=>cyl(0.2,1.5, px,1.55,mz,'pipes','y'));  // отводы с фланцами вниз к насосам

    // ---- сетевые / подпиточные насосы (ряд «улитка + мотор») ----------------
    box(W*0.46,0.4,1.6, 0,0.2,fz,'base');               // общий фундамент насосной группы
    pxs.forEach(px=>{ box(0.95,0.85,0.8, px,0.75,fz,'pump');  // корпус-улитка насоса
      cyl(0.32,1.3, px,1.15,fz+0.25,'pump','z');        // эл.двигатель
      cyl(0.16,1.1, px,1.7,fz-0.45,'pump','y'); });     // напорный патрубок к гребёнке

    // ---- пластинчатые теплообменники ГВС (пакет пластин в раме) -------------
    [5.3,6.6].forEach(x=>{ box(0.65,2.2,1.4, x,1.35,fz-0.6,'pipes');   // пакет пластин
      box(0.12,2.45,1.65, x-0.42,1.45,fz-0.6,'pipes');  // неподвижная плита
      box(0.12,2.45,1.65, x+0.42,1.45,fz-0.6,'pipes');  // прижимная плита
      cyl(0.05,1.05, x,2.45,fz-0.6,'pipes','x'); });    // стяжная шпилька

    // ---- водоподготовка (ХВО) у левого торца --------------------------------
    cyl(0.55,2.8, -12.0,1.6,2.0,'water','y');           // Na-катионитовый фильтр 1
    cyl(0.55,2.8, -10.4,1.6,2.0,'water','y');           // Na-катионитовый фильтр 2
    cyl(0.4,0.5,  -12.0,3.25,2.0,'water','y'); cyl(0.4,0.5, -10.4,3.25,2.0,'water','y'); // крышки фильтров
    box(1.4,1.4,1.4, -11.2,0.7,4.4,'water');            // солевой бак
    cyl(0.7,2.6, -9.0,1.5,4.7,'water','y');             // расширительный (мембранный) бак
    cyl(1.0,4.0, -10.5,4.4,-3.4,'water','x');           // деаэратор: бак-аккумулятор (на отметке)
    cyl(0.45,1.8, -10.5,6.1,-3.4,'water','y');          // деаэрационная колонка
    box(0.3,4.2,0.3, -12.2,2.1,-3.4,'water'); box(0.3,4.2,0.3, -8.8,2.1,-3.4,'water'); // опоры деаэратора

    // ---- автоматика (КИПиА) + узел учёта газа (ГРУ) у правого торца ----------
    [-1.2,0,1.2].forEach(z=>box(0.5,2.0,0.95, 12.4,1.3,z,'panel')); // шкафы КИПиА
    box(1.7,1.9,1.1, 10.9,0.95,3.6,'panel');            // ГРУ (учёт/редуцирование газа)

    // ---- магистральные трубопроводы под кровлей -----------------------------
    cyl(0.22, W*0.8, 0, H-0.9, mz+0.5,'pipes','x');     // главная магистраль под потолком
    cyl(0.22, 4.6, -W*0.30, H-0.9, fz*0.4,'pipes','z'); // спуск к насосам/ХВО
    cyl(0.22, 3.6,  W*0.30, H-0.9, fz*0.4,'pipes','z'); // спуск к теплообменникам
  }

  // Теплоэлектроцентраль (ТЭЦ): главный корпус (котлы + турбоагрегаты),
  // дымовая труба, башенные градирни, трансформаторы и ОРУ. Красным светится
  // паротепловой контур (котлы → турбины → труба), голубым — электрика/охлаждение.
  // Компоновка по реальному главному корпусу ТЭЦ: высокое котельное отделение (тыл)
  // + более низкий машинный зал с фонарём (фронт) + бункерно-деаэраторная этажерка
  // между ними; газоходы котлов через дымососы к трубе с боровом; баки-аккумуляторы;
  // градирни с бассейнами и циркводоводами; два ряда порталов ОРУ; теплотрасса
  // Т1/Т2 на П-образных опорах с компенсаторами уходит к городу.
  genPowerPlant(box, cyl, frustum, b){
    const hx=b.hallX!=null?b.hallX:-8, hW=b.hallW||30, hH=b.hallHeight||12, hD=b.hallDepth||15;
    const chH=b.chimneyHeight||40, nB=b.boilers||2;
    const bH=hH*1.5;                                        // котельное отделение выше машзала
    box(hW+2,0.5,hD*1.7, hx,-0.25,-hD*0.12,'base');         // фундаментная плита корпуса
    // машинный зал (фронт, ниже) + котельное отделение (тыл, выше)
    box(hW,hH,hD*0.62, hx,hH/2, hD*0.19,'shell');
    box(hW,0.5,hD*0.62, hx,hH+0.25, hD*0.19,'roof');
    box(hW,bH,hD*0.55, hx,bH/2,-hD*0.36,'shell');
    box(hW,0.5,hD*0.55, hx,bH+0.25,-hD*0.36,'roof');
    // световой фонарь машзала + ряд оконных проёмов фасада
    box(hW*0.9,0.9,1.6, hx,hH+0.9,hD*0.19,'roof');
    for(let k=0;k<8;k++){ box(1.6,2.2,0.14, hx-hW/2+(k+0.5)*hW/8, hH*0.55, hD*0.5,'shell'); }
    // бункерно-деаэраторная этажерка + деаэраторы (горизонтальные баки с колонками)
    box(hW*0.86,1.0,2.4, hx, hH+1.2, -hD*0.06,'shell');
    for(let i=0;i<nB;i++){ const x=hx-hW*0.28 + i*hW*0.40;
      cyl(1.05,6.5, x, hH+2.4, -hD*0.06,'boiler','x');
      cyl(0.5,1.4,  x, hH+3.6, -hD*0.06,'boiler','y'); }
    // котлоагрегаты: каркас + барабан + горелка + газоход вниз к дымососу
    const bX=[]; for(let i=0;i<nB;i++){ const x=hx-hW*0.28 + i*hW*0.40; bX.push(x);
      box(4.8,bH*0.75,4.6, x,bH*0.375,-hD*0.36,'boiler');
      cyl(1.0,4.4, x,bH*0.78,-hD*0.36,'boiler','x');
      box(1.3,1.3,1.0, x,3.4,-hD*0.36+2.7,'boiler');
      box(1.6,1.6,3.2, x,bH*0.55,-hD*0.62,'boiler');
      box(2.0,2.2,2.0, x,1.1,-hD*0.78,'exhaust');           // дымосос
      cyl(0.55,3.0, x,1.4,-hD*0.9,'exhaust','z'); }         // напорный короб к борову
    // турбоагрегаты: турбина + генератор + конденсатор; подкрановая балка машзала
    bX.forEach(x=>{ cyl(1.4,5.0, x-1.2,2.3,hD*0.22,'turbine','x'); cyl(1.1,3.2, x+2.4,2.3,hD*0.22,'generator','x'); box(2.6,1.6,4.2, x-1.2,0.9,hD*0.22,'cooling'); });
    box(hW*0.92,0.6,0.8, hx,hH-1.0,hD*0.19,'shell');
    // дымовая труба: боров у основания, ствол, оголовок, маркерные пояса
    const cx0=hx-3, cz0=-hD*1.05;
    box(3.0,2.0,3.2, cx0,1.0,cz0,'exhaust');
    cyl(1.5, chH, cx0, chH/2, cz0, 'chimney','y');
    cyl(1.62,0.7, cx0, chH-0.35, cz0,'chimney','y');
    [0.35,0.62,0.88].forEach(f=>cyl(1.56,0.35, cx0, chH*f, cz0,'chimney','y'));
    // баки-аккумуляторы горячей воды у торца корпуса
    [[hx-hW/2-4.5,0],[hx-hW/2-4.5,6]].forEach(([x,dz])=>{ cyl(2.4,9, x,4.5,-hD*0.1+dz,'boiler','y'); cyl(2.5,0.4, x,9.1,-hD*0.1+dz,'boiler','y'); });
    // пристройка ХВО/насосной у противоположного торца
    box(6,4.5,6, hx+hW/2+3.5,2.25,hD*0.12,'shell'); box(6,0.4,6, hx+hW/2+3.5,4.7,hD*0.12,'roof');
    // градирни: гиперболоид + водосборный бассейн + циркводовод от корпуса
    (b.towers||[24,36]).forEach(x=>{ frustum(3.6,6.2,18, x,9,-1,'cooling'); frustum(4.8,3.6,10, x,23,-1,'cooling');
      cyl(7.0,1.0, x,0.5,-1,'cooling','y');
      cyl(0.5,(x-(hx+hW/2))+2, (x+hx+hW/2)/2,1.2,1.5,'cooling','x'); });
    // трансформаторы (блочные) + вводы-изоляторы
    [hx-9,hx-3,hx+3].forEach(x=>{ box(2.4,2.4,2.6, x,1.4,hD*0.62,'elec'); [-0.7,0,0.7].forEach(o=>cyl(0.16,1.3, x+o,3.1,hD*0.62,'elec','y')); });
    // ОРУ 110кВ: два ряда порталов, сборные шины обоих рядов, опорные изоляторы
    const oz=hD*0.66;
    [hx+8,hx+14,hx+20].forEach(x=>[0,5].forEach(dz=>{ box(0.3,8,0.3, x-1.7,4,oz+dz,'elec'); box(0.3,8,0.3, x+1.7,4,oz+dz,'elec'); box(3.8,0.3,0.3, x,8,oz+dz,'elec'); }));
    [6.6,7.3,8.0].forEach(y=>{ cyl(0.12, 16, hx+14, y, oz, 'elec','x'); cyl(0.12, 16, hx+14, y, oz+5, 'elec','x'); });
    for(let k=0;k<6;k++){ const x=hx+7+k*2.6; box(0.22,1.6,0.22, x,0.8,oz+2.5,'elec'); cyl(0.14,0.9, x,2.0,oz+2.5,'elec','y'); }
    // теплотрасса в город: Т1/Т2 DN500 на П-образных опорах + сильфонные компенсаторы
    const tz=hD*0.95, tx0=hx+hW*0.30, tx1=tx0+34;
    cyl(0.5,(tx1-tx0), (tx0+tx1)/2, 2.6, tz,     'heatmain','x');
    cyl(0.5,(tx1-tx0), (tx0+tx1)/2, 2.6, tz+1.4, 'heatmain','x');
    for(let k=0;k<6;k++){ const x=tx0+2+k*6;
      box(0.28,2.6,0.28, x,1.3,tz-0.8,'heatmain'); box(0.28,2.6,0.28, x,1.3,tz+2.2,'heatmain'); box(0.34,0.3,3.4, x,2.55,tz+0.7,'heatmain'); }
    [tz,tz+1.4].forEach(z=>cyl(0.62,1.6, tx0+16, 2.6, z,'heatmain','x'));
    cyl(0.5,3.2, tx0-1.4,1.3,tz,'heatmain','y');            // стояк выхода из корпуса
  }

  // Центральный тепловой пункт (ЦТП) — независимая схема присоединения квартала:
  // ввод теплосети (первичный контур) с грязевиками, задвижками и узлом учёта →
  // пластинчатые теплообменники (отопление + ГВС двухступенчатые) → распределительные
  // коллекторы вторичного контура → потребители; насосные группы (циркуляционные
  // отопления/ГВС, повысительные ХВС), ХВС и подпитка (мембранные баки), автоматика
  // и регуляторы. Красным светится тепловой контур (ввод сети, теплообменники,
  // подающие коллекторы), голубым — насосы, ХВС и КИПиА.
  genCTP(box, cyl, b){
    const W=b.width||20, H=b.height||6, D=b.depth||12;
    const back=-D*0.30, mid=-D*0.02, front=D*0.32;

    // ---- ограждающие конструкции -------------------------------------------
    box(W*1.03,0.5,D*1.04, 0,-0.25,0,'base');            // фундаментная плита
    box(W,H,D, 0,H/2,0,'shell');                          // здание ЦТП (отдельно стоящее)
    box(W,0.5,D, 0,H+0.25,0,'roof');                      // кровля
    box(W*1.02,0.55,D*1.02, 0,H+0.45,0,'roof');           // парапет
    box(2.0,2.3,0.16, W*0.34,1.15,D/2,'base');            // ворота/дверь (фронт)

    // ---- ввод теплосети (первичный контур) — задняя стена, левый торец -------
    const ix=-W*0.40;
    cyl(0.4,4.4, -W/2+2.2,1.7,back-1.1,'input','x');      // подающий T1 из теплосети
    cyl(0.4,4.4, -W/2+2.2,1.7,back+1.1,'input','x');      // обратный T2 в теплосеть
    [-1.1,1.1].forEach(dz=>{                              // грязевики + задвижки на вводе
      cyl(0.5,1.9, ix,1.35,back+dz,'input','y');          // грязевик (шламоуловитель)
      cyl(0.32,0.5, ix,2.4,back+dz,'input','y');          // фланец грязевика
      box(0.5,0.5,0.5, ix+1.5,1.7,back+dz,'input');       // задвижка
      cyl(0.34,0.12, ix+1.5,2.25,back+dz,'input','y'); });// штурвал задвижки
    box(0.75,1.7,0.55, ix+2.7,1.05,back,'input');         // шкаф узла учёта тепла (теплосчётчик)
    cyl(0.17,1.0, ix+3.4,1.45,back+1.1,'input','x');      // расходомер на обратном трубопроводе

    // ---- пластинчатые теплообменники (пакеты пластин в раме) ----------------
    // отопление (большой) + ГВС двухступенчатые (I и II ступень)
    [[-2.0,2.8,2.6],[1.4,2.2,2.1],[3.9,2.2,2.1]].forEach(([x,ht,w])=>{
      box(1.2,ht,w, x,ht/2+0.3,back+0.3,'hx');            // пакет пластин
      box(0.14,ht+0.3,w+0.25, x-0.66,ht/2+0.35,back+0.3,'hx');  // неподвижная плита
      box(0.14,ht+0.3,w+0.25, x+0.66,ht/2+0.35,back+0.3,'hx');  // прижимная плита
      cyl(0.05,1.6, x,ht+0.55,back+0.3,'hx','x'); });     // верхняя стяжная шпилька

    // ---- распределительные коллекторы (гребёнки вторичного контура) — центр --
    const cLen=W*0.6;
    cyl(0.42,cLen, 0,2.4,mid,      'manif','x');          // подающий коллектор (в здания)
    cyl(0.42,cLen, 0,1.5,mid+0.95, 'manif','x');          // обратный коллектор
    [-1,0,1].forEach(s=>box(0.28,2.4,0.28, s*cLen*0.32,1.2,mid+0.45,'manif')); // опорные стойки
    const pxs=[-3.0,-0.6,1.8,4.2];
    pxs.forEach(px=>cyl(0.16,1.4, px,1.35,mid,'manif','y'));  // отводы к насосам/потребителям

    // ---- насосные группы (циркуляц. отопления/ГВС, повысительные) — фронт ----
    box(W*0.5,0.4,1.6, 0,0.2,front,'base');              // общий фундамент насосной группы
    pxs.forEach(px=>{ box(0.85,0.8,0.75, px,0.7,front,'pump');   // корпус-улитка насоса
      cyl(0.3,1.2, px,1.05,front+0.25,'pump','z');       // эл.двигатель насоса
      cyl(0.15,1.0, px,1.55,front-0.4,'pump','y'); });   // напорный патрубок к коллектору

    // ---- ХВС и подпитка (холодный контур) — левый фронт ----------------------
    cyl(0.5,2.6, -W*0.40,    1.5,front-0.4,'cold','y');   // мембранный расширительный бак 1
    cyl(0.5,2.6, -W*0.40+1.3,1.5,front-0.4,'cold','y');   // мембранный расширительный бак 2
    box(0.6,1.3,0.5, -W*0.40+2.6,0.85,front-0.4,'cold');  // водомерный узел ХВС
    cyl(0.14,3.0, -W*0.40+1.3,2.9,front-0.4,'cold','x');  // ввод холодной воды (коллектор ХВС)
    box(0.8,0.7,0.7, -W*0.40+0.6,0.55,front+0.9,'cold');  // подпиточный насос

    // ---- автоматика и регуляторы — правый торец ------------------------------
    [-1.2,0,1.2].forEach(z=>box(0.45,1.9,0.9, W*0.42,1.15,z,'auto')); // шкафы АСУ/АИТП
    box(0.4,0.4,0.4, 1.4,2.65,back+0.3,'auto');          // регулятор перепада давления
    [1.4,3.9].forEach(x=>box(0.32,0.55,0.32, x,2.75,back+0.3,'auto')); // регулирующие клапаны с эл.приводами

    // ---- магистральные трубопроводы под кровлей -----------------------------
    cyl(0.2,W*0.82, 0,H-0.8,mid+0.4,'manif','x');        // главная подающая магистраль
    cyl(0.2,3.2, -W*0.30,H-0.8,0,'input','z');           // спуск от ввода к теплообменникам
    cyl(0.2,3.0,  W*0.30,H-0.8,0,'cold','z');            // трасса ХВС/подпитки
  }

  // Declarative-geometry interpreter. CONFIG.geometry items (model coords, metres):
  //   { "box":     [sx,sy,sz, cx,cy,cz, "mat"] }
  //   { "cyl":     [r,h, cx,cy,cz, "mat", "x"|"y"|"z"?] }      (axis default "y")
  //   { "frustum": [rT,rB,h, cx,cy,cz, "mat"] }
  //   { "at":[dx,dy,dz]?, "repeat":n?, "step":[sx,sy,sz]?, "items":[…] }  — group,
  //     items repeated n times with the offset advancing by step; groups nest.
  // Material names map to systems via matRules, exactly like the named generators.
  genDeclarative(box, cyl, frustum, items, ox, oy, oz){
    items.forEach(it=>{
      if(Array.isArray(it.items)){
        const at=it.at||[0,0,0], n=it.repeat||1, st=it.step||[0,0,0];
        for(let i=0;i<n;i++) this.genDeclarative(box,cyl,frustum,it.items, ox+at[0]+st[0]*i, oy+at[1]+st[1]*i, oz+at[2]+st[2]*i);
      }
      else if(it.box){ const a=it.box; box(a[0],a[1],a[2], ox+a[3],oy+a[4],oz+a[5], a[6]); }
      else if(it.cyl){ const a=it.cyl; cyl(a[0],a[1], ox+a[2],oy+a[3],oz+a[4], a[5], a[6]||'y'); }
      else if(it.frustum){ const a=it.frustum; frustum(a[0],a[1],a[2], ox+a[3],oy+a[4],oz+a[5], a[6]); }
    });
  }
