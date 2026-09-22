# Les variantes partagées

Enregistrer l'état du projet sous un nom, et le recharger à l'identique — seul
ou à plusieurs.

```
src/data/supabase.js   l'adresse de la base et sa clé publiable   ← source unique
src/net/supa.js        le client : jeton, session, REST           (aucune dépendance)
src/net/compte.js      l'identité, l'équipe, ses membres
src/net/reglages.js    les décisions de projet partagées
src/net/variantes.js   poser, lister, charger, supprimer
src/core/empreinte.js  l'empreinte des fichiers du dépôt
src/views/variantes.js le panneau et le modal
styles/variantes.css   leur dessin
```

## Ce n'est pas un onglet

Les onglets sont la CHRONOLOGIE du concours, et une variante ne s'y range nulle
part : elle les traverse tous les trois. Le bouton vit donc **à côté du compte**,
hors du groupe de destinations, et ouvre un panneau qui se pose **par-dessus**
ce qu'on faisait. Il ne repousse rien : le plan et la 3D garderaient sinon un
cadrage différent selon qu'il est ouvert, et l'on comparerait deux implantations
à deux échelles.

## Deux niveaux, et c'est tout le dessin

- La **carte** porte ce qu'il faut pour RECONNAÎTRE une variante et la CHARGER :
  miniature, nom, auteur, note, deux boutons. Rien d'autre.
- Le **modal** porte tout le reste — la note critère par critère, les graines,
  les surfaces, les contrôles — et le seul geste qui détruit, « Supprimer », qui
  n'a rien à faire sur une carte de liste.

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

## Ce qui se partage, et ce qui ne se partage pas

| partagé au groupe | reste à chacun |
|---|---|
| les variantes | la composition à l'écran |
| les 8 surfaces à préciser | les écarts assumés |
| la part de circulation | les trois interrupteurs du mixer |
| la doctrine réglée | |

Les trois réglages partagés sont des **décisions de projet** : si l'un travaille
à 0,18 de circulation et l'autre à 0,20, leurs deux variantes ne se comparent
plus. La composition, elle, est un **geste de travail** — travailler n'est pas
publier, et un Shuffle de l'un ne doit pas changer l'écran de l'autre en pleine
phrase.

Les réglages se lisent à l'ouverture (le distant gagne : c'est la décision du
groupe) et s'écrivent au fil de l'eau. Le dernier qui écrit gagne, et le panneau
dit QUI. À deux, sur un concours, se voler un réglage se règle en se parlant, pas
en verrouillant une table.

**Charger une variante change donc aussi les réglages du groupe** — c'est
nécessaire : sans cela la variante ne se reproduirait pas.

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
