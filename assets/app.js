
const ICONS = window.ICONS;
const HOME = {lat:41.5381, lng:2.4445};
const BBOX = [[38.4,-3.4],[45.8,6.4]];
const LAYERS = [
  {k:"evento",l:"Eventos",c:"--ev",i:"party-popper"},
  {k:"ruta",l:"Escapadas",c:"--ru",i:"route"},
  {k:"visita",l:"Visitas",c:"--vi",i:"castle"},
  {k:"naturaleza",l:"Naturaleza",c:"--na",i:"trees"},
  {k:"pernocta",l:"Dormir",c:"--pe",i:"moon"}];
const TYPE_ICON = [["navidad","tree-pine"],["medieval","shield"],["castillo","castle"],["museo","landmark"],["parque-animales","paw-print"],["parque-tematico","ferris-wheel"],["tren","train-front"],["cueva","flashlight"],["playa","waves"],["lago","droplets"],["rio","droplets"],["mirador","binoculars"],["montana","mountain-snow"],["paseo","footprints"],["area-ac","caravan"],["camping","tent"],["parking","square-parking"],["gastronomia","utensils"],["musica","music"],["mercado","store"],["festival","ticket"],["feria","ticket"],["fiesta","party-popper"],["ciudad","building-2"],["pueblo","house"],["monumento","landmark"]];
const TYPES = [
  {k:"ferias",l:"Ferias y fiestas",i:"party-popper",t:["feria","fiesta","mercado","festival","musica","gastronomia"]},
  {k:"medieval",l:"Medieval",i:"shield",t:["medieval"]},{k:"navidad",l:"Navidad",i:"tree-pine",t:["navidad"]},
  {k:"ciudad",l:"Ciudades",i:"building-2",t:["ciudad"]},{k:"pueblo",l:"Pueblos",i:"house",t:["pueblo"]},
  {k:"castillo",l:"Castillos",i:"castle",t:["castillo","monumento"]},{k:"museo",l:"Museos",i:"landmark",t:["museo"]},
  {k:"animales",l:"Animales y parques",i:"paw-print",t:["parque-animales","parque-tematico","tren"]},
  {k:"paseo",l:"Paseos",i:"footprints",t:["paseo"]},{k:"montana",l:"Montaña",i:"mountain-snow",t:["montana","mirador"]},
  {k:"agua",l:"Agua y playa",i:"waves",t:["playa","lago","rio"]},{k:"cueva",l:"Cuevas",i:"flashlight",t:["cueva"]},
  {k:"area",l:"Áreas AC",i:"caravan",t:["area-ac"]},{k:"camping",l:"Campings",i:"tent",t:["camping"]},{k:"parking",l:"Parkings",i:"square-parking",t:["parking"]}];
const DMODES = [{k:"todo",l:"Cualquier fecha"},{k:"finde",l:"Este finde"},{k:"prox",l:"Próximo finde"},{k:"30",l:"Próximos 30 días"},{k:"rango",l:"Elegir fechas"}];
const DURS = [{k:"1",l:"1 día",f:d=>d<=1},{k:"2",l:"2–3 días",f:d=>d>=2&&d<=3},{k:"4",l:"4 o más",f:d=>d>=4}];
const MES=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const DIA=["dom","lun","mar","mié","jue","vie","sáb"];
const SECTIONS=[{k:"explore",l:"Explorar",i:"map"},{k:"saved",l:"Guardados",i:"heart"},{k:"trips",l:"Salidas",i:"calendar-days"}];

const S = { pts:[], byId:new Map(), layers:new Set(LAYERS.map(l=>l.k)), types:new Set(), dur:new Set(), dmode:"todo", from:null, to:null, maxmin:300,
  ninos:false, ac:false, gratis:false, hideSeen:false, top:false, q:"", hl:null, sort:"auto", follow:true, sel:null, hov:null, focus:null, fopen:null, limit:40,
  section:"explore", detail:null, saved:"favs", tripId:null, style:"mapa", pw:400, collapsed:false,
  est:{favs:{},vistos:{},salidas:[]}, estRef:null, filtered:[], inView:[], askText:"" };

const $ = id => document.getElementById(id);
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ic = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]||ICONS["map-pin"]}</svg>`;
const iso = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const today = () => { const d=new Date(); d.setHours(0,0,0,0); return d; };
const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
const layerOf = p => LAYERS.find(l=>l.k===p.capa)||LAYERS[2];
const colorVar = p => "var("+layerOf(p).c+")";
const isMobile = () => matchMedia("(max-width:820px)").matches;
function iconOf(p){ if(p.capa==="ruta")return "route"; if(p.capa==="pernocta"){const t=p.tipos||[];return t.includes("camping")?"tent":t.includes("parking")?"square-parking":"caravan";}
  for(const [t,i] of TYPE_ICON) if((p.tipos||[]).includes(t)) return i; return layerOf(p).i; }
function hav(a,b,c,d){const R=6371,r=x=>x*Math.PI/180;const x=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function roadKm(p){return Math.round(hav(HOME.lat,HOME.lng,p.lat,p.lng)*1.25);}
function driveMin(p){const km=roadKm(p);const near=Math.min(km,60);return Math.round(near/65*60+Math.max(0,km-60)/92*60+5);}
function fmtMin(m){if(m<60)return m+" min";const h=Math.floor(m/60),r=m%60;return h+" h"+(r?" "+String(r).padStart(2,"0"):"");}
function fmtD(s){const d=new Date(s+"T12:00:00");return DIA[d.getDay()]+" "+d.getDate()+" "+MES[d.getMonth()];}
function fmtRange(p){if(!p.fecha_inicio)return "";const a=p.fecha_inicio,b=p.fecha_fin||a;return a===b?fmtD(a):fmtD(a)+" – "+fmtD(b);}
function weekend(offset){const t=today();const dow=t.getDay();const sat=new Date(t);
  if(dow===0)sat.setDate(t.getDate()-1);else if(dow!==6)sat.setDate(t.getDate()+(6-dow));
  sat.setDate(sat.getDate()+7*offset);const fri=new Date(sat);fri.setDate(sat.getDate()-1);const sun=new Date(sat);sun.setDate(sat.getDate()+1);return [iso(fri),iso(sun)];}
function dateWindow(){const t=iso(today());
  if(S.dmode==="finde")return weekend(0); if(S.dmode==="prox")return weekend(1);
  if(S.dmode==="30"){const e=today();e.setDate(e.getDate()+30);return [t,iso(e)];}
  if(S.dmode==="rango")return [S.from||t,S.to||"2099-12-31"]; return [t,"2099-12-31"];}
const overlaps=(p,a,b)=>{const ini=p.fecha_inicio,fin=p.fecha_fin||ini;return !!ini&&fin>=a&&ini<=b;};
const isFav=id=>!!S.est.favs[id], isSeen=id=>!!S.est.vistos[id];

function matches(p){
  if(S.focus){const tr=S.est.salidas.find(t=>t.id===S.focus);return !!tr&&tr.ids.includes(p.id);}
  if(!S.layers.has(p.capa))return false;
  if(p.capa==="evento"){const [a,b]=dateWindow();if(!overlaps(p,a,b))return false;}
  if(p.capa==="ruta"&&S.dur.size){const d=+p.dias||1;if(![...S.dur].some(k=>DURS.find(x=>x.k===k).f(d)))return false;}
  if(S.types.size){const want=new Set();for(const k of S.types)for(const t of TYPES.find(x=>x.k===k).t)want.add(t);if(!(p.tipos||[]).some(t=>want.has(t)))return false;}
  if(S.maxmin<300&&p._min>S.maxmin)return false;
  if(S.ninos&&!p.ninos)return false;
  if(S.ac&&!(p.ac7m==="si"||p.ac7m==="cerca"))return false;
  if(S.gratis&&p.precio!=="gratis")return false;
  if(S.hideSeen&&isSeen(p.id))return false;
  if(S.top&&p.nivel===2)return false;
  if(S.q&&!S.q.split(/\s+/).every(w=>p._h.includes(w)))return false;
  return true;}
function sorter(mode){
  const rank=p=>p.capa==="evento"?0:p.capa==="ruta"?1:2;
  if(mode==="near")return (a,b)=>a._min-b._min;
  if(mode==="az")return (a,b)=>a.nombre.localeCompare(b.nombre,"es");
  if(mode==="date")return (a,b)=>(a.fecha_inicio||"9999").localeCompare(b.fecha_inicio||"9999")||a._min-b._min;
  return (a,b)=>{if(a.capa==="evento"&&b.capa==="evento")return a.fecha_inicio.localeCompare(b.fecha_inicio)||a._min-b._min;return rank(a)-rank(b)||a._min-b._min;};}
function filterCount(){return S.types.size+S.dur.size+(S.ninos?1:0)+(S.ac?1:0)+(S.gratis?1:0)+(S.hideSeen?1:0)+(S.top?1:0)+(S.dmode!=="todo"?1:0)+(S.maxmin<300?1:0);}

/* ===== mapa base ===== */
const map=L.map("map",{zoomControl:false,attributionControl:true,minZoom:5,maxZoom:18,maxBounds:L.latLngBounds([[34,-12],[50,14]]),zoomSnap:.25,zoomDelta:.5,scrollWheelZoom:false,zoomAnimation:true,zoomAnimationThreshold:4}).setView([42.0,1.4],7);
map.attributionControl.setPrefix(false);
/* Zoom con rueda: se acumula el gesto (Magic Mouse y trackpad envían muchos eventos pequeños con inercia)
   y se aplica UN zoom animado por gesto, proporcional a su tamaño. Mientras anima, se sigue acumulando. */
(function(){let acc=0,pt=null,t=0;const PX=380;
  let decay=0;
  function go(){t=0;if(map._animatingZoom){t=setTimeout(go,60);return;}let dz=Math.max(-1.5,Math.min(1.5,-acc/PX));dz=Math.round(dz*4)/4;
    if(!dz){clearTimeout(decay);decay=setTimeout(()=>acc=0,400);return;}/* gesto aún pequeño: se guarda por si sigue */
    acc=0;const z=Math.max(map.getMinZoom(),Math.min(map.getMaxZoom(),map.getZoom()+dz));if(z===map.getZoom())return;map.setZoomAround(pt,z,{animate:true});}
  map.getContainer().addEventListener("wheel",e=>{e.preventDefault();let d=e.deltaY;if(e.deltaMode===1)d*=16;else if(e.deltaMode===2)d*=innerHeight;
    if(e.ctrlKey)d*=5;else if(Math.abs(d)>=90)d=Math.sign(d)*PX/2;/* rueda clásica: medio nivel por muesca */
    acc+=d;pt=map.mouseEventToContainerPoint(e);clearTimeout(t);clearTimeout(decay);t=setTimeout(go,map._animatingZoom?60:70);},{passive:false});})();
const baseR=L.canvas({padding:.5});
const BASES={
  mapa:{l:"Mapa",th:"https://tile.openstreetmap.org/7/64/47.png",mk:()=>[L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'})]},
  topo:{l:"Relieve",th:"https://a.tile.opentopomap.org/7/64/47.png",mk:()=>[L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",{maxZoom:17,subdomains:"abc",attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> · <a href="https://opentopomap.org" target="_blank">OpenTopoMap</a> (CC-BY-SA)'})]},
  sat:{l:"Satélite",th:"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/7/47/64",mk:()=>[L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Imágenes © Esri, Maxar, Earthstar Geographics"}),L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,pane:"overlayPane"})]},
  claro:{l:"Claro",th:"https://a.basemaps.cartocdn.com/rastertiles/voyager/7/64/47.png",mk:()=>[L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",{maxZoom:19,subdomains:"abcd",attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank">CARTO</a>'})]}
};
let baseLayers=[];
function applyStyle(){for(const l of baseLayers)l.remove();if(!BASES[S.style])S.style="mapa";baseLayers=BASES[S.style].mk();for(const l of baseLayers)l.addTo(map);renderStylePop();}
const Z=()=>map.getZoom();
L.marker([HOME.lat,HOME.lng],{keyboard:false,icon:L.divIcon({className:"",html:'<div class="home"></div>',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(map).bindTooltip("Casa · Mataró",{direction:"top",className:"tt",offset:[0,-8]});

/* ===== capa de símbolos (un solo lienzo, sprites) ===== */
const sprites=new Map(),imgs=new Map();let imgPending=0;
function iconImg(name){if(imgs.has(name))return imgs.get(name);const im=new Image();imgPending++;
  im.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||ICONS["map-pin"]}</svg>`);
  im.onload=()=>{imgPending--;sprites.clear();sym.redraw();};im.onerror=()=>{imgPending--;};imgs.set(name,im);return im;}
