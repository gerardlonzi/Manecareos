-- Manecare — Row Level Security
-- Principe : un manager ne voit et ne modifie que ses propres lignes.

alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.missions enable row level security;
alter table public.mission_staff enable row level security;
alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.route_estimates enable row level security;

-- profiles : lecture et mise à jour de son propre profil. Pas d'insert/delete client
-- (le profil est créé par le trigger handle_new_user).
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- staff
create policy staff_select_own on public.staff for select to authenticated
  using (owner_id = (select auth.uid()));
create policy staff_insert_own on public.staff for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy staff_update_own on public.staff for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy staff_delete_own on public.staff for delete to authenticated
  using (owner_id = (select auth.uid()));

-- missions
create policy missions_select_own on public.missions for select to authenticated
  using (owner_id = (select auth.uid()));
create policy missions_insert_own on public.missions for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy missions_update_own on public.missions for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy missions_delete_own on public.missions for delete to authenticated
  using (owner_id = (select auth.uid()));

-- mission_staff : la mission ET le staff doivent appartenir au manager.
create policy mission_staff_select_own on public.mission_staff for select to authenticated
  using (owner_id = (select auth.uid()));
create policy mission_staff_insert_own on public.mission_staff for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.missions m where m.id = mission_id and m.owner_id = (select auth.uid()))
    and exists (select 1 from public.staff s where s.id = staff_id and s.owner_id = (select auth.uid()))
  );
create policy mission_staff_update_own on public.mission_staff for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy mission_staff_delete_own on public.mission_staff for delete to authenticated
  using (owner_id = (select auth.uid()));

-- activity_logs : append-only (lecture + insertion, aucune modification ni suppression).
create policy activity_select_own on public.activity_logs for select to authenticated
  using (owner_id = (select auth.uid()));
create policy activity_insert_own on public.activity_logs for insert to authenticated
  with check (owner_id = (select auth.uid()));

-- notifications
create policy notifications_select_own on public.notifications for select to authenticated
  using (owner_id = (select auth.uid()));
create policy notifications_insert_own on public.notifications for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications for delete to authenticated
  using (owner_id = (select auth.uid()));

-- route_estimates : cache privé par manager.
create policy route_estimates_select_own on public.route_estimates for select to authenticated
  using (owner_id = (select auth.uid()));
create policy route_estimates_insert_own on public.route_estimates for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy route_estimates_update_own on public.route_estimates for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy route_estimates_delete_own on public.route_estimates for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Droits : rien pour anon, DML pour authenticated (filtré par RLS).
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke update, delete on public.activity_logs from authenticated;
