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

/* LA COULEUR DIT QUI, LE CALQUE DIT QUOI. Trois acteurs, trois PLAGES qui ne
   se recouvrent pas — chacun joue dans la sienne (des nuances aident le
   dessin), sans en sortir ; on n'en prend que ce qu'il faut :
     ia      des BLEUS — une IA (Claude, dans l'app ou par le MCP Rhino) ;
     algo    des ORANGES — l'app seule, sans autre geste humain que le Shuffle ;
     humain  des GRIS, du noir au gris clair — ce qu'une personne a dessiné ou
             retouché ; c'est aussi la couleur des calques, donc « Par calque ».
   Teinte en degrés, saturation et luminosité de 0 à 1 (HSL). Une couleur
   saturée hors des deux teintes, ou trop pâle, n'est à personne : l'import la
   compte comme humaine — c'est une main qui l'a choisie. Les plages servent
   aux fichiers échangés (.3dm, DXF) ; l'app garde ses couleurs. */
export var ACTEURS = {
  ia:     { n:"IA",          h:[200, 235], s:.6, l:[.35, .65] },
  algo:   { n:"algorithme",  h:[18, 38],   s:.75, l:[.40, .65] },
  humain: { n:"humain",      s:0,          l:[0, .75] }
};
/* au-delà, un gris n'est plus un gris ; en deçà, une couleur n'en est pas une */
export var SAT_GRIS = .12, SAT_COULEUR = .35;

/* ---------- les règles qui s'en lisent ---------- */
export function chemin(){ return [].slice.call(arguments).filter(Boolean).join(SEP); }
/* Le sous-calque de Courbes d'un trait : la taille la plus proche de son
   épaisseur (mm), XXS si c'est un XS clair (`lum` de 0, noir, à 1, blanc). */
export function tailleDe(mm, lum){
  var t = TAILLES[1];
  TAILLES.forEach(function(x){ if(!x.gris && Math.abs(x.mm - mm) < Math.abs(t.mm - mm)) t = x; });
  return t === TAILLES[1] && lum > CLAIR_XXS ? TAILLES[0] : t;
}
/* Une couleur de la plage d'un acteur, en octets [r, g, b] ; `k` de 0 à 1 la
   place dans la plage, du plus sombre au plus clair (et le long de la teinte). */
export function couleur(acteur, k){
  var A = ACTEURS[acteur], t = Math.max(0, Math.min(1, k || 0));
  var h = A.h ? A.h[0] + t * (A.h[1] - A.h[0]) : 0, l = A.l[0] + t * (A.l[1] - A.l[0]);
  var c = (1 - Math.abs(2 * l - 1)) * A.s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  var q = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return q.map(function(v){ return Math.round(255 * (v + m)); });
}
/* L'acteur d'une couleur `{ r, g, b }` (0–255) : « ia », « algo », « humain ». */
export function acteurDe(c){
  if(!c) return "humain";
  var r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  var l = (mx + mn) / 2, d = mx - mn, s = d ? d / (1 - Math.abs(2 * l - 1)) : 0, h = 0;
  if(s <= SAT_GRIS) return "humain";
  if(mx === r) h = 60 * (((g - b) / d) % 6); else if(mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4);
  if(h < 0) h += 360;
  if(s >= SAT_COULEUR) for(var k in ACTEURS){
    var A = ACTEURS[k];
    if(A.h && h >= A.h[0] - 5 && h <= A.h[1] + 5) return k;
  }
  return "humain";
}
