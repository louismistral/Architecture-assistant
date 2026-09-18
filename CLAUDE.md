# Centre scolaire de Saxon — mémoire du projet

Outil d'aide à la conception pour le concours de projet du nouveau centre scolaire de
Saxon (VS). HTML + CSS + modules ES, **aucun build, aucune dépendance**. Servir avec
`python3 -m http.server 8000`.

Les règles de dessin, de style et d'architecture logicielle sont dans `README.md` et
font foi. Ce fichier retient **les contraintes du concours** et **où elles vivent dans
le code**.

---

## Les onglets sont une chronologie

```
Programme  →  Programme mixer  →  Massing  →  Typologie
contraintes   répartition du      volumétrie  plans et
et surfaces   programme sur       sur le site coupes
              les niveaux
```

Chaque onglet se sert de ce que le précédent a décidé. L'ancien ordre faisait l'inverse :
l'onglet Site venait après le Plan, donc la typologie décidait du volume.

**Aujourd'hui, deux onglets existent** : Programme et Programme mixer. Massing et
Typologie sont à construire. Le code 3D et le générateur de volumétrie sont conservés
**dormants** — `src/core/gl.js`, `src/vol/place.js`, `massing.js`, `checks.js`,
`scene3d.js` — sans onglet qui les expose ; ils sont la base du futur Massing.

L'onglet Programme se lit en trois sections, dans cet ordre : **Contraintes**,
**Surfaces**, **Adjacences**.

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
  marqués `est:1` et saisissables dans l'onglet Programme, section Surfaces. Programme
  chiffré 6'489 m², total vivant 7'025 m².

Totaux par chapitre (m² nets) : école 2'616 · sport 1'751 · UAPE 316 · technique 942 ·
infrastructures 900 · extérieurs 500. Bâti scolaire = les quatre premiers, 5'625 m².

## Règle seconde : la circulation est une part de la surface BÂTIE

Elle n'est chiffrée nulle part au règlement : c'est une hypothèse de projet, et elle vaut
plus de mille mètres carrés. Elle se règle **dans l'onglet Programme, parmi les surfaces à
préciser, et là seulement** ; tous les onglets suivants la lisent.

```
bâti = utile / (1 − part)        circulation = bâti − utile
```

Une part de 0,18 ajoute donc **22 %** à la surface utile, et non 18 %. Elle ne porte que
sur le **bâti scolaire** — les quatre premiers chapitres ; la piscine, le chauffage à
distance, la cour et son préau n'ont pas de couloirs à nous.

- Valeur par défaut et bornes : `RULES.circ` dans `src/data/rules.js`.
- Valeur vivante, `CIRC`, et les m² qui en découlent, `CIRCA` / `BUILTG` :
  `src/core/model.js` seul. `setCirc()` est le seul écrivain.
- Elle se réglait auparavant dans DEUX outils, sous le même mot et avec deux
  arithmétiques opposées : 15 % ajoutés à l'utile dans le générateur de volumétrie,
  18 % du bâti dans le plan. L'écart valait 200 m².

## Contraintes du concours — source unique : `src/data/rules.js`

Extraites du règlement-programme de juillet 2026 (`DOC/1.19.a`) et de la directive
AEAI DPI 16-15 (`DOC/1.19.d`). **Toute vérification et tout générateur lisent
`RULES` ; aucune de ces valeurs n'est réécrite ailleurs.** La section Contraintes de
l'onglet Programme (`src/views/constraints.js`) ne fait que les afficher.

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
Le mixer en déduit la hauteur de chaque niveau : elle n'est pas un réglage, elle est
une conséquence du programme porté par ce niveau.

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
sur le plan de situation 1:500, sans organisation des locaux ni dessin des façades. Dans
le mixer ils sont posés au terrain mais **hors enveloppe** : ils ne pèsent pas sur le
plateau et ont leur propre bande dans le dessin d'un niveau.

### Exigences non métriques (art. 2.7 à 2.9)
Économicité et respect des surfaces données · compacité et orientation des volumes ·
Minergie A ou P, ou CECB A/A · toitures disponibles pour le photovoltaïque · eaux de
toiture infiltrées sur site · intégration au bâtiment et aux jardins de l'ancien Casino.

---

## L'onglet Programme mixer : répartir, puis contrôler

