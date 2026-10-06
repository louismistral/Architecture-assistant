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
src/mass/export.js    le fichier .3dm pour Rhino — ce qu'il contient (pur), puis les octets
src/mass/import.js    le chemin inverse : un .3dm relu en volumes, qui se jugent comme les autres
src/views/massing.js  le rail en chaîne, la barre des vues, la carte du volume, le plan et la 3D
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

## Le rail est une chaîne

Le rail suit l'ordre du générateur, et chaque chose de même nature a un seul lieu.

- **Proposer**, en tête et toujours visible : « Shuffle massing » (le geste de l'onglet), les
  flèches qui parcourent le classement dans les deux sens sans rien tirer, le rang et la seed.
- **Les étapes**, chacune repliable, son ÉTAT écrit à droite pour qu'on le lise sans l'ouvrir.
  Elles portent les noms des rubriques de Paramètres & contraintes, lus dans `ROLES`
  (`roleNom()`) : le rail et le volet disent les mêmes mots.
  1 · **Parti** — une tuile par parti, sa figure en plein (`p-*` dans `views/icons.js`) ; en Auto,
  un point marque celui qui a été retenu. 2 · **Évaluation** — la note, écrite ici seulement, et
  les axes : juste après le parti, parce que c'est ce qu'on regarde à chaque tirage.
  3 · **Programme** — « Shuffle programme », qui rebat le programme et vit donc ici, et le bilan
  par niveau ; l'état est l'écart. 4 · **Leviers** — ce que Shuffle massing tire, en deux groupes,
  Composition et Architecture. 5 · **Contraintes** — le contrôle : ce qui est enfreint, avec ses
  gestes ; les infos se replient ; une erreur ouvre l'étape d'elle-même. 6 · **Préférences** —
  chaque ligne, défavorables en tête, et ce qu'elle lit.
- **Emporter**, au pied du rail, n'est pas une étape : deux boutons, exporter et importer le .3dm.
  Le repère se lit au survol ; un message de l'export ou de l'import s'écrit dessous. Le diagramme
  du rendu n'est plus au rail : il est dans l'onglet Rendu.
- Le corps d'une étape ne se construit que si elle est OUVERTE : le rail se refait à chaque geste.
- Le volet **Contraintes** reste à côté : on y règle chaque ligne, sa valeur et son tag. Les étapes
  Leviers, Contraintes, Préférences et Évaluation y renvoient.

Ce qu'on REGARDE se règle dans une barre posée sur les deux vues — Plan, 3D ou Plan + 3D (la vue
seule prend toute la largeur ; une préférence de regard, non enregistrée), couleurs, étages
montrés, recadrage. Le volume CLIQUÉ s'édite dans une carte posée sur le plan, dans le
coin opposé au volume pour ne pas cacher ce qu'elle décrit ; rien de choisi, pas de carte. Les
paragraphes qui restaient affichés en permanence sont devenus des infobulles.

## Le cadre élimine, l'orientation retient, le jugement classe

Le massing ne juge plus : il MESURE (`mesures.js`), et trois moteurs lisent ces mesures — voir
`docs/parametres.md`.

| lecture | fonction | ce qu'elle rend | qui s'en sert |
|---|---|---|---|
| le **cadre** | `ecarts()` | ce que la variante enfreint, avec les mots du contrôle, rouge pour l'opposable, ambre pour notre choix | le générateur jette ; le contrôle notifie |
| l'**orientation** | `qualites()` | pour chaque ligne, une qualité de −1 à +1 et un état | le générateur retient (`retenir()`) |
| les **mesures** | `mesuresMass()` | des nombres bruts, sans seuil | le jugement (`data/jugement.js`) |

