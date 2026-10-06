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
import { ETAGES, FORMATS, NUIT, TRAITS } from "../data/planches.js";

var NUIT0 = NUIT;

var MM = 72 / 25.4, K = 1000 / ETAGES.echelle * MM;   /* pt par mètre */
var PX = 0.75;                                         /* un px d'écran (96 par pouce), en pt */
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
  return { format:id, cx:(b[0] + b[2]) / 2, cy:(b[1] + b[3]) / 2, lvls:lvls, niveaux:niveaux };
}

export function planEtage(n, cad){
  var F = FORMATS[cad.format], t = trace(F.w, F.h), m = ETAGES.marge;
  var z = [m, m + ETAGES.cartouche, F.w - m, F.h - m];
  t.poly([[0, 0], [F.w, 0], [F.w, F.h], [0, F.h]], { fill:NUIT.papier });
  dessinPlan(t, n, cad, z, cad.cx, cad.cy);
  t.ligne([[z[0], z[1]], [z[2], z[1]], [z[2], z[3]], [z[0], z[3]], [z[0], z[1]]], { stroke:NUIT.encre, lw:.5 });
  var y = m + ETAGES.cartouche - 30;
  t.texte(m, y, n.name, { size:24, gras:true, fill:NUIT.encre });
  t.texte(m, y - 18, "Plan · 1:" + ETAGES.echelle + " · hauteur d'étage " + String(Math.round(n.h * 100) / 100).replace(".", ",") + " m", { size:10, fill:NUIT.gris });
  t.texte(F.w - m, y, "Centre scolaire de Saxon · 05 Typologies", { size:10, gras:true, ancre:"end", fill:NUIT.encre });
  t.texte(F.w - m, y - 18, cad.format + " paysage · imprimer à 100 %", { size:8, fill:NUIT.gris, ancre:"end" });
  return t;
}

/* Le plan d'un niveau, au 1:200, découpé par la zone `z` [x0, y0, x1, y1] et
   centré sur le point (cx, cy) du site : la planche entière, ou une bande du
   cadre « Representative Floor plan » du midterm. `pal` : la palette, `NUIT`
   par défaut ; `JOUR` au rendu final, que le règlement veut au trait noir
   sur fond blanc. */
export function dessinPlan(t, n, cad, z, cx, cy, pal){
  pal = pal || NUIT;
  var ox = (z[0] + z[2]) / 2 - K * cx, oy = (z[1] + z[3]) / 2 - K * cy;
  function P(q){ return [ox + K * q[0], oy + K * q[1]]; }
  /* plus on monte, plus le contexte s'efface dans le fond */
  var r = cad.lvls.length > 1 ? cad.lvls.indexOf(n.lvl) / (cad.lvls.length - 1) : 0;
  var cl = ETAGES.clair[0] + (ETAGES.clair[1] - ETAGES.clair[0]) * r;
  t.decoupe([[z[0], z[1]], [z[2], z[1]], [z[2], z[3]], [z[0], z[3]]]);
  /* le bâtiment, et lui seul, sur fond noir : le poché extérieur de chaque corps */
  n.prims.forEach(function(p){ if(p.cl === "mur" && !p.ctx) t.poly(p.pts.map(P), { fill:pal.fond }); });
  /* tout le plan de l'écran : ses cotes, son échelle graphique et le nord
     — la planche est au 1:200 et le dit dans son titre */
  n.prims.forEach(function(p){
    if(p.ctx === "exist" && p.ferme){
      t.poly(p.pts.map(P), { fill:ETAGES.existant.map(function(v){ return v + (1 - v) * cl; }) });
      return;
    }
    trait(t, p, P, K, p.ctx ? cl : 0, 1, pal);
  });
  /* les étages inférieurs, en trait : le contour extérieur de chacun de leurs
     corps, par-dessus — on voit ce qui déborde dessous et ce qui porte */
  var D = ETAGES.dessous;
  cad.niveaux.forEach(function(m){
    if(m.lvl >= n.lvl) return;
    m.prims.forEach(function(p){ if(p.cl === "mur" && !p.ctx) t.poly(p.pts.map(P), { stroke:D.trait, lw:D.lw, dash:D.dash }); });
  });
  t.fin();
}

/* UN ÉLÉMENT DU PLAN, EN TRAIT, selon sa place dans la hiérarchie : le
   négatif d'un plan à l'encre. Dans le bâtiment, sur son fond noir : ce que
   la coupe tranche — murs extérieurs, cloisons, gaine — en POCHÉ gris
   (`NUIT.poche`), une cloison à son épaisseur réelle ; les sols et les
   percements rendent le fond ; tout le reste en trait blanc, de l'épaisseur
   de son rang (`TRAITS`, en mm) — menuiseries moyen, vu fin, au-dessus en
   tirets, axes en trait mixte, cotes très fin. Dehors (contexte, cotes,
   échelle, nord), l'encre sur le papier, qui s'efface vers lui. `map` place
   un point du site sur la feuille, `k` les points par mètre ; `efface` (0 à
   1) fond le trait du dehors dans le papier ; `ech` réduit les épaisseurs pour
   un dessin plus petit. */
export function trait(t, p, map, k, efface, ech, pal){
  var NUIT = pal || NUIT0;
  var dehors = p.ctx || p.g === "dim" || p.g === "echelle" || p.g === "nord";
  var c = (dehors ? NUIT.encre : NUIT.trait).map(function(v, i){ return v + (NUIT.papier[i] - v) * (dehors ? efface || 0 : 0); });
  if(p.k === "t"){
    /* un texte se lit toujours de bas en haut ou de gauche à droite */
    var rot = Math.cos(p.rot) < -1e-6 ? p.rot + Math.PI : p.rot, q = map([p.x, p.y]);
    t.texte(q[0], q[1], p.s, { size:p.size * k, gras:p.gras, fill:c, ancre:"middle", rot:rot });
    return;
  }
  var cl = p.cl || "", e = ech || 1, MM = 72 / 25.4, pts = p.pts.map(map);
  /* l'échelle graphique garde ses cases, noires et blanches */
  if(p.g === "echelle"){ t.poly(pts, { fill:p.fill, stroke:c, lw:TRAITS.cote * MM * e }); return; }
  if(!dehors){
    if(/\b(mur|poche)\b/.test(cl)){ if(p.fill) t.poly(pts, { fill:NUIT.poche }); return; }
    if(/\b(circ|gap|gapw|vide)\b/.test(cl)){ if(p.fill) t.poly(pts, { fill:NUIT.fond }); return; }
    if(/\b(room|cell|part|cagef)\b/.test(cl)){
      if(p.stroke && p.lw) t[p.ferme ? "poly" : "ligne"](pts, { stroke:NUIT.poche, lw:p.lw * k * e });
      return;
    }
  }
  if(!p.stroke){
    /* un plein sans trait — le triangle d'un niveau, le point d'une flèche */
    if(p.fill && /\b(niv|point|nord)\b/.test(cl)) t.poly(pts, { fill:c });
    return;
  }
  var w = TRAITS[p.w] != null ? p.w : "vu";
  var o = { stroke:c, lw:TRAITS[w] * MM * e };
  var d = w === "dessus" ? TRAITS.tirets : w === "axe" ? TRAITS.mixte : null;
  if(d) o.dash = d.map(function(v){ return v * MM * e; });
  else if(p.dashPx) o.dash = p.dashPx.map(function(v){ return v * PX * e; });
  t[p.ferme ? "poly" : "ligne"](pts, o);
}
