-- =============================================================================
-- ReqGen v3.1.5 — Payment Voucher signer fix + Account-stage queue repair
-- Run ONCE in the Supabase SQL Editor AFTER the v3.1.5 app is deployed.
-- Safe to re-run (every step checks whether it is already done).
--
-- PART 1  Fixes: Failed to generate voucher: record "v_cheque_signer" is not
--         assigned yet.
--         Cause: inside generate_multi_payment_voucher (and possibly other PV
--         functions) the cheque signer / counter signer RECORD is filled only
--         when the mode is Cheque, but it is read for every mode. With Transfer
--         or Cash the record was never assigned, so PostgreSQL stops.
--         Fix: each affected function is rewritten in place so those records
--         are initialised (empty) at the start of the function. The original
--         definition of every function changed is saved first in
--         public.reqgen_function_backups, so it can be restored exactly.
--
-- PART 2  Fixes the Approvals inconsistency for the Account stage: open
--         requests at Account with NO owner are given to the Account Officer
--         attached to them. Requests owned by a DIFFERENT officer than the one
--         attached are only LISTED (CHECK rows) for the owner to decide.
--
-- The last result is the verification table: every row should say OK
-- (CHECK rows in Part 2 are listed for review, see the note at the end).
-- =============================================================================

set lock_timeout = '10s';

begin;

-- ---------------------------------------------------------------------------
-- 0. Backup table for function definitions changed by ReqGen migrations
-- ---------------------------------------------------------------------------
create table if not exists public.reqgen_function_backups (
  id bigint generated always as identity primary key,
  function_name text not null,
  function_identity text not null,
  release text not null,
  definition text not null,
  saved_at timestamptz not null default now()
);
alter table public.reqgen_function_backups enable row level security;
revoke all on public.reqgen_function_backups from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Initialise signer records in every PL/pgSQL voucher function
-- ---------------------------------------------------------------------------
do $patch$
declare
  f record;
  v_def text;
  v_new text;
  v_var text;
  v_stmt text;
  v_init text;
  v_fallback text;
  v_fields text;
  v_marker constant text := '-- reqgen v3.1.5 record init';
