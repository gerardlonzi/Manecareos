-- RLS isolation check between two managers. Run in the Supabase SQL editor of a TEST project.
-- It creates two throw-away auth users, impersonates each, and ROLLS BACK everything at the end.
-- Expected: every line returned in the final "results" table says PASS.
begin;

create temp table results(check_name text, outcome text);
grant all on results to authenticated;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
 ('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-a@example.test','{"full_name":"Manager A"}', now(), now()),
 ('bbbbbbbb-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-b@example.test','{"full_name":"Manager B"}', now(), now());

-- Manager A creates a staff record
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001', true);
insert into public.staff (owner_id, full_name, country_code)
values ('aaaaaaaa-0000-0000-0000-000000000001','Staff of A','GB');

-- Manager B must see nothing of A
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002', true);
insert into results select 'B cannot read A staff',
  case when (select count(*) from public.staff) = 0 then 'PASS' else 'FAIL' end;

do $$
begin
  begin
    insert into public.staff (owner_id, full_name, country_code)
    values ('aaaaaaaa-0000-0000-0000-000000000001','Injected by B','GB');
    insert into results values ('B cannot insert with A owner_id','FAIL');
  exception when others then
    insert into results values ('B cannot insert with A owner_id','PASS');
  end;
end $$;

-- B cannot update/delete A's record (0 rows affected under RLS)
with u as (update public.staff set full_name = 'hacked' returning 1)
insert into results select 'B cannot update A staff', case when (select count(*) from u) = 0 then 'PASS' else 'FAIL' end;

select * from results order by check_name;
rollback;
