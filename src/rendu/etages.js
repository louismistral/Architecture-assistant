/* ============================================================================
   RENDU · TYPOLOGIES — un plan par niveau, au 1:200, sur son contexte

   Le plan est celui de l'onglet Typologies, tel quel : `plans.html —
   typoPlanches()` en rend la géométrie résolue, niveau par niveau, en mètres
   du site. On ne fait ici que la poser à l'échelle (`ETAGES.echelle`) et
   éclaircir le CONTEXTE — parcelle, existant, volumes absents du niveau — à
   mesure qu'on monte : le rez le montre presque tel quel, le dernier étage
   à peine (`ETAGES.clair`). Tous les niveaux ont le même format et le même
   cadrage : les planches se superposent.
   ========================================================================= */
import { trace } from "../core/pdf.js";
import { ETAGES, FORMATS, NUIT } from "../data/planches.js";

var MM = 72 / 25.4, K = 1000 / ETAGES.echelle * MM;   /* pt par mètre */
var PX = 0.35;                                         /* un trait d'écran, en pt */
var GRIS = [0.4, 0.4, 0.4];

function pointsDe(p){ return p.k === "t" ? [[p.x, p.y]] : p.pts; }

/* Le cadrage commun : le bâti de tous les niveaux et la parcelle, plus
   `autour` ; le plus petit format qui le tient à l'échelle. */
export function cadrage(niveaux){
  var b = [Infinity, Infinity, -Infinity, -Infinity];
  niveaux.forEach(function(n){ n.prims.forEach(function(p){
    if(p.ctx && p.ctx !== "site") return;
    pointsDe(p).forEach(function(q){ b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]); });
  }); });
  var a = ETAGES.autour, w = (b[2] - b[0] + 2 * a) * K, h = (b[3] - b[1] + 2 * a) * K;
  var id = ETAGES.formats.filter(function(f){
    var F = FORMATS[f];
    return w <= F.w - 2 * ETAGES.marge && h <= F.h - 2 * ETAGES.marge - ETAGES.cartouche;
  })[0] || ETAGES.formats[ETAGES.formats.length - 1];
  var lvls = niveaux.map(function(n){ return n.lvl; }).filter(function(l, i, A){ return A.indexOf(l) === i; }).sort(function(p, q){ return p - q; });
  return { format:id, cx:(b[0] + b[2]) / 2, cy:(b[1] + b[3]) / 2, lvls:lvls };
}

export function planEtage(n, cad){
  var F = FORMATS[cad.format], t = trace(F.w, F.h), m = ETAGES.marge;
  var z = [m, m + ETAGES.cartouche, F.w - m, F.h - m];
  var ox = (z[0] + z[2]) / 2 - K * cad.cx, oy = (z[1] + z[3]) / 2 - K * cad.cy;
  function P(q){ return [ox + K * q[0], oy + K * q[1]]; }
  /* plus on monte, plus le contexte s'efface dans le fond */
  var r = cad.lvls.length > 1 ? cad.lvls.indexOf(n.lvl) / (cad.lvls.length - 1) : 0;
  var cl = ETAGES.clair[0] + (ETAGES.clair[1] - ETAGES.clair[0]) * r;

  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:NUIT.fond });
  t.decoupe([[z[0], z[1]], [z[2], z[1]], [z[2], z[3]], [z[0], z[3]]]);
  n.prims.forEach(function(p){ trait(t, p, P, K, p.ctx ? cl : 0); });
  t.fin();
  t.ligne([[z[0], z[1]], [z[2], z[1]], [z[2], z[3]], [z[0], z[3]], [z[0], z[1]]], { stroke:NUIT.trait, lw:.5 });
  var y = m + ETAGES.cartouche - 30;
  t.texte(m, y, n.name, { size:24, gras:true, fill:NUIT.trait });
  t.texte(m, y - 18, "Plan · 1:" + ETAGES.echelle + " · hauteur d'étage " + String(Math.round(n.h * 100) / 100).replace(".", ",") + " m", { size:10, fill:NUIT.gris });
  t.texte(F.w - m, y, "Centre scolaire de Saxon · 05 Typologies", { size:10, gras:true, ancre:"end", fill:NUIT.trait });
  t.texte(F.w - m, y - 18, cad.format + " paysage · imprimer à 100 %", { size:8, fill:NUIT.gris, ancre:"end" });
  return t;
}

/* UN ÉLÉMENT DU PLAN, EN TRAIT BLANC sur fond noir : aucun aplat. Ce qui
   n'avait qu'un aplat se dessine par son contour s'il compte — le poché
   (murs), la circulation qu'il entoure, les noyaux — et disparaît sinon (les
   percements, les hachures). `map` place un point du site sur la feuille, `k`
   les points par mètre ; `efface` (0 à 1) fond le trait dans le noir. */
export function trait(t, p, map, k, efface){
  var c = NUIT.trait.map(function(v, i){ return v + (NUIT.fond[i] - v) * (efface || 0); });
  if(p.k === "t"){
    /* un texte se lit toujours de bas en haut ou de gauche à droite */
    var rot = Math.cos(p.rot) < -1e-6 ? p.rot + Math.PI : p.rot, q = map([p.x, p.y]);
    t.texte(q[0], q[1], p.s, { size:p.size * k, gras:p.gras, fill:c, ancre:"middle", rot:rot });
    return;
  }
  var aplat = !p.stroke && p.fill;
  if(aplat && !/\b(mur|circ|cagef)\b/.test(p.cl || "")) return;
  if(!p.stroke && !aplat) return;
  var o = { stroke:c, lw:aplat ? .4 : p.lwPt != null ? p.lwPt * PX : Math.max(.15, p.lw * k) };
  var d = !aplat && (p.dashPt ? p.dashPt.map(function(v){ return v * PX * 2; }) : p.dash && p.dash.map(function(v){ return v * k; }));
  if(d) o.dash = d;
  t[p.ferme ? "poly" : "ligne"](p.pts.map(map), o);
}
