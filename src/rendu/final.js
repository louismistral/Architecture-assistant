/* ============================================================================
   LE RENDU FINAL — cinq planches A1 paysage, selon le règlement (art. 1.20,
   1.21) et son schéma d'affichage :

        1 Situation   2 Rez        3 Niveaux
                 [ maquette ]
        4 Façades et coupes        5 Explicative

     1  situation 1:500 sur la base du géomètre : les volumes, les distances
        aux limites, les cotes du rez, du terrain et des acrotères
     2  le plan du rez 1:200, avec ses abords
     3  les plans des autres niveaux 1:200
     4  les façades et les coupes 1:200, horizontales, terrain naturel, cotes
     5  la planche explicative : insertion, concept, structure, incendie et
        parasismique

   Plans, coupes et façades « exclusivement au trait noir sur fond blanc » :
   la palette `JOUR`. Les plans sont ceux des Typologies (`typoPlanches()`),
   tels quels ; la situation, les façades et les coupes se lisent sur les
   volumes du Massing (`etagesDe()`) et le terrain du relevé (`terrain()`).
   Rien n'est redessiné ailleurs que dans les fonctions déjà là.
   ========================================================================= */
import { trace } from "../core/pdf.js";
import { PER } from "../data/site.js";
import { FINAL, FORMATS, JOUR, TRAITS } from "../data/planches.js";
import { RULES } from "../data/rules.js";
import { coins, terrain } from "../mass/geom.js";
import { etagesDe, partiOf, pontEtage, MASS } from "../mass/model.js";
import { situation } from "./siteplan.js";
import { dessinPlan } from "./etages.js";
import { diagrammes } from "./diagramme.js";
import { dessinEclatee, dessinVolume } from "./axo.js";

var MM = 72 / 25.4, K = 1000 / FINAL.echelle * MM;   /* pt par mètre, au 1:200 */
var NOIR = [0, 0, 0], BLANC = [1, 1, 1], GRIS = [0.45, 0.45, 0.45], CLAIR = [0.85, 0.85, 0.85];
var TITRES = ["Situation", "Plan du rez-de-chaussée", "Plans des niveaux", "Façades et coupes", "Planche explicative"];

function f2(z){ return z.toFixed(2); }
function dec(x, d){ return x.toFixed(d == null ? 1 : d).replace(".", ","); }
function rect(x0, y0, x1, y1){ return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }

/* ---------- la feuille, son cartouche ----------
   La devise et « Concours CS Saxon » sur chaque planche (art. 1.22), le numéro
   au schéma d'affichage. `fond` : false sur la base du géomètre. */
function feuille(n, sous, fond){
  var F = FORMATS[FINAL.format], t = trace(F.w, F.h), m = FINAL.marge, c = FINAL.cartouche;
  if(fond !== false) t.poly(rect(0, 0, F.w, F.h), { fill:BLANC });
  var y = m + c - 30;
  t.texte(m, y, TITRES[n - 1].toUpperCase(), { size:24, gras:true });
  t.texte(m, y - 18, sous, { size:10, fill:GRIS });
  t.texte(F.w - m, y, "Concours CS Saxon · " + FINAL.devise, { size:16, gras:true, ancre:"end" });
  t.texte(F.w - m, y - 18, "Planche " + n + " / 5 · " + FINAL.format + " paysage · imprimer à 100 %", { size:8, fill:GRIS, ancre:"end" });
  /* le schéma d'affichage, la planche en noir */
  var sx = F.w - m - 330, sy = y - 20, cw = 18, ch = 12, g = 3;
  [[0, 1], [1, 1], [2, 1], [0.5, 0], [1.5, 0]].forEach(function(p, i){
    var x = sx + p[0] * (cw + g), yy = sy + p[1] * (ch + g);
    t.poly(rect(x, yy, x + cw, yy + ch), i === n - 1 ? { fill:NOIR } : { stroke:GRIS, lw:.5 });
  });
  t.zone = FINAL.situation.slice();
  return t;
}
function nord(t, x, y){
  t.cercle(x, y, 14, { stroke:NOIR, lw:.6 });
  t.poly([[x, y + 14], [x - 5, y - 8], [x, y - 3], [x + 5, y - 8]], { fill:NOIR });
  t.texte(x, y + 18, "N", { size:9, gras:true, ancre:"middle" });
}
/* une échelle graphique, en m, `k` pt par mètre */
function echelle(t, x, y, k, pas){
  var L = pas[pas.length - 1];
  pas.forEach(function(a, i){
    if(!i) return;
    var b = pas[i - 1];
    t.poly(rect(x + b * k, y, x + a * k, y + 4), i % 2 ? { fill:NOIR } : { fill:BLANC, stroke:NOIR, lw:.4 });
  });
  pas.forEach(function(a){ t.texte(x + a * k, y + 8, String(a), { size:6.5, ancre:"middle" }); });
  t.texte(x + L * k + 6, y, "m", { size:6.5 });
}

