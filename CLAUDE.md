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
**Contraintes** (`view.subs`, `SUBS_BY` dans `src/core/viewstate.js`). Ils étaient trois,
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

**CHAQUE ONGLET A SES VOLETS**, et chacun garde le sien (`view.subs`, `SUBS_BY` dans
`src/core/viewstate.js`) :

| onglet | volets |
|---|---|
| Cahier des charges | Surfaces · Contraintes |
| Programme mixer | Répartition · **Contraintes** |
| Massing | Volumétrie · **Contraintes** |

Les deux volets « Contraintes » des OUTILS sont d'une autre nature que celui du cahier
des charges : là on lit ce que le RÈGLEMENT impose, ici on lit — et l'on RÈGLE — ce que
NOUS avons arbitré pour qu'un générateur produise quelque chose. Voir « La doctrine de
projet » plus bas.

URL : `#<onglet>/<volet>`, et `#programme/surfaces/<chap|fam>` pour le seul volet qui a un
regroupement. Les liens qui ont circulé — `#adjacences`, `#programme/adjacences`,
`#programme/fam` — restent valables et mènent au volet qui les a repris. Un volet s'ajoute
dans `SUBS_BY` plus une branche dans `render()` ; le bouton, l'ARIA et le routage par hash
suivent tout seuls. Le volet d'un onglet se nomme TOUJOURS avec son onglet
(`setSub(id, tab)`) : deux onglets ont un volet « contraintes », et le régler sans dire où
ne faisait rien.

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

## La doctrine de projet — source unique : `src/data/doctrine.js`

`rules.js` tient ce qui est OPPOSABLE. **`doctrine.js` tient tout le reste** — ce que nous
avons arbitré, préféré, supposé, parce qu'il fallait bien trancher pour produire un
bâtiment. Les deux générateurs n'ont pas d'autre source de réglage : *une valeur qui n'est
ni dans `rules.js` ni dans `doctrine.js` est un nombre écrit en dur, et c'est un défaut.*

Pourquoi ce fichier existe : les deux tirages étaient gouvernés par une trentaine de
nombres semés dans `shuffle.js` et `gen.js` — un sous-sol tiré à pile ou face, un bonus
d'alignement de 26 contre un bonus d'orientation de 10. On obtenait des résultats sans
pouvoir dire POURQUOI, donc sans pouvoir les corriger autrement qu'à tâtons.

**Cinq rangs de dureté**, et c'est la seule hiérarchie qui compte :

| rang | ce que ça veut dire |
|---|---|
| `dure` | écrite au règlement ou à l'AEAI. Le générateur ne rend jamais une composition qui l'enfreint |
| `ferme` | arbitrée par nous, faute de donnée opposable, mais APPLIQUÉE comme une règle |
| `forte` | préférence lourdement notée : le générateur y renonce seulement sans autre issue |
| `pref` | préférence : elle départage deux compositions également valables |
| `guide` | ne pèse sur aucun tirage ; elle oriente la lecture, le contrôle ou la recherche |

Le fichier porte quatre tables, et les deux volets « Contraintes » les affichent telles
quelles : `DOC` (les valeurs vivantes), `REGLES` (une ligne par contrainte, avec sa source,
le module qui l'applique et ce qu'elle change), `SCRIPTS` (l'inventaire des outils de
génération — ce que chacun lit, décide, et sur quoi il agit) et `TIRAGES` (ce que le hasard
décide, en toutes lettres). `REGLES[i].k` désigne la case de `DOC` : l'affichage et le
comportement ne peuvent pas diverger, et le volet écrit dans la case même que le générateur
lit. Une valeur réglée est persistée — mais **seuls les ÉCARTS au défaut** : tout
enregistrer figerait dans le navigateur les valeurs du jour, et une correction apportée au
fichier ne parviendrait jamais à qui a déjà ouvert l'application.

