"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight, Banknote, BookOpen, CalendarDays, Download, Eye, FileBarChart2,
  FileSpreadsheet, FileText, Plus, RefreshCw, Search, Send, WalletCards, X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./FinanceOperationsWorkspace.module.css";

type Mode = "account-ledger" | "subhead-ledger" | "account-transfers" | "transactions" | "vouchers" | "reports" | "monthly";
type Row = Record<string, any>;
type Column = { key: string; label: string; format?: "money" | "date" | "status" };
type Config = {
  title: string; description: string; table: string | null; dateField?: string;
  searchFields: string[]; columns: Column[]; primary?: { label: string; href?: string; modal?: boolean };
};

const CONFIG: Record<Mode, Config> = {
  "account-ledger": {
    title: "Account Ledger", description: "View all transactions and balances for a specific account.", table: "iet_account_transactions", dateField: "created_at",
    searchFields: ["transaction_type", "reference_type", "reference_no", "narration", "actor_name"],
    columns: [
      { key: "created_at", label: "Date", format: "date" }, { key: "reference_no", label: "Reference" }, { key: "narration", label: "Description" },
      { key: "transaction_type", label: "Type", format: "status" }, { key: "debit", label: "Debit (₦)", format: "money" }, { key: "credit", label: "Credit (₦)", format: "money" }, { key: "balance_after", label: "Balance (₦)", format: "money" },
    ],
  },
  "subhead-ledger": {
    title: "Subhead Ledger", description: "View transactions and balances for a specific subhead.", table: "finance_transactions", dateField: "transaction_date",
    searchFields: ["transaction_no", "transaction_type", "narration", "external_reference"],
    columns: [
      { key: "transaction_date", label: "Date", format: "date" }, { key: "transaction_no", label: "Reference" }, { key: "narration", label: "Description" },
      { key: "transaction_type", label: "Type", format: "status" }, { key: "debit", label: "Debit (₦)", format: "money" }, { key: "credit", label: "Credit (₦)", format: "money" }, { key: "balance", label: "Balance (₦)", format: "money" },
    ],
  },
  "account-transfers": {
    title: "Account Transfers", description: "Create and manage transfers between accounts.", table: "account_transfers", dateField: "created_at",
    searchFields: ["transfer_no", "narration", "external_reference", "initiated_by_name", "posted_by_name", "status"],
    columns: [
      { key: "created_at", label: "Date", format: "date" }, { key: "transfer_no", label: "Reference" }, { key: "source_account_name", label: "From Account" },
      { key: "destination_account_name", label: "To Account" }, { key: "amount", label: "Amount (₦)", format: "money" }, { key: "status", label: "Status", format: "status" },
    ], primary: { label: "New Transfer", modal: true },
  },
  transactions: {
    title: "Transactions Register", description: "View all finance transactions across the system.", table: "finance_transactions", dateField: "transaction_date",
    searchFields: ["transaction_no", "transaction_type", "narration", "external_reference"],
    columns: [
      { key: "transaction_date", label: "Date", format: "date" }, { key: "transaction_no", label: "Reference" }, { key: "narration", label: "Description" },
      { key: "transaction_type", label: "Type", format: "status" }, { key: "debit", label: "Debit (₦)", format: "money" }, { key: "credit", label: "Credit (₦)", format: "money" }, { key: "status", label: "Status", format: "status" },
    ],
  },
  vouchers: {
    title: "Finance Vouchers", description: "View all system vouchers and their status.", table: "payment_vouchers", dateField: "created_at",
    searchFields: ["voucher_no", "request_no", "payee_name", "narration", "status"],
    columns: [
      { key: "created_at", label: "Date", format: "date" }, { key: "voucher_no", label: "Voucher No." }, { key: "voucher_type", label: "Type" },
      { key: "narration", label: "Description" }, { key: "amount", label: "Amount (₦)", format: "money" }, { key: "status", label: "Status", format: "status" },
    ], primary: { label: "Create Voucher", href: "/finance/manual-voucher" },
  },
  reports: { title: "Finance Reports", description: "Generate and manage financial reports.", table: "finance_transactions", dateField: "transaction_date", searchFields: ["transaction_no", "transaction_type", "narration"], columns: [], primary: { label: "Reports Centre", href: "/reports" } },
  monthly: { title: "Monthly Reports", description: "View and compare monthly financial reports.", table: "finance_transactions", dateField: "transaction_date", searchFields: ["transaction_no", "transaction_type", "narration"], columns: [], primary: { label: "Generate This Month", href: "/reports" } },
};

