-- Read-only RLS and policy audit
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced, count(p.policyname) as policy_count
from pg_class c join pg_namespace n on n.oid=c.relnamespace
left join pg_policies p on p.schemaname=n.nspname and p.tablename=c.relname
where n.nspname='public' and c.relkind in ('r','p')
group by n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
order by rls_enabled, c.relname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname='public' order by tablename, policyname;
