# La base

Les deux migrations qui suivent sont **déjà appliquées** au projet Supabase du
concours. Elles vivent ici pour la même raison que `tools/extract-site.py` :
c'est le script qui fait foi, pas l'état du serveur. On ne corrige pas la base à
la main — on écrit une migration et on la rejoue.

Le détail de ce qu'elles posent, et pourquoi, est dans `docs/variantes.md`.

```
20260922141507_variantes_partagees.sql   les six tables et les règles de lecture
20260922141841_helpers_hors_api.sql      les aides hors du schéma exposé
20260922152235_plusieurs_groupes.sql     rejoindre, quitter, renommer, les gardes
20260922152453_transfert_atomique.sql    transmettre la propriété en un appel
```

Pour les rejouer sur un projet neuf, avec la CLI Supabase :

```bash
supabase link --project-ref <ref>
supabase db push
```

Le linter de sécurité signale `public.transferer_propriete` comme SECURITY
DEFINER appelable : **c'est voulu**. Cette fonction EST une porte — elle
vérifie elle-même que celui qui frappe est bien le propriétaire du groupe, et
que celui à qui l'on transmet en est membre. Les trois AIDES des politiques,
elles, ne sont pas des portes : c'est pourquoi elles vivent dans `private`.

Trois réglages ne sont PAS dans ces fichiers, et ne peuvent pas l'être :

- **Authentication → URL Configuration** — l'adresse GitHub Pages du projet et
  `http://localhost:8000/**`, sans quoi le lien de réinitialisation revient
  ailleurs et le mot de passe ne se change jamais ;
- **Authentication → Email → Confirm email** — enclenché, « Créer un compte »
  n'ouvre pas de session tant qu'un lien n'a pas été ouvert ;
- **Authentication → Password security → Leaked password protection** — éteint
  par défaut ; il refuse les mots de passe connus des fuites publiques.
