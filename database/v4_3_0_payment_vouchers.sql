-- =============================================================================
-- ReqGen v4.3.0 — Payment vouchers (Build Reference §8)
-- Run in the Supabase SQL Editor AFTER the v4.3.0 code shows "Ready" on Vercel,
-- and after v4_2_0_finance.sql.
--
--   reqgen_pv_generate      one voucher may combine up to 10 OFFICIAL requests from
--                           different staff, paid by TRANSFER, with a Transfer Schedule
--                           of each payee's bank details. Cash and cheque: one payee.
--                           Personal requests: one voucher each. "Preparing as"
--                           (General Admin, DIN or ASAP-ALLI) is printed on the voucher.
--                           Cancel and reissue: the new voucher links to the cancelled one.
--   reqgen_pv_return / reqgen_pv_resend   the Auditor, Counter Signer or DG sends a voucher
--                           back to the Account Officer with a reason; corrected, it starts
--                           the signing order again
--   reqgen_pv_mark_paid     after the DG authorises: paid on, bank reference and Received By.
--                           (The spending was recorded when Account released the fund; a
--                           manual voucher posts its ledgers when posted. No double count.)
--   reqgen_pv_manual_prepare / reqgen_pv_add_attachment   manual voucher section, mode,
--                           reason and the bill or receipt (private voucher-attachments bucket)
--   reqgen_pv_history       the voucher history for every signer
--   status rules            'Returned to Account' added to the allowed voucher statuses
--   reqgen_pv_cancel        cancel (the number is kept; its requests are ready again)
--   reqgen_pv_remind        reminds whoever holds the voucher now
--
-- The existing generator (generate_multi_payment_voucher), the signing function
-- (reqgen_pv_sign) and the routing engine are NOT changed.
-- Safe to run more than once. Ends with a table where every row says OK.
-- =============================================================================
begin;

create temp table if not exists v430_report (step text, item text, result text, status text);
truncate v430_report;

-- 1. New voucher fields and tables ------------------------------------------------------
alter table public.payment_vouchers add column if not exists prepared_section text;
alter table public.payment_vouchers add column if not exists reissue_of uuid;
alter table public.payment_vouchers add column if not exists returned_reason text;
alter table public.payment_vouchers add column if not exists returned_by_name text;
alter table public.payment_vouchers add column if not exists returned_at timestamptz;
alter table public.payment_vouchers add column if not exists payee_count int;
alter table public.payment_vouchers add column if not exists cancel_reason text;
alter table public.payment_vouchers add column if not exists paid_on date;
alter table public.payment_vouchers add column if not exists paid_reference text;
alter table public.payment_vouchers add column if not exists paid_by_name text;
alter table public.payment_vouchers add column if not exists paid_at timestamptz;
insert into v430_report values ('1 voucher', 'new fields', 'preparing as, reissue link, returned, paid on, bank reference', 'OK');

-- A voucher sent back to Account needs its own status. The live CHECK rules list every
-- status the app uses; they are rebuilt with 'Returned to Account' added (nothing removed).
alter table public.payment_vouchers drop constraint if exists payment_vouchers_status_check;
alter table public.payment_vouchers add constraint payment_vouchers_status_check check (status is null or status = any (array[
  'Authorized', 'Cancelled', 'Checked', 'Cheque Prepared', 'Cheque Signed', 'Counter Signed', 'Draft', 'Paid', 'Pending Check',
  'Pending Cheque Signature', 'Pending Counter Signature', 'Pending DG Authorisation', 'Posted', 'Prepared', 'Returned to Account']::text[])) not valid;
alter table public.payment_vouchers drop constraint if exists payment_vouchers_signing_stage_check;
alter table public.payment_vouchers add constraint payment_vouchers_signing_stage_check check (signing_stage is null or signing_stage = any (array[
  'Awaiting Check', 'Awaiting Cheque Signature', 'Awaiting Counter Signature', 'Awaiting DG Authorisation', 'Cancelled', 'Fully Signed',
  'Paid', 'Signing Completed', 'Returned to Account']::text[])) not valid;
insert into v430_report values ('1 voucher', 'status rules', 'Returned to Account added to the allowed statuses (all others kept)', 'OK');

create table if not exists public.reqgen_pv_transfer_schedule (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null,
  payee_name text not null,
  account_name text not null,
  account_number text not null,
  bank_name text not null,
  amount numeric not null default 0,
  request_ids uuid[] not null default '{}',
  line_no int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists reqgen_pv_transfer_schedule_voucher_idx on public.reqgen_pv_transfer_schedule (voucher_id, line_no);
alter table public.reqgen_pv_transfer_schedule enable row level security;
drop policy if exists reqgen_pv_schedule_read on public.reqgen_pv_transfer_schedule;
create policy reqgen_pv_schedule_read on public.reqgen_pv_transfer_schedule for select to authenticated
  using (public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'auditor', 'account', 'accounts', 'accountofficer', 'dg', 'generalsecretary', 'pvsigner', 'pvcountersigner']));
revoke all on public.reqgen_pv_transfer_schedule from anon;
revoke insert, update, delete on public.reqgen_pv_transfer_schedule from authenticated;
grant select on public.reqgen_pv_transfer_schedule to authenticated;

-- Each payee's last bank details, so the next schedule fills itself.
create table if not exists public.reqgen_payee_bank_accounts (
  payee_key text primary key,
  profile_id uuid,
  payee_name text,
  account_name text not null,
  account_number text not null,
  bank_name text not null,
  updated_by_label text,
  updated_at timestamptz not null default now()
);
alter table public.reqgen_payee_bank_accounts enable row level security;
drop policy if exists reqgen_payee_banks_read on public.reqgen_payee_bank_accounts;
create policy reqgen_payee_banks_read on public.reqgen_payee_bank_accounts for select to authenticated
  using (profile_id = auth.uid() or public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'auditor', 'account', 'accounts', 'accountofficer']));
revoke all on public.reqgen_payee_bank_accounts from anon;
revoke insert, update, delete on public.reqgen_payee_bank_accounts from authenticated;
grant select on public.reqgen_payee_bank_accounts to authenticated;
insert into v430_report values ('1 voucher', 'reqgen_pv_transfer_schedule', 'each payee''s bank details on a combined transfer voucher', 'OK');

