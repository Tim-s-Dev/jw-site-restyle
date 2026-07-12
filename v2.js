const RM=matchMedia('(prefers-reduced-motion:reduce)').matches;
const TOUCH=matchMedia('(hover:none)').matches;
const html=document.documentElement;

/* ---------- custom cursor ---------- */
if(!TOUCH){
  const dot=document.getElementById('cur'),ring=document.getElementById('curr'),lab=ring.querySelector('.lab');
  let mx=innerWidth/2,my=innerHeight/2,rx=mx,ry=my;
  addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY;dot.style.transform=`translate(${mx}px,${my}px) translate(-50%,-50%)`;});
  (function loop(){rx+=(mx-rx)*.18;ry+=(my-ry)*.18;ring.style.transform=`translate(${rx}px,${ry}px) translate(-50%,-50%)`;requestAnimationFrame(loop);})();
  document.querySelectorAll('[data-cursor]').forEach(el=>{
    el.addEventListener('pointerenter',()=>{ring.classList.add('big');lab.textContent=el.dataset.cursor;});
    el.addEventListener('pointerleave',()=>{ring.classList.remove('big');lab.textContent='';});
  });
  document.querySelectorAll('a,button,.wcard,.svc').forEach(el=>{
    if(el.hasAttribute('data-cursor'))return;
    el.addEventListener('pointerenter',()=>ring.classList.add('link'));
    el.addEventListener('pointerleave',()=>ring.classList.remove('link'));
  });
}

/* ---------- magnetic ---------- */
if(!RM&&!TOUCH){
  document.querySelectorAll('.mag').forEach(el=>{
    el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect();el.style.transform=`translate(${(e.clientX-(r.left+r.width/2))*.28}px,${(e.clientY-(r.top+r.height/2))*.5}px)`;});
    el.addEventListener('pointerleave',()=>el.style.transform='');
  });
}

/* ---------- nav ---------- */
addEventListener('scroll',()=>document.getElementById('nav').classList.toggle('scrolled',scrollY>40),{passive:true});

/* ---------- drawer stub ---------- */
/* lead drawer: chrome.js owns [data-open-drawer] when loaded; this is only a
   fallback notice for previews served without chrome.js */
document.querySelectorAll('[data-open-drawer]').forEach(b=>b.addEventListener('click',()=>{
  if(!(window.JW&&window.JW.openDrawer)) alert('[preview] The lead drawer (formsubmit + GHL booking) wires up on the live build.');
}));

/* homepage: hydrate the pinned work gallery from the creator-tunnel live feed.
   Static cards remain as the skeleton/fallback. */
addEventListener('load',async()=>{
  const track=document.getElementById('wtrack');
  if(!track||!(window.JW&&window.JW.loadCtTag))return;
  try{
    let data=await window.JW.loadCtTag('live-feed:recent-work',8);
    if(!data||!data.assets||!data.assets.length) data=await window.JW.loadCtTag('live-feed:episode',8);
    if(!data||!data.assets||!data.assets.length)return;
    const cards=track.querySelectorAll('.wcard');
    data.assets.slice(0,cards.length).forEach((a,i)=>{
      const c=cards[i], img=c.querySelector('img'), t=c.querySelector('.info .t'), s=c.querySelector('.info .s');
      if(a.thumbnail_url&&img){img.src=a.thumbnail_url;img.alt=a.display_title||a.title||'';}
      if(t)t.textContent=(a.display_title||a.title||t.textContent).slice(0,60);
      if(s)s.textContent=[a.brand||'JourneyWell','Studio'].join(' · ');
      c.dataset.assetId=a.id;
      c.addEventListener('click',()=>{ if(window.JW.openVideoOverlay)window.JW.openVideoOverlay(a,data.assets); });
    });
  }catch(e){/* keep static skeleton */}
});

