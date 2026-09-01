import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "app/requests/page.tsx",
  "app/requests/new/page.tsx",
  "app/requests/[id]/page.tsx",
  "app/approvals/page.tsx",
  "app/approvals/action-centre/page.tsx",
  "app/finance/page.tsx",
  "app/payment-vouchers/page.tsx",
  "app/workflow/page.tsx",
  "app/registry/page.tsx",
  "app/audit-centre/page.tsx",
  "lib/permissions.ts",
];

const findings = required.map((file) => ({
  file,
  exists: fs.existsSync(path.join(root, file)),
}));

const missing = findings.filter((item) => !item.exists);
const output = {
  generatedAt: new Date().toISOString(),
  requiredFiles: findings.length,
  missingFiles: missing.length,
  status: missing.length ? "failed" : "passed",
  findings,
};

const outputDir = path.join(root, "audit-output");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "workflow-readiness.json"), JSON.stringify(output, null, 2));

console.log(`Workflow readiness: ${output.status.toUpperCase()}`);
console.log(`Required files: ${findings.length}`);
console.log(`Missing files: ${missing.length}`);
if (missing.length) {
  for (const item of missing) console.error(`- Missing: ${item.file}`);
  process.exitCode = 1;
}
