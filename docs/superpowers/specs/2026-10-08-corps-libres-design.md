# Les corps libres — un massing de Rhino revient tel qu'il est

2026-10-08 · demande de Louis : « la forme ne doit pas être adaptée, elle doit arriver comme elle est.
Je veux noter ce volume puis faire des générations de typo dedans. »

## Ce qui n'allait pas

L'import (`mass/import.js`) reconstruisait des corps du GÉNÉRATEUR à partir des solides : il
empilait des boîtes de solides différents, plaquait chaque étage sur la pile du mixer de l'état
(un niveau absent : l'étage jeté en silence), reposait chaque corps sur le terrain, fusionnait,
redressait, devinait la salle de sport et le second temps à leurs cotes. Sur `export volume.3dm`
(13 solides) : 10 corps, le sous-sol et tout le 2e étage perdus, la salle de sport à 10,20 m au
lieu de 7, des L recoupés en rectangles qui débordent, tout remonté de 20 cm.

## Les décisions (Louis, 2026-10-08)

1. **Formes libres** : n'importe quel prisme droit — un polygone extrudé, à angles quelconques —
   revient exact.
2. **Les sous-calques de Volume sont le programme** : `Ecole`, `UAPE`, `Salle de sport`,
   `Public et communale`, `Conciergerie et technique` disent quel chapitre va dans quel solide. Le
   mixer et les Typologies le respectent.
3. **La pile suit le volume** : l'import règle la pile du mixer sur les niveaux du fichier, puis
   répartit le programme dessus.
4. **Les contrôles jugent tel quel** : rien n'est corrigé ; ce qui enfreint le cadre le dit.

## Le corps libre

Un corps `libre:1` est un SOLIDE du fichier, rien d'autre — jamais empilé avec un autre, jamais
fusionné, jamais redimensionné par l'app.

```
{ id, libre:1, x, y, a, bat, par, nom, ph, fix, key,
  lv:[ { i, h, z0, chap,
         poly:[[u,v]…],                  le contour HORS TOUT, dans le repère du corps
         rects:[{ dx, dy, w, d, a }],    l'INTÉRIEUR découpé en rectangles, chacun son angle
         aire,                           la surface intérieure exacte (le polygone moins ses murs)
         w, d, dx:0, dy:0 } ] }           le plus grand rectangle, pour ce qui lit encore w × d
```

- `x, y, a` : le centre et l'axe principal du solide ; le polygone et les rectangles sont dans ce
  repère, donc déplacer ou tourner le corps dans l'app emporte tout.
- `z0` : l'altitude ABSOLUE du plancher, lue dans le fichier (Rhino 0 = 465 m) ; `h` sa hauteur.
  `etagesDe()` les prend telles quelles — ni terrain, ni altitude commune de l'école.
- Un solide coupé par un plafond de niveau (son toit tombe, à 10 cm, sur le toit d'un autre
  niveau) porte un étage par niveau ; sinon c'est UN étage de grande hauteur (la salle de sport,
  la piscine).
- Les solides qui se touchent ou se superposent font un bâtiment (`bat`).
- `chap` : le chapitre de son calque. `infra` fait un ouvrage du second temps (`ph:2`) ; le solide
  `sport` qui loge la salle double la porte (`fix:1`, `key`, `keys`).

### La découpe

L'intérieur (le polygone rentré de `RULES.haut.mur`) se découpe en rectangles, chacun dans
l'orientation d'un groupe de côtés : la grille des sommets dans l'axe du groupe dominant, le plus
grand rectangle de cellules pleines d'abord ; puis, pour ce qui reste, le groupe suivant — un
rectangle peut y recouvrir les premiers, il doit couvrir du neuf. Exacte pour toute forme
orthogonale, en autant d'orientations qu'on veut ; un côté en biais laisse une frange non
couverte, que le bilan dit (`couvert`). Les rectangles servent à ce qui raisonne en rectangles —
distances, recul, ensoleillement, plans des Typologies ; le polygone sert au contour, à l'aire,
au dessin, à la 3D et à l'export.

## Ce qui change, où

- `mass/libre.js` (nouveau) : du solide au corps — le prisme, le contour, le retrait des murs, la
  découpe, l'extrusion triangulée (oreilles) pour la 3D et l'export.
- `mass/import.js` : un fichier dont les solides ne viennent pas de l'app (sans « Saxon corps »)
  se lit en corps libres ; la pile du mixer est posée (`setStack`) avant.
- `mass/model.js` : une branche `libre` dans `volRects`, `volInts`, `contourDe`, `aireEtage`,
  `etagesDe`, `assiseEff`, `datumEcole`, `mursDe`, `dessinDe`, `pontRect`.
- `mass/etat.js — volsOf` : les nouveaux champs survivent.
- `mass/gen.js`, `mass/fix.js` : rien ne retaille un corps libre.
- `mass/mesures.js`, `mass/checks.js` : les mesures propres aux barres du générateur (module,
  élancement, profondeurs de parts, porte-à-faux) se taisent sur un corps libre ; `normale()`
  lit l'angle du rectangle.
- Les vues (`plan.js`, `vue3d.js`, `massing.js`), l'export `.3dm`, les vignettes, `claude.mjs`
  dessinent le polygone ; les poignées qui retaillent se cachent.
- `mix/shuffle.js` : les chapitres des corps libres restreignent les niveaux d'un poste
  (`rangeOf`) et la place qu'un chapitre a sur un niveau (`poser`).
- `typo/donnees.js`, `typo/gen.js` : une aile par rectangle, son chapitre ; une pièce ne va que
  dans une aile de son chapitre.

## Hors champ

Un toit en pente (le solide n'est pas un prisme droit) est refusé avec son nom. Un trou (une cour
dans un seul solide) : le contour extérieur seul, pour l'instant.
