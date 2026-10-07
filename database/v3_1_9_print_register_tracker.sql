-- =============================================================================
-- ReqGen v3.1.9 — Print Register + Signing Tracker (replaces the v3.1.7 file)
-- Run in the Supabase SQL Editor. Safe to re-run, safe while staff are working.
--
-- Why the v3.1.7 file failed twice ("deadlock detected"):
--   The SQL Editor runs a whole script as ONE transaction. That file created
--   functions, then a trigger on payment_vouchers (which needs the strongest
--   lock), then updated vouchers — so it held locks on several tables at once
--   while the live app was reading them in the opposite order. PostgreSQL
--   cancelled it, and NOTHING was saved (hence "Could not find the function").
--
-- How this file avoids that:
--   PART 1  the Print Register and Tracker functions — creating functions takes
--           no table locks at all, so this part cannot deadlock. This is the
--           part that makes the Print Register and Pending Signatures work.
--   PART 2  the voucher trigger — its own short transaction touching ONE table.
--           If staff are busy it waits 5 seconds, then reports "busy — run the
--           file again" instead of failing.
--   PART 3  moves posted manual vouchers into the signing chain — same rule.
--   PART 4  verification table.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1 — functions (no table locks)
-- ---------------------------------------------------------------------------
begin;

create or replace function public.reqgen_print_register()
returns table(
  id uuid, request_no text, title text, amount numeric, status text, current_stage text,
  created_at timestamptz, request_type text, personal_category text,
  is_mine boolean, treated_by_me boolean, treated_by_accounts boolean,
  treated_at timestamptz, treated_by_name text, voucher_no text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_oversight boolean;
begin
  if v_uid is null then
    raise exception 'Authentication is required.';
  end if;
  v_oversight := public.reqgen_pv_user_has_role(v_uid, array['admin', 'auditor']);

  return query
  with treat as (
    select distinct on (h.request_id)
           h.request_id, h.action_by, h.actor_name, h.created_at
    from public.request_history h
    where lower(coalesce(h.from_stage, '')) like '%account%'
      and lower(coalesce(h.action_type, '')) !~ '(reject|return|declin|cancel|comment|attachment)'
    order by h.request_id, h.created_at desc
  ),
  mine_treat as (
    select distinct h.request_id
    from public.request_history h
    where h.action_by = v_uid
      and lower(coalesce(h.from_stage, '')) like '%account%'
      and lower(coalesce(h.action_type, '')) !~ '(reject|return|declin|cancel|comment|attachment)'
  ),
  pv as (
    select distinct on (i.request_id) i.request_id, v.voucher_no
    from public.payment_voucher_items i
    join public.payment_vouchers v on v.id = i.voucher_id
    where coalesce(v.status, '') <> 'Cancelled'
    order by i.request_id, v.created_at desc
  )
  -- v3.1.9: every column is cast to the declared type, so the function works
  -- whatever the exact column types are (varchar / text, integer / numeric,
  -- timestamp with or without time zone).
  select r.id::uuid, r.request_no::text, r.title::text, r.amount::numeric, r.status::text,
         r.current_stage::text, r.created_at::timestamptz,
         r.request_type::text, r.personal_category::text,
         coalesce(r.created_by = v_uid, false) as is_mine,
         (mt.request_id is not null) as treated_by_me,
         (t.request_id is not null) as treated_by_accounts,
         t.created_at::timestamptz as treated_at,
         t.actor_name::text as treated_by_name,
         pv.voucher_no::text
  from public.requests r
  left join treat t on t.request_id = r.id
  left join mine_treat mt on mt.request_id = r.id
  left join pv on pv.request_id = r.id
  where lower(coalesce(r.status, '')) !~ '(reject|delete|cancel|withdraw)'
    and (
      (r.created_by = v_uid and (
          lower(coalesce(r.current_stage, '')) in ('completed', 'hr filing', 'hrfiling')
          or lower(coalesce(r.status, '')) ~ '(paid|completed|closed|treated|filed|approved)'
          or t.request_id is not null))
      or mt.request_id is not null
      or (v_oversight and t.request_id is not null)
    )
  order by coalesce(t.created_at, r.created_at) desc;
end;
$$;

grant execute on function public.reqgen_print_register() to authenticated;

create or replace function public.reqgen_pv_tracker()
returns table(
  id uuid, voucher_no text, payee_name text, amount numeric, disbursement_mode text,
  voucher_type text, status text, step_no integer, waiting_with text,
  prepared_by_name text, checked_by_name text, cheque_signed_by_name text,
  cheque_counter_signed_by_name text, created_at timestamptz,
  waiting_since timestamptz, last_reminder_at timestamptz, reminder_count integer
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'auditor', 'account', 'accounts', 'accountofficer']) then
    raise exception 'Only Account Officers, the Auditor and Admin can view the signing tracker.';
  end if;

  return query
  select v.id::uuid, v.voucher_no::text, v.payee_name::text, coalesce(v.total_amount, v.amount)::numeric, v.disbursement_mode::text,
         coalesce(v.voucher_type, 'Request')::text, v.status::text,
         case v.status
           when 'Pending Check' then 2
           when 'Pending Cheque Signature' then 3
           when 'Pending Counter Signature' then 4
           when 'Pending DG Authorisation' then 5
           else 1 end::integer,
         (case v.status
           when 'Pending Check' then
             case when v.cheque_signed_by is null or v.cheque_counter_signed_by is null
                  then 'Account Officer (assign signers)' else 'Auditor (check)' end
           when 'Pending Cheque Signature' then coalesce(v.cheque_signed_by_name, 'Cheque Signer')
           when 'Pending Counter Signature' then coalesce(v.cheque_counter_signed_by_name, 'Counter Signer')
           when 'Pending DG Authorisation' then 'Director General'
           else v.status end)::text,
         v.prepared_by_name::text, v.checked_by_name::text, v.cheque_signed_by_name::text, v.cheque_counter_signed_by_name::text,
         v.created_at::timestamptz,
         coalesce((select max(h.created_at) from public.payment_voucher_history h
                   where h.voucher_id = v.id and h.to_status = v.status and h.action_type <> 'Reminder'),
                  v.updated_at, v.created_at)::timestamptz,
         (select max(h.created_at) from public.payment_voucher_history h
          where h.voucher_id = v.id and h.action_type = 'Reminder')::timestamptz,
         (select count(*)::integer from public.payment_voucher_history h
          where h.voucher_id = v.id and h.action_type = 'Reminder' and h.from_status = v.status)
  from public.payment_vouchers v
  where v.status like 'Pending%'
  order by v.created_at asc;
