# Claude dans l'atelier, phase 1 — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un outil node, `tools/claude.mjs`, qui remet en place un état du projet, le juge, le
tire, en règle les lignes et prépare une variante, plus le skill qui apprend à Claude à s'en
servir avec le connecteur Supabase.

**Architecture:** Un seul fichier ES module sans dépendance. Il pose des remplaçants de
`localStorage` puis importe dynamiquement les modules de l'app ; il ne lit et n'écrit que des
fichiers JSON de `.atelier/`. Aucun fichier de `src/` ne change. La base est l'affaire de Claude,
par le connecteur, selon `.claude/skills/atelier/SKILL.md`.

**Tech Stack:** Node ≥ 18 (ES modules, `node:fs`, `node:assert`), les modules de `src/`.

**Spec:** `docs/superpowers/specs/2026-10-06-claude-atelier-design.md`

## Global Constraints

- Aucune dépendance, aucun build ; aucun fichier de `src/` modifié.
- `tools/claude.mjs` ne fait **aucun** appel réseau.
- Les trois snapshots de `CLAUDE.md` rendent exactement la même sortie avant et après.
- Espace de travail : `.atelier/`, ajouté à `.gitignore`. Défauts : `--groupe .atelier/groupe.json`, `--etat .atelier/etat.json`.
- Variante : `tags: ["claude"]` ; `team_id` et `author_id` laissés absents.
- Textes de sortie en français, comme l'app. Commentaires dans le style du dépôt (en-tête `/* ===… */`).
- Les clés du jury sont `ax:<axe>`, `sx:<sous-axe>`, `w:<critère>`, `jb:`/`jn:`/`jh:<critère>` (`data/jugement.js`).
- Écart assumé à la spec : le mixer prend sa seed par `--seed <n>`, le massing par `--graine <n>` (la spec ne nommait que `--graine`). Le test du parti du troisième snapshot utilise `--seed 1 --graine 11`.

## Review Focus

1. **État illisible ou absent** (`etat.json` manquant, JSON cassé) → un message d'une ligne, code de sortie 1, pas de pile d'appels. *(Tâche 1)*
2. **Corps composé à la main, réduit au strict nécessaire** — `{ x, y, a, lv:[{ i, w, d }] }`, sans `id`, `dx`, `keys` → le bilan tourne et juge. *(Tâche 1)*
3. **Section perdue au `restore()`** → le bilan l'affiche (`perdu`), au lieu de juger en silence un état à moitié remis. *(Tâche 1)*
4. **Valeur hors bornes donnée à `ligne`** (`ax:… 500`) → la valeur bornée réellement posée est rendue, pas celle demandée. *(Tâche 3)*
5. **Code `js` long ou plein de guillemets sous PowerShell** → `js --fichier <chemin>` lit le code d'un fichier. *(Tâche 4)*

---

### Task 1: Le noyau — remise en place, bilan, test

**Files:**
- Create: `tools/claude.mjs`
- Modify: `.gitignore` (ajouter `.atelier/`)

