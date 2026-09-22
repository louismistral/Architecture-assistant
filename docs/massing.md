# L'onglet Massing

Poser le programme sur le terrain.

```
src/data/site.js      le relevé, engendré du fichier Rhino    ← source unique
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

## Le massing ne redit rien du programme : il le LIT

`niveaux()` relit `FLOORS` à chaque appel — jamais de copie, jamais de cache. Mais un volume
désigne ses niveaux par leur INDICE : quand le mixer ajoute, retire ou renumérote un niveau,
ces indices ne veulent plus rien dire. `empreintePile()` en garde la forme, et le massing se
régénère quand elle a changé.

> Rien ne le voyait : on ne régénérait que si AUCUN volume n'était posé, si bien qu'après un
> « Shuffle » au mixer on revenait sur une implantation qui répondait à la pile PRÉCÉDENTE,
> et la note comme le bilan portaient sur un programme qui n'existait plus.

On ne compare que la FORME de la pile, pas les surfaces : un poste déplacé d'un étage à
l'autre change les aires, et `bilan()` le dit déjà — défaire une implantation composée à la
main pour un poste déplacé serait pire que le mal. Déplacer un volume ici ne touche pas au
programme, parce que ce n'est pas la même question. Couleurs, noms, surfaces, familles et
niveaux sont les mêmes objets, lus au même endroit.

**Un VOLUME est un rectangle tourné qui porte une pile de niveaux**, désignés par leur indice
dans `FLOORS`. Deux volumes qui portent le niveau 1 se partagent sa surface bâtie, et la somme
de leurs emprises vaut cette surface : c'est l'invariant du massing, et `bilan()` le vérifie
après un tirage comme après une modification à la main. Chaque niveau d'un volume porte ses
propres cotes et son propre décalage — c'est ce qui donne les retraits, les terrasses et les
porte-à-faux sans ajouter le moindre réglage.

**Un volume n'est pas une boîte : c'est du programme extrudé.** `cellules()` pave le rectangle
d'un niveau avec les postes qui s'y trouvent, au prorata de la part que ce corps en porte — le
même pavage squarifié que le mixer, la même règle « un bloc vaut sa surface », les mêmes
couleurs de famille. En « couleurs programme » on lit donc OÙ sont les classes ; en
« monochrome », la forme seule — en BLANC de maquette dans la 3D (`--site-mono`), où la masse
se lit à l'ombre et à l'arête et où une teinte, même délavée, laisse chercher ce qu'elle
voudrait dire.

## Deux tirages, et ils ne se confondent jamais

- **Shuffle programme** — celui du mixer, appelé d'ici : il rebat la répartition dans les
  étages, et la volumétrie s'y adapte. Il obéit à l'interrupteur « Shuffle niveaux » du mixer,
  qui se règle au mixer et nulle part ailleurs — le doubler dans le rail du massing mettait
  deux boutons pour un seul réglage.
- **Shuffle massing** — il ne touche PAS au programme. Mêmes postes, mêmes surfaces, mêmes
  niveaux, même répartition ; seule la solution architecturale change : nombre de corps,
  position, orientation, proportions, forme, hauteurs, retraits, terrasses.

Deux graines distinctes — celle du mixer dans `core/rand.js`, celle du massing dans
`MASS.graine`. Les confondre ferait qu'on ne peut plus changer l'une sans perdre l'autre.

## La note : un critère porte un nom, ou il n'existe pas

`noterDetail()` rend le DÉTAIL — un critère, son nom, ce qu'il a coûté ou rapporté —, et
`noter()` n'en est que la somme. Le volet « Contraintes » l'affiche pour la composition à
l'écran : c'est la réponse à « pourquoi obtient-on ce résultat ».

Quatre critères manquaient, et ils manquaient beaucoup :

- **le jour entre les corps.** Les 6 m de l'AEAI sont une distance d'INCENDIE : deux barres de
  quatre niveaux à six mètres l'une de l'autre sont conformes et inhabitables. L'écart utile
  se mesure à la HAUTEUR du plus haut (`DOC.ombreK`, 1,10). Il ne vaut qu'entre façades qui SE
  FONT FACE — `visAVis()` mesure la longueur en regard, faute de quoi deux corps en quinconce,
  à six mètres par leurs angles, déclenchaient une alerte que rien ne pouvait corriger. Et
  `reparer()` VISE cet écart, pas seulement celui de l'AEAI : sans cela la réparation ramenait
  tout à 6,35 m puis la note pénalisait ces mêmes 6,35 m — les deux se battaient, et la
  réparation gagnait toujours, parce que c'est elle qui fixe les positions ;
- **le programme.** La note ne connaissait que des rectangles : une salle de classe pouvait
  atterrir au nord, au cœur d'un bloc de 46 m de profondeur, sans qu'un point soit compté. Les
  critères « profondeur » et « sud » lisent la PART DE CLASSES de chaque corps (`postesDe()`,
  donc le mixer) — un corps de technique a le droit d'être épais ;
- **la cour.** 500 m² de cour et 120 m² de préau : un vide QUALIFIÉ, tenu par les bâtiments.
  Rien ne le composait — c'était une ligne de bilan, hors enveloppe. Le critère mesure le vide
  que la figure ENFERME, l'aire de son enveloppe convexe moins les emprises (`enveloppe()`
  dans `geom.js`) ;
- **l'adresse.** Le plus GRAND corps doit se tenir dans une bande d'approche d'une voie. « Au
  moins un corps près d'une rue » était vrai de toute composition, le site étant bordé de rues
  sur trois côtés ; et le calque des routes du relevé est filtré aux polylignes de plus de
  soixante mètres — sans quoi un bord de place comptait pour une rue.

Deux critères ont été corrigés : l'**orientation** pesait 10 contre 26 pour l'alignement, si
bien que l'outil rangeait les bâtiments sur des lignes plutôt que de les tourner au soleil —
elle pèse 34 et se pondère par la longueur de façade, le nombre d'étages et la part de
classes ; la **compacité** sommait les emprises, quantité quasi constante d'une composition à
l'autre qui ne départageait rien — elle se mesure en façade développée par mètre carré bâti,
ce que le règlement nomme (art. 2.9, Minergie).

## La salle de sport s'implante EN PREMIER

C'est l'objet le plus contraignant du programme : 896 m² qui ne montent pas, deux cotes
données, sept mètres libres sous structure. Elle était posée EN DERNIER et au hasard, puis
réparée — donc elle SUBISSAIT la composition au lieu de la fonder. `ancrer()` lui cherche la
place la plus BASSE du terrain qui soit admissible, et `reparer()` la fait céder trois fois
moins que les autres : ce sont les autres corps qui lui font de la place.

Les sous-sols ne vont PAS sous elle — sept mètres de hauteur libre plus trois mètres de
couverture font une fouille qu'aucun projet ne creuse sous une dalle de 28 × 32 m — et ils se
replacent APRÈS le repêchage, qui déplace les corps : sans cela une composition repêchée
annonçait un manque de couverture que le générateur n'avait plus moyen de voir.

**Les sous-sols vont sous le corps le plus HAUT du site**, pas le plus grand : la nappe est à
462,25 m et le règlement veut 3,00 m de couverture, qu'on ne trouve qu'au tiers est.

## Ce n'est pas un tirage

Un tirage pur pose des boîtes au hasard et laisse l'architecte trier. `genMass()` compose,
mesure et jette : il lit le programme niveau par niveau, lit le site, compose une figure selon
le parti, la RÉPARE — tant qu'un corps sort du périmètre, touche un voisin ou percute
l'existant, on le ramène —, la NOTE, et recommence trente fois. Les alignements sont des
PRÉFÉRENCES notées, jamais des règles : axe du périmètre, perpendiculaire, longues limites de
parcelle, routes, nord-sud. Un corps peut prendre n'importe quel angle ; il gagne seulement à
se ranger.

Douze partis, chacun composant vraiment différemment : auto, bloc compact, barre, barres
parallèles, L, U, cour, pavillons, hameau, terrasses, peigne, composition libre. « Auto » les
essaie tous et garde celui qui tient le mieux sur ce site avec ce programme.

**La salle de sport double fait un corps à elle** : le règlement lui donne ses deux cotes,
28 × 32 m, et 7,00 m libres ; sa surface sort du partage avant qu'il commence, sinon le prorata
l'aurait coupée en deux. Les postes `hors` — piscine, chauffage à distance, cour — ne sont pas
des volumes : le règlement les veut indépendants et au second temps.

**On reconnaît avant de chercher.** En « Auto », les onze partis se relayaient à tour de rôle
sur trente essais — deux ou trois tirages chacun, donc un bon parti éliminé par malchance et un
mauvais retenu par chance. Chacun reçoit maintenant `DOC.essaisParti` essais de reconnaissance ;
les `DOC.finalistes` meilleurs sont retenus, et les `DOC.essais` essais suivants se concentrent
sur eux.

## L'implantation est une RÈGLE ; le reste s'avertit

Un bâtiment ne sort pas du périmètre du concours. `admissible()` dans `gen.js` en est le seul
juge, et les deux chemins y passent : le générateur ne rend que des compositions qui tiennent,
et le glisser à la souris refuse la position qui n'en est pas une — il essaie alors chaque axe
séparément, si bien que le corps LONGE la limite au lieu de s'y arrêter net. Trois conditions,
et elles tiennent ensemble : tous les étages dedans avec le recul de 5 m — tous, car un
porte-à-faux qui franchit la limite est du bâti hors parcelle —, 6 m entre bâtiments (AEAI),
rien sur l'existant ni à moins de 6 m de lui.

Quand une figure ne tient pas, elle est REPRISE, pas avertie. On ne peut pas raccourcir la
surface, elle est au règlement : le générateur rejoue sa recherche avec des corps de plus en
plus profonds — 18, 24, 32, 43, 46 m —, et REPÊCHE les corps restés dehors en balayant la
parcelle pour la position admissible la plus proche, quart de tour compris. Quand rien ne tient
malgré les douze partis, de un à sept corps et jusqu'à 46 m, ce n'est plus une implantation à
corriger : le niveau demande plus d'emprise que la parcelle n'en offre, la composition est
marquée `impossible`, et le contrôle dit d'aller ajouter un étage AU MIXER. Un seuil de surface
ne l'aurait pas dit : la parcelle a la forme d'un L, et l'aire disponible (10'528 m², recul
déduit) n'est pas l'aire posable en rectangles séparés de six mètres.

Tout le reste s'avertit et ne se refuse pas, en trois niveaux : **erreur** pour une règle écrite
(règlement, AEAI) ou une géométrie impossible ; **à vérifier** pour une règle de projet ou une
marge qui se discute ; **info** pour ce qu'il faut savoir sans corriger. Le bilan de surface est
donné niveau par niveau — demandé, posé, écart —, parce que c'est la question à laquelle l'outil
doit répondre à tout moment.

## Le porte-à-faux est permis, mais il n'est pas la règle

Un étage peut déborder de celui du dessous. Il ne franchit aucune règle écrite et n'attend
aucune correction : le contrôle le classe donc en **info** et le chiffre au centimètre. La 3D
lui laisse l'ARÊTE D'AVERTISSEMENT — c'est la seule chose qui le fasse trouver d'un coup d'œil,
et un débord qu'on ne lit que dans une liste n'est pas un débord qu'on corrige. Le volume choisi
porte un champ « porte-à-faux du dernier étage » pour en faire un à la main. Il ne fait pas
sortir de la parcelle : le débord est permis, le hors-parcelle non.

Le générateur PRÉFÈRE L'APLOMB : `noter()` fait payer chaque mètre de débord, si bien qu'entre
deux compositions qui logent le même programme, celle qui tient d'aplomb gagne. Auparavant les
douze partis en portaient tous, sur tous les tirages — de quatre à dix-huit mètres —, et une
alerte qu'on voit partout ne se lit plus nulle part.

Deux causes, et deux réponses différentes :

- **L'artefact.** Les parts se partageaient niveau par niveau, indépendamment : un corps portant
  un sixième du rez et un tiers du premier devenait plus large en montant, et l'on lisait jusqu'à
  soixante-dix mètres de débord que personne n'avait demandés. Trois choses l'en empêchent — un
  corps garde sa PROFONDEUR du rez au faîte, donc une aire plus petite donne une largeur plus
  petite ; le partage monte du bas avec un PLAFOND, l'aire du niveau du dessous ; et les corps
  sont PROMUS d'office quand un étage demande plus que ses porteurs ne pèsent en bas.
- **Le débord STRUCTUREL.** La salle de sport prend 896 m² du rez sans monter : les autres corps
  ont donc moins d'emprise au sol qu'à l'étage, et à profondeur constante ils y sont plus larges.
  Aucun partage entre corps n'y change rien — c'est une soustraction. Il n'y a qu'une façon
  honnête de le supprimer : **poser l'étage manquant sur la salle elle-même**. Elle garde ses
  cotes du règlement, l'étage tient dans ses 28 × 32 m et ne déborde de rien, et le programme y
  trouve l'emprise qui lui manquait. `monter()` compose les deux — avec et sans —, la note
  tranche, et le contrôle dit en info pourquoi cet étage est là et que la portée de 28 m est à
  vérifier en structure. C'est aussi pourquoi la CLÉ d'un poste imposé est portée par l'ÉTAGE et
  non par le volume (`filtreDe`) : l'étage du dessus loge du programme ordinaire.

Reste le porte-à-faux voulu : celui qu'on fait à la main, et celui que le programme impose quand
la salle de sport ne peut pas absorber le surplus. Ceux-là sont vrais, ils s'affichent, et ils se
discutent.

## La profondeur se CHOISIT ; son plafond est donné

Elle a été un champ à saisir, 18 m par défaut — un chiffre de projet sans source, qu'on pouvait
mettre à 9 ou à 46 sans que rien ne le contredise —, puis une valeur figée, qui ne laissait plus
rien essayer alors que la profondeur est le premier choix d'un projet d'école. C'est aujourd'hui
**un curseur borné**, et les deux bornes viennent d'ailleurs que de nous (`mass/model.js`) :

- le **PACom de Saxon** range le site en zone de constructions et d'installations publiques A —
  aucune contrainte de gabarit, de hauteur ni de distance aux limites (art. 2.3). Il n'impose donc
  AUCUNE profondeur, et il faut le dire plutôt qu'inventer ;
- le **programme** donne le PLAFOND : `profMax()`, la petite cote du local le plus profond à loger
  — la salle de sport double, 28 m. **Aucun volume ne le franchit**, ni le générateur ni la main :
  l'épaississement de la recherche s'y arrête, quitte à rendre la composition impossible et à
  renvoyer au mixer, et la poignée de redimensionnement y est bornée. Au-delà, on bâtirait de la
  profondeur que personne n'a demandée, et sans jour ;
- le **programme** donne aussi le point de départ : `profUsuel()`, deux rangées de salles de classe
  prises à leur surface BÂTIE — le couloir est dans la part de circulation, il ne s'ajoute pas
  par-dessus —, arrondi au demi-mètre comme toutes les cotes du projet, soit 18,5 m. Le plancher du
  curseur est la largeur d'une classe et de son couloir.

Quatre curseurs ont disparu en chemin — force d'alignement, compacité, régularité, intensité des
terrasses. Ils réglaient ce que le PARTI dit déjà (un peigne est fragmenté, un bloc compact l'est
par définition), et personne ne savait quoi répondre à « compacité 0,35 ». Ce sont des constantes
de composition, écrites là où elles agissent (`JEU` et `GRAD` dans `gen.js`, `DOC.alignForce` et
`DOC.alignPoids` dans la doctrine — ce que le générateur TOURNE un corps vers son attracteur et ce
que la note lui RAPPORTE sont deux choses, et un seul nombre faisait les deux) ; la compacité, dont
la valeur neutre ne changeait rien, a été remplacée par une vraie mesure de façade développée. Il
reste quatre réglages au rail : le nombre de VOLUMES — le rail dit volume, comme le reste de
l'interface, là où le générateur dit corps —, la distance entre eux, la profondeur, et
l'orientation générale.

## Le second temps occupe du terrain, donc il se dessine

La piscine (500 m²) et le local de chauffage à distance (400 m²) sont des ouvrages indépendants des
bâtiments scolaires et réalisés plus tard (art. 2.2) : ils ne pèsent sur aucun plateau, ne comptent
dans aucun niveau du bilan, et le plan de situation les veut en pointillé. On n'en dessinait donc
rien — et l'implantation promettait 900 m² de terrain qu'elle n'avait pas, soit le quart d'un rez
d'école, que la cour et le stationnement croyaient disponibles.

Ce sont des BÂTIMENTS, et `secondTemps()` les reconnaît à ce qui les distingue de la cour : une
**hauteur libre**. Ce qui n'a pas de hauteur n'est pas un volume, et c'est le programme qui le dit
— pas une liste de noms réécrite dans le code. Ils portent donc leur propre hauteur (`e.h`, via
`hauteurEtage()`) : une piscine indépendante ne prend pas les 7,45 m que la salle de sport impose
au rez de l'école.

Trois façons de les prendre, et les trois se défendent — **deux volumes** séparés, lecture
littérale du règlement et défaut ; **un seul** volume commun, la piscine et le chauffage à distance
partageant volontiers leurs machines et leur accès camion ; **aucun**, pour ne regarder que l'école.

Ils se posent **après** que l'école est composée, sur la composition retenue, et prennent les MARGES
du site : `poserSecond()` balaie la parcelle du bord vers le cœur et prend la première position
admissible — mêmes limites, même recul, mêmes six mètres. Les faire concourir avec les corps d'école
doublait le coût d'un tirage et écartait des figures d'école valables pour loger une piscine qu'on
ne bâtira pas avant dix ans. Quand aucune place ne tient, l'ouvrage **n'est pas posé** et le
contrôle le dit, avec les gestes qui le résoudraient : mieux vaut l'absence que le mensonge.

Ils sont hors de tout ce qui mesure l'ÉCOLE : le bilan de surface, la compacité, la cour tenue,
l'adresse, la part de classes et le jour entre corps les ignorent — exiger seize mètres entre une
piscine basse et un corps de classes était une alerte que rien ne pouvait corriger. Ils ne sont hors
de rien de ce qui tient au TERRAIN : périmètre, recul, six mètres, existant, pente.

## Une alerte se clique : le geste, ou l'assumer

Le massing disait, et laissait tout le travail à faire. On lisait « volume 2 sort du périmètre de
7,49 m » et l'on allait le tirer à la souris, au pixel près, jusqu'à ce que le message disparaisse.
C'est exactement l'interaction que le mixer avait depuis le début, et elle est maintenant la même
ici.

- Les remèdes vivent dans `src/mass/fix.js`, à côté de la règle qu'ils réparent. La MÉCANIQUE reste
  dans `gen.js` — recaler, écarter, replacer un sous-sol, reposer les ouvrages du second temps sont
  ce que le générateur sait déjà faire : le contrôle et le générateur doivent réparer de la même
  façon, sans quoi ils se contrediraient à chaque clic.
- Aucun remède ne s'applique tout seul, et **aucun n'en crée un autre** : tout geste qui déplace ou
  redimensionne repasse par `admissible()`, et rend `false` en remettant en place quand il ne tient
  pas. Ce qui change une forme le fait **à surface exacte**.
- Un remède qui n'existe pas n'est pas proposé : on n'élargit pas un corps dont le règlement fixe
  les cotes, et on ne remet pas d'aplomb un porte-à-faux qui vient des surfaces — il faudrait changer
  les mètres carrés, et ils sont au règlement. L'alerte porte alors une `note` qui le dit.
- « Laisser comme ça » n'efface rien. Les codes sont ceux du mixer, préfixés **`m:`** — « je laisse
  comme ça » est une seule décision de projet et n'a pas à s'enregistrer à deux endroits, mais un
  code de niveau et un code de volume ne doivent jamais se rencontrer, et chaque onglet ne reprend
  que les siens.

## Le plan et la 3D sont le même modèle

Le plan est en mètres sur le relevé : courbes de niveau, parcelles, routes, murets, bâtiments
existants, périmètre. On y zoome, on s'y déplace, on sélectionne un volume en cliquant, on le déplace
en le tirant, on le tourne par sa poignée — et la 3D suit à l'instant. La 3D montre le terrain MAILLÉ
depuis `SITE.grid`, les courbes drapées, les bâtiments existants à leur vraie hauteur, et les volumes
du projet. Le fichier Rhino n'a pas de calque d'arbres : il n'y en a donc pas au dessin.

L'état du massing — volumes, positions, rotations, parti, réglages — est persisté avec le reste
(`mass/etat.js`, clé `saxon-mix-v1`) : aller au mixer et revenir ne défait pas une implantation qu'on
vient de composer.

Le massing n'essaie pas de finir un projet. Il répond à une question de début d'étude : à quoi ce
programme ressemblerait-il, physiquement, sur ce site ?
