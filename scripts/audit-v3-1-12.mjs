// ReqGen v3.1.12 — release lock: pilot blockers.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
const css = read("app/globals.css");
const detail = read("app/payment-vouchers/[id]/page.tsx");
const results = [
  ["Real footers are never hidden (New Request Submit bar shows)", !/\.rg-content footer\{display:none/.test(css) && !css.includes(".gov-content footer:not(.mock-footer)")],
  ["Loading bar sits below the top bar (no animated top stripe)", css.includes(".rg-activity-strip{position:sticky;top:var(--rg-topbar)") && !css.includes("html.rg-busy")],
  ["Module tabs wrap instead of scrolling", css.includes("html body .rg-module-tabs{flex-wrap:wrap!important")],
  ["Voucher: Account chooses checker + signers in-app", detail.includes('rpc("reqgen_pv_checkers")') && detail.includes("p_checker_id: checker || null") && detail.includes("Action needed: choose the signing officers")],
  // v3.1.13: the Auditor's check no longer waits for the signers at all.
  ["Voucher: checker never sees a dead button", !detail.includes("disabled={busy || signersMissing}")],
  ["Generation opens the signing-officer form, not print", read("app/payment-vouchers/page.tsx").includes("?signers=1")],
  ["Reminder goes to the chosen checker", read("app/api/pv/remind/route.ts").includes("voucher.current_signing_owner ? await byIds")],
  ["SQL: chosen checker enforced, ambiguous overload removed", read("database/v3_1_12_pv_checker_and_handoffs.sql").includes("drop function if exists public.reqgen_pv_assign_signers(uuid, text, text);")],
];
let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv3.1.12 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv3.1.12 release lock: PASS (${results.length} checks).`);