end;
$$;

grant execute on function public.reqgen_pv_tracker() to authenticated;

create or replace function public.reqgen_pv_before_write()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_sig text;
  v_manual boolean := coalesce(new.voucher_type, '') = 'Manual' or coalesce(new.voucher_origin, '') = 'Manual';
begin
  -- Attach the preparer's saved signature.
  if new.prepared_by is not null and coalesce(trim(new.prepared_signature_url), '') = '' then
    select nullif(trim(coalesce(p.signature_url, '')), '') into v_sig
    from public.profiles p where p.id = new.prepared_by;
    new.prepared_signature_url := v_sig;
  end if;

  -- No voucher is created or posted without the preparer's signature.
  if (tg_op = 'INSERT'
      or (new.status is distinct from old.status and new.status in ('Posted', 'Pending Check')))
     and coalesce(new.status, '') not in ('Cancelled', 'Paid')
     and coalesce(trim(new.prepared_signature_url), '') = '' then
    raise exception 'Your signature is missing. Upload your signature on your Profile page before preparing a payment voucher.';
  end if;

  if tg_op = 'UPDATE' and v_manual then
    -- A posted manual voucher is locked.
    if old.posted_at is not null and (
         new.amount is distinct from old.amount
      or new.total_amount is distinct from old.total_amount
      or new.account_id is distinct from old.account_id
      or new.subhead_id is distinct from old.subhead_id
      or new.payee_name is distinct from old.payee_name) then
      raise exception 'A posted manual voucher cannot be changed.';
    end if;

    -- Posting sends the voucher into the signing chain.
    if new.status = 'Posted' and old.status is distinct from 'Posted' then
      new.status := 'Pending Check';
      new.signing_stage := 'Awaiting Check';
      new.current_signing_owner := null;
      new.posted_at := coalesce(new.posted_at, now());
      perform public.reqgen_pv_notify_role(
        array['auditor'],
        'Manual PV ' || coalesce(new.voucher_no, '') || ' is waiting for your check',
        '/payment-vouchers/' || new.id::text);
    end if;
  end if;

  return new;
