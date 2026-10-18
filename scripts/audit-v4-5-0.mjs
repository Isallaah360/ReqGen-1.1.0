// ReqGen v4.5.0 — release lock: Registry (mock-ups 68–73) and Audit (mock-ups 74–78).
import fs from "node:fs";
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const exists = (f) => fs.existsSync(f);
const results = [];
const check = (label, ok) => results.push([label, !!ok]);
const sql = read("database/v4_5_0_registry_audit.sql");

const reg = ["", "tracking", "dispatch", "archive", "filing"];
check("Registry pages exist and use the v4 kit (mock-ups 68–73)", reg.every((p) => /<(V4Page|MotherPage)\b/.test(read(`app/registry${p ? `/${p}` : ""}/page.tsx`))) && read("app/registry/incoming/page.tsx").includes('direction="incoming"') && read("app/registry/outgoing/page.tsx").includes('direction="outgoing"'));
check("Every Registry page shows the privacy bar (numbers, dates, offices, people only)", reg.every((p) => read(`app/registry${p ? `/${p}` : ""}/page.tsx`).includes("PrivacyBar")) && read("app/components/v4/Correspondence.tsx").includes("PrivacyBar"));
check("Registry never reads request contents or balances", [...reg.map((p) => `app/registry${p ? `/${p}` : ""}/page.tsx`), "app/components/v4/Correspondence.tsx", "lib/v4/registry.ts"].every((f) => !/from\("(requests|request_history|subheads|iet_accounts)"\)/.test(read(f))));
check("Old Registry Centre / Operations forward to /registry", read("app/registry/centre/page.tsx").includes('redirect("/registry")') && read("app/registry/operations/page.tsx").includes('redirect("/registry")'));
check("Tracking: live list, moves, daily summary (mock-up 69)", ["reqgen_registry_tracking", "reqgen_registry_moves", "reqgen_registry_summary"].every((f) => read("app/registry/tracking/page.tsx").includes(`rpc("${f}"`)));
check("Incoming / outgoing logged with a reference (IN/… OUT/…)", read("app/components/v4/Correspondence.tsx").includes('rpc("reqgen_registry_save"') && sql.includes("reqgen_registry_next_ref"));
check("Dispatch: Hand delivery, Courier, Email, Post", read("app/registry/dispatch/page.tsx").includes('rpc("reqgen_registry_dispatch"') && ["Hand delivery", "Courier", "Email", "Post"].every((m) => sql.includes(m)));
check("Archive and filing queue with retention review", read("app/registry/archive/page.tsx").includes("reqgen_registry_archive_review") && read("app/registry/filing/page.tsx").includes("reqgen_registry_filing_queue"));
check("Reminders: request number only, one an hour, nothing moves by itself", read("app/api/registry/remind/route.ts").includes('rpc("reqgen_request_remind"') && !/r\.(title|description|purpose)/.test(read("app/api/registry/remind/route.ts")) && sql.includes("one reminder an hour"));
check("Daily reminders job can be run by the nightly task (service role)", sql.includes("grant execute on function public.reqgen_send_due_reminders() to service_role") && read("app/api/backup/nightly/route.ts").includes("reqgen_send_due_reminders"));

