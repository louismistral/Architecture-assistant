# Paramètres & contraintes — le système

L'onglet sans numéro, en tête de la barre « Atelier et outils ». Il montre **tout ce qui influe
sur une variante**, une ligne par décision, et range chaque ligne dans un seul schéma.

```
src/data/lignes.js       le schéma : rôles, tags, onglets, sources, qui règle — et le magasin `V`
src/data/leviers.js      LEVIER       que fait-on varier ?
src/data/cadre.js        CADRE        la variante est-elle valide ?   (+ les règles de niveau, `NIV`)
src/data/orientation.js  ORIENTATION  où chercher d'abord ?
src/data/jugement.js     JUGEMENT     combien vaut le bâtiment pour le jury ?  (axes, critères, `noter()`)
src/data/recherche.js    GÉNÉRATEUR   essais, seeds, part du hasard
src/data/donnees.js      DONNÉES      nos hypothèses, et le catalogue des mesures
src/mass/mesures.js      ce qu'on lit sur une volumétrie : écarts au cadre, qualités, mesures brutes
src/mix/mesures.js       ce qu'on lit sur une répartition : les mesures brutes
src/typo/mesures.js      ce qu'on lit sur le plan des Typologies : mesures brutes, écarts au cadre
src/views/parametres.js  la page, et les volets « Contraintes » du mixer et du massing
styles/parametres.css    son dessin
```

`doctrine.js` et `jugements.js` n'existent plus : le mot ne disait pas ce qu'ils contenaient, et
ils mélangeaient ce qui fait varier une variante, ce qui la guide, ce qui l'élimine et ce qui la
note. Les rangs `forte` et `pref` orientaient le générateur ET faisaient le score : on ne savait
pas ce que valait un bâtiment.

## Deux moteurs

- **La recherche** produit beaucoup de variantes, diverses. Elle porte nos choix : les leviers,
  le cadre, l'orientation, le générateur.
- **Le jugement** note un bâtiment comme le ferait le jury — le bâtiment entier, programme
  réparti et volumétrie. Il ne lit que ses **mesures**, jamais la façon dont il a été produit :
  il noterait de la même façon le bâtiment d'un concurrent.

Entre les deux : dans la recherche, c'est l'**orientation, dosée avec le hasard**, qui choisit
entre deux candidats ; les propositions rendues sont **classées par le jugement**. Au massing,
`genMass()` retient la mieux orientée de chaque parti (`retenir()`, `V.hasardMass`), puis les
classe par la note du jury. Au mixer, la note de chaque niveau candidat est l'orientation, et
le bruit de Gumbel (`V.temperature`) le hasard.

## La page : cinq rubriques, qui se déplient

La page range les lignes en **cinq rubriques**, chacune dépliable, et chaque niveau à son tour
(`<details>` imbriqués, `groupe()` dans `views/parametres.js`). Le dépliage se retient d'un
rendu à l'autre ; le filtre ouvre ce qui répond et compte les lignes de chaque niveau.

| rubrique | rôles (`id`) | ce qu'elle dit | sous-niveaux |
|---|---|---|---|
| **Contraintes** | `cadre`, tag Intangible | valide ou non, fixé de l'extérieur — site, règlement, AEAI, cahier | par onglet |
| **Leviers** | `levier`, `recherche`, et le couloir + les huit surfaces à préciser | ce que nous décidons pour borner la recherche ; aucun effet propre sur la note | le bâtiment (par onglet) · les surfaces du cahier · le moteur de recherche (par onglet) |
| **Préférences** | `cadre` et `orientation` hors Intangible | ce qui guide le moteur sans définir ce qu'il a le droit de chercher | par tag — Imposé · Prioritaire · Souhaité · Indicatif — puis par onglet |
| **Évaluation** | les mesures, `jugement`, le prix au m³ | mesurer, puis noter ; rien n'y sert à générer | les mesures (par onglet) · le jugement : axe › sous-axe › critère |
| **Données** | `donnee`, le reste | le contexte que tout lit | hypothèses de construction · sujets · règlement par thème |

