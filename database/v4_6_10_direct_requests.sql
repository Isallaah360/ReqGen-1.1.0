-- =====================================================================================
-- ReqGen v4.6.10 — Direct requests: write to a named person, who forwards it to the DG
--
-- Also (part 3): staff no longer choose a subhead, so the officer who sees the budget must be able to
-- assign it. The September 2026 guard on the requests table accepted only the position keys director,
-- dinadmin, hod, registrar and hr, so a DOD (key "dod") or the HR Coordinator / HR Officers (keys
-- "hrcoordinator", "hrofficer1"…) were refused. The guard now accepts those same positions under their
-- current keys. The locked rule is unchanged: the DG, Admin, Auditor, Finance/Account and Staff never
-- assign a subhead. The guard is saved in reqgen_function_backups first.
--
-- Direct request (owner's instruction of 6 November 2026, YES given to the two new columns):
--     anyone writes a request to a named person in any department. That person may
--       * forward it to another person,           * send it back to the writer with a reason,
--       * decline it with a reason,               * forward it to the Director General. For a money
--         request they first choose the Account Officer who will treat it.
--     The DG approves (fresh 2FA, signature and IET stamp), sends it back to the person who forwarded
--     it, or declines it. A money request then goes to the chosen Account Officer, who releases the fund
--     and prepares the voucher; it needs no subhead. Other requests close as approved.
--
--   * Adds TWO columns to public.requests: direct_to (the person it is addressed to now) and
--     direct_forwarded_by (who forwarded it to the DG). Nothing is removed. No new table.
--   * Direct requests move only through the new functions reqgen_direct_*; the Routing Engine is NOT
--     used for them and NOT changed (approve_request_step, reqgen_next_route_step, build_request_route,
--     reqgen_build_route_for_template, reqgen_save_department_route, reqgen_actor_role_for_stage and the
--     route tables are untouched). They use only stage and status values the requests table already
--     allows, so no table rule is changed.
--   * They are stored as personal requests (request_type 'Personal'), so the existing rule that an
--     OFFICIAL request needs a subhead before the DG does not apply to them.
--   * No existing function is replaced.
--   * Safe to run more than once. Ends with an all-OK table.
-- =====================================================================================

create temp table if not exists v4610_report (step text, item text, detail text, result text) on commit preserve rows;
truncate v4610_report;

-- 1. Direct requests: two new columns (owner's YES, 6 November 2026)
alter table public.requests add column if not exists direct_to uuid references public.profiles(id) on delete set null;
alter table public.requests add column if not exists direct_forwarded_by uuid references public.profiles(id) on delete set null;
create index if not exists requests_direct_to_idx on public.requests (direct_to) where direct_to is not null;
insert into v4610_report values ('1 direct', 'requests.direct_to, requests.direct_forwarded_by', 'two columns added (nothing removed)', 'OK');

-- 1a. People a Direct request can be addressed to: active staff of a department (not system accounts)
create or replace function public.reqgen_direct_people(p_dept_id uuid)
returns table (id uuid, full_name text, position_names text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name::text,
         coalesce((select string_agg(distinct coalesce(nullif(pr.role_name, ''), pr.role_key), ', ')
                     from public.profile_roles pr
                    where pr.profile_id = p.id and coalesce(pr.is_active, true)
                      and public.pv_role_key(pr.role_key) not in ('staff', 'admin', 'superadmin')), '')::text
    from public.profiles p
   where auth.uid() is not null
     and p.dept_id = p_dept_id
     and coalesce(p.is_active, true)
     and coalesce(to_jsonb(p)->>'system_account', '') = ''
     and p.id <> auth.uid()
   order by p.full_name;
$$;
revoke all on function public.reqgen_direct_people(uuid) from public, anon;
grant execute on function public.reqgen_direct_people(uuid) to authenticated;

-- 1b. Account Officers a forwarding officer can choose
create or replace function public.reqgen_direct_account_officers()
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name::text
    from public.profiles p
   where auth.uid() is not null
     and coalesce(p.is_active, true)
     and coalesce(to_jsonb(p)->>'system_account', '') = ''
     and public.reqgen_pv_user_has_role(p.id, array['accountofficer', 'account'])
   order by p.full_name;
$$;
revoke all on function public.reqgen_direct_account_officers() from public, anon;
grant execute on function public.reqgen_direct_account_officers() to authenticated;

-- helper: one history line for a Direct request
create or replace function public.reqgen_direct_log(p_request_id uuid, p_action text, p_from text, p_to text, p_comment text, p_signature_url text, p_role_name text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.request_history (request_id, action_by, actor_name, actor_role_key, actor_role_name, from_stage, to_stage, action_type, comment, signature_url, actor_signature_url, created_at)
  select p_request_id, auth.uid(), coalesce(nullif(trim(p.full_name), ''), 'Staff'), null, p_role_name, p_from, p_to, p_action, nullif(trim(coalesce(p_comment, '')), ''), p_signature_url, p_signature_url, now()
    from public.profiles p where p.id = auth.uid();
$$;
revoke all on function public.reqgen_direct_log(uuid, text, text, text, text, text, text) from public, anon, authenticated;

-- helper: in-app notice for the person who now holds it (SMS and email are sent by the app)
create or replace function public.reqgen_direct_notify(p_user uuid, p_request_id uuid, p_title text, p_message text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, title, message, link, is_read)
  select p_user, p_title, p_message, '/requests/' || p_request_id::text, false where p_user is not null;
$$;
revoke all on function public.reqgen_direct_notify(uuid, uuid, text, text) from public, anon, authenticated;

-- 1c. Write a Direct request
create or replace function public.reqgen_direct_submit(p_title text, p_details text, p_amount numeric, p_to uuid, p_request_no text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  w public.profiles%rowtype;
  t public.profiles%rowtype;
  v_id uuid;
  v_no text;
  v_amt numeric := coalesce(p_amount, 0);
begin
  if me is null then raise exception 'Please sign in again.'; end if;
  select * into w from public.profiles where id = me;
  if coalesce(w.is_active, true) = false then raise exception 'Your account is not active.'; end if;
  if nullif(trim(coalesce(w.signature_url, '')), '') is null then raise exception 'Add your signature in My Account first.'; end if;
  if length(trim(coalesce(p_title, ''))) < 3 then raise exception 'Write the title.'; end if;
  if length(trim(coalesce(p_details, ''))) < 3 then raise exception 'Write what the request is for.'; end if;
  if v_amt < 0 then raise exception 'The amount cannot be negative.'; end if;
  select * into t from public.profiles where id = p_to;
  if not found or coalesce(t.is_active, true) = false or coalesce(to_jsonb(t)->>'system_account', '') <> '' then
    raise exception 'Choose an active staff member to send it to.';
  end if;
  if p_to = me then raise exception 'You cannot send a request to yourself.'; end if;
  v_no := coalesce(nullif(trim(coalesce(p_request_no, '')), ''), 'REQ-' || to_char(now(), 'YYYYMM') || '-' || right(extract(epoch from clock_timestamp())::bigint::text, 6));

  insert into public.requests (request_no, title, details, amount, dept_id, subhead_id, status, current_stage, current_owner,
                               request_type, personal_category, created_by, requester_name, requester_signature_url,
                               direct_to, created_at, updated_at)
  values (v_no, trim(p_title), trim(p_details), v_amt, coalesce(w.dept_id, t.dept_id), null, 'Pending Review', 'Submitted', p_to,
          'Personal', case when v_amt > 0 then 'Fund' else 'Others' end, me, w.full_name, w.signature_url,
          p_to, now(), now())
  returning id into v_id;

  perform public.reqgen_direct_log(v_id, 'Submit', null, 'Submitted', 'Direct request to ' || coalesce(t.full_name, 'staff') || '.', w.signature_url, 'Staff / Requester');
  perform public.reqgen_direct_notify(p_to, v_id, 'New request awaits your approval', v_no || ': ' || trim(p_title) || ' — a direct request from ' || coalesce(w.full_name, 'staff') || '.');
  return jsonb_build_object('ok', true, 'request_id', v_id, 'request_no', v_no, 'first_stage', 'Submitted', 'to', t.full_name);
end;
$$;
revoke all on function public.reqgen_direct_submit(text, text, numeric, uuid, text) from public, anon;
grant execute on function public.reqgen_direct_submit(text, text, numeric, uuid, text) to authenticated;

-- 1d. Every action on a Direct request
--   at the addressed person ('Submitted'): forward (p_to), to_dg (p_account_officer for money), return, decline
--   at the writer (returned):              resend
--   at the DG ('DG'):                      approve, return, decline
--   at the Account Officer ('Account'):    release (then the app prepares the voucher)
create or replace function public.reqgen_direct_act(p_request_id uuid, p_action text, p_comment text default null,
                                                    p_to uuid default null, p_account_officer uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r public.requests%rowtype;
  mep public.profiles%rowtype;
  t public.profiles%rowtype;
  v_act text := lower(trim(coalesce(p_action, '')));
  v_stage text;
  v_dg uuid;
  v_sig text;
  v_note text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if me is null then raise exception 'Please sign in again.'; end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.direct_to is null then raise exception 'This is not a direct request.'; end if;
  if r.current_owner is distinct from me then raise exception 'This request is not with you.'; end if;
  select * into mep from public.profiles where id = me;
  v_sig := nullif(trim(coalesce(mep.signature_url, '')), '');
  v_stage := upper(regexp_replace(coalesce(r.current_stage, ''), '[\s_-]+', '', 'g'));
  if v_sig is null and v_act <> 'resend' then raise exception 'Add your signature in My Account first.'; end if;
  if v_act in ('return', 'decline') and v_note is null then raise exception 'Write the reason.'; end if;

  -- the writer resends after a return
  if v_act = 'resend' then
    if r.created_by <> me or r.status <> 'Returned for correction' then raise exception 'Only the writer resends a returned request.'; end if;
    update public.requests set current_owner = r.direct_to, status = 'Pending Review', current_stage = 'Submitted', updated_at = now() where id = r.id;
    perform public.reqgen_direct_log(r.id, 'Resubmitted', 'Submitted', 'Submitted', coalesce(v_note, 'Corrected and sent again.'), mep.signature_url, 'Staff / Requester');
    perform public.reqgen_direct_notify(r.direct_to, r.id, 'New request awaits your approval', r.request_no || ' was corrected and sent back to you.');
    return jsonb_build_object('ok', true, 'new_stage', 'Submitted', 'new_status', 'Pending Review', 'new_owner', r.direct_to);
  end if;

  if v_stage = 'SUBMITTED' then
    if v_act = 'forward' then
      select * into t from public.profiles where id = p_to;
      if not found or coalesce(t.is_active, true) = false or coalesce(to_jsonb(t)->>'system_account', '') <> '' or p_to in (me, r.created_by) then
        raise exception 'Choose another active staff member.';
      end if;
      update public.requests set current_owner = p_to, direct_to = p_to, updated_at = now() where id = r.id;
      perform public.reqgen_direct_log(r.id, 'Forwarded', 'Submitted', 'Submitted', 'Forwarded to ' || t.full_name || coalesce('. ' || v_note, '.'), v_sig, 'Addressed officer');
      perform public.reqgen_direct_notify(p_to, r.id, 'New request awaits your approval', r.request_no || ': forwarded to you by ' || coalesce(mep.full_name, 'an officer') || '.');
      return jsonb_build_object('ok', true, 'new_stage', 'Submitted', 'new_status', r.status, 'new_owner', p_to);
    elsif v_act = 'to_dg' then
      if coalesce(r.amount, 0) > 0 then
        if p_account_officer is null or not public.reqgen_pv_user_has_role(p_account_officer, array['accountofficer', 'account']) then
          raise exception 'Choose the Account Officer who will treat this money request.';
        end if;
      end if;
      select p.id into v_dg from public.profiles p
       where coalesce(p.is_active, true) and coalesce(to_jsonb(p)->>'system_account', '') = '' and public.reqgen_pv_user_has_role(p.id, array['dg'])
       order by (select coalesce(bool_or(pr.is_primary), false) from public.profile_roles pr where pr.profile_id = p.id and public.pv_role_key(pr.role_key) = 'dg') desc, p.full_name
       limit 1;
      if v_dg is null then raise exception 'No active Director General is set up in ReqGen.'; end if;
      if v_dg = me then raise exception 'You are the Director General: approve it from the DG step instead.'; end if;
      update public.requests set current_stage = 'DG', status = 'Pending DG Approval', current_owner = v_dg, direct_forwarded_by = me,
             assigned_account_officer_id = case when coalesce(r.amount, 0) > 0 then p_account_officer else null end,
             assigned_account_officer_name = case when coalesce(r.amount, 0) > 0 then (select full_name from public.profiles where id = p_account_officer) else null end,
             updated_at = now()
       where id = r.id;
      perform public.reqgen_direct_log(r.id, 'Approved', 'Submitted', 'DG', coalesce(v_note, 'Seen and forwarded to the Director General.'), v_sig, 'Addressed officer');
      perform public.reqgen_direct_notify(v_dg, r.id, 'New request awaits your approval', r.request_no || ': forwarded to you by ' || coalesce(mep.full_name, 'an officer') || '.');
      return jsonb_build_object('ok', true, 'new_stage', 'DG', 'new_status', 'Pending DG Approval', 'new_owner', v_dg);
    elsif v_act = 'return' then
      update public.requests set current_owner = r.created_by, status = 'Returned for correction', updated_at = now() where id = r.id;
      perform public.reqgen_direct_log(r.id, 'Return', 'Submitted', 'Submitted', v_note, v_sig, 'Addressed officer');
      perform public.reqgen_direct_notify(r.created_by, r.id, 'Request returned for correction', r.request_no || ': ' || v_note);
      return jsonb_build_object('ok', true, 'new_stage', 'Submitted', 'new_status', 'Returned for correction', 'new_owner', r.created_by);
    elsif v_act = 'decline' then
      update public.requests set current_stage = 'Rejected', status = 'Rejected', current_owner = null, updated_at = now() where id = r.id;
      perform public.reqgen_direct_log(r.id, 'Rejected', 'Submitted', 'Rejected', v_note, v_sig, 'Addressed officer');
      perform public.reqgen_direct_notify(r.created_by, r.id, 'Request declined', r.request_no || ': ' || v_note);
      return jsonb_build_object('ok', true, 'new_stage', 'Rejected', 'new_status', 'Rejected');
    end if;
  elsif v_stage = 'DG' then
    if not public.reqgen_pv_user_has_role(me, array['dg']) then raise exception 'Only the Director General acts at this step.'; end if;
    if v_act = 'approve' then
      if coalesce(r.amount, 0) > 0 then
        update public.requests set current_stage = 'Account', status = 'Approved by DG - Pending Account', current_owner = r.assigned_account_officer_id,
               dg_name = mep.full_name, dg_signature_url = v_sig, updated_at = now() where id = r.id;
        perform public.reqgen_direct_log(r.id, 'Approved', 'DG', 'Account', coalesce(v_note, 'Approved.'), v_sig, 'Director General');
        perform public.reqgen_direct_notify(r.assigned_account_officer_id, r.id, 'New request awaits your approval', r.request_no || ': approved by the Director General — release the fund.');
        perform public.reqgen_direct_notify(r.created_by, r.id, 'Request approved', r.request_no || ' was approved by the Director General and sent to Account.');
        return jsonb_build_object('ok', true, 'new_stage', 'Account', 'new_status', 'Approved by DG - Pending Account', 'new_owner', r.assigned_account_officer_id);
      else
        update public.requests set current_stage = 'Completed', status = 'Approved', current_owner = null,
               dg_name = mep.full_name, dg_signature_url = v_sig, updated_at = now() where id = r.id;
        perform public.reqgen_direct_log(r.id, 'Approved', 'DG', 'Completed', coalesce(v_note, 'Approved.'), v_sig, 'Director General');
        perform public.reqgen_direct_notify(r.created_by, r.id, 'Request approved', r.request_no || ' was approved by the Director General.');
        return jsonb_build_object('ok', true, 'new_stage', 'Completed', 'new_status', 'Approved');
      end if;
    elsif v_act = 'return' then
      update public.requests set current_stage = 'Submitted', status = 'Returned by the Director General', current_owner = coalesce(r.direct_forwarded_by, r.direct_to), updated_at = now() where id = r.id;
      perform public.reqgen_direct_log(r.id, 'Return', 'DG', 'Submitted', v_note, v_sig, 'Director General');
      perform public.reqgen_direct_notify(coalesce(r.direct_forwarded_by, r.direct_to), r.id, 'Request returned for correction', r.request_no || ' was sent back by the Director General: ' || v_note);
      return jsonb_build_object('ok', true, 'new_stage', 'Submitted', 'new_status', 'Returned by the Director General', 'new_owner', coalesce(r.direct_forwarded_by, r.direct_to));
    elsif v_act = 'decline' then
      update public.requests set current_stage = 'Rejected', status = 'Rejected', current_owner = null, updated_at = now() where id = r.id;
      perform public.reqgen_direct_log(r.id, 'Rejected', 'DG', 'Rejected', v_note, v_sig, 'Director General');
      perform public.reqgen_direct_notify(r.created_by, r.id, 'Request declined', r.request_no || ': ' || v_note);
      return jsonb_build_object('ok', true, 'new_stage', 'Rejected', 'new_status', 'Rejected');
    end if;
  elsif v_stage = 'ACCOUNT' then
    if v_act = 'release' then
      if not public.reqgen_pv_user_has_role(me, array['accountofficer', 'account']) then raise exception 'Only the Account Officer releases the fund.'; end if;
      update public.requests set current_stage = 'Completed', status = 'Paid', current_owner = null,
             account_name = mep.full_name, account_signature_url = v_sig, updated_at = now() where id = r.id;
      perform public.reqgen_direct_log(r.id, 'Paid', 'Account', 'Completed', coalesce(v_note, 'Fund released.'), v_sig, 'Account Officer');
      perform public.reqgen_direct_notify(r.created_by, r.id, 'Payment made', r.request_no || ': the fund was released by ' || coalesce(mep.full_name, 'Account') || '.');
      return jsonb_build_object('ok', true, 'new_stage', 'Completed', 'new_status', 'Paid');
    elsif v_act = 'return' then
      update public.requests set current_stage = 'DG', status = 'Pending DG Approval', current_owner = (
               select h.action_by from public.request_history h where h.request_id = r.id and h.to_stage = 'Account' order by h.created_at desc limit 1),
             updated_at = now() where id = r.id;
      perform public.reqgen_direct_log(r.id, 'Return', 'Account', 'DG', v_note, v_sig, 'Account Officer');
      return jsonb_build_object('ok', true, 'new_stage', 'DG', 'new_status', 'Pending DG Approval');
    end if;
  end if;
  raise exception 'That action is not possible at this step.';
end;
$$;
revoke all on function public.reqgen_direct_act(uuid, text, text, uuid, uuid) from public, anon;
grant execute on function public.reqgen_direct_act(uuid, text, text, uuid, uuid) to authenticated;
insert into v4610_report values ('1 direct', 'reqgen_direct_people, _account_officers, _submit, _act', 'write, forward, send back, decline, DG, Account', 'OK');


-- 3. The subhead guard accepts the current keys of the same positions
do $b$
begin
  if to_regprocedure('public.reqgen_enforce_subhead_assignment_authority()') is null then
    insert into v4610_report values ('3 subhead guard', 'reqgen_enforce_subhead_assignment_authority', 'not installed here: nothing to change', 'OK');
    return;
  end if;
  if to_regclass('public.reqgen_function_backups') is not null then
    insert into public.reqgen_function_backups (function_name, function_identity, release, definition)
    select p.proname, pg_get_function_identity_arguments(p.oid), 'v4.6.10', pg_get_functiondef(p.oid)
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname = 'reqgen_enforce_subhead_assignment_authority'
       and not exists (select 1 from public.reqgen_function_backups b where b.function_name = p.proname and b.release = 'v4.6.10');
  end if;

  execute $fn$
create or replace function public.reqgen_enforce_subhead_assignment_authority()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $g$
declare
  v_actor uuid := auth.uid();
  v_active_role text;
begin
  -- only assigning or changing a non-null subhead is checked
  if new.subhead_id is not distinct from old.subhead_id or new.subhead_id is null then
    return new;
  end if;
  -- maintenance without an end-user session
  if v_actor is null then
    return new;
  end if;

  select lower(regexp_replace(coalesce(uar.active_role_key, ''), '[^a-z0-9]+', '', 'g'))
    into v_active_role
    from public.user_active_roles uar
   where uar.user_id = v_actor
   limit 1;

  -- v4.6.10: the same five positions under their current keys
  v_active_role := case
    when v_active_role in ('director', 'dod') then 'director'
    when v_active_role in ('deanadmin', 'dinadmin') or v_active_role ~ '^dinadmin[0-9]+$' then 'dinadmin'
    when v_active_role in ('hr', 'hrcoordinator', 'hrboss', 'headofhr') or v_active_role ~ '^hrofficer[0-9]*$' then 'hr'
    else v_active_role
  end;

  if coalesce(v_active_role, '') not in ('director', 'dinadmin', 'hod', 'registrar', 'hr') then
    raise exception 'Subhead assignment is restricted to Director, DIN/Dean Admin, HOD, Registrar or HR while operating in that active role.';
  end if;

  return new;
end;
$g$;
$fn$;
  insert into v4610_report values ('3 subhead guard', 'reqgen_enforce_subhead_assignment_authority', 'accepts DOD, DIN Admin, HOD, Registrar, HR Coordinator / HR Officers; still refuses DG, Admin, Auditor, Account, Staff', 'OK');
end
$b$;

-- 4. Checks
insert into v4610_report
select '4 check', 'functions installed', count(*)::text || ' of 6', case when count(*) = 6 then 'OK' else 'CHECK' end
  from pg_proc where pronamespace = 'public'::regnamespace
   and proname in ('reqgen_direct_people', 'reqgen_direct_account_officers', 'reqgen_direct_log', 'reqgen_direct_notify', 'reqgen_direct_submit', 'reqgen_direct_act');
insert into v4610_report
select '4 check', 'anonymous visitors cannot call it',
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'blocked' else 'open' end,
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'OK' else 'CHECK' end
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('reqgen_direct_people', 'reqgen_direct_account_officers', 'reqgen_direct_log', 'reqgen_direct_notify', 'reqgen_direct_submit', 'reqgen_direct_act');
insert into v4610_report
select '4 check', 'both new columns present', count(*)::text || ' of 2', case when count(*) = 2 then 'OK' else 'CHECK' end
  from information_schema.columns where table_schema = 'public' and table_name = 'requests' and column_name in ('direct_to', 'direct_forwarded_by');
insert into v4610_report
select '4 check', 'routing engine untouched (still installed)', count(*)::text || ' of 5',
       case when count(*) >= 5 then 'OK' else 'CHECK' end
  from (select distinct proname from pg_proc where pronamespace = 'public'::regnamespace
          and proname in ('approve_request_step', 'reqgen_next_route_step', 'build_request_route',
                          'reqgen_build_route_for_template', 'reqgen_save_department_route')) f;
notify pgrst, 'reload schema';

select step, item, detail, result from v4610_report order by step, item;
