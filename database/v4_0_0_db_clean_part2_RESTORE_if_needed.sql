-- =============================================================================
-- ReqGen v4.0.0 · DATABASE CLEAN-UP · PART 2 — RESTORE (only if needed)
--
-- Run this ONLY if something stops working after Part 1.
-- It moves every table and function that Part 1 archived back into "public",
-- exactly as they were. Data is untouched. Safe to run more than once.
-- The last result lists each object with OK.
-- =============================================================================
begin;
set local lock_timeout = '8s';

drop table if exists pg_temp.restore_report;
create temporary table restore_report (kind text, name text, action text, status text);

do $$
declare
  m record;
  fname text;
  fargs text;
begin
  if to_regclass('reqgen_archive.moved_objects') is null then
    insert into restore_report values ('note', 'reqgen_archive', 'nothing to restore (Part 1 was never run)', 'OK');
    return;
  end if;

  -- tables first (functions may refer to them)
  for m in select * from reqgen_archive.moved_objects where object_kind = 'table' and restored_at is null order by id loop
    if to_regclass('reqgen_archive.' || quote_ident(m.object_name)) is not null then
      execute format('alter table reqgen_archive.%I set schema public', m.object_name);
      update reqgen_archive.moved_objects set restored_at = now() where id = m.id;
      insert into restore_report values ('table', m.object_name, 'back in public', 'OK');
    else
      insert into restore_report values ('table', m.object_name, 'not in archive', 'CHECK');
    end if;
  end loop;

  for m in select * from reqgen_archive.moved_objects where object_kind = 'function' and restored_at is null order by id loop
    fname := split_part(m.object_name, '(', 1);
    fargs := regexp_replace(m.object_name, '^[^(]*\((.*)\)$', '\1');
    begin
      execute format('alter function reqgen_archive.%I(%s) set schema public', fname, fargs);
      update reqgen_archive.moved_objects set restored_at = now() where id = m.id;
      insert into restore_report values ('function', m.object_name, 'back in public', 'OK');
    exception when others then
      insert into restore_report values ('function', m.object_name, 'could not move back: ' || sqlerrm, 'CHECK');
    end;
  end loop;
end $$;

commit;

select kind as "object type", name as "object", action as "what happened", status as "status"
from restore_report order by kind, name;
