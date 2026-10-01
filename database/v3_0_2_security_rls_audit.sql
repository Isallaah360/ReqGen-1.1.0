-- ============================================================================
-- ReqGen v3.0.2 — Security & RLS audit (READ-ONLY) · rev 2 (INSERT policies read WITH CHECK)
-- ONE query, ONE result table. Changes nothing. Safe to run any time.
-- Reads only PostgreSQL/Supabase system catalogues (pg_tables, pg_policies,
-- pg_proc, pg_publication_tables, storage.buckets) — it does not depend on any
-- ReqGen column names, so it cannot fail on a renamed column.
--
-- HOW TO USE: Supabase → SQL Editor → paste this whole file → Run.
-- Rows are sorted so ATTENTION comes first, then REVIEW, then OK/INFO.
-- Send me a screenshot (or CSV export) of the full result.
-- ============================================================================
with
tables as (
  select t.tablename, t.rowsecurity
  from pg_tables t
  where t.schemaname = 'public'
),
policy_counts as (
  select p.tablename, count(*) as n
  from pg_policies p
  where p.schemaname = 'public'
  group by p.tablename
),
findings as (
  -- 1. Tables with RLS switched OFF: any logged-in (or anonymous) user with the
  --    public API key can read/write them directly.
  select 1 as rank, 'ATTENTION' as severity, 'RLS disabled' as check_name,
         t.tablename as object_name,
         'Row Level Security is OFF — data is exposed to the public API.' as detail
  from tables t where not t.rowsecurity

  union all
  -- 2. RLS on but no policies: table is completely locked to the app.
  select 2, 'REVIEW', 'RLS on, no policies', t.tablename,
         'Nobody can read/write via the app. Fine only if the app never uses this table.'
  from tables t
  left join policy_counts pc on pc.tablename = t.tablename
  where t.rowsecurity and coalesce(pc.n, 0) = 0

  union all
  -- 3. Policies open to anonymous (not-logged-in) visitors with no condition.
  select 1, 'ATTENTION', 'Open to anonymous users', p.tablename || ' · ' || p.policyname,
         p.cmd || ' allowed for ' || array_to_string(p.roles, ',') || ' with no condition (true).'
  from pg_policies p
  where p.schemaname = 'public'
    and (p.roles && array['public','anon']::name[])
    -- INSERT conditions live in WITH CHECK; SELECT/DELETE in USING; UPDATE/ALL in either.
    and case p.cmd
          when 'INSERT' then coalesce(p.with_check, 'true') = 'true'
          when 'SELECT' then coalesce(p.qual, 'true') = 'true'
          when 'DELETE' then coalesce(p.qual, 'true') = 'true'
          else coalesce(p.qual, 'true') = 'true' or coalesce(p.with_check, p.qual, 'true') = 'true'
        end

  union all
  -- 4. Write policies for any logged-in user with no condition.
  select 2, 'REVIEW', 'Unrestricted write (logged-in)', p.tablename || ' · ' || p.policyname,
         p.cmd || ' allowed for every authenticated user with no condition — confirm this is intended.'
  from pg_policies p
  where p.schemaname = 'public'
    and p.cmd in ('INSERT','UPDATE','DELETE','ALL')
    and (p.roles && array['authenticated']::name[])
    and case p.cmd
          when 'INSERT' then coalesce(p.with_check, 'true') = 'true'
          when 'DELETE' then coalesce(p.qual, 'true') = 'true'
          else coalesce(p.qual, 'true') = 'true' and coalesce(p.with_check, p.qual, 'true') = 'true'
        end

  union all
  -- 5. SECURITY DEFINER functions without a fixed search_path (hijack risk).
  select 1, 'ATTENTION', 'SECURITY DEFINER without search_path', n.nspname || '.' || p.proname,
         'Runs with owner privileges but search_path is not pinned. Add: SET search_path = public.'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c where c like 'search_path=%')

  union all
  -- 6. Realtime: the approval bell updates instantly only if "requests" is published.
  select case when exists (select 1 from pg_publication_tables
                           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests')
              then 9 else 2 end,
         case when exists (select 1 from pg_publication_tables
                           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests')
              then 'OK' else 'REVIEW' end,
         'Realtime on requests', 'public.requests',
         case when exists (select 1 from pg_publication_tables
                           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests')
              then 'Instant approval-bell updates are enabled.'
              else 'Not published: the bell still updates (focus + 60 s check) but not instantly.' end

  union all
  -- 7. Public storage buckets (anyone with the link can view files).
  select 8, 'INFO', 'Public storage bucket', b.id,
         'Files are viewable by link. Expected for avatars; confirm for anything else.'
  from storage.buckets b where b.public

  union all
  -- 8. Summary line so an empty result is never ambiguous.
  select 10, 'INFO', 'Summary', 'public schema',
         (select count(*) from tables)::text || ' tables · ' ||
         (select count(*) from tables where rowsecurity)::text || ' with RLS · ' ||
         (select count(*) from pg_policies where schemaname = 'public')::text || ' policies'
)
select severity, check_name, object_name, detail
from findings
order by rank, check_name, object_name;
