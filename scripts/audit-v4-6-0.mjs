// ReqGen v4.6.0 — release lock: Administration (mock-ups 79–90).
import fs from "node:fs";
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const results = [];
const check = (label, ok) => results.push([label, !!ok]);
const sql = read("database/v4_6_0_administration.sql");
const v4 = (f) => /<(V4Page|MotherPage)\b/.test(read(f));

const pages = {
  "app/admin/page.tsx": "Administration home (79)",
  "app/admin/system-accounts/page.tsx": "System Accounts (80)",
  "app/admin/users/page.tsx": "Staff & Positions (81)",
  "app/admin/users/[id]/page.tsx": "Staff record (82)",
  "app/admin/positions/page.tsx": "Positions (83)",
  "app/admin/roles/page.tsx": "Permissions Matrix (84)",
  "app/admin/departments/page.tsx": "Departments (85)",
  "app/admin/routing/page.tsx": "Routing Engine (86)",
  "app/admin/security/page.tsx": "Security Centre (87)",
  "app/admin/system-health/page.tsx": "Diagnostics (88)",
};
check("Administration pages are v4 pages (mock-ups 79–88)", Object.keys(pages).every(v4));
check("Passcode setup and passcode sign-in (mock-ups 89–90)", read("app/profile/passcode/page.tsx").includes("PasscodePad") && read("app/login/page.tsx").includes("PasscodePad") && read("app/login/page.tsx").includes("Use password instead") && read("app/login/page.tsx").includes("Forgot passcode?"));
check("Old Administration pages forward to their v4 page", [
  ["app/admin/overview/page.tsx", 'redirect("/admin")'], ["app/admin/access-audit/page.tsx", 'redirect("/admin/roles")'],
  ["app/admin/account-routing/page.tsx", 'redirect("/admin/routing?tab=accounts")'], ["app/admin/department-routing/page.tsx", 'redirect("/admin/routing?tab=backups")'],
  ["app/admin/settings/page.tsx", 'redirect("/admin/routing?tab=officers")'], ["app/admin/release-readiness/page.tsx", 'redirect("/admin/system-health")'],
  ["app/admin/workflow-test/page.tsx", 'redirect("/admin/system-health?tab=route")'], ["app/admin/audit/page.tsx", 'redirect("/audit-centre/logs?module=Administration")'],
].every(([f, t]) => read(f).includes(t)));

check("Routing engine is only read and saved through its own function", read("lib/v4/routing.ts").includes('rpc("reqgen_department_route_overview"') && read("lib/v4/routing.ts").includes('rpc("reqgen_save_department_route"')
  && !/from\("reqgen_(route_steps|route_templates|department_routes)"\)\.(insert|update|upsert|delete)/.test(read("app/admin/routing/page.tsx") + read("app/admin/departments/page.tsx") + read("lib/v4/routing.ts")));
check("SQL: routing engine untouched", !/create or replace function public\.(approve_request_step|reject_request_step|reqgen_next_route_step|build_request_route|reqgen_build_route_for_template|reqgen_save_department_route|reqgen_department_route_overview)\b/i.test(sql)
  && !/(alter|drop|truncate|insert into|update|delete from)\s+(table\s+)?public\.reqgen_(route_steps|route_templates|department_routes|department_stage_officers|stage_backups)\b/i.test(sql));
check("Institution officers saved by their key (one row each)", read("app/admin/routing/page.tsx").includes('{ onConflict: "key" }'));

