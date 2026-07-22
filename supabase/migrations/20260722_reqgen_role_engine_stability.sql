-- =====================================================================
-- ReqGen 1.1.1
-- ROLE ENGINE STABILITY MIGRATION
--
-- Purpose:
--   1. Remove the obsolete hardcoded profiles.role CHECK constraint.
--   2. Preserve profiles.role as the legacy primary-role fallback.
--   3. Make reqgen_roles the official role catalogue.
--   4. Stabilise multiple-role assignment.
--   5. Stabilise primary-role changes.
--   6. Stabilise role deactivation.
--   7. Protect the last active role.
--   8. Restrict role management to Admin and Auditor.
--
-- This migration does not delete users or existing role assignments.
-- =====================================================================

begin;

-- =====================================================================
-- SECTION 1
-- Remove obsolete profiles.role CHECK constraints
-- =====================================================================

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select
      con.conname
    from pg_constraint con
    join pg_class rel
      on rel.oid = con.conrelid
    join pg_namespace nsp
      on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'profiles'
      and con.contype = 'c'
      and (
        con.conname = 'profiles_role_check'
        or pg_get_constraintdef(con.oid) ilike '%role%'
      )
  loop
    execute format(
      'alter table public.profiles drop constraint if exists %I',
      constraint_row.conname
    );
  end loop;
end
$$;

-- profiles.role remains nullable text.
-- It is now a legacy fallback/primary-role display field.
alter table public.profiles
  alter column role drop not null;

-- =====================================================================
-- SECTION 2
-- Normalise role catalogue values
-- =====================================================================

update public.reqgen_roles
set
  role_key = trim(role_key),
  role_name = trim(role_name)
where
  role_key is distinct from trim(role_key)
  or role_name is distinct from trim(role_name);

-- Prevent blank role catalogue entries.
alter table public.reqgen_roles
  drop constraint if exists reqgen_roles_role_key_not_blank;

alter table public.reqgen_roles
  add constraint reqgen_roles_role_key_not_blank
  check (length(trim(role_key)) >= 2);

alter table public.reqgen_roles
  drop constraint if exists reqgen_roles_role_name_not_blank;

alter table public.reqgen_roles
  add constraint reqgen_roles_role_name_not_blank
  check (length(trim(role_name)) >= 2);

-- Ensure role keys are unique regardless of letter case.
create unique index if not exists reqgen_roles_role_key_lower_uidx
  on public.reqgen_roles (lower(trim(role_key)));

-- =====================================================================
-- SECTION 3
-- Normalise existing profile role assignments
-- =====================================================================

update public.profile_roles pr
set
  role_key = rr.role_key,
  role_name = rr.role_name
from public.reqgen_roles rr
where lower(trim(pr.role_key)) = lower(trim(rr.role_key))
  and (
    pr.role_key is distinct from rr.role_key
    or pr.role_name is distinct from rr.role_name
  );

-- Only one active assignment for a specific role per user.
create unique index if not exists profile_roles_active_role_uidx
  on public.profile_roles (
    profile_id,
    lower(trim(role_key))
  )
  where is_active = true;

-- Only one active primary role per user.
create unique index if not exists profile_roles_one_primary_uidx
  on public.profile_roles (profile_id)
  where is_active = true
    and is_primary = true;

-- =====================================================================
-- SECTION 4
-- Helper: check whether the current user may manage roles
-- =====================================================================

create or replace function public.reqgen_current_user_can_manage_roles()
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  caller_id uuid;
begin
  caller_id := auth.uid();

  if caller_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = caller_id
      and lower(
        regexp_replace(
          coalesce(p.role, ''),
          '[^a-zA-Z0-9]',
          '',
          'g'
        )
      ) in ('admin', 'auditor')
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.profile_roles pr
    where pr.profile_id = caller_id
      and pr.is_active = true
      and lower(
        regexp_replace(
          coalesce(pr.role_key, ''),
          '[^a-zA-Z0-9]',
          '',
          'g'
        )
      ) in ('admin', 'auditor')
  ) then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.reqgen_current_user_can_manage_roles()
from public;

grant execute on function public.reqgen_current_user_can_manage_roles()
to authenticated;

-- =====================================================================
-- SECTION 5
-- Assign or reactivate a role
-- =====================================================================