/* ---------- les corps : ce qu'on lit des volumes ---------- */
function corps(vols){
  var out = [];
  vols.forEach(function(v){
    var et = etagesDe(v, vols);
    if(!et.length) return;
    var rez = et.filter(function(x){ return x.n.lvl >= 0; })[0] || et[0];
    out.push({ v:v, et:et, rez:rez.z0, haut:Math.max.apply(null, et.map(function(x){ return x.z1; })) });
  });
  return out;
}
/* le corps principal : la plus grande emprise au rez — les coupes le traversent */
function principal(C){
  var best = null, a = -1;
  C.forEach(function(c){
    if(c.v.ph) return;
    c.et.forEach(function(x){ if(x.rc.w * x.rc.d > a){ a = x.rc.w * x.rc.d; best = x.rc; } });
  });
  return best;
}

/* ---------- 1 · la situation ----------
   Sur la base, la volumétrie dans son style (`situation()`), puis ce que
   demande l'art. 1.20 : la distance de chaque corps à la limite, sa cote de
   rez, le terrain et l'acrotère. */
export function finalSituation(vols){
  var t = feuille(1, "1:500 · sur la base du géomètre · distances aux limites, cotes du rez, du terrain naturel et des acrotères (msm)", false);
  var cal = FINAL.calage, z = t.zone;
  function P(p){ return [cal.ox + cal.k * p[0], cal.oy + cal.k * p[1]]; }
  t.decoupe(rect(z[0], z[1], z[2], z[3]));
  situation(t, vols, cal);
  var C = corps(vols);
  C.forEach(function(c){ if(!c.v.ph) limite(t, c, P); });
  C.forEach(function(c){
    /* le second temps porte déjà son nom au centre : ses cotes dessous */
    var q = P([c.v.x, c.v.y - (c.v.ph ? 5 : 0)]), tn = terrain(c.v.x, c.v.y);
    t.texte(q[0], q[1] + 4, "rez " + f2(c.rez) + " · TN " + f2(tn), { size:5.5, ancre:"middle" });
    t.texte(q[0], q[1] - 4, "acrotère " + f2(c.haut), { size:5.5, ancre:"middle", gras:true });
  });
  t.fin();
  t.ligne([[z[0], z[1]], [z[2], z[1]], [z[2], z[3]], [z[0], z[3]], [z[0], z[1]]], { stroke:NOIR, lw:.5 });
  nord(t, z[2] - 40, z[3] - 50);
  echelle(t, z[2] - 260, z[1] + 20, cal.k, [0, 10, 20, 30, 40, 50]);
  return t;
}
/* la plus courte distance d'un corps à la limite : du sommet le plus proche à
   son pied sur le périmètre, cotée en m */
