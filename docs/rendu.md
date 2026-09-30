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

## Diagrammes — la volumétrie, geste par geste

On raisonne À L'ENVERS : le volume est donné, on cherche par quels gestes un architecte y
serait arrivé, et pourquoi chacun — à la manière des diagrammes de BIG, où chaque geste a une
raison lisible. La raison est MESURÉE sur le volume final (`lire()`), jamais inventée ; la
dernière case dessine les étages de `etagesDe()` sans retouche.

| geste | ce qu'il fait | sa raison, lue sur la forme | quand |
|---|---|---|---|
| LE BLOC | le programme de l'école (hors salle de sport) en une boîte, axée au nord | — | toujours |
| TOURNER | la boîte prend l'axe du plus grand corps | les longues façades vers … | angle > 3° |
| CREUSER | le vide de la boîte devient la cour | la direction où elle s'ouvre (le soleil si c'est le sud) | vide > 12 % |
| FENDRE | l'école se sépare en bâtiments | passages entre eux (flèches vertes) | plusieurs bâtiments |
| ABAISSER | les corps qui portent moins de niveaux descendent | vers le Casino (le plus grand bâtiment du relevé) ou vers un bord | s'il y en a |
| ANCRER | la salle de sport se pose | accolée ou à part, sur le point bas | salle imposée |
| GRADINER | les étages se retirent en terrasses | vers la vue (`cibleVue`) ou le soleil | s'il y en a |
| LE PROJET | le volume généré, identique, en couleurs de programme | — | toujours |

Volumes blancs, le geste en orange, raisons en flèches et icônes (soleil, œil), le Casino en
gris clair. La même planche s'affiche dans le rail du massing (bloc « Diagramme »).
