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

## Diagrammes — comment ce volume a été trouvé

Le générateur ne conçoit pas un parti : il TIRE des compositions au hasard dans un cadre fixe,
écarte celles qui enfreignent une règle dure, et garde la mieux notée. La planche le dit tel
quel, avec ce qu'il a réellement produit, sans rien reconstruire après coup :

| case | ce qu'elle montre | d'où |
|---|---|---|
| CE QUI EST FIXÉ | surfaces par niveau, salle de sport, recul, bornes de profondeur | `vols.trace` |
| CE QUI EST TIRÉ | parti, profondeur, source de l'angle, angle, position, corps, salle de sport, passerelles | `vols.trace`, `vols.T` |
| ESSAYER | une case par essai : noir la retenue, orange les valides, blanc les écartées | `vols.essais`, `vols.valides` |
| ÉCARTER | les causes des essais écartés, comptées | `vols.echecs` |
| LES SURVIVANTES | la meilleure de chaque parti et sa note | `vols.props` |
| POURQUOI CELLE-CI | les axes du jugement, la retenue contre la deuxième ; une égalité est dite | `evaluer()` |
| LE VOLUME RETENU | dans les couleurs du programme | |

`genMass` pose `vols.trace`, `vols.essais` et `vols.echecs` sur chaque variante qu'il rend.
La même planche s'affiche dans le rail du massing (bloc « Diagramme »).
