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
import { AXO, ENCRE, FORMATS, NUIT, TRAITS } from "../data/planches.js";
import { trait } from "./etages.js";
import { VUE, axo, peindre, prisme } from "./diagramme.js";

var E = ENCRE, GRIS = [0.4, 0.4, 0.4], EXIST = [[0.9, 0.9, 0.89], [0.82, 0.82, 0.81], [0.74, 0.74, 0.73]];
var M = 50;

function feuille(titre, sous, portrait){
  var F = FORMATS[AXO.format];
  if(portrait) F = { w:F.h, h:F.w };
  var t = trace(F.w, F.h), encre = E.noir, gris = GRIS;
  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:E.blanc });
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
   ce qu'il porte se NOMME en blanc, en lettres qui prennent toute la place — son chapitre, sous le nom de `AXO.noms` —, à plat sur les faces : sur le dessus, chaque
   famille sur l'emprise de ses pièces, ou le nom du bloc s'il est seul ou si
   elles se mêlent ; sur les façades vues, le nom du bloc, d'un bout à l'autre.
   Une face cachée par un volume peint plus tard l'est avec son texte. */
/* l'éclatée est dessinée plus petit que le 1:200 : ses traits s'y réduisent */
var ECH = 0.75, MM = 72 / 25.4;   /* `TRAITS` est en mm, la planche en pt */
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
   — `T` sa taille (`taille()`) ; centré sur `o`, ligne par ligne */
function ecrire(t, A, T, o, U, V){
  T.lignes.forEach(function(s, i){
    var d = ((T.lignes.length - 1) / 2 - i) * INTER * T.ht;
    ligne(t, A, s, [o[0] + V[0] * d, o[1] + V[1] * d, o[2] + V[2] * d], U, V, T.ht);
  });
}
function ligne(t, A, s, o, U, V, ht){
  var p = A(o[0], o[1], o[2]), pu = A(o[0] + U[0], o[1] + U[1], o[2] + U[2]), pv = A(o[0] + V[0], o[1] + V[1], o[2] + V[2]);
  var u = [pu[0] - p[0], pu[1] - p[1]], v = [pv[0] - p[0], pv[1] - p[1]], n = Math.hypot(u[0], u[1]);
  if(n < 1e-6) return;
  var sz = ht * n, m = [u[0] / n, u[1] / n, v[0] / n, v[1] / n];
  t.texte(p[0] - .35 * sz * m[2], p[1] - .35 * sz * m[3], s, { size:sz, gras:true, fill:BLANC_T, ancre:"middle", m:m });
}
/* la hauteur des lettres qui remplit une place `long` × `haut` (Helvetica
   grasse), sur une ligne — ou deux, coupée à la meilleure espace, quand les
   lettres y gagnent franchement */
var INTER = 1.15;
function taille(s, long, haut){
  function h(L){ return Math.max(0, Math.min(haut / (1 + INTER * (L.length - 1)), long / (0.6 * Math.max.apply(null, L.map(function(x){ return x.length; }))))); }
  var un = { ht:h([s]), lignes:[s] }, deux = { ht:0 };
  s.split("").forEach(function(c, i){
    var L = [s.slice(0, i), s.slice(i + 1)], v = c === " " ? h(L) : 0;
    if(v > deux.ht) deux = { ht:v, lignes:L };
  });
  return deux.ht > 1.25 * un.ht ? deux : un;
}

export function axoVolume(niveaux){
  var t = feuille("AXONOMÉTRIE", "Le volume, nommé par programme · l'existant en volumes clairs");
  dessinVolume(t, t.cadre, niveaux);
  return t;
}
/* Le dessin seul, dans le cadre `c` [x, y, l, h] : la planche ci-dessus, et le
   cadre « Axonometry » du midterm. */
