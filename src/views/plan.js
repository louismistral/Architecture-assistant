/* ============================================================================
   LE PLAN DU MASSING

   Une vraie vue en plan, en mètres, sur le relevé du géomètre : courbes de
   niveau, parcelles, routes, murets, terrain de foot, bâtiments existants,
   périmètre du concours — et les volumes du projet posés dessus.

   Le dessin est en MÈTRES, un mètre pour une unité SVG. La seule conversion est
   le sens de l'axe Y : le nord monte à l'écran, le relevé le fait croître, donc
   on le nie. Tout le reste — zoom, déplacement, rotation — se fait dans les
   mètres du site, jamais en pixels : une poignée qui travaillerait en pixels
   tournerait un bâtiment différemment selon le zoom.

   On SÉLECTIONNE un volume en cliquant, on le DÉPLACE en le tirant, on le
   TOURNE par sa poignée. Chacun de ces gestes redessine la 3D dans la foulée :
   les deux vues ne sont pas deux dessins, c'est le même modèle vu deux fois.
   ========================================================================= */
import { fmt } from "../core/format.js";
import { s as svg } from "../core/svg.js";
import { PER, SITE } from "../data/site.js";
import { lvlOf } from "../mix/floors.js";
import { MASS, cellules, famCol, filtreDe, volRect } from "../mass/model.js";
import { admissible } from "../mass/gen.js";
import { coins, dansRect } from "../mass/geom.js";

var host = null, root = null, gVol = null, wired = false;
var VUE = { cx: 88, cy: 61, w: 260 };      /* centre et largeur du champ, en mètres */
var drag = null;
var onChange = null;                        /* prévenir la 3D et le panneau */

export function planOnChange(fn){ onChange = fn; }
function change(quoi){ if(onChange) onChange(quoi); }

function Y(y){ return -y; }
function pt(p){ return p[0].toFixed(2) + "," + Y(p[1]).toFixed(2); }
function chemin(P, close){
  return "M " + P.map(pt).join(" L ") + (close ? " Z" : "");
}

/* ---------- montage ---------------------------------------------------------
   Le SVG est recréé à chaque rendu de panneau — `render()` vide `#panels` —,
   mais le CHAMP de vision, lui, vit dans le module : revenir au massing ne doit
   pas remettre la vue à zéro. */
export function planMount(hostEl){
  host = hostEl;
  while(host.firstChild) host.removeChild(host.firstChild);
  root = svg("svg", { "class":"plan__svg", role:"img",
    "aria-label":"Plan du site : périmètre du concours, bâtiments existants, "
      + "courbes de niveau et volumes du projet." });
  host.appendChild(root);
  if(!wired) wirePlan();
  wired = true;
  planDraw();
}

function champ(){
  var r = host ? host.getBoundingClientRect() : { width:800, height:520 };
  var asp = (r.height || 520) / Math.max(1, r.width || 800);
  var h = VUE.w * asp;
  return { x0: VUE.cx - VUE.w / 2, y0: Y(VUE.cy) - h / 2, w: VUE.w, h: h };
}

/* ---------- le dessin ------------------------------------------------------- */
export function planDraw(){
  if(!root) return;
  while(root.firstChild) root.removeChild(root.firstChild);
  var C = champ();
  root.setAttribute("viewBox", [C.x0.toFixed(1), C.y0.toFixed(1),
                                C.w.toFixed(1), C.h.toFixed(1)].join(" "));

  /* --- le relevé, du plus lointain au plus proche ---
     L'ordre est celui d'un plan d'architecte : le terrain d'abord, le bâti
     ensuite, le projet par-dessus tout. */
  var g = svg("g", { "class":"plan__site" });
  /* Le relevé donne une courbe tous les 50 cm. La hiérarchie est celle d'un
     plan topographique : la demi-courbe au trait le plus faible, le mètre plein
     au trait courant, les cinq mètres au trait fort. Les demi-courbes ne
     s'allument qu'en approchant — de loin elles font un aplat. */
  var pasC = VUE.w > 420 ? 2 : VUE.w > 200 ? 1 : .5;
  (SITE.ctr || []).forEach(function(c){
    if(Math.abs(c[0] / pasC - Math.round(c[0] / pasC)) > .01) return;
    var cl = "plan-ctr";
    if(Math.abs(c[0] % 5) < .01) cl += " is-cinq";
    else if(Math.abs(c[0] % 1) < .01) cl += " is-maitre";
    g.appendChild(svg("path", { d: chemin(c[1], false), "class": cl }));
  });
  (SITE.par || []).forEach(function(P){
    g.appendChild(svg("path", { d: chemin(P, true), "class":"plan-par" }));
  });
  (SITE.foo || []).forEach(function(P){
    g.appendChild(svg("path", { d: chemin(P, false), "class":"plan-foo" }));
  });
  (SITE.rou || []).forEach(function(P){
    g.appendChild(svg("path", { d: chemin(P, false), "class":"plan-rou" }));
  });
  (SITE.mur || []).forEach(function(P){
    g.appendChild(svg("path", { d: chemin(P, false), "class":"plan-mur" }));
  });
  (SITE.esc || []).forEach(function(P){
    g.appendChild(svg("path", { d: chemin(P, false), "class":"plan-mur" }));
  });
  (SITE.bat || []).forEach(function(P){
    g.appendChild(svg("path", { d: chemin(P, true), "class":"plan-bat" }));
  });
  (SITE.enq || []).forEach(function(P){
    g.appendChild(svg("path", { d: chemin(P, true), "class":"plan-enq" }));
  });
  root.appendChild(g);

  /* --- le périmètre du concours, et le recul de travail --- */
  var gp = svg("g", { "class":"plan__per" });
  gp.appendChild(svg("path", { d: chemin(PER, true), "class":"plan-per" }));
  root.appendChild(gp);

  /* --- les volumes --- */
  gVol = svg("g", { "class":"plan__vol" });
  MASS.vol.forEach(function(v, k){ dessineVol(gVol, v, k); });
  root.appendChild(gVol);

  /* --- l'échelle et le nord --- */
  root.appendChild(repere(C));
}

