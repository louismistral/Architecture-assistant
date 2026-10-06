-- La mère d'une variante : celle dont l'état est parti — chargée, enregistrée,
-- ou rapportée de Rhino dans un .3dm qui la nomme. Les variantes se lisent
-- alors à la suite, comme un historique. Effacer la mère ne fait pas des
-- orphelines : leur lien tombe, elles restent.
alter table public.variant
  add column parent_id uuid references public.variant(id) on delete set null;

create index variant_parent_idx on public.variant (parent_id);
