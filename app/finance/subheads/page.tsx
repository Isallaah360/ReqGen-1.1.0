"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";
import { canSeeBudgetBalances } from "@/lib/v4/budgetVisibility";
import { ACCOUNT_COLUMNS, SUBHEAD_COLUMNS, fyOf, num, subheadLabel, subheadLeft, subheadUsed, utilisation, type Account, type Subhead } from "@/lib/v4/finance";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Card, Notice, PageHead, Skeleton, Stats, V4Page, downloadCsv, naira, type StatItem } from "@/app/components/v4/ui";

type Dept = { id: string; name: string };
type Show = "all" | "risk" | "inactive";

function fyLabel(y: number) { return `${y}/${String((y + 1) % 100).padStart(2, "0")}`; }

/** Finance › Budget & Subheads (mock-up 41): allocated, used and left per subhead, grouped by department. */
export default function BudgetSubheadsPage() {
  const me = useIdentity();
  const role = normalizeRole(me.role);
  const canManage = role === "admin" || role === "auditor";
  const mayView = canSeeBudgetBalances(me.role);
  const [subs, setSubs] = useState<Subhead[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [fyStatus, setFyStatus] = useState<string>("Open");
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [show, setShow] = useState<Show>("all");
  const fy = fyOf();

  const load = useCallback(async () => {
    const [s, a, d, y] = await Promise.all([
      supabase.from("subheads").select(SUBHEAD_COLUMNS).order("code", { ascending: true }),
      supabase.from("iet_accounts").select(ACCOUNT_COLUMNS),
      supabase.from("departments").select("id,name").order("name"),
      supabase.from("reqgen_financial_years").select("status").eq("fy_start", fy).maybeSingle(),
    ]);
    setError(s.error ? s.error.message : null);
    setSubs((s.data || []) as Subhead[]);
    setAccounts((a.data || []) as Account[]);
    setDepts((d.data || []) as Dept[]);
    setFyStatus(String((y.data as { status?: string } | null)?.status || "Open"));
  }, [fy]);
  useEffect(() => { if (me.ready && mayView) queueMicrotask(() => { void load(); }); }, [me.ready, mayView, load]);

  const deptName = useMemo(() => new Map(depts.map((d) => [d.id, d.name])), [depts]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (subs || []).filter((s) =>
      (show === "inactive" ? s.is_active === false : s.is_active !== false) &&
      (show !== "risk" || utilisation(s) >= 90) &&
      (dept === "all" || s.dept_id === dept) &&
      (!t || `${s.code} ${s.name} ${deptName.get(s.dept_id || "")}`.toLowerCase().includes(t)));
  }, [subs, q, dept, show, deptName]);

  const groups = useMemo(() => {
    const m = new Map<string, Subhead[]>();
    filtered.forEach((s) => { const k = s.dept_id || "none"; m.set(k, [...(m.get(k) || []), s]); });
    return [...m.entries()].sort((a, b) => String(deptName.get(a[0]) || "zz").localeCompare(String(deptName.get(b[0]) || "zz")));
  }, [filtered, deptName]);

  const active = (subs || []).filter((s) => s.is_active !== false);
  const allocated = active.reduce((t, s) => t + num(s.approved_allocation), 0);
  const left = active.reduce((t, s) => t + subheadLeft(s), 0);
  const bankFund = accounts.filter((a) => a.is_active !== false).reduce((t, a) => t + num(a.total_fund), 0);
  const atRisk = active.filter((s) => utilisation(s) >= 90);

  const stats: StatItem[] = [
    { label: "Subheads", value: subs ? active.length : "…", note: `${new Set(active.map((s) => s.dept_id)).size} departments`, icon: "list", tone: "blue", pressed: show === "all", onClick: () => setShow("all") },
    { label: "Allocated", value: subs ? naira(allocated, { compact: true }) : "…", note: `Of ${naira(bankFund, { compact: true })} bank fund`, icon: "wallet", tone: "brand" },
    { label: "At risk (90%+)", value: subs ? atRisk.length : "…", note: "Tap to see them", icon: "alert", tone: "red", pressed: show === "risk", onClick: () => setShow(show === "risk" ? "all" : "risk") },
    { label: "Left to spend", value: subs ? naira(left, { compact: true }) : "…", note: allocated > 0 ? `${Math.round((left / allocated) * 100)}%` : undefined, icon: "trend", tone: "green" },
  ];

  function exportCsv() {
    downloadCsv(`Budget_Subheads_FY_${fyLabel(fy).replace("/", "-")}.csv`, filtered.map((s) => ({
      Department: deptName.get(s.dept_id || "") || "", Code: s.code || "", Subhead: s.name, Allocated: num(s.approved_allocation),
      Spent: num(s.expenditure), Reserved: num(s.reserved_amount), Left: subheadLeft(s), "Used %": utilisation(s), Status: s.is_active === false ? "Inactive" : "Active",
    })));
  }

  if (me.ready && !mayView) {
    return <V4Page><PageHead title="Budget & Subheads" /><Notice tone="amber" title="Subhead figures are private.">Acting as {me.roleName}, you cannot see subhead balances. Staff, Registry and PD see only “fund available” or “not enough” on a new request.</Notice></V4Page>;
  }

  return (
    <V4Page>
      <PageHead title="Budget & Subheads" sub={<>Approved allocation, what is spent or reserved, and what is left — per subhead. FY {fyLabel(fy)} · <span className={`v4-chip v4-chip-${fyStatus === "Open" ? "green" : "amber"}`}>{fyStatus === "Locked" ? "Budget locked" : fyStatus}</span></>}
        actions={[
          { label: "Export CSV", icon: "download", kind: "secondary", onClick: exportCsv, disabled: !filtered.length },
          ...(canManage ? [{ label: "New subhead", icon: "plus", kind: "primary" as const, href: "/finance/subheads/new" }] : []),
        ]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {fyStatus === "Locked" ? <Notice tone="amber">The FY {fyLabel(fy)} budget is locked. Allocations change only through an approved transfer (Finance › Transfers).</Notice> : null}
      <Stats items={stats} />
      <Card>
        <div className="v4-toolbar">
          <label className="v4-field v4-f-search"><span className="v4-flabel">Search</span><span className="v4-control"><Icon name="search" /><input className="v4-input" placeholder="Code or name" value={q} onChange={(e) => setQ(e.target.value)} /></span></label>
          <div className="v4-field"><span className="v4-flabel">Department</span><Select size="compact" ariaLabel="Department" value={dept} onChange={setDept} options={[{ value: "all", label: "All departments" }, ...depts.map((d) => ({ value: d.id, label: d.name }))]} /></div>
          <div className="v4-field"><span className="v4-flabel">Show</span><Select size="compact" ariaLabel="Show" value={show} onChange={(v) => setShow(v as Show)} options={[{ value: "all", label: "Heads and subheads" }, { value: "risk", label: "At risk only" }, { value: "inactive", label: "Inactive" }]} /></div>
          <div className="v4-field v4-f-extra" style={{ minWidth: 170 }}><span className="v4-flabel">Financial year</span><span className="v4-locked" style={{ minHeight: 40 }}>FY {fyLabel(fy)} (Sep–Aug)</span></div>
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setQ(""); setDept("all"); setShow("all"); }}><Icon name="returned" />Reset</button>
        </div>
        {subs === null ? <Skeleton lines={8} /> : groups.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Subhead</th><th className="v4-r">Allocated</th><th className="v4-r">Used</th><th>Utilisation</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {groups.map(([deptId, list]) => {
                  const alloc = list.reduce((t, s) => t + num(s.approved_allocation), 0);
                  const used = list.reduce((t, s) => t + subheadUsed(s), 0);
                  const pct = alloc > 0 ? Math.round((used / alloc) * 100) : 0;
                  return [
                    <tr key={`h-${deptId}`} className="v4-grouprow">
                      <td><span className="v4-strong">{deptName.get(deptId) || "No department"}</span><span className="v4-sub">{list.length} subhead{list.length === 1 ? "" : "s"} · department total</span></td>
                      <td className="v4-r v4-num v4-strong">{naira(alloc)}</td>
                      <td data-label="Used" className="v4-r v4-num">{naira(used)}</td>
                      <td className="v4-full"><Bar pct={pct} /></td>
                      <td className="v4-r" />
                    </tr>,
                    ...list.map((s) => {
                      const p = utilisation(s);
                      return (
                        <tr key={s.id}>
                          <td><div className="v4-indent"><span className="v4-strong">{subheadLabel(s)}</span><span className="v4-sub">{deptName.get(s.dept_id || "") || ""}{s.is_active === false ? " · inactive" : ""} · left {naira(subheadLeft(s))}</span></div></td>
                          <td className="v4-r v4-num v4-strong">{naira(s.approved_allocation)}</td>
                          <td data-label="Used" className="v4-r v4-num">{naira(subheadUsed(s))}</td>
                          <td className="v4-full"><Bar pct={p} /></td>
                          <td className="v4-r">{canManage ? <Link className="v4-btn v4-btn-secondary" style={{ minHeight: 38, padding: "0 12px" }} href={`/finance/subheads/${s.id}`}>Edit</Link> : <Link className="v4-btn v4-btn-ghost" style={{ minHeight: 38, padding: "0 12px" }} href={`/finance/subheads/${s.id}`}>View</Link>}</td>
                        </tr>
                      );
                    }),
                  ];
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>{show === "risk" ? "No subhead is at 90% or more." : "No subhead matches these filters."}</p>}
      </Card>
      {atRisk.length && show !== "risk" ? <Notice tone="amber">{atRisk.length} subhead{atRisk.length === 1 ? " is" : "s are"} at 90% or more: {atRisk.slice(0, 4).map(subheadLabel).join(", ")}{atRisk.length > 4 ? "…" : ""}</Notice> : null}
    </V4Page>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <>
      <span className="v4-mini-bar" aria-label={`${pct}% used`}><span className={pct >= 90 ? "v4-risk" : pct >= 75 ? "v4-warn" : ""} style={{ width: `${Math.min(100, pct)}%` }} /></span>
      <span className="v4-num" style={{ fontSize: 12.5, marginLeft: 6 }}>{pct}%</span>
    </>
  );
}
