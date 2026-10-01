-- ============================================================================
-- ReqGen v3.0.4 — Request privacy & finance lock-down
--
-- WHAT THIS DOES (policy and function changes only — NO table data is changed,
-- moved or deleted; every request, voucher, transfer and file stays exactly
-- as it is):
--
--  1. REQUESTS — a person can read a request's full row ONLY if they:
--       created it · it is routed to them (current owner) · they already acted
--       on it (request_history) · they are its assigned Account Officer · they
--       are named in final_visibility_user_ids.
--     Admin and Auditor follow the SAME rule (no oversight bypass).
--     Admin/Auditor can no longer edit or delete other people's requests.
--  2. REQUEST HISTORY, ATTACHMENTS, ATTACHMENT CHECKS and attachment FILES
--     follow the same rule.
--  3. CONTENT-FREE REGISTERS for Registry, Reports, Audit Centre and Finance:
--       reqgen_request_register · reqgen_request_movements · reqgen_voucher_register
--     They return numbers, stages, statuses, departments, subheads, amounts,
--     people and dates — never titles, details, comments, attachments or
--     signatures — and only to Admin, Auditor, Registry, Registrar and
--     Account Officers (plus PV signers for the voucher register).
--  4. PAYMENT VOUCHERS — removes "any logged-in user can read/update" rules.
--     Read: finance roles, PV signers, anyone who prepared/checked/signed it,
--     and the requester of the linked request. Change: Account Officers,
--     Admin and the officer it is currently waiting on. Auditor: read-only.
--  5. ACCOUNT TRANSFERS — removes "anyone can read/create/update" rules.
--     Read: Admin, Auditor, Account Officers. Create/change: Account Officers, Admin.
--  6. SIGNATURES — removes the rule that let anonymous visitors LIST every
--     signature file. (Signature images still display exactly as today.)
--
-- SAFETY:
--  * Runs as ONE transaction. A pre-flight check runs first; if any open
--    request has no current owner (its approver would lose sight of it), the
--    script STOPS and nothing is changed. Send me the message if that happens.
--  * Re-runnable: every object is dropped-if-exists and recreated.
--  * Ends with a verification table. Every row should say OK.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Pre-flight
-- ---------------------------------------------------------------------------
do $$
declare
  orphaned integer;
begin
  select count(*) into orphaned
  from public.requests r
  where r.current_owner is null
    and r.assigned_account_officer_id is null
    and r.assigned_account_officer_user_id is null
    -- "Approved" is NOT final: approved requests wait at the Account stage.
    and lower(coalesce(r.current_stage, '')) not in ('completed','rejected','deleted','cancelled','paid','closed','draft')
    and lower(coalesce(r.status, '')) not in ('completed','rejected','deleted','cancelled','paid','closed','draft');

  if orphaned > 0 then
    raise exception 'ReqGen v3.0.4 STOPPED — nothing was changed. % open request(s) have no current_owner, so their approvers would lose access. Please send this message to your developer.', orphaned;
  end if;

  if to_regprocedure('public.current_user_has_any_role(text[])') is null
     or to_regprocedure('public.current_profile_role_key()') is null then
    raise exception 'ReqGen v3.0.4 STOPPED — nothing was changed. Expected role helper functions are missing.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Helper functions (SECURITY DEFINER so policies never recurse)
-- ---------------------------------------------------------------------------
create or replace function public.reqgen_user_has_any_role(p_keys text[])
returns boolean
language sql stable security definer set search_path = public
as $fn$
  select coalesce(public.current_user_has_any_role(p_keys), false)
      or coalesce(public.current_profile_role_key() = any(p_keys), false);
$fn$;