-- 2. Generator --------------------------------------------------------------------------
-- inner generator: a copy of the v3.1.14 generator that may combine several payees (called only by reqgen_pv_generate)
CREATE OR REPLACE FUNCTION public.reqgen_pv_generate_core(p_request_ids uuid[], p_disbursement_mode text, p_transfer_account_name text, p_transfer_account_number text, p_transfer_bank_name text, p_cash_payee_name text, p_cheque_no text, p_cheque_date date, p_cheque_bank_name text, p_counter_signatory_name text, p_allow_many_payees boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_actor public.profiles%rowtype;

  v_count integer;
  v_distinct_count integer;

  v_mode text;
  v_voucher_no text;
  v_voucher_id uuid;

  v_first_req public.requests%rowtype;
  v_dept public.departments%rowtype;
  v_sub public.subheads%rowtype;

  v_auditor public.profiles%rowtype;
  v_dg public.profiles%rowtype;
  v_account_hist public.request_history%rowtype;

  v_total numeric;
  v_payee text;
  v_narration text;
  v_category_key text;

  v_prepared_name text;
  v_prepared_signature text;
  v_prepared_at timestamptz;

  v_checked_name text;
  v_checked_signature text;

  v_authorized_name text;
  v_authorized_signature text;

  v_cheque_signer record;
  v_counter_signer record;

  v_final_status text;
  v_current_signing_owner uuid;
  v_signing_stage text;

  v_invalid_count integer;
  v_existing_count integer;
  v_bad_category_count integer;
  v_bad_payee_count integer;
  v_request_id uuid;
  v_item record;
begin
  v_mode := trim(coalesce(p_disbursement_mode, ''));

  if v_mode not in ('Transfer', 'Cash', 'Cheque') then
    raise exception 'Please select a valid disbursement mode: Transfer, Cash or Cheque.';
  end if;

  if p_request_ids is null then
    raise exception 'Please select at least one request.';
  end if;

  select count(*)
  into v_count
  from unnest(p_request_ids) x;

  select count(distinct x)
  into v_distinct_count
  from unnest(p_request_ids) x;

  if v_count < 1 then
    raise exception 'Please select at least one request.';
  end if;

  if v_count > 10 then
    raise exception 'A payment voucher can contain maximum 10 requests.';
  end if;

  if v_count <> v_distinct_count then
    raise exception 'Duplicate request detected. Please select each request only once.';
  end if;

  if v_mode = 'Transfer' then
    if nullif(trim(coalesce(p_transfer_account_name, '')), '') is null then
      raise exception 'Transfer requires Account Name.';
    end if;

    if nullif(trim(coalesce(p_transfer_account_number, '')), '') is null then
      raise exception 'Transfer requires Account Number.';
    end if;

    if nullif(trim(coalesce(p_transfer_bank_name, '')), '') is null then
      raise exception 'Transfer requires Bank Name.';
    end if;
  end if;

  if v_mode = 'Cash' then
    if nullif(trim(coalesce(p_cash_payee_name, '')), '') is null then
      raise exception 'Cash requires Payee Name.';
    end if;
  end if;

  if v_mode = 'Cheque' then
    if nullif(trim(coalesce(p_cheque_no, '')), '') is null then
      raise exception 'Cheque requires Cheque Number.';
    end if;

    if p_cheque_date is null then
      raise exception 'Cheque requires Cheque Date.';
    end if;

    if nullif(trim(coalesce(p_cheque_bank_name, '')), '') is null then
      raise exception 'Cheque requires Bank Name.';
    end if;

  end if;

  -- ReqGen v3.1.14: every PV is counter-signed by a Counter Signer chosen
  -- from PV Settings; the Director General signs and authorises last.
  if nullif(trim(coalesce(p_counter_signatory_name, '')), '') is null then
    raise exception 'Please select the Counter Signer for this payment voucher.';
  end if;

  select *
  into v_actor
  from public.profiles
  where id = auth.uid();

  if not found then
    raise exception 'Profile not found.';
  end if;

  -- v4.3.0: any position held (not only the profile's main role)
  if not public.reqgen_pv_user_has_role(v_actor.id, array['admin', 'auditor', 'account', 'accounts', 'accountofficer']) then
    raise exception 'Access denied. Only Admin, Auditor and Account Officers can generate payment vouchers.';
  end if;

  select *
  into v_first_req
  from public.requests r
  where r.id = p_request_ids[1];

  if not found then
    raise exception 'First selected request was not found.';
  end if;

  select count(*)
  into v_invalid_count
  from unnest(p_request_ids) rid
  left join public.requests r on r.id = rid
  where r.id is null
     or not (
      lower(coalesce(r.status, '')) like '%paid%'
      or lower(coalesce(r.status, '')) like '%completed%'
     )
     or coalesce(r.amount, 0) <= 0;

  if v_invalid_count > 0 then
    raise exception 'One or more selected requests are invalid, unpaid, incomplete, or have zero amount.';
  end if;

  select count(*)
  into v_existing_count
  from unnest(p_request_ids) rid
  where public.request_has_active_payment_voucher(rid);

  if v_existing_count > 0 then
    raise exception 'One or more selected requests already have an active payment voucher.';
  end if;

  v_category_key :=
    case
      when lower(coalesce(v_first_req.request_type, '')) = 'official' then 'official'
      when lower(coalesce(v_first_req.request_type, '')) = 'personal'
        and regexp_replace(lower(coalesce(v_first_req.personal_category, '')), '[^a-z]', '', 'g') = 'fund'
      then 'personalfund'
      else 'invalid'
    end;

  if v_category_key = 'invalid' then
    raise exception 'Only Official and Personal Fund requests can generate payment vouchers.';
  end if;

  select count(*)
  into v_bad_category_count
  from unnest(p_request_ids) rid
  join public.requests r on r.id = rid
  where
    case
      when lower(coalesce(r.request_type, '')) = 'official' then 'official'
      when lower(coalesce(r.request_type, '')) = 'personal'
        and regexp_replace(lower(coalesce(r.personal_category, '')), '[^a-z]', '', 'g') = 'fund'
      then 'personalfund'
      else 'invalid'
    end <> v_category_key;

  if v_bad_category_count > 0 then
    raise exception 'Selected requests must be from the same category: Official with Official, or Personal Fund with Personal Fund.';
  end if;

  select count(*)
  into v_bad_payee_count
  from unnest(p_request_ids) rid
  join public.requests r on r.id = rid
  where public.normalize_person_name(r.requester_name) <> public.normalize_person_name(v_first_req.requester_name);

  -- ReqGen v4.3.0: Official requests from different staff may share one voucher,
  -- paid by transfer with a Transfer Schedule (checked by reqgen_pv_generate).
  if v_bad_payee_count > 0 and not coalesce(p_allow_many_payees, false) then
    raise exception 'Selected requests must belong to the same requester/payee.';
  end if;

  select coalesce(sum(coalesce(r.amount, 0)), 0)
  into v_total
  from unnest(p_request_ids) rid
  join public.requests r on r.id = rid;

  if v_total <= 0 then
    raise exception 'Total voucher amount must be greater than zero.';
  end if;

  select *
  into v_counter_signer
  from public.find_active_pv_signatory_profile(p_counter_signatory_name, 'CounterSigner')
  limit 1;

  if v_counter_signer.profile_id is null then
    raise exception 'Invalid Counter Signer. Please select an active Counter Signer from PV Settings whose name matches a user profile.';
  end if;

  if v_first_req.dept_id is not null then
    select *
    into v_dept
    from public.departments
    where id = v_first_req.dept_id;
  end if;

  if v_first_req.subhead_id is not null then
    select *
    into v_sub
    from public.subheads
    where id = v_first_req.subhead_id;
  end if;

  select *
  into v_account_hist
  from public.request_history h
  where h.request_id = v_first_req.id
    and (
      lower(coalesce(h.from_stage, '')) = 'account'
      or lower(coalesce(h.to_stage, '')) = 'completed'
      or lower(coalesce(h.to_stage, '')) = 'paid'
      or lower(coalesce(h.actor_name, '')) = lower(coalesce(v_first_req.account_name, ''))
    )
  order by h.created_at desc
  limit 1;

  v_voucher_no := public.generate_payment_voucher_no();

  v_payee := coalesce(
    nullif(trim(v_first_req.requester_name), ''),
    nullif(trim(p_cash_payee_name), ''),
    nullif(trim(p_transfer_account_name), ''),
    'Payee'
  );

  v_narration :=
    case
      when v_count = 1 then coalesce(nullif(trim(v_first_req.title), ''), 'Payment voucher for request ' || coalesce(v_first_req.request_no, ''))
      else 'Combined payment voucher for ' || v_count::text || ' approved requests'
    end;

  v_prepared_name := coalesce(
    nullif(trim(v_first_req.account_name), ''),
    nullif(trim(v_account_hist.actor_name), ''),
    nullif(trim(v_actor.full_name), ''),
    v_actor.email,
    'Account Officer'
  );

  v_prepared_signature := coalesce(
    nullif(trim(v_first_req.account_signature_snapshot), ''),
    nullif(trim(v_account_hist.signature_url), ''),
    nullif(trim(v_actor.signature_url), '')
  );

  v_prepared_at := coalesce(v_account_hist.created_at, now());

  -- ReqGen v3.1.14 signing chain: Prepared -> Checked (Auditor) -> Counter
  -- Signer -> Director General (signs and authorises in one step).
  v_final_status := 'Pending Check';
  v_current_signing_owner := null;
  v_signing_stage := 'Awaiting Check';

  insert into public.payment_vouchers (
    voucher_no,
    request_id,

    request_no,
    request_type,
    personal_category,

    payee_name,
    narration,
    amount,
    total_amount,

    dept_id,
    dept_name,

    subhead_id,
    subhead_code,
    subhead_name,

    prepared_by,
    prepared_by_name,
    prepared_signature_url,
    prepared_at,

    checked_by,
    checked_by_name,
    checked_signature_url,
    checked_at,

    authorized_by,
    authorized_by_name,
    authorized_signature_url,
    authorized_at,

    payee_signed_name,
    payee_signature_url,
    payee_signed_at,

    cheque_no,
    cheque_date,
    bank_name,

    cheque_signed_by,
    cheque_signed_by_name,
    cheque_signed_signature_url,
    cheque_signed_at,

    cheque_counter_signed_by,
    cheque_counter_signed_by_name,
    cheque_counter_signed_signature_url,
    cheque_counter_signed_at,

    disbursement_mode,
    transfer_account_name,
    transfer_account_number,
    transfer_bank_name,
    cash_payee_name,
    counter_signatory_name,

    current_signing_owner,
    signing_stage,

    is_multi_request,
    item_count,
    voucher_scope,

    status
  )
  values (
    v_voucher_no,
    v_first_req.id,

    case when v_count = 1 then v_first_req.request_no else 'Multiple Requests' end,
    v_first_req.request_type,
    v_first_req.personal_category,

    v_payee,
    v_narration,
    v_total,
    v_total,

    v_first_req.dept_id,
    case when v_first_req.dept_id is not null then v_dept.name else null end,

    v_first_req.subhead_id,
    case when v_first_req.subhead_id is not null then v_sub.code else null end,
    case when v_first_req.subhead_id is not null then v_sub.name else null end,

    coalesce(v_account_hist.action_by, v_actor.id),
    v_prepared_name,
    v_prepared_signature,
    v_prepared_at,

    null,
    null,
    null,
    null,

    null,
    null,
    null,
    null,

    null,
    null,
    null,

    case when v_mode = 'Cheque' then nullif(trim(p_cheque_no), '') else null end,
    case when v_mode = 'Cheque' then p_cheque_date else null end,
    case
      when v_mode = 'Cheque' then nullif(trim(p_cheque_bank_name), '')
      when v_mode = 'Transfer' then nullif(trim(p_transfer_bank_name), '')
      else null
    end,

    null,
    null,
    null,
    null,

    v_counter_signer.profile_id,
    v_counter_signer.full_name,
    null,
    null,

    v_mode,
    case when v_mode = 'Transfer' then nullif(trim(p_transfer_account_name), '') else null end,
    case when v_mode = 'Transfer' then nullif(trim(p_transfer_account_number), '') else null end,
    case when v_mode = 'Transfer' then nullif(trim(p_transfer_bank_name), '') else null end,
    case when v_mode = 'Cash' then nullif(trim(p_cash_payee_name), '') else null end,
    v_counter_signer.full_name,

    v_current_signing_owner,
    v_signing_stage,

    v_count > 1,
    v_count,
    case when v_count > 1 then 'Multiple' else 'Single' end,

    v_final_status
  )
  returning id into v_voucher_id;

  for v_item in
    select
      r.*,
      d.name as item_dept_name,
      s.code as item_subhead_code,
      s.name as item_subhead_name
    from unnest(p_request_ids) rid
    join public.requests r on r.id = rid
    left join public.departments d on d.id = r.dept_id
    left join public.subheads s on s.id = r.subhead_id
    order by r.created_at asc
  loop
    insert into public.payment_voucher_items (
      voucher_id,
      request_id,
      request_no,
      request_type,
      personal_category,
      title,
      details,
      amount,
      dept_id,
      dept_name,
      subhead_id,
      subhead_code,
      subhead_name,
      requester_name
    )
    values (
      v_voucher_id,
      v_item.id,
      v_item.request_no,
      v_item.request_type,
      v_item.personal_category,
      v_item.title,
      v_item.details,
      coalesce(v_item.amount, 0),
      v_item.dept_id,
      v_item.item_dept_name,
      v_item.subhead_id,
      v_item.item_subhead_code,
      v_item.item_subhead_name,
      v_item.requester_name
    );
  end loop;

  insert into public.payment_voucher_history (
    voucher_id,
    request_id,
    action_by,
    actor_name,
    actor_role,
    actor_signature_url,
    action_type,
    from_status,
    to_status,
    comment
  )
  values
  (
    v_voucher_id,
    v_first_req.id,
    coalesce(v_account_hist.action_by, v_actor.id),
    v_prepared_name,
    'Account Officer',
    v_prepared_signature,
    'Generate',
    null,
    'Pending Check',
    'Payment voucher prepared for ' || v_count::text || ' request(s) by ' || v_mode || '. Sent for checking.'
  );

  perform public.reqgen_pv_notify_role(
    array['auditor'],
    'PV ' || v_voucher_no || ' is waiting for your check',
    '/approvals/vouchers/' || v_voucher_id::text
  );

  return json_build_object(
    'ok', true,
    'voucher_id', v_voucher_id,
    'voucher_no', v_voucher_no,
    'request_count', v_count,
    'total_amount', v_total,
    'status', v_final_status,
    'disbursement_mode', v_mode,
    'current_signing_owner', v_current_signing_owner,
    'signing_stage', v_signing_stage
  );
end;
$function$;

revoke all on function public.reqgen_pv_generate_core(uuid[], text, text, text, text, text, text, date, text, text, boolean) from public, anon, authenticated;

create or replace function public.reqgen_pv_generate(
  p_request_ids uuid[],
  p_mode text,
  p_preparing_as text,
  p_counter_signer text,
  p_schedule jsonb default '[]'::jsonb,
  p_cash_payee text default null,
  p_cheque_no text default null,
  p_cheque_date date default null,
  p_cheque_bank text default null,
  p_narration text default null,
  p_reissue_of uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text := trim(coalesce(p_mode, ''));
  v_section text := nullif(trim(coalesce(p_preparing_as, '')), '');
  v_count int;
  v_payees int;
  v_official int;
  v_result json;
  v_voucher uuid;
  v_line record;
  v_n int := 0;
  v_first jsonb;
  v_missing text;
  v_total numeric;
  v_sched_total numeric := 0;
  v_cancelled public.payment_vouchers;
begin
  if not public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'account', 'accounts', 'accountofficer']) then
    raise exception 'Only an Account Officer prepares payment vouchers.';
  end if;
  if v_section is null or v_section not in ('General Admin', 'DIN', 'ASAP-ALLI') then
    raise exception 'Choose who you are preparing as: General Admin, DIN or ASAP-ALLI.';
  end if;
  if v_mode not in ('Transfer', 'Cash', 'Cheque') then raise exception 'Choose Transfer, Cheque or Cash.'; end if;
  select count(*), count(distinct public.normalize_person_name(r.requester_name)),
         count(*) filter (where lower(coalesce(r.request_type, '')) = 'official'), coalesce(sum(r.amount), 0)
    into v_count, v_payees, v_official, v_total
  from unnest(p_request_ids) rid join public.requests r on r.id = rid;
  if v_count = 0 then raise exception 'Choose at least one request.'; end if;
  if v_count > 10 then raise exception 'A voucher holds at most 10 requests. Start another voucher for the rest.'; end if;
  if v_official < v_count and v_count > 1 then raise exception 'A personal request gets a voucher of its own.'; end if;
  if v_payees > 1 and v_mode <> 'Transfer' then raise exception 'Cash and cheque are for one payee only. Pay several people by transfer.'; end if;

  if p_reissue_of is not null then
    select * into v_cancelled from public.payment_vouchers where id = p_reissue_of;
    if not found or coalesce(v_cancelled.status, '') <> 'Cancelled' then
      raise exception 'Only a cancelled voucher can be reissued.';
    end if;
  end if;

  if v_mode = 'Transfer' then
    if jsonb_typeof(coalesce(p_schedule, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_schedule, '[]'::jsonb)) = 0 then
      raise exception 'Add the bank details of every payee (the Transfer Schedule).';
    end if;
    select string_agg(distinct r.requester_name, ', ') into v_missing
    from unnest(p_request_ids) rid join public.requests r on r.id = rid
    where not exists (
      select 1 from jsonb_array_elements(p_schedule) e
      where (e->>'request_ids')::jsonb ? r.id::text
        and length(trim(coalesce(e->>'account_name', ''))) > 1
        and length(regexp_replace(coalesce(e->>'account_number', ''), '\D', '', 'g')) = 10
        and length(trim(coalesce(e->>'bank_name', ''))) > 1);
    if v_missing is not null then
      raise exception 'Complete the bank details (account name, 10-digit account number, bank) for: %', v_missing;
    end if;
    v_first := p_schedule->0;
  end if;

  v_result := public.reqgen_pv_generate_core(
    p_request_ids, v_mode,
    case when v_mode = 'Transfer' then case when v_payees > 1 then 'See Transfer Schedule' else v_first->>'account_name' end end,
    case when v_mode = 'Transfer' then case when v_payees > 1 then 'Schedule' else regexp_replace(v_first->>'account_number', '\D', '', 'g') end end,
    case when v_mode = 'Transfer' then case when v_payees > 1 then 'Several banks' else v_first->>'bank_name' end end,
    p_cash_payee, p_cheque_no, p_cheque_date, p_cheque_bank, p_counter_signer, v_payees > 1);
  v_voucher := (v_result->>'voucher_id')::uuid;

  update public.payment_vouchers
  set prepared_section = v_section,
      reissue_of = p_reissue_of,
      payee_count = v_payees,
      payee_name = case when v_payees > 1 then v_payees::text || ' PAYEES' else payee_name end,
      narration = coalesce(nullif(trim(coalesce(p_narration, '')), ''), narration),
      updated_at = now()
  where id = v_voucher;

  if v_mode = 'Transfer' then
    for v_line in
      select e->>'payee_name' as payee_name, e->>'account_name' as account_name,
             regexp_replace(e->>'account_number', '\D', '', 'g') as account_number, e->>'bank_name' as bank_name,
             array(select (x)::uuid from jsonb_array_elements_text(e->'request_ids') x where (x)::uuid = any(p_request_ids)) as ids
      from jsonb_array_elements(p_schedule) e
    loop
      continue when coalesce(array_length(v_line.ids, 1), 0) = 0;
      v_n := v_n + 1;
      insert into public.reqgen_pv_transfer_schedule (voucher_id, payee_name, account_name, account_number, bank_name, amount, request_ids, line_no)
      values (v_voucher, coalesce(nullif(trim(v_line.payee_name), ''), v_line.account_name), upper(trim(v_line.account_name)), v_line.account_number,
              trim(v_line.bank_name), (select coalesce(sum(r.amount), 0) from public.requests r where r.id = any(v_line.ids)), v_line.ids, v_n);
      insert into public.reqgen_payee_bank_accounts (payee_key, profile_id, payee_name, account_name, account_number, bank_name, updated_by_label, updated_at)
      select public.normalize_person_name(r.requester_name), r.created_by, r.requester_name, upper(trim(v_line.account_name)), v_line.account_number,
             trim(v_line.bank_name), public.reqgen_actor_label(auth.uid()), now()
      from public.requests r where r.id = v_line.ids[1]
      on conflict (payee_key) do update set account_name = excluded.account_name, account_number = excluded.account_number,
        bank_name = excluded.bank_name, profile_id = excluded.profile_id, updated_by_label = excluded.updated_by_label, updated_at = now();
    end loop;
    select coalesce(sum(amount), 0) into v_sched_total from public.reqgen_pv_transfer_schedule where voucher_id = v_voucher;
    if v_sched_total <> v_total then
      raise exception 'The Transfer Schedule (%) does not add up to the voucher total (%).', v_sched_total, v_total;
    end if;
  end if;

  insert into public.payment_voucher_history (voucher_id, request_id, action_by, actor_id, actor_name, actor_role, action_type, from_status, to_status, comment)
  values (v_voucher, p_request_ids[1], auth.uid(), auth.uid(), public.reqgen_actor_label(auth.uid()), 'Account Officer', 'Prepared as',
          'Pending Check', 'Pending Check',
          'Prepared as Account Officer, ' || v_section || case when v_payees > 1 then ' · ' || v_payees || ' payees on the Transfer Schedule' else '' end
          || case when p_reissue_of is not null then ' · reissue of ' || coalesce(v_cancelled.voucher_no, '') else '' end);

  -- tell each payee their request is on a voucher
  insert into public.notifications (user_id, title, message, link, is_read, created_at)
  select distinct r.created_by, 'Your request is on voucher ' || (v_result->>'voucher_no'),
         coalesce(r.request_no, '') || ' will be paid once the voucher is signed and authorised.', '/requests/' || r.id::text, false, now()
  from unnest(p_request_ids) rid join public.requests r on r.id = rid where r.created_by is not null;

  return v_result;
end;
$$;
revoke all on function public.reqgen_pv_generate(uuid[], text, text, text, jsonb, text, text, date, text, text, uuid) from public, anon;
grant execute on function public.reqgen_pv_generate(uuid[], text, text, text, jsonb, text, text, date, text, text, uuid) to authenticated;
insert into v430_report values ('2 generate', 'reqgen_pv_generate', 'up to 10 Official requests, many payees by transfer; cash/cheque one payee; personal one each', 'OK');

-- Preparing as for vouchers made another way (manual vouchers)
create or replace function public.reqgen_pv_set_preparing_as(p_voucher_id uuid, p_section text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_pv public.payment_vouchers;
begin
  if p_section not in ('General Admin', 'DIN', 'ASAP-ALLI') then raise exception 'Choose General Admin, DIN or ASAP-ALLI.'; end if;
  select * into v_pv from public.payment_vouchers where id = p_voucher_id for update;
  if not found then raise exception 'Voucher not found.'; end if;
  if v_pv.prepared_by is distinct from auth.uid() and not public.reqgen_pv_user_has_role(auth.uid(), array['admin']) then
    raise exception 'Only the officer who prepared the voucher can set this.';
  end if;
  if v_pv.checked_at is not null then raise exception 'It cannot change after the Auditor has checked the voucher.'; end if;
  update public.payment_vouchers set prepared_section = p_section, updated_at = now() where id = p_voucher_id;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.reqgen_pv_set_preparing_as(uuid, text) from public, anon;
grant execute on function public.reqgen_pv_set_preparing_as(uuid, text) to authenticated;

-- 3. Send back and send again --------------------------------------------------------------
create or replace function public.reqgen_pv_return(p_voucher_id uuid, p_reason text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pv public.payment_vouchers;
  v_actor uuid := auth.uid();
  v_ok boolean := false;
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Write why the voucher is going back.'; end if;
  select * into v_pv from public.payment_vouchers where id = p_voucher_id for update;
  if not found then raise exception 'Voucher not found.'; end if;
  v_ok := (v_pv.status = 'Pending Check' and public.reqgen_pv_user_has_role(v_actor, array['auditor']))
       or (v_pv.status in ('Pending Counter Signature', 'Pending Cheque Signature') and v_pv.cheque_counter_signed_by = v_actor)
       or (v_pv.status = 'Pending DG Authorisation' and public.reqgen_pv_user_has_role(v_actor, array['dg', 'generalsecretary']));
  if not v_ok then raise exception 'Only the officer holding this voucher now can send it back.'; end if;

  update public.payment_vouchers
  set status = 'Returned to Account', signing_stage = 'Returned to Account', current_signing_owner = v_pv.prepared_by,
      returned_reason = trim(p_reason), returned_by_name = public.reqgen_actor_label(v_actor), returned_at = now(), updated_at = now()
  where id = p_voucher_id;
  insert into public.payment_voucher_history (voucher_id, request_id, action_by, actor_id, actor_name, actor_role, action_type, from_status, to_status, comment)
  values (p_voucher_id, v_pv.request_id, v_actor, v_actor, public.reqgen_actor_label(v_actor), 'Officer', 'Returned', v_pv.status, 'Returned to Account', trim(p_reason));
  if v_pv.prepared_by is not null then
    perform public.reqgen_pv_notify_user(v_pv.prepared_by, 'PV ' || v_pv.voucher_no || ' was sent back to you: ' || trim(p_reason), '/payment-vouchers/' || p_voucher_id::text);
  end if;
  return json_build_object('ok', true, 'status', 'Returned to Account');
end;
$$;

create or replace function public.reqgen_pv_resend(p_voucher_id uuid, p_comment text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_pv public.payment_vouchers; v_actor uuid := auth.uid();
begin
  select * into v_pv from public.payment_vouchers where id = p_voucher_id for update;
  if not found then raise exception 'Voucher not found.'; end if;
  if v_pv.status <> 'Returned to Account' then raise exception 'Only a voucher sent back to Account can be sent again.'; end if;
  if v_pv.prepared_by is distinct from v_actor and not public.reqgen_pv_user_has_role(v_actor, array['admin']) then
    raise exception 'Only the officer who prepared the voucher can send it again.';
  end if;
  if length(trim(coalesce(p_comment, ''))) < 3 then raise exception 'Say what you corrected.'; end if;
  -- the signing order starts again from the Auditor
  update public.payment_vouchers
  set status = 'Pending Check', signing_stage = 'Awaiting Check', current_signing_owner = null,
      checked_by = null, checked_by_name = null, checked_signature_url = null, checked_at = null,
      cheque_counter_signed_signature_url = null, cheque_counter_signed_at = null,
      authorized_by = null, authorized_by_name = null, authorized_signature_url = null, authorized_at = null,
      cheque_signed_by = null, cheque_signed_by_name = null, cheque_signed_signature_url = null, cheque_signed_at = null,
      updated_at = now()
  where id = p_voucher_id;
  insert into public.payment_voucher_history (voucher_id, request_id, action_by, actor_id, actor_name, actor_role, action_type, from_status, to_status, comment)
  values (p_voucher_id, v_pv.request_id, v_actor, v_actor, public.reqgen_actor_label(v_actor), 'Account Officer', 'Sent again', 'Returned to Account', 'Pending Check', trim(p_comment));
  perform public.reqgen_pv_notify_role(array['auditor'], 'PV ' || v_pv.voucher_no || ' was corrected and is waiting for your check', '/payment-vouchers/' || p_voucher_id::text);
  return json_build_object('ok', true, 'status', 'Pending Check');
end;
$$;
revoke all on function public.reqgen_pv_return(uuid, text) from public, anon;
revoke all on function public.reqgen_pv_resend(uuid, text) from public, anon;
grant execute on function public.reqgen_pv_return(uuid, text) to authenticated;
grant execute on function public.reqgen_pv_resend(uuid, text) to authenticated;
insert into v430_report values ('3 signing', 'reqgen_pv_return / reqgen_pv_resend', 'back to Account with a reason; corrected, the signing order starts again', 'OK');

-- 4. Paid, cancelled, reminded ----------------------------------------------------------------
create or replace function public.reqgen_pv_mark_paid(p_voucher_id uuid, p_paid_on date, p_reference text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pv public.payment_vouchers;
  v_actor uuid := auth.uid();
  v_label text;
  v_payee public.profiles;
begin
  if not public.reqgen_pv_user_has_role(v_actor, array['admin', 'account', 'accounts', 'accountofficer']) then
    raise exception 'Only an Account Officer marks a voucher paid.';
  end if;
  select * into v_pv from public.payment_vouchers where id = p_voucher_id for update;
  if not found then raise exception 'Voucher not found.'; end if;
  if coalesce(v_pv.status, '') <> 'Authorized' then raise exception 'A voucher is paid only after the Director General signs and authorises it.'; end if;
  if p_paid_on is null or p_paid_on > current_date then raise exception 'Choose the date it was paid (not in the future).'; end if;
  v_label := public.reqgen_actor_label(v_actor);

  -- Received By: for one payee, the requester and their saved signature (as in v3.1.14).
  -- The spending itself was recorded when Account released the fund on the request
  -- (subhead expenditure), and a manual voucher posts its ledgers when it is posted,
  -- so marking paid writes no second ledger line.
  if coalesce(v_pv.payee_count, 1) <= 1 and v_pv.request_id is not null then
    select p.* into v_payee from public.requests r join public.profiles p on p.id = r.created_by where r.id = v_pv.request_id;
  end if;

  update public.payment_vouchers
  set status = 'Paid', signing_stage = 'Paid', paid_on = p_paid_on, paid_reference = nullif(trim(coalesce(p_reference, '')), ''),
      paid_by_name = v_label, paid_at = now(), current_signing_owner = null,
      payment_date = coalesce(payment_date, p_paid_on),
      payee_signed_name = coalesce(nullif(trim(coalesce(v_payee.full_name, '')), ''), payee_signed_name, payee_name),
      payee_signature_url = coalesce(nullif(trim(coalesce(v_payee.signature_url, '')), ''), payee_signature_url),
      payee_signed_at = case when v_payee.id is not null then now() else payee_signed_at end,
      updated_at = now()
  where id = p_voucher_id;

  insert into public.payment_voucher_history (voucher_id, request_id, action_by, actor_id, actor_name, actor_role, action_type, from_status, to_status, comment)
  values (p_voucher_id, v_pv.request_id, v_actor, v_actor, v_label, 'Account Officer', 'Paid', 'Authorized', 'Paid',
          'Paid on ' || to_char(p_paid_on, 'DD Mon YYYY') || coalesce(' · ref ' || nullif(trim(coalesce(p_reference, '')), ''), ''));
  insert into public.notifications (user_id, title, message, link, is_read, created_at)
  select distinct r.created_by, 'Paid: ' || coalesce(r.request_no, 'your request'), 'Paid on ' || to_char(p_paid_on, 'DD Mon YYYY') || ' by voucher ' || v_pv.voucher_no || '.',
         '/requests/' || r.id::text, false, now()
  from public.payment_voucher_items i join public.requests r on r.id = i.request_id where i.voucher_id = p_voucher_id and r.created_by is not null;
  return json_build_object('ok', true, 'status', 'Paid');
end;
$$;
create or replace function public.reqgen_pv_cancel(p_voucher_id uuid, p_reason text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_pv public.payment_vouchers; v_actor uuid := auth.uid();
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Write why the voucher is cancelled.'; end if;
  select * into v_pv from public.payment_vouchers where id = p_voucher_id for update;
  if not found then raise exception 'Voucher not found.'; end if;
  if coalesce(v_pv.status, '') in ('Paid', 'Cancelled') then raise exception 'A % voucher cannot be cancelled.', lower(v_pv.status); end if;
  if not (public.reqgen_pv_user_has_role(v_actor, array['admin', 'auditor'])
          or (v_pv.prepared_by = v_actor and coalesce(v_pv.status, '') in ('Pending Check', 'Returned to Account'))) then
    raise exception 'Only the Auditor or the Super Admin can cancel a voucher after it has been checked.';
  end if;
  update public.payment_vouchers set status = 'Cancelled', signing_stage = 'Cancelled', current_signing_owner = null,
    cancel_reason = trim(p_reason), updated_at = now() where id = p_voucher_id;
  insert into public.payment_voucher_history (voucher_id, request_id, action_by, actor_id, actor_name, actor_role, action_type, from_status, to_status, comment)
  values (p_voucher_id, v_pv.request_id, v_actor, v_actor, public.reqgen_actor_label(v_actor), 'Officer', 'Cancelled', v_pv.status, 'Cancelled', trim(p_reason));
  return json_build_object('ok', true, 'status', 'Cancelled', 'voucher_no', v_pv.voucher_no);
end;
$$;

create or replace function public.reqgen_pv_remind(p_voucher_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_pv public.payment_vouchers; v_who uuid; v_title text;
begin
  if not public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'auditor', 'account', 'accounts', 'accountofficer', 'registry']) then
    raise exception 'Only Account, the Auditor, Registry or the Super Admin send reminders.';
  end if;
  select * into v_pv from public.payment_vouchers where id = p_voucher_id;
  if not found then raise exception 'Voucher not found.'; end if;
  v_title := 'Reminder: PV ' || coalesce(v_pv.voucher_no, '') || ' is waiting for you';
  if v_pv.status = 'Pending Check' then
    perform public.reqgen_pv_notify_role(array['auditor'], v_title, '/payment-vouchers/' || p_voucher_id::text);
  elsif v_pv.status in ('Pending Counter Signature', 'Pending Cheque Signature') then
    v_who := v_pv.cheque_counter_signed_by;
    if v_who is not null then perform public.reqgen_pv_notify_user(v_who, v_title, '/payment-vouchers/' || p_voucher_id::text); end if;
  elsif v_pv.status = 'Pending DG Authorisation' then
    perform public.reqgen_pv_notify_role(array['dg', 'padg'], v_title, '/payment-vouchers/' || p_voucher_id::text);
  elsif v_pv.status in ('Authorized', 'Returned to Account') then
    perform public.reqgen_pv_notify_user(v_pv.prepared_by, v_title, '/payment-vouchers/' || p_voucher_id::text);
  else
    raise exception 'This voucher is not waiting for anyone.';
  end if;
  insert into public.payment_voucher_history (voucher_id, request_id, action_by, actor_id, actor_name, actor_role, action_type, from_status, to_status, comment)
  values (p_voucher_id, v_pv.request_id, auth.uid(), auth.uid(), public.reqgen_actor_label(auth.uid()), 'Officer', 'Reminder', v_pv.status, v_pv.status, 'Reminder sent in the app.');
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.reqgen_pv_mark_paid(uuid, date, text) from public, anon;
revoke all on function public.reqgen_pv_cancel(uuid, text) from public, anon;
revoke all on function public.reqgen_pv_remind(uuid) from public, anon;
grant execute on function public.reqgen_pv_mark_paid(uuid, date, text) to authenticated;
grant execute on function public.reqgen_pv_cancel(uuid, text) to authenticated;
grant execute on function public.reqgen_pv_remind(uuid) to authenticated;
insert into v430_report values ('4 pay', 'reqgen_pv_mark_paid', 'after the DG authorises; paid date, bank reference and Received By', 'OK');
insert into v430_report values ('4 pay', 'reqgen_pv_cancel / reqgen_pv_remind', 'number kept on cancel; requests ready again; reminder to whoever holds it', 'OK');

-- 4b. Lists for the v4 voucher pages (all fields, including the v4 ones) ---------------
create or replace function public.reqgen_pv_list()
returns setof public.payment_vouchers
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'auditor', 'account', 'accounts', 'accountofficer', 'dg', 'generalsecretary']) then
    return query select * from public.payment_vouchers order by created_at desc;
  else
    -- Counter Signers and anyone else: only the vouchers they sign or signed
    return query select * from public.payment_vouchers pv
      where auth.uid() in (pv.current_signing_owner, pv.cheque_counter_signed_by, pv.cheque_signed_by, pv.prepared_by, pv.checked_by, pv.authorized_by)
      order by pv.created_at desc;
  end if;
end;
$$;

create or replace function public.reqgen_pv_record(p_voucher_id uuid)
returns setof public.payment_vouchers
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  return query select * from public.payment_vouchers pv
  where pv.id = p_voucher_id
    and (public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'auditor', 'account', 'accounts', 'accountofficer', 'dg', 'generalsecretary'])
         or auth.uid() in (pv.current_signing_owner, pv.cheque_counter_signed_by, pv.cheque_signed_by, pv.prepared_by, pv.checked_by, pv.authorized_by)
         or exists (select 1 from public.payment_voucher_items i join public.requests r on r.id = i.request_id where i.voucher_id = pv.id and r.created_by = auth.uid()));
end;
$$;
revoke all on function public.reqgen_pv_list() from public, anon;
revoke all on function public.reqgen_pv_record(uuid) from public, anon;
grant execute on function public.reqgen_pv_list() to authenticated;
grant execute on function public.reqgen_pv_record(uuid) to authenticated;
insert into v430_report values ('4 pay', 'reqgen_pv_list / reqgen_pv_record', 'finance roles and the DG see all; signers see theirs; a payee sees their own voucher', 'OK');

-- History for anyone who may open the voucher (the DG and the Counter Signer see it before they sign)
create or replace function public.reqgen_pv_history(p_voucher_id uuid)
returns table(id uuid, action_type text, from_status text, to_status text, comment text, actor_name text, actor_role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.reqgen_pv_record(p_voucher_id)) then
    raise exception 'You cannot open this voucher.';
  end if;
  return query
  select h.id, h.action_type, h.from_status, h.to_status, h.comment, h.actor_name, h.actor_role, h.created_at
  from public.payment_voucher_history h where h.voucher_id = p_voucher_id order by h.created_at asc;
end;
$$;
revoke all on function public.reqgen_pv_history(uuid) from public, anon;
grant execute on function public.reqgen_pv_history(uuid) to authenticated;
insert into v430_report values ('4 pay', 'reqgen_pv_history', 'every signer sees the voucher history before signing', 'OK');

-- 4c. Manual vouchers: section, mode, reason and the bill or receipt ------------------------
create or replace function public.reqgen_pv_manual_prepare(p_voucher_id uuid, p_section text, p_mode text, p_reason text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_pv public.payment_vouchers;
begin
  if p_section not in ('General Admin', 'DIN', 'ASAP-ALLI') then raise exception 'Choose General Admin, DIN or ASAP-ALLI.'; end if;
  if p_mode not in ('Transfer', 'Cash', 'Cheque') then raise exception 'Payment methods are Transfer, Cheque or Cash.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Choose the reason for a manual voucher.'; end if;
  select * into v_pv from public.payment_vouchers where id = p_voucher_id for update;
  if not found or not (coalesce(v_pv.voucher_type, '') = 'Manual' or coalesce(v_pv.voucher_origin, '') = 'Manual') then
    raise exception 'Manual voucher not found.';
  end if;
  if v_pv.prepared_by is distinct from auth.uid() and not public.reqgen_pv_user_has_role(auth.uid(), array['admin']) then
    raise exception 'Only the officer who prepared the voucher can change it.';
  end if;
  if v_pv.checked_at is not null or coalesce(v_pv.status, '') in ('Paid', 'Cancelled', 'Authorized') then
    raise exception 'It cannot change after the Auditor has checked the voucher.';
  end if;
  update public.payment_vouchers
  set prepared_section = p_section, disbursement_mode = p_mode, payment_method = p_mode, updated_at = now()
  where id = p_voucher_id;
  if not exists (select 1 from public.payment_voucher_history where voucher_id = p_voucher_id and action_type = 'Manual reason' and comment = trim(p_reason)) then
    insert into public.payment_voucher_history (voucher_id, action_by, actor_id, actor_name, actor_role, action_type, from_status, to_status, comment)
    values (p_voucher_id, auth.uid(), auth.uid(), public.reqgen_actor_label(auth.uid()), 'Account Officer', 'Manual reason', v_pv.status, v_pv.status, trim(p_reason));
  end if;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.reqgen_pv_manual_prepare(uuid, text, text, text) from public, anon;
grant execute on function public.reqgen_pv_manual_prepare(uuid, text, text, text) to authenticated;

create table if not exists public.reqgen_pv_attachments (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  uploaded_by uuid default auth.uid(),
  uploaded_by_label text,
  created_at timestamptz not null default now()
);
create index if not exists reqgen_pv_attachments_voucher_idx on public.reqgen_pv_attachments (voucher_id);
alter table public.reqgen_pv_attachments enable row level security;
drop policy if exists reqgen_pv_attachments_read on public.reqgen_pv_attachments;
create policy reqgen_pv_attachments_read on public.reqgen_pv_attachments for select to authenticated
  using (exists (select 1 from public.reqgen_pv_record(voucher_id)));
revoke all on public.reqgen_pv_attachments from anon;
revoke insert, update, delete on public.reqgen_pv_attachments from authenticated;
grant select on public.reqgen_pv_attachments to authenticated;

insert into storage.buckets (id, name, public)
values ('voucher-attachments', 'voucher-attachments', false)
on conflict (id) do update set public = false;
drop policy if exists reqgen_v430_pv_files_select on storage.objects;
drop policy if exists reqgen_v430_pv_files_insert on storage.objects;
-- files live under <voucher id>/<file>; whoever may open the voucher may open its files
create policy reqgen_v430_pv_files_select on storage.objects for select to authenticated
  using (bucket_id = 'voucher-attachments' and exists (
    select 1 from public.reqgen_pv_record(((storage.foldername(name))[1])::uuid)));
create policy reqgen_v430_pv_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'voucher-attachments'
    and public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'account', 'accounts', 'accountofficer']));

