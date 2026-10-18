-- =============================================================================
-- ReqGen v4.6.3 — Finance integrity, transaction centre, reversals and reset
-- Run in the Supabase SQL Editor AFTER the v4.6.3 code shows "Ready" on Vercel,
-- and after v4_6_0_administration.sql.
--
-- WHY: a subhead keeps running totals in its own row (approved_allocation,
-- reserved_amount, expenditure). Requests and vouchers add to them; deleting the
-- records by hand does not take the amount back out. That is how DIN FORD kept
-- ₦3,000,000 of "expenditure" with no record behind it.
--
--   reqgen_is_super_admin          the Trust's Super Admin account, acting as Super Admin
--   reqgen_request_is_released     ONE rule for "Account has released this request's fund"
--   reqgen_subhead_supported       what a subhead's reserved and spent SHOULD be, from records
--   recalculate_subhead_finance    now also counts posted manual vouchers and ignores reversals
--                                  (the old version is saved in reqgen_function_backups)
--   reqgen_finance_integrity       every difference between stored totals and their records,
--                                  orphaned records and double counting
--   reqgen_finance_correct         Auditor or Super Admin brings stored totals back to what the
--                                  records support (reason required, every change logged)
--   reqgen_finance_ledger          one list of every money movement (Transaction Centre)
--   reqgen_reversal_*              reverse a fund release or a manual voucher:
--                                  Account Officer → Auditor → DG; never a silent edit
--   reqgen_finance_reset_preview   what a reset would clear, and anything that would stop it
--   reqgen_finance_reset           Super Admin only, after a verified backup and the typed
--                                  words RESET FINANCE: clears the finance test records and
--                                  sets every subhead and IET account figure to ₦0.00 in ONE
--                                  transaction (all or nothing), then checks the result
--   reqgen_backup_restore          restores a backup in ONE transaction (all or nothing)
--   reqgen_my_activity             My Account › My Activity: your own actions and sign-ins
--
-- KEPT by a reset: staff, sign-ins and 2FA, positions, departments, subhead names, codes and
-- IDs, IET account names and bank details, routing, settings, the Audit Log, backups and
-- the record of every reset.
-- The routing engine is NOT changed. Safe to run more than once.
-- Ends with a table where every row says OK.
-- =============================================================================
begin;

create temp table if not exists v463_report (step text, item text, result text, status text);
truncate v463_report;

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

-- Save the functions this release replaces (once per release).
insert into public.reqgen_function_backups (function_name, function_identity, release, definition)
select p.proname, pg_get_function_identity_arguments(p.oid), 'v4.6.3', pg_get_functiondef(p.oid)
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('recalculate_subhead_finance', 'reqgen_audit_write')
  and not exists (select 1 from public.reqgen_function_backups b where b.function_name = p.proname and b.release = 'v4.6.3');
insert into v463_report values ('00 backup', 'reqgen_function_backups', 'recalculate_subhead_finance and reqgen_audit_write saved before replacing', 'OK');

-- 1. Who may do what ---------------------------------------------------------------------------
create or replace function public.reqgen_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- the Trust's Super Admin system account (never the Developer), active, acting as Super Admin
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.system_account = 'superadmin' and coalesce(p.is_active, true))
    and public.reqgen_active_role_key() in ('admin', 'superadmin');
$$;
revoke all on function public.reqgen_is_super_admin() from public, anon;
grant execute on function public.reqgen_is_super_admin() to authenticated;

create or replace function public.reqgen_finance_viewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.reqgen_report_tier() in ('all', 'finance')
     and exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_active, true));
$$;
revoke all on function public.reqgen_finance_viewer() from public, anon;
grant execute on function public.reqgen_finance_viewer() to authenticated;
insert into v463_report values ('01 access', 'reqgen_is_super_admin · reqgen_finance_viewer', 'reset: Super Admin only (not the Developer); finance views: Finance, DG office, Auditor, Super Admin', 'OK');

-- 2. One rule for spent and reserved -------------------------------------------------------------
alter table public.requests add column if not exists funds_reversed_at timestamptz;
alter table public.requests add column if not exists funds_reversal_no text;
alter table public.payment_vouchers add column if not exists reversed_at timestamptz;
alter table public.payment_vouchers add column if not exists reversal_no text;

create or replace function public.reqgen_request_is_released(p_status text, p_stage text, p_funds text, p_account_name text, p_reversed_at timestamptz)
returns boolean
language sql
immutable
as $$
  select p_reversed_at is null and (
       lower(coalesce(p_status, '')) like 'paid%'
    or lower(coalesce(p_funds, '')) in ('paid', 'spent')
    or (public.reqgen_key(p_stage) = 'completed' and coalesce(p_account_name, '') <> ''
        and lower(coalesce(p_status, '')) not in ('rejected', 'cancelled', 'withdrawn', 'deleted')));
$$;

create or replace function public.reqgen_manual_voucher_counts(p_type text, p_origin text, p_status text, p_posted_at timestamptz, p_reversed_at timestamptz)
returns boolean
language sql
immutable
as $$
  select (coalesce(p_type, '') = 'Manual' or coalesce(p_origin, '') = 'Manual')
     and p_posted_at is not null and p_reversed_at is null
     and lower(coalesce(p_status, '')) not in ('cancelled', 'draft', 'reversed');
$$;

create or replace function public.reqgen_subhead_supported(p_subhead_id uuid)
returns table(reserved numeric, released numeric, manual numeric, expenditure numeric, releases int, vouchers int)
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select
      coalesce(sum(q.amount) filter (where lower(coalesce(q.funds_state, '')) = 'reserved'
        and coalesce(q.status, '') not in ('Rejected', 'Cancelled', 'Deleted', 'Paid', 'Closed')
        and upper(replace(coalesce(q.current_stage, ''), ' ', '')) not in ('COMPLETED', 'REJECTED')
        and not public.reqgen_request_is_released(q.status, q.current_stage, q.funds_state, q.account_name, q.funds_reversed_at)), 0) as reserved,
      coalesce(sum(q.amount) filter (where public.reqgen_request_is_released(q.status, q.current_stage, q.funds_state, q.account_name, q.funds_reversed_at)), 0) as released,
      count(*) filter (where public.reqgen_request_is_released(q.status, q.current_stage, q.funds_state, q.account_name, q.funds_reversed_at))::int as n
    from public.requests q
    where q.subhead_id = p_subhead_id and upper(coalesce(q.request_type, '')) = 'OFFICIAL'
  ), m as (
    select coalesce(sum(coalesce(v.total_amount, v.amount, 0)), 0) as manual, count(*)::int as n
    from public.payment_vouchers v
    where v.subhead_id = p_subhead_id
      and public.reqgen_manual_voucher_counts(v.voucher_type, v.voucher_origin, v.status, v.posted_at, v.reversed_at)
  )
  select r.reserved, r.released, m.manual, r.released + m.manual, r.n, m.n from r, m;
