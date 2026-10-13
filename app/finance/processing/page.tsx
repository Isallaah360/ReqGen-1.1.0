"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { APPROVAL_QUEUE_CHANGED_EVENT, isAwaitingUser, isClosedRequest } from "@/lib/approvalQueue";
import { ageDays, shortDate, stageKey, waitedFor } from "@/lib/v4/requestText";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { Btn, Card, Chip, Notice, PageHead, Pager, Skeleton, Stats, Tabs, V4Page, naira, type StatItem } from "@/app/components/v4/ui";

type Row = {
  id: string; request_no: string | null; title: string | null; amount: number | null; status: string | null;
  current_stage: string | null; current_owner: string | null; assigned_account_officer_id: string | null;
  assigned_account_officer_user_id: string | null; created_at: string | null; updated_at: string | null;
  request_type: string | null; personal_category: string | null; requester_name: string | null; dept_id: string | null; subhead_id: string | null;
};
type Tab = "mine" | "all" | "treated";
const PAGE = 20;

/** Finance › Finance Processing (mock-up 37): approved requests waiting for Account, oldest first. */
export default function FinanceProcessingPage() {
  const me = useIdentity();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [depts, setDepts] = useState<Record<string, string>>({});
  const [subs, setSubs] = useState<Record<string, string>>({});
  const [vouchersInSigning, setVouchersInSigning] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("mine");
  const [late, setLate] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const [list, d, s, pv] = await Promise.all([
      supabase.from("requests")
        .select("id,request_no,title,amount,status,current_stage,current_owner,assigned_account_officer_id,assigned_account_officer_user_id,created_at,updated_at,request_type,personal_category,requester_name,dept_id,subhead_id")
        .order("updated_at", { ascending: true }).limit(3000),
      supabase.from("departments").select("id,name"),
      supabase.from("subheads").select("id,code,name"),
      supabase.from("payment_vouchers").select("id", { count: "exact", head: true }).in("status", ["Pending Check", "Pending Counter Signature", "Pending DG Authorisation", "Pending Cheque Signature", "Pending Authorization"]),
    ]);
    setError(list.error ? list.error.message : null);
    setRows(list.error ? [] : ((list.data || []) as Row[]));
    setDepts(Object.fromEntries(((d.data || []) as Array<{ id: string; name: string }>).map((x) => [x.id, x.name])));
    setSubs(Object.fromEntries(((s.data || []) as Array<{ id: string; code: string | null; name: string }>).map((x) => [x.id, x.code || x.name])));
    setVouchersInSigning(pv.error ? null : pv.count ?? 0);
  }, []);

  useEffect(() => {
    if (!me.ready) return;
    queueMicrotask(() => { void load(); });
    const again = () => void load();
    window.addEventListener(APPROVAL_QUEUE_CHANGED_EVENT, again);
    return () => window.removeEventListener(APPROVAL_QUEUE_CHANGED_EVENT, again);
  }, [me.ready, load]);

  const atAccount = useMemo(() => (rows || []).filter((r) => stageKey(r.current_stage) === "ACCOUNT" && !isClosedRequest(r)), [rows]);
  const mine = useMemo(() => atAccount.filter((r) => isAwaitingUser(r, me.userId, me.role)), [atAccount, me.userId, me.role]);
  const treated = useMemo(() => (rows || []).filter((r) => /paid|complet/i.test(String(r.status || "")) && (r.assigned_account_officer_id === me.userId || r.assigned_account_officer_user_id === me.userId))
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))), [rows, me.userId]);
  const paidThisMonth = useMemo(() => {
    const now = new Date(); const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return (rows || []).filter((r) => /paid/i.test(String(r.status || "")) && String(r.updated_at || "").startsWith(key));
  }, [rows]);

  const base = tab === "mine" ? mine : tab === "all" ? atAccount : treated;
  const shown = late && tab !== "treated" ? base.filter((r) => ageDays(r.updated_at || r.created_at) >= 3) : base;
  const paged = shown.slice((page - 1) * PAGE, page * PAGE);
  const sum = (list: Row[]) => list.reduce((t, r) => t + Number(r.amount || 0), 0);

  const stats: StatItem[] = [
    { label: "Waiting for Finance", value: rows ? mine.length : "…", note: rows ? naira(sum(mine)) : undefined, icon: "clock", tone: "amber", pressed: tab === "mine" && !late, onClick: () => { setTab("mine"); setLate(false); setPage(1); } },
    { label: "Waiting 3+ days", value: rows ? atAccount.filter((r) => ageDays(r.updated_at || r.created_at) >= 3).length : "…", note: "Reminder sent after 1 day", icon: "alert", tone: "red", pressed: late, onClick: () => { setTab("all"); setLate(true); setPage(1); } },
    { label: "Vouchers in signing", value: vouchersInSigning ?? "…", note: "See Payment Vouchers", icon: "pen", tone: "blue", href: "/payment-vouchers/pending" },
    { label: "Paid this month", value: rows ? paidThisMonth.length : "…", note: rows ? naira(sum(paidThisMonth)) : undefined, icon: "check", tone: "green", pressed: tab === "treated", onClick: () => { setTab("treated"); setLate(false); setPage(1); } },
  ];

  const kind = (r: Row) => String(r.request_type || "").toLowerCase().startsWith("official") ? (r.subhead_id ? subs[r.subhead_id] || "Official" : "Official") : "Personal · Fund";

  return (
    <V4Page>
      <PageHead title="Finance Processing" sub="Requests approved by the Director General and assigned to you. Treat them oldest first." />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Stats items={stats} />
      <Card>
        <div style={{ padding: "0 12px" }}>
          <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} label="Show" items={[
            { key: "mine", label: "Assigned to me", count: mine.length },
            { key: "all", label: "All Finance", count: atAccount.length },
            { key: "treated", label: "Treated", count: treated.length },
          ]} />
        </div>
        {late ? <div style={{ padding: "12px 20px 0" }}><Notice tone="amber">Showing requests waiting 3 days or more. <button type="button" className="v4-btn v4-btn-ghost" style={{ minHeight: 30, padding: "0 8px" }} onClick={() => setLate(false)}>Show all</button></Notice></div> : null}
        {rows === null ? <Skeleton lines={6} /> : shown.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Request</th><th className="v4-r">Amount</th><th>Requester</th><th className="v4-hide-sm">Subhead</th><th>{tab === "treated" ? "Treated" : "Waiting"}</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {paged.map((r) => {
                  const days = ageDays(r.updated_at || r.created_at);
                  const mineRow = isAwaitingUser(r, me.userId, me.role);
                  return (
                    <tr key={r.id}>
                      <td><span className="v4-strong">{r.request_no || "—"}</span><span className="v4-sub">{r.title || "Untitled"}</span></td>
                      <td className="v4-r v4-num v4-strong">{naira(r.amount)}</td>
                      <td data-label="Requester"><span className="v4-strong">{r.requester_name || "—"}</span><span className="v4-sub">{depts[r.dept_id || ""] || ""}</span></td>
                      <td className="v4-hide-sm">{kind(r)}</td>
                      <td className="v4-age">{tab === "treated" ? shortDate(r.updated_at) : <Chip tone={days >= 3 ? "red" : days >= 1 ? "amber" : "green"}>{waitedFor(r.updated_at || r.created_at)}</Chip>}</td>
                      <td className="v4-r">
                        {tab === "treated"
                          ? <Btn small a={{ href: `/requests/${r.id}`, label: "Open", kind: "secondary" }} />
                          : mineRow ? <Btn small a={{ href: `/finance/request/${r.id}`, label: "Treat", kind: "primary" }} />
                          : <span className="v4-muted" style={{ fontSize: 13 }}>Assigned to another officer</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>{tab === "treated" ? "Nothing treated by you yet." : "Nothing is waiting for Finance. Requests arrive here after the Director General approves them."}</p>}
        <Pager page={page} pageSize={PAGE} total={shown.length} onPage={setPage} label="requests" />
      </Card>
    </V4Page>
  );
}
