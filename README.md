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
⚙  Paramètres & contraintes      le cadre, hors chronologie
01 Cahier des charges            surfaces, contraintes, adjacences
02 Forensics                     le moodboard du groupe
03 Programme mixer               répartition du programme sur les niveaux
04 Massing                       volumétrie sur le site
05 Typologies                    plans et coupes          ┐
06 Tectonics                     la construction          │ à construire
07 Materiality                   les matériaux            │
08 Rendu                         les planches du concours ┘
```

L'ancien ordre faisait l'inverse : l'onglet Site venait APRÈS le Plan, donc on dessinait
la typologie d'un niveau avant d'avoir choisi le volume. Les quatre derniers onglets
existent, vides : ils disent où chaque chose viendra.

Les onglets vivent dans une **barre latérale, « Atelier et outils »**, une ligne par
onglet, son numéro devant. Le bouton qui l'ouvre est à gauche de la barre du haut ; elle
**pousse** le contenu (le plan et la 3D se recadrent au lieu d'être recouverts), et se
pose par-dessus sur un écran étroit. Elle retient son état dans les préférences du
compte. **Paramètres & contraintes** n'a pas de numéro mais une icône : il n'est pas une
étape, il est le cadre — voir `docs/parametres.md`.

Les vues sont **de deux natures** : des *documents*, qu'on lit, et des *outils*, qu'on
opère. `document.body.dataset.kind` commute la mise en page :

| gabarit | vues | mise en page |
|---|---|---|
| `doc` | Paramètres & contraintes, Cahier des charges | colonne de lecture de 960 px, centrée dans la place que laisse la barre latérale |
| `tool` | Forensics, Programme mixer, Massing, et les onglets à construire | cadre plein, l'outil occupe la fenêtre |

Le chrome permanent (`.appbar`, collant, ~52 px) a trois zones : à gauche le bouton de la
barre « Atelier et outils » ; au centre le nom du projet et le total vivant ; à droite ce
qui traverse tous les onglets — les variantes, le compte, le thème. **Tout contenu
éditorial appartient à la vue qu'il décrit** : le compteur des surfaces à préciser a
quitté le chrome, il se lit dans le volet Surfaces.

La vue courante est dans le fragment d'URL (`#mixer/repartition`, `#mixer/contraintes`,
`#massing/volumetrie`, `#programme/surfaces/fam`, `#parametres`, `#forensics`,
`#typologie`, `#tectonique`, `#materialite`, `#rendu`) : rechargeable et
partageable. L'identifiant de l'onglet reste `programme` ; les formes qui ont circulé avant
— `#adjacences`, `#programme/adjacences` et `#programme/fam` — restent valables et mènent au
volet qui les porte.

### Chaque onglet a ses volets, et les deux outils ont le leur

Le cahier des charges avait seul des volets. Les deux outils en ont désormais deux : ce
qu'ils **font**, et les **contraintes** qui gouvernent ce qu'ils font.

| onglet | volets |
|---|---|
| Cahier des charges | Surfaces · Contraintes · Adjacences |
| Programme mixer | Répartition · Contraintes |
| Massing | Volumétrie · Contraintes |

Les deux volets « Contraintes » des outils sont d'une autre nature que celui du cahier des
charges : là on lit ce que le **règlement** impose ; ici, c'est la page **Paramètres &
contraintes** filtrée sur l'onglet — chaque ligne qui y agit, son rôle (levier, cadre,
orientation, jugement), son tag de force, et ce qu'elle dit de la composition à l'écran. C'est
la réponse à « pourquoi obtient-on ce résultat », et c'est là qu'on le corrige.

Deux moteurs : la **recherche** produit les variantes (leviers, cadre, orientation), le
**jugement** les note comme le jury, par leurs seules mesures. Voir `docs/parametres.md`.

### Le cahier des charges, en trois volets

Ce sont trois lectures du même règlement, pas trois étapes ; la chronologie du concours
est dans les onglets, pas ici.