export function dessinVolume(t, c, niveaux){
  var N = niveaux.filter(function(n){ return n.lvl >= 0; }).sort(function(a, b){ return a.lvl - b.lvl; });
  var z = 0, C = [], pts = PER.slice(), H = 1;
  N.forEach(function(n){
    /* les niveaux s'empilent à la hauteur de leur plus haute pièce : l'éclaté
       sépare les niveaux, il ne dit pas la hauteur de chaque volume */
    var hn = n.hs || n.h;
    n.z = z; z += hn; H = Math.max(H, z);
    var P = n.prims, pieces = P.filter(function(p){ return p.k === "p" && p.ferme && !p.ctx && famDe(p); });
    P.forEach(function(p, i){
      if(p.cl !== "mur") return;
      var dans = P.slice(i + 1).filter(function(q){ return q.cl === "circ"; })[0];
      if(!dans) return;
      var R = pieces.filter(function(r){ return dedans(dans.pts, centre(r.pts)); });
      pts = pts.concat(p.pts);
      var c = centre(p.pts);
      C.push({ x:c[0], y:c[1], q:p.pts, z0:n.z, z1:n.z + hn, c:NOIR, o:{ stroke:BLANC_T, lw:.6 },
               apres:function(t){ habiller(t, A, p.pts, R, n.z, hn); } });
    });
  });
  existants().forEach(function(x){ C.push({ x:x.q[0][0], y:x.q[0][1], q:x.q, z0:0, z1:x.h, c:AXO.existant, o:{ stroke:false } }); });
  t.decoupe([[c[0], c[1]], [c[0] + c[2], c[1]], [c[0] + c[2], c[1] + c[3]], [c[0], c[1] + c[3]]]);
  var A = axo(c, pts, H * 1.1);
  t.poly(PER.map(function(p){ return A(p[0], p[1], 0); }), { stroke:GRIS, lw:.5, dash:[4, 3] });
  peindre(t, A, C);
  t.fin();
}

