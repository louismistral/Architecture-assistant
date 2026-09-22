/* ============================================================================
   LA DOCTRINE DE PROJET — SOURCE UNIQUE DE CE QUE LE RÈGLEMENT NE DIT PAS

   `src/data/rules.js` tient ce qui est OPPOSABLE : le règlement-programme de
   juillet 2026 et la directive AEAI. Ce fichier-ci tient tout le reste — ce que
   nous avons arbitré, préféré, supposé, parce qu'il fallait bien trancher pour
   produire un bâtiment. Les deux générateurs n'ont pas d'autre source de
   réglage : une valeur qui n'est ni dans `rules.js` ni ici est un nombre écrit
   en dur, et c'est un défaut.

   POURQUOI CE FICHIER EXISTE. Les deux tirages étaient gouvernés par une
   trentaine de nombres semés dans `shuffle.js` et `gen.js` — une pièce de sport
   posée au hasard, un sous-sol tiré à pile ou face, un bonus d'alignement de 26
   contre un bonus d'orientation de 10. On obtenait des résultats sans pouvoir
   dire POURQUOI, donc sans pouvoir les corriger autrement qu'à tâtons. Une
   mauvaise proposition se corrige ici, à un endroit, et les deux onglets le
   montrent dans leur volet « Contraintes ».

   CINQ RANGS DE DURETÉ, et c'est la seule hiérarchie qui compte :

     dure    écrite au règlement ou à l'AEAI. Le générateur ne rend jamais une
             composition qui l'enfreint ;
     ferme   arbitrée par nous, faute de donnée opposable, mais APPLIQUÉE comme
             une règle. C'est un choix, et il se discute ;
     forte   préférence lourdement notée : le générateur y renonce seulement
             quand il n'a pas d'autre issue ;
     pref    préférence : elle départage deux compositions également valables ;
     guide   ne pèse sur aucun tirage. Elle oriente la lecture et le contrôle.

   Rien n'est figé : chaque valeur se règle dans le volet « Contraintes » de
   l'onglet qui s'en sert, et l'on rejoue le tirage. C'est tout le propos.
   ========================================================================= */

/* ---------- les valeurs vivantes --------------------------------------------
   Un objet plat, lu par les générateurs à chaque appel. Jamais de copie, jamais
   de cache : bouger une valeur et rejouer le tirage doit suffire. */
