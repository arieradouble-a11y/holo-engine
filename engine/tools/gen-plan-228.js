#!/usr/bin/env node
// Educational trace of original project 228-2, sheet 3 (first floor, stoves).
// Plan coordinates use metres from the NW outer corner. Source dimensions are
// centimetres: 2050 x 1420, outer wall 40; room bays 380/440, clear depth 370.
// Minor unreadable door offsets and appliance profiles are explicitly schematic.
const fs=require('fs'), path=require('path');
const W=20.5,D=14.2,H=2.83, geometry=[], labels=[];
const round=n=>Math.round(n*10000)/10000;
function box(w,h,d,x,y,z,mat,rot){
  if(w<=0||h<=0||d<=0) throw Error('non-positive box');
  const v={box:[w,h,d,x-W/2,y,z-D/2,mat].map(q=>typeof q==='number'?round(q):q)};
  if(rot)v.rot=[0,rot,0]; geometry.push(v);
}
function label(x,z,name,apt=false){labels.push({x:round(x-W/2),z:round(z-D/2),name,apt});}
function wall(axis,fixed,start,end,t,mat='wall',holes=[]){
  let cursor=start;
  for(const p of holes.slice().sort((a,b)=>a.c-b.c)){
    const a=Math.max(start,p.c-p.w/2),b=Math.min(end,p.c+p.w/2);
    if(a<cursor-0.001||b<=a)throw Error('overlapping openings');
    solid(cursor,a,0,H);
    if(p.sill)solid(a,b,0,p.sill);
    solid(a,b,p.top||2.1,H);
    if(p.type==='window'){
      const lo=p.sill||.8, hi=p.top||2.3;
      // Thin frames leave the glazing opening visibly empty.
      for(const e of [a+.035,b-.035]) beam(e,(lo+hi)/2,.055,hi-lo);
      for(const y of [lo+.035,hi-.035]) axis==='x'?box(b-a,.065,.09,(a+b)/2,y,fixed,'window'):box(.09,.065,b-a,fixed,y,(a+b)/2,'window');
      beam((a+b)/2,(lo+hi)/2,.045,hi-lo);
    }
    if(p.type==='door'){
      const leaf=p.w*.86;
      if(axis==='x')box(.045,2,leaf,a+.04,1,fixed+leaf/2,'door');
      else box(leaf,2,.045,fixed+leaf/2,1,a+.04,'door');
    }
    cursor=b;
  }
  solid(cursor,end,0,H);
  function solid(a,b,y0,y1){if(b-a<.001||y1-y0<.001)return;axis==='x'?box(b-a,y1-y0,t,(a+b)/2,(y0+y1)/2,fixed,mat):box(t,y1-y0,b-a,fixed,(y0+y1)/2,(a+b)/2,mat);}
  function beam(c,y,w,h){axis==='x'?box(w,h,.09,c,y,fixed,'window'):box(.09,h,w,fixed,y,c,'window');}
}
const door=(c,w=.85)=>({c,w,top:2.07,type:'door'});
const win=(c,w=1.43)=>({c,w,sill:.8,top:2.32,type:'window'});
box(W,.22,D,W/2,-.11,D/2,'slab');
// Outside body, with genuine apertures rather than windows painted on walls.
wall('x',.2,0,W,.4,'wall',[win(2.55),win(6.18),door(10.25,1.43),win(14.32),win(17.95)]);
wall('x',14,0,W,.4,'wall',[win(2.55),win(6.18),door(10.25,1.43),win(14.32),win(17.95)]);
wall('z',.2,.4,13.8,.4,'wall',[win(5.85,1.14),win(8.55,1.14),door(11.88,1.43)]);
wall('z',20.3,.4,13.8,.4,'wall',[win(5.85,1.14),win(8.55,1.14),door(11.88,1.43)]);
// Axis G is the shared masonry/service spine: opposed kitchens and bathrooms.
wall('x',7.1,.4,8.75,.30,'wall');wall('x',7.1,11.75,20.1,.30,'wall');
// Staircase sides: four apartment front doors, no public corridor through flats.
wall('z',8.8,.4,8.5,.20,'wall',[door(6.12,.9),door(7.75,.9)]);
wall('z',11.7,.4,13.8,.20,'wall',[door(6.12,.9),door(7.75,.9)]);
wall('x',8.5,8.9,11.6,.20,'wall');
wall('z',8.8,8.5,13.8,.20,'wall',[door(9.6,.8)]);
// The projecting front landing belongs to the third room of the 3-room flat.
wall('x',12.64,8.9,11.6,.10,'partition',[door(10.25,.9)]);
// Four outer pairs of living rooms. Central room is an explicit fifth bay below
// the stair, accessible from the bottom-left apartment (not a fifth apartment).
for(const [x0,x1,split] of [[.4,8.7,4.25],[11.8,20.1,16.25]]){
  wall('x',4.15,x0,x1,.10,'partition',[door(x0+2.95),door(x1-1.12,1.15)]);
  wall('x',10.05,x0,x1,.10,'partition',[door(x0+2.95),door(x1-1.12,.95)]);
  wall('z',split,.4,4.10,.10,'partition',[door(1.35,.85)]);
  wall('z',split,10.10,13.8,.10,'partition',[door(11.77,.85)]);
}
// Wet rooms in the four service bands. Room sizes and grouping follow sheet 3;
// small wall jogs and cabinet carcasses are simplified to readable rectangles.
function wet(left,north){
  const mirror=x=>left?x:W-x;
  const z0=north?4.2:7.25,z1=north?6.95:10.0;
  const bath0=north?5.52:7.25,bath1=north?6.95:8.68;
  const kd=north?4.85:9.36;
  wall('z',mirror(2.8),z0,z1,.10,'partition',[door(kd,.75)]);
  wall('z',mirror(4.65),bath0,bath1,.10,'partition');
  wall('z',mirror(5.63),bath0,bath1,.10,'partition');
  const edge=north?bath0:bath1;
  wall('x',edge,Math.min(mirror(2.8),mirror(5.63)),Math.max(mirror(2.8),mirror(5.63)),.10,'partition',[door(mirror(3.92),.7),door(mirror(5.13),.65)]);
  // Bath rim and bottom; hollow top remains legible from the plan camera.
  const bx=mirror(3.69),bz=(bath0+bath1)/2;
  box(1.5,.10,.64,bx,.12,bz,'sanitary');
  box(1.55,.50,.06,bx,.30,bz-.35,'sanitary');box(1.55,.50,.06,bx,.30,bz+.35,'sanitary');
  for(const dx of [-.775,.775])box(.06,.50,.7,bx+dx,.30,bz,'sanitary');
  box(.42,.38,.55,mirror(5.1),.25,bz,'sanitary');
  // Floor-standing toilet pedestal reaches the bowl and the slab.
  box(.24,.14,.32,mirror(5.1),.07,bz,'sanitary');
  box(.46,.62,.12,mirror(5.1),.39,north?6.80:7.4,'sanitary');
  // Cistern brackets are fixed to the shared masonry wall, not suspended.
  for(const dx of [-.15,.15])box(.055,.09,.24,mirror(5.1)+dx,.26,north?6.91:7.29,'sanitary');
  const serviceZ=north?6.59:7.61;
  box(.60,.84,.56,mirror(2.12),.42,serviceZ,'kitchen');
  box(.53,.055,.43,mirror(2.12),.88,serviceZ,'sanitary');
  box(.70,.78,.64,mirror(1.31),.39,serviceZ,'kitchen');
  for(const xx of [-.15,.15])for(const zz of [-.14,.14])geometry.push({cyl:[.085,.035,round(mirror(1.31)+xx-W/2),.80,round(serviceZ+zz-D/2),'kitchen','y',12]});
  // Vertical channel positions are schematic; the paired service wall is real.
  if(north)box(.46,H,.28,mirror(.94),H/2,7.1,'flues');
}
for(const l of [true,false])for(const n of [true,false])wet(l,n);
// Four masonry room stoves and one smaller heater in the middle third room.
for(const [x,z] of [[4.1,3.60],[16.4,3.60],[4.1,10.65],[16.4,10.65]]){
  box(.64,2.43,1.10,x,1.215,z,'stoves');
  box(.30,.32,.035,x,.55,z+.57,'stoves');
  box(.26,H,.26,x,H/2,z-.32,'flues');
}
box(.64,2.095,.70,11.17,1.0475,9.03,'stoves');
box(.28,H,.28,11.17,H/2,8.85,'flues');
// Polati sleeping/storage platforms are drawn in the original lower rooms.
box(2.2,.10,1.4,5.4,2.20,10.70,'polati');box(2.2,.10,1.4,15.1,2.20,10.70,'polati');
// U-shaped stair within the drawn core. Individual tread dimensions are a
// teaching reconstruction; floor-to-floor spacing is not claimed from this plan.
const rise=H/18;
for(let i=0;i<9;i++){
  box(1.08,.10,.28,10.98,(i+1)*rise,4.5-i*.28,'stair');
  box(1.08,.10,.28,9.52,(i+10)*rise,2.26+i*.28,'stair');
}
box(2.4,.12,.75,10.25,9*rise,1.79,'stair');
box(.08,1.0,2.6,10.25,H*.5,3.48,'stair');
// Inclined support slabs connect the treads, rather than leaving floating boxes.
geometry.push({box:[1.08,.13,2.92,round(10.98-W/2),.76,round(3.38-D/2),'stair'],rot:[29.32,0,0]});
geometry.push({box:[1.08,.13,2.92,round(9.52-W/2),2.14,round(3.38-D/2),'stair'],rot:[-29.32,0,0]});
// Two private side terraces of lower flats, as in the first-floor sheet.
for(const [x,edge] of [[-.9,-1.92],[21.4,22.42]]){
  box(2.0,.18,3.55,x,-.09,12.15,'slab');
  box(.16,.72,3.55,edge,.36,12.15,'terrace');
  for(const z of [10.4,13.9])box(2,.72,.16,x,.36,z,'terrace');
}
// Keep labels short; exact stamped source areas are included in descriptions.
label(7.35,5.04,'2К · №1',true);
label(13.15,5.04,'2К · №2',true);
label(7.35,9.27,'3К · №3',true);
label(13.15,9.27,'2К · №4',true);
for(const z of [2.30,11.85])for(const x of [2.0,6.55,13.95,18.50])label(x,z,'Жилая');
for(const z of [5.78,8.57])for(const x of [1.55,18.95])label(x,z,'Кухня');
label(10.25,6.0,'Лестница');label(10.25,10.83,'Комната · 9,75 м²');
const parts=[
 {key:'wall',name:'Каменные стены',tag:'КОНСТРУКЦИЯ',desc:'Наружный контур 20,50 × 14,20 м и толщина наружных стен 40 см прочитаны на листе 3. План выполнен для двухэтажного шлакобетонного дома. Показан один этаж.'},
 {key:'partition',name:'Комнаты и двери',tag:'ПЛАНИРОВКА',desc:'На этаже три двухкомнатные и одна трёхкомнатная квартира. Дополнительная комната 9,75 м² под лестничным узлом входит в нижнюю левую квартиру. Двери квартир открываются в общий лестничный холл. Мелкие смещения проёмов и шкафы упрощены.'},
 {key:'stair',name:'Лестничная клетка',tag:'ОБЩЕЕ ИМУЩЕСТВО',desc:'Одна лестничная клетка обслуживает четыре квартиры на этаже. Лифта в данном плане нет. Положение лестницы взято с чертежа; ступени показаны условно, без рабочего разреза.'},
 {key:'stoves',name:'Печное отопление',tag:'ТЕПЛО',desc:'Выбран исходный вариант с печами: четыре печи № 1 между жилыми комнатами и печь № 2 в центральной третьей комнате. На листе указаны высоты верха печей первого этажа +2,430 и +2,095 м. У квартир есть отдельные кухонные очаги.'},
 {key:'flues',name:'Дымовые и вентиляционные каналы',tag:'ВОЗДУХ',desc:'В проекте предусмотрены дымовые и вентиляционные каналы. На учебной модели выделены их зоны около печей и парных кухонь. Точные сечения и трассы каналов здесь не воспроизводятся.'},
 {key:'kitchen',name:'Кухонные очаги и мойки',tag:'БЫТ',desc:'Четыре кухни сгруппированы попарно у средней стены; на исходном плане их площадь около 6,22 м². Показаны кухонные очаги и мойки, без утверждения о газификации дома.'},
 {key:'sanitary',name:'Раздельные санузлы',tag:'ВОДА И СТОКИ',desc:'Водопровод и канализация предусмотрены в исходном проекте. Ванные и уборные раздельные, расположены рядом с кухнями. Очертания санитарных приборов упрощены; трассы труб не показаны.'},
 {key:'window',name:'Оконные проёмы',tag:'СВЕТ',desc:'Проёмы прорезаны в наружных стенах. Основные окна шириной 1,43 м размещены по фасадному размерному ряду исходного плана. Переплёты показаны схематично.'},
 {key:'door',name:'Дверные проёмы',tag:'СВЯЗИ',desc:'Открытые дверные полотна показывают проходы между холлом, квартирными передними, кухнями, санузлами и комнатами. Часть дверных размеров и точных отступов упрощена по качеству скана.'},
 {key:'polati',name:'Полати',tag:'ИСТОРИЯ БЫТА',desc:'Полати подписаны непосредственно на листе 3 у печей в нижних квартирах. Они показаны как верхние площадки; их высота и конструкция в модели условны.'},
 {key:'terrace',name:'Террасы первого этажа',tag:'ФАСАД',desc:'У нижних квартир по исходному плану есть боковые выходы на террасы. Третья комната имеет отдельный выход через небольшой передний тамбур. Декоративное ограждение упрощено.'},
 {key:'slab',name:'Основание разреза',tag:'ЭКСПОЗИЦИЯ',desc:'Нижняя плоскость замыкает учебный разрез одного этажа. Она не описывает материал реального междуэтажного перекрытия.'}
];
const cfg={title:'Дом 1-228-2 — 1950 год',subtitle:'Первый этаж · печное отопление · 4 квартиры',source:'procedural',mode:'structured',accent:'amber',density:'high',view:{az:.45,el:.65},reflect:0,hotParts:['stoves','flues'],hotColor:[1,.49,.18],hotIntensity:.8,parts,matRules:parts.map((p,i)=>({match:[p.key],part:i})),defaultPart:0,building:{type:'mkd',floors:1,sections:1,sectionWidth:24.5,depth:14.2,floorHeight:H,struct:'brick',lift:false},overview:{tag:'ПЛАН 1950 ГОДА',title:'Четыре квартиры вокруг лестницы',desc:'Учебная пространственная реконструкция листа 3 проекта 1-228-2: первый этаж с печным отоплением. Горстройпроект; архитектор Н. М. Вавировский, инженер Б. Н. Богданов. Проект разработан в 1948 году, утверждён 11 ноября 1950 года. Выберите «План секции», чтобы увидеть расположение помещений.'},floorStudy:{labels,sources:[{title:'Оригинальный план 1-го этажа, лист 3',url:'https://www.zdanija.ru/forum/uploads/monthly_01_2023/post-34457-0.24210200-1674458136.jpg',note:'Проект № 228-2. Вариант с печным отоплением; скан чертежа в архиве форума.'},{title:'Паспорт проекта 1-228-2',url:'https://www.zdanija.ru/forum/topic-45679-seriya-1-228.html',note:'Архивная публикация: Горстройпроект, разработка 1948 года, утверждение 11.11.1950.'},{title:'Альтернативный план с центральным отоплением, лист 5',url:'https://www.zdanija.ru/forum/uploads/monthly_01_2023/post-34457-0.63983400-1674458269.jpg',note:'Второй вариант того же проекта: радиаторные ниши вместо комнатных печей.'}],accuracy:'Габарит основного корпуса 20,50 × 14,20 м, наружные стены 0,40 м, главные комнатные пролёты, четыре квартирных входа, асимметричная третья комната, печи и мокрые зоны взяты с оригинального плана. Высота помещений 2,83 м — по паспорту проекта. Мелкие смещения дверей, ступени, приборы, террасные ограждения и сечения каналов упрощены. Это учебная реконструкция, не обмер и не проект для строительных работ.'},geometry};
require('./whole-historical-houses')(cfg, 'plan-228');
require('./lib/museum-house-kit')(cfg, 'plan-228');
const out=path.resolve(__dirname,'../configs/plan-228.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(cfg,null,2)+'\n');
console.log(`plan-228: ${geometry.length} primitives in traced floor, ${labels.length} labels -> ${out}`);
