# 02 Forensics — le moodboard du groupe

Une toile sans bord où l'on pose ce qu'on a vu, lu, relevé : des images, des
notes, des liens, et des flèches qui les relient. Tout le groupe voit la même
planche ; la vue — où l'on regarde, à quel zoom — reste à chacun.

```
src/views/forensics.js   la toile, les cartes, les gestes
src/net/forensics.js     lire, poser, modifier, retirer ; téléverser, signer
src/net/supa.js          stockage() — l'API des fichiers, même jeton
styles/forensics.css     son dessin
supabase/migrations/20260929100000_forensics.sql   la table et le bucket
```

## Les gestes

| geste | effet |
|---|---|
| glisser le fond, ou Espace + glisser, ou l'outil Main (H) | déplacer la vue |
| molette | défiler ; **Ctrl + molette** ou pincer : zoomer autour du pointeur |
| **Tout voir** (F) | recadrer sur tout ce qui est posé — si l'on s'est perdu |
| double-clic sur le fond, ou l'outil Note (N) | une note |
| glisser des images, les coller, ou l'outil Image (I) | des cartes image, à leurs proportions |
| coller une adresse, ou l'outil Lien (L) | une carte lien — titre, domaine, « Ouvrir » |
| coller du texte | une note |
| l'outil Flèche (A), puis deux cartes | une flèche, de bord à bord |
| glisser une carte / son coin | la déplacer / la redimensionner (une image garde ses proportions, sauf Maj) |
| double-clic ou Entrée sur une carte | la modifier : texte, adresse, légende |
| Suppr | retirer la carte (et ses flèches, et son fichier) |
| + − 0 | zoomer, dézoomer, 100 % |

Saisir une carte la passe devant les autres. Deux cartes posées au même endroit
— deux collages de suite — descendent en cascade au lieu de se couvrir. Les
flèches passent par-dessus les cartes.

## La base

Une ligne par élément (`public.board_item`) : `kind` vaut `image`, `note`,
`link` ou `arrow` ; `x, y, w, h, z` sa géométrie en unités de la toile ; `body`,
`url`, `title`, `path` son contenu ; `src`, `dst` les deux bouts d'une flèche,
qui disparaît avec l'un ou l'autre (cascade).

La règle est celle des variantes : **on ne voit une ligne que si l'on est
membre de son équipe**.

Les images ne sont pas dans la table : elles vont au bucket **privé**
`forensics`, sous `<team_id>/<uuid>.<ext>`, 10 Mo au plus, images seulement.
Le premier dossier du chemin EST l'équipe, et les règles du stockage le lisent
(`private.board_team()`). Le navigateur demande des URL signées, pour une
journée, en une requête pour toute la planche.

## Ce qui se relit, et quand

La planche se construit une fois et se raccroche : un redimensionnement ou
l'ouverture de la barre latérale refont le rendu de la page, et la reconstruire
perdrait la carte en cours de modification. Elle se relit au changement de
groupe, en revenant sur l'onglet après trente secondes, quand la fenêtre
reprend le focus, et au bouton ↻. Le dernier qui écrit gagne, comme pour les
réglages du groupe.

La vue est gardée sur l'appareil, par groupe (`saxon.forensics.vue.<team>`).

## Sans compte

L'onglet invite à se connecter : la planche appartient au groupe, et rien ne
s'y pose hors de lui.
