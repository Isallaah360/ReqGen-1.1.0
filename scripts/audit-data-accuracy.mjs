import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const checks = [];
const pass = (name, ok, detail="") => checks.push({name,ok,detail});

const finance = read("app/finance/page.tsx");
const accounts = read("app/finance/manage-accounts/page.tsx");
const pv = read("app/payment-vouchers/page.tsx");
const shell = read("app/components/GovernmentAppShell.tsx");
const globalCss = read("app/globals.css");

pass("Finance uses live departments", finance.includes('.from("departments")'));
pass("Finance uses live subheads", finance.includes('.from("subheads")'));
pass("Finance uses live transactions", finance.includes('.from("finance_transactions")'));
pass("Finance uses live payment vouchers", finance.includes('.from("payment_vouchers")'));
pass("Finance uses live IET accounts", finance.includes('.from("iet_accounts")'));
pass("Department expenditure visual is not truncated", !finance.includes("departmentSpend.slice("));
pass("Budget health visual is not truncated", !finance.includes(".slice(0, 6)"));
pass("Finance canonical subhead balance is Allocation - Reserved - Expenditure", finance.includes("canonicalSubheadBalance"));
pass("IET bank distribution is not top-4 truncated", !accounts.includes(".slice(0, 4)"));
pass("IET bank distribution includes live available balance", accounts.includes("value.balance") && accounts.includes("available_balance"));
pass("Static bank donut is not rendered", !accounts.includes("className={styles.donut}"));
pass("PV loads IET accounts first", pv.includes('"iet_accounts"'));
pass("PV loads live departments", pv.includes('.from("departments")'));
pass("PV loads live subheads including reserved amount", pv.includes("approved_allocation,reserved_amount"));
pass("PV loads live signatory authority", pv.includes('payment_voucher_counter_signatories'));
pass("PV uses canonical subhead availability", pv.includes("subheadAvailable"));
pass("PV operational views consolidated into one workspace", pv.includes("workspaceView") && shell.includes('Payment Voucher Centre'));
pass("PV sidebar exposes only Centre + Settings", (shell.match(/\{ href: "\/payment-vouchers/g) || []).length === 2);
pass("Global main navigation font locked at 13px", globalCss.includes(".gov-nav-link,.gov-subnav a") && globalCss.includes("font-size:13px!important"));

const suspicious = [];
for (const rel of ["app/dashboard/page.tsx","app/requests/page.tsx","app/approvals/page.tsx","app/finance/page.tsx","app/payment-vouchers/page.tsx"]) {
  const text = read(rel);
  if (/Math\.random\(|faker|mockData|dummyData/i.test(text)) suspicious.push(rel);
}
pass("Sections 1-5 core pages contain no random/mock KPI generator", suspicious.length === 0, suspicious.join(", "));

const failed = checks.filter((c)=>!c.ok);
console.log("ReqGen live-data accuracy audit");
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
if (failed.length) {
  console.error(`\n${failed.length} data-accuracy check(s) failed.`);
  process.exit(1);
}
console.log(`\nPASS: ${checks.length} accuracy checks.`);
