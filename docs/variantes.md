# Les variantes partagées

Enregistrer l'état du projet sous un nom, et le recharger à l'identique — seul
ou à plusieurs.

```
src/data/supabase.js   l'adresse de la base et sa clé publiable   ← source unique
src/net/supa.js        le client : jeton, session, REST           (aucune dépendance)
src/net/compte.js      l'identité, l'équipe, ses membres
src/net/reglages.js    les décisions de projet partagées
src/net/variantes.js   poser, lister, charger, supprimer
src/net/recherche.js   la recherche automatique — tirer beaucoup, garder peu
src/core/empreinte.js  l'empreinte des fichiers du dépôt
src/views/variantes.js le panneau, les modaux, le profil
styles/variantes.css   leur dessin
```

## Ce n'est pas un onglet

Les onglets sont la CHRONOLOGIE du concours, et une variante ne s'y range nulle
part : elle les traverse tous les trois. Le bouton vit donc **à côté du compte**,
hors du groupe de destinations, et ouvre un panneau qui se pose **par-dessus**
ce qu'on faisait. Il ne repousse rien : le plan et la 3D garderaient sinon un
cadrage différent selon qu'il est ouvert, et l'on comparerait deux implantations
à deux échelles.

## Le badge du compte, et le panneau

Deux choses, deux endroits. Le **badge** à côté du thème porte l'identité : les
groupes dont on fait partie, les invitations reçues, le mot de passe, la
sortie. Le **panneau** porte les variantes. Les mêler aurait confondu « où je
travaille » et « ce que j'ai fait ».

Le badge montre les initiales quand on est connecté, une silhouette sinon —
cliquer ouvre alors le panneau, sur le formulaire, car il n'y a qu'un seul
endroit où l'on entre. Une pastille dessus signale une invitation en attente.

## Plusieurs groupes

Un groupe par concours, et l'on peut être dans plusieurs. Le panneau porte
**un onglet par groupe**, avec les pastilles de qui est dedans. Ils ne
paraissent qu'à partir de deux : un seul onglet n'est pas un choix, c'est un
titre — et le nom du groupe est déjà en tête du panneau.

Changer d'onglet change le périmètre de TOUT : les variantes ET les réglages de
projet. Le groupe actif est retenu sur l'appareil (`saxon.equipe`).

| geste | qui |
|---|---|
| renommer le groupe | n'importe quel membre |
| inviter, retirer, transmettre | le propriétaire |
| rejoindre, refuser une invitation | l'invité |
| quitter | chacun, mais le propriétaire transmet d'abord |

**Le propriétaire ne part pas en laissant le groupe orphelin** : un groupe sans
propriétaire ne peut plus inviter personne, et ne se répare pas. La règle est
dans la base — un déclencheur sur la suppression d'une appartenance —, pas
seulement à l'écran.

**Transmettre est un seul appel**, `transferer_propriete`. En trois appels
depuis le navigateur l'ordre décidait de tout : dès que `owner_id` a changé,
l'ancien propriétaire n'a plus le droit de toucher aux rôles, et sa mise à jour
ne touche AUCUNE ligne **sans rien dire** — une politique UPDATE filtre, elle
ne crie pas. On obtenait un groupe dont le propriétaire n'a pas le rôle
« propriétaire ».

**Une invitation vise une ADRESSE**, pas un compte : c'est le seul lien
possible avec quelqu'un qui n'existe pas encore. Elle est ramassée à
l'inscription par un déclencheur ; pour un compte qui existe déjà, elle
apparaît dans son profil et il l'accepte. Ce second cas manquait : inviter
quelqu'un d'inscrit ne faisait rien, en silence.

## Trois sections

- l'**en-tête**, qui reste accroché : « Variantes », le compte, le groupe, la croix ;
- les **outils** : le groupe à l'écran (ses onglets, à partir de deux),
  enregistrer, la recherche automatique ;
- les **enregistrements** : les presets qui remettent tous les onglets en place,
  avec leur barre — trier, filtrer, chercher à gauche, **Reload** à droite.

