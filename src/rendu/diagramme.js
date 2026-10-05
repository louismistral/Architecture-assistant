/* ============================================================================
   PLANCHE MASSING · DIAGRAMMES — la volumétrie en quatre temps, à la manière de BIG

     01 LE CUBE        un cube : exactement les m³ du projet
     02 DIVISER        le cube se partage en autant de volumes que le projet a de
                       corps, chacun à son emprise au sol définitive, à la même
                       hauteur — le volume ne change pas
     03 ORIENTER       la figure tourne et se pose : chaque corps à sa place
     04 LES NIVEAUX    chaque corps prend sa hauteur : c'est le volume généré

   Tout se lit dans le volume final (`etagesDe()`), qui n'est jamais retouché :
   les emprises des étapes 02-03 sont celles des corps posés (tournées en
   arrière de l'angle de la figure pour l'étape 02), les hauteurs de l'étape 04
   sont les vraies. Les textes s'adaptent : un seul corps, un angle nul, une
   hauteur unique se disent comme tels. Volumes blancs, le geste en orange,
   flèches noires, un verbe en gras. La même planche s'affiche dans le rail du
   massing (`svg()`) et s'imprime (`pdf()`).
   ========================================================================= */
import { fmt } from "../core/format.js";
import { cssRGB } from "../core/gl.js";
import { trace } from "../core/pdf.js";
import { PER } from "../data/site.js";
import { ENCRE, FORMATS } from "../data/planches.js";
import { flName, lvlOf } from "../mix/floors.js";
import { bbox, coins } from "../mass/geom.js";
import { MASS, etagesDe, familleDom, famTok, partiOf } from "../mass/model.js";

var E = ENCRE;
export var BLANC = [E.blanc, E.cote, E.cote2];
var ACC = [E.accent, [0.82, 0.29, 0.08], [0.7, 0.24, 0.06]];
var GRIS = [0.55, 0.55, 0.55], TXT = [0.3, 0.3, 0.3], TIRETS = { dash:[2.5, 1.8] };
var CAP = { axe:"sur le plus long côté de la parcelle", soleil:"vers le meilleur compromis soleil-vue",
            libre:"librement autour de l'axe de la parcelle", pente:"pour que ses rangs suivent la pente" };