function hexRGB(h){h=h.replace("#","");if(h.length===3)h=h.split("").map(c=>c+c).join("");return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function mix(a,b,t){const A=hexRGB(a),B=hexRGB(b);return "rgb("+A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(",")+")";}
const DPR=Math.min(2,window.devicePixelRatio||1);
function sprite(key,draw,w,h){let s=sprites.get(key);if(s)return s;const c=document.createElement("canvas");c.width=w*DPR;c.height=h*DPR;const g=c.getContext("2d");g.scale(DPR,DPR);draw(g);s={c,w,h};sprites.set(key,s);return s;}
function pinSprite(color,icon,mode,seen){// mode: "pin" (30px) | "mini" (18px) | "dot" (8px)
  const panel=css("--panel");const fill=seen?mix(color,css("--panel").startsWith("#")?css("--panel"):"#ffffff",.55):color;
  if(mode==="dot"){return sprite(`d|${color}|${seen}`,g=>{g.beginPath();g.arc(6,6,4.5,0,7);g.fillStyle=fill;g.fill();g.lineWidth=1.5;g.strokeStyle=panel;g.stroke();},12,12);}
  if(mode==="mini"){return sprite(`m|${color}|${icon}|${seen}`,g=>{g.beginPath();g.arc(11,11,9,0,7);g.fillStyle=fill;g.fill();g.lineWidth=2;g.strokeStyle=panel;g.stroke();const im=iconImg(icon);if(im.complete&&im.naturalWidth)g.drawImage(im,5.5,5.5,11,11);},22,22);}
  return sprite(`p|${color}|${icon}|${seen}`,g=>{const cx=17,cy=15,r=13;g.beginPath();g.arc(cx,cy,r,Math.PI*.75,Math.PI*.25,false);g.lineTo(cx,cy+r+7);g.closePath();
    g.shadowColor="rgba(0,0,0,.28)";g.shadowBlur=4;g.shadowOffsetY=2;g.fillStyle=fill;g.fill();g.shadowColor="transparent";g.lineWidth=2.2;g.strokeStyle=panel;g.stroke();
    const im=iconImg(icon);if(im.complete&&im.naturalWidth)g.drawImage(im,cx-8,cy-8,16,16);},34,38);}
function heartSprite(){return sprite("heart",g=>{g.beginPath();g.arc(8,8,7,0,7);g.fillStyle=css("--panel");g.fill();const im=iconImg("heart");if(im.complete&&im.naturalWidth){g.save();g.beginPath();g.arc(8,8,7,0,7);g.clip();g.fillStyle=css("--fav");g.fillRect(0,0,16,16);g.drawImage(im,3.5,3.5,9,9);g.restore();}},16,16);}
const SymLayer=L.Canvas.extend({
  _updatePaths(){this._drawAll();},
  redraw(){const b=this._bounds;if(!b||!this._ctx)return;const s=b.getSize();this._ctx.clearRect(b.min.x,b.min.y,s.x,s.y);this._drawAll();},
  _drawAll(){const g=this._ctx;if(!g)return;const z=Z();const mode=z<7.5?"dot":z<9.5?"mini":"pin";const b=this._bounds;if(!b)return;
    const pad=40;const list=S.filtered;const hits=[];const colors={};for(const l of LAYERS)colors[l.k]=css(l.c);
    // orden: norte primero; seleccionado al final
    const pts=[];for(const p of list){if(!shown(p))continue;const pt=map.latLngToLayerPoint([p.lat,p.lng]);if(pt.x<b.min.x-pad||pt.x>b.max.x+pad||pt.y<b.min.y-pad||pt.y>b.max.y+pad)continue;pts.push([p,pt]);}
    pts.sort((a,c)=>a[1].y-c[1].y);
    const selIdx=pts.findIndex(x=>x[0].id===S.sel);if(selIdx>=0){pts.push(pts.splice(selIdx,1)[0]);}
    const labelRects=[];const showLabels=z>=11;const zs=z<11.5?1:z<13?1.15:z<15?1.3:1.45;const fs=Math.round(11*Math.min(zs,1.3));g.font=`700 ${fs}px Overpass, system-ui, sans-serif`;const lh=fs+3;g.textAlign="center";g.textBaseline="top";
    const halo=css("--label-halo"),inkc=css("--ink"),hiCol=css("--hi");
    for(const [p,pt] of pts){const seen=isSeen(p.id)&&S.sel!==p.id;const col=colors[p.capa];const sel=S.sel===p.id,hov=S.hov===p.id;
      let sp,ax,ay,hitR;
      const m2=p.nivel===2&&!sel&&!hov&&!isFav(p.id)?(z<11?"mini":mode):mode;
      if(m2==="dot"&&!sel&&!hov){sp=pinSprite(col,null,"dot",seen);ax=6;ay=6;hitR=7;}
      else if(m2==="mini"&&!sel&&!hov){sp=pinSprite(col,iconOf(p),"mini",seen);ax=11;ay=11;hitR=11;}
      else{sp=pinSprite(col,iconOf(p),"pin",seen);ax=17;ay=35;hitR=15;}
      let scale=zs;if(sel)scale=zs*1.25;else if(hov)scale=zs*1.12;
      const w=sp.w*scale,h=sp.h*scale,x=pt.x-ax*scale,y=pt.y-ay*scale;
      const headY=(ax===17)?pt.y-20*scale:pt.y;
      const inHl=S.hl?S.hl.ids.has(p.id):true;
      if(!inHl)g.globalAlpha=.3;
      else if(S.hl){g.beginPath();g.arc(pt.x,headY,hitR*scale+6,0,7);g.fillStyle="rgba(242,181,68,.32)";g.fill();g.lineWidth=2;g.strokeStyle=hiCol;g.stroke();}
      if(sel){const t=Math.min(1,(performance.now()-pulseT0)/1700);if(t<1){g.beginPath();g.arc(pt.x,headY,hitR*scale+6+t*26,0,7);g.lineWidth=3*(1-t);g.strokeStyle=`rgba(30,107,92,${(1-t)*.9})`;g.stroke();}
        g.beginPath();g.arc(pt.x,headY,hitR*scale+5,0,7);g.fillStyle="rgba(30,107,92,.22)";g.fill();g.lineWidth=2.5;g.strokeStyle="rgba(30,107,92,.85)";g.stroke();}
      g.drawImage(sp.c,x,y,w,h);
      if(!inHl)g.globalAlpha=1;
      if(isFav(p.id)&&ax!==6){const hs=heartSprite();g.drawImage(hs.c,pt.x+hitR*scale*.45,headY-hitR*scale-6,14,14);}
      hits.push({id:p.id,x:pt.x,y:headY,r:hitR*scale+2});
      if(showLabels||sel||hov){const name=p.nombre.length>28?p.nombre.slice(0,27)+"…":p.nombre;const tw=g.measureText(name).width+8;const lx=pt.x-tw/2,ly=pt.y+(ax===17?5:ax===11?12*scale:8*scale);
        if(sel||hov||!labelRects.some(r=>lx<r[0]+r[2]&&lx+tw>r[0]&&ly<r[1]+lh&&ly+lh>r[1])){labelRects.push([lx,ly,tw]);g.lineWidth=3.5;g.strokeStyle=halo;g.lineJoin="round";g.strokeText(name,pt.x,ly);g.fillStyle=seen?css("--muted"):inkc;g.fillText(name,pt.x,ly);}}}
    this._hits=hits;}
});
map.addLayer(baseR);const sym=new SymLayer({padding:.5});sym.addTo(map);
const routeLayer=L.layerGroup().addTo(map);
function hitAt(layerPt){const h=sym._hits||[];let best=null,bd=1e9;for(let i=h.length-1;i>=0;i--){const t=h[i];const d=Math.hypot(t.x-layerPt.x,t.y-layerPt.y);if(d<=t.r&&d<bd){bd=d;best=t;}}return best;}
function hitsNear(layerPt,r){const h=sym._hits||[];return h.filter(t=>Math.hypot(t.x-layerPt.x,t.y-layerPt.y)<=r).map(t=>S.byId.get(t.id)).filter(Boolean);}
map.on("click",e=>{const h=hitAt(e.layerPoint);if(!h){closeStylePop();return;}
  const near=hitsNear(e.layerPoint,Z()<9.5?10:14);
  if(near.length<=1||near[0].id===S.sel){openDetail(h.id,{fly:false});return;}
  near.sort(sorter("auto"));
  L.popup({autoPanPadding:[60,80],offset:[0,Z()<9.5?-8:-30]}).setLatLng(S.byId.get(h.id)).setContent(`<div class="pop"><div class="gh">${near.length} sitios aquí</div><div class="gl">${near.map(x=>rowHTML(x,"data-pick")).join("")}</div></div>`).openOn(map);});
map.on("popupopen",e=>e.popup.getElement().querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{map.closePopup();openDetail(b.dataset.pick,{fly:false});}));
let hovRaf=null;
map.on("mousemove",e=>{if(hovRaf)return;hovRaf=requestAnimationFrame(()=>{hovRaf=null;const h=hitAt(e.layerPoint);const id=h?h.id:null;
  map.getContainer().classList.toggle("hit",!!id);
  if(id!==S.hov){S.hov=id;sym.redraw();hoverCard(id);}
  const tip=$("symtip");if(id){const p=S.byId.get(id);const cp=map.latLngToContainerPoint([p.lat,p.lng]);tip.innerHTML=`${esc(p.nombre)}<small>${p.capa==="evento"?fmtRange(p)+" · ":""}${esc(p.municipio)} · ${fmtMin(p._min)}</small>`;tip.style.left=cp.x+"px";tip.style.top=(cp.y-(Z()<9.5?12:40))+"px";tip.hidden=false;}else tip.hidden=true;});});
