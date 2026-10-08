-- =============================================================================
-- ReqGen v3.1.13 — Payment voucher engine: stabilised signing chain
-- Run in the Supabase SQL Editor after deploying v3.1.13. Self-contained:
-- includes everything from v3.1.12 (you do not need to run v3.1.12 first).
-- Safe to re-run and safe while staff are working (functions only).
--
-- What changes
--   1. The Auditor can ALWAYS check a voucher waiting for check. Before, if the
--      Account Officer had not yet chosen the Cheque Signer and Counter Signer,
--      the check was refused and the voucher stood still. Now the Auditor
--      checks; the voucher then waits for the Account Officer to choose the
--      signers (they are told in the app), and moves on as soon as they do.
--   2. The Account Officer can choose or correct the signers until the Cheque
--      Signer signs (before: only before the check).
--   3. Every voucher waiting for check appears in every Auditor's list
--      (Approvals -> Voucher Signing), or only the chosen checker's list.
--   4. Opening a voucher no longer depends on the role you are "acting as":
--      any role you hold (Admin, Auditor, Account Officer) or any part you
--      play on the voucher (preparer, checker, signer, DG) is enough.
--   5. Every in-app notification links straight to the voucher.
-- =============================================================================

begin;

create or replace function public.reqgen_pv_checkers()
returns table(id uuid, full_name text)
language sql stable security definer set search_path to 'public' as $$
  select p.id, p.full_name::text
  from public.profiles p
  where public.reqgen_pv_user_has_role(p.id, array['auditor'])
  order by p.full_name;
$$;
grant execute on function public.reqgen_pv_checkers() to authenticated;

drop function if exists public.reqgen_pv_assign_signers(uuid, text, text);

create or replace function public.reqgen_pv_assign_signers(p_voucher_id uuid, p_cheque_signed_by_name text, p_counter_signatory_name text, p_checker_id uuid default null)
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
  -- v3.1.13: signers can be chosen or corrected until the Cheque Signer signs.
  if not (coalesce(v_pv.status, '') = 'Pending Check'
          or (coalesce(v_pv.status, '') = 'Pending Cheque Signature' and v_pv.cheque_signed_at is null)) then
    raise exception 'Signers can only be changed before the Cheque Signer signs.';
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

  if p_checker_id is not null then
    if not public.reqgen_pv_user_has_role(p_checker_id, array['auditor']) then
      raise exception 'The checker must be an Auditor.';
    end if;
    if p_checker_id = v_pv.prepared_by then
      raise exception 'The officer who prepared this voucher cannot also check it.';
    end if;
  end if;

  update public.payment_vouchers set
    -- at Pending Check the owner is the chosen checker (or nobody = any Auditor);
    -- after the check, the voucher now belongs to the Cheque Signer.
    current_signing_owner = case when v_pv.status = 'Pending Check' then p_checker_id else v_cheque.profile_id end,
    cheque_signed_by = v_cheque.profile_id, cheque_signed_by_name = v_cheque.full_name,
    cheque_counter_signed_by = v_counter.profile_id, cheque_counter_signed_by_name = v_counter.full_name,
    counter_signatory_name = v_counter.full_name, updated_at = now()
  where id = p_voucher_id;

  insert into public.payment_voucher_history (voucher_id, request_id, action_by, actor_id, actor_name, actor_role,
    action_type, from_status, to_status, comment)
  values (p_voucher_id, v_pv.request_id, v_actor.id, v_actor.id,
    coalesce(nullif(trim(v_actor.full_name), ''), v_actor.email), coalesce(v_actor.role, 'Account Officer'),
    'Assign Signers', v_pv.status, v_pv.status,
    'Checker: ' || coalesce((select full_name from public.profiles where id = p_checker_id), 'any Auditor')
      || '; Cheque Signer: ' || v_cheque.full_name || '; Counter Signer: ' || v_counter.full_name);

  if v_pv.status = 'Pending Check' then
    if p_checker_id is not null then
      perform public.reqgen_pv_notify_user(p_checker_id, 'PV ' || v_pv.voucher_no || ' is waiting for your check', '/approvals/vouchers/' || p_voucher_id::text);
    else
      perform public.reqgen_pv_notify_role(array['auditor'], 'PV ' || v_pv.voucher_no || ' is waiting for your check', '/approvals/vouchers/' || p_voucher_id::text);
    end if;
  else
    perform public.reqgen_pv_notify_user(v_cheque.profile_id, 'PV ' || v_pv.voucher_no || ' is waiting for your signature (Cheque Signer)', '/approvals/vouchers/' || p_voucher_id::text);
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
    if v_pv.prepared_by = v_actor.id then
      raise exception 'The officer who prepared this voucher cannot also check it.';
    end if;
    -- v3.1.12: when the Account Officer chose a checker, only that officer checks.
    if v_pv.current_signing_owner is not null and v_pv.current_signing_owner <> v_actor.id then
      raise exception 'This voucher was assigned to % for checking.',
        coalesce((select full_name from public.profiles where id = v_pv.current_signing_owner), 'another Auditor');
    end if;
    update public.payment_vouchers set
      checked_by = v_actor.id, checked_by_name = v_name,
      checked_signature_url = v_actor.signature_url, checked_at = now(),
      status = 'Pending Cheque Signature', signing_stage = 'Awaiting Cheque Signature',
      current_signing_owner = v_pv.cheque_signed_by, updated_at = now()
    where id = p_voucher_id;
    v_to := 'Pending Cheque Signature'; v_action := 'Check';
    if v_pv.cheque_signed_by is not null then
      perform public.reqgen_pv_notify_user(v_pv.cheque_signed_by, 'PV ' || v_pv.voucher_no || ' is waiting for your signature (Cheque Signer)', '/approvals/vouchers/' || p_voucher_id::text);
    else
      -- v3.1.13: checked before the signers were chosen — ask the preparer to choose them.
      perform public.reqgen_pv_notify_user(v_pv.prepared_by, 'PV ' || v_pv.voucher_no || ' was checked. Please choose the Cheque Signer and Counter Signer.', v_link);
    end if;

  elsif v_from = 'Pending Cheque Signature' then
    if v_pv.cheque_signed_by is null or v_pv.cheque_counter_signed_by is null then
      raise exception 'The Account Officer has not yet chosen the Cheque Signer and Counter Signer.';
    end if;
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
    perform public.reqgen_pv_notify_user(v_pv.cheque_counter_signed_by, 'PV ' || v_pv.voucher_no || ' is waiting for your counter signature', '/approvals/vouchers/' || p_voucher_id::text);

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
    perform public.reqgen_pv_notify_role(array['dg', 'directorgeneral'], 'PV ' || v_pv.voucher_no || ' is waiting for your authorisation', '/approvals/vouchers/' || p_voucher_id::text);

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

