-- =====================================================================================================
-- ReqGen v4.7.0: one code for every send and every decision, and Direct to many people
-- Run once in Supabase > SQL Editor (safe to run twice). Nothing is dropped.
--
--  1. Action codes (server checked)
--     reqgen_action_passes: written only by the website server after a correct SMS or e-mail code.
--     A request may be SENT (a new row in requests) or MOVED ON by the person holding it (the holder
--     changes) only with a fresh pass from that person. One pass covers one action: it can be used for
--     90 seconds after its first use and expires 10 minutes after the code was checked.
--     Changes made by the server, the nightly jobs or administrators who do not hold the request are not
--     affected. The routing engine and every approval rule are unchanged.
--  2. Direct to many people
--     reqgen_direct_recipients: one row per person a Direct request was sent to. Each answers on their own
--     (approve, reply, decline, forward). No HOD, HR, DG or Account step. To be paid, a receiver forwards
--     it to the Director General, and the existing Direct DG and Account steps take over.
--  3. Registry tracking shows a Direct request's real route (the sender and the people chosen).
-- =====================================================================================================

create temporary table if not exists v470_report (part text, item text, result text, status text) on commit preserve rows;
truncate v470_report;

-- 1. Action codes -------------------------------------------------------------------------------------
create table if not exists public.reqgen_action_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null default 'action',
  channel text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  used_at timestamptz
);
create index if not exists reqgen_action_passes_user_idx on public.reqgen_action_passes (user_id, created_at desc);
alter table public.reqgen_action_passes enable row level security;
revoke all on public.reqgen_action_passes from anon, authenticated;
insert into v470_report values ('1 codes', 'reqgen_action_passes', 'table ready (server only, no screen can write it)', 'OK');

create or replace function public.reqgen_require_pass()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_id uuid;
begin
  if me is null then return; end if;   -- the server and nightly jobs
  select id into v_id from public.reqgen_action_passes
   where user_id = me and expires_at > now()
     and (used_at is null or used_at > now() - interval '90 seconds')
   order by created_at desc limit 1
   for update;
  if v_id is null then
    raise exception 'REQGEN_CODE_REQUIRED: Confirm with the code sent to your phone or e-mail first.'
      using errcode = 'P0001';
  end if;
  update public.reqgen_action_passes set used_at = coalesce(used_at, now()) where id = v_id;
end;
$$;
revoke all on function public.reqgen_require_pass() from public, anon, authenticated;

create or replace function public.reqgen_guard_request_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    perform public.reqgen_require_pass();
  elsif old.current_owner = auth.uid() and new.current_owner is distinct from old.current_owner then
    perform public.reqgen_require_pass();
  end if;
  return new;
end;
$$;
drop trigger if exists reqgen_guard_request_action on public.requests;
create trigger reqgen_guard_request_action before insert or update of current_owner on public.requests
  for each row execute function public.reqgen_guard_request_action();
insert into v470_report values ('1 codes', 'trigger on requests', 'sending, and every move by the person holding it, needs a fresh code', 'OK');

-- 2. Direct to many people -----------------------------------------------------------------------------
create table if not exists public.reqgen_direct_recipients (
  request_id uuid not null references public.requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'Waiting' check (status in ('Waiting', 'Approved', 'Declined', 'Replied', 'Forwarded')),
  comment text,
  signature_url text,
  added_by uuid references public.profiles(id) on delete set null,
  read_at timestamptz,
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
create index if not exists reqgen_direct_recipients_user_idx on public.reqgen_direct_recipients (user_id, status);
alter table public.reqgen_direct_recipients enable row level security;
drop policy if exists reqgen_direct_recipients_read on public.reqgen_direct_recipients;
create policy reqgen_direct_recipients_read on public.reqgen_direct_recipients for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.requests r where r.id = request_id and r.created_by = auth.uid()));
revoke insert, update, delete on public.reqgen_direct_recipients from anon, authenticated;
grant select on public.reqgen_direct_recipients to authenticated;
insert into v470_report values ('2 direct', 'reqgen_direct_recipients', 'one row per person; only the sender and that person can read it', 'OK');

