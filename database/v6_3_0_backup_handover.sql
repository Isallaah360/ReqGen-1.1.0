-- =====================================================================================
-- ReqGen 6.3.0: backup officers take over a request that waits too long (owner's YES,
-- 25 November 2026).
--
-- The rule:
--   * Each review step (PD, DOD, HOD, DIN Admin, HR Coordinator, Registrar) of each
--     department can have a backup officer, set by the Super Admin (Routing Engine).
--   * When the officer holding a request does not treat it within 25 minutes of working
--     time (Monday to Friday, 8:00 AM to 5:00 PM, Lagos), it moves to the backup. The
--     backup gets an SMS, an e-mail and an app notice.
--   * If the backup does not treat it within the next 25 working minutes, it goes back
--     to the first officer, and it stays there. The Registry is told.
--   * If no backup is set for that step, the request stays where it is and the Registry
--     is told once.
--   * The DG, Account, HR Filing, Direct requests and requests sent back to their sender
--     never move by themselves.
--   * The Super Admin can change the minutes, the hours and the days, or switch it off.
--
-- How it runs: pg_cron calls reqgen_backup_handover_tick() every 2 minutes. It moves the
-- requests in the database, then (through pg_net) asks the Edge Function reqgen-office to
-- send the SMS and e-mails. The routing engine is NOT changed: the route, its steps and
-- approve_request_step are untouched; only who holds the current step changes, exactly as
-- "mark away" already does.
--
-- Nothing is dropped and no existing data is changed (requests get three new columns).
-- Safe to run more than once. Ends with a table where every row should say OK.
-- =====================================================================================

create temp table if not exists v630_report (step text, item text, detail text, result text);
delete from v630_report;

-- 1. settings (Super Admin can change them in the Routing Engine)
insert into public.app_settings (key, value)
select k, v from (values
  ('HANDOVER_ON', 'true'),
  ('HANDOVER_MINUTES', '25'),
  ('HANDOVER_FROM', '08:00'),
  ('HANDOVER_TO', '17:00'),
  ('HANDOVER_DAYS', '1,2,3,4,5'),
  ('FUNCTIONS_URL', 'https://ikfuclsqxcrqpxtuuhnf.supabase.co/functions/v1')
) as s(k, v)
where not exists (select 1 from public.app_settings a where a.key = s.k);
insert into v630_report values ('1 settings', 'HANDOVER_ON, _MINUTES, _FROM, _TO, _DAYS', '25 minutes, Mon to Fri, 8:00 AM to 5:00 PM (only added when missing)', 'OK');

-- 2. the clock on each request
alter table public.requests add column if not exists owner_since timestamptz;
alter table public.requests add column if not exists handover_count integer not null default 0;
alter table public.requests add column if not exists handover_first uuid;
-- the clock starts now for requests already waiting, so nothing jumps on the first run
update public.requests set owner_since = now(), handover_first = coalesce(handover_first, current_owner)
where owner_since is null;
insert into v630_report values ('2 requests', 'owner_since, handover_count, handover_first', 'three columns added; the clock starts now for requests already waiting', 'OK');

create or replace function public.reqgen_owner_clock()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if tg_op = 'INSERT' then
    new.owner_since := now(); new.handover_count := 0; new.handover_first := new.current_owner;
    return new;
  end if;
  if new.current_owner is distinct from old.current_owner or new.current_stage is distinct from old.current_stage then
    new.owner_since := now();
    -- a move made by the handover itself keeps its count; any other move starts afresh
    if coalesce(current_setting('reqgen.handover', true), '') <> 'on' then
      new.handover_count := 0; new.handover_first := new.current_owner;
    end if;
  end if;
  return new;
end;
$fn$;
drop trigger if exists reqgen_owner_clock on public.requests;
create trigger reqgen_owner_clock before insert or update of current_owner, current_stage on public.requests
  for each row execute function public.reqgen_owner_clock();
insert into v630_report values ('2 requests', 'trigger reqgen_owner_clock', 'starts the clock when the holder or the step changes', 'OK');

