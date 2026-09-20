# Centre scolaire de Saxon — mémoire du projet

Outil d'aide à la conception pour le concours de projet du nouveau centre scolaire de
Saxon (VS). HTML + CSS + modules ES, **aucun build, aucune dépendance**. Servir avec
`python3 -m http.server 8000`.

Les règles de dessin, de style et d'architecture logicielle sont dans `README.md` et
font foi. Ce fichier retient **les contraintes du concours** et **où elles vivent dans
le code**.

---

## Les onglets sont une chronologie

```
Cahier des charges  →  Programme mixer  →  Massing  →  Typologie
surfaces et             répartition du      volumétrie  plans et
contraintes             programme sur       sur le site coupes
                        les niveaux
```

Chaque onglet se sert de ce que le précédent a décidé. L'ancien ordre faisait l'inverse :
l'onglet Site venait après le Plan, donc la typologie décidait du volume.

**Aujourd'hui, trois onglets existent** : Cahier des charges, Programme mixer et Massing.
Seule la Typologie reste à construire. Le dossier `src/vol/`, qui gardait dormants un
générateur de volumétrie et une scène 3D, a été RETIRÉ quand le Massing a été construit :
le garder aurait fait deux générateurs, deux contrôles et deux scènes pour une seule
question, et ce projet n'a qu'une source par décision. Ce qui en valait la peine est
repris dans `src/mass/` et `src/views/vue3d.js` ; `src/core/gl.js`, qui ne parle pas
d'architecture, est resté où il était.

Le **cahier des charges** porte **deux volets**, dans cet ordre : **Surfaces** et
**Contraintes** (`view.sub`, `SUBS` dans `src/core/viewstate.js`). Ils étaient trois,
empilés sur une seule page avant cela : revenir d'une adjacence à la surface qu'elle
commente demandait quatre écrans de défilement.

- **Surfaces** — le programme à l'échelle, les huit postes « à préciser » et la part de
  circulation. C'est le volet d'ouverture, et le seul où l'on saisit quelque chose.
- **Contraintes** — `src/views/constraints.js`, lu dans `src/data/rules.js`, puis le
  **schéma fonctionnel** des adjacences (`src/views/schema.js`, lu dans
  `src/data/schema.js`). Les adjacences ont été un onglet, puis un volet : une proximité
  exigée entre deux locaux n'est pas d'une autre nature qu'une hauteur libre ou une
  distance au voisin. C'est une contrainte, et elle se lit avec les autres.
  Le schéma est **à l'échelle, et en mètres** : une unité de dessin vaut un mètre, donc
  un local de 144 m² est un carré de 12 m de côté, et l'aire du rectangle vaut ses m²
  dans ses DEUX côtés — la même convention que les diagrammes du volet Surfaces. Quand
  le règlement impose les deux cotes (salle de sport double, 28 × 32 m), le schéma les
  lit dans `program.js` au lieu de les redire. Un local trop petit pour écrire son nom
  le range dessous.
  La disposition, elle, est une **carte heuristique** : elle part du LIEN, parce que le
  lien est la contrainte. Chaque composante connexe des adjacences est une **grappe** —
  la notion même que le mixer déplace d'un bloc — ; son centre est son local le plus lié
  (à égalité, le plus grand), ses voisins rayonnent autour de lui par branches courbes,
  et les voisins de ceux-là sur le tour suivant. Le rayon d'un local se déduit de
  l'encombrement de son parent et du sien, son secteur angulaire de ce que sa branche a
  à loger ; quand le tour ne suffit plus, on écarte tout d'un coup — les secteurs étant
  en 1/rayon, un seul passage les y ramène. Les liens qui ne sont pas dans l'arbre sont
  des exigences comme les autres : ils se tracent en travers, infléchis vers le centre.
  Le trait ne dit toujours qu'une chose, la nature de l'exigence ; la couleur reste
  celle de la famille d'usage.
  Chaque grappe porte son compte, sa surface et **les pôles qu'elle traverse** : les
  colonnes par pôle d'avant alignaient tout et donnaient à lire l'organigramme du
  programme plutôt que les proximités qu'il exige — on ne voyait pas que la grappe de la
  salle de sport tient dix-sept locaux et traverse trois pôles.

