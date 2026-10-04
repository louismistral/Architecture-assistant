/* ============================================================================
   RENDU · TYPOLOGIES — deux axonométries

     axoVolume(niveaux)   le volume, chaque corps de chaque niveau en bloc
                          noir, ses familles nommées en blanc sur ses faces
     axoEclatee(niveaux)  le même, éclaté : chaque niveau porte son plan des
                          Typologies (`typoPlanches()`) et ses murs coupés,
                          sur sa dalle, écarté
                          du suivant (`AXO.pas`, `AXO.ecart`)

   La vue est celle des diagrammes du massing (`axo()`, `prisme()`), dans leur
   style : volumes blancs aux flancs gris.
   ========================================================================= */
import { trace } from "../core/pdf.js";
import { PER, SITE } from "../data/site.js";
import { AXO, ENCRE, FORMATS, NUIT } from "../data/planches.js";
import { trait } from "./etages.js";
import { VUE, axo, peindre, prisme } from "./diagramme.js";

var E = ENCRE, GRIS = [0.4, 0.4, 0.4], EXIST = [[0.9, 0.9, 0.89], [0.82, 0.82, 0.81], [0.74, 0.74, 0.73]];
var M = 50;

function feuille(titre, sous, portrait, noir){
  var F = FORMATS[AXO.format];
  if(portrait) F = { w:F.h, h:F.w };
  var t = trace(F.w, F.h), encre = noir ? NUIT.trait : E.noir, gris = noir ? NUIT.gris : GRIS;
  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:noir ? NUIT.fond : E.blanc });
  t.texte(M, F.h - M - 26, titre, { size:30, gras:true, fill:encre });
  t.texte(M, F.h - M - 46, sous, { size:10, fill:gris });
  t.texte(F.w - M, M - 24, "Centre scolaire de Saxon · 05 Typologies · " + AXO.format, { size:7, fill:gris, ancre:"end" });
  t.cadre = [M, M, F.w - 2 * M, F.h - 2 * M - 76];
  return t;
}
function existants(){
  return SITE.bat.map(function(b, i){
    var h = SITE.bath && SITE.bath[i] ? SITE.bath[i][1] - SITE.bath[i][0] : 0;
    return h > 1 && b.length > 2 ? { q:b, h:h } : null;
  }).filter(Boolean);
}

/* ---------- le volume, famille par famille ----------
   Chaque corps de chaque niveau est un bloc NOIR, à la hauteur de l'étage, et
   ce qu'il porte se NOMME en blanc, en lettres qui prennent toute la place — son chapitre, sous le nom de `AXO.noms` —, à plat sur les faces : sur le dessus, au droit de sa plus
   grande pièce ; sur les façades vues, le long des pièces qui les touchent.
   Une face cachée par un volume peint plus tard l'est avec son texte. */
var NOIR = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], BLANC_T = [1, 1, 1];
/* le nom d'une pièce sur l'axonométrie : son chapitre (`AXO.noms`) */
function famDe(p){
  var m = /\bfam-(\w+)/.exec(p.cl || ""), f = m ? m[1] : null, c = p.chap;
  if(!c) return null;
  return c === "infra" ? (f === "pis" ? "piscine" : "tech") : AXO.noms[c] ? c : null;
}
var NOM = AXO.noms;
function centre(q){ var x = 0, y = 0; q.forEach(function(r){ x += r[0] / q.length; y += r[1] / q.length; }); return [x, y]; }
function dedans(q, p){
  var s = 0;
  for(var i = 0; i < q.length; i++){
    var a = q[i], b = q[(i + 1) % q.length], c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if(c !== 0){ if(s && Math.sign(c) !== s) return false; s = Math.sign(c); }
  }
  return true;
}
/* un texte posé à plat sur une face : `o` un point, `U` et `V` ses axes (m)
   — (U, V, normale sortante) en sens direct, sans quoi il se lirait en miroir
   — `ht` la hauteur des lettres en m ; centré sur `o` */