1. **Surfaces** — le programme des locaux, les huit postes « à préciser » et **la largeur
   du couloir**, saisissables sur place. Volet d'ouverture, et le seul où l'on saisit
   quelque chose. Le programme s'y lit en **nomenclature** : un tableau, un ensemble par
   groupe de lignes — son bâti, ses postes, ses pièces, programme et circulation —, et en
   marge de chaque poste un carré **à l'échelle commune**, ou un carré par pièce. La
   circulation a sa ligne hachurée dans chaque ensemble ; elle se déduit des pièces (voir
   `CLAUDE.md`, règle seconde).
2. **Contraintes** — site, hauteurs libres, protection incendie, parasismique, mobilité,
   second temps, tout lu dans `src/data/rules.js`.
3. **Adjacences** — le **schéma fonctionnel**, une carte par grappe, rangées en cascade à la
   même échelle. Le schéma est **en mètres** : un local vaut sa surface dans ses deux
   côtés, et porte les cotes que le règlement impose quand il en donne. Ce que le mixer en
   tient — quelle adjacence est active — se décide au mixer.

### L'onglet Programme mixer

Il prend les surfaces et les organise sur des niveaux. Rien d'autre.

- Une pile de niveaux, du sous-sol le plus profond au dernier étage, **dessinée comme une
  coupe** : le plus haut en tête, le sol en bas. Par défaut, un seul rez-de-chaussée.
- Un niveau est dessiné **à l'échelle des surfaces** : chaque bloc occupe la part de m²
  qu'il occupe dans le programme (pavage squarifié, `src/core/treemap.js`). La ligne de
  plateau dit ce qui tient ; la bande qui la dépasse dit ce qui ne tient pas.
- Ce qui ne pèse pas sur le plateau — cour, piscine, chauffage à distance — a sa propre
  bande, sous un filet, hors du compte.
- **Shuffle** tire une répartition ; une **seed** la rend rejouable à l'identique.
  Le nombre de niveaux a son **dé**, sur la pile : allumé, le Shuffle décide ; éteint,
  la valeur est la nôtre. Le plateau se déduit de la pile ; le lien d'un poste se règle
  sur son bloc.
- Un poste est **lié** — un bloc, ses pièces ensemble à un seul niveau — ou **délié** —
  ses pièces indépendantes, dessinées séparées. Une **adjacence exigée** met ses deux
  postes au même niveau — c'est du cadre : rompue, le massing ne propose aucun volume.
- On glisse un bloc d'un niveau à l'autre, et avec lui ce que ses adjacences exigées lui
  tiennent au même niveau ; on tire une pièce d'un poste délié pour la scinder. Deux parts
  d'un même poste qui se retrouvent au même niveau se refondent. Au clavier, sur le bloc au
  foyer : flèches haut et bas pour changer de niveau, Maj pour n'emmener qu'une pièce,
  Suppr pour le renvoyer au bac.

## Structure

