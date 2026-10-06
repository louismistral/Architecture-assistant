/* ============================================================================
   LES LEVIERS — QUE FAIT-ON VARIER ?

   Seuls les leviers sont tirés. Chacun a un DOMAINE — une plage, ou des
   options — et un ÉTAT : FIXE, la valeur est la nôtre et le générateur la
   respecte ; LIBRE, le hasard la tire dans le domaine, à parts égales entre
   les options. Il n'y a pas de probabilité par option : ce que l'on préfère
   dans le domaine est une ORIENTATION, et c'est elle qui choisit entre deux
   candidats.

   Qui règle quoi : l'état fixe ou libre suit chacun — c'est la composition à
   l'écran, enregistrée avec elle, comme les dés du mixer. Le DOMAINE est au
   groupe : tout le monde cherche dans le même espace.

   Où vivent les états :
     le mixer     `mix/opts.js` — la pile, avec son dé ;
     le massing   `mass/model.js — MASS` — le parti (`auto` = libre), le second
                  temps (`auto` = libre), et `MASS.lev` pour le reste (`null` =
                  libre).
   ========================================================================= */
import { V, declarer } from "./lignes.js";
export { V };

var G = { t:"generateur" };

export var LEVIERS = [
  /* ---- le mixer ---- */
  { id:"lev-pile", sujet:"Pile", onglet:"mixer", src:G,
    n:"Nombre de niveaux", val:"les piles que le site admet — voir le cadre : plateau, étages, sous-sol",
    etat:"sur la pile, au mixer · dé allumé par défaut", lu:"src/mix/shuffle.js — proposerPile()",
    d:"Dé allumé, la pile est tirée parmi les piles admissibles, la plus compacte d'abord "
      + "(orientation « pile compacte ») ; éteint, elle reste celle qu'on a composée." },
  { id:"lev-murs", sujet:"Murs", onglet:"mixer", src:{ t:"hypothese", a:"— SIA 416, surface de construction" },
    n:"Part des murs", k:"partMurs", def:0.10, min:0, max:0.25, pas:0.01, pct:1,
    unite:"de la surface brute d'un niveau",
    etat:"au groupe · une estimation", lu:"src/mix/floors.js — flMurs(), usable() · src/mix/shuffle.js — pilesAdmissibles()",
    d:"Ce que les murs prennent au plateau : murs extérieurs de 40 cm et cloisons de 10 cm, "
      + "environ 10 % de la surface brute d'une école (surface de construction, SIA 416). Le "
      + "plateau du mixer est BRUT — pièces, circulation et murs ; le Massing, lui, dessine ses "
      + "murs autour des volumes et ne reçoit que les pièces et la circulation." },

  /* ---- le massing ---- */
  { id:"lev-parti", sujet:"Parti", onglet:"massing", src:G,
    n:"Le parti", val:"les onze partis — bloc compact, barre, barres, L, U, cour, pavillons, hameau, terrasses, peigne, libre",
    etat:"« Type de massing » au rail · Auto = libre", lu:"src/mass/gen.js — genMass() · src/mass/partis.js",
    d:"Libre, tous les partis sont essayés et chacun garde sa meilleure proposition ; fixe, "
      + "la figure a la structure de son parti — `signature()` le vérifie : c'est ce que veut "
      + "dire l'option, pas une contrainte sur le bâtiment." },
  { id:"lev-figure", sujet:"Parti", onglet:"massing", src:G,
    n:"La figure du parti", val:"longueur et asymétrie des ailes, nombre de volumes, hauteurs, écarts",
    etat:"toujours libre · la seed la fige", lu:"src/mass/partis.js — FIG, besoins()",
    d:"L'identité du parti reste, sa forme varie : chaque cote est tirée dans les directives "
      + "du parti. Un volume de plus par classe de hauteur, une fois sur deux." },
  { id:"lev-prof", sujet:"Dimensions des corps", onglet:"massing", src:G,
    n:"Profondeur des corps", k:"profMin", def:11, min:1, max:100, pas:0.5, unite:"m au moins — murs compris",
    etat:"au rail · libre : tirée dans le domaine", lu:"src/mass/model.js — profBornes() · src/mass/gen.js — essai()",
    d:"Le petit côté d'un corps. Pas de maximum réglé : il vient de la profondeur de façade "
      + "des classes (le cadre)." },
  { id:"lev-larg", sujet:"Dimensions des corps", onglet:"massing", src:G,
    n:"Largeur des corps", k:"largeurMin", def:11, min:1, max:200, pas:0.5, unite:"m au moins — murs compris",
    etat:"toujours libre · suit la surface et la profondeur", lu:"src/mass/partis.js — besoins()",
    d:"Le grand côté. Pas de maximum réglé : un niveau se partage entre plus de volumes quand "
      + "un corps passerait l'élancement souhaité (orientation « élan »)." },
  { id:"lev-sport", sujet:"Salle de sport", onglet:"massing", src:G,
    n:"Salle de sport accolée ou à part", val:"accolée au corps principal · à part, sur le bas du site",
    etat:"au rail · libre : une chance sur deux", lu:"src/mass/gen.js — placerSport()",
    d:"Accolée, elle fait partie du bâtiment ; à part, elle se pose sur le bas du terrain. "
      + "Tant que la scène doit lui être collée (le cadre), elle est toujours accolée." },
  { id:"lev-ponts", sujet:"Connexions", onglet:"massing", src:G,
    n:"Passerelles", k:"passMax", def:24, min:6, max:60, pas:1, unite:"m au plus",
    etat:"au rail · libre : une chance sur deux", lu:"src/mass/gen.js — relier()",
    d:"Entre corps d'école non reliés, la plus courte d'abord, jusqu'à ce que l'école tienne "
      + "d'un seul tenant. Le domaine est leur longueur." },
  { id:"lev-second", sujet:"Second temps", onglet:"massing", src:{ t:"reglement", a:"2.2" },
    n:"Piscine et local CAD", val:"réunis en un volume · séparés",
    etat:"au rail · libre : réunis ou séparés", lu:"src/mass/gen.js — poserSecond()",
    d:"Indépendants de l'école et bâtis plus tard. Libre, le générateur essaie les deux façons "
      + "de les poser. Ils sont toujours dessinés (le cadre, ligne « second »)." }
];
/* L'état fixe ou libre est à chacun ; un levier qui a un domaine chiffré le
   tient du groupe. */
LEVIERS.forEach(function(x){ x.role = "levier"; x.qui = x.k ? "mixte" : "chacun"; });
declarer(LEVIERS);

/* Les options d'un levier du massing, et la valeur qui veut dire « libre ». */
export var OPTIONS = {
  sport: [{ id:"accolee", n:"Accolée" }, { id:"part", n:"À part" }],
  ponts: [{ id:"oui", n:"Avec" }, { id:"non", n:"Sans" }]
};