Une ligne suit son **tag vivant** (`rubrique()`) : un Imposé passé en Souhaité change de
sous-niveau. Les `id` des rôles sont restés — seuls les noms de `ROLES` (`data/lignes.js`) ont
changé : le cadre se lit « Contraintes », l'orientation « Préférences », le jugement
« Évaluation », le générateur « Moteur de recherche ». L'Imposé reste du cadre pour la
mécanique (`enVigueur()`) : rangé aux préférences parce que c'est un choix à nous, il élimine
toujours.

Le prix au m³ est rangé avec le critère de coût. Dans un volet, le découpage par onglet saute
(il est déjà filtré), les deux premiers niveaux sont ouverts, et le jugement se résume à ses axes.

## Quatre rôles, et deux hors rôles

| rôle | moteur | question | ce qui se règle |
|---|---|---|---|
| **Levier** | recherche | que fait-on varier ? | le domaine (plage ou options) · fixe ou libre |
| **Cadre** | recherche | la variante est-elle valide ? | le seuil · on/off si c'est notre choix |
| **Orientation** | recherche | où chercher d'abord ? | la cible, ou une valeur par option · le tag · on/off |
| **Jugement** | jugement | combien vaut le bâtiment pour le jury ? | la fonction de score · le poids · on/off |
| Données | — | ce que les rôles lisent | nos hypothèses seulement |
| Générateur | recherche | la machine, pas le bâtiment | essais, part du hasard |

Un même **sujet** peut porter une ligne par rôle, et elles peuvent diverger. Le parti : un
levier (fixe ou libre), et le jury le juge par la lisibilité mesurée de la figure (`b7`,
`b8`). La compacité : une orientation (`compa`, ce qu'on préfère) et un critère (`g58`, ce que
le jury récompense). La page se groupe **par rôle, par sujet ou par onglet**.

## Le schéma d'une ligne

| niveau | ce qu'il dit | valeurs |
|---|---|---|
| `sujet` | ce dont elle parle — ce qui rapproche les lignes des quatre rôles | libre |
| `role` | son rôle de départ | levier · cadre · orientation · jugement · donnee · recherche |
| `onglet` | où elle agit | programme · mixer · massing · typologie · rendu · tous |
| `src` | d'où elle vient, et l'article | règlement · AEAI · programme · site · notre choix · hypothèse · usage scolaire · concours gagnants · générateur · formule de mesure · construction |
| `qui` | qui la règle | le code · le groupe · chacun · domaine au groupe et état à chacun |
| `tag` | sa force — cadre et orientation seulement | voir plus bas |
| `k`, `k2` | la case de `V` qu'elle lit et écrit | un nombre, borné |
| `lu` | le module qui l'applique | un chemin |

Chaque rangée de la page dit aussi **ce que la ligne pense de la composition à l'écran** : un
cadre tenu ou enfreint, une orientation favorable, neutre ou défavorable, un critère et son
score, une mesure et sa valeur, les points effectifs d'une orientation du mixer.

## Les tags de force

| tag | couleur | rôle | effet |
|---|---|---|---|
| **Intangible** | rouge | cadre opposable | jamais enfreint par le générateur ; hors générateur, la variante est **invalide** ; ne se change pas |
| **Imposé** | orange | cadre choisi | jamais enfreint par le générateur ; hors générateur, l'écart est **notifié** ; se désactive |
| **Prioritaire** | jaune | orientation | la recherche n'y renonce que sans autre issue — pèse `V.forcePrio` (5) fois une souhaitée |
| **Souhaité** | vert clair | orientation | départage deux variantes |
| **Indicatif** | vert | — | n'influe sur rien ; le contrôle en parle encore |

Les couleurs sont des tokens de l'application (`--tag-*`, `--tag-*-on`, `styles/tokens.css`) :
des aplats qui portent leur fond, comme les pastilles d'état, donc valables dans tous les thèmes
et les deux modes.

