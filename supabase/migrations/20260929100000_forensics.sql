-- FORENSICS — le moodboard du groupe : des images, des notes, des liens, et
-- des flèches qui les relient, posés sur une toile.
--
-- Une ligne par élément de la planche. Une seule planche par groupe : le
-- groupe est le périmètre de partage, comme pour les variantes, et la règle
-- est la même — on ne voit une ligne que si l'on est membre de son équipe.
--
-- Les images ne vivent pas dans la table : elles vont dans le bucket privé
-- `forensics`, sous un dossier par équipe (`<team_id>/<uuid>.<ext>`). La
-- ligne n'en garde que le chemin ; le navigateur demande une URL signée pour
-- l'afficher. Le premier segment du chemin EST l'équipe : c'est lui que les
-- règles du stockage lisent.

create table public.board_item (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.team(id) on delete cascade,
  author_id   uuid references public.profile(id) on delete set null default auth.uid(),
  kind        text not null check (kind in ('image','note','link','arrow')),
  -- la géométrie, en unités de la toile
  x           double precision not null default 0,
  y           double precision not null default 0,
  w           double precision not null default 240,
  h           double precision not null default 160,
  z           integer not null default 0,
  -- le contenu : le texte d'une note, l'adresse et le titre d'un lien, le
  -- chemin d'une image dans le bucket, sa légende
  body        text,
  url         text,
  title       text,
  path        text,
  -- une flèche relie deux éléments ; elle disparaît avec l'un ou l'autre
  src         uuid references public.board_item(id) on delete cascade,
  dst         uuid references public.board_item(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint board_arrow_ends check (kind <> 'arrow' or (src is not null and dst is not null))
);

create index board_item_team_idx on public.board_item (team_id);
create index board_item_src_idx  on public.board_item (src);
create index board_item_dst_idx  on public.board_item (dst);

create trigger board_touch before update on public.board_item
  for each row execute function public.touch_updated_at();

alter table public.board_item enable row level security;

create policy board_read   on public.board_item for select to authenticated
  using (private.is_member(team_id));
create policy board_insert on public.board_item for insert to authenticated
  with check (private.is_member(team_id) and author_id = (select auth.uid()));
create policy board_write  on public.board_item for update to authenticated
  using (private.is_member(team_id)) with check (private.is_member(team_id));
create policy board_delete on public.board_item for delete to authenticated
  using (private.is_member(team_id));

-- Le stockage des images : privé, 10 Mo par fichier, des images seulement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forensics', 'forensics', false, 10485760,
        array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','image/avif'])
on conflict (id) do nothing;

-- Le premier dossier du chemin est l'équipe. Un chemin qui n'en est pas une
-- (texte quelconque) ne passe pas le transtypage et la règle refuse.
create or replace function private.board_team(name text)
returns uuid language sql immutable set search_path = '' as $$
  select case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
              then ((storage.foldername(name))[1])::uuid end
$$;
grant execute on function private.board_team(text) to authenticated;

create policy forensics_read   on storage.objects for select to authenticated
  using (bucket_id = 'forensics' and private.is_member(private.board_team(name)));
create policy forensics_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'forensics' and private.is_member(private.board_team(name)));
create policy forensics_update on storage.objects for update to authenticated
  using (bucket_id = 'forensics' and private.is_member(private.board_team(name)));
create policy forensics_delete on storage.objects for delete to authenticated
  using (bucket_id = 'forensics' and private.is_member(private.board_team(name)));
