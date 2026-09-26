# Centre scolaire de Saxon — mémoire du projet

Outil d'aide à la conception pour le concours du nouveau centre scolaire de Saxon (VS).
HTML + CSS + modules ES, **aucun build, aucune dépendance**.

```bash
python3 -m http.server 8000     # puis http://localhost:8000
```

`README.md` fait foi pour les règles de dessin, de style et d'architecture logicielle. Ce
fichier-ci retient **les décisions du projet** et **où elles vivent dans le code**. Le détail
d'un onglet est dans `docs/` — **lis le fichier de l'onglet avant d'y toucher.**

| pour | lire |
|---|---|
| les contraintes du règlement, le schéma des adjacences | `docs/concours.md` |
| ce que le règlement ne dit pas, et que les générateurs appliquent | `docs/doctrine.md` |
| l'onglet Programme mixer | `docs/mixer.md` |
| l'onglet Massing | `docs/massing.md` |
| les variantes partagées, le compte, le groupe, la base | `docs/variantes.md` |
| le relevé du géomètre et sa regénération | `docs/releve.md` |

---

## Travailler à plusieurs

Le dépôt a une forme très particulière — **une source unique par décision** — donc deux
personnes qui traitent la même question touchent forcément le même fichier. La méthode existe
pour éviter ça, pas pour faire joli.

### Les branches

Travailler directement sur `main` est **permis** — une correction courte, une note, un réglage.

**Par défaut, on ouvre une branche**, nommée `prénom/sujet` :

```
louis/amelioration-3D
chiara/typologie
louis/note-massing
```

Le prénom dit qui, le sujet dit quoi. D'autres personnes s'ajoutent de la même façon.

**Chaque nouvelle session repart de `main` à neuf.** Une session cloud clone à neuf : elle ne
voit que ce qui est sur `main`. Une branche qui vit trois jours est une branche que l'autre ne
connaît pas, sur des fichiers de mille lignes.

- une session = une branche = une PR, mergée dans la journée ;
- la branche mergée se supprime ;
- si la session impose son propre nom de branche, on la renomme ou on la merge vite.

### Se partager le travail

Par **onglet**, pas par fichier — le découpage existe déjà.

| domaine | fichiers | conflit avec l'autre |
|---|---|---|
| Mixer | `src/mix/*`, `views/mixer.js` | quasi nul |
| Massing | `src/mass/*`, `views/massing.js`, `plan.js`, `vue3d.js` | quasi nul |
| Variantes | `src/net/*`, `views/variantes.js`, la base | quasi nul |
| Typologie (à construire) | `src/typo/*` | nul |
| Données | `program.js`, `rules.js`, `doctrine.js`, `schema.js` | **garanti** |

`mass/gen.js` et `views/mixer.js` sont les deux gros morceaux : jamais les deux en parallèle
sur le même.

**Les fichiers de données se touchent seul, en un commit à part, mergé tout de suite.**
`doctrine.js` et `rules.js` sont lus par les deux générateurs — c'est leur raison d'être, et
c'est ce qui les rend explosifs. Ajouter une clé prend deux minutes ; le faire dans une branche
de trois jours donne un conflit que personne ne saura arbitrer.

**`src/data/site.js` ne se résout jamais à la main** — 208 Ko engendrés. En cas de conflit :
`git checkout --ours src/data/site.js` puis `python3 tools/extract-site.py`. Le script fait foi,
pas le fichier.

**`CLAUDE.md` et `docs/` : on n'écrit que dans la section de son onglet**, en dernier commit,
isolé. Sans quoi le conflit est garanti et illisible.

---

## Les onglets sont une chronologie

```
Cahier des charges  →  Programme mixer  →  Massing  →  Typologie
surfaces et             répartition du      volumétrie  plans et
contraintes             programme sur       sur le site coupes
                        les niveaux
```

Chaque onglet se sert de ce que le précédent a décidé. L'ancien ordre faisait l'inverse :
l'onglet Site venait après le Plan, donc la typologie décidait du volume.

Trois onglets existent ; seule la **Typologie** reste à construire.

**Les variantes ne sont PAS un onglet.** Une variante enregistre l'état du projet
sous un nom et le recharge à l'identique : elle TRAVERSE les trois onglets au lieu
d'en être une étape. Son bouton vit donc à côté du compte, hors du groupe de
destinations, et ouvre un panneau posé par-dessus. Voir `docs/variantes.md`. `src/vol/`, qui gardait
dormants un générateur de volumétrie et une scène 3D, a été RETIRÉ quand le Massing a été
construit : le garder aurait fait deux générateurs pour une seule question. Ce qui en valait la
peine est repris dans `src/mass/` et `src/views/vue3d.js` ; `src/core/gl.js`, qui ne parle pas
d'architecture, est resté où il était.