function ecrire(t, A, s, o, U, V, ht){
  var p = A(o[0], o[1], o[2]), pu = A(o[0] + U[0], o[1] + U[1], o[2] + U[2]), pv = A(o[0] + V[0], o[1] + V[1], o[2] + V[2]);
  var u = [pu[0] - p[0], pu[1] - p[1]], v = [pv[0] - p[0], pv[1] - p[1]], n = Math.hypot(u[0], u[1]);
  if(n < 1e-6) return;
  var sz = ht * n, m = [u[0] / n, u[1] / n, v[0] / n, v[1] / n];
  t.texte(p[0] - .35 * sz * m[2], p[1] - .35 * sz * m[3], s, { size:sz, gras:true, fill:BLANC_T, ancre:"middle", m:m });
}
/* la hauteur des lettres qui remplit une place `long` × `haut` (Helvetica grasse) */
function taille(s, long, haut){ return Math.max(0, Math.min(haut, long / (0.6 * s.length))); }

export function axoVolume(niveaux){
  var t = feuille("AXONOMÉTRIE", "Le volume, nommé par programme · l'existant en volumes clairs");
  var N = niveaux.filter(function(n){ return n.lvl >= 0; }).sort(function(a, b){ return a.lvl - b.lvl; });
  var z = 0, C = [], pts = PER.slice(), H = 1;
  N.forEach(function(n){
    n.z = z; z += n.h; H = Math.max(H, z);
    var P = n.prims, pieces = P.filter(function(p){ return p.k === "p" && p.ferme && !p.ctx && famDe(p); });
    P.forEach(function(p, i){
      if(p.cl !== "mur") return;
      var dans = P.slice(i + 1).filter(function(q){ return q.cl === "circ"; })[0];
      if(!dans) return;
      var R = pieces.filter(function(r){ return dedans(dans.pts, centre(r.pts)); });
      pts = pts.concat(p.pts);
      var c = centre(p.pts);
      C.push({ x:c[0], y:c[1], q:p.pts, z0:n.z, z1:n.z + n.h, c:NOIR, o:{ stroke:BLANC_T, lw:.6 },
               apres:function(t){ habiller(t, A, p.pts, dans.pts, R, n.z, n.h); } });
    });
  });
  existants().forEach(function(x){ C.push({ x:x.q[0][0], y:x.q[0][1], q:x.q, z0:0, z1:x.h, c:AXO.existant, o:{ stroke:false } }); });
  var c = t.cadre;
  t.decoupe([[c[0], c[1]], [c[0] + c[2], c[1]], [c[0] + c[2], c[1] + c[3]], [c[0], c[1] + c[3]]]);
  var A = axo(c, pts, H * 1.1);
  t.poly(PER.map(function(p){ return A(p[0], p[1], 0); }), { stroke:GRIS, lw:.5, dash:[4, 3] });
  peindre(t, A, C);
  t.fin();
  return t;
}

