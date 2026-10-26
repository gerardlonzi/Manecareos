-- Manecare — schéma initial
-- Toutes les tables privées appartiennent à un manager (owner_id = auth.uid()).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.location_status as enum ('pending', 'resolved', 'failed');
create type public.availability_status as enum ('available', 'unavailable', 'unknown');
create type public.transport_mode as enum ('driving', 'walking', 'cycling', 'public_transport');
create type public.mission_status as enum ('draft', 'open', 'staffing_in_progress', 'staffed', 'completed', 'cancelled');
create type public.assignment_status as enum ('selected', 'contacted', 'confirmed', 'declined', 'cancelled', 'completed');

-- ---------------------------------------------------------------------------
-- Utilitaire updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  company_name text,
  country_code char(2) not null default 'GB' check (country_code ~ '^[A-Z]{2}$'),
  timezone text not null default 'UTC',
  default_search_radius_km integer not null default 10 check (default_search_radius_km between 1 and 200),
  default_transport_mode public.transport_mode not null default 'driving',
  default_availability_filter text not null default 'available' check (default_availability_filter in ('available', 'all')),
  distance_unit text not null default 'km' check (distance_unit in ('km', 'mi')),
  allow_fallback_estimates boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Création automatique du profil à l'inscription. L'id vient d'auth.users, jamais du client.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cc text := upper(coalesce(new.raw_user_meta_data->>'country_code', 'GB'));
begin
  if cc !~ '^[A-Z]{2}$' then cc := 'GB'; end if;
  insert into public.profiles (id, full_name, company_name, country_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'company_name', ''),
    cc
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  staff_code text,
  full_name text not null check (char_length(trim(full_name)) between 1 and 200),
  phone text check (phone is null or char_length(phone) <= 32),
  email text check (email is null or char_length(email) <= 254),
  country_code char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  postal_code text check (postal_code is null or char_length(postal_code) <= 16),
  postal_code_normalized text,
  city text,
  region text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  location_status public.location_status not null default 'pending',
  location_updated_at timestamptz,
  availability_status public.availability_status not null default 'unknown',
  skills text[] not null default '{}',
  notes text check (notes is null or char_length(notes) <= 4000),
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  -- Un enregistrement « resolved » doit avoir des coordonnées complètes.
  constraint staff_resolved_has_coords check (
    location_status <> 'resolved' or (latitude is not null and longitude is not null)
  )
);

create unique index staff_owner_code_uniq on public.staff (owner_id, staff_code) where staff_code is not null;
create index staff_owner_idx on public.staff (owner_id);
create index staff_owner_availability_idx on public.staff (owner_id, availability_status) where archived_at is null;
create index staff_owner_postal_idx on public.staff (owner_id, country_code, postal_code_normalized);
create index staff_owner_city_idx on public.staff (owner_id, country_code, lower(city));
create index staff_owner_location_status_idx on public.staff (owner_id, location_status);
create index staff_coords_idx on public.staff (owner_id, latitude, longitude) where latitude is not null and archived_at is null;
create index staff_skills_idx on public.staff using gin (skills);

create trigger staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- missions
-- ---------------------------------------------------------------------------
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  mission_reference text,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 4000),
  country_code char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  postal_code text check (postal_code is null or char_length(postal_code) <= 16),
  postal_code_normalized text,
  city text,
  region text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  location_status public.location_status not null default 'pending',
  location_updated_at timestamptz,
  required_skills text[] not null default '{}',
  required_staff_count integer not null default 1 check (required_staff_count > 0 and required_staff_count <= 1000),
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  transport_mode public.transport_mode not null default 'driving',
  status public.mission_status not null default 'draft',
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint missions_resolved_has_coords check (
    location_status <> 'resolved' or (latitude is not null and longitude is not null)
  ),
  constraint missions_end_after_start check (
    scheduled_end_at is null or scheduled_start_at is null or scheduled_end_at >= scheduled_start_at
  )
);

create unique index missions_owner_reference_uniq on public.missions (owner_id, mission_reference) where mission_reference is not null;
create index missions_owner_idx on public.missions (owner_id);
create index missions_owner_status_start_idx on public.missions (owner_id, status, scheduled_start_at);
create index missions_owner_postal_idx on public.missions (owner_id, country_code, postal_code_normalized);
create index missions_coords_idx on public.missions (owner_id, latitude, longitude) where latitude is not null;

create trigger missions_updated_at before update on public.missions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- mission_staff
-- ---------------------------------------------------------------------------
create table public.mission_staff (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  assignment_status public.assignment_status not null default 'selected',
  selected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text check (notes is null or char_length(notes) <= 2000)
);

-- Une seule affectation « active » par couple mission/staff.
create unique index mission_staff_active_uniq on public.mission_staff (mission_id, staff_id)
  where assignment_status in ('selected', 'contacted', 'confirmed', 'completed');
create index mission_staff_owner_idx on public.mission_staff (owner_id);
create index mission_staff_mission_idx on public.mission_staff (mission_id, assignment_status);
create index mission_staff_staff_idx on public.mission_staff (staff_id);

create trigger mission_staff_updated_at before update on public.mission_staff
  for each row execute function public.set_updated_at();

-- Garde-fou : l'affectation doit relier une mission et un staff du MÊME manager.
create or replace function public.mission_staff_check_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.missions m where m.id = new.mission_id and m.owner_id = new.owner_id) then
    raise exception 'mission_staff: mission introuvable pour ce propriétaire' using errcode = '42501';
  end if;
  if not exists (select 1 from public.staff s where s.id = new.staff_id and s.owner_id = new.owner_id) then
    raise exception 'mission_staff: staff introuvable pour ce propriétaire' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger mission_staff_owner_check before insert or update of mission_id, staff_id, owner_id on public.mission_staff
  for each row execute function public.mission_staff_check_owner();

-- ---------------------------------------------------------------------------
-- activity_logs (append-only pour les utilisateurs)
-- ---------------------------------------------------------------------------
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  mission_id uuid references public.missions(id) on delete set null,
  event_type text not null check (char_length(event_type) <= 64),
  description text not null check (char_length(description) <= 500),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_owner_created_idx on public.activity_logs (owner_id, created_at desc);
create index activity_owner_type_idx on public.activity_logs (owner_id, event_type, created_at desc);
create index activity_staff_idx on public.activity_logs (staff_id) where staff_id is not null;
create index activity_mission_idx on public.activity_logs (mission_id) where mission_id is not null;

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (char_length(type) <= 64),
  title text not null check (char_length(title) <= 200),
  message text not null check (char_length(message) <= 1000),
  link text check (link is null or (link like '/%' and link not like '//%')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_owner_idx on public.notifications (owner_id, created_at desc);
create index notifications_unread_idx on public.notifications (owner_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- route_estimates (cache privé, expirable)
-- ---------------------------------------------------------------------------
create table public.route_estimates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  cache_key text not null,
  origin_latitude double precision not null check (origin_latitude between -90 and 90),
  origin_longitude double precision not null check (origin_longitude between -180 and 180),
  destination_latitude double precision not null check (destination_latitude between -90 and 90),
  destination_longitude double precision not null check (destination_longitude between -180 and 180),
  transport_mode public.transport_mode not null,
  provider text not null,
  distance_meters double precision not null check (distance_meters >= 0),
  duration_seconds double precision not null check (duration_seconds >= 0),
  estimated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint route_estimates_owner_key_uniq unique (owner_id, cache_key)
);

create index route_estimates_expiry_idx on public.route_estimates (expires_at);
create index route_estimates_lookup_idx on public.route_estimates (owner_id, cache_key, expires_at);
