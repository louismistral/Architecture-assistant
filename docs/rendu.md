# Rendu — les planches de chaque étape

Un volet par étape du projet (`ETAPES`, `src/data/planches.js`) : Massing, Typologies,
Tectonics, Materiality, Rendu final. Chaque volet rend ses planches en PDF, au format
d'impression, à partir de la composition à l'écran. Seul le massing est construit.

```
src/core/pdf.js          un dessin vectoriel (trace), deux sorties : SVG (écran) et PDF (impression)
src/rendu/siteplan.js    plan de situation A2 1:500, posé sur la base du géomètre
src/rendu/mobilite.js    bus, dépose-minute, parkings, vélos, piétons — dessinés autour des volumes
src/rendu/diagramme.js   planche de diagrammes A2 : huit axonométries, du site au volume
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
(toitures blanches, ombres grises vers le sud-est, `ENCRE`), le second temps en pointillé,
et la mobilité. Les cotes du stationnement sont dans `RULES.ext`. Les côtés d'accès (`ACCES`)
sont une HYPOTHÈSE : le relevé ne nomme pas les routes — rue du Casino = côté nord-ouest (le
long du Casino), chemin du Petit Mont = côté sud. Le parking se pose en un à trois lots, le
plus près de la rue du Casino ; ce qui ne tient pas est dit sous l'aperçu.

## Diagrammes

Huit cases, à la manière de BIG : le site, les limites, le programme (les dalles du mixer),
le parti, l'empilement (couleur de famille par étage), soleil et vue, la mobilité, le résultat
et sa note. Les couleurs de famille sont celles de `tokens.css`, résolues par `cssRGB()`. La
même planche s'affiche dans le rail du massing (bloc « Diagramme »), refaite à chaque
génération ; un clic mène au rendu.
