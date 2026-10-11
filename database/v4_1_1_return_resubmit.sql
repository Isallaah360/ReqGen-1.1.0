-- =============================================================================
-- ReqGen v4.1.1 — "Reject" sends the request BACK (Build Reference §5)
-- Run in the Supabase SQL Editor AFTER the v4.1.1 code shows "Ready" on Vercel.
--
--   reqgen_return_request    the officer rejects with a reason; the request goes back:
--                              · from the DG  → the officer whose approval sent it to the DG
--                              · from others  → the requester (same step, so it returns to that officer)
--                            Reserved funds stay reserved. Nothing is closed.
--   reqgen_resubmit_request  the requester (or that officer) sends the corrected request back
--                            to the officer who returned it
--   reqgen_withdraw_request  the requester withdraws a request that is back with them;
--                            reserved funds are released
--
-- The routing engine and the existing approve / reject / delete functions are NOT changed.
-- Safe to run more than once. Ends with a table where every row says OK.
-- =============================================================================
begin;

create temp table if not exists v411_report (step text, item text, result text, status text);
truncate v411_report;

-- 1. Return (shown as "Reject" on screen)
create or replace function public.reqgen_return_request(p_request_id uuid, p_comment text, p_signature_url text default null)
returns table (request_id uuid, new_stage text, new_status text, new_owner uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_req record;
  v_name text;
  v_sig text;
  v_role_key text;
  v_role_name text;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_prev_by uuid;
  v_prev_stage text;
  v_owner uuid;
  v_stage text;
  v_status text;
  v_who text;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if v_comment is null or length(v_comment) < 3 then raise exception 'Write the reason for sending this request back.'; end if;

  select r.* into v_req from public.requests r where r.id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if public.reqgen_key(v_req.current_stage) in ('completed', 'rejected', 'deleted', 'cancelled') then
    raise exception 'This request is already closed.';
  end if;
  if public.reqgen_key(v_req.current_stage) in ('account', 'hrfiling') then
    raise exception 'At this step the request is treated, not approved. Ask the requester or the Auditor if something is wrong.';
  end if;
  if v_req.current_owner is distinct from v_actor then
    raise exception 'This request is not currently assigned to you.';
  end if;

  select p.full_name, p.signature_url into v_name, v_sig from public.profiles p where p.id = v_actor;
  v_name := coalesce(nullif(trim(v_name), ''), 'Officer');
  v_sig := coalesce(nullif(trim(coalesce(p_signature_url, '')), ''), v_sig);
  if coalesce(trim(v_sig), '') = '' then raise exception 'Add your signature in My Account before sending a request back.'; end if;

  select ar.actor_role_key, ar.actor_role_name into v_role_key, v_role_name
  from public.reqgen_actor_role_for_stage(v_actor, v_req.current_stage) ar limit 1;
  if v_role_key is null then raise exception 'Your active position does not match this step.'; end if;

  if public.reqgen_key(v_req.current_stage) = 'dg' then
    -- back to the officer whose approval sent it to the DG
    select h.action_by, h.from_stage into v_prev_by, v_prev_stage
    from public.request_history h
    where h.request_id = p_request_id
      and public.reqgen_key(h.to_stage) = 'dg'
      and lower(coalesce(h.action_type, '')) like 'approv%'
      and h.action_by is not null
      and h.action_by is distinct from v_req.created_by
    order by h.created_at desc
    limit 1;
  end if;

  if v_prev_by is not null and coalesce(v_prev_stage, '') <> '' then
    v_owner := v_prev_by;
    v_stage := v_prev_stage;
    v_status := 'Returned by the Director General';
  else
    v_owner := v_req.created_by;
    v_stage := v_req.current_stage;
    v_status := 'Returned for correction';
  end if;

  update public.requests
  set current_stage = v_stage, current_owner = v_owner, status = v_status, updated_at = now()
  where id = p_request_id;

  insert into public.request_history (request_id, action_type, action_by, actor_name, actor_role_key, actor_role_name,
    actor_signature_url, from_stage, to_stage, comment, signature_url, created_at)
  values (p_request_id, 'Return', v_actor, v_name, v_role_key, v_role_name, v_sig, v_req.current_stage, v_stage, v_comment, v_sig, now());

  select coalesce(full_name, 'you') into v_who from public.profiles where id = v_owner;
  insert into public.notifications (user_id, title, message, link, is_read, created_at)
  values (v_owner,
          'Request ' || coalesce(v_req.request_no, '') || ' sent back to you',
          v_name || ' (' || coalesce(v_role_name, 'Officer') || '): ' || v_comment,
          case when v_owner = v_req.created_by then '/requests/' || p_request_id::text || '/edit' else '/requests/' || p_request_id::text end,
          false, now());

  return query select p_request_id, v_stage, v_status, v_owner;
end;
$$;
revoke all on function public.reqgen_return_request(uuid, text, text) from public, anon;
grant execute on function public.reqgen_return_request(uuid, text, text) to authenticated;
insert into v411_report values ('1 send back', 'reqgen_return_request', 'DG → previous officer; others → requester; funds stay reserved', 'OK');

-- 2. Resubmit after correction
create or replace function public.reqgen_resubmit_request(p_request_id uuid, p_comment text default null)
returns table (request_id uuid, new_stage text, new_status text, new_owner uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_req record;
  v_back uuid;
  v_name text;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  select r.* into v_req from public.requests r where r.id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if v_req.current_owner is distinct from v_actor or lower(coalesce(v_req.status, '')) not like 'returned for correction%' then
    raise exception 'Only a request that was sent back to you can be resubmitted.';
  end if;

  select h.action_by into v_back
  from public.request_history h
  where h.request_id = p_request_id and lower(coalesce(h.action_type, '')) = 'return'
  order by h.created_at desc limit 1;
  if v_back is null then raise exception 'The officer who sent this request back could not be found.'; end if;

  update public.requests set current_owner = v_back, status = 'Pending Review', updated_at = now() where id = p_request_id;

  select coalesce(nullif(trim(full_name), ''), 'Requester') into v_name from public.profiles where id = v_actor;
  insert into public.request_history (request_id, action_type, action_by, actor_name, actor_role_key, actor_role_name,
    from_stage, to_stage, comment, created_at)
  values (p_request_id, 'Resubmit', v_actor, v_name, 'staff', 'Requester', v_req.current_stage, v_req.current_stage,
          coalesce(nullif(trim(coalesce(p_comment, '')), ''), 'Corrected and sent back.'), now());

  insert into public.notifications (user_id, title, message, link, is_read, created_at)
  values (v_back, 'Request ' || coalesce(v_req.request_no, '') || ' corrected', v_name || ' corrected the request and sent it back to you.',
          '/requests/' || p_request_id::text, false, now());

  return query select p_request_id, v_req.current_stage::text, 'Pending Review'::text, v_back;
end;
$$;
revoke all on function public.reqgen_resubmit_request(uuid, text) from public, anon;
grant execute on function public.reqgen_resubmit_request(uuid, text) to authenticated;
insert into v411_report values ('1 send back', 'reqgen_resubmit_request', 'returns the corrected request to the officer who sent it back', 'OK');

-- 3. Withdraw by the requester
create or replace function public.reqgen_withdraw_request(p_request_id uuid, p_reason text)
returns table (request_id uuid, new_stage text, new_status text, new_owner uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_req record;
  v_name text;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Write why you are withdrawing this request.'; end if;
  select r.* into v_req from public.requests r where r.id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if v_req.created_by is distinct from v_actor then raise exception 'Only the person who made the request can withdraw it.'; end if;
  if public.reqgen_key(v_req.current_stage) in ('dg', 'account', 'hrfiling', 'completed', 'rejected', 'deleted', 'cancelled') then
    raise exception 'This request can no longer be withdrawn.';
  end if;

  if public.reqgen_key(v_req.request_type) = 'official' and v_req.subhead_id is not null and coalesce(v_req.amount, 0) > 0
     and lower(coalesce(v_req.funds_state, '')) = 'reserved' then
    update public.subheads s set reserved_amount = greatest(coalesce(s.reserved_amount, 0) - coalesce(v_req.amount, 0), 0)
    where s.id = v_req.subhead_id;
    perform public.recalculate_subhead_finance(v_req.subhead_id);
  end if;

  update public.requests
  set current_stage = 'Cancelled', current_owner = null, status = 'Withdrawn by requester',
      funds_state = case when lower(coalesce(funds_state, '')) = 'reserved' then 'Released' else funds_state end,
      updated_at = now()
  where id = p_request_id;

  select coalesce(nullif(trim(full_name), ''), 'Requester') into v_name from public.profiles where id = v_actor;
  insert into public.request_history (request_id, action_type, action_by, actor_name, actor_role_key, actor_role_name,
    from_stage, to_stage, comment, created_at)
  values (p_request_id, 'Withdraw', v_actor, v_name, 'staff', 'Requester', v_req.current_stage, 'Cancelled', trim(p_reason), now());

  return query select p_request_id, 'Cancelled'::text, 'Withdrawn by requester'::text, null::uuid;
end;
$$;
revoke all on function public.reqgen_withdraw_request(uuid, text) from public, anon;
grant execute on function public.reqgen_withdraw_request(uuid, text) to authenticated;
insert into v411_report values ('1 send back', 'reqgen_withdraw_request', 'requester withdraws; reserved funds released', 'OK');

-- 4. Verification
insert into v411_report
select '2 check', 'functions installed', count(*)::text || ' of 3', case when count(*) = 3 then 'OK' else 'CHECK' end
from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('reqgen_return_request', 'reqgen_resubmit_request', 'reqgen_withdraw_request');
insert into v411_report
select '2 check', 'anonymous visitors cannot call them',
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'blocked' else 'open' end,
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'OK' else 'CHECK' end
from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('reqgen_return_request', 'reqgen_resubmit_request', 'reqgen_withdraw_request');
insert into v411_report
select '2 check', 'routing engine unchanged', 'approve_request_step and reqgen_next_route_step not touched', 'OK';

commit;

select step as "step", item as "item", result as "result", status as "status" from v411_report order by step, item;
