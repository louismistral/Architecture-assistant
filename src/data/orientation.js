/* ============================================================================
   L'ORIENTATION — OÙ CHERCHER D'ABORD ?

   Nos intentions. Elles évitent la force brute : entre deux candidats — deux
   niveaux pour un poste, deux compositions valides —, la recherche prend
   celui qu'elles préfèrent, à la part du hasard près. Elles n'entrent PAS dans
   la note : ce que nous préférons n'est pas ce que le jury récompense, et les
   deux lignes d'un même sujet peuvent diverger.

   Deux formes, selon ce que la ligne regarde :

     une CIBLE        valeur chiffrée ; l'écart à la cible dit à quel point on
                      s'en approche. Le massing : une qualité q de −1 (loin) à
                      +1 (atteinte), calée sur deux seuils ;
     une VALEUR PAR OPTION   quand la mesure n'est pas linéaire. Le mixer : des
                      points par niveau candidat — tant pour l'étage, tant pour
                      le sous-sol, tant retirés si le niveau déborde.

   Le TAG dit la force : Prioritaire pèse `forcePrio` fois une Souhaitée
   (`recherche.js`). Une ligne Imposée devient du CADRE : le générateur jette
   la variante où elle se lit défavorable. Indicatif, elle ne guide plus rien
   et le contrôle en parle encore.
   ========================================================================= */
import { V, declarer, enVigueur, oriente, tagDe } from "./lignes.js";
import "./recherche.js";
import { RULES } from "./rules.js";
export { V };

var TOUS = ["impose", "prioritaire", "souhaite", "indicatif"];
var MOUS = ["prioritaire", "souhaite", "indicatif"];
var CHOIX = { t:"choix" }, USAGE = { t:"usage" };

/* ---------- le mixer : des points par niveau candidat ---------------------------
   La note d'un niveau pour un poste est la somme de ces lignes, chacune fois
   la force de son tag. Leur valeur est en POINTS, et ils se comparent entre
   eux : c'est tout ce qui compte. */
export var ORIENT_MIX = [
  { id:"place", sujet:"Plateau", tag:"souhaite", src:CHOIX,
    n:"Place restante au niveau", k:"placePoids", def:30, min:0, max:120, pas:2,
    unite:"points quand le poste y tient — retirés au niveau plein",
    d:"L'ancien tirage ne notait QUE cela : un poste allait au niveau le plus vide. Égalise "
      + "les niveaux, et décourage un plateau plein sans l'interdire ; trop fort, il écrase le reste." },
  { id:"grappe", sujet:"Adjacences", tag:"prioritaire", src:CHOIX,
    n:"Une grappe sur un niveau", k:"grappePts", def:4, min:0, max:24, pas:1,
    unite:"points, au prorata de la grappe déjà là",
    d:"Une grappe est la composante connexe des adjacences ACTIVES : celle de la salle de "
      + "sport compte quatorze postes. À zéro, elle s'éparpille sur trois étages." },
  { id:"fam", sujet:"Familles d'usage", tag:"souhaite", src:CHOIX,
    n:"Une famille d'usage par niveau", k:"famPoids", def:10, min:0, max:60, pas:1,
    unite:"points, au prorata de la famille déjà là",
    d:"À défaut d'exigence écrite, ce qui se ressemble s'assemble. Un départage." },
  { id:"cla-haut", sujet:"Classes", tag:"souhaite", src:USAGE,
    n:"Les classes à l'étage", k:"classeEtage", def:8, min:0, max:60, pas:1,
    unite:"points par étage au-dessus du rez",
    d:"Le rez reçoit le public, les parents, les livraisons et les usages hors horaire. "
      + "Les classes montent, comme dans toute école qui existe." },
  { id:"tec-bas", sujet:"Sous-sol", tag:"souhaite", src:USAGE,
    n:"Le technique au sous-sol", k:"techSousSol", def:10, min:0, max:60, pas:1,
    unite:"points au sous-sol",
    d:"Le seul programme qui se passe de jour, et il libère du rez — sauf s'il dessert un "
      + "local précis par une adjacence active." },
  { id:"bruit-calme", sujet:"Bruit", tag:"souhaite", src:USAGE,
    n:"Le bruyant loin du calme", k:"bruitCalme", def:12, min:0, max:60, pas:1,
    unite:"points retirés au niveau mixte",
    d:"Sport, scène, cuisine, réfectoire et foyer ne partagent pas volontiers un niveau avec "
      + "les salles de classe." },
  { id:"pile", sujet:"Pile", tag:"souhaite", src:CHOIX,
    n:"Une pile compacte", k:"pileCompacte", def:7, min:0, max:60, pas:1,
    unite:"points retirés par étage de plus",
    d:"Parmi les piles que le site admet, les plus basses d'abord. À la part du hasard par "
      + "défaut, elle rend la pile la plus compacte un peu moins d'une fois sur deux." }
];
ORIENT_MIX.forEach(function(x){
  x.role = "orientation"; x.onglet = "mixer"; x.qui = "groupe"; x.admet = MOUS; x.off = 1;
  x.lu = x.id === "pile" ? "src/mix/shuffle.js — proposerPile()" : "src/mix/shuffle.js — noteNiveau()";
});

