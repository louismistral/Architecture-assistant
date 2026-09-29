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
Hors parcelle, une seule chose : l'échelle graphique (`BASE.barre`), à gauche du nord de la base.
**L'échelle est 1:500 et ne change jamais** : `BASE.k` se déduit de `BASE.echelle`, rien ne
l'ajuste à la page — la planche s'imprime à 100 %. Le stationnement n'est pas dessiné.

## Diagrammes — le processus

Le raisonnement du générateur (`genMass`), dans son ordre, une case par décision RÉELLEMENT
prise pour la composition à l'écran : le site, le programme mis en volume, le recul, la figure
du parti, l'orientation, la salle de sport (s'il y en a une), les étages, le sous-sol (s'il y
en a un), les passerelles (s'il y en a), le tri. Le nombre de cases suit, la grille aussi
(3 colonnes jusqu'à 9 cases, 4 au-delà). Chaque case dit ce qui a décidé, lu dans l'état :
hauteurs du mixer, recul, profondeur tirée, angle, essais et variantes valides, note.

Le style est celui de la référence `diagramme.pdf` : fond blanc, contexte gris (`SITE.bat`),
parcelle au trait rouge, volume saumon et flancs brique, flèches noires, soleil ; les couleurs
de famille (`cssRGB()`) n'arrivent qu'à la dernière case. La même planche s'affiche dans le rail
du massing (bloc « Diagramme »), refaite à chaque génération ; un clic mène au rendu.
