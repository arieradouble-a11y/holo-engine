'use strict';
// Join traced architecture to the museum's existing engineering vocabulary.
// Architecture remains source-derived; utilities are an explicitly educational
// layer, never an assertion about the installations of a particular address.
const H = require('./house-kit');
const P = require('./plant-kit');
const materialIndex = {box:6,cyl:5,frustum:6,sphere:4,torus:5,capsule:5,tube:2};
const round = x => +x.toFixed(6);

module.exports = function museumHouse(c, id) {
  const courtyard = id === 'plan-brusnika-2019';
  const stove = id === 'plan-228';
  const modern = courtyard || id === 'plan-gp18';
  const b = c.building;
  // In the courtyard house, only section 1 has a detailed teaching interior.
  // Do not invent a basement slab across the open courtyard.
  const sw = courtyard ? 27.6 : b.sectionWidth;
  const sections = courtyard ? 1 : b.sections;
  const W = sections * sw, D = courtyard ? 17.25 : b.depth;
  const floors = courtyard ? 9 : b.floors, FH = b.floorHeight;
  const levels = Array.from({length:floors}, (_,f) => modern && f ? 3.3+(f-1)*FH : f*FH);
  const top = levels.at(-1) + FH;
  const yFloor = -2.9, yCeil = -.2, yW = -1.62, yH = -.92, yR = -1.23, yK = -2.42;
  const zW = -D*.30+.42, zH = -D*.30, zRis = -D*.16, zKan = zRis+.55;
  const xWall = -W/2-.65, xMeter = -W/2+2.5;
  const G = c.geometry, rawNodes = [], rawFlows = [];
  // Later external meters/manholes must not shrink or pollute a floor plan.
  // Multi-section studies already have their source bounds; whole-floor
  // studies acquire bounds from their architectural geometry before utilities.
  if(!c.floorStudy.planBounds){
    const a=P.measure(G);
    c.floorStudy.planBounds={x:(a.min[0]+a.max[0])/2,z:(a.min[2]+a.max[2])/2,
      width:a.size[0]+.02,depth:a.size[2]+.02};
    c.floorStudy.wholeFloor=true;
  }
  const box = (w,h,d,x,y,z,mat) => G.push({box:[w,h,d,x,y,z,mat]});
  const pipe = (points,r,mat) => G.push(...P.pipe(points,r,mat,10));
  const node = (name,at,desc) => rawNodes.push({name,at,desc});
  const flow = (kind,color,at,count=6) => rawFlows.push({kind,color,at,count,speed:.07});

  // One functional part per museum system, as in mkd-121/mkd-p44/zhk.
  const materials = {
    wall:'konstr',walls:'konstr',envelope:'konstr',base:'konstr',slab:'konstr',
    foundation:'konstr',ground:'konstr',massing:'konstr',courtyard:'konstr',
    window:'facade',windows:'facade',frames:'facade',terrace:'facade',
    balcony:'facade',balconies:'facade',loggia:'facade',loggias:'facade',
    partition:'interior',partitions:'interior',party:'interior',door:'interior',
    kitchen:'interior',sanitary:'interior',wet:'interior',living:'interior',polati:'interior',
    stair:'core',core:'core',lift:'core',riser:'core',
    roof:'roof',houseRoof:'roof',parapet:'roof',entrance:'entrance',houseEntry:'entrance',
    stoves:'heating',flues:'heating',vents:'ventilation',
  };
  const mapped = new WeakSet();
  const remap = items => items.forEach(g => {
    if(mapped.has(g)) return;
    mapped.add(g);
    if (g.items) remap(g.items);
    for (const [type,mi] of Object.entries(materialIndex)) if(g[type]) {
      const a=g[type], old=a[mi];
      let key=materials[old] || materials[old.split('-')[0]];
      if (!key) throw new Error(`${id}: unmapped architectural material ${old}`);
      if(old==='houseEntry' && type==='box' && a[0]>sw*.8 && a[1]<1) key='konstr';
      a[mi]=key+'-'+old;
    }
  });
  remap(G);

  // Учебный этаж: середина диапазона плана. Здесь окна остаются с импостами,
  // на остальных этажах средний импост снимается — целый дом из трёх сотен
  // окон по пять коробок на проём в аддитивном каркасе читался сплошной сеткой,
  // за которой не видно ни стояков, ни разборки (замер 12.09: у ГП-18 окна
  // давали 3140 из 10140 примитивов, инженерия — 150).
  const rangeF=c.floorStudy.planFloorRange||[0,0], teachF=Math.floor((rangeF[0]+rangeF[1])/2);
  const lv=c.floorStudy.floorLevels;
  const bandLo=(lv?lv[teachF]:teachF*FH)-.05, bandHi=(lv?lv[teachF+1]:(teachF+1)*FH)+.05;
  const posts=[];
  const collect=(items,oy)=>items.forEach(g=>{
    if(g.items){collect(g.items,oy+((g.at&&g.at[1])||0));return;}
    const a=g.box; if(!a||!/^facade-/.test(a[6])) return;
    const post=(a[0]<=.06&&a[2]<=.10)||(a[2]<=.06&&a[0]<=.10);
    if(post&&a[1]>.5) posts.push({g,items,y:oy+a[4],x:a[3],z:a[5]});
  });
  collect(G,0);
  const k=v=>Math.round(v*50), byKey=new Map();
  for(const p of posts){
    for(const key of ['x|'+k(p.y)+'|'+k(p.z),'z|'+k(p.y)+'|'+k(p.x)]){
      let arr=byKey.get(key); if(!arr) byKey.set(key,arr=[]); arr.push(p);
    }
  }
  const drop=new Set();
  for(const [key,arr] of byKey){
    if(arr.length<3) continue;
    const ax=key[0]==='x'?'x':'z';
    arr.sort((a,b)=>a[ax]-b[ax]);
    for(let i=1;i<arr.length-1;i++){
      const dl=arr[i][ax]-arr[i-1][ax], dr=arr[i+1][ax]-arr[i][ax];
      if(Math.abs(dl-dr)<.03 && dl<1.6 && (arr[i].y<bandLo||arr[i].y>bandHi)) drop.add(arr[i].g);
    }
  }
  const prune=items=>{for(let i=items.length-1;i>=0;i--){const g=items[i]; if(g.items){prune(g.items);continue;} if(drop.has(g)) items.splice(i,1);}};
  prune(G);
  const teaching ='Инженерные трассы и оборудование показаны как учебная схема; архитектурные листы не подтверждают их фактическое исполнение в этом доме.';
  c.parts = [
    {key:'konstr',name:'Несущий остов и перекрытия',tag:'КОНСТРУКЦИИ',desc: courtyard ? 'Полный восьмисекционный дом вокруг двора: наружные контуры и перепады высоты по рабочему проекту 2019 года. Подробная планировка встроена в секцию 1.' : 'Цельный объём дома, наружные и межсекционные стены, поэтажные плиты и основание. Габариты и этажность взяты из указанных чертежей; состав конструкций и отдельные профили упрощены.'},
    {key:'facade',name:'Фасад, окна и балконы',tag:'ОБОЛОЧКА ДОМА',desc:'Оконные проёмы, балконы и лоджии помогают прочитать масштаб и ритм целого дома. Детальность фасадов соответствует доступным листам; мелкие профили обобщены.'},
    {key:'entrance',name:'Входы в подъезды',tag:'УРОВЕНЬ ЗЕМЛИ',desc:'Вход связывает улицу с общим лестничным узлом. Входные площадки и козырьки обозначены упрощённо. Размеры декоративных деталей не являются обмером.'},
    {key:'roof',name:stove?'Скатная кровля и чердак':'Кровля и верхнее перекрытие',tag:'ВЕРХ ДОМА',desc:stove?'Две плоскости скатной крыши, фронтоны, карнизы и чердачное перекрытие. Печные трубы выделены отдельно в системе отопления.':'Кровля завершает каждый объём здания. Разборка поднимает её над домом и открывает верхний этаж; перепады высоты сохранены по проекту.'},
    {key:'systems',name:'Инженерные стояки',tag:'ВЕРТИКАЛЬНЫЕ СВЯЗИ',desc:'Водопроводный, канализационный и электрический стояки'+(b.floors>=10?', а в высоком доме ещё и пожарный,':'')+' проходят через все этажи у лестничного узла. Вода поднимается к этажам, стоки опускаются к выпускам; стрелки показывают направление. '+teaching},
    {key:'podval',name:modern?'Подвал, вводы и ИТП':'Подполье и вводы сетей',tag:'ДОМ И ГОРОДСКИЕ СЕТИ',desc:(stove?'Ввод воды с водомерным узлом, канализационные лежаки и электрический щит. Центральное отопление здесь не добавлено: показан вариант дома с печами.':modern?'Ввод воды, узел учёта, теплообменник с насосом и электрический щит. Теплообменник разделяет сетевой теплоноситель и домовой контур.':'Ввод воды со счётчиком, тепловой узел, разводка под первым этажом, электрический щит и канализационные выпуски.')+' '+teaching},
    {key:'core',name:stove||id==='plan-467'?'Лестницы и площадки':'Лестницы и лифтовые шахты',tag:'ОБЩИЕ ПРОСТРАНСТВА',desc:'Вертикальный путь от входа к квартирным площадкам. Геометрия подробного узла сохранена по плану; в соседних секциях детализация ограничена доступными чертежами.'},
    {key:'interior',name:'Планировки квартир',tag:'ПЛАН ЭТАЖА',desc:'Перегородки, входы и помещения по исходному чертежу. При выборе системы, в разрезе и разборке подробно раскрыт один учебный этаж. «План этажа» показывает отдельный план с подписями и переключением доступных этажей.'},
    {key:'heating',name:stove?'Печи и дымовые каналы':'Отопление и разводка',tag:stove?'ПЕЧНОЕ ОТОПЛЕНИЕ':'ТЕПЛО В ДОМЕ',desc:stove?'Печи размещены по историческому плану. Они обогревают соседние комнаты; дымовые каналы уходят выше скатной кровли. Геометрия каналов и надкровельных частей упрощена.':'Подающая и обратная линии связывают тепловой узел с этажными приборами. В разрезе видны стояки и ответвления; движение теплоносителя показано стрелками. '+teaching},
    {key:'ventilation',name:'Вентиляционные каналы',tag:'ВОЗДУХООБМЕН',desc:'Вертикальные каналы соединяют этажи с вытяжными оголовками над кровлей. Показан принцип естественной вытяжки, без утверждения о фактической схеме конкретного адреса.'},
  ];
  c.matRules=c.parts.map((p,i)=>({match:[p.key],part:i}));
  c.defaultPart=0;
  Object.assign(c,{accent:'cyan',mode:'structured',source:'procedural',density:'high',
    hotParts:['systems','podval','heating','ventilation'],quietParts:['interior'],
    hotColor:[1,.58,.16],hotIntensity:1.9,hotAngle:44,contour:.72,fill:.34,shellOpacity:.30,
    reflect:.14,   // как у остальных домов музея; без отражения дом висел плоской коробкой
    bloom:{strength:.4,radius:.6,threshold:.15},badge:'ИНТЕРАКТИВНАЯ ГОЛОГРАММА',
    category:'ЖКХ · ЖИЛОЙ ФОНД · ДОМА РАЗНЫХ ЭПОХ',
    explodeDirs:{konstr:[0,0,0],facade:[0,0,2.4],entrance:[0,0,3],roof:[0,2.4,0],
      systems:[2.4,0,0],podval:[0,-2.2,0],core:[-2.4,0,0],interior:[0,0,-2.4],
      heating:[1.7,0,1.7],ventilation:[-1.7,0,-1.7]}});
  // Авторский ракурс (az .52 / el .38) оставлен: расчётный el 0.18 для дома
  // длиной 96 м прячет кровлю и стояки (сравнение кадров 12.09).

  G.push(...H.podval({W,D,sections,sw,yFloor,yCeil,zRis,mat:'konstr-basement',pit:false}));
  G.push(...H.vvodVody({x:xMeter,y:yW,z:zW,r:.075,xWall,mat:'podval-water'}));
  pipe([[xMeter+3.4,yW,zW],[W/2-1,yW,zW]],.075,'podval-water');
  G.push(...H.kanalizaciya({W,D,sections,sw,yFloor,yK,zKan,rKan:.075,rOut:.10,mat:'podval-sewer'}));
  G.push(...H.vru({x:xMeter+1,z:D*.22,yFloor,yCeil,W,zRis,mat:'podval-electric'}));
  // The separate meter cabinet is wall-mounted; this backing rail joins it
  // to the main cabinet instead of leaving two small floating bodies.
  box(.8,.07,.08,xMeter+1.75,yFloor+1.10,D*.22-.15,'podval-electric');
  if(courtyard){
    // Section 1's teaching entrance: visually belongs to the complete block.
    box(2.4,.16,1.5,-2.3,2.45,D/2+.60,'entrance-canopy');
    for(const x of [-3.35,-1.25])box(.12,2.55,.12,x,1.20,D/2+1.20,'entrance-column');
    box(2.5,.20,1.70,-2.3,-.05,D/2+.60,'entrance-platform');
  }
  for(let x=-W/2+3;x<W/2-1;x+=4){
    G.push(...H.podves(x,yW,zW,yCeil,.075,'podval-support'));
    if(!stove)G.push(...H.podves(x,yH,zH,yCeil,.09,'podval-support'));
  }

  // The same plant-kit equipment used by existing pump stations and houses.
  const tx=xMeter+5.5, tz=zH+1.4;
  if(!stove){
    const start=modern?-W/2+1:xWall;
    pipe([[start,yH,zH],[W/2-1,yH,zH]],.09,'heating-supply');
    pipe([[start,yR,zH],[W/2-1,yR,zH]],.09,'heating-return');
    const networkZ=modern?zH-1.1:zH;
    G.push(...P.zadvizhka(xMeter,yH,networkZ,.09,'podval-heat','x'));
    G.push(...P.manometr(xMeter+1,yH+.09,networkZ,'podval-heat'));
    if(modern){
      const base=yFloor+.2, h=1.55, w=.8;
      G.push(...P.pto(tx,base,tz,'podval-heat',{h,w,n:10,dn:.075,floor:yFloor}));
      // Primary lines stop at the heat exchanger; they never join the house
      // headers. Otherwise the diagram would show a hydraulic short circuit.
      const yHi=base+h*.78,yLo=base+h*.22;
      for(const high of [false,true]){
        const yy=high?yHi:yLo,header=high?yH:yR,xx=tx-(high?1.0:1.4),zz=tz-w*.27;
        pipe([[xWall,header,networkZ],[xx,header,networkZ],[xx,yy,networkZ],[xx,yy,zz],[tx-.23,yy,zz]],.075,'podval-network');
      }
      const houseZ=tz+w*.27;
      pipe([[tx-.23,yHi,houseZ],[tx-.55,yHi,houseZ],[tx-.55,yH,houseZ],[tx-.55,yH,zH]],.075,'podval-heat');
      const py=yFloor+.234+.22,px=tx+1.6,pz=tz;
      G.push(...P.nasos(px,py,pz,'podval-heat',{dn:.09}));
      // Feet under the motor bridge the kit's deliberately simplified gap.
      box(.24,.16,.18,px+.43,py-.20,pz,'podval-heat-dark');
      pipe([[px-.243,py,pz],[px-.65,py,pz],[px-.65,yR,pz],[px-.65,yR,zH]],.075,'podval-heat');
      pipe([[px,py+.3978,pz],[px,py+.3978,tz+1.1],[tx-.85,py+.3978,tz+1.1],[tx-.85,yLo,tz+1.1],[tx-.85,yLo,houseZ],[tx-.23,yLo,houseZ]],.075,'podval-heat');
      node('Теплообменник и насос',[tx,base+h/2,tz],'Учебный ИТП: пластинчатый теплообменник, циркуляционный насос, подача и обратная линия. Фактический состав ИТП по архитектурному альбому не установлен.');
    }else{
      // A simple mixing junction, with the return connected below the diffuser.
      G.push({frustum:[.09,.19,.60,tx,yH,zH,'podval-heat',12],rot:[0,0,-90]});
      pipe([[tx-.30,yR,zH],[tx-.30,yH,zH]],.07,'podval-heat');
      G.push(...P.flanec(tx+.35,yH,zH,.09,'podval-heat','x'));
      node('Тепловой узел',[tx,yH,zH],'В учебной схеме подача и обратная линия сходятся в узле смешения. Это принцип работы домового отопления, а не восстановленная по обмеру обвязка.');
    }
  }

  for(let s=0;s<sections;s++){
    const cx=-W/2+(s+.5)*sw;
    const wx=cx-sw*.20, hx=cx+sw*.20, sx=cx, vz=D*.12;
    // Стояки — столбы, а не нити: у остальных домов музея их рисует движок
    // сечением 0,22 м, и именно они держат кадр и разборку. С r 0,065 стояк
    // на 50-метровом доме пропадал вовсе (кадры 12.09).
    // Сечение символьного стояка растёт с длиной дома: на 96-метровом корпусе
    // труба r 0,10 в кадре — две пиксельные линии, столб 0,22 у П-44 (62 м) — восемь.
    const rr=Math.min(.22,Math.max(.10,(courtyard?89.7:W)/420)), bx=rr*2;
    const water=[[wx,yW,zW],[wx,yW,zRis],[wx,top-.5,zRis]];
    pipe(water,rr,'systems-water');
    pipe([[sx,top+.45,zKan],[sx,yK,zKan]],rr*1.15,'systems-sewer');
    box(bx+.2,.12,bx+.2,sx,top+.52,zKan,'systems-sewer');              // оголовок вентиляции стояка
    const ex=wx-1.5, ez=zRis-.6;
    box(bx,top-.15,bx,ex,(top-.15)/2+.05,ez,'systems-electric');       // электрический стояк
    box(.34,.6,.16,ex,yFloor+1.3,ez-.1,'systems-electric');            // от ВРУ подвала
    pipe([[xMeter+1,yFloor+1.3,D*.22],[xMeter+1,yFloor+1.3,ez-.1],[ex,yFloor+1.3,ez-.1]],.03,'systems-electric');
    if(floors>=10){                                                     // пожарный стояк высокого дома
      const fx=sx+1.4;
      box(bx*.9,top-.2,bx*.9,fx,(top-.2)/2+.05,zKan,'systems-fire');
      pipe([[fx,yW,zW],[fx,yW,zKan],[fx,yFloor+.5,zKan]],.05,'systems-fire');
    }
    // A readable continuous ventilation shaft, attached to each floor slab.
    const ventTop=top+(stove?3.5:.7);
    box(.32,ventTop,.38,cx+.8,ventTop/2,vz,'ventilation-shaft');
    box(.58,.12,.60,cx+.8,ventTop+.02,vz,'ventilation-cap');
    box(.09,.25,.09,cx+.8,ventTop-.12,vz,'ventilation-cap');
    if(!stove){
      for(const [xx,yy] of [[hx,yH],[hx+.38,yR]])
        pipe([[xx,yy,zH],[xx,yy,zRis],[xx,top-.4,zRis]],rr*.9,'heating-riser');
      pipe([[hx,top-.4,zRis],[hx+.38,top-.4,zRis]],rr*.9,'heating-riser');
    }
    for(const yy of levels){
      pipe([[wx,yy+.35,zRis],[wx-1.0,yy+.35,zRis]],.05,'systems-floor');
      // Short brackets terminate at the underside of the actual slab.
      box(.06,.4,.06,wx-.55,yy+.15,zRis,'systems-support');
      pipe([[sx,yy+.18,zKan],[sx+1,yy+.18,zKan]],.06,'systems-floor');
      box(.06,.24,.06,sx+.7,yy+.06,zKan,'systems-support');
      box(.30,.42,.12,ex+.02,yy+1.35,ez+.17,'systems-electric');      // этажный щит на стояке
      if(!stove){
        // Радиаторы по обе стороны от стояка: у лицевого и у тыльного фасада
        for(const [rz,side] of [[zRis+.75,1],[zRis-.75,-1]]){
          pipe([[hx,yy+.68,zRis],[hx,yy+.68,rz],[hx+1.1,yy+.68,rz]],.05,'heating-floor');
          pipe([[hx+.38,yy+.23,zRis],[hx+.38,yy+.23,rz],[hx+1.1,yy+.23,rz]],.05,'heating-floor');
          box(1.1,.60,.16,hx+.60,yy+.47,rz,'heating-radiator');
          for(const dx of [.24,.96])box(.06,.21,.12,hx+dx,yy+.07,rz,'heating-support');
        }
      }
    }
    if(s===0){
      flow('Холодная вода · ввод → этажи',[.42,.82,1],[[xWall,yW,zW],[wx,yW,zW],...water.slice(1)]);
      flow('Стоки · этажи → колодец',[.65,.85,.55],[[sx,top-FH,zKan],[sx,yK,zKan],[sx,yK-.25,zKan],[sx,yK-.25,D/2+1.1]],5);
      if(!stove)flow('Отопление · подача и обратка',[1,.42,.14],[[modern?tx-.55:xWall,yH,zH],[hx,yH,zH],[hx,yH,zRis],[hx,top-.4,zRis],[hx+.38,top-.4,zRis],[hx+.38,yR,zRis],[hx+.38,yR,zH],[modern?tx+.95:xWall,yR,zH]],8);
      node('Водопроводный стояк',[wx,top*.60,zRis],'Вертикальная труба связывает подземную разводку с этажными ответвлениями. Голубые стрелки показывают движение воды вверх.');
      node('Канализационный стояк',[sx,top*.36,zKan],'Стоки движутся вниз, затем по выпуску уходят в дворовый колодец. Продолжение стояка выше крыши служит для вентиляции.');
      node('Вентиляционный оголовок',[cx+.8,ventTop+.02,vz],'Вытяжной канал заканчивается выше кровли. Тёплым цветом показана его непрерывная связь с этажами.');
      if(!stove)node('Отопление этажа',[hx+.6,levels[Math.floor(floors*.5)]+.47,zRis+.75],'Радиатор соединён с подающей и обратной трубами. Подробная схема разводки здесь учебная.');
      node('Колодец выпуска',[sx,0,D/2+1.5],'Люк находится на уровне земли; ниже виден колодец, принимающий выпуск из подвала.');
    }
  }
  node('Водомерный узел',[xMeter,yW,zW],'Задвижка, фильтр, общедомовой счётчик, обратный клапан и обводная линия — тот же узел, что в других домах музея.');
  node('Вводно-распределительное устройство',[xMeter+1,yFloor+1,D*.22],'Электрический щит и кабельная разводка в техническом подполье.');
  node('Подземная разводка',[0,yFloor+.5,0],'Под первым этажом показано, как дом соединяется с внешними сетями. Архитектура сверху сохранена по исходным планам, инженерное наполнение — учебное.');
  const px=courtyard?0:id==='plan-467'?-24:0;
  node('Подробный план этажа',[px,levels[Math.min(1,floors-1)]+1,0],'Откройте «План этажа»: исходные квартирные планы сохранены, включая доступные размеры и экспликации.');
  if(stove)node('Печное отопление',[-4.6,top+1,0],'У этого исторического варианта — отдельные печи и дымовые каналы. Теплового ввода и радиаторных стояков в модель не добавлено.');
  if(courtyard)node('Высотный акцент дома',[62.1,39,0],'Секция 3 имеет 14 этажей. Все восемь секций сохранены в едином дворовом объёме; инженерный пример сосредоточен в подробной секции 1.');

  const bbox=P.measure(G), norm=p=>bbox.frac(p).map(round);
  c.markers=rawNodes.map((m,i)=>({...m,n:i+1,at:norm(m.at)}));
  c.flows=rawFlows.map(f=>({...f,at:f.at.map(norm)}));
  c.counter=`${floors} ЭТАЖЕЙ · ${c.parts.length} СИСТЕМ`;
  if(courtyard)c.counter=`8 СЕКЦИЙ · ${c.parts.length} СИСТЕМ`;
  const intro={
    'plan-228':['Дом с печным отоплением','Два этажа, восемь квартир, печи и скатная крыша. Сравните этот дом с поздними многоэтажками: тепло здесь появляется в квартирах, а не приходит по стоякам из теплового узла.'],
    'plan-467':['Пятиэтажный панельный дом','Шесть подъездов объединены общим корпусом и подземной разводкой. Лестницы связывают пять этажей; стояки распределяют воду и тепло по высоте дома.'],
    'plan-121':['Девять этажей: от ввода до квартиры','Три блока серии 121 образуют учебную сборку целого дома. Лестницы и лифты, лоджии, инженерные стояки и подробный план центрального блока показывают, как он устроен.'],
    'plan-brusnika-2019':['Современный дом вокруг двора','Восемь секций разной высоты образуют общий двор. В секции 1 можно проследить путь от вводов и теплового узла к этажам, затем рассмотреть пять квартир по исходному плану.'],
    'plan-gp18':['Современный восемнадцатиэтажный дом','Общий лестнично-лифтовой узел связывает нежилой первый этаж и семнадцать жилых. Рядом проходят инженерные стояки; внизу раскрыты вводы, учёт и учебный тепловой узел.'],
    'plan-83':['Панельная девятиэтажка серии 83','Три рядовые секции по каталожному листу 1986 года: поперечные стены с шагом 3 и 6 м, лестница и лифт у уличного фасада, тёплый чердак. Подробный план — в среднем подъезде.'],
    'plan-85':['Кирпичная девятиэтажка серии 85','Три рядовые секции по проекту 1980 года: поперечные кирпичные стены с шагом 3,22 м, лифт и мусоропровод у лестницы, лоджии по обоим фасадам. Подробный план — в среднем подъезде.'],
  }[id] || [c.overview?.title || c.title, c.overview?.desc || ''];
  c.overview={...c.overview,title:intro[0],desc:intro[1]+' Архитектура — по чертежам; инженерное наполнение — учебный пример.'};
  c.subtitle=stove?'2 этажа · 8 квартир · печи, дымовые каналы и сети':courtyard?'8 секций · общий двор · инженерия и планы секции 1':`${floors} этажей · ${sections} ${sections===1?'подъезд':'подъезда'} · конструкции, инженерия и план этажа`;
  if(sections===6)c.subtitle='5 этажей · 6 подъездов · конструкции, инженерия и план этажа';
  c.floorStudy.accuracy+=' '+teaching;
  c.specs ||= {rows:[['Этажей',String(floors)],['Габарит корпуса',`${W} × ${D} м`]]};
  c.specs.rows.push(['Инженерные системы','Учебная схема, не рабочие чертежи']);
  c.museumHouse={version:1,engineering:'illustrative',quietParts:['interior'],referenceModels:['mkd-121','mkd-447','zhk']};
};
