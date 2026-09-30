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

## Diagrammes — le volume en quatre gestes

| case | ce qu'elle montre |
|---|---|
| 01 LE BLOC | tout le volume de l'école (hors salle de sport) en un seul bloc, à l'emprise de la figure : trop profond pour éclairer une classe |
| 02 SÉPARER | le bloc partagé en corps de la profondeur tirée, rangés selon le parti ; même volume — s'il ne se partage pas, la case le dit |
| 03 ORIENTER | la figure tourne (angle et source : axe, soleil-vue, libre, pente) et se pose d'un bloc sur la parcelle |
| 04 LES NIVEAUX | chaque corps monte de ce qu'il porte, le dernier niveau en orange ; la salle de sport, accolée ou à part |

Chaque geste garde le même volume et part du précédent. Tout vient de ce que le générateur a
produit : `vols.trace` (la figure en coordonnées locales, l'angle et sa source), `vols.T` (la
translation), `etagesDe()` (les étages posés). Volumes blancs, ce que le geste change en
orange, flèches noires. La même planche s'affiche dans le rail du massing (bloc « Diagramme »).
