// ReqGen v3.1.2 — removes the retired watermark files (no longer imported).
// Run once from the project folder:  node scripts/cleanup-v3.1.2.mjs
import fs from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
const RETIRED = ["app/components/BrandBackdrop.tsx", "public/brand"];
if (!fs.existsSync(path.join(ROOT, "package.json"))) { console.error("Run from the ReqGen project folder."); process.exit(1); }
let n = 0;
for (const rel of RETIRED) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) { fs.rmSync(full, { recursive: true, force: true }); n++; console.log("removed  " + rel); }
}
console.log(`Cleanup complete: ${n} item(s) removed.`);
