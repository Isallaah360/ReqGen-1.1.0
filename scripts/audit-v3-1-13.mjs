// ReqGen v3.1.13 — release lock: stabilised payment voucher engine.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
const sql = read("database/v3_1_13_pv_engine_stable.sql");
const detail = read("app/payment-vouchers/[id]/page.tsx");
const results = [
  ["SQL: Auditor check never waits for signers", !sql.includes("raise exception 'The Cheque Signer and Counter Signer must be assigned") && sql.includes("Please choose the Cheque Signer and Counter Signer")],
  ["SQL: signers can be chosen until the Cheque Signer signs", sql.includes("until the Cheque Signer signs")],
  ["SQL: vouchers open by ANY held role or the part played", (sql.match(/reqgen_pv_user_has_role\(auth\.uid\(\), array\['admin'/g) || []).length >= 4],
  ["SQL: notifications link to Approvals (open to every signer)", sql.includes("'/approvals/vouchers/' || p_voucher_id::text")],
  ["Voucher page: 'Your action' card at the top with comment", detail.includes("Your action: {myStep.label}")],
  ["Voucher page: Admin / Auditor / Account can send a reminder", detail.includes("canOversee") && detail.includes('fetch("/api/pv/remind"')],
  ["'Waiting for you' on Approvals and Payment Vouchers", read("app/approvals/page.tsx").includes("<WaitingForYou />") && read("app/payment-vouchers/page.tsx").includes("<WaitingForYou />")],
  ["Voucher links re-route to Approvals when the active role cannot open Finance", read("app/components/RouteAccessGuard.tsx").includes("/approvals/vouchers/${voucher[1]}")],
];
let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv3.1.13 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv3.1.13 release lock: PASS (${results.length} checks).`);