URL : `#programme/<volet>`, et `#programme/surfaces/<chap|fam>` pour le seul volet qui a
un regroupement. L'identifiant de l'onglet reste `programme` : les liens qui ont circulé
— `#adjacences`, `#programme/adjacences`, `#programme/fam` — restent valables et mènent
au volet qui les a repris. Un volet s'ajoute dans `SUBS` plus une branche dans
`render()` ; le bouton et le routage par hash suivent tout seuls.

---

## Règle première : les surfaces sont fixes

Le règlement chiffre chaque local. **Une surface de programme ne se change pas.** On
change les *proportions* d'une pièce ou d'un volume — largeur × hauteur, à surface
exacte — jamais les m².

- Source unique des surfaces : `src/data/program.js` (`CHAP`). Rien d'autre ne les
  redit, ni ne les recalcule.
- Proportions admissibles à surface exacte : `src/core/geometry.js` — `validDims`,
  `nearestDims`, `squarest` (grille au demi-mètre, repli au décimètre).
- Huit postes que le règlement laisse « selon projet » sont **à préciser** : ils sont
  marqués `est:1` et saisissables dans le cahier des charges, volet Surfaces. Programme
  chiffré 6'489 m², total vivant 7'025 m².

Totaux par chapitre (m² nets) : école 2'616 · sport 1'751 · UAPE 316 · technique 942 ·
infrastructures 900 · extérieurs 500. Bâti scolaire = les quatre premiers, 5'625 m².

## Règle seconde : la circulation est une part de la surface BÂTIE

Elle n'est chiffrée nulle part au règlement : c'est une hypothèse de projet, et elle vaut
plus de mille mètres carrés. Elle se règle **dans le cahier des charges, parmi les surfaces à
préciser, et là seulement** ; tous les onglets suivants la lisent.

```
bâti = utile / (1 − part)        circulation = bâti − utile
```

Une part de 0,18 ajoute donc **22 %** à la surface utile, et non 18 %. Elle ne porte que
sur le **bâti scolaire** — les quatre premiers chapitres ; la piscine, le chauffage à
distance, la cour et son préau n'ont pas de couloirs à nous.

- Valeur par défaut et bornes : `RULES.circ` dans `src/data/rules.js`.
- Valeur vivante, `CIRC`, et les m² qui en découlent, `CIRCA` / `BUILTG` / `GRANDG` :
  `src/core/model.js` seul. `setCirc()` est le seul écrivain.
- **Elle se répartit sur les chapitres et les familles** au prorata de ce qu'ils pèsent
  dans le bâti scolaire — `ch.circ` / `ch.gross`, `f.circ` / `f.gross`, calculés dans
  `recompute()` et nulle part ailleurs. Les parts se resomment exactement à `CIRCA`.
  Le volet Surfaces affiche le BÂTI de chaque chapitre (programme + circulation), la
  décomposition à côté, et dessine la circulation **à l'échelle** dans le diagramme :
  un bloc hachuré, sans couleur de famille, comme sa ligne de légende.
- Elle se réglait auparavant dans DEUX outils, sous le même mot et avec deux
  arithmétiques opposées : 15 % ajoutés à l'utile dans le générateur de volumétrie,
  18 % du bâti dans le plan. L'écart valait 200 m².

## Contraintes du concours — source unique : `src/data/rules.js`

Extraites du règlement-programme de juillet 2026 (`DOC/1.19.a`) et de la directive
AEAI DPI 16-15 (`DOC/1.19.d`). **Toute vérification et tout générateur lisent
`RULES` ; aucune de ces valeurs n'est réécrite ailleurs.** La section Contraintes de
du cahier des charges (`src/views/constraints.js`) ne fait que les afficher.

### Site (art. 2.3)
- Parcelles 5606, 5607, 5608, 5610 à 5614 et 4550 — **11'740 m²** au règlement ; le
  polygone du géomètre en fait 12'783 (il englobe les bords de route).
