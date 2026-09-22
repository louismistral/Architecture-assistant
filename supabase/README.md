# La base

Les deux migrations qui suivent sont **déjà appliquées** au projet Supabase du
concours. Elles vivent ici pour la même raison que `tools/extract-site.py` :
c'est le script qui fait foi, pas l'état du serveur. On ne corrige pas la base à
la main — on écrit une migration et on la rejoue.

Le détail de ce qu'elles posent, et pourquoi, est dans `docs/variantes.md`.

```
20260922141507_variantes_partagees.sql   les six tables et les règles de lecture
20260922141841_helpers_hors_api.sql      les aides hors du schéma exposé
```

Pour les rejouer sur un projet neuf, avec la CLI Supabase :

```bash
supabase link --project-ref <ref>
supabase db push
```

Un réglage n'est PAS dans ces fichiers, et ne peut pas l'être :
**Authentication → URL Configuration**, où il faut déclarer l'adresse GitHub
Pages du projet et `http://localhost:8000/**`. Sans cela le lien de connexion
revient ailleurs et la session ne s'ouvre jamais.
