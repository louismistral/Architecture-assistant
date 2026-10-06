# L'onglet Typologies

Dessiner les plans de chaque niveau DANS les volumes du Massing.

```
src/typo/gen.js       le générateur de plans (PG) : `creerPG(D)`, `planifier(D)` — pur, hors de la page
src/typo/mesures.js   ce qu'on lit sur le plan : `lirePlans(D)`, `evaluerTypo(vols, ponts)`, `typoVerdict()`
src/typo/plans.html   la page des plans : le dessin, le mobilier, le rail, la planche
src/typo/donnees.js   ce que le générateur lit : la pile du mixer, les volumes (ceux à l'écran, ou ceux
                      qu'on lui passe), les liens actifs
src/typo/etat.js      ce qu'elle enregistre : sa seed, ses cotes de pièces — rien d'autre
src/views/render.js   `typoHote()` : ce que l'onglet et le Rendu donnent à la page avant de la charger —
                      données, générateur, relevé, évaluation
```

## Le plan se mesure hors de la page

Le générateur vivait en script dans `plans.html` : seul l'iframe savait tirer un plan, et rien
d'autre ne pouvait le mesurer. Il est dans `gen.js`, à l'identique — une sonde a comparé l'ancien
et le nouveau sur les douze partis et cinq seeds, 180 niveaux, sans un écart. La page le reçoit de
son hôte (`parent.typoPG`), comme ses données ; le jugement, la recherche, les variantes et node
tirent le même plan qu'elle.

Le contrôle de la page n'écrit plus que ses phrases : les nombres viennent de `lirePlans()`
(`parent.typoLecture`), le relevé même que le jugement lit. Le test du passage d'un couloir vers le
corps voisin est dans `gen.js` (`passage()`) : le dessin y ouvre les pignons, la mesure ne compte
pas ce bout comme un bout de couloir.

## Le score des typologies

Pour un même volume, il y a une bonne et une mauvaise typologie. Les plans donnent des MESURES
(`donnees.js — MESURES`, `de:"typo"`), et le jury les note comme celles du mixer et du massing :
elles entrent par `mass/mesures.js — evaluer()`, le seul point de jonction. Le rail du Massing, la
page Paramètres, les variantes et le classement de `genMass()` les reçoivent de là — chaque
candidate du générateur est planifiée dans SES volumes, à la seed typologie PAR DÉFAUT
(`typo/etat.js — GRAINE0`) : la seed du massing seule décide du massing, quelle que soit la
typologie à l'écran. La recherche essaie ensuite les typologies du volume retenu.

Les écarts des plans se comptent À PART : ils rougissent la note (étape Évaluation du Massing,
dont le titre dit alors quelle ligne les plans enfreignent — `rougesTypo()`), mais l'étape
Contraintes du Massing ne lit que le massing, et l'étiquette « hors cadre » d'une variante
ignore les ambres des plans — `typo-pose` et `sol-vide` s'allument aujourd'hui sur presque
toute composition ; ils se lisent dans `verdict.typo`.

| mesure | ce qu'elle lit | critère |
|---|---|---|
| `classesSoleil` | part des salles de classe dont la façade de jour regarde de l'est au sud-sud-ouest (½ du sud-ouest à l'ouest) | d33, à la place de la façade du corps |
| `liensPlan` | part des liens du schéma tenus à 15 m bord à bord, au même niveau | prox, à la place du « même niveau » du mixer |
| `circPlan` | couloirs, paliers et noyaux dessinés, sur le bâti | g59, à la place de l'estimation |
| `murBruyant` | mur partagé entre une classe et une pièce bruyante, UAPE ou technique | calme, à la place des niveaux mêlés |
| `noyaux` | noyaux escalier + ascenseur | d42, noté à la main jusqu'ici |
| `grappes` | part des classes en suites de 3 ou 4, même bande, même couloir | d32, noté à la main jusqu'ici |
| `techGroupes` | groupes de locaux techniques qui ne se touchent pas | d43, noté à la main jusqu'ici |
| `posePlan` | part du programme posée dans les plans | « Tout le programme tient dans les plans », nouveau |
| `couloirsJour` | part des bouts de couloir sur une façade | « Couloirs éclairés à leurs bouts », nouveau |
| `pubGroupe` | part des bandes où les pièces publiques (`program.js`, chapitres `public`) forment une suite, à un bout | d39, noté à la main jusqu'ici |
| `vestSas` | part des classes standard qu'on entre par leur vestiaire (lien `sas`) | d37, noté à la main jusqu'ici |

