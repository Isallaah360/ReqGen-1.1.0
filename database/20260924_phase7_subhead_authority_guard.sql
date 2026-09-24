-- ReqGen v2.0.0.8 Phase 7 architecture stabilisation
-- Enforce the locked subhead-assignment authority at the database boundary.
-- Allowed active roles: Director, DIN/Dean Admin, HOD, Registrar, HR.
-- Explicitly excluded: DG, Admin, Auditor, Finance/Account roles and Staff.

create or replace function public.reqgen_enforce_subhead_assignment_authority()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_active_role text;
begin
  -- This trigger is concerned only with assigning/changing a non-null subhead.
  if new.subhead_id is not distinct from old.subhead_id or new.subhead_id is null then
    return new;
  end if;

  -- Allow controlled SQL/service maintenance where there is no end-user JWT.
  -- Application RPC/browser calls have auth.uid() and must pass the role gate below.
  if v_actor is null then
    return new;
  end if;

  select lower(regexp_replace(coalesce(uar.active_role_key, ''), '[^a-z0-9]+', '', 'g'))
    into v_active_role
  from public.user_active_roles uar
  where uar.user_id = v_actor
  limit 1;

  if v_active_role = 'deanadmin' then
    v_active_role := 'dinadmin';
  end if;

  if coalesce(v_active_role, '') not in ('director', 'dinadmin', 'hod', 'registrar', 'hr') then
    raise exception 'Subhead assignment is restricted to Director, DIN/Dean Admin, HOD, Registrar or HR while operating in that active role.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reqgen_subhead_assignment_authority on public.requests;
create trigger trg_reqgen_subhead_assignment_authority
before update of subhead_id
on public.requests
for each row execute function public.reqgen_enforce_subhead_assignment_authority();
