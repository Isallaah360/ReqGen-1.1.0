"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { SUBHEAD_COLUMNS, num, subheadLabel, type Subhead } from "@/lib/v4/finance";
import { nairaExact } from "@/lib/v4/money";
import { fyLabel, fyMonths, fyOfMonth, fyRange, groupOf, loadSpend, loadTier, loadTransactions, monthName, monthOf, pct, scopeLabel, thisMonth, type SpendRow, type Tier, type TxRow } from "@/lib/v4/reports";
import { downloadXlsx } from "@/lib/v4/xlsx";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Card, Notice, PageHead, Skeleton, Tabs, V4Page } from "@/app/components/v4/ui";

type Tab = "monthly" | "annual" | "subhead";
type Dept = { id: string; name: string };
type Ledger = { id: string; subhead_id: string | null; entry_type: string | null; amount: number | null; description: string | null; created_at: string };

export default function FinanceStatementsPage() {
  return <Suspense fallback={<V4Page><Skeleton lines={8} /></V4Page>}><Statements /></Suspense>;
}

/** Reports › Finance Statements (mock-up 61): monthly, annual and subhead statements, IET financial year. */
function Statements() {
  const me = useIdentity();
  const params = useSearchParams();
  const nowFy = fyOfMonth(thisMonth());
  const [tier, setTier] = useState<Tier | null>(null);
  const [tab, setTab] = useState<Tab>(() => (["annual", "subhead"].includes(params.get("tab") || "") ? (params.get("tab") as Tab) : "monthly"));
  const [fy, setFy] = useState(nowFy);
  const [dept, setDept] = useState("all");
  const [sub, setSub] = useState("");
  const [from, setFrom] = useState(fyRange(nowFy).from);
  const [to, setTo] = useState(fyRange(nowFy).to);
  const [subs, setSubs] = useState<Subhead[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [spend, setSpend] = useState<SpendRow[] | null>(null);
  const [moneyIn, setMoneyIn] = useState<TxRow[]>([]);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me.ready) return;
    let alive = true;
    queueMicrotask(() => {
      void loadTier(me.role).then((t) => { if (alive) setTier(t); });
      setSpend(null);
      const r = fyRange(fy);
      void Promise.all([
        supabase.from("subheads").select(SUBHEAD_COLUMNS).order("code"),
        supabase.from("departments").select("id,name").order("name"),
        loadSpend(r.from, r.to),
        loadTransactions(r.from, r.to),
        supabase.from("iet_bank_ledger").select("id,subhead_id,entry_type,amount,description,created_at").in("entry_type", ["Subhead Allocation", "Allocation Adjustment"]).gte("created_at", r.from).order("created_at").limit(20000),
      ]).then(([s, d, sp, tx, lg]) => {
        if (!alive) return;
        setSubs((s.data || []) as Subhead[]);
        setDepts((d.data || []) as Dept[]);
        setError(sp.error || s.error?.message || null);
        setSpend(sp.rows);
        setMoneyIn(tx.rows.filter((x) => x.kind === "in"));
        setLedger((lg.data || []) as Ledger[]);
      });
    });
    return () => { alive = false; };
  }, [me.ready, me.role, fy]);

  const deptName = useMemo(() => new Map(depts.map((d) => [d.id, d.name])), [depts]);
  const scopeSubs = useMemo(() => subs.filter((s) => s.is_active !== false && (dept === "all" || s.dept_id === dept)), [subs, dept]);
  const scopeIds = useMemo(() => new Set(scopeSubs.map((s) => s.id)), [scopeSubs]);
  const scopeSpend = useMemo(() => (spend || []).filter((x) => dept === "all" || (x.subhead_id && scopeIds.has(x.subhead_id)) || x.dept_id === dept), [spend, dept, scopeIds]);
  const allocation = scopeSubs.reduce((t, s) => t + num(s.approved_allocation), 0);
  const months = fyMonths(fy);
  const current = thisMonth();

  const monthly = months.reduce<Array<{ month: string; alloc: number | null; inn: number | null; spent: number | null; balance: number | null }>>((acc, m, i) => {
    if (m > current) { acc.push({ month: m, alloc: null, inn: null, spent: null, balance: null }); return acc; }
    const spent = scopeSpend.filter((x) => monthOf(x.at) === m).reduce((t, x) => t + x.amount, 0);
    const inn = moneyIn.filter((x) => monthOf(x.at) === m && (dept === "all" || x.dept_name === deptName.get(dept))).reduce((t, x) => t + x.amount, 0);
    const prev = i === 0 ? allocation : acc[i - 1].balance ?? allocation;
    acc.push({ month: m, alloc: i === 0 ? allocation : null, inn, spent, balance: prev - spent });
    return acc;
  }, []);
  const ytdSpent = monthly.reduce((t, r) => t + (r.spent || 0), 0);
  const ytdIn = monthly.reduce((t, r) => t + (r.inn || 0), 0);

  const annual = useMemo(() => {
    const g = new Map<string, { alloc: number; spent: number; names: Map<string, number> }>();
    scopeSubs.forEach((s) => {
      const k = groupOf(s.code);
      const e = g.get(k) || { alloc: 0, spent: 0, names: new Map() };
      e.alloc += num(s.approved_allocation);
      const dn = deptName.get(s.dept_id || "") || "";
      e.names.set(dn, (e.names.get(dn) || 0) + 1);
      g.set(k, e);
    });
    scopeSpend.forEach((x) => { const k = groupOf(x.subhead_code); const e = g.get(k) || { alloc: 0, spent: 0, names: new Map() }; e.spent += x.amount; g.set(k, e); });
    return [...g.entries()].map(([k, e]) => ({ group: `${k} — ${[...e.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || k}`, alloc: e.alloc, spent: e.spent })).sort((a, b) => b.alloc - a.alloc);
  }, [scopeSubs, scopeSpend, deptName]);

  const sh = subs.find((s) => s.id === sub) || null;
  const statement = useMemo(() => {
    if (!sh) return [];
    const moves = ledger.filter((l) => l.subhead_id === sh.id && l.created_at.slice(0, 10) > fyRange(fy).from);
    const opening = num(sh.approved_allocation) - moves.reduce((t, l) => t + num(l.amount), 0);
    const lines = [
      ...moves.map((l) => ({ at: l.created_at, title: l.entry_type === "Subhead Allocation" ? "Allocation added" : "Allocation moved (transfer)", ref: String(l.description || "").split(" ")[0] || "—", debit: num(l.amount) < 0 ? -num(l.amount) : 0, credit: num(l.amount) > 0 ? num(l.amount) : 0 })),
      ...(spend || []).filter((x) => x.subhead_id === sh.id).map((x) => ({ at: x.at, title: `${x.ref}${x.detail ? ` · ${x.detail}` : ""}`, ref: x.source === "manual" ? "Manual voucher" : "Fund released", debit: x.amount, credit: 0 })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    const all = [{ at: `${fyRange(fy).from}T00:00:00`, title: `Opening allocation FY ${fyLabel(fy)}`, ref: "—", debit: 0, credit: opening }, ...lines];
    const running = all.reduce<Array<typeof all[number] & { balance: number }>>((acc, l) => { acc.push({ ...l, balance: (acc.length ? acc[acc.length - 1].balance : 0) + l.credit - l.debit }); return acc; }, []);
    return running.filter((l, i) => i === 0 || (l.at.slice(0, 10) >= from && l.at.slice(0, 10) <= to));
  }, [sh, ledger, spend, fy, from, to]);

  function exportXlsx() {
    const scope = dept === "all" ? "All departments" : deptName.get(dept) || "";
    downloadXlsx(`Finance_Statements_FY_${fyLabel(fy).replace("/", "-")}`, [
      { name: "Monthly", title: `Monthly statement — FY ${fyLabel(fy)} · ${scope}`, rows: monthly.map((r) => ({ Month: monthName(r.month), Allocation: r.alloc, "Money in": r.inn, Expenditure: r.spent, Balance: r.balance })) },
      { name: "Annual", title: `Annual statement — FY ${fyLabel(fy)} · ${scope}`, rows: annual.map((a) => ({ "Subhead group": a.group, Allocation: a.alloc, Spent: a.spent, Balance: a.alloc - a.spent, "Used %": pct(a.spent, a.alloc) })) },
      ...(sh ? [{ name: "Subhead", title: `Subhead statement — ${subheadLabel(sh)}`, rows: statement.map((l) => ({ Date: l.at.slice(0, 10), Details: l.title, Reference: l.ref, Debit: l.debit || null, Credit: l.credit || null, Balance: l.balance })) }] : []),
    ]);
  }

  return (
    <V4Page>
      <PageHead title="Finance Statements" sub="IET financial year runs 1 September to 31 August. Figures come straight from the ledger: spending is counted when Account releases the fund."
        scope={tier ? scopeLabel(tier, me.roleName) : undefined}
        actions={[
          { label: "Export Excel", icon: "download", kind: "secondary", onClick: exportXlsx, disabled: !spend },
          { label: "Print A4", icon: "printer", kind: "secondary", href: `/reports/print?report=monthly&month=${current > months[11] ? months[11] : current}${dept !== "all" ? `&dept=${dept}` : ""}` },
        ]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Card>
        <div style={{ padding: "0 12px" }}><Tabs value={tab} onChange={setTab} label="Statement" items={[{ key: "monthly", label: "Monthly" }, { key: "annual", label: "Annual" }, { key: "subhead", label: "Subhead statement" }]} /></div>
        {tab !== "subhead" ? (
          <div className="v4-toolbar v4-t3">
            <div className="v4-field"><span className="v4-flabel">Financial year</span><Select size="compact" ariaLabel="Financial year" value={String(fy)} onChange={(v) => setFy(Number(v))} options={[0, 1, 2, 3].map((n) => ({ value: String(nowFy - n), label: `FY ${fyLabel(nowFy - n)}` }))} /></div>
            <div className="v4-field"><span className="v4-flabel">Department</span><Select size="compact" ariaLabel="Department" value={dept} onChange={setDept} options={[{ value: "all", label: "All departments" }, ...depts.map((d) => ({ value: d.id, label: d.name }))]} /></div>
            <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setFy(nowFy); setDept("all"); }}><Icon name="returned" />Reset</button>
          </div>
        ) : (
          <div className="v4-toolbar v4-t3">
            <div className="v4-field v4-f-search"><span className="v4-flabel">Subhead</span><Select size="compact" searchable ariaLabel="Subhead" value={sub} onChange={setSub} placeholder="Choose a subhead" options={subs.filter((s) => s.is_active !== false).map((s) => ({ value: s.id, label: subheadLabel(s), hint: deptName.get(s.dept_id || "") }))} /></div>
            <label className="v4-field"><span className="v4-flabel">From</span><input className="v4-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="v4-field"><span className="v4-flabel">To</span><input className="v4-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
        )}
        {spend === null ? <Skeleton lines={8} /> : tab === "monthly" ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Month</th><th className="v4-r">Allocation</th><th className="v4-r">Money in</th><th className="v4-r">Expenditure</th><th className="v4-r">Balance</th></tr></thead>
              <tbody>
                {monthly.map((r) => (
                  <tr key={r.month} className={r.balance === null ? "v4-muted-row v4-hide-sm" : undefined}>
                    <td><span className="v4-strong">{monthName(r.month)}</span></td>
                    <td className="v4-r v4-num">{r.alloc === null ? "—" : nairaExact(r.alloc)}</td>
                    <td className={`v4-r v4-num${r.inn ? " v4-credit" : ""}`}>{r.inn === null ? "—" : nairaExact(r.inn)}</td>
                    <td className="v4-r v4-num">{r.spent === null ? "—" : nairaExact(r.spent)}</td>
                    <td className="v4-r v4-num v4-strong">{r.balance === null ? "—" : nairaExact(r.balance)}</td>
                  </tr>
                ))}
                <tr><td><span className="v4-strong">Year to date</span></td><td className="v4-r v4-num v4-strong">{nairaExact(allocation)}</td><td className="v4-r v4-num v4-strong">{nairaExact(ytdIn)}</td><td className="v4-r v4-num v4-strong">{nairaExact(ytdSpent)}</td><td className="v4-r v4-num v4-strong">{nairaExact(allocation - ytdSpent)}</td></tr>
              </tbody>
            </table>
            <p className="v4-help" style={{ padding: "12px 20px", margin: 0 }}>Allocation is the approved allocation for the year (including any added since). Money in lists what was added in each month; the balance is allocation less what was released.</p>
          </div>
        ) : tab === "annual" ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Subhead group</th><th className="v4-r">Allocation</th><th className="v4-r">Spent</th><th className="v4-r">Balance</th><th>Used</th></tr></thead>
              <tbody>
                {annual.map((a) => {
                  const p = pct(a.spent, a.alloc);
                  return <tr key={a.group}><td><span className="v4-strong">{a.group}</span></td><td className="v4-r v4-num">{nairaExact(a.alloc)}</td><td className="v4-r v4-num">{nairaExact(a.spent)}</td><td className="v4-r v4-num v4-strong">{nairaExact(a.alloc - a.spent)}</td><td className="v4-full"><span className="v4-mini-bar"><span className={p >= 90 ? "v4-risk" : p >= 75 ? "v4-warn" : ""} style={{ width: `${Math.min(100, p)}%` }} /></span> <span className="v4-num" style={{ fontSize: 12.5 }}>{p}%</span></td></tr>;
                })}
                <tr><td><span className="v4-strong">Total</span></td><td className="v4-r v4-num v4-strong">{nairaExact(allocation)}</td><td className="v4-r v4-num v4-strong">{nairaExact(ytdSpent)}</td><td className="v4-r v4-num v4-strong">{nairaExact(allocation - ytdSpent)}</td><td><span className="v4-strong">{pct(ytdSpent, allocation)}%</span></td></tr>
              </tbody>
            </table>
          </div>
        ) : !sh ? <p className="v4-muted" style={{ padding: 20, margin: 0 }}>Choose a subhead to see its statement.</p> : (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Date</th><th>Details</th><th className="v4-r">Debit</th><th className="v4-r">Credit</th><th className="v4-r">Balance</th></tr></thead>
              <tbody>
                {statement.map((l, i) => (
                  <tr key={`${l.at}-${i}`}><td>{new Date(l.at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td><td><span className="v4-strong">{l.title}</span><span className="v4-sub">{l.ref}</span></td><td className="v4-r v4-num v4-debit">{l.debit ? nairaExact(l.debit) : ""}</td><td className="v4-r v4-num v4-credit">{l.credit ? nairaExact(l.credit) : ""}</td><td className="v4-r v4-num v4-strong">{nairaExact(l.balance)}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="v4-help" style={{ padding: "12px 20px", margin: 0 }}>Reserved for requests still on their way: {nairaExact(sh.reserved_amount)} (not yet spent, so not in this statement).</p>
          </div>
        )}
      </Card>
    </V4Page>
  );
}
