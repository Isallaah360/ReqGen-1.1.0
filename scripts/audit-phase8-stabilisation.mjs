import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const checks = [];
const check = (label, ok) => checks.push({ label, ok: Boolean(ok) });
const dashboard = read("app/dashboard/page.tsx");
const sharedDonut = read("app/components/ui/Donut.tsx");
const registry = read("app/components/registry/RegistryCentreWorkspace.tsx");
const registryCss = read("app/registry/registry.module.css");
const audit = read("app/audit-centre/page.tsx");
// v3.0.6: colours are theme variables with the original light colour as fallback
// (var(--c-fg-ffffff,#fff)). Audits check the approved LIGHT values, so unwrap them.
const unwrapTheme = (text) => text.replace(/var\(--c-(?:bg|fg|ln)-[0-9a-f]{6,8},(#[0-9a-fA-F]{3,8}|white|black|rgba?\([^)]*\))\)/gi, "$1");
const globals = unwrapTheme(read("app/globals.css"));
const shell = read("app/components/GovernmentAppShell.tsx");
check("Dashboard category/status charts use the shared SVG Donut component", dashboard.includes('from "@/app/components/ui/Donut"') && dashboard.includes("SharedDonut") && !dashboard.includes("conic-gradient"));
check("Shared Donut centre is pure SVG (no HTML overlay button to misalign)", sharedDonut.includes("<circle") && sharedDonut.includes("<text") && !/\n\s*<button/.test(sharedDonut) && !sharedDonut.includes("inset:"));
check("Dashboard remains personal-data scoped", dashboard.includes('.eq("created_by", auth.user.id)'));
check("Registry loads requests (content-free register since v3.0.4)", registry.includes('.from("requests")') || registry.includes("fetchRequestRegister("));
check("Registry loads request history (movement feed since v3.0.4)", registry.includes('.from("request_history")') || registry.includes("fetchRequestMovements("));
check("Registry loads payment vouchers (voucher register since v3.0.4)", registry.includes('.from("payment_vouchers")') || registry.includes("fetchVoucherRegister("));
check("Registry exposes workflow stage counts", registry.includes("Request Workflow Movement") && registry.includes("FLOW_STAGES"));
check("Registry exposes three live account queues without fabricated values", registry.includes("slice(0, 3)") && registry.includes("No requests are currently in Account processing."));
check("Registry exposes request-linked and manual PV counts", registry.includes("Request-linked PVs") && registry.includes("Manual PVs"));
check("Registry tracks movement only: no links to open request contents (v3.0.2)", !registry.includes("/requests/${") && !registry.includes("router.push(`/requests/") && registry.includes("RequestTrackingPanel") && fs.readFileSync(path.join(root, "lib/permissions.ts"), "utf8").includes('roles: ["registry"]'));
check("Registry uses approved tabs contract", registry.includes('data-rg-tabs="true"') && registry.includes("aria-selected"));
check("Registry has compact workflow intelligence styles", registryCss.includes(".workflowGrid") && registryCss.includes(".flowRow") && registryCss.includes(".rowActions"));
// v3.1.1: the summary may use the stable shared BarChart component (keyboard
// accessible, integer axis) — the unstable hand-made trend must stay gone.
check("Audit unstable daily bars were replaced", audit.includes("14-Day Activity Summary") && (audit.includes("14-Day Total") || audit.includes("<BarChart")) && !audit.includes("Daily Activity Trend"));
check("Global tables use approved compact header/body geometry", globals.includes("Phase 8 global component contract") && globals.includes("table-layout:auto!important") && globals.includes("background:#fafbfd!important"));
check("Global tabs use the approved compact active-tab contract", globals.includes('[data-rg-tabs="true"]') && globals.includes("background:#1267e8!important"));
check("Sidebar shows a clear, bold version number with no phase-label clutter", shell.includes("REQGEN_VERSION") && shell.includes("rg-sidebar-release-version") && !shell.includes("Phase 8 · Stabilised"));
const failed = checks.filter((x) => !x.ok);
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.label}`);
console.log(`\nPhase 8 stabilisation: ${checks.length - failed.length}/${checks.length} checks passed.`);
if (failed.length) process.exit(1);