begin
  for f in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
      and l.lanname = 'plpgsql'
      and p.proname ilike '%voucher%'
  loop
    v_def := pg_get_functiondef(f.oid);
    if position(v_marker in v_def) > 0 then
      continue; -- already patched
    end if;

    v_init := '';
    v_fallback := '';

    -- record variables for signers / counter signers, e.g. "v_cheque_signer record;"
    for v_var in
      select distinct lower(m[1])
      from regexp_matches(v_def, '\m(v_[a-z0-9_]*(?:sign|counter)[a-z0-9_]*)\s+record\s*;', 'gi') as m
    loop
      -- Preferred: re-use the function's own SELECT ... INTO <var> (without
      -- STRICT). Run at the start it finds no row for non-cheque modes and
      -- leaves the record EMPTY but correctly typed.
      v_stmt := substring(v_def from ('(?i)\mselect\M[^;]*?\minto\s+(?:strict\s+)?' || v_var || '\M[^;]*;'));
      if v_stmt is not null then
        v_stmt := regexp_replace(v_stmt, '\minto\s+strict\M', 'into', 'gi');
        v_init := v_init || E'\n  begin\n    ' || v_stmt || E'\n  exception when others then null;\n  end;';
      end if;

      -- Fallback: an empty record with every field the function reads.
      select string_agg(
               case when fld = 'id' or fld like '%\_id' escape '\' then 'null::uuid as ' || quote_ident(fld)
                    else 'null::text as ' || quote_ident(fld) end, ', ')
        into v_fields
      from (select distinct lower(m[1]) as fld
            from regexp_matches(v_def, '\m' || v_var || '\.([a-z0-9_]+)', 'gi') as m) x;
      v_fallback := v_fallback || E'\n  select ' || coalesce(v_fields, 'null::uuid as id') || ' into ' || v_var || ';';
    end loop;

    if v_init = '' and v_fallback = '' then
      continue; -- nothing to fix in this function
    end if;

    insert into public.reqgen_function_backups (function_name, function_identity, release, definition)
    values (f.proname, f.proname || '(' || f.args || ')', 'v3.1.5', v_def);

    -- Attempt 1: the function's own statements (typed exactly as the function uses them).
    if v_init <> '' then
      v_new := regexp_replace(
        v_def,
        '(\mdeclare\M.*?\mbegin\M)',
        E'\\1\n  ' || replace(replace(v_marker || v_init, '\', '\\'), '&', '\&') || E'\n',
        'i');
      begin
        execute v_new;
        raise notice 'ReqGen v3.1.5: % patched (typed init).', f.proname;
        continue;
      exception when others then
        raise notice 'ReqGen v3.1.5: % typed init not accepted (%), using fallback.', f.proname, sqlerrm;
      end;
    end if;

    -- Attempt 2: empty record with the fields the function reads.
    v_new := regexp_replace(
      v_def,
      '(\mdeclare\M.*?\mbegin\M)',
      E'\\1\n  ' || replace(replace(v_marker || v_fallback, '\', '\\'), '&', '\&') || E'\n',
      'i');
    execute v_new;
    raise notice 'ReqGen v3.1.5: % patched (fallback init).', f.proname;
  end loop;
end
$patch$;

-- ---------------------------------------------------------------------------
-- 2. Account stage: give un-owned open requests to their attached officer
-- ---------------------------------------------------------------------------
lock table public.requests in row exclusive mode;

update public.requests r
set current_owner = coalesce(r.assigned_account_officer_id, r.assigned_account_officer_user_id),
    updated_at = now()
where upper(regexp_replace(coalesce(r.current_stage, ''), '[\s_-]+', '', 'g')) = 'ACCOUNT'
  and r.current_owner is null
  and coalesce(r.assigned_account_officer_id, r.assigned_account_officer_user_id) is not null
  and (lower(coalesce(r.status, '')) like '%pending%'
       or lower(coalesce(r.status, '')) !~ '(paid|completed|closed|rejected|deleted|cancelled)');

commit;

-- ---------------------------------------------------------------------------
-- 3. Verification
-- ---------------------------------------------------------------------------
with pv as (
  select p.proname, pg_get_functiondef(p.oid) as def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
  where n.nspname = 'public' and l.lanname = 'plpgsql' and p.proname ilike '%voucher%'
),
open_account as (
  select r.request_no, r.current_owner,
         coalesce(r.assigned_account_officer_id, r.assigned_account_officer_user_id) as attached,
         (select coalesce(pr.full_name, '?') from public.profiles pr where pr.id = r.current_owner) as owner_name,
         (select coalesce(pr.full_name, '?') from public.profiles pr where pr.id = coalesce(r.assigned_account_officer_id, r.assigned_account_officer_user_id)) as attached_name
  from public.requests r
  where upper(regexp_replace(coalesce(r.current_stage, ''), '[\s_-]+', '', 'g')) = 'ACCOUNT'
    and (lower(coalesce(r.status, '')) like '%pending%'
         or lower(coalesce(r.status, '')) !~ '(paid|completed|closed|rejected|deleted|cancelled)')
)
select '1. generate_multi_payment_voucher exists' as check_item,
       case when exists (select 1 from pv where proname = 'generate_multi_payment_voucher') then 'OK' else 'CHECK' end as status,
       '' as detail
union all
select '2. Signer records initialised in ' || pv.proname,
       case when position('-- reqgen v3.1.5 record init' in pv.def) > 0 then 'OK' else 'CHECK' end,
       'function contains signer/counter record variables'
from pv
where pv.def ~* '\mv_[a-z0-9_]*(sign|counter)[a-z0-9_]*\s+record\s*;'
union all
select '3. Original definitions backed up',
       case when exists (select 1 from public.reqgen_function_backups where release = 'v3.1.5') then 'OK' else 'OK (nothing needed patching)' end,
       (select count(*)::text || ' function(s) saved' from public.reqgen_function_backups where release = 'v3.1.5')
union all
select '4. Open Account requests without an owner',
       case when exists (select 1 from open_account where current_owner is null and attached is not null) then 'CHECK' else 'OK' end,
       (select count(*)::text from open_account where current_owner is null)
union all
select '5. Owner differs from attached officer: ' || coalesce(o.request_no, '?'),
       'CHECK',
       'held by ' || coalesce(o.owner_name, '?') || ' — attached officer ' || coalesce(o.attached_name, '?')
from open_account o
where o.current_owner is not null and o.attached is not null and o.current_owner <> o.attached;

-- -----------------------------------------------------------------------------
-- NOTE on rows "5. Owner differs ...": these requests sit at the Account stage
-- with a different officer than the one now attached to the subhead's bank
-- account. ReqGen v3.1.5 shows them to the owner only. If the ATTACHED officer
-- should process them, run the statement below (remove the -- marks) and then
-- re-run this file's verification:
--
-- update public.requests r
-- set current_owner = coalesce(r.assigned_account_officer_id, r.assigned_account_officer_user_id), updated_at = now()
-- where upper(regexp_replace(coalesce(r.current_stage, ''), '[\s_-]+', '', 'g')) = 'ACCOUNT'
--   and r.current_owner is distinct from coalesce(r.assigned_account_officer_id, r.assigned_account_officer_user_id)
--   and coalesce(r.assigned_account_officer_id, r.assigned_account_officer_user_id) is not null
--   and (lower(coalesce(r.status, '')) like '%pending%'
--        or lower(coalesce(r.status, '')) !~ '(paid|completed|closed|rejected|deleted|cancelled)');
-- =============================================================================
