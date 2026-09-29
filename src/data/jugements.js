/* ============================================================================
   RÈGLES DURES ET JUGEMENTS DU MASSING — SOURCE UNIQUE

   Deux bacs. Une RÈGLE DURE élimine la variante qui l'enfreint : elle n'est
   jamais montrée. Un JUGEMENT note la variante : chacun a un poids de 0 à 10
   (`w`), et la note est leur moyenne pondérée, sur 100. Chaque entrée peut
   passer d'un bac à l'autre (`dur` est le bac de départ) ; le bac et le poids
   vivants sont dans `DOC` (`b_<id>`, `w_<id>`), partagés au groupe.

   `m` : les MESURES du générateur qui disent si l'entrée est tenue — ids de
   `juge.js` (`dures()` et `qualites()`). Une entrée sans mesure ne se lit pas
   au stade du massing : elle se vérifie à la main, ou dans un onglet suivant.
   `fam` : la famille de surfaces qu'elle regarde (`families.js`), null pour
   tout le projet. `r` : l'entrée reprend le titre de cette règle de `REGLES`.

   Jugements A à J : critères tirés de concours d'écoles primaires gagnants.
   ========================================================================= */

export var CATS = {
  R: "Règlement et doctrine",
  A: "Conditions éliminatoires",
  B: "Implantation et rapport au lieu",
  C: "Espaces extérieurs",
  D: "Organisation et fonctionnement",
  E: "Architecture et expression",
  F: "Structure et construction",
  G: "Économie",
  H: "Énergie et durabilité",
  I: "Planification dans le temps",
  J: "Stratégie de rendu"
};

function j(id, c, w, fam, m, n, ex){ return { id:id, c:c, w:w, fam:fam, m:m || [], n:n, ex:ex || "", dur: c === "R" || c === "A" }; }
function r(id, fam, m){ var o = j(id, "R", 8, fam, m || [id]); o.r = id; return o; }

