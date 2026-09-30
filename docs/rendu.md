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

## Diagrammes — l'évolution du volume

Le volume est généré ; la planche en fait le RÉTRO-DESSIN, d'une boîte très simple jusqu'au
volume généré, par des transformations crédibles. Le raisonnement s'adapte au volume, jamais
l'inverse : la dernière case dessine les étages tels que `etagesDe()` les donne, sans retouche,
et chaque étape est tirée de cette géométrie finale (`analyse()`).

| étape | ce qu'elle fait | quand |
|---|---|---|
| LE BLOC | la plus petite boîte, dans l'axe de la plus grande emprise, qui contient tout le projet à sa hauteur maximale | toujours |
| DÉTACHER / ÉVIDER / DÉCOUPER | ne garder que les emprises réelles, pleine hauteur ; le vide (m², %) devient cour | toujours — le verbe suit le nombre de bâtiments et la part de vide |
| ANCRER | la salle de sport descend à sa hauteur | salle de sport imposée |
| ABAISSER | les corps qui portent moins de niveaux descendent | s'il y en a |
| EN RETRAIT | les étages plus petits que le rez se retirent | s'il y en a |
| LE SECOND TEMPS | piscine et CAD en pointillé | s'ils sont posés |
| LE VOLUME | le volume généré, identique, dans les couleurs du programme | toujours |

Aucune étape n'est ajoutée pour faire nombre. Volumes blancs, ce que l'étape change en orange,
flèches noires. La même planche s'affiche dans le rail du massing (bloc « Diagramme »).
