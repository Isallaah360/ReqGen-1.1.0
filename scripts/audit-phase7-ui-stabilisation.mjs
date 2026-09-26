import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const checks = [];
function check(label, condition, detail = '') {
  checks.push({ label, ok: Boolean(condition), detail });
}

const dashboard = read('app/dashboard/page.tsx');
const globals = read('app/globals.css');
const shell = read('app/components/GovernmentAppShell.tsx');
const roles = read('app/admin/roles/page.tsx');
const security = read('app/admin/security/page.tsx');
const accountRouting = read('app/admin/account-routing/page.tsx');
const finance = read('app/finance/page.tsx');
const reports = read('app/reports/page.tsx');
const analytics = read('app/reports/enterprise-analytics/page.tsx');
const audit = read('app/audit-centre/page.tsx');
const registry = read('app/components/registry/RegistryCentreWorkspace.tsx');

check('Dashboard requests are scoped to authenticated creator', dashboard.includes('.eq("created_by", auth.user.id)'));
check('Dashboard does not query organisation-wide payment vouchers', !dashboard.includes('.from("payment_vouchers")'));
check('Dashboard labels the request KPI as personal', dashboard.includes('label="My Requests"') && dashboard.includes('Your submitted requests only'));
check('Dashboard donut charts expose selection state', dashboard.includes('Select a donut segment or legend row to display the exact value.'));

const standardFiles = [
  ['Dashboard', dashboard],
  ['Finance Overview', finance],
  ['Reports Centre', reports],
  ['Executive Analytics', analytics],
  ['Audit Centre', audit],
  ['Registry Centre', registry],
  ['Admin Roles', roles],
  ['Admin Security', security],
  ['Account Routing', accountRouting],
];
for (const [name, source] of standardFiles) {
  check(`${name} uses Phase 7 shared workspace standard`, source.includes('data-rg-standard="phase7"'));
}

for (const [name, source] of [
  ['Reports Centre', reports],
  ['Audit Centre', audit],
  ['Registry Centre', registry],
  ['Admin Roles', roles],
  ['Admin Security', security],
]) {
  check(`${name} uses canonical tab styling`, source.includes('data-rg-tabs="true"'));
}

check('Sidebar reserves scrollbar width', globals.includes('scrollbar-gutter:stable'));
check('Sidebar hover cannot translate navigation geometry', globals.includes('.gov-nav-link:hover,.rg-nav-row:hover,.rg-nav-link:hover') && globals.includes('transform:none!important'));
check('Phase 7 standard prevents layout transforms on interactive hover', globals.includes('[data-rg-standard="phase7"] :where(button,a,[role="button"]):hover{transform:none!important}'));
check('Roles action controls are non-wrapping', roles.includes('whitespace-nowrap') && roles.includes('w-[230px]'));
check('Legacy Registry role is presented canonically as Registrar', roles.includes('normalized === "registry" || normalized === "registrar"') && roles.includes('return "Registrar"'));
check('Sidebar release label is no longer legacy Phase 4', !shell.includes('Patch 05 · Phase 4') && !shell.includes('Phase 4 ·'));
check('Audit charts instruct click/select rather than hover-only interaction', audit.includes('Select a bar to open its exact live activity count.') && !audit.includes('Hover each bar for the exact live count.'));
check('Executive Analytics has exact-value selection state', analytics.includes('setChartDetail') && analytics.includes('role="status"'));

const failed = checks.filter((x) => !x.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
console.log(`\nPhase 7 UI stabilisation: ${checks.length - failed.length}/${checks.length} checks passed.`);
if (failed.length) process.exit(1);
