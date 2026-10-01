-- ============================================================================
-- ReqGen v3.0.5 — Routing Engine
--
-- Replaces the hard-coded routing inside build_request_route with routes that
-- Admin configures in ReqGen (Admin → Routing Engine), without code changes.
--
-- WHAT CHANGES
--  * NEW tables: route templates, template steps, department → template,
--    backup officers per stage, officer availability ("away").
--  * NEW column: requests.route_template_id — each request remembers the route
--    it started with, so editing routes never re-routes a request in progress.
--  * REPLACED (same name, same inputs, same outputs) — everything that calls
--    them keeps working unchanged:
--      build_request_route          now reads the configured template
--      reqgen_next_route_step       now follows the request's own snapshot,
--                                   honours "Block if vacant" steps
--      reqgen_actor_role_for_stage  an officer assigned to a stage by Admin
--                                   (primary or backup) may act at that stage
--  * Approve/reject/submit, subhead reservation, DG → Account routing, HR
--    Filing, payment completion and notifications are NOT modified.
--
-- DAY-ONE BEHAVIOUR
--  * Templates are seeded to reproduce today's routes exactly.
--  * Every department is assigned to its current route group, EXCEPT
--    ABUJA IET, ADAMAWA IET, IET SOUTH-WEST and SOKOTO IET → DIN (IET decision).
--  * Requests already in progress keep the route they started on.
--  * GENSEC is seeded as the DG's backup (acts only when DG is marked away).
--  * Every step starts as "Skip if vacant" (today's behaviour). Admin can switch
--    any step to "Block if vacant".
--
-- SAFETY: one transaction · pre-flight checks · idempotent · no existing row is
-- deleted. Ends with a verification table — every row should read OK.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Pre-flight
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.reqgen_key(text)') is null then
    raise exception 'ReqGen v3.0.5 STOPPED — nothing was changed. Helper reqgen_key(text) is missing.';
  end if;
  if to_regprocedure('public.reqgen_department_group(text)') is null then
    raise exception 'ReqGen v3.0.5 STOPPED — nothing was changed. Helper reqgen_department_group(text) is missing.';
  end if;
  if to_regprocedure('public.current_user_has_any_role(text[])') is null then
    raise exception 'ReqGen v3.0.5 STOPPED — nothing was changed. Helper current_user_has_any_role(text[]) is missing.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.reqgen_route_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]{2,40}$'),
  name text not null check (length(trim(name)) between 2 and 80),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.reqgen_route_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.reqgen_route_templates(id) on delete cascade,
  route_kind text not null check (route_kind in ('official', 'personal_fund', 'personal_other')),
  step_order integer not null check (step_order between 1 and 20),
  stage text not null check (stage in ('PO', 'DOD', 'DIN Admin', 'Registrar', 'HOD', 'HR', 'DG', 'Account', 'HR Filing')),
  if_vacant text not null default 'skip' check (if_vacant in ('skip', 'block')),
  unique (template_id, route_kind, step_order),
  unique (template_id, route_kind, stage)
);

