import { el } from "../core/format.js";
import { s } from "../core/svg.js";

export var panelsEl = document.getElementById("panels");

/* La barre d'échelle vivait dans le chrome global, donc affichée sur les cinq
   onglets — alors qu'elle ne décrit que les dessins du programme. Sur le
   schéma elle était fausse de 24 %, et sur le site d'un facteur 2, où une
   SECONDE barre d'échelle, elle juste, s'affichait en même temps. Elle
   appartient à la vue qu'elle mesure, et prend l'échelle de celle-ci : `k`
   pixels par mètre, `m` mètres en quatre segments. */
export function scaleBar(k, m){
  var box = el("div","scalebar");
  var seg = m / 4 * k, W = seg * 4;
  var sb = s("svg", { width: Math.ceil(W) + 1, height: 16, viewBox: "0 0 " + (Math.ceil(W) + 1) + " 16",
    role: "img", "aria-label": "Barre d’échelle de " + m + " mètres" });
  for(var i = 0; i < 4; i++){
    sb.appendChild(s("rect", { x: i * seg + .5, y: 4, width: seg, height: 6,
      fill: i % 2 ? "var(--panel)" : "var(--ink-2)", stroke: "var(--ink-2)", "stroke-width": 1 }));
  }
  box.appendChild(sb);
  box.appendChild(el("span","cap mono", m + " m"));
  return box;
}

/* La circulation n'est pas un poste du programme : elle n'a ni numéro d'article
   ni famille d'usage. Elle est pourtant une surface — la dessiner à l'échelle
   avec les locaux est la seule façon de voir ce qu'elle pèse. Elle se hachure,
   sans couleur de famille, comme sa pastille de légende ; le technique se
   hachure aussi, sur son aplat, comme en dessin d'architecture.

   Les deux trames sont définies UNE fois par vue, dans un SVG sans taille : un
   motif référencé par `url(#…)` sert tous les dessins du document.
   `--hatch-ink` est l'encre de la hachure, et elle suit le thème. */
export var CIRCPAT = "diagcirc";
export function hatchDefs(){
  var svg = s("svg", { width: 0, height: 0, "aria-hidden": "true", focusable: "false",
    "class": "hatchdefs" });
  var defs = s("defs");
  var pc = s("pattern", { id: CIRCPAT, width: 5, height: 5,
    patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
  pc.appendChild(s("line", { x1: 0, y1: 0, x2: 0, y2: 5, stroke: "var(--hatch-ink)", "stroke-width": 1 }));
  var pt = s("pattern", { id: CIRCPAT + "-tec", width: 5, height: 5,
    patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
  pt.appendChild(s("rect", { width: 5, height: 5, fill: "var(--f-tec)", "fill-opacity": "var(--fill-op)" }));
  pt.appendChild(s("line", { x1: 0, y1: 0, x2: 0, y2: 5, stroke: "var(--hatch-ink)", "stroke-width": 1 }));
  defs.appendChild(pc); defs.appendChild(pt);
  svg.appendChild(defs);
  return svg;
}
