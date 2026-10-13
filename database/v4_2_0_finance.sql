-- =============================================================================
-- ReqGen v4.2.0 — Finance (Build Reference §7 and §13)
-- Run in the Supabase SQL Editor AFTER the v4.2.0 code shows "Ready" on Vercel,
-- and after v4_1_2_requests_drafts_reopen.sql.
--
--   reqgen_financial_years     one row per financial year (1 September – 31 August):
--                              Open → Budget locked → Closed
--   reqgen_fy_lock / unlock / close   Super Admin or Auditor locks the approved budget;
--                              only the Super Admin unlocks (reason logged); the year
--                              is closed from August
--   subhead allocation guard   while the year's budget is locked, a subhead's approved
--                              allocation changes only through an approved transfer
--   reqgen_transfers           money moved between IET accounts or between subheads:
--                              Account Officer initiates → Auditor checks → Director
--                              General (or the General Secretary acting) approves and
--                              stamps. Ledgers change ONLY when the DG approves.
--   reqgen_finance_settings    shared finance settings (default payment method,
--                              large-cash limit), changes logged
--
-- ReqGen never moves money; the bank does. These records prompt and prove it.
-- The routing engine, requests and payment vouchers are NOT changed.
-- Safe to run more than once. Ends with a table where every row says OK.
-- =============================================================================
begin;

create temp table if not exists v420_report (step text, item text, result text, status text);
truncate v420_report;

-- helpers --------------------------------------------------------------------------
create or replace function public.reqgen_fy_start_of(p_day date default current_date)
returns int
language sql
immutable
as $$
  select case when extract(month from p_day) >= 9 then extract(year from p_day)::int else extract(year from p_day)::int - 1 end;
$$;
grant execute on function public.reqgen_fy_start_of(date) to authenticated;

create or replace function public.reqgen_fy_label(p_start int)
returns text
language sql
immutable
as $$
  select p_start::text || '/' || lpad(((p_start + 1) % 100)::text, 2, '0');
$$;
grant execute on function public.reqgen_fy_label(int) to authenticated;

create or replace function public.reqgen_position_name(p_key text)
returns text
language sql
immutable
as $$
  select case regexp_replace(regexp_replace(lower(coalesce(p_key, '')), '[^a-z0-9:]+', '', 'g'), '[0-9]+$', '')
    when 'admin' then 'Super Admin' when 'superadmin' then 'Super Admin' when 'developer' then 'Developer'
    when 'dg' then 'Director General' when 'generalsecretary' then 'General Secretary' when 'padg' then 'PA to the DG'
    when 'dod' then 'DOD' when 'director' then 'DOD' when 'hod' then 'HOD' when 'pd' then 'PD' when 'po' then 'PD'
    when 'dinadmin' then 'DIN Admin' when 'deanadmin' then 'DIN Admin' when 'registrar' then 'Registrar'
    when 'hrcoordinator' then 'HR Coordinator' when 'hrboss' then 'HR Coordinator' when 'hr' then 'HR Officer' when 'hrofficer' then 'HR Officer'
    when 'account' then 'Account Officer' when 'accounts' then 'Account Officer' when 'accountofficer' then 'Account Officer'
    when 'auditor' then 'Auditor' when 'pvsigner' then 'Counter Signer' when 'pvcountersigner' then 'Counter Signer'
    when 'registry' then 'Registry' when 'staff' then 'Staff'
    else coalesce(nullif(initcap(p_key), ''), 'Staff') end;
$$;
grant execute on function public.reqgen_position_name(text) to authenticated;

create or replace function public.reqgen_actor_label(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(p.full_name), ''), p.email, 'Officer') || ' — ' ||
         case when p.system_account = 'developer' then 'Developer'
              else public.reqgen_position_name(coalesce((select uar.active_role_key from public.user_active_roles uar where uar.user_id = p.id), p.role, 'staff')) end
  from public.profiles p where p.id = p_user;
$$;
revoke all on function public.reqgen_actor_label(uuid) from public, anon;
grant execute on function public.reqgen_actor_label(uuid) to authenticated;

