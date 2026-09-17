# Centre scolaire de Saxon — programme et implantation

Outil d'aide à la conception pour le concours du nouveau centre scolaire de Saxon (VS) :
le programme des locaux dessiné à l'échelle, les adjacences exigées par le règlement, un
plan interactif par niveaux et l'implantation des volumes sur le site réel.

HTML + CSS + modules ES. Aucun build, aucune dépendance.

## Lancer

Les modules ES exigent un serveur HTTP (`file://` ne marche pas) :

```bash
python3 -m http.server 8000     # puis http://localhost:8000
```

Depuis un terminal cloud, redirige le port 8000 vers ta machine.

## Les deux gabarits

C'est la décision structurante du projet, et tout le reste en découle.

L'application rend **quatre vues de deux natures** : deux vues de *document*, qu'on lit,
et deux *outils*, qu'on opère. `document.body.dataset.kind` commute la mise en page :

| gabarit | vues | mise en page |
|---|---|---|
| `doc` | Programme, Adjacences | colonne de lecture de 960 px, défilement assumé |
| `tool` | Plan, Site | cadre plein, l'outil occupe la fenêtre |

Le chrome permanent (`.appbar`, collant, ~52 px) ne contient que le nom du projet, le
total vivant, les quatre onglets et la bascule de thème. **Tout contenu éditorial
appartient à la vue qu'il décrit** : le chapô, le chiffre-clé, les surfaces à préciser, la
légende, le récapitulatif et les sources vivent dans l'onglet Programme ; la barre
d'échelle aussi, parce qu'elle n'est exacte que là.

La vue courante est dans le fragment d'URL (`#plan`, `#programme/fam`) : rechargeable et
partageable.

## Structure

```
index.html            la coquille seule : barre d'application, #panels, #tip
styles/
  tokens.css          SOURCE UNIQUE de toute valeur de dessin — voir plus bas
  base.css            corps de page, [hidden], l'anneau de focus unique, infobulle
  appbar.css          chrome permanent, les deux gabarits, intro de Programme, replis
  controls.css        LE bouton et LE groupe de boutons
  program.css         panneaux, diagrammes, listes de postes, récapitulatif
  schema.css          adjacences
  plan.css            plan : coupe des niveaux, canevas, panneau latéral, menus, aide
  volumes.css         site : carte, barre groupée, tableau de bord
src/
  data/               données pures, sans logique
    families.js       familles d'usage (id, couleur, libellé)        ← source unique
    program.js        programme des locaux, chapitre 2.10             ← source unique
    schema.js         nœuds et liens des adjacences
    site.js           périmètre du concours, terrain, nappe phréatique — relevé seul
    rules.js          contraintes du concours : distances, hauteurs libres, feu,
                      nappe, stationnement, second temps           ← source unique
  core/
    viewstate.js      view.tab / view.group / view.mode + routage par hash
    model.js          totaux dérivés du programme (ITEMS, familles, recompute)
    format.js         fmt / dec / el / slug / arrondis
    svg.js            fabrique d'éléments SVG
    geometry.js       surfaces → blocs, empilage, proportions admissibles
    gl.js             WebGL minimal : matrices, programme, tampons, caméra orbitale
  views/
    render.js         aiguillage par onglet, barre de vue, récapitulatif, sources
    legend.js         chrome (total, compteur) + intro de Programme (chiffre-clé,
                      surfaces à préciser saisissables, légende)
    diagram.js        diagrammes à l'échelle et barre d'échelle
    schema.js         dessin des adjacences
    menu.js           menu déroulant — ce qui permet de ranger sans rien supprimer
    tooltip.js        infobulle
  plan/               plan interactif
    rooms.js          pièces issues du programme + adjacences
    links.js          calque des adjacences et compteur
    levels.js         niveaux, plateau, emprises, LA COUPE, bac « À placer »
    niv.js            règles de niveau (sous-sol, lumière, sanitaires)
    plans.js          plans mémorisés
    distribute.js     répartition du programme sur les étages
    areas.js          surfaces à préciser saisies par l'utilisateur, postes liés
    editor.js         canevas, sélection, propriétés, rangement, pointeur, annulation
  vol/                site : proposer une volumétrie, puis la contrôler
    place.js          terrain, périmètre, recul, distance entre boîtes, recherche de place
    massing.js        générateur : programme + règles + parti → volumes
    checks.js         contrôle d'une volumétrie → avertissements
    scene3d.js        la vue 3D : terrain, relevé, bâti existant, volumes du projet
    volumes.js        la vue Site : plan de situation, 3D, réglages, tableau de bord
  main.js             thème, onglets, routage, premier rendu
Design-1.2.0-v38/     le plugin « Design » d'Anthropic, déposé ici pour servir de grille
                      d'audit (design-system, design-critique, ux-copy, a11y)
```

