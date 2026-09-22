# L'onglet Programme mixer

Répartir le programme sur les niveaux, puis contrôler ce qu'on a réparti.

```
src/mix/prog.js       le programme vu comme des parts à poser ; adjacences par poste
src/mix/niv.js        règles de niveau, cotes admissibles d'un poste
src/mix/floors.js     la pile de niveaux, les parts posées, déplacer / scinder
src/mix/shuffle.js    la NOTE de niveau, le tirage, la proposition de pile
src/mix/checks.js     contrôle d'une répartition → écarts, avec code et remèdes
src/mix/fix.js        les remèdes : déplacer, vider, agrandir un plateau, poser un WC
src/mix/accept.js     les écarts qu'on assume — « laisser comme ça »
src/mix/opts.js       les trois interrupteurs
src/mix/store.js      persistance (localStorage, clé `saxon-mix-v1`)
src/views/mixer.js    la vue : la pile, les niveaux à l'échelle, le bac, le glisser
```

Un **poste** est une ligne du programme (18 salles de classe standard). Une **part** est un
morceau de poste posé à un niveau (6 de ces 18 au 1ᵉʳ étage). Un poste se scinde, sauf ceux
dont le règlement impose les dimensions — la salle de sport double, 28 × 32 m, ne se coupe
pas.

## Le tirage note avant de poser

Chaque niveau candidat reçoit une note : la place qui y reste, les adjacences exigées déjà
satisfaites, la grappe qui y pèse, la famille d'usage, ce que l'usage scolaire veut au rez
et ce qu'il veut à l'étage. Un bruit de Gumbel d'amplitude `DOC.temperature` s'y ajoute, et
le meilleur gagne. À température nulle le tirage est déterministe et rend la meilleure
répartition ; plus elle monte, plus il propose des variantes. Tous les poids sont dans
`doctrine.js`.

> Ce qui a précédé : un poste allait au niveau LE PLUS VIDE, pondéré par la place restante —
> c'était la seule note, on remplissait sans composer. Le « Shuffle » mélangeait les postes
> puis les RETRIAIT par surface, si bien que le tri écrasait le mélange. Et les dix-huit
> classes se répartissaient au prorata de la place libre, ce qu'aucune école qui existe ne
> fait.

Le tirage est la seule proposition : « Répartir », son jumeau ordonné, donnait la même chose
à l'ordre des chapitres près, et la graine rend le tirage aussi rejouable.

## La pile se déduit du site

`pilesAdmissibles()` construit la liste des piles que le site admet : celles dont le plateau
déduit tient dans l'emprise (l'aire POSABLE de la parcelle, 10'528 m², multipliée par
`DOC.plateauPart`), dont les étages ne dépassent pas le plafond, dont le rez porte ce que le
règlement y cloue, et dont les niveaux de classes suffisent au contingent. Le tirage en
prend une, les plus compactes d'abord. **Une variante tirée est donc une variante VALABLE.**

> Avant : le nombre d'étages se déduisait d'un plateau de 2'400 m², un nombre rond sans
> rapport avec le site, et le sous-sol se décidait à PILE OU FACE — ce qui contredisait
> frontalement l'analyse de nappe du projet.

C'est pourquoi l'interrupteur « Shuffle niveaux » est **enclenché par défaut** : l'éteindre
revient à proposer une école de plain-pied de 3'400 m² d'emprise.

## Le plateau suit la répartition

Comme la hauteur de niveau suit le programme qu'il porte. Le plateau sert de CAPACITÉ
pendant la pose — c'est lui qui répartit —, puis `ajusterPlateaux()` le ramène à ce que le
niveau porte vraiment, borné par l'emprise. Il restait sinon figé à la valeur estimée, et le
contrôle criait au débordement sur une pile que l'outil venait lui-même de proposer. Le vrai
plafond n'a jamais été le plateau : il est l'emprise.

## L'unité pédagogique

`DOC.clsParNiveau` (11) plafonne les salles de classe d'un **niveau**, pas d'un poste : les
salles standard et celles de réserve sont deux postes, et chacun respectait le sien, ce qui
faisait quatorze salles sur un plateau qui n'en admet que onze.

Elle ne compte que les VRAIES salles de classe (`UNITE` dans `niv.js`) : y ajouter le
dédoublement, l'ACM et l'appui portait le contingent à vingt-neuf, donc à quatre niveaux de
classes là où le règlement n'en admet que trois.

Elle décide aussi du nombre minimum d'étages : vingt et une salles à onze par niveau en
demandent deux, le rez non compris — il porte déjà tout ce que le règlement y cloue.

**Un dernier étage vide, ou qui ne porte que ses sanitaires, n'est pas un étage** :
`tasserSommet()` redescend ce qu'il porte et le retire. On ne rogne que la pile qu'on vient
de proposer — celle que l'utilisateur a composée à la main lui appartient, même vide.

## Le mixer ne refuse rien

Une répartition hors règles est produite quand même, et `checks.js` la dit : rouge pour une
règle écrite au règlement ou à l'AEAI, ambre pour une règle de projet ou une marge qui se
discute. Le plateau, le nombre de niveaux et la part de circulation sont des choix de
projet : leur dépassement est ambre.