**Chaque onglet a ses volets**, et chacun garde le sien (`view.subs`, `SUBS_BY` dans
`src/core/viewstate.js`) :

| onglet | volets |
|---|---|
| Cahier des charges | Surfaces · Contraintes |
| Programme mixer | Répartition · **Contraintes** |
| Massing | Volumétrie · **Contraintes** |

Les deux volets « Contraintes » des OUTILS sont d'une autre nature que celui du cahier des
charges : là on lit ce que le RÈGLEMENT impose, ici on lit — et l'on RÈGLE — ce que NOUS avons
arbitré (`docs/doctrine.md`).

URL : `#<onglet>/<volet>`, et `#programme/surfaces/<chap|fam>` pour le seul volet qui a un
regroupement. Les liens qui ont circulé — `#adjacences`, `#programme/adjacences`,
`#programme/fam` — restent valables. Un volet s'ajoute dans `SUBS_BY` plus une branche dans
`render()` ; le bouton, l'ARIA et le routage suivent tout seuls. Le volet d'un onglet se nomme
TOUJOURS avec son onglet (`setSub(id, tab)`) : deux onglets ont un volet « contraintes », et le
régler sans dire où ne faisait rien.

---

## Règle première : les surfaces sont fixes

Le règlement chiffre chaque local. **Une surface de programme ne se change pas.** On change les
*proportions* d'une pièce ou d'un volume — largeur × hauteur, à surface exacte — jamais les m².

- Source unique : `src/data/program.js` (`CHAP`). Rien d'autre ne les redit ni ne les recalcule.
- Proportions admissibles à surface exacte : `src/core/geometry.js` — `validDims`, `nearestDims`,
  `squarest` (grille au demi-mètre, repli au décimètre).
- Huit postes que le règlement laisse « selon projet » sont **à préciser** (`est:1`), saisissables
  dans le cahier des charges. Programme chiffré 6'489 m², total vivant 7'025 m².

Totaux par chapitre (m² nets) : école 2'616 · sport 1'751 · UAPE 316 · technique 942 ·
infrastructures 900 · extérieurs 500. **Bâti scolaire** = les quatre premiers, 5'625 m².

## Règle seconde : la circulation est une part de la surface BÂTIE

Elle n'est chiffrée nulle part au règlement : c'est une hypothèse de projet, et elle vaut plus de
mille mètres carrés.

```
bâti = utile / (1 − part)        circulation = bâti − utile
```

Une part de 0,18 ajoute donc **22 %** à la surface utile, et non 18 %. Elle ne porte que sur le
**bâti scolaire** — les quatre premiers chapitres ; la piscine, le chauffage à distance, la cour
et son préau n'ont pas de couloirs à nous.

Elle se règle **dans le cahier des charges, volet Surfaces, et là seulement** ; tous les onglets
suivants la lisent.

- Valeur par défaut et bornes : `RULES.circ` dans `src/data/rules.js`.
- Valeur vivante `CIRC` et les m² qui en découlent (`CIRCA` / `BUILTG` / `GRANDG`) :
  `src/core/model.js` seul. `setCirc()` est le seul écrivain.
- **Elle se répartit sur les chapitres et les familles** au prorata de ce qu'ils pèsent dans le
  bâti scolaire — `ch.circ` / `ch.gross`, `f.circ` / `f.gross`, calculés dans `recompute()` et
  nulle part ailleurs. Les parts se resomment exactement à `CIRCA`. Le volet Surfaces affiche le
  BÂTI de chaque chapitre, la décomposition à côté, et dessine la circulation **à l'échelle** :
  un bloc hachuré, sans couleur de famille.

> Elle se réglait auparavant dans DEUX outils, sous le même mot et avec deux arithmétiques
> opposées : 15 % ajoutés à l'utile dans le générateur de volumétrie, 18 % du bâti dans le plan.
> L'écart valait 200 m².

## Règle troisième : une source par décision

Une valeur qui n'est ni dans `rules.js` ni dans `doctrine.js` est un nombre écrit en dur, et
c'est un défaut.

---

## Où modifier quoi

