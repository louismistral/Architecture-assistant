/* ============================================================================
   LES PARAMÈTRES DU GÉNÉRATEUR — LA MACHINE, PAS LE BÂTIMENT

   Ni un levier (rien de ce qui est ici ne se voit sur le bâtiment), ni une
   contrainte (rien ici ne dit ce qui est bon) : combien d'essais, quelle
   seed, et le DOSAGE entre le hasard et l'orientation — ce qui fait que la
   recherche explore au lieu de rendre toujours la même chose.

   Réglés par le groupe, comme avant : deux membres qui rejouent la même seed
   doivent obtenir le même bâtiment. Les seeds, elles, sont à chacun — elles
   désignent la composition à l'écran.
   ========================================================================= */
import { V, declarer } from "./lignes.js";
export { V };

var G = { t:"generateur" };

export var RECHERCHE = [
  /* --- le mixer --- */
  { id:"hasard-mix", role:"recherche", sujet:"Hasard", onglet:"mixer", src:G, qui:"groupe",
    n:"Part du hasard — répartition", k:"temperature", def:0.30, min:0, max:1, pas:0.05,
    unite:"0 = l'orientation seule", lu:"src/mix/shuffle.js — bruit()",
    d:"Un bruit de Gumbel s'ajoute à la note de chaque niveau candidat : à 0, le Shuffle rend "
      + "toujours la même répartition, la mieux orientée ; à 1, il pose presque n'importe où. "
      + "C'est le seul endroit d'où vient la variation d'une répartition à l'autre." },
  { id:"bruit", role:"recherche", sujet:"Hasard", onglet:"mixer", src:G, qui:"code",
    n:"Échelle du bruit", k:"bruitEchelle", def:40, unite:"points de note à hasard 1",
    lu:"src/mix/shuffle.js — bruit()",
    d:"Convertit la part du hasard en points de note : à 0,30, le bruit vaut 12 points, "
      + "moins que la place restante (30) et plus qu'une famille d'usage (10)." },
  { id:"marge", role:"recherche", sujet:"Plateau", onglet:"mixer", src:G, qui:"groupe",
    n:"Jeu d'un plateau déduit", k:"margePlateau", def:1.08, min:1, max:1.5, pas:0.01,
    unite:"× la surface portée", lu:"src/mix/shuffle.js — pilesAdmissibles()",
    d:"Sans ce jeu, la répartition est coincée au mètre carré près et le moindre arrondi déborde." },
  { id:"seed-mix", role:"recherche", sujet:"Seed", onglet:"mixer", src:G, qui:"chacun",
    n:"Seed du programme", val:"affichée au mixer, retapée pour rejouer",
    lu:"src/core/rand.js — curSeed",
    d:"Rend une répartition REJOUABLE : sans seed, on tire dix fois et la troisième, qui était "
      + "la bonne, n'existe plus." },

  /* --- le massing --- */
  { id:"essais", role:"recherche", sujet:"Essais", onglet:"massing", src:G, qui:"groupe",
    n:"Compositions essayées", k:"essais", def:40, min:5, max:300, pas:5, unite:"essais",
    lu:"src/mass/gen.js — genMass()",
    d:"Plus d'essais, plus de variantes valides parmi lesquelles choisir, et un tirage plus lent." },
  { id:"essais-parti", role:"recherche", sujet:"Essais", onglet:"massing", src:G, qui:"groupe",
    n:"Reconnaissance par parti, en libre", k:"essaisParti", def:10, min:1, max:20, pas:1,
    unite:"essais", lu:"src/mass/gen.js — genMass()",
    d:"Parti libre : chaque parti est essayé d'abord ; seuls ceux qui rendent une variante "
      + "valide reçoivent la suite des essais." },
  { id:"hasard-mass", role:"recherche", sujet:"Hasard", onglet:"massing", src:G, qui:"groupe",
    n:"Part du hasard — volumétrie", k:"hasardMass", def:0.20, min:0, max:1, pas:0.05,
    unite:"0 = l'orientation seule", lu:"src/mass/gen.js — retenir()",
    d:"Entre deux variantes valides, le générateur retient celle que l'orientation préfère, "
      + "à ce dosage de hasard près : à 0, toujours la mieux orientée ; à 1, n'importe laquelle. "
      + "Les propositions retenues sont ensuite classées par le JUGEMENT." },
  { id:"force-prio", role:"recherche", sujet:"Orientation", onglet:"tous", src:G, qui:"groupe",
    n:"Ce que pèse une orientation prioritaire", k:"forcePrio", def:5, min:1, max:20, pas:1,
    unite:"× une souhaitée", lu:"src/data/orientation.js — force()",
    d:"Une ligne Prioritaire compte pour autant de lignes Souhaitées : c'est ce qui fait qu'on "
      + "n'y renonce que sans autre issue, et qu'une souhaitée ne fait que départager." },
  { id:"jeu", role:"recherche", sujet:"Implantation", onglet:"massing", src:G, qui:"code",
    n:"Jeu d'orientation d'une figure", k:"jeuAngle", def:0.11, unite:"rad autour de l'angle tiré",
    lu:"src/mass/gen.js — implanter()",
    d:"Sans lui, les compositions d'un même parti tournées du même angle seraient la même." },
  { id:"seed-mass", role:"recherche", sujet:"Seed", onglet:"massing", src:G, qui:"chacun",
    n:"Seed du massing", val:"affichée sous « Shuffle massing », retapée pour rejouer",
    lu:"src/mass/model.js — MASS.graine",
    d:"Distincte de celle du programme : l'une rejoue une RÉPARTITION, l'autre une IMPLANTATION." }
];
declarer(RECHERCHE);
