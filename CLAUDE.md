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
| ce qui influe sur une variante : leviers, cadre, orientation, jugement — le système | `docs/parametres.md` |
| l'onglet Programme mixer | `docs/mixer.md` |
| l'onglet Massing | `docs/massing.md` |
| l'onglet Typologies | `docs/typologies.md` |
| les variantes partagées, le compte, le groupe, la base | `docs/variantes.md` |
| le relevé du géomètre et sa regénération | `docs/releve.md` |
| l'onglet Forensics, sa table et son stockage | `docs/forensics.md` |
| l'onglet Rendu, ses planches PDF | `docs/rendu.md` |
| les tokens, les thèmes shadcn, le mode | `README.md` — *Règles du projet* |

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

### Le déroulé d'une tâche

Plusieurs sessions tournent en parallèle, en local comme dans le cloud, et **tout changement
fini doit se voir sur le site en ligne** — donc finir veut dire : sur `main`.

1. **Avant de commencer** — si la demande est ambiguë, on pose la question jusqu'à ce qu'elle
   soit claire. Pas une ligne avant.
2. **Partir d'un `main` à jour** — `git fetch origin main`, puis
   `git checkout -b prénom/sujet origin/main`.
3. **Travailler**, en s'aidant des plugins et skills utiles à la tâche.
   Les plugins du projet sont déclarés dans `.claude/settings.json`, les skills copiés
   dans `.claude/skills/` — toute session, locale ou cloud, les reçoit.
4. **Vérifier** — il n'y a pas de build : les trois snapshots de la section *Vérifier* en
   tiennent lieu. S'ils ne passent pas, on ne va pas plus loin.
5. **Commiter, puis se rebaser sur le dernier `main`** — `git fetch origin main`,
   `git rebase origin/main`, résoudre les conflits (`site.js` : voir plus haut), **rejouer les
   snapshots** après toute résolution.
6. **Pousser et merger dans `main`** — la tâche n'est finie que là.

**Ne jamais perdre de travail** : une branche qui porte des commits non mergés ne se supprime
pas — ni en local, ni sur `origin`. Seule une branche entièrement mergée s'efface.

### Se partager le travail

Par **onglet**, pas par fichier — le découpage existe déjà.

| domaine | fichiers | conflit avec l'autre |
|---|---|---|
| Mixer | `src/mix/*`, `views/mixer.js` | quasi nul |
| Massing | `src/mass/*`, `views/massing.js`, `plan.js`, `vue3d.js` | quasi nul |
| Variantes | `src/net/*`, `views/variantes.js`, la base | quasi nul |
| Forensics | `views/forensics.js`, `net/forensics.js`, `styles/forensics.css` | nul |
| Paramètres | `views/parametres.js` — il LIT tout, n'écrit que par les fonctions existantes | faible |
| Jugement | `data/jugement.js` — axes, critères, poids par défaut | faible |
| Chrome et thèmes | `index.html`, `main.js`, `styles/tokens.css`, `styles/themes/*`, `data/themes.js` | **fort** : tout le CSS lit les tokens |
| Typologie (à construire) | `src/typo/*` | nul |
| Données | `program.js`, `rules.js`, `schema.js`, et les lignes : `lignes.js`, `leviers.js`, `cadre.js`, `orientation.js`, `recherche.js`, `donnees.js` | **garanti** |

`mass/gen.js` et `views/mixer.js` sont les deux gros morceaux : jamais les deux en parallèle
sur le même.

**Les fichiers de données se touchent seul, en un commit à part, mergé tout de suite.**
Les fichiers de lignes et `rules.js` sont lus par les deux générateurs — c'est leur raison
d'être, et c'est ce qui les rend explosifs. Ajouter une clé prend deux minutes ; le faire dans une branche
de trois jours donne un conflit que personne ne saura arbitrer.

**`src/data/site.js` ne se résout jamais à la main** — 208 Ko engendrés. En cas de conflit :
`git checkout --ours src/data/site.js` puis `python3 tools/extract-site.py`. Le script fait foi,
pas le fichier.