grant execute on function public.reqgen_pv_sign(uuid, text) to authenticated;

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
             coalesce((select p.full_name || ' (Auditor check)' from public.profiles p where p.id = v.current_signing_owner), 'Auditor (check)')
           when 'Pending Cheque Signature' then
             case when v.cheque_signed_by is null then 'Account Officer (assign signers)' else coalesce(v.cheque_signed_by_name, 'Cheque Signer') end
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
     or (pv.status = 'Pending Check' and pv.current_signing_owner is null
         and public.reqgen_pv_user_has_role(auth.uid(), array['auditor'])
         and pv.prepared_by is distinct from auth.uid())
     or (pv.status = 'Pending Cheque Signature' and pv.cheque_signed_by is null and pv.prepared_by = auth.uid())
     or (pv.status = 'Pending DG Authorisation' and public.reqgen_pv_user_has_role(auth.uid(), array['dg', 'directorgeneral']))
  order by pv.created_at desc;
end;
$$;


-- Readers: by ANY held role, or by the part played on the voucher.
create or replace function public.get_payment_voucher_detail(p_voucher_id uuid)
 RETURNS TABLE(id uuid, voucher_no text, request_id uuid, request_no text, request_type text, personal_category text, payee_name text, narration text, amount numeric, dept_id uuid, dept_name text, subhead_id uuid, subhead_code text, subhead_name text, prepared_by uuid, prepared_by_name text, prepared_signature_url text, prepared_at timestamp with time zone, checked_by uuid, checked_by_name text, checked_signature_url text, checked_at timestamp with time zone, authorized_by uuid, authorized_by_name text, authorized_signature_url text, authorized_at timestamp with time zone, cheque_no text, cheque_date date, bank_name text, cheque_signed_by uuid, cheque_signed_by_name text, cheque_signed_signature_url text, cheque_signed_at timestamp with time zone, cheque_counter_signed_by uuid, cheque_counter_signed_by_name text, cheque_counter_signed_signature_url text, cheque_counter_signed_at timestamp with time zone, payee_signed_name text, payee_signature_url text, payee_signed_at timestamp with time zone, disbursement_mode text, transfer_account_name text, transfer_account_number text, transfer_bank_name text, cash_payee_name text, counter_signatory_name text, current_signing_owner uuid, signing_stage text, is_multi_request boolean, item_count integer, total_amount numeric, voucher_scope text, status text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_is_assigned boolean;
begin
  v_role := public.current_profile_role_key();

  select exists (
    select 1
    from public.payment_vouchers pv
    where pv.id = p_voucher_id
      and (
        pv.current_signing_owner = auth.uid()
        or pv.cheque_signed_by = auth.uid()
        or pv.cheque_counter_signed_by = auth.uid()
        or pv.prepared_by = auth.uid()
        or pv.checked_by = auth.uid()
        or pv.authorized_by = auth.uid()
      )
  )
  into v_is_assigned;

  if not public.reqgen_pv_user_has_role(auth.uid(), array['admin','auditor','account','accounts','accountofficer','dg','directorgeneral','staff','hr','registry','director','hod']) and not v_is_assigned then
    raise exception 'Access denied.';
  end if;

  return query
  select
    pv.id,
    pv.voucher_no,
    pv.request_id,
    pv.request_no,
    pv.request_type,
    pv.personal_category,

    pv.payee_name,
    pv.narration,
    coalesce(pv.total_amount, pv.amount, 0) as amount,

    pv.dept_id,
    pv.dept_name,

    pv.subhead_id,
    pv.subhead_code,
    pv.subhead_name,

    pv.prepared_by,
    pv.prepared_by_name,
    pv.prepared_signature_url,
    pv.prepared_at,

    pv.checked_by,
    pv.checked_by_name,
    pv.checked_signature_url,
    pv.checked_at,

    pv.authorized_by,
    pv.authorized_by_name,
    pv.authorized_signature_url,
    pv.authorized_at,

    pv.cheque_no,
    pv.cheque_date,
    pv.bank_name,

    pv.cheque_signed_by,
    pv.cheque_signed_by_name,
    pv.cheque_signed_signature_url,
    pv.cheque_signed_at,

    pv.cheque_counter_signed_by,
    pv.cheque_counter_signed_by_name,
    pv.cheque_counter_signed_signature_url,
    pv.cheque_counter_signed_at,

    pv.payee_signed_name,
    pv.payee_signature_url,
    pv.payee_signed_at,

    pv.disbursement_mode,
    pv.transfer_account_name,
    pv.transfer_account_number,
    pv.transfer_bank_name,
    pv.cash_payee_name,
    pv.counter_signatory_name,

    pv.current_signing_owner,
    pv.signing_stage,

    coalesce(pv.is_multi_request, false),
    coalesce(pv.item_count, 1),
    coalesce(pv.total_amount, pv.amount, 0),
    coalesce(pv.voucher_scope, case when coalesce(pv.is_multi_request, false) then 'Multiple' else 'Single' end),

    pv.status,
    pv.created_at,
    pv.updated_at
  from public.payment_vouchers pv
  where pv.id = p_voucher_id;
end;
$function$;
create or replace function public.get_payment_voucher_items(p_voucher_id uuid)
 RETURNS TABLE(id uuid, voucher_id uuid, request_id uuid, request_no text, request_type text, personal_category text, title text, details text, amount numeric, dept_id uuid, dept_name text, subhead_id uuid, subhead_code text, subhead_name text, requester_name text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_is_assigned boolean;
begin
  v_role := public.current_profile_role_key();

  select exists (
    select 1
    from public.payment_vouchers pv
    where pv.id = p_voucher_id
      and (
        pv.current_signing_owner = auth.uid()
        or pv.cheque_signed_by = auth.uid()
        or pv.cheque_counter_signed_by = auth.uid()
        or pv.prepared_by = auth.uid()
        or pv.checked_by = auth.uid()
        or pv.authorized_by = auth.uid()
      )
  )
  into v_is_assigned;

  if not public.reqgen_pv_user_has_role(auth.uid(), array['admin','auditor','account','accounts','accountofficer','dg','directorgeneral','hr','registry','director','hod','staff']) and not v_is_assigned then
    raise exception 'Access denied.';
  end if;

  return query
  select
    pvi.id,
    pvi.voucher_id,
    pvi.request_id,
    pvi.request_no,
    pvi.request_type,
    pvi.personal_category,
    pvi.title,
    pvi.details,
    pvi.amount,
    pvi.dept_id,
    pvi.dept_name,
    pvi.subhead_id,
    pvi.subhead_code,
    pvi.subhead_name,
    pvi.requester_name,
    pvi.created_at
  from public.payment_voucher_items pvi
  where pvi.voucher_id = p_voucher_id
  order by pvi.created_at asc, pvi.request_no asc;
end;
$function$;
create or replace function public.get_payment_voucher_history(p_voucher_id uuid)
 RETURNS TABLE(id uuid, action_type text, from_status text, to_status text, comment text, actor_name text, actor_role text, actor_signature_url text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
begin
  v_role := public.current_profile_role_key();

  if not public.reqgen_pv_user_has_role(auth.uid(), array['admin','auditor','account','accounts','accountofficer']) and not exists (select 1 from public.payment_vouchers pv where pv.id = p_voucher_id and auth.uid() in (pv.current_signing_owner, pv.cheque_signed_by, pv.cheque_counter_signed_by, pv.prepared_by, pv.checked_by, pv.authorized_by)) then
    raise exception 'Access denied. Only Admin, Auditor and Account Officers can view voucher history.';
  end if;

  return query
  select
    h.id,
    h.action_type,
    h.from_status,
    h.to_status,
    h.comment,
    h.actor_name,
    h.actor_role,
    h.actor_signature_url,
    h.created_at
  from public.payment_voucher_history h
  where h.voucher_id = p_voucher_id
  order by h.created_at asc;
end;
$function$;
create or replace function public.get_payment_vouchers()
 RETURNS TABLE(id uuid, voucher_no text, request_id uuid, request_no text, request_type text, personal_category text, payee_name text, narration text, amount numeric, dept_name text, subhead_code text, subhead_name text, prepared_by_name text, checked_by_name text, authorized_by_name text, disbursement_mode text, is_multi_request boolean, item_count integer, total_amount numeric, voucher_scope text, status text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
begin
  v_role := public.current_profile_role_key();

  if not public.reqgen_pv_user_has_role(auth.uid(), array['admin','auditor','account','accounts','accountofficer']) then
    raise exception 'Access denied. Only Admin, Auditor and Account Officers can view payment vouchers.';
  end if;

  return query
  select
    pv.id,
    pv.voucher_no,
    pv.request_id,
    pv.request_no,
    pv.request_type,
    pv.personal_category,
    pv.payee_name,
    pv.narration,
    coalesce(pv.total_amount, pv.amount, 0) as amount,
    pv.dept_name,
    pv.subhead_code,
    pv.subhead_name,
    pv.prepared_by_name,
    pv.checked_by_name,
    pv.authorized_by_name,
    pv.disbursement_mode,
    coalesce(pv.is_multi_request, false),
    coalesce(pv.item_count, 1),
    coalesce(pv.total_amount, pv.amount, 0),
    coalesce(pv.voucher_scope, case when coalesce(pv.is_multi_request, false) then 'Multiple' else 'Single' end),
    pv.status,
    pv.created_at
  from public.payment_vouchers pv
  order by pv.created_at desc;
end;
$function$;

commit;

-- ---------------------------------------------------------------------------
-- Verification + where every unsigned voucher is right now
-- ---------------------------------------------------------------------------
select '1. Auditor can check without waiting for signers' as check_item,
       case when (select prosrc from pg_proc where proname = 'reqgen_pv_sign' limit 1) not like '%must be assigned before the voucher can be checked%' then 'OK' else 'CHECK' end as status, '' as detail
union all select '2. Signers can be chosen until the Cheque Signer signs',
       case when (select prosrc from pg_proc where proname = 'reqgen_pv_assign_signers' limit 1) like '%until the Cheque Signer signs%' then 'OK' else 'CHECK' end, ''
union all select '3. Voucher detail opens by any held role',
       case when (select prosrc from pg_proc where proname = 'get_payment_voucher_detail' limit 1) like '%reqgen_pv_user_has_role%' then 'OK' else 'CHECK' end, ''
union all select '4. Auditors who can check (with a saved signature)', 'OK',
       (select string_agg(p.full_name, ', ') from public.profiles p
        where public.reqgen_pv_user_has_role(p.id, array['auditor']) and coalesce(p.signature_url, '') <> '')
union all select '5. ' || coalesce(v.voucher_no, '?') || ' — ' || v.status, 'NOW WITH',
       case v.status
         when 'Pending Check' then coalesce((select full_name from public.profiles where id = v.current_signing_owner), 'any Auditor')
         when 'Pending Cheque Signature' then coalesce(v.cheque_signed_by_name, 'Account Officer: choose the signers')
         when 'Pending Counter Signature' then coalesce(v.cheque_counter_signed_by_name, 'Counter Signer')
         when 'Pending DG Authorisation' then 'Director General'
         else v.status end
from public.payment_vouchers v
where v.status like 'Pending%';