/* ---------- le massing : des cibles -------------------------------------------
   `mass/mesures.js — qualites()` rend, pour chacune, sa qualité q ∈ [−1, 1]
   et son état : favorable, neutre, défavorable. Les seuils sont ici. */
export var ORIENT_MASS = [
  { id:"dims", sujet:"Dimensions des corps", tag:"prioritaire",
    n:"Des corps au-dessus des minimums", val:"largeur et profondeur au moins celles des leviers",
    d:"Le générateur tire ses cotes au-dessus des minimums des leviers ; un corps retouché peut "
      + "passer dessous. Favorable quand aucun ne le fait." },
  { id:"distv", sujet:"Distance entre bâtiments", tag:"prioritaire",
    n:"Distance souhaitée entre bâtiments", k:"distVoulue", def:6, min:0, max:80, pas:0.5, unite:"m au moins",
    d:"Les écarts des figures la visent, la réparation y ramène." },
  { id:"vue", sujet:"Vue", tag:"prioritaire", src:{ t:"site" },
    n:"Vue vers le nord-ouest", k:"orientBon", def:30, min:5, max:80, pas:5, unite:"° de la vue — favorable",
    k2:"orientMax", def2:60, min2:10, max2:90, unite2:"° — défavorable au-delà",
    d:"La vue la plus intéressante du site — le terrain de football du relevé —, jugée sur la "
      + "façade longue de chaque corps qui porte des classes." },
  { id:"cap", sujet:"Orientation générale", tag:"souhaite", admet:MOUS,
    n:"Orientation de la figure", val:"l'optimum soleil-vue, plutôt que l'axe du périmètre ou un angle libre",
    lu:"src/mass/gen.js — orientation()",
    d:"Le générateur essaie les trois ; l'optimum soleil-vue y compte une fois de plus en "
      + "Souhaité, cinq fois de plus en Prioritaire. Les terrasses suivent toujours les "
      + "courbes de niveau." },
  { id:"dist", sujet:"Distance entre bâtiments", tag:"prioritaire", src:{ t:"aeai", a:"15-15 (règlement 2.3)" },
    n:"Distance incendie entre bâtiments", val: String(RULES.dist.entre).replace(".", ",") + " m — RULES.dist.entre",
    lu:"src/mass/gen.js — admissible(), reparer() · src/mass/partis.js — FEU() · src/mass/mesures.js — qualites()",
    d:"Le règlement renvoie à l'AEAI sans la chiffrer ; 5 m est le cas de base (deux façades à "
      + "couche extérieure incombustible). Visée par les figures et la réparation ; Imposée, "
      + "elle redevient bloquante." },
  { id:"jour", sujet:"Lumière", tag:"prioritaire",
    n:"Lumière entre bâtiments", k:"ombreK", def:1.10, min:0, max:3, pas:0.05, unite:"× la hauteur du plus haut",
    d:"L'écart entre façades qui se font face. La réparation écarte doucement les corps vers "
      + "cet écart." },
  { id:"compa", sujet:"Compacité", tag:"prioritaire", src:{ t:"reglement", a:"2.9" },
    n:"Un volume compact", k:"compaBon", def:0.65, min:0.1, max:1.5, pas:0.01, unite:"m² de façade par m² de plancher — favorable",
    k2:"compaMax", def2:0.75, min2:0.1, max2:2, unite2:"— défavorable au-delà",
    d:"Les seuils sont calés sur les variantes valides du site, chaque volume à sa hauteur : "
      + "un corps de classes à 3,20 m, la salle de sport seule à 7,40 m — de 0,5 à 0,8." },
  { id:"align", sujet:"Alignement", tag:"souhaite",
    n:"Des corps alignés", val:"sur le site, une limite, une route ou un voisin",
    d:"Préféré à égalité du reste ; rien n'oblige à s'aligner." },
  { id:"nivalign", sujet:"Niveaux", tag:"prioritaire", admet:MOUS,
    n:"Des niveaux alignés", val:"tous les bâtiments d'école posent leur rez à la même altitude",
    lu:"src/mass/model.js — assiseEff(), etagesDe() · src/mass/mesures.js — qualites()",
    d:"Plus forte que la mise au terrain : les planchers des bâtiments se rejoignent, et le "
      + "terrain ne se lit plus que dans le terrassement que cette altitude demande. Éteinte "
      + "ou indicative, chaque volume se pose sur le terrain sous son emprise." },
  { id:"pente", sujet:"Pente", tag:"souhaite", src:{ t:"site" },
    n:"Peu de terrassement", k:"penteMax", def:2, min:0.5, max:6, pas:0.1, unite:"m entre le rez et le terrain sous une emprise",
    d:"Le dénivelé du terrain sous une emprise, et l'écart du rez au terrain quand les niveaux "
      + "sont alignés. Moitié du seuil : favorable ; au-delà : terrassement important." },
  { id:"elan", sujet:"Élancement", tag:"souhaite",
    n:"Des corps pas trop élancés", k:"elanceMax", def:9, min:2, max:30, pas:1, unite:"× plus long que large",
    d:"Garde-fou secondaire." },
  { id:"socle", sujet:"Gradins", tag:"souhaite",
    n:"Un étage n'est pas plus petit que le suivant", k:"socleMin", def:80, min:0, max:100, pas:5,
    unite:"% de l'étage du dessus au moins",
    d:"Dans chaque corps, la surface d'un niveau rapportée à celle du niveau qu'il porte : un "
      + "porte-à-faux reste un débord, pas un champignon. Favorable quand tous les niveaux tiennent "
      + "le pourcentage." },
  { id:"connex", sujet:"Connexions", tag:"souhaite",
    n:"Une école d'un seul tenant", val:"corps accolés ou reliés par passerelle",
    d:"Préférée à égalité du reste. Les passerelles sont un LEVIER : elles relient sans fusionner." },
  { id:"nappe", sujet:"Sous-sol", tag:"souhaite", src:{ t:"hypothese", a:"— couverture de 3 m" },
    n:"Un sous-sol hors de la nappe", val:"sous le corps le plus haut",
    d:"L'altitude moyenne du terrain sous le corps qui porte un sous-sol doit dépasser la "
      + "nappe (462,25 m) de la couverture supposée (RULES.dist.couverture)." },
  { id:"terrain", sujet:"Terrain libre", tag:"souhaite", src:{ t:"reglement", a:"2.4" },
    n:"Place pour la cour et 70 places", val:"ce que les bâtiments laissent du terrain posable",
    d:"Deux dépose-bus, quatre dépose-minute, 70 places de parc : le terrain libre doit les "
      + "accueillir, avec la cour." }
];
ORIENT_MASS.forEach(function(x){
  x.role = "orientation"; x.onglet = "massing"; x.qui = "groupe"; x.admet = x.admet || TOUS; x.off = 1;
  if(!x.src) x.src = CHOIX;
  if(!x.lu) x.lu = "src/mass/mesures.js — qualites() · src/mass/gen.js — retenir()";
});

