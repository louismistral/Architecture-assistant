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
    pollution: "Parcelle 4550 : investigations de pollution des sols en cours",
    voisins: ["5792","5547"]  /* projet résidentiel voisin, à prendre en compte */
  },

  /* --- distances retenues pour l'implantation ---------------------------- */
  /* `entre` est la distance de sécurité INCENDIE entre deux bâtiments — le
     règlement (art. 2.3) renvoie aux directives AEAI 15-15 sans donner de
     chiffre ; 5 m est leur cas de base (deux façades à couche extérieure
     incombustible). C'est la seule distance BLOQUANTE entre bâtiments.
     Le recul sur le périmètre n'est PAS ici : le règlement ne fixe aucune
     distance aux limites, et ce recul est notre choix — une ligne du cadre
     choisi (`data/cadre.js`, `V.recul`). `couverture` est la terre qu'un
     sous-sol excavé garde au-dessus de la nappe — hypothèse de projet. */
  dist: { entre: 5, couverture: 3.0 },

  /* --- l'architecture des volumes ---------------------------------------- */
  /* Toitures, puits de lumière, entrées, rampes, sous-passages : des
     hypothèses de dessin, pas du règlement — sauf la pente de rampe, 6 %
     (SIA 500). Aucune ne touche une surface du programme. */
  archi: {
    pente: 0.35,                      /* toit à un ou deux pans, m par m */
    shed: { pas: 6, h: 1.8 },         /* dents de scie */
    vert: 0.40,                       /* épaisseur du toit végétalisé */
    puits: { cote: 3, h: 1.0 },       /* lanterneau */
    auvent: { larg: 10, prof: 4, h: 3.2, ep: 0.30 },
    rampe: { larg: 2, pente: 0.06 },
    sous: { larg: 6, h: 4 }
  },

  /* --- hauteurs ---------------------------------------------------------- */
  /* `libre` : hauteurs libres EXIGÉES par le règlement, par famille ou par
     local. `dalle`, `mur` et `acrotere` sont des hypothèses de projet,
     assumées comme telles. La dalle s'AJOUTE à la hauteur libre, le mur
     extérieur s'ajoute AUTOUR de la surface utile : ni l'un ni l'autre ne
     retranche un mètre carré au programme. Le mur extérieur et porteur fait
     40 cm isolation comprise — l'épaisseur courante d'un mur Minergie. */
  haut: {
    dalle: 0.40, mur: 0.40, cloison: 0.10, acrotere: 0.60,
    libre: {
      cla: 2.80,    /* vide d'étage des salles de classe — 2.10 */
      spo: 7.00,    /* salle de sport double, libre sous structure — 2.10 */
      cad: 5.20,    /* local de chauffage à distance, accès camion — 2.10 */
      pis: 4.00,    /* piscine : le règlement donne 3 à 5 m — 2.2 */
      abri: 2.40,   /* abri PC */
      def: 2.80     /* tout local non nommé */
    }
  },

  /* --- le dessin des plans -------------------------------------------- */
  /* Les cotes physiques que les plans des Typologies DESSINENT (portes,
     fenêtres, escaliers, appareils, cotation) : des usages du métier et de la
     SIA 500, pas du règlement. Aucune ne touche une surface du programme.
     Les épaisseurs de trait, elles, sont des valeurs de papier : `TRAITS`,
     `data/planches.js`. */
  plan: {
    /* le plan est une coupe horizontale à cette hauteur au-dessus du sol :
       ce qui est dessous se voit, ce qui la traverse est coupé */
    coupe: 1.20,
    /* portes : passage libre de 90 cm au moins (SIA 500), à deux battants
       pour un grand local ou un hall */
    porte: 0.90, porteDouble: 1.60,
    /* fenêtres : une baie de `larg` m tous les `pas` m de façade, sur une
       allège de `allege` m — vue, sous la coupe */
    fenetre: { larg: 1.80, pas: 2.60, allege: 0.90 },
    /* l'escalier : 2h + g = 63 cm (Blondel), 17 cm de hauteur de marche pour
       29 cm de giron ; le nombre de marches se déduit de la hauteur d'étage */
    marche: { h: 0.17, g: 0.29 },
    /* les appareils, en m : WC (l × p), lavabo (l × p), douche (côté minimal),
       plan de travail (profondeur), passage libre, aire de rotation d'un
       fauteuil roulant (diamètre, SIA 500) */
    sanitaire: { wc: [0.40, 0.70], lavabo: [0.60, 0.50], douche: 0.90 },
    travail: 0.60, passage: 0.90, rotation: 1.50,
    /* UNE PIÈCE VIVABLE, pas un couloir : le pavage n'en règle que la forme,
       jamais la surface. Le côté long fait au plus `ratio` fois le court
       (`ratioGrand` dès `grand` m² : un hall, un dépôt de 160 m²) ; aucune
       pièce sous `larg` m de largeur libre, sauf la cabine d'un bloc
       sanitaire (`cabine`, la cuvette et sa porte). Les petites pièces d'un
       bloc s'ouvrent sur un sas de `sas` m (l'aire de rotation quand il
       dessert un WC PMR). Le WC PMR : `pmr` (l × p, m) au moins, pour
       l'aire de rotation (SIA 500). Sous `petit` m², une pièce se range dans
       un bloc ; dès `deuxRangs` m de profondeur intérieure, un corps a deux
       bandes de pièces de part et d'autre du couloir — une classe de 72 m²
       (6 m de bande au moins), le noyau et son palier (6,20 m) en face, le
       couloir : 14,6 m. Plus mince, un seul rang, sans classe hors proportions. Le Massing en déduit ce
       que les plans pavent (`mass/model.js — aPaver`) : une petite pièce s'y
       compte dans une colonne d'au moins `colonne` m² — un vestiaire de classe,
       ou deux WC et leur sas —, ce que les plans font (mesuré sur 72 tirages). */
    piece: { ratio: 2, ratioGrand: 3, grand: 100, larg: 1.60, cabine: 0.90, sas: 1.20, petit: 30, colonne: 10 },
    deuxRangs: 15,
    pmr: [1.65, 1.80],
    /* la cotation, en m sur le plan : le blanc entre le dessin et une ligne
       d'attache, la première chaîne au-delà de la façade, l'écart entre deux
       chaînes, la hauteur du texte */
    cotes: { ecart: 0.40, premier: 1.60, pas: 1.20, texte: 0.50 }
  },

  /* --- circulation ------------------------------------------------------- */
  /* Hypothèse de PROJET, pas un chiffre du règlement : la surface bâtie qui
     n'est pas un local du programme — couloirs, escaliers, paliers. Elle se
     règle dans le cahier des charges, parmi les surfaces à préciser, et c'est
     de là que tous les onglets suivants la lisent.

     Elle était une PART de la surface bâtie, 18 % : la salle de sport double,
     une pièce de 896 m², recevait donc autant de couloir au mètre carré que
     neuf WC de 2 m². Un couloir ne dessert pas des mètres carrés, il dessert des
     PORTES. La circulation se déduit maintenant des pièces :

       couloir = Σ front de chaque pièce × largeur ÷ rangs desservis
       front   = √(surface de la pièce), le côté qu'elle ouvre sur le couloir
       cages   = une ou deux par niveau (`feu.cageSeuil`), `cage` m² chacune

     La part de la surface bâtie devient un RÉSULTAT, qu'on affiche. */
  circ: {
    /* largeur du couloir, en mètres — la seule saisie. 2,40 m : le couloir
       d'école courant, où deux classes se croisent. */
    couloir: { def: 2.40, min: 1.50, max: 4.00 },
    /* un couloir dessert deux rangées de locaux, une de chaque côté : il ne
       compte que pour moitié devant chacune */
    rangs: 2,
    /* sous cette surface unitaire, les pièces d'un même poste se groupent en un
       bloc qui n'ouvre qu'une porte : neuf WC de 2 m² sont un bloc sanitaire,
       pas neuf façades sur le couloir */
    bloc: 12,
    /* au-delà de ce front, un grand local n'en demande pas davantage : on entre
       dans une salle de sport par une porte, pas par ses 32 m de long */
    frontMax: 12,
    /* une cage d'escalier compartimentée, palier et ascenseur compris, en m²
       par niveau */
    cage: 24,
    /* le NOYAU qui loge ces 24 m² : escalier et ascenseur côte à côte, aux
       mêmes cotes à chaque niveau — il s'empile. Deux volées de 1,20 m ; une
       gaine de 2,10 × 2,40 m pour une cabine accessible 1,10 × 1,40 m (SIA 500). */
    noyau: { prof: 5.0, volee: 1.20, asc: [2.10, 2.40] },
    /* deux postes EN LIEN au schéma se tiennent, au plan, à moins de cette
       distance (en équerre, de centre à centre, au même niveau et dans le
       même bâtiment) — hypothèse de projet */
    proche: 15,
    /* la pile que le cahier des charges suppose AVANT le mixer, pour compter ses
       cages : un rez et deux étages, ce que le règlement admet pour les classes.
       Le mixer, lui, compte les cages de la pile qu'il porte. */
    niveaux: 3
  },

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
  ext: { voitures: 70, velos: 50, bus: 2, depose: 4, mPlace: 25,
         busPassages: 4,                      /* passages des bus scolaires par jour */
         accesAuto: "rue du Casino",          /* voitures, bus et dépose-minute */
         accesDoux: "chemin du Petit Mont" }, /* vélos et piétons */

  /* --- 1.9 le coût -------------------------------------------------------- */
  /* CFC 2 à 4, TTC, tel que le maître d'ouvrage l'estime. Le jugement le compare
     au volume mesuré fois le prix au m³, une hypothèse (`data/donnees.js`). */
  budget: 29000000,

  /* --- 2.7 l'école -------------------------------------------------------- */
  ecole: { eleves: 360, degres: "5H à 8H" },

  /* --- niveaux ----------------------------------------------------------- */
  /* Règles de niveau, lues par le mixer (`src/mix/niv.js`) : c'est lui qui
     décide à quel étage va chaque poste, avant toute volumétrie. */
  niv: {
    classeMax: 2,      /* classes au plus au 2ᵉ étage — évacuation et âge des élèves */
    etagesMax: 6,      /* étages au-dessus du rez que la recherche essaie — le règlement ne plafonne rien (zone A) */
    solRez: ["Salle de sport double","Local chauffage CAD","Piscine","Hall","UAPE","Bureaux"],
    sousSol: ["Abri PC","Technique","Stockage","Nettoyage"]
  },

  /* --- second temps ------------------------------------------------------ */
  /* Indépendants des bâtiments scolaires, à représenter en pointillé sur le
     plan de situation 1:500, sans organisation des locaux ni façades. */
  phase2: ["Piscine", "Local chauffage CAD"],

  /* --- le reste du règlement, en toutes lettres --------------------------- */
  /* Ce qui ne se vérifie pas par le calcul, rangé par thème, avec son article.
     `q` : une exigence qualitative qui oriente la volumétrie (le volet
     Contraintes les liste, `RULES.qualitatif` ci-dessous). `verif` : un point
     que le règlement laisse flou ou contradictoire, à vérifier. Les chiffres
     que les outils lisent restent dans les clés ci-dessus : rien n'est redit ici. */
  cadre: {
    site: [
      { n:"Ancien Casino", art:"2.2", q:1,
        v:"Intégration harmonieuse au bâtiment et à ses jardins, inventoriés au patrimoine" },
      { n:"Vision d'ensemble", art:"2.2",
        v:"La commune attend une vision globale du développement du site" },
      { n:"Deux fonctionnements", art:"2.2",
        v:"Le volume de l'école doit fonctionner avec et sans piscine" }
    ],
    mobilite: [
      { n:"Flux", art:"2.4", v:"Piétons et véhicules séparés" },
      { n:"Dépose des bus", art:"2.4", v:"Sécurisée, impérative" },
      { n:"Dépose-minute", art:"2.4, 2.10", v:"Séparée des places de bus, de préférence côté rue du Casino" }
    ],
    programme: [
      { n:"Usage public", art:"2.2", v:"Cour et parking ouverts au public hors des heures d'école" },
      { n:"Salle polyvalente", art:"2.2", v:"La salle de sport double accueille aussi des manifestations publiques" },
      { n:"Flexibilité", art:"2.7", v:"Espaces modulables ; synergies scolaire, extrascolaire et associatif" }
    ],
    normes: [
      { n:"Énergie", art:"2.9", q:1, v:"Minergie A ou P, ou CECB A/A (LcEne / OcEne)" },
      { n:"Accessibilité", art:"1.5", v:"SIA 500, LDIPH / ODIPH, directives scolaires valaisannes de 2005" }
    ],
    economie: [
      { n:"Coût", art:"1.9", v:"CFC 2 à 4 estimés à CHF 29 millions TTC" },
      { n:"Économicité", art:"2.7", q:1,
        v:"Respect des surfaces du programme, rationalité typologique, économie pour les usagers et la collectivité" },
      { n:"Construction durable", art:"2.8", v:"SIA 112/1, faible énergie grise, construction circulaire" },
      { n:"Bioclimatique", art:"2.9", q:1,
        v:"Compacité, orientation, solaire passif, lumière naturelle, protection solaire adaptée" },
      { n:"Eaux pluviales", art:"2.9", q:1, v:"Eaux de toiture et de surface infiltrées sur le site" },
      { n:"Photovoltaïque", art:"2.9", q:1, v:"En toiture, possible en façade" }
    ],
    rendu: [
      { n:"Planches", art:"1.21", v:"Au plus 5 A1, paysage, selon le schéma d'affichage, un exemplaire" },
      { n:"Plan de situation 1:500", art:"1.21",
        v:"Rendu libre : entrées, circulations, distances aux limites, cotes au sol et d'acrotère" },
      { n:"Plans, coupes, façades 1:200", art:"1.21",
        v:"Trait noir sur fond blanc, noms des locaux et surfaces nettes ; plans orientés comme la situation, coupes et façades horizontales" },
      { n:"Planche explicative", art:"1.21",
        v:"Insertion, concept, structure et matériaux, schémas incendie et parasismique" },
      { n:"Documents à part", art:"1.21",
        v:"Cahier SIA 416 avec schémas cotés au 1:500 · réductions A4 · clé USB, PDF 300 dpi, 2 Mo par planche · fiche d'identification sous enveloppe fermée" },
      { n:"Maquette", art:"1.21", v:"Au 1:500, entièrement peinte en blanc, devise sur le plâtre et le couvercle" }
    ],
    procedure: [
      { n:"Anonymat", art:"1.21",
        v:"Une devise et « Concours CS Saxon » sur tout le rendu ; aucune variante ; en français" },
      { n:"Rendu des projets", art:"1.21", v:"Vendredi 9 octobre 2026, 16 h, au SIP à Sion — le cachet postal ne fait pas foi" },
      { n:"Dépôt de la maquette", art:"1.21", v:"Vendredi 30 octobre 2026, 14 h – 17 h, au Casino de Saxon, par une personne neutre" },
      { n:"Critères de jugement", art:"1.26", verif:1,
        v:"Seuls les quatre premiers ont été extraits du PDF — la liste continue sans doute page 15" },
      { n:"Loi cantonale sur l'énergie", art:"1.5, 2.9", verif:1,
        v:"Deux dates : 8 septembre 2023 (1.5), 15.01.2004 (2.9)" }
    ]
  }
};

/* Les exigences qui ne se vérifient pas par le calcul mais orientent la
   volumétrie : la compacité et l'orientation sont nommées par le règlement. */
RULES.qualitatif = [];
Object.keys(RULES.cadre).forEach(function(k){
  RULES.cadre[k].forEach(function(c){ if(c.q) RULES.qualitatif.push(c.n + " : " + c.v.charAt(0).toLowerCase() + c.v.slice(1)); });
});

/* Distances et couverture sont lues telles quelles par l'implantation : elles
   vivaient dans `data/site.js`, au milieu du relevé du géomètre, alors que ce
   sont des règles et non des mesures. */
export var ENTRE = RULES.dist.entre, SOUSSOL = RULES.dist.couverture;

/* Hauteur d'un niveau à partir de sa hauteur libre. */
export function hNiv(cle){
  var l = RULES.haut.libre[cle] || RULES.haut.libre.def;
  return Math.round((l + RULES.haut.dalle) * 100) / 100;
}
