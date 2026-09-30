/* ============================================================================
   PLANCHE MASSING · DIAGRAMMES — A2, vectoriel, à la manière de BIG

   Comment le volume est né : UN volume, transformé sur place, geste après
   geste, jusqu'au bâtiment — reculer, envelopper, évider, ancrer, empiler,
   orienter, creuser, habiter. Chaque case part de la précédente : même
   vue, même échelle, même endroit. Les volumes sont blancs, ce que le geste
   change en orange, les flèches disent le geste. Une case n'existe que si la
   décision a été prise pour la composition à l'écran (pas de sous-sol : pas
   de « creuser »). La mise en page suit la planche de référence : une grille
   de trois colonnes, le contexte en gris, le numéro en tête de légende.

   Tout est lu dans l'état (`genMass`, le mixer, le jugement). La même planche
   s'affiche dans le rail du massing (`svg()`) et s'imprime (`pdf()`).
   ========================================================================= */
import { fmt } from "../core/format.js";
import { cssRGB } from "../core/gl.js";
import { trace } from "../core/pdf.js";
import { PER, SITE } from "../data/site.js";
import { RULES } from "../data/rules.js";
import { V, reculVise } from "../data/cadre.js";
import "../data/leviers.js";
import "../data/recherche.js";
import { ENCRE, FORMATS } from "../data/planches.js";
import { FLOORS, flHeight, flNet, lvlOf } from "../mix/floors.js";
import { airePoly, airePosable, bbox, coins, enveloppe, ligneRecul } from "../mass/geom.js";
import { MASS, etagesDe, familleDom, famTok, partiOf } from "../mass/model.js";
import { evaluationCourante } from "../mass/mesures.js";