create or replace function public.reqgen_assign_profile_role(
  p_profile_id uuid,
  p_role_key text,
  p_is_primary boolean default false
)
returns public.profile_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role public.reqgen_roles%rowtype;
  target_profile public.profiles%rowtype;
  existing_assignment public.profile_roles%rowtype;
  saved_assignment public.profile_roles%rowtype;
  active_role_count integer;
begin
  if not public.reqgen_current_user_can_manage_roles() then
    raise exception 'Only Admin or Auditor can assign official roles.';
  end if;

  if p_profile_id is null then
    raise exception 'Profile ID is required.';
  end if;

  if nullif(trim(p_role_key), '') is null then
    raise exception 'Role key is required.';
  end if;

  select *
  into target_profile
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'The selected user profile was not found.';
  end if;

  select *
  into selected_role
  from public.reqgen_roles
  where lower(trim(role_key)) = lower(trim(p_role_key))
    and is_active = true
  limit 1;

  if not found then
    raise exception
      'The selected role does not exist or is inactive: %',
      p_role_key;
  end if;

  if selected_role.requires_signature
     and nullif(trim(coalesce(target_profile.signature_url, '')), '') is null
  then
    raise exception
      '% requires the user to upload a signature before assignment.',
      selected_role.role_name;
  end if;

  select count(*)
  into active_role_count
  from public.profile_roles
  where profile_id = p_profile_id
    and is_active = true;

  -- First active role automatically becomes primary.
  if active_role_count = 0 then
    p_is_primary := true;
  end if;

  if p_is_primary then
    update public.profile_roles
    set is_primary = false
    where profile_id = p_profile_id
      and is_active = true;
  end if;

  select *
  into existing_assignment
  from public.profile_roles
  where profile_id = p_profile_id
    and lower(trim(role_key)) = lower(trim(selected_role.role_key))
  order by assigned_at desc nulls last
  limit 1
  for update;

  if found then
    update public.profile_roles
    set
      role_key = selected_role.role_key,
      role_name = selected_role.role_name,
      is_active = true,
      is_primary = p_is_primary,
      assigned_at = coalesce(assigned_at, now())
    where id = existing_assignment.id
    returning *
    into saved_assignment;
  else
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
      selected_role.role_key,
      selected_role.role_name,
      p_is_primary,
      true,
      now()
    )
    returning *
    into saved_assignment;
  end if;

  if saved_assignment.is_primary then
    update public.profiles
    set
      role = selected_role.role_name,
      updated_at = now()
    where id = p_profile_id;
  end if;

  return saved_assignment;
end;
$$;

revoke all on function public.reqgen_assign_profile_role(
  uuid,
  text,
  boolean
) from public;

grant execute on function public.reqgen_assign_profile_role(
  uuid,
  text,
  boolean
) to authenticated;

-- =====================================================================
-- SECTION 6
-- Set an already-assigned active role as primary
-- =====================================================================

create or replace function public.reqgen_set_primary_profile_role(
  p_profile_id uuid,
  p_role_key text
)
returns public.profile_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_assignment public.profile_roles%rowtype;
  selected_role public.reqgen_roles%rowtype;
  target_profile public.profiles%rowtype;
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

  select *
  into target_profile
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'The selected user profile was not found.';
  end if;

  select *
  into selected_assignment
  from public.profile_roles
  where profile_id = p_profile_id
    and lower(trim(role_key)) = lower(trim(p_role_key))
    and is_active = true
  limit 1
  for update;

  if not found then
    raise exception
      'The selected role is not an active assignment for this user.';
  end if;

  select *
  into selected_role
  from public.reqgen_roles
  where lower(trim(role_key)) =
        lower(trim(selected_assignment.role_key))
    and is_active = true
  limit 1;

  if not found then
    raise exception
      'The selected role is no longer active in the role catalogue.';
  end if;

  if selected_role.requires_signature
     and nullif(trim(coalesce(target_profile.signature_url, '')), '') is null
  then
    raise exception
      '% requires the user to upload a signature before it can become primary.',
      selected_role.role_name;
  end if;

  update public.profile_roles
  set is_primary = false
  where profile_id = p_profile_id
    and is_active = true;

  update public.profile_roles
  set
    role_key = selected_role.role_key,
    role_name = selected_role.role_name,
    is_primary = true
  where id = selected_assignment.id
  returning *
  into selected_assignment;

  update public.profiles
  set
    role = selected_role.role_name,
    updated_at = now()
  where id = p_profile_id;

  return selected_assignment;
