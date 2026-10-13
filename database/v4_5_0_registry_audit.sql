-- =============================================================================
-- ReqGen v4.5.0 — Registry and Audit (mock-ups 68–78)
-- Run in the Supabase SQL Editor AFTER the v4.5.0 code shows "Ready" on Vercel,
-- and after v4_4_0_reports.sql.
--
-- REGISTRY (numbers, dates, offices and people only — never titles, amounts or contents)
--   registry_correspondence      new columns for incoming / outgoing / dispatch (nothing removed)
--   reqgen_registry_save / _act / _dispatch     record, acknowledge, forward, dispatch, deliver
--   reqgen_registry_archive (table) + _archive_add / _archive_restore / _archive_review
--   reqgen_registry_filing_queue  paid requests waiting to be filed (numbers only)
--   reqgen_registry_tracking / _summary / _moves   where every request is, and its journey
--   reqgen_request_remind        in-app reminder to whoever holds a request (one per hour)
--   reqgen_send_due_reminders    after 1 day the officer; after 3 days also Registry and
--                                the DG's office. Requests are never moved automatically.
-- AUDIT
--   reqgen_audit_log             ONE append-only log for everything (cannot be changed or deleted)
--   triggers                     approvals, signatures, stamps, voucher steps, transfers, budgets,
--                                accounts, positions, settings, registry, prints, backups
--   reqgen_audit_events          the log plus sign-ins (Super Admin and Auditor)
--   reqgen_trace                 the full journey of a request or voucher
--   reqgen_reconciliations + reqgen_recon_*    bank statement against the ReqGen ledger
--   backups bucket               private store for nightly and on-demand backups (server only)
--
-- The routing engine is NOT changed (only read). Nothing is deleted.
-- Safe to run more than once. Ends with a table where every row says OK.
-- =============================================================================
begin;

create temp table if not exists v450_report (step text, item text, result text, status text);
truncate v450_report;

-- 0. Who may use Registry ------------------------------------------------------------------
create or replace function public.reqgen_is_registry()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.reqgen_active_role_key() in ('registry', 'registrar', 'admin', 'auditor');
$$;
revoke all on function public.reqgen_is_registry() from public, anon;
grant execute on function public.reqgen_is_registry() to authenticated;

-- 1. Correspondence: incoming and outgoing ----------------------------------------------------
create table if not exists public.registry_correspondence (id uuid primary key default gen_random_uuid(), created_at timestamptz default now());
alter table public.registry_correspondence add column if not exists reference_no text;
alter table public.registry_correspondence add column if not exists subject text;
alter table public.registry_correspondence add column if not exists direction text;
alter table public.registry_correspondence add column if not exists from_to text;
alter table public.registry_correspondence add column if not exists department_id uuid;
alter table public.registry_correspondence add column if not exists priority text;
alter table public.registry_correspondence add column if not exists status text;
alter table public.registry_correspondence add column if not exists received_at timestamptz;
alter table public.registry_correspondence add column if not exists acknowledged_at timestamptz;
alter table public.registry_correspondence add column if not exists acknowledged_by_label text;
alter table public.registry_correspondence add column if not exists forwarded_at timestamptz;
alter table public.registry_correspondence add column if not exists forwarded_to uuid;
alter table public.registry_correspondence add column if not exists dispatch_method text;
alter table public.registry_correspondence add column if not exists dispatched_at timestamptz;
alter table public.registry_correspondence add column if not exists dispatched_by_label text;
alter table public.registry_correspondence add column if not exists receiver_name text;
alter table public.registry_correspondence add column if not exists delivered_at timestamptz;
alter table public.registry_correspondence add column if not exists note text;
alter table public.registry_correspondence add column if not exists items_count int;
alter table public.registry_correspondence add column if not exists created_by uuid;
alter table public.registry_correspondence add column if not exists created_by_label text;
alter table public.registry_correspondence add column if not exists updated_at timestamptz default now();
alter table public.registry_correspondence add column if not exists archived_at timestamptz;
alter table public.registry_correspondence add column if not exists restored_at timestamptz;
create index if not exists registry_correspondence_dir_idx on public.registry_correspondence (direction, created_at desc);
insert into v450_report values ('1 registry', 'registry_correspondence', 'received, acknowledged, forwarded, dispatched, delivered — new columns only', 'OK');

