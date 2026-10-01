-- ============================================================================
-- ReqGen v3.0.7 — Notification Centre
--
-- Your workflow functions already write a notification at every step, but the
-- app never displayed them. This makes them safe and usable:
--
--  1. COLUMNS (added only if missing; nothing removed or renamed):
--       message, body, link, is_read (default false), read_at
--     — both the newer (message/is_read) and older (body) writers keep working.
--  2. PRIVACY: every existing rule on public.notifications is replaced by:
--       a person can read, mark read, or delete ONLY their own notifications.
--     Workflow functions (SECURITY DEFINER) still insert for anyone, as today.
--  3. reqgen_mark_notifications_read(ids) — marks the caller's own
--     notifications read (all of them when ids is null).
--  4. Realtime on notifications, so the bell updates instantly.
--  5. An index for fast unread counts.
--
-- Data: no notification is changed except that rows without a read flag are
-- treated as unread (is_read = false). One transaction. Re-runnable.
-- Ends with a verification table — every row should read OK.
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.notifications') is null then
    raise exception 'ReqGen v3.0.7 STOPPED — nothing was changed. Table public.notifications does not exist.';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'notifications' and column_name = 'user_id') then
    raise exception 'ReqGen v3.0.7 STOPPED — nothing was changed. notifications.user_id is missing.';
  end if;
end $$;

-- 1. Columns
alter table public.notifications add column if not exists title text;
alter table public.notifications add column if not exists message text;
alter table public.notifications add column if not exists body text;
alter table public.notifications add column if not exists link text;
alter table public.notifications add column if not exists is_read boolean;
alter table public.notifications add column if not exists read_at timestamptz;
alter table public.notifications add column if not exists created_at timestamptz;

update public.notifications set is_read = false where is_read is null;
alter table public.notifications alter column is_read set default false;
alter table public.notifications alter column is_read set not null;
alter table public.notifications alter column created_at set default now();

create index if not exists reqgen_notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

-- 2. Privacy: replace ALL existing policies with "own notifications only".
alter table public.notifications enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'notifications' loop
    execute format('drop policy %I on public.notifications', p.policyname);
  end loop;
end $$;

create policy "reqgen_v307_notifications_select_own" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "reqgen_v307_notifications_update_own" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reqgen_v307_notifications_delete_own" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.notifications from anon;
grant select, update, delete on public.notifications to authenticated;

-- 3. Mark read
create or replace function public.reqgen_mark_notifications_read(p_ids text[] default null)
returns integer
language plpgsql security definer set search_path = public
as $fn$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;
  update public.notifications n
  set is_read = true, read_at = coalesce(n.read_at, now())
  where n.user_id = auth.uid()
    and n.is_read = false
    and (p_ids is null or n.id::text = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

revoke all on function public.reqgen_mark_notifications_read(text[]) from public, anon;
grant execute on function public.reqgen_mark_notifications_read(text[]) to authenticated;

-- 4. Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end $$;

commit;

-- 5. Verification
select 'notifications: own-only privacy rules' as check_item,
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'notifications') = 3
             and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications'
                             and policyname not like 'reqgen_v307_%')
            then 'OK' else 'CHECK' end as status
union all
select 'notifications: read flag column',
       case when exists (select 1 from information_schema.columns where table_schema = 'public'
                         and table_name = 'notifications' and column_name = 'is_read') then 'OK' else 'MISSING' end
union all
select 'notifications: realtime enabled',
       case when exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                         and schemaname = 'public' and tablename = 'notifications') then 'OK'
            else 'INFO: realtime publication not found (bell still refreshes every 60 s)' end
union all
select 'notifications: total / unread',
       (select count(*)::text from public.notifications) || ' / ' ||
       (select count(*)::text from public.notifications where not is_read);
