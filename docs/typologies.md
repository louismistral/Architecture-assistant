# L'onglet Typologies

Dessiner les plans de chaque niveau DANS les volumes du Massing.

```
src/typo/plans.html   la page des plans : le générateur (PG), le mobilier, le rail, la planche
src/typo/donnees.js   ce que la page lit : la pile du mixer, les volumes du massing, les liens actifs
src/typo/etat.js      ce qu'elle enregistre : sa seed, ses cotes de pièces — rien d'autre
src/views/render.js   `typoHote()` : ce que l'onglet et le Rendu donnent à la page avant de la charger
```

## Chaque onglet tire chez lui

Le mixer répartit, le Massing pose les volumes, les Typologies ordonnent les pièces dedans. Aucun
n'écrit en amont : ouvrir l'onglet, y tirer ou y régler une pièce ne change ni la pile ni la
volumétrie, et l'on retrouve au Massing celle qu'on y avait laissée.

> Avant, ouvrir l'onglet réécrivait le Massing à trois endroits : `typoAccorder()` déplaçait des
> postes au mixer pour rapprocher les liens (la pile changeait, le Massing se régénérait),
> `typoSalleAccolee()` fixait le levier sport et retirait une volumétrie, et la page MESURAIT chaque
> corps à ses pièces puis lui réécrivait ses cotes (`typoEcrire`, avec écarter, dégager, fusionner).
> Une cote de pièce réglée au plan allait aussi au mixer (`setCote`), et entrait dans
> `empreintePile()` : retour au Massing, nouvelle volumétrie.

- **Un corps garde ses cotes**, niveau par niveau — longueur, profondeur, décalage, retraits. Le plan
  s'y dessine depuis le bout de l'ancre ; ce qui reste devient palier.
- **Ce qui ne tient pas reste au bac du niveau** : la pièce qui couvre le débord au plus juste, sinon
  la plus grande, jamais un hall. L'étape Bilan la nomme, le Contrôle la compte ; c'est au Massing
  (agrandir) ou au mixer (alléger) d'y répondre.
- **Puis ce qui est sorti revient là où il reste de la place**, dans n'importe quel corps du niveau,
  le sien compris. L'abri PC (750 m²) se compartimente en parts de 300 m² au plus, et une part se
  recoupe pour remplir le sol qui reste. Sans cela, un débord de quelques mètres sortait l'abri entier
  et laissait vide la moitié d'un corps — le Massing l'avait dimensionné pour lui.
- **Le sol qu'un rang laisse libre est un dégagement**, nommé au plan, ouvert sur le couloir. Au-delà
  de `sol-vide` (cadre, 100 m² par corps et par niveau), le Contrôle le signale.
- L'annexe que les plans adossaient à la salle de sport, et le sous-sol mis à la profondeur de la
  pile, ont disparu avec la mesure : ils épaississaient le volume. Les liens à la salle se tiennent
  quand le Massing l'accole (levier « Salle de sport accolée »).

## Un volume fusionné, un seul mur

Le Massing assemble ce qui se touche en un volume de plusieurs rectangles (`docs/massing.md` — *Le
volume n'est pas qu'un rectangle*). Les plans se composent rectangle par rectangle :
`donnees.js — ailes()` fait de chaque part une aile, un corps du même bâtiment (`bat`) qui partage
les noyaux des autres, suivie d'un niveau à l'autre par ce qu'elle recouvre en plan pour que son
noyau s'empile. Tous les murs se dessinent AVANT tous les sols : là où deux ailes se touchent, le sol
de l'une recouvre le mur de l'autre, et il n'y a plus de mur entre elles — la séparation des pièces
est leur cloison. Deux volumes qui ne font que se toucher (la salle de sport et l'école, ou deux
corps que le Massing n'a pas pu assembler) gardent UN mur : celui de l'autre, et ce qui les sépare
encore (moins de `regles.fusion`, 1 m), devient un dégagement, ouvert sur une baie de passage.

**Verrouillées** (`core/verrou.js`), les Typologies se regardent : le Shuffle, la seed et la cote
d'une pièce sont désactivés (`DATA.verrou`). Un cadenas sur les Typologies fige aussi le Massing,
le mixer et le cahier des charges : le plan ne peut plus bouger sous elles.

## Shuffle typologie et sa seed

`TYPO.graine`, à côté de `MASS.graine` et de la seed du mixer, et indépendante des deux. Elle ne
change que l'**ordonnance** : l'ordre des familles (donc quelle famille va à quel corps), celui des
postes dans une famille, le bout où se tient le noyau d'un bâtiment à un seul noyau. Le tirage est
PUR (`alea(nom)`, de la seed et d'un nom) : l'écran, le contrôle et le Rendu voient le même plan.
Même écriture que les autres seeds — base 36, retapée puis Entrée — et le bouton et le champ passent
par un seul chemin, `rejouer()`. Elle s'enregistre avec le projet (`snapshot().typo`) ; une variante
d'avant revient à la seed 1.

## La page parle la langue du Massing

Elle charge les feuilles du site (`tokens`, `base`, `controls`, `massing`), le thème et le mode de
l'hôte, et en reprend les composants :

- **le rail en chaîne** — Proposer en tête (Shuffle typologie, le nombre de volumes lus, la seed),
  puis les étapes repliables, leur état à droite : 1 · Bilan du niveau (part posée, ce qui ne tient
  pas), 2 · Contrôle (toute la pile ; ouvert dès qu'un point est à revoir), 3 · Familles ;
  Emporter au pied (Copier le SVG) ;
- **la barre** de ce qu'on regarde — niveau, couleurs, mobilier · cotes · site, cadrage — une
  préférence de l'appareil (`localStorage`, `typo-saxon`), pas une décision de projet ;
- **la pièce cliquée** dans une carte posée sur le plan, au coin opposé au clic : sa largeur au
  module, à surface exacte. La cote reste aux Typologies.

La palette du DESSIN (poché, papier, lavis) reste celle de la page — un rendu de concours — et suit
`data-mode` ; `typoPlanches()` la force en clair pour le Rendu.

**Au contrôle, trois lignes du cadre** : la scène collée à la salle de sport (mur contre mur, au
même niveau — `scene-sport`), toutes les pièces ouvertes sur un couloir (`couloir-acces`, tenu
par construction de `composer()`) et pas de sol inutilisé dans un corps (`sol-vide`). La **trame** de placement des pièces (`trame`, Imposé, 1,20 m)
est déclarée au cadre mais pas encore lue : à construire.
