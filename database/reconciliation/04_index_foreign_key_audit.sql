-- Read-only index, foreign-key and constraint audit
select schemaname, tablename, indexname, indexdef from pg_indexes where schemaname='public' order by tablename,indexname;

select tc.table_name, tc.constraint_name, kcu.column_name, ccu.table_name as referenced_table, ccu.column_name as referenced_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and ccu.table_schema=tc.table_schema
where tc.table_schema='public' and tc.constraint_type='FOREIGN KEY' order by tc.table_name,tc.constraint_name;
