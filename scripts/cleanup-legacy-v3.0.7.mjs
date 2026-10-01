// ReqGen v3.0.7 — one-off legacy cleanup.
// Removes 30 files/folders left behind by earlier copy-over patches: the old
// HR, Executive and Staff modules (53 pages that any signed-in user could
// open outside the access rules), unused components, and a Windows cache file.
// Nothing here is imported or linked by the live application (verified:
// typecheck, lint, build and all audits pass without them).
//
// Run ONCE from the project folder:   node scripts/cleanup-legacy-v3.0.7.mjs
// Safe to re-run: missing items are skipped. Deletes ONLY the paths below.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LEGACY = [
  "app/components/AppPageFooter.tsx",
  "app/components/ApprovedMockupFrame.tsx",
  "app/components/GlobalPageHeader.tsx",
  "app/components/GlobalPageShell.tsx",
  "app/components/LegacyRootNavigation.tsx",
  "app/components/NavBar.tsx",
  "app/components/admin/AdminUI.tsx",
  "app/components/executive",
  "app/components/hr",
  "app/components/payment-vouchers",
  "app/components/print",
  "app/components/registry/RegistryCentre.tsx",
  "app/components/registry/RegistryNavigation.tsx",
  "app/components/registry/RegistryRegister.tsx",
  "app/components/staff",
  "app/components/ui/DirectorateWorkspaceMenu.tsx",
  "app/components/ui/PublicPageShell.tsx",
  "app/components/ui/ReportsUI.tsx",
  "app/components/ui/ReqGenDesignSystem.tsx",
  "app/components/ui/ReqGenUI.tsx",
  "app/executive",
  "app/finance/_components/FinanceModulePlaceholder.tsx",
  "app/finance/_components/FinanceOutputWorkspace.tsx",
  "app/hr",
  "app/staff",
  "lib/approvedMockupSpecs.ts",
  "lib/sendchampEmail.ts",
  "public/photothumb.db",
  "scripts/audit-approved-mockup-frame.mjs",
  "scripts/audit-sections-5-12-mockups.mjs",
];

if (!fs.existsSync(path.join(ROOT, "package.json")) || !fs.existsSync(path.join(ROOT, "app"))) {
  console.error("Run this from the ReqGen project folder (where package.json is).");
  process.exit(1);
}
let removed = 0;
for (const rel of LEGACY) {
  const full = path.join(ROOT, rel);
  if (!full.startsWith(ROOT + path.sep)) continue;
  if (fs.existsSync(full)) {
    fs.rmSync(full, { recursive: true, force: true });
    removed += 1;
    console.log("removed  " + rel);
  }
}
console.log(`\nLegacy cleanup complete: ${removed} item(s) removed, ${LEGACY.length - removed} already absent.`);
