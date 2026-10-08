-- =============================================================================
-- ReqGen v3.1.14 — Payment voucher signing order
-- Run in the Supabase SQL Editor after deploying v3.1.14.
-- Requires v3.1.13 (already run). Safe to re-run and safe while staff work:
-- PART 1 replaces functions only; PART 2 moves vouchers in short, guarded steps.
--
-- New order (every mode: Transfer, Cash, Cheque)
--   1. Account Officer prepares the voucher and chooses the Counter Signer
--   2. Auditor checks
--   3. Counter Signer counter-signs
--   4. Director General — ONE click signs the voucher (cheque signature) AND
--      authorises it. There is no separate Cheque Signer any more.
--   5. Account Officer pays; the payee signs on receipt.
--
-- Vouchers already waiting for a Cheque Signer move straight to their Counter
-- Signer (PART 2). Nothing is deleted. Signatures already given are kept.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1 — functions only
-- ---------------------------------------------------------------------------
begin;

create or replace function public.reqgen_pv_assign_signers(p_voucher_id uuid, p_cheque_signed_by_name text, p_counter_signatory_name text, p_checker_id uuid default null)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor public.profiles%rowtype;
  v_pv public.payment_vouchers%rowtype;
  v_counter record;
  v_link text := '/approvals/vouchers/' || p_voucher_id::text;
begin
  -- v3.1.14: p_cheque_signed_by_name is no longer used (the Director General
  -- signs the cheque when authorising). It stays for older screens.
  select * into v_actor from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found.'; end if;
  if not public.reqgen_pv_user_has_role(v_actor.id, array['admin', 'account', 'accounts', 'accountofficer']) then
    raise exception 'Only an Account Officer or Admin can assign voucher signers.';
  end if;

  select * into v_pv from public.payment_vouchers where id = p_voucher_id for update;
  if not found then raise exception 'Payment voucher not found.'; end if;
  if not (coalesce(v_pv.status, '') = 'Pending Check'
          or (coalesce(v_pv.status, '') in ('Pending Counter Signature', 'Pending Cheque Signature') and v_pv.cheque_counter_signed_at is null)) then
    raise exception 'Signers can only be changed before the Counter Signer signs.';
  end if;

  select * into v_counter from public.find_active_pv_signatory_profile(p_counter_signatory_name, 'CounterSigner') limit 1;
  if v_counter.profile_id is null then
    raise exception 'Invalid Counter Signer. Select an active Counter Signer from PV Settings whose name matches a user profile.';
  end if;

  if p_checker_id is not null then
    if not public.reqgen_pv_user_has_role(p_checker_id, array['auditor']) then
      raise exception 'The checker must be an Auditor.';
    end if;
    if p_checker_id = v_pv.prepared_by then
      raise exception 'The officer who prepared this voucher cannot also check it.';
    end if;
  end if;

  update public.payment_vouchers set
    current_signing_owner = case when v_pv.status = 'Pending Check' then p_checker_id else v_counter.profile_id end,
    status = case when v_pv.status = 'Pending Cheque Signature' then 'Pending Counter Signature' else v_pv.status end,
    signing_stage = case when v_pv.status = 'Pending Cheque Signature' then 'Awaiting Counter Signature' else v_pv.signing_stage end,
    cheque_signed_by = case when v_pv.cheque_signed_at is null then null else v_pv.cheque_signed_by end,
    cheque_signed_by_name = case when v_pv.cheque_signed_at is null then null else v_pv.cheque_signed_by_name end,
    cheque_counter_signed_by = v_counter.profile_id, cheque_counter_signed_by_name = v_counter.full_name,
    counter_signatory_name = v_counter.full_name, updated_at = now()
  where id = p_voucher_id;

  insert into public.payment_voucher_history (voucher_id, request_id, action_by, actor_id, actor_name, actor_role,
    action_type, from_status, to_status, comment)
  values (p_voucher_id, v_pv.request_id, v_actor.id, v_actor.id,
    coalesce(nullif(trim(v_actor.full_name), ''), v_actor.email), coalesce(v_actor.role, 'Account Officer'),
    'Assign Signers', v_pv.status,
    case when v_pv.status = 'Pending Cheque Signature' then 'Pending Counter Signature' else v_pv.status end,
    'Checker: ' || coalesce((select full_name from public.profiles where id = p_checker_id), 'any Auditor')
      || '; Counter Signer: ' || v_counter.full_name);

  if v_pv.status = 'Pending Check' then
    if p_checker_id is not null then
      perform public.reqgen_pv_notify_user(p_checker_id, 'PV ' || v_pv.voucher_no || ' is waiting for your check', v_link);
    else
      perform public.reqgen_pv_notify_role(array['auditor'], 'PV ' || v_pv.voucher_no || ' is waiting for your check', v_link);
    end if;
  else
    perform public.reqgen_pv_notify_user(v_counter.profile_id, 'PV ' || v_pv.voucher_no || ' is waiting for your counter signature', v_link);
  end if;

  return json_build_object('ok', true, 'voucher_id', p_voucher_id);
