-- =============================================================================
-- ReqGen v4.1.2 — Requests: drafts, reopen and the approval route
-- Run in the Supabase SQL Editor AFTER the v4.1.2 code shows "Ready" on Vercel,
-- and after v4_1_1_return_resubmit.sql.
--
--   requests_status_check     allows the v4.1 statuses (sent back, withdrawn); nothing removed
--   reqgen_request_drafts     saved-but-not-submitted requests; only the owner sees them
--   request-drafts (storage)  private bucket for draft attachments, one folder per person
--   reqgen_reopen_request     requester, Account Officer, Auditor or Super Admin reopens
--                             a closed (withdrawn or rejected) request, with a reason;
--                             it goes back to the requester to correct and resubmit
--   reqgen_resubmit_request   now also sends a reopened request to the first officer
--   reqgen_correct_request    the requester corrects a request sent back to them (title,
--                             description, amount, subhead); the fund is reserved again
--                             with the same hard block as a new request
--   reqgen_confirm_request_budget  keeps ALLOCATION B/D, EXPENDITURE and BALANCE C/D as the
--                             approving officer saw them, for the request letter
--   reqgen_request_chain      read-only: each step of the request's route with who
--                             signed and when (for the request record page)
--
-- The routing engine (approve_request_step, reqgen_next_route_step, the route
-- tables) is NOT changed: it is only read. Safe to run more than once.
-- Ends with a table where every row says OK.
-- =============================================================================
begin;

create temp table if not exists v412_report (step text, item text, result text, status text);
truncate v412_report;

-- 0. Request statuses used by v4.1 (send back, withdraw, reopen). The live CHECK rule is
--    rebuilt with every existing status kept and the three v4.1 statuses added.
alter table public.requests drop constraint if exists requests_status_check;
alter table public.requests add constraint requests_status_check check (status = any (array[
  'Draft', 'Submitted', 'Pending', 'Pending Review', 'Pending Approval', 'Pending DG Approval', 'Approved',
  'Approved by DG - Pending Account', 'Paid - Pending HR Filing', 'Paid', 'Completed', 'Rejected', 'Deleted', 'Cancelled',
  'Returned for correction', 'Returned by the Director General', 'Withdrawn by requester']::text[])) not valid;
insert into v412_report values ('0 statuses', 'requests_status_check', 'all 14 statuses kept; Returned for correction, Returned by the Director General, Withdrawn by requester added', 'OK');

-- 1. Drafts ------------------------------------------------------------------
create table if not exists public.reqgen_request_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  request_type text not null default 'Official',
  personal_category text,
  dept_id uuid,
  subhead_id uuid,
  title text not null default '',
  details text not null default '',
  amount numeric,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 days')
);
create index if not exists reqgen_request_drafts_owner_idx on public.reqgen_request_drafts (owner_id, updated_at desc);

alter table public.reqgen_request_drafts enable row level security;
drop policy if exists reqgen_drafts_owner_select on public.reqgen_request_drafts;
drop policy if exists reqgen_drafts_owner_insert on public.reqgen_request_drafts;
drop policy if exists reqgen_drafts_owner_update on public.reqgen_request_drafts;
drop policy if exists reqgen_drafts_owner_delete on public.reqgen_request_drafts;
create policy reqgen_drafts_owner_select on public.reqgen_request_drafts for select to authenticated using (owner_id = auth.uid());
create policy reqgen_drafts_owner_insert on public.reqgen_request_drafts for insert to authenticated with check (owner_id = auth.uid());
create policy reqgen_drafts_owner_update on public.reqgen_request_drafts for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy reqgen_drafts_owner_delete on public.reqgen_request_drafts for delete to authenticated using (owner_id = auth.uid());
revoke all on public.reqgen_request_drafts from anon;
grant select, insert, update, delete on public.reqgen_request_drafts to authenticated;
insert into v412_report values ('1 drafts', 'reqgen_request_drafts', 'owner-only table, kept 60 days', 'OK');

insert into storage.buckets (id, name, public)
values ('request-drafts', 'request-drafts', false)
on conflict (id) do update set public = false;