## Règles du projet

**Aucune valeur de dessin hors de `tokens.css`.** Ni couleur, ni espace, ni taille, ni
rayon, ni ombre, ni durée. Les seules exceptions légitimes sont les valeurs divisées par
le zoom du plan (`calc(2px / var(--z))`), qui dépendent de l'échelle et pas du thème.

**Les trois blocs de thème, dans cet ordre, sans exception.** `:root` nu porte la palette
claire *complète* — tout token y naît. Puis `@media (prefers-color-scheme: dark)` gardé par
`:not([data-theme="light"])`, puis `:root[data-theme="dark"]`. Un token défini seulement
dans un bloc sombre n'existe pas pour le visiteur qui n'a rien choisi : c'est le bug
classique du thème illisible.

**Les couleurs de famille d'usage ne servent jamais d'état.** `--danger`, `--warn`, `--ok`
et `--focus` existent pour ça. Le vert de la famille « sport » servait de couleur de
succès et le bleu de la famille « eau » de couleur de focus : un token de famille détourné
en token d'état fait mentir la légende.

**La couleur n'est jamais seule à porter une information.** Huit teintes catégorielles ne
peuvent pas être distinguées deux à deux — 28 paires, aucun ordre ne franchit le seuil de
séparation sous daltonisme. Partout un libellé, une infobulle, une pastille ou la hachure
accompagne la couleur. Le technique est hachuré, comme en dessin d'architecture.

**Un composant, un rôle.** `.btn` et `.btn-group`. Le projet a compté jusqu'à sept boutons
concurrents dont la divergence n'était pas intentionnelle : deux conteneurs copiés mot pour
mot, dont les boutons avaient dérivé d'un demi-pixel.

**Un interrupteur garde un libellé fixe** et ne dit son état que par `aria-pressed`. Un
libellé qui mute au clic est ambigu : « Contrainte levée » se lit aussi bien « elle est
levée » que « lever la contrainte ».

**Un concept, un mot.** Les huit postes que le règlement ne chiffre pas sont « à préciser »
— partout, et « fixée » une fois la valeur donnée. Les postes mentionnés mais jamais
comptés sont « hors bilan ». Ces deux statuts portaient le même nom, alors que les premiers
sont dans le total et les seconds dans aucun : l'écart se chiffrait en centaines de m².

**Les surfaces du programme sont fixes.** On change les proportions d'une pièce ou d'un
volume — à surface exacte, `validDims` — jamais ses m². Le générateur de volumétrie
déduit ses volumes du programme ; il ne les réécrit pas.

**Une proposition hors règles est autorisée, jamais silencieuse.** `src/vol/checks.js`
la dit : rouge pour une règle écrite au règlement ou à l'AEAI, ambre pour une règle de
projet ou une marge qui se discute. Rien n'est empêché.

**Une action qui détruit le travail en cours le dit.** Dans son libellé ou dans la ligne de
conséquence de son entrée de menu.

**Au plus un repli par panneau**, et son résumé nomme ce qu'il contient.

## Où modifier quoi

- **Le programme** (surfaces, nombres, familles, notes) : `src/data/program.js` seul. Tous
  les totaux, diagrammes, listes, pièces du plan et volumes en découlent.
- **Les contraintes du concours** (distances, hauteurs libres, protection incendie, nappe,
  stationnement) : `src/data/rules.js` seul. Le générateur de volumétrie, le contrôle et
  les textes de l'onglet Site en découlent. `src/data/site.js` ne porte que du relevé.
- **Les familles et leurs couleurs** : `src/data/families.js` pour les libellés,
  `styles/tokens.css` pour les valeurs. Les deux fichiers sont liés par l'id de famille.
- **Un onglet** : ajouter une entrée dans `TABS` (`src/core/viewstate.js`), un bouton dans
  `index.html`, et une branche dans `render()` (`src/views/render.js`).
- **L'état de vue** : `src/core/viewstate.js` — lu partout, écrit seulement par `main.js`.

Règle du projet : chaque état mutable appartient à un seul module ; les autres le lisent
par import et passent par une fonction exportée pour le modifier (`setCurFloor`,
`toggleLinks`, `setStray`, `applyLevels`, `showPane`…).