end;
$$;

grant execute on function public.reqgen_pv_assign_signers(uuid, text, text, uuid) to authenticated;

create or replace function public.reqgen_pv_sign(p_voucher_id uuid, p_comment text default null)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor public.profiles%rowtype;
  v_pv public.payment_vouchers%rowtype;
  v_name text;
  v_from text;
  v_to text;
  v_action text;
  v_link text;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found.';
  end if;

  select * into v_pv from public.payment_vouchers where id = p_voucher_id for update;
  if not found then
    raise exception 'Payment voucher not found.';
  end if;

  if nullif(trim(coalesce(v_actor.signature_url, '')), '') is null then
    raise exception 'Your signature is missing. Please upload your signature on your Profile page before signing.';
  end if;

  v_name := coalesce(nullif(trim(v_actor.full_name), ''), v_actor.email, 'Officer');
  v_from := coalesce(v_pv.status, '');
  v_link := '/approvals/vouchers/' || p_voucher_id::text;

  if v_from = 'Pending Check' then
    if not public.reqgen_pv_user_has_role(v_actor.id, array['auditor']) then
      raise exception 'This voucher is waiting for the Auditor''s check.';
    end if;
    if v_pv.prepared_by = v_actor.id then
      raise exception 'The officer who prepared this voucher cannot also check it.';
    end if;
    if v_pv.current_signing_owner is not null and v_pv.current_signing_owner <> v_actor.id then
      raise exception 'This voucher was assigned to % for checking.',
        coalesce((select full_name from public.profiles where id = v_pv.current_signing_owner), 'another Auditor');
    end if;
    update public.payment_vouchers set
      checked_by = v_actor.id, checked_by_name = v_name,
      checked_signature_url = v_actor.signature_url, checked_at = now(),
      status = 'Pending Counter Signature', signing_stage = 'Awaiting Counter Signature',
      current_signing_owner = v_pv.cheque_counter_signed_by, updated_at = now()
    where id = p_voucher_id;
    v_to := 'Pending Counter Signature'; v_action := 'Check';
    if v_pv.cheque_counter_signed_by is not null then
      perform public.reqgen_pv_notify_user(v_pv.cheque_counter_signed_by, 'PV ' || v_pv.voucher_no || ' is waiting for your counter signature', v_link);
    else
      perform public.reqgen_pv_notify_user(v_pv.prepared_by, 'PV ' || v_pv.voucher_no || ' was checked. Please choose the Counter Signer.', v_link);
    end if;

  -- 'Pending Cheque Signature' is the pre-v3.1.14 step; it is handled as the counter signature.
  elsif v_from in ('Pending Counter Signature', 'Pending Cheque Signature') then
    if v_pv.cheque_counter_signed_by is null then
      raise exception 'The Account Officer has not yet chosen the Counter Signer.';
    end if;
    if v_pv.cheque_counter_signed_by is distinct from v_actor.id then
      raise exception 'Only the selected Counter Signer (%) can counter-sign this voucher now.', coalesce(v_pv.cheque_counter_signed_by_name, 'not assigned');
    end if;
    update public.payment_vouchers set
      cheque_counter_signed_by_name = v_name, cheque_counter_signed_signature_url = v_actor.signature_url,
      cheque_counter_signed_at = now(),
      status = 'Pending DG Authorisation', signing_stage = 'Awaiting DG Authorisation',
      current_signing_owner = null, updated_at = now()
    where id = p_voucher_id;
    v_to := 'Pending DG Authorisation'; v_action := 'Counter Sign';
    perform public.reqgen_pv_notify_role(array['dg', 'directorgeneral'], 'PV ' || v_pv.voucher_no || ' is waiting for your signature and authorisation', v_link);

  elsif v_from = 'Pending DG Authorisation' then
    if not public.reqgen_pv_user_has_role(v_actor.id, array['dg', 'directorgeneral']) then
      raise exception 'Only the Director General can sign and authorise this voucher.';
    end if;
    -- v3.1.14: one click — the DG's signature goes on the cheque AND authorises.
    update public.payment_vouchers set
      cheque_signed_by = coalesce(case when v_pv.cheque_signed_at is not null then v_pv.cheque_signed_by end, v_actor.id),
      cheque_signed_by_name = coalesce(case when v_pv.cheque_signed_at is not null then v_pv.cheque_signed_by_name end, v_name),
      cheque_signed_signature_url = coalesce(case when v_pv.cheque_signed_at is not null then v_pv.cheque_signed_signature_url end, v_actor.signature_url),
      cheque_signed_at = coalesce(v_pv.cheque_signed_at, now()),
      authorized_by = v_actor.id, authorized_by_name = v_name,
      authorized_signature_url = v_actor.signature_url, authorized_at = now(),
      status = 'Authorized', signing_stage = 'Fully Signed',
      current_signing_owner = null, updated_at = now()
    where id = p_voucher_id;
    v_to := 'Authorized'; v_action := 'Sign & Authorise';
    perform public.reqgen_pv_notify_user(v_pv.prepared_by, 'PV ' || v_pv.voucher_no || ' is signed and authorised by the DG — ready to pay and print', v_link);

  else
    raise exception 'This voucher is not waiting for a signature (status: %).', coalesce(nullif(v_from, ''), 'unknown');
  end if;

  insert into public.payment_voucher_history (
    voucher_id, request_id, action_by, actor_id, actor_name, actor_role, actor_signature_url,
    action_type, from_status, to_status, comment
  ) values (
    p_voucher_id, v_pv.request_id, v_actor.id, v_actor.id, v_name, coalesce(v_actor.role, 'Officer'),
    v_actor.signature_url, v_action, v_from, v_to, nullif(trim(coalesce(p_comment, '')), '')
  );

  return json_build_object('ok', true, 'voucher_id', p_voucher_id, 'voucher_no', v_pv.voucher_no,
    'from_status', v_from, 'status', v_to);