- Altitude moyenne **465,30 m**. Nappe phréatique de **461,77 à 462,25 m**. Le terrain
  monte de 463,3 m au sud-ouest à 466,7 m à l'est : la marge sur la nappe va de 1,0 m
  à l'ouest à 4,5 m à l'est. **Un sous-sol excavé demande 3,00 m** de couverture — il
  n'est tenable qu'au tiers est du site.
- Zone de constructions et d'installations publiques A : **aucune contrainte de
  gabarit, de hauteur ni de distance aux limites**. Restent opposables les distances
  entre bâtiments de l'AEAI et les alignements routiers.
- Zone de protection des eaux Au - Karst ; sources SIII au sud. Pollution des sols en
  cours d'investigation sur la parcelle 4550.
- Distances retenues à l'implantation : **6 m entre bâtiments** (AEAI), **5 m de recul
  sur le périmètre** (règle de projet, faute d'alignement routier numérisé).

### Hauteurs libres exigées (art. 2.10)
| local | hauteur libre |
|---|---|
| salles de classe | 2,80 m de vide d'étage |
| salle de sport double | **7,00 m** sous structure — donc au rez, sur un seul niveau |
| local chauffage CAD | 5,20 m, accès camion de plain-pied |
| piscine | 3 à 5 m |
| abri PC | 2,40 m |

Hypothèses de projet pour passer de la hauteur libre à la hauteur de niveau :
dalle 0,45 m, acrotère 0,60 m. Elles sont assumées comme telles dans `RULES.haut`.
Le mixer en déduit la hauteur de chaque niveau : elle n'est pas un réglage, elle est
une conséquence du programme porté par ce niveau.

### Protection incendie (art. 2.6, AEAI DPI 16-15 art. 2.4 et 3.4)
- Au moins **une cage d'escalier compartimentée** ; **deux dès 900 m² de surface
  d'étage**.
- Voie d'évacuation **35 m** vers une seule issue, **50 m** vers deux issues éloignées ;
  35 m à l'intérieur d'une unité d'utilisation.

### Parasismique (art. 2.5)
Zone 3b · a_gd = 1,6 m/s² (SIA 261:2020) · sol de fondation E, partiellement C ·
classe d'ouvrage II.

### Mobilité et extérieurs (art. 2.4 et 2.10)
70 places de parc à ciel ouvert · 50 vélos et trottinettes · 2 dépose-bus (rue du
Casino) · 4 dépose-minute · cour de 500 m² avec préau couvert de 120 m². Flux piétons
et véhicules séparés ; mobilité douce depuis le chemin du Petit Mont.

### Second temps (art. 2.2)
Piscine 500 m² (bassin 6 × 12 m) et local de chauffage à distance 400 m² : ouvrages
**indépendants des bâtiments scolaires**, réalisés plus tard, à représenter en pointillé
sur le plan de situation 1:500, sans organisation des locaux ni dessin des façades. Dans
le mixer ils sont posés au terrain mais **hors enveloppe** : ils ne pèsent pas sur le
plateau et ont leur propre bande dans le dessin d'un niveau.

### Exigences non métriques (art. 2.7 à 2.9)
Économicité et respect des surfaces données · compacité et orientation des volumes ·
Minergie A ou P, ou CECB A/A · toitures disponibles pour le photovoltaïque · eaux de
toiture infiltrées sur site · intégration au bâtiment et aux jardins de l'ancien Casino.

---

## L'onglet Programme mixer : répartir, puis contrôler

```
src/data/rules.js     contraintes du concours          ← SOURCE UNIQUE
src/data/schema.js    adjacences exigées               ← SOURCE UNIQUE
src/core/model.js     totaux, surfaces saisies, part de circulation
src/core/treemap.js   pavage squarifié : un bloc vaut sa surface
src/core/rand.js      tirage reproductible à graine
src/mix/prog.js       le programme vu comme des parts à poser ; adjacences par poste
src/mix/niv.js        règles de niveau, cotes admissibles d'un poste
src/mix/floors.js     la pile de niveaux, les parts posées, déplacer / scinder
src/mix/shuffle.js    répartition ordonnée, tirage, proposition de pile
src/mix/checks.js     contrôle d'une répartition → écarts, avec code et remèdes
src/mix/fix.js        les remèdes : déplacer, vider, agrandir un plateau, poser un WC
src/mix/accept.js     les écarts qu'on assume — « laisser comme ça »
src/mix/opts.js       les trois interrupteurs : tirer la pile, grouper, voir les pièces
src/mix/store.js      persistance (localStorage, clé `saxon-mix-v1`)
src/views/mixer.js    la vue : la pile, les niveaux à l'échelle, le bac, le glisser
```

**Le mixer ne refuse rien.** Une répartition qui sort des règles est produite quand même
et `checks.js` la dit : rouge pour une règle écrite au règlement ou à l'AEAI, ambre pour
une règle de projet ou une marge qui se discute. Le plateau, le nombre de niveaux et la
part de circulation sont des choix de projet : leur dépassement est ambre.

**Un écart se clique.** Il s'ouvre sur le geste qui le résoudrait — déplacer le poste au
niveau que la règle admet, vider le niveau, porter le plateau à la surface qu'il faut,
poser un WC — ou sur « laisser comme ça ». Chaque écart porte donc deux choses de plus
qu'un message :

- un **code** stable (`niv:<i>:<poste>`, `plate:<cote>`, `adj:<a>|<b>`…), construit sur les
  COTES et non sur les indices de niveau, pour qu'assumer un écart ne se défasse pas au
  premier réglage. `accept.js` tient la liste, `store.js` la persiste ;
- ses **remèdes**, fabriqués par `fix.js` et nommés dans `checks.js`, à côté de la règle
  qu'ils réparent. Un remède qui en créerait un autre n'est pas proposé : `fixDeplacer`
  rend `null` pour une cote que `lvRange` refuse au poste. Un écart sans remède mécanique
  — les deux cages d'escalier se dessinent à la typologie — porte une `note` qui le dit.

« Laisser comme ça » n'efface rien : l'écart quitte le verdict, passe dans « laissés tels
quels » et se reprend d'un clic.

**Un écart ouvert DÉSIGNE ses coupables** dans la pile : le niveau visé prend le filet de
l'écart, les pièces en cause le portent (`issFocus` dans la vue, `keys` sur l'écart). Lire
un conflit et devoir ensuite chercher les pièces à la main, c'était tout le travail laissé
à faire.

