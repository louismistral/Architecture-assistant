/* ============================================================================
   LES DONNÉES — CE QUE LES RÔLES LISENT

   Rien n'y est tiré, rien n'y est noté. Deux espèces :

     le CONTEXTE   le site (`site.js`), le programme (`program.js`), le
                   règlement (`rules.js`), et nos HYPOTHÈSES là où le règlement
                   ne tranche pas — la largeur du couloir, les surfaces à
                   préciser, le prix au m³ ;
     les MESURES   ce qu'on lit sur un bâtiment : surfaces, distances,
                   compacité, volume… Les formules sont du code
                   (`mass/mesures.js`, `mix/mesures.js`) ; elles valent pour
                   n'importe quel bâtiment, le nôtre comme celui d'un
                   concurrent. Le jugement ne lit qu'elles.

   Le contexte opposable ne se règle pas ici : il se change dans le code, et
   une variante enregistrée avant devient périmée (`core/empreinte.js`). Les
   hypothèses de groupe se règlent — le couloir et les surfaces vivent dans
   `core/model.js`, le prix au m³ dans `V`.
   ========================================================================= */
import { RULES } from "./rules.js";
import { V, declarer } from "./lignes.js";
export { V };

function nb(x){ return String(x).replace(".", ","); }
var H = { t:"hypothese" };

/* ---------- les hypothèses ---------------------------------------------------------- */
export var HYPOTHESES = [
  { id:"couloir", sujet:"Circulation", onglet:"programme", src:H, qui:"groupe",
    n:"Largeur du couloir", val:"au cahier des charges, volet Surfaces",
    lu:"src/core/model.js — setCirc(), COULOIR",
    d:"La circulation se déduit des pièces : Σ front × largeur ÷ 2, plus les cages. La part "
      + "du bâti devient un résultat." },
  { id:"a-preciser", sujet:"Programme", onglet:"programme", src:H, qui:"groupe",
    n:"Les huit surfaces « selon projet »", val:"au cahier des charges, volet Surfaces",
    lu:"src/core/model.js — setItemArea()",
    d:"Le règlement les laisse au projet : nous les précisons, et tous les totaux suivent." },
  { id:"m3", sujet:"Coût", onglet:"tous", src:H, qui:"groupe", jury:1,
    n:"Prix au m³ bâti", k:"m3", def:770, min:300, max:3000, pas:10,
    unite:"CHF par m³ SIA 416, CFC 2 à 4, TTC", lu:"src/data/jugement.js — scoreDe()",
    d:"Calé pour que la variante de départ tombe à peu près au budget du règlement ("
      + nb(RULES.budget / 1e6) + " M CHF, art. 1.9). Une hypothèse du JURY : elle chiffre le "
      + "volume mesuré, elle ne change aucune variante — la changer renote sans rien regénérer." },
  { id:"pavage", sujet:"Circulation", onglet:"massing", src:H, qui:"groupe",
    n:"Reste du pavage des plans", k:"pavage", def:4, min:0, max:20, pas:1,
    unite:"% de plus que la section des plans", lu:"src/mass/model.js — aPaver()",
    d:"Le Massing donne à chaque niveau ce que les plans y pavent : les pièces dans leurs bandes, "
      + "le dégagement devant celles que leurs proportions arrêtent, le couloir, les cages. Reste ce "
      + "que la formule ne voit pas — un rang finit rarement sur une pièce entière, deux bandes "
      + "rarement ensemble. Calé sur 72 tirages : à 0 %, 368 m² par tirage ne tiennent pas ; à 4 %, "
      + "242 ; à 8 %, 172 — mais le sol libre croît plus vite et le site refuse un parti sur six." },
  { id:"pass-larg", sujet:"Connexions", onglet:"massing", src:H, qui:"groupe",
    n:"Largeur d'une passerelle", k:"passLarg", def:3, min:2, max:6, pas:0.5, unite:"m",
    lu:"src/mass/model.js — pontRect()" },
  { id:"couverture", sujet:"Sous-sol", onglet:"massing", src:H, qui:"code",
    n:"Couverture au-dessus de la nappe", val: nb(RULES.dist.couverture) + " m — RULES.dist.couverture",
    lu:"src/mass/mesures.js — couverture()",
    d:"La nappe est au règlement (" + nb(RULES.site.nappe[0]) + "–" + nb(RULES.site.nappe[1])
      + " m) ; les trois mètres de terre qu'un sous-sol excavé doit garder, non." },
  { id:"enveloppe", sujet:"Construction", onglet:"tous", src:H, qui:"code",
    n:"Dalle · mur extérieur · acrotère",
    val: nb(RULES.haut.dalle) + " · " + nb(RULES.haut.mur) + " · " + nb(RULES.haut.acrotere) + " m — RULES.haut",
    lu:"src/data/rules.js — hNiv() · src/mass/model.js — volRect()",
    d:"La dalle s'ajoute à la hauteur libre, le mur autour de la surface utile : ni l'un ni "
      + "l'autre ne retranche un mètre carré au programme." },
  { id:"place-parc", sujet:"Terrain libre", onglet:"massing", src:H, qui:"code",
    n:"Emprise d'une place de parc", val: RULES.ext.mPlace + " m², accès compris — RULES.ext.mPlace",
    lu:"src/mass/mesures.js — terrainLibre()" },
  { id:"cages", sujet:"Circulation", onglet:"tous", src:{ t:"aeai", a:"16-15 (règlement 2.6)" }, qui:"code",
    n:"Deux cages au-delà de 900 m² d'étage", val: RULES.circ.cage + " m² par cage et par niveau",
    lu:"src/core/model.js — cagesDe() · alertes des deux contrôles",
    d:"Opposable, et déjà tenu : les cages sont comptées dans la circulation. Elles se "
      + "dessineront à la typologie." }
];
HYPOTHESES.forEach(function(x){ x.role = "donnee"; x.nature = "hypothese"; });

