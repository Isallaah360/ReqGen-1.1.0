// ReqGen v4.0.0 — removes files retired by the v4 frame (no longer imported).
// Run once from the project folder:  node scripts/cleanup-v4.0.0.mjs
import fs from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
const RETIRED = [
  "app/components/notifications/NotificationCentre.tsx", // replaced by app/components/v4/Bell.tsx
  "app/components/ActivityStrip.tsx",                     // loading bar now inside the v4 frame
  "app/components/ThemeToggle.tsx",                       // theme choice is in the account menu
  "app/components/ReqGenFooter.tsx",                      // footer is inside the v4 frame
  "lib/mockupRouteTypes.ts",                              // v3 mock-up route markers
  "app/dashboard/dashboard.module.css",                   // v3 dashboard styles
  "scripts/audit-shell-lock.mjs",                         // v3 shell lock → scripts/audit-v4-0-0.mjs
  "scripts/audit-theme.mjs",                              // v3 theme lock → scripts/audit-v4-0-0.mjs
  "scripts/audit-approved-redesign.mjs",                  // v3 navigation lock → scripts/audit-v4-0-0.mjs
];
if (!fs.existsSync(path.join(ROOT, "package.json"))) { console.error("Run from the ReqGen project folder."); process.exit(1); }
let n = 0;
for (const rel of RETIRED) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) { fs.rmSync(full, { recursive: true, force: true }); n++; console.log("removed  " + rel); }
}
const notifDir = path.join(ROOT, "app/components/notifications");
if (fs.existsSync(notifDir) && fs.readdirSync(notifDir).length === 0) { fs.rmdirSync(notifDir); console.log("removed  app/components/notifications/"); }
console.log(`Cleanup complete: ${n} item(s) removed.`);
