// ReqGen v3.1.7 — release lock: distinct PV tabs, reminders, print register,
// manual vouchers in the chain, footer never covered, role-aware actions.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
const exists = (f) => fs.existsSync(f);
const results = [];
const check = (label, ok) => results.push({ label, ok: Boolean(ok) });

const pv = read("app/payment-vouchers/page.tsx");
const views = exists("app/payment-vouchers/views/PvViews.tsx") ? read("app/payment-vouchers/views/PvViews.tsx") : "";
check("PV tabs 2-5 each render their own view", ["<PendingTracker />", "<ApprovedView", "<HistoryView", "<PrintCentreView"].every((t) => pv.includes(t)));
check("Signing tracker reads reqgen_pv_tracker and sends reminders", views.includes('rpc("reqgen_pv_tracker")') && views.includes('"/api/pv/remind"'));
const remind = exists("app/api/pv/remind/route.ts") ? read("app/api/pv/remind/route.ts") : "";
check("Reminder API: auth, role check, cooldown, in-app + SMS + email + history", remind.includes("getUser(token)") && remind.includes("Only Account Officers") && remind.includes("COOLDOWN_MINUTES") && remind.includes("sendSendchampSms") && remind.includes("sendSendchampEmail") && remind.includes('action_type: "Reminder"'));
check("Quick actions are role-aware (no Settings/Reports for Account)", pv.includes("canSeeOversight ? <button") && !pv.includes(">Voucher Settings</button>"));
check("Print Register uses the server register", read("app/requests/printable/page.tsx").includes('rpc("reqgen_print_register")'));
check("Pages can no longer cover the footer", read("app/globals.css").includes("html body .rg-content > main{min-height:0!important}"));
check("Manual voucher: chain statuses count as posted; rows open the voucher", read("app/payment-vouchers/manual/page.tsx").includes('status.startsWith("pending")') && read("app/payment-vouchers/manual/page.tsx").includes("/payment-vouchers/${voucher.id}"));
const sql = "database/v3_1_9_print_register_tracker.sql";
check("v3.1.7 SQL: register, tracker, signature trigger, verification", exists(sql) && ["reqgen_print_register", "reqgen_pv_tracker", "reqgen_pv_before_write", "check_item"].every((t) => read(sql).includes(t)));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}`); }
if (failed) { console.error(`\nv3.1.7 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv3.1.7 release lock: PASS (${results.length} checks).`);
