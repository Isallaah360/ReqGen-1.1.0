// ReqGen 6.3.0 with app 4.2.0: backup officers take over a request that waits too long.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); if (!ok) failures += 1; };

const sql = read("database/v6_3_0_backup_handover.sql");
const run = sql.slice(sql.indexOf("function public.reqgen_backup_handover_run"), sql.indexOf("function public.reqgen_backup_handover_tick"));
check("Database: officer, then backup, then back to the officer, where it stays", run.includes("handover_count = 1") && run.includes("handover_count = 2") && run.includes("q.handover_count < 2") && run.includes("v_next := r.handover_first"));
check("Database: only the review steps move; the DG and Account never move by themselves", /in \('pd', 'po', 'dod', 'hod', 'dinadmin', 'hr', 'hrcoordinator', 'registrar'\)/.test(run) && !/'dg'|'account'/.test(run.replace(/reqgen_key\(q\.current_stage\) in \([^)]*\)/, "")));
check("Database: Direct requests and requests sent back to the sender never move", run.includes("q.direct_to is null") && run.includes("q.current_owner is distinct from q.created_by") && run.includes("not ilike 'returned%'"));
check("Database: only working minutes count (Mon to Fri, 8:00 AM to 5:00 PM by default)", sql.includes("function public.reqgen_work_minutes") && sql.includes("('HANDOVER_FROM', '08:00')") && sql.includes("('HANDOVER_TO', '17:00')") && sql.includes("('HANDOVER_DAYS', '1,2,3,4,5')") && sql.includes("('HANDOVER_MINUTES', '25')"));
check("Database: the Registry is told (request number only)", run.includes("array['registry', 'padg']") && !/r\.title|r\.amount/.test(run));
check("Database: the clock starts afresh on approval, and now for requests already waiting", sql.includes("create trigger reqgen_owner_clock") && sql.includes("update public.requests set owner_since = now()"));
check("Database: only the Super Admin sets the rule and the backups", (sql.match(/reqgen_is_super_admin\(\) or public\.reqgen_is_admin\(\)/g) || []).length >= 2);
check("Database: the timer secret and the outbox are closed to staff", sql.includes("revoke all on public.reqgen_cron_secret from anon, authenticated") && sql.includes("revoke all on public.reqgen_handover_outbox from anon, authenticated") && sql.includes("revoke all on function public.reqgen_backup_handover_run() from public, anon, authenticated"));
check("Database: every 2 minutes with pg_cron; the routing engine is not changed", sql.includes("'*/2 * * * *'") && !/create or replace function public\.(approve_request_step|reqgen_next_route_step|build_request_route|reqgen_save_department_route)/.test(sql));
check("Database step drops nothing", !/drop\s+(table|function|column|policy)/i.test(sql));

const route = read("app/api/cron/backup-handover/route.ts");
check("SMS and e-mail: only with the timer's secret, never the title or amount", route.includes('req.headers.get("x-reqgen-cron")') && route.includes('from("reqgen_cron_secret")') && !/\.title|amount/.test(route.replace(/\/\*[\s\S]*?\*\//, "")));
check("Edge Function reqgen-office runs the handover job", read("supabase/functions/reqgen-office/index.ts").includes("backup_handover: { POST: backupHandover }") && read("scripts/build-edge.mjs").includes('"app/api/cron/backup-handover/route.ts"'));

const web = read("app/admin/routing/page.tsx"), lib = read("lib/v4/handover.ts");
check("Website: the Super Admin sets the backup rule and a backup for every review step", web.includes("saveHandover(ruleEdit)") && web.includes("BACKUP_STAGES as readonly EngineStage[]") && lib.includes('rpc("reqgen_handover_settings_save"'));
const app = read("mobile/app/src/screens/office/Admin.tsx"), alib = read("mobile/app/src/lib/handover.ts");
check("App: the same rule and a backup under each officer", app.includes("saveHandover(rule)") && app.includes("setDeptBackup(deptId, st, B[st] || null)") && alib.includes('rpc("reqgen_set_stage_backup"'));
check("Times in the rule are 12-hour (8:00 AM to 5:00 PM)", lib.includes('${h < 12 ? "AM" : "PM"}') && alib.includes('${h < 12 ? "AM" : "PM"}'));

const pkg = JSON.parse(read("package.json"));
check("Website version 6.3.0 or later", /^(6\.([3-9]|\d\d)|([7-9]|\d\d)\.)/.test(pkg.version) && read("lib/version.ts").includes(`"${pkg.version}"`));
const vp = read("mobile/version.properties");
check("App version 4.2.0 or later, build 12 or later", /REQGEN_VERSION_NAME=4\.([2-9]|\d\d)\./.test(vp) && Number((vp.match(/REQGEN_VERSION_CODE=(\d+)/) || [])[1]) >= 12 && read("mobile/app/src/lib/core.ts").includes(`APP_VERSION = "${(vp.match(/REQGEN_VERSION_NAME=(.+)/) || [])[1]?.trim()}"`));

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll ReqGen 6.3.0 checks passed.");
process.exit(failures ? 1 : 0);