Rien ne rétrécit dans le corps du panneau : c'est lui qui défile. Les onglets de
groupe, un conteneur en `overflow-x:auto` donc de hauteur minimale nulle,
s'écrasaient dès que la liste remplissait le panneau.

**Enregistrer** : le champ du nom et le « + » sont les deux moitiés d'un même
bouton. On nomme, puis on pose ; vide, la variante prend le nom proposé.

## Deux niveaux, et c'est tout le dessin

- La **carte** porte ce qu'il faut pour RECONNAÎTRE une variante et la CHARGER :
  une miniature CARRÉE à gauche ; à droite le nom et la note, qui et quand, ses
  étiquettes, et — calés sur le bas de la miniature — trois gestes : **Charger**,
  **Infos**, et la **poubelle**. Elle ne se confirme pas, elle s'ALLUME, comme
  « Supprimer » dans le modal (`meche()`, `views/variantes.js`) : le bouton
  devient « Annuler » et une mèche rouge brûle son bord quatre secondes ; un
  clic ou Échap l'éteint, revenir dessus à la souris la fige. La variante part
  à la FIN de la mèche, pas au clic — la base est celle du groupe, et annuler ne
  saurait pas rendre une ligne effacée ; un bouton qui a quitté l'écran
  (fenêtre ou panneau refermé) n'efface rien. Plusieurs mèches brûlent
  ensemble : la liste repeinte après une suppression reprend les autres au
  même point (`ALLUMEES`). Elle a été haute comme une affiche : trois variantes
  remplissaient le panneau, et comparer demandait de défiler.
- Le **modal** porte tout le reste — la note critère par critère, les graines,
  les surfaces, les contrôles.

Les **étiquettes** se cumulent : `new`, `périmée`, `algo`.

## Trier, filtrer, chercher

Le vocabulaire est celui des listes qu'on connaît (Linear, Notion) : un tri,
des filtres qui se cumulent, une recherche.

| outil | règle |
|---|---|
| trier | note, date, nom, auteur, type de massing — dans un sens ou l'autre. Par défaut : la note, la meilleure d'abord |
| filtrer | note (de… à…), auteur, état (à jour · périmées), date (24 h · 7 · 30 jours), type de massing, origine (recherche auto · à la main) |
| chercher | le nom, l'auteur, le type, les étiquettes |

Au repos, un bouton n'est qu'une icône ; dès qu'il règle quelque chose, il
s'élargit pour dire QUOI (« Date ↑ », « Note ≥ 80 ») ou, si c'est trop long,
combien de choses. Les trois réglages suivent le **compte** (`net/prefs.js`,
colonne `profile.prefs`) : on les retrouve sur un autre appareil.

Le **tri** est un seul choix : c'est le déroulant du menu ◐ (`views/menu.js`),
un titre par critère et ses deux sens dessous. Le **filtre** est un petit
formulaire, pas une liste : il reste un panneau, mais s'ouvre en pop comme le
déroulant — à l'ouverture seulement, pas à chaque réglage qui le repeint.

Le type de massing d'une variante « Auto » est celui que la composition a
réellement tiré : la miniature l'enregistre (`thumbnail.parti`). Les variantes
d'avant n'ont que `parti`, qui vaut alors `auto`.

## Les nouvelles

Une variante qu'on vient d'enregistrer — à la main ou par la recherche — est
**new** : elle monte en tête, **hors tri et hors filtre**, cernée et soulignée
d'un trait, pour qu'on la retrouve sans la chercher. C'est en mémoire
seulement : le badge tombe quand on ferme l'application, quand on ferme le
panneau, quand on ouvre ses informations, ou au Reload.

## Reload

Il remet la liste d'aplomb : les `new` tombent, la liste est relue, et chaque
variante est **rejouée par le code d'aujourd'hui** (`rejouerTout()`) — sa note,
ses critères, son verdict, ses surfaces et sa miniature sont recalculés et
réécrits en base s'ils ont changé. Une note d'un ancien juge (vingt-trois
critères, ou 670 sur 100) n'a plus de sens : elle est refaite, pas cachée.

L'**empreinte ne bouge pas** : elle dit sur quelle version du programme et du
règlement la variante a été COMPOSÉE, et rejouer ne recompose rien. Une
variante périmée le reste.

