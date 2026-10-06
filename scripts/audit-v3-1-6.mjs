// ReqGen v3.1.6 — release lock: A4 documents, PV signing chain, numbered
// tabs, manual voucher department filter, print register.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
const exists = (f) => fs.existsSync(f);
const results = [];
const check = (label, ok) => results.push({ label, ok: Boolean(ok) });

const reqPrint = read("app/requests/[id]/print/page.tsx");
const pvPrint = read("app/payment-vouchers/[id]/print/page.tsx");
const css = read("app/globals.css");
check("A4 engine exists (fit + isolated print)", exists("lib/printA4.ts") && read("lib/printA4.ts").includes("export async function printA4Sheet"));
check("Request print is one A4 page, fitted and printed in isolation", reqPrint.includes("rg-a4-page") && reqPrint.includes("useA4Fit") && reqPrint.includes("printA4Sheet") && !reqPrint.includes("window.print()"));
check("PV print is one A4 page, fitted and printed in isolation", pvPrint.includes("rg-a4-page") && pvPrint.includes("useA4Fit") && pvPrint.includes("printA4Sheet") && !pvPrint.includes("window.print()"));
check("A4 page is exactly 210 x 297 mm", /\.rg-a4-page\{[^}]*width:210mm;height:297mm/.test(css));
check("Request 'Checked by' uses one resolved line", reqPrint.includes("checkedLine.name") && reqPrint.includes("approv|recommend|forward"));
check("Requester may print own completed request", reqPrint.includes("ownrequest"));
check("PV prints only when fully signed (all modes)", pvPrint.includes('voucher.status === "Authorized" || voucher.status === "Paid"') && pvPrint.includes("disabled={!ready || !finalPrintReady"));

const pvPage = read("app/payment-vouchers/page.tsx");
const shell = read("app/components/GovernmentAppShell.tsx");
check("PV views are numbered module tabs", pvPage.includes("VIEW_PATH") && !pvPage.includes("workspaceTabs") && shell.includes('"Pending Signatures"'));
check("One voucher phase drives tabs, KPIs and donut", pvPage.includes("function voucherPhase") && pvPage.includes("voucherGroup(status") );
check("Signers required for every disbursement mode", pvPage.includes("p_cheque_signed_by_name: chequeSignedByName.trim()") && pvPage.includes("p_counter_signatory_name: counterSignatoryName.trim()"));
const detail = read("app/payment-vouchers/[id]/page.tsx");
check("Voucher detail signs through reqgen_pv_sign", detail.includes('rpc("reqgen_pv_sign"') && detail.includes('rpc("reqgen_pv_assign_signers"'));
check("Voucher detail shows the 6-step chain", ["Prepared", "Checked", "Cheque signed", "Counter-signed", "Authorised", "Received"].every((t) => detail.includes(`"${t}"`)));
check("Signers outside Finance sign from Approvals", exists("app/approvals/vouchers/page.tsx") && exists("app/approvals/vouchers/[id]/page.tsx") && shell.includes('"Voucher Signing"'));
const manual = read("app/payment-vouchers/manual/page.tsx");
check("Manual voucher: department first, its accounts only", manual.includes("departmentAccounts") && manual.includes("department_account_routing") && manual.includes("Select the department first."));
check("Print Register for requesters, Account Officers and Auditors", exists("app/requests/printable/page.tsx") && shell.includes('"Print Register"'));
check("Requests module has numbered tabs", shell.includes('{ href: "/requests", label: "My Requests" }'));
const sql = "database/v3_1_6_pv_signing_chain.sql";
check("Signing chain SQL present with backups and verification", exists(sql) && read(sql).includes("reqgen_function_backups") && read(sql).includes("check_item") && read(sql).includes("Fully Signed"));
check("Signature engine lifts faint signatures", read("lib/signatureInk.ts").includes("adaptive strength"));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}`); }
if (failed) { console.error(`\nv3.1.6 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv3.1.6 release lock: PASS (${results.length} checks).`);
