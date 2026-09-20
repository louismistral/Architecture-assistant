/* ============================================================================
   CONTRAINTES ET RÈGLES DU CONCOURS — SOURCE UNIQUE
   Règlement-programme, Saxon, juillet 2026 (DOC/1.19.a) et directive de
   protection incendie AEAI DPI 16-15 (DOC/1.19.d).

   Données pures, aucune logique : les vérifications vivent dans
   `src/mix/checks.js` et `src/mass/checks.js`, le générateur de volumétrie dans
   `src/mass/gen.js`.

   Ce fichier ne contient AUCUNE surface de programme. Les surfaces sont fixes
   et n'ont qu'une source, `src/data/program.js` ; on change les proportions
   d'une pièce, jamais sa surface. Ici ne vivent que les contraintes qui pèsent
   sur ces surfaces : hauteurs libres, évacuation, nappe, distances, places.
   ========================================================================= */

export var RULES = {

  /* --- 2.3 données relatives au site ------------------------------------ */
  site: {
    parcelles: ["5606","5607","5608","5610","5611","5612","5613","5614","4550"],
    aire: 11740,              /* m² annoncés au règlement (le polygone du géomètre en fait 12'783) */
    altMoy: 465.30,           /* msm — altitude moyenne du terrain */
    nappe: [461.77, 462.25],  /* msm — nappe phréatique, du plus bas au plus haut relevé */
    zone: "Zone de constructions et d'installations publiques A",
    /* Dans cette zone le règlement communal ne fixe NI gabarit, NI hauteur, NI
       distance aux limites. Restent opposables : les distances entre bâtiments
       de la protection incendie et les alignements routiers. */
    gabarit: null, hauteurMax: null, distLimite: null,
    eaux: "Zone de protection des eaux Au - Karst ; protection des sources SIII au sud",
    pollution: "Parcelle 4550 : investigations de pollution des sols en cours"
  },

  /* --- distances retenues pour l'implantation ---------------------------- */
  /* `entre` vient de l'AEAI, `retrait` est une règle de projet : faute
     d'alignement routier numérisé, on garde un recul de travail sur le
     périmètre. `couverture` est la terre qu'un sous-sol excavé doit garder
     au-dessus de la nappe. */
  dist: { retrait: 5, entre: 6, couverture: 3.0 },

  /* --- hauteurs ---------------------------------------------------------- */
  /* `libre` : hauteurs libres EXIGÉES par le règlement, par famille ou par
     local. `dalle` et `acrotere` sont des hypothèses de projet, assumées comme
     telles : elles servent à passer d'une hauteur libre à une hauteur de
     niveau, et de là à une silhouette. */
  haut: {
    dalle: 0.45, acrotere: 0.60,
    libre: {
      cla: 2.80,    /* vide d'étage des salles de classe — 2.10 */
      spo: 7.00,    /* salle de sport double, libre sous structure — 2.10 */
      cad: 5.20,    /* local de chauffage à distance, accès camion — 2.10 */
      pis: 4.00,    /* piscine : le règlement donne 3 à 5 m — 2.2 */
      abri: 2.40,   /* abri PC */
      def: 2.80     /* tout local non nommé */
    }
  },

  /* --- part de circulation ----------------------------------------------- */
  /* Hypothèse de PROJET, pas un chiffre du règlement : la part de la surface
     bâtie qui n'est pas un local du programme — couloirs, escaliers, paliers,
     sas, gaines. Elle se règle dans le cahier des charges, parmi les surfaces à
     préciser, et c'est de là que tous les onglets suivants la lisent.
     Convention, une seule dans tout le projet : c'est une part de la surface
     BÂTIE, donc bâti = utile / (1 − part). Une part de 0,18 ajoute 22 % à la
     surface utile, et non 18 %. */
  circ: { def: 0.18, min: 0.05, max: 0.45 },

  /* --- 2.6 protection incendie, AEAI DPI 16-15 art. 2.4 et 3.4 (écoles) --- */
  feu: {
    cageMin: 1,        /* une cage d'escalier compartimentée au minimum */
    cageSeuil: 900,    /* m² de surface d'étage : deux cages au-delà */
    fuiteSimple: 35,   /* m — voie d'évacuation aboutissant à une seule issue */
    fuiteDouble: 50,   /* m — à deux issues éloignées l'une de l'autre */
    fuiteUnite: 35     /* m — à l'intérieur d'une unité d'utilisation */
  },

  /* --- 2.5 exigences parasismiques --------------------------------------- */
  seisme: { zone: "3b", agd: 1.6, sol: "E, partiellement C (SIA 261)", ouvrage: "II" },

  /* --- 2.4 mobilité et 2.10 aménagements extérieurs ---------------------- */
  /* `mPlace` est l'emprise couramment retenue pour une place de parc à ciel
     ouvert, accès compris : elle sert à chiffrer le terrain qu'il faut garder
     libre, pas à dessiner le parking. */
  ext: { voitures: 70, velos: 50, bus: 2, depose: 4, mPlace: 25 },

  /* --- niveaux ----------------------------------------------------------- */
  /* Règles de niveau, lues par le mixer (`src/mix/niv.js`) : c'est lui qui
     décide à quel étage va chaque poste, avant toute volumétrie. */
  niv: {
    classeMax: 2,      /* classes au plus au 2ᵉ étage — évacuation et âge des élèves */
    solRez: ["Salle de sport double","Local chauffage CAD","Piscine","Hall","UAPE","Bureaux"],
    sousSol: ["Abri PC","Technique","Stockage","Nettoyage"]
  },

  /* --- second temps ------------------------------------------------------ */
  /* Indépendants des bâtiments scolaires, à représenter en pointillé sur le
     plan de situation 1:500, sans organisation des locaux ni façades. */
  phase2: ["Piscine", "Local chauffage CAD"],

  /* --- 2.7 à 2.9 exigences non métriques --------------------------------- */
  /* Elles ne se vérifient pas par le calcul mais orientent la volumétrie :
     la compacité et l'orientation sont nommées par le règlement. */
  qualitatif: [
    "Économicité : respect des surfaces données au programme, rationalité typologique",
    "Compacité et orientation des volumes, usage passif de l'énergie solaire",
    "Minergie A ou P, ou CECB A/A (LcEne / OcEne)",
    "Toitures disponibles pour le photovoltaïque",
    "Eaux de toiture et de surface infiltrées sur site",
    "Intégration avec le bâtiment et les jardins de l'ancien Casino"
  ]
};

/* Distances et couverture sont lues telles quelles par l'implantation : elles
   vivaient dans `data/site.js`, au milieu du relevé du géomètre, alors que ce
   sont des règles et non des mesures. */
export var RETRAIT = RULES.dist.retrait, ENTRE = RULES.dist.entre, SOUSSOL = RULES.dist.couverture;

/* Hauteur d'un niveau à partir de sa hauteur libre. */
export function hNiv(cle){
  var l = RULES.haut.libre[cle] || RULES.haut.libre.def;
  return Math.round((l + RULES.haut.dalle) * 100) / 100;
}
