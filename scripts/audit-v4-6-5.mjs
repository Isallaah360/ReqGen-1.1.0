// ReqGen v4.6.5 — release lock: the Super Admin's finance powers, and removing amounts that
// have no record behind them from the Transaction Centre.
import fs from "node:fs";
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const results = [];
const check = (label, ok) => results.push([label, !!ok]);
const sql = read("database/v4_6_5_super_admin_finance.sql");
const centre = read("app/finance/transactions-centre/page.tsx");
const powers = read("lib/v4/financePowers.ts");

check("SQL backs up the previous Super Admin rule first", sql.indexOf("insert into public.reqgen_function_backups") > 0 && sql.indexOf("insert into public.reqgen_function_backups") < sql.indexOf("create or replace function public.reqgen_is_super_admin"));
check("Super Admin = active + holds Super Admin + acting as Super Admin", sql.includes("reqgen_pv_user_has_role(p.id, array['admin', 'superadmin'])") && sql.includes("coalesce(p.is_active, true)") && sql.includes("reqgen_active_role_key() in ('admin', 'superadmin')"));
// v4.6.6 changes who counts (only ietreqgen@gmail.com and the Developer); v4.6.5's own file is unchanged
check("v4.6.5 rule kept in its own file; v4.6.6 narrows it to the system accounts", sql.includes("coalesce(p.system_account, '') <> 'developer'") && read("database/v4_6_6_system_accounts.sql").includes("create or replace function public.reqgen_is_super_admin"));
check("reqgen_finance_powers says what the person may do and why not", sql.includes("create or replace function public.reqgen_finance_powers") && sql.includes("Switch \"Acting as\" (top right) to Super Admin") && sql.includes("'can_correct'") && sql.includes("'can_reset'"));
check("SQL lists who will be treated as Super Admin", sql.includes("people who will be treated as Super Admin"));
check("SQL ends with an all-OK verification table", /from v465_report order by[^;]*;\s*$/.test(sql.trim()));
check("SQL: routing engine untouched, no data changed", !/create or replace function public\.(approve_request_step|reject_request_step|reqgen_next_route_step|build_request_route|reqgen_build_route_for_template|reqgen_save_department_route)\b/i.test(sql) && !/\b(update|delete from|drop table|truncate) public\./i.test(sql));

check("Pages ask the database who may act (no client-side guess first)", powers.includes('rpc("reqgen_finance_powers")') && ["app/finance/integrity/page.tsx", "app/admin/finance-reset/page.tsx", "app/finance/transactions-centre/page.tsx"].every((f) => read(f).includes("useFinancePowers(")));
check("Integrity page shows the exact reason when someone cannot act", read("app/finance/integrity/page.tsx").includes("powers.reason"));
check("Reset and restore server guard uses the same database rule", read("lib/server/superAdmin.ts").includes('rpc("reqgen_finance_powers")') && !read("lib/server/superAdmin.ts").includes('p.system_account !== "superadmin"'));

check("Finance home: Spent opens the Transaction Centre on spending", read("lib/v4/summaries.ts").includes('href: "/finance/transactions-centre?effect=Spent"'));
check("Transaction Centre opens on the effect in the address", centre.includes('params.get("effect")'));
check("Transaction Centre lists amounts with no record behind them", centre.includes('rpc("reqgen_finance_integrity")') && centre.includes("Recorded with no record behind it"));
check("Removing one: Auditor or Super Admin, reason, fresh 2FA, through the logged correction", centre.includes("powers.canCorrect") && centre.includes("reason.length < 10") && centre.includes('confirmFresh("remove the amount that has no record")') && centre.includes('rpc("reqgen_finance_correct", { p_subhead_ids: [removing.row.subject_id]'));
check("Real records are still reversed, never deleted", centre.includes("reqgen_reversal_start") && !/from\("(requests|payment_vouchers|iet_bank_ledger)"\)\.delete/.test(centre));

check("Version 4.6.5 or a later 4.6 release", /REQGEN_SEMVER = "4\.6\.([5-9]|[1-9]\d)"/.test(read("lib/version.ts")) && /"version": "4\.6\.([5-9]|[1-9]\d)"/.test(read("package.json")));
check("No .env file shipped", !fs.existsSync(".env") || read(".gitignore").includes(".env"));

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.6.5 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.6.5 release lock: PASS (${results.length} checks).`);