**Les contraintes de connexion ne sont jamais dures.** Le tirage les prend comme des
préférences — un poste va d'abord au niveau où se trouve déjà ce que le règlement lui
demande de toucher — et le contrôle dit après coup ce qui n'a pas pu tenir.

Un POSTE est une ligne du programme (18 salles de classe standard). Une PART est un
morceau de poste posé à un niveau (6 de ces 18 salles au 1ᵉʳ étage). Un poste se scinde,
sauf ceux dont le règlement impose les dimensions — la salle de sport double, 28 × 32 m,
ne se coupe pas.

**Tout se fait SUR le dessin.** Un bloc se glisse d'un niveau à l'autre ; ouvert, il
montre ses pièces et l'on tire hors de lui celle qu'on veut ailleurs — la scission n'est
pas un geste de plus, c'est le déplacement d'une pièce. Deux parts d'un même poste qui se
retrouvent au même niveau se refondent (`fuse`), donc se tromper ne coûte rien. Un menu
faisait cela avant : « déplacer vers » listait les niveaux et « scinder » demandait
« combien sur combien », alors que la pile et le bloc étaient là, sous les yeux. Le
clavier fait les mêmes gestes sur le bloc au foyer : flèches haut et bas pour changer de
niveau — le bac étant le cran sous le rez —, Maj pour n'emmener qu'une pièce, Suppr pour
renvoyer au bac.

Par défaut la pile n'a qu'un **rez-de-chaussée**. On l'édite **là où elle se dessine** :
« + Ajouter un étage » en tête de pile, « + Creuser un sous-sol » au pied, et une corbeille
sur chaque niveau qui le retire en renvoyant ses pièces au bac (`addFloorTop`,
`addFloorBottom`, `delFloorAt`). Retirer un niveau du MILIEU est permis : les cotes se
renumérotent derrière, la pile reste contiguë, et le rez reste le rez.