map.on("mouseout",()=>{if(S.hov){S.hov=null;sym.redraw();hoverCard(null);}$("symtip").hidden=true;});
let mvT;map.on("moveend",()=>{clearTimeout(mvT);mvT=setTimeout(()=>{lvlHint();if(S.section==="explore"&&S.follow)renderList(true);},150);});
function refresh(){S.filtered=S.pts.filter(matches).sort(sorter(S.sort));sym.redraw();if(typeof lvlHint==="function")lvlHint();renderHead();if(S.section==="explore")renderList(true);}

/* encuadre teniendo en cuenta el panel */
function padL(){return isMobile()?0:0;}
function sheetH(){const el=S.detail?$("card"):$("panel");return el&&!el.hidden&&isMobile()?el.getBoundingClientRect().height+(S.detail?0:$("rail").offsetHeight-20):0;}
function fitPts(pts,maxZoom){if(!pts.length)return;const pad=isMobile()?{paddingTopLeft:[20,(parseInt(getComputedStyle($("mtop")).height)||0)+24],paddingBottomRight:[20,sheetH()+24]}:{paddingTopLeft:[40,60],paddingBottomRight:[S.detail?480:70,40]};
  map.flyToBounds(L.latLngBounds(pts.map(p=>[p.lat,p.lng])),{...pad,maxZoom:maxZoom||11,duration:.5});}
function centerOn(lat,lng,zoom){const z=zoom||Math.max(Z(),10.5);let ox=0,oy=0;if(isMobile()){const h=S.detail?Math.round(innerHeight*CSNAPS[0]):sheetH();oy=Math.round(h/2)-20;}else if(S.detail)ox=210;const pt=map.project([lat,lng],z).add([ox,oy]);map.flyTo(map.unproject(pt,z),z,{duration:.5});}
const LVL2_Z=9;
let pulseT0=0;function pulse(){pulseT0=performance.now();const tick=()=>{if(performance.now()-pulseT0<1700){sym.redraw();requestAnimationFrame(tick);}else sym.redraw();};requestAnimationFrame(tick);}
function shown(p){return (S.hl&&S.hl.ids.has(p.id))||p.nivel!==2||Z()>=LVL2_Z||!!S.q||S.sel===p.id||isFav(p.id)||!!S.focus;}
function inView(){const b=map.getBounds();return S.filtered.filter(p=>shown(p)&&b.contains([p.lat,p.lng]));}

/* ===== controles ===== */
$("m-style").innerHTML=ic("layers");$("m-in").innerHTML=ic("plus");$("m-out").innerHTML='<svg class="i" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>';$("m-home").innerHTML=ic("locate-fixed");$("m-fit").innerHTML=ic("map");
$("m-in").onclick=()=>map.zoomIn();$("m-out").onclick=()=>map.zoomOut();$("m-home").onclick=()=>centerOn(HOME.lat,HOME.lng,9);$("m-fit").onclick=()=>fitPts(S.filtered,10);
$("m-style").title="Tipo de mapa";$("m-home").title="Volver a casa";$("m-fit").title="Encuadrar todos los resultados";
function renderStylePop(){$("stylepop").innerHTML=`<span class="lbl">Tipo de mapa</span>`+Object.entries(BASES).map(([k,b])=>`<button data-st="${k}" aria-pressed="${S.style===k}"><span class="th" style="background-image:url(${b.th})"></span>${b.l}</button>`).join("");}
function closeStylePop(){$("stylepop").hidden=true;}
$("m-style").onclick=e=>{e.stopPropagation();$("stylepop").hidden=!$("stylepop").hidden;};
$("stylepop").onclick=e=>{e.stopPropagation();const b=e.target.closest("[data-st]");if(b){S.style=b.dataset.st;savePrefs();applyStyle();}};
document.addEventListener("click",e=>{if(!e.target.closest(".mapctl"))closeStylePop();if(!e.target.closest(".searchbox"))closeSugg();});
$("legend").innerHTML=LAYERS.map(l=>`<span><i class="d" style="--c:var(${l.c})"></i>${l.l}</span>`).join("")+`<span><i class="d" style="--c:var(--hi);border-radius:2px;transform:rotate(45deg)"></i>Casa</span><span style="opacity:.8">Más claro = ya mirado</span>`;
function lvlHint(){const mh=$("mhint");if(!mh)return;if(Z()>=LVL2_Z||S.q){mh.hidden=true;return;}const b=map.getBounds();const n=S.filtered.reduce((c,p)=>c+(p.nivel===2&&!shown(p)&&b.contains([p.lat,p.lng])?1:0),0);mh.hidden=!n||(isMobile()&&!!S.detail);mh.textContent=isMobile()?`+${n} al acercarte`:`Acércate: +${n} sitios de la zona`;}

/* ===== rail, panel, redimensionado ===== */
function renderRail(){const nf=Object.keys(S.est.favs).filter(id=>S.byId.has(id)).length,nt=S.est.salidas.length;
  $("rail").innerHTML=`<div class="logo" title="¿Adónde vamos?"><img src="assets/icon.svg" alt="" width="40" height="40"></div>`+SECTIONS.map(s=>`<button data-sec="${s.k}" aria-selected="${S.section===s.k}">${ic(s.i)}${s.l}${s.k==="saved"&&nf?`<span class="cnt">${nf}</span>`:s.k==="trips"&&nt?`<span class="cnt">${nt}</span>`:""}</button>`).join("")+
  `<span class="sp"></span><button class="tog" id="p-tog" aria-label="${S.collapsed?"Mostrar panel":"Ocultar panel"}" title="${S.collapsed?"Mostrar panel":"Ocultar panel"}">${ic(S.collapsed?"panel-left-open":"panel-left-close")}</button>`;}
$("rail").addEventListener("click",e=>{const b=e.target.closest("[data-sec]");if(b){const k=b.dataset.sec;if(S.section===k&&!S.detail&&S.collapsed){setCollapsed(false);return;}S.section=k;if(S.collapsed)setCollapsed(false);render();if(isMobile()){if(S.detail)closeDetail();setSnap(k==="explore"?snap:1,true);}return;}
  if(e.target.closest("#p-tog"))setCollapsed(!S.collapsed);});
function setCollapsed(c){S.collapsed=c;$("app").classList.toggle("collapsed",c);savePrefs();renderRail();setTimeout(()=>map.invalidateSize(),60);}
function setPW(w){w=Math.max(320,Math.min(Math.round(w),Math.min(620,innerWidth-300)));S.pw=w;$("app").style.setProperty("--pw",w+"px");}
(function(){const r=$("resizer");r.addEventListener("pointerdown",e=>{e.preventDefault();r.setPointerCapture(e.pointerId);r.classList.add("drag");const x0=e.clientX,w0=S.pw;
  const mv=ev=>{setPW(w0+ev.clientX-x0);};const up=()=>{r.classList.remove("drag");r.removeEventListener("pointermove",mv);r.removeEventListener("pointerup",up);savePrefs();map.invalidateSize();};
  r.addEventListener("pointermove",mv);r.addEventListener("pointerup",up);});
  r.addEventListener("keydown",e=>{if(e.key==="ArrowLeft"){setPW(S.pw-24);savePrefs();map.invalidateSize();}if(e.key==="ArrowRight"){setPW(S.pw+24);savePrefs();map.invalidateSize();}});
  r.addEventListener("dblclick",()=>{setPW(400);savePrefs();map.invalidateSize();});})();
/* hoja móvil */
const CSNAPS=[.58,.94];let snap=1,csnap=0;
function avail(){return innerHeight-$("rail").offsetHeight;}
function peekH(){return $("handle").offsetHeight+$("phead").offsetHeight+4;}
function snapPx(i){const top=(parseInt(getComputedStyle($("mtop")).height)||0)+12;return i===0?peekH():i===1?Math.round(avail()*.5):avail()-top;}
function setSnap(i,silent){snap=Math.max(0,Math.min(2,i));const p=$("panel");p.style.setProperty("--sh",(snapPx(snap)+20)+"px");p.classList.toggle("locked",snap<2);$("app").classList.toggle("sheetfull",snap===2);
  if(!("ResizeObserver" in window))document.querySelector(".mapwrap").style.setProperty("--peek",snapPx(Math.min(snap,1))+"px");if(!silent)setTimeout(()=>map.invalidateSize({pan:false}),300);}
function setCSnap(i){csnap=Math.max(0,Math.min(1,i));const c=$("card");c.style.setProperty("--ch",Math.round(innerHeight*CSNAPS[csnap])+"px");c.classList.toggle("locked",csnap<1);}
/* --peek sigue la altura REAL de la hoja (también durante el arrastre), para que los controles del mapa queden pegados a ella. */
if("ResizeObserver" in window){const mw=document.querySelector(".mapwrap");new ResizeObserver(()=>{if(!isMobile())return;const h=$("panel").offsetHeight-20;if(h>0&&snap<2)mw.style.setProperty("--peek",h+"px");}).observe($("panel"));}
let swallowClick=false;document.addEventListener("click",e=>{if(swallowClick){e.stopPropagation();e.preventDefault();swallowClick=false;}},true);
function makeSheet(el,opts){let y0,h0,on=false,moved=false,touch=false;
  const start=(y,isTouch,e)=>{if(!isMobile()||!opts.canStart(e))return;on=true;moved=false;touch=isTouch;y0=y;h0=el.getBoundingClientRect().height;};
  const move=(y,e)=>{if(!on)return;const dy=y0-y;if(!moved){if(Math.abs(dy)<8)return;if(opts.atMax()&&dy>0){on=false;return;}moved=true;el.classList.add("dragging");}
    if(e.cancelable)e.preventDefault();el.style.setProperty(opts.v,Math.max(opts.min(),Math.min(opts.max(),h0+dy))+"px");};
  const end=(y,e)=>{if(!on)return;on=false;el.classList.remove("dragging");const h=el.getBoundingClientRect().height;if(moved){swallowClick=true;setTimeout(()=>swallowClick=false,120);opts.settle(h,y0-y);}else opts.tap(e);};
  el.addEventListener("touchstart",e=>start(e.touches[0].clientY,true,e),{passive:true});
  el.addEventListener("touchmove",e=>move(e.touches[0].clientY,e),{passive:false});
  el.addEventListener("touchend",e=>end(e.changedTouches[0].clientY,e),{passive:true});
  el.addEventListener("touchcancel",e=>end(e.changedTouches[0].clientY,e),{passive:true});
  el.addEventListener("pointerdown",e=>{if(e.pointerType!=="mouse"||e.button!==0)return;start(e.clientY,false,e);});
  el.addEventListener("pointermove",e=>{if(e.pointerType!=="mouse"||touch)return;move(e.clientY,e);});
  el.addEventListener("pointerup",e=>{if(e.pointerType!=="mouse"||touch)return;end(e.clientY,e);});}