export function couleur(f){
  var c = typeof document !== "undefined" ? cssRGB(famTok(f)) : [0.7, 0.7, 0.7];
  return [c, c.map(function(v){ return v * .82; }), c.map(function(v){ return v * .68; })];
}
function coupe(s, n){
  var L = [], l = "";
  s.split(" ").forEach(function(m){ if((l + " " + m).trim().length > n){ L.push(l.trim()); l = m; } else l += " " + m; });
  if(l.trim()) L.push(l.trim());
  return L;
}
function ccw(p){
  var a = 0;
  for(var i = 0; i < p.length; i++){ var q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
  return a < 0 ? p.slice().reverse() : p;
}
function nb(x){ return String(Math.round(x * 10) / 10).replace(".", ","); }
function deg(a){ var d = ((a * 180 / Math.PI) % 180 + 180) % 180; return Math.round(d > 90 ? d - 180 : d); }

/* ---------- la vue : la même pour les quatre cases ---------- */
/* la vue : l'angle du plan, l'écrasement de sa profondeur, celui des hauteurs */
export var VUE = { r:-0.62, el:0.5, z:0.9 };
export function axo(cadre, pts, hmax){
  var r = VUE.r, el = VUE.el, c = Math.cos(r), s = Math.sin(r);
  function brut(x, y, z){ return [x * c - y * s, (x * s + y * c) * el + z * VUE.z]; }
  var B = bbox(pts.map(function(p){ return brut(p[0], p[1], 0); }).concat(pts.map(function(p){ return brut(p[0], p[1], hmax); })));
  var k = Math.min(cadre[2] / B.w, cadre[3] / B.h) * 0.92;
  var ox = cadre[0] + (cadre[2] - B.w * k) / 2 - B.x0 * k, oy = cadre[1] + (cadre[3] - B.h * k) / 2 - B.y0 * k;
  var A = function(x, y, z){ var b = brut(x, y, z || 0); return [ox + b[0] * k, oy + b[1] * k]; };
  A.prof = function(x, y){ return x * s + y * c; };
  A.g = [s, c];
  return A;
}
export function prisme(t, A, poly, z0, z1, c, o){
  o = o || {};
  var p = ccw(poly), F = [];
  for(var i = 0; i < p.length; i++){
    var a = p[i], b = p[(i + 1) % p.length], n = [b[1] - a[1], -(b[0] - a[0])];
    if(n[0] * A.g[0] + n[1] * A.g[1] >= 0) continue;
    F.push({ a:a, b:b, d:A.prof((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), l:Math.abs(n[0]) > Math.abs(n[1]) });
  }
  /* `o.stroke === false` : des faces pleines, sans trait */
  var lw = o.lw || .5, tr = o.stroke === false ? null : o.stroke || E.noir;
  function st(fill){ return o.dash ? { stroke:tr, lw:lw, dash:o.dash } : { fill:fill, stroke:tr, lw:lw }; }
  F.sort(function(u, v){ return v.d - u.d; }).forEach(function(f){
    t.poly([A(f.a[0], f.a[1], z0), A(f.b[0], f.b[1], z0), A(f.b[0], f.b[1], z1), A(f.a[0], f.a[1], z1)], st(c && (f.l ? c[1] : c[2])));
  });
  t.poly(p.map(function(q){ return A(q[0], q[1], z1); }), st(c && c[0]));
}
export function peindre(t, A, C){
  C.sort(function(a, b){
    var da = A.prof(a.x, a.y), db = A.prof(b.x, b.y);
    return Math.abs(da - db) > 3 ? db - da : a.z0 - b.z0;
  }).forEach(function(k){ prisme(t, A, k.q, k.z0, k.z1, k.c, k.o); if(k.apres) k.apres(t); });
}
function fleche(t, a, b, lw){
  lw = lw || 1.5;
  var dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, h = 2.5 + lw * 1.8;
  t.ligne([a, [b[0] - ux * h, b[1] - uy * h]], { stroke:E.noir, lw:lw });
  t.poly([b, [b[0] - ux * h * 2 + uy * h, b[1] - uy * h * 2 - ux * h], [b[0] - ux * h * 2 - uy * h, b[1] - uy * h * 2 + ux * h]], { fill:E.noir });
}
function cote(t, a, b, txt){
  t.ligne([a, b], { stroke:E.accent, lw:.8 });
  [a, b].forEach(function(p){ t.cercle(p[0], p[1], 1.3, { fill:E.accent }); });
  t.texte((a[0] + b[0]) / 2 + 6, (a[1] + b[1]) / 2, txt, { size:8, gras:true, fill:E.accent });
}
export function sol(t, A){ t.poly(PER.map(function(p){ return A(p[0], p[1], 0); }), { fill:E.sol, stroke:GRIS, lw:.5 }); }

/* ---------- lire le volume final ---------- */
/* Les polygones d'un étage : son contour quand il est d'un seul tenant —
   un L, un U se dessinent sans mur commun —, sinon une boîte par part. */
function formes(e){
  return e.contour.loops.length === 1 ? [e.contour.loops[0]] : e.rcs.map(coins);
}
function centreDe(q){
  var x = 0, y = 0;
  q.forEach(function(p){ x += p[0] / q.length; y += p[1] / q.length; });
  return [x, y];
}
function lire(vols){
  var C = [], z00 = Infinity;
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) >= 0) z00 = Math.min(z00, e.z0); }); });
  if(!isFinite(z00)) z00 = 0;
  vols.forEach(function(v){
    var et = etagesDe(v).filter(function(e){ return lvlOf(e.e.i) >= 0; });
    if(!et.length) return;
    var q = formes(et[0]), a = et[0].contour.aire, g = centreDe([].concat.apply([], q));
    C.push({ v:v, et:et, sol:q, aire:a, x:g[0], y:g[1], base:Math.max(0, et[0].z0 - z00), top:et[et.length - 1].z1 - z00,
             z:function(e){ return [Math.max(0, e.z0 - z00), e.z1 - z00]; } });
  });
  var ecole = C.filter(function(c){ return !c.v.ph; });
  /* les m³ du projet : chaque étage hors sol, emprise × hauteur — l'emprise
     d'un volume fusionné est celle de son contour */
  var V = 0, emprise = 0;
  ecole.forEach(function(c){
    c.et.forEach(function(e){ V += e.contour.aire * (e.z1 - e.z0); });
    emprise += c.aire;
  });
  /* l'angle de la figure et son centre : `vols.T` s'il est là, sinon le corps principal */
  var maj = ecole.slice().sort(function(a, b){ return b.aire - a.aire; })[0];
  var th = vols.T ? vols.T.a : maj ? maj.et[0].rc.a : 0;
  var cx = 0, cy = 0;
  ecole.forEach(function(c){ cx += c.x * c.aire; cy += c.y * c.aire; });
  cx /= emprise || 1; cy /= emprise || 1;
  /* un corps tourné en arrière de l'angle de la figure, autour de son centre */
  function arriere(q){
    var c = Math.cos(-th), s = Math.sin(-th);
    return q.map(function(p){ var x = p[0] - cx, y = p[1] - cy; return [cx + x * c - y * s, cy + x * s + y * c]; });
  }
  var H = Math.max.apply(null, ecole.map(function(c){ return c.top; }).concat([1]));
  /* la hauteur PROPRE de chaque corps, sans la pente du terrain sous lui */
  var hs = ecole.map(function(c){ return c.top - c.base; });
  var hmin = Math.min.apply(null, hs.concat([H])), hmaxC = Math.max.apply(null, hs.concat([0]));
  return { C:C, ecole:ecole, V:V, emprise:emprise, hU:V / Math.max(1, emprise), th:th, cx:cx, cy:cy, arriere:arriere, H:H, hmin:hmin, hmaxC:hmaxC };
}
/* un prisme par polygone, son centre pour l'ordre de peinture */
function prismes(Q, z0, z1, c, o){
  return Q.map(function(q){ var g = centreDe(q); return { x:g[0], y:g[1], q:q, z0:z0, z1:z1, c:c, o:o }; });
}