**Trois interrupteurs**, dans la barre du haut, persistés avec le reste :

- **Shuffle niveaux** — le tirage propose aussi la pile, déduite de la surface bâtie à
  loger, du plateau du rez et de ce que le règlement admet en sous-sol.
- **Grouper les liés** — déplacer une pièce emmène toute sa GRAPPE de proximité, la
  composante connexe des adjacences exigées (`grappeDe` dans `prog.js`, `moveGroupe` dans
  `floors.js`). Une mutualisation possible n'en fait pas partie : elle est offerte, pas
  due. La grappe de la salle de sport compte quatorze postes — elle est grande parce que
  le règlement le dit, et c'est ce que l'interrupteur donne à voir. Éteint, une grappe
  peut s'éparpiller sur trois étages, et le contrôle le dira. L'enclencher AGIT sur ce
  qui est déjà posé : `regrouper()` ramène chaque grappe au niveau où elle pèse déjà le
  plus, pour défaire le moins de travail possible. Sans cela l'interrupteur annonçait une
  règle sans l'appliquer, et une grappe éparpillée le restait.
- **Voir les pièces** — le bloc est DIVISÉ en ses pièces, à la surface unitaire du
  poste, par des traits tiretés qui vont d'un bord à l'autre : un refend de plan, qui
  sépare sans clore. C'est la prise de la scission. Des rectangles cernés donnaient à
  lire dix-huit objets rangés dans une boîte plutôt qu'un poste découpé. La trame est
  PLEINE — on préfère un partage exact à des cellules parfaitement carrées, sinon la
  dernière rangée semble inachevée. Rien n'est divisé pour un poste que le règlement ne
  coupe pas, ni quand une pièce deviendrait trop petite pour être visée.

Le tirage est la seule proposition : « Répartir », son jumeau ordonné, donnait la même
chose à l'ordre des chapitres près, et la graine rend le tirage aussi rejouable.

Les locaux engins de la salle de gym (180 m²) ne sont pas posés : le règlement les
convertit en abri PC, dont les 750 m² les contiennent. Les poser compterait deux fois.

---

## L'onglet Massing : poser le programme sur le terrain

```
src/data/site.js      le relevé, engendré du fichier Rhino    ← SOURCE UNIQUE
src/mass/geom.js      terrain interpolé, rectangles tournés, distances, alignements
src/mass/model.js     l'état, les niveaux RELUS du mixer, le bilan de surface
src/mass/gen.js       le générateur : parti → figure → réparation → note
src/mass/checks.js    alertes info / à vérifier / erreur
src/mass/etat.js      ce qui s'enregistre (lu par `mix/store.js`)
src/views/massing.js  le rail de commandes, le plan et la 3D côte à côte
src/views/plan.js     le plan : relevé, volumes, sélection, déplacement, rotation
src/views/vue3d.js    la 3D : terrain maillé, courbes drapées, existant, volumes
```

**Le massing ne redit rien du programme : il le LIT.** `niveaux()` relit `FLOORS` à chaque
appel — jamais de copie, jamais de cache. Un poste déplacé d'étage dans le mixer change la
volumétrie sans qu'on ait à synchroniser quoi que ce soit ; et déplacer un volume ici ne
touche pas au programme, parce que ce n'est pas la même question. Les couleurs, les noms,
les surfaces, les familles et les niveaux sont les mêmes objets, lus au même endroit.

**Un VOLUME est un rectangle tourné qui porte une pile de niveaux**, désignés par leur
INDICE dans `FLOORS`. Deux volumes qui portent le niveau 1 se partagent sa surface bâtie,
et la somme de leurs emprises vaut cette surface : c'est l'invariant du massing, et
`bilan()` le vérifie après un tirage comme après une modification à la main. Chaque niveau
d'un volume porte ses propres cotes et son propre décalage — c'est ce qui donne les
retraits, les terrasses et les porte-à-faux sans ajouter le moindre réglage.