/* Un volume : tous ses étages en trait fin, l'étage montré en plein. Le plan
   d'un massing n'est pas celui d'un bâtiment — il doit dire d'un coup d'œil la
   forme au sol ET la silhouette qui la surmonte. */
function dessineVol(g, v, k){
  var sel = MASS.sel === v.id;
  /* Un ouvrage du SECOND TEMPS se dessine en pointillé — c'est ce que le
     règlement demande au plan de situation 1:500, et c'est aussi ce qui dit
     d'un coup d'œil qu'il ne sera pas bâti avec l'école. */
  var gv = svg("g", { "class":"plan-vol" + (sel ? " is-sel" : "")
                        + (v.ph ? " is-ph" : ""),
                      "data-vol": v.id, tabindex:"0" });
  var montres = v.lv.filter(function(e){
    return MASS.etage < 0 ? true : e.i === MASS.etage;
  });
  if(!montres.length){ return; }
  /* L'étage plein : celui qu'on montre, ou l'emprise au sol quand on montre
     tout — c'est elle qui compte pour le terrain. */
  var plein = MASS.etage >= 0 ? montres[0] : bas(v);
  montres.forEach(function(e){
    if(e === plein) return;
    var r = volRect(v, e);
    gv.appendChild(svg("path", { d: chemin(coins(r), true), "class":"plan-vol__et" }));
  });
  if(plein){
    var rc = volRect(v, plein);
    var q = coins(rc);
    if(MASS.mono){
      gv.appendChild(svg("path", { d: chemin(q, true), "class":"plan-vol__p" }));
    } else {
      /* Le programme, pavé dans le rectangle : on lit OÙ sont les classes, pas
         seulement qu'il y a un bâtiment. */
      cellules(plein.i, rc.w, rc.d, filtreDe(v, plein)).forEach(function(c){
        var cx = c.x + c.w / 2, cy = c.y + c.d / 2;
        var sub = { x: rc.x + cx * Math.cos(rc.a) - cy * Math.sin(rc.a),
                    y: rc.y + cx * Math.sin(rc.a) + cy * Math.cos(rc.a),
                    w: c.w, d: c.d, a: rc.a };
        var p = svg("path", { d: chemin(coins(sub), true), "class":"plan-cel" });
        p.style.fill = famCol(c.f);
        p.appendChild(svg("title", null));
        p.lastChild.textContent = c.n + " · " + fmt(Math.round(c.a)) + " m²";
        gv.appendChild(p);
      });
      gv.appendChild(svg("path", { d: chemin(q, true), "class":"plan-vol__c" }));
    }
    /* Le nom et la cote, au centre, dans le sens du bâtiment. */
    var nv = 0;
    v.lv.forEach(function(e){ if(lvlOf(e.i) >= 0) nv++; });
    var t = svg("text", { x: rc.x.toFixed(2), y: Y(rc.y).toFixed(2),
      "class":"plan-vol__n", "text-anchor":"middle",
      transform: "rotate(" + (-rc.a * 180 / Math.PI).toFixed(1) + " "
               + rc.x.toFixed(2) + " " + Y(rc.y).toFixed(2) + ")" });
    t.textContent = (v.nom ? v.nom : v.fix ? "Sport" : "V" + (k + 1))
      + " · " + fmt(Math.round(rc.w * rc.d)) + " m²"
      + (nv > 1 ? " · R+" + (nv - 1) : "");
    gv.appendChild(t);
    if(sel) gv.appendChild(poignee(rc));
  }
  g.appendChild(gv);
}
/* Ce que le pavage d'un corps doit montrer. Un corps aux cotes imposées ne
   porte que SON poste ; les autres ne portent pas le sien. Sans cela on
   dessinait des salles de classe dans la salle de sport, et la salle de sport
   dans chaque bâtiment. */