Le volet du massing porte en tête la **note de la composition à l'écran**, critère par
critère (`noterDetail()` / `noteCourante()`) : c'est la réponse à « pourquoi obtient-on ce
résultat », et sans elle les poids se règlent à l'aveugle. Celui du mixer porte **les piles
que le site admet**.

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
src/data/doctrine.js  ce que le règlement NE dit pas   ← SOURCE UNIQUE
src/data/schema.js    adjacences exigées               ← SOURCE UNIQUE
src/core/model.js     totaux, surfaces saisies, part de circulation
src/core/treemap.js   pavage squarifié : un bloc vaut sa surface
src/core/rand.js      tirage reproductible à graine
src/mix/prog.js       le programme vu comme des parts à poser ; adjacences par poste
src/mix/niv.js        règles de niveau, cotes admissibles d'un poste
src/mix/floors.js     la pile de niveaux, les parts posées, déplacer / scinder
src/mix/shuffle.js    la NOTE de niveau, le tirage, la proposition de pile
src/mix/checks.js     contrôle d'une répartition → écarts, avec code et remèdes
src/mix/fix.js        les remèdes : déplacer, vider, agrandir un plateau, poser un WC
src/mix/accept.js     les écarts qu'on assume — « laisser comme ça »
src/mix/opts.js       les trois interrupteurs : tirer la pile, grouper, voir les pièces
src/mix/store.js      persistance (localStorage, clé `saxon-mix-v1`)
src/views/mixer.js    la vue : la pile, les niveaux à l'échelle, le bac, le glisser
```

**LE TIRAGE NOTE AVANT DE POSER.** Chaque niveau candidat reçoit une note — la place qui y
reste, les adjacences exigées déjà satisfaites, la grappe qui y pèse, la famille d'usage,
ce que l'usage scolaire veut au rez et ce qu'il veut à l'étage —, un bruit de Gumbel
d'amplitude `DOC.temperature` s'y ajoute, et le meilleur gagne. À température nulle le
tirage est déterministe et rend la meilleure répartition ; plus elle monte, plus il propose
des variantes. Tous les poids sont dans `doctrine.js`.

Ce qui a précédé, et pourquoi c'était faux : un poste allait au niveau LE PLUS VIDE,
pondéré par la place restante — c'était la seule note, on remplissait sans composer ; le
« Shuffle » mélangeait les postes puis les RETRIAIT par surface, si bien que le tri écrasait
le mélange ; les dix-huit classes se répartissaient au prorata de la place libre, ce
qu'aucune école qui existe ne fait.

**LA PILE SE DÉDUIT DU SITE, elle ne se tire plus.** `pilesAdmissibles()` construit la
liste des piles que le site admet — celles dont le plateau déduit tient dans l'emprise
(l'aire POSABLE de la parcelle, 10'528 m², multipliée par `DOC.plateauPart`), dont les
étages ne dépassent pas le plafond, dont le rez porte ce que le règlement y cloue et dont
les niveaux de classes suffisent au contingent — et le tirage en prend une, les plus
compactes d'abord. Une variante tirée est donc une variante VALABLE. Avant : le nombre
d'étages se déduisait d'un plateau de 2'400 m², un nombre rond sans rapport avec le site,
et le sous-sol se décidait à PILE OU FACE — ce qui contredisait frontalement l'analyse de
nappe du projet. L'interrupteur « Shuffle niveaux » est par conséquent ENCLENCHÉ par
défaut : l'éteindre revient à proposer une école de plain-pied de 3'400 m² d'emprise.

**LE PLATEAU SUIT LA RÉPARTITION**, comme la hauteur de niveau suit le programme qu'il
porte. Il sert de CAPACITÉ pendant la pose — c'est lui qui répartit —, puis `ajusterPlateaux()`
le ramène à ce que le niveau porte vraiment, borné par l'emprise. Il restait sinon figé à
la valeur estimée, et le contrôle criait au débordement sur une pile que l'outil venait
lui-même de proposer. Le vrai plafond n'a jamais été le plateau : il est l'emprise.

**L'UNITÉ PÉDAGOGIQUE** (`DOC.clsParNiveau`, 11) plafonne les salles de classe d'un NIVEAU
— pas d'un poste : les salles standard et celles de réserve sont deux postes, et chacun
respectait le sien, ce qui faisait quatorze salles sur un plateau qui n'en admet que onze.
Elle ne compte que les VRAIES salles de classe (`UNITE` dans `niv.js`) : y ajouter le
dédoublement, l'ACM et l'appui portait le contingent à vingt-neuf, donc à quatre niveaux de
classes là où le règlement n'en admet que trois. Et elle décide aussi du nombre minimum
d'étages : vingt et une salles à onze par niveau en demandent deux, le rez non compris —
il porte déjà tout ce que le règlement y cloue.

**Un dernier étage vide, ou qui ne porte que ses sanitaires, n'est pas un étage** :
`tasserSommet()` redescend ce qu'il porte et le retire. On ne rogne que la pile qu'on vient
de proposer — celle que l'utilisateur a composée à la main lui appartient, même vide.

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

Une pile neuve n'a qu'un **rez-de-chaussée** ; le premier tirage en propose une déduite du
site. On l'édite **là où elle se dessine** :
« + Ajouter un étage » en tête de pile, « + Creuser un sous-sol » au pied, et une corbeille
sur chaque niveau qui le retire en renvoyant ses pièces au bac (`addFloorTop`,
`addFloorBottom`, `delFloorAt`). Retirer un niveau du MILIEU est permis : les cotes se
renumérotent derrière, la pile reste contiguë, et le rez reste le rez.

**Trois interrupteurs**, dans la barre du haut, persistés avec le reste :

- **Shuffle niveaux** — le tirage propose aussi la pile, déduite de l'aire POSABLE de la
  parcelle, de ce que le règlement cloue au rez et du contingent de classes. **Enclenché
  par défaut** : voir `pilesAdmissibles()` plus haut.
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
src/mass/checks.js    alertes info / à vérifier / erreur, avec code et remèdes
src/mass/fix.js       les remèdes : recaler, écarter, reformer, rééquilibrer
src/mass/etat.js      ce qui s'enregistre (lu par `mix/store.js`)
src/views/massing.js  le rail de commandes, le plan et la 3D côte à côte
src/views/plan.js     le plan : relevé, volumes, sélection, déplacement, rotation
src/views/vue3d.js    la 3D : terrain maillé, courbes drapées, existant, volumes
```

