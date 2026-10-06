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
  { id:"final",       n:"Rendu final", pret:true }
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
  schemesTitre: 82,
  /* la seconde page : « Axonometry » (l'axonométrie du volume à gauche,
     l'éclatée à droite) et « Representative Floor plan 1:200 » (le plan du
     rez des Typologies, au 1:200) ; sous leurs titres */
  axonometrie: [36.5, 677.98, 1027.6, 1527.38], axonometrieTitre: 100,
  plans: [1070, 36.48, 2344.6, 1527.38], plansTitre: 150
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
  clair: [0.15, 0.85],
  /* l'existant, en aplat gris très clair sans trait — comme dans
     l'axonométrie du volume — et qui pâlit lui aussi en montant */
  existant: [0.84, 0.84, 0.83],
  /* les étages inférieurs, en trait : le contour de chacun sous le plan */
  dessous: { trait:[0.55, 0.55, 0.55], lw:0.7, dash:[5, 3] }
};

/* LES AXONOMÉTRIES DES TYPOLOGIES — le volume entier, et le même éclaté
   niveau par niveau : chaque plan des Typologies posé sur sa dalle. Deux
   niveaux s'écartent de `pas` fois la profondeur du plan dans la vue — à 1
   ils ne se couvrent plus du tout, au-delà un blanc les sépare — et de
   `ecart` m au moins. */
export var AXO = { format:"A1", ecart:10, pas:1.15, dalle:0.4,
  /* l'éclatée empile ses niveaux : la feuille est en hauteur */
  eclateePortrait:true,
  /* les murs, coupés à `murs` m au-dessus de la dalle : 40 cm dehors, 10 cm
     dedans — l'épaisseur des cloisons ; dessus poché, flancs gris */
  murs:1.0, cloison:0.10,
  /* les noms écrits sur l'axonométrie du volume, et rien d'autre : un par
     chapitre du programme ; dans les infrastructures, la piscine se nomme,
     le local CAD rejoint les locaux techniques */
  /* l'existant, en volumes pleins sans trait : dessus, flancs */
  existant:[[0.97, 0.97, 0.96], [0.91, 0.91, 0.9], [0.86, 0.86, 0.85]],
  noms:{ ecole:"École primaire", sport:"Salle de sport", uape:"UAPE",
         tech:"Locaux techniques", piscine:"Piscine" } };

/* LA HIÉRARCHIE DES TRAITS — SOURCE UNIQUE, en mm sur le papier. Un plan
   dont tous les traits pèsent pareil ne se lit pas : ce que la coupe tranche
   (murs, poteaux — pochés, et leur contour) le plus fort ; les menuiseries
   coupées (cadres de portes et de fenêtres) moyen ; ce qu'on voit sous la
   coupe (sol, marches, mobilier, allèges) fin ; ce qui est au-dessus ou caché
   (porte-à-faux, marches au-delà de la coupe) fin en tirets ; les axes fin en
   trait mixte ; cotes et textes très fin. L'écran les lit à 96 px par pouce
   (`plans.html`, comme imprimé à 100 %), les planches en points (`trait()`,
   `etages.js`) : une seule table pour les deux. */
export var TRAITS = { coupe:0.50, menuiserie:0.25, vu:0.18, dessus:0.18, axe:0.13, cote:0.09,
  /* les motifs, en mm : tirets (au-dessus, caché), trait mixte (axes) */
  tirets:[1.5, 1.0], mixte:[4, 1, 0.5, 1] };

/* LE TRAIT BLANC SUR NOIR — les plans d'étage et l'axonométrie éclatée : la
   feuille est BLANCHE ; notre bâtiment est sur fond noir, en lignes blanches,
   et ce que la coupe tranche — murs, cloisons — en POCHÉ gris : le négatif
   d'un plan à l'encre, où les murs se lisent d'abord. Ce qui est dehors — le
   contexte, les cotes, les titres — est à l'encre noire sur le papier ; le
   contexte s'efface vers le papier. Les épaisseurs : `TRAITS`. */
export var NUIT = { fond:[0, 0, 0], trait:[1, 1, 1], papier:[1, 1, 1], encre:[0, 0, 0], gris:[0.45, 0.45, 0.45],
  poche:[0.62, 0.62, 0.62] };

/* LE TRAIT NOIR SUR BLANC — le rendu final : le règlement (art. 1.21) veut
   les plans, coupes et façades « exclusivement au trait noir sur fond blanc ».
   Le positif de `NUIT` : ce que la coupe tranche, en poché noir. */
export var JOUR = { fond:[1, 1, 1], trait:[0, 0, 0], papier:[1, 1, 1], encre:[0, 0, 0], gris:[0.45, 0.45, 0.45],
  poche:[0, 0, 0] };

/* LE RENDU FINAL — art. 1.20 et 1.21 du règlement : au plus cinq planches A1
   paysage, affichées selon son schéma (1 Situation, 2, 3 en haut ; la
   maquette ; 4, 5 en bas).
     1  situation 1:500, sur la base du géomètre (`DOC/final_base.pdf`,
        engendré par `tools/final-base.py` à partir de ce calage)
     2  le plan du rez 1:200, avec les aménagements extérieurs
     3  les plans des autres niveaux 1:200
     4  les façades et les coupes 1:200, horizontales, terrain naturel et cotes
     5  la planche explicative
   Toutes portent « Concours CS Saxon » et la DEVISE — l'anonymat (art. 1.22) :
   à remplacer par celle du groupe, et rien qui nous nomme. */
export var FINAL = {
  format: "A1", echelle: 200,
  devise: "DEVISE",
  pdf: "DOC/final_base.pdf", apercu: "DOC/final_base.jpg",
  marge: 15 * MM, cartouche: 22 * MM,
  /* m de plan autour du bâti d'un niveau, pour ses cotes */
  autour: 7,
  /* les coupes, schématiques : dalle et mur, en m */
  dalle: 0.35, mur: 0.4,
  /* m de terrain dessiné au-delà du bâti, dans les façades et coupes */
  terrain: 10
};
(function(){
  var F = FORMATS[FINAL.format], m = FINAL.marge;
  FINAL.situation = [m, m + FINAL.cartouche, F.w - m, F.h - m];
  var xs = PER.map(function(p){ return p[0]; }), ys = PER.map(function(p){ return p[1]; }), c = FINAL.situation;
  FINAL.calage = { k: BASE.k,
    ox: (c[0] + c[2]) / 2 - BASE.k * (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2,
    oy: (c[1] + c[3]) / 2 - BASE.k * (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2 };
})();

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
