/* ============================================================================
   LE JUGEMENT — COMBIEN VAUT LE BÂTIMENT POUR LE JURY ?

   Un moteur à part. Il note le bâtiment ENTIER — le programme réparti et la
   volumétrie —, et il ne lit que ses MESURES (`donnees.js — MESURES`) : jamais
   la façon dont il a été produit, pour pouvoir noter aussi bien le bâtiment
   d'un concurrent qu'une composition retouchée à la main.

   Les AXES sont les six critères de jugement du règlement (art. 1.26, « sans
   ordre hiérarchique »), avec des poids proposés, réglables. Chaque axe a ses
   SOUS-AXES — les familles des critères tirés de concours d'écoles gagnants.
   Un CRITÈRE est une mesure et une fonction de score, rattaché au sous-axe où
   il sert le mieux, avec un poids dans ce sous-axe : en ajouter un ne gonfle
   pas l'axe. Un critère qui sert deux axes y est partagé EXPLICITEMENT
   (`axes`) : il compte une fois, en deux parts.

   Un critère sans mesure attend une NOTE MANUELLE, posée sur une variante
   enregistrée (`net/variantes.js`) — l'expression architecturale surtout.
   Une variante qui n'en a pas n'est ni avantagée ni punie : elle reçoit, pour
   ce critère, la MOYENNE des notes posées sur les autres — 0,5 quand personne
   n'a encore rien noté. Noter une variante la situe donc par rapport à celles
   qu'on a notées, jamais au-dessus de celles qu'on n'a pas regardées. Exclure
   le critère aurait été pire : un axe presque entièrement à la main —
   l'expression — se serait lu sur son seul critère mesuré, qui aurait pesé à
   lui seul quinze points de la note. La COUVERTURE dit quelle part du poids a
   vraiment été lue, mesurée ou notée.

   PAS DE COMPENSATION AVEUGLE. Dans un sous-axe et dans un axe, les critères
   se compensent — c'est une moyenne. Entre les axes, non : la note générale
   est leur moyenne GÉOMÉTRIQUE pondérée. Un axe à 0,2 pèse bien plus lourd
   qu'une moyenne ne le dirait, et aucun autre ne le rachète.

   Tous les poids, et les bornes de chaque fonction, vivent dans l'état
   (`lignes.js — V`), réglés par le groupe : on les ajustera après le résultat
   de Saxon, pour retrouver le classement du jury.
   ========================================================================= */
import { RULES } from "./rules.js";
import { V, declarer, valeur, actif } from "./lignes.js";
import { MESURES } from "./donnees.js";
export { V };

/* ---------- les axes et leurs sous-axes ------------------------------------------ */
export var AXES = [
  { id:"site", n:"Insertion dans le site, relations à l'existant", w:20,
    sous:[{ id:"B", n:"Implantation et rapport au lieu", w:1 }] },
  { id:"fonc", n:"Qualités fonctionnelles, structurelles, spatiales", w:20,
    sous:[{ id:"D", n:"Organisation et fonctionnement", w:55 },
          { id:"F", n:"Structure et construction", w:30 },
          { id:"I", n:"Planification dans le temps", w:15 }] },
  { id:"expr", n:"Expression architecturale, adéquation au thème", w:15,
    sous:[{ id:"E", n:"Architecture et expression", w:80 },
          { id:"J", n:"Stratégie de rendu", w:20 }] },
  { id:"ext", n:"Aménagements extérieurs, accès, circulations", w:15,
    sous:[{ id:"C", n:"Espaces extérieurs", w:1 }] },
  { id:"eco", n:"Économie générale", w:15,
    sous:[{ id:"G", n:"Économie", w:1 }] },
  { id:"env", n:"Environnement, durabilité, énergie", w:15,
    sous:[{ id:"H", n:"Énergie et durabilité", w:1 }] }
];
var SOUS = {};
AXES.forEach(function(a){ a.sous.forEach(function(s){ s.axe = a.id; SOUS[s.id] = s; }); });
export function sousAxe(id){ return SOUS[id] || null; }
AXES.forEach(function(a){
  valeur("ax:" + a.id, a.w, { min:0, max:100 }, true);
  a.sous.forEach(function(s){ valeur("sx:" + s.id, s.w, { min:0, max:100 }, true); });
});