export var JUGES = [
  /* ---- règlement et doctrine : les règles dures de `REGLES` ---- */
  r("perim", null), r("dist", null), r("existant", null), r("facade", "cla"),
  r("module", null), r("cour", "ext"), r("abri", "tec"), r("sport", "spo"),
  /* la couverture de 3 m est une hypothèse (`rules.js — dist.couverture`) :
     dure, elle rend le parti « pavillons » impossible — elle part jugée */
  Object.assign(j("r_nappe", "R", 8, "tec", ["nappe"], "Couverture au-dessus de la nappe (sous-sol minimal)", "règlement 2.3"), { dur:false }),
  j("r_classes", "R", 8, "cla", [], "Classes au plus au 2ᵉ étage", "règlement 2.10 — tenu par le mixer"),
  j("r_cages", "R", 8, null, [], "Deux cages d'escalier au-delà de 900 m² d'étage", "AEAI 16-15"),
  j("r_fuite", "R", 8, null, [], "Voies de fuite de 35 m au plus", "AEAI 16-15"),
  j("r_second", "R", 8, "pis", [], "Piscine et local CAD en pointillé, l'école marche avec et sans", "règlement 2.2, 2.10"),

  /* ---- A · conditions éliminatoires ---- */
  j("a1", "A", 10, null, ["prog"], "Programme complet, surfaces à ±5 % environ, aucun local manquant", "Champagne"),
  j("a2", "A", 10, null, ["perim", "dist", "existant"], "Règles de construction : distances, H/2, hauteur, IUS, alignements, zone", "Saint-Aubin"),
  j("a3", "A", 10, null, [], "Coût dans le budget", "Vignettaz, Praroman"),
  j("a4", "A", 10, null, [], "Rendu conforme : planches, échelles, anonymat, maquette"),
  j("a5", "A", 10, null, ["dist"], "Prescriptions incendie AEAI : fuites, compartiments, bois admissible"),
  j("a6", "A", 10, null, [], "Accessibilité SIA 500 : un ascenseur, rampes et accès de plain-pied"),

  /* ---- B · implantation et rapport au lieu ---- */
  j("b7",  "B", 9, null, ["parti"], "Implantation évidente, lisible en un seul croquis", "Cugy, Matran"),
  j("b8",  "B", 8, null, ["connex"], "Peu de volumes (1 ou 2) plutôt que des pavillons éclatés"),
  j("b9",  "B", 7, "ext", [], "Volumes en bordure du site pour libérer le cœur de la parcelle", "Vignettaz, Champagne"),
  j("b10", "B", 7, null, ["elan"], "Échelle adaptée : 2 à 3 niveaux en village, pas trop massif", "Dorigny, Boswil"),
  j("b11", "B", 7, null, [], "Dialogue avec l'existant, sans le dominer, avec des vues vers lui", "Boswil, Praroman, Broc"),
  j("b12", "B", 6, "ext", [], "Un espace public : place de village ou parvis partagé", "Broc, Boswil"),
  j("b13", "B", 7, null, ["pente"], "Adapté à la pente : peu de déblais, entrées à plusieurs niveaux", "Courtételle, Cugy, Praroman"),
  j("b14", "B", 5, null, ["distv"], "Distances généreuses aux voisins", "Dorigny"),
  j("b15", "B", 6, null, ["vue"], "Vues et dégagements préservés", "Praroman"),
  j("b16", "B", 5, null, ["align"], "Continuité avec les tracés : alignements, arbres, chemins", "Dorigny"),
  j("b17", "B", 5, null, ["terrain"], "Réserve de terrain pour une extension future"),

  /* ---- C · espaces extérieurs ---- */
  j("c18", "C", 8, "ext", [], "Préau délimité par les bâtiments, fermé sur 2 ou 3 côtés", "Vignettaz, Val d'Arve, Champagne"),
  j("c19", "C", 6, "ext", [], "Préau protégé de la route et du bruit", "Boswil"),
  j("c20", "C", 7, "ext", ["courq"], "Préau bien dimensionné, 5 à 10 m² par élève, ni trop grand ni morcelé", "Boswil"),
  j("c21", "C", 5, "ext", [], "Partie couverte : préau couvert ou avant-toit"),
  j("c22", "C", 4, "ext", [], "Espaces différents selon les âges", "Broc"),
  j("c23", "C", 5, "spo", [], "Sport extérieur bien placé, orienté nord-sud", "Champagne"),
  j("c24", "C", 5, "ext", [], "Arbres conservés, grands arbres locaux, surfaces perméables", "Schlieren"),
  j("c25", "C", 4, "ext", [], "Biodiversité et eau de pluie gérée sur place", "Saint-Aubin"),
  j("c26", "C", 6, "ext", [], "Voitures cachées : souterrain ou en bordure, jamais dans le préau", "Broc"),
  j("c27", "C", 7, "ext", [], "Accès séparés et sûrs : piétons, vélos, livraisons, dépose"),
  j("c28", "C", 4, "ext", [], "Vélos et trottinettes couverts, près des entrées"),

  /* ---- D · organisation et fonctionnement ---- */
  j("d29", "D", 7, null, [], "Plans simples, lisibles et flexibles", "Champagne, Matran"),
  j("d30", "D", 6, null, [], "Une entrée principale claire, un hall généreux", "Praroman"),
  j("d31", "D", 6, "cla", [], "Circulations qui servent d'espaces d'apprentissage", "Schlieren"),
  j("d32", "D", 6, "cla", [], "Grappes de classes reliables, espaces de travail partagés", "Schlieren"),
  j("d33", "D", 7, "cla", ["soleil"], "Classes d'environ 72 m², presque carrées, éclairées naturellement"),
  j("d34", "D", 4, "cla", [], "Classes enfantines au rez, accès direct à l'extérieur", "Broc"),
  j("d35", "D", 4, "cla", [], "Organisation par étage selon le cycle"),
  j("d36", "D", 4, "cla", [], "Pas le même plan répété à chaque étage sans réflexion", "Schlieren"),
  j("d37", "D", 4, "eau", [], "Vestiaires et garderobes près de l'entrée ou des classes", "Boswil"),
  j("d38", "D", 6, "spo", [], "Salle de sport intégrée ou semi-enterrée, nord-sud", "Vignettaz, Champagne"),
  j("d39", "D", 6, "spo", [], "Locaux ouverts à la commune, accessibles sans traverser l'école"),
  j("d40", "D", 5, "uap", [], "Parascolaire et cantine autonomes et reliés à l'école"),
  j("d41", "D", 4, "adm", [], "Salle des maîtres avec vue sur le préau"),
  j("d42", "D", 5, null, [], "Un ascenseur, une ou deux cages d'escalier au plus", "Broc"),
  j("d43", "D", 4, "tec", [], "Locaux techniques regroupés, accessibles aux livraisons"),

  /* ---- E · architecture et expression ---- */
  j("e44", "E", 7, null, [], "Une idée forte et claire, une identité", "Cugy"),
  j("e45", "E", 5, null, [], "Une façade qui découle de la structure", "Vignettaz"),
  j("e46", "E", 5, null, [], "Des intérieurs généreux et fluides", "Matran, Praroman"),
  j("e47", "E", 4, "pis", [], "Unité formelle entre les étapes de réalisation", "Vignettaz"),
  j("e48", "E", 5, null, [], "Matériaux simples et chaleureux qui vieillissent bien"),
  j("e49", "E", 6, "cla", ["jour"], "Lumière naturelle maîtrisée, sans éblouissement"),
  j("e50", "E", 5, "cla", [], "Une ambiance à l'échelle de l'enfant"),

  /* ---- F · structure et construction ---- */
  j("f51", "F", 6, null, [], "Structure claire sur une trame régulière", "Praroman, Schlieren"),
  j("f52", "F", 5, null, [], "Bois en priorité, ou bois-béton si l'incendie l'impose", "Courtételle, Cugy, Praroman"),
  j("f53", "F", 6, null, ["dims"], "Portées raisonnables, 8 à 9 m pour une classe"),
  j("f54", "F", 4, null, [], "Pas de prouesse structurelle injustifiée", "Schlieren"),
  j("f55", "F", 4, null, [], "Préfabrication possible, chantier court"),
  j("f56", "F", 5, null, ["nappe"], "Peu d'éléments enterrés"),
  j("f57", "F", 3, null, [], "Démontage et réemploi possibles"),

  /* ---- G · économie ---- */
  j("g58", "G", 8, null, ["compa"], "Volume compact, peu de façade par m² de plancher", "Val d'Arve"),
  j("g59", "G", 5, null, [], "Circulations limitées, 20 à 25 % du plancher, mais utiles"),
  j("g60", "G", 5, null, [], "Hors-sol maximal, sous-sol minimal"),
  j("g61", "G", 4, null, [], "Économie de moyens", "Schlieren"),
  j("g62", "G", 5, null, [], "Économie de terrain : faible emprise", "Praroman"),
  j("g63", "G", 4, null, [], "Entretien et exploitation peu coûteux"),

  /* ---- H · énergie et durabilité ---- */
  j("h64", "H", 5, null, [], "Minergie-P, Minergie-ECO ou SNBS"),
  j("h65", "H", 4, null, [], "Façades vitrées à 30–40 %, contre la surchauffe", "Broc"),
  j("h66", "H", 4, null, [], "Protection solaire extérieure, ventilation de nuit"),
  j("h67", "H", 3, null, [], "Masse thermique : chape, terre crue, béton", "Broc"),
  j("h68", "H", 5, null, [], "Énergie grise faible : bois, compacité, peu d'enterré"),
  j("h69", "H", 4, null, [], "Photovoltaïque en toiture, CAD ou pompe à chaleur"),
  j("h70", "H", 3, null, [], "Réemploi de l'existant plutôt que démolition"),
  j("h71", "H", 4, null, [], "Bonne note au contrôle de durabilité", "Schlieren"),

  /* ---- I · planification dans le temps ---- */
  j("i72", "I", 5, "pis", [], "Étapes crédibles, un projet fini à chaque étape", "Vignettaz, Praroman"),
  j("i73", "I", 4, null, [], "L'école fonctionne pendant le chantier", "Saint-Aubin, Val d'Arve"),
  j("i74", "I", 4, null, [], "Extension future sans affaiblir le projet"),
  j("i75", "I", 4, null, [], "Plans adaptables à d'autres pédagogies ou usages"),

  /* ---- J · stratégie de rendu ---- */
  j("j76", "J", 5, null, [], "Un schéma conceptuel lisible en 5 secondes"),
  j("j77", "J", 4, "ext", [], "Un plan de situation qui montre le préau et l'espace public"),
  j("j78", "J", 4, null, [], "Une coupe qui montre la pente et l'existant"),
  j("j79", "J", 3, "cla", [], "Une vue intérieure de l'espace d'apprentissage"),
  j("j80", "J", 4, null, [], "Des tableaux de surfaces justes et vérifiables")
];

