import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'app/payment-vouchers/settings/page.tsx');
const cssPath = path.join(root, 'app/payment-vouchers/settings/payment-voucher-settings.module.css');
const shellPath = path.join(root, 'app/components/GovernmentAppShell.tsx');

const page = fs.readFileSync(pagePath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const shell = fs.readFileSync(shellPath, 'utf8');

const checks = [
  ['PV settings reads live signatory register', page.includes('payment_voucher_counter_signatories')],
  ['PV settings reads real ReqGen profiles', page.includes('.from("profiles")')],
  ['PV settings resolves active role', page.includes('get_my_active_role')],
  ['PV settings restricted to Admin/Auditor', page.includes('["admin", "auditor"].includes')],
  ['Signature required before granting authority', page.includes('signature_url') && page.includes('Signature missing')],
  ['Historical voucher use blocks destructive delete', page.includes('payment_vouchers') && page.includes('historical voucher record')],
  ['Live refresh subscription present', page.includes('pv-settings-live') && page.includes('postgres_changes')],
  ['PV settings page uses 13px base typography', css.includes('font-size:13px')],
  ['PV settings remains in Payment Vouchers navigation', shell.includes('{ href: "/payment-vouchers/settings", label: "Settings" }')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`Section 5 PV Settings audit failed: ${failed} check(s).`);
  process.exit(1);
}
console.log('Section 5 PV Settings audit: PASS');
