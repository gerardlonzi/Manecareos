-- Manecare — conformité des documents, heures/paie, double authentification, journal d'accès, purge.
-- Idempotente : peut être rejouée sans erreur. À exécuter APRÈS les 4 migrations précédentes.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Types de documents (configurables par manager)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]{1,40}$'),
  name_fr text not null check (char_length(trim(name_fr)) between 1 and 80),
  name_en text not null check (char_length(trim(name_en)) between 1 and 80),
  mandatory boolean not null default true,
  can_expire boolean not null default true,          -- false : pas de date d'expiration à suivre
  alert_days integer[] not null default '{60,30,14,7,0}',
  sort_order integer not null default 100,
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, key)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Documents du staff : la date est obligatoire (ou « sans expiration »), le fichier est facultatif.
--    Le fichier, s'il existe, est sur Cloudinary en mode « authenticated » (privé) ; ici on ne garde que sa référence.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.staff_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  type_id uuid not null references public.document_types(id) on delete restrict,
  issued_at date,
  expires_at date,
  no_expiry boolean not null default false,
  note text check (note is null or char_length(note) <= 200),   -- ne PAS y mettre de numéro de document
  file_public_id text check (file_public_id is null or char_length(file_public_id) <= 300),
  file_resource_type text check (file_resource_type is null or file_resource_type in ('image', 'raw', 'video')),
  file_format text check (file_format is null or char_length(file_format) <= 10),
  file_name text check (file_name is null or char_length(file_name) <= 200),
  file_bytes integer check (file_bytes is null or file_bytes >= 0),
  file_uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, type_id),
  constraint staff_documents_date_or_no_expiry check ((no_expiry and expires_at is null) or (not no_expiry and expires_at is not null))
);
create index if not exists staff_documents_owner_expires_idx on public.staff_documents (owner_id, expires_at);
create index if not exists staff_documents_staff_idx on public.staff_documents (staff_id);

-- Alertes déjà envoyées (évite les doublons quotidiens).
create table if not exists public.document_alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.staff_documents(id) on delete cascade,
  expires_on date not null,
  threshold_days integer not null,
  kind text not null check (kind in ('notification', 'email')),
  sent_at timestamptz not null default now(),
  unique (document_id, expires_on, threshold_days, kind)
);

-- Journal d'accès aux documents (conservé 12 mois, distinct du journal d'activité purgé à 3 semaines).
create table if not exists public.document_access_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  document_id uuid references public.staff_documents(id) on delete set null,
  action text not null check (action in ('view', 'upload', 'replace', 'delete', 'email_sent')),
  created_at timestamptz not null default now()
);
create index if not exists document_access_log_owner_idx on public.document_access_log (owner_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Missions : heures prévues, paie ; affectations : horaires, heures travaillées, complétée
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.missions add column if not exists planned_hours numeric(6,2);
alter table public.missions add column if not exists pay_rate numeric(8,2);
alter table public.missions add column if not exists pay_currency char(3) not null default 'GBP';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'missions_planned_hours_range') then
    alter table public.missions add constraint missions_planned_hours_range check (planned_hours is null or (planned_hours >= 0 and planned_hours <= 744));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'missions_pay_rate_range') then
    alter table public.missions add constraint missions_pay_rate_range check (pay_rate is null or (pay_rate >= 0 and pay_rate <= 100000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'missions_pay_currency_fmt') then
    alter table public.missions add constraint missions_pay_currency_fmt check (pay_currency ~ '^[A-Z]{3}$');
  end if;
end $$;

alter table public.mission_staff add column if not exists shift_start_at timestamptz;
alter table public.mission_staff add column if not exists shift_end_at timestamptz;
alter table public.mission_staff add column if not exists hours_worked numeric(6,2);
alter table public.mission_staff add column if not exists pay_rate numeric(8,2);
alter table public.mission_staff add column if not exists completed_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mission_staff_hours_range') then
    alter table public.mission_staff add constraint mission_staff_hours_range check (hours_worked is null or (hours_worked >= 0 and hours_worked <= 744));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mission_staff_pay_rate_range') then
    alter table public.mission_staff add constraint mission_staff_pay_rate_range check (pay_rate is null or (pay_rate >= 0 and pay_rate <= 100000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mission_staff_shift_order') then
    alter table public.mission_staff add constraint mission_staff_shift_order check (shift_end_at is null or shift_start_at is null or shift_end_at >= shift_start_at);
  end if;
end $$;
create index if not exists mission_staff_staff_idx on public.mission_staff (staff_id, assignment_status);

-- La vue doit être recréée pour exposer les nouvelles colonnes de missions.
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

-- Heures par staff sur une période (réservées = sélectionné/contacté/confirmé ; travaillées = terminé).
-- Heures retenues pour une affectation : heures saisies → horaires de la garde → heures prévues de la mission → dates de la mission.
create or replace function public.staff_hours_summary(p_from timestamptz, p_to timestamptz)
returns table (staff_id uuid, reserved_hours numeric, worked_hours numeric, missions_count integer, completed_count integer)
language sql stable security invoker set search_path = public as $$
  with eff as (
    select ms.staff_id, ms.assignment_status,
      coalesce(ms.shift_start_at, m.scheduled_start_at, ms.selected_at) as starts_at,
      coalesce(
        ms.hours_worked,
        extract(epoch from (ms.shift_end_at - ms.shift_start_at)) / 3600.0,
        m.planned_hours,
        extract(epoch from (m.scheduled_end_at - m.scheduled_start_at)) / 3600.0,
        0
      )::numeric as hours
    from public.mission_staff ms
    join public.missions m on m.id = ms.mission_id
    where ms.owner_id = auth.uid()
      and ms.assignment_status in ('selected', 'contacted', 'confirmed', 'completed')
  )
  select e.staff_id,
    round(coalesce(sum(e.hours) filter (where e.assignment_status <> 'completed'), 0), 2),
    round(coalesce(sum(e.hours) filter (where e.assignment_status = 'completed'), 0), 2),
    count(*)::int,
    (count(*) filter (where e.assignment_status = 'completed'))::int
  from eff e
  where e.starts_at >= p_from and e.starts_at < p_to
  group by e.staff_id
$$;
grant execute on function public.staff_hours_summary(timestamptz, timestamptz) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Notifications : métadonnées (document concerné) et trace de l'email envoyé
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.notifications add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.notifications add column if not exists email_sent_at timestamptz;

-- Envoi automatique des e-mails d'expiration au staff (réglable dans Paramètres).
alter table public.profiles add column if not exists auto_email_documents boolean not null default true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Codes de connexion (2e facteur par email). Aucune policy : seul le serveur (service role) y accède.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.login_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists login_codes_user_idx on public.login_codes (user_id, created_at desc);
alter table public.login_codes enable row level security;
revoke all on public.login_codes from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS des nouvelles tables
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.document_types enable row level security;
alter table public.staff_documents enable row level security;
alter table public.document_alerts enable row level security;
alter table public.document_access_log enable row level security;

drop policy if exists document_types_select_own on public.document_types;
create policy document_types_select_own on public.document_types for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists document_types_insert_own on public.document_types;
create policy document_types_insert_own on public.document_types for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists document_types_update_own on public.document_types;
create policy document_types_update_own on public.document_types for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists document_types_delete_own on public.document_types;
create policy document_types_delete_own on public.document_types for delete to authenticated using (owner_id = (select auth.uid()) and not is_default);

drop policy if exists staff_documents_select_own on public.staff_documents;
create policy staff_documents_select_own on public.staff_documents for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists staff_documents_insert_own on public.staff_documents;
create policy staff_documents_insert_own on public.staff_documents for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.staff s where s.id = staff_id and s.owner_id = (select auth.uid()))
    and exists (select 1 from public.document_types t where t.id = type_id and t.owner_id = (select auth.uid()))
  );
drop policy if exists staff_documents_update_own on public.staff_documents;
create policy staff_documents_update_own on public.staff_documents for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists staff_documents_delete_own on public.staff_documents;
create policy staff_documents_delete_own on public.staff_documents for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists document_alerts_select_own on public.document_alerts;
create policy document_alerts_select_own on public.document_alerts for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists document_alerts_insert_own on public.document_alerts;
create policy document_alerts_insert_own on public.document_alerts for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.staff_documents d where d.id = document_id and d.owner_id = (select auth.uid())));

