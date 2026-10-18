import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const checks = [];
const check = (label, ok) => checks.push({ label, ok: Boolean(ok) });
const dashboard = read("app/dashboard/page.tsx");
// v4.6.3: the v3 Donut, Registry Centre workspace and its CSS module are deleted; checks follow the v4 parts
const sharedDonut = read("app/components/v4/Charts.tsx");
const registry = read("app/registry/tracking/page.tsx") + read("lib/v4/registry.ts") + read("app/components/v4/PrivacyBar.tsx");
const audit = read("app/audit-centre/logs/page.tsx");
// v3.0.6: colours are theme variables with the original light colour as fallback
// (var(--c-fg-ffffff,#fff)). Audits check the approved LIGHT values, so unwrap them.
const unwrapTheme = (text) => text.replace(/var\(--c-(?:bg|fg|ln)-[0-9a-f]{6,8},(#[0-9a-fA-F]{3,8}|white|black|rgba?\([^)]*\))\)/gi, "$1");
const globals = unwrapTheme(read("app/globals.css"));
const shell = (read("app/components/GovernmentAppShell.tsx") + read("app/components/v4/AppFrame.tsx") + read("app/components/v4/Bell.tsx") + read("lib/v4/modules.ts"));
check("Dashboard (v4) has no hand-drawn conic charts", !dashboard.includes("conic-gradient"));
check("Shared v4 Donut is pure SVG (no HTML overlay button to misalign)", sharedDonut.includes("export function Donut") && sharedDonut.includes("<circle") && !sharedDonut.includes("inset:"));
check("Dashboard remains personal-data scoped", dashboard.includes('.eq("created_by", me.userId)'));
check("Registry tracking reads the content-free tracking list (numbers, offices, people only)", registry.includes('rpc("reqgen_registry_tracking"') && !/from\("(requests|request_history|payment_vouchers)"\)/.test(registry));
check("Registry shows each request's moves and the daily summary", registry.includes('rpc("reqgen_registry_moves"') && registry.includes('rpc("reqgen_registry_summary"'));
check("Registry tracks movement only: no links to open request contents (v3.0.2)", !registry.includes("/requests/${") && !registry.includes("router.push(`/requests/") && fs.readFileSync(path.join(root, "lib/permissions.ts"), "utf8").includes('roles: ["registry"]'));
check("Registry pages show the privacy bar", registry.includes("PrivacyBar") || read("app/components/v4/PrivacyBar.tsx").includes("export default"));
// v3.1.1: the summary may use the stable shared BarChart component (keyboard
// accessible, integer axis) — the unstable hand-made trend must stay gone.
// v4.5: the Audit Log (mock-up 75) has no hand-drawn activity bars at all
check("Audit unstable daily bars were replaced", /<V4Page/.test(audit) && !audit.includes("Daily Activity Trend"));
check("Global tables use approved compact header/body geometry", globals.includes("Phase 8 global component contract") && globals.includes("table-layout:auto!important") && globals.includes("background:#fafbfd!important"));
check("Global tabs use the approved compact active-tab contract", globals.includes('[data-rg-tabs="true"]') && globals.includes("background:#1267e8!important"));
check("Footer shows the version number with no phase-label clutter", shell.includes("REQGEN_VERSION") && !shell.includes("Phase 8 · Stabilised"));
const failed = checks.filter((x) => !x.ok);
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.label}`);
console.log(`\nPhase 8 stabilisation: ${checks.length - failed.length}/${checks.length} checks passed.`);
if (failed.length) process.exit(1);