create table if not exists public.reqgen_department_routes (
  dept_id uuid primary key references public.departments(id) on delete cascade,
  template_id uuid not null references public.reqgen_route_templates(id),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Backups / alternates. Primary officers stay where they are today
-- (departments.director_user_id / hod_user_id / po_id and app_settings).
create table if not exists public.reqgen_stage_backups (
  id uuid primary key default gen_random_uuid(),
  dept_id uuid references public.departments(id) on delete cascade, -- null = institution-wide
  stage text not null check (stage in ('PO', 'DOD', 'DIN Admin', 'Registrar', 'HOD', 'HR', 'DG')),
  user_id uuid not null,
  priority integer not null default 2 check (priority between 2 and 9),
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create unique index if not exists reqgen_stage_backups_unique
  on public.reqgen_stage_backups (coalesce(dept_id, '00000000-0000-0000-0000-000000000000'::uuid), stage, user_id);

create table if not exists public.reqgen_officer_availability (
  user_id uuid primary key,
  is_away boolean not null default false,
  away_from date,
  away_until date,
  note text,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (away_until is null or away_from is null or away_until >= away_from)
);

alter table public.requests
  add column if not exists route_template_id uuid references public.reqgen_route_templates(id);

-- RLS: everyone signed in may READ routing configuration; only Admin may change it.
do $$
declare t text;
begin
  foreach t in array array['reqgen_route_templates','reqgen_route_steps','reqgen_department_routes','reqgen_stage_backups','reqgen_officer_availability'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format($p$create policy %I on public.%I for all to authenticated
                      using (public.current_user_has_any_role(array['admin']) or public.current_profile_role_key() = 'admin')
                      with check (public.current_user_has_any_role(array['admin']) or public.current_profile_role_key() = 'admin')$p$,
                   t || '_admin_write', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Seed templates (reproduce today's routes exactly; only if empty)
-- ---------------------------------------------------------------------------
insert into public.reqgen_route_templates (code, name, description) values
  ('DIN', 'DIN', 'Da''wah Institute route'),
  ('GENERAL_ADMIN', 'General Admin', 'General Administration route'),
  ('ASAP_ALLI', 'ASAP-ALLI', 'ASAP-ALLI route'),
  ('WELFARE', 'Welfare', 'Welfare route'),
  ('LIAISON', 'Liaison', 'Liaison route')
on conflict (code) do nothing;

do $$
declare
  v_seed jsonb := '{
    "DIN":           {"official": ["DOD","DIN Admin","Registrar","DG","Account"], "personal_fund": ["DOD","HR","DG","Account","HR Filing"], "personal_other": ["DOD","HR","DG","HR Filing"]},
    "GENERAL_ADMIN": {"official": ["HOD","DG","Account"],                        "personal_fund": ["HOD","HR","DG","Account","HR Filing"], "personal_other": ["HOD","HR","DG","HR Filing"]},
    "ASAP_ALLI":     {"official": ["PO","DOD","HOD","DG","Account"],             "personal_fund": ["DOD","HOD","HR","DG","Account","HR Filing"], "personal_other": ["DOD","HOD","HR","DG","HR Filing"]},
    "WELFARE":       {"official": ["DOD","DG","Account"],                        "personal_fund": ["DOD","HR","DG","Account","HR Filing"], "personal_other": ["DOD","HR","DG","HR Filing"]},
    "LIAISON":       {"official": ["DOD","DG","Account"],                        "personal_fund": ["DOD","HR","DG","Account","HR Filing"], "personal_other": ["DOD","HR","DG","HR Filing"]}
  }';
  v_code text; v_kind text; v_stage text; v_i int; v_tid uuid;
begin
  for v_code in select jsonb_object_keys(v_seed) loop
    select id into v_tid from public.reqgen_route_templates where code = v_code;
    if exists (select 1 from public.reqgen_route_steps where template_id = v_tid) then continue; end if;
    for v_kind in select jsonb_object_keys(v_seed -> v_code) loop
      v_i := 0;
      for v_stage in select jsonb_array_elements_text(v_seed -> v_code -> v_kind) loop
        v_i := v_i + 1;
        insert into public.reqgen_route_steps (template_id, route_kind, step_order, stage)
        values (v_tid, v_kind, v_i, v_stage);
      end loop;
    end loop;
  end loop;
end $$;

-- Departments → template (only departments not yet assigned).
insert into public.reqgen_department_routes (dept_id, template_id)
select d.id,
       (select t.id from public.reqgen_route_templates t
        where t.code = case
          when upper(trim(d.name)) in ('ABUJA IET', 'ADAMAWA IET', 'IET SOUTH-WEST', 'SOKOTO IET') then 'DIN'
          else coalesce(nullif(public.reqgen_department_group(d.name), ''), 'GENERAL_ADMIN')
        end)
from public.departments d
where not exists (select 1 from public.reqgen_department_routes x where x.dept_id = d.id)
on conflict (dept_id) do nothing;

-- Any department whose group code had no template falls back to General Admin.
update public.reqgen_department_routes x
set template_id = (select id from public.reqgen_route_templates where code = 'GENERAL_ADMIN')
where x.template_id is null;

-- GENSEC = DG backup (institution-wide), if configured.
insert into public.reqgen_stage_backups (dept_id, stage, user_id, priority, label)
select null, 'DG', nullif(s.value, '')::uuid, 2, 'General Secretary (acting for DG)'
from public.app_settings s
where s.key = 'GENSEC_USER_ID' and nullif(s.value, '') is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Engine functions
-- ---------------------------------------------------------------------------
create or replace function public.reqgen_route_kind(p_request_type text, p_personal_category text)
returns text language sql immutable set search_path = public as $fn$
  select case
    when public.reqgen_key(p_request_type) = 'official' then 'official'
    when public.reqgen_key(p_personal_category) = 'fund' then 'personal_fund'
    else 'personal_other'
  end;
$fn$;

create or replace function public.reqgen_template_for_department(p_dept_id uuid)
returns uuid language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select x.template_id from public.reqgen_department_routes x where x.dept_id = p_dept_id),
    (select t.id from public.reqgen_route_templates t
       where t.code = (select coalesce(nullif(public.reqgen_department_group(d.name), ''), 'GENERAL_ADMIN')
                       from public.departments d where d.id = p_dept_id)),
    (select t.id from public.reqgen_route_templates t where t.code = 'GENERAL_ADMIN')
  );
$fn$;

create or replace function public.reqgen_is_available(p_user_id uuid, p_on date default current_date)
returns boolean language sql stable security definer set search_path = public as $fn$
  select not exists (
    select 1 from public.reqgen_officer_availability a
    where a.user_id = p_user_id and a.is_away
      and (a.away_from is null or a.away_from <= p_on)
      and (a.away_until is null or a.away_until >= p_on)
  );
$fn$;

-- Ordered candidates for a stage: the primary first, then backups by priority
-- (department-specific backups before institution-wide ones).
create or replace function public.reqgen_stage_candidates(p_dept_id uuid, p_stage text)
returns table (user_id uuid, rank integer, is_primary boolean, label text)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_stage text := public.reqgen_key(p_stage);
  v_primary uuid;
begin
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

-- The officer who should hold this stage now: the first AVAILABLE candidate.
-- If every candidate is away, the primary (or first candidate) is used so the
-- request is never lost. p_exclude skips one officer (used when reassigning).
create or replace function public.reqgen_resolve_stage_owner(p_dept_id uuid, p_stage text, p_exclude uuid default null)
returns uuid language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select c.user_id from public.reqgen_stage_candidates(p_dept_id, p_stage) c
      where c.user_id is distinct from p_exclude and public.reqgen_is_available(c.user_id)
      order by c.rank limit 1),
    (select c.user_id from public.reqgen_stage_candidates(p_dept_id, p_stage) c
      where c.user_id is distinct from p_exclude
      order by c.rank limit 1)
  );
