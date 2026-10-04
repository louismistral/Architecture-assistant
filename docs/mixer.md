# L'onglet Programme mixer

Répartir le programme sur les niveaux, puis contrôler ce qu'on a réparti.

```
src/mix/prog.js       le programme vu comme des parts à poser ; adjacences par poste
src/mix/niv.js        la mécanique des règles de niveau (la table est au cadre, `data/cadre.js — NIV`)
src/mix/floors.js     la pile de niveaux, les parts posées, déplacer / scinder
src/mix/shuffle.js    la NOTE de niveau, le tirage, la proposition de pile
src/mix/checks.js     contrôle d'une répartition → écarts, avec code et remèdes
src/mix/mesures.js    les mesures brutes d'une répartition, pour le jugement
src/mix/fix.js        les remèdes : déplacer, vider, agrandir un plateau, poser un WC
src/mix/accept.js     les écarts qu'on assume — « laisser comme ça »
src/mix/opts.js       les réglages et leur dé : la pile, les plateaux, le lien des postes,
                      les adjacences actives
src/mix/store.js      persistance (localStorage, clé `saxon-mix-v1`)
src/views/mixer.js    la vue : la pile, les niveaux à l'échelle, le bac, le glisser
```

Un **poste** est une ligne du programme (18 salles de classe standard). Une **part** est un
morceau de poste posé à un niveau (6 de ces 18 au 1ᵉʳ étage). Un poste se scinde, sauf ceux
dont le règlement impose les dimensions — la salle de sport double, 28 × 32 m, ne se coupe
pas.

## Le tirage note avant de poser

Chaque niveau candidat reçoit une note : la place qui y reste, les adjacences ACTIVES déjà
satisfaites, la grappe qui y pèse, la famille d'usage, ce que l'usage scolaire veut au rez
et ce qu'il veut à l'étage. Un bruit de Gumbel d'amplitude `V.temperature` — la part du hasard,
`data/recherche.js` — s'y ajoute, et le meilleur gagne. À zéro le tirage est déterministe et rend
la répartition la mieux orientée ; plus elle monte, plus il propose des variantes. Chaque terme de
la note est une ligne d'ORIENTATION (`data/orientation.js`) — sa valeur en points fois la force de
son tag, Prioritaire (× `V.forcePrio`, 5) ou Souhaité (× 1) — ou le poids d'un CADRE ; voir
`docs/parametres.md`.

> Ce qui a précédé : un poste allait au niveau LE PLUS VIDE, pondéré par la place restante —
> c'était la seule note, on remplissait sans composer. Le « Shuffle » mélangeait les postes
> puis les RETRIAIT par surface, si bien que le tri écrasait le mélange. Et les dix-huit
> classes se répartissaient au prorata de la place libre, ce qu'aucune école qui existe ne
> fait.

Le tirage est la seule proposition : « Répartir », son jumeau ordonné, donnait la même chose
à l'ordre des chapitres près, et la seed rend le tirage aussi rejouable.

## La pile se déduit du site

`pilesAdmissibles()` construit la liste des piles que le site admet : celles dont le plateau
déduit tient dans l'emprise (l'aire POSABLE de la parcelle, 10'528 m², multipliée par
`V.plateauPart`, une ligne du cadre choisi), dont les étages ne dépassent pas le plafond, dont le rez porte ce que le
règlement y cloue, et dont les niveaux de classes suffisent au contingent. Le levier en tire
une, l'orientation « pile compacte » préférant les plus basses. **Une variante tirée est donc une variante VALABLE.**

> Avant : le nombre d'étages se déduisait d'un plateau de 2'400 m², un nombre rond sans
> rapport avec le site, et le sous-sol se décidait à PILE OU FACE — ce qui contredisait
> frontalement l'analyse de nappe du projet.

C'est pourquoi le **dé de la pile est allumé par défaut** : l'éteindre avant d'avoir composé
la pile revient à proposer une école de plain-pied de 3'400 m² d'emprise.

## Le plateau suit la répartition — si son dé est allumé

Comme la hauteur de niveau suit le programme qu'il porte. Le plateau sert de CAPACITÉ
pendant la pose — c'est lui qui répartit —, puis `ajusterPlateaux()` le ramène à ce que le
niveau porte vraiment, borné par l'emprise. Il restait sinon figé à la valeur estimée, et le
contrôle criait au débordement sur une pile que l'outil venait lui-même de proposer. Le vrai
plafond n'a jamais été le plateau : il est l'emprise.

Un plateau dont le dé est ÉTEINT est une décision : le tirage s'en sert comme capacité et ne
le corrige pas. S'il déborde, le contrôle le dit. Taper une valeur dans le champ éteint le dé.

