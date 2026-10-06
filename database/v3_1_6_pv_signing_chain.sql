-- =============================================================================
-- ReqGen v3.1.6 — Payment Voucher SIGNING CHAIN
-- Run ONCE in the Supabase SQL Editor AFTER the v3.1.6 app is deployed.
-- Safe to re-run.
--
-- Before v3.1.6 a new PV was stamped "Checked" (first Auditor found) and
-- "Authorized" (first DG found) with their saved signatures the moment it
-- was generated — nobody actually checked or authorised it. From v3.1.6:
--
--   Prepared (Account Officer)
--     -> Pending Check              signed by an Auditor
--     -> Pending Cheque Signature   signed by the selected Cheque Signer
--     -> Pending Counter Signature  signed by the selected Counter Signer
--     -> Pending DG Authorisation   signed by the Director General
--     -> Authorized                 fully signed: Account may Pay and Print
--     -> Paid                       "Received by" = payee's saved signature
--
-- Every mode (Transfer, Cash, Cheque) has a Cheque Signer and Counter Signer.
-- Each signature is appended at its own step; every step notifies the next
-- signer in the app. Request-based vouchers that were auto-stamped and not
-- yet paid are RESET to "Pending Check" (manual vouchers are not touched).
-- Original function definitions are saved in public.reqgen_function_backups.
-- The last result is the verification table.
-- =============================================================================

set lock_timeout = '10s';

begin;

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

-- 0. Back up the functions this release replaces (once).
insert into public.reqgen_function_backups (function_name, function_identity, release, definition)
select p.proname, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', 'v3.1.6', pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('generate_multi_payment_voucher', 'generate_payment_voucher', 'sign_payment_voucher_cheque',
                    'counter_sign_payment_voucher_cheque', 'update_payment_voucher_status', 'get_payment_vouchers_assigned_to_me')
  and not exists (select 1 from public.reqgen_function_backups b
                  where b.release = 'v3.1.6' and b.function_name = p.proname);

lock table public.payment_vouchers in share row exclusive mode;

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------
-- True when the user holds one of the role keys (primary role or an active
-- additional role). Role keys are compared in pv_role_key() form.
create or replace function public.reqgen_pv_user_has_role(p_user_id uuid, p_keys text[])
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id and public.pv_role_key(p.role) = any(p_keys)
  ) or exists (
    select 1 from public.profile_roles pr
    where pr.profile_id = p_user_id
      and coalesce(pr.is_active, true)
      and public.pv_role_key(pr.role_key) = any(p_keys)
  );
$$;

