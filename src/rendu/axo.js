/* ============================================================================
   RENDU · TYPOLOGIES — deux axonométries

     axoVolume(vols)      le volume tel que le massing le pose, étage par
                          étage, sur la parcelle, l'existant à sa hauteur
     axoEclatee(niveaux)  le même, éclaté : chaque niveau porte son plan des
                          Typologies (`typoPlanches()`) et ses murs coupés,
                          sur sa dalle, écarté
                          du suivant (`AXO.pas`, `AXO.ecart`)

   La vue est celle des diagrammes du massing (`axo()`, `prisme()`), dans leur
   style : volumes blancs aux flancs gris.
   ========================================================================= */
import { trace } from "../core/pdf.js";
import { PER, SITE } from "../data/site.js";
import { AXO, ENCRE, FORMATS } from "../data/planches.js";
import { lvlOf } from "../mix/floors.js";
import { coins } from "../mass/geom.js";
import { etagesDe } from "../mass/model.js";
import { BLANC, VUE, axo, peindre, prisme, sol } from "./diagramme.js";

var E = ENCRE, GRIS = [0.4, 0.4, 0.4], EXIST = [[0.9, 0.9, 0.89], [0.82, 0.82, 0.81], [0.74, 0.74, 0.73]];
var M = 50;

function feuille(titre, sous, portrait){
  var F = FORMATS[AXO.format];
  if(portrait) F = { w:F.h, h:F.w };
  var t = trace(F.w, F.h);
  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:E.blanc });
  t.texte(M, F.h - M - 26, titre, { size:30, gras:true });
  t.texte(M, F.h - M - 46, sous, { size:10, fill:GRIS });
  t.texte(F.w - M, M - 24, "Centre scolaire de Saxon · 05 Typologies · " + AXO.format, { size:7, fill:GRIS, ancre:"end" });
  t.cadre = [M, M, F.w - 2 * M, F.h - 2 * M - 76];
  return t;
}
function existants(){
  return SITE.bat.map(function(b, i){
    var h = SITE.bath && SITE.bath[i] ? SITE.bath[i][1] - SITE.bath[i][0] : 0;
    return h > 1 && b.length > 2 ? { q:b, h:h } : null;
  }).filter(Boolean);
}

/* ---------- le volume ---------- */
export function axoVolume(vols){
  var t = feuille("AXONOMÉTRIE", "Le volume, étage par étage, sur la parcelle · l'existant à sa hauteur");
  var z00 = Infinity, C = [], pts = PER.slice();
  vols.forEach(function(v){ etagesDe(v).forEach(function(e){ if(lvlOf(e.e.i) >= 0) z00 = Math.min(z00, e.z0); }); });
  if(!isFinite(z00)) z00 = 0;
  var H = 1;
  vols.forEach(function(v){
    etagesDe(v).forEach(function(e){
      if(lvlOf(e.e.i) < 0) return;
      var q = coins(e.rc), z0 = Math.max(0, e.z0 - z00), z1 = e.z1 - z00;
      H = Math.max(H, z1); pts = pts.concat(q);
      C.push({ x:e.rc.x, y:e.rc.y, q:q, z0:z0, z1:z1, c:v.ph ? null : BLANC, o:v.ph ? { dash:[2.5, 1.8] } : null });
    });
  });
  var X = existants();
  X.forEach(function(x){ C.push({ x:x.q[0][0], y:x.q[0][1], q:x.q, z0:0, z1:x.h, c:EXIST }); });
  var c = t.cadre;
  t.decoupe([[c[0], c[1]], [c[0] + c[2], c[1]], [c[0] + c[2], c[1] + c[3]], [c[0], c[1] + c[3]]]);
  var A = axo(c, pts, H * 1.1);
  sol(t, A);
  peindre(t, A, C);
  t.fin();
  return t;
}

/* ---------- éclatée ---------- */
export function axoEclatee(niveaux){
  var N = niveaux.slice().sort(function(a, b){ return a.lvl - b.lvl; });
  var t = feuille("AXONOMÉTRIE ÉCLATÉE", "Les plans des Typologies, niveau par niveau, chacun sur sa dalle, murs coupés", AXO.eclateePortrait);
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
  N.forEach(function(n){
    /* la dalle : le poché extérieur de chaque corps, épaissi */
    n.prims.forEach(function(p){ if(p.cl === "mur") prisme(t, A, p.pts, n.z - AXO.dalle, n.z, BLANC); });
    n.prims.forEach(function(p){
      if(p.ctx || p.g || p.k !== "p") return;
      var q = p.pts.map(function(r){ return A(r[0], r[1], n.z); });
      var o = { fill:p.fill, stroke:p.stroke };
      if(o.stroke) o.lw = p.lwPt != null ? p.lwPt * 0.35 : Math.max(0.15, p.lw * 1.2);
      t[p.ferme ? "poly" : "ligne"](q, o);
    });
    peindre(t, A, murs(n.prims, n.z));
    /* le nom du niveau, à gauche de sa dalle */
    var bas = pts.reduce(function(m, r){ var a = A(r[0], r[1], n.z); return a[0] < m[0] ? a : m; }, [Infinity, 0]);
    t.texte(bas[0] - 14, bas[1], n.name, { size:12, gras:true, ancre:"end" });
  });
  return t;
}

/* Les murs d'un niveau, en prismes coupés à `AXO.murs` : l'enveloppe entre
   le poché extérieur et la circulation qu'il entoure (les deux rectangles
   d'un corps, sommet pour sommet), les cloisons sur les côtés des pièces,
   chacun une fois. */
var MUR = [[0.13, 0.13, 0.13], [0.86, 0.86, 0.85], [0.76, 0.76, 0.75]];
function murs(prims, z){
  var C = [], vu = {}, e = AXO.cloison / 2;
  function pose(q){
    var x = 0, y = 0; q.forEach(function(r){ x += r[0] / q.length; y += r[1] / q.length; });
    C.push({ x:x, y:y, q:q, z0:z, z1:z + AXO.murs, c:MUR, o:{ lw:.25 } });
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