makeSheet($("panel"),{v:"--sh",min:()=>peekH(),max:()=>avail()-20,atMax:()=>snap===2,
  canStart:e=>{if(e.target.closest("select,input,textarea,.sugg"))return false;const inBody=e.target.closest(".p-body");return !(inBody&&snap===2&&$("pbody").scrollTop>0);},
  settle:(h,dy)=>{h-=20;const sn=[peekH(),avail()*.5,avail()];let best=0;sn.forEach((v,i)=>{if(Math.abs(v-h)<Math.abs(sn[best]-h))best=i;});if(Math.abs(dy)>60&&best===snap)best=dy>0?Math.min(2,snap+1):Math.max(0,snap-1);setSnap(best);},
  tap:e=>{if(e.target.closest("#handle,.reshead b"))setSnap(snap===2?0:snap+1);}});
makeSheet($("card"),{v:"--ch",min:()=>innerHeight*.2,max:()=>innerHeight*.96,atMax:()=>csnap===1,
  canStart:e=>{if(e.target.closest("select,input,button,a"))return false;return !(csnap===1&&$("card").scrollTop>0);},
  settle:(h,dy)=>{const fr=h/innerHeight;if(fr<.4&&dy<-40){closeDetail();return;}setCSnap(dy>0?1:fr>.8?1:0);},
  tap:e=>{if(e.target.closest(".chandle"))setCSnap(csnap?0:1);}});
let wasMob=isMobile();addEventListener("resize",()=>{const m=isMobile();if(m!==wasMob){wasMob=m;render();if(S.detail)renderDetail(true);}if(m){setSnap(snap,true);if(S.detail)setCSnap(csnap);}else setPW(S.pw);map.invalidateSize();});

/* ===== cabecera del panel ===== */
function render(){renderRail();renderHead();renderBody();}
function renderHead(){const h=$("phead"),mt=$("mtop");const mob=isMobile();
  h.style.display="";mt.hidden=!(mob&&S.section==="explore");if(!mob||S.section!=="explore")mt.innerHTML="";
  if(S.section==="explore"){const fc=filterCount();const fcm=fc-(S.dmode!=="todo"?1:0)-(S.maxmin<300?1:0);
    if(mob){mt.innerHTML=`<div class="mt1"><div class="searchbox"><div class="field">${ic("search")}<input type="search" id="q" placeholder="Pueblo, zona o plan" autocomplete="off" aria-label="Buscar" value="${esc(S.qraw||"")}"><button class="ibtn" id="q-clear" aria-label="Borrar" ${S.qraw?"":"hidden"}>${ic("x")}</button></div><div class="sugg" id="sugg" role="listbox" hidden></div></div><button class="mfilt ${fcm?"on":""}" data-fp="more" aria-label="Filtros">${ic("sliders-horizontal")}${fcm?`<span class="n">${fcm}</span>`:""}</button></div>
      <div class="mrow"><button class="fbtn ${S.dmode!=="todo"?"on":""}" data-fp="date">${ic("calendar")}${S.dmode==="todo"?"Fechas":dateLabel()}</button><button class="fbtn ${S.maxmin<300?"on":""}" data-fp="dist">${ic("clock")}${S.maxmin<300?"Hasta "+fmtMin(S.maxmin):"Distancia"}</button><span class="sep"></span>${LAYERS.map(l=>`<button class="chip" style="--c:var(${l.c})" data-ly="${l.k}" aria-pressed="${S.layers.has(l.k)}"><span class="d"></span>${l.l}</button>`).join("")}</div>`;
      bindSearch();document.querySelector(".mapwrap").style.setProperty("--mtoph",mt.offsetHeight+"px");return;}
    h.innerHTML=`<div class="p-title"><h1>Explorar</h1></div>
    <div class="searchbox"><div class="field">${ic("search")}<input type="search" id="q" placeholder="Pueblo, zona o plan" autocomplete="off" aria-label="Buscar" value="${esc(S.qraw||"")}"><button class="ibtn" id="q-clear" aria-label="Borrar" ${S.qraw?"":"hidden"}>${ic("x")}</button></div><div class="sugg" id="sugg" role="listbox" hidden></div></div>
    <div class="chips" id="chips">${LAYERS.map(l=>`<button class="chip" style="--c:var(${l.c})" data-ly="${l.k}" aria-pressed="${S.layers.has(l.k)}"><span class="d"></span>${l.l}</button>`).join("")}</div>
    <div class="fbar"><button class="fbtn ${S.dmode!=="todo"?"on":""}" data-fp="date">${ic("calendar")}${S.dmode==="todo"?"Fechas":dateLabel()}</button><button class="fbtn ${S.maxmin<300?"on":""}" data-fp="dist">${ic("clock")}${S.maxmin<300?"Hasta "+fmtMin(S.maxmin):"Distancia"}</button><button class="fbtn ${fc-(S.dmode!=="todo"?1:0)-(S.maxmin<300?1:0)?"on":""}" data-fp="more">${ic("sliders-horizontal")}Más filtros${(fc-(S.dmode!=="todo"?1:0)-(S.maxmin<300?1:0))?` <span class="n">${fc-(S.dmode!=="todo"?1:0)-(S.maxmin<300?1:0)}</span>`:""}</button></div>`;
    bindSearch();}
  else if(S.section==="saved"){const nf=Object.keys(S.est.favs).filter(id=>S.byId.has(id)).length,ns=Object.keys(S.est.vistos).filter(id=>S.byId.has(id)).length;
    h.innerHTML=`<div class="p-title"><h1>Guardados</h1></div><div class="seg"><button data-sv="favs" aria-selected="${S.saved==="favs"}">Favoritos · ${nf}</button><button data-sv="seen" aria-selected="${S.saved==="seen"}">Vistos · ${ns}</button></div>`;}
  else if(S.section==="trips")h.innerHTML=`<div class="p-title"><h1>Salidas</h1>${S.tripId?"":`<button class="btn primary" id="trip-new">${ic("plus")}Nueva</button>`}</div>`;
}
function dateLabel(){if(S.dmode==="rango")return (S.from?fmtD(S.from):"…")+" – "+(S.to?fmtD(S.to):"…");return DMODES.find(d=>d.k===S.dmode).l;}
function onHeadClick(e){const t=e.target;
  const ly=t.closest("[data-ly]");if(ly){const k=ly.dataset.ly;S.layers.has(k)?S.layers.delete(k):S.layers.add(k);savePrefs();refresh();return;}
  const fp=t.closest("[data-fp]");if(fp){S.fopen=S.fopen===fp.dataset.fp?null:fp.dataset.fp;renderBody();return;}
  const sv=t.closest("[data-sv]");if(sv){S.saved=sv.dataset.sv;renderHead();renderBody();return;}
  if(t.closest("#trip-new")){const n=newTrip(null);saveEst();S.tripId=n.id;render();return;}}
$("phead").addEventListener("click",onHeadClick);$("mtop").addEventListener("click",onHeadClick);

/* ===== búsqueda ===== */
let sIdx=-1;
function hl(text,q){const t=String(text);const w=q.split(/\s+/)[0];const i=norm(t).indexOf(w);if(!w||i<0)return esc(t);return esc(t.slice(0,i))+"<mark>"+esc(t.slice(i,i+w.length))+"</mark>"+esc(t.slice(i+w.length));}
function rowHTML(p,attr,extra=""){return `<button class="srow" ${attr}="${esc(p.id)}"><span class="mi ${isSeen(p.id)?"seen":""}" style="--c:${colorVar(p)}">${ic(iconOf(p))}</span><span class="tx"><div class="t">${esc(p.nombre)}</div><div class="m">${p.capa==="evento"?fmtRange(p)+" · ":""}${p.municipio?esc(p.municipio)+" · ":""}${fmtMin(p._min)}${extra}</div></span>${isFav(p.id)?`<span class="hearticon">${ic("heart")}</span>`:""}</button>`;}
function buildSugg(raw){const sg=$("sugg");if(!sg)return;const q=norm(raw).trim();let h="";
  if(!q){const seen=Object.entries(S.est.vistos).sort((a,b)=>b[1]-a[1]).map(([id])=>S.byId.get(id)).filter(Boolean).slice(0,8);
    if(seen.length)h+=`<div class="sh">Vistos recientemente<button data-clearseen="1">Borrar</button></div>`+seen.map(p=>rowHTML(p,"data-s")).join("");
    if(!h){closeSugg();return;}}
  else{const ws=q.split(/\s+/);const t0=iso(today());
    const sites=S.pts.filter(p=>ws.every(w=>p._h.includes(w))&&!(p.capa==="evento"&&(p.fecha_fin||p.fecha_inicio)<t0)).map(p=>[p,(norm(p.nombre).startsWith(q)?0:norm(p.nombre).includes(q)?1:2)]).sort((a,b)=>a[1]-b[1]||a[0]._min-b[0]._min).slice(0,7).map(x=>x[0]);
    const places=new Map();for(const p of S.pts){for(const f of [p.municipio,p.zona]){if(f&&norm(f).includes(q)){const e=places.get(f)||{name:f,pts:[]};e.pts.push(p);places.set(f,e);}}}
    const pl=[...places.values()].sort((a,b)=>(norm(a.name).startsWith(q)?0:1)-(norm(b.name).startsWith(q)?0:1)||b.pts.length-a.pts.length).slice(0,3);S._pl=pl;
    if(pl.length)h+=`<div class="sh">Zonas</div>`+pl.map((x,i)=>`<button class="srow" data-z="${i}"><span class="mi">${ic("map-pin")}</span><span class="tx"><div class="t">${hl(x.name,q)}</div><div class="m">${x.pts.length} ${x.pts.length===1?"sitio":"sitios"} · ir en el mapa</div></span></button>`).join("");
    if(sites.length)h+=`<div class="sh">Sitios</div>`+sites.map(p=>rowHTML(p,"data-s").replace(`<div class="t">${esc(p.nombre)}</div>`,`<div class="t">${hl(p.nombre,q)}</div>`)).join("");
    h+=`<button class="srow" data-qall="1"><span class="mi" style="--c:var(--ink2)">${ic("search")}</span><span class="tx"><div class="t">Filtrar por «${esc(raw.trim())}»</div><div class="m">Deja en el mapa solo lo que coincide</div></span></button>`;}
  sg.innerHTML=h;sg.hidden=false;sIdx=-1;}
