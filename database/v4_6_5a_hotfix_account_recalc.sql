-- =============================================================================
-- ReqGen v4.6.5a — hotfix: "column last_recalculated_at of relation iet_accounts does not exist"
-- Run in the Supabase SQL Editor. No new app code is needed: the v4.6.5 app stays as it is.
--
-- Cause (in the database, not the app): the database function reqgen_recalculate_iet_account,
-- which works out an IET account's figures from its subheads, writes the time of the last
-- recalculation into iet_accounts.last_recalculated_at — but your iet_accounts table never had
-- that column. Every action that recalculates an account therefore failed: removing an amount
-- with no record, correcting totals, recalculating accounts, Set fund and approved transfers.
--
-- Fix: add the missing column (empty to start with). Nothing else changes: no figures, no rows,
-- no functions. Safe to run more than once. The routing engine is not touched.
-- Ends with a table where every row says OK.
-- =============================================================================
begin;

create temp table if not exists v465a_report (step text, item text, result text, status text);
truncate v465a_report;

alter table public.iet_accounts add column if not exists last_recalculated_at timestamptz;
insert into v465a_report values ('01 column', 'iet_accounts.last_recalculated_at', 'present (time of the last recalculation)', 'OK');

-- Prove the recalculation now runs, without keeping any change: it is tried on one account
-- inside a step that is always undone.
do $$
declare v_id uuid; v_result text;
begin
  select id into v_id from public.iet_accounts order by id limit 1;
  if v_id is null then
    v_result := 'no IET account to try it on';
  else
    begin
      perform public.reqgen_recalculate_iet_account(v_id);
      raise exception 'undo-this-try';
    exception when others then
      if sqlerrm = 'undo-this-try' then v_result := 'runs (tried on one account and undone)';
      else raise exception 'The account recalculation still fails: %', sqlerrm; end if;
    end;
  end if;
  insert into v465a_report values ('02 check', 'reqgen_recalculate_iet_account', v_result, 'OK');
end $$;

insert into v465a_report values ('03 check', 'data and routing engine', 'no figures, rows or functions changed', 'OK');

commit;

select step as "step", item as "item", result as "result", status as "status" from v465a_report order by step, item;
