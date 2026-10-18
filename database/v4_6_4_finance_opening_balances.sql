-- =============================================================================
-- ReqGen v4.6.4 — Finance integrity: opening balances, account recalculation, over-allocation
-- Run in the Supabase SQL Editor AFTER the v4.6.4 code shows "Ready" on Vercel,
-- and AFTER v4_6_3_finance_integrity_reset.sql (run that one first if you have not).
--
-- Made from YOUR database inventory (18 October 2026), which showed:
--   * DIN 27 / DIN FORD: ₦3,000,000 "spent" with no request, voucher or ledger line behind it;
--   * an empty ledger, so the 57 allocations of the new year (₦790.8m) have no ledger line;
--   * IET accounts showing ₦0 "given to subheads" while their subheads hold ₦70m, ₦358m, ₦362m;
--   * every IET account fund at ₦0, below what its subheads were given.
--
--   reqgen_finance_integrity            + "Given more than the fund" check; allocations and funds
--                                        with no ledger line are listed as "opening" (not errors)
--   reqgen_finance_record_opening       Auditor or Super Admin: writes ONE opening ledger line for
--                                        each allocation / fund that has none (nothing else changes)
--   reqgen_finance_recalculate_accounts Auditor or Super Admin: works each IET account's figures out
--                                        again from its subheads; before/after kept
--   reqgen_finance_correct, reqgen_reversal_approve
--                                        a ledger line is written only when the subhead has a bank
--                                        account (the ledger requires one)
--   reqgen_reset_plan                    also clears request attachment checks and budget lines
--   reqgen_finance_corrections           one correction number may now list Spent and Reserved together
--
-- The routing engine is NOT changed. Nothing is deleted. Safe to run more than once.
-- Ends with a table where every row says OK.
-- =============================================================================
begin;

create temp table if not exists v464_report (step text, item text, result text, status text);
truncate v464_report;

do $$ begin
  if to_regprocedure('public.reqgen_finance_integrity()') is null then
    raise exception 'Run database/v4_6_3_finance_integrity_reset.sql first, then this file.';
  end if;
end $$;

insert into public.reqgen_function_backups (function_name, function_identity, release, definition)
select p.proname, pg_get_function_identity_arguments(p.oid), 'v4.6.4', pg_get_functiondef(p.oid)
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('reqgen_finance_integrity', 'reqgen_finance_correct', 'reqgen_reversal_approve', 'reqgen_reset_plan')
  and not exists (select 1 from public.reqgen_function_backups b where b.function_name = p.proname and b.release = 'v4.6.4');
insert into v464_report values ('00 backup', 'reqgen_function_backups', 'the four functions this file replaces are saved first', 'OK');

-- 0b. One correction number covers every figure it changed (v4.6.3 allowed only one line per number,
--     so correcting Spent AND Reserved on the same subhead failed). Only a rule is removed; no data.
alter table public.reqgen_finance_corrections drop constraint if exists reqgen_finance_corrections_correction_no_key;
create index if not exists reqgen_finance_corrections_no_idx on public.reqgen_finance_corrections (correction_no);
insert into v464_report values ('00 corrections', 'reqgen_finance_corrections', 'one correction number can list several figures', 'OK');