/* ---------- loader → then boot ---------- */
function boot(){
  if(window.lenis_started)return; window.lenis_started=true;

  /* smooth scroll */
  let lenis=null;
  if(window.Lenis && !RM && !navigator.webdriver){
    lenis=new Lenis({duration:1.1,easing:t=>Math.min(1,1.001-Math.pow(2,-10*t))});
    function raf(t){lenis.raf(t);requestAnimationFrame(raf);} requestAnimationFrame(raf);
    if(window.gsap&&window.ScrollTrigger){lenis.on('scroll',ScrollTrigger.update);}
  }

  if(!window.gsap){ html.classList.remove('janim'); return; }
  gsap.registerPlugin(ScrollTrigger);
  if(lenis) gsap.ticker.add(t=>lenis.raf(t*1000)), gsap.ticker.lagSmoothing(0);

  if(RM){ html.classList.remove('janim'); document.querySelectorAll('.reveal,.he-in').forEach(e=>e.style.opacity=1); return; }
  html.classList.remove('janim');

  /* hero entrance */
  gsap.set('.hero h1 .ln i',{yPercent:105});
  gsap.set('.he-in',{y:24,autoAlpha:0,filter:'blur(6px)'});
  const tl=gsap.timeline();
  tl.to('.hero h1 .ln i',{yPercent:0,duration:1.15,ease:'expo.out',stagger:.1},0)
    .to('.he-in',{y:0,autoAlpha:1,filter:'blur(0px)',duration:1,ease:'expo.out',stagger:.12},'0.35');

  /* generic reveals */
  gsap.utils.toArray('.reveal').forEach(el=>{
    gsap.fromTo(el,{y:40,autoAlpha:0,filter:'blur(6px)'},{y:0,autoAlpha:1,filter:'blur(0px)',duration:1,ease:'power3.out',
      scrollTrigger:{trigger:el,start:'top 86%'}});
  });

  /* parallax (elements) */
  gsap.utils.toArray('[data-parallax]').forEach(el=>{
    gsap.to(el,{yPercent:parseFloat(el.dataset.parallax),ease:'none',scrollTrigger:{trigger:el,start:'top bottom',end:'bottom top',scrub:1}});
  });
  /* parallax (images inside frames) */
  gsap.utils.toArray('[data-parallax-img]').forEach(img=>{
    gsap.fromTo(img,{yPercent:-6},{yPercent:6,ease:'none',scrollTrigger:{trigger:img.closest('section,div'),start:'top bottom',end:'bottom top',scrub:1}});
  });

  /* marquee */
  gsap.to('#mq',{xPercent:-50,repeat:-1,duration:26,ease:'none'});

  /* manifesto scrub */
  (function(){
    const p=document.getElementById('mani'); if(!p)return;
    const words=p.textContent.trim().split(/\s+/);
    const hot=new Set(['in-house.','you.']);
    p.innerHTML=words.map(w=>`<span class="w${hot.has(w)?' hot':''}">${w}</span>`).join(' ');
    gsap.to('#mani .w',{color:(i,t)=>t.classList.contains('hot')?'#CFF42A':'#F6F5F2',stagger:.4,ease:'none',
      scrollTrigger:{trigger:'.mani',start:'top 72%',end:'bottom 80%',scrub:.6}});
  })();

  /* horizontal work pan */
  (function(){
    const track=document.getElementById('wtrack'); if(!track)return;
    const dist=()=>track.scrollWidth-innerWidth+80;
    gsap.to(track,{x:()=>-dist(),ease:'none',scrollTrigger:{trigger:'.work-sec .pin',start:'top top',end:()=>'+='+dist(),pin:true,scrub:1,invalidateOnRefresh:true,anticipatePin:1}});
  })();

  /* count-up stats */
  gsap.utils.toArray('.count').forEach(el=>{
    const to=parseFloat(el.dataset.to),dec=parseInt(el.dataset.dec||'0');
    const o={v:0};
    gsap.to(o,{v:to,duration:1.6,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 88%'},
      onUpdate:()=>{el.textContent=dec?o.v.toFixed(dec):Math.round(o.v);}});
  });

  /* text-scramble decode on section headings */
  const SC='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*/<>';
  function scramble(el){
    const html=el.innerHTML, txt=el.textContent, len=txt.length;
    const total=Math.max(16,Math.round(len*0.55)), rev=[];
    for(let i=0;i<len;i++) rev[i]=Math.floor(i*total/len)+(Math.random()*4|0);
    let f=0;
    const id=setInterval(()=>{
      let o=''; for(let i=0;i<len;i++){const c=txt[i]; o+=(c===' '||c==='\n')?c:(f>=rev[i]?c:SC[Math.random()*SC.length|0]);}
      el.textContent=o; if(++f>total+4){clearInterval(id); el.innerHTML=html;}
    },26);
  }
  gsap.utils.toArray('h2').forEach(el=>{
    ScrollTrigger.create({trigger:el,start:'top 84%',once:true,onEnter:()=>scramble(el)});
  });

  /* inner-page hero entrance */
  if(document.querySelector('.phero h1 .ln i')){
    gsap.set('.phero h1 .ln i',{yPercent:105});
    gsap.to('.phero h1 .ln i',{yPercent:0,duration:1.15,ease:'expo.out',stagger:.1,delay:.05});
  }

  initHeroGL();
  initWave();
  initFaq();
  initFilter();
  ScrollTrigger.refresh();
}