function limite(t, c, P){
  var best = null;
  c.et.forEach(function(x){ x.contour.loops.forEach(function(L){ L.forEach(function(p){
    for(var i = 0; i < PER.length; i++){
      var a = PER[i], b = PER[(i + 1) % PER.length], dx = b[0] - a[0], dy = b[1] - a[1];
      var u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
      var f = [a[0] + u * dx, a[1] + u * dy], d = Math.hypot(p[0] - f[0], p[1] - f[1]);
      if(!best || d < best.d) best = { d:d, p:p, f:f };
    }
  }); }); });
  if(!best || best.d < .5) return;
  var A = P(best.p), B = P(best.f), ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
  t.ligne([A, B], { stroke:NOIR, lw:.4 });
  [A, B].forEach(function(q){ t.cercle(q[0], q[1], 1, { fill:NOIR }); });
  var rot = Math.cos(ang) < 0 ? ang + Math.PI : ang;
  t.texte((A[0] + B[0]) / 2 - 3 * Math.sin(rot), (A[1] + B[1]) / 2 + 3 * Math.cos(rot), dec(best.d) + " m", { size:6, ancre:"middle", rot:rot, gras:true });
}

/* ---------- les coupes : où elles passent ----------
   A-A dans la longueur du corps principal, B-B en travers, par son centre ;
   chacune regarde dans le sens de `d`. Les façades : le long côté le plus au
   sud, et le petit côté le plus à l'est. */
function orient(n){
  var a = Math.atan2(n[0], n[1]) * 180 / Math.PI;   /* azimut de la normale, 0 = nord */
  return ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"][Math.round(((a % 360) + 360) % 360 / 45) % 8];
}
export function vues(vols){
  var C = corps(vols), rc = principal(C);
  if(!rc) return null;
  var th = rc.w >= rc.d ? rc.a : rc.a + Math.PI / 2;
  var u = [Math.cos(th), Math.sin(th)], v = [-u[1], u[0]], o = [rc.x, rc.y];
  /* une vue : on regarde dans le sens `d` ; la droite de l'écran est d × z */
  function vue(id, nom, d, coupe){ return { id:id, n:nom, d:d, a:[d[1], -d[0]], o:o, coupe:coupe }; }
  /* la façade longue : celle dont la normale (−d) regarde le plus au sud */
  var dL = v[1] > 0 ? v : [-v[0], -v[1]], dC = u[0] < 0 ? u : [-u[0], -u[1]];
  return { C:C, liste:[
    vue("fl", "Façade " + orient([-dL[0], -dL[1]]), dL, false),
    vue("A", "Coupe A-A", dL, true),
    vue("fc", "Façade " + orient([-dC[0], -dC[1]]), dC, false),
    vue("B", "Coupe B-B", dC, true)
  ] };
}

/* le trait de chaque coupe sur un plan : `P` place un point du site */
function traitsCoupe(t, V, P, ext){
  V.liste.forEach(function(w){
    if(!w.coupe) return;
    /* la ligne de coupe court le long de `a`, sur l'étendue du bâti */
    var lo = Infinity, hi = -Infinity;
    ext.forEach(function(p){ var s = (p[0] - w.o[0]) * w.a[0] + (p[1] - w.o[1]) * w.a[1]; lo = Math.min(lo, s); hi = Math.max(hi, s); });
    lo -= 4; hi += 4;
    var A = [w.o[0] + w.a[0] * lo, w.o[1] + w.a[1] * lo], B = [w.o[0] + w.a[0] * hi, w.o[1] + w.a[1] * hi];
    var pa = P(A), pb = P(B), lw = TRAITS.coupe * MM;
    t.ligne([pa, pb], { stroke:NOIR, lw:lw * .6, dash:TRAITS.mixte.map(function(x){ return x * MM * 2; }) });
    [pa, pb].forEach(function(q){
      /* la flèche : le sens du regard */
      var e = [w.d[0] * 14, w.d[1] * 14];
      t.ligne([q, [q[0] + e[0], q[1] + e[1]]], { stroke:NOIR, lw:lw });
      t.poly([[q[0] + e[0] * 1.4, q[1] + e[1] * 1.4], [q[0] + e[0] - e[1] * .25, q[1] + e[1] + e[0] * .25],
              [q[0] + e[0] + e[1] * .25, q[1] + e[1] - e[0] * .25]], { fill:NOIR });
      t.cercle(q[0], q[1], 8, { fill:BLANC, stroke:NOIR, lw:lw });
      t.texte(q[0], q[1] - 3.5, w.id, { size:10, gras:true, ancre:"middle" });
    });
  });
}
function etendue(C){
  var e = [];
  C.forEach(function(c){ c.et.forEach(function(x){ x.rcs.forEach(function(r){ e = e.concat(coins(r)); }); }); });
  return e;
}