**Un écart se clique.** Il s'ouvre sur le geste qui le résoudrait — déplacer le poste au
niveau que la règle admet, vider le niveau, porter le plateau à la surface qu'il faut, poser
un WC — ou sur « laisser comme ça ». Chaque écart porte donc deux choses de plus qu'un
message :

- un **code** stable (`niv:<i>:<poste>`, `plate:<cote>`, `adj:<a>|<b>`…), construit sur les
  COTES et non sur les indices de niveau, pour qu'assumer un écart ne se défasse pas au
  premier réglage. `accept.js` tient la liste, `store.js` la persiste ;
- ses **remèdes**, fabriqués par `fix.js` et nommés dans `checks.js`, à côté de la règle
  qu'ils réparent. Un remède qui en créerait un autre n'est pas proposé : `fixDeplacer` rend
  `null` pour une cote que `lvRange` refuse au poste. Un écart sans remède mécanique — les
  deux cages d'escalier se dessinent à la typologie — porte une `note` qui le dit.

« Laisser comme ça » n'efface rien : l'écart quitte le verdict, passe dans « laissés tels
quels » et se reprend d'un clic.

**Un écart ouvert DÉSIGNE ses coupables** dans la pile : le niveau visé prend le filet de
l'écart, les pièces en cause le portent (`issFocus` dans la vue, `keys` sur l'écart). Lire un
conflit et devoir ensuite chercher les pièces à la main, c'était tout le travail laissé à
faire.

**Les contraintes de connexion ne sont jamais dures.** Le tirage les prend comme des
préférences — un poste va d'abord au niveau où se trouve déjà ce que le règlement lui demande
de toucher — et le contrôle dit après coup ce qui n'a pas pu tenir.

## Tout se fait sur le dessin

Un bloc se glisse d'un niveau à l'autre ; ouvert, il montre ses pièces et l'on tire hors de
lui celle qu'on veut ailleurs — la scission n'est pas un geste de plus, c'est le déplacement
d'une pièce. Deux parts d'un même poste qui se retrouvent au même niveau se refondent
(`fuse`), donc se tromper ne coûte rien.

> Un menu faisait cela avant : « déplacer vers » listait les niveaux et « scinder » demandait
> « combien sur combien », alors que la pile et le bloc étaient là, sous les yeux.

Le clavier fait les mêmes gestes sur le bloc au foyer : flèches haut et bas pour changer de
niveau — le bac étant le cran sous le rez —, Maj pour n'emmener qu'une pièce, Suppr pour
renvoyer au bac.

Une pile neuve n'a qu'un **rez-de-chaussée** ; le premier tirage en propose une déduite du
site. On l'édite là où elle se dessine : « + Ajouter un étage » en tête de pile, « + Creuser
un sous-sol » au pied, une corbeille sur chaque niveau qui le retire en renvoyant ses pièces
au bac (`addFloorTop`, `addFloorBottom`, `delFloorAt`). Retirer un niveau du MILIEU est
permis : les cotes se renumérotent derrière, la pile reste contiguë, et le rez reste le rez.

## Les trois interrupteurs

Dans la barre du haut, persistés avec le reste.

- **Shuffle niveaux** — le tirage propose aussi la pile, déduite de l'aire posable de la
  parcelle, de ce que le règlement cloue au rez et du contingent de classes. Enclenché par
  défaut (voir plus haut).
- **Grouper les liés** — déplacer une pièce emmène toute sa GRAPPE de proximité, la composante
  connexe des adjacences exigées (`grappeDe` dans `prog.js`, `moveGroupe` dans `floors.js`).
  Une mutualisation possible n'en fait pas partie : elle est offerte, pas due. La grappe de la
  salle de sport compte quatorze postes — elle est grande parce que le règlement le dit, et
  c'est ce que l'interrupteur donne à voir. Éteint, une grappe peut s'éparpiller sur trois
  étages, et le contrôle le dira. L'enclencher AGIT sur ce qui est déjà posé : `regrouper()`
  ramène chaque grappe au niveau où elle pèse déjà le plus, pour défaire le moins de travail
  possible. Sans cela l'interrupteur annonçait une règle sans l'appliquer.
- **Voir les pièces** — le bloc est DIVISÉ en ses pièces, à la surface unitaire du poste, par
  des traits tiretés qui vont d'un bord à l'autre : un refend de plan, qui sépare sans clore.
  C'est la prise de la scission. Des rectangles cernés donnaient à lire dix-huit objets rangés
  dans une boîte plutôt qu'un poste découpé. La trame est PLEINE — on préfère un partage exact
  à des cellules parfaitement carrées, sinon la dernière rangée semble inachevée. Rien n'est
  divisé pour un poste que le règlement ne coupe pas, ni quand une pièce deviendrait trop
  petite pour être visée.

## À savoir

Les locaux engins de la salle de gym (180 m²) ne sont pas posés : le règlement les convertit
en abri PC, dont les 750 m² les contiennent. Les poser compterait deux fois.