**Le massing ne redit rien du programme : il le LIT.** `niveaux()` relit `FLOORS` à chaque
appel — jamais de copie, jamais de cache. Mais un volume désigne ses niveaux par leur
INDICE : quand le mixer ajoute, retire ou renumérote un niveau, ces indices ne veulent plus
rien dire. `empreintePile()` en garde la forme, et le massing se régénère quand elle a
changé. Rien ne le voyait : on ne régénérait que si AUCUN volume n'était posé, si bien
qu'après un « Shuffle » au mixer on revenait sur une implantation qui répondait à la pile
PRÉCÉDENTE, et la note comme le bilan portaient sur un programme qui n'existait plus. On ne
compare que la FORME de la pile, pas les surfaces : un poste déplacé d'un étage à l'autre
change les aires, et `bilan()` le dit déjà — défaire une implantation composée à la main
pour un poste déplacé serait pire que le mal. Un poste déplacé d'étage dans le mixer change la
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
sont les classes ; en « monochrome », la forme seule — en BLANC de maquette dans la 3D
(`--site-mono`), où la masse se lit à l'ombre et à l'arête et où une teinte, même délavée,
laisse chercher ce qu'elle voudrait dire.

### DEUX TIRAGES, et ils ne se confondent jamais

- **Shuffle programme** — celui du mixer, appelé d'ici : il rebat la répartition dans les
  étages, et la volumétrie s'y adapte. Il obéit à l'interrupteur « Shuffle niveaux » du
  mixer, qui se règle au mixer et nulle part ailleurs — le doubler dans le rail du massing
  mettait deux boutons pour un seul réglage.
- **Shuffle massing** — il ne touche PAS au programme. Mêmes postes, mêmes surfaces, mêmes
  niveaux, même répartition ; seule la solution architecturale change : nombre de corps,
  position, orientation, proportions, forme, hauteurs, retraits, terrasses.

