# Le score des typologies, la recherche qui les rebat — conception

2026-10-05 · branche `louis/typologies-score`

## Pourquoi

Pour un même volume, il y a une bonne et une mauvaise typologie : les classes au sud ou au nord,
les liens tenus ou rompus, un noyau au bon bout ou au mauvais. Aujourd'hui la note du jury
l'ignore — le plan ne se dessine que dans l'iframe de l'onglet, et rien d'autre ne sait le
mesurer. Quatre demandes :

1. un score des typologies, qui se JOINT à la note du bâtiment ;
2. la recherche automatique rebat aussi les typologies ;
3. les variantes gardent la typologie comme elles gardent les volumes ;
4. le formulaire de la recherche, à jour de l'application d'aujourd'hui.

## Ce que dit le code aujourd'hui

- Le générateur de plans `PG` (≈ 580 lignes) et son contrôle vivent en script dans
  `src/typo/plans.html`. Ni la recherche, ni `resumeCourant()`, ni node ne peuvent tirer un plan.
- Les variantes gardent DÉJÀ la seed et les cotes de la typologie (`snapshot().typo`, `setTypo`)
  — mais aucune mesure du plan, et Reload ne mesure pas les plans.
- Un plan complet coûte 2 à 8 ms (sonde node, seed(1), genMass(11)). La seed déplace des classes
  d'une bande à l'autre : 18 au sud / 8 au nord au mieux, 13 / 14 au pire.
- Les plans perdent 160 m² (barre) à 1'180 m² (cour) de programme selon le parti, à toute seed :
  le massing dimensionne sur la circulation ESTIMÉE. C'est une tâche à part (massing) ; ici on le
  mesure et on le note.
- Le formulaire de la recherche date du 29 septembre : sa grille « Les partis essayés » double le
  levier parti (fixe/libre, avec son dé, depuis le 5 octobre), « pile comprise » ignore le dé de la
  pile, il ne connaît pas les typologies, « sans erreur rouge » ne lit que mixer et massing.

## 1 · Architecture : le plan sort de la page

```
src/typo/gen.js        PG, déplacé : creerPG(D) → la même API qu'aujourd'hui (genNiveau, ancre,
                       hotes, oublier, local, versEtage, versMonde, constantes)
                       + planifier(D) → tous les niveaux, [{ F, non, fl }]
src/typo/mesures.js    lirePlans(D, tous) → ce que dit le plan, lu une fois : pièces en
                       coordonnées du site, noyaux, liens, non posé, évacuation, scène
                       mesuresTypo(vols, ponts) → { mesures }    ecartsTypo(vols, ponts) → [écarts]
src/typo/donnees.js    donneesTypo(vols, ponts) — les volumes en argument ; par défaut ceux à
                       l'écran (massOf())
src/mass/mesures.js    evaluer(vols) : mes = mix ∪ mass ∪ TYPO ; ecarts = mass ∪ TYPO
src/typo/plans.html    PG = parent.typoPG(DATA) ; controle() ne fait plus qu'ÉCRIRE ses phrases,
                       ses nombres viennent de parent.typoLecture() — aucun second calcul
src/views/render.js    typoHote() expose typoPG, typoLecture, typoEvaluation à la page
```

- `PG` change le moins possible : il lit `D` (son argument) au lieu du global `DATA`, et chaque
  appel à `creerPG()` a ses propres caches (`HOTES`, `ANC`). Le dessin, le mobilier et le rail
  restent dans la page.
- **Un seul point de jonction : `evaluer()`.** Tout ce qui juge déjà un bâtiment reçoit la
  typologie sans être touché : le rail du Massing, la page Paramètres, `resumeCourant()`
  (variantes, Reload), l'import Rhino — et `genMass()`, qui classe ses candidates par
  `evaluer(c.vols)` : d'où les volumes en argument, pour que chaque candidate soit planifiée dans
  SES volumes, à la seed typologie courante.