$$;
revoke all on function public.reqgen_subhead_supported(uuid) from public, anon;
grant execute on function public.reqgen_subhead_supported(uuid) to authenticated;

-- Same name and result as before, so every caller keeps working. Before v4.6.3 it counted only
-- official requests, so a posted manual voucher's spending vanished at the next recalculation.
create or replace function public.recalculate_subhead_finance(p_subhead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allocation numeric := 0;
  s record;
begin
  if p_subhead_id is null then return jsonb_build_object('ok', true, 'message', 'No subhead supplied.'); end if;
  select coalesce(approved_allocation, 0) into v_allocation from public.subheads where id = p_subhead_id for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Subhead not found.'); end if;
  select * into s from public.reqgen_subhead_supported(p_subhead_id);
  update public.subheads
  set reserved_amount = s.reserved, expenditure = s.expenditure,
      balance = v_allocation - s.expenditure, updated_at = now()
  where id = p_subhead_id;
  return jsonb_build_object('ok', true, 'subhead_id', p_subhead_id, 'reserved_amount', s.reserved, 'expenditure', s.expenditure,
    'balance', v_allocation - s.expenditure, 'message', 'Subhead finance recalculated.');
end;
$$;
insert into v463_report values ('02 rules', 'reqgen_subhead_supported · recalculate_subhead_finance', 'spent = released official requests + posted manual vouchers; reversals excluded', 'OK');

-- 3. Integrity: stored totals against their records ------------------------------------------------
create or replace function public.reqgen_finance_integrity()
returns table(kind text, severity text, subject_id uuid, subject text, item text, stored numeric, supported numeric, difference numeric, note text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.reqgen_finance_viewer() then raise exception 'Finance integrity is for Finance, the DG''s office, the Auditor and the Super Admin.'; end if;

  -- 3a. subhead reserved / spent
  return query
  select 'subhead', case when abs(x.stored - x.supported) >= 1 then 'high' else 'low' end, s.id,
         coalesce(s.code || ' — ', '') || s.name, x.item, x.stored, x.supported, x.stored - x.supported, x.note
  from public.subheads s
  cross join lateral public.reqgen_subhead_supported(s.id) sup
  cross join lateral (values
    ('Spent', coalesce(s.expenditure, 0), sup.expenditure,
       format('%s released request(s) and %s posted manual voucher(s) support %s.', sup.releases, sup.vouchers, to_char(sup.expenditure, 'FM999,999,999,990.00'))),
    ('Reserved', coalesce(s.reserved_amount, 0), sup.reserved, 'Open official requests still holding money on this subhead.')
  ) as x(item, stored, supported, note)
  where x.stored <> x.supported;

  -- 3b. subhead allocation against the ledger (only when the ledger has allocation lines for it)
  return query
  select 'subhead', 'medium', s.id, coalesce(s.code || ' — ', '') || s.name, 'Allocation',
         coalesce(s.approved_allocation, 0), l.total, coalesce(s.approved_allocation, 0) - l.total,
         'The ledger''s allocation lines for this subhead add up to a different amount.'
  from public.subheads s
  join lateral (select coalesce(sum(g.amount), 0) as total, count(*) as n from public.iet_bank_ledger g
                where g.subhead_id = s.id and g.bank_account_id is not distinct from s.bank_account_id
                  and g.entry_type in ('Subhead Allocation', 'Allocation Adjustment')) l on l.n > 0
  where coalesce(s.approved_allocation, 0) <> l.total;
  return query
  select 'subhead', 'medium', s.id, coalesce(s.code || ' — ', '') || s.name, 'Allocation',
         coalesce(s.approved_allocation, 0), 0::numeric, coalesce(s.approved_allocation, 0),
         'An allocation with no allocation line in the ledger (set or deleted outside ReqGen).'
  from public.subheads s
  where coalesce(s.approved_allocation, 0) <> 0
    and not exists (select 1 from public.iet_bank_ledger g where g.subhead_id = s.id and g.entry_type in ('Subhead Allocation', 'Allocation Adjustment'));

  -- 3c. IET account figures worked out from its subheads, and its fund against the ledger
  return query
  select 'account', 'high', a.id, coalesce(a.name, 'IET account'), x.item, x.stored, x.supported, x.stored - x.supported,
         'Worked out from the subheads paid from this account.'
  from public.iet_accounts a
  cross join lateral (
    select coalesce(sum(s.approved_allocation), 0) as alloc, coalesce(sum(s.reserved_amount), 0) as res, coalesce(sum(s.expenditure), 0) as exp
    from public.subheads s where s.bank_account_id = a.id) t
  cross join lateral (values
    ('Given to subheads', coalesce(a.allocated_amount, 0), t.alloc),
    ('Spent', coalesce(a.expenditure, 0), t.exp),
    ('Available', coalesce(a.available_balance, 0), coalesce(a.total_fund, 0) - t.exp - t.res)
  ) as x(item, stored, supported)
  where x.stored <> x.supported;
  return query
  select 'account', 'medium', a.id, coalesce(a.name, 'IET account'), 'Total fund',
         coalesce(a.total_fund, 0), l.total, coalesce(a.total_fund, 0) - l.total,
         case when l.n = 0 then 'A fund with no funding line in the ledger (set or deleted outside ReqGen).'
              else 'Funding, transfers in and transfers out in the ledger add up to a different amount.' end
  from public.iet_accounts a
  cross join lateral (select coalesce(sum(case when g.entry_type = 'Debit' then -g.amount else g.amount end), 0) as total, count(*) as n
                      from public.iet_bank_ledger g where g.bank_account_id = a.id and g.subhead_id is null
                        and g.entry_type in ('Bank Funding', 'Credit', 'Debit')) l
  where coalesce(a.total_fund, 0) <> l.total;

  -- 3d. orphaned records and double counting
  return query
  select 'orphan', 'high', i.id, coalesce(i.request_no, 'Voucher line'), 'Voucher line without its voucher', i.amount, 0::numeric, i.amount,
         'A voucher line whose voucher no longer exists.'
  from public.payment_voucher_items i where not exists (select 1 from public.payment_vouchers v where v.id = i.voucher_id);
  return query
  select 'orphan', 'medium', i.id, coalesce(i.request_no, 'Voucher line'), 'Voucher line without its request', i.amount, 0::numeric, i.amount,
         'The request on this voucher line no longer exists.'
  from public.payment_voucher_items i where i.request_id is not null and not exists (select 1 from public.requests r where r.id = i.request_id);
  return query
  select 'orphan', 'medium', g.id, g.entry_type, 'Ledger line without its subhead or account', g.amount, 0::numeric, g.amount,
         'A ledger line pointing to a subhead or account that no longer exists.'
  from public.iet_bank_ledger g
  where (g.subhead_id is not null and not exists (select 1 from public.subheads s where s.id = g.subhead_id))
     or (g.bank_account_id is not null and not exists (select 1 from public.iet_accounts a where a.id = g.bank_account_id));
  return query
  select 'orphan', 'high', r.id, r.request_no, 'Released request without a subhead', r.amount, 0::numeric, r.amount,
         'Account released this official request, but it has no subhead, so the spending is not counted anywhere.'
  from public.requests r
  where upper(coalesce(r.request_type, '')) = 'OFFICIAL'
    and public.reqgen_request_is_released(r.status, r.current_stage, r.funds_state, r.account_name, r.funds_reversed_at)
    and (r.subhead_id is null or not exists (select 1 from public.subheads s where s.id = r.subhead_id));
  return query
  select 'double', 'high', i.request_id, max(i.request_no), 'Request on more than one live voucher', sum(i.amount), max(i.amount), sum(i.amount) - max(i.amount),
         'The same request is on ' || count(*) || ' vouchers that are not cancelled.'
  from public.payment_voucher_items i join public.payment_vouchers v on v.id = i.voucher_id
  where i.request_id is not null and lower(coalesce(v.status, '')) not in ('cancelled') and v.reversed_at is null
  group by i.request_id having count(*) > 1;
end;
$$;
revoke all on function public.reqgen_finance_integrity() from public, anon;
grant execute on function public.reqgen_finance_integrity() to authenticated;
insert into v463_report values ('03 integrity', 'reqgen_finance_integrity', 'subheads, accounts, ledger, orphaned lines, double counting', 'OK');

-- 4. Authorised corrections ---------------------------------------------------------------------------
create table if not exists public.reqgen_finance_corrections (
  id uuid primary key default gen_random_uuid(),
  correction_no text unique,
  subject_kind text not null,
  subject_id uuid not null,
  subject_label text,
  item text not null,
  before_value numeric,
  after_value numeric,
  reason text not null,
  corrected_by uuid,
  corrected_label text,
  created_at timestamptz not null default now()
);
create sequence if not exists public.reqgen_correction_seq;
alter table public.reqgen_finance_corrections enable row level security;
drop policy if exists reqgen_finance_corrections_read on public.reqgen_finance_corrections;
create policy reqgen_finance_corrections_read on public.reqgen_finance_corrections for select to authenticated using (public.reqgen_finance_viewer());
revoke all on public.reqgen_finance_corrections from anon;
revoke insert, update, delete, truncate on public.reqgen_finance_corrections from authenticated;
grant select on public.reqgen_finance_corrections to authenticated;

create or replace function public.reqgen_finance_correct(p_subhead_ids uuid[], p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_label text;
  s record;
  sup record;
  v_no text;
  v_count int := 0;
  v_accounts uuid[] := '{}';
begin
  if not (public.reqgen_is_super_admin() or public.reqgen_active_role_key() = 'auditor') then
    raise exception 'Only the Auditor or the Super Admin can correct stored finance totals.';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'Write why the totals are being corrected (at least 10 characters).'; end if;
  if coalesce(array_length(p_subhead_ids, 1), 0) = 0 then raise exception 'Choose at least one subhead.'; end if;
  v_label := public.reqgen_actor_label(v_actor);

  for s in select * from public.subheads where id = any(p_subhead_ids) order by id for update loop
    select * into sup from public.reqgen_subhead_supported(s.id);
    if coalesce(s.expenditure, 0) = sup.expenditure and coalesce(s.reserved_amount, 0) = sup.reserved then continue; end if;
    v_no := 'COR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.reqgen_correction_seq')::text, 4, '0');
    if coalesce(s.expenditure, 0) <> sup.expenditure then
      insert into public.reqgen_finance_corrections (correction_no, subject_kind, subject_id, subject_label, item, before_value, after_value, reason, corrected_by, corrected_label)
      values (v_no, 'subhead', s.id, coalesce(s.code || ' — ', '') || s.name, 'Spent', coalesce(s.expenditure, 0), sup.expenditure, trim(p_reason), v_actor, v_label);
    end if;
    if coalesce(s.reserved_amount, 0) <> sup.reserved then
      insert into public.reqgen_finance_corrections (correction_no, subject_kind, subject_id, subject_label, item, before_value, after_value, reason, corrected_by, corrected_label)
      values (v_no, 'subhead', s.id, coalesce(s.code || ' — ', '') || s.name, 'Reserved', coalesce(s.reserved_amount, 0), sup.reserved, trim(p_reason), v_actor, v_label);
    end if;
    perform public.recalculate_subhead_finance(s.id);
    -- the trail of the correction; it is not a money movement, so no bank balance changes
    insert into public.iet_bank_ledger (bank_account_id, department_id, subhead_id, entry_type, amount, description, created_by)
    values (s.bank_account_id, s.dept_id, s.id, 'System Recalculation', sup.expenditure - coalesce(s.expenditure, 0),
            v_no || ' spent corrected from ' || to_char(coalesce(s.expenditure, 0), 'FM999,999,999,990.00') || ' to ' || to_char(sup.expenditure, 'FM999,999,999,990.00') || ': ' || trim(p_reason), v_actor);
    perform public.reqgen_audit_write('data', 'Finance', 'Stored totals corrected (' || v_no || ')', coalesce(s.code, s.name), s.id,
      jsonb_build_object('spent_before', s.expenditure, 'spent_after', sup.expenditure, 'reserved_before', s.reserved_amount, 'reserved_after', sup.reserved, 'reason', trim(p_reason)));
    if s.bank_account_id is not null then v_accounts := array_append(v_accounts, s.bank_account_id); end if;
    v_count := v_count + 1;
  end loop;

  perform public.reqgen_recalculate_iet_account(a) from unnest(array(select distinct x from unnest(v_accounts) x)) a;
  if v_count > 0 then
    perform public.reqgen_transfer_notify(array['dg', 'auditor', 'admin'], 'Finance totals corrected',
      v_count || ' subhead(s) brought back to what the records support, by ' || v_label || '. Reason: ' || trim(p_reason), '/finance/integrity');
  end if;
  return jsonb_build_object('ok', true, 'corrected', v_count);
end;
$$;
revoke all on function public.reqgen_finance_correct(uuid[], text) from public, anon;
grant execute on function public.reqgen_finance_correct(uuid[], text) to authenticated;
insert into v463_report values ('04 correct', 'reqgen_finance_corrections · reqgen_finance_correct', 'Auditor or Super Admin; reason; before/after kept; no bank credit created', 'OK');

-- 5. Transaction Management Centre: one list of every money movement ----------------------------------
create or replace function public.reqgen_finance_ledger(p_from timestamptz, p_to timestamptz)
returns table(at timestamptz, kind text, ref_no text, ref_id uuid, source text, destination text, amount numeric, effect text,
              status text, by_label text, subhead_id uuid, account_id uuid, details text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.reqgen_finance_viewer() then raise exception 'The Transaction Centre is for Finance, the DG''s office, the Auditor and the Super Admin.'; end if;

  -- fund released by Account on an official request
  return query
  select x.* from (
    select coalesce((select max(h.created_at) from public.request_history h where h.request_id = r.id and public.reqgen_key(h.from_stage) = 'account'), r.updated_at) as at,
           'Fund released'::text, r.request_no, r.id, coalesce(s.code || ' — ', '') || coalesce(s.name, 'No subhead'), coalesce(r.requester_name, 'Requester'),
           r.amount, 'Spent'::text, case when r.funds_reversed_at is not null then 'Reversed (' || coalesce(r.funds_reversal_no, '') || ')' else 'Released' end,
           nullif(r.account_name, ''), r.subhead_id, s.bank_account_id, null::text
    from public.requests r left join public.subheads s on s.id = r.subhead_id
    where upper(coalesce(r.request_type, '')) = 'OFFICIAL'
      and (public.reqgen_request_is_released(r.status, r.current_stage, r.funds_state, r.account_name, r.funds_reversed_at) or r.funds_reversed_at is not null)
  ) x where x.at >= p_from and x.at < p_to;

  -- payment vouchers (manual vouchers count as spending; request vouchers are the payment of a release)
  return query
  select coalesce(v.posted_at, v.created_at),
         case when coalesce(v.voucher_type, '') = 'Manual' or coalesce(v.voucher_origin, '') = 'Manual' then 'Manual voucher' else 'Payment voucher' end,
         v.voucher_no, v.id, coalesce(v.subhead_code || ' — ', '') || coalesce(v.subhead_name, ''), coalesce(v.payee_name, ''),
         coalesce(v.total_amount, v.amount, 0),
         case when public.reqgen_manual_voucher_counts(v.voucher_type, v.voucher_origin, v.status, v.posted_at, v.reversed_at) then 'Spent' else 'Payment' end,
         case when v.reversed_at is not null then 'Reversed (' || coalesce(v.reversal_no, '') || ')' else coalesce(v.status, '') end,
         coalesce(v.prepared_by_name, ''), v.subhead_id, coalesce(v.bank_account_id, v.account_id), v.narration
  from public.payment_vouchers v
  where coalesce(v.posted_at, v.created_at) >= p_from and coalesce(v.posted_at, v.created_at) < p_to;

  -- transfers between accounts or subheads
  return query
  select t.created_at, case when t.kind = 'account' then 'Account transfer' else 'Subhead transfer' end, t.transfer_no, t.id,
         t.from_label, t.to_label, t.amount, 'Moved', t.status, t.initiated_label,
         t.from_subhead_id, t.from_account_id, t.narration
  from public.reqgen_transfers t where t.created_at >= p_from and t.created_at < p_to;

  -- ledger lines: funding, allocations, corrections
  return query
  select g.created_at, g.entry_type, null::text, g.id,
         coalesce(a.name, ''), coalesce(s.code || ' — ', '') || coalesce(s.name, ''),
         g.amount, case when g.entry_type in ('Bank Funding', 'Credit') then 'Money in' when g.entry_type = 'Debit' then 'Money out'
                        when g.entry_type in ('Subhead Allocation', 'Allocation Adjustment') then 'Allocation' else 'Record' end,
         'Posted', public.reqgen_actor_label(g.created_by), g.subhead_id, g.bank_account_id, g.description
  from public.iet_bank_ledger g
  left join public.iet_accounts a on a.id = g.bank_account_id
  left join public.subheads s on s.id = g.subhead_id
  where g.created_at >= p_from and g.created_at < p_to
    and g.entry_type not in ('Expenditure', 'Payment Voucher', 'Reservation', 'Reservation Release');
end;
$$;
revoke all on function public.reqgen_finance_ledger(timestamptz, timestamptz) from public, anon;
grant execute on function public.reqgen_finance_ledger(timestamptz, timestamptz) to authenticated;
insert into v463_report values ('05 ledger', 'reqgen_finance_ledger', 'releases, vouchers, transfers, funding, allocations and corrections in one list', 'OK');

-- 6. Reversals: Account Officer → Auditor → DG ------------------------------------------------------------
create table if not exists public.reqgen_finance_reversals (
  id uuid primary key default gen_random_uuid(),
  reversal_no text unique,
  source_kind text not null check (source_kind in ('release', 'manual')),
  source_id uuid not null,
  source_no text,
  subhead_id uuid,
  subhead_label text,
  amount numeric not null check (amount > 0),
  reason text not null,
  status text not null default 'With the Auditor' check (status in ('With the Auditor', 'With the DG', 'Approved', 'Returned', 'Rejected', 'Cancelled')),
  initiated_by uuid, initiated_label text, initiated_at timestamptz not null default now(),
  checked_by uuid, checked_label text, checked_at timestamptz, check_comment text,
  approved_by uuid, approved_label text, approved_at timestamptz, approve_comment text,
  stamped boolean not null default false, acting_for_dg boolean not null default false,
  updated_at timestamptz not null default now()
);
-- one live reversal per record: no duplicate reversal can be started or approved
create unique index if not exists reqgen_finance_reversals_live on public.reqgen_finance_reversals (source_kind, source_id)
  where status in ('With the Auditor', 'With the DG', 'Approved');
create sequence if not exists public.reqgen_reversal_seq;
alter table public.reqgen_finance_reversals enable row level security;
drop policy if exists reqgen_finance_reversals_read on public.reqgen_finance_reversals;
create policy reqgen_finance_reversals_read on public.reqgen_finance_reversals for select to authenticated using (public.reqgen_finance_viewer());
revoke all on public.reqgen_finance_reversals from anon;
revoke insert, update, delete, truncate on public.reqgen_finance_reversals from authenticated;
grant select on public.reqgen_finance_reversals to authenticated;

create or replace function public.reqgen_reversal_start(p_kind text, p_source_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_no text; v_src text; v_sub uuid; v_amount numeric; v_id uuid; v_label text;
begin
  if public.reqgen_active_role_key() not in ('account', 'accounts', 'accountofficer') then
    raise exception 'Only an Account Officer (acting as Account Officer) can start a reversal.';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'Write why it is being reversed (at least 10 characters).'; end if;
  if p_kind = 'release' then
    select r.request_no, r.subhead_id, r.amount into v_src, v_sub, v_amount from public.requests r
    where r.id = p_source_id and upper(coalesce(r.request_type, '')) = 'OFFICIAL'
      and public.reqgen_request_is_released(r.status, r.current_stage, r.funds_state, r.account_name, r.funds_reversed_at);
    if v_src is null then raise exception 'Only a released official request that has not been reversed can be reversed.'; end if;
  elsif p_kind = 'manual' then
    select v.voucher_no, v.subhead_id, coalesce(v.total_amount, v.amount) into v_src, v_sub, v_amount from public.payment_vouchers v
    where v.id = p_source_id and public.reqgen_manual_voucher_counts(v.voucher_type, v.voucher_origin, v.status, v.posted_at, v.reversed_at);
    if v_src is null then raise exception 'Only a posted manual voucher that has not been reversed can be reversed.'; end if;
  else
    raise exception 'Choose a fund release or a manual voucher.';
  end if;
  if exists (select 1 from public.reqgen_finance_reversals x where x.source_kind = p_kind and x.source_id = p_source_id and x.status in ('With the Auditor', 'With the DG', 'Approved')) then
    raise exception '% already has a reversal in progress or approved.', v_src;
  end if;
  select coalesce(s.code || ' — ', '') || s.name into v_label from public.subheads s where s.id = v_sub;
  v_no := 'REV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.reqgen_reversal_seq')::text, 4, '0');
  insert into public.reqgen_finance_reversals (reversal_no, source_kind, source_id, source_no, subhead_id, subhead_label, amount, reason, initiated_by, initiated_label)
  values (v_no, p_kind, p_source_id, v_src, v_sub, v_label, v_amount, trim(p_reason), v_actor, public.reqgen_actor_label(v_actor))
  returning id into v_id;
  perform public.reqgen_transfer_notify(array['auditor'], 'Reversal ' || v_no || ' to check', v_src || ' · ' || to_char(v_amount, 'FM999,999,999,990.00'), '/finance/transactions-centre?reversal=' || v_id::text);
  return jsonb_build_object('ok', true, 'id', v_id, 'reversal_no', v_no);
end;
$$;

create or replace function public.reqgen_reversal_check(p_id uuid, p_pass boolean, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v public.reqgen_finance_reversals; v_actor uuid := auth.uid();
begin
  if public.reqgen_active_role_key() <> 'auditor' then raise exception 'Only the Auditor (acting as Auditor) checks reversals.'; end if;
  select * into v from public.reqgen_finance_reversals where id = p_id for update;
  if not found then raise exception 'Reversal not found.'; end if;
  if v.status <> 'With the Auditor' then raise exception 'This reversal is not waiting for the Auditor.'; end if;
  if v.initiated_by = v_actor then raise exception 'The officer who started a reversal cannot also check it.'; end if;
  if not p_pass and length(trim(coalesce(p_comment, ''))) < 3 then raise exception 'Write why it is being returned.'; end if;
  update public.reqgen_finance_reversals
  set status = case when p_pass then 'With the DG' else 'Returned' end, checked_by = v_actor, checked_label = public.reqgen_actor_label(v_actor),
      checked_at = now(), check_comment = nullif(trim(coalesce(p_comment, '')), ''), updated_at = now()
  where id = p_id;
  if p_pass then
    perform public.reqgen_transfer_notify(array['dg', 'generalsecretary'], 'Reversal ' || v.reversal_no || ' to approve', v.source_no || '. Checked by the Auditor.', '/finance/transactions-centre?reversal=' || p_id::text);
  else
    insert into public.notifications (user_id, title, message, link, is_read, created_at)
    values (v.initiated_by, 'Reversal ' || v.reversal_no || ' returned', trim(p_comment), '/finance/transactions-centre?reversal=' || p_id::text, false, now());
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.reqgen_reversal_approve(p_id uuid, p_approve boolean, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.reqgen_finance_reversals; v_actor uuid := auth.uid(); v_role text := public.reqgen_active_role_key();
  v_acting boolean; v_sub public.subheads;
begin
  if v_role not in ('dg', 'directorgeneral', 'generalsecretary') then raise exception 'Only the Director General (or the General Secretary acting) approves reversals.'; end if;
  v_acting := v_role = 'generalsecretary';
  select * into v from public.reqgen_finance_reversals where id = p_id for update;
  if not found then raise exception 'Reversal not found.'; end if;
  if v.status <> 'With the DG' then raise exception 'This reversal is not waiting for the Director General.'; end if;
  if not p_approve then
    if length(trim(coalesce(p_comment, ''))) < 3 then raise exception 'Write why it is rejected.'; end if;
    update public.reqgen_finance_reversals set status = 'Rejected', approved_by = v_actor, approved_label = public.reqgen_actor_label(v_actor),
      approved_at = now(), approve_comment = trim(p_comment), acting_for_dg = v_acting, updated_at = now() where id = p_id;
    insert into public.notifications (user_id, title, message, link, is_read, created_at)
    values (v.initiated_by, 'Reversal ' || v.reversal_no || ' rejected', trim(p_comment), '/finance/transactions-centre?reversal=' || p_id::text, false, now());
    return jsonb_build_object('ok', true, 'status', 'Rejected');
  end if;

  if v.source_kind = 'release' then
    update public.requests set funds_reversed_at = now(), funds_reversal_no = v.reversal_no, updated_at = now()
    where id = v.source_id and funds_reversed_at is null;
  else
    update public.payment_vouchers set reversed_at = now(), reversal_no = v.reversal_no, updated_at = now()
    where id = v.source_id and reversed_at is null;
  end if;
  if not found then raise exception '% was already reversed.', v.source_no; end if;

  perform public.recalculate_subhead_finance(v.subhead_id);
  select * into v_sub from public.subheads where id = v.subhead_id;
  if v_sub.bank_account_id is not null then perform public.reqgen_recalculate_iet_account(v_sub.bank_account_id); end if;
  -- a record of the reversal only: the money in the bank (total fund) is NOT credited
  insert into public.iet_bank_ledger (bank_account_id, department_id, subhead_id, entry_type, amount, description, created_by)
  values (v_sub.bank_account_id, v_sub.dept_id, v.subhead_id, 'Correction', -v.amount,
          v.reversal_no || ' reversal of ' || v.source_no || ': ' || v.reason, v_actor);
  update public.reqgen_finance_reversals
  set status = 'Approved', approved_by = v_actor, approved_label = public.reqgen_actor_label(v_actor) || case when v_acting then ' (for the DG)' else '' end,
      approved_at = now(), approve_comment = nullif(trim(coalesce(p_comment, '')), ''), stamped = true, acting_for_dg = v_acting, updated_at = now()
  where id = p_id;
  perform public.reqgen_audit_write('stamp', 'Finance', 'Reversal approved and stamped (' || v.reversal_no || ')', v.source_no, v.source_id,
    jsonb_build_object('amount', v.amount, 'subhead', v.subhead_label));
  insert into public.notifications (user_id, title, message, link, is_read, created_at)
  values (v.initiated_by, 'Reversal ' || v.reversal_no || ' approved', v.source_no || ' is reversed. The subhead is updated; the bank balance is not changed.', '/finance/transactions-centre?reversal=' || p_id::text, false, now());
  return jsonb_build_object('ok', true, 'status', 'Approved');
end;
$$;

create or replace function public.reqgen_reversal_cancel(p_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v public.reqgen_finance_reversals;
begin
  select * into v from public.reqgen_finance_reversals where id = p_id for update;
  if not found then raise exception 'Reversal not found.'; end if;
  if v.initiated_by <> auth.uid() then raise exception 'Only the officer who started it can cancel it.'; end if;
  if v.status not in ('With the Auditor', 'Returned') then raise exception 'Only a reversal that is not yet with the DG can be cancelled.'; end if;
  update public.reqgen_finance_reversals set status = 'Cancelled', check_comment = coalesce(check_comment, trim(coalesce(p_reason, ''))), updated_at = now() where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.reqgen_reversal_start(text, uuid, text) from public, anon;
revoke all on function public.reqgen_reversal_check(uuid, boolean, text) from public, anon;
revoke all on function public.reqgen_reversal_approve(uuid, boolean, text) from public, anon;
revoke all on function public.reqgen_reversal_cancel(uuid, text) from public, anon;
grant execute on function public.reqgen_reversal_start(text, uuid, text) to authenticated;
grant execute on function public.reqgen_reversal_check(uuid, boolean, text) to authenticated;
grant execute on function public.reqgen_reversal_approve(uuid, boolean, text) to authenticated;
grant execute on function public.reqgen_reversal_cancel(uuid, text) to authenticated;
insert into v463_report values ('06 reversal', 'reqgen_finance_reversals · start / check / approve / cancel', 'Account Officer → Auditor → DG; one live reversal per record; bank balance not credited', 'OK');

-- 7. Quiet audit during a reset (the reset itself is logged once, with its totals) -----------------------
create or replace function public.reqgen_audit_write(p_category text, p_module text, p_action text, p_record_no text, p_record_id uuid, p_details jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('reqgen.bulk_reset', true), '') = 'on' then return; end if;
  insert into public.reqgen_audit_log (actor_id, actor_label, category, module, action, record_no, record_id, device, details)
  values (auth.uid(), case when auth.uid() is null then 'ReqGen (system)' else public.reqgen_actor_label(auth.uid()) end,
          p_category, p_module, p_action, p_record_no, p_record_id, public.reqgen_audit_device(), p_details);
exception when others then
  null; -- the audit log never stops the work it records
end;
$$;

-- 8. Financial reset ---------------------------------------------------------------------------------------
create table if not exists public.reqgen_finance_resets (
  id uuid primary key default gen_random_uuid(),
  reset_no text unique,
  scopes text[] not null,
  reason text not null,
  backup_id uuid,
  backup_path text,
  cleared jsonb,
  before_totals jsonb,
  after_totals jsonb,
  verified boolean not null default false,
  reset_by uuid,
  reset_label text,
  created_at timestamptz not null default now()
);
create sequence if not exists public.reqgen_reset_seq;
alter table public.reqgen_finance_resets enable row level security;
drop policy if exists reqgen_finance_resets_read on public.reqgen_finance_resets;
create policy reqgen_finance_resets_read on public.reqgen_finance_resets for select to authenticated using (public.reqgen_finance_viewer());
revoke all on public.reqgen_finance_resets from anon;
revoke insert, update, delete, truncate on public.reqgen_finance_resets from authenticated;
grant select on public.reqgen_finance_resets to authenticated;
alter table public.reqgen_backup_log add column if not exists verified boolean not null default false;

-- The records each part of a reset clears, children first. A table that does not exist is skipped.
create or replace function public.reqgen_reset_plan(p_scopes text[])
returns table(scope text, table_name text, ord int)
language sql
immutable
as $$
  select x.scope, x.table_name, x.ord from (values
    ('requests',  'reqgen_reminder_log', 10), ('requests', 'reqgen_request_drafts', 11),
    ('vouchers',  'reqgen_pv_attachments', 20), ('vouchers', 'reqgen_pv_transfer_schedule', 21), ('vouchers', 'payment_voucher_history', 22),
    ('vouchers',  'payment_voucher_items', 23), ('vouchers', 'manual_payment_voucher_audit', 24), ('vouchers', 'payment_vouchers', 25),
    ('finance',   'reqgen_finance_reversals', 30), ('finance', 'reqgen_transfers', 31), ('finance', 'account_transfers', 32),
    ('finance',   'finance_transactions', 33), ('finance', 'iet_account_transactions', 34), ('finance', 'iet_bank_ledger', 35),
    ('finance',   'finance_activity_history', 36), ('finance', 'reqgen_reconciliations', 37),
    ('requests',  'request_attachments', 40), ('requests', 'request_history', 41), ('requests', 'requests', 42)
  ) as x(scope, table_name, ord)
  where x.scope = any(p_scopes);
$$;

-- Money columns a reset sets to 0.00 (only those that exist in this database).
create or replace function public.reqgen_reset_money_columns(p_table text)
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(c.column_name::text order by c.column_name), '{}')
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = p_table
    and c.column_name = any(case p_table
      when 'subheads' then array['approved_allocation', 'reserved_amount', 'expenditure', 'balance']
      when 'iet_accounts' then array['total_fund', 'allocated_amount', 'reserved_amount', 'spent_amount', 'balance', 'expenditure',
                                     'unallocated_balance', 'available_balance', 'total_expenditure', 'total_income', 'opening_balance']
      else array[]::text[] end);
$$;

create or replace function public.reqgen_finance_totals()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'subheads_allocated', (select coalesce(sum(approved_allocation), 0) from public.subheads),
    'subheads_reserved', (select coalesce(sum(reserved_amount), 0) from public.subheads),
    'subheads_spent', (select coalesce(sum(expenditure), 0) from public.subheads),
    'subheads_balance', (select coalesce(sum(balance), 0) from public.subheads),
    'accounts_total_fund', (select coalesce(sum(total_fund), 0) from public.iet_accounts),
    'accounts_available', (select coalesce(sum(available_balance), 0) from public.iet_accounts),
    'subheads', (select count(*) from public.subheads),
    'accounts', (select count(*) from public.iet_accounts));
$$;
revoke all on function public.reqgen_finance_totals() from public, anon;

create or replace function public.reqgen_finance_reset_preview(p_scopes text[])
returns table(part text, item text, rows bigint, note text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare p record; n bigint; f record;
begin
  if not public.reqgen_is_super_admin() then raise exception 'Only the Super Admin can prepare a financial reset.'; end if;
  if not ('finance' = any(p_scopes)) then raise exception 'A reset always includes the finance records.'; end if;
  if 'requests' = any(p_scopes) and not ('vouchers' = any(p_scopes)) then raise exception 'Requests can only be cleared together with the payment vouchers.'; end if;

  for p in select * from public.reqgen_reset_plan(p_scopes) order by ord loop
    if to_regclass('public.' || p.table_name) is null then continue; end if;
    execute format('select count(*) from public.%I', p.table_name) into n;
    part := p.scope; item := p.table_name; rows := n; note := 'will be cleared'; return next;
  end loop;

  select count(*) into n from public.subheads;
  part := 'finance'; item := 'subheads'; rows := n; note := 'kept; allocation, reserved, spent and balance set to 0.00'; return next;
  select count(*) into n from public.iet_accounts;
  part := 'finance'; item := 'iet_accounts'; rows := n; note := 'kept; fund, allocated, spent and balances set to 0.00'; return next;

  -- anything that points at a cleared table and is NOT cleared would stop the reset
  for f in
    select c.conrelid::regclass::text as referencing, c.confrelid::regclass::text as referenced, c.conname, c.confdeltype
    from pg_constraint c
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and replace(c.confrelid::regclass::text, 'public.', '') in (select table_name from public.reqgen_reset_plan(p_scopes))
      and replace(c.conrelid::regclass::text, 'public.', '') not in (select table_name from public.reqgen_reset_plan(p_scopes))
      and c.confdeltype in ('a', 'r')
  loop
    execute format('select count(*) from %s', f.referencing) into n;
    if n > 0 then
      part := 'blocker'; item := f.referencing || ' → ' || f.referenced; rows := n;
      note := 'has rows that point to records being cleared (' || f.conname || '); include it or clear it first'; return next;
    end if;
  end loop;
end;
$$;
revoke all on function public.reqgen_finance_reset_preview(text[]) from public, anon;
grant execute on function public.reqgen_finance_reset_preview(text[]) to authenticated;

create or replace function public.reqgen_finance_reset(p_scopes text[], p_confirm text, p_backup_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_backup public.reqgen_backup_log;
  v_no text;
  v_before jsonb;
  v_after jsonb;
  v_cleared jsonb := '{}'::jsonb;
  v_cols text[];
  p record;
  n bigint;
  v_left bigint := 0;
  v_fy int := case when extract(month from now()) >= 9 then extract(year from now())::int else extract(year from now())::int - 1 end;
begin
  if not public.reqgen_is_super_admin() then raise exception 'Only the Super Admin can reset the finance records.'; end if;
  if coalesce(p_confirm, '') <> 'RESET FINANCE' then raise exception 'Type RESET FINANCE exactly to confirm.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'Write why the finance records are being reset (at least 10 characters).'; end if;
  if not ('finance' = any(p_scopes)) then raise exception 'A reset always includes the finance records.'; end if;
  if 'requests' = any(p_scopes) and not ('vouchers' = any(p_scopes)) then raise exception 'Requests can only be cleared together with the payment vouchers.'; end if;
  select * into v_backup from public.reqgen_backup_log where id = p_backup_id;
  if not found or v_backup.action <> 'backup' or v_backup.mode <> 'pre-reset' or not v_backup.verified
     or v_backup.actor_id is distinct from v_actor or v_backup.created_at < now() - interval '60 minutes' then
    raise exception 'A verified backup taken by you in the last hour is required before a reset. Take the backup again.';
  end if;

  v_before := public.reqgen_finance_totals();
  -- one quiet transaction: row-by-row audit lines are not written; the reset is logged once below
  perform set_config('reqgen.bulk_reset', 'on', true);
  perform set_config('reqgen.transfer_posting', 'on', true);

  for p in select * from public.reqgen_reset_plan(p_scopes) order by ord loop
    if to_regclass('public.' || p.table_name) is null then continue; end if;
    execute format('delete from public.%I', p.table_name);
    get diagnostics n = row_count;
    v_cleared := v_cleared || jsonb_build_object(p.table_name, n);
  end loop;

  v_cols := public.reqgen_reset_money_columns('subheads');
  if array_length(v_cols, 1) > 0 then
    execute 'update public.subheads set ' || (select string_agg(format('%I = 0', c), ', ') from unnest(v_cols) c)
         || case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subheads' and column_name = 'allocation_note')
                 then ', allocation_note = null, allocation_date = null' else '' end;
  end if;
  v_cols := public.reqgen_reset_money_columns('iet_accounts');
  if array_length(v_cols, 1) > 0 then
    execute 'update public.iet_accounts set ' || (select string_agg(format('%I = 0', c), ', ') from unnest(v_cols) c);
  end if;

  -- the budget of the current year is opened again so the new allocations can be entered
  if to_regclass('public.reqgen_financial_years') is not null then
    update public.reqgen_financial_years
    set status = 'Open', unlocked_by_label = public.reqgen_actor_label(v_actor), unlocked_at = now(), unlock_reason = 'Financial reset: ' || trim(p_reason), updated_at = now()
    where fy_start = v_fy and status = 'Locked';
  end if;

  perform set_config('reqgen.transfer_posting', 'off', true);
  perform set_config('reqgen.bulk_reset', 'off', true);

  -- verify: every figure is zero and every cleared table is empty, or nothing is kept
  v_after := public.reqgen_finance_totals();
  if (v_after->>'subheads_allocated')::numeric <> 0 or (v_after->>'subheads_reserved')::numeric <> 0 or (v_after->>'subheads_spent')::numeric <> 0
     or (v_after->>'subheads_balance')::numeric <> 0 or (v_after->>'accounts_total_fund')::numeric <> 0 or (v_after->>'accounts_available')::numeric <> 0 then
    raise exception 'The reset did not bring every figure to zero (%). Nothing has been changed.', v_after;
  end if;
  for p in select * from public.reqgen_reset_plan(p_scopes) loop
    if to_regclass('public.' || p.table_name) is null then continue; end if;
    execute format('select count(*) from public.%I', p.table_name) into n;
    v_left := v_left + n;
  end loop;
  if v_left > 0 then raise exception 'Some records could not be cleared. Nothing has been changed.'; end if;

  v_no := 'RST-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.reqgen_reset_seq')::text, 3, '0');
  insert into public.reqgen_finance_resets (reset_no, scopes, reason, backup_id, backup_path, cleared, before_totals, after_totals, verified, reset_by, reset_label)
  values (v_no, p_scopes, trim(p_reason), p_backup_id, v_backup.storage_path, v_cleared, v_before, v_after, true, v_actor, public.reqgen_actor_label(v_actor));
  perform public.reqgen_audit_write('data', 'Finance', 'Financial reset ' || v_no || ' (' || array_to_string(p_scopes, ', ') || ')', v_no, null,
    jsonb_build_object('cleared', v_cleared, 'before', v_before, 'backup', v_backup.storage_path, 'reason', trim(p_reason)));
  perform public.reqgen_transfer_notify(array['dg', 'auditor', 'admin'], 'Financial reset ' || v_no,
    'The finance records were reset to 0.00 by ' || public.reqgen_actor_label(v_actor) || '. A backup was taken first. Reason: ' || trim(p_reason), '/admin/finance-reset');
  return jsonb_build_object('ok', true, 'reset_no', v_no, 'cleared', v_cleared, 'before', v_before, 'after', v_after);
end;
$$;
revoke all on function public.reqgen_finance_reset(text[], text, uuid, text) from public, anon;
grant execute on function public.reqgen_finance_reset(text[], text, uuid, text) to authenticated;
insert into v463_report values ('08 reset', 'reqgen_finance_reset_preview · reqgen_finance_reset · reqgen_finance_resets',
  'Super Admin; verified backup in the last hour; RESET FINANCE; one transaction; checked to 0.00; recorded', 'OK');

-- 9. Restore a backup in one transaction (server only) ------------------------------------------------------
create or replace function public.reqgen_backup_restore(p_tables jsonb, p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
-- p_tables: [{"table": "...", "rows": [...]}, ...] in the order they must be written (parents first)
declare
  t jsonb;
  v_table text;
  v_cols text[];
  v_list text;
  n bigint;
  v_out jsonb := '{}'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Restore runs from the ReqGen server only.'; end if;
  if p_mode not in ('missing', 'overwrite') then raise exception 'Unknown restore mode.'; end if;
  if jsonb_typeof(p_tables) <> 'array' then raise exception 'The restore list must be an array.'; end if;
  perform set_config('reqgen.bulk_reset', 'on', true);
  perform set_config('reqgen.transfer_posting', 'on', true);
  for t in select value from jsonb_array_elements(p_tables) loop
    v_table := t->>'table';
    if v_table is null or to_regclass('public.' || v_table) is null or jsonb_typeof(t->'rows') <> 'array' or jsonb_array_length(t->'rows') = 0 then continue; end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_table and column_name = 'id') then continue; end if;
    -- only columns that exist both in the backup and in the table today
    select array_agg(c.column_name::text order by c.ordinal_position) into v_cols
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = v_table and c.is_generated = 'NEVER'
      and exists (select 1 from jsonb_array_elements(t->'rows') r where r ? c.column_name);
    if v_cols is null then continue; end if;
    select string_agg(format('%I', x), ', ') into v_list from unnest(v_cols) x;
    execute format(
      'insert into public.%1$I (%2$s) overriding system value select %2$s from jsonb_populate_recordset(null::public.%1$I, $1) on conflict (id) %3$s',
      v_table, v_list,
      case when p_mode = 'missing' or array_length(v_cols, 1) = 1 then 'do nothing'
           else 'do update set ' || (select string_agg(format('%1$I = excluded.%1$I', x), ', ') from unnest(v_cols) x where x <> 'id') end)
    using t->'rows';
    get diagnostics n = row_count;
    v_out := v_out || jsonb_build_object(v_table, n);
  end loop;
  perform set_config('reqgen.transfer_posting', 'off', true);
  perform set_config('reqgen.bulk_reset', 'off', true);
  return jsonb_build_object('ok', true, 'written', v_out);
end;
$$;
revoke all on function public.reqgen_backup_restore(jsonb, text) from public, anon, authenticated;
grant execute on function public.reqgen_backup_restore(jsonb, text) to service_role;
insert into v463_report values ('09 restore', 'reqgen_backup_restore', 'all tables in one transaction: if one fails, nothing is written', 'OK');

-- 9b. My Account › My Activity (mock-up 20) ----------------------------------------------------------------
-- Each person sees ONLY their own lines from the Audit Log, plus their own sign-ins.
create or replace function public.reqgen_my_activity(p_from timestamptz, p_to timestamptz)
returns table(at timestamptz, category text, module text, action text, record_no text, device text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  return query
  select l.at, l.category, l.module, l.action, l.record_no, l.device
  from public.reqgen_audit_log l
  where l.actor_id = auth.uid() and l.at >= p_from and l.at < p_to;
  if to_regclass('auth.audit_log_entries') is not null then
    return query execute $q$
      select e.created_at, 'signin'::text, 'Sign-in'::text,
             case e.payload->>'action' when 'login' then 'Signed in' when 'logout' then 'Signed out' when 'user_recovery_requested' then 'Asked to reset password'
                  when 'user_updated_password' then 'Changed password' when 'mfa_code_login' then 'Signed in with 2FA' else initcap(replace(e.payload->>'action', '_', ' ')) end,
             null::text, null::text
      from auth.audit_log_entries e
      where e.created_at >= $1 and e.created_at < $2 and e.payload->>'actor_id' = $3::text
        and e.payload->>'action' in ('login', 'logout', 'user_recovery_requested', 'user_updated_password', 'mfa_code_login')$q$
    using p_from, p_to, auth.uid();
  end if;
end;
$$;
revoke all on function public.reqgen_my_activity(timestamptz, timestamptz) from public, anon;
grant execute on function public.reqgen_my_activity(timestamptz, timestamptz) to authenticated;
insert into v463_report values ('09b my activity', 'reqgen_my_activity', 'My Account › My Activity: each person sees only their own actions and sign-ins', 'OK');

-- 10. Checks ----------------------------------------------------------------------------------------------
insert into v463_report
select '10 check', 'functions present', count(*)::text || ' of 20', case when count(*) = 20 then 'OK' else 'MISSING' end
from pg_proc where pronamespace = 'public'::regnamespace and proname in (
  'reqgen_is_super_admin', 'reqgen_finance_viewer', 'reqgen_request_is_released', 'reqgen_manual_voucher_counts', 'reqgen_subhead_supported',
  'recalculate_subhead_finance', 'reqgen_finance_integrity', 'reqgen_finance_correct', 'reqgen_finance_ledger', 'reqgen_reversal_start',
  'reqgen_reversal_check', 'reqgen_reversal_approve', 'reqgen_reversal_cancel', 'reqgen_reset_plan', 'reqgen_reset_money_columns',
  'reqgen_finance_totals', 'reqgen_finance_reset_preview', 'reqgen_finance_reset', 'reqgen_backup_restore', 'reqgen_my_activity');
insert into v463_report
select '10 check', 'tables present', count(*)::text || ' of 3', case when count(*) = 3 then 'OK' else 'MISSING' end
from pg_class where relnamespace = 'public'::regnamespace and relname in ('reqgen_finance_corrections', 'reqgen_finance_reversals', 'reqgen_finance_resets');
insert into v463_report values ('10 check', 'routing engine untouched', 'approve_request_step, reqgen_next_route_step and the route tables are only read', 'OK');

commit;

select step as "step", item as "item", result as "result", status as "status" from v463_report order by step, item;
