import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const checks = [];
const pass = (name, ok, detail="") => checks.push({name,ok,detail});

// v4.6.3: /finance/overview forwards to the Finance home; its live data now comes from the v4 summary and pages
const finance = read("lib/v4/summaries.ts") + read("lib/v4/finance.ts") + read("app/finance/subheads/page.tsx") + read("app/finance/transactions/page.tsx") + read("app/finance/transactions-centre/page.tsx") + read("app/payment-vouchers/approved/page.tsx");
const accounts = read("app/finance/manage-accounts/page.tsx");
// v4.3: the voucher pages are separate v4 pages sharing lib/v4/finance.ts and lib/v4/vouchers.ts
const pv = ["app/payment-vouchers/centre/page.tsx", "app/payment-vouchers/new/page.tsx", "app/payment-vouchers/manual/page.tsx", "app/payment-vouchers/[id]/page.tsx", "app/payment-vouchers/settings/page.tsx", "lib/v4/finance.ts", "lib/v4/vouchers.ts"].map(read).join("\n");
const shell = (read("app/components/GovernmentAppShell.tsx") + read("app/components/v4/AppFrame.tsx") + read("app/components/v4/Bell.tsx") + read("lib/v4/modules.ts"));
const globalCss = read("app/globals.css");

pass("Finance uses live departments", finance.includes('.from("departments")'));
pass("Finance uses live subheads", finance.includes('.from("subheads")'));
pass("Finance uses live transactions", finance.includes('.from("finance_transactions")'));
pass("Finance uses live payment vouchers", finance.includes('.from("payment_vouchers")'));
pass("Finance uses live IET accounts", finance.includes('.from("iet_accounts")'));
pass("Department expenditure visual is fully reachable (untruncated or paginated)", !finance.includes("departmentSpend.slice(") || (finance.includes("deptSafePage") && finance.includes("MiniPager")));
pass("Budget health visual is not truncated", !finance.includes(".slice(0, 6)"));
pass("Finance canonical subhead balance is Allocation - Reserved - Expenditure", finance.includes("export function subheadLeft") && finance.includes("subheadUsed"));
pass("IET bank distribution is not top-4 truncated", !accounts.includes(".slice(0, 4)"));
pass("IET bank distribution includes live available balance", (accounts + read("lib/v4/finance.ts")).includes("available_balance") && accounts.includes("accountAvailable"));
pass("Static bank donut is not rendered", !accounts.includes("className={styles.donut}"));
pass("PV loads IET accounts first", pv.includes('"iet_accounts"'));
pass("PV loads live departments", pv.includes('.from("departments")'));
pass("PV loads live subheads including reserved amount", pv.includes("approved_allocation,reserved_amount"));
pass("PV loads live signatory authority", pv.includes('payment_voucher_counter_signatories'));
pass("PV uses canonical subhead availability", pv.includes("export function subheadLeft") && read("app/payment-vouchers/manual/page.tsx").includes("subheadLeft(sub)"));
// v3.1.6: the PV views are numbered module tabs (owner decision), one workspace component.
pass("PV operational views are pages of one workspace, opened from the v4 mother page", ["pending", "approved", "history", "print-centre"].every((v) => !read(`app/payment-vouchers/${v}/page.tsx`).includes("../centre/page")) && shell.includes('title: "Voucher Centre"') && shell.includes('href: "/payment-vouchers/pending"'));
pass("PV mother page tiles expose Centre, views, Manual Voucher and Signatories", (shell.match(/\{ href: "\/payment-vouchers\//g) || []).length === 8 && shell.includes('title: "Manual Voucher"') && shell.includes('href: "/payment-vouchers/settings"'));
pass("Global main navigation font locked at 13px", globalCss.includes(".gov-nav-link,.gov-subnav a") && globalCss.includes("font-size:13px!important"));

const suspicious = [];
for (const rel of ["app/dashboard/page.tsx","app/requests/mine/page.tsx","app/approvals/inbox/page.tsx","app/finance/page.tsx","app/payment-vouchers/centre/page.tsx"]) {
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