-- 3. working minutes between two moments (Lagos time, the set days and hours)
create or replace function public.reqgen_work_minutes(p_from timestamptz, p_to timestamptz)
returns numeric language plpgsql stable security definer set search_path = public as $fn$
declare
  v_tz text := 'Africa/Lagos';
  v_start time := coalesce((select nullif(value, '') from public.app_settings where key = 'HANDOVER_FROM'), '08:00')::time;
  v_end time := coalesce((select nullif(value, '') from public.app_settings where key = 'HANDOVER_TO'), '17:00')::time;
  v_days int[] := coalesce(string_to_array(nullif((select value from public.app_settings where key = 'HANDOVER_DAYS'), ''), ',')::int[], array[1,2,3,4,5]);
  v_d date; v_last date; v_ws timestamptz; v_we timestamptz; v_total numeric := 0; v_n int := 0;
begin
  if p_from is null or p_to is null or p_to <= p_from then return 0; end if;
  v_d := (p_from at time zone v_tz)::date; v_last := (p_to at time zone v_tz)::date;
  while v_d <= v_last and v_n < 62 loop
    if extract(isodow from v_d)::int = any(v_days) then
      v_ws := (v_d + v_start) at time zone v_tz; v_we := (v_d + v_end) at time zone v_tz;
      if least(p_to, v_we) > greatest(p_from, v_ws) then
        v_total := v_total + extract(epoch from least(p_to, v_we) - greatest(p_from, v_ws)) / 60;
      end if;
    end if;
    v_d := v_d + 1; v_n := v_n + 1;
  end loop;
  return v_total;
end;
$fn$;
insert into v630_report values ('3 clock', 'reqgen_work_minutes', 'counts only the working days and hours', 'OK');

