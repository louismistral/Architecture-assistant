-- Les aides des règles de lecture n'ont rien à faire dans l'API : posées dans
-- `public`, PostgREST les publiait en /rest/v1/rpc/is_member — n'importe qui
-- pouvait demander à la base si tel compte est membre de telle équipe. Elles
-- passent dans un schéma que l'API n'expose pas ; les politiques continuent de
-- les appeler, par leur OID.
create schema if not exists private;

alter function public.is_member(uuid)    set schema private;
alter function public.is_owner(uuid)     set schema private;
alter function public.shares_team(uuid)  set schema private;

grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid)   to authenticated;
grant execute on function private.is_owner(uuid)    to authenticated;
grant execute on function private.shares_team(uuid) to authenticated;

revoke all on schema private from anon, public;

-- `handle_new_user` est une fonction de DÉCLENCHEUR : elle ne s'appelle pas,
-- elle se déclenche. Exposée, elle laissait provoquer à la main ce qui doit
-- n'arriver qu'à l'inscription.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;

-- Celle-ci vient du gabarit de projet, pas de nous ; elle n'a pas plus de
-- raison d'être appelable depuis le navigateur.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from anon, authenticated, public';
  end if;
end $$;