export var DOC = {

  /* === RÉPARTITION — combien de niveaux, et quoi à quel niveau ============ */

  /* Ce qu'un plateau peut prendre de la parcelle. L'ancienne valeur était un
     nombre rond — 2'400 m² — sans rapport avec le site : il décidait à lui seul
     du nombre d'étages. Ici, c'est une PART de l'aire réellement posable
     (périmètre moins le recul, soit 10'528 m²), le reste allant à la cour, aux
     accès, au stationnement et aux dégagements entre corps. */
  plateauPart: 0.40,
  /* Le jeu qu'on laisse sur un plateau déduit : sans lui, la répartition est
     coincée au mètre carré près et le moindre arrondi déborde. */
  margePlateau: 1.08,
  /* Une école ne monte pas indéfiniment. Le règlement ne plafonne rien (zone A,
     aucun gabarit), mais les classes ne vont pas au-delà du 2ᵉ étage : un
     quatrième niveau ne logerait plus que du technique. */
  etagesMax: 3,
  /* En deçà, un sous-sol ne se justifie pas : on creuse trois mètres au-dessus
     d'une nappe à 462,25 m pour deux cents mètres carrés de rangement. */
  sousSolMin: 300,

  /* La part de hasard du tirage, en « température » : 0 rend le tirage
     déterministe — toujours la meilleure note —, 1 le rend presque aveugle.
     C'est le seul endroit d'où vient la variation de la répartition. */
  temperature: 0.30,

  /* Les poids de la note de niveau. Ils se comparent entre eux, et c'est tout
     ce qui compte : `adjPoids` à 26 contre `famPoids` à 10 veut dire qu'une
     proximité exigée pèse deux fois et demie la cohérence de famille. */
  placePoids: 30,      /* la place qui reste au niveau */
  debordPoids: 45,     /* poser là ferait déborder le plateau */
  adjPoids: 26,        /* une adjacence exigée satisfaite au même niveau */
  adjOpt: 0.35,        /* une mutualisation possible ne pèse qu'un tiers */
  grappePoids: 20,     /* la grappe de proximité pèse déjà à ce niveau */
  famPoids: 10,        /* la famille d'usage pèse déjà à ce niveau */

  /* L'unité pédagogique : un degré tient sur un niveau, avec ses dégagements.
     Au-delà, on fait un couloir d'hôpital. Dix-huit classes ne se répartissent
     donc pas au prorata de la place libre — elles se groupent. */
  clsParNiveau: 11,
  /* Les classes préfèrent l'étage : le rez reçoit le public, les parents, les
     livraisons et les usages hors horaire. Bonus par étage au-dessus du rez. */
  classeEtage: 8,
  /* Le technique va au sous-sol quand il y en a un : c'est le seul programme
     qui se passe de jour, et il libère du rez. */
  techSousSol: 10,
  /* Bruyant contre calme : sport, musique, ACM et réfectoire ne partagent pas
     volontiers un niveau avec les salles de classe. */
  bruitCalme: 12,

  /* === VOLUMÉTRIE — où, dans quelle direction, à quelle profondeur ======== */

  /* L'OMBRE PORTÉE. Les 6 m de l'AEAI sont une distance d'INCENDIE : deux
     barres de quatre niveaux à six mètres l'une de l'autre sont conformes et
     inhabitables. L'écart utile se mesure à la hauteur du plus haut des deux
     corps. C'est la contrainte qui manquait le plus, et celle qui change le
     plus l'allure d'une composition. */
  ombreK: 1.10,
  ombrePoids: 22,

  /* LA PROFONDEUR ET LE JOUR. Un corps qui loge des salles de classe ne peut
     pas être plus profond que deux rangées de salles : au-delà, les locaux du
     milieu n'ont pas de fenêtre. La cote vient du programme (`profUsuel()`) ;
     ici ne vit que le poids de la pénalité, et il est proportionnel à la PART
     DE CLASSES que le corps porte — un corps de technique a le droit d'être
     épais. */
  profPoids: 18,

  /* L'ORIENTATION. Le règlement la nomme (art. 2.9, usage passif de l'énergie
     solaire). Elle pesait 10 contre 26 pour l'alignement : l'outil rangeait les
     bâtiments sur des lignes plutôt que de les tourner au soleil. Le bonus est
     désormais pondéré par la longueur de la façade, le nombre d'étages et la
     part de classes — une façade sud de dépôt ne vaut pas celle d'un corps de
     classes. */
  sudPoids: 34,
  /* L'alignement reste une préférence : un corps peut prendre n'importe quel
     angle, il gagne seulement à se ranger sur l'axe du périmètre, une limite,
     une route ou le nord-sud. Deux choses distinctes, et il fallait les séparer :
     `alignForce` est ce que le générateur TOURNE un corps vers l'attracteur le
     plus proche au moment de le poser ; `alignPoids` est ce que la note lui
     RAPPORTE ensuite. Un seul nombre faisait les deux, donc on ne pouvait pas
     laisser un corps libre de son angle tout en récompensant celui qui se range. */
  alignForce: 0.70,
  alignPoids: 26,

  /* LA COUR. Le règlement demande 500 m² de cour et 120 m² de préau couvert :
     620 m² de vide QUALIFIÉ, tenu par les bâtiments, pas un reste de terrain.
     Rien ne la composait — elle était une ligne de bilan. On note donc le vide
     que la figure enferme, entre un minimum utile et un maximum au-delà duquel
     ce n'est plus une cour mais un champ. */
  courMin: 620,
  courMax: 2600,
  courPoids: 40,

  /* L'ENTRÉE. Deux dépose-bus rue du Casino, quatre dépose-minute, la mobilité
     douce depuis le chemin du Petit Mont : le règlement dit par où l'on arrive.
     Les routes ne servaient que d'attracteurs d'ANGLE. Au moins un corps doit
     se tenir dans une bande d'approche — ni collé à la route, ni à cent mètres
     d'elle. */
  entreeMin: 8,
  entreeMax: 30,
  entreePoids: 26,

  /* LE TERRAIN. Trois mètres quarante de dénivelé d'est en ouest : un corps
     posé en travers de la pente demande un terrassement. En deçà de la marge,
     on ne dit rien. */
  penteLibre: 1.6,
  pentePoids: 16,

  /* LA NAPPE. Le règlement veut 3,00 m de couverture au-dessus de 462,25 m : on
     ne les trouve qu'au tiers est du site. C'est une règle DURE, donc son poids
     doit peser comme telle. À 90 points par mètre manquant, dix centimètres de
     manque coûtaient neuf points contre cent-six pour l'alignement : le
     générateur préférait un sous-sol hors règle à une composition moins rangée,
     et le contrôle répétait le même conflit à chaque tirage. */
  nappePoids: 120,

  /* L'APLOMB. Le porte-à-faux est permis et il se paie en structure : entre
     deux compositions qui logent le même programme, celle qui tient d'aplomb
     vaut mieux. */
  aplombPoids: 9,

  /* LA COMPACITÉ. Nommée au règlement (art. 2.9, Minergie A ou P). Elle se
     mesure en façade développée par mètre carré bâti — la vraie mesure d'un
     projet économe —, et non par la somme des emprises, qui était quasi
     constante d'une composition à l'autre et ne départageait rien. */
  compaPoids: 18,

  /* PROPORTIONS. Une lame de six mètres de profondeur n'est pas une école, un
     ruban dix fois plus long que large non plus. */
  elanceMax: 9,
  largeurMin: 9,
  elancePoids: 14,
  etroitPoids: 18,

  /* L'ÉPARPILLEMENT : des corps à soixante mètres les uns des autres ne font
     plus un centre scolaire, ils font un lotissement. */
  eparSeuil: 55,
  eparPoids: 0.6,

  /* LA RECHERCHE. `essais` compositions par cran de profondeur ; en « Auto »,
     `essaisParti` tours de reconnaissance par parti avant de concentrer la
     recherche sur les trois meilleurs. Le générateur essayait les onze partis
     à tour de rôle sur trente essais : deux ou trois tirages par parti, donc
     un bon parti éliminé par malchance. */
  essais: 30,
  essaisParti: 3,
  finalistes: 3
};

/* Les valeurs de départ, pour « Rétablir ». Un réglage qu'on ne peut pas
   défaire n'est pas un réglage. */
var DEFAUT = {};
for(var _k in DOC) DEFAUT[_k] = DOC[_k];

export function docDefaut(k){ return DEFAUT[k]; }
export function docSet(k, v){
  if(!(k in DOC)) return false;
  var n = typeof v === "string" ? parseFloat(String(v).replace(",", ".")) : v;
  if(!isFinite(n)) return false;
  var r = regleDe(k);
  if(r && r.min !== undefined) n = Math.max(r.min, Math.min(r.max, n));
  if(n === DOC[k]) return false;
  DOC[k] = n;
  return true;
}
export function docReset(){
  var n = 0;
  for(var k in DEFAUT) if(DOC[k] !== DEFAUT[k]){ DOC[k] = DEFAUT[k]; n++; }
  return n;
}
/* Ce qui s'enregistre : les seules valeurs ÉCARTÉES du défaut. Enregistrer
   l'objet entier figerait la doctrine d'aujourd'hui dans le navigateur, et une
   valeur corrigée dans ce fichier ne parviendrait jamais à qui l'a ouvert. */