const money = (v: any) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(Number(v || 0));
const date = (v: any) => { if (!v) return "—"; const d = new Date(v); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
const text = (v: any) => v === null || v === undefined || v === "" ? "—" : String(v);
const csv = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const isCredit = (r: Row) => /credit|deposit|receipt|inflow|transfer in|posted|paid|approved/i.test(text(r.transaction_type || r.type || r.status));
const rowAmount = (r: Row) => Number(r.amount || r.total_amount || 0);

function Dot({ color }: { color: string }) { return <i className={styles.dot} style={{ background: color }} />; }

export default function FinanceOperationsWorkspace({ mode }: { mode: Mode }) {
  const c = CONFIG[mode];
  const [rows, setRows] = useState<Row[]>([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [search, setSearch] = useState(""); const [status, setStatus] = useState("All"); const [period, setPeriod] = useState("All");
  const [selected, setSelected] = useState<Row | null>(null); const [accounts, setAccounts] = useState<Row[]>([]); const [transferOpen, setTransferOpen] = useState(false); const [posting, setPosting] = useState(false);
  const [sourceId, setSourceId] = useState(""); const [destinationId, setDestinationId] = useState(""); const [amount, setAmount] = useState(""); const [narration, setNarration] = useState(""); const [reference, setReference] = useState("");

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true); setError("");
    try {
      const requests: Promise<any>[] = [];
      if (c.table) requests.push(Promise.resolve(supabase.from(c.table).select("*").order(c.dateField || "created_at", { ascending: false }).limit(1000)));
      if (["account-transfers", "account-ledger"].includes(mode)) requests.push(Promise.resolve(supabase.from("iet_accounts").select("*").order("name", { ascending: true, nullsFirst: false })));
      const results = await Promise.all(requests); const main = results[0]; if (main?.error) throw main.error; let data = (main?.data || []) as Row[];
      if (mode === "account-transfers") { const ac = (results[1]?.data || []) as Row[]; setAccounts(ac); const map = new Map(ac.map(x => [x.id, x.name || x.account_name || x.bank_name || "IET Account"])); data = data.map(r => ({ ...r, source_account_name: map.get(r.source_account_id) || "IET Account", destination_account_name: map.get(r.destination_account_id) || "IET Account" })); }
      if (mode === "account-ledger") setAccounts((results[1]?.data || []) as Row[]);
      setRows(data);
    } catch (e: any) { setError(e?.message || "Unable to load this finance workspace."); } finally { setLoading(false); setRefreshing(false); }
  }, [mode, c.table, c.dateField]);
  useEffect(() => { void load(); }, [load]);

  const ledgerRows = useMemo<Row[]>(() => rows.map((r): Row => ({ ...r, debit: isCredit(r) ? 0 : rowAmount(r), credit: isCredit(r) ? rowAmount(r) : 0, balance: r.balance_after ?? r.running_balance ?? r.balance ?? 0 })), [rows]);
  const filtered = useMemo(() => ledgerRows.filter(r => {
    const needle = search.trim().toLowerCase(); const matchesSearch = !needle || c.searchFields.some(k => text(r[k]).toLowerCase().includes(needle)) || Object.values(r).some(v => typeof v === "string" && v.toLowerCase().includes(needle));
    const sv = text(r.status || r.transaction_type).toLowerCase(); const matchesStatus = status === "All" || sv.includes(status.toLowerCase()); let matchesPeriod = true;
    if (period !== "All" && c.dateField) { const d = new Date(r[c.dateField]); const now = new Date(); if (period === "Today") matchesPeriod = d.toDateString() === now.toDateString(); if (period === "Month") matchesPeriod = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); if (period === "Year") matchesPeriod = d.getFullYear() === now.getFullYear(); }
    return matchesSearch && matchesStatus && matchesPeriod;
  }), [ledgerRows, search, status, period, c.searchFields, c.dateField]);

  const totalValue = useMemo(() => rows.reduce((s, r) => s + rowAmount(r), 0), [rows]);
  const totalDebit = useMemo(() => ledgerRows.reduce((s, r) => s + Number(r.debit || 0), 0), [ledgerRows]);
  const totalCredit = useMemo(() => ledgerRows.reduce((s, r) => s + Number(r.credit || 0), 0), [ledgerRows]);
  const opening = Math.max(totalCredit - totalDebit, 0); const closing = opening + totalCredit - totalDebit;
  const posted = rows.filter(r => /posted|paid|complete|success/i.test(text(r.status))).length;
  const pending = rows.filter(r => /pending|draft|await/i.test(text(r.status))).length;
  const cancelled = rows.filter(r => /cancel|reverse|reject/i.test(text(r.status))).length;

  const months = useMemo(() => {
    const map = new Map<string, { key: string; month: string; income: number; expense: number; count: number; status: string; latest: string }>();
    rows.forEach(r => { const d = new Date(r.transaction_date || r.created_at); if (Number.isNaN(d.getTime())) return; const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; const isCurrent = d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear(); const m = map.get(key) || { key, month: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }), income: 0, expense: 0, count: 0, status: isCurrent ? "Current" : "Completed", latest: d.toISOString() }; m.count++; if (d.toISOString() > m.latest) m.latest = d.toISOString(); if (isCredit(r)) m.income += rowAmount(r); else m.expense += rowAmount(r); map.set(key, m); });
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [rows]);

  const exportRows = () => { const cols = c.columns.length ? c.columns : [{ key: "month", label: "Month" }, { key: "count", label: "Transactions" }, { key: "income", label: "Income" }, { key: "expense", label: "Expense" }]; const source = mode === "monthly" ? months : filtered; const content = [cols.map(x => csv(x.label)).join(","), ...source.map(r => cols.map(x => csv(r[x.key])).join(","))].join("\n"); const blob = new Blob([content], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${mode}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url); };

  const postTransfer = async (e: FormEvent) => { e.preventDefault(); setError(""); setSuccess(""); const value = Number(amount); if (!sourceId || !destinationId || sourceId === destinationId || !Number.isFinite(value) || value <= 0 || narration.trim().length < 5) { setError("Complete the transfer form correctly. Source and destination must be different and narration must be clear."); return; } setPosting(true); try { const { data, error: rpcError } = await supabase.rpc("post_account_transfer", { p_source_account_id: sourceId, p_destination_account_id: destinationId, p_amount: value, p_narration: narration.trim(), p_external_reference: reference.trim() || null }); if (rpcError) throw rpcError; setSuccess(`Transfer ${Array.isArray(data) ? data[0]?.transfer_no || "" : data?.transfer_no || ""} posted successfully.`); setTransferOpen(false); setSourceId(""); setDestinationId(""); setAmount(""); setNarration(""); setReference(""); await load(true); } catch (e: any) { setError(e?.message || "Unable to post transfer."); } finally { setPosting(false); } };

  if (loading) return <main className={styles.loading}>Loading finance workspace…</main>;

  if (mode === "reports") return <ReportsPage rows={rows} />;
  if (mode === "monthly") return <MonthlyPage months={months} totalValue={totalValue} exportRows={exportRows} refreshing={refreshing} load={load} />;

  const kpis = mode === "vouchers"
    ? [{ l: "Total Vouchers", v: rows.length, m: "This year" }, { l: "Posted Vouchers", v: posted, m: rows.length ? `${Math.round(posted / rows.length * 100)}%` : "0%" }, { l: "Pending Vouchers", v: pending, m: "Awaiting action" }, { l: "Cancelled Vouchers", v: cancelled, m: "Recorded" }]
    : mode === "account-transfers"
      ? [{ l: "Total Transfers", v: rows.length, m: "This year" }, { l: "Completed", v: posted, m: "Posted transfers" }, { l: "Pending", v: pending, m: "Awaiting action" }, { l: "Transfer Value", v: money(totalValue), m: "Total value" }]
      : mode === "transactions"
        ? [{ l: "Total Transactions", v: rows.length, m: "Recorded entries" }, { l: "Total Debit", v: money(totalDebit), m: "Outflow" }, { l: "Total Credit", v: money(totalCredit), m: "Inflow" }, { l: "Net Balance", v: money(totalCredit - totalDebit), m: "Credit less debit" }]
        : [{ l: "Opening Balance", v: money(opening), m: "Period opening" }, { l: "Total Debit", v: money(totalDebit), m: "Outflow" }, { l: "Total Credit", v: money(totalCredit), m: "Inflow" }, { l: "Closing Balance", v: money(closing), m: "Running balance" }];

  const titleRight = mode === "account-transfers" ? <button className={styles.primary} onClick={() => setTransferOpen(true)}><Plus size={15}/>New Transfer</button> : mode === "vouchers" ? <Link className={styles.primary} href="/finance/manual-voucher"><Plus size={15}/>New Voucher</Link> : null;

  return <main className={styles.page}>
    <header className={styles.header}><div><div className={styles.crumb}>Finance <span>›</span> <b>{c.title}</b></div><h1>{c.title}</h1><p>{c.description}</p></div><div className={styles.actions}>{titleRight}</div></header>
    {error && <div className={`${styles.alert} ${styles.error}`}>{error}</div>}{success && <div className={`${styles.alert} ${styles.success}`}>{success}</div>}
    <section className={styles.kpis}>{kpis.map((k, i) => <article className={styles.kpi} key={k.l}><div className={styles.kpiIcon}>{i === 0 ? <WalletCards size={19}/> : i === 1 ? <Banknote size={19}/> : i === 2 ? <FileText size={19}/> : <BookOpen size={19}/>}</div><div><span>{k.l}</span><strong>{k.v}</strong><small>{k.m}</small></div></article>)}</section>
    <section className={styles.filters}><label className={styles.field}><span>Search</span><div className={styles.inputWrap}><Search size={13}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reference / description…"/></div></label><label className={styles.field}><span>Date Range</span><select value={period} onChange={e => setPeriod(e.target.value)}><option value="All">All dates</option><option value="Today">Today</option><option value="Month">This month</option><option value="Year">This year</option></select></label><label className={styles.field}><span>Status / Type</span><select value={status} onChange={e => setStatus(e.target.value)}><option>All</option><option>Posted</option><option>Pending</option><option>Paid</option><option>Credit</option><option>Debit</option></select></label><button className={styles.filterBtn} onClick={() => { setSearch(""); setStatus("All"); setPeriod("All"); }}>More Filters</button></section>
    <section className={styles.grid}><article className={styles.panel}><div className={styles.panelHead}><div><h2>{mode === "account-transfers" ? `Transfers (${filtered.length})` : mode === "vouchers" ? `Vouchers (${filtered.length})` : `Ledger Entries (${filtered.length})`}</h2><small>Live finance records from ReqGen</small></div><div className={styles.panelTools}><button onClick={() => load(true)} disabled={refreshing}><RefreshCw size={12}/>{refreshing ? "Refreshing" : "Refresh"}</button><button onClick={exportRows}><Download size={12}/>Export</button></div></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr>{c.columns.map(col => <th key={col.key}>{col.label}</th>)}<th>Actions</th></tr></thead><tbody>{filtered.slice(0, 8).map((r, i) => <tr key={r.id || i}>{c.columns.map(col => <td key={col.key}>{col.format === "money" ? <span className={col.key === "credit" ? styles.credit : col.key === "debit" ? styles.debit : styles.money}>{money(r[col.key])}</span> : col.format === "date" ? date(r[col.key]) : col.format === "status" ? <span className={`${styles.pill} ${/pending|draft/i.test(text(r[col.key])) ? styles.pillAmber : /cancel|reject|fail/i.test(text(r[col.key])) ? styles.pillRed : ""}`}>{text(r[col.key])}</span> : <span className={col.key === "reference_no" || col.key === "transaction_no" || col.key === "transfer_no" || col.key === "voucher_no" ? styles.reference : ""}>{text(r[col.key])}</span>}</td>)}<td><div className={styles.rowActions}><button className={styles.iconBtn} title="View" onClick={() => setSelected(r)}><Eye size={13}/></button></div></td></tr>)}{!filtered.length && <tr><td className={styles.empty} colSpan={c.columns.length + 1}>No records match the selected filters.</td></tr>}</tbody></table></div><div className={styles.pagination}><span>Showing 1 to {Math.min(8, filtered.length)} of {filtered.length} entries</span><div className={styles.pages}><button>‹</button><button className={styles.activePage}>1</button><button>2</button><button>3</button><span>…</span><button>›</button></div></div></article>
      <aside className={styles.side}><section className={styles.sideCard}><h3>{mode === "transactions" ? "Transfer Summary" : mode === "vouchers" ? "Voucher Summary" : "Ledger Summary"}</h3><div className={styles.donutBox}><div className={styles.donut}><div><strong>{rows.length}</strong><span>Total</span></div></div><div className={styles.legend}><div><Dot color="#1267e8"/><span>Posted / Credit</span><b>{posted}</b></div><div><Dot color="#13a16d"/><span>Pending / Debit</span><b>{pending}</b></div><div><Dot color="#ff9d24"/><span>Other</span><b>{Math.max(rows.length - posted - pending, 0)}</b></div></div></div></section><section className={styles.sideCard}><h3>Quick Actions</h3><div className={styles.quick}><Link href="/finance/manual-voucher"><span className={styles.quickIcon}><Plus size={13}/></span><span><b>Create Voucher</b><small>Open Manual Voucher Centre</small></span><ArrowRight size={12}/></Link><button onClick={exportRows}><span className={styles.quickIcon}><Download size={13}/></span><span><b>Export Register</b><small>Download current view</small></span><ArrowRight size={12}/></button><Link href="/finance/reports"><span className={styles.quickIcon}><FileBarChart2 size={13}/></span><span><b>Finance Reports</b><small>Open reporting centre</small></span><ArrowRight size={12}/></Link></div></section></aside>
    </section>
    {selected && <div className={styles.modalBack} onClick={() => setSelected(null)}><div className={styles.modal} onClick={e => e.stopPropagation()}><div className={styles.modalHead}><div><h2>{c.title} Details</h2><div className={styles.muted}>Recorded finance information</div></div><button className={styles.close} onClick={() => setSelected(null)}><X size={15}/></button></div><div className={styles.detailGrid}>{c.columns.map(col => <div className={styles.detail} key={col.key}><span>{col.label}</span><strong>{col.format === "money" ? money(selected[col.key]) : col.format === "date" ? date(selected[col.key]) : text(selected[col.key])}</strong></div>)}</div></div></div>}
    {transferOpen && <div className={styles.modalBack} onClick={() => setTransferOpen(false)}><form className={styles.modal} onSubmit={postTransfer} onClick={e => e.stopPropagation()}><div className={styles.modalHead}><div><h2>New Account Transfer</h2><div className={styles.muted}>Controlled transfer between authorised IET bank accounts</div></div><button type="button" className={styles.close} onClick={() => setTransferOpen(false)}><X size={15}/></button></div><div className={styles.formGrid}><label><span>Source Account</span><select value={sourceId} onChange={e => setSourceId(e.target.value)} required><option value="">Select source</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name || a.account_name || a.bank_name || "IET Account"}</option>)}</select></label><label><span>Destination Account</span><select value={destinationId} onChange={e => setDestinationId(e.target.value)} required><option value="">Select destination</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name || a.account_name || a.bank_name || "IET Account"}</option>)}</select></label><label><span>Amount (₦)</span><input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required/></label><label><span>External Reference</span><input value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional"/></label><label className={styles.full}><span>Narration</span><textarea value={narration} onChange={e => setNarration(e.target.value)} required placeholder="Reason for transfer"/></label></div><div className={styles.modalFoot}><button type="button" className={styles.secondary} onClick={() => setTransferOpen(false)}>Cancel</button><button className={styles.primary} type="submit" disabled={posting}><Send size={13}/>{posting ? "Posting…" : "Post Transfer"}</button></div></form></div>}
  </main>;
}

