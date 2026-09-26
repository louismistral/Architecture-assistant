# L'onglet Massing

Poser le programme sur le terrain.

```
src/data/site.js      le relevé, engendré du fichier Rhino    ← source unique
src/mass/geom.js      terrain interpolé, rectangles tournés, distances, alignements
src/mass/model.js     l'état, les niveaux RELUS du mixer, le bilan de surface
src/mass/gen.js       le générateur : générer → valider → comparer → choisir
src/mass/juge.js      le jugement : contraintes dures, priorités fortes, préférences
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

## Trois rangs, et aucun point

Le générateur ne somme plus rien — ni à l'écran, ni en coulisse. `juge.js` juge une variante
en trois temps, et le volet « Contraintes » les affiche tels quels, chaque ligne disant ce
qu'elle pense de la composition à l'écran :

| rang | effet | règles |
|---|---|---|
| **contraintes dures** | une seule enfreinte : la variante est jetée (`dures()`) | périmètre et recul PACom de 5 m à tous les étages, passerelles comprises · 6 m au moins entre bâtiments à tous les étages (on peut en demander plus, on ne vise pas 6) · rien sur l'existant · largeur ≥ 11 m · profondeur entre `profMin` (réglable, 11 m) et 28 m · classes en façade : un corps qui porte des classes n'a pas plus de deux salles de profondeur (`profFacade()`, 18,5 m) · module 0,50 m · cour utile ≥ 620 m² · 3,00 m de terrain au-dessus de la nappe sous tout sous-sol · abri PC au moins partiellement enterré · salle de sport 28 × 32 m, 7 m libres, rien au-dessus |
| **priorités fortes** | on écarte toute variante qu'une autre BAT : au moins aussi bonne partout, meilleure quelque part | orientation solaire, vue vers le terrain de football (nord-ouest, lue dans le relevé), lumière entre bâtiments (1,1 × h, indication), compacité, cour généreuse |
| **préférences** | ne départagent que des variantes ÉGALES sur les priorités fortes | alignement, porte-à-faux, terrassement (terrain réel sous l'emprise), élancement ≤ 9, connexions, accès et stationnement |

Chaque critère rend favorable, neutre ou défavorable — les seuils sont dans `doctrine.js`,
jamais des poids. Les paramètres de recherche (essais, reconnaissance, profondeur de mesure
de la cour, passerelles) sont rangés à part, sous « Paramètres du générateur ».

Ont disparu, de l'interface ET de l'algorithme : les poids (`*Poids`), le coût du sous-sol
hors règle (la nappe est une contrainte dure), l'éparpillement (doublon des 6 m), le maximum
de cour, l'adresse du corps principal et sa « bande de 30 m » (une largeur de bande autour
d'une voie, qui ne servait qu'à ce bonus), la « marge sans pénalité » du terrassement
(1,6 m de dénivelé en deçà duquel le malus valait zéro), la force et le poids d'alignement,
la profondeur de départ de 18,5 m.

## Générer, valider, comparer, choisir

`genMass()` compose une figure par essai — parti, profondeur tirée entre les bornes,
orientation (axe du périmètre, optimum soleil-vue, ou libre ; dans les partis libres chaque
corps choisit la sienne), ailes accolées en un seul bâtiment dans une partie des variantes,
salle de sport posée sur le bas du site puis parfois accolée au corps principal, passerelles
dans une partie des variantes. La figure est RÉPARÉE (`reparer()`, puis `repecher()` si un
corps sort), le sous-sol va sous le corps le plus haut, et `dures()` tranche.

En « Auto », chaque parti a `essaisParti` essais de reconnaissance ; ceux qui rendent une
variante valide reçoivent les `essais` suivants. **La diversité d'abord** : `choisir()` tire
le parti parmi tous ceux qui ont rendu une variante valide, puis applique les priorités AU SEIN
de ce parti. Sans cela le parti le mieux orienté — des barres parallèles — gagnait presque
chaque tirage.

Quand aucune variante ne tient, la moins fautive est rendue marquée `impossible` et le
contrôle liste ses écarts. Avec ce programme, `Bloc compact` et `Barre` le sont souvent : un
seul corps de 18,5 m de profondeur au plus demanderait 130 m de long au rez.

`admissible()` reste le seul juge de l'implantation, et le glisser à la souris y passe : il
refuse une position qui ne tient pas et longe la limite au lieu de s'y arrêter. Le
porte-à-faux est permis — la 3D en marque l'arête, le contrôle l'avertit au-delà de `pafMax` ;
`monter()` partage chaque niveau du bas vers le haut avec un plafond, ce qui évite les débords
d'artefact, et plus rien ne se pose sur la salle de sport.

`checks.js` ne rejuge rien : ses erreurs sont les écarts de `dures()`, avec leurs remèdes ; le
reste (jour, porte-à-faux important, terrassement, élancement, second temps, bilan) s'avertit.

## Murs, dalles, module

`e.w × e.d` est la surface UTILE ; le mur extérieur de 50 cm (`RULES.haut.mur`) s'ajoute
autour. `volRect()` rend l'emprise murs compris — c'est elle que mesurent le périmètre, les
distances et la cour —, `volInt()` l'intérieur où l'on pave le programme, `mursDe()` le poché
du plan et de la 3D. La dalle de 40 cm (`RULES.haut.dalle`) s'ajoute à la hauteur libre. Toutes
les cotes de corps passent par `auModule()` (0,50 m).

## Passerelles et corps accolés

Une passerelle est une CONNEXION `{ a, b, i }` (`MASS.pont`) : sa géométrie se déduit à chaque
lecture des deux façades qui se font face (`pontRect()`), donc un corps déplacé l'emporte avec
lui. `relier()` n'en pose qu'entre ensembles pas encore reliés, la plus courte d'abord, dans le
périmètre et sans traverser un corps. Deux corps accolés portent `joint` : ils font un seul
bâtiment et peuvent se toucher sans se recouvrir — c'est ce qui intègre la salle de sport ou
fait un L d'un seul tenant.

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

Leur séparation n'est pas imposée : **au choix** (défaut) laisse le générateur les réunir ou les
séparer ; **deux volumes**, **un seul** ou **aucun** l'imposent. Ils se posent sans entamer la
cour minimale.

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