drop policy if exists document_access_select_own on public.document_access_log;
create policy document_access_select_own on public.document_access_log for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists document_access_insert_own on public.document_access_log;
create policy document_access_insert_own on public.document_access_log for insert to authenticated with check (owner_id = (select auth.uid()));
-- Pas de update/delete : le journal d'accès ne se modifie pas depuis l'application.

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Types de documents par défaut (appelée à la première visite)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.ensure_default_document_types()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.document_types (owner_id, key, name_fr, name_en, mandatory, can_expire, sort_order, is_default) values
    (auth.uid(), 'right_to_work', 'Droit de travailler au Royaume-Uni (Right to Work)', 'Right to Work in the UK', true, true, 10, true),
    (auth.uid(), 'passport', 'Passeport', 'Passport', true, true, 20, true),
    (auth.uid(), 'dbs', 'Certificat DBS', 'DBS certificate', true, true, 30, true),
    (auth.uid(), 'training_certificate', 'Certificat de formation requis', 'Relevant training certificate', true, true, 40, true),
    (auth.uid(), 'driving_licence', 'Permis de conduire', 'Driving licence', true, true, 50, true)
  on conflict (owner_id, key) do nothing;
end $$;
revoke all on function public.ensure_default_document_types() from public, anon;
grant execute on function public.ensure_default_document_types() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Purges (appelées par la tâche quotidienne /api/cron/daily avec la clé service)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.purge_old_activity(p_days integer default 21)
returns integer language sql security definer set search_path = public as $$
  with d as (delete from public.activity_logs where created_at < now() - make_interval(days => greatest(p_days, 1)) returning 1)
  select count(*)::int from d
$$;
create or replace function public.purge_old_access_log(p_days integer default 365)
returns integer language sql security definer set search_path = public as $$
  with d as (delete from public.document_access_log where created_at < now() - make_interval(days => greatest(p_days, 30)) returning 1)
  select count(*)::int from d
$$;
create or replace function public.purge_login_codes()
returns integer language sql security definer set search_path = public as $$
  with d as (delete from public.login_codes where created_at < now() - interval '1 day' returning 1)
  select count(*)::int from d
$$;
revoke all on function public.purge_old_activity(integer), public.purge_old_access_log(integer), public.purge_login_codes() from public, anon, authenticated;
grant execute on function public.purge_old_activity(integer), public.purge_old_access_log(integer), public.purge_login_codes() to service_role;