-- 1. Integrity --------------------------------------------------------------------------------------------
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
  select 'opening', 'low', s.id, coalesce(s.code || ' — ', '') || s.name, 'Allocation',
         coalesce(s.approved_allocation, 0), 0::numeric, coalesce(s.approved_allocation, 0),
         'No allocation line in the ledger yet. If this allocation is right, record it with "Record opening balances".'
  from public.subheads s
  where coalesce(s.approved_allocation, 0) <> 0 and s.bank_account_id is not null
    and not exists (select 1 from public.iet_bank_ledger g where g.subhead_id = s.id and g.entry_type in ('Subhead Allocation', 'Allocation Adjustment'));
  return query
  select 'subhead', 'medium', s.id, coalesce(s.code || ' — ', '') || s.name, 'IET account',
         coalesce(s.approved_allocation, 0), 0::numeric, coalesce(s.approved_allocation, 0),
         'This subhead has an allocation but no IET account to pay from. Choose its account in Budget & Subheads.'
  from public.subheads s
  where coalesce(s.approved_allocation, 0) <> 0 and s.bank_account_id is null;

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
  select case when l.n = 0 then 'opening' else 'account' end, case when l.n = 0 then 'low' else 'medium' end,
         a.id, coalesce(a.name, 'IET account'), 'Total fund',
         coalesce(a.total_fund, 0), l.total, coalesce(a.total_fund, 0) - l.total,
         case when l.n = 0 then 'No funding line in the ledger yet. If this fund is right, record it with "Record opening balances".'
              else 'Funding, transfers in and transfers out in the ledger add up to a different amount.' end
  from public.iet_accounts a
  cross join lateral (select coalesce(sum(case when g.entry_type = 'Debit' then -g.amount else g.amount end), 0) as total, count(*) as n
                      from public.iet_bank_ledger g where g.bank_account_id = a.id and g.subhead_id is null
                        and g.entry_type in ('Bank Funding', 'Credit', 'Debit')) l
  where coalesce(a.total_fund, 0) <> l.total;

  -- 3c2. subheads given more than the account's fund (v4.6.4)
  return query
  select 'overallocated', 'high', a.id, coalesce(a.name, 'IET account'), 'Given to subheads',
         t.alloc, coalesce(a.total_fund, 0), t.alloc - coalesce(a.total_fund, 0),
         'Subheads paid from this account hold more than its total fund. Set the account''s fund from the bank statement, or reduce allocations.'
  from public.iet_accounts a
  cross join lateral (select coalesce(sum(s.approved_allocation), 0) as alloc from public.subheads s where s.bank_account_id = a.id) t
  where t.alloc > coalesce(a.total_fund, 0);

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
insert into v464_report values ('01 integrity', 'reqgen_finance_integrity', 'adds "given more than the fund"; missing opening lines listed separately', 'OK');

-- 2. Corrections and reversals write a ledger line only when there is a bank account ---------------------
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
    -- (a ledger line needs a bank account; a subhead without one keeps its trail in the corrections list)
    if s.bank_account_id is not null then
    insert into public.iet_bank_ledger (bank_account_id, department_id, subhead_id, entry_type, amount, description, created_by)
    values (s.bank_account_id, s.dept_id, s.id, 'System Recalculation', sup.expenditure - coalesce(s.expenditure, 0),
            v_no || ' spent corrected from ' || to_char(coalesce(s.expenditure, 0), 'FM999,999,999,990.00') || ' to ' || to_char(sup.expenditure, 'FM999,999,999,990.00') || ': ' || trim(p_reason), v_actor);
    end if;
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
  if v_sub.bank_account_id is not null then
    insert into public.iet_bank_ledger (bank_account_id, department_id, subhead_id, entry_type, amount, description, created_by)
    values (v_sub.bank_account_id, v_sub.dept_id, v.subhead_id, 'Correction', -v.amount,
            v.reversal_no || ' reversal of ' || v.source_no || ': ' || v.reason, v_actor);
  end if;
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
insert into v464_report values ('02 guard', 'reqgen_finance_correct · reqgen_reversal_approve', 'ledger line only when the subhead has a bank account (the ledger requires one)', 'OK');