create or replace function public.reqgen_user_acted_on_request(p_request_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $fn$
  select exists (
    select 1 from public.request_history h
    where h.request_id = p_request_id and h.action_by = auth.uid()
  );
$fn$;

create or replace function public.reqgen_can_open_request(p_request_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $fn$
  select exists (
    select 1 from public.requests r
    where r.id = p_request_id
      and (
        r.created_by = auth.uid()
        or r.current_owner = auth.uid()
        or r.assigned_account_officer_id = auth.uid()
        or r.assigned_account_officer_user_id = auth.uid()
        or auth.uid()::text = any(coalesce(r.final_visibility_user_ids::text[], array[]::text[]))
      )
  ) or public.reqgen_user_acted_on_request(p_request_id);
$fn$;

revoke all on function public.reqgen_user_has_any_role(text[]) from public, anon;
revoke all on function public.reqgen_user_acted_on_request(uuid) from public, anon;
revoke all on function public.reqgen_can_open_request(uuid) from public, anon;
grant execute on function public.reqgen_user_has_any_role(text[]) to authenticated;
grant execute on function public.reqgen_user_acted_on_request(uuid) to authenticated;
grant execute on function public.reqgen_can_open_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. REQUESTS
-- ---------------------------------------------------------------------------
drop policy if exists "ReqGen request visibility for users and approvers" on public.requests;
drop policy if exists "requests_select_creator_or_owner" on public.requests;
drop policy if exists "requests_select_policy" on public.requests;
drop policy if exists "requests_update_policy" on public.requests;
drop policy if exists "requests_delete_policy" on public.requests;
drop policy if exists "reqgen_v304_requests_select" on public.requests;
drop policy if exists "reqgen_v304_requests_update" on public.requests;
drop policy if exists "reqgen_v304_requests_delete" on public.requests;

create policy "reqgen_v304_requests_select" on public.requests
  for select to authenticated
  using (
    created_by = auth.uid()
    or current_owner = auth.uid()
    or assigned_account_officer_id = auth.uid()
    or assigned_account_officer_user_id = auth.uid()
    or auth.uid()::text = any(coalesce(final_visibility_user_ids::text[], array[]::text[]))
    or public.reqgen_user_acted_on_request(id)
  );

-- Requester may edit while still at HOD/Director; otherwise only the current owner.
create policy "reqgen_v304_requests_update" on public.requests
  for update to authenticated
  using (
    (created_by = auth.uid() and current_stage = any (array['HOD','Director']))
    or current_owner = auth.uid()
  )
  with check (
    created_by is not null
    and current_stage = any (array['Draft','HOD','Director','HR','Registry','DG','Account','Completed','Rejected'])
    and status = any (array['Draft','Submitted','In Review','Approved','Rejected','Completed','Paid'])
  );

-- Only the requester, and only before approval has started.
create policy "reqgen_v304_requests_delete" on public.requests
  for delete to authenticated
  using (created_by = auth.uid() and current_stage = any (array['HOD','Director']));

-- ---------------------------------------------------------------------------
-- 3. REQUEST HISTORY / ATTACHMENTS / ATTACHMENT CHECKS
-- ---------------------------------------------------------------------------
drop policy if exists "history_select_related" on public.request_history;
drop policy if exists "request_history_select_policy" on public.request_history;
drop policy if exists "reqgen_v304_history_select" on public.request_history;
create policy "reqgen_v304_history_select" on public.request_history
  for select to authenticated
  using (public.reqgen_can_open_request(request_id));

drop policy if exists "Users can view request attachments" on public.request_attachments;
drop policy if exists "Officers can verify request attachments" on public.request_attachments;
drop policy if exists "reqgen_v304_attachments_select" on public.request_attachments;
drop policy if exists "reqgen_v304_attachments_verify" on public.request_attachments;
create policy "reqgen_v304_attachments_select" on public.request_attachments
  for select to authenticated
  using (uploaded_by = auth.uid() or public.reqgen_can_open_request(request_id));
create policy "reqgen_v304_attachments_verify" on public.request_attachments
  for update to authenticated
  using (exists (select 1 from public.requests r where r.id = request_attachments.request_id and r.current_owner = auth.uid()))
  with check (exists (select 1 from public.requests r where r.id = request_attachments.request_id and r.current_owner = auth.uid()));

drop policy if exists "Users can view attachment checks" on public.request_attachment_checks;
drop policy if exists "Approval chain can insert own attachment checks" on public.request_attachment_checks;
drop policy if exists "reqgen_v304_checks_select" on public.request_attachment_checks;
drop policy if exists "reqgen_v304_checks_insert" on public.request_attachment_checks;
create policy "reqgen_v304_checks_select" on public.request_attachment_checks
  for select to authenticated
  using (checked_by = auth.uid() or public.reqgen_can_open_request(request_id));
create policy "reqgen_v304_checks_insert" on public.request_attachment_checks
  for insert to authenticated
  with check (
    checked_by = auth.uid()
    and exists (select 1 from public.requests r where r.id = request_attachment_checks.request_id and r.current_owner = auth.uid())
  );

-- Attachment FILES (storage). CASE guarantees the uuid cast only runs on a
-- valid folder name.
drop policy if exists "ReqGen users can view request attachments" on storage.objects;
drop policy if exists "ReqGen users can update request attachments" on storage.objects;
drop policy if exists "ReqGen users can delete request attachments" on storage.objects;
drop policy if exists "reqgen_v304_attachment_files_select" on storage.objects;
drop policy if exists "reqgen_v304_attachment_files_update" on storage.objects;
drop policy if exists "reqgen_v304_attachment_files_delete" on storage.objects;

create policy "reqgen_v304_attachment_files_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'request-attachments'
    and case
          when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then public.reqgen_can_open_request(((storage.foldername(name))[1])::uuid)
          else false
        end
  );
create policy "reqgen_v304_attachment_files_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'request-attachments'
    and case
          when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then exists (select 1 from public.requests r where r.id = ((storage.foldername(name))[1])::uuid and r.created_by = auth.uid())
          else false
        end
  )
  with check (bucket_id = 'request-attachments');