/* ---------- les quatre temps ---------- */
function temps(vols){
  var X = lire(vols), T = vols.trace || {}, n = X.ecole.length, S = [];
  var cote3 = Math.cbrt(X.V), cube = coins({ x:X.cx, y:X.cy, w:cote3, d:cote3, a:0 });
  var pa = partiOf(vols.parti || MASS.parti), ang = deg(X.th);

  S.push({ n:"LE CUBE", d:"Le projet demande " + fmt(Math.round(X.V)) + " m³ hors sol : un cube de " + nb(cote3) + " m de côté. Tout part de là.",
    f:function(t, A){
      sol(t, A);
      peindre(t, A, [{ x:X.cx, y:X.cy, q:cube, z0:0, z1:cote3, c:ACC }]);
      cote(t, A(cube[1][0], cube[1][1], 0), A(cube[1][0], cube[1][1], cote3), nb(cote3) + " m");
    } });

  S.push({ n:"DIVISER", d:n > 1
      ? "Le cube se divise en " + n + " volumes, chacun à son emprise au sol définitive (" + fmt(Math.round(X.emprise)) + " m² en tout), "
        + nb(X.hU) + " m de haut pour garder les mêmes m³ — rangés selon le parti « " + pa.n.toLowerCase() + " »."
      : "Le cube s'étale en un seul volume, à son emprise définitive (" + fmt(Math.round(X.emprise)) + " m²), " + nb(X.hU) + " m de haut : mêmes m³.",
    f:function(t, A){
      sol(t, A);
      prisme(t, A, cube, 0, cote3, null, TIRETS);
      var C = [].concat.apply([], X.ecole.map(function(c){ return prismes(c.sol.map(X.arriere), 0, X.hU, ACC); }));
      peindre(t, A, C);
      C.slice(0, 7).forEach(function(k){
        var dx = k.x - X.cx, dy = k.y - X.cy, l = Math.hypot(dx, dy);
        if(l > 8) fleche(t, A(X.cx, X.cy, cote3 * .8), A(k.x - dx / l * 3, k.y - dy / l * 3, X.hU + 3), 1.1);
      });
    } });

  S.push({ n:"ORIENTER", d:Math.abs(ang) < 2
      ? "La figure garde l'axe nord-sud et se pose sur la parcelle, à la place où tout tient."
      : "La figure tourne de " + ang + "°" + (CAP[T.cap] ? ", " + CAP[T.cap] : "") + ", et se pose sur la parcelle, à la place où tout tient.",
    f:function(t, A){
      sol(t, A);
      X.ecole.forEach(function(c){ c.sol.forEach(function(q){ t.poly(X.arriere(q).map(function(p){ return A(p[0], p[1], 0); }), { stroke:E.noir, lw:.5, dash:[2.5, 1.8] }); }); });
      peindre(t, A, [].concat.apply([], X.ecole.map(function(c){ return prismes(c.sol, c.base, c.base + X.hU, ACC); })));
      if(Math.abs(ang) >= 2){
        var P = [], r0 = Math.sqrt(X.emprise) * .9;
        for(var i = 0; i <= 16; i++){ var a = X.th * i / 16; P.push(A(X.cx + Math.cos(a) * r0, X.cy + Math.sin(a) * r0, X.hU + 5)); }
        t.ligne(P.slice(0, -1), { stroke:E.noir, lw:1.5 });
        fleche(t, P[P.length - 3], P[P.length - 1], 1.5);
      }
    } });

  /* 4 · les niveaux : le volume généré, tel quel */
  var niv = {};
  X.ecole.forEach(function(c){ c.et.forEach(function(e){ niv[lvlOf(e.e.i)] = e.e.i; }); });
  var noms = Object.keys(niv).sort(function(a, b){ return a - b; }).map(function(l){ return flName(niv[l]).toLowerCase(); });
  var haut = X.ecole.filter(function(c){ return Math.abs(c.top - c.base - X.hmaxC) < .01; })[0];
  var bas = X.ecole.slice().sort(function(a, b){ return (a.top - a.base) - (b.top - b.base); })[0];
  S.push({ n:"LES NIVEAUX", d:(X.hmaxC - X.hmin < .5
        ? "Tous les corps prennent la même hauteur, " + nb(X.hmaxC) + " m"
        : "Chaque corps prend sa hauteur, de " + nb(X.hmin) + " m à " + nb(X.hmaxC) + " m : il ne monte que des niveaux qu'il porte (" + noms.join(", ") + ")")
      + ". C'est le volume généré, identique ; piscine et chauffage à distance en pointillé.",
    f:function(t, A){
      sol(t, A);
      var C = [];
      X.C.forEach(function(c){ c.et.forEach(function(e){
        var z = c.z(e);
        C = C.concat(prismes(formes(e), z[0], z[1], c.v.ph ? null : couleur(familleDom(e.e.i)), c.v.ph ? TIRETS : null));
      }); });
      peindre(t, A, C);
      if(haut){ var q = haut.sol[0][1]; cote(t, A(q[0], q[1], haut.base), A(q[0], q[1], haut.top), nb(haut.top - haut.base) + " m"); }
      if(bas && bas !== haut){ var q2 = bas.sol[0][1]; cote(t, A(q2[0], q2[1], bas.base), A(q2[0], q2[1], bas.top), nb(bas.top - bas.base) + " m"); }
    } });
  S.X = X;
  S.cube = cote3;
  return S;
}