```
src/data/rules.js     contraintes du concours          ← SOURCE UNIQUE
src/data/schema.js    adjacences exigées               ← SOURCE UNIQUE
src/core/model.js     totaux, surfaces saisies, part de circulation
src/core/treemap.js   pavage squarifié : un bloc vaut sa surface
src/core/rand.js      tirage reproductible à graine
src/mix/prog.js       le programme vu comme des parts à poser ; adjacences par poste
src/mix/niv.js        règles de niveau, cotes admissibles d'un poste
src/mix/floors.js     la pile de niveaux, les parts posées, déplacer / scinder
src/mix/shuffle.js    répartition ordonnée, tirage, proposition de pile
src/mix/checks.js     contrôle d'une répartition → avertissements
src/mix/store.js      persistance (localStorage, clé `saxon-mix-v1`)
src/views/mixer.js    la vue : la pile, les niveaux à l'échelle, le bac, le popover
```

**Le mixer ne refuse rien.** Une répartition qui sort des règles est produite quand même
et `checks.js` la dit : rouge pour une règle écrite au règlement ou à l'AEAI, ambre pour
une règle de projet ou une marge qui se discute. Le plateau, le nombre de niveaux et la
part de circulation sont des choix de projet : leur dépassement est ambre.

**Les contraintes de connexion ne sont jamais dures.** Le tirage les prend comme des
préférences — un poste va d'abord au niveau où se trouve déjà ce que le règlement lui
demande de toucher — et le contrôle dit après coup ce qui n'a pas pu tenir.

Un POSTE est une ligne du programme (18 salles de classe standard). Une PART est un
morceau de poste posé à un niveau (6 de ces 18 salles au 1ᵉʳ étage). Un poste se scinde,
sauf ceux dont le règlement impose les dimensions — la salle de sport double, 28 × 32 m,
ne se coupe pas.

Par défaut la pile n'a qu'un **rez-de-chaussée**. On creuse des sous-sols et on monte des
étages aux deux extrémités seulement ; **Shuffle** peut aussi proposer le nombre de
niveaux, déduit de la surface bâtie à loger, du plateau du rez et de ce que le règlement
admet en sous-sol.

Les locaux engins de la salle de gym (180 m²) ne sont pas posés : le règlement les
convertit en abri PC, dont les 750 m² les contiennent. Les poser compterait deux fois.

## Où modifier quoi

- **Une surface, un nombre, une famille, une note** : `src/data/program.js` seul.
- **Une contrainte du concours** : `src/data/rules.js` seul — la section Contraintes, les
  règles de niveau et le contrôle en découlent.
- **Une adjacence** : `src/data/schema.js` seul. `src/mix/prog.js` ne fait que la table
  nœud → poste, et signale dans `LIENS_ORPHELINS` tout nom qui ne correspond plus.
- **Les familles et leurs couleurs** : `src/data/families.js` + `styles/tokens.css`.
- **Le relevé du géomètre** : `src/data/site.js` — mesures seulement, aucune règle.
- **Une valeur de dessin** : `styles/tokens.css`, et nulle part ailleurs. WebGL ne sait
  pas lire `var(--f-cla)` : `cssRGB()` fait résoudre le token par le navigateur et le
  garde en cache tant que le thème ne change pas.

## Vérifier

Aucun test automatisé. Pour contrôler la répartition sans navigateur :

```bash
node --input-type=module -e "
Promise.all([import('./src/mix/floors.js'),import('./src/mix/shuffle.js'),
             import('./src/mix/checks.js'),import('./src/mix/prog.js')]).then(([F,S,C,P])=>{
  console.log('liens orphelins :', P.LIENS_ORPHELINS);
  S.repartir({ alea:false, etages:true });
  F.FLOORS.forEach(function(f,i){
    console.log(F.flName(i), Math.round(F.flNet(i)) + '/' + Math.round(F.usable(i)) + ' m²',
                F.flCount(i) + ' pièces', 'h=' + F.flHeight(i));
  });
  console.log('bac :', Math.round(F.trayArea()), 'm²');
  console.log('verdict :', JSON.stringify(C.mixVerdict(C.mixCheck())));
});"
```

Et le générateur de volumétrie, resté dormant :

```bash
node --input-type=module -e "
Promise.all([import('./src/vol/massing.js'),import('./src/vol/checks.js')]).then(([m,c])=>{
  ['compact','barres','cour','pavillons'].forEach(p=>{
    m.massSet('parti',p);
    console.log(p, JSON.stringify(c.massVerdict(c.massCheck(m.massGen()))));
  });
});"
```