```
index.html            la coquille seule : barre d'application, barre latérale, #panels, #tip
styles/
  tokens.css          SOURCE UNIQUE de toute valeur de dessin — trois couches, voir plus bas
  themes/             les thèmes installés, au format shadcn/ui (neutral.css…)
  base.css            corps de page, [hidden], l'anneau de focus unique, infobulle
  appbar.css          chrome permanent, barre latérale, menu du thème, les deux gabarits
  controls.css        LE bouton, LE groupe de boutons, LA pastille de verdict
  program.css         panneaux, nomenclature, contraintes, rangs de section, récapitulatif
  schema.css          adjacences : cartes des grappes, en cascade
  mixer.css           le mixer : pile, canevas d'un niveau, blocs, pièces, bac
  massing.css         le massing : rail, plan et 3D, alertes
  variantes.css       le panneau des variantes et le modal de leurs informations
  parametres.css      Paramètres & contraintes, et les volets Contraintes des outils
  forensics.css       l'onglet Forensics : la toile et ses cartes
src/
  data/               données pures, sans logique
    families.js       familles d'usage (id, couleur, libellé)        ← source unique
    program.js        programme des locaux, chapitre 2.10             ← source unique
    schema.js         nœuds, pôles et liens des adjacences            ← source unique
                      ni surface ni coordonnée : le nœud dit quels postes il désigne
    site.js           périmètre du concours, terrain, nappe phréatique — relevé seul
    rules.js          contraintes du concours : distances, hauteurs libres, feu,
                      nappe, stationnement, circulation, second temps ← source unique
    supabase.js       l'adresse de la base et sa clé PUBLIABLE      ← source unique
    themes.js         les thèmes installés et les trois modes            ← source unique
    lignes.js         LE SCHÉMA DES LIGNES — rôles, tags, onglets, sources, qui règle —
                      et le magasin `V` que lisent les moteurs   ← source unique
    leviers.js        LEVIERS : ce qu'on fait varier, leurs domaines
    cadre.js          CADRE : opposable et choisi, les règles de niveau (`NIV`)
    orientation.js    ORIENTATION : nos intentions, leurs cibles et leurs points
    jugement.js       JUGEMENT : les six axes du règlement, les critères, la note
    recherche.js      GÉNÉRATEUR : essais, part du hasard, seeds
    donnees.js        DONNÉES : nos hypothèses, le catalogue des mesures
  core/
    viewstate.js      view.tab / view.subs (un volet par onglet) / group / mode
                      + routage par hash
    model.js          totaux dérivés du programme, surfaces saisies, PART DE CIRCULATION
    format.js         fmt / dec / el / slug / arrondis
    svg.js            fabrique d'éléments SVG
    geometry.js       surfaces → blocs, empilage, proportions admissibles
    treemap.js        pavage squarifié — un bloc vaut sa surface
    rand.js           tirage reproductible à seed (mulberry32)
    empreinte.js      l'empreinte des fichiers du dépôt — dit qu'une variante a vieilli
    gl.js             WebGL minimal : matrices, programme, tampons (dont statiques), caméra
  mix/                répartir le programme sur les niveaux
    prog.js           le programme vu comme des parts à poser, adjacences par poste
    niv.js            la mécanique des règles de niveau, cotes admissibles par poste
    mesures.js        les mesures brutes d'une répartition, pour le jugement
    floors.js         la pile de niveaux, les parts posées, déplacer / scinder
    shuffle.js        répartition ordonnée, tirage, proposition de pile
    checks.js         contrôle d'une répartition → écarts, avec leur code et leurs remèdes
    fix.js            les remèdes : déplacer, vider, agrandir un plateau, poser un WC
    accept.js         les écarts qu'on assume — « laisser comme ça »
    opts.js           les réglages : la pile et son dé, le lien des postes, les
                      cotes ; les adjacences exigées, toujours actives
    store.js          persistance : surfaces précisées, circulation, pile, répartition,
                      écarts assumés
  mass/               poser le programme en volumes, sur le terrain relevé
    geom.js           terrain interpolé, rectangles tournés, distances, alignements
    model.js          l'état du massing, les niveaux relus du mixer, le bilan de surface
    gen.js            le générateur : leviers → cadre → orientation → jugement
    mesures.js        ce qu'on lit sur une volumétrie : écarts au cadre, qualités, mesures
    checks.js         contrôle d'une volumétrie → alertes info / à vérifier / erreur
    etat.js           ce que le massing enregistre (lu par mix/store.js)
  net/                le partage — `fetch` seul, aucune dépendance
    supa.js           jeton, session, requêtes REST
    compte.js         l'identité, l'équipe, ses membres
    reglages.js       les décisions de projet partagées au groupe
    variantes.js      poser, lister, charger, supprimer, rejouer une variante
    recherche.js      la recherche automatique — tirer beaucoup, garder peu
    prefs.js          les préférences du compte : thème, mode, tri et filtre, barre
    forensics.js      la planche du groupe, ses images au stockage
  views/
    render.js         aiguillage par onglet, cahier des charges, récapitulatif, sources
    legend.js         chrome (total, compteur), chapô, surfaces à préciser, légende
    constraints.js    la section Contraintes du cahier des charges, lue dans rules.js
    diagram.js        barre d'échelle, trames de hachure
    schema.js         schéma fonctionnel : une carte par grappe rayonnante, locaux à
                      l'échelle
    mixer.js          l'onglet Programme mixer
    massing.js        l'onglet Massing : rail de commandes, plan et 3D côte à côte
    plan.js           la vue en plan : relevé, volumes, sélection, déplacement, rotation
    vue3d.js          la vue 3D : terrain maillé, courbes drapées, existant, volumes
    variantes.js      le panneau des variantes, et le modal de leurs informations
    parametres.js     Paramètres & contraintes : tout ce qui influe sur une variante,
                      classé — et les volets Contraintes du mixer et du massing
    note.js           la note d'un bâtiment, axe par axe, et ses notes manuelles
    forensics.js      Forensics : la toile, les cartes, les gestes
    icons.js          le jeu d'icônes, au trait
    tooltip.js        infobulle
  main.js             thème et mode, barre latérale, onglets, routage, premier rendu
Design-1.2.0-v38/     le plugin « Design » d'Anthropic, déposé ici pour servir de grille
                      d'audit (design-system, design-critique, ux-copy, a11y)
```