**`CLAUDE.md` et `docs/` : on n'écrit que dans la section de son onglet**, en dernier commit,
isolé. Sans quoi le conflit est garanti et illisible.

---

## Les onglets sont une chronologie

```
⚙  Paramètres & contraintes   le cadre — hors chronologie, une icône et pas de numéro
01 Cahier des charges         surfaces et contraintes
02 Forensics                  le moodboard du groupe
03 Programme mixer            répartition du programme sur les niveaux
04 Massing                    volumétrie sur le site
05 Typologies · 06 Tectonics · 07 Materiality                  à construire
08 Rendu                      les planches PDF de chaque étape — le massing seul, pour l'instant
```

Chaque onglet se sert de ce que le précédent a décidé. L'ancien ordre faisait l'inverse :
l'onglet Site venait après le Plan, donc la typologie décidait du volume.

Les onglets vivent dans la **barre latérale « Atelier et outils »**, une ligne numérotée
par onglet, tirée de `TABS` (`src/core/viewstate.js`) ; elle pousse le contenu, et son
bouton est à gauche de la barre du haut. Le titre et le total vivant sont au centre. Les
quatre derniers onglets sont vides, à construire.

**Les variantes ne sont PAS un onglet.** Une variante enregistre l'état du projet
sous un nom et le recharge à l'identique : elle TRAVERSE les onglets au lieu
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
| Cahier des charges | Surfaces · Contraintes · Adjacences |
| Programme mixer | Répartition · **Contraintes** |
| Massing | Volumétrie · **Contraintes** |

Les deux volets « Contraintes » des OUTILS sont d'une autre nature que celui du cahier des
charges : là on lit ce que le RÈGLEMENT impose ; ici, c'est la page Paramètres & contraintes
filtrée sur l'onglet — chaque ligne qui y agit, et ce qu'elle dit de la composition à l'écran
(`docs/parametres.md`).

URL : `#<onglet>/<volet>`, et `#programme/surfaces/<chap|fam>` pour le seul volet qui a un
regroupement. Les liens qui ont circulé — `#adjacences`, `#programme/adjacences`,
`#programme/fam` — restent valables ; les deux premiers mènent au volet Adjacences, redevenu
un volet à part entière (une carte par grappe, en cascade — `docs/concours.md`). Un volet s'ajoute dans `SUBS_BY` plus une branche dans
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

## Règle seconde : la circulation se déduit des PIÈCES

Elle n'est chiffrée nulle part au règlement : c'est une hypothèse de projet. Un couloir dessert
des portes, pas des mètres carrés : la salle de sport double, une pièce de 896 m², n'en demande
pas autant au m² que neuf WC de 2 m².

```
front   = √(surface d'une pièce)          le côté qu'elle ouvre sur le couloir
couloirs = Σ front × largeur ÷ 2           un couloir dessert ses deux rives
cages   = 1 ou 2 par niveau × 24 m²        deux au-delà de 900 m² d'étage (AEAI)
```

Les petites pièces d'un poste (sous 12 m²) forment un bloc à une porte ; un grand local
n'ouvre jamais plus de 12 m. À 2,40 m de couloir : 528 m de front, **777 m²** de circulation
(633 de couloirs, 144 de cages sur trois niveaux supposés), soit **12 %** du bâti scolaire,
6'402 m². La part devient un RÉSULTAT. Elle ne porte que sur le **bâti scolaire** — les quatre
premiers chapitres ; la piscine, le chauffage à distance, la cour et son préau n'ont pas de
couloirs à nous.

La **largeur du couloir** se règle **dans le cahier des charges, volet Surfaces, et là
seulement** ; tous les onglets suivants la lisent.

- Largeur par défaut, bornes, rangs, seuil de bloc, front maximal, cage, pile supposée :
  `RULES.circ` dans `src/data/rules.js`.
- Valeur vivante `COULOIR`, et ce qui en découle (`CIRCA` = `CIRCH` + `CIRCV`, `CIRC` la part,
  `BUILTG` / `GRANDG`), avec `frontDe` / `couloirDe` / `cagesDe` : `src/core/model.js` seul.
  `setCirc()` est le seul écrivain.
