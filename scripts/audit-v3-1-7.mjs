// ReqGen v3.1.7 — release lock: distinct PV tabs, reminders, print register,
// manual vouchers in the chain, footer never covered, role-aware actions.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
const exists = (f) => fs.existsSync(f);
const results = [];
const check = (label, ok) => results.push({ label, ok: Boolean(ok) });

const pv = read("app/payment-vouchers/centre/page.tsx");
const views = exists("app/payment-vouchers/views/PvViews.tsx") ? read("app/payment-vouchers/views/PvViews.tsx") : "";
// v4.3: each view is its own page (Signing Tracker, Ready to Pay, Paid History, Print Centre)
check("PV tabs 2-5 each render their own view", [["pending", "Signing Tracker"], ["approved", "Ready to Pay"], ["history", "Paid History"], ["print-centre", "Print Centre"]].every(([d, t]) => read(`app/payment-vouchers/${d}/page.tsx`).includes(`title="${t}"`)));
check("Signing tracker reads reqgen_pv_tracker and sends reminders", (views.includes('rpc("reqgen_pv_tracker")') || read("app/payment-vouchers/pending/page.tsx").includes("pvInSigning")) && read("app/components/v4/useVouchers.ts").includes('"/api/pv/remind"') && read("app/payment-vouchers/pending/page.tsx").includes("remindVoucher"));
const remind = exists("app/api/pv/remind/route.ts") ? read("app/api/pv/remind/route.ts") : "";
check("Reminder API: auth, role check, cooldown, in-app + SMS + email + history", remind.includes("getUser(token)") && remind.includes("Only Account Officers") && remind.includes("COOLDOWN_MINUTES") && remind.includes("sendSendchampSms") && remind.includes("sendSendchampEmail") && remind.includes('action_type: "Reminder"'));
check("Quick actions are role-aware (no Settings/Reports for Account)", pv.includes("canPrepare ?") && !pv.includes(">Voucher Settings</button>") && read("app/payment-vouchers/settings/page.tsx").includes('role === "admin" || role === "auditor"'));
check("Print Register uses the server register", read("app/requests/printable/page.tsx").includes('rpc("reqgen_print_register")'));
check("Pages can no longer cover the footer", read("app/globals.css").includes("html body .rg-content > main{min-height:0!important}"));
check("Manual voucher: chain statuses count as posted; rows open the voucher", read("app/payment-vouchers/manual/page.tsx").includes('.in("status", ["Prepared", "Draft"])') && read("app/payment-vouchers/manual/page.tsx").includes("/payment-vouchers/${id}"));
const sql = "database/v3_1_9_print_register_tracker.sql";
check("v3.1.7 SQL: register, tracker, signature trigger, verification", exists(sql) && ["reqgen_print_register", "reqgen_pv_tracker", "reqgen_pv_before_write", "check_item"].every((t) => read(sql).includes(t)));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}`); }
if (failed) { console.error(`\nv3.1.7 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv3.1.7 release lock: PASS (${results.length} checks).`);
