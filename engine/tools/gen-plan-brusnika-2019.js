#!/usr/bin/env node
'use strict';
// Hand traced from the developer's working drawing 02-01/17-АР1, sheet 5
// (PDF page 7), section 1, floors 2–8. Source: official brusnika.ru PDF.
// Axes 8 x 3.45 m by 5 x 3.45 m are exact; local offsets are approximations.
const fs=require('fs'),path=require('path');
const W=27.6,D=17.25,H=2.7,FH=2.9,G=[],labels=[];
const r=n=>Math.round(n*10000)/10000;
function box(x0,x1,z0,z1,y0,y1,mat){
  if(x1-x0<.001||z1-z0<.001||y1-y0<.001)return;
  G.push({box:[x1-x0,y1-y0,z1-z0,(x0+x1)/2-W/2,(y0+y1)/2,(z0+z1)/2-D/2,mat].map(v=>typeof v==='number'?r(v):v)});
}
// [centre,width,sill,head]; all openings are physical gaps, not wall overlays.
const door=(p,w=.9)=>[p,w,0,2.15],win=(p,w=1.65)=>[p,w,.75,2.4];
function wall(axis,c,a,b,mat='walls',th=.20,holes=[],height=H){
  const emit=(u,v,y0=0,y1=height,m=mat,t=th)=>axis==='x'?box(u,v,c-t/2,c+t/2,y0,y1,m):box(c-t/2,c+t/2,u,v,y0,y1,m);
  let cur=a;
  for(const [p,w,sill=0,head=2.15] of holes.sort((q,s)=>q[0]-s[0])){
    const u=Math.max(a,p-w/2),v=Math.min(b,p+w/2);emit(cur,u);emit(u,v,0,sill);emit(u,v,head,height);
    if(sill>.1){emit(u,u+.045,sill,head,'frames',.08);emit(v-.045,v,sill,head,'frames',.08);emit(u,v,sill,sill+.045,'frames',.08);emit(u,v,head-.045,head,'frames',.08);emit(p-.023,p+.023,sill,head,'frames',.07);}
    cur=v;
  }emit(cur,b);
}
const wx=(z,a,b,m,t,g,h)=>wall('x',z,a,b,m,t,g,h),wz=(x,a,b,m,t,g,h)=>wall('z',x,a,b,m,t,g,h);
const lab=(x,z,name,apt=false)=>labels.push({x:r(x-W/2),z:r(z-D/2),name,...(apt?{apt:true}:{})});

// Stepped footprint and open recess beside the staircase, directly from sheet 5.
box(-.18,13.8,-.18,17.43,-.20,0,'base');
box(13.8,27.78,-.18,11.1,-.20,0,'base');
box(15.7,27.78,11.1,13.98,-.20,0,'base');
wx(0,0,W,'walls',.36,Array.from({length:8},(_,i)=>win(1.725+i*3.45,2.15)));
wz(0,0,17.25,'walls',.36,[win(2.65),win(5.2),win(8.65),win(12.1,2.1),win(15.6,2.1)]);
wx(17.25,0,13.8,'walls',.36,[]); // shared boundary with section 8 in the complete house
wz(13.8,13.8,17.25,'walls',.36,[win(15.55,1.9)]);
wx(13.8,8.5,13.8,'walls',.36,[win(10.7,2.15)]);
wz(13.8,11.1,13.8,'walls',.36,[]);
wx(11.1,13.8,15.7,'walls',.36,[win(14.7,1.0)]);
wz(15.7,11.1,13.8,'walls',.36,[]);
wx(13.8,15.7,27.6,'walls',.36,[win(18.05,2.15),win(22.425,2.15),win(25.875,2.15)]);
wz(27.6,0,13.8,'walls',.36,[]); // shared boundary with section 2, not an exterior facade

