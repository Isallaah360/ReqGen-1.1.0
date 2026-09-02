"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CircleAlert,
  CreditCard,
  FileBarChart2,
  FileText,
  Landmark,
  RefreshCw,
  Search,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./finance-overview.module.css";

type Department = { id: string; name: string };
type Subhead = {
  id: string;
  dept_id: string | null;
  code: string | null;
  name: string;
  approved_allocation: number | string | null;
  reserved_amount: number | string | null;
  expenditure: number | string | null;
  balance: number | string | null;
  is_active: boolean | null;
};
type Tx = {
  id: string;
  transaction_no: string | null;
  transaction_type: string | null;
  amount: number | string | null;
  debit: number | string | null;
  credit: number | string | null;
  transaction_date: string | null;
  narration: string | null;
  subhead_id: string | null;
  is_reversed: boolean | null;
};
type RequestRow = {
  id: string;
  request_no: string | null;
  title: string | null;
  amount: number | string | null;
  status: string | null;
  current_stage: string | null;
  current_owner: string | null;
  dept_id: string | null;
  subhead_id: string | null;
  created_at: string | null;
};
type Voucher = {
  id: string;
  voucher_no: string | null;
  amount: number | string | null;
  total_amount: number | string | null;
  status: string | null;
  voucher_type: string | null;
  payee_name: string | null;
  dept_id: string | null;
  department_id: string | null;
  created_at: string | null;
};
type Account = {
  id: string;
  name: string | null;
  available_balance: number | string | null;
  is_active: boolean | null;
};
type LoadIssue = { source: string; message: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n(value));
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function titleCase(value: string | null | undefined) {
  return String(value || "—").replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function canonicalSubheadBalance(row: Subhead) {
  return n(row.approved_allocation) - n(row.reserved_amount) - n(row.expenditure);
}

function isOpenFinanceRequest(row: RequestRow) {
  const stage = `${row.current_stage || ""} ${row.current_owner || ""}`.toLowerCase();
  const status = String(row.status || "").toLowerCase();
  const financeStage = stage.includes("account") || stage.includes("finance") || stage.includes("payment");
  const closed = ["paid", "posted", "completed", "closed", "rejected", "cancelled"].some((x) => status.includes(x));
  return financeStage && !closed;
}

function isPendingVoucher(voucher: Voucher) {
  const status = String(voucher.status || "").toLowerCase();
  return !["paid", "posted", "completed", "cancelled", "rejected"].some((x) => status.includes(x));
}

export default function FinanceOverviewPage() {
  const currentYear = new Date().getFullYear();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [issues, setIssues] = useState<LoadIssue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subheads, setSubheads] = useState<Subhead[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [search, setSearch] = useState("");
  const [year, setYear] = useState(String(currentYear));
  const [departmentId, setDepartmentId] = useState("ALL");
  const [subheadId, setSubheadId] = useState("ALL");
  const [transactionType, setTransactionType] = useState("ALL");

  const loadData = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setFatalError(null);
    setIssues([]);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Your login session has expired. Please sign in again.");

      await supabase.rpc("reqgen_recalculate_all_iet_accounts");

      const [deptRes, subheadRes, txRes, reqRes, voucherRes, accountRes] = await Promise.all([
        supabase.from("departments").select("id,name").order("name"),
        supabase.from("subheads").select("id,dept_id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active").order("code"),
        supabase.from("finance_transactions").select("id,transaction_no,transaction_type,amount,debit,credit,transaction_date,narration,subhead_id,is_reversed").order("transaction_date", { ascending: false }).limit(2000),
        supabase.from("requests").select("id,request_no,title,amount,status,current_stage,current_owner,dept_id,subhead_id,created_at").order("created_at", { ascending: false }).limit(1000),
        supabase.from("payment_vouchers").select("id,voucher_no,amount,total_amount,status,voucher_type,payee_name,dept_id,department_id,created_at").order("created_at", { ascending: false }).limit(2000),
        supabase.from("iet_accounts").select("id,name,available_balance,is_active").order("name"),
      ]);

      const errors: LoadIssue[] = [];
      if (deptRes.error) errors.push({ source: "Departments", message: deptRes.error.message });
      if (subheadRes.error) errors.push({ source: "Subheads", message: subheadRes.error.message });
      if (txRes.error) errors.push({ source: "Transactions", message: txRes.error.message });
      if (reqRes.error) errors.push({ source: "Requests", message: reqRes.error.message });
      if (voucherRes.error) errors.push({ source: "Payment vouchers", message: voucherRes.error.message });
      if (accountRes.error) errors.push({ source: "IET accounts", message: accountRes.error.message });

      setDepartments((deptRes.data || []) as Department[]);
      setSubheads((subheadRes.data || []) as Subhead[]);
      setTransactions((txRes.data || []) as Tx[]);
      setRequests((reqRes.data || []) as RequestRow[]);
      setVouchers((voucherRes.data || []) as Voucher[]);
      setAccounts((accountRes.data || []) as Account[]);
      setIssues(errors);
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "Unable to load Finance Control Centre data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void loadData(true), 500);
    };
    const channel = supabase
      .channel("finance-control-centre-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "departments" }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "subheads" }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_transactions" }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_vouchers" }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "iet_accounts" }, refreshSoon)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  const departmentMap = useMemo(() => Object.fromEntries(departments.map((d) => [d.id, d.name])), [departments]);
  const subheadMap = useMemo(() => Object.fromEntries(subheads.map((s) => [s.id, s])), [subheads]);

  const years = useMemo(() => {
    const values = new Set<number>([currentYear]);
    transactions.forEach((row) => row.transaction_date && values.add(new Date(row.transaction_date).getFullYear()));
    requests.forEach((row) => row.created_at && values.add(new Date(row.created_at).getFullYear()));
    vouchers.forEach((row) => row.created_at && values.add(new Date(row.created_at).getFullYear()));
    return [...values].filter(Number.isFinite).sort((a, b) => b - a);
  }, [currentYear, requests, transactions, vouchers]);

  const visibleSubheads = useMemo(() => subheads.filter((s) => {
    if (s.is_active === false) return false;
    if (departmentId !== "ALL" && s.dept_id !== departmentId) return false;
    if (subheadId !== "ALL" && s.id !== subheadId) return false;
    return true;
  }), [departmentId, subheadId, subheads]);

  const visibleSubheadIds = useMemo(() => new Set(visibleSubheads.map((s) => s.id)), [visibleSubheads]);

  const visibleTransactions = useMemo(() => transactions.filter((row) => {
    if (row.is_reversed === true) return false;
    if (year !== "ALL" && row.transaction_date && String(new Date(row.transaction_date).getFullYear()) !== year) return false;
    if ((departmentId !== "ALL" || subheadId !== "ALL") && (!row.subhead_id || !visibleSubheadIds.has(row.subhead_id))) return false;
    if (transactionType !== "ALL" && String(row.transaction_type || "") !== transactionType) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const subhead = row.subhead_id ? subheadMap[row.subhead_id] : undefined;
    const dept = subhead?.dept_id ? departmentMap[subhead.dept_id] : "";
    return `${row.transaction_no || ""} ${row.transaction_type || ""} ${row.narration || ""} ${subhead?.code || ""} ${subhead?.name || ""} ${dept}`.toLowerCase().includes(q);
  }), [departmentId, departmentMap, search, subheadId, subheadMap, transactionType, transactions, visibleSubheadIds, year]);

  const visibleRequests = useMemo(() => requests.filter((row) => {
    if (!isOpenFinanceRequest(row)) return false;
    if (year !== "ALL" && row.created_at && String(new Date(row.created_at).getFullYear()) !== year) return false;
    if (departmentId !== "ALL" && row.dept_id !== departmentId) return false;
    if (subheadId !== "ALL" && row.subhead_id !== subheadId) return false;
    return true;
  }), [departmentId, requests, subheadId, year]);

  const visibleVouchers = useMemo(() => vouchers.filter((row) => {
    if (!isPendingVoucher(row)) return false;
    if (year !== "ALL" && row.created_at && String(new Date(row.created_at).getFullYear()) !== year) return false;
    const dept = row.department_id || row.dept_id;
    if (departmentId !== "ALL" && dept !== departmentId) return false;
    return true;
  }), [departmentId, vouchers, year]);

  const totals = useMemo(() => visibleSubheads.reduce((acc, s) => {
    acc.budget += n(s.approved_allocation);
    acc.reserved += n(s.reserved_amount);
    acc.expenditure += n(s.expenditure);
    acc.balance += canonicalSubheadBalance(s);
    return acc;
  }, { budget: 0, reserved: 0, expenditure: 0, balance: 0 }), [visibleSubheads]);

  const pendingPaymentValue = useMemo(() => visibleVouchers.reduce((sum, v) => sum + n(v.total_amount ?? v.amount), 0), [visibleVouchers]);

  const monthTotals = useMemo(() => {
    const values = Array.from({ length: 12 }, () => 0);
    visibleTransactions.forEach((row) => {
      if (!row.transaction_date) return;
      const d = new Date(row.transaction_date);
      if (Number.isNaN(d.getTime())) return;
      values[d.getMonth()] += Math.max(n(row.debit), n(row.amount), 0);
    });
    return values;
  }, [visibleTransactions]);
  const maxMonth = Math.max(...monthTotals, 0);

  const departmentSpend = useMemo(() => {
    const map = new Map<string, { name: string; budget: number; spend: number; balance: number }>();
    if (departmentId === "ALL") {
      departments.forEach((d) => map.set(d.id, { name: d.name, budget: 0, spend: 0, balance: 0 }));
    }
    visibleSubheads.forEach((s) => {
      const key = s.dept_id || "UNASSIGNED";
      const current = map.get(key) || { name: s.dept_id ? departmentMap[s.dept_id] || "Unknown Department" : "Unassigned", budget: 0, spend: 0, balance: 0 };
      current.budget += n(s.approved_allocation);
      current.spend += n(s.expenditure);
      current.balance += canonicalSubheadBalance(s);
      map.set(key, current);
    });
    return [...map.values()].sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name));
  }, [departmentId, departments, departmentMap, visibleSubheads]);
  const maxDepartmentSpend = Math.max(...departmentSpend.map((d) => d.spend), 0);

  const budgetHealth = useMemo(() => visibleSubheads
    .map((s) => ({ ...s, balance: canonicalSubheadBalance(s), utilization: n(s.approved_allocation) > 0 ? (n(s.expenditure) / n(s.approved_allocation)) * 100 : 0 }))
    .sort((a, b) => b.utilization - a.utilization || String(a.code || a.name).localeCompare(String(b.code || b.name))), [visibleSubheads]);

  const transactionTypes = useMemo(() => [...new Set(transactions.map((t) => t.transaction_type).filter(Boolean) as string[])].sort(), [transactions]);
  const accountCash = useMemo(() => accounts.filter((a) => a.is_active !== false).reduce((sum, a) => sum + n(a.available_balance), 0), [accounts]);
  const activeAccounts = useMemo(() => accounts.filter((a) => a.is_active !== false).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))), [accounts]);
  const balanceMismatchCount = useMemo(() => visibleSubheads.filter((s) => s.balance !== null && Math.abs(n(s.balance) - canonicalSubheadBalance(s)) > 0.5).length, [visibleSubheads]);

  if (loading) return <main className={styles.page}><div className={styles.loading}>Loading live Finance data…</div></main>;

  return (
    <main className={styles.page}>
      <section className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>SECTION 4 · FINANCE</span><h1>Finance Control Centre</h1><p>One live view of IET budgets, subheads, transactions, payments and finance work.</p></div>
        <button className={styles.refreshButton} type="button" onClick={() => void loadData(true)} disabled={refreshing}><RefreshCw size={16}/>{refreshing ? "Refreshing…" : "Refresh Live Data"}</button>
      </section>

      {fatalError && <div className={`${styles.notice} ${styles.danger}`}><CircleAlert size={17}/><span>{fatalError}</span></div>}
      {!!issues.length && <div className={styles.notice}><CircleAlert size={17}/><span><b>Some live sources could not be read:</b> {issues.map((i) => `${i.source}: ${i.message}`).join(" · ")}</span></div>}
      {balanceMismatchCount > 0 && <div className={styles.notice}><CircleAlert size={17}/><span><b>Balance reconciliation:</b> {balanceMismatchCount} subhead record{balanceMismatchCount === 1 ? " has" : "s have"} a stored balance different from Allocation − Reserved − Expenditure. ReqGen is displaying the canonical calculated balance.</span></div>}

      <section className={styles.filters}>
        <label><span>Search transactions</span><div className={styles.searchBox}><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Reference, narration, subhead…"/></div></label>
        <label><span>Fiscal Year</span><select value={year} onChange={(e) => setYear(e.target.value)}><option value="ALL">All years</option>{years.map((y) => <option key={y} value={String(y)}>FY {y}</option>)}</select></label>
        <label><span>Budget / Subhead</span><select value={subheadId} onChange={(e) => setSubheadId(e.target.value)}><option value="ALL">All budgets</option>{subheads.filter((s) => departmentId === "ALL" || s.dept_id === departmentId).map((s) => <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ""}{s.name}</option>)}</select></label>
        <label><span>Department</span><select value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setSubheadId("ALL"); }}><option value="ALL">All departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label><span>Transaction Type</span><select value={transactionType} onChange={(e) => setTransactionType(e.target.value)}><option value="ALL">All types</option>{transactionTypes.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></label>
      </section>

      <section className={styles.kpis}>
        <Kpi icon={<WalletCards/>} label="Approved Budget" value={money(totals.budget)} helper={`${visibleSubheads.length} active subhead${visibleSubheads.length === 1 ? "" : "s"}`}/>
        <Kpi icon={<TrendingUp/>} label="Expenditure" value={money(totals.expenditure)} helper="Live subhead expenditure"/>
        <Kpi icon={<FileText/>} label="Reserved" value={money(totals.reserved)} helper={`${visibleRequests.length} request${visibleRequests.length === 1 ? "" : "s"} awaiting Finance`}/>
        <Kpi icon={<CreditCard/>} label="Pending Payments" value={money(pendingPaymentValue)} helper={`${visibleVouchers.length} open voucher${visibleVouchers.length === 1 ? "" : "s"}`}/>
        <Kpi icon={<Landmark/>} label="Available Balance" value={money(totals.balance)} helper={`Bank cash: ${money(accountCash)}`}/>
      </section>

      <section className={styles.analyticsGrid}>
        <article className={styles.card}>
          <div className={styles.cardHead}><div><h2>Actual Expenditure Trend</h2><p>Posted Finance transactions only — no estimated line.</p></div></div>
          {maxMonth > 0 ? <div className={styles.monthChart}>{MONTHS.map((month, index) => <div key={month} className={styles.monthCol}><div className={styles.barTrack}><i style={{ height: `${Math.max(3, (monthTotals[index] / maxMonth) * 100)}%` }}/></div><span>{month}</span><small>{monthTotals[index] ? money(monthTotals[index]) : "—"}</small></div>)}</div> : <EmptyState text="No posted Finance transactions exist for this filter. No trend is drawn."/>}
        </article>

        <article className={styles.card}>
          <div className={styles.cardHead}><div><h2>Expenditure by Department</h2><p>Calculated directly from live subheads.</p></div></div>
          {departmentSpend.some((d) => d.spend > 0) ? <div className={styles.deptList}>{departmentSpend.map((d) => <div key={d.name} className={styles.deptRow}><div><b>{d.name}</b><span>{money(d.spend)} spent · {money(d.balance)} balance</span></div><div className={styles.horizontalTrack}><i style={{ width: `${maxDepartmentSpend ? (d.spend / maxDepartmentSpend) * 100 : 0}%` }}/></div></div>)}</div> : <EmptyState text="No departmental expenditure has been recorded for this filter."/>}
        </article>
      </section>

      <section className={styles.contentGrid}>
        <article className={`${styles.card} ${styles.transactionsCard}`}>
          <div className={styles.cardHead}><div><h2>Recent Transactions</h2><p>{visibleTransactions.length} matching live record{visibleTransactions.length === 1 ? "" : "s"}.</p></div><Link href="/finance/transactions">Open Register <ArrowRight size={14}/></Link></div>
          <div className={styles.tableWrap}><table><thead><tr><th>Date</th><th>Reference</th><th>Type</th><th>Subhead / Department</th><th>Narration</th><th>Amount</th></tr></thead><tbody>{visibleTransactions.slice(0, 8).map((row) => { const sub = row.subhead_id ? subheadMap[row.subhead_id] : undefined; const dept = sub?.dept_id ? departmentMap[sub.dept_id] : "—"; const amount = Math.max(n(row.debit), n(row.amount), n(row.credit)); return <tr key={row.id}><td>{dateLabel(row.transaction_date)}</td><td><b>{row.transaction_no || "—"}</b></td><td>{titleCase(row.transaction_type)}</td><td>{sub ? `${sub.code || ""} ${sub.name}`.trim() : "—"}<small>{dept}</small></td><td>{row.narration || "—"}</td><td className={styles.amount}>{money(amount)}</td></tr>; })}{!visibleTransactions.length && <tr><td colSpan={6}><EmptyState text="No Finance transactions match the selected filters."/></td></tr>}</tbody></table></div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHead}><div><h2>Budget Health</h2><p>Highest utilization first.</p></div><Link href="/finance/subheads">Manage Budgets <ArrowRight size={14}/></Link></div>
          <div className={styles.budgetHealth}>{budgetHealth.map((s) => <div key={s.id} className={styles.budgetItem}><div><b>{s.code || "—"} · {s.name}</b><span>{money(s.expenditure)} of {money(s.approved_allocation)}</span></div><strong>{s.utilization.toFixed(1)}%</strong><div className={styles.horizontalTrack}><i style={{ width: `${Math.min(100, s.utilization)}%` }}/></div></div>)}{!budgetHealth.length && <EmptyState text="No active budget subheads are available."/>}</div>
        </article>
      </section>

      <section className={styles.workGrid}>
        <article className={styles.card}><div className={styles.cardHead}><div><h2>Finance Processing Queue</h2><p>Requests currently routed to Finance or Accounts.</p></div><Link href="/finance/processing">Open Queue <ArrowRight size={14}/></Link></div><div className={styles.queueList}>{visibleRequests.slice(0, 5).map((r) => <Link key={r.id} href={`/finance/request/${r.id}`}><div><b>{r.request_no || "Request"}</b><span>{r.title || "Untitled request"}</span></div><strong>{money(r.amount)}</strong></Link>)}{!visibleRequests.length && <EmptyState text="No request is currently waiting for Finance under this filter."/>}</div></article>
        <article className={styles.card}><div className={styles.cardHead}><div><h2>IET Account Balances</h2><p>Every active IET account from the live account register.</p></div><Link href="/finance/manage-accounts">Open Accounts <ArrowRight size={14}/></Link></div><div className={styles.queueList}>{activeAccounts.map((a) => <Link key={a.id} href="/finance/manage-accounts"><div><b>{a.name || "IET Account"}</b><span>Live available balance</span></div><strong>{money(a.available_balance)}</strong></Link>)}{!activeAccounts.length && <EmptyState text="No active IET accounts are available."/>}</div></article>
        <article className={styles.card}><div className={styles.cardHead}><div><h2>Quick Actions</h2><p>Core Finance workspaces only.</p></div></div><div className={styles.quickGrid}><Quick href="/finance/manage-accounts" icon={<Building2/>} title="IET Accounts"/><Quick href="/finance/subheads" icon={<FileBarChart2/>} title="Budget & Subheads"/><Quick href="/finance/transactions" icon={<FileText/>} title="Transactions & Ledgers"/><Quick href="/finance/account-transfers" icon={<ArrowRight/>} title="Transfers"/><Quick href="/finance/processing" icon={<CreditCard/>} title="Finance Processing"/><Quick href="/finance/reports" icon={<FileBarChart2/>} title="Reports & Output"/></div></article>
      </section>
    </main>
  );
}

function Kpi({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: string; helper: string }) {
  return <article className={styles.kpi}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{helper}</p></div></article>;
}

function EmptyState({ text }: { text: string }) {
  return <div className={styles.emptyState}>{text}</div>;
}

function Quick({ href, icon, title }: { href: string; icon: React.ReactNode; title: string }) {
  return <Link href={href} className={styles.quick}><span>{icon}</span><b>{title}</b><ArrowRight size={14}/></Link>;
}