function bas(v){
  var e = null;
  v.lv.forEach(function(x){
    if(lvlOf(x.i) < 0) return;
    if(!e || x.i < e.i) e = x;
  });
  return e || v.lv[0];
}
/* La poignée de rotation : posée au bout de l'axe long, dehors, reliée par un
   trait. On tourne en la tirant — c'est le geste qu'on attend d'un plan. */
function poignee(rc){
  var g = svg("g", { "class":"plan-poi" });
  var d = rc.w / 2 + 7;
  var px = rc.x + d * Math.cos(rc.a), py = rc.y + d * Math.sin(rc.a);
  g.appendChild(svg("line", { x1:rc.x.toFixed(2), y1:Y(rc.y).toFixed(2),
    x2:px.toFixed(2), y2:Y(py).toFixed(2), "class":"plan-poi__l" }));
  g.appendChild(svg("circle", { cx:px.toFixed(2), cy:Y(py).toFixed(2), r:"2.6",
    "class":"plan-poi__c", "data-poi":"1" }));
  return g;
}

/* L'échelle et le nord. Un plan sans échelle n'est pas un plan. */
function repere(C){
  var g = svg("g", { "class":"plan__rep" });
  var l = VUE.w > 300 ? 50 : VUE.w > 140 ? 20 : 10;
  var x = C.x0 + C.w * .04, y = C.y0 + C.h * .94;
  g.appendChild(svg("path", { d:"M " + x + "," + y + " L " + (x + l) + "," + y,
    "class":"plan-ech" }));
  g.appendChild(svg("path", { d:"M " + x + "," + (y - 1.2) + " L " + x + "," + (y + 1.2)
    + " M " + (x + l) + "," + (y - 1.2) + " L " + (x + l) + "," + (y + 1.2),
    "class":"plan-ech" }));
  var t = svg("text", { x:(x + l / 2).toFixed(1), y:(y - 2).toFixed(1),
    "class":"plan-ech__t", "text-anchor":"middle" });
  t.textContent = l + " m";
  g.appendChild(t);
  var nx = C.x0 + C.w * .955, ny = C.y0 + C.h * .09;
  g.appendChild(svg("path", { d:"M " + nx + "," + (ny + 6) + " L " + nx + "," + (ny - 5)
    + " M " + (nx - 2) + "," + (ny - 2) + " L " + nx + "," + (ny - 5)
    + " L " + (nx + 2) + "," + (ny - 2), "class":"plan-nord" }));
  var n = svg("text", { x:nx.toFixed(1), y:(ny + 11).toFixed(1),
    "class":"plan-ech__t", "text-anchor":"middle" });
  n.textContent = "N";
  g.appendChild(n);
  return g;
}

/* ---------- les gestes -------------------------------------------------------
   Un seul jeu d'écouteurs, posé une fois sur le document : le SVG est refait à
   chaque dessin, des écouteurs posés dessus seraient perdus à chaque geste. */
function monde(e){
  if(!root) return null;
  var m = root.getScreenCTM();
  if(!m) return null;
  var p = root.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  var q = p.matrixTransform(m.inverse());
  return { x:q.x, y:-q.y };
}
function volAu(x, y){
  var found = null;
  MASS.vol.forEach(function(v){
    var e = MASS.etage >= 0 ? volEt(v, MASS.etage) : bas(v);
    if(!e) return;
    if(dansRect(volRect(v, e), x, y)) found = v;
  });
  return found;
}
function volEt(v, i){
  var e = null;
  v.lv.forEach(function(x){ if(x.i === i) e = x; });
  return e;
}
export function volDe(id){
  var v = null;
  MASS.vol.forEach(function(x){ if(x.id === id) v = x; });
  return v;
}

