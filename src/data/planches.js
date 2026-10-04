/* ============================================================================
   LES PLANCHES DU RENDU — SOURCE UNIQUE

   L'onglet Rendu a un volet par étape du projet ; chaque volet rend ses
   planches en PDF, au format d'impression. Ici : les étapes, les formats, la
   base du plan de situation et son calage, la palette d'impression.
   ========================================================================= */

import { PER } from "./site.js";

/* Les volets, dans l'ordre des onglets. `pret` : ses planches existent. */
export var ETAPES = [
  { id:"massing",     n:"Massing",     pret:true },
  { id:"typologies",  n:"Typologies",  pret:true },
  { id:"tectonics",   n:"Tectonics" },
  { id:"materiality", n:"Materiality" },
  { id:"midterm",     n:"Midterm rendu", pret:true },
  { id:"final",       n:"Rendu final" }
];

/* Formats ISO paysage, en points (1 pt = 1/72 po). */
var MM = 72 / 25.4;
export var FORMATS = { A0: { n:"A0", w:1189 * MM, h:841 * MM }, A1: { n:"A1", w:840 * MM, h:594 * MM },
                       A2: { n:"A2", w:594 * MM, h:420 * MM }, A3: { n:"A3", w:420 * MM, h:297 * MM } };

/* LA BASE DU PLAN DE SITUATION — `DOC/site-plan_base.pdf`, A2 au 1:500.
   Le calage a été mesuré sur la parcelle rouge du PDF contre `PER` : même
   orientation, 1 m = 2 mm = 5,669 pt, écart maximal 0,1 mm sur ses 26 sommets.
   x_pdf = ox + k·x, y_pdf = oy + k·y (y vers le haut, repère du PDF). */
var ECHELLE = 500;   /* le plan de situation est au 1:500, et ne change jamais */
export var BASE = {
  pdf: "DOC/site-plan_base.pdf",
  apercu: "DOC/site-plan_base.jpg",   /* le même, en image, pour l'écran */
  format: "A2", echelle: ECHELLE,
  k: 1000 / ECHELLE * MM, ox: 277.546, oy: 249.798
};

/* LE MIDTERM — deux planches A1 sur le gabarit `DOC/MID_TERM.pdf`, suivi à la
   lettre. Ses cadres, relevés dans le gabarit, en points, y vers le HAUT.
   `DOC/midterm_base.pdf` est le gabarit avec, dans le cadre « Site Plan », la
   base du géomètre au 1:500, nord en haut, la parcelle centrée : il s'engendre
   par `tools/midterm-base.py`, qui lit ce calage-ci. */
export var MIDTERM = {
  gabarit: "DOC/MID_TERM.pdf",
  pdf: "DOC/midterm_base.pdf",
  apercu: "DOC/midterm_base.jpg",
  /* la seconde page, telle que le gabarit la donne : un aperçu, rien à poser */
  apercu2: "DOC/midterm_base-2.jpg",
  format: "A1",
  situation: [36.5, 54.38, 1027.6, 1527.38],
  schemes: [1070, 649.68, 2344.6, 1073.88],
  /* sous le titre « Schemes » du gabarit */
  schemesTitre: 82
};
/* La parcelle au centre du cadre, à l'échelle de la base : x = ox + k·x_site. */
MIDTERM.calage = (function(){
  var xs = PER.map(function(p){ return p[0]; }), ys = PER.map(function(p){ return p[1]; }), c = MIDTERM.situation;
  return { k: BASE.k,
    ox: (c[0] + c[2]) / 2 - BASE.k * (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2,
    oy: (c[1] + c[3]) / 2 - BASE.k * (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2 };
})();

/* LES PLANS D'ÉTAGE — un PDF par niveau, au 1:200, le plan des Typologies tel
   quel, sur son contexte. Le format est le plus petit qui tient TOUS les
   niveaux, le même pour tous : les planches se superposent. Le contexte
   s'éclaircit en montant : `clair` va du niveau le plus bas au plus haut
   (0 = tel qu'à l'écran, 1 = blanc). */
export var ETAGES = {
  echelle: 200,
  formats: ["A3", "A2", "A1", "A0"],
  marge: 15 * MM,          /* le bord de la feuille */
  cartouche: 22 * MM,      /* la bande du titre, en bas */
  autour: 6,               /* m de contexte autour du bâti, au moins */
  clair: [0.15, 0.85]
};

/* LES AXONOMÉTRIES DES TYPOLOGIES — le volume entier, et le même éclaté
   niveau par niveau : chaque plan des Typologies posé sur sa dalle. Deux
   niveaux s'écartent de `pas` fois la profondeur du plan dans la vue — à 1
   ils ne se couvrent plus du tout, au-delà un blanc les sépare — et de
   `ecart` m au moins. */
export var AXO = { format:"A1", ecart:10, pas:1.15, dalle:0.4,
  /* l'éclatée empile ses niveaux : la feuille est en hauteur */
  eclateePortrait:true,
  /* les murs, coupés à `murs` m au-dessus de la dalle : 50 cm dehors, 10 cm
     dedans — l'épaisseur des cloisons ; dessus poché, flancs gris */
  murs:1.0, cloison:0.10,
  /* les noms écrits sur l'axonométrie du volume, et rien d'autre : un par
     chapitre du programme ; dans les infrastructures, la piscine se nomme,
     le local CAD rejoint les locaux techniques */
  /* l'existant, en volumes pleins sans trait : dessus, flancs */
  existant:[[0.97, 0.97, 0.96], [0.91, 0.91, 0.9], [0.86, 0.86, 0.85]],
  noms:{ ecole:"École primaire", sport:"Salle de sport", uape:"UAPE",
         tech:"Locaux techniques", piscine:"Piscine" } };

/* LE TRAIT BLANC SUR NOIR — les plans d'étage et l'axonométrie éclatée : fond
   noir, tout en lignes blanches, aucun aplat ni hachure. Le contexte s'efface
   vers le fond. */
export var NUIT = { fond:[0, 0, 0], trait:[1, 1, 1], gris:[0.6, 0.6, 0.6] };

/* La palette d'impression, en RVB 0–1 : celle de la base (routes, ombres,
   toitures blanches), relevée dans le PDF. */
export var ENCRE = {
  noir: [0, 0, 0], blanc: [1, 1, 1], ombre: [0.41, 0.41, 0.41],
  trait: [0.41, 0.41, 0.41], fin: [0.6, 0.6, 0.6], rouge: [0.85, 0.2, 0.18],
  /* les diagrammes, à la manière de BIG : volumes blancs aux flancs gris, un
     sol à peine teinté, et UNE couleur pour ce que l'étape change */
  sol: [0.94, 0.94, 0.93], cote: [0.86, 0.86, 0.86], cote2: [0.76, 0.76, 0.76],
  accent: [0.95, 0.38, 0.12], soleil: [0.98, 0.72, 0.1],
  /* l'ombre portée d'un volume : décalage par mètre de hauteur, vers le SE */
  ombreParM: [0.3, -0.3]
};
