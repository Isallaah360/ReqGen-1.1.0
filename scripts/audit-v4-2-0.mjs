// ReqGen v4.2.0 — release lock: Finance (mock-ups 36–45): processing, accounts,
// assignments, budget & subheads, ledgers, transfers, settings and the treat page.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
const exists = (f) => fs.existsSync(f);
const results = [];
const check = (label, ok) => results.push([label, !!ok]);

const pages = ["", "/processing", "/manage-accounts", "/manage-accounts/assign", "/subheads", "/subheads/[id]", "/transactions", "/account-transfers", "/settings", "/request/[id]"];
check("Every Finance page exists", pages.every((p) => exists(`app/finance${p}/page.tsx`)));
check("Finance pages use the v4 kit (V4Page / MotherPage), not the legacy shell", pages.slice(1).every((p) => /V4Page|MotherPage/.test(read(`app/finance${p}/page.tsx`))) && read("app/finance/page.tsx").includes("<MotherPage"));
const mods = read("lib/v4/modules.ts");
check("Finance pages are v4-native (no legacy wrapper)", mods.includes("account-transfers|settings)$/") && mods.includes("/^\\/finance\\/request\\/[^/]+$/"));
check("Old ledger pages open the one Ledgers page", read("app/finance/account-ledger/page.tsx").includes("/finance/transactions?view=") && read("app/finance/subhead-ledger/page.tsx").includes("/finance/transactions?view="));

const fin = read("lib/v4/finance.ts");
check("Account lists show the name, with the bank in small grey text", fin.includes("export function accountName") && fin.includes("export function accountSub"));
check("One subhead rule everywhere: left = allocation − reserved − spent", fin.includes("num(s.approved_allocation) - subheadUsed(s)") && fin.includes("num(s.expenditure) + num(s.reserved_amount)"));
check("Financial year runs September to August", fin.includes("d.getMonth() >= 8"));
check("Payment methods: Transfer, Cheque, Cash only (no POS)", fin.includes('"Transfer" | "Cheque" | "Cash"') && !/"POS"/.test(fin) && !read("app/finance/settings/page.tsx").includes('"POS"'));

check("Budget & Subheads hidden from positions that may not see balances", read("app/finance/subheads/page.tsx").includes("canSeeBudgetBalances(me.role)") && read("app/finance/subheads/page.tsx").includes("Subhead figures are private."));
check("Finance home shows subheads to watch only to balance viewers", read("app/finance/page.tsx").includes("canSeeBudgetBalances(me.role)"));

const tr = read("app/finance/account-transfers/page.tsx");
check("Transfers: Account Officer → Auditor → DG approves and stamps", tr.includes("reqgen_transfer_create") && tr.includes("reqgen_transfer_check") && tr.includes("reqgen_transfer_approve") && tr.includes("Approve, sign and stamp"));
check("Transfer approval needs a fresh fingerprint or 2FA code", tr.includes('confirmFresh("approve and stamp this transfer")') && read("lib/v4/freshConfirm.ts").includes("challengeAndVerify"));
check("The DG (or General Secretary acting) may open Transfers, not the rest of Finance", read("lib/permissions.ts").includes('{ prefix: "/finance/account-transfers", roles: ["admin", "auditor", "account", "accounts", "accountofficer", "dg", "directorgeneral", "generalsecretary"] }'));
check("Settings: lock (Super Admin / Auditor), unlock with reason (Super Admin), close from 1 August", read("app/finance/settings/page.tsx").includes("reqgen_fy_lock") && read("app/finance/settings/page.tsx").includes("reqgen_fy_unlock") && read("app/finance/settings/page.tsx").includes("reqgen_fy_close"));

const treat = read("app/finance/request/[id]/page.tsx");
check("Treat (mock-up 38): fresh confirm, fund released, voucher prepared in one step", treat.includes('confirmFresh("release the fund and prepare the voucher")') && treat.includes('rpc("approve_request_step"') && treat.includes('rpc("reqgen_pv_generate"'));
check("Treat: every attachment opened and checked first", treat.includes("Open and check every attachment first.") && treat.includes("request_attachment_checks"));
check("Treat is behind the request access gate and lists its columns", treat.includes("<RequestAccessGate") && !treat.includes('select("*")'));
check("Treat no longer writes vouchers or payments directly", !treat.includes('.from("payment_vouchers")') && !treat.includes("post_finance_payment"));

const sql = read("database/v4_2_0_finance.sql");
check("SQL: transfers checked by the Auditor and approved by the DG (stamped)", sql.includes("create or replace function public.reqgen_transfer_approve") && sql.includes("stamped = true"));
check("SQL: ledger lines use the allowed entry types (Debit / Credit / Allocation Adjustment)", !/'(Transfer Out|Transfer In|Subhead Transfer Out|Subhead Transfer In)'/.test(sql) && sql.includes("'Allocation Adjustment'"));
check("SQL: a locked budget changes only through an approved transfer", sql.includes("reqgen_guard_locked_allocation") && sql.includes("reqgen.transfer_posting"));
check("SQL: routing engine untouched", !/create or replace function public\.(approve_request_step|reject_request_step|reqgen_next_route_step|build_request_route|reqgen_build_route_for_template)/i.test(sql));
check("SQL: functions blocked for anonymous visitors", (sql.match(/from public, anon/g) || []).length >= 8);
check("SQL ends with an all-OK verification table", /from v420_report order by[^;]*;\s*$/.test(sql.trim()));

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.2.0 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.2.0 release lock: PASS (${results.length} checks).`);