/* ---------- les critères ----------------------------------------------------------
   c(id, sous-axe, poids, intitulé, mesure, fonction, exemples)
   La fonction : `max` (moins vaut mieux : 1 jusqu'à `bon`, 0 à `nul`), `min`
   (plus vaut mieux), `bande` (1 entre `bon` et `haut`, 0 à `nul` de marge),
   `oui` (la mesure est déjà une part, de 0 à 1), `options` (une valeur par
   option), `cout` (le volume fois le
   prix au m³, contre le budget ; `nul` est le dépassement qui vaut 0). Sans
   mesure : un critère non mesuré, qui ne compte pas dans la note. */
function c(id, sx, w, n, m, f, ex){
  return { id:id, sx:sx, w:w, n:n, mesure:m || null, f:f || null, ex:ex || "" };
}
function mx(bon, nul){ return { t:"max", bon:bon, nul:nul }; }
function mn(bon, nul){ return { t:"min", bon:bon, nul:nul }; }

export var CRITERES = [
  /* ---- B · implantation et rapport au lieu ---- */
  c("b7",  "B", 9, "Implantation évidente, lisible en un seul croquis", "orientations", mx(1, 4), "Cugy, Matran"),
  c("b8",  "B", 8, "Peu de volumes (1 ou 2) plutôt que des pavillons éclatés", "ensembles", mx(2, 6)),
  c("b9",  "B", 7, "Volumes en bordure du site pour libérer le cœur de la parcelle", "bordurePart", mn(0.7, 0.3), "Vignettaz, Champagne"),
  c("b10", "B", 7, "Échelle adaptée : 2 à 3 niveaux en village, pas trop massif", "niveauxMax",
    { t:"bande", bon:2, haut:3, nul:2 }, "Dorigny, Boswil"),
  c("b11", "B", 7, "Dialogue avec l'existant, sans le dominer, avec des vues vers lui", "rapportHauteur", mx(1.2, 2), "Boswil, Praroman, Broc"),
  c("b12", "B", 6, "Un espace public : place de village ou parvis partagé", "parvis", mn(400, 100), "Broc, Boswil"),
  c("b13", "B", 7, "Adapté à la pente : peu de déblais, entrées à plusieurs niveaux", "pente", mx(1, 3),
    "Courtételle, Cugy, Praroman"),
  c("b14", "B", 5, "Distances généreuses aux voisins", "distExistant", mn(15, 5), "Dorigny"),
  c("b15", "B", 6, "Vues et dégagements préservés", "vue", mx(30, 75), "Praroman"),
  c("b16", "B", 5, "Continuité avec les tracés : alignements, arbres, chemins", "alignPart", mn(1, 0), "Dorigny"),
  Object.assign(c("pub-cote", "B", 4, "Le public du côté voulu de la parcelle — à l'est, l'école à l'ouest", "pubCote", mn(15, -15)),
    { src:{ t:"choix" } }),

  /* ---- C · espaces extérieurs ---- */
  c("c18", "C", 8, "Préau délimité par les bâtiments, fermé sur 2 ou 3 côtés", "courFermee",
    { t:"bande", bon:0.4, haut:0.75, nul:0.25 }, "Vignettaz, Val d'Arve, Champagne"),
  c("c19", "C", 6, "Préau protégé de la route et du bruit", "courAbritee", mn(0.7, 0.2), "Boswil"),
  /* la cour utile se mesure à 30 m au plus devant UNE façade : elle plafonne
     vers 1'000 à 1'500 m², loin des 5 à 10 m² par élève de tout le préau */
  c("c20", "C", 7, "Préau bien dimensionné, d'un seul tenant, ni trop grand ni morcelé", "cour",
    mn(1000, 500), "Boswil"),
  c("c21", "C", 5, "Partie couverte : préau couvert ou avant-toit", "couvertPart", { t:"oui" }),
  c("c22", "C", 4, "Espaces différents selon les âges", "zonesExt", mn(2, 1), "Broc"),
  c("c23", "C", 5, "Sport extérieur bien placé, orienté nord-sud", "sportExtAxe", mx(15, 45), "Champagne"),
  c("c24", "C", 5, "Arbres conservés, grands arbres locaux, surfaces perméables", null, null, "Schlieren"),
  c("c25", "C", 4, "Biodiversité et eau de pluie gérée sur place", null, null, "Saint-Aubin"),
  c("c26", "C", 6, "Voitures en bordure, jamais dans le préau", "voituresBord", { t:"oui" }, "Broc"),
  c("c27", "C", 7, "Accès séparés et sûrs : piétons, vélos, livraisons, dépose", "accesSepares", mn(30, 5)),
  c("c28", "C", 4, "Vélos et trottinettes couverts, près des entrées", "velosDist", mx(20, 60)),
  /* la réserve de terrain (ancien b17), le stationnement et l'économie de
     terrain (ancien g62) lisent la même mesure — ce que les bâtiments laissent
     du périmètre : un critère, partagé entre trois sous-axes */
  Object.assign(c("j-terrain", "C", 7, "Faible emprise : du terrain pour la cour, 70 places, une extension",
    "terrainMarge", mn(7000, 5500), "Praroman"), { axes:{ C:.4, G:.4, B:.2 } }),

  /* ---- D · organisation et fonctionnement ---- */
  /* peu d'angles d'emprise, une seule circulation par niveau (`mass/mesures.js — joindre()`) */
  c("d29", "D", 7, "Plans simples, lisibles et flexibles", "lisibilite", { t:"oui" }, "Champagne, Matran"),
  /* au plan des Typologies : le hall, de toutes les pièces du rez, la plus proche de la route */
  c("d30", "D", 6, "Une entrée principale claire, côté route", "entreeRoute", { t:"oui" }, "Praroman"),
  c("d-hall", "D", 5, "Un hall au centre, qui distribue tout", "hallCentre", { t:"oui" }),
  /* les élargissements meublables et le couloir plus large que le courant, par classe */
  c("d31", "D", 6, "Circulations qui servent d'espaces d'apprentissage", "couloirApprendre",
    { t:"bande", bon:10, haut:20, nul:10 }, "Schlieren"),
  /* les grappes : des suites de 3 ou 4 classes contiguës, lues sur le plan des Typologies */
  c("d32", "D", 6, "Grappes de classes reliables, espaces de travail partagés", "grappes", mn(1, 0.3), "Schlieren, Raumstandards Zurich"),
  /* la classe elle-même, sur le plan : sa façade de jour à l'est ou au sud */
  Object.assign(c("d33", "D", 7, "Classes éclairées naturellement, bien orientées", "classesSoleil", mn(0.9, 0.5),
    "directives vaudoises 2002, Matran"),
    { axes:{ D:.5, H:.5 }, kb:"d33-plan" }),
  c("d-double", "D", 6, "Classes éclairées de deux côtés", "classesDouble", mn(0.3, 0)),
  c("d-prop", "D", 4, "Classes bien proportionnées, du carré à 1 × 1,35", "classesProp", mn(1, 0.5)),
  c("d-aveugle", "D", 5, "Pas de pièce de séjour sans fenêtre", "aveugles", mx(0, 0.25)),
  c("d-espace", "D", 6, "Un espace partagé devant chaque grappe", "espaceGrappe", mn(1, 0), "Schlieren"),
  c("d-appui", "D", 5, "Salles d'appui entre deux classes", "appuiEntre", mn(1, 0)),
  c("d35", "D", 4, "Organisation par chapitre : les locaux d'un même chapitre côte à côte", "chapitresGroupes", { t:"oui" }),
  c("d36", "D", 4, "Pas le même plan répété à chaque étage sans réflexion", "niveauxDifferents", mn(0.5, 0), "Schlieren"),
  /* au plan : le vestiaire en sas de sa classe (`schema.js`, lien `sas`) — plus que « près de » */
  c("d37", "D", 4, "Vestiaires et garderobes près de l'entrée ou des classes", "vestSas", mn(1, 0.5), "Boswil"),
  c("d38", "D", 6, "Salle de sport intégrée ou semi-enterrée", "sportIntegre", { t:"options", v:{ 1:1, 0:0.6 } },
    "Vignettaz, Champagne"),
  /* au plan : les pièces publiques en une suite au bout de chaque bande */
  c("d39", "D", 6, "Locaux ouverts à la commune, accessibles sans traverser l'école", "pubGroupe", mn(1, 0.5)),
  Object.assign(c("pub-sep", "D", 6, "Public et école nettement séparés, une limite claire entre eux", "pubSep", mx(0, 0.5)),
    { src:{ t:"choix" } }),
  /* au plan : son entrée au rez, le réfectoire contre la cuisine, le bâtiment de l'école */
  c("d40", "D", 5, "Parascolaire et cantine autonomes et reliés à l'école", "uapeAutonome", { t:"oui" }),
  c("d41", "D", 4, "Salle des maîtres avec vue sur le préau", "maitresCour", { t:"oui" }),
  c("d42", "D", 5, "Un ascenseur, une ou deux cages d'escalier au plus", "noyaux", mx(2, 4), "Broc"),
  c("d43", "D", 4, "Locaux techniques regroupés, accessibles aux livraisons", "techGroupes", mx(1, 4), "Broc"),
  /* au plan : bord à bord, au même niveau — le mixer ne disait que « au même niveau » */
  c("prox", "D", 8, "Les proximités du schéma fonctionnel sont tenues", "liensPlan", mn(1, 0.6)),
  Object.assign(c("calme", "D", 5, "Le bruyant séparé du calme", "murBruyant", mx(0, 9), "VS 400.200 art. 13"),
    { kb:"calme-plan" }),
  c("etage", "D", 4, "Les classes à l'étage, l'accueil au rez", "classesEtage", mn(1, 0.5)),
  c("degre", "D", 5, "Un degré par niveau", "classesNiveauMax", mx(11, 16)),
  /* ce que le plan des Typologies ne loge pas dans le volume : au jury, comme au contrôle */
  /* il porte aussi le poids de j80 : le tableau des surfaces ne peut s'écarter du programme que par là */
  c("d-pose", "D", 10, "Tout le programme tient dans les plans", "posePlan", mn(1, 0.9)),
  c("d-jour", "D", 5, "Couloirs éclairés naturellement à leurs bouts", "couloirsJour", mn(1, 0),
    "Raumstandards Zurich, Cugy"),
  c("d-sombre", "D", 4, "Pas de couloir sombre au milieu", "couloirSombre", mx(0, 30)),

  /* ---- E · architecture et expression ---- */
  /* PROXY : la simplicité du geste, pas sa force — à valider par paires */
  c("e44", "E", 7, "Une idée forte et claire, une identité", "unGeste", mn(0.8, 0.25), "Cugy"),
  /* les murs en façade sur la trame (`donnees.js — trameStruct`) ; f-murs dit s'ils s'empilent */
  c("e45", "E", 5, "Une façade qui découle de la structure", "murTrame", mn(0.7, 0.2), "Vignettaz"),
  /* halls et élargissements meublables, par élève */
  c("e46", "E", 5, "Des intérieurs généreux et fluides", "communEleve", mn(1.5, 0.5), "Matran, Praroman"),
  c("e-niches", "E", 4, "Des niches le long du couloir", "niches", mn(3, 1)),
  /* le générateur ne dessine pas de vide : on lit où la dalle POURRAIT s'ouvrir */
  c("e-vides", "E", 4, "Des vues d'un étage à l'autre : double hauteur, vide, patio", "videsPossibles", mn(0.5, 0)),
  c("e47", "E", 4, "Unité formelle entre les étapes de réalisation", "uniteEtapes", { t:"oui" }, "Vignettaz"),
  c("e48", "E", 5, "Matériaux simples et chaleureux qui vieillissent bien"),
  c("e49", "E", 6, "Lumière naturelle maîtrisée entre les corps", "jourRatio", mn(1.1, 0.5)),
  /* des fenêtres où l'enfant assis voit dehors : l'allège des plans (`RULES.plan.fenetre`) */
  c("e50", "E", 5, "Une ambiance à l'échelle de l'enfant", "allegeEnfant", mx(0.7, 1.1)),

  /* ---- F · structure et construction ---- */
  c("f51", "F", 6, "Structure claire sur une trame régulière", "profondeursDistinctes", mx(1, 3), "Praroman, Schlieren"),
  c("f52", "F", 5, "Bois en priorité, ou bois-béton si l'incendie l'impose", null, null, "Courtételle, Cugy, Praroman"),
  c("f53", "F", 6, "Portées raisonnables : des corps de deux classes au plus", "profMax", mx(19.5, 26)),
  c("f54", "F", 4, "Pas de prouesse structurelle injustifiée", "porteAFaux", mx(0, 4), "Schlieren"),
  c("f55", "F", 4, "Préfabrication possible, chantier court", "repetitionPart", { t:"oui" }),
  /* « peu d'éléments enterrés » (F) et « hors-sol maximal » (G) mesurent la
     même chose : un critère, partagé */
  Object.assign(c("f56", "F", 5, "Peu d'éléments enterrés, hors-sol maximal", "sousSolPart", mx(0.05, 0.20)),
    { axes:{ F:.4, G:.6 } }),
  c("f57", "F", 3, "Démontage et réemploi possibles"),
  c("f-murs", "F", 4, "Les murs les uns sur les autres", "mursEmpiles", mn(0.7, 0)),
  c("j-nappe", "F", 5, "Un sous-sol hors de la nappe", "couverture", mn(RULES.dist.couverture, 1)),

  /* ---- G · économie ---- */
  c("cout", "G", 10, "Coût dans le budget", "volume", { t:"cout", nul:0.25 }, "Vignettaz, Praroman"),
  Object.assign(c("g58", "G", 8, "Volume compact, peu de façade par m² de plancher", "compa", mx(0.95, 1.25), "Val d'Arve"),
    { axes:{ G:.5, H:.5 } }),
  /* la circulation DESSINÉE aux Typologies, et non plus son estimation */
  c("g59", "G", 5, "Circulations limitées, mais utiles", "circPlan", mx(0.25, 0.35)),
  /* la moyenne de cinq critères déjà notés : ils comptent deux fois, poids faible */
  Object.assign(c("g61", "G", 3, "Économie de moyens", null, { t:"oui" }, "Schlieren"),
    { moy:["g58", "g59", "f56", "b8", "d42"] }),
  c("g63", "G", 4, "Entretien et exploitation peu coûteux"),

  /* ---- H · énergie et durabilité ---- */
  c("h64", "H", 5, "Minergie-P, Minergie-ECO ou SNBS"),
  /* fusionné dans h-vitrage, qui le mesure au plan : éteint */
  Object.assign(c("h65", "H", 4, "Façades vitrées à 30–40 %, contre la surchauffe", null, null, "Broc"), { eteint:1 }),
  /* la baie qu'exige le sol de la classe, sur la façade qu'elle a — avec le poids de h65 */
  c("h-vitrage", "H", 8, "Pas trop de vitrage : la baie requise tient dans la façade", "vitrageFacade", mx(0.4, 0.8)),
  c("h66", "H", 4, "Protection solaire extérieure, ventilation de nuit"),
  c("h67", "H", 3, "Masse thermique : chape, terre crue, béton", null, null, "Broc"),
  c("h68", "H", 5, "Énergie grise faible : bois, compacité, peu d'enterré"),
  c("h69", "H", 4, "Photovoltaïque en toiture, CAD ou pompe à chaleur", "toitPV", mn(1, 0.4)),
  c("h70", "H", 3, "Réemploi de l'existant plutôt que démolition", "existantGarde", { t:"oui" }),
  /* à la façon d'un contrôle SNBS, la moyenne de critères déjà notés : poids faible */
  Object.assign(c("h71", "H", 3, "Bonne note au contrôle de durabilité", null, { t:"oui" }, "Schlieren"),
    { moy:["g58", "f56", "h69", "h70", "c25", "d33", "h-vitrage"] }),

  /* ---- I · planification dans le temps ---- */
  c("i72", "I", 5, "Étapes crédibles : le second temps trouve sa place", "secondPose", { t:"oui" }, "Vignettaz, Praroman"),
  c("i73", "I", 4, "L'école fonctionne pendant le chantier", "chantierLibre", { t:"oui" }, "Saint-Aubin, Val d'Arve"),
  c("i74", "I", 4, "Extension future sans affaiblir le projet", "extensionPossible", { t:"oui" }),
  /* des classes à la même profondeur, des murs empilés */
  c("i75", "I", 4, "Plans adaptables à d'autres pédagogies ou usages", "adaptable", { t:"oui" }),
  c("i-grappes", "I", 3, "Chaque grappe a son propre accès depuis l'escalier", "accesGrappe", mn(1, 0.5)),

  /* ---- J · stratégie de rendu ---- */
  /* PROXY : le cadre « Schemes » du midterm et la planche 5 portent toujours les
     diagrammes (`rendu/diagramme.js`) — un bâtiment simple donne un schéma simple */
  Object.assign(c("j76", "J", 5, "Un schéma conceptuel lisible en 5 secondes", null, { t:"oui" }),
    { moy:["b7", "b8", "d29"] }),
  c("j77", "J", 4, "Un plan de situation qui montre le préau et l'espace public", "situationLisible", { t:"oui" }),
  c("j78", "J", 4, "Une coupe qui montre la pente et l'existant", "coupeLisible", { t:"oui" }),
  /* le Rendu ne produit pas de vue intérieure : 0 partout, éteint jusque-là */
  Object.assign(c("j79", "J", 3, "Une vue intérieure de l'espace d'apprentissage"), { eteint:1 }),
  /* fusionné dans d-pose : une surface de programme ne change jamais */
  Object.assign(c("j80", "J", 4, "Des tableaux de surfaces justes et vérifiables"), { eteint:1 })
];