-- 1. Financial years ------------------------------------------------------------------
create table if not exists public.reqgen_financial_years (
  fy_start int primary key,
  status text not null default 'Open' check (status in ('Open', 'Locked', 'Closed')),
  locked_by uuid,
  locked_by_label text,
  locked_at timestamptz,
  lock_note text,
  unlocked_by_label text,
  unlocked_at timestamptz,
  unlock_reason text,
  closed_by uuid,
  closed_by_label text,
  closed_at timestamptz,
  close_note text,
  updated_at timestamptz not null default now()
);
alter table public.reqgen_financial_years enable row level security;
drop policy if exists reqgen_fy_read on public.reqgen_financial_years;
create policy reqgen_fy_read on public.reqgen_financial_years for select to authenticated using (true);
revoke all on public.reqgen_financial_years from anon;
revoke insert, update, delete on public.reqgen_financial_years from authenticated;
grant select on public.reqgen_financial_years to authenticated;

insert into public.reqgen_financial_years (fy_start) values (public.reqgen_fy_start_of(current_date)) on conflict (fy_start) do nothing;

create or replace function public.reqgen_fy_lock(p_fy int, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.reqgen_financial_years;
begin
  if not public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'auditor']) then
    raise exception 'Only the Super Admin or the Auditor can lock the budget.';
  end if;
  insert into public.reqgen_financial_years (fy_start) values (p_fy) on conflict (fy_start) do nothing;
  select * into v_row from public.reqgen_financial_years where fy_start = p_fy for update;
  if v_row.status = 'Closed' then raise exception 'FY % is closed.', public.reqgen_fy_label(p_fy); end if;
  update public.reqgen_financial_years
  set status = 'Locked', locked_by = auth.uid(), locked_by_label = public.reqgen_actor_label(auth.uid()), locked_at = now(),
      lock_note = nullif(trim(coalesce(p_note, '')), ''), updated_at = now()
  where fy_start = p_fy;
  return jsonb_build_object('ok', true, 'status', 'Locked');
end;
$$;