Ils ont deux graines distinctes — celle du mixer dans `core/rand.js`, celle du massing dans
`MASS.graine`. Les confondre ferait qu'on ne peut plus changer l'une sans perdre l'autre.

### La note : un critère porte un nom, ou il n'existe pas

`noterDetail()` rend le DÉTAIL — un critère, son nom, ce qu'il a coûté ou rapporté —, et
`noter()` n'en est que la somme. Le volet « Contraintes » du massing l'affiche pour la
composition à l'écran : c'est la réponse à « pourquoi obtient-on ce résultat ».

Quatre critères manquaient, et ils manquaient beaucoup :

- **le jour entre les corps.** Les 6 m de l'AEAI sont une distance d'INCENDIE : deux barres
  de quatre niveaux à six mètres l'une de l'autre sont conformes et inhabitables. L'écart
  utile se mesure à la HAUTEUR du plus haut (`DOC.ombreK`, 1,10). Il ne vaut qu'entre
  façades qui SE FONT FACE — `visAVis()` mesure la longueur en regard, faute de quoi deux
  corps en quinconce, à six mètres par leurs angles, déclenchaient une alerte que rien ne
  pouvait corriger. Et `reparer()` VISE cet écart, pas seulement celui de l'AEAI : sans
  cela la réparation ramenait tout à 6,35 m puis la note pénalisait ces mêmes 6,35 m — les
  deux se battaient, et la réparation gagnait toujours, parce que c'est elle qui fixe les
  positions ;
- **le programme.** La note ne connaissait que des rectangles : une salle de classe pouvait
  atterrir au nord, au cœur d'un bloc de 46 m de profondeur, sans qu'un point soit compté.
  Les critères « profondeur » et « sud » lisent la PART DE CLASSES de chaque corps
  (`postesDe()`, donc le mixer) — un corps de technique a le droit d'être épais ;
- **la cour.** 500 m² de cour et 120 m² de préau : un vide QUALIFIÉ, tenu par les
  bâtiments. Rien ne le composait — c'était une ligne de bilan, hors enveloppe. Le critère
  mesure le vide que la figure ENFERME, l'aire de son enveloppe convexe moins les emprises
  (`enveloppe()` dans `geom.js`) ;
- **l'adresse.** Le plus GRAND corps doit se tenir dans une bande d'approche d'une voie.
  « Au moins un corps près d'une rue » était vrai de toute composition, le site étant bordé
  de rues sur trois côtés ; et le calque des routes du relevé est filtré aux polylignes de
  plus de soixante mètres — sans quoi un bord de place comptait pour une rue.

Deux critères ont été corrigés : l'**orientation** pesait 10 contre 26 pour l'alignement,
si bien que l'outil rangeait les bâtiments sur des lignes plutôt que de les tourner au
soleil — elle pèse 34 et se pondère par la longueur de façade, le nombre d'étages et la
part de classes ; la **compacité** sommait les emprises, quantité quasi constante d'une
composition à l'autre qui ne départageait rien — elle se mesure en façade développée par
mètre carré bâti, ce que le règlement nomme (art. 2.9, Minergie).

### La salle de sport s'implante EN PREMIER

C'est l'objet le plus contraignant du programme : 896 m² qui ne montent pas, deux cotes
données, sept mètres libres sous structure. Elle était posée EN DERNIER et au hasard, puis
réparée — donc elle SUBISSAIT la composition au lieu de la fonder. `ancrer()` lui cherche
la place la plus BASSE du terrain qui soit admissible, et `reparer()` la fait céder trois
fois moins que les autres : ce sont les autres corps qui lui font de la place.

Les sous-sols, eux, ne vont PAS sous elle — sept mètres de hauteur libre plus trois mètres
de couverture font une fouille qu'aucun projet ne creuse sous une dalle de 28 × 32 m — et
ils se replacent APRÈS le repêchage, qui déplace les corps : sans cela une composition
repêchée annonçait un manque de couverture que le générateur n'avait plus moyen de voir.

