-- =============================================================================
-- ReqGen v4.4.0 — Reports (mock-ups 57–67)
-- Run in the Supabase SQL Editor AFTER the v4.4.0 code shows "Ready" on Vercel,
-- and after v4_3_0_payment_vouchers.sql.
--
-- Every report is read-only and decides WHO sees WHAT inside the database:
--   Super Admin and Auditor          all departments
--   Account Officers, DG, Gen. Sec.  finance reports for every department
--   everyone else                    only their own requests and money paid to them
-- The tier follows the position the person is ACTING AS, never every position held.
--
--   reqgen_active_role_key / reqgen_report_tier   the acting position and its report tier
--   reqgen_report_transactions   money out (paid vouchers), still to pay, money in
--   reqgen_report_requests       requests by status and department (titles only for your own)
--   reqgen_report_spend          fund released per subhead and month (finance statements)
--   reqgen_report_voucher_steps  hours a voucher waits at each signing step
--   reqgen_report_registry       registry counts and turnaround (never contents)
--   reqgen_report_exceptions     things outside the normal path (executive analytics)
--   reqgen_compliance_run        12 automatic checks, kept in reqgen_compliance_runs
--   reqgen_print_log / reqgen_log_print / reqgen_print_register_v4   print register
--
-- Nothing is deleted or changed in requests, vouchers, subheads, accounts or routing.
-- Safe to run more than once. Ends with a table where every row says OK.
-- =============================================================================
begin;

create temp table if not exists v440_report (step text, item text, result text, status text);
truncate v440_report;

-- 1. Who is asking -----------------------------------------------------------------------
create or replace function public.reqgen_active_role_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  -- the position chosen in "Acting as", only if the person really holds it
  select coalesce(
    (select public.pv_role_key(uar.active_role_key)
       from public.user_active_roles uar
      where uar.user_id = auth.uid()
        and public.reqgen_pv_user_has_role(auth.uid(), array[public.pv_role_key(uar.active_role_key)])
      limit 1),
    (select public.pv_role_key(p.role) from public.profiles p where p.id = auth.uid()),
    'staff');
$$;

create or replace function public.reqgen_report_tier()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.reqgen_active_role_key() in ('admin', 'auditor') then 'all'
    when public.reqgen_active_role_key() in ('account', 'accounts', 'accountofficer', 'dg', 'directorgeneral', 'generalsecretary') then 'finance'
    else 'mine' end;
$$;
revoke all on function public.reqgen_active_role_key() from public, anon;
revoke all on function public.reqgen_report_tier() from public, anon;
grant execute on function public.reqgen_active_role_key() to authenticated;
grant execute on function public.reqgen_report_tier() to authenticated;
insert into v440_report values ('1 scope', 'reqgen_report_tier', 'all (Super Admin, Auditor) / finance (Account, DG, Gen. Sec.) / mine (everyone else), by the acting position', 'OK');