## Règles du projet

**Aucune valeur de dessin hors de `tokens.css` et des fichiers de thème.** Ni couleur, ni
espace, ni taille, ni rayon, ni ombre, ni durée. Les seules exceptions légitimes sont les
géométries calculées et posées en ligne par le JS — la position et la taille d'un bloc du
mixer, une carte de Forensics, la hauteur d'un canevas —, qui sont des surfaces à
l'échelle et pas des choix de style.

**Trois couches de tokens, et chacune ne lit que celle du dessus.**

1. **Le thème** — les noms de shadcn/ui, tels quels : `--background`, `--foreground`,
   `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`,
   `--destructive`, `--border`, `--input`, `--ring`, `--chart-*`, `--sidebar-*`,
   `--radius`, `--font-*`, `--shadow-*`, `--spacing`. Le thème d'origine, **Saxon**, est
   posé sur `:root` ; un thème installé ne redéfinit que ces noms.
2. **Les dérivés** — ce que l'app nomme et que shadcn n'a pas, CALCULÉ depuis la couche 1
   (`color-mix`, `calc`) : `--soft-foreground` (texte secondaire), `--faint-foreground`
   (non textuel), `--border-soft`, `--border-strong`, `--grid`, `--card-veil`, les rayons
   `--radius-sm/md/lg/xl`, les pas `--s-1…8`.
3. **L'application** — ce qu'aucun thème ne touche parce que cela porte une information :
   les huit familles, les couches du relevé, `--warn`, `--ok`, les aplats `--*-fill`,
   l'échelle typographique. Elles ne dépendent que du mode.

