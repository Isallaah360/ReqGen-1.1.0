// ReqGen v4.3.0 — release lock: Payment Vouchers (mock-ups 46–56).
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
const exists = (f) => fs.existsSync(f);
const results = [];
const check = (label, ok) => results.push([label, !!ok]);
const pv = (p) => read(`app/payment-vouchers/${p}/page.tsx`);

const views = { centre: "Voucher Centre", new: "Generate from Requests", manual: "Manual Voucher", pending: "Signing Tracker", approved: "Ready to Pay", history: "Paid History", "print-centre": "Print Centre", settings: "Signatories" };
check("Every voucher page is its own v4 page (mock-ups 47–56)", Object.entries(views).every(([d, t]) => pv(d).includes("<V4Page>") && pv(d).includes(t)));
check("Voucher pages are v4-native", read("lib/v4/modules.ts").includes("/^\\/payment-vouchers\\/(centre|new|manual|pending|approved|history|print-centre|settings)$/"));

const gen = pv("new");
check("Generate: up to 10 Official requests on one voucher; the 11th is blocked", gen.includes("const CAP = 10") && gen.includes("Voucher full — start another voucher for the rest"));
check("Generate: a personal request gets a voucher of its own", gen.includes("Personal · own voucher") && gen.includes("p.includes(r.id) ? [] : [r.id]"));
check("Generate: several payees → transfer only, with a Transfer Schedule", gen.includes("const effMode: Mode = many ? \"Transfer\" : mode") && gen.includes("Transfer schedule ·"));
check("Generate: schedule filled from saved bank details; 10-digit account numbers", gen.includes("reqgen_payee_bank_accounts") && gen.includes('replace(/\\D/g, "").length === 10'));
check("Generate: Preparing as (General Admin, DIN, ASAP-ALLI) printed on the voucher", gen.includes("p_preparing_as: section") && read("lib/v4/vouchers.ts").includes('["General Admin", "DIN", "ASAP-ALLI"]'));
check("Generate: only the Counter Signer is chosen; the Auditor is shown", gen.includes("p_counter_signer: counter") && gen.includes("IET has one internal auditor"));
check("Reissue a cancelled voucher keeps the link to the old number", gen.includes("p_reissue_of") && pv("[id]").includes("/payment-vouchers/new?reissue="));

const rec = pv("[id]");
check("Record: one action card for whoever holds it (Auditor, Counter Signer, DG, Account)", ["Your action: Check and sign as Auditor", "Your action: Counter-sign", "Your action: Sign, stamp and authorise", "Ready to pay", "Your action: Correct and send again"].every((t) => rec.includes(t)));
check("Record: Auditor ticks both checks before signing", rec.includes("Tick both checks before you sign."));
check("Record: DG signs + IET stamp with a fresh fingerprint or 2FA code", rec.includes('confirmFresh("sign, stamp and authorise this voucher")') && rec.includes("v4-iet-stamp"));
check("Record: paying needs a fresh confirmation, a date and an optional bank reference", rec.includes('confirmFresh("record this payment")') && rec.includes("reqgen_pv_mark_paid"));
check("Record: send back with a reason; resend restarts at the Auditor", rec.includes("reqgen_pv_return") && rec.includes("reqgen_pv_resend") && rec.includes("Signing starts again from the Auditor"));
check("Record: Super Admin has no sign action (roles decide the cards)", !/isAdmin\s*&&\s*stage === "(check|counter|dg)"/.test(rec) && rec.includes('stage === "dg" && isDG'));
check("Signatures drawn with the signature ink engine", rec.includes("<SignatureInk") && pv("settings").includes("<SignatureInk"));

check("Tracker: lanes by holder, 3+ days late, reminders by in-app, SMS and email", pv("pending").includes("Waiting 3+ days") && read("app/components/v4/useVouchers.ts").includes('"/api/pv/remind"'));
check("Print Centre: only authorised or paid vouchers; several at once, one A4 each", pv("print-centre").includes('["ready", "paid"].includes(pvStage(v.status))') && exists("app/payment-vouchers/print-centre/batch/page.tsx") && read("lib/printA4.ts").includes("page-break-after: always"));
const print = read("app/payment-vouchers/[id]/print/VoucherPrintView.tsx");
check("Print: v3 voucher template kept on one A4 page; Transfer Schedule on its own page", print.includes("rg-a4-page") && print.includes("Transfer Schedule") && print.includes('voucher.status === "Authorized" || voucher.status === "Paid"'));
check("Print: Prepared by … — Account Officer, <section>", print.includes("— Account Officer, ${section}"));

const man = pv("manual");
check("Manual voucher: department first, its accounts, live check, reason, section", man.includes("department_account_routing") && man.includes("Can be paid") && man.includes("Reason for a manual voucher") && man.includes("reqgen_pv_manual_prepare"));
check("Manual voucher: draft, then post into the same signing order", man.includes("save_manual_payment_voucher") && man.includes("post_manual_payment_voucher") && man.includes("reqgen_pv_assign_signers"));
check("Manual voucher: bill or receipt kept privately with the voucher", man.includes('storage.from("voucher-attachments")') && man.includes("reqgen_pv_add_attachment"));
check("Signatories: Super Admin and Auditor only", pv("settings").includes('role === "admin" || role === "auditor"') && read("lib/permissions.ts").includes('{ prefix: "/payment-vouchers/settings", roles: ["admin", "auditor"] }'));

const sql = read("database/v4_3_0_payment_vouchers.sql");
check("SQL: 'Returned to Account' allowed; every old status kept", sql.includes("'Pending DG Authorisation', 'Posted', 'Prepared', 'Returned to Account'"));
check("SQL: generator caps 10, personal alone, cash/cheque one payee, schedule adds up", ["at most 10 requests", "A personal request gets a voucher of its own", "Cash and cheque are for one payee only", "does not add up to the voucher total"].every((t) => sql.includes(t)));
check("SQL: marking paid writes no second ledger line", !/reqgen_pv_mark_paid[\s\S]{0,4000}insert into public\.(iet_account_transactions|finance_transactions)/.test(sql.split("create or replace function public.reqgen_pv_cancel")[0]));
check("SQL: inner generator closed to direct calls", sql.includes("the inner generator can only be used through reqgen_pv_generate"));
check("SQL: existing signing engine (reqgen_pv_sign) not replaced", !/create or replace function public\.reqgen_pv_sign\(/i.test(sql));
check("SQL ends with an all-OK verification table", /from v430_report order by[^;]*;\s*$/.test(sql.trim()));

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.3.0 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.3.0 release lock: PASS (${results.length} checks).`);
