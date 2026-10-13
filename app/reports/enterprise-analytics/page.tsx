"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SUBHEAD_COLUMNS, num, subheadLabel, subheadUsed, utilisation, type Subhead } from "@/lib/v4/finance";
import { addMonths, fyLabel, fyOfMonth, last12, loadTier, loadTransactions, monthName, monthOf, monthRange, nairaShort, pct, scopeLabel, thisMonth, type Tier, type TxRow } from "@/lib/v4/reports";
import { downloadXlsx } from "@/lib/v4/xlsx";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { BarChart, Pace } from "@/app/components/v4/Charts";
import { Btn, Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";
import Icon from "@/app/components/v4/Icon";

type Exception = { tone: "red" | "amber"; title: string; detail: string; link: string; at: string };

/** Reports › Executive Analytics (mock-up 64): budget pace, subheads at risk and exceptions. */
export default function ExecutiveAnalyticsPage() {
  const me = useIdentity();
  const month = thisMonth();
  const fy = fyOfMonth(month);
  const [tier, setTier] = useState<Tier | null>(null);
  const [subs, setSubs] = useState<Subhead[] | null>(null);
  const [tx, setTx] = useState<TxRow[]>([]);
  const [ex, setEx] = useState<Exception[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me.ready) return;
    let alive = true;
    queueMicrotask(() => {
      void loadTier(me.role).then((t) => { if (alive) setTier(t); });
      void Promise.all([
        supabase.from("subheads").select(SUBHEAD_COLUMNS).eq("is_active", true),
        loadTransactions(monthRange(addMonths(month, -11)).from, monthRange(month).to),
        supabase.rpc("reqgen_report_exceptions"),
      ]).then(([s, t, e]) => {
        if (!alive) return;
        setError(s.error?.message || e.error?.message || t.error || null);
        setSubs((s.data || []) as Subhead[]);
        setTx(t.rows);
        setEx(((e.data || []) as Exception[]).sort((a, b) => (a.tone === b.tone ? String(b.at).localeCompare(String(a.at)) : a.tone === "red" ? -1 : 1)));
      });
    });
    return () => { alive = false; };
  }, [me.ready, me.role, month]);

  const alloc = (subs || []).reduce((t, s) => t + num(s.approved_allocation), 0);
  const spent = (subs || []).reduce((t, s) => t + num(s.expenditure), 0);
  const used = pct(spent, alloc);
  const monthsGone = ((Number(month.slice(5, 7)) - 9 + 12) % 12) + 1;
  const expected = Math.round((monthsGone / 12) * 100);
  const risk = useMemo(() => (subs || []).filter((s) => num(s.approved_allocation) > 0 && utilisation(s) >= 80).sort((a, b) => utilisation(b) - utilisation(a)).slice(0, 6), [subs]);
  const trend = last12(month).map((m) => ({ label: monthName(m, true), month: m, value: tx.filter((r) => r.kind === "out" && monthOf(r.at) === m).reduce((t, r) => t + r.amount, 0) }));
  const ahead = used > expected + 5;

  function exportXlsx() {
    downloadXlsx(`Executive_Analytics_${month}`, [
      { name: "Budget", title: `Budget used — FY ${fyLabel(fy)}`, rows: [{ Allocation: alloc, Spent: spent, "Used %": used, "Expected by now %": expected }] },
      { name: "Subheads at risk", title: "Subheads at 80% or more", rows: risk.map((s) => ({ Subhead: subheadLabel(s), Allocation: num(s.approved_allocation), "Spent and reserved": subheadUsed(s), "Used %": utilisation(s) })) },
      { name: "Spending trend", title: "Money out per month", rows: trend.map((t) => ({ Month: monthName(t.month), "Money out": t.value })) },
      { name: "Exceptions", title: "Things outside the normal path", rows: ex.map((e) => ({ Level: e.tone === "red" ? "Act now" : "Check", What: e.title, Details: e.detail })) },
    ]);
  }

  return (
    <V4Page>
      <PageHead title="Executive Analytics" sub="Budget pace, subheads at risk and things that need attention — on one page." scope={tier ? scopeLabel(tier, me.roleName).replace("all departments", "whole Trust") : undefined}
        actions={[
          { label: "Export Excel", icon: "download", kind: "secondary", onClick: exportXlsx, disabled: !subs },
          { label: "Print A4", icon: "printer", kind: "secondary", href: `/reports/print?report=monthly&month=${month}` },
        ]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {subs === null ? <Skeleton lines={8} /> : (
        <>
          <div className="v4-grid-2">
            <section className="v4-card v4-card-pad">
              <h2 className="v4-h2">Budget used</h2><p className="v4-help" style={{ margin: "4px 0 14px" }}>FY {fyLabel(fy)} · {monthsGone} of 12 month{monthsGone === 1 ? "" : "s"} gone</p>
              <div className="v4-hero-n"><span className="v4-big">{used}%</span><span className="v4-cmp">{nairaShort(spent)} of {nairaShort(alloc)} · expected by now about <b>{expected}%</b></span></div>
              <Pace used={used} expected={expected} />
              <Notice tone={ahead ? "amber" : "green"}>{ahead ? `Spending is ahead of pace${risk.length ? `, mostly ${[...new Set(risk.slice(0, 2).map((s) => s.name))].join(" and ")}` : ""}.` : "Spending is on or below pace for the year."}</Notice>
            </section>
            <section className="v4-card v4-card-pad">
              <h2 className="v4-h2" style={{ marginBottom: 14 }}>Subheads at risk</h2>
              {risk.length ? (
                <ul className="v4-util">
                  {risk.map((s) => {
                    const p = utilisation(s);
                    return <li key={s.id}><strong>{subheadLabel(s)}</strong><span className="v4-v">{nairaShort(subheadUsed(s))} of {nairaShort(num(s.approved_allocation))} · {p}%</span><span className="v4-bar"><span className={p >= 90 ? "v4-risk" : "v4-warn"} style={{ width: `${Math.min(100, p)}%` }} /></span></li>;
                  })}
                </ul>
              ) : <p className="v4-muted" style={{ margin: 0 }}>No subhead is at 80% or more.</p>}
            </section>
          </div>
          <section className="v4-card v4-card-pad">
            <h2 className="v4-h2">Spending trend</h2><p className="v4-help" style={{ margin: "4px 0 14px" }}>Money out per month (vouchers paid), last 12 months.</p>
            <BarChart data={trend} now={11} fmt={nairaShort} label="Money out per month" />
          </section>
          <section className="v4-card">
            <div className="v4-card-head"><h2 className="v4-h2">Exceptions</h2><span className="v4-help">Things outside the normal path</span></div>
            {ex.length ? (
              <ul className="v4-rows">
                {ex.map((e, i) => (
                  <li key={`${e.title}-${i}`}><span className={`v4-ri v4-t-${e.tone}`}><Icon name={e.tone === "red" ? "alert" : "info"} /></span>
                    <span className="v4-rt"><strong>{e.title}</strong><span>{e.detail}</span></span>
                    <span className="v4-rr">{e.link ? <Btn small a={{ href: e.link, label: "Open", kind: "secondary" }} /> : null}</span></li>
                ))}
              </ul>
            ) : <p className="v4-muted" style={{ padding: "16px 20px", margin: 0 }}>Nothing outside the normal path.</p>}
          </section>
        </>
      )}
    </V4Page>
  );
}