// Common corridor: the five doors occupy three sides of an offset core.
// Four apertures below plus lower-left flat entry in the short return corridor.
wx(6.9,6.9,20.7,'walls',.25,[door(10.85),door(18.8)]);
wz(6.9,0,10.35,'walls',.25,[door(9.1)]);
wx(10.35,0,6.9,'walls',.25,[]);
wz(20.7,6.9,8.5,'walls',.25,[door(7.75)]);
wx(8.5,8.5,20.7,'walls',.25,[door(13.15,1.05)]);
wz(8.5,8.5,13.8,'core',.20,[]);
wx(10.35,6.9,8.5,'walls',.25,[door(7.7)]);
wz(6.9,10.35,13.8,'partitions',.10,[door(12.05)]);

// Upper-left flat 2C6.1, 58.0 m² excluding loggia.
wz(3.45,0,10.35,'partitions',.10,[door(5.6),door(8.95)]);
wx(3.8,3.45,6.9,'partitions',.10,[door(4.3)]);
wz(5.05,3.8,8.15,'wet',.10,[door(5.0,.75),door(7.55,.70)]);
wx(6.9,0,3.45,'partitions',.10,[]);
wx(6.9,5.05,6.9,'wet',.10,[]);
wx(8.15,5.05,6.9,'wet',.10,[]);

// Upper-middle flat 1C3.1. A separate bedroom and large kitchen, not a studio.
wz(10.35,0,6.9,'partitions',.10,[door(5.35)]);
wx(3.8,10.35,13.8,'partitions',.10,[door(11.1)]);
wz(11.95,3.8,6.9,'wet',.10,[door(5.3,.75)]);
wz(13.8,0,6.9,'walls',.25,[]);

// Upper-right flat 2C5, two independent bedrooms and 16.2 m² kitchen.
wz(17.25,0,4.65,'partitions',.10,[]);
wx(3.8,13.8,17.25,'partitions',.10,[door(16.35)]);
wx(4.65,17.25,20.7,'partitions',.10,[door(19.8)]);
wz(15.65,3.8,6.9,'wet',.10,[door(5.2,.75)]);
wz(20.7,0,6.9,'partitions',.10,[door(5.65)]);
wz(24.15,0,6.9,'walls',.25,[]);
wx(6.9,20.7,24.15,'walls',.25,[]);

// Right-hand family flat 3C5.2 wraps around the stair recess: 81.4 m²,
// three bedrooms, two sanitary rooms and a 22.4 m² kitchen.
wx(5.7,24.15,27.6,'partitions',.10,[door(24.95)]);
wz(25.75,5.7,10.1,'wet',.10,[door(7.0,.75),door(9.25,.70)]);
wx(8.4,25.75,27.6,'wet',.10,[]);
wx(10.1,25.75,27.6,'wet',.10,[]);
wx(10.35,20.7,27.6,'partitions',.10,[door(22.1),door(25.2)]);
wz(24.15,10.35,13.8,'partitions',.10,[]);
wz(20.7,8.5,13.8,'partitions',.10,[door(9.3)]);

// Lower-left flat 2C10 is L-shaped around the staircase and its entry return.
wx(13.8,0,6.9,'partitions',.10,[door(4.5)]);
wz(3.45,13.8,17.25,'partitions',.10,[door(14.55)]);
wx(15.35,3.45,7.8,'partitions',.10,[door(4.45,.75),door(6.85,.7)]);
wz(5.65,15.35,17.25,'wet',.10,[]);
wz(7.8,13.8,17.25,'partitions',.10,[door(14.55)]);
// Close the upper edge of the two sanitary rooms without blocking the kitchen.
wx(13.8,8.5,13.8,'walls',.25,[]);

// Four rear loggias and a fifth in the left side of the lower-left apartment.
for(const [a,b] of [[0,3.45],[6.9,10.35],[20.7,24.15],[24.15,27.6]]){
  box(a+.2,b-.2,.18,1.3,.004,.035,'loggias');
  wx(1.35,a,b,'loggias',.16,[door(a+2.35,.85),win(a+.85,.95)]);
}
box(.18,1.3,10.5,13.65,.004,.035,'loggias');
wz(1.35,10.35,13.8,'loggias',.16,[door(12.6,.85),win(11.3,.9)]);

