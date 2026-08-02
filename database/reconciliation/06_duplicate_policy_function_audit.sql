-- Read-only duplicate-risk audit
select schemaname, tablename, policyname, count(*) as copies
from pg_policies where schemaname='public' group by schemaname,tablename,policyname having count(*)>1;

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments, count(*) over(partition by p.proname) as overload_count
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' order by overload_count desc,p.proname,arguments;
