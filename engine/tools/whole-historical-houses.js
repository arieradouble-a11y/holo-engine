'use strict';
// Whole-building presentation for the three traced historical floor plans.
// Geometry of the measured teaching floor is retained; roof/entrance additions
// and the illustrative 121 assembly are identified explicitly in source notes.
const clone = o => JSON.parse(JSON.stringify(o));
const mat = g => g.box?.[6] || g.cyl?.[5] || '';
module.exports = function wholeHistorical(c, id) {
  const original=clone(c.geometry), labels=clone(c.floorStudy.labels), G=[];
  const box=(w,h,d,x,y,z,m,rot)=>{const g={box:[w,h,d,x,y,z,m]};if(rot)g.rot=rot;G.push(g);};
  const part=(key,name,desc)=>{c.parts.push({key,name,tag:'ДОМ ЦЕЛИКОМ',desc});c.matRules.push({match:[key],part:c.parts.length-1});};
  const entry=(x,z)=>{
    box(2.1,.18,1.45,x,2.35,z-.6,'houseEntry');
    box(.12,2.73,.12,x-.96,.915,z-1.15,'houseEntry');box(.12,2.73,.12,x+.96,.915,z-1.15,'houseEntry');
    for(let i=0;i<3;i++)box(2.3,(3-i)*.15,.38,x,(3-i)*.075-.45,z-.38*(i+1),'houseEntry');
    box(2.3,.18,1.2,x,-.4,z-.57,'houseEntry');
  };
  const rim=(x,w,d,y,h=.48)=>{
    box(w,.2,d,x,y-.1,0,'houseRoof');
    for(const z of [-d/2,d/2])box(w,.14,.26,x,y+h,z,'houseRoof');
    for(const z of [-d/2,d/2])box(w,h,.14,x,y+h/2,z,'houseRoof');
    for(const xx of [x-w/2,x+w/2])box(.14,h,d,xx,y+h/2,0,'houseRoof');
  };
  part('houseRoof','Кровля и чердак','Полная верхняя часть дома: перекрытие, кровля, карнизы и вентиляционные оголовки. Детали профилей упрощены; источник и пределы реконструкции указаны в описании точности.');
  part('houseEntry','Входы и цоколь','Входные площадки, козырьки и нижняя часть дома завершают объём здания. Мелкие входные детали и размеры наружных ступеней учебные.');
  c.geometry=G;c.floorStudy.labels=labels;c.view={az:.52,el:.38};c.density='low';c.reflect=0;
  c.category='ЖИЛЬЁ / ДОМА РАЗНЫХ ЭПОХ';c.badge='ДОМ ПО ПРОЕКТНЫМ ЧЕРТЕЖАМ';
  c.markers=[];c.fill=.29;c.shellOpacity=.17;c.counter='ДОМ ЦЕЛИКОМ';
  if(id==='plan-228'){
    const W=20.5,D=14.2,FH=3.05,H=FH*2;
    G.push({items:original});
    // Terrace floors and railings belong only to the ground floor.
    const upper=original.filter(g=>mat(g)!=='terrace' && !(mat(g)==='slab'&&Math.abs(g.box[3])>W/2));
    G.push({at:[0,FH,0],items:upper});
    for(let f=0;f<2;f++)for(const x of [-6.56,6.56])for(const dx of [-.55,.55])for(const z of [.64,1.09])
      box(.075,.12,.075,x+dx,f*FH+.04,z,'sanitary');
    box(W+.12,.22,D+.12,0,H-.11,0,'houseRoof');
    box(W+.4,.55,D+.4,0,-.49,0,'houseEntry');
    const rise=2.7,half=D/2+.50,len=Math.hypot(half,rise),angle=Math.atan2(rise,half)*180/Math.PI;
    box(W+1,.13,len,0,H+rise/2,-half/2,'houseRoof',[-angle,0,0]);
    box(W+1,.13,len,0,H+rise/2, half/2,'houseRoof',[ angle,0,0]);
    box(W+1,.16,.22,0,H+rise,0,'houseRoof');
    // Filled stepped gables under the roof.
    for(const x of [-W/2,W/2])for(let i=0;i<22;i++){
      const z=-D/2+(i+.5)*D/22,hi=rise*(1-Math.abs(z)/(D/2));
      if(hi>.05)box(.18,hi,D/22+.005,x,H+hi/2,z,'houseRoof');
    }
    for(const z of [-D/2-.46,D/2+.46])box(W+1,.17,.16,0,H,z,'houseRoof');
    for(const x of [-8.8,-4.6,4.6,8.8]){
      box(.58,3.4,.52,x,H+1.7,0,'flues');box(.78,.12,.72,x,H+3.46,0,'flues');
    }
    entry(0,-D/2);
    c.building={type:'mkd',floors:2,sections:1,sectionWidth:W,depth:D,floorHeight:FH};
    c.floorStudy.planFloorRange=[0,0];
    c.subtitle='Двухэтажный дом на восемь квартир · печное отопление · скатная крыша';
    c.overview={tag:'1950 · МАЛОЭТАЖНОЕ ЖИЛЬЁ',title:'Двухэтажный дом целиком',desc:'Восьмиквартирный дом проекта 1-228-2: два жилых этажа, лестница, боковые террасы, скатная крыша и дымовые трубы. «План этажа» открывает подробно восстановленный первый этаж с печным отоплением.'};
    c.floorStudy.accuracy+=' Показан весь двухэтажный объём. Второй этаж представлен повтором основной структуры; подробный план доступен для первого. Межэтажный шаг 3,05 м принят как высота помещений 2,83 м плюс условное перекрытие 0,22 м. Крыша, фронтоны, трубы и входная группа — архитектурное обобщение, не обмер фасада.';
    c.specs={rows:[['Проект','1-228-2 · утверждён в 1950'],['Этажей / квартир','2 / 8'],['Основной корпус','20,50 × 14,20 м'],['Высота помещений','2,83 м по паспорту'],['Детальный план','Первый этаж · четыре квартиры'],['Кровля','Скатная · учебное обобщение']]};
    c.parts.find(p=>p.key==='wall').desc='Двухэтажный шлакобетонный дом. Наружный контур 20,50 × 14,20 м и толщина стен 40 см прочитаны на листе 3; второй этаж и кровля завершают полный объём.';
    Object.assign(c.parts.find(p=>p.key==='slab'),{name:'Междуэтажные перекрытия',tag:'КОНСТРУКЦИЯ',desc:'Перекрытия разделяют два жилых этажа. Их толщина в модели условная; точный материал и состав по этому плану не устанавливаются.'});
  } else {
    const series121=id==='plan-121',sw=series121?22.4:16,D=series121?13.02:9.8,FH=series121?2.7:2.8;
    const floors=series121?9:5,sections=series121?3:6,H=floors*FH, W=sw*sections;
    const centers=Array.from({length:sections},(_,i)=>(i-(sections-1)/2)*sw);
    const detailed=series121?1:1, px=centers[detailed];
    // Other entrances show their exterior and stair core, not invented apartments.
    const envelope=original.filter(g=>{
      const m=mat(g),b=g.box;if(!b)return /core|stair/.test(m);
      if(/frames|windows|balcon|core|base|slab/.test(m))return true;
      if(/walls/.test(m))return Math.abs(b[3])>=sw/2-.65 || Math.abs(b[5])>=D/2-1.55;
      return false;
    });
    for(let s=0;s<sections;s++){
      const x=centers[s];
      for(let f=0;f<floors;f++){
        let floor=clone(s===detailed?original:envelope);
        if(f===0)floor=floor.filter(g=>{
          const b=g.box;if(!b)return true;
          if(/balcon/.test(mat(g)))return false;
          // Open a real ground-level entrance under the stair window.
          return !(Math.abs(b[3])<1.1 && b[5]<-D/2+.3 && b[4]+b[1]/2<.86);
        });
        G.push({at:[x,f*FH,0],items:floor});
      }
      box(sw+.08,.60,D+.22,x,-.38,0,'houseEntry');entry(x,-D/2);
      if(series121){
        // Source section sheet 14: upper floor24.21, roof edge26.80m.
        // Three aligned blocks are a museum assembly of the published module.
        const y=26.8;
        box(sw+.08,.20,D+.08,x,H-.10,0,'houseRoof');
        for(const z of [-D/2,D/2])box(sw,2.5,.18,x,H+1.25,z,'houseRoof');
        for(const xx of [x-sw/2,x+sw/2])box(.18,2.5,D,xx,H+1.25,0,'houseRoof');
        rim(x,sw+.22,D+.22,y,.18);
        box(3.1,1.3,3.8,x+.45,y+.65,-2.9,'houseRoof');
        box(3.4,.18,4.1,x+.45,y+1.39,-2.9,'houseRoof');
      }else rim(x,sw+.10,D+.10,H,.35);
      for(const z of [-2.8,2.8]){
        box(.65,1.2,.6,x-3.2,H+.6+(series121?2.5:0),z,'houseRoof');
        box(.85,.12,.8,x-3.2,H+1.26+(series121?2.5:0),z,'houseRoof');
      }
      // Horizontal slab bands and vertical panel joints make complete facades legible.
      for(let f=1;f<=floors;f++)for(const z of [-D/2-.02,D/2+.02])box(sw,.06,.045,x,f*FH-.07,z,'walls');
    }
    c.building={type:'mkd',floors,sections,sectionWidth:sw,depth:D,floorHeight:FH};
    c.floorStudy.labels=labels.map(r=>({...r,x:r.x+px}));
    c.floorStudy.planBounds={x:px,z:series121?.45:.4,width:sw+.34,depth:D+1.25};
    c.floorStudy.planFloorRange=[1,floors-1];
    c.title=series121?'Дом 121-014 — проект 1985 года':'Дом 1-467А — проект 1966 года';
    c.subtitle=series121?'Панельная девятиэтажка · три подъезда · подробный план внутри':'Панельная пятиэтажка · шесть подъездов · подробный план внутри';
    c.overview={tag:series121?'1985 · ПАНЕЛЬНЫЙ ДОМ':'1966 · ПАНЕЛЬНЫЙ ДОМ',title:series121?'Девять этажей и три подъезда':'Целый шестиподъездный дом',desc:series121?'Полный жилой дом из трёх блоков 121-014: девять этажей, цоколь, лоджии, технический чердак и машинные помещения. Музейная компоновка показывает, как типовая блок-секция образует дом. «План этажа» открывает подробную планировку среднего подъезда.':'Пятиэтажный дом 1-467А-17 с шестью подъездами, цоколем, балконами и плоской кровлей. Общий размерный ряд восстановлен по двум половинам фасада. «План этажа» открывает подробно разобранную секцию №8 второго подъезда.'};
    c.floorStudy.accuracy+=series121?' Полный дом собран из трёх одинаковых блоков по 22,40 м: это музейная компоновка, а не заявленный адресный объект. Подробные квартиры воспроизведены в среднем подъезде; у соседних показаны только внешние стены и лестницы. Силуэт технического чердака взят с разреза на листе 14; мелкие фасадные и входные детали упрощены.':' Полный дом: шесть секций, пять этажей, размерный ряд 48+48 м по листам фасадов и монтажным планам. Подробно восстановлена только секция №8; в соседних подъездах показаны фасады и лестничные ядра, без выдуманной квартирной нарезки. Оконные ряды соседних секций обобщены; цоколь, кровля и входные детали упрощены.';
    c.floorStudy.sources.push({title:series121?'Разрез дома и технический чердак · лист 14':'Полный фасад дома · первая половина',url:series121?'https://meganorm.ru/Data2/1/4293788/4293788990.pdf#page=15':'https://meganorm.ru/Data2/1/4293784/4293784395.pdf#page=12',note:series121?'Девять этажей с шагом 2,70 м, верх кровельного парапета 26,80 м. Компоновка трёх блоков в музее условна.':'Две половины фасадов на PDF страницах 12–15; по три подъезда на каждой, пять этажей.'});
    c.specs={rows:[['Проект',series121?'121-014/1.2 · 1985':'1-467А-17 · 1966'],['Этажей',String(floors)],['Подъездов',String(sections)],['Ширина корпуса',(W).toFixed(1).replace('.',',')+' м'],['Высота этажа',FH.toFixed(2).replace('.',',')+' м'],['Подробный план',series121?'Средний подъезд · четыре квартиры':'Второй подъезд · три квартиры'],['Полный объём',series121?'Музейная сборка трёх блоков':'Шесть секций по общему проекту']]};
    c.parts.find(p=>p.key===(series121?'base':'slab')).desc='Междуэтажные перекрытия проходят через все жилые этажи. Крыша закрывает дом в общем виде; в режиме плана показывается выбранный этаж.';
    Object.assign(c.parts.find(p=>p.key===(series121?'base':'slab')),{name:'Междуэтажные перекрытия',tag:'КОНСТРУКЦИЯ'});
    const bal=c.parts.find(p=>/balcon/.test(p.key));if(bal)bal.desc='Балконы и лоджии повторяются на верхних этажах; в общем виде видны их вертикальные ряды. Детальные границы в музейной модели упрощены по проектному плану.';
  }
  c.explodeDirs={...(c.explodeDirs||{}),houseRoof:[0,1.8,0],houseEntry:[0,-.35,0]};
  return c;
};