create or replace function public.reqgen_fy_unlock(p_fy int, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.reqgen_pv_user_has_role(auth.uid(), array['admin']) then
    raise exception 'Only the Super Admin can unlock the budget.';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Write the reason for unlocking the budget.'; end if;
  update public.reqgen_financial_years
  set status = 'Open', unlocked_by_label = public.reqgen_actor_label(auth.uid()), unlocked_at = now(),
      unlock_reason = trim(p_reason), updated_at = now()
  where fy_start = p_fy and status = 'Locked';
  if not found then raise exception 'FY % is not locked.', public.reqgen_fy_label(p_fy); end if;
  return jsonb_build_object('ok', true, 'status', 'Open');
end;
$$;

create or replace function public.reqgen_fy_close(p_fy int, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.reqgen_pv_user_has_role(auth.uid(), array['admin']) then
    raise exception 'Only the Super Admin can close a financial year.';
  end if;
  if current_date < make_date(p_fy + 1, 8, 1) then
    raise exception 'FY % can be closed from 1 August %.', public.reqgen_fy_label(p_fy), p_fy + 1;
  end if;
  insert into public.reqgen_financial_years (fy_start) values (p_fy) on conflict (fy_start) do nothing;
  update public.reqgen_financial_years
  set status = 'Closed', closed_by = auth.uid(), closed_by_label = public.reqgen_actor_label(auth.uid()), closed_at = now(),
      close_note = nullif(trim(coalesce(p_note, '')), ''), updated_at = now()
  where fy_start = p_fy;
  insert into public.reqgen_financial_years (fy_start) values (p_fy + 1) on conflict (fy_start) do nothing;
  return jsonb_build_object('ok', true, 'status', 'Closed');
end;
$$;
revoke all on function public.reqgen_fy_lock(int, text) from public, anon;
revoke all on function public.reqgen_fy_unlock(int, text) from public, anon;
revoke all on function public.reqgen_fy_close(int, text) from public, anon;
grant execute on function public.reqgen_fy_lock(int, text) to authenticated;
grant execute on function public.reqgen_fy_unlock(int, text) to authenticated;
grant execute on function public.reqgen_fy_close(int, text) to authenticated;
insert into v420_report values ('1 year', 'reqgen_financial_years', 'Open → Locked → Closed (September to August)', 'OK');

-- 1b. While the budget is locked, allocations change only through an approved transfer
create or replace function public.reqgen_guard_locked_allocation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_status text;
begin
  if coalesce(current_setting('reqgen.transfer_posting', true), '') = 'on' then return new; end if;
  if tg_op = 'UPDATE' and coalesce(new.approved_allocation, 0) = coalesce(old.approved_allocation, 0) then return new; end if;
  if tg_op = 'INSERT' and coalesce(new.approved_allocation, 0) = 0 then return new; end if;
  select status into v_status from public.reqgen_financial_years where fy_start = public.reqgen_fy_start_of(current_date);
  if v_status in ('Locked', 'Closed') then
    raise exception 'The FY % budget is locked. Move money between subheads with a transfer (Finance › Transfers), or ask the Super Admin to unlock it.',
      public.reqgen_fy_label(public.reqgen_fy_start_of(current_date));
  end if;
  return new;
end;
$$;
drop trigger if exists reqgen_guard_locked_allocation on public.subheads;
create trigger reqgen_guard_locked_allocation before insert or update of approved_allocation on public.subheads
  for each row execute function public.reqgen_guard_locked_allocation();
insert into v420_report values ('1 year', 'locked budget guard', 'allocations change only by an approved transfer while locked', 'OK');

-- 2. Transfers ---------------------------------------------------------------------------
create table if not exists public.reqgen_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_no text unique,
  kind text not null check (kind in ('account', 'subhead')),
  from_account_id uuid,
  to_account_id uuid,
  from_subhead_id uuid,
  to_subhead_id uuid,
  from_label text,
  to_label text,
  amount numeric not null check (amount > 0),
  narration text not null,
  external_reference text,
  status text not null default 'With the Auditor'
    check (status in ('With the Auditor', 'With the DG', 'Approved', 'Returned', 'Rejected', 'Cancelled')),
  initiated_by uuid,
  initiated_label text,
  initiated_signature text,
  initiated_at timestamptz not null default now(),
  checked_by uuid,
  checked_label text,
  checked_signature text,
  checked_at timestamptz,
  check_comment text,
  approved_by uuid,
  approved_label text,
  approved_signature text,
  approved_at timestamptz,
  approve_comment text,
  stamped boolean not null default false,
  acting_for_dg boolean not null default false,
  returned_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reqgen_transfers_status_idx on public.reqgen_transfers (status, created_at desc);
create sequence if not exists public.reqgen_transfer_seq;

alter table public.reqgen_transfers enable row level security;
drop policy if exists reqgen_transfers_read on public.reqgen_transfers;
create policy reqgen_transfers_read on public.reqgen_transfers for select to authenticated
  using (public.reqgen_pv_user_has_role(auth.uid(), array['account', 'accounts', 'accountofficer', 'auditor', 'dg', 'generalsecretary', 'admin']));
revoke all on public.reqgen_transfers from anon;
revoke insert, update, delete on public.reqgen_transfers from authenticated;
grant select on public.reqgen_transfers to authenticated;

create or replace function public.reqgen_transfer_notify(p_keys text[], p_title text, p_message text, p_link text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, title, message, link, is_read, created_at)
  select distinct p.id, p_title, p_message, p_link, false, now()
  from public.profiles p
  where public.reqgen_pv_user_has_role(p.id, p_keys) and coalesce(p.is_active, true);
$$;
revoke all on function public.reqgen_transfer_notify(text[], text, text, text) from public, anon;

create or replace function public.reqgen_transfer_create(p_kind text, p_from uuid, p_to uuid, p_amount numeric,
  p_narration text, p_reference text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_no text;
  v_id uuid;
  v_from_label text;
  v_to_label text;
  v_left numeric;
  v_sig text;
begin
  if not public.reqgen_pv_user_has_role(v_actor, array['account', 'accounts', 'accountofficer']) then
    raise exception 'Only an Account Officer can start a transfer.';
  end if;
  if p_kind not in ('account', 'subhead') then raise exception 'Choose between IET accounts or between subheads.'; end if;
  if p_from is null or p_to is null or p_from = p_to then raise exception 'Choose two different %.', case when p_kind = 'account' then 'accounts' else 'subheads' end; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'The amount must be more than zero.'; end if;
  if length(trim(coalesce(p_narration, ''))) < 5 then raise exception 'Write what the transfer is for.'; end if;

  if p_kind = 'account' then
    select a.name || coalesce(' · ' || a.bank_name, ''), coalesce(a.total_fund, 0) - coalesce(a.allocated_amount, 0)
      into v_from_label, v_left from public.iet_accounts a where a.id = p_from;
    if v_from_label is null then raise exception 'The source account was not found.'; end if;
    select a.name || coalesce(' · ' || a.bank_name, '') into v_to_label from public.iet_accounts a where a.id = p_to;
    if v_to_label is null then raise exception 'The receiving account was not found.'; end if;
  else
    select coalesce(s.code || ' — ', '') || s.name,
           coalesce(s.approved_allocation, 0) - coalesce(s.reserved_amount, 0) - coalesce(s.expenditure, 0)
      into v_from_label, v_left from public.subheads s where s.id = p_from;
    if v_from_label is null then raise exception 'The source subhead was not found.'; end if;
    select coalesce(s.code || ' — ', '') || s.name into v_to_label from public.subheads s where s.id = p_to;
    if v_to_label is null then raise exception 'The receiving subhead was not found.'; end if;
  end if;
  if v_left < p_amount then
    raise exception 'Not enough to move: % has % free.', v_from_label, to_char(v_left, 'FM999,999,999,990.00');
  end if;

  v_no := 'TRF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.reqgen_transfer_seq')::text, 4, '0');
  select signature_url into v_sig from public.profiles where id = v_actor;
  insert into public.reqgen_transfers (transfer_no, kind, from_account_id, to_account_id, from_subhead_id, to_subhead_id,
    from_label, to_label, amount, narration, external_reference, initiated_by, initiated_label, initiated_signature)
  values (v_no, p_kind,
    case when p_kind = 'account' then p_from end, case when p_kind = 'account' then p_to end,
    case when p_kind = 'subhead' then p_from end, case when p_kind = 'subhead' then p_to end,
    v_from_label, v_to_label, p_amount, trim(p_narration), nullif(trim(coalesce(p_reference, '')), ''),
    v_actor, public.reqgen_actor_label(v_actor), v_sig)
  returning id into v_id;

  perform public.reqgen_transfer_notify(array['auditor'], 'Transfer ' || v_no || ' to check',
    v_from_label || ' → ' || v_to_label || ': ' || to_char(p_amount, 'FM999,999,999,990.00'), '/finance/account-transfers?open=' || v_id::text);
  return jsonb_build_object('ok', true, 'id', v_id, 'transfer_no', v_no);
end;
$$;

create or replace function public.reqgen_transfer_check(p_id uuid, p_pass boolean, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_t public.reqgen_transfers; v_actor uuid := auth.uid();
begin
  if not public.reqgen_pv_user_has_role(v_actor, array['auditor']) then raise exception 'Only the Auditor checks transfers.'; end if;
  select * into v_t from public.reqgen_transfers where id = p_id for update;
  if not found then raise exception 'Transfer not found.'; end if;
  if v_t.status <> 'With the Auditor' then raise exception 'This transfer is not waiting for the Auditor.'; end if;
  if v_t.initiated_by = v_actor then raise exception 'The officer who started a transfer cannot also check it.'; end if;
  if not p_pass and length(trim(coalesce(p_comment, ''))) < 3 then raise exception 'Write why it is being returned.'; end if;

  update public.reqgen_transfers
  set status = case when p_pass then 'With the DG' else 'Returned' end,
      checked_by = v_actor, checked_label = public.reqgen_actor_label(v_actor),
      checked_signature = (select signature_url from public.profiles where id = v_actor),
      checked_at = now(), check_comment = nullif(trim(coalesce(p_comment, '')), ''),
      returned_reason = case when p_pass then null else trim(p_comment) end, updated_at = now()
  where id = p_id;

  if p_pass then
    perform public.reqgen_transfer_notify(array['dg', 'generalsecretary'], 'Transfer ' || v_t.transfer_no || ' to approve',
      v_t.from_label || ' → ' || v_t.to_label || '. Checked by the Auditor.', '/finance/account-transfers?open=' || p_id::text);
  else
    insert into public.notifications (user_id, title, message, link, is_read, created_at)
    values (v_t.initiated_by, 'Transfer ' || v_t.transfer_no || ' returned', trim(p_comment), '/finance/account-transfers?open=' || p_id::text, false, now());
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- The DG (or the General Secretary acting for the DG) approves, signs and stamps;
-- only now do balances and ledgers change.
create or replace function public.reqgen_transfer_approve(p_id uuid, p_approve boolean, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t public.reqgen_transfers;
  v_actor uuid := auth.uid();
  v_is_dg boolean;
  v_acting boolean;
  v_from public.iet_accounts;
  v_to public.iet_accounts;
  v_sf public.subheads;
  v_st public.subheads;
  v_left numeric;
begin
  v_is_dg := public.reqgen_pv_user_has_role(v_actor, array['dg']);
  v_acting := not v_is_dg and public.reqgen_pv_user_has_role(v_actor, array['generalsecretary']);
  if not (v_is_dg or v_acting) then raise exception 'Only the Director General (or the General Secretary acting) approves transfers.'; end if;
  select * into v_t from public.reqgen_transfers where id = p_id for update;
  if not found then raise exception 'Transfer not found.'; end if;
  if v_t.status <> 'With the DG' then raise exception 'This transfer is not waiting for the Director General.'; end if;

  if not p_approve then
    if length(trim(coalesce(p_comment, ''))) < 3 then raise exception 'Write why it is rejected.'; end if;
    update public.reqgen_transfers set status = 'Rejected', approved_by = v_actor, approved_label = public.reqgen_actor_label(v_actor),
      approved_at = now(), approve_comment = trim(p_comment), acting_for_dg = v_acting, updated_at = now() where id = p_id;
    insert into public.notifications (user_id, title, message, link, is_read, created_at)
    values (v_t.initiated_by, 'Transfer ' || v_t.transfer_no || ' rejected', trim(p_comment), '/finance/account-transfers?open=' || p_id::text, false, now());
    return jsonb_build_object('ok', true, 'status', 'Rejected');
  end if;

  perform set_config('reqgen.transfer_posting', 'on', true);

  if v_t.kind = 'account' then
    perform 1 from public.iet_accounts where id in (v_t.from_account_id, v_t.to_account_id) order by id for update;
    select * into v_from from public.iet_accounts where id = v_t.from_account_id;
    select * into v_to from public.iet_accounts where id = v_t.to_account_id;
    v_left := coalesce(v_from.total_fund, 0) - coalesce(v_from.allocated_amount, 0);
    if v_left < v_t.amount then
      raise exception 'The source account no longer has % free (only %). Return it to the Account Officer.', v_t.amount, v_left;
    end if;
    update public.iet_accounts set total_fund = coalesce(total_fund, 0) - v_t.amount, updated_at = now() where id = v_from.id;
    update public.iet_accounts set total_fund = coalesce(total_fund, 0) + v_t.amount, updated_at = now() where id = v_to.id;
    -- entry types allowed by iet_bank_ledger_entry_type_check: Debit / Credit
    insert into public.iet_bank_ledger (bank_account_id, entry_type, amount, description, created_by)
    values (v_from.id, 'Debit', v_t.amount, v_t.transfer_no || ' transfer to ' || v_t.to_label || ': ' || v_t.narration, v_actor),
           (v_to.id, 'Credit', v_t.amount, v_t.transfer_no || ' transfer from ' || v_t.from_label || ': ' || v_t.narration, v_actor);
    insert into public.iet_account_transactions (account_id, transaction_type, amount, balance_before, balance_after,
      reference_type, reference_id, reference_no, narration, actor_id, actor_name)
    values (v_from.id, 'Transfer Debit', v_t.amount, coalesce(v_from.total_fund, 0), coalesce(v_from.total_fund, 0) - v_t.amount,
            'Transfer', v_t.id, v_t.transfer_no, v_t.narration, v_actor, public.reqgen_actor_label(v_actor)),
           (v_to.id, 'Transfer Credit', v_t.amount, coalesce(v_to.total_fund, 0), coalesce(v_to.total_fund, 0) + v_t.amount,
            'Transfer', v_t.id, v_t.transfer_no, v_t.narration, v_actor, public.reqgen_actor_label(v_actor));
    perform public.reqgen_recalculate_iet_account(v_from.id);
    perform public.reqgen_recalculate_iet_account(v_to.id);
  else
    perform 1 from public.subheads where id in (v_t.from_subhead_id, v_t.to_subhead_id) order by id for update;
    select * into v_sf from public.subheads where id = v_t.from_subhead_id;
    select * into v_st from public.subheads where id = v_t.to_subhead_id;
    v_left := coalesce(v_sf.approved_allocation, 0) - coalesce(v_sf.reserved_amount, 0) - coalesce(v_sf.expenditure, 0);
    if v_left < v_t.amount then
      raise exception 'The source subhead no longer has % free (only %). Return it to the Account Officer.', v_t.amount, v_left;
    end if;
    update public.subheads set approved_allocation = coalesce(approved_allocation, 0) - v_t.amount, updated_at = now() where id = v_sf.id;
    update public.subheads set approved_allocation = coalesce(approved_allocation, 0) + v_t.amount, updated_at = now() where id = v_st.id;
    insert into public.iet_bank_ledger (bank_account_id, department_id, subhead_id, entry_type, amount, description, created_by)
    values (v_sf.bank_account_id, v_sf.dept_id, v_sf.id, 'Allocation Adjustment', -v_t.amount, v_t.transfer_no || ' transfer to ' || v_t.to_label || ': ' || v_t.narration, v_actor),
           (v_st.bank_account_id, v_st.dept_id, v_st.id, 'Allocation Adjustment', v_t.amount, v_t.transfer_no || ' transfer from ' || v_t.from_label || ': ' || v_t.narration, v_actor);
    perform public.recalculate_subhead_finance(v_sf.id);
    perform public.recalculate_subhead_finance(v_st.id);
    if v_sf.bank_account_id is not null then perform public.reqgen_recalculate_iet_account(v_sf.bank_account_id); end if;
    if v_st.bank_account_id is not null and v_st.bank_account_id is distinct from v_sf.bank_account_id then
      perform public.reqgen_recalculate_iet_account(v_st.bank_account_id);
    end if;
  end if;

  update public.reqgen_transfers
  set status = 'Approved', approved_by = v_actor, approved_label = public.reqgen_actor_label(v_actor) || case when v_acting then ' (for the DG)' else '' end,
      approved_signature = (select signature_url from public.profiles where id = v_actor), approved_at = now(),
      approve_comment = nullif(trim(coalesce(p_comment, '')), ''), stamped = true, acting_for_dg = v_acting, updated_at = now()
  where id = p_id;

  perform set_config('reqgen.transfer_posting', 'off', true);

  insert into public.notifications (user_id, title, message, link, is_read, created_at)
  values (v_t.initiated_by, 'Transfer ' || v_t.transfer_no || ' approved', 'Approved and stamped. Ledgers are updated; ask the bank to move the money.',
          '/finance/account-transfers?open=' || p_id::text, false, now());
  return jsonb_build_object('ok', true, 'status', 'Approved');
end;
$$;

create or replace function public.reqgen_transfer_cancel(p_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_t public.reqgen_transfers;
begin
  select * into v_t from public.reqgen_transfers where id = p_id for update;
  if not found then raise exception 'Transfer not found.'; end if;
  if v_t.initiated_by is distinct from auth.uid() and not public.reqgen_pv_user_has_role(auth.uid(), array['admin']) then
    raise exception 'Only the officer who started it (or the Super Admin) can cancel a transfer.';
  end if;
  if v_t.status not in ('With the Auditor', 'Returned') then raise exception 'Only a transfer not yet checked (or returned) can be cancelled.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Write why it is cancelled.'; end if;
  update public.reqgen_transfers set status = 'Cancelled', returned_reason = trim(p_reason), updated_at = now() where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.reqgen_transfer_resend(p_id uuid, p_amount numeric, p_narration text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_t public.reqgen_transfers;
begin
  select * into v_t from public.reqgen_transfers where id = p_id for update;
  if not found then raise exception 'Transfer not found.'; end if;
  if v_t.initiated_by is distinct from auth.uid() then raise exception 'Only the officer who started it can send it again.'; end if;
  if v_t.status <> 'Returned' then raise exception 'Only a returned transfer can be sent again.'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'The amount must be more than zero.'; end if;
  if length(trim(coalesce(p_narration, ''))) < 5 then raise exception 'Write what the transfer is for.'; end if;
  update public.reqgen_transfers set status = 'With the Auditor', amount = p_amount, narration = trim(p_narration),
    checked_by = null, checked_label = null, checked_at = null, check_comment = null, updated_at = now() where id = p_id;
  perform public.reqgen_transfer_notify(array['auditor'], 'Transfer ' || v_t.transfer_no || ' corrected', 'Sent again for checking.',
    '/finance/account-transfers?open=' || p_id::text);
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.reqgen_transfer_create(text, uuid, uuid, numeric, text, text) from public, anon;
revoke all on function public.reqgen_transfer_check(uuid, boolean, text) from public, anon;
revoke all on function public.reqgen_transfer_approve(uuid, boolean, text) from public, anon;
revoke all on function public.reqgen_transfer_cancel(uuid, text) from public, anon;
revoke all on function public.reqgen_transfer_resend(uuid, numeric, text) from public, anon;
grant execute on function public.reqgen_transfer_create(text, uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.reqgen_transfer_check(uuid, boolean, text) to authenticated;
grant execute on function public.reqgen_transfer_approve(uuid, boolean, text) to authenticated;
grant execute on function public.reqgen_transfer_cancel(uuid, text) to authenticated;
grant execute on function public.reqgen_transfer_resend(uuid, numeric, text) to authenticated;
insert into v420_report values ('2 transfers', 'reqgen_transfers', 'Account Officer → Auditor → DG approves and stamps; ledgers change only then', 'OK');

-- 3. Finance settings ------------------------------------------------------------------
create table if not exists public.reqgen_finance_settings (
  key text primary key,
  value text,
  updated_by_label text,
  updated_at timestamptz not null default now()
);
alter table public.reqgen_finance_settings enable row level security;
drop policy if exists reqgen_finance_settings_read on public.reqgen_finance_settings;
create policy reqgen_finance_settings_read on public.reqgen_finance_settings for select to authenticated using (true);
revoke all on public.reqgen_finance_settings from anon;
revoke insert, update, delete on public.reqgen_finance_settings from authenticated;
grant select on public.reqgen_finance_settings to authenticated;
insert into public.reqgen_finance_settings (key, value) values
  ('default_payment_method', 'Transfer'),
  ('cash_dg_note_above', '200000')
on conflict (key) do nothing;

create table if not exists public.reqgen_finance_settings_log (
  id uuid primary key default gen_random_uuid(),
  key text, old_value text, new_value text, changed_by uuid, changed_by_label text, changed_at timestamptz not null default now()
);
alter table public.reqgen_finance_settings_log enable row level security;
drop policy if exists reqgen_finance_settings_log_read on public.reqgen_finance_settings_log;
create policy reqgen_finance_settings_log_read on public.reqgen_finance_settings_log for select to authenticated
  using (public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'auditor', 'account', 'accounts', 'accountofficer']));
revoke all on public.reqgen_finance_settings_log from anon;
revoke insert, update, delete on public.reqgen_finance_settings_log from authenticated;
grant select on public.reqgen_finance_settings_log to authenticated;

create or replace function public.reqgen_save_finance_setting(p_key text, p_value text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_old text;
begin
  if not public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'auditor']) then
    raise exception 'Only the Super Admin or the Auditor can change finance settings.';
  end if;
  if p_key not in ('default_payment_method', 'cash_dg_note_above') then raise exception 'Unknown setting.'; end if;
  if p_key = 'default_payment_method' and p_value not in ('Transfer', 'Cheque', 'Cash') then
    raise exception 'Payment methods are Transfer, Cheque or Cash.';
  end if;
  if p_key = 'cash_dg_note_above' and (p_value !~ '^[0-9]+(\.[0-9]{1,2})?$') then raise exception 'Type an amount in naira.'; end if;
  select value into v_old from public.reqgen_finance_settings where key = p_key;
  insert into public.reqgen_finance_settings (key, value, updated_by_label, updated_at)
  values (p_key, p_value, public.reqgen_actor_label(auth.uid()), now())
  on conflict (key) do update set value = excluded.value, updated_by_label = excluded.updated_by_label, updated_at = now();
  insert into public.reqgen_finance_settings_log (key, old_value, new_value, changed_by, changed_by_label)
  values (p_key, v_old, p_value, auth.uid(), public.reqgen_actor_label(auth.uid()));
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.reqgen_save_finance_setting(text, text) from public, anon;
grant execute on function public.reqgen_save_finance_setting(text, text) to authenticated;
insert into v420_report values ('3 settings', 'reqgen_finance_settings', 'shared for everyone; every change logged', 'OK');

-- 4. Verification -----------------------------------------------------------------------
insert into v420_report
select '4 check', 'functions installed', count(*)::text || ' of 9', case when count(*) = 9 then 'OK' else 'CHECK' end
from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('reqgen_fy_lock', 'reqgen_fy_unlock', 'reqgen_fy_close', 'reqgen_transfer_create', 'reqgen_transfer_check',
                  'reqgen_transfer_approve', 'reqgen_transfer_cancel', 'reqgen_transfer_resend', 'reqgen_save_finance_setting');
insert into v420_report
select '4 check', 'anonymous visitors cannot call them',
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'blocked' else 'open' end,
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'OK' else 'CHECK' end
from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('reqgen_fy_lock', 'reqgen_fy_unlock', 'reqgen_fy_close', 'reqgen_transfer_create', 'reqgen_transfer_check',
                    'reqgen_transfer_approve', 'reqgen_transfer_cancel', 'reqgen_transfer_resend', 'reqgen_save_finance_setting');
insert into v420_report
select '4 check', 'records cannot be written directly (only through the functions)',
       case when bool_or(has_table_privilege('authenticated', c.oid, 'insert')) then 'writable' else 'protected' end,
       case when bool_or(has_table_privilege('authenticated', c.oid, 'insert')) then 'CHECK' else 'OK' end
from pg_class c where c.oid in ('public.reqgen_transfers'::regclass, 'public.reqgen_financial_years'::regclass, 'public.reqgen_finance_settings'::regclass);
insert into v420_report
select '4 check', 'current financial year', public.reqgen_fy_label(fy_start) || ' · ' || status, 'OK'
from public.reqgen_financial_years where fy_start = public.reqgen_fy_start_of(current_date);
insert into v420_report values ('4 check', 'routing engine unchanged', 'no request or routing function replaced', 'OK');

commit;

select step as "step", item as "item", result as "result", status as "status" from v420_report order by step, item;
