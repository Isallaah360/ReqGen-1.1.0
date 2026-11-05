// ReqGen v4.6.7 — release lock: sign-up asks for name (in capital letters), phone and email;
// the phone number is required; the 2FA code boxes fit every phone; HR section permissions
// are not shown as positions; Official and Personal routes are set in separate views;
// the Routing Engine is untouched; the queue trace SQL is read-only.
import fs from "node:fs";
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const results = [];
const check = (label, ok) => results.push([label, !!ok]);
const signup = read("app/signup/page.tsx");
const theme = read("app/v4/v4-theme.css");

check("Phone number is marked required on sign-up", /Phone number <span className="v4-req">\*<\/span>/.test(signup));
check("Sign-up refuses a missing or wrong phone number", signup.includes("^(0\\d{10}|\\+?234\\d{10})$") && signup.includes("Write your phone number"));
check("Sign-up never calls the phone number optional", !/Optional/i.test(signup));
check("The phone number is saved (never left empty)", signup.includes("phone,") && !signup.includes("f.phone.trim() || null"));
check("Full name is typed and saved in CAPITAL LETTERS", signup.includes("e.target.value.toUpperCase()") && signup.includes(".toUpperCase(), phone"));
check("Code boxes fit a phone screen (no cut-off 2FA card)", theme.includes("v4.6.7") && /@media \(max-width: 480px\)[\s\S]*\.v4-otp input \{ width: 42px/.test(theme));
check("Version 4.6.7 or a later 4.6 release", /REQGEN_SEMVER = "4\.6\.([7-9]|[1-9]\d)"/.test(read("lib/version.ts")) && /"version": "4\.6\.([7-9]|[1-9]\d)"/.test(read("package.json")));
const active = read("lib/activeRole.ts");
const roles = read("lib/roles.ts");
const routing = read("app/admin/routing/page.tsx");
const routingLib = read("lib/v4/routing.ts");
const trace = read("database/v4_6_7_request_queue_trace_READONLY.sql");
check("HR section permissions are not listed as positions", !active.includes('.from("hr_officer_assignments")') && active.includes("isPermissionToken(key)"));
check("Permission tokens read as HR Officer and are flagged", roles.includes("export function isPermissionToken") && roles.includes('startsWith("hr:")) return "HR Officer"'));
check("My Access skips permission tokens", read("app/profile/access/page.tsx").includes("isPermissionToken(k)"));
check("Profile lists Staff plus held positions", read("app/profile/page.tsx").includes('names.unshift("Staff")'));
check("Routing has separate Official and Personal Requests views", routing.includes('official: ["official"], personal: ["personal_fund", "personal_other"]') && routing.includes('"Official Requests"') && routing.includes('"Personal Requests"'));
check("Both views save through the existing engine call (all lanes sent)", routing.includes("saveRoute(editor.deptId, editor.lanes, editor.officers, editor.dgVacant)") && routingLib.includes('const kinds: RouteKind[] = ["official", "personal_fund", "personal_other"]') && routingLib.includes('supabase.rpc("reqgen_save_department_route"'));
check("No routing-engine function is created or replaced in this release", !/create\s+or\s+replace\s+function\s+public\.(approve_request_step|reqgen_next_route_step|build_request_route|reqgen_build_route_for_template|reqgen_save_department_route)/i.test(trace));
check("Queue trace SQL only reads (no insert/update/delete/alter/drop/create)", trace.length > 0 && !/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke)\s/i.test(trace.replace(/--.*$/gm, "")));
check("No .env file shipped", !fs.existsSync(".env") || read(".gitignore").includes(".env"));

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.6.7 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.6.7 release lock: PASS (${results.length} checks).`);