- **Une surface, un nombre, une famille, une note** : `src/data/program.js` seul.
- **Une contrainte du concours** : `src/data/rules.js` seul — la section Contraintes, les règles
  de niveau et le contrôle en découlent.
- **Un seuil, un plafond, un poids de génération** : `src/data/doctrine.js` seul — voir
  `docs/doctrine.md` pour la forme d'une règle.
- **Une adjacence** : `src/data/schema.js` seul — le lien, le pôle du nœud, et les postes qu'il
  désigne (`nd.k`). Ni surface ni coordonnée : la surface se lit dans `program.js` par cette
  table, la géométrie est déduite par la vue. `LIENS_ORPHELINS` signale tout nom de poste qui ne
  correspond plus.
- **Un remède d'alerte** : `src/mix/fix.js` ou `src/mass/fix.js` seul, nommé dans le `checks.js`
  voisin, à côté de la règle qu'il répare. La mécanique qu'il rejoue reste dans `gen.js`.
- **Les familles et leurs couleurs** : `src/data/families.js` + `styles/tokens.css`.
- **Le relevé du géomètre** : `src/data/site.js`, engendré — voir `docs/releve.md`.
- **L'état qui survit à un rechargement** : `snapshot()` / `restore()` dans
  `src/mix/store.js` seuls. Un seul objet dit ce qu'est « l'état du projet », et
  deux choses le lisent — l'enregistrement local et une variante partagée. Les
  séparer ferait deux vérités.
- **L'adresse de la base ou sa clé** : `src/data/supabase.js` seul. La clé
  `service_role` n'entre JAMAIS dans le dépôt.
- **Une valeur de dessin** : `styles/tokens.css`, et nulle part ailleurs. WebGL ne sait pas lire
  `var(--f-cla)` : `cssRGB()` fait résoudre le token par le navigateur et le garde en cache tant
  que le thème ne change pas.

---

## Vérifier

Aucun test automatisé. Ces trois snapshots en tiennent lieu — **à jouer avant tout push**, et
surtout après une résolution de conflit.

La répartition :

```bash
node --input-type=module -e "
Promise.all([import('./src/mix/floors.js'),import('./src/mix/shuffle.js'),
             import('./src/mix/checks.js'),import('./src/mix/prog.js')]).then(([F,S,C,P])=>{
  console.log('liens orphelins :', P.LIENS_ORPHELINS);
  S.repartir({ alea:false, etages:true });
  F.FLOORS.forEach(function(f,i){
    console.log(F.flName(i), Math.round(F.flNet(i)) + '/' + Math.round(F.usable(i)) + ' m²',
                F.flCount(i) + ' pièces', 'h=' + F.flHeight(i));
  });
  console.log('bac :', Math.round(F.trayArea()), 'm²');
  console.log('verdict :', JSON.stringify(C.mixVerdict(C.mixCheck())));
});"
```

La volumétrie — le générateur, le bilan de surface et le contrôle, sur les douze partis :

```bash
node --input-type=module -e "
Promise.all([import('./src/mix/shuffle.js'),import('./src/mass/gen.js'),
             import('./src/mass/model.js'),import('./src/mass/checks.js')]).then(([S,G,M,C])=>{
  S.repartir({ alea:false, etages:true });
  ['auto','compact','barre','barres','L','U','cour','pavillons','hameau',
   'terrasses','peigne','libre'].forEach(function(p){
    M.massSet('parti', p);
    M.massVols(G.genMass(11));
    var b = M.bilanTotal();
    console.log(p, M.MASS.vol.length + ' corps',
      'demandé ' + Math.round(b.demande) + ' · posé ' + Math.round(b.pose),
      JSON.stringify(C.massVerdict(C.massCheck())));
  });
});"
```

Ce que le juge dit de la composition retenue — chaque critère, son état et son score de
lecture (le générateur choisit par la hiérarchie, pas par la note) :

```bash
node --input-type=module -e "
Promise.all([import('./src/mix/shuffle.js'),import('./src/mass/gen.js'),
             import('./src/mass/model.js'),import('./src/mass/juge.js')]).then(([S,G,M,J])=>{
  S.repartir({ alea:false, etages:true });
  M.massSet('parti','auto');
  M.massVols(G.genMass(11));
  var j = J.jugementCourant(), N = ['défavorable','neutre','favorable'];
  console.log('parti', M.MASS.vol.parti, '· note', j.total);
  j.crit.forEach(function(c){
    console.log(c.n.padEnd(40), N[c.niv].padEnd(12), (c.pts > 0 ? '+' : '') + c.pts);
  });
});"
```
