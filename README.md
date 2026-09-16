# Programme des locaux — Saxon

Outil d'aide à la conception pour le concours du nouveau centre scolaire de Saxon (VS) :
programme des locaux dessiné à l'échelle, schéma fonctionnel, plan interactif par niveaux
et implantation des volumes sur le site.

Reconstruction de l'artefact Claude en projet statique modulaire (HTML + CSS + modules ES,
sans build ni dépendance).

## Lancer

Les modules ES exigent un serveur HTTP (`file://` ne marche pas) :

```bash
python3 -m http.server 8000     # puis http://localhost:8000
```

Depuis un terminal cloud, redirige le port 8000 vers ta machine (l'app desktop propose le
port forwarding) ou lance la même commande dans un clone local.

## Structure

```
index.html            balisage seul : en-tête, barres de contrôle, conteneurs (#panels, #tip)
styles/
  tokens.css          palette, couleurs de famille, thèmes clair/sombre  ← source unique des couleurs
  base.css            corps de page, pied de page, infobulle
  header.css          en-tête, chiffre-clé, surfaces à préciser, légende
  controls.css        barres de segments et barre d'échelle
  program.css         panneaux, diagrammes, listes de locaux, récapitulatif
  schema.css          schéma fonctionnel
  plan.css            plan interactif (pièces, niveaux, panneau de propriétés, plans mémorisés)
  volumes.css         onglet Volumes et tableau de bord
src/
  data/               données pures, sans logique
    families.js       familles d'usage (id, couleur, libellé)        ← source unique
    program.js        programme des locaux, chapitre 2.10             ← source unique
    schema.js         nœuds et liens du schéma fonctionnel
    site.js           périmètre du concours, terrain, nappe phréatique
  core/
    model.js          totaux dérivés du programme (ITEMS, familles, recompute)
    viewstate.js      onglet affiché et mode de représentation        ← source unique
    format.js         fmt / el / slug / arrondis
    svg.js            fabrique d'éléments SVG
    geometry.js       surfaces → blocs, empilage, proportions admissibles
  views/
    legend.js         chiffre-clé, surfaces à préciser, légende des familles
    diagram.js        diagrammes à l'échelle et barre d'échelle
    schema.js         schéma fonctionnel
    render.js         rendu des panneaux et du récapitulatif (aiguillage par onglet)
    tooltip.js        infobulle
  plan/               plan interactif
    rooms.js          pièces issues du programme + adjacences
    links.js          calque des adjacences et compteur
    levels.js         niveaux, plateau, emprises, barre d'étages, bac « à placer »
    niv.js            règles de niveau (sous-sol, lumière, sanitaires)
    plans.js          plans mémorisés
    distribute.js     répartition du programme sur les étages
    areas.js          surfaces « à préciser » saisies par l'utilisateur, postes liés
    editor.js         canevas, sélection, propriétés, rangement, pointeur, annulation
    store.js          persistance (localStorage)
  vol/volumes.js      onglet Volumes : implantation, lien au plan, plan et axonométrie
  main.js             câblage des barres de contrôle et premier rendu
```

## Où modifier quoi

- **Le programme** (surfaces, nombres, familles, notes) : `src/data/program.js` seul. Tous les
  totaux, diagrammes, listes, pièces du plan et volumes en découlent.
- **Les familles et leurs couleurs** : `src/data/families.js` pour les libellés, `styles/tokens.css`
  pour les valeurs (`--f-cla`, `--f-eau`, …). Les deux fichiers sont liés par l'id de famille.
- **Un onglet** : ajouter une entrée dans `SEGMENTS` (`src/main.js`), un bouton dans `index.html`
  et une branche dans `render()` (`src/views/render.js`).
- **L'état de vue** : `src/core/viewstate.js` (`view.grouping`, `view.mode`) — lu partout, écrit
  seulement par les barres de contrôle.

Règle du projet : chaque état mutable appartient à un seul module ; les autres le lisent par
import et passent par une fonction exportée pour le modifier (`setCurFloor`, `toggleLinks`,
`setStray`, `applyLevels`…).