export function docOf(){
  var o = {};
  for(var k in DOC) if(DOC[k] !== DEFAUT[k]) o[k] = DOC[k];
  return o;
}
export function setDocs(o){
  if(!o) return;
  for(var k in o) if(k in DOC) docSet(k, o[k]);
}
export function docModifie(){
  for(var k in DOC) if(DOC[k] !== DEFAUT[k]) return true;
  return false;
}

/* ---------- les rangs -------------------------------------------------------- */
export var RANGS = [
  { id:"dure",  n:"Règle dure", court:"dure",
    d:"Écrite au règlement de concours ou à la directive AEAI. Le générateur ne "
      + "rend jamais une composition qui l'enfreint, et le contrôle la marque en rouge." },
  { id:"ferme", n:"Règle ferme", court:"ferme",
    d:"Arbitrée par nous, faute de donnée opposable, mais appliquée COMME une règle. "
      + "C'est un choix de projet : le déplacer change les résultats, et c'est légitime." },
  { id:"forte", n:"Préférence forte", court:"forte",
    d:"Lourdement notée. Le générateur y renonce seulement quand la figure n'a pas "
      + "d'autre issue — et le contrôle le dit alors." },
  { id:"pref",  n:"Préférence", court:"préf.",
    d:"Notée. Elle départage deux compositions également valables ; seule, elle ne "
      + "fait jamais échouer une figure." },
  { id:"guide", n:"Guide", court:"guide",
    d:"Ne pèse sur aucun tirage. Elle oriente la lecture, le contrôle, ou la "
      + "recherche elle-même." }
];
export function rangDe(id){
  for(var i = 0; i < RANGS.length; i++) if(RANGS[i].id === id) return RANGS[i];
  return RANGS[RANGS.length - 1];
}
function rangIdx(id){
  for(var i = 0; i < RANGS.length; i++) if(RANGS[i].id === id) return i;
  return RANGS.length;
}

/* ---------- la table ---------------------------------------------------------
   Une ligne par contrainte, du plus dur au plus mou. `k` désigne la valeur dans
   `DOC` : l'affichage et le comportement ne peuvent donc pas diverger, et le
   volet « Contraintes » écrit dans la même case que celle que le générateur
   lit. Les lignes sans `k` sont des règles de structure — elles ne se chiffrent
   pas, elles s'appliquent ou non.

     dom     "mix" | "mass" | "deux"
     val     texte quand la règle ne porte pas de nombre réglable
     lu      le module qui l'applique, et la ligne où
     agit    ce qui change quand on la bouge
   ========================================================================= */
