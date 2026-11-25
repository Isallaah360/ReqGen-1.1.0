-- =====================================================================================================
-- ReqGen 6.1.0 (app 4.1.0, Step 2): requests under HR's rule
--
--   1. Once a request is sent, ONLY the sender may change it, and ONLY while it is back with them
--      (sent back for correction). Officers, the Super Admin and the Auditor never change what
--      a request says: they comment.
--   2. Anyone who can open a request may add a comment. The comment stays on the request and
--      prints with it. The sender and whoever holds it are told in the app.
--   3. An official request with an amount must carry the subhead the sender chose, when the
--      department has subheads. Staff see subhead NAMES only, never a balance; the live check
--      answers "available" or "not enough" (reqgen_subhead_live_check, unchanged).
--
-- Run in the Supabase SQL editor. Safe to run twice. Nothing is dropped and no data is changed.
-- =====================================================================================================

create temp table if not exists v610_report (step text, item text, result text, status text);
delete from v610_report;

-- 1. The guard: what a request SAYS can change only by its sender, only when it is back with them --
create or replace function public.reqgen_hr_rule_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_back boolean;
  v_draft boolean;
begin
  -- maintenance in the SQL editor (no signed-in person) is not blocked
  if v_actor is null then return new; end if;

  v_draft := lower(coalesce(old.status, '')) like 'draft%';
  v_back := old.current_owner = old.created_by
            and lower(coalesce(old.status, '')) like 'returned for correction%';

  if (new.title is distinct from old.title)
     or (new.details is distinct from old.details)
     or (new.amount is distinct from old.amount)
     or (new.request_type is distinct from old.request_type)
     or (new.personal_category is distinct from old.personal_category)
     or (new.dept_id is distinct from old.dept_id) then
    if v_actor is distinct from old.created_by then
      raise exception 'REQGEN_HR_RULE: Only the person who sent this request can change it. Add a comment instead, or send it back to them.';
    end if;
    if not (v_draft or v_back) then
      raise exception 'REQGEN_HR_RULE: This request is with an officer. You can change it when it is sent back to you.';
    end if;
  end if;

  -- the subhead: the sender (when it is back with them), or an officer giving a subhead to an older
  -- request that never had one (the subhead authority rule still decides which officer may)
  if new.subhead_id is distinct from old.subhead_id and old.subhead_id is not null then
    if v_actor is distinct from old.created_by or not (v_draft or v_back) then
      raise exception 'REQGEN_HR_RULE: Only the sender can change the subhead, when the request is back with them.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reqgen_hr_rule_guard on public.requests;
create trigger reqgen_hr_rule_guard before update on public.requests
  for each row execute function public.reqgen_hr_rule_guard();
insert into v610_report values ('1 rule', 'reqgen_hr_rule_guard', 'only the sender changes a request, only when it is back with them', 'OK');

-- 2. Correcting: the sender, only when the request was sent back to them ------------------------------
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
  v_type text;
  v_amount numeric;
  v_sub uuid;
  v_money_changed boolean;
  v_name text;
  v_left numeric;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if length(trim(coalesce(p_title, ''))) < 2 then raise exception 'REQGEN_INPUT: Type the title.'; end if;
  if length(trim(coalesce(p_details, ''))) < 2 then raise exception 'REQGEN_INPUT: Type the description.'; end if;
  if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'REQGEN_INPUT: Say what you changed.'; end if;

  select r.* into v_req from public.requests r where r.id = p_request_id for update;
  if not found then raise exception 'REQGEN_INPUT: Request not found.'; end if;
  if v_req.created_by is distinct from v_actor then
    raise exception 'REQGEN_HR_RULE: Only the person who sent this request can change it.';
  end if;
  if not (v_req.current_owner = v_actor and lower(coalesce(v_req.status, '')) like 'returned for correction%') then
    raise exception 'REQGEN_HR_RULE: This request is with an officer. You can change it when it is sent back to you.';
  end if;

  v_type := public.reqgen_key(v_req.request_type);
  v_amount := case
    when v_type = 'official' or public.reqgen_key(v_req.personal_category) = 'fund' then coalesce(p_amount, v_req.amount)
    else 0 end;
  v_sub := case when v_type = 'official' then coalesce(p_subhead_id, v_req.subhead_id) else null end;
  if v_type = 'official' and v_amount <= 0 then raise exception 'REQGEN_INPUT: The amount must be more than zero.'; end if;
  v_money_changed := v_amount is distinct from v_req.amount or v_sub is distinct from v_req.subhead_id;

  if v_type = 'official' and v_sub is not null then
    perform 1 from public.subheads s where s.id = v_sub and s.dept_id = v_req.dept_id and coalesce(s.is_active, true);
    if not found then raise exception 'REQGEN_INPUT: That subhead does not belong to this department.'; end if;
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
      raise exception 'REQGEN_NOT_ENOUGH: Not enough fund in this subhead for the new amount. Choose another subhead or lower the amount.';
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
insert into v610_report values ('2 correct', 'reqgen_correct_request', 'sender only, only when sent back', 'OK');