$fn$;

create or replace function public.reqgen_stage_role(p_stage text, out role_key text, out role_name text)
language sql immutable set search_path = public as $fn$
  select
    case public.reqgen_key(p_stage)
      when 'po' then 'po' when 'dod' then 'dod' when 'dinadmin' then 'dinadmin' when 'registrar' then 'registrar'
      when 'hod' then 'hod' when 'hr' then 'hr' when 'dg' then 'dg' when 'account' then 'accountofficer'
      when 'hrfiling' then 'hr' else public.reqgen_key(p_stage) end,
    case public.reqgen_key(p_stage) when 'account' then 'AccountOfficer' else p_stage end;
$fn$;

-- Route for a given template (the engine core).
create or replace function public.reqgen_build_route_for_template(
  p_template_id uuid, p_dept_id uuid, p_request_type text, p_personal_category text
)
returns table (step_order integer, stage text, owner_id uuid, role_key text, role_name text, route_group text, if_vacant text)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_code text;
begin
  select t.code into v_code from public.reqgen_route_templates t where t.id = p_template_id;
  return query
    select s.step_order, s.stage,
           case when public.reqgen_key(s.stage) = 'account' then null::uuid
                else public.reqgen_resolve_stage_owner(p_dept_id, s.stage) end,
           (public.reqgen_stage_role(s.stage)).role_key,
           (public.reqgen_stage_role(s.stage)).role_name,
           v_code, s.if_vacant
    from public.reqgen_route_steps s
    where s.template_id = p_template_id
      and s.route_kind = public.reqgen_route_kind(p_request_type, p_personal_category)
    order by s.step_order;
