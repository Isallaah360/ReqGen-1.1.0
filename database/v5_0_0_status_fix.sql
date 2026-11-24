-- ReqGen 5.0.0 · Fix: "new row for relation requests violates check constraint requests_status_check"
-- Cause: direct requests (4.7.0) are saved with status 'Sent directly' and, once everyone answered, 'Answered'.
-- Those two words were never added to the list of allowed statuses.
-- This script REBUILDS the allowed list: every status allowed before, plus every status already in the table,
-- plus 'Sent directly' and 'Answered'. Nothing is removed, no row is changed, no table is dropped.
-- Run once in Supabase > SQL editor. Safe to run again.

begin;

do $$
declare
  v_list text[];
begin
  select array_agg(distinct s order by s) into v_list from (
    select unnest(array[
      'Draft', 'Submitted', 'Pending', 'Pending Review', 'Pending Approval', 'Pending DG Approval', 'Approved',
      'Approved by DG - Pending Account', 'Paid - Pending HR Filing', 'Paid', 'Completed', 'Rejected', 'Deleted', 'Cancelled',
      'Returned for correction', 'Returned by the Director General', 'Withdrawn by requester',
      'Sent directly', 'Answered']) as s
    union
    select distinct status from public.requests where status is not null
  ) x;

  alter table public.requests drop constraint if exists requests_status_check;
  execute format('alter table public.requests add constraint requests_status_check check (status = any (%L::text[]))', v_list);
  raise notice 'requests_status_check now allows % statuses: %', array_length(v_list, 1), array_to_string(v_list, ', ');
end $$;

commit;

-- Check (read only): shows the rule now in force.
select conname, pg_get_constraintdef(oid) as rule
  from pg_constraint where conrelid = 'public.requests'::regclass and conname = 'requests_status_check';