export var REGLES = [

  /* ===== RÉPARTITION ===================================================== */
  { id:"niv-regl", dom:"mix", rang:"dure", titre:"Niveau imposé par le règlement",
    val:"salle de sport, CAD, piscine, halls, UAPE, administration au rez ; abri PC au rez ou en sous-sol ; classes au plus au 2ᵉ étage",
    source:"règlement art. 2.10", lu:"src/mix/niv.js — NIV, lvRange()",
    pourquoi:"Hauteurs libres, accès camion, accueil du public et évacuation. Ce sont les "
      + "seules cotes que le tirage ne peut pas franchir : elles réduisent les niveaux "
      + "candidats avant toute note.",
    agit:"Un poste dont la règle ne laisse qu'un niveau est posé en premier, et il décide du reste." },

  { id:"jour-ss", dom:"mix", rang:"dure", titre:"Pas de local occupé en sous-sol",
    val:"technique, stockage et nettoyage seulement",
    source:"règlement art. 2.10", lu:"src/mix/checks.js — code jour:<poste>",
    pourquoi:"Lumière naturelle. Un sous-sol ne loge que ce qui s'en passe.",
    agit:"Ferme le sous-sol à tout ce qui n'est pas de la famille technique." },

  { id:"solid", dom:"mix", rang:"dure", titre:"Un poste aux cotes imposées ne se scinde pas",
    val:"salle de sport double, 28 × 32 m",
    source:"règlement art. 2.10", lu:"src/mix/prog.js — p.solid",
    pourquoi:"Le règlement donne les deux cotes : la pièce est une, elle tient d'un seul tenant.",
    agit:"896 m² qui vont entiers à un niveau, et qui tirent leur grappe avec eux." },

  { id:"plateau", dom:"mix", rang:"ferme", titre:"Emprise d'un plateau", k:"plateauPart",
    unite:"de l'aire posable", pct:1, min:0.15, max:0.85, pas:0.01,
    source:"projet", lu:"src/mix/shuffle.js — proposerPile()",
    pourquoi:"L'aire posable est de 10'528 m² (périmètre moins le recul de 5 m). Le reste "
      + "va à la cour, aux accès, au stationnement et aux six mètres entre corps. "
      + "Avant, un plateau valait 2'400 m² — un nombre rond sans rapport avec le site, qui "
      + "décidait pourtant à lui seul du nombre d'étages.",
    agit:"C'est LE réglage du nombre d'étages. Plus on l'ouvre, plus le bâtiment s'étale et s'aplatit." },

  { id:"etages", dom:"mix", rang:"ferme", titre:"Étages au-dessus du rez", k:"etagesMax",
    unite:"niveaux", min:1, max:6, pas:1,
    source:"projet", lu:"src/mix/shuffle.js — proposerPile()",
    pourquoi:"Le règlement ne plafonne rien : zone A, aucun gabarit, aucune hauteur. Mais "
      + "les classes s'arrêtent au 2ᵉ étage, donc un 4ᵉ niveau ne logerait plus que du "
      + "technique au-dessus de vides d'escalier.",
    agit:"Plafonne la pile. Au-delà, le tirage préfère élargir l'emprise." },

  { id:"soussol", dom:"mix", rang:"ferme", titre:"Seuil d'ouverture d'un sous-sol", k:"sousSolMin",
    unite:"m² enterrables", min:0, max:2000, pas:50,
    source:"projet", lu:"src/mix/shuffle.js — proposerPile()",
    pourquoi:"Un sous-sol se creuse trois mètres au-dessus d'une nappe à 462,25 m, et n'est "
      + "tenable qu'au tiers est du site. En deçà du seuil, il ne se justifie pas. "
      + "Avant : un tirage à pile ou face, une fois sur deux — ce qui contredisait "
      + "frontalement l'analyse de site du projet.",
    agit:"Décide s'il y a un sous-sol, et le tirage ne le décide plus au hasard." },

  { id:"unite", dom:"mix", rang:"forte", titre:"Unité pédagogique", k:"clsParNiveau",
    unite:"salles de classe par niveau", min:2, max:24, pas:1,
    source:"usage scolaire",
    lu:"src/mix/shuffle.js — capParNiveau(), etagesDeClasses()",
    pourquoi:"Un degré tient sur un niveau, avec ses dégagements ; au-delà, c'est un "
      + "couloir d'hôpital. Les vingt et une salles se répartissaient au prorata de la "
      + "place libre, donc débordaient d'un étage à l'autre par simple remplissage. La "
      + "règle ne compte que les VRAIES salles de classe — standard et réserve : y "
      + "ajouter le dédoublement, l'ACM et l'appui portait le contingent à vingt-neuf, "
      + "donc à quatre niveaux de classes là où le règlement n'en admet que trois.",
    agit:"Groupe les classes, ET fixe le nombre minimum d'étages de la pile : vingt et une "
      + "salles à onze par niveau en demandent deux." },

  { id:"adj", dom:"mix", rang:"forte", titre:"Adjacence exigée", k:"adjPoids",
    unite:"points", min:0, max:120, pas:2,
    source:"règlement — schéma fonctionnel", lu:"src/mix/shuffle.js — noteNiveau()",
    pourquoi:"Les proximités du schéma (`src/data/schema.js`) ne sont jamais dures : le "
      + "tirage les prend comme des préférences, et `checks.js` dit après coup ce qui n'a "
      + "pas tenu. C'est la règle du projet — rien n'est empêché, rien n'est silencieux.",
    agit:"Plus le poids monte, plus la répartition se tasse sur peu de niveaux." },

  { id:"adjopt", dom:"mix", rang:"pref", titre:"Mutualisation possible", k:"adjOpt",
    unite:"× le poids d'une adjacence", min:0, max:1, pas:0.05,
    source:"règlement — liens optionnels", lu:"src/mix/shuffle.js — noteNiveau()",
    pourquoi:"Une mutualisation est offerte, pas due. Elle ne se compte pas comme une exigence.",
    agit:"Rapproche, sans jamais l'imposer, ce que le règlement suggère de partager." },

  { id:"grappe", dom:"mix", rang:"forte", titre:"Cohésion d'une grappe", k:"grappePoids",
    unite:"points", min:0, max:120, pas:2,
    source:"projet", lu:"src/mix/shuffle.js — noteNiveau()",
    pourquoi:"Une grappe est la composante connexe des adjacences exigées : celle de la "
      + "salle de sport compte quatorze postes. La casser coûte, la tenir rapporte.",
    agit:"Rassemble ce qui se tient. À zéro, une grappe s'éparpille sur trois étages." },

  { id:"cla-haut", dom:"mix", rang:"pref", titre:"Les classes préfèrent l'étage", k:"classeEtage",
    unite:"points par étage", min:0, max:60, pas:1,
    source:"usage scolaire", lu:"src/mix/shuffle.js — noteNiveau()",
    pourquoi:"Le rez reçoit le public, les parents, les livraisons et les usages hors "
      + "horaire — sport, UAPE. Les classes montent, comme dans toute école qui existe.",
    agit:"Vide le rez de ses classes et le laisse aux fonctions d'accueil." },

  { id:"tec-bas", dom:"mix", rang:"pref", titre:"Le technique descend", k:"techSousSol",
    unite:"points", min:0, max:60, pas:1,
    source:"usage", lu:"src/mix/shuffle.js — noteNiveau()",
    pourquoi:"C'est le seul programme qui se passe de jour, et il libère du rez.",
    agit:"Remplit le sous-sol quand il y en a un." },

  { id:"bruit", dom:"mix", rang:"pref", titre:"Bruyant loin du calme", k:"bruitCalme",
    unite:"points", min:0, max:60, pas:1,
    source:"usage", lu:"src/mix/shuffle.js — noteNiveau()",
    pourquoi:"Sport, musique, ACM et réfectoire ne partagent pas volontiers un niveau avec "
      + "les salles de classe. Rien ne le disait.",
    agit:"Sépare les niveaux bruyants des niveaux de classes." },

  { id:"place", dom:"mix", rang:"pref", titre:"Place restante au niveau", k:"placePoids",
    unite:"points", min:0, max:120, pas:2,
    source:"projet", lu:"src/mix/shuffle.js — noteNiveau()",
    pourquoi:"L'ancien tirage ne notait QUE cela : un poste allait au niveau le plus vide. "
      + "D'où des répartitions qui remplissaient sans jamais composer.",
    agit:"Égalise les niveaux. Trop fort, il écrase les adjacences." },

  { id:"debord", dom:"mix", rang:"forte", titre:"Débordement de plateau", k:"debordPoids",
    unite:"points", min:0, max:200, pas:5,
    source:"projet", lu:"src/mix/shuffle.js — noteNiveau()",
    pourquoi:"Le mixer ne refuse rien : il pose quand même, et le contrôle l'annonce en ambre.",
    agit:"Décourage sans interdire de charger un niveau au-delà de son plateau." },

  { id:"temp", dom:"mix", rang:"guide", titre:"Température du tirage", k:"temperature",
    unite:"0 = déterministe", min:0, max:1, pas:0.05,
    source:"projet", lu:"src/mix/shuffle.js — bruit()",
    pourquoi:"C'est le SEUL endroit d'où vient la variation d'une répartition à l'autre. "
      + "Avant, le tirage mélangeait les postes puis les retriait par surface — le tri "
      + "écrasait le mélange, et la variation ne venait que d'un tirage pondéré caché.",
    agit:"À 0, « Shuffle » rend toujours la même chose. À 1, il pose presque n'importe où." },

  /* ===== VOLUMÉTRIE ====================================================== */
  { id:"perim", dom:"mass", rang:"dure", titre:"Rester dans le périmètre du concours",
    val:"tous les étages, y compris les porte-à-faux",
    source:"règlement art. 2.3 — parcelles du concours",
    lu:"src/mass/gen.js — admissible()",
    pourquoi:"Un porte-à-faux qui franchit la limite est du bâti hors parcelle : la "
      + "condition porte sur TOUS les étages, et pas seulement sur l'emprise au sol. "
      + "Ce n'est pas un avertissement : ni le générateur ni le glisser à la souris ne "
      + "posent un corps dehors.",
    agit:"C'est la condition d'existence d'une composition." },

  { id:"recul", dom:"mass", rang:"ferme", titre:"Recul de travail sur le périmètre",
    val:"5 m — soit 2'255 m² d'aire posable en moins (12'783 → 10'528)",
    source:"projet — se corrige dans RULES.dist.retrait",
    lu:"src/data/rules.js — dist.retrait, lu par gen.js et shuffle.js",
    pourquoi:"En zone de constructions publiques A, le PACom ne fixe NI gabarit, NI "
      + "hauteur, NI distance aux limites : ce recul n'est opposable à personne. Nous le "
      + "tenons faute d'alignement routier numérisé, et nous l'appliquons comme une règle "
      + "dure parce que c'est la seule garantie qu'un dessin est posable. C'est le "
      + "meilleur candidat au titre de contrainte à desserrer : il coûte un cinquième de "
      + "la parcelle, et c'est lui qui déclenche « aucune implantation ne tient ».",
    agit:"L'aire posable, donc le nombre d'étages que le mixer déduit ET la place que le "
      + "massing trouve. Il vit encore dans `rules.js` : le déplacer ici demanderait de "
      + "toucher aux deux générateurs, et il n'a qu'un seul chiffre." },

  { id:"aeai", dom:"mass", rang:"dure", titre:"Six mètres entre bâtiments",
    val:"6 m — et rien sur l'existant ni à moins de 6 m de lui",
    source:"AEAI DPI 16-15", lu:"src/mass/gen.js — admissible(), reparer()",
    pourquoi:"Distance d'incendie. Opposable, et la seule distance entre corps qui le soit.",
    agit:"Écarte les corps, et interdit de poser sur le bâtiment de l'ancien Casino." },

  { id:"nappe", dom:"mass", rang:"dure", titre:"Couverture sur la nappe",
    val:"3,00 m au-dessus de 462,25 m",
    source:"règlement art. 2.3", lu:"src/mass/gen.js — enterrer(), noter()",
    pourquoi:"Le terrain monte de 463,3 m à l'ouest à 466,7 m à l'est : la marge sur la "
      + "nappe va de 1,0 m à 4,5 m. Un sous-sol excavé n'est tenable qu'au tiers est.",
    agit:"Les sous-sols vont sous le corps le plus HAUT du site, pas sous le plus grand." },

  { id:"nappep", dom:"mass", rang:"dure", titre:"— ce que coûte un sous-sol hors règle", k:"nappePoids",
    unite:"points", min:0, max:600, pas:10,
    source:"règlement art. 2.3", lu:"src/mass/gen.js — noter(), critère « nappe »",
    pourquoi:"Une règle dure doit peser comme telle dans la note. À 90 points par mètre "
      + "manquant, dix centimètres de manque coûtaient neuf points contre cent-six pour "
      + "l'alignement : le générateur préférait un sous-sol hors règle à une composition "
      + "moins rangée, et le contrôle répétait le même conflit à chaque tirage.",
    agit:"Pousse les sous-sols vers le tiers est du site, où la couverture existe." },

  { id:"sport", dom:"mass", rang:"ferme", titre:"La salle de sport s'implante en premier",
    val:"corps à elle, 28 × 32 m, 7,00 m libres",
    source:"projet", lu:"src/mass/gen.js — ancrer(), poser()",
    pourquoi:"C'est l'objet le plus contraignant du programme : 896 m² qui ne montent pas, "
      + "deux cotes données, sept mètres sous structure. Elle était posée EN DERNIER et au "
      + "hasard, puis réparée — donc elle subissait la composition au lieu de la fonder. "
      + "Dans un projet réel elle s'implante d'abord, souvent sur la partie basse du site.",
    agit:"Donne son point d'appui à toute la figure, et cherche le bas du terrain." },

  { id:"ombre", dom:"mass", rang:"forte", titre:"Écart entre corps pour le jour", k:"ombreK",
    unite:"× la hauteur du plus haut", min:0, max:3, pas:0.05,
    source:"projet", lu:"src/mass/gen.js — noter(), critère « jour »",
    pourquoi:"LA contrainte qui manquait. Les 6 m de l'AEAI sont une distance d'incendie : "
      + "deux barres de quatre niveaux à six mètres sont conformes et inhabitables. "
      + "L'écart utile se mesure à la hauteur.",
    agit:"Desserre la composition, et c'est ce qui change le plus l'allure d'un résultat." },
  { id:"ombrep", dom:"mass", rang:"forte", titre:"— son poids", k:"ombrePoids",
    unite:"points", min:0, max:120, pas:2,
    source:"projet", lu:"src/mass/gen.js — noter()",
    pourquoi:"Assez lourd pour peser contre la compacité, pas assez pour empêcher une figure.",
    agit:"Arbitre entre serrer et éclairer." },

  { id:"prof", dom:"mass", rang:"forte", titre:"Profondeur d'un corps de classes", k:"profPoids",
    unite:"points", min:0, max:120, pas:2,
    source:"programme", lu:"src/mass/gen.js — noter(), critère « profondeur »",
    pourquoi:"La cote vient du programme et non d'un réglage : deux rangées de salles prises "
      + "à leur surface bâtie (`profUsuel()`). La pénalité est proportionnelle à la PART DE "
      + "CLASSES que le corps porte — un corps de technique a le droit d'être épais. Avant, "
      + "la note ignorait totalement le programme : une classe pouvait atterrir au cœur d'un "
      + "bloc de 46 m sans que rien ne le dise.",
    agit:"Affine les corps qui logent des classes, et laisse grossir les autres." },

  { id:"sud", dom:"mass", rang:"forte", titre:"Orientation des façades", k:"sudPoids",
    unite:"points", min:0, max:120, pas:2,
    source:"règlement art. 2.9", lu:"src/mass/gen.js — noter(), critère « sud »",
    pourquoi:"Le règlement nomme l'usage passif de l'énergie solaire. Le bonus valait 10 "
      + "contre 26 pour l'alignement : l'outil rangeait les bâtiments sur des lignes plutôt "
      + "que de les tourner au soleil. Il est maintenant pondéré par la longueur de façade, "
      + "le nombre d'étages et la part de classes.",
    agit:"Tourne les corps de classes vers le sud." },

  { id:"cour", dom:"mass", rang:"forte", titre:"Cour tenue par les bâtiments", k:"courPoids",
    unite:"points", min:0, max:120, pas:2,
    source:"règlement art. 2.10", lu:"src/mass/gen.js — noter(), critère « cour »",
    pourquoi:"500 m² de cour et 120 m² de préau : un vide QUALIFIÉ, tenu par les corps, pas "
      + "un reste de terrain. Rien ne le composait — la cour était une ligne de bilan, hors "
      + "enveloppe. C'est pourtant ce qui distingue une école d'un groupe de bureaux.",
    agit:"Pousse les corps à se faire face au lieu de s'aligner côte à côte." },
  { id:"courmin", dom:"mass", rang:"pref", titre:"— vide utile, minimum", k:"courMin",
    unite:"m²", min:0, max:4000, pas:20, source:"règlement art. 2.10",
    lu:"src/mass/gen.js — noter()",
    pourquoi:"500 m² de cour plus 120 m² de préau couvert.", agit:"En deçà, le vide ne compte pas comme une cour." },
  { id:"courmax", dom:"mass", rang:"pref", titre:"— vide utile, maximum", k:"courMax",
    unite:"m²", min:100, max:12000, pas:100, source:"projet",
    lu:"src/mass/gen.js — noter()",
    pourquoi:"Au-delà, ce n'est plus une cour : c'est un champ entre deux bâtiments.",
    agit:"Empêche la prime au vide de récompenser l'éparpillement." },

  { id:"entree", dom:"mass", rang:"pref", titre:"Adresse du corps principal", k:"entreePoids",
    unite:"points", min:0, max:120, pas:2,
    source:"règlement art. 2.4", lu:"src/mass/gen.js — noter(), critère « adresse »",
    pourquoi:"Deux dépose-bus rue du Casino, quatre dépose-minute, mobilité douce depuis le "
      + "chemin du Petit Mont. Les routes ne servaient que d'attracteurs d'ANGLE : rien ne "
      + "demandait qu'un bâtiment soit joignable. La règle porte sur le PLUS GRAND corps et "
      + "sur lui seul : « au moins un corps près d'une rue » était vrai de toute composition, "
      + "le site étant bordé de rues sur trois côtés. Et le calque des routes du relevé est "
      + "filtré aux polylignes de plus de soixante mètres — les vraies voies —, sans quoi un "
      + "bord de place ou une entrée de garage comptait pour une rue.",
    agit:"Empêche de reléguer le bâtiment principal au fond de la parcelle." },
  { id:"entreeb", dom:"mass", rang:"guide", titre:"— la bande", k:"entreeMax",
    unite:"m au plus d'une voie", min:10, max:150, pas:5, source:"projet",
    lu:"src/mass/gen.js — noter()",
    pourquoi:"Le point le plus enfoui de la parcelle est à 46 m d'une voie : au-delà de "
      + "trente, le critère ne départage plus rien.", agit:"Largeur de la bande d'approche." },

  { id:"alignf", dom:"mass", rang:"pref", titre:"Force d'alignement à la pose", k:"alignForce",
    unite:"0 = angle libre, 1 = collé à l'attracteur", min:0, max:1, pas:0.05,
    source:"projet", lu:"src/mass/gen.js — poser()",
    pourquoi:"Ce que le générateur TOURNE un corps vers l'attracteur le plus proche au moment "
      + "de le poser. C'est distinct de ce que la note lui rapporte ensuite ; un seul nombre "
      + "faisait les deux.",
    agit:"À 0, les corps prennent l'angle que le parti leur donne et rien d'autre." },

  { id:"align", dom:"mass", rang:"pref", titre:"Alignement — ce qu'il rapporte", k:"alignPoids",
    unite:"points", min:0, max:120, pas:2,
    source:"projet", lu:"src/mass/gen.js — poser(), noter()",
    pourquoi:"Axe du périmètre, perpendiculaire, longues limites de parcelle, routes, "
      + "nord-sud. Ce sont des PRÉFÉRENCES notées, jamais des règles : un corps peut prendre "
      + "n'importe quel angle, il gagne seulement à se ranger.",
    agit:"Range la composition sur le site. Trop fort, il l'emporte sur l'orientation." },

  { id:"compa", dom:"mass", rang:"pref", titre:"Compacité", k:"compaPoids",
    unite:"points", min:0, max:120, pas:2,
    source:"règlement art. 2.9", lu:"src/mass/gen.js — noter(), critère « compacité »",
    pourquoi:"Minergie A ou P. Mesurée en façade développée par mètre carré bâti — la vraie "
      + "mesure d'un projet économe. L'ancien terme sommait les emprises, ce qui est presque "
      + "constant d'une composition à l'autre : il ne départageait rien.",
    agit:"Préfère peu de corps épais à beaucoup de corps minces — et se bat donc contre le jour." },

  { id:"pente", dom:"mass", rang:"pref", titre:"Terrassement", k:"pentePoids",
    unite:"points", min:0, max:120, pas:2,
    source:"règlement art. 2.3", lu:"src/mass/gen.js — noter()",
    pourquoi:"3,40 m de dénivelé d'est en ouest. Un corps en travers de la pente demande un "
      + "terrassement, ou un niveau décroché.", agit:"Range les corps dans le sens des courbes." },
  { id:"pentem", dom:"mass", rang:"guide", titre:"— marge sans pénalité", k:"penteLibre",
    unite:"m de dénivelé", min:0, max:6, pas:0.1, source:"projet",
    lu:"src/mass/gen.js — noter()", pourquoi:"En deçà, on ne dit rien.",
    agit:"Seuil de déclenchement du terrassement." },

  { id:"aplomb", dom:"mass", rang:"pref", titre:"Aplomb", k:"aplombPoids",
    unite:"points", min:0, max:120, pas:1,
    source:"projet", lu:"src/mass/gen.js — noter()",
    pourquoi:"Le porte-à-faux est permis et il se paie en structure : entre deux "
      + "compositions qui logent le même programme, celle qui tient d'aplomb vaut mieux.",
    agit:"Empile les étages plutôt que de les décaler." },

  { id:"elan", dom:"mass", rang:"pref", titre:"Élancement maximum", k:"elanceMax",
    unite:"× plus long que large", min:2, max:30, pas:1, source:"projet",
    lu:"src/mass/gen.js — noter()", pourquoi:"Un ruban dix fois plus long que large n'est pas un bâtiment.",
    agit:"Épaissit les barres." },
  { id:"etroit", dom:"mass", rang:"pref", titre:"Largeur minimale d'un corps", k:"largeurMin",
    unite:"m", min:4, max:30, pas:1, source:"projet",
    lu:"src/mass/gen.js — noter()", pourquoi:"Une salle de classe en demande neuf avec son couloir.",
    agit:"Interdit en pratique les lames trop minces." },
  { id:"epar", dom:"mass", rang:"pref", titre:"Éparpillement", k:"eparSeuil",
    unite:"m entre corps avant pénalité", min:10, max:200, pas:5, source:"projet",
    lu:"src/mass/gen.js — noter()",
    pourquoi:"Des corps à soixante mètres les uns des autres ne font plus un centre "
      + "scolaire, ils font un lotissement.", agit:"Resserre la figure." },

  { id:"rech", dom:"mass", rang:"guide", titre:"Compositions essayées", k:"essais",
    unite:"par cran de profondeur", min:5, max:200, pas:5, source:"projet",
    lu:"src/mass/gen.js — genMass()",
    pourquoi:"Le générateur compose, mesure et jette. Plus d'essais, meilleure composition, "
      + "et un tirage plus lent.", agit:"Qualité contre temps de calcul." },
  { id:"rech2", dom:"mass", rang:"guide", titre:"— reconnaissance par parti en Auto", k:"essaisParti",
    unite:"essais", min:1, max:20, pas:1, source:"projet",
    lu:"src/mass/gen.js — genMass()",
    pourquoi:"« Auto » essayait les onze partis à tour de rôle sur trente essais : deux ou "
      + "trois tirages chacun, donc un bon parti éliminé par malchance. On reconnaît d'abord, "
      + "puis on concentre la recherche sur les meilleurs.",
    agit:"Rend le choix du parti en Auto beaucoup moins aléatoire." }
];

