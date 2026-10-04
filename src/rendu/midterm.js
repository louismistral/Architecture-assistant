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
