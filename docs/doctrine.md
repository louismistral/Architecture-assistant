# La doctrine de projet

**Source unique : `src/data/doctrine.js`.**

`rules.js` tient ce qui est OPPOSABLE. **`doctrine.js` tient tout le reste** — ce que nous
avons arbitré, préféré, supposé, parce qu'il fallait bien trancher pour produire un bâtiment.
Les deux générateurs n'ont pas d'autre source de réglage : *une valeur qui n'est ni dans
`rules.js` ni dans `doctrine.js` est un nombre écrit en dur, et c'est un défaut.*

> Pourquoi ce fichier existe : les deux tirages étaient gouvernés par une trentaine de nombres
> semés dans `shuffle.js` et `gen.js` — un sous-sol tiré à pile ou face, un bonus d'alignement
> de 26 contre un bonus d'orientation de 10. On obtenait des résultats sans pouvoir dire
> POURQUOI, donc sans pouvoir les corriger autrement qu'à tâtons.

## Cinq rangs de dureté

C'est la seule hiérarchie qui compte.

| rang | ce que ça veut dire |
|---|---|
| `dure` | écrite au règlement ou à l'AEAI. Le générateur ne rend jamais une composition qui l'enfreint |
| `ferme` | arbitrée par nous, faute de donnée opposable, mais APPLIQUÉE comme une règle |
| `forte` | préférence lourdement notée : le générateur y renonce seulement sans autre issue |
| `pref` | préférence : elle départage deux compositions également valables |
| `guide` | ne pèse sur aucun tirage ; elle oriente la lecture, le contrôle ou la recherche |

## Quatre tables

Les deux volets « Contraintes » des outils les affichent telles quelles.

- `DOC` — les valeurs vivantes.
- `REGLES` — une ligne par contrainte : sa source, le module qui l'applique, ce qu'elle change.
- `SCRIPTS` — l'inventaire des outils de génération : ce que chacun lit, décide, et sur quoi il
  agit.
- `TIRAGES` — ce que le hasard décide, en toutes lettres.

`REGLES[i].k` désigne la case de `DOC` : l'affichage et le comportement ne peuvent pas diverger,
et le volet écrit dans la case même que le générateur lit.

Une valeur réglée est persistée — mais **seuls les ÉCARTS au défaut**. Tout enregistrer figerait
dans le navigateur les valeurs du jour, et une correction apportée au fichier ne parviendrait
jamais à qui a déjà ouvert l'application.

## Ajouter une règle

Une entrée dans `DOC` (la valeur) plus une ligne dans `REGLES` (rang, source, module qui
l'applique, ce qu'elle change). Le volet suit tout seul.

## Les deux volets « Contraintes » des outils

Ils sont d'une autre nature que celui du cahier des charges : là on lit ce que le RÈGLEMENT
impose, ici on lit — et l'on RÈGLE — ce que NOUS avons arbitré pour qu'un générateur produise
quelque chose.

Le volet du massing porte en tête la **note de la composition à l'écran**, critère par critère
(`noterDetail()` / `noteCourante()`) : c'est la réponse à « pourquoi obtient-on ce résultat »,
et sans elle les poids se règlent à l'aveugle. Celui du mixer porte **les piles que le site
admet**.