create policy "reqgen_v304_attachment_files_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'request-attachments'
    and case
          when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then exists (select 1 from public.requests r where r.id = ((storage.foldername(name))[1])::uuid and r.created_by = auth.uid())
          else false
        end
  );

-- Signatures: stop anonymous listing of every signature file.
drop policy if exists "Public can read signatures" on storage.objects;

-- ---------------------------------------------------------------------------
-- 4. PAYMENT VOUCHERS
-- ---------------------------------------------------------------------------
drop policy if exists "payment_vouchers_select_policy" on public.payment_vouchers;
drop policy if exists "payment_vouchers_update_policy" on public.payment_vouchers;
drop policy if exists "payment_vouchers_insert_policy" on public.payment_vouchers;
drop policy if exists "voucher select finance roles" on public.payment_vouchers;
drop policy if exists "voucher update finance roles" on public.payment_vouchers;
drop policy if exists "voucher insert finance roles" on public.payment_vouchers;
drop policy if exists "reqgen_v304_vouchers_select" on public.payment_vouchers;
drop policy if exists "reqgen_v304_vouchers_insert" on public.payment_vouchers;
drop policy if exists "reqgen_v304_vouchers_update" on public.payment_vouchers;

create policy "reqgen_v304_vouchers_select" on public.payment_vouchers
  for select to authenticated
  using (
    public.reqgen_user_has_any_role(array['admin','auditor','account','accounts','accountofficer','pvsigner','pvcountersigner'])
    or current_signing_owner = auth.uid()
    or auth.uid() in (prepared_by, created_by, checked_by, authorized_by, cheque_signed_by, cheque_counter_signed_by)
    or (request_id is not null and exists (select 1 from public.requests r where r.id = payment_vouchers.request_id and r.created_by = auth.uid()))
  );