check("Audit home, Audit Log, Workflow Trace, Reconciliation, Master Backup are v4 pages (mock-ups 74–78)", ["app/audit-centre/page.tsx", "app/audit-centre/logs/page.tsx", "app/workflow/page.tsx", "app/audit-centre/reconciliation/page.tsx", "app/audit-centre/backup/page.tsx"].every((f) => /<(V4Page|MotherPage)\b/.test(read(f))));
check("Audit Log: one log, entries cannot be changed or deleted", read("app/audit-centre/logs/page.tsx").includes('rpc("reqgen_audit_events"') && /before update or delete on public\.reqgen_audit_log/i.test(sql) && /before truncate on public\.reqgen_audit_log/i.test(sql));
check("Audit Log keeps no comments or request contents", !/from\("(requests|request_history)"\)/.test(read("app/audit-centre/logs/page.tsx")) && read("app/audit-centre/logs/page.tsx").includes("not copied into the log"));
check("Workflow Trace by number, printable on A4", read("app/workflow/page.tsx").includes('rpc("reqgen_trace"') && read("app/workflow/page.tsx").includes("printA4Sheet"));
check("Reconciliation: CSV or Excel statement, match, explain, reconcile", read("lib/v4/statement.ts").includes("xlsxRows") && read("lib/v4/statement.ts").includes("export function matchLines") && ["reqgen_recon_ledger", "reqgen_recon_save", "reqgen_recon_decide"].every((f) => read("app/audit-centre/reconciliation/page.tsx").includes(`rpc("${f}"`)));
check("Master Backup: fycards, Back up now, log, Restore danger zone", ["v4-fycards", "/api/backup/snapshot", "/api/backup/files", "Backup log", "v4-danger-zone"].every((t) => read("app/audit-centre/backup/page.tsx").includes(t)));
check("Restore is Super Admin only and needs a fresh 2FA code (tightened in v4.6.3)", read("app/audit-centre/backup/page.tsx").includes("confirmFresh(") && read("app/api/backup/restore/route.ts").includes("superAdminFromRequest(") && read("lib/server/superAdmin.ts").includes("freshTotp"));
check("Nightly backup at 02:00 (Lagos) with CRON_SECRET, nightly copies kept 90 days", read("vercel.json").includes('"0 1 * * *"') && read("app/api/backup/nightly/route.ts").includes("CRON_SECRET") && read("lib/server/backupStore.ts").includes("KEEP_DAYS = 90"));
check("Stored backups live in a private bucket with short-lived links", read("app/api/backup/files/route.ts").includes("createSignedUrls") && /insert into storage\.buckets[\s\S]{0,200}'backups'[\s\S]{0,120}false/.test(sql));
check("v4 tables are inside the backup", ["reqgen_audit_log", "reqgen_reconciliations", "reqgen_registry_archive"].every((t) => read("lib/server/backupCatalog.ts").includes(`"${t}"`)));

const perm = read("lib/permissions.ts");
check("Access: Registry pages for Registry; Tracking shared with Finance and the DG's office", perm.includes('{ prefix: "/registry", roles: ["admin", "auditor", "registry", "registrar"] }') && perm.includes('{ prefix: "/registry/tracking", roles: ["admin", "auditor", "registry", "registrar", "account", "accounts", "accountofficer", "dg", "directorgeneral", "generalsecretary"] }'));
check("Access: Audit for Admin and Auditor; Reconciliation also for the Account Officer", perm.includes('{ prefix: "/audit-centre", roles: ["admin", "auditor"] }') && perm.includes('{ prefix: "/audit-centre/reconciliation", roles: ["admin", "auditor", "account", "accounts", "accountofficer"] }'));
check("Route registry lists the new pages", ["/registry/tracking", "/registry/filing", "/audit-centre/reconciliation"].every((p) => read("lib/routeRegistry.ts").includes(`"pattern": "${p}"`)));

check("SQL: routing engine untouched", !/create or replace function public\.(approve_request_step|reject_request_step|reqgen_next_route_step|build_request_route|reqgen_build_route_for_template)\b/i.test(sql));
check("SQL: nothing dropped permanently", !/drop table(?! if exists v450_report)/i.test(sql) && !/^\s*truncate (?!v450_report)/im.test(sql));
check("SQL ends with an all-OK verification table", /from v450_report order by[^;]*;\s*$/.test(sql.trim()));
check("Release notes / env: no .env file shipped", !exists(".env") || fs.readFileSync(".gitignore", "utf8").includes(".env"));

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.5.0 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.5.0 release lock: PASS (${results.length} checks).`);
