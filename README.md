# Centre scolaire de Saxon — programme et répartition

Outil d'aide à la conception pour le concours du nouveau centre scolaire de Saxon (VS) :
les contraintes du règlement, le programme des locaux dessiné à l'échelle, les adjacences
exigées, puis la répartition de ce programme sur les niveaux du projet.

HTML + CSS + modules ES. Aucun build, aucune dépendance.

## Lancer

Les modules ES exigent un serveur HTTP (`file://` ne marche pas) :

```bash
python3 -m http.server 8000     # puis http://localhost:8000
```

Depuis un terminal cloud, redirige le port 8000 vers ta machine.

## Les onglets sont une chronologie

C'est la décision structurante du projet, et tout le reste en découle. Les onglets ne
sont pas un sommaire : ils sont l'ordre dans lequel un concours se conçoit. **Chacun se
sert de ce que le précédent a décidé.**

```
Programme  →  Programme mixer  →  Massing  →  Typologie
contraintes   répartition du      volumétrie  plans et
et surfaces   programme sur       sur le site coupes
              les niveaux
```

L'ancien ordre faisait l'inverse : l'onglet Site venait APRÈS le Plan, donc on dessinait
la typologie d'un niveau avant d'avoir choisi le volume. Les deux dernières étapes sont à
reconstruire ; le code 3D reste en place pour cela (`src/core/gl.js`, `src/vol/`), sans
onglet qui l'expose.

L'application rend donc aujourd'hui **deux vues, de deux natures** : une vue de
*document*, qu'on lit, et un *outil*, qu'on opère. `document.body.dataset.kind` commute la
mise en page :

| gabarit | vue | mise en page |
|---|---|---|
| `doc` | Cahier des charges | colonne de lecture de 960 px, défilement assumé |
| `tool` | Programme mixer | cadre plein, l'outil occupe la fenêtre |

Le chrome permanent (`.appbar`, collant, ~52 px) ne contient que le nom du projet, le
total vivant, les onglets et la bascule de thème. **Tout contenu éditorial appartient à la
vue qu'il décrit.**

La vue courante est dans le fragment d'URL (`#mixer`, `#programme/surfaces/fam`,
`#programme/contraintes`) : rechargeable et partageable. L'identifiant de l'onglet reste
`programme` ; les formes qui ont circulé avant — `#adjacences`, `#programme/adjacences` et
`#programme/fam` — restent valables et mènent au volet qui les a reprises.

### Le cahier des charges, en deux volets

Ils étaient trois, empilés sur une seule page avant cela : revenir d'une adjacence à la
surface qu'elle commente demandait quatre écrans de défilement. Ce sont deux lectures du
même règlement, pas deux étapes ; la chronologie du concours est dans les onglets, pas ici.

1. **Surfaces** — le programme des locaux à l'échelle, les huit postes « à préciser » et
   **la part de circulation**, saisissables sur place. Volet d'ouverture, et le seul où
   l'on saisit quelque chose. La circulation y est dessinée **à l'échelle** avec les
   locaux — un bloc hachuré, sans couleur de famille — et comptée dans la somme de
   chaque chapitre : le titre donne le bâti, la ligne à côté d'où il vient.
2. **Contraintes** — site, hauteurs libres, protection incendie, parasismique, mobilité,
   second temps, tout lu dans `src/data/rules.js` ; puis le **schéma fonctionnel** des
   adjacences, d'où le mixer tire ses préférences de placement. Les adjacences ont été un
   onglet, puis un volet : une proximité exigée entre deux locaux n'est pas d'une autre
   nature qu'une hauteur libre ou une distance au voisin. Le schéma est **à l'échelle** :
   à largeur de colonne constante, la hauteur d'un rectangle vaut sa surface.

### L'onglet Programme mixer

Il prend les surfaces et les organise sur des niveaux. Rien d'autre.

- Une pile de niveaux, du sous-sol le plus profond au dernier étage, **dessinée comme une
  coupe** : le plus haut en tête, le sol en bas. Par défaut, un seul rez-de-chaussée.
- Un niveau est dessiné **à l'échelle des surfaces** : chaque bloc occupe la part de m²
  qu'il occupe dans le programme (pavage squarifié, `src/core/treemap.js`). La ligne de
  plateau dit ce qui tient ; la bande qui la dépasse dit ce qui ne tient pas.
