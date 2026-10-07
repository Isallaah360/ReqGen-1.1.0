// ReqGen v3.1.9 — release lock: deadlock-safe Print Register / Tracker SQL.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
const sql = read("database/v3_1_9_print_register_tracker.sql");
const results = [
  ["Functions created in a lock-free first part", /PART 1[\s\S]*create or replace function public\.reqgen_print_register\(\)[\s\S]*commit;/.test(sql)],
  ["Trigger never dropped (no AccessExclusive lock)", !/drop trigger/i.test(sql)],
  ["Busy tables reported, not failed", (sql.match(/when lock_not_available or deadlock_detected/g) || []).length === 2],
  ["Register columns cast to declared types", sql.includes("r.request_no::text") && sql.includes("r.created_at::timestamptz") && sql.includes("r.amount::numeric")],
  ["Tracker columns cast to declared types", sql.includes("v.voucher_no::text") && sql.includes("v.created_at::timestamptz")],
  ["Old v3.1.7 file marked superseded", read("database/v3_1_7_registers_tracker_manual_pv.sql").startsWith("-- ====") && read("database/v3_1_7_registers_tracker_manual_pv.sql").includes("SUPERSEDED")],
  ["Print Register explains a missing database update", read("app/requests/printable/page.tsx").includes("v3_1_9_print_register_tracker.sql")],
];
let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv3.1.9 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv3.1.9 release lock: PASS (${results.length} checks).`);
