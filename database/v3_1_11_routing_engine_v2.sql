-- =============================================================================
-- ReqGen v3.1.11 — Routing Engine v2: one page, one route per department
-- Run in the Supabase SQL Editor after deploying v3.1.11. Safe to re-run and
-- safe while staff are working (no table is locked for long; existing tables
-- are not altered).
--
-- What it adds
--   1. reqgen_department_stage_officers — the officer for each stage of each
--      department (PO, DOD, HOD, DIN Admin, HR, Registrar, DG). A department
--      officer, when set, comes first; otherwise the institution-wide officer
--      (Admin → System Settings) and the backups are used, as before.
--   2. The stage resolver uses that table first.
--   3. reqgen_save_department_route(...) — saves a department's three routes
--      (Official, Personal Fund, Personal Other) and its officers in ONE step,
--      with the institutional rules enforced. Each save creates a new route
--      version, so requests already in progress keep the route they started
--      with; only new requests use the new route.
--   4. reqgen_department_route_overview() — every department's routes and any
--      gaps, for the Routing Engine page.
-- =============================================================================

set lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- 1. Department stage officers
-- ---------------------------------------------------------------------------
begin;

create table if not exists public.reqgen_department_stage_officers (
  dept_id uuid not null references public.departments(id) on delete cascade,
  stage text not null check (stage in ('PO', 'DOD', 'HOD', 'DIN Admin', 'HR', 'Registrar', 'DG')),
  user_id uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (dept_id, stage)
);

alter table public.reqgen_department_stage_officers enable row level security;
drop policy if exists reqgen_department_stage_officers_read on public.reqgen_department_stage_officers;
create policy reqgen_department_stage_officers_read on public.reqgen_department_stage_officers
  for select to authenticated using (true);
revoke insert, update, delete on public.reqgen_department_stage_officers from anon, authenticated;
grant select on public.reqgen_department_stage_officers to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- 2. Resolver: department officer first
-- ---------------------------------------------------------------------------
begin;

create or replace function public.reqgen_stage_candidates(p_dept_id uuid, p_stage text)
returns table (user_id uuid, rank integer, is_primary boolean, label text)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_stage text := public.reqgen_key(p_stage);
  v_primary uuid;
begin
  -- v3.1.11: the officer chosen for this department in the Routing Engine.
  select o.user_id into v_primary
  from public.reqgen_department_stage_officers o
  where o.dept_id = p_dept_id
    and public.reqgen_key(o.stage) = case when v_stage = 'hrfiling' then 'hr' else v_stage end
  limit 1;

  if v_primary is null then
    if v_stage = 'dod' then
      select d.director_user_id into v_primary from public.departments d where d.id = p_dept_id;
    elsif v_stage = 'hod' then
      select d.hod_user_id into v_primary from public.departments d where d.id = p_dept_id;
    elsif v_stage = 'po' then
      select d.po_id into v_primary from public.departments d where d.id = p_dept_id;
    elsif v_stage in ('hr', 'hrfiling') then
      select nullif(s.value, '')::uuid into v_primary from public.app_settings s where s.key = 'HR_USER_ID';
    elsif v_stage = 'dg' then
      select nullif(s.value, '')::uuid into v_primary from public.app_settings s where s.key = 'DG_USER_ID';
    elsif v_stage = 'registrar' then
      select nullif(s.value, '')::uuid into v_primary from public.app_settings s where s.key = 'REGISTRAR_USER_ID';
    elsif v_stage = 'dinadmin' then
      select nullif(s.value, '')::uuid into v_primary from public.app_settings s where s.key = 'DIN_ADMIN_USER_ID';
    end if;
  end if;

  if v_primary is not null then
    user_id := v_primary; rank := 1; is_primary := true; label := null;
    return next;
  end if;

  return query
    select b.user_id, b.priority + (case when b.dept_id is null then 10 else 0 end), false, b.label
    from public.reqgen_stage_backups b
    where b.is_active
      and public.reqgen_key(b.stage) = case when v_stage = 'hrfiling' then 'hr' else v_stage end
      and (b.dept_id = p_dept_id or b.dept_id is null)
      and b.user_id is distinct from v_primary
    order by b.priority + (case when b.dept_id is null then 10 else 0 end), b.created_at;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Save a department's routes and officers in one step
