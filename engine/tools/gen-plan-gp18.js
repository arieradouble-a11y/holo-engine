const fs=require('fs'),path=require('path');
const W=25.2,D=25.8,H=2.8,geometry=[],labels=[];
const r=n=>Math.round(n*10000)/10000;
function box(w,h,d,x,y,z,mat){if(w<=0||h<=0||d<=0)throw Error('non-positive primitive');geometry.push({box:[w,h,d,x-W/2,y,z-D/2,mat].map(v=>typeof v==='number'?r(v):v)});}
function label(x,z,name,apt=false){labels.push({x:r(x-W/2),z:r(z-D/2),name,apt});}
function wall(axis,fixed,start,end,t=.16,mat='partition',holes=[]){
 let p=start;
 for(const q of holes.slice().sort((a,b)=>a.c-b.c)){
  const a=q.c-q.w/2,b=q.c+q.w/2;if(a<p-.001||b>end+.001)throw Error('opening outside wall '+[axis,fixed,start,end,a,b]);
  fill(p,a,0,H);fill(a,b,0,q.sill||0);fill(a,b,q.top||2.12,H);
  if(q.type==='window'){
   const lo=q.sill||.85,hi=q.top||2.35;
   for(const c of [a+.025,(a+b)/2,b-.025])axis==='x'?box(.045,hi-lo,.07,c,(lo+hi)/2,fixed,'window'):box(.07,hi-lo,.045,fixed,(lo+hi)/2,c,'window');
   for(const y of [lo+.025,hi-.025])axis==='x'?box(b-a,.05,.07,(a+b)/2,y,fixed,'window'):box(.07,.05,b-a,fixed,y,(a+b)/2,'window');
  }else if(q.type==='door'){
   const v=q.w*.83;axis==='x'?box(.045,2.05,v,a+.03,1.025,fixed+v/2,'door'):box(v,2.05,.045,fixed+v/2,1.025,a+.03,'door');
  }
  p=b;
 }
 fill(p,end,0,H);
 function fill(a,b,y0,y1){if(b-a<.001||y1-y0<.001)return;axis==='x'?box(b-a,y1-y0,t,(a+b)/2,(y0+y1)/2,fixed,mat):box(t,y1-y0,b-a,fixed,(y0+y1)/2,(a+b)/2,mat);}
}
const door=(c,w=.90)=>({c,w,type:'door',top:2.12});
const win=(c,w=1.50,sill=.85)=>({c,w,sill,top:2.35,type:'window'});
const gap=(c,w=.85)=>({c,w,top:H});
// Axes transcribed from original sheet 6: X=25.20 m, Z=25.80 m.
// This common display base closes the cutaway, not a claimed construction slab.
box(25.8,.24,26.4,12.6,-.12,12.9,'base');
// Symmetric facade wings. Side loggias and four facade recesses remain distinct.
for(const side of [1,-1]){
 const X=x=>side===1?x:W-x;
 const wx=(z,a,b,t,mat,holes=[])=>wall('x',z,Math.min(X(a),X(b)),Math.max(X(a),X(b)),t,mat,holes.map(q=>({...q,c:X(q.c)})));
 const wz=(x,a,b,t,mat,holes=[])=>wall('z',X(x),a,b,t,mat,holes);
 wx(0,1.55,9.30,.30,'envelope',[win(3.95,1.6),win(6.70,1.55)]);
 wz(9.30,0,1.40,.30,'envelope');wx(1.40,9.30,11.0,.30,'envelope');
 wz(0,4.2,7.8,.30,'envelope',[win(6.15,1.55)]);
 wz(0,14.7,21.6,.30,'envelope',[win(16.65,1.9),win(19.9,1.7)]);
 wx(25.8,1.55,7.80,.30,'envelope',[win(3.95,1.6),win(6.55,1.55)]);
 wz(7.80,24.40,25.8,.30,'envelope');wx(24.4,7.8,12.6,.30,'envelope',[door(10.30,.9),win(8.75,.7)]);
 // Side loggia separators: wall with actual door and adjacent window openings.
 for(const [a,b,c] of [[0,4.2,2.1],[7.8,11.4,9.5],[11.4,14.7,13.0],[21.6,25.8,23.7]]){
  wz(1.55,a,b,.22,'envelope',[door(c-.3,.9),win(c+1.1,.75)]);
  wz(0,a,b,.08,'loggia',Array.from({length:b-a>5?2:1},(_,i)=>win(a+(b-a)*(i+1)/(b-a>5?3:2),Math.min(3.5,b-a-.30),.35)));
  wx(a,0,1.55,.12,'loggia');wx(b,0,1.55,.12,'loggia');
 }
 // Upper large apartment. Entrance from side corridor; two exterior rooms and
 // a service band whose actual functions are not identified in this source.
 wz(9.30,1.40,7.80,.22,'party',[door(5.12,1.0)]);
 wx(7.80,0,9.30,.24,'party');
 wx(4.20,1.55,9.30,.14,'partition',[gap(4.75,.85),gap(8.75,.80)]);
 wz(5.82,0,4.20,.16,'partition');
 wz(3.25,4.20,7.80,.14,'partition',[gap(4.92,.75)]);
 wx(5.72,3.25,7.80,.14,'partition',[gap(4.30,.75),gap(7.20,.75)]);
 wz(5.82,5.72,7.80,.16,'partition');wz(7.55,5.72,7.80,.12,'partition');
 // Two smaller apartments occupy each middle side, with separate entries.
 wx(11.40,1.55,6.3,.22,'party');wx(12.65,6.3,9.3,.22,'party');
 wz(9.30,7.80,11.40,.24,'party');wz(7.80,10.20,11.40,.14,'partition');
 wx(10.20,7.8,9.3,.14,'partition',[gap(8.55,.75)]);
 wz(9.30,11.40,14.70,.22,'party',[door(12.0,.9),door(13.85,.9)]);
 wz(6.30,11.40,12.65,.22,'party');wz(6.30,12.65,14.70,.14,'partition',[gap(13.65,.8)]);
 wz(8.85,12.65,14.70,.12,'partition',[gap(13.65,.75)]);
 wx(14.70,0,9.30,.24,'party');
 // Southern corner apartment: outer rooms plus a narrow inner service band.
 wz(7.80,14.70,25.80,.24,'party',[door(15.88,.9)]);
 wx(18.30,0,4.25,.16,'partition',[gap(3.65,.8)]);
 wx(21.60,0,4.25,.16,'partition',[gap(3.65,.8)]);
 wz(4.25,14.70,21.60,.14,'partition',[gap(17.9,.75),gap(20.6,.75)]);
 wz(5.80,17.25,21.60,.16,'partition',[gap(18.10,.75),gap(20.88,.75)]);
 wx(17.25,5.80,7.80,.16,'partition');wx(20.2,5.80,7.80,.14,'partition');wx(21.6,5.80,7.80,.14,'partition');
 // Southern inner apartment: entrance at cross-corridor, narrow service room.
 wx(17.0,7.80,12.60,.24,'party',[door(10.8,.95)]);
 wz(9.90,17.0,20.10,.14,'partition');wx(20.10,7.80,9.90,.14,'partition',[gap(8.75,.75)]);
 wx(19.0,11.25,12.6,.12,'partition');
}
wall('z',12.60,17.0,24.4,.24,'party');
// South-facing central loggias, a visibly separate outdoor enclosure.
wall('x',25.8,7.8,17.4,.08,'loggia',[win(10.1,4.2,.35),win(15.1,4.2,.35)]);
wall('z',12.6,24.4,25.8,.12,'loggia');
// Open side corridors and north staircase lead around two enclosed shafts.
wall('x',0,11,14.2,.30,'envelope',[win(12.6,2.05)]);
wall('z',11.0,0,7.15,.25,'core',[door(5.05,1.0)]);
wall('z',14.2,0,7.15,.25,'core',[door(5.05,1.0)]);
// Shaft footprints follow hatched rectangles. Door positions are schematic,
// since the facade passport does not specify the lift equipment.
wall('x',7.15,11.65,14.2,.25,'lift');wall('x',10.0,11.65,14.2,.25,'lift',[door(12.9,1.0)]);
wall('z',11.65,7.15,10,.25,'lift');wall('z',14.2,7.15,10,.25,'lift');
wall('x',12.65,11.0,13.65,.25,'lift',[door(12.3,1.0)]);wall('x',15.45,11.0,13.65,.25,'lift');
wall('z',11.0,12.65,15.45,.25,'lift');wall('z',13.65,12.65,15.45,.25,'lift');
// Service riser compartments immediately beside the shafts.
for(const [x,z] of [[11.32,8.55],[13.98,14.02]]){
 wall('z',x-.3,z-1.2,z+1.2,.12,'riser');wall('z',x+.3,z-1.2,z+1.2,.12,'riser');
 for(const q of [-1.2,-.4,.4,1.2])wall('x',z+q,x-.3,x+.3,.12,'riser');
}
// Stair shape and flight count are illustrative. Solid risers physically
// support every tread and landing; the source gives only its plan outline.
box(2.95,.18,.75,12.60,.09,.62,'stair');
for(let i=0;i<9;i++){
 const h=(i+1)*1.4/9;box(1.2,h,.30,11.75,h/2,3.75-i*.30,'stair');
 const h2=1.4+(i+1)*1.4/9;box(1.2,h2,.30,13.4,h2/2,1.35+i*.30,'stair');
}
box(2.95,1.4,.60,12.60,.7,.9,'stair');
// Small apartment markers only: room functions are not present in the source.
for(const [x,z,n] of [[6.2,3,1],[19,3,2],[20,9.5,3],[20,13.2,4],[20.8,23,5],[14.9,22,6],[10.3,22,7],[4.4,23,8],[5.2,13.2,9],[5.2,9.5,10]])label(x,z,'№'+n,true);
label(12.6,2.45,'Лестница');label(12.9,8.65,'Шахта');label(12.3,14.2,'Шахта');label(12.6,16.3,'Холл');
const parts=[
 {key:'envelope',name:'Наружный контур',tag:'АРХИТЕКТУРА',desc:'Ступенчатые фасады и оконные проёмы восстановлены по листу 6 паспорта фасада. Размеры между крайними осями: 25,20 × 25,80 м. Толщины стен и вертикальные размеры учебной модели условны.'},
 {key:'party',name:'Десять квартирных входов',tag:'ПЛАНИРОВКА',desc:'Вокруг общего ядра расположены десять отдельных входов. Крупные угловые и более узкие внутренние квартиры образуют отличную от ранних типовых секций башенную схему. Номера 1–10 — условные обозначения музея.'},
 {key:'partition',name:'Внутренние помещения',tag:'ПОМЕЩЕНИЯ',desc:'Перегородки и проходы повторяют топологию чертежа. Экспликация отсутствует, поэтому конкретные комнаты не названы кухнями, спальнями или санузлами; мебель и приборы не добавлены.'},
 {key:'core',name:'Лестница и общий обход',tag:'ОБЩИЕ ЗОНЫ',desc:'Лестничная клетка примыкает к северному фасаду. Боковые проходы соединяются вокруг центральных шахт и выходят в поперечный холл южной группы квартир.'},
 {key:'lift',name:'Две центральные шахты',tag:'ВЕРТИКАЛЬНЫЕ СВЯЗИ',desc:'Два обособленных прямоугольных объёма показаны на оригинальном плане. В этой реконструкции воспроизведены их контуры. Тип оборудования и детали дверей паспорт фасада не раскрывает; проёмы шахт показаны условно.'},
 {key:'stair',name:'Лестничные марши',tag:'ЛЕСТНИЦА',desc:'Расположение лестницы взято с оригинала. Ступени и высота 2,80 м выбраны для наглядности учебного разреза, а не как подтверждённые размеры реального этажа.'},
 {key:'riser',name:'Компактные отсеки у ядра',tag:'ИНЖЕНЕРНЫЕ ЗОНЫ',desc:'Малые отсеки рядом с центральными шахтами читаются на чертеже. Назначение отдельных каналов и трассы инженерных сетей исходный лист не задаёт.'},
 {key:'loggia',name:'Остеклённые лоджии',tag:'ФАСАД',desc:'Боковые лоджии и лоджии южных внутренних квартир отделены от жилых помещений стенами с проёмами. Их положение и рисунок ограждения следуют плану и соседнему фасадному фрагменту; высоты упрощены.'},
 {key:'window',name:'Оконные проёмы',tag:'ДНЕВНОЙ СВЕТ',desc:'Окна — реальные отверстия в геометрии стен. Их расположение перенесено с плана; створки, подоконные отметки и мелкие профили упрощены.'},
 {key:'door',name:'Проходы и входы',tag:'СВЯЗИ',desc:'Проходы между помещениями сохранены. Квартирные двери отмечены открытыми полотнами; точные ширины и углы открывания упрощены.'},
 {key:'base',name:'Основание разреза',tag:'ЭКСПОЗИЦИЯ',desc:'Общая нижняя плоскость служит основанием музейного разреза. Она не является рабочим чертежом конструкции перекрытия.'}
];
const url='https://storage.yandexcloud.net/brusnika-uk/media/d/bd/f/de6f4374217d586d683e2a734d4fcf9224ab8367.pdf';
const cfg={category:'ЖИЛЬЁ / СОВРЕМЕННЫЕ ПЛАНИРОВКИ',badge:'ПО ПРОЕКТНОМУ ПЛАНУ',title:'Башенная секция ГП-18 — 2020 год',subtitle:'Тюмень · типовой этаж · 10 квартирных входов',source:'procedural',mode:'structured',accent:'cyan',density:'high',view:{az:.45,el:.65},reflect:0,parts,matRules:parts.map((p,i)=>({match:[p.key],part:i})),defaultPart:0,hotParts:['core','lift'],hotColor:[.2,.85,1],hotIntensity:.55,building:{type:'mkd',floors:1,sections:1,sectionWidth:26,depth:26.6,floorHeight:H,struct:'monolith',lift:true},overview:{tag:'СОВРЕМЕННЫЙ ПЛАН · 2020',title:'Башня с десятью входами',desc:'Типовой этаж жилого дома ГП-18 в районе улиц Мельникайте и Широтной. Учебная реконструкция листа 6 паспорта фасада бюро «Вертикаль», ноябрь 2020 года. Документ хранится в открытом архиве управляющей компании «Брусника». Это дата чертежа, не утверждение о годе ввода здания.'},floorStudy:{labels,sources:[{title:'Паспорт фасада ГП-18 · план, PDF стр. 7',url:url+'#page=7',note:'Первичный документ бюро «Вертикаль», лист 6, штамп 11.20. Крайние размерные оси 25,20 × 25,80 м; типовой этаж.'},{title:'Титульный лист · объект и дата',url:url+'#page=1',note:'Комплекс многоэтажных жилых домов, Тюменский район, Мельникайте — Широтная. Жилой дом ГП-18, Тюмень, 2020. Раздел: паспорт фасада.'}],accuracy:'По оригиналу перенесены крайние осевые размеры, десять квартирных входов, основное расположение перегородок и проходов, лестничное ядро, две шахты, лоджии и оконные проёмы. Небольшие отступы и толщины стен оценены по масштабу изображения. Высота разреза 2,80 м, ступени, створки и дверные проёмы шахт условны. Назначения комнат, оборудование и инженерные трассы не восстановлены: на листе нет экспликации. Номера квартир в музее условные. Паспорт фасада не заменяет комплект рабочих чертежей.'},geometry};
require('./gp18-whole-building.js')(cfg);
require('./lib/museum-house-kit')(cfg, 'plan-gp18');
const out=path.resolve(__dirname,'../configs/plan-gp18.json');fs.writeFileSync(out,JSON.stringify(cfg,null,2)+'\n');console.log('plan-gp18: '+cfg.geometry.length+' primitives, '+labels.length+' labels, '+cfg.building.floors+' floors');




