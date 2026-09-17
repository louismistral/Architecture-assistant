export var CHAP = [
  { id:"ecole", name:"École primaire", short:"École",
    sub:"360 élèves du cycle 2 (9 à 12 ans). Espaces modulables et synergies demandés entre activités scolaires et extra-scolaires.",
    items:[
      {n:"Salles de classe standard", nb:18, u:72, f:"cla", note:"2.8 m de vide d'étage"},
      {n:"Salle de classe de réserve", nb:3, u:72, f:"cla"},
      {n:"Salle de dédoublement", nb:2, u:72, f:"cla"},
      {n:"Salle ACM", nb:2, u:72, f:"cla", note:"en lien avec le dépôt matériel"},
      {n:"Salles d'appui / soutien", nb:4, u:36, f:"cla"},
      {n:"Local pédago-thérapeutique", nb:1, u:36, f:"cla"},
      {n:"Salle des maîtres", nb:1, u:72, f:"adm"},
      {n:"Salle de réunion", nb:1, u:72, f:"adm", note:"lien avec la direction"},
      {n:"Salle détente / allaitement", nb:1, u:36, f:"adm"},
      {n:"Bureau direction et admin.", nb:2, u:18, f:"adm", note:"proche de la salle de réunion"},
      {n:"Local reproduction", nb:1, u:9, f:"adm", note:"proche des bureaux et de la salle des maîtres"},
      {n:"Dépôt matériel ACM", nb:2, u:36, f:"tec", note:"2 × 36 ou 1 × 72 m²"},
      {n:"WC PMR", nb:1, u:3, f:"eau", note:"également WC professeur + non-genré"},
      {n:"Vestiaires de classe", nb:18, u:10, f:"eau", est:1,
       note:"à préciser : 0,5 m²/élève × 20 élèves — bancs, crochets, râteliers, casiers ; intégrable au couloir"},
      {n:"WC garçons", nb:9, u:2, f:"eau", est:1, note:"à préciser : 2 m² par WC — cabine standard 1 × 2 m ; zone lavabos non comprise"},
      {n:"WC filles", nb:9, u:2, f:"eau", est:1, note:"à préciser : 2 m² par WC — cabine standard 1 × 2 m ; zone lavabos non comprise"},
      {n:"Hall d'entrée", nb:1, u:120, f:"cla", est:1, note:"le règlement écrit « selon projet » — à préciser"}
    ],
    off:[] },

  { id:"sport", name:"Salle de sport double / polyvalente", short:"Sport",
    sub:"Vocation de salle polyvalente pour les manifestations publiques de la commune.",
    items:[
      {n:"Salle de sport double", nb:2, u:448, w:32, h:28, split:true, f:"spo", note:"28 × 32 m, h. libre 7 m sous structure — 1 salle double minimum"},
      {n:"Scène", nb:1, u:120, f:"spo", note:"attenante à la salle de sport"},
      {n:"Local engins de sports", nb:2, u:90, f:"tec", planSkip:1, note:"en lien avec la salle de sport ; convertible en abri PC"},
      {n:"Local de rangement", nb:1, u:160, f:"tec", note:"tables et chaises"},
      {n:"Local de nettoyage", nb:1, u:10, f:"tec"},
      {n:"Vestiaires élèves", nb:4, u:35, f:"eau", note:"espace collectif, douches privatives, espace séchage"},
      {n:"Vestiaires professeurs", nb:2, u:15, f:"eau", note:"WC et douches ; peut servir d'infirmerie"},
      {n:"Cuisine", nb:1, u:50, f:"eau", note:"sert aussi l'UAPE et les manifestations ; en lien avec le foyer"},
      {n:"Toilette individuelle", nb:1, u:3, f:"eau", note:"WC adapté PMR"},
      {n:"Toilettes publiques", nb:6, u:2, f:"eau", est:1,
       note:"à préciser : 2 m² par WC — cabine standard 1 × 2 m, usage public lors des manifestations"},
      {n:"Hall d'entrée / foyer", nb:1, u:150, f:"spo", est:1,
       note:"le règlement écrit « selon projet » — combinable avec le réfectoire de l'UAPE ; à préciser"}
    ],
    off:[] },

  { id:"uape", name:"UAPE", short:"UAPE",
    sub:"Unité d'accueil pour écoliers, en lien direct avec la salle polyvalente.",
    items:[
      {n:"Salles d'activité", nb:2, u:72, f:"uap", note:"accueil et activités, en lien avec le réfectoire"},
      {n:"Réfectoire", nb:1, u:72, f:"eau", note:"indépendant du hall / foyer et des voies de circulation"},
      {n:"Salle de pause", nb:1, u:20, f:"adm", note:"mutualisable avec la salle des maîtres"},
      {n:"Bureau de direction", nb:1, u:18, f:"adm", note:"en lien avec le hall, lumière naturelle"},
      {n:"Local de rangement", nb:1, u:18, f:"tec"},
      {n:"Économat", nb:1, u:6, f:"tec", note:"en lien avec la cuisine"},
      {n:"Toilettes UAPE", nb:4, u:2, f:"eau", est:1,
       note:"à préciser : 2 m² par WC — cabine standard 1 × 2 m ; 1 adulte, 3 enfants"},
      {n:"Hall UAPE", nb:1, u:30, f:"uap", est:1,
       note:"le règlement écrit « selon projet » — accès direct aux locaux de l'UAPE ; à préciser"}
    ],
    off:["Cuisine — mutualisée avec celle de la salle polyvalente"] },

  { id:"tech", name:"Conciergerie et locaux techniques", short:"Technique", sub:"",
    items:[
      {n:"Abri PC", nb:1, u:750, f:"tec", planInset:{w:20,h:9,label:"locaux engins 180 m²"}, note:"3 × 200 places ; les locaux engins de la salle de gym (180 m²) y sont convertis"},
      {n:"Local technique", nb:1, u:120, f:"tec", note:"installations CVSE"},
      {n:"Conciergerie / vestiaire personnel nett.", nb:1, u:72, f:"tec", note:"vestiaire femmes + hommes + local de nettoyage"}
    ], off:[] },

  { id:"infra", name:"Infrastructures publiques et communales", short:"Infrastructures",
    sub:"Second temps, hors périmètre bâti scolaire. À représenter en pointillé sur le plan de situation 1:500, sans organisation des locaux ni dessin des façades.",
    items:[
      {n:"Piscine", nb:1, u:500, f:"pis", inset:{a:72, label:"bassin 6 × 12 m", w:12, h:6}, note:"hall, petit bassin, vestiaires, sanitaires, locaux techniques et dépôts"},
      {n:"Local chauffage CAD", nb:1, u:400, f:"tec", note:"accessible de plain-pied par camion, hauteur libre 5.20 m"}
    ], off:[] },

  { id:"ext", name:"Aménagements extérieurs", short:"Extérieurs",
    sub:"Dévolus au public en dehors de l'usage scolaire.",
    items:[
      {n:"Cour d'école avec préau couvert", nb:1, u:500, f:"ext", inset:{a:120, label:"préau couvert 120 m²"}, note:"arborisation, ombragée, espace vert, espace jeux"}
    ],
    off:["Stationnement vélos + trottinettes — 50 places","Stationnements véhicules — 70 places, salle polyvalente et corps enseignant","Dépose sécurisée des bus — 2 places","Dépose-minute parents — 4 places, de préférence côté rue du Casino"] }
];

