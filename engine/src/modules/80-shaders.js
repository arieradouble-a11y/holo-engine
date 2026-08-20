  get vShader(){ return `
    uniform float uTime,uExplode,uProgress,uSelected;
    attribute float aSeed,aPart,aHot; attribute vec3 aExplode;
    varying float vSel,vSeed,vY,vWY,vPart,vHot,vMZ,vMX;
    void main(){
      vSeed=aSeed; vPart=aPart; vHot=aHot; vMZ=position.z; vMX=position.x;
      vSel=(uSelected>=0.0 && abs(aPart-uSelected)<0.5)?1.0:0.0;
      vec3 formed=position+aExplode*uExplode;
      formed+=0.004*vec3(sin(uTime*1.3+aSeed*30.0),sin(uTime*1.7+aSeed*47.0),cos(uTime*1.1+aSeed*22.0));
      float h1=fract(sin(aSeed*91.17)*43758.5453);
      float h2=fract(sin(aSeed*45.23+1.0)*24634.6345);
      float u=h1*2.0-1.0; float th=h2*6.2831; float s=sqrt(max(0.0,1.0-u*u));
      vec3 scat=position+vec3(cos(th)*s,u,sin(th)*s)*2.6;
      vec3 p=mix(scat,formed,smoothstep(0.0,1.0,uProgress));
      vY=p.y; vWY=(modelMatrix*vec4(p,1.0)).y;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
    }`; }
  fShader(refl){ return `
    uniform float uTime,uScan,uGround,uSelected,uExplode,uFill,uPlan,uPlanY,uPlanH,uPlanX,uPlanW,uCut,uCutZ; uniform vec3 uColor,uColor2;
    varying float vSel,vSeed,vY,vWY,vPart,vHot,vMZ,vMX;
    void main(){
      if(vHot>0.5) discard;   // hot/internal systems handled by the red inner pass
      if(uCut>0.5 && vMZ>uCutZ) discard;   // facade cutaway
      float fl=0.88+0.12*sin(uTime*5.0+vSeed*40.0);
      float band=smoothstep(0.10,0.0,abs(vY-uScan));
      float sel = uSelected<0.0 ? 1.0 : (vSel>0.5?1.9:0.12);
      vec3 col=uColor + band*vec3(0.18,0.30,0.38);
      col=mix(col, vec3(0.90,1.0,1.0), vSel*0.85);   // выделенный узел — белым
      col*=1.0 + vSel*1.6;                            // мягкое свечение заливки выделенного узла
      float a=fl*(0.03*sel + band*0.07*sel)*uFill;
      if(uPlan>0.5) a*=(1.0-smoothstep(uPlanH,uPlanH*2.0,abs(vY-uPlanY)))
                    *(1.0-0.95*smoothstep(uPlanW,uPlanW*1.25,abs(vMX-uPlanX)));  // соседние секции — в фон
      ${refl?'a*=0.14*smoothstep(uGround-3.0,uGround,vWY)*(1.0-0.85*clamp(uExplode,0.0,1.0));':''}
      gl_FragColor=vec4(col,a);
    }`; }
  get fShaderBold(){ return `
    uniform float uTime,uScan,uSelected,uBold,uBAmt,uPlan,uPlanY,uPlanH,uPlanX,uPlanW,uCut,uCutZ; uniform vec3 uColor,uBTint;
    varying float vSel,vSeed,vY,vWY,vPart,vHot,vMZ,vMX;
    void main(){
      if(vHot>0.5) discard;
      if(uCut>0.5 && vMZ>uCutZ) discard;   // facade cutaway
      float fl=0.9+0.1*sin(uTime*5.0+vSeed*40.0);
      float band=smoothstep(0.10,0.0,abs(vY-uScan));
      float sel = uSelected<0.0 ? 1.0 : (vSel>0.5?2.0:0.10);
      // contour tint is mode-aware: whiter for scans, reference blue-cyan for structured
      vec3 col=mix(uColor, uBTint, uBAmt) + band*vec3(0.12,0.20,0.30);
      col=mix(col, vec3(0.94,1.0,1.0), vSel*0.92);   // выделенный узел — яркий белый контур
      col*=1.0 + vSel*(2.6+0.45*sin(uTime*2.3));      // HDR-свечение выделенного контура (раздувается bloom)
      float a=fl*(0.30*sel + band*0.16*sel)*uBold;
      if(uPlan>0.5) a*=(1.0-smoothstep(uPlanH,uPlanH*2.0,abs(vY-uPlanY)))
                    *(1.0-0.95*smoothstep(uPlanW,uPlanW*1.25,abs(vMX-uPlanX)));  // соседние секции — в фон
      gl_FragColor=vec4(col, a);
    }`; }
  get fShaderInner(){ return `
    uniform float uTime,uScan,uSelected,uExplode,uHotInt,uPlan,uPlanY,uPlanH,uPlanX,uPlanW,uCut,uCutZ; uniform vec3 uColor2;
    varying float vSel,vSeed,vY,vWY,vPart,vHot,vMZ,vMX;
    void main(){
      if(vHot<0.5) discard;   // only the hot/internal systems (red)
      if(uCut>0.5 && vMZ>uCutZ) discard;   // facade cutaway
      float fl=0.85+0.15*sin(uTime*5.0+vSeed*40.0);
      float band=smoothstep(0.10,0.0,abs(vY-uScan));
      float sel = uSelected<0.0 ? 1.0 : (vSel>0.5?2.0:0.4);
      vec3 col=uColor2*1.2 + band*vec3(0.30,0.10,0.03);
      col=mix(col, vec3(1.0,0.98,0.94), vSel*0.92);  // выделенный горячий узел — белым
      col*=1.0 + vSel*(2.4+0.45*sin(uTime*2.3));      // HDR-свечение (раздувается bloom)
      float a=fl*(0.18*sel + band*0.12*sel)*uHotInt;
      if(uPlan>0.5) a*=(1.0-smoothstep(uPlanH,uPlanH*2.0,abs(vY-uPlanY)))
                    *(1.0-0.95*smoothstep(uPlanW,uPlanW*1.25,abs(vMX-uPlanX)));  // соседние секции — в фон
      gl_FragColor=vec4(col, a);
    }`; }
  get vShellShader(){ return `
    varying vec4 vClip;
    varying vec3 vNw,vPw;
    void main(){
      vec4 mv=modelViewMatrix*vec4(position,1.0);
      vClip=projectionMatrix*mv;
      vPw=(modelMatrix*vec4(position,1.0)).xyz;
      vNw=normalize(mat3(modelMatrix)*normal);
      gl_Position=vClip;
    }`; }
  // Shell surface = ektogamat HolographicMaterial (MIT) adapted: scanlines + Fresnel,
  // UV-free (screen-space coords, since single-mesh scans carry no UVs). Our fades
  // (assemble uProgress / explode uExplode / selected uSelected) preserved verbatim.
  get fShellShader(){ return `
    uniform vec3 uColor; uniform float uTime,uExplode,uSelected,uProgress,uShellOp;
    varying vec4 vClip; varying vec3 vNw,vPw;
    const float scanlineSize=7.0, signalSpeed=0.9, fresnelAmount=0.5, fresnelOpacity=1.0, holoBright=0.85;
    float flick(float amt,float t){ return clamp(fract(cos(t)*43758.5453123), amt, 1.0); }
    float rnd(float a,float b){ return fract(cos(dot(vec2(a,b),vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 sc=vClip.xy/vClip.w; sc=sc*0.5+0.5; vec2 uv=fract(sc);
      vec4 holo=vec4(uColor, mix(holoBright, uv.y, 0.5));
      float scan=10.0;
      scan+=20.0*sin(uTime*signalSpeed*20.8 - uv.y*60.0*scanlineSize);
      scan*=smoothstep(1.3*cos(uTime*signalSpeed + uv.y*scanlineSize), 0.78, 0.9);
      scan*=max(0.25, sin(uTime*signalSpeed));
      float r=rnd(uv.x,uv.y), b=rnd(uv.y*0.9,uv.y*0.2);
      holo+=vec4(r*scan, b*scan, r, 1.0)/84.0;
      vec4 scanMix=mix(vec4(0.0), holo, holo.a);
      vec3 Vd=normalize(cameraPosition - vPw);
      float fres=dot(Vd, normalize(vNw))*(1.6 - fresnelOpacity/2.0);
      fres=clamp(fresnelAmount - fres, 0.0, fresnelOpacity);
      float blink=flick(0.82, uTime*0.3);
      vec3 col=scanMix.rgb + fres*blink;
      float fade=(1.0-0.96*clamp(uExplode,0.0,1.0))*(uSelected<0.0?1.0:0.55)*smoothstep(0.0,1.0,uProgress);
      gl_FragColor=vec4(col, 0.13*fade*uShellOp);
    }`; }
