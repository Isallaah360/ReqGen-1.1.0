"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { printA4Sheet, useA4Fit } from "@/lib/printA4";
import { SUBHEAD_COLUMNS, num, type Subhead } from "@/lib/v4/finance";
import { fyLabel, fyOfMonth, fyRange, groupOf, loadSpend, loadTier, loadTransactions, logPrint, monthName, monthRange, thisMonth, type SpendRow, type TxRow } from "@/lib/v4/reports";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

const money = (n: number) => `₦${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ReportPrintPage() {
  return <Suspense fallback={<V4Page><Skeleton lines={8} /></V4Page>}><ReportPrint /></Suspense>;
}

/** Reports › Print report (mock-up 67): every report prints on one A4 page with the IET header. */
function ReportPrint() {
  const me = useIdentity();
  const router = useRouter();
  const params = useSearchParams();
  const month = /^\d{4}-\d{2}$/.test(params.get("month") || "") ? String(params.get("month")) : thisMonth();
  const dept = params.get("dept") || "all";
  const fy = fyOfMonth(month);
  const sheet = useRef<HTMLElement>(null);
  const [subs, setSubs] = useState<Subhead[] | null>(null);
  const [spend, setSpend] = useState<SpendRow[]>([]);
  const [tx, setTx] = useState<TxRow[]>([]);
  const [deptName, setDeptName] = useState("All departments");
  const [auditor, setAuditor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printedAt] = useState(() => new Date());
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!me.ready) return;
    let alive = true;
    queueMicrotask(async () => {
      // Subhead allocations are never shown to staff, Registry or PD (database tier decides).
      if ((await loadTier(me.role)) === "mine") { if (alive) setDenied(true); return; }
      const r = fyRange(fy);
      void Promise.all([
        supabase.from("subheads").select(SUBHEAD_COLUMNS).eq("is_active", true),
        loadSpend(r.from, monthRange(month).to),
        loadTransactions(monthRange(month).from, monthRange(month).to),
        dept !== "all" ? supabase.from("departments").select("name").eq("id", dept).maybeSingle() : Promise.resolve({ data: null }),
        supabase.rpc("reqgen_pv_checkers"),
      ]).then(([s, sp, t, d, a]) => {
        if (!alive) return;
        setError(s.error?.message || sp.error || t.error || null);
        setSubs(((s.data || []) as Subhead[]).filter((x) => dept === "all" || x.dept_id === dept));
        setSpend(sp.rows.filter((x) => dept === "all" || x.dept_id === dept));
        setTx(t.rows);
        if (d.data) setDeptName(String((d.data as { name?: string }).name || ""));
        setAuditor(((a.data || []) as Array<{ full_name: string }>)[0]?.full_name || "");
      });
    });
    return () => { alive = false; };
  }, [me.ready, me.role, month, fy, dept]);

  const data = useMemo(() => {
    const list = subs || [];
    const alloc = list.reduce((t, s) => t + num(s.approved_allocation), 0);
    const inMonth = spend.filter((x) => x.at.startsWith(month));
    const spentMonth = inMonth.reduce((t, x) => t + x.amount, 0);
    const spentToDate = spend.reduce((t, x) => t + x.amount, 0);
    const moneyIn = tx.filter((r) => r.kind === "in").reduce((t, r) => t + r.amount, 0);
    const groups = new Map<string, { alloc: number; month: number; todate: number; name: string }>();
    list.forEach((s) => { const k = groupOf(s.code); const g = groups.get(k) || { alloc: 0, month: 0, todate: 0, name: s.name }; g.alloc += num(s.approved_allocation); groups.set(k, g); });
    spend.forEach((x) => { const k = groupOf(x.subhead_code); const g = groups.get(k) || { alloc: 0, month: 0, todate: 0, name: x.dept_name || k }; g.todate += x.amount; if (x.at.startsWith(month)) g.month += x.amount; groups.set(k, g); });
    const deptOf = new Map<string, string>();
    spend.forEach((x) => { if (x.dept_name) deptOf.set(groupOf(x.subhead_code), x.dept_name); });
    const risk = list.filter((s) => num(s.approved_allocation) > 0 && num(s.expenditure) / num(s.approved_allocation) >= 0.8).sort((a, b) => num(b.expenditure) / num(b.approved_allocation) - num(a.expenditure) / num(a.approved_allocation)).slice(0, 5);
    const out = tx.filter((r) => r.kind === "out");
    const vouchers = new Map<string, { ref: string; title: string; detail: string; mode: string; amount: number; items: number }>();
    out.forEach((r) => { const v = vouchers.get(r.ref) || { ref: r.ref, title: r.title, detail: r.detail, mode: r.mode || "Transfer", amount: 0, items: 0 }; v.amount += r.amount; v.items += 1; vouchers.set(r.ref, v); });
    const vs = [...vouchers.values()];
    const modes = ["Transfer", "Cash", "Cheque"].map((m) => { const l = vs.filter((v) => v.mode === m); return { mode: m, n: l.length, amt: l.reduce((t, v) => t + v.amount, 0), combined: l.filter((v) => v.items > 1).length }; });
    return { alloc, spentMonth, spentToDate, moneyIn, groups: [...groups.entries()].map(([k, g]) => ({ label: `${k} — ${deptOf.get(k) || g.name}`, ...g })).sort((a, b) => b.alloc - a.alloc), risk, modes, largest: vs.sort((a, b) => b.amount - a.amount).slice(0, 5) };
  }, [subs, spend, tx, month]);

  useA4Fit(sheet, [data, subs]);
  const monthNo = ((Number(month.slice(5, 7)) - 9 + 12) % 12) + 1;
  const title = "Monthly Expenditure Statement";
  const short = monthName(month, true);

  async function print() {
    setPrinting(true);
    await logPrint("report", null, `${title} · ${monthName(month)}${dept !== "all" ? ` · ${deptName}` : ""}`);
    await printA4Sheet(sheet.current, `${title} — ${monthName(month)}`);
    setPrinting(false);
  }

  if (denied) return <V4Page><PageHead title="Print report" /><Notice tone="amber">The monthly finance report is for Finance, the DG&rsquo;s office, the Auditor and the Super Admin. Your own requests and payments are in Reports › Transactions.</Notice></V4Page>;

  return (
    <V4Page>
      <PageHead title="Print report" sub="Every report prints on one A4 page with the IET header. Use “Save as PDF” in the print window for a file."
        actions={[
          { label: "Back to statements", icon: "left", kind: "secondary", onClick: () => router.push("/reports/finance-statements") },
          { label: printing ? "Preparing…" : "Print or save PDF", icon: "printer", kind: "primary", onClick: () => void print(), disabled: !subs || printing },
        ]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {subs === null ? <Skeleton lines={10} /> : (
        <div className="v4-print-stage">
          <div className="rg-a4-stage">
            <article ref={sheet} className="rg-a4-page" aria-label="Report on A4">
              <div className="rg-a4-content v4-rpt">
                <div className="v4-rh"><Image src="/iet-logo.png" alt="IET logo" width={56} height={56} /><div className="v4-o"><b>Islamic Education Trust</b><span>IW2, Ilmi Avenue Intermediate Housing Estate, PMB 229</span><span>Minna, Niger State - Nigeria</span></div><span /></div>
                <h3>{title}</h3>
                <div className="v4-meta"><span><b>Period:</b> {monthName(month)} (FY {fyLabel(fy)}, month {monthNo})</span><span><b>Scope:</b> {deptName}</span><span><b>Printed:</b> {printedAt.toLocaleDateString("en-GB")} {printedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span></div>
                <div className="v4-sum"><div><span>Allocation (FY)</span><b>{money(data.alloc)}</b></div><div><span>Money in ({short})</span><b>{money(data.moneyIn)}</b></div><div><span>Spent ({short})</span><b>{money(data.spentMonth)}</b></div><div><span>Balance C/D</span><b>{money(data.alloc - data.spentToDate)}</b></div></div>
                <table><thead><tr><th>Subhead group</th><th className="v4-r">Allocation</th><th className="v4-r">Spent in {short}</th><th className="v4-r">Spent to date</th><th className="v4-r">Balance</th></tr></thead>
                  <tbody>
                    {data.groups.map((g) => <tr key={g.label}><td>{g.label}</td><td className="v4-r">{money(g.alloc)}</td><td className="v4-r">{money(g.month)}</td><td className="v4-r">{money(g.todate)}</td><td className="v4-r">{money(g.alloc - g.todate)}</td></tr>)}
                    <tr className="v4-t"><td>TOTAL</td><td className="v4-r">{money(data.alloc)}</td><td className="v4-r">{money(data.spentMonth)}</td><td className="v4-r">{money(data.spentToDate)}</td><td className="v4-r">{money(data.alloc - data.spentToDate)}</td></tr>
                  </tbody></table>
                <div style={{ marginTop: 10, fontSize: 10.5, fontWeight: 900, textTransform: "uppercase" }}>Subheads above 80% used</div>
                <table style={{ marginTop: 4 }}><thead><tr><th>Code</th><th>Subhead</th><th className="v4-r">Allocation</th><th className="v4-r">Spent</th><th className="v4-r">Used</th></tr></thead>
                  <tbody>{data.risk.length ? data.risk.map((s) => <tr key={s.id}><td>{s.code}</td><td>{s.name}</td><td className="v4-r">{money(num(s.approved_allocation))}</td><td className="v4-r">{money(num(s.expenditure))}</td><td className="v4-r">{Math.round((num(s.expenditure) / num(s.approved_allocation)) * 100)}%</td></tr>) : <tr><td colSpan={5}>None.</td></tr>}</tbody></table>
                <div style={{ marginTop: 10, fontSize: 10.5, fontWeight: 900, textTransform: "uppercase" }}>Vouchers in {monthName(month, true)}</div>
                <table style={{ marginTop: 4 }}><thead><tr><th>Mode</th><th className="v4-r">Vouchers</th><th className="v4-r">Amount</th><th>Note</th></tr></thead>
                  <tbody>{data.modes.map((m) => <tr key={m.mode}><td>{m.mode}</td><td className="v4-r">{m.n}</td><td className="v4-r">{money(m.amt)}</td><td>{m.mode === "Transfer" && m.combined ? `Includes ${m.combined} combined Official voucher${m.combined === 1 ? "" : "s"}` : m.mode === "Cheque" && m.n ? "Signed by the DG" : m.mode === "Cash" && m.n ? "Receipts on file" : ""}</td></tr>)}</tbody></table>
                <div style={{ marginTop: 10, fontSize: 10.5, fontWeight: 900, textTransform: "uppercase" }}>Largest payments in {monthName(month, true)}</div>
                <table style={{ marginTop: 4 }}><thead><tr><th>Voucher</th><th>Payee</th><th>Details</th><th className="v4-r">Amount</th></tr></thead>
                  <tbody>{data.largest.length ? data.largest.map((v) => <tr key={v.ref}><td>{v.ref}</td><td>{v.title}</td><td>{v.items > 1 ? `${v.items} requests · transfer schedule` : v.detail}</td><td className="v4-r">{money(v.amount)}</td></tr>) : <tr><td colSpan={4}>No voucher paid in {monthName(month)}.</td></tr>}</tbody></table>
                <p className="v4-note">Figures are taken from the ReqGen ledger at the time of printing. Spending is counted when Account releases the fund; payments are vouchers marked paid.</p>
                <div className="v4-rsig">
                  <div><span className="v4-ttl">Prepared by</span><span className="v4-ln">{me.name}</span><span className="v4-ln" /><span className="v4-ln">{printedAt.toLocaleDateString("en-GB")}</span><span className="v4-cp">Name</span><span className="v4-cp">Signature</span><span className="v4-cp">Date</span></div>
                  <div><span className="v4-ttl">Checked by</span><span className="v4-ln">{auditor}</span><span className="v4-ln" /><span className="v4-ln" /><span className="v4-cp">Name</span><span className="v4-cp">Signature</span><span className="v4-cp">Date</span></div>
                </div>
                <div className="v4-rfoot"><span>ReqGen report • {title} • Page 1 of 1</span><em>Building Bridges</em></div>
              </div>
            </article>
          </div>
        </div>
      )}
    </V4Page>
  );
}
