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

## Diagrammes — la logique de composition

Comment CE bâtiment a été composé, dans l'ordre du générateur, dessiné à partir de ce qu'il a
réellement produit : `genMass` pose `vols.trace` = { S (la figure en coordonnées locales, avant
implantation), th et cap (l'angle et sa source), prof, A et N (surfaces et hauteurs par
niveau), imp (la salle de sport), lo/hi (bornes de profondeur) }, et `vols.T`, `vols.essais`,
`vols.valides`, `vols.props`.

| case | ce qu'elle montre |
|---|---|
| LES SURFACES | les m² hors sol par niveau, en barres ; la part de la salle de sport au rez |
| LE SPORT À PART | la salle double sort du rez, jamais découpée |
| LA PROFONDEUR | une coupe : l'épaisseur tirée, et le maximum = deux classes + couloir |
| LES CORPS | les corps hauts (jusqu'en haut, étages en retrait de largeur) et bas (rez seul) |
| LA FIGURE | la règle du parti (`FIGURE`) appliquée à ces corps, hors site |
| L'ANGLE | en plan : la figure avant et après rotation, et la source de l'angle (`CAP`) |
| POSER | la figure d'un bloc sur la parcelle, dans le recul |
| ANCRER | la salle de sport accolée à un corps, ou à part au point bas |
| CREUSER | le sous-sol sous le corps le plus haut du terrain — s'il y en a un |
| RELIER | les passerelles — s'il y en a |
| TRIER | une case par essai : noir = retenue, orange = valide, blanc = écartée |
| HABITER | la composition dans les couleurs du programme |

Volumes blancs, ce que l'étape fait en orange (`ENCRE.accent`), flèches noires, un verbe en
gras. La même planche s'affiche dans le rail du massing (bloc « Diagramme »).
