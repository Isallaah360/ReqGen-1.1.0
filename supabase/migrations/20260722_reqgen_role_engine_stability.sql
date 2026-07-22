-- =====================================================================
-- ReqGen 1.1.0
-- Stable multiple-role and primary-role engine
-- Migration: 20260722_reqgen_role_engine_stability.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Remove the obsolete profiles.role CHECK constraint.
--    profiles.role remains as a legacy fallback for older screens.
-- ---------------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_role_check;

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    join pg_class t
      on t.oid = c.conrelid
    join pg_namespace n
      on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'profiles'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%role%'
  loop
    execute format(
      'alter table public.profiles drop constraint if exists %I',
      v_constraint.conname
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Clean and normalize existing role-assignment records.
-- ---------------------------------------------------------------------

update public.profile_roles
set
  role_key = trim(role_key),
  role_name = coalesce(nullif(trim(role_name), ''), trim(role_key))
where role_key is not null;

-- Match existing assignments to the active role catalogue using a
-- punctuation-insensitive comparison.
update public.profile_roles pr
set
  role_key = rr.role_key,
  role_name = rr.role_name
from public.reqgen_roles rr
where regexp_replace(lower(coalesce(pr.role_key, '')), '[^a-z0-9]+', '', 'g')
    = regexp_replace(lower(coalesce(rr.role_key, '')), '[^a-z0-9]+', '', 'g');

-- Deactivate exact duplicate active assignments, keeping the oldest row.
with ranked_duplicates as (
  select
    id,
    row_number() over (
      partition by
        profile_id,
        regexp_replace(lower(coalesce(role_key, '')), '[^a-z0-9]+', '', 'g')
      order by
        coalesce(assigned_at, '1970-01-01'::timestamptz),
        id
    ) as row_number_in_group
  from public.profile_roles
  where is_active = true
)
update public.profile_roles pr
set
  is_active = false,
  is_primary = false
from ranked_duplicates rd
where pr.id = rd.id
  and rd.row_number_in_group > 1;

-- Keep only one active primary role per user.
with ranked_primaries as (
  select
    pr.id,
    row_number() over (
      partition by pr.profile_id
      order by
        case
          when regexp_replace(lower(coalesce(pr.role_key, '')), '[^a-z0-9]+', '', 'g')
             = regexp_replace(lower(coalesce(p.role, '')), '[^a-z0-9]+', '', 'g')
          then 0
          else 1
        end,
        coalesce(pr.assigned_at, '1970-01-01'::timestamptz),
        pr.id
    ) as primary_rank
  from public.profile_roles pr
  join public.profiles p
    on p.id = pr.profile_id
  where pr.is_active = true
    and pr.is_primary = true
)
update public.profile_roles pr
set is_primary = false
from ranked_primaries rp
where pr.id = rp.id
  and rp.primary_rank > 1;

-- Give every user with active roles one active primary role.
with users_without_primary as (
  select distinct pr.profile_id
  from public.profile_roles pr
  where pr.is_active = true
    and not exists (
      select 1
      from public.profile_roles existing_primary
      where existing_primary.profile_id = pr.profile_id
        and existing_primary.is_active = true
        and existing_primary.is_primary = true
    )
),
ranked_candidates as (
  select
    pr.id,
    row_number() over (
      partition by pr.profile_id
      order by
        case
          when regexp_replace(lower(coalesce(pr.role_key, '')), '[^a-z0-9]+', '', 'g')
             = regexp_replace(lower(coalesce(p.role, '')), '[^a-z0-9]+', '', 'g')
          then 0
          else 1
        end,
        coalesce(pr.assigned_at, '1970-01-01'::timestamptz),
        pr.id
    ) as candidate_rank
  from public.profile_roles pr
  join users_without_primary uwp
    on uwp.profile_id = pr.profile_id
  join public.profiles p
    on p.id = pr.profile_id
  where pr.is_active = true
)
update public.profile_roles pr
set is_primary = true
from ranked_candidates rc
where pr.id = rc.id
  and rc.candidate_rank = 1;

-- ---------------------------------------------------------------------
-- 3. Add stable uniqueness rules.
-- ---------------------------------------------------------------------

create unique index if not exists profile_roles_one_active_role_key_per_user_uidx
  on public.profile_roles (
    profile_id,
    regexp_replace(lower(coalesce(role_key, '')), '[^a-z0-9]+', '', 'g')
  )
  where is_active = true;

create unique index if not exists profile_roles_one_active_primary_per_user_uidx
  on public.profile_roles (profile_id)
  where is_active = true
    and is_primary = true;

-- ---------------------------------------------------------------------
-- 4. Keep profiles.role synchronized with the active primary role.
-- ---------------------------------------------------------------------

update public.profiles p
set role = primary_role.role_name
from (
  select distinct on (pr.profile_id)
    pr.profile_id,
    coalesce(nullif(pr.role_name, ''), pr.role_key) as role_name
  from public.profile_roles pr
  where pr.is_active = true
    and pr.is_primary = true
  order by
    pr.profile_id,
    coalesce(pr.assigned_at, '1970-01-01'::timestamptz),
    pr.id
) primary_role
where p.id = primary_role.profile_id
  and p.role is distinct from primary_role.role_name;

-- ---------------------------------------------------------------------
-- 5. Drop older RPC definitions before recreating them.
--    PostgreSQL cannot change a function return type with CREATE OR
--    REPLACE FUNCTION, so the old signatures must be dropped first.
-- ---------------------------------------------------------------------

drop function if exists public.reqgen_assign_profile_role(uuid, text, boolean);
drop function if exists public.reqgen_set_primary_profile_role(uuid, text);
drop function if exists public.reqgen_deactivate_profile_role(uuid, text);
drop function if exists public.reqgen_current_user_can_manage_roles();

-- ---------------------------------------------------------------------
-- 6. Authorization helper.
-- ---------------------------------------------------------------------

create function public.reqgen_current_user_can_manage_roles()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.profile_roles pr
        where pr.profile_id = auth.uid()
          and pr.is_active = true
          and regexp_replace(
                lower(coalesce(pr.role_key, '')),
                '[^a-z0-9]+',
                '',
                'g'
              ) in ('admin', 'auditor')
      )
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and regexp_replace(
                lower(coalesce(p.role, '')),
                '[^a-z0-9]+',
                '',
                'g'
              ) in ('admin', 'auditor')
      )
    );
