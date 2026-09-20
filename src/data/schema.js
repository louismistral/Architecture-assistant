/* ============================================================================
   SCHÉMA FONCTIONNEL — LES ADJACENCES EXIGÉES
   SOURCE UNIQUE des liens entre locaux. Deux choses n'y sont plus :

   les SURFACES. Elles étaient recopiées ici, dix-neuf nombres de plus à tenir
   à jour, et elles ne suivaient pas un poste « à préciser » changé dans le
   cahier des charges. Chaque nœud dit maintenant quels POSTES du programme il
   désigne ; la surface se lit dans `program.js` par cette table, et un nœud
   sans poste est hors bilan, ce qui se voit ;

   les POSITIONS. Les nœuds étaient posés à la main en coordonnées, largeur et
   hauteur libres : rien n'alignait quoi que ce soit et les fils se croisaient.
   Un nœud appartient désormais à un PÔLE et prend son rang dans la colonne ;
   la vue en déduit la géométrie, et l'échelle avec — à largeur constante, la
   hauteur d'un rectangle vaut sa surface.
   ========================================================================= */

/* Les pôles, de gauche à droite. L'ordre n'est pas décoratif : il met côte à
   côte les pôles que des liens traversent, pour qu'aucun fil n'enjambe une
   colonne entière. */
export var SPOLE = [
  { id:"ens", n:"Enseignement" },
  { id:"adm", n:"Direction et personnel" },
  { id:"uap", n:"UAPE" },
  { id:"acc", n:"Accueil, restauration" },
  { id:"spo", n:"Sport et polyvalent" }
];

/* `k` : les postes de `program.js` que le nœud désigne. Plusieurs quand le
   règlement en compte plusieurs sous un même usage — les WC élèves sont deux
   postes, garçons et filles. Aucun : le local est mentionné au règlement mais
   n'a pas de surface à lui, il est hors bilan. */
export var SNODE = [
  /* --- enseignement --- */
  { id:"classes",   n:"Salles de classe",        f:"cla", p:"ens", k:["ecole|Salles de classe standard"] },
  { id:"vest_cl",   n:"Vestiaires de classe",    f:"eau", p:"ens", k:["ecole|Vestiaires de classe"] },
  { id:"wc_el",     n:"WC élèves",               f:"eau", p:"ens", k:["ecole|WC garçons","ecole|WC filles"] },
  { id:"acm",       n:"Salle ACM",               f:"cla", p:"ens", k:["ecole|Salle ACM"] },
  { id:"depot_acm", n:"Dépôt matériel ACM",      f:"tec", p:"ens", k:["ecole|Dépôt matériel ACM"] },

  /* --- direction et personnel --- */
  { id:"reunion",   n:"Salle de réunion",        f:"adm", p:"adm", k:["ecole|Salle de réunion"] },
  { id:"bureau",    n:"Bureau direction",        f:"adm", p:"adm", k:["ecole|Bureau direction et admin."] },
  { id:"repro",     n:"Local reproduction",      f:"adm", p:"adm", k:["ecole|Local reproduction"] },
  { id:"maitres",   n:"Salle des maîtres",       f:"adm", p:"adm", k:["ecole|Salle des maîtres"] },
  { id:"pause",     n:"Salle de pause",          f:"adm", p:"adm", k:["uape|Salle de pause"] },

  /* --- UAPE --- */
  { id:"activite",  n:"Salles d’activité",  f:"uap", p:"uap", k:["uape|Salles d'activité"] },
  { id:"wc_uape",   n:"Toilettes UAPE",          f:"eau", p:"uap", k:["uape|Toilettes UAPE"] },
  { id:"hall_uape", n:"Hall UAPE",               f:"uap", p:"uap", k:["uape|Hall UAPE"] },
  { id:"bur_uape",  n:"Bureau de direction",     f:"adm", p:"uap", k:["uape|Bureau de direction"] },
  { id:"cuis_uape", n:"Cuisine UAPE",            f:"eau", p:"uap", k:[] },

  /* --- accueil et restauration --- */
  { id:"foyer",     n:"Hall d’entrée / foyer", f:"spo", p:"acc", k:["sport|Hall d'entrée / foyer"] },
  { id:"refectoire",n:"Réfectoire",              f:"eau", p:"acc", k:["uape|Réfectoire"] },
  { id:"cuisine",   n:"Cuisine",                 f:"eau", p:"acc", k:["sport|Cuisine"] },
  { id:"economat",  n:"Économat",                f:"tec", p:"acc", k:["uape|Économat"] },

  /* --- sport et salle polyvalente --- */
  { id:"sport",     n:"Salle de sport double",   f:"spo", p:"spo", k:["sport|Salle de sport double"] },
  { id:"scene",     n:"Scène",                   f:"spo", p:"spo", k:["sport|Scène"] },
  { id:"engins",    n:"Local engins de sports",  f:"tec", p:"spo", k:["sport|Local engins de sports"] },
  { id:"rangement", n:"Local de rangement",      f:"tec", p:"spo", k:["sport|Local de rangement"] },
  { id:"nettoyage", n:"Local de nettoyage",      f:"tec", p:"spo", k:["sport|Local de nettoyage"] },
  { id:"vest_el",   n:"Vestiaires élèves",       f:"eau", p:"spo", k:["sport|Vestiaires élèves"] },
  { id:"vest_pr",   n:"Vestiaires professeurs",  f:"eau", p:"spo", k:["sport|Vestiaires professeurs"] },
  { id:"abri",      n:"Abri PC",                 f:"tec", p:"spo", k:["tech|Abri PC"] }
];

