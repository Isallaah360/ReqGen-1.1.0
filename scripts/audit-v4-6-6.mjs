// ReqGen v4.6.6 — release lock: the Super Admin and Developer system accounts, the Developer
// Console (its own look, module switches, releases, live account status), and access rules.
import fs from "node:fs";
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const results = [];
const check = (label, ok) => results.push([label, !!ok]);
const sql = read("database/v4_6_6_system_accounts.sql");
const frame = read("app/components/v4/AppFrame.tsx");
const guard = read("app/components/RouteAccessGuard.tsx");
const fn = (name) => { const a = sql.indexOf(`create or replace function public.${name}`); return a < 0 ? "" : sql.slice(a, sql.indexOf("$$;", a)); };

// 1. SQL
check("Functions backed up before they are replaced", sql.indexOf("insert into public.reqgen_function_backups") > 0 && sql.indexOf("insert into public.reqgen_function_backups") < sql.indexOf("create or replace function"));
check("Both system accounts repaired: staff record, marked, active, no department, own position, acting as it", ["ietreqgen@gmail.com", "info@barderians.com.ng"].every((e) => sql.includes(e)) && sql.includes("dept_id = null") && sql.includes("insert into public.profiles (id, full_name, email, role, dept_id, is_active, is_admin, system_account") && sql.includes("update public.user_active_roles set active_role_key = 'admin'"));
check("A missing sign-in is reported, never invented", sql.includes("NO sign-in exists for this email yet"));
check("Only ietreqgen@gmail.com is the Super Admin: personal accounts lose it, logged for undo, only once the Super Admin exists", sql.includes("Super Admin position removed") && sql.includes("reqgen_role_changes") && sql.includes("NOT changed yet: the Super Admin account must exist first"));
check("Positions are switched off, never deleted", !/delete from public\.(profile_roles|profiles|user_active_roles)/i.test(sql) && sql.includes("set is_active = false"));
check("Super Admin powers = the Super Admin account acting as Super Admin, or the Developer", fn("reqgen_is_super_admin").includes("reqgen_is_system_super_admin() and public.reqgen_active_role_key() in ('admin', 'superadmin')") && fn("reqgen_is_super_admin").includes("or public.reqgen_is_developer()"));
check("Finance changes: Super Admin, Developer, Auditor; reset and restore: Super Admin, Developer", fn("reqgen_finance_powers").includes("'can_correct', v_super or v_auditor") && fn("reqgen_finance_powers").includes("'can_reset', v_super"));
check("Module switches and releases: Developer only; a switched-off module needs a message", fn("reqgen_set_module").includes("Only the Developer can switch modules") && fn("reqgen_set_module").includes("Write the message people will see") && fn("reqgen_publish_release").includes("Only the Developer can publish a release"));
check("A release tells the Super Admin", fn("reqgen_publish_release").includes("system_account = 'superadmin'") && fn("reqgen_publish_release").includes("insert into public.notifications"));
check("Account status: Super Admin and Developer only", fn("reqgen_system_accounts_status").includes("Only the Super Admin and the Developer can see the system accounts"));
check("SQL ends with an all-OK verification table", /from v466_report order by[^;]*;\s*$/.test(sql.trim()));
check("SQL: routing engine untouched", !/create or replace function public\.(approve_request_step|reject_request_step|reqgen_next_route_step|build_request_route|reqgen_build_route_for_template|reqgen_save_department_route)\b/i.test(sql));

// 2. Sign-in and access
check("A signed-in account with no staff record is told so (not 'not open to you')", guard.includes('reason=no-profile') && read("app/unauthorized/page.tsx").includes('reason === "no-profile"') && read("lib/auth.ts").includes("hasProfile"));
check("Page checks use the acting position plus the Developer marker", read("lib/auth.ts").includes("export function accessRoleSet") && guard.includes("accessRoleSet(context)") && frame.includes("accessRoleSet(context)"));
check("Developer Console: Developer account only", read("lib/permissions.ts").includes('{ prefix: "/developer", roles: ["developer"] }') && read("scripts/audit-rbac-matrix.mjs").includes('{ prefix: "/developer", allow: [] }'));
check("Switched-off modules: staff see the message, menu hides them, the Developer still opens them", guard.includes("reason=module-off") && guard.includes('context.systemAccount !== "developer"') && frame.includes("isDeveloper || !isOff(m)") && read("app/unauthorized/page.tsx").includes('reason === "module-off"'));
check("Dashboard, My Account and Administration cannot be switched off", !/\b(dashboard|admin|profile|notifications)\b/.test((read("lib/v4/moduleSwitches.ts").match(/SWITCH_PREFIXES[^}]*\}/s) || [""])[0].replace(/\/\/.*$/gm, "")));

// 3. The Developer's own interface
check("Developer Console has its own look (console menu, brand, badge) in light and dark", frame.includes('root.dataset.console = "developer"') && frame.includes("ReqGen Console") && frame.includes("DEVELOPER CONSOLE") && read("app/v4/v4-theme.css").includes('html[data-console="developer"] .v4-root .v4-sidebar') && read("app/v4/v4-theme.css").includes('html[data-theme="dark"][data-console="developer"] .v4-root'));
check("Developer lands on the Console; the Trust Dashboard is one click away", frame.includes('router.replace("/developer")') && frame.includes("/dashboard?view=trust"));
check("Console pages: overview, modules, releases, accounts, activity", ["app/developer/page.tsx", "app/developer/modules/page.tsx", "app/developer/releases/page.tsx", "app/developer/accounts/page.tsx", "app/developer/activity/page.tsx"].every((f) => /<V4Page\b/.test(read(f))) && read("app/developer/modules/page.tsx").includes('rpc("reqgen_set_module"') && read("app/developer/releases/page.tsx").includes('rpc("reqgen_publish_release"'));
check("What's new for everyone", /<V4Page\b/.test(read("app/whats-new/page.tsx")) && read("lib/permissions.ts").includes('{ prefix: "/whats-new", authenticatedOnly: true }'));
check("Route registry lists the new pages", ["/developer", "/developer/modules", "/developer/releases", "/developer/accounts", "/developer/activity", "/whats-new"].every((p) => read("lib/routeRegistry.ts").includes(`"pattern": "${p}"`)));

// 4. Super Admin is not staff
check("System accounts need no signature or photo", read("lib/profileSetup.ts").includes("profile.system_account ? SETUP_ORDER.filter"));
check("Developer actions have their own Audit Log tab (Super Admin and Auditor can read it)", read("app/audit-centre/logs/page.tsx").includes('key: "developer"') && read("app/audit-centre/logs/page.tsx").includes("isDev(r)"));
check("System Accounts page shows both accounts live", read("app/admin/system-accounts/page.tsx").includes("loadSystemAccounts()"));
check("Server guard for reset and restore: Super Admin or Developer, decided by the database", read("lib/server/superAdmin.ts").includes("d.can_reset") && !read("lib/server/superAdmin.ts").includes('p.system_account === "developer"'));

check("Version 4.6.6", read("lib/version.ts").includes('REQGEN_SEMVER = "4.6.6"') && read("package.json").includes('"version": "4.6.6"'));
check("No .env file shipped", !fs.existsSync(".env") || read(".gitignore").includes(".env"));

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.6.6 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.6.6 release lock: PASS (${results.length} checks).`);