/* ---------- 2 et 3 · les plans ---------- */
function bornes(n){
  var b = [Infinity, Infinity, -Infinity, -Infinity];
  n.prims.forEach(function(p){ if(p.cl === "mur" && !p.ctx) p.pts.forEach(function(q){
    b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]); }); });
  return isFinite(b[0]) ? b : null;
}
function titrePlan(t, x, y, n){
  t.texte(x, y, n.name, { size:14, gras:true });
  t.texte(x, y - 13, "1:" + FINAL.echelle + " · hauteur d'étage " + dec(n.h, 2) + " m", { size:8, fill:GRIS });
}
export function finalRez(N, cad, vols){
  var t = feuille(2, "1:" + FINAL.echelle + " · au trait noir · noms des locaux et surfaces nettes · aménagements extérieurs · traits de coupe");
  var rez = N.filter(function(n){ return n.lvl === 0; })[0], z = t.zone, V = vues(vols);
  if(!rez){ t.texte(z[0], z[3] - 20, "Aucun plan du rez : à composer aux Typologies.", { size:12 }); return t; }
  var b = bornes(rez), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  dessinPlan(t, rez, cad, z, cx, cy, JOUR);
  var ox = (z[0] + z[2]) / 2 - K * cx, oy = (z[1] + z[3]) / 2 - K * cy;
  t.decoupe(rect(z[0], z[1], z[2], z[3]));
  if(V) traitsCoupe(t, V, function(q){ return [ox + K * q[0], oy + K * q[1]]; }, etendue(V.C));
  t.fin();
  titrePlan(t, z[0] + 10, z[3] - 24, rez);
  return t;
}
/* ---------- 4 · façades et coupes ----------
   Une vue regarde dans le sens `d` ; `a` va vers la droite de l'écran. Chaque
   étage de chaque corps est une boîte : sur l'écran, son étendue le long de
   `a` et sa hauteur ; sa profondeur le long de `d` ordonne le dessin, du plus
   loin au plus près — le plus près couvre. Une coupe tranche à la profondeur
   zéro : ce qu'elle coupe en poché (dalles, murs pignons), ce qui est derrière
   en trait fin, ce qui est devant n'est pas dessiné. Le terrain naturel, lu
   sur le relevé, en trait fort ; les cotes d'altitude à gauche. */