/* les pièces et les noms d'un bloc : dessus, puis façades vues */
function habiller(t, A, ext, R, z0, h){
  var z1 = z0 + h;
  /* le nom du bloc : la famille qui y tient le plus de place */
  var S = {};
  R.forEach(function(r){ var f = famDe(r); S[f] = (S[f] || 0) + aire(r.pts); });
  var dom = Object.keys(S).sort(function(p, q){ return S[q] - S[p]; })[0];
  if(!dom) return;
  /* le dessus : chaque nom occupe l'emprise de ses pièces dans le corps, en
     lettres aussi grandes qu'elle le permet — sauf si deux emprises se
     chevauchent (des familles mêlées) : le nom du bloc prend alors tout le dessus */
  var o = ext[0], a0 = [ext[1][0] - o[0], ext[1][1] - o[1]], a1 = [ext[3][0] - o[0], ext[3][1] - o[1]];
  var la0 = Math.hypot(a0[0], a0[1]), la1 = Math.hypot(a1[0], a1[1]);
  var u0 = [a0[0] / la0, a0[1] / la0], u1 = [a1[0] / la1, a1[1] / la1];
  var B = {};
  R.forEach(function(r){
    var b = B[famDe(r)] || (B[famDe(r)] = [Infinity, -Infinity, Infinity, -Infinity]);
    r.pts.forEach(function(q){
      var x = (q[0] - o[0]) * u0[0] + (q[1] - o[1]) * u0[1], y = (q[0] - o[0]) * u1[0] + (q[1] - o[1]) * u1[1];
      b[0] = Math.min(b[0], x); b[1] = Math.max(b[1], x); b[2] = Math.min(b[2], y); b[3] = Math.max(b[3], y);
    });
  });
  var F = Object.keys(B), mele = F.some(function(f, i){
    return F.slice(i + 1).some(function(g){
      var p = B[f], q = B[g];
      return Math.min(p[1], q[1]) - Math.max(p[0], q[0]) > 1 && Math.min(p[3], q[3]) - Math.max(p[2], q[2]) > 1;
    });
  });
  if(F.length === 1 || mele){ B = {}; B[dom] = [0, la0, 0, la1]; }
  Object.keys(B).forEach(function(f){
    var b = B[f], s = NOM[f], w0 = b[1] - b[0], w1 = b[3] - b[2];
    var cx = (b[0] + b[1]) / 2, cy = (b[2] + b[3]) / 2, c = [o[0] + u0[0] * cx + u1[0] * cy, o[1] + u0[1] * cx + u1[1] * cy];
    /* le sens où les lettres paraissent les plus grandes à l'écran : une
       place carrée vue de biais s'écrit sur son côté le plus couché */
    var p0 = A(0, 0, 0), h0 = taille(s, w0 * .9, w1 * .7), h1 = taille(s, w1 * .9, w0 * .7);
    function vu(a){ var p = A(a[0], a[1], 0); return Math.hypot(p[0] - p0[0], p[1] - p0[1]); }
    var un = h0.ht * vu(u0) >= h1.ht * vu(u1), U = un ? [u0[0], u0[1], 0] : [u1[0], u1[1], 0], T = un ? h0 : h1;
    /* lu de gauche à droite à l'écran, et V = z × U : jamais en miroir */
    if(A(U[0], U[1], 0)[0] < p0[0]) U = [-U[0], -U[1], 0];
    var V = [-U[1], U[0], 0];
    if(T.ht < .5) return;
    ecrire(t, A, T, [c[0], c[1], z1], U, V);
  });
  /* les façades vues : le nom du bloc, sur toute la longueur — une façade vue
     trop de biais l'écraserait en un trait, elle reste nue */
  var g = A.g, sd = sensDirect(ext), s = NOM[dom];
  for(var k = 0; k < ext.length; k++){
    var ea = ext[k], eb = ext[(k + 1) % ext.length], l = Math.hypot(eb[0] - ea[0], eb[1] - ea[1]);
    var n = [sd * (eb[1] - ea[1]) / l, -sd * (eb[0] - ea[0]) / l];   /* sortante */
    if(n[0] * g[0] + n[1] * g[1] > -.3) continue;
    var T = taille(s, l * .9, h * .6);
    if(T.ht < .6) continue;
    ecrire(t, A, T, [(ea[0] + eb[0]) / 2, (ea[1] + eb[1]) / 2, z0 + h / 2], [-n[1], n[0], 0], [0, 0, 1]);
  }
}
function aire(q){ var s = 0; for(var i = 0; i < q.length; i++){ var b = q[(i + 1) % q.length]; s += q[i][0] * b[1] - b[0] * q[i][1]; } return Math.abs(s) / 2; }
function sensDirect(q){ var s = 0; for(var i = 0; i < q.length; i++){ var b = q[(i + 1) % q.length]; s += q[i][0] * b[1] - b[0] * q[i][1]; } return s < 0 ? -1 : 1; }

