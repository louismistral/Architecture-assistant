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
src/mix/opts.js       les réglages : la pile et son dé, le lien des postes, les cotes ;
                      les adjacences exigées, toujours actives
src/mix/store.js      persistance (localStorage, clé `saxon-mix-v1`)
src/views/mixer.js    la vue : le rail en chaîne, la pile, les niveaux à l'échelle, le glisser
```

Un **poste** est une ligne du programme (18 salles de classe standard). Une **part** est un
morceau de poste posé à un niveau (6 de ces 18 au 1ᵉʳ étage). Un poste se scinde, sauf ceux
dont le règlement impose les dimensions — la salle de sport double, 28 × 32 m, ne se coupe
pas.

## Le tirage note avant de poser

Chaque niveau candidat reçoit une note : la place qui y reste, les adjacences ACTIVES déjà
satisfaites, la grappe qui y pèse, la famille d'usage, ce que l'usage scolaire veut au rez
et ce qu'il veut à l'étage — la coupe par le poids : le public, le bruit et les petits en bas
(règles de niveau), le calme en haut (`cla-haut`, `bruit-calme`, Prioritaires). Un bruit de Gumbel d'amplitude `V.temperature` — la part du hasard,
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

## Un massing de Rhino dit où va chaque chapitre

Un volume dessiné dans Rhino revient tel qu'il est (`docs/massing.md`, *Les corps libres*), et
chaque solide porte le chapitre de son sous-calque. **La pile suit le volume** :
`import.js — poserLibres()` pose les niveaux et les plateaux du fichier (`setStack`), puis répartit
avec `repartir({ garder:true, chapitres })` — la pile et ses plateaux restent ceux qu'on a posés.

- **Les niveaux d'un poste** (`shuffle.js — rangeOf`) : ceux où son chapitre a des solides. S'il
  n'en reste aucun que sa règle de niveau admette, ceux du dessin — c'est lui qui décide, le
  contrôle dira la règle.
- **La place d'un chapitre sur un niveau** (`libreChap`) : la surface intérieure de ses solides,
  hors couloirs, moins ce qu'il y porte déjà. Elle borne la pose (`poser`) et la note de place.
- **Remplir le volume** (`remplirChapitres`) : la note préfère les classes en haut, et vestiaires
  et WC les suivent — un niveau débordait quand son voisin restait à moitié vide. Chaque niveau
  d'un chapitre se remplit donc dans la MÊME proportion que les autres : une unité passe d'un
  niveau à l'autre tant que le passage rapproche les deux de leur part, la plus grande d'abord,
  puis les sanitaires se refont sur les classes.

Les chapitres se lisent chez le massing (`mass/model.js — chapNivDe`, enregistré par
`setChapitres`) : un « Shuffle programme » sur un volume de Rhino les tient toujours, et garde la
pile et les plateaux du fichier même si leur dé est allumé — ses étages sont ceux du volume ; un
« Shuffle massing », qui remplace le volume, les libère. Sans corps libre, rien ne change.

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

**Une adjacence exigée est du cadre opposable.** C'est la contrainte première du mixer : le
schéma fonctionnel et les remarques du programme (ligne `adj`, Intangible). Chaque lien exigé
met ses deux postes au même niveau — le tirage le note d'un poids qui écrase toute autre raison
(`IMPOSE`) — et le contrôle le marque en rouge quand il ne tient pas, avec deux remèdes :
déplacer l'un ou l'autre. Une seule rompue, et le massing ne propose aucun volume
(`checks.js — adjRompues()`, lu par `mass/gen.js — genMass()`). Les mutualisations ne lient
rien. Il n'y a plus ni interrupteur ni dé par lien, ni dé de plateau ni dé de lien de poste :
le plateau se déduit de la pile, et la pile se choisit assez haute pour qu'aucun étage ne
surmonte la salle de sport (`pilesAdmissibles()`).

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
| le lien d'un poste | sur son bloc, et à l'étape Leviers du rail | éteint ; les postes sont déliés |
| une adjacence | à l'étape Adjacences du rail, lien par lien | éteint ; exigées actives, mutualisations éteintes |

À l'étape **Leviers** du rail, ce que tire le Shuffle porte un dé MAÎTRE par famille : il bascule toute
la famille d'un coup, et se lit « mixte » quand elle est partagée. « Tout lier » et « Tout
délier » y sont aussi, et la liste des quinze postes qui ont le choix — pour les blocs trop
petits pour porter leurs commandes, et pour le clavier. Le panneau **« Adjacences »** liste
les vingt-quatre liens du schéma, chacun avec son interrupteur, sa citation du règlement et
son dé ; « Exigées », « Toutes » et « Aucune » les règlent d'un coup, et un lien actif qui ne
tient pas porte la marque du contrôle.

Ce que tire un dé allumé se tire AVANT la pose, sur la même seed (`tirerReglages()` dans
`shuffle.js`) : lié ou délié, actif ou éteint, à pile ou face — un levier libre tire à parts
égales. La valeur tirée devient la valeur du réglage — on la lit sur le bloc et au rail,
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

## Le rail est une chaîne, comme au Massing et aux Typologies

La pile tient toute la largeur ; ce qui la commande est au rail de gauche, avec les composants
du Massing (`.mass-rail`, `.mass-etape`) :

- **Proposer**, en tête et toujours visible : **Shuffle programme** (le geste de l'onglet, le
  même nom qu'au Massing), le mode auto et les shuffles des autres onglets, **Tout au bac**, et
  la **Seed**, qu'on retape pour rejouer une proposition.
- **Les étapes**, chacune repliable, son ÉTAT écrit à droite : 1 · **À placer** — le bac ;
  l'étape entière reçoit un bloc glissé, même repliée, et s'ouvre tant qu'il reste à poser.
  2 · **Contraintes** — le contrôle ; un conflit l'ouvre d'elle-même. 3 · **Leviers** — ce que
  tire le Shuffle. 4 · **Adjacences** — rompues ou tenues. 5 · **Circulation** — en lecture.
  Contraintes et Leviers renvoient au volet Contraintes.
- Le corps d'une étape ne se construit que si elle est OUVERTE : le rail se refait à chaque geste.

> Avant : trois interrupteurs dans la barre — « Shuffle niveaux », « Grouper les liés »,
> « Voir les pièces ». Le premier est devenu le dé de la pile, le deuxième les adjacences
> actives, le troisième le lien de chaque poste. L'ancien format enregistré (`{ niv, grp,
> pcs }`) se relit : `niv` redevient le dé de la pile.

## À savoir

Les locaux engins de la salle de gym (2 × 90 m²) sont des pièces posées, liées à la salle de
sport (adjacence exigée : à proximité immédiate, au même niveau). Le règlement permet de les
convertir en abri PC, sans l'imposer : le lien abri–engins reste une mutualisation.

## Un niveau est un rectangle plein, et les cotes de chaque pièce

Chaque niveau est **un rectangle de sa surface bâtie**, à la même échelle pour tous (`AIRE` px² par
m², la largeur de la pile), **divisé** en la surface de chaque poste — famille par famille, puis
poste par poste (`squarify`, `core/treemap.js`) — puis en sa bande de circulation ; la bande hors
enveloppe (cour, piscine, chauffage à distance) le prolonge sous un filet. Ni gouttière, ni trou, ni
vide jusqu'à la ligne de plateau : celle-ci ne se dessine que là où le bâti la dépasse. Les niveaux
sont **posés l'un sur l'autre**, sans écart (`.mix-pile`). Délié, un poste divise son bloc en
rangées, chacune haute à proportion de ses pièces : une dernière rangée incomplète s'élargit, et
chaque pièce garde la même surface.

> Avant : chaque pièce était dessinée à ses cotes, les postes rangés en rangées — d'où des
> gouttières, un grand vide à côté de la salle de sport et des cases vides dans les grilles.

Les cotes d'une pièce viennent de **`coteDe(key)`** (`mix/opts.js`) — la LARGEUR choisie pour le
poste, enregistrée avec le projet ; la profondeur s'en déduit, à **surface exacte**, au module de
0,5 m (`validDims`, `core/geometry.js`). Sans cote, la pièce prend la profondeur que le massing
donne à ses bandes (`bandeMassing()`), sinon la plus carrée. Un bloc choisi offre la liste des
proportions admissibles, et « auto » ; la cote choisie s'écrit sur le bloc. Les poignées qui
étiraient un bloc dessiné à l'échelle ont disparu avec ce dessin.

Une source pour trois onglets :
- **le massing** — une cote fixée dicte la profondeur des corps (`profPieces()` : la pièce la plus
  profonde deux fois, plus le couloir), et changer une cote recompose la volumétrie (elle entre
  dans `empreintePile()`) ; à l'inverse, sans cote, ce sont les corps qui donnent leur profondeur
  aux pièces ;
- **les Typologies** — elles lisent la cote de chaque poste pour la largeur de ses pièces. Leur
  éditeur (`typoRegle(key, w)`) en garde une à elles (`typo/etat.js`), qui ne remonte JAMAIS ici :
  sans quoi un réglage au plan recomposait la volumétrie (`docs/typologies.md`).

**Les murs** (levier « Part des murs », `V.partMurs`, 10 % estimés : murs extérieurs de 40 cm et
cloisons de 10 cm, surface de construction SIA 416). Le plateau du mixer est BRUT : pièces,
circulation et murs (`flBrut()` = `flBuilt()` + `flMurs()`). `usable()`, `pilesAdmissibles()`,
`ajusterPlateaux()` et le contrôle du plateau le lisent ; le Massing, qui dessine ses murs autour
des volumes, reçoit `flInterieur()` : `flBuilt()` plus les cloisons entre pièces (levier « Part des
cloisons », `V.partCloisons`, 6 % de l'intérieur — `avecCloisons()`, lu aussi par `mass/model.js —
aPaver()`). Les murs extérieurs ne sont pas comptés deux fois, les cloisons ne sont pas oubliées.