/* Triées par dureté, puis dans l'ordre d'écriture — qui est celui du raisonnement. */
export function reglesDe(dom){
  return REGLES.filter(function(r){ return r.dom === dom || r.dom === "deux"; })
               .slice()
               .sort(function(a, b){ return rangIdx(a.rang) - rangIdx(b.rang); });
}
export function regleDe(k){
  for(var i = 0; i < REGLES.length; i++) if(REGLES[i].k === k) return REGLES[i];
  return null;
}

/* ---------- les outils de génération -----------------------------------------
   « Je veux voir quels sont tous nos outils de génération, et sur quoi ils
   influent. » Cette table est cet inventaire, et elle est affichée telle quelle
   dans les deux volets. Un module de génération qui n'y figure pas est un module
   dont personne ne sait ce qu'il décide. */
export var SCRIPTS = [
  { dom:"mix", f:"src/mix/shuffle.js", n:"Le tirage de répartition",
    lit:"le programme (`prog.js`), les règles de niveau (`niv.js`), les adjacences "
      + "(`schema.js`), la part de circulation, l'aire posable de la parcelle",
    decide:"le nombre de sous-sols et d'étages, l'emprise de chaque plateau, et quel poste "
      + "va à quel niveau, en combien de parts",
    agit:"tout le reste de l'application : le massing relit ces niveaux, la typologie les relira",
    hasard:"graine du mixer (`core/rand.js`) · température" },

  { dom:"mix", f:"src/mix/niv.js", n:"Les règles de niveau",
    lit:"`data/rules.js` et le nom de chaque poste",
    decide:"les cotes admissibles d'un poste — `lvRange()` —, et son ancre quand le "
      + "règlement le veut au même niveau qu'un autre",
    agit:"réduit les niveaux candidats AVANT toute note : c'est le filtre dur du tirage",
    hasard:"aucun" },

  { dom:"mix", f:"src/mix/checks.js", n:"Le contrôle de répartition",
    lit:"la répartition posée, `rules.js`, les adjacences",
    decide:"rien — il dit. Rouge pour une règle écrite, ambre pour une règle de projet",
    agit:"le verdict, les remèdes cliquables (`fix.js`) et les écarts qu'on assume (`accept.js`)",
    hasard:"aucun" },

  { dom:"mix", f:"src/core/treemap.js", n:"Le pavage squarifié",
    lit:"les surfaces des postes d'un niveau",
    decide:"la géométrie du dessin d'un niveau — un bloc vaut exactement sa surface",
    agit:"la lecture du mixer, et le pavage d'un volume dans le massing",
    hasard:"aucun" },

  { dom:"mix", f:"src/core/rand.js", n:"Le générateur pseudo-aléatoire du mixer",
    lit:"une graine de 32 bits, affichée et re-saisissable",
    decide:"toute la variation de la répartition",
    agit:"rend une proposition REJOUABLE : sans graine, on tire dix fois et la troisième, "
      + "qui était la bonne, n'existe plus",
    hasard:"mulberry32 · graine affichée en base 36" },

  { dom:"mass", f:"src/mass/gen.js", n:"Le générateur de volumétrie",
    lit:"les niveaux du mixer, le relevé du site, `rules.js`, la doctrine ci-dessus",
    decide:"combien de corps, où, dans quelle direction, à quelle profondeur, jusqu'à quel "
      + "étage, avec quels retraits",
    agit:"le plan et la 3D — c'est la proposition architecturale elle-même",
    hasard:"graine du massing (`MASS.graine`), distincte de celle du mixer" },

  { dom:"mass", f:"src/mass/gen.js — figure()", n:"Les douze partis",
    lit:"le parti choisi, le nombre de niveaux à loger",
    decide:"la FIGURE : combien de corps, comment ils se tiennent les uns par rapport aux "
      + "autres, comment la pile se dégrade en montant",
    agit:"l'allure générale. « Auto » les essaie tous et garde celui qui tient le mieux",
    hasard:"oui — nombre de corps, poids, angles et positions sont tirés dans des bornes" },

  { dom:"mass", f:"src/mass/gen.js — monter()", n:"Le partage des surfaces",
    lit:"la surface bâtie de chaque niveau, les poids des corps",
    decide:"quelle part de chaque niveau va à chaque corps, et donc ses cotes",
    agit:"l'invariant du massing : la somme des emprises vaut la surface du niveau. "
      + "Profondeur constante du rez au faîte, plafond de l'étage du dessous, promotion "
      + "d'office — c'est ce qui évite les porte-à-faux d'artefact",
    hasard:"aucun — le programme décide" },

  { dom:"mass", f:"src/mass/gen.js — noter()", n:"La note d'une composition",
    lit:"la doctrine, la géométrie posée, le programme porté par chaque corps",
    decide:"laquelle des N compositions est gardée",
    agit:"TOUT le caractère du résultat. C'est ici qu'on corrige un mauvais massing : "
      + "chaque critère est nommé, et son poids se règle ci-dessus",
    hasard:"aucun — elle départage" },

  { dom:"mass", f:"src/mass/gen.js — reparer() / repecher()", n:"La réparation",
    lit:"le périmètre, les corps, l'existant",
    decide:"ramène un corps qui sort, qui touche un voisin ou qui percute l'existant ; "
      + "et, s'il n'a aucune issue par petits pas, balaie la parcelle pour la position "
      + "admissible la plus proche, quart de tour compris",
    agit:"c'est ce qui distingue un générateur d'un tirage : une figure qui ne tient pas "
      + "est reprise, pas avertie",
    hasard:"aucun" },

  { dom:"mass", f:"src/mass/checks.js", n:"Le contrôle de volumétrie",
    lit:"les volumes posés, le site, `rules.js` et la doctrine",
    decide:"rien — il dit, en trois niveaux : erreur, à vérifier, info",
    agit:"le bilan de surface niveau par niveau, et la liste d'alertes du rail",
    hasard:"aucun" },

  { dom:"mass", f:"src/mass/geom.js", n:"La géométrie du site",
    lit:"`data/site.js` — le relevé engendré du fichier Rhino",
    decide:"terrain interpolé, assise d'un volume, distances entre rectangles tournés, "
      + "aire posable, attracteurs d'alignement",
    agit:"toutes les mesures du massing. Aucune règle n'y vit",
    hasard:"aucun" }
];
export function scriptsDe(dom){
  return SCRIPTS.filter(function(s){ return s.dom === dom || s.dom === "deux"; });
}