-- 2a. Send to one or many
create or replace function public.reqgen_direct_send(p_title text, p_details text, p_amount numeric, p_to uuid[], p_request_no text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  w public.profiles%rowtype;
  v_id uuid;
  v_no text;
  v_amt numeric := coalesce(p_amount, 0);
  v_to uuid[];
  v_first uuid;
  v_bad int;
  v_n int;
  v_names text;
begin
  if me is null then raise exception 'Please sign in again.'; end if;
  select * into w from public.profiles where id = me;
  if coalesce(w.is_active, true) = false then raise exception 'Your account is not active.'; end if;
  if nullif(trim(coalesce(w.signature_url, '')), '') is null then raise exception 'Add your signature in My Account first.'; end if;
  if length(trim(coalesce(p_title, ''))) < 3 then raise exception 'Write the title.'; end if;
  if length(trim(coalesce(p_details, ''))) < 3 then raise exception 'Write the message.'; end if;
  if v_amt < 0 then raise exception 'The amount cannot be negative.'; end if;
  select array_agg(distinct x) into v_to from unnest(coalesce(p_to, '{}'::uuid[])) x where x is not null and x <> me;
  v_n := coalesce(array_length(v_to, 1), 0);
  if v_n = 0 then raise exception 'Choose at least one person.'; end if;
  if v_n > 50 then raise exception 'Choose 50 people or fewer.'; end if;
  select count(*) into v_bad from unnest(v_to) x left join public.profiles p on p.id = x
   where p.id is null or coalesce(p.is_active, true) = false or coalesce(to_jsonb(p)->>'system_account', '') <> '';
  if v_bad > 0 then raise exception 'Choose active staff members only.'; end if;
  v_first := v_to[1];
  v_no := coalesce(nullif(trim(coalesce(p_request_no, '')), ''), 'REQ-' || to_char(now(), 'YYYYMM') || '-' || right(extract(epoch from clock_timestamp())::bigint::text, 6));
  select string_agg(p.full_name, ', ' order by p.full_name) into v_names from public.profiles p where p.id = any (v_to);

  insert into public.requests (request_no, title, details, amount, dept_id, subhead_id, status, current_stage, current_owner,
                               request_type, personal_category, created_by, requester_name, requester_signature_url,
                               direct_to, created_at, updated_at)
  values (v_no, trim(p_title), trim(p_details), v_amt, w.dept_id, null, 'Sent directly', 'Submitted', null,
          'Personal', case when v_amt > 0 then 'Fund' else 'Others' end, me, w.full_name, w.signature_url,
          v_first, now(), now())
  returning id into v_id;

  insert into public.reqgen_direct_recipients (request_id, user_id, added_by) select v_id, x, me from unnest(v_to) x on conflict do nothing;
  perform public.reqgen_direct_log(v_id, 'Submit', null, 'Submitted', 'Direct request to ' || v_names || '.', w.signature_url, 'Staff / Requester');
  perform public.reqgen_direct_notify(x, v_id, 'New request awaits your answer', v_no || ': a direct request from ' || coalesce(w.full_name, 'staff') || '.') from unnest(v_to) x;
  return jsonb_build_object('ok', true, 'request_id', v_id, 'request_no', v_no, 'first_stage', 'Submitted', 'count', v_n, 'to', v_names);
end;
$$;
revoke all on function public.reqgen_direct_send(text, text, numeric, uuid[], text) from public, anon;
grant execute on function public.reqgen_direct_send(text, text, numeric, uuid[], text) to authenticated;

-- 2b. A receiver answers on their own: approve, reply, decline; or forwards (to the DG to be paid, or to someone else)
create or replace function public.reqgen_direct_answer(p_request_id uuid, p_action text, p_comment text default null, p_to uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  r public.requests%rowtype;
  rc public.reqgen_direct_recipients%rowtype;
  mep public.profiles%rowtype;
  t public.profiles%rowtype;
  v_act text := lower(trim(coalesce(p_action, '')));
  v_note text := nullif(trim(coalesce(p_comment, '')), '');
  v_sig text;
  v_status text;
  v_dg uuid;
  v_left int;
begin
  if me is null then raise exception 'Please sign in again.'; end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  select * into rc from public.reqgen_direct_recipients where request_id = p_request_id and user_id = me for update;
  if not found then raise exception 'This request was not sent to you.'; end if;
  if rc.status <> 'Waiting' then raise exception 'You have already answered this request.'; end if;
  if upper(regexp_replace(coalesce(r.current_stage, ''), '[\s_-]+', '', 'g')) in ('REJECTED', 'CANCELLED', 'DELETED') then raise exception 'This request is closed.'; end if;
  select * into mep from public.profiles where id = me;
  v_sig := nullif(trim(coalesce(mep.signature_url, '')), '');
  if v_sig is null then raise exception 'Add your signature in My Account first.'; end if;
  if v_act in ('decline', 'reply') and v_note is null then raise exception 'Write your answer.'; end if;

  perform public.reqgen_require_pass();

  if v_act = 'approve' then v_status := 'Approved';
  elsif v_act = 'decline' then v_status := 'Declined';
  elsif v_act = 'reply' then v_status := 'Replied';
  elsif v_act = 'forward_dg' then
    if exists (select 1 from public.reqgen_direct_recipients x where x.request_id = r.id and x.status = 'Forwarded' and x.user_id <> me)
       or upper(regexp_replace(coalesce(r.current_stage, ''), '[\s_-]+', '', 'g')) <> 'SUBMITTED' then
      raise exception 'Someone has already forwarded this request to the Director General.';
    end if;
    select p.id into v_dg from public.profiles p
     where coalesce(p.is_active, true) and coalesce(to_jsonb(p)->>'system_account', '') = '' and public.reqgen_pv_user_has_role(p.id, array['dg'])
     order by (select coalesce(bool_or(pr.is_primary), false) from public.profile_roles pr where pr.profile_id = p.id and public.pv_role_key(pr.role_key) = 'dg') desc, p.full_name
     limit 1;
    if v_dg is null then raise exception 'No active Director General is set up in ReqGen.'; end if;
    if v_dg = me then raise exception 'You are the Director General: approve it instead.'; end if;
    if coalesce(r.amount, 0) > 0 and (p_to is null or not public.reqgen_pv_user_has_role(p_to, array['accountofficer', 'account'])) then
      raise exception 'Choose the Account Officer who will pay it.';
    end if;
    update public.reqgen_direct_recipients set status = 'Forwarded', comment = v_note, signature_url = v_sig, acted_at = now() where request_id = r.id and user_id = me;
    update public.requests set current_stage = 'DG', status = 'Pending DG Approval', current_owner = v_dg, direct_to = me, direct_forwarded_by = me,
           assigned_account_officer_id = case when coalesce(r.amount, 0) > 0 then p_to else null end,
           assigned_account_officer_name = case when coalesce(r.amount, 0) > 0 then (select full_name from public.profiles where id = p_to) else null end,
           updated_at = now()
     where id = r.id;
    perform public.reqgen_direct_log(r.id, 'Approved', 'Submitted', 'DG', coalesce(v_note, 'Forwarded to the Director General.'), v_sig, 'Receiver');
    perform public.reqgen_direct_notify(v_dg, r.id, 'New request awaits your approval', r.request_no || ': forwarded to you by ' || coalesce(mep.full_name, 'an officer') || '.');
    perform public.reqgen_direct_notify(r.created_by, r.id, 'Request forwarded', r.request_no || ' was forwarded to the Director General by ' || coalesce(mep.full_name, 'an officer') || '.');
    return jsonb_build_object('ok', true, 'status', 'Forwarded', 'new_owner', v_dg, 'new_stage', 'DG');
  elsif v_act = 'forward' then
    select * into t from public.profiles where id = p_to;
    if not found or coalesce(t.is_active, true) = false or coalesce(to_jsonb(t)->>'system_account', '') <> '' or p_to in (me, r.created_by) then
      raise exception 'Choose another active staff member.';
    end if;
    update public.reqgen_direct_recipients set status = 'Forwarded', comment = coalesce(v_note, 'Forwarded to ' || t.full_name || '.'), signature_url = v_sig, acted_at = now() where request_id = r.id and user_id = me;
    insert into public.reqgen_direct_recipients (request_id, user_id, added_by) values (r.id, p_to, me) on conflict (request_id, user_id) do update set status = 'Waiting', acted_at = null;
    perform public.reqgen_direct_log(r.id, 'Forwarded', 'Submitted', 'Submitted', 'Forwarded to ' || t.full_name || coalesce('. ' || v_note, '.'), v_sig, 'Receiver');
    perform public.reqgen_direct_notify(p_to, r.id, 'New request awaits your answer', r.request_no || ': forwarded to you by ' || coalesce(mep.full_name, 'an officer') || '.');
    return jsonb_build_object('ok', true, 'status', 'Forwarded', 'new_owner', p_to);
  else
    raise exception 'That answer is not possible.';
  end if;

  update public.reqgen_direct_recipients set status = v_status, comment = v_note, signature_url = v_sig, acted_at = now() where request_id = r.id and user_id = me;
  perform public.reqgen_direct_log(r.id, v_status, 'Submitted', 'Submitted', coalesce(v_note, v_status || '.'), v_sig, 'Receiver');
  perform public.reqgen_direct_notify(r.created_by, r.id, 'Answer to your request', r.request_no || ': ' || v_status || ' by ' || coalesce(mep.full_name, 'an officer') || coalesce(': ' || v_note, '.'));
  select count(*) into v_left from public.reqgen_direct_recipients where request_id = r.id and status = 'Waiting';
  if v_left = 0 and upper(regexp_replace(coalesce(r.current_stage, ''), '[\s_-]+', '', 'g')) = 'SUBMITTED' and r.current_owner is null then
    update public.requests set status = 'Answered', updated_at = now() where id = r.id;
  end if;
  return jsonb_build_object('ok', true, 'status', v_status, 'waiting', v_left);
end;
$$;
revoke all on function public.reqgen_direct_answer(uuid, text, text, uuid) from public, anon;
grant execute on function public.reqgen_direct_answer(uuid, text, text, uuid) to authenticated;

-- 2c. Mark as read (no code needed)
create or replace function public.reqgen_direct_read(p_request_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.reqgen_direct_recipients set read_at = coalesce(read_at, now()) where request_id = p_request_id and user_id = auth.uid();
$$;
revoke all on function public.reqgen_direct_read(uuid) from public, anon;
grant execute on function public.reqgen_direct_read(uuid) to authenticated;

-- 2d. The people and their answers (the sender, the people chosen, and the DG's office see it)
create or replace function public.reqgen_direct_people_of(p_request_id uuid)
returns table (user_id uuid, full_name text, position_names text, status text, comment text, read_at timestamptz, acted_at timestamptz, added_by_name text)
language sql
stable
security definer
set search_path = public
as $$
  select x.user_id, p.full_name::text,
         coalesce((select string_agg(distinct coalesce(nullif(pr.role_name, ''), pr.role_key), ', ')
                     from public.profile_roles pr where pr.profile_id = p.id and coalesce(pr.is_active, true)
                      and public.pv_role_key(pr.role_key) not in ('staff', 'admin', 'superadmin')), '')::text,
         x.status, x.comment, x.read_at, x.acted_at, (select a.full_name from public.profiles a where a.id = x.added_by)::text
    from public.reqgen_direct_recipients x
    join public.profiles p on p.id = x.user_id
    join public.requests r on r.id = x.request_id
   where x.request_id = p_request_id
     and (r.created_by = auth.uid() or r.current_owner = auth.uid()
          or exists (select 1 from public.reqgen_direct_recipients y where y.request_id = x.request_id and y.user_id = auth.uid()))
   order by x.created_at, p.full_name;
$$;
revoke all on function public.reqgen_direct_people_of(uuid) from public, anon;
grant execute on function public.reqgen_direct_people_of(uuid) to authenticated;

-- 2e. Direct requests waiting for my answer (for Approvals, Home and the bell)
create or replace function public.reqgen_direct_waiting()
returns table (id uuid, request_no text, title text, amount numeric, requester_name text, dept_id uuid, created_at timestamptz, read_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.request_no, r.title, r.amount, r.requester_name, r.dept_id, r.created_at, x.read_at
    from public.reqgen_direct_recipients x join public.requests r on r.id = x.request_id
   where x.user_id = auth.uid() and x.status = 'Waiting'
     and upper(regexp_replace(coalesce(r.current_stage, ''), '[\s_-]+', '', 'g')) not in ('REJECTED', 'CANCELLED', 'DELETED')
   order by r.created_at;
$$;
revoke all on function public.reqgen_direct_waiting() from public, anon;
grant execute on function public.reqgen_direct_waiting() to authenticated;

-- 2f. The receivers may open the request itself (read only), like the person holding it
do $p$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'requests' and c.relrowsecurity) then
    drop policy if exists reqgen_direct_receivers_read on public.requests;
    create policy reqgen_direct_receivers_read on public.requests for select to authenticated
      using (exists (select 1 from public.reqgen_direct_recipients x where x.request_id = requests.id and x.user_id = auth.uid()));
    insert into v470_report values ('2 direct', 'requests read policy', 'the people chosen can open it (read only)', 'OK');
  else
    insert into v470_report values ('2 direct', 'requests read policy', 'row security is off on requests here: nothing to add', 'OK');
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'request_history' and c.relrowsecurity) then
    drop policy if exists reqgen_direct_receivers_history on public.request_history;
    create policy reqgen_direct_receivers_history on public.request_history for select to authenticated
      using (exists (select 1 from public.reqgen_direct_recipients x where x.request_id = request_history.request_id and x.user_id = auth.uid()));
  end if;
end $p$;
insert into v470_report values ('2 direct', 'reqgen_direct_send / _answer / _read / _people_of / _waiting', 'send to many, each answers, forward to the DG to be paid', 'OK');

-- 3. Registry tracking: a Direct request shows the sender and the people chosen -------------------------
do $r$
declare v_def text;
begin
  if to_regprocedure('public.reqgen_registry_moves(uuid)') is null then
    insert into v470_report values ('3 tracking', 'reqgen_registry_moves', 'not installed here: nothing to change', 'OK');
    return;
  end if;
  if to_regprocedure('public.reqgen_registry_moves_routed(uuid)') is null then
    v_def := pg_get_functiondef('public.reqgen_registry_moves(uuid)'::regprocedure);
    v_def := replace(v_def, 'public.reqgen_registry_moves(', 'public.reqgen_registry_moves_routed(');
    execute v_def;
    execute 'revoke all on function public.reqgen_registry_moves_routed(uuid) from public, anon';
    execute 'grant execute on function public.reqgen_registry_moves_routed(uuid) to authenticated';
  end if;
  insert into v470_report values ('3 tracking', 'reqgen_registry_moves_routed', 'the routed view is kept unchanged under this name', 'OK');
end $r$;

create or replace function public.reqgen_registry_moves(p_request_id uuid)
returns table(step_order int, stage text, person text, state text, at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_req record; v_many boolean;
begin
  select r.* into v_req from public.requests r where r.id = p_request_id;
  if not found then return; end if;
  v_many := exists (select 1 from public.reqgen_direct_recipients x where x.request_id = p_request_id);
  if v_req.direct_to is null and not v_many then
    return query select * from public.reqgen_registry_moves_routed(p_request_id);
    return;
  end if;
  if not (public.reqgen_is_registry() or public.reqgen_report_tier() in ('all', 'finance')) then raise exception 'Not allowed.'; end if;
  return query select 0, 'Sent by'::text, coalesce(v_req.requester_name, 'Requester')::text, 'done'::text, v_req.created_at;
  if v_many then
    return query
    select (row_number() over (order by x.created_at, p.full_name))::int, 'Direct'::text, p.full_name::text,
           (case x.status when 'Waiting' then 'now' else 'done' end)::text, coalesce(x.acted_at, x.created_at)
      from public.reqgen_direct_recipients x join public.profiles p on p.id = x.user_id
     where x.request_id = p_request_id;
  else
    return query select 1, 'Direct'::text, coalesce((select p.full_name from public.profiles p where p.id = v_req.direct_to), '')::text,
           (case when v_req.current_owner = v_req.direct_to then 'now' else 'done' end)::text, v_req.updated_at;
  end if;
  if upper(regexp_replace(coalesce(v_req.current_stage, ''), '[\s_-]+', '', 'g')) in ('DG', 'ACCOUNT', 'COMPLETED') and v_req.direct_forwarded_by is not null then
    return query select 100, 'Director General'::text, coalesce(v_req.dg_name, '')::text,
           (case when upper(regexp_replace(coalesce(v_req.current_stage, ''), '[\s_-]+', '', 'g')) = 'DG' then 'now' else 'done' end)::text, null::timestamptz;
    if coalesce(v_req.amount, 0) > 0 then
      return query select 101, 'Account'::text, coalesce(v_req.assigned_account_officer_name, '')::text,
             (case upper(regexp_replace(coalesce(v_req.current_stage, ''), '[\s_-]+', '', 'g')) when 'ACCOUNT' then 'now' when 'COMPLETED' then 'done' else 'next' end)::text, null::timestamptz;
    end if;
  end if;
end;
$$;
revoke all on function public.reqgen_registry_moves(uuid) from public, anon;
grant execute on function public.reqgen_registry_moves(uuid) to authenticated;
insert into v470_report values ('3 tracking', 'reqgen_registry_moves', 'Direct requests show the sender and the people chosen, never a route', 'OK');

select part, item, result, status from v470_report order by part, item;
select 'ReqGen v4.7.0 upgrade done' as result;
