# Le recouvrement dans un même bâtiment — phase 1 : des chiffres justes

*Spec du 6 octobre 2026. Phase 2 : le dessin (un seul contour au plan, la 3D, l'export Rhino).*

## Pourquoi

Un bloc posé en biais sur le bout d'une barre — le croquis de « Notre projet » — se dessine en
superposant deux rectangles : leur union fait la jonction, sans escalier. L'app l'interdit (« rien ne
se superpose ») parce que tout y suppose que deux corps ne se recouvrent jamais : le bilan compterait
deux fois la partie commune, le jury aussi, les typologies y paveraient deux fois.

Phase 1 : **deux corps LIÉS (`lies()` : même `bat`, ou `joint`) peuvent se recouvrir, et tout ce que
le contrôle et le jury lisent compte leur union une seule fois.** Le dessin reste celui de deux
rectangles superposés (phase 2).

## Ce qui ne change pas

- **Le générateur ne produit toujours aucun recouvrement** : `admissible`, `chevauche`, `degager`,
  `touchent` restent tels quels. Les snapshots de `CLAUDE.md` rendent exactement la même sortie.
- Deux corps qui se TOUCHENT sans se recouvrir donnent un recouvrement nul et une façade enfouie
  nulle : aucune composition d'aujourd'hui ne bouge d'un chiffre.
- Deux corps NON liés ne se recouvrent toujours pas.

## La règle, en un endroit

`src/mass/geom.js` — la géométrie, pure :

- `interConvexe(P, Q)` : l'intersection de deux polygones convexes (Sutherland–Hodgman), `[]` si
  elle est vide ou d'aire nulle.
- `longueurDans(P, Q)` : la longueur du contour de `P` STRICTEMENT à l'intérieur du convexe `Q` — un
  côté posé sur le bord de `Q` (un contact) ne compte pas.

`src/mass/model.js` — la règle :

- `recouvrement(vols, i, murs)` → `{ aire, enfouie }` : pour chaque paire de corps liés, hors second
  temps, qui portent l'étage `i`, chaque part contre chaque part (un corps fusionné a plusieurs
  parts). `murs` faux : les intérieurs (surfaces de plancher) ; vrai : les emprises hors tout
  (emprise, volume) et `enfouie`, la façade de l'un prise dans l'autre.
- `partCedee(v, vols, i)` → m² : ce que `v` cède à l'étage `i` aux corps liés PLUS GRANDS que lui à
  cet étage (à égalité, l'ordre de `MASS.vol`). La partie commune appartient au plus grand : la barre
  garde son programme, le bloc posé dessus en cède. Les parts cédées se resomment exactement à
  `recouvrement(vols, i, false).aire`.

Paire par paire : une zone commune à TROIS corps serait comptée de travers
(`ponytail:` à reprendre en vraie union de polygones si ça arrive).

## Qui la lit

| où | ce qui change |
|---|---|
| `mass/model.js — bilan()` | posé par niveau = Σ intérieurs − `recouvrement(…, false).aire` |
| `mass/mesures.js — bilanDe()` | idem, pour des volumes qui ne sont pas ceux de l'écran (contrôle « surfaces ») |
| `mass/fix.js — requilibre()` | la somme d'où se tire le facteur d'échelle est l'union |
| `mass/mesures.js — lire()` | emprise − recouvrement hors tout au rez ; volume − recouvrement × hauteur, étage par étage ; façade − `enfouie` × hauteur ; plancher − recouvrement intérieur |
| `mass/mesures.js — terrainLibre()` | emprise − recouvrement hors tout au rez |
| `mass/mesures.js — ecarts()` « dist » | deux corps liés ne se doivent aucune distance : jamais « s'interpénètrent » |
| `mass/gen.js — chevaucheMain()` (nouvelle, à côté de `chevauche`) | la règle du geste à la main : comme `chevauche`, sauf entre corps liés |
| `views/plan.js` — `tient`, glisser | lisent `chevaucheMain` : on peut poser un corps sur un corps du même bâtiment |
| `mass/gen.js — fusionner()` | un recouvrement entre corps liés compte comme un contact pour le regroupement en bâtiments, et un corps posé sur un corps absorbé suit son nouveau bâtiment : le lien ne se perd pas |
| `typo/donnees.js` | le corps qui cède est RACCOURCI d'autant, aux plans, du côté où tombe la part commune (`cedeeDe` : son aire et sa position dans le repère du corps) — ses pièces ne s'y posent pas, et ce que les plans mesurent (capacité, noyaux, circulation) suit sans autre retouche |
| `rendu/diagramme.js` | le m³ et l'emprise du « cube » retranchent le recouvrement |

> Écart à la première version de cette spec : retrancher la part cédée de la CAPACITÉ dans
> `typo/gen.js` ne changeait presque rien — le générateur des plans pave le rectangle entier de chaque
> corps. Raccourcir le corps est le geste juste ; `typo/gen.js` et `typo/mesures.js` ne changent pas.

## Ce qui reste pour la phase 2, ou plus tard

- **Le dessin** : deux contours et des murs qui se croisent au plan, deux boîtes en 3D, deux solides
  à l'export Rhino.
- **L'import Rhino** de nos propres boîtes (`parBoites`) ne rend pas `bat` : une paire recouverte
  revient en deux bâtiments.
- De petits biais, sans effet de seuil : l'assise et la pente pondérées par l'aire, l'orientation des
  façades pondérée par leur longueur, les sous-sols centrés sous chaque corps.
- Après relecture : l'emprise commune lue au seul rez, un corps presque tout entier posé sur un autre
  (aux plans, il garde une aile d'un mètre), `recoller` qui ne recolle plus à un tiers un corps posé
  sur un autre. Faits : contact à `CONTACT` près, parts fusionnées par inclusion–exclusion, façades à
  fleur, ailes sœurs ; le générateur vérifié identique sur 72 tirages (6 graines × 12 partis).

## Vérifier

- Les snapshots de `CLAUDE.md` : sortie identique avant et après.
- `node tools/claude.mjs test`, nouveaux tests, chacun qui casse si la règle casse :
  - deux carrés liés de 20 × 20 qui se recouvrent de 5 × 20 : posé = 800 − 100 ;
  - un carré tourné de 45° sur un carré : l'aire commune analytique ;
  - deux corps qui se touchent : recouvrement 0, façade enfouie 0 ;
  - `partCedee` : la partie commune va au plus grand, et se resomme au recouvrement ;
  - `chevaucheMain` permet le recouvrement entre corps liés, le refuse entre corps non liés ;
  - aucun écart « dist » entre corps liés qui se recouvrent, même distance incendie imposée ;
  - le jury : emprise, volume (à la hauteur des étages de corps) et terrain retranchent le recouvrement ;
  - « Rééquilibrer » ramène l'union à la demande ;
  - `fusionner` garde liés deux corps posés l'un sur l'autre ;
  - aux plans, le petit corps est raccourci de sa part commune, du côté du grand, et n'y pave rien.
- Dans l'app (navigateur local) : glisser un corps sur un corps du même bâtiment est accepté, le bilan
  du rail baisse de la surface commune.
