# Le relevé du site

**Source unique : `src/data/site.js`** — mesures seulement, aucune règle.

Il est **engendré** par `tools/extract-site.py` depuis `DOC/site_plan.3dm`, le relevé Rhino du
concours. On ne le corrige pas à la main : on corrige le script et on le rejoue.

```bash
python3 tools/extract-site.py     # rhino3dm et numpy requis
```

Le fichier Rhino est en centimètres et en coordonnées suisses LV95 ; la conversion vers les
mètres locaux — origine au coin sud-ouest du périmètre — vit dans le script et nulle part
ailleurs.

## Le terrain passe par les courbes de niveau

`SITE.grid` est une grille d'altitudes au pas de **2 m** (463,0 à 467,9 m, 465,0 de moyenne).
Le relevé donne une courbe tous les **50 cm**.

Pour chaque nœud on prend le point de courbe le plus proche, puis le plus proche d'une AUTRE
altitude, et l'on interpole entre les deux au prorata des distances : un nœud posé sur une
courbe reçoit exactement son altitude, et entre deux courbes la pente est droite. **Quatre
centimètres d'écart en moyenne** sur le périmètre du concours, 46 cm au pire.

Les altitudes sont écrites en **centimètres entiers** au-dessus de `zsol` : au décimètre, une
pente à 1,5 % se terrassait d'elle-même — une marche tous les sept mètres, que le maillage en
pleine résolution montrait toutes.

Deux passes de lissage très douces ne portent que sur le coteau, là où les courbes sont à un
mètre l'une de l'autre et qu'une grille au pas de deux ne peut pas les résoudre : un nœud reste
FIGÉ tant qu'il est sur une courbe et que la voisine est plus loin que le pas — donc partout sur
le site.

> Ce qui a précédé : un plan incliné à trois nombres, qui se trompait de deux mètres au pied du
> coteau, puis une moyenne pondérée qui suivait la pente en gros mais pas les courbes, et les
> laissait flotter au-dessus du maillage.

## Ce qui est relevé, et ce qui ne l'est pas

Les bâtiments existants portent leur pied et leur faîte (`SITE.bath`), lus dans les solides du
calque « batiments 3d ».

Tout ce qui traverse le cadre — le périmètre plus 55 m — y est **coupé**, et non gardé entier :
une polyligne dont un seul sommet tombait dedans partait sinon à cent mètres dans le vide, au-delà
du maillage du terrain, et le relevé flottait dans le blanc.

Le fichier Rhino n'a **pas de calque d'arbres** : ce qu'on ne relève pas ne s'invente pas.
