  // ---- procedural buildings (no GLB) ---------------------------------------
  // Здесь остался ТОЛЬКО жилой дом: он параметрический, потому что план этажа и
  // разрез фасада (50-plans.js) питаются planRooms, которые заполняет эта ветка.
  // Станции (ЦТП, котельная, ТЭЦ, ВНС, водозабор) строились такими же хардкод-
  // генераторами и 19.08.2026 переведены на CAD-путь: свой tools/gen-<имя>.js →
  // декларативный geometry (ветка ниже) → все линтеры blueprint/floaters/flowcheck.
  // Их генераторы удалены как недостижимые — история в коммите «Станции ЖКХ…».
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

    // raw emitter for the declarative interpreter (it builds its own matrices)
    const push=(g,m,mat)=>{ md.push({name:mat,mat,geometry:g,matrixWorld:m}); };

    // Declarative geometry: the object is described as DATA in the config
    // (list of primitives / repeat-groups) — new facilities need no engine code.
    // ⚠ Декларация и building{} СОВМЕСТИМЫ и складываются: у станций building нет,
    // и на этом мы выходим, а жилому дому декларацией добавляется подвал с вводами
    // и разводкой. Так подвал попадает под линтеры (blueprint/floaters/flowcheck),
    // которые читают config.geometry, а параметрический дом сохраняет planRooms.
    if(Array.isArray(this.CONFIG.geometry) && this.CONFIG.geometry.length){
      this.genDeclarative(THREE,push,this.CONFIG.geometry,new THREE.Matrix4());
      if(!this.CONFIG.building) return;
    }

    box(W*1.03, 0.5, D*1.04, 0, -0.25, 0, 'base');                                 // цоколь / плита
    box(W, H, D, 0, H/2, 0, 'shell');                                              // несущая оболочка
    for(let f=1; f<floors; f++) box(W*1.002, 0.10, D*1.002, 0, f*fh, 0, 'slab');   // междуэтажные перекрытия
    for(let s=1; s<sections; s++) box(0.14, H, D, -W/2 + s*sw, H/2, 0, 'wall');    // межсекционные стены
    box(W, 0.5, D, 0, H+0.25, 0, 'roof'); box(W*1.02, 0.7, D*1.02, 0, H+0.35, 0, 'roof'); // кровля + парапет
    box(W*1.05, 0.12, D*1.06, 0, 0.06, 0, 'base');                                // отлив цоколя
    box(W*1.03, 0.28, D*1.03, 0, H-0.16, 0, 'seam');                              // карниз под кровлей
    for(let s=0; s<=sections; s++){                                               // простенки-пилястры по границам секций
      const px=-W/2 + s*sw + (s===0?0.22:(s===sections?-0.22:0));
      box(0.44, H, 0.10, px, H/2, D/2+0.03, 'seam');
      box(0.44, H, 0.10, px, H/2, -D/2-0.03, 'seam');
    }

    const winW=Math.min(1.4, sw/(winCols+1.2)), winH=fh*0.5, step=sw/(winCols+0.4);
    // Окно — не плоская нашлёпка: стеклопакет + УТОПЛЕННАЯ коробка вокруг него даёт
    // в контурном пассе вторую рамку, и проём начинает читаться проёмом. На лицевом
    // фасаде добавляются импост (деление на створки) и отлив — они и делают ряды
    // окон «чёткими» с расстояния, на котором сам стеклопакет уже не разобрать.
    const okno=(cx,cy,z,sgn)=>{
      box(winW, winH, 0.08, cx, cy, z, 'window');                                   // стеклопакет
      box(winW+0.20, winH+0.20, 0.05, cx, cy, z - sgn*0.05, 'window');              // оконная коробка
      if(sgn>0){
        box(0.06, winH, 0.11, cx, cy, z + sgn*0.02, 'window');                      // импост
        box(winW+0.26, 0.05, 0.17, cx, cy - winH/2 - 0.06, z + sgn*0.06, 'window'); // отлив
      }
    };
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
            else okno(cx, cy, D/2, 1);
            okno(cx, cy, -D/2, -1);
            continue;
          }
          okno(cx, cy, D/2, 1);    // лицевой фасад
          okno(cx, cy, -D/2, -1);  // тыльный фасад
        }
      }
    }

    // простенки МЕЖДУ окнами: вертикальный ритм — то, чем панельный фасад
    // читается с расстояния, на котором сами окна уже сливаются в сетку
    for(let s=0; s<sections; s++){
      const scx=-W/2 + (s+0.5)*sw;
      for(let c=0; c<winCols-1; c++){
        const px=scx + (c+0.5-(winCols-1)/2)*step;
        box(Math.max(0.18, step-winW-0.24), H, 0.07, px, H/2, D/2+0.02, 'seam');
        box(Math.max(0.18, step-winW-0.24), H, 0.07, px, H/2, -D/2-0.02, 'seam');
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

    // ---- фасад и кровля в деталях -------------------------------------------
    // Дом из объёма с окошками читался коробкой: узнаваемость панельного МКД
    // держится не на габарите, а на межпанельных швах, ограждениях лоджий,
    // входных группах с крыльцом и козырьком и на «хозяйстве» кровли —
    // ограждение, вентшахты, машинное помещение лифта, водосточные трубы.
    const seamZ=[D/2+0.02, -D/2-0.02];
    for(let f=1; f<floors; f++)                                                    // горизонтальные швы панелей
      seamZ.forEach(z=>box(W*1.004, 0.07, 0.05, 0, f*fh, z, 'seam'));
    const seamStep=Math.max(2.6, sw/Math.max(1,Math.round(sw/3.2)));
    for(let x=-W/2+seamStep; x<W/2-0.1; x+=seamStep)                               // вертикальные швы панелей
      seamZ.forEach(z=>box(0.05, H, 0.07, x, H/2, z, 'seam'));

    for(let s=0; s<sections; s++){
      const scx=-W/2 + (s+0.5)*sw;
      const ecx=scx + (((winCols-1)/2|0)-(winCols-1)/2)*step;                      // ось входной группы

      // входная группа: крыльцо со ступенями, пандус с поручнем, козырёк на
      // кронштейнах, светильник и номерной знак
      box(2.6, 0.30, 1.5, ecx, 0.15, D/2+0.75, 'entrance');                        // площадка крыльца
      for(let k=0;k<3;k++) box(2.6, 0.15, 0.30, ecx, 0.075+k*0.15, D/2+1.5+k*0.30, 'entrance');
      box(1.0, 0.12, 2.2, ecx+1.7, 0.35, D/2+1.6, 'entrance');                  // пандус
      box(0.06, 0.85, 2.2, ecx+1.25, 0.85, D/2+1.6, 'entrance');                   // поручень пандуса
      box(0.06, 0.85, 2.2, ecx+2.15, 0.85, D/2+1.6, 'entrance');
      box(0.12, 0.9, 0.12, ecx-1.2, 2.0, D/2+0.35, 'entrance');                    // кронштейны козырька
      box(0.12, 0.9, 0.12, ecx+1.2, 2.0, D/2+0.35, 'entrance');
      box(0.30, 0.22, 0.18, ecx, 2.62, D/2+0.12, 'entrance');                      // светильник над дверью
      box(0.34, 0.24, 0.03, ecx-1.0, 2.35, D/2+0.10, 'entrance');                  // номер дома
      box(0.18, 0.26, 0.06, ecx+0.85, 1.45, D/2+0.12, 'entrance');                 // домофон

      // ограждения лоджий: экран, поручень, боковые щёки
      const lcx=scx + ((winCols-1)-(winCols-1)/2)*step, lw=step*0.92;
      for(let f=1; f<floors; f++){
        const by=f*fh;
        box(lw, 0.95, 0.06, lcx, by+0.60, D/2+0.55, 'balcony');                    // экран ограждения
        box(lw, 0.08, 0.10, lcx, by+1.12, D/2+0.55, 'balcony');                    // поручень
        box(0.06, 0.95, 0.55, lcx-lw/2, by+0.60, D/2+0.28, 'balcony');             // щёки
        box(0.06, 0.95, 0.55, lcx+lw/2, by+0.60, D/2+0.28, 'balcony');
      }

      // кровля: машинное помещение лифта над ядром, выход на кровлю, вентшахты
      box(3.2, 2.4, 3.0, scx, H+1.7, -D*0.20, 'roof');                             // машинное помещение
      box(3.4, 0.22, 3.2, scx, H+2.98, -D*0.20, 'roof');                           // его кровля
      box(1.0, 2.1, 0.10, scx+1.65, H+1.55, -D*0.20, 'roof');                      // дверь выхода на кровлю
      for(let k=0;k<2;k++) box(0.55, 1.0, 0.55, scx-1.3+k*2.6, H+1.0, D*0.18, 'roof');   // вентшахты
      for(let k=0;k<2;k++) box(0.75, 0.10, 0.75, scx-1.3+k*2.6, H+1.55, D*0.18, 'roof'); // зонты вентшахт
    }

    // ограждение кровли по периметру: стойки с шагом ~3 м + два поручня
    const rY=H+0.7, rStep=3.0;
    for(let x=-W/2+0.6; x<=W/2-0.5; x+=rStep){
      box(0.07, 1.0, 0.07, x, rY+0.5, D/2+0.02, 'roof');
      box(0.07, 1.0, 0.07, x, rY+0.5, -D/2-0.02, 'roof');
    }
    for(let z=-D/2+1.0; z<=D/2-0.9; z+=rStep){
      box(0.07, 1.0, 0.07, W/2+0.02, rY+0.5, z, 'roof');
      box(0.07, 1.0, 0.07, -W/2-0.02, rY+0.5, z, 'roof');
    }
    [[W*1.03,0.06,0.06, 0, rY+1.0, D/2+0.02],[W*1.03,0.06,0.06, 0, rY+1.0, -D/2-0.02],
     [W*1.03,0.05,0.05, 0, rY+0.55, D/2+0.02],[W*1.03,0.05,0.05, 0, rY+0.55, -D/2-0.02],
     [0.06,0.06,D*1.02, W/2+0.02, rY+1.0, 0],[0.06,0.06,D*1.02, -W/2-0.02, rY+1.0, 0],
     [0.05,0.05,D*1.02, W/2+0.02, rY+0.55, 0],[0.05,0.05,D*1.02, -W/2-0.02, rY+0.55, 0],
    ].forEach(a=>box(a[0],a[1],a[2],a[3],a[4],a[5],'roof'));
    box(0.05, 3.2, 0.05, -W/2+1.2, H+2.3, -D/2+1.2, 'roof');                       // молниеприёмники
    box(0.05, 3.2, 0.05,  W/2-1.2, H+2.3, -D/2+1.2, 'roof');

    // водосточные трубы по границам секций: воронка, ствол, отмёт
    for(let s=0; s<=sections; s++){
      const x=-W/2 + s*sw + (s===0?0.35:(s===sections?-0.35:0));
      [D/2+0.14, -D/2-0.14].forEach(z=>{
        cyl(0.09, H-0.5, x, (H-0.5)/2, z, 'roof', 'y');
        cyl(0.16, 0.28, x, H-0.15, z, 'roof', 'y');                                // воронка
        cyl(0.09, 0.45, x, 0.30, z + (z>0?0.18:-0.18), 'roof', 'z');               // отмёт
      });
    }

    // цоколь: приямки подвальных окон и продухи
    for(let x=-W/2+1.8; x<W/2-1.0; x+=Math.max(3.2, sw/2)){
      box(1.1, 0.5, 0.10, x, -0.05, D/2+0.02, 'base');                             // приямок
      box(0.9, 0.35, 0.06, x, -0.02, D/2+0.10, 'window');                          // подвальное окно
      box(0.35, 0.22, 0.08, x+1.6, 0.12, -D/2-0.02, 'base');                       // продух
    }
  }

  // Declarative-geometry interpreter. CONFIG.geometry items (model coords, metres;
  // "rot" in DEGREES, applied about the item's own centre / the group's origin):
  //   { "box":     [sx,sy,sz, cx,cy,cz, "mat"],  "rot":[rx,ry,rz]? }
  //   { "cyl":     [r,h, cx,cy,cz, "mat", "x"|"y"|"z"?, seg?] }   (axis default "y")
  //   { "frustum": [rT,rB,h, cx,cy,cz, "mat", "x"|"y"|"z"?] }
  //   { "sphere":  [r, cx,cy,cz, "mat", seg?] }
  //   { "torus":   [R,tube, cx,cy,cz, "mat", "x"|"y"|"z"?] }      (axis = ring normal)
  //   { "capsule": [r,h, cx,cy,cz, "mat", "x"|"y"|"z"?] }
  //   { "tube":    [r, [[x,y,z],…], "mat", seg?] }   Catmull-Rom по точкам — рукава/шланги
  //   { "at":[dx,dy,dz]?, "rot":[rx,ry,rz]?, "repeat":n?, "step":[dx,dy,dz]?,
  //     "rstep":[rx,ry,rz]?, "items":[…] }  — group: items repeated n times, offset
  //     advancing by step and rotation by rstep; transforms nest (parent × child).
  // Material names map to systems via matRules, exactly like the named generators.
  genDeclarative(THREE, push, items, base){
    const D=Math.PI/180;
    // base × translate(c) × rotate(rot) — вращение вокруг СОБСТВЕННОГО центра детали
    const trs=(cx,cy,cz,rot)=>{
      const m=new THREE.Matrix4().makeTranslation(cx,cy,cz);
      if(rot) m.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0]*D,rot[1]*D,rot[2]*D,'XYZ')));
      return base.clone().multiply(m);
    };
    // тела вращения three смотрят по Y; доворот до x/z — ПОСЛЕ пользовательского rot,
    // чтобы rot читался как наклон уже уложенной по оси детали
    const axisM=(m,axis)=>{ if(axis==='x') m.multiply(new THREE.Matrix4().makeRotationZ(Math.PI/2));
                            else if(axis==='z') m.multiply(new THREE.Matrix4().makeRotationX(Math.PI/2)); return m; };
    // тор лежит в плоскости XY (нормаль кольца = Z) — приводим к запрошенной оси
    const ringM=(m,axis)=>{ if(axis==='x') m.multiply(new THREE.Matrix4().makeRotationY(Math.PI/2));
                            else if(axis!=='z') m.multiply(new THREE.Matrix4().makeRotationX(Math.PI/2)); return m; };
    items.forEach(it=>{
      const r=it.rot;
      if(Array.isArray(it.items)){
        const at=it.at||[0,0,0], n=it.repeat||1, st=it.step||[0,0,0], rs=it.rstep;
        for(let i=0;i<n;i++){
          const rot=(r||rs) ? [(r?r[0]:0)+(rs?rs[0]*i:0), (r?r[1]:0)+(rs?rs[1]*i:0), (r?r[2]:0)+(rs?rs[2]*i:0)] : null;
          this.genDeclarative(THREE, push, it.items, trs(at[0]+st[0]*i, at[1]+st[1]*i, at[2]+st[2]*i, rot));
        }
        return;
      }
      if(it.box){ const a=it.box;
        push(new THREE.BoxGeometry(a[0],a[1],a[2]), trs(a[3],a[4],a[5],r), a[6]); }
      else if(it.cyl){ const a=it.cyl;
        push(new THREE.CylinderGeometry(a[0],a[0],a[1],a[7]||14,1), axisM(trs(a[2],a[3],a[4],r),a[6]), a[5]); }
      else if(it.frustum){ const a=it.frustum;
        push(new THREE.CylinderGeometry(a[0],a[1],a[2],16,1), axisM(trs(a[3],a[4],a[5],r),a[7]), a[6]); }
      else if(it.sphere){ const a=it.sphere;
        push(new THREE.SphereGeometry(a[0],a[5]||16,(a[5]||16)>>1), trs(a[1],a[2],a[3],r), a[4]); }
      else if(it.torus){ const a=it.torus;
        push(new THREE.TorusGeometry(a[0],a[1],10,24), ringM(trs(a[2],a[3],a[4],r),a[6]), a[5]); }
      else if(it.capsule){ const a=it.capsule;
        push(new THREE.CapsuleGeometry(a[0],a[1],6,14), axisM(trs(a[2],a[3],a[4],r),a[6]), a[5]); }
      else if(it.tube){ const a=it.tube;
        const curve=new THREE.CatmullRomCurve3(a[1].map(p=>new THREE.Vector3(p[0],p[1],p[2])));
        push(new THREE.TubeGeometry(curve,a[3]||24,a[0],10,false), trs(0,0,0,r), a[2]); }
    });
  }
