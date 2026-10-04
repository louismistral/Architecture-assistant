/* ============================================================================
   LE MIDTERM — deux planches A1 sur le gabarit `DOC/MID_TERM.pdf`, suivi à la
   lettre : on ne fait que REMPLIR deux de ses cadres, sur la première page.

     Site Plan 1.500   la volumétrie sur la base du géomètre, au 1:500, nord en
                       haut, la parcelle centrée — la base est déjà dans
                       `DOC/midterm_base.pdf` (`tools/midterm-base.py`)
     Schemes           les quatre temps des diagrammes du massing, en ligne

   La seconde page reste celle du gabarit.
   ========================================================================= */
import { trace } from "../core/pdf.js";
import { FORMATS, MIDTERM } from "../data/planches.js";
import { situation } from "./siteplan.js";
import { diagrammes } from "./diagramme.js";
import { dessinEclatee, dessinVolume } from "./axo.js";
import { dessinPlan } from "./etages.js";
import { ETAGES, NUIT } from "../data/planches.js";

function cadre(c){ return [[c[0], c[1]], [c[2], c[1]], [c[2], c[3]], [c[0], c[3]]]; }

export function planMidterm(vols){
  var F = FORMATS[MIDTERM.format], t = trace(F.w, F.h), m = 16, c = MIDTERM.schemes;
  /* la parcelle déborde d'un mètre de part et d'autre : le cadre la coupe */
  t.decoupe(cadre(MIDTERM.situation));
  situation(t, vols, MIDTERM.calage);
  t.fin();
  diagrammes(t, vols, [c[0] + m, c[1] + m, c[2] - c[0] - 2 * m, c[3] - c[1] - m - MIDTERM.schemesTitre], 4);
  return t;
}

/* LA SECONDE PAGE — à partir des plans des Typologies (`typoPlanches()`) et
   de leur cadrage commun (`cadrage()`). */
export function planMidterm2(niveaux, cad){
  var F = FORMATS[MIDTERM.format], t = trace(F.w, F.h), m = 16;
  /* Axonometry : le volume à gauche, l'éclatée à droite */
  var a = MIDTERM.axonometrie, w = a[2] - a[0] - 2 * m, h = a[3] - a[1] - m - MIDTERM.axonometrieTitre;
  dessinVolume(t, [a[0] + m, a[1] + m, w * .55, h], niveaux);
  dessinEclatee(t, [a[0] + m + w * .57, a[1] + m, w * .43, h], niveaux);
  /* Representative Floor plan 1:200 : un niveau par bande, du plus haut au
     plus bas, chacun recadré sur son bâtiment — coupé là où la bande s'arrête */
  var c = MIDTERM.plans, N = niveaux.slice().sort(function(p, q){ return q.lvl - p.lvl; });
  var x0 = c[0] + m, x1 = c[2] - m, haut = c[3] - MIDTERM.plansTitre, bas = c[1] + m, gap = 10;
  var bh = (haut - bas - gap * (N.length - 1)) / N.length;
  N.forEach(function(n, k){
    /* recadré sur le plus grand corps du niveau : le centre de tous tombait
       souvent entre deux bâtiments, et la bande ne montrait que le vide */
    var y1 = haut - k * (bh + gap), y0 = y1 - bh, big = null, ba = 0;
    n.prims.forEach(function(p){
      if(p.cl !== "mur" || p.ctx) return;
      var a = 0, q = p.pts;
      for(var i = 0; i < q.length; i++){ var r = q[(i + 1) % q.length]; a += q[i][0] * r[1] - r[0] * q[i][1]; }
      if(Math.abs(a) > ba){ ba = Math.abs(a); big = q; }
    });
    if(!big) return;
    var cx = 0, cy = 0;
    big.forEach(function(q){ cx += q[0] / big.length; cy += q[1] / big.length; });
    dessinPlan(t, n, cad, [x0, y0, x1, y1], cx, cy);
    t.ligne([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], { stroke:NUIT.encre, lw:.4 });
    t.poly([[x0, y1 - 18], [x0 + 150, y1 - 18], [x0 + 150, y1], [x0, y1]], { fill:NUIT.papier });
    t.texte(x0 + 5, y1 - 13, n.name + " · 1:" + ETAGES.echelle, { size:10, gras:true, fill:NUIT.encre });
  });
  return t;
}
