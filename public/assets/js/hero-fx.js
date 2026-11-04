/* Hero background: slow flowing blue light, WebGL fragment shader. No video file, no network. */
(function(){
  var canvases=document.querySelectorAll('canvas.hero-fx');
  if(!canvases.length) return;
  var reduce=false; try{reduce=matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
  var FS=[
  'precision mediump float;uniform vec2 r;uniform float t;',
  'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
  'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
  'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}',
  'void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.)*1.6;float s=t*.045;',
  'vec2 q=vec2(fbm(p+vec2(0.,s)),fbm(p+vec2(5.2,1.3)-s));',
  'vec2 w=vec2(fbm(p+2.2*q+vec2(1.7,9.2)+s*1.4),fbm(p+2.2*q+vec2(8.3,2.8)-s));',
  'float f=fbm(p+2.4*w);',
  'vec3 deep=vec3(.031,.141,.365),mid=vec3(.259,.42,.651),light=vec3(.863,.914,.973);',
  'vec3 c=mix(deep,mid,smoothstep(.25,.85,f));',
  'c=mix(c,light,smoothstep(.62,1.05,f*length(w))*.85);',
  'float band=sin((uv.x*1.3+uv.y*2.2+f*1.8)*6.2831-t*.35);c+=light*.10*smoothstep(.92,1.,band);',
  'c*=.88+.12*uv.y;gl_FragColor=vec4(c,1.);}'].join('\n');
  var VS='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  canvases.forEach(function(cv){
    var gl=cv.getContext('webgl',{antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
    if(!gl){cv.classList.add('hero-fx-fallback');return;}
    function sh(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s;}
    var pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){cv.classList.add('hero-fx-fallback');return;}
    gl.useProgram(pr);
    var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    var loc=gl.getAttribLocation(pr,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    var ur=gl.getUniformLocation(pr,'r'),ut=gl.getUniformLocation(pr,'t');
    var visible=true,start=performance.now()-20000,raf=0;
    function size(){var d=Math.min(window.devicePixelRatio||1,1.5)*0.6;var w=Math.max(1,Math.round(cv.clientWidth*d)),h=Math.max(1,Math.round(cv.clientHeight*d));if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;gl.viewport(0,0,w,h);}}
    function draw(now){size();gl.uniform2f(ur,cv.width,cv.height);gl.uniform1f(ut,(now-start)/1000);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
    function loop(now){draw(now);if(visible&&!reduce)raf=requestAnimationFrame(loop);}
    if('IntersectionObserver' in window){new IntersectionObserver(function(e){var v=e[0].isIntersecting;if(v&&!visible){visible=true;raf=requestAnimationFrame(loop);}else if(!v){visible=false;cancelAnimationFrame(raf);}}).observe(cv);}
    document.addEventListener('visibilitychange',function(){if(document.hidden){cancelAnimationFrame(raf);}else if(visible&&!reduce){raf=requestAnimationFrame(loop);}});
    window.addEventListener('resize',function(){if(reduce)draw(start+40000);});
    cv.classList.add('hero-fx-on');
    if(reduce){draw(start+40000);}else{raf=requestAnimationFrame(loop);}
  });
})();