var E = ENCRE;
var BLANC = [E.blanc, E.cote, E.cote2], ACC = [E.accent, [0.82, 0.29, 0.08], [0.7, 0.24, 0.06]];
function couleur(f){
  /* la couleur de la famille, résolue par le navigateur ; gris hors navigateur */
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

/* ---------- la vue : la même pour toutes les cases ---------- */
function axo(cadre, hmax){
  var r = -0.62, el = 0.5, c = Math.cos(r), s = Math.sin(r);
  function brut(x, y, z){ return [x * c - y * s, (x * s + y * c) * el + z * 0.9]; }
  var B = bbox(PER.map(function(p){ return brut(p[0], p[1], 0); }).concat(
    PER.map(function(p){ return brut(p[0], p[1], hmax); })));
  var k = Math.min(cadre[2] / B.w, cadre[3] / B.h) * 0.9;
  var ox = cadre[0] + (cadre[2] - B.w * k) / 2 - B.x0 * k, oy = cadre[1] + (cadre[3] - B.h * k) / 2 - B.y0 * k;
  var A = function(x, y, z){ var b = brut(x, y, z || 0); return [ox + b[0] * k, oy + b[1] * k]; };
  A.prof = function(x, y){ return x * s + y * c; };
  A.g = [s, c];
  return A;
}
/* un prisme : ses faces visibles, de la plus lointaine à la plus proche, puis
   son toit ; `c` = [toit, flanc clair, flanc sombre] ; `o.dash` : au trait seul */
function prisme(t, A, poly, z0, z1, c, o){
  o = o || {};
  var p = ccw(poly), F = [];
  for(var i = 0; i < p.length; i++){
    var a = p[i], b = p[(i + 1) % p.length], n = [b[1] - a[1], -(b[0] - a[0])];
    if(n[0] * A.g[0] + n[1] * A.g[1] >= 0) continue;
    F.push({ a:a, b:b, d:A.prof((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), l:Math.abs(n[0]) > Math.abs(n[1]) });
  }
  function st(fill){ return o.dash ? { stroke:E.noir, lw:.5, dash:o.dash } : { fill:fill, stroke:E.noir, lw:o.lw || .45 }; }
  F.sort(function(u, v){ return v.d - u.d; }).forEach(function(f){
    t.poly([A(f.a[0], f.a[1], z0), A(f.b[0], f.b[1], z0), A(f.b[0], f.b[1], z1), A(f.a[0], f.a[1], z1)], st(c && (f.l ? c[1] : c[2])));
  });
  t.poly(p.map(function(q){ return A(q[0], q[1], z1); }), st(c && c[0]));
}
function fleche(t, a, b, lw){
  lw = lw || 1.4;
  var dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, h = 2.5 + lw * 1.8;
  t.ligne([a, [b[0] - ux * h, b[1] - uy * h]], { stroke:E.noir, lw:lw });
  t.poly([b, [b[0] - ux * h * 2 + uy * h, b[1] - uy * h * 2 - ux * h], [b[0] - ux * h * 2 - uy * h, b[1] - uy * h * 2 + ux * h]], { fill:E.noir });
}
/* une flèche courbe : le geste de tourner */
function arc(t, A, cx, cy, z, r, a0, a1){
  var P = [];
  for(var i = 0; i <= 16; i++){ var a = a0 + (a1 - a0) * i / 16; P.push(A(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z)); }
  t.ligne(P.slice(0, -1), { stroke:E.noir, lw:1.4 });
  fleche(t, P[P.length - 3], P[P.length - 1], 1.4);
}
function soleil(t, p, r){
  for(var i = 0; i < 12; i++){
    var a = i / 12 * 2 * Math.PI;
    t.ligne([[p[0] + Math.cos(a) * r * 1.5, p[1] + Math.sin(a) * r * 1.5], [p[0] + Math.cos(a) * r * 2.2, p[1] + Math.sin(a) * r * 2.2]], { stroke:E.soleil, lw:1 });
  }
  t.cercle(p[0], p[1], r, { fill:E.soleil });
}

/* ---------- le sol et les corps ---------- */
function sol(t, A){ t.poly(PER.map(function(p){ return A(p[0], p[1], 0); }), { fill:E.sol, stroke:[0.45, 0.45, 0.45], lw:.5 }); }
/* peint des corps { x, y, q, z0, z1, c, o } du plus loin au plus proche */
function peindre(t, A, C){
  C.sort(function(a, b){
    var da = A.prof(a.x, a.y), db = A.prof(b.x, b.y);
    return Math.abs(da - db) > 3 ? db - da : a.z0 - b.z0;
  }).forEach(function(k){ prisme(t, A, k.q, k.z0, k.z1, k.c, k.o); });
}
/* les étages hors sol d'une composition ; `col(v, e)` dit la couleur ;
   `o.plat` : chaque corps en une boîte, jusqu'à `o.h` ou son sommet */
function corps(vols, z00, col, o){
  var C = [];
  vols.forEach(function(v){
    if(v.ph && !(o && o.second)) return;
    var et = etagesDe(v).filter(function(e){ return lvlOf(e.e.i) >= 0; });
    if(!et.length) return;
    if(o && o.plat){
      var e0 = et[0];
      C.push({ x:e0.rc.x, y:e0.rc.y, q:coins(e0.rc), z0:0, z1:o.h || et[et.length - 1].z1 - z00, c:col(v, e0) });
      return;
    }
    et.forEach(function(e){
      C.push({ x:e.rc.x, y:e.rc.y, q:coins(e.rc), z0:Math.max(0, e.z0 - z00), z1:e.z1 - z00, c:col(v, e),
               o:v.ph ? { dash:[2.5, 1.8] } : null });
    });
  });
  return C;
}

/* ---------- le contexte : les bâtiments voisins, en gris ---------- */
var CTX = null;
function contexte(){
  if(CTX) return CTX;
  var B = bbox(PER);
  CTX = [];
  SITE.bat.forEach(function(b, i){
    var c = bbox(b);
    if(c.cx < B.x0 - 40 || c.cx > B.x1 + 40 || c.cy < B.y0 - 40 || c.cy > B.y1 + 40) return;
    var h = SITE.bath[i] ? Math.max(3, SITE.bath[i][1] - SITE.bath[i][0]) : 6;
    CTX.push({ x:c.cx, y:c.cy, q:b, z0:0, z1:h, c:[E.cote, E.cote2, [0.68, 0.68, 0.68]], o:{ lw:.2 } });
  });
  return CTX;
}
/* la scène d'une case : le sol, puis le contexte et les corps, du plus loin
   au plus proche, dans une seule liste */
function scene(t, A, C){ sol(t, A); peindre(t, A, contexte().concat(C || [])); }

/* ---------- les gestes ---------- */
function etapes(vols){
  var ev = evaluationCourante(), j = ev && ev.jugement;
  function q(id){ return ev ? ev.qualites[id] : null; }
  var hs = [], net = 0, H = 0;
  FLOORS.forEach(function(f, i){ if(lvlOf(i) >= 0){ hs.push(i); net += flNet(i); H += flHeight(i); } });
  var z00 = Infinity, hmax = H;
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) >= 0) z00 = Math.min(z00, e.z0); }); });
  if(!isFinite(z00)) z00 = 0;
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ hmax = Math.max(hmax, e.z1 - z00); }); });
  var RV = reculVise();
  var recul = (RV ? ligneRecul(RV) : [PER.slice(0, -1)]).slice().sort(function(a, b){ return airePoly(b) - airePoly(a); })[0] || PER;
  var ecole = vols.filter(function(v){ return !v.ph; }), sport = ecole.filter(function(v){ return v.fix; });
  var sous = [];
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) < 0) sous.push(e); }); });
  var pa = partiOf(vols.parti || MASS.parti), tirets = { dash:[2.5, 1.8] };
  /* l'enveloppe : l'emprise convexe des corps au sol, là où ils sont posés */
  var pts = [];
  ecole.forEach(function(v){
    var e = etagesDe(v).filter(function(x){ return lvlOf(x.e.i) >= 0; })[0];
    if(e) pts = pts.concat(coins(e.rc));
  });
  var env = pts.length > 2 ? enveloppe(pts) : recul, ce = bbox(env);
  var emprise = 0;
  ecole.forEach(function(v){ var e = etagesDe(v).filter(function(x){ return lvlOf(x.e.i) >= 0; })[0]; if(e) emprise += e.rc.w * e.rc.d; });
  function plein(col){ return corps(ecole, z00, col, { plat:true, h:H }); }

  var S = [];
  S.push({ n:"SITE", d:fmt(RULES.site.aire) + " m² entre la rue du Casino et le chemin du Petit Mont, au pied du Casino. "
      + "La zone A ne fixe ni gabarit ni hauteur.",
    f:function(t, A){ scene(t, A); } });
  if(RV) S.push({ n:"RECULER", d:nb(RV) + " m sur tout le périmètre : il reste " + fmt(Math.round(airePosable(RV))) + " m² où bâtir.",
    f:function(t, A){ scene(t, A, [{ x:ce.cx, y:ce.cy, q:recul, z0:0, z1:.6, c:ACC }]);
      [5, 12, 22].forEach(function(i){
        var p = PER[i], dx = ce.cx - p[0], dy = ce.cy - p[1], l = Math.hypot(dx, dy);
        fleche(t, A(p[0] - dx / l * 6, p[1] - dy / l * 6, 3), A(p[0] + dx / l * 8, p[1] + dy / l * 8, 3));
      }); } });
  S.push({ n:"ENVELOPPER", d:fmt(Math.round(net)) + " m² hors sol sur " + hs.length + " niveaux (" + nb(H) + " m) : "
      + "le programme tient dans cette enveloppe, sur l'aire posable.",
    f:function(t, A){ scene(t, A, [{ x:ce.cx, y:ce.cy, q:env, z0:0, z1:H, c:ACC }]);
      fleche(t, A(ce.cx, ce.cy, H + 20), A(ce.cx, ce.cy, H + 3)); } });
  S.push({ n:"ÉVIDER", d:pa.n + " : " + pa.d.split(/[.:]/)[0].toLowerCase() + ". Il reste " + ecole.length + " corps, "
      + fmt(Math.round(emprise)) + " m² d'emprise ; le vide devient la cour.",
    f:function(t, A){ scene(t, A, plein(function(){ return ACC; }));
      prisme(t, A, env, 0, H, null, tirets); } });
  if(sport.length) S.push({ n:"ANCRER", d:"La salle de sport double, 28 × 32 m et 7 m libres : au rez, d'un seul tenant, rien au-dessus.",
    f:function(t, A){ scene(t, A, plein(function(v){ return v.fix ? ACC : BLANC; }));
      var v = sport[0]; fleche(t, A(v.x, v.y, H + 22), A(v.x, v.y, H + 3)); } });
  S.push({ n:"EMPILER", d:"Chaque corps prend les niveaux qu'il porte, à la hauteur du mixer ("
      + hs.map(function(i){ return nb(flHeight(i)); }).join(" + ") + " m). Les classes au plus au 2e étage.",
    f:function(t, A){ var top = lvlOf(hs[hs.length - 1]);
      scene(t, A, corps(ecole, z00, function(v, e){ return lvlOf(e.e.i) === top ? ACC : BLANC; })); } });
  var so = q("soleil"), vu = q("vue");
  S.push({ n:"ORIENTER", d:([so && so.txt, vu && vu.txt].filter(Boolean).join(" ; ") || "Les longues façades vers le sud") + ".",
    f:function(t, A){ scene(t, A, corps(ecole, z00, blanc));
      var s0 = A(ce.cx, ce.cy - 95, hmax * 1.2); soleil(t, s0, 5);
      ecole.slice(0, 4).forEach(function(v){ t.ligne([s0, A(v.x, v.y, hmax * .5)], { stroke:E.soleil, lw:.9 }); }); } });
  if(sous.length) S.push({ n:"CREUSER", d:"Sous le corps le plus haut du terrain, là où la nappe laisse " + nb(RULES.dist.couverture)
      + " m de couverture : l'abri PC et la technique.",
    f:function(t, A){ scene(t, A, corps(ecole, z00, blanc));
      sous.forEach(function(e){ prisme(t, A, coins(e.rc), e.z0 - z00, Math.min(0, e.z1 - z00), ACC, { lw:.5 }); });
      var r = sous[0].rc; fleche(t, A(r.x, r.y, hmax + 10), A(r.x, r.y, 2)); } });
  S.push({ n:"HABITER", d:"Le programme en place, dans les couleurs de ses familles ; piscine et chauffage en pointillé."
      + (j && j.total != null ? " " + j.total + " / 100 au jugement." : ""),
    f:function(t, A){ scene(t, A, corps(vols, z00, function(v, e){ return couleur(familleDom(e.e.i)); }, { second:true })); } });
  S.hmax = hmax;
  return S;
  function blanc(){ return BLANC; }
}