Les règles viennent des directives vaudoises (2002, 1-4P), de VS 400.200, de l'AEAI 16-15, des
Raumstandards de Zurich et des rapports de jury de Broc, Vignettaz, Praroman, Matran, Cugy et
Suhr. Ne sont retenues que celles que la SEED déplace : une règle que le volume seul décide — la
profondeur d'une classe, le front des vestiaires — ne départage pas deux typologies.

La **part Typologie** (`jugement.js — scoreTypo()`) est la moyenne, au poids de chacun, de ces
critères. Ce n'est pas un axe : elle ne change pas la note, elle la lit. Au départ, d'une seed à
l'autre, elle va de 51 à 63 % pour une note générale de 63 à 64 — les critères du plan pèsent
peu dans les six axes ; leurs poids se règlent dans Paramètres.

**Les écarts au cadre** (onglet typologie, sévérité lue sur le tag) : `scene-sport`, `fuites`
et `sia500` (Intangibles, rouges), `typo-pose` et `noyaux-empiles` (Imposés, ambre). La scène,
la seed la change : 9 seeds sur 20 ne la collent pas. L'évacuation et l'accessibilité, les
noyaux les tiennent (*Les noyaux*, plus bas) : sur les douze partis et vingt seeds, aucun plan
ne les enfreint, ni ne décale un noyau d'un niveau à l'autre (`noyaux-empiles`). Un écart ne
jette aucun volume : `genMass()` ne garde que sa garde du massing.

**Le programme qui ne tient pas** : le massing dimensionnait ses volumes sur la circulation
estimée, les plans en dessinent davantage — 680 m² par tirage en moyenne. Il demande désormais ce
que les plans pavent (`docs/massing.md`) : 250 m² par tirage (72 tirages, 45'000 → 16'400 m²),
la granularité d'une pièce entière en bout de bande. Noté (`posePlan`) et notifié (`typo-pose`).

**Public et école** : le contrôle dit, bande par bande, où une pièce d'école s'intercale entre
deux pièces publiques, ou où la suite publique est enfermée au milieu de la bande
(`lirePlans() — pub`) ; `pubGroupe` le note (d39). Le côté du public se juge au Massing
(`pub-est`, `pubSep`, `pubCote`).

## Les noyaux

Un noyau est une cage d'escalier et d'ascenseur : il traverse TOUS les niveaux de son corps, au
même point. `gen.js — hotes()` les place avant de composer les plans, bâtiment par bâtiment
(`bat`) :

- **où il peut être** : dans l'emprise commune à tous les niveaux du corps — un sous-sol de
  20 m sous une barre de 110 m le tient au milieu de la barre —, contre la façade du côté du
  noyau, tous les dix mètres environ, si la cage tient dans le rang à chaque niveau ;
- **combien** : on ajoute celui qui répare le plus — un niveau sans noyau hors du rez
  (`sia500`), un étage de plus de 900 m² à un seul, la voie d'évacuation en trop (`fuites`) —,
  puis on en déplace un, puis on en remplace un par deux, jusqu'à ce que tout tienne. Deux
  noyaux d'un corps restent à deux cages l'un de l'autre. À égalité, la seed choisit ;
- **la même mesure** : `fuite(p, C)`, en équerre jusqu'au noyau le plus proche et sa limite
  (35 m vers un, 50 m vers deux), est celle que `lirePlans()` applique au centre de chaque
  pièce. Les pièces n'étant pas encore posées, `hotes()` la prend aux points les plus loin
  qu'elle puisse lire : à une demi-cabine de WC du pignon, à une demi-bande de la façade.

La composition pose la cage À SA PLACE dans le rang : une pièce qui ne tient pas avant elle
laisse passer la suivante qui y tient, sinon elle passe après, et le sol laissé devant la cage
est un dégagement. Une façade qui recule d'un niveau à l'autre laisse un écart derrière la
cage ; le rang du noyau s'élargit d'autant.

Le prix est dit : desservir les sous-sols et empiler les cages coûte du plateau — sur les douze
partis et vingt seeds, le programme qui ne tient pas passe de 275 à 300 m² par tirage en
moyenne (`typo-pose`).

## Chaque onglet tire chez lui

Le mixer répartit, le Massing pose les volumes, les Typologies ordonnent les pièces dedans. Aucun
n'écrit en amont : ouvrir l'onglet, y tirer ou y régler une pièce ne change ni la pile ni la
volumétrie, et l'on retrouve au Massing celle qu'on y avait laissée.