create policy "reqgen_v304_vouchers_insert" on public.payment_vouchers
  for insert to authenticated
  with check (public.reqgen_user_has_any_role(array['admin','account','accounts','accountofficer']));

create policy "reqgen_v304_vouchers_update" on public.payment_vouchers
  for update to authenticated
  using (
    public.reqgen_user_has_any_role(array['admin','account','accounts','accountofficer'])
    or current_signing_owner = auth.uid()
  )
  with check (
    public.reqgen_user_has_any_role(array['admin','account','accounts','accountofficer','pvsigner','pvcountersigner'])
    or current_signing_owner = auth.uid()
    or auth.uid() in (checked_by, authorized_by, cheque_signed_by, cheque_counter_signed_by)
  );

-- ---------------------------------------------------------------------------
-- 5. ACCOUNT TRANSFERS
-- ---------------------------------------------------------------------------
drop policy if exists "account_transfers_insert_authenticated" on public.account_transfers;
drop policy if exists "account_transfers_insert_policy" on public.account_transfers;
drop policy if exists "account_transfers_read_authenticated" on public.account_transfers;
drop policy if exists "account_transfers_select_policy" on public.account_transfers;
drop policy if exists "account_transfers_update_policy" on public.account_transfers;
drop policy if exists "reqgen_v304_transfers_select" on public.account_transfers;
drop policy if exists "reqgen_v304_transfers_insert" on public.account_transfers;
drop policy if exists "reqgen_v304_transfers_update" on public.account_transfers;

create policy "reqgen_v304_transfers_select" on public.account_transfers
  for select to authenticated
  using (public.reqgen_user_has_any_role(array['admin','auditor','account','accounts','accountofficer']));
create policy "reqgen_v304_transfers_insert" on public.account_transfers
  for insert to authenticated
  with check (
    public.reqgen_user_has_any_role(array['admin','account','accounts','accountofficer'])
    and (created_by is null or created_by = auth.uid())
  );
create policy "reqgen_v304_transfers_update" on public.account_transfers
  for update to authenticated
  using (public.reqgen_user_has_any_role(array['admin','account','accounts','accountofficer']))
  with check (public.reqgen_user_has_any_role(array['admin','account','accounts','accountofficer']));