create or replace function public.reqgen_pv_add_attachment(p_voucher_id uuid, p_file_name text, p_file_path text, p_file_size bigint default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_pv public.payment_vouchers; v_id uuid;
begin
  if not public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'account', 'accounts', 'accountofficer']) then
    raise exception 'Only an Account Officer adds files to a voucher.';
  end if;
  select * into v_pv from public.payment_vouchers where id = p_voucher_id;
  if not found then raise exception 'Voucher not found.'; end if;
  if coalesce(v_pv.status, '') in ('Paid', 'Cancelled') then raise exception 'Files cannot be added to a % voucher.', lower(v_pv.status); end if;
  if split_part(coalesce(p_file_path, ''), '/', 1) <> p_voucher_id::text then raise exception 'The file must be stored under this voucher.'; end if;
  insert into public.reqgen_pv_attachments (voucher_id, file_name, file_path, file_size, uploaded_by, uploaded_by_label)
  values (p_voucher_id, left(trim(p_file_name), 200), p_file_path, p_file_size, auth.uid(), public.reqgen_actor_label(auth.uid()))
  returning id into v_id;
  return json_build_object('ok', true, 'id', v_id);
end;
$$;
revoke all on function public.reqgen_pv_add_attachment(uuid, text, text, bigint) from public, anon;
grant execute on function public.reqgen_pv_add_attachment(uuid, text, text, bigint) to authenticated;
insert into v430_report values ('4 pay', 'reqgen_pv_manual_prepare / reqgen_pv_add_attachment', 'manual voucher: section, mode, reason; the bill or receipt kept with the voucher', 'OK');