**Interfaces:**
- Produces, dans `tools/claude.mjs` :
  - `async function modules()` → `{ M, G, F, S, St, R, L, J, E, C, CM, Va, Rech, T, MX, XM, model }` (massing model, gen, floors, shuffle, store, rand, lignes, jugement, mesures, checks massing, checks mixer, variantes, recherche, typo/etat, fix massing, fix mixer, core/model). Importe aussi `data/leviers.js`, `cadre.js`, `orientation.js`, `recherche.js`, `donnees.js` pour que toutes les lignes soient déclarées.
  - `function lireJSON(chemin, requis)` → objet, `null` si absent et non requis ; lève `Erreur` (classe locale, message seul) si absent et requis, ou illisible.
  - `function ecrireJSON(chemin, o)` (crée `.atelier/` au besoin, indentation 2).
  - `function charger(groupe, etat)` → `string[]` (sections perdues). Groupe d'abord : `applyAreas(areas)`, `loadCirc(circulation)` si non nul, `poser(doctrine, false)`, `recompute()` — comme `tirerReglages()`. Puis `massVols([])` et `restore(etat)`.
  - `function bilan(perdu)` → `{ perdu, mixer:{ niveaux:[{ nom, net, utile, pieces, h }], bac, verdict, alertes:[{ sev, code, msg }] }, massing:{ parti, corps:[{ id, nom, x, y, a, etages:[{ i, w, d, dx, dy, keys }] }], demande, pose, verdict, alertes }, jugement: null | { total, couv, axes:[{ id, n, s }], crit }, cadre: "tenu"|"choisi enfreint"|"enfreint"|null, ecarts:{ ko:[], notif:[] }, qualites }`. Les alertes ne gardent que les non assumées (`!x.ok`). `jugement` vaut `null` quand il n'y a aucun corps.
  - `function texte(b)` → le bilan en texte lisible (une section par clé, axes en %).
  - `const VERBES = { bilan, test }` ; `main(argv)` analyse `--clé valeur`, `--drapeau`, et les positionnels ; attrape `Erreur` → `console.error(msg)`, `process.exitCode = 1`.

- [ ] **Step 1: Écrire le verbe `test` avec ses premiers asserts** (`node:assert/strict`), dans un état tiré en mémoire par `R.seed(1); S.repartir({ alea:false, etages:true }); M.massSet("parti","auto"); M.massVols(G.genMass(11))` :
  - `test_aller_retour` : `a = St.snapshot()`, `charger(null, a)`, `b = St.snapshot()` ; `deepEqual` hors `updatedAt`.
  - `test_bilan_troisieme_snapshot` : `bilan([]).jugement.total` égale `E.evaluationCourante()`→`noter` du même état, et `massing.parti === M.MASS.vol.parti`.
  - `test_corps_minimal` (Focus 2) : état dont `mass.vol = [{ x:<centre du périmètre>, y:…, a:0, lv:[{ i:0, w:30, d:14 }] }]` → `bilan` ne lève pas, `massing.corps.length === 1`, `jugement !== null`.
  - `test_hors_perimetre` : le premier corps de l'état tiré, déplacé de `x += 1000` → `bilan(...).massing.verdict.e > 0`.
  - `test_perdu` (Focus 3) : `charger(null, { …etat, blocks: "cassé" })` rend un tableau contenant `"répartition"` et `bilan(perdu).perdu` le porte.
  - `test_etat_absent` (Focus 1) : `lireJSON("nexiste/pas.json", true)` lève une `Erreur` dont le message nomme le chemin.
- [ ] **Step 2:** `node tools/claude.mjs test` → échoue (fonctions absentes).
- [ ] **Step 3:** Écrire le reste des interfaces ci-dessus. Remplaçant posé AVANT tout import : `globalThis.localStorage ??= { getItem(){ return null; }, setItem(){}, removeItem(){} }`. Le centre du périmètre pour le test se prend dans `SITE` (`data/site.js`) ou dans un corps tiré.
- [ ] **Step 4:** `node tools/claude.mjs test` → `ok` pour chaque test ; `node tools/claude.mjs bilan --etat <un état écrit par le test>` rend le texte. Les trois snapshots de `CLAUDE.md` rendent la même sortie qu'avant (les enregistrer avant de commencer : `> .atelier/avant-N.txt`, puis `diff`).
- [ ] **Step 5: Commit** — `git add tools/claude.mjs .gitignore && git commit -m "tools: claude.mjs, state load, report and self-check"`

### Task 2: Tirer et chercher

**Files:** Modify: `tools/claude.mjs`