const usersApi = read("app/api/admin/users/[id]/route.ts");
check("Staff are deactivated, never deleted; sign-in blocked and reason kept", usersApi.includes('action === "deactivate"') && usersApi.includes("ban_duration") && usersApi.includes("deactivated_reason") && !/auth\.admin\.deleteUser\(id/.test(usersApi));
check("Reset 2FA and remove passcodes are Administration actions", usersApi.includes('action === "reset2fa"') && usersApi.includes('action === "removePasscodes"'));
check("Only the Developer can change a system account", usersApi.includes("Only the Developer can change a system account"));
check("Every Administration action is written to the Audit Log", ["Staff record changed", "Staff deactivated", "2FA reset", "Passcodes removed"].every((a) => usersApi.includes(a)) && read("app/api/admin/users/route.ts").includes("Staff added") && read("app/api/admin/handover/route.ts").includes("Super Admin account handed over"));
check("New staff: position assigned as the signed-in administrator", read("app/api/admin/users/route.ts").includes('actorClient.rpc("reqgen_assign_profile_role"'));
check("Hand over needs the 2FA code and signs the old keeper out", read("app/api/admin/handover/route.ts").includes("ctx.aal2") && read("app/api/admin/handover/route.ts").includes('"HAND OVER"') && read("app/admin/system-accounts/page.tsx").includes("codeOnly: true"));
check("Server routes check Super Admin or Developer", ["app/api/admin/users/[id]/route.ts", "app/api/admin/handover/route.ts"].every((f) => read(f).includes("adminFromRequest")) && read("lib/server/adminAuth.ts").includes("Only the Super Admin or the Developer can do this."));

check("Super Admin cannot raise, approve, sign, stamp or pay (Permissions Matrix)", read("lib/v4/admin.ts").includes('{ action: "Raise a request", cells: cells({ SA: "n", Dev: "n" }, "y") }') && read("lib/v4/admin.ts").includes('{ action: "Sign, stamp and authorise voucher", cells: cells({ DG: "y", GS: "route" }) }') && read("app/admin/roles/page.tsx").includes("MATRIX"));
check("Balances row follows the enforced rule (Staff, Registry and PD never)", /action: "See subhead balances", cells: cells\(\{(?![^}]*\b(Staff|Rgy|PD):)[^}]*\}\)/.test(read("lib/v4/admin.ts")));
check("Security rules: stay signed in, idle sign-out, passcode tries (set in one place)", sql.includes("reqgen_security_rules_save") && read("lib/server/mfaWindow.ts").includes("reqgen_security_rules") && read("app/api/auth/passcode/route.ts").includes("passcodeTries") && read("app/components/SessionTimeout.tsx").includes("reqgen_security_rules"));
check("People read the hours and tries that are actually set", read("lib/v4/useSecurityRules.ts").includes("reqgen_security_rules") && read("app/profile/passcode/page.tsx").includes("{rules.passcodeTries} wrong tries") && read("app/login/page.tsx").includes("{rules.stayHours} hours"));
check("Signing, stamping and paying still need a fresh fingerprint or 2FA code", read("lib/v4/freshConfirm.ts").includes("export async function confirmFresh"));
check("Diagnostics: health, data checks and route preview", read("app/admin/system-health/page.tsx").includes('rpc("reqgen_diagnostics"') && sql.includes("Officers who sign but have no signature"));
check("Developer actions tell the Super Admin", sql.includes("reqgen_tell_superadmin_of_developer") && read("app/admin/system-accounts/page.tsx").includes("every Developer action is logged"));

const perm = read("lib/permissions.ts");
check("Monthly finance report print is not open to Staff, Registry or PD", perm.includes('{ prefix: "/reports/print", roles: ["admin", "auditor", "account", "accounts", "accountofficer", "dg", "directorgeneral", "generalsecretary"] }') && read("app/reports/print/page.tsx").includes('=== "mine"'));
check("Access: Administration for the Super Admin only", perm.includes('{ prefix: "/admin", roles: ["admin"] }'));
check("Route registry lists the new pages", ["/admin/system-accounts", "/admin/positions", "/admin/users/[id]"].every((p) => read("lib/routeRegistry.ts").includes(`"pattern": "${p}"`)));
check("SQL: nothing dropped permanently", !/drop table(?! if exists v460_report)/i.test(sql) && !/^\s*truncate (?!v460_report)/im.test(sql) && !/delete from public\./i.test(sql));
check("SQL ends with an all-OK verification table", /from v460_report order by[^;]*;\s*$/.test(sql.trim()));
check("No .env file shipped", !fs.existsSync(".env") || read(".gitignore").includes(".env"));

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.6.0 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.6.0 release lock: PASS (${results.length} checks).`);
