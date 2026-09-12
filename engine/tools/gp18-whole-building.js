// Whole-building assembly from GP-18 facade passport, November 2020.
// Internal floor trace stays authored in gen-plan-gp18.js.
module.exports=function wholeGP18(cfg){
 const r=n=>Math.round(n*10000)/10000, g=[], W=25.2,D=25.8;
 const old=cfg.geometry;
 const FLOOR=2.85,FIRST=3.30,TYPICAL_CLEAR=2.65,LAST_CLEAR=3.45,ROOF=52.35,ROOF_TOP=52.58;
 const levels=[0,...Array.from({length:17},(_,i)=>r(FIRST+i*FLOOR)),ROOF];
 function add(w,h,d,x,y,z,mat){if(w<=0||h<=0||d<=0)return;g.push({box:[w,h,d,x-W/2,y,z-D/2,mat].map(v=>typeof v==='number'?r(v):v)});}
 function rawBox(w,h,d,x,y,z,mat){g.push({box:[w,h,d,x,y,z,mat].map(v=>typeof v==='number'?r(v):v)});}
 function plate(y,t,mat='base',voids=true){
  let tiles=[[-.15,25.35,-.15,25.95]];
  const holes=[[9.45,10.85,-.15,1.25],[14.35,15.75,-.15,1.25]];
  if(voids)holes.push([11.13,14.07,.95,4.10],[11.78,14.07,7.28,9.87],[11.13,13.52,12.78,15.32]);
  for(const [hx0,hx1,hz0,hz1] of holes){const next=[];for(const [x0,x1,z0,z1] of tiles){const a=Math.max(x0,hx0),b=Math.min(x1,hx1),c=Math.max(z0,hz0),d=Math.min(z1,hz1);if(a>=b||c>=d){next.push([x0,x1,z0,z1]);continue;}if(c>z0)next.push([x0,x1,z0,c]);if(d<z1)next.push([x0,x1,d,z1]);if(a>x0)next.push([x0,a,c,d]);if(b<x1)next.push([b,x1,c,d]);}tiles=next;}
  for(const [x0,x1,z0,z1]of tiles)add(x1-x0,t,z1-z0,(x0+x1)/2,y-t/2,(z0+z1)/2,mat);
 }
 // Substructure and distinct ground-floor plate; a single 0.15 m step meets grade.
 add(26.0,.65,26.6,12.6,-.325,12.9,'foundation');
 plate(0,.25,'base',false);
 // Use the original single-level geometry as a plan template. Window elevations
 // are mapped to measured facade marks, while internal clear height is inferred.
 function transformY(v,last){
  // Existing sketch used window sill .85, head2.35, walltop2.8.
  const knots=last?[[0,0],[.85,.87],[2.35,2.97],[2.8,LAST_CLEAR]]:[[0,0],[.85,.87],[2.35,2.46],[2.8,TYPICAL_CLEAR]];
  if(v<=0)return v;for(let i=1;i<knots.length;i++){const[a,b]=knots[i-1],[c,d]=knots[i];if(v<=c)return b+(v-a)*(d-b)/(c-a);}return knots[knots.length-1][1];
 }
 for(let floor=1;floor<18;floor++){
  const y=levels[floor],last=floor===17;
  plate(y,.20);
  for(const item of old){if(!item.box)continue;const [w,h,d,x,cy,z,mat]=item.box;if(mat==='base')continue;
   const ty=v=>mat==='stair'?Math.max(0,v)*(last?(LAST_CLEAR+.23):FLOOR)/2.8:transformY(v,last);
   const lo=ty(cy-h/2),hi=ty(cy+h/2);
   rawBox(w,hi-lo,d,x,y+(lo+hi)/2,z,mat);
  }
 }
 // Ground floor is traced separately from sheet5: commercial frontage, eastern
 // residential entrance, shared central circulation; never ten copied flats.
 const GH=FIRST-.20;
 function wall(axis,fixed,a,b,th=.22,mat='ground',holes=[]){let cursor=a;
  function solid(p,q,lo,hi){if(q<=p||hi<=lo)return;axis==='x'?add(q-p,hi-lo,th,(p+q)/2,(lo+hi)/2,fixed,mat):add(th,hi-lo,q-p,fixed,(lo+hi)/2,(p+q)/2,mat);}
  for(const hole of holes.sort((u,v)=>u.c-v.c)){const p=hole.c-hole.w/2,q=hole.c+hole.w/2;if(p<cursor-.001||q>b+.001)throw Error('GP18 ground opening');const sill=hole.door?0:.12,head=2.91;solid(cursor,p,0,GH);solid(p,q,0,sill);solid(p,q,head,GH);
   for(const v of [p+.035,(p+q)/2,q-.035])axis==='x'?add(.06,head-sill,.09,v,(head+sill)/2,fixed,'window'):add(.09,head-sill,.06,fixed,(head+sill)/2,v,'window');
   for(const v of [sill+.03,head-.03])axis==='x'?add(q-p,.06,.09,(p+q)/2,v,fixed,'window'):add(.09,.06,q-p,fixed,v,(p+q)/2,'window');
   if(hole.door){const width=hole.w*.45;axis==='x'?add(width,2.7,.065,p+width/2,1.35,fixed+.06,'door'):add(.065,2.7,width,fixed+.06,1.35,p+width/2,'door');}
   cursor=q;
  }solid(cursor,b,0,GH);
 }
 const win=(c,w=1.65)=>({c,w});const door=(c,w=1.5)=>({c,w,door:true});
 // Exterior follows shop glazing and entrance locations shown on the first plan.
 wall('x',0,1.55,9.3,.30,'ground',[win(3.95),win(6.7)]);
 wall('x',0,15.9,23.65,.30,'ground',[win(18.6),door(21.2,1.25)]);
 wall('x',0,11,14.2,.30,'core',[win(12.6,2.0)]);
 for(const [a,b,c]of[[9.3,11,10.15],[14.2,15.9,15.05]])wall('x',1.4,a,b,.22,'ground',[door(c,.95)]);
 for(const x of [9.3,11,14.2,15.9])wall('z',x,0,1.4,.22,'ground');
 wall('z',0,0,25.8,.30,'ground',[door(2.1,1.7),win(6.0,1.7),win(9.5,1.65),door(13,1.65),win(16.6,1.8),win(20,1.8),win(23.7,2.1)]);
 wall('z',25.2,0,11.4,.30,'ground',[win(2.1,2.2),win(6.0,1.8),win(9.5,1.8)]);
 wall('z',25.2,14.7,25.8,.30,'ground',[win(16.6,1.8),win(20,1.8),win(23.7,2.1)]);
 // Recessed entrance vestibule. The outer porch remains open toward the street.
 wall('x',11.4,23.65,25.2,.22,'ground');wall('x',14.7,23.65,25.2,.22,'ground');
 wall('z',23.65,11.4,14.7,.24,'ground',[door(13.1,1.7)]);
 wall('z',21.2,11.4,14.7,.16,'ground',[door(13.1,1.45)]);
 wall('x',11.4,18.8,23.65,.22,'ground',[door(20.5,1.0)]);
 wall('x',14.7,18.4,23.65,.22,'ground');
 wall('x',25.8,0,25.2,.30,'ground',[door(5.1,2.0),door(10.2,2),door(15.0,2),door(20.1,2)]);
 wall('x',0,0,1.55,.14,'ground');wall('x',0,23.65,25.2,.14,'ground');
 // Ground-only commercial subdivisions and central lobby, sheet5.
 wall('x',7.8,0,9.3,.24,'ground');wall('x',7.8,15.9,25.2,.24,'ground');
 wall('z',9.3,7.8,14.7,.22,'ground',[door(13.2,.9)]);
 wall('z',15.9,4.2,11.4,.22,'ground',[door(5.2,1.0)]);
 wall('x',4.2,5.2,9.3,.14,'ground',[door(8.3,.85)]);
 wall('z',5.8,4.2,7.0,.14,'ground');wall('x',7.0,5.8,8.3,.14,'ground');wall('z',8.3,4.2,7.0,.14,'ground',[door(5.7,.85)]);
 wall('x',14.7,0,7.8,.22,'ground');wall('x',16.3,7.8,17.4,.22,'ground');
 for(const x of [7.8,12.6,17.4])wall('z',x,16.3,25.8,.22,'ground');
 wall('x',14.7,17.4,21.2,.22,'ground');
 for(const [x,z]of[[11.65,7.15],[11.0,12.65]]){
  wall('x',z,x,x+2.55,.25,'lift');wall('x',z+2.8,x,x+2.55,.25,'lift',[door(x+1.25,1.0)]);wall('z',x,z,z+2.8,.25,'lift');wall('z',x+2.55,z,z+2.8,.25,'lift');
 }
 wall('z',11.0,1.4,4.2,.25,'core');wall('z',14.2,1.4,4.2,.25,'core');
 // Stair bridge / supported first-flight masses shown in the ground-floor core.
 for(let i=0;i<10;i++){const h=(i+1)*FIRST/20;add(1.2,h,.28,11.75,h/2,3.92-i*.28,'stair');const h2=FIRST/2+(i+1)*FIRST/20;add(1.2,h2,.28,13.4,h2/2,1.12+i*.28,'stair');}
 add(2.95,FIRST/2,.60,12.6,FIRST/4,.9,'stair');
 // Ground-floor porch and commercial thresholds attach to the foundation.
 add(2.4,.15,3.3,25.2,-.075,13.1,'entrance');
 for(const x of [5.1,10.2,15,20.1])add(2.35,.15,1.15,x,-.075,26.1,'entrance');
 // Roof and parapet reproduce the silhouette in the elevations. The roof build-
 // up and headhouse footprint are inferred, while the shown heights are sourced.
 plate(ROOF_TOP,.23,'roof',false);
 const PH=53.28-ROOF_TOP;
 function parapet(axis,fixed,a,b){axis==='x'?add(b-a,PH,.25,(a+b)/2,ROOF_TOP+PH/2,fixed,'parapet'):add(.25,PH,b-a,fixed,ROOF_TOP+PH/2,(a+b)/2,'parapet');}
 parapet('z',0,0,25.8);parapet('z',25.2,0,25.8);parapet('x',25.8,0,25.2);
 for(const [a,b]of [[0,9.3],[11,14.2],[15.9,25.2]])parapet('x',0,a,b);
 for(const [a,b]of[[9.3,11],[14.2,15.9]]){parapet('x',1.4,a,b);parapet('z',a,0,1.4);parapet('z',b,0,1.4);}
 add(3.2,54.13-ROOF_TOP,4.2,12.6,(54.13+ROOF_TOP)/2,2.1,'roof');
 // Thin raised parapet corners read as the same stepped crown as the original.
 for(const x of [6.9,18.3])add(3.8,.15,.4,x,53.355,.05,'parapet');
 cfg.geometry=g;cfg.title='Жилой дом ГП-18 — проект 2020 года';cfg.subtitle='Тюмень · 18 этажей · нежилой первый этаж';cfg.category='ЖИЛЬЁ / СОВРЕМЕННЫЕ ДОМА';
 cfg.density='low';cfg.view={az:.55,el:.25};cfg.building={...cfg.building,floors:18,floorHeight:FLOOR,sectionWidth:26,depth:26.6};
 cfg.floorStudy.floorLevels=levels;cfg.floorStudy.planFloorRange=[1,17];
 cfg.overview={tag:'ЦЕЛЫЙ ДОМ · ПРОЕКТ 2020',title:'Восемнадцатиэтажная башня',desc:'Жилой дом ГП-18 в районе улиц Мельникайте и Широтной: отдельный нежилой первый этаж, 17 жилых этажей, лоджии и плоская кровля. Модель по паспорту фасада бюро «Вертикаль», ноябрь 2020 года. Поэтажный просмотр открывает подробный типовой план внутри дома. 2020 — дата проекта, не подтверждённый год ввода.'};
 cfg.floorStudy.sources.unshift({title:'Фасады · высотные отметки, PDF стр. 4',url:cfg.floorStudy.sources[0].url.split('#')[0]+'#page=4',note:'Отметки оконных поясов дают повтор 2,85 м; на фасадах показаны +51,870, +53,280 и +54,130.'},{title:'Первый этаж и входы, PDF стр. 6',url:cfg.floorStudy.sources[0].url.split('#')[0]+'#page=6',note:'Самостоятельный план нежилого первого этажа; жилой вход с бокового фасада. Этажность 18 указана в экспликации на PDF стр. 3.'});
 cfg.floorStudy.accuracy='Этажность 18 подтверждена экспликацией паспорта; шаг оконных поясов 2,85 м и отметки +51,870, +53,280, +54,130 взяты с фасадов. Первый этаж восстановлен отдельно по листу 5, жилой типовой план — по листу 6: десять квартирных входов, общий обход, лестница, две шахты, лоджии и оконные проёмы. Отметка второго этажа +3,30 м, конструктивные плиты, чистая высота типового этажа 2,65 м и верхнего 3,45 м выведены для пространственной реконструкции из оконных отметок; точного разреза в паспорте нет. План типового этажа повторён на 17 жилых уровнях без утверждения о поэтажных вариантах. Внутренние проходы, оборудование шахт, кровельная надстройка и мелкие фасадные детали упрощены. Назначения неподписанных комнат не восстановлены. Номера квартир условные.';
 cfg.parts.find(p=>p.key==='envelope').desc='Внешний контур целой башни и оконные оси восстановлены по типовому плану и фасадам. Размеры между крайними осями 25,20 × 25,80 м. Высотный повтор оконных поясов — 2,85 м.';
 cfg.parts.find(p=>p.key==='stair').desc='Лестничная клетка связывает этажи. Её расположение взято с планов первого и типового этажей. Количество ступеней и конструкция маршей в музейной модели упрощены.';
 cfg.parts.find(p=>p.key==='base').name='Межэтажные перекрытия';cfg.parts.find(p=>p.key==='base').desc='Плиты разделяют восемнадцать этажей и оставляют проёмы лестницы и двух центральных шахт. Их условная толщина 0,20 м выбрана для пространственной реконструкции, без расчёта конструкций.';
 cfg.parts.push({key:'ground',name:'Нежилой первый этаж',tag:'ВХОДЫ И ВИТРИНЫ',desc:'Первый этаж сделан отдельно по листу 5. Коммерческие входы обращены на наружные фасады, вход в жилую часть выделен сбоку. Здесь нет повторения десяти квартир типового этажа.'},{key:'entrance',name:'Вход в жилую часть',tag:'ПЕРВЫЙ ЭТАЖ',desc:'Боковой вход с тамбуром показан по первому этажу; перепад между землёй −0,150 и входным уровнем 0,000 взят с фасада. Детали крылец упрощены.'},{key:'foundation',name:'Цоколь и основание',tag:'ОСНОВАНИЕ',desc:'Цоколь замыкает башню на уровне земли. Подземная конструкция в паспорте фасада не раскрыта и в модели показана условно.'},{key:'roof',name:'Плоская кровля',tag:'ЗАВЕРШЕНИЕ ДОМА',desc:'Плоское завершение и компактная надстройка соответствуют силуэту фасадного паспорта. Высотная отметка 54,130 дана в источнике; контур надстройки и состав покрытия условны.'},{key:'parapet',name:'Парапет',tag:'КРОВЛЯ',desc:'Ступенчатое завершение ограждает плоскую кровлю. Основная верхняя отметка фасадного пояса +53,280 взята с чертежа.'});
 cfg.matRules=cfg.parts.map((p,i)=>({match:[p.key],part:i}));
 return cfg;
};