end;
$fn$;

-- REPLACED: same signature and result columns as before.
create or replace function public.build_request_route(p_dept_id uuid, p_request_type text, p_personal_category text default null)
returns table (step_order integer, stage text, owner_id uuid, role_key text, role_name text, route_group text)
language sql stable security definer set search_path = public as $fn$
  select r.step_order, r.stage, r.owner_id, r.role_key, r.role_name, r.route_group
  from public.reqgen_build_route_for_template(
    public.reqgen_template_for_department(p_dept_id), p_dept_id, p_request_type, p_personal_category
  ) r;
$fn$;

-- REPLACED: follows the request's own route snapshot; "block" steps stop the flow.
create or replace function public.reqgen_next_route_step(p_request_id uuid, p_current_stage text)
returns table (next_stage text, next_owner uuid, next_role_key text, next_role_name text)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_request record;
  v_template uuid;
  v_current_order int;
  v_step record;
begin
  select r.id, r.dept_id, r.request_type, r.personal_category, r.route_template_id
  into v_request from public.requests r where r.id = p_request_id;
  if not found then raise exception 'Request not found.'; end if;

  v_template := coalesce(v_request.route_template_id, public.reqgen_template_for_department(v_request.dept_id));

  select br.step_order into v_current_order
  from public.reqgen_build_route_for_template(v_template, v_request.dept_id, v_request.request_type, v_request.personal_category) br
  where public.reqgen_key(br.stage) = public.reqgen_key(p_current_stage)
  order by br.step_order limit 1;
  v_current_order := coalesce(v_current_order, 0);

  for v_step in
    select br.* from public.reqgen_build_route_for_template(v_template, v_request.dept_id, v_request.request_type, v_request.personal_category) br
    where br.step_order > v_current_order
    order by br.step_order
  loop
    if v_step.owner_id is not null or public.reqgen_key(v_step.stage) = 'account' then
      next_stage := v_step.stage; next_owner := v_step.owner_id;
      next_role_key := v_step.role_key; next_role_name := v_step.role_name;
      return next;
      return;
    end if;
    if v_step.if_vacant = 'block' then
      raise exception 'Routing incomplete: no officer is assigned to the % step for this department. Ask Admin to complete Routing Engine settings.', v_step.stage;
    end if;
  end loop;
end;
$fn$;

-- REPLACED: an officer assigned to a stage by Admin (primary or backup) may act
-- at that stage. approve/reject still require the request to be assigned to them.
create or replace function public.reqgen_actor_role_for_stage(p_actor_id uuid, p_stage text)
returns table (actor_role_key text, actor_role_name text)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_stage text := public.reqgen_key(p_stage);
  v_wanted text[];
  v_profile_role text;