-- ---------------------------------------------------------------------------
-- p_routes   {"official":[{"stage":"DOD","if_vacant":"skip"},…],
--             "personal_fund":[…], "personal_other":[…]}
--            Only the REVIEW stages (PO, DOD, HOD, DIN Admin, HR, Registrar)
--            are sent; DG, Account and HR Filing are added by the rules.
-- p_officers {"PO":"<uuid>"|null, "DOD":…, "HOD":…, "DIN Admin":…, "HR":…,
--             "Registrar":…, "DG":…}   null = use the institution default.
create or replace function public.reqgen_save_department_route(
  p_dept_id uuid, p_routes jsonb, p_officers jsonb, p_dg_if_vacant text default 'block'
)
returns json
language plpgsql security definer set search_path = public as $fn$
declare
  v_dept public.departments%rowtype;
  v_order text[] := array['PO', 'DOD', 'HOD', 'DIN Admin', 'HR', 'Registrar'];
  v_kinds text[] := array['official', 'personal_fund', 'personal_other'];
  v_kind text;
  v_stage text;
  v_item jsonb;
  v_stages text[];
  v_vacant text[];
  v_prefix text;
  v_version int;
  v_template uuid;
  v_officer text;
  v_user uuid;
  v_preview json;
begin
  if not (public.current_user_has_any_role(array['admin']) or public.current_profile_role_key() = 'admin') then
    raise exception 'Only Admin can change routes.';
  end if;
  if p_dg_if_vacant not in ('skip', 'block') then raise exception 'Invalid DG vacancy rule.'; end if;

  select * into v_dept from public.departments where id = p_dept_id;
  if not found then raise exception 'Department not found.'; end if;

  -- New route version for this department.
  v_prefix := 'D' || upper(substr(replace(p_dept_id::text, '-', ''), 1, 12)) || '_V';
  select coalesce(max(nullif(regexp_replace(t.code, '^.*_V', ''), '')::int), 0) + 1 into v_version
  from public.reqgen_route_templates t where t.code like v_prefix || '%';
  insert into public.reqgen_route_templates (code, name, description, is_active, updated_by)
  values (v_prefix || v_version, left(v_dept.name, 60) || ' route v' || v_version,
          'Department route — managed by Routing Engine (v3.1.11).', true, auth.uid())
  returning id into v_template;

  foreach v_kind in array v_kinds loop
    v_stages := array[]::text[];
    v_vacant := array[]::text[];
    -- review stages in the institutional order, only those switched on
    foreach v_stage in array v_order loop
      select e into v_item
      from jsonb_array_elements(coalesce(p_routes -> v_kind, '[]'::jsonb)) e
      where e ->> 'stage' = v_stage
      limit 1;
      if v_item is not null then
        v_stages := v_stages || v_stage;
        v_vacant := v_vacant || coalesce(nullif(v_item ->> 'if_vacant', ''), 'skip');
      end if;
      v_item := null;
    end loop;
    -- fixed tail required by the rules
    v_stages := v_stages || 'DG'::text;
    v_vacant := v_vacant || p_dg_if_vacant;
    if v_kind in ('official', 'personal_fund') then
      v_stages := v_stages || 'Account'::text;
      v_vacant := v_vacant || 'skip'::text;
    end if;
    if v_kind in ('personal_fund', 'personal_other') then
      v_stages := v_stages || 'HR Filing'::text;
      v_vacant := v_vacant || 'skip'::text;
    end if;
    perform public.reqgen_save_route(v_template, v_kind, v_stages, v_vacant);
  end loop;

  insert into public.reqgen_department_routes (dept_id, template_id, updated_at, updated_by)
  values (p_dept_id, v_template, now(), auth.uid())
  on conflict (dept_id) do update set template_id = excluded.template_id, updated_at = now(), updated_by = auth.uid();

  -- Older versions stay (requests in progress use them) but leave the lists.
  update public.reqgen_route_templates set is_active = false
  where code like v_prefix || '%' and id <> v_template;

  -- Officers
  foreach v_officer in array array['PO', 'DOD', 'HOD', 'DIN Admin', 'HR', 'Registrar', 'DG'] loop
    v_user := nullif(coalesce(p_officers ->> v_officer, ''), '')::uuid;
    if v_user is null then
      delete from public.reqgen_department_stage_officers where dept_id = p_dept_id and stage = v_officer;
    else
      insert into public.reqgen_department_stage_officers (dept_id, stage, user_id, updated_at, updated_by)
      values (p_dept_id, v_officer, v_user, now(), auth.uid())
      on conflict (dept_id, stage) do update set user_id = excluded.user_id, updated_at = now(), updated_by = auth.uid();
    end if;
  end loop;
  -- Keep the department record in step for PO / DOD / HOD.
  update public.departments set
    po_id = nullif(coalesce(p_officers ->> 'PO', ''), '')::uuid,
    director_user_id = nullif(coalesce(p_officers ->> 'DOD', ''), '')::uuid,
    hod_user_id = nullif(coalesce(p_officers ->> 'HOD', ''), '')::uuid
  where id = p_dept_id;

  select json_agg(json_build_object('route_kind', k.kind, 'step_order', r.step_order, 'stage', r.stage,
                                    'owner_id', r.owner_id, 'if_vacant', r.if_vacant) order by k.n, r.step_order)
  into v_preview
  from (values (1, 'official', 'Official', null::text), (2, 'personal_fund', 'Personal', 'Fund'), (3, 'personal_other', 'Personal', 'Other')) k(n, kind, rtype, pcat)
  cross join lateral public.reqgen_build_route_for_template(v_template, p_dept_id, k.rtype, k.pcat) r;

  return json_build_object('ok', true, 'template_id', v_template, 'version', v_version, 'route', v_preview);