/* ---------- la planche : quatre cases, deux par deux ---------- */
export function planDiagrammes(vols){
  var F = FORMATS.A2, t = trace(F.w, F.h), m = 50;
  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:E.blanc });
  t.texte(m, F.h - m - 26, "LA VOLUMÉTRIE EN QUATRE TEMPS", { size:30, gras:true });
  t.texte(m, F.h - m - 46, "Un cube, divisé, orienté, étagé · " + partiOf(vols.parti || MASS.parti).n, { size:10, fill:[0.4, 0.4, 0.4] });
  diagrammes(t, vols, [m, m, F.w - 2 * m, F.h - 2 * m - 76], 2);
  t.texte(F.w - m, m - 24, "Concours CS Saxon · planche massing · A2", { size:7, fill:[0.45, 0.45, 0.45], ancre:"end" });
  return t;
}

/* Les quatre temps dans un cadre [x, y, l, h], sur `cols` colonnes : la planche
   A2 en a deux, le cadre « Schemes » du midterm quatre. */
export function diagrammes(t, vols, cadre, cols){
  var g = 40, S = temps(vols), n = S.length, X = S.X, rows = Math.ceil(n / cols);
  /* le même cadrage partout : la parcelle, le cube, les corps */
  var pts = PER.slice();
  X.C.forEach(function(c){ c.sol.forEach(function(q){ pts = pts.concat(q).concat(X.arriere(q)); }); });
  var hm = Math.max(S.cube, X.H) * 1.2;
  var top = cadre[1] + cadre[3], cw = (cadre[2] - (cols - 1) * g) / cols, ch = (cadre[3] - (rows - 1) * g) / rows;
  S.forEach(function(s, i){
    var col = i % cols, row = Math.floor(i / cols);
    var x = cadre[0] + col * (cw + g), y = top - (row + 1) * ch - row * g;
    t.decoupe([[x, y + 56], [x + cw, y + 56], [x + cw, y + ch], [x, y + ch]]);
    s.f(t, axo([x, y + 62, cw, ch - 66], pts, hm));
    t.fin();
    t.texte(x, y + 40, ("0" + (i + 1)).slice(-2), { size:11, gras:true, fill:E.accent });
    t.texte(x + 24, y + 40, s.n, { size:18, gras:true });
    coupe(s.d, Math.round(cw / 4)).slice(0, 3).forEach(function(l, k){ t.texte(x, y + 24 - k * 10, l, { size:8.5, fill:TXT }); });
    if(col < cols - 1 && i < n - 1) fleche(t, [x + cw + 8, y + ch / 2 + 30], [x + cw + g - 8, y + ch / 2 + 30], 1.2);
  });
}
