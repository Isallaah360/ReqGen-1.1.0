// ReqGen v3.1.8 — release lock: Master Backup & Restore, Account Setup Guide,
// distinct PV tab headings, deadlock-safe v3.1.7 SQL.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
const exists = (f) => fs.existsSync(f);
const results = [];
const check = (label, ok) => results.push({ label, ok: Boolean(ok) });

const exp = exists("app/api/backup/export/route.ts") ? read("app/api/backup/export/route.ts") : "";
const res = exists("app/api/backup/restore/route.ts") ? read("app/api/backup/restore/route.ts") : "";
check("Backup export: Admin/Auditor only, by financial year, manifest + master + per-table CSV", exp.includes('["admin", "auditor"]') && exp.includes("01_MANIFEST.csv") && exp.includes("02_REQGEN_MASTER.csv") && exp.includes("tables/") && exp.includes('gte("created_at"'));
check("Restore: preview for Auditor, restore for Admin only, never deletes", res.includes('mode !== "preview" && !isAdmin') && res.includes("ignoreDuplicates") && !/\.delete\(/.test(res));
check("Backup excludes OTP secrets", !read("lib/server/backupCatalog.ts").includes('"sms_otps"'));
check("Backup page under Audit Centre with tab", exists("app/audit-centre/backup/page.tsx") && read("app/components/GovernmentAppShell.tsx").includes('"Master Backup"'));
check("Backup log SQL present", exists("database/v3_1_8_master_backup_log.sql"));
check("Setup Guide: 4 steps checked from real data", exists("lib/profileSetup.ts") && ["password_changed_at", "listFactors", "avatar_url", "signature_url"].every((t) => read("lib/profileSetup.ts").includes(t)));
check("Setup Guide page and Profile tab", exists("app/profile/setup/page.tsx") && read("app/components/GovernmentAppShell.tsx").includes('"Setup Guide"'));
check("Setup Coach mounted in the app frame (banner, welcome, on-page steps)", read("app/components/GovernmentAppShell.tsx").includes("<SetupCoach />") && read("app/components/SetupCoach.tsx").includes("data-guide"));
check("Profile marks guide targets", read("app/profile/page.tsx").includes('data-guide="signature"') && read("app/profile/page.tsx").includes('data-guide="avatar"'));
check("Password change records password_changed_at", read("app/change-password/page.tsx").includes("password_changed_at"));
check("PV tabs introduce themselves", read("app/payment-vouchers/page.tsx").includes("VIEW_HEADINGS[workspaceView].title"));
check("v3.1.9 SQL replaces v3.1.7 (deadlock-safe parts)", read("database/v3_1_9_print_register_tracker.sql").includes("PART 2") && read("database/v3_1_7_registers_tracker_manual_pv.sql").includes("SUPERSEDED"));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}`); }
if (failed) { console.error(`\nv3.1.8 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv3.1.8 release lock: PASS (${results.length} checks).`);
