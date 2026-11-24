-- =============================================================================
-- ReqGen 5.0.0 · Step 2 · Registry belongs to the PA to the DG, and one "PA to the DG"
-- (owner's instruction, 24 Nov 2026)
--
--  1. Registry (incoming and outgoing books, Request Tracking, reminders, filing, dispatch,
--     archive, registry reports) is for the PA to the DG (Registry) and the Super Admin ONLY.
--     Not the DG, not the Auditor, not Finance, not the Registrar.
--     Registry still never sees the contents of a request.
--  2. The position "PA to the DG" is written once. Old spellings ("pa to the dg", "PA_to_DG" …)
--     are moved onto it and switched off. The PA to the DG also holds Registry, kept together
--     automatically, so every existing Registry rule keeps working.
--
-- Nothing is dropped. No request, voucher or history row changes. Safe to run more than once.
-- Run AFTER database/v5_0_0_status_fix.sql. Ends with a report where every row says OK.
-- =============================================================================
begin;

create temp table if not exists v500_report (step text, item text, result text, status text);
truncate v500_report;

-- 1. Who may use Registry -------------------------------------------------------------------
create or replace function public.reqgen_is_registry()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.reqgen_active_role_key() in ('registry', 'padg', 'admin'), false)
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.system_account = 'superadmin');
$$;
revoke all on function public.reqgen_is_registry() from public, anon;
grant execute on function public.reqgen_is_registry() to authenticated;
insert into v500_report values ('1 registry', 'reqgen_is_registry', 'PA to the DG (Registry) and the Super Admin only', 'OK');

-- 1b. Every Registry function that also let Finance, the DG's office or the Auditor in now checks
--     Registry only. The live function text is edited in place (grants and everything else kept).
do $$
declare
  f record;
  d text;
  n int := 0;
begin
  for f in
    select p.oid, p.proname
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public'
       and p.prosrc like '%reqgen_is_registry() or public.reqgen_report_tier() in (''all'', ''finance'')%'
  loop
    d := pg_get_functiondef(f.oid);
    d := replace(d, 'public.reqgen_is_registry() or public.reqgen_report_tier() in (''all'', ''finance'')', 'public.reqgen_is_registry()');
    d := replace(d, 'Request Tracking is for Registry, Finance, the Auditor and the Super Admin.', 'Request Tracking is for the PA to the DG (Registry) and the Super Admin.');
    d := replace(d, 'Only Registry, Finance, the Auditor or the Super Admin send reminders.', 'Only the PA to the DG (Registry) or the Super Admin sends reminders.');
    execute d;
    n := n + 1;
    insert into v500_report values ('1 registry', f.proname, 'Registry only now', 'OK');
  end loop;
  if n = 0 then
    insert into v500_report values ('1 registry', 'registry functions', 'already Registry only', 'OK');
  end if;
end $$;

-- 1c. The incoming and outgoing books: only Registry can read them directly.
do $$
begin
  if to_regclass('public.registry_correspondence') is null then
    insert into v500_report values ('1 registry', 'registry_correspondence', 'table not present (nothing to do)', 'OK');
    return;
  end if;
  if exists (select 1 from pg_class where oid = 'public.registry_correspondence'::regclass and relrowsecurity) then
    drop policy if exists reqgen_registry_only on public.registry_correspondence;
    create policy reqgen_registry_only on public.registry_correspondence as restrictive for all to authenticated
      using (public.reqgen_is_registry()) with check (public.reqgen_is_registry());
  else
    alter table public.registry_correspondence enable row level security;
    drop policy if exists reqgen_registry_all on public.registry_correspondence;
    create policy reqgen_registry_all on public.registry_correspondence for all to authenticated
      using (public.reqgen_is_registry()) with check (public.reqgen_is_registry());
  end if;
  insert into v500_report values ('1 registry', 'registry_correspondence', 'readable and writable by Registry only', 'OK');
end $$;

-- 2. One "PA to the DG" -----------------------------------------------------------------------
do $$
declare
  v_variants text[] := array['patothedg', 'patodg', 'personalassistanttothedg', 'pa2dg', 'personalassistantdg'];
  v_keys text[] := '{}';
  n_moved int := 0; n_off int := 0; n_cat int := 0; n_prof int := 0; n_act int := 0;
