-- Les étiquettes d'une variante. La première est « algo search » : ce que la
-- recherche a trouvé seule, et qu'on veut distinguer de ce qu'on a composé.
-- Un tableau plutôt qu'un booléen : la suivante ne demandera pas de migration.
alter table public.variant
  add column tags text[] not null default '{}';

create index variant_tags_idx on public.variant using gin (tags);