/* les pièces et les noms d'un bloc : dessus, puis façades vues */
function habiller(t, A, ext, int, R, z0, h){
  var z1 = z0 + h;
  /* le dessus : chaque nom occupe l'emprise de ses pièces dans le corps —
     tout le dessus s'il est seul — en lettres aussi grandes qu'elle le permet */
  var o = ext[0], a0 = [ext[1][0] - o[0], ext[1][1] - o[1]], a1 = [ext[3][0] - o[0], ext[3][1] - o[1]];
  var la0 = Math.hypot(a0[0], a0[1]), la1 = Math.hypot(a1[0], a1[1]);
  var u0 = [a0[0] / la0, a0[1] / la0], u1 = [a1[0] / la1, a1[1] / la1];
  var B = {}, noms = {};
  R.forEach(function(r){ noms[famDe(r)] = 1; });
  var seul = Object.keys(noms).length === 1;
  R.forEach(function(r){
    var f = famDe(r), b = B[f] || (B[f] = seul ? [0, la0, 0, la1] : [Infinity, -Infinity, Infinity, -Infinity]);
    if(seul) return;
    r.pts.forEach(function(q){
      var x = (q[0] - o[0]) * u0[0] + (q[1] - o[1]) * u0[1], y = (q[0] - o[0]) * u1[0] + (q[1] - o[1]) * u1[1];
      b[0] = Math.min(b[0], x); b[1] = Math.max(b[1], x); b[2] = Math.min(b[2], y); b[3] = Math.max(b[3], y);
    });
  });
  Object.keys(B).forEach(function(f){
    var b = B[f], s = NOM[f], w0 = b[1] - b[0], w1 = b[3] - b[2];
    var cx = (b[0] + b[1]) / 2, cy = (b[2] + b[3]) / 2, c = [o[0] + u0[0] * cx + u1[0] * cy, o[1] + u0[1] * cx + u1[1] * cy];
    var U = w0 >= w1 ? [u0[0], u0[1], 0] : [u1[0], u1[1], 0], l = Math.max(w0, w1), w = Math.min(w0, w1);
    /* lu de gauche à droite à l'écran, et V = z × U : jamais en miroir */
    if(A(U[0], U[1], 0)[0] < A(0, 0, 0)[0]) U = [-U[0], -U[1], 0];
    var V = [-U[1], U[0], 0], ht = taille(s, l * .94, w * .8);
    if(ht < .5) return;
    ecrire(t, A, s, [c[0], c[1], z1], U, V, ht);
  });
  /* les façades vues : les pièces qui les touchent, regroupées par famille */
  var g = A.g;
  for(var k = 0; k < 4; k++){
    var a = int[k], b = int[(k + 1) % 4], d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]);
    var ea = ext[k], eb = ext[(k + 1) % 4], sd = sensDirect(ext);
    var n = [sd * (eb[1] - ea[1]), -sd * (eb[0] - ea[0])], ln = Math.hypot(n[0], n[1]);   /* sortante */
    if(n[0] * g[0] + n[1] * g[1] >= 0) continue;
    var Uf = [-n[1] / ln, n[0] / ln, 0];   /* z × n : lu depuis dehors */
    var u = [d[0] / l, d[1] / l], off = [ea[0] - a[0], ea[1] - a[1]];
    var runs = [];
    R.forEach(function(r){
      var pr = r.pts.map(function(q){ return [(q[0] - a[0]) * u[0] + (q[1] - a[1]) * u[1], Math.abs((q[0] - a[0]) * u[1] - (q[1] - a[1]) * u[0])]; });
      var touche = pr.filter(function(x){ return x[1] < .35; });
      if(touche.length < 2) return;
      var s0 = Math.min.apply(null, touche.map(function(x){ return x[0]; })), s1 = Math.max.apply(null, touche.map(function(x){ return x[0]; }));
      runs.push({ f:famDe(r), s0:s0, s1:s1 });
    });
    runs.sort(function(p, q){ return p.s0 - q.s0; });
    var M2 = [];
    runs.forEach(function(x){ var y = M2[M2.length - 1]; if(y && y.f === x.f && x.s0 - y.s1 < 1.5) y.s1 = Math.max(y.s1, x.s1); else M2.push(Object.assign({}, x)); });
    M2.forEach(function(x){
      var s = NOM[x.f], ht = taille(s, (x.s1 - x.s0) * .94, h * .72);
      if(ht < .6) return;
      var m = (x.s0 + x.s1) / 2;
      ecrire(t, A, s, [a[0] + u[0] * m + off[0], a[1] + u[1] * m + off[1], z0 + h / 2], Uf, [0, 0, 1], ht);
    });
  }
}
function aire(q){ var s = 0; for(var i = 0; i < q.length; i++){ var b = q[(i + 1) % q.length]; s += q[i][0] * b[1] - b[0] * q[i][1]; } return Math.abs(s) / 2; }
function sensDirect(q){ var s = 0; for(var i = 0; i < q.length; i++){ var b = q[(i + 1) % q.length]; s += q[i][0] * b[1] - b[0] * q[i][1]; } return s < 0 ? -1 : 1; }