Le tag se change depuis la page, sauf Intangible, parmi ce que la ligne admet (`admet`) : une
ligne dont la mécanique ne sait pas être une orientation (l'emprise d'un plateau, le module)
n'admet qu'Imposé ou Indicatif. **Les générateurs lisent le tag dans l'état** (`tagDe()`,
`enVigueur()`, `force()`). Passer la frontière Imposé / Prioritaire change le rôle de la
ligne : c'est la façon d'assouplir ou de durcir un choix — le recul de 5 m passé en Prioritaire
n'élimine plus rien, il oriente ; une orientation du massing passée en Imposé jette la variante
où elle se lit défavorable.

**Éteindre** une ligne (la case à cocher) est autre chose qu'Indicatif : éteinte, elle ne fait
rien et le contrôle se tait.

Le jugement n'a pas de tag : son importance est son **poids**, et ce n'est jamais le même
nombre.

## Le levier

Fixe, ou libre — le dé du mixer, partout. Pas de probabilité par option : **libre tire à parts
égales**, et ce que l'on préfère dans le domaine est une orientation. `pLie` et `pAdj` ont donc
disparu (elles valaient 0,5), le tirage de la pile « 0,55 puissance i » est devenu l'orientation
**pile compacte**, et les parts cachées du massing — salle de sport accolée une fois sur trois,
passerelles quatre fois sur dix, orientation 40/35/25, un volume de plus 35 % du temps — sont à
parts égales.

| onglet | leviers | où vit l'état |
|---|---|---|
| mixer | nombre de niveaux | `mix/opts.js` |
| massing | parti · figure · profondeur · largeur · salle de sport · passerelles · second temps | `MASS.parti`, `MASS.second`, `MASS.lev` |