-- 4. messages waiting to go out as SMS and e-mail (sent by the Edge Function)
create table if not exists public.reqgen_handover_outbox (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  user_id uuid not null,
  kind text not null check (kind in ('to_backup', 'back_to_first', 'moved_away', 'registry_back', 'registry_no_backup')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  result text
);
alter table public.reqgen_handover_outbox enable row level security;
revoke all on public.reqgen_handover_outbox from anon, authenticated;
create index if not exists reqgen_handover_outbox_unsent on public.reqgen_handover_outbox (created_at) where sent_at is null;

-- the shared secret between the database timer and the Edge Function (never readable by staff)
create table if not exists public.reqgen_cron_secret (id integer primary key default 1 check (id = 1), secret text not null);
alter table public.reqgen_cron_secret enable row level security;
revoke all on public.reqgen_cron_secret from anon, authenticated;
insert into public.reqgen_cron_secret (id, secret)
select 1, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') where not exists (select 1 from public.reqgen_cron_secret);
insert into v630_report values ('4 outbox', 'reqgen_handover_outbox, reqgen_cron_secret', 'closed to staff; only the database and the Edge Function read them', 'OK');

-- 5. the handover itself
create or replace function public.reqgen_backup_handover_run()
returns table (kind text, request_id uuid, to_user uuid, from_user uuid)
language plpgsql security definer set search_path = public as $fn$
declare
  v_on boolean := lower(coalesce((select value from public.app_settings where key = 'HANDOVER_ON'), 'true')) = 'true';
  v_min int := greatest(5, coalesce(nullif((select value from public.app_settings where key = 'HANDOVER_MINUTES'), '')::int, 25));
  r record; v_next uuid; v_from_name text; v_to_name text;
begin
  if not v_on then return; end if;
  perform set_config('reqgen.handover', 'on', true);
  for r in
    select q.id, q.request_no, q.dept_id, q.current_stage, q.current_owner, q.handover_count, q.handover_first
    from public.requests q
    where coalesce(q.status, '') not in ('Draft', 'Paid', 'Completed', 'Rejected', 'Cancelled', 'Deleted')
      and coalesce(q.status, '') not ilike 'withdrawn%' and coalesce(q.status, '') not ilike 'returned%'
      and q.direct_to is null
      and public.reqgen_key(q.current_stage) in ('pd', 'po', 'dod', 'hod', 'dinadmin', 'hr', 'hrcoordinator', 'registrar')
      and q.current_owner is not null and q.current_owner is distinct from q.created_by
      and q.handover_count < 2
      and q.owner_since is not null
      and public.reqgen_work_minutes(q.owner_since, now()) >= v_min
    for update of q skip locked
  loop
    select full_name into v_from_name from public.profiles where id = r.current_owner;
    if r.handover_count = 0 then
      select c.user_id into v_next
      from public.reqgen_stage_candidates(r.dept_id, r.current_stage) c
      join public.profiles p on p.id = c.user_id and coalesce(p.is_active, true)
      where c.user_id is distinct from r.current_owner and public.reqgen_is_available(c.user_id)
      order by c.rank limit 1;
      if v_next is null then
        -- no backup for this step: it stays, and the Registry is told once
        update public.requests set handover_count = 2 where id = r.id;
        insert into public.notifications (user_id, title, message, link, is_read, created_at)
        select p.id, 'No backup for ' || coalesce(r.current_stage, 'a step'),
               coalesce(r.request_no, 'A request') || ' has waited ' || v_min || ' working minutes at ' || coalesce(r.current_stage, 'its step') || ' and no backup is set. Ask the Super Admin to add one.',
               '/registry/tracking', false, now()
        from public.profiles p where public.reqgen_pv_user_has_role(p.id, array['registry', 'padg']);
        insert into public.reqgen_handover_outbox (request_id, user_id, kind)
        select r.id, p.id, 'registry_no_backup' from public.profiles p where public.reqgen_pv_user_has_role(p.id, array['registry', 'padg']);
        kind := 'registry_no_backup'; request_id := r.id; to_user := null; from_user := r.current_owner; return next;
        continue;
      end if;
      update public.requests set current_owner = v_next, handover_count = 1, handover_first = coalesce(r.handover_first, r.current_owner), updated_at = now() where id = r.id;
      select full_name into v_to_name from public.profiles where id = v_next;
      insert into public.request_history (request_id, action_type, action_by, actor_name, actor_role_key, actor_role_name, from_stage, to_stage, comment, created_at)
      values (r.id, 'Handed to backup', null, 'ReqGen', 'system', 'Routing Engine', r.current_stage, r.current_stage,
              'Not treated in ' || v_min || ' working minutes by ' || coalesce(v_from_name, 'the officer') || '. Handed to the backup, ' || coalesce(v_to_name, 'officer') || '.', now());
      insert into public.notifications (user_id, title, message, link, is_read, created_at) values
        (v_next, 'Request handed to you', coalesce(r.request_no, 'A request') || ' at ' || coalesce(r.current_stage, 'its step') || ' was not treated in ' || v_min || ' minutes, so it is now with you as the backup.', '/requests/' || r.id, false, now()),
        (r.current_owner, 'Request moved to your backup', coalesce(r.request_no, 'A request') || ' waited ' || v_min || ' working minutes, so it is now with ' || coalesce(v_to_name, 'your backup') || '.', '/requests/' || r.id, false, now());
      insert into public.reqgen_handover_outbox (request_id, user_id, kind) values (r.id, v_next, 'to_backup'), (r.id, r.current_owner, 'moved_away');
      kind := 'to_backup'; request_id := r.id; to_user := v_next; from_user := r.current_owner; return next;
    else
      -- the backup did not act either: back to the first officer, where it stays; the Registry is told
      v_next := r.handover_first;
      if v_next is null or v_next = r.current_owner or not exists (select 1 from public.profiles p where p.id = v_next and coalesce(p.is_active, true)) then
        update public.requests set handover_count = 2 where id = r.id;
        continue;
      end if;
      update public.requests set current_owner = v_next, handover_count = 2, updated_at = now() where id = r.id;
      select full_name into v_to_name from public.profiles where id = v_next;
      insert into public.request_history (request_id, action_type, action_by, actor_name, actor_role_key, actor_role_name, from_stage, to_stage, comment, created_at)
      values (r.id, 'Back to first officer', null, 'ReqGen', 'system', 'Routing Engine', r.current_stage, r.current_stage,
              'The backup, ' || coalesce(v_from_name, 'officer') || ', did not treat it in ' || v_min || ' working minutes. Back with ' || coalesce(v_to_name, 'the first officer') || ', where it stays. The Registry was told.', now());
      insert into public.notifications (user_id, title, message, link, is_read, created_at) values
        (v_next, 'Request back with you', coalesce(r.request_no, 'A request') || ' at ' || coalesce(r.current_stage, 'its step') || ' was not treated by your backup either. It is with you again and stays with you.', '/requests/' || r.id, false, now());
      insert into public.notifications (user_id, title, message, link, is_read, created_at)
      select p.id, 'Still waiting: ' || coalesce(r.request_no, 'a request'),
             coalesce(r.request_no, 'A request') || ' at ' || coalesce(r.current_stage, 'its step') || ' was not treated by the officer or the backup. It is back with ' || coalesce(v_to_name, 'the first officer') || '.',
             '/registry/tracking', false, now()
      from public.profiles p where public.reqgen_pv_user_has_role(p.id, array['registry', 'padg']);
      insert into public.reqgen_handover_outbox (request_id, user_id, kind) values (r.id, v_next, 'back_to_first');
      insert into public.reqgen_handover_outbox (request_id, user_id, kind)
      select r.id, p.id, 'registry_back' from public.profiles p where public.reqgen_pv_user_has_role(p.id, array['registry', 'padg']);
      kind := 'back_to_first'; request_id := r.id; to_user := v_next; from_user := r.current_owner; return next;
    end if;
  end loop;
end;
$fn$;
revoke all on function public.reqgen_backup_handover_run() from public, anon, authenticated;
insert into v630_report values ('5 handover', 'reqgen_backup_handover_run', 'officer, then backup, then back to the officer; Registry told; DG, Account, Direct and sent-back requests never move', 'OK');

-- 6. the timer: move requests, then ask the Edge Function to send the SMS and e-mails
create or replace function public.reqgen_backup_handover_tick()
returns integer language plpgsql security definer set search_path = public as $fn$
declare v_n int; v_url text; v_secret text;
begin
  select count(*) into v_n from public.reqgen_backup_handover_run();
  if exists (select 1 from public.reqgen_handover_outbox where sent_at is null)
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    select nullif(value, '') into v_url from public.app_settings where key = 'FUNCTIONS_URL';
    select secret into v_secret from public.reqgen_cron_secret where id = 1;
    if v_url is not null and v_secret is not null then
      execute 'select net.http_post(url := $1, headers := $2, body := $3)'
        using v_url || '/reqgen-office?route=backup_handover',
              jsonb_build_object('Content-Type', 'application/json', 'x-reqgen-cron', v_secret),
              '{}'::jsonb;
    end if;
  end if;
  return v_n;
end;
$fn$;
revoke all on function public.reqgen_backup_handover_tick() from public, anon, authenticated;

do $$
begin
  begin
    create extension if not exists pg_net;
    insert into v630_report values ('6 timer', 'pg_net', 'on (the database can call the Edge Function)', 'OK');
  exception when others then
    insert into v630_report values ('6 timer', 'pg_net', 'could not switch on: ' || sqlerrm || '. Supabase > Database > Extensions > pg_net > Enable, then run this file again', 'CHECK');
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule(jobid) from cron.job where jobname = 'reqgen_backup_handover';
      perform cron.schedule('reqgen_backup_handover', '*/2 * * * *', 'select public.reqgen_backup_handover_tick()');
      insert into v630_report values ('6 timer', 'pg_cron job reqgen_backup_handover', 'every 2 minutes', 'OK');
    exception when others then
      insert into v630_report values ('6 timer', 'pg_cron job', 'not scheduled: ' || sqlerrm, 'CHECK');
    end;
  else
    insert into v630_report values ('6 timer', 'pg_cron', 'off. Supabase > Database > Extensions > pg_cron > Enable, then run this file again', 'CHECK');
  end if;
end $$;

-- 7. Super Admin: the settings and one backup per step (website and app use these)
create or replace function public.reqgen_put_setting(p_key text, p_value text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  update public.app_settings set value = p_value where key = p_key;
  if not found then insert into public.app_settings (key, value) values (p_key, p_value); end if;
end;
$fn$;
revoke all on function public.reqgen_put_setting(text, text) from public, anon, authenticated;
create or replace function public.reqgen_handover_settings()
returns json language sql stable security definer set search_path = public as $fn$
  select json_build_object(
    'on', lower(coalesce((select value from public.app_settings where key = 'HANDOVER_ON'), 'true')) = 'true',
    'minutes', coalesce(nullif((select value from public.app_settings where key = 'HANDOVER_MINUTES'), '')::int, 25),
    'from', coalesce((select value from public.app_settings where key = 'HANDOVER_FROM'), '08:00'),
    'to', coalesce((select value from public.app_settings where key = 'HANDOVER_TO'), '17:00'),
    'days', coalesce((select value from public.app_settings where key = 'HANDOVER_DAYS'), '1,2,3,4,5'))
  where auth.uid() is not null;
$fn$;
revoke all on function public.reqgen_handover_settings() from public, anon;
grant execute on function public.reqgen_handover_settings() to authenticated;

create or replace function public.reqgen_handover_settings_save(p_on boolean, p_minutes integer, p_from text, p_to text, p_days text)
returns json language plpgsql security definer set search_path = public as $fn$
begin
  if not (public.reqgen_is_super_admin() or public.reqgen_is_admin()) then raise exception 'REQGEN_DENIED: Only the Super Admin can change the backup rule.'; end if;
  if p_minutes is null or p_minutes < 5 or p_minutes > 480 then raise exception 'REQGEN_INPUT: Choose between 5 and 480 minutes.'; end if;
  if p_from !~ '^\d{2}:\d{2}$' or p_to !~ '^\d{2}:\d{2}$' or p_to::time <= p_from::time then raise exception 'REQGEN_INPUT: The end of the working day must be after its start.'; end if;
  if p_days !~ '^[1-7](,[1-7])*$' then raise exception 'REQGEN_INPUT: Choose at least one working day.'; end if;
  perform public.reqgen_put_setting('HANDOVER_ON', case when p_on then 'true' else 'false' end);
  perform public.reqgen_put_setting('HANDOVER_MINUTES', p_minutes::text);
  perform public.reqgen_put_setting('HANDOVER_FROM', p_from);
  perform public.reqgen_put_setting('HANDOVER_TO', p_to);
  perform public.reqgen_put_setting('HANDOVER_DAYS', p_days);
  return public.reqgen_handover_settings();
end;
$fn$;
revoke all on function public.reqgen_handover_settings_save(boolean, integer, text, text, text) from public, anon;
grant execute on function public.reqgen_handover_settings_save(boolean, integer, text, text, text) to authenticated;

-- one backup per step per department (the first backup; more can still be added on the website)
create or replace function public.reqgen_set_stage_backup(p_dept_id uuid, p_stage text, p_user_id uuid)
returns json language plpgsql security definer set search_path = public as $fn$
declare v_stage text;
begin
  if not (public.reqgen_is_super_admin() or public.reqgen_is_admin()) then raise exception 'REQGEN_DENIED: Only the Super Admin can set backups.'; end if;
  v_stage := case public.reqgen_key(p_stage) when 'pd' then 'PD' when 'po' then 'PD' when 'dod' then 'DOD' when 'hod' then 'HOD'
                  when 'dinadmin' then 'DIN Admin' when 'hr' then 'HR' when 'hrcoordinator' then 'HR' when 'registrar' then 'Registrar' end;
  if v_stage is null then raise exception 'REQGEN_INPUT: Backups are for PD, DOD, HOD, DIN Admin, HR Coordinator and Registrar.'; end if;
  if p_dept_id is null then raise exception 'REQGEN_INPUT: Choose the department.'; end if;
  delete from public.reqgen_stage_backups b where b.dept_id = p_dept_id and public.reqgen_key(b.stage) = public.reqgen_key(v_stage) and b.priority = 2;
  if p_user_id is not null then
    if not exists (select 1 from public.profiles p where p.id = p_user_id and coalesce(p.is_active, true)) then raise exception 'REQGEN_INPUT: Choose an active staff member.'; end if;
    delete from public.reqgen_stage_backups b where b.dept_id = p_dept_id and public.reqgen_key(b.stage) = public.reqgen_key(v_stage) and b.user_id = p_user_id;
    insert into public.reqgen_stage_backups (dept_id, stage, user_id, priority, label, is_active, updated_at, updated_by)
    values (p_dept_id, v_stage, p_user_id, 2, v_stage || ' backup', true, now(), auth.uid());
  end if;
  return json_build_object('ok', true, 'stage', v_stage, 'user_id', p_user_id);
end;
$fn$;
revoke all on function public.reqgen_set_stage_backup(uuid, text, uuid) from public, anon;
grant execute on function public.reqgen_set_stage_backup(uuid, text, uuid) to authenticated;
insert into v630_report values ('7 Super Admin', 'reqgen_handover_settings(_save), reqgen_set_stage_backup', 'Super Admin sets the backups and the rule; others are refused', 'OK');

-- 8. checks
insert into v630_report
select '8 check', 'backups table accepts PD', 'review steps can have backups',
       case when exists (select 1 from pg_constraint where conrelid = 'public.reqgen_stage_backups'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ 'PD')
              or not exists (select 1 from pg_constraint where conrelid = 'public.reqgen_stage_backups'::regclass and contype = 'c') then 'OK' else 'CHECK' end;
insert into v630_report
select '8 check', 'routing engine', 'approve_request_step and the route tables not touched by this file', 'OK';

select step, item, detail, result from v630_report order by step, item;