// Slender columns express the frame without claiming a complete structural model.
for(const [x,z] of [[0,0],[6.9,0],[13.8,0],[20.7,0],[27.6,0],[0,6.9],[6.9,6.9],[13.8,6.9],[20.7,6.9],[27.6,6.9],[0,13.8],[6.9,13.8],[13.8,13.8],[20.7,13.8],[27.6,13.8]])
  box(x-.125,x+.125,z-.125,z+.125,0,H,'walls');

// Lift shaft and separately enclosed staircase. Physical door openings link all
// five flats to the corridor, then the lift lobby, then the stair enclosure.
wz(12.05,8.5,11.1,'core',.20,[]);
wx(11.1,8.5,15.7,'core',.20,[door(12.9,1.0)]);
wz(15.7,8.5,11.1,'core',.20,[]);
wx(8.5,8.7,12.05,'core',.20,[]);
// Shaft is smaller than its surrounding core, with its door toward the lobby.
wz(11.75,8.78,10.83,'core',.15,[door(9.75,.95)]);
wz(8.9,8.78,10.83,'core',.15,[]);
wx(8.78,8.9,11.75,'core',.15,[]);wx(10.83,8.9,11.75,'core',.15,[]);
// Door through the separating wall directly faces the cabin door.
// Replace continuous divider with an opening (remove the single tall box only).
const wallAt=G.findIndex(o=>o.box&&o.box[6]==='core'&&Math.abs(o.box[3]-(12.05-W/2))<.001&&Math.abs(o.box[2]-2.6)<.001);
if(wallAt>=0)G.splice(wallAt,1);
wz(12.05,8.5,11.1,'core',.20,[door(9.75,.95)]);
box(9.0,11.64,8.87,10.74,.004,.06,'core');
// Nine joined treads per flight; underside is simplified as supported blocks.
box(8.65,9.8,11.25,13.63,0,FH/2,'core');
for(let i=0;i<9;i++){
  box(12.5-(i+1)*.30,12.5-i*.30,11.25,12.33,0,(i+1)*FH/18,'core');
  box(9.8+i*.30,10.1+i*.30,12.50,13.58,0,FH/2+(i+1)*FH/18,'core');
}
box(12.5,13.62,11.25,13.63,FH-.16,FH,'core');

// Floor zones and compact kitchen furniture: fixtures show function only.
const kitchens=[[.2,3.3,1.5,6.72],[7.06,10.2,1.5,6.72],[20.85,24,1.5,6.72],[15.9,20.55,8.7,13.62],[7.95,13.62,13.98,17.07]];
for(const q of kitchens)box(...q,.004,.025,'wet');
for(const [x0,x1,z0,z1] of [[.23,2.85,6.03,6.66],[7.15,9.8,6.03,6.66],[21.1,23.7,6.03,6.66],[15.97,16.6,9.0,12.85],[8.3,10.8,16.38,17.02]]){
  box(x0,x1,z0,z1,0,.9,'wet');box(x0-.025,x1+.025,z0-.025,z1+.025,.90,.96,'wet');
}
for(const q of [[3.6,6.7,.2,3.65],[.2,3.25,7.1,10.15],[10.5,13.6,.2,3.65],[14,17.1,.2,3.65],[17.4,20.5,.2,4.5],[24.35,27.4,1.5,5.55],[20.9,24,10.5,13.6],[24.3,27.4,10.5,13.6],[1.5,6.7,10.55,13.65],[.2,3.25,14,17.05]])box(...q,.004,.025,'living');
function bath(x,z){box(x,x+1.55,z,z+.70,0,.1,'wet');box(x,x+.07,z,z+.70,.1,.55,'wet');box(x+1.48,x+1.55,z,z+.70,.1,.55,'wet');box(x,x+1.55,z,z+.07,.1,.55,'wet');box(x,x+1.55,z+.63,z+.70,.1,.55,'wet');}
for(const p of [[5.17,3.96],[12.08,3.96],[13.98,4.0],[25.88,5.87],[3.62,16.28]])bath(...p);
for(const [x,z] of [[6.25,7.60],[26.9,9.20],[6.8,16.4]]){box(x-.2,x+.2,z-.28,z+.25,0,.4,'wet');box(x-.24,x+.24,z+.18,z+.37,0,.75,'wet');}