- Ce qui ne pèse pas sur le plateau — cour, piscine, chauffage à distance — a sa propre
  bande, sous un filet, hors du compte.
- **Répartir** propose l'ordre des chapitres du règlement, sans hasard. **Shuffle** tire
  une alternative, et peut aussi proposer un nombre de niveaux. Les deux gestes partagent
  un moteur ; une **graine** rend toute proposition rejouable à l'identique.
- On glisse un bloc d'un niveau à l'autre, ou on l'ouvre d'un clic — ou de la touche
  Entrée — pour le déplacer et le scinder.

## Structure

```
index.html            la coquille seule : barre d'application, #panels, #tip
styles/
  tokens.css          SOURCE UNIQUE de toute valeur de dessin — voir plus bas
  base.css            corps de page, [hidden], l'anneau de focus unique, infobulle
  appbar.css          chrome permanent, les deux gabarits, chapô du cahier des charges, replis
  controls.css        LE bouton, LE groupe de boutons, LA pastille de verdict
  program.css         panneaux, diagrammes, contraintes, rangs de section, récapitulatif
  schema.css          adjacences
  mixer.css           le mixer : pile, canevas d'un niveau, blocs, bac, popover
src/
  data/               données pures, sans logique
    families.js       familles d'usage (id, couleur, libellé)        ← source unique
    program.js        programme des locaux, chapitre 2.10             ← source unique
    schema.js         nœuds, pôles et liens des adjacences            ← source unique
                      ni surface ni coordonnée : le nœud dit quels postes il désigne
    site.js           périmètre du concours, terrain, nappe phréatique — relevé seul
    rules.js          contraintes du concours : distances, hauteurs libres, feu,
                      nappe, stationnement, circulation, second temps ← source unique
  core/
    viewstate.js      view.tab / view.group / view.mode + routage par hash
    model.js          totaux dérivés du programme, surfaces saisies, PART DE CIRCULATION
    format.js         fmt / dec / el / slug / arrondis
    svg.js            fabrique d'éléments SVG
    geometry.js       surfaces → blocs, empilage, proportions admissibles
    treemap.js        pavage squarifié — un bloc vaut sa surface
    rand.js           tirage reproductible à graine (mulberry32)
    gl.js             WebGL minimal — dormant, pour le futur onglet Massing
  mix/                répartir le programme sur les niveaux
    prog.js           le programme vu comme des parts à poser, adjacences par poste
    niv.js            règles de niveau du règlement, cotes admissibles par poste
    floors.js         la pile de niveaux, les parts posées, déplacer / scinder
    shuffle.js        répartition ordonnée, tirage, proposition de pile
    checks.js         contrôle d'une répartition → écarts, avec leur code et leurs remèdes
    fix.js            les remèdes : déplacer, vider, agrandir un plateau, poser un WC
    accept.js         les écarts qu'on assume — « laisser comme ça »
    store.js          persistance : surfaces précisées, circulation, pile, répartition,
                      écarts assumés
  views/
    render.js         aiguillage par onglet, cahier des charges, récapitulatif, sources
    legend.js         chrome (total, compteur), chapô, surfaces à préciser, légende
    constraints.js    la section Contraintes, lue dans rules.js
    diagram.js        diagrammes à l'échelle et barre d'échelle
    schema.js         schéma fonctionnel : colonnes par pôle à l'échelle, fils routés
    mixer.js          l'onglet Programme mixer
    tooltip.js        infobulle
  vol/                DORMANT — à reconstruire en onglet Massing
    place.js          terrain, périmètre, recul, distance entre boîtes
    massing.js        générateur : programme + règles + parti → volumes
    checks.js         contrôle d'une volumétrie → avertissements
    scene3d.js        la vue 3D : terrain, relevé, bâti existant, volumes
  main.js             thème, onglets, routage, premier rendu
Design-1.2.0-v38/     le plugin « Design » d'Anthropic, déposé ici pour servir de grille
                      d'audit (design-system, design-critique, ux-copy, a11y)
```

## Règles du projet

**Aucune valeur de dessin hors de `tokens.css`.** Ni couleur, ni espace, ni taille, ni
rayon, ni ombre, ni durée. Les seules exceptions légitimes sont les géométries calculées
et posées en ligne par le JS — la position et la taille d'un bloc du mixer, la hauteur
d'un canevas —, qui sont des surfaces à l'échelle et pas des choix de style.