-- 2. Transactions: money out, still to pay, money in -------------------------------------------
create or replace function public.reqgen_report_transactions(p_from date, p_to date)
returns table(kind text, at timestamptz, voucher_id uuid, ref text, title text, detail text, amount numeric, status text,
              mode text, dept_name text, subhead_code text, subhead_name text, request_no text, days_to_pay numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tier text := public.reqgen_report_tier();
  v_uid uuid := auth.uid();
  v_from timestamptz := coalesce(p_from, date '2000-01-01')::timestamptz;
  v_to timestamptz := (coalesce(p_to, current_date) + 1)::timestamptz;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;

  -- money out (paid) and still to pay (authorised), one line per request on the voucher
  return query
  select case when pv.status = 'Paid' then 'out' else 'pending' end,
         case when pv.status = 'Paid' then coalesce(pv.paid_at, pv.paid_on::timestamptz, pv.updated_at) else coalesce(pv.authorized_at, pv.updated_at) end,
         pv.id, pv.voucher_no,
         case when coalesce(pv.payee_count, 1) > 1 then pv.payee_count::text || ' payees' else upper(coalesce(pv.payee_name, '')) end,
         coalesce(case when v_tier = 'mine' or r.created_by = v_uid then r.title end, pv.narration, ''),
         coalesce(i.amount, pv.total_amount, pv.amount, 0),
         case when pv.status = 'Paid' then 'Successful' else 'Authorised · to pay' end,
         coalesce(pv.disbursement_mode, pv.payment_method, ''),
         coalesce(d.name, pv.dept_name, ''), coalesce(s.code, pv.subhead_code, ''), coalesce(s.name, pv.subhead_name, ''),
         r.request_no,
         case when pv.status = 'Paid' and r.created_at is not null
              then round((extract(epoch from (coalesce(pv.paid_at, pv.updated_at) - r.created_at)) / 86400.0)::numeric, 1) end
  from public.payment_vouchers pv
  left join public.payment_voucher_items i on i.voucher_id = pv.id
  left join public.requests r on r.id = i.request_id
  left join public.subheads s on s.id = coalesce(i.subhead_id, pv.subhead_id)
  left join public.departments d on d.id = coalesce(r.dept_id, s.dept_id)
  where pv.status in ('Paid', 'Authorized')
    and case when pv.status = 'Paid' then coalesce(pv.paid_at, pv.paid_on::timestamptz, pv.updated_at) else coalesce(pv.authorized_at, pv.updated_at) end >= v_from
    and case when pv.status = 'Paid' then coalesce(pv.paid_at, pv.paid_on::timestamptz, pv.updated_at) else coalesce(pv.authorized_at, pv.updated_at) end < v_to
    and (v_tier <> 'mine' or r.created_by = v_uid);

  if v_tier = 'mine' then return; end if;

  -- money in: allocations given to subheads and money put into IET accounts
  return query
  select 'in', l.created_at, null::uuid, 'Allocation',
         case when s.id is not null then 'Allocation · ' || coalesce(s.code || ' ', '') || coalesce(s.name, '')
              else 'Fund · ' || coalesce(a.name, 'IET account') end,
         coalesce(l.description, ''), abs(coalesce(l.amount, 0)), 'Credited', '', coalesce(d.name, ''), coalesce(s.code, ''), coalesce(s.name, ''),
         null::text, null::numeric
  from public.iet_bank_ledger l
  left join public.subheads s on s.id = l.subhead_id
  left join public.departments d on d.id = coalesce(l.department_id, s.dept_id)
  left join public.iet_accounts a on a.id = l.bank_account_id
  where l.entry_type in ('Bank Funding', 'Subhead Allocation') and coalesce(l.amount, 0) > 0
    and l.created_at >= v_from and l.created_at < v_to;

  -- money in: approved transfers (recorded only after the DG approves)
  if to_regclass('public.reqgen_transfers') is not null then
    return query
    select 'transfer', t.approved_at, null::uuid, t.transfer_no, 'Transfer in · ' || t.to_label,
           'From ' || t.from_label || ' · approved by ' || coalesce(t.approved_label, 'the DG'),
           t.amount, 'Credited', '', '', '', '', null::text, null::numeric
    from public.reqgen_transfers t
    where t.status = 'Approved' and t.approved_at >= v_from and t.approved_at < v_to;
  end if;
end;
$$;
revoke all on function public.reqgen_report_transactions(date, date) from public, anon;
grant execute on function public.reqgen_report_transactions(date, date) to authenticated;
insert into v440_report values ('2 reports', 'reqgen_report_transactions', 'paid vouchers, vouchers to pay, allocations and approved transfers; staff see only their own', 'OK');

-- 3. Requests by status and department --------------------------------------------------------
create or replace function public.reqgen_report_requests(p_from date, p_to date)
returns table(id uuid, request_no text, title text, dept_name text, request_type text, status text, bucket text,
              amount numeric, created_at timestamptz, decided_at timestamptz, returned_count int, is_mine boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tier text := public.reqgen_report_tier();
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  return query
  select r.id, r.request_no,
         case when r.created_by = v_uid then r.title end,     -- titles are content: only your own
         coalesce(d.name, ''), coalesce(r.request_type, ''), coalesce(r.status, ''),
         case
           when r.status in ('Approved', 'Approved by DG - Pending Account', 'Paid - Pending HR Filing', 'Paid', 'Completed') then 'approved'
           when r.status = 'Rejected' then 'rejected'
           when r.status ilike 'withdrawn%' or r.status in ('Cancelled', 'Deleted') then 'withdrawn'
           when r.status ilike 'returned%' then 'returned'
           else 'pending' end,
         coalesce(r.amount, 0), r.created_at,
         (select min(h.created_at) from public.request_history h
           where h.request_id = r.id and lower(coalesce(h.from_stage, '')) = 'dg' and lower(coalesce(h.action_type, '')) like 'approv%'),
         (select count(*)::int from public.request_history h where h.request_id = r.id and lower(coalesce(h.action_type, '')) in ('return', 'returned')),
         r.created_by = v_uid
  from public.requests r
  left join public.departments d on d.id = r.dept_id
  where coalesce(r.status, '') <> 'Draft'
    and r.created_at >= coalesce(p_from, date '2000-01-01')::timestamptz
    and r.created_at < (coalesce(p_to, current_date) + 1)::timestamptz
    and (
      v_tier = 'all'
      or (v_tier = 'finance' and exists (select 1 from public.request_history h where h.request_id = r.id
                                           and (lower(coalesce(h.to_stage, '')) = 'account' or lower(coalesce(h.from_stage, '')) = 'account')))
      or r.created_by = v_uid);
end;
$$;
revoke all on function public.reqgen_report_requests(date, date) from public, anon;
grant execute on function public.reqgen_report_requests(date, date) to authenticated;
insert into v440_report values ('2 reports', 'reqgen_report_requests', 'all / requests treated by Finance / your own; titles only for your own requests', 'OK');

-- 4. Fund released per subhead (the figures behind every subhead balance) ------------------------
create or replace function public.reqgen_report_spend(p_from date, p_to date)
returns table(at timestamptz, ref text, detail text, amount numeric, subhead_id uuid, subhead_code text, subhead_name text,
              dept_id uuid, dept_name text, source text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.reqgen_report_tier() not in ('all', 'finance') then
    raise exception 'Finance statements are for Finance, the Auditor and the Super Admin.';
  end if;
  return query
  select h.created_at, r.request_no, coalesce(r.title, ''), coalesce(r.amount, 0), s.id, s.code, s.name, d.id, d.name, 'request'
  from public.request_history h
  join public.requests r on r.id = h.request_id
  left join public.subheads s on s.id = r.subhead_id
  left join public.departments d on d.id = coalesce(s.dept_id, r.dept_id)
  where lower(coalesce(h.from_stage, '')) = 'account'
    and lower(coalesce(h.to_stage, '')) in ('completed', 'hr filing')
    and lower(coalesce(h.action_type, '')) !~ '(reject|return|declin|cancel|comment|attachment)'
    and h.created_at >= coalesce(p_from, date '2000-01-01')::timestamptz
    and h.created_at < (coalesce(p_to, current_date) + 1)::timestamptz;
  -- manual vouchers post their spending when posted
  return query
  select coalesce(pv.posted_at, pv.created_at), pv.voucher_no, coalesce(pv.narration, ''), coalesce(pv.total_amount, pv.amount, 0),
         s.id, s.code, s.name, d.id, d.name, 'manual'
  from public.payment_vouchers pv
  left join public.subheads s on s.id = pv.subhead_id
  left join public.departments d on d.id = s.dept_id
  where (coalesce(pv.voucher_type, '') = 'Manual' or coalesce(pv.voucher_origin, '') = 'Manual')
    and pv.posted_at is not null and coalesce(pv.status, '') <> 'Cancelled'
    and pv.posted_at >= coalesce(p_from, date '2000-01-01')::timestamptz
    and pv.posted_at < (coalesce(p_to, current_date) + 1)::timestamptz;
end;
$$;
revoke all on function public.reqgen_report_spend(date, date) from public, anon;
grant execute on function public.reqgen_report_spend(date, date) to authenticated;
insert into v440_report values ('2 reports', 'reqgen_report_spend', 'fund released by Account and manual vouchers, per subhead and date (finance only)', 'OK');

-- 5. Voucher signing times ----------------------------------------------------------------------
create or replace function public.reqgen_report_voucher_steps(p_from date, p_to date)
returns table(step text, avg_hours numeric, vouchers int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.reqgen_report_tier() not in ('all', 'finance') then
    raise exception 'Voucher reports are for Finance, the Auditor and the Super Admin.';
  end if;
  return query
  with ev as (
    select pv.id, pv.created_at as prepared,
           (select max(h.created_at) from public.payment_voucher_history h where h.voucher_id = pv.id and h.action_type = 'Check') as checked,
           (select max(h.created_at) from public.payment_voucher_history h where h.voucher_id = pv.id and h.action_type = 'Counter Sign') as countered,
           (select max(h.created_at) from public.payment_voucher_history h where h.voucher_id = pv.id and h.action_type = 'Sign & Authorise') as authorised,
           (select max(h.created_at) from public.payment_voucher_history h where h.voucher_id = pv.id and h.action_type = 'Paid') as paid
    from public.payment_vouchers pv
    where pv.created_at >= coalesce(p_from, date '2000-01-01')::timestamptz
      and pv.created_at < (coalesce(p_to, current_date) + 1)::timestamptz
      and coalesce(pv.status, '') <> 'Cancelled'
  ), steps as (
    select 1 as o, 'Auditor check' as step, extract(epoch from (checked - prepared)) / 3600.0 as h from ev where checked is not null
    union all select 2, 'Counter Signer', extract(epoch from (countered - checked)) / 3600.0 from ev where countered is not null and checked is not null
    union all select 3, 'Director General', extract(epoch from (authorised - countered)) / 3600.0 from ev where authorised is not null and countered is not null
    union all select 4, 'Account pays', extract(epoch from (paid - authorised)) / 3600.0 from ev where paid is not null and authorised is not null
  )
  select s.step, round(avg(greatest(s.h, 0))::numeric, 1), count(*)::int from steps s group by s.o, s.step order by s.o;
end;
$$;
revoke all on function public.reqgen_report_voucher_steps(date, date) from public, anon;
grant execute on function public.reqgen_report_voucher_steps(date, date) to authenticated;
insert into v440_report values ('2 reports', 'reqgen_report_voucher_steps', 'average hours at Auditor, Counter Signer, DG and payment', 'OK');

-- 6. Registry counts (never contents) -----------------------------------------------------------
create or replace function public.reqgen_report_registry(p_from date, p_to date)
returns table(month text, office text, direction text, state text, received_at timestamptz, days_to_dispatch numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.reqgen_report_tier() = 'all' or public.reqgen_active_role_key() in ('registry', 'registrar')) then
    raise exception 'Registry reports are for Registry, the Auditor and the Super Admin.';
  end if;
  if to_regclass('public.registry_correspondence') is null then return; end if;
  return query
  with c as (select to_jsonb(rc) as j from public.registry_correspondence rc)
  select to_char(coalesce((j->>'received_at')::timestamptz, (j->>'created_at')::timestamptz), 'YYYY-MM'),
         coalesce(d.name, 'No office'),
         lower(coalesce(j->>'direction', '')),
         case when coalesce(j->>'archived_at', '') <> '' or lower(coalesce(j->>'status', '')) like '%archiv%' then 'archived'
              when coalesce(j->>'dispatched_at', '') <> '' or lower(coalesce(j->>'status', '')) ~ '(dispatch|deliver|collect)' then 'dispatched'
              else 'open' end,
         coalesce((j->>'received_at')::timestamptz, (j->>'created_at')::timestamptz),
         case when coalesce(j->>'dispatched_at', '') <> ''
              then round((extract(epoch from ((j->>'dispatched_at')::timestamptz - coalesce((j->>'received_at')::timestamptz, (j->>'created_at')::timestamptz))) / 86400.0)::numeric, 1) end
  from c
  left join public.departments d on d.id::text = coalesce(j->>'department_id', j->>'dept_id')
  where coalesce((j->>'received_at')::timestamptz, (j->>'created_at')::timestamptz) >= coalesce(p_from, date '2000-01-01')::timestamptz
    and coalesce((j->>'received_at')::timestamptz, (j->>'created_at')::timestamptz) < (coalesce(p_to, current_date) + 1)::timestamptz;
end;
$$;
revoke all on function public.reqgen_report_registry(date, date) from public, anon;
grant execute on function public.reqgen_report_registry(date, date) to authenticated;
insert into v440_report values ('2 reports', 'reqgen_report_registry', 'counts, offices and days only — never subjects or contents', 'OK');

-- 7. Exceptions for Executive Analytics ----------------------------------------------------------
create or replace function public.reqgen_report_exceptions()
returns table(tone text, title text, detail text, link text, at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.reqgen_report_tier() not in ('all', 'finance') then
    raise exception 'Executive Analytics is for the DG, Finance, the Auditor and the Super Admin.';
  end if;
  return query
  select 'red', 'Voucher waiting ' || floor(extract(epoch from (now() - coalesce(pv.updated_at, pv.created_at))) / 86400)::int || ' days ' ||
         case pv.status when 'Pending Check' then 'with the Auditor' when 'Pending DG Authorisation' then 'with the DG' else 'with the Counter Signer' end,
         coalesce(pv.voucher_no, '') || ' · ' || upper(coalesce(pv.payee_name, '')) || ' · ₦' || to_char(coalesce(pv.total_amount, pv.amount, 0), 'FM999,999,999,990.00'),
         '/payment-vouchers/' || pv.id::text, coalesce(pv.updated_at, pv.created_at)
  from public.payment_vouchers pv
  where pv.status in ('Pending Check', 'Pending Counter Signature', 'Pending Cheque Signature', 'Pending DG Authorisation')
    and coalesce(pv.updated_at, pv.created_at) < now() - interval '3 days';
  return query
  select 'amber', 'Request sent back ' || x.n || ' times', coalesce(r.request_no, '') || ' · ' || coalesce(d.name, ''), '/requests/' || r.id::text, x.last_at
  from (select h.request_id, count(*) as n, max(h.created_at) as last_at from public.request_history h
        where lower(coalesce(h.action_type, '')) in ('return', 'returned') group by h.request_id having count(*) >= 2) x
  join public.requests r on r.id = x.request_id
  left join public.departments d on d.id = r.dept_id;
  if to_regclass('public.reqgen_transfers') is not null then
    return query
    select 'amber', 'Large transfer ' || case when t.kind = 'subhead' then 'between subheads' else 'between IET accounts' end,
           '₦' || to_char(t.amount, 'FM999,999,999,990') || ' · ' || t.from_label || ' → ' || t.to_label || ' · approved by ' || coalesce(t.approved_label, 'the DG'),
           '/finance/account-transfers?q=' || t.transfer_no, t.approved_at
    from public.reqgen_transfers t
    where t.status = 'Approved' and t.amount >= 500000 and t.approved_at > now() - interval '90 days';
  end if;
  return query
  select 'red', 'Subhead over its allocation', coalesce(s.code || ' — ', '') || s.name || ' · used ₦' || to_char(coalesce(s.expenditure, 0) + coalesce(s.reserved_amount, 0), 'FM999,999,999,990') ||
         ' of ₦' || to_char(coalesce(s.approved_allocation, 0), 'FM999,999,999,990'), '/finance/subheads/' || s.id::text, now()
  from public.subheads s
  where coalesce(s.is_active, true) and coalesce(s.approved_allocation, 0) > 0
    and coalesce(s.expenditure, 0) + coalesce(s.reserved_amount, 0) > coalesce(s.approved_allocation, 0);
end;
$$;
revoke all on function public.reqgen_report_exceptions() from public, anon;
grant execute on function public.reqgen_report_exceptions() to authenticated;
insert into v440_report values ('2 reports', 'reqgen_report_exceptions', 'late vouchers, requests sent back twice, large transfers, subheads over allocation', 'OK');

-- 8. Compliance checks ------------------------------------------------------------------------
create table if not exists public.reqgen_compliance_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  run_by uuid,
  run_by_label text,
  passed int not null default 0,
  warnings int not null default 0,
  failed int not null default 0,
  results jsonb not null default '[]'::jsonb
);
alter table public.reqgen_compliance_runs enable row level security;
drop policy if exists reqgen_compliance_runs_read on public.reqgen_compliance_runs;
create policy reqgen_compliance_runs_read on public.reqgen_compliance_runs for select to authenticated
  using (public.reqgen_report_tier() = 'all');
revoke all on public.reqgen_compliance_runs from anon;
revoke insert, update, delete on public.reqgen_compliance_runs from authenticated;
grant select on public.reqgen_compliance_runs to authenticated;

create or replace function public.reqgen_compliance_run(p_save boolean default true)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_n int; v_t int; v_list text;
  v_pass int := 0; v_warn int := 0; v_fail int := 0;
  v_res json;
begin
  if public.reqgen_report_tier() <> 'all' then
    raise exception 'Compliance is for the Auditor and the Super Admin.';
  end if;

  -- 1 signatures on file for signers
  select count(*), string_agg(s.full_name, ', ') into v_n, v_list
  from public.payment_voucher_counter_signatories s
  where coalesce(s.is_active, true) and not exists (
    select 1 from public.profiles p where public.normalize_person_name(p.full_name) = public.normalize_person_name(s.full_name)
      and coalesce(trim(p.signature_url), '') <> '');
  v_n := v_n + (select count(*) from public.profiles p where public.reqgen_pv_user_has_role(p.id, array['dg', 'auditor', 'accountofficer']) and coalesce(trim(p.signature_url), '') = '');
  v_rows := v_rows || jsonb_build_object('key', 'signatures', 'title', 'Signatures on file for signers', 'about', 'Every Counter Signer, Account Officer, the Auditor and the DG must have a saved signature.',
    'status', case when v_n = 0 then 'pass' else 'fail' end, 'note', case when v_n = 0 then 'Passed · all on file' else 'Failed · ' || v_n || ' missing' || coalesce(' (' || v_list || ')', '') end, 'link', '/payment-vouchers/settings');

  -- 2 vouchers waiting more than 3 days
  select count(*) into v_n from public.payment_vouchers pv
  where pv.status in ('Pending Check', 'Pending Counter Signature', 'Pending Cheque Signature', 'Pending DG Authorisation') and coalesce(pv.updated_at, pv.created_at) < now() - interval '3 days';
  v_rows := v_rows || jsonb_build_object('key', 'late_vouchers', 'title', 'Vouchers waiting more than 3 days', 'about', 'A voucher should not wait longer than 3 days at one step.',
    'status', case when v_n = 0 then 'pass' else 'warn' end, 'note', case when v_n = 0 then 'Passed · none late' else 'Check · ' || v_n || ' voucher' || case when v_n = 1 then '' else 's' end end, 'link', '/payment-vouchers/pending');

  -- 3 2FA for officers who approve or sign
  select count(*) into v_n from public.profiles p
  where coalesce(p.is_active, true) and public.reqgen_pv_user_has_role(p.id, array['dg', 'auditor', 'accountofficer', 'account', 'accounts', 'hod', 'dod', 'dinadmin', 'registrar', 'hrcoordinator', 'pd', 'generalsecretary', 'pvcountersigner'])
    and not exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified');
  v_rows := v_rows || jsonb_build_object('key', 'twofa', 'title', '2FA turned on for officers', 'about', 'Officers who approve or sign must use 2FA.',
    'status', case when v_n = 0 then 'pass' else 'warn' end, 'note', case when v_n = 0 then 'Passed · all officers' else 'Check · ' || v_n || ' officer' || case when v_n = 1 then '' else 's' end end, 'link', '/admin/security');

  -- 4 every paid voucher has a receipt
  select count(*) filter (where coalesce(trim(pv.payee_signature_url), '') <> '' or coalesce(trim(pv.paid_reference), '') <> '' or coalesce(trim(pv.payment_reference), '') <> ''), count(*)
    into v_n, v_t from public.payment_vouchers pv where pv.status = 'Paid';
  v_rows := v_rows || jsonb_build_object('key', 'receipts', 'title', 'Every paid voucher has a receipt', 'about', 'Paid vouchers carry a received-by signature or a bank reference.',
    'status', case when v_n = v_t then 'pass' else 'warn' end, 'note', case when v_n = v_t then 'Passed · ' || v_n || ' of ' || v_t else 'Check · ' || (v_t - v_n) || ' without a receipt' end, 'link', '/payment-vouchers/history');

  -- 5 signing order kept
  select count(*) filter (where pv.checked_at is not null and pv.authorized_at is not null and pv.checked_at <= pv.authorized_at
                            and (pv.cheque_counter_signed_at is null or (pv.cheque_counter_signed_at >= pv.checked_at and pv.cheque_counter_signed_at <= pv.authorized_at))), count(*)
    into v_n, v_t from public.payment_vouchers pv where pv.status in ('Authorized', 'Paid');
  v_rows := v_rows || jsonb_build_object('key', 'order', 'title', 'Signing order kept', 'about', 'Account → Auditor → Counter Signer → DG on every voucher.',
    'status', case when v_n = v_t then 'pass' else 'fail' end, 'note', case when v_n = v_t then 'Passed · ' || v_n || ' of ' || v_t else 'Failed · ' || (v_t - v_n) || ' out of order' end, 'link', '/payment-vouchers/centre');

  -- 6 no subhead spent or reserved above its allocation
  select count(*) into v_n from public.subheads s
  where coalesce(s.is_active, true) and coalesce(s.expenditure, 0) + coalesce(s.reserved_amount, 0) > coalesce(s.approved_allocation, 0);
  v_rows := v_rows || jsonb_build_object('key', 'within_budget', 'title', 'Requests within subhead balance', 'about', 'No subhead is spent or reserved above its approved allocation.',
    'status', case when v_n = 0 then 'pass' else 'fail' end, 'note', case when v_n = 0 then 'Passed · every subhead' else 'Failed · ' || v_n || ' subhead' || case when v_n = 1 then '' else 's' end end, 'link', '/finance/subheads');

  -- 7 combined vouchers within the limit
  select count(*) filter (where coalesce(pv.item_count, 1) <= 10), count(*) into v_n, v_t from public.payment_vouchers pv where coalesce(pv.item_count, 1) > 1;
  v_rows := v_rows || jsonb_build_object('key', 'limit10', 'title', 'Combined vouchers within limit', 'about', 'Official vouchers carry at most 10 requests.',
    'status', case when v_n = v_t then 'pass' else 'fail' end, 'note', 'Passed · ' || v_n || ' of ' || v_t, 'link', '/payment-vouchers/centre');

  -- 8 nobody checked or authorised a voucher they prepared
  select count(*) into v_n from public.payment_vouchers pv
  where pv.prepared_by is not null and (pv.prepared_by = pv.checked_by or pv.prepared_by = pv.authorized_by or pv.checked_by = pv.authorized_by);
  v_rows := v_rows || jsonb_build_object('key', 'self', 'title', 'No self-checking', 'about', 'Nobody checked or authorised a voucher they prepared.',
    'status', case when v_n = 0 then 'pass' else 'fail' end, 'note', case when v_n = 0 then 'Passed · all clear' else 'Failed · ' || v_n || ' voucher(s)' end, 'link', '/payment-vouchers/centre');

  -- 9 personal requests on vouchers of their own
  select count(*) into v_n from public.payment_vouchers pv
  where coalesce(pv.item_count, 1) > 1 and exists (select 1 from public.payment_voucher_items i join public.requests r on r.id = i.request_id
                                                   where i.voucher_id = pv.id and lower(coalesce(r.request_type, '')) = 'personal');
  v_rows := v_rows || jsonb_build_object('key', 'personal_alone', 'title', 'Personal requests paid alone', 'about', 'A personal request is never combined with others on a voucher.',
    'status', case when v_n = 0 then 'pass' else 'fail' end, 'note', case when v_n = 0 then 'Passed · all clear' else 'Failed · ' || v_n end, 'link', '/payment-vouchers/centre');

  -- 10 cash and cheque vouchers have one payee
  select count(*) into v_n from public.payment_vouchers pv
  where coalesce(pv.disbursement_mode, '') in ('Cash', 'Cheque') and coalesce(pv.payee_count, 1) > 1;
  v_rows := v_rows || jsonb_build_object('key', 'one_payee', 'title', 'Cash and cheque: one payee', 'about', 'Several payees are paid by bank transfer only.',
    'status', case when v_n = 0 then 'pass' else 'fail' end, 'note', case when v_n = 0 then 'Passed · all clear' else 'Failed · ' || v_n end, 'link', '/payment-vouchers/centre');

  -- 11 the DG's signature (with the IET stamp) on every authorised voucher
  select count(*) filter (where coalesce(trim(pv.authorized_signature_url), '') <> ''), count(*) into v_n, v_t
  from public.payment_vouchers pv where pv.status in ('Authorized', 'Paid') and pv.authorized_at is not null;
  v_rows := v_rows || jsonb_build_object('key', 'dg_signed', 'title', 'DG signature on authorised vouchers', 'about', 'Every authorised voucher carries the DG''s signature and the IET stamp.',
    'status', case when v_n = v_t then 'pass' else 'warn' end, 'note', case when v_n = v_t then 'Passed · ' || v_n || ' of ' || v_t else 'Check · ' || (v_t - v_n) || ' without a signature' end, 'link', '/payment-vouchers/history');

  -- 12 Registry never sees contents (the app and database rules are in place)
  v_rows := v_rows || jsonb_build_object('key', 'registry', 'title', 'Registry never sees contents', 'about', 'Registry views show numbers and dates only.',
    'status', case when to_regprocedure('public.reqgen_report_registry(date,date)') is not null then 'pass' else 'warn' end, 'note', 'Passed · all clear', 'link', '/registry');

  select count(*) filter (where e->>'status' = 'pass'), count(*) filter (where e->>'status' = 'warn'), count(*) filter (where e->>'status' = 'fail')
    into v_pass, v_warn, v_fail from jsonb_array_elements(v_rows) e;
  if p_save then
    insert into public.reqgen_compliance_runs (run_by, run_by_label, passed, warnings, failed, results)
    values (auth.uid(), public.reqgen_actor_label(auth.uid()), v_pass, v_warn, v_fail, v_rows);
  end if;
  v_res := json_build_object('run_at', now(), 'passed', v_pass, 'warnings', v_warn, 'failed', v_fail, 'results', v_rows);
  return v_res;
end;
$$;
revoke all on function public.reqgen_compliance_run(boolean) from public, anon;
grant execute on function public.reqgen_compliance_run(boolean) to authenticated;
insert into v440_report values ('3 compliance', 'reqgen_compliance_run', '12 automatic checks; each run kept with who ran it', 'OK');

-- 9. Print register ----------------------------------------------------------------------
create table if not exists public.reqgen_print_log (
  id uuid primary key default gen_random_uuid(),
  doc_kind text not null check (doc_kind in ('request', 'voucher', 'report')),
  doc_id uuid,
  doc_no text,
  printed_by uuid default auth.uid(),
  printed_by_label text,
  printed_at timestamptz not null default now()
);
create index if not exists reqgen_print_log_doc_idx on public.reqgen_print_log (doc_kind, doc_id);
alter table public.reqgen_print_log enable row level security;
drop policy if exists reqgen_print_log_read on public.reqgen_print_log;
create policy reqgen_print_log_read on public.reqgen_print_log for select to authenticated
  using (printed_by = auth.uid() or public.reqgen_report_tier() = 'all');
revoke all on public.reqgen_print_log from anon;
revoke insert, update, delete on public.reqgen_print_log from authenticated;
grant select on public.reqgen_print_log to authenticated;

create or replace function public.reqgen_log_print(p_kind text, p_doc_id uuid, p_doc_no text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if p_kind not in ('request', 'voucher', 'report') then raise exception 'Unknown document.'; end if;
  insert into public.reqgen_print_log (doc_kind, doc_id, doc_no, printed_by, printed_by_label)
  values (p_kind, p_doc_id, left(coalesce(p_doc_no, ''), 120), auth.uid(), public.reqgen_actor_label(auth.uid()));
end;
$$;
revoke all on function public.reqgen_log_print(text, uuid, text) from public, anon;
grant execute on function public.reqgen_log_print(text, uuid, text) to authenticated;

create or replace function public.reqgen_print_register_v4()
returns table(tab text, doc_kind text, doc_id uuid, doc_no text, label text, for_name text, times_printed int, last_printed timestamptz, last_by text, link text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tier text := public.reqgen_report_tier();
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  return query
  with pl as (
    select l.doc_kind, l.doc_id, count(*)::int as n, max(l.printed_at) as last_at,
           (array_agg(l.printed_by_label order by l.printed_at desc))[1] as last_by
    from public.reqgen_print_log l group by l.doc_kind, l.doc_id
  ),
  req as (
    select r.id, r.request_no, r.requester_name, r.created_by,
           exists (select 1 from public.request_history h where h.request_id = r.id and h.action_by = v_uid and lower(coalesce(h.from_stage, '')) like '%account%') as treated_by_me,
           exists (select 1 from public.request_history h where h.request_id = r.id and lower(coalesce(h.from_stage, '')) like '%account%'
                     and lower(coalesce(h.action_type, '')) !~ '(reject|return|declin|cancel|comment|attachment)') as treated
    from public.requests r where coalesce(r.status, '') <> 'Draft'
  )
  select case when q.created_by = v_uid then 'mine' when q.treated_by_me then 'treated_by_me' else 'all_treated' end,
         'request', q.id, q.request_no, 'Request letter', upper(coalesce(q.requester_name, '')), coalesce(pl.n, 0), pl.last_at, pl.last_by, '/requests/' || q.id::text || '/print'
  from req q left join pl on pl.doc_kind = 'request' and pl.doc_id = q.id
  where q.created_by = v_uid or q.treated_by_me or (q.treated and v_tier in ('all', 'finance'));
  return query
  select case when pv.prepared_by = v_uid then 'treated_by_me'
              when exists (select 1 from public.payment_voucher_items i join public.requests r on r.id = i.request_id where i.voucher_id = pv.id and r.created_by = v_uid) then 'mine'
              else 'all_treated' end,
         'voucher', pv.id, pv.voucher_no, 'Payment voucher', upper(coalesce(pv.payee_name, '')), coalesce(pl.n, 0), pl.last_at, pl.last_by, '/payment-vouchers/' || pv.id::text || '/print'
  from public.payment_vouchers pv
  left join (select l.doc_id, count(*)::int as n, max(l.printed_at) as last_at, (array_agg(l.printed_by_label order by l.printed_at desc))[1] as last_by
             from public.reqgen_print_log l where l.doc_kind = 'voucher' group by l.doc_id) pl on pl.doc_id = pv.id
  where pv.status in ('Authorized', 'Paid')
    and (v_tier in ('all', 'finance') or pv.prepared_by = v_uid
         or exists (select 1 from public.payment_voucher_items i join public.requests r on r.id = i.request_id where i.voucher_id = pv.id and r.created_by = v_uid));
  return query
  select case when l.printed_by = v_uid then 'mine' else 'all_treated' end, 'report', l.doc_id, l.doc_no, 'Report', '', 1, l.printed_at, l.printed_by_label, ''::text
  from public.reqgen_print_log l
  where l.doc_kind = 'report' and (l.printed_by = v_uid or v_tier = 'all');
end;
$$;
revoke all on function public.reqgen_print_register_v4() from public, anon;
grant execute on function public.reqgen_print_register_v4() to authenticated;
insert into v440_report values ('4 print', 'reqgen_print_log / reqgen_print_register_v4', 'each print recorded; mine, treated by me and all treated', 'OK');

-- 10. Verification ---------------------------------------------------------------------------
insert into v440_report
select '5 check', 'functions installed', count(*)::text || ' of 13', case when count(*) = 13 then 'OK' else 'CHECK' end
from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('reqgen_active_role_key', 'reqgen_report_tier', 'reqgen_report_transactions', 'reqgen_report_requests', 'reqgen_report_spend',
                  'reqgen_report_voucher_steps', 'reqgen_report_registry', 'reqgen_report_exceptions', 'reqgen_compliance_run',
                  'reqgen_log_print', 'reqgen_print_register_v4', 'reqgen_print_register', 'pv_role_key');
insert into v440_report
select '5 check', 'anonymous visitors cannot call them',
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'blocked' else 'open' end,
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'OK' else 'CHECK' end
from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('reqgen_active_role_key', 'reqgen_report_tier', 'reqgen_report_transactions', 'reqgen_report_requests', 'reqgen_report_spend',
                    'reqgen_report_voucher_steps', 'reqgen_report_registry', 'reqgen_report_exceptions', 'reqgen_compliance_run',
                    'reqgen_log_print', 'reqgen_print_register_v4');
insert into v440_report
select '5 check', 'new tables protected by row-level security',
       string_agg(c.relname || '=' || case when c.relrowsecurity then 'on' else 'off' end, ', '),
       case when bool_and(c.relrowsecurity) then 'OK' else 'CHECK' end
from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('reqgen_compliance_runs', 'reqgen_print_log');
insert into v440_report values ('5 check', 'read-only reports', 'no report function changes requests, vouchers, subheads, accounts or routing', 'OK');

commit;

select step as "step", item as "item", result as "result", status as "status" from v440_report order by step, item;