function wirePlan(){
  document.addEventListener("pointerdown", function(e){
    if(!root || !host || !host.contains(e.target)) return;
    var w = monde(e);
    if(!w) return;
    var poi = e.target.closest ? e.target.closest("[data-poi]") : null;
    if(poi && MASS.sel){
      var v0 = volDe(MASS.sel);
      drag = { mode:"tourne", v:v0, a0:v0.a,
               th0:Math.atan2(w.y - v0.y, w.x - v0.x),
               libre: admissible(v0, MASS.vol) ? 0 : 1 };
      e.preventDefault();
      return;
    }
    var v = volAu(w.x, w.y);
    if(v){
      MASS.sel = v.id;
      drag = { mode:"bouge", v:v, dx:v.x - w.x, dy:v.y - w.y, live:false,
               libre: admissible(v, MASS.vol) ? 0 : 1 };
      planDraw(); change("sel");
      e.preventDefault();
      return;
    }
    MASS.sel = null;
    drag = { mode:"pan", x0:e.clientX, y0:e.clientY, cx:VUE.cx, cy:VUE.cy };
    planDraw(); change("sel");
  });
  document.addEventListener("pointermove", function(e){
    if(!drag) return;
    if(drag.mode === "pan"){
      var r = host.getBoundingClientRect();
      var k = VUE.w / Math.max(1, r.width);
      VUE.cx = drag.cx - (e.clientX - drag.x0) * k;
      VUE.cy = drag.cy + (e.clientY - drag.y0) * k;
      planDraw();
      return;
    }
    var w = monde(e);
    if(!w) return;
    if(drag.mode === "bouge"){
      var nx = Math.round((w.x + drag.dx) * 10) / 10;
      var ny = Math.round((w.y + drag.dy) * 10) / 10;
      /* Un bâtiment ne sort pas du périmètre du concours, et la souris n'y
         change rien : la position visée est essayée, et si elle ne tient pas on
         essaie chaque axe SÉPARÉMENT. Le corps glisse alors le long de la
         limite au lieu de s'y arrêter net — c'est le geste qu'on attend d'un
         plan, et il n'y a rien à corriger après coup. */
      if(drag.libre){
        /* Un corps DÉJÀ dehors — une composition qui ne tient pas sur ce
           terrain, ou relue d'un enregistrement plus ancien — se déplace
           librement tant qu'il n'est pas rentré : le bloquer où il est aurait
           rendu impossible de le ramener à la main. Dès qu'il tient, la règle
           reprend. */
        drag.v.x = nx; drag.v.y = ny;
        if(admissible(drag.v, MASS.vol)) drag.libre = 0;
      }
      else if(admissible(drag.v, MASS.vol, nx, ny, drag.v.a)){ drag.v.x = nx; drag.v.y = ny; }
      else if(admissible(drag.v, MASS.vol, nx, drag.v.y, drag.v.a)) drag.v.x = nx;
      else if(admissible(drag.v, MASS.vol, drag.v.x, ny, drag.v.a)) drag.v.y = ny;
    } else {
      var th = Math.atan2(w.y - drag.v.y, w.x - drag.v.x);
      var a = drag.a0 + (th - drag.th0);
      /* Maj : on tourne au quart de degré près, sinon par pas de cinq degrés —
         un massing s'aligne, il ne se règle pas au centième. */
      if(!e.shiftKey) a = Math.round(a / (Math.PI / 36)) * (Math.PI / 36);
      /* Tourner peut faire sortir autant que déplacer : l'angle qui ne tient
         pas n'est simplement pas pris. */
      if(drag.libre || admissible(drag.v, MASS.vol, drag.v.x, drag.v.y, a)) drag.v.a = a;
    }
    drag.live = true;
    planDraw(); change("geo");
  });
  document.addEventListener("pointerup", function(){
    if(!drag) return;
    var mode = drag.mode, live = drag.live;
    drag = null;
    if(mode !== "pan" && live) change("fin");
  });
  document.addEventListener("wheel", function(e){
    if(!root || !host || !host.contains(e.target)) return;
    e.preventDefault();
    var w = monde(e);
    var k = Math.exp(e.deltaY * .0016);
    var nw = Math.max(26, Math.min(560, VUE.w * k));
    if(w){
      /* Zoomer SOUS LE CURSEUR : le point visé ne doit pas bouger. */
      var f = nw / VUE.w;
      VUE.cx = w.x + (VUE.cx - w.x) * f;
      VUE.cy = w.y + (VUE.cy - w.y) * f;
    }
    VUE.w = nw;
    planDraw();
  }, { passive:false });
}

/* Recadrer sur le périmètre — le geste qu'on cherche dès qu'on s'est perdu. */
export function planFit(){
  var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  PER.forEach(function(p){
    if(p[0] < x0) x0 = p[0]; if(p[0] > x1) x1 = p[0];
    if(p[1] < y0) y0 = p[1]; if(p[1] > y1) y1 = p[1];
  });
  VUE.cx = (x0 + x1) / 2; VUE.cy = (y0 + y1) / 2;
  VUE.w = (x1 - x0) * 1.18;
  planDraw();
}
export function planVue(){ return VUE; }
