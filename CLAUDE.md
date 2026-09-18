# Centre scolaire de Saxon — mémoire du projet

Outil d'aide à la conception pour le concours de projet du nouveau centre scolaire de
Saxon (VS). HTML + CSS + modules ES, **aucun build, aucune dépendance**. Servir avec
`python3 -m http.server 8000`.

Les règles de dessin, de style et d'architecture logicielle sont dans `README.md` et
font foi. Ce fichier retient **les contraintes du concours** et **où elles vivent dans
le code**.

---

## Règle première : les surfaces sont fixes

Le règlement chiffre chaque local. **Une surface de programme ne se change pas.** On
change les *proportions* d'une pièce ou d'un volume — largeur × hauteur, à surface
exacte — jamais les m².

- Source unique des surfaces : `src/data/program.js` (`CHAP`). Rien d'autre ne les
  redit, ni ne les recalcule.
- Proportions admissibles à surface exacte : `src/core/geometry.js` — `validDims`,
  `nearestDims`, `squarest` (grille au demi-mètre, repli au décimètre).
- Huit postes que le règlement laisse « selon projet » sont **à préciser** : ils sont
  marqués `est:1` et saisissables dans l'onglet Programme. Programme chiffré 6'489 m²,
  total vivant 7'025 m².

Totaux par chapitre (m² nets) : école 2'616 · sport 1'751 · UAPE 316 · technique 942 ·
infrastructures 900 · extérieurs 500. Bâti scolaire = les quatre premiers, 5'625 m².

## Contraintes du concours — source unique : `src/data/rules.js`

Extraites du règlement-programme de juillet 2026 (`DOC/1.19.a`) et de la directive
AEAI DPI 16-15 (`DOC/1.19.d`). **Toute vérification et tout générateur lisent
`RULES` ; aucune de ces valeurs n'est réécrite ailleurs.**

### Site (art. 2.3)
- Parcelles 5606, 5607, 5608, 5610 à 5614 et 4550 — **11'740 m²** au règlement ; le
  polygone du géomètre en fait 12'783 (il englobe les bords de route).
- Altitude moyenne **465,30 m**. Nappe phréatique de **461,77 à 462,25 m**. Le terrain
  monte de 463,3 m au sud-ouest à 466,7 m à l'est : la marge sur la nappe va de 1,0 m
  à l'ouest à 4,5 m à l'est. **Un sous-sol excavé demande 3,00 m** de couverture — il
  n'est tenable qu'au tiers est du site.
- Zone de constructions et d'installations publiques A : **aucune contrainte de
  gabarit, de hauteur ni de distance aux limites**. Restent opposables les distances
  entre bâtiments de l'AEAI et les alignements routiers.
- Zone de protection des eaux Au - Karst ; sources SIII au sud. Pollution des sols en
  cours d'investigation sur la parcelle 4550.