$$;

revoke all on function public.reqgen_current_user_can_manage_roles() from public;
grant execute on function public.reqgen_current_user_can_manage_roles() to authenticated;

-- ---------------------------------------------------------------------
-- 7. Assign or reactivate a role.
-- ---------------------------------------------------------------------

create function public.reqgen_assign_profile_role(
  p_profile_id uuid,
  p_role_key text,
  p_is_primary boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role public.reqgen_roles%rowtype;
  v_profile public.profiles%rowtype;
  v_assignment_id uuid;
  v_make_primary boolean;
begin
  if not public.reqgen_current_user_can_manage_roles() then
    raise exception 'Only Admin or Auditor can assign roles.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile ID is required.';
  end if;

  if nullif(trim(p_role_key), '') is null then
    raise exception 'Role key is required.';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'User profile was not found.';
  end if;

  select *
  into v_role
  from public.reqgen_roles
  where is_active = true
    and (
      regexp_replace(lower(coalesce(role_key, '')), '[^a-z0-9]+', '', 'g')
        = regexp_replace(lower(trim(p_role_key)), '[^a-z0-9]+', '', 'g')
      or regexp_replace(lower(coalesce(role_name, '')), '[^a-z0-9]+', '', 'g')
        = regexp_replace(lower(trim(p_role_key)), '[^a-z0-9]+', '', 'g')
    )
  order by sort_order nulls last, role_name
  limit 1;

  if not found then
    raise exception 'The selected role does not exist or is inactive.';
  end if;

  if coalesce(v_role.requires_signature, false)
     and nullif(trim(coalesce(v_profile.signature_url, '')), '') is null then
    raise exception '% requires the user to upload a signature first.', v_role.role_name;
  end if;

  v_make_primary :=
    coalesce(p_is_primary, false)
    or not exists (
      select 1
      from public.profile_roles pr
      where pr.profile_id = p_profile_id
        and pr.is_active = true
        and pr.is_primary = true
    );

  if v_make_primary then
    update public.profile_roles
    set is_primary = false
    where profile_id = p_profile_id
      and is_active = true
      and is_primary = true;
  end if;

  update public.profile_roles
  set
    role_key = v_role.role_key,
    role_name = v_role.role_name,
    is_active = true,
    is_primary = v_make_primary,
    assigned_at = coalesce(assigned_at, now())
  where id = (
    select pr.id
    from public.profile_roles pr
    where pr.profile_id = p_profile_id
      and regexp_replace(lower(coalesce(pr.role_key, '')), '[^a-z0-9]+', '', 'g')
        = regexp_replace(lower(coalesce(v_role.role_key, '')), '[^a-z0-9]+', '', 'g')
    order by
      pr.is_active desc,
      coalesce(pr.assigned_at, '1970-01-01'::timestamptz),
      pr.id
    limit 1
  )
  returning id into v_assignment_id;

  if v_assignment_id is null then
    insert into public.profile_roles (
      profile_id,
      role_key,
      role_name,
      is_primary,
      is_active,
      assigned_at
    )
    values (
      p_profile_id,
      v_role.role_key,
      v_role.role_name,
      v_make_primary,
      true,
      now()
    )
    returning id into v_assignment_id;
  end if;

  if v_make_primary then
    update public.profiles
    set role = v_role.role_name
    where id = p_profile_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'assignment_id', v_assignment_id,
    'role_key', v_role.role_key,
    'role_name', v_role.role_name,
    'is_primary', v_make_primary
  );
