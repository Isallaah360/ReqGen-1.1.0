// ReqGen v3.1.14 — release lock: DG signs & authorises in one step; 12-hour 2FA window.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
const sql = read("database/v3_1_14_pv_dg_sign_authorise.sql");
const detail = read("app/payment-vouchers/[id]/page.tsx");
const gen = read("app/payment-vouchers/page.tsx");
const guard = read("app/components/MfaGuard.tsx");
const trust = read("app/api/auth/mfa-trust/route.ts");
const results = [
  ["SQL: check moves straight to the Counter Signer", sql.includes("status = 'Pending Counter Signature', signing_stage = 'Awaiting Counter Signature',\n      current_signing_owner = v_pv.cheque_counter_signed_by")],
  ["SQL: DG signs the cheque AND authorises in one step", sql.includes("'Sign & Authorise'") && sql.includes("cheque_signed_signature_url = coalesce(")],
  ["SQL: generator no longer needs a Cheque Signer", !sql.includes("raise exception 'Please select the Cheque Signer")],
  ["SQL: vouchers waiting for a Cheque Signer are moved (guarded, short)", sql.includes("set local lock_timeout = '5s'") && sql.includes("when lock_not_available or deadlock_detected")],
  ["SQL: no trigger is dropped", !/drop\s+trigger/i.test(sql)],
  ["Voucher page: 4 signatures, no Cheque Signer choice", detail.includes("of 4") && !detail.includes("Select the Cheque Signer")],
  ["Voucher page: DG button 'Sign and authorise'", detail.includes('label: "Sign and authorise"')],
  ["Generate modal: only the Counter Signer is chosen", !gen.includes("Cheque Signer *") && gen.includes("p_cheque_signed_by_name: null")],
  ["2FA window: server-signed, httpOnly, 12 hours from the code", trust.includes("httpOnly: true") && trust.includes("12 * 60 * 60") && trust.includes('a.method === "totp"')],
  ["2FA window: tied to the authenticator (replacing it ends the window)", trust.includes("authenticator replaced")],
  ["2FA window: guard skips the code inside the window and signs out after", guard.includes("checkMfaWindow") && guard.includes("signOutForExpiredWindow")],
  ["Replacing the authenticator signs out every session", read("app/profile/security/replace-authenticator/page.tsx").includes('signOut({ scope: "global" })')],
];
let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv3.1.14 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv3.1.14 release lock: PASS (${results.length} checks).`);
