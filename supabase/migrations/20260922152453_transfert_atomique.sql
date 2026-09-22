-- Transmettre la propriété touche TROIS lignes : l'équipe, le rôle de celui qui
-- reçoit, le rôle de celui qui donne. En trois appels depuis le navigateur,
-- l'ordre décide de tout — et le seul ordre qui marche est contre-intuitif :
-- dès que `team.owner_id` a changé, l'ancien propriétaire n'a plus le droit de
-- toucher aux rôles, et sa mise à jour ne touche AUCUNE ligne sans rien dire
-- (une politique UPDATE filtre, elle ne crie pas). On se retrouvait avec une
-- équipe dont le propriétaire n'a pas le rôle « propriétaire ».
--
-- Un seul appel, donc, qui porte son propre contrôle d'autorisation. C'est
-- pourquoi il est SECURITY DEFINER dans un schéma exposé, et pourquoi le
-- linter s'en plaint : ici c'est voulu, la fonction EST une porte, et elle
-- vérifie elle-même qui frappe.
create or replace function public.transferer_propriete(equipe uuid, vers uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.team g where g.id = equipe and g.owner_id = auth.uid()) then
    raise exception 'seul le propriétaire transmet la propriété du groupe';
  end if;
  if not exists (select 1 from public.membership m where m.team_id = equipe and m.profile_id = vers) then
    raise exception 'on ne transmet qu''à un membre du groupe';
  end if;
  if vers = auth.uid() then return; end if;

  update public.membership set role = 'member' where team_id = equipe and profile_id = auth.uid();
  update public.membership set role = 'owner'  where team_id = equipe and profile_id = vers;
  update public.team        set owner_id = vers where id = equipe;
end $$;

revoke execute on function public.transferer_propriete(uuid, uuid) from anon, public;
grant  execute on function public.transferer_propriete(uuid, uuid) to authenticated;
