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

## Diagrammes — pourquoi ce volume

La planche est PROPRE À LA FORME posée, à la manière des diagrammes de BIG pour la LEGO House :
le contexte en gris clair, le volume en blanc, ce que la case explique en orange, un verbe en
gras. Le geste central dépend du parti (`GESTE` : un bloc se SERRE, une barre s'ÉTIRE, un U
ENCADRE, une cour se FERME, des pavillons se DISPERSENT…), et chaque case dit, avec les
mesures de la composition (`evaluationCourante()` : `mes` et `qualites`), ce que ce geste lui
vaut :

| case | ce qu'elle explique |
|---|---|
| LE SITE | la parcelle, le recul visé |
| UN BLOC | tout le volume en un bloc — trop profond pour éclairer une classe |
| (geste du parti) | le bloc se transforme en la figure du parti, et sa compacité |
| LA COUR | le vide que la forme tient, en m² utiles |
| LA PROFONDEUR | la profondeur des corps de classes : toutes en façade |
| LE SOLEIL | l'orientation des longues façades |
| LA VUE | si la vue compte : l'ouverture vers le dégagement |
| ANCRER | si une salle de sport est imposée : au rez, rien au-dessus |
| LA HAUTEUR | le nombre de niveaux et la hauteur, le corps le plus haut coté |
| L'ÉCOLE | le programme en couleurs, la note, les points forts |

La même planche s'affiche dans le rail du massing (bloc « Diagramme »), refaite à chaque
génération.