**Interfaces:**
- Consumes: `charger`, `bilan`, `ecrireJSON`, `modules` (Tâche 1).
- Produces :
  - verbe `tirer` : options `--mixer`, `--massing`, `--typo` (aucune → mixer puis massing), `--parti <id>`, `--seed <n>`, `--graine <n>`, `--ordonne`. Mixer : `R.seed(seed ?? null)`, `S.repartir({ alea: !ordonne, etages:true })`. Massing : `M.massSet("parti", parti)` si donné, `M.massSet("graine", graine ?? aléatoire non nul)`, `M.massVols(G.genMass(M.MASS.graine))`, `M.MASS.pile = M.empreintePile()`. Typo : `T.TYPO.graine = graine ?? aléatoire`. Un mixer retiré sans massing regénère quand même le massing avec la graine courante (la volumétrie suit la pile, comme `rechercher`). Écrit `St.snapshot()` dans `--etat`, puis imprime le bilan.
  - verbe `chercher` : `--essais` (défaut 30), `--garder` (défaut 3), `--partis a,b,c`, `--avec-erreurs` (→ `sansErreur:false`). Appelle `Rech.rechercher(opts)`, écrit `.atelier/trouve-<k>.json` (= `t.state`) pour k = 1…, imprime une ligne par trouvaille : `k · pid · score · e/w massing · e/w mixer`.
- [ ] **Step 1:** Ajouter à `test` : `test_tirer_ordonne` — `tirer --ordonne --seed 1 --graine 11 --etat .atelier/t.json` puis `bilan --json` rend le même `jugement.total` et le même `massing.parti` que l'état tiré en mémoire par la Tâche 1 ; `test_chercher` — `chercher --essais 3 --garder 2` écrit au plus 2 fichiers `trouve-*.json`, chacun rechargeable par `charger` sans section perdue. (Appeler les verbes comme fonctions, pas par un sous-processus.)
- [ ] **Step 2:** `node tools/claude.mjs test` → les deux nouveaux échouent.
- [ ] **Step 3:** Implémenter les deux verbes.
- [ ] **Step 4:** `node tools/claude.mjs test` → tout passe ; snapshots inchangés.
- [ ] **Step 5: Commit** — `tools: claude.mjs draws and searches`

### Task 3: Les lignes, jury compris

**Files:** Modify: `tools/claude.mjs`

