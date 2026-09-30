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

## Diagrammes — comment le volume est né

Le raisonnement du générateur, étape par étape, tel qu'il le tient :

| étape | ce qu'on voit |
|---|---|
| PROGRAMME | une colonne par famille, haute de ses m² (`ITEMS`, `FAM`) |
| EMPILER | les niveaux du mixer en dalles éclatées, découpées par famille (`postesDe`) |
| DÉCOUPER | chaque corps et ses étages, alignés, à la profondeur tirée (`V.profMin/profMax`) |
| ASSEMBLER | la figure du parti, hors du site |
| POSER | la figure sur la parcelle, dans le recul visé |
| VÉRIFIER | une case par essai : orange s'il tient toutes les règles dures, barré sinon (`vols.essais`, `vols.valides`, comptés par `genMass`) |
| CLASSER | les meilleures variantes et leur note (`vols.props`) — les barres montrent l'écart |
| HABITER | la composition retenue, dans les couleurs de ses familles |

À la manière de BIG : un verbe en gras par case, volumes blancs, ce que l'étape fait en orange
(`ENCRE.accent`), flèches entre les cases ; la grille prend le nombre de colonnes qui donne les
plus grands dessins. La même planche s'affiche dans le rail du massing (bloc « Diagramme »),
refaite à chaque génération.
