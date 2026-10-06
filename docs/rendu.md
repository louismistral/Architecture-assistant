# Rendu — les planches de chaque étape

Un volet par étape du projet (`ETAPES`, `src/data/planches.js`) : Massing, Typologies,
Tectonics, Materiality, Rendu final. Chaque volet rend ses planches à partir de la composition
à l'écran. Tectonics et Materiality sont à construire.

## Les formats d'export

En tête de chaque carte : le format, puis le bouton. Le choix vaut pour toutes les cartes.

| format | pour | ce qu'il porte |
|---|---|---|
| PDF | imprimer | la planche au format, sur la base du géomètre ou le gabarit s'il y en a un |
| SVG | Illustrator | aplats, traits, textes, découpes — une page, un fichier |
| DXF | AutoCAD, Rhino, Archicad | DXF 2000 : polylignes, hachures pleines, cercles, textes éditables |

Le DXF (`dxf(t, t2)`, `core/pdf.js`) se travaille comme un dessin fait à la main : chaque
entité garde sa couleur exacte et son pointillé (un type de ligne par motif). Ses calques sont
ceux de la **convention** (`data/calques.js`, `docs/echange.md`) : un trait va au sous-calque de
`2D$Courbes` de la taille la plus proche (`01 XXS` à `06 XL`), qui porte l'épaisseur ; les aplats
à `2D$Hatchs`, les textes à `2D$Textes` (style `GRAS` pour le gras). Le chemin s'écrit avec `$` :
AutoCAD refuse `:` dans un nom de calque. Unités : **le millimètre sur le papier** — la planche s'ouvre à l'échelle de son
PDF. Les découpes sont appliquées à la géométrie, rien ne déborde (exact pour une découpe
convexe ; contre la parcelle, une surface à cheval est coupée au mieux). Une page suivante se
pose à droite de la première. Ni la base du géomètre ni le gabarit n'y sont : seule notre
surcouche. Le DWG est binaire et fermé : AutoCAD ouvre le DXF et l'enregistre en DWG.

