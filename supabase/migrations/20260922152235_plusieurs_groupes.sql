-- ============================================================================
-- Appartenir à PLUSIEURS groupes, en rejoindre un, en sortir.
--
-- Trois trous se sont révélés en voulant le faire :
--   1. une invitation n'était consommée QU'À L'INSCRIPTION. Inviter quelqu'un
--      qui a déjà un compte ne faisait donc rien du tout, en silence ;
--   2. l'invité ne pouvait pas LIRE l'invitation qui lui était adressée — la
--      règle demandait d'être déjà membre pour la voir ;
--   3. un membre ne pouvait pas renommer son groupe, et le rôle d'un membre ne
--      pouvait être changé par personne.
-- ============================================================================

-- Mon adresse, telle que le jeton la porte. Une invitation vise une ADRESSE ;
-- c'est le seul lien entre elle et un compte qui n'existe pas encore.
create or replace function private.mon_email()
returns text language sql stable set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
grant execute on function private.mon_email() to authenticated;

create or replace function private.invite_pour_moi(t uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.invite i
                 where i.team_id = t and lower(i.email) = private.mon_email());
$$;
grant execute on function private.invite_pour_moi(uuid) to authenticated;

-- Renommer : n'importe quel membre. Transmettre la propriété : le propriétaire
-- seul. Les deux passent par le même UPDATE, donc c'est un déclencheur qui les
-- sépare — une politique ne sait pas dire « cette colonne-ci, pas celle-là ».
create or replace function private.garde_proprietaire()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is distinct from old.owner_id and old.owner_id <> auth.uid() then
    raise exception 'seul le propriétaire transmet la propriété du groupe';
  end if;
  return new;
end $$;

create trigger team_garde_proprietaire
  before update on public.team
  for each row execute function private.garde_proprietaire();

drop policy team_write on public.team;
create policy team_write on public.team for update to authenticated
  using (private.is_member(id)) with check (private.is_member(id));

-- Un propriétaire ne s'en va pas en laissant un groupe sans personne pour le
-- tenir : il transmet d'abord. La règle est ICI et pas seulement à l'écran —
-- un groupe orphelin ne se répare plus, personne ne pouvant plus inviter.
create or replace function private.garde_depart()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.team g where g.id = old.team_id and g.owner_id = old.profile_id)
     and exists (select 1 from public.membership m
                 where m.team_id = old.team_id and m.profile_id <> old.profile_id)
  then
    raise exception 'transmets la propriété du groupe avant de le quitter';
  end if;
  return old;
end $$;

create trigger membership_garde_depart
  before delete on public.membership
  for each row execute function private.garde_depart();

-- Le rôle d'un membre : le propriétaire seul le change (c'est ce qui suit un
-- transfert de propriété).
create policy membership_write on public.membership for update to authenticated
  using (private.is_owner(team_id)) with check (private.is_owner(team_id));

-- L'invitation : la voir quand elle m'est adressée, l'accepter, la refuser.
drop policy invite_read on public.invite;
create policy invite_read on public.invite for select to authenticated
  using (private.is_member(team_id) or lower(email) = private.mon_email());

drop policy invite_delete on public.invite;
create policy invite_delete on public.invite for delete to authenticated
  using (private.is_owner(team_id) or lower(email) = private.mon_email());

-- Rejoindre : s'inscrire soi-même sur une équipe qui nous a invité. Sans cela
-- « Rejoindre » n'existe pas — seul le propriétaire pouvait poser une ligne.
drop policy membership_insert on public.membership;
create policy membership_insert on public.membership for insert to authenticated
  with check (private.is_owner(team_id)
              or (profile_id = (select auth.uid()) and private.invite_pour_moi(team_id)));

comment on table public.invite is
  'Invitation à une ADRESSE. Consommée à l''inscription par handle_new_user(), ou acceptée depuis le profil par un compte qui existe déjà.';