**Interfaces:**
- Consumes: `charger`, `lireJSON`, `ecrireJSON` (Tâche 1).
- Produces : verbe `ligne [clé] [valeur]`.
  - sans clé : chaque écart au défaut, `clé · valeur · défaut · jury|recherche` (`L.ecarts(false)`, `L.defaut`, `L.estJury`).
  - clé seule : `{ cle, valeur: L.V[k], defaut, borne: L.borne(k), jury }`.
  - clé + valeur : `avant = L.V[k]` ; `L.regler(k, valeur)` (une chaîne numérique est relue par `regler`) ; rend `{ cle, avant, apres: L.V[k], change }`. Clé inconnue (`!L.connue(k)`) → `Erreur("ligne inconnue : <k>")`. Puis `etat.doc = L.ecarts(true)` réécrit dans `--etat`, `groupe.doctrine = L.ecarts(false)` réécrit dans `--groupe` (créé `{ doctrine }` s'il manquait).
- [ ] **Step 1:** Ajouter à `test` : `test_poids_change_la_note` — sur l'état tiré, mettre le poids d'un axe à 0 (`ax:<premier axe de J.AXES>`) change `bilan().jugement.total`, et le retour porte `avant` = l'ancien poids ; `test_borne` (Focus 4) — `ligne ax:<id> 500` rend `apres === 100` ; `test_ligne_inconnue` — lève `Erreur` ; `test_jury_hors_etat` — après réglage d'un poids, `etat.doc` ne contient pas la clé, `groupe.doctrine` la contient.
- [ ] **Step 2:** `test` → les quatre échouent.
- [ ] **Step 3:** Implémenter `ligne`.
- [ ] **Step 4:** `test` → tout passe ; snapshots inchangés.
- [ ] **Step 5: Commit** — `tools: claude.mjs reads and sets lines, jury included`

### Task 4: La variante et la porte de sortie

**Files:** Modify: `tools/claude.mjs`

**Interfaces:**
- Consumes: `charger`, `modules`, `ecrireJSON` (Tâche 1).
- Produces :
  - verbe `variante <nom>` : `row = Va.resumeCourant()`, `row.name = nom || Va.nomPropose()`, `row.state = St.snapshot()`, `row.tags = ["claude"]` → `.atelier/variante.json` (ou `--sortie`). Imprime nom, score, verdicts.
  - verbe `js <code>` ou `js --fichier <chemin>` : `new AsyncFunction(...noms, code)` appelée avec les modules de `modules()` (mêmes lettres que la Tâche 1), après `charger`. Imprime `JSON.stringify(retour, null, 2)` si le retour n'est pas `undefined`. `--ecrire` réécrit `St.snapshot()` dans `--etat`.
- [ ] **Step 1:** Ajouter à `test` : `test_variante` — la ligne rendue a `state.mass.vol.length > 0`, `criteria.v === 3`, `deepEqual(tags, ["claude"])`, ni `team_id` ni `author_id` ; `test_js_ecrire` — `js "M.MASS.vol[0].x += 5" --ecrire` puis relecture : le x du premier corps a pris 5 ; `test_js_fichier` (Focus 5) — un fichier contenant `return "a'\"b"` rend cette chaîne.
- [ ] **Step 2:** `test` → les trois échouent.
- [ ] **Step 3:** Implémenter les deux verbes.
- [ ] **Step 4:** `test` → tout passe ; snapshots inchangés.
- [ ] **Step 5: Commit** — `tools: claude.mjs prepares a variant, runs any code`

### Task 5: Le skill

**Files:**
- Create: `.claude/skills/atelier/SKILL.md`
- Modify: `CLAUDE.md` — une ligne dans la table « pour | lire » : `| faire travailler Claude dans l'app (outil, base, méthode) | .claude/skills/atelier/SKILL.md |`

**Interfaces:**
- Consumes: les verbes des Tâches 1-4, tels qu'implémentés.

Le skill porte, dans cet ordre (frontmatter `name: atelier`, `description:` qui le déclenche sur « composer un volume, shuffle, variante, poids, jury, Saxon ») :
1. **La boucle** de la spec, avec la commande exacte de chaque pas.
2. **La carte de l'instantané** : chaque clé de `snapshot()` ; pour `mass.vol`, le repère (mètres du relevé, celui de `data/site.js`), `a` (vérifier degrés ou radians dans `mass/model.js — volCoins` et l'écrire), `lv[].i` (indice dans `FLOORS`), `w`/`d`/`dx`/`dy`, `keys` (les postes, clés de `program.js`), `ph`, `bat`, `joint`, `ext` ; `pont` ; pour `blocks`, `{ k, q, f }`. Chaque définition se vérifie dans le code avant d'être écrite.
3. **Les règles du projet** à ne pas casser : surfaces fixes, circulation déduite, une source par décision.
4. **Les requêtes** par le connecteur, chacune avec `team_id` explicite : trouver le profil de la personne et son équipe (`profile`, `membership`, `team`) ; lister les variantes (`id, name, score, parti, tags, author_id, created_at`) ; tirer `state` d'une variante vers `.atelier/etat.json` ; lire `team_settings` vers `.atelier/groupe.json` ; insérer `variante.json` avec `team_id` et `author_id` remplis ; upsert de `team_settings`.
5. **Les règles d'écriture** de la spec, mot pour mot.

- [ ] **Step 1:** Rédiger le skill ; vérifier chaque champ de la carte dans le code.
- [ ] **Step 2:** Vérifier par le connecteur (lecture seule, `list_tables` puis `select` limité au groupe) que les colonnes nommées dans les requêtes existent.
- [ ] **Step 3: Commit** — `skill: atelier, how Claude works in the app` (commit isolé, comme le veut `CLAUDE.md` pour sa table).

### Task 6: L'essai réel, avec Louis

Pas de code. Par le connecteur : trouver le profil et le groupe, écrire `groupe.json`, tirer une variante existante dans `etat.json`, `bilan`, composer ou modifier un corps à la main, `bilan`, `variante "Claude · essai"`, l'insérer, demander à Louis de la retrouver dans le panneau (tag `claude`) et de la charger. Puis rebase sur `origin/main`, snapshots rejoués, push, PR, merge dans la journée.