- Pour la recherche, `renoterTypo(ev, vols)` refait la seule part typologie d'une évaluation
  (mesures, écarts, note) sans remesurer le massing.
- Pas de cache : 2 à 8 ms par plan. On en ajoutera un si une mesure le montre lent.
- La page reçoit de l'hôte des fonctions et des objets du parent (même origine) : elle n'utilise
  ni `instanceof Array` ni rien qui dépende du domaine JS.

## 2 · Les mesures et les critères

Les plans donnent des MESURES (`donnees.js — MESURES`, `de:"typo"`, onglet typologie, lues par
`src/typo/mesures.js — mesuresTypo()`). Le jury les note comme les autres. Un critère qui lisait
une ESTIMATION de la même chose au mixer ou au massing lit désormais le plan : un critère compte
une fois.

Ne sont retenues que les règles que le plan sait mesurer ET que la seed déplace — une règle que le
volume seul décide ne départage pas deux typologies. Sources : VS 400.200, AEAI 16-15, directives
vaudoises 2002 et 1-4P, Raumstandards de Zurich, rapports de jury de Broc, Vignettaz, Praroman,
Matran, Cugy, Suhr.

| critère (sous-axe) | lisait | mesure du plan | 1 → 0 |
|---|---|---|---|
| **d33** Classes éclairées, bien orientées (D+H) | `soleil`, façade du corps | `classesSoleil` : part des salles de classe (`UNITE`) dont la façade de jour regarde S/SE/E ; SO/O comptent moitié | 0,9 → 0,5 |
| **prox** Proximités du schéma tenues (D) | `adjTenues`, même niveau | `liensPlan` : part des liens actifs tenus à ≤ `RULES.circ.proche` (15 m) bord à bord, au même niveau | 1 → 0,6 |
| **g59** Circulations limitées (G) | `circPart`, estimée | `circPlan` : circulation DESSINÉE (couloirs, paliers, noyaux) ÷ bâti | 0,25 → 0,35 |
| **calme** Le bruyant séparé du calme (D) | `bruitMixte`, niveaux mêlés | `murBruyant` : longueur de mur partagé entre une classe (`CLSRE`) et une pièce bruyante (`BRUYANT`, plus l'UAPE et le chapitre technique) | 0 → 9 m |
| **d42** Un ascenseur, une ou deux cages (D) | à la main | `noyaux` : noyaux escalier + ascenseur de l'école | 2 → 4 |
| **d32** Grappes de classes reliables (D) | à la main | `grappes` : part des salles de classe dans une suite de 3 à 4 classes contiguës, même bande, même couloir | 1 → 0,3 |
| **d43** Locaux techniques regroupés (D) | à la main | `techGroupes` : groupes disjoints de pièces du chapitre `tech` | 1 → 4 |
| *nouveau* **d-pose** Tout le programme tient dans les plans (D) | — | `posePlan` : part du programme posée | 1 → 0,9 |
| *nouveau* **d-jour** Couloirs éclairés à leurs bouts (D) | — | `couloirsJour` : part des bouts de couloir sur une façade (ni pièce ni noyau ne les ferme) | 1 → 0 |

Précisions de mesure :

- `classesSoleil` — l'azimut de la normale sortante de la façade de jour (y du site vers le nord,
  comme `bandeSud()`) : 1 de 67,5° à 202,5° (E à SSO), ½ de 202,5° à 292,5° (SO à O), 0 ailleurs.
  Une pièce traversante (cadre `full`) prend la meilleure de ses deux façades.
- `grappes` — une suite de 3 ou 4 classes contiguës compte 1, de 2 ou de 5 à 6 compte ½, une classe
  seule ou une suite de plus de 6 compte 0 ; un noyau ou un bloc sanitaire coupe la suite.
- `noyaux` — les piles de noyaux distinctes : un noyau répété à chaque niveau compte une fois.
- `techGroupes` — pièces du chapitre `tech` qui se touchent (écart ≤ 2 murs), tous niveaux.
- `couloirsJour` — deux bouts par couloir de corps et de niveau ; un bout qui passe dans le corps
  voisin (`passG`, `passD`) ne compte pas.
