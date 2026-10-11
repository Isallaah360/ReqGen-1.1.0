"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isClosedRequest } from "@/lib/approvalQueue";
import { currentFyStart, fyBounds, fyLabel } from "@/lib/financialYear";
import { shortDate, stageKey, stageWords, statusChip } from "@/lib/v4/requestText";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { Btn, Card, Chip, Notice, PageHead, Pager, Skeleton, Tabs, V4Page, downloadCsv, naira } from "@/app/components/v4/ui";

type Row = {
  id: string; request_no: string | null; title: string | null; amount: number | null; status: string | null;
  current_stage: string | null; current_owner: string | null; created_at: string | null;
  request_type: string | null; personal_category: string | null; dept_id: string | null;
};
type Tab = "all" | "progress" | "returned" | "done" | "rejected";

const PAGE = 20;

function kindOf(r: Row) {
  if (String(r.request_type || "").toLowerCase().startsWith("official")) return "Official";
  const c = String(r.personal_category || "").toLowerCase();
  return c === "fund" ? "Personal · Fund" : "Personal · Other";
}

function bucket(r: Row, me: string): Tab {
  const chip = statusChip(r.status, r.current_stage);
  if (chip.label === "Rejected" || chip.label === "Withdrawn") return "rejected";
  if (chip.label === "Returned" || (r.current_owner === me && !isClosedRequest(r))) return "returned";
  if (["Paid", "Completed", "Approved"].includes(chip.label)) return "done";
  return "progress";
}

/** 0–5 segments filled for the little progress bar. */
function steps(r: Row) {
  const k = stageKey(r.current_stage);
  const s = String(r.status || "").toLowerCase();
  if (/paid|complet/.test(s) || k === "COMPLETED") return 5;
  if (k === "ACCOUNT" || k === "HRFILING") return 4;
  if (k === "DG") return 3;
  if (k === "SUBMITTED") return 1;
  return 2;
}

export default function MyRequestsPage() {
  return <Suspense fallback={<V4Page><Skeleton lines={6} /></V4Page>}><MyRequests /></Suspense>;
}

