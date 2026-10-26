-- Manecare — photos du personnel, recherche rapide (trigrammes) et fonction de recherche par rayon enrichie.
-- Idempotente : peut être rejouée sans erreur.

-- 1. Photo optionnelle par membre du personnel (chemin dans le bucket privé « staff-photos »).
alter table public.staff add column if not exists photo_path text;

-- 1b. Heures de travail par semaine (optionnel, 0–168).
alter table public.staff add column if not exists weekly_hours numeric(5,1);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'staff_weekly_hours_range') then
    alter table public.staff add constraint staff_weekly_hours_range check (weekly_hours is null or (weekly_hours >= 0 and weekly_hours <= 168));
  end if;
end $$;

-- 2. Bucket privé « staff-photos » : 2 Mo max, JPEG / PNG / WebP uniquement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-photos', 'staff-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- 3. RLS sur storage.objects : un utilisateur n'accède qu'aux objets dont le premier segment du chemin est son uid.
drop policy if exists "staff_photos_select_own" on storage.objects;
create policy "staff_photos_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'staff-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "staff_photos_insert_own" on storage.objects;
create policy "staff_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'staff-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "staff_photos_update_own" on storage.objects;
create policy "staff_photos_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'staff-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'staff-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "staff_photos_delete_own" on storage.objects;
create policy "staff_photos_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'staff-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4. Recherche en direct (ilike '%…%') : index trigrammes.
--    pg_trgm peut déjà exister dans « public » ou « extensions » (Supabase) : on résout les deux.
create extension if not exists pg_trgm with schema extensions;
set search_path = public, extensions;

create index if not exists staff_full_name_trgm_idx   on public.staff using gin (full_name   gin_trgm_ops);
create index if not exists staff_city_trgm_idx        on public.staff using gin (city        gin_trgm_ops);
create index if not exists staff_staff_code_trgm_idx  on public.staff using gin (staff_code  gin_trgm_ops);
create index if not exists staff_postal_code_trgm_idx on public.staff using gin (postal_code gin_trgm_ops);

reset search_path;

-- 5. staff_within_radius : même signature et même comportement, avec photo_path en plus.
--    Le type de retour change : il faut supprimer la fonction avant de la recréer.
drop function if exists public.staff_within_radius(double precision, double precision, double precision, text, text[], integer);

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
  straight_line_m double precision,
  photo_path text,
  weekly_hours numeric
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
         public.haversine_m(p_lat, p_lon, s.latitude, s.longitude) as straight_line_m,
         s.photo_path,
         s.weekly_hours
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

grant execute on function public.staff_within_radius(double precision, double precision, double precision, text, text[], integer) to authenticated;
