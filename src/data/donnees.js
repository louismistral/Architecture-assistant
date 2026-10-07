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
  { id:"trame-struct", sujet:"Structure", onglet:"typologie", src:H, qui:"groupe", jury:1,
    n:"Trame structurelle", k:"trameStruct", def:7.2, min:2.4, max:12, pas:0.3, unite:"m",
    lu:"src/typo/mesures.js — murTrame", d:"Le pas des porteurs en façade : e45 compte les murs "
      + "entre pièces qui tombent dessus. Pas le module de 0,50 m — le générateur le tient toujours." },
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
  { id:"pv-vise", sujet:"Énergie", onglet:"massing", src:H, qui:"groupe", jury:1,
    n:"Surface de panneaux visée", k:"pvVise", def:800, min:100, max:3000, pas:50, unite:"m²",
    lu:"src/mass/mesures.js — jugesSite() · toitPV",
    d:"Ce que le photovoltaïque en toiture devrait couvrir. Une estimation, à confirmer avec "
      + "l'ingénieur : elle ne change aucune variante, elle renote." },
  { id:"pv-part", sujet:"Énergie", onglet:"massing", src:H, qui:"groupe", jury:1,
    n:"Part posable d'un toit plat", k:"pvPart", def:0.6, min:0.2, max:1, pas:0.05, pct:1,
    lu:"src/mass/mesures.js — jugesSite() · toitPV",
    d:"Un toit plat ne se couvre pas entier : acrotères, lanterneaux, édicules, entretien." },
  { id:"avant-toit", sujet:"Extérieurs", onglet:"massing", src:H, qui:"groupe", jury:1,
    n:"Profondeur d'avant-toit", k:"avantToit", def:1.5, min:0, max:4, pas:0.25, unite:"m",
    lu:"src/mass/mesures.js — jugesPoses() · couvertPart",
    d:"Les façades d'école qui bordent la cour couvrent cette profondeur : un avant-toit compte "
      + "comme du préau couvert." },
  { id:"sport-ext", sujet:"Extérieurs", onglet:"massing", src:H, qui:"groupe", jury:1,
    n:"Terrain de sport extérieur", k:"sportExtL", def:40, min:10, max:60, pas:1, unite:"m de long",
    lu:"src/mass/mesures.js — jugesPoses() · sportExtAxe",
    d:"Le programme ne le chiffre pas : un terrain multisport, ici de 40 × 20 m (la largeur à la "
      + "ligne suivante)." },
  { id:"sport-ext-l", sujet:"Extérieurs", onglet:"massing", src:H, qui:"groupe", jury:1,
    n:"Terrain de sport extérieur, largeur", k:"sportExtW", def:20, min:5, max:40, pas:1, unite:"m",
    lu:"src/mass/mesures.js — jugesPoses() · sportExtAxe" },
  { id:"parc-ratio", sujet:"Terrain libre", onglet:"massing", src:H, qui:"groupe", jury:1,
    n:"Proportions du parking", k:"parcRatio", def:2, min:1, max:6, pas:0.5, unite:"× plus long que large",
    lu:"src/mass/mesures.js — jugesPoses() · voituresBord",
    d:"Le parking de surface, posé pour le jugement : un rectangle de " + RULES.ext.voitures + " × "
      + RULES.ext.mPlace + " m², à ces proportions." },
  { id:"m-velo", sujet:"Terrain libre", onglet:"massing", src:H, qui:"groupe", jury:1,
    n:"Emprise d'une place vélo", k:"mVelo", def:1.5, min:0.8, max:3, pas:0.1, unite:"m², couverte",
    lu:"src/mass/mesures.js — jugesPoses() · velosDist" },
  { id:"ext-emprise", sujet:"Extension", onglet:"massing", src:H, qui:"groupe", jury:1,
    n:"Emprise d'extension prévue", k:"extEmprise", def:600, min:100, max:3000, pas:50, unite:"m²",
    lu:"src/mass/mesures.js — jugesSite() · extensionPossible",
    d:"Le terrain qu'une extension future demande, collé à un corps d'école. Une estimation." },
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
  { id:"bordurePart",  de:"mass", n:"Part de l'emprise d'école dans la bande de 20 m du périmètre", unite:"" },
  { id:"rapportHauteur", de:"mass", n:"Hauteur de l'école ÷ moyenne de l'existant à 50 m", unite:"×" },
  { id:"parvis",       de:"mass", n:"Terrain libre d'un seul tenant entre une route et une façade d'école", unite:"m²" },
  { id:"courFermee",   de:"mass", n:"Part des 36 rayons de la cour qui touchent un bâtiment à 40 m", unite:"" },
  { id:"courAbritee",  de:"mass", n:"Part des lignes cour → route (80 m) coupées par un bâtiment", unite:"" },
  { id:"zonesExt",     de:"mass", n:"Zones libres de plus de 200 m² contre une façade d'école", unite:"" },
  { id:"profondeursDistinctes", de:"mass", n:"Profondeurs distinctes des corps d'école, au demi-mètre", unite:"" },
  { id:"porteAFaux",   de:"mass", n:"Plus grand dépassement d'un étage sur celui du dessous", unite:"m" },
  { id:"repetitionPart", de:"mass", n:"Part du plancher à la profondeur la plus fréquente", unite:"" },
  { id:"chantierLibre", de:"mass", n:"Part de l'existant en service que l'étape 1 laisse libre", unite:"" },
  { id:"extensionPossible", de:"mass", n:"Plus grand rectangle libre contre l'école ÷ emprise d'extension", unite:"" },
  { id:"uniteEtapes",  de:"mass", n:"Étape 2 comme l'étape 1 : profondeur, orientation, niveaux", unite:"" },
  { id:"toitPV",       de:"mass", n:"Toits plats posables ÷ surface de panneaux visée", unite:"" },
  { id:"couvertPart",  de:"mass", n:"Préau posé et avant-toits sur la cour ÷ préau du programme", unite:"" },
  { id:"sportExtAxe",  de:"mass", n:"Terrain de sport posé hors cour : écart de son grand axe au nord-sud", unite:"°" },
  { id:"voituresBord", de:"mass", n:"Parking posé au plus près d'une route : écart à la cour ÷ 30 m", unite:"" },
  { id:"accesSepares", de:"mass", n:"Entrée piétons à l'accès véhicules le plus proche", unite:"m" },
  { id:"velosDist",    de:"mass", n:"Abri vélos posé contre l'école : distance à l'entrée", unite:"m" },
  { id:"niveauxDifferents", de:"mass", n:"Part des étages qui diffèrent de celui du dessous", unite:"" },
  { id:"existantGarde", de:"mass", n:"Part de l'existant du périmètre qu'aucune emprise ne recouvre", unite:"" },
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
  { id:"pubGroupe",    de:"typo", n:"Part des bandes où le public forme une suite, à un bout", unite:"" },
  { id:"vestSas",      de:"typo", n:"Part des classes où l'on entre par leur vestiaire", unite:"" },
  { id:"classesDouble", de:"typo", n:"Part des classes à façades dans deux directions", unite:"" },
  { id:"classesProp",  de:"typo", n:"Part des classes du carré à 1 × 1,35", unite:"" },
  { id:"vitrageFacade", de:"typo", n:"Baie requise (1/5 du sol) ÷ façade de la classe, en moyenne", unite:"" },
  { id:"aveugles",     de:"typo", n:"Part de la surface de séjour sans façade", unite:"" },
  { id:"espaceGrappe", de:"typo", n:"Part des grappes avec un élargissement de 20 m² sur leur couloir", unite:"" },
  { id:"accesGrappe",  de:"typo", n:"Part des grappes d'étage atteintes de l'escalier sans en longer une autre", unite:"" },
  { id:"appuiEntre",   de:"typo", n:"Part des salles d'appui entre deux salles, dont une classe", unite:"" },
  { id:"couloirApprendre", de:"typo", n:"Surface de couloir meublable par classe, aux étages de classes", unite:"m²" },
  { id:"niches",       de:"typo", n:"Élargissements meublables par 30 m de couloir", unite:"" },
  { id:"couloirSombre", de:"typo", n:"Couloir à plus de 15 m de toute lumière", unite:"m" },
  { id:"entreeRoute",  de:"typo", n:"Part des pièces du rez plus loin de la route que le hall", unite:"" },
  { id:"hallCentre",   de:"typo", n:"Hall : ailes du rez qu'il dessert, proximité du centre des classes", unite:"" },
  { id:"uapeAutonome", de:"typo", n:"UAPE : entrée au rez, réfectoire contre la cuisine, bâtiment de l'école", unite:"" },
  { id:"maitresCour",  de:"typo", n:"Salle des maîtres au rez ou au 1er, la cour vue à 40 m", unite:"" },
  { id:"communEleve",  de:"typo", n:"Halls et élargissements meublables par élève", unite:"m²" },
  { id:"mursEmpiles",  de:"typo", n:"Part des murs d'étage posés sur un mur du dessous", unite:"" },
  { id:"adaptable",    de:"typo", n:"Classes à la même profondeur et murs empilés, en moyenne", unite:"" },
  { id:"circUnique",   de:"typo", n:"Part des niveaux hors sol à une seule circulation", unite:"" },
  { id:"lisibilite",   de:"mass", n:"Angles d'emprise par 1000 m² (4 → 1, 12 → 0) et circulation unique, en moyenne", unite:"" },
  { id:"anglesPlancher", de:"mass", n:"Angles des emprises de l'école par 1000 m² de plancher", unite:"" },
  { id:"chapitresGroupes", de:"typo", n:"Part de la surface de chaque chapitre dans son groupe principal, par niveau", unite:"" },
  { id:"unGeste",      de:"mass", n:"Plancher du plus grand ensemble ÷ plancher total ÷ orientations", unite:"" },
  { id:"murTrame",     de:"typo", n:"Part des murs en façade sur la trame structurelle", unite:"" },
  { id:"videsPossibles", de:"typo", n:"Part des étages où un dégagement recouvre 12 m² de dégagement ou de hall du dessous", unite:"" },
  { id:"allegeEnfant", de:"typo", n:"Hauteur d'allège des fenêtres", unite:"m" },
  { id:"situationLisible", de:"mass", n:"Cour au minimum, parvis de 400 m², dessinés au plan de situation", unite:"" },
  { id:"coupeLisible", de:"mass", n:"La meilleure coupe : la pente qu'elle montre, l'existant qu'elle traverse", unite:"" }
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
