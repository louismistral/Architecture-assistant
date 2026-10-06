# Claude dans l'atelier — phase 1

*Spec du 6 octobre 2026. Phase 1 sur 3 : le noyau. Phase 2, les typologies ; phase 3,
l'aller-retour Rhino piloté par Claude.*

## Pourquoi

Le studio demande de faire le concours de Saxon **avec l'IA**, pour le gagner. Rhino seul était
trop limité ; l'app génère par algorithme, juge et alerte, mais **l'algorithme ne réfléchit pas** :
on a le nombre, pas la qualité. Il manque une génération intelligente, et c'est Claude.

Claude doit pouvoir faire ce qu'un membre de l'équipe fait dans l'app, et un peu plus :
composer un volume en raisonnant, reprendre ce que l'algo a tiré et le modifier, régler les
paramètres et les poids du jury, tirer des shuffles, lire les variantes du groupe, en
enregistrer. **Et tout ce qui s'ajoutera à l'app doit passer sous son contrôle** sans qu'on
refasse l'outil à chaque fois.

Il travaille depuis **Claude Code** (app Claude, locale ou cloud), sans clé d'API.

## Le principe : l'instantané est la langue

`snapshot()` / `restore()` (`src/mix/store.js`) disent déjà, en un objet JSON d'environ 4 Ko,
**tout l'état du projet** : surfaces, couloir, pile, répartition, volumes du massing étage par
étage, seed et cotes des typologies, écarts des lignes. `CLAUDE.md` impose déjà que tout état qui
survit à un rechargement passe par là.

Donc Claude ne reçoit pas une fonction par geste de l'app : il **lit et écrit l'instantané**, et
le fait juger par les fonctions de l'app. Composer un volume, c'est écrire `mass.vol` en
connaissance de cause ; une fonction ajoutée demain à l'app entre dans l'instantané, donc sous son
contrôle, le même jour.

Tous les modules de l'app s'importent sous node tels quels (vérifié : `variantes.js`,
`store.js`, `etat.js`, `reglages.js`, `recherche.js`, `import.js`, `export.js`). **Aucun fichier
de l'app ne change en phase 1.**

## Les deux moitiés

```
tools/claude.mjs             l'outil : calcule, juge, prépare — ne touche JAMAIS au réseau
.claude/skills/atelier/      comment Claude s'en sert : la méthode, la carte de l'instantané,
  SKILL.md                   les règles d'écriture en base
.atelier/                    l'espace de travail, ignoré par git
```

- **L'outil calcule.** Il charge les modules, remet en place les réglages du groupe et un état,
  et rend ce qu'il en pense. Il lit et écrit des fichiers, rien d'autre.
- **Claude porte la base.** Il lit et écrit les tables par le **connecteur Supabase** de l'app
  Claude : aucun mot de passe nulle part, aucun code d'authentification. Un état fait ~4 Ko, une
  ligne de variante ~1 Ko : ils passent par le connecteur sans peine.

Le skill est copié dans `.claude/skills/` : toute session, locale ou cloud, le reçoit.

## L'espace de travail

```
.atelier/groupe.json     la ligne team_settings du groupe : areas, circulation, doctrine
.atelier/etat.json       l'instantané sur lequel on travaille
.atelier/<nom>.json      autant d'états qu'on veut, pour comparer
.atelier/variante.json   la ligne prête à insérer dans `variant`
```

`groupe.json` est appliqué **avant** chaque état, comme `tirerReglages()` le fait à l'ouverture
de l'app : le jury et les surfaces sont ceux du groupe, pas les défauts du code.

## Les verbes

