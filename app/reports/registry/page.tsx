"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fyLabel, fyOfMonth, fyRange, last12, loadTier, monthName, thisMonth, type Tier } from "@/lib/v4/reports";
import { downloadXlsx } from "@/lib/v4/xlsx";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { BarChart } from "@/app/components/v4/Charts";
import { Notice, PageHead, Skeleton, Stats, V4Page, type StatItem } from "@/app/components/v4/ui";

type Row = { month: string; office: string; direction: string; state: "open" | "dispatched" | "archived"; received_at: string; days_to_dispatch: number | null };

/** Reports › Registry Reports (mock-up 63): movement of files and letters — counts and dates only. */
export default function RegistryReportsPage() {
  const me = useIdentity();
  const month = thisMonth();
  const fy = fyOfMonth(month);
  const [tier, setTier] = useState<Tier | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"chart" | "table">("chart");

  useEffect(() => {
    if (!me.ready) return;
    let alive = true;
    queueMicrotask(() => {
      void loadTier(me.role).then((t) => { if (alive) setTier(t); });
      void supabase.rpc("reqgen_report_registry", { p_from: `${last12(month)[0]}-01`, p_to: fyRange(fy).to }).then(({ data, error: e }) => {
        if (!alive) return;
        setError(e ? e.message : null);
        setRows(((data || []) as Row[]).map((r) => ({ ...r, days_to_dispatch: r.days_to_dispatch === null ? null : Number(r.days_to_dispatch) })));
      });
    });
    return () => { alive = false; };
  }, [me.ready, me.role, month, fy]);

  const inFy = (rows || []).filter((r) => r.received_at.slice(0, 10) >= fyRange(fy).from);
  const incoming = inFy.filter((r) => r.direction.startsWith("in"));
  const outgoing = inFy.filter((r) => r.direction.startsWith("out"));
  const dispatched = inFy.filter((r) => r.state === "dispatched");
  const archived = inFy.filter((r) => r.state === "archived");
  const waiting = outgoing.filter((r) => r.state === "open").length;
  const trend = last12(month).map((m) => ({ label: monthName(m, true), month: m, value: (rows || []).filter((r) => r.month === m && r.direction.startsWith("in")).length }));
  const offices = useMemo(() => {
    const m = new Map<string, Row[]>();
    inFy.forEach((r) => m.set(r.office, [...(m.get(r.office) || []), r]));
    return [...m.entries()].map(([o, l]) => {
      const d = l.filter((r) => r.days_to_dispatch !== null);
      return { office: o, received: l.length, dispatched: l.filter((r) => r.state === "dispatched").length, avg: d.length ? d.reduce((t, r) => t + Number(r.days_to_dispatch), 0) / d.length : null, late: d.filter((r) => Number(r.days_to_dispatch) > 5).length };
    }).sort((a, b) => b.received - a.received);
  }, [inFy]);

  const stats: StatItem[] = [
    { label: "Incoming", value: rows ? incoming.length : "…", note: "This FY", icon: "download", tone: "blue" },
    { label: "Outgoing", value: rows ? outgoing.length : "…", note: "This FY", icon: "upload", tone: "brand" },
    { label: "Dispatched", value: rows ? dispatched.length : "…", note: `${waiting} waiting`, icon: "send", tone: "green" },
    { label: "Archived", value: rows ? archived.length : "…", note: "Retention set", icon: "archive", tone: "amber" },
  ];

  function exportXlsx() {
    downloadXlsx(`Registry_Reports_FY_${fyLabel(fy).replace("/", "-")}`, [
      { name: "Per month", title: "Items received per month", rows: trend.map((t) => ({ Month: monthName(t.month), Items: t.value })) },
      { name: "By office", title: `Turnaround by office — FY ${fyLabel(fy)}`, rows: offices.map((o) => ({ Office: o.office, Received: o.received, Dispatched: o.dispatched, "Avg days": o.avg === null ? null : Number(o.avg.toFixed(1)), "Over 5 days": o.late })) },
    ]);
  }

  return (
    <V4Page>
      <PageHead title="Registry Reports" sub="Movement of files and letters. Counts and dates only — request contents are never shown here." scope={tier ? `Your view: registry counts · ${me.roleName}` : undefined}
        actions={[{ label: "Export Excel", icon: "download", kind: "secondary", onClick: exportXlsx, disabled: !rows }]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Stats items={stats} />
      {rows === null ? <Skeleton lines={6} /> : (
        <>
          <section className="v4-card v4-card-pad">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div><h2 className="v4-h2">Items received, last 12 months</h2><p className="v4-help" style={{ margin: "4px 0 0" }}>Incoming letters and files per month.</p></div>
              <div className="v4-viewswitch v4-segmented" role="tablist" aria-label="View">
                <button type="button" role="tab" aria-selected={view === "chart"} onClick={() => setView("chart")}>Chart</button>
                <button type="button" role="tab" aria-selected={view === "table"} onClick={() => setView("table")}>Table</button>
              </div>
            </div>
            {view === "chart" ? <BarChart data={trend} now={11} fmt={(n) => String(Math.round(n))} label="Items received per month" /> : (
              <div className="v4-table-wrap"><table className="v4-data v4-stack"><thead><tr><th>Month</th><th className="v4-r">Items</th></tr></thead><tbody>{trend.map((t) => <tr key={t.month}><td>{monthName(t.month)}</td><td className="v4-r v4-num">{t.value}</td></tr>)}</tbody></table></div>
            )}
          </section>
          <section className="v4-card">
            <div className="v4-card-head"><h2 className="v4-h2">Turnaround by office</h2><span className="v4-help">Days from receipt to dispatch</span></div>
            {offices.length ? (
              <div className="v4-table-wrap"><table className="v4-data v4-stack"><thead><tr><th>Office</th><th className="v4-r">Received</th><th className="v4-r">Dispatched</th><th className="v4-r">Avg days</th><th className="v4-r">Over 5 days</th></tr></thead>
                <tbody>{offices.map((o) => <tr key={o.office}><td><span className="v4-strong">{o.office}</span></td><td className="v4-r v4-num">{o.received}</td><td className="v4-r v4-num">{o.dispatched}</td><td className="v4-r v4-num">{o.avg === null ? "—" : o.avg.toFixed(1)}</td><td className="v4-r v4-num">{o.late}</td></tr>)}</tbody></table></div>
            ) : <p className="v4-muted" style={{ padding: "16px 20px", margin: 0 }}>No registry item this year yet.</p>}
          </section>
        </>
      )}
    </V4Page>
  );
}
