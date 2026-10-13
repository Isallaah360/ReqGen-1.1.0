"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { nairaExact } from "@/lib/v4/money";
import { fyLabel, fyOfMonth, fyRange, loadTier, nairaShort, scopeLabel, thisMonth, type Tier } from "@/lib/v4/reports";
import { pvAmount, pvStage, type Voucher } from "@/lib/v4/vouchers";
import { downloadXlsx } from "@/lib/v4/xlsx";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { HBars } from "@/app/components/v4/Charts";
import { Select } from "@/app/components/v4/Select";
import { Notice, PageHead, Skeleton, Stats, V4Page, type StatItem } from "@/app/components/v4/ui";

type Step = { step: string; avg_hours: number; vouchers: number };

/** Reports › Voucher Reports (mock-up 62): by mode and status, signing times, top payees. */
export default function VoucherReportsPage() {
  const me = useIdentity();
  const nowFy = fyOfMonth(thisMonth());
  const [tier, setTier] = useState<Tier | null>(null);
  const [fy, setFy] = useState(nowFy);
  const [rows, setRows] = useState<Voucher[] | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me.ready) return;
    let alive = true;
    queueMicrotask(() => {
      void loadTier(me.role).then((t) => { if (alive) setTier(t); });
      setRows(null);
      const r = fyRange(fy);
      void Promise.all([supabase.rpc("reqgen_pv_list"), supabase.rpc("reqgen_report_voucher_steps", { p_from: r.from, p_to: r.to })]).then(([v, s]) => {
        if (!alive) return;
        setError(v.error?.message || s.error?.message || null);
        setRows(((v.data || []) as Voucher[]).filter((x) => String(x.created_at || "").slice(0, 10) >= r.from && String(x.created_at || "").slice(0, 10) <= r.to));
        setSteps(((s.data || []) as Step[]).map((x) => ({ ...x, avg_hours: Number(x.avg_hours || 0) })));
      });
    });
    return () => { alive = false; };
  }, [me.ready, me.role, fy]);

  const live = (rows || []).filter((v) => pvStage(v.status) !== "cancelled");
  const mode = (m: string) => live.filter((v) => (v.disbursement_mode || "Transfer") === m);
  const sum = (l: Voucher[]) => l.reduce((t, v) => t + pvAmount(v), 0);
  const combined = live.filter((v) => Number(v.item_count || 1) > 1);
  const largest = [...combined].sort((a, b) => pvAmount(b) - pvAmount(a))[0];
  const payees = (() => {
    const m = new Map<string, { n: number; amt: number }>();
    live.filter((v) => pvStage(v.status) === "paid" && Number(v.payee_count || 1) <= 1).forEach((v) => {
      const k = String(v.payee_name || v.cash_payee_name || "—").toUpperCase();
      const e = m.get(k) || { n: 0, amt: 0 }; e.n += 1; e.amt += pvAmount(v); m.set(k, e);
    });
    return [...m.entries()].map(([k, e]) => ({ payee: k, ...e })).sort((a, b) => b.amt - a.amt).slice(0, 10);
  })();
  const byStatus = [
    { label: "Being signed", value: live.filter((v) => ["check", "counter", "dg"].includes(pvStage(v.status))).length },
    { label: "Ready to pay", value: live.filter((v) => pvStage(v.status) === "ready").length },
    { label: "Paid", value: live.filter((v) => pvStage(v.status) === "paid").length },
    { label: "Back with Account", value: live.filter((v) => pvStage(v.status) === "returned").length },
    { label: "Cancelled", value: (rows || []).filter((v) => pvStage(v.status) === "cancelled").length },
  ];

  const stats: StatItem[] = [
    { label: "Vouchers", value: rows ? live.length : "…", note: nairaShort(sum(live)), icon: "card", tone: "blue" },
    { label: "Transfer", value: rows ? mode("Transfer").length : "…", note: nairaShort(sum(mode("Transfer"))), icon: "arrows", tone: "blue" },
    { label: "Cash", value: rows ? mode("Cash").length : "…", note: nairaShort(sum(mode("Cash"))), icon: "wallet", tone: "amber" },
    { label: "Cheque", value: rows ? mode("Cheque").length : "…", note: nairaShort(sum(mode("Cheque"))), icon: "file", tone: "brand" },
  ];

  function exportXlsx() {
    downloadXlsx(`Voucher_Reports_FY_${fyLabel(fy).replace("/", "-")}`, [
      { name: "Vouchers", title: `Payment vouchers — FY ${fyLabel(fy)}`, rows: (rows || []).map((v) => ({ Voucher: v.voucher_no || "", Date: String(v.created_at || "").slice(0, 10), Payee: v.payee_name || "", Mode: v.disbursement_mode || "", Requests: Number(v.item_count || 1), Amount: pvAmount(v), Status: v.status || "", "Prepared as": v.prepared_section || "" })) },
      { name: "Signing times", title: "Average hours at each signing step", rows: steps.map((s) => ({ Step: s.step, "Average hours": s.avg_hours, Vouchers: s.vouchers })) },
      { name: "Top payees", title: "Top payees (paid)", rows: payees.map((p) => ({ Payee: p.payee, Vouchers: p.n, "Amount paid": p.amt })) },
    ]);
  }

  return (
    <V4Page>
      <PageHead title="Voucher Reports" sub={`Payment vouchers for FY ${fyLabel(fy)} by mode, status and signing time.`} scope={tier ? scopeLabel(tier, me.roleName, "all vouchers") : undefined}
        actions={[{ label: "Export Excel", icon: "download", kind: "secondary", onClick: exportXlsx, disabled: !rows?.length }]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <div style={{ maxWidth: 220 }}><Select size="compact" ariaLabel="Financial year" value={String(fy)} onChange={(v) => setFy(Number(v))} options={[0, 1, 2, 3].map((n) => ({ value: String(nowFy - n), label: `FY ${fyLabel(nowFy - n)}` }))} /></div>
      <Stats items={stats} />
      {rows === null ? <Skeleton lines={8} /> : (
        <>
          <div className="v4-grid-2">
            <section className="v4-card v4-card-pad">
              <h2 className="v4-h2">Average time at each signing step</h2><p className="v4-help" style={{ margin: "4px 0 14px" }}>Hours a voucher waits before it is signed.</p>
              {steps.length ? <HBars data={steps.map((s) => ({ label: s.step, value: s.avg_hours }))} fmt={(h) => (h >= 48 ? `${(h / 24).toFixed(1)} days` : `${Math.round(h)} h`)} color="#C2410C" /> : <p className="v4-muted" style={{ margin: 0 }}>No voucher has been signed yet this year.</p>}
            </section>
            <section className="v4-card v4-card-pad">
              <h2 className="v4-h2">Combined Official vouchers</h2><p className="v4-help" style={{ margin: "4px 0 14px" }}>Up to 10 Official requests on one voucher.</p>
              <dl className="v4-kv">
                <dt>Combined vouchers</dt><dd>{combined.length}</dd>
                <dt>Requests carried</dt><dd>{combined.reduce((t, v) => t + Number(v.item_count || 0), 0)}</dd>
                <dt>Payees paid by transfer</dt><dd>{combined.reduce((t, v) => t + Number(v.payee_count || 1), 0)}</dd>
                <dt>Vouchers saved for Account</dt><dd>{combined.reduce((t, v) => t + Number(v.item_count || 1) - 1, 0)}</dd>
                <dt>Largest</dt><dd>{largest ? `${largest.voucher_no} · ${nairaExact(pvAmount(largest))}` : "—"}</dd>
              </dl>
            </section>
          </div>
          <div className="v4-grid-2">
            <section className="v4-card">
              <div className="v4-card-head"><h2 className="v4-h2">Top payees</h2><span className="v4-help">FY {fyLabel(fy)} · paid</span></div>
              {payees.length ? (
                <div className="v4-table-wrap"><table className="v4-data v4-stack"><thead><tr><th>Payee</th><th className="v4-r">Vouchers</th><th className="v4-r">Amount paid</th></tr></thead>
                  <tbody>{payees.map((p) => <tr key={p.payee}><td><span className="v4-strong">{p.payee}</span></td><td className="v4-r v4-num">{p.n}</td><td className="v4-r v4-num v4-strong">{nairaExact(p.amt)}</td></tr>)}</tbody></table></div>
              ) : <p className="v4-muted" style={{ padding: "16px 20px", margin: 0 }}>No voucher paid yet this year.</p>}
            </section>
            <section className="v4-card v4-card-pad">
              <h2 className="v4-h2">By status</h2><p className="v4-help" style={{ margin: "4px 0 14px" }}>Where this year&rsquo;s vouchers are now.</p>
              <HBars data={byStatus} fmt={(n) => String(n)} color="#2563EB" />
            </section>
          </div>
        </>
      )}
    </V4Page>
  );
}