> Avant, ouvrir l'onglet réécrivait le Massing à trois endroits : `typoAccorder()` déplaçait des
> postes au mixer pour rapprocher les liens (la pile changeait, le Massing se régénérait),
> `typoSalleAccolee()` fixait le levier sport et retirait une volumétrie, et la page MESURAIT chaque
> corps à ses pièces puis lui réécrivait ses cotes (`typoEcrire`, avec écarter, dégager, fusionner).
> Une cote de pièce réglée au plan allait aussi au mixer (`setCote`), et entrait dans
> `empreintePile()` : retour au Massing, nouvelle volumétrie.

- **Un corps garde ses cotes**, niveau par niveau — longueur, profondeur, décalage, retraits. Le plan
  s'y dessine depuis le bout de l'ancre ; ce qui reste devient palier.
- **Ce qui ne tient pas reste au bac du niveau** : la pièce qui couvre le débord au plus juste, sinon
  la plus grande, jamais un hall. L'étape Bilan la nomme, le Contrôle la compte ; c'est au Massing
  (agrandir) ou au mixer (alléger) d'y répondre.
- **Puis ce qui est sorti revient là où il reste de la place**, dans n'importe quel corps du niveau,
  le sien compris. L'abri PC (750 m²) se compartimente en parts de 300 m² au plus, et une part se
  recoupe pour remplir le sol qui reste. Sans cela, un débord de quelques mètres sortait l'abri entier
  et laissait vide la moitié d'un corps — le Massing l'avait dimensionné pour lui.
- **Le sol qu'un rang laisse libre est un dégagement**, nommé au plan, ouvert sur le couloir. Au-delà
  de `sol-vide` (cadre, 100 m² par corps et par niveau), le Contrôle le signale.
- L'annexe que les plans adossaient à la salle de sport, et le sous-sol mis à la profondeur de la
  pile, ont disparu avec la mesure : ils épaississaient le volume. Les liens à la salle se tiennent
  quand le Massing l'accole (levier « Salle de sport accolée »).

## Un volume fusionné, un seul mur