function boites(C, w){
  var B = [];
  function boite(rc, z0, z1, ph, haut){
    var q = coins(rc), us = [], ds = [];
    q.forEach(function(p){
      var x = p[0] - w.o[0], y = p[1] - w.o[1];
      us.push(x * w.a[0] + y * w.a[1]); ds.push(x * w.d[0] + y * w.d[1]);
    });
    /* la coupe : où la ligne de profondeur zéro traverse le rectangle */
    var cu = [];
    for(var i = 0; i < 4; i++){
      var j = (i + 1) % 4;
      if((ds[i] <= 0) !== (ds[j] <= 0)) cu.push(us[i] + (us[j] - us[i]) * ds[i] / (ds[i] - ds[j]));
    }
    B.push({ u0:Math.min.apply(null, us), u1:Math.max.apply(null, us), d0:Math.min.apply(null, ds), d1:Math.max.apply(null, ds),
      z0:z0, z1:z1, ph:ph, haut:haut, cu:cu.length === 2 ? [Math.min(cu[0], cu[1]), Math.max(cu[0], cu[1])] : null });
  }
  C.forEach(function(c){
    c.et.forEach(function(x){ x.rcs.forEach(function(r){ boite(r, x.z0, x.z1, c.v.ph, x.z1 >= c.haut - 1e-6); }); });
  });
  (MASS.pont || []).forEach(function(p){ var s = pontEtage(p); if(s) boite(s.rc, s.z0, s.z1, false, true); });
  return B;
}
function mesureVue(C, w){
  var B = boites(C, w), T = FINAL.terrain;
  var U0 = Math.min.apply(null, B.map(function(b){ return b.u0; })) - T, U1 = Math.max.apply(null, B.map(function(b){ return b.u1; })) + T;
  /* le terrain : au droit de la façade la plus proche, ou dans le plan de coupe */
  var dT = w.coupe ? 0 : Math.min.apply(null, B.map(function(b){ return b.d0; })) - 1, prof = [];
  for(var s = U0; s <= U1 + 1e-6; s += 1){
    var p = [w.o[0] + w.a[0] * s + w.d[0] * dT, w.o[1] + w.a[1] * s + w.d[1] * dT];
    prof.push([s, terrain(p[0], p[1])]);
  }
  var zb = Math.min(Math.min.apply(null, B.map(function(b){ return b.z0; })), Math.min.apply(null, prof.map(function(p){ return p[1]; }))) - 3;
  var zt = Math.max.apply(null, B.map(function(b){ return b.z1; })) + 2;
  return { B:B, U0:U0, U1:U1, zb:zb, zt:zt, prof:prof, w:(U1 - U0) * K + 70, h:(zt - zb) * K + 34 };
}
function dessinVue(t, x0, y0, w, m){
  /* `x0`, `y0` : le coin bas gauche ; 60 pt à gauche pour les cotes */
  var X0 = x0 + 60;
  function P(u, z){ return [X0 + (u - m.U0) * K, y0 + (z - m.zb) * K]; }
  var lwC = TRAITS.coupe * MM, lwV = TRAITS.vu * MM, D = FINAL.dalle, Mu = FINAL.mur;
  t.decoupe(rect(x0, y0, x0 + m.w, y0 + m.h));
    var sol = m.prof.map(function(p){ return P(p[0], p[1]); });
  var B = m.B.slice().sort(function(a, b){ return b.d0 - a.d0; });
  B.forEach(function(b){
    if(w.coupe && b.d1 <= 0) return;                      /* devant la coupe */
    if(w.coupe && b.cu) return;                            /* coupée : plus bas */
    var q = [P(b.u0, b.z0), P(b.u1, b.z0), P(b.u1, b.z1), P(b.u0, b.z1)];
    if(b.ph) t.poly(q, { stroke:NOIR, lw:lwV, dash:[4, 2] });
    else t.poly(q, { fill:BLANC, stroke:NOIR, lw:w.coupe ? lwV : TRAITS.menuiserie * MM });
  });
  /* en coupe, la terre tranchée cache ce qui est enterré derrière */
  if(w.coupe) t.poly(sol.concat([P(m.U1, m.zb), P(m.U0, m.zb)]), { fill:CLAIR });
  if(w.coupe) B.forEach(function(b){
    if(!b.cu || b.ph) return;
    var u0 = b.cu[0], u1 = b.cu[1];
    t.poly([P(u0, b.z0), P(u1, b.z0), P(u1, b.z1), P(u0, b.z1)], { fill:BLANC, stroke:NOIR, lw:lwC });
    t.poly([P(u0, b.z0), P(u1, b.z0), P(u1, b.z0 + D), P(u0, b.z0 + D)], { fill:NOIR });
    if(b.haut) t.poly([P(u0, b.z1 - D), P(u1, b.z1 - D), P(u1, b.z1), P(u0, b.z1)], { fill:NOIR });
    t.poly([P(u0, b.z0), P(u0 + Mu, b.z0), P(u0 + Mu, b.z1), P(u0, b.z1)], { fill:NOIR });
    t.poly([P(u1 - Mu, b.z0), P(u1, b.z0), P(u1, b.z1), P(u1 - Mu, b.z1)], { fill:NOIR });
  });
  /* en façade, ce qui est sous le terrain ne se voit pas */
  if(!w.coupe) t.poly(sol.concat([P(m.U1, m.zb), P(m.U0, m.zb)]), { fill:BLANC });
  t.ligne(sol, { stroke:NOIR, lw:lwC * (w.coupe ? 1.4 : 1) });
  t.texte(sol[0][0] + 2, sol[0][1] + 3, "TN", { size:6.5, fill:GRIS });
  t.fin();
  /* les cotes d'altitude, à gauche : chaque plancher et chaque acrotère */
  var zs = [];
  m.B.forEach(function(b){
    if(b.ph || (w.coupe ? !(b.cu || b.d0 > 0) : b.z1 <= Math.max.apply(null, m.prof.map(function(p){ return p[1]; })))) return;
    zs.push(b.z0); if(b.haut) zs.push(b.z1);
  });
  zs.sort(function(a, b){ return a - b; });
  var dernier = -Infinity;
  zs.forEach(function(z){
    var q = P(m.U0, z);
    if(q[1] - dernier < 9) return;
    dernier = q[1];
    t.ligne([[x0 + 8, q[1]], [X0 + 4, q[1]]], { stroke:NOIR, lw:TRAITS.cote * MM });
    t.poly([[x0 + 50, q[1]], [x0 + 46, q[1] + 5], [x0 + 54, q[1] + 5]], { fill:NOIR });
    t.texte(x0 + 8, q[1] + 2, f2(z), { size:6.5 });
  });
  t.texte(x0, y0 + m.h - 12, w.n, { size:14, gras:true });
  t.texte(x0, y0 + m.h - 25, "1:" + FINAL.echelle + " · altitudes en msm · terrain naturel du relevé", { size:8, fill:GRIS });
}
/* ---------- 3 et 4 · les autres niveaux, les façades et les coupes ----------
   Tout au 1:200, donc à sa taille : les plans des autres niveaux vont à la
   planche 3 (les plus larges d'abord, c'est ce qui en loge le plus), les
   façades et les coupes à la 4, chaque façade suivie de sa coupe. Ce qui ne
   tient pas sur sa planche prend la place libre de l'autre ; ce qui ne tient
   nulle part le dit, en rouge. Les deux planches se rangent donc ensemble. */
