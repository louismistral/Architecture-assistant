# Le recouvrement dans un même bâtiment — phase 2 : le dessin

*Spec du 6 octobre 2026. Suite de `2026-10-06-recouvrement-design.md` (phase 1, les chiffres).*

## Pourquoi

Les chiffres sont justes, l'image ne l'est pas : deux corps liés posés l'un sur l'autre se dessinent
comme deux rectangles superposés. Au plan, le mur de l'un traverse l'intérieur de l'autre et la zone
commune est peinte deux fois ; en 3D, les boîtes s'interpénètrent et leurs dessus « z-fightent » ;
à l'export Rhino, deux maillages fermés se coupent ; à l'import, la paire revient en deux bâtiments
qui « s'interpénètrent ».

## Ce qui ne change pas

- Le générateur, le contrôle, le jury : aucun chiffre ne bouge. Sans recouvrement, tout se dessine et
  s'exporte exactement comme avant (le dessin nouveau ne s'enclenche que s'il y a recouvrement).
- La règle de la phase 1 : la part commune appartient au PLUS GRAND des deux (`cedeeDe`).

## La règle, en un endroit

`src/mass/geom.js` — la géométrie, pure :

- `moins(P, L)` : le convexe `P` privé de chaque convexe de `L` — des morceaux CONVEXES, disjoints.
  Un convexe moins un convexe se découpe demi-plan par demi-plan (Sutherland–Hodgman, que
  `interConvexe` fait déjà).
- `horsDe(P, L)` : les côtés du polygone `P` qui ne sont STRICTEMENT dans aucun convexe de `L`, en
  segments — un côté posé sur un bord (à fleur) reste.

`src/mass/model.js` — `dessinDe(v, e, vols)` : `null` si l'étage `e` de `v` ne recouvre aucun corps
lié (on dessine comme avant) ; sinon, ce qu'il faut dessiner de LUI pour que l'ensemble soit l'union :

| clé | ce que c'est | pourquoi |
|---|---|---|
| `garde` | les corps à qui `v` cède (plus grands) | la part commune est à eux |
| `emprise` | son emprise hors tout, moins celle de ceux à qui il cède | des convexes disjoints : l'aplat, le solide |
| `cel(P)` | une cellule du programme moins les intérieurs de ceux à qui il cède | la zone commune peinte une fois, chez celui qui la garde |
| `murs` | ses murs, moins les intérieurs des autres, moins l'emprise de ceux à qui il cède | pas de mur dans la zone commune, pas de poché en double |
| `bords` | son contour, moins l'emprise hors tout des autres | les bords de tous font le contour d'UNION |

Les deux parts de la paire réunies couvrent exactement l'union, sans se recouvrir.

## Qui la lit

| où | ce qui change |
|---|---|
| `views/plan.js` | étage plein : cellules, murs, contour (et l'aplat monochrome) par `dessinDe` ; les étages en trait fin, par ses `bords` |
| `views/vue3d.js` | prismes convexes (`boiteLibre`) pour les morceaux d'emprise, de cellules et de murs ; arêtes des seuls `bords` |
| `mass/export.js` | le corps qui cède s'exporte en UN maillage fermé (son emprise moins celle du plus grand), étanche, sans sommet en T ; il ne recoupe plus le grand. Chaque étage porte `Saxon corps` et `Saxon bat` (chaînes d'objet), et le corps découpé `Saxon boites`, sa boîte d'origine |
| `mass/import.js` | un maillage qui porte `Saxon boites` et tient encore dans ces boîtes se relit comme elles ; `Saxon corps` empile les étages d'un même corps ; `Saxon bat` rend le lien |

## Les mineurs de la phase 1

- **L'emprise commune lue au seul rez** : `recouvrementSol(vols)` (model.js) apparie chaque corps par
  son plus bas étage hors sol ; lu par `terrainLibre`, `lire` et le cube du Rendu. Égal à l'ancien
  calcul quand les deux corps posent au rez.
- **Un corps presque tout entier posé sur un autre** garde aux plans une aile d'1 m : là où le
  raccourcir n'en laisserait que ce mètre, l'étage SORT des plans (un corps sans étage aussi).
- **`recoller` ne recolle plus à un tiers un corps posé sur un autre** : `chevauche` y ignore ce que
  le corps recouvrait DÉJÀ de son bâtiment ; tout recouvrement nouveau reste refusé. Le générateur
  ne recouvre jamais rien : il ne voit aucune différence.
- **Une zone commune à trois corps** : reste comptée paire par paire (`ponytail:`).

## Après relecture

- Les chaînes d'objet ne vont qu'aux corps posés sur un corps de leur bâtiment (`recouvreLie`) :
  écrire `Saxon bat` partout changeait la relecture d'un export ordinaire.
- Retombent sur l'ancien dessin : un corps tout entier dans l'autre (rien à exporter), un volume
  fusionné qui cède (ses boîtes d'origine se recouvrent de leur mur commun, l'import ne les
  recollerait pas), deux étages liés à deux altitudes (`dessinDe` les ignore).

## Ce qui reste

- Le dessin d'union de deux étages à deux altitudes et d'un volume fusionné qui cède.
- Le lien `joint` (salle de sport posée sur un corps) : l'import ne relit que `bat`.
- La planche `plan` de `tools/claude.mjs` (PNG pour Claude) peint encore chaque corps entier.

## Vérifier

- Les snapshots de `CLAUDE.md`, identiques ; 72 tirages (graines 1–6 × 12 partis) identiques entre
  `main` et la branche : `vols.props`, `mes`, `bilan()`, et l'export (géométrie).
- `node tools/claude.mjs test`, nouveaux tests `rec_*` : `moins` (aire, disjonction), `horsDe`
  (périmètre d'union), `dessinDe` (murs + intérieurs = union hors tout ; `null` sans lien ou au
  contact), l'export (maillage fermé, volume = (emprise − commune) × h), l'aller-retour Rhino (le
  lien revient), l'emprise d'un corps perché, l'étage tout entier cédé, `recoller`.
- Dans l'app : la variante « Notre projet d'après le croquis » au plan et en 3D.