/* ---------- FAQ accordion ---------- */
function initFaq(){
  document.querySelectorAll('.fq').forEach(fq=>{
    const q=fq.querySelector('.q'),a=fq.querySelector('.a'); if(!q||!a)return;
    q.addEventListener('click',()=>{
      const open=fq.classList.contains('open');
      fq.parentElement.querySelectorAll('.fq.open').forEach(o=>{o.classList.remove('open');o.querySelector('.a').style.maxHeight='0px';});
      if(!open){fq.classList.add('open');a.style.maxHeight=a.scrollHeight+'px';}
    });
  });
}

/* ---------- work filter tabs ---------- */
function initFilter(){
  const tabs=document.querySelectorAll('.wtab'); if(!tabs.length)return;
  const cards=document.querySelectorAll('.wgrid .wcard');
  tabs.forEach(t=>t.addEventListener('click',()=>{
    tabs.forEach(o=>o.classList.remove('on')); t.classList.add('on');
    const f=t.dataset.filter;
    cards.forEach(c=>{
      const show=(f==='all')||(c.dataset.cat||'').split(' ').includes(f);
      c.classList.toggle('hidden',!show);
    });
    if(window.ScrollTrigger)ScrollTrigger.refresh();
  }));
}

/* ---------- WebGL interactive hero (real photo → liquid surface) ---------- */
function initHeroGL(){
  if(RM) return;
  const wrap=document.querySelector('.hero-media'); if(!wrap) return;
  const img=wrap.querySelector('img'), cv=wrap.querySelector('.glc'); if(!img||!cv) return;
  let gl; try{ gl=cv.getContext('webgl',{antialias:true,preserveDrawingBuffer:false})||cv.getContext('experimental-webgl'); }catch(e){ window.__glerr='ctx:'+e; }
  if(!gl){ window.__glerr=window.__glerr||'no-context'; return; }
  const start=()=>{ try{ run(); }catch(e){ window.__glerr='run:'+e; } };
  if(img.complete && img.naturalWidth) start(); else img.addEventListener('load',start,{once:true});
  function run(){
    const vs='attribute vec2 p;varying vec2 vUv;void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}';
    const fs='precision highp float;varying vec2 vUv;uniform sampler2D tex;uniform vec2 mo;uniform float t;uniform vec2 cov;'+
      'void main(){vec2 uv=(vUv-0.5)*cov+0.5;float d=distance(vUv,mo);'+
      'float rip=sin(d*20.0-t*2.2)*0.012*smoothstep(0.55,0.0,d);vec2 dir=normalize(vUv-mo+1e-4);'+
      'vec2 idle=vec2(sin(t*0.5+vUv.y*5.0),cos(t*0.45+vUv.x*5.0))*0.0016;vec2 dp=dir*rip+idle;'+
      'float ca=0.007*smoothstep(0.6,0.0,d);'+
      'float r=texture2D(tex,uv+dp+dir*ca).r;float g=texture2D(tex,uv+dp).g;float b=texture2D(tex,uv+dp-dir*ca).b;'+
      'vec3 col=vec3(r,g,b)+vec3(0.81,0.96,0.16)*smoothstep(0.32,0.0,d)*0.06;gl_FragColor=vec4(col,1.0);}';
    function sh(ty,s){const o=gl.createShader(ty);gl.shaderSource(o,s);gl.compileShader(o);
      if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o;}
    const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,vs));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs));
    gl.linkProgram(pr); if(!gl.getProgramParameter(pr,gl.LINK_STATUS)) throw 'link'; gl.useProgram(pr);
    const bf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const pl=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(pl);gl.vertexAttribPointer(pl,2,gl.FLOAT,false,0,0);
    const tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const uMo=gl.getUniformLocation(pr,'mo'),uT=gl.getUniformLocation(pr,'t'),uCov=gl.getUniformLocation(pr,'cov');
    gl.uniform1i(gl.getUniformLocation(pr,'tex'),0);
    let mx=0.5,my=0.5,tx2=0.5,ty2=0.5;
    function rs(){const r=cv.getBoundingClientRect();const dpr=Math.min(devicePixelRatio,2);
      cv.width=Math.max(1,r.width*dpr);cv.height=Math.max(1,r.height*dpr);gl.viewport(0,0,cv.width,cv.height);
      const rB=r.width/r.height,rI=img.naturalWidth/img.naturalHeight;let sx=1,sy=1;
      if(rB>rI){sy=rI/rB;}else{sx=rB/rI;}gl.uniform2f(uCov,sx,sy);}
    rs();addEventListener('resize',rs);
    wrap.addEventListener('pointermove',e=>{const r=cv.getBoundingClientRect();tx2=(e.clientX-r.left)/r.width;ty2=1-(e.clientY-r.top)/r.height;});
    wrap.addEventListener('pointerleave',()=>{tx2=0.5;ty2=0.5;});
    wrap.classList.add('gl-on');
    const t0=performance.now();
    (function frame(){mx+=(tx2-mx)*0.08;my+=(ty2-my)*0.08;gl.uniform2f(uMo,mx,my);
      gl.uniform1f(uT,(performance.now()-t0)/1000);gl.drawArrays(gl.TRIANGLES,0,3);requestAnimationFrame(frame);})();
  }
}

