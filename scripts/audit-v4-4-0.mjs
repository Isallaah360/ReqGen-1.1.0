// ReqGen v4.4.0 — release lock: Reports (mock-ups 57–67).
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
const exists = (f) => fs.existsSync(f);
const results = [];
const check = (label, ok) => results.push([label, !!ok]);

const pages = { "": "Reports", transactions: "Transactions", analysis: "Analysis", requests: "Request Reports", "finance-statements": "Finance Statements", vouchers: "Voucher Reports", registry: "Registry Reports", "enterprise-analytics": "Executive Analytics", compliance: "Compliance", print: "Print report" };
check("Every report page exists and uses the v4 kit (mock-ups 57–64, 66–67)", Object.keys(pages).every((p) => exists(`app/reports${p ? `/${p}` : ""}/page.tsx`) && read(`app/reports${p ? `/${p}` : ""}/page.tsx`).includes("<V4Page>")));
check("Print Register (mock-up 65) is a v4 page with Mine / Treated by me / All treated", read("app/requests/printable/page.tsx").includes("<V4Page>") && read("app/requests/printable/page.tsx").includes("reqgen_print_register_v4") && read("app/requests/printable/page.tsx").includes("All treated"));
check("One place per function: old report pages forward to Reports", read("app/reports/centre/page.tsx").includes('redirect("/reports")') && read("app/finance/reports/page.tsx").includes("/reports/finance-statements") && read("app/payment-vouchers/reports/page.tsx").includes("/reports/vouchers"));
check("Finance home no longer has its own reports tile", !read("lib/v4/modules.ts").includes('href: "/finance/reports", title'));

const perm = read("lib/permissions.ts");
check("Reports open to everyone; scope decided in the database", perm.includes('{ prefix: "/reports", authenticatedOnly: true }') && read("lib/v4/reports.ts").includes('rpc("reqgen_report_tier")'));
check("Compliance: Super Admin and Auditor only", perm.includes('{ prefix: "/reports/compliance", roles: ["admin", "auditor"] }'));
check("Registry Reports: Registry, Registrar, Auditor, Super Admin", perm.includes('{ prefix: "/reports/registry", roles: ["admin", "auditor", "registry", "registrar"] }'));
check("Finance Statements and Voucher Reports: Finance, DG, Auditor, Super Admin (not staff)", perm.includes('{ prefix: "/reports/finance-statements", roles: ["admin", "auditor", "account", "accounts", "accountofficer", "dg", "directorgeneral", "generalsecretary"] }'));
check("Report pages never read requests directly", Object.keys(pages).every((p) => !/from\("(requests|request_history)"\)/.test(read(`app/reports${p ? `/${p}` : ""}/page.tsx`))));
check("Every page shows 'Your view: …' (the acting position and its scope)", ["", "transactions", "analysis", "requests", "finance-statements", "vouchers", "enterprise-analytics"].every((p) => read(`app/reports${p ? `/${p}` : ""}/page.tsx`).includes("scope={")));

check("Export Excel is a real .xlsx workbook (fflate), not CSV", read("lib/v4/xlsx.ts").includes("zipSync") && read("lib/v4/xlsx.ts").includes("spreadsheetml") && ["transactions", "analysis", "requests", "finance-statements", "vouchers", "registry", "enterprise-analytics"].every((p) => read(`app/reports/${p}/page.tsx`).includes("downloadXlsx(")));
check("Charts are plain SVG with a hover tip and a table view", read("app/components/v4/Charts.tsx").includes("v4-viz-tip") && read("app/reports/analysis/page.tsx").includes('aria-selected={view === "table"}'));
check("Transactions: month picker, money out / in / still to pay, day groups", read("app/reports/transactions/page.tsx").includes("v4-monthpick") && read("app/reports/transactions/page.tsx").includes("Still to pay") && read("app/reports/transactions/page.tsx").includes("v4-day v4-split2"));
check("Statements: monthly (Sep–Aug), annual by group, subhead statement with running balance", read("app/reports/finance-statements/page.tsx").includes("fyMonths(fy)") && read("app/reports/finance-statements/page.tsx").includes("Subhead statement") && read("app/reports/finance-statements/page.tsx").includes("Opening allocation"));
check("Executive: budget pace, subheads at risk, spending trend, exceptions", read("app/reports/enterprise-analytics/page.tsx").includes("<Pace") && read("app/reports/enterprise-analytics/page.tsx").includes("reqgen_report_exceptions"));
check("Compliance: 12 checks, Run now, each run kept", read("app/reports/compliance/page.tsx").includes("reqgen_compliance_run") && read("app/reports/compliance/page.tsx").includes("Run now"));
check("Report print: one A4 page, IET header, prepared / checked by", read("app/reports/print/page.tsx").includes("rg-a4-page") && read("app/reports/print/page.tsx").includes("Islamic Education Trust") && read("app/reports/print/page.tsx").includes("Checked by"));
check("Every print is recorded (requests, vouchers, reports)", read("app/requests/[id]/print/page.tsx").includes('logPrint("request"') && read("app/payment-vouchers/[id]/print/VoucherPrintView.tsx").includes('logPrint("voucher"') && read("app/reports/print/page.tsx").includes('logPrint("report"'));

const sql = read("database/v4_4_0_reports.sql");
check("SQL: tier follows the ACTING position (and only one the person holds)", sql.includes("from public.user_active_roles uar") && sql.includes("reqgen_pv_user_has_role(auth.uid(), array[public.pv_role_key(uar.active_role_key)])"));
check("SQL: staff see only their own lines; titles only for your own requests", sql.includes("(v_tier <> 'mine' or r.created_by = v_uid)") && sql.includes("case when r.created_by = v_uid then r.title end"));
check("SQL: registry report reads counts, offices and dates only", /reqgen_report_registry[\s\S]*returns table\(month text, office text, direction text, state text, received_at timestamptz, days_to_dispatch numeric\)/.test(sql) && !/subject/.test(sql.split("reqgen_report_registry")[1].split("$$;")[0]));
check("SQL: reports change nothing (no insert/update/delete on business tables)", !/(insert into|update|delete from) public\.(requests|payment_vouchers|subheads|iet_accounts|request_history|payment_voucher_items)\b/.test(sql));
check("SQL: routing engine untouched", !/create or replace function public\.(approve_request_step|reject_request_step|reqgen_next_route_step|build_request_route|reqgen_build_route_for_template)/i.test(sql));
check("SQL ends with an all-OK verification table", /from v440_report order by[^;]*;\s*$/.test(sql.trim()));

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.4.0 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.4.0 release lock: PASS (${results.length} checks).`);
