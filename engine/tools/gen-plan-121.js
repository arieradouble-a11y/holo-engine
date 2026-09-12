#!/usr/bin/env node
'use strict';
// Repeatable manual tracing of TP 121-014/1.2, AC.1-1, sheets 10, 15 and 35.
// Readable source axes fix the scale. Doors/partitions follow sheet 35; small
// offsets are approximate. Authoring X/Z start at axes left/rear; output is centred.
const fs = require('fs');
const path = require('path');
const W = 22.4, D = 13.02, FH = 2.7, H = 2.55;
const geometry = [], labels = [];
const round = n => Math.round(n * 10000) / 10000;
const box = (x0,x1,z0,z1,y0,y1,mat) => {
  if (x1-x0 < .001 || z1-z0 < .001 || y1-y0 < .001) return;
  geometry.push({box:[x1-x0,y1-y0,z1-z0,(x0+x1)/2-W/2,(y0+y1)/2,(z0+z1)/2-D/2,mat].map(v=>typeof v==='number'?round(v):v)});
};
const label = (x,z,name,apt=false) => labels.push({x:round(x-W/2),z:round(z-D/2),name,...(apt?{apt:true}:{})});
// Aperture: [position along wall,width,sill,head]. A real void is left between
// separate jamb, lintel and sill pieces; there is no continuous wall behind windows.
function wall(axis,fixed,start,end,mat='walls',th=.16,holes=[],height=H) {
  const emit=(a,b,lo=0,hi=height,m=mat,t=th)=> axis==='x'
    ? box(a,b,fixed-t/2,fixed+t/2,lo,hi,m)
    : box(fixed-t/2,fixed+t/2,a,b,lo,hi,m);
  let cursor=start;
  for (const [p,width,sill=0,head=2.1] of holes.sort((a,b)=>a[0]-b[0])) {
    const a=Math.max(start,p-width/2), b=Math.min(end,p+width/2);
    emit(cursor,a); emit(a,b,0,sill); emit(a,b,head,height);
    if (sill>.1) {
      emit(a,a+.045,sill,head,'frames',.08); emit(b-.045,b,sill,head,'frames',.08);
      emit(a,b,sill,sill+.045,'frames',.08); emit(a,b,head-.045,head,'frames',.08);
      emit(p-.023,p+.023,sill,head,'frames',.07);
    }
    cursor=b;
  }
  emit(cursor,end);
}
const wx=(z,a,b,m,t,g,h)=>wall('x',z,a,b,m,t,g,h);
const wz=(x,a,b,m,t,g,h)=>wall('z',x,a,b,m,t,g,h);
const win=(p,w=1.6)=>[p,w,.85,2.2];
const door=(p,w=.85)=>[p,w,0,2.08];

// Real footprint: rear central recess and two recessed front corner bedrooms.
box(-.16,6.4,-.16,11.52,-.16,0,'base');
box(16,22.56,-.16,11.52,-.16,0,'base');
box(6.4,16,1.34,13.18,-.16,0,'base');
box(3.2,6.4,11.52,13.18,-.16,0,'base');
box(16,19.2,11.52,13.18,-.16,0,'base');

// Envelope: source axis grid 7 x 3200; depth 1500+4260+1500+4260+1500.
wx(0,0,6.4,'walls',.30,[win(1.65,1.45),win(4.85,2.05)]);
wx(0,16,22.4,'walls',.30,[win(17.55,2.05),win(20.8,1.45)]);
wz(6.4,0,1.5,'walls',.30,[win(.7,.65)]);
wz(16,0,1.5,'walls',.30,[win(.7,.65)]);
wx(1.5,6.4,16,'walls',.30,[win(7.7,1.45),win(11.15,3.7),win(14.65,1.45)]);
wz(0,0,11.52,'walls',.30,[]); wz(22.4,0,11.52,'walls',.30,[]);
wx(11.52,0,3.2,'walls',.30,[door(1.65,.85),win(2.45,.70)]);
wx(11.52,19.2,22.4,'walls',.30,[win(19.9,.7),door(20.75,.85)]);
wz(3.2,11.52,13.02,'walls',.30,[]); wz(19.2,11.52,13.02,'walls',.30,[]);
wx(13.02,3.2,19.2,'walls',.30,[win(4.25,1.35),door(5.55,.85),win(8.0,1.45),win(11.1,1.45),win(14.45,1.45),door(16.95,.85),win(18.05,1.35)]);

