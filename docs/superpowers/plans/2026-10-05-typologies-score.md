# Score des typologies — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** les plans des Typologies sont mesurés hors de leur page, leurs mesures entrent dans le jury, la recherche automatique rebat les typologies, les variantes gardent tout.

**Architecture:** `PG` sort de `src/typo/plans.html` vers `src/typo/gen.js` ; `src/typo/mesures.js` lit le plan et rend mesures + écarts ; `evaluer()` (`src/mass/mesures.js`) est le seul point de jonction. La page reçoit le générateur de son hôte (`typoHote()`).

**Tech Stack:** HTML + CSS + modules ES, aucun build, aucune dépendance ; vérification par snapshots node (`CLAUDE.md — Vérifier`).

**Spec:** `docs/superpowers/specs/2026-10-05-typologies-score-design.md`

## Global Constraints

- Aucune surface de programme ne change ; une source par décision (`rules.js`, lignes).
- Style du code : `var`, `function`, commentaires en français, au ton du fichier voisin.
- Aucun `Math.random` hors `src/core/rand.js` ; seeds en base 36 à l'écran.
- Les fichiers de données (`jugement.js`, `donnees.js`, `cadre.js`, `recherche.js`) se touchent seuls, en un commit à part, en premier.
- `RECH.parVolume` 5 par défaut, bornes [1, 100] ; la case n'apparaît que typologies + (massing ou programme) cochés.
- `criteria.v` passe à 4 ; aucune migration de base ; la seed typologie s'enregistre dans `thumbnail.typo`.
- Les trois snapshots de `CLAUDE.md` passent avant chaque push ; un quatrième s'y ajoute.

## Review Focus

1. Aucune volumétrie (session neuve, massing impossible) : `evaluer()` rend null, l'onglet dit « aucune composition », rien ne lève — Task 4, sonde `MASS.vol = []`.
2. Un niveau sans corps à pièces (seule la salle de sport) ou sans classes : les mesures rendent `null`, jamais `NaN` — Task 3, assertion sur chaque mesure.
3. Un bâtiment importé de Rhino, aux volumes inattendus : `evaluerTypo()` qui lève ne casse pas `evaluer()` — mesures typo absentes, le reste noté — Task 4, `try/catch` + sonde avec un volume sans `lv`.
4. Une variante d'avant (v3, sans `thumbnail.typo`, sans `state.typo`) : notée sur ses mesures, en italique, seed « 1 (par défaut) », Reload la remesure — Task 6.
5. Une recherche arrêtée ou qui lève : l'état revient, `TYPO.graine` comprise — Task 5, sonde node qui compare `snapshot()` avant / après.

---

### Task 1: Les lignes — critères, mesures, cadre, seed

**Files:**
- Modify: `src/data/jugement.js` (critères d33, prox, g59, calme, d42, d32, d43 ; nouveaux `d-pose`, `d-jour` ; `scoreTypo`)
- Modify: `src/data/donnees.js` (9 mesures `de:"typo"`, onglet et `lu` selon `de`)
- Modify: `src/data/cadre.js` (`fuites`, `sia500` passent dans `CADRE_TYPO`, mesurés ; `noyaux-empiles`, `typo-pose`)
- Modify: `src/data/recherche.js` (ligne `seed-typo`)

**Interfaces:**
- Produces: mesures `classesSoleil, liensPlan, circPlan, murBruyant, noyaux, grappes, techGroupes, posePlan, couloirsJour` ; `scoreTypo(j) → 0…1 | null` (moyenne pondérée par `V["w:"+id]` des critères dont la mesure est `de:"typo"`) ; lignes du cadre `fuites, sia500, scene-sport, noyaux-empiles, typo-pose`.

- [ ] **Step 1: sonde qui échoue**

```bash
node --input-type=module -e "Promise.all([import('./src/data/jugement.js'),import('./src/data/donnees.js'),import('./src/data/lignes.js'),import('./src/data/cadre.js'),import('./src/data/recherche.js')]).then(([J,D,L])=>{
  var t=D.MESURES.filter(m=>m.de==='typo'); console.assert(t.length===9,'9 mesures typo');
  console.assert(J.critere('d33').mesure==='classesSoleil' && J.critere('prox').mesure==='liensPlan' && J.critere('g59').mesure==='circPlan');
  console.assert(J.critere('calme').mesure==='murBruyant' && J.critere('d42').mesure==='noyaux' && J.critere('d32').mesure==='grappes' && J.critere('d43').mesure==='techGroupes');
  console.assert(J.critere('d-pose').mesure==='posePlan' && J.critere('d-jour').mesure==='couloirsJour');
  console.assert(L.ligne('fuites').onglet==='typologie' && L.tagDe('noyaux-empiles')==='impose' && L.tagDe('typo-pose')==='impose' && L.ligne('seed-typo'));
  console.assert(t.every(m=>m.onglet==='typologie'));
  var j=J.noter({classesSoleil:1,liensPlan:1,posePlan:1}); console.assert(J.scoreTypo(j)>0.99,'scoreTypo');
  console.log('ok');});"
```
Expected now: assertion failures.