/* ---------- les mesures --------------------------------------------------------------
   Le catalogue de ce qu'on lit sur un bâtiment. `de` : la répartition (mix),
   la volumétrie (mass) ou le plan des Typologies (typo). Chaque variante
   enregistrée garde ces nombres bruts : quand un poids change, on la renote
   sans la regénérer. */
export var MESURES = [
  { id:"soleil",       de:"mass", n:"Façades longues des classes, écart au sud", unite:"°" },
  { id:"vue",          de:"mass", n:"Façades longues des classes, écart à la vue", unite:"°" },
  { id:"jourRatio",    de:"mass", n:"Pire vis-à-vis : écart ÷ hauteur du plus haut", unite:"×" },
  { id:"compa",        de:"mass", n:"Façade développée par m² de plancher", unite:"m²/m²" },
  { id:"cour",         de:"mass", n:"Cour utile d'un seul tenant devant une façade d'école", unite:"m²" },
  { id:"terrainMarge", de:"mass", n:"Terrain libre moins la cour et le stationnement", unite:"m²" },
  { id:"emprise",      de:"mass", n:"Emprise au sol de l'école", unite:"m²" },
  { id:"volume",       de:"mass", n:"Volume bâti SIA 416 de l'école", unite:"m³" },
  { id:"ensembles",    de:"mass", n:"Ensembles bâtis séparés", unite:"" },
  { id:"orientations", de:"mass", n:"Orientations distinctes des corps d'école", unite:"" },
  { id:"niveauxMax",   de:"mass", n:"Niveaux hors sol, au plus", unite:"" },
  { id:"profMax",      de:"mass", n:"Profondeur du corps d'école le plus épais", unite:"m" },
  { id:"elan",         de:"mass", n:"Élancement du corps le plus long", unite:"×" },
  { id:"pente",        de:"mass", n:"Dénivelé sous une emprise, au plus", unite:"m" },
  { id:"distMin",      de:"mass", n:"Écart minimal entre bâtiments distincts", unite:"m" },
  { id:"distExistant", de:"mass", n:"Écart minimal à un bâtiment existant", unite:"m" },
  { id:"alignPart",    de:"mass", n:"Part des corps alignés sur le site ou un voisin", unite:"" },
  { id:"couverture",   de:"mass", n:"Terrain au-dessus de la nappe, sous un sous-sol", unite:"m" },
  { id:"sousSolPart",  de:"mass", n:"Part enterrée de la surface bâtie", unite:"" },
  { id:"sportIntegre", de:"mass", n:"Salle de sport accolée à l'école", unite:"oui/non" },
  { id:"secondPose",   de:"mass", n:"Part du second temps posée sur le terrain", unite:"" },
  { id:"pubSep",       de:"mass", n:"Public et école : recouvrement des emprises, par la meilleure ligne", unite:"" },
  { id:"pubCote",      de:"mass", n:"Public et école : écart des centres vers le côté public", unite:"m" },
  { id:"adjTenues",    de:"mix",  n:"Part des proximités exigées tenues au même niveau", unite:"" },
  { id:"bruitMixte",   de:"mix",  n:"Niveaux qui mêlent le bruyant et les classes", unite:"" },
  { id:"classesEtage", de:"mix",  n:"Part des classes au-dessus du rez", unite:"" },
  { id:"classesNiveauMax", de:"mix", n:"Salles de classe sur un même niveau, au plus", unite:"" },
  { id:"circPart",     de:"mix",  n:"Part de la circulation dans le bâti", unite:"" },
  { id:"classesSoleil", de:"typo", n:"Salles de classe bien orientées — E à SSO, SO à O pour moitié", unite:"" },
  { id:"liensPlan",    de:"typo", n:"Part des liens du schéma tenus au plan, bord à bord, même niveau", unite:"" },
  { id:"circPlan",     de:"typo", n:"Circulation dessinée — couloirs, paliers, noyaux — dans le bâti", unite:"" },
  { id:"murBruyant",   de:"typo", n:"Mur partagé entre une classe et une pièce bruyante", unite:"m" },
  { id:"noyaux",       de:"typo", n:"Noyaux escalier + ascenseur", unite:"" },
  { id:"grappes",      de:"typo", n:"Part des classes en grappes de 3 à 4", unite:"" },
  { id:"techGroupes",  de:"typo", n:"Groupes de locaux techniques séparés", unite:"" },
  { id:"posePlan",     de:"typo", n:"Part du programme posée dans les plans", unite:"" },
  { id:"couloirsJour", de:"typo", n:"Part des bouts de couloir sur une façade", unite:"" },
  { id:"pubGroupe",    de:"typo", n:"Part des bandes où le public forme une suite, à un bout", unite:"" }
];
MESURES.forEach(function(x){
  x.role = "donnee"; x.nature = "mesure"; x.sujet = "Mesures"; x.src = { t:"mesure" }; x.qui = "code";
  x.onglet = x.de === "mix" ? "mixer" : x.de === "typo" ? "typologie" : "massing";
  x.lu = x.de === "mix" ? "src/mix/mesures.js — mesuresMix()"
       : x.de === "typo" ? "src/typo/mesures.js — evaluerTypo()" : "src/mass/mesures.js — mesuresMass()";
  x.id = "m-" + x.id; x.m = x.id.slice(2);
});

export var DONNEES = HYPOTHESES.concat(MESURES);
declarer(DONNEES);