// Common landing. Four apartment doors lead into separate, interlocking layouts.
// The rear 3-room flats wrap down both outside bays; the lower middle flats are
// 2-room on the left and 1-room on the right, NOT four equal plan quadrants.
wz(6.4,0,5.76,'walls',.16,[door(5.1,.88)]);
wz(6.4,5.76,7.26,'walls',.16,[door(6.48,.90)]);
wz(16,0,5.76,'walls',.16,[door(5.1,.88)]);
wz(16,5.76,7.26,'walls',.16,[door(6.48,.90)]);
wx(7.26,3.2,19.2,'walls',.16,[door(7.75,.90),door(15.25,.90)]);

// Left rear apartment (3 rooms). Bedroom-to-living door is retained from sheet 35.
wz(3.2,0,5.76,'walls',.16,[door(3.15,.85)]);
wx(5.76,3.2,6.4,'partitions',.09,[door(4.9,1.30)]);
wx(4.55,0,3.2,'partitions',.09,[door(1.88,.78)]);
wx(5.35,0,1.65,'wet',.09,[door(.8,.65)]);
wz(1.65,4.55,7.26,'wet',.09,[door(5.05,.65),door(6.45,.72)]);
wz(2.7,4.55,5.76,'partitions',.09,[]);
wx(7.26,0,3.2,'walls',.16,[door(1.88,.85)]);
wz(3.2,7.26,11.52,'walls',.16,[]);

// Right rear apartment (3 rooms), with the matching front corner bedroom.
wz(19.2,0,5.76,'walls',.16,[door(3.15,.85)]);
wx(5.76,16,19.2,'partitions',.09,[door(17.55,1.30)]);
wx(4.55,19.2,22.4,'partitions',.09,[door(20.52,.78)]);
wx(5.35,20.75,22.4,'wet',.09,[door(21.6,.65)]);
wz(20.75,4.55,7.26,'wet',.09,[door(5.05,.65),door(6.45,.72)]);
wz(19.7,4.55,5.76,'partitions',.09,[]);
wx(7.26,19.2,22.4,'walls',.16,[door(20.52,.85)]);
wz(19.2,7.26,11.52,'walls',.16,[]);

// Kitchens flanking the stair core: individual entries off the apartment halls.
wz(9.0,1.5,5.76,'core',.18,[]); wz(13.4,1.5,5.76,'core',.18,[]);
wx(4.72,6.4,9.0,'partitions',.09,[door(7.00,.80)]);
wx(4.72,13.4,16,'partitions',.09,[door(15.40,.80)]);
wx(5.76,6.4,9,'walls',.16,[]); wx(5.76,13.4,16,'walls',.16,[]);

// Front left 2-room apartment. Entrance hall bends past the sanitary cabin.
wz(6.4,7.26,13.02,'walls',.16,[door(8.5,.85)]);
wx(9.00,6.4,9.6,'partitions',.09,[door(8.5,.85)]);
wz(9.6,9.0,13.02,'walls',.16,[]);
wz(12.8,7.26,13.02,'walls',.16,[]);
wx(8.92,9.6,11.2,'partitions',.09,[door(10.40,.80)]);
wz(11.2,7.38,9.75,'wet',.09,[door(8.13,.70),door(9.34,.65)]);
wx(7.38,11.2,12.8,'wet',.09,[]);
wx(8.92,11.2,12.8,'wet',.09,[]);
wx(9.75,11.2,12.8,'wet',.09,[]);
wx(10.32,9.6,12.8,'partitions',.09,[door(10.30,.80)]);
wz(10.22,9.0,10.32,'partitions',.09,[]);

// Front right 1-room apartment. Compact hall and independent kitchen.
wz(16,7.26,13.02,'walls',.16,[door(8.70,.85)]);
wz(14.4,7.38,9.75,'wet',.09,[door(8.13,.70),door(9.34,.65)]);
wx(7.38,12.8,14.4,'wet',.09,[]);
wx(8.92,12.8,14.4,'wet',.09,[]);
wx(9.75,12.8,14.4,'wet',.09,[]);
wx(10.32,12.8,16,'partitions',.09,[door(15.25,.80)]);
wz(15.38,9.45,10.32,'partitions',.09,[]);