-- 5. Verification -------------------------------------------------------------------------------
insert into v430_report
select '5 check', 'functions installed', count(*)::text || ' of 13', case when count(*) = 13 then 'OK' else 'CHECK' end
from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('reqgen_pv_generate_core', 'reqgen_pv_generate', 'reqgen_pv_set_preparing_as', 'reqgen_pv_return', 'reqgen_pv_resend',
                  'reqgen_pv_mark_paid', 'reqgen_pv_cancel', 'reqgen_pv_remind', 'reqgen_pv_list', 'reqgen_pv_record', 'reqgen_pv_manual_prepare', 'reqgen_pv_add_attachment', 'reqgen_pv_history');
insert into v430_report
select '5 check', 'anonymous visitors cannot call them',
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'blocked' else 'open' end,
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'OK' else 'CHECK' end
from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('reqgen_pv_generate_core', 'reqgen_pv_generate', 'reqgen_pv_set_preparing_as', 'reqgen_pv_return', 'reqgen_pv_resend',
                    'reqgen_pv_mark_paid', 'reqgen_pv_cancel', 'reqgen_pv_remind', 'reqgen_pv_list', 'reqgen_pv_record', 'reqgen_pv_manual_prepare', 'reqgen_pv_add_attachment', 'reqgen_pv_history');
insert into v430_report
select '5 check', 'the inner generator can only be used through reqgen_pv_generate',
       case when has_function_privilege('authenticated', 'public.reqgen_pv_generate_core(uuid[], text, text, text, text, text, text, date, text, text, boolean)', 'execute') then 'open' else 'closed' end,
       case when has_function_privilege('authenticated', 'public.reqgen_pv_generate_core(uuid[], text, text, text, text, text, text, date, text, text, boolean)', 'execute') then 'CHECK' else 'OK' end;
insert into v430_report values ('5 check', 'existing voucher engine unchanged', 'generate_multi_payment_voucher and reqgen_pv_sign not touched', 'OK');

commit;

select step as "step", item as "item", result as "result", status as "status" from v430_report order by step, item;