/* Chaque critère devient une ligne : son poids, sa fonction et son
   interrupteur sont des cases de `V`, du jury. */
CRITERES.forEach(function(x){
  if(!x.axes){ x.axes = {}; x.axes[x.sx] = 1; }
  x.role = "jugement"; x.qui = "groupe"; x.off = 1;
  x.sujet = SOUS[x.sx].n;
  x.onglet = "tous";
  x.src = x.src || { t:"concours", a: x.ex ? "— " + x.ex : "" };
  x.k = "w:" + x.id; x.def = x.w; x.min = 0; x.max = 10; x.pas = 1;
  x.lu = "src/data/jugement.js — noter()";
});
declarer(CRITERES);
/* LA CLÉ D'UNE BORNE change avec son sens (`kb`) : d33 se mesurait en degrés,
   calme en niveaux — une borne réglée alors ne doit pas être relue en part ou en
   mètres. L'ancienne clé, inconnue, est ignorée à la lecture. */
export function cleBorne(x, p){ return p + (x.kb || x.id); }
CRITERES.forEach(function(x){
  if(!x.f) return;
  if(x.f.bon !== undefined) valeur(cleBorne(x, "jb:"), x.f.bon, null, true);
  if(x.f.nul !== undefined) valeur(cleBorne(x, "jn:"), x.f.nul, null, true);
  if(x.f.haut !== undefined) valeur(cleBorne(x, "jh:"), x.f.haut, null, true);
});
var PAR_ID = {};
CRITERES.forEach(function(x){ PAR_ID[x.id] = x; });
export function critere(id){ return PAR_ID[id] || null; }
export function manuel(x){ return !x.mesure && !x.moy; }