Comme la recherche, Reload travaille sur l'état vivant et le remet tel quel —
y compris la doctrine et les surfaces « à préciser », que `restore()` ne défait
pas seul.

**« Charger » est la raison d'être de l'écran**, donc le seul bouton plein. Il
remet le cahier des charges, le mixer et le massing dans l'état exact.

La **miniature** dessine le périmètre du relevé D'AUJOURD'HUI et les corps de la
variante : si le terrain a changé, on le voit tout de suite, et c'est justement
ce qu'une variante périmée doit montrer.

## Une variante est un preset, pas une photo

Elle porte trois familles de choses :

- **ce qui rejoue** — les deux graines, le parti, et l'instantané de `store.js`.
  Les graines suffiraient à reconstruire une composition TIRÉE ; l'état complet
  est là pour celle qu'on a RETOUCHÉE à la main, et qu'aucune graine ne retrouve ;
- **ce qui se trie** — note, niveaux, corps, surfaces, en colonnes et non en
  JSON : trier cinquante variantes par note ne doit pas demander d'ouvrir
  cinquante états ;
- **ce qui se montre** — verdict, détail de la note, polygones de la miniature,
  pour dessiner le panneau sans rejouer un générateur par carte.

`restore()` repart de la doctrine **par défaut** avant de poser celle de
l'instantané : une valeur réglée avant de charger une variante survivait sinon
à une variante qui ne la touchait pas, et la variante ne se reproduisait plus.

L'état est celui de `snapshot()` dans `src/mix/store.js`, sans un octet de plus :
un seul objet dit ce qu'est « l'état du projet », et deux choses le lisent —
l'enregistrement sur l'appareil, et une variante. Les séparer aurait fait deux
vérités.

**Le tirage est reproductible**, et ce n'est pas une promesse en l'air : il n'y a
aucun `Math.random` hors de `src/core/rand.js`, et les deux tirages ont deux
graines séparées (`curSeed` pour le programme, `MASS.graine` pour le massing).

## La péremption

Une variante s'appuie sur des nombres qu'on ne peut PAS changer depuis
l'application : le programme, le règlement, les adjacences, le relevé, et les
valeurs par DÉFAUT de la doctrine. Ceux-là changent en éditant le code.

Quand ils changent, une variante enregistrée avant ne dit plus la vérité. Elle
porte donc l'**empreinte** de ces cinq sources (`core/empreinte.js`), comparée à
la relecture. Une variante périmée est **signalée, et reste chargeable** — on
perdrait sinon la possibilité de comparer avec ce qu'on faisait avant —, et le
modal dit LAQUELLE des cinq a bougé.

Une variante sans empreinte — d'avant cette version — n'est pas déclarée
périmée : on ne sait pas, et accuser à tort est pire que se taire.

**L'empreinte des adjacences lit la déclaration**, figée au chargement du
module. La vue du volet Adjacences écrit sa mise en page SUR les nœuds de
`schema.js` (`nd.x`, `nd.bw`, `nd.lines`…), et cette mise en page dépend de la
largeur de la fenêtre : toute variante enregistrée après avoir ouvert ce volet
se déclarait périmée chez qui ne l'avait pas ouvert. La base en porte quatre
valeurs pour un `schema.js` inchangé depuis le 26 septembre ; elles restent
signalées périmées (on n'a pas réécrit l'historique), les nouvelles non.

**L'empreinte ne hache pas `CHAP` tel quel**, et c'est tout le sujet :
`recompute()` écrit sur ses objets mêmes — `total`, `circ`, `gross`, `key` —,
`applyAreas` remplace le `u` des huit postes « à préciser », et le tri des
postes par surface décroissante CHANGE L'ORDRE du tableau. L'empreinte variait
donc entre deux chargements de la même page, et toute variante se déclarait
périmée dès qu'on avait précisé une surface. On ne garde que ce que le fichier
écrit, rangé par nom — et pas la surface des postes « à préciser », qui est une
décision de nous, partagée au groupe et enregistrée avec chaque variante.

(`u0` n'est pas la valeur du fichier : `recompute()` le réécrit à chaque
passage, donc il vaut « u au dernier calcul ».)