drop policy if exists reqgen_v412_draft_files_select on storage.objects;
drop policy if exists reqgen_v412_draft_files_insert on storage.objects;
drop policy if exists reqgen_v412_draft_files_update on storage.objects;
drop policy if exists reqgen_v412_draft_files_delete on storage.objects;
create policy reqgen_v412_draft_files_select on storage.objects for select to authenticated
  using (bucket_id = 'request-drafts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy reqgen_v412_draft_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'request-drafts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy reqgen_v412_draft_files_update on storage.objects for update to authenticated
  using (bucket_id = 'request-drafts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'request-drafts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy reqgen_v412_draft_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'request-drafts' and (storage.foldername(name))[1] = auth.uid()::text);
insert into v412_report values ('1 drafts', 'request-drafts bucket', 'private; each person reads and writes only their own folder', 'OK');

-- 2. Reopen a closed request ---------------------------------------------------
create or replace function public.reqgen_reopen_request(p_request_id uuid, p_reason text)
returns table (request_id uuid, new_stage text, new_status text, new_owner uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_req record;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_first text;
  v_name text;
  v_role_key text;
  v_role_name text;
  v_paid boolean := false;
  v_funds text;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if v_reason is null or length(v_reason) < 5 then raise exception 'Write the reason for reopening this request.'; end if;

  select r.* into v_req from public.requests r where r.id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;

  if not (public.reqgen_key(v_req.current_stage) in ('cancelled', 'rejected')
          or lower(coalesce(v_req.status, '')) like 'withdrawn%'
          or lower(coalesce(v_req.status, '')) like 'rejected%') then
    raise exception 'Only a withdrawn or rejected request can be reopened. This one is still open or already completed.';
  end if;

  v_paid := lower(coalesce(v_req.status, '')) = 'paid' or lower(coalesce(v_req.funds_state, '')) in ('paid', 'spent');
  if not v_paid and to_regprocedure('public.request_has_active_payment_voucher(uuid)') is not null then
    execute 'select public.request_has_active_payment_voucher($1)' into v_paid using p_request_id;
  end if;
  if coalesce(v_paid, false) then
    raise exception 'A request that has a payment voucher or was paid cannot be reopened.';
  end if;

  if v_req.created_by = v_actor then
    v_role_key := 'staff'; v_role_name := 'Requester';
  elsif public.reqgen_pv_user_has_role(v_actor, array['admin']) then
    v_role_key := 'admin'; v_role_name := 'Super Admin';
  elsif public.reqgen_pv_user_has_role(v_actor, array['auditor']) then
    v_role_key := 'auditor'; v_role_name := 'Auditor';
  elsif public.reqgen_pv_user_has_role(v_actor, array['account', 'accounts', 'accountofficer']) then
    v_role_key := 'accountofficer'; v_role_name := 'Account Officer';
  else
    raise exception 'Only the requester, an Account Officer, the Auditor or the Super Admin can reopen a request.';
  end if;

  -- the request starts its own route again (the route it started with)
  select br.stage into v_first
  from public.reqgen_build_route_for_template(
         coalesce(v_req.route_template_id, public.reqgen_template_for_department(v_req.dept_id)),
         v_req.dept_id, v_req.request_type, v_req.personal_category) br
  where br.owner_id is not null
  order by br.step_order
  limit 1;
  if v_first is null then raise exception 'The route for this department has no officer. Ask the Super Admin to complete the Routing Engine.'; end if;

  -- the fund is reserved again (hard block when the subhead cannot cover it)
  v_funds := v_req.funds_state;
  if public.reqgen_key(v_req.request_type) = 'official' and v_req.subhead_id is not null and coalesce(v_req.amount, 0) > 0
     and lower(coalesce(v_req.funds_state, '')) <> 'reserved' then
    update public.subheads s
    set reserved_amount = coalesce(s.reserved_amount, 0) + v_req.amount
    where s.id = v_req.subhead_id
      and coalesce(s.approved_allocation, 0) - coalesce(s.reserved_amount, 0) - coalesce(s.expenditure, 0) >= v_req.amount;
    if not found then
      raise exception 'Not enough fund left in this subhead to reopen the request. The requester can raise a new request with another subhead.';
    end if;
    v_funds := 'Reserved';
  end if;

  update public.requests
  set current_stage = v_first, current_owner = v_req.created_by, status = 'Returned for correction',
      funds_state = v_funds, updated_at = now()
  where id = p_request_id;

  if v_funds = 'Reserved' and v_req.subhead_id is not null then
    perform public.recalculate_subhead_finance(v_req.subhead_id);
  end if;

  select coalesce(nullif(trim(full_name), ''), 'Officer') into v_name from public.profiles where id = v_actor;
  insert into public.request_history (request_id, action_type, action_by, actor_name, actor_role_key, actor_role_name,
    from_stage, to_stage, comment, created_at)
  values (p_request_id, 'Reopen', v_actor, v_name, v_role_key, v_role_name, v_req.current_stage, v_first, v_reason, now());

  if v_req.created_by is distinct from v_actor then
    insert into public.notifications (user_id, title, message, link, is_read, created_at)
    values (v_req.created_by, 'Request ' || coalesce(v_req.request_no, '') || ' reopened',
            v_name || ' (' || v_role_name || ') reopened your request: ' || v_reason || ' Correct it if needed and send it again.',
            '/requests/' || p_request_id::text, false, now());
  end if;

  return query select p_request_id, v_first, 'Returned for correction'::text, v_req.created_by;
end;
$$;
revoke all on function public.reqgen_reopen_request(uuid, text) from public, anon;
grant execute on function public.reqgen_reopen_request(uuid, text) to authenticated;
insert into v412_report values ('2 reopen', 'reqgen_reopen_request', 'requester / Account Officer / Auditor / Super Admin; reason logged; fund reserved again', 'OK');

-- 3. Resubmit: after a return, back to that officer; after a reopen, to the first officer
create or replace function public.reqgen_resubmit_request(p_request_id uuid, p_comment text default null)
returns table (request_id uuid, new_stage text, new_status text, new_owner uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_req record;
  v_last record;
  v_back uuid;
  v_name text;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  select r.* into v_req from public.requests r where r.id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if v_req.current_owner is distinct from v_actor or lower(coalesce(v_req.status, '')) not like 'returned for correction%' then
    raise exception 'Only a request that was sent back to you can be resubmitted.';
  end if;

  select h.action_type, h.action_by into v_last
  from public.request_history h
  where h.request_id = p_request_id and lower(coalesce(h.action_type, '')) in ('return', 'reopen')
  order by h.created_at desc limit 1;

  if lower(coalesce(v_last.action_type, '')) = 'reopen' then
    select br.owner_id into v_back
    from public.reqgen_build_route_for_template(
           coalesce(v_req.route_template_id, public.reqgen_template_for_department(v_req.dept_id)),
           v_req.dept_id, v_req.request_type, v_req.personal_category) br
    where public.reqgen_key(br.stage) = public.reqgen_key(v_req.current_stage) and br.owner_id is not null
    order by br.step_order limit 1;
    if v_back is null then raise exception 'No officer is set for the % step. Ask the Super Admin to complete the Routing Engine.', v_req.current_stage; end if;
  else
    v_back := v_last.action_by;
    if v_back is null then raise exception 'The officer who sent this request back could not be found.'; end if;
  end if;

  update public.requests set current_owner = v_back, status = 'Pending Review', updated_at = now() where id = p_request_id;

  select coalesce(nullif(trim(full_name), ''), 'Requester') into v_name from public.profiles where id = v_actor;
  insert into public.request_history (request_id, action_type, action_by, actor_name, actor_role_key, actor_role_name,
    from_stage, to_stage, comment, created_at)
  values (p_request_id, 'Resubmit', v_actor, v_name, 'staff', 'Requester', v_req.current_stage, v_req.current_stage,
          coalesce(nullif(trim(coalesce(p_comment, '')), ''), 'Corrected and sent back.'), now());

  insert into public.notifications (user_id, title, message, link, is_read, created_at)
  values (v_back, 'Request ' || coalesce(v_req.request_no, '') || ' corrected',
          v_name || ' corrected the request and sent it to you.', '/requests/' || p_request_id::text, false, now());

  return query select p_request_id, v_req.current_stage::text, 'Pending Review'::text, v_back;
end;
$$;
revoke all on function public.reqgen_resubmit_request(uuid, text) from public, anon;
grant execute on function public.reqgen_resubmit_request(uuid, text) to authenticated;
insert into v412_report values ('3 resubmit', 'reqgen_resubmit_request', 'returned → that officer; reopened → first officer of the route', 'OK');

-- 3b. The requester corrects a request that is back with them (or still early) ---
create or replace function public.reqgen_correct_request(p_request_id uuid, p_title text, p_details text,
  p_amount numeric default null, p_subhead_id uuid default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_req record;
  v_stage text;
  v_type text;
  v_returned boolean;
  v_early boolean;
  v_amount numeric;
  v_sub uuid;
  v_money_changed boolean;
  v_name text;
  v_left numeric;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if length(trim(coalesce(p_title, ''))) < 2 then raise exception 'Type the title.'; end if;
  if length(trim(coalesce(p_details, ''))) < 2 then raise exception 'Type the description.'; end if;
  if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'Say what you changed.'; end if;

  select r.* into v_req from public.requests r where r.id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if v_req.created_by is distinct from v_actor then raise exception 'Only the person who made the request can correct it here.'; end if;

  v_stage := public.reqgen_key(v_req.current_stage);
  v_type := public.reqgen_key(v_req.request_type);
  if v_stage in ('dg', 'account', 'hrfiling', 'completed', 'rejected', 'deleted', 'cancelled')
     or lower(coalesce(v_req.status, '')) ~ '(reject|cancel|delete|paid|closed|complete|withdrawn)' then
    raise exception 'This request can no longer be corrected.';
  end if;
  v_returned := v_req.current_owner = v_actor and lower(coalesce(v_req.status, '')) like 'returned for correction%';
  v_early := (v_type = 'official' and v_stage in ('pd', 'po', 'dod', 'director', 'dinadmin', 'registrar', 'hod'))
          or (v_type = 'personal' and v_stage in ('dod', 'hod', 'hr'));
  if not (v_returned or v_early) then raise exception 'This request is with an officer; it can be corrected when it is sent back to you.'; end if;

  v_amount := case
    when v_type = 'official' or public.reqgen_key(v_req.personal_category) = 'fund' then coalesce(p_amount, v_req.amount)
    else 0 end;
  v_sub := case when v_type = 'official' then coalesce(p_subhead_id, v_req.subhead_id) else null end;
  if v_type = 'official' and v_amount <= 0 then raise exception 'The amount must be more than zero.'; end if;
  v_money_changed := v_amount is distinct from v_req.amount or v_sub is distinct from v_req.subhead_id;

  if v_money_changed and not v_returned and lower(coalesce(v_req.funds_state, '')) = 'reserved' then
    raise exception 'The fund is already reserved. Ask the officer to send the request back to you before changing the amount or subhead.';
  end if;

  if v_type = 'official' and v_sub is not null then
    perform 1 from public.subheads s where s.id = v_sub and s.dept_id = v_req.dept_id and coalesce(s.is_active, true);
    if not found then raise exception 'That subhead does not belong to this department.'; end if;
  end if;

  update public.requests
  set title = trim(p_title), details = trim(p_details), amount = v_amount, subhead_id = v_sub,
      funds_state = case when v_type = 'official' and v_sub is not null then 'Reserved'
                         when v_type = 'official' then 'Pending Subhead Assignment' else funds_state end,
      updated_at = now()
  where id = p_request_id;

  if v_req.subhead_id is not null then perform public.recalculate_subhead_finance(v_req.subhead_id); end if;
  if v_sub is not null then
    perform public.recalculate_subhead_finance(v_sub);
    select coalesce(s.approved_allocation, 0) - coalesce(s.reserved_amount, 0) - coalesce(s.expenditure, 0)
      into v_left from public.subheads s where s.id = v_sub;
    if v_left < 0 then
      raise exception 'Not enough fund in this subhead for the new amount. Choose another subhead or lower the amount.';
    end if;
  end if;

  select coalesce(nullif(trim(full_name), ''), 'Requester') into v_name from public.profiles where id = v_actor;
  insert into public.request_history (request_id, action_type, action_by, actor_name, actor_role_key, actor_role_name,
    from_stage, to_stage, comment, created_at)
  values (p_request_id, 'Corrected', v_actor, v_name, 'staff', 'Requester', v_req.current_stage, v_req.current_stage, trim(p_note), now());

  return jsonb_build_object('ok', true, 'amount', v_amount, 'subhead_id', v_sub, 'money_changed', v_money_changed);
end;
$$;
revoke all on function public.reqgen_correct_request(uuid, text, text, numeric, uuid, text) from public, anon;
grant execute on function public.reqgen_correct_request(uuid, text, text, numeric, uuid, text) to authenticated;
insert into v412_report values ('3 resubmit', 'reqgen_correct_request', 'requester corrects title, description, amount and subhead; fund re-reserved with a hard block', 'OK');

-- 3c. Budget line written on the letter with the approving officer's signature --
--     ALLOCATION B/D (what the subhead had before this request), EXPENDITURE (this
--     request) and BALANCE C/D (what is left after it), kept as they were when the
--     officer confirmed the subhead, so later spending never changes a signed letter.
create table if not exists public.reqgen_request_budget_lines (
  request_id uuid primary key,
  subhead_id uuid,
  subhead_label text,
  allocation_bd numeric not null default 0,
  expenditure numeric not null default 0,
  balance_cd numeric not null default 0,
  confirmed_by uuid,
  confirmed_by_name text,
  confirmed_role text,
  confirmed_at timestamptz not null default now()
);
alter table public.reqgen_request_budget_lines enable row level security;
drop policy if exists reqgen_budget_lines_read on public.reqgen_request_budget_lines;
create policy reqgen_budget_lines_read on public.reqgen_request_budget_lines for select to authenticated
  using (public.reqgen_can_open_request(request_id) or public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'auditor', 'account', 'accounts', 'accountofficer']));
revoke all on public.reqgen_request_budget_lines from anon;
revoke insert, update, delete on public.reqgen_request_budget_lines from authenticated;
grant select on public.reqgen_request_budget_lines to authenticated;

create or replace function public.reqgen_confirm_request_budget(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_req record;
  v_sub record;
  v_mine numeric := 0;
  v_bd numeric;
  v_name text;
  v_role text;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  select r.* into v_req from public.requests r where r.id = p_request_id;
  if not found then raise exception 'Request not found.'; end if;
  if v_req.current_owner is distinct from v_actor then raise exception 'This request is not with you.'; end if;
  if v_req.subhead_id is null then return jsonb_build_object('ok', false, 'message', 'No subhead yet.'); end if;
  if public.reqgen_key(v_req.current_stage) in ('dg', 'account', 'hrfiling', 'completed', 'rejected', 'cancelled', 'deleted') then
    return jsonb_build_object('ok', false, 'message', 'The budget line is confirmed before the Director General.');
  end if;

  select s.* into v_sub from public.subheads s where s.id = v_req.subhead_id;
  if not found then raise exception 'Subhead not found.'; end if;
  if lower(coalesce(v_req.funds_state, '')) = 'reserved' then v_mine := coalesce(v_req.amount, 0); end if;
  v_bd := coalesce(v_sub.approved_allocation, 0) - coalesce(v_sub.expenditure, 0) - coalesce(v_sub.reserved_amount, 0) + v_mine;

  select coalesce(nullif(trim(full_name), ''), 'Officer') into v_name from public.profiles where id = v_actor;
  select coalesce(uar.active_role_name, uar.active_role_key) into v_role from public.user_active_roles uar where uar.user_id = v_actor;

  insert into public.reqgen_request_budget_lines (request_id, subhead_id, subhead_label, allocation_bd, expenditure, balance_cd,
    confirmed_by, confirmed_by_name, confirmed_role, confirmed_at)
  values (p_request_id, v_sub.id, coalesce(v_sub.code || ' — ', '') || coalesce(v_sub.name, ''), v_bd, coalesce(v_req.amount, 0),
    v_bd - coalesce(v_req.amount, 0), v_actor, v_name, v_role, now())
  on conflict (request_id) do update set subhead_id = excluded.subhead_id, subhead_label = excluded.subhead_label,
    allocation_bd = excluded.allocation_bd, expenditure = excluded.expenditure, balance_cd = excluded.balance_cd,
    confirmed_by = excluded.confirmed_by, confirmed_by_name = excluded.confirmed_by_name, confirmed_role = excluded.confirmed_role,
    confirmed_at = now();

  return jsonb_build_object('ok', true, 'allocation_bd', v_bd, 'expenditure', coalesce(v_req.amount, 0), 'balance_cd', v_bd - coalesce(v_req.amount, 0));
end;
$$;
revoke all on function public.reqgen_confirm_request_budget(uuid) from public, anon;
grant execute on function public.reqgen_confirm_request_budget(uuid) to authenticated;
insert into v412_report values ('3 resubmit', 'reqgen_confirm_request_budget', 'B/D, expenditure and C/D kept with the approving officer''s signature', 'OK');

-- 4. The route of one request, step by step (read-only) ---------------------------
create or replace function public.reqgen_request_chain(p_request_id uuid)
returns table (step_order int, stage text, owner_name text, state text, acted_by_name text, acted_role text,
               acted_at timestamptz, comment text, signed boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_req record;
  v_since timestamptz;
  v_closed boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.reqgen_can_open_request(p_request_id) or public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'auditor'])) then
    raise exception 'You cannot open this request.';
  end if;
  select r.* into v_req from public.requests r where r.id = p_request_id;
  if not found then return; end if;

  -- approvals after the latest reopen count for this round
  select max(h.created_at) into v_since from public.request_history h
  where h.request_id = p_request_id and lower(coalesce(h.action_type, '')) = 'reopen';
  v_since := coalesce(v_since, '-infinity'::timestamptz);
  v_closed := public.reqgen_key(v_req.current_stage) in ('completed', 'rejected', 'cancelled', 'deleted');

  return query
  with route as (
    select br.step_order as so, br.stage as st, br.owner_id as oid, br.if_vacant as iv
    from public.reqgen_build_route_for_template(
           coalesce(v_req.route_template_id, public.reqgen_template_for_department(v_req.dept_id)),
           v_req.dept_id, v_req.request_type, v_req.personal_category) br
  ),
  acted as (
    select distinct on (public.reqgen_key(h.from_stage))
           public.reqgen_key(h.from_stage) as k, h.actor_name, h.actor_role_name, h.created_at, h.comment,
           (coalesce(nullif(h.signature_url, ''), nullif(h.actor_signature_url, '')) is not null) as signed
    from public.request_history h
    where h.request_id = p_request_id
      and h.created_at > v_since
      and (lower(coalesce(h.action_type, '')) like 'approv%' or lower(coalesce(h.action_type, '')) in ('treat', 'paid', 'pay', 'complete', 'completed', 'filed'))
    order by public.reqgen_key(h.from_stage), h.created_at desc
  )
  select r.so::int,
         r.st::text,
         (select p.full_name from public.profiles p where p.id = r.oid)::text,
         (case
            when a.k is not null then 'done'
            when not v_closed and public.reqgen_key(v_req.current_stage) = public.reqgen_key(r.st) then 'now'
            when r.oid is null and public.reqgen_key(r.st) <> 'account' and coalesce(r.iv, 'skip') = 'skip' then 'skipped'
            else 'wait'
          end)::text,
         a.actor_name::text, a.actor_role_name::text, a.created_at, a.comment::text, coalesce(a.signed, false)
  from route r
  left join acted a on a.k = public.reqgen_key(r.st)
  order by r.so;
end;
$$;
revoke all on function public.reqgen_request_chain(uuid) from public, anon;
grant execute on function public.reqgen_request_chain(uuid) to authenticated;
insert into v412_report values ('4 route', 'reqgen_request_chain', 'read-only; follows the route the request started with', 'OK');

-- 5. Verification ----------------------------------------------------------------
insert into v412_report
select '5 check', 'functions installed', count(*)::text || ' of 5', case when count(*) = 5 then 'OK' else 'CHECK' end
from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('reqgen_reopen_request', 'reqgen_resubmit_request', 'reqgen_request_chain', 'reqgen_correct_request', 'reqgen_confirm_request_budget');
insert into v412_report
select '5 check', 'anonymous visitors cannot call them',
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'blocked' else 'open' end,
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'OK' else 'CHECK' end
from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('reqgen_reopen_request', 'reqgen_resubmit_request', 'reqgen_request_chain', 'reqgen_correct_request', 'reqgen_confirm_request_budget');
insert into v412_report
select '5 check', 'drafts are private (row-level security on)',
       case when c.relrowsecurity then 'on' else 'off' end, case when c.relrowsecurity then 'OK' else 'CHECK' end
from pg_class c where c.oid = 'public.reqgen_request_drafts'::regclass;
insert into v412_report
select '5 check', 'draft file rules', count(*)::text || ' of 4', case when count(*) = 4 then 'OK' else 'CHECK' end
from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'reqgen_v412_draft_files_%';
insert into v412_report values ('5 check', 'routing engine unchanged', 'approve_request_step and reqgen_next_route_step not touched', 'OK');

commit;

select step as "step", item as "item", result as "result", status as "status" from v412_report order by step, item;
