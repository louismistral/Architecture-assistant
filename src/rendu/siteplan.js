/* ============================================================================
   PLANCHE MASSING · PLAN DE SITUATION — A2, 1:500, vectoriel

   La base (`DOC/site-plan_base.pdf`) reste telle quelle ; on y AJOUTE, dans la
   seule parcelle rouge, la volumétrie à l'écran — dans le style de la base :
   toitures blanches, ombres portées grises vers le sud-est. L'échelle est
   celle de la base, 1:500
   (`BASE.echelle`) : on ne la recalcule ni ne l'ajuste jamais — la planche
   s'imprime à 100 %.
   ========================================================================= */
import { trace } from "../core/pdf.js";
import { PER } from "../data/site.js";
import { BASE, ENCRE, FORMATS } from "../data/planches.js";
import { coins, enveloppe } from "../mass/geom.js";
import { etagesDe, pontRect } from "../mass/model.js";

var E = ENCRE;

export function planSituation(vols){
  var F = FORMATS[BASE.format], t = trace(F.w, F.h);
  situation(t, vols, BASE);
  return t;
}

/* La volumétrie sur une base calée `cal` ({ k, ox, oy } : x = ox + k·x_site) :
   la même pour la planche A2 et pour le cadre du midterm. */
export function situation(t, vols, cal){
  function P(p){ return [cal.ox + cal.k * p[0], cal.oy + cal.k * p[1]]; }
  function rect(rc){ return coins(rc).map(P); }
  t.decoupe(PER.map(P));
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
  vols.forEach(function(v){
    if(!v.ph) return;
    var c = P([v.x, v.y]);
    t.texte(c[0], c[1] - 2.5, v.nom || "second temps", { size:7, ancre:"middle" });
  });
  t.fin();
}