- **Chaque chapitre et chaque famille porte les couloirs de SES pièces**, et sa part des cages
  au prorata du bâti — `ch.circ` / `ch.gross`, `f.circ` / `f.gross`, dans `recompute()` et
  nulle part ailleurs. Les parts se resomment exactement à `CIRCA`.
- **Le mixer la compte niveau par niveau**, sur les pièces que chacun porte, avec ses cages
  (`flCircDe()` dans `mix/floors.js`) : le cahier l'ESTIME sur trois niveaux, le mixer la
  COMPTE sur sa pile.

> Elle se réglait auparavant dans DEUX outils, sous le même mot et avec deux arithmétiques
> opposées : 15 % ajoutés à l'utile dans le générateur de volumétrie, 18 % du bâti dans le plan.
> Puis elle fut une part unique, 18 % du bâti — 1'235 m², le même taux au m² pour une salle de
> sport que pour un bloc sanitaire.

## Règle troisième : une source par décision

Une valeur qui n'est ni dans `rules.js` ni dans une LIGNE (`src/data/lignes.js` et les fichiers
de rôle) est un nombre écrit en dur, et c'est un défaut.

---

## Où modifier quoi

- **Une surface, un nombre, une famille, une note** : `src/data/program.js` seul.
- **Une contrainte du concours** : `src/data/rules.js` seul — la section Contraintes et le
  contrôle en découlent. Les règles de niveau sont des lignes du cadre (`src/data/cadre.js — NIV`).
- **Ce qui influe sur une variante** — une ligne, dans le fichier de son RÔLE, et nulle part
  ailleurs (`docs/parametres.md`) :
  - ce que l'on fait varier : `src/data/leviers.js` (l'état fixe/libre vit dans `mix/opts.js`
    et `MASS.lev`) ;
  - ce qui rend une variante valide : `src/data/cadre.js` — les règles de niveau (`NIV`) y
    sont ; `mix/niv.js` n'en garde que la mécanique ;
  - où chercher d'abord : `src/data/orientation.js` ;
  - ce que vaut le bâtiment pour le jury : `src/data/jugement.js` — axes, critères, fonctions ;
  - la machine : `src/data/recherche.js` ; nos hypothèses et le catalogue des mesures :
    `src/data/donnees.js`.
  Le TAG d'une ligne (Intangible, Imposé, Prioritaire, Souhaité, Indicatif) se lit dans l'état,
  jamais en dur : `tagDe()`, `enVigueur()`, `force()`.
- **Une mesure du bâtiment** : `src/mass/mesures.js` ou `src/mix/mesures.js`, et son entrée
  dans `MESURES` (`donnees.js`). Le jugement ne lit QUE des mesures.
- **Une adjacence** : `src/data/schema.js` seul — le lien, le pôle du nœud, et les postes qu'il
  désigne (`nd.k`). Ni surface ni coordonnée : la surface se lit dans `program.js` par cette
  table, la géométrie est déduite par la vue. `LIENS_ORPHELINS` signale tout nom de poste qui ne
  correspond plus.
- **Un remède d'alerte** : `src/mix/fix.js` ou `src/mass/fix.js` seul, nommé dans le `checks.js`
  voisin, à côté de la règle qu'il répare. La mécanique qu'il rejoue reste dans `gen.js`.
- **Les familles et leurs couleurs** : `src/data/families.js` + `styles/tokens.css`.
- **Le relevé du géomètre** : `src/data/site.js`, engendré — voir `docs/releve.md`.
- **Un réglage du mixer et son dé** (la pile et son dé, le lien d'un poste, les cotes ; les
  adjacences exigées, toujours actives) : `src/mix/opts.js` seul ; `shuffle.js` le lit, la vue le montre là où il se voit.
  Toucher une valeur la fige : son dé s'éteint.
