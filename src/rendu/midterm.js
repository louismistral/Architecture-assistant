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
  /* Representative Floor plan 1:200 : le plan du REZ seul, au 1:200, centré
     sur ses bâtiments et coupé là où le cadre s'arrête */
  var c = MIDTERM.plans, z = [c[0] + m, c[1] + m, c[2] - m, c[3] - MIDTERM.plansTitre];
  var rez = niveaux.filter(function(n){ return n.lvl === 0; })[0];
  if(rez){
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    rez.prims.forEach(function(p){ if(p.cl === "mur" && !p.ctx) p.pts.forEach(function(q){
      b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]); }); });
    if(isFinite(b[0])) dessinPlan(t, rez, cad, z, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
  }
  return t;
}