end;
$$;

revoke all on function public.reqgen_assign_profile_role(uuid, text, boolean) from public;
grant execute on function public.reqgen_assign_profile_role(uuid, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Set an existing active role as primary.
-- ---------------------------------------------------------------------

create function public.reqgen_set_primary_profile_role(
  p_profile_id uuid,
  p_role_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_assignment public.profile_roles%rowtype;
begin
  if not public.reqgen_current_user_can_manage_roles() then
    raise exception 'Only Admin or Auditor can set primary roles.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile ID is required.';
  end if;

  if nullif(trim(p_role_key), '') is null then
    raise exception 'Role key is required.';
  end if;

  perform 1
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'User profile was not found.';
  end if;

  select pr.*
  into v_assignment
  from public.profile_roles pr
  where pr.profile_id = p_profile_id
    and pr.is_active = true
    and regexp_replace(lower(coalesce(pr.role_key, '')), '[^a-z0-9]+', '', 'g')
      = regexp_replace(lower(trim(p_role_key)), '[^a-z0-9]+', '', 'g')
  order by
    coalesce(pr.assigned_at, '1970-01-01'::timestamptz),
    pr.id
  limit 1
  for update;

  if not found then
    raise exception 'The selected role is not actively assigned to this user.';
  end if;

  update public.profile_roles
  set is_primary = false
  where profile_id = p_profile_id
    and is_active = true
    and is_primary = true;

  update public.profile_roles
  set is_primary = true
  where id = v_assignment.id;

  update public.profiles
  set role = coalesce(nullif(v_assignment.role_name, ''), v_assignment.role_key)
  where id = p_profile_id;

  return jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'assignment_id', v_assignment.id,
    'role_key', v_assignment.role_key,
    'role_name', v_assignment.role_name,
    'is_primary', true
  );
end;
$$;

revoke all on function public.reqgen_set_primary_profile_role(uuid, text) from public;
grant execute on function public.reqgen_set_primary_profile_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 9. Deactivate a role while preserving assignment history.
-- ---------------------------------------------------------------------

create function public.reqgen_deactivate_profile_role(
  p_profile_id uuid,
  p_role_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_assignment public.profile_roles%rowtype;
  v_replacement public.profile_roles%rowtype;
  v_active_role_count integer;
begin
  if not public.reqgen_current_user_can_manage_roles() then
    raise exception 'Only Admin or Auditor can deactivate roles.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile ID is required.';
  end if;

  if nullif(trim(p_role_key), '') is null then
    raise exception 'Role key is required.';
  end if;

  perform 1
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'User profile was not found.';
  end if;

  select count(*)
  into v_active_role_count
  from public.profile_roles pr
  where pr.profile_id = p_profile_id
    and pr.is_active = true;

  if v_active_role_count <= 1 then
    raise exception 'A user must keep at least one active role.';
  end if;

  select pr.*
  into v_assignment
  from public.profile_roles pr
  where pr.profile_id = p_profile_id
    and pr.is_active = true
    and regexp_replace(lower(coalesce(pr.role_key, '')), '[^a-z0-9]+', '', 'g')
      = regexp_replace(lower(trim(p_role_key)), '[^a-z0-9]+', '', 'g')
  order by
    coalesce(pr.assigned_at, '1970-01-01'::timestamptz),
    pr.id
  limit 1
  for update;

  if not found then
    raise exception 'The selected active role assignment was not found.';
  end if;

  update public.profile_roles
  set
    is_active = false,
    is_primary = false
  where id = v_assignment.id;

  if v_assignment.is_primary then
    select pr.*
    into v_replacement
    from public.profile_roles pr
    left join public.reqgen_roles rr
      on regexp_replace(lower(coalesce(rr.role_key, '')), '[^a-z0-9]+', '', 'g')
       = regexp_replace(lower(coalesce(pr.role_key, '')), '[^a-z0-9]+', '', 'g')
    where pr.profile_id = p_profile_id
      and pr.is_active = true
    order by
      coalesce(rr.sort_order, 999999),
      coalesce(pr.assigned_at, '1970-01-01'::timestamptz),
      pr.id
    limit 1
    for update of pr;

    if not found then
      raise exception 'A user must keep at least one active role.';
    end if;

    update public.profile_roles
    set is_primary = true
    where id = v_replacement.id;

    update public.profiles
    set role = coalesce(nullif(v_replacement.role_name, ''), v_replacement.role_key)
    where id = p_profile_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'assignment_id', v_assignment.id,
    'role_key', v_assignment.role_key,
    'role_name', v_assignment.role_name,
    'deactivated', true
  );
end;
$$;

revoke all on function public.reqgen_deactivate_profile_role(uuid, text) from public;
grant execute on function public.reqgen_deactivate_profile_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 10. Refresh PostgREST's schema cache.
-- ---------------------------------------------------------------------

notify pgrst, 'reload schema';

commit;
