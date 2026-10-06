# Typologies en étapes — le plateau d'abord, les pièces ensuite

Décidé avec Louis le 6 octobre 2026.

## Le défaut

Le Massing assemble les corps qui se touchent en un volume de plusieurs rectangles. Les plans,
eux, composaient chaque rectangle pour lui-même — son couloir, ses deux bandes — et ne faisaient
qu'effacer le mur entre deux ailes. Dans un L, un T, un U, le couloir d'une aile butait contre les
pièces de l'autre : pas de mur, mais pas de passage. Entre l'école et la salle de sport, la baie
tombait au milieu du contact, sans rapport avec le couloir.

## Le déroulé

Un plan se compose dans l'ordre où un architecte le dessine, sur la forme ENTIÈRE du niveau :

1. **Plateau** — les rectangles du niveau, salle de sport comprise, et leurs JONCTIONS : bout à
   bout (les couloirs se prolongent, comme avant), bout contre flanc (le T ; le L en est un au bout
   d'une barre), contre la salle de sport (par un pignon ou par un flanc).
2. **Noyaux** — `hotes()`, la même machine. Elle ne pose plus de cage là où une aile vient toucher
   une bande (la cage boucherait la jonction) ; à égalité, elle préfère le bout d'une aile qui
   touche sa voisine : la cage y dessert les deux.
3. **Squelette** — les rectangles se composent BRANCHE AVANT RECEVEUR. Le couloir de la branche
   connu, on réserve dans la bande du receveur, dans son axe, un **raccord** : la largeur du
   couloir sur toute la profondeur de la bande. Quand un noyau est au bout de la branche, raccord
   et palier font un **carrefour** — la règle C : c'est le placement des noyaux qui le décide, pas
   une ligne de plus. Contre la salle de sport : par un pignon, le couloir y finit, la porte dans
   son axe ; par un flanc, un raccord au milieu du contact, la porte dans son axe.
4. **Pièces maîtresses** — les salles de classe d'abord, en tête de chaque corps, donc dans sa
   bande de jour (la mesure même de `classesSoleil`, `soleil()`), en grappes de trois ou quatre.
   *Essayé puis retiré* : les répartir d'abord entre les corps selon leur façade de jour — sans
   gain au soleil (0,718 dans les deux cas), et avec un bruit multiplié par quatre.
5. **Pièces liées** — vestiaires, WC, dépôts suivent leurs pièces mères (inchangé).
6. **Le reste** — le programme famille par famille, au prorata de ce que chaque corps peut encore
   recevoir (inchangé) ; ce qui ne tient pas reste au bac.

Une réservation est une place dans la bande, comme un noyau : la pièce qui ne tient pas avant
laisse passer la suivante. La mécanique des noyaux (`Q` dans `composer()`) est généralisée, pas
doublée.

## Les étapes se voient (choix B)

Chaque élément du plan porte son étape (`et`, 1 à 6). La page des plans a une étape « Étapes » :
on regarde le plan à l'étape k — ce qui n'est pas encore posé est en attente, grisé. Rien ne s'y
règle. Le Rendu et les mesures lisent toujours le plan fini.

## Ce qui ne change pas

Les surfaces, les cotes des volumes du Massing, la forme de ce que rend le générateur (les mesures,
le jugement, le Rendu le lisent tel quel), la pureté du tirage (même seed, même plan).

## Vérifier

Les quatre snapshots de `CLAUDE.md`, plus le quatrième sur les partis L, U et peigne : aucune
régression des écarts du cadre (`fuites`, `sia500`, `noyaux-empiles`), et le contrôle dit, niveau
par niveau, les couloirs qui ne rejoignent aucun noyau.