### La recherche : on reconnaît avant de chercher

En « Auto », les onze partis se relayaient à tour de rôle sur trente essais — deux ou trois
tirages chacun, donc un bon parti éliminé par malchance et un mauvais retenu par chance.
Chacun reçoit maintenant `DOC.essaisParti` essais de reconnaissance ; les `DOC.finalistes`
meilleurs sont retenus, et les `DOC.essais` essais suivants se concentrent sur eux.

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
à 462,25 m et le règlement veut 3,00 m de couverture, qu'on ne trouve qu'au tiers est. Et
jamais sous la salle de sport — voir plus haut.

Douze partis, chacun composant vraiment différemment : auto, bloc compact, barre, barres
parallèles, L, U, cour, pavillons, hameau, terrasses, peigne, composition libre. « Auto »
les essaie tous et garde celui qui tient le mieux sur ce site avec ce programme.

### L'implantation est une RÈGLE ; le reste s'avertit

Un bâtiment ne sort pas du périmètre du concours. `admissible()` dans `gen.js` en est le
seul juge, et les deux chemins y passent : le générateur ne rend que des compositions qui
tiennent, et le glisser à la souris refuse la position qui n'en est pas une — il essaie
alors chaque axe séparément, si bien que le corps LONGE la limite au lieu de s'y arrêter
net. Trois conditions, et elles tiennent ensemble : tous les étages dedans avec le recul
de 5 m — tous, car un porte-à-faux qui franchit la limite est du bâti hors parcelle —,
6 m entre bâtiments (AEAI), rien sur l'existant ni à moins de 6 m de lui.

Quand une figure ne tient pas, elle est REPRISE, pas avertie. On ne peut pas raccourcir la
surface, elle est au règlement : le générateur rejoue donc sa recherche avec des corps de
plus en plus profonds — 18, 24, 32, 43, 46 m —, et REPÊCHE les corps restés dehors en
balayant la parcelle pour la position admissible la plus proche, quart de tour compris.
Quand rien ne tient malgré les douze partis, de un à sept corps et jusqu'à 46 m, ce n'est
plus une implantation à corriger : le niveau demande plus d'emprise que la parcelle n'en
offre, la composition est marquée `impossible`, et le contrôle dit d'aller ajouter un
étage AU MIXER. Un seuil de surface ne l'aurait pas dit : la parcelle a la forme d'un L,
et l'aire disponible (10'528 m², recul déduit) n'est pas l'aire posable en rectangles
séparés de six mètres.

Tout le reste s'avertit et ne se refuse pas, en trois niveaux : **erreur** pour une règle
écrite (règlement, AEAI) ou une géométrie impossible ; **à vérifier** pour une règle de
projet ou une marge qui se discute ; **info** pour ce qu'il faut savoir sans corriger. Le
bilan de surface est donné niveau par niveau — demandé, posé, écart —, parce que c'est la
question à laquelle l'outil doit répondre à tout moment.

### Le porte-à-faux est permis, mais il n'est pas la règle

Un étage peut déborder de celui du dessous. Il ne franchit aucune règle écrite et
n'attend aucune correction : le contrôle le classe donc en **info** et le chiffre au
centimètre. La 3D lui laisse l'ARÊTE D'AVERTISSEMENT — c'est la seule chose qui le fasse
trouver d'un coup d'œil, et un débord qu'on ne lit que dans une liste n'est pas un
débord qu'on corrige. Le volume choisi porte un champ « porte-à-faux du dernier étage »
pour en faire un à la main. Il ne fait pas sortir de la parcelle : le débord est permis,
le hors-parcelle non.

Le générateur, lui, PRÉFÈRE L'APLOMB : `noter()` fait payer chaque mètre de débord, si
bien qu'entre deux compositions qui logent le même programme, celle qui tient d'aplomb
gagne. Auparavant les douze partis en portaient tous, sur tous les tirages — de quatre à
dix-huit mètres —, et une alerte qu'on voit partout ne se lit plus nulle part.

Deux causes, et deux réponses différentes :

