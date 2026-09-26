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

  /* === VOLUMÉTRIE — trois rangs, et AUCUN point ============================
     Le générateur ne somme plus rien. Il jette ce qui enfreint une contrainte
     DURE, garde parmi le reste ce qu'aucune autre variante ne bat sur les
     priorités FORTES, et ne départage par les PRÉFÉRENCES que des variantes
     équivalentes sur les fortes. Les valeurs ci-dessous sont des seuils, jamais
     des poids : elles disent où finit « favorable » et où commence
     « défavorable ». Voir `src/mass/juge.js`. */

  /* Dures. `distMin` ne descend pas sous les 6 m de l'AEAI (RULES.dist.entre) :
     on peut en demander PLUS, le générateur ne vise pas six mètres. La
     profondeur d'un corps est sa PETITE cote ; `profMin` est le réglage de
     l'utilisateur, `largeurMin` son plancher absolu. La cour se mesure en
     surface utile libre devant une façade d'école (500 m² + 120 m² de préau). */
  distMin: 6,
  largeurMin: 11,
  profMin: 11,
  profMax: 28,
  courMin: 620,
  module: 0.5,

  /* Fortes. Une façade longue dont la normale est à moins de `orientBon` degrés
     du sud (ou de la vue) est favorable, au-delà de `orientMax` défavorable.
     Le jour : l'écart entre façades qui se font face vaut `ombreK` fois la
     hauteur du plus haut. La compacité : façade développée par m² de plancher —
     les seuils sont calés sur les variantes valides du site (le rez prend les
     7,40 m de la salle de sport, d'où des valeurs proches de 1).
     La cour : au-delà de `courBon`, elle est jugée généreuse. */
  orientBon: 30,
  orientMax: 60,
  ombreK: 1.10,
  compaBon: 0.95,
  compaMax: 1.10,
  courBon: 1500,

  /* Préférences. Dénivelé sous une emprise, porte-à-faux au-delà duquel on
     avertit, élancement d'un corps — garde-fous secondaires. */
  penteMax: 2,
  pafMax: 3,
  elanceMax: 9,

  /* Paramètres du générateur — pas des contraintes d'architecture : combien
     d'essais, jusqu'où l'on mesure une cour devant une façade, la longueur et
     la largeur d'une passerelle. */
  essais: 40,
  essaisParti: 4,
  courFond: 30,
  passMax: 24,
  passLarg: 3
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
/* LE MASSING n'a que trois rangs. `poids` n'est qu'une ÉCHELLE D'AFFICHAGE :
   chaque critère rend une qualité entre −1 et +1 ; les poids des rangs forte et
   pref disent leur PROPORTION dans la NOTE, ramenée SUR 100 — une composition
   qui répond pleinement à tout vaut 100 (`juge.js — noter()`). Une contrainte
   dure respectée vaut 0, chaque écart coûte 100. Le générateur ne lit pas la
   note : il choisit par la hiérarchie. */
/* Rangs : une contrainte DURE
   rend une variante invalide, une priorité FORTE écarte les variantes qu'une
   autre bat, une PRÉFÉRENCE ne départage que des variantes égales sur les
   fortes. Les paramètres de recherche sont à part : ils ne disent rien de
   l'architecture. */
