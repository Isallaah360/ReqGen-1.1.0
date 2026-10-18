// ReqGen v4.6.3 — release lock: finance integrity, Transaction Centre, reversals, Financial Reset,
// verified backups, all-or-nothing restore, inactive accounts refused, last v3-look pages rebuilt.
import fs from "node:fs";
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const results = [];
const check = (label, ok) => results.push([label, !!ok]);
const sql = read("database/v4_6_3_finance_integrity_reset.sql");
const v4 = (f) => /<(V4Page|MotherPage)\b/.test(read(f));

// 1. Integrity (the ₦3,000,000 DIN FORD case)
check("One rule for spent: released official requests + posted manual vouchers, reversals excluded", sql.includes("create or replace function public.reqgen_subhead_supported") && sql.includes("reqgen_manual_voucher_counts") && sql.includes("p_reversed_at is null"));
check("recalculate_subhead_finance is replaced only after a backup of the old version", sql.indexOf("insert into public.reqgen_function_backups") < sql.indexOf("create or replace function public.recalculate_subhead_finance"));
check("Integrity compares subheads, accounts, ledger, orphans and double counting", ["'subhead'", "'account'", "'orphan'", "'double'"].every((k) => sql.includes(k)) && sql.includes("create or replace function public.reqgen_finance_integrity"));
check("Correction: Auditor or Super Admin, reason, before/after kept, no bank credit", sql.includes("Only the Auditor or the Super Admin can correct stored finance totals") && sql.includes("reqgen_finance_corrections") && sql.includes("'System Recalculation'") && !/update public\.iet_accounts set (total_fund|balance)/.test(sql.slice(sql.indexOf("function public.reqgen_finance_correct"), sql.indexOf("insert into v463_report values ('04 correct'"))));
check("Finance Integrity page: list, correct with reason and 2FA, history", v4("app/finance/integrity/page.tsx") && read("app/finance/integrity/page.tsx").includes('rpc("reqgen_finance_correct"') && read("app/finance/integrity/page.tsx").includes("confirmFresh("));
check("Finance home shows differences to check", read("lib/v4/summaries.ts").includes('rpc("reqgen_finance_integrity"') && read("lib/v4/summaries.ts").includes('"/finance/integrity"'));

// 2. Transaction Centre and reversals
check("Transaction Centre: one list of every money movement", v4("app/finance/transactions-centre/page.tsx") && read("app/finance/transactions-centre/page.tsx").includes('rpc("reqgen_finance_ledger"'));
check("Reversals: Account Officer → Auditor → DG, starter cannot check, one live reversal per record", ["reqgen_reversal_start", "reqgen_reversal_check", "reqgen_reversal_approve"].every((f) => sql.includes(`function public.${f}`)) && sql.includes("cannot also check it") && sql.includes("reqgen_finance_reversals_live"));
check("A reversal never credits a bank account", sql.includes("the money in the bank (total fund) is NOT credited") && read("app/finance/transactions-centre/page.tsx").includes("never adds money to a bank account"));
check("DG approves reversals with a fresh fingerprint or 2FA code", read("app/finance/transactions-centre/page.tsx").includes('confirmFresh("approve and stamp this reversal")'));

// 3. Financial Reset
check("Reset: Super Admin only (not the Developer), active, acting as Super Admin", sql.includes("p.system_account = 'superadmin'") && read("lib/server/superAdmin.ts").includes("The Developer and other administrators cannot"));
check("Reset needs a verified backup from the last hour, RESET FINANCE and a reason", sql.includes("v_backup.verified") && sql.includes("interval '60 minutes'") && sql.includes("'RESET FINANCE'"));
check("Reset is one transaction, checked to 0.00, recorded and logged once", sql.includes("did not bring every figure to zero") && sql.includes("insert into public.reqgen_finance_resets") && sql.includes("reqgen.bulk_reset"));
check("Reset keeps staff, departments, subhead and account identities", !/delete from public\.(profiles|departments|subheads|iet_accounts|profile_roles|app_settings|reqgen_audit_log)\b/.test(sql) && !/drop table(?! if exists)/i.test(sql));
check("Reset preview shows what would block it", sql.includes("part := 'blocker'"));
check("Reset server route: fresh 2FA, backup then reset as the Super Admin", read("app/api/finance/reset/route.ts").includes("superAdminFromRequest(") && read("app/api/finance/reset/route.ts").includes('mode: "pre-reset"') && read("app/api/finance/reset/route.ts").includes('rpc("reqgen_finance_reset"'));
check("Financial Reset page: scopes, preview, backup, typed confirmation, history", v4("app/admin/finance-reset/page.tsx") && ["reqgen_finance_reset_preview", "RESET FINANCE", "Take a verified backup", "Resets done"].every((t) => read("app/admin/finance-reset/page.tsx").includes(t)));