export var ORIENTATION = ORIENT_MIX.concat(ORIENT_MASS);
declarer(ORIENTATION);

/* Une ligne qu'on VISE, en orientation ou en cadre : ce que les figures et la
   réparation du massing cherchent à tenir. Éteinte ou indicative, elles
   l'oublient. */
export function vise(id){ return oriente(id) || enVigueur(id); }
export function distVisee(){ return vise("distv") ? V.distVoulue : 0; }
/* La distance INCENDIE : visée par les figures et la réparation tant qu'elle
   n'est pas éteinte, exigée par l'admissibilité seulement Imposée. */
export function feuVise(){ return vise("dist") ? RULES.dist.entre : 0; }
export function feuExige(){ return enVigueur("dist") ? RULES.dist.entre : 0; }
export function ombreVisee(){ return vise("jour") ? V.ombreK : 0; }

/* ---------- la force d'une ligne -------------------------------------------------
   0 quand elle ne guide rien — éteinte, indicative, ou devenue cadre. */
export function force(id){
  if(!oriente(id)) return 0;
  return tagDe(id) === "prioritaire" ? V.forcePrio : 1;
}

/* Les lignes du CADRE CHOISI du massing qui admettent d'être assouplies en
   orientation : leur qualité se lit comme les autres. */
export var ORIENT_ACCUEIL = [{ id:"recul" }, { id:"cour" }, { id:"facade" }];

/* ---------- ce que l'orientation préfère, entre deux compositions --------------
   `q` : `{ id: { q, niv } }`, la qualité de chaque ligne (`mass/mesures.js`).
   Rend un nombre de 0 à 1 : la moyenne des qualités ramenées à [0, 1], chaque
   ligne comptée `force()` fois. Sans ligne active, 0,5 — rien ne départage. */
export function preference(q){
  var som = 0, pois = 0;
  ORIENT_MASS.concat(ORIENT_ACCUEIL).forEach(function(x){
    var f = force(x.id), c = q[x.id];
    if(!f || !c) return;
    som += f * (c.q + 1) / 2; pois += f;
  });
  return pois ? som / pois : 0.5;
}
/* Une ligne d'orientation passée en Imposé : le générateur la tient comme un
   cadre — il jette la variante où elle se lit défavorable. */
export function imposees(){
  return ORIENT_MASS.filter(function(x){ return enVigueur(x.id); }).map(function(x){ return x.id; });
}