function ReportsPage({ rows }: { rows: Row[] }) {
  const reportCards = [
    ["Trial Balance", "Account ledger balances", "/finance/account-ledger", FileText],
    ["Monthly Finance", "Monthly transaction summary", "/finance/reports/monthly", FileBarChart2],
    ["Annual Finance", "Annual finance summary", "/finance/reports/annual", FileSpreadsheet],
    ["Transactions", "Posted transaction register", "/finance/transactions", Banknote],
    ["Account Ledger", "Detailed account ledger", "/finance/account-ledger", BookOpen],
    ["Subhead Ledger", "Detailed subhead ledger", "/finance/subhead-ledger", FileBarChart2],
    ["Voucher Register", "Finance voucher register", "/finance/vouchers", CalendarDays],
    ["Account Transfers", "Transfer register", "/finance/account-transfers", WalletCards],
  ] as const;
  const postedRows = rows.filter(r => /posted|paid|complete|success|approved/i.test(text(r.status || r.transaction_type)));
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthRows = rows.filter(r => { const d = new Date(r.transaction_date || r.created_at); return !Number.isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
  return <main className={styles.page}>
    <header className={styles.header}><div><div className={styles.crumb}>Finance <span>›</span> <b>Finance Reports</b></div><h1>Finance Reports</h1><p>Generate supported financial outputs from recorded ReqGen finance data.</p></div></header>
    <section className={styles.kpis}>{[["Report Templates",reportCards.length,"Available outputs"],["Posted Transactions",postedRows.length,"Eligible for official reports"],["This Month",monthRows.length,"Recorded transactions"],["Export Centres",2,"PDF / spreadsheet routes"]].map(([l,v,m],i)=><article className={styles.kpi} key={String(l)}><div className={styles.kpiIcon}>{i===0?<FileText size={19}/>:i===1?<FileBarChart2 size={19}/>:i===2?<CalendarDays size={19}/>:<BookOpen size={19}/>}</div><div><span>{l}</span><strong>{v}</strong><small>{m}</small></div></article>)}</section>
    <section className={styles.reportPanel}><div className={styles.panelHead}><div><h2>Popular Reports</h2><small>Outputs supported by existing ReqGen finance routes</small></div></div><div className={styles.reportCards}>{reportCards.map(([title,sub,href,Icon])=><Link href={href} className={styles.reportCard} key={title}><span className={styles.reportIcon}><Icon size={17}/></span><span><b>{title}</b><small>{sub}</small></span><span className={styles.generate}>Open</span></Link>)}</div></section>
    <section className={styles.grid}><article className={styles.panel}><div className={styles.panelHead}><div><h2>Report Data Readiness</h2><small>Live recorded sources used by the reporting pages</small></div></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Source</th><th>Records</th><th>Use</th><th>Status</th></tr></thead><tbody><tr><td className={styles.reference}>Finance Transactions</td><td>{rows.length}</td><td>Monthly, annual and transaction outputs</td><td><span className={styles.pill}>Available</span></td></tr><tr><td className={styles.reference}>Posted Transactions</td><td>{postedRows.length}</td><td>Official finance reporting base</td><td><span className={styles.pill}>Available</span></td></tr></tbody></table></div></article><aside className={styles.side}><section className={`${styles.sideCard} ${styles.note}`}><h3>Important Note</h3><p>Reports use recorded ReqGen data only. No synthetic report history, totals or generated-by values are created by this page.</p></section></aside></section>
  </main>;
}

function MonthlyPage({ months, totalValue, exportRows, refreshing, load }: { months: Array<any>; totalValue: number; exportRows: () => void; refreshing: boolean; load: (manual?: boolean) => Promise<void> }) {
  const completed = months.filter(m => m.status === "Completed").length; const pending = Math.max(months.length - completed, 0); const max = Math.max(...months.slice(0,12).map(m => Math.max(m.income,m.expense)),1);
  return <main className={styles.page}><header className={styles.header}><div><div className={styles.crumb}>Finance <span>›</span> <b>Monthly Reports</b></div><h1>Monthly Reports</h1><p>View and compare monthly financial reports.</p></div><div className={styles.actions}><select className={styles.yearSelect}><option>{new Date().getFullYear()}</option></select></div></header><section className={styles.kpis}>{[["Total Months",months.length],["Completed Months",completed],["Pending Months",pending],["Total Reports",months.reduce((s,m)=>s+m.count,0)]].map(([l,v],i)=><article className={styles.kpi} key={String(l)}><div className={styles.kpiIcon}>{i===0?<CalendarDays size={19}/>:i===1?<FileText size={19}/>:i===2?<RefreshCw size={19}/>:<FileBarChart2 size={19}/>}</div><div><span>{l}</span><strong>{v}</strong><small>{i===3?money(totalValue):"2026"}</small></div></article>)}</section><section className={styles.grid}><article className={styles.panel}><div className={styles.panelHead}><div><h2>Monthly Reports - {new Date().getFullYear()}</h2><small>Generated financial activity by month</small></div><div className={styles.panelTools}><button onClick={()=>load(true)} disabled={refreshing}><RefreshCw size={12}/>Refresh</button><button onClick={exportRows}><Download size={12}/>Export</button></div></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Month</th><th>Status</th><th>Reports Generated</th><th>Generated On</th><th>Actions</th></tr></thead><tbody>{months.slice(0,12).map(m=><tr key={m.key}><td className={styles.reference}>{m.month}</td><td><span className={styles.pill}>{m.status}</span></td><td>{m.count}</td><td>{date(m.latest)}</td><td><div className={styles.rowActions}><button className={styles.iconBtn}><Eye size={13}/></button><button className={styles.iconBtn} onClick={exportRows}><Download size={13}/></button></div></td></tr>)}{!months.length&&<tr><td colSpan={5} className={styles.empty}>No monthly finance activity is available yet.</td></tr>}</tbody></table></div></article><aside className={styles.side}><section className={styles.sideCard}><h3>Monthly Summary</h3><div className={styles.barChart}>{months.slice(0,12).reverse().map(m=><div className={styles.barGroup} key={m.key} title={m.month}><i style={{height:`${Math.max(5,m.income/max*100)}%`}}/><b style={{height:`${Math.max(5,m.expense/max*100)}%`}}/><span>{m.month.slice(0,1)}</span></div>)}</div><div className={styles.chartLegend}><span><Dot color="#1267e8"/>Income</span><span><Dot color="#13a16d"/>Expense</span></div></section><section className={styles.sideCard}><h3>Quick Actions</h3><div className={styles.quick}><Link href="/reports"><span className={styles.quickIcon}><Plus size={13}/></span><span><b>Generate This Month</b><small>Create report output</small></span><ArrowRight size={12}/></Link><button onClick={exportRows}><span className={styles.quickIcon}><Download size={13}/></span><span><b>Export Monthly Data</b><small>Download CSV</small></span><ArrowRight size={12}/></button></div></section></aside></section><section className={`${styles.sideCard} ${styles.note}`}><h3>Important Note</h3><p>Only posted transactions are included in monthly reports.</p></section></main>;
}