// 4. Backups and restore
check("Every stored backup is read back and checked before it is marked verified", read("lib/server/backupStore.ts").includes("verifyStored(") && read("lib/server/backupStore.ts").includes("verified: !problem"));
check("Restore: Super Admin with a fresh 2FA code, written in one transaction", read("app/api/backup/restore/route.ts").includes("superAdminFromRequest(") && read("app/api/backup/restore/route.ts").includes('rpc("reqgen_backup_restore"') && sql.includes("grant execute on function public.reqgen_backup_restore(jsonb, text) to service_role"));

// 5. Access
check("Inactive or unverifiable accounts are refused by every server route", ["lib/server/staffAuth.ts", "lib/server/adminAuth.ts", "app/api/admin/users/route.ts", "app/api/pv/remind/route.ts", "app/api/registry/remind/route.ts", "app/api/otp/request-submission/send/route.ts", "app/api/otp/request-submission/verify/route.ts", "app/api/notifications/sms/request-event/route.ts", "app/api/notifications/sms/request-approval/route.ts"].every((f) => read(f).includes("accountProblem")));
const perm = read("lib/permissions.ts");
check("Access: Integrity and Transaction Centre for Finance, DG office, Auditor, Super Admin; Reset under Administration", perm.includes('{ prefix: "/finance/integrity"') && perm.includes('{ prefix: "/finance/transactions-centre"') && perm.includes('{ prefix: "/admin", roles: ["admin"] }'));
check("Route registry lists the new pages", ["/finance/integrity", "/finance/transactions-centre", "/admin/finance-reset"].every((p) => read("lib/routeRegistry.ts").includes(`"pattern": "${p}"`)));

// 6. No v3 look left
const rebuilt = ["app/profile/details/page.tsx", "app/profile/access/page.tsx", "app/profile/activity/page.tsx", "app/profile/setup/page.tsx", "app/profile/security/replace-authenticator/page.tsx", "app/change-password/page.tsx", "app/dashboard/activity/page.tsx", "app/docs/page.tsx"];
check("Remaining v3-look pages rebuilt on the v4 kit", rebuilt.every(v4) && rebuilt.every((f) => !/className="[^"]*(bg-slate|rounded-3xl|rg-profile)/.test(read(f))));
check("Public pages use the v4 public card", ["app/signup/page.tsx", "app/reset-password/page.tsx", "app/unauthorized/page.tsx"].every((f) => read(f).includes("PublicAuthShell") && !read(f).includes("auth-field")));
check("Old Finance overview / vouchers / audit addresses forward to their v4 page", read("app/finance/overview/page.tsx").includes('redirect("/finance")') && read("app/finance/vouchers/page.tsx").includes('redirect("/payment-vouchers")') && read("app/finance/audit/page.tsx").includes('redirect("/finance/integrity")'));
check("No unused v3 files remain", !fs.existsSync("app/components/registry/RegistryCentreWorkspace.tsx") && !fs.existsSync("app/finance/_components/FinanceOperationsWorkspace.tsx") && !fs.existsSync("app/components/AuthenticatorQr.tsx"));
check("v4.css is not edited by hand (theme additions live in v4-theme.css)", !read("app/v4/v4.css").includes("v4-brand-dark); box-shadow: inset 3px"));

check("SQL ends with an all-OK verification table", /from v463_report order by[^;]*;\s*$/.test(sql.trim()));
check("SQL: routing engine untouched", !/create or replace function public\.(approve_request_step|reject_request_step|reqgen_next_route_step|build_request_route|reqgen_build_route_for_template|reqgen_save_department_route)\b/i.test(sql));
check("Version 4.6.3 or a later 4.6 release", /REQGEN_SEMVER = "4\.6\.([3-9]|[1-9]\d)"/.test(read("lib/version.ts")) && /"version": "4\.6\.([3-9]|[1-9]\d)"/.test(read("package.json")));
check("No .env file shipped", !fs.existsSync(".env") || read(".gitignore").includes(".env"));

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.6.3 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.6.3 release lock: PASS (${results.length} checks).`);