begin
  if to_regclass('public.reqgen_roles') is not null then
    -- every catalogue key that is really "PA to the DG" under another spelling
    select coalesce(array_agg(role_key), '{}') into v_keys from public.reqgen_roles
     where role_key <> 'padg'
       and (regexp_replace(lower(role_key), '[^a-z0-9]', '', 'g') = any (v_variants)
            or regexp_replace(lower(coalesce(role_name, '')), '[^a-z0-9]', '', 'g') = any (v_variants));
    update public.reqgen_roles
       set role_name = 'PA to the DG',
           description = 'Personal Assistant to the DG and the Registry: logs every file into and out of the DG''s office, tracks every request and reminds whoever holds it. Never sees request contents.',
           is_active = true
     where role_key = 'padg';
    update public.reqgen_roles set is_active = false
     where role_key <> 'padg'
       and (regexp_replace(lower(role_key), '[^a-z0-9]', '', 'g') = any (v_variants)
            or regexp_replace(lower(coalesce(role_name, '')), '[^a-z0-9]', '', 'g') = any (v_variants));
    get diagnostics n_cat = row_count;
  end if;

  if to_regclass('public.profile_roles') is not null then
    -- holders of an old spelling who do not yet hold padg: their row becomes padg
    update public.profile_roles pr
       set role_key = 'padg', role_name = 'PA to the DG', updated_at = now()
     where pr.role_key <> 'padg'
       and (regexp_replace(lower(pr.role_key), '[^a-z0-9]', '', 'g') = any (v_variants) or pr.role_key = any (v_keys))
       and not exists (select 1 from public.profile_roles x where x.profile_id = pr.profile_id and x.role_key = 'padg');
    get diagnostics n_moved = row_count;
    -- any old-spelling row left over is a duplicate: switched off (kept for history)
    update public.profile_roles pr
       set is_active = false, updated_at = now()
     where pr.role_key <> 'padg'
       and (regexp_replace(lower(pr.role_key), '[^a-z0-9]', '', 'g') = any (v_variants) or pr.role_key = any (v_keys))
       and coalesce(pr.is_active, true);
    get diagnostics n_off = row_count;
    update public.profile_roles set role_name = 'PA to the DG' where role_key = 'padg' and role_name is distinct from 'PA to the DG';
  end if;

  update public.profiles set role = 'padg'
   where role is not null and role <> 'padg' and regexp_replace(lower(role), '[^a-z0-9]', '', 'g') = any (v_variants);
  get diagnostics n_prof = row_count;

  if to_regclass('public.user_active_roles') is not null then
    update public.user_active_roles set active_role_key = 'padg', active_role_name = 'PA to the DG'
     where active_role_key <> 'padg' and (regexp_replace(lower(active_role_key), '[^a-z0-9]', '', 'g') = any (v_variants) or active_role_key = any (v_keys));
    get diagnostics n_act = row_count;
  end if;

  insert into v500_report values ('2 PA to the DG', 'old spellings in the position list', n_cat || ' switched off', 'OK');
  insert into v500_report values ('2 PA to the DG', 'people moved onto PA to the DG', n_moved || ' moved, ' || n_off || ' duplicate(s) switched off', 'OK');
  insert into v500_report values ('2 PA to the DG', 'profiles and "Acting as"', n_prof || ' profile(s), ' || n_act || ' acting-as choice(s) corrected', 'OK');
end $$;

-- 2b. The PA to the DG always holds Registry too (kept together from now on).
create or replace function public.reqgen_pa_registry_pair()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role_key = 'padg' then
    begin
      if exists (select 1 from public.profile_roles x where x.profile_id = new.profile_id and x.role_key = 'registry') then
        update public.profile_roles set is_active = coalesce(new.is_active, true), updated_at = now()
         where profile_id = new.profile_id and role_key = 'registry' and is_active is distinct from coalesce(new.is_active, true);
      else
        insert into public.profile_roles (profile_id, role_key, role_name, is_primary, is_active, assigned_at, created_at, updated_at)
        values (new.profile_id, 'registry', 'Registry', false, coalesce(new.is_active, true), now(), now(), now());
      end if;
    exception when others then null; -- never block giving the position
    end;
  end if;
  return new;
end;
$$;
drop trigger if exists reqgen_pa_registry_pair on public.profile_roles;
create trigger reqgen_pa_registry_pair after insert or update of role_key, is_active on public.profile_roles
  for each row execute function public.reqgen_pa_registry_pair();

do $$
declare n int := 0;
begin
  insert into public.profile_roles (profile_id, role_key, role_name, is_primary, is_active, assigned_at, created_at, updated_at)
  select pr.profile_id, 'registry', 'Registry', false, true, now(), now(), now()
    from public.profile_roles pr
   where pr.role_key = 'padg' and coalesce(pr.is_active, true)
     and not exists (select 1 from public.profile_roles x where x.profile_id = pr.profile_id and x.role_key = 'registry');
  get diagnostics n = row_count;
  update public.profile_roles r set is_active = true, updated_at = now()
   where r.role_key = 'registry' and not coalesce(r.is_active, true)
     and exists (select 1 from public.profile_roles p where p.profile_id = r.profile_id and p.role_key = 'padg' and coalesce(p.is_active, true));
  insert into v500_report values ('2 PA to the DG', 'Registry held with PA to the DG', n || ' added; kept together from now on', 'OK');
end $$;

commit;

select * from v500_report order by step, item;