function etagere(z){ return { z:z, x:z[0], y:z[3], haut:0, g:24 }; }
function ranger(E, w, h){
  if(w > E.z[2] - E.z[0]) return null;
  var x = E.x, y = E.y, haut = E.haut;
  if(x > E.z[0] && x + w > E.z[2]){ x = E.z[0]; y -= haut + E.g; haut = 0; }
  if(y - h < E.z[1]) return null;
  E.x = x + w + E.g; E.y = y; E.haut = Math.max(haut, h);
  return [x, y - h];
}
export function finalNiveauxFacades(N, cad, vols){
  var z = FINAL.situation, a = FINAL.autour, V = vues(vols), E3 = etagere(z), E4 = etagere(z);
  var plans = N.filter(function(n){ return n.lvl !== 0 && bornes(n); }).map(function(n){
    var b = bornes(n);
    return { plan:n, b:b, w:(b[2] - b[0] + 2 * a) * K, h:(b[3] - b[1] + 2 * a) * K + 34 };
  }).sort(function(p, q){ return q.w - p.w; });
  var vs = V ? V.liste.map(function(w){ var m = mesureVue(V.C, w); return { vue:w, m:m, w:m.w, h:m.h }; }) : [];
  var reste = [];
  plans.forEach(function(o){ o.ou = ranger(E3, o.w, o.h); o.f = 3; if(!o.ou) reste.push(o); });
  vs.forEach(function(o){ o.ou = ranger(E4, o.w, o.h); o.f = 4; if(!o.ou){ o.ou = ranger(E3, o.w, o.h); o.f = 3; } if(!o.ou) reste.push(o); });
  var rate = [];
  reste.forEach(function(o){
    if(o.plan){ o.ou = ranger(E4, o.w, o.h); o.f = 4; }
    if(!o.ou) rate.push(o.plan ? o.plan.name : o.vue.n);
  });
  var t3 = feuille(3, "1:" + FINAL.echelle + " · au trait noir · noms des locaux et surfaces nettes · traits de coupe"
    + (vs.some(function(o){ return o.ou && o.f === 3; }) ? " · suite des façades et coupes" : ""));
  var t4 = feuille(4, "1:" + FINAL.echelle + " · au trait noir · horizontales · terrain naturel et cotes d'altitude des niveaux"
    + (plans.some(function(o){ return o.ou && o.f === 4; }) ? " · suite des plans" : ""));
  plans.concat(vs).forEach(function(o){
    if(!o.ou) return;
    var t = o.f === 3 ? t3 : t4, x = o.ou[0], y = o.ou[1];
    if(o.vue){ dessinVue(t, x, y, o.vue, o.m); return; }
    var n = o.plan, b = o.b, box = [x, y, x + o.w, y + o.h - 34], cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    dessinPlan(t, n, cad, box, cx, cy, JOUR);
    var ox = (box[0] + box[2]) / 2 - K * cx, oy = (box[1] + box[3]) / 2 - K * cy;
    t.decoupe(rect(box[0], box[1], box[2], box[3]));
    if(V) traitsCoupe(t, V, function(q){ return [ox + K * q[0], oy + K * q[1]]; }, etendue(V.C));
    t.fin();
    titrePlan(t, x, y + o.h - 14, n);
  });
  if(rate.length) [t3, t4].forEach(function(t){
    t.texte(z[2], z[1] + 8, "Ne tient pas sur les planches 3 et 4, au 1:" + FINAL.echelle + " : " + rate.join(", "), { size:9, ancre:"end", fill:[0.8, 0, 0] });
  });
  if(!V) t4.texte(z[0], z[3] - 20, "Aucune volumétrie : à poser au Massing.", { size:12 });
  return { t3:t3, t4:t4 };
}