lab(4.35,8.75,'№1 · 2К',true);lab(10.95,5.9,'№2 · 1К',true);lab(18.15,5.7,'№3 · 2К',true);
lab(23.0,8.6,'№4 · 3К',true);lab(6.05,14.65,'№5 · 2К',true);
lab(1.7,4.65,'Кухня 17,0');lab(8.5,4.65,'Кухня 15,3');lab(22.3,4.65,'Кухня 16,2');lab(18.2,11.3,'Кухня 22,4');lab(11.0,15.55,'Кухня 17,6');
lab(15.45,7.65,'Общий коридор');lab(13.85,9.6,'Лифтовой холл');lab(10.25,9.75,'Лифт');lab(11.5,12.4,'Лестница');
lab(1.75,.65,'Лоджия');lab(8.55,.65,'Лоджия');lab(22.4,.65,'Лоджия');lab(25.8,.65,'Лоджия');

const parts=[
 ['walls','Каркас и наружные стены','КОНСТРУКЦИЯ','В общих данных указан монолитный железобетонный каркас, наружные кирпичные стены и межквартирные стены. Сетка на листе 5 — 8×3,45м по ширине и 5×3,45м по глубине. В срезе сохранены контур и главные границы, состав слоёв упрощён.'],
 ['partitions','Пять квартир','ПЛАНИРОВКА','На типовом этаже пять квартир разных размеров. Центральная однокомнатная имеет отдельную спальню и кухню; семейная справа огибает лестничный узел. Номера 1–5 на плане условные; 1К, 2К и 3К обозначают число жилых комнат. Площади и типы из чертежа приведены в характеристиках.'],
 ['core','Лифт, холл и лестница','ОБЩИЕ ПРОСТРАНСТВА','В экспликации листа 5: лестничная клетка 13,3 м², лифтовой холл 7,3 м² и коридор 23,3 м². Лестница отделена от холла дверью. Детали маршей и кабины в музейной модели условны.'],
 ['wet','Большие кухни и санузлы','БЫТ','Площади кухонь в первичном чертеже: 15,3–22,4 м². В трёх квартирах два санузла. В источнике эти помещения названы кухнями; обстановка в срезе лишь поясняет функцию, инженерные трассы не заявлены.'],
 ['living','Жилые комнаты','ПОВСЕДНЕВНАЯ ЖИЗНЬ','Здесь отдельные спальни сочетаются с просторными кухнями. Однокомнатная, три двухкомнатные и трёхкомнатная квартиры имеют разные конфигурации. Это конкретный рабочий план 2019 года, а не универсальная схема современных домов.'],
 ['loggias','Пять лоджий','ФАСАД','В каждой квартире по лоджии площадью 3,8 м² по экспликации. Четыре выходят на верхнюю сторону плана, пятая расположена сбоку нижней левой квартиры. Глубина и границы в модели приближены к чертежу.'],
 ['base','Перекрытие среза','МУЗЕЙНЫЙ СРЕЗ','Показан один типовой этаж без потолка. Чертёж относится к этажам 2–8 секции 1. Вертикальные размеры музейной модели условны: этаж 2,9 м, стены 2,7 м, плита 0,2 м; этот альбом использован как источник плана.']
].map(([key,name,tag,desc])=>({key,name,tag,desc}));
const url='https://tyumen.brusnika.ru/media/02-01_17-%D0%90%D0%A01.pdf';
const config={title:'Секция Брусники — 2019 год',subtitle:'Сапроново, Московская область · пять квартир с просторными кухнями',category:'ЖИЛЬЁ / СОВРЕМЕННЫЕ ПЛАНИРОВКИ',badge:'ПО РАБОЧЕМУ ЧЕРТЕЖУ',source:'procedural',mode:'structured',accent:'cyan',density:'med',smooth:0,view:{az:.45,el:.65},reflect:0,fill:.26,contour:.9,shellOpacity:.2,
 building:{type:'mkd',floors:1,sections:1,sectionWidth:W,depth:D,floorHeight:FH},
 floorStudy:{labels,accuracy:'Учебная реконструкция рабочего плана 02-01/17-АР1, лист 5. Точные исходные данные: сетка 27,60 × 17,25 м, пять квартир, состав помещений и площади из экспликации. Контур, входы и связь комнат прослежены по плану; малые отступы, толщины, оконные ширины и лоджии приближены. Высота модели 2,9 м и детали лестницы/обстановки условны. Площади в характеристиках не вычислены по 3D-модели. Объект расположен в Сапронове Московской области; публикация на тюменском домене не означает тюменский адрес.',sources:[{title:'Брусника · рабочий план секции 1',url:url+'#page=7',note:'Официально опубликованный альбом 02-01/17-АР1. Лист5: секция1, типовой план этажей 2–8, масштаб 1:100. Штамп 21.11.2019; Сапроново, Московская область.'},{title:'Общие данные и конструктивная схема',url:url+'#page=3',note:'Заказчик ООО «Брусника.Москва». Монолитный каркас, кирпичные наружные и межквартирные стены, гипсокартонные внутриквартирные перегородки.'}]},
 overview:{tag:'СОВРЕМЕННЫЙ ДОМ',title:'Пять квартир вокруг смещённого ядра',desc:'Рабочий проект Брусники 2019 года: небольшая квартира с отдельной спальней, три двухкомнатные и большая семейная квартира. Просторные кухни, несколько санузлов и лоджии меняют организацию быта. Место: Сапроново Московской области.'},
 specs:{rows:[['Источник','02-01/17-АР1 · лист 5'],['Рабочий чертёж','21.11.2019'],['Место','Сапроново, Московская обл.'],['Показан','Типовой этаж секции 1'],['В проекте','Этажи 2–8'],['Квартир на этаже','5'],['Сетка осей','27,60 × 17,25 м'],['№1 · 2К · тип 2С6.1','58 м² без лоджии'],['№2 · 1К · тип 1С3.1','36,1 м² без лоджии'],['№3 · 2К · тип 2С5','57 м² без лоджии'],['№4 · 3К · тип 3С5.2','81,4 м² без лоджии'],['№5 · 2К · тип 2С10','62,9 м² без лоджии'],['Площади кухонь','15,3–22,4 м²'],['Высота 3D-среза','2,9 м · условно']]},parts,matRules:[...parts.map((p,i)=>({match:[p.key],part:i})),{match:['frames'],part:0}],defaultPart:0,hotParts:['wet'],hotColor:[1,.61,.2],hotIntensity:.72,calibrate:false,
 explodeDirs:{walls:[-.35,.4,0],partitions:[.2,.35,0],core:[0,.65,0],wet:[.3,.25,.2],living:[-.2,.15,.25],loggias:[0,.1,-.35],base:[0,-.3,0]},
 markers:[{n:1,name:'Пять независимых входов',at:[.50,.19,.45],nrm:[0,1,0],desc:'Квартирные двери расположены вдоль общего коридора и его короткого поворота. Лифт и лестница вынесены к смещённому ядру.'},{n:2,name:'Семейная квартира',at:[.83,.18,.62],nrm:[0,1,0],desc:'Трёхкомнатная 3С5.2: 81,4 м² без лоджии, кухня 22,4 м² и два санузла — по экспликации рабочего листа.'},{n:3,name:'Отдельная спальня',at:[.42,.18,.17],nrm:[0,1,0],desc:'Небольшая квартира 1С3.1 имеет спальню 11,2 м² и кухню 15,3 м². На чертеже она названа однокомнатной, студией не является.'}],
 credits:'Учебная реконструкция · Брусника / Сфера-Мск · рабочий план 2019 года',geometry:G};