-- In-app notification to every active holder of a role.
create or replace function public.reqgen_pv_notify_role(p_keys text[], p_title text, p_link text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.notifications (user_id, title, link, is_read)
  select distinct u.id, p_title, p_link, false
  from (
    select p.id from public.profiles p where public.pv_role_key(p.role) = any(p_keys)
    union
    select pr.profile_id from public.profile_roles pr
    where coalesce(pr.is_active, true) and public.pv_role_key(pr.role_key) = any(p_keys)
  ) u
  where u.id is not null;
end;
$$;

create or replace function public.reqgen_pv_notify_user(p_user_id uuid, p_title text, p_link text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_user_id is not null then
    insert into public.notifications (user_id, title, link, is_read)
    values (p_user_id, p_title, p_link, false);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. THE signing step: one function signs whatever step the voucher is at.
--    Pending Check (Auditor) -> Pending Cheque Signature (selected Cheque
--    Signer) -> Pending Counter Signature (selected Counter Signer) ->
--    Pending DG Authorisation (DG) -> Authorized.
-- ---------------------------------------------------------------------------
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
  v_stage text;
  v_owner uuid;
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
  v_link := '/payment-vouchers/' || p_voucher_id::text;

  if v_from = 'Pending Check' then
    if not public.reqgen_pv_user_has_role(v_actor.id, array['auditor']) then
      raise exception 'This voucher is waiting for the Auditor''s check.';
    end if;
    if v_pv.cheque_signed_by is null or v_pv.cheque_counter_signed_by is null then
      raise exception 'The Cheque Signer and Counter Signer must be assigned before the voucher can be checked.';
    end if;
    if v_pv.prepared_by = v_actor.id then
      raise exception 'The officer who prepared this voucher cannot also check it.';
    end if;
    update public.payment_vouchers set
      checked_by = v_actor.id, checked_by_name = v_name,
      checked_signature_url = v_actor.signature_url, checked_at = now(),
      status = 'Pending Cheque Signature', signing_stage = 'Awaiting Cheque Signature',
      current_signing_owner = v_pv.cheque_signed_by, updated_at = now()
    where id = p_voucher_id;
    v_to := 'Pending Cheque Signature'; v_action := 'Check';
    perform public.reqgen_pv_notify_user(v_pv.cheque_signed_by, 'PV ' || v_pv.voucher_no || ' is waiting for your signature (Cheque Signer)', v_link);

  elsif v_from = 'Pending Cheque Signature' then
    if v_pv.cheque_signed_by is distinct from v_actor.id then
      raise exception 'Only the selected Cheque Signer (%) can sign this voucher now.', coalesce(v_pv.cheque_signed_by_name, 'not assigned');
    end if;
    update public.payment_vouchers set
      cheque_signed_by_name = v_name, cheque_signed_signature_url = v_actor.signature_url,
      cheque_signed_at = now(),
      status = 'Pending Counter Signature', signing_stage = 'Awaiting Counter Signature',
      current_signing_owner = v_pv.cheque_counter_signed_by, updated_at = now()
    where id = p_voucher_id;
    v_to := 'Pending Counter Signature'; v_action := 'Sign Cheque';
    perform public.reqgen_pv_notify_user(v_pv.cheque_counter_signed_by, 'PV ' || v_pv.voucher_no || ' is waiting for your counter signature', v_link);

  elsif v_from = 'Pending Counter Signature' then
    if v_pv.cheque_counter_signed_by is distinct from v_actor.id then
      raise exception 'Only the selected Counter Signer (%) can counter-sign this voucher now.', coalesce(v_pv.cheque_counter_signed_by_name, 'not assigned');
    end if;
    update public.payment_vouchers set
      cheque_counter_signed_by_name = v_name, cheque_counter_signed_signature_url = v_actor.signature_url,
      cheque_counter_signed_at = now(),
      status = 'Pending DG Authorisation', signing_stage = 'Awaiting DG Authorisation',
      current_signing_owner = null, updated_at = now()
    where id = p_voucher_id;
    v_to := 'Pending DG Authorisation'; v_action := 'Counter Sign Cheque';
    perform public.reqgen_pv_notify_role(array['dg', 'directorgeneral'], 'PV ' || v_pv.voucher_no || ' is waiting for your authorisation', v_link);

  elsif v_from = 'Pending DG Authorisation' then
    if not public.reqgen_pv_user_has_role(v_actor.id, array['dg', 'directorgeneral']) then
      raise exception 'Only the Director General can authorise this voucher.';
    end if;
    update public.payment_vouchers set
      authorized_by = v_actor.id, authorized_by_name = v_name,
      authorized_signature_url = v_actor.signature_url, authorized_at = now(),
      status = 'Authorized', signing_stage = 'Fully Signed',
      current_signing_owner = null, updated_at = now()
    where id = p_voucher_id;
    v_to := 'Authorized'; v_action := 'Authorize';
    perform public.reqgen_pv_notify_user(v_pv.prepared_by, 'PV ' || v_pv.voucher_no || ' is fully signed and authorised — ready to pay and print', v_link);

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

-- Account Officer assigns (or corrects) the two signers while the voucher has
-- not yet been checked. Needed for vouchers created before v3.1.6.
create or replace function public.reqgen_pv_assign_signers(p_voucher_id uuid, p_cheque_signed_by_name text, p_counter_signatory_name text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor public.profiles%rowtype;
  v_pv public.payment_vouchers%rowtype;
  v_cheque record;
  v_counter record;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found.'; end if;
  if not public.reqgen_pv_user_has_role(v_actor.id, array['admin', 'account', 'accounts', 'accountofficer']) then
    raise exception 'Only an Account Officer or Admin can assign voucher signers.';
  end if;

  select * into v_pv from public.payment_vouchers where id = p_voucher_id for update;
  if not found then raise exception 'Payment voucher not found.'; end if;
  if coalesce(v_pv.status, '') <> 'Pending Check' then
    raise exception 'Signers can only be changed before the voucher is checked.';
  end if;

  select * into v_cheque from public.find_active_pv_signatory_profile(p_cheque_signed_by_name, 'ChequeSigner') limit 1;
  if v_cheque.profile_id is null then
    raise exception 'Invalid Cheque Signer. Select an active Cheque Signer from PV Settings whose name matches a user profile.';
  end if;
  select * into v_counter from public.find_active_pv_signatory_profile(p_counter_signatory_name, 'CounterSigner') limit 1;
  if v_counter.profile_id is null then
    raise exception 'Invalid Counter Signer. Select an active Counter Signer from PV Settings whose name matches a user profile.';
  end if;
  if v_cheque.profile_id = v_counter.profile_id then
    raise exception 'Cheque Signer and Counter Signer cannot be the same person.';
  end if;

  update public.payment_vouchers set
    cheque_signed_by = v_cheque.profile_id, cheque_signed_by_name = v_cheque.full_name,
    cheque_counter_signed_by = v_counter.profile_id, cheque_counter_signed_by_name = v_counter.full_name,
    counter_signatory_name = v_counter.full_name, updated_at = now()
  where id = p_voucher_id;

  insert into public.payment_voucher_history (voucher_id, request_id, action_by, actor_id, actor_name, actor_role,
    action_type, from_status, to_status, comment)
  values (p_voucher_id, v_pv.request_id, v_actor.id, v_actor.id,
    coalesce(nullif(trim(v_actor.full_name), ''), v_actor.email), coalesce(v_actor.role, 'Account Officer'),
    'Assign Signers', v_pv.status, v_pv.status,
    'Cheque Signer: ' || v_cheque.full_name || '; Counter Signer: ' || v_counter.full_name);

  return json_build_object('ok', true, 'voucher_id', p_voucher_id);
end;
$$;

-- Older screens call these; they now sign through the one chain.
create or replace function public.sign_payment_voucher_cheque(p_voucher_id uuid)
returns json language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.payment_vouchers where id = p_voucher_id and status = 'Pending Cheque Signature') then
    raise exception 'This voucher is not waiting for the Cheque Signer.';
  end if;
  return public.reqgen_pv_sign(p_voucher_id, null);
end; $$;

create or replace function public.counter_sign_payment_voucher_cheque(p_voucher_id uuid)
returns json language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.payment_vouchers where id = p_voucher_id and status = 'Pending Counter Signature') then
    raise exception 'This voucher is not waiting for the Counter Signer.';
  end if;
  return public.reqgen_pv_sign(p_voucher_id, null);
end; $$;

-- Single-request generation goes through the same generator.
create or replace function public.generate_payment_voucher(p_request_id uuid, p_disbursement_mode text, p_transfer_account_name text default null::text, p_transfer_account_number text default null::text, p_transfer_bank_name text default null::text, p_cash_payee_name text default null::text, p_cheque_no text default null::text, p_cheque_date date default null::date, p_cheque_bank_name text default null::text, p_cheque_signed_by_name text default null::text, p_counter_signatory_name text default null::text)
returns json language plpgsql security definer set search_path to 'public' as $$
begin
  return public.generate_multi_payment_voucher(array[p_request_id], p_disbursement_mode, p_transfer_account_name,
    p_transfer_account_number, p_transfer_bank_name, p_cash_payee_name, p_cheque_no, p_cheque_date,
    p_cheque_bank_name, p_cheque_signed_by_name, p_counter_signatory_name);
end; $$;

-- Status actions. Signing actions are routed to the chain; "Pay" is allowed
-- only after full authorisation and appends the payee's saved signature.
create or replace function public.update_payment_voucher_status(p_voucher_id uuid, p_action_type text, p_comment text default null::text, p_cheque_no text default null::text, p_cheque_date date default null::date, p_bank_name text default null::text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor public.profiles%rowtype;
  v_pv public.payment_vouchers%rowtype;
  v_payee public.profiles%rowtype;
  v_new text;
begin
  if p_action_type in ('Check', 'Authorize', 'Sign Cheque', 'Counter Sign Cheque') then
    return public.reqgen_pv_sign(p_voucher_id, p_comment);
  end if;

  select * into v_actor from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found.'; end if;

  select * into v_pv from public.payment_vouchers where id = p_voucher_id for update;
  if not found then raise exception 'Payment voucher not found.'; end if;

  if p_action_type = 'Prepare Cheque' then
    if not public.reqgen_pv_user_has_role(v_actor.id, array['admin', 'account', 'accounts', 'accountofficer']) then
      raise exception 'Only an Account Officer or Admin can record cheque details.';
    end if;
    if v_pv.status in ('Authorized', 'Paid', 'Cancelled') then
      raise exception 'Cheque details cannot change after authorisation.';
    end if;
    update public.payment_vouchers set
      cheque_no = nullif(trim(p_cheque_no), ''), cheque_date = p_cheque_date,
      bank_name = coalesce(nullif(trim(p_bank_name), ''), bank_name), updated_at = now()
    where id = p_voucher_id;
    v_new := v_pv.status;

  elsif p_action_type = 'Pay' then
    if not public.reqgen_pv_user_has_role(v_actor.id, array['admin', 'account', 'accounts', 'accountofficer']) then
      raise exception 'Only an Account Officer or Admin can mark a voucher as paid.';
    end if;
    if coalesce(v_pv.status, '') <> 'Authorized' then
      raise exception 'A voucher can be marked paid only after every signature and the DG''s authorisation.';
    end if;
    -- Received by: the payee (requester) and their saved profile signature.
    select p.* into v_payee
    from public.requests r join public.profiles p on p.id = r.created_by
    where r.id = v_pv.request_id;
    v_new := 'Paid';
    update public.payment_vouchers set
      status = 'Paid', signing_stage = 'Paid',
      payee_signed_name = coalesce(nullif(trim(v_payee.full_name), ''), payee_signed_name, payee_name),
      payee_signature_url = coalesce(nullif(trim(v_payee.signature_url), ''), payee_signature_url),
      payee_signed_at = now(), payment_date = coalesce(payment_date, current_date), updated_at = now()
    where id = p_voucher_id;

  elsif p_action_type = 'Cancel' then
    if not public.reqgen_pv_user_has_role(v_actor.id, array['admin', 'auditor']) then
      raise exception 'Only Admin or Auditor can cancel a voucher.';
    end if;
    if v_pv.status = 'Paid' then
      raise exception 'A paid voucher cannot be cancelled.';
    end if;
    v_new := 'Cancelled';
    update public.payment_vouchers set status = 'Cancelled', signing_stage = 'Cancelled',
      current_signing_owner = null, updated_at = now()
    where id = p_voucher_id;

  else
    raise exception 'Invalid voucher action type.';
  end if;

  insert into public.payment_voucher_history (voucher_id, request_id, action_by, actor_id, actor_name, actor_role,
    actor_signature_url, action_type, from_status, to_status, comment)
  values (p_voucher_id, v_pv.request_id, v_actor.id, v_actor.id,
    coalesce(nullif(trim(v_actor.full_name), ''), v_actor.email, 'Officer'), v_actor.role,
    v_actor.signature_url, p_action_type, v_pv.status, v_new, p_comment);

  return json_build_object('ok', true, 'voucher_id', p_voucher_id, 'from_status', v_pv.status,
    'to_status', v_new, 'action_type', p_action_type);
end;
$$;

-- "Waiting for me": owner-assigned steps plus role steps (Auditor check, DG).
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
  where pv.current_signing_owner = auth.uid()
     or (pv.status = 'Pending Check' and public.reqgen_pv_user_has_role(auth.uid(), array['auditor'])
         and pv.prepared_by is distinct from auth.uid())
     or (pv.status = 'Pending DG Authorisation' and public.reqgen_pv_user_has_role(auth.uid(), array['dg', 'directorgeneral']))
  order by pv.created_at desc;
end;
$$;

grant execute on function public.reqgen_pv_sign(uuid, text) to authenticated;
grant execute on function public.reqgen_pv_assign_signers(uuid, text, text) to authenticated;
revoke execute on function public.reqgen_pv_notify_role(text[], text, text) from public, anon, authenticated;
revoke execute on function public.reqgen_pv_notify_user(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.reqgen_pv_user_has_role(uuid, text[]) from public, anon;
grant execute on function public.reqgen_pv_user_has_role(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Generator (from the live definition; signers required in every mode,
--    nothing pre-signed, status "Pending Check").
-- ---------------------------------------------------------------------------
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

  -- ReqGen v3.1.6: every PV (Transfer, Cash and Cheque) is signed by a
  -- Cheque Signer and a Counter Signer chosen from PV Settings.
  if nullif(trim(coalesce(p_cheque_signed_by_name, '')), '') is null then
    raise exception 'Please select the Cheque Signer for this payment voucher.';
  end if;

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

  begin
    select *
    into v_cheque_signer
    from public.find_active_pv_signatory_profile(
      p_cheque_signed_by_name,
      'ChequeSigner'
    )
    limit 1;

    if v_cheque_signer.profile_id is null then
      raise exception 'Invalid Cheque Signed By. Please select an active Cheque Signer from PV Settings whose name matches a user profile.';
    end if;

    select *
    into v_counter_signer
    from public.find_active_pv_signatory_profile(
      p_counter_signatory_name,
      'CounterSigner'
    )
    limit 1;

    if v_counter_signer.profile_id is null then
      raise exception 'Invalid Counter Signed By. Please select an active Counter Signer from PV Settings whose name matches a user profile.';
    end if;

    if v_cheque_signer.profile_id = v_counter_signer.profile_id then
      raise exception 'Cheque Signer and Counter Signer cannot be the same person.';
    end if;
  end;

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

  -- ReqGen v3.1.6 signing chain: Prepared -> Checked (Auditor) -> Cheque
  -- Signer -> Counter Signer -> Authorised (DG). Nothing is pre-signed.
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

    v_cheque_signer.profile_id,
    v_cheque_signer.full_name,
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
    '/payment-vouchers/' || v_voucher_id::text
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


-- ---------------------------------------------------------------------------
-- 4. Reset auto-stamped request vouchers that are not yet paid.
-- ---------------------------------------------------------------------------
with reset as (
  update public.payment_vouchers pv set
    status = 'Pending Check', signing_stage = 'Awaiting Check', current_signing_owner = null,
    checked_by = null, checked_by_name = null, checked_signature_url = null, checked_at = null,
    authorized_by = null, authorized_by_name = null, authorized_signature_url = null, authorized_at = null,
    cheque_signed_signature_url = null, cheque_signed_at = null,
    cheque_counter_signed_signature_url = null, cheque_counter_signed_at = null,
    payee_signed_name = null, payee_signature_url = null, payee_signed_at = null,
    counter_signatory_name = coalesce(pv.cheque_counter_signed_by_name, pv.counter_signatory_name),
    updated_at = now()
  where coalesce(pv.voucher_type, 'Request') <> 'Manual'
    and coalesce(pv.voucher_origin, 'Request') <> 'Manual'
    and coalesce(pv.status, '') in ('Prepared', 'Checked', 'Authorized', 'Cheque Prepared', 'Cheque Signed', 'Counter Signed')
    -- never reset a voucher the v3.1.6 chain has fully signed (safe re-run)
    and coalesce(pv.signing_stage, '') <> 'Fully Signed'
  returning pv.id, pv.request_id
)
insert into public.payment_voucher_history (voucher_id, request_id, actor_name, actor_role, action_type, from_status, to_status, comment)
select r.id, r.request_id, 'ReqGen', 'System', 'Reset to signing chain', 'Authorized', 'Pending Check',
       'v3.1.6: earlier automatic Check/Authorise stamps removed. The voucher now goes through the signing chain.'
from reset r;

commit;

-- ---------------------------------------------------------------------------
-- 5. Verification
-- ---------------------------------------------------------------------------
with fn as (
  select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
),
sig as (
  select signatory_type, count(*) filter (where is_active) as active
  from public.payment_voucher_counter_signatories group by signatory_type
)
select '1. Generator uses the signing chain' as check_item,
       case when exists (select 1 from fn where proname = 'generate_multi_payment_voucher' and prosrc like '%v3.1.6 signing chain%') then 'OK' else 'CHECK' end as status,
       '' as detail
union all select '2. Signing function reqgen_pv_sign',
       case when exists (select 1 from fn where proname = 'reqgen_pv_sign') then 'OK' else 'CHECK' end, ''
union all select '3. Signer assignment function',
       case when exists (select 1 from fn where proname = 'reqgen_pv_assign_signers') then 'OK' else 'CHECK' end, ''
union all select '4. Old sign / counter-sign / status actions route to the chain',
       case when (select count(*) from fn where proname in ('sign_payment_voucher_cheque', 'counter_sign_payment_voucher_cheque', 'update_payment_voucher_status')
                  and prosrc like '%reqgen_pv_sign%') = 3 then 'OK' else 'CHECK' end, ''
union all select '5. Original definitions backed up',
       'OK', (select count(*)::text || ' function(s) saved for v3.1.6' from public.reqgen_function_backups where release = 'v3.1.6')
union all select '6. Active Cheque Signers in PV Settings',
       case when coalesce((select active from sig where signatory_type = 'ChequeSigner'), 0) > 0 then 'OK' else 'CHECK' end,
       coalesce((select active::text from sig where signatory_type = 'ChequeSigner'), '0')
union all select '7. Active Counter Signers in PV Settings',
       case when coalesce((select active from sig where signatory_type = 'CounterSigner'), 0) > 0 then 'OK' else 'CHECK' end,
       coalesce((select active::text from sig where signatory_type = 'CounterSigner'), '0')
union all select '8. Auditors with a saved signature',
       case when exists (select 1 from public.profiles p where public.reqgen_pv_user_has_role(p.id, array['auditor']) and coalesce(p.signature_url, '') <> '') then 'OK' else 'CHECK' end,
       (select count(*)::text from public.profiles p where public.reqgen_pv_user_has_role(p.id, array['auditor']) and coalesce(p.signature_url, '') <> '')
union all select '9. Director General with a saved signature',
       case when exists (select 1 from public.profiles p where public.reqgen_pv_user_has_role(p.id, array['dg', 'directorgeneral']) and coalesce(p.signature_url, '') <> '') then 'OK' else 'CHECK' end,
       (select count(*)::text from public.profiles p where public.reqgen_pv_user_has_role(p.id, array['dg', 'directorgeneral']) and coalesce(p.signature_url, '') <> '')
union all select '10. Vouchers in the signing chain', 'OK',
       (select count(*)::text from public.payment_vouchers where status like 'Pending%')
union all select '11. Signers needed: ' || pv.voucher_no, 'CHECK',
       'Account Officer: open the voucher and assign the Cheque Signer and Counter Signer'
from public.payment_vouchers pv
where pv.status = 'Pending Check' and (pv.cheque_signed_by is null or pv.cheque_counter_signed_by is null);