-- ---------------------------------------------------------------------------
-- 6. CONTENT-FREE REGISTERS (read-only)
-- ---------------------------------------------------------------------------
drop function if exists public.reqgen_request_register(integer);
create function public.reqgen_request_register(p_limit integer default 5000)
returns table (
  id uuid, request_no text, status text, current_stage text, current_owner uuid, created_by uuid,
  requester_name text, dept_id uuid, subhead_id uuid, request_type text, personal_category text,
  amount numeric, funds_state text, funds_reserved_amount numeric,
  assigned_account_officer_id uuid, assigned_account_officer_name text,
  created_at timestamptz, updated_at timestamptz, closed_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $fn$
begin
  if not public.reqgen_user_has_any_role(array['admin','auditor','registry','registrar','account','accounts','accountofficer']) then
    return;
  end if;
  return query
    select r.id, r.request_no::text, r.status::text, r.current_stage::text, r.current_owner, r.created_by,
           r.requester_name::text, r.dept_id, r.subhead_id, r.request_type::text, r.personal_category::text,
           r.amount::numeric, r.funds_state::text, r.funds_reserved_amount::numeric,
           r.assigned_account_officer_id, r.assigned_account_officer_name::text,
           r.created_at::timestamptz, r.updated_at::timestamptz, r.closed_at::timestamptz
    from public.requests r
    order by r.created_at desc
    limit greatest(1, least(coalesce(p_limit, 5000), 20000));
end;
$fn$;

drop function if exists public.reqgen_request_movements(integer);
create function public.reqgen_request_movements(p_limit integer default 10000)
returns table (
  id uuid, request_id uuid, action_type text, from_stage text, to_stage text,
  actor_name text, actor_role_key text, actor_role_name text, action_by uuid, created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $fn$
begin
  if not public.reqgen_user_has_any_role(array['admin','auditor','registry','registrar','account','accounts','accountofficer']) then
    return;
  end if;
  return query
    select h.id, h.request_id, h.action_type::text, h.from_stage::text, h.to_stage::text,
           h.actor_name::text, h.actor_role_key::text, h.actor_role_name::text, h.action_by, h.created_at::timestamptz
    from public.request_history h
    order by h.created_at desc
    limit greatest(1, least(coalesce(p_limit, 10000), 50000));
end;
$fn$;

drop function if exists public.reqgen_voucher_register(integer);
create function public.reqgen_voucher_register(p_limit integer default 5000)
returns table (
  id uuid, request_id uuid, voucher_no text, status text, voucher_type text, voucher_origin text,
  signing_stage text, total_amount numeric, amount numeric, dept_id uuid, subhead_id uuid, created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $fn$
begin
  if not public.reqgen_user_has_any_role(array['admin','auditor','registry','registrar','account','accounts','accountofficer','pvsigner','pvcountersigner']) then
    return;
  end if;
  return query
    select v.id, v.request_id, v.voucher_no::text, v.status::text, v.voucher_type::text, v.voucher_origin::text,
           v.signing_stage::text, v.total_amount::numeric, v.amount::numeric, v.dept_id, v.subhead_id, v.created_at::timestamptz
    from public.payment_vouchers v
    order by v.created_at desc
    limit greatest(1, least(coalesce(p_limit, 5000), 20000));
end;
$fn$;

revoke all on function public.reqgen_request_register(integer) from public, anon;
revoke all on function public.reqgen_request_movements(integer) from public, anon;
revoke all on function public.reqgen_voucher_register(integer) from public, anon;
grant execute on function public.reqgen_request_register(integer) to authenticated;
grant execute on function public.reqgen_request_movements(integer) to authenticated;
grant execute on function public.reqgen_voucher_register(integer) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- 7. Verification — every row should read OK
-- ---------------------------------------------------------------------------
select 'requests: no role-wide read policy remains' as check_item,
       case when exists (select 1 from pg_policies where schemaname='public' and tablename='requests'
                         and cmd='SELECT' and (qual ilike '%''admin''%' or qual ilike '%''auditor''%' or qual ilike '%''dg''%'))
            then 'CHECK' else 'OK' end as status
union all
select 'requests: privacy policy installed',
       case when exists (select 1 from pg_policies where schemaname='public' and tablename='requests' and policyname='reqgen_v304_requests_select') then 'OK' else 'MISSING' end
union all
select 'payment_vouchers: no open (true) policies',
       case when exists (select 1 from pg_policies where schemaname='public' and tablename='payment_vouchers' and (qual='true' or with_check='true')) then 'CHECK' else 'OK' end
union all
select 'account_transfers: no open (true) policies',
       case when exists (select 1 from pg_policies where schemaname='public' and tablename='account_transfers' and (qual='true' or with_check='true')) then 'CHECK' else 'OK' end
union all
select 'signatures: anonymous listing removed',
       case when exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Public can read signatures') then 'CHECK' else 'OK' end
union all
select 'registers installed (3)',
       case when (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='public' and p.proname in ('reqgen_request_register','reqgen_request_movements','reqgen_voucher_register')) = 3
            then 'OK' else 'MISSING' end
union all
select 'workflow RPC ' || p.proname,
       case when p.prosecdef then 'OK (runs with owner rights)' else 'INFO: runs as caller' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('approve_request_step','reject_request_step','submit_request_with_reservation','assign_request_subhead_and_reserve',
                    'sign_payment_voucher_cheque','counter_sign_payment_voucher_cheque','update_payment_voucher_status',
                    'generate_multi_payment_voucher','create_manual_payment_voucher','get_payment_vouchers','get_payment_voucher_detail');