begin
  v_wanted := case
    when v_stage = 'po' then array['po']
    when v_stage = 'dod' then array['dod', 'director']
    when v_stage = 'dinadmin' then array['dinadmin', 'dinadmin1', 'dinadmin2', 'dinadmin3']
    when v_stage = 'registrar' then array['registrar']
    when v_stage = 'hod' then array['hod']
    when v_stage = 'hr' then array['hr', 'hrofficer1', 'hrofficer2', 'hrofficer3']
    when v_stage = 'dg' then array['dg']
    when v_stage = 'account' then array['accountofficer', 'account', 'accounts']
    when v_stage = 'hrfiling' then array['hr', 'hrofficer1', 'hrofficer2', 'hrofficer3']
    else array[]::text[]
  end;

  -- 1) A matching active role (original behaviour).
  return query
    select pr.role_key::text, pr.role_name::text
    from public.profile_roles pr
    where pr.profile_id = p_actor_id and coalesce(pr.is_active, true)
      and public.reqgen_key(pr.role_key) = any (v_wanted)
    order by pr.is_primary desc, pr.role_name asc
    limit 1;
  if found then return; end if;

  select p.role into v_profile_role from public.profiles p where p.id = p_actor_id;
  if public.reqgen_key(v_profile_role) = any (v_wanted) then
    actor_role_key := public.reqgen_key(v_profile_role);
    actor_role_name := coalesce(v_profile_role, 'Staff');
    return next; return;
  end if;

  -- 2) Assigned to this stage by Admin (primary or backup) → acting authority.
  if v_stage <> 'account' and (
       exists (select 1 from public.reqgen_stage_backups b
               where b.is_active and b.user_id = p_actor_id
                 and public.reqgen_key(b.stage) = case when v_stage = 'hrfiling' then 'hr' else v_stage end)
    or (v_stage = 'dod' and exists (select 1 from public.departments d where d.director_user_id = p_actor_id))
    or (v_stage = 'hod' and exists (select 1 from public.departments d where d.hod_user_id = p_actor_id))
    or (v_stage = 'po'  and exists (select 1 from public.departments d where d.po_id = p_actor_id))
    or exists (select 1 from public.app_settings s
               where nullif(s.value, '') = p_actor_id::text
                 and s.key = case v_stage when 'dg' then 'DG_USER_ID' when 'hr' then 'HR_USER_ID' when 'hrfiling' then 'HR_USER_ID'
                                          when 'registrar' then 'REGISTRAR_USER_ID' when 'dinadmin' then 'DIN_ADMIN_USER_ID' else '-' end)
  ) then
    actor_role_key := coalesce(nullif(public.reqgen_key(v_profile_role), ''), 'staff');
    actor_role_name := coalesce(nullif(trim(v_profile_role), ''), 'Officer') || ' (acting ' || p_stage || ')';
    return next;
  end if;
end;
$fn$;

-- Route preview for the New Request page (stages only, plus vacancy flag).
create or replace function public.reqgen_route_preview(p_dept_id uuid, p_request_type text, p_personal_category text default null)
returns table (step_order integer, stage text, is_vacant boolean, if_vacant text, route_group text)
language sql stable security definer set search_path = public as $fn$
  select r.step_order, r.stage, (r.owner_id is null and public.reqgen_key(r.stage) <> 'account'), r.if_vacant, r.route_group
  from public.reqgen_build_route_for_template(
    public.reqgen_template_for_department(p_dept_id), p_dept_id, p_request_type, p_personal_category
  ) r;
$fn$;

-- Save one route lane atomically, with institutional rules enforced.
create or replace function public.reqgen_save_route(p_template_id uuid, p_route_kind text, p_stages text[], p_if_vacant text[])
returns integer language plpgsql security definer set search_path = public as $fn$
declare
  v_n int := coalesce(array_length(p_stages, 1), 0);
  v_i int;
  v_keys text[] := array[]::text[];
  v_dg int; v_acc int; v_hrf int;
begin
  if not (public.current_user_has_any_role(array['admin']) or public.current_profile_role_key() = 'admin') then
    raise exception 'Only Admin can change routes.';
  end if;
  if p_route_kind not in ('official', 'personal_fund', 'personal_other') then raise exception 'Unknown route type.'; end if;
  if v_n = 0 then raise exception 'A route needs at least one step.'; end if;
  if coalesce(array_length(p_if_vacant, 1), 0) <> v_n then raise exception 'Step settings do not match the steps.'; end if;

  for v_i in 1..v_n loop
    if p_stages[v_i] not in ('PO','DOD','DIN Admin','Registrar','HOD','HR','DG','Account','HR Filing') then
      raise exception 'Unknown step: %', p_stages[v_i];
    end if;
    if p_if_vacant[v_i] not in ('skip', 'block') then raise exception 'Invalid vacancy rule.'; end if;
    if public.reqgen_key(p_stages[v_i]) = any (v_keys) then raise exception 'Step % appears twice in one route.', p_stages[v_i]; end if;
    v_keys := v_keys || public.reqgen_key(p_stages[v_i]);
  end loop;

  v_dg  := array_position(v_keys, 'dg');
  v_acc := array_position(v_keys, 'account');
  v_hrf := array_position(v_keys, 'hrfiling');
  if v_dg is null then raise exception 'Every route must include DG.'; end if;
  if p_route_kind in ('official', 'personal_fund') then
    if v_acc is null or v_acc <> v_dg + 1 then raise exception 'Account must come immediately after DG on financial routes.'; end if;
  elsif v_acc is not null then
    raise exception 'Personal Other routes do not go to Account.';
  end if;
  if p_route_kind = 'official' and v_hrf is not null then raise exception 'Official routes do not include HR Filing.'; end if;
  if p_route_kind <> 'official' and (v_hrf is null or v_hrf <> v_n) then raise exception 'Personal routes must end with HR Filing.'; end if;
  if p_route_kind = 'official' and v_acc <> v_n then raise exception 'Official routes must end with Account.'; end if;

  delete from public.reqgen_route_steps where template_id = p_template_id and route_kind = p_route_kind;
  for v_i in 1..v_n loop
    insert into public.reqgen_route_steps (template_id, route_kind, step_order, stage, if_vacant)
    values (p_template_id, p_route_kind, v_i, p_stages[v_i], p_if_vacant[v_i]);
  end loop;
  update public.reqgen_route_templates set updated_at = now(), updated_by = auth.uid() where id = p_template_id;
  return v_n;
