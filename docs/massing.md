# L'onglet Massing

Poser le programme sur le terrain.

```
src/data/site.js      le relevé, engendré du fichier Rhino    ← source unique
src/mass/geom.js      terrain interpolé, rectangles tournés, distances, alignements
src/mass/model.js     l'état, les niveaux RELUS du mixer, le bilan de surface
src/mass/gen.js       le générateur : générer → vérifier → noter → classer
src/mass/mesures.js   ce qu'on lit sur une volumétrie : écarts au cadre, qualités, mesures
src/mass/partis.js    les douze partis : figure exacte, programme, cohérence du parti
src/mass/checks.js    alertes info / à vérifier / erreur, avec code et remèdes
src/mass/fix.js       les remèdes : recaler, écarter, reformer, rééquilibrer
src/mass/etat.js      ce qui s'enregistre (lu par `mix/store.js`)
src/mass/archi.js     l'architecture d'un volume : toit, lanterneaux, entrée, rampe, sous-passage
src/mass/export.js    le fichier .obj pour Rhino — une fonction pure, qui rend du texte
src/views/massing.js  le rail de commandes, le plan et la 3D côte à côte
src/views/plan.js     le plan : relevé, volumes, sélection, déplacement, rotation, étirement
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

Deux seeds distinctes — celle du mixer dans `core/rand.js`, celle du massing dans
`MASS.graine`. Les confondre ferait qu'on ne peut plus changer l'une sans perdre l'autre.

**La seed du massing se lit et se retape.** Elle s'affiche sous « Shuffle massing », libellée
« Seed » — dans le code elle reste `MASS.graine` —, dans le champ du mixer à l'identique : base
36, retapée puis Entrée, et la même volumétrie revient, pourvu que le programme et le parti
soient les mêmes. « Shuffle massing » parcourt d'abord le classement que la seed a produit —
la seed ne change pas, le rang s'affiche —, puis en tire une nouvelle au bout. Le bouton et
le champ passent par un seul chemin, `rejouerMassing()` : une seed retapée ne peut pas rendre
autre chose que ce que le tirage avait montré. Une seed illisible ou nulle remet la valeur
courante sans rien tirer. Elle est enregistrée avec le reste (`mass/etat.js`) : après un
rechargement, la seed affichée est celle de la volumétrie relue.

## Le cadre élimine, l'orientation retient, le jugement classe

Le massing ne juge plus : il MESURE (`mesures.js`), et trois moteurs lisent ces mesures — voir
`docs/parametres.md`.

| lecture | fonction | ce qu'elle rend | qui s'en sert |
|---|---|---|---|
| le **cadre** | `ecarts()` | ce que la variante enfreint, avec les mots du contrôle, rouge pour l'opposable, ambre pour notre choix | le générateur jette ; le contrôle notifie |
| l'**orientation** | `qualites()` | pour chaque ligne, une qualité de −1 à +1 et un état | le générateur retient (`retenir()`) |
| les **mesures** | `mesuresMass()` | des nombres bruts, sans seuil | le jugement (`data/jugement.js`) |

Le cadre du massing : le périmètre (opposable) et notre **recul** de 5 m (choisi) à tous les
étages, passerelles comprises · la **distance incendie** `RULES.dist.entre`, 5 m (art. 2.3 →
AEAI 15-15), entre bâtiments et jusqu'à l'existant · rien sur l'existant · la salle de sport
28 × 32 m, rien au-dessus · l'abri PC au moins partiellement enterré · chaque niveau loge sa
surface · la cour du programme, et notre cour utile de 620 m² · les classes en façade
(`profFacade()`, deux salles et leur couloir : 19,5 m) · le module de 0,50 m. Chaque ligne a
son tag ; celles de notre choix se désactivent ou s'assouplissent en orientation.

L'orientation du massing : dimensions dans les domaines, distance souhaitée, soleil, vue, jour
entre corps, compacité, cour généreuse (Prioritaires) ; alignement, terrassement, élancement,
connexions, nappe, terrain libre (Souhaitées). Une ligne passée en Imposé jette la variante où
elle se lit défavorable.

**Les dimensions sont des domaines de leviers.** Largeur et profondeur min/max
(`V.largeurMin/Max`, `profMin/Max`, cotes extérieures, murs compris) sont les domaines où le
générateur tire ses cotes ; la distance souhaitée (`V.distVoulue`) est une orientation — les
figures s'écartent de `max(distance incendie, distance souhaitée)`, `besoins()` découpe selon
la largeur max. Seule la distance incendie bloque.

Ont disparu : les deux bacs (`data/jugements.js`, `views/juges.js`), le score calculé sur les
mêmes rangs qui orientaient la recherche, « Respect du parti » (il lisait la signature du
générateur : c'est désormais le sens du levier « parti »), et, avant eux, les poids (`*Poids`),
l'éparpillement, le maximum de cour, l'adresse du corps principal et sa « bande de 30 m », la
« marge sans pénalité » du terrassement, la force d'alignement, la profondeur de départ de 18,5 m.

## Générer, valider, comparer, choisir

L'ordre est imposé : **1. les leviers — le parti, le programme · 2. le cadre · 3. l'orientation · 4. le jugement.**

1. **Le parti construit la figure** (`partis.js — composer()`). Chaque parti a ses directives :
   un bloc compact est fait de deux rangs de volumes accolés ; une barre, d'une seule file ; des
   barres parallèles, de deux à quatre files séparées d'un vide ; un L, de deux ailes qui se
   rencontrent à une extrémité ; un U, d'une base et de deux ailes du même côté ; une cour, de
   trois côtés accolés et d'un quatrième bâtiment qui la ferme à distance ; des pavillons, de
   volumes tous séparés ; un hameau, de groupes aux orientations différentes autour d'une place ;
   des terrasses, de rangs qui suivent les courbes, le plus haut en amont, les étages retirés vers
   l'amont ; un peigne, d'un dos et de branches du même côté ; la composition libre, de groupes
   libres mais tenus. La diversité est dans le parti : longueur et asymétrie des ailes, nombre de
   volumes, hauteurs, écarts, profondeur, angle.
2. **Le programme** (`programme()`) donne à chaque volume ses étages et son emprise pour que
   chaque niveau reçoive exactement sa surface : un volume est une extrusion.
3. **La cohérence du parti** (`signature()`) est vérifiée sur la figure : un U doit avoir une
   base et deux ailes qui tiennent un vide d'au moins la distance, une cour un vide au moins égal
   à la cour minimale, des pavillons aucun contact… Une figure qui ne ressemble pas à son parti
   est jetée. Puis la figure est posée **d'un bloc** (`implanter()`) — position et angle, rien
   d'autre : aucune poussée corps par corps ne vient la déformer (`intact()` le vérifie). Viennent
   la salle de sport, le sous-sol et, parfois, des passerelles.
4. **Le cadre, tout entier** (`ecarts()`) décide si la variante entre dans les résultats.
5. **L'orientation retient** (`retenir()`) : la préférence de chaque variante valide, mêlée à la
   part du hasard (`V.hasardMass`) ; en Auto, chaque parti essaie `V.essaisParti` fois et l'on
   garde la mieux placée de chaque parti ; un parti imposé garde ses huit mieux placées. Quand un
   parti imposé n'a presque rien rendu, le générateur persévère jusqu'à dix fois le budget.
6. **La dernière garde, puis le jugement classe.** Les ouvrages du second temps sont posés et tout
   le cadre revérifié : s'ils le font enfreindre, ils ne sont pas posés ; si la variante ne tient
   plus, elle est abandonnée. Ce qui reste est classé par la note du jury, bâtiment entier.
   `genMass()` rend la première (`vols.props`, `vols.rang`, `vols.score` — la note,
   `vols.pref` — l'orientation) ; « Shuffle massing » passe à la suivante, et ne rejoue un
   tirage qu'au bout de la liste. La note est affichée sous les boutons : « 62/100 au jugement ·
   dans le cadre · proposition 1 sur 8 ».

Avec ce programme, la Barre ne tient presque jamais : une seule file de volumes d'au plus 28 m
fait 130 m. Les pavillons, six à neuf bâtiments à la distance souhaitée les uns des autres, tiennent
difficilement. Quand rien ne tient, rien n'est proposé.

## Murs, dalles, module

`e.w × e.d` est la surface UTILE ; le mur extérieur de 50 cm (`RULES.haut.mur`) s'ajoute
autour. `volRect()` rend l'emprise murs compris — c'est elle que mesurent le périmètre, les
distances et la cour —, `volInt()` l'intérieur où l'on pave le programme, `mursDe()` le poché
du plan et de la 3D. La dalle de 40 cm (`RULES.haut.dalle`) s'ajoute à la hauteur libre. Toutes
les cotes de corps passent par `auModule()` (0,50 m).

## Chaque volume a son nombre d'étages

Le parti propose une silhouette, et une fois sur deux les corps secondaires tirent leur nombre
d'étages entre un et le maximum. `monter()` partage alors les surfaces DU HAUT VERS LE BAS : le
dernier niveau entre ceux qui y montent, au prorata de leur poids ; à chaque niveau inférieur,
un corps reprend ce qu'il porte au-dessus, puis sa part du reste. Un corps haut a donc une
emprise plus grande, un corps bas prend le reste du rez, et tout mélange de hauteurs se loge
d'aplomb. Seule exigence : ceux qui montent jusqu'à un niveau pèsent au moins 1,3 fois la part
que ce niveau représente du rez — sans quoi un seul corps haut porterait tous les étages. Quand
aucune variante ainsi tirée ne tient, le générateur rejoue avec tous les corps à pleine hauteur.
Ici les 1ᵉʳ et 2ᵉ étages ont presque la même surface : on obtient surtout des R+2 à côté de rez
seuls, plus rarement des R+1.

## Les dimensions : un domaine, pas une limite

Aucune cote de volume n'est du cadre — seule la salle de sport double reste fixée à 28 × 32 m
par le règlement. Les domaines des leviers (11–28 m par défaut) règlent `besoins()` et
`profBornes()`, et l'orientation « des corps dans leurs fourchettes » les relit.
Aucune forme de repli n'est appliquée : ni décrochement, ni fusion, ni règle de porte-à-faux.

Avec les réglages par défaut, un corps d'école vise au plus 28 × 19,5 m (les classes en façade), soit environ
550 m² par étage, et le rez en demande quatre fois plus. `genMass()` calcule donc le nombre de
corps nécessaire (`nMin`) et chaque parti en pose au moins autant — en rangs pour les barres
et les terrasses, le long de chaque aile pour le L, le U et la cour. Le sous-sol se répartit
sous plusieurs corps, et la piscine et le local CAD ne se réunissent que si l'ouvrage commun
reste sous la cote. Bloc compact et Barre, qui n'ont qu'un corps, ne tiennent plus ce programme.

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
admissible — mêmes limites, même recul, même distance incendie. Les faire concourir avec les corps d'école
doublait le coût d'un tirage et écartait des figures d'école valables pour loger une piscine qu'on
ne bâtira pas avant dix ans. Quand aucune place ne tient, l'ouvrage **n'est pas posé** et le
contrôle le dit, avec les gestes qui le résoudraient : mieux vaut l'absence que le mensonge.

Ils sont hors de tout ce qui mesure l'ÉCOLE : le bilan de surface, la compacité, la cour tenue,
l'adresse, la part de classes et le jour entre corps les ignorent — exiger seize mètres entre une
piscine basse et un corps de classes était une alerte que rien ne pouvait corriger. Ils ne sont hors
de rien de ce qui tient au TERRAIN : périmètre, recul, distance incendie, existant, pente.

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
  les cotes. L'alerte porte alors une `note` qui le dit.
- « Laisser comme ça » n'efface rien. Les codes sont ceux du mixer, préfixés **`m:`** — « je laisse
  comme ça » est une seule décision de projet et n'a pas à s'enregistrer à deux endroits, mais un
  code de niveau et un code de volume ne doivent jamais se rencontrer, et chaque onglet ne reprend
  que les siens.

## Le plan et la 3D sont le même modèle

Le plan est en mètres sur le relevé : courbes de niveau, parcelles, routes, murets, bâtiments
existants, périmètre. On y zoome, on s'y déplace, on sélectionne un volume en cliquant, on le déplace
en le tirant, on le tourne par sa poignée, on l'ÉTIRE par les tirettes au milieu de ses côtés — et
la 3D suit à l'instant. Étirer se fait À SURFACE CONSTANTE (`model.js — etirer`) : le côté tiré
avance, l'opposé reste, l'autre dimension s'ajuste pour que chaque étage garde ses m². Les DEUX
cotes tombent sur le module de 0,50 m (on choisit, autour de la cote visée, celle qui garde la
surface la plus juste — quelques m² d'écart au plus, que le bilan montre) ; aucun côté sous 6 m ;
un étage en gradin reste en gradin. Les tirettes et la poignée se dessinent par-dessus tout. Le geste n'est pas bloqué par les règles dures : le contrôle les
signale en rouge. Déplacer et tourner ne tiennent que le PÉRIMÈTRE (`gen.js — dansPerimetre`) et une règle :
RIEN NE SE SUPERPOSE (`chevauche`) — la main avance jusqu'au voisin, pas au-delà ; la distance
aux autres bâtiments et à l'existant ne la bloque pas, le contrôle la signale. CE QUI SE TOUCHE NE
FAIT QU'UN (`fusionner`) : bout à bout, même angle, mêmes niveaux, même profondeur, deux corps
deviennent un volume ; autrement, un même bâtiment (`bat`, `joint`). La règle joue en fin de geste,
après un tirage et après les cotes des Typologies. Pas de tirettes sur la salle de sport, dont les cotes sont imposées. La 3D montre le terrain MAILLÉ
depuis `SITE.grid`, les courbes drapées, les bâtiments existants à leur vraie hauteur, et les volumes
du projet. Le fichier Rhino n'a pas de calque d'arbres : il n'y en a donc pas au dessin.

Dans la 3D, **le modèle suit la main** : tirer vers la gauche le fait tourner vers la gauche,
tirer vers le haut relève son côté proche. La composante horizontale était inversée — la
caméra suivait le curseur, et le projet tournait à rebours du geste.

**Les étages montrés sont une PLAGE** (`MASS.etages`, `plageVue()` / `vu()` dans `model.js`),
réglée par un curseur à deux poignées sous « Affichage », un cran par étage. Toute la plage,
c'est tout le bâtiment ; deux poignées sur le même cran, un seul étage. Le plan pave le plus
bas des étages montrés (hors sous-sol) et trace les autres en trait fin ; la 3D ne pose que
ceux-là. Le curseur est fait main : deux `<input type="range">` superposés laissaient l'input
du dessus prendre tout quand les poignées se rejoignaient, et l'on ne pouvait plus rouvrir la
plage vers le bas. Un enregistrement d'avant, qui portait `etage` (un niveau ou −1), se relit
en plage.

L'altitude de chaque étage se lit à un seul endroit, `etagesDe()` (et `pontEtage()` pour une
passerelle) : le rez sur l'assise, les étages au-dessus, les sous-sols dessous, un ouvrage du
second temps à sa propre hauteur. La 3D et l'export la lisent tous deux.

## L'architecture d'un volume

Le rail du volume choisi a un bloc **Architecture** : toiture (plat, végétalisé, un pan, deux pans,
sheds), puits de lumière (lanterneaux au faîte), entrée (un auvent sur une façade), rampe (le long
d'une façade, à 6 %), sous-passage (au rez, de part en part), jeu de niveaux (les étages au-dessus
du rez glissent tour à tour de ±j, dans la parcelle). Porte-à-faux, étages et passerelles se règlent
déjà ailleurs. Les choix vivent dans `v.ar` (enregistré par `etat.js`), la géométrie dans
`mass/archi.js — archiDe()`, une fois pour le plan, la 3D et l'export (groupe `Architecture`). Les
cotes de dessin sont des hypothèses : `RULES.archi`. Aucun élément ne touche une surface ; le
sous-passage coupe le rez sans que le bilan le décompte — le rail le dit.

Ces choix sont aussi des **leviers** de la composition (`lev-toit`, `lev-pf`, `lev-jeu`,
`lev-puits`, `lev-entree`, `lev-rampe`, `lev-sous`, dans `leviers.js`, état dans `MASS.lev`). Libre,
le dé tire UNE valeur pour toute la composition, à la graine du massing ; `architecturer()` la pose
sur chaque corps d'école — la salle garde ses sheds, le second temps reste plat. Porte-à-faux (3 m,
dernier étage, vers l'entrée) et jeu de niveaux (1,5 m) ne sont pris que si le corps reste dans la
parcelle et ne recouvre personne. Toute volumétrie — tirage, proposition suivante, remède,
Typologies — passe par `gen.js — poser()` : poser, dégager, fusionner, architecturer.

L'orientation **socle** (`orientation.js`, valeur `socleMin`, 80 % par défaut) veut qu'un étage ne
soit pas plus petit que celui du dessus : `mesures.js — qualites()` compare chaque niveau au suivant.

## L'export vers Rhino

« Exporter pour Rhino (.obj) », en fin de rail, télécharge `saxon-massing-<seed>.obj`.
`mass/export.js` écrit le texte, la vue ne fait que le donner.

- **Le repère est celui de `DOC/site_plan.3dm`**, en centimètres, Z vers le haut à l'altitude
  absolue : le fichier s'y pose en place, sans rien déplacer. L'origine vient de `RHINO`, que le
  script du relevé écrit dans `site.js`. Ce repère a l'allure du LV95 sans en être — voir
  `docs/releve.md` ; pour se superposer au relevé, c'est pourtant lui qu'il faut.
- **Un groupe OBJ par calque** : `Niveau_Sous-sol`, `Niveau_Rez`, `Niveau_1er_etage`… — chaque
  étage de chaque volume en maillage fermé, huit sommets, six faces, normales vers l'extérieur,
  de plancher à plancher, murs compris ; les passerelles vont au niveau qu'elles desservent.
  `Second_temps` porte la piscine et le local CAD, `Perimetre` et `Recul_5m` les deux limites.
  Les objets portent le nom du plan : le V3 qu'on lit au plan est le `V3_Rez` du fichier.
- **Le recul est celui que le contrôle mesure.** Aucun module ne le traçait : la règle est une
  distance, `bordDist()` ≥ 5 m. `ligneRecul()` (`geom.js`) en fait une ligne sans refaire le
  calcul autrement — les côtés poussés vers l'intérieur, un arc à chaque angle rentrant, et
  `bordDist()` qui décide des morceaux à garder. Ses sommets sont à 5 m du bord à 10⁻¹⁴ m près,
  et l'aire qu'elle enclôt, 10'534 m², est celle que la règle donne point par point.
- **Les deux lignes sont drapées** sur le terrain, un sommet au moins tous les deux mètres : le
  fichier Rhino n'a pas de surface de terrain, rien que des courbes, et y draper une ligne est
  long quand la remettre à plat est une commande (`ProjectToCPlane`).
- Ni l'acrotère, ni le jour de 12 cm que la 3D laisse entre deux étages, ni le programme à
  l'intérieur des volumes. Tout le fichier est en ASCII : un nom de calque accentué arrive
  mutilé selon la version de Rhino.

À l'import : **ne pas cocher** « Map OBJ Y to Rhino Z » — Z monte déjà dans le fichier —, et
**cocher** « Import OBJ groups as layers ». La ligne sous le bouton le dit.

L'état du massing — volumes, positions, rotations, parti, réglages — est persisté avec le reste
(`mass/etat.js`, clé `saxon-mix-v1`) : aller au mixer et revenir ne défait pas une implantation qu'on
vient de composer.

Le massing n'essaie pas de finir un projet. Il répond à une question de début d'étude : à quoi ce
programme ressemblerait-il, physiquement, sur ce site ?