function closeSugg(){const sg=$("sugg");if(sg)sg.hidden=true;sIdx=-1;}
function bindSearch(){const q=$("q"),sg=$("sugg");if(!q)return;
  q.addEventListener("input",e=>{S.qraw=e.target.value;$("q-clear").hidden=!e.target.value;buildSugg(e.target.value);if(!e.target.value){clearHl();if(S.q){S.q="";refresh();}}});
  q.addEventListener("focus",e=>{buildSugg(e.target.value);if(isMobile()&&snap>0)setSnap(0);});
  q.addEventListener("keydown",e=>{const opts=[...sg.querySelectorAll(".srow")];
    if(e.key==="ArrowDown"&&opts.length){e.preventDefault();sIdx=(sIdx+1)%opts.length;}else if(e.key==="ArrowUp"&&opts.length){e.preventDefault();sIdx=(sIdx-1+opts.length)%opts.length;}
    else if(e.key==="Enter"){e.preventDefault();if(sIdx>=0)opts[sIdx].click();else applyQ(q.value);return;}else if(e.key==="Escape"){closeSugg();q.blur();return;}else return;
    opts.forEach((o,i)=>o.setAttribute("aria-selected",i===sIdx));opts[sIdx]&&opts[sIdx].scrollIntoView({block:"nearest"});});
  sg.addEventListener("mousedown",e=>e.preventDefault());
  sg.addEventListener("click",e=>{const t=e.target;
    if(t.closest("[data-clearseen]")){S.est.vistos={};saveEst();sym.redraw();buildSugg("");return;}
    const s=t.closest("[data-s]");if(s){closeSugg();q.blur();clearHl();openDetail(s.dataset.s,{fly:true});return;}
    const z=t.closest("[data-z]");if(z){const x=S._pl[+z.dataset.z];closeSugg();q.blur();q.value=x.name;S.qraw=x.name;$("q-clear").hidden=false;setHl(x.name,x.pts);fitPts(x.pts,13.5);return;}
    if(t.closest("[data-qall]"))applyQ(q.value);});
  $("q-clear").onclick=()=>{q.value="";S.qraw="";$("q-clear").hidden=true;closeSugg();clearHl();if(S.q){S.q="";refresh();}q.focus();};}
function applyQ(v){closeSugg();const q=$("q");if(q)q.blur();S.q=norm(v).trim();S.qraw=v;refresh();clearHl();if(S.q&&S.filtered.length){S.follow=false;renderList();fitPts(S.filtered,11);}}
function setHl(label,pts){S.hl={label,ids:new Set(pts.map(p=>p.id))};S.follow=true;listKey="";sym.redraw();renderList();}
function clearHl(){if(!S.hl)return;S.hl=null;listKey="";sym.redraw();renderList();}

/* ===== cuerpo: explorar ===== */
const body=$("pbody");
function renderBody(){
  if(S.section==="explore")renderList();else if(S.section==="saved")renderSaved();else renderTrips();}
function fpanelHTML(){
  if(S.fopen==="date")return `<div class="fpanel"><div class="grp"><span class="lbl">Fechas de los eventos</span><div class="opts">${DMODES.map(d=>`<button class="opt" data-dm="${d.k}" aria-pressed="${S.dmode===d.k}">${d.l}</button>`).join("")}</div>
    ${S.dmode==="rango"?`<div class="dates"><label>Desde<input type="date" id="d-from" value="${S.from||""}"></label><label>Hasta<input type="date" id="d-to" value="${S.to||""}"></label></div>`:""}
    <span class="status">Solo afecta a los eventos; el resto se muestra siempre.</span></div><div class="foot"><button class="linkbtn" data-fclear="date">Cualquier fecha</button><button class="btn primary" data-fclose="1">Listo</button></div></div>`;
  if(S.fopen==="dist")return `<div class="fpanel"><div class="grp"><span class="lbl">Conducción desde casa</span><div class="range"><input type="range" id="maxmin" min="30" max="300" step="15" value="${S.maxmin}" aria-label="Tiempo máximo"><span id="maxmin-l" style="font-weight:700;font-size:13px;white-space:nowrap">${S.maxmin>=300?"Sin límite":"Hasta "+fmtMin(S.maxmin)}</span></div>
    <div class="opts">${[60,120,180,240].map(m=>`<button class="opt" data-mm="${m}" aria-pressed="${S.maxmin===m}">${fmtMin(m)}</button>`).join("")}<button class="opt" data-mm="300" aria-pressed="${S.maxmin>=300}">Sin límite</button></div></div><div class="foot"><span></span><button class="btn primary" data-fclose="1">Listo</button></div></div>`;
  if(S.fopen==="more")return `<div class="fpanel"><div class="grp"><span class="lbl">Tipo de plan · marca los que quieras</span><div class="opts">${TYPES.map(t=>`<button class="opt" data-ty="${t.k}" aria-pressed="${S.types.has(t.k)}">${ic(t.i)}${t.l}</button>`).join("")}</div></div>
    ${S.layers.has("ruta")?`<div class="grp"><span class="lbl">Duración de las escapadas</span><div class="opts">${DURS.map(d=>`<button class="opt" data-du="${d.k}" aria-pressed="${S.dur.has(d.k)}">${d.l}</button>`).join("")}</div></div>`:""}
    <div class="grp"><label class="sw">Solo destacados<input type="checkbox" data-sw="top" ${S.top?"checked":""}></label><label class="sw">Buenos para ir con niños<input type="checkbox" data-sw="ninos" ${S.ninos?"checked":""}></label><label class="sw">Se llega con 7 m<input type="checkbox" data-sw="ac" ${S.ac?"checked":""}></label><label class="sw">Solo gratis<input type="checkbox" data-sw="gratis" ${S.gratis?"checked":""}></label><label class="sw">Ocultar los que ya he mirado<input type="checkbox" data-sw="hideSeen" ${S.hideSeen?"checked":""}></label></div>
    <div class="foot"><button class="linkbtn" data-fclear="more">Borrar</button><button class="btn primary" data-fclose="1">Listo</button></div></div>`;
  return "";}
function renderFSheet(){const fs=$("fsheet"),sc=$("scrim");const on=isMobile()&&!!S.fopen&&S.section==="explore";if(!on){fs.hidden=sc.hidden=true;fs.innerHTML="";return;}
  const title=S.fopen==="date"?"Fechas":S.fopen==="dist"?"Distancia desde casa":"Filtros";const was=!fs.hidden&&fs.dataset.open===S.fopen;const st=was?fs.querySelector(".fs-b")?.scrollTop||0:0;
  fs.innerHTML=`<div class="fs-h"><span class="fs-handle"></span><b>${title}</b><button class="ibtn" data-fclose="1" aria-label="Cerrar">${ic("x")}</button></div><div class="fs-b">${fpanelHTML()}</div>`;
  const foot=fs.querySelector(".foot");if(foot)fs.appendChild(foot);fs.dataset.open=S.fopen;fs.hidden=sc.hidden=false;if(was)fs.querySelector(".fs-b").scrollTop=st;}
function tileHTML(p){if(p.capa==="evento"&&p.fecha_inicio){const d=new Date(p.fecha_inicio+"T12:00:00");return `<span class="tile" style="--c:${colorVar(p)}"><span class="dt"><b>${d.getDate()}</b><span>${MES[d.getMonth()]}</span></span></span>`;}
  const ph=S.photos&&S.photos[p.id];if(ph&&ph.img)return `<span class="tile ph" style="--c:${colorVar(p)};background-image:url(&quot;${esc(ph.img)}&quot;)"><i>${ic(iconOf(p))}</i></span>`;
  return `<span class="tile" style="--c:${colorVar(p)}">${ic(iconOf(p))}</span>`;}
function acBadge(p){return p.ac7m==="si"?`<span class="b ok">${ic("caravan")}7 m</span>`:p.ac7m==="cerca"?`<span class="b warn">${ic("caravan")}aparcar cerca</span>`:p.ac7m==="no"?`<span class="b no">${ic("caravan")}difícil con 7 m</span>`:"";}
function subOf(p){return p.capa==="evento"?fmtRange(p)+" · "+esc(p.municipio):!p.municipio?esc(p.zona||p.fuente||""):p.capa==="ruta"?(p.dias||1)+(p.dias>1?" días · ":" día · ")+(p.paradas||[]).length+" paradas · "+esc(p.zona||p.municipio):esc(p.municipio)+(p.zona&&p.zona!==p.municipio?", "+esc(p.zona):"");}
function cardHTML(p,noSeen){const [fa,fb]=weekend(0);const wk=p.capa==="evento"&&overlaps(p,fa,fb);
  return `<div class="card-i ${isSeen(p.id)&&!noSeen?"seen":""} ${S.sel===p.id?"sel":""}" data-card="${esc(p.id)}" role="button" tabindex="0">${tileHTML(p)}<span class="tx"><div class="t">${esc(p.nombre)}</div><div class="m">${subOf(p)}</div><div class="badges"><span class="b">${fmtMin(p._min)}</span>${wk?'<span class="b hi">Este finde</span>':""}${p.ninos?`<span class="b ok">${ic("baby")}Niños</span>`:""}${acBadge(p)}${p.precio==="gratis"?'<span class="b ok">Gratis</span>':""}</div></span><button class="heartbtn ${isFav(p.id)?"on":""}" data-fav="${esc(p.id)}" aria-label="Guardar">${ic("heart")}</button></div>`;}