/* ---------- la fonction de score --------------------------------------------------
   Rend un nombre de 0 à 1, ou null quand la mesure manque — un bâtiment sans
   sous-sol n'a pas de couverture sur la nappe, et ce critère ne le concerne
   pas. */
function lin(x, a, b){ return b === a ? (x >= a ? 1 : 0) : Math.max(0, Math.min(1, (x - b) / (a - b))); }
export function scoreDe(x, m){
  if(m == null || !isFinite(m) || !x.f) return null;
  var bon = V[cleBorne(x, "jb:")], nul = V[cleBorne(x, "jn:")];
  switch(x.f.t){
    case "max":  return lin(-m, -bon, -nul);
    case "min":  return lin(m, bon, nul);
    case "oui":  return Math.max(0, Math.min(1, m));
    case "options": return x.f.v[m] == null ? null : x.f.v[m];
    case "bande":
      var haut = V[cleBorne(x, "jh:")];
      if(m >= bon && m <= haut) return 1;
      return m < bon ? lin(m, bon, bon - nul) : lin(-m, -haut, -(haut + nul));
    case "cout":
      var cout = m * V.m3, B = RULES.budget;
      return lin(-cout, -B, -B * (1 + nul));
  }
  return null;
}

/* ---------- la note ------------------------------------------------------------------
   `mes` : les mesures du bâtiment — un critère sans mesure est « non mesuré »
   et ne compte pas ; `couv` dit la part du poids qui est mesurée
   (`moyennes()`). Rend la note générale sur 100, chaque axe et chaque sous-axe
   sur 1, et, pour chaque critère, son score et d'où il vient. */
