"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { nairaExact } from "@/lib/v4/money";
import { shortDate } from "@/lib/v4/requestText";
import { addMonths, fyLabel, fyOfMonth, fyRange, loadTier, monthName, monthRange, pct, scopeLabel, thisMonth, type Tier } from "@/lib/v4/reports";
import { downloadXlsx } from "@/lib/v4/xlsx";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { HBars } from "@/app/components/v4/Charts";
import { Select } from "@/app/components/v4/Select";
import { Card, Chip, Notice, PageHead, Pager, Skeleton, Stats, Tabs, V4Page, type StatItem } from "@/app/components/v4/ui";

type Row = { id: string; request_no: string | null; title: string | null; dept_name: string; request_type: string; status: string; bucket: "approved" | "rejected" | "withdrawn" | "returned" | "pending"; amount: number; created_at: string; decided_at: string | null; returned_count: number; is_mine: boolean };
type Tab = "dept" | "chart" | "list";
const PAGE = 20;
const BUCKET: Record<Row["bucket"], { label: string; tone: "green" | "red" | "grey" | "amber" | "blue" }> = {
  approved: { label: "Approved", tone: "green" }, rejected: { label: "Rejected", tone: "red" }, withdrawn: { label: "Withdrawn", tone: "grey" },
  returned: { label: "Sent back", tone: "amber" }, pending: { label: "Pending", tone: "blue" },
};

