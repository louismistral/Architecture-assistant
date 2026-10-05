# Le relevé du site

**Source unique : `src/data/site.js`** — mesures seulement, aucune règle.

Il est **engendré** par `tools/extract-site.py` depuis `DOC/site_plan.3dm`, le relevé Rhino du
concours. On ne le corrige pas à la main : on corrige le script et on le rejoue.

```bash
python3 tools/extract-site.py     # rhino3dm et numpy requis
```

Le fichier Rhino est en centimètres ; la conversion vers les mètres locaux — origine au coin
sud-ouest du périmètre — vit dans le script et nulle part ailleurs.

## Le repère du fichier Rhino n'est pas du LV95

On l'a longtemps écrit, et c'est faux. Les X et Y du fichier ont l'allure de coordonnées
suisses (2'588'337 / 1'090'758), mais l'unité est le **centimètre** : 17'680 unités font les
176,8 m du périmètre, 46'550 les 465,50 m d'une courbe. Du LV95 en centimètres aurait neuf
chiffres, autour de 257'900'000. Les altitudes, elles, sont vraies : `z` est l'altitude
absolue, en centimètres, sans décalage.

> Le coin nord-ouest du calque « cadre » — une feuille A1 au 1:500 — tombe sur
> 2'579'157,7 / 1'110'658,3, des valeurs LV95 plausibles pour Saxon, en mètres cette fois : le
> relevé a vraisemblablement été mis à l'échelle ×100 autour de ce point. Ce n'est pas vérifié,
> et rien ne s'en sert.

Pour **retomber en place sur le fichier**, c'est pourtant ce repère qu'il faut. Le script en
écrit donc l'origine dans `site.js`, en fin de fichier :

```js
export var RHINO = { x0: 2588337.89, y0: 1090758.30, u: 100, z0: 465 };
```

Un point (x, y, z) du dessin, en mètres, est dans le fichier du massing en
(x0 + u·x, y0 + u·y, u·(z − z0)) : le relevé garde ses altitudes absolues, le massing échangé
avec Rhino met son zéro à 465 m. C'est ce que lisent l'export et l'import du massing
(`src/mass/export.js`, `src/mass/import.js`) : le .3dm se superpose au relevé en plan sans
rien déplacer. La conversion ne change pas de maison — `U`, `Z0` et l'origine sont dans le
script, `site.js` n'en garde que le résultat. Les calques 2D du fichier — périmètre,
parcelles, bâtiments, courbes « 2d » — sont posés à z = 0 ; seuls les solides des bâtiments et
les courbes « 3d » portent leur altitude.

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