/* ---------- éclatée ---------- */
export function axoEclatee(niveaux){
  var t = feuille("AXONOMÉTRIE ÉCLATÉE", "Les plans des Typologies, niveau par niveau, chacun sur sa dalle, murs coupés", AXO.eclateePortrait);
  dessinEclatee(t, t.cadre, niveaux);
  return t;
}
export function dessinEclatee(t, c, niveaux){
  var N = niveaux.slice().sort(function(a, b){ return a.lvl - b.lvl; });
  var pts = [];
  N.forEach(function(n){ n.prims.forEach(function(p){ if(!p.ctx && !p.g && p.k === "p") pts = pts.concat(p.pts); }); });
  if(!pts.length) return;
  /* l'écart entre deux niveaux : `AXO.pas` fois la profondeur du plan dans la
     vue, rendue en hauteur, au moins `AXO.ecart` */
  var pr = pts.map(function(r){ return r[0] * Math.sin(VUE.r) + r[1] * Math.cos(VUE.r); });
  var pas = Math.max(AXO.ecart, (Math.max.apply(null, pr) - Math.min.apply(null, pr)) * VUE.el / VUE.z * AXO.pas);
  var z = 0;
  N.forEach(function(n){ n.z = z; z += pas; });
  z -= pas;
  /* la parcelle, au rez, en trait tireté : le cadrage la tient aussi */
  var R = N.filter(function(n){ return n.lvl === 0; })[0] || N[0];
  var par = R.prims.filter(function(p){ return p.ctx === "site" && p.k === "p"; });
  var cadre = pts.slice();
  par.forEach(function(p){ cadre = cadre.concat(p.pts); });
  /* la place des noms de niveau, à gauche : le dessin ne la prend pas */
  var A = axo([c[0] + 70, c[1], c[2] - 70, c[3]], cadre, z);
  N.forEach(function(n, k){
    if(n === R) par.forEach(function(p){
      t[p.ferme ? "poly" : "ligne"](p.pts.map(function(r){ return A(r[0], r[1], n.z - AXO.dalle); }),
        { stroke:NUIT.encre, lw:TRAITS.menuiserie * MM * ECH, dash:[6, 3] });
    });
    /* la dalle : le poché extérieur de chaque corps, épaissi */
    n.prims.forEach(function(p){ if(p.cl === "mur") prisme(t, A, p.pts, n.z - AXO.dalle, n.z, NOIR, { stroke:NUIT.trait, lw:TRAITS.coupe * MM * ECH }); });
    n.prims.forEach(function(p){
      if(p.ctx || p.g || p.k !== "p") return;
      trait(t, p, function(r){ return A(r[0], r[1], n.z); }, 1.2, 0, ECH);
    });
    peindre(t, A, murs(n.prims, n.z));
    /* les noyaux qui montent au niveau suivant : leurs arêtes, en tirets,
       tracées avant que la dalle du dessus ne vienne les couvrir */
    var sup = N[k + 1];
    if(sup) noyaux(n).forEach(function(c){
      var d = noyaux(sup).filter(function(e){ return Math.hypot(e.c[0] - c.c[0], e.c[1] - c.c[1]) < 1.5; })[0];
      if(d) c.q.forEach(function(r){ t.ligne([A(r[0], r[1], n.z + AXO.murs), A(r[0], r[1], sup.z - AXO.dalle)], { stroke:NUIT.encre, lw:TRAITS.menuiserie * MM * ECH, dash:[3, 2] }); });
    });
    /* le nom du niveau, à gauche de sa dalle */
    var bas = pts.reduce(function(m, r){ var a = A(r[0], r[1], n.z); return a[0] < m[0] ? a : m; }, [Infinity, 0]);
    t.texte(bas[0] - 14, bas[1], n.name, { size:12, gras:true, ancre:"end", fill:NUIT.encre });
  });
}

/* Les murs d'un niveau, en prismes coupés à `AXO.murs` : l'enveloppe entre
   le poché extérieur et la circulation qu'il entoure (les deux rectangles
   d'un corps, sommet pour sommet), les cloisons sur les côtés des pièces,
   chacun une fois. */

function murs(prims, z){
  var C = [], vu = {}, e = AXO.cloison / 2;
  function pose(q){
    var x = 0, y = 0; q.forEach(function(r){ x += r[0] / q.length; y += r[1] / q.length; });
    C.push({ x:x, y:y, q:q, z0:z, z1:z + AXO.murs, c:NOIR, o:{ stroke:NUIT.trait, lw:TRAITS.coupe * MM * ECH * .6 } });
  }
  /* le k-ième poché et le k-ième sol sont ceux du même corps : tous les
     pochés se dessinent avant tous les sols */
  var sols = prims.filter(function(q){ return q.cl === "circ" && !q.ctx && !q.g; }), km = 0;
  prims.forEach(function(p){
    if(p.cl !== "mur") return;
    var dans = sols[km++];
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