- **L'artefact.** Les parts se partageaient niveau par niveau, indépendamment : un corps
  portant un sixième du rez et un tiers du premier devenait plus large en montant, et
  l'on lisait jusqu'à soixante-dix mètres de débord que personne n'avait demandés. Trois
  choses l'en empêchent — un corps garde sa PROFONDEUR du rez au faîte, donc une aire
  plus petite donne une largeur plus petite ; le partage monte du bas avec un PLAFOND,
  l'aire du niveau du dessous ; et les corps sont PROMUS d'office quand un étage demande
  plus que ses porteurs ne pèsent en bas.
- **Le débord STRUCTUREL.** La salle de sport prend 896 m² du rez sans monter : les autres
  corps ont donc moins d'emprise au sol qu'à l'étage, et à profondeur constante ils y
  sont plus larges. Aucun partage entre corps n'y change rien — c'est une soustraction.
  Il n'y a qu'une façon honnête de le supprimer : **poser l'étage manquant sur la salle
  elle-même**. Elle garde ses cotes du règlement, l'étage tient dans ses 28 × 32 m et ne
  déborde de rien, et le programme y trouve l'emprise qui lui manquait. `monter()`
  compose les deux — avec et sans —, la note tranche, et le contrôle dit en info
  pourquoi cet étage est là et que la portée de 28 m est à vérifier en structure.
  C'est aussi pourquoi la CLÉ d'un poste imposé est portée par l'ÉTAGE et non par le
  volume (`filtreDe`) : l'étage du dessus loge du programme ordinaire.

Reste le porte-à-faux voulu : celui qu'on fait à la main, et celui que le programme
impose quand la salle de sport ne peut pas absorber le surplus. Ceux-là sont vrais, ils
s'affichent, et ils se discutent.

### La profondeur se CHOISIT ; son plafond est donné

Elle a été un champ à saisir, 18 m par défaut — un chiffre de projet sans source, qu'on
pouvait mettre à 9 ou à 46 sans que rien ne le contredise —, puis une valeur figée, qui ne
laissait plus rien essayer alors que la profondeur est le premier choix d'un projet
d'école. C'est aujourd'hui **un curseur borné**, et les deux bornes viennent d'ailleurs
que de nous (`mass/model.js`) :

- le **PACom de Saxon** range le site en zone de constructions et d'installations
  publiques A — aucune contrainte de gabarit, de hauteur ni de distance aux limites
  (art. 2.3). Il n'impose donc AUCUNE profondeur, et il faut le dire plutôt qu'inventer ;
- le **programme** donne le PLAFOND : `profMax()`, la petite cote du local le plus profond
  à loger — la salle de sport double, 28 m. **Aucun volume ne le franchit**, ni le
  générateur ni la main : l'épaississement de la recherche s'y arrête, quitte à rendre la
  composition impossible et à renvoyer au mixer, et la poignée de redimensionnement y est
  bornée. Au-delà, on bâtirait de la profondeur que personne n'a demandée, et sans jour ;
- le **programme** donne aussi le point de départ : `profUsuel()`, deux rangées de salles
  de classe prises à leur surface BÂTIE — le couloir est dans la part de circulation, il
  ne s'ajoute pas par-dessus —, arrondi au demi-mètre comme toutes les cotes du projet,
  soit 18,5 m. Le plancher du curseur, lui, est la largeur d'une classe et de son couloir.

