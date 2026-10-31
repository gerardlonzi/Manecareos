-- Lieu principal de la mission : type (maison de retraite, hôpital, domicile…) + nom de l'établissement.
alter table public.missions add column if not exists workplace_type text;
alter table public.missions add column if not exists workplace_name text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'missions_workplace_type_chk') then
    alter table public.missions add constraint missions_workplace_type_chk
      check (workplace_type is null or workplace_type in ('care_home', 'nursing_home', 'hospital', 'clinic', 'private_home', 'supported_living', 'hospice', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'missions_workplace_name_chk') then
    alter table public.missions add constraint missions_workplace_name_chk
      check (workplace_name is null or char_length(workplace_name) <= 120);
  end if;
end $$;

-- La vue doit être recréée pour exposer les nouvelles colonnes (m.* est figé à la création de la vue).
drop view if exists public.mission_overview;
create view public.mission_overview with (security_invoker = true) as
select
  m.*,
  coalesce(c.selected_count, 0)  as selected_count,
  coalesce(c.confirmed_count, 0) as confirmed_count,
  greatest(m.required_staff_count - coalesce(c.selected_count, 0), 0) as missing_count
from public.missions m
left join lateral (
  select
    count(*) filter (where ms.assignment_status in ('selected', 'contacted', 'confirmed', 'completed')) as selected_count,
    count(*) filter (where ms.assignment_status in ('confirmed', 'completed')) as confirmed_count
  from public.mission_staff ms
  where ms.mission_id = m.id
) c on true;
grant select on public.mission_overview to authenticated;