end;
$$;

grant execute on function public.reqgen_pv_sign(uuid, text) to authenticated;

-- Older screens call these; they sign through the one chain.
create or replace function public.sign_payment_voucher_cheque(p_voucher_id uuid)
returns json language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.payment_vouchers where id = p_voucher_id and status = 'Pending DG Authorisation') then
    raise exception 'The cheque is signed by the Director General when authorising the voucher.';
  end if;
  return public.reqgen_pv_sign(p_voucher_id, null);
end; $$;

create or replace function public.counter_sign_payment_voucher_cheque(p_voucher_id uuid)
returns json language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.payment_vouchers where id = p_voucher_id and status in ('Pending Counter Signature', 'Pending Cheque Signature')) then
    raise exception 'This voucher is not waiting for the Counter Signer.';
  end if;
  return public.reqgen_pv_sign(p_voucher_id, null);
end; $$;

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
           when 'Pending Counter Signature' then 3
           when 'Pending DG Authorisation' then 4
           else 1 end::integer,
         (case
           when v.status = 'Pending Check' then
             coalesce((select p.full_name || ' (Auditor check)' from public.profiles p where p.id = v.current_signing_owner), 'Auditor (check)')
           when v.status in ('Pending Counter Signature', 'Pending Cheque Signature') then
             case when v.cheque_counter_signed_by is null then 'Account Officer (choose Counter Signer)'
                  else coalesce(v.cheque_counter_signed_by_name, 'Counter Signer') end
           when v.status = 'Pending DG Authorisation' then 'Director General (sign & authorise)'
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

create or replace function public.get_payment_vouchers_assigned_to_me()
returns table(id uuid, voucher_no text, request_no text, payee_name text, amount numeric, disbursement_mode text, status text, signing_stage text, created_at timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
  select pv.id, pv.voucher_no, pv.request_no, pv.payee_name, coalesce(pv.total_amount, pv.amount),
         pv.disbursement_mode, pv.status, pv.signing_stage, pv.created_at
  from public.payment_vouchers pv
  where (pv.current_signing_owner = auth.uid() and pv.status like 'Pending%')
     or (pv.status = 'Pending Check' and pv.current_signing_owner is null
         and public.reqgen_pv_user_has_role(auth.uid(), array['auditor'])
         and pv.prepared_by is distinct from auth.uid())
     or (pv.status in ('Pending Counter Signature', 'Pending Cheque Signature') and pv.cheque_counter_signed_by = auth.uid())
     or (pv.status in ('Pending Counter Signature', 'Pending Cheque Signature') and pv.cheque_counter_signed_by is null and pv.prepared_by = auth.uid())
     or (pv.status = 'Pending DG Authorisation' and public.reqgen_pv_user_has_role(auth.uid(), array['dg', 'directorgeneral']))
  order by pv.created_at desc;
end;
$$;

grant execute on function public.get_payment_vouchers_assigned_to_me() to authenticated;

-- Generator: the Cheque Signer is no longer chosen; the Counter Signer is.
CREATE OR REPLACE FUNCTION public.generate_multi_payment_voucher(p_request_ids uuid[], p_disbursement_mode text, p_transfer_account_name text DEFAULT NULL::text, p_transfer_account_number text DEFAULT NULL::text, p_transfer_bank_name text DEFAULT NULL::text, p_cash_payee_name text DEFAULT NULL::text, p_cheque_no text DEFAULT NULL::text, p_cheque_date date DEFAULT NULL::date, p_cheque_bank_name text DEFAULT NULL::text, p_cheque_signed_by_name text DEFAULT NULL::text, p_counter_signatory_name text DEFAULT NULL::text)
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

  v_role := public.pv_role_key(v_actor.role);

  if v_role not in ('admin', 'auditor', 'account', 'accounts', 'accountofficer') then
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

  if v_bad_payee_count > 0 then
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

grant execute on function public.generate_multi_payment_voucher(uuid[], text, text, text, text, text, text, date, text, text, text) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- PART 2 — vouchers waiting for a Cheque Signer move to their Counter Signer
-- (short and guarded: if the table is busy it is skipped; just run again)
-- ---------------------------------------------------------------------------
begin;
do $part2$
declare
  v_moved integer := 0;
begin
  set local lock_timeout = '5s';
  with moved as (
    update public.payment_vouchers pv set
      status = 'Pending Counter Signature',
      signing_stage = 'Awaiting Counter Signature',
      current_signing_owner = pv.cheque_counter_signed_by,
      cheque_signed_by = case when pv.cheque_signed_at is null then null else pv.cheque_signed_by end,
      cheque_signed_by_name = case when pv.cheque_signed_at is null then null else pv.cheque_signed_by_name end,
      updated_at = now()
    where pv.status = 'Pending Cheque Signature'
    returning pv.id, pv.request_id
  ), logged as (
    insert into public.payment_voucher_history (voucher_id, request_id, actor_name, actor_role, action_type, from_status, to_status, comment)
    select m.id, m.request_id, 'ReqGen', 'System', 'Signing order updated', 'Pending Cheque Signature', 'Pending Counter Signature',
           'v3.1.14: the Cheque Signer step was removed. The Counter Signer signs next; the Director General then signs and authorises in one step.'
    from moved m
    returning 1
  )
  select count(*) into v_moved from logged;
  raise notice 'ReqGen v3.1.14: % voucher(s) moved from the Cheque Signer to the Counter Signer.', v_moved;
exception
  when lock_not_available or deadlock_detected then
    raise notice 'ReqGen v3.1.14: payment_vouchers is busy right now — PART 2 skipped. Run this file again in a quiet moment.';
end
$part2$;
commit;

-- ---------------------------------------------------------------------------
-- Verification + where every unsigned voucher is right now
-- ---------------------------------------------------------------------------
select '1. Check goes straight to the Counter Signer' as check_item,
       case when (select prosrc from pg_proc where proname = 'reqgen_pv_sign' limit 1) like '%status = ''Pending Counter Signature'', signing_stage = ''Awaiting Counter Signature''%' then 'OK' else 'CHECK' end as status, '' as detail
union all select '2. DG signs and authorises in one step',
       case when (select prosrc from pg_proc where proname = 'reqgen_pv_sign' limit 1) like '%Sign & Authorise%' then 'OK' else 'CHECK' end, ''
union all select '3. Generator no longer needs a Cheque Signer',
       case when (select prosrc from pg_proc where proname = 'generate_multi_payment_voucher' limit 1) not like '%Please select the Cheque Signer%' then 'OK' else 'CHECK' end, ''
union all select '4. Vouchers still waiting for a Cheque Signer',
       case when (select count(*) from public.payment_vouchers where status = 'Pending Cheque Signature') = 0 then 'OK' else 'RUN AGAIN' end,
       (select count(*)::text from public.payment_vouchers where status = 'Pending Cheque Signature')
union all select '5. Directors General with a saved signature',
       case when exists (select 1 from public.profiles p where public.reqgen_pv_user_has_role(p.id, array['dg','directorgeneral']) and coalesce(p.signature_url, '') <> '') then 'OK' else 'CHECK' end,
       coalesce((select string_agg(p.full_name, ', ') from public.profiles p
        where public.reqgen_pv_user_has_role(p.id, array['dg','directorgeneral']) and coalesce(p.signature_url, '') <> ''), 'none — the DG must upload a signature')
union all select '6. ' || coalesce(v.voucher_no, '?') || ' — ' || v.status, 'NOW WITH',
       case
         when v.status = 'Pending Check' then coalesce((select full_name from public.profiles where id = v.current_signing_owner), 'any Auditor')
         when v.status in ('Pending Counter Signature', 'Pending Cheque Signature') then coalesce(v.cheque_counter_signed_by_name, 'Account Officer: choose the Counter Signer')
         when v.status = 'Pending DG Authorisation' then 'Director General'
         else v.status end
from public.payment_vouchers v
where v.status like 'Pending%';