/* Trois natures de lien, et pas une de plus :
     (rien)   l'adjacence est exigée ;
     opt      une mutualisation que le règlement rend possible, pas obligatoire ;
     sep      une INDÉPENDANCE exigée — le contraire d'une adjacence, et une
              contrainte du règlement qui ne se lisait nulle part.
   `q` cite le règlement, mot pour mot autant que possible. */
export var SLINK = [
  { a:"classes",   b:"vest_cl",    q:"à proximité de chaque classe" },
  { a:"classes",   b:"wc_el",      q:"1 par classe standard, soit 18 répartis" },
  { a:"acm",       b:"depot_acm",  q:"en relation avec la salle ACM" },

  { a:"bureau",    b:"reunion",    q:"proche de la salle de réunion" },
  { a:"bureau",    b:"repro",      q:"proche des bureaux" },
  { a:"maitres",   b:"repro",      q:"… et de la salle des maîtres" },
  { a:"pause",     b:"maitres",    opt:1, q:"peut être mutualisée avec la salle des maîtres de l’école" },

  { a:"hall_uape", b:"activite",   q:"accès direct aux locaux de l’UAPE" },
  { a:"hall_uape", b:"bur_uape",   q:"en lien avec le hall, lumière naturelle" },
  { a:"wc_uape",   b:"activite",   q:"à l’usage exclusif de l’UAPE — 1 adulte, 3 enfants" },
  { a:"cuis_uape", b:"cuisine",    opt:1, q:"à mutualiser avec la cuisine de la salle polyvalente" },

  { a:"activite",  b:"refectoire", q:"en relation directe avec les salles d’activité" },
  { a:"cuisine",   b:"refectoire", q:"doit pouvoir servir de cuisine … pour l’UAPE" },
  { a:"cuisine",   b:"economat",   q:"en lien avec la cuisine" },
  { a:"cuisine",   b:"foyer",      q:"en lien avec le foyer / entrée" },
  { a:"foyer",     b:"refectoire", opt:1, sep:1,
    q:"peut être en prolongation du foyer ; l’espace doit néanmoins être indépendant du hall / foyer et des voies de circulation" },

  { a:"foyer",     b:"sport",      q:"hall d’entrée et foyer de la salle polyvalente" },
  { a:"sport",     b:"scene",      q:"attenante à la salle de sport" },
  { a:"sport",     b:"engins",     q:"en lien avec la salle de sport" },
  { a:"sport",     b:"rangement",  q:"local de rangement pour les tables et chaises" },
  { a:"sport",     b:"nettoyage",  q:"local de nettoyage de la salle polyvalente" },
  { a:"vest_el",   b:"vest_pr",    q:"à proximité des vestiaires élèves" },
  { a:"sport",     b:"vest_el",    q:"vestiaires de la salle de sport" },
  { a:"abri",      b:"engins",     opt:1, q:"possibilité de convertir les locaux engins de la salle de gym en abri" }
];

/* Les postes que le règlement mentionne sans leur imposer de voisin. Les citer
   est la seule façon de dire que le schéma est complet : ce qui n'y figure pas
   n'a pas été oublié, il n'a simplement aucune proximité exigée. */
export var FREE = ["Salle de classe de réserve","Salle de dédoublement","Salles d'appui / soutien",
  "Local pédago-thérapeutique","Salle détente / allaitement","WC PMR",
  "Local de rangement UAPE","Toilette individuelle","Toilettes publiques",
  "Local technique","Conciergerie","Local chauffage CAD","Piscine","Cour d'école avec préau"];
