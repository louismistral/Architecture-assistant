# Recouvrement dans un même bâtiment, phase 2 — plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal :** deux corps liés qui se recouvrent se dessinent, s'exportent et se relisent comme leur union.
**Architecture :** la géométrie dans `mass/geom.js` (`moins`, `horsDe`), le dessin dans `mass/model.js`
(`dessinDe`), lu par le plan, la 3D et l'export.
**Spec :** `docs/superpowers/specs/2026-10-06-recouvrement-dessin-design.md`

## Global Constraints
- Sans recouvrement, rien ne change : `dessinDe` rend `null`, chaque appelant garde son chemin d'avant.
- Snapshots de `CLAUDE.md` et 72 tirages main ↔ branche identiques (référence prise avant la tâche 1).
- Tests dans `node tools/claude.mjs test`.

## Review Focus
1. Les morceaux sont disjoints et couvrent exactement l'union (aplat, murs, cellules).
2. Le maillage exporté est fermé, sans sommet en T, et ne recoupe pas le grand corps.
3. L'import d'un fichier SANS chaînes d'objet (Rhino à la main) se lit comme avant.
4. `recoller` : le générateur ne voit aucune différence.

---

### Task 1 : `moins`, `horsDe` (geom.js)
- [ ] Tests `rec_moins`, `rec_bords` ; échec ; code ; succès ; commit.

### Task 2 : `dessinDe` (model.js)
- [ ] Test `rec_dessin` : murs des deux + intérieurs (le cédé privé du commun) = union hors tout ; `null`
  pour non liés et au contact. Échec ; code ; succès ; commit.

### Task 3 : le plan et la 3D
- [ ] `views/plan.js`, `views/vue3d.js` lisent `dessinDe` ; vérification dans le navigateur ; commit.

### Task 4 : l'export et l'import Rhino
- [ ] Tests `rec_export` (fermé, volume), `rec_rhino_lien` (aller-retour : la paire revient liée,
  même recouvrement). Échec ; code ; succès ; `rhino_aller_retour` toujours vert ; commit.

### Task 5 : les mineurs
- [ ] `rec_sol` (emprise d'un corps perché), `rec_typo_entier` (étage tout cédé hors des plans),
  `rec_recoller` ; échec ; code ; succès ; commit.

### Task 6 : la fin
- [ ] Snapshots, 72 tirages, tests ; relecture fraîche ; rebase ; doc `docs/massing.md` en dernier commit ; PR ; merge.