end;
$fn$;

grant execute on function public.reqgen_save_department_route(uuid, jsonb, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Overview of every department's routes
-- ---------------------------------------------------------------------------
create or replace function public.reqgen_department_route_overview()
returns table (dept_id uuid, dept_name text, is_active boolean, template_code text, route_kind text,
               step_order integer, stage text, if_vacant text, owner_id uuid, owner_name text)
language sql stable security definer set search_path = public as $fn$
  select d.id, d.name::text, coalesce(d.is_active, true), t.code::text, k.kind, r.step_order, r.stage::text, r.if_vacant::text,
         r.owner_id, p.full_name::text
  from public.departments d
  cross join (values ('official', 'Official', null::text), ('personal_fund', 'Personal', 'Fund'), ('personal_other', 'Personal', 'Other')) k(kind, rtype, pcat)
  left join public.reqgen_route_templates t on t.id = public.reqgen_template_for_department(d.id)
  cross join lateral public.reqgen_build_route_for_template(public.reqgen_template_for_department(d.id), d.id, k.rtype, k.pcat) r
  left join public.profiles p on p.id = r.owner_id
  order by d.name, k.kind, r.step_order;
$fn$;

grant execute on function public.reqgen_department_route_overview() to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- 5. Verification
-- ---------------------------------------------------------------------------
select '1. Department stage officers table' as check_item,
       case when to_regclass('public.reqgen_department_stage_officers') is not null then 'OK' else 'CHECK' end as status, '' as detail
union all select '2. Resolver uses department officers first',
       case when (select prosrc from pg_proc where proname = 'reqgen_stage_candidates' limit 1) like '%reqgen_department_stage_officers%' then 'OK' else 'CHECK' end, ''
union all select '3. Save-department-route function',
       case when to_regprocedure('public.reqgen_save_department_route(uuid,jsonb,jsonb,text)') is not null then 'OK' else 'CHECK' end, ''
union all select '4. Route overview function',
       case when to_regprocedure('public.reqgen_department_route_overview()') is not null then 'OK' else 'CHECK' end, ''
union all select '5. Departments', 'OK', (select count(*)::text from public.departments);