- [ ] **Step 2: les lignes**, valeurs du spec — d33 `mn(0.9, 0.5)`, prox `mn(1, 0.6)`, g59 `mx(0.25, 0.35)`, calme `mx(0, 9)`, d42 `mx(2, 4)`, d32 `mn(1, 0.3)`, d43 `mx(1, 4)`, `d-pose` (D, poids 9) `mn(1, 0.9)`, `d-jour` (D, poids 5) `mn(1, 0)`. `fuites`/`sia500` : tag intangible, `qui:"code"`, `lu:"src/typo/mesures.js — ecartsTypo()"`. `noyaux-empiles`, `typo-pose` : `tag:"impose", admet:DURS, off:1, src:CHOIX, qui:"groupe"`.

- [ ] **Step 3: la sonde passe** — `ok`, aucune assertion.

- [ ] **Step 4: commit** `data: typology measures, criteria read the plan, cadre lines for the plans, seed-typo`

### Task 2: `PG` sort de la page

**Files:**
- Create: `src/typo/gen.js`
- Modify: `src/typo/plans.html` (retire le script `PG`, `var PG = parent.typoPG(DATA)`, recrée `PG` là où il appelait `PG.oublier()`)
- Modify: `src/views/render.js` (`typoHote()` expose `window.typoPG = creerPG`)

**Interfaces:**
- Produces: `creerPG(D) → { ancre, genNiveau(D0, parti, i), oublier, hotes(vols), local, versEtage, versMonde, COULOIR, MUR, CLOISON, NOY, FEU, LIEN, MODULE }` — le corps de l'IIFE, `DATA` remplacé par `D` ; `planifier(D) → { PG, tous }`, `tous[i] = PG.genNiveau(D, "courant", i)`.

- [ ] **Step 1: sonde d'équivalence** (scratchpad) : l'ancien script `PG` (tiré de `git show HEAD:src/typo/plans.html`, évalué avec `new Function("DATA", src + "return PG")`) contre `creerPG(D)`, `genNiveau` de chaque niveau, douze partis, seeds typologie 1 à 5 ; compare `JSON.stringify` de `{ rooms, cages, L, D, cx, cy, zl, zr, non: labels }` par corps. Échoue tant que `gen.js` n'existe pas.
- [ ] **Step 2: créer `gen.js`, brancher la page et l'hôte.**
- [ ] **Step 3: la sonde rend « identique » sur les 60 cas** ; les trois snapshots passent sans changement.
- [ ] **Step 4: au navigateur**, l'onglet Typologies dessine, Shuffle et seed retapée marchent, la console est muette.
- [ ] **Step 5: commit** `typologies: the plan generator leaves the page — src/typo/gen.js`

### Task 3: Lire le plan — `src/typo/mesures.js`

