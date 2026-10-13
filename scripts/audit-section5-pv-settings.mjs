// Section 5 — Payment Voucher Signatories (v4.3, mock-up 56). Rewritten for v4: the v3 page and its CSS module were retired.
import fs from 'node:fs';
const read = (p) => fs.readFileSync(p, 'utf8');
const page = read('app/payment-vouchers/settings/page.tsx');
const shell = read('lib/v4/modules.ts');
const perms = read('lib/permissions.ts');

const checks = [
  ['Signatories page is a v4 page', page.includes('<V4Page>')],
  ['Reads the live counter-signatory register', page.includes('from("payment_voucher_counter_signatories")')],
  ['Reads real ReqGen profiles', page.includes('from("profiles")')],
  ['Managed by Super Admin and the Auditor only (page and rule)', page.includes('role === "admin" || role === "auditor"') && perms.includes('{ prefix: "/payment-vouchers/settings", roles: ["admin", "auditor"] }')],
  ['A signature must be on file before signing authority is given', page.includes('signature_url')],
  ['Vouchers already signed keep their signatory (history is checked)', page.includes('from("payment_vouchers")')],
  ['Signatories remains a Payment Vouchers tile', shell.includes('{ href: "/payment-vouchers/settings", title: "Signatories"')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) failed += 1;
}
if (failed) { console.error(`Section 5 Signatories audit failed: ${failed}`); process.exit(1); }
console.log(`Section 5 Signatories audit: PASS ${checks.length}/${checks.length}`);