Les jugements du site traduits en mesures (`mesures.js — jugesSite()`, une formule du jury chacune) :
`bordurePart` (b9, bande de 20 m), `rapportHauteur` (b11, l'existant à 50 m), `parvis` (b12, le libre
entre une route et une façade, à 135°), `courFermee` (c18, 36 rayons à 40 m), `courAbritee` (c19, la
route à 80 m), `zonesExt` (c22, > 200 m² contre l'école), `profondeursDistinctes` (f51), `porteAFaux`
(f54), `repetitionPart` (f55), `chantierLibre` (i73) et `existantGarde` (h70) — sans objet tant que le
périmètre n'a pas d'existant —, `extensionPossible` (i74, contre `V.extEmprise`), `uniteEtapes` (e47,
le second temps contre l'école), `toitPV` (h69, `V.pvPart` ÷ `V.pvVise`). Le terrain se lit sur une
grille de 2 m, calculée une fois ; les rayons la lisent au lieu de tester chaque emprise.

Ce que le jugement POSE pour se lire (`jugesPoses()`), le temps d'une mesure, dans le terrain libre —
la première place qui tient, dans l'ordre de ce que le critère préfère : `couvertPart` (c21, préau du
programme contre la façade de la cour × `V.avantToit`), `sportExtAxe` (c23, un terrain `V.sportExtL` ×
`V.sportExtW` hors cour, tourné de 5 en 5° depuis le nord-sud ; 90° s'il ne tient pas), `voituresBord`
(c26, 70 × 25 m² aux proportions `V.parcRatio`, hors cour, au plus près d'une route ; 0 s'il ne tient
pas — sur ce site, à seed 1, il ne tient jamais), `accesSepares` (c27, de l'entrée piétons — la façade
la plus proche du parvis — à l'accès véhicules le plus proche, à vol d'oiseau entre points de route),
`velosDist` (c28, 50 × `V.mVelo` contre une façade), `niveauxDifferents` (d36, locaux à 20 %, emprise à
10 %). Un centre moins dégagé que la demi-largeur est écarté d'avance ; la grille est en tables typées.

Le cadre du massing : le périmètre (opposable) et notre **recul** de 5 m (choisi) à tous les
étages, passerelles comprises · la **distance incendie** `RULES.dist.entre`, 5 m (art. 2.3 →
AEAI 15-15), entre bâtiments — une préférence Prioritaire, bloquante seulement Imposée
(`feuVise()`, `feuExige()`) · deux volumes qui se touchent n'en font qu'un · la salle de sport
28 × 32 m, rien au-dessus · l'abri PC au moins partiellement enterré · chaque niveau loge sa
surface · la cour du programme, et notre cour utile de 620 m² · les classes en façade
(`profFacade()`, deux salles de 9 m et leur couloir : 20,5 m) · le module de 0,50 m. Chaque ligne a
son tag ; celles de notre choix se désactivent ou s'assouplissent en orientation.

L'orientation du massing : dimensions dans les domaines, distance souhaitée, soleil, vue, jour
entre corps, compacité, cour généreuse, et l'orientation par l'usage — classes à l'est,
salle de sport au nord, cour au soleil et loin de la rue, une façade libre du rez vers la vue
(Prioritaires, `docs/parametres.md`) ; alignement, terrassement, élancement,
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
   tirage qu'au bout de la liste. La note s'écrit sur l'étape Jugement du rail, le rang
   (« 1 sur 8 ») sous « Shuffle massing ».

Avec ce programme, la Barre ne tient presque jamais : une seule file de volumes d'au plus 28 m
fait 130 m. Les pavillons, six à neuf bâtiments à la distance souhaitée les uns des autres, tiennent
difficilement. Quand rien ne tient, rien n'est proposé.

## Murs, dalles, module

`e.w × e.d` est la surface UTILE ; le mur extérieur de 50 cm (`RULES.haut.mur`) s'ajoute
autour. `volRect()` rend l'emprise murs compris — c'est elle que mesurent le périmètre, les
distances et la cour —, `volInt()` l'intérieur où l'on pave le programme, `mursDe()` le poché
du plan et de la 3D. La dalle de 40 cm (`RULES.haut.dalle`) s'ajoute à la hauteur libre. Toutes
les cotes de corps passent par `auModule()` (0,50 m).

## Chaque volume a ses hauteurs d'étage

La hauteur d'un étage est celle du VOLUME, pas celle du niveau (`model.js — hauteurEtage`). Le
mixer donne au niveau la hauteur de sa plus haute pièce ; le rez prenait donc partout les 7,40 m de
la salle de sport, et un corps de classes posé à côté d'elle montait d'autant. Désormais :
un ouvrage du second temps ou un corps importé porte sa hauteur mesurée (`e.h`) ; un volume aux
postes nommés (`e.keys`, la salle de sport) la leur ; un corps d'école celle de son niveau sans les
postes qui ont leur propre volume — aux cotes imposées ou hors enveloppe (`niveaux()[i].hc`, 3,20 m
au rez). La 3D, l'export, les mesures et le contrôle lisent tous `etagesDe()`. Les seuils de
compacité ont suivi : 0,65 favorable, 0,75 défavorable (0,95 et 1,10 avec un rez à 7,40 m).

**Les niveaux s'alignent** (`orientation.js — nivalign`, Prioritaire) : tous les bâtiments d'école
posent leur rez à la même altitude — la moyenne du terrain sous leurs emprises, pondérée par elles
(`datumEcole()`, `assiseEff()`). C'est plus fort que la mise au terrain (« Peu de terrassement »,
Souhaitée) : le terrain ne décide plus de l'altitude, il se lit dans le terrassement que cette
altitude demande — l'écart entre le plus haut et le plus bas du terrain ET du rez sous une emprise.
Éteinte ou indicative, chaque volume se pose sur le terrain sous son emprise. Le second temps garde
la sienne.

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
Aucune forme de repli n'est appliquée : ni décrochement, ni règle de porte-à-faux.

Avec les réglages par défaut, un corps d'école vise au plus 28 × 19,5 m (les classes en façade), soit environ
550 m² par étage, et le rez en demande quatre fois plus. `genMass()` calcule donc le nombre de
corps nécessaire (`nMin`) et chaque parti en pose au moins autant — en rangs pour les barres
et les terrasses, le long de chaque aile pour le L, le U et la cour. Le sous-sol se répartit
sous plusieurs corps, et la piscine et le local CAD ne se réunissent que si l'ouvrage commun
reste sous la cote. Bloc compact et Barre, qui n'ont qu'un corps, ne tiennent plus ce programme.

## Le volume loge ce que les plans pavent

Le mixer ESTIME la circulation sur le front des pièces ; les Typologies la DESSINENT dans la
section du corps — un couloir sur toute sa longueur, des bandes de pièces, un dégagement devant
la pièce que ses proportions (`RULES.plan.piece`) arrêtent avant le fond de sa bande, des blocs
de petites pièces autour d'un sas. Un massing taillé sur l'estimation laissait en moyenne
730 m² par tirage « Ne tient pas dans le volume ». Chaque niveau demande donc ce que les plans
y pavent, à la profondeur de ses corps (`model.js — aPaver`, `demande`) :

```
pièce pavée = a × b ÷ min(b, √(max(a, colonne) × ratio))      b : la bande
niveau      = (Σ pièces pavées × D ÷ (D − couloir) + cages) × (1 + pavage) + postes aux cotes imposées
```

`b` vaut `(D − couloir) / 2` dès `RULES.plan.deuxRangs` (15 m : une classe de 6 m de bande en
face du noyau et de son palier), `D − couloir` en dessous ; une petite pièce compte dans une
colonne d'au moins `piece.colonne` (10 m²). `pavage` (4 %, hypothèse du groupe, `donnees.js`)
est ce que la formule ne voit pas : un rang finit rarement sur une pièce entière. Le générateur
la calcule à la profondeur qu'il tire ; le bilan, le contrôle `surfaces` et le remède
« rééquilibrer » à la profondeur moyenne des corps posés. Ce n'est pas du programme : c'est de
la circulation, et elle croît quand le corps s'amincit (le couloir pèse 2,4 ÷ D).

Sur 72 tirages (seeds 1–3 du mixer × 12 partis × seeds 11 et 7 du massing) : ce qui ne tient
pas passe de 47'500 à 15'500 m² (65 tirages communs), les pièces hors proportions de 191 à 29
(halls traversants et grands locaux, une question des Typologies), le sol libre de 29'500 à
37'900 m². Ce qui reste au bac est la granularité : une classe de 8 m ne rentre pas dans 5 m.
Un U, une cour, un peigne reçoivent au moins les volumes que leur figure demande (`NMIN`).

## Passerelles et corps accolés

Une passerelle est une CONNEXION `{ a, b, i }` (`MASS.pont`) : sa géométrie se déduit à chaque
lecture des deux façades qui se font face (`pontRect()`), donc un corps déplacé l'emporte avec
lui. `relier()` n'en pose qu'entre ensembles pas encore reliés, la plus courte d'abord, dans le
périmètre et sans traverser un corps. Deux corps accolés portent `joint` : ils font un seul
bâtiment et peuvent se toucher sans se recouvrir — c'est ce qui intègre la salle de sport.

## Le volume n'est pas qu'un rectangle

Ce qui s'approche à moins de `V.fusionDist` (1 m, la ligne `fusion` du cadre) d'un autre bâtiment,
côtés parallèles ou en équerre (à 3° près), se **recolle** (`gen.js — recoller`) : l'un glisse — et
tourne au besoin — jusqu'à toucher l'autre, s'il le peut sans rien recouvrir ni sortir du périmètre.
Recollé, il glisse le long de la jonction pour **aligner** ses façades sur celles de l'autre si le
décrochement est sous `V.alignDist` (3 m, la ligne `alignement` du cadre — `gen.js — aligner`) : le
glissement qui laisse le moins de décrochement, tous niveaux hors sol comptés. Un étage plus long
que l'autre, à surface fixe, garde le sien.
Deux corps d'école qui se touchent alors s'**assemblent** (`assembler`) en UN volume fait de
plusieurs rectangles (`model.js — partsDe`, `e.ext`) : l'un avance de l'épaisseur des deux murs qui
se faisaient face, leurs intérieurs se touchent, ses parts passent dans l'autre niveau par niveau.
Rien ne s'allonge : chaque part garde ses cotes, donc la surface et le module tiennent. Les
sous-sols ne bougent pas. Bout à bout, à mêmes profondeurs, les deux corps deviennent toujours un
seul rectangle (`alignes`). Un L, un U, une cour, un peigne sont ainsi d'un seul tenant ; la salle
de sport, à ses cotes et à sa hauteur, se recolle mais reste un volume accolé — les Typologies ne
laissent qu'un mur entre elle et l'école. Le plan trace le contour d'union, la 3D les parts sous un
même contour, les mesures lisent la façade sur ce contour.

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
FAIT QU'UN (`fusionner`) : à moins d'un mètre, deux corps se recollent et s'assemblent en un
volume de plusieurs rectangles ; la salle de sport devient un même bâtiment (`bat`, `joint`). En aval, un volume
fusionné se lit partie par partie : toit plat (une noue serait à dessiner), un maillage fermé par
niveau sur le contour à l'export Rhino, recoupé en boîtes à l'import, ombre et emprise par partie au
plan de situation et aux diagrammes (`archi.js`, `export.js`, `import.js`, `siteplan.js`, `diagramme.js`). La règle joue en fin de geste,
après un tirage. Pas de tirettes sur la salle de sport, dont les cotes sont imposées. La 3D montre le terrain MAILLÉ
depuis `SITE.grid`, les courbes drapées, les bâtiments existants à leur vraie hauteur, et les volumes
du projet. Le fichier Rhino n'a pas de calque d'arbres : il n'y en a donc pas au dessin.

Dans la 3D, **le modèle suit la main** : tirer vers la gauche le fait tourner vers la gauche,
tirer vers le haut relève son côté proche. La composante horizontale était inversée — la
caméra suivait le curseur, et le projet tournait à rebours du geste.

**Les étages montrés sont une PLAGE** (`MASS.etages`, `plageVue()` / `vu()` dans `model.js`),
réglée par un curseur à deux poignées dans la barre posée sur les vues, un cran par étage. Toute la plage,
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

La carte du volume choisi a un volet **Architecture**, replié : toiture (plat, végétalisé, un pan, deux pans,
sheds), puits de lumière (lanterneaux au faîte), entrée (un auvent sur une façade), rampe (le long
d'une façade, à 6 %), sous-passage (au rez, de part en part), jeu de niveaux (les étages au-dessus
du rez glissent tour à tour de ±j, dans la parcelle). Porte-à-faux, étages et passerelles se règlent
déjà ailleurs. Les choix vivent dans `v.ar` (enregistré par `etat.js`), la géométrie dans
`mass/archi.js — archiDe()`, une fois pour le plan, la 3D et l'export (groupe `Architecture`). Les
cotes de dessin sont des hypothèses : `RULES.archi`. Aucun élément ne touche une surface ; le
sous-passage coupe le rez sans que le bilan le décompte — la carte le dit.

Ces choix sont aussi des **leviers** de la composition (`lev-toit`, `lev-pf`, `lev-jeu`,
`lev-puits`, `lev-entree`, `lev-rampe`, `lev-sous`, dans `leviers.js`, état dans `MASS.lev`). Libre,
le dé tire UNE valeur pour toute la composition, à la graine du massing ; `architecturer()` la pose
sur chaque corps d'école — la salle de sport et le second temps restent plats. Porte-à-faux (3 m,
dernier étage, vers l'entrée) et jeu de niveaux (1,5 m) ne sont pris que si le corps reste dans la
parcelle et ne recouvre personne. Toute volumétrie — tirage, proposition suivante, remède
— passe par `gen.js — poser()` : poser, dégager, fusionner, architecturer.

L'orientation **socle** (`orientation.js`, valeur `socleMin`, 80 % par défaut) veut qu'un étage ne
soit pas plus petit que celui du dessus : `mesures.js — qualites()` compare chaque niveau au suivant.

## L'export vers Rhino, et l'import

Deux boutons au pied du rail, sous « Emporter ». **rhino3dm** — la bibliothèque de McNeel qui lit
et écrit le .3dm — se charge depuis jsDelivr au premier clic, et seulement là : 3 Mo de
WebAssembly que le reste du site ne demande pas. C'est la seule dépendance du projet, et elle
ne sert qu'à ces deux gestes.

### Exporter

« Exporter (.3dm) » télécharge `saxon-massing-<seed>.3dm`. `mass/export.js —
piecesMassing()` dit ce que contient le fichier, en pur ; `dm3Massing()` l'écrit.

- **Un .3dm, plus un .obj** : l'OBJ ne porte pas d'unité, et Rhino l'ouvrait en millimètres —
  dix fois trop petit. Le .3dm se déclare en **centimètres** et arrive avec ses calques, sans
  case à cocher.
- **Le repère est celui de `DOC/site_plan.3dm` en plan** : le fichier s'y pose en place, sans
  rien déplacer. **Z = 0 à 465 m** (`RHINO.z0`) : 300 = 468,00 m. L'origine vient de `RHINO`,
  que le script du relevé écrit dans `site.js`. Ce repère a l'allure du LV95 sans en être —
  voir `docs/releve.md` ; pour se superposer au relevé, c'est pourtant lui qu'il faut.
- **Les calques de la convention** (`data/calques.js`, `docs/echange.md`) :
  `3D::Projet::Volume::<chapitre>::Niveau_<nom>` — chaque étage de chaque volume en maillage
  fermé, huit sommets, six faces, normales vers l'extérieur, de plancher à plancher, murs
  compris ; les passerelles vont au niveau qu'elles desservent ; `…::Second_temps` porte la
  piscine et le local CAD. `3D::Projet::Architecture` porte les toits et auvents,
  `AIDE::Perimetre` et `AIDE::Recul_5m` les deux limites. Le chapitre d'un étage est celui de
  ses postes, sinon celui qui porte le plus de surface au niveau.
- **Ce qui est généré est bleu** (`GENERE`, couleur forcée sur l'objet) ; un corps revenu de
  Rhino retouché à la main (`v.main`) garde la couleur de son calque. Le fichier nomme la
  variante dont l'état part (`Saxon variante`). Les objets portent le nom du plan : le V3 qu'on lit
  au plan est le `V3_Rez` du fichier. L'en-tête est dans le texte utilisateur du document
  (`Saxon massing`).
- **Le recul est celui que le contrôle mesure.** Aucun module ne le traçait : la règle est une
  distance, `bordDist()` ≥ 5 m. `ligneRecul()` (`geom.js`) en fait une ligne sans refaire le
  calcul autrement — les côtés poussés vers l'intérieur, un arc à chaque angle rentrant, et
  `bordDist()` qui décide des morceaux à garder. Ses sommets sont à 5 m du bord à 10⁻¹⁴ m près,
  et l'aire qu'elle enclôt, 10'534 m², est celle que la règle donne point par point.
- **Les deux lignes sont drapées** sur le terrain, un sommet au moins tous les deux mètres : le
  fichier Rhino n'a pas de surface de terrain, rien que des courbes, et y draper une ligne est
  long quand la remettre à plat est une commande (`ProjectToCPlane`).
- Ni l'acrotère, ni le jour de 12 cm que la 3D laisse entre deux étages, ni le programme à
  l'intérieur des volumes. Les noms sont en ASCII : un nom de calque accentué arrive mutilé
  selon la version de Rhino.

### Importer

« Importer (.3dm) » relit un fichier dans le même repère, **remplace** la
volumétrie après confirmation, et la note se recalcule. **Seul `3D::Projet::Volume`** et ses
sous-calques sont relus quand le fichier les a : on rend son document de travail entier, relevé
et aides compris. Un fichier sans ce calque se lit tout entier, `Architecture` mise à part. Un
objet qui n'est plus bleu fait un corps **retouché à la main** (`v.main`), et la variante nommée
dans le fichier devient la mère de la suivante (`docs/echange.md`). Le jugement ne lit que des mesures, et
les mesures ne lisent que des volumes `{ x, y, a, lv }` : `mass/import.js` RECONSTRUIT donc ces
volumes, et la note ne dépend plus de qui a dessiné le bâtiment. L'unité est celle que le
fichier déclare ; le calque `Architecture` n'est pas relu (un auvent n'est pas un étage).

- **Des boîtes** — l'export d'ici, ou un modèle construit étage par étage, une boîte par étage
  — se lisent boîte par boîte. Les boîtes empilées font un volume ; son rez est celle posée au
  plus près du terrain, les autres montent ou descendent d'un niveau chacune. Une boîte seule,
  perchée, de la largeur d'une passerelle, qui touche deux volumes, est une passerelle. Un
  massing exporté puis réimporté revient **à l'identique** : même corps, même surface, même note,
  sur les douze partis.
- **Un solide unifié** (une union booléenne) se lit par ses **toits** : en chaque point du plan,
  la colonne de matière (une face qui regarde le ciel y fait entrer, une face qui regarde le sol
  en fait sortir — un porte-à-faux garde son vide dessous) ; les toits d'une même altitude,
  d'un seul tenant, font une région, découpée en rectangles dans l'axe de ses bords les plus
  longs ; `fusionner(…, true)` recolle les morceaux d'un même corps. Un solide n'a pas de
  dalles : les étages se comptent sur la **pile du mixer** si la plupart du bâti y tombe, sinon
  à **3,20 m** (vide de classe + dalle), chacun gardant la hauteur mesurée.
- **Ce que le solide ne nomme pas, ses mesures le disent** : la salle de sport est le corps aux
  cotes du programme (au mètre près, murs dedans ou dehors) ; un corps isolé d'un étage, de la
  surface d'un ouvrage du second temps à 5 % près, en est un.
- Ne passe pas : un toit en pente (il n'est pas horizontal), une bande de moins d'un mètre (un
  reste de découpe). Là où un corps bute en biais contre un autre, la découpe laisse de petits
  rectangles. rhino3dm ne maille pas : il relit les maillages de rendu que Rhino enregistre — un
  fichier « Save small » est refusé, avec la marche à suivre.

L'aller-retour se vérifie sans rhino3dm — l'export rend ses maillages en clair :

```bash
node --input-type=module -e "
Promise.all([import('./src/mix/shuffle.js'),import('./src/mass/gen.js'),
             import('./src/mass/model.js'),import('./src/mass/mesures.js'),
             import('./src/mass/export.js'),import('./src/mass/import.js'),
             import('./src/data/site.js'),import('./src/core/rand.js')]).then(([S,G,M,E,X,I,ST,R])=>{
  R.seed(1);
  S.repartir({ alea:false, etages:true });
  var H = ST.RHINO;
  ['auto','barres','pavillons','peigne'].forEach(function(p){
    M.massSet('parti', p);
    G.poser(G.genMass(11));
    var avant = M.bilanTotal().pose, note = E.evaluationCourante().jugement.total, n = M.MASS.vol.length;
    var sol = X.piecesMassing().objets.filter(function(o){ return o.f && o.calque !== 'Architecture'; })
      .map(function(o){
        var P = o.v.map(function(q){ return [(q[0] - H.x0) / H.u, (q[1] - H.y0) / H.u, q[2] / H.u + H.z0]; });
        return [].concat.apply([], o.f.map(function(f){ return [[P[f[0]], P[f[1]], P[f[2]]], [P[f[0]], P[f[2]], P[f[3]]]]; }));
      });
    M.massVols(I.volsDe3dm(sol).vols);
    console.log(p.padEnd(10), n + ' → ' + M.MASS.vol.length + ' corps', 'posé ' + Math.round(avant) + ' → ' + Math.round(M.bilanTotal().pose),
                'note ' + note + ' → ' + E.evaluationCourante().jugement.total);
  });
});"
```

L'état du massing — volumes, positions, rotations, parti, réglages — est persisté avec le reste
(`mass/etat.js`, clé `saxon-mix-v1`) : aller au mixer et revenir ne défait pas une implantation qu'on
vient de composer.

Le massing n'essaie pas de finir un projet. Il répond à une question de début d'étude : à quoi ce
programme ressemblerait-il, physiquement, sur ce site ?

## Salle de sport, scène, second temps

- **La scène est collée à la salle de sport** (cadre `scene-sport`, Intangible) : `placerSport()`
  accole toujours la salle à un corps d'école — elle essaie chacun, sinon l'essai échoue —, et
  `ecarts()` signale une salle qui ne touche plus l'école. Les Typologies posent la scène contre
  l'un de ses murs, et leur contrôle le vérifie.
- **La piscine et le local CAD sont dessinés dans toute variante** : l'option « non représentés »
  a disparu (une variante ancienne qui la portait revient à `auto`). Une candidate qui ne sait pas
  les poser ne passe qu'à défaut de toute autre (`secondPose()`), et le contrôle le dit en rouge.
- **Le public d'un côté** (`orientation.js — pub-est`) : visée, elle fait accoler la salle de
  sport au corps d'école le plus avancé vers `V.pubAz` et sur sa face de ce côté
  (`gen.js — versPublic`), et fait balayer au second temps la marge de ce côté d'abord. Mesures
  `pubSep`, `pubCote` (`mesures.js — publicEcole`) ; voir `docs/parametres.md`. Seed 1/11 : le
  public est du côté est sur 12 partis sur 12 (7 sans la ligne), séparé de l'école par une ligne
  sur 2 — la piscine et le CAD se posent où la marge le permet.

**Piscine et CAD du côté public** (orientation `second-est`, Prioritaire) : leur place sur la
parcelle vers `V.pubAz` (0 côté opposé, 1 bord public ; le moins avancé compte), favorable dès
`secondBon` (0,67), défavorable sous `secondMax` (0,5). Le générateur la sert à deux endroits :
l'école tire deux positions et garde la plus éloignée du côté public (`implanter`), et `auBord()`
essaie chaque position sous ses quatre angles avant de passer à la suivante — une place du bon
côté qui ne tient que tournée passe avant une place du mauvais côté.

**Plus de leviers d'architecture.** Toiture, porte-à-faux, jeu de niveaux, puits de lumière,
entrées marquées, rampe et sous-passages ne sont plus tirés : `architecturer()` donne à chaque
corps un toit plat et rien d'autre. Ils restent posables à la main sur la carte du volume choisi.