## La circulation d'un niveau se compte sur ses pièces

Elle se règle au cahier des charges (la largeur du couloir), mais chaque niveau la COMPTE
sur ce qu'il porte : les couloirs devant ses pièces, et une ou deux cages d'escalier selon
le seuil de la protection incendie (`flCircDe()` dans `floors.js`, l'arithmétique dans
`core/model.js`). Les parts d'un même poste se regroupent d'abord : neuf WC posés en trois
parts au même niveau restent un bloc sanitaire à une porte. Un niveau sans bâti scolaire
n'a ni couloir ni cage. Le plateau, les cages et les pourcentages comparent ce bâti réel ;
seule la PRÉVISION de capacité pendant la pose (`usable()`) prend la part que le programme
entier donne, faute de mieux avant que les pièces soient posées.

## L'unité pédagogique

`V.clsParNiveau` (11, cadre choisi) plafonne les salles de classe d'un **niveau**, pas d'un poste : les
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

Une répartition hors règles est produite quand même, et `checks.js` la dit, avec la sévérité
que le TAG de la ligne lui donne : rouge pour le cadre opposable (Intangible), ambre pour notre
choix et pour une orientation. Une ligne éteinte ne dit plus rien.

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

**Une adjacence active est une règle, une adjacence éteinte n'est rien.** Chaque lien du
schéma fonctionnel s'allume ou s'éteint au flanc du mixer. Active, elle met ses deux postes
au même niveau — c'est la ligne `adj` du cadre choisi : le tirage la note d'un poids qui écrase
toute autre raison (`IMPOSE`, débordement compris) — et le contrôle la marque en ambre quand
elle ne tient pas, avec trois
remèdes : déplacer l'un, déplacer l'autre, ou l'éteindre. Éteinte, elle ne pèse rien et le
contrôle n'en dit rien : les deux postes sont indépendants. Par défaut, les adjacences
exigées sont actives et les mutualisations éteintes.

> Avant : toutes les adjacences étaient des préférences pondérées (`adjPoids` 26, `adjOpt`
> 0,35), et le tirage y renonçait dès qu'un niveau était plein.

Pour un poste réparti sur plusieurs niveaux, « même niveau » veut dire que les deux postes
PARTAGENT au moins un niveau — c'est ce que le contrôle vérifiait déjà.

## Tout se fait sur le dessin

Un bloc se glisse d'un niveau à l'autre ; délié, il montre ses pièces et l'on tire hors de
lui celle qu'on veut ailleurs — la scission n'est pas un geste de plus, c'est le déplacement
d'une pièce. Deux parts d'un même poste qui se retrouvent au même niveau se refondent
(`fuse`), donc se tromper ne coûte rien.

> Un menu faisait cela avant : « déplacer vers » listait les niveaux et « scinder » demandait
> « combien sur combien », alors que la pile et le bloc étaient là, sous les yeux.

**Un bloc entier emmène ce que ses adjacences actives lui tiennent** — sa grappe, au MÊME
niveau que lui (`moveGroupe` dans `floors.js`) : monter six salles de classe du premier au
deuxième emmène les WC et les vestiaires du premier, pas ceux du rez. Un poste lié part
entier, où qu'il soit. Une pièce seule ne dérange rien. Le fantôme du glisser dit combien de
pièces liées suivent.

Le clavier fait les mêmes gestes sur le bloc au foyer : flèches haut et bas pour changer de
niveau — le bac étant le cran sous le rez —, Maj pour n'emmener qu'une pièce (d'un poste
délié), Suppr pour renvoyer au bac.

Une pile neuve n'a qu'un **rez-de-chaussée** ; le premier tirage en propose une déduite du
site. On l'édite là où elle se dessine : « + Ajouter un étage » en tête de pile, « + Creuser
un sous-sol » au pied, une corbeille sur chaque niveau qui le retire en renvoyant ses pièces
au bac (`addFloorTop`, `addFloorBottom`, `delFloorAt`). Retirer un niveau du MILIEU est
permis : les cotes se renumérotent derrière, la pile reste contiguë, et le rez reste le rez.

## Les réglages, et leur dé

Chaque réglage a une **valeur**, et par-dessus un **dé** (`mix/opts.js`). Dé allumé, le
Shuffle décide ; dé éteint, la valeur est la nôtre et le tirage la respecte. **Toucher une
valeur la fige** : son dé s'éteint. Chacun se règle là où il se voit :