// COMPLETE EIGHT-SECTION HOUSE, assembled from the source key plan and all eight
// typical plans. Section 1 stays detailed on floors 2–8; other sections show the
// documented footprint/storey count without inventing apartment partitions.
const detailed=G.slice();G.length=0;
const P1=[[0,0],[27.6,0],[27.6,13.8],[15.7,13.8],[15.7,11.1],[13.8,11.1],[13.8,17.25],[0,17.25]];
const rect=(w,d)=>[[0,0],[w,0],[w,d],[0,d]];
const sec=[
 {n:1,x:0,z:0,floors:9,poly:P1,page:7},
 {n:2,x:27.6,z:0,floors:9,poly:rect(34.5,13.8),page:12},
 {n:3,x:62.1,z:0,floors:14,poly:[[0,0],[27.6,0],[27.6,20.7],[13.8,20.7],[13.8,17.25],[0,17.25]],page:19},
 {n:4,x:75.9,z:20.7,floors:8,poly:rect(13.8,24.15),page:31},
 {n:5,x:62.1,z:44.85,floors:9,poly:P1.map(([x,z])=>[27.6-x,17.25-z]),page:37},
 {n:6,x:27.6,z:48.3,floors:8,poly:rect(34.5,13.8),page:42},
 {n:7,x:0,z:44.85,floors:9,poly:P1.map(([x,z])=>[x,17.25-z]),page:50},
 {n:8,x:0,z:17.25,floors:8,poly:rect(13.8,27.6),page:56}
];
const floorLevels=Array.from({length:15},(_,i)=>r(i===0?0:3.3+(i-1)*2.9));
const inPoly=(x,z,p)=>{let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){
 const a=p[i],b=p[j];if(((a[1]>z)!==(b[1]>z))&&(x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]))inside=!inside;
}return inside;};
const inSection=(x,z,s)=>inPoly(x-s.x,z-s.z,s.poly);
const occupied=(x,z,y)=>sec.some(s=>floorLevels[s.floors]>y&&inSection(x,z,s));
function surface(s,y0,y1,mat){
 const xs=[...new Set(s.poly.map(p=>p[0]))].sort((a,b)=>a-b),zs=[...new Set(s.poly.map(p=>p[1]))].sort((a,b)=>a-b);
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++)
  if(inPoly((xs[i]+xs[i+1])/2,(zs[j]+zs[j+1])/2,s.poly))box(s.x+xs[i],s.x+xs[i+1],s.z+zs[j],s.z+zs[j+1],y0,y1,mat);
}
function facadeBay(axis,c,a,b,y0,y1,mat='massing',opening=true){
 const emit=(lo,hi,ya,yb)=>axis==='x'?box(lo,hi,c-.18,c+.18,ya,yb,mat):box(c-.18,c+.18,lo,hi,ya,yb,mat);
 if(!opening||b-a<1.6){emit(a,b,y0,y1);return;}
 const centre=(a+b)/2,half=Math.min(1.0,(b-a)*.31),sill=y0+(y0===0?.35:.78),head=Math.min(y1-.25,y0+2.36);
 emit(a,centre-half,y0,y1);emit(centre+half,b,y0,y1);emit(centre-half,centre+half,y0,sill);emit(centre-half,centre+half,head,y1);
 // One mullion and an inset sill give the complete house a readable facade rhythm.
 emit(centre-.035,centre+.035,sill,head);
}
// Ground plinth and an unprogrammed courtyard surface: no invented landscaping.
box(-1,90.7,-1,63.1,-.45,-.22,'base');
box(13.8,75.9,13.8,48.3,-.22,-.03,'courtyard');
for(const s of sec){
 surface(s,-.22,0,'base');
 for(let f=0;f<s.floors;f++){
  // The detailed source geometry already contains slabs and exterior panels.
  const isDetailed=s.n===1&&f>=1&&f<=7;
  if(!isDetailed)surface(s,floorLevels[f]-.20,floorLevels[f],'massing');
  for(let e=0;e<s.poly.length;e++){
   const a=s.poly[e],b=s.poly[(e+1)%s.poly.length],horizontal=Math.abs(a[1]-b[1])<.001;
   const axis=horizontal?'x':'z',fixed=horizontal?s.z+a[1]:s.x+a[0],start=horizontal?s.x+Math.min(a[0],b[0]):s.z+Math.min(a[1],b[1]),end=horizontal?s.x+Math.max(a[0],b[0]):s.z+Math.max(a[1],b[1]);
   const count=Math.max(1,Math.round((end-start)/3.45));
   for(let k=0;k<count;k++){
    const lo=start+(end-start)*k/count,hi=start+(end-start)*(k+1)/count,mid=(lo+hi)/2,ym=(floorLevels[f]+floorLevels[f+1])/2;
    const insideA=occupied(horizontal?mid:fixed-.02,horizontal?fixed-.02:mid,ym),insideB=occupied(horizontal?mid:fixed+.02,horizontal?fixed+.02:mid,ym);
    if(insideA===insideB||isDetailed)continue;
    facadeBay(axis,fixed,lo,hi,floorLevels[f],floorLevels[f+1]-.20);
   }
  }
 }
 const roof=floorLevels[s.floors];surface(s,roof-.20,roof,'roof');
 // Flat roofs and restrained parapets; no unverified penthouse room arrangement.
 for(let e=0;e<s.poly.length;e++){
  const a=s.poly[e],b=s.poly[(e+1)%s.poly.length],hz=Math.abs(a[1]-b[1])<.001;
  const xm=s.x+(a[0]+b[0])/2,zm=s.z+(a[1]+b[1])/2;
  const other=sec.some(q=>q!==s&&floorLevels[q.floors]>=roof&&(inSection(xm+(hz?0:.05),zm+(hz?.05:0),q)||inSection(xm-(hz?0:.05),zm-(hz?.05:0),q)));
  if(other)continue;
  if(hz)box(s.x+Math.min(a[0],b[0]),s.x+Math.max(a[0],b[0]),zm-.13,zm+.13,roof,roof+.65,'roof');
  else box(xm-.13,xm+.13,s.z+Math.min(a[1],b[1]),s.z+Math.max(a[1],b[1]),roof,roof+.65,'roof');
 }
}
G.push({at:[0,3.3,0],repeat:7,step:[0,2.9,0],items:detailed});
config.title='Дом Брусники — 2019 год';
config.subtitle='Сапроново, Московская область · восемь секций вокруг внутреннего двора';
config.category='ЖИЛЬЁ / СОВРЕМЕННЫЙ ДОМ';
config.view={az:.48,el:.68};config.density='med';config.fill=.22;config.shellOpacity=.32;
config.building={type:'mkd',floors:14,sections:1,sectionWidth:89.7,depth:62.1,floorHeight:2.9};
config.floorStudy.planBounds={x:0,z:0,width:27.96,depth:17.61};
config.floorStudy.planFloorRange=[1,7];config.floorStudy.floorLevels=floorLevels;
config.floorStudy.sectionName='Секция 1 · пять квартир';
config.floorStudy.accuracy='Учебная объёмная реконструкция целого восьмисекционного дома по рабочему альбому 02-01/17-АР1. Общая компоновка, осевые размеры 89,70 × 62,10 м и этажность секций восстановлены по ключевому плану, ведомости и планам всех восьми секций. Отметки 2-го этажа +3,30, 9-го +23,60 и 14-го +38,10 м подтверждают типовой шаг 2,90 м. Подробные квартиры показаны только на этажах 2–8 секции 1; остальные секции имеют объём и фасадные проёмы без выдуманных внутренних квартир. Их ритм окон и завершение крыш упрощены: отдельный альбом фасадов АР3 здесь не использован. Локальные отступы, сантехника и толщины приближены; площади подписей взяты из экспликации.';
config.floorStudy.sources.push({title:'Компоновка восьми секций и ведомость этажей',url:url+'#page=3',note:'Общие данные: дом с внутренним прямоугольным двором. Ключевой план повторён на рабочих листах. Планы секций: PDF 7, 12, 19, 31, 37, 42, 50, 56.'});
config.floorStudy.sources.push({title:'Секция 3 · отметка 14-го этажа',url:url+'#page=23',note:'План 14-го этажа на отметке +38,100 м. Секция 3 образует высотный акцент целого дома.'});
config.overview={tag:'ЦЕЛЫЙ ЖИЛОЙ ДОМ',title:'Восемь секций окружают двор',desc:'Дом показан целиком: замкнутый периметр, внутренний двор и разная высота секций. Четырнадцатиэтажная секция выделяется над остальными. В режиме плана можно рассмотреть пять квартир типового этажа секции 1 и затем вернуться к общему объёму.'};
config.specs={rows:[['Место','Сапроново, Московская область'],['Рабочий проект','02-01/17-АР1 · 2019 год'],['Дом','8 секций вокруг двора'],['Общий осевой габарит','89,70 × 62,10 м'],['Этажность по секциям','9 / 9 / 14 / 8 / 9 / 8 / 9 / 8'],['Типовой шаг этажей','2,90 м'],['Подробный план','Секция 1 · этажи 2–8'],['На выбранном этаже','5 квартир'],['Площади квартир без лоджий','36,1–81,4 м²']]};
config.parts.push({key:'massing',name:'Остальные семь секций',tag:'ЦЕЛЫЙ ДОМ',desc:'Контуры и этажность восстановлены по планам соответствующих секций. Внутренние квартиры здесь не придуманы: показаны этажные плиты, наружные стены и проёмы. Фасадный ритм упрощён по сетке осей.'});
config.parts.push({key:'roof',name:'Крыши и перепады высоты',tag:'СИЛУЭТ',desc:'Восемь объёмов образуют цельный дом. Секция 3 достигает 14 этажей; соседние объёмы ниже. Кровли показаны упрощённо, без реконструкции пентхаусов и технического оборудования.'});
config.parts.push({key:'courtyard',name:'Внутренний двор',tag:'КОМПОНОВКА',desc:'В общих данных и на ключевых планах дом охватывает внутренний прямоугольный двор. Здесь показано свободное пространство двора; схема его благоустройства не реконструировалась.'});
config.parts.find(p=>p.key==='base').desc='Основание целого дома и перекрытия подробной секции. Подробный этаж встроен в полный девятиэтажный объём секции 1; это не отдельно стоящий срез.';
config.parts.find(p=>p.key==='core').desc='Подробно показан лестнично-лифтовой узел секции 1 на этажах 2–8. По экспликации: лестница 13,3 м², лифтовой холл 7,3 м² и коридор 23,3 м². На общем виде он расположен внутри полного дома.';
for(const [key,name] of [['partitions','Квартиры секции 1'],['wet','Кухни и санузлы секции 1'],['living','Комнаты секции 1'],['loggias','Лоджии секции 1'],['base','Основание и перекрытия']])config.parts.find(p=>p.key===key).name=name;
config.matRules=[...config.parts.map((p,i)=>({match:[p.key],part:i})),{match:['frames'],part:0}];
config.explodeDirs.massing=[.35,0,.2];config.explodeDirs.roof=[0,.7,0];config.explodeDirs.courtyard=[0,-.1,0];
config.markers=[
 {n:1,name:'Подробная секция 1',at:[.16,.42,.13],nrm:[0,1,0],desc:'Внутри полного девятиэтажного объёма сохранены планы этажей 2–8: пять квартир, лоджии, лестница и лифт. Откройте режим плана.'},
 {n:2,name:'Четырнадцатиэтажная секция',at:[.85,.91,.16],nrm:[0,1,0],desc:'В секции 3 план 14-го этажа находится на отметке +38,100 м. Её объём сохранён как высотный акцент всего дома.'}
];
config.credits='Целый дом по проекту Брусники · Сапроново · 2019';
config.wholeHouse={axisSize:[89.7,62.1],sections:sec.map(s=>({number:s.n,origin:[r(s.x-W/2),r(s.z-D/2)],floors:s.floors,sourcePdfPage:s.page,polygon:s.poly})),detailedSection:1};
require('./lib/museum-house-kit')(config, 'plan-brusnika-2019');
const out=path.join(__dirname,'..','configs','plan-brusnika-2019.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(config,null,2)+'\n');console.log(`plan-brusnika-2019 whole house: ${G.length} declarations + 7 detailed storeys; ${labels.length} labels`);