## Ce qui se partage, et ce qui ne se partage pas

| partagé au groupe | reste à chacun |
|---|---|
| les variantes | la composition à l'écran |
| les 8 surfaces à préciser | les écarts assumés |
| la largeur du couloir | les réglages du mixer et leurs dés |
| la doctrine réglée | |

Les trois réglages partagés sont des **décisions de projet** : si l'un travaille
avec un couloir de 2,40 m et l'autre de 3 m, leurs deux variantes ne se comparent
plus. (La colonne `circulation` de `team_settings` porte cette largeur depuis que
la circulation se déduit des pièces ; une part enregistrée avant, 0,18, est hors
des bornes d'une largeur et se refuse d'elle-même.) La composition, elle, est un **geste de travail** — travailler n'est pas
publier, et un Shuffle de l'un ne doit pas changer l'écran de l'autre en pleine
phrase.

Les réglages se lisent à l'ouverture (le distant gagne : c'est la décision du
groupe) et s'écrivent au fil de l'eau. Le dernier qui écrit gagne, et le panneau
dit QUI. À deux, sur un concours, se voler un réglage se règle en se parlant, pas
en verrouillant une table.

**Charger une variante change donc aussi les réglages du groupe** — c'est
nécessaire : sans cela la variante ne se reproduirait pas.

## La recherche automatique — « algo search »

Tirer cinquante fois à la main pour garder les trois meilleures, c'est le geste
qu'on faisait déjà. Le bouton **Recherche automatique**, sous « Enregistrer »,
le fait seul. On y décide quatre choses :

| on décide | par défaut |
|---|---|
| ce qu'on rebat : le **programme** (répartition du mixer, pile comprise), le **massing**, ou les deux | les deux |
| les partis essayés — aucun coché : celui à l'écran ; plusieurs : on tourne sur la liste | aucun |
| combien d'essais, et combien on en garde | 30 · 3 |
| ce qu'on garde : **sans erreur rouge** (mixer et massing), **un seul par parti** | oui · oui |

On garde les meilleures **notes du juge** (`mass/juge.js — noter()`), sur 100 ;
à note égale, la moins fautive. La note se lit, elle ne choisit pas la
composition : le générateur choisit toujours par la hiérarchie. La recherche,
elle, trie ce que le générateur a rendu, et c'est exactement ce qu'on faisait
à l'œil.

- **Elle ne connaît pas d'autre tirage que les deux boutons** : `repartir()` et
  `genMass()`. Une variante trouvée est une variante qu'on aurait pu tirer
  soi-même, et elle se rejoue par ses graines.
- **Elle travaille sur l'état vivant et le remet tel quel** à la fin, graine du
  programme comprise : chercher n'est pas composer. Ce qu'on toucherait pendant
  la recherche serait donc perdu — le formulaire le dit.
- **Les résultats vont au groupe**, en un seul envoi, avec l'étiquette
  `algo search` dans la colonne `tags` (migration `20260928120000`). Le panneau
  les marque de l'étiquette `algo`, et le filtre « Origine » les sépare.
- Un essai coûte près d'une seconde, presque tout au massing. La page reste
  vivante entre deux essais, la progression se lit dans le panneau, et
  « Arrêter » garde ce qui a été trouvé jusque-là.

En « Auto », `MASS.parti` vaut `auto` : c'est la composition (`MASS.vol.parti`)
qui dit quel parti a été tiré, et c'est elle qui distingue et nomme.

## Charger écrase, donc charger prévient

Un seul endroit décide : la carte ne charge jamais directement. Si l'état à
l'écran diffère du dernier enregistrement, le panneau propose « Enregistrer
d'abord », « Charger quand même » ou « Annuler ». La comparaison est faite sur
l'instantané, pas sur un drapeau : un avertissement permanent ne serait plus lu.

## La connexion : un mot de passe, pas un lien

Le lien magique a été la première façon d'entrer, et il coûtait **un courriel
par ouverture de session**. À deux, en une après-midi d'essais, on épuise le
quota d'envoi du projet et plus personne n'entre — y compris celui qui n'a rien
demandé. Le mot de passe n'envoie rien.

