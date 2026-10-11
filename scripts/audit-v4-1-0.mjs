// ReqGen v4.1.0 — release lock: Requests and Approvals.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
const exists = (f) => fs.existsSync(f);
const results = [];
const check = (label, ok) => results.push([label, !!ok]);

const greet = read("app/components/v4/Greeting.tsx");
const frame = read("app/components/v4/AppFrame.tsx");
check("Greeting in title case with a picture for each part of the day", ["Good Morning", "Good Afternoon", "Good Evening", "Good Night"].every((g) => greet.includes(g)) && greet.includes("Sunrise") && greet.includes("Moon"));
check("One greeting per screen (top bar hides it on the Dashboard)", frame.includes('pathname !== "/dashboard"') && read("app/dashboard/page.tsx").includes("<DayIcon"));

const mine = read("app/requests/mine/page.tsx");
check("My Requests: own requests only, by financial year", mine.includes('.eq("created_by", me.userId)') && mine.includes("fyBounds("));
check("My Requests: tabs, search, type, export, pages", ["Back with me", "Approved & paid", "downloadCsv(", "<Pager"].every((t) => mine.includes(t)));
check("My Requests: returned requests go straight to Correct", mine.includes("/edit`") && mine.includes('label: "Correct"'));

const inbox = read("app/approvals/inbox/page.tsx");
check("Requests to Approve uses the shared waiting rule", inbox.includes("isAwaitingUser(") && inbox.includes("isHeldElsewhere("));
check("Requests to Approve: oldest first, 3+ day filter", inbox.includes('order("created_at", { ascending: true })') && inbox.includes("ageDays(r.created_at) >= 3"));
check("Vouchers to Sign uses the assigned-to-me function", read("app/approvals/vouchers/page.tsx").includes("get_payment_vouchers_assigned_to_me"));
check("Treated by Me reads only the officer's own decisions", exists("app/approvals/treated/page.tsx") && read("app/approvals/treated/page.tsx").includes("reqgen_treated_by_me"));

const nr = read("app/requests/new/page.tsx");
check("Live check: staff see only available / not enough", nr.includes("reqgen_subhead_live_check") && nr.includes("Fund available") && !/staffSubs[^;]*balance/.test(nr));
check("Over budget is a hard block for staff", nr.includes('liveCheck === "not_enough"') && nr.includes("return false"));
check("Registry never sees subhead balances on New Request", !/FINANCE_VISIBLE_ROLES = \[[^\]]*"registry"/s.test(nr));

const pr = read("app/requests/[id]/print/page.tsx");
const pv = read("app/payment-vouchers/[id]/print/page.tsx");
check("Request letter: IET stamp beside the DG signature", pr.includes("iet-stamp.png") && pr.includes("stamp />"));
check("Request letter: QR check code", pr.includes("/check/r/") && pr.includes("QRCode.toDataURL"));
check("Voucher: IET stamp on the DG authorisation and QR check code", pv.includes("iet-stamp.png") && pv.includes("/check/v/"));
check("QR codes are black on white with a quiet zone", [pr, pv].every((s) => s.includes('dark: "#000000"') && s.includes("margin: 2")));
const chk = read("app/check/[kind]/[id]/page.tsx");
check("Check page shows number, status and signers only — never title or amount", !/select\([^)]*title/.test(chk) && !/select\([^)]*amount/.test(chk) && chk.includes("Who signed"));
check("Check page is public and not indexed", read("lib/permissions.ts").includes(`PUBLIC_PREFIXES = ["/check/"]`) && chk.includes("index: false"));

const sql = read("database/v4_1_0_requests_approvals.sql");
check("SQL: helpers are security definer, blocked for anonymous visitors", (sql.match(/security definer/g) || []).length === 3 && (sql.match(/from public, anon/g) || []).length === 3);
check("SQL: live check never returns a balance", /returns text/.test(sql) && sql.includes("'available'") && sql.includes("'not_enough'"));

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.1.0 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.1.0 release lock: PASS (${results.length} checks).`);
