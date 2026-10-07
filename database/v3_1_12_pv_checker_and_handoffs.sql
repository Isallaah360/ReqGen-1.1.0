-- =============================================================================
-- ReqGen v3.1.12 — Payment voucher signing: chosen checker, clearer hand-offs
-- Run in the Supabase SQL Editor after deploying v3.1.12. Safe to re-run and
-- safe while staff are working (functions only; no table is altered).
--
--   * The Account Officer chooses the CHECKER (an Auditor), the Cheque Signer
--     and the Counter Signer in one in-app form. If no checker is chosen, any
--     Auditor may check.
--   * reqgen_pv_checkers() lists the Auditors for that form.
--   * The signing tracker shows the chosen checker by name.
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

-- The 3-argument version is replaced by the 4-argument one below (an optional
-- checker); keeping both would make the call ambiguous.
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

  if p_checker_id is not null then
    if not public.reqgen_pv_user_has_role(p_checker_id, array['auditor']) then
      raise exception 'The checker must be an Auditor.';
    end if;
    if p_checker_id = v_pv.prepared_by then
      raise exception 'The officer who prepared this voucher cannot also check it.';
    end if;
  end if;

  update public.payment_vouchers set
    current_signing_owner = p_checker_id,
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
    if v_pv.cheque_signed_by is null or v_pv.cheque_counter_signed_by is null then
      raise exception 'The Cheque Signer and Counter Signer must be assigned before the voucher can be checked.';
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
             case when v.cheque_signed_by is null or v.cheque_counter_signed_by is null
                  then 'Account Officer (assign signers)'
                  else coalesce((select p.full_name || ' (Auditor check)' from public.profiles p where p.id = v.current_signing_owner), 'Auditor (check)') end
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

-- "Waiting for me": a chosen checker sees only their vouchers; with no chosen
-- checker every Auditor sees it — but only once the signers are assigned.
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
         and pv.cheque_signed_by is not null and pv.cheque_counter_signed_by is not null
         and public.reqgen_pv_user_has_role(auth.uid(), array['auditor'])
         and pv.prepared_by is distinct from auth.uid())
     or (pv.status = 'Pending DG Authorisation' and public.reqgen_pv_user_has_role(auth.uid(), array['dg', 'directorgeneral']))
  order by pv.created_at desc;
end;
$$;

commit;

select '1. Checker list function' as check_item,
       case when to_regprocedure('public.reqgen_pv_checkers()') is not null then 'OK' else 'CHECK' end as status, '' as detail
union all select '2. Assign signers with checker',
       case when to_regprocedure('public.reqgen_pv_assign_signers(uuid,text,text,uuid)') is not null
             and to_regprocedure('public.reqgen_pv_assign_signers(uuid,text,text)') is null then 'OK' else 'CHECK' end, ''
union all select '3. Signing respects the chosen checker',
       case when (select prosrc from pg_proc where proname = 'reqgen_pv_sign' limit 1) like '%assigned to % for checking%' then 'OK' else 'CHECK' end, ''
union all select '4. Auditors available to check', 'OK', (select count(*)::text from public.reqgen_pv_checkers())
union all select '5. Vouchers waiting for signers to be assigned: ' || coalesce(v.voucher_no, '?'), 'CHECK',
       'Account Officer: open the voucher and choose the checker and signers'
from public.payment_vouchers v
where v.status = 'Pending Check' and (v.cheque_signed_by is null or v.cheque_counter_signed_by is null);