/** Reports › Request Reports (mock-up 60): requests by department and status. */
export default function RequestReportsPage() {
  const me = useIdentity();
  const now = thisMonth();
  const fy = fyOfMonth(now);
  const periods = useMemo(() => {
    const qs = [0, 1, 2, 3].map((q) => ({ value: `q${q + 1}`, label: `Quarter ${q + 1} (${monthName(addMonths(`${fy}-09`, q * 3), true)}–${monthName(addMonths(`${fy}-09`, q * 3 + 2), true)})`, from: monthRange(addMonths(`${fy}-09`, q * 3)).from, to: monthRange(addMonths(`${fy}-09`, q * 3 + 2)).to }));
    return [
      { value: "fy", label: `FY ${fyLabel(fy)}`, ...fyRange(fy) },
      { value: "month", label: monthName(now), ...monthRange(now) },
      ...qs.filter((q) => q.from <= monthRange(now).to),
      { value: "lastfy", label: `FY ${fyLabel(fy - 1)}`, ...fyRange(fy - 1) },
    ];
  }, [fy, now]);
  const [tier, setTier] = useState<Tier | null>(null);
  const [period, setPeriod] = useState("fy");
  const [dept, setDept] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [tab, setTab] = useState<Tab>("dept");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const p = periods.find((x) => x.value === period) || periods[0];

  useEffect(() => {
    if (!me.ready) return;
    let alive = true;
    queueMicrotask(() => {
      void loadTier(me.role).then((t) => { if (alive) setTier(t); });
      setRows(null);
      void supabase.rpc("reqgen_report_requests", { p_from: p.from, p_to: p.to }).then(({ data, error: e }) => {
        if (!alive) return;
        setError(e ? e.message : null);
        setRows(((data || []) as Row[]).map((r) => ({ ...r, amount: Number(r.amount || 0) })));
      });
    });
    return () => { alive = false; };
  }, [me.ready, me.role, p.from, p.to]);

  const depts = useMemo(() => [...new Set((rows || []).map((r) => r.dept_name).filter(Boolean))].sort(), [rows]);
  const list = useMemo(() => (rows || []).filter((r) => (dept === "all" || r.dept_name === dept) && (type === "all" || r.request_type.toLowerCase() === type) && (status === "all" || r.bucket === status)), [rows, dept, type, status]);
  const days = (l: Row[]) => { const d = l.filter((r) => r.decided_at); return d.length ? d.reduce((t, r) => t + (new Date(r.decided_at!).getTime() - new Date(r.created_at).getTime()) / 86400000, 0) / d.length : null; };
  const table = useMemo(() => {
    const m = new Map<string, Row[]>();
    list.forEach((r) => m.set(r.dept_name || "No department", [...(m.get(r.dept_name || "No department") || []), r]));
    return [...m.entries()].map(([d, l]) => ({ dept: d, n: l.length, approved: l.filter((r) => r.bucket === "approved").length, pending: l.filter((r) => r.bucket === "pending").length,
      returned: l.filter((r) => r.returned_count > 0).length, rejected: l.filter((r) => r.bucket === "rejected").length, amount: l.filter((r) => r.bucket === "approved").reduce((t, r) => t + r.amount, 0), days: days(l) }))
      .sort((a, b) => b.n - a.n);
  }, [list]);
  const total = { n: list.length, approved: list.filter((r) => r.bucket === "approved").length, pending: list.filter((r) => r.bucket === "pending").length, returned: list.filter((r) => r.returned_count > 0).length, rejected: list.filter((r) => r.bucket === "rejected").length, amount: list.filter((r) => r.bucket === "approved").reduce((t, r) => t + r.amount, 0), days: days(list) };
  const mine = tier === "mine";

  const stats: StatItem[] = [
    { label: "Submitted", value: rows ? total.n : "…", note: p.label, icon: "file", tone: "blue" },
    { label: "Approved", value: rows ? total.approved : "…", note: `${pct(total.approved, total.n)}% of submitted`, icon: "check", tone: "green", pressed: status === "approved", onClick: () => setStatus(status === "approved" ? "all" : "approved") },
    { label: "Sent back", value: rows ? total.returned : "…", note: "At least once", icon: "returned", tone: "amber" },
    { label: "Rejected", value: rows ? total.rejected : "…", note: `${pct(total.rejected, total.n)}%`, icon: "x", tone: "red", pressed: status === "rejected", onClick: () => setStatus(status === "rejected" ? "all" : "rejected") },
  ];

  function exportXlsx() {
    downloadXlsx(`Request_Reports_${p.value}`, [
      { name: "By department", title: `Requests by department — ${p.label}`, rows: [...table.map((t) => ({ Department: t.dept, Submitted: t.n, Approved: t.approved, Pending: t.pending, "Sent back": t.returned, Rejected: t.rejected, "Amount approved": t.amount, "Avg days to approve": t.days === null ? null : Number(t.days.toFixed(1)) })),
        { Department: "Total", Submitted: total.n, Approved: total.approved, Pending: total.pending, "Sent back": total.returned, Rejected: total.rejected, "Amount approved": total.amount, "Avg days to approve": total.days === null ? null : Number(total.days.toFixed(1)) }] },
      { name: "Requests", title: `Requests — ${p.label}`, rows: list.map((r) => ({ Request: r.request_no || "", ...(mine ? { Title: r.title || "" } : {}), Department: r.dept_name, Type: r.request_type, Status: r.status, Amount: r.amount, Submitted: shortDate(r.created_at) })) },
    ]);
  }

  return (
    <V4Page>
      <PageHead title={mine ? "My Requests" : "Request Reports"} sub={`Requests by department and status, ${p.value === "fy" ? `financial year ${fyLabel(fy)} (1 Sep ${fy} – 31 Aug ${fy + 1})` : p.label}.`}
        scope={tier ? scopeLabel(tier, me.roleName, "requests treated by Finance") : undefined}
        actions={[{ label: "Export Excel", icon: "download", kind: "secondary", onClick: exportXlsx, disabled: !list.length }]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Stats items={stats} />
      <Card>
        <div className="v4-toolbar">
          <div className="v4-field"><span className="v4-flabel">Period</span><Select size="compact" ariaLabel="Period" value={period} onChange={(v) => { setPeriod(v); setPage(1); }} options={periods.map((x) => ({ value: x.value, label: x.label }))} /></div>
          {!mine ? <div className="v4-field"><span className="v4-flabel">Department</span><Select size="compact" ariaLabel="Department" value={dept} onChange={(v) => { setDept(v); setPage(1); }} options={[{ value: "all", label: "All departments" }, ...depts.map((d) => ({ value: d, label: d }))]} /></div> : null}
          <div className="v4-field"><span className="v4-flabel">Type</span><Select size="compact" ariaLabel="Type" value={type} onChange={(v) => { setType(v); setPage(1); }} options={[{ value: "all", label: "Official and personal" }, { value: "official", label: "Official" }, { value: "personal", label: "Personal" }]} /></div>
          <div className="v4-field v4-f-extra"><span className="v4-flabel">Status</span><Select size="compact" ariaLabel="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "all", label: "All statuses" }, ...Object.entries(BUCKET).map(([k, v]) => ({ value: k, label: v.label }))]} /></div>
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setPeriod("fy"); setDept("all"); setType("all"); setStatus("all"); setPage(1); }}><Icon name="returned" />Reset</button>
        </div>
        <div style={{ padding: "0 12px" }}>
          <Tabs value={tab} onChange={setTab} label="View" items={[{ key: "dept", label: "By department" }, { key: "chart", label: "Chart" }, { key: "list", label: "Request list", count: list.length }]} />
        </div>
        {rows === null ? <Skeleton lines={6} /> : !list.length ? <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No request in {p.label}.</p> : tab === "dept" ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Department</th><th className="v4-r">Submitted</th><th className="v4-r">Approved</th><th className="v4-r v4-hide-sm">Pending</th><th className="v4-r">Sent back</th><th className="v4-r">Rejected</th><th className="v4-r">Amount approved</th><th className="v4-r v4-hide-sm">Avg days to approve</th></tr></thead>
              <tbody>
                {table.map((t) => (
                  <tr key={t.dept}><td><span className="v4-strong">{t.dept}</span></td><td className="v4-r v4-num">{t.n}</td><td className="v4-r v4-num">{t.approved}</td><td className="v4-r v4-num v4-hide-sm">{t.pending}</td><td className="v4-r v4-num">{t.returned}</td><td className="v4-r v4-num">{t.rejected}</td><td className="v4-r v4-num v4-strong">{nairaExact(t.amount)}</td><td className="v4-r v4-num v4-hide-sm">{t.days === null ? "—" : t.days.toFixed(1)}</td></tr>
                ))}
                <tr><td><span className="v4-strong">Total</span></td><td className="v4-r v4-num v4-strong">{total.n}</td><td className="v4-r v4-num v4-strong">{total.approved}</td><td className="v4-r v4-num v4-strong v4-hide-sm">{total.pending}</td><td className="v4-r v4-num v4-strong">{total.returned}</td><td className="v4-r v4-num v4-strong">{total.rejected}</td><td className="v4-r v4-num v4-strong">{nairaExact(total.amount)}</td><td className="v4-r v4-num v4-strong v4-hide-sm">{total.days === null ? "—" : total.days.toFixed(1)}</td></tr>
              </tbody>
            </table>
          </div>
        ) : tab === "chart" ? (
          <div className="v4-card-pad"><HBars data={table.map((t) => ({ label: t.dept, value: t.n }))} fmt={(n) => `${n} request${n === 1 ? "" : "s"}`} /></div>
        ) : (
          <>
            <div className="v4-table-wrap">
              <table className="v4-data v4-stack">
                <thead><tr><th>Request</th><th>Department</th><th>Type</th><th>Status</th><th className="v4-r">Amount</th><th className="v4-hide-sm">Submitted</th></tr></thead>
                <tbody>
                  {list.slice((page - 1) * PAGE, page * PAGE).map((r) => (
                    <tr key={r.id}>
                      <td>{r.is_mine ? <Link href={`/requests/${r.id}`} className="v4-strong">{r.request_no}</Link> : <span className="v4-strong">{r.request_no}</span>}{r.title ? <span className="v4-sub">{r.title}</span> : null}</td>
                      <td data-label="Department">{r.dept_name || "—"}</td><td data-label="Type">{r.request_type}</td>
                      <td data-label="Status"><Chip tone={BUCKET[r.bucket].tone}>{BUCKET[r.bucket].label}</Chip></td>
                      <td className="v4-r v4-num v4-strong">{nairaExact(r.amount)}</td><td className="v4-hide-sm">{shortDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pageSize={PAGE} total={list.length} onPage={setPage} label="requests" />
          </>
        )}
      </Card>
      {!mine ? <Notice tone="blue">Titles are shown only for your own requests. Request contents stay with the people on each request&rsquo;s route.</Notice> : null}
    </V4Page>
  );
}
