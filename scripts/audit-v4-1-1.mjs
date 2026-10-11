// ReqGen v4.1.1 — release lock: "Reject" sends the request back (Build Reference §5).
import fs from "node:fs";
const read = (f) => fs.readFileSync(f, "utf8");
const results = [];
const check = (label, ok) => results.push([label, !!ok]);
const ws = read("app/components/requests/RequestDetailsWorkspace.tsx");
const sql = read("database/v4_1_1_return_resubmit.sql");
const q = read("lib/approvalQueue.ts");
check("Reject calls the send-back rule (old rule only before the database step)", ws.includes('rpc("reqgen_return_request"') && ws.indexOf('reqgen_return_request') < ws.indexOf('"reject_request_step"'));
check("A reason is required to send a request back", ws.includes("Write the reason for sending this request back.") && sql.includes("length(v_comment) < 3"));
check("From the DG it goes to the officer whose approval sent it there", sql.includes("public.reqgen_key(h.to_stage) = 'dg'") && sql.includes("'Returned by the Director General'"));
const returnBody = sql.slice(sql.indexOf("create or replace function public.reqgen_return_request"), sql.indexOf("create or replace function public.reqgen_resubmit_request"));
check("From other officers it goes to the requester; funds stay reserved", returnBody.includes("v_owner := v_req.created_by") && !returnBody.includes("reserved_amount"));
check("Requester can correct, send back corrected, or withdraw", ws.includes("Correct the request") && ws.includes("Send it back corrected") && ws.includes('rpc("reqgen_withdraw_request"'));
check("Withdrawing releases the reserved fund", /reqgen_withdraw_request[\s\S]*reserved_amount = greatest/.test(sql));
check("A request back with its requester is not counted as waiting in Approvals", q.includes("returned for correction"));
check("Routing engine and existing approve/reject functions untouched", !/create or replace function public\.(approve_request_step|reject_request_step|reqgen_next_route_step|build_request_route)/i.test(sql));
check("Only signed-in users can call the new functions", (sql.match(/from public, anon/g) || []).length === 3);
let failed = 0;
for (const [label, ok] of results) { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); }
if (failed) { console.error(`\nv4.1.1 release lock: ${failed} failure(s).`); process.exit(1); }
console.log(`\nv4.1.1 release lock: PASS (${results.length} checks).`);
