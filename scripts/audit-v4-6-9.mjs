// ReqGen v4.6.9 — release lock (a screens release): SMS and email after every officer action; the stray
// IET watermark removed from the public pages (home page design unchanged); the green tick after saves;
// live alerts; welcome card with the Hijri date; themes; milestones; Request Insight (read only);
// deleting deactivated accounts that have no history. The Routing Engine is not changed.
import fs from "node:fs";
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const results = [];
const check = (label, ok) => results.push([label, !!ok]);

const approval = read("app/api/notifications/sms/request-approval/route.ts");
const event = read("app/api/notifications/sms/request-event/route.ts");
const otp = read("app/api/otp/request-submission/send/route.ts");
const work = read("app/components/requests/RequestDetailsWorkspace.tsx");
const newReq = read("app/requests/new/page.tsx");
const editReq = read("app/requests/[id]/edit/page.tsx");
const home = read("app/page.tsx");
const shell = read("app/components/PublicAuthShell.tsx");
const motion = read("app/components/v4/Motion.tsx");
const frame = read("app/components/v4/AppFrame.tsx");
const bell = read("app/components/v4/Bell.tsx");
const theme = read("lib/theme.ts");
const css = read("app/v4/v4-theme.css");
const profile = read("app/profile/page.tsx");
const dash = read("app/dashboard/page.tsx");
const insight = read("app/components/requests/RequestInsight.tsx");
const sql = read("database/v4_6_9_request_insight.sql");
const body = sql.replace(/--.*$/gm, "");
const del = read("app/api/admin/users/[id]/route.ts");
const staff = read("app/admin/users/[id]/page.tsx");

// 1. SMS and email
check("SMS: the officer who has just acted may send the alert", approval.includes('from("request_history")') && approval.includes('.eq("action_by", user.id)'));
check("SMS: approval, returned, completed and rejected each reach the right person", ["approval", "returned", "completed", "rejected"].every((k) => approval.includes(`"${k}"`)) && approval.includes("r.created_by"));
check("SMS: on unless switched off, and only with the Sendchamp key", [approval, event, otp].every((f) => f.includes('!== "false"') && f.includes("SENDCHAMP_API_KEY")));
check("SMS: no screen needs a NEXT_PUBLIC switch set to true", ![work, newReq, editReq].some((f) => /NOTIFICATIONS_ENABLED\s*===\s*"true"/.test(f)));
check("SMS: sent after a return and after a resubmission too", (work.match(/sendRequestApprovalNotification\(req\.id\)/g) || []).length >= 2 && editReq.includes("/api/notifications/sms/request-approval"));

// 2. Public pages
check("Home and sign-in: the faint IET watermark is gone", !home.includes("v4-public-watermark") && !shell.includes("v4-public-watermark"));
check("Home: the IET logo, welcome and buttons are kept", home.includes('src="/v4/iet-logo.png"') && home.includes("Welcome to") && home.includes("home-title"));

// 3. Motion layer
check("Tick: one host in the app frame", frame.includes("<SavedHost />") && motion.includes("export function SavedHost"));
check("Tick: fired from success messages across the app", (() => { let n = 0; const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = `${d}/${f.name}`; if (f.isDirectory()) walk(p); else if (/\.tsx$/.test(f.name) && read(p).includes("useCelebrate(")) n++; } }; walk("app"); return n >= 35; })());
check("Tick: IET stamp and ink on the DG's approval", work.includes("stamp: true") && motion.includes("v4-stamp"));
check("Live alerts: heading (Request received / Voucher received) and the bell rings once", bell.includes("Request received") && bell.includes("Voucher received") && bell.includes("v4-bell-ring"));
check("Count-up never used on money", read("app/components/v4/ui.tsx").includes('typeof s.value === "number" ? <CountUp'));
check("Reduce motion respected, nothing moves in print, Audit Log and 2FA stay still", css.includes("prefers-reduced-motion: reduce") && css.includes(".v4-saved, .v4-tip { display: none !important; }") && frame.includes('pathname.startsWith("/audit-centre/logs")'));
check("Welcome: Hijri date and a daily tip", dash.includes("hijriDate(now)") && dash.includes("tipOfDay(now)") && motion.includes("islamic-umalqura"));
check("Themes: Light, Dark, Same as device and IET green", profile.includes("applyTheme(m)") && profile.includes("IET green") && theme.includes("ACCENT_STORAGE_KEY") && css.includes('html[data-accent="green"]'));
check("Milestones on My Account (quiet, no pop-ups)", profile.includes("Milestones") && profile.includes("v4-milestones"));

// 4. Request Insight
check("Insight SQL: one read-only function", /create or replace function public\.reqgen_request_insight/.test(body) && /\bstable\b/.test(body) && !/\b(insert\s+into|update|delete\s+from)\s+public\./i.test(body));
check("Insight SQL: only officers on the route, never the requester", body.includes("r.created_by is distinct from me") && body.includes("coalesce(allowed, false)"));
check("Insight SQL: balances only for positions allowed to see them", body.includes("see_bal") && !/'(pd|registry|pvcountersigner|padg)'/.test(body.match(/see_bal := [^;]+;/)?.[0] || ""));
check("Insight SQL: anonymous visitors blocked; ends with the report", body.includes("revoke all on function public.reqgen_request_insight(uuid) from public, anon") && sql.trim().endsWith("order by step, item;"));
check("Insight SQL: routing engine not created or replaced", !/create\s+or\s+replace\s+function\s+public\.(approve_request_step|reqgen_next_route_step|build_request_route|reqgen_build_route_for_template|reqgen_save_department_route|reqgen_actor_role_for_stage)\b/i.test(body));
check("Insight panel: five tabs, shown to the deciding officer only", ["Similar before", "This subhead", "Amount check", "Requester", "Time on route"].every((t) => insight.includes(t)) && work.includes("canAct && !isMyRequest ? <RequestInsight"));

// 5. Delete deactivated accounts
check("Delete: Super Admin only, typed DELETE, 2FA within 5 minutes", del.includes('ctx.system !== "superadmin"') && del.includes('!== "DELETE"') && del.includes("since > 300"));
check("Delete: deactivated, not a system account, no history", del.includes("target.is_active !== false") && del.includes("target.system_account") && del.includes("const HISTORY"));
check("Delete: never edits routing; settings must be changed first", del.includes("const SETTINGS") && !/from\("(reqgen_route_templates|reqgen_route_steps|reqgen_department_routes)"\)/.test(del) && !/from\(c\.table\)\.delete\(\)[^;]*SETTINGS/.test(del));
check("Delete: written to the Audit Log", del.includes('adminLog(ctx, "Deactivated account deleted"'));
check("Delete: button only on a deactivated account, for the Super Admin", staff.includes("!person.is_active && iAmSuperAdmin") && staff.includes("challengeAndVerify"));

// 6. Release
check("Version 4.6.9 or a later 4.6 release", /REQGEN_SEMVER = "4\.6\.(9|[1-9]\d)"/.test(read("lib/version.ts")) && /"version": "4\.6\.(9|[1-9]\d)"/.test(read("package.json")));
check("No .env file shipped", !fs.existsSync(".env") || read(".gitignore").includes(".env"));

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.6.9 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.6.9 release lock: PASS (${results.length} checks).`);