let listKey="",lastPk=0;
function renderList(soft){if(S.section!=="explore")return;
  if(!S.pts.length){body.innerHTML=`<div class="empty"><span class="ei">${ic("map")}</span><b>Cargando sitios…</b></div>`;return;}
  const list=S.hl?S.filtered.filter(p=>S.hl.ids.has(p.id)):S.follow?inView():S.filtered;S.inView=list;const total=S.filtered.length;
  const key=[S.fopen,S.follow,S.sort,S.limit,list.map(p=>p.id).join(",")].join("|");if(soft&&key===listKey)return;listKey=key;
  const st=body.scrollTop;const mob=isMobile();
  const resh=`<div class="reshead"><b>${list.length} ${list.length===1?"sitio":"sitios"}${S.hl?" en «"+esc(S.hl.label)+"»":S.follow?" en el mapa":""}${!S.hl&&S.follow&&total!==list.length?`<small>${total} en total con estos filtros</small>`:""}</b><span style="display:flex;gap:8px;align-items:center"><label class="follow" title="Mostrar solo lo que se ve en el mapa"><input type="checkbox" id="follow" ${S.follow?"checked":""}>Seguir mapa</label><select id="sort" aria-label="Ordenar"><option value="auto" ${S.sort==="auto"?"selected":""}>Eventos primero</option><option value="near" ${S.sort==="near"?"selected":""}>Más cerca</option><option value="date" ${S.sort==="date"?"selected":""}>Por fecha</option><option value="az" ${S.sort==="az"?"selected":""}>A–Z</option></select></span></div>`;
  if(mob){$("phead").innerHTML=resh;const pk=snapPx(snap);if(pk!==lastPk){lastPk=pk;setSnap(snap,true);}}
  renderFSheet();
  body.innerHTML=(mob?"":fpanelHTML()+resh)+
    (list.length?`<div class="cards">${list.slice(0,S.limit).map(cardHTML).join("")}</div>${list.length>S.limit?`<button class="btn more" id="more">Mostrar ${Math.min(40,list.length-S.limit)} más</button>`:""}`
    :total?`<div class="empty"><span class="ei">${ic("map")}</span><b>Nada en esta zona del mapa</b><span>Hay ${total} sitios con estos filtros en otras zonas.</span><button class="btn primary" id="fitall">${ic("map")}Ver todos en el mapa</button></div>`
    :`<div class="empty"><span class="ei">${ic("search")}</span><b>Ningún resultado</b><span>Prueba a quitar algún filtro, o activa más capas arriba.</span></div>`);
  body.scrollTop=soft?st:0;}
function onBodyClick(e){const t=e.target;
  const fav=t.closest("[data-fav]");if(fav){e.stopPropagation();toggleFav(fav.dataset.fav);return;}
  const dm=t.closest("[data-dm]");if(dm){S.dmode=dm.dataset.dm;savePrefs();refresh();renderHead();renderList();return;}
  const mm=t.closest("[data-mm]");if(mm){S.maxmin=+mm.dataset.mm;savePrefs();refresh();renderHead();renderList();return;}
  const ty=t.closest("[data-ty]");if(ty){const k=ty.dataset.ty;S.types.has(k)?S.types.delete(k):S.types.add(k);savePrefs();refresh();renderHead();renderList();return;}
  const du=t.closest("[data-du]");if(du){const k=du.dataset.du;S.dur.has(k)?S.dur.delete(k):S.dur.add(k);refresh();renderList();return;}
  const fc=t.closest("[data-fclear]");if(fc){if(fc.dataset.fclear==="date"){S.dmode="todo";S.from=S.to=null;}else Object.assign(S,{types:new Set(),dur:new Set(),ninos:false,ac:false,gratis:false,hideSeen:false,top:false});savePrefs();refresh();renderHead();renderList();return;}
  if(t.closest("[data-fclose]")){S.fopen=null;renderHead();renderList();return;}
  if(t.closest("#more")){S.limit+=40;renderList(true);return;}
  if(t.closest("#fitall")){fitPts(S.filtered,10);return;}
  const card=t.closest("[data-card]");if(card){openDetail(card.dataset.card,{fly:true});return;}
  const op=t.closest("[data-s]");if(op){openDetail(op.dataset.s,{fly:true});return;}
  const sv=t.closest("[data-sv]");if(sv){S.saved=sv.dataset.sv;renderBody();return;}
  const tr=t.closest("[data-trip]");if(tr){S.tripId=tr.dataset.trip;render();return;}
  if(t.closest("#favmap")){fitPts(Object.keys(S.est.favs).map(id=>S.byId.get(id)).filter(Boolean),10);}}
body.addEventListener("click",onBodyClick);$("fsheet").addEventListener("click",onBodyClick);$("phead").addEventListener("click",onBodyClick);
$("scrim").addEventListener("click",()=>{S.fopen=null;renderFSheet();renderHead();});
function onBodyChange(e){const t=e.target;
  if(t.id==="follow"){S.follow=t.checked;savePrefs();renderList();}if(t.id==="sort"){S.sort=t.value;savePrefs();refresh();renderList();}
  if(t.dataset.sw){S[t.dataset.sw]=t.checked;savePrefs();refresh();renderHead();renderList();}
  if(t.id==="d-from"){S.from=t.value||null;refresh();renderHead();}if(t.id==="d-to"){S.to=t.value||null;refresh();renderHead();}}
function onBodyInput(e){if(e.target.id==="maxmin"){S.maxmin=+e.target.value;$("maxmin-l").textContent=S.maxmin>=300?"Sin límite":"Hasta "+fmtMin(S.maxmin);clearTimeout(S._mm);S._mm=setTimeout(()=>{savePrefs();refresh();renderHead();},150);}}
for(const el of [body,$("fsheet"),$("phead")]){el.addEventListener("change",onBodyChange);el.addEventListener("input",onBodyInput);}
body.addEventListener("keydown",e=>{if(e.key==="Enter"){const c=e.target.closest("[data-card]");if(c&&e.target===c)openDetail(c.dataset.card,{fly:true});}});
body.addEventListener("mouseover",e=>{const c=e.target.closest("[data-card]");const id=c?c.dataset.card:null;if(id!==S.hov){S.hov=id;sym.redraw();}});
body.addEventListener("mouseleave",()=>{if(S.hov){S.hov=null;sym.redraw();}});
function hoverCard(id){body.querySelectorAll(".card-i.hov").forEach(el=>el.classList.remove("hov"));if(id){const el=body.querySelector(`[data-card="${CSS.escape(id)}"]`);if(el)el.classList.add("hov");}}

/* ===== detalle ===== */
const stopColor=t=>t==="pernocta"?"var(--pe)":t==="evento"?"var(--ev)":t==="naturaleza"?"var(--na)":"var(--vi)";
function photoURL(p){return "https://www.google.com/search?tbm=isch&q="+encodeURIComponent(p.nombre+" "+(p.municipio||""));}
function nearDo(p,maxKm,n){return S.pts.filter(x=>(x.capa==="visita"||x.capa==="naturaleza")&&x.ninos&&x.id!==p.id).map(x=>[x,hav(p.lat,p.lng,x.lat,x.lng)]).filter(x=>x[1]<maxKm).sort((a,b)=>(a[1]+(a[0].nivel===2?6:0))-(b[1]+(b[0].nivel===2?6:0))).slice(0,n);}
function nearest(p,capa,n){const t=iso(today());return S.pts.filter(x=>x.capa===capa&&x.id!==p.id&&(capa!=="evento"||(x.fecha_fin||x.fecha_inicio)>=t)).map(x=>[x,hav(p.lat,p.lng,x.lat,x.lng)]).sort((a,b)=>a[1]-b[1]).slice(0,n).filter(x=>x[1]<35);}
function markSeen(id){S.est.vistos[id]=Date.now();const ks=Object.keys(S.est.vistos);if(ks.length>300){ks.sort((a,b)=>S.est.vistos[a]-S.est.vistos[b]).slice(0,ks.length-300).forEach(k=>delete S.est.vistos[k]);}saveEst();}
function openDetail(id,opts={}){const p=S.byId.get(id);if(!p)return;try{history.replaceState(null,"","#"+encodeURIComponent(id));}catch(e){}S.sel=id;markSeen(id);S.detail=id;renderDetail();sym.redraw();renderRail();body.querySelectorAll(".card-i.sel").forEach(e=>e.classList.remove("sel"));body.querySelectorAll(`[data-card="${CSS.escape(id)}"]`).forEach(e=>e.classList.add("sel"));
  if(p.capa==="ruta"){const st=drawRoute((p.paradas||[]).map(s=>({...s,_c:stopColor(s.tipo)})),css("--ru"));if(st)fitPts(st,11);}
  else{if(!S.focus)routeLayer.clearLayers();pulse();if(opts.fly)centerOn(p.lat,p.lng);else if(!map.getBounds().pad(-.1).contains([p.lat,p.lng]))centerOn(p.lat,p.lng,Z());}
  if(isMobile()){$("app").classList.add("detail");setCSnap(0);$("card").scrollTop=0;lvlHint();}}
function closeDetail(){try{history.replaceState(null,"",location.pathname+location.search);}catch(e){}S.detail=null;S.sel=null;$("card").hidden=true;$("app").classList.remove("detail");if(isMobile()){setSnap(snap,true);lvlHint();}if(!S.focus)routeLayer.clearLayers();sym.redraw();body.querySelectorAll(".card-i.sel").forEach(e=>e.classList.remove("sel"));}
function drawRoute(pts,col){routeLayer.clearLayers();const st=pts.filter(s=>typeof s.lat==="number");if(st.length<2)return null;
  L.polyline(st.map(s=>[s.lat,s.lng]),{renderer:baseR,color:col,weight:3.5,opacity:.9,dashArray:"8 7",interactive:false}).addTo(routeLayer);
  st.forEach((s,i)=>L.marker([s.lat,s.lng],{zIndexOffset:2000,keyboard:false,icon:L.divIcon({className:"",html:`<span class="stopnum" style="--c:${s._c||col}">${i+1}</span>`,iconSize:[22,22],iconAnchor:[11,11]})}).addTo(routeLayer).bindTooltip((s.dia?"Día "+s.dia+" · ":"")+s.nombre,{direction:"top",className:"tt",offset:[0,-10]}));
  return st;}
function tripOptions(id){return `<option value="">A una salida…</option>${S.est.salidas.map(t=>`<option value="${esc(t.id)}" ${t.ids.includes(id)?"disabled":""}>${esc(t.nombre)}${t.ids.includes(id)?" ✓":""}</option>`).join("")}<option value="__new">+ Nueva salida</option>`;}
function heroHTML(p){const ph=S.photos&&S.photos[p.id];if(ph&&ph.img)return `<figure class="photo"><img src="${esc(ph.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('figure').replaceWith(document.createRange().createContextualFragment(window.__heroFallback('${esc(p.id)}')))"><figcaption>Foto: <a href="${esc(ph.src||p.url)}" target="_blank" rel="noopener">${esc(ph.site||p.fuente||"fuente")}</a></figcaption></figure>`;return heroFallback(p);}
window.__heroFallback=id=>heroFallback(S.byId.get(id));
function heroFallback(p){let inner;if(p.capa==="evento"&&p.fecha_inicio){const d=new Date(p.fecha_inicio+"T12:00:00");inner=`<div class="dtile"><div class="w">${DIA[d.getDay()]}</div><div class="d">${d.getDate()}</div><div class="mo">${MES[d.getMonth()]}</div></div>`;}else inner=`<div class="big">${ic(iconOf(p))}</div>`;
  const multi=p.capa==="evento"&&p.fecha_fin&&p.fecha_fin!==p.fecha_inicio?Math.round((new Date(p.fecha_fin)-new Date(p.fecha_inicio))/864e5)+1:0;const tag=p.capa==="ruta"?(p.dias||1)+(p.dias>1?" días":" día"):multi?multi+" días":layerOf(p).l;
  return `<div class="hero" style="--c:${colorVar(p)}">${inner}<span class="tag">${esc(tag)}</span></div>`;}