-- 3. Comments: anyone who can open the request ----------------------------------------------------------
create or replace function public.reqgen_request_comment(p_request_id uuid, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_req record;
  v_name text;
  v_role_key text;
  v_role_name text;
  v_to uuid;
  v_recent int;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if length(trim(coalesce(p_comment, ''))) < 2 then raise exception 'REQGEN_INPUT: Write the comment.'; end if;
  if length(p_comment) > 1000 then raise exception 'REQGEN_INPUT: The comment is too long (1,000 letters at most).'; end if;

  select r.id, r.request_no, r.created_by, r.current_owner, r.current_stage into v_req from public.requests r where r.id = p_request_id;
  if not found then raise exception 'REQGEN_INPUT: Request not found.'; end if;
  if not (public.reqgen_can_open_request(p_request_id) or public.reqgen_is_direct_receiver(p_request_id)) then
    raise exception 'REQGEN_NOT_YOURS: This request is not open to you.';
  end if;

  select count(*) into v_recent from public.request_history h
  where h.request_id = p_request_id and h.action_by = v_actor and h.action_type = 'Comment' and h.created_at > now() - interval '1 minute';
  if v_recent >= 5 then raise exception 'REQGEN_SLOW_DOWN: Too many comments at once. Wait a minute.'; end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Staff') into v_name from public.profiles p where p.id = v_actor;
  begin
    select coalesce(a.active_role_key, 'staff'), coalesce(a.active_role_name, 'Staff') into v_role_key, v_role_name
    from public.get_my_active_role() a limit 1;
  exception when others then v_role_key := 'staff'; v_role_name := 'Staff';
  end;
  if v_actor = v_req.created_by then v_role_name := 'Sender'; end if;

  insert into public.request_history (request_id, action_type, action_by, actor_name, actor_role_key, actor_role_name,
    from_stage, to_stage, comment, created_at)
  values (p_request_id, 'Comment', v_actor, v_name, coalesce(v_role_key, 'staff'), coalesce(v_role_name, 'Staff'),
    v_req.current_stage, v_req.current_stage, trim(p_comment), now());

  foreach v_to in array array[v_req.created_by, v_req.current_owner] loop
    if v_to is not null and v_to is distinct from v_actor then
      insert into public.notifications (user_id, title, message, link, is_read, created_at)
      values (v_to, 'New comment on ' || coalesce(v_req.request_no, 'a request'),
              v_name || ' commented on ' || coalesce(v_req.request_no, 'the request') || '.',
              '/requests/' || p_request_id::text, false, now());
    end if;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.reqgen_request_comment(uuid, text) from public, anon;
grant execute on function public.reqgen_request_comment(uuid, text) to authenticated;
insert into v610_report values ('3 comments', 'reqgen_request_comment', 'anyone who can open the request; sender and holder told', 'OK');

-- 4. The sender chooses the subhead on an official request with an amount ---------------------------------
create or replace function public.reqgen_require_sender_subhead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if new.direct_to is null
     and public.reqgen_key(new.request_type) = 'official'
     and coalesce(new.amount, 0) > 0
     and new.subhead_id is null
     and new.dept_id is not null
     and exists (select 1 from public.subheads s where s.dept_id = new.dept_id and coalesce(s.is_active, true)) then
    raise exception 'REQGEN_SUBHEAD: Choose the budget subhead for this request.';
  end if;
  return new;
end;
$$;
drop trigger if exists reqgen_require_sender_subhead on public.requests;
create trigger reqgen_require_sender_subhead before insert on public.requests
  for each row execute function public.reqgen_require_sender_subhead();
insert into v610_report values ('4 subhead', 'reqgen_require_sender_subhead', 'official requests carry the sender''s subhead', 'OK');

-- 5. Report ----------------------------------------------------------------------------------------------
insert into v610_report
select '5 check', 'installed', count(*)::text || ' of 4',
  case when count(*) = 4 then 'OK' else 'CHECK' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('reqgen_hr_rule_guard', 'reqgen_correct_request', 'reqgen_request_comment', 'reqgen_require_sender_subhead');

select * from v610_report order by step;