/* ---------- signal waveform ---------- */
function initWave(){
  const cv=document.getElementById('wave'); if(!cv) return; const x=cv.getContext('2d'); if(!x) return;
  let w=0,h=0;
  function rs(){const r=cv.getBoundingClientRect();const dpr=Math.min(devicePixelRatio,2);
    cv.width=(w=r.width)*dpr;cv.height=(h=r.height)*dpr;x.setTransform(dpr,0,0,dpr,0,0);}
  rs();addEventListener('resize',rs);
  let t=0;
  function draw(){
    t+=0.024; x.clearRect(0,0,w,h); const mid=h/2, n=Math.floor(w/9);
    for(let i=0;i<n;i++){const px=i*9+4;
      const a=Math.sin(i*0.30+t)*0.5+Math.sin(i*0.13-t*1.25)*0.32+Math.sin(i*0.07+t*0.6)*0.22;
      const bar=Math.abs(a)*(h*0.32)+2;
      x.fillStyle=(i%6===0)?'#CFF42A':'rgba(207,244,42,0.26)';
      x.fillRect(px,mid-bar,3,bar*2);
    }
    if(!RM) requestAnimationFrame(draw);
  }
  draw();
}

/* loader animation */
(function(){
  const load=document.getElementById('load');
  if(RM||!window.gsap||!load){ if(load)load.style.display='none'; boot(); return; }
  gsap.registerPlugin(ScrollTrigger);
  const tl=gsap.timeline({onComplete:boot});
  tl.fromTo('#load .lt',{y:40,autoAlpha:0},{y:0,autoAlpha:1,duration:.7,ease:'expo.out'})
    .fromTo('#load .dot',{scale:0,rotate:-40},{scale:1,rotate:0,duration:.7,ease:'back.out(2)'},0)
    .fromTo('#load .bar',{width:'0%'},{width:'100%',duration:.9,ease:'power2.inOut'},'0.2')
    .to('#load .lw',{y:-20,autoAlpha:0,duration:.5,ease:'power2.in'},'+=0.15')
    .to('#load',{yPercent:-100,duration:.8,ease:'expo.inOut'},'-=0.1')
    .set('#load',{display:'none'});
})();
/* safety: never leave the site hidden */
addEventListener('load',()=>setTimeout(()=>{ if(html.classList.contains('janim')){ html.classList.remove('janim'); const l=document.getElementById('load'); if(l)l.style.display='none'; boot(); } },6000));