/* ---------- ce que le hasard décide, en toutes lettres -----------------------
   Un générateur dont on ne sait pas ce qu'il tire est un générateur qu'on subit. */
export var TIRAGES = [
  { dom:"mix", quoi:"Le nombre de niveaux",
    comment:"toutes les piles admissibles sont construites — celles dont le plateau déduit "
      + "tient dans l'emprise et dont les étages ne dépassent pas le plafond —, puis l'une "
      + "d'elles est tirée, les plus compactes d'abord. Ce n'est plus un pile ou face." },
  { dom:"mix", quoi:"L'ordre de pose",
    comment:"les postes dont le règlement ne laisse qu'un niveau passent d'abord, les plus "
      + "grands en tête ; puis ceux qui suivent une ancre ; puis le reste." },
  { dom:"mix", quoi:"Le niveau d'un poste",
    comment:"chaque niveau candidat reçoit une note, un bruit de Gumbel d'amplitude "
      + "`température` s'y ajoute, et le meilleur gagne. À température nulle, le tirage est "
      + "déterministe et rend toujours la meilleure répartition." },
  { dom:"mass", quoi:"Le parti, en mode Auto",
    comment:"tous les partis sont reconnus sur quelques essais, les meilleurs sont retenus, "
      + "et la recherche se concentre sur eux." },
  { dom:"mass", quoi:"La figure",
    comment:"nombre de corps, poids relatifs, angles, positions dans le cadre : tirés dans "
      + "des bornes propres à chaque parti." },
  { dom:"mass", quoi:"L'orientation générale",
    comment:"un jeu de ±0,11 rad autour de l'axe du périmètre — sans lui, les N compositions "
      + "d'un même parti seraient la même." },
  { dom:"mass", quoi:"La position de la salle de sport",
    comment:"tirée dans la moitié basse du site, puis retenue si elle est admissible : elle "
      + "est l'ancre, tout le reste se compose autour d'elle." }
];
export function tiragesDe(dom){
  return TIRAGES.filter(function(t){ return t.dom === dom || t.dom === "deux"; });
}