Tous prennent `--groupe <fichier>` (défaut `.atelier/groupe.json`, ignoré s'il manque) et
`--etat <fichier>` (défaut `.atelier/etat.json`). `--json` rend la sortie en JSON au lieu de texte.

| verbe | ce qu'il fait |
|---|---|
| `bilan` | Remet l'état en place et dit ce qu'il donne. Voir plus bas. |
| `tirer` | Shuffle et réécrit l'état. `--mixer` (`repartir`), `--massing` (`genMass`), `--typo` (nouvelle `TYPO.graine`) ; `--parti <id>`, `--graine <n>`, `--ordonne` (`alea:false`). Sans option : mixer puis massing. |
| `chercher` | La recherche automatique de l'app (`rechercher()`) : `--essais`, `--garder`, `--partis L,U,cour`. Écrit un état par trouvaille, `.atelier/trouve-1.json`…, et rend le classement. |
| `ligne <clé> [valeur]` | Lit ou règle une ligne (`regler()`), jury compris : un poids, un tag, une borne de levier. Réécrit `etat.json` (`doc`) et `groupe.json` (`doctrine`), et rend **l'ancienne valeur et la nouvelle**. Sans clé : la liste des lignes qui s'écartent du défaut. |
| `variante <nom>` | Écrit `.atelier/variante.json` : `resumeCourant()` + `state` + `name` + `tags:["claude"]`. `team_id` et `author_id` sont laissés vides ; Claude les remplit à l'insertion. |
| `js <code>` | La porte de sortie : exécute du JS avec tous les modules sous la main (`M` massing, `G` générateur, `F` étages, `S` shuffle, `L` lignes, `J` jugement, `E` mesures, `X` remèdes…), après la remise en place. `--ecrire` réenregistre l'état ensuite. C'est par là qu'on appelle un remède (`fix.js`), `relierCourant()`, `fusionner()`, `degager()`, ou tout ce qui n'a pas encore de verbe. |
| `test` | La vérification de l'outil (voir *Vérifier*). |

Un verbe n'existe que s'il épargne à Claude d'écrire le même `js` à chaque fois. Le reste passe
par `js`, et un `js` que Claude réécrit souvent devient un verbe.

## Le bilan

C'est ce que Claude lit pour raisonner. Il réunit les trois snapshots de `CLAUDE.md`, et y ajoute
les **messages** des alertes (les snapshots n'en donnent que le compte) :

- **le mixer** : chaque niveau, net/utile, pièces, hauteur ; le bac ; le verdict, et chaque
  alerte avec son texte ;
- **le massing** : chaque corps — id, nom, x, y, a, et par étage w × d, décalages, postes
  portés (`keys`) — ; demandé / posé ; le verdict et ses alertes ;
- **le jugement** : la note, la part du poids lue, chaque axe, chaque critère avec sa mesure ;
- **le cadre** : tenu, choisi enfreint ou enfreint, et quelles lignes ;
- **l'orientation** : chaque qualité, défavorable, neutre ou favorable, et son texte.

## Comment Claude travaille (le skill)

Le `SKILL.md` lui donne :

1. **La boucle** : lire l'état du groupe → `bilan` → raisonner → modifier (`etat.json` à la main,
   `tirer`, `ligne`, `js`) → `bilan` → recommencer → `variante` → insérer.
2. **La carte de l'instantané** : ce que veut dire chaque champ de `mass.vol` (repère, unités,
   `a` en degrés, `lv[].i` l'indice de niveau, `w`/`d` hors tout, `keys` les postes), de
   `blocks`, de `doc`. C'est ce qu'il faut savoir pour composer un volume sans l'algorithme.
3. **Les règles du projet** qu'il ne doit pas casser : les surfaces sont fixes (règle première),
   la circulation se déduit des pièces, une source par décision.
4. **Les requêtes** pour la base : lister les variantes du groupe, en tirer l'état, lire et
   écrire `team_settings`, insérer une variante.

## Les règles d'écriture en base

Le connecteur a les droits d'administrateur : il passe au-dessus des règles d'accès. Les gardes
sont donc dans le skill, et Claude les tient :

- **Toujours cibler le groupe** : `team_id` explicite dans chaque requête, jamais une table entière.
- **Variante** : `INSERT` libre, avec `author_id` = le profil de la personne qui demande et le tag
  `claude`. Elle paraît dans le panneau de l'app comme celle d'un membre.
- **Modifier une variante** (renommer, noter à la main) : seulement celles qui portent `claude`,
  sauf demande explicite.
- **Supprimer** : jamais sans demande explicite, variante par variante.
- **`team_settings`** (poids, surfaces, couloir, lignes) : ça change l'app de **tout le groupe**.
  Claude ne l'écrit que sur demande, met `updated_by` au profil de la personne, et rend dans sa
  réponse l'ancienne valeur de chaque clé changée, pour qu'on puisse revenir en arrière.

## Ce qui n'est pas en phase 1

- **Les typologies** (phase 2) : `TYPO.graine` et `TYPO.cotes` sont dans l'instantané, donc Claude
  peut déjà les régler ; mais le générateur des plans vit dans `src/typo/plans.html`, et le
  `bilan` ne saura les juger que si ce générateur tourne sous node. À vérifier en phase 2.
- **Rhino piloté par Claude** (phase 3) : `piecesMassing()` (`mass/export.js`) rend déjà les
  maillages en coordonnées Rhino, et `volsDe3dm()` (`mass/import.js`) relit des triangles en
  mètres. Il restera à les faire passer par le connecteur Rhino (`run_python`) au lieu d'un
  fichier. En attendant, l'import et l'export .3dm de l'app marchent déjà à la main.
- **Un bouton « demande à Claude » dans l'app** : il faudrait une clé d'API. Exclu.

## Vérifier

- Les trois snapshots de `CLAUDE.md` rendent **exactement** la même chose avant et après : l'app
  ne change pas.
- `node tools/claude.mjs test`, une seule vérification par `assert`, qui casse si la logique casse :
  - `snapshot → restore → snapshot` rend le même état (hors `updatedAt`) ;
  - `tirer --ordonne --graine 11` puis `bilan --json` rend le parti et la note du troisième
    snapshot ;
  - un corps déplacé à la main hors du périmètre, dans l'état, fait lever une erreur au contrôle
    du massing ;
  - `ligne` sur un poids du jury change la note, et l'ancienne valeur est rendue ;
  - `variante` rend une ligne avec `state`, `criteria.v === 3` et `tags:["claude"]`.
- Un essai réel, avec toi : lire le groupe par le connecteur, composer un parti à la main,
  l'enregistrer, et le retrouver dans le panneau des variantes.