// Floor areas make room boundaries legible without introducing invented furniture.
for (const r of [[.16,3.10,.16,4.50],[3.30,6.30,.16,5.68],[.16,3.10,7.34,11.37],
  [16.1,19.10,.16,5.68],[19.30,22.24,.16,4.50],[19.30,22.24,7.34,11.37],
  [3.30,6.30,7.34,12.87],[6.50,9.50,9.08,12.87],[16.10,19.10,7.34,12.87]])
  box(...r,.004,.025,'living');
for (const r of [[6.50,8.88,1.66,4.66],[13.52,15.90,1.66,4.66],
  [9.70,12.70,10.40,12.87],[12.90,15.90,10.40,12.87],
  [.16,1.60,4.60,7.18],[20.80,22.24,4.60,7.18],[11.25,12.70,7.43,9.70],[12.90,14.35,7.43,9.70]])
  box(...r,.004,.028,'wet');

// Small fixtures are visual conventions, not engineering or service connection data.
function bath(x,z,mirror=false) {
  const x0=x, x1=x+1.40, z0=z, z1=z+.68;
  box(x0,x1,z0,z1,0,.08,'wet');
  box(x0,x0+.08,z0,z1,.08,.55,'wet'); box(x1-.08,x1,z0,z1,.08,.55,'wet');
  box(x0,x1,z0,z0+.07,.08,.55,'wet'); box(x0,x1,z1-.07,z1,.08,.55,'wet');
}
function toilet(x,z) {
  box(x-.19,x+.19,z-.27,z+.22,0,.37,'wet');
  box(x-.23,x+.23,z+.17,z+.36,0,.74,'wet');
}
bath(.19,5.50); bath(20.82,5.50); bath(11.25,7.54); bath(12.93,7.54);
toilet(.66,4.91); toilet(21.73,4.91); toilet(12.12,9.31); toilet(13.5,9.31);
function kitchen(x0,x1,z0,z1){
  box(x0,x1,z0,z1,0,.88,'wet');
  box(x0-.025,x1+.025,z0-.025,z1+.025,.88,.94,'wet');
}
kitchen(8.27,8.86,2.9,4.56); kitchen(13.53,14.12,2.9,4.56);
kitchen(12.09,12.68,10.42,12.15); kitchen(12.93,13.52,10.42,12.15);

// Stair flights: 2 x 9 supported treads, 2.70 m storey, half-level landing.
// Widths/treads are educational approximations of the readable source drawing.
box(9.12,11.57,1.68,3.12,1.19,1.35,'core');
box(9.12,9.28,1.68,3.12,0,1.19,'core');
box(11.41,11.57,1.68,3.12,0,1.19,'core');
for(let i=0;i<9;i++) {
  const za=5.64-(i+1)*.28, zb=za+.28;
  box(9.12,10.22,za,zb,0,(i+1)*.15,'core');
  const zc=3.12+i*.28;
  box(10.42,11.52,zc,zc+.28,0,1.35+(i+1)*.15,'core');
}
box(9.12,11.55,5.64,5.92,2.55,2.70,'core');
// Lift shaft sits to the RIGHT of the two stair flights, not behind the stair.
wz(11.85,3.02,5.30,'core',.16,[]); wz(13.30,3.02,5.30,'core',.16,[]);
wx(3.02,11.85,13.30,'core',.16,[]);
wx(5.30,11.85,13.30,'core',.16,[door(12.57,.9)]);
box(11.95,13.20,3.12,5.20,.005,.08,'core');
// Central handrail, its posts rooted in the corresponding staircase blocks.
for (let i=0;i<5;i++) {
  const z=3.25+i*.5, tread=Math.min(9,Math.ceil((5.64-z)/.28))*.15;
  box(10.25,10.29,z-.025,z+.025,tread,tread+.85,'core');
}
geometry.push({box:[.045,.045,2.57,10.27-W/2,1.57,4.38-D/2,'core'],rot:[28.18,0,0]});

// Source loggia/balcony strip has an angled outer edge. Thin, joined slab strips
// approximate that trapezoid without claiming survey-grade boundary coordinates.
function balcony(mirror=false) {
  for(let i=0;i<24;i++) {
    let a=i*6.4/24,b=(i+1)*6.4/24, end=13.37+(i+.5)*.42/24;
    const start=a<3.2?11.52:13.02;
    if(mirror) { const aa=W-b; b=W-a; a=aa; }
    box(a,b,start,end,-.16,-.025,'balconies');
  }
  const xs=mirror?16:0, xe=mirror?22.4:6.4;
  const railZ=13.58, cy=.51;
  geometry.push({box:[6.42,1.08,.07,(xs+xe)/2-W/2,cy,railZ-D/2,'balconies'],rot:[0,mirror?3.76:-3.76,0]});
  wz(mirror?22.4:0,11.52,13.37,'balconies',.08,[],1.05);
}
balcony(false); balcony(true);