var PLANCHER = 0.02;       /* un axe nul ne rend pas la note nulle : il l'écrase */
export function noter(mes){
  mes = mes || {};
  var crit = {};
  CRITERES.forEach(function(x){
    var s = null, de = null;
    if(!actif(x.id) || !(V["w:" + x.id] > 0)){ crit[x.id] = { s:null, de:"éteint" }; return; }
    if(x.moy) return;
    if(x.mesure){ s = scoreDe(x, mes[x.mesure]); de = s == null ? "sans objet" : "mesure"; }
    /* un critère sans mesure ne compte pas : il n'est que « non mesuré » */
    else de = "non mesuré";
    crit[x.id] = { s:s, de:de };
  });
  /* un critère qui lit d'autres critères (`moy`) : la moyenne de leurs scores, après eux */
  CRITERES.forEach(function(x){
    if(!x.moy || crit[x.id]) return;
    var S = x.moy.map(function(id){ return crit[id] && crit[id].s; }).filter(function(s){ return s != null; });
    crit[x.id] = S.length ? { s:S.reduce(function(a, b){ return a + b; }, 0) / S.length, de:"mesure" } : { s:null, de:"sans objet" };
  });
  var axes = AXES.map(function(a){
    var sous = a.sous.map(function(sx){
      var som = 0, pois = 0, tout = 0;
      CRITERES.forEach(function(x){
        var part = x.axes[sx.id], c = crit[x.id];
        if(!part || c.de === "éteint" || c.de === "sans objet") return;
        var w = V["w:" + x.id] * part;
        tout += w;
        if(c.s == null) return;
        som += w * c.s; pois += w;
      });
      return { id:sx.id, n:sx.n, w:V["sx:" + sx.id], s: pois ? som / pois : null,
               couv: tout ? pois / tout : 0 };
    });
    var som = 0, pois = 0, lu = 0, tout = 0;
    sous.forEach(function(s){
      if(!(s.w > 0)) return;
      tout += s.w;
      if(s.s == null) return;
      som += s.w * s.s; pois += s.w; lu += s.w * s.couv;
    });
    return { id:a.id, n:a.n, w:V["ax:" + a.id], s: pois ? som / pois : null,
             couv: tout ? lu / tout : 0, sous:sous };
  });
  var ln = 0, W = 0, lu = 0, tout = 0;
  axes.forEach(function(a){
    if(!(a.w > 0)) return;
    tout += a.w;
    if(a.s == null) return;
    ln += a.w * Math.log(Math.max(PLANCHER, a.s)); W += a.w; lu += a.w * a.couv;
  });
  return { total: W ? Math.round(100 * Math.exp(ln / W)) : null,
           couv: tout ? lu / tout : 0, axes:axes, crit:crit };
}
/* La moyenne, critère par critère, des notes manuelles de plusieurs variantes :
   ce que reçoit une variante qu'on n'a pas notée. */