/* ---------- la planche : la mise en page de la référence ----------
   Un titre court en capitales, puis une grille de trois colonnes (quatre
   au-delà de neuf cases) ; sous chaque dessin, le numéro en gras, le geste,
   une ligne pour dire pourquoi. */
export function planDiagrammes(vols){
  var F = FORMATS.A2, t = trace(F.w, F.h), m = 48, gx = 28, gy = 18;
  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:E.blanc });
  var S = etapes(vols), n = S.length, cols = n <= 9 ? 3 : 4, rows = Math.ceil(n / cols);
  t.texte(m, F.h - m - 14, "PROCESSUS DE CONCEPTION — MASSING", { size:18, gras:true });
  var top = F.h - m - 34, cw = (F.w - 2 * m - (cols - 1) * gx) / cols, ch = (top - m - (rows - 1) * gy) / rows;
  S.forEach(function(s, i){
    var col = i % cols, row = Math.floor(i / cols);
    var x = m + col * (cw + gx), y = top - (row + 1) * ch - row * gy;
    var cadre = [x, y + 44, cw, ch - 44];
    t.decoupe([[x, y + 40], [x + cw, y + 40], [x + cw, y + ch], [x, y + ch]]);
    s.f(t, axo(cadre, S.hmax), cadre);
    t.fin();
    t.texte(x, y + 16, ("0" + (i + 1)).slice(-2), { size:20, gras:true });
    t.texte(x + 36, y + 26, s.n, { size:10, gras:true, fill:E.accent });
    coupe(s.d, Math.round((cw - 36) / 3.7)).slice(0, 2).forEach(function(l, k){ t.texte(x + 36, y + 15 - k * 9, l, { size:7.5, fill:[0.3, 0.3, 0.3] }); });
  });
  t.texte(F.w - m, m - 22, "Concours CS Saxon · planche massing · A2", { size:7, fill:[0.45, 0.45, 0.45], ancre:"end" });
  return t;
}
