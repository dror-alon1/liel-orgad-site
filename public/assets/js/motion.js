"use strict";
/* Scroll Reveal (fade in up, staggered), like droralon.com.
   Every heading, paragraph, button, image, card and list item starts lower and transparent,
   and rises into place once when it enters the viewport. */
var MotionLib=(function(){
  var SEL=["main h1","main h2","main h3","main p","main li","main .btn","main picture","main img","main form","main blockquote","main [data-reveal]","footer img","footer h2","footer li","footer p"].join(",");
  var HERO="[data-hero-title],[data-hero-fade],[data-hero-photo]";
  function initMotion(){
    var root=document.documentElement;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){root.classList.remove("rv-on");return function(){};}
    window.__motion=true;root.classList.add("rv-on");
    var hero=Array.prototype.slice.call(document.querySelectorAll(HERO));
    hero.forEach(function(el,i){el.style.transitionDelay=Math.min(i*120,720)+"ms";requestAnimationFrame(function(){requestAnimationFrame(function(){el.classList.add("show")})})});
    var heroSet=new Set(hero),list=[];
    document.querySelectorAll(SEL).forEach(function(el){
      if(heroSet.has(el)||el.closest(HERO+",[data-no-reveal]"))return;
      if(list.some(function(p){return p.contains(el)}))return;
      list.push(el);
    });
    list.forEach(function(el){el.classList.add("rv")});
    var io=new IntersectionObserver(function(entries){
      entries.filter(function(e){return e.isIntersecting}).map(function(e){return e.target})
        .sort(function(a,b){return a.getBoundingClientRect().top-b.getBoundingClientRect().top||b.getBoundingClientRect().left-a.getBoundingClientRect().left})
        .forEach(function(el,i){
          el.style.transitionDelay=Math.min(i*110,550)+"ms";el.classList.add("show");io.unobserve(el);
          el.addEventListener("transitionend",function(){el.style.transitionDelay=""},{once:true});
        });
    },{threshold:0.15,rootMargin:"0px 0px -8% 0px"});
    list.forEach(function(el){io.observe(el)});
    return function(){io.disconnect()};
  }
  return {initMotion:initMotion};
})();
