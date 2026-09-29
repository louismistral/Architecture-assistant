/* ============================================================================
   LES PLANCHES DU RENDU — SOURCE UNIQUE

   L'onglet Rendu a un volet par étape du projet ; chaque volet rend ses
   planches en PDF, au format d'impression. Ici : les étapes, les formats, la
   base du plan de situation et son calage, la palette d'impression.
   ========================================================================= */

/* Les volets, dans l'ordre des onglets. `pret` : ses planches existent. */
export var ETAPES = [
  { id:"massing",     n:"Massing",     pret:true },
  { id:"typologies",  n:"Typologies" },
  { id:"tectonics",   n:"Tectonics" },
  { id:"materiality", n:"Materiality" },
  { id:"final",       n:"Rendu final" }
];

/* Formats ISO paysage, en points (1 pt = 1/72 po). */
var MM = 72 / 25.4;
export var FORMATS = { A2: { n:"A2", w:594 * MM, h:420 * MM } };

/* LA BASE DU PLAN DE SITUATION — `DOC/site-plan_base.pdf`, A2 au 1:500.
   Le calage a été mesuré sur la parcelle rouge du PDF contre `PER` : même
   orientation, 1 m = 2 mm = 5,669 pt, écart maximal 0,1 mm sur ses 26 sommets.
   x_pdf = ox + k·x, y_pdf = oy + k·y (y vers le haut, repère du PDF). */
var ECHELLE = 500;   /* le plan de situation est au 1:500, et ne change jamais */
export var BASE = {
  pdf: "DOC/site-plan_base.pdf",
  apercu: "DOC/site-plan_base.jpg",   /* le même, en image, pour l'écran */
  format: "A2", echelle: ECHELLE,
  k: 1000 / ECHELLE * MM, ox: 277.546, oy: 249.798,
  /* l'échelle graphique : ses graduations en mètres, calée à gauche du nord
     de la base (fin de la barre à x = `fin`, en points, à la hauteur `y`) */
  barre: { m:[0, 5, 10, 20, 30, 40, 50], fin:1522, y:24 }
};

/* La palette d'impression, en RVB 0–1 : celle de la base (routes, ombres,
   toitures blanches), relevée dans le PDF. */
export var ENCRE = {
  noir: [0, 0, 0], blanc: [1, 1, 1], ombre: [0.41, 0.41, 0.41],
  trait: [0.41, 0.41, 0.41], fin: [0.6, 0.6, 0.6], rouge: [0.85, 0.2, 0.18],
  /* les diagrammes, à la manière de la planche de référence (`diagramme.pdf`) :
     le volume saumon et ses flancs brique, le contexte gris */
  volume: [0.96, 0.66, 0.55], flanc: [0.8, 0.3, 0.17], contexte: [0.9, 0.9, 0.9],
  fantome: [0.99, 0.9, 0.86], soleil: [0.98, 0.72, 0.1],
  /* l'ombre portée d'un volume : décalage par mètre de hauteur, vers le SE */
  ombreParM: [0.3, -0.3]
};