end;
$fn$;

-- Mark an officer away/available. Requests already waiting on them move to
-- their backup immediately (audited + notified). Admin, or the officer themself.
create or replace function public.reqgen_set_officer_availability(
  p_user_id uuid, p_is_away boolean, p_from date default null, p_until date default null, p_note text default null
)
returns integer language plpgsql security definer set search_path = public as $fn$
declare
  v_req record;
  v_new uuid;
  v_moved int := 0;
  v_name text;
  v_new_name text;
begin
  if not (auth.uid() = p_user_id or public.current_user_has_any_role(array['admin']) or public.current_profile_role_key() = 'admin') then
    raise exception 'Only Admin (or the officer themself) can change availability.';
  end if;

  insert into public.reqgen_officer_availability (user_id, is_away, away_from, away_until, note, updated_at, updated_by)
  values (p_user_id, p_is_away, p_from, p_until, nullif(trim(p_note), ''), now(), auth.uid())
  on conflict (user_id) do update
    set is_away = excluded.is_away, away_from = excluded.away_from, away_until = excluded.away_until,
        note = excluded.note, updated_at = now(), updated_by = auth.uid();

  if not p_is_away or public.reqgen_is_available(p_user_id) then
    return 0; -- available, or away only in the future: nothing to move yet
  end if;

  select full_name into v_name from public.profiles where id = p_user_id;

  for v_req in
    select r.id, r.dept_id, r.current_stage, r.request_no
    from public.requests r
    where r.current_owner = p_user_id
      and public.reqgen_key(r.current_stage) not in ('account', 'completed', 'rejected', 'deleted', 'cancelled', 'submitted')
    for update
  loop
    v_new := public.reqgen_resolve_stage_owner(v_req.dept_id, v_req.current_stage, p_user_id);
    if v_new is null or v_new = p_user_id or not public.reqgen_is_available(v_new) then continue; end if;

    update public.requests set current_owner = v_new, updated_at = now() where id = v_req.id;
    select full_name into v_new_name from public.profiles where id = v_new;

    insert into public.request_history (request_id, action_type, action_by, actor_name, actor_role_key, actor_role_name, from_stage, to_stage, comment, created_at)
    values (v_req.id, 'Reassigned', auth.uid(), 'ReqGen Routing Engine', 'system', 'Routing Engine',
            v_req.current_stage, v_req.current_stage,
            'Reassigned from ' || coalesce(v_name, 'officer') || ' (away) to backup ' || coalesce(v_new_name, 'officer') || '.',
            now());

    insert into public.notifications (user_id, title, message, link, is_read, created_at)
    values (v_new, 'Request reassigned to you',
            'Request ' || coalesce(v_req.request_no, '') || ' at ' || v_req.current_stage || ' stage was reassigned to you while '
              || coalesce(v_name, 'the primary officer') || ' is away.',
            '/requests/' || v_req.id::text, false, now());
    v_moved := v_moved + 1;
  end loop;

  return v_moved;