/** Requests › My Requests (v4.1.0). Only the requester sees this list. */
function MyRequests() {
  const me = useIdentity();
  const params = useSearchParams();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [depts, setDepts] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState(params.get("q") || "");
  const [type, setType] = useState("all");
  const [fy, setFy] = useState<number>(() => currentFyStart());
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!me.ready || !me.userId) return;
    let alive = true;
    (async () => {
      const { from, to } = fyBounds(fy);
      const [list, d] = await Promise.all([
        supabase.from("requests")
          .select("id,request_no,title,amount,status,current_stage,current_owner,created_at,request_type,personal_category,dept_id")
          .eq("created_by", me.userId).gte("created_at", from).lt("created_at", to)
          .order("created_at", { ascending: false }).limit(2000),
        supabase.from("departments").select("id,name"),
      ]);
      if (!alive) return;
      setError(list.error ? list.error.message : null);
      setRows(list.error ? [] : (list.data || []) as Row[]);
      setDepts(Object.fromEntries(((d.data || []) as Array<{ id: string; name: string }>).map((x) => [x.id, x.name])));
    })();
    return () => { alive = false; };
  }, [me.ready, me.userId, fy]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows || []).filter((r) =>
      (type === "all" || kindOf(r) === type) &&
      (!term || `${r.request_no} ${r.title}`.toLowerCase().includes(term)));
  }, [rows, q, type]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: filtered.length, progress: 0, returned: 0, done: 0, rejected: 0 };
    filtered.forEach((r) => { c[bucket(r, me.userId)] += 1; });
    return c;
  }, [filtered, me.userId]);

  const shown = useMemo(() => filtered.filter((r) => tab === "all" || bucket(r, me.userId) === tab), [filtered, tab, me.userId]);
  const paged = shown.slice((page - 1) * PAGE, page * PAGE);
  const years = useMemo(() => { const now = currentFyStart(); return [now, now - 1, now - 2, now - 3]; }, []);

  function exportCsv() {
    downloadCsv(`My_Requests_FY_${fyLabel(fy).replace("/", "-")}.csv`, shown.map((r) => ({
      "Request number": r.request_no || "", Date: shortDate(r.created_at), Title: r.title || "", Type: kindOf(r),
      Department: depts[r.dept_id || ""] || "", Amount: Number(r.amount || 0), Where: stageWords(r.current_stage), Status: statusChip(r.status, r.current_stage).label,
    })));
  }

  return (
    <V4Page>
      <PageHead
        title="My Requests"
        sub={<>Financial year {fyLabel(fy)}. Only you can see this list.</>}
        actions={[
          { label: "Export CSV", icon: "download", kind: "secondary", onClick: exportCsv, disabled: !shown.length },
          { href: "/requests/new", label: "New request", icon: "plus", kind: "primary" },
        ]}
      />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Card>
        <div style={{ padding: "0 12px" }}>
          <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} label="Show" items={[
            { key: "all", label: "All", count: counts.all },
            { key: "progress", label: "In progress", count: counts.progress },
            { key: "returned", label: "Back with me", count: counts.returned },
            { key: "done", label: "Approved & paid", count: counts.done },
            { key: "rejected", label: "Rejected & withdrawn", count: counts.rejected },
          ]} />
        </div>
        <div className="v4-toolbar">
          <label className="v4-field v4-f-search"><span className="v4-flabel">Search</span><span className="v4-control"><input className="v4-input" placeholder="Request number or title" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></span></label>
          <label className="v4-field"><span className="v4-flabel">Type</span>
            <select className="v4-select" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="all">All types</option><option>Official</option><option>Personal · Fund</option><option>Personal · Other</option>
            </select>
          </label>
          <label className="v4-field"><span className="v4-flabel">Financial year</span>
            <select className="v4-select" value={fy} onChange={(e) => { setFy(Number(e.target.value)); setRows(null); setPage(1); }}>
              {years.map((y) => <option key={y} value={y}>FY {fyLabel(y)}</option>)}
            </select>
          </label>
          <span className="v4-f-extra" />
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setQ(""); setType("all"); setTab("all"); setFy(currentFyStart()); setPage(1); }}>Reset</button>
        </div>
        {rows === null ? <Skeleton lines={6} /> : shown.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Request</th><th className="v4-r">Amount</th><th>Title · type</th><th className="v4-hide-sm">Progress</th><th>Status</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {paged.map((r) => {
                  const chip = statusChip(r.status, r.current_stage);
                  const b = bucket(r, me.userId);
                  const n = steps(r);
                  const paid = chip.label === "Paid" || chip.label === "Completed";
                  const label = b === "returned" ? "Back with you" : b === "progress" ? stageWords(r.current_stage) : chip.label;
                  return (
                    <tr key={r.id}>
                      <td><span className="v4-strong">{r.request_no || "—"}</span><span className="v4-sub">{shortDate(r.created_at)}</span></td>
                      <td className="v4-r v4-num v4-strong">{kindOf(r) === "Personal · Other" ? "—" : naira(r.amount)}</td>
                      <td data-label="Title"><span className="v4-strong">{r.title || "Untitled"}</span><span className="v4-sub">{kindOf(r)}{depts[r.dept_id || ""] ? ` · ${depts[r.dept_id || ""]}` : ""}</span></td>
                      <td className="v4-hide-sm"><div className="v4-track" style={{ margin: 0, width: 110 }}>{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i < n || (paid && i <= n) ? "v4-done" : i === n ? "v4-now" : undefined} />)}</div></td>
                      <td><Chip tone={b === "returned" ? "red" : chip.tone}>{label}</Chip></td>
                      <td className="v4-r">
                        {b === "returned" ? <Btn small a={{ href: `/requests/${r.id}/edit`, label: "Correct", kind: "primary" }} />
                          : paid ? <Btn small a={{ href: `/requests/${r.id}/print`, label: "Print", kind: "secondary" }} />
                          : <Btn small a={{ href: `/requests/${r.id}`, label: "Open", kind: "secondary" }} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>{rows.length ? "No request matches these filters." : `You have not made a request in FY ${fyLabel(fy)}.`}</p>}
        <Pager page={page} pageSize={PAGE} total={shown.length} onPage={setPage} label="requests" />
      </Card>
    </V4Page>
  );
}