| réglage | où | dé par défaut |
|---|---|---|
| le nombre de niveaux | en tête de la pile | allumé — le tirage propose la pile |
| le plateau d'un niveau | sur le niveau, à côté du champ | allumé, niveau par niveau |
| le lien d'un poste | sur son bloc, et dans la liste du flanc | éteint ; les postes sont déliés |
| une adjacence | au flanc, lien par lien | éteint ; exigées actives, mutualisations éteintes |

Au flanc, **« Ce que tire le Shuffle »** porte un dé MAÎTRE par famille : il bascule toute
la famille d'un coup, et se lit « mixte » quand elle est partagée. « Tout lier » et « Tout
délier » y sont aussi, et la liste des quinze postes qui ont le choix — pour les blocs trop
petits pour porter leurs commandes, et pour le clavier. Le panneau **« Adjacences »** liste
les vingt-quatre liens du schéma, chacun avec son interrupteur, sa citation du règlement et
son dé ; « Exigées », « Toutes » et « Aucune » les règlent d'un coup, et un lien actif qui ne
tient pas porte la marque du contrôle.

Ce que tire un dé allumé se tire AVANT la pose, sur la même seed (`tirerReglages()` dans
`shuffle.js`) : lié ou délié, actif ou éteint, à pile ou face — un levier libre tire à parts
égales. La valeur tirée devient la valeur du réglage — on la lit sur le bloc et au flanc,
et on la garde en éteignant le dé. Une proposition se rejoue donc à l'identique, liens et
adjacences compris.

**Lié ou délié.** LIÉ, les pièces d'un poste vont ensemble, en un bloc, à un seul niveau — le
« groupé » du cahier des charges ; lier un poste rassemble ce qui est posé au niveau où il pèse
le plus (`rassembler`). DÉLIÉ, elles sont indépendantes : dessinées SÉPARÉES, chacune dans son
cadre, côte à côte parce qu'elles sont au même niveau — le « détaillé » —, déplacées une à une,
et le tirage peut les répartir sur plusieurs niveaux. Un poste d'une seule pièce, ou dont le
règlement impose les cotes, n'a pas le choix (`lienLibre()` dans `prog.js`). Allumer une
adjacence agit aussi sur ce qui est posé : le plus léger des deux postes rejoint le plus lourd,
si la règle de niveau l'y admet (`rapprocherLien`).

La barre du haut ne garde que ce qui agit sur l'ensemble : **Shuffle**, **Tout au bac**, et la
**Seed**, qu'on retape pour rejouer une proposition.

> Avant : trois interrupteurs dans la barre — « Shuffle niveaux », « Grouper les liés »,
> « Voir les pièces ». Le premier est devenu le dé de la pile, le deuxième les adjacences
> actives, le troisième le lien de chaque poste. L'ancien format enregistré (`{ niv, grp,
> pcs }`) se relit : `niv` redevient le dé de la pile.

## À savoir

Les locaux engins de la salle de gym (180 m²) ne sont pas posés : le règlement les convertit
en abri PC, dont les 750 m² les contiennent. Les poser compterait deux fois.

## À l'échelle, et les cotes de chaque pièce

Chaque niveau est dessiné **à l'échelle du mètre** (√`AIRE` pixels par mètre, le même pour tous) :
une pièce occupe ses cotes réelles, largeur × profondeur, et les pièces d'un poste se rangent en
grille. Le pavage d'avant donnait à chaque bloc la bonne surface mais une forme quelconque.

Les cotes d'une pièce viennent de **`coteDe(key)`** (`mix/opts.js`) — la LARGEUR choisie pour le
poste, enregistrée avec le projet ; la profondeur s'en déduit, à **surface exacte**, au module de
0,5 m (`validDims`, `core/geometry.js`). Sans cote, la pièce prend la profondeur que le massing
donne à ses bandes (`bandeMassing()`), sinon la plus carrée. Un bloc choisi offre la liste des
proportions admissibles, et « auto » ; il se **tire** aussi par ses poignées — le bord droit
élargit les pièces, le bord bas les approfondit — et la cote visée est ramenée, au lâcher, à la
proportion admissible la plus proche.

Une source pour trois onglets :
- **le massing** — une cote fixée dicte la profondeur des corps (`profPieces()` : la pièce la plus
  profonde deux fois, plus le couloir), et changer une cote recompose la volumétrie (elle entre
  dans `empreintePile()`) ; à l'inverse, sans cote, ce sont les corps qui donnent leur profondeur
  aux pièces ;
- **les Typologies** — elles lisent la cote de chaque poste pour la largeur de ses pièces, et leur
  éditeur l'écrit (`typoRegle(key, w)`), si bien qu'un réglage fait d'un côté se voit de l'autre.
