-- Manecare — fonctions géographiques et agrégats
-- Toutes en SECURITY INVOKER : la RLS s'applique, un manager ne voit que ses lignes.

-- Distance orthodromique (Haversine) en mètres.
create or replace function public.haversine_m(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision language sql immutable parallel safe as $$
  select 2 * 6371008.8 * asin(least(1.0, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  )))
$$;

-- Staff autour d'un point : boîte englobante (index) puis Haversine exact.
-- Exclut archivés, coordonnées absentes et localisations non résolues.
-- 'unknown' n'est JAMAIS traité comme disponible.
create or replace function public.staff_within_radius(
  p_lat double precision,
  p_lon double precision,
  p_radius_m double precision,
  p_availability text default 'available',   -- 'available' | 'all'
  p_skills text[] default '{}',
  p_limit integer default 200
)
returns table (
  id uuid, full_name text, staff_code text, phone text, email text,
  country_code char(2), postal_code text, city text, region text,
  latitude double precision, longitude double precision,
  location_status public.location_status, location_updated_at timestamptz,
  availability_status public.availability_status, skills text[],
  straight_line_m double precision
)
language sql stable security invoker set search_path = public as $$
  with box as (
    select
      p_lat - degrees(p_radius_m / 6371008.8) as min_lat,
      p_lat + degrees(p_radius_m / 6371008.8) as max_lat,
      p_lon - degrees(p_radius_m / 6371008.8 / greatest(cos(radians(p_lat)), 0.0001)) as min_lon,
      p_lon + degrees(p_radius_m / 6371008.8 / greatest(cos(radians(p_lat)), 0.0001)) as max_lon
  )
  select s.id, s.full_name, s.staff_code, s.phone, s.email,
         s.country_code, s.postal_code, s.city, s.region,
         s.latitude, s.longitude, s.location_status, s.location_updated_at,
         s.availability_status, s.skills,
         public.haversine_m(p_lat, p_lon, s.latitude, s.longitude) as straight_line_m
  from public.staff s, box
  where s.owner_id = auth.uid()
    and s.archived_at is null
    and s.location_status = 'resolved'
    and s.latitude is not null and s.longitude is not null
    and s.latitude between box.min_lat and box.max_lat
    and s.longitude between box.min_lon and box.max_lon
    and (p_availability = 'all' or s.availability_status = 'available')
    and (coalesce(array_length(p_skills, 1), 0) = 0 or s.skills @> p_skills)
    and public.haversine_m(p_lat, p_lon, s.latitude, s.longitude) <= p_radius_m
  order by straight_line_m asc
  limit least(greatest(p_limit, 1), 1000)
$$;

-- Agrégats du tableau de bord en un seul aller-retour.
create or replace function public.dashboard_stats()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'total_staff',           (select count(*) from staff where owner_id = auth.uid() and archived_at is null),
    'available_staff',       (select count(*) from staff where owner_id = auth.uid() and archived_at is null and availability_status = 'available'),
    'unavailable_staff',     (select count(*) from staff where owner_id = auth.uid() and archived_at is null and availability_status = 'unavailable'),
    'verified_locations',    (select count(*) from staff where owner_id = auth.uid() and archived_at is null and location_status = 'resolved'),
    'unresolved_locations',  (select count(*) from staff where owner_id = auth.uid() and archived_at is null and location_status <> 'resolved'),
    'active_missions',       (select count(*) from missions where owner_id = auth.uid() and archived_at is null and status in ('open', 'staffing_in_progress', 'staffed')),
    'missions_needing_staff',(select count(*) from missions where owner_id = auth.uid() and archived_at is null and status in ('open', 'staffing_in_progress'))
  )
$$;

-- Compteurs d'affectations par mission (non annulées / non refusées).
create or replace view public.mission_overview with (security_invoker = true) as
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
grant execute on function public.staff_within_radius(double precision, double precision, double precision, text, text[], integer) to authenticated;
grant execute on function public.dashboard_stats() to authenticated;
grant execute on function public.haversine_m(double precision, double precision, double precision, double precision) to authenticated;

-- Purge des estimations expirées (à appeler depuis un cron Supabase si souhaité).
create or replace function public.purge_expired_route_estimates()
returns integer language sql security invoker set search_path = public as $$
  with d as (delete from public.route_estimates where owner_id = auth.uid() and expires_at < now() returning 1)
  select count(*)::int from d
$$;
grant execute on function public.purge_expired_route_estimates() to authenticated;
