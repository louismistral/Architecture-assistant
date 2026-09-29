-- Les préférences du compte : thème, mode, tri et filtre des variantes, barre
-- « Atelier et outils » ouverte ou non. Ce ne sont PAS des décisions de projet
-- (celles-là vivent dans team_settings) : elles suivent la personne d'un
-- appareil à l'autre, et ne changent rien à ce qu'un autre membre voit.
--
-- Une colonne sur `profile` plutôt qu'une table : la règle d'écriture existe
-- déjà (chacun ne modifie que sa ligne, `profile_write`). Les membres d'un même
-- groupe peuvent la LIRE, comme le nom et l'adresse — un thème et un tri ne
-- disent rien de plus.
alter table public.profile
  add column if not exists prefs jsonb not null default '{}'::jsonb;