**Le thème et le mode sont deux choix** : `data-theme` (absent = Saxon) et `data-mode`
(absent = suivre le système) sur `<html>`, posés par `main.js` depuis les préférences du
compte. Une liste déroulante dans la barre les propose, lue dans `src/data/themes.js`.
Elle, les listes de Paramètres et le tri des variantes sont un seul déroulant,
`src/views/menu.js` : il s'ouvre en pop, une pastille glisse sous la ligne visée, une ligne
par choix. Il n'y a plus de `<select>` natif dans l'application ; une nouvelle liste de
choix passe par ce déroulant (`menu--gauche` l'aligne sous le début de son bouton).

**Installer un thème shadcn** (ui.shadcn.com/themes, tweakcn.com) : copier
`styles/themes/neutral.css`, y coller son bloc `:root` et son bloc `.dark` aux trois
places, ajouter une ligne à `src/data/themes.js`. La feuille se charge à la demande.

**Les trois blocs de mode, dans cet ordre, sans exception** — pour Saxon comme pour
chaque fichier de thème. Le bloc clair *complet* d'abord — tout token y naît. Puis
`@media (prefers-color-scheme: dark)` gardé par `:not([data-mode="light"])`, puis
`[data-mode="dark"]`. Un token défini seulement dans un bloc sombre n'existe pas pour le
visiteur qui n'a rien choisi : c'est le bug classique du thème illisible.

WebGL ne sait pas lire `var(--f-cla)` : `cssRGB()` fait résoudre le token par le
navigateur et le ramène à trois octets par un canevas — un thème écrit en `oklch()`, les
dérivés sont des `color-mix()`, et seule une conversion par le navigateur les lit tous.

**Les couleurs de famille d'usage ne servent jamais d'état.** `--destructive`, `--warn`,
`--ok` et `--ring` existent pour ça.

**La couleur n'est jamais seule à porter une information.** Huit teintes catégorielles ne
peuvent pas être distinguées deux à deux. Partout un libellé, une infobulle, une pastille
ou la hachure accompagne la couleur. Le technique est hachuré, comme en dessin
d'architecture.

**Un composant, un rôle.** `.btn` et `.btn-group`. Le projet a compté jusqu'à sept boutons
concurrents dont la divergence n'était pas intentionnelle.

**Un concept, un mot.** Les huit postes que le règlement ne chiffre pas sont « à préciser »
— partout, et « fixée » une fois la valeur donnée. Les postes mentionnés mais jamais
comptés sont « hors bilan ». La circulation **se déduit des pièces**, une seule fois, dans
un seul module : elle se réglait dans deux onglets, sous le même mot, avec deux
arithmétiques opposées — 15 % ajoutés à l'utile d'un côté, 18 % du bâti de l'autre. La
**seed** est la seed, partout dans l'interface : le mot « graine » n'y figure plus.

**Les surfaces du programme sont fixes.** On change les proportions d'une pièce ou d'un
volume — à surface exacte, `validDims` — jamais ses m². Le mixer déduit ses parts du
programme ; il ne les réécrit pas.

**Une proposition hors règles est autorisée, jamais silencieuse.** `src/mix/checks.js` la
dit : rouge pour une règle écrite au règlement ou à l'AEAI, ambre pour une règle de projet
ou une marge qui se discute. Le plateau, le nombre de niveaux et la circulation sont des
choix de projet : leur dépassement est ambre. Une adjacence exigée qui ne tient pas est
rouge : c'est une exigence du règlement. Rien n'est
empêché.

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
  les totaux, la nomenclature, les cartes et les parts du mixer en découlent.
- **Les contraintes du concours** (distances, hauteurs libres, protection incendie, nappe,
  stationnement, largeur de couloir par défaut, budget) : `src/data/rules.js` seul. La
  section Contraintes et le contrôle en découlent ; les règles de niveau sont des lignes du
  cadre (`src/data/cadre.js — NIV`), avec leur tag.
  `src/data/site.js` ne porte que du relevé.
- **Les adjacences** : `src/data/schema.js` seul. `src/mix/prog.js` ne fait que dire quel
  nœud du schéma correspond à quel poste du programme, et le signale si un nom change.
- **Les familles et leurs couleurs** : `src/data/families.js` pour les libellés,
  `styles/tokens.css` pour les valeurs. Les deux fichiers sont liés par l'id de famille.
- **Un volet** : une entrée dans `SUBS_BY` (`src/core/viewstate.js`) et une branche dans
  `render()`. Le bouton et le routage par hash suivent tout seuls.
- **Un réglage du mixer et son dé** : `src/mix/opts.js` seul ; le tirage le lit dans
  `shuffle.js`, la vue le montre là où il se voit.
- **Un onglet** : ajouter une entrée dans `TABS` (`src/core/viewstate.js`) — son numéro
  `n` ou son icône — et une branche dans `render()` (`src/views/render.js`). La ligne de
  la barre latérale, l'ARIA et le routage suivent tout seuls.
- **Un thème** : un fichier dans `styles/themes/`, une ligne dans `src/data/themes.js`.
- **Une préférence de la personne** (qui ne change aucune variante) : une clé dans
  `PREFS` (`src/net/prefs.js`), écrite par `setPref()`.
- **L'état de vue** : `src/core/viewstate.js` — lu partout, écrit seulement par `main.js`.

Règle du projet : chaque état mutable appartient à un seul module ; les autres le lisent
par import et passent par une fonction exportée pour le modifier (`setItemArea`, `setCirc`,
`move`, `split`, `setPlate`, `setStack`, `repartir`…).
