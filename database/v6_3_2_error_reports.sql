-- =====================================================================================
-- ReqGen 6.3.2 with app 4.2.2: error reports with a picture of the screen (owner, 26 Nov 2026).
--
-- When the app meets a real error (a crash, or the database refusing something that is not
-- a normal message to the user), it takes a picture of the screen, stores it in a private
-- folder, writes the report, and the Super Admin gets an app notice at once. The Super Admin
-- (and the Developer) read the reports, with the pictures, in Administration > Diagnostics.
--
--   * Pictures go in the private storage folder "app-error-shots". Each person can only add
--     pictures to their own sub-folder. Only the Super Admin and the Developer can open them.
--   * Normal messages (for example "Write the title.") are not errors and send no notice.
--   * At most one notice for the same error every 10 minutes, so nobody is flooded.
--   * The older reqgen_app_log_error keeps working for phones still on 4.2.1 or older.
--
-- Nothing is dropped. One column is added to reqgen_app_errors. Safe to run more than once.
-- Ends with a table where every row should say OK.
-- =====================================================================================

create temp table if not exists v632_report (step text, item text, detail text, result text);
delete from v632_report;

-- 1. The report keeps where its picture is, and how serious it was
alter table public.reqgen_app_errors add column if not exists shot_path text;
alter table public.reqgen_app_errors add column if not exists severity text;
alter table public.reqgen_app_errors add column if not exists source text;
insert into v632_report values ('1 reports', 'reqgen_app_errors', 'picture, severity and source (app or website) added', 'OK');

-- 2. The private folder for the pictures
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('app-error-shots', 'app-error-shots', false, 1048576, array['image/jpeg', 'image/png'])
    on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg', 'image/png'];

    execute 'drop policy if exists reqgen_error_shots_add on storage.objects';
    execute $p$create policy reqgen_error_shots_add on storage.objects for insert to authenticated
      with check (bucket_id = 'app-error-shots' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute 'drop policy if exists reqgen_error_shots_read on storage.objects';
    execute $p$create policy reqgen_error_shots_read on storage.objects for select to authenticated
      using (bucket_id = 'app-error-shots' and public.reqgen_is_admin())$p$;
    insert into v632_report values ('2 pictures', 'storage app-error-shots', 'private: staff add their own; only the Super Admin and Developer open them', 'OK');
  else
    insert into v632_report values ('2 pictures', 'storage app-error-shots', 'storage is not on this database (test copy only)', 'OK');
  end if;
end $$;

-- 3. Write a report and tell the Super Admin
create or replace function public.reqgen_app_report_error(
  p_version text, p_screen text, p_code text, p_message text, p_detail jsonb default null,
  p_shot text default null, p_severity text default 'error', p_source text default 'app')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_id bigint;
  v_name text;
  v_sev text := case when lower(coalesce(p_severity, '')) in ('crash', 'error', 'warning') then lower(p_severity) else 'error' end;
  v_shot text := nullif(trim(coalesce(p_shot, '')), '');
begin
  if me is null then return null; end if;
  if (select count(*) from public.reqgen_app_errors where user_id = me and at > now() - interval '1 day') >= 200 then return null; end if;
  -- a picture must be in the person's own folder
  if v_shot is not null and split_part(v_shot, '/', 1) <> me::text then v_shot := null; end if;
  insert into public.reqgen_app_errors (user_id, app_version, screen, code, message, detail, shot_path, severity, source)
  values (me, left(p_version, 20), left(p_screen, 120), left(p_code, 60), left(p_message, 600),
          case when p_detail is null or length(p_detail::text) > 4000 then null else p_detail end,
          v_shot, v_sev, case when p_source = 'website' then 'website' else 'app' end)
  returning id into v_id;

  -- the Super Admin is told at once (one notice per error every 10 minutes)
  if v_sev in ('crash', 'error') and not exists (
       select 1 from public.reqgen_app_errors e
        where e.id <> v_id and e.code is not distinct from left(p_code, 60) and e.screen is not distinct from left(p_screen, 120)
          and e.at > now() - interval '10 minutes' and e.severity in ('crash', 'error')) then
    select full_name into v_name from public.profiles where id = me;
    insert into public.notifications (user_id, title, message, link, is_read)
    select p.id, 'App error reported',
           coalesce(v_name, 'A staff member') || ', ' || coalesce(left(p_screen, 60), 'ReqGen') || ': ' || left(coalesce(p_message, ''), 140)
             || case when v_shot is not null then ' (picture attached)' else '' end,
           '/admin/system-health#app-errors', false
      from public.profiles p
     where p.system_account = 'superadmin' and coalesce(p.is_active, true);
  end if;
  return v_id;
end;
$$;
revoke all on function public.reqgen_app_report_error(text, text, text, text, jsonb, text, text, text) from public, anon;
grant execute on function public.reqgen_app_report_error(text, text, text, text, jsonb, text, text, text) to authenticated;
insert into v632_report values ('3 notice', 'reqgen_app_report_error', 'writes the report; the Super Admin gets an app notice at once', 'OK');

-- 4. The Super Admin reads the newest reports
create or replace function public.reqgen_app_error_list(p_limit int default 50)
returns table (id bigint, at timestamptz, full_name text, app_version text, screen text, code text, message text, severity text, source text, shot_path text, detail jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.at, p.full_name::text, e.app_version, e.screen, e.code, e.message, coalesce(e.severity, 'error'), coalesce(e.source, 'app'), e.shot_path, e.detail
    from public.reqgen_app_errors e left join public.profiles p on p.id = e.user_id
   where public.reqgen_is_admin()
   order by e.at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;
revoke all on function public.reqgen_app_error_list(int) from public, anon;
grant execute on function public.reqgen_app_error_list(int) to authenticated;
insert into v632_report values ('4 list', 'reqgen_app_error_list', 'only the Super Admin and Developer', 'OK');

select step, item, detail, result from v632_report order by step;