**Files:**
- Create: `src/typo/mesures.js`
- Modify: `src/mass/etat.js` (`volsOf(vols)` sorti de `massOf()`)
- Modify: `src/typo/donnees.js` (`donneesTypo(vols, ponts)`, défaut : les volumes à l'écran)
- Modify: `src/typo/gen.js` (`passe(F, f, sg)` : le test du passage vers le corps voisin, aujourd'hui dans la page)
- Modify: `src/typo/plans.html` (`controle()` écrit ses phrases depuis `parent.typoLecture()` ; le dessin des passages appelle `PG.passe`)
- Modify: `src/views/render.js` (`window.typoLecture = lirePlans`)

**Interfaces:**
- Consumes: `creerPG`, `planifier` (Task 2).
- Produces:
  - `lirePlans(D) → { tous, nm, am, ou, acces, empile, feu, fuite, fuiteMax, rompus, liens:{ n, ok }, scene: dSc|null, ... }` — tout ce que `controle()` calculait, plus ce qu'il faut aux mesures ;
  - `evaluerTypo(vols, ponts) → { mes, ecarts }` (un seul plan pour les deux) ;
  - écart : `{ k, v:-1, v2:-1, msg, pile:0, sev:severite(k), c:"typo" }`, seulement si `enVigueur(k)`.
- Mesures, définitions du spec : `classesSoleil` (azimut de la normale, A → (sin a, −cos a), B → l'opposée, `full` la meilleure), `liensPlan`, `circPlan` (`Σ(L·D − pièces − noyaux)` des corps non fixes + noyaux, ÷ `Σ L·D` de tous), `murBruyant` (rectangles au repère de l'étage, arêtes communes à 5 cm près, `CLSRE` contre `BRUYANT` ∪ chapitres `uape`, `tech`), `noyaux` (`Σ hotes(vols)[id].n`), `grappes`, `techGroupes` (boîtes au site, écart ≤ 2·MUR, même niveau), `posePlan`, `couloirsJour` (bout atteint, ni pièce `full` dessus ; un passage ne compte pas).

- [ ] **Step 1: sonde qui échoue** : seed(1), répartir, genMass(11) ; pour les seeds typologie 1 à 5, `evaluerTypo(MASS.vol, MASS.pont)` — chaque mesure `null` ou finie, parts dans [0, 1], `noyaux ≥ 1` ; `posePlan` ≈ 1 − non posé ÷ demandé de la sonde de conception (≈ 0,85) ; au moins une mesure varie d'une seed à l'autre.
- [ ] **Step 2: implémenter** ; `controle()` garde ses phrases mot pour mot.
- [ ] **Step 3: la sonde passe** ; un niveau sans classes rend `classesSoleil` calculée sur les autres, `null` si aucune classe.
- [ ] **Step 4: au navigateur**, le Contrôle des Typologies dit la même chose qu'avant (même seed, mêmes lignes ok / à revoir).
- [ ] **Step 5: commit** `typologies: measure the plan — classes facing the sun, links kept, drawn circulation, noise, cores, clusters, gaps`

### Task 4: La jonction — `evaluer()`, `resumeCourant()`

**Files:**
- Modify: `src/mass/mesures.js` (`evaluer()` joint `evaluerTypo(vols, vols.ponts || [])` dans un `try` ; `renoterTypo(ev, vols, moy)`)
- Modify: `src/net/variantes.js` (`criteria.v:4`, `verdict.typo:{ e, w }`, `thumbnail.typo:TYPO.graine` ; `mesDe` accepte v ≥ 3, `aJour` veut v ≥ 4)

**Interfaces:**
- Produces: `renoterTypo(ev, vols, moy) → ev'` (mesures et écarts typo refaits, `invalide`, `notifie`, `jugement` recalculés, la part massing reprise telle quelle) ; `typoVerdict(ecarts) → { e, w }` exporté de `src/typo/mesures.js`.

- [ ] **Step 1:** jouer les trois snapshots, noter leurs sorties d'avant.
- [ ] **Step 2: implémenter.**
- [ ] **Step 3:** snapshots 1 et 2 : verdicts inchangés ; la note du 3 change (critères au plan) ; sonde : `MASS.vol = []` → `evaluationCourante()` null ; un volume sans `lv` passé à `evaluer()` ne lève pas.
- [ ] **Step 4: le quatrième snapshot** (texte de la Task 7) montre la note qui bouge avec la seed typologie, à volume égal.
- [ ] **Step 5: commit** `jugement: the plans join the building's evaluation; variants keep typology measures and seed`

### Task 5: La recherche et son formulaire

**Files:**
- Modify: `src/net/recherche.js` (`RECH = { programme:true, massing:true, typologies:true, parVolume:5, essais:30, garder:3, sansErreur:true, distincts:true }`, `BORNES.parVolume = [1, 100]`, plus de `partis`)
- Modify: `src/views/variantes.js` (`ouvrirRecherche()` : trois cases, un résumé sous chaque case cochée, la case « Typologies essayées par volume », plus de grille des partis ; durée ; progression)

**Interfaces:**
- Consumes: `renoterTypo`, `typoVerdict` (Task 4) ; `TYPO` (`typo/etat.js`) ; `estLie`, `toutesCotes`, `dePile` (`mix/opts.js`) ; `ligne("lev-" + k).n` pour nommer les leviers fixés.
- Produces: `rechercher(opts, progres, arret)`, même contrat ; chaque retenue porte `state.typo.graine`.
- Algorithme : avec programme ou massing, un volume par essai (comme aujourd'hui, sans forcer de parti) ; typologies cochées → `parVolume` seeds `((rng() * 0x100000000) >>> 0) || 1`, chacune notée par `renoterTypo(ev0, MASS.vol, moyennesMain())`, la meilleure (note, puis moins d'erreurs rouges) gardée avant `resumeCourant()`. Typologies seules → chaque essai est une seed sur le massing à l'écran, `distincts` ignoré. `erreurs()` compte `mass.e + mix.e + typo.e`. Durée : 0,8 s par essai qui rebat programme ou massing, + 0,01 s par typologie (mesurer `resumeCourant()` pour le mode typologies seules et caler la constante).

- [ ] **Step 1: sonde node qui échoue** : `rechercher({ programme:false, massing:true, typologies:true, parVolume:3, essais:2, garder:2 })` → `trouves.length ≥ 1`, chaque `state.typo.graine` ≥ 1 ; `snapshot()` identique avant / après ; un `arret` qui rend vrai au premier essai rend l'état intact.
- [ ] **Step 2: implémenter.**
- [ ] **Step 3: la sonde passe** (si `net/variantes.js` ne s'importe pas sous node, la même vérification au navigateur).
- [ ] **Step 4: au navigateur** : le formulaire montre les résumés, la case par volume apparaît et disparaît, une recherche typologies seules enregistre des variantes qui, chargées, redonnent leur plan.
- [ ] **Step 5: commit** `variantes: the search follows the dice and draws typologies — per-volume tries, per-shuffle summary`

### Task 6: L'onglet Typologies et les variantes

**Files:**
- Modify: `src/views/render.js` (`window.typoEvaluation()` → `{ total, invalide, typo, crit:[{ n, val, unite, s }] }`)
- Modify: `src/typo/plans.html` (étape « 2 · Évaluation », Contrôle 3, Familles 4 ; classes `mass-axe` ; refaite à chaque `rejouer()`)
- Modify: `src/views/variantes.js` (ligne « Seed des typologies » du modal, `thumbnail.typo` ou « 1 (par défaut) » ; tri `typo` « Typologie » ; ligne typologies aux contrôles)

- [ ] **Step 1: au navigateur**, avant : pas d'étape Évaluation, pas de tri Typologie.
- [ ] **Step 2: implémenter.**
- [ ] **Step 3: au navigateur** : l'Évaluation suit le Shuffle typologie ; une variante d'avant montre « 1 (par défaut) » et sa note en italique ; le tri Typologie classe ; aucune erreur console.
- [ ] **Step 4: commit** `typologies: Évaluation step in the rail; variants show the typology seed and sort by it`

### Task 7: La doc, le quatrième snapshot

**Files:**
- Modify: `docs/typologies.md`, `docs/parametres.md`, `docs/variantes.md`, `CLAUDE.md` (section *Vérifier*, et « Une mesure du bâtiment »)

- [ ] **Step 1:** le quatrième snapshot dans `CLAUDE.md` :

```bash
node --input-type=module -e "
Promise.all([import('./src/mix/shuffle.js'),import('./src/mass/gen.js'),
             import('./src/mass/model.js'),import('./src/mass/mesures.js'),
             import('./src/typo/etat.js'),import('./src/data/jugement.js'),
             import('./src/core/rand.js')]).then(([S,G,M,E,T,J,R])=>{
  R.seed(1);
  S.repartir({ alea:false, etages:true });
  M.massSet('parti','auto');
  M.massVols(G.genMass(11));
  [1,2,3,4,5].forEach(function(g){
    T.TYPO.graine = g;
    var ev = E.evaluationCourante(), m = ev.mes;
    console.log('typo', g, '· jugement', ev.jugement.total, '· typologie', Math.round(100 * J.scoreTypo(ev.jugement)) + ' %',
      '· classes', m.classesSoleil, '· liens', m.liensPlan, '· circ', m.circPlan, '· bruit', m.murBruyant,
      '· noyaux', m.noyaux, '· grappes', m.grappes, '· tech', m.techGroupes, '· posé', m.posePlan, '· jour', m.couloirsJour,
      '· écarts', ev.ecarts.filter(function(x){ return x.c === 'typo'; }).map(function(x){ return x.k; }).join(',') || '—');
  });
});"
```

- [ ] **Step 2:** la doc, chacun dans sa section.
- [ ] **Step 3:** les quatre snapshots passent.
- [ ] **Step 4: commit** `docs: typology score, the search over typologies, variants v4`
