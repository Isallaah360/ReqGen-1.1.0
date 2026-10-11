"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { APPROVAL_QUEUE_CHANGED_EVENT, isAwaitingUser, isHeldElsewhere, type ApprovalQueueRow } from "@/lib/approvalQueue";
import { ageDays, stageWords, waitedFor } from "@/lib/v4/requestText";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { Btn, Card, Chip, Notice, PageHead, Pager, Skeleton, Stats, V4Page, naira, type StatItem } from "@/app/components/v4/ui";

type Row = ApprovalQueueRow & {
  id: string; request_no: string | null; title: string | null; amount: number | null; created_at: string | null;
  request_type: string | null; personal_category: string | null; requester_name: string | null; dept_id: string | null; updated_at?: string | null;
};
type Treated = { kind: string; action_type: string | null; acted_at: string | null };

const PAGE = 20;

function typeOf(r: Row) {
  if (String(r.request_type || "").toLowerCase().startsWith("official")) return "Official";
  return String(r.personal_category || "").toLowerCase() === "fund" ? "Personal · Fund" : "Personal · Other";
}

/** Approvals › Requests to Approve (v4.1.0): oldest first. */
export default function RequestsToApprovePage() {
  const me = useIdentity();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [depts, setDepts] = useState<Record<string, string>>({});
  const [treated, setTreated] = useState<Treated[] | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [dept, setDept] = useState("all");
  const [late, setLate] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!me.userId) return;
    const [list, d, t] = await Promise.all([
      supabase.from("requests")
        .select("id,request_no,title,amount,status,current_stage,current_owner,assigned_account_officer_id,assigned_account_officer_user_id,created_at,request_type,personal_category,requester_name,dept_id")
        .order("created_at", { ascending: true }).limit(3000),
      supabase.from("departments").select("id,name"),
      supabase.rpc("reqgen_treated_by_me", { p_limit: 1000 }),
    ]);
    setError(list.error ? list.error.message : null);
    setRows(list.error ? [] : (list.data || []) as Row[]);
    setDepts(Object.fromEntries(((d.data || []) as Array<{ id: string; name: string }>).map((x) => [x.id, x.name])));
    setTreated(t.error ? null : (t.data || []) as Treated[]);
  }, [me.userId]);

  useEffect(() => {
    if (!me.ready) return;
    queueMicrotask(() => { void load(); });
    const again = () => void load();
    window.addEventListener(APPROVAL_QUEUE_CHANGED_EVENT, again);
    return () => window.removeEventListener(APPROVAL_QUEUE_CHANGED_EVENT, again);
  }, [me.ready, load]);

  const waiting = useMemo(() => (rows || []).filter((r) => isAwaitingUser(r, me.userId, me.role)), [rows, me.userId, me.role]);
  const heldElsewhere = useMemo(() => (rows || []).filter((r) => isHeldElsewhere(r, me.userId, me.role)), [rows, me.userId, me.role]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return waiting.filter((r) =>
      (type === "all" || typeOf(r).startsWith(type)) &&
      (dept === "all" || r.dept_id === dept) &&
      (!late || ageDays(r.created_at) >= 3) &&
      (!term || `${r.request_no} ${r.title} ${r.requester_name}`.toLowerCase().includes(term)));
  }, [waiting, q, type, dept, late]);

  const monthStart = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString(); }, []);
  const mine = (treated || []).filter((t) => t.kind === "request" && String(t.acted_at || "") >= monthStart);
  const approvedMonth = mine.filter((t) => /approv|treat|pay|complete/i.test(String(t.action_type))).length;
  const returnedMonth = mine.filter((t) => /return|reject/i.test(String(t.action_type))).length;
  const lateCount = waiting.filter((r) => ageDays(r.created_at) >= 3).length;

  const stats: StatItem[] = [
    { label: "Waiting for me", value: rows ? waiting.length : "…", note: naira(waiting.reduce((s, r) => s + Number(r.amount || 0), 0)), icon: "file", tone: "blue", pressed: !late, onClick: () => { setLate(false); setPage(1); } },
    { label: "Waiting 3+ days", value: rows ? lateCount : "…", note: lateCount ? "Please treat these first" : "None", icon: "clock", tone: "red", pressed: late, onClick: () => { setLate(true); setPage(1); } },
    { label: "Approved this month", value: treated ? approvedMonth : "—", note: "By you", icon: "check", tone: "green", href: "/approvals/treated" },
    { label: "Returned this month", value: treated ? returnedMonth : "—", note: "For correction", icon: "returned", tone: "amber", href: "/approvals/treated" },
  ];

  const paged = shown.slice((page - 1) * PAGE, page * PAGE);
  const deptOptions = Array.from(new Set(waiting.map((r) => r.dept_id).filter(Boolean))) as string[];

  return (
    <V4Page>
      <PageHead title="Requests to Approve" sub="Open a request to approve, return for correction, or reject. Oldest first." actions={[{ href: "/approvals/treated", label: "Treated by me", icon: "history", kind: "secondary" }]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {heldElsewhere.length ? (
        <Notice tone="amber" title={`${heldElsewhere.length} request${heldElsewhere.length === 1 ? " is" : "s are"} at your stage but held by another officer.`}>
          ({heldElsewhere.slice(0, 4).map((r) => r.request_no || "request").join(", ")}{heldElsewhere.length > 4 ? ", …" : ""}) Ask the Super Admin to check the Routing Engine if this is not expected.
        </Notice>
      ) : null}
      <Stats items={stats} />
      <Card>
        <div className="v4-toolbar v4-t3">
          <label className="v4-field v4-f-search"><span className="v4-flabel">Search</span><span className="v4-control"><input className="v4-input" placeholder="Request number, title or name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></span></label>
          <label className="v4-field"><span className="v4-flabel">Department</span>
            <select className="v4-select" value={dept} onChange={(e) => { setDept(e.target.value); setPage(1); }}>
              <option value="all">All departments</option>
              {deptOptions.map((id) => <option key={id} value={id}>{depts[id] || "Department"}</option>)}
            </select>
          </label>
          <label className="v4-field"><span className="v4-flabel">Type</span>
            <select className="v4-select" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="all">All types</option><option value="Official">Official</option><option value="Personal">Personal</option>
            </select>
          </label>
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setQ(""); setType("all"); setDept("all"); setLate(false); setPage(1); }}>Reset</button>
        </div>
        {rows === null ? <Skeleton lines={5} /> : shown.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Request</th><th className="v4-r">Amount</th><th>From</th><th className="v4-hide-sm">Your step</th><th>Waiting</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {paged.map((r) => {
                  const days = ageDays(r.created_at);
                  return (
                    <tr key={r.id}>
                      <td><span className="v4-strong">{r.request_no || "—"}</span><span className="v4-sub">{r.title || "Untitled"}</span></td>
                      <td className="v4-r v4-num v4-strong">{typeOf(r) === "Personal · Other" ? "—" : naira(r.amount)}</td>
                      <td data-label="From"><span className="v4-strong">{r.requester_name || "Staff"}</span><span className="v4-sub">{depts[r.dept_id || ""] || typeOf(r)}</span></td>
                      <td className="v4-hide-sm"><Chip tone="brand">{stageWords(r.current_stage).replace(/^With (the )?/, "")}</Chip></td>
                      <td><Chip tone={days >= 3 ? "red" : days >= 1 ? "amber" : "green"}>{waitedFor(r.created_at)}</Chip></td>
                      <td className="v4-r"><Btn small a={{ href: `/requests/${r.id}`, label: "Open", kind: "primary" }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>{waiting.length ? "No request matches these filters." : "Nothing is waiting for you. New requests routed to you will appear here."}</p>}
        <Pager page={page} pageSize={PAGE} total={shown.length} onPage={setPage} label="requests" />
      </Card>
    </V4Page>
  );
}
