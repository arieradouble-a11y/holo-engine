// Section no.8, axes 5–10 / A–В, original 1-467А-17, album I part1,
// sheets АС-6и and АС-5и (1966). All coordinates are metres.
// This is a measured educational tracing, not a construction BIM.
const fs = require('node:fs');
const path = require('node:path');
const geometry = [], labels = [];
const W=16, D=9.8, H=2.64, FH=2.8;
// Drawing coordinates: x 0..16; z 0..9.8, top/back to bottom/front.
const box=(w,h,d,x,y,z,mat)=>geometry.push({box:[w,h,d,x-W/2,y,z-D/2,mat]});
const label=(x,z,name,apt=false)=>labels.push({x:x-W/2,z:z-D/2,name,apt});
function wall(x1,z1,x2,z2,t,mat='walls',open=[]){
  const horiz=z1===z2, len=Math.hypot(x2-x1,z2-z1);
  const emit=(a,b,y,h)=>{if(b-a<.001||h<.001)return; const c=(a+b)/2;
    box(horiz?b-a:t,h,horiz?t:b-a,horiz?x1+c:x1,y,horiz?z1:z1+c,mat);};
  let end=0;
  for(const o of [...open].sort((a,b)=>a.at-b.at)){
    const a=o.at-o.w/2,b=o.at+o.w/2; if(a<end||b>len)throw Error('opening outside wall');
    emit(end,a,H/2,H); if(o.sill)emit(a,b,o.sill/2,o.sill);
    const top=(o.sill||0)+(o.h||2.05);emit(a,b,(top+H)/2,H-top);
    if(o.sill){const cx=horiz?x1+o.at:x1,cz=horiz?z1:z1+o.at;
      box(horiz?o.w:.065,.065,horiz?.065:o.w,cx,o.sill,cz,'windows');
      box(horiz?o.w:.065,.065,horiz?.065:o.w,cx,top,cz,'windows');
      for(const k of [-.5,0,.5])box(.045,o.h,.045,horiz?cx+k*o.w:cx,o.sill+o.h/2,horiz?cz:cz+k*o.w,'windows');
    }
    end=b;
  }emit(end,len,H/2,H);
}
const door=(at,w=.85)=>({at,w,h:2.05});
const win=(at,w=1.29)=>({at,w,h:1.4,sill:.71});
// Slab leaves an actual opening around the two flights of stairs.
box(6.4,.16,D,3.2,-.08,D/2,'slab');
box(6.4,.16,D,12.8,-.08,D/2,'slab');
box(3.2,.16,5.65,8,-.08,6.975,'slab');
box(3.2,.16,1.1,8,-.08,.55,'core');
// Internal section boundary walls; exterior facades have ribbon window groups.
wall(0,0,16,0,.30,'walls',[win(1.6,2.4),win(5.4),win(8,2.0),win(10.6),win(14.4,2.4)]);
wall(0,D,16,D,.30,'walls',[win(1.6,2.4),win(4.8,2.4),win(8),win(11.2,2.4),win(14.4,2.4)]);
wall(0,0,0,D,.15);wall(16,0,16,D,.15);
// Two apartments wrap round the centre: living rooms at both facades.
wall(3.2,0,3.2,3.55,.08,'partitions',[door(2.95)]);
wall(0,4.9,3.2,4.9,.08,'partitions',[door(2.7)]);
wall(3.2,4.9,3.2,D,.14);
wall(12.8,0,12.8,3.55,.08,'partitions',[door(2.95)]);
wall(12.8,4.9,16,4.9,.08,'partitions',[door(.5)]);
wall(12.8,4.9,12.8,D,.14);
// Common staircase: only three dwelling entrances, no lift or refuse chute.
wall(6.4,0,6.4,4.9,.14,'core',[door(4.25)]);
wall(9.6,0,9.6,4.9,.14,'core',[door(4.25)]);
wall(3.2,4.9,12.8,4.9,.14,'walls',[door(4.8,.95)]);
box(3.06,.18,.9,8,.09,4.45,'core');
// Two stair flights: connected stepped masses, not floating treads.
for(let i=0;i<8;i++){
  const y=(i+1)*.175;
  box(1.16,y,.33,7.12,y/2,3.85-i*.32,'core');
  const yy=1.4+(i+1)*.175;
  box(1.16,yy,.33,8.88,yy/2,1.35+i*.32,'core');
}
box(3.06,.18,1.05,8,1.31,.75,'core');
for(const x of [7.75,8.25])box(.04,1,.04,x,1.9,.85,'core');
box(.54,.04,.04,8,2.4,.85,'core');
// Side kitchens and sanitary cabins, based on the mounting plan; fixture
// shapes and small door offsets are interpretive and stated in the UI.
for(const mirror of [false,true]){
  const xx=x=>mirror?W-x:x;
  wall(Math.min(xx(3.2),xx(6.4)),2.0,Math.max(xx(3.2),xx(6.4)),2.0,.08,'partitions',[door(mirror?.5:2.7,.75)]);
  const lo=Math.min(xx(4.1),xx(6.25)),hi=Math.max(xx(4.1),xx(6.25));
  wall(lo,2.0,lo,3.65,.075,'wet');wall(hi,2.0,hi,3.65,.075,'wet');
  wall(lo,3.65,hi,3.65,.075,'wet',[door(.5,.65),door(1.55,.65)]);
  wall((lo+hi)/2,2,(lo+hi)/2,3.65,.065,'wet');
  box(.63,.46,1.5,xx(5.72),.23,2.83,'wet');
  box(.40,.42,.60,xx(4.58),.21,2.55,'wet');
  box(.60,.85,.55,xx(5.9),.425,.43,'kitchen');
  box(.60,.85,.60,xx(4.2),.425,.43,'kitchen');
  for(const a of [-.14,.14])for(const b of [-.14,.14])geometry.push({cyl:[.06,.015,xx(4.2)+a-W/2,.86,.43+b-D/2,'kitchen','y',10]});
  box(.28,H,.26,xx(6.1),H/2,1.8,'vents');
  label(xx(4.8),1.15,'Кухня');label(xx(5.1),2.95,'Санузел');
  label(xx(4.6),4.35,'Прихожая');
  label(xx(1.55),2.3,mirror?'2К · правая':'2К · левая',true);
  label(xx(1.55),7.5,'Комната');
}
// Middle two-room apartment: front-facing rooms, small kitchen between them,
// sanitary cabin in the entrance band. Apartment walls follow 3.2/6.4m axes.
wall(6.4,4.9,6.4,D,.11,'partitions',[door(.6)]);
wall(9.6,5.75,9.6,D,.08,'partitions');
wall(6.4,5.85,8.65,5.85,.075,'wet');
wall(8.65,5.85,8.65,7.5,.075,'wet',[door(.85,.65)]);
wall(6.4,7.5,8.65,7.5,.075,'wet');
wall(7.55,5.85,7.55,7.5,.065,'wet',[door(.5,.65)]);
box(.67,.47,1.5,6.83,.235,6.67,'wet');box(.4,.42,.6,8.15,.21,6.35,'wet');
box(.60,.85,.60,6.85,.425,9.4,'kitchen');box(.60,.85,.55,8.8,.425,9.4,'kitchen');
box(.23,H,.3,6.55,H/2,5.55,'vents');
label(4.8,7.55,'Комната');label(11.2,7.55,'2К · средняя',true);
label(7.8,8.7,'Кухня');label(7.55,6.55,'Санузел');label(8.05,5.38,'Прихожая');
label(8,2.55,'Лестница');
// Narrow balcony associated with the central apartment on a typical upper floor.
box(2.8,.16,.9,11.2,-.08,10.23,'balcony');
box(2.8,.07,.04,11.2,1.05,10.66,'balcony');
for(const x of [9.82,10.5,11.2,11.9,12.58])box(.035,1.05,.035,x,.525,10.66,'balcony');
for(const x of [9.82,12.58])box(.035,.07,.9,x,1.05,10.23,'balcony');
// Door onto balcony in the large facade opening; replace that sill with a gap.
// The larger opening is modelled explicitly instead of an opaque wall.
// (Split lower band only; window group and lintel remain.)
const target=geometry.findIndex(g=>g.box && g.box[6]==='walls' && Math.abs(g.box[3]-(11.2-W/2))<.01 && Math.abs(g.box[4]-.355)<.01 && Math.abs(g.box[5]-(D-D/2))<.01);
if(target>=0){geometry.splice(target,1);box(1.45,.71,.30,11.67,.355,D,'walls');}
const parts=[
 ['walls','Несущие стены','6,4 М','Широкий шаг поперечных несущих стен — особенность серии 1-467А. В экспонате показана секция №8 между осями 5–10.'],
 ['partitions','Межкомнатные перегородки','ПЛАН','Две боковые квартиры охватывают среднюю. Проходы соединяют передние и задние комнаты; квартира в середине смотрит на один фасад.'],
 ['core','Лестница и площадка','3 КВАРТИРЫ','На площадку выходят три квартиры. В этом пятиэтажном доме нет лифта. Лестница показана одним учебным межэтажным фрагментом.'],
 ['wet','Санитарные кабины','ЗАВОДСКОЙ УЗЕЛ','На монтажном листе обозначены объёмные санитарные кабины. Их положение перенесено в модель; сантехприборы показаны условно.'],
 ['kitchen','Кухни','БЫТ','Три кухни сгруппированы рядом с санитарными узлами. В альбоме предусмотрены варианты оборудования кухонь; мелкие детали показаны условно.'],
 ['vents','Вентиляционные блоки','ВЫТЯЖКА','Вентблоки показаны на монтажном плане. Модель сохраняет их соседство с кухнями и санузлами, без вымышленной трассировки каналов.'],
 ['slab','Перекрытие','ЭТАЖ','Секция в осях 16 × 9,8 м. Перекрытие открыто сверху, чтобы читать помещения; над лестницей оставлен проём.'],
 ['windows','Окна','ФАСАД','Группы окон в ленточной разрезке фасадных панелей. Оконные переплёты упрощены.'],
 ['balcony','Балкон','УЛИЦА','Балкон типового верхнего этажа показан открытым; соседние секции отрезаны по осям.'],
].map(([key,name,tag,desc])=>({key,name,tag,desc}));
const config={
 title:'Секция 1-467А — 1966 год', category:'ЖКХ · ПЛАНИРОВКИ · 1960-е', badge:'ПЛАНИРОВКА ПО АРХИВУ',
 subtitle:'Три двухкомнатные квартиры на одной площадке. Секция №8 панельной пятиэтажки 1-467А-17: широкий шаг несущих стен и заводские санитарные кабины.',
 source:'procedural',mode:'structured',accent:'cyan',density:'high',view:{az:.45,el:.65},building:{type:'mkd',floors:1,floorHeight:FH,sections:1,sectionWidth:W,depth:D},
 floorStudy:{labels,sources:[{title:'Оригинальный альбом 1966 года · лист АС-6и',url:'https://meganorm.ru/Data2/1/4293784/4293784395.pdf#page=17',note:'Альбом I, часть 1. Секция №8, оси 5–10 / А–В. Разрез АС-5и — страница 16.'}],accuracy:'Учебная реконструкция монтажного плана. Оси 16 × 9,8 м, шаг 6,4/3,2 м и высота этажа 2,8 м взяты с листов. Положение внутренних узлов перенесено по схеме; мелкие проёмы, приборы, лестничные детали и балкон упрощены. Это типовой проект, не паспорт конкретного тюменского дома.'},
 geometry,parts,matRules:parts.map((p,i)=>({match:[p.key],part:i})),defaultPart:0,
 hotParts:['wet','kitchen','vents'],hotColor:[1,.64,.20],hotIntensity:1.15,hotAngle:40,contour:.8,fill:.20,shellOpacity:.12,bloom:{strength:.25,radius:.5,threshold:.18},
 explodeDirs:{walls:[0,1.2,0],partitions:[0,.6,0],core:[0,.2,-1.2],wet:[0,.8,0],kitchen:[1,0,0],vents:[0,1.5,0],slab:[0,-.7,0],windows:[0,0,1.1],balcony:[0,0,1.5]},
 overview:{tag:'1966 · МАССОВОЕ ЖИЛЬЁ',title:'Три квартиры вместо четырёх',desc:'Откройте «План секции»: две квартиры проходят от одного фасада до другого, третья занимает середину передней половины дома. Перегородки и санитарные кабины организуют помещения внутри крупного конструктивного шага. «Разобрать» раздвигает системы. Оригинальный монтажный план доступен ниже.'},
 specs:{title:'ПО ОРИГИНАЛЬНОМУ АЛЬБОМУ',rows:[['Проект','1-467А-17 · 1966'],['Показана','Секция №8 · 2–2–2'],['Дом целиком','5 этажей · 90 квартир'],['Секция в осях','16 × 9,8 м'],['Высота этажа','2,8 м'],['Шаг поперечных стен','6,4 м'],['Модель','Один типовой этаж']]},
 markers:[],counter:'1966 · СЕКЦИЯ 2–2–2',thumbLabel:'1966 · ТРИ КВАРТИРЫ',calibrate:false
};
const mark=(n,name,x,z,desc)=>config.markers.push({n,name,at:[(x+.15)/(W+.3),.38,(z+.15)/(D+1.05)],desc});
mark(1,'Три входа с площадки',8,4.5,parts[2].desc);mark(2,'Санитарная кабина',5.1,2.8,parts[3].desc);
mark(3,'Широкий конструктивный шаг',3.2,6.6,parts[0].desc);mark(4,'Средняя квартира',11.2,7.3,parts[1].desc);
mark(5,'Вентблок у кухни',6.1,1.8,parts[5].desc);
require('./whole-historical-houses')(config, 'plan-467');
require('./lib/museum-house-kit')(config, 'plan-467');
fs.writeFileSync(path.join(__dirname,'../configs/plan-467.json'),JSON.stringify(config,null,2)+'\n');
console.log('plan-467:',geometry.length,'primitives;',labels.length,'labels');