- `circPlan` — couloirs + paliers + noyaux dessinés ÷ Σ L × D des corps, tous niveaux.

Les mesures `soleil`, `adjTenues`, `circPart`, `bruitMixte` restent : l'orientation et les volets
les lisent encore ; seul le jury passe au plan. Poids, bornes et interrupteurs sont des lignes du
jury, réglables dans Paramètres comme les autres.

**La part « Typologie »** — la moyenne pondérée des critères qui lisent une mesure `typo` —
`scoreTypo(j)` dans `jugement.js`. Ce n'est pas un axe : elle ne change pas la note, elle la
lit. Elle s'affiche avec l'évaluation et devient un tri du panneau des variantes.

### Les écarts au cadre — onglet typologie, sévérité lue sur le tag

| ligne | tag | écart |
|---|---|---|
| `fuites` | Intangible (AEAI 16-15) | plus de 35 m vers un escalier (50 m vers deux) ; un étage de plus de 900 m² à un seul noyau |
| `sia500` | Intangible | un niveau sans noyau escalier + ascenseur |
| `scene-sport` | Intangible | le plan ne colle pas la scène à la salle de sport |
| *nouveau* `noyaux-empiles` | Imposé | des noyaux décalés d'un niveau à l'autre |
| *nouveau* `typo-pose` | Imposé | des pièces non posées (ambre) |