end;
$fn$;

-- Snapshot + "block if vacant" check at submission.
create or replace function public.reqgen_request_route_snapshot()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_first_order int;
  v_block record;
begin
  if new.route_template_id is null then
    new.route_template_id := public.reqgen_template_for_department(new.dept_id);
  end if;

  if tg_op = 'INSERT' and new.current_stage is not null then
    select br.step_order into v_first_order
    from public.reqgen_build_route_for_template(new.route_template_id, new.dept_id, new.request_type, new.personal_category) br
    where public.reqgen_key(br.stage) = public.reqgen_key(new.current_stage)
    order by br.step_order limit 1;

    select br.stage into v_block
    from public.reqgen_build_route_for_template(new.route_template_id, new.dept_id, new.request_type, new.personal_category) br
    where br.step_order < coalesce(v_first_order, 0)
      and br.if_vacant = 'block' and br.owner_id is null and public.reqgen_key(br.stage) <> 'account'
    order by br.step_order limit 1;

    if found then
      raise exception 'Routing incomplete: no officer is assigned to the % step for this department. Ask Admin to complete Routing Engine settings.', v_block.stage;
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_reqgen_request_route_snapshot on public.requests;
create trigger trg_reqgen_request_route_snapshot
  before insert on public.requests
  for each row execute function public.reqgen_request_route_snapshot();

-- Requests already in progress keep the route they started on (their
-- department's ORIGINAL group), even if their department is moved today.
update public.requests r
set route_template_id = (
  select t.id from public.reqgen_route_templates t
  where t.code = coalesce(nullif(public.reqgen_department_group(d.name), ''), 'GENERAL_ADMIN')
)
from public.departments d
where d.id = r.dept_id and r.route_template_id is null;

-- Grants
revoke all on function public.reqgen_save_route(uuid, text, text[], text[]) from public, anon;
revoke all on function public.reqgen_set_officer_availability(uuid, boolean, date, date, text) from public, anon;
grant execute on function public.reqgen_save_route(uuid, text, text[], text[]) to authenticated;
grant execute on function public.reqgen_set_officer_availability(uuid, boolean, date, date, text) to authenticated;
grant execute on function public.reqgen_route_preview(uuid, text, text) to authenticated;
grant execute on function public.reqgen_stage_candidates(uuid, text) to authenticated;
grant execute on function public.reqgen_resolve_stage_owner(uuid, text, uuid) to authenticated;
grant execute on function public.reqgen_is_available(uuid, date) to authenticated;
grant execute on function public.build_request_route(uuid, text, text) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- 4. Verification — every row should read OK
-- ---------------------------------------------------------------------------
select 'templates seeded (5)' as check_item,
       case when (select count(*) from public.reqgen_route_templates) >= 5 then 'OK' else 'MISSING' end as status
union all
select 'every template has all 3 routes',
       case when not exists (
         select 1 from public.reqgen_route_templates t
         where (select count(distinct route_kind) from public.reqgen_route_steps s where s.template_id = t.id) < 3
       ) then 'OK' else 'CHECK' end
union all
select 'every department has a route',
       case when not exists (select 1 from public.departments d where not exists (select 1 from public.reqgen_department_routes x where x.dept_id = d.id))
            then 'OK' else 'CHECK' end
union all
select 'open requests keep their original route',
       case when not exists (select 1 from public.requests r where r.route_template_id is null and r.dept_id is not null) then 'OK' else 'CHECK' end
union all
select 'GENSEC set as DG backup',
       case when exists (select 1 from public.reqgen_stage_backups where stage = 'DG' and dept_id is null) then 'OK'
            else 'INFO: no GENSEC_USER_ID in System Settings' end
union all
select 'route of ' || d.name, string_agg(br.stage, ' → ' order by br.step_order)
from public.departments d
cross join lateral public.build_request_route(d.id, 'Official', null) br
where upper(trim(d.name)) in ('ABUJA IET', 'DIN MEDIA', 'GENERAL ADMIN', 'ASAP-ALLI')
group by d.name;
