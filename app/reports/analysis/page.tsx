"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { nairaExact } from "@/lib/v4/money";
import { addMonths, fyLabel, fyOfMonth, groupOf, last12, loadTier, loadTransactions, monthName, monthOf, monthRange, nairaShort, scopeLabel, thisMonth, type Tier, type TxRow } from "@/lib/v4/reports";
import { downloadXlsx } from "@/lib/v4/xlsx";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { BarChart, Donut, HBars } from "@/app/components/v4/Charts";
import { Notice, PageHead, Skeleton, Stats, V4Page, type StatItem } from "@/app/components/v4/ui";

type Period = "month" | "quarter" | "fy";

export default function AnalysisPage() {
  return <Suspense fallback={<V4Page><Skeleton lines={8} /></V4Page>}><Analysis /></Suspense>;
}

/** Reports › Analysis (mock-up 59): where the money went, and how it compares. */
function Analysis() {
  const me = useIdentity();
  const params = useSearchParams();
  const [tier, setTier] = useState<Tier | null>(null);
  const [month, setMonth] = useState(() => (/^\d{4}-\d{2}$/.test(params.get("month") || "") ? String(params.get("month")) : thisMonth()));
  const [period, setPeriod] = useState<Period>("month");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [rows, setRows] = useState<TxRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 24 months back covers the 12-month chart, the year before for comparison, and any FY
  useEffect(() => {
    if (!me.ready) return;
    let alive = true;
    queueMicrotask(() => {
      void loadTier(me.role).then((t) => { if (alive) setTier(t); });
      setRows(null);
      void loadTransactions(monthRange(addMonths(month, -23)).from, monthRange(month).to).then((r) => { if (alive) { setRows(r.rows); setError(r.error); } });
    });
    return () => { alive = false; };
  }, [me.ready, me.role, month]);

  const months = useMemo(() => {
    if (period === "month") return [month];
    if (period === "quarter") return [addMonths(month, -2), addMonths(month, -1), month];
    const fy = fyOfMonth(month);
    return Array.from({ length: 12 }, (_, i) => addMonths(`${fy}-09`, i)).filter((m) => m <= month);
  }, [period, month]);
  const before = useMemo(() => months.map((m) => addMonths(m, period === "fy" ? -12 : -months.length)), [months, period]);
  const label = period === "month" ? monthName(month) : period === "quarter" ? `${monthName(months[0], true)}–${monthName(month)}` : `FY ${fyLabel(fyOfMonth(month))} to ${monthName(month, true)}`;
  const prevLabel = period === "month" ? monthName(addMonths(month, -1), true) : period === "quarter" ? "the quarter before" : "the year before";

  const inSet = (set: string[]) => (r: TxRow) => set.includes(monthOf(r.at));
  const out = (rows || []).filter((r) => r.kind === "out");
  const outNow = out.filter(inSet(months));
  const outBefore = out.filter(inSet(before));
  const sum = (l: TxRow[]) => l.reduce((t, r) => t + r.amount, 0);
  const inNow = (rows || []).filter((r) => (r.kind === "in" || r.kind === "transfer") && months.includes(monthOf(r.at)));
  const vouchers = new Set(outNow.map((r) => r.ref)).size;
  const days = (l: TxRow[]) => { const d = l.filter((r) => r.days_to_pay !== null && r.days_to_pay !== undefined); return d.length ? d.reduce((t, r) => t + Number(r.days_to_pay), 0) / d.length : null; };
  const dNow = days(outNow), dBefore = days(outBefore);
  const change = sum(outBefore) ? Math.round(((sum(outNow) - sum(outBefore)) / sum(outBefore)) * 100) : null;

  const trend = last12(month).map((m) => ({ label: monthName(m, true), month: m, value: sum(out.filter((r) => monthOf(r.at) === m)) }));
  const group = (key: (r: TxRow) => string) => {
    const g = new Map<string, number>();
    outNow.forEach((r) => g.set(key(r), (g.get(key(r)) || 0) + r.amount));
    return [...g.entries()].map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value);
  };
  const groupName = (() => {
    const names = new Map<string, Map<string, number>>();
    out.forEach((r) => { const g = groupOf(r.subhead_code); const m = names.get(g) || new Map(); m.set(r.dept_name || g, (m.get(r.dept_name || g) || 0) + 1); names.set(g, m); });
    return (g: string) => { const m = names.get(g); const top = m ? [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] : ""; return top && top !== g ? `${g} — ${top}` : g; };
  })();
  const byGroup = group((r) => groupName(groupOf(r.subhead_code))).slice(0, 6);
  const byDept = group((r) => r.dept_name || "No department").slice(0, 8);

  const stats: StatItem[] = [
    { label: tier === "mine" ? "Paid to you" : "Money out", value: rows ? nairaShort(sum(outNow)) : "…", note: change === null ? "Nothing to compare" : `${change >= 0 ? "+" : ""}${change}% on ${prevLabel}`, icon: "upload", tone: "brand" },
    ...(tier !== "mine" ? [{ label: "Money in", value: rows ? nairaShort(sum(inNow)) : "…", note: "Allocations, transfers", icon: "download", tone: "green" as const }] : []),
    { label: "Vouchers paid", value: rows ? vouchers : "…", note: vouchers ? `Avg ${nairaShort(sum(outNow) / vouchers)}` : "—", icon: "card", tone: "blue" },
    { label: "Request to payment", value: rows ? (dNow === null ? "—" : `${dNow.toFixed(1)} days`) : "…", note: dBefore === null ? "From submission to paid" : `Was ${dBefore.toFixed(1)} days`, icon: "clock", tone: "amber" },
  ];

  function exportXlsx() {
    downloadXlsx(`Analysis_${month}`, [
      { name: "Last 12 months", title: `Money out per month, to ${monthName(month)}`, rows: trend.map((t) => ({ Month: monthName(t.month), "Money out": t.value })) },
      { name: "By expense group", title: `By expense group — ${label}`, rows: byGroup.map((g) => ({ Group: g.label, Amount: g.value })) },
      { name: "By department", title: `By department — ${label}`, rows: byDept.map((g) => ({ Department: g.label, Amount: g.value })) },
    ]);
  }

  return (
    <V4Page>
      <PageHead title="Analysis" sub={`Where the money went in ${label}, and how it compares with the last 12 months.`} scope={tier ? scopeLabel(tier, me.roleName) : undefined}
        actions={[
          { label: "Transactions", icon: "list", kind: "secondary", href: `/reports/transactions?month=${month}` },
          { label: "Export Excel", icon: "download", kind: "secondary", onClick: exportXlsx, disabled: !rows },
          ...(tier !== "mine" ? [{ label: "Print A4", icon: "printer", kind: "secondary" as const, href: `/reports/print?report=monthly&month=${month}` }] : []),
        ]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span className="v4-monthpick" aria-label="Month">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><Icon name="left" /></button>
          <b>{monthName(month)}</b>
          <button type="button" aria-label="Next month" disabled={month >= thisMonth()} onClick={() => setMonth(addMonths(month, 1))}><Icon name="right" /></button>
        </span>
        <div className="v4-segmented" role="tablist" aria-label="Period">
          {([["month", "Month"], ["quarter", "Quarter"], ["fy", "Financial year"]] as Array<[Period, string]>).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={period === k} onClick={() => setPeriod(k)}>{l}</button>)}
        </div>
      </div>
      <Stats items={stats} />
      {rows === null ? <Skeleton lines={8} /> : (
        <>
          <section className="v4-card v4-card-pad">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div><h2 className="v4-h2">{tier === "mine" ? "Paid to you" : "Money out"}, last 12 months</h2><p className="v4-help" style={{ margin: "4px 0 0" }}>{monthName(month, true)} is highlighted. Hover a bar for the amount.</p></div>
              <div className="v4-viewswitch v4-segmented" role="tablist" aria-label="View">
                <button type="button" role="tab" aria-selected={view === "chart"} onClick={() => setView("chart")}>Chart</button>
                <button type="button" role="tab" aria-selected={view === "table"} onClick={() => setView("table")}>Table</button>
              </div>
            </div>
            {view === "chart" ? <BarChart data={trend} now={11} fmt={nairaShort} label="Money out per month" /> : (
              <div className="v4-table-wrap"><table className="v4-data v4-stack"><thead><tr><th>Month</th><th className="v4-r">Money out</th></tr></thead>
                <tbody>{trend.map((t) => <tr key={t.month}><td>{monthName(t.month)}</td><td className="v4-r v4-num">{nairaExact(t.value)}</td></tr>)}</tbody></table></div>
            )}
          </section>
          <div className="v4-grid-2">
            <section className="v4-card v4-card-pad">
              <h2 className="v4-h2">By expense group</h2><p className="v4-help" style={{ margin: "4px 0 14px" }}>Share of spending in {label}.</p>
              {byGroup.length ? <Donut data={byGroup} fmt={nairaShort} label="Spending by expense group" /> : <p className="v4-muted" style={{ margin: 0 }}>Nothing paid in {label}.</p>}
            </section>
            <section className="v4-card v4-card-pad">
              <h2 className="v4-h2">By department</h2><p className="v4-help" style={{ margin: "4px 0 14px" }}>Money out in {label}, largest first.</p>
              {byDept.length ? <HBars data={byDept} fmt={nairaShort} /> : <p className="v4-muted" style={{ margin: 0 }}>Nothing paid in {label}.</p>}
            </section>
          </div>
        </>
      )}
    </V4Page>
  );
}
