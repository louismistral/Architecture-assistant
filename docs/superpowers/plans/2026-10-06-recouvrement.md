# Recouvrement dans un même bâtiment, phase 1 — plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal :** deux corps liés peuvent se recouvrir ; bilan, contrôle, jury et typologies comptent l'union une fois.
**Architecture :** la géométrie dans `mass/geom.js`, la règle dans `mass/model.js`, lue partout ailleurs.
**Spec :** `docs/superpowers/specs/2026-10-06-recouvrement-design.md`

## Global Constraints
- Le générateur ne change pas : `admissible`, `chevauche`, `degager`, `touchent` intacts.
- Snapshots de `CLAUDE.md` : sortie identique avant et après (référence prise avant la tâche 1).
- Contact sans recouvrement → 0 et 0 : aucun chiffre d'aujourd'hui ne bouge.
- Tests dans `node tools/claude.mjs test`, groupe « recouvrement » (le seul banc automatique du dépôt).

## Review Focus
1. Deux corps qui se touchent exactement (côté commun) : recouvrement et façade enfouie nuls.
2. Un corps fusionné (`ext`) recouvert par un autre : chaque part compte.
3. Un second temps (`ph`) posé sur un corps : ignoré (il n'est pas de l'enveloppe scolaire).
4. Deux corps NON liés qui se recouvrent : le contrôle continue de crier, le glisser refuse.
5. `partCedee` à égalité d'aire : l'ordre de `MASS.vol` tranche, et la somme des parts cédées = le recouvrement.

---

### Task 1 : la géométrie — `interConvexe(P, Q)`, `longueurDans(P, Q)` dans `mass/geom.js`
- [ ] Tests : carré 20×20 sur carré décalé de 15 → aire 100 ; carré tourné de 45° centré sur un carré de même côté → aire analytique `a²·(2√2 − 2)` ; côte à côte (contact) → `[]` ; `longueurDans` d'un carré dans un plus grand → son périmètre ; d'un carré posé contre → 0.
- [ ] Les voir échouer ; écrire ; les voir passer ; commit.

### Task 2 : la règle — `recouvrement(vols, i, murs)`, `partCedee(v, vols, i)` dans `mass/model.js` ; `bilan()` la lit
- [ ] Tests : deux corps liés 20×20 recouverts de 5×20 (intérieurs) → `bilan` posé = 700 au niveau ; non liés → 800 ; contact → 800 ; `ph` ignoré ; part fusionnée comptée ; `partCedee` au plus grand, somme = recouvrement (Focus 1, 2, 3, 5).
- [ ] Échec ; code ; succès ; snapshots identiques ; commit.

### Task 3 : le contrôle et le jury — `bilanDe`, `lire`, `terrainLibre`, écart « dist » (`mass/mesures.js`), `requilibre` (`mass/fix.js`)
- [ ] Tests : sur la paire recouverte, emprise et volume du jury retranchent le recouvrement hors tout ; façade retranche `enfouie × h` ; aucun écart `dist` entre liés avec distance incendie imposée, toujours un entre non liés (Focus 4) ; `requilibre` ramène l'UNION à la demande (écart < 1 % au niveau).
- [ ] Échec ; code ; succès ; snapshots ; commit.

### Task 4 : la main — `chevaucheMain(v, vols, x, y, a)` (`mass/gen.js`), lue par `views/plan.js` (`tient`, glisser)
- [ ] Tests : liés qui se recouvrent → faux ; non liés → vrai ; `chevauche` inchangé (vrai dans les deux cas).
- [ ] Échec ; code ; succès ; commit. Vérification navigateur : glisser accepté.

### Task 5 : les typologies et le Rendu — `cede` par étage (`typo/donnees.js`), lu par `typo/gen.js` (répartition, `manque`) et `typo/mesures.js` (feu, circulation) ; `rendu/diagramme.js` (m³, emprise)
- [ ] Tests : `donneesTypo()` porte `cede` sur l'étage du petit corps, 0 sur le grand ; `planifier` ne donne pas au petit corps plus que sa capacité moins `cede`.
- [ ] Échec ; code ; succès ; snapshots ; commit.

### Task 6 : la doc et la fin
- [ ] `docs/massing.md` : une section courte « Le recouvrement », dans la section de l'onglet, dernier commit isolé.
- [ ] Relecture fraîche de la branche ; corrections ; rebase ; snapshots ; PR ; merge.
- [ ] Recomposer « Notre projet » comme le croquis, rose posé sur la barre ; variante `claude`.