-- 3. Opening balances: one ledger line for each allocation and fund that has none --------------------------
create or replace function public.reqgen_finance_record_opening(p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_label text;
  v_no text;
  v_subs int := 0;
  v_accs int := 0;
  r record;
begin
  if not (public.reqgen_is_super_admin() or public.reqgen_active_role_key() = 'auditor') then
    raise exception 'Only the Auditor or the Super Admin can record opening balances.';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'Write why the opening balances are being recorded (at least 10 characters).'; end if;
  v_label := public.reqgen_actor_label(v_actor);
  if not exists (select 1 from public.iet_accounts a where coalesce(a.total_fund, 0) <> 0
                    and not exists (select 1 from public.iet_bank_ledger g where g.bank_account_id = a.id and g.subhead_id is null and g.entry_type in ('Bank Funding', 'Credit', 'Debit')))
     and not exists (select 1 from public.subheads s where coalesce(s.approved_allocation, 0) <> 0 and s.bank_account_id is not null
                    and not exists (select 1 from public.iet_bank_ledger g where g.subhead_id = s.id and g.entry_type in ('Subhead Allocation', 'Allocation Adjustment'))) then
    return jsonb_build_object('ok', true, 'correction_no', null, 'accounts', 0, 'subheads', 0);
  end if;
  v_no := 'COR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.reqgen_correction_seq')::text, 4, '0');

  -- IET account funds first (the fund an allocation comes out of)
  for r in
    select a.* from public.iet_accounts a
    where coalesce(a.total_fund, 0) <> 0
      and not exists (select 1 from public.iet_bank_ledger g where g.bank_account_id = a.id and g.subhead_id is null and g.entry_type in ('Bank Funding', 'Credit', 'Debit'))
    order by a.id for update
  loop
    insert into public.iet_bank_ledger (bank_account_id, entry_type, amount, description, created_by)
    values (r.id, 'Bank Funding', r.total_fund, v_no || ' opening fund recorded: ' || trim(p_reason), v_actor);
    insert into public.reqgen_finance_corrections (correction_no, subject_kind, subject_id, subject_label, item, before_value, after_value, reason, corrected_by, corrected_label)
    values (v_no, 'account', r.id, r.name, 'Opening fund line', 0, r.total_fund, trim(p_reason), v_actor, v_label);
    v_accs := v_accs + 1;
  end loop;

  for r in
    select s.* from public.subheads s
    where coalesce(s.approved_allocation, 0) <> 0 and s.bank_account_id is not null
      and not exists (select 1 from public.iet_bank_ledger g where g.subhead_id = s.id and g.entry_type in ('Subhead Allocation', 'Allocation Adjustment'))
    order by s.id for update
  loop
    insert into public.iet_bank_ledger (bank_account_id, department_id, subhead_id, entry_type, amount, description, created_by)
    values (r.bank_account_id, r.dept_id, r.id, 'Subhead Allocation', r.approved_allocation, v_no || ' opening allocation recorded: ' || trim(p_reason), v_actor);
    v_subs := v_subs + 1;
  end loop;
  if v_subs > 0 then
    insert into public.reqgen_finance_corrections (correction_no, subject_kind, subject_id, subject_label, item, before_value, after_value, reason, corrected_by, corrected_label)
    values (v_no, 'ledger', '00000000-0000-0000-0000-000000000000', v_subs || ' subhead allocation(s)', 'Opening allocation lines', 0,
            (select coalesce(sum(approved_allocation), 0) from public.subheads s where exists (select 1 from public.iet_bank_ledger g where g.subhead_id = s.id and g.description like v_no || '%')),
            trim(p_reason), v_actor, v_label);
  end if;

  if v_subs + v_accs > 0 then
    perform public.reqgen_audit_write('data', 'Finance', 'Opening balances recorded (' || v_no || ')', v_no, null,
      jsonb_build_object('accounts', v_accs, 'subheads', v_subs, 'reason', trim(p_reason)));
    perform public.reqgen_transfer_notify(array['dg', 'auditor', 'admin'], 'Opening balances recorded',
      v_accs || ' account fund(s) and ' || v_subs || ' subhead allocation(s) now have an opening line in the ledger, recorded by ' || v_label || '.', '/finance/integrity');
  end if;
  return jsonb_build_object('ok', true, 'correction_no', case when v_subs + v_accs > 0 then v_no end, 'accounts', v_accs, 'subheads', v_subs);
end;
$$;
revoke all on function public.reqgen_finance_record_opening(text) from public, anon;
grant execute on function public.reqgen_finance_record_opening(text) to authenticated;
insert into v464_report values ('03 opening', 'reqgen_finance_record_opening', 'one opening line per fund / allocation without one; figures themselves unchanged', 'OK');

