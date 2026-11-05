// ReqGen v4.6.8 — release lock: the Super Admin and Developer see and set every Administration setting
// (staff, departments, paying accounts, officers) whatever the older table rules say; one setting shows
// everywhere; FUNDRAISING is paid like General Admin; every officer step can choose the subhead (HR
// recommends on a personal fund); DG approval follows the department's Account Officer; signatures show
// the step's position. The Routing Engine is not changed.
import fs from "node:fs";
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const results = [];
const check = (label, ok) => results.push([label, !!ok]);
const sql = read("database/v4_6_8_admin_access.sql");
const body = sql.replace(/--.*$/gm, "");
const depts = read("app/admin/departments/page.tsx");
const routing = read("app/admin/routing/page.tsx");
const work = read("app/components/requests/RequestDetailsWorkspace.tsx");
const roles = read("lib/roles.ts");
const sub = read("app/finance/subheads/[id]/page.tsx");

check("SQL: admin rules are only ADDED (no existing rule dropped)", !/drop\s+policy\s+if\s+exists\s+(?!reqgen_v468_|reqgen_policy_snapshots_read)/i.test(body) && body.includes("reqgen_v468_admin_read"));
check("SQL: rules added only where row-level security is on", body.includes("if not v_rls then"));
check("SQL: copy of current rules kept for undo", body.includes("reqgen_policy_snapshots") && body.includes("grant select on public.reqgen_policy_snapshots to authenticated"));
check("SQL: Administration functions check Super Admin / Developer", (body.match(/if not public\.reqgen_is_admin\(\) then raise exception/g) || []).length >= 3);
check("SQL: requests table not opened to the Super Admin", !/\('requests',/.test(body));
check("SQL: routing engine not created or replaced", !/create\s+or\s+replace\s+function\s+public\.(approve_request_step|reqgen_next_route_step|build_request_route|reqgen_build_route_for_template|reqgen_save_department_route|reqgen_actor_role_for_stage)\b/i.test(body));
check("SQL: route tables not written", !/(insert\s+into|update|delete\s+from)\s+public\.(reqgen_route_templates|reqgen_route_steps|reqgen_department_routes)\b/i.test(body));
check("SQL: FUNDRAISING paid from General Admin's account", body.includes("'FUNDRAISING'") && body.includes("same as General Admin"));
check("SQL: Account Officer must hold the position (as the Routing Engine requires)", body.includes("does not hold the Account Officer position"));
check("SQL: ends with the report table and reloads the API", sql.trim().endsWith("order by step, item;") && body.includes("notify pgrst, 'reload schema'"));
check("Departments: reads through the Administration functions", depts.includes('rpc("reqgen_admin_people")') && depts.includes('rpc("reqgen_admin_departments_data")'));
check("Departments: saves through reqgen_admin_save_department", depts.includes('rpc("reqgen_admin_save_department"'));
check("Departments: never prints undefined names", !/\$\{nameOf\.get\(/.test(depts) && depts.includes("const who = "));
check("Departments: account list shows the fund; chosen account shows fund, given out and balance", depts.includes("no fund yet") && depts.includes("Given to subheads") && depts.includes("Balance"));
check("Departments: Account Officers first, filled from the account", depts.includes('"Account Officers"') && depts.includes("officerOf(v)"));
check("Routing: Accounts tab saves through the function", routing.includes('rpc("reqgen_admin_set_department_account"'));
check("Routing: Copy steps from another department", routing.includes("Copy steps from"));
check("Request: HR Coordinator counts as HR for the subhead", work.includes("function workflowRole") && work.includes('"hrcoordinator"'));
check("Request: one subhead function for every officer step", work.includes('rpc("reqgen_officer_assign_subhead"'));
check("Request: DG follows the department's Account Officer", work.includes('rpc("reqgen_department_account_officer"') && !work.includes("has no Account Officer routing"));
check("Request: clear message when a department has no subheads", work.includes("has no subheads yet"));
check("Signatures show the step's position", roles.includes("export function signedAsLabel") && work.includes("signedAsLabel("));
check("New subhead: funded from its department's account by default", sub.includes("paysFrom[v]"));
check("Version 4.6.8 or a later 4.6 release", /REQGEN_SEMVER = "4\.6\.([8-9]|[1-9]\d)"/.test(read("lib/version.ts")) && /"version": "4\.6\.([8-9]|[1-9]\d)"/.test(read("package.json")));
check("No .env file shipped", !fs.existsSync(".env") || read(".gitignore").includes(".env"));

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.6.8 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.6.8 release lock: PASS (${results.length} checks).`);
