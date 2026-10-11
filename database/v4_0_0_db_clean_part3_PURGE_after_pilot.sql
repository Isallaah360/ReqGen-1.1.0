-- =============================================================================
-- ReqGen v4.0.0 · DATABASE CLEAN-UP · PART 3 — PERMANENT PURGE (after the pilot)
--
-- Run this ONLY after the pilot has passed and nobody has missed anything.
-- First download a Master Backup. This deletes the archive for good:
-- every table and function that Part 1 moved out of "public" is removed.
-- Nothing in "public" is touched.
--
-- To confirm, change the word NO to YES on the next line, then Run.
-- =============================================================================
do $$
declare
  confirm text := 'NO';   -- <<< change to 'YES' to purge
begin
  if confirm <> 'YES' then
    raise exception 'Purge not confirmed. Change NO to YES on the confirm line, then run again.';
  end if;
end $$;

drop table if exists pg_temp.purge_report;
create temporary table purge_report (kind text, name text, status text);

insert into purge_report
select case c.relkind when 'r' then 'table' when 'p' then 'table' when 'S' then 'sequence' else 'other' end,
       c.relname, 'will be deleted'
from pg_class c
where c.relnamespace = 'reqgen_archive'::regnamespace and c.relkind in ('r','p');

insert into purge_report
select 'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', 'will be deleted'
from pg_proc p where p.pronamespace = 'reqgen_archive'::regnamespace;

drop schema if exists reqgen_archive cascade;

update purge_report set status = 'deleted · OK';

select kind as "object type", name as "object", status as "status" from purge_report order by kind, name;