/* ---------- éclatée ---------- */
export function axoEclatee(niveaux){
  var N = niveaux.slice().sort(function(a, b){ return a.lvl - b.lvl; });
  var t = feuille("AXONOMÉTRIE ÉCLATÉE", "Les plans des Typologies, niveau par niveau, chacun sur sa dalle, murs coupés", AXO.eclateePortrait, true);
  var pts = [];
  N.forEach(function(n){ n.prims.forEach(function(p){ if(!p.ctx && !p.g && p.k === "p") pts = pts.concat(p.pts); }); });
  if(!pts.length) return t;
  /* l'écart entre deux niveaux : `AXO.pas` fois la profondeur du plan dans la
     vue, rendue en hauteur, au moins `AXO.ecart` */
  var pr = pts.map(function(r){ return r[0] * Math.sin(VUE.r) + r[1] * Math.cos(VUE.r); });
  var pas = Math.max(AXO.ecart, (Math.max.apply(null, pr) - Math.min.apply(null, pr)) * VUE.el / VUE.z * AXO.pas);
  var z = 0;
  N.forEach(function(n){ n.z = z; z += pas; });
  z -= pas;
  var c = t.cadre, A = axo(c, pts, z);
  N.forEach(function(n, k){
    /* la dalle : le poché extérieur de chaque corps, épaissi */
    n.prims.forEach(function(p){ if(p.cl === "mur") prisme(t, A, p.pts, n.z - AXO.dalle, n.z, NOIR, { stroke:NUIT.trait, lw:.4 }); });
    n.prims.forEach(function(p){
      if(p.ctx || p.g || p.k !== "p") return;
      trait(t, p, function(r){ return A(r[0], r[1], n.z); }, 1.2, 0);
    });
    peindre(t, A, murs(n.prims, n.z));
    /* les noyaux qui montent au niveau suivant : leurs arêtes, en tirets,
       tracées avant que la dalle du dessus ne vienne les couvrir */
    var sup = N[k + 1];
    if(sup) noyaux(n).forEach(function(c){
      var d = noyaux(sup).filter(function(e){ return Math.hypot(e.c[0] - c.c[0], e.c[1] - c.c[1]) < 1.5; })[0];
      if(d) c.q.forEach(function(r){ t.ligne([A(r[0], r[1], n.z + AXO.murs), A(r[0], r[1], sup.z - AXO.dalle)], { stroke:NUIT.trait, lw:.5, dash:[3, 2] }); });
    });
    /* le nom du niveau, à gauche de sa dalle */
    var bas = pts.reduce(function(m, r){ var a = A(r[0], r[1], n.z); return a[0] < m[0] ? a : m; }, [Infinity, 0]);
    t.texte(bas[0] - 14, bas[1], n.name, { size:12, gras:true, ancre:"end", fill:NUIT.trait });
  });
  return t;
}

/* Les murs d'un niveau, en prismes coupés à `AXO.murs` : l'enveloppe entre
   le poché extérieur et la circulation qu'il entoure (les deux rectangles
   d'un corps, sommet pour sommet), les cloisons sur les côtés des pièces,
   chacun une fois. */

function murs(prims, z){
  var C = [], vu = {}, e = AXO.cloison / 2;
  function pose(q){
    var x = 0, y = 0; q.forEach(function(r){ x += r[0] / q.length; y += r[1] / q.length; });
    C.push({ x:x, y:y, q:q, z0:z, z1:z + AXO.murs, c:NOIR, o:{ stroke:NUIT.trait, lw:.25 } });
  }
  prims.forEach(function(p, i){
    if(p.cl !== "mur") return;
    var dans = prims.slice(i + 1).filter(function(q){ return q.cl === "circ"; })[0];
    if(!dans || dans.pts.length !== 4 || p.pts.length !== 4) return;
    for(var k = 0; k < 4; k++) pose([p.pts[k], p.pts[(k + 1) % 4], dans.pts[(k + 1) % 4], dans.pts[k]]);
  });
  prims.forEach(function(p){
    if(p.ctx || p.g || !p.ferme || !/\b(room|cell|cagef)\b/.test(p.cl)) return;
    p.pts.forEach(function(a, k){
      var b = p.pts[(k + 1) % p.pts.length], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      if(l < 0.3) return;
      var cle = [a, b].map(function(r){ return r[0].toFixed(1) + "," + r[1].toFixed(1); }).sort().join("|");
      if(vu[cle]) return;
      vu[cle] = 1;
      var nx = -dy / l * e, ny = dx / l * e;
      pose([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]);
    });
  });
  return C;
}

/* les noyaux d'un niveau : leur emprise et leur centre */
function noyaux(n){
  return n.prims.filter(function(p){ return p.cl === "cagef" && !p.ctx; }).map(function(p){ return { q:p.pts, c:centre(p.pts) }; });
}
