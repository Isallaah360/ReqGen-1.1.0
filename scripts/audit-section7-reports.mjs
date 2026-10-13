// Section 7 — Reports (v4.4, mock-ups 57–67). Rewritten for v4: one Reports module, scoped in the database.
import fs from "node:fs";
const checks = []; const read = (p) => fs.readFileSync(p, "utf8");
const shell = read("lib/v4/modules.ts"), roles = read("lib/roles.ts"), lib = read("lib/v4/reports.ts"), analytics = read("app/reports/enterprise-analytics/page.tsx");
function check(name, ok) { checks.push([name, !!ok]); }
check("Reports read live data through database functions (scoped by position)", ["reqgen_report_tier", "reqgen_report_transactions", "reqgen_report_spend"].every((f) => lib.includes(`rpc("${f}"`)));
check("Old Reports Centre forwards to /reports", read("app/reports/centre/page.tsx").includes('redirect("/reports")'));
check("Executive Analytics uses live subheads and the exceptions function", analytics.includes('from("subheads")') && analytics.includes('rpc("reqgen_report_exceptions"'));
check("Analytics access roles are Admin/Auditor only (REPORT_ACCESS_ROLES)", roles.includes('REPORT_ACCESS_ROLES = ["admin", "auditor"]'));
check("Reports mother page exposes Executive Analytics", shell.includes('title: "Executive Analytics"'));
check("Legacy Output Centre consolidates to Reports", read("app/output/page.tsx").includes('redirect("/reports")'));
const failed = checks.filter(([, ok]) => !ok); for (const [n, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${n}`);
if (failed.length) { process.exitCode = 1; } else console.log(`Section 7 Reports audit: PASS ${checks.length}/${checks.length}`);