export var RANGS_MASS = [
  { id:"dure",  n:"Contraintes dures", court:"obligatoire", poids:100,
    d:"Toujours respectées. Une variante qui en enfreint une est invalide et n'est "
      + "jamais proposée." },
  { id:"forte", n:"Priorités fortes", court:"à favoriser", poids:40,
    d:"Le générateur écarte toute variante qu'une autre bat sur ces critères. Elles "
      + "peuvent céder : aucune ne rend seule une variante invalide." },
  { id:"pref",  n:"Préférences", court:"départage", poids:15,
    d:"Ne départagent que des variantes valides et équivalentes sur les priorités fortes." },
  { id:"param", n:"Paramètres du générateur", court:"recherche",
    d:"Réglages de la recherche, pas de l'architecture." }
];
export function rangsDe(dom){ return dom === "mass" ? RANGS_MASS : RANGS; }

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

  /* ===== VOLUMÉTRIE ======================================================
     Trois rangs — dure, forte, pref — et les paramètres du générateur à part.
     L'`id` d'une ligne dure ou forte est celui que `src/mass/juge.js` rend :
     le volet affiche, à côté de chaque règle, ce qu'elle dit de la
     composition à l'écran. */
  { id:"perim", dom:"mass", rang:"dure", titre:"Périmètre constructible et recul PACom",
    val:"5 m de recul, tous les étages, porte-à-faux et passerelles compris",
    source:"PACom · règlement art. 2.3", lu:"src/mass/gen.js — admissible()",
    pourquoi:"Tout le bâti reste dans le périmètre du concours, à 5 m au moins de sa "
      + "limite. Un porte-à-faux qui franchit le recul est du bâti hors limite.",
    agit:"Condition d'existence d'une variante. Le recul vit dans RULES.dist.retrait." },
  { id:"dist", dom:"mass", rang:"dure", titre:"Distance entre bâtiments", k:"distMin",
    unite:"m au moins", min:6, max:40, pas:0.5, source:"AEAI DPI 16-15",
    lu:"src/mass/gen.js — admissible()",
    pourquoi:"Un minimum, pas une cible : deux corps peuvent être bien plus loin. "
      + "Mesurée à tous les étages. Un corps ACCOLÉ (salle de sport intégrée) fait un "
      + "seul bâtiment avec son voisin et n'y est pas soumis.",
    agit:"Jette toute variante où deux bâtiments sont plus près." },
  { id:"existant", dom:"mass", rang:"dure", titre:"Bâtiments existants",
    val:"rien dessus, et la même distance minimale", source:"règlement art. 2.3 · AEAI",
    lu:"src/mass/gen.js — admissible()",
    pourquoi:"On ne construit pas sur l'ancien Casino ni à côté de lui sans la distance "
      + "incendie.", agit:"Jette la variante." },
  { id:"largeur", dom:"mass", rang:"dure", titre:"Largeur minimale d'un corps", k:"largeurMin",
    unite:"m, sur les deux cotes", min:6, max:20, pas:0.5, source:"projet",
    lu:"src/mass/juge.js — dures()",
    pourquoi:"Plancher absolu, à tous les étages : en deçà, un corps n'accueille plus une "
      + "salle et sa circulation.", agit:"Jette la variante ; borne la profondeur minimale." },
  { id:"prof", dom:"mass", rang:"dure", titre:"Profondeur minimale d'un corps", k:"profMin",
    unite:"m", min:6, max:28, pas:0.5, source:"paramètre de l'utilisateur",
    lu:"src/mass/gen.js — cotes() · src/mass/juge.js — dures()",
    pourquoi:"La profondeur est la petite cote d'un corps. C'est le premier choix d'un "
      + "projet d'école, il vous appartient. Elle ne descend pas sous la largeur minimale.",
    agit:"Le générateur tire ses profondeurs entre ce minimum et le maximum." },
  { id:"profmax", dom:"mass", rang:"dure", titre:"— profondeur maximale", k:"profMax",
    unite:"m", min:11, max:40, pas:0.5, source:"règlement art. 2.10 — la salle de sport",
    lu:"src/mass/juge.js — dures()",
    pourquoi:"Au-delà de la petite cote du local le plus profond du programme, on bâtit "
      + "de la profondeur sans jour. La salle de sport garde ses cotes du règlement.",
    agit:"Jette la variante ; plafonne la poignée de redimensionnement." },
  { id:"facade", dom:"mass", rang:"dure", titre:"Toutes les salles de classe en façade",
    val:"un corps qui porte des classes n'a pas plus de deux salles de profondeur",
    source:"projet — jour naturel", lu:"src/mass/model.js — profFacade()",
    pourquoi:"Deux rangées de salles de classe prises à leur surface bâtie, circulation "
      + "comprise : au-delà, une salle se retrouve au milieu du corps, sans fenêtre. La "
      + "cote vient du programme, pas d'un réglage.",
    agit:"Jette la variante ; plafonne la profondeur tirée pour les corps d'école." },
  { id:"module", dom:"mass", rang:"dure", titre:"Module dimensionnel",
    val:"0,50 m — toutes les cotes des corps", source:"projet",
    lu:"src/mass/model.js — auModule()",
    pourquoi:"Les cotes intérieures des corps sont des multiples de 0,50 m, comme les "
      + "proportions des pièces (`core/geometry.js`). Le pavage des salles DANS un corps "
      + "relève de la typologie.", agit:"Arrondit toutes les cotes ; jette ce qui y échappe." },
  { id:"cour", dom:"mass", rang:"dure", titre:"Cour — surface utile minimale", k:"courMin",
    unite:"m²", min:0, max:5000, pas:20, source:"règlement art. 2.10 — 500 m² + 120 m² de préau",
    lu:"src/mass/juge.js — courUtile()",
    pourquoi:"Le terrain libre d'un seul tenant devant une façade d'école, dans le "
      + "périmètre, hors de tout bâtiment. Pas de maximum.",
    agit:"Jette toute variante qui ne l'offre pas." },
  { id:"abri", dom:"mass", rang:"dure", titre:"Abri PC au moins partiellement enterré",
    val:"au sous-sol, ou au rez d'un corps posé sur la pente", source:"règlement — abri PC",
    lu:"src/mass/juge.js — dures()",
    pourquoi:"Le niveau de l'abri est décidé au mixer. S'il est au rez, un corps qui le porte "
      + "doit s'enterrer d'au moins un mètre dans la pente.",
    agit:"Quand aucune composition ne peut y répondre, le contrôle renvoie au mixer." },
  { id:"sport", dom:"mass", rang:"dure", titre:"Salle de sport double",
    val:"28 × 32 m, 7,00 m libres, rien au-dessus", source:"règlement art. 2.10",
    lu:"src/mass/gen.js — corpsImpose(), accoler()",
    pourquoi:"Ses cotes et sa hauteur sont obligatoires, et aucun étage ne la surmonte. "
      + "Elle n'est pas forcément posée la première ni forcément à part : une variante "
      + "sur trois environ l'accole au corps principal, et elle fait alors partie du bâtiment.",
    agit:"Jette toute variante qui la surmonte ou la déforme." },

  { id:"soleil", dom:"mass", rang:"forte", titre:"Orientation solaire", k:"orientBon",
    unite:"° du sud au plus — favorable", min:5, max:80, pas:5, source:"règlement art. 2.9",
    lu:"src/mass/juge.js — qualites()",
    pourquoi:"Chaque corps se juge sur SA façade longue : les corps peuvent prendre des "
      + "orientations différentes, aucune n'est imposée. Le relevé est en coordonnées "
      + "suisses, nord en haut.", agit:"Un tiers des variantes tourne la figure vers l'optimum soleil-vue." },
  { id:"orientmax", dom:"mass", rang:"forte", titre:"— défavorable au-delà de", k:"orientMax",
    unite:"°", min:10, max:90, pas:5, source:"projet", lu:"src/mass/juge.js — qualites()",
    pourquoi:"Entre les deux seuils, l'orientation est acceptable. Le même couple de seuils "
      + "juge la vue.", agit:"" },
  { id:"vue", dom:"mass", rang:"forte", titre:"Vue vers le nord-ouest",
    val:"vers le terrain de football du relevé", source:"site",
    lu:"src/mass/geom.js — cibleVue()",
    pourquoi:"La vue la plus intéressante du site. Jugée pour les corps qui portent des "
      + "classes : l'angle entre leur façade longue et la direction du terrain de football.",
    agit:"Départage des variantes également ensoleillées." },
  { id:"jour", dom:"mass", rang:"forte", titre:"Lumière entre bâtiments", k:"ombreK",
    unite:"× la hauteur du plus haut", min:0, max:3, pas:0.05, source:"projet",
    lu:"src/mass/juge.js — qualites() · gen.js — reparer()",
    pourquoi:"Indication, pas une contrainte : seuls les 6 m sont dus. Entre façades qui se "
      + "font face.", agit:"La réparation écarte doucement les corps vers cet écart." },
  { id:"compa", dom:"mass", rang:"forte", titre:"Compacité", k:"compaBon",
    unite:"m² de façade par m² de plancher — favorable", min:0.1, max:1, pas:0.01,
    source:"règlement art. 2.9 — Minergie", lu:"src/mass/juge.js — qualites()",
    pourquoi:"Préférable quand elle loge bien le programme ; une variante moins compacte "
      + "mais meilleure ailleurs n'est jamais écartée pour ce seul motif.", agit:"" },
  { id:"compamax", dom:"mass", rang:"forte", titre:"— défavorable au-delà de", k:"compaMax",
    unite:"m²/m²", min:0.1, max:1.5, pas:0.01, source:"projet",
    lu:"src/mass/juge.js — qualites()", pourquoi:"", agit:"" },
  { id:"courq", dom:"mass", rang:"forte", titre:"Cour généreuse", k:"courBon",
    unite:"m² de cour utile", min:0, max:8000, pas:50, source:"projet",
    lu:"src/mass/juge.js — qualites()",
    pourquoi:"Plus grande que le minimum, c'est mieux, tant qu'elle reste devant une façade "
      + "d'école. Tenue ou ouverte : aucune forme n'est imposée.", agit:"" },

  { id:"align", dom:"mass", rang:"pref", titre:"Alignement",
    val:"sur le site ou sur un voisin — jamais dû", source:"projet",
    lu:"src/mass/juge.js — qualites()",
    pourquoi:"Un corps rangé sur l'axe du périmètre, une limite, une route ou un autre corps "
      + "est préféré à égalité du reste. Rien n'oblige à s'aligner.", agit:"" },
  { id:"aplomb", dom:"mass", rang:"pref", titre:"Porte-à-faux", k:"pafMax",
    unite:"m — au-delà, on avertit", min:0, max:15, pas:0.5, source:"projet",
    lu:"src/mass/juge.js — qualites() · checks.js",
    pourquoi:"Autorisé. Préférer l'aplomb à égalité du reste, et signaler un débord important.",
    agit:"" },
  { id:"pente", dom:"mass", rang:"pref", titre:"Terrassement", k:"penteMax",
    unite:"m de dénivelé sous une emprise", min:0.5, max:6, pas:0.1,
    source:"relevé — terrain maillé", lu:"src/mass/juge.js — qualites()",
    pourquoi:"Le dénivelé du terrain réel sous chaque emprise. Moitié du seuil : favorable ; "
      + "au-delà du seuil : terrassement important.", agit:"" },
  { id:"elan", dom:"mass", rang:"pref", titre:"Élancement", k:"elanceMax",
    unite:"× plus long que large", min:2, max:30, pas:1, source:"projet",
    lu:"src/mass/juge.js — qualites()", pourquoi:"Garde-fou secondaire.", agit:"" },
  { id:"connex", dom:"mass", rang:"pref", titre:"Connexions",
    val:"corps accolés ou reliés par passerelle", source:"projet",
    lu:"src/mass/gen.js — relier()",
    pourquoi:"Une école d'un seul tenant est préférée à égalité du reste. Les passerelles "
      + "relient sans fusionner ; le générateur n'en pose que dans une partie des "
      + "variantes, et seulement entre corps qui ne sont pas déjà reliés.", agit:"" },
  { id:"terrain", dom:"mass", rang:"pref", titre:"Accès et stationnement",
    val:"terrain libre pour la cour et 70 places de parc", source:"règlement art. 2.4",
    lu:"src/mass/juge.js — terrainLibre()",
    pourquoi:"Deux dépose-bus, quatre dépose-minute, 70 places : ce que les bâtiments "
      + "laissent du terrain posable doit pouvoir les accueillir, avec la cour.", agit:"" },
  { id:"nappe", dom:"mass", rang:"pref", titre:"Nappe et sous-sol",
    val:"3,00 m de terrain au-dessus de 462,25 m sous tout sous-sol",
    source:"règlement art. 2.3", lu:"src/mass/gen.js — enterrer() · juge.js — qualites()",
    pourquoi:"Même lecture qu'avant, sans l'inverser : l'altitude moyenne du terrain sous "
      + "le corps qui porte un sous-sol doit dépasser la nappe (462,25 m) d'au moins "
      + "3,00 m (RULES.dist.couverture). Le terrain va de 463,3 à 466,7 m : seul le tiers "
      + "est l'offre. Une préférence, plus une contrainte dure : une variante qui creuse "
      + "trop bas reste valide, elle est seulement moins bonne.",
    agit:"Le sous-sol va sous le corps le plus haut ; à égalité du reste, la couverture suffisante l'emporte." },
  { id:"second", dom:"mass", rang:"pref", titre:"Ouvrages du second temps",
    val:"piscine 500 m² et local CAD 400 m² — réunis ou séparés",
    source:"règlement art. 2.2", lu:"src/mass/gen.js — poserSecond()",
    pourquoi:"Indépendants de l'école et bâtis plus tard. « Au choix » laisse le générateur "
      + "les réunir ou les séparer ; le rail peut l'imposer.", agit:"" },

  { id:"essais", dom:"mass", rang:"param", titre:"Compositions essayées", k:"essais",
    unite:"essais", min:5, max:300, pas:5, source:"générateur", lu:"src/mass/gen.js — genMass()",
    pourquoi:"Plus d'essais, plus de variantes valides parmi lesquelles choisir, et un "
      + "tirage plus lent.", agit:"" },
  { id:"essaisParti", dom:"mass", rang:"param", titre:"Reconnaissance par parti en Auto",
    k:"essaisParti", unite:"essais", min:1, max:20, pas:1, source:"générateur",
    lu:"src/mass/gen.js — genMass()",
    pourquoi:"Chaque parti est essayé d'abord ; seuls ceux qui rendent une variante valide "
      + "reçoivent la suite des essais.", agit:"" },
  { id:"courFond", dom:"mass", rang:"param", titre:"Profondeur de mesure de la cour",
    k:"courFond", unite:"m devant une façade", min:10, max:80, pas:5, source:"générateur",
    lu:"src/mass/juge.js — courUtile()", pourquoi:"Jusqu'où l'on compte le terrain libre "
      + "devant une façade d'école.", agit:"" },
  { id:"passMax", dom:"mass", rang:"param", titre:"Longueur maximale d'une passerelle",
    k:"passMax", unite:"m", min:6, max:60, pas:1, source:"générateur",
    lu:"src/mass/gen.js — relier()", pourquoi:"", agit:"" },
  { id:"passLarg", dom:"mass", rang:"param", titre:"Largeur d'une passerelle",
    k:"passLarg", unite:"m", min:2, max:6, pas:0.5, source:"générateur",
    lu:"src/mass/model.js — pontRect()", pourquoi:"", agit:"" }
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
      + "étage, accolés ou reliés",
    agit:"le plan et la 3D — c'est la proposition architecturale elle-même",
    hasard:"graine du massing (`MASS.graine`), distincte de celle du mixer" },

  { dom:"mass", f:"src/mass/gen.js — figure()", n:"Les douze partis",
    lit:"le parti choisi, le nombre de niveaux à loger",
    decide:"la FIGURE : combien de corps, comment ils se tiennent, comment la pile se "
      + "dégrade en montant",
    agit:"l'allure générale. « Auto » les essaie tous et garde ceux qui rendent une "
      + "variante valide",
    hasard:"oui — nombre de corps, poids, angles, positions et profondeur" },

  { dom:"mass", f:"src/mass/gen.js — monter()", n:"Le partage des surfaces",
    lit:"la surface bâtie de chaque niveau, les poids des corps",
    decide:"quelle part de chaque niveau va à chaque corps, et donc ses cotes, au module",
    agit:"l'invariant du massing : la somme des emprises UTILES vaut la surface du niveau ; "
      + "les murs s'ajoutent autour",
    hasard:"aucun — le programme décide" },

  { dom:"mass", f:"src/mass/juge.js", n:"Le jugement d'une variante",
    lit:"la doctrine, la géométrie posée, le programme porté par chaque corps",
    decide:"dures → valide ou non ; fortes et préférences → favorable, neutre, défavorable",
    agit:"le choix : on garde les variantes qu'aucune autre ne bat sur les priorités fortes, "
      + "les préférences ne départagent que des égales, et un parti est tiré parmi elles",
    hasard:"le tirage final parmi les variantes non dominées, pour garder la diversité" },

  { dom:"mass", f:"src/mass/gen.js — reparer() / repecher()", n:"La réparation",
    lit:"le périmètre, les corps, l'existant",
    decide:"ramène un corps qui sort, qui touche un voisin ou qui percute l'existant ; "
      + "sinon balaie la parcelle pour la position admissible la plus proche",
    agit:"une figure qui ne tient pas est reprise, pas avertie",
    hasard:"aucun" },

  { dom:"mass", f:"src/mass/checks.js", n:"Le contrôle de volumétrie",
    lit:"les volumes posés et le jugement de `juge.js`",
    decide:"rien — il dit : erreur pour une contrainte dure, à vérifier, info",
    agit:"le bilan de surface niveau par niveau, et la liste d'alertes du rail",
    hasard:"aucun" },

  { dom:"mass", f:"src/mass/geom.js", n:"La géométrie du site",
    lit:"`data/site.js` — le relevé engendré du fichier Rhino",
    decide:"terrain interpolé, assise d'un volume, distances entre rectangles tournés, "
      + "aire posable, attracteurs d'alignement, cible de la vue",
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
    comment:"tous les partis sont essayés ; ceux qui rendent une variante valide reçoivent "
      + "la suite des essais, et le parti retenu est tiré parmi ceux des variantes non "
      + "dominées — c'est ce qui garde la diversité." },
  { dom:"mass", quoi:"La figure",
    comment:"nombre de corps, poids relatifs, angles, positions, profondeur entre le minimum "
      + "et le maximum : tirés dans des bornes propres à chaque parti." },
  { dom:"mass", quoi:"L'orientation",
    comment:"la figure suit l'axe du périmètre, l'optimum soleil-vue, ou un angle libre ; "
      + "dans les partis libres, chaque corps choisit la sienne." },
  { dom:"mass", quoi:"La salle de sport",
    comment:"posée sur le bas du site, puis, dans une partie des variantes, accolée au "
      + "corps principal." },
  { dom:"mass", quoi:"Les passerelles",
    comment:"dans une partie des variantes, les corps d'école non reliés le sont par la "
      + "passerelle la plus courte qui tienne." }
];
export function tiragesDe(dom){
  return TIRAGES.filter(function(t){ return t.dom === dom || t.dom === "deux"; });
}
