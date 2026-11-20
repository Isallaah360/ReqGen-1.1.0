-- =========================================================================
-- ReqGen v4.6.11 upgrade (brief 20 Nov 2026, section 6: speed for many users)
--
-- Adds an index to every column that ReqGen filters by owner, person,
-- department or request, where that column exists and has no index yet.
-- Nothing is dropped, renamed or changed. Safe to run twice: a second run
-- finds the indexes already there and does nothing.
--
-- Run it in Supabase > SQL Editor > New query > Run. The last line it prints
-- is "ReqGen v4.6.11 upgrade done".
-- =========================================================================

do $$
declare
  pair text[];
  t text;
  c text;
  made int := 0;
  wanted text[][] := array[
    array['requests','created_by'], array['requests','current_owner'], array['requests','department_id'],
    array['requests','subhead_id'], array['requests','assigned_account_officer_user_id'], array['requests','assigned_account_officer_id'],
    array['requests','direct_to'], array['requests','status'], array['requests','created_at'],
    array['request_history','request_id'], array['request_history','actor_id'],
    array['request_attachments','request_id'], array['request_attachment_checks','request_id'],
    array['notifications','user_id'], array['notifications','created_at'],
    array['profiles','department_id'], array['profile_roles','profile_id'], array['profile_roles','user_id'],
    array['payment_vouchers','request_id'], array['payment_vouchers','iet_account_id'], array['payment_vouchers','created_by'],
    array['payment_voucher_counter_signatories','voucher_id'], array['payment_voucher_counter_signatories','user_id'],
    array['subheads','department_id'], array['subheads','iet_account_id'],
    array['iet_account_officer_assignments','officer_user_id'], array['iet_account_officer_assignments','iet_account_id'],
    array['department_account_routing','department_id'],
    array['sms_otps','user_id'], array['sms_logs','request_id'],
    array['reqgen_trusted_devices','user_id'], array['reqgen_webauthn_credentials','user_id'],
    array['reqgen_audit_log','actor_id'], array['reqgen_audit_log','created_at'],
    array['reqgen_request_drafts','user_id'], array['reqgen_request_drafts','created_by'],
    array['reqgen_request_budget_lines','request_id'], array['reqgen_pv_attachments','voucher_id'],
    array['reqgen_pv_transfer_schedule','voucher_id'], array['reqgen_transfers','created_by'],
    array['registry_correspondence','department_id'], array['reqgen_officer_availability','user_id'],
    array['reqgen_department_stage_officers','department_id'], array['reqgen_payee_bank_accounts','user_id']
  ];
begin
  foreach pair slice 1 in array wanted loop
    t := pair[1]; c := pair[2];
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = c)
       and not exists (
         select 1 from pg_index i
         join pg_class tc on tc.oid = i.indrelid
         join pg_namespace n on n.oid = tc.relnamespace
         join pg_attribute a on a.attrelid = tc.oid and a.attnum = i.indkey[0]
         where n.nspname = 'public' and tc.relname = t and a.attname = c)
    then
      execute format('create index if not exists %I on public.%I (%I)', 'rg_idx_' || t || '_' || c, t, c);
      made := made + 1;
    end if;
  end loop;
  raise notice 'ReqGen v4.6.11: % new index(es).', made;
end $$;

select 'ReqGen v4.6.11 upgrade done' as result;
