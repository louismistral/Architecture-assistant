# Les contraintes du concours

Extraites du règlement-programme de juillet 2026 (`DOC/1.19.a`) et de la directive AEAI
DPI 16-15 (`DOC/1.19.d`).

**Source unique : `src/data/rules.js`.** Toute vérification et tout générateur y lisent
`RULES` ; aucune de ces valeurs n'est réécrite ailleurs. `src/views/constraints.js` ne fait
que les afficher.

## Site (art. 2.3)

- Parcelles 5606, 5607, 5608, 5610 à 5614 et 4550 — **11'740 m²** au règlement ; le
  polygone du géomètre en fait 12'783 (il englobe les bords de route).
- Altitude moyenne **465,30 m**. Nappe phréatique de **461,77 à 462,25 m**. Le terrain monte
  de 463,3 m au sud-ouest à 466,7 m à l'est : la marge sur la nappe va de 1,0 m à l'ouest à
  4,5 m à l'est. **Un sous-sol excavé demande 3,00 m** de couverture — il n'est tenable
  qu'au tiers est du site.
- Zone de constructions et d'installations publiques A : **aucune contrainte de gabarit, de
  hauteur ni de distance aux limites**. Restent opposables les distances entre bâtiments de
  l'AEAI et les alignements routiers.
- Zone de protection des eaux Au - Karst ; sources SIII au sud. Pollution des sols en cours
  d'investigation sur la parcelle 4550.
- Distances retenues à l'implantation : **6 m entre bâtiments** (AEAI), **5 m de recul sur
  le périmètre** (règle de projet, faute d'alignement routier numérisé).

## Hauteurs libres exigées (art. 2.10)

| local | hauteur libre |
|---|---|
| salles de classe | 2,80 m de vide d'étage |
| salle de sport double | **7,00 m** sous structure — donc au rez, sur un seul niveau |
| local chauffage CAD | 5,20 m, accès camion de plain-pied |
| piscine | 3 à 5 m |
| abri PC | 2,40 m |

Hypothèses de projet pour passer de la hauteur libre à la hauteur de niveau : dalle 0,45 m,
acrotère 0,60 m. Elles sont assumées comme telles dans `RULES.haut`. Le mixer en déduit la
hauteur de chaque niveau : elle n'est pas un réglage, elle est une conséquence du programme
porté par ce niveau.

## Protection incendie (art. 2.6, AEAI DPI 16-15 art. 2.4 et 3.4)

- Au moins **une cage d'escalier compartimentée** ; **deux dès 900 m²** de surface d'étage.
- Voie d'évacuation **35 m** vers une seule issue, **50 m** vers deux issues éloignées ;
  35 m à l'intérieur d'une unité d'utilisation.

## Parasismique (art. 2.5)

Zone 3b · a_gd = 1,6 m/s² (SIA 261:2020) · sol de fondation E, partiellement C · classe
d'ouvrage II.

## Mobilité et extérieurs (art. 2.4 et 2.10)

70 places de parc à ciel ouvert · 50 vélos et trottinettes · 2 dépose-bus (rue du Casino) ·
4 dépose-minute · cour de 500 m² avec préau couvert de 120 m². Flux piétons et véhicules
séparés ; mobilité douce depuis le chemin du Petit Mont.

## Second temps (art. 2.2)

Piscine 500 m² (bassin 6 × 12 m) et local de chauffage à distance 400 m² : ouvrages
**indépendants des bâtiments scolaires**, réalisés plus tard, à représenter en pointillé
sur le plan de situation 1:500, sans organisation des locaux ni dessin des façades. Dans le
mixer ils sont posés au terrain mais **hors enveloppe** : ils ne pèsent pas sur le plateau
et ont leur propre bande dans le dessin d'un niveau.

## Exigences non métriques (art. 2.7 à 2.9)

Économicité et respect des surfaces données · compacité et orientation des volumes ·
Minergie A ou P, ou CECB A/A · toitures disponibles pour le photovoltaïque · eaux de
toiture infiltrées sur site · intégration au bâtiment et aux jardins de l'ancien Casino.

## Le cahier des charges, volet Contraintes

`src/views/constraints.js` affiche ce qui précède, puis le **schéma fonctionnel** des
adjacences (`src/views/schema.js`, lu dans `src/data/schema.js`).

Les adjacences ont été un onglet, puis un volet : une proximité exigée entre deux locaux
n'est pas d'une autre nature qu'une hauteur libre ou une distance au voisin.

Le schéma est **à l'échelle et en mètres** : une unité de dessin vaut un mètre, un local de
144 m² est un carré de 12 m de côté, et l'aire du rectangle vaut ses m² dans ses DEUX côtés
— même convention que les diagrammes du volet Surfaces. Quand le règlement impose les deux
cotes (salle de sport double, 28 × 32 m), le schéma les lit dans `program.js` au lieu de les
redire. Un local trop petit pour écrire son nom le range dessous.

La disposition est une **carte heuristique** : elle part du LIEN, parce que le lien est la
contrainte. Chaque composante connexe est une **grappe** — la notion même que le mixer
déplace d'un bloc. Son centre est son local le plus lié (à égalité, le plus grand) ; ses
voisins rayonnent par branches courbes, puis les voisins de ceux-là au tour suivant. Le
rayon se déduit de l'encombrement du parent et du sien, le secteur angulaire de ce que la
branche a à loger ; quand le tour ne suffit plus, on écarte tout d'un coup — les secteurs
étant en 1/rayon, un seul passage les y ramène. Les liens hors arbre sont des exigences
comme les autres : tracés en travers, infléchis vers le centre. Le trait ne dit que la
nature de l'exigence ; la couleur reste celle de la famille d'usage.

Chaque grappe porte son compte, sa surface et **les pôles qu'elle traverse**. Les colonnes
par pôle d'avant alignaient tout et donnaient à lire l'organigramme du programme plutôt que
les proximités qu'il exige — on ne voyait pas que la grappe de la salle de sport tient
dix-sept locaux et traverse trois pôles.
