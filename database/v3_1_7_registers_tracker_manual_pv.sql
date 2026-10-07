-- =============================================================================
-- ReqGen v3.1.7 (rev 2) — Print Register, PV signing tracker, manual vouchers in the
-- signing chain, and "no voucher without the preparer's signature".
-- Run ONCE in the Supabase SQL Editor AFTER the v3.1.7 app is deployed.
-- Safe to re-run. The last result is the verification table.
--
-- 1. reqgen_print_register()   one trusted list for Requests -> 3. Print Register
--      * every requester: their own completed requests
--      * Account Officers: every request they treated at the Account stage,
--        whether or not a payment voucher exists yet
--      * Auditor / Admin: every request treated by Accounts
-- 2. reqgen_pv_tracker()       Payment Vouchers -> 2. Pending Signatures: where each
--      voucher is, who it is waiting for, since when, last reminder
-- 3. Trigger on payment_vouchers:
--      * the preparer's saved signature is attached automatically; a voucher
--        cannot be created or posted if the preparer has no signature
--      * a POSTED manual voucher enters the same signing chain (Pending Check)
--      * a posted manual voucher can no longer be edited
-- 4. Manual vouchers already posted (not paid / cancelled) join the chain.
-- =============================================================================

-- v3.1.7 rev 2: the first run hit a deadlock with live app traffic (the
-- trigger needs an exclusive lock on payment_vouchers). Rev 2 takes that lock
-- FIRST, before anything else, and waits at most 10 seconds for it. If you see
-- "lock timeout", simply run the file again in a quiet moment.

set lock_timeout = '10s';

begin;

lock table public.payment_vouchers in access exclusive mode;

-- ---------------------------------------------------------------------------
-- 1. Print Register
-- ---------------------------------------------------------------------------
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
  select r.id, r.request_no, r.title, r.amount, r.status, r.current_stage, r.created_at,
         r.request_type, r.personal_category,
         (r.created_by = v_uid) as is_mine,
         (mt.request_id is not null) as treated_by_me,
         (t.request_id is not null) as treated_by_accounts,
         t.created_at as treated_at,
         t.actor_name as treated_by_name,
         pv.voucher_no
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

-- ---------------------------------------------------------------------------
-- 2. Signing tracker
-- ---------------------------------------------------------------------------
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
  select v.id, v.voucher_no, v.payee_name, coalesce(v.total_amount, v.amount), v.disbursement_mode,
         coalesce(v.voucher_type, 'Request'), v.status,
         case v.status
           when 'Pending Check' then 2
           when 'Pending Cheque Signature' then 3
           when 'Pending Counter Signature' then 4
           when 'Pending DG Authorisation' then 5
           else 1 end,
         case v.status
           when 'Pending Check' then
             case when v.cheque_signed_by is null or v.cheque_counter_signed_by is null
                  then 'Account Officer (assign signers)' else 'Auditor (check)' end
           when 'Pending Cheque Signature' then coalesce(v.cheque_signed_by_name, 'Cheque Signer')
           when 'Pending Counter Signature' then coalesce(v.cheque_counter_signed_by_name, 'Counter Signer')
           when 'Pending DG Authorisation' then 'Director General'
           else v.status end,
         v.prepared_by_name, v.checked_by_name, v.cheque_signed_by_name, v.cheque_counter_signed_by_name,
         v.created_at,
         coalesce((select max(h.created_at) from public.payment_voucher_history h
                   where h.voucher_id = v.id and h.to_status = v.status and h.action_type <> 'Reminder'),
                  v.updated_at, v.created_at),
         (select max(h.created_at) from public.payment_voucher_history h
          where h.voucher_id = v.id and h.action_type = 'Reminder'),
         (select count(*)::integer from public.payment_voucher_history h
          where h.voucher_id = v.id and h.action_type = 'Reminder' and h.from_status = v.status)
  from public.payment_vouchers v
  where v.status like 'Pending%'
  order by v.created_at asc;
end;
$$;

grant execute on function public.reqgen_pv_tracker() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Preparer signature + manual vouchers into the chain
-- ---------------------------------------------------------------------------
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

drop trigger if exists reqgen_pv_before_write on public.payment_vouchers;
create trigger reqgen_pv_before_write
before insert or update on public.payment_vouchers
for each row execute function public.reqgen_pv_before_write();

-- ---------------------------------------------------------------------------
-- 4. Posted manual vouchers join the chain.
-- ---------------------------------------------------------------------------

with moved as (
  update public.payment_vouchers v set
    status = 'Pending Check', signing_stage = 'Awaiting Check', current_signing_owner = null,
    updated_at = now()
  where (coalesce(v.voucher_type, '') = 'Manual' or coalesce(v.voucher_origin, '') = 'Manual')
    and v.status = 'Posted'
    and coalesce(trim(v.prepared_signature_url), '') <> ''
  returning v.id
)
insert into public.payment_voucher_history (voucher_id, actor_name, actor_role, action_type, from_status, to_status, comment)
select m.id, 'ReqGen', 'System', 'Joined signing chain', 'Posted', 'Pending Check',
       'v3.1.7: posted manual vouchers are now checked and signed like request vouchers.'
from moved m;

commit;

-- ---------------------------------------------------------------------------
-- 5. Verification
-- ---------------------------------------------------------------------------
with fn as (
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
)
select '1. Print Register function' as check_item,
       case when exists (select 1 from fn where proname = 'reqgen_print_register') then 'OK' else 'CHECK' end as status,
       '' as detail
union all select '2. Signing tracker function',
       case when exists (select 1 from fn where proname = 'reqgen_pv_tracker') then 'OK' else 'CHECK' end, ''
union all select '3. Preparer-signature and manual-chain trigger',
       case when exists (select 1 from pg_trigger where tgname = 'reqgen_pv_before_write' and not tgisinternal) then 'OK' else 'CHECK' end, ''
union all select '4. Requests treated by Accounts (Print Register)', 'OK',
       (select count(distinct h.request_id)::text from public.request_history h where lower(coalesce(h.from_stage, '')) like '%account%')
union all select '5. Vouchers waiting for signatures', 'OK',
       (select count(*)::text from public.payment_vouchers where status like 'Pending%')
union all select '6. Manual vouchers posted without a preparer signature: ' || coalesce(v.voucher_no, '?'), 'CHECK',
       'The preparer must upload a signature; then an Admin can re-post or the Auditor can cancel it.'
from public.payment_vouchers v
where (coalesce(v.voucher_type, '') = 'Manual' or coalesce(v.voucher_origin, '') = 'Manual')
  and v.status = 'Posted';