/* ---------- 5 · la planche explicative ---------- */
function bloc(t, c, lettre, titre){
  t.texte(c[0], c[1] + c[3] - 16, lettre, { size:14, gras:true, fill:GRIS });
  t.texte(c[0] + 18, c[1] + c[3] - 16, titre, { size:14, gras:true });
  return [c[0], c[1], c[2], c[3] - 34];
}
function texte(t, x, y, lignes, sz){
  lignes.forEach(function(l, i){ t.texte(x, y - i * (sz || 9) * 1.45, l, { size:sz || 9 }); });
}
/* les cages d'escalier d'un niveau, et leur rayon d'évacuation */
function centre(q){ var x = 0, y = 0; q.forEach(function(p){ x += p[0] / q.length; y += p[1] / q.length; }); return [x, y]; }
function evacuation(n){
  return { cages:n.prims.filter(function(p){ return !p.ctx && /\bcagef\b/.test(p.cl || "") && p.pts; }).map(function(p){ return centre(p.pts); }) };
}
export function finalExplicative(N, vols){
  var t = feuille(5, "Insertion, concept architectural, structure et matérialisation, incendie et parasismique");
  var z = t.zone, g = 40, w = (z[2] - z[0] - g) / 2, h = (z[3] - z[1] - g) / 2;
  var C = corps(vols), P = partiOf(MASS.parti === "auto" && MASS.vol.parti ? MASS.vol.parti : MASS.parti);
  var hmax = Math.max.apply(null, C.map(function(c){ return c.haut - c.rez; }));

  var a = bloc(t, [z[0], z[1] + h + g, w, h], "a", "Insertion dans le site");
  t.decoupe(rect(a[0], a[1], a[0] + a[2], a[1] + a[3]));
  diagrammes(t, vols, a, 2);
  t.fin();

  var b = bloc(t, [z[0] + w + g, z[1] + h + g, w, h], "b", "Concept architectural");
  t.decoupe(rect(b[0], b[1], b[0] + b[2], b[1] + b[3]));
  dessinVolume(t, [b[0], b[1] + 60, b[2], b[3] - 60], N);
  t.fin();
  var nb = C.filter(function(c){ return !c.v.ph; }).length;
  texte(t, b[0], b[1] + 44, [
    "Parti : " + (P ? P.n : "—") + " · " + nb + " corps" + (C.length > nb ? " et un second temps" : ""),
    "Hauteur hors sol jusqu'à " + dec(hmax) + " m · " + N.filter(function(n){ return n.lvl >= 0; }).length + " niveaux hors sol"
      + (N.some(function(n){ return n.lvl < 0; }) ? ", un sous-sol" : "")
  ], 10);

  var c = bloc(t, [z[0], z[1], w, h], "c", "Structure et matérialisation");
  t.decoupe(rect(c[0], c[1], c[0] + c[2] * .6, c[1] + c[3]));
  dessinEclatee(t, [c[0], c[1], c[2] * .6, c[3]], N);
  t.fin();
  var nc = 0;
  N.forEach(function(n){ nc = Math.max(nc, evacuation(n).cages.length); });
  texte(t, c[0] + c[2] * .62, c[1] + c[3] - 20, [
    "Contreventement : " + nc + " noyau" + (nc > 1 ? "x" : "") + " de cage d'escalier,",
    "empilé" + (nc > 1 ? "s" : "") + " d'un niveau à l'autre.",
    "Zone sismique " + RULES.seisme.zone + " (agd " + dec(RULES.seisme.agd) + " m/s²),",
    "sol " + RULES.seisme.sol + ",",
    "classe d'ouvrage " + RULES.seisme.ouvrage + ".",
    "",
    "Système porteur et matériaux : à préciser",
    "(onglets Tectonics et Materiality)."
  ], 10);

  var d = bloc(t, [z[0] + w + g, z[1], w, h], "d", "Incendie — évacuation et cages (AEAI 16-15)");
  var L = N.slice().sort(function(p, q){ return p.lvl - q.lvl; }), cw = d[2] / L.length, R = RULES.feu.fuiteSimple;
  L.forEach(function(n, i){
    var b2 = bornes(n);
    if(!b2) return;
    var ev = evacuation(n), cx = (b2[0] + b2[2]) / 2, cy = (b2[1] + b2[3]) / 2;
    var ext = Math.max(b2[2] - b2[0] + 2 * R, b2[3] - b2[1] + 2 * R), k = Math.min((cw - 16) / ext, (d[3] - 70) / ext);
    var ox = d[0] + i * cw + cw / 2 - k * cx, oy = d[1] + 70 + (d[3] - 70) / 2 - k * cy;
    function Q(p){ return [ox + k * p[0], oy + k * p[1]]; }
    t.decoupe(rect(d[0] + i * cw, d[1] + 60, d[0] + (i + 1) * cw - 8, d[1] + d[3]));
    n.prims.forEach(function(p){ if(p.cl === "mur" && !p.ctx) t.poly(p.pts.map(Q), { stroke:NOIR, lw:.6 }); });
    ev.cages.forEach(function(q){
      var s = Q(q);
      t.cercle(s[0], s[1], R * k, { stroke:GRIS, lw:.5, dash:[3, 2] });
      t.cercle(s[0], s[1], 3, { fill:NOIR });
    });
    t.fin();
    texte(t, d[0] + i * cw, d[1] + 46, [n.name, ev.cages.length + " cage" + (ev.cages.length > 1 ? "s" : "") + " d'escalier"], 8);
  });
  texte(t, d[0], d[1] + 6, ["Cercles : " + R + " m d'une cage — la voie d'évacuation vers un escalier (" + RULES.feu.fuiteDouble
    + " m vers deux). Deux cages au-delà de " + RULES.feu.cageSeuil + " m² d'étage."], 8);
  return t;
}
