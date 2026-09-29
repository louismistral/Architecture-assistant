/* ============================================================================
   PLANCHE MASSING · PLAN DE SITUATION — A2, 1:500, vectoriel

   La base (`DOC/site-plan_base.pdf`) reste telle quelle ; on y AJOUTE, dans la
   seule parcelle rouge, la volumétrie à l'écran — dans le style de la base :
   toitures blanches, ombres portées grises vers le sud-est — et la mobilité
   (`mobilite.js`) : voies, baie des bus, dépose-minute, parkings, vélos,
   cheminement piéton. Tout ce qui est ajouté est découpé par la parcelle.
   ========================================================================= */
import { trace } from "../core/pdf.js";
import { PER } from "../data/site.js";
import { BASE, ENCRE, FORMATS } from "../data/planches.js";
import { coins, enveloppe } from "../mass/geom.js";
import { etagesDe, pontRect } from "../mass/model.js";
import { mobilite } from "./mobilite.js";

var E = ENCRE;
function P(p){ return [BASE.ox + BASE.k * p[0], BASE.oy + BASE.k * p[1]]; }
function rect(rc){ return coins(rc).map(P); }
/* un trait épais en polygone : la voie a une largeur, pas un trait */
function bande(a, b, l){
  var dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
  var ox = -dy / n * l / 2, oy = dx / n * l / 2;
  return [[a[0] + ox, a[1] + oy], [b[0] + ox, b[1] + oy], [b[0] - ox, b[1] - oy], [a[0] - ox, a[1] - oy]].map(P);
}
function centre(rc){ return P([rc.x, rc.y]); }

export function planSituation(vols){
  var F = FORMATS[BASE.format], t = trace(F.w, F.h), M = mobilite(vols);
  var txt = { size:7, fill:E.noir, ancre:"middle" };
  t.decoupe(PER.map(P));

  /* la mobilité d'abord : elle est au sol */
  M.voies.forEach(function(v){ t.poly(bande(v[0], v[1], 6), { fill:E.route }); });
  if(M.pieton) t.poly(bande(M.pieton[0], M.pieton[1], 3), { fill:E.route });
  if(M.pieton) t.ligne(M.pieton.map(P), { stroke:E.blanc, lw:.6, dash:[3, 2] });
  [M.bus, M.depose].forEach(function(r){ if(r) t.poly(rect(r), { fill:E.route, stroke:E.trait, lw:.4 }); });
  M.lots.forEach(function(l){ t.poly(rect(l.rc), { fill:E.route }); });
  M.traits.forEach(function(s){ t.ligne(s.map(P), { stroke:E.blanc, lw:.5 }); });
  if(M.velos) t.poly(rect(M.velos), { fill:E.blanc, stroke:E.trait, lw:.4, dash:[2, 1.5] });

  /* les volumes : les ombres de tous, puis les toitures de tous */
  var corps = [];
  vols.forEach(function(v){
    var et = etagesDe(v), z0 = et.length ? et[0].z0 : 0;
    et.forEach(function(e){ corps.push({ v:v, e:e, h:e.z1 - z0 }); });
  });
  corps.forEach(function(c){
    if(c.v.ph) return;
    var q = coins(c.e.rc), d = [E.ombreParM[0] * c.h, E.ombreParM[1] * c.h];
    t.poly(enveloppe(q.concat(q.map(function(p){ return [p[0] + d[0], p[1] + d[1]]; }))).map(P), { fill:E.ombre });
  });
  (vols.ponts || []).forEach(function(p){ var r = pontRect(p, vols); if(r) t.poly(rect(r), { fill:E.blanc, stroke:E.fin, lw:.3 }); });
  corps.sort(function(a, b){ return a.h - b.h; }).forEach(function(c){
    t.poly(rect(c.e.rc), c.v.ph ? { stroke:E.noir, lw:.5, dash:[3, 2] } : { fill:E.blanc, stroke:E.fin, lw:.3 });
  });

  /* les légendes, dans la parcelle */
  if(M.bus){ var cb = centre(M.bus); t.texte(cb[0], cb[1] - 2.5, "bus", txt); }
  if(M.depose){ var cd = centre(M.depose); t.texte(cd[0], cd[1] - 2.5, "dépose-minute", txt); }
  M.lots.forEach(function(l){ var c = centre(l.rc); t.texte(c[0], c[1] - 2.5, "P " + l.n, { size:9, gras:true, fill:E.noir, ancre:"middle" }); });
  if(M.velos){ var cv = centre(M.velos); t.texte(cv[0], cv[1] - 2.5, "vélos", txt); }
  vols.forEach(function(v){
    if(!v.ph) return;
    var c = P([v.x, v.y]);
    t.texte(c[0], c[1] - 2.5, v.nom || "second temps", txt);
  });
  t.fin();
  t.mobilite = M;
  return t;
}
