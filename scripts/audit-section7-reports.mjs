import fs from "node:fs";
const checks=[]; const read=p=>fs.readFileSync(p,"utf8");
const reports=read("app/reports/page.tsx"), analytics=read("app/reports/enterprise-analytics/page.tsx"), shell=read("app/components/GovernmentAppShell.tsx"), roles=read("lib/roles.ts"), css=read("app/reports/reports.module.css");
function check(name, ok){checks.push([name,!!ok]);}
check("Reports Centre uses live requests",reports.includes('from("requests")'));
check("Reports Centre uses live departments",reports.includes('from("departments")'));
check("Reports Centre uses live subheads",reports.includes('from("subheads")'));
check("Reports Centre uses live finance transactions",reports.includes('from("finance_transactions")'));
check("Reports Centre uses live payment vouchers",reports.includes('from("payment_vouchers")'));
check("Reports Centre uses live registry",reports.includes('from("registry_correspondence")'));
check("Approval report uses request history",reports.includes('from("request_history")'));
check("Executive Analytics uses live IET accounts",analytics.includes('from("iet_accounts")'));
check("Analytics access roles are Admin/Auditor only",roles.includes('REPORT_ACCESS_ROLES = ["admin", "auditor"]'));
check("DG not granted Reports access",!roles.match(/REPORT_ACCESS_ROLES[^\n]*dg/));
check("Shell exposes Executive Analytics",shell.includes('label: "Executive Analytics"'));
check("Legacy Output Centre consolidates to Reports",read("app/output/page.tsx").includes('redirect("/reports")'));
check("Section 7 13px baseline",css.includes('font-size:13px'));
check("Approved Section 7 mockup stored",fs.existsSync("docs/approved-mockups/20260902_SECTION7_REPORTS_EXECUTIVE_ANALYTICS_APPROVED.png"));
const failed=checks.filter(([,ok])=>!ok); for(const [n,ok] of checks)console.log(`${ok?"PASS":"FAIL"} ${n}`); if(failed.length){process.exitCode=1}else console.log(`Section 7 Reports audit: PASS ${checks.length}/${checks.length}`);
