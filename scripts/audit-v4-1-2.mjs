// ReqGen v4.1.2 — release lock: New Request, balances by active position, dropdowns,
// request record, DG sign + stamp, correct, drafts and reopen.
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
const exists = (f) => fs.existsSync(f);
const results = [];
const check = (label, ok) => results.push([label, !!ok]);

const nr = read("app/requests/new/page.tsx");
const vis = read("lib/v4/budgetVisibility.ts");
check("New Request: ONE department field (no second Department select)", (nr.match(/id="nr-dept"/g) || []).length === 1 && !nr.includes("2. Request Details"));
check("New Request: four clear steps — Type, Details, Attachments, Sign & submit", nr.includes('["Type", "Details", "Attachments", "Sign & submit"]'));
check("Balances follow the position ACTING AS, not every position held", nr.includes("canSeeBudgetBalances(who.role)") && !nr.includes("roleSet"));
check("Staff, Registry, PD, PA to the DG and Counter Signer never see balances", ["staff", "registry", "pd", "padg", "pvsigner"].every((k) => !new RegExp(`\\n\\s*"${k}",`).test(vis.split("SEE_BALANCES")[1].split("]);")[0])));
check("DIN Admin, HR, DOD, HOD, DG, Account, Auditor, Super Admin may see balances", ["dinadmin", "hrcoordinator", "hr", "dod", "hod", "dg", "accountofficer", "auditor", "admin"].every((k) => vis.includes(`"${k}"`)));
check("Staff load subhead NAMES only (no balance columns) and get the live check", nr.includes("reqgen_department_subhead_names") && nr.includes("reqgen_subhead_live_check") && /seeBalances\s*\)\s*\{[\s\S]*approved_allocation/.test(nr));
check("Over budget: submit blocked, draft allowed", nr.includes("You can save a draft but not submit") && nr.includes('live === "not_enough"'));
check("Amount written in words for the letter", nr.includes("nairaInWords(") && exists("lib/v4/money.ts") && read("lib/v4/money.ts").includes("naira only"));

const sel = read("app/components/v4/Select.tsx");
const nsu = read("app/components/v4/NativeSelectUpgrade.tsx");
const rs = read("app/components/v4/RoleSelect.tsx");
const layout = read("app/layout.tsx");
check("v4 dropdown: listbox with keyboard, search and type-to-find", sel.includes('role="listbox"') && sel.includes('"ArrowDown"') && sel.includes("Type to search") && sel.includes("typed.current"));
check("Every plain dropdown opens the v4 list on laptops; phones keep their picker", nsu.includes("(pointer: fine)") && nsu.includes('new Event("change", { bubbles: true })') && layout.includes("<NativeSelectUpgrade />"));
check("ACTING AS is a styled list (no browser select)", !rs.includes("<select") && rs.includes('role="listbox"') && rs.includes("Act as"));
check("Plain dropdowns share one chevron look in light and dark", read("app/v4/v4-select.css").includes('html[data-theme="dark"] body.v4-root select'));

const ws = read("app/components/requests/RequestDetailsWorkspace.tsx");
check("Request record follows mock-up 26/32: route chain, decision card, details, history", ["v4-chain", "v4-action-card", "v4-decide", "v4-timeline", "Approval route"].every((t) => ws.includes(t)));
check("DG final approval: signature + IET stamp preview in one step", ws.includes("Approve, sign and stamp") && ws.includes('src="/v4/iet-stamp.png"'));
check("DG and Account always confirm with fingerprint or 2FA code (never passcode alone)", ws.includes("mustConfirmFresh") && ws.includes("fingerprintStepUp()") && ws.includes("!mustConfirmFresh && (sessionIsAal2"));
check("Approving officer sees ALLOCATION B/D, EXPENDITURE, BALANCE C/D; staff never", ws.includes("ALLOCATION B/D:") && ws.includes("balanceViewer &&") && ws.includes("canSeeBudgetBalances("));
check("Changing the confirmed subhead needs a reason", ws.includes("Reason for the change") && ws.includes("Subhead changed"));
check("Budget line kept with the officer's signature and printed on the letter", ws.includes("reqgen_confirm_request_budget") && read("app/requests/[id]/print/page.tsx").includes("reqgen_request_budget_lines"));
check("Registry never sees request contents", ws.includes('roleKey(activeRoleKey) === "registry"') && ws.includes("Request contents are not available to Registry"));
check("Reopen: requester, Account Officer, Auditor, Super Admin, with a reason", ws.includes("reqgen_reopen_request") && ws.includes('["account", "accounts", "accountofficer", "auditor", "admin"]'));

const ed = read("app/requests/[id]/edit/page.tsx");
check("Correct Request (mock-up 27): locked type/department, note required, sign and resubmit", ed.includes("What did you change?") && ed.includes("Sign and resubmit") && ed.includes('<Icon name="lock"'));
check("Requester correction uses its own rule (fund re-reserved with the hard block)", ed.includes("reqgen_correct_request") && ed.includes("reqgen_resubmit_request"));

const mine = read("app/requests/mine/page.tsx");
const dr = read("lib/v4/drafts.ts");
check("Drafts tab: continue or delete; drafts kept 60 days", mine.includes('label: "Drafts"') && mine.includes("/requests/new?draft=") && dr.includes("60 * 86400000"));
check("Draft files live in the private request-drafts bucket, one folder per person", dr.includes('const BUCKET = "request-drafts"') && dr.includes("`${uid}/${draftId}/"));

const sql = read("database/v4_1_2_requests_drafts_reopen.sql");
check("SQL: drafts are owner-only (row-level security)", sql.includes("enable row level security") && sql.includes("using (owner_id = auth.uid())"));
check("SQL: reopen only withdrawn/rejected and never paid", sql.includes("Only a withdrawn or rejected request can be reopened") && sql.includes("cannot be reopened"));
check("SQL: correction re-checks the subhead (hard block)", sql.includes("Not enough fund in this subhead for the new amount"));
check("SQL: route chain is read-only and access-checked", sql.includes("create or replace function public.reqgen_request_chain") && sql.includes("reqgen_can_open_request(p_request_id)"));
check("SQL: routing engine untouched", !/create or replace function public\.(approve_request_step|reject_request_step|reqgen_next_route_step|build_request_route|reqgen_build_route_for_template)/i.test(sql));
check("SQL: every new function blocked for anonymous visitors", (sql.match(/from public, anon/g) || []).length >= 5);
check("SQL ends with an all-OK verification table", sql.trim().endsWith("from v412_report order by step, item;"));

check("v4 pages: New Request, record and Correct use the v4 kit", read("lib/v4/modules.ts").includes("V4_NATIVE_PATTERNS") && read("lib/v4/modules.ts").includes("/^\\/requests\\/new$/"));

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.1.2 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.1.2 release lock: PASS (${results.length} checks).`);
