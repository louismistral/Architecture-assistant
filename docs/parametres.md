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

## Le règlement, par thème

La famille Règlement se découpe en sept thèmes, dans l'ordre du règlement :
site et urbanisme, mobilité, programme, normes techniques, économie et
durabilité, rendu, procédure. Chaque thème montre d'abord les clés de
`rules.js` que les outils vérifient (distances, nappe, hauteurs, places…),
puis `RULES.cadre.<thème>` : ce qui ne se vérifie pas par le calcul, en toutes
lettres, avec son article. Une surface se lit dans `program.js` (`poste()`),
jamais recopiée.

Dans `RULES.cadre`, `q:1` marque une exigence qualitative — `RULES.qualitatif`,
que liste le volet Contraintes, en est tiré — et `verif:1` un point que le
règlement laisse incomplet ou contradictoire : il porte l'importance
« à vérifier » (critères de jugement 1.26, dates de la LcEne).

La Composition règle aussi la piscine et le local CAD (`MASS.second`) : au
générateur, posés en deux volumes ou en un, ou éteints — l'école doit
fonctionner avec et sans piscine.

## Ce qui reste à trancher

C'est une première version. Les volets « Contraintes » des outils restent en
place ; la question de savoir si cette page les remplace est ouverte.
