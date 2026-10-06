/* ============================================================================
   LA CONVENTION DE CALQUES — le contrat entre l'app et les logiciels

   Tout ce qui SORT de l'app (le .3dm du massing, le DXF des planches) se range
   ici ; tout ce qui y REVIENT se lit d'ici. Les humains la suivent dans Rhino,
   Claude aussi (par le MCP Rhino ou par l'outil), l'export l'écrit, l'import la
   lit : un fichier qui la respecte se relit sans qu'on sache qui l'a fait, ni
   où. Voir `docs/echange.md`.

   L'arbre a cinq calques mères. Chaque mère peut porter des sous-calques, à
   toute profondeur ; l'arbre ÉVOLUE — un calque qui manque se crée, et ce qui
   n'a pas encore sa place va dans AUTRE, qu'on classera plus tard.

     AIDE        ce qui aide à dessiner et ne revient jamais : périmètre, recul
     BLOCKS
     2D          Courbes (une épaisseur par sous-calque), Hatchs, Textes
     3D          Projet (Volume — le seul relu au massing —, Architecture),
                 Contexte (terrain, existants)
     AUTRE

   Le séparateur est celui de Rhino, « :: ». AutoCAD refuse « : » dans un nom
   de calque : le DXF écrit le chemin avec « $ ».
   ========================================================================= */

export var SEP = "::";
export var SEP_DXF = "$";

export var MERES = ["AIDE", "BLOCKS", "2D", "3D", "AUTRE"];

/* Les calques qu'on nomme dans le code. Les sous-calques de Volume (un par
   chapitre, puis un par niveau) se déduisent du programme à l'export. */
export var CALQUE = {
  aide:        "AIDE",
  courbes:     "2D::Courbes",
  hatchs:      "2D::Hatchs",
  textes:      "2D::Textes",
  projet:      "3D::Projet",
  volume:      "3D::Projet::Volume",
  architecture:"3D::Projet::Architecture",
  contexte:    "3D::Contexte",
  autre:       "AUTRE"
};

/* LES ÉPAISSEURS, de XS à XL, en mm sur le papier. XXS a l'épaisseur de XS,
   en gris : le trait d'arrière-plan (courbes, existants, trames). Six
   sous-calques de Courbes au lieu d'un calque par épaisseur rencontrée. */
export var TAILLES = [
  { n:"01 XXS", mm:.06, gris:1 },
  { n:"02 XS",  mm:.06 },
  { n:"03 S",   mm:.13 },
  { n:"04 M",   mm:.18 },
  { n:"05 L",   mm:.25 },
  { n:"06 XL",  mm:.35 }
];
/* Un trait plus clair que ça, à l'épaisseur de XS, est un XXS (0 noir, 1 blanc). */
export var CLAIR_XXS = .35;

/* CE QUI EST GÉNÉRÉ — par l'algorithme ou par une IA — a cette couleur, forcée
   sur l'objet, dans les fichiers exportés seulement ; ce qu'un humain dessine
   garde la couleur de son calque. Mêmes calques pour les deux : la couleur
   dit QUI, le calque dit QUOI. À l'import, un objet bleu est généré, un autre
   a été dessiné ou retouché à la main. */
export var GENERE = [0, 90, 255];

/* ---------- les trois règles qui s'en lisent ---------- */
export function chemin(){ return [].slice.call(arguments).filter(Boolean).join(SEP); }
/* Le sous-calque de Courbes d'un trait : la taille la plus proche de son
   épaisseur (mm), XXS si c'est un XS clair (`lum` de 0, noir, à 1, blanc). */
export function tailleDe(mm, lum){
  var t = TAILLES[1];
  TAILLES.forEach(function(x){ if(!x.gris && Math.abs(x.mm - mm) < Math.abs(t.mm - mm)) t = x; });
  return t === TAILLES[1] && lum > CLAIR_XXS ? TAILLES[0] : t;
}
/* Un objet de cette couleur (0–255) a été généré. */
export function estGenere(c){
  return !!c && Math.abs(c.r - GENERE[0]) + Math.abs(c.g - GENERE[1]) + Math.abs(c.b - GENERE[2]) < 12;
}
