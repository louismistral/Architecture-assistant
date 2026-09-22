-- ============================================================================
-- Les variantes partagées du concours de Saxon.
--
-- Six tables, et une seule idée : on ne voit une ligne que si l'on est membre
-- de son équipe. La règle est écrite ICI, jamais dans le navigateur.
--
-- Ce qui N'EST PAS ici : le programme, le règlement, les adjacences, le relevé
-- et les valeurs PAR DÉFAUT de la doctrine. Ce sont des fichiers du dépôt. Les
-- mettre en base ferait deux sources pour une décision, et une correction
-- poussée sur GitHub n'arriverait jamais à qui a déjà la base.
-- ============================================================================

create table public.profile (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  email      text,
  created_at timestamptz not null default now()
);

create table public.team (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references public.profile(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.membership (
  team_id    uuid not null references public.team(id) on delete cascade,
  profile_id uuid not null references public.profile(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner','member')),
  joined_at  timestamptz not null default now(),
  primary key (team_id, profile_id)
);
create index membership_profile_idx on public.membership(profile_id);

-- Une invitation vit avant le compte : on invite une ADRESSE, pas un profil.
create table public.invite (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.team(id) on delete cascade,
  email      text not null,
  invited_by uuid references public.profile(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (team_id, email)
);
create index invite_email_idx on public.invite(lower(email));

-- Les décisions de projet : elles ne peuvent pas différer entre deux membres
-- sans que l'outil mente. Une ligne par équipe.
create table public.team_settings (
  team_id     uuid primary key references public.team(id) on delete cascade,
  areas       jsonb not null default '{}'::jsonb,
  circulation real,
  doctrine    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profile(id) on delete set null
);

-- Une variante est un preset : l'état complet, plus de quoi le reconnaître
-- sans l'ouvrir et le trier sans le lire.
create table public.variant (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.team(id) on delete cascade,
  author_id     uuid references public.profile(id) on delete set null,
  name          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- ce qui rejoue
  seed_program  bigint,
  seed_massing  bigint,
  parti         text,
  state         jsonb not null,
  -- l'empreinte des fichiers du dépôt au moment de l'enregistrement :
  -- si elle ne correspond plus, la variante est périmée
  fingerprint   text,
  -- ce qui se trie, sans ouvrir le jsonb
  score         int,
  floors        smallint,
  bodies        smallint,
  area_required int,
  area_placed   int,
  area_gross    int,
  -- ce qui s'affiche
  verdict       jsonb,
  criteria      jsonb,
  thumbnail     jsonb
);
create index variant_team_idx on public.variant(team_id, score desc);

-- ---------------------------------------------------------------------------
-- Les aides. SECURITY DEFINER parce qu'une politique de `membership` qui
-- interroge `membership` boucle à l'infini.
-- ---------------------------------------------------------------------------
create or replace function public.is_member(t uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.membership m
                 where m.team_id = t and m.profile_id = auth.uid());
$$;

create or replace function public.is_owner(t uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.team g
                 where g.id = t and g.owner_id = auth.uid());
$$;

create or replace function public.shares_team(p uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.membership a
                 join public.membership b on a.team_id = b.team_id
                 where a.profile_id = auth.uid() and b.profile_id = p);
$$;

-- Le profil naît avec le compte, et ramasse au passage les invitations
-- adressées à cette adresse : on invite avant que la personne existe.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile (id, email, name)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data->>'name',''),
                   split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.membership (team_id, profile_id, role)
  select i.team_id, new.id, 'member' from public.invite i
  where lower(i.email) = lower(new.email)
  on conflict do nothing;

  delete from public.invite where lower(email) = lower(new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

create trigger variant_touch before update on public.variant
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.team_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Les règles de lecture.
-- ---------------------------------------------------------------------------
alter table public.profile       enable row level security;
alter table public.team          enable row level security;
alter table public.membership    enable row level security;
alter table public.invite        enable row level security;
alter table public.team_settings enable row level security;
alter table public.variant       enable row level security;

-- profil : le sien, et ceux avec qui on partage une équipe
create policy profile_read   on public.profile for select to authenticated
  using (id = (select auth.uid()) or public.shares_team(id));
create policy profile_write  on public.profile for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profile_insert on public.profile for insert to authenticated
  with check (id = (select auth.uid()));

-- équipe : celles dont on est membre ; on crée la sienne, le propriétaire seul
-- la renomme et la supprime
create policy team_read   on public.team for select to authenticated
  using (public.is_member(id) or owner_id = (select auth.uid()));
create policy team_insert on public.team for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy team_write  on public.team for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));
create policy team_delete on public.team for delete to authenticated
  using (public.is_owner(id));

-- appartenance : visible des membres ; posée par le propriétaire (c'est aussi
-- ce qui l'inscrit lui-même sur l'équipe qu'il vient de créer) ; on peut
-- toujours quitter une équipe
create policy membership_read   on public.membership for select to authenticated
  using (public.is_member(team_id) or profile_id = (select auth.uid()));
create policy membership_insert on public.membership for insert to authenticated
  with check (public.is_owner(team_id));
create policy membership_delete on public.membership for delete to authenticated
  using (public.is_owner(team_id) or profile_id = (select auth.uid()));

-- invitation : le propriétaire seul invite et retire
create policy invite_read   on public.invite for select to authenticated
  using (public.is_member(team_id));
create policy invite_insert on public.invite for insert to authenticated
  with check (public.is_owner(team_id));
create policy invite_delete on public.invite for delete to authenticated
  using (public.is_owner(team_id));

-- réglages : tout membre lit et écrit — ce sont des décisions communes
create policy settings_read   on public.team_settings for select to authenticated
  using (public.is_member(team_id));
create policy settings_insert on public.team_settings for insert to authenticated
  with check (public.is_member(team_id));
create policy settings_write  on public.team_settings for update to authenticated
  using (public.is_member(team_id)) with check (public.is_member(team_id));

-- variantes : tout membre lit, pose, renomme et supprime. On travaille à deux
-- sur un concours ; la confiance est acquise et l'historique est dans git.
create policy variant_read   on public.variant for select to authenticated
  using (public.is_member(team_id));
create policy variant_insert on public.variant for insert to authenticated
  with check (public.is_member(team_id) and author_id = (select auth.uid()));
create policy variant_write  on public.variant for update to authenticated
  using (public.is_member(team_id)) with check (public.is_member(team_id));
create policy variant_delete on public.variant for delete to authenticated
  using (public.is_member(team_id));