- Distances retenues à l'implantation : **6 m entre bâtiments** (AEAI), **5 m de recul
  sur le périmètre** (règle de projet, faute d'alignement routier numérisé).

### Hauteurs libres exigées (art. 2.10)
| local | hauteur libre |
|---|---|
| salles de classe | 2,80 m de vide d'étage |
| salle de sport double | **7,00 m** sous structure — donc au rez, sur un seul niveau |
| local chauffage CAD | 5,20 m, accès camion de plain-pied |
| piscine | 3 à 5 m |
| abri PC | 2,40 m |

Hypothèses de projet pour passer de la hauteur libre à la hauteur de niveau :
dalle 0,45 m, acrotère 0,60 m. Elles sont assumées comme telles dans `RULES.haut`.

### Protection incendie (art. 2.6, AEAI DPI 16-15 art. 2.4 et 3.4)
- Au moins **une cage d'escalier compartimentée** ; **deux dès 900 m² de surface
  d'étage**.
- Voie d'évacuation **35 m** vers une seule issue, **50 m** vers deux issues éloignées ;
  35 m à l'intérieur d'une unité d'utilisation.

### Parasismique (art. 2.5)
Zone 3b · a_gd = 1,6 m/s² (SIA 261:2020) · sol de fondation E, partiellement C ·
classe d'ouvrage II.

### Mobilité et extérieurs (art. 2.4 et 2.10)
70 places de parc à ciel ouvert · 50 vélos et trottinettes · 2 dépose-bus (rue du
Casino) · 4 dépose-minute · cour de 500 m² avec préau couvert de 120 m². Flux piétons
et véhicules séparés ; mobilité douce depuis le chemin du Petit Mont.

### Second temps (art. 2.2)
Piscine 500 m² (bassin 6 × 12 m) et local de chauffage à distance 400 m² : ouvrages
**indépendants des bâtiments scolaires**, réalisés plus tard, à représenter en pointillé
sur le plan de situation 1:500, sans organisation des locaux ni dessin des façades.

### Exigences non métriques (art. 2.7 à 2.9)
Économicité et respect des surfaces données · compacité et orientation des volumes ·
Minergie A ou P, ou CECB A/A · toitures disponibles pour le photovoltaïque · eaux de
toiture infiltrées sur site · intégration au bâtiment et aux jardins de l'ancien Casino.

---

## L'onglet Programme : trois volets

`view.sub` — **Surfaces**, **Contraintes**, **Adjacences**, dans cet ordre. Les trois
lisent le règlement ; on ne compose ni dans l'un ni dans l'autre (c'est « Plan » et
« Site »). Un volet s'ajoute dans `SUBS` (`src/core/viewstate.js`) plus une branche dans
`render()` ; le bouton et le routage suivent.

- **Surfaces** — le programme dessiné à l'échelle, les surfaces à préciser, le
  récapitulatif et les sources. `views/legend.js` + `views/diagram.js`.
- **Contraintes** — `src/views/rules.js`. Tout ce qui y est chiffré vient de
  `src/data/rules.js` : la vue NOMME les valeurs, elle ne les redit pas. Changer une
  contrainte à la source change cette page, le générateur de volumétrie et son contrôle
  d'un seul geste.
- **Adjacences** — `views/schema.js`, inchangé, descendu d'un cran.

URL : `#programme/<volet>` et, pour Surfaces seule, `#programme/surfaces/<chap|fam>`.
Les formes anciennes `#adjacences` et `#programme/fam` restent valables.

## L'onglet Site : proposer une volumétrie, puis la contrôler

```
src/data/rules.js     contraintes du concours          ← SOURCE UNIQUE
src/vol/place.js      terrain, périmètre, recul, distance entre boîtes, recherche de place
src/vol/massing.js    générateur : programme + règles + parti → volumes
src/vol/checks.js     contrôle d'une volumétrie → avertissements
src/core/gl.js        WebGL minimal : matrices, programme, tampons, caméra orbitale
src/vol/scene3d.js    la vue 3D : terrain, relevé, bâti existant, volumes du projet
src/vol/volumes.js    la vue Site : plan de situation, 3D, réglages, tableau de bord
```

**Le générateur ne refuse rien.** Une proposition qui sort des règles est produite quand
même et `checks.js` la dit : rouge pour une règle écrite au règlement ou à l'AEAI, ambre
pour une règle de projet ou une marge qui se discute. C'est une demande explicite : on
veut pouvoir essayer, à condition d'être averti.

Quatre partis — **Compact**, **Barres**, **Cour**, **Pavillons** — et quatre réglages :
niveaux hors sol, nombre de corps, profondeur du bâti, part de circulation. La salle de
sport (28 × 32 m), l'abri PC (750 m²), la piscine et le CAD gardent leur surface : seules
leurs proportions cèdent quand le site se remplit.

La 3D est une **vraie caméra en perspective** avec tampon de profondeur, pas une
projection. Elle remplace l'axonométrie militaire, qui projetait un plan vrai tourné de
32° sans point de vue ni occlusion. Glisser tourne, `Maj` + glisser déplace, la molette
approche, un clic net désigne un volume.

## Où modifier quoi

- **Une surface, un nombre, une famille, une note** : `src/data/program.js` seul.
- **Une contrainte du concours** : `src/data/rules.js` seul — le volet Contraintes, le
  générateur de volumétrie et son contrôle en découlent.
- **Les familles et leurs couleurs** : `src/data/families.js` + `styles/tokens.css`.
- **Le relevé du géomètre** : `src/data/site.js` — mesures seulement, aucune règle.
- **Une valeur de dessin** : `styles/tokens.css`, et nulle part ailleurs. WebGL ne sait
  pas lire `var(--f-cla)` : `cssRGB()` fait résoudre le token par le navigateur et le
  garde en cache tant que le thème ne change pas.

## Vérifier

Aucun test automatisé. Pour contrôler le générateur sans navigateur :

```bash
node --input-type=module -e "
Promise.all([import('./src/vol/massing.js'),import('./src/vol/checks.js')]).then(([m,c])=>{
  ['compact','barres','cour','pavillons'].forEach(p=>{
    m.massSet('parti',p);
    console.log(p, JSON.stringify(c.massVerdict(c.massCheck(m.massGen()))));
  });
});"
```