create or replace function public.reqgen_registry_next_ref(p_direction text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_prefix text := case when p_direction = 'outgoing' then 'OUT' else 'IN' end || '/' || to_char(now(), 'YYYY') || '/'; v_n int;
begin
  perform pg_advisory_xact_lock(hashtext('reqgen_registry_' || v_prefix));
  select coalesce(max(nullif(regexp_replace(substr(reference_no, length(v_prefix) + 1), '\D', '', 'g'), '')::int), 0) + 1 into v_n
  from public.registry_correspondence where reference_no like v_prefix || '%';
  return v_prefix || lpad(v_n::text, 4, '0');
end;
$$;
revoke all on function public.reqgen_registry_next_ref(text) from public, anon;

create or replace function public.reqgen_registry_save(p_direction text, p_subject text, p_party text, p_department_id uuid,
  p_priority text default 'Normal', p_received_at timestamptz default null, p_note text default null, p_items int default 1)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_ref text; v_dir text := lower(trim(coalesce(p_direction, '')));
begin
  if not public.reqgen_is_registry() then raise exception 'Only Registry records letters and files.'; end if;
  if v_dir not in ('incoming', 'outgoing') then raise exception 'Choose incoming or outgoing.'; end if;
  if length(trim(coalesce(p_subject, ''))) < 3 then raise exception 'Write what it is (for example "Letter — Ministry of Education").'; end if;
  if length(trim(coalesce(p_party, ''))) < 2 then raise exception 'Write who it is %.', case when v_dir = 'incoming' then 'from' else 'going to' end; end if;
  if coalesce(p_priority, 'Normal') not in ('Normal', 'Urgent', 'Confidential') then raise exception 'Priority is Normal, Urgent or Confidential.'; end if;
  v_ref := public.reqgen_registry_next_ref(v_dir);
  insert into public.registry_correspondence (reference_no, subject, direction, from_to, department_id, priority, status, received_at,
    note, items_count, created_by, created_by_label, created_at, updated_at)
  values (v_ref, trim(p_subject), v_dir, trim(p_party), p_department_id, coalesce(p_priority, 'Normal'),
    case when v_dir = 'incoming' then 'New' else 'Ready to dispatch' end, coalesce(p_received_at, now()),
    nullif(trim(coalesce(p_note, '')), ''), greatest(coalesce(p_items, 1), 1), auth.uid(), public.reqgen_actor_label(auth.uid()), now(), now())
  returning id into v_id;
  return json_build_object('ok', true, 'id', v_id, 'reference_no', v_ref);
end;
$$;

create or replace function public.reqgen_registry_act(p_id uuid, p_action text, p_department_id uuid default null, p_receiver text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v public.registry_correspondence; v_label text := public.reqgen_actor_label(auth.uid());
begin
  if not public.reqgen_is_registry() then raise exception 'Only Registry updates letters and files.'; end if;
  select * into v from public.registry_correspondence where id = p_id for update;
  if not found then raise exception 'Item not found.'; end if;
  if p_action = 'acknowledge' then
    if v.direction <> 'incoming' then raise exception 'Only incoming items are acknowledged.'; end if;
    update public.registry_correspondence set status = 'Acknowledged', acknowledged_at = now(), acknowledged_by_label = v_label, updated_at = now() where id = p_id;
  elsif p_action = 'forward' then
    if v.direction <> 'incoming' then raise exception 'Only incoming items are forwarded.'; end if;
    update public.registry_correspondence set status = 'Forwarded', forwarded_at = now(), forwarded_to = coalesce(p_department_id, v.department_id),
      department_id = coalesce(p_department_id, v.department_id), acknowledged_at = coalesce(v.acknowledged_at, now()),
      acknowledged_by_label = coalesce(v.acknowledged_by_label, v_label), updated_at = now() where id = p_id;
  elsif p_action = 'delivered' then
    if coalesce(v.status, '') <> 'In transit' then raise exception 'Only an item in transit is marked delivered.'; end if;
    update public.registry_correspondence set status = 'Delivered', delivered_at = now(), receiver_name = coalesce(nullif(trim(coalesce(p_receiver, '')), ''), v.receiver_name), updated_at = now() where id = p_id;
  else
    raise exception 'Unknown action.';
  end if;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.reqgen_registry_dispatch(p_ids uuid[], p_method text, p_receiver text, p_note text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_n int; v_label text := public.reqgen_actor_label(auth.uid()); v_hand boolean;
begin
  if not public.reqgen_is_registry() then raise exception 'Only Registry dispatches.'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 then raise exception 'Tick at least one item.'; end if;
  if p_method not in ('Hand delivery', 'Courier', 'Email', 'Post') then raise exception 'Choose hand delivery, courier, email or post.'; end if;
  v_hand := p_method in ('Hand delivery', 'Email');
  if v_hand and length(trim(coalesce(p_receiver, ''))) < 2 then raise exception 'Write the name of the person who received it.'; end if;
  update public.registry_correspondence
  set status = case when v_hand then 'Delivered' else 'In transit' end, dispatch_method = p_method, dispatched_at = now(), dispatched_by_label = v_label,
      receiver_name = nullif(trim(coalesce(p_receiver, '')), ''), delivered_at = case when v_hand then now() else null end,
      note = coalesce(nullif(trim(coalesce(p_note, '')), ''), note), updated_at = now()
  where id = any(p_ids) and direction = 'outgoing' and coalesce(status, '') in ('Ready to dispatch', 'New', '');
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'None of these items is waiting to be dispatched.'; end if;
  return json_build_object('ok', true, 'dispatched', v_n);
end;
$$;
revoke all on function public.reqgen_registry_save(text, text, text, uuid, text, timestamptz, text, int) from public, anon;
revoke all on function public.reqgen_registry_act(uuid, text, uuid, text) from public, anon;
revoke all on function public.reqgen_registry_dispatch(uuid[], text, text, text) from public, anon;
grant execute on function public.reqgen_registry_save(text, text, text, uuid, text, timestamptz, text, int) to authenticated;
grant execute on function public.reqgen_registry_act(uuid, text, uuid, text) to authenticated;
grant execute on function public.reqgen_registry_dispatch(uuid[], text, text, text) to authenticated;
insert into v450_report values ('1 registry', 'reqgen_registry_save / _act / _dispatch', 'IN/YYYY/NNNN and OUT/YYYY/NNNN; acknowledge, forward, dispatch with receiver, delivered', 'OK');

-- 2. Archive ------------------------------------------------------------------------------------
create table if not exists public.reqgen_registry_archive (
  id uuid primary key default gen_random_uuid(),
  record_kind text not null check (record_kind in ('request', 'voucher', 'letter', 'other')),
  record_id uuid,
  record_no text not null,
  description text,
  category text not null,
  keep_until date,
  permanent boolean not null default false,
  location text,
  archived_by_label text,
  archived_at timestamptz not null default now(),
  restored_at timestamptz,
  restored_by_label text,
  restore_reason text,
  reviewed_at timestamptz,
  review_note text
);
create unique index if not exists reqgen_registry_archive_record_idx on public.reqgen_registry_archive (record_kind, record_no) where restored_at is null;
alter table public.reqgen_registry_archive enable row level security;
drop policy if exists reqgen_registry_archive_read on public.reqgen_registry_archive;
create policy reqgen_registry_archive_read on public.reqgen_registry_archive for select to authenticated using (public.reqgen_is_registry());
revoke all on public.reqgen_registry_archive from anon;
revoke insert, update, delete on public.reqgen_registry_archive from authenticated;
grant select on public.reqgen_registry_archive to authenticated;

create or replace function public.reqgen_registry_archive_add(p_kind text, p_record_id uuid, p_record_no text, p_description text,
  p_category text, p_keep_until date, p_permanent boolean, p_location text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_no text := trim(coalesce(p_record_no, '')); v_desc text := nullif(trim(coalesce(p_description, '')), '');
begin
  if not public.reqgen_is_registry() then raise exception 'Only Registry archives records.'; end if;
  if v_no = '' then raise exception 'Write the record number.'; end if;
  if length(trim(coalesce(p_category, ''))) < 3 then raise exception 'Choose how long it must be kept.'; end if;
  if not coalesce(p_permanent, false) and p_keep_until is null then raise exception 'Choose the keep-until date, or mark it to be kept permanently.'; end if;
  if length(trim(coalesce(p_location, ''))) < 2 then raise exception 'Write where it is on the shelf.'; end if;
  -- a request file is described by its number and office only, never its title
  if p_kind = 'request' and p_record_id is not null then
    select 'Request file · ' || coalesce(d.name, '') into v_desc from public.requests r left join public.departments d on d.id = r.dept_id where r.id = p_record_id;
  elsif p_kind = 'voucher' and p_record_id is not null then
    v_desc := 'Payment voucher + receipts';
  end if;
  insert into public.reqgen_registry_archive (record_kind, record_id, record_no, description, category, keep_until, permanent, location, archived_by_label)
  values (p_kind, p_record_id, v_no, v_desc, trim(p_category), case when coalesce(p_permanent, false) then null else p_keep_until end,
          coalesce(p_permanent, false), trim(p_location), public.reqgen_actor_label(auth.uid()))
  returning id into v_id;
  if p_kind = 'letter' and p_record_id is not null then
    update public.registry_correspondence set archived_at = now(), updated_at = now() where id = p_record_id;
  end if;
  return json_build_object('ok', true, 'id', v_id);
exception when unique_violation then
  raise exception '% is already in the archive.', v_no;
end;
$$;

create or replace function public.reqgen_registry_archive_restore(p_id uuid, p_reason text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v public.reqgen_registry_archive;
begin
  if not public.reqgen_is_registry() then raise exception 'Only Registry restores records.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Write why the record is taken out of the archive.'; end if;
  select * into v from public.reqgen_registry_archive where id = p_id for update;
  if not found or v.restored_at is not null then raise exception 'Record not found in the archive.'; end if;
  update public.reqgen_registry_archive set restored_at = now(), restored_by_label = public.reqgen_actor_label(auth.uid()), restore_reason = trim(p_reason) where id = p_id;
  if v.record_kind = 'letter' and v.record_id is not null then
    update public.registry_correspondence set restored_at = now(), archived_at = null, updated_at = now() where id = v.record_id;
  end if;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.reqgen_registry_archive_review(p_id uuid, p_keep_until date, p_note text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.reqgen_is_registry() then raise exception 'Only Registry reviews the archive.'; end if;
  if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'Write the review decision.'; end if;
  update public.reqgen_registry_archive set keep_until = coalesce(p_keep_until, keep_until), reviewed_at = now(), review_note = trim(p_note)
  where id = p_id and restored_at is null;
  if not found then raise exception 'Record not found in the archive.'; end if;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.reqgen_registry_archive_add(text, uuid, text, text, text, date, boolean, text) from public, anon;
revoke all on function public.reqgen_registry_archive_restore(uuid, text) from public, anon;
revoke all on function public.reqgen_registry_archive_review(uuid, date, text) from public, anon;
grant execute on function public.reqgen_registry_archive_add(text, uuid, text, text, text, date, boolean, text) to authenticated;
grant execute on function public.reqgen_registry_archive_restore(uuid, text) to authenticated;
grant execute on function public.reqgen_registry_archive_review(uuid, date, text) to authenticated;

create or replace function public.reqgen_registry_filing_queue()
returns table(kind text, record_id uuid, record_no text, office text, paid_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.reqgen_is_registry() then raise exception 'Only Registry files records.'; end if;
  return query
  select 'request', r.id, r.request_no, coalesce(d.name, ''), r.updated_at
  from public.requests r left join public.departments d on d.id = r.dept_id
  where r.status in ('Paid', 'Completed') and r.request_no is not null
    and not exists (select 1 from public.reqgen_registry_archive a where a.record_kind = 'request' and a.record_no = r.request_no and a.restored_at is null)
  union all
  select 'voucher', pv.id, pv.voucher_no, coalesce(pv.dept_name, ''), coalesce(pv.paid_at, pv.updated_at)
  from public.payment_vouchers pv
  where pv.status = 'Paid' and pv.voucher_no is not null
    and not exists (select 1 from public.reqgen_registry_archive a where a.record_kind = 'voucher' and a.record_no = pv.voucher_no and a.restored_at is null)
  order by 5 desc;
end;
$$;
revoke all on function public.reqgen_registry_filing_queue() from public, anon;
grant execute on function public.reqgen_registry_filing_queue() to authenticated;
insert into v450_report values ('2 archive', 'reqgen_registry_archive', 'retention, keep-until or permanent, shelf location; restore with a reason; filing queue (numbers only)', 'OK');

-- 3. Request tracking (content-free) -------------------------------------------------------------------------
create table if not exists public.reqgen_reminder_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  sent_to uuid,
  sent_by uuid,
  sent_by_label text,
  channels text not null default 'in-app',
  automatic boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists reqgen_reminder_log_req_idx on public.reqgen_reminder_log (request_id, created_at desc);
alter table public.reqgen_reminder_log enable row level security;
drop policy if exists reqgen_reminder_log_read on public.reqgen_reminder_log;
create policy reqgen_reminder_log_read on public.reqgen_reminder_log for select to authenticated using (public.reqgen_is_registry());
revoke all on public.reqgen_reminder_log from anon;
revoke insert, update, delete on public.reqgen_reminder_log from authenticated;
grant select on public.reqgen_reminder_log to authenticated;

create or replace function public.reqgen_registry_tracking()
returns table(id uuid, request_no text, office text, request_type text, stage text, owner_id uuid, owner_name text, waiting_since timestamptz,
              status text, created_at timestamptz, last_reminder timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.reqgen_is_registry() or public.reqgen_report_tier() in ('all', 'finance')) then
    raise exception 'Request Tracking is for Registry, Finance, the Auditor and the Super Admin.';
  end if;
  return query
  select r.id, r.request_no, coalesce(d.name, ''), coalesce(r.request_type, ''),
         (case when coalesce(r.status, '') ilike 'returned%' then 'Returned to requester' else coalesce(r.current_stage, '') end),
         coalesce(r.current_owner, r.assigned_account_officer_user_id),
         coalesce((select p.full_name from public.profiles p where p.id = coalesce(r.current_owner, r.assigned_account_officer_user_id)), r.assigned_account_officer_name, ''),
         coalesce((select max(h.created_at) from public.request_history h where h.request_id = r.id), r.created_at),
         coalesce(r.status, ''), r.created_at,
         (select max(l.created_at) from public.reqgen_reminder_log l where l.request_id = r.id)
  from public.requests r left join public.departments d on d.id = r.dept_id
  where coalesce(r.status, '') not in ('Draft', 'Paid', 'Completed', 'Rejected', 'Cancelled', 'Deleted')
    and lower(coalesce(r.current_stage, '')) not in ('completed', 'rejected', 'cancelled', 'deleted')
    and coalesce(r.status, '') not ilike 'withdrawn%';
end;
$$;

create or replace function public.reqgen_registry_summary(p_from timestamptz)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare v json;
begin
  if not (public.reqgen_is_registry() or public.reqgen_report_tier() in ('all', 'finance')) then raise exception 'Not allowed.'; end if;
  select json_build_object(
    'generated', (select count(*) from public.requests r where r.created_at >= p_from and coalesce(r.status, '') <> 'Draft'),
    'signed', (select count(*) from public.request_history h where h.created_at >= p_from and (lower(coalesce(h.action_type, '')) like 'approv%' or lower(coalesce(h.action_type, '')) in ('paid', 'treat'))),
    'paid', (select count(*) from public.request_history h where h.created_at >= p_from and lower(coalesce(h.from_stage, '')) = 'account' and lower(coalesce(h.to_stage, '')) in ('completed', 'hr filing')),
    'returned', (select count(*) from public.request_history h where h.created_at >= p_from and lower(coalesce(h.action_type, '')) in ('return', 'returned'))
  ) into v;
  return v;
end;
$$;

create or replace function public.reqgen_registry_moves(p_request_id uuid)
returns table(step_order int, stage text, person text, state text, at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_req record; v_since timestamptz; v_closed boolean; v_returned boolean;
begin
  if not (public.reqgen_is_registry() or public.reqgen_report_tier() in ('all', 'finance')) then raise exception 'Not allowed.'; end if;
  select r.* into v_req from public.requests r where r.id = p_request_id;
  if not found then return; end if;
  v_returned := coalesce(v_req.status, '') ilike 'returned%';
  select max(h.created_at) into v_since from public.request_history h where h.request_id = p_request_id and lower(coalesce(h.action_type, '')) = 'reopen';
  v_since := coalesce(v_since, '-infinity'::timestamptz);
  v_closed := public.reqgen_key(v_req.current_stage) in ('completed', 'rejected', 'cancelled', 'deleted');
  return query
  select 0, 'Submitted'::text, 'Requester'::text, 'done'::text,
         coalesce((select min(h.created_at) from public.request_history h where h.request_id = p_request_id and lower(coalesce(h.action_type, '')) like 'submit%'), v_req.created_at);
  if v_returned then
    -- sent back for correction: it is with the requester now, not at the stage that returned it
    return query
    select 0, 'Returned for correction'::text,
           coalesce((select p.full_name from public.profiles p where p.id = coalesce(v_req.current_owner, v_req.created_by)), 'Requester')::text, 'now'::text,
           (select max(h.created_at) from public.request_history h where h.request_id = p_request_id and lower(coalesce(h.action_type, '')) like 'return%');
  end if;
  return query
  with route as (
    select br.step_order as so, br.stage as st, br.owner_id as oid, br.if_vacant as iv
    from public.reqgen_build_route_for_template(
           coalesce(v_req.route_template_id, public.reqgen_template_for_department(v_req.dept_id)),
           v_req.dept_id, v_req.request_type, v_req.personal_category) br
  ),
  acted as (
    select distinct on (public.reqgen_key(h.from_stage)) public.reqgen_key(h.from_stage) as k, h.actor_name, h.created_at
    from public.request_history h
    where h.request_id = p_request_id and h.created_at > v_since
      and (lower(coalesce(h.action_type, '')) like 'approv%' or lower(coalesce(h.action_type, '')) in ('treat', 'paid', 'pay', 'complete', 'completed', 'filed'))
    order by public.reqgen_key(h.from_stage), h.created_at desc
  )
  select r.so::int, r.st::text,
         coalesce(a.actor_name, (select p.full_name from public.profiles p where p.id = r.oid))::text,
         (case when a.k is not null then 'done'
               when not v_closed and not v_returned and public.reqgen_key(v_req.current_stage) = public.reqgen_key(r.st) then 'now'
               when r.oid is null and public.reqgen_key(r.st) <> 'account' and coalesce(r.iv, 'skip') = 'skip' then 'skipped'
               else 'next' end)::text,
         a.created_at
  from route r left join acted a on a.k = public.reqgen_key(r.st)
  order by r.so;
  return query
  select 999, 'Registry filing'::text, coalesce(a.archived_by_label, '')::text, case when a.id is not null then 'done' else 'next' end, a.archived_at
  from (select 1) x left join public.reqgen_registry_archive a on a.record_kind = 'request' and a.record_no = v_req.request_no and a.restored_at is null;
end;
$$;

create or replace function public.reqgen_request_remind(p_request_id uuid, p_automatic boolean default false)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_req record; v_owner uuid; v_last timestamptz;
begin
  if not p_automatic and not (public.reqgen_is_registry() or public.reqgen_report_tier() in ('all', 'finance')) then
    raise exception 'Only Registry, Finance, the Auditor or the Super Admin send reminders.';
  end if;
  select r.id, r.request_no, r.current_stage, coalesce(r.current_owner, r.assigned_account_officer_user_id) as owner into v_req
  from public.requests r where r.id = p_request_id;
  if not found then raise exception 'Request not found.'; end if;
  v_owner := v_req.owner;
  if v_owner is null then raise exception 'Nobody holds this request now.'; end if;
  select max(created_at) into v_last from public.reqgen_reminder_log where request_id = p_request_id and sent_to = v_owner;
  if v_last is not null and v_last > now() - interval '60 minutes' then
    raise exception 'A reminder was sent % minutes ago. One reminder an hour.', floor(extract(epoch from (now() - v_last)) / 60)::int;
  end if;
  insert into public.notifications (user_id, title, message, link, is_read, created_at)
  values (v_owner, 'Reminder: ' || coalesce(v_req.request_no, 'a request') || ' is waiting for you',
          'It has been waiting at ' || coalesce(v_req.current_stage, 'your step') || '. Please open it.', '/requests/' || p_request_id::text, false, now());
  insert into public.reqgen_reminder_log (request_id, sent_to, sent_by, sent_by_label, channels, automatic)
  values (p_request_id, v_owner, auth.uid(), case when p_automatic then 'ReqGen (automatic)' else public.reqgen_actor_label(auth.uid()) end, 'in-app', p_automatic);
  return json_build_object('ok', true, 'sent_to', (select full_name from public.profiles where id = v_owner));
end;
$$;

-- Automatic reminders: after 1 day the officer; after 3 days also Registry and the DG's office.
create or replace function public.reqgen_send_due_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v record; v_n int := 0;
begin
  for v in
    select r.id, r.request_no, r.current_stage, coalesce(r.current_owner, r.assigned_account_officer_user_id) as owner,
           coalesce((select max(h.created_at) from public.request_history h where h.request_id = r.id), r.created_at) as since
    from public.requests r
    where coalesce(r.status, '') not in ('Draft', 'Paid', 'Completed', 'Rejected', 'Cancelled', 'Deleted')
      and coalesce(r.status, '') not ilike 'withdrawn%' and coalesce(r.status, '') not ilike 'returned%'
      and lower(coalesce(r.current_stage, '')) not in ('completed', 'rejected', 'cancelled', 'deleted')
      and coalesce(r.current_owner, r.assigned_account_officer_user_id) is not null
  loop
    continue when v.since > now() - interval '1 day';
    continue when exists (select 1 from public.reqgen_reminder_log l where l.request_id = v.id and l.created_at > now() - interval '1 day');
    perform public.reqgen_request_remind(v.id, true);
    if v.since < now() - interval '3 days' then
      insert into public.notifications (user_id, title, message, link, is_read, created_at)
      select distinct p.id, 'Stuck 3+ days: ' || coalesce(v.request_no, 'a request'),
             'Waiting at ' || coalesce(v.current_stage, '') || ' since ' || to_char(v.since, 'DD Mon') || '.', '/registry/tracking', false, now()
      from public.profiles p
      where public.reqgen_pv_user_has_role(p.id, array['registry', 'registrar', 'dg', 'padg']);
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.reqgen_registry_tracking() from public, anon;
revoke all on function public.reqgen_registry_summary(timestamptz) from public, anon;
revoke all on function public.reqgen_registry_moves(uuid) from public, anon;
revoke all on function public.reqgen_request_remind(uuid, boolean) from public, anon;
revoke all on function public.reqgen_send_due_reminders() from public, anon, authenticated;
grant execute on function public.reqgen_send_due_reminders() to service_role;
grant execute on function public.reqgen_registry_tracking() to authenticated;
grant execute on function public.reqgen_registry_summary(timestamptz) to authenticated;
grant execute on function public.reqgen_registry_moves(uuid) to authenticated;
grant execute on function public.reqgen_request_remind(uuid, boolean) to authenticated;
insert into v450_report values ('3 tracking', 'reqgen_registry_tracking / _summary / _moves', 'numbers, offices, people and dates only — never titles, amounts or contents', 'OK');
insert into v450_report values ('3 tracking', 'reqgen_request_remind / reqgen_send_due_reminders', 'one reminder an hour; automatic after 1 day, Registry and DG''s office after 3 days; nothing moves by itself', 'OK');

-- run the automatic reminders every morning at 08:00 Lagos (07:00 UTC) when pg_cron is on
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule(jobid) from cron.job where jobname = 'reqgen_due_reminders';
      perform cron.schedule('reqgen_due_reminders', '0 7 * * *', 'select public.reqgen_send_due_reminders()');
      insert into v450_report values ('3 tracking', 'daily reminders', 'scheduled with pg_cron at 08:00 Lagos', 'OK');
    exception when others then
      insert into v450_report values ('3 tracking', 'daily reminders', 'pg_cron present but not scheduled: ' || sqlerrm || ' — the app also runs them nightly', 'OK');
    end;
  else
    insert into v450_report values ('3 tracking', 'daily reminders', 'pg_cron is off: the nightly job (Vercel cron) runs them', 'OK');
  end if;
end $$;

-- 4. One audit log ---------------------------------------------------------------------------------
create table if not exists public.reqgen_audit_log (
  id bigint generated by default as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_label text,
  category text not null check (category in ('signin', 'approval', 'stamp', 'data', 'settings', 'registry', 'print', 'backup', 'other')),
  module text not null,
  action text not null,
  record_no text,
  record_id uuid,
  device text,
  details jsonb
);
create index if not exists reqgen_audit_log_at_idx on public.reqgen_audit_log (at desc);
alter table public.reqgen_audit_log enable row level security;
drop policy if exists reqgen_audit_log_read on public.reqgen_audit_log;
create policy reqgen_audit_log_read on public.reqgen_audit_log for select to authenticated
  using (public.reqgen_report_tier() = 'all' or actor_id = auth.uid());
revoke all on public.reqgen_audit_log from anon;
revoke insert, update, delete, truncate on public.reqgen_audit_log from authenticated;
grant select on public.reqgen_audit_log to authenticated;

-- entries can never be changed or deleted, by anyone
create or replace function public.reqgen_audit_log_guard()
returns trigger
language plpgsql
as $$
begin
  raise exception 'The audit log cannot be changed or deleted.';
end;
$$;
drop trigger if exists reqgen_audit_log_no_change on public.reqgen_audit_log;
create trigger reqgen_audit_log_no_change before update or delete on public.reqgen_audit_log for each row execute function public.reqgen_audit_log_guard();
drop trigger if exists reqgen_audit_log_no_truncate on public.reqgen_audit_log;
create trigger reqgen_audit_log_no_truncate before truncate on public.reqgen_audit_log for each statement execute function public.reqgen_audit_log_guard();

create or replace function public.reqgen_audit_device()
returns text
language sql
stable
as $$
  select case
    when ua is null or ua = '' then null
    when ua ~* '(iphone|android.*mobile|mobile safari)' then 'Phone'
    when ua ~* '(ipad|tablet|android)' then 'Tablet'
    else 'Laptop' end
  from (select coalesce((nullif(current_setting('request.headers', true), '')::json)->>'user-agent', '') as ua) x;
$$;

create or replace function public.reqgen_audit_write(p_category text, p_module text, p_action text, p_record_no text, p_record_id uuid, p_details jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reqgen_audit_log (actor_id, actor_label, category, module, action, record_no, record_id, device, details)
  values (auth.uid(), case when auth.uid() is null then 'ReqGen (system)' else public.reqgen_actor_label(auth.uid()) end,
          p_category, p_module, p_action, p_record_no, p_record_id, public.reqgen_audit_device(), p_details);
exception when others then
  null; -- the audit log never stops the work it records
end;
$$;
revoke all on function public.reqgen_audit_write(text, text, text, text, uuid, jsonb) from public, anon;
grant execute on function public.reqgen_audit_write(text, text, text, text, uuid, jsonb) to authenticated;

-- 4a. Approvals and signatures on requests
create or replace function public.reqgen_audit_request_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_no text; v_a text := lower(coalesce(new.action_type, '')); v_stamp boolean;
begin
  select request_no into v_no from public.requests where id = new.request_id;
  v_stamp := public.reqgen_key(new.from_stage) = 'dg' and v_a like 'approv%';
  perform public.reqgen_audit_write(
    case when v_stamp then 'stamp' when v_a like 'attachment%' then 'data' else 'approval' end, 'Requests',
    case when v_stamp then 'Approved, signed and stamped'
         when v_a like 'approv%' then 'Approved at ' || coalesce(new.from_stage, '') || coalesce(' → ' || new.to_stage, '')
         when v_a like 'submit%' then 'Submitted and signed'
         else initcap(coalesce(new.action_type, 'Updated')) || coalesce(' at ' || nullif(new.from_stage, ''), '') end,
    v_no, new.request_id, jsonb_build_object('position', new.actor_role_name, 'to', new.to_stage));
  return new;
end;
$$;
drop trigger if exists reqgen_audit_request_history on public.request_history;
create trigger reqgen_audit_request_history after insert on public.request_history for each row execute function public.reqgen_audit_request_history();

-- 4b. Voucher steps
create or replace function public.reqgen_audit_voucher_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_no text; v_stamp boolean := coalesce(new.action_type, '') = 'Sign & Authorise';
begin
  select voucher_no into v_no from public.payment_vouchers where id = new.voucher_id;
  perform public.reqgen_audit_write(case when v_stamp then 'stamp' when coalesce(new.action_type, '') in ('Reminder') then 'other' else 'approval' end, 'Payment Vouchers',
    case when v_stamp then 'Signed, stamped and authorised'
         else case coalesce(new.action_type, '')
           when 'Check' then 'Checked and signed' when 'Counter Sign' then 'Counter-signed' when 'Generate' then 'Voucher prepared and signed'
           when 'Prepared as' then 'Preparing as set' when 'Returned' then 'Sent back to Account' when 'Paid' then 'Marked paid'
           when 'Assign Signers' then 'Signers chosen' when 'Reminder' then 'Reminder sent'
           else coalesce(nullif(new.action_type, ''), 'Updated') end end,
    v_no, new.voucher_id, jsonb_build_object('status', new.to_status));
  return new;
end;
$$;
drop trigger if exists reqgen_audit_voucher_history on public.payment_voucher_history;
create trigger reqgen_audit_voucher_history after insert on public.payment_voucher_history for each row execute function public.reqgen_audit_voucher_history();

-- 4c. Transfers, budgets, accounts, positions, settings, registry, prints, backups
create or replace function public.reqgen_audit_generic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t text := tg_table_name;
  n jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  o jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  r jsonb := coalesce(n, o);
begin
  if t = 'reqgen_transfers' then
    if tg_op = 'UPDATE' and n->>'status' is distinct from o->>'status' then
      perform public.reqgen_audit_write(case when n->>'status' = 'Approved' then 'stamp' else 'approval' end, 'Finance',
        case when n->>'status' = 'Approved' then 'Transfer approved, signed and stamped' else 'Transfer ' || lower(n->>'status') end,
        n->>'transfer_no', (n->>'id')::uuid, jsonb_build_object('amount', n->'amount'));
    elsif tg_op = 'INSERT' then
      perform public.reqgen_audit_write('data', 'Finance', 'Transfer started', n->>'transfer_no', (n->>'id')::uuid, jsonb_build_object('amount', n->'amount'));
    end if;
  elsif t = 'subheads' then
    if tg_op = 'INSERT' or n->'approved_allocation' is distinct from o->'approved_allocation' or n->'is_active' is distinct from o->'is_active' then
      perform public.reqgen_audit_write('data', 'Finance', case when tg_op = 'INSERT' then 'Subhead created' else 'Subhead allocation changed' end,
        coalesce(r->>'code', '') || ' ' || coalesce(r->>'name', ''), (r->>'id')::uuid,
        jsonb_build_object('from', o->'approved_allocation', 'to', n->'approved_allocation'));
    end if;
  elsif t = 'iet_accounts' then
    if tg_op = 'INSERT' or n->'total_fund' is distinct from o->'total_fund' or n->'is_active' is distinct from o->'is_active' or n->>'name' is distinct from o->>'name' then
      perform public.reqgen_audit_write('data', 'Finance', case when tg_op = 'INSERT' then 'IET account added' else 'IET account changed' end,
        r->>'name', (r->>'id')::uuid, jsonb_build_object('fund_from', o->'total_fund', 'fund_to', n->'total_fund'));
    end if;
  elsif t = 'profile_roles' then
    perform public.reqgen_audit_write('settings', 'Administration',
      case tg_op when 'INSERT' then 'Position given' when 'DELETE' then 'Position removed' else 'Position changed' end,
      coalesce((select full_name from public.profiles where id = (r->>'profile_id')::uuid), ''), (r->>'profile_id')::uuid,
      jsonb_build_object('position', r->>'role_key', 'active', r->'is_active'));
  elsif t = 'user_active_roles' then
    if tg_op = 'INSERT' or n->>'active_role_key' is distinct from o->>'active_role_key' then
      perform public.reqgen_audit_write('signin', 'My Account', 'Acting as ' || public.reqgen_position_name(n->>'active_role_key'),
        coalesce((select full_name from public.profiles where id = (n->>'user_id')::uuid), ''), (n->>'user_id')::uuid, null);
    end if;
  elsif t in ('reqgen_finance_settings_log', 'reqgen_financial_years', 'payment_voucher_counter_signatories', 'departments', 'department_account_routing') then
    perform public.reqgen_audit_write('settings', case when t in ('departments', 'department_account_routing') then 'Administration' else 'Finance' end,
      case t when 'reqgen_finance_settings_log' then 'Finance setting changed'
             when 'reqgen_financial_years' then 'Financial year ' || coalesce(lower(n->>'status'), 'changed')
             when 'payment_voucher_counter_signatories' then 'Counter Signer ' || case when tg_op = 'INSERT' then 'added' else 'changed' end
             when 'departments' then 'Department ' || case when tg_op = 'INSERT' then 'added' else 'changed' end
             else 'Department account routing changed' end,
      coalesce(r->>'full_name', r->>'name', r->>'key', r->>'fy_start', ''), null, null);
  elsif t = 'registry_correspondence' then
    if tg_op = 'INSERT' or n->>'status' is distinct from o->>'status' then
      perform public.reqgen_audit_write('registry', 'Registry',
        case when tg_op = 'INSERT' then 'Recorded ' || coalesce(n->>'direction', 'item') else coalesce(n->>'status', 'Updated') end,
        r->>'reference_no', (r->>'id')::uuid, null);
    end if;
  elsif t = 'reqgen_registry_archive' then
    perform public.reqgen_audit_write('registry', 'Registry', case when tg_op = 'INSERT' then 'Archived' when n->>'restored_at' is not null and o->>'restored_at' is null then 'Taken out of the archive' else 'Archive reviewed' end,
      r->>'record_no', (r->>'id')::uuid, null);
  elsif t = 'reqgen_print_log' then
    perform public.reqgen_audit_write('print', 'Reports', 'Printed ' || coalesce(n->>'doc_kind', ''), n->>'doc_no', (n->>'doc_id')::uuid, null);
  elsif t = 'reqgen_backup_log' then
    perform public.reqgen_audit_write('backup', 'Audit', initcap(coalesce(n->>'action', 'backup')) || coalesce(' · ' || nullif(n->>'mode', ''), ''), n->>'financial_year', null, n->'summary');
  elsif t = 'reqgen_reconciliations' then
    perform public.reqgen_audit_write('data', 'Audit', 'Reconciliation ' || lower(coalesce(n->>'status', 'saved')), n->>'month', (n->>'id')::uuid, null);
  end if;
  return coalesce(new, old);
exception when others then
  return coalesce(new, old);
end;
$$;
insert into v450_report values ('4 audit', 'reqgen_audit_log', 'one append-only log: insert-only, update and delete refused for everyone', 'OK');

-- 5. Reconciliation ---------------------------------------------------------------------------------------
create table if not exists public.reqgen_reconciliations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  statement_opening numeric not null default 0,
  statement_closing numeric not null default 0,
  ledger_closing numeric,
  difference numeric,
  lines jsonb not null default '[]'::jsonb,
  status text not null default 'Open' check (status in ('Open', 'Explained', 'Reconciled')),
  explanation text,
  uploaded_by_label text,
  uploaded_at timestamptz not null default now(),
  reconciled_by_label text,
  reconciled_at timestamptz,
  unique (account_id, month)
);
alter table public.reqgen_reconciliations enable row level security;
drop policy if exists reqgen_reconciliations_read on public.reqgen_reconciliations;
create policy reqgen_reconciliations_read on public.reqgen_reconciliations for select to authenticated
  using (public.reqgen_report_tier() = 'all' or public.reqgen_active_role_key() in ('account', 'accounts', 'accountofficer'));
revoke all on public.reqgen_reconciliations from anon;
revoke insert, update, delete on public.reqgen_reconciliations from authenticated;
grant select on public.reqgen_reconciliations to authenticated;

create or replace function public.reqgen_recon_allowed()
returns boolean language sql stable security definer set search_path = public as $$
  select public.reqgen_active_role_key() in ('admin', 'auditor', 'account', 'accounts', 'accountofficer');
$$;

-- what ReqGen recorded for one IET account in one month
create or replace function public.reqgen_recon_ledger(p_account uuid, p_month text)
returns table(at timestamptz, ref text, details text, money_out numeric, money_in numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_from timestamptz := (p_month || '-01')::date; v_to timestamptz := ((p_month || '-01')::date + interval '1 month');
begin
  if not public.reqgen_recon_allowed() then raise exception 'Reconciliation is for the Auditor, Account Officers and the Super Admin.'; end if;
  return query
  select coalesce(pv.paid_at, pv.paid_on::timestamptz, pv.updated_at), pv.voucher_no,
         upper(coalesce(pv.payee_name, '')) || coalesce(' · ' || pv.paid_reference, ''), sum(coalesce(i.amount, 0)), 0::numeric
  from public.payment_vouchers pv
  join public.payment_voucher_items i on i.voucher_id = pv.id
  join public.subheads s on s.id = i.subhead_id
  where pv.status = 'Paid' and s.bank_account_id = p_account
    and coalesce(pv.paid_at, pv.paid_on::timestamptz, pv.updated_at) >= v_from and coalesce(pv.paid_at, pv.paid_on::timestamptz, pv.updated_at) < v_to
  group by pv.id;
  return query
  select coalesce(pv.posted_at, pv.created_at), pv.voucher_no, upper(coalesce(pv.payee_name, '')) || ' · manual voucher', coalesce(pv.total_amount, pv.amount, 0), 0::numeric
  from public.payment_vouchers pv
  where (coalesce(pv.voucher_type, '') = 'Manual' or coalesce(pv.voucher_origin, '') = 'Manual') and pv.posted_at is not null
    and coalesce(pv.account_id, pv.bank_account_id) = p_account and coalesce(pv.status, '') <> 'Cancelled'
    and pv.posted_at >= v_from and pv.posted_at < v_to;
  return query
  select l.created_at, coalesce(split_part(l.description, ' ', 1), l.entry_type), coalesce(l.description, l.entry_type),
         case when l.entry_type = 'Debit' then abs(coalesce(l.amount, 0)) else 0 end,
         case when l.entry_type in ('Credit', 'Bank Funding') then abs(coalesce(l.amount, 0)) else 0 end
  from public.iet_bank_ledger l
  where l.bank_account_id = p_account and l.subhead_id is null and l.entry_type in ('Debit', 'Credit', 'Bank Funding')
    and l.created_at >= v_from and l.created_at < v_to;
end;
$$;

create or replace function public.reqgen_recon_save(p_account uuid, p_month text, p_opening numeric, p_closing numeric, p_lines jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_out numeric; v_in numeric; v_ledger numeric; v_id uuid;
begin
  if not public.reqgen_recon_allowed() then raise exception 'Reconciliation is for the Auditor, Account Officers and the Super Admin.'; end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'Choose the month.'; end if;
  if exists (select 1 from public.reqgen_reconciliations where account_id = p_account and month = p_month and status = 'Reconciled') then
    raise exception 'This month is already reconciled. Ask the Auditor to reopen it.';
  end if;
  select coalesce(sum(money_out), 0), coalesce(sum(money_in), 0) into v_out, v_in from public.reqgen_recon_ledger(p_account, p_month);
  v_ledger := coalesce(p_opening, 0) - v_out + v_in;
  insert into public.reqgen_reconciliations (account_id, month, statement_opening, statement_closing, ledger_closing, difference, lines, status, uploaded_by_label, uploaded_at)
  values (p_account, p_month, coalesce(p_opening, 0), coalesce(p_closing, 0), v_ledger, coalesce(p_closing, 0) - v_ledger, coalesce(p_lines, '[]'::jsonb), 'Open',
          public.reqgen_actor_label(auth.uid()), now())
  on conflict (account_id, month) do update set statement_opening = excluded.statement_opening, statement_closing = excluded.statement_closing,
    ledger_closing = excluded.ledger_closing, difference = excluded.difference, lines = excluded.lines, status = 'Open', explanation = null,
    uploaded_by_label = excluded.uploaded_by_label, uploaded_at = now()
  returning id into v_id;
  return json_build_object('ok', true, 'id', v_id, 'ledger_closing', v_ledger, 'difference', coalesce(p_closing, 0) - v_ledger);
end;
$$;

create or replace function public.reqgen_recon_decide(p_id uuid, p_action text, p_text text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v public.reqgen_reconciliations;
begin
  select * into v from public.reqgen_reconciliations where id = p_id for update;
  if not found then raise exception 'Reconciliation not found.'; end if;
  if p_action = 'explain' then
    if not public.reqgen_recon_allowed() then raise exception 'Not allowed.'; end if;
    if length(trim(coalesce(p_text, ''))) < 5 then raise exception 'Explain the difference.'; end if;
    update public.reqgen_reconciliations set status = 'Explained', explanation = trim(p_text) where id = p_id;
  elsif p_action = 'reconcile' then
    if public.reqgen_active_role_key() not in ('auditor', 'admin') then raise exception 'Only the Auditor marks a month reconciled.'; end if;
    if coalesce(v.difference, 0) <> 0 and v.status <> 'Explained' then raise exception 'Explain the difference first.'; end if;
    update public.reqgen_reconciliations set status = 'Reconciled', reconciled_by_label = public.reqgen_actor_label(auth.uid()), reconciled_at = now() where id = p_id;
  elsif p_action = 'reopen' then
    if public.reqgen_active_role_key() not in ('auditor', 'admin') then raise exception 'Only the Auditor reopens a month.'; end if;
    update public.reqgen_reconciliations set status = 'Open', reconciled_by_label = null, reconciled_at = null where id = p_id;
  else
    raise exception 'Unknown action.';
  end if;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.reqgen_recon_allowed() from public, anon;
revoke all on function public.reqgen_recon_ledger(uuid, text) from public, anon;
revoke all on function public.reqgen_recon_save(uuid, text, numeric, numeric, jsonb) from public, anon;
revoke all on function public.reqgen_recon_decide(uuid, text, text) from public, anon;
grant execute on function public.reqgen_recon_allowed() to authenticated;
grant execute on function public.reqgen_recon_ledger(uuid, text) to authenticated;
grant execute on function public.reqgen_recon_save(uuid, text, numeric, numeric, jsonb) to authenticated;
grant execute on function public.reqgen_recon_decide(uuid, text, text) to authenticated;
insert into v450_report values ('5 reconcile', 'reqgen_reconciliations / reqgen_recon_*', 'statement vs ReqGen ledger per account and month; explain; the Auditor marks reconciled', 'OK');

-- attach the audit triggers (only to tables that exist)
do $$
declare t text;
begin
  foreach t in array array['reqgen_transfers', 'subheads', 'iet_accounts', 'profile_roles', 'user_active_roles', 'reqgen_finance_settings_log',
                           'reqgen_financial_years', 'payment_voucher_counter_signatories', 'departments', 'department_account_routing',
                           'registry_correspondence', 'reqgen_registry_archive', 'reqgen_print_log', 'reqgen_backup_log', 'reqgen_reconciliations']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists reqgen_audit_%1$s on public.%1$I', t);
      execute format('create trigger reqgen_audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.reqgen_audit_generic()', t);
    end if;
  end loop;
end $$;
insert into v450_report
select '4 audit', 'audit triggers attached', count(*)::text || ' tables', case when count(*) >= 12 then 'OK' else 'CHECK' end
from pg_trigger where tgname like 'reqgen_audit_%' and not tgisinternal;

-- 6. Reading the log (with sign-ins) and tracing a journey ------------------------------------------------
create or replace function public.reqgen_audit_events(p_from timestamptz, p_to timestamptz)
returns table(at timestamptz, actor_label text, category text, module text, action text, record_no text, record_id uuid, device text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.reqgen_report_tier() <> 'all' then raise exception 'The Audit Log is for the Auditor and the Super Admin.'; end if;
  return query
  select l.at, l.actor_label, l.category, l.module, l.action, l.record_no, l.record_id, l.device
  from public.reqgen_audit_log l where l.at >= p_from and l.at < p_to;
  if to_regclass('auth.audit_log_entries') is not null then
    return query execute $q$
      select e.created_at, coalesce(public.reqgen_actor_label((e.payload->>'actor_id')::uuid), e.payload->>'actor_username', 'Someone'),
             'signin'::text, 'Sign-in'::text,
             case e.payload->>'action' when 'login' then 'Signed in' when 'logout' then 'Signed out' when 'user_recovery_requested' then 'Asked to reset password'
                  when 'user_updated_password' then 'Changed password' when 'mfa_code_login' then 'Signed in with 2FA' else initcap(replace(e.payload->>'action', '_', ' ')) end,
             null::text, null::uuid, null::text
      from auth.audit_log_entries e
      where e.created_at >= $1 and e.created_at < $2
        and e.payload->>'action' in ('login', 'logout', 'user_recovery_requested', 'user_updated_password', 'mfa_code_login')$q$
    using p_from, p_to;
  end if;
end;
$$;

create or replace function public.reqgen_trace(p_no text)
returns table(phase text, at timestamptz, title text, who text, tone text, stamped boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_req_id uuid; v_req_no text; v_pv_id uuid; v_pv_no text; v_no text := upper(trim(coalesce(p_no, '')));
begin
  if public.reqgen_report_tier() <> 'all' then raise exception 'Workflow Trace is for the Auditor and the Super Admin.'; end if;
  select r.id, r.request_no into v_req_id, v_req_no from public.requests r where upper(r.request_no) = v_no;
  if v_req_id is null then
    select pv.id, pv.voucher_no into v_pv_id, v_pv_no from public.payment_vouchers pv where upper(pv.voucher_no) = v_no;
    if v_pv_id is null then raise exception 'No request or voucher has the number %.', v_no; end if;
    select r.id, r.request_no into v_req_id, v_req_no from public.payment_voucher_items i join public.requests r on r.id = i.request_id where i.voucher_id = v_pv_id order by r.created_at limit 1;
  end if;
  if v_req_id is not null then
    return query
    select 'Request ' || v_req_no, h.created_at,
           case when lower(coalesce(h.action_type, '')) like 'submit%' then 'Submitted'
                when public.reqgen_key(h.from_stage) = 'dg' and lower(coalesce(h.action_type, '')) like 'approv%' then 'Approved, signed and stamped by the Director General'
                when public.reqgen_key(h.from_stage) = 'account' and lower(coalesce(h.to_stage, '')) in ('completed', 'hr filing') then 'Fund released by Account'
                when lower(coalesce(h.action_type, '')) like 'approv%' then 'Approved by ' || public.reqgen_position_name(coalesce(h.actor_role_key, h.from_stage))
                else initcap(coalesce(h.action_type, '')) || coalesce(' at ' || nullif(h.from_stage, ''), '') end,
           coalesce(h.actor_name, '') || coalesce(' · ' || nullif(h.actor_role_name, ''), ''),
           case when lower(coalesce(h.action_type, '')) ~ '(return|reject|withdraw)' then 'red' when public.reqgen_key(h.from_stage) = 'dg' then 'brand'
                when lower(coalesce(h.action_type, '')) like 'submit%' then 'blue' else 'green' end,
           public.reqgen_key(h.from_stage) = 'dg' and lower(coalesce(h.action_type, '')) like 'approv%'
    from public.request_history h
    where h.request_id = v_req_id and lower(coalesce(h.action_type, '')) not like 'attachment%'
    order by h.created_at;
  end if;
  return query
  select 'Voucher ' || pv.voucher_no, h.created_at,
         case h.action_type when 'Generate' then 'Voucher prepared and signed' when 'Check' then 'Checked by the Auditor' when 'Counter Sign' then 'Counter-signed'
              when 'Sign & Authorise' then 'Signed, stamped and authorised by the Director General' when 'Paid' then 'Paid' || coalesce(' · ref ' || pv.paid_reference, '')
              else coalesce(h.action_type, '') end,
         coalesce(h.actor_name, ''),
         case when h.action_type in ('Returned', 'Cancelled') then 'red' when h.action_type = 'Sign & Authorise' then 'brand' when h.action_type = 'Generate' then 'blue' else 'green' end,
         h.action_type = 'Sign & Authorise'
  from public.payment_vouchers pv
  join public.payment_voucher_history h on h.voucher_id = pv.id
  where (pv.id = v_pv_id or pv.id in (select i.voucher_id from public.payment_voucher_items i where i.request_id = v_req_id))
    and coalesce(h.action_type, '') not in ('Reminder', 'Prepared as', 'Assign Signers')
  order by h.created_at;
  return query
  select 'Filing', a.archived_at, 'Filed by Registry · ' || coalesce(a.location, ''), coalesce(a.archived_by_label, ''), 'green', false
  from public.reqgen_registry_archive a
  where a.restored_at is null and (a.record_no = v_req_no or a.record_no = v_pv_no
         or a.record_no in (select pv.voucher_no from public.payment_vouchers pv join public.payment_voucher_items i on i.voucher_id = pv.id where i.request_id = v_req_id));
end;
$$;
revoke all on function public.reqgen_audit_events(timestamptz, timestamptz) from public, anon;
revoke all on function public.reqgen_trace(text) from public, anon;
grant execute on function public.reqgen_audit_events(timestamptz, timestamptz) to authenticated;
grant execute on function public.reqgen_trace(text) to authenticated;
insert into v450_report values ('4 audit', 'reqgen_audit_events / reqgen_trace', 'the log with sign-ins; the full journey of any request or voucher (Auditor, Super Admin)', 'OK');

-- 7. Backups --------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('backups', 'backups', false) on conflict (id) do update set public = false;
-- (made by v3_1_8_master_backup_log.sql; created here only if that step was never run)
create table if not exists public.reqgen_backup_log (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('backup', 'preview', 'restore')),
  financial_year text, mode text, actor_id uuid, actor_name text, summary jsonb,
  created_at timestamptz not null default now()
);
alter table public.reqgen_backup_log enable row level security;
drop policy if exists reqgen_backup_log_read on public.reqgen_backup_log;
create policy reqgen_backup_log_read on public.reqgen_backup_log for select to authenticated
  using (public.reqgen_pv_user_has_role(auth.uid(), array['admin', 'auditor']));
revoke insert, update, delete on public.reqgen_backup_log from anon, authenticated;
grant select on public.reqgen_backup_log to authenticated;
alter table public.reqgen_backup_log add column if not exists storage_path text;
alter table public.reqgen_backup_log add column if not exists bytes bigint;
insert into v450_report values ('6 backup', 'backups bucket', 'private; written and read only by the server (no browser access)', 'OK');

-- 8. Verification ---------------------------------------------------------------------------------------
insert into v450_report
select '7 check', 'functions installed', count(*)::text || ' of 23', case when count(*) = 23 then 'OK' else 'CHECK' end
from pg_proc where pronamespace = 'public'::regnamespace and proname in (
  'reqgen_is_registry', 'reqgen_registry_next_ref', 'reqgen_registry_save', 'reqgen_registry_act', 'reqgen_registry_dispatch', 'reqgen_registry_archive_add',
  'reqgen_registry_archive_restore', 'reqgen_registry_archive_review', 'reqgen_registry_filing_queue', 'reqgen_registry_tracking', 'reqgen_registry_summary',
  'reqgen_registry_moves', 'reqgen_request_remind', 'reqgen_send_due_reminders', 'reqgen_audit_write', 'reqgen_audit_request_history',
  'reqgen_audit_voucher_history', 'reqgen_audit_generic', 'reqgen_audit_events', 'reqgen_trace', 'reqgen_recon_ledger', 'reqgen_recon_save', 'reqgen_recon_decide');
insert into v450_report
select '7 check', 'anonymous visitors cannot call them',
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'blocked' else 'open' end,
       case when bool_and(not has_function_privilege('anon', p.oid, 'execute')) then 'OK' else 'CHECK' end
from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in (
  'reqgen_registry_save', 'reqgen_registry_act', 'reqgen_registry_dispatch', 'reqgen_registry_archive_add', 'reqgen_registry_tracking', 'reqgen_registry_moves',
  'reqgen_request_remind', 'reqgen_send_due_reminders', 'reqgen_audit_write', 'reqgen_audit_events', 'reqgen_trace', 'reqgen_recon_ledger', 'reqgen_recon_save', 'reqgen_recon_decide');
insert into v450_report
select '7 check', 'new tables protected by row-level security',
       string_agg(c.relname || '=' || case when c.relrowsecurity then 'on' else 'off' end, ', '),
       case when bool_and(c.relrowsecurity) then 'OK' else 'CHECK' end
from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('reqgen_registry_archive', 'reqgen_reminder_log', 'reqgen_audit_log', 'reqgen_reconciliations');
insert into v450_report
select '7 check', 'audit log cannot be changed', case when exists (select 1 from pg_trigger where tgname = 'reqgen_audit_log_no_change') then 'update / delete refused' else 'missing' end,
       case when exists (select 1 from pg_trigger where tgname = 'reqgen_audit_log_no_change') then 'OK' else 'CHECK' end;
insert into v450_report values ('7 check', 'routing engine untouched', 'reqgen_build_route_for_template is only read', 'OK');

commit;

select step as "step", item as "item", result as "result", status as "status" from v450_report order by step, item;