Le Massing assemble ce qui se touche en un volume de plusieurs rectangles (`docs/massing.md` — *Le
volume n'est pas qu'un rectangle*). Les plans se composent rectangle par rectangle :
`donnees.js — ailes()` fait de chaque part une aile, un corps du même bâtiment (`bat`) qui partage
les noyaux des autres, suivie d'un niveau à l'autre par ce qu'elle recouvre en plan pour que son
noyau s'empile. Tous les murs se dessinent AVANT tous les sols : là où deux ailes se touchent, le sol
de l'une recouvre le mur de l'autre, et il n'y a plus de mur entre elles — la séparation des pièces
est leur cloison. Deux volumes qui ne font que se toucher (la salle de sport et l'école, ou deux
corps que le Massing n'a pas pu assembler) gardent UN mur : celui de l'autre, et ce qui les sépare
encore (moins de `regles.fusion`, 1 m), devient un dégagement, ouvert sur une baie de passage.

**Verrouillées** (`core/verrou.js`), les Typologies se regardent : le Shuffle, la seed et la cote
d'une pièce sont désactivés (`DATA.verrou`). Un cadenas sur les Typologies fige aussi le Massing,
le mixer et le cahier des charges : le plan ne peut plus bouger sous elles.

## Shuffle typologie et sa seed

`TYPO.graine`, à côté de `MASS.graine` et de la seed du mixer, et indépendante des deux. Elle ne
change que l'**ordonnance** : l'ordre des familles (donc quelle famille va à quel corps), celui des
postes dans une famille, la place d'un noyau quand deux places se valent. Le tirage est
PUR (`alea(nom)`, de la seed et d'un nom) : l'écran, le contrôle et le Rendu voient le même plan.
Même écriture que les autres seeds — base 36, retapée puis Entrée — et le bouton et le champ passent
par un seul chemin, `rejouer()`. Elle s'enregistre avec le projet (`snapshot().typo`) ; une variante
d'avant revient à la seed 1.

## La page parle la langue du Massing

Elle charge les feuilles du site (`tokens`, `base`, `controls`, `massing`), le thème et le mode de
l'hôte, et en reprend les composants :

- **le rail en chaîne** — Proposer en tête (Shuffle typologie, le nombre de volumes lus, la seed),
  puis les étapes repliables, leur état à droite : 1 · Bilan du niveau (part posée, ce qui ne tient
  pas), 2 · Évaluation (la note du bâtiment entier à cette seed, rouge s'il est invalide ; la part
  Typologie ; chaque critère du plan, sa mesure et sa barre — `parent.typoEvaluation()`, refaite à
  chaque Shuffle), 3 · Contrôle (toute la pile ; ouvert dès qu'un point est à revoir),
  4 · Familles ; Emporter au pied (Copier le SVG) ;
- **la barre** de ce qu'on regarde — niveau, couleurs, mobilier · cotes · site, cadrage — une
  préférence de l'appareil (`localStorage`, `typo-saxon`), pas une décision de projet ;
- **la pièce cliquée** dans une carte posée sur le plan, au coin opposé au clic : sa largeur au
  module, à surface exacte. La cote reste aux Typologies.

La palette du DESSIN (poché, papier, lavis) reste celle de la page — un rendu de concours — et suit
`data-mode` ; `typoPlanches()` la force en clair pour le Rendu.

## Des pièces, pas des couloirs

Une pièce prenait toute la profondeur de sa bande, sa largeur en découlait : un WC PMR de 3 m²
devenait une lame de 0,48 × 6,20 m, un vestiaire de 10 m² 1,13 × 8,90 m. La surface reste
fixe ; le pavage règle la FORME, dans les limites de `RULES.plan.piece` et `RULES.plan.pmr` :

- **une pièce de bande** (`profDe()`) prend la profondeur de sa bande si ses proportions le
  permettent, sinon elle se pose contre la façade et ce qui reste devant elle est un dégagement
  ouvert sur le couloir (compté au sol libre, `sol-vide`). Une classe garde la profondeur de
  `classe-dim` (9 m). Une bande ne descend pas sous la profondeur que ses pièces demandent ;
  au bout, une pièce ne ferme le couloir que si elle en prend toute la profondeur ;
- **un bloc de petites pièces** (`peigne()`) garde la plus étroite de trois dispositions :
  chacune seule ; en colonnes empilées autour d'un sas (`piece.sas`, l'aire de rotation s'il
  dessert un WC PMR) ; la plus grande au fond, les autres devant, côte à côte, un sas entre elles.
  Chaque pièce a sa porte sur le couloir, le dégagement ou le sas ;
- **une aile plus profonde que longue** (le bras d'un L, 17 × 72 m) se pave le long de son grand
  côté : `donnees.js — enLong()` la tourne d'un quart de tour, le volume ne change pas.

Le prix est dit, pas caché : le dégagement et le sas sont du sol que les pièces ne prennent
pas, donc un plan plus long, plus de sol libre et plus de pièces au bac.

**Au contrôle, les lignes du cadre** : la scène collée à la salle de sport (mur contre mur, au
même niveau — `scene-sport`), l'évacuation (`fuites`), un noyau à chaque niveau (`sia500`), les
noyaux empilés, le programme posé, pas de sol inutilisé dans un corps (`sol-vide`) — tous lus
sur le plan par `typo/mesures.js — evaluerTypo()` —, et toutes les pièces ouvertes sur un couloir
(`couloir-acces`, VÉRIFIÉ pièce par pièce dans les blocs : la face par où l'on entre ne touche
aucune autre pièce). Une ligne de plus, « proportions vivables », lit `RULES.plan.piece` et
`pmr`. Deux rangs dès `RULES.plan.deuxRangs` (15 m), un seul en deçà : une classe n'est plus
posée dans une bande de 5,60 m. Le Massing taille ses volumes sur ce que ce pavage demande
(`docs/massing.md` — *Le volume loge ce que les plans pavent*) ; ce qu'elle signale encore vient
des halls traversants et des très grands locaux. `enLong()` tourne aussi une aile dont un niveau
est carré (un sous-sol de 20,5 × 20,5 m) : il la laissait de travers, et un étage entier restait
au bac. La **trame** de placement des pièces (`trame`,
Imposé, 1,20 m) est déclarée au cadre mais pas encore lue : à construire.

La seed est la troisième de la recherche automatique : elle y est rebattue par volume
(`docs/variantes.md`), et chaque variante la garde (`snapshot().typo`, `thumbnail.typo`).

## Le vestiaire en sas

Le lien classes–vestiaires est un passage obligé (`schema.js`, `sas:1`) : couloir → vestiaire →
classe. Les 18 vestiaires de classe vont aux 18 classes **standard** ; les classes de réserve
et de dédoublement n'en ont pas au programme.

- **un élément de bande** : `composer()` donne à chaque classe UN des vestiaires qui la suivent
  (`ante`) — sa mère d'abord, sinon un vestiaire dont la mère est sortie au bac. La classe, puis
  son vestiaire : ni la coupe entre les rangs, ni un noyau, ni un palier ne les séparent, et la
  classe ne ferme plus le couloir. Un vestiaire de trop reste un satellite, en bloc ; le bac ne
  prend pas un vestiaire en sas tant qu'autre chose peut sortir ;
- **la forme** : le vestiaire se pose contre la façade, à ses proportions (2,24 × 4,47 m) ; ce
  qui reste devant lui est un dégagement ouvert sur le couloir, où il a sa porte. La porte de la
  classe est dans leur mur commun, ouverte vers elle ; la classe n'a plus de porte sur le couloir ;
- **la mesure** : `lirePlans() — sas` compte les classes dont le vestiaire est accolé, un mur
  commun assez long pour la porte ; `vestSas` la part, d37 la note, et une ligne du Contrôle
  nomme les classes sans. Il n'atteint pas 100 % quand le mixer met des vestiaires à un niveau
  sans classes, ou qu'une classe ou son vestiaire reste au bac ;
- **les grappes** : le vestiaire fait partie de sa classe, il ne coupe pas une suite (`grappes`).

Le prix est dit : le dégagement devant chaque vestiaire et les WC qui ne s'empilent plus avec
lui (un bloc à part) allongent les bandes — sur la composition de référence, la part posée
passe de 93-96 % à 91-95 % d'une seed à l'autre.

## Le dessin suit les conventions d'un plan d'architecte

Un plan est une coupe horizontale à `RULES.plan.coupe` (1,20 m) du sol : ce qu'elle tranche est
fort, ce qu'on voit dessous est fin, ce qui est au-dessus est en tirets. Toutes les cotes
physiques sont dans `RULES.plan` (`data/rules.js`), les épaisseurs de trait dans `TRAITS`
(`data/planches.js`, en mm) — la même table pour l'écran et les planches du Rendu.

- **La hiérarchie des traits** : chaque élément porte une classe `w-*` (coupe, menuiserie, vu,
  dessus, axe, cote), engendrée de `TRAITS` au chargement, à 96 px par pouce : l'écran se lit
  comme imprimé à 100 %, quel que soit le zoom.
- **Les murs** : extérieurs et porteurs à `RULES.haut.mur` (40 cm, isolation comprise), pochés
  pleins ; une cloison est le trait de sa pièce à son épaisseur réelle (`--cloison`, 10 cm).
- **Les ouvertures** : une porte est un vide, un vantail ouvert à 90° (menuiserie) et l'arc de
  son débattement (vu) — 90 cm (`porte`), à deux battants dès `porteDouble`. Une fenêtre :
  cadre et verre en trait moyen au milieu du mur, l'allège vue aux deux nus. La porte palière de
  l'ascenseur coulisse : vantail décalé, sa flèche.
- **L'escalier** se déduit de la hauteur d'étage du VOLUME (`DATA.regles.alt`, de `etagesDe`) :
  autant de marches de `marche.h` (17 cm) qu'il faut, au giron `marche.g` (29 cm, 2h + g = 63).
  La volée qui monte est coupée : marches pleines en deçà, ligne de rupture, tirets au-delà ;
  « M » et « D », la flèche part du bas. La gaine a ses cloisons pochées.
- **Les cotes**, en centimètres, hors du dessin, un blanc (`cotes.ecart`) entre le dessin et les
  lignes d'attache : sur la façade libre, trois chaînes — percements, murs et cloisons,
  hors-tout ; sur le pignon libre, deux. Les axes des murs porteurs (façades, couloir) en trait
  mixte, repérés d'une lettre au bout libre.
- **Les niveaux** : un triangle par bâtiment, ±0.00 au rez de l'école (`datumEcole`), +3.20… à la
  hauteur de chaque volume.
- **Au-dessus de la coupe** : l'étage du dessus, là où il déborde (porte-à-faux), en tirets.
- **Les pièces** : nom et surface, qui tiennent dans la pièce. Mobilier et appareils au trait
  fin, aux cotes de `RULES.plan` (WC 40 × 70, lavabo 60 × 50, douche 90, plan de travail 60) ;
  l'aire de rotation de 150 cm dans le WC PMR, posé à 1,65 × 1,80 m au moins.
- **L'échelle est dite** : dans la cartouche et sous l'échelle graphique, celle de l'écran et
  celle du Rendu (1:200).
- **Les calques suivent l'ordre du dessin** : contexte, axes, murs, sols, pièces et cloisons,
  portes et fenêtres, escalier, au-dessus, mobilier, noms, niveaux, cotes. L'escalier n'est pas
  du mobilier : il reste quand on masque le mobilier.