```
src/core/pdf.js          un dessin vectoriel (trace), deux sorties : SVG (écran) et PDF (impression)
src/rendu/siteplan.js    plan de situation A2 1:500, posé sur la base du géomètre
src/rendu/diagramme.js   planche « processus » A2 : une axonométrie par décision du générateur
src/views/rendu.js       le volet : une carte par planche, aperçu + export PDF, SVG ou DXF
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
- **Page 2** — sur les plans des Typologies (`typoPlanches()`, chargés une fois par `plansTypo()`) :
  **Axonometry** porte l'axonométrie du volume à gauche, plus petite, et l'éclatée à droite, sur toute la hauteur du cadre (`dessinVolume`,
  `dessinEclatee`) ; **Representative Floor plan 1:200** porte le plan du **rez** seul, au 1:200,
  centré sur ses bâtiments et coupé où le cadre s'arrête (`dessinPlan`). « Free to Use » reste libre. `pdfSur(base, t, t2)` pose les deux pages.

`pdfSur` trouve la première page par l'arbre des pages : dans ce fichier, la page 2 est écrite
avant la page 1.

## Typologies — un plan par niveau, au 1:200

Une carte et un PDF par niveau (`src/rendu/etages.js`). Le plan est celui de l'onglet Typologies,
tel quel : le Rendu charge `src/typo/plans.html` hors de la vue (`typoHote()` lui donne ce qu'il
lit), et `typoPlanches()` dessine chaque niveau puis en rend la géométrie — couleurs résolues, en
mètres du site, le contexte marqué (`site`, `exist`, `ombre`). Rien n'est redessiné.

- **Échelle 1:200**, toujours (`ETAGES.echelle`), dite dans le titre ; l'échelle graphique, les
  cotes (en cm), les axes et les cotes de niveau de l'écran sont repris tels quels, à l'encre ; le
  nord aussi. **Les étages inférieurs** s'y lisent en trait : le contour extérieur de
  chacun de leurs corps, en tirets gris (`ETAGES.dessous`). Le format est le plus petit de `ETAGES.formats`
  qui tient le bâti de TOUS les niveaux et la parcelle : le même pour chaque niveau, au même
  cadrage — les planches se superposent.
- **Feuille blanche, notre bâtiment seul sur fond noir** (`NUIT`) : le NÉGATIF d'un plan à l'encre.
  Ce que la coupe tranche — murs extérieurs, cloisons à leur épaisseur réelle, gaine d'ascenseur —
  en **poché gris** (`NUIT.poche`) ; les sols et les percements rendent le fond noir ; tout le reste
  en trait blanc ; contexte, cotes, échelle et nord à l'encre noire sur le papier. `trait()`
  (`etages.js`) dessine chaque élément par son RANG dans la hiérarchie (`p.w`, la classe `w-*` de
  l'écran) : **une seule table d'épaisseurs, `TRAITS`** (`planches.js`, en mm sur le papier), lue
  aussi par l'écran — coupe 0,50 · menuiseries 0,25 · vu 0,18 · au-dessus 0,18 en tirets · axes
  0,13 en trait mixte · cotes 0,09. L'éclatée les réduit (`ECH`) et prend le même trait.
- **L'existant** en aplat gris très clair sans trait (`ETAGES.existant`), comme dans l'axonométrie
  du volume.
- **Le contexte s'efface en montant** : du plus bas au plus haut niveau, il se fond dans le papier de
  `ETAGES.clair[0]` à `ETAGES.clair[1]`.
- Un texte reste lisible : jamais tête en bas. Les traits d'écran (« non-scaling ») gardent une
  épaisseur fixe en points.
- Comme l'onglet Typologies, le volet lit le massing tel qu'il est : les plans se dessinent dans ses
  volumes, sans les recoter.

### Les deux axonométries (`src/rendu/axo.js`)

Deux cartes en tête du volet Typologies, A1 paysage, dans la vue et le style des diagrammes du
massing (`VUE`, `axo()`, `prisme()` de `diagramme.js`) :

- **Axonométrie** : chaque corps de chaque niveau (`typoPlanches()`) en bloc **noir** à la
  hauteur de l'étage — les volumes seuls, sans les pièces —, ce qu'il porte **nommé en blanc**, et
  seulement sous ces cinq noms (`AXO.noms`) : École primaire, Salle de sport,
  UAPE, Locaux techniques, Piscine — le chapitre de la pièce (`data-chap` du plan), le local CAD
  avec les locaux techniques. À plat sur ses faces, en lettres qui prennent toute la place : sur le
  dessus sur l'emprise des pièces de chaque nom (tout le dessus s'il est seul), sur les façades vues le long des pièces qui les touchent. Un texte est écrit dans le
  plan de sa face (`m` de `trace.texte`), jamais en miroir ; un volume peint plus tard couvre la
  face et son texte (`apres` dans `peindre`). L'existant en volumes pleins clairs, sans trait (`AXO.existant`), la parcelle en tirets.
- **Axonométrie éclatée** (A1 portrait) : chaque niveau porte son plan des Typologies
  (`typoPlanches()`, sans cotes ni mobilier), sur une dalle tirée du poché extérieur, avec ses
  **murs coupés** à `AXO.murs` m — l'enveloppe entre le poché et la circulation, les cloisons sur
  les côtés des pièces (`AXO.cloison`), dessus poché. Feuille blanche ; dalles et murs noirs en trait blanc, sans aplat (`NUIT`) ;
  dalles et murs noirs aux arêtes blanches ; au rez, la parcelle en trait tireté (le cadrage la
  tient) ; chaque noyau relié en tirets à celui qu'il porte au
  niveau du dessus. L'écart entre deux niveaux est `AXO.pas`
  fois la profondeur du plan dans la vue (au-delà de 1, un blanc les sépare), `AXO.ecart` m au
  moins.

**L'échelle du midterm, vérifiée** : le plan « Representative Floor plan 1:200 » se pose à
`K = 1000 / 200 × 72 / 25,4` pt par mètre (5 mm pour 1 m), sur une page A1 de 2381,1 × 1683,8 pt
— celle du gabarit, sans mise à l'échelle (le contenu d'origine entre `q … Q`). Les primitives des
Typologies sont en mètres : la salle de sport y mesure 33 × 29 m hors tout (32 × 28 + les murs).

## Rendu final — les cinq planches du règlement

Art. 1.20 et 1.21 : au plus **cinq planches A1 paysage**, affichées selon le schéma (1 Situation,
2, 3 en haut ; la maquette ; 4, 5 en bas). `src/rendu/final.js`, réglages dans `FINAL`
(`planches.js`).

| planche | ce qu'elle porte |
|---|---|
| 1 Situation 1:500 | sur `DOC/final_base.pdf` (la base du géomètre, relevé entier, engendrée par `python3 tools/final-base.py` à partir de `FINAL.calage` — à relancer si le calage change) : la volumétrie (`situation()`), la plus courte distance de chaque corps à la limite, les cotes du rez, du terrain naturel et de l'acrotère, en msm |
| 2 Plan du rez 1:200 | le plan des Typologies, avec ses abords, centré sur le bâti ; les traits de coupe A-A et B-B |
| 3 Plans des niveaux 1:200 | les autres niveaux, à leur taille, les plus larges d'abord |
| 4 Façades et coupes 1:200 | la façade longue et la coupe A-A dans la longueur du corps principal, la façade courte et la coupe B-B en travers ; terrain naturel du relevé (`terrain()`), cotes d'altitude de chaque plancher et acrotère |
| 5 Planche explicative | a insertion (les quatre temps), b concept (l'axonométrie), c structure (l'éclatée, les noyaux, `RULES.seisme`), d incendie (les cages de chaque niveau et leur rayon de `RULES.feu.fuiteSimple` m) |

- **Trait noir sur fond blanc** (art. 1.21) : plans, coupes et façades prennent la palette
  `JOUR`, le positif de `NUIT` — `dessinPlan(…, pal)` et `trait(…, pal)`.
- **Anonymat** (art. 1.22) : chaque planche porte « Concours CS Saxon » et `FINAL.devise` —
  à remplacer par la devise du groupe.
- **Les planches 3 et 4 se rangent ensemble** (`finalNiveauxFacades`) : au 1:200, tout est à sa
  taille ; ce qui ne tient pas sur sa planche prend la place libre de l'autre, et ce qui ne tient
  nulle part se dit en rouge sur les deux.
- Les façades et les coupes se lisent sur les volumes du Massing, en boîtes : la façade montre
  les corps et leurs étages, la coupe tranche dalles et pignons (`FINAL.dalle`, `FINAL.mur`). Ni
  baies ni structure : elles viendront de Tectonics et Materiality.
- Ce que le règlement demande encore et que la planche 1 ne dessine pas : les entrées, les
  circulations, les aménagements extérieurs.
