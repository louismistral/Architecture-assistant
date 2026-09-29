# Paramètres & contraintes — le cadre du projet

L'onglet qui n'a pas de numéro, parce qu'il n'est pas une étape : il porte une
icône, en tête de la barre « Atelier et outils ». Il montre **tout ce qui influe
sur une variante**, en lignes, et dit chaque ligne de la même façon :

| critère | valeur | importance |
|---|---|---|

```
src/views/parametres.js   la page
styles/parametres.css     son dessin
```

## Aucune copie

Chaque ligne lit et écrit la case même que les générateurs lisent : rien n'est
recopié ici, rien ne peut diverger. Le détail d'une règle — pourquoi, où elle
s'applique, ce qu'elle change — reste dans le volet « Contraintes » de l'onglet
qui s'en sert (`docs/doctrine.md`).

## Cinq familles, de la plus opposable à la plus personnelle

| famille | d'où | se règle ? | importance |
|---|---|---|---|
| Règlement | `rules.js`, `program.js` | non — se change dans le code, et périme les variantes | « règlement » ou « hypothèse » |
| Doctrine — répartition, volumétrie | `doctrine.js` (`REGLES`, `DOC`) | oui ; un critère NOTÉ se coche ou non | le rang : dure, ferme, forte, préf., guide — ou obligatoire, à favoriser, départage, recherche |
| Projet | `core/model.js` — couloir, huit surfaces à préciser | oui, partagé au groupe | « groupe » |
| Composition | `mass/model.js`, `core/rand.js`, `mix/opts.js` | le parti ; le reste se lit | « composition » |
| Préférences | `net/prefs.js` | oui, suit la personne | « préférence » |

L'importance **se lit** : on ne change pas le rang d'une règle depuis cette
page. Le seul geste sur l'importance est de compter ou non un critère de la
note du massing — comme dans le volet Contraintes. Changer un rang demanderait
que les générateurs le lisent dans l'état plutôt que dans le code : c'est une
autre décision.

Un champ en tête filtre les lignes, sur le critère, la valeur, la source et
l'importance (« hauteur », « cour », « dure »).

## Ce qui reste à trancher

C'est une première version. Les volets « Contraintes » des outils restent en
place ; la question de savoir si cette page les remplace est ouverte.