Les **mêmes champs** servent à entrer et à s'inscrire, et deux boutons les
distinguent : « Se connecter » et « Créer un compte ». Ce sont deux réponses à
la même question — qui es-tu ? —, et faire choisir avant d'avoir tapé quoi que
ce soit n'aide personne.

Un courriel part encore dans un seul cas, rare : **« Mot de passe oublié ? »**.
Le lien revient dans le fragment, comme le faisait le lien magique ; on le
reconnaît à son `type=recovery`, et l'on s'arrête alors sur le champ du nouveau
mot de passe **sans charger le compte** — faire entrer dans l'application
quelqu'un qui vient justement de dire qu'il ne sait plus entrer serait étrange.

GoTrue répond en anglais, et ses messages sont les seuls qu'on verra quand ça
coince : `traduire()` dans `net/supa.js` les rend en français. Un message
d'échec doit dire sa cause ET son remède — la règle du projet ne s'arrête pas à
la frontière du réseau.

## Sans compte, rien ne change

L'application marche exactement comme avant : le travail va dans `localStorage`,
sous la clé `saxon-mix-v1`. Le compte **ajoute** le partage, il ne le remplace
pas, et rien ne se perd si le réseau tombe.

## La base

Six tables dans le schéma `public` : `profile`, `team`, `membership`, `invite`,
`team_settings`, `variant`. Une seule idée les gouverne : **on ne voit une ligne
que si l'on est membre de son équipe**, et la règle est écrite dans la base, pas
dans le navigateur.

Les trois aides des politiques (`is_member`, `is_owner`, `shares_team`) vivent
dans un schéma `private` que l'API n'expose pas : posées dans `public`, PostgREST
les publiait en `/rest/v1/rpc/is_member` — n'importe qui pouvait demander à la
base si tel compte est membre de telle équipe.

Le profil naît d'un déclencheur à l'inscription, qui ramasse au passage les
invitations adressées à cette adresse : on invite avant que la personne existe.

**La clé du dépôt est publiable, et c'est voulu** : elle n'ouvre rien par
elle-même. La clé `service_role`, qui passe outre toutes les règles, ne doit
JAMAIS figurer dans le dépôt.

## Ce qu'il faut régler à la main, une fois

Deux réglages, dans le tableau de bord Supabase. Ce sont les seuls qui ne
peuvent pas vivre dans le dépôt.

**Authentication → URL Configuration**

- *Site URL* : l'adresse GitHub Pages du projet ;
- *Redirect URLs* : la même, plus `http://localhost:8000/**` pour travailler en
  local.

Sans cela le lien de réinitialisation revient sur l'adresse par défaut et le
mot de passe ne se change jamais.

**Authentication → Sign In / Providers → Email → Confirm email**

Laissé ENCLENCHÉ, « Créer un compte » n'ouvre pas de session : il faut d'abord
ouvrir un lien reçu par courriel — donc le quota d'envoi qu'on voulait
justement éviter. Le code gère les deux cas et le dit (« Compte créé. Ouvre le
lien… »), mais sur un projet à deux personnes qui se connaissent, l'éteindre
fait entrer tout de suite.

## Vérifier

Les règles de lecture, sans navigateur — un membre voit, un inconnu ne voit rien
et ne peut rien écrire :

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<un uuid qui n est membre de rien>","role":"authenticated"}';
select 'variantes' as t, count(*) from public.variant
union all select 'équipes', count(*) from public.team
union all select 'membres', count(*) from public.membership;
commit;
-- les trois doivent rendre 0
```

L'aller-retour de l'instantané, qui est ce que « Charger » promet :

```bash
node --input-type=module -e "
Promise.all([import('./src/mix/shuffle.js'),import('./src/mix/checks.js'),
             import('./src/mix/store.js')]).then(([S,C,St])=>{
  S.repartir({ alea:false, etages:true });
  var avant = JSON.stringify(C.mixVerdict(C.mixCheck()));
  var perdu = St.restore(St.snapshot());
  console.log('perdu :', JSON.stringify(perdu));
  console.log('verdict', avant, '→', JSON.stringify(C.mixVerdict(C.mixCheck())));
});"
```
