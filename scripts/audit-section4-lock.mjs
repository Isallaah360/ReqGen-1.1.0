import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "app/finance/overview/page.tsx",
  "app/finance/manage-accounts/page.tsx",
  "app/finance/subheads/page.tsx",
  "app/finance/transactions/page.tsx",
  "app/finance/processing/page.tsx",
  "app/finance/reports/page.tsx",
  "app/finance/settings/page.tsx",
  "app/payment-vouchers/centre/page.tsx",
];
const results = requiredFiles.map((file) => ({ file, exists: fs.existsSync(path.join(root, file)) }));
// v4.6.3: /finance/overview forwards to the Finance home; live finance data is read by the v4 Finance pages
const financePage = ["app/finance/subheads/page.tsx", "app/finance/manage-accounts/page.tsx", "app/finance/transactions/page.tsx"].map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n");
const dataAudit = fs.readFileSync(path.join(root, "scripts/audit-data-accuracy.mjs"), "utf8");
const checks = [
  ...results.map((r) => ({ name: r.file, ok: r.exists })),
  { name: "Finance reads live Supabase data", ok: /supabase\.from\(/.test(financePage) },
  { name: "Canonical financial formula remains audited", ok: /Allocation - Reserved - Expenditure|approved_allocation/.test(dataAudit) },
];
const failed = checks.filter((x) => !x.ok);
const report = { generatedAt: new Date().toISOString(), checks: checks.length, failed: failed.length, findings: checks };
fs.mkdirSync(path.join(root, "audit-output"), { recursive: true });
fs.writeFileSync(path.join(root, "audit-output/section4-lock-audit.json"), JSON.stringify(report, null, 2));
console.log(`Section 4 lock audit: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exitCode = 1;