L'**état** fixe ou libre suit chacun — il est dans l'instantané, comme les dés du mixer. Le
**domaine** (le minimum des cotes, 11 m, longueur d'une passerelle) est au groupe. Profondeur et
largeur n'ont plus de maximum réglé : la profondeur s'arrête à celle de façade des classes, la
largeur à l'élancement souhaité. Au rail du massing, les leviers portent le dé du mixer ; les
toucher rejoue la volumétrie. La figure et la largeur sont toujours libres : la seed les fige.
L'orientation de la figure est passée aux préférences (`cap`).

Le parti fixé veut dire que la figure a **la structure de son parti** (`signature()`,
`intact()`) : c'est le sens de l'option, pas une contrainte sur le bâtiment. « Respect du parti »
n'est donc plus ni orientation ni jugement — il lisait la signature du générateur.

## Le cadre

Le cadre ne note pas. Opposable (Intangible) : **les adjacences exigées** — la contrainte
première du mixer —, les règles de niveau qui restent opposables (abri, CAD, cour, scène), le
périmètre — aucun étage n'en dépasse —, la salle de sport, l'abri, **les surfaces posées**, la
cour du programme, le module… Choisi (Imposé) : le recul de 5 m, notre cour de 620 m², les
classes en façade, la salle de classe de 8 × 9 m, la fusion de deux volumes qui se touchent,
la trame de placement des pièces et l'accès de chaque pièce à un couloir (Typologies),
l'emprise d'un plateau, le seuil d'un sous-sol, les sanitaires par niveau. Passés en
préférences (Prioritaire) : la salle de sport, la piscine, l'UAPE et l'administration au rez,
chaque hall comme entrée de sa famille, les classes au plus au 2ᵉ étage, la distance incendie
entre bâtiments. Retirés : le niveau vide sous un niveau chargé, l'existant, les étages au plus,
l'unité pédagogique, le nettoyage et la conciergerie. Il y a aussi, au cadre, ce que le massing ne sait
pas encore lire (séisme, Minergie, rendu) : leur onglet est celui qui les vérifiera. Les voies
d'évacuation et SIA 500 se lisent désormais sur les plans des Typologies (`typo/mesures.js`),
avec les noyaux empilés et le programme posé — Imposés, donc ambre : le générateur de plans ne
sait pas encore tenir les 35 m, et aucune seed n'y change rien (`docs/typologies.md`).

**Ce qui ne vient pas du générateur n'est jamais supprimé** — une composition retouchée, un
bâtiment extérieur, une variante qu'un changement de cadre rend invalide. Il est noté, et ses
écarts passent par le contrôle (`mix/checks.js`, `mass/checks.js`), dont la sévérité se lit sur
le tag : rouge pour l'opposable (invalide), ambre pour le reste.

Le **recul** n'est plus dans `rules.js` : le règlement ne fixe aucune distance aux limites.
`recul()` est celui que la composition doit tenir (zéro quand la ligne n'est pas du cadre),
`reculVise()` celui qu'on vise (cadre ou orientation) : c'est lui qui donne l'aire posable, donc
les plateaux du mixer.

## L'orientation

Nos intentions. Deux formes :

- **une cible** — le massing. `mass/mesures.js — qualites()` rend pour chaque ligne une qualité
  q de −1 à +1 et un état, calés sur ses seuils. `preference()` en fait un nombre de 0 à 1, chaque
  ligne comptant `force()` fois ;
- **une valeur par option** — le mixer. Des points par niveau candidat, fois la force du tag. Les
  deux orientations prioritaires du mixer ont une valeur de base (9 et 4) qui, fois 5, redonne les
  45 et 20 points d'avant : la répartition n'a pas bougé.

L'adjacence exigée est du cadre opposable : le mixer lui donne un poids qui écrase le reste
(`IMPOSE`, 400 points — le sens du tag dans la langue de la note, pas un réglage), et une seule
rompue suffit à ce que le massing ne propose aucun volume. Une règle de niveau Imposée
assouplie ne ferme plus aucun niveau : elle ajoute `pts:<id>` au niveau qu'elle voudrait
(`niv.js — prefereNiveau()`).

**Orienter par l'usage** (massing, toutes Prioritaires, admettent l'Imposé) : `cla-soleil` lit
chaque façade longue d'un corps de classes par son azimut — à l'est (± `claEst`, 45°) +1, au sud
+½ (acceptable avec protection), au sud-ouest/ouest (± `claOuest`, 22,5° autour de 247,5°) −1,
au nord 0 ; une barre n'a qu'une façade à l'est au mieux, d'où le double. `sport-nord` : l'axe de
la façade longue de la salle de sport au nord (`sportNordBon` / `sportNordMax`). `cour-sud` et
`cour-route` : la façade devant laquelle s'ouvre la meilleure cour (`courUtile()`) regarde le sud,
son centre est loin de la rue (`courRoute`) ; l'UAPE, au rez, ouvre sur elle. `collectif-vue` :
une façade du rez que rien ne masque, vers le terrain de football, aux seuils de `vue`. Ce que le
massing ne sait pas — quel corps porte l'UAPE ou le hall, le vent — reste à la typologie.

**Le public d'un côté, l'école de l'autre** (`pub-est`, Prioritaire, notre choix) : ce qui est
public est dit UNE fois, au chapitre (`program.js`, `public:1` — la salle polyvalente et ses
annexes, la piscine, le chauffage communal ; l'UAPE est de l'école). `mass/mesures.js —
publicEcole()` projette les emprises publiques et scolaires sur la direction qui les sépare le
mieux : `pubSep`, leur recouvrement (0 : une ligne passe entre elles) ; `pubCote`, l'écart de
leurs centres vers `pubAz` (90°, l'est — la droite du plan). Favorable sans recouvrement et le
public au-delà de la demi-largeur de l'école, défavorable au-delà de `pubMele` (0,25) ou du
mauvais côté. Le générateur la suit aussi en dehors de `retenir()` : la salle de sport s'accole
d'abord du côté public, le second temps balaie d'abord cette marge. Au jury : `pub-sep` (D, 6),
`pub-cote` (B, 4), et `d39` lit `pubGroupe` sur les plans.

**La coupe par le poids** (mixer) : en bas le public, le bruit et les petits — les règles de
niveau (`niv-uape`, `niv-refectoire`, `niv-halls`, `niv-admin`) ; en haut le calme — `cla-haut`
et `bruit-calme`, passées Prioritaires ; la grande portée de la salle de sport jamais au milieu
de la pile — `gabarit` et `sport`, déjà du cadre opposable.

## Le jugement

Six **axes** — les critères du règlement (art. 1.26, « sans ordre hiérarchique ») — avec des
poids proposés, réglables : site 20 · fonctionnel 20 · expression 15 · extérieurs 15 · économie 15
· environnement 15. Chaque axe a ses **sous-axes**, les familles des critères de concours gagnants
(B à J), avec un poids dans l'axe.

Un **critère** est une mesure et une fonction de score (`max`, `min`, `bande`, `oui`,
`options`, `cout`), rattaché au sous-axe où il sert le mieux, avec un poids de 0 à 10 dans ce
sous-axe : en ajouter un ne gonfle pas l'axe. **Un critère compte une fois** : s'il sert deux
axes, sa part est partagée explicitement (`axes:{ G:.5, H:.5 }` pour la compacité). Trois
fusions en découlent — réserve de terrain + économie de terrain + stationnement (une seule
mesure, `terrainMarge`), « peu d'enterré » + « hors-sol maximal », et l'orientation des classes
partagée avec l'environnement.

```
sous-axe = Σ w·s / Σ w            sur ses critères (un critère partagé entre avec w × sa part)
axe      = Σ W·sous-axe / Σ W
note     = 100 × exp( Σ Wa·ln(max(0,02, axe)) / Σ Wa )     — moyenne GÉOMÉTRIQUE pondérée
```

**Pas de compensation aveugle** : dans un axe les critères se compensent, entre les axes non — un
axe faible écrase la note et aucun autre ne le rachète.

**Le coût** entre dans l'axe économie : le volume bâti SIA 416 mesuré, fois le prix au m³ — une
hypothèse du groupe (770 CHF, calée pour que la variante de départ tombe au budget de 29 M CHF,
art. 1.9) —, contre le budget ; 0 à 25 % de dépassement.

**La note manuelle.** Un critère sans mesure (l'expression surtout) se note à la main sur une
variante enregistrée, en cinq crans (fiche de la variante). Une variante qu'on n'a pas notée
reçoit **la moyenne des notes posées sur les autres** — 0,5 quand personne n'a rien noté : noter
une variante la situe par rapport à celles qu'on a notées, jamais au-dessus de celles qu'on n'a
pas regardées. Exclure le critère aurait fait lire un axe presque manuel sur son seul critère
mesuré. La **couverture** dit quelle part du poids a vraiment été lue ; elle est de 39 % au
départ.

Une **note générale** donne un classement unique ; chaque axe donne un **sous-classement**
(tri « Axe — économie générale »… dans le panneau des variantes). Changer un poids reclasse
tout, sans rien regénérer.

**Le plan des Typologies** donne ses propres mesures (`de:"typo"`), lues par `evaluer()` à la
seed typologie du moment : pour un même volume, la bonne et la mauvaise typologie. Quatre critères
qui lisaient une ESTIMATION au mixer ou au massing lisent désormais le plan — d33 (les classes
elles-mêmes, et non la façade du corps), prox (bord à bord, et non « au même niveau »), g59 (la
circulation dessinée), calme (le mur partagé, et non les niveaux mêlés) ; trois critères notés à
la main deviennent mesurés — d42 (les noyaux), d32 (les grappes), d43 (les locaux techniques) ; deux
sont nouveaux — tout le programme tient dans les plans, les couloirs éclairés à leurs bouts. Les
mesures `soleil`, `adjTenues`, `circPart`, `bruitMixte` restent : l'orientation les lit. La
**part Typologie** (`scoreTypo()`) est la moyenne pondérée de ces critères — un sous-classement
(tri « Typologie »), pas un axe : elle lit la note, elle ne la change pas.

## Chaque variante garde ses mesures

`criteria` vaut `{ v:4, mes, cadre:{ ko, notif }, main }` : les **mesures brutes** du bâtiment
(`donnees.js — MESURES`), ses écarts au cadre, ses notes manuelles. La note se refait côté client
avec le jury du jour (`net/variantes.js — noteDe()`) ; la colonne `score` ne garde que la note du
jour de l'enregistrement, pour le premier tri de la base. Une variante d'avant n'a pas de mesures
— sa note est en italique, « Reload » la mesure et la renote, et garde ses notes manuelles. Une v3
a ses mesures mais pas celles du plan : notée sur ce qu'elle a, en italique aussi, jusqu'au Reload.

La **clé d'une borne change avec son sens** (`jugement.js — cleBorne()`, `kb`) : d33 se mesurait
en degrés, calme en niveaux ; leurs bornes se lisent désormais sous `jb:d33-plan`,
`jn:calme-plan`… Une borne réglée avant, sous l'ancienne clé, est ignorée à la lecture plutôt
que relue en part ou en mètres.

Aucune migration : les mesures et les notes manuelles vont dans `criteria` (jsonb), les lignes
du groupe dans `team_settings.doctrine` (jsonb, le nom de la colonne est resté).

## Qui règle quoi

| qui | quoi | où |
|---|---|---|
| chacun | l'état fixe / libre des leviers, et la valeur fixée | l'instantané (`mix/store.js`) |
| le groupe | le cadre choisi, l'orientation, les tags, les domaines des leviers, le générateur | `V`, sans le jury — dans l'instantané ET `team_settings` |
| le groupe | le jury : critères, poids, axes, fonctions, prix au m³ | `V`, marqué jury — `team_settings`, et à part sur l'appareil |
| le groupe | nos hypothèses : couloir, surfaces à préciser | `core/model.js` — `team_settings` |
| le code | le cadre opposable, le site, le règlement, les formules de mesure | `rules.js`, `site.js`, `program.js`, `cadre.js`, `mesures.js` |

Le **jury n'est pas dans l'instantané** : recharger une variante remet la recherche dans l'état
où elle l'a produite, jamais les poids qui la notent — deux variantes se comparent avec le même
jury, ou ne se comparent pas. L'appareil garde le jury à côté (`jury` dans `saxon-mix-v1`) pour
qui travaille sans groupe. Les défauts du jury ne sont pas dans l'**empreinte** : changer un poids
renote une variante, il ne la périme pas.

Une valeur réglée est persistée, mais seulement son **écart** au défaut. Les anciennes clés — les
rangs, les bacs `b_`/`w_`/`x_`, `debordPoids`, `grappePoids`, `adjDur`, `pLie`, `pAdj`, `courFond`
— sont ignorées à la lecture.

## Aucune copie

Chaque contrôle de la page lit et écrit la case même que les moteurs lisent : `V` pour les lignes,
`mix/opts.js` et `MASS` pour l'état des leviers, `core/model.js` pour le couloir et les surfaces.

## Les volets « Contraintes » des outils

Ils sont la page, filtrée sur l'onglet (`parametresVue(render, { onglet })`), coiffée d'un bouton
qui rejoue le tirage ; mêmes rubriques, sans le sous-niveau par onglet ; le jugement s'y résume à
ses axes, et le mixer y ajoute les piles que le site admet. Un seul dessin des lignes, où qu'on les lise.

## Ajouter une ligne

Une entrée dans le fichier de son rôle : `id`, `n`, `sujet`, `onglet`, `src`, `qui`, et selon le
rôle `tag` + `admet` + `off`, ou `k` + `def` + bornes, ou pour un critère `mesure` + `f` + `w`. La
page, la persistance et l'empreinte suivent. Une valeur qui n'est dans aucune ligne est un nombre
écrit en dur, et c'est un défaut.

Hors modèle : le thème, le mode, le tri et les filtres des variantes (`net/prefs.js`) — ils ne
changent aucune variante.
