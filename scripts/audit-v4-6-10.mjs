// ReqGen v4.6.10 — release lock: dropdown lists open on the screen on phones; staff never choose a subhead
// (the officer who sees the budget assigns it; the DG as a fallback); Direct requests (write to a named
// person who forwards to the DG; the Account Officer releases a money request without a subhead).
// The Routing Engine is not changed.
import fs from "node:fs";
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const results = [];
const check = (label, ok) => results.push([label, !!ok]);

const select = read("app/components/v4/Select.tsx");
const newReq = read("app/requests/new/page.tsx");
const edit = read("app/requests/[id]/edit/page.tsx");
const work = read("app/components/requests/RequestDetailsWorkspace.tsx");
const direct = read("app/requests/direct/page.tsx");
const actions = read("app/components/requests/DirectActions.tsx");
const fin = read("app/finance/request/[id]/page.tsx");
const sql = read("database/v4_6_10_direct_requests.sql");
const body = sql.replace(/--.*$/gm, "");

// 1. Phones
check("Dropdown list is drawn on the page itself, never inside the hidden phone menu", !select.includes('document.body.querySelector<HTMLElement>(".v4-ui")') && select.includes('closest<HTMLElement>(".v4-modal-layer") || document.body'));

// 2. Subhead
check("New request: staff do not choose a subhead (unless no budget officer comes before the DG)", newReq.includes("const choosesSubhead = isOfficial && (seeBalances || mustChooseSubhead)") && newReq.includes("{choosesSubhead ? (") && newReq.includes("The approving officer chooses it") && newReq.includes('const BUDGET_STEPS = new Set(["DOD", "DIRECTOR", "DINADMIN", "HOD", "REGISTRAR", "HR"])'));
check("New request: a subhead is required only when no officer could assign it before the DG", !newReq.includes('"Choose the budget subhead."') && newReq.includes("if (mustChooseSubhead && subOptions.length > 0 && !subheadId)") && newReq.includes("p_subhead_id: choosesSubhead ? subheadId || null : null"));
check("Edit: only a position that sees balances changes the subhead", edit.includes("isOfficial && seeBalances && (officerFinance"));
check("Officer: approval waits until the budget officer assigns the subhead", work.includes("needsSubheadAssignment") && work.includes("disabled={actingLocked || attachmentsLocked || needsSubheadAssignment}"));
check("Officer: the DG never assigns a subhead (locked rule kept)", !work.includes("dgFallback") && !body.includes("reqgen_officer_assign_subhead"));

check("Subhead guard: accepts DOD and HR Coordinator keys, still refuses DG, Admin, Auditor, Account", body.includes("when v_active_role in ('director', 'dod') then 'director'") && body.includes("'hrcoordinator'") && body.includes("not in ('director', 'dinadmin', 'hod', 'registrar', 'hr')") && body.includes("'reqgen_enforce_subhead_assignment_authority'") && body.indexOf("reqgen_function_backups") < body.indexOf("create or replace function public.reqgen_enforce_subhead_assignment_authority"));

// 3. Direct requests
check("Direct: two new columns only (owner's YES), nothing dropped", (body.match(/alter table public\.requests add column if not exists/g) || []).length === 2 && !/\bdrop\s+(table|column|function)\b/i.test(body));
check("Direct: no new table and no table rule changed", !/create\s+table\s+(if not exists\s+)?public\./i.test(body) && !/alter table public\.requests (drop|add) constraint/i.test(body));
check("Direct: uses only stage and status values the table already allows", !/current_stage = '(Direct|Addressed)/.test(body) && body.includes("current_stage = 'Submitted'"));
check("Direct: every action checks the person holding it", body.includes("r.current_owner is distinct from me then raise exception 'This request is not with you.'"));
check("Direct: DG step only for the DG; release only for an Account Officer", body.includes("Only the Director General acts at this step.") && body.includes("Only the Account Officer releases the fund."));
check("Direct: a money request needs the Account Officer chosen before the DG", body.includes("Choose the Account Officer who will treat this money request."));
check("Direct: reasons required to send back or decline", body.includes("v_act in ('return', 'decline') and v_note is null then raise exception 'Write the reason.'"));
check("Direct: internal helpers cannot be called from outside", body.includes("revoke all on function public.reqgen_direct_log(uuid, text, text, text, text, text, text) from public, anon, authenticated") && body.includes("revoke all on function public.reqgen_direct_notify(uuid, uuid, text, text) from public, anon, authenticated"));
check("Direct: stored as personal requests, so the official-subhead rule at the DG is untouched", body.includes("'Personal', case when v_amt > 0 then 'Fund' else 'Others' end"));
check("SQL: routing engine not created or replaced", !/create\s+or\s+replace\s+function\s+public\.(approve_request_step|reqgen_next_route_step|build_request_route|reqgen_build_route_for_template|reqgen_save_department_route|reqgen_actor_role_for_stage)\b/i.test(body));
check("SQL: route tables not written", !/(insert\s+into|update|delete\s+from)\s+public\.(reqgen_route_templates|reqgen_route_steps|reqgen_department_routes)\b/i.test(body));
check("SQL: ends with the report table and reloads the API", sql.trim().endsWith("order by step, item;") && body.includes("notify pgrst, 'reload schema'"));
// v4.7.0: the Direct page sends to one or many people from any department (reqgen_direct_send).
check("Direct page: people from the departments, title, details, money yes/no", direct.includes('rpc("reqgen_direct_people"') && (direct.includes('rpc("reqgen_direct_submit"') || direct.includes('rpc("reqgen_direct_send"')) && /money/i.test(direct));
check("Direct decision card: forward to DG / someone else, send back, decline; DG approve with fresh 2FA", ["to_dg", "forward", "return", "decline", "approve", "resend"].every((k) => actions.includes(`"${k}"`)) && actions.includes("confirmFresh("));
check("Direct: the usual decision card and Insight stay hidden on a Direct request", work.includes("{canAct && !isDirect ? (") && work.includes("canAct && !isMyRequest && !isDirect ? <RequestInsight"));
check("Direct: the Account Officer releases it through its own function", fin.includes('rpc("reqgen_direct_act", { p_request_id: req.id, p_action: "release"'));
check("New request offers the Direct request", newReq.includes('href="/requests/direct"') && read("lib/routeRegistry.ts").includes('"pattern": "/requests/direct"'));

// 4. Release
check("Version 4.6.10 or later", /REQGEN_SEMVER = "(4\.(6\.(1\d|[2-9]\d)|([7-9]|[1-9]\d)\.\d+)|[5-9]\.\d+\.\d+)"/.test(read("lib/version.ts")) && /"version": "(4\.(6\.(1\d|[2-9]\d)|([7-9]|[1-9]\d)\.\d+)|[5-9]\.\d+\.\d+)"/.test(read("package.json")));
check("No .env file shipped", !fs.existsSync(".env") || read(".gitignore").includes(".env"));

let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.6.10 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.6.10 release lock: PASS (${results.length} checks).`);