**Un volume n'est pas une boîte : c'est du programme extrudé.** `cellules()` pave le
rectangle d'un niveau avec les postes qui s'y trouvent, au prorata de la part que ce corps
en porte — le même pavage squarifié que le mixer, la même règle « un bloc vaut sa
surface », les mêmes couleurs de famille. En mode « couleurs programme » on lit donc OÙ
sont les classes ; en « monochrome », la forme seule.

### DEUX TIRAGES, et ils ne se confondent jamais

- **Shuffle programme** — celui du mixer, appelé d'ici : il rebat la répartition dans les
  étages, et la volumétrie s'y adapte. L'interrupteur « Shuffle niveaux » est le même objet
  que dans le mixer (`mix/opts.js`), pas une copie.
- **Shuffle massing** — il ne touche PAS au programme. Mêmes postes, mêmes surfaces, mêmes
  niveaux, même répartition ; seule la solution architecturale change : nombre de corps,
  position, orientation, proportions, forme, hauteurs, retraits, terrasses.

Ils ont deux graines distinctes — celle du mixer dans `core/rand.js`, celle du massing dans
`MASS.graine`. Les confondre ferait qu'on ne peut plus changer l'une sans perdre l'autre.

### Ce n'est pas un tirage

Un tirage pur pose des boîtes au hasard et laisse l'architecte trier. `genMass()` compose,
mesure et jette : il lit le programme niveau par niveau, lit le site, compose une figure
selon le parti, la RÉPARE — tant qu'un corps sort du périmètre, touche un voisin ou percute
l'existant, on le ramène —, la NOTE, et recommence trente fois. Les alignements sont des
PRÉFÉRENCES notées, jamais des règles : axe du périmètre, perpendiculaire, longues limites
de parcelle, routes, nord-sud. Un corps peut prendre n'importe quel angle ; il gagne
seulement à se ranger.

**La salle de sport double fait un corps à elle.** Le règlement lui donne ses deux cotes,
28 × 32 m, et 7,00 m libres : sa surface sort du partage avant qu'il commence, sinon le
prorata l'aurait coupée en deux. Les postes `hors` — piscine, chauffage à distance, cour —
ne sont pas des volumes : le règlement les veut indépendants et au second temps.

**Les sous-sols vont sous le corps le plus HAUT du site**, pas le plus grand : la nappe est
à 462,25 m et le règlement veut 3,00 m de couverture, qu'on ne trouve qu'au tiers est.

Douze partis, chacun composant vraiment différemment : auto, bloc compact, barre, barres
parallèles, L, U, cour, pavillons, hameau, terrasses, peigne, composition libre. « Auto »
les essaie tous et garde celui qui tient le mieux sur ce site avec ce programme.

### Le contrôle ne refuse rien, il chiffre

Trois niveaux : **erreur** pour une règle écrite (règlement, AEAI) ou une géométrie
impossible ; **à vérifier** pour une règle de projet ou une marge qui se discute ; **info**
pour ce qu'il faut savoir sans corriger. Les porte-à-faux sont autorisés et signalés, avec
leur dépassement maximum. Le bilan de surface est donné niveau par niveau — demandé, posé,
écart — parce que c'est la question à laquelle l'outil doit répondre à tout moment.

### Le plan et la 3D sont le même modèle

Le plan est en mètres sur le relevé : courbes de niveau, parcelles, routes, murets,
bâtiments existants, périmètre. On y zoome, on s'y déplace, on sélectionne un volume en
cliquant, on le déplace en le tirant, on le tourne par sa poignée — et la 3D suit à
l'instant. La 3D montre le terrain MAILLÉ depuis `SITE.grid`, les courbes drapées, les
bâtiments existants à leur vraie hauteur, et les volumes du projet. Le fichier Rhino n'a
pas de calque d'arbres : il n'y en a donc pas au dessin.

L'état du massing — volumes, positions, rotations, parti, réglages — est persisté avec le
reste (`mass/etat.js`, clé `saxon-mix-v1`) : aller au mixer et revenir ne défait pas une
implantation qu'on vient de composer.

Le massing n'essaie pas de finir un projet. Il répond à une question de début d'étude : à
quoi ce programme ressemblerait-il, physiquement, sur ce site ?

## Où modifier quoi

