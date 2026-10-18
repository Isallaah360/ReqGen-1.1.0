// ReqGen v4.6.4 — release lock: opening balances, IET account recalculation, over-allocation,
// one correction number for several figures, and passcode entry with the device keyboard.
import fs from "node:fs";
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const results = [];
const check = (label, ok) => results.push([label, !!ok]);
const sql = read("database/v4_6_4_finance_opening_balances.sql");
const fn = (name) => { const a = sql.indexOf(`create or replace function public.${name}`); return a < 0 ? "" : sql.slice(a, sql.indexOf("$$;", a)); };
const page = read("app/finance/integrity/page.tsx");
const pad = read("app/components/v4/PasscodePad.tsx");

// 1. SQL
check("Functions are backed up before they are replaced", sql.indexOf("insert into public.reqgen_function_backups") > 0 && sql.indexOf("insert into public.reqgen_function_backups") < sql.indexOf("create or replace function"));
check("Runs only after the v4.6.3 step", sql.includes("Run database/v4_6_3_finance_integrity_reset.sql first"));
check("One correction number may list Spent and Reserved together", sql.includes("drop constraint if exists reqgen_finance_corrections_correction_no_key") && sql.includes("create index if not exists reqgen_finance_corrections_no_idx"));
check("Integrity lists over-allocation and missing opening lines separately", fn("reqgen_finance_integrity").includes("'overallocated'") && fn("reqgen_finance_integrity").includes("'opening', 'low'"));
check("Integrity flags an allocation with no IET account", fn("reqgen_finance_integrity").includes("no IET account to pay from"));
const opening = fn("reqgen_finance_record_opening");
check("Opening balances: Auditor or Super Admin, reason required", opening.includes("Only the Auditor or the Super Admin can record opening balances") && opening.includes("at least 10 characters"));
check("Opening balances: one line only where none exists, amounts unchanged", opening.includes("not exists (select 1 from public.iet_bank_ledger g where g.subhead_id = s.id") && !/update public\.(subheads|iet_accounts)/.test(opening));
check("Opening balances: logged, audited and the DG / Auditor / Super Admin told", opening.includes("reqgen_finance_corrections") && opening.includes("reqgen_audit_write") && opening.includes("reqgen_transfer_notify"));
const accounts = fn("reqgen_finance_recalculate_accounts");
check("Account recalculation: Auditor or Super Admin, before/after kept, fund untouched", accounts.includes("Only the Auditor or the Super Admin can recalculate IET accounts") && accounts.includes("reqgen_finance_corrections") && !/total_fund\s*=/.test(accounts));
check("A correction number is taken only when something changes", accounts.includes("if v_no is null and") && opening.includes("return jsonb_build_object('ok', true, 'correction_no', null"));
check("Corrections and reversals write a ledger line only with a bank account", fn("reqgen_finance_correct").includes("if s.bank_account_id is not null") && fn("reqgen_reversal_approve").includes("bank_account_id is not null"));
check("Reset also clears request attachment checks and budget lines", fn("reqgen_reset_plan").includes("request_attachment_checks") && fn("reqgen_reset_plan").includes("reqgen_request_budget_lines"));
check("SQL ends with an all-OK verification table", /from v464_report order by[^;]*;\s*$/.test(sql.trim()));
check("SQL: routing engine untouched", !/create or replace function public\.(approve_request_step|reject_request_step|reqgen_next_route_step|build_request_route|reqgen_build_route_for_template|reqgen_save_department_route)\b/i.test(sql));
check("SQL: nothing dropped or deleted", !/drop (table|function)|delete from|truncate public\./i.test(sql));

// 2. Integrity page
check("Integrity page groups subheads, accounts, over-allocation, opening lines", ["Subheads (", "IET accounts (", "Given more than the fund (", "Opening balances to record ("].every((t) => page.includes(t)));
check("Integrity page: recalculate accounts and record opening balances with reason and 2FA", page.includes('rpc("reqgen_finance_recalculate_accounts"') && page.includes('rpc("reqgen_finance_record_opening"') && page.includes("confirmFresh(") && page.includes("reason.length < 10"));
check("Over-allocation is explained, never corrected automatically", page.includes("Nothing here is corrected automatically") && page.includes('href="/finance/manage-accounts"'));
check("Finance home counts differences without opening lines", read("lib/v4/summaries.ts").includes('.filter((x) => x.kind !== "opening")'));

// 3. Passcode entry
check("No on-screen number pad: one real numeric input", !/\[1, 2, 3|"1", "2", "3"|v4-pad-key/.test(pad) && pad.includes('inputMode="numeric"') && pad.includes('pattern="[0-9]*"') && pad.includes("maxLength={6}"));
check("Passcode input opens the keyboard on tap and takes numbers only", pad.includes("v4-pin-input") && pad.includes('replace(/\\D/g, "")') && read("app/v4/v4-theme.css").includes(".v4-pin-input"));
check("No show/hide eye over the passcode boxes", pad.includes('data-rg-reveal="off"') && read("app/components/PasswordReveal.tsx").includes(":not([data-rg-reveal])"));
check("Login and passcode set-up use the keyboard entry", read("app/login/page.tsx").includes("<PasscodePad") && read("app/profile/passcode/page.tsx").includes("<PasscodePad"));

check("Version 4.6.4 or a later 4.6 release", /REQGEN_SEMVER = "4\.6\.([4-9]|[1-9]\d)"/.test(read("lib/version.ts")) && /"version": "4\.6\.([4-9]|[1-9]\d)"/.test(read("package.json")));
check("No .env file shipped", !fs.existsSync(".env") || read(".gitignore").includes(".env"));

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.6.4 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.6.4 release lock: PASS (${results.length} checks).`);