function renderDetail(keep){const p=S.byId.get(S.detail);if(!p){S.detail=null;$("card").hidden=true;return;}const id=p.id;const card=$("card");const st=card.scrollTop;
  const sleep=p.capa!=="pernocta"?nearest(p,"pernocta",4):[];
  const kids=nearDo(p,25,6);
  const evs=p.capa!=="evento"?nearest(p,"evento",3).filter(x=>x[1]<30):[];
  const near=(arr,title)=>arr.length?`<div class="h3">${title}</div><div class="near">${arr.map(([x,d])=>rowHTML(x,"data-s"," · "+(d<1?"<1":Math.round(d))+" km")).join("")}</div>`:"";
  const itin=p.capa==="ruta"?(()=>{const s=p.paradas||[];const days=[...new Set(s.map(x=>x.dia||1))].sort((a,b)=>a-b);const fu=(p.fuentes||[]).filter(f=>f&&f.url);
    return `<div class="h3">Itinerario${p.km_total?" · unos "+p.km_total+" km":""}</div><div class="itin">${days.map(d=>`<span class="dl">Día ${d}</span>${s.map((x,i)=>[x,i]).filter(([x])=>(x.dia||1)===d).map(([x,i])=>`<button class="rstop" data-stop="${i}"><span class="stopnum" style="--c:${stopColor(x.tipo)}">${i+1}</span><span><b>${esc(x.nombre)}</b>${x.tipo==="pernocta"?' <span class="b ok">Dormir</span>':""}${x.nota?`<br><span class="rn">${esc(x.nota)}</span>`:""}</span></button>`).join("")}`).join("")}</div>
    ${fu.length?`<div class="h3">Contado por autocaravanistas</div><div class="row">${fu.map(f=>`<a class="btn" href="${esc(f.url)}" target="_blank" rel="noopener">${ic("external-link")}${esc(f.nombre||"Fuente")}</a>`).join("")}</div>`:""}`;})():"";
  card.innerHTML=`<div class="chandle" aria-hidden="true"></div><button class="x" id="back" aria-label="Cerrar">${ic("x")}</button><div class="dv">
    ${heroHTML(p)}<span class="kicker" style="--c:${colorVar(p)}">${esc((p.tipos||[]).slice(0,3).join(" · ")||layerOf(p).l)}</span><h2>${esc(p.nombre)}</h2>
    <div class="where"><span>${ic("map-pin")}${esc(p.municipio)}${p.zona&&p.zona!==p.municipio?", "+esc(p.zona):""}${p.aprox?' <span class="aprox" title="Coordenadas del centro del pueblo">· ubicación aproximada</span>':""}</span><span>${ic("clock")}${fmtMin(p._min)} · ~${roadKm(p)} km</span></div>
    <div class="acts"><button class="act ${isFav(id)?"on":""}" data-fav="${esc(id)}" aria-pressed="${isFav(id)}">${ic("heart")}${isFav(id)?"Guardado":"Guardar"}</button>
      <a class="act" href="${photoURL(p)}" target="_blank" rel="noopener">${ic("image")}Fotos</a>
      <label class="act">${ic("calendar-days")}A salida<select id="d-trip" aria-label="Añadir a una salida">${tripOptions(id)}</select></label>
      <a class="act" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener">${ic("navigation")}Cómo llegar</a></div>
    ${p.fecha_inicio?`<div class="whenbox">${ic("calendar")}<span>${fmtRange(p)}${p.horario?`<br><span class="rn">${esc(p.horario)}</span>`:""}</span></div>`:""}
    <div class="badges">${p.ninos?`<span class="b ok">${ic("baby")}Bueno con niños</span>`:'<span class="b">Más para adultos</span>'}${acBadge(p)||'<span class="b">7 m: sin datos</span>'}${p.precio==="gratis"?'<span class="b ok">Gratis</span>':p.precio_txt?`<span class="b">${esc(p.precio_txt)}</span>`:""}</div>
    <p>${esc(p.descripcion)}</p>${p.consejo?`<div class="tip">${ic("info")}<span>${esc(p.consejo)}</span></div>`:""}${itin}
    <dl class="facts">${p.temporada?`<dt>Temporada</dt><dd>${esc(p.temporada)}</dd>`:""}${!p.fecha_inicio&&p.horario?`<dt>Horario</dt><dd>${esc(p.horario)}</dd>`:""}<dt>Fuente</dt><dd>${p.url?`<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.fuente||"Web")}</a> · revisado ${esc(p.verificado||"")}`:esc(p.fuente||"—")}</dd></dl>
    ${near(sleep,"Dónde dormir cerca")}${near(kids,"Qué hacer cerca con niños")}${near(evs,"Eventos cerca")}</div>`;
  card.hidden=false;card.scrollTop=keep?st:0;
  $("back").onclick=closeDetail;
  $("d-trip").onchange=e=>{const v=e.target.value;if(!v)return;let t;if(v==="__new")t=newTrip(p);else t=S.est.salidas.find(x=>x.id===v);if(t&&!t.ids.includes(id))t.ids.push(id);saveEst();toast("Añadido a «"+t.nombre+"»");renderRail();renderDetail(true);if(S.section==="trips")renderBody();};
  card.querySelectorAll("[data-stop]").forEach(b=>b.onclick=()=>{const s=p.paradas[+b.dataset.stop];if(s)centerOn(s.lat,s.lng,12);});}
$("card").addEventListener("click",e=>{const f=e.target.closest("[data-fav]");if(f){toggleFav(f.dataset.fav);return;}const s=e.target.closest("[data-s]");if(s)openDetail(s.dataset.s,{fly:true});});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&S.detail&&document.activeElement!==$("q"))closeDetail();});

/* ===== guardados ===== */
function renderSaved(){const favs=Object.keys(S.est.favs).map(id=>S.byId.get(id)).filter(Boolean).sort(sorter("date"));
  const seen=Object.entries(S.est.vistos).sort((a,b)=>b[1]-a[1]).map(([id])=>S.byId.get(id)).filter(Boolean);
  if(S.saved==="favs")body.innerHTML=favs.length?`<div class="row"><button class="btn" id="favmap">${ic("map")}Ver todos en el mapa</button></div><div class="cards">${favs.map(p=>cardHTML(p,true)).join("")}</div>`:`<div class="empty"><span class="ei">${ic("heart")}</span><b>Aún no has guardado nada</b><span>Toca el corazón en cualquier sitio.</span></div>`;
  if(S.saved==="favs")body.insertAdjacentHTML("beforeend",`<div class="hint" style="margin-top:8px">${ic("info")}<span>Tus favoritos, vistos y salidas se guardan en este navegador. Para pasarlos a otro dispositivo: <button class="linkbtn" id="exp">Exportar</button> · <label class="linkbtn" style="cursor:pointer">Importar<input type="file" id="imp" accept="application/json" hidden></label></span></div>`);
  else body.innerHTML=seen.length?`<span class="status">Los sitios que has abierto, del más reciente al más antiguo. En el mapa se ven más claros.</span><div class="cards">${seen.map(p=>cardHTML(p,true)).join("")}</div>`:`<div class="empty"><span class="ei">${ic("check")}</span><b>Todavía no has mirado ningún sitio</b></div>`;}