**Les trois blocs de thème, dans cet ordre, sans exception.** `:root` nu porte la palette
claire *complète* — tout token y naît. Puis `@media (prefers-color-scheme: dark)` gardé par
`:not([data-theme="light"])`, puis `:root[data-theme="dark"]`. Un token défini seulement
dans un bloc sombre n'existe pas pour le visiteur qui n'a rien choisi : c'est le bug
classique du thème illisible.

**Les couleurs de famille d'usage ne servent jamais d'état.** `--danger`, `--warn`, `--ok`
et `--focus` existent pour ça.

**La couleur n'est jamais seule à porter une information.** Huit teintes catégorielles ne
peuvent pas être distinguées deux à deux. Partout un libellé, une infobulle, une pastille
ou la hachure accompagne la couleur. Le technique est hachuré, comme en dessin
d'architecture.

**Un composant, un rôle.** `.btn` et `.btn-group`. Le projet a compté jusqu'à sept boutons
concurrents dont la divergence n'était pas intentionnelle.

**Un concept, un mot.** Les huit postes que le règlement ne chiffre pas sont « à préciser »
— partout, et « fixée » une fois la valeur donnée. Les postes mentionnés mais jamais
comptés sont « hors bilan ». La circulation est **une part de la surface bâtie**, une
seule fois, dans un seul module : elle se réglait dans deux onglets, sous le même mot, avec
deux arithmétiques opposées — 15 % ajoutés à l'utile d'un côté, 18 % du bâti de l'autre.

**Les surfaces du programme sont fixes.** On change les proportions d'une pièce ou d'un
volume — à surface exacte, `validDims` — jamais ses m². Le mixer déduit ses parts du
programme ; il ne les réécrit pas.

**Une proposition hors règles est autorisée, jamais silencieuse.** `src/mix/checks.js` la
dit : rouge pour une règle écrite au règlement ou à l'AEAI, ambre pour une règle de projet
ou une marge qui se discute. Le plateau, le nombre de niveaux et la part de circulation
sont des choix de projet : leur dépassement est ambre. Rien n'est empêché.

**Un écart dit aussi ce qui le réparerait.** On le clique, il propose le geste — `fix.js`
le fabrique, `checks.js` le nomme à côté de la règle qu'il répare — ou « laisser comme
ça », qui ne l'efface pas : il quitte le verdict, passe dans « laissés tels quels » et se
reprend d'un clic. Un remède qui en créerait un autre n'est jamais proposé.

**Une action qui détruit le travail en cours le dit.** Dans son libellé ou dans sa ligne de
conséquence.

**Au plus un repli par panneau**, et son résumé nomme ce qu'il contient.

**La raison d'une commande indisponible est écrite**, pas mise en `title` : un attribut de
survol n'existe ni au doigt, ni au clavier, ni sur mobile.

## Où modifier quoi

- **Le programme** (surfaces, nombres, familles, notes) : `src/data/program.js` seul. Tous
  les totaux, diagrammes, listes et parts du mixer en découlent.
- **Les contraintes du concours** (distances, hauteurs libres, protection incendie, nappe,
  stationnement, part de circulation par défaut) : `src/data/rules.js` seul. La section
  Contraintes, les règles de niveau et le contrôle du mixer en découlent.
  `src/data/site.js` ne porte que du relevé.
- **Les adjacences** : `src/data/schema.js` seul. `src/mix/prog.js` ne fait que dire quel
  nœud du schéma correspond à quel poste du programme, et le signale si un nom change.
- **Les familles et leurs couleurs** : `src/data/families.js` pour les libellés,
  `styles/tokens.css` pour les valeurs. Les deux fichiers sont liés par l'id de famille.
- **Un volet du cahier des charges** : une entrée dans `SUBS` (`src/core/viewstate.js`) et une
  branche dans `render()`. Le bouton et le routage par hash suivent tout seuls.
- **Un onglet** : ajouter une entrée dans `TABS` (`src/core/viewstate.js`), un bouton dans
  `index.html`, et une branche dans `render()` (`src/views/render.js`).
- **L'état de vue** : `src/core/viewstate.js` — lu partout, écrit seulement par `main.js`.

Règle du projet : chaque état mutable appartient à un seul module ; les autres le lisent
par import et passent par une fonction exportée pour le modifier (`setItemArea`, `setCirc`,
`move`, `split`, `setPlate`, `setStack`, `repartir`…).