export function moyennes(liste){
  var som = {}, n = {};
  (liste || []).forEach(function(m){
    for(var k in (m || {})) if(m[k] != null){ som[k] = (som[k] || 0) + +m[k]; n[k] = (n[k] || 0) + 1; }
  });
  var o = {};
  for(var k in som) o[k] = som[k] / n[k];
  return o;
}
/* LA PART TYPOLOGIE : la moyenne, au poids de chacun, des critères qui lisent
   le plan des Typologies (`MESURES`, `de:"typo"`). Ce n'est pas un axe : elle
   ne change pas la note, elle la lit — pour un même volume, la bonne et la
   mauvaise typologie. null quand aucun critère du plan n'a été lu. */
var TYPO_M = {};
MESURES.forEach(function(m){ if(m.de === "typo") TYPO_M[m.m] = 1; });
export function scoreTypo(j){
  if(!j) return null;
  var som = 0, pois = 0;
  CRITERES.forEach(function(x){
    var c = j.crit[x.id];
    if(!TYPO_M[x.mesure] || !c || c.s == null) return;
    som += V["w:" + x.id] * c.s; pois += V["w:" + x.id];
  });
  return pois ? som / pois : null;
}
/* Le rang d'une variante sur un axe : son score, ou null. `j` est un résultat
   de `noter()`. */
export function scoreAxe(j, id){
  if(!j) return null;
  if(!id) return j.total;
  for(var i = 0; i < j.axes.length; i++) if(j.axes[i].id === id)
    return j.axes[i].s == null ? null : Math.round(100 * j.axes[i].s);
  return null;
}