/* ===== salidas ===== */
document.addEventListener("click",e=>{if(e.target.id!=="exp")return;const blob=new Blob([JSON.stringify(cleanEst(),null,1)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="donde-vamos-guardados.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);});
document.addEventListener("change",async e=>{if(e.target.id!=="imp"||!e.target.files[0])return;try{const d=JSON.parse(await e.target.files[0].text());const cur=cleanEst();adoptEst({favs:{...cur.favs,...(d.favs||{})},vistos:{...cur.vistos,...(d.vistos||{})},salidas:[...cur.salidas,...(d.salidas||[]).filter(t=>!cur.salidas.some(c=>c.id===t.id))]});saveEst();sym.redraw();render();toast("Guardados importados");}catch(err){toast("Ese fichero no es válido");}});
function uid8(){return Math.random().toString(36).slice(2,10);}
function newTrip(p){const [a,b]=p&&p.fecha_inicio?[p.fecha_inicio,p.fecha_fin||p.fecha_inicio]:weekend(0);const d=new Date(a+"T12:00:00");if(!p||!p.fecha_inicio)d.setDate(d.getDate()+1);
  const t={id:uid8(),nombre:p?("Salida a "+(p.municipio||p.nombre)):("Finde del "+d.getDate()+" de "+MES[d.getMonth()]),desde:a,hasta:b,ids:[]};S.est.salidas.push(t);return t;}
function tripText(t){const it=t.ids.map(id=>S.byId.get(id)).filter(Boolean);return t.nombre+(t.desde?" ("+fmtD(t.desde)+(t.hasta&&t.hasta!==t.desde?" – "+fmtD(t.hasta):"")+")":"")+"\n"+it.map((p,i)=>(i+1)+". "+p.nombre+(p.fecha_inicio?" ("+fmtRange(p)+")":"")+" — "+p.municipio+"\n   https://www.google.com/maps/dir/?api=1&destination="+p.lat+","+p.lng).join("\n");}
function renderTrips(){if(S.tripId){renderTrip();return;}const ts=S.est.salidas;
  body.innerHTML=ts.length?ts.slice().sort((a,b)=>(a.desde||"9").localeCompare(b.desde||"9")).map(t=>{const d=t.desde?new Date(t.desde+"T12:00:00"):null;const it=t.ids.map(i=>S.byId.get(i)).filter(Boolean);
    return `<button class="trip" data-trip="${esc(t.id)}"><span class="cal ${d?"":"none"}">${d?`<b>${d.getDate()}</b><span>${MES[d.getMonth()]}</span>`:`<b>–</b><span>sin fecha</span>`}</span><span class="tx"><div class="t">${esc(t.nombre)}</div><div class="m">${it.length} ${it.length===1?"sitio":"sitios"}${t.desde&&t.hasta&&t.hasta!==t.desde?" · "+fmtD(t.desde)+" – "+fmtD(t.hasta):""}</div><div class="dots">${it.slice(0,14).map(p=>`<i style="--c:${colorVar(p)}"></i>`).join("")}</div></span>${ic("chevron-right")}</button>`;}).join("")
  :`<div class="hint">${ic("info")}<span>Una salida agrupa sitios con fechas: el evento del sábado, dónde dormir y lo del domingo. Créala con «Nueva» o desde la ficha de cualquier sitio con «A salida».</span></div>`;}
function renderTrip(keep){const t=S.est.salidas.find(x=>x.id===S.tripId);if(!t){S.tripId=null;renderTrips();return;}const st=body.scrollTop;
  const items=t.ids.map(id=>S.byId.get(id)).filter(Boolean);const fn=Object.keys(S.est.favs).filter(id=>!t.ids.includes(id)&&S.byId.has(id));
  body.innerHTML=`<div class="dv"><button class="backbtn" id="t-back">${ic("arrow-left")}Salidas</button>
    <input class="tname" type="text" id="t-name" value="${esc(t.nombre)}" aria-label="Nombre de la salida">
    <div class="dates"><label>Desde<input type="date" id="t-from" value="${esc(t.desde||"")}"></label><label>Hasta<input type="date" id="t-to" value="${esc(t.hasta||"")}"></label></div>
    <div class="row"><button class="btn primary" id="t-map" ${items.length?"":"disabled"}>${ic("map")}Ruta en el mapa</button><button class="btn" id="t-copy" ${items.length?"":"disabled"}>${ic("copy")}Copiar</button><button class="btn" id="t-del">${ic("trash-2")}Borrar</button></div>
    <div class="h3">Paradas · ${items.length}</div>
    ${items.length?`<div>${items.map((p,i)=>{const out=p.capa==="evento"&&t.desde&&!overlaps(p,t.desde,t.hasta||t.desde);
      return `<div class="ti"><span class="stopnum" style="--c:${colorVar(p)}">${i+1}</span><button class="tx" data-s="${esc(p.id)}"><div class="t">${esc(p.nombre)}</div><div class="m">${p.capa==="evento"?fmtRange(p)+" · ":""}${esc(p.municipio)} · ${fmtMin(p._min)}</div>${out?`<div class="warnline">No coincide con las fechas de la salida</div>`:""}</button><span class="ord"><button data-up="${i}" aria-label="Subir">${ic("arrow-up")}</button><button data-down="${i}" aria-label="Bajar">${ic("arrow-down")}</button></span><button class="ibtn" data-rmi="${esc(p.id)}" aria-label="Quitar">${ic("x")}</button></div>`;}).join("")}</div>`
      :`<span class="status">Añade sitios desde su ficha con «A salida», o de tus favoritos aquí abajo.</span>`}
    ${fn.length?`<select id="t-add" aria-label="Añadir de favoritos"><option value="">+ Añadir de tus favoritos…</option>${fn.map(id=>`<option value="${esc(id)}">${esc(S.byId.get(id).nombre)}</option>`).join("")}</select>`:""}</div>`;
  body.scrollTop=keep?st:0;
  $("t-back").onclick=()=>{S.tripId=null;if(S.focus)unfocus();render();};
  let nT;$("t-name").oninput=e=>{t.nombre=e.target.value||"Salida";clearTimeout(nT);nT=setTimeout(saveEst,500);};
  $("t-from").onchange=e=>{t.desde=e.target.value||null;if(t.hasta&&t.desde&&t.hasta<t.desde)t.hasta=t.desde;saveEst();renderTrip(true);};
  $("t-to").onchange=e=>{t.hasta=e.target.value||null;saveEst();renderTrip(true);};
  $("t-map").onclick=()=>focusTrip(t.id);
  $("t-copy").onclick=async()=>{try{await navigator.clipboard.writeText(tripText(t));toast("Salida copiada como texto");}catch(e){toast("No se pudo copiar");}};
  $("t-del").onclick=e=>{const b=e.currentTarget;if(b.dataset.c!=="1"){b.dataset.c="1";b.innerHTML=ic("trash-2")+"¿Borrar? Pulsa otra vez";return;}const idx=S.est.salidas.indexOf(t);S.est.salidas.splice(idx,1);if(S.focus===t.id)unfocus();saveEst();S.tripId=null;render();toast("Salida borrada",()=>{S.est.salidas.splice(idx,0,t);saveEst();render();});};
  const ad=$("t-add");if(ad)ad.onchange=e=>{if(e.target.value){t.ids.push(e.target.value);saveEst();renderTrip(true);if(S.focus===t.id)focusTrip(t.id,true);}};
  body.querySelectorAll("[data-rmi]").forEach(b=>b.onclick=()=>{t.ids=t.ids.filter(x=>x!==b.dataset.rmi);saveEst();renderTrip(true);if(S.focus===t.id)focusTrip(t.id,true);});
  body.querySelectorAll("[data-up],[data-down]").forEach(b=>b.onclick=()=>{const ids=t.ids.filter(id=>S.byId.has(id));const i=+(b.dataset.up??b.dataset.down);const j=b.dataset.up!=null?i-1:i+1;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];t.ids=ids;saveEst();renderTrip(true);if(S.focus===t.id)focusTrip(t.id,true);});}
function focusTrip(id,noFit){const t=S.est.salidas.find(x=>x.id===id);if(!t)return;S.focus=id;const pts=t.ids.map(i=>S.byId.get(i)).filter(Boolean);refresh();
  drawRoute(pts.map(p=>({nombre:p.nombre,lat:p.lat,lng:p.lng,_c:colorVar(p)})),css("--sign"));
  $("focusbar").innerHTML=`<span>${esc(t.nombre)}</span><button id="unfocus">Ver todo</button>`;$("focusbar").hidden=false;$("unfocus").onclick=unfocus;if(!noFit)fitPts(pts,11);}
function unfocus(){S.focus=null;$("focusbar").hidden=true;routeLayer.clearLayers();refresh();}

function toast(msg,undo){const t=$("toast");t.innerHTML=`<span>${esc(msg)}</span>`+(undo?'<button id="undo">Deshacer</button>':"");t.hidden=false;clearTimeout(t._h);t._h=setTimeout(()=>t.hidden=true,3000);if(undo)$("undo").onclick=()=>{undo();t.hidden=true;};}
function toggleFav(id){const on=isFav(id);if(on)delete S.est.favs[id];else S.est.favs[id]=iso(today());saveEst();afterFav(id);toast(on?"Quitado de favoritos":"Guardado en favoritos",()=>{if(on)S.est.favs[id]=iso(today());else delete S.est.favs[id];saveEst();afterFav(id);});}
function afterFav(id){sym.redraw();renderRail();if(S.detail===id)renderDetail(true);body.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach(b=>{b.classList.toggle("on",isFav(id));});if(S.section==="saved")renderSaved();}

/* ===== estado ===== */
function savePrefs(){try{localStorage.setItem("dv-ui",JSON.stringify({layers:[...S.layers],types:[...S.types],dmode:S.dmode==="rango"?"todo":S.dmode,maxmin:S.maxmin,ninos:S.ninos,ac:S.ac,gratis:S.gratis,hideSeen:S.hideSeen,top:S.top,sort:S.sort,follow:S.follow,style:S.style,pw:S.pw,collapsed:S.collapsed}));}catch(e){}}
function restorePrefs(){try{const f=JSON.parse(localStorage.getItem("dv-ui")||"null");if(!f)return;Object.assign(S,{layers:new Set(f.layers&&f.layers.length?f.layers:LAYERS.map(l=>l.k)),types:new Set(f.types||[]),dmode:f.dmode||"todo",maxmin:+f.maxmin||300,ninos:!!f.ninos,ac:!!f.ac,gratis:!!f.gratis,hideSeen:!!f.hideSeen,top:!!f.top,sort:f.sort||"auto",follow:f.follow!==false,style:BASES[f.style]?f.style:"mapa",pw:+f.pw||400,collapsed:!!f.collapsed});}catch(e){}}
let wT=null,writing=false,dirty=false;
function cleanEst(){return {v:2,favs:{...S.est.favs},vistos:{...S.est.vistos},salidas:S.est.salidas.map(t=>({id:t.id,nombre:t.nombre,desde:t.desde||null,hasta:t.hasta||null,ids:t.ids.slice()}))};}
function saveEst(){dirty=true;try{localStorage.setItem("dv-est",JSON.stringify(cleanEst()));}catch(e){}clearTimeout(wT);wT=setTimeout(flush,600);}
function flush(){dirty=false;}
function adoptEst(d){if(!d)return;const o=x=>x&&typeof x==="object"&&!Array.isArray(x)?{...x}:{};S.est={favs:o(d.favs),vistos:o(d.vistos),salidas:Array.isArray(d.salidas)?d.salidas.map(t=>({...t,ids:Array.isArray(t.ids)?t.ids.slice():[]})):[]};}
try{const l=JSON.parse(localStorage.getItem("dv-est")||"null");if(l)adoptEst(l);}catch(e){}

/* ===== arranque ===== */
restorePrefs();setPW(S.pw);$("app").classList.toggle("collapsed",S.collapsed);
for(const n of new Set([...TYPE_ICON.map(x=>x[1]),...LAYERS.map(l=>l.i),"caravan","tent","square-parking","route","heart"]))iconImg(n);
applyStyle();render();
(async()=>{
  try{
    const [pr,ph,ar]=await Promise.all([fetch("data/places.json",{cache:"no-cache"}),fetch("data/photos.json",{cache:"no-cache"}).catch(()=>null),fetch("data/areas.json",{cache:"no-cache"}).catch(()=>null)]);
    const raw=await pr.json();S.photos=ph&&ph.ok?await ph.json().catch(()=>({})):{};
    const areas=ar&&ar.ok?await ar.json().catch(()=>null):null;
    if(areas&&Array.isArray(areas.items)){raw.items=(raw.items||raw).concat(areas.items.map(x=>({capa:"pernocta",nivel:2,ninos:false,precio:"desconocido",ac7m:"desconocido",...x})));}
    const seen=new Set();
    S.pts=(raw.items||raw).filter(p=>p&&p.id&&!seen.has(p.id)&&seen.add(p.id)&&typeof p.lat==="number"&&typeof p.lng==="number"&&LAYERS.some(l=>l.k===p.capa))
      .map(p=>{const q={...p,tipos:Array.isArray(p.tipos)?p.tipos:[]};q._min=driveMin(q);q._h=norm([q.nombre,q.municipio,q.zona,q.tipos.join(" "),q.descripcion,(q.paradas||[]).map(s=>s.nombre).join(" ")].join(" "));return q;});
    S.byId=new Map(S.pts.map(p=>[p.id,p]));S.updated=raw.actualizado||null;listKey="";refresh();renderRail();if(isMobile())setSnap(1,true);
    const hid=decodeURIComponent((location.hash||"").slice(1));if(hid&&S.byId.has(hid))openDetail(hid,{fly:true});
  }catch(e){body.innerHTML=`<div class="empty"><b>No se pudieron cargar los sitios</b><span>Comprueba la conexión y recarga la página.</span></div>`;}
})();