end;
$$;

revoke all on function public.reqgen_set_primary_profile_role(
  uuid,
  text
) from public;

grant execute on function public.reqgen_set_primary_profile_role(
  uuid,
  text
) to authenticated;

-- =====================================================================
-- SECTION 7
-- Deactivate a role safely
-- =====================================================================

create or replace function public.reqgen_deactivate_profile_role(
  p_profile_id uuid,
  p_role_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_assignment public.profile_roles%rowtype;
  replacement_assignment public.profile_roles%rowtype;
  active_role_count integer;
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

  select *
  into target_assignment
  from public.profile_roles
  where profile_id = p_profile_id
    and lower(trim(role_key)) = lower(trim(p_role_key))
    and is_active = true
  limit 1
  for update;

  if not found then
    raise exception
      'The selected active role assignment was not found.';
  end if;

  select count(*)
  into active_role_count
  from public.profile_roles
  where profile_id = p_profile_id
    and is_active = true;

  if active_role_count <= 1 then
    raise exception
      'A user must retain at least one active role.';
  end if;

  update public.profile_roles
  set
    is_active = false,
    is_primary = false
  where id = target_assignment.id;

  if target_assignment.is_primary then
    select pr.*
    into replacement_assignment
    from public.profile_roles pr
    left join public.reqgen_roles rr
      on lower(trim(rr.role_key)) =
         lower(trim(pr.role_key))
    where pr.profile_id = p_profile_id
      and pr.is_active = true
    order by
      coalesce(rr.sort_order, 999999),
      pr.assigned_at,
      pr.role_name
    limit 1
    for update;

    if not found then
      raise exception
        'No replacement active role could be selected.';
    end if;

    update public.profile_roles
    set is_primary = false
    where profile_id = p_profile_id
      and is_active = true;

    update public.profile_roles
    set is_primary = true
    where id = replacement_assignment.id;

    update public.profiles
    set
      role = replacement_assignment.role_name,
      updated_at = now()
    where id = p_profile_id;
  end if;
end;
$$;

revoke all on function public.reqgen_deactivate_profile_role(
  uuid,
  text
) from public;

grant execute on function public.reqgen_deactivate_profile_role(
  uuid,
  text
) to authenticated;

-- =====================================================================
-- SECTION 8
-- Repair users with multiple primary assignments
-- =====================================================================

with ranked_primary_roles as (
  select
    id,
    profile_id,
    row_number() over (
      partition by profile_id
      order by assigned_at asc nulls last, id
    ) as primary_rank
  from public.profile_roles
  where is_active = true
    and is_primary = true
)
update public.profile_roles pr
set is_primary = false
from ranked_primary_roles ranked
where pr.id = ranked.id
  and ranked.primary_rank > 1;

-- =====================================================================
-- SECTION 9
-- Give users without a primary role one safe primary role
-- =====================================================================

with replacement_roles as (
  select distinct on (pr.profile_id)
    pr.id,
    pr.profile_id,
    pr.role_name
  from public.profile_roles pr
  left join public.reqgen_roles rr
    on lower(trim(rr.role_key)) =
       lower(trim(pr.role_key))
  where pr.is_active = true
    and not exists (
      select 1
      from public.profile_roles current_primary
      where current_primary.profile_id = pr.profile_id
        and current_primary.is_active = true
        and current_primary.is_primary = true
    )
  order by
    pr.profile_id,
    coalesce(rr.sort_order, 999999),
    pr.assigned_at,
    pr.id
)
update public.profile_roles pr
set is_primary = true
from replacement_roles replacement
where pr.id = replacement.id;

-- Synchronise profiles.role with active primary assignments.
update public.profiles p
set
  role = primary_role.role_name,
  updated_at = now()
from public.profile_roles primary_role
where primary_role.profile_id = p.id
  and primary_role.is_active = true
  and primary_role.is_primary = true
  and p.role is distinct from primary_role.role_name;

-- =====================================================================
-- SECTION 10
-- Reload PostgREST schema cache
-- =====================================================================

notify pgrst, 'reload schema';

commit;