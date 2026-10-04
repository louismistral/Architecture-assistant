# Rendu — les planches de chaque étape

Un volet par étape du projet (`ETAPES`, `src/data/planches.js`) : Massing, Typologies,
Tectonics, Materiality, Rendu final. Chaque volet rend ses planches en PDF, au format
d'impression, à partir de la composition à l'écran. Seul le massing est construit.

```
src/core/pdf.js          un dessin vectoriel (trace), deux sorties : SVG (écran) et PDF (impression)
src/rendu/siteplan.js    plan de situation A2 1:500, posé sur la base du géomètre
src/rendu/diagramme.js   planche « processus » A2 : une axonométrie par décision du générateur
src/views/rendu.js       le volet : une carte par planche, aperçu + « Télécharger le PDF »
styles/rendu.css         son dessin
```

## Aucune dépendance

`trace(w, h)` accumule polygones, lignes, cercles, textes et découpes en points, y vers le
haut. `.svg()` sert l'aperçu, `.pdf()` le flux PDF — une planche ne se dessine qu'une fois.
`pdfNeuf(t)` écrit un PDF d'une page (Helvetica). `pdfSur(base, t)` AJOUTE `t` sur la première
page d'un PDF existant par une mise à jour incrémentale : le fichier d'origine reste intact
octet pour octet, la surcouche s'écrit à la suite (le contenu d'origine est enfermé entre
`q … Q`).

## Plan de situation

La base est `DOC/site-plan_base.pdf` (A2, 1:500, Illustrator). Son calage (`BASE` dans
`planches.js`) a été mesuré sur la parcelle rouge contre `PER` : même orientation,
1 m = 5,669 pt, écart maximal 0,1 mm. `DOC/site-plan_base.jpg` n'est que l'aperçu écran.

Tout ce qui est ajouté est découpé par la parcelle : les volumes dans le style de la base
(toitures blanches, ombres grises vers le sud-est, `ENCRE`), le second temps en pointillé.
**L'échelle est 1:500 et ne change jamais** : `BASE.k` se déduit de `BASE.echelle`, rien ne
l'ajuste à la page — la planche s'imprime à 100 %. Le stationnement n'est pas dessiné.

## Diagrammes — la volumétrie en quatre temps

| temps | ce qu'il montre |
|---|---|
| 01 LE CUBE | un cube qui fait exactement les m³ hors sol du projet (Σ emprise × hauteur de chaque étage) |
| 02 DIVISER | le cube partagé en autant de volumes que le projet a de corps, chacun à son emprise au sol DÉFINITIVE, à la hauteur qui garde les m³ ; la figure tournée en arrière de son angle |
| 03 ORIENTER | la figure tourne de son angle (source : `vols.trace.cap`) et se pose : chaque corps à sa place, même hauteur |
| 04 LES NIVEAUX | chaque corps prend sa vraie hauteur : le volume généré, identique (`etagesDe()`), en couleurs de programme, les hauteurs extrêmes cotées |

Le volume final n'est jamais retouché : tout est lu dessus (`lire()`). Les textes s'adaptent
(un seul corps, un angle nul, une hauteur unique). La même planche s'affiche dans le rail du
massing (bloc « Diagramme »).

## Midterm rendu

Deux pages A1 paysage sur le gabarit `DOC/MID_TERM.pdf`, suivi à la lettre (textes du gabarit
compris) : on ne fait que remplir deux cadres de la première page (`src/rendu/midterm.js`).

- **Site Plan 1.500** : la base du géomètre au 1:500, nord en haut, la parcelle centrée sur son
  emboîtement. Elle est déjà posée dans `DOC/midterm_base.pdf`, engendré par
  `python3 tools/midterm-base.py` à partir du calage `MIDTERM` de `planches.js` — à relancer si
  le gabarit, la base ou le calage changent. La parcelle (177 m) déborde d'un mètre de chaque côté
  du cadre (175 m) : le cadre la coupe. Le cadre (175 × 260 m) dépasse la page A2 de la base
  (285 × 197 m) : le script lève les découpes de cette page, et le relevé ENTIER que porte le
  PDF (405 × 256 m, sa texture d'herbe un peu plus) remplit le cadre, dans le style d'origine.
- **Schemes** : les quatre temps des diagrammes, en ligne (`diagrammes()`, partagé avec la
  planche A2).
- **Page 2** (Axonometry, Representative Floor plan 1:200, Free to Use) : celle du gabarit, telle
  quelle, dans le même PDF ; la carte l'affiche sous la première (`apercu2`).

`pdfSur` trouve la première page par l'arbre des pages : dans ce fichier, la page 2 est écrite
avant la page 1.

## Typologies — un plan par niveau, au 1:200

Une carte et un PDF par niveau (`src/rendu/etages.js`). Le plan est celui de l'onglet Typologies,
tel quel : le Rendu charge `src/typo/plans.html` hors de la vue (`typoHote()` lui donne ce qu'il
lit), et `typoPlanches()` dessine chaque niveau puis en rend la géométrie — couleurs résolues, en
mètres du site, le contexte marqué (`site`, `exist`, `ombre`). Rien n'est redessiné.

- **Échelle 1:200**, toujours (`ETAGES.echelle`). Le format est le plus petit de `ETAGES.formats`
  qui tient le bâti de TOUS les niveaux et la parcelle : le même pour chaque niveau, au même
  cadrage — les planches se superposent.
- **Le contexte s'éclaircit en montant** : du plus bas au plus haut niveau, ses couleurs vont vers
  le blanc de `ETAGES.clair[0]` à `ETAGES.clair[1]`.
- Un texte reste lisible : jamais tête en bas. Les traits d'écran (« non-scaling ») gardent une
  épaisseur fixe en points.
- Comme l'onglet Typologies, ouvrir le volet met le massing aux cotes des pièces.

### Les deux axonométries (`src/rendu/axo.js`)

Deux cartes en tête du volet Typologies, A1 paysage, dans la vue et le style des diagrammes du
massing (`VUE`, `axo()`, `prisme()` de `diagramme.js`) :

- **Axonométrie** : le volume tel que le massing le pose, étage par étage, sur la parcelle ;
  l'existant à sa hauteur (`SITE.bath`), le second temps en pointillé.
- **Axonométrie éclatée** : chaque niveau porte son plan des Typologies (`typoPlanches()`, sans
  cotes ni mobilier), sur une dalle tirée du poché extérieur. L'écart entre deux niveaux est
  `AXO.pas` fois la profondeur du plan dans la vue (1 : ils ne se couvrent plus), `AXO.ecart` m
  au moins.