- **L'état qui survit à un rechargement** : `snapshot()` / `restore()` dans
  `src/mix/store.js` seuls. Un seul objet dit ce qu'est « l'état du projet », et
  deux choses le lisent — l'enregistrement local et une variante partagée. Les
  séparer ferait deux vérités.
- **L'adresse de la base ou sa clé** : `src/data/supabase.js` seul. La clé
  `service_role` n'entre JAMAIS dans le dépôt.
- **Une valeur de dessin** : `styles/tokens.css`, et nulle part ailleurs — trois couches : les
  noms de **shadcn** (le thème, Saxon par défaut), les **dérivés** calculés (`--soft-foreground`,
  `--border-soft`, `--radius-*`, `--s-*`…), l'**application** (familles, états, échelles), qui ne
  dépend que du mode. WebGL ne sait pas lire `var(--f-cla)` : `cssRGB()` fait résoudre le
  token par le navigateur, le ramène à trois octets par un canevas (`oklch()`, `color-mix()`)
  et le garde en cache tant que le thème et le mode ne changent pas.
- **Un thème** : un fichier `styles/themes/<id>.css` au format shadcn, une ligne dans
  `src/data/themes.js`. Le thème et le mode sont deux choix, dans les préférences du compte.
- **Une préférence de la personne** — thème, mode, tri et filtre des variantes, barre ouverte :
  `PREFS` dans `src/net/prefs.js` (colonne `profile.prefs`, copie sur l'appareil). Jamais une
  décision de projet : celles-là sont dans `net/reglages.js`.
- **Un onglet** : une entrée dans `TABS` (numéro `n` ou `icon`) et une branche dans `render()`.

---

## Vérifier

Aucun test automatisé. Ces trois snapshots en tiennent lieu — **à jouer avant tout push**, et
surtout après une résolution de conflit.

Ils fixent la seed (`seed(1)`) avant de répartir : même « ordonné » (`alea:false`), le tirage
départage au hasard les postes de même surface, et sans seed fixée deux lancements du même code
ne rendaient pas la même répartition — on ne pouvait pas comparer avant et après.

La répartition :

```bash
node --input-type=module -e "
Promise.all([import('./src/mix/floors.js'),import('./src/mix/shuffle.js'),
             import('./src/mix/checks.js'),import('./src/mix/prog.js'),
             import('./src/core/rand.js')]).then(([F,S,C,P,R])=>{
  console.log('liens orphelins :', P.LIENS_ORPHELINS);
  R.seed(1);
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
             import('./src/mass/model.js'),import('./src/mass/checks.js'),
             import('./src/core/rand.js')]).then(([S,G,M,C,R])=>{
  R.seed(1);
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

Ce que dit le JUGEMENT de la composition retenue — la note, la part du poids lue, chaque axe —,
et ce qu'en pense l'ORIENTATION, ligne par ligne (le générateur retient par l'orientation, puis
classe par le jugement) :

```bash
node --input-type=module -e "
Promise.all([import('./src/mix/shuffle.js'),import('./src/mass/gen.js'),
             import('./src/mass/model.js'),import('./src/mass/mesures.js'),
             import('./src/core/rand.js')]).then(([S,G,M,E,R])=>{
  R.seed(1);
  S.repartir({ alea:false, etages:true });
  M.massSet('parti','auto');
  M.massVols(G.genMass(11));
  var ev = E.evaluationCourante(), j = ev.jugement, N = ['défavorable','neutre','favorable'];
  console.log('parti', M.MASS.vol.parti, '· jugement', j.total, '· lu à', Math.round(100 * j.couv) + ' %',
              '· cadre', ev.invalide ? 'enfreint' : ev.notifie ? 'choisi enfreint' : 'tenu');
  j.axes.forEach(function(a){ console.log(a.n.padEnd(52), a.s == null ? '—' : Math.round(100 * a.s) + ' %'); });
  Object.keys(ev.qualites).forEach(function(id){
    console.log('  qualité', id.padEnd(8), N[ev.qualites[id].niv].padEnd(12), ev.qualites[id].txt);
  });
});"
```