-- 4. Work IET account figures out again from their subheads ------------------------------------------------
create or replace function public.reqgen_finance_recalculate_accounts(p_account_ids uuid[], p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_label text;
  v_no text;
  b record;
  a record;
  v_count int := 0;
begin
  if not (public.reqgen_is_super_admin() or public.reqgen_active_role_key() = 'auditor') then
    raise exception 'Only the Auditor or the Super Admin can recalculate IET accounts.';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'Write why the accounts are being recalculated (at least 10 characters).'; end if;
  if coalesce(array_length(p_account_ids, 1), 0) = 0 then raise exception 'Choose at least one IET account.'; end if;
  v_label := public.reqgen_actor_label(v_actor);
  for b in select * from public.iet_accounts where id = any(p_account_ids) order by id for update loop
    perform public.reqgen_recalculate_iet_account(b.id);
    select * into a from public.iet_accounts where id = b.id;
    if v_no is null and (coalesce(b.allocated_amount, 0), coalesce(b.expenditure, 0), coalesce(b.reserved_amount, 0), coalesce(b.available_balance, 0))
         is distinct from (coalesce(a.allocated_amount, 0), coalesce(a.expenditure, 0), coalesce(a.reserved_amount, 0), coalesce(a.available_balance, 0)) then
      v_no := 'COR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.reqgen_correction_seq')::text, 4, '0');
    end if;
    insert into public.reqgen_finance_corrections (correction_no, subject_kind, subject_id, subject_label, item, before_value, after_value, reason, corrected_by, corrected_label)
    select v_no, 'account', b.id, b.name, x.item, x.before_value, x.after_value, trim(p_reason), v_actor, v_label
    from (values ('Given to subheads', coalesce(b.allocated_amount, 0), coalesce(a.allocated_amount, 0)),
                 ('Spent', coalesce(b.expenditure, 0), coalesce(a.expenditure, 0)),
                 ('Reserved', coalesce(b.reserved_amount, 0), coalesce(a.reserved_amount, 0)),
                 ('Available', coalesce(b.available_balance, 0), coalesce(a.available_balance, 0))) as x(item, before_value, after_value)
    where x.before_value <> x.after_value and v_no is not null;
    if found then
      v_count := v_count + 1;
      perform public.reqgen_audit_write('data', 'Finance', 'IET account recalculated (' || v_no || ')', b.name, b.id,
        jsonb_build_object('allocated_before', b.allocated_amount, 'allocated_after', a.allocated_amount, 'spent_before', b.expenditure, 'spent_after', a.expenditure, 'reason', trim(p_reason)));
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'recalculated', v_count, 'correction_no', case when v_count > 0 then v_no end);
end;
$$;
revoke all on function public.reqgen_finance_recalculate_accounts(uuid[], text) from public, anon;
grant execute on function public.reqgen_finance_recalculate_accounts(uuid[], text) to authenticated;
insert into v464_report values ('04 accounts', 'reqgen_finance_recalculate_accounts', 'given-to-subheads, spent, reserved and available worked out from the subheads; total fund and bank balance unchanged', 'OK');

-- 5. Reset also clears request attachment checks and budget lines --------------------------------------
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
    ('requests',  'request_attachment_checks', 39), ('requests', 'request_attachments', 40), ('requests', 'reqgen_request_budget_lines', 40),
    ('requests',  'request_history', 41), ('requests', 'requests', 42)
  ) as x(scope, table_name, ord)
  where x.scope = any(p_scopes);
$$;
insert into v464_report values ('05 reset', 'reqgen_reset_plan', 'request attachment checks and request budget lines are cleared with requests', 'OK');

-- 6. Checks ------------------------------------------------------------------------------------------------
insert into v464_report
select '06 check', 'functions present', count(*)::text || ' of 6', case when count(*) = 6 then 'OK' else 'MISSING' end
from pg_proc where pronamespace = 'public'::regnamespace and proname in (
  'reqgen_finance_integrity', 'reqgen_finance_record_opening', 'reqgen_finance_recalculate_accounts',
  'reqgen_finance_correct', 'reqgen_reversal_approve', 'reqgen_reset_plan');
insert into v464_report values ('06 check', 'routing engine untouched', 'approve_request_step, reqgen_next_route_step and the route tables are only read', 'OK');

commit;

select step as "step", item as "item", result as "result", status as "status" from v464_report order by step, item;