label(4.75,6.45,'3К · №1',true); label(17.65,6.45,'3К · №2',true);
label(8.0,7.95,'2К · №3',true); label(15.2,7.95,'1К · №4',true);
label(1.6,2.4,'Комната 12,70'); label(4.8,2.4,'Комната 17,25'); label(1.6,9.3,'Комната 12,46');
label(17.6,2.4,'Комната 17,25'); label(20.8,2.4,'Комната 12,70'); label(20.8,9.3,'Комната 12,46');
label(4.8,10.6,'Комната 17,07'); label(8,11.5,'Комната 12,14'); label(17.6,10.6,'Комната 17,07');
label(7.5,2.8,'Кухня 7,66'); label(14.9,2.8,'Кухня 7,66'); label(11.1,11.9,'Кухня 7,89'); label(14.5,11.9,'Кухня 7,41');
label(10.25,4.0,'Лестница'); label(12.55,4.12,'Лифт'); label(11.35,6.6,'Общая площадка');
label(.8,6.6,'Ванная'); label(21.6,6.6,'Ванная'); label(12,8.2,'Ванная'); label(13.6,8.2,'Ванная');

const parts=[
  {key:'walls',name:'Панели и оконные проёмы',tag:'КОНСТРУКЦИЯ',desc:'Оси секции: 22,40 × 13,02 м. Наружные и основные внутренние стены повторяют схему листа 10. Окна и двери выполнены сквозными проёмами. Толщины в музейном срезе упрощены: проект предусматривает несколько вариантов наружных панелей.'},
  {key:'partitions',name:'Квартиры и проходы',tag:'ПЛАНИРОВКА',desc:'Две трёхкомнатные квартиры охватывают наружные передние спальни. Между ними расположены двухкомнатная и однокомнатная квартиры. Двери и проходы прослежены по отделочному плану листа 35; малые размеры сняты с растра приблизительно.'},
  {key:'core',name:'Лестница и лифт',tag:'ОБЩЕЕ ПРОСТРАНСТВО',desc:'Четыре входа выходят на общую площадку. Лифт находится справа от двухмаршевой лестницы. На разрезе листа 15 отметки этажей 0,00; 2,70; 5,40 м: высота этажа 2,70 м. Детали ступеней и шахты здесь учебные.'},
  {key:'wet',name:'Кухни и сантехкабины',tag:'БЫТ',desc:'Вариант типового этажа со сборными сантехкабинами. Кухни по листу 35: 7,66; 7,66; 7,89 и 7,41 м². Положения кабин и кухонь воспроизведены; формы сантехники условны. Разводка коммуникаций по архитектурному плану не реконструировалась.'},
  {key:'living',name:'Жилые комнаты',tag:'СОСТАВ КВАРТИР',desc:'Девять комнат на четыре квартиры: 3Б + 3Б + 2Б + 1Б. Площади в подписях взяты из отделочного чертежа, а не вычислены по упрощённой 3D-геометрии. В спальни у передних торцов входят из задних трёхкомнатных квартир.'},
  {key:'balconies',name:'Лоджии у переднего фасада',tag:'ФАСАД',desc:'План показывает полосы лоджий у передних углов и комнат центральных квартир. Их наклонная внешняя граница в учебной модели приближена. Варианты торцевых переходов и пожарных лестниц из полей листа 35 не добавлены.'},
  {key:'base',name:'Перекрытие среза',tag:'МУЗЕЙНЫЙ СРЕЗ',desc:'Показан один типовой этаж без потолка, чтобы видеть комнаты и проходы. Исходный проект относится к девятиэтажной блок-секции на 36 квартир. Принятая толщина плиты в модели 0,16 м носит иллюстративный характер.'}
];
const source='https://meganorm.ru/Data2/1/4293788/4293788990.pdf';
// Marker fractions include the shallow front balcony projection in the model bbox.
const marker=(x,z,name,desc,n)=>({n,name,desc,at:[round((x+.16)/22.72),.20,round((z+.16)/14.12)],nrm:[0,1,0]});
const config={
  title:'Секция 121-014 — 1985 год',subtitle:'Позднесоветская панельная секция · четыре квартиры и девять жилых комнат',
  category:'ЖИЛЬЁ / ПЛАНИРОВКИ',badge:'ПО АРХИВНЫМ ЧЕРТЕЖАМ',source:'procedural',mode:'structured',
  accent:'cyan',density:'low',view:{az:.45,el:.65},smooth:0,reflect:0,fill:.27,contour:.9,shellOpacity:.20,
  building:{type:'mkd',floors:1,sections:1,sectionWidth:W,depth:D,floorHeight:FH},
  floorStudy:{labels,sources:[
    {title:'121-014/1.2 · обложка и общие данные',url:source+'#page=1',note:'ЦНИИЭП жилища. Девятиэтажная 36-квартирная блок-секция 1Б–2Б–3Б–3Б; на листе общих данных указано утверждение 23 декабря 1985 года.'},
    {title:'Лист 10 · стены типового этажа',url:source+'#page=11',note:'Основная сетка осей: 22 400 × 13 020 мм; вариант с сантехкабинами.'},
    {title:'Лист 35 · отделочный план',url:source+'#page=36',note:'Источник топологии квартир, расположения дверей и площадей комнат. PDF страница 36.'},
    {title:'Лист 15 · разрез лестничной клетки',url:source+'#page=16',note:'Отметки этажей через 2,70 м; взаимное положение лестницы и этажных площадок.'}
  ],accuracy:'Учебная реконструкция по оригинальным листам 10, 15 и 35. Сетка осей и высота этажа взяты из размеров проекта; взаимосвязь комнат и входы прослежены по плану. Малые отступы, толщины, детали лестницы, сантехника и границы лоджий приближены. Площади в подписях — данные чертежа, не обмер 3D-модели.'},
  overview:{tag:'ПЛАН 1985 ГОДА',title:'Как четыре квартиры переплетаются вокруг лестницы',desc:'Откройте «План секции»: две трёхкомнатные квартиры заходят в передние крайние спальни, а между ними помещаются двухкомнатная и однокомнатная. Это реконструкция конкретного типового проекта 121-014/1.2 по его чертежам.'},
  specs:{rows:[['Проект','121-014/1.2, АС.1-1'],['Утверждение','23.12.1985'],['Исходная секция','9 этажей · 36 квартир'],['Сетка осей','22,40 × 13,02 м'],['Высота этажа','2,70 м'],['На этаже','1Б + 2Б + 3Б + 3Б'],['В экспонате','Один типовой этаж']]},
  parts,matRules:[...parts.map((p,i)=>({match:[p.key],part:i})),{match:['frames'],part:0}],defaultPart:0,
  hotParts:['wet'],hotColor:[1,.61,.20],hotIntensity:.75,calibrate:false,
  explodeDirs:{walls:[-.4,.5,0],partitions:[.3,.4,0],core:[0,.65,0],wet:[.2,.25,.35],living:[-.2,.1,.3],balconies:[0,.15,.5],base:[0,-.3,0]},
  markers:[
    marker(1.6,9.35,'Спальня другой стороны','Передняя крайняя спальня относится к задней трёхкомнатной квартире. Проход ведёт в её прихожую через дверь у поперечной оси; центральная передняя квартира отделена несущей стеной.',1),
    marker(12.55,4.1,'Лифт рядом с лестницей','Шахта расположена справа от двух маршей. Все четыре квартиры доступны с одной общей площадки.',2),
    marker(12.8,9.15,'Смежные сантехкабины','Кабины двух передних квартир собраны возле общей стены. Их расположение известно из архитектурного плана; трассы инженерных сетей здесь не показаны.',3),
    marker(14.5,11.8,'Кухня однокомнатной квартиры','На оригинальном отделочном плане указана площадь 7,41 м². Кухня имеет собственное окно и дверь из прихожей.',4)
  ],credits:'Учебная 3D-реконструкция · типовой проект 121-014/1.2 · источники и точность — в панели',geometry
};
require('./whole-historical-houses')(config, 'plan-121');
require('./lib/museum-house-kit')(config, 'plan-121');
const out=path.join(__dirname,'..','configs','plan-121.json');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(config,null,2)+'\n','utf8');
console.log(`plan-121: ${geometry.length} primitives in traced floor; ${labels.length} labels; ${out}`);
