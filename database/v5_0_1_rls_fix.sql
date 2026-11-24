-- =============================================================================
-- ReqGen 5.0.1 · URGENT fix: "infinite recursion detected in policy for relation requests"
--
-- Cause (from 4.7.0): two read rules pointed at each other.
--   requests                 -> "the people a direct request was sent to may read it"   (looks in reqgen_direct_recipients)
--   reqgen_direct_recipients -> "the sender may read who it was sent to"                (looks in requests)
-- Postgres refuses such a loop, so EVERY read of requests failed: My Requests, Approvals,
-- the DG's queue, the bell, and the app lists (which showed nothing).
--
-- Fix: the two rules now ask small "security definer" helpers that read the other table
-- directly, so there is no loop. Who may see what is exactly the same as before:
--   * the sender, the person holding the request, the Account Officer, anyone who acted on it
--     (unchanged rule reqgen_v304_requests_select), and
--   * the people a direct request was sent to (read only).
-- The same loop also stopped photo and signature uploads ("The database schema is invalid or
-- incompatible" is how Storage reports it), so the two attachment file rules use the helper too.
-- Nothing is dropped except the looping rules, which are rebuilt at once. Safe to run twice.
-- At the end it TESTS every request and voucher table as a signed-in user and reports OK.
-- =============================================================================
begin;

create temp table if not exists v501_report (step text, item text, result text, status text);
truncate v501_report;

-- 1. Helpers (read the table directly, outside row security, so rules never loop)
create or replace function public.reqgen_is_direct_receiver(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.reqgen_direct_recipients x where x.request_id = p_request_id and x.user_id = auth.uid());
$$;
revoke all on function public.reqgen_is_direct_receiver(uuid) from public, anon;
grant execute on function public.reqgen_is_direct_receiver(uuid) to authenticated;

create or replace function public.reqgen_is_request_sender(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.requests r where r.id = p_request_id and r.created_by = auth.uid());
$$;
revoke all on function public.reqgen_is_request_sender(uuid) from public, anon;
grant execute on function public.reqgen_is_request_sender(uuid) to authenticated;
insert into v501_report values ('1 helpers', 'reqgen_is_direct_receiver, reqgen_is_request_sender', 'ready', 'OK');

-- 2. Rebuild the looping rules with the helpers
do $$
begin
  if to_regclass('public.reqgen_direct_recipients') is not null then
    drop policy if exists reqgen_direct_recipients_read on public.reqgen_direct_recipients;
    create policy reqgen_direct_recipients_read on public.reqgen_direct_recipients for select to authenticated
      using (user_id = auth.uid() or public.reqgen_is_request_sender(request_id));
    insert into v501_report values ('2 rules', 'reqgen_direct_recipients read', 'the person it was sent to, or the sender', 'OK');
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'requests' and policyname = 'reqgen_direct_receivers_read') then
    drop policy reqgen_direct_receivers_read on public.requests;
  end if;
  if exists (select 1 from pg_class where oid = 'public.requests'::regclass and relrowsecurity) then
    create policy reqgen_direct_receivers_read on public.requests for select to authenticated
      using (public.reqgen_is_direct_receiver(id));
    insert into v501_report values ('2 rules', 'requests read (direct receivers)', 'no loop any more', 'OK');
  end if;

  if to_regclass('public.request_history') is not null then
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'request_history' and policyname = 'reqgen_direct_receivers_history') then
      drop policy reqgen_direct_receivers_history on public.request_history;
    end if;
    if exists (select 1 from pg_class where oid = 'public.request_history'::regclass and relrowsecurity) then
      create policy reqgen_direct_receivers_history on public.request_history for select to authenticated
        using (public.reqgen_is_direct_receiver(request_id));
      insert into v501_report values ('2 rules', 'request_history read (direct receivers)', 'no loop any more', 'OK');
    end if;
  end if;
end $$;

-- 2b. File uploads (photos, signatures, attachments) were refused too, with
--     "The database schema is invalid or incompatible": Storage checks every file rule at once,
--     and the attachment rules read requests directly, so they hit the same loop.
--     They now ask the same helper (same rule: only the sender may change or remove the file).
do $$
begin
  if to_regclass('storage.objects') is null then
    insert into v501_report values ('2 rules', 'storage file rules', 'storage not present here', 'OK');
    return;
  end if;
  drop policy if exists "reqgen_v304_attachment_files_update" on storage.objects;
  create policy "reqgen_v304_attachment_files_update" on storage.objects
    for update to authenticated
    using (
      bucket_id = 'request-attachments'
      and case
            when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then public.reqgen_is_request_sender(((storage.foldername(name))[1])::uuid)
            else false
          end
    )
    with check (bucket_id = 'request-attachments');
  drop policy if exists "reqgen_v304_attachment_files_delete" on storage.objects;
  create policy "reqgen_v304_attachment_files_delete" on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'request-attachments'
      and case
            when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then public.reqgen_is_request_sender(((storage.foldername(name))[1])::uuid)
            else false
          end
    );
  insert into v501_report values ('2 rules', 'storage file rules (attachments)', 'no loop any more; photos and signatures upload again', 'OK');
end $$;

-- 3. Test: read every request and voucher table as a signed-in user. Any loop shows here.
do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array['requests', 'request_history', 'reqgen_direct_recipients', 'request_attachments',
                           'payment_vouchers', 'payment_voucher_history', 'notifications', 'registry_correspondence', 'profiles']
  loop
    if to_regclass('public.' || t) is null then
      insert into v501_report values ('3 test', t, 'table not present', 'OK');
      continue;
    end if;
    begin
      execute 'set local role authenticated';
      execute format('select count(*) from public.%I', t) into n;
      execute 'reset role';
      insert into v501_report values ('3 test', t, 'reads cleanly as a signed-in user', 'OK');
    exception when others then
      execute 'reset role';
      insert into v501_report values ('3 test', t, sqlerrm, 'PROBLEM');
    end;
  end loop;
  if to_regclass('storage.objects') is not null then
    begin
      execute 'set local role authenticated';
      execute 'select count(*) from storage.objects' into n;
      execute 'reset role';
      insert into v501_report values ('3 test', 'storage.objects (photos, signatures, files)', 'reads cleanly as a signed-in user', 'OK');
    exception when others then
      execute 'reset role';
      insert into v501_report values ('3 test', 'storage.objects (photos, signatures, files)', sqlerrm, 'PROBLEM');
    end;
  end if;
end $$;

commit;

select * from v501_report order by step, item;