/* ---- pourquoi chaque entrée compte, en une phrase ----
   Ce que MESURE le générateur ne se redit pas ici : il se lit dans le
   `pourquoi` de la règle de `REGLES` qui porte l'id de la mesure. */
var POURQUOI = {
  r_nappe:  "La nappe est à 3 m à peine sous le terrain : un sous-sol profond y coûte cher et prend l'eau.",
  r_classes:"Le règlement limite les classes au 2ᵉ étage : évacuation et âge des élèves. Le mixer le tient avant le massing.",
  r_cages:  "Au-delà de 900 m² par étage, l'AEAI exige deux cages : cela fixe le nombre de noyaux du plan.",
  r_fuite:  "Une voie de fuite ne dépasse pas 35 m jusqu'à une issue : cela borne la longueur d'un couloir.",
  r_second: "Piscine et CAD viendront plus tard : l'école doit tenir seule, et accueillir ensuite ces ouvrages sans se défaire.",
  a1:  "Un local manquant ou une surface très écartée écarte un projet d'office : le jury compare des programmes égaux.",
  a2:  "Distances, hauteurs, alignements, zone : une infraction réglementaire exclut le projet du jugement.",
  a3:  "Un surcoût sensible fait perdre : le maître d'ouvrage vote un crédit, pas un projet.",
  a4:  "Planches, échelles, anonymat et maquette hors règlement : le projet n'est pas admis au jugement.",
  a5:  "La sécurité incendie ne se négocie pas : fuites, compartiments et bois doivent être admissibles.",
  a6:  "L'école doit être accessible à tous, sans obstacle, selon la SIA 500.",
  b7:  "Le jury retient les projets dont l'idée se lit d'un trait : une implantation qui s'explique en un croquis.",
  b8:  "Un ou deux volumes sont plus lisibles, plus compacts et moins chers qu'un semis de pavillons.",
  b9:  "Bâtir en lisière libère un grand vide central, utile à la cour et à la commune.",
  b10: "Le bâti doit rester à l'échelle du village : 2 à 3 niveaux, pas une masse qui écrase.",
  b11: "Le Casino et ses jardins sont inventoriés : le projet s'y adosse sans les dominer.",
  b12: "Une école de village est aussi un lieu public : un parvis ou une place la relie à la commune.",
  b13: "Suivre la pente limite les terrassements et permet d'entrer de plain-pied à plusieurs niveaux.",
  b14: "Des distances généreuses préservent la lumière, l'intimité et la paix du voisinage.",
  b15: "Garder les vues sur le paysage et les montagnes donne de la qualité aux classes et au site.",
  b16: "Reprendre les alignements, les arbres et les chemins ancre le projet dans le lieu.",
  b17: "Un terrain libre gardé en réserve permet d'agrandir l'école sans la défaire.",
  c18: "Un préau tenu par les bâtiments est un vrai lieu ; un reste d'implantation n'en est pas un.",
  c19: "La cour doit être à l'abri de la route : sécurité et calme.",
  c20: "5 à 10 m² par élève : assez pour jouer, pas au point de devenir un désert.",
  c21: "Un abri pour les récréations de pluie ; le règlement demande un préau couvert.",
  c22: "Les plus petits et les plus grands ne jouent pas au même endroit.",
  c23: "Un terrain nord-sud évite d'avoir le soleil dans les yeux.",
  c24: "Arbres et sols perméables rafraîchissent la cour et gardent l'eau.",
  c25: "Le règlement demande d'infiltrer les eaux sur place ; la biodiversité en profite.",
  c26: "Les voitures hors de la cour : sécurité des enfants et qualité du lieu.",
  c27: "Bus, parents, vélos et piétons séparés : le règlement l'exige pour la sécurité.",
  c28: "50 places vélos demandées : couvertes et proches, elles servent vraiment.",
  d29: "Un plan simple se comprend, se construit et se transforme facilement.",
  d30: "Un hall généreux accueille, oriente et sert aux rassemblements.",
  d31: "Un couloir large avec des niches devient un lieu de travail, pas une surface perdue.",
  d32: "Des classes regroupées et reliables permettent le travail en groupe entre classes.",
  d33: "Une classe presque carrée et éclairée se meuble librement ; l'orientation solaire le mesure ici.",
  d34: "Les petits sortent directement dehors, sans traverser l'école.",
  d35: "Les petits en bas, les grands en haut : l'école se lit par cycle.",
  d36: "Chaque étage a ses relations propres ; un plan copié les ignore.",
  d37: "Vestiaires près des entrées : moins de salissures et de circulation.",
  d38: "Une salle enterrée à demi réduit la hauteur perçue ; nord-sud, elle évite l'éblouissement.",
  d39: "La salle sert la commune le soir : on y entre sans traverser l'école.",
  d40: "L'UAPE vit à d'autres heures : autonome, mais reliée à l'école.",
  d41: "Voir la cour depuis la salle des maîtres facilite la surveillance.",
  d42: "Moins de cages et un seul ascenseur : moins de surface et de coût.",
  d43: "Technique regroupée et livrable : exploitation simple et moins de gaines.",
  e44: "Une idée forte fait gagner un concours : le jury doit pouvoir la nommer.",
  e45: "La façade dit la structure : ni décor plaqué, ni schéma.",
  e46: "Des espaces intérieurs amples et continus font la qualité d'usage.",
  e47: "Les étapes (école, puis piscine) doivent former un tout.",
  e48: "Des matériaux simples, souvent le bois, vieillissent bien et coûtent peu à entretenir.",
  e49: "Beaucoup de lumière sans éblouissement ; la lumière entre bâtiments le mesure ici.",
  e50: "Une école à la mesure de l'enfant, qu'il peut s'approprier.",
  f51: "Une trame régulière simplifie la structure, le chantier et les changements futurs.",
  f52: "Le bois est souvent demandé par le maître d'ouvrage ; le béton seulement où l'incendie l'impose.",
  f53: "8 à 9 m couvrent une classe sans porter-à-faux coûteux ; les dimensions des volumes le mesurent ici.",
  f54: "Une prouesse structurelle se paie sans bénéfice pour l'école.",
  f55: "Préfabriquer raccourcit le chantier, souvent pendant que l'école fonctionne.",
  f56: "Chaque mètre enterré coûte cher en béton, en énergie grise et en étanchéité.",
  f57: "Une construction démontable garde la valeur de ses matériaux.",
  g58: "Moins de façade par m² : moins de coût, moins de pertes thermiques.",
  g59: "Les circulations coûtent sans servir de salle : limitées, mais utiles.",
  g60: "Construire hors-sol coûte moins cher qu'enterrer, surtout près de la nappe.",
  g61: "Faire beaucoup avec peu : le jury récompense la retenue.",
  g62: "Une emprise réduite laisse du terrain à la cour et à la commune.",
  g63: "Un bâtiment simple coûte peu à exploiter pendant 50 ans.",
  h64: "Le règlement demande Minergie A ou P, ou CECB A/A.",
  h65: "Trop de vitrage surchauffe : 30 à 40 % suffisent à bien éclairer.",
  h66: "Des stores extérieurs et une ventilation de nuit évitent la climatisation.",
  h67: "La masse thermique amortit les pics de chaleur.",
  h68: "Bois, compacité et peu d'enterré réduisent l'énergie grise.",
  h69: "Le règlement prévoit du photovoltaïque en toiture ; le site est raccordé au CAD.",
  h70: "Garder l'existant évite démolition et énergie grise.",
  h71: "Le jury fait contrôler la durabilité : une bonne note compte.",
  i72: "Chaque étape doit donner un projet fini : l'école sans piscine, puis avec.",
  i73: "Pas de pavillons provisoires : ils coûtent et dégradent le site.",
  i74: "L'extension ne doit ni défaire ni affaiblir le projet actuel.",
  i75: "Des plans adaptables survivent aux changements de pédagogie.",
  j76: "Le jury voit des dizaines de projets : l'idée doit se lire en 5 secondes.",
  j77: "Le plan de situation montre ce qui est offert : la cour et l'espace public.",
  j78: "Une coupe montre la pente et le rapport au Casino.",
  j79: "Montrer l'espace d'apprentissage, pas seulement la façade.",
  j80: "Des tableaux justes rassurent le jury sur le respect du programme."
};
JUGES.forEach(function(x){ x.d = POURQUOI[x.id] || ""; });