Quatre curseurs ont disparu en chemin — force d'alignement, compacité, régularité,
intensité des terrasses. Ils réglaient ce que le PARTI dit déjà (un peigne est fragmenté,
un bloc compact l'est par définition), et personne ne savait quoi répondre à
« compacité 0,35 ». Ce sont des constantes de composition, écrites là où elles agissent
(`JEU` et `GRAD` dans `gen.js`, `DOC.alignForce` et `DOC.alignPoids` dans la doctrine —
ce que le générateur TOURNE un corps vers son attracteur et ce que la note lui RAPPORTE
sont deux choses, et un seul nombre faisait les deux) ; la compacité, dont la valeur neutre
ne changeait rien, a été remplacée par une vraie mesure de façade développée. Il reste
quatre réglages au rail : le nombre de VOLUMES — le rail dit volume, comme le reste de
l'interface, là où le générateur dit corps —, la distance entre eux, la profondeur, et
l'orientation générale.

### Le second temps occupe du terrain, donc il se dessine

La piscine (500 m²) et le local de chauffage à distance (400 m²) sont des ouvrages
**indépendants des bâtiments scolaires et réalisés plus tard** (art. 2.2) : ils ne pèsent
sur aucun plateau, ne comptent dans aucun niveau du bilan, et le plan de situation les
veut en pointillé. On n'en dessinait donc rien — et l'implantation promettait 900 m² de
terrain qu'elle n'avait pas, soit le quart d'un rez d'école, que la cour et le
stationnement croyaient disponibles.

Ce sont des BÂTIMENTS, et `secondTemps()` les reconnaît à ce qui les distingue de la
cour : une **hauteur libre**. Ce qui n'a pas de hauteur n'est pas un volume, et c'est le
programme qui le dit — pas une liste de noms réécrite dans le code. Ils portent donc leur
propre hauteur (`e.h`, via `hauteurEtage()`) : une piscine indépendante ne prend pas les
7,45 m que la salle de sport impose au rez de l'école.

Trois façons de les prendre, et les trois se défendent — **deux volumes** séparés, qui est
la lecture littérale du règlement et le défaut ; **un seul** volume commun, la piscine et
le chauffage à distance partageant volontiers leurs machines et leur accès camion ;
**aucun**, pour ne regarder que l'école.

Ils se posent **après** que l'école est composée, sur la composition retenue, et prennent
les MARGES du site : `poserSecond()` balaie la parcelle du bord vers le cœur et prend la
première position admissible — mêmes limites, même recul, mêmes six mètres. Les faire
concourir avec les corps d'école doublait le coût d'un tirage et écartait des figures
d'école valables pour loger une piscine qu'on ne bâtira pas avant dix ans. Quand aucune
place ne tient, l'ouvrage **n'est pas posé** et le contrôle le dit, avec les gestes qui
le résoudraient : mieux vaut l'absence que le mensonge.

Ils sont hors de tout ce qui mesure l'ÉCOLE : le bilan de surface, la compacité, la cour
tenue, l'adresse, la part de classes et le jour entre corps les ignorent — exiger seize
mètres entre une piscine basse et un corps de classes était une alerte que rien ne pouvait
corriger. Ils ne sont hors de rien de ce qui tient au TERRAIN : périmètre, recul, six
mètres, existant, pente.

### Une alerte se clique : le geste, ou l'assumer

Le massing disait, et laissait tout le travail à faire. On lisait « volume 2 sort du
périmètre de 7,49 m » et l'on allait le tirer à la souris, au pixel près, jusqu'à ce que
le message disparaisse. C'est exactement l'interaction que le mixer avait depuis le début,
et elle est maintenant la même ici : une alerte s'ouvre sur **les gestes qui la
résoudraient** et sur **« laisser comme ça »**.

- Les remèdes vivent dans `src/mass/fix.js`, à côté de la règle qu'ils réparent. La
  MÉCANIQUE, elle, reste dans `gen.js` — recaler, écarter, replacer un sous-sol, reposer
  les ouvrages du second temps sont ce que le générateur sait déjà faire : le contrôle et
  le générateur doivent réparer de la même façon, sans quoi ils se contrediraient à chaque
  clic.
- Aucun remède ne s'applique tout seul, et **aucun n'en crée un autre** : tout geste qui
  déplace ou redimensionne repasse par `admissible()`, et rend `false` en remettant en
  place quand il ne tient pas. Ce qui change une forme le fait **à surface exacte** — c'est
  la règle première du projet ; sans cela, réparer une proportion aurait créé un écart au
  bilan.
- Un remède qui n'existe pas n'est pas proposé : on n'élargit pas un corps dont le
  règlement fixe les cotes, et on ne remet pas d'aplomb un porte-à-faux qui vient des
  surfaces — il faudrait changer les mètres carrés, et ils sont au règlement. L'alerte
  porte alors une `note` qui le dit.
- « Laisser comme ça » n'efface rien : l'alerte quitte le verdict, passe dans « laissés
  tels quels » et se reprend d'un clic. Les codes sont ceux du mixer, préfixés **`m:`** —
  « je laisse comme ça » est une seule décision de projet et n'a pas à s'enregistrer à
  deux endroits, mais un code de niveau et un code de volume ne doivent jamais se
  rencontrer, et chaque onglet ne reprend que les siens.

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
- **Un remède d'alerte du massing** : `src/mass/fix.js` seul, nommé dans `checks.js` à
  côté de la règle qu'il répare. La mécanique qu'il rejoue reste dans `gen.js`.
- **Un seuil, un plafond, un poids de génération** : `src/data/doctrine.js` seul. Les deux
  générateurs le lisent, les deux volets « Contraintes » l'affichent et le règlent. Une
  règle nouvelle s'ajoute dans `DOC` (la valeur) plus `REGLES` (sa ligne : rang, source,
  module qui l'applique, ce qu'elle change) ; le volet suit tout seul.
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
  Le **terrain** est une grille d'altitudes au pas de **2 m** qui PASSE PAR LES COURBES
  DE NIVEAU — le relevé en donne une tous les **50 cm**. Pour chaque nœud on prend le
  point de courbe le plus proche, puis le plus proche d'une AUTRE altitude, et l'on
  interpole entre les deux au prorata des distances : un nœud posé sur une courbe reçoit
  exactement son altitude, et entre deux courbes la pente est droite. **Quatre centimètres
  d'écart en moyenne** sur le périmètre du concours, 46 cm au pire (`SITE.grid`, 463,0 à
  467,9 m, 465,0 de moyenne). Les altitudes sont écrites en **centimètres entiers** au
  -dessus de `zsol` : au décimètre, une pente à 1,5 % se terrassait d'elle-même — une
  marche tous les sept mètres, que le maillage en pleine résolution montrait toutes.
  Deux passes de lissage très douces ne portent que sur le coteau, là où les courbes sont
  à un mètre l'une de l'autre et qu'une grille au pas de deux ne peut pas les résoudre :
  un nœud reste FIGÉ tant qu'il est sur une courbe et que la voisine est plus loin que le
  pas — donc partout sur le site. Ce qui a précédé : un plan incliné à trois nombres, qui
  se trompait de deux mètres au pied du coteau, puis une moyenne pondérée qui suivait la
  pente en gros mais pas les courbes, et les laissait flotter au-dessus du maillage.
  Les bâtiments existants portent leur pied et leur faîte (`SITE.bath`), lus dans les
  solides du calque « batiments 3d ». Tout ce qui traverse le cadre — le périmètre plus
  55 m — y est **coupé**, et non gardé entier : une polyligne dont un seul sommet tombait
  dedans partait sinon à cent mètres dans le vide, au-delà du maillage du terrain, et le
  relevé flottait dans le blanc. Le fichier Rhino n'a **pas de calque d'arbres** : ce
  qu'on ne relève pas ne s'invente pas.
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

Et la doctrine, pour voir ce que chaque critère coûte à la composition retenue :

```bash
node --input-type=module -e "
Promise.all([import('./src/mix/shuffle.js'),import('./src/mass/gen.js'),
             import('./src/mass/model.js')]).then(([S,G,M])=>{
  S.repartir({ alea:false, etages:true });
  M.massSet('parti','auto');
  M.massVols(G.genMass(11));
  var d = G.noteCourante();
  d.crit.forEach(function(c){
    console.log(c.n.padEnd(38), (c.pts >= 0 ? '+' : '−') + Math.round(Math.abs(c.pts)));
  });
  console.log('TOTAL', Math.round(d.total));
});"
```

Le relevé se regénère depuis le fichier Rhino (`rhino3dm` et `numpy` requis) :

```bash
python3 tools/extract-site.py
```
