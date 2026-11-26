// ReqGen 6.1.0 with app 4.1.0: HR's rule, the sender's subhead, and every office as an app screen.
import fs from "node:fs";
import path from "node:path";
const read = (f) => fs.readFileSync(f, "utf8");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); if (!ok) failures += 1; };

const sql = read("database/v6_1_0_requests_hr_rule.sql");
check("Database: only the sender changes a request, only when it is back with them", sql.includes("create trigger reqgen_hr_rule_guard before update on public.requests") && sql.includes("Only the person who sent this request can change it"));
check("Database: correcting is for the sender, only when sent back (no early edits)", sql.includes("This request is with an officer. You can change it when it is sent back to you.") && !/v_early/.test(sql));
check("Database: comments by anyone who can open the request", sql.includes("function public.reqgen_request_comment") && sql.includes("reqgen_can_open_request(p_request_id)"));
check("Database: an official request carries the sender's subhead", sql.includes("REQGEN_SUBHEAD: Choose the budget subhead"));
check("Database step drops nothing", !/drop\s+(table|function|column|policy)/i.test(sql));

const app = "mobile/app/src";
const screens = read(`${app}/lib/screens.tsx`);
const modules = read(`${app}/lib/rules/modules.ts`);
const tiles = [...modules.matchAll(/\{ href: "(\/[^"#]+)"/g)].map((m) => m[1]).filter((h) => !/^\/(dashboard|requests\/(mine|new)|approvals\/(inbox|treated)|profile\/(details|security))/.test(h));
const missing = [...new Set(tiles)].filter((h) => !screens.includes(`"${h}"`));
check(`App: every office page is an app screen (${tiles.length} pages)`, missing.length === 0);
if (missing.length) console.log("      missing:", missing.join(", "));
check("App: the vouchers buttons open app screens", !read(`${app}/screens/Home.tsx`).includes("Coming") && !read(`${app}/screens/Approvals.tsx`).includes("Coming"));
check("App: the sender chooses the subhead with the live check and the Auditor's name", read(`${app}/screens/Budget.tsx`).includes("reqgen_department_subhead_names") && read(`${app}/screens/Budget.tsx`).includes("reqgen_subhead_live_check") && read(`${app}/screens/Budget.tsx`).includes("reqgen_help_contact"));
check("App: correcting only when sent back; officers comment", read(`${app}/screens/Detail.tsx`).includes("<EditRequest") && read(`${app}/screens/Detail.tsx`).includes("reqgen_request_comment") && read(`${app}/screens/EditRequest.tsx`).includes("reqgen_correct_request"));
check("App: IET A4 request and voucher PDFs made in the app", read(`${app}/lib/a4.ts`).includes("export async function printVoucher") && read(`${app}/lib/a4.ts`).includes("export async function printRequest"));
const appFiles = walk(app).filter((f) => /\.(tsx?)$/.test(f));
const appSrc = appFiles.map(read).join("\n");
// 6.2.0: the website address may appear in exactly one place, a4.ts, as the text inside the QR code printed on
// paper (the public check page). No app file may fetch the website or its /api routes.
const siteNamed = appFiles.filter((f) => /ietreqgen\.barderians\.com\.ng/.test(read(f))).map((f) => f.replace(/\\/g, "/"));
const a4 = read(`${app}/lib/a4.ts`);
check("App: never calls the website (address only inside the printed QR)", siteNamed.every((f) => f.endsWith("lib/a4.ts")) && !/fetch\([^)]*ietreqgen|fetch\(\s*["'`]\/api\//.test(appSrc) && !/fetch\(\s*CHECK_SITE/.test(a4) && !read("mobile/app/index.html").includes("barderians"));
check("App: the secret service key is never read", !/SERVICE_ROLE/.test(appSrc) && read("mobile/app/vite.config.ts").includes('envPrefix: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]'));
check("Edge Function reqgen-office built from the website's own server code", fs.existsSync("supabase/functions/reqgen-office/index.ts") && read("scripts/build-edge.mjs").includes('"app/api/admin/users/[id]/route.ts"') && read("supabase/config.toml").includes("[functions.reqgen-office]") && read("deploy_functions.ps1").includes('"reqgen-office"'));
check("Website build skips the Supabase functions folder", read("tsconfig.json").includes('"supabase"') && read("eslint.config.mjs").includes('"supabase/**"'));
const pkg = JSON.parse(read("package.json"));
check("Website version 6.1.0 or later", /^(6\.([1-9]|\d\d)|([7-9]|\d\d)\.)/.test(pkg.version));
const appVer = (read("mobile/version.properties").match(/REQGEN_VERSION_NAME=(.+)/) || [])[1]?.trim() || "";
check("App version 4.1.0 or later", /^4\.([1-9]|\d\d)\./.test(appVer) && read(`${app}/lib/core.ts`).includes(`APP_VERSION = "${appVer}"`));
if (failures) { console.log(`\nv6.1.0 release lock: ${failures} failure(s).`); process.exit(1); }
console.log("\nv6.1.0 release lock: all checks passed.");