- **Une surface, un nombre, une famille, une note** : `src/data/program.js` seul.
- **Une contrainte du concours** : `src/data/rules.js` seul — la section Contraintes, les
  règles de niveau et le contrôle en découlent.
- **Une adjacence** : `src/data/schema.js` seul — le lien, le pôle du nœud, et les postes
  qu'il désigne (`nd.k`). Ni surface ni coordonnée : la surface se lit dans `program.js`
  par cette table, la géométrie est déduite par la vue. Le pôle ne place plus rien : il
  ordonne les branches d'une grappe et nomme ce qu'elle traverse. `LIENS_ORPHELINS` signale tout
  nom de poste qui ne correspond plus.
- **Les familles et leurs couleurs** : `src/data/families.js` + `styles/tokens.css`.
- **Le relevé du géomètre** : `src/data/site.js` — mesures seulement, aucune règle. Il est
  **engendré** par `tools/extract-site.py` depuis `DOC/site_plan.3dm`, le relevé Rhino du
  concours : on ne le corrige pas à la main, on corrige le script et on le rejoue
  (`python3 tools/extract-site.py`, avec `rhino3dm` et `numpy`). Le fichier Rhino est en
  centimètres et en coordonnées suisses LV95 ; la conversion vers les mètres locaux —
  origine au coin sud-ouest du périmètre — vit dans le script et nulle part ailleurs.
  Le **terrain** n'est plus un plan incliné à trois nombres, qui se trompait de deux
  mètres au pied du coteau : c'est une grille d'altitudes au pas de 4 m, interpolée sur
  les courbes de niveau cotées du relevé (`SITE.grid`, 463,0 à 467,9 m sur le périmètre,
  465,0 de moyenne). Les bâtiments existants portent leur pied et leur faîte (`SITE.bath`),
  lus dans les solides du calque « batiments 3d ». Le fichier Rhino n'a **pas de calque
  d'arbres** : ce qu'on ne relève pas ne s'invente pas.
- **Une valeur de dessin** : `styles/tokens.css`, et nulle part ailleurs. WebGL ne sait
  pas lire `var(--f-cla)` : `cssRGB()` fait résoudre le token par le navigateur et le
  garde en cache tant que le thème ne change pas.

## Vérifier

Aucun test automatisé. Pour contrôler la répartition sans navigateur :

```bash
node --input-type=module -e "
Promise.all([import('./src/mix/floors.js'),import('./src/mix/shuffle.js'),
             import('./src/mix/checks.js'),import('./src/mix/prog.js')]).then(([F,S,C,P])=>{
  console.log('liens orphelins :', P.LIENS_ORPHELINS);
  S.repartir({ alea:false, etages:true });
  F.FLOORS.forEach(function(f,i){
    console.log(F.flName(i), Math.round(F.flNet(i)) + '/' + Math.round(F.usable(i)) + ' m²',
                F.flCount(i) + ' pièces', 'h=' + F.flHeight(i));
  });
  console.log('bac :', Math.round(F.trayArea()), 'm²');
  console.log('verdict :', JSON.stringify(C.mixVerdict(C.mixCheck())));
});"
```

Et la volumétrie, sans navigateur — le générateur, le bilan de surface et le contrôle :

```bash
node --input-type=module -e "
Promise.all([import('./src/mix/shuffle.js'),import('./src/mass/gen.js'),
             import('./src/mass/model.js'),import('./src/mass/checks.js')]).then(([S,G,M,C])=>{
  S.repartir({ alea:false, etages:true });
  ['auto','compact','barre','barres','L','U','cour','pavillons','hameau',
   'terrasses','peigne','libre'].forEach(function(p){
    M.massSet('parti', p);
    M.massVols(G.genMass(11));
    var b = M.bilanTotal();
    console.log(p, M.MASS.vol.length + ' corps',
      'demandé ' + Math.round(b.demande) + ' · posé ' + Math.round(b.pose),
      JSON.stringify(C.massVerdict(C.massCheck())));
  });
});"
```

Le relevé se regénère depuis le fichier Rhino (`rhino3dm` et `numpy` requis) :

```bash
python3 tools/extract-site.py
```