`fuites` et `sia500` (aujourd'hui « à vérifier — onglet typologie ») deviennent mesurés ;
`couloir-acces` reste tenu par construction ; `trame` reste à construire.

Un écart typologie ne jette aucun volume : `genMass()` garde sa garde du massing seul. Il entre
dans `ev.ecarts`, donc dans `invalide` / `notifie`, et dans `verdict.typo` `{ e, w }` d'une
variante. Une note qui passe en rouge au Massing parce que les plans enfreignent une ligne
Intangible le dit dans son titre.

### Reporté, chacun une décision à part

Pièces servantes au nord et servies au sud (recoupe d33) ; salle des maîtres sur le préau (les
appuis viennent de projets classés, pas lauréats) ; UAPE à entrée propre ; enfantines au rez
(décision du mixer) ; salles d'appui réparties ; profondeur de classe ≤ 7 m et front des
vestiaires (la seed ne les bouge pas : au cadre, si on les veut) ; cul-de-sac ≤ 10 m (aucune norme
trouvée).

## 3 · La recherche et son formulaire

**Les dés font foi.** La recherche obéit aux leviers là où ils vivent : ce qui est libre se rebat,
ce qui est fixé reste. La grille « Les partis essayés » disparaît (et `RECH.partis`).

```
RECH = { programme, massing, typologies, parVolume: 5, essais: 30, garder: 3,
         sansErreur: true, distincts: true }
BORNES.parVolume = [1, 100]
```

- **Ce qu'on rebat** — trois cases : le programme, le massing, les typologies.
- **Typologies cochées avec le massing** (ou le programme : le volume suit la pile) : une case
  nombre apparaît, « Typologies essayées par volume », 5 par défaut. Chaque volume tiré essaie ce
  nombre de seeds de typologie (`renoterTypo`) et garde la meilleure, AVANT d'être comparé aux
  autres volumes. Une variante trouvée garde la seed retenue.
- **Typologies cochées seules** : les essais sont des seeds de typologie sur le massing à l'écran,
  sans `genMass()` ; « Un seul par parti » et « par volume » se masquent.
- Les seeds de typologie se tirent par `rng()`, comme celle du massing ; tout est remis à la fin,
  `TYPO.graine` comprise.
- **Le résumé**, en lecture seule, sous chaque case cochée — l'essentiel de CE Shuffle, et où il
  se règle :
  - programme : la pile (`dePile` — libre, ou fixée à n niveaux), les postes liés, les cotes
    fixées, la part du hasard (`V.temperature`), la seed d'où l'on part ;
  - massing : le parti (libre, ou fixé — lequel), le second temps, les leviers (k libres sur n,
    et lesquels sont fixés), les compositions essayées (`V.essais`), la part du hasard
    (`V.hasardMass`) ;
  - typologies : ce que la seed change (ordre des familles, bout du noyau), les cotes de pièces
    réglées aux Typologies, la seed d'où l'on part.
- **Sans erreur rouge** : ni au mixer, ni au massing, ni aux typologies (`verdict.typo.e`).
- **La durée annoncée** : 0,8 s par essai qui rebat le programme ou le massing, plus 0,01 s par
  typologie essayée.
- La progression nomme parti et seed typologie de chaque retenue.

## 4 · L'onglet Typologies, les variantes, la vérification

**L'onglet.** Une étape **Évaluation** au rail, seconde comme au Massing — 1 · Bilan du niveau,
2 · Évaluation, 3 · Contrôle, 4 · Familles. Elle porte la note générale (rouge si invalide), la
part Typologie, et chaque critère typologie : son nom, sa mesure, sa barre de score
(classes `mass-axe`, déjà chargées). Elle lit `parent.typoEvaluation()` et se refait à chaque
Shuffle typologie. Pas de bouton « chercher la meilleure » : on cherche par la recherche
automatique.

**Les variantes.** Sans migration :

- `resumeCourant()` passe par `evaluer()` : `criteria.mes` porte les mesures typo,
  `criteria.cadre` ses écarts, `verdict.typo` ses comptes ;
- `criteria.v` passe à 4. Une variante v3 reste notée sur ses mesures (les critères typo y sont
  « sans objet »), en italique, et Reload la remesure — à sa seed typologie, 1 si elle n'en a pas ;
- le modal montre la seed typologie avec les deux autres (`state.typo.graine`) ;
- le menu de tri gagne « Typologie » (`scoreTypo`).

**Le paramétrage.** `data/recherche.js` gagne la ligne `seed-typo` (chacun, onglet typologie),
comme `seed-mix` et `seed-mass`.

**L'ordre des commits.** Les fichiers de données d'abord, seuls, en un commit (`jugement.js`,
`donnees.js`, `cadre.js`, `recherche.js`) ; puis l'extraction de `PG` ; puis les mesures et la
jonction ; puis la recherche ; puis l'onglet et les variantes ; la doc en dernier, isolée.

**Vérifier.**

1. **L'extraction ne change aucun plan** : avant de retirer `PG` de la page, une sonde compare la
   sortie de l'ancien `PG` (le script de la page, évalué) et de `creerPG()` — `genNiveau` sur
   chaque niveau, les douze partis, seeds 1 à 5 : JSON identique.
2. Les trois snapshots de `CLAUDE.md` passent ; le jugement change là où d33, prox, g59, calme
   lisent le plan, et c'est attendu.
3. **Un quatrième snapshot**, ajouté à `CLAUDE.md` : seed(1), répartir, genMass(11), puis seeds
   typologie 1 à 5 — les mesures typo, les écarts, la note, la part Typologie. Il doit montrer la
   note qui bouge avec la seed, à volume égal.
4. Au navigateur : l'onglet Typologies dessine le même plan à la seed 1 qu'avant ; l'Évaluation
   suit le Shuffle ; une recherche « typologies seules » enregistre des variantes qui, chargées,
   redonnent leur plan ; Reload remesure une variante v3.

**La doc.** `docs/typologies.md` (le score, `gen.js`, `mesures.js`), `docs/parametres.md` (les
mesures typo, les critères qui passent au plan), `docs/variantes.md` (la recherche réécrite,
`criteria.v` 4), `CLAUDE.md` (le quatrième snapshot ; « Une mesure du bâtiment » nomme
`src/typo/mesures.js`).
