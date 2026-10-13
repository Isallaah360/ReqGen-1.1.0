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
const shell = (read("app/components/GovernmentAppShell.tsx") + read("app/components/v4/AppFrame.tsx") + read("app/components/v4/Bell.tsx") + read("lib/v4/modules.ts"));
const roles = read('app/admin/roles/page.tsx');
const security = read('app/admin/security/page.tsx');
const accountRouting = read('app/admin/account-routing/page.tsx');
const finance = read('app/finance/overview/page.tsx');
const reports = read('app/reports/page.tsx');
const analytics = read('app/reports/enterprise-analytics/page.tsx');
const audit = read('app/audit-centre/logs/page.tsx');
const registry = read('app/components/registry/RegistryCentreWorkspace.tsx');

check('Dashboard requests are scoped to authenticated creator', dashboard.includes('.eq("created_by", me.userId)'));
check('Dashboard does not query organisation-wide payment vouchers', !dashboard.includes('.from("payment_vouchers")'));
check('Dashboard labels the request KPI as personal and only loads the user\'s own requests', dashboard.includes('label: "My requests in progress"') && dashboard.includes('.eq("created_by", me.userId)'));
check('Dashboard (v4) shows waiting work with All / Requests / Vouchers filters', dashboard.includes('<Tabs') && dashboard.includes('"vouchers"'));

const standardFiles = [
  // Dashboard is a v4 page (v4.0.0) and uses the v4 design system instead.
  ['Finance Overview', finance],
  ['Reports Centre', reports],
  ['Executive Analytics', analytics],
  ['Audit Centre', audit],
  ['Registry Centre', registry],
  ['Admin Roles', roles],
  ['Admin Security', security],
  ['Account Routing', accountRouting],
];
// v4: a page rebuilt with the v4 design system (V4Page / MotherPage) meets the shared standard.
const isV4 = (source) => /<V4Page|<MotherPage/.test(source);
for (const [name, source] of standardFiles) {
  check(`${name} uses Phase 7 shared workspace standard`, source.includes('data-rg-standard="phase7"') || isV4(source) || /redirect\(/.test(source)); // v4.6: retired pages forward to their v4 page
}

for (const [name, source] of [
  ['Reports Centre', reports],
  ['Audit Centre', audit],
  ['Registry Centre', registry],
  ['Admin Roles', roles],
  ['Admin Security', security],
]) {
  check(`${name} uses canonical tab styling`, source.includes('data-rg-tabs="true"') || isV4(source));
}

check('Sidebar reserves scrollbar width', globals.includes('scrollbar-gutter:stable'));
check('Sidebar hover cannot translate navigation geometry', globals.includes('.gov-nav-link:hover,.rg-nav-row:hover,.rg-nav-link:hover') && globals.includes('transform:none!important'));
check('Phase 7 standard prevents layout transforms on interactive hover', globals.includes('[data-rg-standard="phase7"] :where(button,a,[role="button"]):hover{transform:none!important}'));
// v4.6: the Permissions Matrix (mock-up 84) shows the enforced rules; it has no editable controls
check('Permissions Matrix is a read-only v4 matrix', isV4(roles) && roles.includes('v4-matrix') && !roles.includes('type="checkbox"'));
// v4 (Build Reference §3): Registrar and Registry are two different positions
check('Registrar and Registry are distinct positions', read('lib/v4/admin.ts').includes('{ code: "REG", name: "Registrar"') && read('lib/v4/admin.ts').includes('{ code: "RGY", name: "Registry"'));
check('Sidebar release label is no longer legacy Phase 4', !shell.includes('Patch 05 · Phase 4') && !shell.includes('Phase 4 ·'));
// v4.5: the Audit Log (mock-up 75) is a filtered list with export — no hover-only charts
check('Audit Log is a v4 list with filters and export', isV4(audit) && audit.includes('Export CSV') && !audit.includes('Hover each bar'));
check('Executive Analytics has exact-value selection state', (analytics.includes('setChartDetail') && analytics.includes('role="status"')) || (isV4(analytics) && read('app/components/v4/Charts.tsx').includes('v4-viz-tip')));

const failed = checks.filter((x) => !x.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
console.log(`\nPhase 7 UI stabilisation: ${checks.length - failed.length}/${checks.length} checks passed.`);
if (failed.length) process.exit(1);