end;
$$;


commit;

-- ---------------------------------------------------------------------------
-- PART 2 — trigger on payment_vouchers (one table, short, never deadlocks)
-- ---------------------------------------------------------------------------
begin;
do $part2$
begin
  set local lock_timeout = '5s';
  if not exists (
    select 1 from pg_trigger
    where tgname = 'reqgen_pv_before_write'
      and tgrelid = 'public.payment_vouchers'::regclass
      and not tgisinternal
  ) then
    execute 'create trigger reqgen_pv_before_write
             before insert or update on public.payment_vouchers
             for each row execute function public.reqgen_pv_before_write()';
    raise notice 'ReqGen v3.1.9: voucher trigger created.';
  else
    raise notice 'ReqGen v3.1.9: voucher trigger already present (function updated).';
  end if;
exception
  when lock_not_available or deadlock_detected then
    raise notice 'ReqGen v3.1.9: payment_vouchers is busy right now — PART 2 skipped. Run this file again in a quiet moment.';
end
$part2$;
commit;

-- ---------------------------------------------------------------------------
-- PART 3 — posted manual vouchers join the signing chain
-- ---------------------------------------------------------------------------
begin;
do $part3$
declare
  v_moved integer := 0;
begin
  set local lock_timeout = '5s';
  with moved as (
    update public.payment_vouchers v set
      status = 'Pending Check', signing_stage = 'Awaiting Check', current_signing_owner = null,
      updated_at = now()
    where (coalesce(v.voucher_type, '') = 'Manual' or coalesce(v.voucher_origin, '') = 'Manual')
      and v.status = 'Posted'
      and coalesce(trim(v.prepared_signature_url), '') <> ''
    returning v.id
  ), logged as (
    insert into public.payment_voucher_history (voucher_id, actor_name, actor_role, action_type, from_status, to_status, comment)
    select m.id, 'ReqGen', 'System', 'Joined signing chain', 'Posted', 'Pending Check',
           'Posted manual vouchers are checked and signed like request vouchers.'
    from moved m
    returning 1
  )
  select count(*) into v_moved from logged;
  raise notice 'ReqGen v3.1.9: % posted manual voucher(s) moved into the signing chain.', v_moved;
exception
  when lock_not_available or deadlock_detected then
    raise notice 'ReqGen v3.1.9: vouchers are busy right now — PART 3 skipped. Run this file again in a quiet moment.';
end
$part3$;
commit;

-- ---------------------------------------------------------------------------
-- PART 4 — verification (read only)
-- ---------------------------------------------------------------------------
select '1. Print Register function' as check_item,
       case when to_regprocedure('public.reqgen_print_register()') is not null then 'OK' else 'CHECK' end as status,
       '' as detail
union all select '2. Signing tracker function',
       case when to_regprocedure('public.reqgen_pv_tracker()') is not null then 'OK' else 'CHECK' end, ''
union all select '3. Voucher trigger (preparer signature, manual chain)',
       case when exists (select 1 from pg_trigger where tgname = 'reqgen_pv_before_write' and not tgisinternal) then 'OK'
            else 'CHECK' end,
       case when exists (select 1 from pg_trigger where tgname = 'reqgen_pv_before_write' and not tgisinternal) then ''
            else 'Vouchers were busy: run this file again' end
union all select '4. Requests treated by Accounts (Print Register)', 'OK',
       (select count(distinct h.request_id)::text from public.request_history h where lower(coalesce(h.from_stage, '')) like '%account%')
union all select '5. Vouchers waiting for signatures', 'OK',
       (select count(*)::text from public.payment_vouchers where status like 'Pending%')
union all select '6. Posted manual voucher without a preparer signature: ' || coalesce(v.voucher_no, '?'), 'CHECK',
       'The preparer must upload a signature; then run this file again.'
from public.payment_vouchers v
where (coalesce(v.voucher_type, '') = 'Manual' or coalesce(v.voucher_origin, '') = 'Manual')
  and v.status = 'Posted';
